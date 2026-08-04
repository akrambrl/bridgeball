// Source unique du classement, partagée par le desktop (LobbyView, LeaderboardView).
//
// Le mobile (LePont.jsx, loadLeaderboard) applique trois règles que le desktop
// ignorait, ce qui donnait deux classements différents selon l'appareil :
//   1. filtre sur la saison en cours (le classement se réinitialise chaque mois)
//   2. dédoublonnage par player_id, pas par pseudo — deux joueurs homonymes
//      restent distincts
//   3. fenêtre de 1000 lignes
// Toute modification ici doit rester alignée sur loadLeaderboard côté mobile.

const SB_URL = "https://ialjlsrgcolocoaegzrc.supabase.co";
const SB_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhbGpsc3JnY29sb2NvYWVnenJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MDM3NzksImV4cCI6MjA5MTA3OTc3OX0.-SU8anuPhnpoa-PYhIHQqrcuOBsHxdtBJKRZuiGcGwM";

// Doit rester identique à SEASON_START dans LePont.jsx
const SEASON_START = new Date("2026-04-01T00:00:00Z");

export type SeasonInfo = { num: number; start: Date; end: Date; monthKey: string };

// Même calcul que getCurrentSeason() dans LePont.jsx — saison = mois calendaire,
// fuseau Paris. Saison 1 = avril 2026.
export function getCurrentSeason(): SeasonInfo {
  const now = new Date();
  const paris = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const startParis = new Date(SEASON_START.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const num =
    (paris.getFullYear() - startParis.getFullYear()) * 12 +
    (paris.getMonth() - startParis.getMonth()) +
    1;
  return {
    num,
    start: new Date(paris.getFullYear(), paris.getMonth(), 1, 0, 0, 0),
    end: new Date(paris.getFullYear(), paris.getMonth() + 1, 1, 0, 0, 0),
    monthKey: paris.getFullYear() + "-" + String(paris.getMonth() + 1).padStart(2, "0"),
  };
}

export type TopPlayer = { rank: number; name: string; score: number };

/**
 * Meilleur score par joueur sur la saison en cours, classé décroissant.
 * @param top nombre d'entrées renvoyées
 */
export async function fetchTopPlayers(top: number): Promise<TopPlayer[]> {
  const season = getCurrentSeason();
  // Saison 1 : pas de filtre date (tous les scores historiques), comme sur mobile
  const seasonFilter =
    season.num > 1
      ? "&created_at=gte." + season.start.toISOString() + "&created_at=lt." + season.end.toISOString()
      : "";
  const url =
    SB_URL +
    "/rest/v1/bb_scores?order=score.desc&limit=1000&select=player_id,player_name,score" +
    seasonFilter;

  const res = await fetch(url, { headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY } });
  if (!res.ok) return [];
  const rows: { player_id: string; player_name: string; score: number }[] = await res.json();
  if (!Array.isArray(rows)) return [];

  // Dédoublonnage par player_id : on garde le meilleur score, et le pseudo
  // porté par ce score-là.
  const best: Record<string, { name: string; score: number }> = {};
  rows.forEach((r) => {
    if (!r.player_id || !r.player_name) return;
    const cur = best[r.player_id];
    if (!cur || r.score > cur.score) best[r.player_id] = { name: r.player_name, score: r.score };
  });

  return Object.values(best)
    .sort((a, b) => b.score - a.score)
    .slice(0, top)
    .map((p, i) => ({ rank: i + 1, name: p.name, score: p.score }));
}
