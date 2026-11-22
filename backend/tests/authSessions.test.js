const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

process.env.JWT_SECRET = 'test-secret-for-isolated-authentication-tests';

test('login sessions use current account permissions and logout revokes the token', async (t) => {
    const client = await pool.connect();
    await client.query(`
        CREATE TEMP TABLE users (
            id integer PRIMARY KEY, username text, password_hash text, role text,
            company_name text, onboarding_status text
        );
        CREATE TEMP TABLE auth_sessions (
            id uuid PRIMARY KEY, user_id integer, expires_at timestamptz, revoked_at timestamptz, mfa_verified boolean DEFAULT false
        );
        CREATE TEMP TABLE login_attempt_windows (
            key_hash text PRIMARY KEY, started_at timestamptz DEFAULT now(), attempts integer NOT NULL
        );
    `);
    await client.query('INSERT INTO users VALUES (1, $1, $2, $3, NULL, $4)', ['staff', await bcrypt.hash('test-password-only', 4), 'Admin', 'Active']);
    const originalQuery = pool.query;
    pool.query = client.query.bind(client);
    const app = express();
    app.use(express.json());
    app.use('/auth', require('../routes/authRoutes'));
    const { verifyToken, requireRole } = require('../middleware/authMiddleware');
    app.get('/admin', verifyToken, requireRole('Admin'), (_req, res) => res.status(204).end());
    const server = await new Promise((resolve) => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    t.after(async () => {
        await new Promise((resolve) => server.close(resolve));
        pool.query = originalQuery;
        client.release();
        await pool.end();
    });
    const root = `http://127.0.0.1:${server.address().port}`;
    const request = (path, token, method = 'GET', body) => fetch(root + path, {
        method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const login = async () => {
        const response = await request('/auth/login', null, 'POST', { username: 'staff', password: 'test-password-only' });
        assert.equal(response.status, 200);
        return (await response.json()).token;
    };
    const old = jwt.sign({ id: 1, role: 'Admin' }, process.env.JWT_SECRET);
    assert.equal((await request('/admin', old)).status, 403);
    const token = await login();
    assert.equal((await request('/admin', token)).status, 204);
    process.env.EMAIL_MFA_ENABLED = 'true';
    assert.equal((await request('/admin', token)).status, 403);
    delete process.env.EMAIL_MFA_ENABLED;
    await client.query("UPDATE users SET role = 'Driver' WHERE id = 1");
    assert.equal((await request('/admin', token)).status, 403);
    await client.query("UPDATE users SET role = 'Admin' WHERE id = 1");
    assert.equal((await request('/auth/logout', token, 'POST')).status, 200);
    assert.equal((await request('/admin', token)).status, 403);
    const another = await login();
    await client.query("UPDATE users SET onboarding_status = 'Suspended' WHERE id = 1");
    assert.equal((await request('/admin', another)).status, 403);
});
