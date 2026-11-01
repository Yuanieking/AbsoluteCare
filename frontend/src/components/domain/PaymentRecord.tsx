const stampFormat = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Manila',
})

export type PaymentHistoryItem = {
  action?: string
  by?: string | null
  details?: string
  at?: string | null
}

function stamp(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : stampFormat.format(date)
}

function actionLabel(action?: string) {
  if (!action) return 'Updated'
  const words = action.replaceAll('_', ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function PaymentRecord({
  reference,
  notes,
  recordedBy,
  recordedAt,
  history = [],
}: {
  reference?: string
  notes?: string
  recordedBy?: string | null
  recordedAt?: string | null
  history?: PaymentHistoryItem[]
}) {
  if (!reference && !notes && !recordedAt && !history.length) return null

  const rows = [
    { label: 'Recorded', value: stamp(recordedAt) || 'Not recorded' },
    { label: 'Recorded by', value: recordedBy || 'Not recorded' },
    { label: 'Reference', value: reference || 'None' },
    { label: 'Notes', value: notes || 'None' },
  ]
  const recent = [...history].reverse().slice(0, 3)

  return (
    <section
      aria-label="Payment record"
      className="grid gap-2 rounded-md border border-hairline-in bg-sunk p-3"
    >
      <h3 className="text-[11.5px] font-medium text-ink-soft">Payment record</h3>
      <dl className="grid gap-1.5 text-[12px]">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-3">
            <dt className="shrink-0 text-ink-soft">{row.label}</dt>
            <dd className="text-right text-ink tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
      {recent.length ? (
        <ol className="grid gap-1.5 border-t border-hairline pt-2">
          {recent.map((entry, index) => {
            const detail = [entry.by ? `by ${entry.by}` : '', entry.details]
              .filter(Boolean)
              .join(' · ')
            return (
              <li key={`${entry.at || ''}-${index}`} className="grid gap-0.5 text-[11.5px]">
                <div className="flex justify-between gap-3">
                  <span className="text-ink">{actionLabel(entry.action)}</span>
                  <span className="shrink-0 text-ink-faint tabular-nums">{stamp(entry.at)}</span>
                </div>
                {detail ? <span className="text-ink-soft">{detail}</span> : null}
              </li>
            )
          })}
        </ol>
      ) : null}
    </section>
  )
}
