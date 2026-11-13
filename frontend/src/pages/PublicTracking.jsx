import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';

export default function PublicTracking() {
    const { trackingCode } = useParams();
    const [codeQuery, setCodeQuery] = useState(trackingCode || '');
    const [trackingData, setTrackingData] = useState(null);
    const [error, setError] = useState('');
    const [manualLoading, setManualLoading] = useState(false);
    const [loadedTrackingCode, setLoadedTrackingCode] = useState('');
    const loading = manualLoading || Boolean(trackingCode && loadedTrackingCode !== trackingCode);
    const navigate = useNavigate();

    const fetchTrackingInfo = async (codeToFetch) => {
        const targetCode = codeToFetch || codeQuery;
        if (!targetCode) return;
        setManualLoading(true);
        setError('');
        try {
            const res = await api.get(`/trips/public/track/${encodeURIComponent(targetCode)}`);
            setTrackingData(res.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Shipment not found.');
            setTrackingData(null);
        } finally {
            setManualLoading(false);
        }
    };

    useEffect(() => {
        if (!trackingCode) return;

        let active = true;
        const loadTrackingInfo = async () => {
            try {
                const res = await api.get(`/trips/public/track/${encodeURIComponent(trackingCode)}`);
                if (active) {
                    setTrackingData(res.data);
                    setError('');
                }
            } catch (err) {
                if (active) {
                    setError(err.response?.data?.error || 'Shipment not found.');
                    setTrackingData(null);
                }
            } finally {
                if (active) setLoadedTrackingCode(trackingCode);
            }
        };

        loadTrackingInfo();
        return () => {
            active = false;
        };
    }, [trackingCode]);

    return (
        <div style={{ maxWidth: '800px', margin: '40px auto', fontFamily: 'sans-serif', padding: '24px', background: '#0E1A14', color: '#F8F6F0', borderRadius: '8px', border: '1px solid rgba(184, 155, 106, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(184, 155, 106, 0.3)', paddingBottom: '15px' }}>
                <div>
                    <h2 style={{ margin: 0, color: '#F8F6F0' }}>📦 D2-Transport Public Waybill & QR Tracking</h2>
                    <small style={{ color: '#B89B6A' }}>Chain-of-Custody & Live Audit Portal</small>
                </div>
                <button onClick={() => navigate('/login')} style={{ padding: '8px 16px', background: '#004225', color: '#F8F6F0', border: '1px solid #B89B6A', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                    Staff Login
                </button>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                <input 
                    type="text" 
                    placeholder="Enter Tracking Code (e.g. D2-849201)" 
                    value={codeQuery} 
                    onChange={(e) => setCodeQuery(e.target.value)}
                    style={{ flex: 1, padding: '10px', background: '#16261E', color: '#fff', border: '1px solid #444', borderRadius: '4px', boxSizing: 'border-box' }}
                />
                <button 
                    onClick={() => fetchTrackingInfo()}
                    style={{ padding: '10px 20px', background: '#004225', color: '#F8F6F0', border: '1px solid #B89B6A', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                    Track Load
                </button>
            </div>

            {error && <p style={{ color: '#ff6b6b', background: 'rgba(255,0,0,0.12)', padding: '10px', borderRadius: '4px', marginTop: '20px' }}>{error}</p>}
            {loading && <p style={{ marginTop: '20px', color: '#C8C5BC' }}>Searching shipment records...</p>}

            {trackingData && !loading && (
                <div style={{ marginTop: '25px', background: '#16261E', padding: '20px', borderRadius: '6px', border: '1px solid rgba(184, 155, 106, 0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(184, 155, 106, 0.2)', paddingBottom: '12px' }}>
                        <div>
                            <small style={{ color: '#C8C5BC' }}>TRACKING CODE</small>
                            <h3 style={{ margin: '2px 0 0 0', color: '#B89B6A' }}>{trackingData.trip.tracking_code}</h3>
                        </div>
                        <span style={{ 
                            padding: '6px 12px', 
                            background: '#0E1A14', 
                            borderRadius: '4px', 
                            fontWeight: 'bold', 
                            border: '1px solid rgba(184, 155, 106, 0.3)',
                            color: trackingData.trip.status === 'Completed' ? '#51cf66' : trackingData.trip.status === 'Flagged-Discrepancy' ? '#ff6b6b' : '#4dabf7' 
                        }}>
                            {trackingData.trip.status}
                        </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px', fontSize: '0.9em' }}>
                        <div>
                            <small style={{ color: '#C8C5BC' }}>ROUTE</small>
                            <p style={{ margin: '2px 0 0 0', fontWeight: 'bold' }}>{trackingData.trip.origin} &rarr; {trackingData.trip.destination}</p>
                        </div>
                        <div>
                            <small style={{ color: '#C8C5BC' }}>SHIPPER (MANUFACTURER)</small>
                            <p style={{ margin: '2px 0 0 0', fontWeight: 'bold' }}>{trackingData.trip.manufacturer_name || 'Direct Dispatch'}</p>
                        </div>
                        <div>
                            <small style={{ color: '#C8C5BC' }}>CONSIGNEE (BUYER)</small>
                            <p style={{ margin: '2px 0 0 0', fontWeight: 'bold' }}>{trackingData.trip.consignee_name || 'N/A'}</p>
                        </div>
                        <div>
                            <small style={{ color: '#C8C5BC' }}>CARGO & WEIGHT</small>
                            <p style={{ margin: '2px 0 0 0', fontWeight: 'bold' }}>{trackingData.trip.cargo_description} ({trackingData.trip.initial_weight} Tons)</p>
                        </div>
                    </div>

                    {/* Chain of Custody Legs */}
                    <div style={{ marginTop: '20px', borderTop: '1px solid rgba(184, 155, 106, 0.2)', paddingTop: '15px' }}>
                        <h4 style={{ color: '#B89B6A', marginTop: 0 }}>Chain-of-Custody & Transit Legs</h4>
                        {trackingData.legs.map(leg => (
                            <div key={leg.id} style={{ background: '#0E1A14', padding: '12px', borderRadius: '4px', marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(184, 155, 106, 0.15)' }}>
                                <div style={{ fontSize: '0.9em' }}>
                                    <strong>Leg #{leg.leg_number}</strong> &mdash; Truck: <code style={{ color: '#B89B6A' }}>{leg.plate_number || 'Rescue Unit'}</code> (Driver: {leg.driver_name || 'Assigned'})
                                </div>
                                <span style={{ color: leg.status === 'Active' ? '#51cf66' : '#C8C5BC', fontSize: '0.85em', fontWeight: 'bold' }}>{leg.status}</span>
                            </div>
                        ))}
                    </div>

                    {/* Incident & Rescue Logs */}
                    {trackingData.incidents.length > 0 && (
                        <div style={{ marginTop: '20px', borderTop: '1px solid rgba(184, 155, 106, 0.2)', paddingTop: '15px' }}>
                            <h4 style={{ color: '#B89B6A', marginTop: 0 }}>Incident & Transshipment Audit Log</h4>
                            {trackingData.incidents.map(inc => (
                                <div key={inc.id} style={{ background: 'rgba(252, 196, 25, 0.08)', borderLeft: '4px solid #fcc419', padding: '10px', borderRadius: '4px', marginTop: '8px', fontSize: '0.9em' }}>
                                    <strong>{inc.incident_type}</strong> at <em>{inc.location_name}</em>: {inc.description}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}