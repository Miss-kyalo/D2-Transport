const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const { validateIso6346, evaluateReleaseEligibility } = require('../utils/depotCompliance');
const { generateCodecoMessage } = require('../utils/ediCodecoGenerator');

const depotUploads = path.join(__dirname, '../uploads/depot');
fs.mkdirSync(depotUploads, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, depotUploads),
    filename: (req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `depot-${unique}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

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
            trailer_plate = '',
            transporter_name = '',
            driver_name = '',
            driver_id_number = '',
            driver_phone = '',
            driver_license = '',
            shipper_name = '',
            client_name = '',
            seal_number = '',
            eir_reference = '',
            iicl_damage_codes = '',
            iicl_defect_notes = '',
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

        const normalizedTruckPlate = typeof truck_plate === 'string' ? truck_plate.trim().toUpperCase() : '';
        const eirReference = (typeof eir_reference === 'string' ? eir_reference.trim() : '')
            || `EIR-${container.id}-${Date.now().toString().slice(-6)}`;
        const inspectionNotes = [notes, iicl_defect_notes && `IICL defects: ${iicl_defect_notes}`]
            .filter(Boolean)
            .join('\n');

        await client.query(
            `INSERT INTO container_inspections
             (container_id, inspection_stage, iicl_damage_codes, inspector_id, notes)
             VALUES ($1, 'GATE_IN', $2, $3, $4)`,
            [container.id, iicl_damage_codes, req.user.id, inspectionNotes]
        );

        await client.query(
            `INSERT INTO container_movements
             (container_id, movement_type, truck_plate, seal_number, eir_reference, notes, recorded_by)
             VALUES ($1, 'GATE_IN', $2, $3, $4, $5, $6)`,
            [container.id, normalizedTruckPlate, seal_number, eirReference, notes, req.user.id]
        );

        await client.query('COMMIT');
        const eirReceipt = {
            eir_reference: eirReference,
            movement_type: 'GATE_IN',
            tracking_code: `YARD-${container.id}`,
            issued_at: new Date().toISOString(),
            container,
            truck_plate: normalizedTruckPlate,
            seal_number: seal_number || 'N/A',
            origin: 'D2-Transport Depot (Athi River)',
            destination: 'Depot Yard',
            cargo_description: `${container.container_type} Container`,
            iicl_defect_notes,
            driver: {
                name: driver_name,
                national_id: driver_id_number,
                phone_number: driver_phone,
                license_number: driver_license
            },
            transporter: {
                company_name: transporter_name,
                truck_plate: normalizedTruckPlate,
                trailer_plate
            },
            client_shipper: {
                principal_or_line: principal_name,
                shipper_name,
                consignee_or_client: client_name,
                billing_currency: principal_currency
            }
        };

        res.status(201).json({
            message: `Gate-In recorded for ${container.container_number}${!isoCheck.valid ? ' (Warning: ISO check digit flagged)' : ''}.`,
            container,
            eir_receipt: eirReceipt
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
});

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
router.get('/principal/portfolio', verifyToken, async (req, res) => {
    try {
        const principalFilter = (req.query.principal || '').trim();
        const currencyFilter = (req.query.currency || '').trim().toUpperCase();
        const statusFilter = (req.query.status || '').trim();
        const dateFrom = (req.query.date_from || '').trim();
        const dateTo = (req.query.date_to || '').trim();
        const conditions = [];
        const params = [];

        if (principalFilter) {
            params.push(`%${principalFilter}%`);
            conditions.push(`c.principal_name ILIKE $${params.length}`);
        }
        if (currencyFilter && currencyFilter !== 'ALL') {
            params.push(currencyFilter);
            conditions.push(`UPPER(COALESCE(c.principal_currency, 'USD')) = $${params.length}`);
        }
        if (statusFilter && statusFilter !== 'ALL') {
            params.push(statusFilter);
            conditions.push(`c.status = $${params.length}`);
        }
        if (dateFrom) {
            params.push(dateFrom);
            conditions.push(`c.gated_in_at::date >= $${params.length}::date`);
        }
        if (dateTo) {
            params.push(dateTo);
            conditions.push(`c.gated_in_at::date <= $${params.length}::date`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const result = await pool.query(
            `SELECT
                c.id,
                c.container_number,
                c.iso_check_valid,
                c.container_type,
                c.principal_name,
                c.principal_currency,
                c.free_days,
                c.daily_storage_rate,
                c.yard_bay,
                c.status,
                c.condition_status,
                c.cleaning_status,
                c.cleaning_cert_ref,
                c.kephis_cleared,
                c.customs_hold,
                c.kebs_hold,
                c.gated_in_at,
                c.gated_out_at,
                GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (COALESCE(c.gated_out_at, CURRENT_TIMESTAMP) - c.gated_in_at)) / 86400))::int AS dwell_days
             FROM containers c
             ${whereClause}
             ORDER BY c.gated_in_at DESC NULLS LAST`,
            params
        );

        const enriched = result.rows.map((row) => {
            const dwellDays = Number(row.dwell_days || 0);
            const freeDays = Number(row.free_days || 0);
            const dailyRate = Number(row.daily_storage_rate || 0);
            const billableDays = Math.max(0, dwellDays - freeDays);
            const accruedStorage = Number((billableDays * dailyRate).toFixed(2));

            return {
                ...row,
                dwell_days: dwellDays,
                billable_days: billableDays,
                accrued_storage: accruedStorage
            };
        });

        res.json({ containers: enriched });
    } catch (err) {
        res.status(500).json({ error: 'Server error loading principal portfolio.' });
    }
});

// Batch UN/EDIFACT CODECO export for containers matching a principal.
router.get('/principal/batch-codeco', verifyToken, async (req, res) => {
    try {
        const principalFilter = (req.query.principal || '').trim();
        const params = [];
        let whereClause = '';
        if (principalFilter) {
            params.push(`%${principalFilter}%`);
            whereClause = 'WHERE c.principal_name ILIKE $1';
        }

        const result = await pool.query(
            `SELECT c.* FROM containers c ${whereClause} ORDER BY c.gated_in_at DESC NULLS LAST`,
            params
        );

        const now = new Date();
        const yymmdd = now.toISOString().slice(2, 10).replace(/-/g, '');
        const hhmm = now.toISOString().slice(11, 16).replace(':', '');
        const interchangeRef = `BATCH${Date.now().toString().slice(-6)}`;
        const principal = (principalFilter || 'PRINCIPAL').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'LINE';
        const header = [`UNB+UNOA:2+D2TRANSPORT+${principal}+${yymmdd}:${hhmm}+${interchangeRef}'`];
        const messages = result.rows.map((container, index) => {
            const messageRef = `${index + 1}`.padStart(4, '0');
            const isGatedOut = container.status === 'Gated-Out';
            const isoSize = container.container_type === '40HC'
                ? '45G1'
                : container.container_type === '40GP'
                    ? '42G1'
                    : container.container_type === '20RF'
                        ? '22R1'
                        : '22G1';

            return [
                `UNH+${messageRef}+CODECO:D:95B:UN'`,
                `BGM+${isGatedOut ? '36' : '34'}+${container.container_number}-${messageRef}+9'`,
                `NAD+CA+${(container.principal_name || 'UNKNOWN').toUpperCase().replace(/[^A-Z0-9 ]/g, '')}:172:20'`,
                `EQD+CN+${container.container_number}+${isoSize}:102:5++${isGatedOut ? '3' : '2'}+4'`,
                `DTM+7:${yymmdd}${hhmm}:203'`,
                `LOC+165+KEATH:139:6+D2DEPOT'`,
                `UNT+6+${messageRef}'`
            ].join('\n');
        });

        res.json({
            count: result.rows.length,
            interchange_ref: interchangeRef,
            edi_payload: [...header, ...messages, `UNZ+${messages.length}+${interchangeRef}'`].join('\n')
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error generating batch CODECO EDI.' });
    }
});

// One-Click Bridge: Gate-Out Container & Dispatch onto a Compliant D2-Transport Truck
router.post('/containers/:id/dispatch-trip', requireRole('Admin', 'Dispatcher', 'FleetManager'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const {
            truck_id,
            driver_id,
            origin = 'D2-Transport Depot (Athi River)',
            destination = 'Mombasa Port / CFS',
            cargo_description = 'Containerized Freight',
            seal_number = '',
            eir_reference = `EIR-${Date.now().toString().slice(-6)}`,
            require_sanitized = false,
            require_kephis = false,
            notes = ''
        } = req.body;

        const containerRes = await client.query(`SELECT * FROM containers WHERE id = $1`, [id]);
        if (containerRes.rows.length === 0) {
            return res.status(404).json({ error: 'Container not found.' });
        }
        const container = containerRes.rows[0];

        // 1. Enforce Container Compliance Gates
        const check = evaluateReleaseEligibility(container, {
            requireSanitized: Boolean(require_sanitized),
            requireKephis: Boolean(require_kephis)
        });
        if (!check.allowed) {
            return res.status(400).json({
                error: 'Dispatch blocked by container compliance checks.',
                blockers: check.blockers
            });
        }

        // 2. Verify Truck & 3-Year Compliance Vault Status
        const truckRes = await client.query(`SELECT * FROM trucks WHERE id = $1`, [truck_id]);
        if (truckRes.rows.length === 0) {
            return res.status(404).json({ error: 'Selected truck not found.' });
        }
        const truck = truckRes.rows[0];

        const expiredDocsRes = await client.query(
            `SELECT doc_type, expiry_date FROM truck_compliance_docs
             WHERE truck_id = $1 AND expiry_date < CURRENT_DATE`,
            [truck_id]
        );
        if (expiredDocsRes.rows.length > 0) {
            return res.status(400).json({
                error: `Truck ${truck.plate_number} is blocked by expired compliance documents.`,
                blockers: expiredDocsRes.rows.map((d) => `Expired ${d.doc_type} (${new Date(d.expiry_date).toLocaleDateString()})`)
            });
        }

        await client.query('BEGIN');

        // 3. Create Corridor Trip linked to this Container
        const trackingCode = `D2-${Date.now().toString().slice(-6)}`;
        const tripRes = await client.query(
            `INSERT INTO trips
             (tracking_code, truck_id, driver_id, origin, destination, cargo_description, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'In Transit')
             RETURNING *`,
            [
                trackingCode,
                truck_id,
                driver_id || null,
                origin,
                destination,
                `${container.container_number} (${container.container_type}) | Seal: ${seal_number || 'N/A'} | ${cargo_description}`
            ]
        );
        const trip = tripRes.rows[0];

        // 4. Gate-Out Container & Link Trip
        const updatedContainerRes = await client.query(
            `UPDATE containers
             SET status = 'Gated-Out',
                 current_trip_id = $1,
                 gated_out_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [trip.id, id]
        );

        // 5. Record Gate-Out Movement Audit Trail
        await client.query(
            `INSERT INTO container_movements
             (container_id, movement_type, truck_plate, seal_number, eir_reference, notes, recorded_by)
             VALUES ($1, 'GATE_OUT', $2, $3, $4, $5, $6)`,
            [id, truck.plate_number, seal_number, eir_reference, `Dispatched on Trip ${trackingCode}. ${notes}`, req.user.id]
        );

        const driverRes = driver_id
            ? await client.query(
                  `SELECT id, name, national_id, phone_number, license_number, license_expiry FROM users WHERE id = $1`,
                  [driver_id]
              )
            : { rows: [] };

        await client.query('COMMIT');

        const eirReceipt = {
            eir_reference,
            tracking_code: trackingCode,
            issued_at: new Date().toISOString(),
            container: updatedContainerRes.rows[0],
            truck_plate: truck.plate_number,
            driver: driverRes.rows[0] || {},
            transporter: { truck_plate: truck.plate_number },
            seal_number: seal_number || 'N/A',
            origin,
            destination,
            cargo_description
        };

        res.status(201).json({
            message: `Container ${container.container_number} gated out and dispatched on ${truck.plate_number} (${trackingCode}).`,
            eir_receipt: eirReceipt
        });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        res.status(500).json({ error: 'Server error dispatching container onto transport trip.' });
    } finally {
        client.release();
    }
});
module.exports = router;
