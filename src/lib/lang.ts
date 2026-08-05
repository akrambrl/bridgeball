// Helper i18n partagé pour les composants "landing" (accueil, onglets, modals,
// GoatGuess…) qui, contrairement à LePont.jsx, n'avaient aucun mécanisme de
// langue. La langue est stockée par LePont dans localStorage `bb_lang` ; à
// défaut on la déduit de la langue du navigateur. Signature identique au helper
// `tr` de LePont : tr(fr, en, de, it, pt).

export type Lang = "fr" | "en" | "de" | "it" | "pt";

const SUPPORTED: Lang[] = ["fr", "en", "de", "it", "pt"];

export function getLang(): Lang {
  try {
    const saved = localStorage.getItem("bb_lang");
    if (saved && SUPPORTED.includes(saved as Lang)) return saved as Lang;
    const nav = (navigator.language || "fr").slice(0, 2).toLowerCase();
    if (SUPPORTED.includes(nav as Lang)) return nav as Lang;
  } catch {
    /* SSR / storage indisponible */
  }
  return "fr";
}

/** Langues proposées, dans l'ordre d'affichage du sélecteur. */
export const LANGS: { code: Lang; flag: string; label: string }[] = [
  { code: "fr", flag: "🇫🇷", label: "FR" },
  { code: "en", flag: "🇬🇧", label: "EN" },
  { code: "de", flag: "🇩🇪", label: "DE" },
  { code: "it", flag: "🇮🇹", label: "IT" },
  { code: "pt", flag: "🇵🇹", label: "PT" },
];

/**
 * Change la langue et recharge la page. Le rechargement est nécessaire : `tr()`
 * relit localStorage à chaque appel mais n'est branché sur aucun état React, et
 * LePont initialise sa propre langue au montage — sans reload, une partie de
 * l'interface resterait dans l'ancienne langue.
 */
export function setLang(l: Lang): void {
  try { localStorage.setItem("bb_lang", l); } catch { /* noop */ }
  try { window.location.reload(); } catch { /* noop */ }
}

export function tr(
  fr: string,
  en: string,
  de?: string,
  it?: string,
  pt?: string
): string {
  const l = getLang();
  if (l === "de") return de ?? en ?? fr;
  if (l === "it") return it ?? en ?? fr;
  if (l === "pt") return pt ?? en ?? fr;
  if (l === "en") return en ?? fr;
  return fr;
}
