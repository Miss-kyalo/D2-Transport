const test = require('node:test');
const assert = require('node:assert/strict');
const { validateIso6346, evaluateReleaseEligibility } = require('./depotCompliance');

test('validates ISO 6346 check digits and normalizes input', () => {
    assert.equal(validateIso6346(' csqu3054383 ').valid, true);
    assert.equal(validateIso6346('CSQU3054384').valid, false);
    assert.equal(validateIso6346('invalid').valid, false);
    assert.equal(validateIso6346(' csqu3054383 ').normalized, 'CSQU3054383');
});

test('reports exact release blockers until customs and cleaning are cleared', () => {
    const container = { customs_hold: true, kebs_hold: false, condition_status: 'Sound', cleaning_status: 'Pending', kephis_cleared: false };
    assert.deepEqual(evaluateReleaseEligibility(container), {
        allowed: false,
        blockers: ['Active KRA Customs hold on container.', 'Container has not completed sweeping/cleaning.']
    });
    assert.deepEqual(evaluateReleaseEligibility({ ...container, customs_hold: false, cleaning_status: 'Swept_Clean' }), { allowed: true, blockers: [] });
    assert.equal(evaluateReleaseEligibility({ ...container, customs_hold: false, cleaning_status: 'unknown' }).allowed, false);
});

test('enforces requested sanitization and KEPHIS clearance', () => {
    const container = { condition_status: 'Sound', cleaning_status: 'Swept_Clean', kephis_cleared: false };
    assert.deepEqual(evaluateReleaseEligibility(container, { requireSanitized: true, requireKephis: true }).blockers, [
        'Washed/Sanitized or Fumigated status required before release.',
        'KEPHIS phytosanitary/biosecurity clearance required before release.'
    ]);
});
