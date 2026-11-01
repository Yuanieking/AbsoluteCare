import { CalendarDays, RefreshCw, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DataTable, type AppColumnDef } from '@/components/data-table/DataTable'
import { FilterBar } from '@/components/domain/FilterBar'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageBody, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { AppointmentDetailDialog } from './AppointmentDetailDialog'
import {
  formatMoney,
  patientCaption,
  patientName,
  paymentAmount,
  personName,
  scheduleLabel,
  serviceName,
  therapistLabel,
} from './format'
import { PaymentDialog } from './PaymentDialog'
import { useSecretarySchedule } from './queries'
import type { SecretaryAppointment, TherapistOption } from './types'

const statusOptions = [
  { value: 'confirmed', label: 'Upcoming confirmed' },
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No-show' },
]

const dateOptions = [
  { value: '', label: 'Any date' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
]

function therapistOptions(therapists: TherapistOption[]) {
  return [
    { value: '', label: 'All therapists' },
    ...therapists.map((therapist) => ({
      value: therapist._id,
      label: personName(therapist) || 'Therapist',
    })),
  ]
}

function matchesSearch(appointment: SecretaryAppointment, term: string) {
  if (!term) return true
  const haystack = [
    personName(appointment.patient),
    appointment.dependent?.firstName,
    appointment.dependent?.lastName,
    appointment.patient?.email,
    personName(appointment.therapist),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(term)
}

export default function SecretarySchedulePage() {
  const [filters, setFilters] = useState({ status: 'confirmed', date: '', therapist: '' })
  const [search, setSearch] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [paymentTarget, setPaymentTarget] = useState<SecretaryAppointment | null>(null)

  const query = useSecretarySchedule(filters)
  const term = search.trim().toLowerCase()
  const rows = useMemo(() => {
    const appointments = query.data?.appointments ?? []
    return appointments.filter((item) => matchesSearch(item, term))
  }, [query.data, term])

  function updateFilter(key: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  const columns: AppColumnDef<SecretaryAppointment>[] = [
    {
      id: 'schedule',
      meta: { label: 'Date and time' },
      header: 'Date and time',
      accessorFn: (appointment) => appointment.scheduledStart || appointment.requestedDate || '',
      cell: ({ row }) => (
        <strong className="font-medium whitespace-nowrap">{scheduleLabel(row.original)}</strong>
      ),
    },
    {
      id: 'patient',
      meta: { label: 'Patient' },
      header: 'Patient',
      accessorFn: (appointment) => patientName(appointment),
      cell: ({ row }) => (
        <div className="min-w-0">
          <span className="block truncate font-medium text-ink">{patientName(row.original)}</span>
          <span className="block truncate text-[11.5px] text-ink-soft">
            {patientCaption(row.original)}
          </span>
        </div>
      ),
    },
    {
      id: 'therapist',
      meta: { label: 'Therapist' },
      header: 'Therapist',
      accessorFn: (appointment) => therapistLabel(appointment),
      cell: ({ row }) => (
        <span className={row.original.therapist ? 'text-ink' : 'text-ink-faint'}>
          {therapistLabel(row.original)}
        </span>
      ),
    },
    {
      id: 'service',
      meta: { label: 'Service' },
      header: 'Service',
      accessorFn: (appointment) => serviceName(appointment),
      cell: ({ row }) => <span className="text-ink-soft">{serviceName(row.original)}</span>,
    },
    {
      id: 'status',
      meta: { label: 'Status' },
      header: 'Status',
      accessorFn: (appointment) => appointment.status,
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'payment',
      meta: { label: 'Payment' },
      header: 'Payment',
      accessorFn: (appointment) => appointment.payment?.status || 'unpaid',
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <StatusBadge status={row.original.payment?.status || 'unpaid'} />
          <span className="text-[11px] text-ink-faint tabular-nums">
            {formatMoney(paymentAmount(row.original))}
          </span>
        </div>
      ),
    },
    {
      id: 'actions',
      meta: { label: 'Actions' },
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
          <Button variant="link" size="xs" onClick={() => setDetailId(row.original._id)}>
            View
          </Button>
        </div>
      ),
    },
  ]

  return (
    <PageBody>
      <PageHeader
        eyebrow="Scheduling"
        title="Clinic schedule"
        description="Read-only appointment information for the front desk."
      />

      <div className="mt-5">
        <FilterBar
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search patient, therapist, or email…"
          filters={[
            {
              key: 'status',
              label: 'Appointment status',
              value: filters.status,
              options: statusOptions,
              onChange: (value) => updateFilter('status', value),
            },
            {
              key: 'date',
              label: 'Date range',
              value: filters.date,
              options: dateOptions,
              onChange: (value) => updateFilter('date', value),
            },
            {
              key: 'therapist',
              label: 'Therapist',
              value: filters.therapist,
              options: therapistOptions(query.data?.therapists ?? []),
              onChange: (value) => updateFilter('therapist', value),
            },
          ]}
          chips={[]}
        />
      </div>

      <DataTable
        className="mt-3"
        columns={columns}
        data={rows}
        isLoading={query.isLoading}
        getRowId={(appointment) => appointment._id}
        rowLabel={(appointment) => `Open ${patientName(appointment)}'s appointment`}
        onRowClick={(appointment) => setDetailId(appointment._id)}
        empty={
          query.error ? (
            <EmptyState
              icon={<RefreshCw size={22} />}
              title="We couldn’t load the schedule"
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
              title="No results match your search"
              message={`No appointments found matching “${search.trim()}”. Try another patient, therapist, or email.`}
              action={
                <Button type="button" variant="outline" onClick={() => setSearch('')}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<CalendarDays size={22} />}
              title="No appointments scheduled"
              message="Try another date, status, or therapist."
            />
          )
        }
      />

      <AppointmentDetailDialog
        appointmentId={detailId}
        onOpenChange={(open) => {
          if (!open) setDetailId(null)
        }}
        onRecordPayment={(appointment) => {
          setDetailId(null)
          setPaymentTarget(appointment)
        }}
      />

      <PaymentDialog
        appointment={paymentTarget}
        mode="record"
        open={Boolean(paymentTarget)}
        onOpenChange={(open) => {
          if (!open) setPaymentTarget(null)
        }}
        onSaved={(updated) => {
          setPaymentTarget(null)
          setDetailId(updated._id)
        }}
      />
    </PageBody>
  )
}
