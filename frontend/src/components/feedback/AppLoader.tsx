import { useEffect, useState } from 'react'
import Logo from '@/components/brand/Logo'

export default function AppLoader({
  caption = 'Preparing your care portal…',
}: {
  caption?: string
}) {
  const [visible, setVisible] = useState(false)
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    const reveal = window.setTimeout(() => setVisible(true), 150)
    const slowHint = window.setTimeout(() => setSlow(true), 8000)
    return () => {
      window.clearTimeout(reveal)
      window.clearTimeout(slowHint)
    }
  }, [])

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-5 bg-canvas px-6 text-ink"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className={`flex items-center gap-3 transition-opacity duration-200 ease-snap ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <Logo variant="mark" tone="dark" size="lg" to={null} className="size-11" />
        <span className="font-display text-[20px] leading-none font-semibold tracking-[-0.02em] text-ink">
          AbsoluteCare{' '}
          <small className="mt-1 block text-[10.5px] font-medium tracking-[0.02em] text-ink-faint">
            Therapy Center
          </small>
        </span>
      </div>
      <div
        aria-hidden="true"
        className={`h-0.5 w-32 overflow-hidden rounded-full bg-hairline transition-opacity duration-200 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <span className="block h-full w-1/3 animate-progress bg-primary" />
      </div>
      <p className="text-[12px] text-ink-soft">
        {slow ? 'This is taking longer than usual…' : caption}
      </p>
      <span className="sr-only">Loading</span>
    </main>
  )
}
