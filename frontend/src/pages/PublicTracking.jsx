import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function PublicTracking() {
    const { trackingCode } = useParams();
    const [codeQuery, setCodeQuery] = useState(trackingCode || '');
    const [trackingData, setTrackingData] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const fetchTrackingInfo = async (codeToFetch) => {
        const targetCode = codeToFetch || codeQuery;
        if (!targetCode) return;
        setLoading(true);
        setError('');
        try {
            const res = await axios.get(`http://localhost:5000/api/trips/public/track/${targetCode}`);
            setTrackingData(res.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Shipment not found.');
            setTrackingData(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (trackingCode) {
            fetchTrackingInfo(trackingCode);
        }
    }, [trackingCode]);

    return (
        <div style={{ maxWidth: '800px', margin: '40px auto', fontFamily: 'sans-serif', padding: '20px', background: '#1e1e1e', color: '#fff', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #444', paddingBottom: '15px' }}>
                <h2>📦 D2-Transport Public Waybill & QR Tracking</h2>
                <button onClick={() => navigate('/login')} style={{ padding: '6px 12px', background: '#007BFF', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    Staff Login
                </button>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                <input 
                    type="text" 
                    placeholder="Enter Tracking Code (e.g. D2-849201)" 
                    value={codeQuery} 
                    onChange={(e) => setCodeQuery(e.target.value)}
                    style={{ flex: 1, padding: '10px', background: '#2d2d2d', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}
                />
                <button 
                    onClick={() => fetchTrackingInfo()}
                    style={{ padding: '10px 20px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                    Track Load
                </button>
            </div>

            {error && <p style={{ color: '#ff6b6b', background: 'rgba(255,0,0,0.1)', padding: '10px', borderRadius: '4px', marginTop: '20px' }}>{error}</p>}
            {loading && <p style={{ marginTop: '20px' }}>Searching shipment records...</p>}

            {trackingData && (
                <div style={{ marginTop: '25px', background: '#2d2d2d', padding: '20px', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #444', paddingBottom: '10px' }}>
                        <div>
                            <small style={{ color: '#aaa' }}>TRACKING CODE</small>
                            <h3 style={{ margin: '2px 0 0 0', color: '#ffd43b' }}>{trackingData.trip.tracking_code}</h3>
                        </div>
                        <span style={{ padding: '4px 10px', background: '#383838', borderRadius: '4px', fontWeight: 'bold', color: '#4dabf7' }}>
                            {trackingData.trip.status}
                        </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px' }}>
                        <div>
                            <small style={{ color: '#aaa' }}>ROUTE</small>
                            <p style={{ margin: '2px 0 0 0', fontWeight: 'bold' }}>{trackingData.trip.origin} ➔ {trackingData.trip.destination}</p>
                        </div>
                        <div>
                            <small style={{ color: '#aaa' }}>SHIPPER (MANUFACTURER)</small>
                            <p style={{ margin: '2px 0 0 0', fontWeight: 'bold' }}>{trackingData.trip.manufacturer_name || 'Direct Dispatch'}</p>
                        </div>
                        <div>
                            <small style={{ color: '#aaa' }}>CONSIGNEE (BUYER)</small>
                            <p style={{ margin: '2px 0 0 0', fontWeight: 'bold' }}>{trackingData.trip.consignee_name || 'N/A'}</p>
                        </div>
                        <div>
                            <small style={{ color: '#aaa' }}>CARGO & WEIGHT</small>
                            <p style={{ margin: '2px 0 0 0', fontWeight: 'bold' }}>{trackingData.trip.cargo_description} ({trackingData.trip.initial_weight} Tons)</p>
                        </div>
                    </div>

                    {/* Chain of Custody Legs */}
                    <div style={{ marginTop: '20px', borderTop: '1px solid #444', paddingTop: '15px' }}>
                        <h4>Chain-of-Custody & Transit Legs</h4>
                        {trackingData.legs.map(leg => (
                            <div key={leg.id} style={{ background: '#1e1e1e', padding: '10px', borderRadius: '4px', marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <strong>Leg #{leg.leg_number}</strong> — Truck: <code>{leg.plate_number || 'Rescue Unit'}</code> (Driver: {leg.driver_name || 'Assigned'})
                                </div>
                                <span style={{ color: leg.status === 'Active' ? '#51cf66' : '#aaa', fontSize: '0.9em' }}>{leg.status}</span>
                            </div>
                        ))}
                    </div>

                    {/* Incident & Rescue Logs */}
                    {trackingData.incidents.length > 0 && (
                        <div style={{ marginTop: '20px', borderTop: '1px solid #444', paddingTop: '15px' }}>
                            <h4>Incident & Transshipment Audit Log</h4>
                            {trackingData.incidents.map(inc => (
                                <div key={inc.id} style={{ background: 'rgba(255, 193, 7, 0.1)', borderLeft: '4px solid #fcc419', padding: '10px', borderRadius: '4px', marginTop: '8px' }}>
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