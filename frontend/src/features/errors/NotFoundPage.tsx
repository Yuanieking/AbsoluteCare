import { ArrowLeft, Compass, Phone } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import Logo from '@/components/brand/Logo'

const staffRoles = ['admin', 'therapist', 'secretary']

type NotFoundContext = {
  eyebrow: string
  action: string
  actionPath: string
  supportCopy: string
}

function getNotFoundContext(pathname: string): NotFoundContext {
  const staffRole = staffRoles.find((role) => pathname.startsWith(`/staff/${role}`))

  if (staffRole) {
    return {
      eyebrow: 'Staff portal',
      action: 'Back to staff dashboard',
      actionPath: `/staff/${staffRole}`,
      supportCopy: 'Need help finding a staff page? Contact your clinic administrator.',
    }
  }

  if (pathname.startsWith('/staff')) {
    return {
      eyebrow: 'Staff portal',
      action: 'Back to staff login',
      actionPath: '/staff/login',
      supportCopy: 'Staff accounts and access are managed by the clinic administrator.',
    }
  }

  if (pathname.startsWith('/dashboard')) {
    return {
      eyebrow: 'Patient portal',
      action: 'Back to dashboard',
      actionPath: '/dashboard',
      supportCopy: 'Need help with your care? Call the clinic at 0917 715 2780.',
    }
  }

  return {
    eyebrow: 'AbsoluteCare Therapy Center',
    action: 'Back to home',
    actionPath: '/',
    supportCopy: 'Need help finding the right page? Call 0917 715 2780.',
  }
}

export default function NotFoundPage() {
  const { pathname } = useLocation()
  const context = getNotFoundContext(pathname)

  return (
    <main className="flex min-h-screen flex-col bg-canvas px-4 py-10 text-ink sm:px-6">
      <header className="mx-auto flex w-full max-w-[1020px] items-center justify-between gap-4">
        <Logo variant="full" tone="dark" size="md" to="/" />
        <span className="text-[11px] text-ink-soft max-sm:hidden">{context.eyebrow}</span>
      </header>

      <section
        className="mx-auto my-auto w-full max-w-[535px] border border-hairline bg-panel p-10 text-center shadow-[0_22px_55px_rgba(30,76,61,0.07)] sm:px-14 sm:py-12"
        aria-labelledby="not-found-title"
      >
        <div
          className="relative mx-auto mb-6 flex size-[83px] items-center justify-center text-primary-strong"
          aria-hidden="true"
        >
          <Compass size={48} strokeWidth={1.3} className="absolute" />
          <span className="font-display text-[19px] tracking-[-0.04em]">404</span>
        </div>
        <p className="mb-3 text-[11.5px] font-medium text-eyebrow">A small wrong turn</p>
        <h1
          id="not-found-title"
          className="font-display text-[40px] leading-none font-semibold tracking-[-0.04em]"
        >
          Page not found
        </h1>
        <p className="mx-auto mt-4 max-w-[370px] text-[13px] leading-[1.65] text-ink-soft">
          Sorry, we couldn't find the page you're looking for. It may have been moved, renamed, or
          no longer exists.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-5 max-sm:flex-col max-sm:items-stretch">
          <Link
            className="inline-flex items-center justify-center gap-2 bg-primary px-4 py-3.5 text-[12.5px] font-bold text-panel transition-transform hover:-translate-y-0.5 hover:bg-primary-strong"
            to={context.actionPath}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            {context.action}
          </Link>
          <a
            className="inline-flex items-center justify-center gap-1.5 border-b border-hairline pb-1 text-[12px] font-bold text-ink hover:text-eyebrow"
            href="tel:09177152780"
          >
            <Phone size={15} aria-hidden="true" />
            Contact support
          </a>
        </div>
        <p className="mx-auto mt-6 max-w-[315px] text-[11px] leading-relaxed text-ink-faint">
          {context.supportCopy}
        </p>
      </section>

      <p className="mx-auto mt-6 text-center text-[11px] text-ink-faint">
        Malaybalay City, Bukidnon <span className="text-lime">·</span> 0917 715 2780
      </p>
    </main>
  )
}
