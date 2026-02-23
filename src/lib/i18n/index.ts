// i18n engine — populated in task 1.4
export type Lang = "uk" | "en";

// Placeholder until task 1.4 fills in translation maps.
export function t(_key: string, _lang: Lang = "uk", _vars?: Record<string, string | number>): string {
  return _key;
}

export function setLang(_lang: Lang): void {
  // implemented in task 1.4
}

export function getLang(): Lang {
  return "uk";
}
