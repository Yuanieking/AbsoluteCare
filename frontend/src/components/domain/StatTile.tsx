import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaSparkline,
  BarSparkline,
  LineSparkline,
  useSparklineHover,
} from '@/components/charts/sparkline'
import { StatTileSkeleton } from '@/components/feedback/Skeletons'
import { cn } from '@/lib/utils'

export type StatPoint = { label?: string; value: number }

export type StatTileProps = {
  label: string
  value: ReactNode
  caption?: ReactNode
  action?: ReactNode
  href?: string
  series?: StatPoint[]
  seriesType?: 'line' | 'area' | 'bar'
  seriesColor?: string
  seriesFormat?: (value: number) => ReactNode
  loading?: boolean
  className?: string
}

const DEFAULT_SERIES_COLOR = 'var(--color-chart-1)'
const SPARK_HEIGHT = 40

export function StatTile({
  label,
  value,
  caption,
  action,
  href,
  series,
  seriesType = 'area',
  seriesColor = DEFAULT_SERIES_COLOR,
  seriesFormat,
  loading = false,
  className,
}: StatTileProps) {
  const hover = useSparklineHover<StatPoint>()

  if (loading) return <StatTileSkeleton className={className} />

  const hasSeries = Boolean(series && series.length > 1)
  const hovered = hasSeries ? hover.datum : null
  const shownValue = hovered ? (seriesFormat ?? String)(hovered.value) : value
  const shownCaption = hovered?.label ?? caption

  const spark = hasSeries ? (
    <div className="mt-auto h-10 w-full">
      {seriesType === 'bar' ? (
        <BarSparkline
          data={series ?? []}
          dataKey="value"
          barRadius={2}
          color={seriesColor}
          height={SPARK_HEIGHT}
          {...hover.sparklineProps}
        />
      ) : seriesType === 'line' ? (
        <LineSparkline
          data={series ?? []}
          dataKey="value"
          color={seriesColor}
          endDot
          height={SPARK_HEIGHT}
          {...hover.sparklineProps}
        />
      ) : (
        <AreaSparkline
          data={series ?? []}
          color={seriesColor}
          dataKey="value"
          height={SPARK_HEIGHT}
          {...hover.sparklineProps}
        />
      )}
    </div>
  ) : null

  const body = (
    <>
      <span className="text-[11.5px] font-medium text-ink-faint">{label}</span>
      <strong className="font-display text-[27px] leading-none font-semibold tracking-[-0.03em] text-ink tabular-nums">
        {shownValue}
      </strong>
      {shownCaption ? (
        <span className="text-[12px] leading-relaxed text-ink-soft tabular-nums">
          {shownCaption}
        </span>
      ) : null}
      {action ? (
        <span className="mt-auto pt-1 text-[12px] font-medium text-primary">{action}</span>
      ) : null}
      {spark}
    </>
  )

  const shell = cn(
    'flex min-w-0 flex-col gap-1.5 rounded-lg border border-hairline bg-card p-4',
    href &&
      'transition-[border-color,background-color] duration-150 ease-snap hover:border-ink-faint/45 hover:bg-panel',
    className,
  )

  if (href) {
    return (
      <Link to={href} className={shell}>
        {body}
      </Link>
    )
  }

  return <article className={shell}>{body}</article>
}
