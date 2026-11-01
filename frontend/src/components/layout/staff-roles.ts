export type StaffRoleKey = 'admin' | 'therapist' | 'secretary'

const staffRoles: Record<StaffRoleKey, { label: string }> = {
  admin: { label: 'Admin' },
  therapist: { label: 'Therapist' },
  secretary: { label: 'Secretary' },
}

export const getStaffRole = (role: string | null | undefined) =>
  staffRoles[role as StaffRoleKey] ?? staffRoles.secretary

const profileRoutes: Record<StaffRoleKey, string> = {
  admin: '/staff/admin/profile',
  therapist: '/staff/therapist/profile',
  secretary: '/staff/secretary/profile',
}

export const getStaffRoute = (role: StaffRoleKey, key: 'profile') =>
  key === 'profile' ? profileRoutes[role] : `/staff/${role}`
