const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const helmet = require('helmet');
const { createCorsMiddleware, configuredOrigins } = require('../config/corsPolicy');

test('production CORS requires exact configured browser origins', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalOrigins = process.env.CORS_ORIGINS;
    try {
        process.env.NODE_ENV = 'production';
        delete process.env.CORS_ORIGINS;
        assert.deepEqual(configuredOrigins(), []);
        process.env.CORS_ORIGINS = 'https://app.example.com, https://staff.example.com';
        assert.deepEqual(configuredOrigins(), ['https://app.example.com', 'https://staff.example.com']);
        process.env.CORS_ORIGINS = 'https://app.example.com/path';
        assert.throws(configuredOrigins, /exact HTTP\(S\) origins/);
        process.env.CORS_ORIGINS = 'javascript:alert(1)';
        assert.throws(configuredOrigins, /only exact HTTP\(S\) origins/);
    } finally {
        if (originalEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = originalEnv;
        if (originalOrigins === undefined) delete process.env.CORS_ORIGINS;
        else process.env.CORS_ORIGINS = originalOrigins;
    }
});

test('security middleware permits configured origins and sets standard response headers', async (t) => {
    const originalEnv = process.env.NODE_ENV;
    const originalOrigins = process.env.CORS_ORIGINS;
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGINS = 'https://staff.example.com';
    const app = express();
    app.disable('x-powered-by');
    app.use(helmet({ contentSecurityPolicy: false, frameguard: { action: 'deny' } }));
    app.use(createCorsMiddleware());
    app.get('/resource', (_req, res) => res.json({ ok: true }));
    const server = await new Promise((resolve) => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    t.after(async () => {
        await new Promise((resolve) => server.close(resolve));
        if (originalEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = originalEnv;
        if (originalOrigins === undefined) delete process.env.CORS_ORIGINS;
        else process.env.CORS_ORIGINS = originalOrigins;
    });

    const url = `http://127.0.0.1:${server.address().port}/resource`;
    const allowed = await fetch(url, { headers: { origin: 'https://staff.example.com' } });
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://staff.example.com');
    assert.equal(allowed.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(allowed.headers.get('x-frame-options'), 'DENY');
    assert.equal(allowed.headers.get('x-powered-by'), null);
    const denied = await fetch(url, { headers: { origin: 'https://attacker.example' } });
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
});
