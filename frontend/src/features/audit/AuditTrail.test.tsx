import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AuditTrail } from './AuditTrail'

const state = vi.hoisted(() => ({ admin: true }))
vi.mock('@/features/auth/session', () => ({ useAuth: () => ({ user: { id: 'actor' } }) }))
vi.mock('./api', () => ({ auditDetail: vi.fn(), exportAudit: vi.fn(), listAudit: vi.fn() }))
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) =>
    queryKey[0] === 'audit-detail'
      ? {}
      : { data: { entries: [], pagination: { total: 0, pages: 1 } } },
}))
vi.mock('@/components/data-table/DataTable', () => ({ DataTable: () => <div>Audit table</div> }))

describe('Audit page', () => {
  it('renders Admin filter, export and timezone controls', () => {
    state.admin = true
    const html = renderToStaticMarkup(<AuditTrail admin />)
    for (const label of [
      'All system changes',
      'Actor name',
      'Export filtered CSV',
      'From (Manila)',
      'Through (Manila)',
      'Apply filters',
      'Audit table',
    ])
      expect(html).toContain(label)
  })
  it('keeps actor/role and export controls out of private activity views', () => {
    const html = renderToStaticMarkup(<AuditTrail />)
    expect(html).toContain('My activity')
    expect(html).not.toContain('Actor name')
    expect(html).not.toContain('Export filtered CSV')
  })
})
