import { Navigate } from 'react-router-dom';

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

    if (allowedRole && userRole !== allowedRole) {
        return <Navigate to={`/${userRole ? userRole.toLowerCase() : 'login'}`} replace />;
    }

    return children;
}