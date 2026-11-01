export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const phonePattern = /^(?:09\d{9}|\+639\d{9})$/;

export function normalizeEmail(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function isValidEmail(value: unknown): boolean {
  const email = normalizeEmail(value);
  return email.split("@").length === 2 && emailPattern.test(email);
}

export function normalizePhone(value: unknown): string {
  const compact = String(value || "").replace(/[\s-]/g, "");
  if (/^09\d{9}$/.test(compact)) return `+63${compact.slice(1)}`;
  if (/^\+639\d{9}$/.test(compact)) return compact;
  return compact;
}

export function isValidPhone(value: unknown): boolean {
  return phonePattern.test(normalizePhone(value));
}
