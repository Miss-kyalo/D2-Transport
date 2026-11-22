const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const pool = require('../config/db');

test('login throttle is atomic, resets expired windows and fails closed on database errors', async (t) => {
    const client = await pool.connect();
    await client.query(`CREATE TEMP TABLE login_attempt_windows (
        key_hash text PRIMARY KEY, started_at timestamptz NOT NULL DEFAULT now(),
        attempts integer NOT NULL CHECK (attempts > 0)
    )`);
    const originalQuery = pool.query;
    pool.query = client.query.bind(client);
    const app = express();
    app.use(express.json());
    app.post('/login', require('../middleware/loginThrottle'), (_req, res) => res.status(204).end());
    const server = await new Promise((resolve) => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    t.after(async () => {
        await new Promise((resolve) => server.close(resolve));
        pool.query = originalQuery;
        client.release();
        await pool.end();
    });
    const url = `http://127.0.0.1:${server.address().port}/login`;
    const call = () => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'test-user' }) });
    const responses = await Promise.all(Array.from({ length: 21 }, call));
    assert.equal(responses.filter((response) => response.status === 204).length, 20);
    const blocked = responses.find((response) => response.status === 429);
    assert.ok(blocked);
    assert.ok(Number(blocked.headers.get('retry-after')) > 0);
    await client.query("UPDATE login_attempt_windows SET started_at = NOW() - INTERVAL '16 minutes'");
    assert.equal((await call()).status, 204);
    pool.query = async () => { throw new Error('test database unavailable'); };
    assert.equal((await call()).status, 503);
});
