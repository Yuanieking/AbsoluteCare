import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DEFAULT_HOURS, WEEKDAYS, type DayHours, type Weekday } from '@/lib/availability'
import { cn } from '@/lib/utils'

const order = WEEKDAYS as readonly string[]

function sorted(days: DayHours[]) {
  return [...days].sort((a, b) => order.indexOf(a.day) - order.indexOf(b.day))
}

/**
 * Seven rows plus a bulk control. Both the therapist page and the admin person
 * dialog host this, so day selection, editing and validation stay one thing.
 */
export function WeeklyAvailabilityEditor({
  value,
  onChange,
  errors = {},
  disabled = false,
  idPrefix = 'availability',
}: {
  value: DayHours[]
  onChange: (next: DayHours[]) => void
  errors?: Record<string, string>
  disabled?: boolean
  idPrefix?: string
}) {
  const [bulk, setBulk] = useState(DEFAULT_HOURS)

  const selected = new Map(value.map((entry) => [entry.day, entry]))

  function toggle(day: Weekday) {
    if (selected.has(day)) {
      onChange(value.filter((entry) => entry.day !== day))
      return
    }
    onChange(sorted([...value, { day, start: bulk.start, end: bulk.end }]))
  }

  function setHours(day: Weekday, patch: Partial<DayHours>) {
    onChange(value.map((entry) => (entry.day === day ? { ...entry, ...patch, day } : entry)))
  }

  function applyBulk() {
    onChange(value.map((entry) => ({ ...entry, start: bulk.start, end: bulk.end })))
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2 rounded-md bg-sunk px-3 py-2.5">
        <label className="grid gap-1 text-[12px] text-ink-soft">
          Starts
          <Input
            type="time"
            value={bulk.start}
            disabled={disabled || !value.length}
            onChange={(event) => setBulk((current) => ({ ...current, start: event.target.value }))}
            className="h-10 w-[7.75rem] tabular-nums"
          />
        </label>
        <label className="grid gap-1 text-[12px] text-ink-soft">
          Ends
          <Input
            type="time"
            value={bulk.end}
            disabled={disabled || !value.length}
            onChange={(event) => setBulk((current) => ({ ...current, end: event.target.value }))}
            className="h-10 w-[7.75rem] tabular-nums"
          />
        </label>
        <Button
          type="button"
          variant="outline"
          onClick={applyBulk}
          disabled={disabled || !value.length}
          className="h-10"
        >
          Apply to selected days
        </Button>
        <p className="min-w-[12rem] flex-1 text-[11.5px] text-ink-faint">
          {value.length
            ? `Applies to the ${value.length} selected ${value.length === 1 ? 'day' : 'days'}. Tweaking one day afterwards is fine.`
            : 'Pick a day below to set its hours.'}
        </p>
      </div>

      <div role="group" aria-label="Weekly working hours" className="grid gap-1.5">
        {WEEKDAYS.map((day) => {
          const entry = selected.get(day)
          const active = Boolean(entry)
          const error = errors[day]
          const errorId = `${idPrefix}-${day}-error`
          return (
            <div
              key={day}
              className={cn(
                'flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-md border px-2 py-1.5',
                active ? 'border-hairline bg-panel' : 'border-hairline-in bg-panel/60',
              )}
            >
              <button
                type="button"
                aria-pressed={active}
                aria-label={`Work on ${day}`}
                disabled={disabled}
                onClick={() => toggle(day)}
                className={cn(
                  'inline-flex h-10 min-w-[4.75rem] items-center justify-center rounded-sm border text-[12.5px] font-medium',
                  'transition-[background-color,color,border-color,transform] duration-150 ease-snap',
                  'active:scale-[0.97] motion-reduce:active:scale-100',
                  'focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-1 focus-visible:ring-offset-panel focus-visible:outline-none',
                  'disabled:pointer-events-none disabled:opacity-45',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-hairline bg-panel text-ink-soft hover:text-ink',
                )}
              >
                {active ? '✓ ' : ''}
                {day}
              </button>

              <Input
                id={`${idPrefix}-${day}-start`}
                type="time"
                value={entry?.start ?? ''}
                disabled={disabled || !active}
                aria-label={`Start time for ${day}`}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                onChange={(event) => setHours(day, { start: event.target.value })}
                className="h-10 w-[7.75rem] tabular-nums"
              />
              <span aria-hidden="true" className="text-ink-faint">
                –
              </span>
              <Input
                id={`${idPrefix}-${day}-end`}
                type="time"
                value={entry?.end ?? ''}
                disabled={disabled || !active}
                aria-label={`End time for ${day}`}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.preventDefault()
                }}
                onChange={(event) => setHours(day, { end: event.target.value })}
                className="h-10 w-[7.75rem] tabular-nums"
              />

              <span
                id={errorId}
                className={cn(
                  'min-h-4 min-w-0 flex-1 text-[11.5px] leading-4',
                  error ? 'text-destructive' : 'text-ink-faint',
                )}
              >
                {error || (active ? '' : 'Day off')}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
