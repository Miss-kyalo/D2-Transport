const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const { calculateEmployeeMonthlyPayroll } = require('../utils/payrollEngine');

router.use(verifyToken);

// Get all drivers & staff eligible for payroll
router.get('/staff', requireRole('PayrollAccountant'), async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, username, role, basic_pay, housing_allowance, off_pay, bank_account_number 
             FROM users 
             WHERE role IN ('Driver', 'Mechanic', 'Dispatcher', 'FleetManager', 'HR', 'Accounts_Payable', 'Accounts_Receivable')
             ORDER BY username ASC`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Server error fetching payroll staff.' });
    }
});

// Get generated payslips for a specific month (e.g., '2026-11')
router.get('/cycles/:monthYear', requireRole('PayrollAccountant'), async (req, res) => {
    try {
        const { monthYear } = req.params;
        const result = await pool.query(
            `SELECT p.*, u.username, u.role, u.bank_account_number
             FROM driver_payrolls p
             JOIN users u ON p.driver_id = u.id
             WHERE p.month_year = $1
             ORDER BY u.username ASC`,
            [monthYear]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Server error fetching payroll cycle.' });
    }
});

// Generate / Recalculate Monthly Payroll for an Employee
router.post('/generate', requireRole('PayrollAccountant'), async (req, res) => {
    const client = await pool.connect();
    try {
        const {
            driver_id,
            month_year,
            basic_pay,
            housing_allowance,
            off_pay,
            absent_days_full = 0,
            absent_days_half = 0,
            salary_advances = 0
        } = req.body;

        if (!driver_id || !month_year) {
            return res.status(400).json({ error: 'Employee ID and Month-Year (YYYY-MM) are required.' });
        }

        await client.query('BEGIN');

        // Persist updated base salary structure on user profile
        await client.query(
            `UPDATE users SET basic_pay = $1, housing_allowance = $2, off_pay = $3 WHERE id = $4`,
            [basic_pay, housing_allowance, off_pay, driver_id]
        );

        // Fetch transit liability deductions (e.g., sold fuel, damaged parts)
        const transitDedRes = await client.query(
            `SELECT COALESCE(SUM(amount_kes), 0) AS total FROM payroll_deductions WHERE driver_id = $1`,
            [driver_id]
        );
        const transitDeductions = parseFloat(transitDedRes.rows[0].total || 0);

        // Run 2026 Kenyan Statutory Payroll Engine
        const calc = calculateEmployeeMonthlyPayroll({
            basicPay: basic_pay,
            housingAllowance: housing_allowance,
            offPay: off_pay,
            absentDaysFull: Number(absent_days_full),
            absentDaysHalf: Number(absent_days_half),
            bankAdvances: Number(salary_advances),
            cashAdvances: transitDeductions
        });

        const totalDeductions = Number(
            (calc.absenteeismDeduction + calc.statutory.totalStatutory + Number(salary_advances) + transitDeductions).toFixed(2)
        );

        // Remove existing Draft for same month before inserting fresh calculation
        await client.query(
            `DELETE FROM driver_payrolls WHERE driver_id = $1 AND month_year = $2 AND status = 'Draft'`,
            [driver_id, month_year]
        );

        const insertRes = await client.query(
            `INSERT INTO driver_payrolls 
             (driver_id, month_year, basic_pay, housing_allowance, off_pay, deductions_total, net_pay, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'Draft')
             RETURNING *`,
            [driver_id, month_year, basic_pay, housing_allowance, off_pay, totalDeductions, calc.netSalaryReleased]
        );

        await client.query('COMMIT');
        res.status(201).json({
            message: 'Monthly payslip generated under 2026 Kenyan statutory rates.',
            payslip: insertRes.rows[0],
            breakdown: calc
        });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        res.status(500).json({ error: 'Server error generating payroll.', details: err.message });
    } finally {
        client.release();
    }
});

// Driver: View Own Payslips
router.get('/my-payslips', requireRole('Driver'), async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM driver_payrolls WHERE driver_id = $1 ORDER BY month_year DESC`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Server error fetching your payslips.' });
    }
});

// Driver: Digital Consent Sign-Off on Payslip
router.patch('/:id/acknowledge', requireRole('Driver'), async (req, res) => {
    try {
        const { id } = req.params;
        const { signature_text } = req.body;

        const result = await pool.query(
            `UPDATE driver_payrolls 
             SET acknowledged_by_driver = TRUE, 
                 driver_signature_url = $1, 
                 acknowledged_at = CURRENT_TIMESTAMP, 
                 status = 'Acknowledged'
             WHERE id = $2 AND driver_id = $3
             RETURNING *`,
            [signature_text || req.user.username, id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Payslip not found.' });
        }
        res.json({ message: 'Payslip signed and acknowledged.', payslip: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Server error acknowledging payslip.' });
    }
});

// Accounts / Admin: Release Final Net Pay after Driver Sign-Off
router.patch('/:id/release', requireRole('Admin', 'Accounts_Payable'), async (req, res) => {
    try {
        const { id } = req.params;
        const check = await pool.query(`SELECT acknowledged_by_driver FROM driver_payrolls WHERE id = $1`, [id]);
        if (check.rows.length === 0) return res.status(404).json({ error: 'Payslip not found.' });
        if (!check.rows[0].acknowledged_by_driver) {
            return res.status(400).json({ error: 'Driver digital payslip consent sign-off is required before releasing salary.' });
        }

        const result = await pool.query(
            `UPDATE driver_payrolls SET status = 'Released' WHERE id = $1 RETURNING *`,
            [id]
        );
        res.json({ message: 'Salary marked as Released.', payslip: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Server error releasing salary.' });
    }
});

module.exports = router;