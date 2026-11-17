import {
  Activity,
  BarChart3,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CircleDollarSign,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Settings2,
  Stethoscope,
  UserRound,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'

export type NavRole = 'patient' | 'therapist' | 'secretary' | 'admin'

export type NavTab = {
  key: string
  label: string
  to: string
}

export type NavSection = {
  key: string
  label: string
  to: string
  icon: LucideIcon
  /** Rail heading. Sections sharing a group render together, in order. */
  group?: string
  end?: boolean
  aliases?: string[]
  tabs?: NavTab[]
}

export type RoleNav = {
  label: string
  subtitle: string
  helpHref: string
  sections: NavSection[]
}

const patientNav: RoleNav = {
  label: 'Patient',
  subtitle: 'Patient portal',
  helpHref: 'tel:09177152780',
  sections: [
    {
      key: 'dashboard',
      label: 'Dashboard',
      to: '/dashboard',
      icon: LayoutDashboard,
      group: 'Your care',
      end: true,
    },
    {
      key: 'appointments',
      label: 'My appointments',
      to: '/dashboard/appointments',
      icon: CalendarDays,
      group: 'Your care',
    },
    {
      key: 'book',
      label: 'Book appointment',
      to: '/dashboard/book',
      icon: CalendarPlus,
      group: 'Your care',
    },
    {
      key: 'progress',
      label: 'Therapy progress',
      to: '/dashboard/progress',
      icon: Activity,
      group: 'Your care',
    },
    {
      key: 'dependents',
      label: 'My dependents',
      to: '/dashboard/dependents',
      icon: UsersRound,
      group: 'Family',
      aliases: ['/dependents'],
    },
  ],
}

const adminNav: RoleNav = {
  label: 'Admin',
  subtitle: 'Staff portal',
  helpHref: 'mailto:clinic@absolutecare.com',
  sections: [
    {
      key: 'dashboard',
      label: 'Clinic overview',
      to: '/staff/admin',
      icon: LayoutDashboard,
      group: 'Care',
      end: true,
    },
    {
      key: 'appointments',
      label: 'Appointments',
      to: '/staff/admin/appointments',
      icon: CalendarDays,
      group: 'Care',
      aliases: ['/staff/appointments'],
    },
    {
      key: 'services',
      label: 'Therapy services',
      to: '/staff/admin/services',
      icon: ClipboardList,
      group: 'Care',
    },
    {
      key: 'sessions',
      label: 'Session history',
      to: '/staff/admin/sessions',
      icon: ClipboardList,
      group: 'Care',
    },
    {
      key: 'users',
      label: 'User accounts',
      to: '/staff/admin/users',
      icon: UsersRound,
      group: 'People',
      aliases: ['/staff/users'],
    },
    {
      key: 'therapists',
      label: 'Therapists',
      to: '/staff/admin/therapists',
      icon: Stethoscope,
      group: 'People',
    },
    {
      key: 'patients',
      label: 'Patients',
      to: '/staff/admin/patients',
      icon: UserRound,
      group: 'People',
    },
    {
      key: 'payments',
      label: 'Payments',
      to: '/staff/admin/payments',
      icon: CircleDollarSign,
      group: 'Business',
      aliases: ['/staff/payments'],
    },
    {
      key: 'reports',
      label: 'Reports',
      to: '/staff/admin/reports',
      icon: BarChart3,
      group: 'Business',
    },
    {
      key: 'documents',
      label: 'Documents',
      to: '/staff/documents',
      icon: FileText,
      group: 'Business',
    },
    {
      key: 'settings',
      label: 'Settings',
      to: '/staff/admin/settings',
      icon: Settings2,
      group: 'System',
      tabs: [
        { key: 'general', label: 'General', to: '/staff/admin/settings' },
        { key: 'schedule', label: 'Schedule', to: '/staff/admin/settings?section=schedule' },
        { key: 'booking', label: 'Booking', to: '/staff/admin/settings?section=booking' },
        { key: 'auth', label: 'Authentication', to: '/staff/admin/settings?section=auth' },
        {
          key: 'integrations',
          label: 'Integrations',
          to: '/staff/admin/settings?section=integrations',
        },
        {
          key: 'notifications',
          label: 'Notifications',
          to: '/staff/admin/settings?section=notifications',
        },
        { key: 'payments', label: 'Payments', to: '/staff/admin/settings?section=payments' },
        { key: 'system', label: 'Maintenance', to: '/staff/admin/settings?section=system' },
        { key: 'audit', label: 'Audit log', to: '/staff/admin/settings?section=audit' },
      ],
    },
    {
      key: 'audit',
      label: 'Audit log',
      to: '/staff/admin/audit',
      icon: FileText,
      group: 'System',
    },
    {
      key: 'permissions',
      label: 'Permissions',
      to: '/staff/admin/permissions',
      icon: Settings2,
      group: 'System',
    },
  ],
}

const therapistNav: RoleNav = {
  label: 'Therapist',
  subtitle: 'Staff portal',
  helpHref: 'mailto:clinic@absolutecare.com',
  sections: [
    {
      key: 'dashboard',
      label: 'My day',
      to: '/staff/therapist',
      icon: LayoutDashboard,
      group: 'Today',
      end: true,
    },
    {
      key: 'appointments',
      label: 'My appointments',
      to: '/staff/therapist/my-appointments',
      icon: CalendarDays,
      group: 'Today',
      aliases: ['/staff/appointments'],
    },
    {
      key: 'availability',
      label: 'Availability',
      to: '/staff/therapist/availability',
      icon: CalendarClock,
      group: 'Today',
      aliases: ['/staff/availability'],
    },
    {
      key: 'patients',
      label: 'My patients',
      to: '/staff/therapist/my-patients',
      icon: UserRound,
      group: 'Records',
      aliases: ['/staff/patients'],
    },
    {
      key: 'services',
      label: 'Therapy services',
      to: '/staff/therapist/services',
      icon: ClipboardList,
      group: 'Records',
    },
    {
      key: 'records',
      label: 'Session records',
      to: '/staff/therapist/session-records',
      icon: ClipboardList,
      group: 'Records',
      aliases: ['/staff/sessions'],
    },
    {
      key: 'documents',
      label: 'Documents',
      to: '/staff/documents',
      icon: FileText,
      group: 'Records',
    },
    {
      key: 'payments',
      label: 'Payments',
      to: '/staff/therapist/payments',
      icon: CircleDollarSign,
      group: 'Business',
    },
    {
      key: 'reports',
      label: 'Reports',
      to: '/staff/therapist/reports',
      icon: BarChart3,
      group: 'Business',
    },
    {
      key: 'users',
      label: 'User management',
      to: '/staff/therapist/users',
      icon: UsersRound,
      group: 'People',
    },
    {
      key: 'settings',
      label: 'Settings',
      to: '/staff/therapist/settings',
      icon: Settings2,
      group: 'System',
    },
  ],
}

const secretaryNav: RoleNav = {
  label: 'Secretary',
  subtitle: 'Staff portal',
  helpHref: 'mailto:clinic@absolutecare.com',
  sections: [
    {
      key: 'dashboard',
      label: 'Front desk',
      to: '/staff/secretary',
      icon: LayoutDashboard,
      group: 'Front desk',
      end: true,
    },
    {
      key: 'appointments',
      label: 'Appointment schedule',
      to: '/staff/secretary/schedule',
      icon: CalendarDays,
      group: 'Front desk',
      aliases: ['/staff/schedule'],
    },
    {
      key: 'payments',
      label: 'Payments',
      to: '/staff/secretary/payments',
      icon: CircleDollarSign,
      group: 'Front desk',
      aliases: ['/staff/payments'],
    },
    {
      key: 'services',
      label: 'Therapy services',
      to: '/staff/secretary/services',
      icon: ClipboardList,
      group: 'Clinic',
    },
    {
      key: 'sessions',
      label: 'Session history',
      to: '/staff/secretary/sessions',
      icon: ClipboardList,
      group: 'Clinic',
    },
    {
      key: 'patients',
      label: 'Patients and therapists',
      to: '/staff/secretary/patients',
      icon: UserRound,
      group: 'People',
    },
    {
      key: 'reports',
      label: 'Reports',
      to: '/staff/secretary/reports',
      icon: BarChart3,
      group: 'Business',
    },
    {
      key: 'users',
      label: 'User management',
      to: '/staff/secretary/users',
      icon: UsersRound,
      group: 'People',
    },
    {
      key: 'documents',
      label: 'Documents',
      to: '/staff/documents',
      icon: FileText,
      group: 'Front desk',
    },
    {
      key: 'profile',
      label: 'Profile',
      to: '/staff/secretary/profile',
      icon: Settings2,
      group: 'Account',
      aliases: ['/staff/profile'],
    },
    {
      key: 'settings',
      label: 'Settings',
      to: '/staff/secretary/settings',
      icon: Settings2,
      group: 'Account',
    },
  ],
}

const roleNavs: Record<NavRole, RoleNav> = {
  patient: patientNav,
  admin: adminNav,
  therapist: therapistNav,
  secretary: secretaryNav,
}

export function getRoleNav(role: string | null | undefined): RoleNav {
  return roleNavs[role as NavRole] ?? secretaryNav
}

/** Staff areas an admin can switch on or off per role in Settings. */
type StaffPermission =
  | 'dashboard'
  | 'appointments'
  | 'services'
  | 'sessions'
  | 'patients'
  | 'payments'
  | 'reports'
  | 'documents'
  | 'userManagement'
  | 'settings'

const gatedSections: Record<string, StaffPermission> = {
  dashboard: 'dashboard',
  appointments: 'appointments',
  services: 'services',
  sessions: 'sessions',
  patients: 'patients',
  payments: 'payments',
  reports: 'reports',
  documents: 'documents',
  users: 'userManagement',
  settings: 'settings',
  records: 'sessions',
  schedule: 'appointments',
}

export type NavRoleAccess = {
  secretary: Partial<Record<StaffPermission, { read: boolean } | boolean>> & {
    driveStatus?: boolean
  }
  therapist: Partial<Record<StaffPermission, { read: boolean } | boolean>>
}

export function hasAreaAccess(
  role: string | null | undefined,
  area: StaffPermission,
  access: NavRoleAccess | undefined,
): boolean {
  if (role === 'secretary' || role === 'therapist') {
    const permission = access?.[role]?.[area]
    return typeof permission === 'boolean' ? permission : permission?.read !== false
  }
  return true
}

/** Drops sections the admin has switched off for this role. */
export function filterNavByAccess(
  nav: RoleNav,
  role: string | null | undefined,
  access: NavRoleAccess | undefined,
): RoleNav {
  const sections = nav.sections.filter((section) => {
    const area = gatedSections[section.key]
    return !area || hasAreaAccess(role, area, access)
  })
  return sections.length === nav.sections.length ? nav : { ...nav, sections }
}

/** Sections bucketed by group, preserving declaration order within each. */
export function groupSections(sections: NavSection[]): { group: string; items: NavSection[] }[] {
  const groups: { group: string; items: NavSection[] }[] = []
  for (const section of sections) {
    const name = section.group ?? ''
    const existing = groups.find((entry) => entry.group === name)
    if (existing) existing.items.push(section)
    else groups.push({ group: name, items: [section] })
  }
  return groups
}

const pathOf = (to: string) => to.split('?')[0] ?? to

export function matchSection(nav: RoleNav, pathname: string): NavSection | undefined {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return [...nav.sections]
    .sort((a, b) => pathOf(b.to).length - pathOf(a.to).length)
    .find((section) =>
      [pathOf(section.to), ...(section.aliases ?? [])].some(
        (candidate) => path === candidate || path.startsWith(`${candidate}/`),
      ),
    )
}

export function getActiveTab(section: NavSection | undefined, search: string): NavTab | undefined {
  if (!section?.tabs) return undefined
  const requested = new URLSearchParams(search).get('section')
  return section.tabs.find((tab) => tab.key === requested) ?? section.tabs[0]
}
