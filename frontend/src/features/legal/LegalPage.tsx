import { Link } from 'react-router-dom'

export default function LegalPage({ privacy = false }: { privacy?: boolean }) {
  const title = privacy ? 'Privacy Policy' : 'Terms and Conditions'

  return (
    <main className="flex min-h-screen flex-col bg-canvas px-4 py-10 text-ink sm:px-6">
      <section className="mx-auto w-full max-w-[640px] border border-hairline bg-panel p-8 shadow-[0_24px_60px_rgba(38,81,67,0.08)] sm:p-12">
        <p className="text-[11.5px] font-medium text-eyebrow">AbsoluteCare Therapy Center</p>
        <h1 className="mt-4 font-display text-[34px] leading-none font-semibold tracking-[-0.03em]">
          {title}
        </h1>
        <div className="mt-6 grid gap-4 text-[13.5px] leading-relaxed text-ink-soft">
          <p>
            These terms describe how AbsoluteCare uses this scheduling portal to coordinate therapy
            care, appointments, and account access.
          </p>
          <h2 className="mt-4 font-display text-[22px] font-semibold tracking-[-0.015em] text-ink">
            Using the portal
          </h2>
          <p>
            Provide accurate information, keep your login details private, and contact the clinic
            when an appointment or account detail needs correction.
          </p>
          <h2 className="mt-4 font-display text-[22px] font-semibold tracking-[-0.015em] text-ink">
            Your information
          </h2>
          <p>
            We use submitted information to provide therapy scheduling and care coordination. We do
            not sell personal information.
          </p>
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
