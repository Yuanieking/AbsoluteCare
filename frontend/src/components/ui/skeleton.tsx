import { cn } from 'cn'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn('relative overflow-hidden rounded-md bg-sunk', className)}
      {...props}
    >
      <span className="pointer-events-none absolute inset-0 animate-sheen bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.65),transparent)]" />
    </div>
  )
}

export { Skeleton }
