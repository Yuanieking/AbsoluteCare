import { Link } from 'react-router-dom'
import { LegalContent } from './LegalContent'

export default function LegalPage({ privacy = false }: { privacy?: boolean }) {
  const title = privacy ? 'Privacy Policy' : 'Terms and Conditions'

  return (
    <main className="flex min-h-screen flex-col bg-canvas px-4 py-10 text-ink sm:px-6">
      <section className="mx-auto w-full max-w-[640px] border border-hairline bg-panel p-8 shadow-[0_24px_60px_rgba(38,81,67,0.08)] sm:p-12">
        <p className="text-[11.5px] font-medium text-eyebrow">AbsoluteCare Therapy Center</p>
        <h1 className="mt-4 font-display text-[34px] leading-none font-semibold tracking-[-0.03em]">
          {title}
        </h1>
        <div className="mt-6">
          <LegalContent />
        </div>
        <Link
          className="mt-8 inline-flex h-10 items-center bg-primary px-5 text-[13px] font-bold text-panel transition-colors hover:bg-primary-strong"
          to="/signup"
        >
          Back to sign up
        </Link>
      </section>
    </main>
  )
}
