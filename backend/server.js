const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const authRoutes = require('./routes/authRoutes');
const hrRoutes = require('./routes/hrRoutes');
const truckRoutes = require('./routes/truckRoutes');
const tripRoutes = require('./routes/tripRoutes');
const payrollRoutes = require('./routes/payrollRoutes');
const depotRoutes = require('./routes/depotRoutes');
const pool = require('./config/db');

const app = express();
app.use(express.json());
app.use(cors());

app.get('/health', async (_req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'ok' });
    } catch (error) {
        console.error('Health check failed:', error);
        res.status(503).json({ status: 'unavailable' });
    }
});
// Serve uploaded documents statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/trucks', truckRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/depot', depotRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 D2-Transport Enterprise ERP backend running on port ${PORT}`);
});