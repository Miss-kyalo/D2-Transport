import { useState, useEffect } from 'react';
import api from '../api';
import QrPassBadge from '../components/QrPassBadge';

const DEPT_TABS = [
    { id: 'ALL', label: 'Shared Mechanics Portal (All Jobs)' },
    { id: 'GARAGE', label: 'Commercial Garage Business' },
    { id: 'FLEET_TRANSPORT', label: 'Heavy Freight Fleet Bay' },
    { id: 'CONTAINER_DEPOT', label: 'Container Depot Equipment' }
];

const fetchGarageData = (deptFilter, statusFilter) => Promise.all([
    api.get('/garage/meta'),
    api.get('/garage/work-orders', {
        params: { department: deptFilter, status: statusFilter }
    })
]);

export default function GarageDepartment() {
    const [deptFilter, setDeptFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [workOrders, setWorkOrders] = useState([]);
    const [meta, setMeta] = useState({ bays: [], mechanics: [], trucks: [] });
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [activeJobCard, setActiveJobCard] = useState(null);
    const [editingOrder, setEditingOrder] = useState(null);

    const [form, setForm] = useState({
        department_source: 'GARAGE',
        asset_type: 'EXTERNAL_VEHICLE',
        asset_identifier: '',
        truck_id: '',
        bay_id: '',
        customer_or_unit: '',
        customer_phone: '',
        fault_category: 'ENGINE_DRIVETRAIN',
        dtc_codes: '',
        problem_description: '',
        parts_cost: 0,
        labor_cost: 0,
        billing_currency: 'KES',
        priority: 'Normal',
        assigned_mechanic_id: '',
        hold_truck_from_dispatch: true
    });

    const loadData = async () => {
        try {
            const [metaRes, woRes] = await fetchGarageData(deptFilter, statusFilter);
            setMeta(metaRes.data);
            setWorkOrders(woRes.data.work_orders || []);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load garage work orders.');
        }
    };

    useEffect(() => {
        let active = true;
        fetchGarageData(deptFilter, statusFilter)
            .then(([metaRes, woRes]) => {
                if (active) {
                    setMeta(metaRes.data);
                    setWorkOrders(woRes.data.work_orders || []);
                }
            })
            .catch((err) => {
                if (active) setError(err.response?.data?.error || 'Failed to load garage work orders.');
            });

        return () => {
            active = false;
        };
    }, [deptFilter, statusFilter]);

    const handleCreateOrder = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        try {
            const selectedTruck = meta.trucks.find((t) => String(t.id) === String(form.truck_id));
            const payload = {
                ...form,
                asset_identifier: selectedTruck ? selectedTruck.plate_number : form.asset_identifier
            };
            const res = await api.post('/garage/work-orders', payload);
            setMessage(res.data.message);
            setForm({
                department_source: 'GARAGE',
                asset_type: 'EXTERNAL_VEHICLE',
                asset_identifier: '',
                truck_id: '',
                bay_id: '',
                customer_or_unit: '',
                customer_phone: '',
                fault_category: 'ENGINE_DRIVETRAIN',
                dtc_codes: '',
                problem_description: '',
                parts_cost: 0,
                labor_cost: 0,
                billing_currency: 'KES',
                priority: 'Normal',
                assigned_mechanic_id: '',
                hold_truck_from_dispatch: true
            });
            loadData();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to log work order.');
        }
    };

    const handleUpdateOrder = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        try {
            const res = await api.patch(`/garage/work-orders/${editingOrder.id}`, editingOrder);
            setMessage(res.data.message);
            setEditingOrder(null);
            loadData();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update work order.');
        }
    };

    return (
        <div style={{ padding: '24px', maxWidth: '1320px', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif', color: '#0f172a' }}>
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    #printable-job-card, #printable-job-card * { visibility: visible; }
                    #printable-job-card {
                        position: fixed;
                        left: 0;
                        top: 0;
                        width: 100%;
                        border: none !important;
                        box-shadow: none !important;
                    }
                    .no-print { display: none !important; }
                }
            `}</style>

            <div style={{ backgroundColor: '#1e293b', color: '#f8fafc', padding: '22px 26px', borderRadius: '12px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: '#fbbf24' }}>
                        D2-TRANSPORT COMMERCIAL GARAGE & SHARED MECHANICS PORTAL
                    </div>
                    <h1 style={{ margin: '4px 0 0', fontSize: '24px' }}>Workshop Bays, Diagnostics & Cross-Division Repairs</h1>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {DEPT_TABS.map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setDeptFilter(t.id)}
                            style={{
                                padding: '8px 13px',
                                borderRadius: '6px',
                                border: '1px solid #475569',
                                backgroundColor: deptFilter === t.id ? '#f59e0b' : '#0f172a',
                                color: deptFilter === t.id ? '#0f172a' : '#e2e8f0',
                                fontWeight: 700,
                                fontSize: '12px',
                                cursor: 'pointer'
                            }}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {error && <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '14px' }}>{error}</div>}
            {message && <div style={{ padding: '12px', backgroundColor: '#dcfce7', color: '#14532d', borderRadius: '8px', marginBottom: '14px' }}>{message}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', alignItems: 'start' }}>
                {/* Intake Work Order Form */}
                <form onSubmit={handleCreateOrder} style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '18px' }}>
                    <h3 style={{ marginTop: 0 }}>New Garage / Workshop Intake</h3>

                    <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600 }}>Business Department</label>
                        <select value={form.department_source} onChange={(e) => setForm({ ...form, department_source: e.target.value })} style={{ width: '100%', padding: '8px' }}>
                            <option value="GARAGE">Commercial Garage (External Client)</option>
                            <option value="FLEET_TRANSPORT">Heavy Freight Transport Division</option>
                            <option value="CONTAINER_DEPOT">Container Depot Equipment</option>
                        </select>
                    </div>

                    {form.department_source === 'FLEET_TRANSPORT' ? (
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600 }}>Select Fleet Truck</label>
                            <select required value={form.truck_id} onChange={(e) => setForm({ ...form, truck_id: e.target.value, asset_type: 'TRUCK' })} style={{ width: '100%', padding: '8px' }}>
                                <option value="">-- Choose Fleet Truck --</option>
                                {meta.trucks.map((tr) => (
                                    <option key={tr.id} value={tr.id}>{tr.plate_number} ({tr.status})</option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600 }}>Vehicle Reg / Equipment ID</label>
                            <input type="text" required placeholder="e.g. KDK 412M or REACH-STACKER-01" value={form.asset_identifier} onChange={(e) => setForm({ ...form, asset_identifier: e.target.value })} style={{ width: '100%', padding: '8px' }} />
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600 }}>Client / Unit Name</label>
                            <input type="text" placeholder="Client or Yard Unit" value={form.customer_or_unit} onChange={(e) => setForm({ ...form, customer_or_unit: e.target.value })} style={{ width: '100%', padding: '8px' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600 }}>Workshop Bay</label>
                            <select value={form.bay_id} onChange={(e) => setForm({ ...form, bay_id: e.target.value })} style={{ width: '100%', padding: '8px' }}>
                                <option value="">-- Assign Bay --</option>
                                {meta.bays.map((b) => (
                                    <option key={b.id} value={b.id}>{b.bay_code}: {b.bay_name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600 }}>Fault Category</label>
                            <select value={form.fault_category} onChange={(e) => setForm({ ...form, fault_category: e.target.value })} style={{ width: '100%', padding: '8px' }}>
                                <option value="ENGINE_DRIVETRAIN">Engine & Drivetrain</option>
                                <option value="BRAKES_SUSPENSION">Brakes, Axles & Suspension</option>
                                <option value="OBD_DTC">OBD-II / Electrical Fault</option>
                                <option value="HYDRAULICS_CHASSIS">Hydraulics & Twistlocks</option>
                                <option value="PREVENTIVE_SERVICE">Preventive Service (PM)</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600 }}>Priority</label>
                            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} style={{ width: '100%', padding: '8px' }}>
                                <option value="Normal">Normal</option>
                                <option value="Urgent">Urgent</option>
                                <option value="Critical">Critical (VOR / Breakdown)</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600 }}>OBD-II / Diagnostic Codes (Optional)</label>
                        <input type="text" placeholder="e.g. P0299, SPN 157" value={form.dtc_codes} onChange={(e) => setForm({ ...form, dtc_codes: e.target.value })} style={{ width: '100%', padding: '8px' }} />
                    </div>

                    <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600 }}>Fault & Inspection Notes</label>
                        <textarea rows={3} required value={form.problem_description} onChange={(e) => setForm({ ...form, problem_description: e.target.value })} style={{ width: '100%', padding: '8px' }} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600 }}>Est. Parts (KES)</label>
                            <input type="number" value={form.parts_cost} onChange={(e) => setForm({ ...form, parts_cost: e.target.value })} style={{ width: '100%', padding: '8px' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600 }}>Est. Labor (KES)</label>
                            <input type="number" value={form.labor_cost} onChange={(e) => setForm({ ...form, labor_cost: e.target.value })} style={{ width: '100%', padding: '8px' }} />
                        </div>
                    </div>

                    <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}>
                        Open Work Order
                    </button>
                </form>

                {/* Shared Mechanics Queue */}
                <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '18px', overflowX: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                        <h3 style={{ margin: 0 }}>Shared Mechanics Workbench ({workOrders.length})</h3>
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                            <option value="ALL">All Statuses</option>
                            <option value="Open">Open</option>
                            <option value="In Bay">In Bay</option>
                            <option value="Awaiting Parts">Awaiting Parts</option>
                            <option value="Completed">Completed</option>
                            <option value="Released">Released</option>
                        </select>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                                <th style={{ padding: '8px' }}>WO # & Dept</th>
                                <th style={{ padding: '8px' }}>Asset & Client</th>
                                <th style={{ padding: '8px' }}>Fault & DTC</th>
                                <th style={{ padding: '8px' }}>Bay / Mechanic</th>
                                <th style={{ padding: '8px' }}>Estimate</th>
                                <th style={{ padding: '8px' }}>Status</th>
                                <th style={{ padding: '8px' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {workOrders.map((wo) => (
                                <tr key={wo.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                    <td style={{ padding: '8px' }}>
                                        <strong>{wo.wo_number}</strong>
                                        <div style={{ fontSize: '11px', color: '#475569' }}>{wo.department_source}</div>
                                    </td>
                                    <td style={{ padding: '8px' }}>
                                        <strong>{wo.asset_identifier}</strong>
                                        <div style={{ fontSize: '12px', color: '#64748b' }}>{wo.customer_or_unit || 'Internal'}</div>
                                    </td>
                                    <td style={{ padding: '8px' }}>
                                        <div>{wo.fault_category}</div>
                                        {wo.dtc_codes && <div style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 700 }}>DTC: {wo.dtc_codes}</div>}
                                    </td>
                                    <td style={{ padding: '8px' }}>
                                        <div>{wo.bay_code || 'Unassigned'}</div>
                                        <div style={{ fontSize: '12px', color: '#64748b' }}>{wo.mechanic_name || '—'}</div>
                                    </td>
                                    <td style={{ padding: '8px', fontWeight: 700 }}>
                                        {wo.billing_currency} {Number(wo.total_estimate).toLocaleString()}
                                    </td>
                                    <td style={{ padding: '8px', fontWeight: 700 }}>{wo.status}</td>
                                    <td style={{ padding: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        <button type="button" onClick={() => setEditingOrder({ ...wo })} style={{ padding: '5px 9px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
                                            Update Bay
                                        </button>
                                        <button type="button" onClick={() => setActiveJobCard(wo)} style={{ padding: '5px 9px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
                                            Job Card
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mechanic Update Modal */}
            {editingOrder && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.65)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px', zIndex: 60 }}>
                    <form onSubmit={handleUpdateOrder} style={{ backgroundColor: '#fff', padding: '22px', borderRadius: '10px', width: '100%', maxWidth: '500px' }}>
                        <h3 style={{ marginTop: 0 }}>Mechanic Update — {editingOrder.wo_number} ({editingOrder.asset_identifier})</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px', fontSize: '13px' }}>
                            <div>
                                <label>Job Status</label>
                                <select value={editingOrder.status} onChange={(e) => setEditingOrder({ ...editingOrder, status: e.target.value })} style={{ width: '100%', padding: '8px' }}>
                                    <option value="Open">Open</option>
                                    <option value="In Bay">In Bay</option>
                                    <option value="Awaiting Parts">Awaiting Parts</option>
                                    <option value="Completed">Completed</option>
                                    <option value="Released">Released</option>
                                </select>
                            </div>
                            <div>
                                <label>Assigned Mechanic</label>
                                <select value={editingOrder.assigned_mechanic_id || ''} onChange={(e) => setEditingOrder({ ...editingOrder, assigned_mechanic_id: e.target.value })} style={{ width: '100%', padding: '8px' }}>
                                    <option value="">-- Select Mechanic --</option>
                                    {meta.mechanics.map((m) => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label>Parts Cost (KES)</label>
                                <input type="number" value={editingOrder.parts_cost} onChange={(e) => setEditingOrder({ ...editingOrder, parts_cost: e.target.value })} style={{ width: '100%', padding: '8px' }} />
                            </div>
                            <div>
                                <label>Labor Cost (KES)</label>
                                <input type="number" value={editingOrder.labor_cost} onChange={(e) => setEditingOrder({ ...editingOrder, labor_cost: e.target.value })} style={{ width: '100%', padding: '8px' }} />
                            </div>
                        </div>
                        <div style={{ marginBottom: '12px', fontSize: '13px' }}>
                            <label>Parts Fitted & Repair Summary</label>
                            <textarea rows={3} value={editingOrder.parts_used || ''} onChange={(e) => setEditingOrder({ ...editingOrder, parts_used: e.target.value })} style={{ width: '100%', padding: '8px' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button type="button" onClick={() => setEditingOrder(null)} style={{ padding: '8px 14px' }}>Cancel</button>
                            <button type="submit" style={{ padding: '8px 16px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700 }}>Save Repair Log</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Printable Garage Job Card / Invoice */}
            {activeJobCard && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.65)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px', zIndex: 70 }}>
                    <div id="printable-job-card" style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', width: '100%', maxWidth: '640px', border: '1px solid #cbd5e1' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '14px' }}>
                            <div>
                                <h2 style={{ margin: 0 }}>D2-TRANSPORT COMMERCIAL GARAGE</h2>
                                <div style={{ fontSize: '12px', color: '#475569' }}>Heavy Diesel, Trailer & Depot Plant Maintenance • Athi River</div>
                                <div style={{ fontSize: '13px', marginTop: '4px' }}>
                                    Job Card: <strong>{activeJobCard.wo_number}</strong> • Dept: <strong>{activeJobCard.department_source}</strong>
                                </div>
                            </div>
                            <QrPassBadge code={activeJobCard.wo_number} label="Scan Workshop Job Card" />
                        </div>

                        <div style={{ fontSize: '13px', lineHeight: 1.7, marginBottom: '14px' }}>
                            <div><strong>Asset / Plate:</strong> {activeJobCard.asset_identifier} ({activeJobCard.customer_or_unit || 'Internal'})</div>
                            <div><strong>Fault Category:</strong> {activeJobCard.fault_category} {activeJobCard.dtc_codes ? `| DTC: ${activeJobCard.dtc_codes}` : ''}</div>
                            <div><strong>Reported Issue:</strong> {activeJobCard.problem_description}</div>
                            <div><strong>Parts Used:</strong> {activeJobCard.parts_used || 'Pending completion'}</div>
                            <div><strong>Total Estimate / Bill:</strong> {activeJobCard.billing_currency} {Number(activeJobCard.total_estimate).toLocaleString()}</div>
                        </div>

                        <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button type="button" onClick={() => window.print()} style={{ padding: '8px 16px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700 }}>Print Job Card</button>
                            <button type="button" onClick={() => setActiveJobCard(null)} style={{ padding: '8px 14px' }}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}