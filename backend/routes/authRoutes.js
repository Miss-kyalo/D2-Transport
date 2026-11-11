const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Register Endpoint
router.post('/register', async (req, res) => {
    try {
        const { username, password, role } = req.body;
        const validRoles = ['Driver', 'Admin', 'Client'];
        
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: "Invalid role specified." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const query = `INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role;`;
        const result = await pool.query(query, [username, hashedPassword, role]);
        
        res.status(201).json({ message: "User registered successfully", user: result.rows[0] });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: "Username already taken." });
        }
        console.error(err);
        res.status(500).json({ error: "Server error during registration." });
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

        res.json({ message: "Login successful", token, role: user.role });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error during login." });
    }
});

module.exports = router;