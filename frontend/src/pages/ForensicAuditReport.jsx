import { useState, useEffect } from 'react';
import api from '../api';

export default function ForensicAuditReport() {
    const [dateFrom, setDateFrom] = useState(
        new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10)
    );
    const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
    const [report, setReport] = useState(null);
    const [error, setError] = useState('');

    const loadAudit = async () => {
        try {
            setError('');
            const res = await api.get('/audit-socials/forensic-audit', {
                params: { date_from: dateFrom, date_to: dateTo }
            });
            setReport(res.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to generate forensic audit report.');
        }
    };

    useEffect(() => {
        loadAudit();
    }, []);

    return (
        <div style={{ backgroundColor: '#faf9f5', minHeight: '100vh', padding: '24px', fontFamily: 'Inter, system-ui, sans-serif', color: '#14281d' }}>
            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    body { background: #fff !important; }
                }
            `}</style>

            <div style={{ maxWidth: '1360px', margin: '0 auto' }}>
                <div style={{ backgroundColor: '#143628', color: '#f4f1ea', padding: '22px 26px', borderRadius: '12px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: '#d4af37' }}>
                            D2-TRANSPORT (K) LTD • FORENSIC LOSS-PREVENTION & FINANCIAL AUDIT
                        </div>
                        <h1 style={{ margin: '4px 0 0', fontSize: '24px' }}>
                            Spares, Fuel, Mileage, eTIMS Petty Cash & Bank Audit ({dateFrom} → {dateTo})
                        </h1>
                    </div>

                    <div className="no-print" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: 'none' }} />
                        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: 'none' }} />
                        <button type="button" onClick={loadAudit} style={{ padding: '9px 14px', backgroundColor: '#d4af37', color: '#14281d', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}>
                            Refresh Audit
                        </button>
                        <button type="button" onClick={() => window.print()} style={{ padding: '9px 14px', backgroundColor: '#1b4332', color: '#fff', border: '1px solid #2d5a44', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}>
                            Print Executive Audit Pack
                        </button>
                    </div>
                </div>

                {error && <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '14px' }}>{error}</div>}

                {report && (
                    <div style={{ display: 'grid', gap: '20px' }}>
                        {/* 1. 3-Way Spares Reconciliation */}
                        <div style={{ backgroundColor: '#fff', border: '1px solid #d6d3c9', borderRadius: '10px', padding: '18px', overflowX: 'auto' }}>
                            <h3 style={{ marginTop: 0 }}>1. Spare Parts Anti-Theft Reconciliation (Bought vs. Issued vs. Scrap Cores)</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'right' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#eef2ee', borderBottom: '2px solid #143628' }}>
                                        <th style={{ padding: '8px', textAlign: 'left' }}>SKU & Part Name</th>
                                        <th style={{ padding: '8px' }}>Bought (eTIMS)</th>
                                        <th style={{ padding: '8px' }}>Issued to Jobs</th>
                                        <th style={{ padding: '8px' }}>Closing Stock</th>
                                        <th style={{ padding: '8px' }}>Stock Value (KES)</th>
                                        <th style={{ padding: '8px' }}>Unreturned Old Cores</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.spares.map((s) => (
                                        <tr key={s.id} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: s.missing_cores > 0 ? '#fef2f2' : 'transparent' }}>
                                            <td style={{ padding: '8px', textAlign: 'left' }}><strong>{s.sku}</strong> — {s.item_name}</td>
                                            <td style={{ padding: '8px' }}>{Number(s.qty_bought)}</td>
                                            <td style={{ padding: '8px' }}>{Number(s.qty_issued)}</td>
                                            <td style={{ padding: '8px', fontWeight: 700 }}>{Number(s.quantity_on_hand)}</td>
                                            <td style={{ padding: '8px' }}>{(Number(s.quantity_on_hand) * Number(s.unit_cost)).toLocaleString()}</td>
                                            <td style={{ padding: '8px', fontWeight: 800, color: s.missing_cores > 0 ? '#b91c1c' : '#15803d' }}>
                                                {s.missing_cores > 0 ? `${s.missing_cores} MISSING` : 'OK'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* 2. Fuel Card vs Trip & eTIMS Audit */}
                        <div style={{ backgroundColor: '#fff', border: '1px solid #d6d3c9', borderRadius: '10px', padding: '18px', overflowX: 'auto' }}>
                            <h3 style={{ marginTop: 0 }}>2. Fuel Card Reconciliation vs. Trips, km/L & eTIMS Invoices</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'right' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#eef2ee', borderBottom: '2px solid #143628' }}>
                                        <th style={{ padding: '8px', textAlign: 'left' }}>Date & Truck</th>
                                        <th style={{ padding: '8px', textAlign: 'left' }}>Station & eTIMS #</th>
                                        <th style={{ padding: '8px' }}>Litres</th>
                                        <th style={{ padding: '8px' }}>Amount (KES)</th>
                                        <th style={{ padding: '8px' }}>km/L</th>
                                        <th style={{ padding: '8px', textAlign: 'left' }}>Audit Verdict</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.fuel.map((f) => (
                                        <tr key={f.id} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: f.audit_status === 'Flagged' ? '#fef2f2' : 'transparent' }}>
                                            <td style={{ padding: '8px', textAlign: 'left' }}>{new Date(f.fuel_date).toLocaleDateString()} • <strong>{f.plate_number}</strong></td>
                                            <td style={{ padding: '8px', textAlign: 'left' }}>{f.station_name} • PIN/Inv: {f.etims_invoice_no || 'MISSING'}</td>
                                            <td style={{ padding: '8px' }}>{Number(f.litres).toFixed(1)}</td>
                                            <td style={{ padding: '8px' }}>{Number(f.total_amount).toLocaleString()}</td>
                                            <td style={{ padding: '8px' }}>{f.km_per_litre || '—'}</td>
                                            <td style={{ padding: '8px', textAlign: 'left', fontWeight: 700, color: f.audit_status === 'Flagged' ? '#b91c1c' : '#15803d' }}>
                                                {f.audit_status === 'Flagged' ? `FLAGGED: ${f.flag_reason}` : 'VERIFIED'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* 3. Fleet Mileage & Mechanic Accountability */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
                            <div style={{ backgroundColor: '#fff', border: '1px solid #d6d3c9', borderRadius: '10px', padding: '18px' }}>
                                <h3 style={{ marginTop: 0 }}>3. Fleet Mileage & Zero-KM Yard Days</h3>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'right' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#eef2ee', borderBottom: '2px solid #143628' }}>
                                            <th style={{ padding: '7px', textAlign: 'left' }}>Truck</th>
                                            <th style={{ padding: '7px' }}>Days Logged</th>
                                            <th style={{ padding: '7px' }}>Total KM</th>
                                            <th style={{ padding: '7px' }}>0-KM Days</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {report.mileage.map((m) => (
                                            <tr key={m.plate_number} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                                <td style={{ padding: '7px', textAlign: 'left', fontWeight: 700 }}>{m.plate_number}</td>
                                                <td style={{ padding: '7px' }}>{m.days_logged}</td>
                                                <td style={{ padding: '7px' }}>{Number(m.total_km).toLocaleString()}</td>
                                                <td style={{ padding: '7px', color: m.zero_km_days > 2 ? '#b45309' : '#14281d' }}>{m.zero_km_days}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div style={{ backgroundColor: '#fff', border: '1px solid #d6d3c9', borderRadius: '10px', padding: '18px' }}>
                                <h3 style={{ marginTop: 0 }}>4. Mechanic Bay Start Delay & Output Audit</h3>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'right' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#eef2ee', borderBottom: '2px solid #143628' }}>
                                            <th style={{ padding: '7px', textAlign: 'left' }}>Mechanic</th>
                                            <th style={{ padding: '7px' }}>Assigned</th>
                                            <th style={{ padding: '7px' }}>Completed</th>
                                            <th style={{ padding: '7px' }}>Avg Start Lag</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {report.mechanics.map((mc) => (
                                            <tr key={mc.mechanic_name} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                                <td style={{ padding: '7px', textAlign: 'left', fontWeight: 700 }}>{mc.mechanic_name}</td>
                                                <td style={{ padding: '7px' }}>{mc.jobs_assigned}</td>
                                                <td style={{ padding: '7px' }}>{mc.jobs_completed}</td>
                                                <td style={{ padding: '7px', fontWeight: 700, color: mc.avg_start_delay_mins > 30 ? '#b91c1c' : '#15803d' }}>
                                                    {mc.avg_start_delay_mins} mins
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* 5. Petty Cash & Bank Statement Reconciliation */}
                        <div style={{ backgroundColor: '#fff', border: '1px solid #d6d3c9', borderRadius: '10px', padding: '18px', overflowX: 'auto' }}>
                            <h3 style={{ marginTop: 0 }}>5. eTIMS Petty Cash & Bank Statement Reconciliation</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'right' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#eef2ee', borderBottom: '2px solid #143628' }}>
                                        <th style={{ padding: '8px', textAlign: 'left' }}>Voucher & Staff</th>
                                        <th style={{ padding: '8px', textAlign: 'left' }}>Requested vs. Bought</th>
                                        <th style={{ padding: '8px' }}>Requested</th>
                                        <th style={{ padding: '8px' }}>Actual Spent</th>
                                        <th style={{ padding: '8px' }}>Change Returned</th>
                                        <th style={{ padding: '8px', textAlign: 'left' }}>KRA eTIMS CU #</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.petty_cash.map((v) => (
                                        <tr key={v.id} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: !v.receipt_verified ? '#fffbeb' : 'transparent' }}>
                                            <td style={{ padding: '8px', textAlign: 'left' }}><strong>{v.voucher_no}</strong> • {v.requester_name}</td>
                                            <td style={{ padding: '8px', textAlign: 'left' }}>{v.items_requested} → {v.items_bought || 'Pending'}</td>
                                            <td style={{ padding: '8px' }}>{Number(v.amount_requested).toLocaleString()}</td>
                                            <td style={{ padding: '8px' }}>{Number(v.actual_spent).toLocaleString()}</td>
                                            <td style={{ padding: '8px' }}>{Number(v.change_returned).toLocaleString()}</td>
                                            <td style={{ padding: '8px', textAlign: 'left', fontWeight: 700, color: v.receipt_verified ? '#15803d' : '#b45309' }}>
                                                {v.etims_cu_invoice_no || 'UNSETTLED'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}