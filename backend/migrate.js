require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs/promises');
const path = require('path');
const pool = require('./config/db');

async function migrate() {
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

    for (const [filename, name] of migrations) {
        const sql = await fs.readFile(path.join(__dirname, 'migrations', filename), 'utf8');
        await pool.query(sql);
        console.log(`${name} migration applied.`);
    }
}

migrate()
    .catch((err) => {
        console.error('Database migrations failed:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
