function round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * Computes Kenyan 2026 Statutory Monthly Payroll
 * Structure: Basic Pay + Housing Allowance + Off Pay = Gross Pay
 * Deductions: NSSF + SHIF + AHL + PAYE + Salary Advance = Total Deductions -> Net Pay
 */
function calculateKenyaPayroll2026({
    basicPay = 0,
    housingAllowance = 0,
    offDaysPaid = 0,
    offDayRate = 0,
    salaryAdvance = 0
}) {
    const basic = round2(basicPay);
    const housing = round2(housingAllowance);
    const offPay = round2(Number(offDaysPaid) * Number(offDayRate));
    const grossPay = round2(basic + housing + offPay);

    // 1. NSSF (2026 Rates: 6% Tier I up to KES 8,000; 6% Tier II from 8,001 to 72,000)
    const tier1Pensionable = Math.min(grossPay, 8000);
    const tier2Pensionable = Math.max(0, Math.min(grossPay, 72000) - 8000);
    const nssfTier1 = round2(tier1Pensionable * 0.06);
    const nssfTier2 = round2(tier2Pensionable * 0.06);
    const nssfTotal = round2(nssfTier1 + nssfTier2);

    // 2. SHIF (Social Health Insurance Fund: 2.75% of Gross Pay, min KES 300)
    const shifDeduction = grossPay > 0 ? round2(Math.max(300, grossPay * 0.0275)) : 0;

    // 3. Affordable Housing Levy (AHL: 1.5% of Gross Pay)
    const housingLevy = round2(grossPay * 0.015);

    // 4. Taxable Pay (NSSF, SHIF, and AHL are allowable deductions under Kenyan Tax Laws Amendment Act)
    const taxablePay = round2(Math.max(0, grossPay - nssfTotal - shifDeduction - housingLevy));

    // 5. Progressive KRA PAYE Bands (Monthly)
    let grossTax = 0;
    let remaining = taxablePay;

    const bands = [
        { limit: 24000, rate: 0.10 },
        { limit: 8333, rate: 0.25 },
        { limit: 467667, rate: 0.30 },
        { limit: 300000, rate: 0.325 },
        { limit: Infinity, rate: 0.35 }
    ];

    for (const band of bands) {
        if (remaining <= 0) break;
        const taxableInBand = Math.min(remaining, band.limit);
        grossTax += taxableInBand * band.rate;
        remaining -= taxableInBand;
    }

    const personalRelief = taxablePay > 0 ? 2400 : 0;
    const payeTax = round2(Math.max(0, grossTax - personalRelief));

    // 6. Total Deductions & Net Pay
    const advance = round2(salaryAdvance);
    const totalDeductions = round2(nssfTotal + shifDeduction + housingLevy + payeTax + advance);
    const netPay = round2(grossPay - totalDeductions);

    return {
        basic_pay: basic,
        housing_allowance: housing,
        off_days_paid: Number(offDaysPaid),
        off_pay: offPay,
        gross_pay: grossPay,
        nssf_tier1: nssfTier1,
        nssf_tier2: nssfTier2,
        nssf_total: nssfTotal,
        shif_deduction: shifDeduction,
        housing_levy: housingLevy,
        taxable_pay: taxablePay,
        paye_tax: payeTax,
        salary_advance: advance,
        total_deductions: totalDeductions,
        net_pay: netPay,
        employer_nssf: nssfTotal,
        employer_ahl: housingLevy
    };
}

module.exports = { calculateKenyaPayroll2026 };