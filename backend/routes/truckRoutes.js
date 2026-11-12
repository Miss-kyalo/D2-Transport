const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

router.use(verifyToken, requireRole('Admin'));

// Get all trucks
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM trucks ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching trucks:", err);
        res.status(500).json({ error: "Server error fetching trucks.", details: err.message });
    }
});

// Add a new truck (Admin use)
router.post('/', async (req, res) => {
    try {
        const { plate_number, model, capacity_tons } = req.body;

        if (!plate_number || !model || !capacity_tons) {
            return res.status(400).json({ error: "All truck fields are required." });
        }

        const query = `
            INSERT INTO trucks (plate_number, model, capacity_tons, status) 
            VALUES ($1, $2, $3, 'Available') 
            RETURNING *;
        `;
        const result = await pool.query(query, [plate_number, model, capacity_tons]);
        
        res.status(201).json({ message: "Truck added successfully", truck: result.rows[0] });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: "Truck plate number already exists." });
        }
        console.error("Error adding truck:", err);
        res.status(500).json({ error: "Server error adding truck.", details: err.message });
    }
});

module.exports = router;