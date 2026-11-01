export type DateRange = { from: string; to: string }
export type DateRangePreset = 'today' | 'week' | 'month'

function toISODate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function presetRange(preset: DateRangePreset, now = new Date()): DateRange {
  const to = toISODate(now)
  if (preset === 'today') return { from: to, to }
  if (preset === 'week') {
    const start = new Date(now)
    start.setDate(now.getDate() - now.getDay())
    return { from: toISODate(start), to }
  }
  return { from: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)), to }
}

export function formatRangeLabel({ from, to }: DateRange) {
  if (from && to) return from === to ? from : `${from} – ${to}`
  if (from) return `From ${from}`
  if (to) return `Until ${to}`
  return 'Date range'
}
