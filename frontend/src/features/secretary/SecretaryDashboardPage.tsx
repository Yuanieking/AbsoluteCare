import { CalendarDays, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StatTile } from '@/components/domain/StatTile'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageBody, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useDelayedLoading } from '@/hooks/useDelayedLoading'
import { formatDateManila } from '@/lib/format/patient'
import {
  formatMoney,
  patientName,
  paymentAmount,
  scheduleTime,
  serviceName,
  todaySchedule,
} from './format'
import { useSecretaryPayments, useSecretarySchedule } from './queries'

export default function SecretaryDashboardPage() {
  const scheduleQuery = useSecretarySchedule({ status: 'confirmed', date: 'today', therapist: '' })
  const unpaidQuery = useSecretaryPayments('unpaid')

  const loading = scheduleQuery.isLoading || unpaidQuery.isLoading
  const showSkeleton = useDelayedLoading(loading)
  const error = scheduleQuery.error?.message || ''

  if (loading && !showSkeleton) {
    return (
      <PageBody>
        <p className="sr-only" role="status">
          Loading today’s schedule
        </p>
      </PageBody>
    )
  }

  if (error) {
    return (
      <PageBody>
        <EmptyState
          icon={<RefreshCw size={20} />}
          title="We couldn’t load today’s schedule"
          message={error}
          action={
            <Button
              type="button"
              onClick={() => {
                void scheduleQuery.refetch()
                void unpaidQuery.refetch()
              }}
            >
              Try again
            </Button>
          }
        />
      </PageBody>
    )
  }

  const today = new Date()
  const schedule = todaySchedule(scheduleQuery.data?.appointments ?? [], today)
  const unpaid = unpaidQuery.data ?? []
  const outstanding = unpaid.reduce((total, appointment) => total + paymentAmount(appointment), 0)

  return (
    <PageBody>
      <PageHeader
        eyebrow="Secretary workspace"
        title="Clinic schedule"
        description="Keep appointments and payments accurate for every visit."
        meta={
          <p className="mt-1 text-[11.5px] text-ink-faint">
            {formatDateManila(today)} · All times in Asia/Manila
          </p>
        }
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <StatTile
          loading={loading}
          label="Today's appointments"
          value={schedule.length}
          caption={
            schedule.length
              ? 'Confirmed visits the clinic is expecting today.'
              : 'No confirmed visits today.'
          }
          action="Open schedule"
          href="/staff/secretary/schedule"
        />
        <StatTile
          loading={loading}
          label="Unpaid visits"
          value={unpaid.length}
          caption={
            unpaid.length
              ? `${formatMoney(outstanding)} still waiting to be settled.`
              : 'Every completed visit is settled.'
          }
          action="Collect payment"
          href="/staff/secretary/payments?status=unpaid"
          className={unpaid.length ? 'border-signal/25' : undefined}
        />
      </div>

      <section
        aria-labelledby="today-title"
        className="mt-4 rounded-lg border border-hairline bg-card p-5"
      >
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11.5px] font-medium text-ink-faint">Today</p>
            <h2
              id="today-title"
              className="mt-0.5 text-[17px] font-semibold tracking-[-0.01em] text-ink"
            >
              Today’s schedule
            </h2>
            <p className="mt-0.5 text-[12.5px] text-ink-soft">
              Confirmed visits the clinic is expecting today.
            </p>
          </div>
          <Link
            to="/staff/secretary/schedule"
            className="text-[12.5px] font-medium text-primary hover:underline"
          >
            Open schedule
          </Link>
        </header>

        {loading && showSkeleton ? (
          <div className="mt-4 grid gap-2" aria-busy="true">
            {[1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-10 rounded-md" />
            ))}
          </div>
        ) : schedule.length ? (
          <ol className="mt-4 divide-y divide-hairline-in">
            {schedule.map((appointment) => (
              <li
                key={appointment._id}
                className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <span className="w-16 shrink-0 text-[12.5px] font-medium text-ink-soft tabular-nums">
                  {scheduleTime(appointment)}
                </span>
                <Link to="/staff/secretary/schedule" className="min-w-0 flex-1 rounded-sm">
                  <strong className="block truncate text-[13px] text-ink">
                    {patientName(appointment)}
                  </strong>
                  <span className="block truncate text-[12px] text-ink-soft">
                    {serviceName(appointment)}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState
            icon={<CalendarDays size={19} />}
            title="No visits today"
            message="Confirmed appointments for today will appear here."
            action={
              <Button asChild variant="outline" size="sm">
                <Link to="/staff/secretary/schedule">Open clinic schedule</Link>
              </Button>
            }
          />
        )}
      </section>
    </PageBody>
  )
}
