require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const { Pool } = require('pg');

const poolConfig = {};
if (process.env.DATABASE_URL) {
    poolConfig.connectionString = process.env.DATABASE_URL;
}
if (process.env.PGSSL === 'true') {
    poolConfig.ssl = {
        rejectUnauthorized: true,
        ...(process.env.PGSSL_CA ? { ca: fs.readFileSync(process.env.PGSSL_CA, 'utf8') } : {})
    };
}

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL pool error:', err);
});

module.exports = pool;