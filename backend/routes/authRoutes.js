const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// Register Endpoint
router.post('/register', async (req, res) => {
    try {
        const { username, password, role, company_name } = req.body;
        const validRoles = ['Driver', 'Admin', 'Manufacturer', 'Client'];
        
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: "Invalid role specified." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        const query = `
            INSERT INTO users (username, password, role, company_name) 
            VALUES ($1, $2, $3, $4) 
            RETURNING id, username, role, company_name;
        `;
        const result = await pool.query(query, [username, hashedPassword, role, company_name || username]);
        
        res.status(201).json({ message: "User registered successfully", user: result.rows[0] });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: "Username already taken." });
        }
        console.error("Registration Error:", err);
        res.status(500).json({ error: "Server error during registration.", details: err.message });
    }
});

// Login Endpoint
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: "Invalid credentials." });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid credentials." });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, company_name: user.company_name },
            process.env.JWT_SECRET || 'super-secret-key-change-me',
            { expiresIn: '8h' }
        );

        res.json({ 
            message: "Login successful", 
            token, 
            role: user.role, 
            user: { id: user.id, username: user.username, role: user.role, company_name: user.company_name } 
        });
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ error: "Server error during login.", details: err.message });
    }
});

// GET /api/auth/manufacturers (Protected)
router.get('/manufacturers', verifyToken, async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, username, company_name FROM users WHERE role = 'Manufacturer' ORDER BY username ASC"
        );
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching manufacturers:", err.message);
        res.status(500).json({ error: 'Server error fetching manufacturers' });
    }
});

// GET /api/auth/users (Admin Only)
router.get('/users', verifyToken, requireRole('Admin'), async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, username, role, company_name FROM users WHERE role IN ('Driver', 'Manufacturer') ORDER BY username ASC"
        );
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching dashboard users:", err);
        res.status(500).json({ error: 'Server error fetching dashboard users.' });
    }
});

module.exports = router;