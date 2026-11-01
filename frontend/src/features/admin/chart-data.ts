import type { MethodTotal, StatusCount } from './types'

export const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'var(--color-chart-3)' },
  confirmed: { label: 'Confirmed', color: 'var(--color-chart-4)' },
  completed: { label: 'Completed', color: 'var(--color-chart-1)' },
  cancelled: { label: 'Cancelled', color: 'var(--color-chart-5)' },
  no_show: { label: 'No-show', color: 'var(--color-chart-2)' },
}

export const statusLegend = Object.values(statusConfig).map((item) => ({
  label: item.label,
  color: item.color,
}))

export const paymentColors = [
  'var(--color-chart-1)',
  'var(--color-chart-4)',
  'var(--color-chart-3)',
  'var(--color-chart-2)',
  'var(--color-chart-5)',
]

export function statusData(items: StatusCount[]) {
  return Object.entries(statusConfig)
    .map(([key, config]) => ({
      label: config.label,
      value: items.find((item) => item._id === key)?.count || 0,
      color: config.color,
    }))
    .filter((item) => item.value > 0)
}

export function paymentLegend(items: MethodTotal[]) {
  return items.slice(0, 5).map((item, index) => ({
    label: item._id || 'Unrecorded',
    color: paymentColors[index % paymentColors.length] as string,
  }))
}
