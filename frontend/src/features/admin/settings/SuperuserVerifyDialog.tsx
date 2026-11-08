import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import * as api from './api'
import { VerificationCode } from './VerificationCode'

const EMPTY_CODE = ['', '', '', '', '', '']

function messageOf(error: unknown, fallback: string) {
  const data = (error as { response?: { data?: { message?: string } } }).response?.data
  return data?.message || fallback
}

/** Superuser password, then the emailed six-digit code, for one sensitive action. */
export function SuperuserVerifyDialog({
  action,
  title,
  description,
  onVerified,
  onClose,
}: {
  action: string
  title: string
  description: string
  onVerified: (verificationToken: string) => Promise<void>
  onClose: () => void
}) {
  const [step, setStep] = useState<'password' | 'code'>('password')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState<string[]>(EMPTY_CODE)
  const [maskedEmail, setMaskedEmail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function sendCode() {
    if (!password) return
    setBusy(true)
    setError('')
    try {
      const response = await api.requestCredentialVerification({ action, password })
      setMaskedEmail(response.maskedEmail ?? '')
      setPassword('')
      setCode(EMPTY_CODE)
      setStep('code')
    } catch (err) {
      setError(messageOf(err, 'A verification code could not be sent.'))
    } finally {
      setBusy(false)
    }
  }

  async function confirmCode() {
    setBusy(true)
    setError('')
    try {
      const response = await api.confirmSettingsVerification(action, code.join(''))
      await onVerified(response.verificationToken)
    } catch (err) {
      setError(messageOf(err, 'That verification code was not accepted.'))
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (open || busy ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          {step === 'password' ? (
            <>
              <p className="text-[12.5px] text-ink-soft">
                Enter the superuser password. We then email a six-digit code to the superuser
                address.
              </p>
              <Input
                type="password"
                autoComplete="off"
                autoFocus
                aria-label="Superuser password"
                placeholder="Superuser password"
                value={password}
                disabled={busy}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void sendCode()
                }}
              />
            </>
          ) : (
            <>
              <p className="text-[12.5px] text-ink-soft">
                We sent a six-digit code to {maskedEmail || 'the superuser email'}. It expires in 10
                minutes.
              </p>
              <VerificationCode
                value={code}
                onChange={setCode}
                onComplete={() => {
                  if (code.join('').length === 6) void confirmCode()
                }}
              />
            </>
          )}
          {error ? (
            <p role="alert" className="text-[12px] text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              if (step === 'code') {
                setStep('password')
                setError('')
              } else {
                onClose()
              }
            }}
          >
            {step === 'code' ? 'Back' : 'Cancel'}
          </Button>
          {step === 'password' ? (
            <Button type="button" disabled={busy || !password} onClick={() => void sendCode()}>
              {busy ? <LoaderCircle className="animate-spin" size={15} aria-hidden="true" /> : null}
              {busy ? 'Checking...' : 'Send code'}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={busy || code.join('').length !== 6}
              onClick={() => void confirmCode()}
            >
              {busy ? <LoaderCircle className="animate-spin" size={15} aria-hidden="true" /> : null}
              {busy ? 'Saving...' : 'Confirm and save'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
