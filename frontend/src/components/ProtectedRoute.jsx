import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ allowedRole, children }) {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('role');

    if (!token || !localStorage.getItem('user')) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRole && userRole !== allowedRole) {
        return <Navigate to={`/${userRole ? userRole.toLowerCase() : 'login'}`} replace />;
    }

    return children;
}