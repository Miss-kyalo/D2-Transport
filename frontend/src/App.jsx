import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';

// Portal Placeholders (you can replace these with imports later)
function DriverDashboard() { return <h2>🚚 Driver Portal View</h2>; }
function AdminDashboard() { return <h2>🛡️ Admin Operations Dashboard</h2>; }
function ClientDashboard() { return <h2>💼 Client Load Management</h2>; }

export default function App() {
    return (
        <Router>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                
                <Route path="/driver/*" element={
                    <ProtectedRoute allowedRole="Driver">
                        <DriverDashboard />
                    </ProtectedRoute>
                } />

                <Route path="/admin/*" element={
                    <ProtectedRoute allowedRole="Admin">
                        <AdminDashboard />
                    </ProtectedRoute>
                } />

                <Route path="/client/*" element={
                    <ProtectedRoute allowedRole="Client">
                        <ClientDashboard />
                    </ProtectedRoute>
                } />

                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        </Router>
    );
}