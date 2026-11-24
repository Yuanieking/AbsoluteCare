import { clinicDay } from './clinic-time'

export function presetRange(preset, now = new Date()) {
  const to = clinicDay(now)
  if (preset === 'today') return { from: to, to }
  if (preset === 'month') return { from: `${to.slice(0, 7)}-01`, to }
  const calendar = new Date(`${to}T00:00:00Z`)
  calendar.setUTCDate(calendar.getUTCDate() - calendar.getUTCDay())
  return { from: calendar.toISOString().slice(0, 10), to }
}
export function formatRangeLabel({ from, to }) {
  if (from && to) return from === to ? from : `${from} – ${to}`
  if (from) return `From ${from}`
  if (to) return `Until ${to}`
  return 'Date range'
}
