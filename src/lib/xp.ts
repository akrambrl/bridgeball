// Calcul des totaux d'XP après une partie.
//
// Ce fichier existe à cause d'un défaut de production : le champion de juillet
// avait 33 700 XP dans bb_seasons et 5 065 dans bb_pseudos. La cause était que
// le total cumulé était calculé depuis l'état React (`playerXp + gain`) puis
// écrit tel quel dans la base. Un état local à 0 — nouvel appareil, stockage
// vidé, lecture du pseudo qui échoue alors que pseudoConfirmed a été restauré
// depuis localStorage — remplaçait donc le total stocké par « 0 + gain ». La
// signature se lisait sur 78 des 176 lignes : xp exactement égal à xp_season
// chez des joueurs qui jouaient depuis des mois.
//
// La règle : le cumul écrit ne peut jamais être inférieur à celui déjà stocké.
// D'où le max() sur la base, et non l'état local seul.

export type EtatXp = {
  /** Total cumulé dans l'état React. Peut être 0 à tort. */
  localXp: number;
  /** XP du mois dans l'état React. */
  localXpSeason: number;
  /** Total cumulé lu sur la ligne serveur. */
  serverXp: number;
  /** XP du mois lu sur la ligne serveur. */
  serverXpSeason: number;
  /** Mois auquel appartient serverXpSeason (ex. "2026-08"), ou null. */
  serverMonth: string | null | undefined;
  /** Mois en cours. */
  currentMonth: string;
  /** XP gagnée par cette partie (déjà positive). */
  gain: number;
};

function nombre(v: unknown): number {
  return typeof v === "number" && isFinite(v) && v > 0 ? v : 0;
}

export function prochainsTotauxXp(e: EtatXp): { xp: number; xpSeason: number; base: number } {
  // Base cumulée : le plus élevé des deux. Le serveur fait autorité quand
  // l'état local est en retard, l'état local quand plusieurs parties se sont
  // enchaînées plus vite que les écritures.
  const base = Math.max(nombre(e.localXp), nombre(e.serverXp));
  // XP de saison : la valeur serveur ne compte que si elle porte le mois en
  // cours. Sinon elle appartient au mois précédent et la saison repart de zéro,
  // même si le joueur n'a pas ouvert l'app au changement de mois.
  const baseSaison = e.serverMonth === e.currentMonth
    ? Math.max(nombre(e.localXpSeason), nombre(e.serverXpSeason))
    : 0;
  const gain = Math.max(0, nombre(e.gain));
  return { base, xp: base + gain, xpSeason: baseSaison + gain };
}
