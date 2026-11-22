const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const mailer = require('../utils/mfaEmail');

process.env.JWT_SECRET = 'test-secret-for-isolated-authentication-tests';
process.env.EMAIL_MFA_ENABLED = 'true';

test('staff email MFA issues a session only once after a valid code', async (t) => {
    const client = await pool.connect();
    await client.query(`
        CREATE TEMP TABLE users (
            id integer PRIMARY KEY, username text, email text, password_hash text, role text,
            company_name text, onboarding_status text
        );
        CREATE TEMP TABLE auth_sessions (id uuid PRIMARY KEY, user_id integer, expires_at timestamptz, revoked_at timestamptz, mfa_verified boolean DEFAULT false);
        CREATE TEMP TABLE login_attempt_windows (key_hash text PRIMARY KEY, started_at timestamptz DEFAULT now(), attempts integer NOT NULL);
        CREATE TEMP TABLE email_mfa_challenges (
            id uuid PRIMARY KEY, user_id integer, email text, code_hash text, expires_at timestamptz,
            attempts integer DEFAULT 0, consumed_at timestamptz
        );
    `);
    await client.query('INSERT INTO users VALUES (1,$1,$2,$3,$4,NULL,$5)', ['staff', 'staff@example.test', await bcrypt.hash('test-password-only', 4), 'Admin', 'Active']);
    const originalQuery = pool.query;
    const originalConnect = pool.connect;
    const originalSend = mailer.sendCode;
    let deliveredCode;
    mailer.sendCode = async (_email, code) => { deliveredCode = code; };
    pool.query = client.query.bind(client);
    pool.connect = async () => ({ query: client.query.bind(client), release() {} });
    const app = express();
    app.use(express.json());
    app.use('/auth', require('../routes/authRoutes'));
    app.get('/protected', require('../middleware/authMiddleware').verifyToken, (_req, res) => res.status(204).end());
    const server = await new Promise((resolve) => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    t.after(async () => {
        await new Promise((resolve) => server.close(resolve));
        mailer.sendCode = originalSend;
        pool.query = originalQuery;
        pool.connect = originalConnect;
        client.release();
        await pool.end();
    });
    const root = `http://127.0.0.1:${server.address().port}/auth`;
    async function post(path, body) {
        const response = await fetch(root + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
        return { status: response.status, data: await response.json() };
    }
    const start = () => post('/login', { username: 'staff', password: 'test-password-only' });
    const verify = (challenge, code) => post('/verify-email-code', { challenge_id: challenge, code });
    const challenge = await start();
    assert.equal(challenge.status, 200);
    assert.equal(challenge.data.mfa_required, true);
    assert.equal(challenge.data.token, undefined);
    const wrong = deliveredCode === '000000' ? '000001' : '000000';
    assert.equal((await verify(challenge.data.challenge_id, wrong)).status, 403);
    const accepted = await verify(challenge.data.challenge_id, deliveredCode);
    assert.equal(accepted.status, 200);
    assert.ok(accepted.data.token);
    assert.equal((await client.query('SELECT mfa_verified FROM auth_sessions')).rows[0].mfa_verified, true);
    const protectedResponse = await fetch(`http://127.0.0.1:${server.address().port}/protected`, {
        headers: { authorization: `Bearer ${accepted.data.token}` }
    });
    assert.equal(protectedResponse.status, 204);
    assert.equal((await verify(challenge.data.challenge_id, deliveredCode)).status, 403);

    const locked = await start();
    for (let i = 0; i < 5; i++) {
        const invalid = deliveredCode === '000000' ? '000001' : '000000';
        assert.equal((await verify(locked.data.challenge_id, invalid)).status, 403);
    }
    assert.equal((await verify(locked.data.challenge_id, deliveredCode)).status, 403);
    const changed = await start();
    await client.query("UPDATE users SET email = 'changed@example.test' WHERE id = 1");
    assert.equal((await verify(changed.data.challenge_id, deliveredCode)).status, 403);
    mailer.sendCode = async () => { throw new Error('test delivery failure'); };
    assert.equal((await start()).status, 503);
});
