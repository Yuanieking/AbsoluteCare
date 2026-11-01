import { scaleLinear } from '@visx/scale'
import type { LineConfig } from './chart-context'
import { type ChartPhase, Y_DOMAIN_TWEEN_SKIP_THRESHOLD } from './chart-phase'
import { groupLinesByYAxisId, normalizeYAxisId } from './y-axis-scales'

export type YDomain = [number, number]

export interface NumericExtents {
  minValue: number
  maxValue: number
}

export function collectNumericExtents(
  data: Record<string, unknown>[],
  dataKeys: string[],
): NumericExtents {
  let minValue = Number.POSITIVE_INFINITY
  let maxValue = Number.NEGATIVE_INFINITY

  for (const d of data) {
    for (const key of dataKeys) {
      const value = d[key]
      if (typeof value === 'number') {
        if (value < minValue) {
          minValue = value
        }
        if (value > maxValue) {
          maxValue = value
        }
      }
    }
  }

  if (minValue === Number.POSITIVE_INFINITY) {
    return { minValue: 0, maxValue: 100 }
  }

  return { minValue, maxValue }
}

export function resolveTimeSeriesYDomain(
  data: Record<string, unknown>[],
  dataKeys: string[],
  yScaleDomainMax: number | undefined,
): YDomain {
  if (yScaleDomainMax != null && yScaleDomainMax > 0) {
    return [0, yScaleDomainMax * 1.1]
  }

  const { minValue, maxValue } = collectNumericExtents(data, dataKeys)

  if (minValue >= 0) {
    const top = maxValue <= 0 ? 100 : maxValue * 1.1
    return [0, top]
  }

  const padding = (maxValue - minValue) * 0.05 || 1
  return [minValue - padding, maxValue + padding]
}

export function collectBarValueExtents(
  data: Record<string, unknown>[],
  dataKeys: string[],
  stacked: boolean,
): NumericExtents {
  if (!stacked) {
    return collectNumericExtents(data, dataKeys)
  }
  let minValue = 0
  let maxValue = 0
  for (const d of data) {
    let sum = 0
    for (const key of dataKeys) {
      const value = d[key]
      if (typeof value === 'number') {
        sum += value
        minValue = Math.min(minValue, sum)
        maxValue = Math.max(maxValue, sum)
      }
    }
  }
  return { minValue, maxValue }
}

export function resolveBarValueDomain({ minValue, maxValue }: NumericExtents): YDomain {
  if (minValue >= 0) {
    return [0, (maxValue > 0 ? maxValue : 100) * 1.1]
  }

  const padding = (maxValue - minValue) * 0.05 || 1
  return [Math.min(0, minValue - padding), Math.max(0, maxValue + padding)]
}

export function niceYDomain(domain: YDomain): YDomain {
  const scale = scaleLinear({ domain, range: [0, 1], nice: true })
  const niceDomain = scale.domain()
  return [niceDomain[0] ?? domain[0], niceDomain[1] ?? domain[1]]
}

export function shouldTweenYDomain(from: YDomain, to: YDomain): boolean {
  const span = Math.max(Math.abs(to[1] - to[0]), Math.abs(from[1] - from[0]), 1)
  const deltaMin = Math.abs(to[0] - from[0]) / span
  const deltaMax = Math.abs(to[1] - from[1]) / span
  return deltaMin >= Y_DOMAIN_TWEEN_SKIP_THRESHOLD || deltaMax >= Y_DOMAIN_TWEEN_SKIP_THRESHOLD
}

export function isLoadingChromePhase(phase: ChartPhase): boolean {
  return phase === 'loading' || phase === 'revealingLoading'
}

export function isLoadingGridChromePhase(phase: ChartPhase): boolean {
  return phase === 'loading' || phase === 'exiting' || phase === 'gridTweenLoading'
}

export function isYDomainTweenPhase(phase: ChartPhase): boolean {
  return phase === 'gridTweenLoading' || phase === 'gridTweenReady'
}

export function isReferenceAreaVisiblePhase(phase: ChartPhase): boolean {
  return phase === 'ready' || phase === 'revealing' || phase === 'gridTweenReady'
}

export function resolveAnimatedYDestinationDomains(
  chartPhase: ChartPhase,
  skeletonByAxis: Record<string, YDomain>,
  targetByAxis: Record<string, YDomain>,
): Record<string, YDomain> {
  switch (chartPhase) {
    case 'loading':
    case 'exiting':
    case 'gridTweenLoading':
      return skeletonByAxis
    case 'exitingReady':
    case 'gridTweenReady':
    case 'revealing':
    case 'ready':
      return targetByAxis
    default:
      return targetByAxis
  }
}

export function computeYDomainsByAxis({
  lines,
  resolveDomain,
  extraKeysByAxis,
}: {
  lines: LineConfig[]
  resolveDomain: (dataKeys: string[]) => YDomain
  extraKeysByAxis?: Record<string, string[]>
}): Record<string, YDomain> {
  const keysByAxis = new Map<string, string[]>()
  for (const [axisId, axisLines] of groupLinesByYAxisId(lines)) {
    keysByAxis.set(
      normalizeYAxisId(axisId),
      axisLines.map((line) => line.dataKey),
    )
  }
  for (const [axisId, extraKeys] of Object.entries(extraKeysByAxis ?? {})) {
    const id = normalizeYAxisId(axisId)
    const keys = keysByAxis.get(id) ?? []
    keysByAxis.set(id, [...keys, ...extraKeys.filter((key) => !keys.includes(key))])
  }

  const domains: Record<string, YDomain> = {}
  for (const [axisId, dataKeys] of keysByAxis) {
    domains[axisId] = niceYDomain(resolveDomain(dataKeys))
  }

  if (!domains.left) {
    domains.left = niceYDomain([0, 100])
  }

  return domains
}

export function mergeYDomainRecords(
  ...records: Record<string, YDomain>[]
): Record<string, YDomain> {
  const merged: Record<string, YDomain> = {}
  for (const record of records) {
    for (const [axisId, domain] of Object.entries(record)) {
      merged[normalizeYAxisId(axisId)] = domain
    }
  }
  return merged
}

export function domainsEqual(
  left: Record<string, YDomain>,
  right: Record<string, YDomain>,
): boolean {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) {
    return false
  }

  for (const axisId of leftKeys) {
    const from = left[axisId]
    const to = right[axisId]
    if (!(from && to) || from[0] !== to[0] || from[1] !== to[1]) {
      return false
    }
  }

  return true
}
