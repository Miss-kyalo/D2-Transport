import { useState, useEffect } from 'react';
import api from '../api';

export default function PayrollDashboard() {
    const [monthYear, setMonthYear] = useState('2026-11');
    const [staff, setStaff] = useState([]);
    const [payslips, setPayslips] = useState([]);
    const [breakdown, setBreakdown] = useState(null);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const [form, setForm] = useState({
        driver_id: '',
        basic_pay: 35000,
        housing_allowance: 5000,
        off_pay: 3000,
        absent_days_full: 0,
        absent_days_half: 0,
        salary_advances: 0
    });

    const loadData = async () => {
        try {
            const [staffRes, cycleRes] = await Promise.all([
                api.get('/payroll/staff'),
                api.get(`/payroll/cycles/${monthYear}`)
            ]);
            setStaff(staffRes.data);
            setPayslips(cycleRes.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load payroll data.');
        }
    };

    useEffect(() => {
        loadData();
    }, [monthYear]);

    const handleEmployeeSelect = (empId) => {
        const emp = staff.find((s) => String(s.id) === String(empId));
        setForm({
            ...form,
            driver_id: empId,
            basic_pay: emp?.basic_pay > 0 ? emp.basic_pay : 35000,
            housing_allowance: emp?.housing_allowance > 0 ? emp.housing_allowance : 5000,
            off_pay: emp?.off_pay > 0 ? emp.off_pay : 3000
        });
    };

    const handleGenerate = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        try {
            const res = await api.post('/payroll/generate', {
                ...form,
                month_year: monthYear
            });
            setMessage(res.data.message);
            setBreakdown(res.data.breakdown);
            loadData();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to calculate payroll.');
        }
    };

    const handleRelease = async (payslipId) => {
        try {
            setError('');
            const res = await api.patch(`/payroll/${payslipId}/release`);
            setMessage(res.data.message);
            loadData();
        } catch (err) {
            setError(err.response?.data?.error || 'Cannot release salary yet.');
        }
    };

    return (
        <div style={{ padding: '24px', fontFamily: 'sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '16px', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ margin: 0, color: '#0f172a' }}>2026 Kenyan Statutory Payroll Engine</h1>
                    <p style={{ margin: '4px 0 0', color: '#64748b' }}>Fixed Monthly Structure (Basic + Housing + Off Pay) • NSSF • SHIF • AHL • PAYE</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <input type="month" value={monthYear} onChange={(e) => setMonthYear(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    <a href="/admin" style={{ padding: '8px 14px', backgroundColor: '#475569', color: '#fff', textDecoration: 'none', borderRadius: '6px', fontSize: '14px' }}>
                        ← Dispatch Center
                    </a>
                </div>
            </div>

            {error && <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '6px', marginBottom: '16px' }}>{error}</div>}
            {message && <div style={{ padding: '12px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '6px', marginBottom: '16px' }}>{message}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '24px' }}>
                {/* Payroll Calculator Form */}
                <form onSubmit={handleGenerate} style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '20px', borderRadius: '8px' }}>
                    <h3 style={{ marginTop: 0 }}>Run Employee Payslip ({monthYear})</h3>

                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>Select Employee</label>
                        <select required value={form.driver_id} onChange={(e) => handleEmployeeSelect(e.target.value)} style={{ width: '100%', padding: '8px' }}>
                            <option value="">-- Choose Staff / Driver --</option>
                            {staff.map((s) => (
                                <option key={s.id} value={s.id}>{s.username} ({s.role})</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Basic Pay (KES)</label>
                            <input type="number" required value={form.basic_pay} onChange={(e) => setForm({ ...form, basic_pay: e.target.value })} style={{ width: '100%', padding: '8px' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Housing (KES)</label>
                            <input type="number" required value={form.housing_allowance} onChange={(e) => setForm({ ...form, housing_allowance: e.target.value })} style={{ width: '100%', padding: '8px' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Off Pay (KES)</label>
                            <input type="number" required value={form.off_pay} onChange={(e) => setForm({ ...form, off_pay: e.target.value })} style={{ width: '100%', padding: '8px' }} />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Full Absent Days</label>
                            <input type="number" min="0" max="30" value={form.absent_days_full} onChange={(e) => setForm({ ...form, absent_days_full: e.target.value })} style={{ width: '100%', padding: '8px' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Half Absent Days</label>
                            <input type="number" min="0" max="30" value={form.absent_days_half} onChange={(e) => setForm({ ...form, absent_days_half: e.target.value })} style={{ width: '100%', padding: '8px' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Advances (KES)</label>
                            <input type="number" min="0" value={form.salary_advances} onChange={(e) => setForm({ ...form, salary_advances: e.target.value })} style={{ width: '100%', padding: '8px' }} />
                        </div>
                    </div>

                    <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                        Calculate Statutory Deductions & Save
                    </button>

                    {breakdown && (
                        <div style={{ marginTop: '16px', padding: '12px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}>
                            <strong>Latest Statutory Breakdown:</strong>
                            <div>Gross Salary: KES {breakdown.grossSalary.toLocaleString()}</div>
                            <div>Attendance Docking: -KES {breakdown.absenteeismDeduction.toLocaleString()}</div>
                            <div>NSSF (6%): -KES {breakdown.statutory.nssf.toLocaleString()}</div>
                            <div>SHIF (2.75%): -KES {breakdown.statutory.shif.toLocaleString()}</div>
                            <div>Housing Levy (1.5%): -KES {breakdown.statutory.housingLevy.toLocaleString()}</div>
                            <div>PAYE (Net of Relief): -KES {breakdown.statutory.paye.toLocaleString()}</div>
                            <div style={{ marginTop: '6px', fontWeight: 'bold', color: '#166534' }}>
                                Net Pay: KES {breakdown.netSalaryReleased.toLocaleString()}
                            </div>
                        </div>
                    )}
                </form>

                {/* Monthly Payroll Ledger */}
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '20px', backgroundColor: '#fff' }}>
                    <h3 style={{ marginTop: 0 }}>Payroll Register — {monthYear}</h3>
                    {payslips.length === 0 ? (
                        <p style={{ color: '#64748b', fontSize: '14px' }}>No payslips generated for {monthYear} yet.</p>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                                    <th style={{ padding: '10px' }}>Employee</th>
                                    <th style={{ padding: '10px' }}>Gross (KES)</th>
                                    <th style={{ padding: '10px' }}>Deductions</th>
                                    <th style={{ padding: '10px' }}>Net Pay</th>
                                    <th style={{ padding: '10px' }}>Sign-Off</th>
                                    <th style={{ padding: '10px' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payslips.map((p) => {
                                    const gross = Number(p.basic_pay) + Number(p.housing_allowance) + Number(p.off_pay);
                                    return (
                                        <tr key={p.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                            <td style={{ padding: '10px', fontWeight: 'bold' }}>{p.username}</td>
                                            <td style={{ padding: '10px' }}>{gross.toLocaleString()}</td>
                                            <td style={{ padding: '10px', color: '#dc2626' }}>-{Number(p.deductions_total).toLocaleString()}</td>
                                            <td style={{ padding: '10px', fontWeight: 'bold', color: '#166534' }}>{Number(p.net_pay).toLocaleString()}</td>
                                            <td style={{ padding: '10px' }}>
                                                {p.acknowledged_by_driver ? `Signed (${p.driver_signature_url})` : 'Pending Driver'}
                                            </td>
                                            <td style={{ padding: '10px' }}>
                                                {p.status === 'Released' ? (
                                                    <span style={{ color: '#166534', fontWeight: 'bold' }}>Released</span>
                                                ) : (
                                                    <button
                                                        onClick={() => handleRelease(p.id)}
                                                        disabled={!p.acknowledged_by_driver}
                                                        style={{
                                                            padding: '5px 10px',
                                                            backgroundColor: p.acknowledged_by_driver ? '#16a34a' : '#cbd5e1',
                                                            color: '#fff',
                                                            border: 'none',
                                                            borderRadius: '4px',
                                                            cursor: p.acknowledged_by_driver ? 'pointer' : 'not-allowed'
                                                        }}
                                                    >
                                                        Release Pay
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}