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
    <div className={cn('flex flex-col items-center gap-2 px-4 py-10 text-center', className)}>
      {icon ? (
        <span className="text-ink-faint" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      {message ? <p className="max-w-sm text-[12.5px] text-ink-soft">{message}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}
