import {
  CalendarDays,
  Check,
  Copy,
  ExternalLink,
  HardDrive,
  Info,
  KeyRound,
  LoaderCircle,
  Mail,
  RefreshCw,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { getToastError } from '@/lib/toast'
import { cn } from '@/lib/utils'
import * as api from '../api'
import { sectionMap } from '../config'
import { InlineNote, SettingsSection } from '../fields'
import { IntegrationSetupGuide } from '../IntegrationSetupGuide'
import { RestartBanner, type RestartPhase } from '../RestartBanner'
import type {
  CredentialsResponse,
  DriveConnectionStatus,
  IntegrationFlags,
  IntegrationHealth,
  IntegrationHealthRecord,
  IntegrationValues,
} from '../types'

function lastChanged(record?: IntegrationHealthRecord) {
  if (!record?.updatedBy?.name) return 'Never changed'
  const when = record.updatedAt ? new Date(record.updatedAt).toLocaleDateString() : ''
  return `Last changed by ${record.updatedBy.name}${when ? ` · ${when}` : ''}`
}

function missingNote(record?: IntegrationHealthRecord) {
  if (!record?.missing?.length) return ''
  return `Not configured: ${record.missing.map((name) => `“${name}”`).join(', ')} is missing.`
}

function IntegrationCard({
  id,
  icon: Icon,
  title,
  description,
  configured,
  statusLabel,
  children,
  switchControl,
  meta,
  setupHint,
  footer,
}: {
  id: string
  icon: LucideIcon
  title: string
  description: string
  configured: boolean
  statusLabel?: string
  children?: ReactNode
  switchControl?: ReactNode
  meta: string
  setupHint?: string
  footer: ReactNode
}) {
  const descriptionId = `${id}-description`
  return (
    <article id={id} className="rounded-lg border border-hairline bg-card p-4">
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
          <Icon size={19} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[13.5px] font-semibold text-ink">{title}</h3>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10.5px] font-medium',
                configured
                  ? 'bg-status-completed-bg text-status-completed'
                  : 'bg-signal-soft text-signal',
              )}
            >
              {statusLabel || (configured ? 'Configured' : 'Not configured')}
            </span>
          </div>
          <p id={descriptionId} className="mt-0.5 max-w-[62ch] text-[12px] text-ink-soft">
            {description}
          </p>
          <p className="mt-1 text-[11px] text-ink-faint">{meta}</p>
          {setupHint ? (
            <div className="mt-2">
              <InlineNote tone="warning">
                {setupHint}{' '}
                <a href="#integration-setup-guide" className="underline">
                  View setup guide
                </a>
              </InlineNote>
            </div>
          ) : null}
          {children}
        </div>
        {switchControl}
      </div>
      <footer className="mt-3 flex flex-wrap items-center gap-3 border-t border-hairline-in pt-3">
        {footer}
      </footer>
    </article>
  )
}

function GhostAction({
  icon,
  children,
  onClick,
  href,
}: {
  icon: ReactNode
  children: ReactNode
  onClick?: () => void
  href?: string
}) {
  const className =
    'inline-flex items-center gap-1 text-[11.5px] font-medium text-ink-soft hover:text-ink'
  return href ? (
    <a href={href} className={className}>
      {icon}
      {children}
    </a>
  ) : (
    <button type="button" className={className} onClick={onClick}>
      {icon}
      {children}
    </button>
  )
}

function DriveCard({
  configured,
  switchControl,
  onEditCredentials,
}: {
  configured: boolean
  switchControl: ReactNode
  onEditCredentials: (group: string) => void
}) {
  const [status, setStatus] = useState<DriveConnectionStatus | null>(null)
  const [busy, setBusy] = useState('')
  const [result, setResult] = useState('')

  useEffect(() => {
    let active = true
    api
      .getDriveStatus()
      .then((next) => {
        if (!active) return
        setStatus(next)
        const outcome = new URLSearchParams(window.location.search).get('drive')
        if (outcome === 'connected') setResult('Google Drive connected.')
        if (outcome === 'error') setResult('The Google Drive connection did not finish.')
      })
      .catch(() => {
        if (active) setResult('Drive status could not be loaded.')
      })
    return () => {
      active = false
    }
  }, [])

  const connected = Boolean(status?.connected)

  async function disconnect() {
    const proceed = window.confirm(
      'Disconnect the clinic Google Drive? Future uploads stop. Files already in Drive stay there.',
    )
    if (!proceed) return
    setBusy('disconnect')
    setResult('')
    try {
      await api.disconnectDrive()
      setStatus(await api.getDriveStatus())
      setResult('Disconnected. Future uploads stop; existing files stay in Drive.')
    } catch (error) {
      setResult(getToastError(error, 'Google Drive could not be disconnected.'))
    } finally {
      setBusy('')
    }
  }

  async function test() {
    setBusy('test')
    setResult('')
    try {
      const outcome = await api.testDriveConnection()
      setResult(outcome.message)
    } catch (error) {
      setResult(getToastError(error, 'The Drive test failed.'))
    } finally {
      setBusy('')
    }
  }

  return (
    <IntegrationCard
      id="google-drive"
      icon={HardDrive}
      title="Google Drive"
      description="Files every generated PDF into the clinic's Drive, sorted by type and month. Turning this off stops new uploads and retries; documents still generate and download."
      configured={configured && connected}
      statusLabel={
        connected
          ? status?.needsReconnect
            ? 'Reconnect needed'
            : 'Connected'
          : 'Not connected'
      }
      meta={
        connected
          ? `Connected as ${status?.email || 'the clinic Google account'} · folder ${status?.rootFolderName || 'AbsoluteCare Documents'}`
          : `Folder ${status?.rootFolderName || 'AbsoluteCare Documents'}`
      }
      setupHint={
        connected && status?.needsReconnect
          ? 'Google rejected the saved Drive access. Reconnect the clinic account.'
          : undefined
      }
      switchControl={switchControl}
      footer={
        <>
          <GhostAction icon={<ExternalLink size={13} />} href={api.driveConnectUrl()}>
            {connected ? 'Reconnect' : 'Connect Google Drive'}
          </GhostAction>
          <GhostAction
            icon={
              busy === 'test' ? (
                <LoaderCircle className="animate-spin" size={13} />
              ) : (
                <Check size={13} />
              )
            }
            onClick={() => void test()}
          >
            {busy === 'test' ? 'Sending test file...' : 'Send test file'}
          </GhostAction>
          <GhostAction icon={<KeyRound size={13} />} onClick={() => onEditCredentials('googleDrive')}>
            Edit credentials
          </GhostAction>
          {connected ? (
            <GhostAction icon={<Info size={13} />} onClick={() => void disconnect()}>
              {busy === 'disconnect' ? 'Disconnecting...' : 'Disconnect'}
            </GhostAction>
          ) : null}
        </>
      }
    >
      {result || status?.lastError ? (
        <p role="status" className="mt-2 text-[11.5px] text-ink-soft">
          {result || status?.lastError}
        </p>
      ) : null}
    </IntegrationCard>
  )
}

export function IntegrationsSection({
  value,
  integrations,
  health,
  saving,
  credentials,
  restartPhase,
  restartMessage,
  downloadingHandover,
  refreshing,
  onCommit,
  onTestEmail,
  onTestIntegration,
  onRefresh,
  onEditCredentials,
  onRestart,
  onDismissRestart,
  onDownloadHandover,
}: {
  value: IntegrationValues
  integrations: IntegrationFlags
  health: IntegrationHealth
  saving: boolean
  credentials: CredentialsResponse | null
  restartPhase: RestartPhase
  restartMessage: string
  downloadingHandover: boolean
  refreshing: boolean
  onCommit: (field: keyof IntegrationValues, enabled: boolean) => Promise<void>
  onTestEmail: () => Promise<void>
  onTestIntegration: (key: string) => Promise<void>
  onRefresh: () => void
  onEditCredentials: (group: string) => void
  onRestart: () => void
  onDismissRestart: () => void
  onDownloadHandover: () => void
}) {
  const [testing, setTesting] = useState('')
  const [results, setResults] = useState<Record<string, string>>({})

  const googleRecord = health.google || {}
  const recaptchaRecord = health.recaptcha || {}
  const calendarRecord = health.calendar || {}
  const emailRecord = health.email || {}
  const driveRecord = health.drive || {}

  const googleConfigured = googleRecord.configured ?? Boolean(integrations.google)
  const recaptchaConfigured = recaptchaRecord.configured ?? Boolean(integrations.recaptcha)
  const calendarConfigured = calendarRecord.configured ?? googleConfigured
  const emailConfigured = emailRecord.configured ?? Boolean(integrations.email)
  const driveConfigured = driveRecord.configured ?? Boolean(integrations.drive)

  function setResult(key: string, message: string) {
    setResults((current) => ({ ...current, [key]: message }))
  }

  async function testConfiguration(key: string) {
    setTesting(key)
    setResult(key, '')
    try {
      await onTestIntegration(key)
      setResult(key, 'Configuration passed.')
    } catch (error) {
      setResult(key, getToastError(error, 'Configuration test failed.'))
    } finally {
      setTesting('')
    }
  }

  async function testEmail() {
    setTesting('email')
    setResult('email', '')
    try {
      await onTestEmail()
      setResult('email', 'Test email sent.')
    } catch (error) {
      setResult('email', getToastError(error, 'Test email could not be sent. Try again.'))
    } finally {
      setTesting('')
    }
  }

  function toggle(field: keyof IntegrationValues, label: string, checked: boolean) {
    return (
      <div className="flex items-center gap-2">
        <Switch
          aria-label={`${label}: ${checked ? 'On' : 'Off'}`}
          checked={checked}
          disabled={saving}
          onCheckedChange={(next) => void onCommit(field, next)}
        />
        <span className="w-6 text-[11px] text-ink-soft">{checked ? 'On' : 'Off'}</span>
      </div>
    )
  }

  return (
    <SettingsSection
      section={sectionMap.integrations!}
      actions={
        <Button type="button" variant="outline" size="sm" disabled={refreshing} onClick={onRefresh}>
          {refreshing ? (
            <LoaderCircle className="animate-spin" size={14} aria-hidden="true" />
          ) : (
            <RefreshCw size={14} aria-hidden="true" />
          )}
          {refreshing ? 'Re-checking...' : 'Re-check status'}
        </Button>
      }
    >
      {!googleConfigured || !recaptchaConfigured || !emailConfigured ? (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-signal/25 bg-signal-soft px-4 py-3 text-[12px] text-signal"
        >
          <Info size={15} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span className="flex-1">
            {!recaptchaConfigured
              ? 'reCAPTCHA isn’t configured. Login and sign-up aren’t protected against bots.'
              : 'Some integrations need attention before they can be enabled.'}
          </span>
          <a href={recaptchaConfigured ? '#google-sign-in' : '#recaptcha'} className="underline">
            Set up
          </a>
        </div>
      ) : null}

      <RestartBanner
        restart={credentials?.restart}
        phase={restartPhase}
        message={restartMessage}
        onRestart={onRestart}
        onDismiss={onDismissRestart}
      />

      <div className="grid gap-3">
        <IntegrationCard
          id="google-sign-in"
          icon={ShieldCheck}
          title="Google sign-in"
          description="Let patients log in and sign up with their Google account."
          configured={googleConfigured}
          meta={`${googleRecord.details?.clientIdMasked ? `Client ID ${googleRecord.details.clientIdMasked}` : 'Client ID not set'} · ${lastChanged(googleRecord)}`}
          setupHint={!googleConfigured ? missingNote(googleRecord) : undefined}
          switchControl={toggle(
            'googleAuthEnabled',
            'Google sign-in',
            googleRecord.effectiveEnabled ?? value.googleAuthEnabled,
          )}
          footer={
            <>
              <GhostAction
                icon={<KeyRound size={13} />}
                onClick={() => onEditCredentials('google')}
              >
                Edit credentials
              </GhostAction>
              <GhostAction
                icon={
                  testing === 'google' ? (
                    <LoaderCircle className="animate-spin" size={13} />
                  ) : (
                    <Check size={13} />
                  )
                }
                onClick={() => void testConfiguration('google')}
              >
                {testing === 'google' ? 'Testing...' : 'Test configuration'}
              </GhostAction>
              <GhostAction icon={<Info size={13} />} href="#integration-setup-guide">
                View setup guide
              </GhostAction>
              <GhostAction
                icon={<Copy size={13} />}
                onClick={() =>
                  void navigator.clipboard?.writeText(googleRecord.details?.redirectUri || '')
                }
              >
                Copy redirect URI
              </GhostAction>
            </>
          }
        >
          {results.google ? (
            <p role="status" className="mt-2 text-[11.5px] text-ink-soft">
              {results.google}
            </p>
          ) : null}
        </IntegrationCard>

        <IntegrationCard
          id="recaptcha"
          icon={ShieldCheck}
          title="reCAPTCHA"
          description="Protect login, sign-up, and forgot password from bots."
          configured={recaptchaConfigured}
          meta={`${recaptchaRecord.details?.siteKey ? 'Site key configured' : 'Site key not set'} · ${lastChanged(recaptchaRecord)}`}
          setupHint={!recaptchaConfigured ? missingNote(recaptchaRecord) : undefined}
          switchControl={toggle(
            'recaptchaEnabled',
            'reCAPTCHA',
            recaptchaRecord.effectiveEnabled ?? value.recaptchaEnabled,
          )}
          footer={
            <>
              <GhostAction
                icon={<KeyRound size={13} />}
                onClick={() => onEditCredentials('recaptcha')}
              >
                Edit credentials
              </GhostAction>
              <GhostAction
                icon={
                  testing === 'recaptcha' ? (
                    <LoaderCircle className="animate-spin" size={13} />
                  ) : (
                    <Check size={13} />
                  )
                }
                onClick={() => void testConfiguration('recaptcha')}
              >
                {testing === 'recaptcha' ? 'Testing...' : 'Test configuration'}
              </GhostAction>
              <GhostAction icon={<Info size={13} />} href="#integration-setup-guide">
                View setup guide
              </GhostAction>
            </>
          }
        >
          {results.recaptcha ? (
            <p role="status" className="mt-2 text-[11.5px] text-ink-soft">
              {results.recaptcha}
            </p>
          ) : null}
        </IntegrationCard>

        <IntegrationCard
          id="google-calendar"
          icon={CalendarDays}
          title="Google Calendar"
          description="Sync confirmed appointments to users' Google Calendars. Turning this off pauses syncing but keeps existing connections."
          configured={calendarConfigured}
          meta={`${calendarRecord.details?.redirectUri || 'Calendar redirect URI not set'} · ${lastChanged(calendarRecord)}`}
          setupHint={!calendarConfigured ? missingNote(calendarRecord) : undefined}
          switchControl={toggle(
            'googleCalendarEnabled',
            'Google Calendar',
            calendarRecord.effectiveEnabled ?? value.googleCalendarEnabled,
          )}
          footer={
            <>
              <GhostAction
                icon={<KeyRound size={13} />}
                onClick={() => onEditCredentials('googleCalendar')}
              >
                Edit credentials
              </GhostAction>
              <GhostAction icon={<Info size={13} />} href="#integration-setup-guide">
                View setup guide
              </GhostAction>
              <GhostAction
                icon={<ExternalLink size={13} />}
                href="https://console.cloud.google.com/apis/credentials"
              >
                Open Google Cloud console
              </GhostAction>
            </>
          }
        />

        <IntegrationCard
          id="email-provider"
          icon={Mail}
          title="Email provider"
          description="Sends password resets, invitations, and appointment emails. Turning this off stops every outbound email, including password resets and invitations."
          configured={emailConfigured && emailRecord.ok !== false}
          statusLabel={
            !value.emailEnabled
              ? 'Off'
              : emailRecord.ok === true
                ? 'Working'
                : emailRecord.ok === false
                  ? 'Login rejected'
                  : undefined
          }
          meta={`${emailRecord.details?.senderAddress || 'Sender address not set'} · ${lastChanged(emailRecord)}`}
          setupHint={!emailConfigured ? missingNote(emailRecord) : undefined}
          switchControl={toggle('emailEnabled', 'Email provider', value.emailEnabled)}
          footer={
            <>
              <GhostAction icon={<KeyRound size={13} />} onClick={() => onEditCredentials('email')}>
                Edit credentials
              </GhostAction>
              <GhostAction
                icon={
                  testing === 'email' ? (
                    <LoaderCircle className="animate-spin" size={13} />
                  ) : (
                    <Mail size={13} />
                  )
                }
                onClick={() => void testEmail()}
              >
                {testing === 'email' ? 'Sending test email...' : 'Send test email'}
              </GhostAction>
              <GhostAction icon={<Info size={13} />} href="#integration-setup-guide">
                View setup guide
              </GhostAction>
            </>
          }
        >
          {results.email || emailRecord.lastTest ? (
            <p role="status" className="mt-2 text-[11.5px] text-ink-soft">
              {results.email ||
                `${emailRecord.lastTest?.ok ? 'Last test passed' : 'Last test failed'} · ${
                  emailRecord.lastTest?.checkedAt
                    ? new Date(emailRecord.lastTest.checkedAt).toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    : ''
                } · ${emailRecord.lastTest?.message || ''}`}
            </p>
          ) : null}
        </IntegrationCard>

        <DriveCard
          configured={driveConfigured}
          switchControl={toggle(
            'googleDriveEnabled',
            'Google Drive filing',
            value.googleDriveEnabled,
          )}
          onEditCredentials={onEditCredentials}
        />
      </div>

      {credentials?.groups?.length ? (
        <IntegrationSetupGuide
          groups={credentials.groups}
          onEdit={onEditCredentials}
          onDownload={onDownloadHandover}
          downloading={downloadingHandover}
        />
      ) : null}
    </SettingsSection>
  )
}
