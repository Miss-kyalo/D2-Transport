import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ADMIN_ROLES, CLIENT_ROLES } from './auth';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import AdminDashboard from './pages/AdminDashboard';
import DriverDashboard from './pages/DriverDashboard';
import Login from './pages/Login';
import ManufacturerDashboard from './pages/ManufacturerDashboard';
import PrintableWaybill from './pages/PrintableWaybill';
import PublicTracking from './pages/PublicTracking';
import ClientDashboard from './portals/ClientDashboard';

export default function App() {
    return (
        <BrowserRouter>
            <Navbar />
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/track" element={<PublicTracking />} />
                <Route path="/track/:trackingCode" element={<PublicTracking />} />
                <Route path="/waybill/:trackingCode" element={<PrintableWaybill />} />

                <Route
                    path="/admin/*"
                    element={
                        <ProtectedRoute allowedRole={ADMIN_ROLES}>
                            <AdminDashboard />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/driver/*"
                    element={
                        <ProtectedRoute allowedRole="Driver">
                            <DriverDashboard />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/manufacturer/*"
                    element={
                        <ProtectedRoute allowedRole="Manufacturer">
                            <ManufacturerDashboard />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/client/*"
                    element={
                        <ProtectedRoute allowedRole={CLIENT_ROLES}>
                            <ClientDashboard />
                        </ProtectedRoute>
                    }
                />

                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        </BrowserRouter>
    );
}
