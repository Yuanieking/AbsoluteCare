import { useIsFetching } from '@tanstack/react-query'
import { useNavigation } from 'react-router-dom'

export function TopProgressBar() {
  const navigation = useNavigation()
  const fetching = useIsFetching()

  if (navigation.state === 'idle' && fetching === 0) return null
  return (
    <div
      role="progressbar"
      aria-label="Loading"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden bg-primary-soft"
    >
      <span className="block h-full w-1/3 animate-progress bg-primary" />
    </div>
  )
}
