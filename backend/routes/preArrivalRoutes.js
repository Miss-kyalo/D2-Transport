const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(verifyToken);

router.get('/pre-arrival-trucks', requireRole('Driver'), async (_req, res) => {
    try {
        const result = await pool.query('SELECT id, plate_number, model FROM trucks ORDER BY plate_number');
        res.json({ trucks: result.rows });
    } catch (error) {
        console.error('Failed to load pre-arrival trucks:', error);
        res.status(500).json({ error: 'Failed to load trucks for the alert.' });
    }
});

router.post('/pre-arrival-alerts', requireRole('Driver'), async (req, res) => {
    const { truck_id, current_odometer, fault_system, driver_description, requested_spares, reported_for_name } = req.body;
    const truckId = Number(truck_id);
    const odometer = Number(current_odometer);
    if (!Number.isSafeInteger(truckId) || truckId < 1 ||
        current_odometer === '' || current_odometer === null || current_odometer === undefined ||
        !Number.isFinite(odometer) || odometer < 0 || odometer > 99999999999.9 ||
        typeof fault_system !== 'string' || !fault_system.trim() || fault_system.trim().length > 60 ||
        typeof driver_description !== 'string' || !driver_description.trim() ||
        (requested_spares != null && typeof requested_spares !== 'string') ||
        (reported_for_name != null && (typeof reported_for_name !== 'string' || reported_for_name.trim().length > 120))) {
        return res.status(400).json({ error: 'A valid truck, odometer, fault system, description and reporting-for name are required.' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO driver_pre_arrival_alerts
                (truck_id, driver_id, current_odometer, fault_system, driver_description, requested_spares, reported_for_name)
             SELECT id, $2, $3, $4, $5, $6, $7 FROM trucks WHERE id = $1
             RETURNING id`,
            [truckId, req.user.id, odometer, fault_system.trim(), driver_description.trim(),
                requested_spares?.trim() || null, reported_for_name?.trim() || null]
        );
        if (!result.rowCount) return res.status(404).json({ error: 'Truck not found.' });
        res.status(201).json({ message: 'Pre-arrival alert sent to the garage and storekeeper.', id: result.rows[0].id });
    } catch (error) {
        console.error('Failed to submit pre-arrival alert:', error);
        res.status(500).json({ error: 'Failed to submit pre-arrival alert.' });
    }
});

router.get('/pre-arrival-alerts', requireRole('Admin', 'FleetManager', 'Storekeeper', 'Mechanic', 'Boss'), async (_req, res) => {
    try {
        const result = await pool.query(
            `SELECT a.id, a.current_odometer, a.fault_system, a.driver_description, a.requested_spares,
                    a.reported_for_name, a.status, a.kit_prepared, a.created_at,
                    t.plate_number, u.username AS reporter_name
             FROM driver_pre_arrival_alerts a
             LEFT JOIN trucks t ON t.id = a.truck_id
             LEFT JOIN users u ON u.id = a.driver_id
             WHERE a.status <> 'Arrived & Closed'
             ORDER BY a.created_at DESC, a.id DESC`
        );
        res.json({ alerts: result.rows });
    } catch (error) {
        console.error('Failed to load pre-arrival alerts:', error);
        res.status(500).json({ error: 'Failed to load pre-arrival alerts.' });
    }
});

router.patch('/pre-arrival-alerts/:id/prep', requireRole('Admin', 'Storekeeper'), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'A valid alert ID is required.' });
    try {
        const result = await pool.query(
            `UPDATE driver_pre_arrival_alerts
             SET kit_prepared = TRUE, status = 'Spares Staged', prepared_by = $1
             WHERE id = $2 AND status = 'Incoming' RETURNING id`,
            [req.user.id, id]
        );
        if (!result.rowCount) return res.status(409).json({ error: 'Alert not found or already staged.' });
        res.json({ message: 'Spares preparation recorded.' });
    } catch (error) {
        console.error('Failed to stage pre-arrival alert:', error);
        res.status(500).json({ error: 'Failed to stage pre-arrival alert.' });
    }
});

module.exports = router;
