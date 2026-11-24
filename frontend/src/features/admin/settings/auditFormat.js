function formatLeaf(value) {
  if (value === true) return 'On'
  if (value === false) return 'Off'
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

function flatten(value, prefix, out) {
  if (value !== null && typeof value === 'object') {
    const entries = Array.isArray(value)
      ? [[prefix, value.map((item) => formatLeaf(item)).join(', ')]]
      : Object.entries(value).map(([key, child]) => [prefix ? `${prefix} · ${key}` : key, child])
    for (const [path, child] of entries) {
      if (Array.isArray(value)) out.set(path, child)
      else flatten(child, path, out)
    }
    return out
  }
  out.set(prefix, value)
  return out
}

/**
 * Human-readable before → after lines for a settings change. Nested values such
 * as role permissions are diffed leaf by leaf instead of printing "[object Object]".
 */
export function describeChange(oldValue, newValue, limit = 6) {
  // Masked credentials can look identical before and after; always show plain values as-is.
  const isPlain = (value) => value === null || typeof value !== 'object'
  if (isPlain(oldValue) && isPlain(newValue))
    return [`${formatLeaf(oldValue)} → ${formatLeaf(newValue)}`]
  const before = flatten(oldValue, '', new Map())
  const after = flatten(newValue, '', new Map())
  const paths = [...new Set([...before.keys(), ...after.keys()])]
  const changed = paths.filter(
    (path) => formatLeaf(before.get(path)) !== formatLeaf(after.get(path)),
  )
  if (!changed.length) return ['No visible change']
  const lines = changed
    .slice(0, limit)
    .map(
      (path) =>
        `${path ? `${path}: ` : ''}${formatLeaf(before.get(path))} → ${formatLeaf(after.get(path))}`,
    )
  if (changed.length > limit) lines.push(`and ${changed.length - limit} more`)
  return lines
}
