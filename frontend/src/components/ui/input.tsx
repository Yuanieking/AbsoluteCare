import * as React from 'react'
import { cn } from 'cn'

const fieldBase = [
  'w-full min-w-0 rounded-md border border-hairline bg-panel text-[13px] text-ink',
  'shadow-[inset_0_1px_1px_rgba(23,33,29,0.03)]',
  'transition-[border-color,box-shadow,background-color] duration-150 ease-snap',
  'hover:border-ink-faint/45',
  'focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/15 focus-visible:outline-none',
  'aria-invalid:border-destructive aria-invalid:ring-destructive/15',
  'disabled:cursor-not-allowed disabled:bg-sunk/60 disabled:text-ink-faint',
  'placeholder:text-ink-faint',
].join(' ')

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        fieldBase,
        'h-9 px-2.5 py-1',
        'selection:bg-primary-soft selection:text-primary-strong',
        'file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-[12.5px] file:font-medium file:text-ink',
        className,
      )}
      {...props}
    />
  )
}

export { Input, fieldBase }
