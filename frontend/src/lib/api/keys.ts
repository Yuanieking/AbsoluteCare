export type QueryFilters = Record<string, unknown>

const domain = (name: string) => ({
  all: [name] as const,
  list: (filters: QueryFilters = {}) => [name, 'list', filters] as const,
  detail: (id: string | number) => [name, 'detail', String(id)] as const,
})

export const keys = {
  me: ['auth', 'me'] as const,
  publicSettings: ['settings', 'public'] as const,
  appointments: domain('appointments'),
  availability: domain('availability'),
  calendar: domain('calendar'),
  dependents: domain('dependents'),
  notifications: domain('notifications'),
  patients: domain('patients'),
  payments: domain('payments'),
  reports: domain('reports'),
  services: domain('services'),
  sessions: domain('sessions'),
  settings: domain('settings'),
  therapists: domain('therapists'),
  users: domain('users'),
}
