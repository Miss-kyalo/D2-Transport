import { Component, lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ADMIN_ROLES, CLIENT_ROLES, STAFF_ROLES } from './auth';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/HomePage';

const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const DriverDashboard = lazy(() => import('./pages/DriverDashboard'));
const FleetCompliance = lazy(() => import('./pages/FleetCompliance'));
const GarageDepartment = lazy(() => import('./pages/GarageDepartment'));
const HrPayrollAuditSuite = lazy(() => import('./pages/HrPayrollAuditSuite'));
const HrLeaveManagement = lazy(() => import('./pages/HrLeaveManagement'));
const Login = lazy(() => import('./pages/Login'));
const ManufacturerDashboard = lazy(() => import('./pages/ManufacturerDashboard'));
const PrintableWaybill = lazy(() => import('./pages/PrintableWaybill'));
const PublicQrTracker = lazy(() => import('./pages/PublicQrTracker'));
const ClientDashboard = lazy(() => import('./portals/ClientDashboard'));
const DepotDashboard = lazy(() => import('./pages/DepotDashboard'));
const ContainerHomePage = lazy(() => import('./pages/ContainerHomePage'));
const GarageHomePage = lazy(() => import('./pages/GarageHomePage'));
const GarageWorkbenchPage = lazy(() => import('./pages/GarageWorkbenchPage'));
const PrincipalPortal = lazy(() => import('./pages/PrincipalPortal'));
const ControlHub = lazy(() => import('./pages/ControlHub'));
const MyPayslips = lazy(() => import('./pages/MyPayslips'));

class PageErrorBoundary extends Component {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(error) {
        console.error('Page failed to load or render:', error);
    }

    render() {
        if (this.state.failed) {
            return (
                <main role="alert" style={{ padding: '2rem' }}>
                    <p>This page could not be loaded. Check your connection and try again.</p>
                    <button type="button" onClick={() => window.location.reload()}>Reload page</button>
                </main>
            );
        }
        return this.props.children;
    }
}

export default function App() {
    return (
        <BrowserRouter>
            <Navbar />
            <PageErrorBoundary>
            <Suspense fallback={<main role="status" style={{ padding: '2rem' }}>Loading page...</main>}>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/container-depot" element={<ContainerHomePage />} />
                <Route path="/garage" element={<GarageHomePage />} />
                <Route path="/garage/department" element={<ProtectedRoute><GarageDepartment /></ProtectedRoute>} />
                <Route
                    path="/garage/workbench"
                    element={
                        <ProtectedRoute allowedRole={['Admin', 'Mechanic', 'FleetManager', 'Storekeeper']}>
                            <GarageWorkbenchPage />
                        </ProtectedRoute>
                    }
                />
                <Route path="/login" element={<Login />} />
                <Route path="/track" element={<PublicQrTracker />} />
                <Route path="/track/:code" element={<PublicQrTracker />} />
                <Route path="/waybill/:trackingCode" element={<PrintableWaybill />} />
                <Route path="/principal" element={<ProtectedRoute><PrincipalPortal /></ProtectedRoute>} />
                <Route path="/payroll" element={<ProtectedRoute allowedRole={['PayrollAccountant', 'Boss']}><HrPayrollAuditSuite /></ProtectedRoute>} />
                <Route path="/my-payslips" element={<ProtectedRoute allowedRole={STAFF_ROLES}><MyPayslips /></ProtectedRoute>} />
                <Route path="/control" element={<ProtectedRoute allowedRole={['Admin', 'FleetManager', 'Dispatcher', 'Storekeeper', 'Accounts_Payable', 'Accounts_Receivable', 'PayrollAccountant', 'Boss']}><ControlHub /></ProtectedRoute>} />
                <Route path="/hr/leave" element={<ProtectedRoute allowedRole="HR"><HrLeaveManagement /></ProtectedRoute>} />

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
            </Suspense>
            </PageErrorBoundary>
        </BrowserRouter>
    );
}
