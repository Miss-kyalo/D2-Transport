const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { mockSessions } = require('./helpers/auth');
const pool = require('../config/db');
process.env.JWT_SECRET = 'test-secret-for-isolated-authentication-tests';

test('pre-arrival alerts retain the reporter and reported-for name and enforce roles', async (t) => {
    const client = await pool.connect();
    await client.query(`
        CREATE TEMP TABLE trucks (id integer PRIMARY KEY, plate_number text, model text);
        CREATE TEMP TABLE users (id integer PRIMARY KEY, username text);
        CREATE TEMP TABLE driver_pre_arrival_alerts (
            id serial PRIMARY KEY, truck_id integer, driver_id integer, current_odometer numeric(12,1),
            fault_system varchar(60), driver_description text, requested_spares text,
            reported_for_name varchar(120), status varchar(25) DEFAULT 'Incoming',
            kit_prepared boolean DEFAULT false, prepared_by integer, created_at timestamp DEFAULT now()
        );
        INSERT INTO trucks VALUES (1, 'TEST-1', 'Test model');
        INSERT INTO users VALUES (1, 'reporting-driver'), (2, 'storekeeper');
    `);
    const originalQuery = pool.query;
    pool.query = client.query.bind(client);
    const token = mockSessions();
    const app = express();
    app.use(express.json());
    app.use('/control', require('../routes/preArrivalRoutes'));
    const server = await new Promise((resolve) => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    t.after(async () => {
        await new Promise((resolve) => server.close(resolve));
        pool.query = originalQuery;
        client.release();
        await pool.end();
    });
    const url = `http://127.0.0.1:${server.address().port}/control`;
    async function call(path, role, method = 'GET', body) {
        const response = await fetch(url + path, {
            method,
            headers: { authorization: `Bearer ${token(role === 'Driver' ? 1 : 2, role)}`, 'content-type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body)
        });
        return { status: response.status, data: await response.json() };
    }

    assert.equal((await call('/pre-arrival-trucks', 'Driver')).data.trucks[0].plate_number, 'TEST-1');
    const input = {
        truck_id: 1, current_odometer: '150.5', fault_system: 'Brakes',
        driver_description: 'Air leak', requested_spares: 'Valve', reported_for_name: 'Other driver'
    };
    assert.equal((await call('/pre-arrival-alerts', 'Mechanic', 'POST', input)).status, 403);
    assert.equal((await call('/pre-arrival-alerts', 'Driver', 'POST', { ...input, current_odometer: '' })).status, 400);
    assert.equal((await call('/pre-arrival-alerts', 'Driver', 'POST', { ...input, truck_id: 99 })).status, 404);
    const created = await call('/pre-arrival-alerts', 'Driver', 'POST', input);
    assert.equal(created.status, 201);
    const alerts = await call('/pre-arrival-alerts', 'Mechanic');
    assert.equal(alerts.data.alerts[0].reporter_name, 'reporting-driver');
    assert.equal(alerts.data.alerts[0].reported_for_name, 'Other driver');
    const path = `/pre-arrival-alerts/${created.data.id}/prep`;
    assert.equal((await call(path, 'Mechanic', 'PATCH', {})).status, 403);
    assert.equal((await call(path, 'Storekeeper', 'PATCH', {})).status, 200);
    assert.equal((await call(path, 'Storekeeper', 'PATCH', {})).status, 409);
});

test('Boss can read payroll but cannot change profiles or run payroll', async (t) => {
    const originalQuery = pool.query;
    pool.query = async (sql) => {
        if (sql.includes('FROM users WHERE id')) return { rows: [{ id: 1, name: 'Employee' }] };
        return { rows: [] };
    };
    const token = mockSessions();
    const app = express();
    app.use(express.json());
    app.use('/hr', require('../routes/hrpayrollRoutes'));
    const server = await new Promise((resolve) => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    t.after(async () => {
        await new Promise((resolve) => server.close(resolve));
        pool.query = originalQuery;
    });
    const url = `http://127.0.0.1:${server.address().port}/hr`;
    async function call(path, role, method = 'GET') {
        return fetch(url + path, { method, headers: { authorization: `Bearer ${token(1, role)}`, 'content-type': 'application/json' }, body: method === 'GET' ? undefined : '{}' });
    }
    for (const path of ['/profiles', '/payroll/register?month=2026-01', '/payroll/employee-statement/1?year=2026']) {
        assert.equal((await call(path, 'Boss')).status, 200);
        assert.equal((await call(path, 'Driver')).status, 403);
    }
    assert.equal((await call('/profiles/1', 'Boss', 'PUT')).status, 403);
    assert.equal((await call('/payroll/run', 'Boss', 'POST')).status, 403);
});

test('staff statements use the authenticated user and deny access to others', async (t) => {
    const originalQuery = pool.query;
    const queries = [];
    pool.query = async (sql, values) => {
        queries.push({ sql, values });
        if (sql.includes('FROM users WHERE id')) {
            return { rows: [{ id: values[0], name: 'Employee' }] };
        }
        if (sql.includes('FROM payroll_records')) {
            return { rows: [{ id: 8, user_id: values[0], payroll_month: '2026-03', gross_pay: '1000.00' }] };
        }
        throw new Error('Unexpected query');
    };
    const token = mockSessions();
    const app = express();
    app.use('/hr', require('../routes/hrpayrollRoutes'));
    const server = await new Promise((resolve) => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    t.after(async () => {
        await new Promise((resolve) => server.close(resolve));
        pool.query = originalQuery;
    });
    const url = `http://127.0.0.1:${server.address().port}/hr`;
    const call = (path, auth) => fetch(url + path, { headers: auth ? { authorization: `Bearer ${auth}` } : {} });
    const driver = token(7, 'Driver');
    const response = await call('/payroll/my-statement?year=2026&userId=8', driver);
    assert.equal(response.status, 200);
    const statement = await response.json();
    assert.equal(statement.employee.id, 7);
    assert.equal(statement.records[0].user_id, 7);
    assert.deepEqual(queries[0].values, [7]);
    assert.deepEqual(queries[1].values, [7, '2026-%']);
    assert.equal(statement.ytd.gross_pay, 1000);
    assert.equal((await call('/payroll/my-statement?year=2026%25', driver)).status, 400);
    assert.equal((await call('/payroll/employee-statement/8?year=2026', driver)).status, 403);
    for (const role of ['Client', 'SpotClient', 'Manufacturer']) {
        assert.equal((await call('/payroll/my-statement?year=2026', token(8, role))).status, 403);
    }
    assert.equal((await call('/payroll/my-statement?year=2026')).status, 401);
});
