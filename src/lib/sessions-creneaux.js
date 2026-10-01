// LES CRÉNEAUX DE GOAT SESSION : chaque mercredi et chaque samedi à 19 h 30, heure de Paris.
//
// Ce module calcule les instants (en UTC) des prochains créneaux ; il ne touche pas au
// réseau. Le créateur automatique (scripts/creer-sessions.mjs) s'en sert pour que chaque
// créneau ait sa session AVANT que les joueurs ne la cherchent.
//
// L'HEURE LOCALE, PAS L'HEURE UTC. « 19 h 30 à Paris » vaut 17 h 30 UTC l'été et 18 h 30 UTC
// l'hiver : un créneau figé en UTC glisserait d'une heure au changement d'heure (le 25
// octobre 2026). On part donc de la date et de l'heure locales et on retrouve l'instant.

/** Jours (0 = dimanche … 6 = samedi) et heure locale (Paris) des sessions. */
export const JOURS_SESSION = [3, 6];          // mercredi, samedi
export const HEURE_SESSION = { h: 19, m: 30 };

const TZ = "Europe/Paris";

/** La date locale à Paris d'un instant : { y, m, d, jour } (jour : 0 = dimanche). */
function dateParis(instant) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
  }).formatToParts(instant);
  const get = (t) => parts.find((p) => p.type === t).value;
  const jours = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { y: +get("year"), m: +get("month"), d: +get("day"), jour: jours[get("weekday")] };
}

/** Le décalage de Paris par rapport à UTC, en minutes, à un instant donné. */
function decalageParis(instant) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(instant);
  const g = (t) => +parts.find((p) => p.type === t).value;
  const enUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return Math.round((enUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
}

/** L'instant UTC qui correspond à « y-m-d h:m » heure de Paris. */
export function parisVersUtc(y, m, d, h, min) {
  const naif = Date.UTC(y, m - 1, d, h, min);
  // Deux passes : le décalage dépend de l'instant qu'on cherche (changement d'heure).
  let t = naif - decalageParis(new Date(naif)) * 60000;
  t = naif - decalageParis(new Date(t)) * 60000;
  return new Date(t);
}

/**
 * Les créneaux de session des `jours` prochains jours, à partir de `depuis`, en ISO UTC.
 * Un créneau déjà passé n'est pas rendu.
 */
export function creneauxSessions(depuis, jours) {
  const debut = depuis instanceof Date ? depuis : new Date(depuis == null ? Date.now() : depuis);
  const out = [];
  // On balaie les dates locales de Paris, jour par jour, depuis la date locale de `debut`.
  const base = dateParis(debut);
  for (let i = 0; i <= jours + 1; i++) {
    const midi = new Date(Date.UTC(base.y, base.m - 1, base.d + i, 12, 0));
    const loc = dateParis(midi);
    if (!JOURS_SESSION.includes(loc.jour)) continue;
    const t = parisVersUtc(loc.y, loc.m, loc.d, HEURE_SESSION.h, HEURE_SESSION.m);
    if (t.getTime() > debut.getTime() && t.getTime() <= debut.getTime() + jours * 86400000) {
      out.push(t.toISOString());
    }
  }
  return out;
}
