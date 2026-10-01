// LA LIMITE DE PARTIES SUR LE SITE (navigateur et PWA).
//
// Le site goatfc.fr et les PWA offrent trois (3) parties par jour dans les modes en
// illimité (GOAT Plug, GOAT Mercato, GOAT Reveal). Au-delà, le joueur est invité à
// passer sur l'application, où il n'y a pas de limite. L'app native n'est jamais
// concernée : c'est elle qu'on veut que les joueurs installent.
//
// CE QUE CETTE LIMITE EST, ET CE QU'ELLE N'EST PAS. Un compteur dans le
// navigateur : il se contourne en vidant les données du site ou en changeant de
// navigateur. C'est voulu — le but est d'orienter vers l'app, pas de verrouiller.
// Une vraie limite serveur demanderait que l'app déclare sa plateforme avec chaque
// score. Si le stockage est indisponible (navigation privée stricte), on laisse
// jouer plutôt que de bloquer un joueur sans moyen de compter.
//
// Ce module ne touche pas au réseau et reçoit son stockage en paramètre : il se
// teste sans navigateur.

/** Nombre de parties par jour autorisées sur le site. */
export const LIMITE_PARTIES_WEB = 3;

/** Le jour calendaire à Paris, « AAAA-MM-JJ » — le même découpage que le classement. */
export function jourParis(date) {
  const d = date == null ? new Date() : new Date(date);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d);
  let y = "", m = "", j = "";
  for (const p of parts) {
    if (p.type === "year") y = p.value; else if (p.type === "month") m = p.value; else if (p.type === "day") j = p.value;
  }
  return y + "-" + m + "-" + j;
}

/** La clé de stockage du compteur d'un jour. Un jour neuf repart de zéro tout seul. */
export function cleCompteur(jour) {
  return "bb_web_parties_" + jour;
}

/** Parties déjà lancées ce jour-là. 0 si rien, si la valeur est illisible ou le stockage absent. */
export function lireParties(storage, jour) {
  try {
    const n = parseInt(storage && storage.getItem(cleCompteur(jour)), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch (_) {
    return 0;
  }
}

/**
 * Tente de lancer une partie.
 *
 * @param {object} p
 * @param {boolean} p.natif        dans l'app native : jamais limité, jamais compté
 * @param {Storage|null} p.storage
 * @param {string} [p.jour]        « AAAA-MM-JJ », Paris par défaut
 * @param {number} [p.limite]
 * @returns {{autorise: boolean, jouees: number, restantes: number}}
 *          `jouees` compte la partie qu'on vient de lancer si elle est autorisée.
 */
export function lancerPartieWeb({ natif, storage, jour, limite }) {
  const max = Number.isFinite(limite) ? limite : LIMITE_PARTIES_WEB;
  if (natif) return { autorise: true, jouees: 0, restantes: Infinity };
  const j = jour || jourParis();
  let jouees = lireParties(storage, j);
  if (jouees >= max) return { autorise: false, jouees, restantes: 0 };
  jouees += 1;
  try { storage.setItem(cleCompteur(j), String(jouees)); }
  catch (_) {
    // Pas de stockage : impossible de compter, donc impossible de limiter
    // honnêtement. On laisse jouer.
    return { autorise: true, jouees: 0, restantes: Infinity };
  }
  return { autorise: true, jouees, restantes: max - jouees };
}
