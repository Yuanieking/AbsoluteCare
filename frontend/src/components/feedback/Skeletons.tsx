import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div role="status" aria-label="Loading table" className="divide-y divide-hairline-in">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex h-11 items-center gap-6 px-3">
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton
              key={column}
              className="h-2.5 shrink-0 rounded-sm"
              style={{
                width: column === 0 ? '30%' : `${Math.max(52, 120 - column * 16)}px`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function StatTileSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border border-hairline bg-card p-4 ${className ?? ''}`}
    >
      <Skeleton className="h-2.5 w-24 rounded-sm" />
      <Skeleton className="h-6 w-20 rounded-sm" />
      <Skeleton className="h-2.5 w-28 rounded-sm" />
    </div>
  )
}

function PanelSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-lg border border-hairline bg-card p-5">
      <Skeleton className="h-3 w-40 rounded-sm" />
      <Skeleton className="mt-2 h-2.5 w-56 max-w-full rounded-sm" />
      <div className="mt-4 grid gap-2.5">
        {Array.from({ length: lines }, (_, line) => (
          <Skeleton key={line} className="h-9 w-full rounded-md" />
        ))}
      </div>
    </div>
  )
}

export type SkeletonVariant = 'table' | 'dashboard' | 'form'

export function PageSkeletonFallback({
  variant = 'table',
  delay = 200,
}: {
  variant?: SkeletonVariant
  delay?: number
}) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), delay)
    return () => window.clearTimeout(timer)
  }, [delay])

  return ready ? <PageSkeleton variant={variant} /> : null
}

export function PageSkeleton({
  variant = 'table',
  rows = 6,
  columns = 5,
}: {
  variant?: SkeletonVariant
  rows?: number
  columns?: number
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading page"
      className="mx-auto w-full max-w-[1200px] px-5 pt-7 pb-16 sm:px-8"
    >
      <span className="sr-only">Loading…</span>

      <div className="border-b border-hairline-in pb-5">
        <Skeleton className="h-2.5 w-24 rounded-sm" />
        <Skeleton className="mt-2.5 h-7 w-64 max-w-full rounded-sm" />
        <Skeleton className="mt-2.5 h-3 w-[min(420px,80%)] rounded-sm" />
      </div>

      {variant === 'dashboard' ? (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, tile) => (
              <StatTileSkeleton key={tile} />
            ))}
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <PanelSkeleton lines={4} />
            <div className="grid gap-4">
              <PanelSkeleton lines={3} />
              <PanelSkeleton lines={2} />
            </div>
          </div>
        </>
      ) : variant === 'form' ? (
        <div className="mt-5 grid gap-4">
          <PanelSkeleton lines={3} />
          <PanelSkeleton lines={4} />
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Skeleton className="h-9 w-[260px] max-w-full rounded-md" />
            <Skeleton className="h-9 w-[150px] rounded-md" />
            <Skeleton className="ml-auto h-9 w-[110px] rounded-md" />
          </div>
          <div className="mt-3 overflow-hidden rounded-lg border border-hairline bg-card">
            <div className="flex items-center gap-6 border-b border-hairline-in px-3 py-2.5">
              {Array.from({ length: columns }, (_, column) => (
                <Skeleton
                  key={column}
                  className="h-2.5 shrink-0 rounded-sm"
                  style={{
                    width: column === 0 ? '30%' : `${Math.max(52, 120 - column * 16)}px`,
                  }}
                />
              ))}
            </div>
            <TableSkeleton rows={rows} columns={columns} />
          </div>
        </>
      )}
    </div>
  )
}
