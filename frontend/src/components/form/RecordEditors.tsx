import { useEffect, useState } from 'react'
import client, { editorSessionId, pinRecordTimestamp } from '@/lib/api/client'

type Editor = { userId: string; name: string; lastSeenAt: string }
type Kind = 'users' | 'dependents' | 'appointments' | 'sessions' | 'services' | 'settings'
type Presence = { key: string; editors: Editor[]; lockedBy: string | null; unavailable: boolean }

// Several editors for one record in the same tab share the lock; only the last unmount releases it.
const mounts = new Map<string, number>()

export function RecordEditors({ kind, record, id, active = true, resetKey = 0, timestamp }: {
  kind: Kind
  record?: { _id?: string; id?: string; updatedAt?: unknown } | null
  resetKey?: number
  timestamp?: string
  id?: string | null
  active?: boolean
}) {
  const recordId = id || record?._id || record?.id
  const url = `/record-editors/${kind}/${recordId}`
  const key = `${url}#${resetKey}`
  const [presence, setPresence] = useState<Presence | null>(null)
  const [handedOver, setHandedOver] = useState(false)
  const [stale, setStale] = useState(false)
  useEffect(() => {
    if (!active || !recordId) return
    const unpin = pinRecordTimestamp(kind === 'settings' ? 'settings' : recordId,
      timestamp || (typeof record?.updatedAt === 'string' ? record.updatedAt : undefined))
    mounts.set(url, (mounts.get(url) || 0) + 1)
    let stopped = false
    let locked = false
    let timer = 0
    const heartbeat = async () => {
      try {
        const response = await client.put(url, { sessionId: editorSessionId })
        if (stopped) return
        const lockedBy: string | null = response.data.lockedBy?.name ?? null
        if (locked && !lockedBy) setHandedOver(true)
        locked = Boolean(lockedBy)
        setPresence({ key, editors: response.data.activeEditors, lockedBy, unavailable: false })
      } catch {
        // Presence down: clear the warning; the server still rejects writes while another tab holds the lock.
        if (!stopped) setPresence({ key, editors: [], lockedBy: null, unavailable: true })
      } finally {
        // Waiting editors poll faster so the lock hands over within seconds of the holder leaving.
        if (!stopped) timer = window.setTimeout(() => void heartbeat(), locked ? 3_000 : 15_000)
      }
    }
    const conflict = (event: Event) => {
      const path = String((event as CustomEvent).detail || '')
      if ((kind === 'settings' && path.includes('/settings/')) || path.includes(recordId) ||
        (kind === 'users' && /^\/(?:auth\/(?:profile|notification-preferences)|therapist\/(?:profile|availability)|secretary\/profile)$/.test(path))) setStale(true)
    }
    window.addEventListener('record:stale', conflict)
    void heartbeat()
    return () => {
      stopped = true
      unpin()
      window.clearTimeout(timer)
      window.removeEventListener('record:stale', conflict)
      const left = (mounts.get(url) || 1) - 1
      if (left) mounts.set(url, left)
      else {
        mounts.delete(url)
        void client.delete(url, { data: { sessionId: editorSessionId } }).catch(() => undefined)
      }
    }
    // The original snapshot must not change when background queries replace record props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, kind, recordId, resetKey])

  const current = presence?.key === key ? presence : null
  if (!active || !recordId) return null
  const names = current?.editors.map((editor) => editor.name).join(', ')
  return <div className="col-span-full grid gap-1 rounded-md border border-hairline bg-sunk p-2 text-xs" aria-live="polite">
    {current?.lockedBy
      ? <p role="status" className="font-medium text-destructive">{current.lockedBy} is editing this record. You can type, but you cannot save until they finish.</p>
      : <p>{current?.unavailable ? 'Editor presence is unavailable. Save protection remains active.' : current ? `Editing: ${names || 'You'}` : 'Checking who is editing…'}</p>}
    {handedOver && !current?.lockedBy ? <p className="text-ink">The other editor finished. You can save now; review the latest details before saving.</p> : null}
    {stale ? <p role="alert" className="text-destructive">This record changed. Your input is preserved. Copy your changes, close and reopen the editor, then review the latest record before saving.</p> : null}
  </div>
}
