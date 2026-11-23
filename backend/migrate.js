require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { createHash } = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const pool = require('./config/db');

const migrations = [
        ['005_depot_compliance.sql', 'Depot'],
        ['006_garage.sql', 'Garage'],
        ['007_mpesa_payments.sql', 'M-Pesa payments'],
        ['008_idempotency.sql', 'Garage idempotency'],
        ['009_hr_payroll_qr_audit.sql', 'HR payroll audit and QR verification'],
        ['010_shared_workbench.sql', 'Shared workbench parts requests'],
        ['012_driver_alerts_boss.sql', 'Driver alerts and Boss role'],
        ['013_fleet_mileage_fuel.sql', 'Fleet mileage and fuel records'],
        ['014_control_bank_ledger.sql', 'Control bank ledger'],
        ['015_login_throttle.sql', 'Login throttling'],
        ['016_auth_sessions.sql', 'Revocable authentication sessions'],
        ['017_email_mfa.sql', 'Email MFA challenges'],
        ['018_workbench_issue_cost.sql', 'Workbench issued parts costs']
];

function quoteIdentifier(value) {
    return `"${value.replaceAll('"', '""')}"`;
}

async function provisionRuntimeRole(client) {
    const roleName = process.env.APP_DB_USER;
    const password = process.env.APP_DB_PASSWORD;
    if (!roleName || !password) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('APP_DB_USER and APP_DB_PASSWORD must be configured in production.');
        }
        return;
    }
    const minimumPasswordLength = process.env.NODE_ENV === 'production' ? 32 : 16;
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(roleName) || password.length < minimumPasswordLength) {
        throw new Error(`APP_DB_USER must be a valid PostgreSQL role name and APP_DB_PASSWORD must be at least ${minimumPasswordLength} characters.`);
    }

    const { rows: [databaseIdentity] } = await client.query(
        `SELECT current_user, current_database(), format(
            CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1)
                 THEN 'ALTER ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD %L'
                 ELSE 'CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD %L'
            END, $1, $2) AS role_statement`,
        [roleName, password]
    );
    if (databaseIdentity.current_user === roleName) {
        throw new Error('The application runtime role must be distinct from the migration role.');
    }

    await client.query(databaseIdentity.role_statement);
    const role = quoteIdentifier(roleName);
    const migrator = quoteIdentifier(databaseIdentity.current_user);
    const database = quoteIdentifier(databaseIdentity.current_database);
    await client.query(`GRANT CONNECT ON DATABASE ${database} TO ${role}`);
    await client.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${role}`);
    await client.query(`GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO ${role}`);
    await client.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${migrator} IN SCHEMA public
         GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${role}`
    );
    await client.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${migrator} IN SCHEMA public
         GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO ${role}`
    );
    console.log(`Runtime database role ${roleName} provisioned with application data privileges.`);
}

async function migrate(databasePool = pool) {
    const client = await databasePool.connect();
    let locked = false;
    try {
        await client.query('SELECT pg_advisory_lock($1)', [724105918]);
        locked = true;
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                filename TEXT PRIMARY KEY,
                checksum TEXT NOT NULL,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        for (const [filename, name] of migrations) {
            const sql = await fs.readFile(path.join(__dirname, 'migrations', filename), 'utf8');
            const checksum = createHash('sha256').update(sql).digest('hex');
            const alreadyApplied = await client.query(
                'SELECT checksum FROM schema_migrations WHERE filename = $1',
                [filename]
            );
            if (alreadyApplied.rowCount) {
                if (alreadyApplied.rows[0].checksum !== checksum) {
                    throw new Error(`Applied migration ${filename} was modified; add a new migration instead.`);
                }
                continue;
            }

            await client.query('BEGIN');
            try {
                await client.query(sql);
                await client.query(
                    'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)',
                    [filename, checksum]
                );
                await client.query('COMMIT');
                console.log(`${name} migration applied.`);
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            }
        }
        await provisionRuntimeRole(client);
    } finally {
        if (locked) {
            try {
                await client.query('SELECT pg_advisory_unlock($1)', [724105918]);
            } catch (error) {
                console.error('Failed to release migration lock:', error);
            }
        }
        client.release();
        await databasePool.end();
    }
}

if (require.main === module) {
    migrate().catch((err) => {
        console.error('Database migrations failed:', err.message);
        process.exitCode = 1;
    });
}

module.exports = { migrations, migrate, provisionRuntimeRole };
