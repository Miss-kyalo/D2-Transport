const bcrypt = require('bcrypt');
const pool = require('../config/db');

const demoAccounts = [
    { username: 'demo_admin', role: 'Admin' },
    { username: 'demo_hr', role: 'HR' },
    { username: 'demo_accounts_payable', role: 'Accounts_Payable' },
    { username: 'demo_accounts_receivable', role: 'Accounts_Receivable' },
    { username: 'demo_dispatcher', role: 'Dispatcher' },
    { username: 'demo_fleet_manager', role: 'FleetManager' },
    { username: 'demo_mechanic', role: 'Mechanic' },
    { username: 'demo_driver', role: 'Driver' },
    { username: 'demo_manufacturer', role: 'Manufacturer', companyName: 'Difan Demo Manufacturer' },
    { username: 'demo_client', role: 'Client', companyName: 'Difan Demo Client' },
    { username: 'demo_spot_client', role: 'SpotClient', companyName: 'Difan Demo Spot Client' }
];

async function seedDemoAccounts() {
    const password = process.env.DEMO_ACCOUNT_PASSWORD;
    if (!password || password.length < 12) {
        throw new Error('Set DEMO_ACCOUNT_PASSWORD to a password of at least 12 characters.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        for (const account of demoAccounts) {
            const email = `${account.username}@demo.d2transport.local`;
            const result = await client.query(
                `INSERT INTO users (
                    username, email, password_hash, role, company_name, onboarding_status
                 ) VALUES ($1, $2, $3, $4, $5, 'Active')
                 ON CONFLICT (username) DO UPDATE SET
                    password_hash = EXCLUDED.password_hash,
                    role = EXCLUDED.role,
                    company_name = EXCLUDED.company_name,
                    phone_number = NULL,
                    onboarding_status = 'Active'
                 WHERE users.email = EXCLUDED.email
                 RETURNING username, role`,
                [
                    account.username,
                    email,
                    passwordHash,
                    account.role,
                    account.companyName || 'Difan Demo Logistics'
                ]
            );

            if (result.rowCount !== 1) {
                throw new Error(`Cannot seed ${account.username}: that username is already in use.`);
            }
        }

        await client.query('COMMIT');
        console.log(`Seeded ${demoAccounts.length} demo accounts. All use the supplied DEMO_ACCOUNT_PASSWORD.`);
        for (const account of demoAccounts) {
            console.log(`${account.username} (${account.role})`);
        }
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

seedDemoAccounts().catch((error) => {
    console.error('Demo account seeding failed:', error.message);
    process.exitCode = 1;
});
