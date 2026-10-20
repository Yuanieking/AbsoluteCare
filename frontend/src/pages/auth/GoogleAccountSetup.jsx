import { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  Eye,
  EyeOff,
  LoaderCircle,
} from "lucide-react";
import RecaptchaField from "../../components/auth/RecaptchaField";
import {
  completeGoogleSignup,
  getApiErrorMessage,
} from "../../services/api/authApi";
import { useAuth } from "../../context/useAuth";
import Logo from "../../components/brand/Logo";

function decodeToken(token) {
  try {
    const encodedPayload = token
      .split(".")[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    return JSON.parse(window.atob(encodedPayload));
  } catch {
    return null;
  }
}

function GoogleAccountSetup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const recaptchaRef = useRef(null);
  const token = searchParams.get("token") || "";
  const profile = useMemo(() => decodeToken(token), [token]);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recaptchaToken, setRecaptchaToken] = useState(null);
  const [terms, setTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    profile ? "" : "This Google setup link is invalid or expired.",
  );
  const strength = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /\d/.test(password),
  ].filter(Boolean).length;
  const passwordMatch =
    confirmPassword.length > 0 && password === confirmPassword;

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!recaptchaToken) return setError("recaptcha");
    if (password !== confirmPassword) return setError("Passwords do not match");
    if (!terms)
      return setError("Accept the terms before creating your account.");

    setLoading(true);
    const formData = new FormData(event.currentTarget);
    try {
      const response = await completeGoogleSignup({
        token,
        firstName: formData.get("firstName"),
        lastName: formData.get("lastName"),
        password,
        confirmPassword,
        captchaToken: recaptchaToken,
        terms,
      });
      setUser(response.data?.user || null);
      navigate("/dashboard");
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
      setRecaptchaToken(null);
      recaptchaRef.current?.reset();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <header className="auth-brand">
        <Logo
          className="auth-logo"
          variant="full"
          tone="dark"
          size="md"
          to="/"
        />
        <span className="auth-location">Patient portal</span>
      </header>
      <section className="auth-card google-setup-card">
        <div className="auth-heading">
          <div className="google-avatar-wrap">
            {profile?.profilePicture ? (
              <img
                className="google-avatar"
                src={profile.profilePicture}
                alt="Google profile"
                width="64"
                height="64"
              />
            ) : (
              <span className="google-avatar-fallback">
                {profile?.firstname?.[0] || "A"}
              </span>
            )}
          </div>
          <p className="auth-eyebrow">Google account</p>
          <h1>Almost there!</h1>
          <p>Let's finish setting up your account.</p>
        </div>
        {error && error !== "recaptcha" && (
          <div className="auth-alert" role="alert" aria-live="polite">
            <CircleAlert size={16} aria-hidden="true" />
            {error}
          </div>
        )}
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-form-row">
            <label>
              First name
              <input
                name="firstName"
                type="text"
                defaultValue={profile?.firstname || ""}
                autoComplete="given-name"
                required
              />
            </label>
            <label>
              Last name
              <input
                name="lastName"
                type="text"
                defaultValue={profile?.lastname || ""}
                autoComplete="family-name"
                required
              />
            </label>
          </div>
          <label>
            Email
            <input
              name="email"
              type="email"
              value={profile?.email || ""}
              readOnly
              aria-readonly="true"
            />
          </label>
          <label>
            Password
            <div className="password-wrap">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                className="password-toggle"
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff size={17} aria-hidden="true" />
                ) : (
                  <Eye size={17} aria-hidden="true" />
                )}
              </button>
            </div>
            <span className="strength" data-strength={strength}>
              <span>Password strength</span>
              <i />
              <i />
              <i />
              <b>
                {strength === 3
                  ? "Good"
                  : strength === 2
                    ? "Almost there"
                    : "Use 8+ characters"}
              </b>
            </span>
          </label>
          <label>
            Confirm password
            <div className="password-wrap">
              <input
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
              <span
                className={`match-indicator ${passwordMatch ? "is-match" : ""}`}
              >
                {confirmPassword
                  ? passwordMatch
                    ? "Passwords match"
                    : "Passwords do not match"
                  : ""}
              </span>
            </div>
          </label>
          <RecaptchaField
            error={error}
            onChange={(value) => {
              setRecaptchaToken(value);
              setError("");
            }}
            onExpired={() => {
              setRecaptchaToken(null);
              setError("recaptcha-expired");
            }}
            onErrored={() => {
              setRecaptchaToken(null);
              setError("recaptcha");
            }}
            recaptchaRef={recaptchaRef}
          />
          <label className="terms-check">
            <input
              type="checkbox"
              checked={terms}
              onChange={(event) => setTerms(event.target.checked)}
              required
            />
            <span>I agree to the Terms & Conditions and Privacy Policy.</span>
          </label>
          <button
            className="auth-button auth-button-primary"
            type="submit"
            disabled={loading || !profile}
          >
            {loading ? (
              <>
                <LoaderCircle
                  className="button-spinner"
                  size={16}
                  aria-hidden="true"
                />
                Creating account…
              </>
            ) : (
              <>
                Complete sign up <ArrowUpRight size={17} aria-hidden="true" />
              </>
            )}
          </button>
        </form>
        <p className="auth-switch">
          <Link to="/auth?mode=login">
            <CheckCircle2 size={14} aria-hidden="true" /> Use email login
            instead
          </Link>
        </p>
      </section>
    </main>
  );
}

export default GoogleAccountSetup;
