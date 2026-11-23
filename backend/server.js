const express = require('express');
const helmet = require('helmet');
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
const { createCorsMiddleware } = require('./config/corsPolicy');

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY_CIDRS) {
    const trustedProxies = process.env.TRUST_PROXY_CIDRS.split(',').map((entry) => entry.trim()).filter(Boolean);
    if (trustedProxies.length === 0) throw new Error('TRUST_PROXY_CIDRS must contain at least one address or CIDR.');
    app.set('trust proxy', trustedProxies);
}
app.use(helmet({ contentSecurityPolicy: false, frameguard: { action: 'deny' } }));
app.use(createCorsMiddleware());
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
    if (res.headersSent) return next(error);
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Document must be 10 MB or smaller.' });
        return res.status(400).json({ error: 'Invalid document upload.' });
    }
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON request.' });
    console.error('Unhandled request error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
});

app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found.' });
});

const PORT = Number(process.env.PORT || 5000);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) throw new Error('PORT must be a valid TCP port.');
const server = app.listen(PORT, () => {
    console.log(`🚀 Difan Logistics backend running on port ${PORT}`);
});

let shuttingDown = false;
function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received; stopping HTTP server.`);
    const timeout = setTimeout(() => {
        console.error('Graceful shutdown timed out; closing active HTTP connections.');
        server.closeAllConnections();
    }, 10000);
    timeout.unref();
    server.close(async (error) => {
        clearTimeout(timeout);
        if (error) {
            console.error('HTTP server shutdown failed:', error);
            process.exitCode = 1;
        }
        try {
            await pool.end();
        } catch (poolError) {
            console.error('Database pool shutdown failed:', poolError);
            process.exitCode = 1;
        }
        const socialsAuditRoutes = require('./routes/socialsAuditRoutes');
app.use('/api/audit-socials', socialsAuditRoutes);
    });
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));