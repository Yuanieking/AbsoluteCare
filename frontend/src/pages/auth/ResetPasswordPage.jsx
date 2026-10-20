import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowUpRight, CheckCircle2, CircleAlert } from "lucide-react";
import { resetPassword } from "../../services/api/authApi";
import { getToastError, showError, showSuccess } from "../../utils/toast";
import Logo from "../../components/brand/Logo";

function ResetPasswordPage({ staff = false }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [complete, setComplete] = useState(false);
  const token = searchParams.get("token") || "";

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (password.length < 8)
      return setError("Password must be at least 8 characters.");
    if (password !== confirmPassword)
      return setError("Passwords do not match.");
    setSaving(true);
    try {
      await resetPassword({ token, password });
      setComplete(true);
      showSuccess("Password updated. You can now log in.");
      window.setTimeout(() => navigate(staff ? "/staff/login" : "/login"), 900);
    } catch (requestError) {
      const message = getToastError(
        requestError,
        "This reset link is invalid or expired.",
      );
      setError(message);
      showError(message);
    } finally {
      setSaving(false);
      setPassword("");
      setConfirmPassword("");
    }
  }

  return (
    <main className={staff ? "staff-auth-page" : "auth-page"}>
      <header className={staff ? "staff-auth-header" : "auth-brand"}>
        <Logo
          className="auth-logo"
          variant="full"
          tone={staff ? "light" : "dark"}
          size="md"
          to="/"
        />
      </header>
      <section className={staff ? "staff-auth-card" : "auth-card"}>
        {complete ? (
          <div className="auth-success">
            <CheckCircle2 className="success-check" aria-hidden="true" />
            <h1>Password updated</h1>
            <p>Your password has been changed successfully.</p>
          </div>
        ) : (
          <>
            <div className="auth-heading">
              <p className="auth-eyebrow">AbsoluteCare secure account access</p>
              <h1>Choose a new password</h1>
              <p>Use at least 8 characters, then confirm it below.</p>
            </div>
            {error && (
              <div className="auth-alert" role="alert">
                <CircleAlert size={16} />
                {error}
              </div>
            )}
            <form className="auth-form" onSubmit={submit}>
              <label>
                New password
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>
              <label>
                Confirm password
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
              </label>
              <button
                className="auth-button auth-button-primary"
                type="submit"
                disabled={saving || !token}
              >
                {saving ? "Updating…" : "Update password"}{" "}
                <ArrowUpRight size={17} />
              </button>
            </form>
            {!token && (
              <p className="auth-alert">
                Request a new reset link to continue.
              </p>
            )}
          </>
        )}
      </section>
    </main>
  );
}

export default ResetPasswordPage;
