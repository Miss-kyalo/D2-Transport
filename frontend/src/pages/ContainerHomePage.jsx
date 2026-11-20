import { Link } from 'react-router-dom';
import depotImage from '../assets/difan-depot-service.png';
import './ContainerHomePage.css';

const services = [
    {
        number: '01',
        label: 'MOVEMENT',
        title: 'Gate-in & gate-out',
        description: 'Record container movements, truck details, seals, inspections, and interchange references.'
    },
    {
        number: '02',
        label: 'CONDITION',
        title: 'Cleaning & compliance',
        description: 'Keep cleaning, sanitation, biosecurity, and release requirements visible in the workflow.'
    },
    {
        number: '03',
        label: 'EQUIPMENT',
        title: 'Container records',
        description: 'Keep condition, yard location, and inspection history together for each container.'
    },
    {
        number: '04',
        label: 'REPORTING',
        title: 'CODECO reporting',
        description: 'Prepare movement messages for shipping partners from recorded gate activity.'
    }
];

const workflow = [
    {
        number: '01',
        title: 'Receive',
        description: 'Capture gate-in details, truck information, seals, and the container’s arrival condition.'
    },
    {
        number: '02',
        title: 'Process',
        description: 'Keep inspections, cleaning, and compliance checks attached to the container record.'
    },
    {
        number: '03',
        title: 'Release',
        description: 'Record gate-out activity and prepare a clear movement record for the next handoff.'
    }
];

export default function ContainerHomePage() {
    return (
        <main className="container-home" id="top">
            <header className="container-home__header">
                <Link to="/" className="container-home__brand" aria-label="Difan Logistics home">
                    <span className="container-home__brand-mark" aria-hidden="true">d.</span>
                    <span className="container-home__brand-name">
                        <strong>Difan</strong>
                        <small>LOGISTICS</small>
                    </span>
                </Link>

                <nav className="container-home__nav" aria-label="Container yard navigation">
                    <a href="#yard-services">Yard services</a>
                    <a href="#yard-workflow">How it works</a>
                    <Link to="/garage">Garage</Link>
                    <Link to="/">Road freight</Link>
                </nav>

                <Link to="/login" className="container-home__login">
                    Staff portal <span aria-hidden="true">↗</span>
                </Link>
            </header>

            <section className="container-home__hero">
                <div className="container-home__hero-copy">
                    <div className="container-home__eyebrow">
                        <span aria-hidden="true" />
                        TWO CONTAINER YARDS · ATHI RIVER &amp; SYOKIMAU
                    </div>
                    <h1>Containers,<br /><em>handled with care.</em></h1>
                    <p>
                        Our two container yards in Athi River and Syokimau support organized movements,
                        clear inspection records, and compliance workflows for the next leg of the journey.
                    </p>
                    <div className="container-home__hero-actions">
                        <a href="#yard-services" className="container-home__button">
                            Explore yard services <span aria-hidden="true">↓</span>
                        </a>
                        <Link to="/login" className="container-home__text-link">
                            Staff portal <span aria-hidden="true">↗</span>
                        </Link>
                    </div>
                    <div className="container-home__hero-footnote">
                        <span>01</span> / YARD OPERATIONS, MADE VISIBLE
                    </div>
                </div>

                <figure className="container-home__hero-image">
                    <img
                        src={depotImage}
                        alt="Container handler and truck working at an inland container yard near Athi River"
                        fetchPriority="high"
                    />
                    <figcaption>
                        <span>ATHI RIVER, KENYA</span>
                        <span>Container operations</span>
                    </figcaption>
                    <div className="container-home__image-tag">
                        <span aria-hidden="true">↗</span>
                        <span><small>INLAND SUPPORT</small><strong>From gate to release</strong></span>
                    </div>
                </figure>
            </section>

            <section className="container-home__overview" aria-label="Container yard locations">
                <p>OUR CONTAINER YARDS</p>
                <div><span>01</span> Athi River</div>
                <div><span>02</span> Syokimau</div>
            </section>

            <section className="container-home__services" id="yard-services">
                <div className="container-home__section-heading">
                    <div>
                        <div className="container-home__eyebrow">
                            <span aria-hidden="true" />
                            YARD SERVICES
                        </div>
                        <h2>Every container.<br />A clearer record.</h2>
                    </div>
                    <p>
                        Practical yard operations supported by structured records—from the moment a
                        container arrives to its next move.
                    </p>
                </div>

                <div className="container-home__service-grid">
                    {services.map((service) => (
                        <article className="container-home__service" key={service.number}>
                            <div className="container-home__service-top">
                                <span>{service.number}</span>
                                <span className="container-home__service-dot" aria-hidden="true" />
                            </div>
                            <span className="container-home__service-label">{service.label}</span>
                            <h3>{service.title}</h3>
                            <p>{service.description}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="container-home__workflow" id="yard-workflow">
                <div className="container-home__workflow-heading">
                    <div className="container-home__eyebrow">
                        <span aria-hidden="true" />
                        THE YARD FLOW
                    </div>
                    <h2>Good handoffs<br />start with good records.</h2>
                    <p>Follow each movement through a simple, traceable sequence.</p>
                </div>
                <div className="container-home__workflow-steps">
                    {workflow.map((step) => (
                        <article className="container-home__workflow-step" key={step.number}>
                            <span className="container-home__workflow-number">{step.number}</span>
                            <h3>{step.title}</h3>
                            <p>{step.description}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="container-home__network">
                <div>
                    <span className="container-home__network-label">CONNECTED BY DIFAN LOGISTICS</span>
                    <h2>A yard that fits the bigger journey.</h2>
                    <p>Connect our Athi River and Syokimau yards with nationwide heavy road freight.</p>
                </div>
                <Link to="/" className="container-home__button container-home__button--light">
                    Explore road freight <span aria-hidden="true">↗</span>
                </Link>
            </section>

            <footer className="container-home__footer">
                <Link to="/" className="container-home__footer-brand">Difan Logistics</Link>
                <span>Container Yards · Athi River &amp; Syokimau</span>
                <a href="#top">BACK TO TOP ↑</a>
            </footer>
        </main>
    );
}
