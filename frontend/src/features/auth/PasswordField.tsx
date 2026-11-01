import { useState, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { type Control, type FieldPath, type FieldValues } from 'react-hook-form'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'

type PasswordFieldProps<T extends FieldValues> = {
  control: Control<T>
  name: FieldPath<T>
  label: string
  autoComplete: 'current-password' | 'new-password'
  footer?: ReactNode
}

export function PasswordField<T extends FieldValues>({
  control,
  name,
  label,
  autoComplete,
  footer,
}: PasswordFieldProps<T>) {
  const [show, setShow] = useState(false)

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <div className="relative">
            <FormControl>
              <Input
                type={show ? 'text' : 'password'}
                autoComplete={autoComplete}
                className="h-10 border-hairline bg-transparent pr-16"
                {...field}
                value={typeof field.value === 'string' ? field.value : ''}
              />
            </FormControl>
            <button
              type="button"
              onClick={() => setShow((visible) => !visible)}
              aria-label={show ? 'Hide password' : 'Show password'}
              className="absolute top-1 right-1 inline-flex h-8 items-center gap-1 rounded-sm px-2 text-[11px] font-semibold text-eyebrow"
            >
              {show ? (
                <EyeOff size={15} aria-hidden="true" />
              ) : (
                <Eye size={15} aria-hidden="true" />
              )}
              {show ? 'Hide' : 'Show'}
            </button>
          </div>
          <FormMessage />
          {footer}
        </FormItem>
      )}
    />
  )
}
