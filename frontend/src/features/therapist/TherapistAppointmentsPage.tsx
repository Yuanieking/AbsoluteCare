import { CalendarDays, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { DataTable, type AppColumnDef } from '@/components/data-table/DataTable'
import { FilterBar } from '@/components/domain/FilterBar'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageBody, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { NoShowDialog, RecordSessionDialog, RescheduleDialog } from './AppointmentDialogs'
import {
  appointmentLabel,
  appointmentMoment,
  canRecordOutcome,
  canRequestReschedule,
  matchesTab,
  openRescheduleRequest,
  patientEmail,
  patientName,
  serviceName,
  tabCounts,
  type AppointmentTab,
} from './format'
import { useTherapistAppointments } from './queries'
import type { Appointment } from './types'

export default function TherapistAppointmentsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [now] = useState(() => Date.now())
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null)
  const [sessionTarget, setSessionTarget] = useState<Appointment | null>(null)
  const [noShowTarget, setNoShowTarget] = useState<Appointment | null>(null)

  const requested = searchParams.get('tab')
  const tab: AppointmentTab | '' =
    requested === 'upcoming' || requested === 'previous' ? requested : ''
  const query = useTherapistAppointments()

  const all = query.data ?? []
  const counts = tabCounts(all, now)
  const rows = (tab ? all.filter((item) => matchesTab(item, tab, now)) : all).sort(
    (first, second) =>
      (appointmentMoment(second)?.getTime() ?? 0) - (appointmentMoment(first)?.getTime() ?? 0),
  )

  function changeTab(next: string) {
    setSearchParams(next ? { tab: next } : {})
  }

  const columns: AppColumnDef<Appointment>[] = [
    {
      id: 'schedule',
      meta: { label: 'Date & time' },
      header: 'Date & time',
      accessorFn: (appointment) => appointmentMoment(appointment)?.getTime() ?? 0,
      cell: ({ row }) => (
        <strong className="font-medium whitespace-nowrap">{appointmentLabel(row.original)}</strong>
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
            {patientEmail(row.original) || 'No email on file'}
          </span>
        </div>
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
      id: 'actions',
      meta: { label: 'Actions' },
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const appointment = row.original
        const requested = openRescheduleRequest(appointment)
        const confirmed = appointment.status?.toLowerCase() === 'confirmed'
        return (
          <div
            className="flex flex-wrap items-center justify-end gap-1"
            onClick={(event) => event.stopPropagation()}
          >
            {requested ? (
              <span className="text-[11px] text-signal">
                Requested {requested} · awaiting admin
              </span>
            ) : canRequestReschedule(appointment, now) ? (
              <Button variant="ghost" size="xs" onClick={() => setRescheduleTarget(appointment)}>
                Request reschedule
              </Button>
            ) : null}
            {canRecordOutcome(appointment, now) ? (
              <>
                <Button variant="ghost" size="xs" onClick={() => setSessionTarget(appointment)}>
                  Record session
                </Button>
                <Button variant="ghost" size="xs" onClick={() => setNoShowTarget(appointment)}>
                  Mark no-show
                </Button>
              </>
            ) : confirmed ? (
              <Button variant="ghost" size="xs" disabled title="Available once the session starts">
                Mark no-show
              </Button>
            ) : null}
            <Button variant="link" size="xs" asChild>
              <Link to={`/staff/therapist/appointments/${appointment._id}`}>View</Link>
            </Button>
          </div>
        )
      },
    },
  ]

  const emptyTitle =
    tab === 'upcoming'
      ? 'No upcoming appointments'
      : tab === 'previous'
        ? 'No previous appointments'
        : 'No appointments assigned'

  return (
    <PageBody>
      <PageHeader
        eyebrow="My care desk"
        title="My appointments"
        description="Review your assigned visits and next actions."
      />

      <div className="mt-5">
        <FilterBar
          tabs={[
            { key: '', label: 'Assigned / all', count: counts.total },
            { key: 'upcoming', label: 'Upcoming', count: counts.upcoming },
            { key: 'previous', label: 'Previous', count: counts.previous },
          ]}
          activeTab={tab}
          onTabChange={changeTab}
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
        onRowClick={(appointment) => navigate(`/staff/therapist/appointments/${appointment._id}`)}
        empty={
          query.error ? (
            <EmptyState
              icon={<RefreshCw size={22} />}
              title="We couldn’t load your appointments"
              message={query.error.message}
              action={
                <Button type="button" variant="outline" onClick={() => void query.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<CalendarDays size={22} />}
              title={emptyTitle}
              message={
                tab === 'upcoming'
                  ? 'Your next confirmed appointments will appear here.'
                  : tab === 'previous'
                    ? 'Completed and previous visits will be recorded here.'
                    : 'No appointments currently match this filter.'
              }
              action={
                tab ? (
                  <Button type="button" variant="outline" onClick={() => changeTab('')}>
                    View all appointments
                  </Button>
                ) : null
              }
            />
          )
        }
      />

      <RescheduleDialog
        appointment={rescheduleTarget}
        open={Boolean(rescheduleTarget)}
        onOpenChange={(open) => {
          if (!open) setRescheduleTarget(null)
        }}
      />
      <RecordSessionDialog
        appointment={sessionTarget}
        open={Boolean(sessionTarget)}
        onOpenChange={(open) => {
          if (!open) setSessionTarget(null)
        }}
      />
      <NoShowDialog
        appointment={noShowTarget}
        open={Boolean(noShowTarget)}
        onOpenChange={(open) => {
          if (!open) setNoShowTarget(null)
        }}
      />
    </PageBody>
  )
}
