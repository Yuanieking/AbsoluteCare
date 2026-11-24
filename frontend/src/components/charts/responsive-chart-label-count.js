export function resolveResponsiveChartLabelCount(value, containerWidth, fallback) {
  if (typeof value === 'number') {
    return value
  }

  const candidates = [
    [1280, value.xl],
    [1024, value.lg],
    [768, value.md],
    [640, value.sm],
    [0, value.base],
  ]

  return (
    candidates.find(([minWidth, count]) => containerWidth >= minWidth && count != null)?.[1] ??
    fallback
  )
}
