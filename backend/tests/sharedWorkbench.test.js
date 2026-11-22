const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { mockSessions } = require('./helpers/auth');
const pool = require('../config/db');
process.env.JWT_SECRET = 'test-secret-for-isolated-authentication-tests';

test('shared parts require storekeeper approval and issue stock once', async (t) => {
    const client = await pool.connect();
    await client.query(`
        CREATE TEMP TABLE garage_work_orders (id integer PRIMARY KEY, status text, driver_id integer, assigned_mechanic_id integer, billing_currency text, parts_cost numeric(12,2), total_estimate numeric(12,2));
        CREATE TEMP TABLE inventory_items (id bigint PRIMARY KEY, part_name text, sku text, qty_on_hand integer, qty_reserved integer, unit_cost numeric(12,2));
        CREATE TEMP TABLE users (id integer PRIMARY KEY, username text, role text);
        CREATE TEMP TABLE garage_part_requests (
            id bigserial PRIMARY KEY, work_order_id integer, item_id bigint, qty integer,
            status text DEFAULT 'Pending', requested_by integer, reviewed_by integer, issued_by integer,
            created_at timestamptz DEFAULT now(), reviewed_at timestamptz, issued_at timestamptz,
            unit_cost_at_issue numeric(12,2)
        );
        CREATE TEMP TABLE stock_movements (item_id bigint, work_order_id integer, movement_type text, qty integer, actor_name text);
        INSERT INTO garage_work_orders VALUES (1, 'Open', NULL, NULL, 'KES', 100, 150), (2, 'Open', NULL, NULL, 'USD', 0, 0);
        INSERT INTO inventory_items VALUES (1, 'Fuel filter', 'FLT-1', 5, 0, 25.50);
        INSERT INTO users VALUES (1, 'mechanic', 'Mechanic'), (2, 'storekeeper', 'Storekeeper'), (3, 'driver', 'Driver');
    `);
    const realConnect = pool.connect;
    const realQuery = pool.query;
    pool.connect = async () => ({ query: client.query.bind(client), release() {} });
    pool.query = client.query.bind(client);
    const token = mockSessions();
    const app = express();
    app.use(express.json());
    app.use('/garage', require('../routes/sharedWorkbenchRoutes'));
    app.use('/garage', require('../routes/garageRoutes'));
    const server = await new Promise((resolve) => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    t.after(async () => {
        await new Promise((resolve) => server.close(resolve));
        pool.connect = realConnect;
        pool.query = realQuery;
        client.release();
        await pool.end();
    });
    const url = `http://127.0.0.1:${server.address().port}/garage`;
    const mechanic = token(1, 'Mechanic', 'mechanic');
    const keeper = token(2, 'Storekeeper', 'storekeeper');
    async function call(path, auth, method, body) {
        const response = await fetch(url + path, {
            method,
            headers: { authorization: `Bearer ${auth}`, 'content-type': 'application/json' },
            body: JSON.stringify(body)
        });
        return { status: response.status, data: await response.json() };
    }

    assert.equal((await call('/shared-workbench/1/assignment', mechanic, 'PATCH', { driver_id: 3, mechanic_id: 1 })).status, 200);
    assert.equal((await call('/shared-workbench/1/assignment', mechanic, 'PATCH', { driver_id: 1, mechanic_id: 3 })).status, 400);
    assert.deepEqual((await client.query('SELECT driver_id, assigned_mechanic_id FROM garage_work_orders WHERE id = 1')).rows[0], { driver_id: 3, assigned_mechanic_id: 1 });
    const created = await call('/shared-workbench/1/parts', mechanic, 'POST', { item_id: 1, qty: 2 });
    assert.equal(created.status, 201);
    const id = created.data.request.id;
    assert.equal((await call(`/shared-workbench/parts/${id}`, mechanic, 'PATCH', { action: 'reserve' })).status, 403);
    assert.equal((await call('/work-orders/1', mechanic, 'PATCH', { status: 'Completed' })).status, 409);
    assert.equal((await call(`/shared-workbench/parts/${id}`, keeper, 'PATCH', { action: 'issue' })).status, 409);
    assert.equal((await call(`/shared-workbench/parts/${id}`, keeper, 'PATCH', { action: 'reserve' })).status, 200);
    let stock = (await client.query('SELECT qty_on_hand, qty_reserved FROM inventory_items WHERE id = 1')).rows[0];
    assert.deepEqual(stock, { qty_on_hand: 5, qty_reserved: 2 });
    assert.equal((await call(`/shared-workbench/parts/${id}`, keeper, 'PATCH', { action: 'issue' })).status, 200);
    assert.equal((await call(`/shared-workbench/parts/${id}`, keeper, 'PATCH', { action: 'issue' })).status, 409);
    stock = (await client.query('SELECT qty_on_hand, qty_reserved FROM inventory_items WHERE id = 1')).rows[0];
    assert.deepEqual(stock, { qty_on_hand: 3, qty_reserved: 0 });
    const cost = (await client.query('SELECT parts_cost, total_estimate FROM garage_work_orders WHERE id = 1')).rows[0];
    assert.deepEqual(cost, { parts_cost: '151.00', total_estimate: '201.00' });
    assert.equal((await client.query('SELECT unit_cost_at_issue FROM garage_part_requests WHERE id = $1', [id])).rows[0].unit_cost_at_issue, '25.50');
    assert.equal((await call('/work-orders/1', mechanic, 'PATCH', { parts_cost: 100, expected_parts_cost: 100 })).status, 409);
    const movements = (await client.query('SELECT movement_type, qty FROM stock_movements ORDER BY ctid')).rows;
    assert.deepEqual(movements, [{ movement_type: 'RESERVED', qty: 2 }, { movement_type: 'ISSUED', qty: 2 }]);

    const tooMany = await call('/shared-workbench/1/parts', mechanic, 'POST', { item_id: 1, qty: 4 });
    assert.equal((await call(`/shared-workbench/parts/${tooMany.data.request.id}`, keeper, 'PATCH', { action: 'reserve' })).status, 409);
    assert.equal((await call(`/shared-workbench/parts/${tooMany.data.request.id}`, keeper, 'PATCH', { action: 'reject' })).status, 200);

    const another = await call('/shared-workbench/1/parts', mechanic, 'POST', { item_id: 1, qty: 1 });
    assert.equal((await call(`/shared-workbench/parts/${another.data.request.id}`, keeper, 'PATCH', { action: 'reserve' })).status, 200);
    assert.equal((await call(`/shared-workbench/parts/${another.data.request.id}`, keeper, 'PATCH', { action: 'reject' })).status, 200);
    stock = (await client.query('SELECT qty_on_hand, qty_reserved FROM inventory_items WHERE id = 1')).rows[0];
    assert.deepEqual(stock, { qty_on_hand: 3, qty_reserved: 0 });
    assert.equal((await client.query("SELECT COUNT(*) FROM stock_movements WHERE movement_type = 'RELEASED'")).rows[0].count, '1');
    const foreign = await call('/shared-workbench/2/parts', mechanic, 'POST', { item_id: 1, qty: 1 });
    assert.equal((await call(`/shared-workbench/parts/${foreign.data.request.id}`, keeper, 'PATCH', { action: 'reserve' })).status, 200);
    assert.equal((await call(`/shared-workbench/parts/${foreign.data.request.id}`, keeper, 'PATCH', { action: 'issue' })).status, 409);
    assert.deepEqual((await client.query('SELECT qty_on_hand, qty_reserved FROM inventory_items WHERE id = 1')).rows[0], { qty_on_hand: 3, qty_reserved: 1 });
});
