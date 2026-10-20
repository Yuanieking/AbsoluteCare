import { useEffect, useState } from "react";
import Logo from "../brand/Logo";

function AppLoader({ caption = "Preparing your care portal..." }) {
  const [visible, setVisible] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const reveal = window.setTimeout(() => setVisible(true), 150);
    const slowHint = window.setTimeout(() => setSlow(true), 8000);
    return () => {
      window.clearTimeout(reveal);
      window.clearTimeout(slowHint);
    };
  }, []);

  return (
    <main
      className={`app-loader${visible ? " is-visible" : ""}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="app-loader-brand">
        <Logo
          className="app-loader-mark"
          variant="mark"
          tone="dark"
          size="lg"
          to={null}
        />
        <span className="app-loader-name">
          AbsoluteCare <small>Therapy Center</small>
        </span>
      </div>
      <div className="app-loader-progress" aria-hidden="true">
        <span />
      </div>
      <p>{slow ? "This is taking longer than usual..." : caption}</p>
      <span className="sr-only">Loading</span>
    </main>
  );
}

export default AppLoader;
