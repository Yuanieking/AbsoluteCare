export const EMAIL_ERROR = "Enter a valid email address, e.g. name@gmail.com";
export const PHONE_ERROR = "Enter a valid mobile number (e.g. 09171234567)";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const phonePattern = /^(?:09\d{9}|\+639\d{9})$/;

export function isValidEmail(value) {
  const email = String(value || "").trim();
  return email.split("@").length === 2 && emailPattern.test(email);
}

export function sanitizePhone(value) {
  return String(value || "").replace(/[^\d+\s-]/g, "");
}

export function normalizePhone(value) {
  const compact = String(value || "").replace(/[\s-]/g, "");
  if (/^09\d{9}$/.test(compact)) return `+63${compact.slice(1)}`;
  if (/^\+639\d{9}$/.test(compact)) return compact;
  return compact;
}

export function isValidPhone(value) {
  return phonePattern.test(normalizePhone(value));
}
