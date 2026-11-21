import QrPassBadge from './QrPassBadge';

export default function EirPrintModal({ receipt, onClose }) {
    if (!receipt) return null;

    const container = receipt.container || {};
    const driver = receipt.driver || {};
    const transporter = receipt.transporter || {};
    const clientShipper = receipt.client_shipper || {};

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.7)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '16px',
                zIndex: 70,
                overflowY: 'auto'
            }}
        >
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    #container-eir-print, #container-eir-print * { visibility: visible; }
                    #container-eir-print {
                        position: fixed;
                        left: 0;
                        top: 0;
                        width: 100%;
                        max-width: 100% !important;
                        border: none !important;
                        box-shadow: none !important;
                        padding: 16px !important;
                    }
                    .no-print { display: none !important; }
                }
            `}</style>

            <div
                id="container-eir-print"
                style={{
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    width: '100%',
                    maxWidth: '780px',
                    borderRadius: '8px',
                    padding: '24px',
                    border: '1px solid #cbd5e1',
                    fontFamily: 'Inter, system-ui, sans-serif'
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '16px',
                        borderBottom: '2px solid #0f172a',
                        paddingBottom: '14px',
                        marginBottom: '16px'
                    }}
                >
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: '#0f766e' }}>
                            CONTAINER DEPOT & FREIGHT CORRIDOR • ATHI RIVER, KENYA
                        </div>
                        <h2 style={{ margin: '2px 0 4px', fontSize: '21px' }}>
                            EQUIPMENT INTERCHANGE RECEIPT (EIR)
                        </h2>
                        <div style={{ fontSize: '12px', color: '#475569' }}>
                            EIR Ref: <strong>{receipt.eir_reference || 'N/A'}</strong> • Movement:{' '}
                            <strong>{receipt.movement_type || 'GATE_OUT'}</strong> • Waybill:{' '}
                            <strong>{receipt.tracking_code || 'N/A'}</strong>
                        </div>
                        <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                            Issued: {receipt.issued_at ? new Date(receipt.issued_at).toLocaleString() : new Date().toLocaleString()}
                        </div>
                    </div>

                    <QrPassBadge
                        code={container.container_number || receipt.tracking_code}
                        label="Scan QR for Live EIR & Transit Log"
                    />
                </div>

                <div
                    style={{
                        backgroundColor: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '12px',
                        marginBottom: '14px',
                        fontSize: '13px'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                            <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>CONTAINER NO. (ISO 6346)</span>
                            <strong style={{ fontSize: '17px' }}>{container.container_number || '—'}</strong>
                        </div>
                        <div>
                            <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>SIZE / TYPE</span>
                            <strong>{container.container_type || '—'}</strong>
                        </div>
                        <div>
                            <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>YARD BAY</span>
                            <strong>{container.yard_bay || '—'}</strong>
                        </div>
                        <div>
                            <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>SEAL NO.</span>
                            <strong>{receipt.seal_number || 'N/A'}</strong>
                        </div>
                        <div>
                            <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>IICL CONDITION</span>
                            <strong>{container.condition_status || 'Sound'}</strong>
                        </div>
                    </div>

                    <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1', fontSize: '12px', color: '#334155' }}>
                        <strong>Hygiene & Biosecurity:</strong> {container.cleaning_status || 'Pending'}
                        {container.cleaning_cert_ref ? ` (Cert: ${container.cleaning_cert_ref})` : ''} •{' '}
                        <strong>KEPHIS:</strong> {container.kephis_cleared ? 'Cleared' : 'Standard'} •{' '}
                        <strong>Holds:</strong>{' '}
                        {container.customs_hold || container.kebs_hold
                            ? `${container.customs_hold ? 'KRA Customs ' : ''}${container.kebs_hold ? 'KEBS' : ''}`
                            : 'None / Cleared'}
                    </div>
                    {receipt.iicl_defect_notes && (
                        <div style={{ marginTop: '6px', fontSize: '12px', color: '#0f172a' }}>
                            <strong>IICL Structural / Defect Remarks:</strong> {receipt.iicl_defect_notes}
                        </div>
                    )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '16px', fontSize: '12px' }}>
                    <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px' }}>
                        <div style={{ fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginBottom: '8px' }}>
                            Driver Details
                        </div>
                        <div><strong>Name:</strong> {driver.name || '—'}</div>
                        <div><strong>National ID:</strong> {driver.national_id || '—'}</div>
                        <div><strong>Phone:</strong> {driver.phone_number || '—'}</div>
                        <div><strong>License No.:</strong> {driver.license_number || '—'}</div>
                        <div>
                            <strong>License Expiry:</strong>{' '}
                            {driver.license_expiry ? new Date(driver.license_expiry).toLocaleDateString() : '—'}
                        </div>
                    </div>

                    <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px' }}>
                        <div style={{ fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginBottom: '8px' }}>
                            Transporter Details
                        </div>
                        <div><strong>Carrier:</strong> {transporter.company_name || 'D2-Transport (K) Ltd'}</div>
                        <div><strong>Prime Mover / Truck:</strong> {transporter.truck_plate || receipt.truck_plate || '—'}</div>
                        <div><strong>Trailer No.:</strong> {transporter.trailer_plate || '—'}</div>
                        <div><strong>Depot / Origin:</strong> {receipt.origin || transporter.depot_location || 'Athi River'}</div>
                        <div><strong>Destination:</strong> {receipt.destination || '—'}</div>
                    </div>

                    <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px' }}>
                        <div style={{ fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginBottom: '8px' }}>
                            Client / Shipper Details
                        </div>
                        <div><strong>Shipping Line / Principal:</strong> {clientShipper.principal_or_line || container.principal_name || '—'}</div>
                        <div><strong>Shipper:</strong> {clientShipper.shipper_name || '—'}</div>
                        <div><strong>Client / Consignee:</strong> {clientShipper.consignee_or_client || '—'}</div>
                        <div><strong>Cargo / Commodity:</strong> {receipt.cargo_description || 'Containerized Freight'}</div>
                        <div><strong>Tariff Currency:</strong> {clientShipper.billing_currency || container.principal_currency || 'USD'}</div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginTop: '22px', fontSize: '11px', color: '#475569' }}>
                    <div style={{ borderTop: '1px solid #64748b', paddingTop: '6px' }}>
                        <strong>Depot Gate Inspector</strong>
                        <div>Signature, Stamp & Time</div>
                    </div>
                    <div style={{ borderTop: '1px solid #64748b', paddingTop: '6px' }}>
                        <strong>Driver Acknowledgement</strong>
                        <div>Signature & Condition Acceptance</div>
                    </div>
                    <div style={{ borderTop: '1px solid #64748b', paddingTop: '6px' }}>
                        <strong>Client / Shipper / Security</strong>
                        <div>Release Verification</div>
                    </div>
                </div>

                <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                    <button
                        type="button"
                        onClick={() => window.print()}
                        style={{
                            padding: '9px 18px',
                            backgroundColor: '#143628',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        Print Interchange (EIR)
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            padding: '9px 14px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#ffffff',
                            color: '#0f172a',
                            cursor: 'pointer'
                        }}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}