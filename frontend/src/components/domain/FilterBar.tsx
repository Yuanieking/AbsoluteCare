import { Search, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type FilterTab = { key: string; label: string; count?: number }
export type FilterOption = { value: string; label: string }
export type FilterChip = { key?: string; label: string; onRemove?: () => void }

export type FilterDefinition = {
  key: string
  label: string
  value: string
  options: FilterOption[]
  onChange: (value: string) => void
}

export function FilterBar({
  tabs = [],
  activeTab,
  onTabChange,
  search,
  onSearch,
  searchPlaceholder = 'Search',
  filters = [],
  children,
  chips = [],
  onClear,
  className,
}: {
  tabs?: FilterTab[]
  activeTab?: string
  onTabChange?: (key: string) => void
  search?: string
  onSearch?: (value: string) => void
  searchPlaceholder?: string
  filters?: FilterDefinition[]
  children?: ReactNode
  chips?: FilterChip[]
  onClear?: () => void
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {tabs.length > 0 ? (
          <div
            role="group"
            aria-label="Filter views"
            className="flex items-center gap-0.5 rounded-md border border-hairline-in bg-sunk p-0.5"
          >
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                aria-pressed={activeTab === tab.key}
                onClick={() => onTabChange?.(tab.key)}
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-[12.5px] transition-colors duration-150 ease-snap',
                  activeTab === tab.key
                    ? 'bg-panel font-medium text-ink shadow-[0_1px_2px_rgba(23,33,29,0.07)]'
                    : 'text-ink-soft hover:text-ink',
                )}
              >
                {tab.label}
                {tab.count !== undefined ? (
                  <span className="text-[10.5px] tabular-nums text-ink-faint">{tab.count}</span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}

        {onSearch ? (
          <label className="relative min-w-52 flex-1 sm:flex-none">
            <span className="sr-only">Search</span>
            <Search
              size={15}
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-faint"
            />
            <Input
              value={search ?? ''}
              onChange={(event) => onSearch(event.target.value)}
              placeholder={searchPlaceholder}
              className="pl-8"
            />
          </label>
        ) : null}

        {filters.map((filter) => (
          <label key={filter.key} className="relative">
            <span className="sr-only">{filter.label}</span>
            <select
              value={filter.value}
              onChange={(event) => filter.onChange(event.target.value)}
              className="h-9 rounded-md border border-hairline bg-panel pr-7 pl-2.5 text-[13px] text-ink transition-[border-color,box-shadow] duration-150 ease-snap hover:border-ink-faint/45 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/15 focus-visible:outline-none"
            >
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}

        {children}
      </div>

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.key ?? chip.label}
              type="button"
              onClick={chip.onRemove}
              aria-label={`Remove ${chip.label} filter`}
              className="inline-flex items-center gap-1 rounded-sm bg-sunk px-2 py-1 text-[11px] text-ink-soft transition-colors duration-150 ease-snap hover:text-ink"
            >
              {chip.label}
              <X size={12} aria-hidden="true" />
            </button>
          ))}
          {onClear ? (
            <button
              type="button"
              onClick={onClear}
              className="px-1 text-[11px] text-ink-faint transition-colors duration-150 hover:text-ink"
            >
              Clear all
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
