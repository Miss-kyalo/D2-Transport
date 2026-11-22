import { useEffect, useState } from 'react';
import api from '../api';
import StaffOnboarding from '../components/StaffOnboarding';

const cardStyle = {
    backgroundColor: '#fff',
    border: '1px solid #d6d3c9',
    borderRadius: '10px',
    padding: '20px',
    marginBottom: '20px',
    overflowX: 'auto'
};

export default function HrLeaveManagement() {
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [records, setRecords] = useState([]);
    const [requests, setRequests] = useState([]);
    const [editingBalance, setEditingBalance] = useState(null);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const loadData = async (targetMonth = month) => {
        try {
            const [summaryRes, requestRes] = await Promise.all([
                api.get('/hr/off-days/summary', { params: { month: targetMonth } }),
                api.get('/hr/leave-requests')
            ]);
            setRecords(summaryRes.data.records || []);
            setRequests(requestRes.data.requests || []);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load HR leave records.');
        }
    };

    useEffect(() => {
        let active = true;
        Promise.all([
            api.get('/hr/off-days/summary', { params: { month } }),
            api.get('/hr/leave-requests')
        ])
            .then(([summaryRes, requestRes]) => {
                if (!active) return;
                setRecords(summaryRes.data.records || []);
                setRequests(requestRes.data.requests || []);
            })
            .catch((err) => {
                if (active) setError(err.response?.data?.error || 'Failed to load HR leave records.');
            });

        return () => {
            active = false;
        };
    }, [month]);

    const handleReview = async (id, status) => {
        setError('');
        setMessage('');
        try {
            const res = await api.patch(`/hr/leave-requests/${id}/review`, { status });
            setMessage(res.data.message);
            await loadData(month);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to review leave request.');
        }
    };

    const handleSaveBalance = async (event) => {
        event.preventDefault();
        setError('');
        setMessage('');
        try {
            const res = await api.put(`/hr/leave-balances/${editingBalance.id}`, {
                annual_leave_balance: editingBalance.annual_leave_balance,
                accrued_off_days: editingBalance.accrued_off_days
            });
            setMessage(res.data.message);
            setEditingBalance(null);
            await loadData(month);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update leave balances.');
        }
    };

    return (
        <main style={{ backgroundColor: '#faf9f5', minHeight: '100vh', padding: '24px', fontFamily: 'Inter, system-ui, sans-serif', color: '#14281d' }}>
            <div style={{ maxWidth: '1320px', margin: '0 auto' }}>
                <header style={{ backgroundColor: '#143628', color: '#f4f1ea', padding: '22px 26px', borderRadius: '12px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                    <div>
                        <div style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#a3b899', fontWeight: 700 }}>
                            Human Resources • Leave Administration
                        </div>
                        <h1 style={{ margin: '4px 0 0', fontSize: '24px' }}>Leave &amp; Monthly Off-Day Tracker</h1>
                    </div>
                    <label style={{ display: 'grid', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                        Tracking Month
                        <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    </label>
                </header>

                {error && <div role="alert" style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px' }}>{error}</div>}
                {message && <div role="status" style={{ padding: '12px', backgroundColor: '#dcfce7', color: '#14532d', borderRadius: '8px', marginBottom: '16px' }}>{message}</div>}

                <StaffOnboarding />

                <section style={cardStyle}>
                    <h2 style={{ marginTop: 0 }}>Monthly Off-Day Compliance — {month}</h2>
                    <p style={{ marginTop: '-8px', color: '#52665a', fontSize: '13px' }}>
                        Each staff member has four monthly off-days: two paid through payroll and two that must be taken.
                    </p>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left', minWidth: '920px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#eef2ee', borderBottom: '2px solid #143628' }}>
                                <th style={{ padding: '8px' }}>Employee</th>
                                <th style={{ padding: '8px' }}>Total</th>
                                <th style={{ padding: '8px' }}>Paid / 2</th>
                                <th style={{ padding: '8px' }}>Taken / 2</th>
                                <th style={{ padding: '8px' }}>Still to Take</th>
                                <th style={{ padding: '8px' }}>Status</th>
                                <th style={{ padding: '8px' }}>Leave Balances</th>
                                <th style={{ padding: '8px' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {records.map((record) => (
                                <tr key={record.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                    <td style={{ padding: '8px' }}>
                                        <strong>{record.employee_name}</strong>
                                        <div style={{ color: '#52665a', fontSize: '12px' }}>{record.role}</div>
                                    </td>
                                    <td style={{ padding: '8px' }}>{record.total_days}</td>
                                    <td style={{ padding: '8px' }}>{Number(record.paid_days).toLocaleString()} / {record.paid_days_target}</td>
                                    <td style={{ padding: '8px' }}>{Number(record.taken_days).toLocaleString()} / {record.taken_days_target}</td>
                                    <td style={{ padding: '8px' }}>{Number(record.remaining_taken_days).toLocaleString()}</td>
                                    <td style={{ padding: '8px', fontWeight: 700, color: record.status === 'Shortfall' ? '#b91c1c' : '#14281d' }}>{record.status}</td>
                                    <td style={{ padding: '8px' }}>
                                        Annual: {record.annual_leave_balance}d
                                        <div>Accrued off: {record.accrued_off_days}d</div>
                                    </td>
                                    <td style={{ padding: '8px' }}>
                                        <button
                                            type="button"
                                            onClick={() => setEditingBalance({
                                                ...record,
                                                annual_leave_balance: record.annual_leave_balance ?? 0,
                                                accrued_off_days: record.accrued_off_days ?? 0
                                            })}
                                            style={{ padding: '6px 10px', backgroundColor: '#143628', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                                        >
                                            Adjust Balances
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>

                <section style={cardStyle}>
                    <h2 style={{ marginTop: 0 }}>Leave &amp; Off-Day Requests</h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left', minWidth: '800px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#eef2ee', borderBottom: '2px solid #143628' }}>
                                <th style={{ padding: '8px' }}>Employee</th>
                                <th style={{ padding: '8px' }}>Type</th>
                                <th style={{ padding: '8px' }}>Dates &amp; Days</th>
                                <th style={{ padding: '8px' }}>Status</th>
                                <th style={{ padding: '8px' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {requests.map((request) => (
                                <tr key={request.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                    <td style={{ padding: '8px' }}>{request.employee_name}</td>
                                    <td style={{ padding: '8px' }}>{request.request_type}</td>
                                    <td style={{ padding: '8px' }}>
                                        {new Date(request.start_date).toLocaleDateString()} – {new Date(request.end_date).toLocaleDateString()} ({request.days_count}d)
                                    </td>
                                    <td style={{ padding: '8px', fontWeight: 700 }}>{request.status}</td>
                                    <td style={{ padding: '8px', display: 'flex', gap: '6px' }}>
                                        {request.status === 'Pending' && (
                                            <>
                                                <button type="button" onClick={() => handleReview(request.id, 'Approved')} style={{ padding: '4px 8px', backgroundColor: '#15803d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Approve</button>
                                                <button type="button" onClick={() => handleReview(request.id, 'Rejected')} style={{ padding: '4px 8px', backgroundColor: '#b91c1c', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Reject</button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>

                {editingBalance && (
                    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px', zIndex: 50 }}>
                        <form onSubmit={handleSaveBalance} style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '10px', width: '100%', maxWidth: '460px' }}>
                            <h2 style={{ marginTop: 0 }}>Adjust Leave Balances — {editingBalance.employee_name}</h2>
                            <label style={{ display: 'block', marginBottom: '12px' }}>
                                Annual Leave Balance (days)
                                <input type="number" min="0" step="0.5" required value={editingBalance.annual_leave_balance} onChange={(event) => setEditingBalance({ ...editingBalance, annual_leave_balance: event.target.value })} style={{ display: 'block', width: '100%', padding: '8px', marginTop: '4px' }} />
                            </label>
                            <label style={{ display: 'block', marginBottom: '16px' }}>
                                Accrued Off-Day Balance (days)
                                <input type="number" min="0" step="0.5" required value={editingBalance.accrued_off_days} onChange={(event) => setEditingBalance({ ...editingBalance, accrued_off_days: event.target.value })} style={{ display: 'block', width: '100%', padding: '8px', marginTop: '4px' }} />
                            </label>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                <button type="button" onClick={() => setEditingBalance(null)} style={{ padding: '8px 12px' }}>Cancel</button>
                                <button type="submit" style={{ padding: '8px 12px', backgroundColor: '#143628', color: '#fff', border: 'none', borderRadius: '5px', fontWeight: 700 }}>Save Balances</button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </main>
    );
}
