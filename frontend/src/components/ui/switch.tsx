import * as React from 'react'
import { cn } from 'cn'
import { Switch as SwitchPrimitive } from 'radix-ui'

function Switch({
  className,
  size = 'default',
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: 'sm' | 'default'
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        'peer group/switch inline-flex shrink-0 items-center rounded-full border transition-colors duration-150 ease-snap outline-none',
        'focus-visible:ring-[3px] focus-visible:ring-primary/15 focus-visible:ring-offset-1 focus-visible:ring-offset-panel',
        'disabled:cursor-not-allowed disabled:opacity-45',
        'data-[state=checked]:border-primary data-[state=checked]:bg-primary',
        'data-[state=unchecked]:border-hairline data-[state=unchecked]:bg-sunk',
        'data-[size=default]:h-[18px] data-[size=default]:w-8 data-[size=sm]:h-4 data-[size=sm]:w-7',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'pointer-events-none block size-3.5 translate-x-[2px] rounded-full bg-panel shadow-[0_1px_2px_rgba(23,33,29,0.22)] ring-0',
          'transition-transform duration-150 ease-snap',
          'data-[state=checked]:translate-x-[14px]',
          'group-data-[size=sm]/switch:size-3 group-data-[size=sm]/switch:data-[state=checked]:translate-x-[12px]',
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
