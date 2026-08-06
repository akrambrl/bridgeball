// Jours calendaires « heure de Paris » — base du découpage temporel du tableau
// de bord privé (?stats=CODE).
//
// Pourquoi pas UTC : l'app est française, et un découpage UTC faisait démarrer
// « Aujourd'hui » à 2 h du matin heure de Paris (1 h en hiver). Les événements
// de la soirée tombaient donc dans le jour suivant.
//
// Pourquoi Intl et pas un décalage fixe : Paris est à UTC+1 en hiver et UTC+2
// en été, et une fenêtre de 14 jours peut enjamber le changement d'heure.

const PARIS_DAY_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Jour calendaire parisien d'un instant, au format "YYYY-MM-DD".
 * Renvoie null si la date est illisible — jamais une chaîne bidon, qui se
 * comparerait à n'importe quelle autre clé et gonflerait les compteurs.
 */
export function parisDayOf(when: string | number | Date | null | undefined): string | null {
  if (when == null) return null;
  const dt = new Date(when as string | number | Date);
  if (isNaN(dt.getTime())) return null;
  try {
    let y = "", m = "", d = "";
    for (const p of PARIS_DAY_FMT.formatToParts(dt)) {
      if (p.type === "year") y = p.value;
      else if (p.type === "month") m = p.value;
      else if (p.type === "day") d = p.value;
    }
    return y + "-" + m + "-" + d;
  } catch {
    return dt.toISOString().slice(0, 10); // repli improbable : jour UTC
  }
}

/**
 * Les `n` derniers jours calendaires parisiens, du plus récent au plus ancien,
 * en commençant par le jour de `when`.
 *
 * On décrémente la DATE en UTC (une journée UTC fait toujours 24 h) au lieu de
 * retirer 24 h à un instant : sinon les jours de changement d'heure pouvaient
 * apparaître deux fois ou être sautés.
 */
export function parisLastDays(n: number, when: string | number | Date): string[] {
  const key = parisDayOf(when) || new Date(when).toISOString().slice(0, 10);
  const p = key.split("-");
  const base = Date.UTC(+p[0], +p[1] - 1, +p[2]);
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(new Date(base - i * 86400000).toISOString().slice(0, 10));
  return out;
}
