import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function AdminDashboard() {
    const [trucks, setTrucks] = useState([]);
    const [trips, setTrips] = useState([]);
    const [manufacturers, setManufacturers] = useState([]);
    const [drivers, setDrivers] = useState([]);
    
    // Truck Form State
    const [plateNumber, setPlateNumber] = useState('');
    const [model, setModel] = useState('');
    const [capacityTons, setCapacityTons] = useState('');

    // Trip Dispatch Form State
    const [selectedTruckId, setSelectedTruckId] = useState('');
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

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const role = localStorage.getItem('role');
    const canManageTrucks = role === 'Admin' || role === 'FleetManager';
    const canDispatch = role === 'Admin';

    const [refreshKey, setRefreshKey] = useState(0);
    const fetchData = useCallback(() => setRefreshKey((k) => k + 1), []);

    useEffect(() => {
        const loadData = async () => {
            try {
                setError('');
                const [truckRes, tripRes, mfgRes, usersRes] = await Promise.all([
                    api.get('/trucks'),
                    api.get('/trips'),
                    api.get('/auth/manufacturers'),
                    api.get('/auth/users')
                ]);
                setTrucks(Array.isArray(truckRes.data) ? truckRes.data : []);
                setTrips(Array.isArray(tripRes.data) ? tripRes.data : []);
                setManufacturers(Array.isArray(mfgRes.data) ? mfgRes.data : []);
                setDrivers(
                    Array.isArray(usersRes.data)
                        ? usersRes.data.filter((user) => user.role === 'Driver')
                        : []
                );
            } catch (err) {
                console.error("Error fetching data:", err);
                setError(err.response?.data?.error || 'Failed to load dashboard data.');
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [refreshKey]);

    const handleAddTruck = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        try {
            await api.post('/trucks', {
                plate_number: plateNumber,
                model,
                capacity_tons: capacityTons
            });
            setSuccess('Truck added successfully!');
            setPlateNumber('');
            setModel('');
            setCapacityTons('');
            fetchData();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to add truck.');
        }
    };

    const handleDispatchTrip = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        try {
            const res = await api.post('/trips', {
                truck_id: selectedTruckId,
                driver_id: driverId,
                manufacturer_id: manufacturerId,
                consignee_name: consigneeName,
                consignee_phone: consigneePhone,
                origin,
                destination,
                cargo_description: cargoDescription,
                initial_weight: initialWeight
            });
            setSuccess(`Trip dispatched successfully! Tracking Code: ${res.data.trip.tracking_code}`);
            setSelectedTruckId('');
            setDriverId('');
            setManufacturerId('');
            setConsigneeName('');
            setConsigneePhone('');
            setOrigin('');
            setDestination('');
            setCargoDescription('');
            setInitialWeight('');
            fetchData();
        } catch (err) {
            setError(err.response?.data?.message || err.response?.data?.error || 'Failed to dispatch trip.');
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
            fetchData();
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
            fetchData();
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
            {loading && <p>Loading dashboard data...</p>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
                {/* Add Truck Form */}
                <div style={{ background: '#16261E', padding: '20px', borderRadius: '6px', border: '1px solid rgba(184, 155, 106, 0.2)' }}>
                    <h3 style={{ color: '#B89B6A', marginTop: 0 }}>Add New Truck</h3>
                    <form onSubmit={handleAddTruck}>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ color: '#C8C5BC', fontSize: '0.85em' }}>Plate Number:</label><br />
                            <input type="text" value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} required style={{ width: '100%', padding: '8px', background: '#0E1A14', color: '#fff', border: '1px solid #444', borderRadius: '4px', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ color: '#C8C5BC', fontSize: '0.85em' }}>Model:</label><br />
                            <input type="text" value={model} onChange={(e) => setModel(e.target.value)} required style={{ width: '100%', padding: '8px', background: '#0E1A14', color: '#fff', border: '1px solid #444', borderRadius: '4px', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ color: '#C8C5BC', fontSize: '0.85em' }}>Capacity (Tons):</label><br />
                            <input type="number" step="0.01" value={capacityTons} onChange={(e) => setCapacityTons(e.target.value)} required style={{ width: '100%', padding: '8px', background: '#0E1A14', color: '#fff', border: '1px solid #444', borderRadius: '4px', boxSizing: 'border-box' }} />
                        </div>
                        <button type="submit" disabled={!canManageTrucks} style={{ width: '100%', padding: '10px', background: '#004225', color: '#F8F6F0', border: '1px solid #B89B6A', borderRadius: '4px', fontWeight: 'bold', cursor: canManageTrucks ? 'pointer' : 'not-allowed', opacity: canManageTrucks ? 1 : 0.55 }}>Add Truck</button>
                    </form>
                </div>

                {/* Schedule & Dispatch Trip Form */}
                <div style={{ background: '#16261E', padding: '20px', borderRadius: '6px', border: '1px solid rgba(184, 155, 106, 0.2)' }}>
                    <h3 style={{ color: '#B89B6A', marginTop: 0 }}>Schedule & Dispatch 3PL Trip</h3>
                    <form onSubmit={handleDispatchTrip}>
                        <div style={{ marginBottom: '8px' }}>
                            <label style={{ color: '#C8C5BC', fontSize: '0.85em' }}>Select Manufacturer (Shipper):</label><br />
                            <select 
                                value={manufacturerId} 
                                onChange={(e) => setManufacturerId(e.target.value)}
                                required 
                                style={{ width: '100%', padding: '8px', background: '#0E1A14', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}
                            >
                                <option value="">-- Choose Manufacturer --</option>
                                {manufacturers.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.company_name || m.username}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ color: '#C8C5BC', fontSize: '0.85em' }}>Select Truck:</label><br />
                                <select value={selectedTruckId} onChange={(e) => setSelectedTruckId(e.target.value)} required style={{ width: '100%', padding: '8px', background: '#0E1A14', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}>
                                    <option value="">-- Truck --</option>
                                    {availableTrucks.map(truck => (
                                        <option key={truck.id} value={truck.id}>
                                            {truck.plate_number} ({truck.capacity_tons}t)
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ color: '#C8C5BC', fontSize: '0.85em' }}>Select Driver:</label><br />
                                <select value={driverId} onChange={(e) => setDriverId(e.target.value)} required style={{ width: '100%', padding: '8px', background: '#0E1A14', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}>
                                    <option value="">-- Driver --</option>
                                    {drivers.map(d => (
                                        <option key={d.id} value={d.id}>{d.username}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ color: '#C8C5BC', fontSize: '0.85em' }}>Consignee (End-Buyer):</label>
                                <input type="text" placeholder="e.g. Sospeter Kivuva" value={consigneeName} onChange={(e) => setConsigneeName(e.target.value)} style={{ width: '100%', padding: '8px', background: '#0E1A14', color: '#fff', border: '1px solid #444', borderRadius: '4px', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ color: '#C8C5BC', fontSize: '0.85em' }}>Consignee Phone:</label>
                                <input type="text" placeholder="e.g. +2547..." value={consigneePhone} onChange={(e) => setConsigneePhone(e.target.value)} style={{ width: '100%', padding: '8px', background: '#0E1A14', color: '#fff', border: '1px solid #444', borderRadius: '4px', boxSizing: 'border-box' }} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ color: '#C8C5BC', fontSize: '0.85em' }}>Origin:</label>
                                <input type="text" placeholder="e.g. Athi River" value={origin} onChange={(e) => setOrigin(e.target.value)} required style={{ width: '100%', padding: '8px', background: '#0E1A14', color: '#fff', border: '1px solid #444', borderRadius: '4px', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ color: '#C8C5BC', fontSize: '0.85em' }}>Destination:</label>
                                <input type="text" placeholder="e.g. Kisumu Depot" value={destination} onChange={(e) => setDestination(e.target.value)} required style={{ width: '100%', padding: '8px', background: '#0E1A14', color: '#fff', border: '1px solid #444', borderRadius: '4px', boxSizing: 'border-box' }} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ color: '#C8C5BC', fontSize: '0.85em' }}>Cargo Description:</label>
                                <input type="text" placeholder="e.g. Ceramic Floor Tiles" value={cargoDescription} onChange={(e) => setCargoDescription(e.target.value)} required style={{ width: '100%', padding: '8px', background: '#0E1A14', color: '#fff', border: '1px solid #444', borderRadius: '4px', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ color: '#C8C5BC', fontSize: '0.85em' }}>Initial Weight (Tons):</label>
                                <input type="number" step="0.01" placeholder="e.g. 28.50" value={initialWeight} onChange={(e) => setInitialWeight(e.target.value)} required style={{ width: '100%', padding: '8px', background: '#0E1A14', color: '#fff', border: '1px solid #444', borderRadius: '4px', boxSizing: 'border-box' }} />
                            </div>
                        </div>

                        <button type="submit" disabled={!canDispatch} style={{ width: '100%', padding: '10px', background: '#004225', color: '#F8F6F0', border: '1px solid #B89B6A', borderRadius: '4px', fontWeight: 'bold', cursor: canDispatch ? 'pointer' : 'not-allowed', opacity: canDispatch ? 1 : 0.55 }}>Dispatch Trip & Generate QR</button>
                    </form>
                </div>
            </div>

            {/* Discrepancy & Shrinkage Audit Queue */}
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
                                            disabled={!canDispatch}
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

            {/* Overview Tables */}
            <div style={{ marginTop: '30px' }}>
                <h3 style={{ color: '#B89B6A', marginBottom: '10px' }}>Active Fleet Overview</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', background: '#16261E', border: '1px solid rgba(184, 155, 106, 0.2)' }}>
                    <thead>
                        <tr style={{ background: '#004225', textAlign: 'left', color: '#F8F6F0' }}>
                            <th style={{ padding: '10px' }}>ID</th>
                            <th style={{ padding: '10px' }}>Plate Number</th>
                            <th style={{ padding: '10px' }}>Model</th>
                            <th style={{ padding: '10px' }}>Capacity</th>
                            <th style={{ padding: '10px' }}>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {trucks.map(truck => (
                            <tr key={truck.id} style={{ borderBottom: '1px solid rgba(184, 155, 106, 0.15)' }}>
                                <td style={{ padding: '10px' }}>{truck.id}</td>
                                <td style={{ padding: '10px' }}>{truck.plate_number}</td>
                                <td style={{ padding: '10px' }}>{truck.model}</td>
                                <td style={{ padding: '10px' }}>{truck.capacity_tons} tons</td>
                                <td style={{ padding: '10px', color: truck.status === 'Available' ? '#51cf66' : '#fcc419', fontWeight: 'bold' }}>{truck.status}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div style={{ marginTop: '30px' }}>
                <h3 style={{ color: '#B89B6A', marginBottom: '10px' }}>Dispatched Trips & Tracking Codes Overview</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', background: '#16261E', border: '1px solid rgba(184, 155, 106, 0.2)' }}>
                    <thead>
                        <tr style={{ background: '#004225', textAlign: 'left', color: '#F8F6F0' }}>
                            <th style={{ padding: '10px' }}>Trip ID</th>
                            <th style={{ padding: '10px' }}>Tracking Code</th>
                            <th style={{ padding: '10px' }}>Route</th>
                            <th style={{ padding: '10px' }}>Cargo</th>
                            <th style={{ padding: '10px' }}>Initial Weight</th>
                            <th style={{ padding: '10px' }}>Status</th>
                            <th style={{ padding: '10px' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {trips.map(trip => (
                            <tr key={trip.id} style={{ borderBottom: '1px solid rgba(184, 155, 106, 0.15)' }}>
                                <td style={{ padding: '10px' }}>{trip.id}</td>
                                <td style={{ padding: '10px', fontWeight: 'bold', color: '#B89B6A' }}>{trip.tracking_code || 'N/A'}</td>
                                <td style={{ padding: '10px' }}>{trip.origin} &rarr; {trip.destination}</td>
                                <td style={{ padding: '10px' }}>{trip.cargo_description}</td>
                                <td style={{ padding: '10px' }}>{trip.initial_weight} t</td>
                                <td style={{ padding: '10px', color: trip.status === 'Completed' ? '#51cf66' : trip.status === 'Flagged-Discrepancy' ? '#ff6b6b' : '#4dabf7', fontWeight: 'bold' }}>{trip.status}</td>
                                <td style={{ padding: '10px', display: 'flex', gap: '6px' }}>
                                    {trip.tracking_code && (
                                        <button
                                            onClick={() => navigate(`/waybill/${trip.tracking_code}`)}
                                            style={{ padding: '5px 9px', background: '#B89B6A', color: '#0E1A14', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8em' }}
                                        >
                                            Waybill
                                        </button>
                                    )}
                                    {canDispatch && trip.status === 'In-Transit' && (
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
            </div>

            {/* Rescue Truck Transshipment Modal */}
            {canDispatch && transshipTripId && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#16261E', padding: '25px', borderRadius: '8px', width: '440px', border: '1px solid #B89B6A' }}>
                        <h3 style={{ marginTop: 0, color: '#B89B6A' }}>Execute Rescue Transshipment (Trip #{transshipTripId})</h3>
                        <form onSubmit={handleTransshipSubmit}>
                            <div style={{ marginBottom: '12px' }}>
                                <label style={{ fontSize: '0.85em', color: '#C8C5BC' }}>Rescue Truck *</label>
                                <select value={rescueTruckId} onChange={(e) => setRescueTruckId(e.target.value)} required style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#0E1A14', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}>
                                    <option value="">-- Select Available Rescue Truck --</option>
                                    {availableTrucks.map(t => (
                                        <option key={t.id} value={t.id}>{t.plate_number} ({t.model} - {t.capacity_tons}t)</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ marginBottom: '12px' }}>
                                <label style={{ fontSize: '0.85em', color: '#C8C5BC' }}>Rescue Driver *</label>
                                <select value={rescueDriverId} onChange={(e) => setRescueDriverId(e.target.value)} required style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#0E1A14', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}>
                                    <option value="">-- Select Relief Driver --</option>
                                    {drivers.map(d => (
                                        <option key={d.id} value={d.id}>{d.username}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ marginBottom: '12px' }}>
                                <label style={{ fontSize: '0.85em', color: '#C8C5BC' }}>Breakdown / Transfer Location *</label>
                                <input type="text" placeholder="e.g. Mtito Andei Weighbridge" value={transshipLocation} onChange={(e) => setTransshipLocation(e.target.value)} required style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#0E1A14', color: '#fff', border: '1px solid #444', borderRadius: '4px', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ marginBottom: '12px' }}>
                                <label style={{ fontSize: '0.85em', color: '#C8C5BC' }}>Transferred Weight (Tons) *</label>
                                <input type="number" step="0.01" value={transferWeight} onChange={(e) => setTransferWeight(e.target.value)} required style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#0E1A14', color: '#fff', border: '1px solid #444', borderRadius: '4px', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ fontSize: '0.85em', color: '#C8C5BC' }}>Incident Notes</label>
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
