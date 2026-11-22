import { useState } from 'react';
import api from '../api';

const initialForm = { username: '', email: '', password: '', phone_number: '', role: 'Driver' };
const roles = [
    ['Driver', 'Driver'], ['Mechanic', 'Mechanic'], ['Storekeeper', 'Storekeeper'],
    ['Dispatcher', 'Dispatcher'], ['FleetManager', 'Fleet Manager'], ['HR', 'HR'],
    ['Accounts_Payable', 'Accounts Payable'], ['Accounts_Receivable', 'Accounts Receivable'],
    ['PayrollAccountant', 'Payroll Accountant'], ['Boss', 'Boss']
];

export default function StaffOnboarding() {
    const [form, setForm] = useState(initialForm);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        setError('');
        setMessage('');
        setBusy(true);
        try {
            const response = await api.post('/hr/onboard-user', form);
            setMessage(`${response.data.message} ${response.data.user.username} is ${response.data.user.onboarding_status}.`);
            setForm(initialForm);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to onboard staff.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <section style={{ background: '#fff', border: '1px solid #d6d3c9', borderRadius: 10, padding: 20, marginBottom: 20 }}>
            <h2>Staff onboarding</h2>
            <p>New staff remain pending until HR verifies the required KRA PIN, NSSF and SHA documents.</p>
            {error && <p role="alert" style={{ color: '#991b1b' }}>{error}</p>}
            {message && <p role="status" style={{ color: '#166534' }}>{message}</p>}
            <form onSubmit={submit} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'end' }}>
                <label>Username <input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
                <label>Email <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
                <label>Phone <input required value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} /></label>
                <label>Initial password <input type="password" autoComplete="new-password" minLength="12" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
                <label>Role <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    {roles.map(([value, name]) => <option value={value} key={value}>{name}</option>)}
                </select></label>
                <button type="submit" disabled={busy}>Create staff account</button>
            </form>
        </section>
    );
}
