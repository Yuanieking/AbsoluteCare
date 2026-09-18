import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CircleAlert, LoaderCircle } from "lucide-react";
import {
  getApiErrorMessage,
  getGoogleSession,
} from "../../services/api/authApi";
import { useAuth } from "../../context/useAuth";

function GoogleAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const token = searchParams.get("token");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      return;
    }

    getGoogleSession(token)
      .then((response) => {
        setUser(response.data?.user || null);
        navigate("/dashboard", { replace: true });
      })
      .catch((requestError) => setError(getApiErrorMessage(requestError)));
  }, [navigate, setUser, token]);

  const displayError =
    error || (!token && "Google sign-in did not return a valid session.");

  return (
    <main className="auth-page">
      <section className="auth-card google-callback-card">
        {displayError ? (
          <div className="auth-success">
            <CircleAlert
              className="google-callback-error"
              size={43}
              aria-hidden="true"
            />
            <h1>Sign-in could not finish</h1>
            <p>{displayError}</p>
            <Link
              className="auth-button auth-button-primary"
              to="/auth?mode=login"
            >
              Back to log in
            </Link>
          </div>
        ) : (
          <div className="auth-success">
            <LoaderCircle
              className="google-callback-loader"
              size={42}
              aria-hidden="true"
            />
            <h1>Signing you in</h1>
            <p>We’re securely finishing your Google sign-in.</p>
          </div>
        )}
      </section>
    </main>
  );
}

export default GoogleAuthCallback;
