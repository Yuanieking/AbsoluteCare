import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import AppLoader from "../../components/loading/AppLoader";
import Logo from "../../components/brand/Logo";

const benefits = [
  {
    icon: "01",
    title: "Book faster",
    text: "Request a session without phone tag or a long wait for the calendar.",
  },
  {
    icon: "02",
    title: "The right specialist",
    text: "Tell us what you need and we will help match you with the right care.",
  },
  {
    icon: "03",
    title: "Keep treatment moving",
    text: "Plan consistent sessions around recovery goals, school, and family life.",
  },
  {
    icon: "04",
    title: "Fits real life",
    text: "Choose a preferred time that works with your workday or school run.",
  },
];

const services = [
  {
    number: "A",
    title: "Physical Therapy & Rehabilitation",
    description:
      "Restore movement, reduce pain, and build confidence after injury or illness.",
    items: [
      "Post-op and sports injury recovery",
      "Stroke and neurological rehabilitation",
      "Low back, neck, shoulder, and knee pain",
      "Scoliosis, joint care, and rheumatic wellness",
    ],
  },
  {
    number: "B",
    title: "Pediatric Occupational Therapy",
    description:
      "Practical support for children ages 1–18 as they learn, play, and grow.",
    items: [
      "ADL and self-care skill-building",
      "School readiness, handwriting, and focus",
      "Behavioral and social development",
      "Fine motor, gross motor, and sensory integration",
    ],
  },
];

const steps = [
  ["Choose a service", "Tell us whether you need PT or pediatric OT."],
  ["Pick a date and time", "Share the appointment window that suits you."],
  ["Confirm your details", "Add your contact information and a brief note."],
  ["Get confirmation", "Our team will reply with a clear appointment time."],
];

function LandingPage() {
  const { user, loading } = useAuth();

  if (loading) return <AppLoader />;

  if (user) {
    const dashboardPath =
      user.role === "admin"
        ? "/staff/admin"
        : user.role === "therapist"
          ? "/staff/therapist"
          : user.role === "secretary"
            ? "/staff/secretary"
            : "/dashboard";

    return <Navigate replace to={dashboardPath} />;
  }

  return (
    <div className="site-shell">
      <header className="topbar">
        <a
          className="landing-logo-link"
          href="#top"
          aria-label="AbsoluteCare Therapy Center home"
        >
          <Logo variant="mark" tone="dark" size="md" to={null} />
        </a>
        <nav className="nav-links" aria-label="Main navigation">
          <a href="#services">Services</a>
          <a href="#how-it-works">How it works</a>
          <a href="#visit">Visit us</a>
        </nav>
        <div className="auth-nav">
          <a href="/login">Log in</a>
          <a className="nav-cta" href="/signup">
            Book an appointment <span aria-hidden="true">↗</span>
          </a>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="eyebrow-dot" /> Care that moves with you
            </p>
            <h1>
              Start moving toward your <em>better day.</em>
            </h1>
            <p className="hero-text">
              Book physical therapy or pediatric occupational therapy in
              Malaybalay City with a simple request and a real person on the
              other end.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="/signup">
                Book an appointment <span aria-hidden="true">↗</span>
              </a>
              <a className="text-link" href="#services">
                Explore services <span aria-hidden="true">↓</span>
              </a>
            </div>
            <div className="hero-details">
              <div>
                <span className="detail-label">Find us</span>
                <strong>2nd Door, Pinehills Hotel Compound</strong>
                <span>Malaybalay City, Bukidnon</span>
              </div>
              <div>
                <span className="detail-label">Call or text</span>
                <strong>0917 715 2780</strong>
                <span>Globe · 0935 659 4143 TM</span>
              </div>
            </div>
          </div>
          <div className="hero-visual" aria-label="A calm therapy room">
            <div className="sun-disc" />
            <div className="room-line room-line-one" />
            <div className="room-line room-line-two" />
            <div className="therapy-chair">
              <span />
              <i />
            </div>
            <div className="plant">
              <span className="leaf leaf-one" />
              <span className="leaf leaf-two" />
              <span className="leaf leaf-three" />
              <b />
            </div>
            <div className="hero-note">
              <span className="note-kicker">Your next step</span>
              <strong>
                One easy request
                <br />
                gets care moving.
              </strong>
              <span className="note-arrow">↓</span>
            </div>
            <div className="hero-caption">
              A calmer way to begin
              <br />
              <span>AbsoluteCare · Malaybalay</span>
            </div>
          </div>
        </section>

        <section
          className="benefits section-wide"
          aria-labelledby="benefits-title"
        >
          <div className="section-intro">
            <p className="eyebrow">Made for your day</p>
            <h2 id="benefits-title">
              Good care starts
              <br />
              with an easier first step.
            </h2>
          </div>
          <div className="benefit-grid">
            {benefits.map((benefit) => (
              <article className="benefit" key={benefit.title}>
                <span className="benefit-number">{benefit.icon}</span>
                <h3>{benefit.title}</h3>
                <p>{benefit.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          className="services section-wide"
          id="services"
          aria-labelledby="services-title"
        >
          <div className="section-heading">
            <p className="eyebrow">What we can help with</p>
            <h2 id="services-title">
              Care with a clear
              <br />
              place to begin.
            </h2>
            <p>
              Choose the path that sounds closest to what you or your child
              needs today. We can help with the rest.
            </p>
          </div>
          <div className="service-grid">
            {services.map((service) => (
              <article className="service-card" key={service.title}>
                <span className="service-letter">{service.number}</span>
                <h3>{service.title}</h3>
                <p>{service.description}</p>
                <ul>
                  {service.items.map((item) => (
                    <li key={item}>
                      <span aria-hidden="true">+</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <a className="card-link" href="/signup">
                  Get started <span aria-hidden="true">↗</span>
                </a>
              </article>
            ))}
          </div>
        </section>

        <section
          className="process section-wide"
          id="how-it-works"
          aria-labelledby="process-title"
        >
          <div className="process-heading">
            <p className="eyebrow">How scheduling works</p>
            <h2 id="process-title">
              Four small steps.
              <br />
              <em>Less to think about.</em>
            </h2>
          </div>
          <div className="steps">
            {steps.map((step, index) => (
              <article className="step" key={step[0]}>
                <span className="step-index">0{index + 1}</span>
                <h3>{step[0]}</h3>
                <p>{step[1]}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          className="visit section-wide"
          id="visit"
          aria-labelledby="visit-title"
        >
          <div className="map-frame">
            <iframe
              title="Google Map showing Pine Hills Hotel in Malaybalay City"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3949.425643755817!2d125.12060707526672!3d8.159799091870852!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x32ffa98130d6e1ef%3A0xf4940dd0752e33cc!2sPine%20Hills%20Hotel!5e0!3m2!1sen!2sph!4v1790438652307!5m2!1sen!2sph"
              loading="lazy"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
          <div className="visit-copy">
            <p className="eyebrow">Come see us</p>
            <h2 id="visit-title">
              A familiar place
              <br />
              for better movement.
            </h2>
            <p>
              We’re at the 2nd Door inside Pinehills Hotel Compound in
              Malaybalay City, Bukidnon.
            </p>
            <div className="visit-info">
              <div>
                <span>Address</span>
                <strong>
                  2nd Door, Pinehills Hotel Compound
                  <br />
                  Malaybalay City, Bukidnon
                </strong>
              </div>
              <div>
                <span>Reach the clinic</span>
                <strong>
                  0917 715 2780 · Globe
                  <br />
                  0935 659 4143 · TM
                </strong>
              </div>
              <div>
                <span>Hours</span>
                <strong>By appointment</strong>
                <small>Call ahead so we can prepare for you.</small>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-brand">
          <a className="landing-logo-link" href="#top">
            <Logo variant="mark" tone="dark" size="md" to={null} />
          </a>
          <p>
            Helping Malaybalay move
            <br />
            with more ease.
          </p>
        </div>
        <div className="footer-links">
          <a href="#services">Services</a>
          <a href="#how-it-works">How it works</a>
          <a href="/signup">Create your account</a>
        </div>
        <div className="footer-end">
          <span>Malaybalay City, Bukidnon</span>
          <span>© 2026 AbsoluteCare Therapy Center</span>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
