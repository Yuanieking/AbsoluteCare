import * as React from 'react'
import { cn } from 'cn'
import { fieldBase } from '@/components/ui/input'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        fieldBase,
        'flex field-sizing-content min-h-16 px-2.5 py-2 leading-relaxed',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
