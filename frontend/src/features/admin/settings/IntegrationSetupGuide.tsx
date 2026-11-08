import { Check, Copy, Download, KeyRound } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { CredentialGroup } from './types'

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard?.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="inline-flex items-center gap-1 text-[11.5px] font-medium text-primary hover:underline"
    >
      {copied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
      {copied ? 'Copied' : label}
    </button>
  )
}

export function IntegrationSetupGuide({
  groups,
  onEdit,
  onDownload,
  downloading,
}: {
  groups: CredentialGroup[]
  onEdit: (group: string) => void
  onDownload: () => void
  downloading: boolean
}) {
  return (
    <section
      id="integration-setup-guide"
      aria-labelledby="setup-guide-title"
      className="mt-4 rounded-lg border border-hairline bg-card p-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11.5px] font-medium text-ink-faint">Handover</p>
          <h2 id="setup-guide-title" className="mt-0.5 text-[17px] font-semibold text-ink">
            Setup guide
          </h2>
          <p className="mt-0.5 max-w-[60ch] text-[12.5px] text-ink-soft">
            Everything the next owner needs to rebuild these connections on a new server. Keys are
            never shown in full.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={downloading}
          onClick={onDownload}
        >
          <Download size={14} aria-hidden="true" />
          {downloading ? 'Preparing...' : 'Download handover pack'}
        </Button>
      </header>

      <div className="mt-4 grid gap-3">
        {groups.map((group) => (
          <article key={group.id} className="rounded-md border border-hairline p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[13px] font-semibold text-ink">{group.title}</h3>
              <span
                className={
                  group.status.configured
                    ? 'rounded-full bg-status-completed-bg px-2 py-0.5 text-[10.5px] font-medium text-status-completed'
                    : 'rounded-full bg-signal-soft px-2 py-0.5 text-[10.5px] font-medium text-signal'
                }
              >
                {group.status.configured ? 'Configured' : `Missing ${group.status.missing.length}`}
              </span>
            </div>
            <p className="mt-0.5 text-[12px] text-ink-soft">{group.purpose}</p>

            <ul className="mt-2 grid gap-1">
              {group.keys.map((key) => (
                <li
                  key={key.key}
                  className="flex flex-wrap items-center justify-between gap-2 text-[11.5px]"
                >
                  <code className="font-mono text-ink">{key.key}</code>
                  <span className="text-ink-soft">
                    {key.kind === 'public' || key.kind === 'config' ? 'shown in full' : 'masked'}
                    {key.required ? ' · required' : ''}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              {group.helpUrl ? (
                <a
                  href={group.helpUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11.5px] font-medium text-primary hover:underline"
                >
                  Open the provider console
                </a>
              ) : null}
              {group.redirectUri ? (
                <span className="flex flex-wrap items-center gap-2">
                  <code className="font-mono text-[11px] text-ink-soft">{group.redirectUri}</code>
                  <CopyButton value={group.redirectUri} label="Copy redirect URI" />
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => onEdit(group.id)}
                className="inline-flex items-center gap-1 text-[11.5px] font-medium text-ink-soft hover:text-ink"
              >
                <KeyRound size={12} aria-hidden="true" /> Edit credentials
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-4">
        <h3 className="text-[13px] font-semibold text-ink">Transfer checklist</h3>
        <ol className="mt-1 grid list-decimal gap-1 pl-5 text-[12px] text-ink-soft">
          <li>Rotate the credentials that belong to the old owner.</li>
          <li>Restart the server and confirm the cards turn green.</li>
          <li>Run each integration test, then send a test email.</li>
          <li>Download the handover pack and store it with the clinic records.</li>
        </ol>
      </div>
    </section>
  )
}
