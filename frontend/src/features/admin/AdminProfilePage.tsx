import { zodResolver } from '@hookform/resolvers/zod'
import { Edit3, Save, X } from 'lucide-react'
import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useSearchParams } from 'react-router-dom'
import { TextField } from '@/components/form/FormFields'
import { PageBody, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { useAuth } from '@/features/auth/session'
import { getApiErrorDetails, type AuthUser } from '@/lib/api/auth'
import { showPromise } from '@/lib/toast'
import { useSaveProfile } from './mutations'
import { adminProfileSchema, type AdminProfileValues } from './schemas'

function toForm(profile: AuthUser | null): AdminProfileValues {
  return {
    firstName: profile?.firstName || profile?.firstname || '',
    lastName: profile?.lastName || profile?.lastname || '',
    phone: profile?.phone || '',
    address: profile?.address || '',
    profilePicture: profile?.profilePicture || '',
  }
}

export default function AdminProfilePage() {
  const { user, setUser } = useAuth()
  const profile = user as AuthUser | null
  const saveMutation = useSaveProfile()
  const [searchParams, setSearchParams] = useSearchParams()
  const editing = searchParams.get('edit') === '1'

  function setEditing(next: boolean) {
    setSearchParams(next ? { edit: '1' } : {}, { replace: true })
  }

  const form = useForm<AdminProfileValues>({
    resolver: zodResolver(adminProfileSchema),
    defaultValues: toForm(profile),
  })

  useEffect(() => {
    form.reset(toForm(profile))
  }, [form, profile])

  const watched = useWatch({ control: form.control }) as AdminProfileValues
  const values = editing ? watched : toForm(profile)
  const fullName = `${values.firstName} ${values.lastName}`.trim() || 'Administrator'
  const initials =
    `${(values.firstName || '')[0] || ''}${(values.lastName || '')[0] || ''}`.toUpperCase() || 'AC'

  const onSubmit = form.handleSubmit(async (submitted) => {
    const request = saveMutation.mutateAsync({
      firstName: submitted.firstName.trim(),
      lastName: submitted.lastName.trim(),
      phone: submitted.phone.trim(),
      address: submitted.address.trim(),
      profilePicture: submitted.profilePicture.trim(),
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
        if (['firstName', 'lastName', 'phone', 'address', 'profilePicture'].includes(field)) {
          form.setError(field as keyof AdminProfileValues, { message })
        }
      }
      form.setError('root', {
        message: fields.length ? 'Please correct the highlighted profile fields.' : details.message,
      })
    }
  })

  return (
    <PageBody>
      <PageHeader
        eyebrow="Your account"
        title="Profile"
        description="Your administrator details for the clinic portal."
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

      <section className="mt-5 rounded-lg border border-hairline bg-card p-5">
        {editing ? (
          <Form {...form}>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit} noValidate>
              <div className="flex items-center gap-4 sm:col-span-2">
                <Avatar picture={watched.profilePicture} fallback={initials} />
                <p className="text-[12px] text-ink-soft">
                  Use a public image URL for your profile photo.
                </p>
              </div>
              <TextField<AdminProfileValues>
                control={form.control}
                name="firstName"
                label="First name"
              />
              <TextField<AdminProfileValues>
                control={form.control}
                name="lastName"
                label="Last name"
              />
              <TextField<AdminProfileValues>
                control={form.control}
                name="phone"
                label="Phone"
                type="tel"
                inputMode="numeric"
                placeholder="Not provided"
              />
              <div className="text-[12.5px] text-ink-soft">
                <span className="block text-[11.5px] text-ink-faint">Email</span>
                <span className="mt-0.5 block">{profile?.email || 'Not provided'}</span>
                <span className="mt-1 block text-[11px] text-ink-faint">
                  Your email is managed by the clinic administrator.
                </span>
              </div>
              <div className="sm:col-span-2">
                <TextField<AdminProfileValues>
                  control={form.control}
                  name="address"
                  label="Address"
                  placeholder="Not provided"
                />
              </div>
              <div className="sm:col-span-2">
                <TextField<AdminProfileValues>
                  control={form.control}
                  name="profilePicture"
                  label="Profile photo URL"
                  type="url"
                  placeholder="https://…"
                />
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
                  onClick={() => {
                    form.reset(toForm(profile))
                    setEditing(false)
                  }}
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
              <Avatar picture={values.profilePicture} fallback={initials} large />
              <strong className="text-[14px] text-ink">{fullName}</strong>
              <span className="text-[12px] text-ink-soft">{profile?.email || 'Not provided'}</span>
            </div>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Detail label="First name" value={values.firstName} />
              <Detail label="Last name" value={values.lastName} />
              <Detail label="Email" value={profile?.email} />
              <Detail label="Phone" value={profile?.phone} />
              <Detail label="Address" value={profile?.address} />
              <div>
                <dt className="text-[11.5px] text-ink-faint">Role</dt>
                <dd className="mt-1">
                  <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">
                    Administrator
                  </span>
                </dd>
              </div>
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
  picture?: string | null
  fallback: string
  large?: boolean
}) {
  const size = large ? 'size-16 text-[18px]' : 'size-12 text-[14px]'
  if (picture) {
    return <img src={picture} alt="" className={`${size} rounded-full object-cover`} />
  }
  return (
    <span
      className={`flex ${size} items-center justify-center rounded-full bg-primary-soft font-semibold text-primary`}
      aria-hidden="true"
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
