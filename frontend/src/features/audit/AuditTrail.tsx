import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { DataTable, type AppColumnDef } from '@/components/data-table/DataTable'
import { PageBody, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/features/auth/session'
import { getToastError, showError } from '@/lib/toast'
import { auditDetail, exportAudit, listAudit, type AuditEntry, type AuditFilters } from './api'

const categories = [
  'account',
  'patient',
  'appointment',
  'session',
  'payment',
  'service',
  'document',
  'settings',
  'integration',
  'notification',
  'backup',
]
const timestamp = (value: string) =>
  new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'Asia/Manila',
  }).format(new Date(value))
const defaults: AuditFilters = {
  page: 1,
  search: '',
  actor: '',
  role: '',
  category: '',
  result: '',
  from: '',
  to: '',
}

export function AuditTrail({ admin = false }: { admin?: boolean }) {
  const { user } = useAuth()
  const [filters, setFilters] = useState(defaults)
  const [draft, setDraft] = useState(defaults)
  const [selected, setSelected] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const query = useQuery({
    queryKey: ['audit', user?.id, admin, filters],
    queryFn: () => listAudit(filters),
  })
  const detail = useQuery({
    queryKey: ['audit-detail', user?.id, selected],
    queryFn: () => auditDetail(selected!),
    enabled: Boolean(selected),
  })
  const columns: AppColumnDef<AuditEntry>[] = [
    {
      id: 'at',
      header: 'Time · Manila',
      accessorFn: (row) => row.at,
      cell: ({ row }) => timestamp(row.original.at),
    },
    ...(admin
      ? [
          {
            id: 'actor',
            header: 'Actor',
            accessorFn: (row: AuditEntry) =>
              `${row.actorName || 'System'} (${row.actorRole || 'system'})`,
          },
        ]
      : []),
    { accessorKey: 'category', header: 'Category' },
    { accessorKey: 'action', header: 'Action' },
    {
      id: 'record',
      header: 'Record',
      accessorFn: (row) => `${row.resourceType} · ${row.resourceId}`,
    },
    { accessorKey: 'result', header: 'Result' },
  ]
  function update(key: keyof AuditFilters, value: string) {
    setDraft((current) => ({ ...current, [key]: value }))
  }
  async function download() {
    setExporting(true)
    try {
      const blob = await exportAudit(filters)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'absolutecare-audit.csv'
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      showError(getToastError(error, 'Audit export failed.'))
    } finally {
      setExporting(false)
    }
  }
  const select = (key: 'role' | 'category' | 'result', choices: string[]) => (
    <label className="grid gap-1 text-[12px] capitalize" key={key}>
      {key}
      <select
        className="h-9 rounded-md border border-hairline bg-card px-2"
        value={draft[key]}
        onChange={(event) => update(key, event.target.value)}
      >
        <option value="">All {key === 'category' ? 'categories' : `${key}s`}</option>
        {choices.map((value) => (
          <option key={value} value={value}>
            {value === 'user' ? 'patient' : value}
          </option>
        ))}
      </select>
    </label>
  )
  return (
    <section className="mt-5 grid gap-4 rounded-lg border border-hairline bg-card p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{admin ? 'All system changes' : 'My activity'}</h2>
          <p className="text-[12px] text-ink-soft">
            Times are Asia/Manila (UTC+08). Historical entries show only details that were
            originally recorded.
          </p>
        </div>
        {admin && (
          <Button variant="outline" disabled={exporting} onClick={() => void download()}>
            {exporting ? 'Exporting…' : 'Export filtered CSV'}
          </Button>
        )}
      </header>
      <form
        className="grid gap-3 sm:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault()
          setFilters({ ...draft, page: 1 })
        }}
      >
        <label className="grid gap-1 text-[12px]">
          Search
          <Input value={draft.search} onChange={(event) => update('search', event.target.value)} />
        </label>
        {admin && (
          <label className="grid gap-1 text-[12px]">
            Actor name
            <Input value={draft.actor} onChange={(event) => update('actor', event.target.value)} />
          </label>
        )}
        {admin && select('role', ['admin', 'secretary', 'therapist', 'user', 'system'])}
        {select('category', categories)}
        {select('result', ['success', 'failure'])}
        <label className="grid gap-1 text-[12px]">
          From (Manila)
          <Input
            type="date"
            value={draft.from}
            onChange={(event) => update('from', event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-[12px]">
          Through (Manila)
          <Input
            type="date"
            value={draft.to}
            min={draft.from || undefined}
            onChange={(event) => update('to', event.target.value)}
          />
        </label>
        <div className="flex items-end gap-2">
          <Button type="submit">Apply filters</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDraft(defaults)
              setFilters(defaults)
            }}
          >
            Reset
          </Button>
        </div>
      </form>
      {query.error ? (
        <p role="alert">
          Could not load audit logs.{' '}
          <Button variant="outline" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </p>
      ) : null}
      <DataTable
        columns={columns}
        data={query.data?.entries || []}
        isLoading={query.isLoading}
        getRowId={(row) => row._id}
        onRowClick={(row) => setSelected(row._id)}
        rowLabel={(row) => `${row.action} at ${timestamp(row.at)}`}
        caption={admin ? 'System audit trail' : 'Private activity'}
        serverPagination={{
          page: filters.page,
          total: query.data?.pagination.total || 0,
          pageCount: query.data?.pagination.pages || 1,
          onPageChange: (page) => setFilters((current) => ({ ...current, page })),
        }}
      />
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Audit entry</DialogTitle>
            <DialogDescription>
              Read-only event details. Secret values and clinical text are redacted.
            </DialogDescription>
          </DialogHeader>
          {detail.isLoading ? (
            <p role="status">Loading details…</p>
          ) : detail.error ? (
            <p role="alert">Could not load this entry.</p>
          ) : detail.data ? (
            <div className="grid gap-3 text-sm">
              <p>
                {timestamp(detail.data.at)} · {detail.data.action} · {detail.data.result}
              </p>
              <p className="break-all">
                {detail.data.resourceType}: {detail.data.resourceId}
              </p>
              {admin && (
                <p>
                  {detail.data.actorName} · {detail.data.actorRole} · {detail.data.source} · Actor
                  ID: {detail.data.actorId || 'system'}
                </p>
              )}
              {detail.data.changes?.map((change) => (
                <div key={change.field} className="rounded-md bg-sunk p-3">
                  <strong className="break-all">{change.field}</strong>
                  <pre className="mt-1 whitespace-pre-wrap break-all text-xs">
                    {JSON.stringify(change.before)} → {JSON.stringify(change.after)}
                  </pre>
                </div>
              ))}
              {!admin && (
                <p>
                  Only activity metadata is shared here; private staff notes and other users’
                  details are omitted.
                </p>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  )
}
export function MyActivityPage() {
  return <PageBody><PageHeader eyebrow="Account" title="My activity" description="Read-only history of actions you performed." /><AuditTrail /></PageBody>
}

export default function AuditLogPage() {
  return (
    <PageBody>
      <PageHeader
        eyebrow="Administration"
        title="Audit log"
        description="Persistent, read-only history of system changes. No automatic expiration."
      />
      <AuditTrail admin />
    </PageBody>
  )
}
