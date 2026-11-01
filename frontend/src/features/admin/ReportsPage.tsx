import { FileBarChart, FileText, Printer, RefreshCw } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChartCard } from '@/components/domain/ChartCard'
import { DateRangePicker } from '@/components/domain/DateRangePicker'
import { StatTile } from '@/components/domain/StatTile'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageBody, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { presetRange, type DateRange } from '@/lib/format/date-range'
import { paymentLegend } from './chart-data'
import { PaymentMethodsDonut, ServicesBars, StatusMix, WorkloadGauges } from './charts'
import { formatDate, formatDateTime, formatMoney } from './format'
import { useAdminReports } from './queries'
import type { Reports } from './types'

function toQuery(range: DateRange) {
  const from = range.from
    ? new Date(`${range.from}T00:00:00`)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const to = range.to ? new Date(`${range.to}T23:59:59.999`) : new Date()
  return { from: from.toISOString(), to: to.toISOString() }
}

function rangeLabel(range: DateRange) {
  if (range.from && range.to) return `${formatDate(range.from)} to ${formatDate(range.to)}`
  if (range.from) return `From ${formatDate(range.from)}`
  if (range.to) return `Until ${formatDate(range.to)}`
  return 'All dates'
}

function hoursLabel(minutes: number) {
  if (!minutes) return '0 h'
  const hours = minutes / 60
  return `${Math.round(hours * 10) / 10} h`
}

function sessionTotals(report?: Reports) {
  const rows = report?.sessions ?? []
  return {
    sessions: rows.reduce((total, item) => total + (item.count || 0), 0),
    minutes: rows.reduce((total, item) => total + (item.duration || 0), 0),
  }
}

function printSheet(range: DateRange) {
  const previous = document.title
  document.title = `Clinic report ${range.from || 'all'} ${range.to || 'all'}`
  window.print()
  document.title = previous
}

function Figure({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11.5px] font-medium text-ink-faint">{label}</p>
      <p className="mt-1 font-display text-[24px] leading-none font-semibold tracking-[-0.03em] text-ink tabular-nums">
        {value}
      </p>
      {note ? <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-soft">{note}</p> : null}
    </div>
  )
}

function ReportTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <table className="w-full border-collapse text-left text-[12px]">
      <thead>
        <tr>
          {head.map((label, index) => (
            <th
              key={label}
              scope="col"
              className={`border-b border-hairline py-1.5 font-medium text-ink-soft ${
                index === 0 ? 'pr-3' : 'px-3 text-right'
              }`}
            >
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((cells, rowIndex) => (
          <tr key={rowIndex}>
            {cells.map((cell, index) => (
              <td
                key={index}
                className={`border-b border-hairline-in py-1.5 text-ink ${
                  index === 0 ? 'pr-3' : 'px-3 text-right tabular-nums'
                }`}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ReportSheet({ report, range }: { report?: Reports; range: DateRange }) {
  const totals = sessionTotals(report)
  const byStatus = report?.appointments?.byStatus ?? []
  const workload = (report?.therapistWorkload ?? []).filter(
    (row) => (row.assigned || 0) > 0 || (row.completed || 0) > 0,
  )
  const methods = report?.payments?.byMethod ?? []
  const unpaid = report?.payments?.unpaid
  const completion = Math.round((report?.appointments?.completionRate || 0) * 100)
  const generated = formatDateTime(new Date().toISOString())

  const summary: [string, string][] = [
    ['Registered patients', String(report?.patients?.total ?? 0)],
    ['New patients in this period', String(report?.patients?.new ?? 0)],
    ['Patients with a recorded session', String(report?.patients?.withSessions ?? 0)],
    ['Appointments booked', String(report?.appointments?.total ?? 0)],
    ['Appointment completion rate', `${completion}%`],
    ['Sessions recorded', String(totals.sessions)],
    ['Therapy time delivered', hoursLabel(totals.minutes)],
    ['Payments collected', formatMoney(report?.payments?.revenue)],
    [
      'Open balances',
      `${unpaid?.count ?? 0} ${unpaid?.count === 1 ? 'visit' : 'visits'}, ${formatMoney(unpaid?.total)}`,
    ],
  ]

  return (
    <section
      aria-label="Clinic activity report"
      className="rounded-lg border border-hairline bg-card p-6"
    >
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-hairline pb-4">
        <div className="min-w-0">
          <p className="text-[11.5px] font-medium text-ink-faint">AbsoluteCare Therapy Center</p>
          <h2 className="mt-1 font-display text-[22px] leading-tight font-semibold tracking-[-0.02em] text-ink">
            Clinic activity report
          </h2>
          <p className="mt-1 text-[12.5px] text-ink-soft">
            {rangeLabel(range)}. Prepared {generated}.
          </p>
        </div>
        <Button type="button" onClick={() => printSheet(range)}>
          <Printer size={15} aria-hidden="true" />
          Print or save as PDF
        </Button>
      </header>

      <div className="mt-5 grid gap-6">
        <div>
          <h3 className="text-[13px] font-semibold text-ink">Clinic summary</h3>
          <div className="mt-2">
            <ReportTable
              head={['Measure', 'Value']}
              rows={summary.map(([label, value]) => [label, value])}
            />
          </div>
        </div>

        <div>
          <h3 className="text-[13px] font-semibold text-ink">Appointments by status</h3>
          <div className="mt-2">
            <ReportTable
              head={['Status', 'Appointments']}
              rows={
                byStatus.length
                  ? byStatus.map((item) => [
                      item._id ? item._id.replace('_', ' ') : 'Unrecorded',
                      String(item.count ?? 0),
                    ])
                  : [['No appointments in this period', '0']]
              }
            />
          </div>
        </div>

        <div>
          <h3 className="text-[13px] font-semibold text-ink">Therapist workload</h3>
          <div className="mt-2">
            <ReportTable
              head={['Therapist', 'Assigned', 'Completed']}
              rows={
                workload.length
                  ? workload.map((row) => [
                      row.name || 'Unassigned',
                      String(row.assigned ?? 0),
                      String(row.completed ?? 0),
                    ])
                  : [['No appointments assigned in this period', '0', '0']]
              }
            />
          </div>
        </div>

        <div>
          <h3 className="text-[13px] font-semibold text-ink">Sessions by service</h3>
          <div className="mt-2">
            <ReportTable
              head={['Service', 'Sessions', 'Therapy time']}
              rows={
                (report?.sessions ?? []).length
                  ? (report?.sessions ?? []).map((row) => [
                      row._id || 'Unlabelled',
                      String(row.count ?? 0),
                      hoursLabel(row.duration || 0),
                    ])
                  : [['No sessions recorded in this period', '0', '0 h']]
              }
            />
          </div>
        </div>

        <div>
          <h3 className="text-[13px] font-semibold text-ink">Payments by method</h3>
          <div className="mt-2">
            <ReportTable
              head={['Method', 'Visits', 'Collected']}
              rows={
                methods.length
                  ? methods.map((row) => [
                      row._id || 'Unrecorded',
                      String(row.count ?? 0),
                      formatMoney(row.total),
                    ])
                  : [['No payments recorded in this period', '0', formatMoney(0)]]
              }
            />
          </div>
        </div>
      </div>

      <p className="mt-5 border-t border-hairline pt-3 text-[11.5px] text-ink-soft">
        Figures come from appointment, session, and payment records for {rangeLabel(range)}. Visits
        still awaiting payment are listed under open balances.
      </p>
    </section>
  )
}

export default function ReportsPage() {
  const [range, setRange] = useState<DateRange>(() => presetRange('month'))
  const [preview, setPreview] = useState(false)
  const params = useMemo(() => toQuery(range), [range])
  const reports = useAdminReports(params)
  const report = reports.data

  const totals = sessionTotals(report)
  const byStatus = report?.appointments?.byStatus || []
  const workload = (report?.therapistWorkload || []).filter(
    (row) => (row.assigned || 0) > 0 || (row.completed || 0) > 0,
  )
  const methods = report?.payments?.byMethod || []
  const unpaid = report?.payments?.unpaid
  const completion = Math.round((report?.appointments?.completionRate || 0) * 100)
  const noShows = byStatus.find((item) => item._id === 'no_show')?.count || 0

  const legend = paymentLegend(methods)
  const hasStatus = byStatus.some((item) => (item.count || 0) > 0)
  const hasSessions = (report?.sessions ?? []).some((item) => (item.count || 0) > 0)
  const hasMethods = methods.some((item) => (item.total || 0) > 0)
  const hasPatients = Boolean(report?.patients?.total)
  const loading = reports.isLoading

  const tiles = [
    {
      label: 'Registered patients',
      value: report?.patients?.total || 0,
      caption: 'Patient accounts on record.',
    },
    {
      label: 'Appointments booked',
      value: report?.appointments?.total || 0,
      caption: 'Visits scheduled in this period.',
    },
    {
      label: 'Sessions recorded',
      value: totals.sessions,
      caption: `${hoursLabel(totals.minutes)} of therapy delivered.`,
    },
    {
      label: 'Payments collected',
      value: formatMoney(report?.payments?.revenue),
      caption: `${unpaid?.count || 0} visits still open.`,
    },
  ]

  if (reports.error) {
    return (
      <PageBody>
        <PageHeader
          eyebrow="Clinic insights"
          title="Reports"
          description="Patient, appointment, session, and payment records for the selected period."
        />
        <EmptyState
          className="mt-8"
          icon={<FileBarChart size={22} />}
          title="Reports are unavailable"
          message={`${reports.error.message} Try loading the clinic summary again.`}
          action={
            <Button type="button" onClick={() => void reports.refetch()}>
              Try again
            </Button>
          }
        />
      </PageBody>
    )
  }

  return (
    <PageBody>
      <PageHeader
        eyebrow="Clinic insights"
        title="Reports"
        description="Patient, appointment, session, and payment records for the selected period."
        actions={
          <>
            <DateRangePicker value={range} onChange={setRange} />
            <Button
              type="button"
              aria-expanded={preview}
              aria-controls="report-preview"
              onClick={() => setPreview((open) => !open)}
            >
              <FileText size={15} aria-hidden="true" />
              {preview ? 'Close preview' : 'Preview report'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Refresh report data"
              onClick={() => void reports.refetch()}
            >
              <RefreshCw size={15} aria-hidden="true" /> Refresh
            </Button>
          </>
        }
      />

      {preview ? (
        <div id="report-preview" className="mt-5">
          <ReportSheet report={report} range={range} />
        </div>
      ) : null}

      <section
        className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Clinic summary"
      >
        {tiles.map((tile) => (
          <StatTile
            key={tile.label}
            loading={loading}
            label={tile.label}
            value={tile.value}
            caption={tile.caption}
          />
        ))}
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Patient count"
          subtitle="Registered patients and accounts opened in this period."
          state={loading ? 'loading' : hasPatients ? 'ready' : 'empty'}
          emptyMessage="No patient accounts are on record yet."
          height={132}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Figure
              label="Registered patients"
              value={report?.patients?.total || 0}
              note="Patient accounts kept on file."
            />
            <Figure
              label="New this period"
              value={report?.patients?.new || 0}
              note="Accounts created inside this range."
            />
          </div>
        </ChartCard>

        <ChartCard
          title="Completed sessions"
          subtitle="Patients treated and therapy time delivered."
          state={loading ? 'loading' : hasSessions ? 'ready' : 'empty'}
          emptyMessage="No therapy sessions were recorded in this period."
          height={132}
        >
          <div className="grid gap-5 sm:grid-cols-3">
            <Figure
              label="Patients seen"
              value={report?.patients?.withSessions || 0}
              note="Patients with a session record."
            />
            <Figure
              label="Sessions recorded"
              value={totals.sessions}
              note="Completed visits documented."
            />
            <Figure
              label="Therapy time"
              value={hoursLabel(totals.minutes)}
              note="Sum of recorded durations."
            />
          </div>
        </ChartCard>

        <ChartCard
          title="Appointments by status"
          subtitle={`${completion}% completion rate, ${noShows} ${noShows === 1 ? 'visit' : 'visits'} marked no-show.`}
          state={loading ? 'loading' : hasStatus ? 'ready' : 'empty'}
          height={228}
        >
          <StatusMix items={byStatus} />
        </ChartCard>

        <ChartCard
          title="Therapist workload"
          subtitle="Completed visits against assigned appointments."
          state={loading ? 'loading' : workload.length ? 'ready' : 'empty'}
          height={228}
        >
          <WorkloadGauges items={workload.slice(0, 5)} />
        </ChartCard>

        <ChartCard
          title="Sessions by service"
          subtitle="Where completed visits come from."
          state={loading ? 'loading' : hasSessions ? 'ready' : 'empty'}
          height={228}
        >
          <ServicesBars items={report?.sessions ?? []} />
        </ChartCard>

        <ChartCard
          title="Payment methods"
          subtitle={`${formatMoney(report?.payments?.revenue)} collected in this period.`}
          state={loading ? 'loading' : hasMethods ? 'ready' : 'empty'}
          legend={legend}
          height={228}
        >
          <PaymentMethodsDonut items={methods} />
        </ChartCard>
      </div>

      {unpaid?.count ? (
        <p className="mt-4 text-[12.5px] text-ink-soft">
          {unpaid.count} {unpaid.count === 1 ? 'visit still has' : 'visits still have'} open
          balances
          {unpaid.total ? ` (${formatMoney(unpaid.total)})` : ''}. Review payments to settle them.
        </p>
      ) : null}

      {preview
        ? createPortal(
            <div className="report-print">
              <ReportSheet report={report} range={range} />
            </div>,
            document.body,
          )
        : null}
    </PageBody>
  )
}
