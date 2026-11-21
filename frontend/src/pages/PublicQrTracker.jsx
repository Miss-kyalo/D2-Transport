import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';

export default function PublicQrTracker() {
    const { code: routeCode } = useParams();
    const [searchCode, setSearchCode] = useState(routeCode || '');
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(Boolean(routeCode));

    const verifyCode = async (targetCode) => {
        if (!targetCode) return;
        try {
            setLoading(true);
            setError('');
            const res = await api.get(`/hr/public-track/${encodeURIComponent(targetCode)}`);
            setData(res.data);
        } catch (err) {
            setData(null);
            setError(err.response?.data?.error || 'Invalid or unverified QR code.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!routeCode) return;
        let active = true;

        api.get(`/hr/public-track/${encodeURIComponent(routeCode)}`)
            .then((res) => {
                if (active) {
                    setData(res.data);
                    setError('');
                }
            })
            .catch((err) => {
                if (active) {
                    setData(null);
                    setError(err.response?.data?.error || 'Invalid or unverified QR code.');
                }
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [routeCode]);

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#0b1120', color: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif', padding: '32px 16px' }}>
            <div style={{ maxWidth: '720px', margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                    <span style={{ padding: '5px 12px', borderRadius: '999px', backgroundColor: 'rgba(16,185,129,0.15)', color: '#6ee7b7', fontSize: '12px', fontWeight: 700 }}>
                        D2-TRANSPORT LIVE QR VERIFICATION
                    </span>
                    <h1 style={{ margin: '12px 0 6px', fontSize: '28px' }}>Shipment & Container Gate Authenticator</h1>
                    <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>
                        Scan a D2-Transport QR Gate Pass or enter a Container ISO Number, EIR Reference, or Waybill Code.
                    </p>
                </div>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        verifyCode(searchCode);
                    }}
                    style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}
                >
                    <input
                        type="text"
                        value={searchCode}
                        onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
                        placeholder="e.g., CSQU3054383 or D2-482910"
                        style={{ flex: 1, padding: '12px 14px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#111827', color: '#fff', fontSize: '15px' }}
                    />
                    <button type="submit" style={{ padding: '12px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#10b981', color: '#052e16', fontWeight: 700, cursor: 'pointer' }}>
                        Verify
                    </button>
                </form>

                {loading && <p style={{ textAlign: 'center', color: '#94a3b8' }}>Verifying cryptographic ledger...</p>}
                {error && <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#fca5a5' }}>{error}</div>}

                {data && (
                    <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1f2937', paddingBottom: '14px', marginBottom: '18px' }}>
                            <strong style={{ color: '#34d399', fontSize: '16px' }}>AUTHENTICATED RECORD</strong>
                            <span style={{ fontSize: '12px', color: '#94a3b8' }}>Checked: {new Date(data.verified_at).toLocaleString()}</span>
                        </div>

                        {data.container && (
                            <div style={{ marginBottom: '20px' }}>
                                <h3 style={{ margin: '0 0 8px', color: '#38bdf8' }}>Container {data.container.container_number} ({data.container.container_type})</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px', color: '#cbd5e1' }}>
                                    <div>Status: <strong>{data.container.status}</strong></div>
                                    <div>Principal: <strong>{data.container.principal_name || 'Local'}</strong></div>
                                    <div>Hygiene: <strong>{data.container.cleaning_status}</strong></div>
                                    <div>KEPHIS Biosecurity: <strong>{data.container.kephis_cleared ? 'Cleared' : 'Standard'}</strong></div>
                                    <div>Customs / KEBS Holds: <strong>{data.container.customs_hold || data.container.kebs_hold ? 'ACTIVE HOLD' : 'Clear'}</strong></div>
                                    <div>Structural (IICL): <strong>{data.container.condition_status}</strong></div>
                                </div>
                            </div>
                        )}

                        {data.trip && (
                            <div style={{ marginBottom: '20px', padding: '14px', backgroundColor: '#0f172a', borderRadius: '8px' }}>
                                <h3 style={{ margin: '0 0 6px', color: '#fbbf24' }}>Road Freight Waybill: {data.trip.tracking_code}</h3>
                                <div style={{ fontSize: '13px', color: '#cbd5e1' }}>
                                    <div>Route: <strong>{data.trip.origin} → {data.trip.destination}</strong></div>
                                    <div>Truck Plate: <strong>{data.trip.plate_number}</strong> • Status: <strong>{data.trip.status}</strong></div>
                                </div>
                            </div>
                        )}

                        {data.movements?.length > 0 && (
                            <div>
                                <h4 style={{ margin: '0 0 10px', fontSize: '14px', color: '#94a3b8' }}>Immutable Movement Audit Trail</h4>
                                {data.movements.map((m, idx) => (
                                    <div key={idx} style={{ borderLeft: '2px solid #10b981', paddingLeft: '12px', marginBottom: '10px', fontSize: '13px' }}>
                                        <strong>{m.movement_type}</strong> — {new Date(m.created_at).toLocaleString()}
                                        <div style={{ color: '#94a3b8' }}>{m.notes || m.eir_reference || 'Recorded'}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}