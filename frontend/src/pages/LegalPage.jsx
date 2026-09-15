import { Link } from "react-router-dom";

function LegalPage({ privacy = false }) {
  const title = privacy ? "Privacy Policy" : "Terms and Conditions";
  return (
    <main className="auth-page">
      <section className="auth-card legal-page">
        <p className="auth-eyebrow">AbsoluteCare Therapy Center</p>
        <h1>{title}</h1>
        <p>
          These placeholder terms describe how AbsoluteCare uses this scheduling
          portal to coordinate therapy care, appointments, and account access.
        </p>
        <h2>Using the portal</h2>
        <p>
          Provide accurate information, keep your login details private, and
          contact the clinic when an appointment or account detail needs
          correction.
        </p>
        <h2>Your information</h2>
        <p>
          We use submitted information to provide therapy scheduling and care
          coordination. We do not sell personal information.
        </p>
        <Link className="auth-button auth-button-primary" to="/signup">
          Back to sign up
        </Link>
      </section>
    </main>
  );
}

export default LegalPage;
