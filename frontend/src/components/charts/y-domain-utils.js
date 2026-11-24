import { scaleLinear } from '@visx/scale'

import { Y_DOMAIN_TWEEN_SKIP_THRESHOLD } from './chart-phase'
import { groupLinesByYAxisId, normalizeYAxisId } from './y-axis-scales'

export function collectNumericExtents(data, dataKeys) {
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

export function resolveTimeSeriesYDomain(data, dataKeys, yScaleDomainMax) {
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

export function collectBarValueExtents(data, dataKeys, stacked) {
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

export function resolveBarValueDomain({ minValue, maxValue }) {
  if (minValue >= 0) {
    return [0, (maxValue > 0 ? maxValue : 100) * 1.1]
  }

  const padding = (maxValue - minValue) * 0.05 || 1
  return [Math.min(0, minValue - padding), Math.max(0, maxValue + padding)]
}

export function niceYDomain(domain) {
  const scale = scaleLinear({ domain, range: [0, 1], nice: true })
  const niceDomain = scale.domain()
  return [niceDomain[0] ?? domain[0], niceDomain[1] ?? domain[1]]
}

export function shouldTweenYDomain(from, to) {
  const span = Math.max(Math.abs(to[1] - to[0]), Math.abs(from[1] - from[0]), 1)
  const deltaMin = Math.abs(to[0] - from[0]) / span
  const deltaMax = Math.abs(to[1] - from[1]) / span
  return deltaMin >= Y_DOMAIN_TWEEN_SKIP_THRESHOLD || deltaMax >= Y_DOMAIN_TWEEN_SKIP_THRESHOLD
}

export function isLoadingChromePhase(phase) {
  return phase === 'loading' || phase === 'revealingLoading'
}

export function isLoadingGridChromePhase(phase) {
  return phase === 'loading' || phase === 'exiting' || phase === 'gridTweenLoading'
}

export function isYDomainTweenPhase(phase) {
  return phase === 'gridTweenLoading' || phase === 'gridTweenReady'
}

export function isReferenceAreaVisiblePhase(phase) {
  return phase === 'ready' || phase === 'revealing' || phase === 'gridTweenReady'
}

export function resolveAnimatedYDestinationDomains(chartPhase, skeletonByAxis, targetByAxis) {
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

export function computeYDomainsByAxis({ lines, resolveDomain, extraKeysByAxis }) {
  const keysByAxis = new Map()
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

  const domains = {}
  for (const [axisId, dataKeys] of keysByAxis) {
    domains[axisId] = niceYDomain(resolveDomain(dataKeys))
  }

  if (!domains.left) {
    domains.left = niceYDomain([0, 100])
  }

  return domains
}

export function mergeYDomainRecords(...records) {
  const merged = {}
  for (const record of records) {
    for (const [axisId, domain] of Object.entries(record)) {
      merged[normalizeYAxisId(axisId)] = domain
    }
  }
  return merged
}

export function domainsEqual(left, right) {
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
