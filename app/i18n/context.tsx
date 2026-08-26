import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale, type MessageKey } from "./types";
import { formatDate as fmtDate, formatRelativeTime as fmtRelative, formatNumber as fmtNum } from "./formatters";
import { translate, createLocaleCookieHeader } from "./core";

export interface I18nContextValue {
  locale: Locale;
  setLocale: (nextLocale: Locale) => void;
  t: (key: MessageKey | string, params?: Record<string, string | number>) => string;
  formatDate: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatRelativeTime: (date: Date | string | number, baseDate?: Date) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export interface I18nProviderProps {
  children: React.ReactNode;
  initialLocale?: Locale;
}

export function I18nProvider({ children, initialLocale = DEFAULT_LOCALE }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((nextLocale: Locale) => {
    if (!SUPPORTED_LOCALES.includes(nextLocale)) return;
    setLocaleState(nextLocale);
    if (typeof window !== "undefined" && typeof (window as any).document !== "undefined") {
      const doc = (window as any).document;
      doc.cookie = createLocaleCookieHeader(nextLocale);
      if (doc.documentElement) {
        doc.documentElement.lang = nextLocale;
      }
    }
  }, []);

  const t = useCallback(
    (key: MessageKey | string, params?: Record<string, string | number>): string => {
      return translate(locale, key, params);
    },
    [locale]
  );

  const formatDate = useCallback(
    (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => {
      return fmtDate(date, locale, options);
    },
    [locale]
  );

  const formatRelativeTime = useCallback(
    (date: Date | string | number, baseDate?: Date) => {
      return fmtRelative(date, locale, baseDate);
    },
    [locale]
  );

  const formatNumber = useCallback(
    (val: number, options?: Intl.NumberFormatOptions) => {
      return fmtNum(val, locale, options);
    },
    [locale]
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      formatDate,
      formatRelativeTime,
      formatNumber,
    }),
    [locale, setLocale, t, formatDate, formatRelativeTime, formatNumber]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      t: (key: string, params?: Record<string, string | number>) => translate(DEFAULT_LOCALE, key, params),
      formatDate: (date) => fmtDate(date, DEFAULT_LOCALE),
      formatRelativeTime: (date) => fmtRelative(date, DEFAULT_LOCALE),
      formatNumber: (val) => fmtNum(val, DEFAULT_LOCALE),
    };
  }
  return ctx;
}
