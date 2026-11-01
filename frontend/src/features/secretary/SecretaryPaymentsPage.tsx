import { CircleDollarSign, Pencil, Plus, RefreshCw, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AreaSparkline } from '@/components/charts/sparkline'
import { DataTable, type AppColumnDef } from '@/components/data-table/DataTable'
import { ChartCard } from '@/components/domain/ChartCard'
import { FilterBar } from '@/components/domain/FilterBar'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageBody, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { formatDateManila } from '@/lib/format/patient'
import {
  collectedSeries,
  formatMoney,
  patientCaption,
  patientName,
  paymentAmount,
  personName,
  scheduleLabel,
  serviceName,
} from './format'
import { PaymentDialog, type PaymentMode } from './PaymentDialog'
import { useSecretaryPayments } from './queries'
import type { SecretaryAppointment } from './types'

const statusOptions = [
  { value: 'all', label: 'All payments' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'paid', label: 'Paid' },
]

export default function SecretaryPaymentsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('status')
  const status = requested === 'paid' || requested === 'unpaid' ? requested : 'all'
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState<{
    appointment: SecretaryAppointment
    mode: PaymentMode
  } | null>(null)

  const query = useSecretaryPayments(status)
  const term = search.trim().toLowerCase()
  const appointments = useMemo(() => query.data ?? [], [query.data])
  const rows = appointments.filter((appointment) => {
    if (!term) return true
    return [personName(appointment.patient), patientName(appointment), appointment.patient?.email]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(term)
  })

  const series = collectedSeries(appointments)

  const columns: AppColumnDef<SecretaryAppointment>[] = [
    {
      id: 'date',
      meta: { label: 'Date' },
      header: 'Date',
      accessorFn: (appointment) => appointment.scheduledStart || '',
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {row.original.scheduledStart
            ? formatDateManila(row.original.scheduledStart)
            : scheduleLabel(row.original)}
        </span>
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
      id: 'service',
      meta: { label: 'Service' },
      header: 'Service',
      accessorFn: (appointment) => serviceName(appointment),
      cell: ({ row }) => <span className="text-ink-soft">{serviceName(row.original)}</span>,
    },
    {
      id: 'amount',
      meta: { label: 'Amount' },
      header: 'Amount',
      accessorFn: (appointment) => paymentAmount(appointment),
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">{formatMoney(paymentAmount(row.original))}</span>
      ),
    },
    {
      id: 'payment',
      meta: { label: 'Payment status' },
      header: 'Payment status',
      accessorFn: (appointment) => appointment.payment?.status || 'unpaid',
      cell: ({ row }) => <StatusBadge status={row.original.payment?.status || 'unpaid'} />,
    },
    {
      id: 'method',
      meta: { label: 'Method' },
      header: 'Method',
      accessorFn: (appointment) => appointment.payment?.method || '',
      cell: ({ row }) =>
        row.original.payment?.status === 'paid' ? (
          <span className="capitalize">{row.original.payment?.method || 'Not recorded'}</span>
        ) : (
          <span className="text-ink-faint">Not recorded</span>
        ),
    },
    {
      id: 'actions',
      meta: { label: 'Actions' },
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const appointment = row.original
        const paid = appointment.payment?.status === 'paid'
        return (
          <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setDialog({ appointment, mode: paid ? 'edit' : 'record' })}
            >
              {paid ? (
                <>
                  <Pencil size={13} aria-hidden="true" /> Edit payment
                </>
              ) : (
                <>
                  <Plus size={13} aria-hidden="true" /> Record payment
                </>
              )}
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <PageBody>
      <PageHeader
        eyebrow="Finance"
        title="Payments"
        description="Record and correct payment information for clinic visits."
        meta={
          <p className="mt-1 text-[11.5px] text-ink-faint">
            Paid and unpaid are payment records, separate from appointment status.
          </p>
        }
      />

      <ChartCard
        className="mt-5"
        title="Collected"
        subtitle="Payments recorded in the last six months."
        state={
          query.isLoading ? 'loading' : series.some((point) => point.value > 0) ? 'ready' : 'empty'
        }
        emptyMessage="Recorded payments appear here as visits are settled."
        height={140}
      >
        <div className="h-[140px] w-full">
          <AreaSparkline
            data={series}
            dataKey="value"
            height={140}
            aria-label="Payments collected per month"
          />
        </div>
      </ChartCard>

      <div className="mt-5">
        <FilterBar
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search patient name or email…"
          filters={[
            {
              key: 'status',
              label: 'Payment status',
              value: status,
              options: statusOptions,
              onChange: (value) =>
                setSearchParams(value === 'all' ? {} : { status: value }, { replace: true }),
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
        rowLabel={(appointment) =>
          `${patientName(appointment)} · ${formatMoney(paymentAmount(appointment))}`
        }
        onRowClick={(appointment) =>
          setDialog({
            appointment,
            mode: appointment.payment?.status === 'paid' ? 'edit' : 'record',
          })
        }
        empty={
          query.error ? (
            <EmptyState
              icon={<RefreshCw size={22} />}
              title="We couldn’t load payments"
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
              message={`No payment records found matching “${search.trim()}”.`}
              action={
                <Button type="button" variant="outline" onClick={() => setSearch('')}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<CircleDollarSign size={22} />}
              title="No payment records found"
              message="Only confirmed and completed appointments appear here."
            />
          )
        }
      />

      <PaymentDialog
        appointment={dialog?.appointment ?? null}
        mode={dialog?.mode ?? 'record'}
        open={Boolean(dialog)}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
      />
    </PageBody>
  )
}
