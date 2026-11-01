import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from 'cn'
import { Slot } from 'radix-ui'

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border border-transparent px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:outline-none [&>svg]:pointer-events-none [&>svg]:size-3',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground [a&]:hover:bg-primary-strong',
        secondary: 'bg-sunk text-ink-soft [a&]:hover:bg-sunk/70',
        destructive: 'bg-destructive-soft text-destructive [a&]:hover:bg-destructive/15',
        outline: 'border-hairline text-ink-soft [a&]:hover:border-ink-faint/50 [a&]:hover:text-ink',
        signal: 'bg-signal-soft text-signal [a&]:hover:bg-signal/15',
        ghost: 'text-ink-soft [a&]:hover:bg-sunk [a&]:hover:text-ink',
        link: 'text-primary underline-offset-4 [a&]:hover:underline',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({
  className,
  variant = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span'

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
