// 2026 Kenyan Statutory & Attendance Deduction Engine
function calculateEmployeeMonthlyPayroll({
    basicPay,
    housingAllowance,
    offPay,
    absentDaysFull = 0,
    absentDaysHalf = 0,
    bankAdvances = 0,
    pettyCashAdvances = 0,
    cashAdvances = 0,
    activePaystubsTotal = 0
}) {
    const grossSalary = Number(basicPay) + Number(housingAllowance) + Number(offPay);
    const dailyRate = grossSalary / 30;
    const absenteeismDeduction = Number(((absentDaysFull + absentDaysHalf * 0.5) * dailyRate).toFixed(2));

    const adjustedGross = Math.max(0, grossSalary - absenteeismDeduction);

    // Statutory Deductions (2026 Kenyan Rules)
    const nssf = Math.min(adjustedGross * 0.06, 6480);
    const shif = adjustedGross > 0 ? Math.max(adjustedGross * 0.0275, 300) : 0;
    const housingLevy = adjustedGross * 0.015;

    const taxableIncome = Math.max(0, adjustedGross - (nssf + shif + housingLevy));
    let rawPaye = 0;
    if (taxableIncome > 24000) {
        rawPaye += 24000 * 0.10;
        const band2 = Math.min(taxableIncome - 24000, 8333);
        rawPaye += band2 * 0.25;
        if (taxableIncome > 32333) {
            const band3 = Math.min(taxableIncome - 32333, 467667);
            rawPaye += band3 * 0.30;
        }
        if (taxableIncome > 500000) {
            const band4 = Math.min(taxableIncome - 500000, 300000);
            rawPaye += band4 * 0.325;
        }
        if (taxableIncome > 800000) {
            rawPaye += (taxableIncome - 800000) * 0.35;
        }
    } else {
        rawPaye = taxableIncome * 0.10;
    }
    const paye = Math.max(0, Number((rawPaye - 2400).toFixed(2)));
    const totalStatutory = Number((nssf + shif + housingLevy + paye).toFixed(2));

    const groupedCashAdvances = Number((Number(cashAdvances) + Number(activePaystubsTotal)).toFixed(2));
    const netSalaryReleased = Number(
        (adjustedGross - totalStatutory - Number(bankAdvances) - Number(pettyCashAdvances) - groupedCashAdvances).toFixed(2)
    );

    return {
        grossSalary,
        dailyRate: Number(dailyRate.toFixed(2)),
        absenteeismDeduction,
        statutory: { nssf, shif, housingLevy, paye, totalStatutory },
        netSalaryReleased
    };
}

module.exports = { calculateEmployeeMonthlyPayroll };