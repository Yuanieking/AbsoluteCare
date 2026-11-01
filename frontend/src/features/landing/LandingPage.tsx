import { Link, Navigate } from 'react-router-dom'
import Logo from '@/components/brand/Logo'
import AppLoader from '@/components/feedback/AppLoader'
import { useAuth } from '@/features/auth/session'
import { HeroRoom } from './HeroRoom'

const benefits = [
  {
    number: '01',
    title: 'Book faster',
    text: 'Request a session without phone tag or a long wait for the calendar.',
  },
  {
    number: '02',
    title: 'The right specialist',
    text: 'Tell us what you need and we will help match you with the right care.',
  },
  {
    number: '03',
    title: 'Keep treatment moving',
    text: 'Plan consistent sessions around recovery goals, school, and family life.',
  },
  {
    number: '04',
    title: 'Fits real life',
    text: 'Choose a preferred time that works with your workday or school run.',
  },
]

const services = [
  {
    number: 'A',
    cta: 'Book physical therapy',
    title: 'Physical Therapy & Rehabilitation',
    description: 'Restore movement, reduce pain, and build confidence after injury or illness.',
    items: [
      'Post-op and sports injury recovery',
      'Stroke and neurological rehabilitation',
      'Low back, neck, shoulder, and knee pain',
      'Scoliosis, joint care, and rheumatic wellness',
    ],
  },
  {
    number: 'B',
    cta: 'Book pediatric OT',
    title: 'Pediatric Occupational Therapy',
    description: 'Practical support for children ages 1–18 as they learn, play, and grow.',
    items: [
      'ADL and self-care skill-building',
      'School readiness, handwriting, and focus',
      'Behavioral and social development',
      'Fine motor, gross motor, and sensory integration',
    ],
  },
]

const steps = [
  ['Choose a service', 'Tell us whether you need PT or pediatric OT.'],
  ['Pick a date and time', 'Share the appointment window that suits you.'],
  ['Confirm your details', 'Add your contact information and a brief note.'],
  ['Get confirmation', 'Our team will reply with a clear appointment time.'],
]

const eyebrow = 'text-[11.5px] font-medium text-eyebrow'

export default function LandingPage() {
  const { user, loading } = useAuth()

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
    <div className="bg-canvas text-ink">
      <a
        href="#top"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-[13px] focus:text-panel"
      >
        Skip to content
      </a>

      <header className="mx-auto flex max-w-[1280px] items-center justify-between gap-6 px-6 py-4 lg:px-[9vw]">
        <a href="#top" aria-label="AbsoluteCare Therapy Center home">
          <Logo variant="mark" tone="dark" size="md" to={null} />
        </a>
        <nav
          className="hidden items-center gap-7 text-[13px] font-semibold lg:flex"
          aria-label="Main navigation"
        >
          <a className="border-b border-transparent pb-1 hover:border-ink" href="#services">
            Services
          </a>
          <a className="border-b border-transparent pb-1 hover:border-ink" href="#how-it-works">
            How it works
          </a>
          <a className="border-b border-transparent pb-1 hover:border-ink" href="#visit">
            Visit us
          </a>
        </nav>
        <div className="flex items-center gap-4 text-[13px] font-semibold">
          <Link className="hover:underline" to="/login">
            Log in
          </Link>
          <Link className="border-b border-ink pb-1 hover:text-primary-strong" to="/signup">
            Book an appointment
          </Link>
        </div>
      </header>

      <main id="top">
        <section className="mx-auto grid max-w-[1280px] items-center lg:grid-cols-2 lg:pl-[9vw]">
          <div className="px-6 pt-14 pb-12 lg:pr-[7vw] lg:pt-5 lg:pb-[70px]">
            <p className={eyebrow}>Care that moves with you</p>
            <h1 className="mt-5 font-display text-[clamp(2.5rem,5.5vw,4rem)] leading-[1.02] font-semibold tracking-[-0.04em] text-balance">
              Start moving toward your <em className="text-eyebrow not-italic">better day.</em>
            </h1>
            <p className="mt-6 max-w-[455px] text-[16px] leading-[1.7] text-ink-soft">
              Book physical therapy or pediatric occupational therapy in Malaybalay City with a
              simple request and a real person on the other end.
            </p>
            <div className="mt-9 mb-12 flex flex-wrap items-center gap-7">
              <Link
                className="inline-flex h-11 items-center rounded-md bg-primary px-5 text-[13px] font-semibold text-panel transition-[background-color,transform] duration-150 ease-snap hover:bg-primary-strong active:scale-[0.985]"
                to="/signup"
              >
                Book an appointment
              </Link>
              <a
                className="border-b border-hairline pb-1.5 text-[13px] font-bold text-ink"
                href="#services"
              >
                See services below
              </a>
            </div>
            <div className="flex max-w-[590px] gap-12 border-t border-hairline pt-5 max-sm:gap-8">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-ink-faint">Find us</span>
                <strong className="text-[12.5px]">2nd Door, Pinehills Hotel Compound</strong>
                <span className="text-[11.5px] text-ink-soft">Malaybalay City, Bukidnon</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-ink-faint">Call or text</span>
                <strong className="text-[12.5px]">0917 715 2780</strong>
                <span className="text-[11.5px] text-ink-soft">Globe · 0935 659 4143 TM</span>
              </div>
            </div>
          </div>
          <HeroRoom />
        </section>

        <section
          className="mx-auto max-w-[1280px] px-6 py-24 lg:grid lg:grid-cols-[1fr_2fr] lg:gap-[7vw] lg:px-[9vw]"
          aria-labelledby="benefits-title"
        >
          <div>
            <p className={eyebrow}>Made for your day</p>
            <h2
              id="benefits-title"
              className="mt-5 font-display text-[clamp(2.25rem,4.2vw,3.75rem)] leading-[1.02] font-semibold tracking-[-0.04em]"
            >
              Good care starts
              <br />
              with an easier first step.
            </h2>
          </div>
          <div className="mt-12 grid border-t border-hairline sm:grid-cols-2 lg:mt-0">
            {benefits.map((benefit) => (
              <article
                key={benefit.number}
                className="border-b border-hairline py-6 pr-5 sm:[&:nth-child(even)]:pl-6"
              >
                <span className="text-[11px] font-bold text-eyebrow">{benefit.number}</span>
                <h3 className="mt-6 mb-2.5 font-display text-[16px] font-semibold tracking-[-0.01em]">
                  {benefit.title}
                </h3>
                <p className="max-w-[220px] text-[12.5px] leading-[1.65] text-ink-soft">
                  {benefit.text}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section id="services" className="bg-primary text-panel" aria-labelledby="services-title">
          <div className="mx-auto grid max-w-[1280px] gap-12 px-6 py-24 lg:grid-cols-[0.78fr_1.22fr] lg:gap-[8vw] lg:px-[9vw]">
            <div>
              <p className="text-[11.5px] font-medium text-lime">What we can help with</p>
              <h2
                id="services-title"
                className="mt-5 font-display text-[clamp(2.25rem,4.2vw,3.75rem)] leading-[1.02] font-semibold tracking-[-0.04em]"
              >
                Care with a clear
                <br />
                place to begin.
              </h2>
              <p className="mt-7 max-w-[275px] text-[14px] leading-[1.7] text-panel/70">
                Choose the path that sounds closest to what you or your child needs today. We can
                help with the rest.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {services.map((service) => (
                <article
                  key={service.number}
                  className="relative flex min-h-[390px] flex-col bg-primary-strong p-6"
                >
                  <span className="font-display text-[30px] leading-none text-lime">
                    {service.number}
                  </span>
                  <h3 className="mt-6 mb-2.5 max-w-[210px] font-display text-[20px] leading-[1.15] font-semibold tracking-[-0.03em]">
                    {service.title}
                  </h3>
                  <p className="min-h-[58px] text-[12.5px] leading-[1.6] text-panel/70">
                    {service.description}
                  </p>
                  <ul className="mt-5 mb-10 list-none border-t border-panel/20 pt-3">
                    {service.items.map((item) => (
                      <li
                        key={item}
                        className="relative my-2 pl-4 text-[12px] leading-[1.4] text-panel/85"
                      >
                        <span className="absolute left-0 text-lime" aria-hidden="true">
                          +
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Link
                    className="absolute bottom-6 text-[12px] font-bold text-lime hover:underline"
                    to="/signup"
                  >
                    {service.cta}
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className="mx-auto max-w-[1280px] px-6 py-24 lg:grid lg:grid-cols-[0.8fr_1.2fr] lg:gap-[8vw] lg:px-[9vw]"
          aria-labelledby="process-title"
        >
          <div>
            <p className={eyebrow}>How scheduling works</p>
            <h2
              id="process-title"
              className="mt-5 font-display text-[clamp(2.25rem,4.2vw,3.75rem)] leading-[1.02] font-semibold tracking-[-0.04em]"
            >
              Four small steps.
              <br />
              <em className="text-eyebrow not-italic">Less to think about.</em>
            </h2>
          </div>
          <div className="mt-12 grid border-t border-hairline sm:grid-cols-2 lg:mt-0">
            {steps.map(([title, text], index) => (
              <article
                key={title}
                className="min-h-[180px] border-b border-hairline py-6 pr-5 sm:[&:nth-child(even)]:pl-6"
              >
                <span className="text-[11px] font-bold text-eyebrow">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-7 mb-2 font-display text-[16px] font-semibold tracking-[-0.01em]">
                  {title}
                </h3>
                <p className="max-w-[210px] text-[12.5px] leading-[1.6] text-ink-soft">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          id="visit"
          className="mx-auto max-w-[1280px] px-6 py-24 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-[9vw] lg:px-[9vw]"
          aria-labelledby="visit-title"
        >
          <div className="min-h-[450px] overflow-hidden bg-primary-soft">
            <iframe
              title="Google Map showing Pine Hills Hotel in Malaybalay City"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3949.425643755817!2d125.12060707526672!3d8.159799091870852!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x32ffa98130d6e1ef%3A0xf4940dd0752e33cc!2sPine%20Hills%20Hotel!5e0!3m2!1sen!2sph!4v1790438652307!5m2!1sen!2sph"
              loading="lazy"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="block min-h-[450px] w-full border-0"
            />
          </div>
          <div className="mt-10 lg:mt-0">
            <p className={eyebrow}>Come see us</p>
            <h2
              id="visit-title"
              className="mt-5 font-display text-[clamp(2.25rem,4.2vw,3.75rem)] leading-[1.02] font-semibold tracking-[-0.04em]"
            >
              A familiar place
              <br />
              for better movement.
            </h2>
            <p className="mt-7 mb-10 max-w-[290px] text-[14px] leading-[1.7] text-ink-soft">
              We’re at the 2nd Door inside Pinehills Hotel Compound in Malaybalay City, Bukidnon.
            </p>
            <div className="border-t border-hairline">
              <div className="flex flex-col gap-2 border-b border-hairline py-4">
                <span className="text-[11px] font-medium text-ink-faint">Address</span>
                <strong className="text-[12.5px] leading-relaxed">
                  2nd Door, Pinehills Hotel Compound
                  <br />
                  Malaybalay City, Bukidnon
                </strong>
              </div>
              <div className="flex flex-col gap-2 border-b border-hairline py-4">
                <span className="text-[11px] font-medium text-ink-faint">Reach the clinic</span>
                <strong className="text-[12.5px] leading-relaxed">
                  0917 715 2780 · Globe
                  <br />
                  0935 659 4143 · TM
                </strong>
              </div>
              <div className="flex flex-col gap-2 border-b border-hairline py-4">
                <span className="text-[11px] font-medium text-ink-faint">Hours</span>
                <strong className="text-[12.5px]">By appointment</strong>
                <small className="text-[11.5px] text-ink-soft">
                  Call ahead so we can prepare for you.
                </small>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-primary text-panel/85">
        <div className="mx-auto grid max-w-[1280px] gap-10 px-6 pt-14 pb-9 sm:grid-cols-3 lg:px-[9vw]">
          <div>
            <a href="#top" aria-label="AbsoluteCare Therapy Center home">
              <Logo variant="mark" tone="light" size="md" to={null} />
            </a>
            <p className="mt-6 font-display text-[20px] leading-[1.1] text-panel/80">
              Helping Malaybalay move
              <br />
              with more ease.
            </p>
          </div>
          <div className="flex flex-col gap-3.5 text-[12.5px]">
            <a className="hover:text-lime" href="#services">
              Services
            </a>
            <a className="hover:text-lime" href="#how-it-works">
              How it works
            </a>
            <Link className="hover:text-lime" to="/login">
              Log in
            </Link>
          </div>
          <div className="flex flex-col gap-3.5 text-[11px] text-panel/60 sm:items-end">
            <span>Malaybalay City, Bukidnon</span>
            <span>© 2026 AbsoluteCare Therapy Center</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
