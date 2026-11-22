const jwt = require('jsonwebtoken');
const jwtSecret = require('../config/jwtSecret');
const pool = require('../config/db');

async function verifyToken(req, res, next) {
    const authorization = req.get('authorization') || '';
    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ error: 'Access token required.' });
    }

    let claims;
    try {
        claims = jwt.verify(
            token,
            jwtSecret(),
            { algorithms: ['HS256'] }
        );
    } catch {
        return res.status(403).json({ error: 'Invalid or expired token.' });
    }

    if (!claims || typeof claims !== 'object' || !Number.isSafeInteger(claims.id) ||
        typeof claims.sid !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(claims.sid)) {
        return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    try {
        const result = await pool.query(
            `SELECT u.id, u.username, u.role, u.company_name
             FROM auth_sessions s JOIN users u ON u.id = s.user_id
             WHERE s.id = $1 AND s.user_id = $2 AND s.revoked_at IS NULL
               AND s.expires_at > NOW() AND (u.onboarding_status IS NULL OR u.onboarding_status = 'Active')
               AND (NOT $3::boolean OR u.role IN ('Manufacturer', 'Client', 'SpotClient') OR s.mfa_verified = TRUE)`,
            [claims.sid, claims.id, process.env.EMAIL_MFA_ENABLED === 'true']
        );
        if (!result.rowCount) return res.status(403).json({ error: 'Invalid or expired token.' });
        req.user = { ...result.rows[0], session_id: claims.sid };
        return next();
    } catch (error) {
        console.error('Session verification failed:', error);
        return res.status(503).json({ error: 'Authentication temporarily unavailable.' });
    }
}

function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: `Access denied. Required role: ${allowedRoles.join(' or ')}.`
            });
        }
        next();
    };
}

module.exports = {
    verifyToken,
    authenticateToken: verifyToken,
    authMiddleware: verifyToken,
    requireRole
};
