import { ExternalLink, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CopyButton } from './IntegrationSetupGuide'
import type { CredentialGroup, CredentialKeyEntry } from './types'

function sourceBadge(entry: CredentialKeyEntry) {
  if (entry.source === 'app') return { label: 'Saved in app', set: true }
  if (entry.source === 'env') return { label: 'From .env', set: true }
  return { label: 'Not set', set: false }
}

export function IntegrationSetupDialog({
  group,
  onClose,
  onEdit,
}: {
  group: CredentialGroup
  onClose: () => void
  onEdit: (group: string) => void
}) {
  const steps = [
    group.helpUrl ? 'Open the provider console and create or find the values listed below.' : null,
    group.redirectUri
      ? 'Register the redirect URI below in the provider console exactly as shown.'
      : null,
    'Choose Edit credentials and paste each value. Leave a field empty to keep its current value.',
    'Save and confirm with the emailed code. Restart the server if the page asks for it.',
    'Run the integration test (or send a test email) to confirm the connection.',
  ].filter((step): step is string => Boolean(step))

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{group.title} setup</DialogTitle>
          <DialogDescription>{group.purpose}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <section aria-labelledby={`setup-steps-${group.id}`}>
            <h3 id={`setup-steps-${group.id}`} className="text-[13px] font-semibold text-ink">
              Steps
            </h3>
            <ol className="mt-1 grid list-decimal gap-1 pl-5 text-[12px] text-ink-soft">
              {steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            {group.helpUrl || group.redirectUri ? (
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                {group.helpUrl ? (
                  <a
                    href={group.helpUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11.5px] font-medium text-primary hover:underline"
                  >
                    <ExternalLink size={12} aria-hidden="true" /> Open the provider console
                  </a>
                ) : null}
                {group.redirectUri ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <code className="font-mono text-[11px] break-all text-ink-soft">
                      {group.redirectUri}
                    </code>
                    <CopyButton value={group.redirectUri} label="Copy redirect URI" />
                  </span>
                ) : null}
              </div>
            ) : null}
          </section>

          <section aria-labelledby={`setup-vars-${group.id}`}>
            <div className="flex items-center justify-between gap-2">
              <h3 id={`setup-vars-${group.id}`} className="text-[13px] font-semibold text-ink">
                Variables
              </h3>
              <span className="text-[11.5px] text-ink-soft">
                {group.status.configured
                  ? 'All required values set'
                  : `Missing: ${group.status.missing.join(', ')}`}
              </span>
            </div>
            <ul className="mt-2 grid gap-2">
              {group.keys.map((entry) => {
                const badge = sourceBadge(entry)
                return (
                  <li key={entry.key} className="rounded-md border border-hairline p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <code className="font-mono text-[12px] text-ink">{entry.key}</code>
                      <span className="flex items-center gap-2 text-[11px]">
                        {entry.required ? (
                          <span className="text-ink-soft">Required</span>
                        ) : (
                          <span className="text-ink-faint">Optional</span>
                        )}
                        <span
                          className={
                            badge.set
                              ? 'rounded-full bg-status-completed-bg px-2 py-0.5 font-medium text-status-completed'
                              : 'rounded-full bg-signal-soft px-2 py-0.5 font-medium text-signal'
                          }
                        >
                          {badge.label}
                        </span>
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12px] font-medium text-ink">{entry.label}</p>
                    {entry.helper ? (
                      <p className="mt-0.5 text-[11.5px] text-ink-soft">{entry.helper}</p>
                    ) : null}
                    {entry.masked && badge.set ? (
                      <p className="mt-1 font-mono text-[11px] text-ink-faint">{entry.masked}</p>
                    ) : null}
                    {entry.sharedWith ? (
                      <p className="mt-1 text-[11px] text-ink-faint">
                        Shared with {entry.sharedWith}
                      </p>
                    ) : null}
                    {entry.helpUrl ? (
                      <a
                        href={entry.helpUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-[11.5px] font-medium text-primary hover:underline"
                      >
                        Where to find this
                      </a>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </section>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            onClick={() => {
              onClose()
              onEdit(group.id)
            }}
          >
            <KeyRound size={14} aria-hidden="true" />
            Edit credentials
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
