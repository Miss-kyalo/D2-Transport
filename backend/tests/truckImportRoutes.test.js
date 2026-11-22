const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { mockSessions } = require('./helpers/auth');
const ExcelJS = require('exceljs');
const pool = require('../config/db');
process.env.JWT_SECRET = 'test-secret-for-isolated-authentication-tests';

test('import requires fleet access and rejects existing plates without inserting', async (t) => {
    const originalConnect = pool.connect;
    const originalQuery = pool.query;
    const createToken = mockSessions();
    const queries = [];
    let existingPlates = [{ plate: 'KAA 123A' }];
    pool.connect = async () => ({
        async query(sql) {
            queries.push(sql);
            if (sql.startsWith('SELECT UPPER')) return { rows: existingPlates };
            return { rows: [] };
        },
        release() {}
    });
    const app = express();
    app.use('/trucks', require('../routes/truckRoutes'));
    const server = await new Promise((resolve) => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    t.after(async () => {
        pool.connect = originalConnect;
        pool.query = originalQuery;
        await new Promise((resolve) => server.close(resolve));
        await pool.end();
    });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Trucks');
    sheet.addRow(['plate_number', 'model', 'capacity_tons']);
    sheet.addRow(['KAA 123A', 'Truck', 30]);
    const bytes = await workbook.xlsx.writeBuffer();
    const upload = () => {
        const form = new FormData();
        form.append('workbook', new Blob([bytes]), 'trucks.xlsx');
        return form;
    };
    const url = `http://127.0.0.1:${server.address().port}/trucks/import`;
    const token = (role) => createToken(1, role);

    const forbidden = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token('Driver')}` }, body: upload() });
    assert.equal(forbidden.status, 403);
    assert.deepEqual(queries, []);

    const duplicate = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token('Admin')}` }, body: upload() });
    assert.equal(duplicate.status, 409);
    assert.match((await duplicate.json()).errors[0], /Row 2.*already exists/);
    assert.ok(queries.includes('ROLLBACK'));
    assert.ok(!queries.some((sql) => sql.includes('INSERT INTO trucks')));

    queries.length = 0;
    existingPlates = [];
    const success = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token('FleetManager')}` }, body: upload() });
    assert.equal(success.status, 201);
    assert.equal((await success.json()).count, 1);
    assert.ok(queries.some((sql) => sql.includes('INSERT INTO trucks')));
    assert.ok(queries.includes('COMMIT'));
});
