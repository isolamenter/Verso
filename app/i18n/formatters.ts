import type { Locale } from "./types";

export function formatDate(
  date: Date | string | number,
  locale: Locale = "zh-CN",
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === "object" ? date : new Date(date);
  if (isNaN(d.getTime())) return "";

  const defaultOptions: Intl.DateTimeFormatOptions = options ?? {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };

  return new Intl.DateTimeFormat(locale, defaultOptions).format(d);
}

export function formatRelativeTime(
  date: Date | string | number,
  locale: Locale = "zh-CN",
  baseDate: Date = new Date()
): string {
  const target = typeof date === "object" ? date : new Date(date);
  if (isNaN(target.getTime())) return "";

  const diffSeconds = Math.round((target.getTime() - baseDate.getTime()) / 1000);
  const absDiff = Math.abs(diffSeconds);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (absDiff < 60) {
    return rtf.format(diffSeconds, "second");
  }
  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, "minute");
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, "hour");
  }
  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 30) {
    return rtf.format(diffDays, "day");
  }
  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) {
    return rtf.format(diffMonths, "month");
  }
  const diffYears = Math.round(diffDays / 365);
  return rtf.format(diffYears, "year");
}

export function formatNumber(
  value: number,
  locale: Locale = "zh-CN",
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function interpolate(
  template: string,
  params?: Record<string, string | number>
): string {
  if (!params || typeof template !== "string") return template;
  return template.replace(/\{([a-zA-Z0-9_-]+)\}/g, (match, key) => {
    return key in params ? String(params[key]) : match;
  });
}

