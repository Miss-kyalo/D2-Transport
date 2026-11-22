import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { getRoleHome } from '../auth';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [challengeId, setChallengeId] = useState('');
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setBusy(true);
        try {
            const response = challengeId
                ? await api.post('/auth/verify-email-code', { challenge_id: challengeId, code })
                : await api.post('/auth/login', { username, password });

            if (response.data.mfa_required) {
                setChallengeId(response.data.challenge_id);
                setPassword('');
                return;
            }

            const role = response.data.role;
            const destination = getRoleHome(role);
            if (destination === '/login') {
                localStorage.clear();
                setError('Your role does not have a web portal assigned.');
                return;
            }

            localStorage.setItem('token', response.data.token);
            localStorage.setItem('role', role);
            localStorage.setItem('user', JSON.stringify(response.data.user));
            navigate(destination);
        } catch (err) {
            setError(
                err.response?.data?.error ||
                (err.code === 'ERR_NETWORK'
                    ? 'Cannot reach the API. Start the backend and check its database connection.'
                    : 'Failed to login.')
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <div style={{ maxWidth: '400px', margin: '60px auto', fontFamily: 'sans-serif', padding: '24px', border: '1px solid rgba(184, 155, 106, 0.3)', borderRadius: '8px', background: '#0E1A14', color: '#F8F6F0' }}>
            <h2 style={{ color: '#F8F6F0', marginTop: 0, textAlign: 'center' }}>Difan Logistics Login</h2>
            <small style={{ color: '#B89B6A', display: 'block', textAlign: 'center', marginBottom: '20px' }}>Secure 3PL Enterprise Portal</small>
            
            {error && <p style={{ color: '#ff6b6b', background: 'rgba(255,0,0,0.12)', padding: '10px', borderRadius: '4px', fontSize: '0.9em' }}>{error}</p>}
            
            <form onSubmit={handleLogin}>
                {challengeId ? (
                    <div style={{ marginBottom: '20px' }}>
                        <label htmlFor="email-code">Enter the six-digit code sent to your registered email:</label>
                        <input id="email-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength="6" required value={code} onChange={(e) => setCode(e.target.value)} style={{ width: '100%', padding: '10px', marginTop: '5px', boxSizing: 'border-box' }} />
                        <button type="button" disabled={busy} onClick={() => { setChallengeId(''); setCode(''); setError(''); }}>Start again</button>
                    </div>
                ) : (
                    <>
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ fontSize: '0.85em', color: '#C8C5BC' }}>Username:</label><br />
                    <input 
                        type="text" 
                        value={username} 
                        onChange={(e) => setUsername(e.target.value)} 
                        required 
                        style={{ width: '100%', padding: '10px', marginTop: '5px', background: '#16261E', color: '#fff', border: '1px solid #444', borderRadius: '4px', boxSizing: 'border-box' }}
                    />
                </div>
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ fontSize: '0.85em', color: '#C8C5BC' }}>Password:</label><br />
                    <input 
                        type="password" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        required 
                        style={{ width: '100%', padding: '10px', marginTop: '5px', background: '#16261E', color: '#fff', border: '1px solid #444', borderRadius: '4px', boxSizing: 'border-box' }}
                    />
                </div>
                    </>
                )}
                <button type="submit" disabled={busy} style={{ width: '100%', padding: '10px', background: '#004225', color: '#F8F6F0', border: '1px solid #B89B6A', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                    {challengeId ? 'Verify code' : 'Login'}
                </button>
            </form>
            <p style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.85em', color: '#C8C5BC' }}>
                Accounts are provisioned by HR. Contact HR if you need access.
            </p>
        </div>
    );
}