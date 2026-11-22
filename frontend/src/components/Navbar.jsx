import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../api';
import { STAFF_ROLES } from '../auth';

export default function Navbar() {
    const location = useLocation();
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const [logoutError, setLogoutError] = useState('');
    const [loggingOut, setLoggingOut] = useState(false);

    if (['/', '/container-depot', '/garage'].includes(location.pathname) || !token) return null;

    const role = localStorage.getItem('role');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    const handleLogout = async () => {
        setLogoutError('');
        setLoggingOut(true);
        try {
            await api.post('/auth/logout');
            localStorage.clear();
            navigate('/');
        } catch (error) {
            setLogoutError(error.response?.data?.error || 'Could not revoke session. Please try again.');
        } finally {
            setLoggingOut(false);
        }
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
                <strong style={{ fontSize: '16px', letterSpacing: '0.5px' }}>Difan Logistics</strong>

                {['Admin', 'FleetManager', 'Dispatcher', 'Storekeeper', 'Accounts_Payable', 'Accounts_Receivable', 'PayrollAccountant', 'Boss'].includes(role) && (
                    <Link to="/control" style={{ color: '#e2e8f0', textDecoration: 'none', fontSize: '14px' }}>Control</Link>
                )}

                {['PayrollAccountant', 'Boss'].includes(role) && (
                    <Link to="/payroll" style={{ color: '#e2e8f0', textDecoration: 'none', fontSize: '14px' }}>2026 Payroll</Link>
                )}

                {STAFF_ROLES.includes(role) && (
                    <Link to="/my-payslips" style={{ color: '#e2e8f0', textDecoration: 'none', fontSize: '14px' }}>My Payslips</Link>
                )}

                {role === 'HR' && (
                    <Link to="/hr/leave" style={{ color: '#e2e8f0', textDecoration: 'none', fontSize: '14px' }}>Leave &amp; Off-Days</Link>
                )}

                {role === 'Admin' && (
                    <>
                        <Link to="/admin" style={{ color: '#e2e8f0', textDecoration: 'none', fontSize: '14px' }}>Dispatch</Link>
                        <Link to="/fleet" style={{ color: '#e2e8f0', textDecoration: 'none', fontSize: '14px' }}>Fleet & Compliance</Link>
                    </>
                )}

                {['Admin', 'Mechanic', 'FleetManager', 'Storekeeper'].includes(role) && (
                    <Link to="/garage/workbench" style={{ color: '#e2e8f0', textDecoration: 'none', fontSize: '14px' }}>
                        Garage Workbench
                    </Link>
                )}

                {['Admin', 'Dispatcher', 'FleetManager', 'Accounts_Receivable'].includes(role) && (
                    <Link to="/depot" style={{ color: '#e2e8f0', textDecoration: 'none', fontSize: '14px' }}>Depot &amp; Compliance</Link>
                )}

                {role === 'Driver' && (
                    <Link to="/driver" style={{ color: '#e2e8f0', textDecoration: 'none', fontSize: '14px' }}>My Trips</Link>
                )}

                {role === 'Manufacturer' && (
                    <Link to="/manufacturer" style={{ color: '#e2e8f0', textDecoration: 'none', fontSize: '14px' }}>Shipments</Link>
                )}

                <Link to="/track/TEST-001" style={{ color: '#93c5fd', textDecoration: 'none', fontSize: '14px' }}>QR Tracker</Link>
                <Link to="/principal" style={{ color: '#e2e8f0', textDecoration: 'none', fontSize: '14px' }}>Principal Portal (EN/IT)</Link>
            </div>

            <div style={{ display: 'flex', gap: '14px', alignItems: 'center', fontSize: '13px' }}>
                <span>{user.username} ({role})</span>
                {logoutError && <span role="alert">{logoutError}</span>}
                <button
                    onClick={handleLogout}
                    disabled={loggingOut}
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