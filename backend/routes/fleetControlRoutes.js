const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();
const readers = requireRole('Admin', 'FleetManager', 'Dispatcher', 'Boss', 'Accounts_Payable', 'Accounts_Receivable', 'PayrollAccountant');
const writers = requireRole('Admin', 'FleetManager', 'Dispatcher');
const statuses = ['On Corridor', 'Yard Standby (0 km)', 'Garage Bay'];
router.use(verifyToken);

router.get('/inventory/summary', requireRole('Admin', 'FleetManager', 'Storekeeper', 'Boss', 'Accounts_Payable', 'Accounts_Receivable', 'PayrollAccountant'), async (_req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, sku, part_name, qty_on_hand, qty_reserved, reorder_level, unit_cost,
                    qty_on_hand * unit_cost AS stock_value
             FROM inventory_items ORDER BY part_name, id`
        );
        res.json({ items: result.rows });
    } catch (error) {
        fail(res, error, 'Failed to load inventory.');
    }
});

function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function number(value, decimals, max, positive = false) {
    if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '') return null;
    if (!new RegExp(`^\\d+(?:\\.\\d{1,${decimals}})?$`).test(String(value))) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed <= max && (positive ? parsed > 0 : parsed >= 0) ? parsed : null;
}

function id(value) {
    const parsed = number(value, 1, 2147483647, true);
    return Number.isSafeInteger(parsed) ? parsed : null;
}

function text(value, max, required = false) {
    if (value == null && !required) return '';
    if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) return null;
    return value.trim();
}

function fail(res, error, message) {
    console.error(message, error);
    if (error.code === '23503') return res.status(400).json({ error: 'A referenced truck, trip, or user was not found.' });
    return res.status(500).json({ error: message });
}

router.get('/mileage/daily', readers, async (req, res) => {
    const date = req.query.date;
    if (!validDate(date)) return res.status(400).json({ error: 'A valid date is required.' });
    try {
        const [rows, trips] = await Promise.all([
            pool.query(
                `SELECT t.id AS truck_id, t.plate_number, m.id AS mileage_id,
                        COALESCE(m.opening_km, previous.closing_km) AS opening_km,
                        m.closing_km, m.distance_km, m.yard_status
                 FROM trucks t
                 LEFT JOIN daily_fleet_mileage m ON m.truck_id = t.id AND m.log_date = $1::date
                 LEFT JOIN LATERAL (
                     SELECT closing_km FROM daily_fleet_mileage
                     WHERE truck_id = t.id AND log_date < $1::date ORDER BY log_date DESC LIMIT 1
                 ) previous ON TRUE ORDER BY t.plate_number`, [date]
            ),
            pool.query(`SELECT id, truck_id, tracking_code, origin, destination FROM trips
                        WHERE status IN ('Scheduled', 'In-Transit') ORDER BY id DESC`)
        ]);
        res.json({ date, rows: rows.rows, trips: trips.rows });
    } catch (error) {
        fail(res, error, 'Failed to load daily mileage.');
    }
});

router.post('/mileage/mass-release', writers, async (req, res) => {
    const { log_date: date, entries } = req.body;
    if (!validDate(date) || !Array.isArray(entries) || entries.length === 0 || entries.length > 1000) {
        return res.status(400).json({ error: 'A valid date and at least one mileage entry are required.' });
    }
    const parsed = entries.map((row) => ({
        truckId: id(row?.truck_id),
        opening: number(row?.opening_km, 1, 99999999999.9),
        closing: number(row?.closing_km, 1, 99999999999.9),
        status: row?.yard_status
    }));
    if (parsed.some((r) => !r.truckId || r.opening === null || r.closing === null || r.closing < r.opening ||
        !statuses.includes(r.status) || (r.status === 'Yard Standby (0 km)' && r.closing !== r.opening)) ||
        new Set(parsed.map((r) => r.truckId)).size !== parsed.length) {
        return res.status(400).json({ error: 'Each truck must have valid, nondecreasing readings and a valid status; standby requires zero distance.' });
    }
    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        for (const row of parsed) {
            await client.query(
                `INSERT INTO daily_fleet_mileage (log_date, truck_id, opening_km, closing_km, yard_status, recorded_by)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (log_date, truck_id) DO UPDATE SET opening_km = EXCLUDED.opening_km,
                     closing_km = EXCLUDED.closing_km, yard_status = EXCLUDED.yard_status, recorded_by = EXCLUDED.recorded_by`,
                [date, row.truckId, row.opening, row.closing, row.status, req.user.id]
            );
        }
        await client.query('COMMIT');
        res.status(201).json({ message: `Saved mileage for ${parsed.length} trucks.` });
    } catch (error) {
        if (client) {
            try { await client.query('ROLLBACK'); } catch (rollbackError) { console.error('Mileage rollback failed:', rollbackError); }
        }
        fail(res, error, 'Failed to save daily mileage.');
    } finally {
        if (client) client.release();
    }
});

router.get('/fuel/records', readers, async (_req, res) => {
    try {
        const result = await pool.query(
            `SELECT f.*, t.plate_number, tr.tracking_code FROM fuel_reconciliations f
             JOIN trucks t ON t.id = f.truck_id LEFT JOIN trips tr ON tr.id = f.trip_id
             ORDER BY f.fuel_date DESC, f.id DESC LIMIT 100`
        );
        res.json({ records: result.rows });
    } catch (error) {
        fail(res, error, 'Failed to load fuel records.');
    }
});

router.post('/fuel/reconcile', requireRole('Admin', 'FleetManager'), async (req, res) => {
    const b = req.body;
    const truckId = id(b.truck_id);
    const tripId = b.trip_id ? id(b.trip_id) : null;
    const station = text(b.station_name, 100, true);
    const card = text(b.card_reference, 60);
    const invoice = text(b.etims_invoice_no, 60);
    const litres = number(b.litres, 2, 99999999.99, true);
    const price = number(b.price_per_litre, 2, 99999999.99, true);
    const odometer = b.odometer_reading === '' || b.odometer_reading == null ? null : number(b.odometer_reading, 1, 99999999999.9);
    const distance = b.km_since_last_fill === '' || b.km_since_last_fill == null ? null : number(b.km_since_last_fill, 1, 99999999999.9);
    const amount = litres !== null && price !== null ? Math.round(litres * price * 100) / 100 : 0;
    const efficiency = distance !== null && litres ? Math.round(distance / litres * 100) / 100 : null;
    if (!validDate(b.fuel_date) || !truckId || (b.trip_id && !tripId) || station === null || card === null || invoice === null ||
        litres === null || price === null || amount <= 0 || amount > 9999999999.99 ||
        (b.odometer_reading !== '' && b.odometer_reading != null && odometer === null) ||
        (b.km_since_last_fill !== '' && b.km_since_last_fill != null && distance === null) ||
        (efficiency !== null && efficiency > 999999.99)) {
        return res.status(400).json({ error: 'Valid fuel details, amounts, and readings are required.' });
    }
    try {
        if (tripId) {
            const trip = await pool.query(
                `SELECT 1 FROM trips WHERE id = $1 AND truck_id = $2 AND status IN ('Scheduled', 'In-Transit')`,
                [tripId, truckId]
            );
            if (!trip.rowCount) return res.status(400).json({ error: 'Select an active trip assigned to this truck.' });
        }
        const flags = [];
        if (!tripId) flags.push('No active trip linked');
        if (!card) flags.push('Missing fuel card reference');
        if (!invoice) flags.push('Missing eTIMS invoice reference');
        if (efficiency !== null && efficiency > 0 && efficiency < 1.8) flags.push(`Low efficiency (${efficiency} km/L)`);
        const result = await pool.query(
            `INSERT INTO fuel_reconciliations
             (fuel_date, truck_id, trip_id, station_name, card_reference, etims_invoice_no, litres, price_per_litre,
              total_amount, odometer_reading, km_since_last_fill, km_per_litre, audit_status, flag_reason, recorded_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
            [b.fuel_date, truckId, tripId, station, card || null, invoice || null, litres, price, amount,
                odometer, distance, efficiency, flags.length ? 'Flagged' : 'Unverified', flags.join(' | ') || null, req.user.id]
        );
        res.status(201).json({ message: 'Fuel entry recorded; external card and eTIMS verification is still required.', record: result.rows[0] });
    } catch (error) {
        fail(res, error, 'Failed to record fuel entry.');
    }
});

module.exports = router;
