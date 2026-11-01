import { Button } from '@/components/ui/button'
import { useSettings } from '@/features/settings/provider'
import { getGoogleAuthUrl } from '@/lib/api/auth'
import { stashPostAuthRedirect } from '@/lib/dashboard-path'

function GoogleMark({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.16 3.57-8.81z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.07.72-2.44 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.1A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28v-3.1H1.29a12 12 0 0 0 0 10.76l3.98-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.42-3.42A11.98 11.98 0 0 0 12 0 12 12 0 0 0 1.29 6.62l3.98 3.1C6.22 6.88 8.87 4.77 12 4.77z"
      />
    </svg>
  )
}

type GoogleButtonProps = {
  from?: unknown
  blocked?: boolean
  onBlocked?: () => void
}

export function GoogleButton({ from, blocked = false, onBlocked }: GoogleButtonProps) {
  const { settings } = useSettings()

  if (!settings.googleAuthEnabled) return null

  return (
    <Button
      asChild
      variant="outline"
      size="lg"
      className="w-full border-hairline bg-panel text-ink hover:bg-sunk"
    >
      <a
        href={getGoogleAuthUrl()}
        onClick={(event) => {
          if (blocked) {
            event.preventDefault()
            onBlocked?.()
            return
          }
          stashPostAuthRedirect(from)
        }}
      >
        <GoogleMark />
        Continue with Google
      </a>
    </Button>
  )
}
