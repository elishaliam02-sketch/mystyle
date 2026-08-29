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
