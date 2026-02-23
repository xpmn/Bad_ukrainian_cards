import { useState, useEffect, useCallback } from "react";
import {
  getLang, setLang as _setLang, onLangChange, initLang, t,
  type Lang,
  type TranslationKey,
} from "../../lib/i18n/index";

/**
 * React hook for i18n.
 *
 * Usage:
 * ```tsx
 * const { lang, setLang, t } = useLang();
 * return <p>{t("game.hetman")}</p>;
 * ```
 *
 * Returns a `t` helper that is already bound to the current language, so you
 * don't need to pass `lang` every time.
 */
export function useLang() {
  const [lang, setLocalLang] = useState<Lang>(getLang);

  useEffect(() => {
    // Sync with localStorage on first render (browser only).
    initLang();
    setLocalLang(getLang());

    // Subscribe to future changes (e.g. from another component).
    return onLangChange(setLocalLang);
  }, []);

  const setLang = useCallback((next: Lang) => {
    _setLang(next);
  }, []);

  const translate = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) =>
      t(key, lang, vars),
    [lang],
  );

  return { lang, setLang, t: translate } as const;
}
