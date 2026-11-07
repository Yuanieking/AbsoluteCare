import { ClipboardList, Eye, RefreshCw, Search } from 'lucide-react'
import { useState } from 'react'
import { DataTable, type AppColumnDef } from '@/components/data-table/DataTable'
import { DateRangePicker } from '@/components/domain/DateRangePicker'
import { FilterBar } from '@/components/domain/FilterBar'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageBody, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { GenerateDocumentButton } from '@/features/documents/GenerateDocumentButton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDate, formatDuration, personName } from './format'
import { useAdminServices, useAdminSessions } from './queries'
import type { SessionRecord } from './types'

function sessionService(session: SessionRecord) {
  return session.service?.name || 'Therapy session'
}

function monthRange(value?: string) {
  const date = value ? new Date(value) : new Date()
  const from = new Date(date.getFullYear(), date.getMonth(), 1)
  const to = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
  return { from: from.toISOString(), to: to.toISOString() }
}

export default function SessionsPage() {
  const [search, setSearch] = useState('')
  const [range, setRange] = useState({ from: '', to: '' })
  const [service, setService] = useState('all')
  const [selected, setSelected] = useState<SessionRecord | null>(null)
  const services = useAdminServices()
  const sessions = useAdminSessions({
    from: range.from || undefined,
    to: range.to || undefined,
    service: service === 'all' ? undefined : service,
  })

  const term = search.trim().toLowerCase()
  const filtered = Boolean(term || range.from || range.to || service !== 'all')
  const serviceOptions = [
    { value: 'all', label: 'All services' },
    ...(services.data ?? []).map((item) => ({ value: item._id, label: item.name || 'Unnamed' })),
  ]

  const rows = (sessions.data ?? []).filter((session) => {
    if (!term) return true
    return [
      personName(session.patient),
      personName(session.therapist),
      sessionService(session),
      session.clinicalNotes,
      session.patientVisibleNotes,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(term)
  })

  const columns: AppColumnDef<SessionRecord>[] = [
    {
      id: 'date',
      meta: { label: 'Date' },
      header: 'Date',
      accessorFn: (session) => session.sessionDate || '',
      cell: ({ row }) => (
        <span className="whitespace-nowrap">{formatDate(row.original.sessionDate)}</span>
      ),
    },
    {
      id: 'patient',
      meta: { label: 'Patient' },
      header: 'Patient',
      accessorFn: (session) => personName(session.patient),
      cell: ({ row }) => (
        <span className="font-medium text-ink">{personName(row.original.patient)}</span>
      ),
    },
    {
      id: 'therapist',
      meta: { label: 'Therapist' },
      header: 'Therapist',
      accessorFn: (session) => personName(session.therapist),
      cell: ({ row }) => (
        <span className="text-ink-soft">
          {personName(row.original.therapist) || 'Not recorded'}
        </span>
      ),
    },
    {
      id: 'service',
      meta: { label: 'Service' },
      header: 'Service',
      accessorFn: (session) => sessionService(session),
      cell: ({ row }) => <span className="text-ink-soft">{sessionService(row.original)}</span>,
    },
    {
      id: 'duration',
      meta: { label: 'Duration' },
      header: 'Duration',
      accessorFn: (session) => session.durationMinutes || 0,
      cell: ({ row }) => <span>{formatDuration(row.original.durationMinutes)}</span>,
    },
    {
      id: 'actions',
      meta: { label: 'View' },
      header: () => <span className="sr-only">View</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
          <GenerateDocumentButton
            input={{
              type: 'patient_summary',
              patientId: (row.original.patient as { _id?: string })?._id || '',
              ...monthRange(row.original.sessionDate),
            }}
            label="Summary"
            variant="ghost"
            size="xs"
            disabled={!((row.original.patient as { _id?: string })?._id)}
          />
          <Button
            type="button"
            variant="ghost"
            size="xs"
            aria-label={`View session for ${personName(row.original.patient)}`}
            onClick={() => setSelected(row.original)}
          >
            <Eye size={13} aria-hidden="true" /> View
          </Button>
        </div>
      ),
    },
  ]

  return (
    <PageBody>
      <PageHeader
        eyebrow="Clinical oversight"
        title="Session history"
        description="Admin access includes full clinical notes for operational oversight."
      />

      <div className="mt-5">
        <FilterBar
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search patient, therapist or notes"
          filters={[
            {
              key: 'service',
              label: 'Therapy service',
              value: service,
              options: serviceOptions,
              onChange: setService,
            },
          ]}
          chips={
            range.from || range.to
              ? [
                  {
                    key: 'range',
                    label: `Date: ${range.from || 'any'} to ${range.to || 'any'}`,
                    onRemove: () => setRange({ from: '', to: '' }),
                  },
                ]
              : []
          }
          onClear={
            filtered
              ? () => {
                  setSearch('')
                  setRange({ from: '', to: '' })
                  setService('all')
                }
              : undefined
          }
        >
          <DateRangePicker value={range} onChange={setRange} />
        </FilterBar>
      </div>

      <DataTable
        className="mt-3"
        columns={columns}
        data={rows}
        isLoading={sessions.isLoading}
        getRowId={(session) => session._id}
        rowLabel={(session) =>
          `${personName(session.patient)} · ${formatDate(session.sessionDate)}`
        }
        onRowClick={(session) => setSelected(session)}
        caption="Session history"
        empty={
          sessions.error ? (
            <EmptyState
              icon={<RefreshCw size={22} />}
              title="We couldn’t load session history"
              message={sessions.error.message}
              action={
                <Button type="button" variant="outline" onClick={() => void sessions.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : filtered ? (
            <EmptyState
              icon={<Search size={22} />}
              title="No sessions match these filters"
              message={
                term
                  ? `Nothing found matching “${search.trim()}” in this view.`
                  : 'No sessions were recorded for this service and date range.'
              }
              action={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSearch('')
                    setRange({ from: '', to: '' })
                    setService('all')
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<ClipboardList size={22} />}
              title="No sessions recorded yet"
              message="Completed sessions will appear here."
            />
          )
        }
      />

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => (open ? undefined : setSelected(null))}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Session notes</DialogTitle>
            <DialogDescription>
              {personName(selected?.patient)} · {formatDate(selected?.sessionDate)}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <p className="text-[11.5px] text-ink-faint">Patient-visible notes</p>
              <p className="mt-1 text-[13px] text-ink">
                {selected?.patientVisibleNotes || 'No patient-visible notes.'}
              </p>
            </div>
            <div>
              <p className="text-[11.5px] text-ink-faint">Clinical notes</p>
              <p className="mt-1 text-[13px] text-ink">
                {selected?.clinicalNotes || 'No clinical notes.'}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageBody>
  )
}
