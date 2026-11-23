import { useEffect, useState } from 'react';
import api from '../api';
import EmployeePayslipModal from '../components/EmployeePayslipModal';

export default function MyPayslips() {
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [open, setOpen] = useState(false);
    const [legacyPayslips, setLegacyPayslips] = useState([]);
    const [legacyError, setLegacyError] = useState('');
    const isDriver = localStorage.getItem('role') === 'Driver';

    useEffect(() => {
        if (!isDriver) return undefined;
        let active = true;
        api.get('/payroll/my-payslips')
            .then((response) => {
                if (active) setLegacyPayslips(Array.isArray(response.data) ? response.data : []);
            })
            .catch((error) => {
                if (active) setLegacyError(error.response?.data?.error || 'Could not load legacy payslip history.');
            });
        return () => { active = false; };
    }, [isDriver]);

    return (
        <main style={{ maxWidth: '800px', margin: '2rem auto', padding: '0 1rem' }}>
            <h1>My statutory payslips</h1>
            <p>View your recorded monthly payslip or annual payroll summary.</p>
            <label htmlFor="payslip-month">Payroll month </label>
            <input id="payslip-month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
            <button type="button" disabled={!month} onClick={() => setOpen(true)} style={{ marginLeft: '1rem' }}>
                View payslip
            </button>
            {open && <EmployeePayslipModal self selectedMonth={month} onClose={() => setOpen(false)} />}
            {isDriver && (
                <section style={{ marginTop: '2rem' }}>
                    <h2>Legacy driver payslips (read-only)</h2>
                    <p>Historical legacy records are preserved; they cannot be edited or released in this system.</p>
                    {legacyError && <p role="alert">{legacyError}</p>}
                    {!legacyError && legacyPayslips.length === 0 && <p>No legacy payslip history is available.</p>}
                    {legacyPayslips.length > 0 && (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr>
                                        <th>Period</th>
                                        <th>Gross pay</th>
                                        <th>Deductions</th>
                                        <th>Net pay (KES)</th>
                                        <th>Historical status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {legacyPayslips.map((slip) => (
                                        <tr key={slip.id}>
                                            <td>{slip.month_year}</td>
                                            <td>{(Number(slip.basic_pay) + Number(slip.housing_allowance) + Number(slip.off_pay)).toLocaleString()}</td>
                                            <td>{Number(slip.deductions_total).toLocaleString()}</td>
                                            <td>{Number(slip.net_pay).toLocaleString()}</td>
                                            <td>{slip.status}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            )}
        </main>
    );
}
