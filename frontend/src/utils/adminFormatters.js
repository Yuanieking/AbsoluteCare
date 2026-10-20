export function formatAdminDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(date);
}

export function formatAdminDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const parts = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Manila",
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value || "";
  return `${part("weekday")}, ${part("month")} ${part("day")} · ${part("hour")}:${part("minute")} ${part("dayPeriod")}`;
}

export function formatAdminPhone(value) {
  if (!value) return "—";
  const digits = String(value).replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("9"))
    return `+63 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith("0"))
    return `+63 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  if (digits.length === 12 && digits.startsWith("63"))
    return `+63 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  return String(value);
}

export function formatAdminCurrency(value) {
  return `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatAdminDuration(value) {
  return value ? `${value} min` : "—";
}
