import { BarChart3 } from 'lucide-react'
import type { ReactNode } from 'react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export type ChartState = 'ready' | 'loading' | 'empty' | 'error'

export type ChartLegendItem = { label: string; color: string }

export function ChartCard({
  title,
  subtitle,
  actions,
  state = 'ready',
  legend,
  height = 260,
  emptyMessage = 'Try a wider date range.',
  errorMessage = 'This chart could not load.',
  onRetry,
  className,
  children,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  state?: ChartState
  legend?: ChartLegendItem[]
  height?: number
  emptyMessage?: string
  errorMessage?: string
  onRetry?: () => void
  className?: string
  children?: ReactNode
}) {
  return (
    <section
      className={cn('flex flex-col rounded-lg border border-hairline bg-card p-5', className)}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[14.5px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-[12px] text-ink-soft">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </header>

      <div className="mt-4 flex flex-1 flex-col justify-center" aria-busy={state === 'loading'}>
        {state === 'loading' ? <Skeleton className="w-full rounded-md" style={{ height }} /> : null}

        {state === 'empty' ? (
          <EmptyState
            icon={<BarChart3 size={17} />}
            title="No data for this period"
            message={emptyMessage}
          />
        ) : null}

        {state === 'error' ? (
          <EmptyState
            icon={<BarChart3 size={17} />}
            title="Chart unavailable"
            message={errorMessage}
            action={
              onRetry ? (
                <Button variant="outline" size="sm" onClick={onRetry}>
                  Try again
                </Button>
              ) : null
            }
          />
        ) : null}

        {state === 'ready' ? <div className="min-h-0 flex-1">{children}</div> : null}
      </div>

      {state === 'ready' && legend?.length ? (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-hairline-in pt-3">
          {legend.map((item) => (
            <span
              key={item.label}
              className="inline-flex items-center gap-1.5 text-[11px] text-ink-soft"
            >
              <i
                className="size-2 rounded-[2px]"
                style={{ background: item.color }}
                aria-hidden="true"
              />
              {item.label}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  )
}
