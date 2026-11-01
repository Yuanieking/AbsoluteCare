import { useEffect, useRef } from 'react'

export function VerificationCode({
  value,
  onChange,
  autoFocus = true,
  onComplete,
}: {
  value: string[]
  onChange: (next: string[]) => void
  autoFocus?: boolean
  onComplete?: () => void
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus()
  }, [autoFocus])

  return (
    <div className="flex items-center gap-2">
      {value.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            refs.current[index] = element
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={digit}
          aria-label={`Verification digit ${index + 1}`}
          className="size-10 rounded-md border border-hairline bg-panel text-center text-[15px] tabular-nums text-ink focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          onChange={(event) => {
            const next = event.target.value.replace(/\D/g, '').slice(-1)
            onChange(value.map((item, itemIndex) => (itemIndex === index ? next : item)))
            if (next) refs.current[index + 1]?.focus()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Backspace' && !value[index]) refs.current[index - 1]?.focus()
            if (event.key === 'Enter' && value.join('').length === 6) onComplete?.()
          }}
        />
      ))}
    </div>
  )
}
