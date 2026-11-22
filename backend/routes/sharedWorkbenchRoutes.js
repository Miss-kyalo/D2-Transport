const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();
const workbenchAccess = [verifyToken, requireRole('Admin', 'Mechanic', 'FleetManager', 'Storekeeper')];
const storeAccess = requireRole('Admin', 'Storekeeper');

function positiveInteger(value) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function failure(status, message) {
    return Object.assign(new Error(message), { status });
}

async function transaction(work) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await work(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            console.error('Failed to roll back shared workbench transaction:', rollbackError);
        }
        throw error;
    } finally {
        client.release();
    }
}

function sendError(res, error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Shared workbench error:', error);
    return res.status(500).json({ error: 'Shared workbench operation failed.' });
}

router.get('/shared-workbench', ...workbenchAccess, async (_req, res) => {
    try {
        const [orders, inventory, drivers, mechanics] = await Promise.all([
            pool.query(
                `SELECT wo.id, wo.wo_number, wo.department_source, wo.asset_type, wo.asset_identifier,
                        wo.status, wo.problem_description, wo.truck_id, wo.driver_id, wo.assigned_mechanic_id,
                        t.plate_number AS truck_plate, t.model AS truck_model,
                        d.username AS driver_name, m.username AS mechanic_name
                 FROM garage_work_orders wo
                 LEFT JOIN trucks t ON t.id = wo.truck_id
                 LEFT JOIN users d ON d.id = wo.driver_id
                 LEFT JOIN users m ON m.id = wo.assigned_mechanic_id
                 ORDER BY wo.created_at DESC, wo.id DESC`
            ),
            pool.query(
                `SELECT id, sku, part_name, qty_on_hand, qty_reserved,
                        qty_on_hand - qty_reserved AS qty_available
                 FROM inventory_items ORDER BY part_name, id`
            ),
            pool.query(`SELECT id, username FROM users WHERE role = 'Driver' ORDER BY username`),
            pool.query(`SELECT id, username FROM users WHERE role = 'Mechanic' ORDER BY username`)
        ]);
        res.json({ work_orders: orders.rows, inventory: inventory.rows, drivers: drivers.rows, mechanics: mechanics.rows });
    } catch (error) {
        sendError(res, error);
    }
});

router.patch('/shared-workbench/:id/assignment', ...workbenchAccess, requireRole('Admin', 'Mechanic', 'FleetManager'), async (req, res) => {
    const orderId = positiveInteger(req.params.id);
    const driverId = req.body.driver_id === null ? null : positiveInteger(req.body.driver_id);
    const mechanicId = req.body.mechanic_id === null ? null : positiveInteger(req.body.mechanic_id);
    if (!orderId || (req.body.driver_id !== null && !driverId) || (req.body.mechanic_id !== null && !mechanicId)) {
        return res.status(400).json({ error: 'Valid driver and mechanic selections are required.' });
    }
    try {
        const result = await pool.query(
            `UPDATE garage_work_orders SET driver_id = $1, assigned_mechanic_id = $2
             WHERE id = $3
               AND ($1::integer IS NULL OR EXISTS (SELECT 1 FROM users WHERE id = $1 AND role = 'Driver'))
               AND ($2::integer IS NULL OR EXISTS (SELECT 1 FROM users WHERE id = $2 AND role = 'Mechanic'))
             RETURNING id`,
            [driverId, mechanicId, orderId]
        );
        if (!result.rowCount) return res.status(400).json({ error: 'Work order, driver, or mechanic was not found.' });
        res.json({ message: 'Work order assignments updated.' });
    } catch (error) {
        sendError(res, error);
    }
});

router.get('/shared-workbench/:id/parts', ...workbenchAccess, async (req, res) => {
    const orderId = positiveInteger(req.params.id);
    if (!orderId) return res.status(400).json({ error: 'A valid work order is required.' });
    try {
        const result = await pool.query(
            `SELECT r.*, i.part_name, i.sku, u.username AS requester_name
             FROM garage_part_requests r JOIN inventory_items i ON i.id = r.item_id
             JOIN users u ON u.id = r.requested_by
             WHERE r.work_order_id = $1 ORDER BY r.created_at DESC, r.id DESC`,
            [orderId]
        );
        res.json({ requests: result.rows });
    } catch (error) {
        sendError(res, error);
    }
});

router.post('/shared-workbench/:id/parts', ...workbenchAccess, requireRole('Admin', 'Mechanic', 'FleetManager'), async (req, res) => {
    const orderId = positiveInteger(req.params.id);
    const itemId = positiveInteger(req.body.item_id);
    const qty = positiveInteger(req.body.qty);
    if (!orderId || !itemId || !qty || qty > 2147483647) {
        return res.status(400).json({ error: 'A valid work order, inventory item and whole-number quantity are required.' });
    }
    try {
        const request = await transaction(async (client) => {
            const order = await client.query('SELECT status FROM garage_work_orders WHERE id = $1 FOR UPDATE', [orderId]);
            if (!order.rowCount) throw failure(404, 'Work order not found.');
            if (['Completed', 'Released'].includes(order.rows[0].status)) throw failure(409, 'Parts cannot be requested for a completed work order.');
            const item = await client.query('SELECT id FROM inventory_items WHERE id = $1', [itemId]);
            if (!item.rowCount) throw failure(404, 'Inventory item not found.');
            const result = await client.query(
                `INSERT INTO garage_part_requests (work_order_id, item_id, qty, requested_by)
                 VALUES ($1, $2, $3, $4) RETURNING *`,
                [orderId, itemId, qty, req.user.id]
            );
            return result.rows[0];
        });
        res.status(201).json({ message: 'Part requested for storekeeper review.', request });
    } catch (error) {
        sendError(res, error);
    }
});

router.patch('/shared-workbench/parts/:id', ...workbenchAccess, storeAccess, async (req, res) => {
    const requestId = positiveInteger(req.params.id);
    const action = req.body.action;
    if (!requestId || !['reserve', 'reject', 'issue'].includes(action)) {
        return res.status(400).json({ error: 'A valid parts request and action are required.' });
    }
    try {
        const request = await transaction(async (client) => {
            const lookup = await client.query('SELECT work_order_id FROM garage_part_requests WHERE id = $1', [requestId]);
            if (!lookup.rowCount) throw failure(404, 'Parts request not found.');
            const order = await client.query('SELECT status, billing_currency FROM garage_work_orders WHERE id = $1 FOR UPDATE', [lookup.rows[0].work_order_id]);
            if (!order.rowCount) throw failure(404, 'Work order not found.');
            if (['Completed', 'Released'].includes(order.rows[0].status)) throw failure(409, 'Work order is already completed.');
            const result = await client.query('SELECT * FROM garage_part_requests WHERE id = $1 FOR UPDATE', [requestId]);
            const current = result.rows[0];
            if ((action === 'issue' && current.status !== 'Reserved') ||
                (action === 'reserve' && current.status !== 'Pending') ||
                (action === 'reject' && !['Pending', 'Reserved'].includes(current.status))) {
                throw failure(409, 'This parts request has already been processed.');
            }

            let unitCost = null;
            if (action !== 'reject' || current.status === 'Reserved') {
                const itemResult = await client.query('SELECT * FROM inventory_items WHERE id = $1 FOR UPDATE', [current.item_id]);
                const item = itemResult.rows[0];
                if (!item) throw failure(404, 'Inventory item not found.');
                if (action === 'reserve' && current.qty > item.qty_on_hand - item.qty_reserved) {
                    throw failure(409, 'Insufficient available stock to reserve this request.');
                }
                if (action === 'issue' && (current.qty > item.qty_on_hand || current.qty > item.qty_reserved)) {
                    throw failure(409, 'Inventory quantities are inconsistent; the part was not issued.');
                }
                if (action === 'reject' && current.qty > item.qty_reserved) {
                    throw failure(409, 'Inventory reservation totals are inconsistent; the request was not rejected.');
                }
                if (action === 'reserve') {
                    await client.query('UPDATE inventory_items SET qty_reserved = qty_reserved + $1 WHERE id = $2', [current.qty, current.item_id]);
                } else if (action === 'issue') {
                    if (order.rows[0].billing_currency !== 'KES') {
                        throw failure(409, 'Parts cannot be issued to a non-KES work order without currency conversion.');
                    }
                    unitCost = item.unit_cost;
                    await client.query('UPDATE inventory_items SET qty_on_hand = qty_on_hand - $1, qty_reserved = qty_reserved - $1 WHERE id = $2', [current.qty, current.item_id]);
                    await client.query(
                        `UPDATE garage_work_orders
                         SET parts_cost = COALESCE(parts_cost, 0) + $1::integer * $2::numeric,
                             total_estimate = COALESCE(total_estimate, 0) + $1::integer * $2::numeric
                         WHERE id = $3`,
                        [current.qty, unitCost, current.work_order_id]
                    );
                } else {
                    await client.query('UPDATE inventory_items SET qty_reserved = qty_reserved - $1 WHERE id = $2', [current.qty, current.item_id]);
                }
                await client.query(
                    `INSERT INTO stock_movements (item_id, work_order_id, movement_type, qty, actor_name)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [current.item_id, current.work_order_id, action === 'reserve' ? 'RESERVED' : action === 'issue' ? 'ISSUED' : 'RELEASED', current.qty, req.user.username]
                );
            }
            const status = action === 'reserve' ? 'Reserved' : action === 'issue' ? 'Issued' : 'Rejected';
            const updated = await client.query(
                `UPDATE garage_part_requests SET status = $1,
                    reviewed_by = CASE WHEN $1 IN ('Reserved', 'Rejected') THEN $2 ELSE reviewed_by END,
                    reviewed_at = CASE WHEN $1 IN ('Reserved', 'Rejected') THEN NOW() ELSE reviewed_at END,
                    issued_by = CASE WHEN $1 = 'Issued' THEN $2 ELSE issued_by END,
                    issued_at = CASE WHEN $1 = 'Issued' THEN NOW() ELSE issued_at END,
                    unit_cost_at_issue = CASE WHEN $1 = 'Issued' THEN $3 ELSE unit_cost_at_issue END
                 WHERE id = $4 RETURNING *`,
                [status, req.user.id, unitCost, requestId]
            );
            return updated.rows[0];
        });
        res.json({ message: `Parts request ${request.status.toLowerCase()}.`, request });
    } catch (error) {
        sendError(res, error);
    }
});

module.exports = router;
