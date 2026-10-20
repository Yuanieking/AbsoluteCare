import ReCAPTCHA from "react-google-recaptcha";

function RecaptchaField({
  enabled,
  error,
  siteKey,
  onChange,
  onExpired,
  onErrored,
  recaptchaRef,
  containerProps = {},
}) {
  if (!enabled || !siteKey) return null;
  return (
    <div
      className={`recaptcha ${error ? "recaptcha-error" : ""}`}
      {...containerProps}
    >
      <ReCAPTCHA
        ref={recaptchaRef}
        sitekey={siteKey}
        onChange={onChange}
        onExpired={onExpired}
        onErrored={onErrored}
      />
      {error === "recaptcha" && (
        <span className="field-error" role="alert">
          Verify reCAPTCHA before continuing.
        </span>
      )}
      {error === "recaptcha-expired" && (
        <span className="field-error" role="alert">
          Your verification expired. Please try again.
        </span>
      )}
    </div>
  );
}

export default RecaptchaField;
