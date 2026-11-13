import { useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowDown, ArrowUpRight, Check, MapPin, Menu, Phone, X } from 'lucide-react'
import Logo from '@/components/brand/Logo'
import AppLoader from '@/components/feedback/AppLoader'
import { AddressMapPreview } from '@/components/form/AddressMapPreview'
import { useAuth } from '@/features/auth/session'
import { useSettings } from '@/features/settings/provider'
import { HeroRoom } from './HeroRoom'
import './landing.css'

const services = [
  {
    id: 'physical-therapy',
    title: 'Move with more confidence.',
    name: 'Physical therapy & rehabilitation',
    description:
      'Care for the movements that make up your day. Work toward less pain, greater mobility, and a return to the things you enjoy.',
    items: [
      'Post-operative & sports injury recovery',
      'Stroke & neurological rehabilitation',
      'Back, neck, shoulder & knee pain',
      'Scoliosis, joint care & rheumatic wellness',
    ],
    cta: 'Request physical therapy',
    note: 'Movement. Recovery. Everyday life.',
  },
  {
    id: 'pediatric-therapy',
    title: 'Little steps. Everyday possibilities.',
    name: 'Pediatric occupational therapy',
    description:
      'Support for children ages 1–18 as they learn, play, and grow. Build practical skills that help your child take part in everyday life.',
    items: [
      'Daily living & self-care skills',
      'School readiness, handwriting & focus',
      'Behavioral & social development',
      'Motor skills & sensory integration',
    ],
    cta: 'Request pediatric OT',
    note: 'Learning. Play. Growing independence.',
  },
]

const steps = [
  ['Choose your care', 'Select physical therapy or pediatric occupational therapy.'],
  ['Find a time', 'Choose your preferred appointment date and time.'],
  ['Tell us about you', 'Share your contact details and what you need help with.'],
  ['Hear from our team', 'Wait for the clinic to confirm your appointment.'],
]

// Preserve the existing clinic location and integration-controlled map.
const clinicLocation = { lat: 8.159799091870852, lng: 125.12060707526672 }
const clinicAddress = '2nd Door, Pinehills Hotel Compound, Malaybalay City, Bukidnon'
const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${clinicLocation.lat},${clinicLocation.lng}`

function LandingHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <header
      className="care-header care-container"
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !menuOpen) return
        closeMenu()
        menuButton.current?.focus()
      }}
    >
      <a className="care-brand" href="#top" aria-label="AbsoluteCare Therapy Center home">
        <Logo variant="mark" size="md" to={null} />
        <span>
          AbsoluteCare<small>Therapy Center</small>
        </span>
      </a>
      <nav className="care-desktop-nav" aria-label="Main navigation">
        <a href="#services">Our services</a>
        <a href="#how-it-works">Your first visit</a>
        <a href="#visit">Find the clinic</a>
      </nav>
      <div className="care-header-actions">
        <Link className="care-login" to="/login">
          Log in
        </Link>
        <Link className="care-button care-button-small" to="/signup">
          Request a visit
        </Link>
        <button
          className="care-menu-button"
          type="button"
          ref={menuButton}
          aria-expanded={menuOpen}
          aria-controls="care-mobile-nav"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={19} aria-hidden="true" /> : <Menu size={19} aria-hidden="true" />}
          <span>{menuOpen ? 'Close' : 'Menu'}</span>
        </button>
      </div>
      <nav
        id="care-mobile-nav"
        className="care-mobile-nav"
        aria-label="Mobile navigation"
        hidden={!menuOpen}
      >
        <a href="#services" onClick={closeMenu}>
          Our services
        </a>
        <a href="#how-it-works" onClick={closeMenu}>
          Your first visit
        </a>
        <a href="#visit" onClick={closeMenu}>
          Find the clinic
        </a>
        <Link to="/login" onClick={closeMenu}>
          Log in to your account
        </Link>
        <Link to="/signup" onClick={closeMenu}>
          Request a visit
        </Link>
      </nav>
    </header>
  )
}

function ServicesSection() {
  return (
    <section
      id="services"
      className="care-services care-container"
      aria-labelledby="services-title"
    >
      <div className="care-section-heading">
        <div>
          <p className="care-label">Our services</p>
          <h2 id="services-title">
            Different needs.
            <br />
            The same thoughtful care.
          </h2>
        </div>
        <p>
          For your recovery or your child’s development, find a place to begin. We’ll help you take
          the next step.
        </p>
      </div>
      <div className="care-service-grid">
        {services.map((service) => (
          <article
            id={service.id}
            className={`care-service care-service-${service.id}`}
            key={service.id}
          >
            <p className="care-service-name">{service.name}</p>
            <h3>{service.title}</h3>
            <p className="care-service-description">{service.description}</p>
            <ul>
              {service.items.map((item) => (
                <li key={item}>
                  <Check size={16} strokeWidth={1.8} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="care-service-bottom">
              <Link className="care-text-link" to="/signup">
                {service.cta}
                <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
              <span>{service.note}</span>
            </div>
          </article>
        ))}
      </div>
      <p className="care-service-help">
        Not sure which service fits?{' '}
        <a href="tel:+639177152780">Call our team and talk it through.</a>
      </p>
    </section>
  )
}

function FirstVisitSection() {
  return (
    <section id="how-it-works" className="care-first-visit" aria-labelledby="first-visit-title">
      <div className="care-container care-first-visit-layout">
        <div className="care-first-visit-intro">
          <p className="care-label">Your first visit starts here</p>
          <h2 id="first-visit-title">
            You don’t need to have
            <br />
            it all figured out.
          </h2>
          <p>
            A little information is enough to start. Request a visit online, and our team will
            confirm the details with you.
          </p>
          <Link className="care-button" to="/signup">
            Request a visit
          </Link>
          <p className="care-booking-note">
            Already have an account? <Link to="/login">Log in to book.</Link>
          </p>
        </div>
        <ol className="care-steps">
          {steps.map(([title, description], index) => (
            <li key={title}>
              <span className="care-step-number" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function VisitSection({ mapEnabled }: { mapEnabled: boolean }) {
  return (
    <section id="visit" className="care-visit care-container" aria-labelledby="visit-title">
      <div className="care-visit-details">
        <p className="care-label">Here in Malaybalay</p>
        <h2 id="visit-title">
          Closer to home.
          <br />
          Ready when you are.
        </h2>
        <p>
          Find us inside Pinehills Hotel Compound. Visits are by appointment, so call ahead and
          we’ll help you plan yours.
        </p>
        <address className="care-contact-list">
          <div>
            <MapPin size={20} aria-hidden="true" />
            <div>
              <strong>Come see us</strong>
              <span>
                2nd Door, Pinehills Hotel Compound
                <br />
                Malaybalay City, Bukidnon
              </span>
            </div>
          </div>
          <div>
            <Phone size={20} aria-hidden="true" />
            <div>
              <strong>Call or text the clinic</strong>
              <a href="tel:+639177152780">
                0917 715 2780 <span>Globe</span>
              </a>
              <a href="tel:+639356594143">
                0935 659 4143 <span>TM</span>
              </a>
            </div>
          </div>
        </address>
        <a className="care-text-link" href={directionsUrl} target="_blank" rel="noreferrer">
          Get directions
          <ArrowUpRight size={18} aria-hidden="true" />
          <span className="care-sr-only"> (opens in a new tab)</span>
        </a>
      </div>
      <div className="care-location-panel">
        {mapEnabled ? (
          <AddressMapPreview
            address={clinicAddress}
            location={clinicLocation}
            className="care-map"
            mapClassName="care-map-canvas"
          />
        ) : (
          <div className="care-location-fallback">
            <MapPin size={32} strokeWidth={1.4} aria-hidden="true" />
            <p>Find the clinic</p>
            <span>
              2nd Door, Pinehills Hotel Compound
              <br />
              Malaybalay City, Bukidnon
            </span>
            <span>Call the clinic if you need help with directions.</span>
            <a href={directionsUrl} target="_blank" rel="noreferrer">
              Open directions in Google Maps
              <span className="care-sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        )}
        <div className="care-location-caption">
          <span>A local place for your next step.</span>
          <strong>By appointment</strong>
        </div>
      </div>
    </section>
  )
}

export default function LandingPage() {
  const { user, loading } = useAuth()
  const { settings } = useSettings()

  if (loading) return <AppLoader />

  if (user) {
    const dashboardPath =
      user.role === 'admin'
        ? '/staff/admin'
        : user.role === 'therapist'
          ? '/staff/therapist'
          : user.role === 'secretary'
            ? '/staff/secretary'
            : '/dashboard'
    return <Navigate replace to={dashboardPath} />
  }

  return (
    <div className="care-landing" data-surface="public">
      <a className="care-skip" href="#top">
        Skip to content
      </a>
      <LandingHeader />
      <main id="top" tabIndex={-1}>
        <section className="care-hero care-container" aria-labelledby="hero-title">
          <div className="care-hero-copy">
            <h1 id="hero-title">
              A little progress.
              <br />A fuller life.
            </h1>
            <p className="care-hero-description">
              Physical therapy and pediatric occupational therapy that puts your everyday life
              first. Right here in Malaybalay.
            </p>
            <div className="care-hero-actions">
              <Link className="care-button" to="/signup">
                Request a visit
              </Link>
              <a className="care-hero-services" href="#services">
                Find your care
                <ArrowDown size={17} aria-hidden="true" />
              </a>
            </div>
            <p className="care-hero-note">For your next step, and every little step after.</p>
          </div>
          <HeroRoom />
        </section>
        <div className="care-at-a-glance care-container">
          <p>
            Care for the things
            <br />
            <strong>that matter to you.</strong>
          </p>
          <div>
            <span>For your recovery</span>
            <a href="#physical-therapy">Physical therapy & rehabilitation</a>
          </div>
          <div>
            <span>For your child</span>
            <a href="#pediatric-therapy">Pediatric occupational therapy</a>
          </div>
          <a className="care-at-a-glance-location" href="#visit">
            <MapPin size={18} aria-hidden="true" />
            <span>
              Malaybalay City
              <br />
              <strong>Bukidnon</strong>
            </span>
          </a>
        </div>
        <ServicesSection />
        <FirstVisitSection />
        <VisitSection mapEnabled={settings.googleMapsEnabled} />
        <section className="care-closing care-container" aria-labelledby="closing-title">
          <div>
            <p className="care-label">Let’s take the next step together</p>
            <h2 id="closing-title">Your everyday matters.</h2>
          </div>
          <Link className="care-button" to="/signup">
            Request a visit
          </Link>
        </section>
      </main>
      <footer className="care-footer care-container">
        <a className="care-brand" href="#top" aria-label="AbsoluteCare Therapy Center, back to top">
          <Logo variant="mark" size="sm" to={null} />
          <span>
            AbsoluteCare<small>Therapy Center</small>
          </span>
        </a>
        <p>
          © 2026 AbsoluteCare Therapy Center
          <br />
          Malaybalay City, Bukidnon
        </p>
        <nav aria-label="Legal and account links">
          <Link to="/privacy">Privacy policy</Link>
          <Link to="/terms">Terms of use</Link>
          <Link to="/login">Log in</Link>
        </nav>
      </footer>
    </div>
  )
}
