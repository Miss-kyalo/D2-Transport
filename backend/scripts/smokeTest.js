const pool = require('../config/db');
const { validateIso6346, evaluateReleaseEligibility } = require('../utils/depotCompliance');

async function runSmokeCheck() {
    console.log('--- D2-Transport Smoke & Compliance Check ---');

    // 1. Verify ISO 6346 check-digit validator
    const sampleIso = validateIso6346('MSCU5284910');
    console.log('ISO 6346 Check (MSCU5284910):', sampleIso);

    // 2. Verify Gate-Out blocker logic for held/uncleaned containers
    const blockedCheck = evaluateReleaseEligibility({
        customs_hold: true,
        kebs_hold: false,
        condition_status: 'Sound',
        cleaning_status: 'Pending',
        kephis_cleared: false
    }, { requireSanitized: true, requireKephis: true });
    console.log('Blocked Gate-Out Check:', blockedCheck);

    const allowedCheck = evaluateReleaseEligibility({
        customs_hold: false,
        kebs_hold: false,
        condition_status: 'Sound',
        cleaning_status: 'Washed_Sanitized',
        kephis_cleared: true
    }, { requireSanitized: true, requireKephis: true });
    console.log('Cleared Gate-Out Check:', allowedCheck);

    // 3. Verify core PostgreSQL tables exist
    const tablesRes = await pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
    `);
    console.log('Public Tables:', tablesRes.rows.map((r) => r.table_name));
    await pool.end();
}

runSmokeCheck().catch(async (err) => {
    console.error('Smoke test failed:', err.message);
    await pool.end().catch(() => {});
    process.exit(1);
});