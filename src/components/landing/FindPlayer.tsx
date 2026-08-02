import { useEffect, useMemo, useRef, useState } from "react";
import { PLAYERS, GG_WC_WINNERS, GG_CL_WINNERS, GG_BALLON_DOR, GG_SHIRT_10 } from "../../players.jsx";
import { CLUB_COLORS } from "../LePont.jsx";
import { ANEC_ENTRAINEUR } from "./GoatGuess";
import { tr } from "@/lib/lang";
import { trackPlay } from "../../lib/track";
import { isNative, hapticLight, hapticHeavy, hapticSuccess } from "@/lib/native";
import { CLUB_SPELLS, wereTeammates, mightHaveBeenTeammates, hasSpells } from "@/lib/clubSpells";

const SPELL_NAMES = Object.keys(CLUB_SPELLS);

// ─────────────────────────────────────────────────────────────
// TROUVE LE JOUEUR DU JOUR — devine le joueur mystère à partir de son
// parcours de clubs (visuel) + une phrase d'indice, feedback façon Wordle.
// 1 partie/jour, même joueur pour tous, classement + partage.
// ─────────────────────────────────────────────────────────────

type Player = {
  name: string;
  clubs: string[];
  diff: "facile" | "moyen" | "expert";
  nationalities: string[];
  positions: string[];
  birthYear?: number;
};

const SB_URL = "https://ialjlsrgcolocoaegzrc.supabase.co";
const SB_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhbGpsc3JnY29sb2NvYWVnenJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MDM3NzksImV4cCI6MjA5MTA3OTc3OX0.-SU8anuPhnpoa-PYhIHQqrcuOBsHxdtBJKRZuiGcGwM";

const MAX_GUESSES = 6;
const ALL = PLAYERS as Player[];

// Révélation puce par puce (suspens, façon « Who Are Ya »)
const CHIP_STAGGER = 0.38; // secondes entre chaque puce (révélation plus lente)
const CHIP_DUR = 0.6; // durée d'apparition d'une puce
const REVEAL_MS = Math.round((5 * CHIP_STAGGER + CHIP_DUR) * 1000) + 250; // 6 puces (index 0..5)

// ── Helpers seed / date ──────────────────────────────────────
function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
function parisDay(): string {
  const d = new Date();
  const p = new Date(d.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  return p.getFullYear() + "-" + String(p.getMonth() + 1).padStart(2, "0") + "-" + String(p.getDate()).padStart(2, "0");
}

// ── Joueur mystère du jour ────────────────────────────────────
// Pool de stars (facile, parcours ≥ 3 clubs), mélangé une fois dans un ordre
// FIXE (même pour tout le monde), puis on tourne selon le numéro de jour →
// chaque joueur passe une seule fois avant un cycle complet (pas de répétition).
function dailyPlayer(): Player {
  let pool = ALL.filter(p => p.diff === "facile" && p.clubs && p.clubs.length >= 3 && p.clubs.length <= 9);
  if (pool.length === 0) pool = ALL.filter(p => p.clubs && p.clubs.length >= 3);
  const rand = seededRandom(987654321); // graine fixe → même ordre pour tous
  const arr = pool.slice();
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
  const dayIdx = Math.floor(Date.parse(parisDay() + "T00:00:00Z") / 86400000);
  return arr[((dayIdx % arr.length) + arr.length) % arr.length];
}

// ── Mode illimité : un joueur au hasard, sans répétition proche ────────────────
// Jamais de joueur "expert" : 70 % facile, 30 % moyen. Que des joueurs modernes
// (né en 1975+ → a joué après 2000), pas d'anciens.
const MODERN_MIN_BY = 1975;
function randomPlayer(seen: Set<string>): Player {
  const inRange = (p: Player) => !!p.clubs && p.clubs.length >= 3 && p.clubs.length <= 9 && !!p.birthYear && (p.birthYear as number) >= MODERN_MIN_BY;
  const facile = ALL.filter(p => p.diff === "facile" && inRange(p));
  const moyen = ALL.filter(p => p.diff === "moyen" && inRange(p));
  const wantFacile = Math.random() < 0.7; // 70 % facile / 30 % moyen
  let pool = wantFacile ? facile : moyen;
  if (pool.length === 0) pool = wantFacile ? moyen : facile; // sécurité si un pool est vide
  // Anti-répétition PAR POOL : quand un pool est épuisé, on ne recycle QUE ce pool
  // (sinon le petit pool "facile" se vide et casse la pondération 70/30).
  let cand = pool.filter(p => !seen.has(p.name));
  if (cand.length === 0) { pool.forEach(p => seen.delete(p.name)); cand = pool; }
  const pick = cand[Math.floor(Math.random() * cand.length)];
  seen.add(pick.name);
  return pick;
}

function clubColors(name: string): [string, string] {
  return ((CLUB_COLORS as Record<string, [string, string]>)[name]) || ["#1a7a3a", "#FFFFFF"];
}

// Drapeaux pour les nations foot courantes (données en français)
const NAT_FLAG: Record<string, string> = {
  France: "🇫🇷", Portugal: "🇵🇹", Argentine: "🇦🇷", Brésil: "🇧🇷", Espagne: "🇪🇸", Angleterre: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", Allemagne: "🇩🇪",
  Italie: "🇮🇹", "Pays-Bas": "🇳🇱", Belgique: "🇧🇪", Croatie: "🇭🇷", Uruguay: "🇺🇾", Colombie: "🇨🇴", Maroc: "🇲🇦",
  Algérie: "🇩🇿", Sénégal: "🇸🇳", "Côte d'Ivoire": "🇨🇮", Cameroun: "🇨🇲", Nigeria: "🇳🇬", Ghana: "🇬🇭", Danemark: "🇩🇰",
  Suède: "🇸🇪", Norvège: "🇳🇴", Suisse: "🇨🇭", Pologne: "🇵🇱", "République tchèque": "🇨🇿", Serbie: "🇷🇸", Turquie: "🇹🇷",
  Grèce: "🇬🇷", Mexique: "🇲🇽", Japon: "🇯🇵", "États-Unis": "🇺🇸", Mali: "🇲🇱", Écosse: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "Pays de Galles": "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
  Irlande: "🇮🇪", Autriche: "🇦🇹", Ukraine: "🇺🇦", Russie: "🇷🇺", Égypte: "🇪🇬", Gabon: "🇬🇦", Slovénie: "🇸🇮",
  Tchéquie: "🇨🇿", "Corée du Sud": "🇰🇷", Équateur: "🇪🇨", Albanie: "🇦🇱", "RD Congo": "🇨🇩", Chili: "🇨🇱",
  Tunisie: "🇹🇳", Slovaquie: "🇸🇰", "Irlande du Nord": "🇬🇧", Guinée: "🇬🇳", Hongrie: "🇭🇺", Roumanie: "🇷🇴",
  "Bosnie-Herzégovine": "🇧🇦", Bosnie: "🇧🇦", Géorgie: "🇬🇪", Paraguay: "🇵🇾", Australie: "🇦🇺", "Macédoine du Nord": "🇲🇰",
  Islande: "🇮🇸", Canada: "🇨🇦", Pérou: "🇵🇪", Iran: "🇮🇷", Togo: "🇹🇬", Bulgarie: "🇧🇬", Honduras: "🇭🇳",
  "Afrique du Sud": "🇿🇦", Jamaïque: "🇯🇲", "Costa Rica": "🇨🇷", "Nouvelle-Zélande": "🇳🇿", "Burkina Faso": "🇧🇫",
  Kosovo: "🇽🇰", Monténégro: "🇲🇪", Jordanie: "🇯🇴", Centrafrique: "🇨🇫", Kenya: "🇰🇪", Arménie: "🇦🇲", Soudan: "🇸🇩",
  Ouzbékistan: "🇺🇿", Gambie: "🇬🇲", Angola: "🇦🇴", Qatar: "🇶🇦", Venezuela: "🇻🇪", Israël: "🇮🇱",
  "République du Congo": "🇨🇬", Finlande: "🇫🇮", Biélorussie: "🇧🇾", Bénin: "🇧🇯", Oman: "🇴🇲",
};
function natLabel(nat: string): string { return (NAT_FLAG[nat] ? NAT_FLAG[nat] + " " : "") + nat; }

// Continent (zone) de chaque nationalité foot → code court affiché dans la puce.
const NAT_CONT: Record<string, string> = {
  France: "EU", Portugal: "EU", Espagne: "EU", Angleterre: "EU", Allemagne: "EU", Italie: "EU",
  "Pays-Bas": "EU", Belgique: "EU", Croatie: "EU", Danemark: "EU", Suède: "EU", Norvège: "EU",
  Suisse: "EU", Pologne: "EU", "République tchèque": "EU", Serbie: "EU", Turquie: "EU", Grèce: "EU",
  Écosse: "EU", "Pays de Galles": "EU", Irlande: "EU", "Irlande du Nord": "EU", Autriche: "EU", Ukraine: "EU", Russie: "EU",
  Slovénie: "EU", Hongrie: "EU", Roumanie: "EU", Slovaquie: "EU", "Bosnie-Herzégovine": "EU", Bulgarie: "EU",
  Islande: "EU", Finlande: "EU", Albanie: "EU", "Macédoine du Nord": "EU", Monténégro: "EU", Géorgie: "EU", Arménie: "EU",
  Argentine: "AmS", Brésil: "AmS", Uruguay: "AmS", Colombie: "AmS", Chili: "AmS", Pérou: "AmS",
  Paraguay: "AmS", Équateur: "AmS", Venezuela: "AmS", Bolivie: "AmS",
  Mexique: "AmN", "États-Unis": "AmN", Canada: "AmN", "Costa Rica": "AmN", Honduras: "AmN", Panama: "AmN", Jamaïque: "AmN",
  Maroc: "AF", Algérie: "AF", Sénégal: "AF", "Côte d'Ivoire": "AF", Cameroun: "AF", Nigeria: "AF",
  Ghana: "AF", Mali: "AF", Égypte: "AF", Gabon: "AF", Tunisie: "AF", "Afrique du Sud": "AF",
  "RD Congo": "AF", Congo: "AF", "Burkina Faso": "AF", Guinée: "AF", Togo: "AF", Angola: "AF", Kenya: "AF", Zambie: "AF", "Cap-Vert": "AF",
  Japon: "AS", "Corée du Sud": "AS", Iran: "AS", "Arabie saoudite": "AS", Chine: "AS", Qatar: "AS",
  Irak: "AS", "Émirats arabes unis": "AS", Ouzbékistan: "AS",
  Australie: "OC", "Nouvelle-Zélande": "OC",
  Tchéquie: "EU", Kosovo: "EU", Bosnie: "EU", Biélorussie: "EU", Israël: "EU",
  Jordanie: "AS", Oman: "AS",
  Centrafrique: "AF", Soudan: "AF", Gambie: "AF", "République du Congo": "AF", Bénin: "AF",
};
function continentOf(nat?: string): string { return (nat && NAT_CONT[nat]) || "?"; }
const NOW_Y = new Date().getFullYear();

function posLabel(pos: string): string {
  const l = pos.toLowerCase();
  if (l.includes("gardien")) return tr("Gardien", "Goalkeeper", "Torwart", "Portiere", "Goleiro");
  if (l.includes("défenseur") || l.includes("defenseur")) return tr("Défenseur", "Defender", "Verteidiger", "Difensore", "Zagueiro");
  if (l.includes("milieu")) return tr("Milieu", "Midfielder", "Mittelfeld", "Centrocampista", "Meio-campo");
  return tr("Attaquant", "Forward", "Stürmer", "Attaccante", "Atacante");
}
function posEmoji(pos: string): string {
  const l = pos.toLowerCase();
  if (l.includes("gardien")) return "🧤";
  if (l.includes("défenseur") || l.includes("defenseur")) return "🛡️";
  if (l.includes("milieu")) return "🎯";
  return "⚡";
}

// Icône terrain de foot (façon « Mode Infini ») : un point rouge situe le poste
// (bas = gardien, haut = attaquant).
function PitchIcon({ pos, size = 26 }: { pos: string; size?: number }) {
  const l = (pos || "").toLowerCase();
  let cy = 26; // attaquant (haut)
  if (l.includes("gardien")) cy = 90;
  else if (l.includes("défenseur") || l.includes("defenseur")) cy = 74;
  else if (l.includes("milieu")) cy = 50;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block" }}>
      <rect x="3" y="3" width="94" height="94" rx="8" fill="#2E7D32" stroke="#1b5e20" strokeWidth="3" />
      <line x1="3" y1="50" x2="97" y2="50" stroke="#fff" strokeWidth="2.5" opacity="0.85" />
      <circle cx="50" cy="50" r="13" fill="none" stroke="#fff" strokeWidth="2.5" opacity="0.85" />
      <rect x="36" y="3" width="28" height="10" fill="none" stroke="#fff" strokeWidth="2.5" opacity="0.75" />
      <rect x="36" y="87" width="28" height="10" fill="none" stroke="#fff" strokeWidth="2.5" opacity="0.75" />
      <circle cx="50" cy={cy} r="11" fill="#FF3D57" stroke="#fff" strokeWidth="2.5" />
    </svg>
  );
}
const CONT_BG = "radial-gradient(circle at 34% 28%, #3568a0 0%, #123a63 55%, #0a1e35 100%)";

// ── Retour haptique ───────────────────────────────────────────────────────────
// 3 chemins selon la plateforme :
//  • App native (Capacitor iOS/Android) → vraies vibrations via @capacitor/haptics.
//  • Web Android → navigator.vibrate.
//  • Web iOS (Safari/PWA) → interrupteur caché (input switch), seul « haptique »
//    dispo sur iOS Safari 17.4+ (aucune API vibrate).
let _hapEl: HTMLLabelElement | null = null;
function iosTick() {
  try {
    if (typeof document === "undefined") return;
    if (!_hapEl) {
      const label = document.createElement("label");
      label.setAttribute("aria-hidden", "true");
      // display:none = implémentation éprouvée (lib ios-haptics) ; l'astuce marche
      // même caché, tant que l'input « switch » est bien basculé.
      label.style.display = "none";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.setAttribute("switch", "");
      label.appendChild(input);
      document.body.appendChild(label);
      _hapEl = label;
    }
    _hapEl.click();
  } catch { /* noop */ }
}
function haptic(kind: "hit" | "multi" | "win") {
  // 1) App native : retour haptique système (le plus fiable).
  try {
    if (isNative()) {
      if (kind === "win") hapticSuccess();
      else if (kind === "multi") hapticHeavy();
      else hapticLight();
      return;
    }
  } catch { /* noop */ }
  // 2) Web : navigator.vibrate (Android) + astuce switch (iOS Safari).
  try {
    const v = (navigator as any).vibrate;
    if (typeof v === "function") {
      if (kind === "win") v.call(navigator, [70, 50, 150]);
      else if (kind === "multi") v.call(navigator, [30, 40, 30, 40, 30]);
      else v.call(navigator, 45);
    }
  } catch { /* noop */ }
  iosTick();
}

type State = "ok" | "close" | "no";
type Chip = { key: string; label: string; top: string; big?: boolean; state: State; arrow?: "up" | "down"; bg?: string; fg?: string };

// Coéquipiers probables : mêmes clubs + même génération (±4 ans de naissance →
// forte chance d'avoir joué ensemble, faute de données d'années par club).
// Déterministe (même résultat pour tout le monde).
function findTeammates(answer: Player, n: number): string[] {
  const ay = answer.birthYear || 0;
  if (!ay) return [];
  const cands = ALL.filter(p =>
    p.name !== answer.name &&
    p.birthYear && Math.abs((p.birthYear as number) - ay) <= 4 &&
    p.clubs.some(c => answer.clubs.includes(c))
  );
  const rank = (d: string) => (d === "facile" ? 0 : d === "moyen" ? 1 : 2);
  cands.sort((a, b) => {
    if (rank(a.diff) !== rank(b.diff)) return rank(a.diff) - rank(b.diff);
    const sa = a.clubs.filter(c => answer.clubs.includes(c)).length;
    const sb = b.clubs.filter(c => answer.clubs.includes(c)).length;
    if (sb !== sa) return sb - sa;
    return a.name.localeCompare(b.name);
  });
  return cands.slice(0, n).map(p => p.name);
}

// Code court d'un club pour la puce (ex. "Real Madrid" → "REA", "Inter Milan" → "INT").
function clubCode(name: string): string {
  const clean = name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z ]/g, "").trim();
  const words = clean.split(/\s+/).filter(w => !/^(fc|cf|ac|as|ss|sc|afc|cd|rc|us|ud|sv|vfb|vfl|bsc|1|de|of|the)$/i.test(w));
  const base = (words[0] || clean).toUpperCase();
  return base.slice(0, 3) || "?";
}

// Feedback façon « Who Are Ya » : chaque attribut de la proposition est comparé
// au joueur mystère → puce ronde + pastille ✓ (vert) / ✗ (rouge) / ↑↓ (âge).
function computeChips(guess: Player, answer: Player): Chip[] {
  const natMatch = guess.nationalities.some(n => answer.nationalities.includes(n));
  const gCont = continentOf(guess.nationalities[0]);
  const aCont = continentOf(answer.nationalities[0]);
  const contMatch = gCont !== "?" && gCont === aCont;
  const posMatch = guess.positions.some(p => answer.positions.some(a => a.toLowerCase() === p.toLowerCase()));
  const shared = guess.clubs.filter(c => answer.clubs.includes(c)).length;
  const gy = guess.birthYear || 0, ay = answer.birthYear || 0;
  // Âge affiché = celui de la proposition ; flèche = sens vers le mystère.
  const gAge = gy ? NOW_Y - gy : 0;
  let ageState: State = "no"; let ageArrow: "up" | "down" | undefined;
  if (gy && ay) {
    const dAge = (NOW_Y - ay) - gAge; // >0 → mystère plus vieux
    if (dAge === 0) ageState = "ok";
    else { ageArrow = dAge > 0 ? "up" : "down"; ageState = Math.abs(dAge) <= 2 ? "close" : "no"; }
  }
  const clubState: State = shared >= 3 ? "ok" : shared >= 1 ? "close" : "no";
  const flag = guess.nationalities[0] ? (NAT_FLAG[guess.nationalities[0]] || guess.nationalities[0].slice(0, 3).toUpperCase()) : "?";
  // Dernier club (club « actuel » en fin de carrière) — comme la référence.
  const gLast = guess.clubs[guess.clubs.length - 1] || "";
  const aLast = answer.clubs[answer.clubs.length - 1] || "";
  const lastState: State = gLast && aLast && gLast === aLast ? "ok" : (gLast && answer.clubs.includes(gLast) ? "close" : "no");
  const [lbg, lfg] = clubColors(gLast);
  return [
    { key: "nat", label: tr("NAT", "NAT", "NAT", "NAZ", "NAC"), top: flag, big: true, state: natMatch ? "ok" : "no" },
    { key: "cont", label: tr("ZONE", "ZONE", "ZONE", "ZONA", "ZONA"), top: gCont, state: contMatch ? "ok" : "no", bg: CONT_BG, fg: "#dff0ff" },
    { key: "pos", label: tr("POSTE", "POS", "POS", "RUOLO", "POS"), top: posEmoji(guess.positions[0] || ""), big: true, state: posMatch ? "ok" : "no" },
    { key: "age", label: tr("ÂGE", "AGE", "ALTER", "ETÀ", "IDADE"), top: gAge ? String(gAge) : "?", state: ageState, arrow: ageArrow },
    { key: "lastclub", label: tr("CLUB", "CLUB", "KLUB", "CLUB", "CLUBE"), top: gLast ? clubCode(gLast) : "?", state: lastState, bg: lbg, fg: lfg },
    { key: "clubs", label: tr("COMMUNS", "SHARED", "GETEILT", "COMUNI", "COMUNS"), top: "🛡" + shared, state: clubState },
  ];
}
const SQ: Record<State, string> = { ok: "🟩", close: "🟨", no: "⬛" };

// ── Données pour les phrases de devinette (indices « déjà dispo ») ────────────
// Grands clubs reconnaissables (pour « J'ai porté le maillot de … »).
const BIG_CLUBS = new Set<string>([
  "Manchester United", "Manchester City", "Liverpool", "Chelsea", "Arsenal", "Tottenham", "Newcastle", "Everton", "Aston Villa", "West Ham",
  "Real Madrid", "Barcelona", "Atletico Madrid", "Sevilla", "Valencia", "Villarreal", "Real Betis", "Real Sociedad", "Athletic Bilbao",
  "Juventus FC", "AC Milan", "Inter Milan", "SSC Napoli", "AS Roma", "SS Lazio", "Atalanta BC", "ACF Fiorentina",
  "Bayern Munich", "Borussia Dortmund", "Bayer Leverkusen", "RB Leipzig", "Eintracht Frankfurt", "Wolfsburg", "Schalke",
  "PSG", "Marseille", "Lyon", "Monaco", "Lille", "Rennes",
  "Al Nassr", "Al Hilal", "Al Ittihad", "Al Ahli", "Porto", "Benfica", "Sporting CP", "Ajax Amsterdam", "PSV Eindhoven",
  "Flamengo", "Santos", "Palmeiras", "Corinthians", "São Paulo", "Galatasaray", "Fenerbahce", "Besiktas", "Celtic", "Rangers", "Inter Miami",
]);
// Club → pays (pour « J'ai évolué en … »).
const CLUB_COUNTRY: Record<string, string> = {};
((): void => {
  const add = (country: string, clubs: string[]) => clubs.forEach(c => { CLUB_COUNTRY[c] = country; });
  add("France", ["PSG", "Marseille", "Lyon", "Monaco", "Lille", "Rennes", "Nice", "Nantes", "Toulouse", "Montpellier", "Reims", "Strasbourg", "Brest", "Metz", "Saint-Etienne", "Bordeaux", "Le Havre", "Lens", "Lorient", "Auxerre", "Angers", "Sochaux", "Bastia", "Guingamp", "Nancy", "Nîmes", "Amiens", "Clermont", "Troyes", "Stade Brestois", "Valenciennes", "Ajaccio", "Paris FC"]);
  add("Angleterre", ["Manchester United", "Manchester City", "Liverpool", "Chelsea", "Arsenal", "Tottenham", "Newcastle", "Everton", "Aston Villa", "West Ham", "Leicester City", "Brighton", "Brentford", "Crystal Palace", "Fulham", "Nottingham Forest", "Bournemouth", "Wolverhampton", "Southampton", "Leeds United", "Burnley", "Watford", "Norwich City", "Sheffield United", "Stoke City", "Swansea", "Sunderland", "West Brom", "Ipswich Town", "Middlesbrough", "QPR", "Bolton", "Preston", "Reading", "Millwall", "Barnsley", "Hull City", "Blackburn", "Portsmouth", "Sheffield Wednesday", "Bournemouth"]);
  add("Espagne", ["Real Madrid", "Barcelona", "Atletico Madrid", "Sevilla", "Valencia", "Villarreal", "Real Betis", "Real Sociedad", "Athletic Bilbao", "Celta Vigo", "Getafe", "Osasuna", "Espanyol", "Girona", "Mallorca", "Real Mallorca", "Las Palmas", "Cádiz", "Almería", "Alavés", "Elche", "Málaga", "Deportivo", "Real Zaragoza", "Levante", "Granada", "Eibar"]);
  add("Italie", ["Juventus FC", "AC Milan", "Inter Milan", "SSC Napoli", "AS Roma", "SS Lazio", "Atalanta BC", "ACF Fiorentina", "Torino FC", "Bologna FC", "Bologna", "Sassuolo", "Udinese Calcio", "Genoa CFC", "Sampdoria", "Hellas Verona", "Cagliari Calcio", "Lecce", "Monza", "Spezia", "Parma FC", "Palermo", "Empoli FC", "Salernitana", "Brescia", "Bari"]);
  add("Allemagne", ["Bayern Munich", "Borussia Dortmund", "Bayer Leverkusen", "RB Leipzig", "Stuttgart", "Eintracht Frankfurt", "Wolfsburg", "Borussia Mönchengladbach", "Hoffenheim", "Mainz", "Schalke", "Hamburg", "Hertha Berlin", "Union Berlin", "SC Freiburg", "Augsburg", "Köln", "Werder Bremen", "Nuremberg"]);
  add("Portugal", ["Porto", "Benfica", "Sporting CP", "Braga", "Boavista", "Estoril", "Vitória Guimarães"]);
  add("Pays-Bas", ["Ajax Amsterdam", "PSV Eindhoven", "Feyenoord", "AZ Alkmaar", "Vitesse", "Heerenveen", "Groningen", "Twente", "Utrecht", "Sparta Rotterdam"]);
  add("Arabie saoudite", ["Al Nassr", "Al Hilal", "Al Ittihad", "Al Ahli"]);
  add("Brésil", ["Flamengo", "Santos", "Palmeiras", "Corinthians", "São Paulo", "Vasco da Gama", "Grêmio", "Internacional", "Fluminense", "Athletico Paranaense", "Cruzeiro", "Botafogo"]);
  add("Turquie", ["Galatasaray", "Fenerbahce", "Besiktas", "Trabzonspor"]);
  add("États-Unis", ["Inter Miami", "LAFC", "Chicago Fire", "Orlando City", "LA Galaxy", "Colorado Rapids", "Tampa Bay Mutiny", "Miami Fusion"]);
  add("Écosse", ["Celtic", "Rangers"]);
})();
// Pays → phrase locative (FR correct) + nom traduit.
const COUNTRY_INFO: Record<string, { fr: string; en: string; de: string; it: string; pt: string }> = {
  France: { fr: "en France", en: "France", de: "Frankreich", it: "Francia", pt: "França" },
  Angleterre: { fr: "en Angleterre", en: "England", de: "England", it: "Inghilterra", pt: "Inglaterra" },
  Espagne: { fr: "en Espagne", en: "Spain", de: "Spanien", it: "Spagna", pt: "Espanha" },
  Italie: { fr: "en Italie", en: "Italy", de: "Italien", it: "Italia", pt: "Itália" },
  Allemagne: { fr: "en Allemagne", en: "Germany", de: "Deutschland", it: "Germania", pt: "Alemanha" },
  Portugal: { fr: "au Portugal", en: "Portugal", de: "Portugal", it: "Portogallo", pt: "Portugal" },
  "Pays-Bas": { fr: "aux Pays-Bas", en: "the Netherlands", de: "den Niederlanden", it: "Olanda", pt: "Holanda" },
  "Arabie saoudite": { fr: "en Arabie saoudite", en: "Saudi Arabia", de: "Saudi-Arabien", it: "Arabia Saudita", pt: "Arábia Saudita" },
  Brésil: { fr: "au Brésil", en: "Brazil", de: "Brasilien", it: "Brasile", pt: "Brasil" },
  Turquie: { fr: "en Turquie", en: "Turkey", de: "der Türkei", it: "Turchia", pt: "Turquia" },
  "États-Unis": { fr: "aux États-Unis", en: "the USA", de: "den USA", it: "USA", pt: "EUA" },
  Écosse: { fr: "en Écosse", en: "Scotland", de: "Schottland", it: "Scozia", pt: "Escócia" },
};
function hashStr(s: string, mult: number): number { let h = 0; for (let i = 0; i < s.length; i++) h = (h * mult + s.charCodeAt(i)) >>> 0; return h; }

// Manche en cours sauvegardée (sessionStorage) : permet de RETROUVER sa partie si
// l'app est rechargée par iOS quand on la quitte un instant (ex. faire une capture
// d'écran pour l'envoyer à un pote). On restaure le joueur mystère, les propositions
// déjà faites et les indices révélés — au lieu de repartir de l'accueil.
const ROUND_KEY = "bb_findplayer_round";
type SavedRound = { answer: Player; guesses: Player[]; hintRevealed: string[]; over: boolean; won: boolean; lastEarned: number; streak: number; cluesShown: number };
function loadSavedRound(raw: string | null): SavedRound | null {
  try {
    if (!raw) return null;
    const s = JSON.parse(raw);
    const byName = (n: string) => ALL.find(p => p.name === n) || null;
    const answer = byName(s.answer);
    if (!answer) return null;
    const guesses = (s.guesses || []).map(byName).filter(Boolean) as Player[];
    return { answer, guesses, hintRevealed: Array.isArray(s.hintRevealed) ? s.hintRevealed : [], over: !!s.over, won: !!s.won, lastEarned: Number(s.lastEarned) || 0, streak: Number(s.streak) || 0, cluesShown: Number(s.cluesShown) || 1 };
  } catch { return null; }
}

export const FindPlayer = ({ onClose, daily = false }: { onClose: () => void; daily?: boolean }) => {
  const seenRef = useRef<Set<string>>(new Set());
  // En mode « Devinette du jour » : 1 joueur/jour partagé, sauvegarde persistante
  // par jour (localStorage) → on retrouve son résultat même après avoir fermé.
  // En mode illimité : sauvegarde de session (sessionStorage) qui se réinitialise.
  const storeKey = daily ? "bb_devinette_" + parisDay() : ROUND_KEY;
  const store: Storage | null = (() => { try { return daily ? localStorage : sessionStorage; } catch { return null; } })();
  const savedRef = useRef<SavedRound | null | undefined>(undefined);
  if (savedRef.current === undefined) savedRef.current = loadSavedRound(store ? store.getItem(storeKey) : null);
  const saved = savedRef.current;
  const [answer, setAnswer] = useState<Player>(() => saved?.answer || (daily ? dailyPlayer() : randomPlayer(seenRef.current)));

  const [guesses, setGuesses] = useState<Player[]>(() => saved?.guesses || []);
  const [over, setOver] = useState(() => saved?.over || false);
  const [won, setWon] = useState(() => saved?.won || false);
  const [input, setInput] = useState("");
  const [board, setBoard] = useState<{ loading: boolean; rows: any[]; myRank: number | null; total: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [riddleCopied, setRiddleCopied] = useState(false);
  const [showRiddle, setShowRiddle] = useState(false); // aperçu de l'énigme « Qui suis-je ? »
  const [reportOpen, setReportOpen] = useState(false); // fenêtre « Signaler une erreur »
  const [reportNote, setReportNote] = useState("");
  const [reportSent, setReportSent] = useState(false);
  const [showCareer, setShowCareer] = useState(false); // parcours caché par défaut (déduction pure)
  const [animRow, setAnimRow] = useState(-1); // index de la proposition à révéler puce par puce
  const [revealing, setRevealing] = useState(false); // révélation en cours (bloque la saisie sur la manche finale)
  const [hintRevealed, setHintRevealed] = useState<string[]>(() => saved?.hintRevealed || []); // attributs révélés via l'ampoule 💡
  const [cluesShown, setCluesShown] = useState(() => saved?.cluesShown || 1); // nb de phrases « Qui suis-je ? » affichées (1 puis +1 par clic « Indice »)
  const [streak, setStreak] = useState(() => saved?.streak || 0); // série de trouvailles d'affilée (mode illimité)
  const [score, setScore] = useState<number>(() => { try { return parseInt(localStorage.getItem("bb_findplayer_pts") || "0", 10) || 0; } catch { return 0; } });
  const [lastEarned, setLastEarned] = useState(() => saved?.lastEarned || 0); // points gagnés à la dernière manche
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { trackPlay(daily ? "devinette" : "reveal"); }, []); // suivi dédié

  // Sauvegarde la manche en cours à chaque changement → restaurée après un rechargement.
  useEffect(() => {
    try {
      if (store) store.setItem(storeKey, JSON.stringify({
        answer: answer.name, guesses: guesses.map(g => g.name), hintRevealed, over, won, lastEarned, streak, cluesShown,
      }));
    } catch { /* noop */ }
  }, [answer, guesses, hintRevealed, over, won, lastEarned, streak, cluesShown]);

  // Fermeture volontaire (bouton QUITTER). En illimité : on oublie la manche
  // (partie fraîche au retour). En « du jour » : on GARDE le résultat de la journée.
  function close() {
    try { if (!daily && store) store.removeItem(storeKey); } catch { /* noop */ }
    onClose();
  }

  // Quand on gagne/abandonne, on remonte en haut pour voir l'écran de fin.
  useEffect(() => { if (over) { try { scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }); } catch { /* noop */ } } }, [over]);

  function playerId(): string {
    try {
      let id = localStorage.getItem("bb_player_id");
      if (!id) { id = "anon"; }
      return id;
    } catch { return "anon"; }
  }

    // Points par manche selon le nombre d'essais.
  // 1 essai = 1000 · < 5 = 500 · < 10 = 200 · 10+ = 100
  function roundScore(tries: number): number {
    return tries <= 1 ? 1000 : tries < 5 ? 500 : tries < 10 ? 200 : 100;
  }

  async function submitScore(total: number) {
    const name = (() => { try { return localStorage.getItem("bb_name") || ""; } catch { return ""; } })();
    try {
      await fetch(SB_URL + "/rest/v1/bb_scores", {
        method: "POST",
        headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ player_id: playerId(), player_name: name || "Anonyme", score: total, mode: "findscore", diff: "all" }),
        keepalive: true,
      });
    } catch { /* noop */ }
    loadBoard();
  }

  async function loadBoard() {
    setBoard({ loading: true, rows: [], myRank: null, total: 0 });
    try {
      const res = await fetch(SB_URL + "/rest/v1/bb_scores?mode=eq.findscore&order=score.desc&limit=300&select=player_id,player_name,score", {
        headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY },
      });
      const list = res.ok ? await res.json() : [];
      const seen = new Set<string>(); const best: any[] = [];
      for (const r of Array.isArray(list) ? list : []) { if (seen.has(r.player_id)) continue; seen.add(r.player_id); best.push(r); }
      const idx = best.findIndex((r: any) => r.player_id === playerId());
      setBoard({ loading: false, rows: best.slice(0, 10), myRank: idx >= 0 ? idx + 1 : null, total: best.length });
    } catch { setBoard({ loading: false, rows: [], myRank: null, total: 0 }); }
  }

  const suggestions = useMemo(() => {
    const q = input.trim().toLowerCase();
    if (q.length < 2) return [];
    const guessed = new Set(guesses.map(g => g.name));
    const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const nq = norm(q);
    return ALL.filter(p => !guessed.has(p.name) && norm(p.name).includes(nq))
      .sort((a, b) => (a.diff === "facile" ? -1 : 1) - (b.diff === "facile" ? -1 : 1))
      .slice(0, 6);
  }, [input, guesses]);

  // Phrase de devinette (1re personne). On assemble plusieurs indices « déjà
  // dispo » puis on en choisit un de façon déterministe (varié selon le joueur).
  const deviClues = useMemo(() => {
    const clubs = answer.clubs || [];
    const clues: string[] = [];

    // 1) Coéquipier : « J'ai joué avec X [mais jamais avec Y] ».
    // Le contraste « mais jamais avec Y » n'est FIABLE que si les périodes par
    // club se chevauchent vraiment. On l'active uniquement via CLUB_SPELLS (stars
    // datées) : X = coéquipier vérifié du mystère, Y = coéquipier vérifié de X qui
    // n'a JAMAIS joué avec le mystère. Sinon, repli sûr : simple « J'ai joué avec X »
    // (heuristique club + génération, sans contraste).
    const jouéAvec = tr("J'ai joué avec", "I played with", "Ich spielte mit", "Ho giocato con", "Joguei com");
    const maisJamais = tr("mais jamais avec", "but never with", "aber nie mit", "ma mai con", "mas nunca com");
    let clue1: string | null = null;
    if (hasSpells(answer.name)) {
      const mates = SPELL_NAMES.filter(n => n !== answer.name && wereTeammates(answer.name, n)).sort();
      if (mates.length) {
        const X = mates[hashStr(answer.name, 23) % mates.length];
        const ys = SPELL_NAMES.filter(n => n !== answer.name && n !== X && wereTeammates(X, n) && !mightHaveBeenTeammates(answer.name, n)).sort();
        const Y = ys.length ? ys[hashStr(answer.name, 31) % ys.length] : null;
        clue1 = jouéAvec + " " + X + (Y ? " " + maisJamais + " " + Y : "") + ".";
      }
    }
    if (!clue1) {
      const mate = findTeammates(answer, 1)[0] || null;
      if (mate) clue1 = jouéAvec + " " + mate + ".";
    }
    if (clue1) clues.push(clue1);

    // 2) Grand club : « J'ai porté le maillot de … »
    const bigs = clubs.filter(c => BIG_CLUBS.has(c));
    if (bigs.length) {
      const bc = bigs[hashStr(answer.name, 17) % bigs.length];
      clues.push(tr("J'ai porté le maillot de", "I wore the shirt of", "Ich trug das Trikot von", "Ho indossato la maglia del", "Vesti a camisa do") + " " + bc + ".");
    }

    // 3) Pays : « J'ai évolué en … »
    const countries = Array.from(new Set(clubs.map(c => CLUB_COUNTRY[c]).filter(Boolean)));
    if (countries.length) {
      const ci = COUNTRY_INFO[countries[hashStr(answer.name, 13) % countries.length]];
      if (ci) clues.push(tr("J'ai évolué " + ci.fr, "I played in " + ci.en, "Ich spielte in " + ci.de, "Ho giocato in " + ci.it, "Joguei em " + ci.pt) + ".");
    }

    // 4) Palmarès (données GOAT Guess : CDM, LDC, Ballon d'Or, entraîneur)
    const has = (s: any) => s && typeof s.has === "function" && s.has(answer.name);
    if (has(GG_WC_WINNERS)) clues.push(tr("J'ai gagné la Coupe du Monde 🏆", "I won the World Cup 🏆", "Ich wurde Weltmeister 🏆", "Ho vinto la Coppa del Mondo 🏆", "Ganhei a Copa do Mundo 🏆"));
    if (has(GG_CL_WINNERS)) clues.push(tr("J'ai gagné la Ligue des Champions ⭐", "I won the Champions League ⭐", "Ich gewann die Champions League ⭐", "Ho vinto la Champions League ⭐", "Ganhei a Liga dos Campeões ⭐"));
    if (has(GG_BALLON_DOR)) clues.push(tr("J'ai remporté le Ballon d'Or 🥇", "I won the Ballon d'Or 🥇", "Ich gewann den Ballon d'Or 🥇", "Ho vinto il Pallone d'Oro 🥇", "Ganhei a Bola de Ouro 🥇"));
    if (has(ANEC_ENTRAINEUR)) clues.push(tr("Je suis devenu entraîneur 👔", "I became a manager 👔", "Ich wurde Trainer 👔", "Sono diventato allenatore 👔", "Virei treinador 👔"));
    if (has(GG_SHIRT_10)) clues.push(tr("J'ai porté le mythique numéro 10 🔟", "I wore the iconic number 10 🔟", "Ich trug die legendäre Nummer 10 🔟", "Ho indossato la mitica maglia numero 10 🔟", "Usei a mítica camisa 10 🔟"));

    // 5) Nombre de clubs
    if (clubs.length >= 3) clues.push(tr("J'ai porté les couleurs de", "I wore the colours of", "Ich trug die Farben von", "Ho vestito i colori di", "Vesti as cores de") + " " + clubs.length + " " + tr("clubs différents", "different clubs", "verschiedenen Klubs", "club diversi", "clubes diferentes") + ".");

    // 5) Décennie (repli)
    const startYear = answer.birthYear ? answer.birthYear + 19 : 0;
    const dec = startYear ? Math.floor(startYear / 10) * 10 : null;
    if (dec) clues.push(tr("J'ai percé dans les années", "I broke through in the", "Durchbruch in den", "Sono esploso negli anni", "Estourei nos anos") + " " + dec + tr("", "s", "ern", "", "") + ".");

    if (!clues.length) return [];
    // Mélange déterministe puis on garde 3-4 indices (types tous distincts).
    const uniq = Array.from(new Set(clues));
    let s = (hashStr(answer.name, 131) % 2147483647) || 1;
    const rand = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = uniq.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const t = uniq[i]; uniq[i] = uniq[j]; uniq[j] = t; }
    return uniq.slice(0, 4);
  }, [answer.name]);

  function submitGuess(p: Player) {
    if (over || revealing) return;
    const gs = [...guesses, p];
    const w = p.name === answer.name;
    const o = w; // essais illimités : la manche ne se termine qu'à la bonne réponse
    // Retour haptique : vibre quand la proposition dévoile une/des cases (attributs
    // corrects). Déclenché dans le geste utilisateur pour marcher aussi sur iOS.
    const prevConf = new Set<string>(hintRevealed);
    guesses.forEach(gg => computeChips(gg, answer).forEach(c => { if (c.state === "ok") prevConf.add(c.key); }));
    const newFound = computeChips(p, answer).filter(c => c.state === "ok" && !prevConf.has(c.key)).length;
    if (w) haptic("win");
    else if (newFound >= 2) haptic("multi");
    else if (newFound >= 1) haptic("hit");
    setGuesses(gs);
    setInput("");
    setAnimRow(gs.length - 1); // la nouvelle ligne se révèle puce par puce
    if (o) {
      // Bonne réponse : on laisse la révélation des puces se jouer (suspens) avant
      // d'afficher le résultat.
      setRevealing(true);
      setTimeout(() => {
        setRevealing(false);
        if (w) {
          setWon(true);
          setStreak(streak + 1);
          const earned = roundScore(gs.length);
          setLastEarned(earned);
          const total = score + earned;
          setScore(total);
          try { localStorage.setItem("bb_findplayer_pts", String(total)); } catch { /* noop */ }
          submitScore(total);
          // Crédite l'XP dans le classement principal (LePont écoute cet event).
          try { window.dispatchEvent(new CustomEvent("goatfc:award-xp", { detail: { amount: earned } })); } catch { /* noop */ }
        } else {
          setStreak(0);
        }
        setOver(true);
        loadBoard();
      }, REVEAL_MS);
    } else {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  // 🎲 Propose un joueur au hasard (connu) comme tentative.
  function randomGuess() {
    if (over || revealing) return;
    const guessed = new Set(guesses.map(g => g.name));
    const pool = ALL.filter(p => !guessed.has(p.name) && (p.diff === "facile" || p.diff === "moyen") && p.clubs && p.clubs.length >= 2 && !!p.birthYear && (p.birthYear as number) >= MODERN_MIN_BY);
    if (pool.length === 0) return;
    submitGuess(pool[Math.floor(Math.random() * pool.length)]);
  }

  // Mode illimité : nouvelle manche avec un joueur au hasard. (Désactivé « du jour ».)
  function playAgain() {
    if (daily) return;
    setAnswer(randomPlayer(seenRef.current));
    setGuesses([]);
    setOver(false);
    setWon(false);
    setInput("");
    setAnimRow(-1);
    setRevealing(false);
    setShowCareer(false);
    setHintRevealed([]);
    setCluesShown(1);
    setBoard(null);
    trackPlay("reveal");
    setTimeout(() => inputRef.current?.focus(), 60);
  }

  // 💡 Indice : révèle une pastille (un attribut) non encore trouvée.
  function revealOneAttr() {
    const conf = new Set<string>(hintRevealed);
    guesses.forEach(g => computeChips(g, answer).forEach(c => { if (c.state === "ok") conf.add(c.key); }));
    const remaining = ["nat", "cont", "pos", "age", "lastclub"].filter(k => !conf.has(k));
    if (remaining.length === 0) return;
    const pick = remaining[Math.floor(Math.random() * remaining.length)];
    setHintRevealed(prev => prev.includes(pick) ? prev : [...prev, pick]);
  }

  // 🏳️ Abandonner : dévoile la réponse (fin de manche, série remise à zéro).
  function giveUp() {
    setStreak(0);
    setWon(false);
    setShowCareer(true);
    setOver(true);
    loadBoard();
  }

  // Signaler une erreur de parcours sur le joueur mystère en cours (table bb_reports).
  async function sendReport() {
    const name = (() => { try { return localStorage.getItem("bb_name") || ""; } catch { return ""; } })();
    try {
      await fetch(SB_URL + "/rest/v1/bb_reports", {
        method: "POST",
        headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({
          reporter_id: playerId(),
          reporter_name: name || null,
          report_type: "reveal_bug",
          player_name: answer.name,
          c1: answer.name,
          c2: answer.clubs.join(" → "),
          given_answer: reportNote || null,
          message: "GOAT REVEAL — parcours signalé" + (reportNote ? " : " + reportNote : ""),
        }),
        keepalive: true,
      });
    } catch { /* noop */ }
    setReportSent(true);
  }
  function openReport() { setReportNote(""); setReportSent(false); setReportOpen(true); }

  function shareText(): string {
    const rows = guesses.map(g => computeChips(g, answer).map(c => SQ[c.state]).join("")).join("\n");
    const head = "🐐 GOAT FC · " + tr("Trouve le joueur", "Guess the player", "Errate den Spieler", "Indovina il giocatore", "Adivinhe o jogador");
    const res = won ? `${guesses.length} ${tr("essai", "try", "Versuch", "tentativo", "tentativa")}${guesses.length > 1 ? "s" : ""}` : tr("abandon", "gave up", "aufgegeben", "arreso", "desisti");
    const streakLine = won ? "  ·  🔥 " + tr("Série", "Streak", "Serie", "Serie", "Sequência") + " " + streak : "";
    const cta = tr("Tu fais mieux ? 👇", "Can you beat it? 👇", "Schaffst du mehr? 👇", "Fai meglio? 👇", "Consegue superar? 👇");
    return `${head} — ${res}${streakLine}\n${rows}\n\n${cta}\nhttps://goatfc.fr`;
  }
  function doShare() {
    const txt = shareText();
    try { if ((navigator as any).share) { (navigator as any).share({ title: "GOAT FC", text: txt }); return; } } catch { /* noop */ }
    try { navigator.clipboard.writeText(txt).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }); } catch { /* noop */ }
  }

  // Lignes d'indices de l'énigme (sans le nom) — partagées par le texte et l'image.
  function riddleClues(): string[] {
    const clubs = answer.clubs || [];
    const first = clubs[0];
    const last = clubs[clubs.length - 1];
    const mids = clubs.slice(1, -1);
    const midPick = mids.length > 2 ? [mids[0], mids[mids.length - 1]] : mids;
    const startYear = answer.birthYear ? answer.birthYear + 19 : 0;
    const decade = startYear ? Math.floor(startYear / 10) * 10 : null;
    const flag = answer.nationalities[0] ? (NAT_FLAG[answer.nationalities[0]] || "🏴") : "";
    const mates = findTeammates(answer, 2);
    const out: string[] = [];
    if (answer.nationalities[0]) out.push(flag + " " + answer.nationalities[0] + " · " + posEmoji(answer.positions[0] || "") + " " + posLabel(answer.positions[0] || ""));
    if (decade) out.push("🕰️ " + tr("J'ai percé dans les années", "I broke through in the", "Durchbruch in den", "Sono esploso negli anni", "Estourei nos anos") + " " + decade + tr("", "s", "ern", "", ""));
    if (first) out.push("🎬 " + tr("J'ai débuté à", "I started at", "Mein Debüt bei", "Ho esordito a", "Comecei no") + " " + first);
    if (midPick.length) out.push("✈️ " + tr("Je suis passé par", "I played for", "Ich spielte für", "Sono passato per", "Passei por") + " " + midPick.join(", "));
    if (mates.length) out.push("🤝 " + tr("J'ai côtoyé", "I played alongside", "Ich spielte mit", "Ho giocato con", "Joguei ao lado de") + " " + mates.join(", "));
    if (last && last !== first) out.push("🏁 " + tr("Dernier maillot :", "Last shirt:", "Letztes Trikot:", "Ultima maglia:", "Última camisa:") + " " + last);
    return out;
  }

  // Énigme « Qui suis-je ? » — texte instagrammable pour défier ses potes.
  function dailyRiddle(): string {
    return [
      "🕵️ " + tr("QUI SUIS-JE ?", "WHO AM I?", "WER BIN ICH?", "CHI SONO?", "QUEM SOU EU?"),
      "",
      ...riddleClues(),
      "",
      "🐐 " + tr("Devine le joueur mystère sur GOAT FC", "Guess the mystery player on GOAT FC", "Errate den Mystery-Spieler auf GOAT FC", "Indovina il giocatore misterioso su GOAT FC", "Adivinhe o jogador misterioso no GOAT FC"),
      "👉 goatfc.fr",
    ].join("\n");
  }

  // Carte image (PNG) de l'énigme — partageable en story Insta/WhatsApp.
  async function buildRiddleImage(): Promise<Blob | null> {
    try {
      const W = 1080, H = 1350;
      const cv = document.createElement("canvas");
      cv.width = W; cv.height = H;
      const ctx = cv.getContext("2d");
      if (!ctx) return null;
      try { await (document as any).fonts?.ready; } catch { /* noop */ }
      // Fond dégradé sombre
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#0d2417"); g.addColorStop(0.55, "#08150d"); g.addColorStop(1, "#040a06");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // Coin jaune en diagonale (bas-droite) + silhouette
      ctx.save();
      ctx.fillStyle = "#FFD400";
      ctx.beginPath(); ctx.moveTo(W, H - 430); ctx.lineTo(W, H); ctx.lineTo(W - 470, H); ctx.closePath(); ctx.fill();
      ctx.font = "260px sans-serif"; ctx.textAlign = "center"; ctx.globalAlpha = 0.9;
      ctx.fillText("👤", W - 180, H - 70);
      ctx.restore();
      // Halo vert
      const halo = ctx.createRadialGradient(W / 2, 560, 60, W / 2, 560, 620);
      halo.addColorStop(0, "rgba(0,230,118,.16)"); halo.addColorStop(1, "rgba(0,230,118,0)");
      ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);
      // Filigrane "?"
      ctx.save(); ctx.textAlign = "center"; ctx.font = "800 620px Anton, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,.04)"; ctx.fillText("?", W / 2, 900); ctx.restore();
      // En-tête
      ctx.textAlign = "center";
      ctx.fillStyle = "#FFFFFF"; ctx.font = "700 52px Anton, sans-serif";
      ctx.fillText("🐐 GOAT FC", W / 2, 120);
      // Titre
      ctx.fillStyle = "#FFD400"; ctx.font = "700 118px Anton, sans-serif";
      ctx.fillText(tr("QUI SUIS-JE ?", "WHO AM I?", "WER BIN ICH?", "CHI SONO?", "QUEM SOU EU?"), W / 2, 270);
      // Indices (gauche)
      const clues = riddleClues();
      ctx.textAlign = "left";
      const x = 90, maxW = W - 180, lh = 96;
      let y = 430;
      ctx.font = "600 46px 'Archivo', 'Helvetica Neue', Arial, sans-serif";
      const wrap = (text: string) => {
        const words = text.split(" ");
        let line = "";
        for (const w of words) {
          const test = line ? line + " " + w : w;
          if (ctx.measureText(test).width > maxW && line) { ctx.fillStyle = "#F2FFF7"; ctx.fillText(line, x, y); y += 58; line = w; }
          else line = test;
        }
        if (line) { ctx.fillStyle = "#F2FFF7"; ctx.fillText(line, x, y); }
        y += lh;
      };
      clues.forEach(wrap);
      // Barre jaune bas
      ctx.fillStyle = "#FFD400"; ctx.fillRect(0, H - 150, W, 150);
      ctx.textAlign = "left"; ctx.fillStyle = "#08150d";
      ctx.font = "700 46px Anton, sans-serif"; ctx.fillText("goatfc.fr", 70, H - 58);
      ctx.textAlign = "right"; ctx.font = "600 30px 'Archivo', Arial, sans-serif";
      ctx.fillText(tr("Le joueur mystère", "The mystery player", "Der Mystery-Spieler", "Il giocatore misterioso", "O jogador misterioso"), W - 70, H - 58);
      return await new Promise<Blob | null>(res => cv.toBlob(b => res(b), "image/png", 0.95));
    } catch { return null; }
  }

  async function shareRiddle() {
    const txt = dailyRiddle();
    const nav: any = navigator;
    // 1) Image en priorité (story instagrammable)
    try {
      const blob = await buildRiddleImage();
      if (blob) {
        const file = new File([blob], "goatfc-enigme.png", { type: "image/png" });
        if (nav.canShare && nav.canShare({ files: [file] })) {
          await nav.share({ files: [file], text: txt, title: "GOAT FC" });
          return;
        }
        // Repli : téléchargement de l'image + copie du texte
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = "goatfc-enigme.png"; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        try { await navigator.clipboard.writeText(txt); } catch { /* noop */ }
        setRiddleCopied(true); setTimeout(() => setRiddleCopied(false), 1800);
        return;
      }
    } catch { /* noop */ }
    // 2) Repli texte
    try { if (nav.share) { nav.share({ title: "GOAT FC", text: txt }); return; } } catch { /* noop */ }
    try { navigator.clipboard.writeText(txt).then(() => { setRiddleCopied(true); setTimeout(() => setRiddleCopied(false), 1800); }); } catch { /* noop */ }
  }

  // Barre de pastilles (« Mode Infini ») : les attributs du mystère se dévoilent
  // dès qu'une proposition les valide (✓ vert), ou via l'ampoule 💡.
  const confirmedKeys = new Set<string>(hintRevealed);
  guesses.forEach(g => computeChips(g, answer).forEach(c => { if (c.state === "ok") confirmedKeys.add(c.key); }));
  const aCont = continentOf(answer.nationalities[0]);
  const aFlag = answer.nationalities[0] ? (NAT_FLAG[answer.nationalities[0]] || answer.nationalities[0].slice(0, 3).toUpperCase()) : "?";
  const aAge = answer.birthYear ? NOW_Y - answer.birthYear : 0;
  const aLastClub = answer.clubs[answer.clubs.length - 1] || "";
  const [aLbg, aLfg] = clubColors(aLastClub);
  const topSlots = [
    { key: "nat", label: tr("NAT", "NAT", "NAT", "NAZ", "NAC"), value: aFlag, big: true, confirmed: confirmedKeys.has("nat") },
    { key: "cont", label: tr("ZONE", "ZONE", "ZONE", "ZONA", "ZONA"), value: aCont, bg: CONT_BG, fg: "#dff0ff", confirmed: confirmedKeys.has("cont") },
    { key: "pos", label: tr("POSTE", "POS", "POS", "RUOLO", "POS"), value: posEmoji(answer.positions[0] || ""), big: true, confirmed: confirmedKeys.has("pos") },
    { key: "age", label: tr("ÂGE", "AGE", "ALTER", "ETÀ", "IDADE"), value: aAge ? String(aAge) : "?", confirmed: confirmedKeys.has("age") },
    { key: "lastclub", label: tr("CLUB", "CLUB", "KLUB", "CLUB", "CLUBE"), value: aLastClub ? clubCode(aLastClub) : "?", bg: aLbg, fg: aLfg, confirmed: confirmedKeys.has("lastclub") },
  ] as { key: string; label: string; value: string; big?: boolean; bg?: string; fg?: string; confirmed: boolean }[];
  const allFound = topSlots.every(s => s.confirmed);

  return (
    <div ref={scrollRef} style={{ position: "fixed", inset: 0, zIndex: 200, background: "repeating-conic-gradient(from 0deg at 50% 34%, rgba(214,175,84,.05) 0deg 3deg, transparent 3deg 11deg), radial-gradient(circle at 50% 34%, rgba(224,184,92,.26) 0%, rgba(214,175,84,.07) 26%, transparent 56%), radial-gradient(ellipse at 50% 122%, rgba(214,175,84,.12), transparent 60%), linear-gradient(180deg, #14110a 0%, #0a0a0a 45%, #040404 100%)", overflowY: "auto", WebkitOverflowScrolling: "touch" as any }}>
      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 5, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "calc(12px + env(safe-area-inset-top)) 16px 12px", background: "linear-gradient(180deg,#14110a,rgba(8,8,8,.6))", backdropFilter: "blur(8px)" }}>
        <button onClick={close} style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(224,184,92,.35)", borderRadius: 12, color: "#fff", padding: "8px 12px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>← {tr("QUITTER", "QUIT", "BEENDEN", "ESCI", "SAIR")}</button>
        <div style={{ fontFamily: "Anton, sans-serif", fontSize: 22, letterSpacing: 1, textAlign: "center", lineHeight: 1, color: "#F2D680", backgroundImage: "linear-gradient(180deg,#FCEBB8 0%,#E7C15A 52%,#C89A32 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", textShadow: "0 2px 14px rgba(214,175,84,.35)" }}>{daily ? tr("DEVINETTE DU JOUR", "DAILY RIDDLE", "RÄTSEL DES TAGES", "INDOVINELLO DEL GIORNO", "ADIVINHA DO DIA") : tr("TROUVE LE JOUEUR", "GUESS THE PLAYER", "ERRATE DEN SPIELER", "INDOVINA IL GIOCATORE", "ADIVINHE O JOGADOR")}</div>
        {(!over && !revealing && !daily) ? (
          <button onClick={playAgain} aria-label={tr("Changer de joueur (trop dur)", "Change player (too hard)", "Spieler wechseln (zu schwer)", "Cambia giocatore (troppo difficile)", "Trocar de jogador (difícil demais)")} title={tr("Trop dur ? Change de joueur", "Too hard? Change player", "Zu schwer? Spieler wechseln", "Troppo difficile? Cambia", "Difícil? Troca de jogador")} style={{ background: "rgba(255,214,0,.12)", border: "1px solid rgba(255,214,0,.45)", borderRadius: 12, color: "#FFD600", padding: "8px 11px", fontSize: 13, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>
            {tr("PASSER", "SKIP", "SKIP", "SALTA", "PULAR")} ⏭
          </button>
        ) : (
          <div style={{ width: 74 }} />
        )}
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "8px 16px 40px", display: "flex", flexDirection: "column" }}>
        {/* Bandeau série (mode illimité) */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ padding: "5px 12px", borderRadius: 999, background: "rgba(255,138,42,.14)", border: "1px solid rgba(255,138,42,.4)", color: "#FF8A2A", fontSize: 12, fontWeight: 900, letterSpacing: 1 }}>🔥 {tr("SÉRIE", "STREAK", "SERIE", "SERIE", "SÉRIE")} : {streak}</span>
          <span style={{ padding: "5px 12px", borderRadius: 999, background: "rgba(224,184,92,.14)", border: "1px solid rgba(224,184,92,.45)", color: "#F2D680", fontSize: 12, fontWeight: 900, letterSpacing: 1 }}>🏆 {tr("SCORE", "SCORE", "PUNKTE", "PUNTI", "PONTOS")} : {score.toLocaleString("fr-FR")}</span>
        </div>

        {/* Phrases de devinette — UNIQUEMENT en « Devinette du jour ». En GOAT reveal
            (déduction pure), pas d'indices en phrases. */}
        {daily && !over && deviClues.length > 0 && (
          <div style={{ background: "linear-gradient(180deg, rgba(224,184,92,.14), rgba(224,184,92,.05))", border: "1px solid rgba(224,184,92,.4)", borderRadius: 14, padding: "12px 14px", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.5, color: "#E0B85C" }}>🕵️ {tr("QUI SUIS-JE ?", "WHO AM I?", "WER BIN ICH?", "CHI SONO?", "QUEM SOU EU?")}</div>
              {cluesShown < deviClues.length && (
                <button onClick={() => setCluesShown(n => Math.min(n + 1, deviClues.length))} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4, padding: "5px 11px", borderRadius: 999, border: "1px solid rgba(224,184,92,.55)", background: "rgba(224,184,92,.16)", color: "#F2D680", fontSize: 11.5, fontWeight: 900, letterSpacing: .5, cursor: "pointer" }}>💡 {tr("INDICE", "CLUE", "HINWEIS", "INDIZIO", "DICA")} +</button>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {deviClues.slice(0, cluesShown).map((c, i) => (
                <div key={i} style={{ fontSize: 13.5, fontWeight: 600, fontStyle: "italic", color: "#F4E3B8", lineHeight: 1.35, display: "flex", gap: 6 }}>
                  <span style={{ color: "#E0B85C" }}>▪</span><span>{c}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Boutons d'indice + barre de pastilles (Mode Infini) */}
        {!over && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 12 }}>
              {[
                { emoji: "💡", color: "#3DA5FF", onClick: revealOneAttr, disabled: allFound, label: tr("Révéler une info", "Reveal a clue", "Info zeigen", "Rivela un'info", "Revelar info") },
                { emoji: "🏳️", color: "#FF3D57", onClick: giveUp, disabled: false, label: tr("Abandonner", "Give up", "Aufgeben", "Arrenditi", "Desistir") },
              ].map(h => (
                <button key={h.emoji} onClick={h.onClick} disabled={h.disabled} title={h.label} aria-label={h.label} style={{ width: 48, height: 48, borderRadius: "50%", border: "1px solid " + h.color + "66", background: h.disabled ? "rgba(255,255,255,.04)" : h.color + "22", color: "#fff", fontSize: 20, cursor: h.disabled ? "not-allowed" : "pointer", opacity: h.disabled ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: h.disabled ? "none" : "0 4px 12px " + h.color + "33" }}>{h.emoji}</button>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 5, background: "linear-gradient(180deg,#F7A828,#E7941A)", border: "2px solid #C97E12", borderRadius: 16, padding: "10px 6px", boxShadow: "0 6px 18px rgba(0,0,0,.3)" }}>
              {topSlots.map(s => (
                <div key={s.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1 }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: s.confirmed ? (s.bg || "#fff") : "#141414", border: "2px solid " + (s.confirmed ? "#00E676" : "rgba(0,0,0,.35)"), display: "flex", alignItems: "center", justifyContent: "center", fontSize: s.confirmed ? (s.big ? 20 : (s.bg ? 11 : 13)) : 17, fontWeight: 900, color: s.confirmed ? (s.fg || "#06130B") : "rgba(255,255,255,.5)", textShadow: s.confirmed && s.bg ? "0 1px 3px rgba(0,0,0,.6)" : "none", overflow: "hidden" }}>{s.confirmed ? (s.key === "pos" ? <PitchIcon pos={answer.positions[0] || ""} size={26} /> : s.value) : "?"}</div>
                  <span style={{ fontSize: 7.5, fontWeight: 900, letterSpacing: .3, color: s.confirmed ? "#0a3d1e" : "rgba(30,10,0,.55)" }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Saisie */}
        {!over && !revealing && (
          <div style={{ position: "relative", marginBottom: 8 }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onFocus={() => {
                // Au clavier ouvert, on remonte le champ juste sous l'en-tête pour
                // qu'il soit bien visible et laisser la place aux suggestions
                // au-dessus du clavier (sinon on « voit pas en haut »).
                setTimeout(() => { try { inputRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }); } catch { /* noop */ } }, 280);
              }}
              placeholder={tr("Rechercher un joueur…", "Search a player…", "Spieler suchen…", "Cerca un giocatore…", "Buscar um jogador…")}
              autoComplete="off"
              style={{ width: "100%", boxSizing: "border-box", padding: "14px 60px 14px 16px", borderRadius: 14, border: "1.5px solid rgba(255,255,255,.25)", background: "rgba(255,255,255,.12)", color: "#fff", fontSize: 15, fontWeight: 600, outline: "none", scrollMarginTop: "calc(64px + env(safe-area-inset-top))" }}
            />
            <button onClick={randomGuess} title={tr("Joueur au hasard", "Random player", "Zufälliger Spieler", "Giocatore casuale", "Jogador aleatório")} aria-label={tr("Joueur au hasard", "Random player", "Zufälliger Spieler", "Giocatore casuale", "Jogador aleatório")} style={{ position: "absolute", right: 6, top: 6, bottom: 6, width: 46, borderRadius: 11, border: "none", background: "linear-gradient(135deg,#F6D477,#C89A32)", color: "#3a2a05", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 3px 10px rgba(200,154,50,.5)" }}>🎲</button>
            {suggestions.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10, marginTop: 4, background: "#132419", border: "1px solid rgba(255,255,255,.15)", borderRadius: 12, maxHeight: "min(50vh, 320px)", overflowY: "auto", WebkitOverflowScrolling: "touch" as any, boxShadow: "0 12px 30px rgba(0,0,0,.5)" }}>
                {suggestions.map(s => (
                  <button key={s.name} onClick={() => submitGuess(s)} style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "11px 14px", background: "transparent", border: "none", borderBottom: "1px solid rgba(255,255,255,.06)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
                    <span>{s.name}</span>
                    <span style={{ fontSize: 15 }}>{s.nationalities[0] && NAT_FLAG[s.nationalities[0]] ? NAT_FLAG[s.nationalities[0]] : ""}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Signaler — dispo en cours de partie */}
        {!over && !revealing && (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
            <button onClick={openReport} style={{ padding: "8px 16px", borderRadius: 999, border: "1px solid rgba(255,61,87,.4)", background: "rgba(255,61,87,.08)", color: "#FF6B7D", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>
              🚩 {tr("Signaler une erreur", "Report an error", "Fehler melden", "Segnala un errore", "Reportar erro")}
            </button>
          </div>
        )}

        {/* Révélation puce par puce (suspens) */}
        <style>{`@keyframes fpChipIn{0%{opacity:0;transform:rotateY(90deg) scale(.5)}55%{opacity:1;transform:rotateY(0deg) scale(1.12)}100%{opacity:1;transform:rotateY(0deg) scale(1)}}`}</style>

        {/* Lignes de propositions — la plus récente en haut */}
        <div style={{ order: 3, display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
          {guesses.map((g, gi) => ({ g, gi })).reverse().map(({ g, gi }) => {
            const chips = computeChips(g, answer);
            const correct = g.name === answer.name;
            const anim = gi === animRow; // seule la nouvelle ligne se révèle puce par puce
            return (
              <div key={gi} style={{ background: correct ? "rgba(0,230,118,.16)" : "rgba(255,255,255,.04)", border: "1px solid " + (correct ? "rgba(0,230,118,.5)" : "rgba(255,255,255,.1)"), borderRadius: 14, padding: "10px 10px 12px" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: correct ? "#00E676" : "#fff", marginBottom: 9, textAlign: "center" }}>{correct ? "✓ " : ""}{g.name}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 3, perspective: 600 }}>
                  {chips.map((c, ci) => {
                    const arrow = c.arrow ? (c.arrow === "up" ? "↑" : "↓") : null;
                    const bBg = arrow ? (c.state === "close" ? "#FFB020" : "#FF3D57")
                      : c.state === "ok" ? "#00E676" : c.state === "close" ? "#FFB020" : "#FF3D57";
                    const bSym = arrow ? arrow : c.state === "no" ? "✕" : "✓";
                    const ring = c.state === "ok" ? "rgba(0,230,118,.7)" : c.state === "close" ? "rgba(255,176,32,.7)" : "rgba(255,61,87,.55)";
                    return (
                      <div key={c.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, ...(anim ? { animation: `fpChipIn ${CHIP_DUR}s ease both`, animationDelay: (ci * CHIP_STAGGER) + "s" } : {}) }}>
                        <div style={{ width: 40, height: 40, borderRadius: "50%", background: c.bg || "#fff", border: "2px solid " + ring, display: "flex", alignItems: "center", justifyContent: "center", fontSize: c.big ? 20 : c.bg ? 11 : 12, fontWeight: 900, color: c.fg || "#06130B", textShadow: c.bg ? "0 1px 3px rgba(0,0,0,.6)" : "none", boxShadow: "0 3px 8px rgba(0,0,0,.35)", overflow: "hidden" }}>{c.key === "pos" ? <PitchIcon pos={g.positions[0] || ""} size={26} /> : c.top}</div>
                        <div style={{ width: 18, height: 18, borderRadius: "50%", background: bBg, color: "#fff", fontSize: 11, fontWeight: 900, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 5px rgba(0,0,0,.4)" }}>{bSym}</div>
                        <span style={{ fontSize: 7.5, fontWeight: 800, letterSpacing: .3, color: "rgba(255,255,255,.4)" }}>{c.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Écran de fin — placé au-dessus des propositions (order 2) pour être vu sans scroller */}
        {over && (
          <div style={{ order: 2, marginTop: 12, marginBottom: 4, background: won ? "rgba(0,230,118,.12)" : "rgba(255,61,87,.12)", border: "1px solid " + (won ? "rgba(0,230,118,.4)" : "rgba(255,61,87,.4)"), borderRadius: 18, padding: 18, textAlign: "center" }}>
            <div style={{ fontFamily: "Anton, sans-serif", fontSize: 26, color: won ? "#00E676" : "#FF3D57", letterSpacing: 1 }}>
              {won ? tr("BIEN JOUÉ ! 🎉", "WELL DONE! 🎉", "GUT GEMACHT! 🎉", "BEN FATTO! 🎉", "MANDOU BEM! 🎉") : tr("RATÉ ! 😅", "MISSED! 😅", "VERPASST! 😅", "MANCATO! 😅", "ERROU! 😅")}
            </div>
            <div style={{ fontSize: 14, color: "#fff", marginTop: 6 }}>
              {won ? tr("Trouvé en", "Found in", "Gefunden in", "Trovato in", "Encontrado em") + " " + guesses.length + " " + tr("essai", "try", "Versuch", "tentativo", "tentativa") + (guesses.length > 1 ? "s" : "") : tr("C'était", "It was", "Es war", "Era", "Era") + " :"}
            </div>
            {!won && <div style={{ fontFamily: "Anton, sans-serif", fontSize: 22, color: "#fff", marginTop: 2 }}>{answer.name}</div>}
            {won && (
              <div style={{ fontFamily: "Anton, sans-serif", fontSize: 40, color: "#F2D680", letterSpacing: 1, marginTop: 8, textShadow: "0 2px 16px rgba(224,184,92,.4)" }}>+{lastEarned.toLocaleString("fr-FR")} PTS</div>
            )}
            <div style={{ fontSize: 14, fontWeight: 800, color: won ? "#FF8A2A" : "rgba(255,255,255,.6)", marginTop: 6 }}>
              {won ? "🔥 " + tr("Série", "Streak", "Serie", "Serie", "Sequência") + " : " + streak + "  ·  🏆 " + tr("Total", "Total", "Gesamt", "Totale", "Total") + " : " + score.toLocaleString("fr-FR")
                   : (streak === 0 ? tr("Série remise à zéro", "Streak reset", "Serie zurückgesetzt", "Serie azzerata", "Sequência zerada") : "")}
            </div>

            {daily ? (
              <div style={{ width: "100%", marginTop: 14, padding: "15px", background: "rgba(224,184,92,.12)", border: "1px solid rgba(224,184,92,.4)", borderRadius: 14, fontSize: 15, fontWeight: 900, letterSpacing: .3, color: "#F2D680", textAlign: "center" }}>
                🌙 {tr("Reviens demain pour une nouvelle devinette", "Come back tomorrow for a new riddle", "Komm morgen für ein neues Rätsel wieder", "Torna domani per un nuovo indovinello", "Volte amanhã para um novo enigma")}
              </div>
            ) : (
              <button onClick={playAgain} style={{ width: "100%", marginTop: 14, padding: "15px", background: "linear-gradient(135deg,#FFD600,#FF8A2A)", color: "#1A0F00", border: "none", borderRadius: 14, fontSize: 16, fontWeight: 900, letterSpacing: .5, cursor: "pointer" }}>
                🔄 {tr("REJOUER", "PLAY AGAIN", "NOCHMAL", "GIOCA ANCORA", "JOGAR DE NOVO")}
              </button>
            )}

            <button onClick={doShare} style={{ width: "100%", marginTop: 8, padding: "13px", background: "linear-gradient(135deg,#00E676,#00B85C)", color: "#06130B", border: "none", borderRadius: 14, fontSize: 14, fontWeight: 900, cursor: "pointer" }}>
              {copied ? tr("Copié ! 📋", "Copied! 📋", "Kopiert! 📋", "Copiato! 📋", "Copiado! 📋") : "📤 " + tr("Partager mon résultat", "Share my result", "Ergebnis teilen", "Condividi il risultato", "Compartilhar resultado")}
            </button>

            {/* Classement du jour */}
            <div style={{ marginTop: 14, background: "rgba(0,0,0,.25)", borderRadius: 12, padding: "10px 12px", textAlign: "left" }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: "rgba(255,255,255,.45)", marginBottom: 6, textAlign: "center" }}>🏆 {tr("MEILLEURS SCORES", "TOP SCORES", "BESTE PUNKTE", "MIGLIORI PUNTEGGI", "MELHORES PONTUAÇÕES")}</div>
              {(!board || board.loading) ? (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.4)", textAlign: "center", padding: 6 }}>{tr("Chargement…", "Loading…", "Wird geladen…", "Caricamento…", "Carregando…")}</div>
              ) : board.rows.length === 0 ? (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.4)", textAlign: "center", padding: 6 }}>{tr("Sois le premier !", "Be the first!", "Sei der Erste!", "Sii il primo!", "Seja o primeiro!")}</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {board.rows.map((r, i) => {
                    const me = r.player_id === playerId();
                    return (
                      <div key={r.player_id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", borderRadius: 8, background: me ? "rgba(0,230,118,.16)" : "transparent" }}>
                        <span style={{ width: 20, textAlign: "center", fontWeight: 900, fontSize: 12, color: i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "rgba(255,255,255,.4)" }}>{i + 1}</span>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: me ? 800 : 600, color: me ? "#fff" : "rgba(255,255,255,.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.player_name || "Anonyme"}</span>
                        <span style={{ fontFamily: "Anton, sans-serif", fontSize: 15, color: "#00E676" }}>{r.score}</span>
                      </div>
                    );
                  })}
                  {board.myRank && board.myRank > 10 && <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)", textAlign: "center", marginTop: 4 }}>{tr("Ton rang", "Your rank", "Dein Rang", "Il tuo posto", "Sua posição")} : #{board.myRank} / {board.total}</div>}
                </div>
              )}
            </div>

            <button onClick={openReport} style={{ marginTop: 12, background: "transparent", border: "none", color: "rgba(255,107,125,.85)", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
              🚩 {tr("Signaler une erreur sur ce parcours", "Report an error on this career", "Fehler in diesem Verlauf melden", "Segnala un errore su questa carriera", "Reportar erro nesta carreira")}
            </button>
          </div>
        )}
      </div>

      {/* Aperçu de l'énigme « Qui suis-je ? » — les phrases à partager */}
      {showRiddle && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,.78)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setShowRiddle(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 400, background: "linear-gradient(160deg,#0d2417,#08150d)", border: "1px solid rgba(255,214,0,.35)", borderRadius: 22, padding: "24px 20px", boxShadow: "0 24px 70px rgba(0,0,0,.65)" }}>
            <div style={{ textAlign: "center", fontFamily: "Anton, sans-serif", fontSize: 15, color: "#fff", letterSpacing: 1 }}>🐐 GOAT FC</div>
            <div style={{ textAlign: "center", fontFamily: "Anton, sans-serif", fontSize: 34, color: "#FFD600", letterSpacing: 1, marginTop: 2, marginBottom: 16 }}>🕵️ {tr("QUI SUIS-JE ?", "WHO AM I?", "WER BIN ICH?", "CHI SONO?", "QUEM SOU EU?")}</div>
            {!over && <div style={{ textAlign: "center", fontSize: 11.5, color: "rgba(255,214,0,.8)", marginTop: -8, marginBottom: 14 }}>👀 {tr("Ces indices te sont dévoilés en avance", "These clues are revealed to you early", "Diese Hinweise werden dir vorab gezeigt", "Questi indizi ti sono svelati in anticipo", "Estas dicas são reveladas antes")}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 20 }}>
              {riddleClues().map((line, i) => (
                <div key={i} style={{ fontSize: 15, fontWeight: 700, color: "#F2FFF7", lineHeight: 1.35 }}>{line}</div>
              ))}
            </div>
            <button onClick={shareRiddle} style={{ width: "100%", padding: "14px", background: "linear-gradient(135deg,#FFD600,#FF8A2A)", color: "#1A0F00", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 900, cursor: "pointer" }}>
              {riddleCopied ? tr("Copié ! 📋", "Copied! 📋", "Kopiert! 📋", "Copiato! 📋", "Copiado! 📋") : "📤 " + tr("Partager l'énigme", "Share the riddle", "Rätsel teilen", "Condividi l'enigma", "Compartilhar o enigma")}
            </button>
            <button onClick={() => setShowRiddle(false)} style={{ width: "100%", marginTop: 8, padding: "12px", background: "transparent", color: "rgba(255,255,255,.6)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 14, fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
              {tr("Fermer", "Close", "Schließen", "Chiudi", "Fechar")}
            </button>
          </div>
        </div>
      )}

      {/* Signaler une erreur de parcours */}
      {reportOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 320, background: "rgba(0,0,0,.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setReportOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 400, background: "linear-gradient(160deg,#241014,#150808)", border: "1px solid rgba(255,61,87,.4)", borderRadius: 22, padding: "24px 20px", boxShadow: "0 24px 70px rgba(0,0,0,.65)" }}>
            {reportSent ? (
              <div style={{ textAlign: "center", padding: "10px 0" }}>
                <div style={{ fontSize: 46, marginBottom: 8 }}>✅</div>
                <div style={{ fontFamily: "Anton, sans-serif", fontSize: 24, color: "#00E676", letterSpacing: 1 }}>{tr("MERCI !", "THANKS!", "DANKE!", "GRAZIE!", "OBRIGADO!")}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,.7)", marginTop: 6, marginBottom: 18 }}>{tr("Signalement envoyé. On vérifie ce parcours.", "Report sent. We'll check this career.", "Meldung gesendet. Wir prüfen diesen Verlauf.", "Segnalazione inviata. Verificheremo.", "Reporte enviado. Vamos verificar.")}</div>
                <button onClick={() => setReportOpen(false)} style={{ width: "100%", padding: "13px", background: "#00E676", color: "#06130B", border: "none", borderRadius: 14, fontSize: 14, fontWeight: 900, cursor: "pointer" }}>{tr("Fermer", "Close", "Schließen", "Chiudi", "Fechar")}</button>
              </div>
            ) : (
              <>
                <div style={{ textAlign: "center", fontFamily: "Anton, sans-serif", fontSize: 26, color: "#FF6B7D", letterSpacing: 1, marginBottom: 6 }}>🚩 {tr("SIGNALER UNE ERREUR", "REPORT AN ERROR", "FEHLER MELDEN", "SEGNALA UN ERRORE", "REPORTAR ERRO")}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,.7)", textAlign: "center", marginBottom: 14, lineHeight: 1.4 }}>{tr("Le parcours de ce joueur te semble faux ou pas à jour ?", "Does this player's career look wrong or outdated?", "Wirkt der Verlauf falsch oder veraltet?", "La carriera di questo giocatore sembra errata?", "A carreira deste jogador parece errada?")}</div>
                {(over || showCareer) && (
                  <div style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, padding: "10px 12px", marginBottom: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginBottom: 3 }}>{answer.name}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,.6)", lineHeight: 1.4 }}>{answer.clubs.join(" → ")}</div>
                  </div>
                )}
                <textarea
                  value={reportNote}
                  onChange={e => setReportNote(e.target.value)}
                  placeholder={tr("Qu'est-ce qui est faux ? (facultatif)", "What's wrong? (optional)", "Was ist falsch? (optional)", "Cosa c'è di sbagliato? (facoltativo)", "O que está errado? (opcional)")}
                  rows={3}
                  style={{ width: "100%", boxSizing: "border-box", padding: "11px 13px", borderRadius: 12, border: "1.5px solid rgba(255,255,255,.15)", background: "rgba(255,255,255,.06)", color: "#fff", fontSize: 14, fontWeight: 500, outline: "none", resize: "none", marginBottom: 14, fontFamily: "inherit" }}
                />
                <button onClick={sendReport} style={{ width: "100%", padding: "14px", background: "linear-gradient(135deg,#FF3D57,#FF6B35)", color: "#fff", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 900, cursor: "pointer" }}>
                  {tr("Envoyer le signalement", "Send report", "Meldung senden", "Invia segnalazione", "Enviar reporte")}
                </button>
                <button onClick={() => setReportOpen(false)} style={{ width: "100%", marginTop: 8, padding: "12px", background: "transparent", color: "rgba(255,255,255,.6)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 14, fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
                  {tr("Annuler", "Cancel", "Abbrechen", "Annulla", "Cancelar")}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
