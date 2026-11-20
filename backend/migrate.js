require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs/promises');
const path = require('path');
const pool = require('./config/db');

async function migrate() {
    const sql = await fs.readFile(path.join(__dirname, 'migrations/005_depot_compliance.sql'), 'utf8');
    await pool.query(sql);
    console.log('Depot migration applied.');
}

migrate()
    .catch((err) => {
        console.error('Depot migration failed:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
