import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function ManufacturerDashboard() {
    const [trips, setTrips] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const userString = localStorage.getItem('user');
    const user = userString ? JSON.parse(userString) : null;

    const fetchManufacturerTrips = useCallback(async () => {
        try {
            const res = await api.get('/trips/manufacturer/my-trips');
            setTrips(res.data);
        } catch (err) {
            console.error("Error fetching manufacturer trips:", err);
            setError("Failed to load your dispatches.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchManufacturerTrips();
    }, [fetchManufacturerTrips]);

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    return (
        <div style={{ maxWidth: '1100px', margin: '30px auto', fontFamily: 'sans-serif', padding: '20px', background: '#1e1e1e', color: '#fff', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #444', paddingBottom: '10px' }}>
                <h2>💼 Manufacturer Portal — {user?.company_name || user?.name || 'Shipper'}</h2>
                <button onClick={handleLogout} style={{ padding: '8px 15px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    Logout
                </button>
            </div>

            {error && <p style={{ color: '#ff6b6b', background: 'rgba(255,0,0,0.1)', padding: '10px', borderRadius: '4px', marginTop: '15px' }}>{error}</p>}

            <div style={{ marginTop: '25px' }}>
                <h3>Your Active Dispatches & QR Tracking</h3>
                {loading ? (
                    <p>Loading your shipments...</p>
                ) : trips.length === 0 ? (
                    <div style={{ background: '#2d2d2d', padding: '20px', borderRadius: '6px', textAlign: 'center', marginTop: '15px' }}>
                        <p style={{ color: '#aaa' }}>No dispatches found under your manufacturer account.</p>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px', background: '#2d2d2d' }}>
                        <thead>
                            <tr style={{ background: '#383838', textAlign: 'left' }}>
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
                                <tr key={trip.id} style={{ borderBottom: '1px solid #444' }}>
                                    <td style={{ padding: '10px' }}>#{trip.id}</td>
                                    <td style={{ padding: '10px', fontWeight: 'bold', color: '#ffd43b' }}>{trip.tracking_code}</td>
                                    <td style={{ padding: '10px' }}>{trip.consignee_name || 'N/A'}</td>
                                    <td style={{ padding: '10px' }}>{trip.origin} ➔ {trip.destination}</td>
                                    <td style={{ padding: '10px' }}>{trip.cargo_description} ({trip.initial_weight}t)</td>
                                    <td style={{ padding: '10px', color: '#4dabf7' }}>{trip.status}</td>
                                    <td style={{ padding: '10px' }}>
                                        <button 
                                            onClick={() => alert(`Tracking Link for Buyer:\nhttp://localhost:5173/track/${trip.tracking_code}`)}
                                            style={{ padding: '6px 10px', background: '#007BFF', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85em' }}
                                        >
                                            Get Waybill Link
                                        </button>
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