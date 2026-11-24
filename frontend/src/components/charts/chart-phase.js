export const DEFAULT_CHART_STATUS = 'ready'

export const DEFAULT_Y_DOMAIN_TWEEN_MS = 500

export const Y_DOMAIN_TWEEN_SKIP_THRESHOLD = 0.02

export function resolveRestingChartPhase(status) {
  return status === 'loading' ? 'loading' : 'ready'
}

export function isChartInteractionPhase(phase) {
  return phase === 'ready'
}

export const DEFAULT_CHART_LIFECYCLE = {
  chartPhase: 'ready',
  chartStatus: 'ready',
  loadingLabel: undefined,
  yDomainTweenDuration: DEFAULT_Y_DOMAIN_TWEEN_MS,
  yDomainSkeletonByAxis: { left: [0, 100] },
  yDomainTargetByAxis: { left: [0, 100] },
}
