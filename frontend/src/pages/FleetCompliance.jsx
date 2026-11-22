import { useEffect, useState } from 'react';
import api from '../api';
import { downloadDocument } from '../lib/downloadDocument';

const fieldStyle = {
    display: 'block',
    boxSizing: 'border-box',
    width: '100%',
    marginTop: '4px',
    padding: '9px'
};

export default function FleetCompliance() {
    const [trucks, setTrucks] = useState([]);
    const [selectedTruckId, setSelectedTruckId] = useState('');
    const [documents, setDocuments] = useState([]);
    const [plateNumber, setPlateNumber] = useState('');
    const [model, setModel] = useState('');
    const [capacityTons, setCapacityTons] = useState('');
    const [docType, setDocType] = useState('');
    const [certificateNumber, setCertificateNumber] = useState('');
    const [issueDate, setIssueDate] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [importErrors, setImportErrors] = useState([]);
    const [workbook, setWorkbook] = useState(null);
    const [fileInputKey, setFileInputKey] = useState(0);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let isCurrent = true;

        api.get('/trucks')
            .then((response) => {
                if (isCurrent) setTrucks(response.data);
            })
            .catch((requestError) => {
                if (isCurrent) setError(requestError.response?.data?.error || 'Failed to load trucks.');
            })
            .finally(() => {
                if (isCurrent) setLoading(false);
            });

        return () => {
            isCurrent = false;
        };
    }, []);

    useEffect(() => {
        if (!selectedTruckId) return undefined;
        let isCurrent = true;

        api.get(`/trucks/${selectedTruckId}/compliance`)
            .then((response) => {
                if (isCurrent) setDocuments(response.data);
            })
            .catch((requestError) => {
                if (isCurrent) setError(requestError.response?.data?.error || 'Failed to load compliance documents.');
            });

        return () => {
            isCurrent = false;
        };
    }, [selectedTruckId]);

    const handleAddTruck = async (event) => {
        event.preventDefault();
        setError('');
        setMessage('');
        setSaving(true);
        try {
            const response = await api.post('/trucks', {
                plate_number: plateNumber,
                model,
                capacity_tons: capacityTons
            });
            const trucksResponse = await api.get('/trucks');
            setTrucks(trucksResponse.data);
            setSelectedTruckId(String(response.data.truck.id));
            setPlateNumber('');
            setModel('');
            setCapacityTons('');
            setMessage('Truck added successfully.');
        } catch (requestError) {
            setError(requestError.response?.data?.error || 'Failed to add truck.');
        } finally {
            setSaving(false);
        }
    };

    const handleUploadDocument = async (event) => {
        event.preventDefault();
        setError('');
        setMessage('');

        const formData = new FormData(event.currentTarget);
        setSaving(true);
        try {
            await api.post(`/trucks/${selectedTruckId}/compliance`, formData);
            const response = await api.get(`/trucks/${selectedTruckId}/compliance`);
            setDocuments(response.data);
            setDocType('');
            setCertificateNumber('');
            setIssueDate('');
            setExpiryDate('');
            event.currentTarget.reset();
            setMessage('Compliance document uploaded.');
        } catch (requestError) {
            setError(requestError.response?.data?.error || 'Failed to upload compliance document.');
        } finally {
            setSaving(false);
        }
    };

    const handleDownloadTemplate = async () => {
        setError('');
        try {
            const response = await api.get('/trucks/import/template', { responseType: 'blob' });
            const url = URL.createObjectURL(response.data);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'truck-import-template.xlsx';
            link.click();
            URL.revokeObjectURL(url);
        } catch (requestError) {
            setError(requestError.response?.data?.error || 'Failed to download the truck import template.');
        }
    };

    const handleImportTrucks = async (event) => {
        event.preventDefault();
        if (!workbook) return;
        setError('');
        setMessage('');
        setImportErrors([]);
        setSaving(true);
        const formData = new FormData();
        formData.append('workbook', workbook);
        try {
            const response = await api.post('/trucks/import', formData);
            setMessage(response.data.message);
            setWorkbook(null);
            setFileInputKey((key) => key + 1);
            const trucksResponse = await api.get('/trucks');
            setTrucks(trucksResponse.data);
        } catch (requestError) {
            setError(requestError.response?.data?.error || 'Failed to import trucks.');
            setImportErrors(requestError.response?.data?.errors || []);
        } finally {
            setSaving(false);
        }
    };

    return (
        <main style={{ maxWidth: '1000px', margin: '30px auto', padding: '24px', fontFamily: 'sans-serif' }}>
            <h1>Fleet & Compliance</h1>
            {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
            {importErrors.length > 0 && <ul style={{ color: '#b91c1c' }}>{importErrors.map((item, index) => <li key={index}>{item}</li>)}</ul>}
            {message && <p role="status" style={{ color: '#166534' }}>{message}</p>}

            <section style={{ marginBottom: '30px' }}>
                <h2>Import trucks from Excel</h2>
                <p>Download the template and fill the Trucks sheet. The Example sheet shows the expected format. A file with errors or duplicate plates is rejected without importing any trucks.</p>
                <button type="button" onClick={handleDownloadTemplate} disabled={saving}>Download template and example</button>
                <form onSubmit={handleImportTrucks} style={{ marginTop: '12px' }}>
                    <label>
                        Excel workbook (.xlsx, up to 5 MB and 1,000 trucks)
                        <input key={fileInputKey} type="file" accept=".xlsx" required onChange={(event) => setWorkbook(event.target.files[0] || null)} style={fieldStyle} />
                    </label>
                    <button type="submit" disabled={saving || !workbook} style={{ marginTop: '12px' }}>Import trucks</button>
                </form>
            </section>

            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
                <form onSubmit={handleAddTruck}>
                    <h2>Add truck</h2>
                    <label>
                        Plate number
                        <input required value={plateNumber} onChange={(event) => setPlateNumber(event.target.value)} style={fieldStyle} />
                    </label>
                    <label>
                        Model
                        <input required value={model} onChange={(event) => setModel(event.target.value)} style={fieldStyle} />
                    </label>
                    <label>
                        Capacity (tons)
                        <input required type="number" min="0.01" step="0.01" value={capacityTons} onChange={(event) => setCapacityTons(event.target.value)} style={fieldStyle} />
                    </label>
                    <button type="submit" disabled={saving} style={{ marginTop: '12px' }}>Add truck</button>
                </form>

                <form onSubmit={handleUploadDocument}>
                    <h2>Upload compliance certificate</h2>
                    <label>
                        Truck
                        <select required value={selectedTruckId} onChange={(event) => setSelectedTruckId(event.target.value)} style={fieldStyle}>
                            <option value="">Select a truck</option>
                            {trucks.map((truck) => (
                                <option key={truck.id} value={truck.id}>{truck.plate_number} — {truck.model}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Document type
                        <select required value={docType} onChange={(event) => setDocType(event.target.value)} style={fieldStyle}>
                            <option value="">Select a certificate type</option>
                            <option value="Insurance">Insurance</option>
                            <option value="Speed Governor">Speed Governor</option>
                            <option value="Inspection">Inspection</option>
                            <option value="Driving License">Driving License</option>
                        </select>
                    </label>
                    <label>
                        Certificate number
                        <input required value={certificateNumber} onChange={(event) => setCertificateNumber(event.target.value)} style={fieldStyle} />
                    </label>
                    <label>
                        Issue date
                        <input required type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} style={fieldStyle} />
                    </label>
                    <label>
                        Expiry date
                        <input required type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} style={fieldStyle} />
                    </label>
                    <label>
                        Certificate file
                        <input required name="document_file" type="file" accept="image/*,.pdf" style={fieldStyle} />
                    </label>
                    <input type="hidden" name="doc_type" value={docType} />
                    <input type="hidden" name="certificate_number" value={certificateNumber} />
                    <input type="hidden" name="issue_date" value={issueDate} />
                    <input type="hidden" name="expiry_date" value={expiryDate} />
                    <button type="submit" disabled={saving || !selectedTruckId} style={{ marginTop: '12px' }}>
                        Upload certificate
                    </button>
                </form>
            </section>

            <section style={{ marginTop: '30px' }}>
                <h2>Fleet vehicles</h2>
                {loading ? <p>Loading trucks...</p> : trucks.length === 0 ? <p>No trucks have been added.</p> : (
                    <ul>
                        {trucks.map((truck) => (
                            <li key={truck.id}>
                                <button type="button" onClick={() => setSelectedTruckId(String(truck.id))}>
                                    {truck.plate_number} — {truck.model} ({truck.status})
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section>
                <h2>Selected truck certificates</h2>
                {!selectedTruckId ? <p>Select a truck to view its certificates.</p> : documents.length === 0 ? (
                    <p>No compliance documents found for this truck.</p>
                ) : (
                    <ul>
                        {documents.map((document) => (
                            <li key={document.id}>
                                {document.doc_type} — {document.certificate_number} (expires {document.expiry_date}){' '}
                                <button type="button" onClick={() => downloadDocument(document.cloud_file_url).catch((err) => setError(err.message || 'Failed to download certificate.'))}>Download certificate</button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </main>
    );
}
