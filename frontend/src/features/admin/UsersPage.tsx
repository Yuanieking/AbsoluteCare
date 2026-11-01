import { MoreHorizontal, Plus, RefreshCw, Search, UsersRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DataTable, type AppColumnDef } from '@/components/data-table/DataTable'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { FilterBar } from '@/components/domain/FilterBar'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageBody, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/features/auth/session'
import { showPromise } from '@/lib/toast'
import { accountStatus, personName, roleLabel } from './format'
import { useArchiveUser, useRemoveUser, useSetUserActive } from './mutations'
import { useAdminUsers } from './queries'
import { RoleBadge } from './RoleBadge'
import { UserDetailDialog, UserDialog } from './UserDialog'
import type { UserAccount } from './types'

const roleTabs = [
  { key: 'all', label: 'All' },
  { key: 'patient', label: 'Patients' },
  { key: 'therapist', label: 'Therapists' },
  { key: 'secretary', label: 'Secretaries' },
  { key: 'admin', label: 'Admins' },
]

const statusOptions = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending approval' },
  { value: 'deactivated', label: 'Deactivated' },
  { value: 'archived', label: 'Archived' },
]

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const role = searchParams.get('role') || 'all'
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [dialog, setDialog] = useState<{ user: UserAccount | null; view: boolean } | null>(null)

  useEffect(() => {
    const timeout = window.setTimeout(() => setQuery(search.trim()), 300)
    return () => window.clearTimeout(timeout)
  }, [search])

  const users = useAdminUsers({ role, status, search: query })
  const setActive = useSetUserActive()
  const archive = useArchiveUser()
  const remove = useRemoveUser()
  const currentUserId = currentUser?.id

  const rows = useMemo(() => users.data?.users ?? [], [users.data])
  const isSelf = (user: UserAccount) => String(user._id) === String(currentUserId)

  function changeStatus(user: UserAccount, action: 'activate' | 'deactivate' | 'archive') {
    const request =
      action === 'archive'
        ? archive.mutateAsync(user._id)
        : setActive.mutateAsync({ id: user._id, active: action === 'activate' })
    showPromise(request, {
      loading: `${action[0]?.toUpperCase()}${action.slice(1)}ing user...`,
      success:
        action === 'activate'
          ? 'User activated.'
          : action === 'deactivate'
            ? 'User deactivated.'
            : 'User archived.',
      error: 'Unable to change account status.',
    })
    request.catch(() => undefined)
  }

  function removeUser(user: UserAccount) {
    const confirmation = window.prompt(
      `Type ${user.firstname} ${user.lastname} to remove this account.`,
    )
    if (confirmation === null) return
    const request = remove.mutateAsync({ id: user._id, confirmName: confirmation })
    showPromise(request, {
      loading: 'Removing user...',
      success: 'User removed.',
      error: 'Unable to remove this user.',
    })
    request.catch(() => undefined)
  }

  const columns: AppColumnDef<UserAccount>[] = [
    {
      id: 'user',
      meta: { label: 'User' },
      header: 'User',
      accessorFn: (user) => personName(user),
      cell: ({ row }) => (
        <div className="min-w-0">
          <span className="block truncate font-medium text-ink">{personName(row.original)}</span>
          <span className="block truncate text-[11.5px] text-ink-soft">{row.original.email}</span>
        </div>
      ),
    },
    {
      id: 'role',
      meta: { label: 'Role' },
      header: 'Role',
      accessorFn: (user) => roleLabel(user.role),
      cell: ({ row }) => <RoleBadge role={row.original.role} />,
    },
    {
      id: 'status',
      meta: { label: 'Status' },
      header: 'Status',
      accessorFn: (user) => accountStatus(user),
      cell: ({ row }) => <StatusBadge status={accountStatus(row.original)} />,
    },
    {
      id: 'actions',
      meta: { label: 'Actions' },
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const user = row.original
        const self = isSelf(user)
        return (
          <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Actions for ${personName(user)}`}
                >
                  <MoreHorizontal size={16} aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setDialog({ user, view: true })}>
                  View
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDialog({ user, view: false })}>
                  Edit
                </DropdownMenuItem>
                {self ? null : (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => changeStatus(user, user.isActive ? 'deactivate' : 'activate')}
                    >
                      {user.isActive ? 'Deactivate' : 'Activate'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => changeStatus(user, 'archive')}>
                      Archive
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onSelect={() => removeUser(user)}>
                      Remove
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ]

  return (
    <PageBody>
      <PageHeader
        eyebrow="Administration"
        title="User management"
        description="Manage access without losing the history behind a clinic account."
        actions={
          <Button type="button" onClick={() => setDialog({ user: null, view: false })}>
            <Plus size={15} aria-hidden="true" /> Add user
          </Button>
        }
      />

      <div className="mt-5">
        <FilterBar
          tabs={roleTabs}
          activeTab={role}
          onTabChange={(key) =>
            setSearchParams(key === 'all' ? {} : { role: key }, { replace: true })
          }
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search name or email"
          filters={[
            {
              key: 'status',
              label: 'Account status',
              value: status,
              options: statusOptions,
              onChange: setStatus,
            },
          ]}
        />
      </div>

      <DataTable
        className="mt-3"
        columns={columns}
        data={rows}
        isLoading={users.isLoading}
        getRowId={(user) => user._id}
        rowLabel={(user) => `${personName(user)} · ${roleLabel(user.role)}`}
        onRowClick={(user) => setDialog({ user, view: true })}
        caption="Clinic accounts"
        empty={
          users.error ? (
            <EmptyState
              icon={<RefreshCw size={22} />}
              title="We couldn’t load users"
              message={users.error.message}
              action={
                <Button type="button" variant="outline" onClick={() => void users.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : query ? (
            <EmptyState
              icon={<Search size={22} />}
              title="No users match your search"
              message={`No accounts found matching “${query}”.`}
              action={
                <Button type="button" variant="outline" onClick={() => setSearch('')}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<UsersRound size={22} />}
              title="No accounts found"
              message="Change the filters, or add the first clinic account."
            />
          )
        }
      />

      <UserDialog
        key={dialog && !dialog.view ? (dialog.user?._id ?? 'new') : 'closed'}
        user={dialog?.user ?? null}
        currentUserId={currentUserId}
        open={Boolean(dialog) && !dialog?.view}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
      />
      <UserDetailDialog
        user={dialog?.view ? dialog.user : null}
        open={Boolean(dialog?.view)}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
      />
    </PageBody>
  )
}
