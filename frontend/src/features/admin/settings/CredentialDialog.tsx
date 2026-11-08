import { AlertTriangle, ChevronDown, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import * as api from './api'
import { CredentialField } from './CredentialField'
import { VerificationCode } from './VerificationCode'
import type { CredentialGroup, CredentialsResponse } from './types'

const EMPTY_CODE = ['', '', '', '', '', '']

type PendingChange = {
  kind: 'save' | 'clear' | 'rollback'
  action: string
  key?: string
  values?: Record<string, string>
}

function messageOf(error: unknown, fallback: string) {
  const data = (
    error as { response?: { data?: { message?: string; fields?: Record<string, string> } } }
  ).response?.data
  return data?.message || fallback
}

function affectedAccountLabel(count: number) {
  return count === 1 ? '1 Google Calendar connection' : `${count} Google Calendar connections`
}

export function CredentialDialog({
  group,
  unmanaged = [],
  onClose,
  onSaved,
}: {
  group: CredentialGroup
  unmanaged?: { key: string; present: boolean }[]
  mail?: { adminEmail?: boolean } | null
  onClose: () => void
  onSaved: (result: CredentialsResponse) => void
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(group.keys.map((entry) => [entry.key, ''])),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [step, setStep] = useState<'edit' | 'password' | 'code'>('edit')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState<PendingChange | null>(null)
  const [code, setCode] = useState<string[]>(EMPTY_CODE)
  const [maskedEmail, setMaskedEmail] = useState('')
  const [bootstrap, setBootstrap] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmRotation, setConfirmRotation] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const dirtyValues = Object.fromEntries(
    Object.entries(values)
      .map(([key, value]) => [key, value.trim()])
      .filter(([, value]) => value),
  )
  const dirty = Object.keys(dirtyValues).length > 0
  const rotatingKeys = group.keys.filter((entry) => entry.loadBearing && dirtyValues[entry.key])
  const rotationBlocked = rotatingKeys.length > 0 && !confirmRotation
  const connectionCount = group.connectedAccounts ?? 0

  function applyRequestError(error: unknown) {
    const data = (
      error as {
        response?: { status?: number; data?: { code?: string; fields?: Record<string, string> } }
      }
    ).response?.data
    const status = (error as { response?: { status?: number } }).response?.status
    if (status === 409 && data?.code === 'MAILER_NOT_CONFIGURED') {
      if (group.id !== 'email') {
        setFormError(
          'Email is not working, so a verification code can’t be sent. Fix the Email provider first.',
        )
        return
      }
      setErrors({})
      setFormError('')
      setBootstrap(true)
      setMaskedEmail('')
      setCode(EMPTY_CODE)
      setStep('code')
      return
    }
    setErrors(data?.fields ?? {})
    setFormError(messageOf(error, 'That change couldn’t be checked. Nothing was saved.'))
  }

  // Step 1: remember what is being changed and ask for the superuser password.
  function startPassword(next: PendingChange) {
    setPending(next)
    setPassword('')
    setErrors({})
    setFormError('')
    setBootstrap(false)
    setStep('password')
  }

  function startSave() {
    startPassword({
      kind: 'save',
      action: `rotateIntegrationCredentials:${group.id}`,
      values: dirtyValues,
    })
  }

  function startDestructive(kind: 'clear' | 'rollback', key: string) {
    startPassword({ kind, action: `${kind}IntegrationCredential:${key}`, key })
  }

  // Step 2: the password is checked server-side, then the code goes to SU_EMAIL.
  async function sendCode() {
    if (!pending || !password) return
    setBusy(true)
    setErrors({})
    setFormError('')
    try {
      const response = await api.requestCredentialVerification({
        action: pending.action,
        password,
        ...(pending.kind === 'save'
          ? { values: pending.values, confirmKeyRotation: confirmRotation }
          : {}),
      })
      setMaskedEmail(response.maskedEmail ?? '')
      setBootstrap(false)
      setCode(EMPTY_CODE)
      setPassword('')
      setStep('code')
    } catch (error) {
      const data = (
        error as { response?: { data?: { code?: string; fields?: Record<string, string> } } }
      ).response?.data
      if (data?.code === 'PASSWORD_INVALID' || data?.code === 'PASSWORD_LOCKED') {
        setFormError(messageOf(error, 'That password was not accepted.'))
      } else if (data?.code === 'MAILER_NOT_CONFIGURED' || data?.fields) {
        applyRequestError(error)
        // Field errors belong on the edit step, where the fields are shown.
        if (data?.fields) setStep('edit')
      } else {
        setFormError(messageOf(error, 'A verification code could not be sent.'))
      }
    } finally {
      setBusy(false)
    }
  }

  async function applyChange(token: string) {
    if (!pending) return
    const response =
      pending.kind === 'save'
        ? await api.saveIntegrationCredentials({
            group: group.id,
            values: pending.values,
            verificationToken: token,
            confirmKeyRotation: confirmRotation,
          })
        : pending.kind === 'clear'
          ? await api.clearIntegrationCredential(pending.key ?? '', { verificationToken: token })
          : await api.rollbackIntegrationCredential(pending.key ?? '', { verificationToken: token })
    onSaved(response)
  }

  async function confirmCode() {
    if (!pending) return
    setBusy(true)
    setFormError('')
    try {
      const response = await api.confirmSettingsVerification(pending.action, code.join(''))
      await applyChange(response.verificationToken)
    } catch (error) {
      setFormError(messageOf(error, 'That verification code was not accepted.'))
      setBusy(false)
    }
  }

  async function saveWithoutCode() {
    if (!pending) return
    setBusy(true)
    setFormError('')
    try {
      const response = await api.saveIntegrationCredentials({
        group: group.id,
        values: pending.values,
        confirmKeyRotation: confirmRotation,
      })
      onSaved(response)
    } catch (error) {
      setFormError(messageOf(error, 'That change could not be saved.'))
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (open || busy ? undefined : onClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{group.title} credentials</DialogTitle>
          <DialogDescription>{group.purpose}</DialogDescription>
        </DialogHeader>

        {step === 'edit' ? (
          <>
            <div className="grid gap-4">
              {group.keys.map((entry) => (
                <CredentialField
                  key={entry.key}
                  entry={{ ...entry, stale: group.status.stale }}
                  value={values[entry.key] ?? ''}
                  error={errors[entry.key]}
                  disabled={busy}
                  onChange={(next) => setValues((current) => ({ ...current, [entry.key]: next }))}
                />
              ))}

              {rotatingKeys.length > 0 ? (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-md border border-destructive/25 bg-destructive-soft p-3 text-destructive"
                >
                  <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
                  <div className="grid gap-2">
                    <p className="text-[12px]">
                      {connectionCount === 0
                        ? `Changing ${rotatingKeys
                            .map((entry) => entry.label)
                            .join(
                              ' and ',
                            )} is permanent. No calendars are connected right now, but every stored token is signed with this key.`
                        : `Changing ${rotatingKeys
                            .map((entry) => entry.label)
                            .join(
                              ' and ',
                            )} disconnects ${affectedAccountLabel(connectionCount)}. Their stored tokens can no longer be read, so those people must reconnect.`}
                    </p>
                    <label className="flex items-start gap-2 text-[12px]">
                      <Checkbox
                        checked={confirmRotation}
                        onCheckedChange={(next) => setConfirmRotation(next === true)}
                        className="mt-0.5"
                      />
                      {connectionCount === 0
                        ? 'I understand this cannot be undone without the old value.'
                        : `I understand ${connectionCount === 1 ? 'that connection must' : `those ${connectionCount} connections must`} reconnect.`}
                    </label>
                  </div>
                </div>
              ) : null}

              {formError ? (
                <p role="alert" className="text-[12px] text-destructive">
                  {formError}
                </p>
              ) : null}

              <button
                type="button"
                aria-expanded={advancedOpen}
                onClick={() => setAdvancedOpen((open) => !open)}
                className="inline-flex w-fit items-center gap-1 text-[12px] font-medium text-ink-soft hover:text-ink"
              >
                <ChevronDown
                  size={14}
                  aria-hidden="true"
                  className={
                    advancedOpen ? 'rotate-180 transition-transform' : 'transition-transform'
                  }
                />
                Advanced
              </button>

              {advancedOpen ? (
                <div className="grid gap-3 rounded-md border border-hairline p-3">
                  <div>
                    <h3 className="text-[12.5px] font-semibold text-ink">
                      Managed outside this page
                    </h3>
                    <p className="text-[11.5px] text-ink-soft">
                      These come from the server environment and stay out of reach here.
                    </p>
                    <ul className="mt-2 grid gap-1">
                      {unmanaged.map((item) => (
                        <li
                          key={item.key}
                          className="flex items-center justify-between gap-3 text-[11.5px]"
                        >
                          <code className="font-mono">{item.key}</code>
                          <span className="text-ink-soft">
                            {item.present ? 'set in .env' : 'not set'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-[12.5px] font-semibold text-ink">
                      This integration&apos;s keys
                    </h3>
                    <ul className="mt-2 grid gap-1.5">
                      {group.keys
                        .filter((entry) => entry.source === 'app')
                        .map((entry) => (
                          <li
                            key={entry.key}
                            className="flex flex-wrap items-center justify-between gap-2"
                          >
                            <code className="font-mono text-[11.5px]">{entry.key}</code>
                            <div className="flex items-center gap-1.5">
                              {entry.hasPrevious ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="xs"
                                  disabled={busy}
                                  onClick={() => startDestructive('rollback', entry.key)}
                                >
                                  Restore previous value
                                </Button>
                              ) : null}
                              <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                className="text-destructive"
                                disabled={busy}
                                onClick={() => startDestructive('clear', entry.key)}
                              >
                                Revert to .env
                              </Button>
                            </div>
                          </li>
                        ))}
                    </ul>
                    {group.keys.every((entry) => entry.source !== 'app') ? (
                      <p className="mt-2 text-[11.5px] text-ink-soft">
                        Every key in this group currently comes from the server environment.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={busy || !dirty || rotationBlocked}
                onClick={startSave}
              >
                Save and verify
              </Button>
            </DialogFooter>
          </>
        ) : step === 'password' ? (
          <>
            <div className="grid gap-3">
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
              {formError ? (
                <p role="alert" className="text-[12px] text-destructive">
                  {formError}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setStep('edit')
                  setPassword('')
                  setFormError('')
                }}
              >
                Back
              </Button>
              <Button type="button" disabled={busy || !password} onClick={() => void sendCode()}>
                {busy ? (
                  <LoaderCircle className="animate-spin" size={15} aria-hidden="true" />
                ) : null}
                {busy ? 'Checking...' : 'Send code'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="grid gap-3">
              <p className="text-[12.5px] text-ink-soft">
                {bootstrap
                  ? 'Email is failing right now, so we can’t send a verification code. This change will be saved and marked unverified in the audit log.'
                  : `We sent a six-digit code to ${maskedEmail || 'the superuser email'}. It expires in 10 minutes.`}
              </p>

              {bootstrap ? (
                <Button
                  type="button"
                  disabled={busy}
                  className="w-fit"
                  onClick={() => void saveWithoutCode()}
                >
                  {busy ? (
                    <LoaderCircle className="animate-spin" size={15} aria-hidden="true" />
                  ) : null}
                  {busy ? 'Saving...' : 'Save without a code'}
                </Button>
              ) : (
                <VerificationCode
                  value={code}
                  onChange={setCode}
                  onComplete={() => {
                    if (code.join('').length === 6) void confirmCode()
                  }}
                />
              )}

              {formError ? (
                <p role="alert" className="text-[12px] text-destructive">
                  {formError}
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setStep(bootstrap ? 'edit' : 'password')
                  setFormError('')
                }}
              >
                Back
              </Button>
              {bootstrap ? null : (
                <Button
                  type="button"
                  disabled={busy || code.join('').length !== 6}
                  onClick={() => void confirmCode()}
                >
                  {busy ? (
                    <LoaderCircle className="animate-spin" size={15} aria-hidden="true" />
                  ) : null}
                  {busy ? 'Saving...' : 'Confirm and save'}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
