import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function DriverDashboard() {
    const navigate = useNavigate();
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [uploadingTripId, setUploadingTripId] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [handoverTrip, setHandoverTrip] = useState(null);
    const [incidentTrip, setIncidentTrip] = useState(null);
    const [handoverForm, setHandoverForm] = useState({
        finalWeight: '',
        clientStamp: false,
        stampNotes: '',
        notes: ''
    });
    const [incidentForm, setIncidentForm] = useState({
        type: 'Delay',
        location: '',
        description: ''
    });

    let user = null;
    try {
        user = JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
        localStorage.clear();
    }
    const driverId = user?.id;

    useEffect(() => {
        if (!driverId) {
            navigate('/login', { replace: true });
            return;
        }

        let active = true;
        api.get(`/trips/driver/${driverId}`)
            .then((response) => {
                if (active) {
                    setTrips(Array.isArray(response.data) ? response.data : []);
                    setError('');
                }
            })
            .catch((requestError) => {
                if (active) {
                    setError(requestError.response?.data?.error || 'Failed to load assigned trips.');
                }
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [driverId, navigate, refreshKey]);

    const refreshTrips = () => {
        setLoading(true);
        setRefreshKey((key) => key + 1);
    };

    const uploadDeliveryNote = async (event, tripId) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('delivery_note', file);
        setUploadingTripId(tripId);
        setError('');
        setSuccess('');

        try {
            const response = await api.post(`/trips/${tripId}/upload-note`, formData);
            setSuccess(response.data.message || 'Delivery note uploaded.');
            event.target.value = '';
            refreshTrips();
        } catch (requestError) {
            setError(requestError.response?.data?.error || 'Delivery note upload failed.');
        } finally {
            setUploadingTripId(null);
        }
    };

    const broadcastLocation = async (tripId) => {
        setError('');
        setSuccess('');
        if (!navigator.geolocation) {
            setError('Geolocation is not supported by this browser.');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async ({ coords }) => {
                try {
                    await api.patch(`/trips/${tripId}/location`, {
                        lat: coords.latitude,
                        lng: coords.longitude
                    });
                    setSuccess('Live GPS location updated.');
                } catch (requestError) {
                    setError(requestError.response?.data?.error || 'Failed to update GPS location.');
                }
            },
            () => setError('Location permission is required to broadcast GPS.')
        );
    };

    const submitIncident = async (event) => {
        event.preventDefault();
        setError('');
        setSuccess('');
        try {
            await api.post(`/trips/${incidentTrip.id}/incidents`, {
                incident_type: incidentForm.type,
                location_name: incidentForm.location,
                description: incidentForm.description
            });
            setSuccess('Incident reported to dispatch.');
            setIncidentTrip(null);
            setIncidentForm({ type: 'Delay', location: '', description: '' });
        } catch (requestError) {
            setError(requestError.response?.data?.error || 'Failed to report incident.');
        }
    };

    const submitHandover = async (event) => {
        event.preventDefault();
        setError('');
        setSuccess('');
        try {
            const response = await api.post(`/trips/${handoverTrip.id}/handover`, {
                final_weight: handoverForm.finalWeight,
                client_received_stamp: handoverForm.clientStamp,
                client_stamp_notes: handoverForm.stampNotes,
                handover_notes: handoverForm.notes
            });
            setSuccess(`${response.data.message} Variance: ${response.data.variance} tons.`);
            setHandoverTrip(null);
            setHandoverForm({
                finalWeight: '',
                clientStamp: false,
                stampNotes: '',
                notes: ''
            });
            refreshTrips();
        } catch (requestError) {
            setError(requestError.response?.data?.error || 'Failed to complete handover.');
        }
    };

    return (
        <div style={{ maxWidth: '1000px', margin: '30px auto', padding: '24px', fontFamily: 'sans-serif', background: '#0E1A14', color: '#F8F6F0' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #B89B6A', paddingBottom: '15px' }}>
                <div>
                    <h2 style={{ margin: 0, color: '#F8F6F0' }}>Driver Portal</h2>
                    <small style={{ color: '#B89B6A' }}>{user?.username}</small>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        localStorage.clear();
                        navigate('/login');
                    }}
                    style={{ padding: '8px 16px', background: '#dc3545', color: '#fff', border: 0, borderRadius: '4px', cursor: 'pointer' }}
                >
                    Logout
                </button>
            </header>

            {error && <p style={{ color: '#ff6b6b', marginTop: '15px' }}>{error}</p>}
            {success && <p style={{ color: '#51cf66', marginTop: '15px' }}>{success}</p>}

            <h3 style={{ color: '#B89B6A', marginTop: '25px' }}>Assigned Routes</h3>
            {loading ? (
                <p>Loading assigned trips...</p>
            ) : trips.length === 0 ? (
                <p>No trips are currently assigned to you.</p>
            ) : (
                <div style={{ display: 'grid', gap: '18px' }}>
                    {trips.map((trip) => {
                        const awaitingDeposit = trip.is_spot_market && !trip.accounts_go_ahead_issued;
                        const canDepart = trip.status === 'Scheduled' && !awaitingDeposit;
                        const inTransit = trip.status === 'In-Transit';

                        return (
                            <article key={trip.id} style={{ background: '#16261E', padding: '20px', border: '1px solid rgba(184,155,106,0.25)', borderRadius: '6px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                                    <strong style={{ color: '#B89B6A' }}>{trip.tracking_code}</strong>
                                    <span>{trip.status}</span>
                                </div>
                                <p><strong>{trip.origin}</strong> → <strong>{trip.destination}</strong></p>
                                <p>{trip.cargo_description} · {trip.initial_weight} tons</p>
                                <p>Truck: {trip.plate_number || 'Unassigned'} · Consignee: {trip.consignee_name || 'N/A'}</p>

                                {awaitingDeposit && (
                                    <p style={{ color: '#ffb4b4' }}>
                                        Awaiting 50% client deposit clearance. Delivery actions are locked.
                                    </p>
                                )}

                                {(canDepart || inTransit) && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '15px', alignItems: 'center' }}>
                                        {canDepart && (
                                            <label style={{ padding: '8px 10px', border: '1px solid #B89B6A', borderRadius: '4px' }}>
                                                Delivery note:{' '}
                                                <input
                                                    type="file"
                                                    accept="image/*,.pdf"
                                                    disabled={uploadingTripId === trip.id}
                                                    onChange={(event) => uploadDeliveryNote(event, trip.id)}
                                                />
                                            </label>
                                        )}
                                        {inTransit && (
                                            <>
                                                <button type="button" onClick={() => broadcastLocation(trip.id)}>
                                                    Send GPS
                                                </button>
                                                <button type="button" onClick={() => setIncidentTrip(trip)}>
                                                    Report Incident
                                                </button>
                                                <button type="button" onClick={() => setHandoverTrip(trip)}>
                                                    Complete Handover
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </article>
                        );
                    })}
                </div>
            )}

            {incidentTrip && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'grid', placeItems: 'center', zIndex: 1100 }}>
                    <form onSubmit={submitIncident} style={{ width: '420px', maxWidth: '90vw', background: '#fff', color: '#111', padding: '24px', borderRadius: '8px' }}>
                        <h3>Report Incident — {incidentTrip.tracking_code}</h3>
                        <label>Incident type</label>
                        <select value={incidentForm.type} onChange={(event) => setIncidentForm({ ...incidentForm, type: event.target.value })} style={{ width: '100%', padding: '8px' }}>
                            <option>Delay</option>
                            <option>Mechanical Breakdown</option>
                            <option>Accident</option>
                            <option>Security Alert</option>
                        </select>
                        <label>Location</label>
                        <input required value={incidentForm.location} onChange={(event) => setIncidentForm({ ...incidentForm, location: event.target.value })} style={{ width: '100%', padding: '8px' }} />
                        <label>Description</label>
                        <textarea required rows="3" value={incidentForm.description} onChange={(event) => setIncidentForm({ ...incidentForm, description: event.target.value })} style={{ width: '100%', padding: '8px' }} />
                        <div style={{ display: 'flex', gap: '8px', marginTop: '15px' }}>
                            <button type="submit">Submit</button>
                            <button type="button" onClick={() => setIncidentTrip(null)}>Cancel</button>
                        </div>
                    </form>
                </div>
            )}

            {handoverTrip && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'grid', placeItems: 'center', zIndex: 1100 }}>
                    <form onSubmit={submitHandover} style={{ width: '420px', maxWidth: '90vw', background: '#fff', color: '#111', padding: '24px', borderRadius: '8px' }}>
                        <h3>Complete Handover — {handoverTrip.tracking_code}</h3>
                        <p>Loaded weight: {handoverTrip.initial_weight} tons</p>
                        <label>Final weight (tons)</label>
                        <input type="number" step="0.01" min="0" required value={handoverForm.finalWeight} onChange={(event) => setHandoverForm({ ...handoverForm, finalWeight: event.target.value })} style={{ width: '100%', padding: '8px' }} />
                        <label style={{ display: 'flex', gap: '8px', margin: '12px 0' }}>
                            <input type="checkbox" required checked={handoverForm.clientStamp} onChange={(event) => setHandoverForm({ ...handoverForm, clientStamp: event.target.checked })} />
                            Client stamp and signature confirmed
                        </label>
                        <label>Receiver / stamp details</label>
                        <input value={handoverForm.stampNotes} onChange={(event) => setHandoverForm({ ...handoverForm, stampNotes: event.target.value })} style={{ width: '100%', padding: '8px' }} />
                        <label>Handover notes</label>
                        <textarea rows="2" value={handoverForm.notes} onChange={(event) => setHandoverForm({ ...handoverForm, notes: event.target.value })} style={{ width: '100%', padding: '8px' }} />
                        <div style={{ display: 'flex', gap: '8px', marginTop: '15px' }}>
                            <button type="submit">Complete Delivery</button>
                            <button type="button" onClick={() => setHandoverTrip(null)}>Cancel</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
