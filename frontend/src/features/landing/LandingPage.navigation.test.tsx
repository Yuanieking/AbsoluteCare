import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LandingPage from './LandingPage'

const state = vi.hoisted(() => ({
  loading: false,
  user: null as { role: string } | null,
}))

vi.mock('@/features/auth/session', () => ({ useAuth: () => state }))
vi.mock('@/features/settings/provider', () => ({
  useSettings: () => ({ settings: { googleMapsEnabled: false } }),
}))
vi.mock('@/components/feedback/AppLoader', () => ({
  default: () => <p role="status">Loading your account…</p>,
}))

function renderPage() {
  return renderToStaticMarkup(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  state.loading = false
  state.user = null
})

describe('Landing page navigation', () => {
  it('Provides an existing target for every in-page link', () => {
    const html = renderPage()
    const targets = [...html.matchAll(/href="#([^"]+)"/g)].map((match) => match[1])
    expect(targets.length).toBeGreaterThan(5)
    for (const target of targets) expect(html).toContain(`id="${target}"`)
  })

  it('Keeps booking and account actions on the existing routes', () => {
    const html = renderPage()
    expect(html).toContain('href="/signup"')
    expect(html).toContain('href="/login"')
    expect(html).toContain('href="/privacy"')
    expect(html).toContain('href="/terms"')
    expect(html).not.toContain('href="#"')
  })

  it('Provides a closed, labelled mobile navigation disclosure', () => {
    const html = renderPage()
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-controls="care-mobile-nav"')
    expect(html).toMatch(/id="care-mobile-nav"[^>]*hidden=""/)
  })

  it('Keeps phone links actionable and uses the original clinic coordinates', () => {
    const html = renderPage()
    expect(html).toContain('href="tel:+639177152780"')
    expect(html).toContain('href="tel:+639356594143"')
    expect(html).toContain('destination=8.159799091870852,125.12060707526672')
  })

  it('Shows the account loader before displaying public content', () => {
    state.loading = true
    const html = renderPage()
    expect(html).toContain('Loading your account…')
    expect(html).not.toContain('care-hero')
  })

  it.each(['admin', 'therapist', 'secretary', 'patient'])(
    'Does not render the public landing page for a signed-in %s',
    (role) => {
      state.user = { role }
      expect(renderPage()).not.toContain('care-hero')
    },
  )
})
