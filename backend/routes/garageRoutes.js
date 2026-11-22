const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

router.use(verifyToken);

// Get Garage Bays & Available Mechanics
router.get('/meta', async (req, res) => {
    try {
        const [baysRes, mechsRes, trucksRes] = await Promise.all([
            pool.query(`SELECT * FROM garage_bays WHERE is_active = TRUE ORDER BY bay_code ASC`),
            pool.query(`SELECT id, username AS name, role, phone_number FROM users WHERE role IN ('Mechanic', 'Admin', 'FleetManager') ORDER BY username ASC`),
            pool.query(`SELECT id, plate_number, model, status FROM trucks ORDER BY plate_number ASC`)
        ]);
        res.json({
            bays: baysRes.rows,
            mechanics: mechsRes.rows,
            trucks: trucksRes.rows
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load garage metadata.' });
    }
});

// Shared Mechanics Queue & Department Filter
router.get('/work-orders', async (req, res) => {
    try {
        const dept = (req.query.department || 'ALL').toUpperCase();
        const status = req.query.status || 'ALL';
        const conditions = [];
        const params = [];

        if (dept !== 'ALL') {
            params.push(dept);
            conditions.push(`wo.department_source = $${params.length}`);
        }
        if (status !== 'ALL') {
            params.push(status);
            conditions.push(`wo.status = $${params.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const result = await pool.query(
            `SELECT wo.*,
                    b.bay_code, b.bay_name,
                    m.username AS mechanic_name,
                    t.plate_number AS linked_truck_plate
             FROM garage_work_orders wo
             LEFT JOIN garage_bays b ON wo.bay_id = b.id
             LEFT JOIN users m ON wo.assigned_mechanic_id = m.id
             LEFT JOIN trucks t ON wo.truck_id = t.id
             ${whereClause}
             ORDER BY
                CASE wo.priority WHEN 'Critical' THEN 1 WHEN 'Urgent' THEN 2 WHEN 'Normal' THEN 3 ELSE 4 END,
                wo.created_at DESC`,
            params
        );

        res.json({ work_orders: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load garage work orders.' });
    }
});

// Create Work Order (Commercial Garage, Fleet Transport, or Container Depot Equipment)
router.post('/work-orders', requireRole('Admin', 'FleetManager', 'Dispatcher', 'Mechanic'), async (req, res) => {
    const client = await pool.connect();
    try {
        const {
            department_source = 'GARAGE',
            asset_type = 'EXTERNAL_VEHICLE',
            asset_identifier,
            truck_id = null,
            bay_id = null,
            customer_or_unit = '',
            customer_phone = '',
            fault_category = 'PREVENTIVE_SERVICE',
            dtc_codes = '',
            problem_description,
            parts_cost = 0,
            labor_cost = 0,
            billing_currency = 'KES',
            priority = 'Normal',
            assigned_mechanic_id = null,
            hold_truck_from_dispatch = false
        } = req.body;

        if (!asset_identifier || !problem_description) {
            return res.status(400).json({ error: 'Asset registration/identifier and problem description are required.' });
        }

        const woNumber = `WO-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
        const totalEstimate = Number(parts_cost || 0) + Number(labor_cost || 0);

        await client.query('BEGIN');

        const inserted = await client.query(
            `INSERT INTO garage_work_orders
             (wo_number, department_source, asset_type, asset_identifier, truck_id, bay_id,
              customer_or_unit, customer_phone, fault_category, dtc_codes, problem_description,
              parts_cost, labor_cost, total_estimate, billing_currency, priority, assigned_mechanic_id, created_by)
             VALUES ($1,$2,$3,UPPER($4),$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
             RETURNING *`,
            [
                woNumber,
                department_source,
                asset_type,
                asset_identifier.trim(),
                truck_id || null,
                bay_id || null,
                customer_or_unit,
                customer_phone,
                fault_category,
                dtc_codes,
                problem_description,
                Number(parts_cost || 0),
                Number(labor_cost || 0),
                totalEstimate,
                billing_currency,
                priority,
                assigned_mechanic_id || null,
                req.user.id
            ]
        );

        if (truck_id && hold_truck_from_dispatch) {
            await client.query(`UPDATE trucks SET status = 'In Maintenance' WHERE id = $1`, [truck_id]);
        }

        await client.query('COMMIT');
        res.status(201).json({
            message: `Work Order ${woNumber} logged into shared mechanics queue.`,
            work_order: inserted.rows[0]
        });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        res.status(500).json({ error: 'Failed to create garage work order.' });
    } finally {
        client.release();
    }
});

// Mechanic Bay Update (Claim Job, Log Parts/Hours, Complete & Release Asset)
router.patch('/work-orders/:id', requireRole('Mechanic', 'Admin', 'FleetManager'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const {
            status,
            bay_id,
            assigned_mechanic_id,
            dtc_codes,
            parts_used,
            labor_hours,
            parts_cost,
            expected_parts_cost,
            labor_cost,
            release_truck_to_active = false
        } = req.body;

        await client.query('BEGIN');

        const existingRes = await client.query(`SELECT * FROM garage_work_orders WHERE id = $1 FOR UPDATE`, [id]);
        if (existingRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Work order not found.' });
        }
        const current = existingRes.rows[0];
        if (expected_parts_cost !== undefined &&
            (!Number.isFinite(Number(expected_parts_cost)) || Number(expected_parts_cost) !== Number(current.parts_cost))) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Parts cost changed since this work order was opened. Reload it before saving.' });
        }

        const nextParts = parts_cost !== undefined ? Number(parts_cost) : Number(current.parts_cost);
        const nextLabor = labor_cost !== undefined ? Number(labor_cost) : Number(current.labor_cost);
        const nextTotal = nextParts + nextLabor;
        const nextStatus = status || current.status;
        if (['Completed', 'Released'].includes(nextStatus)) {
            const outstanding = await client.query(
                `SELECT 1 FROM garage_part_requests
                 WHERE work_order_id = $1 AND status IN ('Pending', 'Reserved') LIMIT 1`,
                [id]
            );
            if (outstanding.rowCount) {
                await client.query('ROLLBACK');
                return res.status(409).json({ error: 'Resolve all pending and reserved parts before completing this work order.' });
            }
        }
        const completedAt = ['Completed', 'Released'].includes(nextStatus) && !current.completed_at
            ? new Date()
            : current.completed_at;

        const updated = await client.query(
            `UPDATE garage_work_orders
             SET status = $1,
                 bay_id = COALESCE($2, bay_id),
                 assigned_mechanic_id = COALESCE($3, assigned_mechanic_id),
                 dtc_codes = COALESCE($4, dtc_codes),
                 parts_used = COALESCE($5, parts_used),
                 labor_hours = COALESCE($6, labor_hours),
                 parts_cost = $7,
                 labor_cost = $8,
                 total_estimate = $9,
                 completed_at = $10
             WHERE id = $11
             RETURNING *`,
            [
                nextStatus,
                bay_id || null,
                assigned_mechanic_id || null,
                dtc_codes !== undefined ? dtc_codes : null,
                parts_used !== undefined ? parts_used : null,
                labor_hours !== undefined ? Number(labor_hours) : null,
                nextParts,
                nextLabor,
                nextTotal,
                completedAt,
                id
            ]
        );

        if (current.truck_id && (release_truck_to_active || nextStatus === 'Released')) {
            await client.query(`UPDATE trucks SET status = 'Active' WHERE id = $1`, [current.truck_id]);
        }

        await client.query('COMMIT');
        res.json({
            message: `Work Order ${current.wo_number} updated (${nextStatus}).`,
            work_order: updated.rows[0]
        });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        res.status(500).json({ error: 'Failed to update garage work order.' });
    } finally {
        client.release();
    }
});

module.exports = router;