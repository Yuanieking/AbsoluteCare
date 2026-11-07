import { Pencil, RefreshCw, Search, UserRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { DataTable, type AppColumnDef } from '@/components/data-table/DataTable'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { FilterBar } from '@/components/domain/FilterBar'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageBody, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { GenerateDocumentButton } from '@/features/documents/GenerateDocumentButton'
import {
  accountStatus,
  formatDate,
  personName,
  specializationList,
  workingDaysLabel,
} from './format'
import { useAdminUsers } from './queries'
import { PersonDialog } from './PersonDialog'
import type { UserAccount } from './types'

function monthRange() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  return { from: from.toISOString(), to: to.toISOString() }
}

export default function PeoplePage({ role }: { role: 'patient' | 'therapist' }) {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<UserAccount | null>(null)

  useEffect(() => {
    const timeout = window.setTimeout(() => setQuery(search.trim()), 300)
    return () => window.clearTimeout(timeout)
  }, [search])

  const people = useAdminUsers({ role, status: 'all', search: query, limit: 50 })
  const rows = useMemo(() => people.data?.users ?? [], [people.data])

  const columns: AppColumnDef<UserAccount>[] = [
    {
      id: 'name',
      meta: { label: 'Name' },
      header: 'Name',
      accessorFn: (person) => personName(person),
      cell: ({ row }) => (
        <div className="min-w-0">
          <span className="block truncate font-medium text-ink">{personName(row.original)}</span>
          <span className="block truncate text-[11.5px] text-ink-soft">
            {role === 'patient'
              ? formatDate(row.original.dateOfBirth)
              : `${row.original.workingDays?.length || 0} working days`}
          </span>
        </div>
      ),
    },
    {
      id: 'contact',
      meta: { label: 'Contact' },
      header: 'Contact',
      accessorFn: (person) => person.email || '',
      cell: ({ row }) => (
        <div className="min-w-0">
          <span className="block truncate text-ink">{row.original.email || 'Not set'}</span>
          <span className="block truncate text-[11.5px] text-ink-soft">
            {row.original.phone || 'Not set'}
          </span>
        </div>
      ),
    },
    ...(role === 'therapist'
      ? ([
          {
            id: 'specialization',
            meta: { label: 'Specialization' },
            header: 'Specialization',
            accessorFn: (person: UserAccount) => specializationList(person).join(', '),
            cell: ({ row }) => {
              const list = specializationList(row.original)
              const needsSetup = !list.length || !row.original.workingDays?.length
              return (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={list.length ? 'text-ink' : 'text-signal'}>
                    {list.join(', ') || 'Not set'}
                  </span>
                  {needsSetup ? (
                    <span
                      title="Add specialization and working days before assigning appointments"
                      className="rounded-full bg-signal-soft px-2 py-0.5 text-[10.5px] font-medium text-signal"
                    >
                      Needs setup
                    </span>
                  ) : null}
                </div>
              )
            },
          },
          {
            id: 'availability',
            meta: { label: 'Availability' },
            header: 'Availability',
            accessorFn: (person: UserAccount) => workingDaysLabel(person),
            cell: ({ row }) => (
              <span className={row.original.workingDays?.length ? 'text-ink' : 'text-signal'}>
                {workingDaysLabel(row.original)}
              </span>
            ),
          },
        ] as AppColumnDef<UserAccount>[])
      : []),
    {
      id: 'status',
      meta: { label: 'Status' },
      header: 'Status',
      accessorFn: (person) => accountStatus(person),
      cell: ({ row }) => <StatusBadge status={accountStatus(row.original)} />,
    },
    {
      id: 'actions',
      meta: { label: 'Actions' },
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
          {role === 'patient' ? (
            <GenerateDocumentButton
              input={{ type: 'patient_summary', patientId: row.original._id, ...monthRange() }}
              label="Summary"
              variant="ghost"
              size="xs"
            />
          ) : null}
          <Button
            variant="ghost"
            size="xs"
            aria-label={`Edit ${personName(row.original)}`}
            onClick={() => setSelected(row.original)}
          >
            <Pencil size={13} aria-hidden="true" /> Edit
          </Button>
        </div>
      ),
    },
  ]

  return (
    <PageBody>
      <PageHeader
        eyebrow="Administration"
        title={role === 'therapist' ? 'Therapist records' : 'Patient records'}
        description={
          role === 'therapist'
            ? 'Maintain therapist details and the single source of truth for availability.'
            : 'Keep patient contact and profile information accurate.'
        }
      />

      <div className="mt-5">
        <FilterBar
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search name, email, phone, or specialization"
          chips={search ? [{ label: `Search: ${search}`, onRemove: () => setSearch('') }] : []}
          onClear={() => setSearch('')}
        />
      </div>

      <DataTable
        className="mt-3"
        columns={columns}
        data={rows}
        isLoading={people.isLoading}
        getRowId={(person) => person._id}
        rowLabel={(person) => personName(person)}
        onRowClick={(person) => setSelected(person)}
        caption={role === 'therapist' ? 'Therapist records' : 'Patient records'}
        empty={
          people.error ? (
            <EmptyState
              icon={<RefreshCw size={22} />}
              title={`We couldn’t load ${role}s`}
              message={people.error.message}
              action={
                <Button type="button" variant="outline" onClick={() => void people.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : query ? (
            <EmptyState
              icon={<Search size={22} />}
              title="No results match your search"
              message={`No ${role} records found matching “${query}”.`}
              action={
                <Button type="button" variant="outline" onClick={() => setSearch('')}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<UserRound size={22} />}
              title={`No ${role} records`}
              message={`${role === 'therapist' ? 'Therapists' : 'Patients'} appear here once their account exists.`}
            />
          )
        }
      />

      <PersonDialog
        key={selected?._id ?? 'closed'}
        person={selected}
        role={role}
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      />
    </PageBody>
  )
}
