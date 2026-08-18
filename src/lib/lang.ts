// Helper i18n partagé pour les composants "landing" (accueil, onglets, modals,
// GoatGuess…) qui, contrairement à LePont.jsx, n'avaient aucun mécanisme de
// langue. La langue est stockée par LePont dans localStorage `bb_lang` ; à
// défaut on la déduit de la langue du navigateur. Signature identique au helper
// `tr` de LePont : tr(fr, en, de, it, pt, es).

export type Lang = "fr" | "en" | "de" | "it" | "pt" | "es";

const SUPPORTED: Lang[] = ["fr", "en", "de", "it", "pt", "es"];

export function getLang(): Lang {
  try {
    const saved = localStorage.getItem("bb_lang");
    if (saved && SUPPORTED.includes(saved as Lang)) return saved as Lang;
    const nav = (navigator.language || "en").slice(0, 2).toLowerCase();
    if (SUPPORTED.includes(nav as Lang)) return nav as Lang;
  } catch {
    /* SSR / storage indisponible */
  }
  // Repli sur l'anglais et non sur le français : il ne sert QUE pour les
  // langues absentes des six — un téléphone en fr-* tombe sur le français
  // juste au-dessus. Un néerlandophone ou un arabophone lit donc l'anglais,
  // qu'il a plus de chances de comprendre que le français.
  return "en";
}

/** Langues proposées, dans l'ordre d'affichage du sélecteur. */
export const LANGS: { code: Lang; flag: string; label: string }[] = [
  { code: "fr", flag: "🇫🇷", label: "FR" },
  { code: "en", flag: "🇬🇧", label: "EN" },
  { code: "de", flag: "🇩🇪", label: "DE" },
  { code: "it", flag: "🇮🇹", label: "IT" },
  { code: "pt", flag: "🇵🇹", label: "PT" },
  { code: "es", flag: "🇪🇸", label: "ES" },
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

// ── LES GRANDS NOMBRES ────────────────────────────────────────────────────
//
// Le classement affichait « 33798 pts » : un mur de chiffres qu'on ne lit pas
// d'un coup d'œil, alors que c'est justement le chiffre qui dit qui gagne.
//
// Ce qui existait avant était pire qu'absent, parce que c'était INCOHÉRENT :
//
//   • certains endroits appelaient `toLocaleString()` SANS argument, donc
//     suivaient la langue du NAVIGATEUR et pas celle choisie dans l'app. Un
//     téléphone en anglais affichait « 120,000 XP » au milieu d'une interface
//     française — constaté sur capture, pas supposé ;
//   • d'autres forçaient `"fr-FR"`, donc mettaient des espaces à la française
//     dans les six langues, y compris en anglais où la virgule est la règle ;
//   • le classement, lui, n'avait aucun formatage du tout.
//
// D'où une fonction PURE qui prend la langue en paramètre. Pure et non lectrice
// de localStorage, pour deux raisons : elle est testable sans navigateur, et
// dans LePont elle se branche sur l'état `lang` de React — donc l'affichage
// change au changement de langue sans attendre un rechargement.
const LOCALES: Record<Lang, string> = {
  fr: "fr-FR",   // 33 798 — espace FINE INSÉCABLE (U+202F) : « 33 798 pts » ne
                 // se coupe donc jamais en fin de ligne, ce qu'une espace
                 // ordinaire ne garantirait pas.
  en: "en-GB",   // 33,798 — la virgule, et pas l'espace : c'est la règle
                 // anglaise, et le drapeau du sélecteur est 🇬🇧.
  de: "de-DE",   // 33.798
  it: "it-IT",   // 33.798
  pt: "pt-PT",   // 33 798 — espace insécable (U+00A0). Le drapeau est 🇵🇹, donc
                 // pt-PT et non pt-BR, qui grouperait avec un point.
  es: "es-ES",   // 33.798
};

/**
 * Un nombre écrit comme on l'écrit dans la langue affichée.
 *
 * À NOTER, et ce n'est pas un défaut : en italien, portugais et espagnol, les
 * nombres à QUATRE chiffres ne sont pas groupés — 1000 reste « 1000 », et le
 * groupement n'apparaît qu'à partir de 10 000. C'est la typographie correcte de
 * ces langues (Intl applique `minimumGroupingDigits: 2`), et l'aligner sur le
 * français serait une faute d'orthographe dans trois langues sur six.
 */
export function formatNombre(n: number, langue: Lang): string {
  if (!Number.isFinite(n)) return "0";
  try {
    return new Intl.NumberFormat(LOCALES[langue] || "en-GB").format(n);
  } catch {
    // Un environnement sans ICU complet (rare, mais un WebView ancien peut
    // l'être) : mieux vaut le nombre brut qu'une exception qui casse l'écran.
    return String(n);
  }
}

/** Version qui déduit la langue seule, pour les composants sans état de langue. */
export function nombre(n: number): string {
  return formatNombre(n, getLang());
}

export function tr(
  fr: string,
  en: string,
  de?: string,
  it?: string,
  pt?: string,
  es?: string
): string {
  const l = getLang();
  if (l === "de") return de ?? en ?? fr;
  if (l === "it") return it ?? en ?? fr;
  if (l === "pt") return pt ?? en ?? fr;
  if (l === "es") return es ?? en ?? fr;
  if (l === "en") return en ?? fr;
  return fr;
}
