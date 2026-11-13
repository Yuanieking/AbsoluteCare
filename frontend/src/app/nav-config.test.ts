import { LayoutGrid } from 'lucide-react'
import { expect, test } from 'vitest'
import {
  filterNavByAccess,
  getActiveTab,
  getRoleNav,
  hasAreaAccess,
  matchSection,
  type NavSection,
} from './nav-config'

const off = { secretary: { documents: false }, therapist: { documents: false } }
const on = { secretary: { documents: true }, therapist: { documents: true } }

test('switched-off areas disappear from staff navigation only', () => {
  const keys = (role: string, access: typeof on) =>
    filterNavByAccess(getRoleNav(role), role, access).sections.map((section) => section.key)
  expect(keys('secretary', off)).not.toContain('documents')
  expect(keys('therapist', off)).not.toContain('documents')
  expect(keys('secretary', on)).toContain('documents')
  expect(keys('admin', off)).toContain('documents')
  expect(hasAreaAccess('admin', 'documents', off)).toBe(true)
  expect(hasAreaAccess('therapist', 'documents', undefined)).toBe(true)
})

test('the longest section path wins over a shared prefix', () => {
  const nav = getRoleNav('admin')
  expect(matchSection(nav, '/staff/admin/users')?.key).toBe('users')
  expect(matchSection(nav, '/staff/admin')?.key).toBe('dashboard')
  expect(matchSection(nav, '/staff/users')?.key).toBe('users')
  expect(matchSection(nav, '/nowhere')).toBeUndefined()
})

test('detail routes stay under their own section', () => {
  const patient = getRoleNav('patient')
  expect(matchSection(patient, '/dashboard/appointments/42')?.key).toBe('appointments')
  expect(matchSection(patient, '/dependents/7')?.key).toBe('dependents')
  expect(matchSection(patient, '/dashboard/')?.key).toBe('dashboard')
})

test('tabs resolve from the query and fall back to the first tab', () => {
  const section: NavSection = {
    key: 'settings',
    label: 'Settings',
    to: '/settings',
    icon: LayoutGrid,
    tabs: [
      { key: 'general', label: 'General', to: '/settings?section=general' },
      { key: 'payments', label: 'Payments', to: '/settings?section=payments' },
    ],
  }
  expect(getActiveTab(section, '')?.key).toBe('general')
  expect(getActiveTab(section, '?section=payments')?.key).toBe('payments')
  expect(getActiveTab(section, '?section=missing')?.key).toBe('general')
  expect(getActiveTab(getRoleNav('patient').sections[0], '')).toBeUndefined()
})
