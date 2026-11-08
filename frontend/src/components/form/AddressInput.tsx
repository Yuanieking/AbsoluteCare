import { MapPin } from 'lucide-react'
import { useId, useRef, useState, type ComponentProps, type KeyboardEvent } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useSettings } from '@/features/settings/provider'
import { rememberLocation, searchAddresses, type AddressSuggestion } from '@/lib/addressSearch'
import { cn } from '@/lib/utils'
import { AddressMapPreview } from './AddressMapPreview'

const MIN_QUERY_LENGTH = 3
const MIN_PREVIEW_LENGTH = 6
// The public geocoder is shared, so wait for typing to pause before asking.
const SEARCH_DELAY_MS = 350

type AddressInputProps = Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & {
  value: string
  onChange: (value: string) => void
  multiline?: boolean
  rows?: number
  wrapperClassName?: string
}

/**
 * Address field with OpenStreetMap-based suggestions and a map preview. When
 * the Maps integration is off, or the lookup fails, it behaves as the plain
 * text field it replaces, so addresses can always be typed in.
 */
export function AddressInput({
  value,
  onChange,
  multiline = false,
  rows,
  wrapperClassName,
  className,
  disabled,
  onBlur,
  onKeyDown,
  ...props
}: AddressInputProps) {
  const { settings } = useSettings()
  const active = settings.googleMapsEnabled

  const [predictions, setPredictions] = useState<AddressSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  // Until the user edits, the map follows the saved value (it may load late).
  // After that it only follows committed text, not every keystroke.
  const [edited, setEdited] = useState(false)
  const [committed, setCommitted] = useState('')
  const timer = useRef<number | undefined>(undefined)
  const inflight = useRef<AbortController | null>(null)
  const listId = useId()

  const previewAddress = (edited ? committed : value).trim()

  function scheduleSearch(input: string) {
    window.clearTimeout(timer.current)
    inflight.current?.abort()
    if (!active || input.trim().length < MIN_QUERY_LENGTH) {
      setPredictions([])
      setOpen(false)
      return
    }
    const controller = new AbortController()
    inflight.current = controller
    timer.current = window.setTimeout(async () => {
      try {
        const next = await searchAddresses(input.trim(), controller.signal)
        if (controller.signal.aborted) return
        setPredictions(next)
        setHighlight(-1)
        setOpen(next.length > 0)
      } catch {
        // Offline or the shared server is busy: the plain field still works.
        if (!controller.signal.aborted) {
          setPredictions([])
          setOpen(false)
        }
      }
    }, SEARCH_DELAY_MS)
  }

  function handleChange(next: string) {
    if (!edited) {
      setEdited(true)
      setCommitted(value)
    }
    onChange(next)
    scheduleSearch(next)
  }

  function choose(suggestion: AddressSuggestion) {
    const text = suggestion.label
    inflight.current?.abort()
    window.clearTimeout(timer.current)
    rememberLocation(text, suggestion.point)
    onChange(text)
    setEdited(true)
    setCommitted(text)
    setPredictions([])
    setOpen(false)
    setHighlight(-1)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(event)
    if (event.defaultPrevented || !active) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!predictions.length) return
      event.preventDefault()
      setOpen(true)
      const step = event.key === 'ArrowDown' ? 1 : -1
      setHighlight((current) => (current + step + predictions.length) % predictions.length)
    } else if (event.key === 'Enter' && open && predictions[highlight]) {
      event.preventDefault()
      choose(predictions[highlight])
    } else if (event.key === 'Escape' && open) {
      // Keep Escape from also closing a surrounding dialog.
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
    }
  }

  const fieldProps = {
    ...props,
    value,
    disabled,
    autoComplete: 'off',
    onChange: (event: { target: { value: string } }) => handleChange(event.target.value),
    onKeyDown: handleKeyDown,
    onBlur: (event: Parameters<NonNullable<typeof onBlur>>[0]) => {
      setOpen(false)
      setCommitted(value)
      onBlur?.(event)
    },
    ...(active
      ? {
          role: 'combobox',
          'aria-autocomplete': 'list' as const,
          'aria-expanded': open,
          'aria-controls': listId,
          'aria-activedescendant': highlight >= 0 ? `${listId}-${highlight}` : undefined,
        }
      : {}),
  }

  return (
    <div className={cn('relative', wrapperClassName)}>
      {multiline ? (
        <Textarea
          rows={rows}
          className={className}
          {...(fieldProps as unknown as ComponentProps<typeof Textarea>)}
        />
      ) : (
        <Input className={className} {...fieldProps} />
      )}
      {active && open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-hairline bg-panel py-1 shadow-md"
        >
          {predictions.map((prediction, index) => (
            <li
              key={prediction.label}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === highlight}
              // Keep focus in the field so blur does not close the list first.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(prediction)}
              onMouseEnter={() => setHighlight(index)}
              className={cn(
                'flex cursor-pointer items-start gap-2 px-2.5 py-1.5 text-[12.5px] text-ink',
                index === highlight && 'bg-primary-soft',
              )}
            >
              <MapPin size={13} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-faint" />
              <span>{prediction.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {active && previewAddress.length >= MIN_PREVIEW_LENGTH ? (
        <AddressMapPreview address={previewAddress} />
      ) : null}
    </div>
  )
}
