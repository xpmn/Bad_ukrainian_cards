import { uk, type TranslationKey } from "./uk";
import { en } from "./en";

export type { TranslationKey };
export type Lang = "uk" | "en";

// ── Internal state ────────────────────────────────────────────────────────────

const STORAGE_KEY = "bad_cards_lang";

const translations: Record<Lang, Record<TranslationKey, string>> = { uk, en };

let _currentLang: Lang = "uk";

// ── Language change subscribers (for React hook) ──────────────────────────────

type LangListener = (lang: Lang) => void;
const _listeners = new Set<LangListener>();

export function onLangChange(listener: LangListener): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Translate a key in the given (or current) language.
 * Variable interpolation: `t("toast.player_joined", "uk", { name: "Олена" })`
 * replaces `{{name}}` → `"Олена"`.
 */
export function t(
  key: TranslationKey,
  lang: Lang = _currentLang,
  vars?: Record<string, string | number>,
): string {
  const map = translations[lang];
  // Fall back to Ukrainian, then to the raw key so the UI never breaks.
  let text: string = map[key] ?? translations["uk"][key] ?? key;

  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{{${k}}}`, String(v));
    }
  }

  return text;
}

/** Return the currently active language. */
export function getLang(): Lang {
  return _currentLang;
}

/**
 * Set the active language.
 * In a browser environment the choice is persisted to localStorage and all
 * subscribers (e.g. the `useLang` React hook) are notified.
 */
export function setLang(lang: Lang): void {
  if (lang === _currentLang) return;
  _currentLang = lang;

  // Persist to localStorage when running in the browser.
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, lang);
  }

  for (const listener of _listeners) {
    listener(lang);
  }
}

/**
 * Initialise language from localStorage (call once on app boot in the browser).
 * Safe to call in SSR/Node — it's a no-op when localStorage is unavailable.
 */
export function initLang(): void {
  if (typeof localStorage === "undefined") return;
  const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
  if (stored === "uk" || stored === "en") {
    _currentLang = stored;
  }
}
