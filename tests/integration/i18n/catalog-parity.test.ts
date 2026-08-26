import { describe, it, expect } from "vitest";
import zhCN from "../../../app/i18n/locales/zh-CN.json";
import enUS from "../../../app/i18n/locales/en-US.json";
import {
  formatDate,
  formatRelativeTime,
  formatNumber,
  interpolate,
  lookupMessage,
  getLocaleFromRequest,
  createLocaleCookieHeader,
} from "../../../app/i18n";

function getDeepKeys(obj: Record<string, any>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...getDeepKeys(v, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

describe("E06 — Bilingual Product Foundation & Catalog Parity", () => {
  it("maintains exact 1-to-1 key parity between zh-CN and en-US catalogs", () => {
    const zhKeys = getDeepKeys(zhCN);
    const enKeys = getDeepKeys(enUS);

    const missingInEn = zhKeys.filter((k) => !enKeys.includes(k));
    const missingInZh = enKeys.filter((k) => !zhKeys.includes(k));

    expect(missingInEn).toEqual([]);
    expect(missingInZh).toEqual([]);
    expect(zhKeys.length).toBeGreaterThan(30);
    expect(zhKeys).toEqual(enKeys);
  });

  it("contains non-empty string values for all catalog keys", () => {
    const zhKeys = getDeepKeys(zhCN);
    for (const key of zhKeys) {
      const zhVal = lookupMessage(zhCN, key);
      const enVal = lookupMessage(enUS, key);

      expect(typeof zhVal).toBe("string");
      expect(zhVal.trim().length).toBeGreaterThan(0);
      expect(zhVal).not.toBe(key); // must not return fallback raw key

      expect(typeof enVal).toBe("string");
      expect(enVal.trim().length).toBeGreaterThan(0);
      expect(enVal).not.toBe(key);
    }
  });

  it("interpolates named parameters correctly", () => {
    const template = "Found {count} results for project '{title}'.";
    const result = interpolate(template, { count: 42, title: "Dream of the Red Chamber" });
    expect(result).toBe("Found 42 results for project 'Dream of the Red Chamber'.");
  });

  it("formats dates according to locale", () => {
    const testDate = new Date("2026-08-26T12:00:00Z");

    const zhFormatted = formatDate(testDate, "zh-CN", { year: "numeric", month: "numeric", day: "numeric" });
    const enFormatted = formatDate(testDate, "en-US", { year: "numeric", month: "numeric", day: "numeric" });

    expect(zhFormatted).toContain("2026");
    expect(enFormatted).toContain("2026");
    expect(enFormatted).toContain("8/26/2026");
  });

  it("formats relative time correctly for zh-CN and en-US", () => {
    const now = new Date("2026-08-26T12:00:00Z");
    const fiveMinutesAgo = new Date("2026-08-26T11:55:00Z");
    const twoHoursAgo = new Date("2026-08-26T10:00:00Z");
    const threeDaysAgo = new Date("2026-08-23T12:00:00Z");

    const zhRelMin = formatRelativeTime(fiveMinutesAgo, "zh-CN", now);
    const enRelMin = formatRelativeTime(fiveMinutesAgo, "en-US", now);

    expect(zhRelMin).toContain("5");
    expect(zhRelMin).toContain("分钟");
    expect(enRelMin).toBe("5 minutes ago");

    const zhRelHour = formatRelativeTime(twoHoursAgo, "zh-CN", now);
    const enRelHour = formatRelativeTime(twoHoursAgo, "en-US", now);

    expect(zhRelHour).toContain("2");
    expect(zhRelHour).toContain("小时");
    expect(enRelHour).toBe("2 hours ago");

    const zhRelDay = formatRelativeTime(threeDaysAgo, "zh-CN", now);
    const enRelDay = formatRelativeTime(threeDaysAgo, "en-US", now);

    expect(zhRelDay).toContain("3");
    expect(zhRelDay).toContain("天");
    expect(enRelDay).toBe("3 days ago");
  });

  it("formats numbers with locale separators", () => {
    const numberVal = 1234567.89;
    const zhFormatted = formatNumber(numberVal, "zh-CN");
    const enFormatted = formatNumber(numberVal, "en-US");

    expect(zhFormatted).toBe("1,234,567.89");
    expect(enFormatted).toBe("1,234,567.89");
  });

  it("extracts locale from request cookies, headers, and defaults", () => {
    // 1. From Cookie
    const cookieReq = new Request("http://127.0.0.1:4173", {
      headers: { Cookie: "other=val; verso_locale=en-US; theme=dark" },
    });
    expect(getLocaleFromRequest(cookieReq)).toBe("en-US");

    // 2. From Accept-Language
    const headerReq = new Request("http://127.0.0.1:4173", {
      headers: { "Accept-Language": "en-US,en;q=0.9" },
    });
    expect(getLocaleFromRequest(headerReq)).toBe("en-US");

    // 3. Default fallback
    const defaultReq = new Request("http://127.0.0.1:4173");
    expect(getLocaleFromRequest(defaultReq)).toBe("zh-CN");
  });

  it("generates valid Set-Cookie headers for locale preference", () => {
    const cookieHeader = createLocaleCookieHeader("en-US");
    expect(cookieHeader).toBe("verso_locale=en-US; Path=/; SameSite=Lax; Max-Age=31536000");
  });
});

