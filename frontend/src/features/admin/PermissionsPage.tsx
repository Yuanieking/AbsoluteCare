import { Lock } from 'lucide-react'
import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { PageBody, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { getToastError, showError, showSuccess } from '@/lib/toast'
import { useSettings } from '@/features/settings/provider'
import { useSettingsBundle } from './settings/queries'
import { updateSettingsSection } from './settings/api'
import type { AuthValues, CrudPermission, PermissionKey } from './settings/types'

const permissions: { key: PermissionKey; label: string; description: string }[] = [
  { key: 'dashboard', label: 'Dashboard', description: 'Open the staff dashboard.' },
  {
    key: 'appointments',
    label: 'Appointments',
    description: 'View and manage appointment schedules.',
  },
  { key: 'services', label: 'Services', description: 'Manage therapy service offerings.' },
  {
    key: 'sessions',
    label: 'Session history',
    description: 'View and manage therapy session records.',
  },
  {
    key: 'patients',
    label: 'Patients and therapists',
    description: 'View assigned patient and therapist records.',
  },
  { key: 'payments', label: 'Payments', description: 'View and record appointment payments.' },
  { key: 'reports', label: 'Reports', description: 'View clinic reports and exports.' },
  {
    key: 'documents',
    label: 'Documents',
    description: 'Generate, view, and download clinic documents.',
  },
  {
    key: 'userManagement',
    label: 'User management',
    description: 'Create and manage clinic accounts.',
  },
  { key: 'settings', label: 'Settings', description: 'Open clinic configuration settings.' },
  { key: 'myActivity', label: 'My activity', description: 'View only your own actions. Read-only; no CSV export.' },
]
const actions: (keyof CrudPermission)[] = ['create', 'read', 'update', 'delete']

function PermissionCheckbox({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string
  checked: boolean
  onChange?: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className="inline-flex items-center gap-2 text-[12px]">
      <Checkbox
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onCheckedChange={(next) => onChange?.(next === true)}
      />
    </label>
  )
}

export default function PermissionsPage() {
  const bundle = useSettingsBundle()
  const { refreshSettings } = useSettings()
  const saved = bundle.data?.settings.settings.auth
  const [draft, setDraft] = useState<AuthValues['permissions'] | null>(null)
  const [editingRole, setEditingRole] = useState<'secretary' | 'therapist' | 'user' | null>(null)
  const [saving, setSaving] = useState(false)
  const current = draft ?? saved?.permissions

  function updatePermission(
    role: 'secretary' | 'therapist' | 'user',
    key: PermissionKey,
    action: keyof CrudPermission,
    checked: boolean,
  ) {
    if (!current || (role === 'user' && key !== 'myActivity')) return
    const previous = key === 'myActivity' ? current[role]?.myActivity : current[role as 'secretary' | 'therapist'][key]
    setDraft({
      ...current,
      [role]: { ...current[role], [key]: { ...previous, [action]: checked } },
    })
  }

  async function save() {
    if (!saved || !current || !editingRole) return
    setSaving(true)
    try {
      await updateSettingsSection('auth', { ...saved, permissions: current })
      await bundle.refetch()
      await refreshSettings()
      showSuccess('Permissions updated')
      setEditingRole(null)
      setDraft(null)
    } catch (error) {
      showError(getToastError(error, 'Permissions could not be saved.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageBody>
      <PageHeader
        eyebrow="Administration"
        title="Permissions"
        description={
          editingRole
            ? `Edit ${editingRole === 'user' ? 'patient' : editingRole} permissions.`
            : 'Choose a role to view or edit its permissions.'
        }
        actions={
          editingRole ? (
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setEditingRole(null)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void save()} disabled={saving || !current}>
                {saving ? 'Saving…' : 'Save permissions'}
              </Button>
            </div>
          ) : null
        }
      />

      {!editingRole ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {(['admin', 'secretary', 'therapist', 'user'] as const).map((role) => (
            <section key={role} className="rounded-lg border border-hairline bg-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[15px] font-semibold capitalize text-ink">{role === 'user' ? 'patient' : role}</h2>
                  <p className="mt-1 text-[12px] text-ink-soft">
                    {role === 'admin'
                      ? 'Full access to every resource.'
                      : role === 'user' ? 'Control personal activity access.' : 'Configure Create, Read, Update, and Delete access.'}
                  </p>
                </div>
                {role === 'admin' ? (
                  <span className="flex items-center gap-1 text-[12px] text-ink-soft">
                    <Lock size={13} aria-hidden="true" /> Always on
                  </span>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setDraft(saved?.permissions ?? null)
                      setEditingRole(role)
                    }}
                  >
                    Edit
                  </Button>
                )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-lg border border-hairline bg-card">
          <table className="w-full min-w-[620px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-hairline-in text-[11px] uppercase tracking-[0.08em] text-ink-faint">
                <th className="p-4">Resource</th>
                {actions.map((action) => (
                  <th key={action} className="px-4 text-center normal-case tracking-normal">
                    {action}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline-in">
              {permissions.filter((permission) => editingRole !== 'user' || permission.key === 'myActivity').map((permission) => (
                <tr key={permission.key}>
                  <th className="p-4 font-medium text-ink">
                    <span className="block">{permission.label}</span>
                    <span className="mt-0.5 block font-normal text-ink-soft">
                      {permission.description}
                    </span>
                  </th>
                  {actions.map((action) => (
                    <td key={action} className="px-4 text-center">
                      <PermissionCheckbox
                        label={`${editingRole} ${permission.label} ${action}`}
                        checked={permission.key === 'myActivity'
                          ? action === 'read' && (current?.[editingRole]?.myActivity?.read ?? true)
                          : current?.[editingRole as 'secretary' | 'therapist'][permission.key][action] ?? false}
                        disabled={permission.key === 'myActivity' && action !== 'read'}
                        onChange={(next) =>
                          updatePermission(editingRole, permission.key, action, next)
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 flex items-center gap-2 text-[12px] text-ink-soft">
        <Lock size={13} aria-hidden="true" /> Admin permissions are always enabled.
      </p>
    </PageBody>
  )
}
