import { useEffect, useState } from 'react';
import api from '../api';

const initialForm = () => ({
    entry_date: new Date().toISOString().slice(0, 10), account_name: '', bank_reference: '',
    entry_type: 'DEBIT', department_source: 'GENERAL', description: '', amount: '', currency: 'KES', etims_ref: ''
});

export default function ControlFinancePanel({ canWrite }) {
    const [data, setData] = useState(null);
    const [form, setForm] = useState(initialForm);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let active = true;
        api.get('/control/finance/overview')
            .then((response) => { if (active) setData(response.data); })
            .catch((err) => { if (active) setError(err.response?.data?.error || 'Failed to load finance.'); });
        return () => { active = false; };
    }, []);

    const submit = async (event) => {
        event.preventDefault();
        setBusy(true); setError(''); setMessage('');
        try {
            const response = await api.post('/control/finance/bank-ledger', form);
            setMessage(response.data.message);
            setForm(initialForm());
            const refreshed = await api.get('/control/finance/overview');
            setData(refreshed.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to record bank entry.');
        } finally { setBusy(false); }
    };

    return (
        <section style={{ background: '#fff', border: '1px solid #d6d3c9', borderRadius: 10, padding: 18, marginTop: 16, overflowX: 'auto' }}>
            <h2>Finance control</h2>
            {error && <p role="alert" style={{ color: '#991b1b' }}>{error}</p>}
            {message && <p role="status" style={{ color: '#166534' }}>{message}</p>}
            {canWrite && <form onSubmit={submit} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <input aria-label="Entry date" required type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} />
                <input aria-label="Bank account" required placeholder="Account name" maxLength="80" value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} />
                <input aria-label="Bank reference" required placeholder="Bank reference" maxLength="80" value={form.bank_reference} onChange={(e) => setForm({ ...form, bank_reference: e.target.value })} />
                <select aria-label="Entry type" value={form.entry_type} onChange={(e) => setForm({ ...form, entry_type: e.target.value })}><option value="DEBIT">Money out</option><option value="CREDIT">Money in</option></select>
                <select aria-label="Cost center" value={form.department_source} onChange={(e) => setForm({ ...form, department_source: e.target.value })}><option value="GENERAL">General</option><option value="GARAGE">Garage</option><option value="FLEET_TRANSPORT">Fleet</option><option value="CONTAINER_DEPOT">Depot</option></select>
                <input aria-label="Description" required placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                <input aria-label="Amount" required type="number" min="0.01" step="0.01" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                <input aria-label="Currency" required maxLength="3" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
                <input aria-label="eTIMS reference" placeholder="eTIMS reference (optional)" maxLength="60" value={form.etims_ref} onChange={(e) => setForm({ ...form, etims_ref: e.target.value })} />
                <button type="submit" disabled={busy}>Record bank entry</button>
            </form>}
            <h3>Bank ledger</h3>
            <p>Entries are recorded as unreconciled; they are not checked against bank statements automatically.</p>
            {data === null ? <p>Finance unavailable or loading.</p> : <>
                <table style={{ width: '100%', textAlign: 'left' }}>
                    <thead><tr><th>Date</th><th>Account</th><th>Reference</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead>
                    <tbody>{data.bank_entries.map((entry) => <tr key={entry.id}>
                        <td>{entry.entry_date.slice(0, 10)}</td><td>{entry.account_name}</td><td>{entry.bank_reference}</td><td>{entry.description}</td>
                        <td>{entry.entry_type === 'DEBIT' ? '−' : '+'}{entry.currency} {Number(entry.amount).toLocaleString()}</td>
                        <td>{entry.reconciled ? 'Reconciled' : 'Unreconciled'}</td>
                    </tr>)}</tbody>
                </table>
                <h3>Receivable invoices</h3>
                <table style={{ width: '100%', textAlign: 'left' }}>
                    <thead><tr><th>Invoice</th><th>Trip</th><th>Client</th><th>Due</th><th>Amount (KES)</th><th>Status</th></tr></thead>
                    <tbody>{data.invoices.map((invoice) => <tr key={invoice.id}>
                        <td>{invoice.id}</td><td>{invoice.tracking_code || '—'}</td><td>{invoice.client_name || '—'}</td>
                        <td>{invoice.due_date?.slice(0, 10) || '—'}</td><td>{Number(invoice.amount_kes).toLocaleString()}</td><td>{invoice.status}</td>
                    </tr>)}</tbody>
                </table>
            </>}
        </section>
    );
}
