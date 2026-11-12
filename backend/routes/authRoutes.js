const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Dummy or actual authenticateToken middleware reference
// (Make sure this points to your real middleware file or import)
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access token required' });

    jwt.verify(token, process.env.JWT_SECRET || 'super-secret-key-change-me', (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token' });
        req.user = user;
        next();
    });
};

// Register Endpoint
router.post('/register', async (req, res) => {
    try {
        const { username, password, role, company_name } = req.body;
        const validRoles = ['Driver', 'Admin', 'Manufacturer', 'Client'];
        
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: "Invalid role specified." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Adjust based on whether your DB uses 'username' or 'name'
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
            { id: user.id, username: user.username, role: user.role },
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

// GET /api/auth/manufacturers (Protected with Admin/Auth middleware)
router.get('/manufacturers', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, username, company_name FROM users WHERE role = 'Manufacturer' ORDER BY username ASC"
        );
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching manufacturers:", err.message);
        res.status(500).json({ message: 'Server error fetching manufacturers' });
    }
});

module.exports = router;