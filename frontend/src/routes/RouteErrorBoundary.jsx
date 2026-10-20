import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import Logo from "../components/brand/Logo";

export default function RouteErrorBoundary() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? error.statusText || `Request failed with status ${error.status}.`
    : error instanceof Error
      ? error.message
      : "This page could not be loaded.";

  return (
    <main className="route-error-page">
      <section className="route-error-panel">
        <Logo variant="mark" tone="dark" size="md" to="/" />
        <h1>That page needs another look.</h1>
        <p>{message}</p>
        <button type="button" onClick={() => window.location.reload()}>
          Reload page
        </button>
      </section>
    </main>
  );
}
