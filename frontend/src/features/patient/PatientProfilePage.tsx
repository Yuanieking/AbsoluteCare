import { zodResolver } from '@hookform/resolvers/zod'
import { Camera, Edit3, Save, X } from 'lucide-react'
import { useEffect, useState, type ChangeEvent } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { TextField } from '@/components/form/FormFields'
import { PageBody, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { useAuth } from '@/features/auth/session'
import { getApiErrorDetails } from '@/lib/api/auth'
import { todayInManila } from '@/lib/format/patient'
import { showPromise } from '@/lib/toast'
import { initials } from './format'
import { useSaveProfile } from './mutations'
import { profileSchema, type ProfileValues } from './schemas'
import type { PatientProfile } from './types'

function formatDateOfBirth(value?: string) {
  if (!value) return 'Not provided'
  const match = value.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return 'Not provided'

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  if (Number.isNaN(date.getTime())) return 'Not provided'

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(date)
}

function toForm(profile: PatientProfile | null): ProfileValues {
  return {
    firstName: profile?.firstName || '',
    lastName: profile?.lastName || '',
    phone: profile?.phone || '',
    dateOfBirth: profile?.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : '',
    address: profile?.address || '',
    profilePicture: profile?.profilePicture || '',
  }
}

export default function PatientProfilePage() {
  const { user, setUser } = useAuth()
  const profile = user as PatientProfile | null
  const saveMutation = useSaveProfile()
  const [editing, setEditing] = useState(false)

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: toForm(profile),
  })

  useEffect(() => {
    form.reset(toForm(profile))
  }, [form, profile])

  const watched = useWatch({ control: form.control }) as ProfileValues
  const hasChanges = editing && form.formState.isDirty
  const isGoogleAccount = profile?.authProvider === 'google'

  useEffect(() => {
    function warnBeforeLeave(event: BeforeUnloadEvent) {
      if (!hasChanges) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeLeave)
    return () => window.removeEventListener('beforeunload', warnBeforeLeave)
  }, [hasChanges])

  function handlePicture(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) {
      form.setError('root', { message: 'Choose an image file smaller than 2 MB.' })
      return
    }
    const reader = new FileReader()
    reader.onload = () =>
      form.setValue('profilePicture', String(reader.result || ''), { shouldDirty: true })
    reader.readAsDataURL(file)
  }

  function cancelEditing() {
    if (hasChanges && !window.confirm('Discard your unsaved profile changes?')) return
    form.reset(toForm(profile))
    setEditing(false)
  }

  const onSubmit = form.handleSubmit(async (values) => {
    const request = saveMutation.mutateAsync({
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      phone: values.phone.trim(),
      dateOfBirth: values.dateOfBirth || null,
      address: values.address.trim(),
      profilePicture: values.profilePicture,
    })
    showPromise(request, {
      loading: 'Saving profile...',
      success: 'Profile updated.',
      error: "Couldn't save your profile.",
    })
    try {
      const updated = await request
      setUser(updated)
      form.reset(toForm(updated))
      setEditing(false)
    } catch (error) {
      const details = getApiErrorDetails(error)
      const fields = Object.entries(details.fieldErrors)
      for (const [field, message] of fields) {
        if (['firstName', 'lastName', 'phone', 'dateOfBirth', 'address'].includes(field)) {
          form.setError(field as keyof ProfileValues, { message })
        }
      }
      form.setError('root', {
        message: fields.length ? 'Please correct the highlighted profile fields.' : details.message,
      })
    }
  })

  const display = editing ? watched : toForm(profile)
  const avatarInitials =
    display.firstName || display.lastName ? initials(display.firstName, display.lastName) : 'AC'

  return (
    <PageBody>
      <PageHeader
        eyebrow="Your account"
        title="Profile"
        description="Your personal details help the clinic reach you about your care."
        actions={
          editing ? null : (
            <Button
              type="button"
              onClick={() => {
                form.reset(toForm(profile))
                setEditing(true)
              }}
            >
              <Edit3 size={16} aria-hidden="true" /> Edit profile
            </Button>
          )
        }
      />

      {profile?.isGuardian ? (
        <p className="mt-3 inline-flex rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-medium text-primary">
          Guardian
        </p>
      ) : null}

      <section className="mt-4 rounded-lg border border-hairline bg-card p-5">
        {editing ? (
          <Form {...form}>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit} noValidate>
              <div className="flex items-center gap-4 sm:col-span-2">
                <Avatar picture={watched.profilePicture} fallback={avatarInitials} />
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-hairline px-3 py-1.5 text-[12.5px] font-medium text-ink hover:bg-sunk">
                  <Camera size={15} aria-hidden="true" /> Change picture
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handlePicture}
                  />
                </label>
              </div>

              <TextField<ProfileValues>
                control={form.control}
                name="firstName"
                label="First name"
              />
              <TextField<ProfileValues> control={form.control} name="lastName" label="Last name" />
              <TextField<ProfileValues>
                control={form.control}
                name="phone"
                label="Phone"
                type="tel"
                inputMode="numeric"
                placeholder="Not provided"
              />
              <TextField<ProfileValues>
                control={form.control}
                name="dateOfBirth"
                label="Date of birth"
                type="date"
                min="1900-01-01"
                max={todayInManila()}
              />
              <div className="sm:col-span-2">
                <TextField<ProfileValues>
                  control={form.control}
                  name="address"
                  label="Address"
                  placeholder="Not provided"
                />
              </div>

              <div className="rounded-md bg-sunk p-3 sm:col-span-2">
                <p className="text-[11.5px] text-ink-faint">Email</p>
                <p className="mt-0.5 text-[13px] text-ink">{profile?.email || 'Not provided'}</p>
                <p className="mt-1 text-[11.5px] text-ink-soft">
                  {isGoogleAccount ? 'Managed by Google' : 'Email changes require verification.'}
                </p>
              </div>

              {form.formState.errors.root ? (
                <p role="alert" className="text-[12.5px] text-destructive sm:col-span-2">
                  {form.formState.errors.root.message}
                </p>
              ) : null}

              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={cancelEditing}
                  disabled={saveMutation.isPending}
                >
                  <X size={16} aria-hidden="true" /> Cancel
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  <Save size={16} aria-hidden="true" />
                  {saveMutation.isPending ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            </form>
          </Form>
        ) : (
          <div className="grid gap-5 sm:grid-cols-[200px_minmax(0,1fr)]">
            <div className="flex flex-col items-start gap-2">
              <Avatar picture={display.profilePicture} fallback={avatarInitials} large />
              <strong className="text-[14px] text-ink">
                {display.firstName || 'Patient'} {display.lastName}
              </strong>
              <span className="text-[12px] text-ink-soft">{profile?.email || 'Not provided'}</span>
            </div>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Detail label="First name" value={display.firstName} />
              <Detail label="Last name" value={display.lastName} />
              <Detail label="Phone" value={display.phone} />
              <Detail label="Date of birth" value={formatDateOfBirth(display.dateOfBirth)} />
              <Detail label="Address" value={display.address} />
              <Detail label="Email" value={profile?.email} />
              {profile?.createdAt ? (
                <Detail
                  label="Account created"
                  value={new Date(profile.createdAt).toLocaleDateString()}
                />
              ) : null}
            </dl>
          </div>
        )}
      </section>
    </PageBody>
  )
}

function Avatar({
  picture,
  fallback,
  large,
}: {
  picture?: string
  fallback: string
  large?: boolean
}) {
  const size = large ? 'size-16 text-[18px]' : 'size-12 text-[14px]'
  if (picture) {
    return <img src={picture} alt="Profile" className={`${size} rounded-full object-cover`} />
  }
  return (
    <span
      className={`flex ${size} items-center justify-center rounded-full bg-primary-soft font-semibold text-primary`}
    >
      {fallback}
    </span>
  )
}

function Detail({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-[11.5px] text-ink-faint">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-ink">{value || 'Not provided'}</dd>
    </div>
  )
}
