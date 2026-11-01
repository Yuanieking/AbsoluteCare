export function manilaDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00+08:00`);
}

export function isValidFutureDate(date: string, time: string): boolean {
  const parsed = manilaDateTime(date, time);
  return !Number.isNaN(parsed.getTime()) && parsed > new Date();
}

export function formatManilaDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeZone: "Asia/Manila",
  }).format(new Date(date));
}
