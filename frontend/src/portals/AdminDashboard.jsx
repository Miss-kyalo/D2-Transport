import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function AdminDashboard() {
    const [trips, setTrips] = useState([]);
    const [trucks, setTrucks] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [manufacturers, setManufacturers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // New Trip Dispatch Form State
    const [truckId, setTruckId] = useState('');
    const [driverId, setDriverId] = useState('');
    const [manufacturerId, setManufacturerId] = useState('');
    const [consigneeName, setConsigneeName] = useState('');
    const [consigneePhone, setConsigneePhone] = useState('');
    const [origin, setOrigin] = useState('');
    const [destination, setDestination] = useState('');
    const [cargoDescription, setCargoDescription] = useState('');
    const [initialWeight, setInitialWeight] = useState('');

    // Transshipment Modal State
    const [transshipTripId, setTransshipTripId] = useState(null);
    const [rescueTruckId, setRescueTruckId] = useState('');
    const [rescueDriverId, setRescueDriverId] = useState('');
    const [transshipLocation, setTransshipLocation] = useState('');
    const [transferWeight, setTransferWeight] = useState('');
    const [transshipNotes, setTransshipNotes] = useState('');

    const navigate = useNavigate();

    const fetchDashboardData = useCallback(async () => {
        try {
            const [tripsRes, trucksRes, usersRes] = await Promise.all([
                api.get('/trips'),
                api.get('/trucks'),
                api.get('/auth/users')
            ]);
            setTrips(tripsRes.data);
            setTrucks(trucksRes.data);
            setDrivers(usersRes.data.filter(u => u.role === 'Driver'));
            setManufacturers(usersRes.data.filter(u => u.role === 'Manufacturer'));
        } catch (err) {
            console.error('Error loading admin dashboard:', err);
            setError(err.response?.data?.error || 'Failed to load fleet and dispatch data.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    const handleScheduleTrip = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        try {
            const res = await api.post('/trips', {
                truck_id: truckId,
                driver_id: driverId,
                manufacturer_id: manufacturerId || null,
                consignee_name: consigneeName,
                consignee_phone: consigneePhone,
                origin,
                destination,
                cargo_description: cargoDescription,
                initial_weight: initialWeight
            });
            setSuccess(`Trip scheduled! Tracking Code: ${res.data.trip.tracking_code}`);
            setTruckId('');
            setDriverId('');
            setManufacturerId('');
            setConsigneeName('');
            setConsigneePhone('');
            setOrigin('');
            setDestination('');
            setCargoDescription('');
            setInitialWeight('');
            fetchDashboardData();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to schedule trip.');
        }
    };

    const handleTransshipSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        try {
            await api.post(`/trips/${transshipTripId}/transship`, {
                new_truck_id: rescueTruckId,
                new_driver_id: rescueDriverId,
                location_name: transshipLocation,
                transfer_weight_tons: transferWeight,
                notes: transshipNotes
            });
            setSuccess('Rescue truck transshipment completed successfully.');
            setTransshipTripId(null);
            setRescueTruckId('');
            setRescueDriverId('');
            setTransshipLocation('');
            setTransferWeight('');
            setTransshipNotes('');
            fetchDashboardData();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to execute transshipment.');
        }
    };

    const handleResolveDiscrepancy = async (tripId) => {
        const notes = window.prompt('Enter resolution audit note (e.g., Approved by plant manager):');
        if (!notes) return;
        setError('');
        setSuccess('');
        try {
            await api.post(`/trips/${tripId}/resolve-discrepancy`, { resolution_notes: notes });
            setSuccess(`Discrepancy on Trip #${tripId} resolved. Truck released to Available.`);
            fetchDashboardData();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to resolve discrepancy.');
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    const availableTrucks = trucks.filter(t => t.status === 'Available');
    const flaggedTrips = trips.filter(t => t.status === 'Flagged-Discrepancy');

    return (
        <div style={{ maxWidth: '1150px', margin: '30px auto', fontFamily: 'sans-serif', padding: '24px', background: '#0E1A14', color: '#F8F6F0', borderRadius: '8px', border: '1px solid rgba(184, 155, 106, 0.3)' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(184, 155, 106, 0.3)', paddingBottom: '15px' }}>
                <div>
                    <h2 style={{ margin: 0, color: '#F8F6F0' }}>D2-Transport Dispatch & Fleet Control</h2>
                    <small style={{ color: '#B89B6A' }}>3PL Operations, OCR Stamp Audits & Chain-of-Custody</small>
                </div>
                <button onClick={handleLogout} style={{ padding: '8px 16px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                    Logout
                </button>
            </div>

            {error && <p style={{ color: '#ff6b6b', background: 'rgba(255,0,0,0.12)', padding: '10px', borderRadius: '4px', marginTop: '15px' }}>{error}</p>}
            {success && <p style={{ color: '#51cf66', background: 'rgba(0,255,0,0.12)', padding: '10px', borderRadius: '4px', marginTop: '15px' }}>{success}</p>}

            {/* Fleet Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginTop: '20px' }}>
                <div style={{ background: '#16261E', padding: '15px', borderRadius: '6px', border: '1px solid rgba(184, 155, 106, 0.2)' }}>
                    <small style={{ color: '#C8C5BC' }}>AVAILABLE TRUCKS</small>
                    <h3 style={{ margin: '5px 0 0 0', color: '#51cf66' }}>{availableTrucks.length} / {trucks.length}</h3>
                </div>
                <div style={{ background: '#16261E', padding: '15px', borderRadius: '6px', border: '1px solid rgba(184, 155, 106, 0.2)' }}>
                    <small style={{ color: '#C8C5BC' }}>SCHEDULED (AWAITING OCR)</small>
                    <h3 style={{ margin: '5px 0 0 0', color: '#fcc419' }}>{trips.filter(t => t.status === 'Scheduled').length}</h3>
                </div>
                <div style={{ background: '#16261E', padding: '15px', borderRadius: '6px', border: '1px solid rgba(184, 155, 106, 0.2)' }}>
                    <small style={{ color: '#C8C5BC' }}>ACTIVE IN-TRANSIT</small>
                    <h3 style={{ margin: '5px 0 0 0', color: '#4dabf7' }}>{trips.filter(t => t.status === 'In-Transit').length}</h3>
                </div>
                <div style={{ background: '#16261E', padding: '15px', borderRadius: '6px', border: '1px solid rgba(184, 155, 106, 0.2)' }}>
                    <small style={{ color: '#C8C5BC' }}>SHRINKAGE FLAGS</small>
                    <h3 style={{ margin: '5px 0 0 0', color: '#ff6b6b' }}>{flaggedTrips.length}</h3>
                </div>
            </div>

            {/* Schedule New Dispatch Form */}
            <div style={{ marginTop: '25px', background: '#16261E', padding: '20px', borderRadius: '6px', border: '1px solid rgba(184, 155, 106, 0.25)' }}>
                <h3 style={{ marginTop: 0, color: '#B89B6A' }}>Assign Truck & Driver to Manufacturer</h3>
                <form onSubmit={handleScheduleTrip} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                    <div>
                        <label style={{ fontSize: '0.85em', color: '#C8C5BC' }}>Available Truck *</label>
                        <select value={truckId} onChange={(e) => setTruckId(e.target.value)} required style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#0E1A14', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}>
                            <option value="">-- Select Truck --</option>
                            {availableTrucks.map(t => (
                                <option key={t.id} value={t.id}>{t.plate_number} ({t.model} - {t.capacity_tons}t)</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={{ fontSize: '0.85em', color: '#C8C5BC' }}>Assigned Driver *</label>
                        <select value={driverId} onChange={(e) => setDriverId(e.target.value)} required style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#0E1A14', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}>
                            <option value="">-- Select Driver --</option>
                            {drivers.map(d => (
                                <option key={d.id} value={d.id}>{d.username}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={{ fontSize: '0.85em', color: '#C8C5BC' }}>Manufacturer (Shipper)</label>
                        <select value={manufacturerId} onChange={(e) => setManufacturerId(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#0E1A14', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}>
                            <option value="">-- Optional / Direct --</option>
                            {manufacturers.map(m => (
                                <option key={m.id} value={m.id}>{m.company_name || m.username}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={{ fontSize: '0.85em', color: '#C8C5BC' }}>Origin (Loading Zone) *</label>
                        <input type="text" placeholder="e.g. Athi River Plant" value={origin} onChange={(e) => setOrigin(e.target.value)} required style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#0E1A14', color: '#fff', border: '1px solid #444', borderRadius: '4px', boxSizing: 'border-box' }} />
                    </div>

                    <div>
                        <label style={{ fontSize: '0.85em', color: '#C8C5BC' }}>Destination *</label>
                        <input type="text" placeholder="e.g. Kisumu Depot" value={destination} onChange={(e) => setDestination(e.target.value)} required style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#0E1A14', color: '#fff', border: '1px solid #444', borderRadius: '4px', boxSizing: 'border-box' }} />
                    </div>

                    <div>
                        <label style={{ fontSize: '0.85em', color: '#C8C5BC' }}>Initial Weight (Tons) *</label>
                        <input type="number" step="0.01" placeholder="e.g. 28.5" value={initialWeight} onChange={(e) => setInitialWeight(e.target.value)} required style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#0E1A14', color: '#fff', border: '1px solid #444', borderRadius: '4px', boxSizing: 'border-box' }} />
                    </div>

                    <div>
                        <label style={{ fontSize: '0.85em', color: '#C8C5BC' }}>Consignee / Client Name</label>
                        <input type="text" placeholder="e.g. Sospeter Kivuva" value={consigneeName} onChange={(e) => setConsigneeName(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#0E1A14', color: '#fff', border: '1px solid #444', borderRadius: '4px', boxSizing: 'border-box' }} />
                    </div>

                    <div>
                        <label style={{ fontSize: '0.85em', color: '#C8C5BC' }}>Consignee Phone</label>
                        <input type="text" placeholder="e.g. +2547..." value={consigneePhone} onChange={(e) => setConsigneePhone(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#0E1A14', color: '#fff', border: '1px solid #444', borderRadius: '4px', boxSizing: 'border-box' }} />
                    </div>

                    <div>
                        <label style={{ fontSize: '0.85em', color: '#C8C5BC' }}>Cargo Description *</label>
                        <input type="text" placeholder="e.g. Ceramic Floor Tiles" value={cargoDescription} onChange={(e) => setCargoDescription(e.target.value)} required style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#0E1A14', color: '#fff', border: '1px solid #444', borderRadius: '4px', boxSizing: 'border-box' }} />
                    </div>

                    <div style={{ gridColumn: 'span 3', marginTop: '8px' }}>
                        <button type="submit" style={{ width: '100%', padding: '10px', background: '#004225', color: '#F8F6F0', border: '1px solid #B89B6A', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                            Dispatch Truck & Generate QR Waybill
                        </button>
                    </div>
                </form>
            </div>

            {/* Flagged Discrepancy Resolution Queue */}
            <div style={{ marginTop: '30px' }}>
                <h3 style={{ color: '#ff6b6b', marginBottom: '10px' }}>Discrepancy & Shrinkage Audit Queue (Tolerance: 0.5t)</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', background: '#16261E', border: '1px solid rgba(184, 155, 106, 0.2)' }}>
                    <thead>
                        <tr style={{ background: '#004225', textAlign: 'left', color: '#F8F6F0' }}>
                            <th style={{ padding: '10px' }}>Trip ID</th>
                            <th style={{ padding: '10px' }}>Tracking Code</th>
                            <th style={{ padding: '10px' }}>Route</th>
                            <th style={{ padding: '10px' }}>Initial vs Final</th>
                            <th style={{ padding: '10px' }}>Variance</th>
                            <th style={{ padding: '10px' }}>Notes</th>
                            <th style={{ padding: '10px' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {flaggedTrips.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ padding: '14px', textAlign: 'center', color: '#C8C5BC' }}>
                                    No active discrepancy flags. All shipments within tolerance.
                                </td>
                            </tr>
                        ) : (
                            flaggedTrips.map(trip => (
                                <tr key={trip.id} style={{ borderBottom: '1px solid rgba(184, 155, 106, 0.15)' }}>
                                    <td style={{ padding: '10px' }}>#{trip.id}</td>
                                    <td style={{ padding: '10px', color: '#B89B6A', fontWeight: 'bold' }}>{trip.tracking_code}</td>
                                    <td style={{ padding: '10px' }}>{trip.origin} &rarr; {trip.destination}</td>
                                    <td style={{ padding: '10px' }}>{trip.initial_weight}t &rarr; {trip.final_weight}t</td>
                                    <td style={{ padding: '10px', color: '#ff6b6b', fontWeight: 'bold' }}>-{trip.variance_tons}t</td>
                                    <td style={{ padding: '10px', fontSize: '0.85em' }}>{trip.handover_notes || 'N/A'}</td>
                                    <td style={{ padding: '10px' }}>
                                        <button
                                            onClick={() => handleResolveDiscrepancy(trip.id)}
                                            style={{ padding: '5px 10px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85em', fontWeight: 'bold' }}
                                        >
                                            Approve & Release Truck
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Active & Dispatched Trips Overview */}
            <div style={{ marginTop: '30px' }}>
                <h3 style={{ color: '#B89B6A', marginBottom: '10px' }}>All Dispatched Trips & Stamp Verification</h3>
                {loading ? (
                    <p>Loading dispatch records...</p>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: '#16261E', border: '1px solid rgba(184, 155, 106, 0.2)' }}>
                        <thead>
                            <tr style={{ background: '#004225', textAlign: 'left', color: '#F8F6F0' }}>
                                <th style={{ padding: '10px' }}>Code</th>
                                <th style={{ padding: '10px' }}>Manufacturer / Buyer</th>
                                <th style={{ padding: '10px' }}>Route</th>
                                <th style={{ padding: '10px' }}>Truck / Driver</th>
                                <th style={{ padding: '10px' }}>Stamps (OCR / Client)</th>
                                <th style={{ padding: '10px' }}>Status</th>
                                <th style={{ padding: '10px' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {trips.map(trip => (
                                <tr key={trip.id} style={{ borderBottom: '1px solid rgba(184, 155, 106, 0.15)' }}>
                                    <td style={{ padding: '10px', fontWeight: 'bold', color: '#B89B6A' }}>{trip.tracking_code}</td>
                                    <td style={{ padding: '10px', fontSize: '0.9em' }}>
                                        <strong>{trip.manufacturer_name || 'Direct'}</strong><br />
                                        <small style={{ color: '#C8C5BC' }}>To: {trip.consignee_name || 'N/A'}</small>
                                    </td>
                                    <td style={{ padding: '10px', fontSize: '0.9em' }}>{trip.origin} &rarr; {trip.destination}</td>
                                    <td style={{ padding: '10px', fontSize: '0.9em' }}>
                                        {trip.plate_number || 'N/A'}<br />
                                        <small style={{ color: '#C8C5BC' }}>{trip.driver_name || 'N/A'}</small>
                                    </td>
                                    <td style={{ padding: '10px', fontSize: '0.85em' }}>
                                        Security: {trip.ocr_security_stamp_detected ? 'Verified' : 'Pending'}<br />
                                        Received: {trip.client_received_stamp ? 'Verified' : 'Pending'}
                                    </td>
                                    <td style={{ padding: '10px', fontWeight: 'bold', color: trip.status === 'Completed' ? '#51cf66' : trip.status === 'Flagged-Discrepancy' ? '#ff6b6b' : '#fcc419' }}>
                                        {trip.status}
                                    </td>
                                    <td style={{ padding: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        {trip.tracking_code && (
                                            <button
                                                onClick={() => navigate(`/waybill/${trip.tracking_code}`)}
                                                style={{ padding: '5px 9px', background: '#B89B6A', color: '#0E1A14', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8em' }}
                                            >
                                                Waybill
                                            </button>
                                        )}
                                        {trip.status === 'In-Transit' && (
                                            <button
                                                onClick={() => {
                                                    setTransshipTripId(trip.id);
                                                    setTransferWeight(trip.initial_weight);
                                                }}
                                                style={{ padding: '5px 9px', background: '#fd7e14', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8em' }}
                                            >
                                                Rescue Truck
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Rescue Truck Transshipment Modal */}
            {transshipTripId && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#16261E', padding: '25px', borderRadius: '8px', width: '440px', border: '1px solid #B89B6A' }}>
                        <h3 style={{ marginTop: 0, color: '#B89B6A' }}>Execute Rescue Transshipment (Trip #{transshipTripId})</h3>
                        <form onSubmit={handleTransshipSubmit}>
                            <div style={{ marginBottom: '12px' }}>
                                <label style={{ fontSize: '0.85em' }}>Rescue Truck *</label>
                                <select value={rescueTruckId} onChange={(e) => setRescueTruckId(e.target.value)} required style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#0E1A14', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}>
                                    <option value="">-- Select Available Rescue Truck --</option>
                                    {availableTrucks.map(t => (
                                        <option key={t.id} value={t.id}>{t.plate_number} ({t.model} - {t.capacity_tons}t)</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ marginBottom: '12px' }}>
                                <label style={{ fontSize: '0.85em' }}>Rescue Driver *</label>
                                <select value={rescueDriverId} onChange={(e) => setRescueDriverId(e.target.value)} required style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#0E1A14', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}>
                                    <option value="">-- Select Relief Driver --</option>
                                    {drivers.map(d => (
                                        <option key={d.id} value={d.id}>{d.username}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ marginBottom: '12px' }}>
                                <label style={{ fontSize: '0.85em' }}>Breakdown / Transfer Location *</label>
                                <input type="text" placeholder="e.g. Mtito Andei Weighbridge" value={transshipLocation} onChange={(e) => setTransshipLocation(e.target.value)} required style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#0E1A14', color: '#fff', border: '1px solid #444', borderRadius: '4px', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ marginBottom: '12px' }}>
                                <label style={{ fontSize: '0.85em' }}>Transferred Weight (Tons) *</label>
                                <input type="number" step="0.01" value={transferWeight} onChange={(e) => setTransferWeight(e.target.value)} required style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#0E1A14', color: '#fff', border: '1px solid #444', borderRadius: '4px', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ fontSize: '0.85em' }}>Incident Notes</label>
                                <input type="text" placeholder="e.g. Prime mover clutch failure, seals intact" value={transshipNotes} onChange={(e) => setTransshipNotes(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#0E1A14', color: '#fff', border: '1px solid #444', borderRadius: '4px', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button type="submit" style={{ flex: 1, padding: '10px', background: '#004225', color: '#fff', border: '1px solid #B89B6A', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
                                    Confirm Transshipment
                                </button>
                                <button type="button" onClick={() => setTransshipTripId(null)} style={{ padding: '10px 15px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}