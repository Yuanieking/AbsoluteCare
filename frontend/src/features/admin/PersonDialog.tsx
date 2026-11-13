import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { WeeklyAvailabilityEditor } from '@/components/availability/WeeklyAvailabilityEditor'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { AddressField, TextField } from '@/components/form/FormFields'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { formatSchedule, scheduleErrors, scheduleOf, schedulePayload } from '@/lib/availability'
import { getApiErrorDetails } from '@/lib/api/auth'
import { showPromise } from '@/lib/toast'
import { accountStatus, lastAvailabilityAudit, specializationList } from './format'
import { useSavePerson, useSaveTherapistAvailability } from './mutations'
import { useSpecializationCatalog } from './queries'
import { personSchema, type PersonValues } from './schemas'
import type { PersonRef, UserAccount } from './types'

const specializationOptions = [
  'Speech-Language Pathologist (SLP)',
  'Physical Therapist (PTs)',
  'Occupational Therapist (OTs)',
  'Special Education (SPED) Teachers',
]

function customSpecializations(...lists: string[][]) {
  const seen = new Set(specializationOptions.map((item) => item.toLowerCase()))
  const result: string[] = []
  for (const item of lists.flat()) {
    const key = item.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(item.trim())
  }
  return result
}

type Conflict = {
  appointmentId: string
  patientName: string
  startsAt: string
  endsAt: string
  reason: string
}

const conflictReasons: Record<string, string> = {
  day_not_available: 'Falls on a day that is no longer worked',
  before_opening: 'Starts before the opening time',
  after_closing: 'Ends after the closing time',
}

const conflictTime = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Manila',
})

function conflictOf(error: unknown): { message: string; conflicts: Conflict[] } | null {
  const data = (
    error as { response?: { data?: { message?: string; conflicts?: Conflict[] } } } | null
  )?.response?.data
  return data?.conflicts?.length
    ? {
        message: data.message || 'Some appointments fall outside this schedule.',
        conflicts: data.conflicts,
      }
    : null
}

function toForm(person: UserAccount | null): PersonValues {
  return {
    firstname: person?.firstname || '',
    lastname: person?.lastname || '',
    email: person?.email || '',
    phone: person?.phone || '',
    dateOfBirth: person?.dateOfBirth || '',
    address: person?.address || '',
    profilePicture: person?.profilePicture || '',
    specialization: specializationList(person),
  }
}

export function PersonDialog({
  person,
  role,
  open,
  onOpenChange,
}: {
  person: UserAccount | null
  role: 'patient' | 'therapist'
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const save = useSavePerson(role)
  const saveSchedule = useSaveTherapistAvailability()
  const form = useForm<PersonValues>({
    resolver: zodResolver(personSchema),
    defaultValues: toForm(person),
  })
  const specialization = useWatch({ control: form.control, name: 'specialization' }) ?? []
  // Custom specializations come from the shared list and stay listed once unchecked.
  const catalog = useSpecializationCatalog(role === 'therapist').data
  const [addedOptions, setAddedOptions] = useState(() => specializationList(person))
  const customOptions = useMemo(
    () => customSpecializations(catalog ?? [], addedOptions),
    [catalog, addedOptions],
  )
  const [customDraft, setCustomDraft] = useState('')

  const [days, setDays] = useState(() => scheduleOf(person))
  const [savedDays, setSavedDays] = useState(days)
  const [scheduleNote, setScheduleNote] = useState('')
  const [conflicts, setConflicts] = useState<{ message: string; conflicts: Conflict[] } | null>(
    null,
  )
  const [savedNotice, setSavedNotice] = useState(false)

  const status = accountStatus(person)
  const readOnly = status === 'archived' || status === 'removed'
  const scheduleDirty = JSON.stringify(days) !== JSON.stringify(savedDays)
  const rowErrors = scheduleErrors(days)

  const onSubmit = form.handleSubmit(async (values) => {
    if (!person || readOnly) return
    const payload = {
      firstname: values.firstname.trim(),
      lastname: values.lastname.trim(),
      email: values.email.trim(),
      phone: values.phone.trim(),
      address: values.address.trim(),
      profilePicture: values.profilePicture.trim(),
      ...(role === 'patient'
        ? { dateOfBirth: values.dateOfBirth }
        : { specialization: values.specialization }),
    }
    const request = save.mutateAsync({
      id: person._id,
      payload,
      customSpecializations: customOptions,
    })
    showPromise(request, {
      loading: 'Saving profile...',
      success: 'Profile saved.',
      error: 'Unable to save this record.',
    })
    try {
      await request
    } catch (error) {
      const details = getApiErrorDetails(error)
      form.setError('root', {
        message: Object.keys(details.fieldErrors).length
          ? 'Please correct the highlighted fields.'
          : details.message,
      })
    }
  })

  function addCustomSpecialization() {
    const value = customDraft.trim()
    if (!value) return
    const known = [...specializationOptions, ...customOptions, ...specialization]
    const match = known.find((item) => item.toLowerCase() === value.toLowerCase())
    const name = match ?? value
    if (!match) setAddedOptions((current) => [...current, name])
    if (!specialization.includes(name)) {
      form.setValue('specialization', [...specialization, name], { shouldDirty: true })
    }
    setCustomDraft('')
  }

  async function submitSchedule() {
    if (!person) return
    if (!days.length) {
      setScheduleNote(
        'Choose at least one working day. With none set, the therapist is assignable at any time.',
      )
      return
    }
    if (Object.keys(rowErrors).length) {
      setScheduleNote('Correct the highlighted times before saving.')
      const day = Object.keys(rowErrors)[0]
      document.getElementById(`person-availability-${day}-end`)?.focus()
      return
    }
    setScheduleNote('')
    setConflicts(null)
    try {
      const updated = await saveSchedule.mutateAsync({ id: person._id, ...schedulePayload(days) })
      const next = scheduleOf(updated)
      setDays(next)
      setSavedDays(next)
      setSavedNotice(true)
    } catch (error) {
      const conflict = conflictOf(error)
      if (conflict) {
        setConflicts(conflict)
        return
      }
      setScheduleNote(getApiErrorDetails(error).message)
    }
  }

  const busy = save.isPending || saveSchedule.isPending

  return (
    <Dialog open={open} onOpenChange={(next) => (busy ? undefined : onOpenChange(next))}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Edit {role} record
            {person ? <span className="text-ink-soft"> · {personNameOf(person)}</span> : null}
          </DialogTitle>
          <DialogDescription>
            {role === 'therapist'
              ? 'Profile details and the weekly schedule are saved separately.'
              : 'Keep patient contact and profile information accurate.'}
          </DialogDescription>
        </DialogHeader>

        {readOnly ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md bg-sunk px-3 py-2">
            <StatusBadge status={status} />
            <p className="text-[12px] text-ink-soft">
              This record is {status === 'removed' ? 'removed' : 'archived'} and can only be read.
              Reopen it from Users to make changes.
            </p>
          </div>
        ) : null}

        <Form {...form}>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={onSubmit} noValidate>
            <TextField<PersonValues>
              control={form.control}
              name="firstname"
              label="First name"
              disabled={readOnly}
            />
            <TextField<PersonValues>
              control={form.control}
              name="lastname"
              label="Last name"
              disabled={readOnly}
            />
            <TextField<PersonValues>
              control={form.control}
              name="email"
              label="Email"
              type="email"
              disabled={readOnly}
            />
            <TextField<PersonValues>
              control={form.control}
              name="phone"
              label="Phone"
              type="tel"
              inputMode="numeric"
              disabled={readOnly}
              description="09XXXXXXXXX or +639XXXXXXXXX."
            />
            {role === 'patient' ? (
              <TextField<PersonValues>
                control={form.control}
                name="dateOfBirth"
                label="Date of birth"
                type="date"
                disabled={readOnly}
              />
            ) : (
              <TextField<PersonValues>
                control={form.control}
                name="profilePicture"
                label="Profile picture URL"
                type="url"
                placeholder="https://…"
                disabled={readOnly}
              />
            )}
            <div className="sm:col-span-2">
              <AddressField<PersonValues>
                control={form.control}
                name="address"
                label="Address"
                multiline
                rows={3}
                disabled={readOnly}
              />
            </div>

            {role === 'therapist' ? (
              <FormField
                control={form.control}
                name="specialization"
                render={() => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Specializations</FormLabel>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {[...specializationOptions, ...customOptions].map((option) => {
                        const checked = specialization.includes(option)
                        return (
                          <label
                            key={option}
                            className="flex items-start gap-2 text-[12.5px] text-ink"
                          >
                            <FormControl>
                              <Checkbox
                                checked={checked}
                                disabled={readOnly}
                                onCheckedChange={(next) =>
                                  form.setValue(
                                    'specialization',
                                    next === true
                                      ? [...specialization, option]
                                      : specialization.filter((item) => item !== option),
                                    { shouldDirty: true },
                                  )
                                }
                              />
                            </FormControl>
                            {option}
                          </label>
                        )
                      })}
                    </div>
                    {readOnly ? null : (
                      <div className="flex gap-2">
                        <Input
                          value={customDraft}
                          onChange={(event) => setCustomDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key !== 'Enter') return
                            event.preventDefault()
                            addCustomSpecialization()
                          }}
                          placeholder="Add another specialization"
                          maxLength={80}
                          aria-label="Add another specialization"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={addCustomSpecialization}
                          disabled={!customDraft.trim()}
                        >
                          Add
                        </Button>
                      </div>
                    )}
                  </FormItem>
                )}
              />
            ) : null}

            {form.formState.errors.root ? (
              <p role="alert" className="text-[12.5px] text-destructive sm:col-span-2">
                {form.formState.errors.root.message}
              </p>
            ) : null}

            <DialogFooter className="sm:col-span-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={busy}
              >
                Close
              </Button>
              <Button type="submit" disabled={busy || readOnly}>
                {save.isPending ? (
                  <LoaderCircle className="animate-spin" size={15} aria-hidden="true" />
                ) : null}
                {save.isPending ? 'Saving…' : 'Save profile'}
              </Button>
            </DialogFooter>
          </form>
        </Form>

        {role === 'therapist' ? (
          <section aria-labelledby="person-schedule" className="border-t border-hairline pt-4">
            <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
              <div className="min-w-0">
                <h3 id="person-schedule" className="text-[14px] font-semibold text-ink">
                  Weekly schedule
                </h3>
                <p className="text-[12px] text-ink-soft">
                  {days.length ? formatSchedule(days) : 'No working days — assignable at any time.'}
                </p>
              </div>
              <p className="text-[11.5px] text-ink-faint">{lastAvailabilityAudit(person)}</p>
            </header>

            <div className="mt-3">
              <WeeklyAvailabilityEditor
                value={days}
                onChange={(next) => {
                  setDays(next)
                  setScheduleNote('')
                  setSavedNotice(false)
                }}
                errors={rowErrors}
                disabled={readOnly || saveSchedule.isPending}
                idPrefix="person-availability"
              />
            </div>

            {conflicts ? (
              <div
                role="alert"
                className="mt-3 rounded-md border border-destructive/35 bg-destructive-soft/60 p-3"
              >
                <p className="text-[12.5px] font-medium text-destructive">{conflicts.message}</p>
                <ul className="mt-2 grid gap-1.5">
                  {conflicts.conflicts.map((conflict) => (
                    <li key={conflict.appointmentId} className="text-[12px] text-ink">
                      {conflict.patientName} · {conflictTime.format(new Date(conflict.startsAt))} ·{' '}
                      <span className="text-ink-soft">
                        {conflictReasons[conflict.reason] || conflict.reason}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11.5px] text-ink-soft">
                  Reschedule or cancel these from Appointments, then save again.
                </p>
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-hairline-in pt-3">
              <p
                role={scheduleNote ? 'alert' : 'status'}
                className={
                  scheduleNote ? 'text-[12px] text-destructive' : 'text-[12px] text-ink-faint'
                }
              >
                {scheduleNote ||
                  (savedNotice && !scheduleDirty
                    ? 'Schedule saved.'
                    : 'The therapist sees this schedule on their own availability page.')}
              </p>
              <Button
                type="button"
                onClick={() => void submitSchedule()}
                disabled={readOnly || !scheduleDirty || busy}
              >
                {saveSchedule.isPending ? (
                  <LoaderCircle className="animate-spin" size={15} aria-hidden="true" />
                ) : null}
                {saveSchedule.isPending ? 'Saving…' : 'Save schedule'}
              </Button>
            </div>
          </section>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function personNameOf(person: PersonRef) {
  return [person.firstname, person.lastname].filter(Boolean).join(' ')
}
