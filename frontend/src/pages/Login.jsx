import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const response = await axios.post('http://localhost:5000/api/auth/login', {
                username,
                password
            });

            localStorage.setItem('token', response.data.token);
            localStorage.setItem('role', response.data.role);
            localStorage.setItem('user', JSON.stringify(response.data.user));

            const role = response.data.role;
            if (role === 'Admin') {
                navigate('/admin');
            } else if (role === 'Driver') {
                navigate('/driver');
            } else if (role === 'Manufacturer') {
                navigate('/manufacturer');
            } else if (role === 'Client') {
                navigate('/client');
            } else {
                navigate('/');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to login.');
        }
    };

    return (
        <div style={{ maxWidth: '400px', margin: '50px auto', fontFamily: 'sans-serif', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', background: '#1e1e1e', color: '#fff' }}>
            <h2>D2-Transport Login</h2>
            {error && <p style={{ color: '#ff6b6b', background: 'rgba(255,0,0,0.1)', padding: '10px', borderRadius: '4px' }}>{error}</p>}
            <form onSubmit={handleLogin}>
                <div style={{ marginBottom: '15px' }}>
                    <label>Username:</label><br />
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
                <button type="submit" style={{ width: '100%', padding: '10px', background: '#007BFF', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                    Login
                </button>
            </form>
            <p style={{ marginTop: '15px', textAlign: 'center' }}>
                Don't have an account? <Link to="/register" style={{ color: '#4dabf7' }}>Register here</Link>
            </p>
        </div>
    );
}