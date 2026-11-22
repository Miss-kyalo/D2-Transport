import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

const inputClass = 'w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white';
const buttonClass = 'rounded bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50';

export default function SharedWorkbenchPanel() {
    const [data, setData] = useState({ work_orders: [], inventory: [], drivers: [], mechanics: [] });
    const [selectedId, setSelectedId] = useState('');
    const [requests, setRequests] = useState([]);
    const [alerts, setAlerts] = useState(null);
    const [driverId, setDriverId] = useState('');
    const [mechanicId, setMechanicId] = useState('');
    const [itemId, setItemId] = useState('');
    const [qty, setQty] = useState('1');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const role = localStorage.getItem('role');
    const canReview = ['Admin', 'Storekeeper'].includes(role);
    const canRequest = ['Admin', 'Mechanic', 'FleetManager'].includes(role);
    const selected = data.work_orders.find((order) => String(order.id) === selectedId);

    useEffect(() => {
        let active = true;
        api.get('/garage/shared-workbench')
            .then((response) => { if (active) setData(response.data); })
            .catch((err) => { if (active) setError(err.response?.data?.error || 'Failed to load shared workbench.'); });
        api.get('/control/pre-arrival-alerts')
            .then((response) => { if (active) setAlerts(response.data.alerts); })
            .catch((err) => { if (active) setError(err.response?.data?.error || 'Failed to load pre-arrival alerts.'); });
        return () => { active = false; };
    }, []);

    useEffect(() => {
        if (!selectedId) return undefined;
        let active = true;
        api.get(`/garage/shared-workbench/${selectedId}/parts`)
            .then((response) => { if (active) setRequests(response.data.requests); })
            .catch((err) => { if (active) setError(err.response?.data?.error || 'Failed to load parts requests.'); });
        return () => { active = false; };
    }, [selectedId]);

    const selectOrder = (id) => {
        const order = data.work_orders.find((entry) => String(entry.id) === id);
        setSelectedId(id);
        setDriverId(order?.driver_id ? String(order.driver_id) : '');
        setMechanicId(order?.assigned_mechanic_id ? String(order.assigned_mechanic_id) : '');
        setRequests([]);
        setError('');
        setMessage('');
    };

    const refresh = async () => {
        const [workbench, parts] = await Promise.all([
            api.get('/garage/shared-workbench'),
            api.get(`/garage/shared-workbench/${selectedId}/parts`)
        ]);
        setData(workbench.data);
        setRequests(parts.data.requests);
    };

    const perform = async (action) => {
        setBusy(true);
        setError('');
        setMessage('');
        try {
            const response = await action();
            setMessage(response.data.message);
            await refresh();
        } catch (err) {
            setError(err.response?.data?.error || 'Shared workbench operation failed.');
        } finally {
            setBusy(false);
        }
    };

    const stageAlert = async (id) => {
        setBusy(true);
        setError('');
        setMessage('');
        try {
            const response = await api.patch(`/control/pre-arrival-alerts/${id}/prep`);
            setMessage(response.data.message);
            const refreshed = await api.get('/control/pre-arrival-alerts');
            setAlerts(refreshed.data.alerts);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to stage alert.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="mb-6 space-y-4 rounded-xl border border-slate-700 bg-slate-900 p-4" aria-label="Shared work orders">
            <div>
                <h2 className="text-lg font-semibold">Shared work orders and parts</h2>
                <p className="text-sm text-slate-400">Select a shared garage, fleet, or depot work order. Requests are reviewed by the storekeeper before issue.</p>
                {canRequest && <Link to="/garage/department" className="text-sm text-emerald-300 underline">Open or manage a work order</Link>}
            </div>
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            {message && <p role="status" className="text-sm text-emerald-300">{message}</p>}
            <div>
                <h3 className="font-semibold">Driver pre-arrival alerts</h3>
                {alerts === null ? <p className="text-sm text-slate-400">Alerts unavailable or loading.</p> : alerts.length === 0 ? <p className="text-sm text-slate-400">No incoming alerts.</p> : (
                    <ul className="space-y-2">
                        {alerts.map((alert) => (
                            <li key={alert.id} className="rounded bg-slate-800 p-2 text-sm">
                                <p><strong>{alert.plate_number || 'Truck unavailable'}</strong> · {alert.fault_system} · {alert.current_odometer} km · {alert.status}</p>
                                <p>{alert.driver_description}</p>
                                {alert.requested_spares && <p>Requested spares: {alert.requested_spares}</p>}
                                <p>Reported by {alert.reporter_name || 'Unknown'}{alert.reported_for_name ? ` for ${alert.reported_for_name}` : ''}</p>
                                {canReview && !alert.kit_prepared && <button type="button" disabled={busy} className={buttonClass} onClick={() => stageAlert(alert.id)}>Mark spares staged</button>}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <label className="block text-sm">
                Work order
                <select value={selectedId} disabled={busy} onChange={(event) => selectOrder(event.target.value)} className={inputClass}>
                    <option value="">Select a work order</option>
                    {data.work_orders.map((order) => (
                        <option key={order.id} value={order.id}>{order.wo_number} — {order.asset_identifier} ({order.status})</option>
                    ))}
                </select>
            </label>
            {selected && (
                <>
                    <div className="grid gap-2 text-sm sm:grid-cols-2">
                        <p><strong>Asset:</strong> {selected.truck_plate || selected.asset_identifier} — {selected.truck_model || selected.asset_type}</p>
                        <p><strong>Department:</strong> {selected.department_source}</p>
                        <p><strong>Driver:</strong> {selected.driver_name || 'Not assigned'}</p>
                        <p><strong>Mechanic:</strong> {selected.mechanic_name || 'Not assigned'}</p>
                        <p className="sm:col-span-2"><strong>Fault:</strong> {selected.problem_description}</p>
                    </div>
                    {canRequest && (
                        <>
                            <form onSubmit={(event) => {
                                event.preventDefault();
                                void perform(() => api.patch(`/garage/shared-workbench/${selectedId}/assignment`, {
                                    driver_id: driverId ? Number(driverId) : null,
                                    mechanic_id: mechanicId ? Number(mechanicId) : null
                                }));
                            }} className="grid gap-3 sm:grid-cols-3">
                                <label className="text-sm">Driver
                                    <select value={driverId} onChange={(event) => setDriverId(event.target.value)} className={inputClass}>
                                        <option value="">Not assigned</option>
                                        {data.drivers.map((person) => <option key={person.id} value={person.id}>{person.username}</option>)}
                                    </select>
                                </label>
                                <label className="text-sm">Mechanic
                                    <select value={mechanicId} onChange={(event) => setMechanicId(event.target.value)} className={inputClass}>
                                        <option value="">Not assigned</option>
                                        {data.mechanics.map((person) => <option key={person.id} value={person.id}>{person.username}</option>)}
                                    </select>
                                </label>
                                <button type="submit" disabled={busy} className={`${buttonClass} self-end`}>Save assignments</button>
                            </form>
                            <form onSubmit={(event) => {
                                event.preventDefault();
                                void perform(() => api.post(`/garage/shared-workbench/${selectedId}/parts`, { item_id: Number(itemId), qty: Number(qty) }));
                            }} className="grid gap-3 sm:grid-cols-3">
                                <label className="text-sm">Inventory item
                                    <select required value={itemId} onChange={(event) => setItemId(event.target.value)} className={inputClass}>
                                        <option value="">Select a part</option>
                                        {data.inventory.map((item) => <option key={item.id} value={item.id}>#{item.id} — {item.part_name} ({item.sku}; available {item.qty_available})</option>)}
                                    </select>
                                </label>
                                <label className="text-sm">Quantity
                                    <input type="number" min="1" step="1" required value={qty} onChange={(event) => setQty(event.target.value)} className={inputClass} />
                                </label>
                                <button type="submit" disabled={busy || !itemId} className={`${buttonClass} self-end`}>Request part</button>
                            </form>
                        </>
                    )}
                    <div>
                        <h3 className="mb-2 font-semibold">Parts requests, reservations and issues</h3>
                        {requests.length === 0 ? <p className="text-sm text-slate-400">No parts requested for this work order.</p> : (
                            <ul className="space-y-2">
                                {requests.map((request) => (
                                    <li key={request.id} className="flex flex-wrap items-center gap-2 rounded bg-slate-800 p-2 text-sm">
                                        <span>#{request.item_id} — {request.part_name} ({request.sku}) · {request.qty} · {request.status} · requested by {request.requester_name}</span>
                                        {request.unit_cost_at_issue != null && <span> · Issue cost: KES {(Number(request.unit_cost_at_issue) * request.qty).toLocaleString()}</span>}
                                        {canReview && request.status === 'Pending' && <button type="button" disabled={busy} className={buttonClass} onClick={() => perform(() => api.patch(`/garage/shared-workbench/parts/${request.id}`, { action: 'reserve' }))}>Approve &amp; reserve</button>}
                                        {canReview && request.status === 'Reserved' && <button type="button" disabled={busy} className={buttonClass} onClick={() => perform(() => api.patch(`/garage/shared-workbench/parts/${request.id}`, { action: 'issue' }))}>Issue</button>}
                                        {canReview && ['Pending', 'Reserved'].includes(request.status) && <button type="button" disabled={busy} className="rounded bg-red-800 px-3 py-2 text-sm disabled:opacity-50" onClick={() => perform(() => api.patch(`/garage/shared-workbench/parts/${request.id}`, { action: 'reject' }))}>Reject / release</button>}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </>
            )}
        </section>
    );
}
