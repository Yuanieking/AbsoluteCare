export function manilaDateTime(date, time) {
  return new Date(`${date}T${time}:00+08:00`);
}

export function isValidFutureDate(date, time) {
  const parsed = manilaDateTime(date, time);
  return !Number.isNaN(parsed.getTime()) && parsed > new Date();
}

export function formatManilaDate(date) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeZone: "Asia/Manila",
  }).format(new Date(date));
}
