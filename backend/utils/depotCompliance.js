const CHAR_MAP = {
    A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18, I: 19, J: 20,
    K: 21, L: 23, M: 24, N: 25, O: 26, P: 27, Q: 28, R: 29, S: 30, T: 31,
    U: 32, V: 34, W: 35, X: 36, Y: 37, Z: 38
};

function validateIso6346(containerNumber) {
    const clean = String(containerNumber || '').trim().toUpperCase();
    if (!/^[A-Z]{4}\d{7}$/.test(clean)) {
        return { valid: false, normalized: clean, reason: 'Format must be 4 letters followed by 7 digits (ISO 6346).' };
    }

    let sum = 0;
    for (let i = 0; i < 10; i += 1) {
        const ch = clean[i];
        const value = /[A-Z]/.test(ch) ? CHAR_MAP[ch] : Number(ch);
        sum += value * (2 ** i);
    }

    const remainder = sum % 11;
    const expectedCheckDigit = remainder === 10 ? 0 : remainder;
    const actualCheckDigit = Number(clean[10]);

    return {
        valid: expectedCheckDigit === actualCheckDigit,
        normalized: clean,
        expectedCheckDigit,
        reason: expectedCheckDigit === actualCheckDigit ? null : `Check digit mismatch (expected ${expectedCheckDigit}).`
    };
}

function evaluateReleaseEligibility(container, options = {}) {
    const { requireSanitized = false, requireKephis = false } = options;
    const blockers = [];

    if (container.customs_hold) blockers.push('Active KRA Customs hold on container.');
    if (container.kebs_hold) blockers.push('Active KEBS conformity/detention hold on container.');
    if (container.condition_status === 'Damaged') blockers.push('Container marked Damaged (IICL repair / QC required).');

    if (!['Swept_Clean', 'Washed_Sanitized', 'Fumigated'].includes(container.cleaning_status)) {
        blockers.push('Container has not completed sweeping/cleaning.');
    }
    if (requireSanitized && !['Washed_Sanitized', 'Fumigated'].includes(container.cleaning_status)) {
        blockers.push('Washed/Sanitized or Fumigated status required before release.');
    }
    if (requireKephis && !container.kephis_cleared) {
        blockers.push('KEPHIS phytosanitary/biosecurity clearance required before release.');
    }

    return {
        allowed: blockers.length === 0,
        blockers
    };
}

module.exports = {
    validateIso6346,
    evaluateReleaseEligibility
};