import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/AdminDashboard';
import DriverDashboard from './pages/DriverDashboard';
import ManufacturerDashboard from './pages/ManufacturerDashboard';
import ClientDashboard from './portals/ClientDashboard';
import PublicTracking from './pages/PublicTracking';

export default function App() {
    return (
        <Router>
            <Routes>
                {/* Public & Authentication Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                
                {/* Public QR Tracking (No login required for buyers/consignees) */}
                <Route path="/track/:trackingCode" element={<PublicTracking />} />
                <Route path="/track" element={<PublicTracking />} />
                
                {/* Protected Driver Portal */}
                <Route path="/driver/*" element={
                    <ProtectedRoute allowedRole="Driver">
                        <DriverDashboard />
                    </ProtectedRoute>
                } />

                {/* Protected Admin Dispatch Hub */}
                <Route path="/admin/*" element={
                    <ProtectedRoute allowedRole="Admin">
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
                    <ProtectedRoute allowedRole="Client">
                        <ClientDashboard />
                    </ProtectedRoute>
                } />

                {/* Fallback Catch-All */}
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        </Router>
    );
}