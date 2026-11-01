export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

export type Weekday = (typeof WEEKDAYS)[number]

export type DayHours = { day: Weekday; start: string; end: string }

export const DEFAULT_HOURS = { start: '08:00', end: '17:00' }

const clockPattern = /^([01]\d|2[0-3]):[0-5]\d$/

export function isWeekday(value: string): value is Weekday {
  return (WEEKDAYS as readonly string[]).includes(value)
}

/** Mirrors the server: per-day first, legacy global range for old documents. */
export function scheduleOf(
  user?: {
    workingDays?: string[]
    workingHoursByDay?: DayHours[] | null
    workingHours?: { start?: string; end?: string } | null
  } | null,
): DayHours[] {
  const byDay = user?.workingHoursByDay
  if (byDay?.length) {
    return byDay.map((entry) => ({ day: entry.day, start: entry.start, end: entry.end }))
  }
  const start = user?.workingHours?.start || DEFAULT_HOURS.start
  const end = user?.workingHours?.end || DEFAULT_HOURS.end
  return (user?.workingDays || []).filter(isWeekday).map((day) => ({ day, start, end }))
}

/** `Mon–Fri 08:00–17:00 · Sat 09:00–12:00`, collapsing consecutive equal days. */
export function formatSchedule(days: DayHours[]): string {
  if (!days.length) return 'No working days set'
  const order = WEEKDAYS as readonly string[]
  const sorted = [...days].sort((a, b) => order.indexOf(a.day) - order.indexOf(b.day))
  const groups: { from: number; to: number; hours: string }[] = []
  for (const entry of sorted) {
    const index = order.indexOf(entry.day)
    const hours = `${entry.start}–${entry.end}`
    const last = groups[groups.length - 1]
    if (last && last.hours === hours && last.to === index - 1) last.to = index
    else groups.push({ from: index, to: index, hours })
  }
  return groups
    .map(
      (group) =>
        `${order[group.from]}${group.from === group.to ? '' : `–${order[group.to]}`} ${group.hours}`,
    )
    .join(' · ')
}

export function scheduleLength(days: DayHours[]) {
  return `${days.length} ${days.length === 1 ? 'day' : 'days'}`
}

/** Per-day client validation, so a row can show its own message. */
export function scheduleErrors(days: DayHours[]): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const entry of days) {
    if (!clockPattern.test(entry.start)) errors[entry.day] = 'Enter a start time as HH:mm.'
    else if (!clockPattern.test(entry.end)) errors[entry.day] = 'Enter an end time as HH:mm.'
    else if (entry.start >= entry.end) errors[entry.day] = 'End time must be after the start time.'
  }
  return errors
}

export function schedulePayload(days: DayHours[]) {
  return { workingDays: days.map((entry) => entry.day), workingHoursByDay: days }
}
