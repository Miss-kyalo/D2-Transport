require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const assert = require('node:assert/strict');
const pool = require('../config/db');
const { validateIso6346, evaluateReleaseEligibility } = require('../utils/depotCompliance');

async function runSmokeCheck() {
    console.log('--- Difan Logistics Smoke & Compliance Check ---');

    // 1. Verify ISO 6346 check-digit validator
    const sampleIso = validateIso6346('CSQU3054383');
    assert.equal(sampleIso.valid, true);
    console.log('ISO 6346 Check (CSQU3054383):', sampleIso);

    // 2. Verify Gate-Out blocker logic for held/uncleaned containers
    const blockedCheck = evaluateReleaseEligibility({
        customs_hold: true,
        kebs_hold: false,
        condition_status: 'Sound',
        cleaning_status: 'Pending',
        kephis_cleared: false
    }, { requireSanitized: true, requireKephis: true });
    assert.deepEqual(blockedCheck.blockers, [
        'Active KRA Customs hold on container.',
        'Container has not completed sweeping/cleaning.',
        'Washed/Sanitized or Fumigated status required before release.',
        'KEPHIS phytosanitary/biosecurity clearance required before release.'
    ]);
    assert.equal(blockedCheck.allowed, false);
    console.log('Blocked Gate-Out Check:', blockedCheck);

    const allowedCheck = evaluateReleaseEligibility({
        customs_hold: false,
        kebs_hold: false,
        condition_status: 'Sound',
        cleaning_status: 'Washed_Sanitized',
        kephis_cleared: true
    }, { requireSanitized: true, requireKephis: true });
    assert.equal(allowedCheck.allowed, true);
    assert.deepEqual(allowedCheck.blockers, []);
    console.log('Cleared Gate-Out Check:', allowedCheck);

    // 3. Verify core PostgreSQL tables exist
    const tablesRes = await pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
    `);
    console.log('Public Tables:', tablesRes.rows.map((r) => r.table_name));
    const tableNames = new Set(tablesRes.rows.map((row) => row.table_name));
    for (const table of ['containers', 'container_inspections', 'container_movements', 'depot_licenses']) {
        assert.ok(tableNames.has(table), `Missing depot table: ${table}`);
    }
    await pool.end();
}

runSmokeCheck().catch(async (err) => {
    console.error('Smoke test failed:', err.message);
    await pool.end().catch(() => {});
    process.exit(1);
});