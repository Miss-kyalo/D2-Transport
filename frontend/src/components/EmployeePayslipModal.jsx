import { useState, useEffect } from 'react';
import api from '../api';

export default function EmployeePayslipModal({ userId, selectedMonth, onClose }) {
    const [viewMode, setViewMode] = useState('payslip'); // 'payslip' | 'ytd'
    const [loadResult, setLoadResult] = useState({ key: '', statement: null, error: '' });

    const year = (selectedMonth || new Date().toISOString().slice(0, 7)).slice(0, 4);
    const requestKey = `${userId}:${year}`;

    useEffect(() => {
        if (!userId) return;
        let active = true;

        api.get(`/hr/payroll/employee-statement/${userId}`, { params: { year } })
            .then((res) => {
                if (active) setLoadResult({ key: requestKey, statement: res.data, error: '' });
            })
            .catch((err) => {
                if (active) {
                    setLoadResult({
                        key: requestKey,
                        statement: null,
                        error: err.response?.data?.error || 'Could not load employee payslip.'
                    });
                }
            });

        return () => {
            active = false;
        };
    }, [userId, year, requestKey]);

    if (!userId) return null;

    const loading = loadResult.key !== requestKey;
    const statement = loading ? null : loadResult.statement;
    const error = loading ? '' : loadResult.error;
    const employee = statement?.employee || {};
    const records = statement?.records || [];
    const monthRecord =
        records.find((r) => r.payroll_month === selectedMonth) ||
        records[records.length - 1] ||
        null;
    const ytd = statement?.ytd || {};

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(20, 40, 29, 0.72)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '16px',
                zIndex: 80,
                overflowY: 'auto'
            }}
        >
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    #printable-payslip-sheet, #printable-payslip-sheet * { visibility: visible; }
                    #printable-payslip-sheet {
                        position: fixed;
                        left: 0;
                        top: 0;
                        width: 100%;
                        max-width: 100% !important;
                        border: none !important;
                        box-shadow: none !important;
                        padding: 16px !important;
                    }
                    .no-print { display: none !important; }
                }
            `}</style>

            <div
                id="printable-payslip-sheet"
                style={{
                    backgroundColor: '#faf9f5',
                    color: '#14281d',
                    width: '100%',
                    maxWidth: '820px',
                    borderRadius: '10px',
                    padding: '24px',
                    border: '1px solid #c8c4b8',
                    fontFamily: 'Inter, system-ui, sans-serif'
                }}
            >
                {/* Header */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        borderBottom: '2px solid #143628',
                        paddingBottom: '12px',
                        marginBottom: '16px',
                        gap: '12px',
                        flexWrap: 'wrap'
                    }}
                >
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: '#1b4332' }}>
                            D2-TRANSPORT (K) LTD • KENYA STATUTORY PAYROLL & LABOUR COMPLIANCE
                        </div>
                        <h2 style={{ margin: '2px 0 4px', fontSize: '20px' }}>
                            {viewMode === 'payslip'
                                ? `ITEMIZED PAYSLIP — ${monthRecord?.payroll_month || selectedMonth}`
                                : `YEAR-TO-DATE STATUTORY & TAX SCHEDULE (${year})`}
                        </h2>
                        <div style={{ fontSize: '12px', color: '#4b5d52' }}>
                            Employer Location: Athi River, Kenya • Currency: KES
                        </div>
                    </div>

                    <div className="no-print" style={{ display: 'flex', gap: '8px' }}>
                        <button
                            type="button"
                            onClick={() => setViewMode('payslip')}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: '1px solid #143628',
                                backgroundColor: viewMode === 'payslip' ? '#143628' : '#fff',
                                color: viewMode === 'payslip' ? '#fff' : '#143628',
                                fontWeight: 600,
                                fontSize: '12px',
                                cursor: 'pointer'
                            }}
                        >
                            Monthly Payslip
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('ytd')}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: '1px solid #143628',
                                backgroundColor: viewMode === 'ytd' ? '#143628' : '#fff',
                                color: viewMode === 'ytd' ? '#fff' : '#143628',
                                fontWeight: 600,
                                fontSize: '12px',
                                cursor: 'pointer'
                            }}
                        >
                            {year} YTD / KRA Summary
                        </button>
                    </div>
                </div>

                {loading && <p>Loading statutory statement...</p>}
                {error && <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '6px' }}>{error}</div>}

                {!loading && !error && (
                    <>
                        {/* Employee Statutory Identity Block */}
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                gap: '10px',
                                backgroundColor: '#ffffff',
                                border: '1px solid #d6d3c9',
                                borderRadius: '8px',
                                padding: '12px',
                                marginBottom: '16px',
                                fontSize: '12px'
                            }}
                        >
                            <div><strong>Employee:</strong> {employee.name || '—'} ({employee.role || '—'})</div>
                            <div><strong>National ID:</strong> {employee.national_id || '—'}</div>
                            <div><strong>KRA PIN:</strong> {employee.kra_pin || '—'}</div>
                            <div><strong>NSSF No.:</strong> {employee.nssf_number || '—'}</div>
                            <div><strong>SHIF No.:</strong> {employee.shif_number || '—'}</div>
                            <div><strong>Bank / A/C:</strong> {employee.bank_name ? `${employee.bank_name} • ` : ''}{employee.bank_account || '—'}</div>
                        </div>

                        {viewMode === 'payslip' ? (
                            !monthRecord ? (
                                <p style={{ color: '#4b5d52' }}>No payroll calculation recorded for {selectedMonth}. Compute a run on the main tab first.</p>
                            ) : (
                                <>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px', fontSize: '13px' }}>
                                        {/* Earnings */}
                                        <div style={{ backgroundColor: '#ffffff', border: '1px solid #d6d3c9', borderRadius: '8px', padding: '14px' }}>
                                            <div style={{ fontWeight: 700, borderBottom: '1px solid #e5e7eb', paddingBottom: '6px', marginBottom: '10px', color: '#143628' }}>
                                                EARNINGS (FIXED MONTHLY STRUCTURE)
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                                <span>Basic Pay</span>
                                                <strong>KES {Number(monthRecord.basic_pay).toLocaleString()}</strong>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                                <span>Housing Allowance</span>
                                                <strong>KES {Number(monthRecord.housing_allowance).toLocaleString()}</strong>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                                <span>Off Pay ({monthRecord.off_days_paid} days)</span>
                                                <strong>KES {Number(monthRecord.off_pay).toLocaleString()}</strong>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #143628', paddingTop: '8px', fontWeight: 800 }}>
                                                <span>GROSS PAY</span>
                                                <span>KES {Number(monthRecord.gross_pay).toLocaleString()}</span>
                                            </div>
                                        </div>

                                        {/* Deductions */}
                                        <div style={{ backgroundColor: '#ffffff', border: '1px solid #d6d3c9', borderRadius: '8px', padding: '14px' }}>
                                            <div style={{ fontWeight: 700, borderBottom: '1px solid #e5e7eb', paddingBottom: '6px', marginBottom: '10px', color: '#991b1b' }}>
                                                STATUTORY & ADVANCE DEDUCTIONS
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                                <span>NSSF (Tier I + II)</span>
                                                <span>KES {Number(monthRecord.nssf_total).toLocaleString()}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                                <span>SHIF (2.75%)</span>
                                                <span>KES {Number(monthRecord.shif_deduction).toLocaleString()}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                                <span>Affordable Housing Levy (1.5%)</span>
                                                <span>KES {Number(monthRecord.housing_levy).toLocaleString()}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                                <span>PAYE Income Tax</span>
                                                <span>KES {Number(monthRecord.paye_tax).toLocaleString()}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                                <span>Salary Advance</span>
                                                <span>KES {Number(monthRecord.salary_advance).toLocaleString()}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #991b1b', paddingTop: '8px', fontWeight: 800 }}>
                                                <span>TOTAL DEDUCTIONS</span>
                                                <span>KES {Number(monthRecord.total_deductions).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Net Pay & Employer Remittance Note */}
                                    <div
                                        style={{
                                            backgroundColor: '#143628',
                                            color: '#f4f1ea',
                                            borderRadius: '8px',
                                            padding: '14px 18px',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            flexWrap: 'wrap',
                                            gap: '12px',
                                            marginBottom: '14px'
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontSize: '11px', color: '#a3b899', textTransform: 'uppercase' }}>
                                                Net Pay Payable to Employee
                                            </div>
                                            <div style={{ fontSize: '22px', fontWeight: 800 }}>
                                                KES {Number(monthRecord.net_pay).toLocaleString()}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '12px', textAlign: 'right', color: '#d8e2dc' }}>
                                            <div>Employer NSSF Contribution: KES {Number(monthRecord.employer_nssf).toLocaleString()}</div>
                                            <div>Employer AHL Contribution: KES {Number(monthRecord.employer_ahl).toLocaleString()}</div>
                                            <div>Leave Bal: {employee.annual_leave_balance ?? 21}d • Off Bal: {employee.accrued_off_days ?? 0}d</div>
                                        </div>
                                    </div>
                                </>
                            )
                        ) : (
                            /* YTD / KRA & Labour Audit Schedule */
                            <div style={{ backgroundColor: '#ffffff', border: '1px solid #d6d3c9', borderRadius: '8px', padding: '14px', overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'right' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#eef2ee', borderBottom: '1px solid #143628' }}>
                                            <th style={{ padding: '7px', textAlign: 'left' }}>Month</th>
                                            <th style={{ padding: '7px' }}>Gross Pay</th>
                                            <th style={{ padding: '7px' }}>NSSF</th>
                                            <th style={{ padding: '7px' }}>SHIF</th>
                                            <th style={{ padding: '7px' }}>AHL</th>
                                            <th style={{ padding: '7px' }}>PAYE</th>
                                            <th style={{ padding: '7px' }}>Net Pay</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {records.map((rec) => (
                                            <tr key={rec.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                                <td style={{ padding: '7px', textAlign: 'left', fontWeight: 600 }}>{rec.payroll_month}</td>
                                                <td style={{ padding: '7px' }}>{Number(rec.gross_pay).toLocaleString()}</td>
                                                <td style={{ padding: '7px' }}>{Number(rec.nssf_total).toLocaleString()}</td>
                                                <td style={{ padding: '7px' }}>{Number(rec.shif_deduction).toLocaleString()}</td>
                                                <td style={{ padding: '7px' }}>{Number(rec.housing_levy).toLocaleString()}</td>
                                                <td style={{ padding: '7px' }}>{Number(rec.paye_tax).toLocaleString()}</td>
                                                <td style={{ padding: '7px', fontWeight: 700 }}>{Number(rec.net_pay).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ backgroundColor: '#eef2ee', fontWeight: 800, borderTop: '2px solid #143628' }}>
                                            <td style={{ padding: '7px', textAlign: 'left' }}>{year} YTD TOTAL</td>
                                            <td style={{ padding: '7px' }}>{Number(ytd.gross_pay || 0).toLocaleString()}</td>
                                            <td style={{ padding: '7px' }}>{Number(ytd.nssf_total || 0).toLocaleString()}</td>
                                            <td style={{ padding: '7px' }}>{Number(ytd.shif_deduction || 0).toLocaleString()}</td>
                                            <td style={{ padding: '7px' }}>{Number(ytd.housing_levy || 0).toLocaleString()}</td>
                                            <td style={{ padding: '7px' }}>{Number(ytd.paye_tax || 0).toLocaleString()}</td>
                                            <td style={{ padding: '7px' }}>{Number(ytd.net_pay || 0).toLocaleString()}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </>
                )}

                <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' }}>
                    <button
                        type="button"
                        onClick={() => window.print()}
                        style={{
                            padding: '9px 18px',
                            backgroundColor: '#143628',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        Print Payslip / Statement
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            padding: '9px 14px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#ffffff',
                            color: '#14281d',
                            cursor: 'pointer'
                        }}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}