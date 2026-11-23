const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { mockSessions } = require('./helpers/auth');
const pool = require('../config/db');

test('legacy payroll data remains readable by its owner while all legacy mutations are disabled', async (t) => {
    process.env.JWT_SECRET = 'test-secret-for-isolated-authentication-tests';
    const originalQuery = pool.query;
    const statements = [];
    pool.query = async (sql, values) => {
        if (sql.includes('FROM auth_sessions s JOIN users u')) return originalQuery(sql, values);
        statements.push(sql);
        if (sql.includes('FROM driver_payrolls')) {
            return { rows: [{ id: 5, driver_id: values[0], month_year: '2025-12', net_pay: '100.00' }] };
        }
        throw new Error('Unexpected legacy payroll query');
    };
    const tokens = mockSessions();
    const app = express();
    app.use(express.json());
    app.use('/payroll', require('../routes/payrollRoutes'));
    const server = await new Promise((resolve) => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    t.after(async () => {
        await new Promise((resolve) => server.close(resolve));
        pool.query = originalQuery;
    });
    const url = `http://127.0.0.1:${server.address().port}/payroll`;
    const call = (path, role, method = 'GET') => fetch(url + path, {
        method,
        headers: {
            authorization: `Bearer ${tokens(role === 'Driver' ? 7 : 9, role)}`,
            'content-type': 'application/json'
        },
        body: method === 'GET' ? undefined : JSON.stringify({ driver_id: 7, month_year: '2025-12' })
    });

    const history = await call('/my-payslips', 'Driver');
    assert.equal(history.status, 200);
    assert.equal((await history.json())[0].driver_id, 7);
    assert.match(statements[0], /WHERE driver_id = \$1/);
    assert.equal((await call('/generate', 'PayrollAccountant', 'POST')).status, 410);
    assert.equal((await call('/5/acknowledge', 'Driver', 'PATCH')).status, 410);
    assert.equal((await call('/5/release', 'Accounts_Payable', 'PATCH')).status, 410);
    assert.equal((await call('/generate', 'Admin', 'POST')).status, 403);
    assert.equal(statements.length, 1);
});
