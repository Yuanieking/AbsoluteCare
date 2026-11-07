import { CircleDollarSign, Download, RefreshCw, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DataTable, type AppColumnDef } from '@/components/data-table/DataTable'
import { DateRangePicker } from '@/components/domain/DateRangePicker'
import { FilterBar } from '@/components/domain/FilterBar'
import { StatTile } from '@/components/domain/StatTile'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageBody, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { GenerateDocumentButton } from '@/features/documents/GenerateDocumentButton'
import { showError } from '@/lib/toast'
import * as api from './api'
import {
  appointmentFee,
  appointmentStart,
  formatDateTime,
  formatMoney,
  patientName,
  serviceName,
  therapistName,
} from './format'
import { PaymentDialog } from './PaymentDialog'
import { useAdminPayments } from './queries'
import type { AdminAppointment } from './types'

const statusOptions = [
  { value: 'all', label: 'All statuses' },
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Unpaid' },
]

export default function PaymentsPage() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') || 'all'
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [range, setRange] = useState({ from: '', to: '' })
  const [selected, setSelected] = useState<AdminAppointment | null>(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const timeout = window.setTimeout(() => setQuery(search.trim()), 300)
    return () => window.clearTimeout(timeout)
  }, [search])

  const payments = useAdminPayments({ status, search: query, ...range })
  const rows = payments.data ?? []
  const paid = rows.filter((item) => item.payment?.status === 'paid')
  const unpaid = rows.filter((item) => item.payment?.status !== 'paid')
  const collected = paid.reduce((total, item) => total + appointmentFee(item), 0)
  const outstanding = unpaid.reduce((total, item) => total + appointmentFee(item), 0)

  async function exportCsv() {
    setExporting(true)
    try {
      const blob = await api.exportPayments({ status, search: query, ...range })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'absolutecare-payments.csv'
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      showError(
        error instanceof Error ? error.message : 'The payments export could not be prepared.',
      )
    } finally {
      setExporting(false)
    }
  }

  const columns: AppColumnDef<AdminAppointment>[] = [
    {
      id: 'date',
      meta: { label: 'Date' },
      header: 'Date',
      accessorFn: (item) => appointmentStart(item) || '',
      cell: ({ row }) => (
        <span className="whitespace-nowrap">{formatDateTime(appointmentStart(row.original))}</span>
      ),
    },
    {
      id: 'patient',
      meta: { label: 'Patient' },
      header: 'Patient',
      accessorFn: (item) => patientName(item),
      cell: ({ row }) => (
        <div className="min-w-0">
          <span className="block truncate font-medium text-ink">{patientName(row.original)}</span>
          <span className="block truncate text-[11.5px] text-ink-soft">
            {row.original.patient?.email || 'No email'}
          </span>
        </div>
      ),
    },
    {
      id: 'therapist',
      meta: { label: 'Therapist' },
      header: 'Therapist',
      accessorFn: (item) => therapistName(item),
      cell: ({ row }) => <span className="text-ink-soft">{therapistName(row.original)}</span>,
    },
    {
      id: 'service',
      meta: { label: 'Service' },
      header: 'Service',
      accessorFn: (item) => serviceName(item),
      cell: ({ row }) => <span className="text-ink-soft">{serviceName(row.original)}</span>,
    },
    {
      id: 'amount',
      meta: { label: 'Amount' },
      header: 'Amount',
      accessorFn: (item) => appointmentFee(item),
      cell: ({ row }) => (
        <div className="min-w-0">
          <span className="tabular-nums">{formatMoney(appointmentFee(row.original))}</span>
          {row.original.payment?.amount || appointmentFee(row.original) ? null : (
            <span className="block text-[11px] text-signal">Fee not set</span>
          )}
        </div>
      ),
    },
    {
      id: 'method',
      meta: { label: 'Method' },
      header: 'Method',
      accessorFn: (item) => item.payment?.method || '',
      cell: ({ row }) => (
        <span className="capitalize">{row.original.payment?.method || 'Not set'}</span>
      ),
    },
    {
      id: 'status',
      meta: { label: 'Status' },
      header: 'Status',
      accessorFn: (item) => item.payment?.status || 'unpaid',
      cell: ({ row }) => <StatusBadge status={row.original.payment?.status || 'unpaid'} />,
    },
    {
      id: 'actions',
      meta: { label: 'Actions' },
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
          <GenerateDocumentButton
            input={{ type: 'receipt', appointmentId: row.original._id }}
            label="Receipt"
            variant="ghost"
            size="xs"
            disabled={row.original.payment?.status !== 'paid'}
            title={
              row.original.payment?.status === 'paid'
                ? undefined
                : 'Receipts are only available for paid visits'
            }
          />
          <Button type="button" variant="ghost" size="xs" onClick={() => setSelected(row.original)}>
            Update payment
          </Button>
        </div>
      ),
    },
  ]

  return (
    <PageBody>
      <PageHeader
        eyebrow="Finance"
        title="Payments"
        description="Monitor clinic-wide collections and outstanding balances."
        actions={
          <Button
            type="button"
            variant="outline"
            disabled={exporting}
            onClick={() => void exportCsv()}
          >
            <Download size={15} aria-hidden="true" />
            {exporting ? 'Preparing…' : 'Export CSV'}
          </Button>
        }
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <StatTile
          loading={payments.isLoading}
          label="Collected"
          value={formatMoney(collected)}
          caption={`${paid.length} paid ${paid.length === 1 ? 'visit' : 'visits'} in this view.`}
        />
        <StatTile
          loading={payments.isLoading}
          label="Outstanding"
          value={formatMoney(outstanding)}
          caption="Visits still awaiting payment."
          className={unpaid.length ? 'border-signal/25' : undefined}
        />
        <StatTile
          loading={payments.isLoading}
          label="Unpaid appointments"
          value={unpaid.length}
          caption="Review the ledger below."
          action="View unpaid"
          href="/staff/admin/payments?status=unpaid"
        />
      </div>

      <div className="mt-4">
        <FilterBar
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search by name, email or phone"
          filters={[
            {
              key: 'status',
              label: 'Payment status',
              value: status,
              options: statusOptions,
              onChange: (value) =>
                setParams(value === 'all' ? {} : { status: value }, { replace: true }),
            },
          ]}
          chips={
            range.from || range.to
              ? [
                  {
                    key: 'range',
                    label: `Date: ${range.from || 'any'} – ${range.to || 'any'}`,
                    onRemove: () => setRange({ from: '', to: '' }),
                  },
                ]
              : []
          }
        >
          <DateRangePicker value={range} onChange={setRange} />
        </FilterBar>
      </div>

      <DataTable
        className="mt-3"
        columns={columns}
        data={rows}
        isLoading={payments.isLoading}
        getRowId={(item) => item._id}
        rowLabel={(item) => `${patientName(item)} · ${formatMoney(appointmentFee(item))}`}
        onRowClick={(item) => setSelected(item)}
        caption="Payment ledger"
        empty={
          payments.error ? (
            <EmptyState
              icon={<RefreshCw size={22} />}
              title="We couldn’t load payments"
              message={payments.error.message}
              action={
                <Button type="button" variant="outline" onClick={() => void payments.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : query ? (
            <EmptyState
              icon={<Search size={22} />}
              title="No patients match your search"
              message={`No payment records found matching “${query}”.`}
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
              message="Confirmed and completed appointments appear here."
            />
          )
        }
      />

      <PaymentDialog
        appointment={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      />
    </PageBody>
  )
}
