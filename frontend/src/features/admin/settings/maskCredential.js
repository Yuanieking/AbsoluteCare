export function maskCredential(value) {
  if (!value || value === 'Not set') return 'Not set'

  const [prefix = ''] = value.split('•')
  const visibleLength = value.includes('•') ? 4 : Math.min(4, value.length - 1)
  return `${prefix.slice(0, visibleLength)}••••••••`
}
