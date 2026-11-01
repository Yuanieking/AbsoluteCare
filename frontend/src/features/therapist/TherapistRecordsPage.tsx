import { zodResolver } from '@hookform/resolvers/zod'
import { ClipboardList, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { DataTable, type AppColumnDef } from '@/components/data-table/DataTable'
import { EmptyState } from '@/components/feedback/EmptyState'
import { TextField, TextareaField } from '@/components/form/FormFields'
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
import { Form } from '@/components/ui/form'
import { formatDateManila, todayInManila } from '@/lib/format/patient'
import { showPromise } from '@/lib/toast'
import { personName } from './format'
import { useUpdateSession } from './mutations'
import { useTherapistSessions } from './queries'
import { sessionSchema, type SessionValues } from './schemas'
import type { SessionRecord } from './types'

export default function TherapistRecordsPage() {
  const query = useTherapistSessions()
  const [editing, setEditing] = useState<SessionRecord | null>(null)

  const columns: AppColumnDef<SessionRecord>[] = [
    {
      id: 'patient',
      meta: { label: 'Patient' },
      header: 'Patient',
      accessorFn: (session) => sessionPatient(session),
      cell: ({ row }) => (
        <div className="min-w-0">
          <span className="block truncate font-medium text-ink">
            {sessionPatient(row.original)}
          </span>
          <span className="block truncate text-[11.5px] text-ink-soft">
            {row.original.patient?.email || 'No email on file'}
          </span>
        </div>
      ),
    },
    {
      id: 'sessionDate',
      meta: { label: 'Session date' },
      header: 'Session date',
      accessorFn: (session) => session.sessionDate,
      cell: ({ row }) => (
        <strong className="font-medium whitespace-nowrap">
          {formatDateManila(row.original.sessionDate)}
        </strong>
      ),
    },
    {
      id: 'service',
      meta: { label: 'Service' },
      header: 'Service',
      accessorFn: (session) => session.service?.name || 'Therapy session',
      cell: ({ row }) => (
        <span className="text-ink-soft">{row.original.service?.name || 'Therapy session'}</span>
      ),
    },
    {
      id: 'duration',
      meta: { label: 'Duration' },
      header: 'Duration',
      accessorFn: (session) => session.durationMinutes ?? 0,
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.durationMinutes ?? 0} min</span>
      ),
    },
    {
      id: 'actions',
      meta: { label: 'Actions' },
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
          <Button variant="link" size="xs" onClick={() => setEditing(row.original)}>
            Edit
          </Button>
        </div>
      ),
    },
  ]

  return (
    <PageBody>
      <PageHeader
        eyebrow="Clinical records"
        title="Session records"
        description="Review and refine notes from your completed visits."
      />

      <DataTable
        className="mt-5"
        columns={columns}
        data={query.data ?? []}
        isLoading={query.isLoading}
        getRowId={(session) => session._id}
        rowLabel={(session) => `Edit the session record for ${sessionPatient(session)}`}
        onRowClick={setEditing}
        empty={
          query.error ? (
            <EmptyState
              icon={<RefreshCw size={22} />}
              title="We couldn’t load session records"
              message={query.error.message}
              action={
                <Button type="button" variant="outline" onClick={() => void query.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<ClipboardList size={22} />}
              title="No session records yet"
              message="Completed sessions and clinical documentation will appear here."
            />
          )
        }
      />

      <SessionEditDialog session={editing} onOpenChange={(open) => !open && setEditing(null)} />
    </PageBody>
  )
}

function sessionPatient(session: SessionRecord) {
  return personName(session.dependent) || personName(session.patient) || 'Patient'
}

function SessionEditDialog({
  session,
  onOpenChange,
}: {
  session: SessionRecord | null
  onOpenChange: (open: boolean) => void
}) {
  const mutation = useUpdateSession()
  const form = useForm<SessionValues>({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
      sessionDate: todayInManila(),
      durationMinutes: '60',
      patientVisibleNotes: '',
      clinicalNotes: '',
    },
  })

  useEffect(() => {
    if (!session) return
    form.reset({
      sessionDate: session.sessionDate.slice(0, 10),
      durationMinutes: String(session.durationMinutes ?? 60),
      patientVisibleNotes: session.patientVisibleNotes || '',
      clinicalNotes: session.clinicalNotes || '',
    })
  }, [form, session])

  const onSubmit = form.handleSubmit(async (values) => {
    if (!session) return
    const request = mutation.mutateAsync({
      id: session._id,
      ...values,
      durationMinutes: Number(values.durationMinutes),
    })
    showPromise(request, {
      loading: 'Saving session record...',
      success: 'Session record updated.',
      error: "Couldn't update the session record.",
    })
    try {
      await request
      onOpenChange(false)
    } catch {}
  })

  return (
    <Dialog
      open={Boolean(session)}
      onOpenChange={(open) => {
        if (!open) form.reset()
        onOpenChange(open)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit session record</DialogTitle>
          <DialogDescription>
            Updating the clinical record for {session ? sessionPatient(session) : 'this patient'}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="grid gap-3" onSubmit={onSubmit} noValidate>
            <TextField<SessionValues>
              control={form.control}
              name="sessionDate"
              label="Session date"
              type="date"
              max={todayInManila()}
            />
            <TextField<SessionValues>
              control={form.control}
              name="durationMinutes"
              label="Duration (minutes)"
              type="number"
              min={1}
              max={240}
            />
            <TextareaField<SessionValues>
              control={form.control}
              name="clinicalNotes"
              label="Clinical notes"
              description="Staff only. Never shown to the patient."
              rows={5}
              maxLength={4000}
            />
            <TextareaField<SessionValues>
              control={form.control}
              name="patientVisibleNotes"
              label="Notes for the patient"
              description="Shown in the patient's portal with this session. Leave blank to share nothing."
              rows={3}
              maxLength={4000}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
