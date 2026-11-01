import { CalendarDays, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DataTable, type AppColumnDef } from '@/components/data-table/DataTable'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { FilterBar } from '@/components/domain/FilterBar'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageBody, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { appointmentDate, appointmentTime, therapistName } from '@/lib/format/patient'
import { showPromise } from '@/lib/toast'
import { RescheduleDialog } from './RescheduleDialog'
import { useCancelAppointment } from './mutations'
import { useAppointmentList, type AppointmentTab } from './queries'
import type { Appointment } from './types'

const tabs: { key: AppointmentTab; label: string }[] = [
  { key: 'pending', label: 'Pending requests' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'previous', label: 'Previous' },
]

export default function AppointmentsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<AppointmentTab>('pending')
  const [rescheduleId, setRescheduleId] = useState<string | null>(null)
  const list = useAppointmentList(tab)
  const cancelMutation = useCancelAppointment()

  const appointments = list.data?.pages.flatMap((page) => page.appointments) ?? []
  const total = list.data?.pages[0]?.total ?? 0
  const rescheduleOpen = appointments.find((item) => item._id === rescheduleId)

  async function cancel(appointment: Appointment) {
    if (!window.confirm('Cancel this appointment?')) return
    const request = cancelMutation.mutateAsync(appointment._id)
    showPromise(request, {
      loading: 'Cancelling appointment...',
      success: 'Appointment cancelled.',
      error: "Couldn't cancel the appointment.",
    })
    try {
      await request
    } catch {}
  }

  const columns: AppColumnDef<Appointment>[] = [
    {
      id: 'date',
      meta: { label: 'Date' },
      header: 'Date',
      accessorFn: (appointment) => appointment.scheduledStart || appointment.requestedDate || '',
      cell: ({ row }) => <strong className="font-medium">{appointmentDate(row.original)}</strong>,
    },
    {
      id: 'time',
      meta: { label: 'Time' },
      header: 'Time',
      accessorFn: (appointment) => appointment.scheduledStart || appointment.requestedTime || '',
      cell: ({ row }) => appointmentTime(row.original),
    },
    {
      id: 'service',
      meta: { label: 'Service' },
      header: 'Service',
      accessorFn: (appointment) => appointment.service?.name || 'Therapy session',
    },
    {
      id: 'therapist',
      meta: { label: 'Therapist' },
      header: 'Therapist',
      accessorFn: (appointment) => therapistName(appointment.therapist),
    },
    {
      id: 'status',
      meta: { label: 'Status' },
      header: 'Status',
      accessorFn: (appointment) =>
        appointment.rescheduleRequest?.status === 'requested'
          ? 'Reschedule requested'
          : appointment.status,
      cell: ({ row }) => (
        <StatusBadge
          status={
            row.original.rescheduleRequest?.status === 'requested'
              ? 'Reschedule requested'
              : row.original.status
          }
        />
      ),
    },
    {
      id: 'actions',
      meta: { label: 'Actions' },
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const appointment = row.original
        const requested = appointment.rescheduleRequest?.status === 'requested'
        return (
          <div
            className="flex flex-wrap items-center gap-2"
            onClick={(event) => event.stopPropagation()}
          >
            <Link
              to={`/dashboard/appointments/${appointment._id}`}
              className="text-[12px] font-medium text-primary hover:underline"
            >
              Open
            </Link>
            {(tab === 'pending' || tab === 'upcoming') && (
              <button
                type="button"
                disabled={requested}
                onClick={() => setRescheduleId(appointment._id)}
                className="text-[12px] text-ink-soft hover:text-ink disabled:opacity-50"
              >
                {requested ? 'Requested' : 'Reschedule'}
              </button>
            )}
            {tab === 'upcoming' && (
              <button
                type="button"
                onClick={() => void cancel(appointment)}
                className="text-[12px] text-destructive hover:underline"
              >
                Cancel
              </button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <PageBody>
      <PageHeader
        eyebrow="Your schedule"
        title="My appointments"
        actions={
          <Button asChild>
            <Link to="/dashboard/book">Book appointment</Link>
          </Button>
        }
      />

      <div className="mt-5">
        <FilterBar
          tabs={tabs}
          activeTab={tab}
          onTabChange={(key) => setTab(key as AppointmentTab)}
          chips={[]}
        />
      </div>

      <p className="mt-3 text-[12px] text-ink-soft">
        {total} {total === 1 ? 'appointment' : 'appointments'}
      </p>

      <DataTable
        className="mt-2"
        columns={columns}
        data={appointments}
        isLoading={list.isLoading}
        getRowId={(appointment) => appointment._id}
        rowLabel={(appointment) => `Open appointment on ${appointmentDate(appointment)}`}
        onRowClick={(appointment) => navigate(`/dashboard/appointments/${appointment._id}`)}
        empty={
          list.error ? (
            <EmptyState
              icon={<RefreshCw size={22} />}
              title="We couldn’t load your appointments"
              message={list.error.message}
              action={
                <Button type="button" variant="outline" onClick={() => void list.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<CalendarDays size={22} />}
              title={
                tab === 'pending'
                  ? 'No pending requests'
                  : tab === 'upcoming'
                    ? 'No upcoming appointments'
                    : 'No previous appointments'
              }
              message={
                tab === 'previous'
                  ? 'Completed visits and appointment outcomes will appear here.'
                  : 'Book a visit and your schedule will appear here.'
              }
              action={
                <Button asChild>
                  <Link to="/dashboard/book">Book an appointment</Link>
                </Button>
              }
            />
          )
        }
      />

      {list.hasNextPage ? (
        <div className="mt-3 flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={list.isFetchingNextPage}
            onClick={() => void list.fetchNextPage()}
          >
            {list.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}

      <RescheduleDialog
        appointmentId={rescheduleId}
        open={Boolean(rescheduleOpen)}
        onOpenChange={(open) => {
          if (!open) setRescheduleId(null)
        }}
      />
    </PageBody>
  )
}
