// Clinic wall-clock inputs are Manila dates, never the browser's timezone.
export function clinicDate(value: string | Date): Date {
  if (value instanceof Date) return new Date(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00+08:00`)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value)) return new Date(`${value}+08:00`)
  return new Date(value)
}
export function clinicDay(value = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value)
  const part = (type: string) => parts.find((item) => item.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
export function clinicMonthRange(value: string | Date = new Date()) {
  const month = clinicDay(clinicDate(value)).slice(0, 7)
  const next = new Date(`${month}-01T00:00:00Z`)
  next.setUTCMonth(next.getUTCMonth() + 1)
  return {
    from: clinicDate(`${month}-01`).toISOString(),
    to: new Date(clinicDate(next.toISOString().slice(0, 10)).getTime() - 1).toISOString(),
  }
}
export function clinicRange(from: string, to: string) {
  return {
    from: clinicDate(from).toISOString(),
    to: clinicDate(`${to}T23:59:59.999`).toISOString(),
  }
}
