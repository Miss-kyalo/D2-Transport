import { useState, useEffect, useCallback } from 'react';
import api from '../api';

export default function DriverPayslipModal() {
    const [payslips, setPayslips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [signatureText, setSignatureText] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const fetchMyPayslips = useCallback(async () => {
        const res = await api.get('/payroll/my-payslips');
        return res.data;
    }, []);

    useEffect(() => {
        let isCurrent = true;

        fetchMyPayslips()
            .then((loadedPayslips) => {
                if (isCurrent) setPayslips(loadedPayslips);
            })
            .catch(() => {
                if (isCurrent) setError('Failed to load payslips.');
            })
            .finally(() => {
                if (isCurrent) setLoading(false);
            });

        return () => {
            isCurrent = false;
        };
    }, [fetchMyPayslips]);

    const handleAcknowledge = async (payslipId) => {
        if (!signatureText.trim()) {
            return setError('Please type your full legal name as your digital signature to acknowledge.');
        }
        try {
            setError('');
            const res = await api.patch(`/payroll/${payslipId}/acknowledge`, {
                signature_text: signatureText
            });
            setMessage(res.data.message);
            setSignatureText('');
            fetchMyPayslips()
                .then(setPayslips)
                .catch(() => setError('Failed to load payslips.'));
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to sign payslip.');
        }
    };

    if (loading) return null;

    // Filter for unacknowledged payslips that require sign-off
    const pendingPayslips = payslips.filter((p) => !p.acknowledged_by_driver);

    if (pendingPayslips.length === 0) return null;

    return (
        <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', padding: '20px', borderRadius: '8px', marginBottom: '24px' }}>
            <h3 style={{ marginTop: 0, color: '#92400e' }}>Action Required: Monthly Payslip Consent & Sign-Off</h3>
            <p style={{ fontSize: '14px', color: '#78350f' }}>
                Per Kenyan labor regulations and company policy, you must review and digitally sign your monthly payslip before salary release.
            </p>

            {error && <div style={{ color: '#991b1b', marginBottom: '10px', fontSize: '13px' }}>{error}</div>}
            {message && <div style={{ color: '#166534', marginBottom: '10px', fontSize: '13px' }}>{message}</div>}

            {pendingPayslips.map((p) => {
                const gross = Number(p.basic_pay) + Number(p.housing_allowance) + Number(p.off_pay);
                return (
                    <div key={p.id} style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', padding: '16px', borderRadius: '6px', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: 'bold' }}>
                            <span>Period: {p.month_year}</span>
                            <span style={{ color: '#166534' }}>Net Pay: KES {Number(p.net_pay).toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', fontSize: '13px', color: '#334155', marginBottom: '12px' }}>
                            <div>Gross Salary: KES {gross.toLocaleString()}</div>
                            <div>Total Deductions: KES {Number(p.deductions_total).toLocaleString()}</div>
                            <div>Status: <strong>{p.status}</strong></div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <input
                                type="text"
                                placeholder="Type Full Name for Digital Signature"
                                value={signatureText}
                                onChange={(e) => setSignatureText(e.target.value)}
                                style={{ padding: '8px', flex: 1, borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                            />
                            <button
                                onClick={() => handleAcknowledge(p.id)}
                                style={{ padding: '8px 16px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
                            >
                                Sign & Acknowledge
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}