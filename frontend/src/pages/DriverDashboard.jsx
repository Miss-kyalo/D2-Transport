import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function DriverDashboard() {
    const [trips, setTrips] = useState([]);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(true);
    
    // Handover modal/form state per trip
    const [activeTripId, setActiveTripId] = useState(null);
    const [finalWeight, setFinalWeight] = useState('');
    const [handoverNotes, setHandoverNotes] = useState('');

    const navigate = useNavigate();
    const userString = localStorage.getItem('user');
    const user = userString ? JSON.parse(userString) : null;
    const driverId = user?.id;

    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        const fetchDriverTrips = async () => {
            try {
                const response = await api.get(`/trips/driver/${driverId}`);
                setTrips(response.data);
            } catch (err) {
                console.error("Error fetching driver trips:", err);
                setError("Failed to load your assigned routes.");
            } finally {
                setLoading(false);
            }
        };
        fetchDriverTrips();
    }, [driverId, refreshKey]);

    const handleHandoverSubmit = async (e, tripId) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        try {
            const res = await api.post(`/trips/${tripId}/handover`, {
                final_weight: finalWeight,
                handover_notes: handoverNotes
            });
            setSuccess(`Handover recorded! Status: ${res.data.trip.status}`);
            setActiveTripId(null);
            setFinalWeight('');
            setHandoverNotes('');
            setRefreshKey((k) => k + 1);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to submit handover.');
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    return (
        <div style={{ maxWidth: '800px', margin: '30px auto', fontFamily: 'sans-serif', padding: '20px', background: '#1e1e1e', color: '#fff', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #444', paddingBottom: '10px' }}>
                <h2>Driver Portal (ID: {driverId})</h2>
                <button onClick={handleLogout} style={{ padding: '8px 15px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    Logout
                </button>
            </div>

            {error && <p style={{ color: '#ff6b6b', background: 'rgba(255,0,0,0.1)', padding: '10px', borderRadius: '4px', marginTop: '15px' }}>{error}</p>}
            {success && <p style={{ color: '#51cf66', background: 'rgba(0,255,0,0.1)', padding: '10px', borderRadius: '4px', marginTop: '15px' }}>{success}</p>}

            <div style={{ marginTop: '20px' }}>
                <h3>Your Assigned Routes & Loads</h3>
                {loading ? (
                    <p>Loading active trips...</p>
                ) : trips.length === 0 ? (
                    <div style={{ background: '#2d2d2d', padding: '20px', borderRadius: '6px', textAlign: 'center', marginTop: '15px' }}>
                        <p style={{ color: '#aaa' }}>No active trips assigned to you yet.</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '15px', marginTop: '15px' }}>
                        {trips.map(trip => (
                            <div key={trip.id} style={{ background: '#2d2d2d', padding: '20px', borderRadius: '6px', borderLeft: '4px solid #007BFF' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                    <span style={{ fontWeight: 'bold', color: '#4dabf7' }}>Trip #{trip.id}</span>
                                    <span style={{ 
                                        background: '#383838', 
                                        padding: '2px 8px', 
                                        borderRadius: '4px', 
                                        fontSize: '0.9em',
                                        color: trip.status === 'Completed' ? '#51cf66' : trip.status === 'Flagged-Discrepancy' ? '#ff6b6b' : '#fcc419'
                                    }}>
                                        {trip.status}
                                    </span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                                    <div>
                                        <small style={{ color: '#aaa' }}>ROUTE</small>
                                        <p style={{ margin: '2px 0 0 0', fontWeight: 'bold' }}>{trip.origin} ➔ {trip.destination}</p>
                                    </div>
                                    <div>
                                        <small style={{ color: '#aaa' }}>ASSIGNED TRUCK</small>
                                        <p style={{ margin: '2px 0 0 0', fontWeight: 'bold' }}>{trip.plate_number || 'Unassigned'} ({trip.model || 'N/A'})</p>
                                    </div>
                                </div>
                                <div style={{ marginBottom: '10px' }}>
                                    <small style={{ color: '#aaa' }}>CARGO DESCRIPTION</small>
                                    <p style={{ margin: '2px 0 0 0' }}>{trip.cargo_description}</p>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <div>
                                        <small style={{ color: '#aaa' }}>INITIAL WEIGHBRIDGE</small>
                                        <p style={{ margin: '2px 0 0 0', color: '#51cf66', fontWeight: 'bold' }}>{trip.initial_weight} Tons</p>
                                    </div>
                                    {trip.final_weight && (
                                        <div>
                                            <small style={{ color: '#aaa' }}>FINAL WEIGHBRIDGE</small>
                                            <p style={{ margin: '2px 0 0 0', color: '#4dabf7', fontWeight: 'bold' }}>{trip.final_weight} Tons</p>
                                        </div>
                                    )}
                                </div>

                                {/* Handover Button / Form */}
                                {trip.status !== 'Completed' && trip.status !== 'Flagged-Discrepancy' && (
                                    <div style={{ marginTop: '15px', borderTop: '1px solid #444', paddingTop: '15px' }}>
                                        {activeTripId !== trip.id ? (
                                            <button 
                                                onClick={() => setActiveTripId(trip.id)} 
                                                style={{ width: '100%', padding: '8px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
                                            >
                                                Submit Destination Handover
                                            </button>
                                        ) : (
                                            <form onSubmit={(e) => handleHandoverSubmit(e, trip.id)}>
                                                <div style={{ marginBottom: '10px' }}>
                                                    <label style={{ fontSize: '0.9em' }}>Destination Weighbridge Weight (Tons):</label>
                                                    <input 
                                                        type="number" 
                                                        step="0.01" 
                                                        value={finalWeight} 
                                                        onChange={(e) => setFinalWeight(e.target.value)} 
                                                        required 
                                                        style={{ width: '100%', padding: '6px', background: '#1e1e1e', color: '#fff', border: '1px solid #444', borderRadius: '4px', marginTop: '4px' }} 
                                                    />
                                                </div>
                                                <div style={{ marginBottom: '10px' }}>
                                                    <label style={{ fontSize: '0.9em' }}>Handover / Inspection Notes:</label>
                                                    <input 
                                                        type="text" 
                                                        value={handoverNotes} 
                                                        onChange={(e) => setHandoverNotes(e.target.value)} 
                                                        placeholder="e.g. seals intact, no shortage" 
                                                        style={{ width: '100%', padding: '6px', background: '#1e1e1e', color: '#fff', border: '1px solid #444', borderRadius: '4px', marginTop: '4px' }} 
                                                    />
                                                </div>
                                                <div style={{ display: 'flex', gap: '10px' }}>
                                                    <button type="submit" style={{ flex: 1, padding: '8px', background: '#007BFF', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Complete Delivery</button>
                                                    <button type="button" onClick={() => setActiveTripId(null)} style={{ padding: '8px 15px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                                                </div>
                                            </form>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}