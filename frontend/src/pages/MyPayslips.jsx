import { useState } from 'react';
import EmployeePayslipModal from '../components/EmployeePayslipModal';

export default function MyPayslips() {
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [open, setOpen] = useState(false);

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
        </main>
    );
}
