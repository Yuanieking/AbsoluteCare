import { AlertTriangle, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageBody, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getToastError, showError, showSuccess } from '@/lib/toast'
import * as api from './api'
import { isSectionKey, sectionMap, sections } from './config'
import { CredentialDialog } from './CredentialDialog'
import { SaveBar } from './fields'
import { useSettingsBundle } from './queries'
import { RestartBanner, type RestartPhase } from './RestartBanner'
import { AuditSection } from './AuditLog'
import { AuthSection } from './sections/access'
import { BookingSection, GeneralSection, ScheduleSection } from './sections/clinic'
import { IntegrationsSection } from './sections/integrations'
import { MaintenanceSection, NotificationsSection, PaymentsSection } from './sections/operations'
import type { AdminSettings, IntegrationValues, SettingsSectionKey } from './types'

type SectionValue = AdminSettings[SettingsSectionKey]

const integrationKeys: Record<keyof IntegrationValues, string> = {
  googleAuthEnabled: 'googleAuth',
  recaptchaEnabled: 'recaptcha',
  googleCalendarEnabled: 'googleCalendar',
  googleDriveEnabled: 'googleDrive',
  emailEnabled: 'email',
}

export default function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const requested = params.get('section') || 'general'
  const section = isSectionKey(requested) || requested === 'audit' ? requested : 'general'
  const bundle = useSettingsBundle()
  const [drafts, setDrafts] = useState<Partial<Record<SettingsSectionKey, SectionValue>>>({})
  const [saving, setSaving] = useState(false)
  const [credentialGroup, setCredentialGroup] = useState('')
  const [restartPhase, setRestartPhase] = useState<RestartPhase>('idle')
  const [restartMessage, setRestartMessage] = useState('')
  const [downloadingHandover, setDownloadingHandover] = useState(false)
  const [refreshingStatus, setRefreshingStatus] = useState(false)
  const [search, setSearch] = useState('')
  const mounted = useRef(true)
  const restartTimer = useRef<number | null>(null)

  const settings = bundle.data?.settings.settings
  const integrationFlags = bundle.data?.settings.integrations ?? {}
  const health = bundle.data?.health ?? {}
  const credentials = bundle.data?.credentials ?? null
  const savedSection = section === 'audit' ? null : (settings?.[section] ?? null)
  const draft = section === 'audit' ? null : (drafts[section] ?? savedSection)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (restartTimer.current) window.clearInterval(restartTimer.current)
    }
  }, [])

  const dirty = useMemo(
    () => Boolean(draft && savedSection) && JSON.stringify(draft) !== JSON.stringify(savedSection),
    [draft, savedSection],
  )

  useEffect(() => {
    if (!dirty) return
    function warnBeforeLeave(event: BeforeUnloadEvent) {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warnBeforeLeave)
    return () => window.removeEventListener('beforeunload', warnBeforeLeave)
  }, [dirty])

  const results = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return []
    return sections
      .filter((item) =>
        `${item.label} ${item.title} ${item.description}`.toLowerCase().includes(term),
      )
      .slice(0, 6)
  }, [search])

  function update(field: string, value: unknown) {
    if (section === 'audit') return
    const base = drafts[section] ?? savedSection
    if (!base) return
    setDrafts((current) => ({ ...current, [section]: { ...base, [field]: value } as SectionValue }))
  }

  function discardDraft() {
    if (section === 'audit') return
    setDrafts((current) => {
      const next = { ...current }
      delete next[section]
      return next
    })
  }

  async function save() {
    if (!draft || section === 'audit') return
    setSaving(true)
    try {
      await api.updateSettingsSection(section, draft)
      await bundle.refetch()
      discardDraft()
      showSuccess(`${sectionMap[section]?.title} settings updated`)
    } catch (error) {
      showError(getToastError(error, 'Settings could not be saved.'))
    } finally {
      setSaving(false)
    }
  }

  async function commitIntegration(field: keyof IntegrationValues, enabled: boolean) {
    setSaving(true)
    try {
      await api.updateIntegration(integrationKeys[field], { enabled })
      await bundle.refetch()
      showSuccess('Integration settings updated')
    } catch (error) {
      showError(getToastError(error, 'Integration settings could not be saved.'))
    } finally {
      setSaving(false)
    }
  }

  async function refreshIntegrationStatus() {
    setRefreshingStatus(true)
    try {
      await api.getIntegrationHealth()
      await bundle.refetch()
      showSuccess('Integration status refreshed')
    } catch (error) {
      showError(getToastError(error, 'Integration status could not be refreshed.'))
    } finally {
      setRefreshingStatus(false)
    }
  }

  function pollUntilBack() {
    const startedAt = Date.now()
    restartTimer.current = window.setInterval(async () => {
      if (!mounted.current) return
      if (Date.now() - startedAt > 90_000) {
        window.clearInterval(restartTimer.current ?? undefined)
        setRestartPhase('failed')
        setRestartMessage(
          'The server didn’t come back after 90 seconds. Check the process manager logs, then restart it there.',
        )
        return
      }
      try {
        await api.getIntegrationHealth()
        window.clearInterval(restartTimer.current ?? undefined)
        if (!mounted.current) return
        setRestartPhase('applied')
        showSuccess('Back online. The new credentials are active.')
        await bundle.refetch()
        window.setTimeout(() => {
          if (mounted.current) setRestartPhase('idle')
        }, 6000)
      } catch {}
    }, 2000)
  }

  async function restartNow() {
    try {
      await api.restartServer()
      setRestartPhase('restarting')
      pollUntilBack()
    } catch (error) {
      const data = (
        error as { response?: { data?: { code?: string; command?: string; message?: string } } }
      ).response?.data
      if (data?.code === 'RESTART_UNSUPPORTED') {
        setRestartMessage(
          `Restart this server yourself: ${data.command || 'use the process manager'}`,
        )
        showError('This server restarts under a supervisor.')
        return
      }
      setRestartPhase('idle')
      showError(data?.message || 'The restart could not be requested.')
    }
  }

  async function downloadHandover() {
    setDownloadingHandover(true)
    try {
      const blob = await api.downloadHandoverPack()
      const url = URL.createObjectURL(new Blob([blob], { type: 'text/markdown' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `absolutecare-handover-${new Date().toISOString().slice(0, 10)}.md`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      showError('The handover pack could not be downloaded.')
    } finally {
      setDownloadingHandover(false)
    }
  }

  async function testEmail() {
    const message = await api.sendSettingsTestEmail()
    showSuccess(message)
  }

  const integrationLabels: Record<string, string> = {
    google: 'Google sign-in',
    recaptcha: 'reCAPTCHA',
    googleCalendar: 'Google Calendar',
    email: 'Email provider',
  }

  async function testIntegration(key: string) {
    await api.testIntegration(key)
    showSuccess(`${integrationLabels[key] || 'Integration'} configuration passed`)
  }

  async function handleCredentialsSaved() {
    setCredentialGroup('')
    setRestartPhase('idle')
    showSuccess('Credentials saved. Restart the server to apply them.')
    try {
      await bundle.refetch()
    } catch {
      showError('Saved, but the page could not refresh. Reload to see it.')
    }
  }

  const openGroup = credentials?.groups?.find((group) => group.id === credentialGroup) ?? null

  return (
    <PageBody>
      <PageHeader
        eyebrow="System"
        title="Settings"
        description="Control how the clinic app behaves."
        actions={
          <div className="relative">
            <label className="relative block">
              <span className="sr-only">Search settings</span>
              <Search
                size={15}
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-faint"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search settings"
                aria-label="Search settings"
                className="h-9 w-56 rounded-md border border-hairline bg-panel pr-2.5 pl-8 text-[13px] text-ink focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              />
            </label>
            {search ? (
              <div className="absolute top-10 right-0 z-20 w-72 rounded-md border border-hairline bg-panel p-1 shadow-lg">
                {results.length ? (
                  results.map((result) => (
                    <button
                      key={result.key}
                      type="button"
                      onClick={() => {
                        setParams({ section: result.key }, { replace: true })
                        setSearch('')
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-left text-[12.5px] text-ink hover:bg-sunk"
                    >
                      <span className="font-medium">{result.label}</span>
                      <span className="text-[11px] text-ink-faint">{result.group}</span>
                    </button>
                  ))
                ) : (
                  <p className="px-2 py-1.5 text-[12px] text-ink-soft">
                    No settings match “{search}”
                  </p>
                )}
              </div>
            ) : null}
          </div>
        }
      />

      <div className="mt-6 min-w-0">
        {bundle.isLoading ? (
          <div className="grid gap-3" aria-busy="true">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-40 rounded-lg" />
            <Skeleton className="h-40 rounded-lg" />
            <p className="sr-only" role="status">
              Loading clinic settings
            </p>
          </div>
        ) : bundle.error ? (
          <EmptyState
            icon={<AlertTriangle size={20} />}
            title="We couldn’t load these settings"
            message={bundle.error.message}
            action={
              <Button type="button" onClick={() => void bundle.refetch()}>
                Try again
              </Button>
            }
          />
        ) : section === 'audit' ? (
          <AuditSection />
        ) : !draft || !settings ? null : (
          <>
            {section === 'general' ? (
              <GeneralSection
                value={draft as AdminSettings['general']}
                update={(field, next) => update(field, next)}
              />
            ) : null}
            {section === 'schedule' ? (
              <ScheduleSection
                value={draft as AdminSettings['schedule']}
                update={(field, next) => update(field, next)}
              />
            ) : null}
            {section === 'booking' ? (
              <BookingSection
                value={draft as AdminSettings['booking']}
                update={(field, next) => update(field, next)}
              />
            ) : null}
            {section === 'auth' ? (
              <AuthSection
                value={draft as AdminSettings['auth']}
                update={(field, next) => update(field, next)}
              />
            ) : null}
            {section === 'notifications' ? (
              <NotificationsSection
                value={draft as AdminSettings['notifications']}
                update={(field, next) => update(field, next)}
                onTestEmail={() =>
                  void testEmail().catch((error: Error) => showError(error.message))
                }
              />
            ) : null}
            {section === 'payments' ? (
              <PaymentsSection
                value={draft as AdminSettings['payments']}
                update={(field, next) => update(field, next)}
              />
            ) : null}
            {section === 'system' ? (
              <MaintenanceSection
                value={draft as AdminSettings['system']}
                update={(field, next) => update(field, next)}
              />
            ) : null}
            {section === 'integrations' ? (
              <IntegrationsSection
                value={draft as AdminSettings['integrations']}
                integrations={integrationFlags}
                health={health}
                saving={saving}
                credentials={credentials}
                restartPhase={restartPhase}
                restartMessage={restartMessage}
                downloadingHandover={downloadingHandover}
                refreshing={refreshingStatus}
                onCommit={commitIntegration}
                onTestEmail={testEmail}
                onTestIntegration={testIntegration}
                onRefresh={() => void refreshIntegrationStatus()}
                onEditCredentials={setCredentialGroup}
                onRestart={() => void restartNow()}
                onDismissRestart={() => {
                  setRestartPhase('idle')
                  setRestartMessage('')
                }}
                onDownloadHandover={() => void downloadHandover()}
              />
            ) : null}

            <SaveBar
              dirty={dirty}
              saving={saving}
              onSave={() => void save()}
              onDiscard={discardDraft}
            />

            {section !== 'integrations' && credentials?.restart?.required ? (
              <div className="mt-4">
                <RestartBanner
                  restart={credentials.restart}
                  phase={restartPhase}
                  message={restartMessage}
                  onRestart={() => void restartNow()}
                  onDismiss={() => {
                    setRestartPhase('idle')
                    setRestartMessage('')
                  }}
                />
              </div>
            ) : null}
          </>
        )}
      </div>

      {openGroup ? (
        <CredentialDialog
          key={openGroup.id}
          group={openGroup}
          unmanaged={credentials?.unmanaged ?? []}
          mail={credentials?.mail ?? null}
          onClose={() => setCredentialGroup('')}
          onSaved={() => void handleCredentialsSaved()}
        />
      ) : null}
    </PageBody>
  )
}
