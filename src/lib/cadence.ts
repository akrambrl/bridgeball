// ── Cadence de sondage du salon de duel ───────────────────────────────────
// Toute la synchronisation multijoueur passe par du sondage REST : il n'y a
// pas de temps réel, la publication Supabase n'inclut pas les tables de salon
// (voir docs/supabase-realtime.sql). Ce sondage est donc le SEUL canal, et
// c'est aussi la requête la plus coûteuse de l'app.
//
// Elle tournait à 800 ms partout — 75 requêtes par minute et par joueur — alors
// qu'elle n'a besoin de cette nervosité que pendant la manche, où l'on court
// après l'adversaire. Dans le salon d'attente et sur l'écran de résultats,
// deux secondes ne se voient pas.

export type EcranDuel = "lobby" | "playing" | "finished" | string | null;

/**
 * Délai avant le prochain sondage, en millisecondes.
 *
 * `visible` à false ne renvoie JAMAIS l'infini : c'est l'hôte qui fait avancer
 * les phases de la partie depuis son propre sondage, donc suspendre le sien
 * figerait le duel pour les deux joueurs, pas seulement pour lui. On lève le
 * pied, on ne s'arrête pas.
 */
export function cadenceSalon(ecran: EcranDuel, visible: boolean): number {
  if (!visible) return 2500;
  return ecran === "playing" ? 800 : 2000;
}

/** Requêtes par minute pour une cadence donnée — sert aux calculs de charge. */
export function requetesParMinute(delaiMs: number): number {
  return Math.round(60000 / delaiMs);
}
