import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import Logo from '@/components/brand/Logo'
import { Button } from '@/components/ui/button'

export default function RouteErrorBoundary() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? error.statusText || `Request failed with status ${error.status}.`
    : error instanceof Error
      ? error.message
      : 'This page could not be loaded.'

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-6 text-ink">
      <section className="w-full max-w-md rounded-lg border border-hairline bg-panel p-8">
        <Logo variant="mark" tone="dark" size="md" to="/" />
        <h1 className="mt-5 font-display text-[22px] leading-[1.25] font-semibold tracking-[-0.015em] text-ink">
          That page needs another look.
        </h1>
        <p className="mt-2 text-[13px] text-ink-soft">{message}</p>
        <Button type="button" className="mt-5" onClick={() => window.location.reload()}>
          Reload page
        </Button>
      </section>
    </main>
  )
}
