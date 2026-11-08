import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import LandingPage from './LandingPage'

const state = vi.hoisted(() => ({ mapsEnabled: true }))

vi.mock('@/features/auth/session', () => ({
  useAuth: () => ({ user: null, loading: false }),
}))
vi.mock('@/features/settings/provider', () => ({
  useSettings: () => ({ settings: { googleMapsEnabled: state.mapsEnabled } }),
}))
vi.mock('./HeroRoom', () => ({ HeroRoom: () => null }))

function renderVisitSection() {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  )
  return html.slice(html.indexOf('<section id="visit"'), html.indexOf('</main>'))
}

describe('Landing page clinic map', () => {
  it('Uses the shared map at the existing clinic location when enabled', () => {
    state.mapsEnabled = true
    const html = renderVisitSection()
    expect(html).toContain('Map showing 2nd Door, Pinehills Hotel Compound')
    expect(html).toContain('mlat=8.159799091870852')
    expect(html).toContain('mlon=125.12060707526672')
    expect(html).toContain('Open in OpenStreetMap')
    expect(html).not.toContain('Locating address...')
    expect(html).not.toContain('google.com/maps/embed')
  })

  it('Keeps directions readable without a map when the integration is disabled', () => {
    state.mapsEnabled = false
    const html = renderVisitSection()
    expect(html).toContain('Find the clinic')
    expect(html).toContain('Pinehills Hotel Compound')
    expect(html).toContain('Call the clinic if you need help with directions.')
    expect(html).not.toContain('role="img"')
    expect(html).not.toContain('openstreetmap.org')
    expect(html).not.toContain('<iframe')
  })
})
