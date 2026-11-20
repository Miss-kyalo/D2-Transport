import { Link } from 'react-router-dom';
import depotImage from '../assets/difan-depot-service.png';
import './HomePage.css';
import './ContainerHomePage.css';

const services = [
    {
        title: 'Gate-In and Gate-Out',
        description: 'Record container movements, inspections, truck details, seals, and equipment interchange references.'
    },
    {
        title: 'Cleaning and Compliance',
        description: 'Track cleaning, sanitation, biosecurity, customs holds, and release requirements.'
    },
    {
        title: 'Container Records',
        description: 'Maintain container condition, yard location, inspection history, and movement records.'
    },
    {
        title: 'Operational Reporting',
        description: 'Prepare CODECO movement messages from recorded gate activity for shipping partners.'
    }
];

export default function ContainerHomePage() {
    return (
        <main className="container-home">
            <header className="container-home__header">
                <div className="container-home__header-inner">
                    <div>
                        <strong>Difan Logistics</strong>
                        <span>Inland Container Yard · Athi River</span>
                    </div>
                    <Link to="/login" className="container-home__login">Login</Link>
                </div>
            </header>

            <section className="home-hero container-hero">
                <img
                    className="home-hero__image"
                    src={depotImage}
                    alt="Inland container yard near Athi River with a container handler and truck"
                    fetchPriority="high"
                />
                <div className="home-hero__overlay" aria-hidden="true" />
                <div className="home-hero__content">
                    <div className="home-badge">INLAND CONTAINER YARD · ATHI RIVER</div>
                    <h1 className="home-hero__title">Container handling and compliance, close to your road freight.</h1>
                    <p className="home-hero__subtitle">
                        An inland yard supporting shippers with organized container movements, inspection records,
                        cleaning workflows, and compliance checks near Athi River.
                    </p>
                    <div className="home-hero__actions">
                        <Link to="/login" className="home-button home-button--primary">
                            Staff Portal Login
                        </Link>
                        <Link to="/" className="home-button home-button--secondary">
                            Explore Road Freight
                        </Link>
                    </div>
                </div>
            </section>

            <section className="container-home__services">
                <div className="home-section-heading">
                    <span>Container yard services</span>
                    <h2>Clear records at every stage of the container movement.</h2>
                </div>
                <div className="container-home__service-grid">
                    {services.map((service) => (
                        <article className="container-home__service" key={service.title}>
                            <span aria-hidden="true" />
                            <h3>{service.title}</h3>
                            <p>{service.description}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="container-home__transport">
                <div>
                    <span>Part of the Difan Logistics network</span>
                    <h2>Need the transport side too?</h2>
                    <p>Explore our nationwide heavy road freight services and fleet operations.</p>
                </div>
                <Link to="/" className="home-button home-button--primary">
                    Difan Road Freight
                </Link>
            </section>

            <footer className="container-home__footer">
                Difan Logistics · Inland Container Yard · Athi River, Kenya
            </footer>
        </main>
    );
}
