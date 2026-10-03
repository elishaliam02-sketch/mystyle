import type { he } from "./he";

type Dict = typeof he;

/** Fills {placeholders}. Kept here so this file needs nothing from React Native. */
function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

/**
 * Formats a date from the dictionary's own names.
 *
 * Deliberately not toLocaleDateString: the JavaScript engine in a React Native
 * build does not always carry locale data, and its failure mode is a date that
 * silently renders as nothing — which is exactly what happened on device.
 */
export function formatDate(date: Date, dict: Dict): string {
  return fill(dict.calendar.pattern, {
    weekday: dict.calendar.weekdays[date.getDay()],
    day: date.getDate(),
    month: dict.calendar.months[date.getMonth()],
  });
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * "ב׳ 5/10" / "Mon 5/10" for a stored YYYY-MM-DD — the compact form a list of
 * readings needs. Built from the dictionary for the same reason as formatDate,
 * and read at local noon so no time zone can tip it onto the neighbouring day.
 */
export function formatShortDate(ymd: string, dict: Dict): string {
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return `${dict.calendar.weekdaysShort[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

/** "07:05" — a 24-hour clock time, without the engine's locale data. */
export function formatTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** "5/10 07:05" — a date and time, for a stamp like "published at". */
export function formatStamp(date: Date): string {
  return `${date.getDate()}/${date.getMonth() + 1} ${formatTime(date)}`;
}
