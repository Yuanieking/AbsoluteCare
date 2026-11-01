import {
  CalendarPlus,
  ChevronRight,
  Ellipsis,
  HeartHandshake,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  UsersRound,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageBody, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/session'
import type { AuthUser } from '@/lib/api/auth'
import { getToastError, showError, showSuccess } from '@/lib/toast'
import { DependentFormDialog } from './DependentForm'
import { ageLabel, dateLabel, dependentName, initials, nextVisitLabel } from './format'
import { useRemoveDependent } from './mutations'
import { useDependents } from './queries'
import type { Dependent } from './types'

export default function DependentsPage() {
  const navigate = useNavigate()
  const { user, setUser } = useAuth()
  const dependents = useDependents()
  const removeMutation = useRemoveDependent()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Dependent | null>(null)
  const [removeTarget, setRemoveTarget] = useState<Dependent | null>(null)

  const list = dependents.data ?? []

  function saved() {
    if (!user?.isGuardian) setUser({ ...user, isGuardian: true } as AuthUser)
  }

  async function remove(dependent: Dependent) {
    try {
      await removeMutation.mutateAsync(dependent._id)
      showSuccess('Dependent removed.')
      setRemoveTarget(null)
    } catch (error) {
      showError(getToastError(error, 'Unable to remove dependent.'))
    }
  }

  if (dependents.isLoading) {
    return (
      <PageBody aria-busy="true">
        <Skeleton className="h-8 w-56" />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <Skeleton key={item} className="h-56 rounded-lg" />
          ))}
        </div>
      </PageBody>
    )
  }

  if (dependents.error) {
    return (
      <PageBody>
        <EmptyState
          icon={<RefreshCw size={22} />}
          title="We couldn’t load your dependents"
          message={dependents.error.message}
          action={
            <Button type="button" onClick={() => void dependents.refetch()}>
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
        eyebrow="For your family"
        title="My dependents"
        description="Manage the family members you book appointments for."
        actions={
          <Button type="button" onClick={() => setFormOpen(true)}>
            <Plus size={16} aria-hidden="true" /> Add dependent
          </Button>
        }
        meta={
          list.length ? (
            <p className="mt-2 text-[12.5px] text-ink-soft">
              You’re managing {list.length} {list.length === 1 ? 'dependent' : 'dependents'}
              {user?.isGuardian || list.length ? ' · Guardian' : ''}
            </p>
          ) : null
        }
      />

      {list.length ? (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Your dependents">
          {list.map((dependent) => (
            <li key={dependent._id}>
              <article className="flex h-full flex-col rounded-lg border border-hairline bg-card p-4">
                <div className="flex items-start gap-2.5">
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[12px] font-semibold text-primary"
                    aria-hidden="true"
                  >
                    {initials(dependent.firstName, dependent.lastName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <strong
                      className="block truncate text-[13.5px] text-ink"
                      title={dependentName(dependent)}
                    >
                      {dependentName(dependent)}
                    </strong>
                    <span className="text-[11.5px] text-ink-soft">
                      {dependent.relationship || 'Other'}
                    </span>
                  </div>
                  <span className="text-ink-faint" aria-hidden="true">
                    <HeartHandshake size={14} />
                  </span>
                </div>

                <div className="mt-3 border-t border-hairline-in pt-2.5">
                  <strong className="block text-[13px] text-ink">
                    {ageLabel(dependent.dateOfBirth)}
                  </strong>
                  <span className="text-[11.5px] text-ink-soft">
                    Born {dateLabel(dependent.dateOfBirth)}
                  </span>
                </div>

                <div className="mt-2.5">
                  <span className="text-[11.5px] text-ink-faint">Next appointment</span>
                  <p className="text-[12px] text-ink-soft">{nextVisitLabel(dependent)}</p>
                </div>

                <div className="mt-3 flex items-center gap-2 border-t border-hairline-in pt-3">
                  <Button asChild size="sm">
                    <Link to={`/dashboard/book?dependent=${dependent._id}`}>
                      <CalendarPlus size={15} aria-hidden="true" /> Book
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/dashboard/dependents/${dependent._id}`)}
                  >
                    View <ChevronRight size={14} aria-hidden="true" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="ml-auto"
                        aria-label={`More actions for ${dependentName(dependent)}`}
                      >
                        <Ellipsis size={17} aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setEditing(dependent)}>
                        <Pencil size={14} aria-hidden="true" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setRemoveTarget(dependent)}
                      >
                        <Trash2 size={14} aria-hidden="true" /> Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </article>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="flex h-full min-h-44 w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-hairline bg-card/60 p-4 text-center transition-colors hover:border-primary/50"
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-sunk text-ink-soft">
                <Plus size={20} aria-hidden="true" />
              </span>
              <strong className="text-[13px] text-ink">Add another dependent</strong>
              <span className="text-[11.5px] text-ink-soft">Keep family appointments together</span>
            </button>
          </li>
        </ul>
      ) : (
        <div className="mt-5 rounded-lg border border-hairline bg-card">
          <EmptyState
            icon={<UsersRound size={26} aria-hidden="true" />}
            title="No dependents yet"
            message="Add a child or family member to book and manage their appointments from your account."
            action={
              <Button type="button" onClick={() => setFormOpen(true)}>
                <Plus size={16} aria-hidden="true" /> Add your first dependent
              </Button>
            }
          />
          <p className="pb-5 text-center text-[11.5px] text-ink-soft">
            You’ll be labeled as their guardian on appointments.
          </p>
        </div>
      )}

      <DependentFormDialog
        dependent={editing}
        open={formOpen || Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setFormOpen(false)
            setEditing(null)
          }
        }}
        onSaved={saved}
      />

      <Dialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => (open ? null : setRemoveTarget(null))}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Remove {removeTarget ? dependentName(removeTarget) : 'dependent'}?
            </DialogTitle>
            <DialogDescription>
              Their past appointments will stay in your records.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRemoveTarget(null)}>
              Keep dependent
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={removeMutation.isPending}
              onClick={() => removeTarget && void remove(removeTarget)}
            >
              {removeMutation.isPending ? 'Removing…' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageBody>
  )
}
