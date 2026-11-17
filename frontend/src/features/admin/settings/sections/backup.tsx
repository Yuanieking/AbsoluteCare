import { AlertTriangle, DatabaseBackup, Download, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getToastError, showError, showSuccess } from '@/lib/toast'
import * as api from '../api'
import { InlineNote, SettingsCard, SettingsSection } from '../fields'
import { SuperuserVerifyDialog } from '../SuperuserVerifyDialog'
import type { SettingsSectionConfig } from '../config'

const CONFIRM = 'RESTORE'

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Download every collection as one file, and put one back. Both actions need the
 * superuser code because the file contains password hashes and credential
 * ciphertext; a restore additionally needs maintenance mode switched on.
 */
export function BackupSection({ section }: { section: SettingsSectionConfig }) {
  const [verifying, setVerifying] = useState<'exportBackup' | 'restoreBackup' | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [confirmation, setConfirmation] = useState('')
  const [restoring, setRestoring] = useState(false)
  const filePicker = useRef<HTMLInputElement>(null)

  async function runExport(token: string) {
    const blob = await api.downloadBackup(token)
    saveBlob(blob, `absolutecare-backup-${new Date().toISOString().slice(0, 10)}.json`)
    showSuccess('Backup downloaded')
  }

  async function runRestore(token: string, upload: File) {
    setRestoring(true)
    try {
      const result = await api.restoreBackup(upload, token, confirmation)
      showSuccess(result.message)
      window.location.assign('/staff/login')
      setFile(null)
      setConfirmation('')
    } finally {
      setRestoring(false)
    }
  }

  return (
    <SettingsSection section={section}>
      <SettingsCard
        title="Download a backup"
        description="Every collection in one JSON file, including credential material."
      >
        <div className="grid gap-3 px-5 py-4">
          <p className="text-[12.5px] text-ink-soft">
            The file holds password hashes and encrypted integration credentials, so it needs the
            superuser password and an emailed code. Store it somewhere as sensitive as the database
            itself.
          </p>
          <div>
            <Button type="button" variant="outline" onClick={() => setVerifying('exportBackup')}>
              <Download size={14} aria-hidden="true" /> Download backup
            </Button>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Restore from a backup"
        description="Replaces the database with the contents of the file. Nothing is merged."
      >
        <div className="grid gap-3 px-5 py-4">
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-destructive" aria-hidden="true" />
            <p className="text-[12.5px] text-ink-soft">
              Documents are replaced atomically; failures roll back the replacement.
              Enable <strong className="text-ink">Maintenance mode</strong> first; it stays on
              afterward so you can verify the data. Requires a MongoDB replica set or sharded
              cluster. Sign in with a restored administrator after recovery.
            </p>
          </div>

          <input
            ref={filePicker}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="Backup file"
            onChange={(event) => {
              const next = event.target.files?.[0] ?? null
              if (next && next.size > 32 * 1024 * 1024) {
                showError('Choose a backup no larger than 32 MiB.')
                setFile(null)
              } else setFile(next)
              setConfirmation('')
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => filePicker.current?.click()}>
              <Upload size={14} aria-hidden="true" /> Choose file
            </Button>
            <span className="text-[12.5px] text-ink-soft">{file?.name ?? 'No file chosen'}</span>
          </div>

          {file ? (
            <>
              <label className="grid gap-1.5 text-[12.5px] text-ink-soft">
                Type <strong className="text-ink">{CONFIRM}</strong> to confirm the replacement.
                <Input
                  value={confirmation}
                  aria-label="Type RESTORE to confirm"
                  placeholder={CONFIRM}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </label>
              <div>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={confirmation !== CONFIRM || restoring}
                  onClick={() => setVerifying('restoreBackup')}
                >
                  <DatabaseBackup size={14} aria-hidden="true" />
                  {restoring ? 'Restoring…' : 'Restore this backup'}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </SettingsCard>

      <InlineNote>
        Includes all database collections, password hashes, and credential ciphertext (32 MiB max).
        Server environment values and external Drive files are separate: retain your server .env
        and encryption keys, including CREDENTIAL_ENCRYPTION_KEY, GOOGLE_CALENDAR_ENCRYPTION_KEY,
        and JWT_SECRET as configured.
      </InlineNote>

      {verifying ? (
        <SuperuserVerifyDialog
          action={verifying}
          title={verifying === 'exportBackup' ? 'Download a backup' : 'Restore from a backup'}
          description={
            verifying === 'exportBackup'
              ? 'Download every collection, credentials included.'
              : 'Replace the whole database with the uploaded file.'
          }
          onClose={() => setVerifying(null)}
          onVerified={async (token) => {
            const upload = file
            setVerifying(null)
            try {
              if (verifying === 'exportBackup') await runExport(token)
              else if (upload) await runRestore(token, upload)
            } catch (error) {
              showError(getToastError(error, 'The backup action could not be completed.'))
            }
          }}
        />
      ) : null}
    </SettingsSection>
  )
}
