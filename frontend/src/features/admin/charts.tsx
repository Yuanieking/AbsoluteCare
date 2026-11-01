import { Bar, BarChart, BarYAxis, Grid, PieChart, PieSlice } from '@/components/charts'
import { paymentColors, statusData } from './chart-data'
import type { MethodTotal, StatusCount, WorkloadRow } from './types'

const GAUGE_NOTCHES = 20
const GAUGE_TRACK = 'color-mix(in oklab, var(--color-chart-2) 20%, transparent)'

function share(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0
}

/** Status mix as a share rail plus a ledger, so counts stay readable without a tooltip. */
export function StatusMix({ items }: { items: StatusCount[] }) {
  const rows = statusData(items)
  const total = rows.reduce((sum, row) => sum + row.value, 0)

  return (
    <div className="flex h-full flex-col justify-center gap-4">
      <div aria-hidden="true" className="flex h-2.5 gap-[3px]">
        {rows.map((row) => (
          <span
            key={row.label}
            className="min-w-[6px] rounded-[2px]"
            style={{ flexBasis: 0, flexGrow: row.value, background: row.color }}
          />
        ))}
      </div>

      <ul className="grid gap-1.5">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2">
            <i
              aria-hidden="true"
              className="size-2 shrink-0 rounded-[2px]"
              style={{ background: row.color }}
            />
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{row.label}</span>
            <span className="text-[12.5px] font-medium tabular-nums text-ink">{row.value}</span>
            <span className="w-8 shrink-0 text-right text-[11.5px] tabular-nums text-ink-soft">
              {share(row.value, total)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** One notched gauge per therapist: completed visits out of assigned. */
export function WorkloadGauges({ items }: { items: WorkloadRow[] }) {
  return (
    <ul className="grid gap-3">
      {items.map((row, index) => {
        const assigned = Number(row.assigned || 0)
        const completed = Number(row.completed || 0)
        const scale = Math.max(assigned, completed, 1)
        const percent = Math.round((completed / scale) * 100)
        const filled = Math.round((percent / 100) * GAUGE_NOTCHES)

        return (
          <li className="grid gap-1.5" key={`${row.name ?? 'therapist'}-${index}`}>
            <div className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">
                {row.name || 'Unassigned'}
              </span>
              <span className="text-[11.5px] tabular-nums text-ink-soft">
                {completed} of {assigned}
              </span>
              <span className="w-8 shrink-0 text-right text-[12px] font-medium tabular-nums text-ink">
                {percent}%
              </span>
            </div>
            <div aria-hidden="true" className="flex gap-[2px]">
              {Array.from({ length: GAUGE_NOTCHES }, (_, notch) => (
                <span
                  className="h-2 flex-1 rounded-[1px]"
                  key={notch}
                  style={{
                    background: notch < filled ? 'var(--color-chart-1)' : GAUGE_TRACK,
                  }}
                />
              ))}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Ranked horizontal bars with in-bar values: where completed visits come from. */
export function ServicesBars({ items }: { items: StatusCount[] }) {
  const data = items
    .map((item) => ({ label: item._id || 'Unlabelled', value: Number(item.count || 0) }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)

  return (
    <BarChart
      aspectRatio="2 / 1"
      barGap={0.4}
      data={data}
      margin={{ top: 8, right: 12, bottom: 8, left: 96 }}
      orientation="horizontal"
      xDataKey="label"
    >
      <Grid horizontal={false} vertical fadeVertical />
      <Bar
        dataKey="value"
        fill="var(--color-chart-1)"
        lineCap={4}
        showValue
        valueLabelPosition="top"
      />
      <BarYAxis maxLabels={6} />
    </BarChart>
  )
}

export function PaymentMethodsDonut({ items }: { items: MethodTotal[] }) {
  const data = items.slice(0, 5).map((item, index) => ({
    label: item._id || 'Unrecorded',
    value: Number(item.total || 0),
    color: paymentColors[index % paymentColors.length],
  }))
  return (
    <PieChart data={data} size={228} innerRadius={60} padAngle={0.015}>
      {data.map((item, index) => (
        <PieSlice key={item.label} index={index} />
      ))}
    </PieChart>
  )
}
