import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ADMIN_ROLES, CLIENT_ROLES } from './auth';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import AdminDashboard from './pages/AdminDashboard';
import DriverDashboard from './pages/DriverDashboard';
import FleetCompliance from './pages/FleetCompliance';
import GarageDepartment from './pages/GarageDepartment';
import HrPayrollAuditSuite from './pages/HrPayrollAuditSuite';
import Login from './pages/Login';
import ManufacturerDashboard from './pages/ManufacturerDashboard';
import PrintableWaybill from './pages/PrintableWaybill';
import PublicQrTracker from './pages/PublicQrTracker';
import ClientDashboard from './portals/ClientDashboard';
import DepotDashboard from './pages/DepotDashboard';
import HomePage from './pages/HomePage';
import ContainerHomePage from './pages/ContainerHomePage';
import GarageWorkbenchPage from './pages/GarageWorkbenchPage';
import PrincipalPortal from './pages/PrincipalPortal';

export default function App() {
    return (
        <BrowserRouter>
            <Navbar />
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/container-depot" element={<ContainerHomePage />} />
                <Route path="/garage" element={<ProtectedRoute><GarageDepartment /></ProtectedRoute>} />
                <Route
                    path="/garage/workbench"
                    element={
                        <ProtectedRoute allowedRole={['Admin', 'Mechanic']}>
                            <GarageWorkbenchPage />
                        </ProtectedRoute>
                    }
                />
                <Route path="/login" element={<Login />} />
                <Route path="/track" element={<PublicQrTracker />} />
                <Route path="/track/:code" element={<PublicQrTracker />} />
                <Route path="/waybill/:trackingCode" element={<PrintableWaybill />} />
                <Route path="/principal" element={<ProtectedRoute><PrincipalPortal /></ProtectedRoute>} />
                <Route path="/payroll" element={<ProtectedRoute allowedRole="Admin"><HrPayrollAuditSuite /></ProtectedRoute>} />

                <Route
                    path="/admin/*"
                    element={
                        <ProtectedRoute allowedRole={ADMIN_ROLES}>
                            <AdminDashboard />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/depot"
                    element={
                        <ProtectedRoute allowedRole={['Admin', 'Dispatcher', 'FleetManager', 'Accounts_Receivable']}>
                            <DepotDashboard />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/fleet"
                    element={
                        <ProtectedRoute allowedRole={ADMIN_ROLES}>
                            <FleetCompliance />
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

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}
