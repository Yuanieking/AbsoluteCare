import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { CredentialField } from './CredentialField'
import { IntegrationSetupDialog } from './IntegrationSetupDialog'
import { IntegrationSetupGuide } from './IntegrationSetupGuide'
import { maskCredential } from './maskCredential'
import { IntegrationsSection } from './sections/integrations'
import type { CredentialGroup, IntegrationValues } from './types'

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))

const noop = () => {}
const group: CredentialGroup = {
  id: 'googleCalendar',
  title: 'Google Calendar',
  purpose: 'Sync appointments.',
  status: { configured: true, missing: [] },
  redirectUri: 'https://private.example/calendar/callback',
  keys: [
    {
      key: 'GOOGLE_CLIENT_ID',
      label: 'Client ID',
      kind: 'identifier',
      masked: '12345••••••••',
      source: 'env',
    },
    {
      key: 'GOOGLE_CLIENT_SECRET',
      label: 'Secret',
      kind: 'secret',
      masked: 'GOCSP••••••••',
      source: 'app',
    },
    {
      key: 'MAIL_FROM',
      label: 'Sender',
      kind: 'public',
      masked: 'private@clinic.example',
      source: 'app',
    },
    {
      key: 'GOOGLE_CALENDAR_REDIRECT_URI',
      label: 'Redirect URI',
      kind: 'config',
      masked: 'https://private.example/calendar/callback',
      source: 'env',
    },
    {
      key: 'RECAPTCHA_SITE_KEY',
      label: 'Site key',
      kind: 'public',
      masked: '6L-private-site-key',
      source: 'app',
      helper: 'Public. Browsers receive this value, so it is shown in full.',
    },
  ],
}

function expectHidden(html: string) {
  for (const entry of group.keys) expect(html).not.toContain(entry.masked)
  expect(html).not.toContain(group.redirectUri)
  expect(html).not.toContain('shown in full')
  expect(html).not.toContain('starts with')
  expect(html).toContain('••••••••')
}

describe('integration value masking', () => {
  it('previews only the first four characters and preserves missing status', () => {
    const previews = ['1234', 'GOCS', 'priv', 'http', '6L-p']
    group.keys.forEach((entry, index) => {
      expect(maskCredential(entry.masked)).toBe(`${previews[index]}••••••••`)
    })
    for (const value of [undefined, '', 'Not set']) expect(maskCredential(value)).toBe('Not set')
  })

  it.each([
    ['ab••••••••', 'ab••••••••'],
    ['••••••••', '••••••••'],
    ['a', '••••••••'],
    ['ab', 'a••••••••'],
    ['abcd', 'abc••••••••'],
    ['abcde', 'abcd••••••••'],
  ])('keeps short or already masked values safe: %s', (value, expected) => {
    expect(maskCredential(value)).toBe(expected)
  })

  it('hides saved values and keeps every replacement input password-only', () => {
    for (const entry of group.keys) {
      const html = renderToStaticMarkup(<CredentialField entry={entry} value="" onChange={noop} />)
      expect(html).not.toContain(entry.masked)
      expect(html).toContain(maskCredential(entry.masked))
      expect(html).not.toContain('starts with')
      expect(html).not.toContain('shown in full')
      expect(html).toContain('type="password"')
      expect(html).not.toContain('<button')
      expect(html).toContain('Leave blank to keep the current value')
    }
    const html = renderToStaticMarkup(
      <CredentialField
        entry={{ key: 'EMPTY', label: 'Empty', masked: 'Not set' }}
        value=""
        onChange={noop}
      />,
    )
    expect(html).toContain('Empty, not set')
  })

  it('hides values in both setup views while keeping variable names readable', () => {
    const guide = renderToStaticMarkup(
      <IntegrationSetupGuide
        groups={[group]}
        onEdit={noop}
        onDownload={noop}
        downloading={false}
      />,
    )
    const dialog = renderToStaticMarkup(
      <IntegrationSetupDialog group={group} onEdit={noop} onClose={noop} />,
    )
    expectHidden(guide)
    expectHidden(dialog)
    for (const entry of group.keys) expect(dialog).toContain(maskCredential(entry.masked))
    for (const html of [guide, dialog]) {
      for (const entry of group.keys) expect(html).toContain(entry.key)
    }
  })

  it('hides editable values repeated in integration card summaries', () => {
    const value: IntegrationValues = {
      googleAuthEnabled: true,
      recaptchaEnabled: true,
      googleCalendarEnabled: true,
      googleDriveEnabled: true,
      googleMapsEnabled: true,
      emailEnabled: true,
      reportGenerationEnabled: true,
    }
    const html = renderToStaticMarkup(
      <IntegrationsSection
        value={value}
        integrations={{}}
        health={{
          google: { configured: true, details: { clientIdMasked: group.keys[0]?.masked } },
          calendar: { configured: true, details: { redirectUri: group.redirectUri } },
          email: { configured: true, details: { senderAddress: group.keys[2]?.masked } },
        }}
        saving={false}
        credentials={{ groups: [group] }}
        restartPhase="idle"
        restartMessage=""
        downloadingHandover={false}
        refreshing={false}
        onCommit={async () => {}}
        onTestEmail={async () => {}}
        onTestIntegration={async () => {}}
        onRefresh={noop}
        onEditCredentials={noop}
        onRestart={noop}
        onDismissRestart={noop}
        onResetDefaults={noop}
        onDownloadHandover={noop}
      />,
    )
    expectHidden(html)
  })
})
