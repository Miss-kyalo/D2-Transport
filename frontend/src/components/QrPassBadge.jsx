import { QRCodeSVG } from 'qrcode.react';

export default function QrPassBadge({ code, label = 'Scan to Verify Gate Pass & Live Transit' }) {
    if (!code) return null;
    const verifyUrl = `${window.location.origin}/track/${encodeURIComponent(code)}`;

    return (
        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '8px', backgroundColor: '#fff' }}>
            <QRCodeSVG value={verifyUrl} size={104} level="M" />
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#0f172a', marginTop: '6px', textAlign: 'center', maxWidth: '120px' }}>
                {label}
            </div>
            <div style={{ fontSize: '9px', color: '#64748b' }}>{code}</div>
        </div>
    );
}