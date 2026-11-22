import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import ControlFinancePanel from '../components/ControlFinancePanel';

const today = () => new Date().toISOString().slice(0, 10);
const emptyFuel = () => ({
    fuel_date: today(), truck_id: '', trip_id: '', station_name: '', card_reference: '',
    etims_invoice_no: '', litres: '', price_per_litre: '', odometer_reading: '', km_since_last_fill: ''
});
const card = { background: '#fff', border: '1px solid #d6d3c9', borderRadius: 10, padding: 18, overflowX: 'auto' };
const input = { padding: 8, maxWidth: '100%' };

export default function ControlHub() {
    const role = localStorage.getItem('role');
    const canInventory = ['Admin', 'FleetManager', 'Storekeeper', 'Boss', 'Accounts_Payable', 'Accounts_Receivable', 'PayrollAccountant'].includes(role);
    const canFleet = ['Admin', 'FleetManager', 'Dispatcher', 'Boss', 'Accounts_Payable', 'Accounts_Receivable', 'PayrollAccountant'].includes(role);
    const canMileageWrite = ['Admin', 'FleetManager', 'Dispatcher'].includes(role);
    const canFuelWrite = ['Admin', 'FleetManager'].includes(role);
    const canFinance = ['Admin', 'Accounts_Payable', 'Accounts_Receivable', 'PayrollAccountant', 'Boss'].includes(role);
    const canFinanceWrite = ['Accounts_Payable', 'Accounts_Receivable', 'Boss'].includes(role);
    const [tab, setTab] = useState(canInventory ? 'inventory' : 'fuel_mileage');
    const [items, setItems] = useState(null);
    const [date, setDate] = useState(today);
    const [rows, setRows] = useState(null);
    const [trips, setTrips] = useState([]);
    const [records, setRecords] = useState(null);
    const [fuel, setFuel] = useState(emptyFuel);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [refresh, setRefresh] = useState(0);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let active = true;
        if (canInventory) api.get('/control/inventory/summary')
            .then((response) => { if (active) setItems(response.data.items); })
            .catch((err) => { if (active) setError(err.response?.data?.error || 'Failed to load inventory.'); });
        return () => { active = false; };
    }, [canInventory]);

    useEffect(() => {
        if (!canFleet || !date) return undefined;
        let active = true;
        Promise.all([api.get('/control/mileage/daily', { params: { date } }), api.get('/control/fuel/records')])
            .then(([mileage, fuelRecords]) => {
                if (!active) return;
                setRows(mileage.data.rows.map((row) => ({
                    ...row, opening_km: row.opening_km ?? '', closing_km: row.closing_km ?? '',
                    yard_status: row.yard_status || 'On Corridor', dirty: false
                })));
                setTrips(mileage.data.trips);
                setRecords(fuelRecords.data.records);
            })
            .catch((err) => { if (active) setError(err.response?.data?.error || 'Failed to load mileage and fuel records.'); });
        return () => { active = false; };
    }, [canFleet, date, refresh]);

    const changeDate = (value) => {
        if (rows?.some((row) => row.dirty) && !window.confirm('Discard unsaved mileage changes?')) return;
        setRows(null);
        setDate(value);
        setError('');
        setMessage('');
    };
    const updateRow = (truckId, field, value) => {
        setRows((current) => current.map((row) => row.truck_id === truckId ? { ...row, [field]: value, dirty: true } : row));
    };
    const saveMileage = async () => {
        const entries = rows.filter((row) => row.dirty);
        if (!entries.length) {
            setError('Change at least one truck reading before saving.');
            return;
        }
        setBusy(true); setError(''); setMessage('');
        try {
            const response = await api.post('/control/mileage/mass-release', { log_date: date, entries });
            setMessage(response.data.message);
            setRows(null);
            setRefresh((value) => value + 1);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to save mileage.');
        } finally { setBusy(false); }
    };
    const saveFuel = async (event) => {
        event.preventDefault();
        setBusy(true); setError(''); setMessage('');
        try {
            const response = await api.post('/control/fuel/reconcile', fuel);
            setMessage(response.data.message);
            setFuel(emptyFuel());
            const refreshed = await api.get('/control/fuel/records');
            setRecords(refreshed.data.records);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to save fuel entry.');
        } finally { setBusy(false); }
    };

    return (
        <main style={{ background: '#faf9f5', minHeight: '100vh', padding: 24, color: '#14281d' }}>
            <header style={{ background: '#143628', color: '#fff', padding: 20, borderRadius: 10 }}>
                <h1>Operations control</h1>
                {canInventory && <button type="button" onClick={() => setTab('inventory')}>Shared inventory</button>}{' '}
                {canFleet && <button type="button" onClick={() => setTab('fuel_mileage')}>Fuel &amp; mileage</button>}
                {' '}{canFinance && <button type="button" onClick={() => setTab('finance')}>Finance</button>}
            </header>
            {error && <p role="alert" style={{ color: '#991b1b' }}>{error}</p>}
            {message && <p role="status" style={{ color: '#166534' }}>{message}</p>}
            {tab === 'finance' && canFinance && <ControlFinancePanel canWrite={canFinanceWrite} />}
            {tab === 'inventory' && canInventory && (
                <section style={{ ...card, marginTop: 16 }}>
                    <h2>Shared stock ledger</h2>
                    <p>Stock is shared with the garage workbench. Parts issues require storekeeper approval.</p>
                    {['Admin', 'FleetManager', 'Storekeeper'].includes(role) && <Link to="/garage/workbench">Open garage workbench</Link>}
                    {items === null ? <p>Inventory unavailable or loading.</p> : (
                        <table style={{ width: '100%', textAlign: 'left' }}>
                            <thead><tr><th>SKU</th><th>Part</th><th>On hand</th><th>Reserved</th><th>Reorder level</th><th>Value (KES)</th></tr></thead>
                            <tbody>{items.map((item) => <tr key={item.id}>
                                <td>{item.sku}</td><td>{item.part_name}</td><td>{item.qty_on_hand}</td><td>{item.qty_reserved}</td>
                                <td>{item.reorder_level}{item.qty_on_hand <= item.reorder_level ? ' (low)' : ''}</td>
                                <td>{Number(item.stock_value).toLocaleString()}</td>
                            </tr>)}</tbody>
                        </table>
                    )}
                </section>
            )}
            {tab === 'fuel_mileage' && canFleet && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 430px), 1fr))', gap: 18, marginTop: 16 }}>
                    <section style={card}>
                        <h2>Daily fleet mass mileage sheet</h2>
                        <label>Date <input type="date" value={date} disabled={busy} onChange={(event) => changeDate(event.target.value)} style={input} /></label>{' '}
                        {canMileageWrite && <button type="button" disabled={busy || !rows} onClick={saveMileage}>Save changed readings</button>}
                        {rows === null ? <p>Mileage unavailable or loading.</p> : (
                            <table style={{ width: '100%', textAlign: 'left', fontSize: 13 }}>
                                <thead><tr><th>Truck</th><th>Opening km</th><th>Closing km</th><th>Daily km</th><th>Status</th></tr></thead>
                                <tbody>{rows.map((row) => {
                                    const distance = row.opening_km !== '' && row.closing_km !== '' ? Number(row.closing_km) - Number(row.opening_km) : null;
                                    return <tr key={row.truck_id}>
                                        <td>{row.plate_number}</td>
                                        <td><input aria-label={`${row.plate_number} opening km`} type="number" min="0" step="0.1" disabled={!canMileageWrite || busy} value={row.opening_km} onChange={(event) => updateRow(row.truck_id, 'opening_km', event.target.value)} style={{ width: 90 }} /></td>
                                        <td><input aria-label={`${row.plate_number} closing km`} type="number" min="0" step="0.1" disabled={!canMileageWrite || busy} value={row.closing_km} onChange={(event) => updateRow(row.truck_id, 'closing_km', event.target.value)} style={{ width: 90 }} /></td>
                                        <td>{distance === null ? '—' : distance < 0 ? 'Invalid' : distance.toLocaleString()}</td>
                                        <td><select aria-label={`${row.plate_number} status`} disabled={!canMileageWrite || busy} value={row.yard_status} onChange={(event) => updateRow(row.truck_id, 'yard_status', event.target.value)}>
                                            <option>On Corridor</option><option>Yard Standby (0 km)</option><option>Garage Bay</option>
                                        </select></td>
                                    </tr>;
                                })}</tbody>
                            </table>
                        )}
                    </section>
                    <section style={card}>
                        <h2>Fuel card, trip &amp; eTIMS records</h2>
                        <p>References are recorded, not independently verified against the card provider or KRA.</p>
                        {canFuelWrite && <form onSubmit={saveFuel} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <label>Date <input aria-label="Fuel date" type="date" required value={fuel.fuel_date} onChange={(e) => setFuel({ ...fuel, fuel_date: e.target.value })} style={input} /></label>
                            <select aria-label="Truck" required value={fuel.truck_id} onChange={(e) => setFuel({ ...fuel, truck_id: e.target.value, trip_id: '' })} style={input}>
                                <option value="">Select truck</option>{(rows || []).map((r) => <option key={r.truck_id} value={r.truck_id}>{r.plate_number}</option>)}
                            </select>
                            <select aria-label="Active trip" value={fuel.trip_id} onChange={(e) => setFuel({ ...fuel, trip_id: e.target.value })} style={input}>
                                <option value="">No active trip</option>{trips.filter((trip) => String(trip.truck_id) === fuel.truck_id).map((trip) => <option key={trip.id} value={trip.id}>{trip.tracking_code} ({trip.origin} → {trip.destination})</option>)}
                            </select>
                            <input aria-label="Station" required placeholder="Station" value={fuel.station_name} onChange={(e) => setFuel({ ...fuel, station_name: e.target.value })} style={input} />
                            <input aria-label="Fuel card reference" placeholder="Fuel card reference" value={fuel.card_reference} onChange={(e) => setFuel({ ...fuel, card_reference: e.target.value })} style={input} />
                            <input aria-label="eTIMS invoice reference" placeholder="eTIMS invoice reference" value={fuel.etims_invoice_no} onChange={(e) => setFuel({ ...fuel, etims_invoice_no: e.target.value })} style={input} />
                            <input aria-label="Litres" type="number" min="0.01" step="0.01" required placeholder="Litres" value={fuel.litres} onChange={(e) => setFuel({ ...fuel, litres: e.target.value })} style={input} />
                            <input aria-label="Price per litre" type="number" min="0.01" step="0.01" required placeholder="Price per litre (KES)" value={fuel.price_per_litre} onChange={(e) => setFuel({ ...fuel, price_per_litre: e.target.value })} style={input} />
                            <input aria-label="Odometer" type="number" min="0" step="0.1" placeholder="Odometer km" value={fuel.odometer_reading} onChange={(e) => setFuel({ ...fuel, odometer_reading: e.target.value })} style={input} />
                            <input aria-label="Distance since last fill" type="number" min="0" step="0.1" placeholder="Km since last fill" value={fuel.km_since_last_fill} onChange={(e) => setFuel({ ...fuel, km_since_last_fill: e.target.value })} style={input} />
                            <button type="submit" disabled={busy || !rows} style={{ gridColumn: 'span 2' }}>Record fuel entry</button>
                        </form>}
                        {records === null ? <p>Fuel records unavailable or loading.</p> : records.slice(0, 8).map((record) => (
                            <div key={record.id} style={{ borderTop: '1px solid #ddd', padding: '10px 0' }}>
                                <strong>{record.plate_number}</strong> · {record.litres} L · KES {Number(record.total_amount).toLocaleString()}
                                <div>{record.station_name} · {record.audit_status}{record.flag_reason ? `: ${record.flag_reason}` : ''}</div>
                            </div>
                        ))}
                    </section>
                </div>
            )}
        </main>
    );
}
