const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const upload = require('../middleware/uploadMiddleware');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

router.use(verifyToken, requireRole('Admin', 'FleetManager'));

router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM trucks ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        console.error('Failed to fetch trucks:', err);
        res.status(500).json({ error: "Server error fetching trucks.", details: err.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { plate_number, model, capacity_tons } = req.body;
        const capacity = Number(capacity_tons);
        if (!plate_number || !model || !(capacity > 0)) {
            return res.status(400).json({ error: "All truck fields are required." });
        }
        const result = await pool.query(
            `INSERT INTO trucks (plate_number, model, capacity_tons, status) VALUES ($1, $2, $3, 'Available') RETURNING *;`,
            [plate_number.trim(), model.trim(), capacity]
        );
        res.status(201).json({ message: "Truck added successfully", truck: result.rows[0] });
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: "Truck plate number already exists." });
        console.error('Failed to add truck:', err);
        res.status(500).json({ error: "Server error adding truck.", details: err.message });
    }
});

router.get('/:truckId/compliance', async (req, res) => {
    try {
        const { truckId } = req.params;
        const result = await pool.query(`SELECT * FROM truck_compliance_docs WHERE truck_id = $1 ORDER BY expiry_date ASC`, [truckId]);
        res.json(result.rows);
    } catch (err) {
        console.error('Failed to fetch truck compliance records:', err);
        res.status(500).json({ error: "Server error fetching compliance records." });
    }
});

router.post('/:truckId/compliance', upload.single('document_file'), async (req, res) => {
    try {
        const { truckId } = req.params;
        const { doc_type, certificate_number, issue_date, expiry_date } = req.body;

        if (!req.file) return res.status(400).json({ error: "Compliance document file upload is required." });

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(`UPDATE truck_compliance_docs SET is_active = FALSE WHERE truck_id = $1 AND doc_type = $2`, [truckId, doc_type]);
            const insertRes = await client.query(
                `INSERT INTO truck_compliance_docs (truck_id, doc_type, certificate_number, issue_date, expiry_date, cloud_file_url, is_active)
                 VALUES ($1, $2, $3, $4, $5, $6, TRUE) RETURNING *`,
                [
                    truckId,
                    doc_type,
                    certificate_number,
                    issue_date,
                    expiry_date,
                    `/uploads/${req.file.filename}`
                ]
            );
            await client.query('COMMIT');
            res.status(201).json({ message: "Compliance document uploaded with 3-year cloud retention.", document: insertRes.rows[0] });
        } catch (txErr) {
            await client.query('ROLLBACK');
            throw txErr;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Failed to upload truck compliance document:', err);
        res.status(500).json({ error: "Server error uploading compliance document.", details: err.message });
    }
});

module.exports = router;