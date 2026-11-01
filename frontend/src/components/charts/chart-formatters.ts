export const shortDateFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
})

export const weekdayDateFmt = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})

export const hmsTimeFmt = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

export const intFmt = new Intl.NumberFormat('en-US').format
export const valueLabelFmt = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
}).format

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function formatBandRange(
  point: Record<string, unknown>,
  upperKey: string,
  lowerKey: string,
  format: (value: number) => string = intFmt,
): string | number | null {
  const upper = point[upperKey]
  const lower = point[lowerKey]
  if (!(isFiniteNumber(upper) && isFiniteNumber(lower))) {
    return null
  }
  if (upperKey === lowerKey) {
    return upper
  }
  return `${format(Math.min(lower, upper))} – ${format(Math.max(lower, upper))}`
}

const EAGER_LABEL_LIMIT = 64

function toArrayIndex(prop: string | symbol, length: number): number {
  if (typeof prop !== 'string' || prop.length === 0) {
    return -1
  }
  const first = prop.charCodeAt(0)
  if (first < 48 || first > 57) {
    return -1
  }
  const index = Number(prop)
  return Number.isInteger(index) && index < length && String(index) === prop ? index : -1
}

export function lazyLabels(length: number, format: (index: number) => string): string[] {
  if (length <= EAGER_LABEL_LIMIT) {
    return Array.from({ length }, (_, index) => format(index))
  }
  const cache: string[] = new Array(length)
  return new Proxy(cache, {
    get(target, prop, receiver) {
      const index = toArrayIndex(prop, length)
      if (index === -1) {
        return Reflect.get(target, prop, receiver)
      }
      let label = target[index]
      if (label === undefined) {
        label = format(index)
        target[index] = label
      }
      return label
    },
    has(target, prop) {
      return toArrayIndex(prop, length) !== -1 || Reflect.has(target, prop)
    },
  })
}
