const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('./config/jwtSecret')();
if (process.env.EMAIL_MFA_ENABLED && !['true', 'false'].includes(process.env.EMAIL_MFA_ENABLED)) {
    throw new Error('EMAIL_MFA_ENABLED must be true or false.');
}

const authRoutes = require('./routes/authRoutes');
const hrRoutes = require('./routes/hrRoutes');
const hrPayrollRoutes = require('./routes/hrpayrollRoutes');
const truckRoutes = require('./routes/truckRoutes');
const tripRoutes = require('./routes/tripRoutes');
const payrollRoutes = require('./routes/payrollRoutes');
const depotRoutes = require('./routes/depotRoutes');
const garageRoutes = require('./routes/garageRoutes');
const sharedWorkbenchRoutes = require('./routes/sharedWorkbenchRoutes');
const legacyGarageRoutes = require('./routes/legacyGarageRoutes');
const preArrivalRoutes = require('./routes/preArrivalRoutes');
const fleetControlRoutes = require('./routes/fleetControlRoutes');
const controlFinanceRoutes = require('./routes/controlFinanceRoutes');
const privateUploadRoutes = require('./routes/privateUploadRoutes');
const aiRoutes = require('./routes/aiRoutes');
const { authMiddleware, requireRole } = require('./middleware/authMiddleware');
const pool = require('./config/db');

const app = express();
if (process.env.TRUST_PROXY_CIDRS) {
    app.set('trust proxy', process.env.TRUST_PROXY_CIDRS.split(',').map((entry) => entry.trim()).filter(Boolean));
}
app.use(cors());
app.use('/api/garage/ai', authMiddleware, requireRole('Admin', 'Mechanic'), express.json({ limit: '10mb' }), aiRoutes);
app.use(express.json());

app.get('/health', async (_req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'ok' });
    } catch (error) {
        console.error('Health check failed:', error);
        res.status(503).json({ status: 'unavailable' });
    }
});
app.use('/uploads', privateUploadRoutes);

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/hr', hrPayrollRoutes);
app.use('/api/trucks', truckRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/depot', depotRoutes);
app.use('/api/garage', garageRoutes);
app.use('/api/garage', sharedWorkbenchRoutes);
app.use('/api/garage', legacyGarageRoutes);
app.use('/api/control', preArrivalRoutes);
app.use('/api/control', fleetControlRoutes);
app.use('/api/control', controlFinanceRoutes);

app.use((error, _req, res, next) => {
    if (!(error instanceof multer.MulterError)) return next(error);
    if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Document must be 10 MB or smaller.' });
    return res.status(400).json({ error: 'Invalid document upload.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Difan Logistics backend running on port ${PORT}`);
});