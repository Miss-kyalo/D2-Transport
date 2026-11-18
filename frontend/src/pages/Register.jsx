import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';

export default function Register() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('Driver');
    const [companyName, setCompanyName] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const navigate = useNavigate();

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        try {
            await api.post('/auth/register', {
                username,
                password,
                role,
                company_name: ['Manufacturer', 'Client', 'SpotClient'].includes(role)
                    ? companyName
                    : null
            });

            setSuccess('Registration successful! Redirecting to login...');
            setTimeout(() => navigate('/login'), 2000);
        } catch (err) {
            const errorMsg = err.response?.data?.details 
                ? `${err.response.data.error} — Details: ${err.response.data.details}` 
                : (err.response?.data?.error || err.response?.data?.message || 'Failed to register.');
            setError(errorMsg);
        }
    };

    return (
        <div style={{ maxWidth: '400px', margin: '50px auto', fontFamily: 'sans-serif', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', background: '#1e1e1e', color: '#fff' }}>
            <h2>D2-Transport Register</h2>
            {error && <p style={{ color: '#ff6b6b', background: 'rgba(255,0,0,0.1)', padding: '10px', borderRadius: '4px' }}>{error}</p>}
            {success && <p style={{ color: '#51cf66', background: 'rgba(0,255,0,0.1)', padding: '10px', borderRadius: '4px' }}>{success}</p>}
            
            <form onSubmit={handleRegister}>
                <div style={{ marginBottom: '15px' }}>
                    <label>Username / Email:</label><br />
                    <input 
                        type="text" 
                        value={username} 
                        onChange={(e) => setUsername(e.target.value)} 
                        required 
                        style={{ width: '100%', padding: '8px', marginTop: '5px', background: '#2d2d2d', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}
                    />
                </div>
                
                <div style={{ marginBottom: '15px' }}>
                    <label>Password:</label><br />
                    <input 
                        type="password" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        required 
                        style={{ width: '100%', padding: '8px', marginTop: '5px', background: '#2d2d2d', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}
                    />
                </div>

                <div style={{ marginBottom: '15px' }}>
                    <label>Role:</label><br />
                    <select 
                        value={role} 
                        onChange={(e) => setRole(e.target.value)}
                        style={{ width: '100%', padding: '8px', marginTop: '5px', background: '#2d2d2d', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}
                    >
                        <option value="Driver">Driver</option>
                        <option value="Manufacturer">Manufacturer (e.g. KEDA Ceramics)</option>
                        <option value="Client">Client / Consignee</option>
                        <option value="SpotClient">Spot Client / Consignee</option>
                    </select>
                </div>

                {['Manufacturer', 'Client', 'SpotClient'].includes(role) && (
                    <div style={{ marginBottom: '15px' }}>
                        <label>
                            {role === 'Manufacturer' ? 'Company Name:' : 'Client / Consignee Name:'}
                        </label><br />
                        <input 
                            type="text" 
                            placeholder="e.g. KEDA Ceramics Ltd"
                            value={companyName} 
                            onChange={(e) => setCompanyName(e.target.value)} 
                            required 
                            style={{ width: '100%', padding: '8px', marginTop: '5px', background: '#2d2d2d', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}
                        />
                    </div>
                )}

                <button type="submit" style={{ width: '100%', padding: '10px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                    Register
                </button>
            </form>

            <p style={{ marginTop: '15px', textAlign: 'center' }}>
                Already have an account? <Link to="/login" style={{ color: '#4dabf7' }}>Login here</Link>
            </p>
        </div>
    );
}