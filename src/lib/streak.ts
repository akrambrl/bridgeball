// Série quotidienne (jours consécutifs) de la Devinette du jour — le moteur
// d'habitude / de rétention n°1 (comme Wordle, Duolingo…). Stockée localement :
// { current, best, lastDay }. Une journée compte dès que la devinette est
// TERMINÉE (gagnée OU ratée) : on récompense le fait de revenir chaque jour
// (l'habitude), pas la perfection — bien plus efficace pour la rétention.

const KEY = "bb_daily_streak";

export type DailyStreak = { current: number; best: number; lastDay: string | null };

function read(): DailyStreak {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { current: 0, best: 0, lastDay: null };
    const s = JSON.parse(raw);
    return {
      current: Number(s.current) || 0,
      best: Number(s.best) || 0,
      lastDay: typeof s.lastDay === "string" ? s.lastDay : null,
    };
  } catch {
    return { current: 0, best: 0, lastDay: null };
  }
}

function write(s: DailyStreak): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* noop */ }
}

// "YYYY-MM-DD" → jour précédent en "YYYY-MM-DD". On parse à midi UTC pour éviter
// tout décalage de fuseau/heure d'été lors du -24 h.
function prevDay(day: string): string {
  const d = new Date(Date.parse(day + "T12:00:00Z") - 86400000);
  return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0");
}

// Marque la devinette du jour `day` comme terminée. Idempotent : rejouer /
// recharger le même jour ne ré-incrémente pas. Renvoie l'état à jour.
export function recordDailyDone(day: string): DailyStreak {
  const s = read();
  if (s.lastDay === day) return s; // déjà compté aujourd'hui
  const current = s.lastDay && prevDay(day) === s.lastDay ? s.current + 1 : 1; // hier → +1, sinon on repart à 1
  const next: DailyStreak = { current, best: Math.max(s.best, current), lastDay: day };
  write(next);
  return next;
}

// Série AFFICHÉE pour `today`, sans rien modifier :
// - jouée aujourd'hui ou hier → la série est encore vivante → on renvoie current
// - sinon (≥ 2 jours sans jouer) → série cassée → 0
export function displayStreak(today: string): { current: number; best: number; alive: boolean; playedToday: boolean } {
  const s = read();
  const playedToday = s.lastDay === today;
  const alive = playedToday || (s.lastDay !== null && s.lastDay === prevDay(today));
  return { current: alive ? s.current : 0, best: s.best, alive, playedToday };
}

// Jour courant à Paris ("YYYY-MM-DD") = clé de stockage de la Devinette du jour.
export function parisDayKey(): string {
  const p = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  return p.getFullYear() + "-" + String(p.getMonth() + 1).padStart(2, "0") + "-" + String(p.getDate()).padStart(2, "0");
}

// La Devinette du jour est-elle déjà terminée aujourd'hui ? On lit la manche
// sauvegardée (source de vérité, partagée avec FindPlayer) plutôt que la série,
// qui vaut aussi pour les jours précédents.
export function dailyRiddleDone(): boolean {
  try {
    const raw = localStorage.getItem("bb_devinette_" + parisDayKey());
    return raw ? !!JSON.parse(raw).over : false;
  } catch {
    return false;
  }
}
