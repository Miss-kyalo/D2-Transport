import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function DriverDashboard() {
    const [trips, setTrips] = useState([]);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(true);
    
    // Handover modal state per trip
    const [activeTripId, setActiveTripId] = useState(null);
    const [finalWeight, setFinalWeight] = useState('');
    const [clientReceivedStamp, setClientReceivedStamp] = useState(false);
    const [clientStampNotes, setClientStampNotes] = useState('');
    const [handoverNotes, setHandoverNotes] = useState('');

    // OCR Upload loading state per trip
    const [uploadingTripId, setUploadingTripId] = useState(null);

    const navigate = useNavigate();
    const userString = localStorage.getItem('user');
    const user = userString ? JSON.parse(userString) : null;
    const driverId = user?.id;

    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        let active = true;
        const loadDriverTrips = async () => {
            try {
                const response = await api.get(`/trips/driver/${driverId}`);
                if (active) {
                    setTrips(response.data);
                    setError('');
                }
            } catch (err) {
                console.error("Error fetching driver trips:", err);
                if (active) setError(err.response?.data?.error || "Failed to load your assigned routes.");
            } finally {
                if (active) setLoading(false);
            }
        };

        loadDriverTrips();
        return () => {
            active = false;
        };
    }, [driverId, refreshKey]);

    const handleDeliveryNoteUpload = async (e, tripId) => {
        const file = e.target.files[0];
        if (!file) return;

        setError('');
        setSuccess('');
        setUploadingTripId(tripId);

        const formData = new FormData();
        formData.append('delivery_note', file);

        try {
            const res = await api.post(`/trips/${tripId}/upload-note`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setSuccess(`Success! OCR Verified Client: ${res.data.ocr_data.client} (Security Stamp Confirmed). Status: In-Transit`);
            setRefreshKey((k) => k + 1);
        } catch (err) {
            setError(err.response?.data?.error || 'OCR verification failed.');
        } finally {
            setUploadingTripId(null);
        }
    };

    const handleHandoverSubmit = async (e, tripId) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        try {
            const res = await api.post(`/trips/${tripId}/handover`, {
                final_weight: finalWeight,
                client_received_stamp: clientReceivedStamp,
                client_stamp_notes: clientStampNotes,
                handover_notes: handoverNotes
            });
            setSuccess(`Handover recorded! Status: ${res.data.trip.status} (Variance: ${res.data.variance} tons)`);
            setActiveTripId(null);
            setFinalWeight('');
            setClientReceivedStamp(false);
            setClientStampNotes('');
            setHandoverNotes('');
            setRefreshKey((k) => k + 1);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to submit handover.');
        }
    };

    const handleBroadcastGPS = async (tripId) => {
        setError('');
        setSuccess('');
        // Simulated GPS coordinates along transit corridors
        const lat = -1.2863 + (Math.random() - 0.5) * 0.1;
        const lng = 36.8172 + (Math.random() - 0.5) * 0.1;
        try {
            await api.patch(`/trips/${tripId}/location`, { lat, lng });
            setSuccess(`Live GPS telemetry broadcast successfully! (Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)})`);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update GPS telemetry.');
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    return (
        <div style={{ maxWidth: '900px', margin: '30px auto', fontFamily: 'sans-serif', padding: '24px', background: '#0E1A14', color: '#F8F6F0', borderRadius: '8px', border: '1px solid rgba(184, 155, 106, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(184, 155, 106, 0.3)', paddingBottom: '15px' }}>
                <div>
                    <h2 style={{ margin: 0, color: '#F8F6F0' }}>Driver Portal</h2>
                    <small style={{ color: '#B89B6A' }}>Driver ID: {driverId} | Security Stamp & OCR Verification</small>
                </div>
                <button onClick={handleLogout} style={{ padding: '8px 16px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                    Logout
                </button>
            </div>

            {error && <p style={{ color: '#ff6b6b', background: 'rgba(255,0,0,0.12)', padding: '10px', borderRadius: '4px', marginTop: '15px' }}>{error}</p>}
            {success && <p style={{ color: '#51cf66', background: 'rgba(0,255,0,0.12)', padding: '10px', borderRadius: '4px', marginTop: '15px' }}>{success}</p>}

            <div style={{ marginTop: '25px' }}>
                <h3 style={{ color: '#B89B6A' }}>Your Assigned Routes & Loads</h3>
                {loading ? (
                    <p>Loading active trips...</p>
                ) : trips.length === 0 ? (
                    <div style={{ background: '#16261E', padding: '25px', borderRadius: '6px', textAlign: 'center', marginTop: '15px', border: '1px solid rgba(184, 155, 106, 0.2)' }}>
                        <p style={{ color: '#C8C5BC' }}>No active trips assigned to you yet.</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '20px', marginTop: '15px' }}>
                        {trips.map(trip => (
                            <div key={trip.id} style={{ background: '#16261E', padding: '20px', borderRadius: '6px', borderLeft: '4px solid #B89B6A', border: '1px solid rgba(184, 155, 106, 0.2)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                    <span style={{ fontWeight: 'bold', color: '#B89B6A' }}>Trip #{trip.id} (Tracking Code: {trip.tracking_code})</span>
                                    <span style={{ 
                                        background: '#0E1A14', 
                                        padding: '4px 10px', 
                                        borderRadius: '4px', 
                                        fontSize: '0.85em',
                                        border: '1px solid rgba(184, 155, 106, 0.3)',
                                        color: trip.status === 'Completed' ? '#51cf66' : trip.status === 'Flagged-Discrepancy' ? '#ff6b6b' : '#fcc419'
                                    }}>
                                        {trip.status}
                                    </span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '12px', fontSize: '0.9em' }}>
                                    <div>
                                        <small style={{ color: '#C8C5BC' }}>ROUTE</small>
                                        <p style={{ margin: '2px 0 0 0', fontWeight: 'bold' }}>{trip.origin} &rarr; {trip.destination}</p>
                                    </div>
                                    <div>
                                        <small style={{ color: '#C8C5BC' }}>ASSIGNED TRUCK</small>
                                        <p style={{ margin: '2px 0 0 0', fontWeight: 'bold' }}>{trip.plate_number || 'Unassigned'} ({trip.model || 'N/A'})</p>
                                    </div>
                                </div>
                                <div style={{ marginBottom: '12px', fontSize: '0.9em' }}>
                                    <small style={{ color: '#C8C5BC' }}>CARGO & CONSIGNEE</small>
                                    <p style={{ margin: '2px 0 0 0' }}>{trip.cargo_description} &mdash; Buyer: <strong>{trip.consignee_name || 'N/A'}</strong></p>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', fontSize: '0.9em' }}>
                                    <div>
                                        <small style={{ color: '#C8C5BC' }}>INITIAL WEIGHBRIDGE</small>
                                        <p style={{ margin: '2px 0 0 0', color: '#51cf66', fontWeight: 'bold' }}>{trip.initial_weight} Tons</p>
                                    </div>
                                    {trip.final_weight && (
                                        <div>
                                            <small style={{ color: '#C8C5BC' }}>FINAL WEIGHBRIDGE</small>
                                            <p style={{ margin: '2px 0 0 0', color: '#4dabf7', fontWeight: 'bold' }}>{trip.final_weight} Tons</p>
                                        </div>
                                    )}
                                </div>

                                {/* STEP 1: Upload Delivery Note for OCR Stamp Verification */}
                                {trip.status === 'Scheduled' && (
                                    <div style={{ marginTop: '15px', borderTop: '1px solid rgba(184, 155, 106, 0.2)', paddingTop: '15px', background: 'rgba(184, 155, 106, 0.05)', padding: '15px', borderRadius: '4px' }}>
                                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', fontSize: '0.9em', color: '#B89B6A' }}>
                                            Upload Manufacturer Delivery Note (OCR Security Stamp Check):
                                        </label>
                                        <input 
                                            type="file" 
                                            accept="image/*,.pdf" 
                                            onChange={(e) => handleDeliveryNoteUpload(e, trip.id)}
                                            disabled={uploadingTripId === trip.id}
                                            style={{ color: '#fff', fontSize: '0.9em' }}
                                        />
                                        {uploadingTripId === trip.id && <p style={{ fontSize: '0.85em', color: '#fcc419', marginTop: '6px' }}>Processing OCR and verifying manufacturer security stamp...</p>}
                                    </div>
                                )}

                                {/* STEP 2: Live GPS Telemetry Broadcast & Destination Handover */}
                                {trip.status === 'In-Transit' && (
                                    <div style={{ marginTop: '15px', borderTop: '1px solid rgba(184, 155, 106, 0.2)', paddingTop: '15px' }}>
                                        <div style={{ marginBottom: '15px', background: 'rgba(0,123,255,0.08)', padding: '12px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.9em' }}>Broadcast Live GPS Location along Route</span>
                                            <button 
                                                onClick={() => handleBroadcastGPS(trip.id)}
                                                style={{ padding: '6px 12px', background: '#007BFF', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85em', fontWeight: 'bold' }}
                                            >
                                                Send GPS Ping 📡
                                            </button>
                                        </div>

                                        {activeTripId !== trip.id ? (
                                            <button 
                                                onClick={() => setActiveTripId(trip.id)} 
                                                style={{ width: '100%', padding: '10px', background: '#004225', color: '#F8F6F0', border: '1px solid #B89B6A', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
                                            >
                                                Submit Destination Handover & Client Stamp
                                            </button>
                                        ) : (
                                            <form onSubmit={(e) => handleHandoverSubmit(e, trip.id)} style={{ background: '#0E1A14', padding: '15px', borderRadius: '6px', border: '1px solid rgba(184, 155, 106, 0.3)' }}>
                                                <div style={{ marginBottom: '12px' }}>
                                                    <label style={{ fontSize: '0.85em', color: '#C8C5BC' }}>Destination Weighbridge Weight (Tons) *</label>
                                                    <input 
                                                        type="number" 
                                                        step="0.01" 
                                                        value={finalWeight} 
                                                        onChange={(e) => setFinalWeight(e.target.value)} 
                                                        required 
                                                        style={{ width: '100%', padding: '8px', background: '#16261E', color: '#fff', border: '1px solid #444', borderRadius: '4px', marginTop: '4px', boxSizing: 'border-box' }} 
                                                    />
                                                </div>

                                                <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <input 
                                                        type="checkbox" 
                                                        id={`stamp-${trip.id}`} 
                                                        checked={clientReceivedStamp} 
                                                        onChange={(e) => setClientReceivedStamp(e.target.checked)} 
                                                        required 
                                                    />
                                                    <label htmlFor={`stamp-${trip.id}`} style={{ fontSize: '0.9em', cursor: 'pointer', color: '#51cf66', fontWeight: 'bold' }}>
                                                        Client Received Stamp Confirmed at Offloading Zone *
                                                    </label>
                                                </div>

                                                <div style={{ marginBottom: '12px' }}>
                                                    <label style={{ fontSize: '0.85em', color: '#C8C5BC' }}>Client Stamp / Consignee Notes</label>
                                                    <input 
                                                        type="text" 
                                                        value={clientStampNotes} 
                                                        onChange={(e) => setClientStampNotes(e.target.value)} 
                                                        placeholder="e.g. Received by store manager John" 
                                                        style={{ width: '100%', padding: '8px', background: '#16261E', color: '#fff', border: '1px solid #444', borderRadius: '4px', marginTop: '4px', boxSizing: 'border-box' }} 
                                                    />
                                                </div>

                                                <div style={{ marginBottom: '15px' }}>
                                                    <label style={{ fontSize: '0.85em', color: '#C8C5BC' }}>General Inspection / Handover Notes</label>
                                                    <input 
                                                        type="text" 
                                                        value={handoverNotes} 
                                                        onChange={(e) => setHandoverNotes(e.target.value)} 
                                                        placeholder="e.g. seals intact, no shortage" 
                                                        style={{ width: '100%', padding: '8px', background: '#16261E', color: '#fff', border: '1px solid #444', borderRadius: '4px', marginTop: '4px', boxSizing: 'border-box' }} 
                                                    />
                                                </div>

                                                <div style={{ display: 'flex', gap: '10px' }}>
                                                    <button type="submit" style={{ flex: 1, padding: '10px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Complete Delivery</button>
                                                    <button type="button" onClick={() => setActiveTripId(null)} style={{ padding: '10px 15px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
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