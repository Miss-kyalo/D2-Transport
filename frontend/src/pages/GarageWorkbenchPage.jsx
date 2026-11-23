import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import JobCardStorePanel from '../components/JobCardStorePanel';
import SharedWorkbenchPanel from '../components/SharedWorkbenchPanel';
import QuotePreviewModal from '../components/QuotePreviewModal';
import {
    buildQuotePreview,
    createJobPin,
    fetchJobCard,
    inspectGarageImage,
    issueJobPart,
    reserveJobPart,
    returnJobCore,
    updateJobStatus
} from '../lib/garageApi';
import { flushOfflineQueue } from '../lib/offlineQueue';
import './GarageWorkbenchPage.css';

const RigInspectionCanvas = lazy(() => import('../components/RigInspectionCanvas'));

function readImageAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') resolve(reader.result);
            else reject(new Error('Could not read the selected image.'));
        };
        reader.onerror = () => reject(new Error('Could not read the selected image.'));
        reader.readAsDataURL(file);
    });
}

export default function GarageWorkbenchPage() {
    const role = localStorage.getItem('role');
    return (
        <>
            <main className="garage-workbench bg-slate-950 p-4 text-slate-100 md:p-6">
                <h1 className="mb-4 text-xl font-bold text-white">Garage repair workbench</h1>
                <SharedWorkbenchPanel />
            </main>
            {['Admin', 'Mechanic'].includes(role) && <LegacyGarageWorkbench />}
        </>
    );
}

function LegacyGarageWorkbench() {
    const [jobCardId, setJobCardId] = useState('1');
    const [vehicleRole, setVehicleRole] = useState('TRACTOR');
    const [stage, setStage] = useState('DIAGNOSIS');
    const [severity, setSeverity] = useState('HIGH');
    const [pinNotes, setPinNotes] = useState('');
    const [pins, setPins] = useState([]);
    const [jobCard, setJobCard] = useState(null);
    const [selectedPin, setSelectedPin] = useState(null);
    const [quote, setQuote] = useState(null);
    const [snapshot, setSnapshot] = useState(null);
    const [aiMode, setAiMode] = useState('FAULT_CODE');
    const [aiResult, setAiResult] = useState(null);
    const [aiBusy, setAiBusy] = useState(false);
    const [feedback, setFeedback] = useState('');
    const canvasRef = useRef(null);
    const numericJobId = Number(jobCardId);

    const loadJobCard = useCallback(async () => {
        if (!Number.isSafeInteger(numericJobId) || numericJobId < 1) return;
        try {
            const data = await fetchJobCard(numericJobId);
            setJobCard(data);
            setPins(data.inspection_pins || []);
        } catch (error) {
            setJobCard(null);
            setFeedback(error.message);
        }
    }, [numericJobId]);

    useEffect(() => {
        if (!Number.isSafeInteger(numericJobId) || numericJobId < 1) return;
        let active = true;
        fetchJobCard(numericJobId)
            .then((data) => {
                if (!active) return;
                setJobCard(data);
                setPins(data.inspection_pins || []);
            })
            .catch((error) => {
                if (!active) return;
                setJobCard(null);
                setFeedback(error.message);
            });
        return () => {
            active = false;
        };
    }, [numericJobId]);

    useEffect(() => {
        if (!('serviceWorker' in navigator)) return undefined;
        navigator.serviceWorker.register('/sw.js').catch((error) => {
            console.error('Garage offline worker registration failed:', error);
        });

        const syncQueuedActions = async () => {
            try {
                const result = await flushOfflineQueue();
                if (result.accountMismatch > 0) {
                    setFeedback(
                        `${result.accountMismatch} queued action(s) belong to another or legacy account and were not sent. Sign in with the original account to sync them.`
                    );
                } else if (result.synced > 0) {
                    setFeedback(
                        `Synced ${result.synced} queued action(s); ${result.remaining} remain.`
                    );
                    await loadJobCard();
                } else if (result.remaining > 0) {
                    setFeedback(`${result.remaining} garage action(s) are still waiting to sync.`);
                }
            } catch (error) {
                setFeedback(error.message);
            }
        };

        window.addEventListener('online', syncQueuedActions);
        void Promise.resolve().then(syncQueuedActions);
        return () => window.removeEventListener('online', syncQueuedActions);
    }, [loadJobCard]);

    const runAction = async (action, successMessage) => {
        try {
            const result = await action();
            setFeedback(
                result?.queued
                    ? 'Action saved offline and will sync when the connection returns.'
                    : successMessage
            );
        } catch (error) {
            setFeedback(error.message);
        }
    };

    const handlePlacePin = async ({ vehicle_role, mesh_zone, pos_x, pos_y, pos_z }) => {
        try {
            const result = await createJobPin(numericJobId, {
                stage,
                vehicle_role,
                mesh_zone,
                pos_x,
                pos_y,
                pos_z,
                severity,
                notes: pinNotes || `Pin on ${mesh_zone}`
            });
            if (result.queued) {
                setFeedback('Inspection pin saved offline and will sync when the connection returns.');
                return;
            }
            setPins((current) => [...current, result.pin]);
            setSelectedPin(result.pin);
            setFeedback(
                result.repeat_fault_warning
                    ? `Pin saved on ${mesh_zone}; a recent fault exists in this zone.`
                    : `Pin saved on ${mesh_zone}.`
            );
        } catch (error) {
            setFeedback(error.message);
        }
    };

    const handleQuote = () =>
        runAction(
            async () => {
                const data = await buildQuotePreview(numericJobId, {
                    labor_items: [
                        { description: 'Mechanical diagnostics & fitment', amount: 4500 }
                    ],
                    currency: 'KES'
                });
                setQuote(data);
                return data;
            },
            'Quote preview generated.'
        );

    const handleCaptureSnapshot = () => {
        try {
            const dataUrl = canvasRef.current?.captureSnapshotDataUrl();
            if (!dataUrl) {
                setFeedback('The inspection view is not ready to capture yet.');
                return;
            }
            setSnapshot(dataUrl);
            setFeedback('3D inspection snapshot captured.');
        } catch (error) {
            setFeedback(`Could not capture the 3D view: ${error.message}`);
        }
    };

    const handleAnalyzeImage = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (
            !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
            file.size > 6 * 1024 * 1024
        ) {
            setFeedback('Choose a JPEG, PNG, or WebP image smaller than 6 MB.');
            return;
        }

        setAiBusy(true);
        try {
            const dataUrl = await readImageAsDataUrl(file);
            const result = await inspectGarageImage({
                image_base64: dataUrl.slice(dataUrl.indexOf(',') + 1),
                mime_type: file.type,
                mode: aiMode,
                vehicle_make: jobCard?.tractor_make || jobCard?.trailer_make || null,
                notes: pinNotes || null
            });
            setAiResult(result);
            setFeedback('AI analysis complete. Review suggestions before acting on them.');
        } catch (error) {
            setFeedback(error.message);
        } finally {
            setAiBusy(false);
        }
    };

    return (
        <main className="garage-workbench min-h-screen bg-slate-950 p-4 text-slate-100 md:p-6">
            <header className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                    <h1 className="mb-1 text-xl font-bold text-white">
                        Garage repair workbench
                    </h1>
                    <p className="max-w-3xl text-sm text-slate-400">
                        Manage shared work orders and their parts requests. Historical job cards are shown separately below.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <label htmlFor="garage-job-card-id" className="text-sm text-slate-300">Historical job card ID</label>
                    <input
                        id="garage-job-card-id"
                        type="number"
                        min="1"
                        value={jobCardId}
                        onChange={(event) => setJobCardId(event.target.value)}
                        placeholder="Job card ID"
                        className="w-32 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                    />
                    <button
                        type="button"
                        onClick={handleCaptureSnapshot}
                        className="rounded bg-slate-700 px-3 py-2 text-sm font-semibold hover:bg-slate-600"
                    >
                        Capture view
                    </button>
                    <button
                        type="button"
                        onClick={handleQuote}
                        className="rounded bg-indigo-600 px-3 py-2 text-sm font-semibold hover:bg-indigo-500"
                    >
                        Generate quote
                    </button>
                </div>
            </header>

            <h2 className="mb-3 text-lg font-semibold">Historical job-card inspection and stock actions</h2>
            {feedback && (
                <div
                    className="mb-5 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-amber-300"
                    role="status"
                    aria-live="polite"
                >
                    {feedback}
                </div>
            )}

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                <section className="space-y-3 lg:col-span-2" aria-label="Vehicle inspection">
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setVehicleRole('TRACTOR')}
                            aria-pressed={vehicleRole === 'TRACTOR'}
                            className={`rounded px-3 py-2 text-sm font-semibold ${
                                vehicleRole === 'TRACTOR'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-800 text-slate-300'
                            }`}
                        >
                            Tractor
                        </button>
                        <button
                            type="button"
                            onClick={() => setVehicleRole('TRAILER')}
                            aria-pressed={vehicleRole === 'TRAILER'}
                            className={`rounded px-3 py-2 text-sm font-semibold ${
                                vehicleRole === 'TRAILER'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-800 text-slate-300'
                            }`}
                        >
                            Trailer
                        </button>

                        <label className="sr-only" htmlFor="inspection-stage">
                            Inspection stage
                        </label>
                        <select
                            id="inspection-stage"
                            value={stage}
                            onChange={(event) => setStage(event.target.value)}
                            className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                        >
                            <option value="INTAKE">Intake</option>
                            <option value="DIAGNOSIS">Diagnosis</option>
                            <option value="COMPLETION">Completion</option>
                        </select>

                        <label className="sr-only" htmlFor="inspection-severity">
                            Fault severity
                        </label>
                        <select
                            id="inspection-severity"
                            value={severity}
                            onChange={(event) => setSeverity(event.target.value)}
                            className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                        >
                            <option value="LOW">Low</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="HIGH">High</option>
                            <option value="CRITICAL">Critical</option>
                        </select>
                    </div>

                    <label className="sr-only" htmlFor="inspection-notes">
                        Inspection pin notes
                    </label>
                    <input
                        id="inspection-notes"
                        type="text"
                        value={pinNotes}
                        onChange={(event) => setPinNotes(event.target.value)}
                        placeholder="Optional note, e.g. brake chamber air leak"
                        className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                    />

                    <Suspense fallback={<div role="status">Loading 3D inspection view...</div>}>
                        <RigInspectionCanvas
                            ref={canvasRef}
                            vehicleRole={vehicleRole}
                            pins={pins}
                            onPlacePin={handlePlacePin}
                            onSelectPin={setSelectedPin}
                        />
                    </Suspense>

                    {selectedPin && (
                        <div className="space-y-1 rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm">
                            <h2 className="font-semibold text-white">
                                Pin #{selectedPin.id}: {selectedPin.mesh_zone} ({selectedPin.severity})
                            </h2>
                            <p className="text-slate-400">
                                {selectedPin.stage} · {selectedPin.vehicle_role}
                            </p>
                            <p>{selectedPin.notes}</p>
                        </div>
                    )}

                    {snapshot && (
                        <figure className="space-y-2 rounded-lg border border-slate-800 bg-slate-900 p-3">
                            <img
                                src={snapshot}
                                alt="Captured 3D vehicle inspection"
                                className="max-h-72 w-full rounded object-contain"
                            />
                            <figcaption className="text-sm text-slate-400">
                                Local snapshot preview. Download it before sharing externally.
                                <a
                                    href={snapshot}
                                    download={`garage-job-${jobCardId}-inspection.png`}
                                    className="ml-2 font-semibold text-emerald-400 hover:text-emerald-300"
                                >
                                    Download image
                                </a>
                            </figcaption>
                        </figure>
                    )}
                </section>

                <aside className="space-y-4" aria-label="Job card and stock actions">
                    <JobCardStorePanel
                        jobStatus={jobCard?.status}
                        onReserve={(payload) =>
                            runAction(
                                () => reserveJobPart(numericJobId, payload),
                                'Part reserved against the job card.'
                            )
                        }
                        onIssue={(payload) =>
                            runAction(
                                () => issueJobPart(numericJobId, payload),
                                'Part issued against the job card.'
                            )
                        }
                        onReturnCore={(payload) =>
                            runAction(
                                () => returnJobCore(numericJobId, payload),
                                'Core return logged.'
                            )
                        }
                        onUpdateStatus={(nextStatus) =>
                            runAction(
                                async () => {
                                    const result = await updateJobStatus(numericJobId, nextStatus);
                                    setJobCard(result);
                                    return result;
                                },
                                `Job card moved to ${nextStatus}.`
                            )
                        }
                    />
                    <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
                        <div>
                            <h2 className="text-base font-semibold">AI image inspection</h2>
                            <p className="mt-1 text-xs text-slate-400">
                                Treat extracted codes and part matches as suggestions for staff review.
                            </p>
                        </div>
                        <label className="block text-xs text-slate-300" htmlFor="garage-ai-mode">
                            Analysis type
                        </label>
                        <select
                            id="garage-ai-mode"
                            value={aiMode}
                            onChange={(event) => setAiMode(event.target.value)}
                            className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                        >
                            <option value="FAULT_CODE">Fault / diagnostic display</option>
                            <option value="PART_LABEL">Part label</option>
                        </select>
                        <label className="block text-xs text-slate-300" htmlFor="garage-ai-image">
                            Diagnostic or part image
                        </label>
                        <input
                            id="garage-ai-image"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handleAnalyzeImage}
                            disabled={aiBusy}
                            className="w-full text-sm text-slate-300 file:mr-3 file:rounded file:border-0 file:bg-emerald-700 file:px-3 file:py-2 file:font-semibold file:text-white"
                        />
                        {aiBusy && <p className="text-sm text-emerald-300">Analyzing image...</p>}
                        {aiResult && (
                            <div className="space-y-2 border-t border-slate-700 pt-3">
                                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-slate-950 p-3 text-xs text-slate-200">
                                    {JSON.stringify(aiResult.extraction, null, 2)}
                                </pre>
                                {aiResult.matched_inventory?.length > 0 && (
                                    <ul className="space-y-1 text-xs text-slate-300">
                                        {aiResult.matched_inventory.map((item) => (
                                            <li key={item.id}>
                                                {item.sku} · {item.part_name} · available {item.qty_available}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </section>
                    <QuotePreviewModal quote={quote} onClose={() => setQuote(null)} />
                </aside>
            </div>
        </main>
    );
}
