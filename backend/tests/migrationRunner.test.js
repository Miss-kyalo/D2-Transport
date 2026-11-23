const test = require('node:test');
const assert = require('node:assert/strict');
const { migrations, migrate } = require('../migrate');

function fakePool({ preapplied = new Map() } = {}) {
    const applied = new Map(preapplied);
    const calls = [];
    let released = false;
    let ended = false;
    const client = {
        async query(sql, values = []) {
            calls.push({ sql, values });
            if (sql.includes('SELECT checksum FROM schema_migrations')) {
                const checksum = applied.get(values[0]);
                return checksum === undefined ? { rowCount: 0, rows: [] } : { rowCount: 1, rows: [{ checksum }] };
            }
            if (sql.includes('INSERT INTO schema_migrations')) {
                applied.set(values[0], values[1]);
            }
            return { rowCount: 0, rows: [] };
        },
        release() { released = true; }
    };
    return {
        applied,
        calls,
        state: () => ({ released, ended }),
        async connect() { return client; },
        async end() { ended = true; }
    };
}

test('migrations are applied once under one advisory lock and checksummed', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalRole = process.env.APP_DB_USER;
    const originalPassword = process.env.APP_DB_PASSWORD;
    process.env.NODE_ENV = 'test';
    delete process.env.APP_DB_USER;
    delete process.env.APP_DB_PASSWORD;
    const database = fakePool();
    try {
        await migrate(database);
        assert.equal(database.applied.size, migrations.length);
        assert.equal(database.calls.filter(({ sql }) => sql === 'BEGIN').length, migrations.length);
        assert.equal(database.calls.filter(({ sql }) => sql === 'COMMIT').length, migrations.length);
        assert.equal(database.calls.filter(({ sql }) => sql.includes('pg_advisory_lock(')).length, 1);
        assert.equal(database.calls.filter(({ sql }) => sql.includes('pg_advisory_unlock(')).length, 1);
        assert.deepEqual(database.state(), { released: true, ended: true });

        const secondRun = fakePool({ preapplied: database.applied });
        await migrate(secondRun);
        assert.equal(secondRun.calls.filter(({ sql }) => sql === 'BEGIN').length, 0);
    } finally {
        if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = originalNodeEnv;
        if (originalRole === undefined) delete process.env.APP_DB_USER;
        else process.env.APP_DB_USER = originalRole;
        if (originalPassword === undefined) delete process.env.APP_DB_PASSWORD;
        else process.env.APP_DB_PASSWORD = originalPassword;
    }
});

test('migration runner rejects a changed applied file and releases the lock', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalRole = process.env.APP_DB_USER;
    const originalPassword = process.env.APP_DB_PASSWORD;
    process.env.NODE_ENV = 'test';
    delete process.env.APP_DB_USER;
    delete process.env.APP_DB_PASSWORD;
    const database = fakePool({ preapplied: new Map([[migrations[0][0], 'incorrect-checksum']]) });
    try {
        await assert.rejects(migrate(database), /was modified/);
        assert.equal(database.calls.filter(({ sql }) => sql.includes('pg_advisory_unlock(')).length, 1);
        assert.deepEqual(database.state(), { released: true, ended: true });
    } finally {
        if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = originalNodeEnv;
        if (originalRole === undefined) delete process.env.APP_DB_USER;
        else process.env.APP_DB_USER = originalRole;
        if (originalPassword === undefined) delete process.env.APP_DB_PASSWORD;
        else process.env.APP_DB_PASSWORD = originalPassword;
    }
});
