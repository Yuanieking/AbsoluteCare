import { roleLabel } from './format'

export function RoleBadge({ role }: { role?: string | null }) {
  return (
    <span className="inline-flex w-fit items-center rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">
      {roleLabel(role)}
    </span>
  )
}
