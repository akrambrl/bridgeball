// Source unique du classement, partagée par le desktop (LobbyView, LeaderboardView).
//
// ⚠️ Le classement de GOAT FC se compte en **XP**, pas en meilleur score.
// Le mobile (LePont.jsx, loadLeaderboard) propose deux onglets :
//   • "global" (celui affiché par défaut) → XP cumulée depuis toujours
//     (bb_pseudos.xp). Après avoir agrégé bb_scores, le mobile écrase le score
//     par `row.score = row.xp`, ajoute tous les joueurs qui ont de l'XP puis
//     re-trie : le haut du tableau est donc exactement bb_pseudos trié par xp.
//   • "saison" → XP du mois en cours (bb_pseudos.xp_season, filtré sur
//     xp_season_month = mois courant).
// Le desktop classait par meilleur score d'une partie (bb_scores) : d'où deux
// classements totalement différents selon l'appareil. On reproduit ici les deux
// requêtes du mobile. Toute modification doit rester alignée sur
// loadLeaderboard côté mobile.

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

/** "global" = XP depuis toujours (onglet par défaut du mobile) · "saison" = XP du mois. */
export type LbMode = "global" | "saison";

export type TopPlayer = { rank: number; name: string; score: number };

type PseudoRow = {
  player_id: string;
  pseudo: string | null;
  xp: number | null;
  xp_season: number | null;
};

// On demande large puis on trie/filtre côté client : `order=…desc` place les
// NULL en premier côté Postgres, on ne peut donc pas se fier au `limit` seul.
const FETCH_WINDOW = 300;

/**
 * Classement par XP, identique au mobile.
 * @param top nombre d'entrées renvoyées
 * @param mode "global" (XP cumulée, défaut) ou "saison" (XP du mois en cours)
 */
export async function fetchTopPlayers(top: number, mode: LbMode = "global"): Promise<TopPlayer[]> {
  const seasonFilter =
    mode === "saison" ? "&xp_season_month=eq." + getCurrentSeason().monthKey : "";
  const url =
    SB_URL +
    "/rest/v1/bb_pseudos?select=player_id,pseudo,xp,xp_season&limit=" +
    FETCH_WINDOW +
    "&order=" +
    (mode === "saison" ? "xp_season" : "xp") +
    ".desc" +
    seasonFilter;

  const res = await fetch(url, { headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY } });
  if (!res.ok) return [];
  const rows: PseudoRow[] = await res.json();
  if (!Array.isArray(rows)) return [];

  const valueOf = (r: PseudoRow) => (mode === "saison" ? r.xp_season : r.xp) || 0;

  return rows
    .filter((r) => r.player_id && valueOf(r) > 0)
    .sort((a, b) => valueOf(b) - valueOf(a))
    .slice(0, top)
    .map((r, i) => ({ rank: i + 1, name: r.pseudo || "?", score: valueOf(r) }));
}
