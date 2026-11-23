const cors = require('cors');

function configuredOrigins() {
    const rawOrigins = process.env.CORS_ORIGINS;
    if (rawOrigins === undefined || rawOrigins.trim() === '') {
        return process.env.NODE_ENV === 'production'
            ? []
            : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175',
                'http://127.0.0.1:5173', 'http://127.0.0.1:5174', 'http://127.0.0.1:5175'];
    }

    return [...new Set(rawOrigins.split(',').map((entry) => {
        const origin = entry.trim();
        let parsed;
        try {
            parsed = new URL(origin);
        } catch {
            throw new Error('CORS_ORIGINS must contain comma-separated HTTP(S) origins.');
        }
        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) {
            throw new Error('CORS_ORIGINS must contain only exact HTTP(S) origins.');
        }
        return origin;
    }))];
}

function createCorsMiddleware() {
    const origins = configuredOrigins();
    return cors({
        origin(origin, callback) {
            callback(null, !origin || origins.includes(origin));
        },
        methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Authorization', 'Content-Type'],
        maxAge: 600
    });
}

module.exports = { configuredOrigins, createCorsMiddleware };
