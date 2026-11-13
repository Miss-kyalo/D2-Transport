import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function ManufacturerDashboard() {
    const [trips, setTrips] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const userString = localStorage.getItem('user');
    const user = userString ? JSON.parse(userString) : null;

    useEffect(() => {
        let active = true;
        const loadManufacturerTrips = async () => {
            try {
                const res = await api.get('/trips/manufacturer/my-trips');
                if (active) {
                    setTrips(res.data);
                    setError('');
                }
            } catch (err) {
                console.error("Error fetching manufacturer trips:", err);
                if (active) setError(err.response?.data?.error || "Failed to load your dispatches.");
            } finally {
                if (active) setLoading(false);
            }
        };

        loadManufacturerTrips();
        return () => {
            active = false;
        };
    }, []);

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    return (
        <div style={{ maxWidth: '1100px', margin: '30px auto', fontFamily: 'sans-serif', padding: '24px', background: '#0E1A14', color: '#F8F6F0', borderRadius: '8px', border: '1px solid rgba(184, 155, 106, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(184, 155, 106, 0.3)', paddingBottom: '15px' }}>
                <div>
                    <h2 style={{ margin: 0, color: '#F8F6F0' }}>Manufacturer Portal — {user?.company_name || user?.username || 'Shipper'}</h2>
                    <small style={{ color: '#B89B6A' }}>Plant Dispatch & Security Stamp Audits</small>
                </div>
                <button onClick={handleLogout} style={{ padding: '8px 16px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                    Logout
                </button>
            </div>

            {error && <p style={{ color: '#ff6b6b', background: 'rgba(255,0,0,0.12)', padding: '10px', borderRadius: '4px', marginTop: '15px' }}>{error}</p>}

            <div style={{ marginTop: '25px' }}>
                <h3 style={{ color: '#B89B6A' }}>Your Active Dispatches & QR Tracking</h3>
                {loading ? (
                    <p>Loading your shipments...</p>
                ) : trips.length === 0 ? (
                    <div style={{ background: '#16261E', padding: '25px', borderRadius: '6px', textAlign: 'center', marginTop: '15px', border: '1px solid rgba(184, 155, 106, 0.2)' }}>
                        <p style={{ color: '#C8C5BC' }}>No dispatches found under your manufacturer account.</p>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px', background: '#16261E', border: '1px solid rgba(184, 155, 106, 0.2)' }}>
                        <thead>
                            <tr style={{ background: '#004225', textAlign: 'left', color: '#F8F6F0' }}>
                                <th style={{ padding: '10px' }}>Trip ID</th>
                                <th style={{ padding: '10px' }}>Tracking Code</th>
                                <th style={{ padding: '10px' }}>Consignee (Buyer)</th>
                                <th style={{ padding: '10px' }}>Route</th>
                                <th style={{ padding: '10px' }}>Cargo</th>
                                <th style={{ padding: '10px' }}>Status</th>
                                <th style={{ padding: '10px' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {trips.map(trip => (
                                <tr key={trip.id} style={{ borderBottom: '1px solid rgba(184, 155, 106, 0.15)' }}>
                                    <td style={{ padding: '10px' }}>#{trip.id}</td>
                                    <td style={{ padding: '10px', fontWeight: 'bold', color: '#B89B6A' }}>{trip.tracking_code}</td>
                                    <td style={{ padding: '10px' }}>{trip.consignee_name || 'N/A'}</td>
                                    <td style={{ padding: '10px' }}>{trip.origin} &rarr; {trip.destination}</td>
                                    <td style={{ padding: '10px' }}>{trip.cargo_description} ({trip.initial_weight}t)</td>
                                    <td style={{ padding: '10px', fontWeight: 'bold', color: trip.status === 'Completed' ? '#51cf66' : trip.status === 'Flagged-Discrepancy' ? '#ff6b6b' : '#fcc419' }}>{trip.status}</td>
                                    <td style={{ padding: '10px', display: 'flex', gap: '6px' }}>
                                        {trip.tracking_code && (
                                            <>
                                                <button 
                                                    onClick={() => navigate(`/waybill/${trip.tracking_code}`)}
                                                    style={{ padding: '6px 10px', background: '#B89B6A', color: '#0E1A14', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85em', fontWeight: 'bold' }}
                                                >
                                                    Waybill
                                                </button>
                                                <button 
                                                    onClick={() => navigate(`/track/${trip.tracking_code}`)}
                                                    style={{ padding: '6px 10px', background: '#004225', color: '#F8F6F0', border: '1px solid #B89B6A', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85em', fontWeight: 'bold' }}
                                                >
                                                    Track Live
                                                </button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}