import { Link } from 'react-router-dom';
import './GarageHomePage.css';

const services = [
    {
        number: '01',
        title: 'Servicing',
        description: 'Routine servicing for heavy vehicles, helping keep your fleet prepared for the road.'
    },
    {
        number: '02',
        title: 'Diagnostics',
        description: 'Vehicle diagnostics to help identify faults and guide the next step.'
    },
    {
        number: '03',
        title: 'Repairs',
        description: 'Repairs for heavy vehicles, focused on addressing the issues that keep a truck from moving.'
    },
    {
        number: '04',
        title: 'Trailer builds',
        description: 'Trailer builds for commercial and fleet use.'
    }
];

export default function GarageHomePage() {
    return (
        <main className="garage-page" id="top">
            <header className="garage-page__header">
                <Link to="/" className="garage-page__brand" aria-label="Difan Logistics home">
                    <span className="garage-page__brand-mark" aria-hidden="true">d.</span>
                    <span className="garage-page__brand-name">
                        <strong>Difan</strong>
                        <small>LOGISTICS</small>
                    </span>
                </Link>

                <nav className="garage-page__nav" aria-label="Garage navigation">
                    <a href="#garage-services">Garage services</a>
                    <Link to="/container-depot">Container yards</Link>
                    <Link to="/">Road freight</Link>
                </nav>

                <Link to="/login" className="garage-page__login">
                    Staff portal <span aria-hidden="true">↗</span>
                </Link>
            </header>

            <section className="garage-page__hero">
                <div className="garage-page__hero-copy">
                    <div className="garage-page__eyebrow">
                        <span aria-hidden="true" />
                        DIFAN GARAGE · HEAVY VEHICLES
                    </div>
                    <h1>Fleet ready.<br /><em>Garage care.</em></h1>
                    <p>
                        Heavy vehicle servicing, diagnostics, and repairs—plus trailer builds.
                    </p>
                    <div className="garage-page__hero-actions">
                        <a href="#garage-services" className="garage-page__button">
                            Explore garage services <span aria-hidden="true">↓</span>
                        </a>
                        <Link to="/" className="garage-page__text-link">
                            Explore Difan <span aria-hidden="true">↗</span>
                        </Link>
                    </div>
                    <div className="garage-page__hero-note"><span>04</span> / FOCUSED FLEET CARE</div>
                </div>

                <div className="garage-page__visual" aria-hidden="true">
                    <div className="garage-page__visual-top">
                        <span>HEAVY VEHICLE CARE</span>
                        <span>DF / 04</span>
                    </div>
                    <svg className="garage-page__truck" viewBox="0 0 720 460" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <linearGradient id="garage-container" x1="120" y1="150" x2="470" y2="330" gradientUnits="userSpaceOnUse">
                                <stop stopColor="#C5E77B" />
                                <stop offset="1" stopColor="#A8D05D" />
                            </linearGradient>
                            <linearGradient id="garage-cab" x1="475" y1="230" x2="626" y2="355" gradientUnits="userSpaceOnUse">
                                <stop stopColor="#F4F3E9" />
                                <stop offset="1" stopColor="#D8E0CD" />
                            </linearGradient>
                        </defs>
                        <circle cx="365" cy="236" r="189" stroke="#E7F1D8" strokeOpacity=".12" />
                        <circle cx="365" cy="236" r="145" stroke="#E7F1D8" strokeOpacity=".1" />
                        <path d="M72 359H652" stroke="#C1D0BD" strokeOpacity=".45" />
                        <path d="M119 170H473V326H119V170Z" fill="url(#garage-container)" />
                        <path d="M147 171V326M184 171V326M221 171V326M258 171V326M295 171V326M332 171V326M369 171V326M406 171V326M443 171V326" stroke="#224B35" strokeOpacity=".28" />
                        <path d="M473 236H557L621 299V326H473V236Z" fill="url(#garage-cab)" />
                        <path d="M496 251H550L592 291H496V251Z" fill="#72927B" />
                        <path d="M473 308H620" stroke="#194733" strokeOpacity=".36" strokeWidth="4" />
                        <path d="M110 326H637" stroke="#B9DF73" strokeWidth="8" />
                        <circle cx="204" cy="336" r="34" fill="#102B20" />
                        <circle cx="204" cy="336" r="14" fill="#B7C7A9" />
                        <circle cx="427" cy="336" r="34" fill="#102B20" />
                        <circle cx="427" cy="336" r="14" fill="#B7C7A9" />
                        <circle cx="557" cy="336" r="34" fill="#102B20" />
                        <circle cx="557" cy="336" r="14" fill="#B7C7A9" />
                        <path d="M91 357H654" stroke="#E2EADB" strokeOpacity=".2" strokeDasharray="5 9" />
                    </svg>
                    <div className="garage-page__visual-caption">
                        <span>KEEPING FLEETS MOVING</span>
                        <span>Servicing · Diagnostics · Repairs · Trailer builds</span>
                    </div>
                    <div className="garage-page__visual-badge">
                        <span className="garage-page__visual-badge-icon" aria-hidden="true">↗</span>
                        <span><small>FOUR SERVICE AREAS</small><strong>Focused fleet care</strong></span>
                    </div>
                </div>
            </section>

            <section className="garage-page__service-section" id="garage-services">
                <div className="garage-page__section-heading">
                    <div>
                        <div className="garage-page__eyebrow">
                            <span aria-hidden="true" />
                            GARAGE SERVICES
                        </div>
                        <h2>Focused care.<br />No extra noise.</h2>
                    </div>
                    <p>Servicing, diagnostics, repairs, and trailer builds for heavy vehicles and fleets.</p>
                </div>

                <div className="garage-page__service-grid">
                    {services.map((service) => (
                        <article className="garage-page__service" key={service.number}>
                            <div className="garage-page__service-number">{service.number}</div>
                            <span className="garage-page__service-marker" aria-hidden="true" />
                            <h3>{service.title}</h3>
                            <p>{service.description}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="garage-page__network">
                <div>
                    <span className="garage-page__network-label">PART OF DIFAN LOGISTICS</span>
                    <h2>Garage care, alongside the journey.</h2>
                    <p>Explore Difan’s road freight and container yard services.</p>
                </div>
                <div className="garage-page__network-actions">
                    <Link to="/" className="garage-page__button garage-page__button--light">
                        Road freight <span aria-hidden="true">↗</span>
                    </Link>
                    <Link to="/container-depot" className="garage-page__network-link">
                        Container yards <span aria-hidden="true">↗</span>
                    </Link>
                </div>
            </section>

            <footer className="garage-page__footer">
                <Link to="/" className="garage-page__footer-brand">Difan Logistics</Link>
                <span>Garage · Servicing · Diagnostics · Repairs · Trailer builds</span>
                <a href="#top">BACK TO TOP ↑</a>
            </footer>
        </main>
    );
}
