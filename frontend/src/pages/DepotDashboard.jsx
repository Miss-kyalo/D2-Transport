import { useState, useEffect } from 'react';
import api from '../api';

export default function DepotDashboard() {
    const [containers, setContainers] = useState([]);
    const [licenses, setLicenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [blockers, setBlockers] = useState([]);
    const [message, setMessage] = useState('');
    const [releaseContainer, setReleaseContainer] = useState(null);
    const role = localStorage.getItem('role');
    const canManage = ['Admin', 'Dispatcher', 'FleetManager'].includes(role);
    const canManageLicenses = ['Admin', 'FleetManager'].includes(role);

    // Gate-In Form State
    const [gateIn, setGateIn] = useState({
        container_number: '',
        container_type: '40FT',
        principal_name: '',
        principal_currency: 'USD',
        free_days: 7,
        daily_storage_rate: 15,
        yard_bay: '',
        condition_status: 'Sound',
        customs_hold: false,
        kebs_hold: false,
        hold_reason: '',
        truck_plate: '',
        seal_number: '',
        eir_reference: '',
        iicl_damage_codes: ''
    });

    // Selected Container for Compliance / Cleaning / Release Update
    const [activeContainer, setActiveContainer] = useState(null);
    const [complianceForm, setComplianceForm] = useState({
        cleaning_status: 'Washed_Sanitized',
        cleaning_cert_ref: '',
        kephis_cleared: true,
        kebs_hold: false,
        customs_hold: false,
        condition_status: 'Sound',
        wash_bay_used: true,
        effluent_treated: true,
        waste_manifest_ref: '',
        notes: ''
    });

    // Statutory Depot License Form
    const [licenseForm, setLicenseForm] = useState({
        authority: 'NEMA',
        license_name: '',
        license_number: '',
        issued_date: '',
        expiry_date: ''
    });
    const [licenseFile, setLicenseFile] = useState(null);

    const loadDepotData = async () => {
        try {
            setLoading(true);
            const res = await api.get('/depot/overview');
            setContainers(res.data.containers || []);
            setLicenses(res.data.licenses || []);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load depot operations.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let current = true;
        api.get('/depot/overview')
            .then((res) => {
                if (current) {
                    setContainers(res.data.containers);
                    setLicenses(res.data.licenses);
                }
            })
            .catch((err) => {
                if (current) setError(err.response?.data?.error || 'Failed to load depot operations.');
            })
            .finally(() => {
                if (current) setLoading(false);
            });
        return () => { current = false; };
    }, []);

    const handleGateInSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setBlockers([]);
        setMessage('');
        try {
            const res = await api.post('/depot/containers/gate-in', gateIn);
            setMessage(res.data.message);
            setGateIn({
                container_number: '',
                container_type: '40FT',
                principal_name: '',
                principal_currency: 'USD',
                free_days: 7,
                daily_storage_rate: 15,
                yard_bay: '',
                condition_status: 'Sound',
                customs_hold: false,
                kebs_hold: false,
                hold_reason: '',
                truck_plate: '',
                seal_number: '',
                eir_reference: '',
                iicl_damage_codes: ''
            });
            loadDepotData();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to record Gate-In.');
        }
    };

    const openComplianceEditor = (container) => {
        setActiveContainer(container);
        setComplianceForm({
            cleaning_status: container.cleaning_status,
            cleaning_cert_ref: container.cleaning_cert_ref || '',
            kephis_cleared: Boolean(container.kephis_cleared),
            kebs_hold: Boolean(container.kebs_hold),
            customs_hold: Boolean(container.customs_hold),
            condition_status: container.condition_status || 'Sound',
            wash_bay_used: true,
            effluent_treated: true,
            waste_manifest_ref: '',
            notes: ''
        });
    };

    const handleComplianceSave = async (e) => {
        e.preventDefault();
        if (!activeContainer) return;
        setError('');
        setBlockers([]);
        setMessage('');
        try {
            const res = await api.patch(`/depot/containers/${activeContainer.id}/compliance`, complianceForm);
            setMessage(res.data.message);
            setActiveContainer(null);
            loadDepotData();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update container compliance.');
        }
    };

    const handleGateOut = async (event) => {
        event.preventDefault();
        setError('');
        setBlockers([]);
        setMessage('');
        try {
            const data = new FormData(event.currentTarget);
            const res = await api.patch(`/depot/containers/${releaseContainer.id}/gate-out`, {
                truck_plate: data.get('truck_plate'),
                seal_number: data.get('seal_number'),
                eir_reference: data.get('eir_reference'),
                require_sanitized: data.has('require_sanitized'),
                require_kephis: data.has('require_kephis')
            });
            setMessage(res.data.message);
            setReleaseContainer(null);
            loadDepotData();
        } catch (err) {
            setError(err.response?.data?.error || 'Gate-Out blocked.');
            setBlockers(err.response?.data?.blockers || []);
            setReleaseContainer(null);
        }
    };

    const handleAddLicense = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        try {
            const formData = new FormData();
            Object.entries(licenseForm).forEach(([k, v]) => formData.append(k, v));
            if (licenseFile) formData.append('license_doc', licenseFile);

            const res = await api.post('/depot/licenses', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setMessage(res.data.message);
            setLicenseForm({ authority: 'NEMA', license_name: '', license_number: '', issued_date: '', expiry_date: '' });
            setLicenseFile(null);
            loadDepotData();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to save depot license.');
        }
    };

    const computeAccruedStorage = (c) => {
        if (!c.gated_in_at || !Number(c.daily_storage_rate)) return '0.00';
        const end = c.gated_out_at ? new Date(c.gated_out_at) : new Date();
        const days = Math.max(0, Math.floor((end - new Date(c.gated_in_at)) / (1000 * 60 * 60 * 24)));
        const billableDays = Math.max(0, days - Number(c.free_days || 0));
        return (billableDays * Number(c.daily_storage_rate)).toFixed(2);
    };

    return (
        <div style={{ padding: '24px', fontFamily: 'sans-serif', maxWidth: '1280px', margin: '0 auto' }}>
            <div style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '16px', marginBottom: '24px' }}>
                <h1 style={{ margin: 0, color: '#0f172a' }}>Container Depot & Regulatory Compliance Hub</h1>
                <p style={{ margin: '4px 0 0', color: '#64748b' }}>
                    ISO 6346 Validation • KEPHIS Biosecurity & Cleaning • NEMA Wash-Bay Audit • KRA / KEBS Holds
                </p>
            </div>

            {error && (
                <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '6px', marginBottom: '16px' }}>
                    <strong>{error}</strong>
                    {blockers.length > 0 && (
                        <ul style={{ margin: '6px 0 0 18px' }}>
                            {blockers.map((b, idx) => <li key={idx}>{b}</li>)}
                        </ul>
                    )}
                </div>
            )}
            {message && <div style={{ padding: '12px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '6px', marginBottom: '16px' }}>{message}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', marginBottom: '32px' }}>
                {/* Left: Gate-In Form */}
                {canManage && <form onSubmit={handleGateInSubmit} style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '18px', borderRadius: '8px' }}>
                    <h3 style={{ marginTop: 0 }}>Container Gate-In (EIR)</h3>

                    <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>ISO Container Number</label>
                        <input type="text" required placeholder="e.g., MSCU5284910" value={gateIn.container_number} onChange={(e) => setGateIn({ ...gateIn, container_number: e.target.value.toUpperCase() })} style={{ width: '100%', padding: '8px' }} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Size / Type</label>
                            <select value={gateIn.container_type} onChange={(e) => setGateIn({ ...gateIn, container_type: e.target.value })} style={{ width: '100%', padding: '8px' }}>
                                <option value="20FT">20FT GP</option>
                                <option value="40FT">40FT GP</option>
                                <option value="40FT_HC">40FT High Cube</option>
                                <option value="REEFER">40FT Reefer</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Structural Condition</label>
                            <select value={gateIn.condition_status} onChange={(e) => setGateIn({ ...gateIn, condition_status: e.target.value })} style={{ width: '100%', padding: '8px' }}>
                                <option value="Sound">Sound (IICL OK)</option>
                                <option value="Damaged">Damaged (Hold for M&R)</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.6fr', gap: '8px', marginBottom: '10px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Principal / Shipping Line</label>
                            <input type="text" placeholder="e.g., MSC / Grimaldi Italy" value={gateIn.principal_name} onChange={(e) => setGateIn({ ...gateIn, principal_name: e.target.value })} style={{ width: '100%', padding: '8px' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Currency</label>
                            <select value={gateIn.principal_currency} onChange={(e) => setGateIn({ ...gateIn, principal_currency: e.target.value })} style={{ width: '100%', padding: '8px' }}>
                                <option value="USD">USD</option>
                                <option value="EUR">EUR</option>
                                <option value="KES">KES</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Free Days</label>
                            <input type="number" value={gateIn.free_days} onChange={(e) => setGateIn({ ...gateIn, free_days: e.target.value })} style={{ width: '100%', padding: '8px' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Rate / Day</label>
                            <input type="number" step="0.5" value={gateIn.daily_storage_rate} onChange={(e) => setGateIn({ ...gateIn, daily_storage_rate: e.target.value })} style={{ width: '100%', padding: '8px' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Yard Bay</label>
                            <input type="text" placeholder="A-12" value={gateIn.yard_bay} onChange={(e) => setGateIn({ ...gateIn, yard_bay: e.target.value })} style={{ width: '100%', padding: '8px' }} />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Truck Plate</label>
                            <input type="text" placeholder="KDN 412T" value={gateIn.truck_plate} onChange={(e) => setGateIn({ ...gateIn, truck_plate: e.target.value })} style={{ width: '100%', padding: '8px' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Seal / EIR #</label>
                            <input type="text" placeholder="SL-99812" value={gateIn.seal_number} onChange={(e) => setGateIn({ ...gateIn, seal_number: e.target.value })} style={{ width: '100%', padding: '8px' }} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '14px', fontSize: '12px', marginBottom: '12px' }}>
                        <label><input type="checkbox" checked={gateIn.customs_hold} onChange={(e) => setGateIn({ ...gateIn, customs_hold: e.target.checked })} /> KRA Customs Hold</label>
                        <label><input type="checkbox" checked={gateIn.kebs_hold} onChange={(e) => setGateIn({ ...gateIn, kebs_hold: e.target.checked })} /> KEBS Hold</label>
                    </div>

                    <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                        Record Gate-In
                    </button>
                </form>}

                {/* Right: Yard Inventory & Compliance Table */}
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '18px', backgroundColor: '#fff', overflowX: 'auto' }}>
                    <h3 style={{ marginTop: 0 }}>Yard Inventory & Compliance Status</h3>
                    {loading ? <p>Loading yard inventory...</p> : containers.length === 0 ? (
                        <p style={{ color: '#64748b' }}>No containers logged in the depot yet.</p>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                                    <th style={{ padding: '8px' }}>Container</th>
                                    <th style={{ padding: '8px' }}>Principal / Storage</th>
                                    <th style={{ padding: '8px' }}>Hygiene & KEPHIS</th>
                                    <th style={{ padding: '8px' }}>Holds / IICL</th>
                                    <th style={{ padding: '8px' }}>Status</th>
                                    <th style={{ padding: '8px' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {containers.map((c) => (
                                    <tr key={c.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                        <td style={{ padding: '8px' }}>
                                            <strong>{c.container_number}</strong>
                                            <div style={{ color: '#64748b' }}>{c.container_type} • Bay {c.yard_bay || '—'}</div>
                                            {!c.iso_check_valid && <span style={{ color: '#dc2626', fontWeight: 'bold' }}>ISO Check Digit Warning</span>}
                                        </td>
                                        <td style={{ padding: '8px' }}>
                                            <div>{c.principal_name || 'Local'}</div>
                                            <div style={{ color: '#0f766e', fontWeight: 'bold' }}>
                                                {c.principal_currency} {computeAccruedStorage(c)}
                                            </div>
                                        </td>
                                        <td style={{ padding: '8px' }}>
                                            <div>Clean: <strong style={{ color: c.cleaning_status === 'Pending' ? '#b91c1c' : '#166534' }}>{c.cleaning_status}</strong></div>
                                            <div>KEPHIS: <strong style={{ color: c.kephis_cleared ? '#166534' : '#b91c1c' }}>{c.kephis_cleared ? 'Cleared' : 'Pending'}</strong></div>
                                        </td>
                                        <td style={{ padding: '8px' }}>
                                            <div>IICL: <strong>{c.condition_status}</strong></div>
                                            <span style={{ color: c.customs_hold ? '#dc2626' : '#166534', display: 'block' }}>Customs: {c.customs_hold ? 'Hold' : 'Clear'}</span>
                                            {c.kebs_hold && <span style={{ color: '#dc2626', display: 'block' }}>KEBS Hold</span>}
                                        </td>
                                        <td style={{ padding: '8px', fontWeight: 'bold' }}>{c.status}</td>
                                        <td style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            {canManage && c.status !== 'Gated-Out' && <button onClick={() => openComplianceEditor(c)} style={{ padding: '4px 8px', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                                Clean / Clear
                                            </button>}
                                            {canManage && c.status !== 'Gated-Out' && (
                                                <button onClick={() => setReleaseContainer(c)} style={{ padding: '4px 8px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                                    Gate-Out
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Facility Statutory Licenses (NEMA, KEPHIS, KRA, County, KEBS) */}
            <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '18px', backgroundColor: '#f8fafc' }}>
                <h3 style={{ marginTop: 0 }}>Depot Facility Regulatory Licenses (NEMA • KEPHIS • KRA • County • KEBS)</h3>
                {canManageLicenses && <form onSubmit={handleAddLicense} style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1.2fr 1fr 1fr auto', gap: '8px', marginBottom: '16px', alignItems: 'end' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '12px' }}>Authority</label>
                        <select value={licenseForm.authority} onChange={(e) => setLicenseForm({ ...licenseForm, authority: e.target.value })} style={{ width: '100%', padding: '8px' }}>
                            <option value="NEMA">NEMA (EIA / Effluent / Waste)</option>
                            <option value="KEPHIS">KEPHIS Biosecurity</option>
                            <option value="KRA">KRA Customs / Bonded</option>
                            <option value="COUNTY">County Business Permit</option>
                            <option value="KEBS">KEBS Standards</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '12px' }}>Permit / Certificate Name</label>
                        <input type="text" required placeholder="e.g., Wash-Bay Effluent License" value={licenseForm.license_name} onChange={(e) => setLicenseForm({ ...licenseForm, license_name: e.target.value })} style={{ width: '100%', padding: '8px' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '12px' }}>License #</label>
                        <input type="text" required placeholder="NEMA/2026/..." value={licenseForm.license_number} onChange={(e) => setLicenseForm({ ...licenseForm, license_number: e.target.value })} style={{ width: '100%', padding: '8px' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '12px' }}>Expiry Date</label>
                        <input type="date" required value={licenseForm.expiry_date} onChange={(e) => setLicenseForm({ ...licenseForm, expiry_date: e.target.value })} style={{ width: '100%', padding: '8px' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '12px' }}>Scan (PDF/Img)</label>
                        <input type="file" onChange={(e) => setLicenseFile(e.target.files[0])} style={{ width: '100%', fontSize: '12px' }} />
                    </div>
                    <button type="submit" style={{ padding: '9px 14px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                        + Add Permit
                    </button>
                </form>}

                {licenses.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                        {licenses.map((lic) => (
                            <div key={lic.id} style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '12px', borderRadius: '6px', fontSize: '13px' }}>
                                <strong>{lic.authority}: {lic.license_name}</strong>
                                <div>Ref: {lic.license_number}</div>
                                <div>Expires: {new Date(lic.expiry_date).toLocaleDateString()}</div>
                                {lic.document_url && <a href={new URL(lic.document_url, new URL(api.defaults.baseURL, window.location.origin).origin).href} target="_blank" rel="noreferrer">Open attachment</a>}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Compliance & Hygiene Update Modal */}
            {activeContainer && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <form onSubmit={handleComplianceSave} style={{ background: '#fff', padding: '24px', borderRadius: '8px', width: '440px' }}>
                        <h3 style={{ marginTop: 0 }}>Cleaning & Clearance ({activeContainer.container_number})</h3>

                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>Cleaning / Decontamination Status</label>
                            <select value={complianceForm.cleaning_status} onChange={(e) => setComplianceForm({ ...complianceForm, cleaning_status: e.target.value })} style={{ width: '100%', padding: '8px' }}>
                                <option value="Pending">Pending</option>
                                <option value="Swept_Clean">Swept Clean (Dry)</option>
                                <option value="Washed_Sanitized">Washed & Sanitized (NEMA Wash-Bay)</option>
                                <option value="Fumigated">Fumigated (Phytosanitary)</option>
                            </select>
                        </div>

                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>Cleaning / Fumigation Certificate #</label>
                            <input type="text" value={complianceForm.cleaning_cert_ref} onChange={(e) => setComplianceForm({ ...complianceForm, cleaning_cert_ref: e.target.value })} placeholder="CERT-2026-..." style={{ width: '100%', padding: '8px' }} />
                        </div>

                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>Structural / IICL Status</label>
                            <select value={complianceForm.condition_status} onChange={(e) => setComplianceForm({ ...complianceForm, condition_status: e.target.value })} style={{ width: '100%', padding: '8px' }}>
                                <option value="Sound">Sound / Cargo-Worthy</option>
                                <option value="Damaged">Damaged / Hold</option>
                            </select>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px', marginBottom: '12px' }}>
                            <label><input type="checkbox" checked={complianceForm.kephis_cleared} onChange={(e) => setComplianceForm({ ...complianceForm, kephis_cleared: e.target.checked })} /> KEPHIS Cleared</label>
                            <label><input type="checkbox" checked={complianceForm.wash_bay_used} onChange={(e) => setComplianceForm({ ...complianceForm, wash_bay_used: e.target.checked })} /> NEMA Wash-Bay Logged</label>
                            <label><input type="checkbox" checked={complianceForm.customs_hold} onChange={(e) => setComplianceForm({ ...complianceForm, customs_hold: e.target.checked })} /> KRA Customs Hold</label>
                            <label><input type="checkbox" checked={complianceForm.kebs_hold} onChange={(e) => setComplianceForm({ ...complianceForm, kebs_hold: e.target.checked })} /> KEBS Hold</label>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button type="button" onClick={() => setActiveContainer(null)} style={{ padding: '8px 14px' }}>Cancel</button>
                            <button type="submit" style={{ padding: '8px 14px', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
                                Save Compliance Record
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {releaseContainer && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <form onSubmit={handleGateOut} style={{ background: '#fff', padding: '24px', borderRadius: '8px', width: '440px' }}>
                        <h3>Gate-Out ({releaseContainer.container_number})</h3>
                        <label>Truck plate <input name="truck_plate" /></label><br />
                        <label>Seal number <input name="seal_number" /></label><br />
                        <label>EIR reference <input name="eir_reference" /></label><br />
                        <label><input name="require_sanitized" type="checkbox" /> Require sanitization</label><br />
                        <label><input name="require_kephis" type="checkbox" /> Require KEPHIS clearance</label>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button type="button" onClick={() => setReleaseContainer(null)} style={{ padding: '8px 14px' }}>Cancel</button>
                            <button type="submit" style={{ padding: '8px 14px' }}>Record Gate-Out</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}