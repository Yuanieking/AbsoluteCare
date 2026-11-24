'use client'

import { useCallback, useState, useSyncExternalStore } from 'react'

export function useEnterComplete(mountProgress) {
  const subscribe = useCallback(
    (onStoreChange) => mountProgress.on('change', onStoreChange),
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
