import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from 'cn'
import { Slot } from 'radix-ui'

const buttonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md text-[13px] font-medium whitespace-nowrap select-none',
    'transition-[background-color,color,border-color,box-shadow,transform] duration-150 ease-snap',
    'active:scale-[0.985] motion-reduce:active:scale-100',
    'outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-1 focus-visible:ring-offset-panel',
    'disabled:pointer-events-none disabled:opacity-45',
    'aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/25',
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ].join(' '),
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] hover:bg-primary-strong',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:
          'border border-hairline bg-panel text-ink hover:border-ink-faint/50 hover:bg-sunk/50',
        secondary: 'bg-primary-soft text-primary-strong hover:bg-primary-soft/70',
        ghost: 'text-ink-soft hover:bg-sunk/70 hover:text-ink',
        link: 'h-auto p-0 text-primary underline-offset-4 hover:underline active:scale-100',
      },
      size: {
        default: 'h-9 px-3.5 has-[>svg]:px-3',
        xs: "h-6.5 gap-1 rounded-sm px-2 text-[11.5px] has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: 'h-8 gap-1.5 px-3 text-[12.5px] has-[>svg]:px-2.5',
        lg: 'h-10 px-5 text-[13.5px] has-[>svg]:px-4',
        icon: 'size-9',
        'icon-xs': "size-6.5 rounded-sm [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
