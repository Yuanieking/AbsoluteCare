import { CheckCircle2, LoaderCircle, RotateCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { RestartState } from './types'

export type RestartPhase = 'idle' | 'restarting' | 'applied' | 'failed'

export function RestartBanner({
  restart,
  phase,
  message,
  onRestart,
  onDismiss,
}: {
  restart?: RestartState
  phase: RestartPhase
  message: string
  onRestart: () => void
  onDismiss: () => void
}) {
  if (!restart?.required) return null

  if (phase === 'applied') {
    return (
      <div
        role="status"
        className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary-soft px-4 py-3 text-[12.5px] text-primary"
      >
        <CheckCircle2 size={17} aria-hidden="true" />
        <span className="flex-1">Back online. The new credentials are active.</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Dismiss"
          onClick={onDismiss}
        >
          <X size={15} aria-hidden="true" />
        </Button>
      </div>
    )
  }

  return (
    <div
      role={phase === 'failed' ? 'alert' : 'status'}
      className={
        phase === 'failed'
          ? 'flex flex-wrap items-center gap-2 rounded-lg border border-destructive/25 bg-destructive-soft px-4 py-3 text-[12.5px] text-destructive'
          : 'flex flex-wrap items-center gap-2 rounded-lg border border-signal/25 bg-signal-soft px-4 py-3 text-[12.5px] text-signal'
      }
    >
      <RotateCw size={17} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        {phase === 'restarting' && 'Restarting the server. This page reconnects on its own.'}
        {phase === 'failed' &&
          (message ||
            'The server didn’t come back. Check the process manager logs, then restart it there.')}
        {phase === 'idle' && 'Credentials saved. Restart the server to apply them.'}
      </span>

      {phase === 'restarting' ? (
        <LoaderCircle className="animate-spin" size={16} aria-hidden="true" />
      ) : (
        <div className="flex items-center gap-2">
          {restart.supported === false ? (
            <code className="rounded bg-panel px-2 py-1 font-mono text-[11.5px] text-ink">
              {restart.command}
            </code>
          ) : (
            <Button type="button" size="sm" onClick={onRestart}>
              <RotateCw size={14} aria-hidden="true" /> Restart now
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={onDismiss}>
            Later
          </Button>
        </div>
      )}
    </div>
  )
}
