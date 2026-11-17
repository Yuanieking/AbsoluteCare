export function maskCredential(value?: string) {
  return value && value !== 'Not set' ? '••••••••' : 'Not set'
}
