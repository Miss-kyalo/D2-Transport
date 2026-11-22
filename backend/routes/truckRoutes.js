const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const upload = require('../middleware/uploadMiddleware');
const multer = require('multer');
const { createTruckTemplate, readTruckWorkbook } = require('../utils/truckWorkbook');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const workbookUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } }).single('workbook');

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

router.get('/import/template', async (_req, res) => {
    try {
        const workbook = await createTruckTemplate();
        res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.set('Content-Disposition', 'attachment; filename="truck-import-template.xlsx"');
        res.send(Buffer.from(workbook));
    } catch (err) {
        console.error('Failed to create truck import template:', err);
        res.status(500).json({ error: 'Failed to create truck import template.' });
    }
});

router.post('/import', (req, res, next) => {
    workbookUpload(req, res, (err) => {
        if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Workbook must be 5 MB or smaller.' : 'Invalid workbook upload.' });
        next();
    });
}, async (req, res) => {
    if (!req.file || !req.file.originalname.toLowerCase().endsWith('.xlsx')) {
        return res.status(400).json({ error: 'Select an .xlsx workbook.' });
    }
    let parsed;
    try {
        parsed = await readTruckWorkbook(req.file.buffer);
    } catch (err) {
        console.error('Failed to read truck workbook:', err.message);
        return res.status(400).json({ error: 'Could not read the Excel workbook. Use the provided .xlsx template.' });
    }
    if (parsed.errors.length) return res.status(400).json({ error: 'Workbook validation failed; no trucks were imported.', errors: parsed.errors });

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        await client.query('LOCK TABLE trucks IN SHARE ROW EXCLUSIVE MODE');
        const existing = await client.query(
            'SELECT UPPER(TRIM(plate_number)) AS plate FROM trucks WHERE UPPER(TRIM(plate_number)) = ANY($1::text[])',
            [parsed.trucks.map((truck) => truck.plate_number.toUpperCase())]
        );
        const plates = new Set(existing.rows.map((row) => row.plate));
        const errors = parsed.trucks.filter((truck) => plates.has(truck.plate_number.toUpperCase()))
            .map((truck) => `Row ${truck.row}: plate number ${truck.plate_number} already exists.`);
        if (errors.length) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Workbook contains existing trucks; no trucks were imported.', errors });
        }
        for (const truck of parsed.trucks) {
            await client.query(
                `INSERT INTO trucks (plate_number, model, capacity_tons, status) VALUES ($1, $2, $3, 'Available')`,
                [truck.plate_number, truck.model, truck.capacity_tons]
            );
        }
        await client.query('COMMIT');
        res.status(201).json({ message: `${parsed.trucks.length} trucks imported successfully.`, count: parsed.trucks.length });
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error('Failed to import trucks:', err);
        res.status(500).json({ error: 'Failed to import trucks; no trucks were imported.' });
    } finally {
        if (client) client.release();
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