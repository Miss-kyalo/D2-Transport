import { Link, useNavigate } from 'react-router-dom';

export default function Navbar() {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (!token) return null;

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    return (
        <nav style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 24px',
            backgroundColor: '#0f172a',
            color: '#fff',
            fontFamily: 'sans-serif'
        }}>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <strong style={{ fontSize: '16px', letterSpacing: '0.5px' }}>D2-Transport</strong>

                {role === 'Admin' && (
                    <>
                        <Link to="/admin" style={{ color: '#e2e8f0', textDecoration: 'none', fontSize: '14px' }}>Dispatch</Link>
                        <Link to="/fleet" style={{ color: '#e2e8f0', textDecoration: 'none', fontSize: '14px' }}>Fleet & Compliance</Link>
                        <Link to="/payroll" style={{ color: '#e2e8f0', textDecoration: 'none', fontSize: '14px' }}>2026 Payroll</Link>
                    </>
                )}

                {['Admin', 'Dispatcher', 'FleetManager', 'Accounts_Receivable'].includes(role) && (
                    <Link to="/depot" style={{ color: '#e2e8f0', textDecoration: 'none', fontSize: '14px' }}>Depot &amp; Compliance</Link>
                )}

                {role === 'Driver' && (
                    <Link to="/driver" style={{ color: '#e2e8f0', textDecoration: 'none', fontSize: '14px' }}>My Trips & Payslips</Link>
                )}

                {role === 'Manufacturer' && (
                    <Link to="/manufacturer" style={{ color: '#e2e8f0', textDecoration: 'none', fontSize: '14px' }}>Shipments</Link>
                )}

                <Link to="/track/TEST-001" style={{ color: '#93c5fd', textDecoration: 'none', fontSize: '14px' }}>QR Tracker</Link>
            </div>

            <div style={{ display: 'flex', gap: '14px', alignItems: 'center', fontSize: '13px' }}>
                <span>{user.username} ({role})</span>
                <button
                    onClick={handleLogout}
                    style={{
                        padding: '6px 12px',
                        backgroundColor: '#ef4444',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                    }}
                >
                    Logout
                </button>
            </div>
        </nav>
    );
}