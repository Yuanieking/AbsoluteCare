import { AlertTriangle, Ban, CheckCircle2, SearchX } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useVerifyDocument } from './queries'
import type { VerifyResult } from './types'

function formatDate(value: string | undefined) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(new Date(value))
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-paper px-5 py-14 text-ink">
      <div className="mx-auto w-full max-w-[560px] rounded-lg border border-hairline bg-card p-6 sm:p-8">
        {children}
      </div>
      <p className="mx-auto mt-6 max-w-[560px] text-center text-[11.5px] text-ink-faint">
        AbsoluteCare Therapy Center document register
      </p>
    </main>
  )
}

function StateMark({
  tone,
  icon: Icon,
  word,
}: {
  tone: 'valid' | 'warning' | 'danger' | 'neutral'
  icon: typeof CheckCircle2
  word: string
}) {
  const styles = {
    valid: 'bg-status-completed-bg text-status-completed',
    warning: 'bg-signal-soft text-signal',
    danger: 'bg-status-cancelled-bg text-status-cancelled',
    neutral: 'bg-hairline-in text-ink-soft',
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium ${styles[tone]}`}
    >
      <Icon size={14} aria-hidden="true" />
      {word}
    </span>
  )
}

function Facts({ result }: { result: VerifyResult }) {
  const rows: Array<[string, string]> = [
    ['Document', result.documentLabel || ''],
    ['Tracking number', result.trackingNumber || ''],
    ['Issued', formatDate(result.issuedAt)],
    ['Clinic', result.clinicName || ''],
  ].filter(([, value]) => Boolean(value)) as Array<[string, string]>
  return (
    <dl className="mt-5 space-y-2 border-t border-hairline pt-4 text-[12.5px]">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4">
          <dt className="text-ink-soft">{label}</dt>
          <dd className="text-right text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function VerifyPage() {
  const { trackingNumber } = useParams()
  const query = useVerifyDocument(trackingNumber)

  if (query.isLoading) {
    return (
      <Frame>
        <p className="text-[12.5px] text-ink-soft">Checking this document…</p>
      </Frame>
    )
  }

  if (query.error) {
    return (
      <Frame>
        <StateMark tone="neutral" icon={SearchX} word="Unavailable" />
        <h1 className="mt-3 font-display text-[22px] font-semibold tracking-[-0.02em]">
          We could not check this document.
        </h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">
          {query.error.message || 'Try again in a moment.'}
        </p>
      </Frame>
    )
  }

  const result = query.data
  if (!result || result.status === 'not_found') {
    return (
      <Frame>
        <StateMark tone="neutral" icon={SearchX} word="Not found" />
        <h1 className="mt-3 font-display text-[22px] font-semibold tracking-[-0.02em]">
          We could not verify this document.
        </h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">
          Check the tracking number on the PDF, or contact the clinic.
        </p>
      </Frame>
    )
  }

  if (result.status === 'revoked') {
    return (
      <Frame>
        <StateMark tone="danger" icon={Ban} word="Revoked" />
        <h1 className="mt-3 font-display text-[22px] font-semibold tracking-[-0.02em]">
          This document was cancelled by the clinic.
        </h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">
          Revoked on {formatDate(result.revokedAt)}. Ask the clinic for a current copy.
        </p>
        <Facts result={result} />
      </Frame>
    )
  }

  if (result.status === 'superseded') {
    return (
      <Frame>
        <StateMark tone="warning" icon={AlertTriangle} word="Replaced" />
        <h1 className="mt-3 font-display text-[22px] font-semibold tracking-[-0.02em]">
          This document was replaced.
        </h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">
          Replaced on {formatDate(result.supersededAt)} by a newer issue. Both remain on record.
        </p>
        <Facts result={result} />
        {result.supersededBy ? (
          <Link
            to={`/verify/${result.supersededBy}`}
            className="mt-5 inline-flex rounded-md bg-primary px-3 py-2 text-[12.5px] font-medium text-primary-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Verify {result.supersededBy}
          </Link>
        ) : null}
      </Frame>
    )
  }

  return (
    <Frame>
      <StateMark tone="valid" icon={CheckCircle2} word="Valid" />
      <h1 className="mt-3 font-display text-[22px] font-semibold tracking-[-0.02em]">
        This document is genuine.
      </h1>
      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">
        Issued by the clinic and still current.
      </p>
      <Facts result={result} />
    </Frame>
  )
}
