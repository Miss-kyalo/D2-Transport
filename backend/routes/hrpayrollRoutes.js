const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const { calculateKenyaPayroll2026 } = require('../utils/kenyaPayroll2026');

const MONTHLY_OFF_DAYS_TOTAL = 4;
const MONTHLY_OFF_DAYS_PAID = 2;
const MONTHLY_OFF_DAYS_TAKEN_TARGET = 2;

// PUBLIC QR TRACKING ENDPOINT (No Login Required — Clients & Gate Guards Scan QR)
router.get('/public-track/:code', async (req, res) => {
    try {
        const code = req.params.code.trim().toUpperCase();

        // Check Trip Tracking Code first
        const tripRes = await pool.query(
            `SELECT t.id, t.tracking_code, t.origin, t.destination, t.cargo_description, t.status, t.created_at,
                    tr.plate_number, u.username AS driver_name
             FROM trips t
             LEFT JOIN trucks tr ON t.truck_id = tr.id
             LEFT JOIN users u ON t.driver_id = u.id
             WHERE UPPER(t.tracking_code) = $1 OR UPPER(t.qr_token) = $1`,
            [code]
        );

        // Check Container Number or EIR Reference
        const containerRes = await pool.query(
            `SELECT c.id, c.container_number, c.container_type, c.principal_name, c.yard_bay,
                    c.status, c.condition_status, c.cleaning_status, c.cleaning_cert_ref,
                    c.kephis_cleared, c.customs_hold, c.kebs_hold, c.gated_in_at, c.gated_out_at
             FROM containers c
             LEFT JOIN container_movements cm ON cm.container_id = c.id
             WHERE UPPER(c.container_number) = $1 OR UPPER(cm.eir_reference) = $1
             ORDER BY c.id DESC LIMIT 1`,
            [code]
        );

        if (tripRes.rows.length === 0 && containerRes.rows.length === 0) {
            return res.status(404).json({ error: 'No verified shipment or container found for this QR code.' });
        }

        const container = containerRes.rows[0] || null;
        let movements = [];
        if (container) {
            const movRes = await pool.query(
                `SELECT movement_type, truck_plate, seal_number, eir_reference, notes, created_at
                 FROM container_movements WHERE container_id = $1 ORDER BY created_at ASC`,
                [container.id]
            );
            movements = movRes.rows;
        }

        res.json({
            verified: true,
            verified_at: new Date().toISOString(),
            trip: tripRes.rows[0] || null,
            container,
            movements
        });
    } catch (err) {
        res.status(500).json({ error: 'Verification service error.' });
    }
});

// PROTECTED HR & PAYROLL ENDPOINTS
router.use(verifyToken);

// List All Driver & Staff Statutory Profiles
router.get('/profiles', requireRole('PayrollAccountant', 'Boss'), async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, username AS name, email, role, national_id, kra_pin, nssf_number, shif_number,
                    phone_number, license_number, license_class, license_expiry, employment_date,
                    basic_pay, housing_allowance, off_day_rate, bank_name, bank_account
             FROM users
             ORDER BY username ASC`
        );
        res.json({ profiles: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load employee statutory profiles.' });
    }
});

// Update Driver / Employee Statutory & Compensation Profile
router.put('/profiles/:id', requireRole('PayrollAccountant'), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            national_id, kra_pin, nssf_number, shif_number, phone_number,
            license_number, license_class, license_expiry,
            basic_pay, housing_allowance, off_day_rate,
            bank_name, bank_account
        } = req.body;

        const updated = await pool.query(
            `UPDATE users
             SET national_id = $1,
                 kra_pin = UPPER($2),
                 nssf_number = $3,
                 shif_number = $4,
                 phone_number = $5,
                 license_number = $6,
                 license_class = $7,
                 license_expiry = $8,
                 basic_pay = $9,
                 housing_allowance = $10,
                 off_day_rate = $11,
                 bank_name = $12,
                 bank_account = $13
             WHERE id = $14
             RETURNING id, username AS name, email, role, national_id, kra_pin, nssf_number, shif_number,
                       phone_number, license_number, license_class, license_expiry,
                       basic_pay, housing_allowance, off_day_rate, bank_name, bank_account`,
            [
                national_id || null, kra_pin || null, nssf_number || null, shif_number || null, phone_number || null,
                license_number || null, license_class || 'CE', license_expiry || null,
                Number(basic_pay || 0), Number(housing_allowance || 0), Number(off_day_rate || 0),
                bank_name || null, bank_account || null, id
            ]
        );

        if (updated.rows.length === 0) return res.status(404).json({ error: 'Employee profile not found.' });
        res.json({ message: 'Statutory profile updated.', profile: updated.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update employee profile.' });
    }
});

// Submit Leave or Off-Day Request (Drivers & Staff)
router.post('/leave-requests', async (req, res) => {
    const client = await pool.connect();
    try {
        const { request_type, start_date, end_date, days_count, reason } = req.body;
        const validRequestTypes = ['ANNUAL_LEAVE', 'OFF_DAY_TAKE', 'SICK_LEAVE'];
        const days = Number(days_count);
        const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '') &&
            !Number.isNaN(Date.parse(value)) &&
            new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
        if (!validRequestTypes.includes(request_type) || !validDate(start_date) || !validDate(end_date) ||
            start_date > end_date || !Number.isFinite(days) || days <= 0) {
            return res.status(400).json({ error: 'A valid leave type, date range, and positive day count are required.' });
        }
        if (request_type === 'OFF_DAY_TAKE' &&
            (start_date.slice(0, 7) !== end_date.slice(0, 7) || days > MONTHLY_OFF_DAYS_TAKEN_TARGET)) {
            return res.status(400).json({ error: 'Off-day requests must be within one month and cannot exceed two days.' });
        }

        await client.query('BEGIN');
        if (request_type === 'OFF_DAY_TAKE') {
            await client.query(`SELECT id FROM users WHERE id = $1 FOR UPDATE`, [req.user.id]);
            const existing = await client.query(
                `SELECT COALESCE(SUM(days_count), 0) AS reserved_days
                 FROM leave_off_requests
                 WHERE user_id = $1
                   AND request_type = 'OFF_DAY_TAKE'
                   AND status IN ('Pending', 'Approved')
                   AND start_date >= $2::date
                   AND start_date < ($2::date + INTERVAL '1 month')`,
                [req.user.id, `${start_date.slice(0, 7)}-01`]
            );
            if (Number(existing.rows[0].reserved_days) + days > MONTHLY_OFF_DAYS_TAKEN_TARGET) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'This request would exceed the two monthly off-days.' });
            }
        }

        const inserted = await client.query(
            `INSERT INTO leave_off_requests (user_id, request_type, start_date, end_date, days_count, reason)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [req.user.id, request_type, start_date, end_date, days, reason || '']
        );
        await client.query('COMMIT');
        res.status(201).json({ message: 'Leave / Off-day request submitted.', request: inserted.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        res.status(500).json({ error: 'Failed to submit leave/off request.' });
    } finally {
        client.release();
    }
});

// List Leave & Off-Day Requests (Admin sees all; Driver sees own)
router.get('/leave-requests', async (req, res) => {
    try {
        const isHr = req.user.role === 'HR';
        const query = isHr
            ? `SELECT r.*, u.username AS employee_name, u.annual_leave_balance, u.accrued_off_days
               FROM leave_off_requests r JOIN users u ON r.user_id = u.id ORDER BY r.created_at DESC`
            : `SELECT r.*, u.username AS employee_name, u.annual_leave_balance, u.accrued_off_days
               FROM leave_off_requests r JOIN users u ON r.user_id = u.id WHERE r.user_id = $1 ORDER BY r.created_at DESC`;
        const result = await pool.query(query, isHr ? [] : [req.user.id]);
        res.json({ requests: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load leave & off requests.' });
    }
});

// Approve / Reject Leave or Off-Day & Automatically Adjust Balances
router.get('/off-days/summary', requireRole('HR'), async (req, res) => {
    try {
        const month = String(req.query.month || new Date().toISOString().slice(0, 7));
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
            return res.status(400).json({ error: 'Month must use YYYY-MM format.' });
        }

        const result = await pool.query(
            `SELECT u.id, u.username AS employee_name, u.role,
                    u.annual_leave_balance, u.accrued_off_days,
                    COALESCE(p.off_days_paid, 0) AS paid_days,
                    COALESCE(t.taken_days, 0) AS taken_days,
                    $2::integer AS total_days,
                    $3::integer AS paid_days_target,
                    $4::integer AS taken_days_target,
                    GREATEST(0, $4::numeric - COALESCE(t.taken_days, 0)) AS remaining_taken_days,
                    CASE
                        WHEN COALESCE(p.off_days_paid, 0) = $3
                             AND COALESCE(t.taken_days, 0) >= $4 THEN 'Complete'
                        WHEN ($1::date + INTERVAL '1 month')::date <= CURRENT_DATE THEN 'Shortfall'
                        ELSE 'In progress'
                    END AS status
             FROM users u
             LEFT JOIN payroll_records p
               ON p.user_id = u.id AND p.payroll_month = $5
             LEFT JOIN (
                 SELECT user_id, SUM(days_count) AS taken_days
                 FROM leave_off_requests
                 WHERE request_type = 'OFF_DAY_TAKE'
                   AND status = 'Approved'
                   AND start_date >= $1::date
                   AND start_date < ($1::date + INTERVAL '1 month')
                 GROUP BY user_id
             ) t ON t.user_id = u.id
             WHERE u.role NOT IN ('Manufacturer', 'Client', 'SpotClient')
             ORDER BY u.username ASC`,
            [`${month}-01`, MONTHLY_OFF_DAYS_TOTAL, MONTHLY_OFF_DAYS_PAID, MONTHLY_OFF_DAYS_TAKEN_TARGET, month]
        );
        res.json({ month, records: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load monthly off-day summary.' });
    }
});

router.put('/leave-balances/:id', requireRole('HR'), async (req, res) => {
    const annualLeaveBalance = Number(req.body.annual_leave_balance);
    const accruedOffDays = Number(req.body.accrued_off_days);
    if (!Number.isFinite(annualLeaveBalance) || annualLeaveBalance < 0 ||
        !Number.isFinite(accruedOffDays) || accruedOffDays < 0) {
        return res.status(400).json({ error: 'Leave balances must be valid non-negative numbers.' });
    }

    try {
        const result = await pool.query(
            `UPDATE users
             SET annual_leave_balance = $1, accrued_off_days = $2
             WHERE id = $3 AND role NOT IN ('Manufacturer', 'Client', 'SpotClient')
             RETURNING id, username AS employee_name, annual_leave_balance, accrued_off_days`,
            [annualLeaveBalance, accruedOffDays, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Employee not found.' });
        res.json({ message: 'Leave balances updated.', employee: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update leave balances.' });
    }
});

router.patch('/leave-requests/:id/review', requireRole('HR'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { status } = req.body; // 'Approved' | 'Rejected'
        if (!['Approved', 'Rejected'].includes(status)) {
            return res.status(400).json({ error: 'Status must be Approved or Rejected.' });
        }

        await client.query('BEGIN');
        const reqRes = await client.query(`SELECT * FROM leave_off_requests WHERE id = $1`, [id]);
        if (reqRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Request not found.' });
        }

        const leaveReq = reqRes.rows[0];
        if (leaveReq.status !== 'Pending') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Request already reviewed.' });
        }
        if (status === 'Approved' && leaveReq.request_type === 'OFF_DAY_TAKE') {
            await client.query(`SELECT id FROM users WHERE id = $1 FOR UPDATE`, [leaveReq.user_id]);
            const monthStart = `${new Date(leaveReq.start_date).toISOString().slice(0, 7)}-01`;
            const taken = await client.query(
                `SELECT COALESCE(SUM(days_count), 0) AS taken_days
                 FROM leave_off_requests
                 WHERE user_id = $1
                   AND id <> $2
                   AND request_type = 'OFF_DAY_TAKE'
                   AND status = 'Approved'
                   AND start_date >= $3::date
                   AND start_date < ($3::date + INTERVAL '1 month')`,
                [leaveReq.user_id, id, monthStart]
            );
            if (Number(taken.rows[0].taken_days) + Number(leaveReq.days_count) > MONTHLY_OFF_DAYS_TAKEN_TARGET) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Approving this request would exceed the two monthly off-days.' });
            }
        }

        await client.query(
            `UPDATE leave_off_requests SET status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP WHERE id = $3`,
            [status, req.user.id, id]
        );

        if (status === 'Approved') {
            const days = Number(leaveReq.days_count);
            if (leaveReq.request_type === 'ANNUAL_LEAVE') {
                await client.query(`UPDATE users SET annual_leave_balance = GREATEST(0, annual_leave_balance - $1) WHERE id = $2`, [days, leaveReq.user_id]);
            } else if (leaveReq.request_type === 'OFF_DAY_TAKE' || leaveReq.request_type === 'OFF_DAY_ENCASH') {
                await client.query(`UPDATE users SET accrued_off_days = GREATEST(0, accrued_off_days - $1) WHERE id = $2`, [days, leaveReq.user_id]);
            }
        }

        await client.query('COMMIT');
        res.json({ message: `Request ${status.toLowerCase()} and leave/off counters updated.` });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        res.status(500).json({ error: 'Failed to review request.' });
    } finally {
        client.release();
    }
});

// Generate / Save Monthly Statutory Payroll Run (KRA & Labour Proof)
router.post('/payroll/run', requireRole('PayrollAccountant'), async (req, res) => {
    try {
        const { user_id, payroll_month, salary_advance = 0 } = req.body;

        const userRes = await pool.query(`SELECT * FROM users WHERE id = $1`, [user_id]);
        if (userRes.rows.length === 0) return res.status(404).json({ error: 'Employee not found.' });
        const emp = userRes.rows[0];

        const calc = calculateKenyaPayroll2026({
            basicPay: emp.basic_pay,
            housingAllowance: emp.housing_allowance,
            offDaysPaid: MONTHLY_OFF_DAYS_PAID,
            offDayRate: emp.off_day_rate,
            salaryAdvance: salary_advance
        });

        const saved = await pool.query(
            `INSERT INTO payroll_records
             (user_id, payroll_month, basic_pay, housing_allowance, off_days_paid, off_pay, gross_pay,
              nssf_tier1, nssf_tier2, nssf_total, shif_deduction, housing_levy, taxable_pay, paye_tax,
              salary_advance, total_deductions, net_pay, employer_nssf, employer_ahl)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
             ON CONFLICT (user_id, payroll_month) DO UPDATE SET
              basic_pay = EXCLUDED.basic_pay,
              housing_allowance = EXCLUDED.housing_allowance,
              off_days_paid = EXCLUDED.off_days_paid,
              off_pay = EXCLUDED.off_pay,
              gross_pay = EXCLUDED.gross_pay,
              nssf_tier1 = EXCLUDED.nssf_tier1,
              nssf_tier2 = EXCLUDED.nssf_tier2,
              nssf_total = EXCLUDED.nssf_total,
              shif_deduction = EXCLUDED.shif_deduction,
              housing_levy = EXCLUDED.housing_levy,
              taxable_pay = EXCLUDED.taxable_pay,
              paye_tax = EXCLUDED.paye_tax,
              salary_advance = EXCLUDED.salary_advance,
              total_deductions = EXCLUDED.total_deductions,
              net_pay = EXCLUDED.net_pay,
              employer_nssf = EXCLUDED.employer_nssf,
              employer_ahl = EXCLUDED.employer_ahl
             RETURNING *`,
            [
                user_id, payroll_month, calc.basic_pay, calc.housing_allowance, calc.off_days_paid, calc.off_pay, calc.gross_pay,
                calc.nssf_tier1, calc.nssf_tier2, calc.nssf_total, calc.shif_deduction, calc.housing_levy, calc.taxable_pay, calc.paye_tax,
                calc.salary_advance, calc.total_deductions, calc.net_pay, calc.employer_nssf, calc.employer_ahl
            ]
        );

        res.status(201).json({ message: `Statutory payroll calculated for ${emp.username} (${payroll_month}).`, record: saved.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to process statutory payroll run.' });
    }
});

// Fetch Full Statutory Audit Register for a Month (KRA P10 / NSSF / SHIF / AHL / Labour)
router.get('/payroll/register', requireRole('PayrollAccountant', 'Boss'), async (req, res) => {
    try {
        const month = req.query.month || new Date().toISOString().slice(0, 7);
        const result = await pool.query(
            `SELECT p.*, u.username AS name, u.role, u.national_id, u.kra_pin, u.nssf_number, u.shif_number,
                    u.bank_name, u.bank_account
             FROM payroll_records p
             JOIN users u ON p.user_id = u.id
             WHERE p.payroll_month = $1
             ORDER BY u.username ASC`,
            [month]
        );
        res.json({ month, records: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load payroll audit register.' });
    }
});

// Fetch Employee Payslip History & Year-to-Date Statutory Summary (KRA / Labour Audit)
async function employeeStatement(req, res) {
    try {
        const userId = req.params.userId || req.user.id;
        const year = String(req.query.year || new Date().getFullYear());
        if (!/^\d{4}$/.test(year)) {
            return res.status(400).json({ error: 'Year must use YYYY format.' });
        }

        const empRes = await pool.query(
            `SELECT id, username AS name, email, role, national_id, kra_pin, nssf_number, shif_number,
                    phone_number, bank_name, bank_account
             FROM users WHERE id = $1`,
            [userId]
        );
        if (empRes.rows.length === 0) {
            return res.status(404).json({ error: 'Employee not found.' });
        }

        const recordsRes = await pool.query(
            `SELECT *
             FROM payroll_records
             WHERE user_id = $1 AND payroll_month LIKE $2
             ORDER BY payroll_month ASC`,
            [userId, `${year}-%`]
        );

        const ytd = recordsRes.rows.reduce(
            (acc, r) => ({
                basic_pay: acc.basic_pay + Number(r.basic_pay || 0),
                housing_allowance: acc.housing_allowance + Number(r.housing_allowance || 0),
                off_pay: acc.off_pay + Number(r.off_pay || 0),
                gross_pay: acc.gross_pay + Number(r.gross_pay || 0),
                nssf_total: acc.nssf_total + Number(r.nssf_total || 0),
                shif_deduction: acc.shif_deduction + Number(r.shif_deduction || 0),
                housing_levy: acc.housing_levy + Number(r.housing_levy || 0),
                taxable_pay: acc.taxable_pay + Number(r.taxable_pay || 0),
                paye_tax: acc.paye_tax + Number(r.paye_tax || 0),
                salary_advance: acc.salary_advance + Number(r.salary_advance || 0),
                total_deductions: acc.total_deductions + Number(r.total_deductions || 0),
                net_pay: acc.net_pay + Number(r.net_pay || 0),
                employer_nssf: acc.employer_nssf + Number(r.employer_nssf || 0),
                employer_ahl: acc.employer_ahl + Number(r.employer_ahl || 0)
            }),
            {
                basic_pay: 0,
                housing_allowance: 0,
                off_pay: 0,
                gross_pay: 0,
                nssf_total: 0,
                shif_deduction: 0,
                housing_levy: 0,
                taxable_pay: 0,
                paye_tax: 0,
                salary_advance: 0,
                total_deductions: 0,
                net_pay: 0,
                employer_nssf: 0,
                employer_ahl: 0
            }
        );

        res.json({
            year,
            employee: empRes.rows[0],
            records: recordsRes.rows,
            ytd
        });
    } catch (err) {
        console.error('Failed to load employee payroll statement:', err);
        res.status(500).json({ error: 'Failed to load employee payslip and YTD statement.' });
    }
}

router.get('/payroll/my-statement', requireRole(
    'Admin', 'HR', 'Accounts_Payable', 'Accounts_Receivable', 'Dispatcher',
    'FleetManager', 'Mechanic', 'Driver', 'Storekeeper', 'PayrollAccountant', 'Boss'
), employeeStatement);
router.get('/payroll/employee-statement/:userId', requireRole('PayrollAccountant', 'Boss'), employeeStatement);

module.exports = router;