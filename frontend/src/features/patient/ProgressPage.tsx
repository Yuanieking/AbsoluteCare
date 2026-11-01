import { ArrowUpRight, CalendarCheck2, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageBody, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { formatAppointmentDate, therapistName } from '@/lib/format/patient'
import { useSession, useSessions } from './queries'

export default function ProgressPage() {
  const sessions = useSessions()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const detail = useSession(selectedId)
  const history = sessions.data ?? []

  if (sessions.isLoading) {
    return (
      <PageBody aria-busy="true">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-5 h-64 rounded-lg" />
      </PageBody>
    )
  }

  if (sessions.error) {
    return (
      <PageBody>
        <EmptyState
          icon={<RefreshCw size={22} />}
          title="We couldn’t load your progress"
          message={sessions.error.message}
          action={
            <Button type="button" onClick={() => void sessions.refetch()}>
              Try again
            </Button>
          }
        />
      </PageBody>
    )
  }

  const selected = detail.data ?? null

  return (
    <PageBody>
      <PageHeader
        eyebrow="Keep track of your care"
        title="Therapy progress"
        description={
          history.length
            ? 'Every completed visit is listed below with the notes your therapist shared.'
            : 'Your first completed visit will appear here, with the notes your therapist shares.'
        }
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard/appointments">
              View appointments <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          </Button>
        }
      />

      <section className="mt-5" aria-labelledby="session-history-title">
        <p className="text-[11.5px] font-medium text-ink-faint">Your completed visits</p>
        <h2
          id="session-history-title"
          className="mt-0.5 text-[17px] font-semibold tracking-[-0.01em] text-ink"
        >
          Session history
        </h2>

        {history.length ? (
          <ul className="mt-3 grid gap-2">
            {history.map((session) => (
              <li key={session._id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(session._id)}
                  className="flex w-full items-center gap-3 rounded-lg border border-hairline bg-card p-3.5 text-left transition-colors hover:border-ink-faint/60"
                >
                  <span className="text-ink-faint" aria-hidden="true">
                    <CalendarCheck2 size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-[13px] text-ink">
                      {formatAppointmentDate(session.sessionDate)}
                    </strong>
                    <span className="block text-[12px] text-ink-soft">
                      {session.service?.name || 'Therapy session'} ·{' '}
                      {therapistName(session.therapist)}
                    </span>
                    <small className="block text-[11px] text-ink-faint">
                      {session.durationMinutes} minutes
                    </small>
                  </span>
                  <ArrowUpRight size={16} aria-hidden="true" className="text-ink-faint" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<CalendarCheck2 size={22} />}
            title="No session history yet"
            message="Completed visits and therapist notes will appear here."
          />
        )}
      </section>

      <Dialog
        open={Boolean(selectedId)}
        onOpenChange={(open) => (open ? null : setSelectedId(null))}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selected?.service?.name || 'Therapy session'}</DialogTitle>
            <DialogDescription>Session details</DialogDescription>
          </DialogHeader>

          {detail.isLoading ? (
            <Skeleton className="h-24 rounded-md" />
          ) : selected ? (
            <div className="grid gap-3">
              <dl className="grid grid-cols-2 gap-3 text-[13px]">
                <div>
                  <dt className="text-[11.5px] text-ink-faint">Date</dt>
                  <dd className="mt-0.5 text-ink">{formatAppointmentDate(selected.sessionDate)}</dd>
                </div>
                <div>
                  <dt className="text-[11.5px] text-ink-faint">Duration</dt>
                  <dd className="mt-0.5 text-ink">{selected.durationMinutes} minutes</dd>
                </div>
                <div>
                  <dt className="text-[11.5px] text-ink-faint">Therapist</dt>
                  <dd className="mt-0.5 text-ink">{therapistName(selected.therapist)}</dd>
                </div>
              </dl>
              <div className="rounded-md bg-sunk p-3">
                <p className="text-[11.5px] text-ink-faint">Notes from your therapist</p>
                <p className="mt-1 text-[13px] text-ink">
                  {selected.patientVisibleNotes || 'No notes were shared for this session.'}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-[12.5px] text-ink-soft">
              {detail.error?.message || 'This session could not be loaded.'}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </PageBody>
  )
}
