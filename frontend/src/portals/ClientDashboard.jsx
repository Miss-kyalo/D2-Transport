export default function ClientDashboard() {
    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
            <h1>Client Portal Dashboard</h1>
            <button onClick={() => { localStorage.clear(); window.location.href = '/login'; }}>Sign Out</button>
        </div>
    );
}