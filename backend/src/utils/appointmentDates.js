import { ValidationError } from "../errors/AppError.js";

export function clinicDate(value, endOfDay = false) {
  let input = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(input))
    input += endOfDay ? "T23:59:59.999+08:00" : "T00:00:00+08:00";
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(input))
    input += "+08:00";
  const date = new Date(input);
  if (Number.isNaN(date.getTime()))
    throw new ValidationError("Enter a valid clinic date.");
  return date;
}

export function clinicDay(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type) => parts.find((item) => item.type === type).value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

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
