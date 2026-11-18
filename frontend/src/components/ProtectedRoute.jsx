import { Navigate } from 'react-router-dom';
import { getRoleHome } from '../auth';

export default function ProtectedRoute({ allowedRole, children }) {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('role');
    let user;

    try {
        user = JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
        user = null;
    }

    if (!token || !user || typeof user !== 'object' || Array.isArray(user)) {
        return <Navigate to="/login" replace />;
    }

    const allowedRoles = Array.isArray(allowedRole) ? allowedRole : [allowedRole];
    if (allowedRole && !allowedRoles.includes(userRole)) {
        return <Navigate to={getRoleHome(userRole)} replace />;
    }

    return children;
}