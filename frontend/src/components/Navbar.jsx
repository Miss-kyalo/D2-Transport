import { NavLink, useNavigate } from 'react-router-dom';
import { getRoleHome } from '../auth';

export default function Navbar() {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    let user = null;

    try {
        user = JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
        localStorage.clear();
    }

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    const dashboardPath = getRoleHome(role);
    const isLoggedIn = Boolean(token && user);

    return (
        <nav style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 20px',
            background: '#004225',
            borderBottom: '1px solid #B89B6A',
            color: '#F8F6F0',
            position: 'sticky',
            top: 0,
            zIndex: 1000,
            flexWrap: 'wrap'
        }}>
            <NavLink to={isLoggedIn ? dashboardPath : '/login'} style={{
                color: '#F8F6F0',
                fontWeight: 700,
                textDecoration: 'none',
                marginRight: 'auto'
            }}>
                D2-Transport
            </NavLink>

            {isLoggedIn && dashboardPath !== '/login' && (
                <NavLink to={dashboardPath} style={({ isActive }) => ({
                    color: '#F8F6F0',
                    textDecoration: 'none',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    background: isActive ? '#B89B6A' : 'transparent'
                })}>
                    Dashboard
                </NavLink>
            )}

            <NavLink to="/track" style={({ isActive }) => ({
                color: '#F8F6F0',
                textDecoration: 'none',
                padding: '6px 10px',
                borderRadius: '4px',
                background: isActive ? '#B89B6A' : 'transparent'
            })}>
                Track Shipment
            </NavLink>

            {isLoggedIn ? (
                <>
                    <span style={{ fontSize: '0.8em', color: '#E6D9BE' }}>
                        {user.username} · {role}
                    </span>
                    <button
                        type="button"
                        onClick={handleLogout}
                        style={{
                            border: '1px solid #F8F6F0',
                            borderRadius: '4px',
                            background: 'transparent',
                            color: '#F8F6F0',
                            padding: '6px 10px',
                            cursor: 'pointer'
                        }}
                    >
                        Logout
                    </button>
                </>
            ) : (
                <NavLink to="/login" style={{
                    color: '#F8F6F0',
                    textDecoration: 'none',
                    padding: '6px 10px'
                }}>
                    Login
                </NavLink>
            )}
        </nav>
    );
}
