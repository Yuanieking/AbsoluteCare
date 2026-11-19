import { PAST_DUE_REASON } from './format'

/** Marks a pending request whose requested time has already passed. */
export function PastDueBadge() {
  return (
    <span
      title={PAST_DUE_REASON}
      className="rounded-full bg-destructive-soft px-2 py-0.5 text-[10.5px] font-medium text-destructive"
    >
      Past due
    </span>
  )
}

/** Explains why a past-due request can no longer be assigned or confirmed. */
export function PastDueCallout() {
  return (
    <p
      role="alert"
      className="rounded-md border border-destructive/35 bg-destructive-soft/60 px-3 py-2 text-[12.5px] text-destructive"
    >
      <strong className="font-semibold">Past due.</strong> {PAST_DUE_REASON}
    </p>
  )
}
