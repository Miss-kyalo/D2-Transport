const express = require('express');
const pool = require('../config/db');
const upload = require('../middleware/uploadMiddleware');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();
const SHRINKAGE_TOLERANCE_TONS = 0.5;
const FUEL_LITERS_PER_KM = 0.78;
const FUEL_COST_PER_LITER = 165;

function rollback(client) {
    return client.query('ROLLBACK').catch(() => {});
}

router.get('/public/track/:trackingCode', async (req, res) => {
    try {
        const tripResult = await pool.query(
            `SELECT t.id, t.tracking_code, t.origin, t.destination, t.cargo_description,
                    t.initial_weight, t.final_weight, t.variance_tons, t.status,
                    t.consignee_name, t.client_received_stamp, t.client_stamp_notes,
                    t.delivery_note_url, t.ocr_extracted_client,
                    t.ocr_extracted_destination, t.ocr_security_stamp_detected, t.created_at,
                    m.company_name AS manufacturer_name, m.username AS shipper_contact,
                    tr.plate_number AS active_plate, tr.model AS active_truck_model,
                    d.username AS active_driver_name
             FROM trips t
             LEFT JOIN users m ON m.id = t.manufacturer_id
             LEFT JOIN trucks tr ON tr.id = t.truck_id
             LEFT JOIN users d ON d.id = t.driver_id
             WHERE UPPER(t.tracking_code) = UPPER($1)`,
            [req.params.trackingCode]
        );
        const trip = tripResult.rows[0];

        if (!trip) {
            return res.status(404).json({ error: 'Shipment not found.' });
        }

        const [legs, incidents] = await Promise.all([
            pool.query(
                `SELECT l.*, tr.plate_number, tr.model, u.username AS driver_name
                 FROM trip_legs l
                 LEFT JOIN trucks tr ON tr.id = l.truck_id
                 LEFT JOIN users u ON u.id = l.driver_id
                 WHERE l.trip_id = $1
                 ORDER BY l.leg_number`,
                [trip.id]
            ),
            pool.query(
                `SELECT i.*, u.username AS reported_by_name
                 FROM trip_incidents i
                 LEFT JOIN users u ON u.id = i.reported_by
                 WHERE i.trip_id = $1
                 ORDER BY i.created_at`,
                [trip.id]
            )
        ]);

        res.json({
            trip,
            legs: legs.rows,
            incidents: incidents.rows
        });
    } catch (error) {
        console.error('Failed to load public tracking data:', error);
        res.status(500).json({ error: 'Server error loading tracking data.' });
    }
});

router.use(verifyToken);

router.get('/manufacturer/my-trips', requireRole('Manufacturer'), async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT t.*, tr.plate_number, u.username AS driver_name
             FROM trips t
             LEFT JOIN trucks tr ON tr.id = t.truck_id
             LEFT JOIN users u ON u.id = t.driver_id
             WHERE t.manufacturer_id = $1
             ORDER BY t.id DESC`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Failed to fetch manufacturer trips:', error);
        res.status(500).json({ error: 'Server error fetching manufacturer dispatches.' });
    }
});

router.get('/client/my-trips', requireRole('Client', 'SpotClient'), async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, tracking_code, origin, destination, cargo_description,
                    initial_weight, final_weight, status, consignee_name
             FROM trips
             WHERE LOWER(BTRIM(consignee_name)) IN (LOWER(BTRIM($1)), LOWER(BTRIM($2)))
             ORDER BY id DESC`,
            [req.user.username, req.user.company_name || req.user.username]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Failed to fetch client trips:', error);
        res.status(500).json({ error: 'Server error fetching client shipments.' });
    }
});

router.get(
    '/',
    requireRole('Admin', 'Dispatcher', 'FleetManager', 'Accounts_Payable', 'Accounts_Receivable'),
    async (_req, res) => {
        try {
            const result = await pool.query(
                `SELECT t.*, tr.plate_number, u.username AS driver_name,
                        m.company_name AS manufacturer_name
                 FROM trips t
                 LEFT JOIN trucks tr ON tr.id = t.truck_id
                 LEFT JOIN users u ON u.id = t.driver_id
                 LEFT JOIN users m ON m.id = t.manufacturer_id
                 ORDER BY t.id DESC`
            );
            res.json(result.rows);
        } catch (error) {
            console.error('Failed to fetch trips:', error);
            res.status(500).json({ error: 'Server error fetching trips.' });
        }
    }
);

router.post('/', requireRole('Admin', 'Dispatcher'), async (req, res) => {
    const {
        truck_id,
        driver_id,
        manufacturer_id,
        consignee_name,
        consignee_phone,
        origin,
        destination,
        cargo_description,
        cargo_type = 'General',
        initial_weight,
        distance_km = 0,
        is_spot_market = false,
        spot_security_checkpoints = [],
        fuel_partner_name = 'TotalEnergies',
        lpo_number
    } = req.body;

    const initialWeight = Number(initial_weight);
    const distanceKm = Number(distance_km);
    const isSpotMarket = is_spot_market === true || is_spot_market === 'true';
    if (
        !truck_id ||
        !driver_id ||
        !origin ||
        !destination ||
        !cargo_description ||
        !Number.isFinite(initialWeight) ||
        !Number.isFinite(distanceKm)
    ) {
        return res.status(400).json({ error: 'Missing required trip scheduling details.' });
    }
    if (initialWeight <= 0 || distanceKm < 0) {
        return res.status(400).json({ error: 'Weight must be positive and distance cannot be negative.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const truckResult = await client.query(
            `SELECT status, capacity_tons FROM trucks WHERE id = $1 FOR UPDATE`,
            [truck_id]
        );
        const truck = truckResult.rows[0];
        if (!truck) {
            await rollback(client);
            return res.status(404).json({ error: 'Truck not found.' });
        }
        if (truck.status !== 'Available') {
            await rollback(client);
            return res.status(400).json({ error: `Truck is not available (${truck.status}).` });
        }
        if (initialWeight > Number(truck.capacity_tons)) {
            await rollback(client);
            return res.status(400).json({ error: 'Cargo weight exceeds truck capacity.' });
        }

        const driverResult = await client.query(
            `SELECT 1 FROM users WHERE id = $1 AND role = 'Driver' AND onboarding_status = 'Active'`,
            [driver_id]
        );
        if (!driverResult.rows[0]) {
            await rollback(client);
            return res.status(400).json({ error: 'Selected driver is invalid or inactive.' });
        }

        const estimatedFuel = Number((distanceKm * FUEL_LITERS_PER_KM).toFixed(2));
        const trackingCode = `DFL-${Math.floor(100000 + Math.random() * 900000)}`;
        const status = isSpotMarket ? 'Awaiting_50_Percent_Deposit' : 'Scheduled';
        const tripResult = await client.query(
            `INSERT INTO trips (
                truck_id, driver_id, manufacturer_id, consignee_name, consignee_phone,
                origin, destination, cargo_description, cargo_type, initial_weight,
                distance_km, estimated_fuel_liters, tracking_code, status,
                is_spot_market, spot_security_checkpoints
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
             RETURNING *`,
            [
                truck_id,
                driver_id,
                manufacturer_id || null,
                consignee_name || null,
                consignee_phone || null,
                origin.trim(),
                destination.trim(),
                cargo_description.trim(),
                cargo_type,
                initialWeight,
                distanceKm,
                estimatedFuel,
                trackingCode,
                status,
                isSpotMarket,
                JSON.stringify(spot_security_checkpoints)
            ]
        );
        const trip = tripResult.rows[0];

        await client.query(
            `INSERT INTO trip_legs (trip_id, leg_number, truck_id, driver_id, transfer_weight_tons)
             VALUES ($1, 1, $2, $3, $4)`,
            [trip.id, truck_id, driver_id, initialWeight]
        );
        await client.query(
            `INSERT INTO fuel_lpos (
                trip_id, partner_name, lpo_number, expected_liters,
                cost_per_liter, total_lpo_cost
             ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                trip.id,
                fuel_partner_name,
                lpo_number || `LPO-${trackingCode}`,
                estimatedFuel,
                FUEL_COST_PER_LITER,
                Number((estimatedFuel * FUEL_COST_PER_LITER).toFixed(2))
            ]
        );
        await client.query(
            `UPDATE trucks SET status = $1 WHERE id = $2`,
            [isSpotMarket ? 'Reserved' : 'In-Transit', truck_id]
        );
        await client.query('COMMIT');
        res.status(201).json({ message: 'Trip scheduled successfully.', trip });
    } catch (error) {
        await rollback(client);
        console.error('Failed to schedule trip:', error);
        res.status(500).json({ error: 'Server error scheduling trip.' });
    } finally {
        client.release();
    }
});

router.post(
    '/:id/resolve-discrepancy',
    requireRole('Admin', 'Dispatcher'),
    async (req, res) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const tripResult = await client.query(
                `SELECT * FROM trips WHERE id = $1 FOR UPDATE`,
                [req.params.id]
            );
            const trip = tripResult.rows[0];
            if (!trip) {
                await rollback(client);
                return res.status(404).json({ error: 'Trip not found.' });
            }
            if (trip.status !== 'Flagged-Discrepancy') {
                await rollback(client);
                return res.status(400).json({ error: 'Trip is not flagged for discrepancy.' });
            }

            const result = await client.query(
                `UPDATE trips
                 SET status = 'Completed',
                     handover_notes = CONCAT(
                        COALESCE(handover_notes, ''),
                        ' [Discrepancy resolved: ', $1, ']'
                     )
                 WHERE id = $2
                 RETURNING *`,
                [req.body.resolution_notes || 'Approved', trip.id]
            );
            await client.query(`UPDATE trucks SET status = 'Available' WHERE id = $1`, [trip.truck_id]);
            await client.query('COMMIT');
            res.json({ message: 'Discrepancy resolved.', trip: result.rows[0] });
        } catch (error) {
            await rollback(client);
            console.error('Failed to resolve discrepancy:', error);
            res.status(500).json({ error: 'Server error resolving discrepancy.' });
        } finally {
            client.release();
        }
    }
);

router.get('/driver/:driverId', requireRole('Driver'), async (req, res) => {
    if (String(req.user.id) !== String(req.params.driverId)) {
        return res.status(403).json({ error: 'You can only view your own trips.' });
    }

    try {
        const result = await pool.query(
            `SELECT t.*, tr.plate_number, tr.model
             FROM trips t
             LEFT JOIN trucks tr ON tr.id = t.truck_id
             WHERE t.driver_id = $1
             ORDER BY t.id DESC`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Failed to fetch driver trips:', error);
        res.status(500).json({ error: 'Server error fetching driver trips.' });
    }
});

router.patch('/:id/location', requireRole('Driver'), async (req, res) => {
    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(400).json({ error: 'Valid latitude and longitude are required.' });
    }

    try {
        const result = await pool.query(
            `UPDATE trip_legs l
             SET current_lat = $1, current_lng = $2, last_location_update = CURRENT_TIMESTAMP
             FROM trips t
             WHERE l.trip_id = t.id
               AND t.id = $3
               AND t.driver_id = $4
               AND t.status = 'In-Transit'
               AND (t.is_spot_market = FALSE OR t.accounts_go_ahead_issued = TRUE)
               AND l.status = 'Active'
             RETURNING l.*`,
            [lat, lng, req.params.id, req.user.id]
        );
        if (!result.rows[0]) {
            return res.status(404).json({ error: 'No active assigned trip leg found.' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Failed to update trip location:', error);
        res.status(500).json({ error: 'Server error updating location.' });
    }
});

router.post('/:id/incidents', requireRole('Driver', 'Admin', 'Dispatcher'), async (req, res) => {
    const { incident_type, location_name, description } = req.body;
    if (!incident_type || !location_name || !description) {
        return res.status(400).json({ error: 'Incident type, location, and description are required.' });
    }

    try {
        const result = await pool.query(
            `WITH active_leg AS (
                SELECT l.id
                FROM trip_legs l
                JOIN trips t ON t.id = l.trip_id
                WHERE l.trip_id = $1
                  AND l.status = 'Active'
                  AND ($2 <> 'Driver' OR t.driver_id = $3)
                LIMIT 1
             )
             INSERT INTO trip_incidents (
                trip_id, leg_id, incident_type, location_name, description, reported_by
             )
             SELECT $1, id, $4, $5, $6, $3
             FROM active_leg
             RETURNING *`,
            [
                req.params.id,
                req.user.role,
                req.user.id,
                incident_type,
                location_name,
                description
            ]
        );
        if (!result.rows[0]) {
            return res.status(404).json({ error: 'No active trip or leg is assigned to you.' });
        }
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Failed to report incident:', error);
        res.status(500).json({ error: 'Server error logging incident.' });
    }
});

router.post('/:id/transship', requireRole('Admin', 'Dispatcher'), async (req, res) => {
    const {
        new_truck_id,
        new_driver_id,
        location_name,
        transfer_weight_tons,
        notes
    } = req.body;
    const transferWeight = Number(transfer_weight_tons);
    if (!new_truck_id || !new_driver_id || !location_name || !(transferWeight > 0)) {
        return res.status(400).json({ error: 'A truck, driver, location, and transfer weight are required.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const currentLegResult = await client.query(
            `SELECT * FROM trip_legs
             WHERE trip_id = $1 AND status = 'Active'
             ORDER BY leg_number DESC
             LIMIT 1
             FOR UPDATE`,
            [req.params.id]
        );
        const currentLeg = currentLegResult.rows[0];
        if (!currentLeg) {
            await rollback(client);
            return res.status(400).json({ error: 'No active leg available to transship.' });
        }

        const replacementTruck = await client.query(
            `SELECT status FROM trucks WHERE id = $1 FOR UPDATE`,
            [new_truck_id]
        );
        const replacementDriver = await client.query(
            `SELECT 1 FROM users
             WHERE id = $1 AND role = 'Driver' AND onboarding_status = 'Active'`,
            [new_driver_id]
        );
        if (
            replacementTruck.rows[0]?.status !== 'Available' ||
            !replacementDriver.rows[0]
        ) {
            await rollback(client);
            return res.status(400).json({ error: 'Replacement truck or driver is unavailable.' });
        }

        await client.query(
            `UPDATE trip_legs
             SET status = 'Broken-Down', ended_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [currentLeg.id]
        );
        await client.query(
            `UPDATE trucks SET status = 'Maintenance' WHERE id = $1`,
            [currentLeg.truck_id]
        );

        const newLegResult = await client.query(
            `INSERT INTO trip_legs (
                trip_id, leg_number, truck_id, driver_id, transfer_weight_tons, status
             ) VALUES ($1, $2, $3, $4, $5, 'Active')
             RETURNING *`,
            [
                currentLeg.trip_id,
                currentLeg.leg_number + 1,
                new_truck_id,
                new_driver_id,
                transferWeight
            ]
        );
        const newLeg = newLegResult.rows[0];

        await client.query(
            `UPDATE trips SET truck_id = $1, driver_id = $2 WHERE id = $3`,
            [new_truck_id, new_driver_id, currentLeg.trip_id]
        );
        await client.query(`UPDATE trucks SET status = 'In-Transit' WHERE id = $1`, [new_truck_id]);
        await client.query(
            `INSERT INTO trip_incidents (
                trip_id, leg_id, incident_type, location_name, description, reported_by, resolved_at
             ) VALUES ($1, $2, 'Transshipment', $3, $4, $5, CURRENT_TIMESTAMP)`,
            [
                currentLeg.trip_id,
                newLeg.id,
                location_name,
                notes || `Cargo transferred on leg ${newLeg.leg_number}.`,
                req.user.id
            ]
        );

        await client.query('COMMIT');
        res.json({ message: 'Transshipment completed.', newLeg });
    } catch (error) {
        await rollback(client);
        console.error('Failed to transship trip:', error);
        res.status(500).json({ error: 'Server error executing transshipment.' });
    } finally {
        client.release();
    }
});

router.post('/:id/upload-note', requireRole('Driver'), upload.single('delivery_note'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Delivery note image or PDF is required.' });
    }

    try {
        const result = await pool.query(
            `UPDATE trips
             SET delivery_note_url = $1,
                 ocr_extracted_client = consignee_name,
                 ocr_extracted_destination = destination,
                 ocr_security_stamp_detected = TRUE,
                 status = CASE
                    WHEN status = 'Scheduled' THEN 'In-Transit'
                    ELSE status
                 END
             WHERE id = $2
               AND driver_id = $3
               AND status IN ('Scheduled', 'In-Transit')
               AND (is_spot_market = FALSE OR accounts_go_ahead_issued = TRUE)
             RETURNING *`,
            [`/uploads/${req.file.filename}`, req.params.id, req.user.id]
        );
        if (!result.rows[0]) {
            return res.status(404).json({ error: 'Trip not found or not assigned to you.' });
        }
        res.json({
            message: 'Delivery note uploaded.',
            trip: result.rows[0],
            ocr_data: {
                client: result.rows[0].ocr_extracted_client,
                destination: result.rows[0].ocr_extracted_destination,
                security_stamp: 'Verified'
            }
        });
    } catch (error) {
        console.error('Failed to upload delivery note:', error);
        res.status(500).json({ error: 'Server error uploading delivery note.' });
    }
});

router.patch(
    '/:id/confirm-deposit',
    requireRole('Accounts_Payable', 'Accounts_Receivable', 'Admin'),
    async (req, res) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const result = await client.query(
                `UPDATE trips
                 SET deposit_50_paid = TRUE,
                     accounts_go_ahead_issued = TRUE,
                     status = 'Scheduled'
                 WHERE id = $1
                   AND is_spot_market = TRUE
                   AND status = 'Awaiting_50_Percent_Deposit'
                 RETURNING *`,
                [req.params.id]
            );
            if (!result.rows[0]) {
                await rollback(client);
                return res.status(404).json({ error: 'Spot-market trip awaiting deposit not found.' });
            }
            await client.query(
                `UPDATE trucks SET status = 'In-Transit' WHERE id = $1`,
                [result.rows[0].truck_id]
            );
            await client.query('COMMIT');
            res.json({ message: 'Deposit verified. Driver may proceed.', trip: result.rows[0] });
        } catch (error) {
            await rollback(client);
            console.error('Failed to confirm deposit:', error);
            res.status(500).json({ error: 'Server error confirming deposit.' });
        } finally {
            client.release();
        }
    }
);

router.post('/:id/handover', requireRole('Driver'), async (req, res) => {
    const finalWeight = Number(req.body.final_weight);
    if (!Number.isFinite(finalWeight) || finalWeight < 0) {
        return res.status(400).json({ error: 'A valid final weight is required.' });
    }
    if (!req.body.client_received_stamp) {
        return res.status(400).json({ error: 'Client received stamp confirmation is required.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const tripResult = await client.query(
            `SELECT * FROM trips WHERE id = $1 FOR UPDATE`,
            [req.params.id]
        );
        const trip = tripResult.rows[0];
        if (!trip) {
            await rollback(client);
            return res.status(404).json({ error: 'Trip not found.' });
        }
        if (trip.driver_id !== req.user.id) {
            await rollback(client);
            return res.status(403).json({ error: 'This trip is not assigned to you.' });
        }
        if (trip.is_spot_market && !trip.accounts_go_ahead_issued) {
            await rollback(client);
            return res.status(400).json({ error: 'Accounts clearance is required before handover.' });
        }
        if (!['Scheduled', 'In-Transit'].includes(trip.status)) {
            await rollback(client);
            return res.status(400).json({ error: `Trip cannot be handed over from ${trip.status}.` });
        }

        const variance = Number((Number(trip.initial_weight) - finalWeight).toFixed(2));
        const status = variance > SHRINKAGE_TOLERANCE_TONS
            ? 'Flagged-Discrepancy'
            : 'Completed';
        const updatedTrip = await client.query(
            `UPDATE trips
             SET final_weight = $1,
                 client_received_stamp = TRUE,
                 client_stamp_notes = $2,
                 handover_notes = $3,
                 variance_tons = $4,
                 status = $5
             WHERE id = $6
             RETURNING *`,
            [
                finalWeight,
                req.body.client_stamp_notes || null,
                req.body.handover_notes || null,
                variance,
                status,
                trip.id
            ]
        );

        await client.query(
            `UPDATE trip_legs
             SET status = 'Completed', ended_at = CURRENT_TIMESTAMP
             WHERE trip_id = $1 AND status = 'Active'`,
            [trip.id]
        );
        if (status === 'Completed') {
            await client.query(`UPDATE trucks SET status = 'Available' WHERE id = $1`, [trip.truck_id]);
            if (trip.manufacturer_id) {
                await client.query(
                    `INSERT INTO invoices (trip_id, client_id, amount_kes, due_date)
                     VALUES ($1, $2, 150000.00, CURRENT_TIMESTAMP + INTERVAL '30 days')
                     ON CONFLICT (trip_id) DO NOTHING`,
                    [trip.id, trip.manufacturer_id]
                );
            }
        }

        await client.query('COMMIT');
        res.json({ message: 'Handover recorded.', trip: updatedTrip.rows[0], variance });
    } catch (error) {
        await rollback(client);
        console.error('Failed to record handover:', error);
        res.status(500).json({ error: 'Server error during handover.' });
    } finally {
        client.release();
    }
});

module.exports = router;
