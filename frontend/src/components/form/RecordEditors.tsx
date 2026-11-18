import { useEffect, useState } from 'react'
import client, { pinRecordTimestamp } from '@/lib/api/client'

type Editor = { userId: string; name: string; lastSeenAt: string }
type Kind = 'users' | 'dependents' | 'appointments' | 'sessions' | 'services' | 'settings'

export function RecordEditors({ kind, record, id, active = true, resetKey = 0, timestamp }: {
  kind: Kind
  record?: { _id?: string; id?: string; updatedAt?: unknown } | null
  resetKey?: number
  timestamp?: string
  id?: string | null
  active?: boolean
}) {
  const recordId = id || record?._id || record?.id
  const [editors, setEditors] = useState<Editor[]>([])
  const [stale, setStale] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  useEffect(() => {
    if (!active || !recordId) return
    const unpin = pinRecordTimestamp(kind === 'settings' ? 'settings' : recordId,
      timestamp || (typeof record?.updatedAt === 'string' ? record.updatedAt : undefined))
    const sessionId = crypto.randomUUID()
    const url = `/record-editors/${kind}/${recordId}`
    let stopped = false
    const heartbeat = async () => {
      try {
        const response = await client.put(url, { sessionId })
        if (!stopped) { setEditors(response.data.activeEditors); setUnavailable(false) }
      } catch { if (!stopped) setUnavailable(true) }
    }
    const conflict = (event: Event) => {
      const path = String((event as CustomEvent).detail || '')
      if ((kind === 'settings' && path.includes('/settings/')) || path.includes(recordId) ||
        (kind === 'users' && /^\/(?:auth\/(?:profile|notification-preferences)|therapist\/(?:profile|availability)|secretary\/profile)$/.test(path))) setStale(true)
    }
    window.addEventListener('record:stale', conflict)
    void heartbeat()
    const timer = window.setInterval(() => void heartbeat(), 15_000)
    return () => {
      stopped = true
      unpin()
      window.clearInterval(timer)
      window.removeEventListener('record:stale', conflict)
      void client.delete(url, { data: { sessionId } }).catch(() => undefined)
    }
    // The original snapshot must not change when background queries replace record props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, kind, recordId, resetKey])
  if (!active || !recordId) return null
  return <div className="col-span-full grid gap-1 rounded-md border border-hairline bg-sunk p-2 text-xs" aria-live="polite">
    <p>{unavailable ? 'Editor presence is unavailable. Save protection remains active.' : `Editing: ${editors.map((editor) => editor.name).join(', ') || 'Connecting…'}`}</p>
    {stale ? <p role="alert" className="text-destructive">This record changed. Your input is preserved. Copy your changes, close and reopen the editor, then review the latest record before saving.</p> : null}
  </div>
}
