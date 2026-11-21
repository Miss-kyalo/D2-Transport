import { useState, useEffect } from 'react';
import api from '../api';

const LABELS = {
    en: {
        title: 'Shipping Principal Container Portal',
        subtitle: 'Live Yard Visibility • Dwell Days • Multi-Currency Storage • UN/EDIFACT CODECO',
        filterPlaceholder: 'Filter by Shipping Line / Principal (e.g., MSC, Grimaldi)...',
        refreshBtn: 'Refresh Stock',
        kpiTotal: 'Active Fleet in Yard',
        kpiReady: 'Clean & Cargo-Worthy',
        kpiHold: 'On Hold (M&R / Regulatory)',
        kpiStorage: 'Accrued Storage',
        colContainer: 'Container / ISO',
        colPrincipal: 'Principal',
        colHygiene: 'Hygiene & KEPHIS',
        colDwell: 'Dwell / Free Days',
        colStorage: 'Accrued Storage',
        colStatus: 'Status',
        colEdi: 'EDI Feed',
        downloadEdi: 'CODECO .edi',
        noData: 'No containers found for the selected principal filter.'
    },
    it: {
        title: 'Portale Armatori e Compagnie Marittime',
        subtitle: 'Giacenza Live • Giorni di Sosta • Sosta Multivaluta • UN/EDIFACT CODECO',
        filterPlaceholder: 'Filtra per Compagnia Marittima (es. MSC, Grimaldi)...',
        refreshBtn: 'Aggiorna Giacenze',
        kpiTotal: 'Unità Totali in Deposito',
        kpiReady: 'Puliti e Idonei al Carico',
        kpiHold: 'In Blocco (Riparazioni / Dogana)',
        kpiStorage: 'Sosta Maturata',
        colContainer: 'Container / ISO',
        colPrincipal: 'Armatore',
        colHygiene: 'Pulizia e KEPHIS',
        colDwell: 'Sosta / Franchigia',
        colStorage: 'Importo Sosta',
        colStatus: 'Stato',
        colEdi: 'Flusso EDI',
        downloadEdi: 'Scarica CODECO',
        noData: 'Nessun container trovato per il filtro selezionato.'
    }
};

export default function PrincipalPortal() {
    const [lang, setLang] = useState('en');
    const [principalQuery, setPrincipalQuery] = useState('');
    const [currencyFilter, setCurrencyFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [containers, setContainers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [ediPreview, setEdiPreview] = useState(null);

    const t = LABELS[lang];

    const fetchPortfolio = async () => {
        try {
            setLoading(true);
            setError('');
            const res = await api.get('/depot/principal/portfolio', {
                params: {
                    principal: principalQuery || undefined,
                    currency: currencyFilter !== 'ALL' ? currencyFilter : undefined,
                    status: statusFilter !== 'ALL' ? statusFilter : undefined,
                    date_from: dateFrom || undefined,
                    date_to: dateTo || undefined
                }
            });
            setContainers(res.data.containers || []);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load principal container portfolio.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let active = true;
        api.get('/depot/principal/portfolio')
            .then((res) => {
                if (active) setContainers(res.data.containers || []);
            })
            .catch((err) => {
                if (active) setError(err.response?.data?.error || 'Failed to load principal container portfolio.');
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, []);

    const handleDownloadCodeco = async (container) => {
        try {
            const movType = container.status === 'Gated-Out' ? 'GATE_OUT' : 'GATE_IN';
            const res = await api.get(`/depot/containers/${container.id}/edi/${movType}`);
            setEdiPreview({
                containerNumber: container.container_number,
                payload: res.data.edi_payload
            });
        } catch (err) {
            setError(err.response?.data?.error || 'Unable to retrieve UN/EDIFACT CODECO message.');
        }
    };

    const triggerFileDownload = (filename, content) => {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleExportCsv = () => {
        const headers = [
            'Container Number', 'Type', 'Principal', 'Yard Bay', 'Status', 'Condition',
            'Cleaning Status', 'KEPHIS Cleared', 'Gate-In Date', 'Gate-Out Date',
            'Dwell Days', 'Free Days', 'Billable Days', 'Currency', 'Daily Rate',
            'Accrued Storage'
        ];
        const csvValue = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
        const rows = containers.map((container) => [
            container.container_number,
            container.container_type,
            container.principal_name,
            container.yard_bay,
            container.status,
            container.condition_status,
            container.cleaning_status,
            container.kephis_cleared ? 'YES' : 'NO',
            container.gated_in_at ? new Date(container.gated_in_at).toISOString().slice(0, 10) : '',
            container.gated_out_at ? new Date(container.gated_out_at).toISOString().slice(0, 10) : '',
            container.dwell_days,
            container.free_days,
            container.billable_days,
            container.principal_currency || 'USD',
            Number(container.daily_storage_rate || 0).toFixed(2),
            Number(container.accrued_storage || 0).toFixed(2)
        ].map(csvValue).join(','));
        const csvContent = [headers.map(csvValue).join(','), ...rows].join('\n');
        const stamp = new Date().toISOString().slice(0, 10);
        triggerFileDownload(`D2_Principal_Stock_${stamp}.csv`, csvContent);
    };

    const handleBatchCodecoExport = async () => {
        try {
            const res = await api.get('/depot/principal/batch-codeco', {
                params: { principal: principalQuery || undefined }
            });
            const stamp = new Date().toISOString().slice(0, 10);
            triggerFileDownload(`D2_BATCH_CODECO_${stamp}.edi`, res.data.edi_payload);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to generate batch CODECO EDI file.');
        }
    };

    const inYard = containers.filter((c) => c.status !== 'Gated-Out');
    const readyCount = inYard.filter((c) => c.status === 'Available' && c.condition_status === 'Sound').length;
    const holdCount = inYard.filter((c) => c.status === 'Hold' || c.customs_hold || c.kebs_hold).length;

    const storageByCurrency = containers.reduce((acc, item) => {
        const curr = item.principal_currency || 'USD';
        acc[curr] = (acc[curr] || 0) + Number(item.accrued_storage || 0);
        return acc;
    }, {});

    return (
        <div style={{ padding: '24px', fontFamily: 'Inter, system-ui, sans-serif', maxWidth: '1280px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '2px solid #e2e8f0', paddingBottom: '16px', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ margin: 0, color: '#0f172a' }}>{t.title}</h1>
                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>{t.subtitle}</p>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        type="button"
                        onClick={() => setLang('en')}
                        style={{
                            padding: '8px 14px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: lang === 'en' ? '#0f172a' : '#fff',
                            color: lang === 'en' ? '#fff' : '#0f172a',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        English
                    </button>
                    <button
                        type="button"
                        onClick={() => setLang('it')}
                        style={{
                            padding: '8px 14px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: lang === 'it' ? '#0f172a' : '#fff',
                            color: lang === 'it' ? '#fff' : '#0f172a',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        Italiano
                    </button>
                </div>
            </div>

            {error && (
                <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '6px', marginBottom: '16px' }}>
                    {error}
                </div>
            )}

            {/* KPI Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>{t.kpiTotal}</div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{inYard.length}</div>
                </div>
                <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ fontSize: '12px', color: '#166534', fontWeight: 600 }}>{t.kpiReady}</div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: '#15803d', marginTop: '4px' }}>{readyCount}</div>
                </div>
                <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ fontSize: '12px', color: '#991b1b', fontWeight: 600 }}>{t.kpiHold}</div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: '#b91c1c', marginTop: '4px' }}>{holdCount}</div>
                </div>
                <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ fontSize: '12px', color: '#1e40af', fontWeight: 600 }}>{t.kpiStorage}</div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#1d4ed8', marginTop: '8px' }}>
                        {Object.keys(storageByCurrency).length === 0
                            ? 'USD 0.00'
                            : Object.entries(storageByCurrency)
                                  .map(([curr, amt]) => `${curr} ${amt.toFixed(2)}`)
                                  .join(' • ')}
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    fetchPortfolio();
                }}
                style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}
            >
                <input
                    type="text"
                    value={principalQuery}
                    onChange={(e) => setPrincipalQuery(e.target.value)}
                    placeholder={t.filterPlaceholder}
                    style={{ flex: '2 1 220px', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
                <select value={currencyFilter} onChange={(e) => setCurrencyFilter(e.target.value)} style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}>
                    <option value="ALL">{lang === 'it' ? 'Tutte le Valute' : 'All Currencies'}</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="KES">KES</option>
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}>
                    <option value="ALL">{lang === 'it' ? 'Tutti gli Stati' : 'All Statuses'}</option>
                    <option value="Available">Available</option>
                    <option value="Hold">Hold</option>
                    <option value="Gated-Out">Gated-Out</option>
                </select>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="Gate-In From" style={{ padding: '9px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="Gate-In To" style={{ padding: '9px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                <button
                    type="submit"
                    style={{ padding: '10px 18px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                >
                    {t.refreshBtn}
                </button>
                <button type="button" onClick={handleExportCsv} disabled={containers.length === 0} style={{ padding: '10px 14px', backgroundColor: '#0f766e', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                    {lang === 'it' ? 'Esporta CSV' : 'Export CSV'}
                </button>
                <button type="button" onClick={handleBatchCodecoExport} disabled={containers.length === 0} style={{ padding: '10px 14px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                    Batch CODECO .edi
                </button>
            </form>

            {/* Stock Table */}
            <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', backgroundColor: '#fff', overflowX: 'auto' }}>
                {loading ? (
                    <p style={{ padding: '20px', color: '#64748b' }}>Loading...</p>
                ) : containers.length === 0 ? (
                    <p style={{ padding: '20px', color: '#64748b' }}>{t.noData}</p>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                                <th style={{ padding: '10px' }}>{t.colContainer}</th>
                                <th style={{ padding: '10px' }}>{t.colPrincipal}</th>
                                <th style={{ padding: '10px' }}>{t.colHygiene}</th>
                                <th style={{ padding: '10px' }}>{t.colDwell}</th>
                                <th style={{ padding: '10px' }}>{t.colStorage}</th>
                                <th style={{ padding: '10px' }}>{t.colStatus}</th>
                                <th style={{ padding: '10px' }}>{t.colEdi}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {containers.map((c) => (
                                <tr key={c.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                    <td style={{ padding: '10px' }}>
                                        <strong>{c.container_number}</strong>
                                        <div style={{ color: '#64748b', fontSize: '12px' }}>
                                            {c.container_type} • Bay {c.yard_bay || '—'}
                                        </div>
                                    </td>
                                    <td style={{ padding: '10px' }}>{c.principal_name || '—'}</td>
                                    <td style={{ padding: '10px' }}>
                                        <div>{c.cleaning_status}</div>
                                        <div style={{ fontSize: '12px', color: c.kephis_cleared ? '#15803d' : '#b45309' }}>
                                            KEPHIS: {c.kephis_cleared ? 'OK' : 'Pending'}
                                        </div>
                                    </td>
                                    <td style={{ padding: '10px' }}>
                                        <strong>{c.dwell_days}d</strong>{' '}
                                        <span style={{ color: '#64748b' }}>/ {c.free_days}d free</span>
                                    </td>
                                    <td style={{ padding: '10px', fontWeight: 700, color: '#0f766e' }}>
                                        {c.principal_currency} {Number(c.accrued_storage).toFixed(2)}
                                    </td>
                                    <td style={{ padding: '10px', fontWeight: 700 }}>{c.status}</td>
                                    <td style={{ padding: '10px' }}>
                                        <button
                                            type="button"
                                            onClick={() => handleDownloadCodeco(c)}
                                            style={{ padding: '5px 10px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
                                        >
                                            {t.downloadEdi}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* EDI Modal */}
            {ediPreview && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px', zIndex: 50 }}>
                    <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '22px', width: '100%', maxWidth: '540px' }}>
                        <h3 style={{ marginTop: 0 }}>UN/EDIFACT CODECO — {ediPreview.containerNumber}</h3>
                        <pre style={{ backgroundColor: '#0f172a', color: '#e2e8f0', padding: '12px', borderRadius: '6px', fontSize: '12px', overflowX: 'auto' }}>
                            {ediPreview.payload}
                        </pre>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button
                                type="button"
                                onClick={() => triggerFileDownload(`${ediPreview.containerNumber}_CODECO.edi`, ediPreview.payload)}
                                style={{ padding: '8px 14px', backgroundColor: '#10b981', color: '#052e16', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
                            >
                                Download .edi File
                            </button>
                            <button
                                type="button"
                                onClick={() => setEdiPreview(null)}
                                style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
