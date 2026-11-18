const bcrypt = require('bcrypt');
const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (!user || !await bcrypt.compare(password, user.password_hash)) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        if (user.onboarding_status && user.onboarding_status !== 'Active') {
            return res.status(403).json({ error: `Account is ${user.onboarding_status}. Contact HR.` });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, company_name: user.company_name },
            process.env.JWT_SECRET || 'super-secret-key-change-me',
            { expiresIn: '8h' }
        );

        res.json({
            token,
            role: user.role,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                company_name: user.company_name
            }
        });
    } catch (error) {
        console.error('Login failed:', error);
        res.status(500).json({ error: 'Server error during login.' });
    }
});

router.get('/manufacturers', verifyToken, async (_req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, username, company_name
             FROM users
             WHERE role = 'Manufacturer'
             ORDER BY username`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Failed to fetch manufacturers:', error);
        res.status(500).json({ error: 'Server error fetching manufacturers.' });
    }
});

router.get(
    '/users',
    verifyToken,
    requireRole('Admin', 'Dispatcher', 'FleetManager'),
    async (_req, res) => {
        try {
            const result = await pool.query(
                `SELECT id, username, role, company_name
                 FROM users
                 WHERE role IN ('Driver', 'Manufacturer')
                 ORDER BY username`
            );
            res.json(result.rows);
        } catch (error) {
            console.error('Failed to fetch dashboard users:', error);
            res.status(500).json({ error: 'Server error fetching dashboard users.' });
        }
    }
);

module.exports = router;
