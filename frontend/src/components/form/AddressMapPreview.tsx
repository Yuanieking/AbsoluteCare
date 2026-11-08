import { ExternalLink } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { locateAddress, openStreetMapUrl, type MapPoint } from '@/lib/addressSearch'
import { cn } from '@/lib/utils'

type Result =
  | { status: 'loading' }
  | { status: 'notfound' }
  | { status: 'error' }
  | { status: 'ready'; point: MapPoint }

type AddressMapPreviewProps = {
  address: string
  location?: MapPoint
  className?: string
  mapClassName?: string
}

export function AddressMapPreview({
  address,
  location,
  className,
  mapClassName,
}: AddressMapPreviewProps) {
  const container = useRef<HTMLDivElement>(null)
  const [result, setResult] = useState<Result>({ status: 'loading' })

  useEffect(() => {
    if (location) return
    const controller = new AbortController()
    // Wait for typing to settle so the shared geocoder is not hit per keystroke.
    const timer = window.setTimeout(async () => {
      try {
        const point = await locateAddress(address, controller.signal)
        if (controller.signal.aborted) return
        setResult(point ? { status: 'ready', point } : { status: 'notfound' })
      } catch {
        if (!controller.signal.aborted) setResult({ status: 'error' })
      }
    }, 400)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [address, location])

  const point = location ?? (result.status === 'ready' ? result.point : null)

  useEffect(() => {
    if (!point) return
    let cancelled = false
    let dispose: (() => void) | undefined
    // Leaflet is only needed here, so keep it out of the main bundle.
    void Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(
      ([leaflet]) => {
        if (cancelled || !container.current) return
        const { map, tileLayer, marker, divIcon } = leaflet
        const center: [number, number] = [point.lat, point.lng]
        const instance = map(container.current, {
          center,
          zoom: 16,
          scrollWheelZoom: false,
        })
        tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(instance)
        // A CSS-drawn pin avoids Leaflet's default marker images, which
        // bundlers cannot resolve.
        marker(center, {
          keyboard: false,
          icon: divIcon({
            className: '',
            iconSize: [18, 18],
            html: '<span class="block size-[18px] rounded-full border-2 border-white bg-primary shadow-md"></span>',
          }),
        }).addTo(instance)
        dispose = () => instance.remove()
      },
    )
    return () => {
      cancelled = true
      dispose?.()
    }
  }, [point])

  return (
    <div className={cn('mt-2', className)}>
      {point ? (
        // `isolate` keeps Leaflet's high z-indexes below the suggestion list.
        <div
          ref={container}
          role="img"
          aria-label={`Map showing ${address}`}
          className={cn(
            'isolate h-40 w-full overflow-hidden rounded-md border border-hairline',
            mapClassName,
          )}
        />
      ) : null}
      {!point && result.status === 'loading' ? (
        <p role="status" className="text-[11.5px] text-ink-faint">
          Locating address...
        </p>
      ) : null}
      {!point && result.status === 'notfound' ? (
        <p role="status" className="text-[11.5px] text-ink-faint">
          This address couldn’t be found on the map.
        </p>
      ) : null}
      {!point && result.status === 'error' ? (
        <p role="status" className="text-[11.5px] text-ink-faint">
          The map couldn’t be loaded right now.
        </p>
      ) : null}
      {point ? (
        <a
          href={openStreetMapUrl(point)}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-medium text-ink-soft hover:text-ink"
        >
          <ExternalLink size={12} aria-hidden="true" />
          Open in OpenStreetMap
        </a>
      ) : null}
    </div>
  )
}
