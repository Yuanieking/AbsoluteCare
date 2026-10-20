import { ArrowLeft, Compass, Phone } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import Logo from "../components/brand/Logo";

const staffRoles = ["admin", "therapist", "secretary"];

function getNotFoundContext(pathname) {
  const staffRole = staffRoles.find((role) =>
    pathname.startsWith(`/staff/${role}`),
  );

  if (staffRole) {
    return {
      eyebrow: "Staff portal",
      action: "Back to staff dashboard",
      actionPath: `/staff/${staffRole}`,
      supportCopy:
        "Need help finding a staff page? Contact your clinic administrator.",
    };
  }

  if (pathname.startsWith("/staff")) {
    return {
      eyebrow: "Staff portal",
      action: "Back to staff login",
      actionPath: "/staff/login",
      supportCopy:
        "Staff accounts and access are managed by the clinic administrator.",
    };
  }

  if (pathname.startsWith("/dashboard")) {
    return {
      eyebrow: "Patient portal",
      action: "Back to dashboard",
      actionPath: "/dashboard",
      supportCopy:
        "Need help with your care? Call the clinic at 0917 715 2780.",
    };
  }

  return {
    eyebrow: "AbsoluteCare Therapy Center",
    action: "Back to home",
    actionPath: "/",
    supportCopy: "Need help finding the right page? Call 0917 715 2780.",
  };
}

function NotFoundPage() {
  const { pathname } = useLocation();
  const context = getNotFoundContext(pathname);

  return (
    <main className="not-found-page">
      <header className="not-found-header">
        <Logo variant="full" tone="dark" size="md" to="/" />
        <span className="not-found-context">{context.eyebrow}</span>
      </header>
      <section className="not-found-card" aria-labelledby="not-found-title">
        <div className="not-found-illustration" aria-hidden="true">
          <Compass size={48} strokeWidth={1.3} />
          <span>404</span>
        </div>
        <p className="not-found-eyebrow">A small wrong turn</p>
        <h1 id="not-found-title">Page not found</h1>
        <p className="not-found-copy">
          Sorry, we couldn't find the page you're looking for. It may have been
          moved, renamed, or no longer exists.
        </p>
        <div className="not-found-actions">
          <Link className="not-found-primary" to={context.actionPath}>
            <ArrowLeft size={16} aria-hidden="true" />
            {context.action}
          </Link>
          <a className="not-found-support" href="tel:09177152780">
            <Phone size={15} aria-hidden="true" />
            Contact support
          </a>
        </div>
        <p className="not-found-support-copy">{context.supportCopy}</p>
      </section>
      <p className="not-found-footer">
        Malaybalay City, Bukidnon <span>·</span> 0917 715 2780
      </p>
    </main>
  );
}

export default NotFoundPage;
