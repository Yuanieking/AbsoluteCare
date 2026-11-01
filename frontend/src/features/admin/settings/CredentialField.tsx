import { ExternalLink } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { formatDate } from '../format'
import type { CredentialKeyEntry } from './types'

function maskParts(masked = '') {
  const index = masked.indexOf('•')
  if (index === -1) return { head: masked, rest: '' }
  return { head: masked.slice(0, index), rest: masked.slice(index) }
}

function sourceLabel(source?: string) {
  if (source === 'app') return 'App'
  if (source === 'env') return '.env'
  return 'Not set'
}

export function CredentialField({
  entry,
  value,
  onChange,
  error,
  disabled,
}: {
  entry: CredentialKeyEntry & { stale?: boolean }
  value: string
  onChange: (value: string) => void
  error?: string
  disabled?: boolean
}) {
  const inputId = `credential-${entry.key}`
  const helperId = `${inputId}-helper`
  const errorId = `${inputId}-error`
  const { head, rest } = maskParts(entry.masked)
  const notSet = !entry.masked || entry.masked === 'Not set'
  const label = notSet
    ? `${entry.label}, not set`
    : `${entry.label}, currently set${head ? `, starts with ${head}` : ''}`

  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={inputId} className="text-[12.5px] font-medium text-ink">
          {entry.label}
          {entry.required ? <span className="text-destructive"> *</span> : null}
        </label>
        <span className="rounded-full bg-sunk px-1.5 py-0.5 text-[10.5px] text-ink-soft">
          {sourceLabel(entry.source)}
        </span>
        {entry.updatedAt ? (
          <span className="text-[10.5px] text-ink-faint">
            {formatDate(entry.updatedAt)}
            {entry.updatedBy?.name ? ` · ${entry.updatedBy.name}` : ''}
          </span>
        ) : null}
        {entry.verified === false ? (
          <span className="rounded-full bg-signal-soft px-1.5 py-0.5 text-[10.5px] text-signal">
            Unverified
          </span>
        ) : null}
        {entry.stale ? (
          <span className="rounded-full bg-signal-soft px-1.5 py-0.5 text-[10.5px] text-signal">
            Stale
          </span>
        ) : null}
      </div>

      <p className="font-mono text-[12px] text-ink-soft" aria-label={label}>
        {notSet ? (
          <span className="text-signal">Not set</span>
        ) : (
          <>
            <span aria-hidden="true">{head}</span>
            <span aria-hidden="true">{rest}</span>
          </>
        )}
      </p>

      <Input
        id={inputId}
        type="password"
        value={value}
        autoComplete="new-password"
        spellCheck={false}
        placeholder="Leave blank to keep the current value"
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${helperId} ${errorId}` : helperId}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 font-mono text-[13px]"
      />

      <p id={helperId} className="flex flex-wrap items-center gap-2 text-[11.5px] text-ink-soft">
        <span>{entry.helper}</span>
        {entry.helpUrl ? (
          <a
            href={entry.helpUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            Where to find this <ExternalLink size={11} aria-hidden="true" />
          </a>
        ) : null}
        {entry.sharedWith === 'email' ? <span>Shared with Email provider.</span> : null}
      </p>

      {error ? (
        <p id={errorId} role="alert" className="text-[11.5px] text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
