import zhCN from "./locales/zh-CN.json";
import enUS from "./locales/en-US.json";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale, type MessageKey } from "./types";
import { interpolate } from "./formatters";

export * from "./types";
export * from "./formatters";

export const catalogs: Record<Locale, Record<string, any>> = {
  "zh-CN": zhCN,
  "en-US": enUS,
};

export function lookupMessage(catalog: Record<string, any>, path: string): string {
  const parts = path.split(".");
  let current: any = catalog;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = current[part];
    } else {
      return path;
    }
  }
  return typeof current === "string" ? current : path;
}

export function translate(locale: Locale, key: MessageKey | string, params?: Record<string, string | number>): string {
  const catalog = catalogs[locale] || catalogs[DEFAULT_LOCALE];
  const template = lookupMessage(catalog, key);
  return interpolate(template, params);
}

export function getLocaleFromRequest(request: Request): Locale {
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/(?:^|;\s*)verso_locale=([^;]+)/);
  if (match && match[1]) {
    const raw = decodeURIComponent(match[1]) as Locale;
    if (SUPPORTED_LOCALES.includes(raw)) {
      return raw;
    }
  }

  const acceptLang = request.headers.get("Accept-Language") || "";
  if (acceptLang.startsWith("en") || acceptLang.includes("en-US") || acceptLang.includes("en-GB")) {
    return "en-US";
  }

  return DEFAULT_LOCALE;
}

export function createLocaleCookieHeader(locale: Locale): string {
  return `verso_locale=${locale}; Path=/; SameSite=Lax; Max-Age=31536000`;
}
