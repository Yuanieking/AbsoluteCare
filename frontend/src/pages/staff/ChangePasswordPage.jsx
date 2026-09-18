import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { changePassword } from "../../services/api/authApi";
import { getToastError, showError, showSuccess } from "../../utils/toast";
import { useAuth } from "../../context/useAuth";

function ChangePasswordPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (password.length < 8)
      return setError("Password must be at least 8 characters.");
    if (password !== confirmPassword)
      return setError("Passwords do not match.");
    setSaving(true);
    try {
      const response = await changePassword({ password, confirmPassword });
      setUser(response.data.user);
      showSuccess("Password changed successfully.");
      navigate(
        user?.role === "admin"
          ? "/staff/admin"
          : `/staff/${user?.role || "therapist"}`,
        { replace: true },
      );
    } catch (requestError) {
      const message = getToastError(requestError, "Unable to change password.");
      setError(message);
      showError(message);
    } finally {
      setSaving(false);
      setPassword("");
      setConfirmPassword("");
    }
  }

  return (
    <main className="staff-auth-page">
      <section className="staff-auth-card">
        <div className="staff-heading">
          <p className="staff-eyebrow">First login</p>
          <h1>Change your password</h1>
          <p>Choose a private password before entering the staff portal.</p>
        </div>
        {error && (
          <p className="staff-alert" role="alert">
            {error}
          </p>
        )}
        <form className="staff-form" onSubmit={submit}>
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
            className="staff-primary-button"
            type="submit"
            disabled={saving}
          >
            {saving ? "Saving…" : "Continue"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default ChangePasswordPage;
