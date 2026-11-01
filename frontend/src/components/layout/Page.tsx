import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function PageBody({ children, className, ...props }: ComponentProps<'main'>) {
  return (
    <main
      className={cn('mx-auto w-full max-w-[1200px] px-5 pt-7 pb-16 sm:px-8', className)}
      {...props}
    >
      {children}
    </main>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  meta?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-hairline-in pb-5">
      <div className="min-w-0">
        {eyebrow ? <p className="text-[11.5px] font-medium text-ink-faint">{eyebrow}</p> : null}
        <h1 className="mt-1 font-display text-[28px] leading-[1.12] font-semibold tracking-[-0.028em] text-ink sm:text-[30px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-[64ch] text-[13px] leading-relaxed text-ink-soft">
            {description}
          </p>
        ) : null}
        {meta}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}

/** A titled block of page content, so panels stop being hand-rolled per page. */
export function PageSection({
  title,
  description,
  actions,
  children,
  className,
  ...props
}: ComponentProps<'section'> & {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <section className={cn('min-w-0', className)} {...props}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
          {description ? <p className="mt-0.5 text-[12px] text-ink-soft">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </header>
      {children}
    </section>
  )
}
