const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { mockSessions } = require('./helpers/auth');
const pool = require('../config/db');

test('HR onboarding inserts aligned fields, normalizes identity, and enforces password/role policy', async (t) => {
    process.env.JWT_SECRET = 'test-secret-for-isolated-authentication-tests';
    const token = mockSessions();
    const authenticatedQuery = pool.query;
    const inserts = [];
    const profileUpdates = [];
    pool.query = async (sql, values) => {
        if (sql.includes('INSERT INTO users')) {
            inserts.push({ sql, values });
            return {
                rows: [{
                    id: 21,
                    username: values[0],
                    email: values[1],
                    role: values[3],
                    phone_number: values[5],
                    onboarding_status: values[6]
                }]
            };
        }
        if (sql.includes('UPDATE users')) {
            profileUpdates.push({ sql, values });
            return { rows: [{ id: values[13], basic_pay: values[8] }] };
        }
        return authenticatedQuery.call(pool, sql, values);
    };

    const app = express();
    app.use(express.json());
    app.use('/hr', require('../routes/hrRoutes'));
    app.use('/hr', require('../routes/hrpayrollRoutes'));
    const server = await new Promise((resolve) => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    t.after(async () => {
        await new Promise((resolve) => server.close(resolve));
        pool.query = authenticatedQuery;
    });
    const url = `http://127.0.0.1:${server.address().port}/hr/onboard-user`;
    const auth = { authorization: `Bearer ${token(1, 'HR')}`, 'content-type': 'application/json' };
    const base = {
        username: '  new.employee ',
        email: ' New.Employee@Example.com ',
        password: 'a-safe-passphrase-2026',
        role: 'PayrollAccountant',
        phone_number: '  +254700000021 ',
        allowed_accounts_modules: []
    };

    const created = await fetch(url, { method: 'POST', headers: auth, body: JSON.stringify(base) });
    assert.equal(created.status, 201);
    const result = await created.json();
    assert.equal(result.user.username, 'new.employee');
    assert.equal(result.user.email, 'new.employee@example.com');
    assert.equal(inserts.length, 1);
    assert.equal(inserts[0].values.length, 10);
    assert.equal([...inserts[0].sql.matchAll(/\$\d+/g)].length, 10);
    assert.equal(inserts[0].values[3], 'PayrollAccountant');
    assert.equal(inserts[0].values[6], 'Pending_HR');

    for (const invalid of [
        { ...base, password: 'short' },
        { ...base, password: 'x'.repeat(73) },
        { ...base, role: 'SuperAdmin' },
        { ...base, email: 'not-an-email' },
        { ...base, allowed_accounts_modules: 'all' }
    ]) {
        const response = await fetch(url, { method: 'POST', headers: auth, body: JSON.stringify(invalid) });
        assert.equal(response.status, 400);
    }
    assert.equal(inserts.length, 1);

    const accountant = { authorization: `Bearer ${token(2, 'PayrollAccountant')}`, 'content-type': 'application/json' };
    const profilePayload = { basic_pay: 1000, housing_allowance: 100, off_day_rate: 20 };
    const validProfile = await fetch(`http://127.0.0.1:${server.address().port}/hr/profiles/21`, {
        method: 'PUT',
        headers: accountant,
        body: JSON.stringify(profilePayload)
    });
    assert.equal(validProfile.status, 200);
    assert.equal(profileUpdates.length, 1);
    for (const invalid of [
        { basic_pay: -1 },
        { basic_pay: 'not-money' },
        { basic_pay: 10_000_000_000 },
        { license_expiry: '2026-02-30' }
    ]) {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/hr/profiles/21`, {
            method: 'PUT',
            headers: accountant,
            body: JSON.stringify(invalid)
        });
        assert.equal(response.status, 400);
    }
    assert.equal(profileUpdates.length, 1);

    for (const invalid of [
        { user_id: 21, payroll_month: '2026-13', salary_advance: 0 },
        { user_id: 21, payroll_month: '2026-02', salary_advance: -1 }
    ]) {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/hr/payroll/run`, {
            method: 'POST',
            headers: accountant,
            body: JSON.stringify(invalid)
        });
        assert.equal(response.status, 400);
    }
});
