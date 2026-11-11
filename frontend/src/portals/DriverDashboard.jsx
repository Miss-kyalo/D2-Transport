export default function DriverDashboard() {
    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
            <h1>Driver Portal Dashboard</h1>
            <button onClick={() => { localStorage.clear(); window.location.href = '/login'; }}>Sign Out</button>
        </div>
    );
}