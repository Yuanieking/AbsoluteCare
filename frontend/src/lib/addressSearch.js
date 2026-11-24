// Keyless address search on the public Photon geocoder (OpenStreetMap data).
// Photon is a shared server with a fair-use policy, so callers must debounce.
const PHOTON_URL = 'https://photon.komoot.io/api/'

// Philippine clinic: restrict results to the country (west,south,east,north).
const PHILIPPINES_BBOX = '116.9,4.5,126.7,21.3'
const TIMEOUT_MS = 8000

function labelFor(properties) {
  const street = [properties.housenumber, properties.street].filter(Boolean).join(' ')
  const parts = [
    properties.name,
    street,
    properties.district,
    properties.city,
    properties.state,
    properties.postcode,
    properties.country,
  ]
  const seen = new Set()
  return parts
    .filter((part) => {
      if (!part || seen.has(part)) return false
      seen.add(part)
      return true
    })
    .join(', ')
}

export async function searchAddresses(query, signal, limit = 5) {
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  const response = await fetch(
    `${PHOTON_URL}?${new URLSearchParams({
      q: query,
      limit: String(limit),
      lang: 'en',
      bbox: PHILIPPINES_BBOX,
    })}`,
    { signal: signal ? AbortSignal.any([signal, timeout]) : timeout },
  )
  if (!response.ok) throw new Error('Address search is unavailable.')
  const body = await response.json()
  const seen = new Set()
  const results = []
  for (const feature of body.features ?? []) {
    const coordinates = feature.geometry?.coordinates
    const label = labelFor(feature.properties ?? {})
    if (!coordinates || !label || seen.has(label)) continue
    seen.add(label)
    results.push({ label, point: { lat: coordinates[1], lng: coordinates[0] } })
  }
  return results
}

const locations = new Map()

/** Lets a chosen suggestion skip the lookup the map preview would repeat. */
export function rememberLocation(address, point) {
  locations.set(address, point)
}

/** Resolves a free-text address to a point; results are cached per page. */
export async function locateAddress(address, signal) {
  const cached = locations.get(address)
  if (cached !== undefined) return cached
  const [first] = await searchAddresses(address, signal, 1)
  const point = first?.point ?? null
  locations.set(address, point)
  return point
}

export function openStreetMapUrl({ lat, lng }) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`
}
