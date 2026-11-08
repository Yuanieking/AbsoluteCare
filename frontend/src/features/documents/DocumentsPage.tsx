import {
  Download,
  ExternalLink,
  FileText,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { useState } from 'react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageBody, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/session'
import { showError, showSuccess } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { downloadDocument, useDocuments, useRetryDocument } from './queries'
import { DOCUMENT_LABELS, type GeneratedDocument } from './types'

const typeOptions = [
  { value: '', label: 'All types' },
  ...Object.entries(DOCUMENT_LABELS).map(([value, label]) => ({ value, label })),
]

const driveOptions = [
  { value: '', label: 'Any Drive status' },
  { value: 'uploaded', label: 'Filed' },
  { value: 'pending', label: 'Pending sync' },
  { value: 'failed', label: 'Failed' },
]

const driveChip: Record<string, { label: string; className: string }> = {
  uploaded: {
    label: 'Filed',
    className: 'bg-status-completed-bg text-status-completed',
  },
  pending: { label: 'Pending sync', className: 'bg-signal-soft text-signal' },
  failed: { label: 'Failed', className: 'bg-status-cancelled-bg text-status-cancelled' },
}

function issuedDate(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(new Date(value))
}

export default function DocumentsPage() {
  const { user } = useAuth()
  const [type, setType] = useState('')
  const [driveStatus, setDriveStatus] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState('')
  const documents = useDocuments({
    type: type || undefined,
    driveStatus: driveStatus || undefined,
    search: search.trim() || undefined,
    page,
    limit: 20,
  })
  const retry = useRetryDocument()
  const rows = documents.data?.documents ?? []
  const pagination = documents.data?.pagination
  const canRetry = user?.role === 'admin' || user?.role === 'secretary'

  async function download(item: GeneratedDocument) {
    setBusy(item.id)
    try {
      await downloadDocument(item)
    } catch {
      showError('The PDF could not be downloaded. Try again.')
    } finally {
      setBusy('')
    }
  }

  async function retryUpload(item: GeneratedDocument) {
    setBusy(item.id)
    try {
      const updated = await retry.mutateAsync(item.id)
      showSuccess(
        updated.drive.status === 'uploaded'
          ? `Document ${item.trackingNumber} filed to Google Drive.`
          : 'The retry was queued. Check back in a few minutes.',
      )
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data
        ?.message
      showError(message || 'The retry could not be started.')
    } finally {
      setBusy('')
    }
  }

  return (
    <PageBody>
      <PageHeader
        eyebrow="Documents"
        title="Issued documents"
        description={
          user?.role === 'admin'
            ? 'Every PDF issued by the clinic, with its Drive status and verification link.'
            : 'Documents you generated. Each PDF is verified by its tracking number.'
        }
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void documents.refetch()}
          >
            <RefreshCw size={15} aria-hidden="true" /> Refresh
          </Button>
        }
      />

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">Search documents</span>
          <Search
            size={15}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint"
          />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Tracking number or subject"
            className="w-full rounded-md border border-hairline bg-card py-2 pr-3 pl-9 text-[12.5px] text-ink focus:border-primary focus:outline-none"
          />
        </label>
        <select
          aria-label="Filter by document type"
          value={type}
          onChange={(event) => {
            setType(event.target.value)
            setPage(1)
          }}
          className="rounded-md border border-hairline bg-card px-3 py-2 text-[12.5px] text-ink"
        >
          {typeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by Drive status"
          value={driveStatus}
          onChange={(event) => {
            setDriveStatus(event.target.value)
            setPage(1)
          }}
          className="rounded-md border border-hairline bg-card px-3 py-2 text-[12.5px] text-ink"
        >
          {driveOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {documents.error ? (
        <EmptyState
          className="mt-6"
          icon={<FileText size={22} />}
          title="Documents are unavailable"
          message={`${documents.error.message} Try loading the archive again.`}
          action={
            <Button type="button" onClick={() => void documents.refetch()}>
              Try again
            </Button>
          }
        />
      ) : documents.isLoading ? (
        <p className="mt-8 text-[12.5px] text-ink-soft">Loading documents…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={<FileText size={22} />}
          title="No documents yet"
          message="Generate one from Reports, a patient record, an appointment, or Payments."
        />
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-hairline bg-card">
          <table className="w-full border-collapse text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-hairline text-[11.5px] text-ink-soft">
                <th scope="col" className="px-3 py-2 font-medium">
                  Issued
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Type
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Tracking number
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Subject
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Issued by
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Drive
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const chip = driveChip[item.drive.status] ?? driveChip.pending!
                return (
                  <tr key={item.id} className="border-b border-hairline-in last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 text-ink-soft">
                      {issuedDate(item.issuedAt)}
                    </td>
                    <td className="px-3 py-2 text-ink">{DOCUMENT_LABELS[item.type]}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        title="Copy tracking number"
                        onClick={() => {
                          void navigator.clipboard.writeText(item.trackingNumber)
                          showSuccess('Tracking number copied.')
                        }}
                        className="font-mono text-[12px] text-ink hover:text-primary"
                      >
                        {item.trackingNumber}
                      </button>
                    </td>
                    <td className="max-w-[180px] truncate px-3 py-2 text-ink">{item.subject}</td>
                    <td className="px-3 py-2 text-ink-soft">
                      {item.generatedBy.name}
                      <span className="block text-[11px] text-ink-faint">
                        {item.generatedBy.role}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-medium',
                          chip.className,
                        )}
                        title={item.drive.lastError || undefined}
                      >
                        {chip.label}
                      </span>
                      {item.drive.attempts > 0 ? (
                        <span className="mt-0.5 block text-[10.5px] text-ink-faint">
                          {item.drive.attempts} attempt{item.drive.attempts === 1 ? '' : 's'}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => void download(item)}
                          disabled={busy === item.id}
                          className="inline-flex items-center gap-1 text-[11.5px] font-medium text-ink-soft hover:text-ink"
                        >
                          {busy === item.id ? (
                            <LoaderCircle size={13} className="animate-spin" aria-hidden="true" />
                          ) : (
                            <Download size={13} aria-hidden="true" />
                          )}
                          Download
                        </button>
                        {item.drive.webViewLink ? (
                          <a
                            href={item.drive.webViewLink}
                            target="_blank"
                            rel="noopener"
                            className="inline-flex items-center gap-1 text-[11.5px] font-medium text-ink-soft hover:text-ink"
                          >
                            <ExternalLink size={13} aria-hidden="true" /> Drive
                          </a>
                        ) : null}
                        <a
                          href={item.verifyUrl}
                          target="_blank"
                          rel="noopener"
                          className="inline-flex items-center gap-1 text-[11.5px] font-medium text-ink-soft hover:text-ink"
                        >
                          <ShieldCheck size={13} aria-hidden="true" /> Verify
                        </a>
                        {canRetry && item.drive.status !== 'uploaded' ? (
                          <button
                            type="button"
                            onClick={() => void retryUpload(item)}
                            disabled={busy === item.id}
                            className="text-[11.5px] font-medium text-ink-soft hover:text-ink"
                          >
                            Retry
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.pages > 1 ? (
        <div className="mt-3 flex items-center justify-between text-[12px] text-ink-soft">
          <span>
            Page {pagination.page} of {pagination.pages} · {pagination.total} documents
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= pagination.pages}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </PageBody>
  )
}
