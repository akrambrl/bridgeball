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

import { getLang } from "./lang";

export const SB_URL = "https://ialjlsrgcolocoaegzrc.supabase.co";
const SB_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhbGpsc3JnY29sb2NvYWVnenJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MDM3NzksImV4cCI6MjA5MTA3OTc3OX0.-SU8anuPhnpoa-PYhIHQqrcuOBsHxdtBJKRZuiGcGwM";

// Doit rester identique à SEASON_START dans LePont.jsx
const SEASON_START = new Date("2026-04-01T00:00:00Z");

export type SeasonInfo = { num: number; start: Date; end: Date; monthKey: string; monthLabel: string };

const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const MONTHS_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];

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
    monthLabel: (getLang() === "fr" ? MONTHS_FR : MONTHS_EN)[paris.getMonth()] + " " + paris.getFullYear(),
  };
}

// ── LES GRADES ONT ÉTÉ RETIRÉS ─────────────────────────────────────────────
//
// GRADES, Grade, gradeLabel et getGrade vivaient ici : cinq paliers nommés
// Amateur, Espoir, Titulaire, Légende, GOAT, affichés en pastille à côté d'un
// pseudo et en barre de progression.
//
// Ils faisaient DOUBLON avec les vingt-neuf cartes de collection, qui décrivent
// la même montée d'XP. Le fichier de test qui surveillait leur alignement le
// disait lui-même, et racontait comment les deux barèmes avaient déjà divergé au
// point d'être absurdes : on était « GOAT » dès 10 000 XP quand la carte « Le
// GOAT » en demandait 250 000.
//
// La collection a gagné parce qu'elle a un visuel, vingt-neuf paliers au lieu de
// cinq, et que l'une de ses cartes est déjà la photo de profil du joueur. Tout ce
// qui affichait un grade lit désormais `progressToNext` ou `levelCard`
// (src/lib/collection.ts).
//
// `getLang` reste importé plus haut : d'autres fonctions de ce fichier s'en
// servent.

/** Code pays ISO 2 lettres → emoji drapeau ("" si code invalide). */
export function countryToFlag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return "";
  const codePoints = code.toUpperCase().split("").map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

/** URL de la photo de profil d'un joueur (404 si aucune : prévoir un repli). */
export function avatarUrl(playerId: string): string {
  return SB_URL + "/storage/v1/object/public/avatars/" + playerId + ".jpg";
}

/** "global" = XP depuis toujours (onglet par défaut du mobile) · "saison" = XP du mois. */
export type LbMode = "global" | "saison";

export type TopPlayer = {
  rank: number;
  pid: string;
  name: string;
  score: number;
  /** XP cumulée — sert au grade, même en mode saison (comme sur mobile). */
  xp: number;
  country: string | null;
};

type PseudoRow = {
  player_id: string;
  pseudo: string | null;
  xp: number | null;
  xp_season: number | null;
  country: string | null;
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
    "/rest/v1/bb_pseudos?select=player_id,pseudo,xp,xp_season,country&limit=" +
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
    .map((r, i) => ({
      rank: i + 1,
      pid: r.player_id,
      name: r.pseudo || "?",
      score: valueOf(r),
      xp: r.xp || 0,
      country: r.country || null,
    }));
}

// ── MON PROFIL, VU DEPUIS LA LANDING ───────────────────────────────────────
//
// L'en-tête d'ordinateur affichait l'INITIALE du pseudo et la mention « LVL 1 »
// écrite en dur. Les deux étaient fausses au même titre : le grade de GOAT FC
// n'est pas un numéro de niveau mais une CARTE, celle que `levelCard(xp)`
// renvoie, et elle sert de photo de profil partout ailleurs — sur mobile, au
// classement, sur l'écran de duel. Sur ordinateur, un joueur à 60 000 XP voyait
// une lettre dans un rond et « LVL 1 ».
//
// L'XP ne vit pas en localStorage : elle est dans `bb_pseudos.xp` et LePont la
// charge au démarrage. La landing doit donc la lire elle-même, et c'est ici que
// se trouvent déjà l'URL et la clé publique du projet.
//
// Ne lève jamais : sans réseau, l'en-tête garde son pseudo local et n'affiche
// pas de carte, ce qui est exactement ce qu'il faisait avant.
export type MonProfil = { pseudo: string | null; xp: number };

// ── LE LOT EN JEU CE MOIS-CI ────────────────────────────────────────────────
//
// bb_lots (season_number, rang, intitule) est publique en LECTURE. Le classement
// d'ordinateur ne la lisait pas du tout : la récompense de fin de saison était
// invisible sur PC, alors qu'elle s'annonce sur mobile. On lit ici la ligne
// rang=1 de la saison DEMANDÉE (la saison en cours) pour l'annoncer pendant le
// mois. Ne lève jamais : sans lot défini, le bandeau ne s'affiche simplement pas.
export type LotEnJeu = { intitule: string };

export async function fetchLotEnJeu(seasonNumber: number): Promise<LotEnJeu | null> {
  if (!Number.isInteger(seasonNumber) || seasonNumber < 1) return null;
  try {
    const url =
      SB_URL +
      "/rest/v1/bb_lots?select=intitule&season_number=eq." +
      seasonNumber +
      "&rang=eq.1&limit=1";
    const res = await fetch(url, { headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY } });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0 || !rows[0].intitule) return null;
    return { intitule: String(rows[0].intitule) };
  } catch {
    return null;
  }
}

export async function fetchMonProfil(playerId: string): Promise<MonProfil | null> {
  if (!playerId) return null;
  try {
    const url =
      SB_URL +
      "/rest/v1/bb_pseudos?player_id=eq." +
      encodeURIComponent(playerId) +
      "&select=pseudo,xp&limit=1";
    const res = await fetch(url, { headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY } });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return { pseudo: rows[0].pseudo || null, xp: Number(rows[0].xp) || 0 };
  } catch {
    return null;
  }
}
