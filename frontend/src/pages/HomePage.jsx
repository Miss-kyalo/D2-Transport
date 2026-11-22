import { useState } from 'react';
import { Link } from 'react-router-dom';
import depotServiceImage from '../assets/difan-depot-service.png';
import freightHeroImage from '../assets/difan-freight-hero.png';
import freightServiceImage from '../assets/difan-freight-service.png';
import './HomePage.css';

export default function HomePage() {
    const [showQuoteModal, setShowQuoteModal] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [inquiry, setInquiry] = useState({
        company: '',
        email: '',
        division: 'Heavy Freight Transport (Nationwide)',
        volume: '',
        notes: ''
    });

    const openQuoteModal = (division = 'Heavy Freight Transport (Nationwide)') => {
        setInquiry((current) => ({ ...current, division }));
        setSubmitted(false);
        setShowQuoteModal(true);
    };

    const handleQuoteSubmit = (event) => {
        event.preventDefault();
        setSubmitted(true);
    };

    return (
        <main className="home-page" id="top">
            <header className="home-header">
                <Link to="/" className="home-brand" aria-label="Difan Logistics home">
                    <span className="home-brand__mark" aria-hidden="true">d.</span>
                    <span className="home-brand__name">
                        <strong>Difan</strong>
                        <small>LOGISTICS</small>
                    </span>
                </Link>

                <nav className="home-nav" aria-label="Main navigation">
                    <a href="#services">What we move</a>
                    <Link to="/container-depot">Container yard</Link>
                    <Link to="/garage">Garage</Link>
                    <Link to="/track">Track a load</Link>
                </nav>

                <div className="home-header__actions">
                    <span className="home-header__location"><span aria-hidden="true" /> Kenya, East Africa</span>
                    <Link to="/login" className="home-login">Staff login <span aria-hidden="true">↗</span></Link>
                </div>
            </header>

            <section className="home-hero">
                <div className="home-hero__copy">
                    <div className="home-eyebrow"><span /> THE ROAD IS OUR MEETING PLACE</div>
                    <h1>Big journeys.<br /><em>Kept in motion.</em></h1>
                    <p>
                        Heavy freight across Kenya, backed by the people and systems that keep every
                        handoff moving.
                    </p>
                    <div className="home-hero__actions">
                        <button
                            type="button"
                            className="home-cta"
                            onClick={() => openQuoteModal()}
                        >
                            Plan your next move <span aria-hidden="true">↗</span>
                        </button>
                        <a href="#services" className="home-text-link">Get to know us <span aria-hidden="true">↓</span></a>
                    </div>
                    <div className="home-hero__index"><span>01</span> / BUILT TO GO FURTHER</div>
                </div>

                <div className="home-hero__visual">
                    <img
                        src={freightHeroImage}
                        alt="Container truck moving freight along a road in East Africa"
                        fetchPriority="high"
                    />
                    <div className="home-route-tag">
                        <span className="home-route-tag__icon" aria-hidden="true">↗</span>
                        <span><small>MADE FOR THE LONG HAUL</small><strong>One connected operation</strong></span>
                    </div>
                    <div className="home-hero__caption">
                        <span>01 — 03</span>
                        <span>Freight that finds its way.</span>
                    </div>
                </div>
            </section>

            <section className="home-proof" aria-label="Difan Logistics at a glance">
                <div className="home-proof__intro">THE WORK, FROM ROAD TO YARD</div>
                <div className="home-proof__item"><strong>01</strong><span>Nationwide<br />heavy haulage</span></div>
                <div className="home-proof__item"><strong>02</strong><span>Container yards<br />Athi River &amp; Syokimau</span></div>
                <div className="home-proof__item"><strong>03</strong><span>Shipment<br />visibility</span></div>
                <div className="home-proof__stamp" aria-hidden="true">KENYA<br /><span>↗</span></div>
            </section>

            <section className="home-services" id="services">
                <div className="home-section-heading">
                    <div>
                        <div className="home-eyebrow"><span /> ONE TEAM. EVERY HANDOFF.</div>
                        <h2>From the open road<br />to the last detail.</h2>
                    </div>
                    <p>Transport, container yards, and garage services—connected for the way business moves in Kenya.</p>
                </div>

                <div className="home-services__grid">
                    <article className="home-service home-service--freight">
                        <div className="home-service__image">
                            <img
                                src={freightServiceImage}
                                alt="Heavy trucks carrying container freight"
                                loading="lazy"
                                decoding="async"
                            />
                            <span className="home-service__number">01 / ROAD</span>
                        </div>
                        <div className="home-service__body">
                            <div>
                                <span className="home-service__eyebrow">NATIONWIDE COVERAGE</span>
                                <h3>Heavy road freight</h3>
                                <p>Reliable transport for dry goods across Kenya, backed by dispatch visibility and fleet compliance.</p>
                            </div>
                            <button
                                type="button"
                                className="home-service__link"
                                onClick={() => openQuoteModal('Heavy Freight Transport (Nationwide)')}
                                aria-label="Request a heavy road freight quote"
                            >↗</button>
                        </div>
                    </article>

                    <article className="home-service home-service--depot">
                        <div className="home-service__image">
                            <img
                                src={depotServiceImage}
                                alt="Container handling at an inland yard near Athi River"
                                loading="lazy"
                                decoding="async"
                            />
                            <span className="home-service__number">02 / YARD</span>
                        </div>
                        <div className="home-service__body">
                            <div>
                                <span className="home-service__eyebrow">ATHI RIVER · SYOKIMAU</span>
                                <h3>Container yards</h3>
                                <p>Container handling, secure storage, movement records and compliance across two yards.</p>
                            </div>
                            <Link to="/container-depot" className="home-service__link" aria-label="Explore container yard services">↗</Link>
                        </div>
                    </article>

                    <article className="home-service home-service--tracking">
                        <div className="home-tracking-art" aria-hidden="true">
                            <div className="home-tracking-art__route">
                                <span className="home-tracking-art__node home-tracking-art__node--start" />
                                <span className="home-tracking-art__line" />
                                <span className="home-tracking-art__node home-tracking-art__node--end">D</span>
                            </div>
                            <span className="home-tracking-art__label home-tracking-art__label--start">LOAD COLLECTED</span>
                            <span className="home-tracking-art__label home-tracking-art__label--end">ON THE MOVE</span>
                            <span className="home-tracking-art__code">DF / TRACKING</span>
                        </div>
                        <div className="home-service__body">
                            <div>
                                <span className="home-service__eyebrow">A CLEARER PICTURE</span>
                                <h3>Know where it stands.</h3>
                                <p>Follow your shipment with public tracking and dispatch updates.</p>
                            </div>
                            <Link to="/track" className="home-service__link" aria-label="Track a shipment">↗</Link>
                        </div>
                    </article>
                </div>

                <aside className="home-garage-callout">
                    <div className="home-garage-callout__copy">
                        <span className="home-service__eyebrow">DIFAN GARAGE</span>
                        <h3>Focused care for heavy vehicles.</h3>
                        <p>Servicing <span>·</span> Diagnostics <span>·</span> Repairs</p>
                    </div>
                    <Link to="/garage" className="home-cta">
                        Explore garage services <span aria-hidden="true">↗</span>
                    </Link>
                </aside>
            </section>

            <section className="home-last-mile">
                <div className="home-last-mile__index">THE NEXT MOVE IS YOURS <span>↘</span></div>
                <div>
                    <h2>Let&apos;s get<br />there together.</h2>
                    <p>Tell us what you need to move. We&apos;ll help map out what comes next.</p>
                </div>
                <button type="button" className="home-cta home-cta--light" onClick={() => openQuoteModal()}>
                    Start a conversation <span aria-hidden="true">↗</span>
                </button>
            </section>

            <footer className="home-footer">
                <Link to="/" className="home-brand home-brand--footer" aria-label="Difan Logistics home">
                    <span className="home-brand__mark" aria-hidden="true">d.</span>
                    <span className="home-brand__name">
                        <strong>Difan</strong>
                        <small>LOGISTICS</small>
                    </span>
                </Link>
                <span>Freight &amp; container operations · Kenya</span>
                <a href="#top">BACK TO TOP ↑</a>
            </footer>

            {showQuoteModal && (
                <div className="home-modal" onMouseDown={(event) => {
                    if (event.target === event.currentTarget) setShowQuoteModal(false);
                }}>
                    <section
                        className="home-modal__dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="home-modal-title"
                    >
                        <button
                            type="button"
                            className="home-modal__close"
                            onClick={() => setShowQuoteModal(false)}
                            aria-label="Close quote request"
                        >×</button>
                        <span className="home-modal__eyebrow">LET&apos;S MAKE A PLAN</span>
                        <h2 id="home-modal-title">Tell us what&apos;s moving.</h2>
                        {submitted ? (
                            <div className="home-modal__success">
                                <span className="home-modal__success-mark" aria-hidden="true">✓</span>
                                <p>
                                    Inquiry logged for <strong>{inquiry.company || 'your organization'}</strong> ({inquiry.division}).
                                    Our operations desk will follow up with rate and compliance details.
                                </p>
                                <button type="button" className="home-cta" onClick={() => setShowQuoteModal(false)}>
                                    Done <span aria-hidden="true">↗</span>
                                </button>
                            </div>
                        ) : (
                            <form className="home-modal__form" onSubmit={handleQuoteSubmit}>
                                <label>
                                    <span>Company or shipping line</span>
                                    <input
                                        type="text"
                                        required
                                        autoComplete="organization"
                                        placeholder="Your company name"
                                        value={inquiry.company}
                                        onChange={(event) => setInquiry({ ...inquiry, company: event.target.value })}
                                    />
                                </label>
                                <label>
                                    <span>Work email</span>
                                    <input
                                        type="email"
                                        required
                                        autoComplete="email"
                                        placeholder="you@company.com"
                                        value={inquiry.email}
                                        onChange={(event) => setInquiry({ ...inquiry, email: event.target.value })}
                                    />
                                </label>
                                <label>
                                    <span>What do you need?</span>
                                    <select
                                        value={inquiry.division}
                                        onChange={(event) => setInquiry({ ...inquiry, division: event.target.value })}
                                    >
                                        <option value="Heavy Freight Transport (Nationwide)">Heavy freight transport</option>
                                        <option value="Container Depot (ISO / CODECO / Storage)">Container depot</option>
                                        <option value="Combined Depot + Transport Package">Freight + depot</option>
                                    </select>
                                </label>
                                <label>
                                    <span>Estimated monthly volume <small>(optional)</small></span>
                                    <input
                                        type="text"
                                        placeholder="e.g. 10 loads or 150 TEUs"
                                        value={inquiry.volume}
                                        onChange={(event) => setInquiry({ ...inquiry, volume: event.target.value })}
                                    />
                                </label>
                                <label>
                                    <span>Anything else? <small>(optional)</small></span>
                                    <textarea
                                        rows={3}
                                        placeholder="Routes, timing, or special requirements"
                                        value={inquiry.notes}
                                        onChange={(event) => setInquiry({ ...inquiry, notes: event.target.value })}
                                    />
                                </label>
                                <button type="submit" className="home-cta">
                                    Send inquiry <span aria-hidden="true">↗</span>
                                </button>
                            </form>
                        )}
                    </section>
                </div>
            )}
        </main>
    );
}
