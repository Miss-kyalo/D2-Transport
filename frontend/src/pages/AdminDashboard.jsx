import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function AdminDashboard() {
    const [trucks, setTrucks] = useState([]);
    const [trips, setTrips] = useState([]);
    const [manufacturers, setManufacturers] = useState([]);
    
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

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const navigate = useNavigate();

    const [refreshKey, setRefreshKey] = useState(0);
    const fetchData = useCallback(() => setRefreshKey((k) => k + 1), []);

    useEffect(() => {
        const loadData = async () => {
            try {
                const truckRes = await api.get('/trucks');
                setTrucks(truckRes.data);

                const tripRes = await api.get('/trips');
                setTrips(tripRes.data);

                const mfgRes = await api.get('/auth/manufacturers');
                setManufacturers(mfgRes.data);
            } catch (err) {
                console.error("Error fetching data:", err);
                setError("Failed to load dashboard data.");
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
            await api.post('/trips', {
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
            setSuccess('Trip dispatched successfully with QR tracking code!');
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

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    return (
        <div style={{ maxWidth: '1100px', margin: '30px auto', fontFamily: 'sans-serif', padding: '20px', background: '#1e1e1e', color: '#fff', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #444', paddingBottom: '10px' }}>
                <h2>Admin Dispatch & 3PL Hub</h2>
                <button onClick={handleLogout} style={{ padding: '8px 15px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    Logout
                </button>
            </div>

            {error && <p style={{ color: '#ff6b6b', background: 'rgba(255,0,0,0.1)', padding: '10px', borderRadius: '4px', marginTop: '15px' }}>{error}</p>}
            {success && <p style={{ color: '#51cf66', background: 'rgba(0,255,0,0.1)', padding: '10px', borderRadius: '4px', marginTop: '15px' }}>{success}</p>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
                {/* Add Truck Form */}
                <div style={{ background: '#2d2d2d', padding: '20px', borderRadius: '6px' }}>
                    <h3>Add New Truck</h3>
                    <form onSubmit={handleAddTruck}>
                        <div style={{ marginBottom: '10px' }}>
                            <label>Plate Number:</label><br />
                            <input type="text" value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} required style={{ width: '100%', padding: '6px', background: '#1e1e1e', color: '#fff', border: '1px solid #444', borderRadius: '4px' }} />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <label>Model:</label><br />
                            <input type="text" value={model} onChange={(e) => setModel(e.target.value)} required style={{ width: '100%', padding: '6px', background: '#1e1e1e', color: '#fff', border: '1px solid #444', borderRadius: '4px' }} />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <label>Capacity (Tons):</label><br />
                            <input type="number" step="0.01" value={capacityTons} onChange={(e) => setCapacityTons(e.target.value)} required style={{ width: '100%', padding: '6px', background: '#1e1e1e', color: '#fff', border: '1px solid #444', borderRadius: '4px' }} />
                        </div>
                        <button type="submit" style={{ width: '100%', padding: '8px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Add Truck</button>
                    </form>
                </div>

                {/* Schedule & Dispatch Trip Form */}
                <div style={{ background: '#2d2d2d', padding: '20px', borderRadius: '6px' }}>
                    <h3>Schedule & Dispatch 3PL Trip</h3>
                    <form onSubmit={handleDispatchTrip}>
                        <div style={{ marginBottom: '8px' }}>
                            <label>Select Manufacturer (Shipper):</label><br />
                            <select 
                                value={manufacturerId} 
                                onChange={(e) => setManufacturerId(e.target.value)}
                                required 
                                style={{ width: '100%', padding: '6px', background: '#1e1e1e', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}
                            >
                                <option value="">-- Choose Manufacturer (e.g., KEDA Ceramics) --</option>
                                {manufacturers.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.company_name || m.name} ({m.email})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                            <div style={{ flex: 1 }}>
                                <label>Select Truck:</label><br />
                                <select value={selectedTruckId} onChange={(e) => setSelectedTruckId(e.target.value)} required style={{ width: '100%', padding: '6px', background: '#1e1e1e', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}>
                                    <option value="">-- Truck --</option>
                                    {trucks.map(truck => (
                                        <option key={truck.id} value={truck.id}>
                                            {truck.plate_number} ({truck.status})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label>Driver User ID:</label><br />
                                <input type="number" placeholder="Driver ID" value={driverId} onChange={(e) => setDriverId(e.target.value)} required style={{ width: '100%', padding: '6px', background: '#1e1e1e', color: '#fff', border: '1px solid #444', borderRadius: '4px' }} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                            <div style={{ flex: 1 }}>
                                <label>Consignee (End-Buyer):</label>
                                <input type="text" placeholder="e.g. Nairobi Hardware" value={consigneeName} onChange={(e) => setConsigneeName(e.target.value)} style={{ width: '100%', padding: '6px', background: '#1e1e1e', color: '#fff', border: '1px solid #444', borderRadius: '4px' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label>Consignee Phone:</label>
                                <input type="text" placeholder="e.g. 0712345678" value={consigneePhone} onChange={(e) => setConsigneePhone(e.target.value)} style={{ width: '100%', padding: '6px', background: '#1e1e1e', color: '#fff', border: '1px solid #444', borderRadius: '4px' }} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                            <div style={{ flex: 1 }}>
                                <label>Origin:</label>
                                <input type="text" placeholder="e.g. Athi River" value={origin} onChange={(e) => setOrigin(e.target.value)} required style={{ width: '100%', padding: '6px', background: '#1e1e1e', color: '#fff', border: '1px solid #444', borderRadius: '4px' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label>Destination:</label>
                                <input type="text" placeholder="e.g. Kisii" value={destination} onChange={(e) => setDestination(e.target.value)} required style={{ width: '100%', padding: '6px', background: '#1e1e1e', color: '#fff', border: '1px solid #444', borderRadius: '4px' }} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                            <div style={{ flex: 1 }}>
                                <label>Cargo Description:</label>
                                <input type="text" placeholder="e.g. Ceramic Tiles" value={cargoDescription} onChange={(e) => setCargoDescription(e.target.value)} required style={{ width: '100%', padding: '6px', background: '#1e1e1e', color: '#fff', border: '1px solid #444', borderRadius: '4px' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label>Initial Weight (Tons):</label>
                                <input type="number" step="0.01" placeholder="e.g. 28.50" value={initialWeight} onChange={(e) => setInitialWeight(e.target.value)} required style={{ width: '100%', padding: '6px', background: '#1e1e1e', color: '#fff', border: '1px solid #444', borderRadius: '4px' }} />
                            </div>
                        </div>

                        <button type="submit" style={{ width: '100%', padding: '8px', background: '#007BFF', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginTop: '5px' }}>Dispatch Trip & Generate QR</button>
                    </form>
                </div>
            </div>

            {/* Overview Tables */}
            <div style={{ marginTop: '30px' }}>
                <h3>Active Fleet Overview</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', background: '#2d2d2d' }}>
                    <thead>
                        <tr style={{ background: '#383838', textAlign: 'left' }}>
                            <th style={{ padding: '8px' }}>ID</th>
                            <th style={{ padding: '8px' }}>Plate Number</th>
                            <th style={{ padding: '8px' }}>Model</th>
                            <th style={{ padding: '8px' }}>Capacity</th>
                            <th style={{ padding: '8px' }}>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {trucks.map(truck => (
                            <tr key={truck.id} style={{ borderBottom: '1px solid #444' }}>
                                <td style={{ padding: '8px' }}>{truck.id}</td>
                                <td style={{ padding: '8px' }}>{truck.plate_number}</td>
                                <td style={{ padding: '8px' }}>{truck.model}</td>
                                <td style={{ padding: '8px' }}>{truck.capacity_tons} tons</td>
                                <td style={{ padding: '8px', color: truck.status === 'Available' ? '#51cf66' : '#fcc419' }}>{truck.status}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div style={{ marginTop: '30px' }}>
                <h3>Dispatched Trips & Tracking Codes Overview</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', background: '#2d2d2d' }}>
                    <thead>
                        <tr style={{ background: '#383838', textAlign: 'left' }}>
                            <th style={{ padding: '8px' }}>Trip ID</th>
                            <th style={{ padding: '8px' }}>Tracking Code</th>
                            <th style={{ padding: '8px' }}>Truck</th>
                            <th style={{ padding: '8px' }}>Route</th>
                            <th style={{ padding: '8px' }}>Cargo</th>
                            <th style={{ padding: '8px' }}>Initial Weight</th>
                            <th style={{ padding: '8px' }}>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {trips.map(trip => (
                            <tr key={trip.id} style={{ borderBottom: '1px solid #444' }}>
                                <td style={{ padding: '8px' }}>{trip.id}</td>
                                <td style={{ padding: '8px', fontWeight: 'bold', color: '#ffd43b' }}>{trip.tracking_code || 'N/A'}</td>
                                <td style={{ padding: '8px' }}>{trip.plate_number || 'N/A'}</td>
                                <td style={{ padding: '8px' }}>{trip.origin} ➔ {trip.destination}</td>
                                <td style={{ padding: '8px' }}>{trip.cargo_description}</td>
                                <td style={{ padding: '8px' }}>{trip.initial_weight} t</td>
                                <td style={{ padding: '8px', color: '#4dabf7' }}>{trip.status}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}