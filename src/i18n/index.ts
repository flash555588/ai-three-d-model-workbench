import { en, type TranslationKey } from "./en";
import { zhCN } from "./zh-CN";

export type { TranslationKey };

export type Locale = "en" | "zh-CN";

const dictionaries: Record<Locale, Record<TranslationKey, string>> = {
  en,
  "zh-CN": zhCN,
};

let currentLocale: Locale = "en";

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(key: TranslationKey): string {
  return dictionaries[currentLocale]?.[key] ?? en[key] ?? key;
}

export function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}

export function formatT(key: TranslationKey, values: Record<string, string>): string {
  return interpolate(t(key), values);
}
