const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

router.use(verifyToken);

router.get('/command-center', requireRole('Admin', 'Accounts_Payable', 'Accounts_Receivable', 'PayrollAccountant', 'Boss'), async (req, res) => {
    try {
        const [
            stockSummary,
            lowStock,
            unreturnedCores,
            incomingAlerts,
            mechanicPerformance,
            fuelFlags,
            pettyCashPending,
            bankSummary
        ] = await Promise.all([
            pool.query(`SELECT COUNT(*)::int AS sku_count, COALESCE(SUM(quantity_on_hand * unit_cost), 0)::numeric(14,2) AS stock_value FROM inventory_items`),
            pool.query(`SELECT * FROM inventory_items WHERE quantity_on_hand <= reorder_level ORDER BY quantity_on_hand ASC`),
            pool.query(
                `SELECT im.*, ii.sku, ii.item_name, wo.wo_number, t.plate_number
                 FROM inventory_movements im
                 JOIN inventory_items ii ON im.item_id = ii.id
                 LEFT JOIN garage_work_orders wo ON im.work_order_id = wo.id
                 LEFT JOIN trucks t ON im.truck_id = t.id
                 WHERE ii.requires_old_core = TRUE AND im.movement_type = 'ISSUE' AND im.old_core_returned = FALSE
                 ORDER BY im.created_at DESC`
            ),
            pool.query(
                `SELECT a.*, t.plate_number, u.name AS driver_name
                 FROM driver_pre_arrival_alerts a
                 LEFT JOIN trucks t ON a.truck_id = t.id
                 LEFT JOIN users u ON a.driver_id = u.id
                 WHERE a.status != 'Arrived & Closed'
                 ORDER BY a.created_at DESC`
            ),
            pool.query(
                `SELECT u.id, u.name,
                        COUNT(wo.id)::int AS total_jobs,
                        COUNT(wo.id) FILTER (WHERE wo.status IN ('Completed', 'Released'))::int AS completed_jobs,
                        COALESCE(AVG(wo.idle_minutes), 0)::int AS avg_idle_minutes
                 FROM users u
                 LEFT JOIN garage_work_orders wo ON wo.assigned_mechanic_id = u.id
                 WHERE u.role = 'Mechanic'
                 GROUP BY u.id, u.name
                 ORDER BY avg_idle_minutes ASC`
            ),
            pool.query(
                `SELECT f.*, t.plate_number, tr.tracking_code
                 FROM fuel_reconciliations f
                 LEFT JOIN trucks t ON f.truck_id = t.id
                 LEFT JOIN trips tr ON f.trip_id = tr.id
                 WHERE f.audit_status != 'Verified'
                 ORDER BY f.fuel_date DESC LIMIT 25`
            ),
            pool.query(
                `SELECT v.*, u.name AS requester_name
                 FROM petty_cash_vouchers v
                 JOIN users u ON v.requested_by = u.id
                 WHERE v.status != 'Reconciled'
                 ORDER BY v.created_at DESC`
            ),
            pool.query(
                `SELECT currency,
                        COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE -amount END), 0)::numeric(14,2) AS net_balance,
                        COUNT(*) FILTER (WHERE reconciled = FALSE)::int AS unreconciled_count
                 FROM bank_ledger_entries
                 GROUP BY currency`
            )
        ]);

        res.json({
            inventory: {
                summary: stockSummary.rows[0],
                low_stock: lowStock.rows,
                unreturned_cores: unreturnedCores.rows
            },
            workshop: {
                incoming_alerts: incomingAlerts.rows,
                mechanic_performance: mechanicPerformance.rows
            },
            finance: {
                fuel_flags: fuelFlags.rows,
                open_petty_cash: pettyCashPending.rows,
                bank_balances: bankSummary.rows
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load executive command center.' });
    }
});

router.post('/pre-arrival-alerts', async (req, res) => {
    try {
        const { truck_id, current_odometer, fault_system, driver_description, requested_spares, eta_at_yard } = req.body;
        const created = await pool.query(
            `INSERT INTO driver_pre_arrival_alerts
             (truck_id, driver_id, current_odometer, fault_system, driver_description, requested_spares, eta_at_yard)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [truck_id, req.user.id, Number(current_odometer), fault_system, driver_description, requested_spares || '', eta_at_yard || null]
        );
        res.status(201).json({ message: 'Pre-arrival fault & spares prep alert sent to Garage & Store.', alert: created.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to submit pre-arrival fault alert.' });
    }
});

router.patch('/pre-arrival-alerts/:id/prep', requireRole('Admin', 'FleetManager', 'Mechanic'), async (req, res) => {
    try {
        const { id } = req.params;
        const { kit_prepared = true, status = 'Spares Staged' } = req.body;
        const updated = await pool.query(
            `UPDATE driver_pre_arrival_alerts
             SET kit_prepared = $1, status = $2, prepared_by = $3
             WHERE id = $4 RETURNING *`,
            [Boolean(kit_prepared), status, req.user.id, id]
        );
        res.json({ message: 'Spares prep status updated.', alert: updated.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update pre-arrival spares prep.' });
    }
});

router.patch('/work-orders/:id/clock-in', requireRole('Mechanic', 'Admin', 'FleetManager'), async (req, res) => {
    try {
        const { id } = req.params;
        const woRes = await pool.query(`SELECT * FROM garage_work_orders WHERE id = $1`, [id]);
        if (woRes.rows.length === 0) return res.status(404).json({ error: 'Work order not found.' });
        const wo = woRes.rows[0];

        const now = new Date();
        const createdAt = new Date(wo.created_at);
        const idleMinutes = Math.max(0, Math.round((now - createdAt) / 60000));

        const updated = await pool.query(
            `UPDATE garage_work_orders
             SET status = 'In Bay',
                 assigned_mechanic_id = COALESCE(assigned_mechanic_id, $1),
                 work_started_at = COALESCE(work_started_at, $2),
                 idle_minutes = CASE WHEN work_started_at IS NULL THEN $3 ELSE idle_minutes END
             WHERE id = $4 RETURNING *`,
            [req.user.id, now, idleMinutes, id]
        );

        res.json({ message: `Clocked into ${wo.wo_number} (Response lag: ${idleMinutes} mins).`, work_order: updated.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to clock into work order.' });
    }
});

router.get('/inventory/items', requireRole('Admin', 'Storekeeper', 'Accounts_Payable', 'Accounts_Receivable', 'PayrollAccountant', 'Boss'), async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM inventory_items ORDER BY item_name ASC`);
        res.json({ items: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load inventory catalog.' });
    }
});

router.post('/inventory/items', requireRole('Admin', 'Storekeeper'), async (req, res) => {
    try {
        const { sku, item_name, category, unit_of_measure = 'PCS', unit_cost = 0, quantity_on_hand = 0, reorder_level = 2, bin_location = '', requires_old_core = false } = req.body;
        const inserted = await pool.query(
            `INSERT INTO inventory_items (sku, item_name, category, unit_of_measure, unit_cost, quantity_on_hand, reorder_level, bin_location, requires_old_core)
             VALUES (UPPER($1), $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [sku.trim(), item_name, category, unit_of_measure, Number(unit_cost), Number(quantity_on_hand), Number(reorder_level), bin_location, Boolean(requires_old_core)]
        );
        res.status(201).json({ message: 'Inventory item registered.', item: inserted.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to register inventory item.' });
    }
});

router.post('/inventory/movements', requireRole('Admin', 'Storekeeper'), async (req, res) => {
    const client = await pool.connect();
    try {
        const {
            item_id,
            movement_type,
            quantity,
            unit_cost,
            department_source = 'GARAGE',
            work_order_id = null,
            truck_id = null,
            supplier_name = '',
            etims_invoice_no = '',
            old_core_returned = false,
            notes = ''
        } = req.body;

        const qty = Number(quantity);
        if (qty <= 0) return res.status(400).json({ error: 'Quantity must be greater than zero.' });

        if (movement_type === 'STOCK_IN' && !etims_invoice_no.trim()) {
            return res.status(400).json({ error: 'KRA eTIMS Invoice Number is required for all spare parts purchases.' });
        }

        await client.query('BEGIN');
        const itemRes = await client.query(`SELECT * FROM inventory_items WHERE id = $1 FOR UPDATE`, [item_id]);
        if (itemRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Inventory item not found.' });
        }
        const item = itemRes.rows[0];

        if (movement_type === 'ISSUE' && Number(item.quantity_on_hand) < qty) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Insufficient stock for ${item.item_name}. Available: ${item.quantity_on_hand}` });
        }

        const effectiveCost = unit_cost !== undefined && unit_cost !== '' ? Number(unit_cost) : Number(item.unit_cost);
        const totalValue = Number((qty * effectiveCost).toFixed(2));
        const delta = movement_type === 'STOCK_IN' || movement_type === 'RETURN' ? qty : -qty;

        await client.query(
            `UPDATE inventory_items
             SET quantity_on_hand = quantity_on_hand + $1,
                 unit_cost = CASE WHEN $2 = 'STOCK_IN' THEN $3 ELSE unit_cost END,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4`,
            [delta, movement_type, effectiveCost, item_id]
        );

        const movRes = await client.query(
            `INSERT INTO inventory_movements
             (item_id, movement_type, quantity, unit_cost, total_value, department_source, work_order_id, truck_id, supplier_name, etims_invoice_no, old_core_returned, notes, recorded_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
             RETURNING *`,
            [item_id, movement_type, qty, effectiveCost, totalValue, department_source, work_order_id || null, truck_id || null, supplier_name, etims_invoice_no, Boolean(old_core_returned), notes, req.user.id]
        );

        if (movement_type === 'ISSUE' && work_order_id) {
            await client.query(
                `UPDATE garage_work_orders
                 SET parts_cost = parts_cost + $1,
                     total_estimate = total_estimate + $1
                 WHERE id = $2`,
                [totalValue, work_order_id]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ message: `${movement_type} recorded for ${item.item_name}.`, movement: movRes.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        res.status(500).json({ error: 'Failed to record stock movement.' });
    } finally {
        client.release();
    }
});

router.patch('/inventory/movements/:id/return-core', requireRole('Admin', 'Storekeeper'), async (req, res) => {
    try {
        const updated = await pool.query(
            `UPDATE inventory_movements SET old_core_returned = TRUE WHERE id = $1 RETURNING *`,
            [req.params.id]
        );
        res.json({ message: 'Old core return confirmed.', movement: updated.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to confirm old core return.' });
    }
});

router.post('/mileage/mass-release', requireRole('Admin', 'FleetManager', 'Dispatcher'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { log_date, entries = [] } = req.body;
        await client.query('BEGIN');

        for (const row of entries) {
            await client.query(
                `INSERT INTO daily_fleet_mileage (log_date, truck_id, opening_km, closing_km, trip_id, yard_status, recorded_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (log_date, truck_id) DO UPDATE SET
                    opening_km = EXCLUDED.opening_km,
                    closing_km = EXCLUDED.closing_km,
                    trip_id = EXCLUDED.trip_id,
                    yard_status = EXCLUDED.yard_status`,
                [log_date, row.truck_id, Number(row.opening_km), Number(row.closing_km), row.trip_id || null, row.yard_status || 'On Corridor', req.user.id]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ message: `Saved daily mass mileage for ${entries.length} trucks.` });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        res.status(500).json({ error: 'Failed to save daily mass mileage.' });
    } finally {
        client.release();
    }
});

router.post('/fuel/reconcile', requireRole('Admin', 'FleetManager'), async (req, res) => {
    try {
        const {
            fuel_date,
            truck_id,
            trip_id = null,
            station_name,
            card_reference = '',
            etims_invoice_no = '',
            litres,
            price_per_litre,
            odometer_reading = 0,
            km_since_last_fill = 0
        } = req.body;

        const ltrs = Number(litres);
        const totalAmount = Number((ltrs * Number(price_per_litre)).toFixed(2));
        const kmSince = Number(km_since_last_fill || 0);
        const kmPerLitre = ltrs > 0 && kmSince > 0 ? Number((kmSince / ltrs).toFixed(2)) : 0;

        const flags = [];
        if (!trip_id) flags.push('No Active Trip Linked');
        if (!etims_invoice_no.trim()) flags.push('Missing eTIMS Invoice');
        if (kmPerLitre > 0 && kmPerLitre < 1.8) flags.push(`Low Efficiency (${kmPerLitre} km/L)`);

        const auditStatus = flags.length === 0 ? 'Verified' : 'Flagged';

        const inserted = await pool.query(
            `INSERT INTO fuel_reconciliations
             (fuel_date, truck_id, trip_id, station_name, card_reference, etims_invoice_no, litres, price_per_litre, total_amount, odometer_reading, km_since_last_fill, km_per_litre, audit_status, flag_reason, verified_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
             RETURNING *`,
            [
                fuel_date,
                truck_id,
                trip_id || null,
                station_name,
                card_reference,
                etims_invoice_no,
                ltrs,
                Number(price_per_litre),
                totalAmount,
                Number(odometer_reading || 0),
                kmSince,
                kmPerLitre,
                auditStatus,
                flags.join(' | '),
                auditStatus === 'Verified' ? req.user.id : null
            ]
        );

        res.status(201).json({
            message: auditStatus === 'Verified' ? 'Fuel transaction verified against trip & eTIMS.' : `Fuel flagged: ${flags.join(', ')}`,
            record: inserted.rows[0]
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to reconcile fuel entry.' });
    }
});

router.post('/petty-cash', async (req, res) => {
    try {
        const unclosed = await pool.query(
            `SELECT COUNT(*)::int AS cnt FROM petty_cash_vouchers WHERE requested_by = $1 AND status = 'Disbursed'`,
            [req.user.id]
        );
        if (unclosed.rows[0].cnt > 0) {
            return res.status(400).json({ error: 'You have an unaccounted petty cash float. Submit your eTIMS receipt before requesting new cash.' });
        }

        const { department_source = 'FLEET_TRANSPORT', truck_id = null, work_order_id = null, purpose, items_requested, amount_requested, payment_channel = 'Openfloat' } = req.body;
        const voucherNo = `PCV-${Date.now().toString().slice(-6)}`;

        const created = await pool.query(
            `INSERT INTO petty_cash_vouchers
             (voucher_no, requested_by, department_source, truck_id, work_order_id, purpose, items_requested, amount_requested, payment_channel)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             RETURNING *`,
            [voucherNo, req.user.id, department_source, truck_id || null, work_order_id || null, purpose, items_requested, Number(amount_requested), payment_channel]
        );
        res.status(201).json({ message: `Petty cash requisition ${voucherNo} submitted.`, voucher: created.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to submit petty cash request.' });
    }
});

router.patch('/petty-cash/:id/disburse', requireRole('Accounts_Payable', 'Accounts_Receivable', 'Boss'), async (req, res) => {
    try {
        const { amount_disbursed, bank_or_float_ref } = req.body;
        const updated = await pool.query(
            `UPDATE petty_cash_vouchers
             SET amount_disbursed = $1, bank_or_float_ref = $2, status = 'Disbursed', approved_by = $3
             WHERE id = $4 RETURNING *`,
            [Number(amount_disbursed), bank_or_float_ref, req.user.id, req.params.id]
        );
        res.json({ message: 'Petty cash disbursed and linked to payment reference.', voucher: updated.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to disburse petty cash.' });
    }
});

router.patch('/petty-cash/:id/settle', requireRole('Accounts_Payable', 'Accounts_Receivable', 'Boss'), async (req, res) => {
    try {
        const { items_bought, actual_spent, change_returned = 0, etims_cu_invoice_no } = req.body;
        if (!etims_cu_invoice_no || !etims_cu_invoice_no.trim()) {
            return res.status(400).json({ error: 'Valid KRA eTIMS CU Invoice Number is mandatory to settle petty cash.' });
        }

        const updated = await pool.query(
            `UPDATE petty_cash_vouchers
             SET items_bought = $1,
                 actual_spent = $2,
                 change_returned = $3,
                 etims_cu_invoice_no = UPPER($4),
                 receipt_verified = TRUE,
                 status = 'Reconciled'
             WHERE id = $5 RETURNING *`,
            [items_bought, Number(actual_spent), Number(change_returned), etims_cu_invoice_no.trim(), req.params.id]
        );
        res.json({ message: 'Petty cash settled and verified against KRA eTIMS receipt.', voucher: updated.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to settle petty cash voucher.' });
    }
});

router.get('/bank-ledger', requireRole('Admin', 'Accounts_Payable', 'Accounts_Receivable', 'PayrollAccountant', 'Boss'), async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM bank_ledger_entries ORDER BY entry_date DESC, id DESC LIMIT 100`);
        res.json({ entries: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load bank ledger.' });
    }
});

router.post('/bank-ledger', requireRole('Accounts_Payable', 'Accounts_Receivable', 'Boss'), async (req, res) => {
    try {
        const { entry_date, account_name, bank_reference, entry_type, department_source = 'GENERAL', description, amount, currency = 'KES', etims_ref = '', reconciled = false } = req.body;
        const created = await pool.query(
            `INSERT INTO bank_ledger_entries
             (entry_date, account_name, bank_reference, entry_type, department_source, description, amount, currency, etims_ref, reconciled, reconciled_by)
             VALUES ($1,$2,UPPER($3),$4,$5,$6,$7,$8,$9,$10,$11)
             RETURNING *`,
            [entry_date, account_name, bank_reference.trim(), entry_type, department_source, description, Number(amount), currency, etims_ref, Boolean(reconciled), reconciled ? req.user.id : null]
        );
        res.status(201).json({ message: 'Bank ledger entry recorded.', entry: created.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to record bank ledger entry.' });
    }
    router.get('/mileage/daily', async (req, res) => {
    try {
        const logDate = req.query.date || new Date().toISOString().slice(0, 10);
        const result = await pool.query(
            `SELECT t.id AS truck_id,
                    t.plate_number,
                    t.make,
                    t.model,
                    t.status AS truck_status,
                    m.id AS mileage_id,
                    m.log_date,
                    COALESCE(m.opening_km, prev.closing_km, 0) AS opening_km,
                    COALESCE(m.closing_km, prev.closing_km, 0) AS closing_km,
                    COALESCE(m.distance_km, 0) AS distance_km,
                    COALESCE(m.yard_status, CASE WHEN t.status = 'Active' THEN 'On Corridor' ELSE 'In Yard / Workshop' END) AS yard_status,
                    m.trip_id
             FROM trucks t
             LEFT JOIN daily_fleet_mileage m
               ON m.truck_id = t.id AND m.log_date = $1::date
             LEFT JOIN LATERAL (
                 SELECT closing_km
                 FROM daily_fleet_mileage
                 WHERE truck_id = t.id AND log_date < $1::date
                 ORDER BY log_date DESC
                 LIMIT 1
             ) prev ON TRUE
             ORDER BY t.plate_number ASC`,
            [logDate]
        );
        res.json({ date: logDate, rows: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load daily fleet mileage sheet.' });
    }
});

router.get('/fuel/records', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT f.*, t.plate_number, tr.tracking_code
             FROM fuel_reconciliations f
             LEFT JOIN trucks t ON f.truck_id = t.id
             LEFT JOIN trips tr ON f.trip_id = tr.id
             ORDER BY f.fuel_date DESC, f.id DESC
             LIMIT 100`
        );
        res.json({ records: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load fuel reconciliation ledger.' });
    }
});
});

module.exports = router;