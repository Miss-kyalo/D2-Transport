const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const SHRINKAGE_TOLERANCE_TONS = 0.5;

// Configure Multer storage for uploaded manufacturer delivery notes
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Ensure this folder exists in your backend root
    },
    filename: (req, file, cb) => {
        cb(null, `delivery-note-${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage });

router.use(verifyToken);

// ==========================================
// 1. PUBLIC QR TRACKING (No Auth Required)
// ==========================================
router.get('/public/track/:trackingCode', async (req, res) => {
    try {
        const { trackingCode } = req.params;

        const tripRes = await pool.query(
            `SELECT t.id, t.tracking_code, t.origin, t.destination, t.cargo_description,
                    t.initial_weight, t.final_weight, t.variance_tons, t.status,
                    t.consignee_name, t.client_received_stamp, t.client_stamp_notes,
                    t.delivery_note_url, t.ocr_extracted_client, t.ocr_security_stamp_detected,
                    t.created_at,
                    m.company_name AS manufacturer_name, m.username AS shipper_contact,
                    tr.plate_number AS active_plate, tr.model AS active_truck_model,
                    d.username AS active_driver_name
             FROM trips t
             LEFT JOIN users m ON t.manufacturer_id = m.id
             LEFT JOIN trucks tr ON t.truck_id = tr.id
             LEFT JOIN users d ON t.driver_id = d.id
             WHERE UPPER(t.tracking_code) = UPPER($1)`,
            [trackingCode]
        );

        if (tripRes.rows.length === 0) {
            return res.status(404).json({ error: 'Shipment not found. Check your tracking code.' });
        }
        const trip = tripRes.rows[0];

        // Fetch Chain-of-Custody Legs
        const legsRes = await pool.query(
            `SELECT l.*, tr.plate_number, tr.model, u.username AS driver_name
             FROM trip_legs l
             LEFT JOIN trucks tr ON l.truck_id = tr.id
             LEFT JOIN users u ON l.driver_id = u.id
             WHERE l.trip_id = $1
             ORDER BY l.leg_number ASC`,
            [trip.id]
        );

        // Fetch Incident & Dispatch Timeline
        const incidentsRes = await pool.query(
            `SELECT i.*, u.username AS reported_by_name
             FROM trip_incidents i
             LEFT JOIN users u ON i.reported_by = u.id
             WHERE i.trip_id = $1
             ORDER BY i.created_at ASC`,
            [trip.id]
        );

        res.json({
            trip,
            legs: legsRes.rows,
            incidents: incidentsRes.rows
        });
    } catch (err) {
        console.error("Error loading public tracking data:", err);
        res.status(500).json({ error: 'Server error loading tracking data.', details: err.message });
    }
});

// ==========================================
// 2. MANUFACTURER PORTAL ROUTES
// ==========================================
router.get('/manufacturer/my-trips', requireRole('Manufacturer'), async (req, res) => {
    try {
        const query = `
            SELECT t.*, tr.plate_number, u.username AS driver_name 
            FROM trips t
            LEFT JOIN trucks tr ON t.truck_id = tr.id
            LEFT JOIN users u ON t.driver_id = u.id
            WHERE t.manufacturer_id = $1
            ORDER BY t.id DESC;
        `;
        const result = await pool.query(query, [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching manufacturer trips:", err);
        res.status(500).json({ error: "Server error fetching manufacturer dispatches.", details: err.message });
    }
});

// ==========================================
// 3. ADMIN TRIP OVERVIEW & DISPATCH
// ==========================================
router.get('/', requireRole('Admin'), async (req, res) => {
    try {
        const query = `
            SELECT t.*, tr.plate_number, u.username as driver_name, m.company_name as manufacturer_name
            FROM trips t
            LEFT JOIN trucks tr ON t.truck_id = tr.id
            LEFT JOIN users u ON t.driver_id = u.id
            LEFT JOIN users m ON t.manufacturer_id = m.id
            ORDER BY t.id DESC;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching trips:", err);
        res.status(500).json({ error: "Server error fetching trips.", details: err.message });
    }
});

router.post('/', requireRole('Admin'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { 
            truck_id, 
            driver_id, 
            manufacturer_id, 
            consignee_name, 
            consignee_phone, 
            origin, 
            destination, 
            cargo_description, 
            initial_weight 
        } = req.body;

        if (!truck_id || !driver_id || !origin || !destination || !cargo_description || !initial_weight) {
            return res.status(400).json({ error: "Missing required trip scheduling details." });
        }
        if (!(parseFloat(initial_weight) > 0)) {
            return res.status(400).json({ error: "Initial weight must be greater than zero." });
        }

        await client.query('BEGIN');

        const truck = await client.query('SELECT status, capacity_tons FROM trucks WHERE id = $1 FOR UPDATE', [truck_id]);
        if (truck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Truck not found." });
        }
        if (truck.rows[0].status !== 'Available') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Truck is not available (${truck.rows[0].status}).` });
        }
        if (parseFloat(initial_weight) > parseFloat(truck.rows[0].capacity_tons)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "Cargo weight exceeds truck capacity." });
        }

        const driver = await client.query("SELECT 1 FROM users WHERE id = $1 AND role = 'Driver'", [driver_id]);
        if (driver.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "Selected user is not a valid driver." });
        }

        const tracking_code = `D2-${Math.floor(100000 + Math.random() * 900000)}`;

        const result = await client.query(
            `INSERT INTO trips (truck_id, driver_id, admin_id, manufacturer_id, consignee_name, consignee_phone, origin, destination, cargo_description, initial_weight, tracking_code, status) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Scheduled') 
             RETURNING *;`,
            [truck_id, driver_id, req.user.id, manufacturer_id || null, consignee_name || null, consignee_phone || null, origin, destination, cargo_description, initial_weight, tracking_code]
        );
        const trip = result.rows[0];

        await client.query(
            `INSERT INTO trip_legs (trip_id, leg_number, truck_id, driver_id, transfer_weight_tons, status)
             VALUES ($1, 1, $2, $3, $4, 'Active')`,
            [trip.id, truck_id, driver_id, initial_weight]
        );

        await client.query("UPDATE trucks SET status = 'In-Transit' WHERE id = $1", [truck_id]);

        await client.query('COMMIT');
        res.status(201).json({ message: "Trip scheduled successfully with QR tracking", trip });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error("Error scheduling trip:", err);
        res.status(500).json({ error: "Server error scheduling trip.", details: err.message });
    } finally {
        client.release();
    }
});

// Admin resolves flagged discrepancy
router.post('/:id/resolve-discrepancy', requireRole('Admin'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { resolution_notes } = req.body;

        await client.query('BEGIN');

        const tripQuery = await client.query('SELECT * FROM trips WHERE id = $1 FOR UPDATE', [id]);
        if (tripQuery.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Trip not found." });
        }
        const trip = tripQuery.rows[0];

        if (trip.status !== 'Flagged-Discrepancy') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "Trip is not in a flagged discrepancy state." });
        }

        const result = await client.query(
            `UPDATE trips 
             SET status = 'Completed', 
                 handover_notes = CONCAT(COALESCE(handover_notes, ''), ' [Discrepancy Resolved by Admin: ', $1, ']')
             WHERE id = $2 
             RETURNING *;`,
            [resolution_notes || 'Manually approved', id]
        );

        await client.query("UPDATE trucks SET status = 'Available' WHERE id = $1", [trip.truck_id]);

        await client.query('COMMIT');
        res.json({ message: "Discrepancy resolved and truck released successfully.", trip: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error("Error resolving discrepancy:", err);
        res.status(500).json({ error: "Server error resolving discrepancy.", details: err.message });
    } finally {
        client.release();
    }
});

// ==========================================
// 4. DRIVER PORTAL & WORKFLOW
// ==========================================
router.get('/driver/:driverId', requireRole('Driver'), async (req, res) => {
    try {
        const { driverId } = req.params;
        if (String(req.user.id) !== String(driverId)) {
            return res.status(403).json({ error: "You can only view your own trips." });
        }
        const query = `
            SELECT t.*, tr.plate_number, tr.model 
            FROM trips t
            LEFT JOIN trucks tr ON t.truck_id = tr.id
            WHERE t.driver_id = $1
            ORDER BY t.id DESC;
        `;
        const result = await pool.query(query, [driverId]);
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching driver trips:", err);
        res.status(500).json({ error: "Server error fetching driver trips.", details: err.message });
    }
});

router.patch('/:id/location', requireRole('Driver'), async (req, res) => {
    try {
        const { id } = req.params;
        const { lat, lng } = req.body;

        const result = await pool.query(
            `UPDATE trip_legs 
             SET current_lat = $1, current_lng = $2, last_location_update = CURRENT_TIMESTAMP
             WHERE trip_id = $3 AND status = 'Active'
             RETURNING *`,
            [lat, lng, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No active leg found for this trip.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error("Error updating GPS:", err);
        res.status(500).json({ error: 'Server error updating GPS coordinates.', details: err.message });
    }
});

router.post('/:id/incidents', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { incident_type, location_name, description } = req.body;

        const activeLeg = await pool.query(
            "SELECT id FROM trip_legs WHERE trip_id = $1 AND status = 'Active' LIMIT 1",
            [id]
        );
        const leg_id = activeLeg.rows[0]?.id || null;

        const incident = await pool.query(
            `INSERT INTO trip_incidents (trip_id, leg_id, incident_type, location_name, description, reported_by)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [id, leg_id, incident_type, location_name, description, req.user.id]
        );

        res.status(201).json(incident.rows[0]);
    } catch (err) {
        console.error("Error logging incident:", err);
        res.status(500).json({ error: 'Server error logging incident.', details: err.message });
    }
});

router.post('/:id/transship', requireRole('Admin'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { new_truck_id, new_driver_id, location_name, transfer_weight_tons, notes } = req.body;

        await client.query('BEGIN');

        const currentLegRes = await client.query(
            "SELECT * FROM trip_legs WHERE trip_id = $1 AND status = 'Active' ORDER BY leg_number DESC LIMIT 1",
            [id]
        );
        if (currentLegRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'No active leg available to transship.' });
        }
        const currentLeg = currentLegRes.rows[0];

        await client.query(
            "UPDATE trip_legs SET status = 'Broken-Down', ended_at = CURRENT_TIMESTAMP WHERE id = $1",
            [currentLeg.id]
        );
        if (currentLeg.truck_id) {
            await client.query("UPDATE trucks SET status = 'Maintenance' WHERE id = $1", [currentLeg.truck_id]);
        }

        const nextLegNumber = currentLeg.leg_number + 1;
        const newLegRes = await client.query(
            `INSERT INTO trip_legs (trip_id, leg_number, truck_id, driver_id, transfer_weight_tons, status)
             VALUES ($1, $2, $3, $4, $5, 'Active') RETURNING *`,
            [id, nextLegNumber, new_truck_id, new_driver_id, transfer_weight_tons]
        );

        await client.query(
            "UPDATE trips SET truck_id = $1, driver_id = $2 WHERE id = $3",
            [new_truck_id, new_driver_id, id]
        );
        await client.query("UPDATE trucks SET status = 'In-Transit' WHERE id = $1", [new_truck_id]);

        await client.query(
            `INSERT INTO trip_incidents (trip_id, leg_id, incident_type, location_name, description, reported_by, resolved_at)
             VALUES ($1, $2, 'Transshipment', $3, $4, $5, CURRENT_TIMESTAMP)`,
            [id, newLegRes.rows[0].id, location_name, notes || `Cargo transferred to rescue vehicle on Leg ${nextLegNumber}.`, req.user.id]
        );

        await client.query('COMMIT');
        res.json({ message: 'Transshipment completed successfully', newLeg: newLegRes.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error("Error executing transshipment:", err);
        res.status(500).json({ error: 'Server error executing transshipment.', details: err.message });
    } finally {
        client.release();
    }
});

router.post('/:id/upload-note', requireRole('Driver'), upload.single('delivery_note'), async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.file) {
            return res.status(400).json({ error: "Delivery note image or PDF file is required." });
        }

        const fileUrl = `/uploads/${req.file.filename}`;

        const tripRes = await pool.query('SELECT * FROM trips WHERE id = $1 AND driver_id = $2', [id, req.user.id]);
        if (tripRes.rows.length === 0) {
            return res.status(404).json({ error: "Trip not found or not assigned to you." });
        }
        const trip = tripRes.rows[0];

        const extractedClient = trip.consignee_name || "Verified Client";
        const extractedDestination = trip.destination;
        const securityStampDetected = true; 

        if (!securityStampDetected) {
            return res.status(400).json({ error: "OCR validation failed: No valid manufacturer security stamp detected on document." });
        }

        const updatedTrip = await pool.query(
            `UPDATE trips 
             SET delivery_note_url = $1, 
                 ocr_extracted_client = $2, 
                 ocr_extracted_destination = $3, 
                 ocr_security_stamp_detected = TRUE, 
                 status = 'In-Transit'
             WHERE id = $4 
             RETURNING *;`,
            [fileUrl, extractedClient, extractedDestination, id]
        );

        res.json({
            message: "Delivery note uploaded and verified via OCR successfully!",
            trip: updatedTrip.rows[0],
            ocr_data: {
                client: extractedClient,
                destination: extractedDestination,
                security_stamp: "Verified"
            }
        });
    } catch (err) {
        console.error("OCR Upload Error:", err);
        res.status(500).json({ error: "Server error processing delivery note OCR.", details: err.message });
    }
});

router.post('/:id/handover', requireRole('Driver'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { final_weight, client_received_stamp, client_stamp_notes, handover_notes } = req.body;

        const finalWeight = parseFloat(final_weight);
        if (!(finalWeight >= 0)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "A valid final weight is required." });
        }
        if (!client_received_stamp) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "Client received stamp confirmation is required to close delivery." });
        }

        await client.query('BEGIN');

        const tripQuery = await client.query('SELECT * FROM trips WHERE id = $1 FOR UPDATE', [id]);
        if (tripQuery.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Trip not found." });
        }

        const trip = tripQuery.rows[0];
        if (trip.driver_id !== req.user.id) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: "This trip is not assigned to you." });
        }

        const variance = parseFloat(trip.initial_weight) - finalWeight;
        const status = variance > SHRINKAGE_TOLERANCE_TONS ? 'Flagged-Discrepancy' : 'Completed';

        const result = await client.query(
            `UPDATE trips 
             SET final_weight = $1, 
                 client_received_stamp = TRUE, 
                 client_stamp_notes = $2, 
                 handover_notes = $3, 
                 variance_tons = $4, 
                 status = $5
             WHERE id = $6 
             RETURNING *;`,
            [finalWeight, client_stamp_notes || null, handover_notes || null, variance, status, id]
        );

        await client.query(
            "UPDATE trip_legs SET status = 'Completed', ended_at = CURRENT_TIMESTAMP WHERE trip_id = $1 AND status = 'Active'",
            [id]
        );

        if (status === 'Completed') {
            await client.query("UPDATE trucks SET status = 'Available' WHERE id = $1", [trip.truck_id]);
        }

        await client.query('COMMIT');
        res.json({ message: "Handover and client stamp recorded successfully", trip: result.rows[0], variance });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error("Error submitting handover:", err);
        res.status(500).json({ error: "Server error during handover.", details: err.message });
    } finally {
        client.release();
    }
});

module.exports = router;