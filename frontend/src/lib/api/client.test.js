import { beforeEach, describe, expect, it, vi } from 'vitest'
import client, { pinRecordTimestamp } from './client'

vi.mock('@/lib/toast', () => ({ showError: vi.fn() }))
const id = '111111111111111111111111'
const original = '2026-01-01T00:00:00.000Z'
const newer = '2026-01-02T00:00:00.000Z'

describe('Record edit snapshots', () => {
  beforeEach(() => {
    client.defaults.adapter = async (config) => ({
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: config.method === 'get' ? { record: { _id: id, updatedAt: newer } } : {},
    })
  })
  it('keeps the original precondition after a background refresh and protects POST record actions', async () => {
    const unpin = pinRecordTimestamp(id, original)
    try {
      await client.get(`/appointments/${id}`)
      const response = await client.post(`/appointments/${id}/cancel`)
      expect(response.config.headers.get('If-Match')).toBe(`"${original}"`)
      const heartbeat = await client.put(`/record-editors/appointments/${id}`, {})
      expect(heartbeat.config.headers.get('If-Match')).toBeUndefined()
    } finally {
      unpin()
    }
    const latest = await client.patch(`/appointments/${id}`)
    expect(latest.config.headers.get('If-Match')).toBe(`"${newer}"`)
  })
  it('never replaces an explicitly supplied form timestamp', async () => {
    const response = await client.patch(
      `/appointments/${id}`,
      {},
      { headers: { 'If-Match': `"${original}"` } },
    )
    expect(response.config.headers.get('If-Match')).toBe(`"${original}"`)
  })
})
