function jwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret || !secret.trim()) throw new Error('JWT_SECRET must be configured.');
    if (process.env.NODE_ENV === 'production' && (secret.length < 32 || secret === 'super-secret-key-change-me')) {
        throw new Error('Production JWT_SECRET must be at least 32 characters and must not be the default.');
    }
    return secret;
}

module.exports = jwtSecret;
