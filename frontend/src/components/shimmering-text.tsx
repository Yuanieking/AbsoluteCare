'use client'

import { motion, useReducedMotion } from 'motion/react'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

const SHIMMER_GRADIENT =
  'linear-gradient(90deg, var(--color) 0%, var(--color) 40%, var(--shimmering-color) 50%, var(--color) 60%, var(--color) 100%)'
const SHIMMER_BG_SIZE = '300% 100%'
const SWEEP_FROM = '100% 0%'
const SWEEP_TO = '0% 0%'

export type ShimmeringTextProps = Omit<ComponentProps<typeof motion.span>, 'children'> & {
  text: string
  duration?: number
  paused?: boolean
  isStopped?: boolean
}

export function ShimmeringText({
  text,
  duration = 1.5,
  isStopped = false,
  paused = false,
  className,
  style,
  ...props
}: ShimmeringTextProps) {
  const reducedMotion = useReducedMotion()
  const stopped = isStopped || paused || reducedMotion === true

  return (
    <motion.span
      animate={
        stopped ? { backgroundPosition: SWEEP_TO } : { backgroundPosition: [SWEEP_FROM, SWEEP_TO] }
      }
      className={cn(
        'inline-block select-none whitespace-nowrap leading-none',
        '[--color:var(--muted-foreground)] [--shimmering-color:var(--foreground)]',
        className,
      )}
      initial={{ backgroundPosition: SWEEP_FROM }}
      style={{
        backgroundImage: SHIMMER_GRADIENT,
        backgroundSize: SHIMMER_BG_SIZE,
        backgroundRepeat: 'no-repeat',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        color: 'transparent',
        WebkitTextFillColor: 'transparent',
        ...style,
      }}
      transition={
        stopped
          ? { duration: duration * 0.5, ease: 'easeOut' }
          : {
              duration,
              ease: 'easeInOut',
              repeat: Number.POSITIVE_INFINITY,
              repeatType: 'loop',
              repeatDelay: duration * 0.4,
            }
      }
      {...props}
    >
      {text}
    </motion.span>
  )
}
