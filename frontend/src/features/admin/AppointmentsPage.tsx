import { CalendarDays, Eye, RefreshCw, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DataTable, type AppColumnDef } from '@/components/data-table/DataTable'
import { DateRangePicker } from '@/components/domain/DateRangePicker'
import { FilterBar } from '@/components/domain/FilterBar'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageBody, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { AppointmentDialogs, type AppointmentDialogType } from './AppointmentDialogs'
import {
  appointmentStart,
  formatDateTime,
  hasStarted,
  patientName,
  personName,
  serviceName,
  therapistName,
} from './format'
import { useAdminAppointments, useAdminServices, useAdminUsers } from './queries'
import type { AdminAppointment } from './types'

const tabs = [
  { key: 'pending', label: 'Pending' },
  { key: 'upcoming', label: 'Confirmed' },
  { key: 'previous', label: 'History' },
]

const statusOptions = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'rescheduled', label: 'Rescheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No-show' },
]

const historyStatuses = ['completed', 'cancelled', 'no_show']

type RowAction = { label: string; onClick: () => void; disabled?: boolean; reason?: string }

export default function AppointmentsPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'pending'
  const status = params.get('status') || 'all'
  const search = params.get('search') || ''
  const therapist = params.get('therapist') || ''
  const service = params.get('service') || ''
  const from = params.get('from') || ''
  const to = params.get('to') || ''
  const page = Number(params.get('page') || 1)
  const [searchText, setSearchText] = useState(search)
  const [dialog, setDialog] = useState<{
    type: AppointmentDialogType
    appointment: AdminAppointment
  } | null>(null)

  function update(next: Record<string, string | number | undefined>, replace = true) {
    const merged = new URLSearchParams(params)
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined || value === '' || value === 'all') merged.delete(key)
      else merged.set(key, String(value))
    }
    setParams(merged, { replace })
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const next = searchText.trim()
      if (next === search) return
      const merged = new URLSearchParams(params)
      if (next) merged.set('search', next)
      else merged.delete('search')
      merged.delete('page')
      setParams(merged, { replace: true })
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [params, search, searchText, setParams])

  const appointments = useAdminAppointments(
    {
      tab,
      status,
      search,
      therapist: therapist || undefined,
      service: service || undefined,
      from,
      to,
      page,
    },
    30000,
  )
  const services = useAdminServices()
  const therapistRecords = useAdminUsers({ role: 'therapist', status: 'active', limit: 50 })
  const rows = appointments.data?.appointments ?? []
  const pagination = appointments.data?.pagination

  const serviceOptions = [
    { value: 'all', label: 'All services' },
    ...(services.data ?? []).map((item) => ({ value: item._id, label: item.name || 'Unnamed' })),
  ]
  const therapistOptions = [
    { value: 'all', label: 'All therapists' },
    ...(therapistRecords.data?.users ?? []).map((item) => ({
      value: item._id,
      label: personName(item) || 'Unnamed therapist',
    })),
  ]

  function actions(appointment: AdminAppointment): RowAction[] {
    if (historyStatuses.includes(appointment.status)) {
      return [{ label: 'View', onClick: () => setDialog({ type: 'view', appointment }) }]
    }
    if (appointment.status === 'pending') {
      const pending = [
        appointment.therapist
          ? { label: 'Confirm', onClick: () => setDialog({ type: 'confirm', appointment }) }
          : {
              label: 'Review request',
              onClick: () => setDialog({ type: 'requestReview', appointment }),
            },
      ]
      return [
        ...pending,
        {
          label: appointment.therapist ? 'Reassign' : 'Assign',
          onClick: () => setDialog({ type: 'assign', appointment }),
        },
        { label: 'Cancel', onClick: () => setDialog({ type: 'cancel', appointment }) },
      ]
    }
    // Confirmed: same order for every row, and the terminal actions say why
    // they are unavailable instead of hiding.
    const started = hasStarted(appointment)
    const finishReason = started ? undefined : 'Available once the session starts'
    return [
      ...(appointment.rescheduleRequest?.status === 'requested'
        ? [{ label: 'Review request', onClick: () => setDialog({ type: 'review', appointment }) }]
        : []),
      { label: 'Reschedule', onClick: () => setDialog({ type: 'reschedule', appointment }) },
      { label: 'Cancel', onClick: () => setDialog({ type: 'cancel', appointment }) },
      {
        label: 'Mark completed',
        onClick: () => setDialog({ type: 'complete', appointment }),
        disabled: !started,
        reason: finishReason,
      },
      {
        label: 'Mark no-show',
        onClick: () => setDialog({ type: 'noShow', appointment }),
        disabled: !started,
        reason: finishReason,
      },
    ]
  }

  const columns: AppColumnDef<AdminAppointment>[] = [
    {
      id: 'date',
      meta: { label: 'Date and time' },
      header: 'Date and time',
      accessorFn: (appointment) => appointmentStart(appointment) || '',
      cell: ({ row }) => (
        <span className="whitespace-nowrap">{formatDateTime(appointmentStart(row.original))}</span>
      ),
    },
    {
      id: 'patient',
      meta: { label: 'Patient' },
      header: 'Patient',
      accessorFn: (appointment) => patientName(appointment),
      cell: ({ row }) => <span className="font-medium text-ink">{patientName(row.original)}</span>,
    },
    {
      id: 'service',
      meta: { label: 'Service' },
      header: 'Service',
      accessorFn: (appointment) => serviceName(appointment),
      cell: ({ row }) => <span className="text-ink-soft">{serviceName(row.original)}</span>,
    },
    {
      id: 'therapist',
      meta: { label: 'Therapist' },
      header: 'Therapist',
      accessorFn: (appointment) => therapistName(appointment),
      cell: ({ row }) => (
        <span className={row.original.therapist ? 'text-ink' : 'text-signal'}>
          {therapistName(row.original)}
        </span>
      ),
    },
    {
      id: 'status',
      meta: { label: 'Status' },
      header: 'Status',
      accessorFn: (appointment) => appointment.status,
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-1">
          <StatusBadge status={row.original.status} />
          {row.original.rescheduleRequest?.status === 'requested' ? (
            <span className="rounded-full bg-signal-soft px-2 py-0.5 text-[10.5px] font-medium text-signal">
              Reschedule requested
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'actions',
      meta: { label: 'Actions' },
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div
          className="flex flex-wrap justify-end gap-1"
          onClick={(event) => event.stopPropagation()}
        >
          {actions(row.original).map((action) => {
            const destructive = action.label === 'Cancel' || action.label === 'Mark no-show'
            return (
              <Button
                key={action.label}
                type="button"
                size="xs"
                variant="ghost"
                disabled={action.disabled}
                title={action.reason}
                className={
                  destructive ? 'text-destructive hover:bg-destructive-soft/70' : undefined
                }
                onClick={action.onClick}
              >
                {action.label === 'View' ? <Eye size={13} aria-hidden="true" /> : null}
                {action.label}
              </Button>
            )
          })}
        </div>
      ),
    },
  ]

  return (
    <PageBody>
      <PageHeader
        eyebrow="Scheduling"
        title="Appointments"
        description="Move each patient request through the clinic schedule."
      />

      <div className="mt-5">
        <FilterBar
          tabs={tabs}
          activeTab={tab}
          onTabChange={(key) => update({ tab: key, page: undefined })}
          search={searchText}
          onSearch={setSearchText}
          searchPlaceholder="Search patient or therapist"
          filters={[
            {
              key: 'status',
              label: 'Appointment status',
              value: status,
              options: statusOptions,
              onChange: (value) => update({ status: value, page: undefined }),
            },
            {
              key: 'service',
              label: 'Therapy service',
              value: service || 'all',
              options: serviceOptions,
              onChange: (value) => update({ service: value, page: undefined }),
            },
            {
              key: 'therapist',
              label: 'Therapist',
              value: therapist || 'all',
              options: therapistOptions,
              onChange: (value) => update({ therapist: value, page: undefined }),
            },
          ]}
          chips={[
            ...(from || to
              ? [
                  {
                    key: 'range',
                    label: `Date: ${from || 'any'} – ${to || 'any'}`,
                    onRemove: () => update({ from: undefined, to: undefined, page: undefined }),
                  },
                ]
              : []),
          ]}
        >
          <DateRangePicker
            value={{ from, to }}
            onChange={(range) => update({ from: range.from, to: range.to, page: undefined })}
          />
        </FilterBar>
      </div>

      <DataTable
        className="mt-3"
        columns={columns}
        data={rows}
        isLoading={appointments.isLoading}
        getRowId={(appointment) => appointment._id}
        rowLabel={(appointment) =>
          `${patientName(appointment)} · ${formatDateTime(appointmentStart(appointment))}`
        }
        onRowClick={(appointment) => setDialog({ type: 'view', appointment })}
        serverPagination={
          pagination
            ? {
                page: pagination.page,
                pageCount: pagination.pages,
                total: pagination.total ?? rows.length,
                onPageChange: (next) => update({ page: next }),
              }
            : undefined
        }
        empty={
          appointments.error ? (
            <EmptyState
              icon={<RefreshCw size={22} />}
              title="We couldn’t load appointments"
              message={appointments.error.message}
              action={
                <Button type="button" variant="outline" onClick={() => void appointments.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : search ? (
            <EmptyState
              icon={<Search size={22} />}
              title="No appointments match your search"
              message={`Nothing found matching “${search}”.`}
              action={
                <Button type="button" variant="outline" onClick={() => setSearchText('')}>
                  Clear search
                </Button>
              }
            />
          ) : service || therapist || from || to ? (
            <EmptyState
              icon={<CalendarDays size={22} />}
              title="No appointments match these filters"
              message="Try another service, therapist, or date range."
              action={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    update({
                      service: undefined,
                      therapist: undefined,
                      from: undefined,
                      to: undefined,
                      page: undefined,
                    })
                  }
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<CalendarDays size={22} />}
              title="No appointments found"
              message="There are no appointments matching this view."
            />
          )
        }
      />

      <AppointmentDialogs
        key={dialog ? `${dialog.appointment._id}-${dialog.type}` : 'closed'}
        state={dialog}
        onClose={() => setDialog(null)}
      />
    </PageBody>
  )
}
