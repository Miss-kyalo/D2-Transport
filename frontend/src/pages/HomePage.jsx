import { useState } from 'react';
import { Link } from 'react-router-dom';
import depotServiceImage from '../assets/difan-depot-service.png';
import freightHeroImage from '../assets/difan-freight-hero.png';
import freightServiceImage from '../assets/difan-freight-service.png';
import './HomePage.css';

const COPY = {
    en: {
        badge: 'KENYA-WIDE ROAD FREIGHT • INLAND DEPOT SUPPORT',
        heroTitle: 'Reliable Heavy Freight Across Kenya.',
        heroSubtitle:
            'Nationwide heavy freight backed by compliant fleet operations and shipment visibility, with inland container support near Athi River.',
        primaryCta: 'Explore Road Freight',
        secondaryCta: 'Explore Container Depot',
        quoteCta: 'Request Freight or Depot Quote',
        modalTitle: 'Request a Transport or Container Depot Quote'
    }
};

export default function HomePage() {
    const [showQuoteModal, setShowQuoteModal] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [inquiry, setInquiry] = useState({
        company: '',
        email: '',
        division: 'Container Depot (ISO / CODECO / Storage)',
        volume: '',
        notes: ''
    });

    const t = COPY.en;

    const handleQuoteSubmit = (e) => {
        e.preventDefault();
        setSubmitted(true);
    };

    return (
        <div style={{ fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#0b1120', color: '#f8fafc', minHeight: '100vh' }}>
            <header style={{ borderBottom: '1px solid rgba(148,163,184,0.16)', backgroundColor: '#0f172a' }}>
                <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <strong style={{ display: 'block', fontSize: '20px', letterSpacing: '0.04em' }}>Difan Logistics</strong>
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>Freight &amp; Container Depot Operations</span>
                    </div>
                    <Link
                        to="/login"
                        style={{
                            padding: '8px 16px',
                            borderRadius: '6px',
                            backgroundColor: '#10b981',
                            color: '#052e16',
                            fontWeight: 700,
                            textDecoration: 'none'
                        }}
                    >
                        Login
                    </Link>
                </div>
            </header>

            <section className="home-hero">
                <img
                    className="home-hero__image"
                    src={freightHeroImage}
                    alt="Container truck traveling through East Africa"
                    fetchPriority="high"
                />
                <div className="home-hero__overlay" aria-hidden="true" />
                <div className="home-hero__content">
                    <div className="home-badge">{t.badge}</div>
                    <h1 className="home-hero__title">{t.heroTitle}</h1>
                    <p className="home-hero__subtitle">{t.heroSubtitle}</p>
                    <div className="home-hero__actions">
                        <a href="#transport" className="home-button home-button--primary">
                            {t.primaryCta}
                        </a>
                        <Link to="/container-depot" className="home-button home-button--secondary">
                            {t.secondaryCta}
                        </Link>
                        <button
                            type="button"
                            className="home-button home-button--outline"
                            onClick={() => {
                                setSubmitted(false);
                                setShowQuoteModal(true);
                            }}
                        >
                            {t.quoteCta}
                        </button>
                    </div>
                </div>
            </section>

            <section className="home-highlights" aria-label="Operational capabilities">
                <div className="home-highlight">
                    <strong>Kenya-wide Haulage</strong>
                    <span>Heavy freight services available across Kenya</span>
                </div>
                <div className="home-highlight">
                    <strong>Shipment Visibility</strong>
                    <span>Dispatch updates and public tracking for every load</span>
                </div>
                <div className="home-highlight">
                    <strong>Compliant Fleet</strong>
                    <span>Vehicle records and expiry checks for safer operations</span>
                </div>
                <div className="home-highlight">
                    <strong>Inland Yard</strong>
                    <span>Container handling and compliance near Athi River</span>
                </div>
            </section>

            <section className="home-services">
                <div className="home-section-heading">
                    <span>Our transport services</span>
                    <h2>Nationwide road freight, with inland depot support.</h2>
                </div>
                <div className="home-services__grid">
                    <article className="home-service-card home-service-card--transport" id="transport">
                        <img
                            src={freightServiceImage}
                            alt="Heavy trucks transporting container freight on an East African highway"
                            loading="lazy"
                            decoding="async"
                        />
                        <div className="home-service-card__content">
                            <span className="home-service-card__eyebrow">Core service · Nationwide road freight</span>
                            <h3>Heavy Road Freight</h3>
                            <p>Reliable heavy haulage available nationwide across Kenya, supported by dispatch visibility and compliant fleet operations.</p>
                            <div className="home-service-card__features">
                                <span>Nationwide coverage</span>
                                <span>Fleet compliance</span>
                                <span>Shipment visibility</span>
                            </div>
                            <Link to="/admin" className="home-service-card__link">
                                Go to Transport Dispatch <span aria-hidden="true">→</span>
                            </Link>
                        </div>
                    </article>
                    <article className="home-service-card home-service-card--depot">
                        <img
                            src={depotServiceImage}
                            alt="Inland container yard near Athi River with a container handler and truck"
                            loading="lazy"
                            decoding="async"
                        />
                        <div className="home-service-card__content">
                            <span className="home-service-card__eyebrow">Supporting service · Athi River</span>
                            <h3>Inland Container Yard</h3>
                            <p>Container handling and compliance near Athi River, complementing our nationwide road freight.</p>
                            <Link to="/container-depot" className="home-service-card__link">
                                Explore Container Services <span aria-hidden="true">→</span>
                            </Link>
                        </div>
                    </article>
                </div>
            </section>

            {/* Footer */}
            <footer style={{ maxWidth: '1240px', margin: '0 auto', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', color: '#94a3b8', fontSize: '13px' }}>
                <div>Difan Logistics · Nationwide road freight across Kenya</div>
                <div>Inland container yard near Athi River</div>
            </footer>

            {/* Quote / Principal Inquiry Modal */}
            {showQuoteModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(2,6,23,0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px', zIndex: 50 }}>
                    <div style={{ backgroundColor: '#111827', border: '1px solid #334155', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '480px', color: '#f8fafc' }}>
                        <h3 style={{ marginTop: 0 }}>{t.modalTitle}</h3>
                        {submitted ? (
                            <div>
                                <p style={{ color: '#6ee7b7', lineHeight: 1.6 }}>
                                    Inquiry logged for <strong>{inquiry.company || 'your organization'}</strong> ({inquiry.division}). Our operations desk will follow up with rate and compliance details.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setShowQuoteModal(false)}
                                    style={{ padding: '8px 16px', backgroundColor: '#10b981', color: '#052e16', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
                                >
                                    Done
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleQuoteSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <input
                                    type="text"
                                    required
                                    placeholder="Company / Shipping Line Name"
                                    value={inquiry.company}
                                    onChange={(e) => setInquiry({ ...inquiry, company: e.target.value })}
                                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff' }}
                                />
                                <input
                                    type="email"
                                    required
                                    placeholder="Work Email"
                                    value={inquiry.email}
                                    onChange={(e) => setInquiry({ ...inquiry, email: e.target.value })}
                                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff' }}
                                />
                                <select
                                    value={inquiry.division}
                                    onChange={(e) => setInquiry({ ...inquiry, division: e.target.value })}
                                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff' }}
                                >
                                    <option value="Container Depot (ISO / CODECO / Storage)">Container Depot (ISO / CODECO / Storage)</option>
                                    <option value="Heavy Freight Transport (Nationwide)">Heavy Freight Transport (Nationwide)</option>
                                    <option value="Combined Depot + Transport Package">Combined Depot + Transport Package</option>
                                </select>
                                <input
                                    type="text"
                                    placeholder="Estimated Monthly TEUs / Loads (e.g., 150 TEUs/mo)"
                                    value={inquiry.volume}
                                    onChange={(e) => setInquiry({ ...inquiry, volume: e.target.value })}
                                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff' }}
                                />
                                <textarea
                                    rows={3}
                                    placeholder="Service coverage, cleaning/KEPHIS needs, or billing currency (USD/EUR/KES)..."
                                    value={inquiry.notes}
                                    onChange={(e) => setInquiry({ ...inquiry, notes: e.target.value })}
                                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff' }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
                                    <button type="button" onClick={() => setShowQuoteModal(false)} style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #475569', background: 'transparent', color: '#cbd5e1', cursor: 'pointer' }}>
                                        Cancel
                                    </button>
                                    <button type="submit" style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#10b981', color: '#052e16', fontWeight: 700, cursor: 'pointer' }}>
                                        Submit Request
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}