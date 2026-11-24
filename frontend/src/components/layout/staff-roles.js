const staffRoles = {
  admin: { label: 'Admin' },
  therapist: { label: 'Therapist' },
  secretary: { label: 'Secretary' },
}

export const getStaffRole = (role) => staffRoles[role] ?? staffRoles.secretary

const profileRoutes = {
  admin: '/staff/admin/profile',
  therapist: '/staff/therapist/profile',
  secretary: '/staff/secretary/profile',
}

export const getStaffRoute = (role, key) =>
  key === 'profile' ? profileRoutes[role] : `/staff/${role}`
