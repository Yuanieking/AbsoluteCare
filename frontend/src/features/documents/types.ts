export type DocumentType = 'clinic_report' | 'patient_summary' | 'visit_record' | 'receipt'
export type DriveStatus = 'pending' | 'uploaded' | 'failed'
export type DocumentStatus = 'issued' | 'superseded' | 'revoked'

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  clinic_report: 'Clinic activity report',
  patient_summary: 'Patient therapy summary',
  visit_record: 'Visit record',
  receipt: 'Payment receipt',
}

export type GeneratedDocument = {
  id: string
  trackingNumber: string
  type: DocumentType
  title: string
  subject: string
  status: DocumentStatus
  issuedAt: string
  generatedBy: { name: string; role: string }
  sizeBytes: number
  sha256: string
  drive: {
    status: DriveStatus
    webViewLink: string
    attempts: number
    lastError: string
  }
  verifyUrl: string
}

export type DocumentList = {
  documents: GeneratedDocument[]
  pagination: { page: number; pages: number; total: number }
}

export type VerifyResult = {
  status: 'valid' | 'superseded' | 'revoked' | 'not_found'
  documentType?: DocumentType
  documentLabel?: string
  trackingNumber?: string
  issuedAt?: string
  clinicName?: string
  supersededBy?: string
  supersededAt?: string
  revokedAt?: string
}
