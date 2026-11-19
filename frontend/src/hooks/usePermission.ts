import { useAuth } from '@/features/auth/session'
import { useSettings, type RoleAccess } from '@/features/settings/provider'

export type PermissionAction = 'create' | 'read' | 'update' | 'delete'

type AreaPermission = RoleAccess['secretary'][string] | undefined

/**
 * Mirrors the backend's requirePermission: admins can do everything, secretaries
 * and therapists need both read and the requested action switched on for the area.
 */
export function canPerform(
  role: string | null | undefined,
  area: string,
  action: PermissionAction,
  roleAccess: RoleAccess | undefined,
) {
  if (role === 'admin') return true
  if (role !== 'secretary' && role !== 'therapist') return false
  const permission: AreaPermission = roleAccess?.[role]?.[area]
  if (typeof permission === 'boolean') return permission && action === 'read'
  return permission?.read === true && permission?.[action] === true
}

/** Whether the signed-in staff member may perform `action` in `area`. */
export function usePermission(area: string, action: PermissionAction) {
  const { user } = useAuth()
  const { settings } = useSettings()
  return canPerform(user?.role, area, action, settings.roleAccess)
}
