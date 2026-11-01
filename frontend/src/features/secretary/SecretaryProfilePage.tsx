import { zodResolver } from '@hookform/resolvers/zod'
import { Edit3, RefreshCw, Save, X } from 'lucide-react'
import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useSearchParams } from 'react-router-dom'
import { EmptyState } from '@/components/feedback/EmptyState'
import { TextField } from '@/components/form/FormFields'
import { PageBody, PageHeader } from '@/components/layout/Page'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/session'
import type { AuthUser } from '@/lib/api/auth'
import { getApiErrorDetails } from '@/lib/api/auth'
import { showPromise } from '@/lib/toast'
import { useSaveSecretaryProfile } from './mutations'
import { useSecretaryProfile } from './queries'
import { secretaryProfileSchema, type SecretaryProfileValues } from './schemas'
import type { SecretaryProfile } from './types'

function toForm(profile?: SecretaryProfile | null): SecretaryProfileValues {
  return {
    firstname: profile?.firstname || '',
    lastname: profile?.lastname || '',
    phone: profile?.phone || '',
    profilePicture: profile?.profilePicture || '',
  }
}

export default function SecretaryProfilePage() {
  const query = useSecretaryProfile()
  const saveMutation = useSaveSecretaryProfile()
  const { setUser } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const editing = searchParams.get('edit') === '1'

  function setEditing(next: boolean) {
    setSearchParams(next ? { edit: '1' } : {}, { replace: true })
  }

  const form = useForm<SecretaryProfileValues>({
    resolver: zodResolver(secretaryProfileSchema),
    defaultValues: toForm(query.data),
  })

  useEffect(() => {
    if (query.data) form.reset(toForm(query.data))
  }, [form, query.data])

  const watched = useWatch({ control: form.control })
  const profile = editing ? { ...query.data, ...watched } : query.data
  const fullName = `${profile?.firstname || ''} ${profile?.lastname || ''}`.trim() || 'Secretary'
  const initials = `${profile?.firstname?.[0] || ''}${profile?.lastname?.[0] || ''}`.toUpperCase()

  const onSubmit = form.handleSubmit(async (values) => {
    const request = saveMutation.mutateAsync({
      firstname: values.firstname.trim(),
      lastname: values.lastname.trim(),
      phone: values.phone.trim(),
      profilePicture: values.profilePicture.trim(),
    })
    showPromise(request, {
      loading: 'Saving profile...',
      success: 'Profile updated.',
      error: "Couldn't save your profile.",
    })
    try {
      const updated = await request
      form.reset(toForm(updated))
      setUser(updated as unknown as AuthUser)
      setEditing(false)
    } catch (error) {
      const details = getApiErrorDetails(error)
      for (const [field, message] of Object.entries(details.fieldErrors)) {
        if (['firstname', 'lastname', 'phone', 'profilePicture'].includes(field)) {
          form.setError(field as keyof SecretaryProfileValues, { message })
        }
      }
      form.setError('root', {
        message: Object.keys(details.fieldErrors).length
          ? 'Please correct the highlighted profile fields.'
          : details.message,
      })
    }
  })

  if (query.isLoading) {
    return (
      <PageBody aria-busy="true">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-64 rounded-lg" />
        <p className="sr-only" role="status">
          Loading your profile
        </p>
      </PageBody>
    )
  }

  if (query.error) {
    return (
      <PageBody>
        <EmptyState
          icon={<RefreshCw size={20} />}
          title="We couldn’t load your profile"
          message={query.error.message}
          action={
            <Button type="button" onClick={() => void query.refetch()}>
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
        eyebrow="Your account"
        title="Profile"
        description="Keep your clinic contact details current."
        actions={
          editing ? null : (
            <Button
              type="button"
              onClick={() => {
                form.reset(toForm(query.data))
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
                <Avatar picture={watched.profilePicture} fallback={initials || 'AC'} />
                <p className="text-[12px] text-ink-soft">
                  Use a public image URL for your profile photo.
                </p>
              </div>
              <TextField<SecretaryProfileValues>
                control={form.control}
                name="firstname"
                label="First name"
              />
              <TextField<SecretaryProfileValues>
                control={form.control}
                name="lastname"
                label="Last name"
              />
              <TextField<SecretaryProfileValues>
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
                <TextField<SecretaryProfileValues>
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
                    form.reset(toForm(query.data))
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
              <Avatar picture={profile?.profilePicture} fallback={initials || 'AC'} large />
              <strong className="text-[14px] text-ink">{fullName}</strong>
              <span className="text-[12px] text-ink-soft">{profile?.email || 'Not provided'}</span>
            </div>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Detail label="First name" value={profile?.firstname} />
              <Detail label="Last name" value={profile?.lastname} />
              <Detail label="Email" value={profile?.email} />
              <Detail label="Phone" value={profile?.phone} />
              <div>
                <dt className="text-[11.5px] text-ink-faint">Role</dt>
                <dd className="mt-1">
                  <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">
                    Secretary
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-[11.5px] text-ink-faint">Account status</dt>
                <dd className="mt-1">
                  <StatusBadge status={profile?.isActive === false ? 'deactivated' : 'active'} />
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
