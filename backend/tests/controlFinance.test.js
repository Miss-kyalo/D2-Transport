const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { mockSessions } = require('./helpers/auth');
const pool = require('../config/db');
process.env.JWT_SECRET = 'test-secret-for-isolated-authentication-tests';

test('finance overview and bank entry respect role boundaries and stay unreconciled', async (t) => {
    const client = await pool.connect();
    await client.query(`
        CREATE TEMP TABLE users (id integer PRIMARY KEY, username text);
        CREATE TEMP TABLE trips (id integer PRIMARY KEY, tracking_code text);
        CREATE TEMP TABLE invoices (id integer PRIMARY KEY, amount_kes numeric, status text, issued_date timestamp, due_date timestamp, trip_id integer, client_id integer);
        CREATE TEMP TABLE bank_ledger_entries (
            id serial PRIMARY KEY, entry_date date, account_name text, bank_reference text UNIQUE, entry_type text,
            department_source text, description text, amount numeric(14,2), currency text, etims_ref text,
            reconciled boolean DEFAULT false, recorded_by integer, created_at timestamp DEFAULT now()
        );
    `);
    const originalQuery = pool.query;
    pool.query = client.query.bind(client);
    const createToken = mockSessions();
    const app = express();
    app.use(express.json());
    app.use('/control', require('../routes/controlFinanceRoutes'));
    const server = await new Promise((resolve) => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    t.after(async () => {
        await new Promise((resolve) => server.close(resolve));
        pool.query = originalQuery;
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
    const entry = { entry_date: '2026-11-22', account_name: 'Bank', bank_reference: 'REF-1', entry_type: 'DEBIT', department_source: 'GARAGE', description: 'Parts', amount: '25.50', currency: 'KES', etims_ref: '' };
    assert.equal((await call('/finance/overview', 'Storekeeper')).status, 403);
    assert.equal((await call('/finance/bank-ledger', 'PayrollAccountant', 'POST', entry)).status, 403);
    assert.equal((await call('/finance/bank-ledger', 'Boss', 'POST', { ...entry, amount: -1 })).status, 400);
    assert.equal((await call('/finance/bank-ledger', 'Accounts_Payable', 'POST', entry)).status, 201);
    assert.equal((await call('/finance/bank-ledger', 'Boss', 'POST', entry)).status, 409);
    const data = (await call('/finance/overview', 'Boss')).data;
    assert.equal(data.bank_entries.length, 1);
    assert.equal(data.bank_entries[0].reconciled, false);
});
