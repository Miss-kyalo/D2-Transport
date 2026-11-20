const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const { validateIso6346, evaluateReleaseEligibility } = require('../utils/depotCompliance');

const depotUploads = path.join(__dirname, '../uploads/depot');
fs.mkdirSync(depotUploads, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, depotUploads),
    filename: (req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `depot-${unique}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage });

router.use(verifyToken);

// List containers & active regulatory licenses
router.get('/overview', requireRole('Admin', 'Dispatcher', 'FleetManager', 'Accounts_Receivable'), async (req, res) => {
    try {
        const [containersRes, licensesRes] = await Promise.all([
            pool.query(
                `SELECT c.*, t.tracking_code
                 FROM containers c
                 LEFT JOIN trips t ON c.current_trip_id = t.id
                 ORDER BY c.id DESC`
            ),
            pool.query(`SELECT * FROM depot_licenses ORDER BY expiry_date ASC`)
        ]);
        res.json({ containers: containersRes.rows, licenses: licensesRes.rows });
    } catch (err) {
        res.status(500).json({ error: 'Server error loading depot overview.' });
    }
});

// Gate-In Container with ISO 6346 check, principal terms & initial inspection
router.post('/containers/gate-in', requireRole('Admin', 'Dispatcher', 'FleetManager'), async (req, res) => {
    const client = await pool.connect();
    try {
        const {
            container_number,
            container_type = '40FT',
            principal_name = '',
            principal_currency = 'USD',
            free_days = 7,
            daily_storage_rate = 0,
            yard_bay = '',
            condition_status = 'Sound',
            csc_valid_until = null,
            customs_hold = false,
            kebs_hold = false,
            hold_reason = '',
            truck_plate = '',
            seal_number = '',
            eir_reference = '',
            iicl_damage_codes = '',
            notes = ''
        } = req.body;

        const isoCheck = validateIso6346(container_number);
        if (!isoCheck.normalized) {
            return res.status(400).json({ error: 'Container number is required.' });
        }

        await client.query('BEGIN');

        const upsertRes = await client.query(
            `INSERT INTO containers
             (container_number, iso_check_valid, container_type, principal_name, principal_currency,
              free_days, daily_storage_rate, yard_bay, status, condition_status, csc_valid_until,
              cleaning_status, customs_hold, kebs_hold, hold_reason, gated_in_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
                     CASE WHEN $9 = TRUE OR $10 = TRUE OR $11 = 'Damaged' THEN 'Hold' ELSE 'Gated-In' END,
                     $11, $12, 'Pending', $9, $10, $13, CURRENT_TIMESTAMP)
             ON CONFLICT (container_number) DO UPDATE SET
              iso_check_valid = EXCLUDED.iso_check_valid,
              container_type = EXCLUDED.container_type,
              principal_name = EXCLUDED.principal_name,
              principal_currency = EXCLUDED.principal_currency,
              free_days = EXCLUDED.free_days,
              daily_storage_rate = EXCLUDED.daily_storage_rate,
              yard_bay = EXCLUDED.yard_bay,
              condition_status = EXCLUDED.condition_status,
              csc_valid_until = EXCLUDED.csc_valid_until,
              cleaning_status = 'Pending',
              cleaning_cert_ref = NULL,
              cleaned_at = NULL,
              kephis_cleared = FALSE,
              customs_hold = EXCLUDED.customs_hold,
              kebs_hold = EXCLUDED.kebs_hold,
              hold_reason = EXCLUDED.hold_reason,
              status = CASE WHEN EXCLUDED.customs_hold = TRUE OR EXCLUDED.kebs_hold = TRUE OR EXCLUDED.condition_status = 'Damaged' THEN 'Hold' ELSE 'Gated-In' END,
              gated_in_at = CURRENT_TIMESTAMP,
              gated_out_at = NULL,
              current_trip_id = NULL
             WHERE containers.status = 'Gated-Out'
             RETURNING *`,
            [
                isoCheck.normalized, isoCheck.valid, container_type, principal_name, principal_currency,
                Number(free_days), Number(daily_storage_rate), yard_bay,
                Boolean(customs_hold), Boolean(kebs_hold), condition_status, csc_valid_until || null, hold_reason
            ]
        );

        const container = upsertRes.rows[0];
        if (!container) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Container is already in the yard.' });
        }

        await client.query(
            `INSERT INTO container_inspections
             (container_id, inspection_stage, iicl_damage_codes, inspector_id, notes)
             VALUES ($1, 'GATE_IN', $2, $3, $4)`,
            [container.id, iicl_damage_codes, req.user.id, notes]
        );

        await client.query(
            `INSERT INTO container_movements
             (container_id, movement_type, truck_plate, seal_number, eir_reference, notes, recorded_by)
             VALUES ($1, 'GATE_IN', $2, $3, $4, $5, $6)`,
            [container.id, truck_plate.toUpperCase(), seal_number, eir_reference, notes, req.user.id]
        );

        await client.query('COMMIT');
        res.status(201).json({
            message: `Gate-In recorded for ${container.container_number}${!isoCheck.valid ? ' (Warning: ISO check digit flagged)' : ''}.`,
            container
        });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        res.status(500).json({ error: 'Server error during container gate-in.' });
    } finally {
        client.release();
    }
});

// Log Cleaning, Decontamination (NEMA wash-bay / waste) & KEPHIS/Customs/IICL Clearance
router.patch('/containers/:id/compliance', requireRole('Admin', 'Dispatcher', 'FleetManager'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const {
            cleaning_status,
            cleaning_cert_ref = '',
            kephis_cleared = null,
            kebs_hold = null,
            customs_hold = null,
            condition_status = null,
            hold_reason = null,
            wash_bay_used = false,
            effluent_treated = true,
            waste_manifest_ref = '',
            notes = ''
        } = req.body;

        if (cleaning_status != null && !['Pending', 'Swept_Clean', 'Washed_Sanitized', 'Fumigated'].includes(cleaning_status)) {
            return res.status(400).json({ error: 'Invalid cleaning status.' });
        }

        await client.query('BEGIN');

        const updatedRes = await client.query(
            `UPDATE containers
             SET cleaning_status = COALESCE($1, cleaning_status),
                 cleaning_cert_ref = COALESCE(NULLIF($2, ''), cleaning_cert_ref),
                 cleaned_at = CASE WHEN $1 IS NOT NULL AND $1 <> 'Pending' THEN CURRENT_TIMESTAMP ELSE cleaned_at END,
                 kephis_cleared = COALESCE($3, kephis_cleared),
                 kebs_hold = COALESCE($4, kebs_hold),
                 customs_hold = COALESCE($5, customs_hold),
                 condition_status = COALESCE($6, condition_status),
                 hold_reason = COALESCE($7, hold_reason),
                 status = CASE
                     WHEN status = 'Gated-Out' THEN status
                     WHEN COALESCE($4, kebs_hold) = TRUE OR COALESCE($5, customs_hold) = TRUE OR COALESCE($6, condition_status) = 'Damaged' THEN 'Hold'
                     WHEN COALESCE($1, cleaning_status) IN ('Swept_Clean', 'Washed_Sanitized', 'Fumigated') THEN 'Available'
                     ELSE 'Gated-In'
                 END
             WHERE id = $8
             RETURNING *`,
            [
                cleaning_status, cleaning_cert_ref, kephis_cleared,
                kebs_hold, customs_hold, condition_status, hold_reason, id
            ]
        );

        if (updatedRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Container not found.' });
        }

        await client.query(
            `INSERT INTO container_inspections
             (container_id, inspection_stage, wash_bay_used, effluent_treated, waste_manifest_ref, inspector_id, notes)
             VALUES ($1, 'POST_CLEAN', $2, $3, $4, $5, $6)`,
            [id, Boolean(wash_bay_used), Boolean(effluent_treated), waste_manifest_ref, req.user.id, notes]
        );

        await client.query(
            `INSERT INTO container_movements
             (container_id, movement_type, eir_reference, notes, recorded_by)
             VALUES ($1, 'CLEANING_UPDATE', $2, $3, $4)`,
            [id, cleaning_cert_ref, `Status: ${cleaning_status}, KEPHIS: ${kephis_cleared ? 'Cleared' : 'Pending'}. ${notes}`, req.user.id]
        );

        await client.query('COMMIT');
        res.json({ message: 'Container compliance & hygiene status updated.', container: updatedRes.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        res.status(500).json({ error: 'Server error updating container compliance.' });
    } finally {
        client.release();
    }
});

// Gate-Out Container after enforcing regulatory & structural release checks
router.patch('/containers/:id/gate-out', requireRole('Admin', 'Dispatcher', 'FleetManager'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const {
            truck_plate = '',
            seal_number = '',
            eir_reference = '',
            trip_id = null,
            require_sanitized = false,
            require_kephis = false,
            notes = ''
        } = req.body;

        await client.query('BEGIN');
        const existingRes = await client.query(`SELECT * FROM containers WHERE id = $1 FOR UPDATE`, [id]);
        if (existingRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Container not found.' });
        }

        if (existingRes.rows[0].status === 'Gated-Out') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Container has already gated out.' });
        }

        const check = evaluateReleaseEligibility(existingRes.rows[0], {
            requireSanitized: Boolean(require_sanitized),
            requireKephis: Boolean(require_kephis)
        });

        if (!check.allowed) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                error: 'Gate-Out blocked by compliance checks.',
                blockers: check.blockers
            });
        }

        const updatedRes = await client.query(
            `UPDATE containers
             SET status = 'Gated-Out',
                 current_trip_id = COALESCE($1, current_trip_id),
                 gated_out_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [trip_id || null, id]
        );

        await client.query(
            `INSERT INTO container_movements
             (container_id, movement_type, truck_plate, seal_number, eir_reference, notes, recorded_by)
             VALUES ($1, 'GATE_OUT', $2, $3, $4, $5, $6)`,
            [id, truck_plate.toUpperCase(), seal_number, eir_reference, notes, req.user.id]
        );

        await client.query('COMMIT');
        res.json({ message: `Container ${updatedRes.rows[0].container_number} gated out cleanly.`, container: updatedRes.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        res.status(500).json({ error: 'Server error during container gate-out.' });
    } finally {
        client.release();
    }
});

// Register statutory depot license (NEMA, KEPHIS, KRA, County, KEBS)
router.post('/licenses', requireRole('Admin', 'FleetManager'), upload.single('license_doc'), async (req, res) => {
    try {
        const { authority, license_name, license_number, issued_date, expiry_date } = req.body;
        const documentUrl = req.file ? `/uploads/depot/${req.file.filename}` : null;

        const inserted = await pool.query(
            `INSERT INTO depot_licenses
             (authority, license_name, license_number, issued_date, expiry_date, document_url)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [authority, license_name, license_number, issued_date || null, expiry_date, documentUrl]
        );

        res.status(201).json({ message: 'Depot regulatory license saved.', license: inserted.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Server error saving depot license.' });
    }
    const { generateCodecoMessage } = require('../utils/ediCodecoGenerator');

router.get('/containers/:id/edi/:movementType', requireRole('Admin', 'Dispatcher', 'FleetManager'), async (req, res) => {
    try {
        const { id, movementType } = req.params;
        const containerRes = await pool.query(`SELECT * FROM containers WHERE id = $1`, [id]);
        if (containerRes.rows.length === 0) {
            return res.status(404).json({ error: 'Container not found.' });
        }

        const movRes = await pool.query(
            `SELECT * FROM container_movements WHERE container_id = $1 ORDER BY id DESC LIMIT 1`,
            [id]
        );
        const latestMov = movRes.rows[0] || {};

        const ediPayload = generateCodecoMessage({
            movementType: movementType.toUpperCase(),
            container: containerRes.rows[0],
            truckPlate: latestMov.truck_plate || '',
            sealNumber: latestMov.seal_number || '',
            eirReference: latestMov.eir_reference || ''
        });

        res.json({
            container_number: containerRes.rows[0].container_number,
            standard: 'UN/EDIFACT CODECO D95B',
            edi_payload: ediPayload
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to generate UN/EDIFACT CODECO payload.' });
    }
});
});

module.exports = router;