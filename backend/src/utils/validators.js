export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const phonePattern = /^(?:09\d{9}|\+639\d{9})$/;

export function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function isValidEmail(value) {
  const email = normalizeEmail(value);
  return email.split("@").length === 2 && emailPattern.test(email);
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
