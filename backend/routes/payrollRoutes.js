const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

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

router.post('/generate', requireRole('PayrollAccountant'), (_req, res) => {
    res.status(410).json({ error: 'Legacy payroll is read-only. Use the statutory payroll workflow.' });
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

router.patch('/:id/acknowledge', requireRole('Driver'), (_req, res) => {
    res.status(410).json({ error: 'Legacy payslips are read-only and cannot be acknowledged or changed.' });
});

router.patch('/:id/release', requireRole('Accounts_Payable'), (_req, res) => {
    res.status(410).json({ error: 'Legacy payslips are read-only and cannot be released or changed.' });
});

module.exports = router;