const domain = (name) => ({
  all: [name],
  list: (filters = {}) => [name, 'list', filters],
  detail: (id) => [name, 'detail', String(id)],
})

export const keys = {
  me: ['auth', 'me'],
  publicSettings: ['settings', 'public'],
  appointments: domain('appointments'),
  availability: domain('availability'),
  calendar: domain('calendar'),
  dependents: domain('dependents'),
  documents: domain('documents'),
  notifications: domain('notifications'),
  patients: domain('patients'),
  payments: domain('payments'),
  reports: domain('reports'),
  services: domain('services'),
  sessions: domain('sessions'),
  specializations: domain('specializations'),
  settings: domain('settings'),
  therapists: domain('therapists'),
  users: domain('users'),
  verify: domain('verify'),
}
