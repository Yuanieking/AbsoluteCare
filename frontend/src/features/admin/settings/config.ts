import {
  Bell,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  FileClock,
  Globe2,
  KeyRound,
  Settings2,
  Store,
  type LucideIcon,
} from 'lucide-react'
import type { SettingsSectionKey } from './types'

export type SettingsSectionConfig = {
  key: SettingsSectionKey | 'audit'
  label: string
  title: string
  group: 'Clinic' | 'Access' | 'Operations'
  icon: LucideIcon
  description: string
}

export const sections: SettingsSectionConfig[] = [
  {
    key: 'general',
    label: 'General',
    title: 'General',
    group: 'Clinic',
    icon: Store,
    description: 'Keep the clinic identity and regional details patients see.',
  },
  {
    key: 'schedule',
    label: 'Schedule',
    title: 'Schedule and closures',
    group: 'Clinic',
    icon: CalendarDays,
    description: 'Set opening hours and days the clinic is closed.',
  },
  {
    key: 'booking',
    label: 'Booking',
    title: 'Booking',
    group: 'Clinic',
    icon: ClipboardList,
    description: 'Control when and how patients can request appointments.',
  },
  {
    key: 'auth',
    label: 'Authentication',
    title: 'Authentication',
    group: 'Access',
    icon: KeyRound,
    description: 'Manage patient access, passwords, and account rules.',
  },
  {
    key: 'integrations',
    label: 'Integrations',
    title: 'Integrations',
    group: 'Access',
    icon: Globe2,
    description: 'Connect the services that support the clinic app.',
  },
  {
    key: 'notifications',
    label: 'Notifications',
    title: 'Notifications',
    group: 'Operations',
    icon: Bell,
    description: 'Choose which messages the clinic sends and when.',
  },
  {
    key: 'payments',
    label: 'Payments',
    title: 'Payments',
    group: 'Operations',
    icon: CircleDollarSign,
    description: 'Choose payment methods and reference requirements.',
  },
  {
    key: 'system',
    label: 'Maintenance',
    title: 'Maintenance',
    group: 'Operations',
    icon: Settings2,
    description: 'Control maintenance mode and patient announcements.',
  },
  {
    key: 'audit',
    label: 'Audit log',
    title: 'Audit log',
    group: 'Operations',
    icon: FileClock,
    description: 'Review who changed clinic-wide settings and when.',
  },
]

export const sectionMap = Object.fromEntries(
  sections.map((section) => [section.key, section]),
) as Record<string, SettingsSectionConfig>

export function isSectionKey(value: string | null): value is SettingsSectionKey {
  return Boolean(value && value in sectionMap && value !== 'audit')
}
