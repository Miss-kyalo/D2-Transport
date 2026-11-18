const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
    const authorization = req.get('authorization') || '';
    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ error: 'Access token required.' });
    }

    try {
        req.user = jwt.verify(
            token,
            process.env.JWT_SECRET || 'super-secret-key-change-me'
        );
        next();
    } catch {
        res.status(403).json({ error: 'Invalid or expired token.' });
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
    requireRole
};
