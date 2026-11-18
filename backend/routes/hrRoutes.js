const bcrypt = require('bcrypt');
const express = require('express');
const pool = require('../config/db');
const upload = require('../middleware/uploadMiddleware');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();
const hrAccess = [verifyToken, requireRole('HR', 'Admin')];

router.post('/onboard-user', ...hrAccess, async (req, res) => {
    const {
        username,
        email,
        password,
        role,
        company_name,
        phone_number,
        allowed_accounts_modules = [],
        basic_pay = 0,
        housing_allowance = 0,
        off_pay = 0,
        bank_account_number,
        bank_branch_code
    } = req.body;

    if (!username || !email || !password || !role || !phone_number) {
        return res.status(400).json({
            error: 'Username, email, password, role, and phone number are required.'
        });
    }

    try {
        const passwordHash = await bcrypt.hash(password, 10);
        const initialStatus = ['Manufacturer', 'Client', 'SpotClient'].includes(role)
            ? 'Active'
            : 'Pending_HR';
        const result = await pool.query(
            `INSERT INTO users (
                username, email, password_hash, role, company_name, phone_number,
                onboarding_status, allowed_accounts_modules, basic_pay, housing_allowance,
                off_pay, bank_account_number, bank_branch_code
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             RETURNING id, username, email, role, phone_number, onboarding_status`,
            [
                username,
                email,
                passwordHash,
                role,
                company_name || null,
                phone_number,
                initialStatus,
                JSON.stringify(allowed_accounts_modules),
                basic_pay,
                housing_allowance,
                off_pay,
                bank_account_number || null,
                bank_branch_code || null
            ]
        );
        res.status(201).json({ message: 'Account provisioned.', user: result.rows[0] });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Username, email, or phone number is already registered.' });
        }
        console.error('Failed to provision user:', error);
        res.status(500).json({ error: 'Server error provisioning account.' });
    }
});

router.post('/users/:userId/documents', ...hrAccess, upload.single('document'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Document file is required.' });
    }

    const { userId } = req.params;
    const { doc_type, doc_number, expiry_date, is_verified } = req.body;
    if (!doc_type || !doc_number) {
        return res.status(400).json({ error: 'Document type and number are required.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const document = await client.query(
            `INSERT INTO employee_documents (
                user_id, doc_type, doc_number, file_url, expiry_date, is_verified, verified_by
             ) VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (user_id, doc_type) DO UPDATE SET
                doc_number = EXCLUDED.doc_number,
                file_url = EXCLUDED.file_url,
                expiry_date = EXCLUDED.expiry_date,
                is_verified = EXCLUDED.is_verified,
                verified_by = EXCLUDED.verified_by,
                uploaded_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [
                userId,
                doc_type,
                doc_number,
                `/uploads/${req.file.filename}`,
                expiry_date || null,
                is_verified === true || is_verified === 'true',
                req.user.id
            ]
        );

        const verifiedDocuments = await client.query(
            `SELECT COUNT(DISTINCT doc_type) AS count
             FROM employee_documents
             WHERE user_id = $1
               AND is_verified = TRUE
               AND doc_type IN ('KRA_PIN', 'NSSF', 'SHA')`,
            [userId]
        );
        const activated = Number(verifiedDocuments.rows[0].count) === 3;

        if (activated) {
            await client.query(
                `UPDATE users SET onboarding_status = 'Active' WHERE id = $1`,
                [userId]
            );
        }

        await client.query('COMMIT');
        res.json({
            document: document.rows[0],
            accountActivated: activated
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Failed to save employee document:', error);
        res.status(500).json({ error: 'Server error saving employee document.' });
    } finally {
        client.release();
    }
});

router.get('/compliance-audit', ...hrAccess, async (_req, res) => {
    try {
        const result = await pool.query(
            `SELECT u.id, u.username, u.role, u.phone_number, u.onboarding_status,
                    COALESCE(json_agg(json_build_object(
                        'doc_type', d.doc_type,
                        'doc_number', d.doc_number,
                        'is_verified', d.is_verified,
                        'expiry_date', d.expiry_date
                    )) FILTER (WHERE d.id IS NOT NULL), '[]') AS documents
             FROM users u
             LEFT JOIN employee_documents d ON d.user_id = u.id
             WHERE u.role NOT IN ('Manufacturer', 'Client', 'SpotClient')
             GROUP BY u.id
             ORDER BY u.username`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Failed to run compliance audit:', error);
        res.status(500).json({ error: 'Server error loading compliance audit.' });
    }
});

module.exports = router;
