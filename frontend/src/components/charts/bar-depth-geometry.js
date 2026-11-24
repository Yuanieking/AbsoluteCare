export const BAR_DEPTH_MAX_PX = 7
export const BAR_DEPTH_PERSPECTIVE_RATIO = 0.45

export function barDepthMaxDepth(stepWidth, bandWidth) {
  const gap = Math.max(0, stepWidth - bandWidth)
  return Math.min(bandWidth * 0.22, Math.max(0, gap - 1), BAR_DEPTH_MAX_PX)
}

export function barDepthAndRise(absOffset, naturalHeight, maxDepth) {
  const offset = Math.min(1, Math.max(0, absOffset))
  const cappedMaxDepth = Math.min(maxDepth, Math.max(0, naturalHeight))
  const depth = offset * cappedMaxDepth
  return { depth, perspectiveRise: depth * BAR_DEPTH_PERSPECTIVE_RATIO }
}
