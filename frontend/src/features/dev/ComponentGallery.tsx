import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { BarSparkline } from '@/components/charts/sparkline'
import { DataTable, type AppColumnDef } from '@/components/data-table/DataTable'
import { ChartCard } from '@/components/domain/ChartCard'
import { DateRangePicker } from '@/components/domain/DateRangePicker'
import { FilterBar } from '@/components/domain/FilterBar'
import { StatTile } from '@/components/domain/StatTile'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { EmptyState } from '@/components/feedback/EmptyState'
import { CheckboxField, SelectField, TextField } from '@/components/form/FormFields'
import type { DateRange } from '@/lib/format/date-range'
import { useForm } from 'react-hook-form'
import { useState, type ReactNode } from 'react'

const swatches: [string, string][] = [
  ['canvas', '--ac-canvas'],
  ['panel', '--ac-panel'],
  ['card', '--ac-card'],
  ['sunk', '--ac-sunk'],
  ['primary', '--ac-primary'],
  ['primary-soft', '--ac-primary-soft'],
  ['ink', '--ac-ink'],
  ['ink-soft', '--ac-ink-soft'],
  ['ink-faint', '--ac-ink-faint'],
  ['hairline', '--ac-hairline'],
  ['signal', '--ac-signal'],
  ['destructive', '--ac-destructive'],
  ['lime', '--ac-lime'],
  ['ring', '--ac-ring'],
  ['chart-1', '--ac-chart-1'],
  ['chart-2', '--ac-chart-2'],
  ['chart-3', '--ac-chart-3'],
  ['chart-4', '--ac-chart-4'],
  ['chart-5', '--ac-chart-5'],
  ['chart-6', '--ac-chart-6'],
]

const typeScale: [string, string][] = [
  ['display', 'text-5xl font-display tracking-tight'],
  ['h1', 'text-3xl font-semibold'],
  ['h2', 'text-[22px] font-semibold'],
  ['h3', 'text-[17px] font-semibold'],
  ['body', 'text-sm'],
  ['small', 'text-[12.5px]'],
  ['micro', 'text-[11.5px]'],
]

const statuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no-show', 'active', 'archived']

const spark = [12, 18, 14, 22, 19, 27, 31, 26, 34, 38, 33, 41].map((value, index) => ({
  label: `d${index + 1}`,
  value,
}))

const views = [
  { key: 'all', label: 'All', count: 42 },
  { key: 'upcoming', label: 'Upcoming', count: 12 },
  { key: 'past', label: 'Past', count: 30 },
]

type DemoRow = { id: string; patient: string; date: string; status: string }

const demoRows: DemoRow[] = [
  { id: '1', patient: 'Maria Santos', date: '2026-10-29', status: 'confirmed' },
  { id: '2', patient: 'Jose Rizal', date: '2026-10-30', status: 'pending' },
  { id: '3', patient: 'Andres Bonifacio', date: '2026-10-27', status: 'completed' },
  { id: '4', patient: 'Gabriela Silang', date: '2026-10-26', status: 'no-show' },
  { id: '5', patient: 'Apolinario Mabini', date: '2026-10-25', status: 'cancelled' },
]

const demoColumns: AppColumnDef<DemoRow>[] = [
  { accessorKey: 'patient', header: 'Patient', meta: { label: 'Patient' } },
  { accessorKey: 'date', header: 'Date' },
  {
    accessorKey: 'status',
    header: 'Status',
    enableSorting: false,
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
]

type DemoForm = { name: string; role: string; notify: boolean }

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-[22px] font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  )
}

function FiltersDemo() {
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [range, setRange] = useState<DateRange>({ from: '', to: '' })
  return (
    <div className="space-y-3">
      <FilterBar
        tabs={views}
        activeTab={tab}
        onTabChange={setTab}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search patients"
        filters={[
          {
            key: 'status',
            label: 'Filter by status',
            value: status,
            onChange: setStatus,
            options: [
              { value: 'all', label: 'All statuses' },
              { value: 'confirmed', label: 'Confirmed' },
              { value: 'pending', label: 'Pending' },
            ],
          },
        ]}
        chips={search ? [{ label: `Search: ${search}`, onRemove: () => setSearch('') }] : []}
        onClear={() => setSearch('')}
      >
        <DateRangePicker value={range} onChange={setRange} />
      </FilterBar>
      <DataTable columns={demoColumns} data={demoRows} caption="Sample appointments" />
    </div>
  )
}

function FormsDemo() {
  const form = useForm<DemoForm>({
    defaultValues: { name: '', role: 'therapist', notify: true },
  })
  return (
    <Form {...form}>
      <form className="grid max-w-md gap-4 rounded-md border border-hairline bg-card p-4">
        <TextField
          control={form.control}
          name="name"
          label="Full name"
          placeholder="Maria Santos"
          description="As it should appear on the session record."
        />
        <SelectField
          control={form.control}
          name="role"
          label="Role"
          options={[
            { value: 'therapist', label: 'Therapist' },
            { value: 'secretary', label: 'Secretary' },
          ]}
        />
        <CheckboxField
          control={form.control}
          name="notify"
          label="Email notifications"
          description="Appointment reminders and receipts."
        />
      </form>
    </Form>
  )
}

export default function ComponentGallery() {
  return (
    <div data-surface="portal" className="min-h-screen bg-canvas p-8 text-ink">
      <header className="mb-10 border-b border-hairline pb-6">
        <p className="text-[11.5px] text-ink-faint">Dev only</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
          Component gallery
        </h1>
      </header>

      <div className="mx-auto max-w-5xl space-y-12">
        <Section title="Foundations — colour">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {swatches.map(([name, token]) => (
              <div key={name} className="overflow-hidden rounded-md border border-hairline bg-card">
                <div className="h-14" style={{ background: `var(${token})` }} />
                <p className="px-2 py-1.5 text-[11px]">{name}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Foundations — type scale">
          <div className="space-y-2 rounded-md border border-hairline bg-card p-4">
            {typeScale.map(([name, className]) => (
              <div key={name} className="flex items-baseline gap-4">
                <span className="w-16 shrink-0 text-[11px] text-ink-faint">{name}</span>
                <span className={className}>Therapy that meets you where you are</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Primitives">
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-hairline bg-card p-4">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button disabled>Disabled</Button>
            <Badge>Pending</Badge>
            <Badge variant="secondary">Confirmed</Badge>
            <Input placeholder="Field" className="max-w-48" />
            <Skeleton className="h-9 w-32" />
          </div>
        </Section>

        <Section title="Stat tiles">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Next appointment" value="Oct 30, 2:00 PM" caption="Dr. Reyes" />
            <StatTile label="Sessions attended" value="18" caption="+3 this month" series={spark} />
            <StatTile
              label="Collected this month"
              value="₱48,200"
              caption="32 payments"
              series={spark}
              seriesType="bar"
            />
            <StatTile label="Open slots today" value="7" caption="Across 4 therapists" loading />
          </div>
        </Section>

        <Section title="Status badges">
          <div className="flex flex-wrap gap-2 rounded-md border border-hairline bg-card p-4">
            {statuses.map((status) => (
              <StatusBadge key={status} status={status} />
            ))}
          </div>
        </Section>

        <Section title="Charts">
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Sessions per week"
              subtitle="Last 12 weeks"
              legend={[{ label: 'Completed', color: 'var(--ac-chart-1)' }]}
            >
              <div className="h-[220px] w-full">
                <BarSparkline
                  data={spark}
                  dataKey="value"
                  height={220}
                  barRadius={3}
                  aria-label="Sessions per week"
                />
              </div>
            </ChartCard>
            <ChartCard title="Revenue trend" state="loading" height={220} />
            <ChartCard title="No-show rate" state="empty" />
            <ChartCard title="Attendance heatmap" state="error" onRetry={() => undefined} />
          </div>
        </Section>

        <Section title="Empty state">
          <div className="rounded-md border border-hairline bg-card">
            <EmptyState
              title="No notifications yet"
              message="Appointment reminders appear here."
              action={<Button size="sm">Book an appointment</Button>}
            />
          </div>
        </Section>

        <Section title="Filters & data table">
          <FiltersDemo />
        </Section>

        <Section title="Forms">
          <FormsDemo />
        </Section>

        <Section title="Patterns & motion">
          <p className="text-sm text-ink-soft">
            Spring presets and page-level patterns land with the first converted route.
          </p>
        </Section>
      </div>
    </div>
  )
}
