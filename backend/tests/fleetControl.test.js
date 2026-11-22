const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { mockSessions } = require('./helpers/auth');
const pool = require('../config/db');
process.env.JWT_SECRET = 'test-secret-for-isolated-authentication-tests';

test('mileage and fuel retain valid readings, enforce roles and do not claim verification', async (t) => {
    const client = await pool.connect();
    await client.query(`
        CREATE TEMP TABLE trucks (id integer PRIMARY KEY, plate_number text);
        CREATE TEMP TABLE trips (id integer PRIMARY KEY, truck_id integer, tracking_code text, origin text, destination text, status text);
        CREATE TEMP TABLE daily_fleet_mileage (
            id serial PRIMARY KEY, log_date date, truck_id integer REFERENCES trucks(id),
            opening_km numeric(12,1), closing_km numeric(12,1),
            distance_km numeric GENERATED ALWAYS AS (closing_km - opening_km) STORED,
            yard_status text, recorded_by integer, UNIQUE(log_date, truck_id)
        );
        CREATE TEMP TABLE fuel_reconciliations (
            id serial PRIMARY KEY, fuel_date date, truck_id integer REFERENCES trucks(id), trip_id integer REFERENCES trips(id),
            station_name text, card_reference text, etims_invoice_no text, litres numeric, price_per_litre numeric,
            total_amount numeric, odometer_reading numeric, km_since_last_fill numeric, km_per_litre numeric,
            audit_status text, flag_reason text, recorded_by integer
        );
        INSERT INTO trucks VALUES (1, 'TEST-1'), (2, 'TEST-2');
        INSERT INTO trips VALUES (1, 1, 'TRIP-1', 'A', 'B', 'In-Transit');
    `);
    const originalQuery = pool.query;
    const originalConnect = pool.connect;
    pool.query = client.query.bind(client);
    const createToken = mockSessions();
    pool.connect = async () => ({ query: client.query.bind(client), release() {} });
    const app = express();
    app.use(express.json());
    app.use('/control', require('../routes/fleetControlRoutes'));
    const server = await new Promise((resolve) => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    t.after(async () => {
        await new Promise((resolve) => server.close(resolve));
        pool.query = originalQuery;
        pool.connect = originalConnect;
        client.release();
        await pool.end();
    });
    async function call(path, role, method = 'GET', body) {
        const token = createToken(1, role);
        const response = await fetch(`http://127.0.0.1:${server.address().port}/control${path}`, {
            method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body)
        });
        return { status: response.status, data: await response.json() };
    }
    const mileage = { log_date: '2026-11-22', entries: [{ truck_id: 1, opening_km: 100, closing_km: 120, yard_status: 'On Corridor' }] };
    assert.equal((await call('/mileage/mass-release', 'Boss', 'POST', mileage)).status, 403);
    assert.equal((await call('/mileage/mass-release', 'Admin', 'POST', { ...mileage, entries: [{ ...mileage.entries[0], closing_km: 99 }] })).status, 400);
    assert.equal((await call('/mileage/mass-release', 'Admin', 'POST', mileage)).status, 201);
    const rows = (await call('/mileage/daily?date=2026-11-22', 'Boss')).data.rows;
    assert.equal(Number(rows[0].distance_km), 20);
    assert.equal(rows[1].opening_km, null);
    const fuel = { fuel_date: '2026-11-22', truck_id: 1, trip_id: 1, station_name: 'Station', card_reference: 'CARD', etims_invoice_no: 'INV', litres: 10, price_per_litre: 100 };
    assert.equal((await call('/fuel/reconcile', 'Boss', 'POST', fuel)).status, 403);
    assert.equal((await call('/fuel/reconcile', 'Admin', 'POST', { ...fuel, truck_id: 2 })).status, 400);
    assert.equal((await call('/fuel/reconcile', 'Admin', 'POST', { ...fuel, litres: 0 })).status, 400);
    const saved = await call('/fuel/reconcile', 'Admin', 'POST', fuel);
    assert.equal(saved.status, 201);
    assert.equal(saved.data.record.audit_status, 'Unverified');
    const flagged = await call('/fuel/reconcile', 'Admin', 'POST', { ...fuel, trip_id: '', etims_invoice_no: '' });
    assert.equal(flagged.data.record.audit_status, 'Flagged');
    assert.match(flagged.data.record.flag_reason, /Missing eTIMS/);
});
