import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import DriverDashboard from './pages/DriverDashboard';
import ManufacturerDashboard from './pages/ManufacturerDashboard';
import ClientDashboard from './portals/ClientDashboard';
import PublicTracking from './pages/PublicTracking';
import PrintableWaybill from './pages/PrintableWaybill';
import { ADMIN_ROLES, CLIENT_ROLES } from './auth';
import Navbar from './components/Navbar';

export default function App() {
    return (
        <Router>
            <Navbar />
            <Routes>
                <Route path="/login" element={<Login />} />
                
                {/* Public QR Tracking & Printable Waybill */}
                <Route path="/track/:trackingCode" element={<PublicTracking />} />
                <Route path="/track" element={<PublicTracking />} />
                <Route path="/waybill/:trackingCode" element={<PrintableWaybill />} />
                
                {/* Protected Driver Portal */}
                <Route path="/driver/*" element={
                    <ProtectedRoute allowedRole="Driver">
                        <DriverDashboard />
                    </ProtectedRoute>
                } />

                {/* Protected Admin Dispatch Hub */}
                <Route path="/admin/*" element={
                    <ProtectedRoute allowedRole={ADMIN_ROLES}>
                        <AdminDashboard />
                    </ProtectedRoute>
                } />

                {/* Protected Manufacturer Portal (e.g. KEDA Ceramics) */}
                <Route path="/manufacturer/*" element={
                    <ProtectedRoute allowedRole="Manufacturer">
                        <ManufacturerDashboard />
                    </ProtectedRoute>
                } />

                <Route path="/client/*" element={
                    <ProtectedRoute allowedRole={CLIENT_ROLES}>
                        <ClientDashboard />
                    </ProtectedRoute>
                } />

                {/* Fallback Catch-All */}
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        </Router>
    );
}