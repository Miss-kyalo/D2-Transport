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
        ['009_hr_payroll_qr_audit.sql', 'HR payroll audit and QR verification']
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
