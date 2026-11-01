import { AlertTriangle, Check, Info, LoaderCircle, Save, X } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { SettingsSectionConfig } from './config'

export function SettingsSection({
  section,
  actions,
  children,
}: {
  section: SettingsSectionConfig
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11.5px] font-medium text-ink-faint">Configuration</p>
          <h2 className="mt-0.5 text-[22px] leading-tight font-semibold tracking-[-0.015em] text-ink">
            {section.title}
          </h2>
          <p className="mt-1 max-w-[58ch] text-[12.5px] text-ink-soft">{section.description}</p>
        </div>
        {actions}
      </header>
      {children}
    </div>
  )
}

export function SettingsCard({
  title,
  description,
  action,
  footer,
  children,
  className,
}: {
  title?: string
  description?: string
  action?: ReactNode
  footer?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-lg border border-hairline bg-card', className)}>
      {title || action ? (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline-in px-5 py-4">
          <div>
            {title ? <h3 className="text-[15px] font-semibold text-ink">{title}</h3> : null}
            {description ? <p className="mt-0.5 text-[12px] text-ink-soft">{description}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      <div className="divide-y divide-hairline-in">{children}</div>
      {footer ? (
        <footer className="border-t border-hairline-in px-5 py-3 text-[12px] text-ink-soft">
          {footer}
        </footer>
      ) : null}
    </section>
  )
}

export function SettingRow({
  label,
  helper,
  children,
  disabled = false,
  controlClassName,
}: {
  label: string
  helper?: ReactNode
  children: ReactNode
  disabled?: boolean
  controlClassName?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 px-5 py-3',
        disabled && 'opacity-60',
      )}
    >
      <div className="min-w-0 max-w-[46ch]">
        <strong className="block text-[13px] font-medium text-ink">{label}</strong>
        {helper ? <p className="mt-0.5 text-[11.5px] text-ink-soft">{helper}</p> : null}
      </div>
      <div className={cn('flex flex-wrap items-center gap-2', controlClassName)}>{children}</div>
    </div>
  )
}

export function TextInput({
  value,
  onChange,
  ariaLabel,
  ...props
}: Omit<ComponentProps<typeof Input>, 'value' | 'onChange'> & {
  value?: string | number
  onChange: (value: string) => void
  ariaLabel: string
}) {
  return (
    <Input
      {...props}
      aria-label={ariaLabel}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      className={cn('h-9 w-56 text-[13px]', props.className)}
    />
  )
}

export function NumberInput({
  value,
  onChange,
  ariaLabel,
  min,
  max,
  unit,
}: {
  value?: number
  onChange: (value: number) => void
  ariaLabel: string
  min?: number
  max?: number
  unit: string
}) {
  return (
    <label className="flex items-center gap-1.5">
      <Input
        type="number"
        aria-label={ariaLabel}
        min={min}
        max={max}
        value={value ?? ''}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-9 w-24 text-[13px] tabular-nums"
      />
      <span className="text-[12px] text-ink-soft">{unit}</span>
    </label>
  )
}

export function SelectInput({
  value,
  onChange,
  ariaLabel,
  options,
}: {
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  options: { value: string; label: string }[]
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 rounded-md border border-hairline bg-panel px-2.5 text-[13px] text-ink focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

export function SwitchRow({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <Switch aria-label={label} checked={checked} disabled={disabled} onCheckedChange={onChange} />
      <span className="w-7 text-[11.5px] text-ink-soft">{checked ? 'On' : 'Off'}</span>
    </div>
  )
}

export function ChipGroup({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: string[]
  value: string[]
  onChange: (value: string[]) => void
  ariaLabel: string
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = value.includes(option)
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() =>
              onChange(active ? value.filter((item) => item !== option) : [...value, option])
            }
            className={cn(
              'inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-[12px] transition-colors',
              active
                ? 'border-primary bg-primary-soft font-medium text-primary'
                : 'border-hairline text-ink-soft hover:text-ink',
            )}
          >
            {active ? <Check size={12} aria-hidden="true" /> : null}
            {option}
          </button>
        )
      })}
    </div>
  )
}

export function InlineNote({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warning' | 'danger'
  children: ReactNode
}) {
  const tones = {
    info: 'border-hairline bg-sunk text-ink-soft',
    warning: 'border-signal/25 bg-signal-soft text-signal',
    danger: 'border-destructive/25 bg-destructive-soft text-destructive',
  }
  return (
    <div
      role={tone === 'danger' ? 'alert' : undefined}
      className={cn(
        'mx-5 my-3 flex items-start gap-2 rounded-md border px-3 py-2 text-[12px]',
        tones[tone],
      )}
    >
      {tone === 'info' ? (
        <Info size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
      ) : (
        <AlertTriangle size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
      )}
      <span>{children}</span>
    </div>
  )
}

export function SaveBar({
  dirty,
  saving,
  onSave,
  onDiscard,
}: {
  dirty: boolean
  saving: boolean
  onSave: () => void
  onDiscard: () => void
}) {
  if (!dirty) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky bottom-4 z-10 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hairline bg-panel px-4 py-3 shadow-[0_2px_4px_rgba(26,29,28,0.04),0_12px_24px_-16px_rgba(26,29,28,0.28)]"
    >
      <span className="text-[12.5px] text-ink">You have unsaved changes</span>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={saving} onClick={onDiscard}>
          <X size={15} aria-hidden="true" /> Discard
        </Button>
        <Button type="button" size="sm" disabled={saving} onClick={onSave}>
          {saving ? (
            <LoaderCircle className="animate-spin" size={15} aria-hidden="true" />
          ) : (
            <Save size={15} aria-hidden="true" />
          )}
          {saving ? 'Saving...' : 'Save changes'}
        </Button>
      </div>
    </div>
  )
}
