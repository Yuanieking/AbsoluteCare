import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { showError, showSuccess } from '@/lib/toast'

const reasonMessages = {
  denied:
    'Google Calendar was not connected because access was declined. Connect again and allow calendar access.',
  expired: 'The Google Calendar sign-in link expired. Click Connect to try again.',
  disabled: 'Google Calendar sync is switched off by the clinic.',
  no_refresh_token:
    'Google did not grant offline access. Remove AbsoluteCare from your Google account permissions, then connect again.',
}

export function calendarErrorMessage(reason) {
  return (reason && reasonMessages[reason]) || 'Google Calendar could not be connected. Try again.'
}

/**
 * Shows the result of the Google Calendar OAuth round trip
 * (`?calendar=connected|error&reason=…`) once, then removes it from the URL.
 */
export function useCalendarResult() {
  const [searchParams, setSearchParams] = useSearchParams()
  const result = searchParams.get('calendar')
  const reason = searchParams.get('reason')

  useEffect(() => {
    if (!result) return
    if (result === 'connected') showSuccess('Google Calendar connected.', { id: 'calendar-result' })
    if (result === 'error') showError(calendarErrorMessage(reason), { id: 'calendar-result' })
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.delete('calendar')
        next.delete('reason')
        return next
      },
      { replace: true },
    )
  }, [reason, result, setSearchParams])
}
