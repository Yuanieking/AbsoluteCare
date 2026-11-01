import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function EmptyState({
  icon,
  title,
  message,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  message?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center gap-2 px-5 py-12 text-center', className)}>
      {icon ? (
        <span
          className="mb-1 inline-flex size-9 items-center justify-center rounded-md border border-hairline-in bg-sunk/50 text-ink-faint"
          aria-hidden="true"
        >
          {icon}
        </span>
      ) : null}
      <h3 className="text-[13.5px] font-semibold tracking-[-0.005em] text-ink">{title}</h3>
      {message ? (
        <p className="max-w-[38ch] text-[12.5px] leading-relaxed text-ink-soft">{message}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
