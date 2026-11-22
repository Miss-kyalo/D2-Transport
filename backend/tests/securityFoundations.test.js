const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const express = require('express');
const { mockSessions } = require('./helpers/auth');
const pool = require('../config/db');
const jwtSecret = require('../config/jwtSecret');

test('JWT secrets are required and production rejects weak defaults', () => {
    const originalSecret = process.env.JWT_SECRET;
    const originalEnv = process.env.NODE_ENV;
    try {
        delete process.env.JWT_SECRET;
        assert.throws(jwtSecret, /must be configured/);
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = 'short';
        assert.throws(jwtSecret, /at least 32/);
        process.env.JWT_SECRET = 'test-secret-for-isolated-authentication-tests';
        assert.equal(jwtSecret(), process.env.JWT_SECRET);
    } finally {
        if (originalSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = originalSecret;
        if (originalEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = originalEnv;
    }
});

test('uploaded records require authentication and record-specific authorization', async (t) => {
    process.env.JWT_SECRET = 'test-secret-for-isolated-authentication-tests';
    const filename = `security-test-${randomUUID()}.txt`;
    const file = path.join(__dirname, '../uploads', filename);
    const depotFile = path.join(__dirname, '../uploads/depot', filename);
    const tripFilename = `security-trip-${randomUUID()}.txt`;
    const tripFile = path.join(__dirname, '../uploads', tripFilename);
    const truckFilename = `security-truck-${randomUUID()}.txt`;
    const truckFile = path.join(__dirname, '../uploads', truckFilename);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.mkdir(path.dirname(depotFile), { recursive: true });
    for (const target of [file, depotFile, tripFile, truckFile]) {
        await fs.writeFile(target, 'private document', { flag: 'wx' });
        t.after(() => fs.unlink(target));
    }
    const client = await pool.connect();
    await client.query(`
        CREATE TEMP TABLE employee_documents (user_id integer, file_url text);
        CREATE TEMP TABLE truck_compliance_docs (cloud_file_url text);
        CREATE TEMP TABLE trips (driver_id integer, delivery_note_url text);
        CREATE TEMP TABLE depot_licenses (document_url text);
    `);
    await client.query('INSERT INTO employee_documents VALUES ($1, $2)', [1, `/uploads/${filename}`]);
    await client.query('INSERT INTO depot_licenses VALUES ($1)', [`/uploads/depot/${filename}`]);
    await client.query('INSERT INTO trips VALUES ($1, $2)', [1, `/uploads/${tripFilename}`]);
    await client.query('INSERT INTO truck_compliance_docs VALUES ($1)', [`/uploads/${truckFilename}`]);
    const originalQuery = pool.query;
    pool.query = client.query.bind(client);
    const token = mockSessions();
    const app = express();
    app.use('/uploads', require('../routes/privateUploadRoutes'));
    const server = await new Promise((resolve) => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    t.after(async () => {
        await new Promise((resolve) => server.close(resolve));
        pool.query = originalQuery;
        client.release();
        await pool.end();
    });
    const url = `http://127.0.0.1:${server.address().port}/uploads/${filename}`;
    async function get(id, role, target = url) {
        return fetch(target, { headers: { authorization: `Bearer ${token(id, role)}` } });
    }
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await get(2, 'Mechanic')).status, 404);
    assert.equal((await get(2, 'FleetManager')).status, 404);
    const owner = await get(1, 'Driver');
    assert.equal(owner.status, 200);
    assert.match(owner.headers.get('content-disposition'), /^attachment/);
    assert.equal(owner.headers.get('cache-control'), 'private, no-store');
    assert.equal(await owner.text(), 'private document');
    assert.equal((await get(2, 'HR')).status, 200);
    const root = `http://127.0.0.1:${server.address().port}/uploads`;
    assert.equal((await get(1, 'Driver', `${root}/${tripFilename}`)).status, 200);
    assert.equal((await get(2, 'Driver', `${root}/${tripFilename}`)).status, 404);
    assert.equal((await get(2, 'FleetManager', `${root}/${truckFilename}`)).status, 200);
    assert.equal((await get(2, 'Mechanic', `${root}/${truckFilename}`)).status, 404);
    assert.equal((await get(2, 'Accounts_Receivable', `${root}/depot/${filename}`)).status, 200);
    assert.equal((await get(2, 'Driver', `${root}/depot/${filename}`)).status, 404);
});
