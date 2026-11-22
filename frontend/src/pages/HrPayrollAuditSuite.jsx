import { useState, useEffect } from 'react';
import api from '../api';
import EmployeePayslipModal from '../components/EmployeePayslipModal';

export default function HrPayrollAuditSuite() {
    const readOnly = localStorage.getItem('role') === 'Boss';
    const [tab, setTab] = useState('payroll');
    const [profiles, setProfiles] = useState([]);
    const [register, setRegister] = useState([]);
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    // Selected Profile Editor
    const [editingProfile, setEditingProfile] = useState(null);
    const [payslipUserId, setPayslipUserId] = useState(null);

    // Payroll Run Form
    const [runForm, setRunForm] = useState({
        user_id: '',
        salary_advance: 0
    });

    const loadAll = async (targetMonth = month) => {
        try {
            const [profRes, regRes] = await Promise.all([
                api.get('/hr/profiles'),
                api.get('/hr/payroll/register', { params: { month: targetMonth } })
            ]);
            setProfiles(profRes.data.profiles || []);
            setRegister(regRes.data.records || []);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load HR & Payroll records.');
        }
    };

    useEffect(() => {
        let active = true;
        Promise.all([
            api.get('/hr/profiles'),
            api.get('/hr/payroll/register', { params: { month } })
        ])
            .then(([profRes, regRes]) => {
                if (!active) return;
                setProfiles(profRes.data.profiles || []);
                setRegister(regRes.data.records || []);
            })
            .catch((err) => {
                if (active) setError(err.response?.data?.error || 'Failed to load HR & Payroll records.');
            });

        return () => {
            active = false;
        };
    }, [month]);

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        try {
            const res = await api.put(`/hr/profiles/${editingProfile.id}`, editingProfile);
            setMessage(res.data.message);
            setEditingProfile(null);
            loadAll(month);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to save statutory profile.');
        }
    };

    const handleRunPayroll = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        try {
            const res = await api.post('/hr/payroll/run', {
                ...runForm,
                payroll_month: month
            });
            setMessage(res.data.message);
            setRunForm({ user_id: '', salary_advance: 0 });
            loadAll(month);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to calculate payroll.');
        }
    };

    const totals = register.reduce(
        (acc, r) => ({
            gross: acc.gross + Number(r.gross_pay || 0),
            nssf: acc.nssf + Number(r.nssf_total || 0),
            shif: acc.shif + Number(r.shif_deduction || 0),
            ahl: acc.ahl + Number(r.housing_levy || 0),
            paye: acc.paye + Number(r.paye_tax || 0),
            net: acc.net + Number(r.net_pay || 0)
        }),
        { gross: 0, nssf: 0, shif: 0, ahl: 0, paye: 0, net: 0 }
    );

    return (
        <div style={{ backgroundColor: '#faf9f5', minHeight: '100vh', padding: '24px', fontFamily: 'Inter, system-ui, sans-serif', color: '#14281d' }}>
            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    body { background: #fff !important; }
                }
            `}</style>

            <div style={{ maxWidth: '1320px', margin: '0 auto' }}>
                {/* Old-Money Forest Green Executive Header */}
                <div style={{ backgroundColor: '#143628', color: '#f4f1ea', padding: '22px 26px', borderRadius: '12px', marginBottom: '22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                        <div style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#a3b899', fontWeight: 700 }}>
                            D2-Transport (K) Ltd • Human Capital & Statutory Compliance
                        </div>
                        <h1 style={{ margin: '4px 0 0', fontSize: '24px' }}>KRA &amp; Labour-Proof 2026 Payroll Suite</h1>
                    </div>

                    <div className="no-print" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {[
                            { id: 'payroll', label: '2026 Statutory Payroll & Audit Print' },
                            { id: 'profiles', label: 'Driver & Staff Statutory Profiles' }
                        ].map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setTab(item.id)}
                                style={{
                                    padding: '9px 14px',
                                    borderRadius: '7px',
                                    border: '1px solid #2d5a44',
                                    backgroundColor: tab === item.id ? '#d4af37' : '#1b4332',
                                    color: tab === item.id ? '#14281d' : '#f4f1ea',
                                    fontWeight: 700,
                                    fontSize: '13px',
                                    cursor: 'pointer'
                                }}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>

                {error && <div className="no-print" style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px' }}>{error}</div>}
                {message && <div className="no-print" style={{ padding: '12px', backgroundColor: '#dcfce7', color: '#14532d', borderRadius: '8px', marginBottom: '16px' }}>{message}</div>}

                {/* TAB 1: 2026 STATUTORY PAYROLL & AUDIT PRINT PACK */}
                {tab === 'payroll' && (
                    <div>
                        {readOnly && <label className="no-print">Payroll month <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>}
                        {!readOnly && (
                        <form onSubmit={handleRunPayroll} className="no-print" style={{ backgroundColor: '#fff', border: '1px solid #d6d3c9', borderRadius: '10px', padding: '18px', marginBottom: '20px', display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Select Driver / Staff</label>
                                <select required value={runForm.user_id} onChange={(e) => setRunForm({ ...runForm, user_id: e.target.value })} style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                                    <option value="">-- Choose Employee --</option>
                                    {profiles.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} ({p.role}) — Basic: KES {Number(p.basic_pay).toLocaleString()}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Payroll Month</label>
                                <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Paid Off-Days (Fixed)</label>
                                <div style={{ padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9' }}>2 days per month</div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Salary Advance (KES)</label>
                                <input type="number" value={runForm.salary_advance} onChange={(e) => setRunForm({ ...runForm, salary_advance: e.target.value })} style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                            </div>
                            <button type="submit" style={{ padding: '10px 18px', backgroundColor: '#143628', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}>
                                Compute Statutory Run
                            </button>
                        </form>
                        )}

                        {/* Printable Statutory Audit Register */}
                        <div style={{ backgroundColor: '#fff', border: '1px solid #d6d3c9', borderRadius: '10px', padding: '20px', overflowX: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                <div>
                                    <h3 style={{ margin: 0 }}>KRA P10 / NSSF / SHIF / AHL Statutory Audit Register — {month}</h3>
                                    <div style={{ fontSize: '12px', color: '#52665a' }}>
                                        Formula: Basic + Housing + Off Pay = Gross | Deductions: NSSF (6% T1/T2) + SHIF (2.75%) + AHL (1.5%) + PAYE + Advance
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="no-print"
                                    onClick={() => window.print()}
                                    style={{ padding: '9px 16px', backgroundColor: '#1b4332', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
                                >
                                    Print KRA & Labour Audit Report
                                </button>
                            </div>

                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'right' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#eef2ee', borderBottom: '2px solid #143628', textAlign: 'right' }}>
                                        <th style={{ padding: '8px', textAlign: 'left' }}>Employee & KRA PIN</th>
                                        <th style={{ padding: '8px', textAlign: 'left' }}>NSSF / SHIF #</th>
                                        <th style={{ padding: '8px' }}>Basic</th>
                                        <th style={{ padding: '8px' }}>Housing</th>
                                        <th style={{ padding: '8px' }}>Off Pay</th>
                                        <th style={{ padding: '8px' }}>Gross Pay</th>
                                        <th style={{ padding: '8px' }}>NSSF</th>
                                        <th style={{ padding: '8px' }}>SHIF</th>
                                        <th style={{ padding: '8px' }}>AHL</th>
                                        <th style={{ padding: '8px' }}>PAYE</th>
                                        <th style={{ padding: '8px' }}>Advance</th>
                                        <th style={{ padding: '8px' }}>Net Pay</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {register.map((r) => (
                                        <tr key={r.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                            <td style={{ padding: '8px', textAlign: 'left' }}>
                                                <strong>{r.name}</strong>
                                                <div style={{ color: '#52665a' }}>PIN: {r.kra_pin || 'MISSING'}</div>
                                                <button
                                                    type="button"
                                                    className="no-print"
                                                    onClick={() => setPayslipUserId(r.user_id)}
                                                    style={{ marginTop: '6px', padding: '4px 8px', backgroundColor: '#143628', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                                                >
                                                    Payslip
                                                </button>
                                            </td>
                                            <td style={{ padding: '8px', textAlign: 'left' }}>
                                                <div>NSSF: {r.nssf_number || '—'}</div>
                                                <div>SHIF: {r.shif_number || '—'}</div>
                                            </td>
                                            <td style={{ padding: '8px' }}>{Number(r.basic_pay).toLocaleString()}</td>
                                            <td style={{ padding: '8px' }}>{Number(r.housing_allowance).toLocaleString()}</td>
                                            <td style={{ padding: '8px' }}>{Number(r.off_pay).toLocaleString()}</td>
                                            <td style={{ padding: '8px', fontWeight: 700 }}>{Number(r.gross_pay).toLocaleString()}</td>
                                            <td style={{ padding: '8px' }}>{Number(r.nssf_total).toLocaleString()}</td>
                                            <td style={{ padding: '8px' }}>{Number(r.shif_deduction).toLocaleString()}</td>
                                            <td style={{ padding: '8px' }}>{Number(r.housing_levy).toLocaleString()}</td>
                                            <td style={{ padding: '8px', color: '#991b1b', fontWeight: 600 }}>{Number(r.paye_tax).toLocaleString()}</td>
                                            <td style={{ padding: '8px' }}>{Number(r.salary_advance).toLocaleString()}</td>
                                            <td style={{ padding: '8px', fontWeight: 800, color: '#143628' }}>{Number(r.net_pay).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                {register.length > 0 && (
                                    <tfoot>
                                        <tr style={{ backgroundColor: '#eef2ee', fontWeight: 800, borderTop: '2px solid #143628' }}>
                                            <td colSpan={5} style={{ padding: '8px', textAlign: 'left' }}>TOTAL STATUTORY & DISBURSEMENT SUMMARY</td>
                                            <td style={{ padding: '8px' }}>{totals.gross.toLocaleString()}</td>
                                            <td style={{ padding: '8px' }}>{totals.nssf.toLocaleString()}</td>
                                            <td style={{ padding: '8px' }}>{totals.shif.toLocaleString()}</td>
                                            <td style={{ padding: '8px' }}>{totals.ahl.toLocaleString()}</td>
                                            <td style={{ padding: '8px' }}>{totals.paye.toLocaleString()}</td>
                                            <td style={{ padding: '8px' }}>—</td>
                                            <td style={{ padding: '8px' }}>{totals.net.toLocaleString()}</td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                )}

                {/* TAB 2: DRIVER & STAFF STATUTORY PROFILES */}
                {tab === 'profiles' && (
                    <div style={{ backgroundColor: '#fff', border: '1px solid #d6d3c9', borderRadius: '10px', padding: '20px', overflowX: 'auto' }}>
                        <h3 style={{ marginTop: 0 }}>Driver & Staff Statutory Compliance Profiles</h3>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#eef2ee', borderBottom: '2px solid #143628' }}>
                                    <th style={{ padding: '8px' }}>Name & Role</th>
                                    <th style={{ padding: '8px' }}>National ID / KRA PIN</th>
                                    <th style={{ padding: '8px' }}>NSSF / SHIF</th>
                                    <th style={{ padding: '8px' }}>License & Expiry</th>
                                    <th style={{ padding: '8px' }}>Basic / Housing / Off Rate</th>
                                    <th style={{ padding: '8px' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {profiles.map((p) => (
                                    <tr key={p.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                        <td style={{ padding: '8px' }}>
                                            <strong>{p.name}</strong>
                                            <div style={{ fontSize: '12px', color: '#52665a' }}>{p.role} • {p.phone_number || 'No Phone'}</div>
                                        </td>
                                        <td style={{ padding: '8px' }}>
                                            <div>ID: {p.national_id || '—'}</div>
                                            <div>PIN: <strong>{p.kra_pin || 'MISSING'}</strong></div>
                                        </td>
                                        <td style={{ padding: '8px' }}>
                                            <div>NSSF: {p.nssf_number || '—'}</div>
                                            <div>SHIF: {p.shif_number || '—'}</div>
                                        </td>
                                        <td style={{ padding: '8px' }}>
                                            <div>{p.license_number || '—'} ({p.license_class || 'CE'})</div>
                                            <div style={{ fontSize: '12px', color: '#52665a' }}>
                                                Exp: {p.license_expiry ? new Date(p.license_expiry).toLocaleDateString() : '—'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '8px' }}>
                                            KES {Number(p.basic_pay).toLocaleString()} + {Number(p.housing_allowance).toLocaleString()}
                                            <div style={{ fontSize: '12px', color: '#52665a' }}>Off Rate: KES {Number(p.off_day_rate).toLocaleString()}/day</div>
                                        </td>
                                        <td style={{ padding: '8px' }}>
                                            {!readOnly && (
                                            <button
                                                type="button"
                                                onClick={() => setEditingProfile({
                                                    ...p,
                                                    license_expiry: p.license_expiry ? p.license_expiry.slice(0, 10) : ''
                                                })}
                                                style={{ padding: '6px 12px', backgroundColor: '#143628', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                                            >
                                                Edit Profile
                                            </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* EDIT STATUTORY PROFILE MODAL */}
                {editingProfile && (
                    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px', zIndex: 50 }}>
                        <form onSubmit={handleSaveProfile} style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '10px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }}>
                            <h3 style={{ marginTop: 0 }}>Statutory & Driver Profile — {editingProfile.name}</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                                <div><label>National ID</label><input type="text" value={editingProfile.national_id || ''} onChange={(e) => setEditingProfile({ ...editingProfile, national_id: e.target.value })} style={{ width: '100%', padding: '8px' }} /></div>
                                <div><label>KRA PIN</label><input type="text" value={editingProfile.kra_pin || ''} onChange={(e) => setEditingProfile({ ...editingProfile, kra_pin: e.target.value })} style={{ width: '100%', padding: '8px' }} /></div>
                                <div><label>NSSF Number</label><input type="text" value={editingProfile.nssf_number || ''} onChange={(e) => setEditingProfile({ ...editingProfile, nssf_number: e.target.value })} style={{ width: '100%', padding: '8px' }} /></div>
                                <div><label>SHIF Number</label><input type="text" value={editingProfile.shif_number || ''} onChange={(e) => setEditingProfile({ ...editingProfile, shif_number: e.target.value })} style={{ width: '100%', padding: '8px' }} /></div>
                                <div><label>NTSA License #</label><input type="text" value={editingProfile.license_number || ''} onChange={(e) => setEditingProfile({ ...editingProfile, license_number: e.target.value })} style={{ width: '100%', padding: '8px' }} /></div>
                                <div><label>License Expiry</label><input type="date" value={editingProfile.license_expiry || ''} onChange={(e) => setEditingProfile({ ...editingProfile, license_expiry: e.target.value })} style={{ width: '100%', padding: '8px' }} /></div>
                                <div><label>Basic Pay (KES)</label><input type="number" value={editingProfile.basic_pay || 0} onChange={(e) => setEditingProfile({ ...editingProfile, basic_pay: e.target.value })} style={{ width: '100%', padding: '8px' }} /></div>
                                <div><label>Housing Allowance (KES)</label><input type="number" value={editingProfile.housing_allowance || 0} onChange={(e) => setEditingProfile({ ...editingProfile, housing_allowance: e.target.value })} style={{ width: '100%', padding: '8px' }} /></div>
                                <div><label>Off-Day Rate (KES/day)</label><input type="number" value={editingProfile.off_day_rate || 0} onChange={(e) => setEditingProfile({ ...editingProfile, off_day_rate: e.target.value })} style={{ width: '100%', padding: '8px' }} /></div>
                                <div><label>Bank / M-Pesa Account</label><input type="text" value={editingProfile.bank_account || ''} onChange={(e) => setEditingProfile({ ...editingProfile, bank_account: e.target.value })} style={{ width: '100%', padding: '8px' }} /></div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                                <button type="button" onClick={() => setEditingProfile(null)} style={{ padding: '8px 14px' }}>Cancel</button>
                                <button type="submit" style={{ padding: '8px 16px', backgroundColor: '#143628', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700 }}>Save Profile</button>
                            </div>
                        </form>
                    </div>
                )}
                {payslipUserId && (
                    <EmployeePayslipModal
                        userId={payslipUserId}
                        selectedMonth={month}
                        onClose={() => setPayslipUserId(null)}
                    />
                )}
            </div>
        </div>
    );
}