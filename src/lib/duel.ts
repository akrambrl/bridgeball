// ── Ce qu'est un duel « joué jusqu'au bout » ──────────────────────────────
//
// Il y a DEUX chemins pour terminer un face-à-face, et ils ne laissent pas le
// même statut en base :
//
//   `complete`   un défi envoyé à quelqu'un, puis joué par les deux ;
//   `open_done`  un défi OUVERT posté par un joueur, puis relevé par un autre.
//
// Les deux portent un challenger, un adversaire et les deux scores. Ce sont des
// face-à-face terminés à égalité de droits.
//
// Les écrans ne comptaient que `complete`. Or c'est de très loin le cas rare :
// au 8 août 2026, bb_duels contenait 98 `open_done` pour 1 seul `complete`.
// D'où des profils annonçant 0 victoire / 0 nul / 0 défaite face à des joueurs
// affrontés des dizaines de fois.
//
// Tous les autres statuts (`open`, `pending`, `ready`, `sent`, `waiting`,
// `challenger_played`, `opponent_played`, `cancelled`) désignent un duel en
// cours ou avorté : ils n'ont pas les deux scores et ne doivent rien compter.

export type Duel = {
  status?: string | null;
  challenger_id?: string | null;
  opponent_id?: string | null;
  challenger_score?: number | null;
  opponent_score?: number | null;
};

/** Le duel est-il allé à son terme, quel que soit le chemin emprunté ? */
export function duelTermine(d: Duel | null | undefined): boolean {
  return !!d && (d.status === "complete" || d.status === "open_done");
}

export type Bilan = { victoires: number; nuls: number; defaites: number; total: number };

/**
 * Bilan de `moi` face à `adversaire`.
 *
 * `adversaire` omis → bilan de `moi` contre tout le monde (l'historique des
 * défis), ce qui évite d'écrire deux fois la même boucle.
 */
export function bilanFaceAFace(duels: Duel[], moi: string, adversaire?: string): Bilan {
  const b: Bilan = { victoires: 0, nuls: 0, defaites: 0, total: 0 };
  for (const d of duels || []) {
    if (!duelTermine(d)) continue;
    const jeSuisChallenger = d.challenger_id === moi;
    const jeSuisAdversaire = d.opponent_id === moi;
    if (!jeSuisChallenger && !jeSuisAdversaire) continue;
    if (adversaire !== undefined) {
      const autre = jeSuisChallenger ? d.opponent_id : d.challenger_id;
      if (autre !== adversaire) continue;
    }
    const mien = (jeSuisChallenger ? d.challenger_score : d.opponent_score) || 0;
    const sien = (jeSuisChallenger ? d.opponent_score : d.challenger_score) || 0;
    b.total++;
    if (mien > sien) b.victoires++;
    else if (mien < sien) b.defaites++;
    else b.nuls++;
  }
  return b;
}
