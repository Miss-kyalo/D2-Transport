import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';

export default function PrintableWaybill() {
    const { trackingCode } = useParams();
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [loadedTrackingCode, setLoadedTrackingCode] = useState('');
    const loading = loadedTrackingCode !== trackingCode;
    const navigate = useNavigate();

    useEffect(() => {
        let active = true;
        const loadWaybill = async () => {
            try {
                const res = await api.get(`/trips/public/track/${encodeURIComponent(trackingCode)}`);
                if (active) {
                    setData(res.data);
                    setError('');
                }
            } catch (err) {
                console.error('Error loading waybill:', err);
                if (active) {
                    setData(null);
                    setError(err.response?.data?.error || 'Failed to load waybill.');
                }
            } finally {
                if (active) setLoadedTrackingCode(trackingCode);
            }
        };

        loadWaybill();
        return () => {
            active = false;
        };
    }, [trackingCode]);

    if (loading) return <div style={{ padding: '40px', color: '#000', background: '#fff' }}>Generating thermal waybill slip...</div>;
    if (!data) return <div style={{ padding: '40px', color: '#000', background: '#fff' }}>{error || `Waybill not found for tracking code: ${trackingCode}`}</div>;

    const { trip } = data;

    return (
        <div style={{ maxWidth: '600px', margin: '30px auto', background: '#fff', color: '#000', padding: '30px', fontFamily: 'monospace', border: '1px solid #000', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px dashed #000', paddingBottom: '15px' }}>
                <div>
                    <h2 style={{ margin: 0, color: '#004225' }}>D2-TRANSPORT WAYBILL</h2>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.85em' }}>3PL Freight Assurance & Security Audit</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <h3 style={{ margin: 0, color: '#b89b6a' }}>{trip.tracking_code}</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8em' }}>Status: {trip.status}</p>
                </div>
            </div>

            <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', fontSize: '0.9em' }}>
                <div>
                    <strong>Shipper (Manufacturer):</strong><br />
                    {trip.manufacturer_name || 'Direct Dispatch'}
                </div>
                <div>
                    <strong>Consignee (Buyer):</strong><br />
                    {trip.consignee_name || 'N/A'}
                </div>
                <div>
                    <strong>Origin:</strong> {trip.origin}
                </div>
                <div>
                    <strong>Destination:</strong> {trip.destination}
                </div>
            </div>

            <div style={{ marginTop: '20px', borderTop: '1px solid #000', paddingTop: '15px', fontSize: '0.9em', lineHeight: '1.6' }}>
                <strong>Cargo Description:</strong> {trip.cargo_description}<br />
                <strong>Initial Dispatch Weight:</strong> {trip.initial_weight} Metric Tons<br />
                <strong>Assigned Truck Plate:</strong> {trip.active_plate || 'N/A'} ({trip.active_truck_model || 'N/A'})<br />
                <strong>Security Stamp Verified:</strong> {trip.ocr_security_stamp_detected ? 'YES (OCR Confirmed)' : 'Pending'}
            </div>

            <div style={{ marginTop: '30px', borderTop: '2px dashed #000', paddingTop: '15px', textAlign: 'center', fontSize: '0.85em' }}>
                <p style={{ margin: 0 }}>Scan QR or track status live online at:</p>
                <code style={{ background: '#f4f4f4', padding: '2px 6px' }}>{window.location.origin}/track/{trip.tracking_code}</code>
            </div>

            <div style={{ marginTop: '30px', display: 'flex', gap: '10px' }} className="no-print">
                <button onClick={() => window.print()} style={{ flex: 1, padding: '10px', background: '#004225', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold', borderRadius: '4px' }}>
                    Print Waybill Slip 🖨️
                </button>
                <button onClick={() => navigate(-1)} style={{ padding: '10px 20px', background: '#ccc', color: '#000', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>
                    Back
                </button>
            </div>
        </div>
    );
}