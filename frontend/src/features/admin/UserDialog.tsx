import { zodResolver } from '@hookform/resolvers/zod'
import { Copy, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { SelectField, TextField } from '@/components/form/FormFields'
import { StatusBadge } from '@/components/domain/StatusBadge'
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
import { useSettings } from '@/features/settings/provider'
import { getApiErrorDetails } from '@/lib/api/auth'
import { showPromise } from '@/lib/toast'
import { accountStatus, formatDate, roleLabel } from './format'
import { useCreateUser, useUpdateUser } from './mutations'
import { userSchema, type UserValues } from './schemas'
import type { UserAccount } from './types'

const roleOptions = [
  { value: 'patient', label: 'Patient' },
  { value: 'therapist', label: 'Therapist' },
  { value: 'secretary', label: 'Secretary' },
  { value: 'admin', label: 'Admin' },
]

function toForm(user: UserAccount | null): UserValues {
  return {
    firstname: user?.firstname || '',
    lastname: user?.lastname || '',
    email: user?.email || '',
    role: (user?.role === 'user' ? 'patient' : (user?.role as UserValues['role'])) || 'patient',
    phone: user?.phone || '',
    passwordMode: 'auto',
    password: '',
  }
}

export function UserDialog({
  user,
  currentUserId,
  open,
  onOpenChange,
}: {
  user: UserAccount | null
  currentUserId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const create = useCreateUser()
  const update = useUpdateUser()
  const { settings } = useSettings()
  const [temporaryPassword, setTemporaryPassword] = useState('')
  const saving = create.isPending || update.isPending
  const isSelf = Boolean(user?._id && user._id === currentUserId)

  const form = useForm<UserValues>({
    resolver: zodResolver(userSchema),
    defaultValues: toForm(user),
  })
  const passwordMode = useWatch({ control: form.control, name: 'passwordMode' })

  const onSubmit = form.handleSubmit(async (values) => {
    if (values.passwordMode === 'manual' && values.password.length < settings.passwordMinLength) {
      form.setError('password', {
        message: `Manual passwords must be at least ${settings.passwordMinLength} characters.`,
      })
      return
    }
    if (user && user.role !== values.role) {
      const ok = window.confirm(
        `Change ${user.firstname} ${user.lastname} from ${roleLabel(user.role)} to ${roleLabel(values.role)}?`,
      )
      if (!ok) return
    }

    const base = {
      firstname: values.firstname.trim(),
      lastname: values.lastname.trim(),
      email: values.email.trim(),
      role: values.role,
      phone: values.phone.trim(),
    }
    const request = user
      ? update.mutateAsync({ id: user._id, ...base })
      : create.mutateAsync({
          ...base,
          ...(values.passwordMode === 'manual' ? { password: values.password } : {}),
        })

    showPromise(request, {
      loading: 'Saving user...',
      success: user ? 'User updated.' : `Invite sent to ${base.email}.`,
      error: 'Unable to save this user.',
    })

    try {
      const result = await request
      const created = !user && 'temporaryPassword' in result ? result : null
      if (created?.temporaryPassword) setTemporaryPassword(created.temporaryPassword)
      else onOpenChange(false)
    } catch (error) {
      const details = getApiErrorDetails(error)
      form.setError('root', {
        message: Object.keys(details.fieldErrors).length
          ? 'Please correct the highlighted fields.'
          : details.message,
      })
    }
  })

  return (
    <Dialog open={open} onOpenChange={(next) => (saving ? undefined : onOpenChange(next))}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{user ? 'Edit user' : 'Add user'}</DialogTitle>
          <DialogDescription>
            {user
              ? 'Update the clinic account without losing its history.'
              : 'Create the account and hand over a temporary password.'}
          </DialogDescription>
        </DialogHeader>

        {temporaryPassword ? (
          <div
            className="grid gap-2 rounded-md border border-signal/30 bg-signal-soft p-3"
            role="status"
          >
            <strong className="text-[13px] text-ink">Temporary password</strong>
            <code className="font-mono text-[13px] text-ink">{temporaryPassword}</code>
            <Button
              type="button"
              size="xs"
              variant="outline"
              className="w-fit"
              onClick={() => void navigator.clipboard?.writeText(temporaryPassword)}
            >
              <Copy size={13} aria-hidden="true" /> Copy password
            </Button>
            <small className="text-[11.5px] text-signal">
              Copy it now. It will not be shown again and must be changed on first login.
            </small>
          </div>
        ) : null}

        <Form {...form}>
          <form className="grid gap-3" onSubmit={onSubmit} noValidate>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField<UserValues> control={form.control} name="firstname" label="First name" />
              <TextField<UserValues> control={form.control} name="lastname" label="Last name" />
            </div>

            <TextField<UserValues> control={form.control} name="email" label="Email" type="email" />

            {!user ? (
              <>
                <SelectField<UserValues>
                  control={form.control}
                  name="passwordMode"
                  label="Credentials"
                  options={[
                    { value: 'auto', label: 'Auto-generate temporary password' },
                    { value: 'manual', label: 'Set a password manually' },
                  ]}
                />
                {passwordMode === 'manual' ? (
                  <TextField<UserValues>
                    control={form.control}
                    name="password"
                    label="Temporary password"
                    type="password"
                    autoComplete="new-password"
                    description={`At least ${settings.passwordMinLength} characters.`}
                  />
                ) : null}
              </>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField<UserValues>
                control={form.control}
                name="role"
                label="Role"
                options={roleOptions}
                description={isSelf ? 'You cannot change your own role.' : undefined}
              />
              <TextField<UserValues>
                control={form.control}
                name="phone"
                label="Phone"
                type="tel"
                inputMode="numeric"
              />
            </div>

            {form.formState.errors.root ? (
              <p role="alert" className="text-[12.5px] text-destructive">
                {form.formState.errors.root.message}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                {temporaryPassword ? 'Done' : 'Cancel'}
              </Button>
              <Button type="submit" disabled={saving || Boolean(temporaryPassword)}>
                {saving ? (
                  <LoaderCircle className="animate-spin" size={15} aria-hidden="true" />
                ) : null}
                {saving ? 'Saving…' : 'Save user'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function lastRoleChange(user: UserAccount) {
  const changes = (user.accountAudit || []).filter((entry) =>
    String(entry.action || '').startsWith('role-changed:'),
  )
  return changes.length ? changes[changes.length - 1] : null
}

function changeByName(change: ReturnType<typeof lastRoleChange>) {
  const by = change?.by
  if (by && typeof by === 'object') {
    return [by.firstname, by.lastname].filter(Boolean).join(' ') || by.email || 'Unknown'
  }
  return 'Unknown'
}

export function UserDetailDialog({
  user,
  open,
  onOpenChange,
}: {
  user: UserAccount | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!user) return null
  const roleChange = lastRoleChange(user)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {user.firstname} {user.lastname}
          </DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>
        <dl className="grid gap-3">
          <div>
            <dt className="text-[11.5px] text-ink-faint">Role</dt>
            <dd className="mt-1 text-[13px] text-ink">{roleLabel(user.role)}</dd>
          </div>
          <div>
            <dt className="text-[11.5px] text-ink-faint">Account status</dt>
            <dd className="mt-1">
              <StatusBadge status={accountStatus(user)} />
            </dd>
          </div>
          {roleChange ? (
            <div>
              <dt className="text-[11.5px] text-ink-faint">Last role change</dt>
              <dd className="mt-1 text-[13px] text-ink">
                {roleChange.action} — by {changeByName(roleChange)}
                {roleChange.at ? ` on ${formatDate(roleChange.at)}` : ''}
              </dd>
            </div>
          ) : null}
        </dl>
      </DialogContent>
    </Dialog>
  )
}
