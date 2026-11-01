'use client'

import type { MotionValue } from 'motion/react'
import { useCallback, useState, useSyncExternalStore } from 'react'

export function useEnterComplete(mountProgress: MotionValue<number>): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => mountProgress.on('change', onStoreChange),
    [mountProgress],
  )
  const getSnapshot = () => mountProgress.get() >= 1
  const reachedEnd = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const [latched, setLatched] = useState(reachedEnd)
  if (reachedEnd && !latched) {
    setLatched(true)
  }

  return latched || reachedEnd
}
