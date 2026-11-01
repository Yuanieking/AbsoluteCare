import type { Transition } from 'motion/react'

export const DEFAULT_ANIMATION_EASING = 'cubic-bezier(0.85, 0, 0.15, 1)'

export const DEFAULT_ANIMATION_DURATION_MS = 1100

export const DEFAULT_CHART_ENTER_TRANSITION: Transition = {
  type: 'tween',
  duration: DEFAULT_ANIMATION_DURATION_MS / 1000,
  ease: [0.85, 0, 0.15, 1],
}

export function clipRevealTransition(enterTransition?: Transition): Transition {
  if (enterTransition?.type === 'tween') {
    return {
      ...enterTransition,
      ease: enterTransition.ease ?? DEFAULT_CHART_ENTER_TRANSITION.ease,
    }
  }

  const duration =
    typeof enterTransition?.duration === 'number'
      ? enterTransition.duration
      : DEFAULT_ANIMATION_DURATION_MS / 1000

  return {
    type: 'tween',
    duration,
    ease: DEFAULT_CHART_ENTER_TRANSITION.ease,
  }
}

export const GRID_RING_STAGGER_S = 0.08
export const GRID_RING_SPRING: Transition = {
  type: 'spring',
  stiffness: 100,
  damping: 15,
  mass: 1,
}
export const GRID_SPOKE_STAGGER_S = 0.05
export const GRID_SPOKE_SPRING: Transition = {
  type: 'spring',
  stiffness: 80,
  damping: 15,
  mass: 1,
}
export const GRID_VALUE_LABEL_STAGGER_S = 0.06
export const GRID_ANGLE_LABEL_STAGGER_S = 0.08
export const GRID_ANGLE_LABEL_FADE_S = 0.5

export function gridLabelDelay(
  ringCount: number,
  ringStagger: number = GRID_RING_STAGGER_S,
): number {
  return ringCount * ringStagger * 0.5
}
