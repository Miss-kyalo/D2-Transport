import { useState, useEffect } from 'react';
import api from '../api';

export default function InventoryFinanceHub() {
    const [tab, setTab] = useState('command');
    const [overview, setOverview] = useState(null);
    const [items, setItems] = useState([]);
    const [bankEntries, setBankEntries] = useState([]);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const [newItem, setNewItem] = useState({
        sku: '',
        item_name: '',
        category: 'Truck & Trailer Spares',
        unit_of_measure: 'PCS',
        unit_cost: 0,
        quantity_on_hand: 0,
        reorder_level: 2,
        bin_location: '',
        requires_old_core: true
    });

    const [stockMove, setStockMove] = useState({
        item_id: '',
        movement_type: 'STOCK_IN',
        quantity: 1,
        unit_cost: '',
        department_source: 'GARAGE',
        supplier_name: '',
        etims_invoice_no: '',
        old_core_returned: false,
        notes: ''
    });

    const [pettyForm, setPettyForm] = useState({
        department_source: 'FLEET_TRANSPORT',
        purpose: '',
        items_requested: '',
        amount_requested: 0,
        payment_channel: 'Openfloat'
    });

    const [bankForm, setBankForm] = useState({
        entry_date: new Date().toISOString().slice(0, 10),
        account_name: 'NCBA Corporate KES',
        bank_reference: '',
        entry_type: 'DEBIT',
        department_source: 'FLEET_TRANSPORT',
        description: '',
        amount: 0,
        currency: 'KES',
        etims_ref: '',
        reconciled: true
    });

    const loadAll = async () => {
        try {
            const [cmdRes, itemsRes, bankRes] = await Promise.all([
                api.get('/control/command-center'),
                api.get('/control/inventory/items'),
                api.get('/control/bank-ledger')
            ]);
            setOverview(cmdRes.data);
            setItems(itemsRes.data.items || []);
            setBankEntries(bankRes.data.entries || []);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load live control center.');
        }
    };

    useEffect(() => {
        let active = true;
        Promise.all([
            api.get('/control/command-center'),
            api.get('/control/inventory/items'),
            api.get('/control/bank-ledger')
        ])
            .then(([cmdRes, itemsRes, bankRes]) => {
                if (!active) return;
                setOverview(cmdRes.data);
                setItems(itemsRes.data.items || []);
                setBankEntries(bankRes.data.entries || []);
            })
            .catch((err) => {
                if (active) setError(err.response?.data?.error || 'Failed to load live control center.');
            });
        return () => { active = false; };
    }, []);

    const handleCreateItem = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        try {
            const res = await api.post('/control/inventory/items', newItem);
            setMessage(res.data.message);
            setNewItem({ sku: '', item_name: '', category: 'Truck & Trailer Spares', unit_of_measure: 'PCS', unit_cost: 0, quantity_on_hand: 0, reorder_level: 2, bin_location: '', requires_old_core: true });
            loadAll();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to add inventory item.');
        }
    };

    const handleStockMove = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        try {
            const res = await api.post('/control/inventory/movements', stockMove);
            setMessage(res.data.message);
            setStockMove({ item_id: '', movement_type: 'STOCK_IN', quantity: 1, unit_cost: '', department_source: 'GARAGE', supplier_name: '', etims_invoice_no: '', old_core_returned: false, notes: '' });
            loadAll();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to record stock movement.');
        }
    };

    const handleConfirmCore = async (movId) => {
        try {
            const res = await api.patch(`/control/inventory/movements/${movId}/return-core`);
            setMessage(res.data.message);
            loadAll();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to confirm old core return.');
        }
    };

    const handlePrepAlert = async (alertId) => {
        try {
            const res = await api.patch(`/control/pre-arrival-alerts/${alertId}/prep`, { kit_prepared: true, status: 'Spares Staged' });
            setMessage(res.data.message);
            loadAll();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to stage pre-arrival spares.');
        }
    };

    const handleRequestPettyCash = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        try {
            const res = await api.post('/control/petty-cash', pettyForm);
            setMessage(res.data.message);
            setPettyForm({ department_source: 'FLEET_TRANSPORT', purpose: '', items_requested: '', amount_requested: 0, payment_channel: 'Openfloat' });
            loadAll();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to request petty cash.');
        }
    };

    const handleSettlePettyCash = async (voucher) => {
        const etims = window.prompt(`Enter KRA eTIMS CU Invoice Number for ${voucher.voucher_no}:`);
        if (!etims) return;
        const bought = window.prompt('Items actually bought:', voucher.items_requested);
        const spent = window.prompt('Actual KES spent:', voucher.amount_disbursed || voucher.amount_requested);
        const change = Math.max(0, Number(voucher.amount_disbursed || voucher.amount_requested) - Number(spent || 0));

        try {
            const res = await api.patch(`/control/petty-cash/${voucher.id}/settle`, {
                items_bought: bought,
                actual_spent: spent,
                change_returned: change,
                etims_cu_invoice_no: etims
            });
            setMessage(res.data.message);
            loadAll();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to settle petty cash.');
        }
    };

    const handleCreateBankEntry = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        try {
            const res = await api.post('/control/bank-ledger', bankForm);
            setMessage(res.data.message);
            setBankForm({ entry_date: new Date().toISOString().slice(0, 10), account_name: 'NCBA Corporate KES', bank_reference: '', entry_type: 'DEBIT', department_source: 'FLEET_TRANSPORT', description: '', amount: 0, currency: 'KES', etims_ref: '', reconciled: true });
            loadAll();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to record bank entry.');
        }
    };

    return (
        <div style={{ backgroundColor: '#faf9f5', minHeight: '100vh', padding: '24px', fontFamily: 'Inter, system-ui, sans-serif', color: '#14281d' }}>
            <div style={{ maxWidth: '1360px', margin: '0 auto' }}>
                <div style={{ backgroundColor: '#143628', color: '#f4f1ea', padding: '22px 26px', borderRadius: '12px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: '#d4af37' }}>
                            D2-TRANSPORT EXECUTIVE COMMAND, INVENTORY & eTIMS FINANCE CONTROL
                        </div>
                        <h1 style={{ margin: '4px 0 0', fontSize: '24px' }}>Live Operations, Spares Anti-Theft & Financial Ledger</h1>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {[
                            { id: 'command', label: 'Live Command Center' },
                            { id: 'inventory', label: 'Spares Store & Anti-Theft' },
                            { id: 'finance', label: 'eTIMS Petty Cash & Bank' }
                        ].map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setTab(t.id)}
                                style={{
                                    padding: '9px 14px',
                                    borderRadius: '6px',
                                    border: '1px solid #2d5a44',
                                    backgroundColor: tab === t.id ? '#d4af37' : '#1b4332',
                                    color: tab === t.id ? '#14281d' : '#f4f1ea',
                                    fontWeight: 700,
                                    fontSize: '13px',
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

                {tab === 'command' && overview && (
                    <div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                            <div style={{ backgroundColor: '#fff', border: '1px solid #d6d3c9', borderRadius: '10px', padding: '16px' }}>
                                <div style={{ fontSize: '12px', color: '#52665a', fontWeight: 600 }}>Store Stock Valuation</div>
                                <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px' }}>
                                    KES {Number(overview.inventory.summary.stock_value || 0).toLocaleString()}
                                </div>
                                <div style={{ fontSize: '12px', color: '#52665a' }}>{overview.inventory.summary.sku_count} active SKUs</div>
                            </div>

                            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '16px' }}>
                                <div style={{ fontSize: '12px', color: '#991b1b', fontWeight: 600 }}>Unreturned Old Cores (Theft Risk)</div>
                                <div style={{ fontSize: '24px', fontWeight: 800, color: '#b91c1c', marginTop: '4px' }}>
                                    {overview.inventory.unreturned_cores.length}
                                </div>
                                <div style={{ fontSize: '12px', color: '#991b1b' }}>Issued parts awaiting scrap return</div>
                            </div>

                            <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '16px' }}>
                                <div style={{ fontSize: '12px', color: '#92400e', fontWeight: 600 }}>Incoming Driver Fault Alerts</div>
                                <div style={{ fontSize: '24px', fontWeight: 800, color: '#b45309', marginTop: '4px' }}>
                                    {overview.workshop.incoming_alerts.length}
                                </div>
                                <div style={{ fontSize: '12px', color: '#92400e' }}>Trucks needing pre-arrival spares</div>
                            </div>

                            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '16px' }}>
                                <div style={{ fontSize: '12px', color: '#166534', fontWeight: 600 }}>Live Bank / Float Balances</div>
                                <div style={{ fontSize: '16px', fontWeight: 800, color: '#143628', marginTop: '6px' }}>
                                    {overview.finance.bank_balances.length === 0
                                        ? 'KES 0.00'
                                        : overview.finance.bank_balances.map((b) => `${b.currency} ${Number(b.net_balance).toLocaleString()}`).join(' • ')}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
                            <div style={{ backgroundColor: '#fff', border: '1px solid #d6d3c9', borderRadius: '10px', padding: '18px' }}>
                                <h3 style={{ marginTop: 0 }}>Incoming Driver Pre-Arrival Spares Prep</h3>
                                {overview.workshop.incoming_alerts.length === 0 ? (
                                    <p style={{ fontSize: '13px', color: '#52665a' }}>No incoming truck fault alerts right now.</p>
                                ) : (
                                    overview.workshop.incoming_alerts.map((a) => (
                                        <div key={a.id} style={{ borderBottom: '1px solid #e5e7eb', padding: '10px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                                            <div>
                                                <strong>{a.plate_number}</strong> • {a.fault_system} ({Number(a.current_odometer).toLocaleString()} km)
                                                <div style={{ fontSize: '12px', color: '#334155' }}>{a.driver_description}</div>
                                                {a.requested_spares && <div style={{ fontSize: '12px', color: '#0f766e', fontWeight: 600 }}>Prep Spares: {a.requested_spares}</div>}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handlePrepAlert(a.id)}
                                                style={{ padding: '6px 12px', backgroundColor: a.kit_prepared ? '#15803d' : '#143628', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
                                            >
                                                {a.kit_prepared ? 'Kit Staged' : 'Stage Spares'}
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div style={{ backgroundColor: '#fff', border: '1px solid #d6d3c9', borderRadius: '10px', padding: '18px' }}>
                                <h3 style={{ marginTop: 0 }}>Unreturned Old Cores (Scrap Exchange Control)</h3>
                                {overview.inventory.unreturned_cores.length === 0 ? (
                                    <p style={{ fontSize: '13px', color: '#52665a' }}>All issued high-value parts have returned old cores.</p>
                                ) : (
                                    overview.inventory.unreturned_cores.map((c) => (
                                        <div key={c.id} style={{ borderBottom: '1px solid #e5e7eb', padding: '10px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <strong>{c.item_name}</strong> ({c.quantity} pcs) — {c.plate_number || c.wo_number || c.department_source}
                                                <div style={{ fontSize: '12px', color: '#991b1b' }}>Issued {new Date(c.created_at).toLocaleDateString()} • Old unit not yet returned</div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleConfirmCore(c.id)}
                                                style={{ padding: '6px 12px', backgroundColor: '#b91c1c', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
                                            >
                                                Confirm Old Core
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'inventory' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
                        <form onSubmit={handleCreateItem} style={{ backgroundColor: '#fff', border: '1px solid #d6d3c9', borderRadius: '10px', padding: '18px' }}>
                            <h3 style={{ marginTop: 0 }}>Register Spare Part / Consumable SKU</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                                <input required placeholder="SKU Code (e.g. BRK-001)" value={newItem.sku} onChange={(e) => setNewItem({ ...newItem, sku: e.target.value })} style={{ padding: '8px' }} />
                                <input required placeholder="Part Name" value={newItem.item_name} onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value })} style={{ padding: '8px' }} />
                                <input placeholder="Category" value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })} style={{ padding: '8px' }} />
                                <input placeholder="Bin Location (e.g. RACK-A2)" value={newItem.bin_location} onChange={(e) => setNewItem({ ...newItem, bin_location: e.target.value })} style={{ padding: '8px' }} />
                                <input type="number" placeholder="Unit Cost (KES)" value={newItem.unit_cost} onChange={(e) => setNewItem({ ...newItem, unit_cost: e.target.value })} style={{ padding: '8px' }} />
                                <input type="number" placeholder="Opening Qty" value={newItem.quantity_on_hand} onChange={(e) => setNewItem({ ...newItem, quantity_on_hand: e.target.value })} style={{ padding: '8px' }} />
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '12px' }}>
                                <input type="checkbox" checked={newItem.requires_old_core} onChange={(e) => setNewItem({ ...newItem, requires_old_core: e.target.checked })} />
                                Require Old Part / Core Return Before Closing Job
                            </label>
                            <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#143628', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700 }}>
                                Add SKU to Store
                            </button>
                        </form>

                        <form onSubmit={handleStockMove} style={{ backgroundColor: '#fff', border: '1px solid #d6d3c9', borderRadius: '10px', padding: '18px' }}>
                            <h3 style={{ marginTop: 0 }}>Record Stock-In (eTIMS) or Issue to Job</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                                <select required value={stockMove.item_id} onChange={(e) => setStockMove({ ...stockMove, item_id: e.target.value })} style={{ padding: '8px' }}>
                                    <option value="">-- Select Part --</option>
                                    {items.map((i) => (
                                        <option key={i.id} value={i.id}>{i.sku} — {i.item_name} (Bal: {i.quantity_on_hand})</option>
                                    ))}
                                </select>
                                <select value={stockMove.movement_type} onChange={(e) => setStockMove({ ...stockMove, movement_type: e.target.value })} style={{ padding: '8px' }}>
                                    <option value="STOCK_IN">STOCK IN (eTIMS Purchase)</option>
                                    <option value="ISSUE">ISSUE TO TRUCK / WORK ORDER</option>
                                    <option value="RETURN">RETURN UNUSED TO STORE</option>
                                </select>
                                <input type="number" step="0.5" placeholder="Quantity" value={stockMove.quantity} onChange={(e) => setStockMove({ ...stockMove, quantity: e.target.value })} style={{ padding: '8px' }} />
                                <input placeholder="eTIMS Invoice # (Mandatory for Purchase)" value={stockMove.etims_invoice_no} onChange={(e) => setStockMove({ ...stockMove, etims_invoice_no: e.target.value })} style={{ padding: '8px' }} />
                                <select value={stockMove.department_source} onChange={(e) => setStockMove({ ...stockMove, department_source: e.target.value })} style={{ padding: '8px' }}>
                                    <option value="GARAGE">Commercial Garage</option>
                                    <option value="FLEET_TRANSPORT">Heavy Freight Fleet</option>
                                    <option value="CONTAINER_DEPOT">Container Depot</option>
                                </select>
                                <input placeholder="Notes / Truck Plate / WO#" value={stockMove.notes} onChange={(e) => setStockMove({ ...stockMove, notes: e.target.value })} style={{ padding: '8px' }} />
                            </div>
                            <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#1b4332', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700 }}>
                                Post Stock Movement
                            </button>
                        </form>
                    </div>
                )}

                {tab === 'finance' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
                        <div style={{ backgroundColor: '#fff', border: '1px solid #d6d3c9', borderRadius: '10px', padding: '18px' }}>
                            <h3 style={{ marginTop: 0 }}>Petty Cash & Openfloat (eTIMS Enforced)</h3>
                            <form onSubmit={handleRequestPettyCash} style={{ display: 'grid', gap: '8px', marginBottom: '16px' }}>
                                <input required placeholder="Purpose (e.g. Emergency Air Valve KDK 412M)" value={pettyForm.purpose} onChange={(e) => setPettyForm({ ...pettyForm, purpose: e.target.value })} style={{ padding: '8px' }} />
                                <input required placeholder="Items to Buy" value={pettyForm.items_requested} onChange={(e) => setPettyForm({ ...pettyForm, items_requested: e.target.value })} style={{ padding: '8px' }} />
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <input type="number" required placeholder="Amount Requested (KES)" value={pettyForm.amount_requested} onChange={(e) => setPettyForm({ ...pettyForm, amount_requested: e.target.value })} style={{ padding: '8px' }} />
                                    <select value={pettyForm.payment_channel} onChange={(e) => setPettyForm({ ...pettyForm, payment_channel: e.target.value })} style={{ padding: '8px' }}>
                                        <option value="Openfloat">Openfloat</option>
                                        <option value="M-Pesa Till/Paybill">M-Pesa Till/Paybill</option>
                                        <option value="Cash Box">Cash Box</option>
                                    </select>
                                </div>
                                <button type="submit" style={{ padding: '9px', backgroundColor: '#143628', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700 }}>
                                    Submit Petty Cash Requisition
                                </button>
                            </form>

                            {(overview?.finance?.open_petty_cash || []).map((v) => (
                                <div key={v.id} style={{ borderTop: '1px solid #e5e7eb', padding: '10px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <strong>{v.voucher_no}</strong> — {v.requester_name} (KES {Number(v.amount_requested).toLocaleString()})
                                        <div style={{ fontSize: '12px', color: '#52665a' }}>{v.purpose} • Status: {v.status}</div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleSettlePettyCash(v)}
                                        style={{ padding: '6px 10px', backgroundColor: '#0f766e', color: '#fff', border: 'none', borderRadius: '5px', fontSize: '12px', cursor: 'pointer' }}
                                    >
                                        Settle with eTIMS
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div style={{ backgroundColor: '#fff', border: '1px solid #d6d3c9', borderRadius: '10px', padding: '18px' }}>
                            <h3 style={{ marginTop: 0 }}>Bank & Openfloat Statement Reconciliation</h3>
                            <form onSubmit={handleCreateBankEntry} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                                <input type="date" value={bankForm.entry_date} onChange={(e) => setBankForm({ ...bankForm, entry_date: e.target.value })} style={{ padding: '8px' }} />
                                <input required placeholder="Account (e.g. NCBA KES / Openfloat)" value={bankForm.account_name} onChange={(e) => setBankForm({ ...bankForm, account_name: e.target.value })} style={{ padding: '8px' }} />
                                <input required placeholder="Bank / M-Pesa Reference" value={bankForm.bank_reference} onChange={(e) => setBankForm({ ...bankForm, bank_reference: e.target.value })} style={{ padding: '8px' }} />
                                <select value={bankForm.entry_type} onChange={(e) => setBankForm({ ...bankForm, entry_type: e.target.value })} style={{ padding: '8px' }}>
                                    <option value="DEBIT">DEBIT (Money Out)</option>
                                    <option value="CREDIT">CREDIT (Client Payment In)</option>
                                </select>
                                <input required placeholder="Description" value={bankForm.description} onChange={(e) => setBankForm({ ...bankForm, description: e.target.value })} style={{ padding: '8px' }} />
                                <input type="number" required placeholder="Amount" value={bankForm.amount} onChange={(e) => setBankForm({ ...bankForm, amount: e.target.value })} style={{ padding: '8px' }} />
                                <button type="submit" style={{ gridColumn: 'span 2', padding: '9px', backgroundColor: '#1b4332', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700 }}>
                                    Record & Reconcile Bank Entry
                                </button>
                            </form>

                            {bankEntries.slice(0, 8).map((b) => (
                                <div key={b.id} style={{ borderTop: '1px solid #e5e7eb', padding: '8px 0', fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
                                    <div>
                                        <strong>{b.bank_reference}</strong> • {b.description}
                                        <div style={{ color: '#52665a' }}>{b.account_name} • {new Date(b.entry_date).toLocaleDateString()}</div>
                                    </div>
                                    <strong style={{ color: b.entry_type === 'CREDIT' ? '#15803d' : '#991b1b' }}>
                                        {b.entry_type === 'CREDIT' ? '+' : '-'}{b.currency} {Number(b.amount).toLocaleString()}
                                    </strong>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}