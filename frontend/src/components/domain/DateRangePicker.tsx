import { CalendarDays, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  formatRangeLabel,
  presetRange,
  type DateRange,
  type DateRangePreset,
} from '@/lib/format/date-range'
import { cn } from '@/lib/utils'

const presets: { key: DateRangePreset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
]

export function DateRangePicker({
  value,
  onChange,
  className,
}: {
  value: DateRange
  onChange: (range: DateRange) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const empty = !value.from && !value.to

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-9 gap-2 text-[12.5px] font-normal',
            !empty && 'border-primary/40',
            className,
          )}
        >
          <CalendarDays size={15} aria-hidden="true" />
          {formatRangeLabel(value)}
          {empty ? null : (
            <X
              size={13}
              role="img"
              aria-label="Clear date range"
              className="text-ink-faint hover:text-ink"
              onClick={(event) => {
                event.stopPropagation()
                onChange({ from: '', to: '' })
              }}
            />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-72 p-3">
        <div className="flex flex-wrap gap-1">
          {presets.map((preset) => (
            <Button
              key={preset.key}
              variant="ghost"
              size="xs"
              onClick={() => {
                onChange(presetRange(preset.key))
                setOpen(false)
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-[11px] text-ink-soft">
            From
            <Input
              type="date"
              value={value.from}
              max={value.to || undefined}
              onChange={(event) => onChange({ from: event.target.value, to: value.to })}
              className="h-8 text-[12.5px]"
            />
          </label>
          <label className="grid gap-1 text-[11px] text-ink-soft">
            To
            <Input
              type="date"
              value={value.to}
              min={value.from || undefined}
              onChange={(event) => onChange({ from: value.from, to: event.target.value })}
              className="h-8 text-[12.5px]"
            />
          </label>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              onChange({ from: '', to: '' })
              setOpen(false)
            }}
          >
            Clear
          </Button>
          <Button size="xs" onClick={() => setOpen(false)}>
            Apply range
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
