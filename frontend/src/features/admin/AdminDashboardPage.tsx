import { AlertCircle, CalendarDays, CheckCircle2, RefreshCw, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChartCard } from '@/components/domain/ChartCard'
import { StatTile } from '@/components/domain/StatTile'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageBody, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useDelayedLoading } from '@/hooks/useDelayedLoading'
import { showPromise } from '@/lib/toast'
import { AppointmentDialogs } from './AppointmentDialogs'
import { ServicesBars, StatusMix, WorkloadGauges } from './charts'
import {
  appointmentStart,
  formatDateTime,
  formatDay,
  formatMoney,
  formatTime,
  patientName,
  therapistName,
} from './format'
import { useConfirmAppointment } from './mutations'
import { useAdminAppointments, useAdminReports } from './queries'
import type { AdminAppointment } from './types'

function dayBounds() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { from: start.toISOString(), to: end.toISOString() }
}

function monthBounds() {
  const now = new Date()
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    to: now.toISOString(),
  }
}

export default function AdminDashboardPage() {
  const [bounds] = useState(monthBounds)
  const reports = useAdminReports(bounds)
  const pending = useAdminAppointments({ tab: 'pending', page: 1, limit: 5 })
  const today = useAdminAppointments({ ...dayBounds(), tab: 'upcoming', page: 1, limit: 8 })
  const confirm = useConfirmAppointment()
  const [assignTarget, setAssignTarget] = useState<AdminAppointment | null>(null)

  const loading = reports.isLoading || pending.isLoading || today.isLoading
  const showSkeleton = useDelayedLoading(loading)

  if (loading && !showSkeleton) {
    return (
      <PageBody>
        <p className="sr-only" role="status">
          Loading the clinic dashboard
        </p>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-6 h-24 rounded-lg" />
      </PageBody>
    )
  }

  const report = reports.data
  const pendingRows = pending.data?.appointments ?? []
  const todayRows = today.data?.appointments ?? []
  const pendingTotal = pending.data?.pagination?.total ?? pendingRows.length
  const todayTotal = today.data?.pagination?.total ?? todayRows.length
  const unpaid = report?.payments?.unpaid
  const workload = (report?.therapistWorkload || []).filter(
    (row) => (row.assigned || 0) > 0 || (row.completed || 0) > 0,
  )
  const byStatus = report?.appointments?.byStatus || []
  const sessions = report?.sessions || []
  const trend = report?.trend ?? []
  const trendSeries = {
    requests: trend.map((point) => ({ label: formatDay(point.date), value: point.requests })),
    appointments: trend.map((point) => ({
      label: formatDay(point.date),
      value: point.appointments,
    })),
    patients: trend.map((point) => ({ label: formatDay(point.date), value: point.patients })),
    outstanding: trend.map((point) => ({
      label: formatDay(point.date),
      value: point.outstanding,
    })),
  }

  function confirmRequest(appointment: AdminAppointment) {
    if (!appointment.therapist) {
      setAssignTarget(appointment)
      return
    }
    confirmById(appointment._id)
  }

  function confirmById(appointmentId: string) {
    const request = confirm.mutateAsync(appointmentId)
    showPromise(request, {
      loading: 'Confirming appointment...',
      success: 'Appointment confirmed.',
      error: 'Couldn’t confirm appointment.',
    })
    request.catch(() => undefined)
  }

  function assignThenConfirm(appointmentId: string) {
    setAssignTarget(null)
    confirmById(appointmentId)
  }

  return (
    <PageBody>
      <PageHeader
        eyebrow="Admin overview"
        title="Clinic today"
        description={new Intl.DateTimeFormat('en-PH', { dateStyle: 'full' }).format(new Date())}
        actions={
          <Button asChild>
            <Link to="/staff/admin/users">
              <UserPlus size={16} aria-hidden="true" /> Add user
            </Link>
          </Button>
        }
      />

      {pendingTotal > 0 ? (
        <aside
          role="status"
          className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-signal/25 bg-signal-soft px-4 py-3"
        >
          <AlertCircle size={18} aria-hidden="true" className="text-signal" />
          <span className="min-w-0 flex-1">
            <strong className="block text-[13px] text-ink">
              Appointment requests are waiting for review.
            </strong>
            <small className="block text-[12px] text-signal">
              Keep the schedule moving by reviewing the newest requests.
            </small>
          </span>
          <Link
            to="/staff/admin/appointments?tab=pending"
            className="text-[12.5px] font-medium text-primary hover:underline"
          >
            Review now
          </Link>
        </aside>
      ) : null}

      {reports.error ? (
        <div className="mt-5">
          <EmptyState
            icon={<RefreshCw size={20} />}
            title="We couldn’t load the clinic summary"
            message={reports.error.message}
            action={
              <Button type="button" variant="outline" onClick={() => void reports.refetch()}>
                Try again
              </Button>
            }
          />
        </div>
      ) : null}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Admin summary">
        <StatTile
          loading={loading}
          label="Pending requests"
          value={pendingTotal}
          caption={
            pendingTotal
              ? pendingTotal === 1
                ? 'Request waiting for review.'
                : 'Requests waiting for review.'
              : 'Nothing is waiting for review.'
          }
          href="/staff/admin/appointments?tab=pending"
          series={trendSeries.requests}
          seriesType="line"
          seriesColor="var(--color-chart-1)"
          className={pendingTotal ? 'border-signal/25' : undefined}
        />
        <StatTile
          loading={loading}
          label="Appointments today"
          value={todayTotal}
          caption={
            todayTotal ? 'Visits booked on today’s calendar.' : 'Nothing on today’s schedule.'
          }
          href="/staff/admin/appointments?tab=upcoming"
          series={trendSeries.appointments}
          seriesType="bar"
          seriesColor="var(--color-chart-2)"
        />
        <StatTile
          loading={loading}
          label="Patients on file"
          value={report?.patients?.total ?? 0}
          caption="Every patient file in one list."
          href="/staff/admin/users?role=patient"
          series={trendSeries.patients}
          seriesType="area"
          seriesColor="var(--color-chart-3)"
        />
        <StatTile
          loading={loading}
          label="Outstanding balances"
          value={formatMoney(unpaid?.total)}
          caption={
            unpaid?.count
              ? `${unpaid.count} ${unpaid.count === 1 ? 'visit is' : 'visits are'} awaiting payment.`
              : 'Every recorded visit is paid.'
          }
          href="/staff/admin/payments?status=unpaid"
          series={trendSeries.outstanding}
          seriesType="line"
          seriesColor="var(--color-chart-4)"
          seriesFormat={formatMoney}
          className={unpaid?.count ? 'border-signal/25' : undefined}
        />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section
          aria-labelledby="pending-title"
          className="rounded-lg border border-hairline bg-card p-5"
        >
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2
                id="pending-title"
                className="text-[17px] font-semibold tracking-[-0.01em] text-ink"
              >
                Pending requests
              </h2>
              <p className="mt-0.5 text-[12.5px] text-ink-soft">
                Newest first. Confirming one books the slot.
              </p>
            </div>
            <Link
              to="/staff/admin/appointments?tab=pending"
              className="text-[12.5px] font-medium text-primary hover:underline"
            >
              View all
            </Link>
          </header>

          {pending.error ? (
            <p role="alert" className="mt-4 text-[12.5px] text-destructive">
              {pending.error.message}{' '}
              <button type="button" className="underline" onClick={() => void pending.refetch()}>
                Try again
              </button>
            </p>
          ) : pendingRows.length ? (
            <ul className="mt-4 divide-y divide-hairline-in">
              {pendingRows.map((appointment) => (
                <li
                  key={appointment._id}
                  className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0"
                >
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate text-[13px] text-ink">
                      {patientName(appointment)}
                    </strong>
                    <span className="block truncate text-[12px] text-ink-soft">
                      {appointment.service?.name || appointment.serviceSnapshot?.name || 'Therapy'}{' '}
                      · {formatDateTime(appointmentStart(appointment))}
                    </span>
                  </div>
                  <StatusBadge status={appointment.status} />
                  <Button
                    type="button"
                    size="xs"
                    disabled={confirm.isPending}
                    onClick={() => confirmRequest(appointment)}
                  >
                    {confirm.isPending ? 'Confirming…' : 'Confirm'}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<CheckCircle2 size={19} />}
              title="No pending requests"
              message="You’re all caught up."
            />
          )}
        </section>

        <div className="grid gap-4">
          <section
            aria-labelledby="today-title"
            className="rounded-lg border border-hairline bg-card p-5"
          >
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2
                  id="today-title"
                  className="text-[17px] font-semibold tracking-[-0.01em] text-ink"
                >
                  Today’s schedule
                </h2>
                <p className="mt-0.5 text-[12.5px] text-ink-soft">
                  Confirmed visits on the clinic calendar.
                </p>
              </div>
              <Link
                to="/staff/admin/appointments?tab=upcoming"
                className="text-[12.5px] font-medium text-primary hover:underline"
              >
                View schedule
              </Link>
            </header>

            {todayRows.length ? (
              <ol className="mt-4 divide-y divide-hairline-in">
                {todayRows.map((appointment) => (
                  <li
                    key={appointment._id}
                    className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0"
                  >
                    <span className="w-16 shrink-0 text-[12.5px] font-medium text-ink-soft tabular-nums">
                      {formatTime(appointment.scheduledStart)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-[13px] text-ink">
                        {patientName(appointment)}
                      </strong>
                      <span className="block truncate text-[12px] text-ink-soft">
                        {therapistName(appointment)}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState
                icon={<CalendarDays size={19} />}
                title="No appointments today"
                message="The clinic schedule is clear."
              />
            )}
          </section>

          <section
            aria-labelledby="actions-title"
            className="rounded-lg border border-hairline bg-card p-5"
          >
            <h2
              id="actions-title"
              className="text-[17px] font-semibold tracking-[-0.01em] text-ink"
            >
              Quick actions
            </h2>
            <ul className="mt-3 grid gap-1.5">
              {[
                { to: '/staff/admin/services', label: 'Add therapy service' },
                { to: '/staff/admin/payments', label: 'Record payment' },
                { to: '/staff/admin/reports', label: 'View reports' },
              ].map((action) => (
                <li key={action.to}>
                  <Link
                    to={action.to}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-ink hover:bg-sunk"
                  >
                    {action.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <AppointmentDialogs
        key={assignTarget?._id ?? 'closed'}
        state={assignTarget ? { type: 'assign', appointment: assignTarget } : null}
        onClose={() => setAssignTarget(null)}
        onAssigned={assignThenConfirm}
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <ChartCard
          title="Appointments by status"
          subtitle="Status mix this month."
          state={
            loading ? 'loading' : byStatus.some((item) => (item.count || 0) > 0) ? 'ready' : 'empty'
          }
          height={228}
        >
          <StatusMix items={byStatus} />
        </ChartCard>

        <ChartCard
          title="Therapist workload"
          subtitle="Completed visits against assigned this month."
          state={loading ? 'loading' : workload.length ? 'ready' : 'empty'}
          height={228}
        >
          <WorkloadGauges items={workload.slice(0, 4)} />
        </ChartCard>

        <ChartCard
          title="Sessions by service"
          subtitle="Where completed visits come from."
          state={
            loading ? 'loading' : sessions.some((item) => (item.count || 0) > 0) ? 'ready' : 'empty'
          }
          height={228}
        >
          <ServicesBars items={sessions} />
        </ChartCard>
      </div>
    </PageBody>
  )
}
