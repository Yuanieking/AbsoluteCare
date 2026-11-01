import type { ReactNode } from 'react'
import { CheckCircle2, CircleAlert, WifiOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import Logo from '@/components/brand/Logo'

type AuthShellProps = {
  children: ReactNode
  isStaffAlias?: boolean
  wide?: boolean
}

export function AuthShell({ children, isStaffAlias = false, wide = false }: AuthShellProps) {
  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-canvas px-4 text-ink sm:px-6">
      <header className="mx-auto flex w-full max-w-[1040px] shrink-0 items-center justify-between gap-4 py-4 sm:py-5">
        <Logo variant="full" tone="dark" size="md" to="/" />
        <span className="text-[11.5px] text-ink-soft max-sm:hidden">
          {isStaffAlias ? 'Staff portal — same sign-in' : 'Malaybalay City, Bukidnon'}
        </span>
      </header>

      <div className="flex min-h-0 flex-1 items-start justify-center py-1 sm:items-center">
        <section
          className={cn(
            'max-h-full w-full overflow-y-auto overscroll-contain rounded-xl border border-hairline bg-panel p-6 shadow-card sm:px-9 sm:py-7',
            wide ? 'max-w-[640px]' : 'max-w-[452px]',
          )}
        >
          {children}
        </section>
      </div>

      <p className="mx-auto flex w-full max-w-[1040px] shrink-0 flex-wrap items-center justify-center gap-x-2 gap-y-1 pt-3 pb-4 text-center text-[11.5px] text-ink-soft">
        <span>Your care, held with attention.</span>
        <span aria-hidden="true" className="text-ink-faint/60">
          ·
        </span>
        <Link className="font-medium text-ink underline-offset-4 hover:underline" to="/">
          Back to AbsoluteCare
        </Link>
      </p>
    </main>
  )
}

type AuthHeadingProps = {
  eyebrow: string
  title: string
  description: ReactNode
  hint?: ReactNode
}

export function AuthHeading({ eyebrow, title, description, hint }: AuthHeadingProps) {
  return (
    <div className="text-center">
      <p className="mb-2 text-[11.5px] font-medium text-eyebrow">{eyebrow}</p>
      <h1 className="font-display text-[29px] leading-[1.05] font-semibold tracking-[-0.03em] text-balance text-ink sm:text-[32px]">
        {title}
      </h1>
      <p className="mx-auto mt-2.5 mb-5 max-w-[380px] text-[12.5px] leading-relaxed text-ink-soft">
        {description}
      </p>
      {hint ? <p className="mb-4 text-[11.5px] leading-relaxed text-ink-faint">{hint}</p> : null}
    </div>
  )
}

export function AuthAlert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="mb-4 flex items-start gap-2 rounded-md border border-destructive/15 bg-destructive-soft px-3 py-2.5 text-[12px] leading-relaxed text-destructive"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  )
}

type NetworkAlertProps = {
  message: string
  onDismiss: () => void
}

export function NetworkAlert({ message, onDismiss }: NetworkAlertProps) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="mb-4 flex items-start gap-2 rounded-md border border-signal/25 bg-signal-soft px-3 py-2.5 text-[12px] leading-relaxed text-signal"
    >
      <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="flex flex-1 flex-col gap-0.5">
        <strong className="text-[12px] font-semibold">Cannot reach the server.</strong>
        <span>{message}</span>
        <span className="text-[11px] opacity-85">
          Check that the backend is running on port 8080, then try again.
        </span>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-sm border border-current/40 px-2 py-1 text-[11px] font-medium transition-colors duration-150 ease-snap hover:bg-signal/10"
      >
        Dismiss
      </button>
    </div>
  )
}

export function AuthSuccess({
  title,
  description,
  action,
}: {
  title: string
  description: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="text-center">
      <CheckCircle2 className="mx-auto mb-5 size-10 text-status-completed" aria-hidden="true" />
      <h1 className="font-display text-[30px] leading-none font-semibold tracking-[-0.03em] text-ink">
        {title}
      </h1>
      <p className="mx-auto mt-3.5 mb-6 max-w-[320px] text-[12.5px] leading-relaxed text-ink-soft">
        {description}
      </p>
      {action}
    </div>
  )
}
