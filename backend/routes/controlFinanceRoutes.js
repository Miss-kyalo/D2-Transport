const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();
const readers = requireRole('Admin', 'Accounts_Payable', 'Accounts_Receivable', 'PayrollAccountant', 'Boss');
const writers = requireRole('Accounts_Payable', 'Accounts_Receivable', 'Boss');
router.use(verifyToken);

router.get('/finance/overview', readers, async (_req, res) => {
    try {
        const [invoices, entries] = await Promise.all([
            pool.query(
                `SELECT i.id, i.amount_kes, i.status, i.issued_date, i.due_date,
                        t.tracking_code, u.username AS client_name
                 FROM invoices i LEFT JOIN trips t ON t.id = i.trip_id
                 LEFT JOIN users u ON u.id = i.client_id
                 ORDER BY i.issued_date DESC, i.id DESC LIMIT 100`
            ),
            pool.query(`SELECT id, entry_date, account_name, bank_reference, entry_type, department_source,
                               description, amount, currency, etims_ref, reconciled, created_at
                        FROM bank_ledger_entries ORDER BY entry_date DESC, id DESC LIMIT 100`)
        ]);
        res.json({ invoices: invoices.rows, bank_entries: entries.rows });
    } catch (error) {
        console.error('Failed to load finance overview:', error);
        res.status(500).json({ error: 'Failed to load finance overview.' });
    }
});

router.post('/finance/bank-ledger', writers, async (req, res) => {
    const b = req.body;
    const date = typeof b.entry_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.entry_date)
        ? new Date(`${b.entry_date}T00:00:00Z`) : new Date(NaN);
    const validDate = !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === b.entry_date;
    const validText = (value, limit) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= limit;
    const amount = typeof b.amount === 'string' || typeof b.amount === 'number' ? String(b.amount) : '';
    const currency = typeof b.currency === 'string' ? b.currency.trim().toUpperCase() : '';
    const etims = typeof b.etims_ref === 'string' ? b.etims_ref.trim() : '';
    if (!validDate || !validText(b.account_name, 80) || !validText(b.bank_reference, 80) ||
        !validText(b.description, 1000) || !['DEBIT', 'CREDIT'].includes(b.entry_type) ||
        !['GENERAL', 'GARAGE', 'FLEET_TRANSPORT', 'CONTAINER_DEPOT'].includes(b.department_source) ||
        !/^[A-Z]{3}$/.test(currency) || !/^\d+(?:\.\d{1,2})?$/.test(amount) ||
        Number(amount) <= 0 || Number(amount) > 999999999999.99 ||
        (b.etims_ref != null && typeof b.etims_ref !== 'string') || etims.length > 60) {
        return res.status(400).json({ error: 'Valid bank entry details and a positive amount are required.' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO bank_ledger_entries
             (entry_date, account_name, bank_reference, entry_type, department_source, description, amount, currency, etims_ref, recorded_by)
             VALUES ($1,$2,UPPER($3),$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
            [b.entry_date, b.account_name.trim(), b.bank_reference.trim(), b.entry_type, b.department_source,
                b.description.trim(), amount, currency, etims || null, req.user.id]
        );
        res.status(201).json({ message: 'Bank entry recorded as unreconciled.', id: result.rows[0].id });
    } catch (error) {
        if (error.code === '23505') return res.status(409).json({ error: 'This bank reference has already been recorded.' });
        console.error('Failed to record bank entry:', error);
        res.status(500).json({ error: 'Failed to record bank entry.' });
    }
});

module.exports = router;
