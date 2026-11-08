import { FileText, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { showError, showSuccess } from '@/lib/toast'
import type { CreateDocumentInput } from './api'
import { useCreateDocument } from './queries'

/**
 * Shared "Generate PDF" action. One button, every entry point: the server owns
 * the document body, the tracking number and the Drive filing.
 */
export function GenerateDocumentButton({
  input,
  label = 'Generate PDF',
  variant = 'default',
  size = 'default',
  existing = false,
  disabled = false,
  title,
}: {
  input: CreateDocumentInput
  label?: string
  variant?: 'default' | 'outline' | 'secondary' | 'ghost'
  size?: 'default' | 'sm' | 'xs'
  /** A document for the same source and range already exists. */
  existing?: boolean
  disabled?: boolean
  title?: string
}) {
  const create = useCreateDocument()
  const [pending, setPending] = useState(false)

  async function generate() {
    if (existing) {
      const proceed = window.confirm(
        'A document for this period was already issued. Generating again creates a new tracking number and marks the old one superseded.',
      )
      if (!proceed) return
    }
    setPending(true)
    try {
      const document = await create.mutateAsync(input)
      const filed =
        document.drive.status === 'uploaded'
          ? 'Filed to Google Drive.'
          : 'Drive sync is pending and will retry.'
      showSuccess(`Document ${document.trackingNumber} generated. ${filed}`, {
        action: {
          label: 'View documents',
          onClick: () => window.location.assign('/staff/documents'),
        },
      })
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data
        ?.message
      showError(message || 'The document could not be generated.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={disabled || pending}
      title={title}
      onClick={() => void generate()}
    >
      {pending ? (
        <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
      ) : (
        <FileText size={15} aria-hidden="true" />
      )}
      {pending ? 'Generating…' : label}
    </Button>
  )
}
