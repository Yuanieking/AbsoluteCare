import { cn } from '@/lib/utils'

export type StatusTone = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no-show' | 'neutral'

const toneClass: Record<StatusTone, string> = {
  pending: 'bg-status-pending-bg text-status-pending',
  confirmed: 'bg-status-confirmed-bg text-status-confirmed',
  completed: 'bg-status-completed-bg text-status-completed',
  cancelled: 'bg-status-cancelled-bg text-status-cancelled',
  'no-show': 'bg-status-no-show-bg text-status-no-show',
  neutral: 'bg-sunk text-ink-soft',
}

const known: Record<string, { label: string; tone: StatusTone }> = {
  pending: { label: 'Pending', tone: 'pending' },
  'pending-approval': { label: 'Pending approval', tone: 'pending' },
  confirmed: { label: 'Confirmed', tone: 'confirmed' },
  completed: { label: 'Completed', tone: 'completed' },
  active: { label: 'Active', tone: 'completed' },
  paid: { label: 'Paid', tone: 'completed' },
  cancelled: { label: 'Cancelled', tone: 'cancelled' },
  'no-show': { label: 'No-show', tone: 'no-show' },
  archived: { label: 'Archived', tone: 'neutral' },
  deactivated: { label: 'Deactivated', tone: 'neutral' },
  removed: { label: 'Removed', tone: 'neutral' },
  unpaid: { label: 'Unpaid', tone: 'pending' },
}

function normalize(status: string) {
  return status
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
}

export function StatusBadge({ status, className }: { status?: string | null; className?: string }) {
  if (!status) return null
  const key = normalize(status)
  const entry = known[key]
  const label = entry?.label ?? status.charAt(0).toUpperCase() + status.slice(1)
  return (
    <span
      data-status={key}
      className={cn(
        'inline-flex w-fit items-center gap-1.5 rounded-sm px-1.5 py-[3px] text-[11px] font-medium whitespace-nowrap',
        toneClass[entry?.tone ?? 'neutral'],
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current opacity-70" />
      {label}
    </span>
  )
}
