const bcrypt = require('bcrypt');
const express = require('express');
const jwt = require('jsonwebtoken');
const { randomUUID, randomInt, createHmac, timingSafeEqual } = require('crypto');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const jwtSecret = require('../config/jwtSecret');
const loginThrottle = require('../middleware/loginThrottle');
const mfaEmail = require('../utils/mfaEmail');

const router = express.Router();
const externalRoles = ['Manufacturer', 'Client', 'SpotClient'];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function codeHash(id, code) {
    return createHmac('sha256', jwtSecret()).update(`${id}:${code}`).digest('hex');
}

async function createSession(user, database = pool, mfaVerified = false) {
    const sessionId = randomUUID();
    const token = jwt.sign({ id: user.id, sid: sessionId }, jwtSecret(), { expiresIn: '8h', algorithm: 'HS256' });
    await database.query(
        `INSERT INTO auth_sessions (id, user_id, expires_at, mfa_verified) VALUES ($1, $2, NOW() + INTERVAL '8 hours', $3)`,
        [sessionId, user.id, mfaVerified]
    );
    return {
        token, role: user.role,
        user: { id: user.id, username: user.username, role: user.role, company_name: user.company_name }
    };
}

router.post('/login', loginThrottle, async (req, res) => {
    const { username, password } = req.body;
    if (typeof username !== 'string' || !username.trim() || username.length > 100 ||
        typeof password !== 'string' || !password || password.length > 1024) {
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

        if (process.env.EMAIL_MFA_ENABLED === 'true' && !externalRoles.includes(user.role)) {
            if (typeof user.email !== 'string' || !user.email.trim()) {
                return res.status(403).json({ error: 'Contact HR to register an email address before signing in.' });
            }
            const challengeId = randomUUID();
            const code = String(randomInt(0, 1000000)).padStart(6, '0');
            await pool.query(
                `INSERT INTO email_mfa_challenges (id, user_id, email, code_hash, expires_at)
                 VALUES ($1, $2, $3, $4, NOW() + INTERVAL '10 minutes')`,
                [challengeId, user.id, user.email, codeHash(challengeId, code)]
            );
            try {
                await mfaEmail.sendCode(user.email, code);
            } catch (error) {
                console.error('MFA email delivery failed:', error.message);
                try {
                    await pool.query('UPDATE email_mfa_challenges SET consumed_at = NOW() WHERE id = $1', [challengeId]);
                } catch (cleanupError) {
                    console.error('Failed to invalidate undelivered MFA challenge:', cleanupError);
                }
                return res.status(503).json({ error: 'Could not deliver the sign-in code. Contact your administrator.' });
            }
            return res.json({ mfa_required: true, challenge_id: challengeId });
        }
        res.json(await createSession(user));
    } catch (error) {
        console.error('Login failed:', error);
        res.status(500).json({ error: 'Server error during login.' });
    }
});

router.post('/verify-email-code', async (req, res) => {
    const { challenge_id: challengeId, code } = req.body;
    if (typeof challengeId !== 'string' || !uuidPattern.test(challengeId) || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
        return res.status(400).json({ error: 'A valid sign-in challenge and six-digit code are required.' });
    }
    let client;
    try {
        const attempted = await pool.query(
            `UPDATE email_mfa_challenges SET attempts = attempts + 1
             WHERE id = $1 AND consumed_at IS NULL AND expires_at > NOW() AND attempts < 5
             RETURNING code_hash`,
            [challengeId]
        );
        if (!attempted.rowCount) return res.status(403).json({ error: 'Invalid or expired sign-in code.' });
        const storedHash = Buffer.from(attempted.rows[0].code_hash, 'hex');
        const expectedHash = Buffer.from(codeHash(challengeId, code), 'hex');
        if (storedHash.length !== expectedHash.length || !timingSafeEqual(storedHash, expectedHash)) {
            return res.status(403).json({ error: 'Invalid or expired sign-in code.' });
        }
        client = await pool.connect();
        await client.query('BEGIN');
        const result = await client.query(
            `UPDATE email_mfa_challenges c SET consumed_at = NOW()
             FROM users u WHERE c.id = $1 AND c.user_id = u.id AND c.consumed_at IS NULL
               AND c.expires_at > NOW() AND c.email = u.email
               AND (u.onboarding_status IS NULL OR u.onboarding_status = 'Active')
             RETURNING u.id, u.username, u.role, u.company_name`,
            [challengeId]
        );
        if (!result.rowCount) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Invalid or expired sign-in code.' });
        }
        const session = await createSession(result.rows[0], client, true);
        await client.query('COMMIT');
        return res.json(session);
    } catch (error) {
        if (client) {
            try { await client.query('ROLLBACK'); } catch (rollbackError) { console.error('MFA rollback failed:', rollbackError); }
        }
        console.error('MFA verification failed:', error);
        return res.status(503).json({ error: 'Could not verify the sign-in code.' });
    } finally {
        if (client) client.release();
    }
});

router.post('/logout', verifyToken, async (req, res) => {
    try {
        await pool.query('UPDATE auth_sessions SET revoked_at = NOW() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL', [req.user.session_id, req.user.id]);
        res.json({ message: 'Session revoked.' });
    } catch (error) {
        console.error('Logout failed:', error);
        res.status(503).json({ error: 'Could not revoke session. Please try again.' });
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
