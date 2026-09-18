import { useRef, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { FcGoogle } from "react-icons/fc";
import {
  authenticate,
  getApiErrorMessage,
  getGoogleAuthUrl,
  requestPasswordReset,
} from "../../services/api/authApi";
import {
  isValidEmail,
  isValidPhone,
  sanitizePhone,
  EMAIL_ERROR,
  PHONE_ERROR,
} from "../../utils/validators";
import RecaptchaField from "../../components/auth/RecaptchaField";
import Logo from "../../components/brand/Logo";
import { authModes, getAuthMode } from "../../config/authConfig";
import {
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  Dot,
  Eye,
  EyeOff,
  LoaderCircle,
} from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { useSettings } from "../../context/useSettings";
import { useRecaptcha } from "../../hooks/useRecaptcha";

function Auth() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();
  const { settings, loading: settingsLoading, refreshSettings } = useSettings();
  const currentMode = getAuthMode(window.location.pathname, searchParams);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const recaptchaRef = useRef(null);
  const recaptcha = useRecaptcha({
    enabled: settings.recaptchaEnabled,
    siteKey: settings.recaptchaSiteKey,
    recaptchaRef,
  });

  const strength = [
    password.length >= settings.passwordMinLength,
    /[A-Z]/.test(password),
    /\d/.test(password),
  ].filter(Boolean).length;
  const passwordMatch =
    confirmPassword.length > 0 && password === confirmPassword;

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (currentMode === "forgot") {
      const email = new FormData(event.currentTarget).get("email");
      if (!isValidEmail(email)) {
        setError(EMAIL_ERROR);
        return;
      }
      if (recaptcha.enabled && !recaptcha.token) {
        setError("recaptcha");
        return;
      }
      setLoading(true);
      try {
        await requestPasswordReset(
          email,
          recaptcha.enabled ? recaptcha.token : undefined,
        );
        setSubmitted(true);
      } catch (requestError) {
        setError(getApiErrorMessage(requestError));
      } finally {
        setLoading(false);
      }
      return;
    }
    const formData = new FormData(event.currentTarget);
    if (!isValidEmail(formData.get("email"))) {
      setError(EMAIL_ERROR);
      setPassword("");
      setConfirmPassword("");
      return;
    }
    if (
      currentMode === "signup" &&
      formData.get("phone") &&
      !isValidPhone(formData.get("phone"))
    ) {
      setError(PHONE_ERROR);
      return;
    }
    if (currentMode === "signup" && !terms) {
      setError("You must agree to continue.");
      return;
    }
    if (recaptcha.enabled && !recaptcha.token) {
      setError("recaptcha");
      return;
    }
    if (currentMode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    const payload = {
      email: formData.get("email"),
      password: formData.get("password"),
    };
    if (recaptcha.enabled) payload.recaptchaToken = recaptcha.token;
    if (currentMode === "signup") {
      payload.firstName = formData.get("firstName");
      payload.lastName = formData.get("lastName");
      payload.confirmPassword = formData.get("confirmPassword");
      payload.phone = formData.get("phone");
      payload.acceptedTerms = terms;
    }
    try {
      const response = await authenticate(currentMode, payload);
      if (currentMode === "login") {
        setUser(response.data?.user || null);
        setPassword("");
        setConfirmPassword("");
        setShowPassword(false);
        navigate(location.state?.from || "/dashboard", { replace: true });
        return;
      }
      setSubmitted(true);
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      recaptcha.reset();
      if (
        ["RECAPTCHA_FAILED", "RECAPTCHA_UNAVAILABLE"].includes(
          requestError.response?.data?.code,
        )
      ) {
        void refreshSettings();
      }
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode) {
    setSubmitted(false);
    setError("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setTerms(false);
    navigate(`/auth?mode=${nextMode}`);
  }

  if (submitted && currentMode === "forgot") {
    return (
      <AuthShell>
        <div className="auth-success">
          <CheckCircle2 className="success-check" aria-hidden="true" />
          <h1>Check your inbox</h1>
          <p>
            If an account exists with this email, a reset link has been sent.
          </p>
          <Link
            className="auth-button auth-button-primary"
            to="/auth?mode=login"
          >
            Back to log in <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (submitted && currentMode === "signup") {
    return (
      <AuthShell>
        <div className="auth-success">
          <CheckCircle2 className="success-check" aria-hidden="true" />
          <h1>Account created</h1>
          <p>Your AbsoluteCare account is ready. Log in to continue.</p>
          <Link
            className="auth-button auth-button-primary"
            to="/auth?mode=login"
          >
            Log in <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (currentMode === "signup" && !settings.patientRegistrationEnabled) {
    return (
      <AuthShell>
        <div className="auth-success">
          <CircleAlert className="success-check" aria-hidden="true" />
          <h1>Registration is currently closed</h1>
          <p>Please contact the clinic at {settings.phone || "the clinic"}.</p>
          <Link
            className="auth-button auth-button-primary"
            to="/auth?mode=login"
          >
            Log in <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="auth-heading">
        <p className="auth-eyebrow">AbsoluteCare patient portal</p>
        <h1>{authModes[currentMode].title}</h1>
        <p>{authModes[currentMode].description}</p>
      </div>
      {error && error !== "recaptcha" && (
        <div className="auth-alert" role="alert" aria-live="polite">
          <CircleAlert size={16} aria-hidden="true" />
          {error}
        </div>
      )}
      <form className="auth-form" onSubmit={handleSubmit}>
        {currentMode === "signup" && (
          <div className="auth-form-row">
            <label>
              First name
              <input
                name="firstName"
                type="text"
                autoComplete="given-name"
                required
              />
            </label>
            <label>
              Last name
              <input
                name="lastName"
                type="text"
                autoComplete="family-name"
                required
              />
            </label>
          </div>
        )}
        {currentMode === "signup" && (
          <label>
            Mobile number
            <input
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              onInput={(event) => {
                event.currentTarget.value = sanitizePhone(
                  event.currentTarget.value,
                );
              }}
            />
          </label>
        )}
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        {currentMode !== "forgot" && (
          <label>
            Password
            <div className="password-wrap">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete={
                  currentMode === "login" ? "current-password" : "new-password"
                }
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
            {currentMode === "login" && (
              <Link className="forgot-link" to="/forgot-password">
                Forgot password?
              </Link>
            )}
            {currentMode === "signup" && (
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
                      : `Use ${settings.passwordMinLength}+ characters`}
                </b>
              </span>
            )}
          </label>
        )}
        {currentMode === "signup" && (
          <label className="terms-check">
            <input
              type="checkbox"
              checked={terms}
              onChange={(event) => {
                setTerms(event.target.checked);
                if (event.target.checked) setError("");
              }}
            />
            <span>
              I agree to the <Link to="/terms">Terms and Conditions</Link> and{" "}
              <Link to="/privacy">Privacy Policy</Link>.
            </span>
          </label>
        )}
        {currentMode === "signup" && (
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
        )}
        {recaptcha.enabled && (
          <RecaptchaField
            enabled={recaptcha.enabled}
            error={error}
            siteKey={settings.recaptchaSiteKey}
            onChange={(token) => {
              recaptcha.setToken(token);
              setError("");
            }}
            onExpired={() => {
              recaptcha.setToken(null);
              setError("recaptcha-expired");
            }}
            onErrored={() => {
              recaptcha.setToken(null);
              setError("recaptcha");
            }}
            recaptchaRef={recaptchaRef}
            {...recaptcha.containerProps}
          />
        )}
        <button
          className="auth-button auth-button-primary"
          type="submit"
          disabled={
            settingsLoading ||
            loading ||
            (currentMode === "signup" && !terms) ||
            (recaptcha.enabled && !recaptcha.token)
          }
        >
          {loading ? (
            <>
              <LoaderCircle
                className="button-spinner"
                size={16}
                aria-hidden="true"
              />{" "}
              Sending…
            </>
          ) : (
            authModes[currentMode].submit
          )}
        </button>
      </form>
      {currentMode !== "forgot" && settings.googleAuthEnabled && (
        <>
          <div className="auth-divider">
            <span>or</span>
          </div>
          <a
            className="auth-button google-button"
            href={getGoogleAuthUrl()}
            onClick={(event) => {
              if (currentMode === "signup" && !terms) {
                event.preventDefault();
                setError("You must agree to continue.");
              }
            }}
          >
            <FcGoogle size={19} aria-hidden="true" />
            Continue with Google
          </a>
        </>
      )}
      <p className="auth-switch">
        {currentMode === "login" ? (
          <>
            Don't have an account?{" "}
            <button type="button" onClick={() => switchMode("signup")}>
              Sign up
            </button>
          </>
        ) : currentMode === "signup" ? (
          <>
            Already have an account?{" "}
            <button type="button" onClick={() => switchMode("login")}>
              Log in
            </button>
          </>
        ) : (
          <>
            Remembered your password?{" "}
            <button type="button" onClick={() => switchMode("login")}>
              Back to log in
            </button>
          </>
        )}
      </p>
    </AuthShell>
  );
}

function AuthShell({ children }) {
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
        <span className="auth-location">Malaybalay City, Bukidnon</span>
      </header>
      <section className="auth-card">{children}</section>
      <p className="auth-footer">
        Your care, held with attention. <Dot size={16} aria-hidden="true" />{" "}
        <Link to="/">Back to AbsoluteCare</Link>
      </p>
    </main>
  );
}

export default Auth;
