import { useQuery } from '@tanstack/react-query'
import { Download, FileClock, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { DataTable, type AppColumnDef } from '@/components/data-table/DataTable'
import { FilterBar } from '@/components/domain/FilterBar'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Button } from '@/components/ui/button'
import { keys } from '@/lib/api/keys'
import { sectionMap, sections } from './config'
import { getSettingsAudit } from './api'
import type { AuditEntry } from './types'

const sectionOptions = [
  { value: 'all', label: 'All sections' },
  ...sections.map((section) => ({ value: section.key, label: section.title })),
]

function adminName(entry: AuditEntry) {
  return [entry.admin?.firstname, entry.admin?.lastname].filter(Boolean).join(' ') || 'Admin'
}

function when(entry: AuditEntry) {
  if (!entry.createdAt) return 'Not recorded'
  const date = new Date(entry.createdAt)
  return Number.isNaN(date.getTime())
    ? entry.createdAt
    : date.toLocaleString('en-PH', { timeZone: 'Asia/Manila' })
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

export function AuditSection() {
  const [search, setSearch] = useState('')
  const [section, setSection] = useState('all')
  const audit = useQuery({
    queryKey: keys.settings.list({ scope: 'admin', audit: true }),
    queryFn: getSettingsAudit,
  })

  const entries = audit.data ?? []
  const term = search.trim().toLowerCase()
  const rows = entries.filter((entry) => {
    if (section !== 'all' && entry.section !== section) return false
    if (!term) return true
    return [
      adminName(entry),
      sectionMap[entry.section || '']?.title,
      entry.field,
      String(entry.oldValue),
      String(entry.newValue),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(term)
  })

  function exportCsv() {
    const lines = [
      ['Time', 'Admin', 'Section', 'Field', 'Old value', 'New value'].map(csvCell).join(','),
      ...rows.map((entry) =>
        [
          when(entry),
          adminName(entry),
          sectionMap[entry.section || '']?.title || entry.section || '',
          entry.field || '',
          String(entry.oldValue ?? ''),
          String(entry.newValue ?? ''),
        ]
          .map(csvCell)
          .join(','),
      ),
    ]
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `absolutecare-settings-audit-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const columns: AppColumnDef<AuditEntry>[] = [
    {
      id: 'time',
      meta: { label: 'Time' },
      header: 'Time',
      accessorFn: (entry) => entry.createdAt || '',
      cell: ({ row }) => <span className="whitespace-nowrap">{when(row.original)}</span>,
    },
    {
      id: 'admin',
      meta: { label: 'Admin' },
      header: 'Admin',
      accessorFn: (entry) => adminName(entry),
      cell: ({ row }) => <span>{adminName(row.original)}</span>,
    },
    {
      id: 'setting',
      meta: { label: 'Setting' },
      header: 'Setting',
      accessorFn: (entry) => `${entry.section || ''} ${entry.field || ''}`,
      cell: ({ row }) => (
        <span className="text-ink-soft">
          {sectionMap[row.original.section || '']?.title || row.original.section || 'Settings'} ·{' '}
          {row.original.field}
        </span>
      ),
    },
    {
      id: 'change',
      meta: { label: 'Change' },
      header: 'Change',
      accessorFn: (entry) => String(entry.newValue ?? ''),
      cell: ({ row }) => (
        <span className="text-ink-soft">
          {String(row.original.oldValue ?? '—')} → {String(row.original.newValue ?? '—')}
        </span>
      ),
    },
  ]

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11.5px] font-medium text-ink-faint">Configuration</p>
          <h2 className="mt-0.5 text-[22px] leading-tight font-semibold tracking-[-0.015em] text-ink">
            Audit log
          </h2>
          <p className="mt-1 text-[12.5px] text-ink-soft">
            Review who changed clinic-wide settings and when. Times are shown in Asia/Manila.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={exportCsv}
          disabled={!rows.length}
        >
          <Download size={14} aria-hidden="true" /> Export
        </Button>
      </header>

      <FilterBar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search changes"
        filters={[
          {
            key: 'section',
            label: 'Audit section',
            value: section,
            options: sectionOptions,
            onChange: setSection,
          },
        ]}
      />

      <DataTable
        columns={columns}
        data={rows}
        isLoading={audit.isLoading}
        getRowId={(entry) => entry._id}
        initialPageSize={25}
        pageSizes={[25, 50]}
        caption="Settings change history"
        empty={
          audit.error ? (
            <EmptyState
              icon={<RefreshCw size={22} />}
              title="We couldn’t load the audit log"
              message={audit.error.message}
              action={
                <Button type="button" variant="outline" onClick={() => void audit.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<FileClock size={22} />}
              title="No changes recorded yet"
              message="Settings changes will appear here with the admin, time, and before-and-after values."
            />
          )
        }
      />
    </div>
  )
}
