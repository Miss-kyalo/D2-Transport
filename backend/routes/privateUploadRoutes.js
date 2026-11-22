const express = require('express');
const path = require('path');
const pool = require('../config/db');
const { verifyToken } = require('../middleware/authMiddleware');

const router = express.Router();
const uploadRoot = path.resolve(__dirname, '../uploads');
router.use(verifyToken);

async function download(req, res, depot) {
    const filename = req.params.filename;
    if (!filename || filename === '.' || filename === '..' || path.basename(filename) !== filename || filename.includes('\\')) {
        return res.status(404).json({ error: 'Document not found.' });
    }
    const url = `/uploads/${depot ? 'depot/' : ''}${filename}`;
    const role = req.user.role;
    try {
        let permitted;
        if (depot) {
            if (!['Admin', 'Dispatcher', 'FleetManager', 'Accounts_Receivable'].includes(role)) {
                return res.status(404).json({ error: 'Document not found.' });
            }
            permitted = await pool.query('SELECT 1 FROM depot_licenses WHERE document_url = $1 LIMIT 1', [url]);
        } else {
            permitted = await pool.query(
                `SELECT 1 WHERE
                    EXISTS (SELECT 1 FROM employee_documents WHERE file_url = $1 AND ($2::boolean OR user_id = $3))
                    OR ($4::boolean AND EXISTS (SELECT 1 FROM truck_compliance_docs WHERE cloud_file_url = $1))
                    OR EXISTS (SELECT 1 FROM trips WHERE delivery_note_url = $1 AND ($5::boolean OR ($6::boolean AND driver_id = $3)))`,
                [url, ['Admin', 'HR'].includes(role), req.user.id, ['Admin', 'FleetManager'].includes(role),
                    ['Admin', 'Dispatcher', 'FleetManager', 'Accounts_Payable', 'Accounts_Receivable'].includes(role), role === 'Driver']
            );
        }
        if (!permitted.rowCount) return res.status(404).json({ error: 'Document not found.' });
        res.set({
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
            'Content-Security-Policy': "default-src 'none'; sandbox"
        });
        return res.download(path.join(uploadRoot, depot ? 'depot' : '', filename), filename, (error) => {
            if (!error) return;
            if (error.code !== 'ENOENT') console.error('Document download failed:', error);
            if (!res.headersSent) res.status(error.code === 'ENOENT' ? 404 : 500).json({ error: 'Document unavailable.' });
        });
    } catch (error) {
        console.error('Document authorization failed:', error);
        return res.status(500).json({ error: 'Failed to access document.' });
    }
}

router.get('/depot/:filename', (req, res) => download(req, res, true));
router.get('/:filename', (req, res) => download(req, res, false));

module.exports = router;
