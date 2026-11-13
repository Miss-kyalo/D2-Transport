import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function ClientDashboard() {
    const [incomingShipments, setIncomingShipments] = useState([]);
    const [trackingInput, setTrackingInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const userString = localStorage.getItem('user');
    const user = userString ? JSON.parse(userString) : null;

    useEffect(() => {
        let active = true;
        const loadShipments = async () => {
            try {
                const res = await api.get('/trips/client/my-trips');
                if (active) setIncomingShipments(res.data);
            } catch (err) {
                console.error("Error loading client shipments:", err);
                if (active) setError(err.response?.data?.error || "Failed to load incoming shipments.");
            } finally {
                if (active) setLoading(false);
            }
        };

        loadShipments();
        return () => {
            active = false;
        };
    }, []);

    const handleQuickTrack = (e) => {
        e.preventDefault();
        if (!trackingInput.trim()) return;
        navigate(`/track/${trackingInput.trim().toUpperCase()}`);
    };

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    return (
        <div style={{ maxWidth: '900px', margin: '30px auto', fontFamily: 'sans-serif', padding: '24px', background: '#0E1A14', color: '#F8F6F0', borderRadius: '8px', border: '1px solid rgba(184, 155, 106, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(184, 155, 106, 0.3)', paddingBottom: '15px' }}>
                <div>
                    <h2 style={{ margin: 0, color: '#F8F6F0' }}>Client & Consignee Portal</h2>
                    <small style={{ color: '#B89B6A' }}>Welcome, {user?.username || 'Valued Client'} | Live Freight Tracking</small>
                </div>
                <button onClick={handleLogout} style={{ padding: '8px 16px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                    Logout
                </button>
            </div>

            {error && <p style={{ color: '#ff6b6b', background: 'rgba(255,0,0,0.12)', padding: '10px', borderRadius: '4px', marginTop: '15px' }}>{error}</p>}

            {/* Quick Track Bar */}
            <div style={{ marginTop: '25px', background: '#16261E', padding: '20px', borderRadius: '6px', border: '1px solid rgba(184, 155, 106, 0.25)' }}>
                <h3 style={{ marginTop: 0, color: '#B89B6A' }}>Track Shipment by Code</h3>
                <form onSubmit={handleQuickTrack} style={{ display: 'flex', gap: '10px' }}>
                    <input 
                        type="text" 
                        placeholder="Enter Tracking Code (e.g. D2-482910)" 
                        value={trackingInput} 
                        onChange={(e) => setTrackingInput(e.target.value)} 
                        required 
                        style={{ flex: 1, padding: '10px', background: '#0E1A14', color: '#fff', border: '1px solid #444', borderRadius: '4px', boxSizing: 'border-box' }} 
                    />
                    <button type="submit" style={{ padding: '10px 20px', background: '#004225', color: '#F8F6F0', border: '1px solid #B89B6A', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                        Track Live
                    </button>
                </form>
            </div>

            {/* Incoming / Monitored Shipments */}
            <div style={{ marginTop: '30px' }}>
                <h3 style={{ color: '#B89B6A', marginBottom: '15px' }}>Monitored Shipments & Chain-of-Custody</h3>
                {loading ? (
                    <p>Loading shipment records...</p>
                ) : incomingShipments.length === 0 ? (
                    <div style={{ background: '#16261E', padding: '20px', borderRadius: '6px', textAlign: 'center' }}>
                        <p style={{ color: '#C8C5BC' }}>No shipments currently registered.</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '15px' }}>
                        {incomingShipments.map(shipment => (
                            <div key={shipment.id} style={{ background: '#16261E', padding: '18px', borderRadius: '6px', border: '1px solid rgba(184, 155, 106, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <span style={{ fontWeight: 'bold', color: '#B89B6A' }}>{shipment.tracking_code}</span>
                                    <p style={{ margin: '4px 0', fontSize: '0.9em' }}>{shipment.origin} &rarr; {shipment.destination}</p>
                                    <small style={{ color: '#C8C5BC' }}>Cargo: {shipment.cargo_description} ({shipment.initial_weight} Tons)</small>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <span style={{ 
                                        background: '#0E1A14', 
                                        padding: '4px 8px', 
                                        borderRadius: '4px', 
                                        fontSize: '0.85em', 
                                        border: '1px solid rgba(184, 155, 106, 0.3)',
                                        color: shipment.status === 'Completed' ? '#51cf66' : shipment.status === 'Flagged-Discrepancy' ? '#ff6b6b' : '#fcc419'
                                    }}>
                                        {shipment.status}
                                    </span>
                                    <div style={{ marginTop: '10px' }}>
                                        <button 
                                            onClick={() => navigate(`/track/${shipment.tracking_code}`)}
                                            style={{ padding: '6px 12px', background: '#B89B6A', color: '#0E1A14', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85em' }}
                                        >
                                            View Waybill Audit
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}