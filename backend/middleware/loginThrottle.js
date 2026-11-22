const { createHash } = require('crypto');
const pool = require('../config/db');

const WINDOW_SECONDS = 15 * 60;

async function consume(key) {
    const keyHash = createHash('sha256').update(key).digest('hex');
    const result = await pool.query(
        `INSERT INTO login_attempt_windows (key_hash, started_at, attempts)
         VALUES ($1, NOW(), 1)
         ON CONFLICT (key_hash) DO UPDATE
         SET attempts = CASE WHEN login_attempt_windows.started_at <= NOW() - ($2 * INTERVAL '1 second')
                             THEN 1 ELSE login_attempt_windows.attempts + 1 END,
             started_at = CASE WHEN login_attempt_windows.started_at <= NOW() - ($2 * INTERVAL '1 second')
                               THEN NOW() ELSE login_attempt_windows.started_at END
         RETURNING attempts, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (started_at + ($2 * INTERVAL '1 second') - NOW()))))::int AS retry_after`,
        [keyHash, WINDOW_SECONDS]
    );
    return result.rows[0];
}

async function loginThrottle(req, res, next) {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase().slice(0, 100) : '';
    try {
        const address = req.ip || req.socket.remoteAddress;
        if (!address) return res.status(503).json({ error: 'Login temporarily unavailable.' });
        const ipWindow = await consume(`ip:${address}`);
        if (ipWindow.attempts === 1) {
            await pool.query("DELETE FROM login_attempt_windows WHERE started_at < NOW() - INTERVAL '1 day'");
        }
        if (ipWindow.attempts > 100) {
            res.set('Retry-After', String(ipWindow.retry_after));
            return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
        }
        const accountWindow = await consume(`account:${address}:${username}`);
        if (accountWindow.attempts > 20) {
            res.set('Retry-After', String(accountWindow.retry_after));
            return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
        }
        return next();
    } catch (error) {
        console.error('Login throttling failed:', error);
        return res.status(503).json({ error: 'Login temporarily unavailable.' });
    }
}

module.exports = loginThrottle;
