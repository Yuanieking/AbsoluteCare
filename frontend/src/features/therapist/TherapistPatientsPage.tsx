import { RefreshCw, Search, Users } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DataTable, type AppColumnDef } from '@/components/data-table/DataTable'
import { FilterBar } from '@/components/domain/FilterBar'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageBody, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDateManila, formatDateTimeManila } from '@/lib/format/patient'
import { personName } from './format'
import { useTherapistPatients } from './queries'
import type { PatientRecord } from './types'

function initials(first = '', last = '') {
  return `${first[0] || ''}${last[0] || ''}`.toUpperCase() || 'P'
}

function recordName(record: PatientRecord) {
  return personName(record.dependent) || personName(record.patient) || 'Patient'
}

export default function TherapistPatientsPage() {
  const navigate = useNavigate()
  const query = useTherapistPatients()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<PatientRecord | null>(null)

  const term = search.trim().toLowerCase()
  const records = (query.data ?? []).filter((record) => {
    if (!term) return true
    const fields = [
      personName(record.patient),
      personName(record.dependent),
      record.patient.email || '',
    ]
    return fields.some((field) => field.toLowerCase().includes(term))
  })

  const columns: AppColumnDef<PatientRecord>[] = [
    {
      id: 'patient',
      meta: { label: 'Patient' },
      header: 'Patient',
      accessorFn: (record) => recordName(record),
      cell: ({ row }) => {
        const { patient, dependent } = row.original
        return (
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sunk text-[11px] font-semibold text-ink-soft"
              aria-hidden="true"
            >
              {dependent
                ? initials(dependent.firstName, dependent.lastName)
                : initials(
                    patient.firstname || patient.firstName,
                    patient.lastname || patient.lastName,
                  )}
            </span>
            <div className="min-w-0">
              <span className="block truncate font-medium text-ink">
                {recordName(row.original)}
              </span>
              <span className="block truncate text-[11.5px] text-ink-soft">
                {dependent
                  ? `Dependent of ${personName(patient) || 'a guardian'}`
                  : patient.email || 'No email on file'}
              </span>
            </div>
          </div>
        )
      },
    },
    {
      id: 'next',
      meta: { label: 'Next appointment' },
      header: 'Next appointment',
      accessorFn: (record) => record.nextAppointment?.scheduledStart || '',
      cell: ({ row }) =>
        row.original.nextAppointment?.scheduledStart ? (
          <strong className="font-medium">
            {formatDateTimeManila(row.original.nextAppointment.scheduledStart)}
          </strong>
        ) : (
          <span className="text-ink-faint">None scheduled</span>
        ),
    },
    {
      id: 'lastSession',
      meta: { label: 'Last session' },
      header: 'Last session',
      accessorFn: (record) => record.lastSessionDate || '',
      cell: ({ row }) =>
        row.original.lastSessionDate ? (
          <span>{formatDateManila(row.original.lastSessionDate)}</span>
        ) : (
          <span className="text-ink-faint">No session yet</span>
        ),
    },
    {
      id: 'actions',
      meta: { label: 'Actions' },
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
          <Button variant="link" size="xs" onClick={() => setSelected(row.original)}>
            View
          </Button>
        </div>
      ),
    },
  ]

  return (
    <PageBody>
      <PageHeader
        eyebrow="Care relationships"
        title="My patients"
        description="People assigned to your care, with their next touchpoint."
      />

      <div className="mt-5">
        <FilterBar
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search by patient name or email…"
          chips={[]}
        />
      </div>

      <DataTable
        className="mt-3"
        columns={columns}
        data={records}
        isLoading={query.isLoading}
        getRowId={(record) => record.patient._id + (record.dependent?._id || '')}
        rowLabel={(record) => `Open ${recordName(record)}`}
        onRowClick={setSelected}
        empty={
          query.error ? (
            <EmptyState
              icon={<RefreshCw size={22} />}
              title="We couldn’t load your patients"
              message={query.error.message}
              action={
                <Button type="button" variant="outline" onClick={() => void query.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : term ? (
            <EmptyState
              icon={<Search size={22} />}
              title="No patients match your search"
              message={`No records found matching “${search.trim()}”. Check the spelling or clear the filter.`}
              action={
                <Button type="button" variant="outline" onClick={() => setSearch('')}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<Users size={22} />}
              title="No patients assigned yet"
              message="When patients schedule visits or are assigned to your care, they will appear here."
            />
          )
        }
      />

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selected ? recordName(selected) : 'Patient profile'}</DialogTitle>
            <DialogDescription>Contact details and care touchpoints.</DialogDescription>
          </DialogHeader>
          {selected ? (
            <dl className="grid gap-2 rounded-md bg-sunk p-3.5 text-[12.5px]">
              <Row
                label={
                  selected.dependent
                    ? `${personName(selected.patient)} · contact email`
                    : 'Contact email'
                }
                value={selected.patient.email || 'Not set'}
              />
              {selected.patient.phone ? <Row label="Phone" value={selected.patient.phone} /> : null}
              <Row
                label="Next appointment"
                value={
                  selected.nextAppointment?.scheduledStart
                    ? formatDateTimeManila(selected.nextAppointment.scheduledStart)
                    : 'None scheduled'
                }
              />
              <Row
                label="Last session"
                value={
                  selected.lastSessionDate
                    ? formatDateManila(selected.lastSessionDate)
                    : 'No session recorded yet'
                }
              />
            </dl>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSelected(null)}>
              Close
            </Button>
            <Button
              type="button"
              onClick={() => {
                setSelected(null)
                navigate('/staff/therapist/my-appointments')
              }}
            >
              View appointments
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageBody>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  )
}
