import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { PLAYERS, RETIRED_PLAYERS, GG_WC_WINNERS, GG_CL_WINNERS } from "../players.jsx";
import { trackPlay, pingPresence, pingLive, trackTime } from "../lib/track";
import { hapticSuccess, hapticError } from "../lib/native";
import { pickOpponent, avatarFor } from "../lib/opponents";
import { displayStreak } from "../lib/streak";
// Jours calendaires « heure de Paris » — découpage temporel du tableau de bord.
import { parisDayOf, parisLastDays } from "../lib/days";
// Cartes à collectionner (débloquées par l'XP) et badge affiché à côté du pseudo.
import { CARDS, RARITIES, avatarCard, badgeToShow, cardById, hasArt, isUnlocked, levelCard, newlyUnlocked, progressToNext, rarityMeta, unlockedCards } from "../lib/collection";
import { WinBanner } from "./landing/WinBanner";
// Barème de grades et drapeaux : définis une seule fois, partagés avec le desktop.
import { GRADES, getGrade, countryToFlag } from "../lib/leaderboard";



const SB_URL = "https://ialjlsrgcolocoaegzrc.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhbGpsc3JnY29sb2NvYWVnenJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MDM3NzksImV4cCI6MjA5MTA3OTc3OX0.-SU8anuPhnpoa-PYhIHQqrcuOBsHxdtBJKRZuiGcGwM";


// Code secret du tableau de bord privé : goatfc.fr/?stats=<CODE>
const STATS_CODE = "akram-goat-2610";

// Modes suivis par trackPlay() — sert au tableau de bord privé (répartition des
// parties par mode). L'ordre n'a pas d'importance : l'affichage trie par volume.
const PLAY_MODES_META = [
  { key:"battle",    label:"GOAT Battle",       emoji:"⚡",  color:"#FFC93C" },
  { key:"pont",      label:"The Plug",          emoji:"🔗",  color:"#00E676" },
  { key:"chaine",    label:"The Mercato",       emoji:"🔁",  color:"#FF8A2A" },
  { key:"reveal",    label:"Trouve le joueur",  emoji:"🕵️", color:"#E0B85C" },
  { key:"devinette", label:"Devinette du jour", emoji:"🗓️", color:"#F2D680" },
  { key:"grid",      label:"GOAT Grid",         emoji:"▦",   color:"#3DA5FF" },
  { key:"guess",     label:"GOAT Guess",        emoji:"🔮",  color:"#C084FC" },
];

// Jour courant (fuseau Paris) au format "YYYY-MM-DD" — même calcul que dans
// Index.tsx et FindPlayer, pour retrouver la clé bb_devinette_<jour>.
function parisDayKey() {
  const paris = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  return paris.getFullYear() + "-" + String(paris.getMonth() + 1).padStart(2, "0") + "-" + String(paris.getDate()).padStart(2, "0");
}

// État de la Devinette du jour, lu depuis localStorage (l'overlay lui-même vit
// dans Index.tsx, hors de LePont).
function readDailyRiddle() {
  const day = parisDayKey();
  let done = false;
  try {
    const raw = localStorage.getItem("bb_devinette_" + day);
    if (raw) done = !!JSON.parse(raw).over;
  } catch { /* noop */ }
  let streak = 0;
  try { streak = displayStreak(day).current; } catch { /* noop */ }
  return { day, done, streak };
}

// Colonnes lisibles de bb_pseudos (TOUTES sauf recovery_code, qui est masqué
// côté public en Phase 2 sécurité). On sélectionne explicitement ces colonnes
// au lieu de "*", car "*" inclurait recovery_code et serait refusé.
// `badge` = carte de collection choisie (voir docs/supabase-badges.sql). Si la
// colonne n'existe pas encore, PostgREST rejette TOUTE la requête : on la
// demande donc à part (voir loadPlayerBadge) plutôt que de casser ce select.
const PSEUDO_COLS = "id,player_id,pseudo,created_at,country,xp,streak_count,streak_last_date,streak_best,streak_freezes,last_notified_grade,xp_season,xp_season_month";
async function sbFetch(path, options) {
  let res;
  try {
    res = await fetch(SB_URL + "/rest/v1/" + path, {
      ...options,
      headers: Object.assign({"apikey":SB_KEY,"Authorization":"Bearer "+SB_KEY,"Content-Type":"application/json"},
        options&&options.method==="POST"?{"Prefer":"return=minimal"}:{},
        options&&options.headers?options.headers:{})
    });
  } catch (e) {
    // Coupure réseau : `fetch` REJETTE (au lieu de renvoyer une réponse KO). Sans
    // ce catch, une seule requête ratée faisait échouer tout le chargement du
    // tableau de bord, qui restait indéfiniment sur « ⏳ Chargement… ». On
    // renvoie null, comme pour une réponse en erreur : chaque section sait déjà
    // afficher « données absentes ». Pas de nouvelle tentative ici : sbFetch sert
    // aussi aux POST, qu'un retour en arrière automatique dupliquerait.
    return null;
  }
  if (!res.ok && res.status !== 201) return null;
  if (res.status === 201 || res.headers.get("content-length") === "0") return [];
  try { return await res.json(); } catch { return []; }
}
// Récupère TOUTES les lignes d'une requête, page par page via l'en-tête Range.
//
// L'API PostgREST plafonne CHAQUE réponse à 1000 lignes (réglage « max rows »
// de Supabase) et le paramètre `limit=50000` dans l'URL ne lève PAS ce plafond :
// la réponse était donc tronquée en silence. Comme les requêtes du tableau de
// bord n'imposaient aucun tri, la troncature gardait les lignes les PLUS
// ANCIENNES et faisait disparaître les jours récents — d'où « Aujourd'hui :
// 0 joueur » alors que des parties du jour étaient bien comptées ailleurs.
//
// IMPORTANT : `path` DOIT contenir un `order=` stable, sinon la pagination peut
// renvoyer deux fois la même ligne ou en sauter.
const SB_PAGE = 1000; // = plafond « max rows » de l'API
async function sbFetchAll(path, maxRows) {
  const cap = maxRows || 50000;
  const out = [];
  for (let from = 0; from < cap; from += SB_PAGE) {
    const to = Math.min(from + SB_PAGE, cap) - 1;
    const page = await sbFetch(path, { headers: { "Range-Unit": "items", "Range": from + "-" + to } });
    // Erreur / table absente : on distingue « rien du tout » (null, la table
    // n'existe pas) d'une page suivante qui échoue (on garde ce qu'on a).
    if (page == null) return from === 0 ? null : out;
    for (const row of page) out.push(row);
    if (page.length < to - from + 1) break; // dernière page atteinte
  }
  return out;
}
// Compte EXACT de lignes d'une table (tout l'historique) via l'en-tête
// Content-Range de PostgREST — sans rapatrier les lignes. Renvoie null si KO.
// Compte exact des lignes d'une table, sans en transférer aucune (Range 0-0).
// `filter` = filtres PostgREST supplémentaires, ex. "type=eq.play_pont".
async function sbCount(table, filter) {
  try {
    const res = await fetch(SB_URL + "/rest/v1/" + table + "?select=id" + (filter ? "&" + filter : ""), {
      headers: { "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY, "Prefer": "count=exact", "Range": "0-0" }
    });
    const cr = res.headers.get("content-range") || "";
    const total = cr.split("/").pop();
    return total && total !== "*" ? parseInt(total, 10) : null;
  } catch (e) { return null; }
}

// Détecte l'OS mobile (pour le tracking) : "ios" | "android" | "other"
function detectOS() {
  try {
    const ua = navigator.userAgent || "";
    // iPadOS récent se présente comme un Mac tactile
    if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
    if (/Android/i.test(ua)) return "android";
    return "other";
  } catch (e) { return "other"; }
}

async function detectCountry() {
  try {
    const cached = localStorage.getItem("bb_country");
    if (cached) return cached;
    const res = await fetch("https://ipapi.co/json/");
    const data = await res.json();
    const code = (data.country_code || "").toUpperCase();
    if (code) {
      try { localStorage.setItem("bb_country", code); } catch {}
      return code;
    }
  } catch(e) {}
  return null;
}

function getPlayerId() {
  try {
    let id = localStorage.getItem("bb_player_id");
    if (!id) {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      id = Array.from({length:6},function(){return chars[Math.floor(Math.random()*chars.length)];}).join("");
      localStorage.setItem("bb_player_id", id);
    }
    return id;
  } catch(e) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({length:6},function(){return chars[Math.floor(Math.random()*chars.length)];}).join("");
  }
}


// ── CONSTANTS ──
const ROUND_DURATION = 90;
// Saisons mensuelles : Saison 1 = Avril 2026, Saison 2 = Mai 2026, etc.
const SEASON_START = new Date("2026-04-01T00:00:00Z"); // 1er avril 2026 = Saison 1

function getCurrentSeason() {
  // Calcul basé sur les mois calendaires en timezone Paris
  const now = new Date();
  const paris = new Date(now.toLocaleString('en-US',{timeZone:'Europe/Paris'}));
  const startParis = new Date(SEASON_START.toLocaleString('en-US',{timeZone:'Europe/Paris'}));
  // Nombre de mois entiers écoulés depuis SEASON_START
  const num = (paris.getFullYear() - startParis.getFullYear()) * 12 + (paris.getMonth() - startParis.getMonth());
  // Début de la saison actuelle : 1er du mois à 00h Paris
  const start = new Date(paris.getFullYear(), paris.getMonth(), 1, 0, 0, 0);
  // Fin : 1er du mois suivant
  const end = new Date(paris.getFullYear(), paris.getMonth() + 1, 1, 0, 0, 0);
  const remaining = end - paris;
  const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  // Clé du mois au format "2026-04" pour stockage DB
  const monthKey = paris.getFullYear() + "-" + String(paris.getMonth()+1).padStart(2,'0');
  // Noms de mois français/anglais pour affichage
  const monthNamesFr = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
  const monthNamesEn = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return {
    num: num + 1,
    start, end, days, hours,
    monthKey,
    monthNameFr: monthNamesFr[paris.getMonth()] + " " + paris.getFullYear(),
    monthNameEn: monthNamesEn[paris.getMonth()] + " " + paris.getFullYear()
  };
}

// Grade juste au-dessus du score donné (null si déjà GOAT). Sert à la « carotte »
// de progression : X pts avant le prochain grade.
function getNextGrade(score) {
  let next = null;
  for (let i = GRADES.length - 1; i >= 0; i--) { if (GRADES[i].min > score) { next = GRADES[i]; break; } }
  if (!next) return null;
  let lang = "fr";
  try { lang = localStorage.getItem("bb_lang") || "fr"; } catch {}
  return { ...next, label: lang === "fr" ? next.label : (next.labelEn || next.label) };
}
// Paliers de chaîne (The Mercato) fêtés en grande pompe.
const CHAIN_MILESTONES = {
  10: { emoji: "🔥", color: "#FF8A2A" },
  20: { emoji: "💫", color: "#FFD600" },
  30: { emoji: "⚡", color: "#3DA5FF" },
  40: { emoji: "🚀", color: "#C084FC" },
  50: { emoji: "🐐", color: "#FFD700" },
};
const QUESTION_DURATION = 10;
const CHAIN_QUESTION_DURATION = 15;
const CHAIN_DURATION = 90;
const COMBO_THRESHOLD = 3;

const CLUB_ALIASES = {
  "PSG":["paris saint germain","paris saint-germain","paris sg","paris","psg"],
  "Manchester United":["man utd","man united","manchester utd","manu","man u"],
  "Manchester City":["man city","city"],
  "Real Madrid":["real","madrid","le real"],
  "Barcelona":["barca","fc barcelona","barcelone","barça"],
  "Atletico Madrid":["atletico","atleti","atletico de madrid"],
  "AC Milan":["milan ac","milan","ac milan"],
  "Inter Milan":["inter","internazionale","inter milano"],
  "Bayern Munich":["bayern","fc bayern","les bavarois"],
  "Borussia Dortmund":["dortmund","bvb"],
  "Borussia Mönchengladbach":["gladbach","monchengladbach","borussia monchengladbach","bmg","fohlen"],
  "RB Leipzig":["leipzig","rb"],
  "Bayer Leverkusen":["leverkusen","bayer"],
  "Juventus FC":["juve","juventus","juventus turin","la juve","juventus fc"],
  "SSC Napoli":["napoli","naples","ssc napoli","ssc naples"],
  "AS Roma":["roma","as roma","as rome","rome"],
  "SS Lazio":["lazio","ss lazio"],
  "ACF Fiorentina":["fiorentina","la viola","florence","acf fiorentina"],
  "Tottenham":["spurs","tottenham hotspur"],
  "Arsenal":["ars","gunners","les gunners"],
  "Chelsea":["the blues","les blues"],
  "Liverpool":["lfc"],
  "Newcastle":["newcastle united","nufc"],
  "Everton":["toffees"],
  "West Ham":["west ham united","whu"],
  "Aston Villa":["villa","avfc"],
  "Leicester City":["leicester"],
  "Southampton":["saints"],
  "Wolverhampton":["wolves"],
  "Brighton":["bha"],
  "Marseille":["om","olympique de marseille","l'om"],
  "Lyon":["ol","olympique lyonnais"],
  "Monaco":["as monaco","asm"],
  "Lille":["losc"],
  "Rennes":["stade rennais"],
  "Nice":["ogc nice"],
  "Saint-Etienne":["asse","st etienne","sainté"],
  "Bordeaux":["girondins","fcgb"],
  "Sevilla":["seville","fc seville","séville"],
  "Valencia":["valence"],
  "Villarreal":["sous-marin jaune"],
  "Athletic Bilbao":["bilbao","athletic club","athletic"],
  "Real Betis":["betis"],
  "Sporting CP":["sporting","sporting lisbonne","sporting lisbon"],
  "Benfica":["sl benfica","benfica lisbonne"],
  "Porto":["fc porto"],
  "Ajax Amsterdam":["ajax amsterdam"],
  "Celtic":["celtic glasgow"],
  "Galatasaray":["gala"],
  "Schalke":["schalke 04"],
  "Werder Bremen":["werder","bremen","breme"],
  "Wolfsburg":["vfl wolfsburg"],
  "Eintracht Frankfurt":["frankfurt","eintracht"],
  "Flamengo":["flamengo","fla","crf"],
  "Cruzeiro":["cruzeiro","cec"],
  "Cannes":["as cannes","cannes"],
  "Orlando City":["orlando","osc"],
  "Fulham":["fulham fc","the cottagers"],
  "Brentford":["brentford fc","the bees"],
  "Sampdoria":["uc sampdoria","samp"],
  "Midtjylland":["fc midtjylland","fcm"],
  "Sint-Truiden":["stvv","sint truiden","saint trond"],
  "Hamburg":["hamburger sv","hsv"],
  "Al Qadsiah":["al-qadsiah","qadsiah"],
  "Almería":["ud almeria","almerıa"],
  "Málaga":["malaga cf","los boquerones"],
  "Boca Juniors":["boca","los xeneizes","club atletico boca juniors"],
  "Racing Club":["racing","la academia"],
  "Santos":["santos fc","peixe"],
  "Empoli FC":["empoli","empoli fc","gli azzurri"],
  "Udinese Calcio":["udinese","udinese calcio","zebrette"],
  "Hoffenheim":["tsg hoffenheim","tsg 1899","1899 hoffenheim"],
  "Genoa CFC":["genoa","genoa cfc","genova","grifone"],
  "Granada":["granada cf","los nazaríes"],
  "Amiens":["amiens sc","asc amiens"],
  "Torino FC":["torino","torino fc","toro","granata"],
  "West Brom":["west bromwich","wba","west bromwich albion"],
  "Sunderland":["sunderland afc","safc","black cats"],
  "Sochaux":["fc sochaux","fcsm"],
  "Servette":["servette fc","servette geneve"],
  "Charleroi":["sporting charleroi","rsc charleroi"],
  "Espérance Tunis":["esperance tunis","est","esperance sportive de tunis","esperance de tunis"],
  "CS Sfaxien":["sfaxien","csf","club sportif sfaxien"],
  "Caen":["sm caen","stade malherbe"],
  "Lorient":["fc lorient","les merlus"],
  "Valenciennes":["valenciennes fc","vafc"],
  "Gent":["kaa gent","aa gent"],
  "Stoke City":["stoke","the potters"],
  "Köln":["cologne","koln","fc cologne","fc köln","1. fc köln","1.fc köln","effzeh"],
  "Mainz":["mainz 05","fsv mainz"],
  "Reims":["stade de reims","stade reims"],
  "Angers":["angers sco","sco angers"],
  "Al Shamal":["al-shamal","shamal"],
  "Al Sadd":["al sadd","sadd","al-sadd sc"],
  "Genk":["racing genk","krc genk"],
  "Real Valladolid":["valladolid"],
  "Real Zaragoza":["zaragoza"],
  "AZ":["az alkmaar","alkmaar"],
  "LAFC":["los angeles fc","los angeles football club"],
  "QPR":["queens park rangers","queens park","q.p.r."],
  "Atalanta BC":["atalanta","atalanta bc","la dea"],
  "Bologna FC":["bologna","bologna fc","rossoblu bologna"],
  "Cagliari Calcio":["cagliari","cagliari calcio"],
  "Parma FC":["parma","parma fc","parma calcio","gialloblu"],
};

// ─── CLUB_DISPLAY_NAMES ─────────────────────────────────────────────
// Mapping nom court (BDD) → nom officiel à afficher dans l'UI.
// La BDD reste inchangée, le matching utilise toujours les noms courts + CLUB_ALIASES.
// Cette couche ne sert qu'à l'affichage : si pas de mapping, le nom court est affiché tel quel.
const CLUB_DISPLAY_NAMES = {
  // Ligue 1 (FR)
  "PSG": "Paris Saint-Germain",
  "Marseille": "Olympique de Marseille",
  "Lyon": "Olympique Lyonnais",
  "Saint-Etienne": "AS Saint-Étienne",
  "Monaco": "AS Monaco",
  "Lille": "LOSC Lille",
  "Lens": "RC Lens",
  "Nice": "OGC Nice",
  "Rennes": "Stade Rennais",
  "Reims": "Stade de Reims",
  "Bordeaux": "Girondins de Bordeaux",
  "Strasbourg": "RC Strasbourg",
  "Caen": "SM Caen",
  "Lorient": "FC Lorient",
  "Brest": "Stade Brestois",
  "Auxerre": "AJ Auxerre",
  "Le Havre": "Le Havre AC",
  "Angers": "Angers SCO",
  "Cannes": "AS Cannes",
  "Nantes": "FC Nantes",
  "Sochaux": "FC Sochaux",
  "Amiens": "Amiens SC",
  "Valenciennes": "Valenciennes FC",
  "Toulouse": "Toulouse FC",
  "Montpellier": "Montpellier HSC",
  // Premier League (EN)
  "Bournemouth": "AFC Bournemouth",
  "Brighton": "Brighton & Hove Albion",
  "Wolverhampton": "Wolverhampton Wanderers",
  "Tottenham": "Tottenham Hotspur",
  "Newcastle": "Newcastle United",
  "West Ham": "West Ham United",
  "West Brom": "West Bromwich Albion",
  // La Liga (ES)
  "Atletico Madrid": "Atlético de Madrid",
  "Athletic Bilbao": "Athletic Club Bilbao",
  "Real Betis": "Real Betis Balompié",
  "Almería": "UD Almería",
  "Málaga": "Málaga CF",
  // Bundesliga (DE)
  "Bayern Munich": "FC Bayern Munich",
  "Bayer Leverkusen": "Bayer 04 Leverkusen",
  "Borussia Mönchengladbach": "Borussia Mönchengladbach",
  "Hoffenheim": "TSG 1899 Hoffenheim",
  "Hamburg": "Hamburger SV",
  "Schalke": "FC Schalke 04",
  "Wolfsburg": "VfL Wolfsburg",
  "Werder Bremen": "SV Werder Bremen",
  "Köln": "1. FC Köln",
  "Mainz": "Mainz 05",
  // Liga NOS (PT)
  "Porto": "FC Porto",
  "Benfica": "SL Benfica",
  // Eredivisie (NL)
  "AZ": "AZ Alkmaar",
  // Brésil
  "Flamengo": "CR Flamengo",
};

function getClubDisplayName(club){
  if(!club) return club;
  return CLUB_DISPLAY_NAMES[club] || club;
}

export const CLUB_COLORS = {
  "Arsenal":["#EF0107","#063672"],"Chelsea":["#034694","#DBA111"],"Liverpool":["#C8102E","#FFFFFF"],
  "Manchester United":["#DA291C","#FFFFFF"],"Manchester City":["#6CABDD","#1C2C5B"],"Tottenham":["#132257","#FFFFFF"],
  "Newcastle":["#241F20","#FFFFFF"],"Everton":["#003399","#FFFFFF"],"West Ham":["#7A263A","#1BB1E7"],
  "Aston Villa":["#670E36","#95BFE5"],"Leicester City":["#003090","#FDBE11"],
  "Brighton":["#0057B8","#FFFFFF"],"Southampton":["#D71920","#FFFFFF"],"Wolverhampton":["#FDB913","#231F20"],
  "Real Madrid":["#FEBE10","#FFFFFF"],"Barcelona":["#A50044","#004D98"],"Atletico Madrid":["#CB3524","#FFFFFF"],
  "Sevilla":["#D71920","#FFFFFF"],"Valencia":["#F47920","#000000"],"Villarreal":["#FCD000","#004C8C"],
  "Athletic Bilbao":["#EE2523","#FFFFFF"],"Real Betis":["#00954C","#FFFFFF"],
  "Juventus FC":["#000000","#FFFFFF"],"AC Milan":["#FB090B","#000000"],"Inter Milan":["#0066B2","#000000"],
  "SSC Napoli":["#12A0C3","#FFFFFF"],"AS Roma":["#8E1F2F","#F0BC42"],"SS Lazio":["#87CEEB","#FFFFFF"],
  "ACF Fiorentina":["#4B0082","#FFFFFF"],"Atalanta BC":["#1D2951","#E32221"],
  "PSG":["#004170","#DA291C"],"Marseille":["#009BCE","#FFFFFF"],"Lyon":["#032CA6","#E4003A"],
  "Monaco":["#D4011D","#FFFFFF"],"Lille":["#E31B23","#1F3764"],"Bordeaux":["#1A1255","#FFFFFF"],"Nice":["#000000","#DF212A"],"Saint-Etienne":["#007744","#FFFFFF"],
  "Bayern Munich":["#DC052D","#0066B2"],"Borussia Dortmund":["#FDE100","#000000"],
  "Bayer Leverkusen":["#E32221","#000000"],"Schalke":["#004D9D","#FFFFFF"],
  "Werder Bremen":["#1D8348","#FFFFFF"],"RB Leipzig":["#DD0741","#FFFFFF"],
  "Eintracht Frankfurt":["#E1000F","#000000"],"Wolfsburg":["#65B32E","#FFFFFF"],"Benfica":["#E31B23","#FFFFFF"],"Porto":["#003F87","#FFFFFF"],"PSV Eindhoven":["#E1002A","#FFFFFF"],"Feyenoord":["#C8102E","#FFFFFF"],"AZ Alkmaar":["#E31B23","#FFFFFF"],
  "Al Nassr":["#F5C518","#0B4EA2"],"Al Hilal":["#0046AD","#FFFFFF"],"Al Ittihad":["#F5C518","#000000"],"Al Ahli":["#007A3D","#FFFFFF"],
  "LA Galaxy":["#00245D","#FFD700"],"DC United":["#000000","#EF3E42"],"Toronto FC":["#B81137","#FFFFFF"],"Inter Miami":["#F7B5CD","#000000"],"New York City FC":["#6CACE4","#003087"],"New York Red Bulls":["#ED1E36","#003087"],"Seattle Sounders":["#5D9732","#003DA5"],"Atlanta United":["#80000A","#9DC2B6"],"LAFC":["#000000","#C39E6D"],"Portland Timbers":["#004812","#EBE72B"],"Chicago Fire":["#73000A","#6CACE4"],
  "Spartak Moscow":["#CE1126","#FFFFFF"],"CSKA Moscow":["#C8102E","#003F87"],"Zenit Saint Petersburg":["#003F87","#FFFFFF"],"Lokomotiv Moscow":["#007A3D","#E31B23"],
  "Fenerbahce":["#003F7F","#FFFF00"],"Besiktas":["#000000","#FFFFFF"],"Trabzonspor":["#A41E34","#004B8D"],
  "Celtic":["#138a3e","#FFFFFF"],
  "Galatasaray":["#FFA500","#D40000"],"Lens":["#EE1C25","#F5C842"],
  "RC Strasbourg":["#003B8E","#FFFFFF"],"Sparta Rotterdam":["#CC0000","#FFFFFF"],
  "Deportivo Alavés":["#003DA5","#FFFFFF"],"CD Mirandés":["#FF0000","#000000"],
  "Fulham":["#FFFFFF","#000000"],"Brentford":["#CC0000","#FFFFFF"],"Midtjylland":["#CC0000","#FFFFFF"],
  "Parma FC":["#FFD700","#003082"],"Sint-Truiden":["#FFD700","#000000"],"RB Salzburg":["#CC0000","#FFFFFF"],
  "Standard Liège":["#CC0000","#FFFFFF"],"Almería":["#CC0000","#FFFFFF"],
  "Málaga":["#003082","#FFFFFF"],"River Plate":["#FFFFFF","#CC0000"],"Boca Juniors":["#003399","#FFD700"],
  "Racing Club":["#1565C0","#FFFFFF"],"Palmeiras":["#006B3F","#FFFFFF"],"Santos":["#000000","#FFFFFF"],"Flamengo":["#E82020","#000000"],"Cruzeiro":["#003399","#FFFFFF"],
  "Cannes":["#E31B23","#FFFFFF"],"Orlando City":["#633492","#F7B024"],
  "Leeds United":["#FFFFFF","#FFD700"],"Empoli FC":["#1565C0","#FFFFFF"],"Udinese Calcio":["#000000","#FFFFFF"],"Bologna FC":["#CC0000","#003082"],
  "Granada":["#CC0000","#FFFFFF"],
  "Sunderland":["#E31B23","#000000"],"Sochaux":["#FABE00","#003082"],
  "Charleroi":["#000000","#FFFFFF"],"Espérance Tunis":["#CC0000","#FFD700"],
  "CS Sfaxien":["#CC0000","#000000"],"Caen":["#003189","#FFFFFF"],"Valenciennes":["#CC0000","#FFFFFF"],
  "Gent":["#1B67B2","#FFFFFF"],
  "Köln":["#ED1C24","#FFFFFF"],"Mainz":["#C8102E","#FFFFFF"],
  "Angers":["#000000","#FFFFFF"],"Al Shamal":["#006A4E","#FFFFFF"],
  "Genk":["#1B67B2","#FFFFFF"],"Real Valladolid":["#4B0082","#FFFFFF"],
  "Real Zaragoza":["#003399","#FFFFFF"],
  // === Ajouts couleurs officielles clubs manquants ===
  "Crystal Palace":["#1B458F","#C4122E"],
  "Nottingham Forest":["#DD0000","#FFFFFF"],
  "Stuttgart":["#E32219","#FFFFFF"],
  "Borussia Mönchengladbach":["#000000","#00B04F"],
  "Real Sociedad":["#003DA5","#FFFFFF"],
  "Bournemouth":["#DA291C","#000000"],
  "Hoffenheim":["#1961AC","#FFFFFF"],
  "Genoa CFC":["#C8102E","#1B3A6F"],
  "West Brom":["#122F67","#FFFFFF"],
  "Watford":["#FBEE23","#ED2127"],
  "Torino FC":["#8B1B2E","#FFFFFF"],
  "Nantes":["#FBE216","#00AB59"],
  "Toulouse":["#4B1F7F","#FFFFFF"],
  "Sassuolo":["#00A651","#000000"],
  "Club Brugge":["#004996","#000000"],
  "Reims":["#DA291C","#FFFFFF"],
  "Stoke City":["#E03A3E","#FFFFFF"],
  "Salzburg":["#CE0E2D","#FFFFFF"],
  "NEC Nijmegen":["#C8102E","#000000"],
  "AZ":["#CF142B","#FFFFFF"],
  "Anderlecht":["#6E3D92","#FFFFFF"],
  "Swansea":["#FFFFFF","#000000"],
  "Braga":["#C8102E","#FFFFFF"],
  "Kasımpaşa":["#06245B","#FFFFFF"],
  "Dinamo Zagreb":["#1B4BA3","#FFFFFF"],
  "Le Havre":["#0B4C9E","#FFFFFF"],
  "Montpellier":["#F58220","#005CA7"],
  "Bolton":["#FFFFFF","#1B1F6C"],
  "Auxerre":["#1B4BA3","#FFFFFF"],
  "Union Saint-Gilloise":["#FFD700","#0A3A7A"],
  "Birmingham City":["#0B4C9E","#FFFFFF"],
  "Union Berlin":["#E32219","#F8C300"],
  "Twente":["#C8102E","#FFFFFF"],
  "Burnley":["#6C1D45","#99D6EA"],
  "Mallorca":["#C8102E","#FFD700"],
  "Hull City":["#F47A20","#000000"],
  "Palermo":["#F8B5C6","#000000"],
  "Al Arabi":["#7A003C","#FFD700"],
  "Al Sadd":["#8B1B2E","#FFFFFF"],
  "Celta Vigo":["#8AC5EC","#FFFFFF"],
  "Portsmouth":["#003EA1","#FFFFFF"],
  "Antwerp":["#C8102E","#FFFFFF"],
  "Hertha Berlin":["#004E9F","#FFFFFF"],
  "Utrecht":["#C8102E","#FFFFFF"],
  "Shakhtar":["#FD6A00","#000000"],
  "Istanbul Başakşehir":["#F58220","#1B1F6C"],
  "Club América":["#F3D03E","#0A3A7A"],
  "Olympiacos":["#C8102E","#FFFFFF"],
  "Guingamp":["#C8102E","#000000"],
  "Cardiff City":["#0070B5","#FFFFFF"],
  "Bastia":["#003DA5","#FFFFFF"],
  "Espanyol":["#0046AD","#FFFFFF"],
  "Getafe":["#005CA7","#FFFFFF"],
  "Girona":["#C8102E","#FFFFFF"],
  "Osasuna":["#D91024","#000033"],
  "Almería":["#C8102E","#FFFFFF"],
  "Las Palmas":["#FFDE00","#0046AD"],
  "Strasbourg":["#0046AD","#FFFFFF"],
  "Brest":["#C8102E","#FFFFFF"],
  "Metz":["#7B0E1E","#FFFFFF"],
  "Rennes":["#C8102E","#000000"],
  "Troyes":["#0046AD","#FFFFFF"],
  "Nîmes":["#C8102E","#FFFFFF"],
  "Nancy":["#EF3E42","#FFFFFF"],
  "Lorient":["#F58220","#000000"],
  "Clermont":["#003DA5","#C8102E"],
  "Paris FC":["#003DA5","#FFFFFF"],
  "Amiens":["#4B1F7F","#FFFFFF"],
  "Middlesbrough":["#C8102E","#FFFFFF"],
  "Coventry City":["#87CEEB","#000000"],
  "Blackburn":["#009CDE","#FFFFFF"],
  "Preston North End":["#FFFFFF","#0A3A7A"],
  "Sheffield United":["#EE2737","#000000"],
  "QPR":["#0046AD","#FFFFFF"],
  "Charlton Athletic":["#C8102E","#FFFFFF"],
  "Norwich City":["#FBE216","#00653E"],
  "Bristol City":["#C8102E","#FFFFFF"],
  "Wigan":["#0046AD","#FFFFFF"],
  "Southend":["#0046AD","#FFFFFF"],
  "SC Freiburg":["#C8102E","#000000"],
  "Augsburg":["#BA3733","#FFFFFF"],
  "Hamburg":["#005CA7","#000000"],
  "Nuremberg":["#000000","#AD1A20"],
  "Sampdoria":["#002B5C","#FFFFFF"],
  "Hellas Verona":["#FBE216","#0A2240"],
  "Cagliari Calcio":["#8B1B2E","#005CA7"],
  "Lecce":["#FBE216","#C8102E"],
  "Monza":["#C8102E","#FFFFFF"],
  "Spezia":["#FFFFFF","#000000"],
  "Brescia":["#0046AD","#FFFFFF"],
  "Chievo":["#FBE216","#0046AD"],
  "Benevento":["#FFD700","#C8102E"],
  "Bari":["#C8102E","#FFFFFF"],
  "Basel":["#C8102E","#0046AD"],
  "Young Boys":["#FBE216","#000000"],
  "Lugano":["#000000","#FFFFFF"],
  "Sion":["#C8102E","#FFFFFF"],
  "Servette":["#C8102E","#FFFFFF"],
  "Anzhi":["#FBE216","#00653E"],
  "Krasnodar":["#000000","#00A651"],
  "Lokomotiv Moscou":["#008C39","#C8102E"],
  "Dynamo Kyiv":["#0046AD","#FFFFFF"],
  "Legia Warsaw":["#008C39","#000000"],
  "Antalyaspor":["#C8102E","#FFFFFF"],
  "Alanyaspor":["#F47A20","#FFFFFF"],
  "Gaziantep":["#C8102E","#FFFFFF"],
  "Karagümrük":["#C8102E","#FFFFFF"],
  "Adana Demirspor":["#0046AD","#FFFFFF"],
  "Ankaragücü":["#FBE216","#0046AD"],
  "Göztepe":["#C8102E","#FBE216"],
  "AEK Athens":["#FBE216","#000000"],
  "Panathinaikos":["#008C39","#FFFFFF"],
  "Aris":["#FBE216","#000000"],
  "Sporting CP":["#008C39","#FFFFFF"],
  "Vitoria Guimaraes":["#FFFFFF","#000000"],
  "Estoril":["#FBE216","#0046AD"],
  "Moreirense":["#00A651","#FFFFFF"],
  "São Paulo":["#C8102E","#FFFFFF"],
  "Bahia":["#0046AD","#C8102E"],
  "Pumas UNAM":["#003DA5","#FFD700"],
  "Fluminense":["#7B0E1E","#00653E"],
  "Vasco da Gama":["#FFFFFF","#000000"],
  "Corinthians":["#FFFFFF","#000000"],
  "Athletico Paranaense":["#C8102E","#000000"],
  "Coritiba":["#00653E","#FFFFFF"],
  "Fortaleza":["#0046AD","#C8102E"],
  "Ajax Amsterdam":["#C8102E","#FFFFFF"],
  "Fortuna Sittard":["#FBE216","#00A651"],
  "Groningen":["#00A651","#FFFFFF"],
  "Volendam":["#F47A20","#FFFFFF"],
  "Heracles":["#000000","#FFFFFF"],
  "Telstar":["#FFFFFF","#000000"],
  "Go Ahead Eagles":["#C8102E","#FBE216"],
  "NAC Breda":["#FBE216","#000000"],
  "Cercle Bruges":["#00A651","#000000"],
  "Beveren":["#FBE216","#C8102E"],
  "Mouscron":["#C8102E","#FFFFFF"],
  "Molde":["#0046AD","#FFFFFF"],
  "Rosenborg":["#000000","#FFFFFF"],
  "IFK Göteborg":["#0046AD","#FFFFFF"],
  "Malmö":["#87CEEB","#FFFFFF"],
  "Djurgårdens IF":["#0046AD","#FFFFFF"],
  "Nordsjælland":["#FBE216","#000000"],
  "Huracán":["#FFFFFF","#C8102E"],
  "Argentinos Juniors":["#C8102E","#FFFFFF"],
  "San Lorenzo":["#0046AD","#C8102E"],
  "Talleres":["#FFFFFF","#0046AD"],
  "Tigre":["#0046AD","#C8102E"],
  "Nacional":["#FFFFFF","#87CEEB"],
  "Plaza Colonia":["#C8102E","#FFFFFF"],
  "Cerro Porteño":["#0046AD","#C8102E"],
  "Monterrey":["#0046AD","#FBE216"],
  "Independiente del Valle":["#000000","#C8102E"],
  "Elche":["#008C39","#FFFFFF"],
  "Alavés":["#003DA5","#FFFFFF"],
  "Málaga":["#87CEEB","#FFFFFF"],
  "Deportivo":["#0046AD","#FFFFFF"],
  "Al Ettifaq":["#C8102E","#FBE216"],
  "Al Shabab":["#FFFFFF","#000000"],
  "Al-Gharafa":["#C8102E","#000000"],
  "Al Ahly":["#C8102E","#FFFFFF"],
  "Al Qadsiah":["#FBE216","#000000"],
  "Al-Duhail":["#8B1B2E","#FFFFFF"],
  "Al Taawon":["#008C39","#FFFFFF"],
  "Al Hazm":["#008C39","#FFFFFF"],
  "Amkar Perm":["#C8102E","#FFFFFF"],
  "Nagoya Grampus":["#C8102E","#FBE216"],
  "Vissel Kobe":["#8B1B2E","#FFFFFF"],
  "Guangzhou":["#C8102E","#FFFFFF"],
  "Shanghai SIPG":["#C8102E","#000000"],
  "Shanghai Shenhua":["#0046AD","#FFFFFF"],
  "Dalian Aerbin":["#0046AD","#FFFFFF"],
  "Hebei China Fortune":["#008C39","#FFFFFF"],
  "Jiangsu Suning":["#0046AD","#FBE216"],
  "Vancouver Whitecaps":["#FFFFFF","#0046AD"],
  "CF Montréal":["#87CEEB","#FFFFFF"],
  "FC Dallas":["#C8102E","#0046AD"],
  "New York Cosmos":["#FBE216","#008C39"],
  "Fort Lauderdale Strikers":["#C8102E","#FBE216"],
  "Wydad Casablanca":["#C8102E","#FFFFFF"],
  "Le Mans":["#C8102E","#FBE216"],
  "Orléans":["#C8102E","#FBE216"],
  "Stade Brestois":["#C8102E","#FFFFFF"],
  "Reggina":["#0046AD","#FBE216"],
  "Ituano":["#C8102E","#000000"],
  "Piacenza":["#C8102E","#FFFFFF"],
  "Salernitana":["#7B0E1E","#FFFFFF"],
  "Pisa":["#000000","#0046AD"],
  "Zenit Saint-Pétersbourg":["#87CEEB","#0046AD"],
  "Zurich":["#FFFFFF","#0046AD"],
  "Chmel Blšany":["#FFFFFF","#0046AD"],
  "Metalurh Donetsk":["#F47A20","#000000"],
  "Sparta Prague":["#8B1B2E","#FBE216"],
  "Sturm Graz":["#000000","#FFFFFF"],
  "Ipswich Town":["#004D9D","#FFFFFF"],
  "Rangers":["#0046AD","#C8102E"],
  "Laval":["#F7B500","#000000"],
  "FSV Frankfurt":["#000000","#FFFFFF"],
  "Abha":["#008C39","#FFFFFF"],
  "Brondby":["#FBE216","#0046AD"],
  "Cobh Ramblers":["#C8102E","#FFFFFF"],
  "Delhi Dynamos":["#FF6B00","#FFFFFF"],
  "Emirates Club":["#C8102E","#FFFFFF"],
  "Haarlem":["#C8102E","#FFFFFF"],
  "Karlsruher SC":["#0046AD","#FFFFFF"],
  "LA Aztecs":["#008C39","#FFD700"],
  "Levante":["#0046AD","#7B0E1E"],
  "Millwall":["#0046AD","#FFFFFF"],
  "NY MetroStars":["#C8102E","#FFFFFF"],
  "Real Mallorca":["#C8102E","#FFD700"],
  "Sydney FC":["#003DA5","#87CEEB"],
  "Washington Diplomats":["#C8102E","#FFFFFF"],
  // Couleurs ajoutées pour les clubs fréquents qui n'en avaient pas (audit)
  "Reading":["#004494","#FFFFFF"],"Wigan Athletic":["#1D5BA4","#FFFFFF"],
  "Blackpool":["#F68712","#FFFFFF"],"Derby County":["#FFFFFF","#000000"],
  "Rayo Vallecano":["#FFFFFF","#E53027"],"Charlton":["#D50000","#FFFFFF"],
  "Real Madrid Castilla":["#FFFFFF","#6C4DA8"],"Como":["#005CA9","#FFFFFF"],
  "PAOK":["#000000","#FFFFFF"],"Cádiz":["#FFE114","#143C8B"],
  "Slavia Prague":["#D7141A","#FFFFFF"],"Internacional":["#E5050F","#FFFFFF"],
  "Preston":["#FFFFFF","#002F6C"],"Vélez Sarsfield":["#FFFFFF","#0067B1"],
  "Sheffield Wednesday":["#1F51A2","#FFFFFF"],"Independiente":["#E30613","#FFFFFF"],
  "Copenhagen":["#163C6E","#FFFFFF"],"Estudiantes":["#E2001A","#FFFFFF"],
  "Eibar":["#0067B2","#C4122E"],"Cremonese":["#A6192E","#B0B0B0"],
  "Shakhtar Donetsk":["#F58220","#000000"],"Vitesse":["#FCE205","#000000"],
  "Huddersfield":["#0072CE","#FFFFFF"],"Heerenveen":["#005EB8","#FFFFFF"],
  "Deportivo La Coruna":["#0069B4","#FFFFFF"],"Bochum":["#005CA9","#FFFFFF"],
  "Famalicão":["#FFFFFF","#0A3D91"],"Lanús":["#6D272C","#FFFFFF"],
  "Luton Town":["#F78F1E","#002D62"],"Grêmio":["#0D80BF","#000000"],
  "Kaiserslautern":["#E30613","#FFFFFF"],"Cruz Azul":["#003DA5","#FFFFFF"],
  "Atlético Nacional":["#00933B","#FFFFFF"],"Hearts":["#7A003C","#FFFFFF"],
  "Sporting Gijón":["#E2001A","#FFFFFF"],"Pescara":["#0072BC","#FFFFFF"],
  "Mirandés":["#C8102E","#000000"],"Hannover":["#E2001A","#000000"],
  "Brøndby":["#FFD200","#005AA7"],"Venezia":["#000000","#F58220"],
  "Barnsley":["#E30613","#FFFFFF"],"Defensa y Justicia":["#F4E500","#007A3D"],
  "Bursaspor":["#007A3D","#FFFFFF"],"Leganés":["#005BAA","#FFFFFF"],
  "Peñarol":["#FFD200","#000000"],
};

// ── BUILD DATABASES ──
// Clubs vraiment connus du grand public — utilisés pour FILTRER le mode "facile"
// du Plug : une paire ne peut rester en "facile" QUE si les 2 clubs en font
// partie. Les paires impliquant d'autres clubs de PONT_CLUBS sont rétrogradées
// en "moyen" pour ne pas exposer le débutant à Valence, Fluminense, etc.
const POPULAR_CLUBS_FACILE = new Set([
  // Premier League majeurs
  "Manchester United","Manchester City","Liverpool","Chelsea","Arsenal","Tottenham","Newcastle",
  // La Liga top 3
  "Real Madrid","Barcelona","Atletico Madrid",
  // Serie A majeurs
  "Juventus FC","AC Milan","Inter Milan","SSC Napoli","AS Roma",
  // Bundesliga top 2
  "Bayern Munich","Borussia Dortmund",
  // Ligue 1 majeurs
  "PSG","Marseille","Lyon","Monaco",
  // Portugal big 3
  "Benfica","Porto","Sporting CP",
  // Eredivisie phare
  "Ajax Amsterdam",
  // Saoudien (effet stars récentes)
  "Al Nassr","Al Hilal","Al Ittihad",
  // MLS (Messi/Beckham effect)
  "Inter Miami","LA Galaxy",
  // Turquie majeurs
  "Galatasaray","Fenerbahce",
]);

const PONT_CLUBS = new Set([
  "Manchester City","Arsenal","Liverpool","Chelsea","Manchester United",
  "Real Madrid","Barcelona","Atletico Madrid","Sevilla","Valencia",
  "Juventus FC","AC Milan","Inter Milan","SSC Napoli","AS Roma",
  "Bayern Munich","Borussia Dortmund","RB Leipzig","Bayer Leverkusen","Eintracht Frankfurt",
  "PSG","Marseille","Lyon","Monaco","Lille",
  "Benfica","Porto","Sporting CP",
  // MLS
  "LA Galaxy","Inter Miami","New York City FC","New York Red Bulls","Seattle Sounders",
  "Atlanta United","LAFC","Toronto FC","Portland Timbers","Chicago Fire","DC United",
  // Arabie Saoudite
  "Al Nassr","Al Hilal","Al Ittihad","Al Ahli",
  // Pays-Bas
  "Ajax Amsterdam","PSV Eindhoven","Feyenoord","AZ Alkmaar",
  // Turquie
  "Galatasaray","Fenerbahce","Besiktas","Trabzonspor",
  // Premier League cadres
  "Tottenham","Newcastle","Aston Villa","West Ham","Everton",
  "Leicester City","Southampton","Crystal Palace","Brighton","Fulham",
  "Wolverhampton","Nottingham Forest","Bournemouth","Brentford",
  // Italie
  "SS Lazio","ACF Fiorentina","Atalanta BC","Torino FC","Bologna FC","Udinese Calcio","Sampdoria",
  // Espagne
  "Real Sociedad","Athletic Bilbao","Villarreal","Real Betis","Celta Vigo","Espanyol","Getafe",
  // Allemagne (NORMALISÉS)
  "Stuttgart","Hoffenheim","Wolfsburg","Borussia Mönchengladbach","Werder Bremen","Schalke","Hamburg","Hertha Berlin",
  // France
  "Nice","Rennes","Lens","Saint-Etienne","Bordeaux","Nantes","Montpellier","Strasbourg","Toulouse",
  // Portugal
  "Braga","Vitoria Guimaraes",
  // Écosse
  "Celtic","Rangers",
  // Grèce/Russie/Ukraine
  "Olympiacos","Panathinaikos","CSKA Moscow","Zenit Saint Petersburg","Spartak Moscow","Shakhtar Donetsk","Dynamo Kyiv",
  // Autriche/Belgique/Danemark/Suisse
  "Salzburg","Copenhagen","Club Brugge","Anderlecht","Standard Liège","Basel",
  // === EXTENSION : clubs avec 7+ joueurs dans la base ===
  // Premier League historiques / clubs jojo
  "Watford","Sunderland","Burnley","West Brom","Leeds United","Middlesbrough",
  "Stoke City","Bolton","Swansea","Sheffield United","Blackburn","Ipswich Town","Portsmouth",
  // Italie Serie B/historiques
  "Genoa CFC","Parma FC","Sassuolo","Empoli FC","Cagliari Calcio","Hellas Verona",
  // France
  "Lorient","Angers","Reims","Metz","Auxerre","Le Havre","Brest",
  // Allemagne
  "Mainz",
  // Brésil
  "Flamengo","River Plate","Boca Juniors","São Paulo","Palmeiras","Santos","Fluminense","Corinthians",
  // Espagne
  "Real Zaragoza","Mallorca","Real Valladolid","Granada",
  // Belgique/Croatie
  "Genk","Gent","Dinamo Zagreb",
  // Italie/Espagne
  "Girona",
  // Saudi extension
  "Al Qadsiah",
]);

// Top clubs mondiaux (priorité maximale dans l'autocomplete)
// Ces clubs apparaîtront TOUJOURS en haut des suggestions s'ils matchent
const ELITE_CLUBS_RANK = {
  // Niveau 1 : top mondial absolu (rang 1-15)
  "Real Madrid": 1,
  "Barcelona": 2,
  "Manchester United": 3,
  "Manchester City": 4,
  "Bayern Munich": 5,
  "Liverpool": 6,
  "PSG": 7,
  "Juventus FC": 8,
  "AC Milan": 9,
  "Inter Milan": 10,
  "Chelsea": 11,
  "Arsenal": 12,
  "Atletico Madrid": 13,
  "Tottenham": 14,
  "Borussia Dortmund": 15,
  // Niveau 2 : très grands clubs (rang 16-35)
  "Marseille": 16,
  "Ajax Amsterdam": 17,
  "Porto": 18,
  "Benfica": 19,
  "AS Roma": 20,
  "SSC Napoli": 21,
  "Sevilla": 22,
  "Lyon": 23,
  "Monaco": 24,
  "Sporting CP": 25,
  "Bayer Leverkusen": 26,
  "RB Leipzig": 27,
  "Newcastle": 28,
  "Valencia": 29,
  "Lille": 30,
  "Galatasaray": 31,
  "Fenerbahce": 32,
  "Celtic": 33,
  "Rangers": 34,
  "Inter Miami": 35,
  // Niveau 3 : clubs connus (rang 36-60)
  "Al Nassr": 36,
  "Al Hilal": 37,
  "Al Ittihad": 38,
  "Al Ahli": 39,
  "PSV Eindhoven": 40,
  "Feyenoord": 41,
  "Atalanta BC": 42,
  "ACF Fiorentina": 43,
  "SS Lazio": 44,
  "Villarreal": 45,
  "Real Sociedad": 46,
  "Athletic Bilbao": 47,
  "Real Betis": 48,
  "Eintracht Frankfurt": 49,
  "Wolfsburg": 50,
  "West Ham": 51,
  "Aston Villa": 52,
  "Everton": 53,
  "Brighton": 54,
  "Crystal Palace": 55,
  "Besiktas": 56,
  "Flamengo": 57,
  "River Plate": 58,
  "Boca Juniors": 59,
  "Shakhtar Donetsk": 60,
};

// Renvoie le rang de popularité d'un club (plus c'est petit, plus c'est populaire)
function getClubRank(club) {
  if (ELITE_CLUBS_RANK[club] !== undefined) return ELITE_CLUBS_RANK[club];
  if (PONT_CLUBS.has(club)) return 999;
  return 1000;
}

function buildPontDB() {
  const pairMap = {};

  for (const p of PLAYERS_CLEAN) {
    if(!p||!p.clubs)continue;
    // Dédoublonnage indispensable : depuis que les carrières décrivent les
    // retours en club (Drogba : Chelsea → Galatasaray → Chelsea), un même club
    // apparaît plusieurs fois. Sans ça, la double boucle ci-dessous produit des
    // paires "Chelsea vs Chelsea".
    const bigClubs = [...new Set(p.clubs.filter(c => PONT_CLUBS.has(c)))];
    if (bigClubs.length < 2) continue;

    for (let i = 0; i < bigClubs.length; i++) {
      for (let j = i+1; j < bigClubs.length; j++) {
        const key = [bigClubs[i],bigClubs[j]].sort().join("|||");
        if (!pairMap[key]) pairMap[key] = { players:[], diff:p.diff, hasCurrent:false };
        if (!pairMap[key].players.includes(p.name)) {
          pairMap[key].players.push(p.name);
        }
        if (!isRetiredPlayer(p.name)) pairMap[key].hasCurrent = true;
        const ord = {facile:0,moyen:1,expert:2};
        if (ord[p.diff] < ord[pairMap[key].diff]) pairMap[key].diff = p.diff;
      }
    }
  }

  const db = {facile:[],moyen:[],expert:[]};
  for (const [key,val] of Object.entries(pairMap)) {
    const [c1,c2] = key.split("|||");
    // Filtre "facile" : on n'accepte une paire en facile que si les deux clubs
    // sont dans POPULAR_CLUBS_FACILE. Sinon on rétrograde en "moyen" pour
    // ne pas exposer le débutant à des clubs trop obscurs (Valence, Fluminense...).
    let targetDiff = val.diff;
    if (targetDiff === "facile" && !(POPULAR_CLUBS_FACILE.has(c1) && POPULAR_CLUBS_FACILE.has(c2))) {
      targetDiff = "moyen";
    }
    db[targetDiff].push({c1,c2,p:val.players,isCurrent:val.hasCurrent});
  }
for (const diff of ["facile","moyen","expert"]) {
  const current = db[diff].filter(q => q.isCurrent);
  const retired = db[diff].filter(q => !q.isCurrent);

  // 80% paires avec joueurs actifs, 20% paires full retraités
  const retiredTarget = Math.round((current.length / 0.8) * 0.2);
  // FIX multi : tri déterministe (alphabétique par c1+c2) au lieu de Math.random
  // pour que tous les clients construisent le même DB au chargement
  const retiredPick = retired
    .sort((a, b) => (a.c1 + a.c2).localeCompare(b.c1 + b.c2))
    .slice(0, retiredTarget);

  db[diff] = [...current, ...retiredPick];

  // Tri final déterministe (pas de shuffle) — le shuffle par room est fait
  // dans startRound avec un seed partagé entre tous les joueurs
  db[diff].sort((a, b) => (a.c1 + a.c2).localeCompare(b.c1 + b.c2));
}
return db;
}
const PLAYERS_CLEAN = PLAYERS.filter(function(p){return p&&p.name&&p.clubs&&Array.isArray(p.clubs);});

// Difficulté par joueur — sert à prioriser les joueurs "facile" comme bonne
// réponse du QCM en mode AMATEUR (voir generateOptions).
const PLAYER_DIFF = {};
for (const p of PLAYERS_CLEAN) PLAYER_DIFF[p.name] = p.diff || "moyen";

// Liste de tous les clubs uniques connus dans la base (pour autocomplete Mercato)
const ALL_CLUBS_LIST = (function(){
  const set = new Set();
  for (const p of PLAYERS_CLEAN) for (const c of p.clubs) set.add(c);
  return Array.from(set).sort();
})();


function isRetiredPlayer(name) {
  return RETIRED_PLAYERS.has(name);
}

const SPLASH_IMG = "/splash.webp"; // WebP : 229 Ko vs 1,76 Mo en PNG


const PLUG_CARD_IMG = "/plug-card.png";
const MERCATO_CARD_IMG = "/mercato-card.png";
const GRID_CARD_IMG = "/grid-card.png";
const REVEAL_CARD_IMG = "/reveal-card.png";
const GUESS_CARD_IMG = "/guess-card.png";
const DUEL_CARD_IMG = "/duel-card.png";

// ── MESSAGES DE RÉSULTAT UNIFIÉS (Plug, Mercato, solo, duel, multi) ──
const RESULT_MESSAGES = {
  fr: {
    // Labels UPPERCASE sous l'image (victoire solo/duel/multi rang 1)
    winLabels: [
      "BALLON D'OR MÉRITÉ 🏆",
      "T'AS DRIBBLÉ TOUT LE MONDE 🎯",
      "PRESTATION 5 ÉTOILES ⭐",
      "CLEAN SHEET ET VICTOIRE 🧤",
      "RESTE INVAINCU FRÈRE 👑",
      "DE LA MAGIE PURE 🪄",
      "T'AS PLIÉ LE MATCH 🎩",
      "CLASSE INTERNATIONALE 🌍",
      "POÉSIE BALLE AU PIED 🎭",
      "RECORD BATTU 📈",
      "T'ES DANS LE ONZE TYPE 🏟️",
      "MAN OF THE MATCH 🥇",
    ],
    // Labels UPPERCASE pour égalité
    drawLabels: [
      "MATCH NUL, REVANCHE ? 🤝",
      "POINT ACQUIS À DOMICILE ⚖️",
      "ON SE REVOIT AU MATCH RETOUR 🔁",
      "DEUXIÈME MANCHE DÉCISIVE 📅",
    ],
    // Labels UPPERCASE défaite
    loseLabels: [
      "DIRECTION LIGUE 2 ⬇️",
      "T'AS PRIS UNE MANITA 💥",
      "CARTON ROUGE MÉRITÉ 🟥",
      "RETOUR À L'ÉCOLE DE FOOT 📚",
      "ÉCHAUFFE-TOI MIEUX LA PROCHAINE 🔥",
      "T'AS JOUÉ AVEC UN SEUL PIED 🦶",
      "CORRECTIONNELLE 📝",
      "TA SAISON EST FINIE 📅",
      "ÉNERGIE DE REMPLAÇANT 🪑",
      "C'ÉTAIT PAS TON SOIR 🫤",
      "T'AS ÉTÉ REMPLACÉ À LA MI-TEMPS ⏱️",
      "SIFFLÉ PAR TON PROPRE PUBLIC 😬",
    ],
    // Grand message central — victoire (avec oppName dynamique)
    winCentral: [
      function(oppName){ return oppName + " peut enlever son maillot 😴"; },
      function(oppName){ return "Leçon de foot pour " + oppName + " 📚"; },
      function(oppName){ return "T'as dribblé " + oppName + " comme Maradona 🎩"; },
      function(oppName){ return "Maître d'école face à " + oppName + " 🎓"; },
      function(oppName){ return "On a vu plus de jeu en U13 💀"; },
      function(oppName){ return "T'as mis " + oppName + " au tapis 🥊"; },
      function(oppName){ return "Balle au centre " + oppName + ", on recommence 🔁"; },
      function(oppName){ return "Même avec l'aide de la VAR " + oppName + " était largué 📹"; },
      function(oppName){ return oppName + " va revoir ses bases 📖"; },
      function(oppName){ return "C'est pour ça qu'on t'appelle le patron 🫡"; },
      function(oppName){ return "Tu montes dans la hiérarchie du vestiaire 📈"; },
      function(oppName){ return oppName + " va regarder les replays toute la nuit 📺"; },
    ],
    // Grand message central — défaite (avec oppName dynamique)
    loseCentral: [
      function(oppName){ return "Tu t'es fait rouler dessus comme une 2CV 🚗"; },
      function(oppName){ return oppName + " t'a mis la misère 💀"; },
      function(oppName){ return "Même en loisir tu serais sur le banc 🪑"; },
      function(oppName){ return "T'as besoin d'un stage en Régional 3 📋"; },
      function(oppName){ return "Tes cartes Panini pleurent en douce 😭"; },
      function(oppName){ return "T'as joué comme un dimanche sans motivation 😴"; },
      function(oppName){ return oppName + " t'a servi un cours magistral 🎓"; },
      function(oppName){ return "T'as fait plus de fautes que de passes réussies ❌"; },
      function(oppName){ return "Même avec 11 remplaçants frais tu perdais 🤷"; },
      function(oppName){ return "Le public a sifflé ta sortie 🙉"; },
      function(oppName){ return oppName + " a joué à un autre niveau 🌌"; },
      function(oppName){ return "T'as confondu le terrain avec la salle d'attente 🛋️"; },
    ],
    // Égalité (centre)
    drawCentral: [
      "Match nul, la vraie bataille se jouera au retour 🤝",
      "Point partagé, mais on sait qui avait le ballon 👀",
      "À la prochaine, sans la pression cette fois 🔁",
    ],
    // Abandon adverse (avec oppName dynamique)
    abandonedCentral: [
      function(oppName){ return oppName + " a pris la fuite au vestiaire 🏃"; },
      function(oppName){ return oppName + " a préféré rendre le brassard 🏳️"; },
      function(oppName){ return "Victoire par forfait, mais elle compte 🏆"; },
      function(oppName){ return oppName + " a quitté le terrain avant le coup de sifflet 🚪"; },
    ],
    // Trash-talk du vainqueur au perdant (messages courts)
    winTaunts: [
      "C'était trop facile, la prochaine je joue en dormant 😴",
      "Faut revoir les fondamentaux frère 📚",
      "Reviens quand t'auras monté ton niveau 📈",
      "On jouait pas au même jeu on dirait 🎮",
      "Merci pour les points, tu m'as boosté au classement 🙏",
      "C'était pour quelle équipe déjà ? 🤔",
      "Je t'ai laissé trop d'espaces, ma faute 🫣",
      "Revanche ? Cette fois je dribble moins 🎯",
      "T'as fait mieux que la dernière fois, continue 👏",
      "Si t'étais coach tu te sortirais du terrain 😬",
      "Tranquille, bien joué quand même 🫡",
      "Next fois prépare-toi mieux, pour de vrai 💪",
    ],
    // BRAVO solo (mode daily)
    soloWin: [
      "BIEN VU FRÈRE ! 👏",
      "MÉMOIRE DE CHAMPION 🧠",
      "VRAI CONNAISSEUR ! 🎓",
      "COMME ZIDANE EN 98 🌟",
      "PROPRE, NET ET SANS BAVURE ✨",
      "T'ES UN BON VRAI 👊",
      "NIVEAU GOAT 🐐",
      "IL A PAS VOLÉ SA PLACE ICI ⚽",
      "ENCYCLOPÉDIE VIVANTE 📖",
      "C'ÉTAIT ÉCRIT 📝",
    ],
  },
  en: {
    winLabels: [
      "BALLON D'OR PERFORMANCE 🏆",
      "YOU OUTCLASSED EVERYONE 🎯",
      "FIVE-STAR DISPLAY ⭐",
      "CLEAN SHEET AND THE W 🧤",
      "STAY UNBEATEN KING 👑",
      "PURE MAGIC 🪄",
      "HAT-TRICK HERO 🎩",
      "WORLD-CLASS STUFF 🌍",
      "POETRY IN MOTION 🎭",
      "NEW PERSONAL RECORD 📈",
      "TEAM OF THE WEEK 🏟️",
      "MAN OF THE MATCH 🥇",
    ],
    drawLabels: [
      "SCORE DRAW, REMATCH? 🤝",
      "HOME POINT SECURED ⚖️",
      "SEE YOU AT THE RETURN LEG 🔁",
      "SECOND LEG DECIDES 📅",
    ],
    loseLabels: [
      "STRAIGHT TO THE CHAMPIONSHIP ⬇️",
      "YOU GOT MANITA'D 💥",
      "DESERVED RED CARD 🟥",
      "BACK TO FOOTBALL SCHOOL 📚",
      "WARM UP BETTER NEXT TIME 🔥",
      "PLAYED ON ONE LEG 🦶",
      "ABSOLUTE MAULING 📝",
      "YOUR SEASON IS OVER 📅",
      "BENCH WARMER ENERGY 🪑",
      "NOT YOUR NIGHT 🫤",
      "SUBBED OFF AT HALFTIME ⏱️",
      "BOOED BY YOUR OWN FANS 😬",
    ],
    winCentral: [
      function(oppName){ return oppName + " can take their jersey off 😴"; },
      function(oppName){ return "Football lesson for " + oppName + " 📚"; },
      function(oppName){ return "You dribbled " + oppName + " like Maradona 🎩"; },
      function(oppName){ return "Schoolmaster vs " + oppName + " 🎓"; },
      function(oppName){ return "We've seen better at U13 level 💀"; },
      function(oppName){ return "You sent " + oppName + " to the canvas 🥊"; },
      function(oppName){ return "Kickoff again " + oppName + ", go study 🔁"; },
      function(oppName){ return "Even with VAR help " + oppName + " was lost 📹"; },
      function(oppName){ return oppName + " needs to learn the basics 📖"; },
      function(oppName){ return "That's why they call you the boss 🫡"; },
      function(oppName){ return "Dressing-room hierarchy, rising 📈"; },
      function(oppName){ return oppName + " is watching replays all night 📺"; },
    ],
    loseCentral: [
      function(oppName){ return "They ran you over like a scooter 🛴"; },
      function(oppName){ return oppName + " dismantled you 💀"; },
      function(oppName){ return "Even in a pickup game you'd be a sub 🪑"; },
      function(oppName){ return "You need Sunday league training 📋"; },
      function(oppName){ return "Your trading cards are crying 😭"; },
      function(oppName){ return "You played like a Sunday afternoon 😴"; },
      function(oppName){ return oppName + " gave you a masterclass 🎓"; },
      function(oppName){ return "More fouls than completed passes ❌"; },
      function(oppName){ return "Not even 11 fresh subs could save you 🤷"; },
      function(oppName){ return "The crowd booed you off 🙉"; },
      function(oppName){ return oppName + " was on a different level 🌌"; },
      function(oppName){ return "You thought the pitch was the waiting room 🛋️"; },
    ],
    drawCentral: [
      "Score draw — the real battle is the rematch 🤝",
      "Points shared, but we know who had the ball 👀",
      "Until next time, no pressure 🔁",
    ],
    abandonedCentral: [
      function(oppName){ return oppName + " ran back to the locker room 🏃"; },
      function(oppName){ return oppName + " handed in the armband 🏳️"; },
      function(oppName){ return "Forfeit W, but it still counts 🏆"; },
      function(oppName){ return oppName + " left the pitch before the whistle 🚪"; },
    ],
    winTaunts: [
      "Too easy — next time I'll play in my sleep 😴",
      "Review the basics mate 📚",
      "Come back when you've leveled up 📈",
      "Guess we weren't playing the same game 🎮",
      "Thanks for the points, you boosted my rank 🙏",
      "What team were you on again? 🤔",
      "Gave you too much space, my bad 🫣",
      "Rematch? I'll dribble less this time 🎯",
      "Better than last time, keep going 👏",
      "If you were a coach, you'd sub yourself off 😬",
      "Chill, well played anyway 🫡",
      "Next time prepare better, for real 💪",
    ],
    soloWin: [
      "WELL SPOTTED MATE! 👏",
      "CHAMPION'S MEMORY 🧠",
      "TRUE CONNOISSEUR! 🎓",
      "ZIDANE '98 VIBES 🌟",
      "CLEAN AND CLINICAL ✨",
      "YOU'RE A REAL ONE 👊",
      "GOAT-LEVEL KNOWLEDGE 🐐",
      "HE EARNED HIS SPOT ⚽",
      "LIVING ENCYCLOPEDIA 📖",
      "IT WAS WRITTEN 📝",
    ],
  },
};

// Sélection pseudo-aléatoire stable d'après une seed numérique
function pickResultMessage(arr, seed) {
  if (!arr || arr.length === 0) return "";
  const idx = Math.abs(Math.floor(seed * 7)) % arr.length;
  return arr[idx];
}

const DB = buildPontDB();

// Score "crédible" pour le bot adversaire en mode EN LIGNE (faux multi).
// 50/50 win ou lose, variance proportionnelle au score utilisateur.
function generateBotScore(userScore) {
  const willWin = Math.random() < 0.5;
  const base = Math.max(0, Math.floor(userScore || 0));
  const variance = Math.max(25, Math.floor(base * 0.35));
  const delta = Math.floor(Math.random() * variance) + 8;
  return Math.max(0, base + (willWin ? delta : -delta));
}

// ── DAILY CHALLENGE ──
// Clubs de chaque grande ligue pour le défi du jour thématique
const LEAGUE_CLUBS = {
  L1: ["PSG", "Marseille", "Lyon", "Monaco", "Lille", "Rennes", "Nice", "Nantes", "Toulouse",
       "Montpellier", "Reims", "Strasbourg", "Brest", "Metz", "Saint-Etienne", "Bordeaux",
       "Le Havre", "Troyes", "Clermont", "Angers", "Auxerre", "Lens", "Nîmes", "Nancy", "Sochaux",
       "Lorient", "Amiens", "Paris FC", "Bastia", "Guingamp", "Valenciennes", "Ajaccio", "Stade Brestois"],
  PL: ["Manchester United", "Manchester City", "Liverpool", "Chelsea", "Arsenal", "Tottenham",
       "Newcastle", "Everton", "Aston Villa", "West Ham", "Leicester City", "Brighton", "Brentford",
       "Crystal Palace", "Fulham", "Nottingham Forest", "Bournemouth", "Wolverhampton", "Southampton",
       "Leeds United", "Burnley", "Watford", "Norwich City", "Sheffield United", "Stoke City", "Swansea",
       "Sunderland", "West Brom"],
  LIGA: ["Real Madrid", "Barcelona", "Atletico Madrid", "Sevilla", "Valencia", "Villarreal",
         "Real Betis", "Real Sociedad", "Athletic Bilbao", "Celta Vigo", "Getafe", "Osasuna",
         "Espanyol", "Girona", "Mallorca", "Las Palmas", "Cádiz", "Almería", "Alavés", "Elche",
         "Málaga", "Deportivo", "Real Zaragoza", "Real Mallorca", "Levante", "Granada"],
  SERIEA: ["Juventus FC", "AC Milan", "Inter Milan", "SSC Napoli", "AS Roma", "SS Lazio", "Atalanta BC", "ACF Fiorentina",
           "Torino FC", "Bologna FC", "Sassuolo", "Udinese Calcio", "Genoa CFC", "Sampdoria", "Hellas Verona", "Cagliari Calcio",
           "Lecce", "Monza", "Spezia", "Parma FC", "Palermo", "Empoli FC", "Salernitana", "Chievo",
           "Brescia", "Benevento", "Bari", "Pisa"],
  BUNDESLIGA: ["Bayern Munich", "Borussia Dortmund", "Bayer Leverkusen", "RB Leipzig", "Stuttgart",
               "Eintracht Frankfurt", "Wolfsburg", "Borussia Mönchengladbach", "Hoffenheim", "Mainz",
               "Schalke", "Hamburg", "Hertha Berlin", "Union Berlin", "SC Freiburg", "Augsburg",
               "Köln", "Werder Bremen", "Nuremberg"],
};

// Clubs "populaires" pour le mode facile : top clubs des 5 grands championnats
// + Saudi Pro League (pour les stars partis là-bas) + gros clubs mondiaux connus
// Quand un joueur arrive sur la sélection en mode facile, il doit avoir AU MOINS
// un club populaire restant dans sa carrière (sinon on évite de le proposer)
const FAMOUS_CLUBS = new Set([
  // PL top clubs
  "Manchester United", "Manchester City", "Liverpool", "Chelsea", "Arsenal", "Tottenham",
  "Newcastle", "Everton", "Aston Villa", "West Ham",
  // Liga top clubs
  "Real Madrid", "Barcelona", "Atletico Madrid", "Sevilla", "Valencia", "Villarreal",
  "Real Betis", "Real Sociedad", "Athletic Bilbao",
  // Serie A top clubs
  "Juventus FC", "AC Milan", "Inter Milan", "SSC Napoli", "AS Roma", "SS Lazio", "Atalanta BC", "ACF Fiorentina",
  // Bundesliga top clubs
  "Bayern Munich", "Borussia Dortmund", "Bayer Leverkusen", "RB Leipzig",
  "Eintracht Frankfurt", "Wolfsburg", "Schalke",
  // L1 top clubs
  "PSG", "Marseille", "Lyon", "Monaco", "Lille", "Rennes", "Nice", "Nantes", "Lens",
  // Saudi Pro League (stars connues)
  "Al Nassr", "Al Hilal", "Al Ittihad", "Al Ahli",
  // Gros clubs Portugal / Pays-Bas / Brésil / Turquie
  "Porto", "Benfica", "Sporting CP", "Ajax Amsterdam", "PSV Eindhoven",
  "Flamengo", "Santos", "Palmeiras", "Corinthians", "São Paulo",
  "Galatasaray", "Fenerbahce", "Besiktas",
  // Autres connus
  "Celtic", "Rangers",
]);

// Nombre de clubs "famous" DISTINCTS. Les carrières décrivent désormais les
// retours en club (Skorupski : Roma → Empoli → Roma), donc compter les doublons
// ferait passer un joueur d'un seul grand club pour un joueur de deux.
function famousClubCount(p) {
  return new Set((p && p.clubs ? p.clubs : []).filter(c => FAMOUS_CLUBS.has(c))).size;
}

// Thèmes par jour de la semaine (0=dim, 1=lun, ... 6=sam)
const DAILY_THEMES = {
  1: { id:"L1",         flag:"🇫🇷", labelFr:"LUNDI LIGUE 1",       labelEn:"MONDAY LIGUE 1",       labelDe:"MONTAG LIGUE 1",     labelIt:"LUNEDÌ LIGUE 1",     labelPt:"SEGUNDA LIGUE 1",     color:"#1B2C5C", filter:"L1" },
  2: { id:"PL",         flag:"🇬🇧", labelFr:"MARDI PREMIER LEAGUE", labelEn:"TUESDAY PREMIER LEAGUE", labelDe:"DIENSTAG PREMIER LEAGUE", labelIt:"MARTEDÌ PREMIER LEAGUE", labelPt:"TERÇA PREMIER LEAGUE", color:"#3D195B", filter:"PL" },
  3: { id:"LIGA",       flag:"🇪🇸", labelFr:"MERCREDI LA LIGA",     labelEn:"WEDNESDAY LA LIGA",     labelDe:"MITTWOCH LA LIGA",   labelIt:"MERCOLEDÌ LA LIGA",  labelPt:"QUARTA LA LIGA",      color:"#C8102E", filter:"LIGA" },
  4: { id:"SERIEA",     flag:"🇮🇹", labelFr:"JEUDI SERIE A",        labelEn:"THURSDAY SERIE A",      labelDe:"DONNERSTAG SERIE A", labelIt:"GIOVEDÌ SERIE A",    labelPt:"QUINTA SERIE A",      color:"#008C45", filter:"SERIEA" },
  5: { id:"BUNDESLIGA", flag:"🇩🇪", labelFr:"VENDREDI BUNDESLIGA",  labelEn:"FRIDAY BUNDESLIGA",     labelDe:"FREITAG BUNDESLIGA", labelIt:"VENERDÌ BUNDESLIGA", labelPt:"SEXTA BUNDESLIGA",    color:"#D4AF37", filter:"BUNDESLIGA" },
  6: { id:"LEGEND",     flag:"🐐", labelFr:"SAMEDI LÉGENDE",        labelEn:"SATURDAY LEGEND",        labelDe:"SAMSTAG LEGENDE",    labelIt:"SABATO LEGGENDA",    labelPt:"SÁBADO LENDA",        color:"#FFD700", filter:"LEGEND" },
  0: { id:"JOKER",      flag:"🎲", labelFr:"DIMANCHE JOKER",        labelEn:"SUNDAY JOKER",           labelDe:"SONNTAG JOKER",      labelIt:"DOMENICA JOKER",     labelPt:"DOMINGO JOKER",       color:"#00E676", filter:"JOKER" },
};

function getTodayTheme() {
  const d = new Date();
  const paris = new Date(d.toLocaleString('en-US',{timeZone:'Europe/Paris'}));
  return DAILY_THEMES[paris.getDay()];
}

// Dates pour lesquelles on force un nouveau défi du jour (bypass du cache date)
// Utilisé quand un joueur du jour avait des données manquantes ou bugguées
const DAILY_RESETS = {
  "2026-04-21": "v2", // Nathan Aké incomplet → nouveau joueur
};

// Overrides explicites : force un joueur spécifique pour une date donnée
// Utilisé quand on veut un joueur précis (correction, thème spécial, etc.)
// Le nom doit matcher exactement le name dans PLAYERS_CLEAN
const DAILY_OVERRIDES = {
  "2026-04-23": "Kalidou Koulibaly", // Jeudi Serie A - override forcé
  "2026-04-25": "Ronaldinho", // Samedi Légende - le sorcier brésilien
  "2026-04-26": "Miralem Pjanić", // Dimanche Joker - le maestro bosnien
  "2026-04-28": "James Milner", // Mardi PL - la légende anglaise (6 clubs PL)
  "2026-04-29": "Ademola Lookman", // Mercredi LIGA - parcours riche 7 clubs
};

function getDailyPlayer(blacklist) {
  const today = (()=>{ const d=new Date(); const paris=new Date(d.toLocaleString('en-US',{timeZone:'Europe/Paris'})); return paris.getFullYear()+'-'+String(paris.getMonth()+1).padStart(2,'0')+'-'+String(paris.getDate()).padStart(2,'0'); })();
  
  // Override explicite : cherche le joueur par nom dans PLAYERS_CLEAN
  if (DAILY_OVERRIDES[today]) {
    const overrideName = DAILY_OVERRIDES[today];
    // Normalise pour tolérer les différences d'accents entre l'override et la BDD
    const normTarget = overrideName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
    const overridePlayer = PLAYERS_CLEAN.find(p => p.name === overrideName)
      || PLAYERS_CLEAN.find(p => p.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim() === normTarget);
    if (overridePlayer) return overridePlayer;
    // Fallback silencieux si le joueur n'est pas trouvé (safety net)
  }
  
  // Permet de forcer un nouveau défi pour une date donnée en concaténant un suffixe au hash
  const hashKey = today + (DAILY_RESETS[today] || "");
  let hash = 0;
  for (let i = 0; i < hashKey.length; i++) {
    hash = ((hash << 5) - hash) + hashKey.charCodeAt(i);
    hash |= 0;
  }
  hash = Math.abs(hash);

  // Filtrer selon le thème du jour
  const theme = getTodayTheme();
  // Base pool : joueurs avec au moins 2 clubs ET difficulté accessible (pas expert)
  // On exclut les joueurs "expert" (trop obscurs) pour ne pas frustrer les users
  // sur un défi du jour qu'ils doivent résoudre en quelques essais
  const basePool = PLAYERS_CLEAN.filter(function(p){ 
    return p.clubs && p.clubs.length >= 2 && p.diff !== "expert"; 
  });
  let pool = basePool;

  if (theme.filter === "LEGEND") {
    // Pour le thème Légende : seulement les vraies stars (diff facile) + retraités
    // Évite de sortir des joueurs trop obscurs comme Alex Meier
    pool = basePool.filter(p => isRetiredPlayer(p.name) && p.diff === "facile");
  } else if (theme.filter === "JOKER") {
    pool = basePool;
  } else {
    const leagueClubs = new Set(LEAGUE_CLUBS[theme.filter] || []);
    // Filtrer sur le DERNIER club du parcours (= club actuel) uniquement
    // Évite que Ferland Mendy sorte le lundi L1 alors qu'il joue au Real Madrid
    pool = basePool.filter(p => leagueClubs.has(p.clubs[p.clubs.length - 1]));
  }

  // Appliquer la blacklist (joueurs signalés comme buggés par ≥3 users)
  if (blacklist && blacklist.size > 0) {
    pool = pool.filter(p => !blacklist.has(p.name));
  }

  // Fallback si la ligue est trop petite (après exclusion expert)
  if (pool.length < 10) pool = basePool.filter(p => !(blacklist && blacklist.has(p.name)));

  if (pool.length === 0) return null;
  return pool[hash % pool.length];
}

const CLUB_INDEX = {};
for (const p of PLAYERS_CLEAN) {
  if(!p||!p.clubs)continue;
  for (const c of p.clubs) {
    if (!CLUB_INDEX[c]) CLUB_INDEX[c] = [];
    if (!CLUB_INDEX[c].includes(p.name)) CLUB_INDEX[c].push(p.name);
  }
}


// ── FOOTBALL SVG ICONS ──
const Icon = {
  ball: (size=20, color="#fff") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.5" fill="none"/>
      <polygon points="12,2 14.5,7 19.5,7 15.5,10.5 17,15.5 12,12.5 7,15.5 8.5,10.5 4.5,7 9.5,7" stroke={color} strokeWidth="1.2" fill="none"/>
    </svg>
  ),
  boot: (size=20, color="#fff") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 17h5l2-6h4l3 4h4v2H3v-2z" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M10 11V6a2 2 0 0 1 2-2h2" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  whistle: (size=20, color="#fff") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="12" r="4" stroke={color} strokeWidth="1.5"/>
      <path d="M13 12h7M18 9l2-2M18 15l2 2" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M7 8l-2-2" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  trophy: (size=20, color="#fbbf24") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M8 21h8M12 17v4M7 3H5a2 2 0 0 0-2 2v2a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4V5a2 2 0 0 0-2-2h-2" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M7 3h10v8a5 5 0 0 1-10 0V3z" stroke={color} strokeWidth="1.5"/>
    </svg>
  ),
  stadium: (size=20, color="#fff") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <ellipse cx="12" cy="10" rx="9" ry="5" stroke={color} strokeWidth="1.5"/>
      <path d="M3 10v4c0 2.76 4.03 5 9 5s9-2.24 9-5v-4" stroke={color} strokeWidth="1.5"/>
      <ellipse cx="12" cy="10" rx="4" ry="2" stroke={color} strokeWidth="1.2"/>
    </svg>
  ),
  transfer: (size=20, color="#fff") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14M15 8l4 4-4 4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 8l-4 4 4 4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity=".4"/>
    </svg>
  ),
  chain: (size=20, color="#fff") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
  flag: (size=20, color="#fff") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 21V4" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M4 4l16 4-16 4" stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill={color} fillOpacity=".2"/>
    </svg>
  ),
  pitch: (size=20, color="#fff") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="4" width="20" height="16" rx="1" stroke={color} strokeWidth="1.5"/>
      <line x1="12" y1="4" x2="12" y2="20" stroke={color} strokeWidth="1.2"/>
      <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.2"/>
      <rect x="2" y="8" width="4" height="8" stroke={color} strokeWidth="1.2"/>
      <rect x="18" y="8" width="4" height="8" stroke={color} strokeWidth="1.2"/>
    </svg>
  ),
};

// Animated ball that bounces on home screen
function BouncingBall() {
  return (
    <div style={{position:"absolute",pointerEvents:"none",zIndex:0}}>
      {[
        {top:"15%",left:"8%",size:18,delay:0,dur:3.2,opacity:.12},
        {top:"60%",left:"85%",size:24,delay:.8,dur:2.8,opacity:.08},
        {top:"35%",left:"92%",size:14,delay:1.4,dur:3.6,opacity:.1},
        {top:"80%",left:"12%",size:20,delay:.3,dur:2.5,opacity:.09},
        {top:"25%",left:"50%",size:10,delay:2,dur:4,opacity:.06},
      ].map((b,i)=>(
        <div key={i} style={{position:"fixed",top:b.top,left:b.left,opacity:b.opacity,
          animation:`floatBall ${b.dur}s ease-in-out ${b.delay}s infinite alternate`}}>
          {Icon.ball(b.size,"#fff")}
        </div>
      ))}
    </div>
  );
}


// ── PLAYER AVATAR ──
function PlayerAvatar({ name, size = 56 }) {
  const parts = name.trim().split(" ");
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();

  // Lookup tolérant aux différences d'accents (ex: "Luis Suarez" vs "Luis Suárez")
  let playerEntry = PLAYERS_CLEAN.find(p => p.name === name);
  if (!playerEntry) {
    const normName = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
    playerEntry = PLAYERS_CLEAN.find(p => p.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim() === normName);
  }
  const mainClub = (playerEntry&&playerEntry.clubs&&playerEntry.clubs[0]) || "";
  const [ca, cb] = getClubColors(mainClub);
  const tc = textColor(ca);
  const fontSize = size * 0.36;
  const borderW = size * 0.06;
  // Pre-compute IDs to avoid regex in JSX
  const cleanId = name.split("").filter(ch => /[a-zA-Z]/.test(ch)).join("").slice(0, 12);
  const gradId = "avg" + cleanId + size;
  const clipId = "clp" + cleanId + size;

  return (
    <svg width={size} height={size} viewBox={"0 0 " + size + " " + size} style={{flexShrink:0,filter:"drop-shadow(0 3px 8px rgba(0,0,0,.25))"}}>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={ca}/>
          <stop offset="100%" stopColor={cb}/>
        </linearGradient>
        <clipPath id={clipId}>
          <circle cx={size/2} cy={size/2} r={size/2 - borderW}/>
        </clipPath>
      </defs>
      <circle cx={size/2} cy={size/2} r={size/2} fill={ca} opacity={.3}/>
      <circle cx={size/2} cy={size/2} r={size/2 - borderW} fill={"url(#" + gradId + ")"}/>
      <ellipse cx={size/2} cy={size*0.32} rx={size*0.28} ry={size*0.14}
        fill="rgba(255,255,255,.2)" clipPath={"url(#" + clipId + ")"}/>
      <text x={size/2} y={size/2 + fontSize*0.36}
        textAnchor="middle" fontSize={fontSize} fontWeight="800"
        fontFamily="'Bebas Neue',cursive,sans-serif" letterSpacing="2"
        fill={tc === "#FFF" ? "#ffffff" : "#111111"}>
        {initials}
      </text>
    </svg>
  );
}

// Mini avatar (for history list)
function PlayerAvatarMini({ name, size = 28 }) {
  return <PlayerAvatar name={name} size={size}/>;
}


// ── PLAYER PHOTOS (TheSportsDB) ──
const PLAYER_PHOTO_CACHE = {};

async function fetchPlayerPhoto(playerName) {
  if (PLAYER_PHOTO_CACHE[playerName] !== undefined) return PLAYER_PHOTO_CACHE[playerName];
  try {
    // Step 1: search Wikipedia for the player
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(playerName + " footballer")}&format=json&origin=*&srlimit=1`
    );
    const searchData = await searchRes.json();
    const pageTitle = searchData&&searchData.query&&searchData.query.search&&searchData.query.search[0]&&searchData.query.search[0].title;
    if (!pageTitle) { PLAYER_PHOTO_CACHE[playerName] = null; return null; }

    // Step 2: get the page thumbnail
    const imgRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=pageimages&format=json&origin=*&pithumbsize=200`
    );
    const imgData = await imgRes.json();
    const pages = imgData?.query?.pages;
    const page = pages ? Object.values(pages)[0] : null;
    const photo = page?.thumbnail?.source || null;
    PLAYER_PHOTO_CACHE[playerName] = photo;
    return photo;
  } catch {
    PLAYER_PHOTO_CACHE[playerName] = null;
    return null;
  }
}

function PlayerPhoto({ name, size = 48, fallbackColors }) {
  const [photo, setPhoto] = React.useState(PLAYER_PHOTO_CACHE[name] || null);
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    if (PLAYER_PHOTO_CACHE[name] !== undefined) {
      setPhoto(PLAYER_PHOTO_CACHE[name]);
      return;
    }
    fetchPlayerPhoto(name).then(url => setPhoto(url));
  }, [name]);

  const initials = name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  const [ca, cb] = fallbackColors || ["#2d6a4f","#1b4332"];

  // Always show avatar, overlay photo when loaded
  return (
    <div style={{width:size,height:size,borderRadius:"50%",position:"relative",overflow:"hidden",flexShrink:0}}>
      {/* Fallback avatar always present */}
      <div style={{position:"absolute",inset:0,background:`linear-gradient(135deg,${ca},${cb})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.36,fontWeight:800,color:"#fff",fontFamily:"system-ui"}}>
        {initials}
      </div>
      {/* Real photo on top if available */}
      {photo && !error && (
        <img src={photo} alt={name}
          onLoad={()=>setLoaded(true)}
          onError={()=>setError(true)}
          style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"contain",objectPosition:"top",opacity:loaded?1:0,transition:"opacity .3s"}}/>
      )}
    </div>
  );
}


// ── HELPERS ──
function shuffle(arr) {
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}
// Seeded shuffle for multiplayer (same questions for everyone in a room)
function seededRandom(seed) {
  let s = seed >>> 0;
  return function() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStringToSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function seededShuffle(arr, seed) {
  const rand = seededRandom(seed);
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// Translitt\u00e8re les lettres latines sp\u00e9ciales que NFD ne d\u00e9compose pas (\u00f8, \u00e6, \u00df\u2026)
// AVANT de retirer les caract\u00e8res non ASCII, sinon elles sont supprim\u00e9es et le
// nom devient intapable (ex: "H\u00f8jbjerg" -> "hjbjerg" au lieu de "hojbjerg").
function norm(s){return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\u00f8/g,"o").replace(/\u00e6/g,"ae").replace(/\u0153/g,"oe").replace(/\u00df/g,"ss").replace(/\u0142/g,"l").replace(/[\u0111\u00f0]/g,"d").replace(/\u00fe/g,"th").replace(/\u0131/g,"i").replace(/[^a-z0-9 ]/g,"").trim();}
// Version sans espaces pour matcher des clubs composés tapés de différentes façons
// Exemple : "Saint-Etienne", "Saint Etienne", "SaintEtienne" doivent tous matcher
function normCompact(s){return norm(s).replace(/\s+/g,"");}

// Normalisation phonétique pour gérer fautes type "Patchao" → "Paixao"
// Convertit certains digrammes en équivalents phonétiques avant comparaison Levenshtein
function normPhonetic(s){
  let n = normCompact(s);
  // Digrammes courants : tch=ch=x (sons portugais/espagnols), ph=f, ck=k, qu=k, sh=ch
  n = n.replace(/tch/g, "x").replace(/ch/g, "x").replace(/sh/g, "x");
  n = n.replace(/ph/g, "f").replace(/ck/g, "k").replace(/qu/g, "k");
  n = n.replace(/y/g, "i").replace(/z/g, "s").replace(/w/g, "v");
  // Doubles lettres → simple lettre (pour matcher "Nassr" et "Naser")
  n = n.replace(/(.)\1+/g, "$1");
  return n;
}

// Distance de Levenshtein (nombre min d'éditions pour passer de a à b)
function levenshtein(a, b){
  if (a === b) return 0;
  if (a.length < b.length) { const t = a; a = b; b = t; }
  if (b.length === 0) return a.length;
  let prev = [];
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++){
    let curr = [i];
    for (let j = 1; j <= b.length; j++){
      const cost = a[i-1] === b[j-1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j-1] + 1, prev[j-1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

// Tolérance progressive selon la longueur du mot cible
function fuzzyThreshold(targetLen){
  if (targetLen < 6) return 1;       // mots courts : 1 faute max
  if (targetLen < 12) return 2;      // moyens : 2 fautes
  return 3;                          // longs : 3 fautes
}

// Vérifie si guess matche target avec tolérance aux fautes (Levenshtein + phonétique)
function fuzzyMatch(guess, target){
  const g1 = normCompact(guess), t1 = normCompact(target);
  // Match exact post-normalisation classique : pas besoin de fuzzy
  if (g1 === t1) return true;
  // Levenshtein sur la version normCompact
  const d1 = levenshtein(g1, t1);
  if (d1 <= fuzzyThreshold(t1.length)) return true;
  // Levenshtein sur la version phonétique (gère "Patchao" → "Paixao")
  const g2 = normPhonetic(guess), t2 = normPhonetic(target);
  if (g2 === t2) return true;
  const d2 = levenshtein(g2, t2);
  if (d2 <= fuzzyThreshold(t2.length)) return true;
  return false;
}
// Génère un code de récupération format GOATFC-XXXX-YYYY
// Utilise uniquement des caractères non ambigus (pas 0/O, 1/I/L, etc.)
function generateRecoveryCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "GOATFC-";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  code += "-";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}
function checkGuess(g,players){
  const gn=norm(g);
  return players.some(p=>{
    const pn=norm(p);
    if(gn===pn) return true;
    // Match si guess correspond à une partie du nom (ex: "Pogba" pour "Paul Pogba")
    if(pn.split(" ").some(part=>part.length>2&&gn.includes(part))) return true;
    // Fallback fuzzy : tolère 1-3 fautes selon longueur (ex: "Mhuamed Salah" → "Mohamed Salah")
    if(g.length>=4 && fuzzyMatch(g, p)) return true;
    // Fuzzy par mot du nom : tolère une faute sur le seul nom de famille tapé
    // (ex: "Hojberg" → "Højbjerg", "Bentancour" → "Bentancur")
    if(g.length>=4 && pn.split(" ").some(part=>part.length>=4 && fuzzyMatch(g, part))) return true;
    return false;
  });
}
// Ensemble des identifiants de clubs « connus » (en normCompact) : clubs de la
// base, noms canoniques et alias. Sert à distinguer « club connu mais pas celui
// du joueur » d'une simple faute de frappe.
const KNOWN_CLUB_KEYS = (function(){
  const s = new Set();
  for(const c in CLUB_INDEX){ s.add(normCompact(c)); }
  for(const canonical in CLUB_ALIASES){
    s.add(normCompact(canonical));
    for(const a of CLUB_ALIASES[canonical]) s.add(normCompact(a));
  }
  return s;
})();

function matchClub(input,playerClubs){
  const n=norm(input);
  const nc=normCompact(input);
  // 1. Exact match (avec ou sans espaces/tirets)
  for(const c of playerClubs){if(norm(c)===n||normCompact(c)===nc)return c;}
  // 2. User tape un alias d'un club canonique présent dans playerClubs
  for(const c of playerClubs){const aliases=CLUB_ALIASES[c];if(aliases&&aliases.some(a=>norm(a)===n||normCompact(a)===nc))return c;}
  // 3. Bidirectionnel : user tape un nom canonique OU un alias,
  //    et playerClubs contient un alias OU le nom canonique correspondant
  for(const canonical in CLUB_ALIASES){
    const aliases=CLUB_ALIASES[canonical];
    const inputMatchesThisGroup=norm(canonical)===n||normCompact(canonical)===nc||aliases.some(a=>norm(a)===n||normCompact(a)===nc);
    if(!inputMatchesThisGroup)continue;
    for(const c of playerClubs){
      if(norm(c)===norm(canonical))return c;
      if(aliases.some(a=>norm(a)===norm(c)))return c;
    }
  }
  // 3bis. Si l'input EST un club connu précis (nom canonique, club de la base ou
  //   alias exact) mais qu'aucun club du joueur n'a matché aux étapes exactes
  //   ci-dessus, alors ce n'est tout simplement pas un club de ce joueur. On
  //   n'autorise PAS le matching approximatif : sinon un club distinct partageant
  //   un mot produirait un faux positif — ex. « Atletico Madrid » qui matchait
  //   l'alias « madrid » de « Real Madrid » via un substring.
  if(KNOWN_CLUB_KEYS.has(nc)) return null;
  if(n.length>=3){
    // 4. Substring match sur le club du joueur (version compacte pour tolérer tirets/espaces)
    for(const c of playerClubs){if(normCompact(c).includes(nc)||nc.includes(normCompact(c)))return c;}
    // 5. Substring match sur les alias du club du joueur
    for(const c of playerClubs){const aliases=CLUB_ALIASES[c];if(aliases&&aliases.some(a=>normCompact(a).includes(nc)||nc.includes(normCompact(a))))return c;}
    // 6. Fallback fuzzy (Levenshtein + phonétique) pour tolérer fautes type "Alnasser" → "Al Nassr"
    //    On ne tolère que pour mots de >=4 lettres, sinon trop de faux positifs
    if(n.length>=4){
      for(const c of playerClubs){if(fuzzyMatch(input, c))return c;}
      for(const c of playerClubs){const aliases=CLUB_ALIASES[c];if(aliases&&aliases.some(a=>fuzzyMatch(input, a)))return c;}
    }
  }
  return null;
}
// Index nom → joueur : la sélection de la chaîne interroge des dizaines de noms
// par coup, et un find() linéaire sur ~4800 entrées à chaque fois coûtait cher.
const PLAYER_BY_NAME = new Map(PLAYERS_CLEAN.map(function(p){ return [p.name, p]; }));
function getPlayerClubs(name){const p=PLAYER_BY_NAME.get(name);return p?p.clubs:[];}

// Vivier « facile » d'une liste de joueurs d'un même club, élargi si trop mince.
//
// Seuls 145 joueurs sur ~4800 portent diff:"facile", et 25 des 62 clubs connus
// en comptent 3 ou moins (Lyon : Benzema, Depay, Lloris ; RB Leipzig et
// Eintracht Frankfurt : aucun). Une fois le joueur courant retiré du vivier, il
// n'en restait souvent qu'un ou deux : d'où « je réponds Lyon sur Lloris et
// c'est toujours Benzema ». On complète donc avec les joueurs "moyen" qui ont au
// moins deux clubs connus — tout aussi reconnaissables. Lyon passe de 3 à 60
// candidats.
const CHAIN_EASY_MIN = 6;
function easyChainPool(names) {
  const easy = [], known = [];
  for (const n of names) {
    const p = PLAYER_BY_NAME.get(n);
    if (!p) continue;
    if (p.diff === "facile") easy.push(n);
    else if (p.diff === "moyen" && famousClubCount(p) >= 2) known.push(n);
  }
  return easy.length >= CHAIN_EASY_MIN ? easy : easy.concat(known);
}
function getPlayersForClub(club){return CLUB_INDEX[club]||[];}

// ─── GOAT DUEL — Plug temps réel 1v1 (5 manches) ──────────────
// 20 tops clubs européens curés : ~toutes les paires ont un joueur commun
// dans la base (1 seule paire sur 190 sans lien → manche annulée/rejouée).
const DUEL_CLUBS = [
  "Real Madrid","Barcelona","Atletico Madrid","Sevilla","Valencia",
  "Manchester United","Manchester City","Liverpool","Chelsea","Arsenal","Tottenham",
  "Bayern Munich","Borussia Dortmund",
  "Juventus FC","Inter Milan","AC Milan","SSC Napoli","AS Roma",
  "PSG","Marseille",
];
// Joueurs ayant joué dans les DEUX clubs = réponses valides d'une manche
function duelCommonPlayers(c1, c2){
  if(!c1 || !c2) return [];
  if(c1 === c2) return getPlayersForClub(c1); // même club : n'importe quel joueur du club
  const b = new Set(getPlayersForClub(c2));
  return getPlayersForClub(c1).filter(n => b.has(n));
}
const DUEL_ROUNDS = 5;
const DUEL_ANSWER_SECS = 10; // trouver le joueur (multi : limite par manche)
const DUEL_RESULT_SECS = 1.8; // écran résultat de manche (court)
const DUEL_SPIN_MS = 2200;   // durée du tirage "machine à sous" (clubs aléatoires)
const DUEL_SOLO_SECS = 90;   // SOLO : temps TOTAL de la partie (manches illimitées)
const DUEL_SOLO_SPIN_MS = 1000; // SOLO : tirage plus court (le temps total est limité)
// Tire une paire de clubs aléatoire GARANTIE jouable (>=1 joueur commun)
function duelRollPair(){
  for(let i=0;i<80;i++){
    const c1 = DUEL_CLUBS[Math.floor(Math.random()*DUEL_CLUBS.length)];
    const c2 = DUEL_CLUBS[Math.floor(Math.random()*DUEL_CLUBS.length)];
    if(c1===c2) continue;
    if(duelCommonPlayers(c1, c2).length > 0) return [c1, c2];
  }
  return ["Real Madrid", "Barcelona"]; // repli (ont des joueurs communs)
}

// CRESCENDO HELPER : retourne la difficulté "effective" en mode crescendo selon le nombre de liens accomplis
// 0-2 liens = facile, 3-6 liens = moyen, 7+ = expert
function getCrescendoTier(chainCount) {
  if (chainCount < 3) return "facile";
  if (chainCount < 7) return "moyen";
  return "expert";
}

// ══════════════════════════════════════════════════════════════
// 🐐 GOAT GRID — Mode quotidien grille 3x3
// ══════════════════════════════════════════════════════════════
// Inspiré de métrodoku : grille 3x3, 6 critères croisés, 3 vies, 1 grille/jour
// Scoring basé sur la rareté du joueur (nombre de candidats matching)

// ─── Pools de critères ───────────────────────────────────────
// Noms de clubs alignés sur PLAYERS_CLEAN (extraits de la vraie base)
// Filtrés : seulement les clubs avec ≥8 joueurs "facile" (sinon génération de grille trop dure)
const GG_CLUB_POOL = [
  "Real Madrid","Barcelona","Atletico Madrid",
  "Manchester United","Manchester City","Liverpool","Chelsea","Arsenal","Tottenham",
  "Bayern Munich",
  "Juventus FC","Inter Milan","AC Milan",
  "PSG","Marseille",
];

const GG_NATIONALITY_POOL = [
  "Brésil","Argentine","France","Allemagne","Espagne","Italie","Portugal","Angleterre",
  "Belgique","Pays-Bas","Croatie","Pologne","Maroc","Sénégal","Algérie","Côte d'Ivoire",
  "Cameroun","Nigeria","Uruguay","Colombie","Chili","Mexique","États-Unis","Japon",
];

const GG_POSITION_POOL = ["gardien","defenseur","milieu","attaquant"];

// Mapping : nom du club → ligue (pour critères "A joué en ...")
const GG_LIGUE_MAP = {
  "ligue1": ["PSG","Marseille","Lyon","Monaco","Lille","Rennes","Nice","Lens","Nantes","Strasbourg","Saint-Étienne","Bordeaux","Toulouse","Montpellier","Reims","Brest","Le Havre","Auxerre","Angers","Clermont","Metz","Lorient","Troyes","Ajaccio"],
  "premier_league": ["Manchester United","Manchester City","Liverpool","Chelsea","Arsenal","Tottenham","Newcastle","Aston Villa","West Ham","Brighton","Crystal Palace","Brentford","Fulham","Wolverhampton","Everton","Leeds United","Leicester City","Southampton","Bournemouth","Nottingham Forest"],
  "liga": ["Real Madrid","Barcelona","Atletico Madrid","Sevilla","Valencia","Real Sociedad","Athletic Bilbao","Villarreal","Real Betis","Celta Vigo","Espanyol","Getafe","Osasuna","Mallorca","Cádiz","Almería","Girona","Las Palmas","Granada"],
  "serie_a": ["Juventus FC","Inter Milan","AC Milan","AS Roma","SSC Napoli","Atalanta BC","SS Lazio","ACF Fiorentina","Torino FC","Bologna FC","Sassuolo","Udinese Calcio","Empoli FC","Genoa CFC","Cagliari Calcio","Hellas Verona","Lecce","Salernitana","Frosinone","Monza"],
  "bundesliga": ["Bayern Munich","Borussia Dortmund","RB Leipzig","Bayer Leverkusen","Eintracht Frankfurt","Wolfsburg","Werder Bremen","Hoffenheim","Borussia Mönchengladbach","Köln","Union Berlin","Stuttgart","Mainz","Augsburg","Hertha Berlin","Schalke","Hamburg"],
};

// ─── Trophées : gagnants des grandes compétitions ─────────────
// Liste des joueurs qui ont gagné AU MOINS UNE FOIS la compétition
// (titulaires + remplaçants impliqués sur le tournoi)
// Les noms doivent matcher exactement ceux de PLAYERS_CLEAN

// ─── Anciens joueurs devenus entraîneurs ──────────────────────
// Critère "Devenu entraîneur ?" : joueurs de la base qui ont ensuite
// eu une carrière d'entraîneur (principal ou reconnu). Les noms DOIVENT
// matcher exactement ceux de PLAYERS_CLEAN.
const GG_COACHES = new Set([
  "Zinédine Zidane","Pep Guardiola","Didier Deschamps","Vincent Kompany","Frank Lampard",
  "Steven Gerrard","Wayne Rooney","Andrea Pirlo","Filippo Inzaghi","Gennaro Gattuso",
  "Clarence Seedorf","Thierry Henry","Carlo Ancelotti","Mikel Arteta","Ole Gunnar Solskjaer",
  "Ruud van Nistelrooy","Michael Carrick","Gianfranco Zola","Ronald Koeman","Jürgen Klinsmann",
  "Fabio Cannavaro","Ryan Giggs","John Terry","Ruud Gullit","Gianluca Vialli","Edgar Davids",
  "Xavi","Luis Enrique","Laurent Blanc","Frank de Boer","Sol Campbell","Tony Adams","Roy Keane",
  "Xabi Alonso","Patrick Vieira","Diego Simeone","Roberto Mancini","Phillip Cocu","Fernando Hierro",
  "Freddie Ljungberg","Gary Neville","Paul Scholes","Nicky Butt","Andriy Shevchenko",
  "Alessandro Nesta","Marco van Basten","Michael Laudrup","Hristo Stoichkov",
]);

// ─── Scoring : pts selon DIFFICULTÉ DU JOUEUR CITÉ + bonus rareté combo ──
// Option 3 : pondéré par difficulté du joueur cité
function ggCalculatePointsForPlayer(playerDiff, totalCandidates) {
  let basePoints = 15; // facile par défaut
  if (playerDiff === "moyen")  basePoints = 50;
  if (playerDiff === "expert") basePoints = 50; // même valeur que moyen (système simplifié)
  
  // Bonus si très peu de candidats matchent les 2 critères (rare combo)
  let bonus = 0;
  if (totalCandidates <= 3) bonus = 20;       // très rare combo
  else if (totalCandidates <= 5) bonus = 10;  // rare combo
  
  return basePoints + bonus;
}

// Rareté visuelle (couleur de la case) selon les pts attribués
function ggGetRarityClass(pts) {
  if (pts >= 80)  return "legendary"; // expert + bonus combo
  if (pts >= 60)  return "epic";       // expert seul ou moyen + gros bonus
  if (pts >= 40)  return "rare";       // moyen + bonus
  if (pts >= 25)  return "common";     // moyen ou facile + bonus
  return "trivial";                     // facile basique
}

// (Conservé pour compat : pts d'une case en mode "difficulté inconnue")
function ggCalculatePoints(numCandidates) {
  if (numCandidates <= 3)  return 100;
  if (numCandidates <= 5)  return 60;
  if (numCandidates <= 10) return 40;
  if (numCandidates <= 20) return 25;
  return 15;
}

// ─── Helper : un joueur matche-t-il un critère ? ──────────────
function ggPlayerMatchesCriterion(player, criterion) {
  if (!player || !criterion) return false;
  
  if (criterion.type === "club") {
    return Array.isArray(player.clubs) && player.clubs.includes(criterion.value);
  }
  
  if (criterion.type === "nationality") {
    // Champs ajoutés par les meta Wikidata (peut être absent → false)
    const nats = player.nationalities || [];
    return nats.includes(criterion.value);
  }
  
  if (criterion.type === "position") {
    // 4 catégories : gardien/defenseur/milieu/attaquant
    const positions = player.positions || [];
    return positions.includes(criterion.value);
  }
  
  if (criterion.type === "league") {
    // criterion.value = "ligue1" | "premier_league" | etc.
    const leagueClubs = GG_LIGUE_MAP[criterion.value] || [];
    return Array.isArray(player.clubs) && player.clubs.some(c => leagueClubs.includes(c));
  }
  
  if (criterion.type === "trophy") {
    // criterion.value = "world_cup" | "champions_league"
    if (criterion.value === "world_cup") return GG_WC_WINNERS.has(player.name);
    if (criterion.value === "champions_league") return GG_CL_WINNERS.has(player.name);
    return false;
  }

  if (criterion.type === "coach") {
    // "Devenu entraîneur ?" : le joueur a ensuite entraîné
    return GG_COACHES.has(player.name);
  }

  return false;
}

// ─── Helper : trouver tous les joueurs matchant 2 critères ────
function ggFindMatchingPlayers(crit1, crit2) {
  return PLAYERS_CLEAN.filter(p => 
    ggPlayerMatchesCriterion(p, crit1) && ggPlayerMatchesCriterion(p, crit2)
  );
}

// ─── Helper : compter combien de "faciles" dans une liste ─────
function ggCountEasy(players) {
  return players.filter(p => p.diff === "facile").length;
}

// ─── Seed du jour ────────────────────────────────────────────
function ggGetDailySeed() {
  // Override via URL : ?gg_seed=N pour tester d'autres grilles
  try {
    const params = new URLSearchParams(window.location.search);
    const override = params.get("gg_seed");
    if (override) {
      return hashStringToSeed("override-" + override);
    }
  } catch {}
  
  const now = new Date();
  const dateStr = now.getUTCFullYear() + "-" +
                  String(now.getUTCMonth() + 1).padStart(2, "0") + "-" +
                  String(now.getUTCDate()).padStart(2, "0");
  return hashStringToSeed(dateStr); // utilise la fn existante du fichier
}

// Date du jour en format YYYY-MM-DD (pour la sauvegarde leaderboard)
function ggGetTodayDateStr() {
  const now = new Date();
  return now.getUTCFullYear() + "-" +
         String(now.getUTCMonth() + 1).padStart(2, "0") + "-" +
         String(now.getUTCDate()).padStart(2, "0");
}

// Jour 1 de GOAT GRID = 1er mai 2026 (grille #1)
const GG_DAY_ONE = "2026-05-01";

// Renvoie le numéro de la grille pour une date donnée (YYYY-MM-DD)
// Grille #1 = 2026-05-01, #2 = 2026-05-02, etc.
function ggGetGridNumber(dateStr) {
  if (!dateStr) dateStr = ggGetTodayDateStr();
  const d1 = new Date(GG_DAY_ONE + "T00:00:00Z");
  const d2 = new Date(dateStr + "T00:00:00Z");
  const diffDays = Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
}

// Renvoie la date YYYY-MM-DD pour un numéro de grille donné
function ggGridNumberToDate(num) {
  const d1 = new Date(GG_DAY_ONE + "T00:00:00Z");
  d1.setUTCDate(d1.getUTCDate() + (num - 1));
  return d1.getUTCFullYear() + "-" +
         String(d1.getUTCMonth() + 1).padStart(2, "0") + "-" +
         String(d1.getUTCDate()).padStart(2, "0");
}

// Vérifie si le mode test est actif (URL ?test=1 ou ?gg_test=1)
function ggIsTestMode() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("test") === "1" || params.get("gg_test") === "1";
  } catch {
    return false;
  }
}

// Construit le pattern emoji 3×3 (pour leaderboard et partage)
function ggBuildEmojiPattern(filledCells, grid) {
  if (!grid) return "";
  const lines = [];
  for (let i = 0; i < 3; i++) {
    let line = "";
    for (let j = 0; j < 3; j++) {
      const filled = filledCells[i+"-"+j];
      if (!filled) { line += "⬜"; continue; }
      const e = { legendary:"🟨", epic:"🟪", rare:"🟦", common:"🟩", trivial:"⬛" }[filled.rarity] || "🟩";
      line += e;
    }
    lines.push(line);
  }
  return lines.join("\n");
}

// ─── Algo principal : génération de grille ────────────────────
// Retourne null si on ne trouve pas (très rare)
// ─── MODE DÉMO GOAT GRID (pour enregistrer une vidéo TikTok fluide) ───
// Grille FIXE (seed constant) + feuille de réponses affichée en jeu. Activé par
// ?demo=1 (désactivé ?demo=0), persistant via localStorage bb_gg_demo.
// Seed choisi car il produit une grille valide et accessible (vérifié).
const GG_DEMO_SEED = 424242;
function ggIsDemo() {
  try {
    const q = new URLSearchParams(window.location.search).get("demo");
    if (q === "1") { localStorage.setItem("bb_gg_demo", "1"); return true; }
    if (q === "0") { localStorage.removeItem("bb_gg_demo"); return false; }
    return localStorage.getItem("bb_gg_demo") === "1";
  } catch (e) { return false; }
}

function ggGenerateGrid(seed) {
  const MAX_ATTEMPTS = 500;
  
  // Mélange tableau avec un seed donné (pour diversification)
  function shuffleArrWithSeed(arr, attemptSeed) {
    return seededShuffle([...arr], attemptSeed);
  }
  
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Variation du seed à chaque tentative pour diversifier
    const attemptSeed = seed + attempt * 31; // multiplicateur premier pour bonne dispersion
    
    // 1. Tirer 3 critères de ligne (clubs uniquement)
    const rowCriteria = shuffleArrWithSeed(GG_CLUB_POOL, attemptSeed).slice(0, 3).map(c => ({
      type: "club",
      value: c,
      label: c,
    }));
    
    // 2. Tirer 3 critères de colonne (mix natio/poste/ligue, mais variés)
    // On pioche 3 types parmi ces choix possibles
    // RÈGLE : on exclut les ligues qui contiennent l'un des clubs choisis en ligne
    // (sinon "Juventus × A joué en Serie A" est trivial : tous les joueurs Juve matchent)
    const excludedLeagues = new Set();
    Object.keys(GG_LIGUE_MAP).forEach(l => {
      if (rowCriteria.some(rc => GG_LIGUE_MAP[l].includes(rc.value))) {
        excludedLeagues.add(l);
      }
    });
    
    const colCandidates = [];
    GG_NATIONALITY_POOL.forEach(n => colCandidates.push({ type: "nationality", value: n, label: n }));
    GG_POSITION_POOL.forEach(p => colCandidates.push({ type: "position", value: p, label: p }));
    Object.keys(GG_LIGUE_MAP).forEach(l => {
      if (excludedLeagues.has(l)) return; // skip les ligues qui rendraient les cases triviales
      const labels = { ligue1: "A joué en L1", premier_league: "A joué en PL", liga: "A joué en Liga", serie_a: "A joué en Serie A", bundesliga: "A joué en Bundesliga" };
      colCandidates.push({ type: "league", value: l, label: labels[l] });
    });
    // Critères-trophées
    colCandidates.push({ type: "trophy", value: "world_cup", label: "Vainqueur CDM" });
    colCandidates.push({ type: "trophy", value: "champions_league", label: "Vainqueur LDC" });
    // Critère "Devenu entraîneur ?" (anciens joueurs passés sur le banc)
    colCandidates.push({ type: "coach", value: "coach", label: "Devenu entraîneur" });
    const colCriteria = shuffleArrWithSeed(colCandidates, attemptSeed + 7).slice(0, 3);
    
    // 3. Calculer les candidats pour chaque case
    const cells = [];
    let valid = true;
    let cellsWithEasy = 0;
    
    for (let i = 0; i < 3 && valid; i++) {
      for (let j = 0; j < 3 && valid; j++) {
        const candidates = ggFindMatchingPlayers(rowCriteria[i], colCriteria[j]);
        const easyCount = ggCountEasy(candidates);
        
        // Règle 1 : ≥ 5 candidats par case
        if (candidates.length < 5) {
          valid = false;
          break;
        }
        
        if (easyCount >= 1) cellsWithEasy++;
        
        // Calculer le BEST score possible pour cette cellule (meilleur joueur dispo)
        // Priorité : expert > moyen > facile
        const hasExpert = candidates.some(p => p.diff === "expert");
        const hasMoyen = candidates.some(p => p.diff === "moyen");
        let bestDiff = "facile";
        if (hasExpert) bestDiff = "expert";
        else if (hasMoyen) bestDiff = "moyen";
        const maxPts = ggCalculatePointsForPlayer(bestDiff, candidates.length);
        
        cells.push({
          row: i,
          col: j,
          rowCriterion: rowCriteria[i],
          colCriterion: colCriteria[j],
          candidates: candidates.map(p => p.name), // juste les noms
          totalCount: candidates.length,
          easyCount,
          points: ggCalculatePoints(candidates.length),
          rarity: ggGetRarityClass(ggCalculatePoints(candidates.length)),
          maxPoints: maxPts, // 🎯 Max théorique pour cette case
        });
      }
    }
    
    if (!valid) continue;
    
    // Règle 2 : ≥ 5 cases sur 9 doivent avoir un facile (les 4 autres peuvent être hard)
    if (cellsWithEasy < 5) continue;
    
    // ✅ Grille valide !
    return {
      rowCriteria,
      colCriteria,
      cells,
      seed,
    };
  }
  
  // Si on n'a rien trouvé après MAX_ATTEMPTS, on retourne null
  console.warn("[GOAT GRID] Impossible de générer une grille équilibrée après " + MAX_ATTEMPTS + " tentatives");
  return null;
}

// ─── Couleurs des critères (mêmes que le mockup) ──────────────
function ggGetCriterionColors(criterion) {
  if (criterion.type === "club") {
    return getClubColors(criterion.value); // utilise la fonction existante du fichier
  }
  
  if (criterion.type === "nationality") {
    // Couleurs simples par drapeau (extensible)
    const flagColors = {
      "Brésil": ["#009C3B", "#FFDF00"],
      "Argentine": ["#74ACDF", "#FFFFFF"],
      "France": ["#0055A4", "#EF4135"],
      "Allemagne": ["#000000", "#DD0000"],
      "Espagne": ["#AA151B", "#F1BF00"],
      "Italie": ["#009246", "#CE2B37"],
      "Portugal": ["#046A38", "#DA291C"],
      "Angleterre": ["#FFFFFF", "#CE1124"],
      "Belgique": ["#000000", "#FAE042"],
      "Pays-Bas": ["#AE1C28", "#21468B"],
      "Croatie": ["#FF0000", "#FFFFFF"],
      "Pologne": ["#FFFFFF", "#DC143C"],
      "Maroc": ["#C1272D", "#006233"],
      "Sénégal": ["#00853F", "#FDEF42"],
      "Algérie": ["#006233", "#FFFFFF"],
      "Côte d'Ivoire": ["#FF8200", "#009E60"],
      "Cameroun": ["#007A5E", "#CE1126"],
      "Nigeria": ["#008751", "#FFFFFF"],
      "Uruguay": ["#7B95C7", "#FFFFFF"],
      "Colombie": ["#FCD116", "#003893"],
      "Chili": ["#FFFFFF", "#D52B1E"],
      "Mexique": ["#006847", "#CE1126"],
      "États-Unis": ["#3C3B6E", "#B22234"],
      "Japon": ["#FFFFFF", "#BC002D"],
    };
    return flagColors[criterion.value] || ["#1a7a3a", "#FFFFFF"];
  }
  
  if (criterion.type === "position") {
    // Couleur du poste (rouge agressif pour attaquant, etc.)
    const posColors = {
      "gardien":     ["#1E3A8A", "#F97316"], // bleu nuit / orange (gants)
      "defenseur":   ["#166534", "#444444"], // vert / gris
      "milieu":      ["#FFD600", "#1E40AF"], // jaune / bleu
      "attaquant":   ["#C8102E", "#1a1a1a"], // rouge / noir
    };
    return posColors[criterion.value] || ["#1a7a3a", "#FFFFFF"];
  }
  
  if (criterion.type === "league") {
    const ligueColors = {
      "ligue1":         ["#0055A4", "#EF4135"], // bleu / rouge France
      "premier_league": ["#3D195B", "#04F5FF"], // violet / turquoise PL
      "liga":           ["#AA151B", "#F1BF00"], // rouge / jaune Espagne
      "serie_a":        ["#009246", "#CE2B37"], // vert / rouge Italie
      "bundesliga":     ["#000000", "#DD0000"], // noir / rouge Allemagne
    };
    return ligueColors[criterion.value] || ["#1a7a3a", "#FFFFFF"];
  }
  
  if (criterion.type === "trophy") {
    // Couleurs trophées
    const trophyColors = {
      "world_cup":        ["#D4AF37", "#0055A4"], // or / bleu
      "champions_league": ["#1B1B3A", "#FFFFFF"], // bleu nuit / blanc
    };
    return trophyColors[criterion.value] || ["#FFD600", "#FFFFFF"];
  }

  if (criterion.type === "coach") {
    return ["#0F172A", "#38BDF8"]; // ardoise nuit / bleu tactique (tableau blanc)
  }

  return ["#1a7a3a", "#FFFFFF"];
}

// ─── Emoji du critère pour l'UI ──────────────────────────────
function ggGetCriterionEmoji(criterion) {
  if (criterion.type === "nationality") {
    const flags = {
      "Brésil":"🇧🇷","Argentine":"🇦🇷","France":"🇫🇷","Allemagne":"🇩🇪","Espagne":"🇪🇸","Italie":"🇮🇹",
      "Portugal":"🇵🇹","Angleterre":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","Belgique":"🇧🇪","Pays-Bas":"🇳🇱","Croatie":"🇭🇷","Pologne":"🇵🇱",
      "Maroc":"🇲🇦","Sénégal":"🇸🇳","Algérie":"🇩🇿","Côte d'Ivoire":"🇨🇮","Cameroun":"🇨🇲","Nigeria":"🇳🇬",
      "Uruguay":"🇺🇾","Colombie":"🇨🇴","Chili":"🇨🇱","Mexique":"🇲🇽","États-Unis":"🇺🇸","Japon":"🇯🇵",
    };
    return flags[criterion.value] || "🌍";
  }
  if (criterion.type === "position") {
    return { gardien: "🥅", defenseur: "🛡️", milieu: "⚙️", attaquant: "⚔️" }[criterion.value] || "⚽";
  }
  if (criterion.type === "league") {
    return "🏆";
  }
  if (criterion.type === "trophy") {
    if (criterion.value === "world_cup") return "🏆";
    if (criterion.value === "champions_league") return "⭐";
    return "🏆";
  }
  if (criterion.type === "coach") {
    return "🧑‍🏫";
  }
  return "";
}

// ─── Tooltip explication d'un critère ────────────────────────
function ggGetCriterionTooltip(criterion, lang) {
  const isEn = lang === "en";
  if (criterion.type === "club") {
    return isEn ? `The player played at ${criterion.value} (at least one professional season).` : `Le joueur a évolué au ${criterion.value} (au moins une saison professionnelle).`;
  }
  if (criterion.type === "nationality") {
    return isEn ? `The player has the sporting nationality of ${criterion.value}.` : `Le joueur a la nationalité sportive ${criterion.value}.`;
  }
  if (criterion.type === "position") {
    if (isEn) {
      const en = { gardien: "goalkeeper", defenseur: "defender", milieu: "midfielder", attaquant: "forward" };
      return `The player primarily plays as a ${en[criterion.value] || criterion.value}.`;
    }
    const labels = { gardien: "gardien de but", defenseur: "défenseur", milieu: "milieu de terrain", attaquant: "attaquant" };
    return `Le joueur évolue principalement au poste de ${labels[criterion.value] || criterion.value}.`;
  }
  if (criterion.type === "league") {
    if (isEn) {
      const en = { ligue1: "French Ligue 1", premier_league: "English Premier League", liga: "Spanish La Liga", serie_a: "Italian Serie A", bundesliga: "German Bundesliga" };
      return `The player has played in at least one club of the ${en[criterion.value] || criterion.value}.`;
    }
    const ligues = { ligue1: "Ligue 1 française", premier_league: "Premier League anglaise", liga: "Liga espagnole", serie_a: "Serie A italienne", bundesliga: "Bundesliga allemande" };
    return `Le joueur a évolué dans au moins un club de ${ligues[criterion.value] || criterion.value}.`;
  }
  if (criterion.type === "trophy") {
    if (criterion.value === "world_cup") return isEn ? "The player has won at least one World Cup with their national team." : "Le joueur a remporté au moins une Coupe du Monde avec sa sélection nationale.";
    if (criterion.value === "champions_league") return isEn ? "The player has won at least one UEFA Champions League with their club." : "Le joueur a remporté au moins une UEFA Champions League avec son club.";
    return isEn ? "The player has won this trophy." : "Le joueur a remporté ce trophée.";
  }
  if (criterion.type === "coach") {
    return isEn ? "This former player later became a manager/coach." : "Cet ancien joueur est ensuite devenu entraîneur.";
  }
  return "";
}

// Retourne le label affiché du critère selon la langue (FR/EN)
function ggGetCriterionDisplayLabel(criterion, lang) {
  if (lang === "en") {
    if (criterion.type === "position") {
      const en = { gardien: "GOALKEEPER", defenseur: "DEFENDER", milieu: "MIDFIELDER", attaquant: "FORWARD" };
      return en[criterion.value] || criterion.label;
    }
    if (criterion.type === "league") {
      const en = { ligue1: "Played in L1", premier_league: "Played in PL", liga: "Played in Liga", serie_a: "Played in Serie A", bundesliga: "Played in Bundesliga" };
      return en[criterion.value] || criterion.label;
    }
    if (criterion.type === "trophy") {
      if (criterion.value === "world_cup") return "WC Winner";
      if (criterion.value === "champions_league") return "UCL Winner";
    }
    if (criterion.type === "coach") {
      return "Became coach";
    }
    if (criterion.type === "nationality") {
      // Traduire les nationalités courantes
      const en = {
        "France":"France","Espagne":"Spain","Italie":"Italy","Allemagne":"Germany","Angleterre":"England",
        "Portugal":"Portugal","Pays-Bas":"Netherlands","Belgique":"Belgium","Croatie":"Croatia",
        "Brésil":"Brazil","Argentine":"Argentina","Uruguay":"Uruguay","Colombie":"Colombia","Chili":"Chile",
        "Mexique":"Mexico","États-Unis":"USA",
        "Maroc":"Morocco","Sénégal":"Senegal","Algérie":"Algeria","Côte d'Ivoire":"Ivory Coast",
        "Cameroun":"Cameroon","Nigeria":"Nigeria","Tunisie":"Tunisia","Ghana":"Ghana","Égypte":"Egypt",
        "Pologne":"Poland","Tchéquie":"Czechia","Serbie":"Serbia","Russie":"Russia","Ukraine":"Ukraine",
        "Suède":"Sweden","Norvège":"Norway","Danemark":"Denmark","Suisse":"Switzerland","Autriche":"Austria",
        "Turquie":"Turkey","Grèce":"Greece","Irlande":"Ireland","Écosse":"Scotland","Pays de Galles":"Wales",
        "Japon":"Japan","Corée du Sud":"South Korea","Australie":"Australia",
      };
      return en[criterion.value] || criterion.label;
    }
  }
  return criterion.label;
}

// ══ MULTIPLAYER ENGINE (BroadcastChannel + localStorage) ══
// Works between browser tabs. Replace with Supabase for cross-device.

const MAX_PLAYERS = 10;

function mpStore(key) { return `bb_mp_${key}`; }

function mpGetRoom(code) {
  try { const d = localStorage.getItem(mpStore(code)); return d ? JSON.parse(d) : null; } catch { return null; }
}

function mpSaveRoom(code, room) {
  try { localStorage.setItem(mpStore(code), JSON.stringify(room)); } catch {}
}

function mpDeleteRoom(code) {
  try { localStorage.removeItem(mpStore(code)); } catch {}
}

function createRoom(code, hostName, diff, gameMode, totalRounds) {
  const room = {
    code, hostName, diff, gameMode, totalRounds: totalRounds || 1,
    status: "lobby",
    seed: Math.floor(Math.random() * 9999999),
    createdAt: Date.now(),
    players: [{ id: code + "_0", name: hostName, score: 0, status: "waiting", isHost: true, joinedAt: Date.now() }],
  };
  mpSaveRoom(code, room);
  return room;
}

function joinRoom(code, playerName) {
  const room = mpGetRoom(code);
  if (!room) return { error: "Partie introuvable" };
  if (room.status !== "lobby") return { error: "Partie déjà commencée" };
  if (room.players.length >= MAX_PLAYERS) return { error: `Maximum ${MAX_PLAYERS} joueurs atteint` };
  if (room.players.find(p => p.name === playerName)) return { error: "Ce pseudo est déjà pris" };
  const player = { id: code + "_" + room.players.length, name: playerName, score: 0, status: "waiting", isHost: false, joinedAt: Date.now() };
  room.players.push(player);
  mpSaveRoom(code, room);
  return { room, player };
}

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({length:4}, ()=>chars[Math.floor(Math.random()*chars.length)]).join("");
}

function getClubColors(name){return CLUB_COLORS[name]||["#1a7a3a","#FFFFFF"];}

function ClubLogo({ club, size = 48 }) {
  const [ca, cb] = getClubColors(club);
  // Surcharges d'initiales pour les clubs italiens renommés (sinon "AR", "JF", "AB"... pas top)
  const INITIALS_OVERRIDE = {
    "AS Roma": "ASR",
    "SS Lazio": "SSL",
    "Juventus FC": "JUVE",
    "SSC Napoli": "NAP",
    "ACF Fiorentina": "FIO",
    "Atalanta BC": "ATA",
    "Bologna FC": "BOL",
    "Torino FC": "TOR",
    "Genoa CFC": "GEN",
    "Cagliari Calcio": "CAG",
    "Udinese Calcio": "UDI",
    "Empoli FC": "EMP",
    "Parma FC": "PAR",
  };
  const initials = INITIALS_OVERRIDE[club] || club.split(" ").map(w => w[0]).join("").slice(0, 3).toUpperCase();
  const fontSize = size < 36 ? (initials.length >= 4 ? size * 0.26 : size * 0.32) : (initials.length >= 4 ? size * 0.22 : size * 0.28);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `linear-gradient(135deg, ${ca} 0%, ${ca}cc 100%)`,
      border: `${Math.max(1.5, size * 0.04)}px solid ${cb}44`,
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: `0 2px 8px rgba(0,0,0,.4), inset 0 1px 0 ${cb}33`,
      flexShrink: 0,
    }}>
      <span style={{
        fontSize, fontWeight: 900, color: cb,
        fontFamily: "Arial Black, Arial, sans-serif",
        letterSpacing: initials.length > 2 ? -1 : 0,
        textShadow: `0 1px 2px rgba(0,0,0,.5)`,
        lineHeight: 1,
      }}>{initials}</span>
    </div>
  );
}

function textColor(hex){const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return(r*299+g*587+b*114)/1000>128?"#111":"#FFF";}
function generateOptions(correctPlayers,allPairs,seed,targetDiff){
  // seed optionnel : en multi room, permet d'avoir les MÊMES 4 options chez tous les joueurs
  const rand = (seed !== undefined && seed !== null) ? seededRandom(seed) : Math.random;
  // Mode AMATEUR : une paire est classée "facile" parce qu'AU MOINS un joueur
  // facile la relie, mais un tirage uniforme parmi tous les ponts n'a en
  // moyenne qu'1 chance sur 3 de le montrer (ex : Barcelone-OM → 6 fois sur 7
  // la bonne réponse était Zenden/Dugarry/Keita au lieu d'Alexis Sanchez).
  // On restreint donc la bonne réponse affichée aux joueurs "facile" du pont
  // (repli "moyen" si aucun). Le filtre est déterministe → OK en multi seedé.
  let candidates = correctPlayers;
  if (targetDiff === "facile") {
    for (const d of ["facile", "moyen"]) {
      const subset = correctPlayers.filter(p => PLAYER_DIFF[p] === d);
      if (subset.length) { candidates = subset; break; }
    }
  }
  const correct=candidates[Math.floor(rand()*candidates.length)];
  const pool=[];allPairs.forEach(pair=>pair.p.forEach(p=>{if(!correctPlayers.includes(p))pool.push(p);}));
  // Seeded shuffle pour les distracteurs
  const poolCopy=[...new Set(pool)];
  for(let i=poolCopy.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[poolCopy[i],poolCopy[j]]=[poolCopy[j],poolCopy[i]];}
  const wrongs=poolCopy.slice(0,3);
  // Seeded shuffle pour l'ordre final
  const out=[correct,...wrongs];
  for(let i=out.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[out[i],out[j]]=[out[j],out[i]];}
  return out;
}
function getComboLabel(c){if(c>=10)return"🔥 LEGENDARY";if(c>=7)return"💫 AMAZING";if(c>=5)return"⚡ ON FIRE";if(c>=3)return"🎯 COMBO";return"";}

// ── SOUNDS ──
// Contexte audio unique (réutilisé) — éviter d'en créer un par son (limite navigateur)
let _sndCtx=null;
function sndCtx(){
  try{
    if(!_sndCtx){ const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return null; _sndCtx=new AC(); }
    if(_sndCtx.state==="suspended") _sndCtx.resume();
    return _sndCtx;
  }catch(e){ return null; }
}
function playSound(type){
  try{
    const ctx=sndCtx(); if(!ctx) return;
    if(type==="tick"){
      const osc=ctx.createOscillator(),g=ctx.createGain();
      osc.connect(g);g.connect(ctx.destination);osc.type="square";osc.frequency.value=1500;
      g.gain.setValueAtTime(.0001,ctx.currentTime);g.gain.linearRampToValueAtTime(.05,ctx.currentTime+.005);g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.05);
      osc.start(ctx.currentTime);osc.stop(ctx.currentTime+.06);
      return;
    }
    if(type==="clocktick"){
      const osc=ctx.createOscillator(),g=ctx.createGain();
      osc.connect(g);g.connect(ctx.destination);osc.type="sine";osc.frequency.value=900;
      g.gain.setValueAtTime(.0001,ctx.currentTime);g.gain.linearRampToValueAtTime(.22,ctx.currentTime+.005);g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.09);
      osc.start(ctx.currentTime);osc.stop(ctx.currentTime+.1);
      return;
    }
    if(type==="spinstop"){
      [880,1175,1568].forEach((freq,i)=>{
        const osc=ctx.createOscillator(),g=ctx.createGain();
        osc.connect(g);g.connect(ctx.destination);osc.frequency.value=freq;osc.type="triangle";
        g.gain.setValueAtTime(0,ctx.currentTime+i*.06);g.gain.linearRampToValueAtTime(.22,ctx.currentTime+i*.06+.01);
        g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+i*.06+.2);
        osc.start(ctx.currentTime+i*.06);osc.stop(ctx.currentTime+i*.06+.2);
      });
      return;
    }
    if(type==="ok"){
      [523,659,784].forEach((freq,i)=>{
        const osc=ctx.createOscillator(),g=ctx.createGain();
        osc.connect(g);g.connect(ctx.destination);osc.frequency.value=freq;osc.type="sine";
        g.gain.setValueAtTime(0,ctx.currentTime+i*.1);g.gain.linearRampToValueAtTime(.3,ctx.currentTime+i*.1+.02);
        g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+i*.1+.3);
        osc.start(ctx.currentTime+i*.1);osc.stop(ctx.currentTime+i*.1+.3);
      });
    }else if(type==="combo"){
      [659,784,988,1175].forEach((freq,i)=>{
        const osc=ctx.createOscillator(),g=ctx.createGain();
        osc.connect(g);g.connect(ctx.destination);osc.frequency.value=freq;osc.type="sine";
        g.gain.setValueAtTime(0,ctx.currentTime+i*.08);g.gain.linearRampToValueAtTime(.35,ctx.currentTime+i*.08+.02);
        g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+i*.08+.25);
        osc.start(ctx.currentTime+i*.08);osc.stop(ctx.currentTime+i*.08+.25);
      });
    }else if(type==="milestone"){
      // Fanfare triomphale montante (palier de chaîne franchi)
      [523,659,784,1047,1319].forEach((freq,i)=>{
        const osc=ctx.createOscillator(),g=ctx.createGain();
        osc.connect(g);g.connect(ctx.destination);osc.frequency.value=freq;osc.type="triangle";
        g.gain.setValueAtTime(0,ctx.currentTime+i*.09);g.gain.linearRampToValueAtTime(.4,ctx.currentTime+i*.09+.02);
        g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+i*.09+.45);
        osc.start(ctx.currentTime+i*.09);osc.stop(ctx.currentTime+i*.09+.45);
      });
    }else{
      const osc=ctx.createOscillator(),g=ctx.createGain();
      osc.connect(g);g.connect(ctx.destination);osc.frequency.setValueAtTime(220,ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110,ctx.currentTime+.3);osc.type="sawtooth";
      g.gain.setValueAtTime(.3,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.3);
      osc.start(ctx.currentTime);osc.stop(ctx.currentTime+.3);
    }
  }catch(e){}
}

// Vibration haptique mobile — ne fait rien si non supporté (desktop/iOS Safari)
function vibrate(pattern){
  try{ if(navigator.vibrate) navigator.vibrate(pattern); }catch(e){}
}

// Phrases flatteuses aléatoires selon le combo — affichées sur bonne réponse
const POSITIVE_FEEDBACK = {
  fr: {
    // Combo 0-2 : réponses normales, positif mais chill
    base: ["Nickel ✓","Joli 🎯","Ça passe ⚽","Propre 👌","Bien vu 👀","Solide 💪","Facile 😎","Tranquille 🚶"],
    // Combo 3-4 : on chauffe
    warm: ["🔥 EN FEU !","💥 ENCHAÎNEMENT !","⚡ ÇA CARBURE !","🎯 DANS LE MILLE !","🚀 TU DÉCOLLES !"],
    // Combo 5-6 : imparable
    hot:  ["⚡ IMPARABLE !","🎯 TU ES DANS LA ZONE !","🔥 ON T'ARRÊTE PLUS !","💨 VITESSE GRAND V !","🎪 SPECTACLE !"],
    // Combo 7-9 : phénoménal
    fire: ["💫 PHÉNOMÉNAL !","🌟 MACHINE !","👑 CLASSE MONDIALE !","🏟️ LE PUBLIC EST DEBOUT !","🎭 ARTISTE !"],
    // Combo 10+ : légendaire
    god:  ["🏆 LÉGENDAIRE !!!","👑 BALLON D'OR !","🐐 LE GOAT !","🌌 HORS NORMES !","🎖️ RECORD EN VUE !"]
  },
  en: {
    base: ["Clean ✓","Nice 🎯","Easy ⚽","Solid 👌","Good eye 👀","Strong 💪","Too easy 😎","Chill 🚶"],
    warm: ["🔥 ON FIRE !","💥 CHAIN REACTION !","⚡ CRUISING !","🎯 BULLSEYE !","🚀 TAKING OFF !"],
    hot:  ["⚡ UNSTOPPABLE !","🎯 IN THE ZONE !","🔥 CAN'T STOP YOU !","💨 FULL SPEED !","🎪 WHAT A SHOW !"],
    fire: ["💫 PHENOMENAL !","🌟 MACHINE !","👑 WORLD CLASS !","🏟️ CROWD'S ON THEIR FEET !","🎭 ARTIST !"],
    god:  ["🏆 LEGENDARY !!!","👑 BALLON D'OR !","🐐 THE GOAT !","🌌 OUT OF THIS WORLD !","🎖️ RECORD INCOMING !"]
  }
};

function getPositiveFeedback(combo, lang){
  const pool = POSITIVE_FEEDBACK[(lang==="fr"?"fr":"en")];
  let tier;
  if(combo>=10) tier=pool.god;
  else if(combo>=7) tier=pool.fire;
  else if(combo>=5) tier=pool.hot;
  else if(combo>=3) tier=pool.warm;
  else tier=pool.base;
  return tier[Math.floor(Math.random()*tier.length)];
}

// ── CSS ──
if(typeof document!=="undefined"&&!document.getElementById("bb-css")){
  const s=document.createElement("style");s.id="bb-css";
  s.textContent=`
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Anton&family=Inter:wght@400;600;700;800&family=Nunito:wght@400;700;800;900&display=swap');
    @keyframes splashRoll{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
    @keyframes countdownPulse{0%{transform:scale(0.5);opacity:0;}50%{transform:scale(1.2);opacity:1;}100%{transform:scale(1);opacity:1;}}
    @keyframes dropIn{from{opacity:0;transform:translateY(-70px) scale(1.3)}to{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes goatCrash{
      0%{transform:translateY(-900px) scale(2.5) rotate(-15deg);opacity:0;}
      60%{transform:translateY(18px) scale(1.1) rotate(3deg);opacity:1;}
      72%{transform:translateY(-8px) scale(0.95) rotate(-2deg);}
      80%{transform:translateY(10px) scale(1.05) rotate(1deg);}
      88%{transform:translateY(-4px) scale(0.98) rotate(-1deg);}
      100%{transform:translateY(0px) scale(1) rotate(0deg);opacity:1;}
    }
    @keyframes crackAppear{0%{opacity:0;transform:scale(0)}60%{opacity:0}65%{opacity:1;transform:scale(1.3)}100%{opacity:1;transform:scale(1)}}
    @keyframes shockwave{0%{transform:scale(0);opacity:.8}100%{transform:scale(3);opacity:0}}
    @keyframes lineExpand{from{width:0}to{width:260px}}
    @keyframes splashLoad{0%{width:0%}100%{width:100%}}
    @keyframes splashBounceIn{0%{opacity:0;transform:scale(0.3) translateY(-80px)}60%{opacity:1;transform:scale(1.15) translateY(10px)}80%{transform:scale(0.95) translateY(-5px)}100%{opacity:1;transform:scale(1) translateY(0)}}
    @keyframes splashPulse{0%,100%{transform:scale(1) rotate(-2deg)}50%{transform:scale(1.08) rotate(2deg)}}
    @keyframes splashTitle{0%{opacity:0;transform:translateY(30px) scale(0.8)}100%{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes splashFadeOut{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.15)}}
    @keyframes splashGlow{0%,100%{box-shadow:0 0 40px rgba(0,230,118,.3),0 0 80px rgba(0,230,118,.1)}50%{box-shadow:0 0 60px rgba(0,230,118,.6),0 0 120px rgba(0,230,118,.2)}}
    /* ── Cartes de collection, façon FUT ──
       Le cadre est un dégradé métallique porté par le conteneur (padding), et
       le visuel s'inscrit dedans : c'est ce liseré qui distingue bronze, argent,
       or et diamant. Seul le diamant reçoit un reflet animé — un balayage
       diagonal en surimpression, pas un clignotement, pour rester lisible. */
    .bbDiamant{position:relative}
    .bbDiamant::after{
      content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;
      background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.75) 46%,rgba(255,255,255,.15) 54%,transparent 70%);
      background-size:260% 100%;animation:bbShine 2.8s ease-in-out infinite;mix-blend-mode:screen;
    }
    @keyframes bbShine{0%{background-position:120% 0}55%{background-position:-40% 0}100%{background-position:-40% 0}}
    @media (prefers-reduced-motion:reduce){.bbDiamant::after{animation:none;opacity:.35}}

    /* ── Écran de lancement ──
       splash.webp est calibré pour un téléphone (853 × 1844, soit un format très
       vertical). En "cover" sur un écran plus large que haut, il est agrandi
       ~2,3× pour couvrir la largeur et il n'en reste qu'une bande centrale : sur
       ordinateur, on ne voyait qu'un morceau de maillot. Au-delà d'un format de
       téléphone, on affiche donc l'image ENTIÈRE ("contain"), avec une copie
       floutée en fond pour ne pas laisser deux bandes noires sur les côtés. */
    .bbSplashImg{width:100%;height:100%;object-fit:cover;object-position:center;display:block;position:relative;z-index:1}
    .bbSplashBlur,.bbSplashWide{display:none}
    @media (min-aspect-ratio:3/5){
      .bbSplashImg{object-fit:contain}
      .bbSplashBlur{display:block;position:absolute;inset:0;z-index:0;width:100%;height:100%;object-fit:cover;filter:blur(30px) brightness(.45);transform:scale(1.12)}
    }
    /* Écran en paysage (ordinateur, tablette couchée) : on passe au visuel
       dédié 16/9, qui recouvre le repli ci-dessus. Il n'est PAS utilisé sur un
       écran plus haut que large (tablette debout), où un cadrage "cover"
       amputerait les joueurs des deux côtés : là, l'artwork vertical d'origine
       affiché en entier reste le meilleur rendu.
       Chargé en background CSS et non en <img> exprès : si le fichier vient à
       manquer, le calque reste transparent — pas d'icône d'image cassée — et on
       retombe proprement sur l'image portrait entière + fond flou. */
    @media (min-aspect-ratio:1/1){
      .bbSplashWide{display:block;position:absolute;inset:0;z-index:2;background:center/cover no-repeat url("/splash-desktop.webp")}
    }
    @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
    @keyframes duelSettle{0%{transform:translateY(-46px) scale(1.04);opacity:.5}55%{transform:translateY(7px) scale(1)}78%{transform:translateY(-3px)}100%{transform:translateY(0);opacity:1}}
    @keyframes duelFloat{0%{transform:translate(-50%,10px) scale(.8);opacity:0}18%{transform:translate(-50%,0) scale(1.1);opacity:1}70%{transform:translate(-50%,-8px) scale(1);opacity:1}100%{transform:translate(-50%,-46px) scale(.95);opacity:0}}
    @keyframes duelReelBlur{0%{transform:translateY(-7px)}100%{transform:translateY(7px)}}
    @keyframes floatBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
    @keyframes livePulse{0%{transform:scale(1);opacity:.9}100%{transform:scale(2.4);opacity:0}}
    @keyframes bigAnswerPop{0%{transform:scale(.7);opacity:0}14%{transform:scale(1.06);opacity:1}72%{transform:scale(1);opacity:1}100%{transform:scale(1);opacity:0}}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    @keyframes popIn{0%{transform:scale(.6);opacity:0}70%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
    @keyframes slideIn{from{opacity:0;transform:translateX(-18px)}to{opacity:1;transform:translateX(0)}}
    @keyframes dailySlide{0%{opacity:0;transform:translateX(-60px)}100%{opacity:1;transform:translateX(0)}}
    @keyframes scoreUp{0%{transform:scale(1)}50%{transform:scale(1.5);color:#4ade80}100%{transform:scale(1)}}
    @keyframes scoreDn{0%{transform:scale(1)}50%{transform:scale(1.3);color:#ef4444}100%{transform:scale(1)}}
    @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} @keyframes comboFire{0%{transform:scale(1) rotate(0)}25%{transform:scale(1.3) rotate(-3deg)}50%{transform:scale(1.1) rotate(3deg)}100%{transform:scale(1) rotate(0)}}
    @keyframes floatUp{0%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(-60px) scale(1.3)}}
    @keyframes slideInRight{from{opacity:0;transform:translateX(80px) translateY(20px)}to{opacity:1;transform:translateX(0) translateY(0)}}
    @keyframes confettiFall{0%{transform:translateY(-100vh) rotate(0deg);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
    @keyframes pulseStreak{0%,100%{transform:scale(1)}50%{transform:scale(1.18);filter:brightness(1.3)}}
    @keyframes dangerPulse{0%,100%{transform:scale(1);box-shadow:0 4px 14px rgba(255,61,87,.55)}50%{transform:scale(1.08);box-shadow:0 6px 20px rgba(255,61,87,.85)}}
    @keyframes flameGlow{0%,100%{filter:drop-shadow(0 0 4px #FF6B3588)}50%{filter:drop-shadow(0 0 16px #FFD600DD) drop-shadow(0 0 8px #FF6B35)}}
    @keyframes clubSlideLeft{0%{opacity:0;transform:translateX(-110%) scale(.88)}65%{transform:translateX(4%) scale(1.02)}100%{opacity:1;transform:translateX(0) scale(1)}}
    @keyframes clubSlideRight{0%{opacity:0;transform:translateX(110%) scale(.88)}65%{transform:translateX(-4%) scale(1.02)}100%{opacity:1;transform:translateX(0) scale(1)}}
    @keyframes vsAppear{0%{opacity:0;transform:scale(0) rotate(-15deg)}65%{transform:scale(1.25) rotate(4deg)}100%{opacity:1;transform:scale(1) rotate(0)}}
    @keyframes sheetUp{0%{transform:translateY(100%);opacity:0}100%{transform:translateY(0);opacity:1}}
    @keyframes answerOk{0%{transform:scale(1)}30%{transform:scale(1.06)}60%{transform:scale(.97)}100%{transform:scale(1)}}
    @keyframes answerKo{0%,100%{transform:translateX(0)}15%{transform:translateX(-12px)}30%{transform:translateX(10px)}45%{transform:translateX(-8px)}60%{transform:translateX(6px)}75%{transform:translateX(-3px)}}
    @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
    @keyframes flashOk{0%{background:rgba(74,222,128,0)}40%{background:rgba(74,222,128,.18)}100%{background:rgba(74,222,128,0)}}
    @keyframes flashKo{0%{background:rgba(239,68,68,0)}40%{background:rgba(239,68,68,.15)}100%{background:rgba(239,68,68,0)}}
    @keyframes onoPop{0%{opacity:0;transform:scale(.2) rotate(-14deg)}22%{opacity:1;transform:scale(1.3) rotate(7deg)}42%{transform:scale(.96) rotate(-4deg)}62%{opacity:1;transform:scale(1.06) rotate(2deg)}100%{opacity:0;transform:scale(1.5) rotate(5deg)}}
    @keyframes chainPop{0%{transform:scale(.8);opacity:0}100%{transform:scale(1);opacity:1}}
    @keyframes playerDrop{0%{opacity:0;transform:translateY(-80%) scale(.88)}65%{transform:translateY(5%) scale(1.03)}100%{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes clubTagPop{0%{opacity:0;transform:scale(.7) translateX(-10px)}70%{transform:scale(1.08) translateX(2px)}100%{opacity:1;transform:scale(1) translateX(0)}}
    @keyframes optionIn{0%{opacity:0;transform:translateY(16px) scale(.95)}100%{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes optionPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}
    @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
    @keyframes floatBall{0%{transform:translateY(0) rotate(0deg)}100%{transform:translateY(-18px) rotate(20deg)}}
    @keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}
    @keyframes slideDown{from{opacity:0;transform:translateY(-20px)}to{opacity:1;transform:translateY(0)}}
    @keyframes chainMsPop{0%{opacity:0;transform:scale(.4) translateY(20px)}45%{opacity:1;transform:scale(1.12) translateY(0)}70%{transform:scale(.96)}100%{opacity:1;transform:scale(1)}}
    @keyframes chainMsOut{0%{opacity:1}100%{opacity:0;transform:scale(1.15)}}
    @keyframes kickBall{0%{transform:scale(1) rotate(0)}40%{transform:scale(1.15) rotate(-15deg)}100%{transform:scale(1) rotate(10deg)}}
    @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
    @keyframes heartbeat{0%,100%{transform:scale(1)}15%{transform:scale(1.15)}30%{transform:scale(1)}45%{transform:scale(1.1)}60%{transform:scale(1)}}
    @keyframes urgentPulse{0%,100%{opacity:1}50%{opacity:.6}} @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
    html,body,#root{background:#0E1F14!important;min-height:100vh;min-height:100dvh;}
    html{background:#0E1F14!important;}
    #root{background-image:repeating-linear-gradient(90deg,#0E1F14 0,#0E1F14 14.28%,#132819 14.28%,#132819 28.57%,#0E1F14 28.57%,#0E1F14 42.86%,#132819 42.86%,#132819 57.14%,#0E1F14 57.14%,#0E1F14 71.43%,#132819 71.43%,#132819 85.71%,#0E1F14 85.71%)!important;padding-top:env(safe-area-inset-top);}
  `;
document.title = 'GOAT FC';
document.head.appendChild(s);
}

// ── NOTIFICATIONS ──
const NOTIF_MESSAGES_FR = [
  { title:"⚽ GOAT FC t'attend !", body:"Tu connais tous les transferts ? Prouve-le !" },
  { title:"🏆 Bats ton record !", body:"Ton record t'attend. Reviens jouer !" },
  { title:"⚽ C'est l'heure du quiz !", body:"Qui a joué dans ces deux clubs ? Viens tester !" },
  { title:"🔗 La Chaîne t'appelle !", body:"Combien de clubs peux-tu enchaîner aujourd'hui ?" },
  { title:"📊 Le classement bouge !", body:"Quelqu'un a peut-être battu ton record..." },
];
const NOTIF_MESSAGES_EN = [
  { title:"⚽ GOAT FC is waiting!", body:"You know all the transfers? Prove it!" },
  { title:"🏆 Beat your record!", body:"Your record is waiting. Come back and play!" },
  { title:"⚽ Quiz time!", body:"Who played for these two clubs? Come test yourself!" },
  { title:"🔗 The Chain calls you!", body:"How many clubs can you chain today?" },
  { title:"📊 The leaderboard is moving!", body:"Someone might have beaten your record..." },
];
function getNotifMessages(){ try { return localStorage.getItem("bb_lang")==="en" ? NOTIF_MESSAGES_EN : NOTIF_MESSAGES_FR; } catch { return NOTIF_MESSAGES_FR; } }
const NOTIF_MESSAGES = NOTIF_MESSAGES_FR;

function pickRandom(arr) { return arr[Math.floor(Math.random()*arr.length)]; }

async function requestNotifPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

// Détection : est-ce qu'on est sur iOS (iPhone/iPad) ?
function isIOS() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua) || (/macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

// Détection : est-ce que l'app est installée sur l'écran d'accueil (standalone) ?
function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

// Est-ce qu'on est sur Android ?
function isAndroid() {
  if (typeof window === "undefined") return false;
  return /android/i.test(window.navigator.userAgent);
}

// VAPID public key pour signer les subscriptions push
// Clé publique générée via vapidkeys.com — la private key correspondante doit être stockée
// dans Supabase Secrets pour l'Edge Function qui enverra les notifs
const VAPID_PUBLIC_KEY = "BOwSf9_eF4dgLAp1KD3e1dfX1qurhcaMvAOnJpYL7hwuXhfgX0cJnswXuhe5VPAEWjrLjVJD61b6crJXzG0HVMg";

// Convertit une base64 URL-safe en Uint8Array (nécessaire pour l'API PushManager)
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// S'abonne aux push notifications et sauvegarde le token dans Supabase
async function subscribeToPush(playerId, sbFetch) {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
    if (Notification.permission !== "granted") return false;
    const reg = await navigator.serviceWorker.ready;
    // Vérifier s'il y a déjà une subscription active
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    // Envoyer la subscription à Supabase
    const subJson = sub.toJSON();
    await sbFetch("bb_push_subscriptions", {
      method: "POST",
      headers: { "Content-Type":"application/json", "Prefer":"resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        player_id: playerId,
        endpoint: subJson.endpoint,
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth,
        platform: isIOS() ? "ios" : isAndroid() ? "android" : "desktop",
        standalone: isStandalone()
      })
    });
    return true;
  } catch(e) {
    return false;
  }
}

function sendNotif(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "goatfc-reminder",
      renotify: true,
    });
  } catch(e) {}
}

function checkAndScheduleNotif() {
  try {
    const last = localStorage.getItem("bb_last_visit");
    const now = Date.now();
    localStorage.setItem("bb_last_visit", String(now));

    if (last) {
      const elapsed = now - parseInt(last);
      const h24 = 24 * 60 * 60 * 1000;
      // If 24h+ since last visit, note it (notif already sent by timer or we show banner)
      if (elapsed > h24) {
        return true; // Signal: user was away 24h+
      }
    }
    return false;
  } catch { return false; }
}

function scheduleNextNotif() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  // Schedule a notification in 24h if the tab stays open (PWA)
  const h24 = 24 * 60 * 60 * 1000;
  setTimeout(() => {
    const msg = pickRandom(getNotifMessages());
    sendNotif(msg.title, msg.body);
    scheduleNextNotif(); // Reschedule for next 24h
  }, h24);
}


export default function LePont() {
  // Design system (déplacé en haut pour éviter Temporal Dead Zone)
  const G = {
    bg:"#0E1F14",bgPanel:"rgba(0,0,0,.5)",bgCard:"#141414",dark:"#0a0a0a",white:"#ffffff",
    offWhite:"#F5F5F5",accent:"#00E676",gold:"#FFD600",red:"#FF3D57",
    font:"'Bebas Neue',cursive,sans-serif",heading:"'Bebas Neue',cursive,sans-serif",

    // ── Charte « Olive et Tom » ────────────────────────────────────────
    // Ce qui fait le manga, c'est le TRAIT et l'OMBRE DURE, pas l'angle vif :
    // les rayons restent proches de ceux d'avant (arrondi franc). Ces jetons
    // ne sont pour l'instant appliqués QUE sur l'écran d'accueil mobile.
    encre:"#081109",        // le trait — noir à biais vert, jamais noir pur
    pelouse:"#2A9B4E",      // l'accent principal, remplace le vert LED #00E676
    projecteur:"#F5C22B",   // actions et réussites, moins fluo que #FFD600
    maillot:"#D93A2B",      // urgence, défaite, compte à rebours
    ciel:"#2A6FBF",         // l'adversaire, le second camp
    nuit:"#0E2C17",
    trait:"3px solid #081109",
    traitFin:"2px solid #081109",
    ombre:"4px 4px 0 #081109",
    ombreL:"5px 5px 0 #081109",
    rayon:18, rayonS:12, rayonL:20,
    poster:"'Anton',Impact,sans-serif",
  };
  // Lettrage de titre manga : légère italique, contour d'encre, ombre dure.
  // paintOrder évite que le contour ne ronge l'intérieur des lettres.
  //
  // Le contour n'a de sens QUE pour du texte clair sur fond sombre : posé sur
  // du texte sombre, il se confond avec la lettre, bouche les contre-formes et
  // rend le mot illisible. Pour un aplat clair (jaune, blanc), utiliser
  // posterLight, qui ne garde que l'italique.
  //
  // L'épaisseur est proportionnelle au corps : un contour fixe de 2 px étouffe
  // un texte de 15 px alors qu'il se voit à peine sur un titre de 52 px.
  const posterText = function(size, color, stroke){
    const w = stroke != null ? stroke : Math.max(1.2, Math.round(size / 16 * 10) / 10);
    const base = {
      fontFamily:G.poster, fontSize:size, lineHeight:1, letterSpacing:.5,
      transform:"skewX(-7deg)", color:color||G.white,
    };
    // L'ombre dure d'encre est portée par TOUS les libellés, contourés ou non :
    // c'est elle qui donne le relief d'affiche. Son décalage suit le corps.
    // Contour et ombre du LETTRAGE sont réservés aux grands titres. Sur un
    // libellé de bouton, l'ombre dure ne lit pas comme un effet d'affiche : elle
    // double le mot d'un fantôme noir décalé, et le contour épaissit les lettres
    // sans qu'on y gagne rien. Le relief d'un bouton vient déjà de SON PROPRE
    // encadrement — contour d'encre + ombre dure sur le cadre, pas sur le texte.
    if (size < 32) return base;
    const d = Math.round((size / 18 + w) * 10) / 10;
    return { ...base, WebkitTextStroke:w+"px "+G.encre, paintOrder:"stroke fill",
      textShadow:d+"px "+d+"px 0 "+G.encre };
  };
  // Même lettrage, sans contour ni ombre : pour du texte sombre sur aplat clair.
  const posterLight = function(size, color){ return posterText(size, color || "#1A1206", 0); };
  // Bouton unique de la charte. `bg` porte le sens (jaune = action principale,
  // vert = classement, rouge = urgence) ; le traitement, lui, ne change jamais.
  // `fg` clair → lettrage contouré ; `fg` sombre → lettrage nu (le contour
  // boucherait les lettres).
  const btn = function(bg, fg, size){
    const c = fg || "#1A1206";
    const clair = c === G.white || c === "#fff" || c === "#ffffff";
    return {
      background:bg, color:c, border:G.trait, boxShadow:G.ombre, borderRadius:G.rayon,
      padding:"10px 16px",
      cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8,
      ...(clair ? posterText(size||17, c) : posterLight(size||17, c)),
    };
  };
  const [showSplash, setShowSplash] = useState(true);
  const [screen, setScreen] = useState("home");
  const [gameMode, setGameMode] = useState("pont");
  // ─── Home Carousel State (0=DUEL/GOAT BATTLE, 1=GRID, 2=MERCATO, 3=PLUG, 4=GUESS) ──
  const [homeCardIndex, setHomeCardIndex] = useState(() => {
    // Card 0 = GOAT BATTLE (duel) par défaut. Migration unique : on force la carte 0
    // pour tout le monde une fois (les anciens utilisateurs ont un index sauvegardé
    // qui pointait vers une autre carte avant le réordonnancement du carrousel).
    try {
      if (localStorage.getItem("bb_home_card_v2") !== "1") {
        localStorage.setItem("bb_home_card", "0");
        localStorage.setItem("bb_home_card_v2", "1");
        return 0;
      }
    } catch (e) {}
    const saved = parseInt(localStorage.getItem("bb_home_card") || "0", 10);
    return isNaN(saved) || saved < 0 || saved > 5 ? 0 : saved;
  });
  const homeSwipeStartRef = useRef(null);
  const [homeRulesModal, setHomeRulesModal] = useState(null); // null | "grid" | "mercato" | "plug"
  // ─── Tableau de bord privé (?stats=CODE) ──
  const [statsMode] = useState(function(){ try { return new URLSearchParams(window.location.search).get("stats") === STATS_CODE; } catch(e) { return false; } });
  const [statsData, setStatsData] = useState(null);
  const [statsRange, setStatsRange] = useState(14); // fenêtre d'analyse : 1 / 5 / 10 / 14 jours
  const [liveNow, setLiveNow] = useState(null);      // nb de personnes actuellement sur l'app
  // Compteur "en ce moment" — rafraîchi toutes les 15 s tant que le dashboard est ouvert.
  useEffect(function(){
    if (!statsMode) return;
    let stop = false;
    async function poll(){
      // en ligne = vu dans les 80 dernières secondes
      const since = new Date(Date.now() - 80*1000).toISOString();
      const rows = await sbFetchAll("bb_presence?select=player_id&last_seen=gte."+since+"&order=player_id.asc", 10000);
      if (stop) return;
      setLiveNow(Array.isArray(rows) ? rows.length : null);
    }
    poll();
    const iv = setInterval(poll, 15000);
    return function(){ stop = true; clearInterval(iv); };
  }, [statsMode]);
  useEffect(function(){
    if (!statsMode || statsData) return;
    (async function(){
      // On récupère la fenêtre MAX (14 j) une seule fois ; le filtrage par plage
      // (1/5/10/14 j) se fait ensuite côté client (voir statsView).
      const since = new Date(Date.now() - 14*24*3600*1000).toISOString();
      // sbFetchAll (et pas sbFetch) : au-delà de 1000 lignes l'API tronque la
      // réponse, et une fenêtre de 14 j de bb_events dépasse largement ce seuil.
      const scores = await sbFetchAll("bb_scores?select=player_id,created_at&created_at=gte."+since+"&order=created_at.desc", 20000) || [];
      const events = await sbFetchAll("bb_events?select=player_id,created_at,type&created_at=gte."+since+"&order=created_at.desc", 50000);
      const hasEvents = Array.isArray(events);
      // `pseudo` sert à nommer les joueurs dans la section « qui joue à quoi ».
      const pseudos = await sbFetchAll("bb_pseudos?select=player_id,pseudo&order=player_id.asc", 100000) || [];
      const duels = await sbFetchAll("bb_duels?select=id,created_at&created_at=gte."+since+"&order=created_at.desc", 20000) || [];
      // Jour calendaire (Paris) attaché UNE fois par ligne : le regroupement par
      // jour et le filtrage par plage se font ensuite par simple comparaison de
      // chaînes, sans repasser par Intl à chaque changement de plage.
      for (const r of scores) r.day = parisDayOf(r.created_at);
      if (hasEvents) for (const r of events) r.day = parisDayOf(r.created_at);
      // Derniers comptes créés — tente avec created_at, se rabat si la colonne n'existe pas
      let recent = await sbFetch("bb_pseudos?select=pseudo,country,created_at&order=created_at.desc&limit=40");
      let recentHasDate = true;
      if (!recent) { recentHasDate = false; recent = await sbFetch("bb_pseudos?select=pseudo,country&limit=40") || []; }
      // ─── Totaux DEPUIS LE DÉBUT (tout l'historique, comptés via l'en-tête) ───
      const allTime = {
        games:    await sbCount("bb_scores"),    // scores enregistrés (pas toutes les parties : voir plus bas)
        duels:    await sbCount("bb_duels"),     // duels 1v1 en ligne
        rooms:    await sbCount("bb_rooms"),     // salons multijoueurs créés
        accounts: await sbCount("bb_pseudos"),   // comptes créés
        grid:     await sbCount("bb_gg_scores"), // parties GOAT GRID enregistrées
      };
      // ─── Parties par mode DEPUIS LE DÉBUT ───
      // bb_events n'est lu que sur la fenêtre de 14 j (pour le détail jour par
      // jour) : la répartition par mode y était donc plafonnée à 14 jours et tout
      // l'historique plus ancien devenait invisible. On demande ici des comptes
      // EXACTS par type, sans transférer de lignes (Range 0-0), donc ça reste
      // léger même quand bb_events grossit.
      let playsAllTime = null, trackingSince = null;
      if (hasEvents) {
        playsAllTime = {};
        await Promise.all(PLAY_MODES_META.map(async function(m){
          const pair = await Promise.all([
            sbCount("bb_events", "type=eq.play_" + m.key),
            sbCount("bb_events", "type=eq.play_" + m.key + "_online"),
          ]);
          playsAllTime[m.key] = { solo: pair[0] || 0, online: pair[1] || 0 };
        }));
        // Date du 1er événement de partie : avant elle, aucune donnée par mode
        // n'existe — à afficher pour ne pas laisser croire à un sous-comptage.
        const first = await sbFetch("bb_events?select=created_at&type=like.play_*&order=created_at.asc&limit=1");
        if (Array.isArray(first) && first[0]) trackingSince = first[0].created_at;
      }
      setStatsData({
        rawScores: scores,
        rawEvents: hasEvents ? events : null,
        hasEvents: hasEvents,
        regIds: pseudos.map(function(p){ return p.player_id; }),
        pseudoById: pseudos.reduce(function(acc,p){ if (p.pseudo) acc[p.player_id] = p.pseudo; return acc; }, {}),
        accounts: pseudos.length,
        rawDuels: duels.map(function(d){ return parisDayOf(d.created_at); }),
        recent: recent, recentHasDate: recentHasDate, allTime: allTime,
        playsAllTime: playsAllTime, trackingSince: trackingSince,
      });
    })();
  }, [statsMode, statsData]);
  // Agrégation dépendante de la plage choisie (recalcul instantané au changement de plage)
  const statsView = React.useMemo(function(){
    if (!statsData) return null;
    const range = statsRange;
    const nowMs = Date.now();
    // La plage compte les `range` DERNIERS JOURS CALENDAIRES (Paris), aujourd'hui
    // inclus — et non une fenêtre glissante de range × 24 h. Sans ça, « 1 j »
    // affichait « actifs aujourd'hui » en comptant aussi la soirée de la veille :
    // le grand compteur du haut ne pouvait pas coïncider avec la ligne
    // « Aujourd'hui » du détail jour par jour juste en dessous.
    const dayList = parisLastDays(14, nowMs); // du plus récent au plus ancien
    const cutDay = dayList[Math.min(range, dayList.length) - 1];
    const inRange = function(day){ return !!day && day >= cutDay; };
    const regSet = new Set(statsData.regIds || []);
    const hasEvents = statsData.hasEvents;
    const scoresW = (statsData.rawScores || []).filter(function(r){ return inRange(r.day); });
    const eventsW = hasEvents ? (statsData.rawEvents || []).filter(function(r){ return inRange(r.day); }) : [];
    // Joueurs actifs = UNION des deux sources. bb_events seul ne suffit pas : un
    // score enregistré dont le ping d'événement a échoué (réseau, ancien bundle
    // en cache, RLS) produisait un « 0 joueur · N parties » contradictoire.
    const activeRowsW = hasEvents ? eventsW.concat(scoresW) : scoresW;
    // Joueurs actifs uniques (+ anonymes) sur la fenêtre
    const activeSet = new Set(), anonSet = new Set();
    for (const r of activeRowsW) { if (r.player_id) { activeSet.add(r.player_id); if (hasEvents && !regSet.has(r.player_id)) anonSet.add(r.player_id); } }
    const gamesW = scoresW.length;
    const duelsW = (statsData.rawDuels || []).filter(inRange).length;
    // Parties lancées par mode (+ répartition solo / en ligne) sur la fenêtre
    const playsByMode = { pont:0, chaine:0, grid:0, guess:0, battle:0, reveal:0, devinette:0 };
    let playsSolo = 0, playsOnline = 0;
    if (hasEvents) {
      for (const r of eventsW) {
        if (r.type && r.type.indexOf("play_") === 0) {
          const online = r.type.slice(-7) === "_online";
          const m = online ? r.type.slice(5, -7) : r.type.slice(5);
          if (playsByMode[m] !== undefined) { playsByMode[m]++; if (online) playsOnline++; else playsSolo++; }
        }
      }
    }
    const totalPlays = playsByMode.pont + playsByMode.chaine + playsByMode.grid + playsByMode.guess + playsByMode.battle + playsByMode.reveal + playsByMode.devinette;
    // Qui joue à quoi — répartition des parties par JOUEUR sur la fenêtre.
    // Un joueur sans pseudo (jamais inscrit) apparaît sous son identifiant
    // d'appareil : c'est tout ce qu'on sait de lui.
    const perPlayer = {};
    if (hasEvents) {
      for (const r of eventsW) {
        if (!r.player_id || !r.type || r.type.indexOf("play_") !== 0) continue;
        const online = r.type.slice(-7) === "_online";
        const m = online ? r.type.slice(5, -7) : r.type.slice(5);
        if (playsByMode[m] === undefined) continue;
        const p = perPlayer[r.player_id] || (perPlayer[r.player_id] = { pid: r.player_id, n: 0, modes: {} });
        p.n++; p.modes[m] = (p.modes[m] || 0) + 1;
      }
    }
    const players = Object.keys(perPlayer).map(function(k){ return perPlayer[k]; }).sort(function(a,b){ return b.n - a.n; });
    // Temps passé dans l'app — événements "dur_<secondes>", 1 par session
    // (voir trackTime dans lib/track.ts). Aucune donnée avant le déploiement
    // qui a introduit la mesure : on l'affiche explicitement plutôt que 0.
    let sessions = 0, timeTotalS = 0;
    const timeByPlayer = {};
    if (hasEvents) {
      for (const r of eventsW) {
        if (!r.type || r.type.indexOf("dur_") !== 0) continue;
        const s = parseInt(r.type.slice(4), 10);
        if (!isFinite(s) || s <= 0) continue;
        sessions++; timeTotalS += s;
        timeByPlayer[r.player_id] = (timeByPlayer[r.player_id] || 0) + s;
      }
    }
    const timePlayers = Object.keys(timeByPlayer).length;
    // Répartition par OS (pings "open_<os>") sur la fenêtre — 1 appareil compté une fois
    const osByDevice = {};
    if (hasEvents) { for (const r of eventsW) { if (r.type && r.type.indexOf("open_") === 0) osByDevice[r.player_id] = r.type.slice(5); } }
    const osCount = { ios:0, android:0, other:0 };
    for (const id in osByDevice) { const o = osByDevice[id]; if (osCount[o] !== undefined) osCount[o]++; else osCount.other++; }
    // Détail jour par jour — TOUJOURS sur les 14 derniers jours (indépendant de la
    // plage choisie), pour que la vue « jour par jour » reste visible même en 1 j.
    // Même union que ci-dessus : une journée avec des parties a forcément des joueurs.
    const fullActive = hasEvents
      ? (statsData.rawEvents || []).concat(statsData.rawScores || [])
      : (statsData.rawScores || []);
    const byDayActive = {}, byDayGames = {};
    for (const r of fullActive) { if (r.day) { (byDayActive[r.day] = byDayActive[r.day] || new Set()).add(r.player_id); } }
    for (const r of (statsData.rawScores || [])) { if (r.day) { byDayGames[r.day] = (byDayGames[r.day]||0)+1; } }
    // Mêmes jours que ceux qui servent à découper la plage : la ligne
    // « Aujourd'hui » est donc exactement ce que compte la carte du haut en 1 j.
    const days = dayList.map(function(d){
      const set = byDayActive[d];
      let anon = 0; if (set && hasEvents) { set.forEach(function(id){ if(!regSet.has(id)) anon++; }); }
      return { day: d, players: set ? set.size : 0, anon: anon, games: byDayGames[d] || 0 };
    });
    return { range: range, days: days, activeWindow: activeSet.size, anonWindow: anonSet.size,
      gamesWindow: gamesW, duelsWindow: duelsW, playsByMode: playsByMode, totalPlays: totalPlays,
      playsSolo: playsSolo, playsOnline: playsOnline, osCount: osCount, hasEvents: hasEvents,
      players: players, sessions: sessions, timeTotalS: timeTotalS, timePlayers: timePlayers };
  }, [statsData, statsRange]);
  // ─── Android Back Button Handler ──
  // Intercepte la touche retour Android pendant une partie pour éviter de quitter par accident.
  // Pattern double-tap : 1er appui = warning toast, 2e appui (dans 2s) = quitte la partie.
  const backPressRef = useRef({pressed: false, timeoutId: null});
  const [showBackHint, setShowBackHint] = useState(false);
  const [diff, setDiff] = useState("facile");
  const [totalRounds, setTotalRounds] = useState(1); // Toujours 1 manche de 90s (pas de multi-manches)
  const [currentRound, setCurrentRound] = useState(1);
  const [roundScores, setRoundScores] = useState([]);
  const [roomRoundSnapshot, setRoomRoundSnapshot] = useState(null); // scores adversaires fin de manche
  const [record, setRecord] = useState(null);
  const [chainRecord, setChainRecord] = useState(null);
  const [queue, setQueue] = useState([]);
  const [qIdx, setQIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_DURATION);
  const [guess, setGuess] = useState("");
  const [flash, setFlash] = useState(null);
  const [skipOno, setSkipOno] = useState(null); // onomatopée comic affichée quand on passe une question
  const skipOnoTimerRef = useRef(null);
  const [feedback, setFeedback] = useState(null);
  const [options, setOptions] = useState([]);
  const [animKey, setAnimKey] = useState(0);
  const [scoreAnim, setScoreAnim] = useState(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  // Modal de célébration quand l'utilisateur monte en grade
  // Stocke le nouveau grade complet {min, label, labelEn, emoji, color}
  const [gradeUpPopup, setGradeUpPopup] = useState(null);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [comboFloat, setComboFloat] = useState(null);
  const [feedbackPhrase, setFeedbackPhrase] = useState(""); // phrase aléatoire affichée sur bonne réponse
  const [chainPlayer, setChainPlayer] = useState("");
  const [chainUsedClubs, setChainUsedClubs] = useState(new Set());
  const [chainUsedPlayers, setChainUsedPlayers] = useState(new Set());
  const [chainCount, setChainCount] = useState(0);
  const [chainScore, setChainScore] = useState(0);
  const [chainHistory, setChainHistory] = useState([]);
  const [chainMilestone, setChainMilestone] = useState(null); // {n, emoji, color} palier fêté (10/20/30…)
  const chainMsToRef = React.useRef(null);
  const chainCountRef = React.useRef(0); // miroir de chainCount (fiable en fin de partie / timer)
  const [roundAnswers, setRoundAnswers] = useState([]); // Historique questions mode Plug: [{c1, c2, validPlayers, given, status, isSkip}]
  const [showHistory, setShowHistory] = useState(false); // Modal affichage historique
  const [reportingAnswer, setReportingAnswer] = useState(null); // Pour signaler une erreur : {c1, c2, given, validPlayers}
  const [chainLastRejected, setChainLastRejected] = useState(null); // {player, club} pour signaler dans The Mercato
  const [chainReportSent, setChainReportSent] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [reportSent, setReportSent] = useState(false);
  const [chainLastClub, setChainLastClub] = useState("");
  const [chainLastPassed, setChainLastPassed] = useState(false); // true si le club lien a été passé (à cacher avec cadenas)
  const [leaderboard, setLeaderboard] = useState([]);
  const [hallOfFame, setHallOfFame] = useState([]);
  const [showHallOfFame, setShowHallOfFame] = useState(false);
  const [myLbRank, setMyLbRank] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false); // Bannière de bienvenue RGPD au 1er lancement
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(0); // 0=closed, 1=first warning, 2=final confirm

  const [myLastPts, setMyLastPts] = useState(null);
  const [winStreak, setWinStreak] = useState(0);
  const [wasAway, setWasAway] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);
  // États pour l'installation de l'app
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  // Ref (pas un state) pour tracker le dismiss dans la session : reset à chaque rechargement de l'app
  // On met un ref pour ne pas retrigger le useEffect à chaque changement
  const installDismissedThisSession = useRef(false);
  const [deferredInstall, setDeferredInstall] = useState(null); // Pour Android: l'event beforeinstallprompt
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [lbMode, setLbMode] = useState("global");
  const [lbSeasonScope, setLbSeasonScope] = useState("monde"); // "monde" ou "amis" pour l'onglet Saison
  const [dailyPlayer, setDailyPlayer] = useState(() => getDailyPlayer(new Set()));
  const [dailyDone, setDailyDone] = useState(() => {
    try {
      const d = JSON.parse(localStorage.getItem("bb_daily_result")||"{}");
      return d.date === (()=>{ const d=new Date(); const paris=new Date(d.toLocaleString('en-US',{timeZone:'Europe/Paris'})); return paris.getFullYear()+'-'+String(paris.getMonth()+1).padStart(2,'0')+'-'+String(paris.getDate()).padStart(2,'0'); })();
    } catch { return false; }
  });
  const [dailyAbandoned, setDailyAbandoned] = useState(() => {
    try {
      const d = JSON.parse(localStorage.getItem("bb_daily_result")||"{}");
      return d.date === (()=>{ const d=new Date(); const paris=new Date(d.toLocaleString('en-US',{timeZone:'Europe/Paris'})); return paris.getFullYear()+'-'+String(paris.getMonth()+1).padStart(2,'0')+'-'+String(paris.getDate()).padStart(2,'0'); })() && d.abandoned === true;
    } catch { return false; }
  });
  // Révélé = user a cliqué "Voir la réponse" (différent d'abandon : on affiche le nom, 0 point, streak maintenue)
  const [dailyRevealed, setDailyRevealed] = useState(() => {
    try {
      const d = JSON.parse(localStorage.getItem("bb_daily_result")||"{}");
      return d.date === (()=>{ const d=new Date(); const paris=new Date(d.toLocaleString('en-US',{timeZone:'Europe/Paris'})); return paris.getFullYear()+'-'+String(paris.getMonth()+1).padStart(2,'0')+'-'+String(paris.getDate()).padStart(2,'0'); })() && d.revealed === true;
    } catch { return false; }
  });
  const [showRevealConfirm, setShowRevealConfirm] = useState(false);
  const [showDailyReportConfirm, setShowDailyReportConfirm] = useState(false);
  const [dailyReportSent, setDailyReportSent] = useState(false);
  const [dailyTries, setDailyTries] = useState(() => {
    try {
      const d = JSON.parse(localStorage.getItem("bb_daily_hint")||"{}");
      const today = (()=>{ const x=new Date(); const p=new Date(x.toLocaleString('en-US',{timeZone:'Europe/Paris'})); return p.getFullYear()+'-'+String(p.getMonth()+1).padStart(2,'0')+'-'+String(p.getDate()).padStart(2,'0'); })();
      return (d.date === today && typeof d.tries === "number") ? d.tries : 0;
    } catch { return 0; }
  });
  const [dailyGuess, setDailyGuess] = useState("");
  const [dailyFlash, setDailyFlash] = useState(null);
  const [dailyHintLevel, setDailyHintLevel] = useState(() => {
    try {
      const d = JSON.parse(localStorage.getItem("bb_daily_hint")||"{}");
      const today = (()=>{ const x=new Date(); const p=new Date(x.toLocaleString('en-US',{timeZone:'Europe/Paris'})); return p.getFullYear()+'-'+String(p.getMonth()+1).padStart(2,'0')+'-'+String(p.getDate()).padStart(2,'0'); })();
      return (d.date === today && typeof d.level === "number") ? d.level : 0;
    } catch { return 0; }
  });
  const [dailyHintData, setDailyHintData] = useState(() => {
    try {
      const d = JSON.parse(localStorage.getItem("bb_daily_hint")||"{}");
      const today = (()=>{ const x=new Date(); const p=new Date(x.toLocaleString('en-US',{timeZone:'Europe/Paris'})); return p.getFullYear()+'-'+String(p.getMonth()+1).padStart(2,'0')+'-'+String(p.getDate()).padStart(2,'0'); })();
      if (d.date === today && d.data) return { position: d.data.position || null, nationality: d.data.nationality || null, loading: false };
    } catch {}
    return { position: null, nationality: null, loading: false };
  });
  const [dailyUsedHint, setDailyUsedHint] = useState(() => {
    try {
      const d = JSON.parse(localStorage.getItem("bb_daily_hint")||"{}");
      const today = (()=>{ const x=new Date(); const p=new Date(x.toLocaleString('en-US',{timeZone:'Europe/Paris'})); return p.getFullYear()+'-'+String(p.getMonth()+1).padStart(2,'0')+'-'+String(p.getDate()).padStart(2,'0'); })();
      return d.date === today && d.used === true;
    } catch { return false; }
  });
  const [dailySuccess, setDailySuccess] = useState(false);
  const [dailyShared, setDailyShared] = useState(false); // Feedback après partage du défi du jour
  const [showDailyGame, setShowDailyGame] = useState(false);
  
  // ─── GOAT GRID States ───────────────────────────────────────
  const [showGoatGrid, setShowGoatGrid] = useState(false);
  const [ggGrid, setGgGrid] = useState(null); // { rowCriteria, colCriteria, cells }
  const [ggFilledCells, setGgFilledCells] = useState({}); // { "0-0": { name, pts, rarity }, "1-2": ... }
  const [ggUsedPlayers, setGgUsedPlayers] = useState(new Set()); // joueurs déjà placés
  const [ggLives, setGgLives] = useState(3);
  const [ggScore, setGgScore] = useState(0);
  const [ggGameOver, setGgGameOver] = useState(false); // true quand 0 vies OU grille pleine
  const [ggSelectedCell, setGgSelectedCell] = useState(null); // { row, col } ou null
  const [ggGuess, setGgGuess] = useState("");
  const [ggFlash, setGgFlash] = useState(null); // null | 'ok' | 'ko'
  const [ggFlashCell, setGgFlashCell] = useState(null); // { row, col } pour animation
  const [ggShowTooltip, setGgShowTooltip] = useState(null); // { title, text } ou null
  const [ggShareCopied, setGgShareCopied] = useState(false);
  const [ggError, setGgError] = useState(false); // true si l'algo n'a pas pu générer
  const [ggDemo, setGgDemo] = useState(ggIsDemo); // mode démo vidéo : grille fixe + feuille de réponses
  const ggTapRef = React.useRef({ count: 0, last: 0 }); // 5 taps rapides sur le titre → bascule le mode démo (fiable sur iOS)
  // 0 = seed du jour, sinon seed forcé. En démo → seed FIXE (grille reproductible, pas de save/submit).
  const [ggOverrideSeed, setGgOverrideSeed] = useState(ggIsDemo() ? GG_DEMO_SEED : 0);
  const [ggLastRejected, setGgLastRejected] = useState(null); // { playerName, rowCrit, colCrit } pour signaler
  const [ggReportSent, setGgReportSent] = useState(false); // confirmation visuelle après envoi
  const [ggReviewMode, setGgReviewMode] = useState(false); // true = on cache le modal de fin pour revoir la grille
  // Leaderboard
  const [ggLeaderboardTab, setGgLeaderboardTab] = useState("global"); // "global" | "friends"
  const [ggLeaderboardData, setGgLeaderboardData] = useState({ global: [], friends: [] });
  const [ggLeaderboardLoading, setGgLeaderboardLoading] = useState(false);
  const [ggScoreSaved, setGgScoreSaved] = useState(false);
  // Statut de la grille du jour (pour l'accueil)
  const [ggTodayResult, setGgTodayResult] = useState(null); // { score, max_score, cells_filled } si déjà jouée
  const [ggRevealMode, setGgRevealMode] = useState(false); // true = on peut cliquer les cases pour voir les réponses possibles
  const [ggRevealCell, setGgRevealCell] = useState(null); // cellule dont on regarde les réponses
  // ─── GOAT BATTLE (multijoueur) ───────────────────────────────
  const [ggBattleScreen, setGgBattleScreen] = useState(null); // null | "menu" | "lobby" | "playing" | "finished"
  const [ggBattleRoom, setGgBattleRoom] = useState(null); // { id, code, host_id, state, seed, players, started_at, winner_id, winner_name }
  const [ggBattleCode, setGgBattleCode] = useState(""); // code saisi pour rejoindre
  const [ggBattleError, setGgBattleError] = useState("");
  const [ggBattleTimer, setGgBattleTimer] = useState(120); // 2 min en secondes
  const ggBattleBonusRef = React.useRef(0); // secondes bonus accumulées (+2s par bonne réponse)
  const [ggBattleCountdown, setGgBattleCountdown] = useState(0); // 5..1 avant départ, 0 = en jeu
  const [ggBattleViewGrid, setGgBattleViewGrid] = useState(null); // {player, room} pour voir la grille d'un joueur
  const [reviewRoundsModal, setReviewRoundsModal] = useState(null); // {mode:"pont"|"chaine", playerName, rounds:[...]} ou null
  // Devinette du jour : l'overlay vit dans Index.tsx, on n'a ici que son état
  // (jouée aujourd'hui ? série en cours ?). On le rafraîchit à la fermeture de
  // l'overlay et quand l'app revient au premier plan (changement de jour).
  const [dailyRiddle, setDailyRiddle] = useState(readDailyRiddle);
  useEffect(function() {
    const refresh = function(){ setDailyRiddle(readDailyRiddle()); };
    window.addEventListener("goatfc:devinette-closed", refresh);
    document.addEventListener("visibilitychange", refresh);
    return function() {
      window.removeEventListener("goatfc:devinette-closed", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  const [ggModeChoice, setGgModeChoice] = useState(false); // modal de choix solo/multi pour GOAT GRID
  const [ggBattleLoading, setGgBattleLoading] = useState(false);
  // Partie rapide GOAT Battle : adversaire simulé, room locale (id "LOCAL"),
  // aucun appel Supabase. Le bot remplit réellement sa grille case par case
  // pendant les 2 minutes — le classement final permet de consulter sa grille,
  // donc un simple compteur ne suffirait pas.
  const ggBattleBotRef = React.useRef(null); // { id, plan:[{atSec, cellKey, name, pts, rarity}], next }

  // ─── GOAT DUEL — Plug temps réel 1v1 (5 manches) ─────────────
  const [duelScreen, setDuelScreen] = useState(null);   // null | "menu" | "lobby" | "playing" | "finished"
  const [duelRoom, setDuelRoom] = useState(null);        // ligne bb_duel_rooms
  const [duelJoinCode, setDuelJoinCode] = useState("");  // code saisi pour rejoindre
  const [duelError, setDuelError] = useState("");
  const [duelBusy, setDuelBusy] = useState(false);
  const [duelInput, setDuelInput] = useState("");        // saisie du joueur (phase réponse)
  const [duelNow, setDuelNow] = useState(0);             // horloge locale (tick) pour les décomptes
  const [duelSpin, setDuelSpin] = useState(false);       // animation "machine à sous" en cours
  const [duelReel1, setDuelReel1] = useState(null);      // club défilant (reel du haut) pendant le spin
  const [duelReel2, setDuelReel2] = useState(null);      // club défilant (reel du bas) pendant le spin
  const [duelWrong, setDuelWrong] = useState(false);     // flash "mauvaise réponse"
  const duelWrongToRef = React.useRef(null);
  const duelRoomRef = React.useRef(null);                // room live pour le séquenceur (host)
  const duelAnswerShownAtRef = React.useRef(0);          // Date.now() quand la paire s'est affichée (mesure réaction)
  const duelAnsweredRef = React.useRef(false);           // a déjà répondu correctement cette manche ?
  const duelSeqBusyRef = React.useRef(false);            // évite les transitions concurrentes (host)
  const duelSpinIvRef = React.useRef(null);              // interval du reel
  const duelTickRef = React.useRef(0);                   // dernière seconde "tic-tac" jouée
  const [duelFlash, setDuelFlash] = useState(null);      // solo : "+20 PTS" flottant entre 2 manches
  const duelFlashToRef = React.useRef(null);
  const [duelCodeCopied, setDuelCodeCopied] = useState(false); // lobby : feedback "code copié"
  const [duelBigAnswer, setDuelBigAnswer] = useState(null);    // nom affiché en GROS à chaque bonne réponse (~1,2 s)
  const duelBigAnswerToRef = React.useRef(null);
  // Détection du clavier (iOS/Android) via visualViewport → passe en layout COMPACT
  // pour que les 2 clubs restent visibles quand le clavier est ouvert.
  const [duelKbOpen, setDuelKbOpen] = useState(false);
  const [duelVV, setDuelVV] = useState(null); // {height, top} de la zone visible quand clavier ouvert
  useEffect(function(){
    if (duelScreen !== "playing") { setDuelKbOpen(false); setDuelVV(null); return; }
    const vv = window.visualViewport;
    if (!vv) return;
    const onR = function(){
      const open = (window.innerHeight - vv.height) > 120;
      setDuelKbOpen(open);
      setDuelVV(open ? { height: Math.round(vv.height), top: Math.round(vv.offsetTop || 0) } : null);
    };
    vv.addEventListener("resize", onR);
    vv.addEventListener("scroll", onR);
    onR();
    return function(){ vv.removeEventListener("resize", onR); vv.removeEventListener("scroll", onR); };
  }, [duelScreen]);
  // Partage / copie du code de salon (Web Share si dispo, sinon presse-papiers)
  function duelShareCode(code){
    const url = (function(){ try { return window.location.origin; } catch { return "https://goatfc.fr"; } })();
    const txt = tr(
      "Rejoins mon GOAT DUEL ! Code : "+code+" — "+url,
      "Join my GOAT DUEL! Code: "+code+" — "+url,
      "Tritt meinem GOAT DUEL bei! Code: "+code+" — "+url,
      "Unisciti al mio GOAT DUEL! Codice: "+code+" — "+url,
      "Entre no meu GOAT DUEL! Código: "+code+" — "+url);
    try {
      if (navigator.share) { navigator.share({ title:"GOAT DUEL", text:txt }).catch(function(){}); return; }
    } catch(e){}
    try {
      navigator.clipboard.writeText(code).then(function(){
        setDuelCodeCopied(true);
        setTimeout(function(){ setDuelCodeCopied(false); }, 1800);
      }).catch(function(){});
    } catch(e){}
  }

  function duelGenCode(){
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans I/O/0/1
    let c = ""; for(let i=0;i<6;i++) c += chars[Math.floor(Math.random()*chars.length)];
    return c;
  }
  async function duelPatch(id, obj){
    // Mode bot : salon 100% local, pas de base de données
    if(id==="LOCAL"){
      const cur = duelRoomRef.current || {};
      const next = Object.assign({}, cur, obj);
      duelRoomRef.current = next; setDuelRoom(next);
      return next;
    }
    return sbFetch("bb_duel_rooms?id=eq."+id, {
      method:"PATCH",
      headers:{ "Content-Type":"application/json", "Prefer":"return=minimal" },
      body: JSON.stringify(Object.assign({}, obj, { updated_at:new Date().toISOString() })),
    });
  }
  function duelIsHost(){ const r = duelRoomRef.current || duelRoom; return !!(r && r.host_id === playerId); }

  async function duelCreateRoom(){
    if(!playerId || !playerName){ setDuelError(tr("Connecte-toi d'abord","Log in first","Melde dich zuerst an","Accedi prima","Faça login primeiro")); return; }
    setDuelBusy(true); setDuelError("");
    try{
      let lastErr=null;
      for(let att=0; att<5; att++){
        const code = duelGenCode();
        try{
          const res = await fetch(SB_URL + "/rest/v1/bb_duel_rooms", {
            method:"POST",
            headers:{ "apikey":SB_KEY, "Authorization":"Bearer "+SB_KEY, "Content-Type":"application/json", "Prefer":"return=representation" },
            body: JSON.stringify({ code:code, host_id:playerId, host_name:playerName, state:"lobby", phase:"wait", round:0, host_score:0, guest_score:0 }),
          });
          if(!res.ok){ lastErr = "HTTP "+res.status+" "+(await res.text()); if(res.status===409) continue; break; }
          const data = await res.json();
          if(Array.isArray(data) && data[0]){ duelRoomRef.current=data[0]; setDuelRoom(data[0]); setDuelScreen("lobby"); return; }
          lastErr="no data";
        } catch(e){ lastErr = e.message||String(e); }
      }
      setDuelError((tr("Erreur création : ","Could not create: ","Erstellen fehlgeschlagen: ","Errore di creazione: ","Erro ao criar: "))+(lastErr||"?"));
    } finally { setDuelBusy(false); }
  }

  async function duelJoinRoom(rawCode){
    if(!playerId || !playerName){ setDuelError(tr("Connecte-toi d'abord","Log in first","Melde dich zuerst an","Accedi prima","Faça login primeiro")); return; }
    const code = (rawCode||"").trim().toUpperCase();
    if(code.length!==6){ setDuelError(tr("Code à 6 caractères","6-char code","6-stelliger Code","Codice di 6 caratteri","Código de 6 caracteres")); return; }
    setDuelBusy(true); setDuelError("");
    try{
      const data = await sbFetch("bb_duel_rooms?code=eq."+code+"&limit=1");
      if(!Array.isArray(data) || data.length===0){ setDuelError(tr("Salon introuvable","Room not found","Raum nicht gefunden","Stanza non trovata","Sala não encontrada")); return; }
      const room = data[0];
      if(room.host_id===playerId){ duelRoomRef.current=room; setDuelRoom(room); setDuelScreen("lobby"); return; }
      if(room.guest_id && room.guest_id!==playerId){ setDuelError(tr("Salon complet","Room is full","Raum ist voll","Stanza piena","Sala cheia")); return; }
      if(room.state!=="lobby"){ setDuelError(tr("Partie déjà lancée","Already started","Bereits gestartet","Già iniziata","Já começou")); return; }
      await duelPatch(room.id, { guest_id:playerId, guest_name:playerName });
      const fresh = Object.assign({}, room, { guest_id:playerId, guest_name:playerName });
      duelRoomRef.current=fresh; setDuelRoom(fresh); setDuelScreen("lobby");
    } finally { setDuelBusy(false); }
  }

  async function duelLeaveRoom(){
    const r = duelRoomRef.current || duelRoom;
    try{
      if(r && r.id && r.id!=="LOCAL"){ // le salon bot est purement local
        if(r.host_id===playerId){ await sbFetch("bb_duel_rooms?id=eq."+r.id, { method:"DELETE", headers:{ "Prefer":"return=minimal" } }); }
        else { await duelPatch(r.id, { guest_id:null, guest_name:null }); }
      }
    } catch(e){}
    duelRoomRef.current=null; setDuelRoom(null); setDuelScreen(null); setDuelInput(""); setDuelJoinCode(""); setDuelError(""); setDuelFlash(null);
    duelAnsweredRef.current=false;
  }

  async function duelHostStart(){
    const r = duelRoomRef.current || duelRoom;
    if(!r || r.host_id!==playerId || !r.guest_id) return;
    sndCtx(); // débloque l'audio (geste utilisateur)
    trackPlay("battle", true); // GOAT Battle en ligne (1v1 entre potes)
    const [c1, c2] = duelRollPair(); // le système tire 2 clubs au hasard
    // On démarre par une phase "countdown" (3..2..1) synchronisée via phase_at,
    // puis le séquenceur bascule en "answer".
    await duelPatch(r.id, { state:"playing", round:1, phase:"countdown", phase_at:new Date().toISOString(),
      club_c1:c1, club_c2:c2,
      host_answer:null, guest_answer:null, host_answer_ms:null, guest_answer_ms:null, round_winner:null,
      host_score:0, guest_score:0, winner_id:null, winner_name:null });
  }

  // Démarre une partie SOLO (contre soi-même, système de points) — 100% local
  function duelSoloStart(){
    sndCtx(); // débloque l'audio (geste utilisateur)
    trackPlay("battle"); // GOAT Battle solo (contre soi-même)
    const [c1, c2] = duelRollPair();
    const room = {
      id:"LOCAL", code:"SOLO", solo:true,
      host_id:playerId, host_name:playerName||"Toi",
      guest_id:null, guest_name:null,
      state:"playing", round:1, phase:"answer", phase_at:new Date().toISOString(),
      solo_ends_at:new Date(Date.now()+DUEL_SOLO_SECS*1000).toISOString(), // 90 s au total
      club_c1:c1, club_c2:c2,
      host_answer:null, host_answer_ms:null, round_pts:null,
      host_score:0, host_correct:0, host_fast:0, host_rounds:0,
    };
    duelRoomRef.current = room; setDuelRoom(room);
    setDuelScreen("playing");
  }

  // ─── GOAT DUEL — PARTIE RAPIDE (adversaire simulé) ───────────────
  // Réutilise tel quel le moteur solo (room LOCAL, chrono global de 90 s,
  // manches illimitées) et lui ajoute un adversaire dont le score monte pendant
  // la partie. L'écran de duel affiche déjà oppScore en direct, donc le bot doit
  // marquer au fil du temps — un score plaqué à la fin se verrait.
  const duelBotRef = React.useRef(null); // { plan:[ms], next:0 }

  function duelBuildBotPlan() {
    // 10 pts par bonne réponse, 20 si < 5 s. Un joueur correct tourne autour de
    // 60-140 pts sur 90 s : on vise cette fourchette, jamais une machine.
    const plan = [];
    let t = 4000 + Math.random() * 6000;         // première réponse : 4-10 s
    while (t < DUEL_SOLO_SECS * 1000 - 2000) {
      plan.push({ at: Math.round(t), pts: Math.random() < 0.35 ? 20 : 10 });
      t += 6000 + Math.random() * 9000;          // 6-15 s entre deux réponses
    }
    return plan;
  }

  function duelQuickStart(opponent) {
    sndCtx();
    trackPlay("battle");
    const [c1, c2] = duelRollPair();
    duelBotRef.current = { plan: duelBuildBotPlan(), next: 0, startMs: Date.now() };
    const room = {
      id:"LOCAL", code:"QUICK", solo:true, bot:true,
      host_id:playerId, host_name:playerName||tr("Toi","You","Du","Tu","Você"),
      guest_id:"BOT", guest_name:opponent.pseudo, guest_country:opponent.country, guest_avatar:opponent.avatar,
      state:"playing", round:1, phase:"answer", phase_at:new Date().toISOString(),
      solo_ends_at:new Date(Date.now()+DUEL_SOLO_SECS*1000).toISOString(),
      club_c1:c1, club_c2:c2,
      host_answer:null, host_answer_ms:null, round_pts:null,
      host_score:0, host_correct:0, host_fast:0, host_rounds:0,
      guest_score:0,
    };
    duelRoomRef.current = room; setDuelRoom(room);
    setDuelScreen("playing");
  }

  function duelSubmitAnswer(nameOverride){
    const r = duelRoomRef.current || duelRoom;
    if(!r || r.phase!=="answer" || duelAnsweredRef.current) return;
    const g = (nameOverride!=null ? nameOverride : (duelInput||"")).trim();
    if(g.length<3) return;
    const common = duelCommonPlayers(r.club_c1, r.club_c2);
    if(checkGuess(g, common)){
      duelAnsweredRef.current = true;
      playSound("ok"); vibrate(30);
      // Affiche le NOM du joueur en gros (pour la vidéo) — nom canonique de la base,
      // avec les points gagnés (solo) pour ne pas empiler 2 overlays.
      const ms = Math.max(0, Date.now() - (duelAnswerShownAtRef.current || Date.now()));
      const shown = common.find(function(n){ return checkGuess(g, [n]); }) || g;
      setDuelBigAnswer({ name: shown, pts: r.solo ? (ms < 5000 ? 20 : 10) : null });
      if(duelBigAnswerToRef.current) clearTimeout(duelBigAnswerToRef.current);
      duelBigAnswerToRef.current = setTimeout(function(){ setDuelBigAnswer(null); }, 1200);
      const mine = r.host_id===playerId ? { host_answer:g, host_answer_ms:ms } : { guest_answer:g, guest_answer_ms:ms };
      duelRoomRef.current = Object.assign({}, r, mine); setDuelRoom(duelRoomRef.current);
      duelPatch(r.id, mine);
      setDuelInput("");
      setDuelWrong(false);
    } else {
      // mauvaise réponse : feedback rouge + son, on efface, le chrono continue
      playSound("ko"); vibrate([40,40,40]);
      setDuelInput("");
      setDuelWrong(true);
      if(duelWrongToRef.current) clearTimeout(duelWrongToRef.current);
      duelWrongToRef.current = setTimeout(function(){ setDuelWrong(false); }, 1400);
    }
  }

  // SOLO : passer la manche (0 pt) quand on ne sait pas → le séquenceur enchaîne direct
  function duelSkip(){
    const r = duelRoomRef.current || duelRoom;
    if(!r || !r.solo || r.phase!=="answer" || duelAnsweredRef.current) return;
    duelAnsweredRef.current = true;
    setDuelInput(""); setDuelWrong(false);
    duelPatch("LOCAL", { host_skip:true });
  }

  // SOLO : résout la manche (points en flash) et passe DIRECT à la suivante (pas d'écran pause).
  // Manches ILLIMITÉES : on enchaîne tant que le chrono global (60 s) n'est pas écoulé.
  function duelSoloNext(room, pts, skipped){
    const newScore = (room.host_score||0) + pts;
    // Stats de fin de partie : bonnes réponses, réponses éclair (< 5 s = 20 pts), manches jouées
    const newCorrect = (room.host_correct||0) + (pts>0 ? 1 : 0);
    const newFast = (room.host_fast||0) + (pts>=20 ? 1 : 0);
    const newRounds = (room.host_rounds||0) + 1;
    // Bonne réponse (pts>0) → l'overlay "nom + points" s'en charge (évite le doublon).
    // Manche ratée/passée (pts=0) → petit flash RATÉ/PASSÉ.
    if(pts <= 0){
      setDuelFlash({ pts:pts, skipped:!!skipped, id:(room.round||1)+"-"+Date.now() });
      if(duelFlashToRef.current) clearTimeout(duelFlashToRef.current);
      duelFlashToRef.current = setTimeout(function(){ setDuelFlash(null); }, 1300);
    }
    const timeUp = room.solo_ends_at && Date.now() >= new Date(room.solo_ends_at).getTime();
    const stats = { host_score:newScore, host_correct:newCorrect, host_fast:newFast, host_rounds:newRounds };
    if(timeUp){
      duelPatch("LOCAL", Object.assign({ state:"finished", phase:"done", winner_id:room.host_id }, stats));
    } else {
      const [c1, c2] = duelRollPair();
      duelPatch("LOCAL", Object.assign({ round:(room.round||1)+1, phase:"answer", phase_at:new Date().toISOString(),
        club_c1:c1, club_c2:c2, host_answer:null, host_answer_ms:null, round_pts:null, round_skipped:false, host_skip:false }, stats));
    }
  }

  // Séquenceur : SEUL l'hôte fait avancer les phases (évite les conflits d'écriture)
  async function duelHostTick(room){
    if(!room || room.host_id!==playerId || room.state!=="playing") return;
    if(duelSeqBusyRef.current) return;
    const now = Date.now();
    const phaseAt = room.phase_at ? new Date(room.phase_at).getTime() : 0;
    const el = now - phaseAt;
    try{
      // SOLO : fin de partie sur le chrono GLOBAL (60 s), pas de limite par manche.
      if(room.solo && room.solo_ends_at && now >= new Date(room.solo_ends_at).getTime()){
        duelSeqBusyRef.current=true;
        // Partie rapide : le vainqueur se décide au score. En solo pur il n'y a
        // pas d'adversaire, donc le joueur reste vainqueur par défaut.
        let winner = room.host_id;
        if (room.bot) {
          const hs = room.host_score||0, gs = room.guest_score||0;
          winner = hs > gs ? room.host_id : (gs > hs ? room.guest_id : null);
        }
        await duelPatch("LOCAL", { state:"finished", phase:"done", winner_id:winner });
        return;
      }
      if(room.phase==="countdown"){
        // Compte à rebours de départ (3 s) → on lance la 1re manche (phase "answer").
        if(el >= 3000){
          duelSeqBusyRef.current=true;
          await duelPatch(room.id, { phase:"answer", phase_at:new Date().toISOString() });
        }
      } else if(room.phase==="answer"){
        // fenêtre de réponse (multi) = après le tirage machine à sous + 10s (+ marge)
        const timeUp = el >= (DUEL_SPIN_MS + DUEL_ANSWER_SECS*1000 + 1200);
        if(room.solo){
          // SOLO : 10 pts / bonne réponse, 20 pts si < 5 s. Pas de limite de temps par
          // manche : on résout dès qu'on répond ou qu'on passe, et on enchaîne direct.
          const hm = room.host_answer_ms;
          const skipped = room.host_skip;
          if(hm!=null || skipped){
            duelSeqBusyRef.current=true;
            const pts = skipped ? 0 : (hm!=null ? (hm < 5000 ? 20 : 10) : 0);
            duelSoloNext(room, pts, !!skipped);
          }
        } else {
          const hm = room.host_answer_ms, gm = room.guest_answer_ms;
          const someone = (hm!=null) || (gm!=null);
          if(someone || timeUp){
            duelSeqBusyRef.current=true;
            let winner="draw";
            if(hm!=null && gm!=null) winner = (hm<=gm)?"host":"guest";
            else if(hm!=null) winner="host";
            else if(gm!=null) winner="guest";
            let hs=room.host_score||0, gs=room.guest_score||0;
            if(winner==="host") hs++; else if(winner==="guest") gs++;
            await duelPatch(room.id, { phase:"result", phase_at:new Date().toISOString(), round_winner:winner, host_score:hs, guest_score:gs });
          }
        }
      } else if(room.phase==="result"){
        if(el >= DUEL_RESULT_SECS*1000){
          duelSeqBusyRef.current=true;
          if((room.round||1) < DUEL_ROUNDS){
            const [c1, c2] = duelRollPair(); // nouvelle paire aléatoire
            // NOTE: round_pts / round_skipped n'existent PAS dans bb_duel_rooms
            // (champs SOLO uniquement, patchés en LOCAL). Les envoyer ici faisait
            // échouer le PATCH (400) → la manche suivante ne se lançait jamais en 1v1.
            await duelPatch(room.id, { round:(room.round||1)+1, phase:"answer", phase_at:new Date().toISOString(),
              club_c1:c1, club_c2:c2, host_pick:null, guest_pick:null,
              host_answer:null, guest_answer:null, host_answer_ms:null, guest_answer_ms:null, round_winner:null });
          } else if(room.solo){
            await duelPatch(room.id, { state:"finished", phase:"done", winner_id:room.host_id });
          } else {
            const hs=room.host_score||0, gs=room.guest_score||0;
            let wid=null, wname=null;
            if(hs>gs){ wid=room.host_id; wname=room.host_name; }
            else if(gs>hs){ wid=room.guest_id; wname=room.guest_name; }
            await duelPatch(room.id, { state:"finished", phase:"done", winner_id:wid, winner_name:wname });
          }
        }
      }
    } catch(e){ /* ignore, on réessaiera au prochain poll */ }
    finally { duelSeqBusyRef.current=false; }
  }

  // Polling du salon (hôte + invité) — désactivé en mode bot (local)
  useEffect(function(){
    const rid = duelRoom && duelRoom.id;
    if(!rid || rid==="LOCAL") return;
    if(duelScreen!=="lobby" && duelScreen!=="playing" && duelScreen!=="finished") return;
    let stop=false;
    async function poll(){
      if(stop) return;
      const data = await sbFetch("bb_duel_rooms?id=eq."+rid+"&limit=1");
      if(stop) return;
      if(Array.isArray(data) && data.length===0){
        // salon supprimé (hôte parti) → l'invité revient au menu
        if(duelRoomRef.current && duelRoomRef.current.host_id!==playerId){
          duelRoomRef.current=null; setDuelRoom(null); setDuelScreen(null);
          setDuelError(tr("L'hôte a quitté le salon","Host left the room","Host hat den Raum verlassen","L'host ha lasciato la stanza","O anfitrião saiu da sala"));
        }
        return;
      }
      if(Array.isArray(data) && data[0]){
        const fresh=data[0];
        duelRoomRef.current=fresh; setDuelRoom(fresh);
        if(fresh.state==="playing") setDuelScreen(function(s){ return s==="finished"?s:"playing"; });
        if(fresh.state==="finished") setDuelScreen("finished");
        duelHostTick(fresh);
      }
    }
    poll();
    const iv=setInterval(poll, 800);
    return function(){ stop=true; clearInterval(iv); };
  }, [duelRoom && duelRoom.id, duelScreen]);

  // Mode SOLO : séquenceur local (remplace le polling) — fait avancer les phases
  useEffect(function(){
    if(!(duelRoom && duelRoom.id==="LOCAL" && duelScreen==="playing")) return;
    const iv=setInterval(function(){
      const r=duelRoomRef.current;
      if(r && r.state==="finished"){ setDuelScreen("finished"); return; }
      duelHostTick(r);
    }, 200);
    return function(){ clearInterval(iv); };
  }, [duelScreen, duelRoom && duelRoom.id]);

  // Entrée en phase "réponse" : animation machine à sous puis révélation.
  // Le chrono de réaction démarre APRÈS l'arrêt des rouleaux (quand les
  // clubs sont lisibles), identique pour les 2 joueurs (durée fixe).
  useEffect(function(){
    if(!(duelRoom && duelRoom.phase==="answer")) return;
    duelAnsweredRef.current = false;
    setDuelInput("");
    setDuelWrong(false);
    setDuelSpin(true);
    if(duelSpinIvRef.current){ clearTimeout(duelSpinIvRef.current); duelSpinIvRef.current=null; }
    const spinMs = (duelRoom && duelRoom.solo) ? DUEL_SOLO_SPIN_MS : DUEL_SPIN_MS;
    const rand = function(){ return DUEL_CLUBS[Math.floor(Math.random()*DUEL_CLUBS.length)]; };
    setDuelReel1(rand()); setDuelReel2(rand());
    const start = Date.now();
    let stopped = false;
    function tick(){
      if(stopped) return;
      const elapsed = Date.now() - start;
      if(elapsed >= spinMs){
        setDuelSpin(false);
        duelAnswerShownAtRef.current = Date.now(); // réaction mesurée à partir d'ici
        playSound("spinstop"); vibrate(60); // son d'arrêt de la machine à sous
        return;
      }
      setDuelReel1(rand()); setDuelReel2(rand());
      playSound("tick"); // clic machine à sous à chaque rotation
      // décélération : les rouleaux ralentissent en approchant de la fin
      const pr = elapsed / spinMs; // 0 → 1
      const delay = 80 + pr*pr*300;      // ~80ms au départ → ~380ms à la fin
      duelSpinIvRef.current = setTimeout(tick, delay);
    }
    duelSpinIvRef.current = setTimeout(tick, 100);
    return function(){
      stopped = true;
      if(duelSpinIvRef.current){ clearTimeout(duelSpinIvRef.current); duelSpinIvRef.current=null; }
    };
  }, [duelRoom && duelRoom.phase, duelRoom && duelRoom.round]);

  // Horloge locale pour les décomptes (250ms)
  useEffect(function(){
    if(duelScreen!=="playing") return;
    const iv=setInterval(function(){ setDuelNow(Date.now()); }, 250);
    return function(){ clearInterval(iv); };
  }, [duelScreen]);
  // Tic-tac quand le chrono de réponse passe sous 3 s (une fois par seconde)
  useEffect(function(){
    const r = duelRoom;
    if(!r || duelScreen!=="playing" || r.phase!=="answer" || duelSpin){ duelTickRef.current=0; return; }
    // SOLO : tic-tac sur le chrono global (fin de partie). Multi : sur le chrono de manche.
    if(!r.solo && duelAnsweredRef.current){ duelTickRef.current=0; return; }
    const now = duelNow || Date.now();
    const left = r.solo
      ? (r.solo_ends_at ? Math.ceil((new Date(r.solo_ends_at).getTime() - now)/1000) : 99)
      : Math.ceil(DUEL_ANSWER_SECS - (now - (duelAnswerShownAtRef.current || now))/1000);
    if(left<=3 && left>0){
      if(left!==duelTickRef.current){ duelTickRef.current=left; playSound("clocktick"); vibrate(20); }
    } else {
      duelTickRef.current=0;
    }
  }, [duelNow, duelScreen, duelRoom && duelRoom.phase, duelSpin]);
  // Ref pour avoir les valeurs LIVE du joueur (utilisé par le timer qui capture des closures)
  const ggBattleStateRef = React.useRef({ filledCells: {}, score: 0, lives: 3, submitted: false });
  
  // Restaurer la grille du jour depuis localStorage
  function ggLoadFromStorage() {
    try {
      // Si on est en mode override, on ne charge pas la sauvegarde du jour (partie de test indépendante)
      if (ggOverrideSeed) return null;
      const todaySeed = ggGetDailySeed();
      const saved = JSON.parse(localStorage.getItem("goatfc_gg_state") || "{}");
      if (saved.seed === todaySeed) return saved; // partie d'aujourd'hui en cours
    } catch {}
    return null;
  }
  
  // Sauvegarder l'état de la grille du jour
  function ggSaveToStorage() {
    try {
      // Si on est en mode override, on ne sauvegarde pas (partie de test indépendante)
      if (ggOverrideSeed) return;
      const state = {
        seed: ggGetDailySeed(),
        filledCells: ggFilledCells,
        usedPlayers: Array.from(ggUsedPlayers),
        lives: ggLives,
        score: ggScore,
        gameOver: ggGameOver,
      };
      localStorage.setItem("goatfc_gg_state", JSON.stringify(state));
    } catch {}
  }
  
  // ─── Leaderboard GOAT GRID ────────────────────────────────────
  // Sauvegarde le score du jour dans Supabase (uniquement si vraie grille du jour)
  async function ggSaveScore(score, maxScore, livesLeft, cellsFilled, pattern) {
    if (ggOverrideSeed > 0) return; // pas de save en mode test
    if (!playerId || !playerName) return;
    if (ggScoreSaved) return; // déjà sauvegardé
    
    try {
      const today = ggGetTodayDateStr();
      // Upsert : on remplace l'ancien score si le joueur rejoue (mais devrait pas pouvoir)
      await sbFetch("bb_gg_scores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          player_id: playerId,
          player_name: playerName,
          score: score,
          max_score: maxScore,
          lives_left: livesLeft,
          cells_filled: cellsFilled,
          pattern: pattern,
          seed_date: today,
        }),
      });
      setGgScoreSaved(true);
    } catch (e) {
      console.warn("GG score save failed:", e);
    }
  }
  
  // Charge le leaderboard du jour (mondial + amis)
  async function ggLoadLeaderboard() {
    setGgLeaderboardLoading(true);
    try {
      const today = ggGetTodayDateStr();
      // Mondial : top 50 du jour
      const globalData = await sbFetch(
        "bb_gg_scores?seed_date=eq." + today + "&order=score.desc&limit=50"
      );
      // Amis : récupérer la liste des amis depuis localStorage puis filtrer
      const friendsIds = JSON.parse(localStorage.getItem("bb_friends") || "[]");
      let friendsData = [];
      if (friendsIds.length > 0) {
        // Inclure aussi le joueur lui-même
        const allIds = [playerId, ...friendsIds].filter(Boolean);
        const idsParam = "(" + allIds.map(id => '"' + id + '"').join(",") + ")";
        friendsData = await sbFetch(
          "bb_gg_scores?seed_date=eq." + today + "&player_id=in." + idsParam + "&order=score.desc"
        );
      } else if (playerId) {
        // Sans amis : juste le joueur lui-même
        friendsData = await sbFetch(
          "bb_gg_scores?seed_date=eq." + today + "&player_id=eq." + playerId
        );
      }
      setGgLeaderboardData({
        global: Array.isArray(globalData) ? globalData : [],
        friends: Array.isArray(friendsData) ? friendsData : [],
      });
    } catch (e) {
      console.warn("GG leaderboard load failed:", e);
      setGgLeaderboardData({ global: [], friends: [] });
    } finally {
      setGgLeaderboardLoading(false);
    }
  }
  
  // ─── GOAT BATTLE (multijoueur) ────────────────────────────────
  
  // Génère un code de room unique (6 chars)
  function ggBattleGenCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O/I/1
    let code = "";
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }
  
  // Crée une nouvelle room
  async function ggBattleCreateRoom() {
    if (!playerId || !playerName) {
      setGgBattleError(tr("Connecte-toi d'abord","Please log in first","Melde dich zuerst an","Accedi prima","Faça login primeiro"));
      return;
    }
    setGgBattleLoading(true);
    setGgBattleError("");
    try {
      // Tenter jusqu'à 5 fois pour éviter collision de code
      let lastError = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = ggBattleGenCode();
        const seed = Math.floor(Math.random() * 1000000) + 1;
        const players = [{
          id: playerId,
          name: playerName,
          joined_at: new Date().toISOString(),
          cells_filled: 0,
          score: 0,
          lives_left: 3,
          finished_at: null,
          finished_score: null,
        }];
        try {
          const res = await fetch(SB_URL + "/rest/v1/bb_gg_rooms", {
            method: "POST",
            headers: {
              "apikey": SB_KEY,
              "Authorization": "Bearer " + SB_KEY,
              "Content-Type": "application/json",
              "Prefer": "return=representation"
            },
            body: JSON.stringify({
              code: code,
              host_id: playerId,
              state: "lobby",
              seed: seed,
              players: players,
            }),
          });
          if (!res.ok) {
            const errText = await res.text();
            console.warn("[GOAT BATTLE] Create room failed:", res.status, errText);
            lastError = "HTTP " + res.status + ": " + errText;
            // Si c'est une collision de code (409 conflict), retry. Sinon stop.
            if (res.status === 409) continue;
            break;
          }
          const data = await res.json();
          if (Array.isArray(data) && data[0]) {
            setGgBattleRoom(data[0]);
            setGgBattleScreen("lobby");
            return;
          }
          lastError = "No data returned";
        } catch (e) {
          console.warn("[GOAT BATTLE] Create room exception:", e);
          lastError = e.message || String(e);
        }
      }
      setGgBattleError((tr("Erreur création : ","Could not create room: ","Erstellen fehlgeschlagen: ","Errore di creazione: ","Erro ao criar: ")) + (lastError || "unknown"));
    } catch (e) {
      console.warn("[GOAT BATTLE] Outer error:", e);
      setGgBattleError(tr("Erreur de création","Error creating room","Fehler beim Erstellen","Errore di creazione","Erro ao criar"));
    } finally {
      setGgBattleLoading(false);
    }
  }
  
  // Rejoindre une room avec un code
  async function ggBattleJoinRoom(rawCode) {
    if (!playerId || !playerName) {
      setGgBattleError(tr("Connecte-toi d'abord","Please log in first","Melde dich zuerst an","Accedi prima","Faça login primeiro"));
      return;
    }
    const code = (rawCode || "").trim().toUpperCase();
    if (code.length !== 6) {
      setGgBattleError(tr("Le code doit faire 6 caractères","Code must be 6 characters","Code muss 6 Zeichen haben","Il codice deve avere 6 caratteri","O código deve ter 6 caracteres"));
      return;
    }
    setGgBattleLoading(true);
    setGgBattleError("");
    try {
      const data = await sbFetch("bb_gg_rooms?code=eq."+code+"&limit=1");
      if (!Array.isArray(data) || data.length === 0) {
        setGgBattleError(tr("Room introuvable","Room not found","Raum nicht gefunden","Stanza non trovata","Sala não encontrada"));
        return;
      }
      const room = data[0];
      if (room.state !== "lobby") {
        setGgBattleError(tr("Partie déjà en cours","Game already started","Spiel läuft bereits","Partita già in corso","Jogo já começou"));
        return;
      }
      const players = Array.isArray(room.players) ? room.players : [];
      // Si déjà dans la room, on rejoint juste
      if (players.find(p => p.id === playerId)) {
        setGgBattleRoom(room);
        setGgBattleScreen("lobby");
        return;
      }
      if (players.length >= 8) {
        setGgBattleError(tr("Room pleine (8 max)","Room is full (8 max)","Raum ist voll (max. 8)","Stanza piena (max 8)","Sala cheia (8 máx)"));
        return;
      }
      players.push({
        id: playerId,
        name: playerName,
        joined_at: new Date().toISOString(),
        cells_filled: 0,
        score: 0,
        lives_left: 3,
        finished_at: null,
        finished_score: null,
      });
      await sbFetch("bb_gg_rooms?id=eq."+room.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Prefer": "return=minimal" },
        body: JSON.stringify({ players }),
      });
      setGgBattleRoom({ ...room, players });
      setGgBattleScreen("lobby");
    } catch (e) {
      setGgBattleError(tr("Erreur de connexion","Error joining room","Fehler beim Beitreten","Errore di accesso","Erro ao entrar"));
    } finally {
      setGgBattleLoading(false);
    }
  }
  
  // Quitter une room (depuis le lobby)
  async function ggBattleLeaveRoom() {
    if (!ggBattleRoom) {
      setGgBattleScreen(null);
      return;
    }
    try {
      const players = (ggBattleRoom.players || []).filter(p => p.id !== playerId);
      if (players.length === 0) {
        // Plus personne, on supprime la room
        await sbFetch("bb_gg_rooms?id=eq."+ggBattleRoom.id, { method: "DELETE", headers: { "Prefer": "return=minimal" } });
      } else {
        // Si l'host part, on transfère à un autre joueur
        const newHostId = ggBattleRoom.host_id === playerId ? players[0].id : ggBattleRoom.host_id;
        await sbFetch("bb_gg_rooms?id=eq."+ggBattleRoom.id, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "Prefer": "return=minimal" },
          body: JSON.stringify({ players, host_id: newHostId }),
        });
      }
    } catch (e) { /* ignore */ }
    setGgBattleRoom(null);
    setGgBattleScreen(null);
    setGgBattleCode("");
  }
  
  // Démarrer la partie (host uniquement)
  // ─── GOAT BATTLE — PARTIE RAPIDE (adversaire simulé) ───────────────
  // Construit le programme de jeu du bot : quelles cases il remplit, quand, et
  // avec quel joueur. On pioche dans cell.candidates, déjà calculé par
  // ggGenerateGrid, donc les noms sont forcément valides pour la case.
  function ggBattleBuildBotPlan(grid) {
    const cells = (grid && grid.cells) || [];
    if (!cells.length) return [];
    // 4 à 8 cases : compétitif mais battable. 9/9 resterait frustrant à répétition.
    const target = 4 + Math.floor(Math.random() * 5);
    const order = cells.slice().sort(function(){ return Math.random() - 0.5; });
    const used = new Set();
    const plan = [];
    let t = 6 + Math.random() * 10;   // première réponse entre 6 et 16 s
    for (let i = 0; i < order.length && plan.length < target; i++) {
      const cell = order[i];
      const pool = (cell.candidates || []).filter(function(n){ return !used.has(n); });
      if (!pool.length) continue;
      const name = pool[Math.floor(Math.random() * pool.length)];
      used.add(name);
      const p = PLAYERS.find(function(x){ return x.name === name; });
      const pts = ggCalculatePointsForPlayer(p ? p.diff : "facile", cell.totalCount);
      plan.push({
        atSec: Math.round(t),
        cellKey: cell.row + "-" + cell.col,
        name: name,
        pts: pts,
        rarity: ggGetRarityClass(pts),
      });
      t += 8 + Math.random() * 16;    // 8 à 24 s entre deux réponses
      if (t > 115) break;             // rien après la fin des 2 minutes
    }
    return plan;
  }

  function ggBattleStartSimulated(opponent) {
    // Cherche une grille valide (ggGenerateGrid peut renvoyer null)
    let grid = null, seed = 0;
    for (let i = 0; i < 25 && !grid; i++) {
      seed = Math.floor(Math.random() * 1000000) + 1;
      grid = ggGenerateGrid(seed);
    }
    if (!grid) { setGgBattleError(tr("Grille indisponible, réessaie","Grid unavailable, try again","Raster nicht verfügbar, versuch es erneut","Griglia non disponibile, riprova","Grade indisponível, tente de novo")); return; }

    trackPlay("grid", true);
    const botId = "BOT-" + Math.random().toString(36).slice(2, 8);
    ggBattleBotRef.current = { id: botId, plan: ggBattleBuildBotPlan(grid), next: 0 };

    setGgGrid(grid);
    setGgFilledCells({});
    setGgUsedPlayers(new Set());
    setGgLives(999);           // mode battle : pas de limite de vies
    setGgScore(0);
    setGgGameOver(false);
    setGgGuess("");
    setGgFlash(null);
    setGgSelectedCell(null);
    setGgBattleTimer(120);
    ggBattleBonusRef.current = 0;
    ggBattleStateRef.current.submitted = false;

    const now = Date.now();
    setGgBattleRoom({
      id: "LOCAL",
      code: null,
      host_id: playerId,
      state: "playing",
      seed: seed,
      started_at: new Date(now + 3000).toISOString(),   // petit 3-2-1
      players: [
        { id: playerId, name: playerName || tr("Toi","You","Du","Tu","Você"), cells_filled: 0, score: 0, lives_left: 3, finished_at: null, finished_score: null, filled_grid: {} },
        { id: botId, name: opponent.pseudo, country: opponent.country, avatar: opponent.avatar, cells_filled: 0, score: 0, lives_left: 3, finished_at: null, finished_score: null, filled_grid: {} },
      ],
    });
    setGgBattleScreen("playing");
  }

  async function ggBattleStartGame() {
    if (!ggBattleRoom || ggBattleRoom.host_id !== playerId) return;
    trackPlay("grid", true); // GOAT Grid battle = partie en ligne
    setGgBattleLoading(true);
    try {
      // Started_at = maintenant + 5 secondes (compte à rebours pour tous les joueurs)
      const startTime = new Date(Date.now() + 5000).toISOString();
      await sbFetch("bb_gg_rooms?id=eq."+ggBattleRoom.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Prefer": "return=minimal" },
        body: JSON.stringify({ state: "playing", started_at: startTime }),
      });
    } catch (e) {
      setGgBattleError(tr("Erreur au démarrage","Error starting game","Fehler beim Start","Errore all'avvio","Erro ao iniciar"));
    } finally {
      setGgBattleLoading(false);
    }
  }
  
  // Relancer la partie (host uniquement) → reset la room avec une nouvelle grille
  async function ggBattleRestartGame() {
    if (!ggBattleRoom || ggBattleRoom.host_id !== playerId) return;
    // Partie rapide : on relance directement une nouvelle simulation contre le
    // même adversaire (il n'y a pas de lobby serveur où retourner).
    if (ggBattleRoom.id === "LOCAL") {
      const bot = (ggBattleRoom.players || []).find(function(p){ return p.id !== playerId; });
      if (bot) ggBattleStartSimulated({ pseudo: bot.name, country: bot.country, avatar: bot.avatar });
      return;
    }
    setGgBattleLoading(true);
    try {
      // Reset complet : nouveau seed, players reset, état lobby
      const newSeed = Math.floor(Math.random() * 1000000) + 1;
      const resetPlayers = (ggBattleRoom.players || []).map(function(p){
        return {
          id: p.id,
          name: p.name,
          joined_at: p.joined_at || new Date().toISOString(),
          cells_filled: 0,
          score: 0,
          lives_left: 3,
          finished_at: null,
          finished_score: null,
          filled_grid: {},
        };
      });
      await sbFetch("bb_gg_rooms?id=eq."+ggBattleRoom.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Prefer": "return=minimal" },
        body: JSON.stringify({
          state: "lobby",
          seed: newSeed,
          players: resetPlayers,
          started_at: null,
          winner_id: null,
          winner_name: null,
        }),
      });
      // Reset le flag de submit local pour pouvoir rejouer
      ggBattleStateRef.current.submitted = false;
      // Le polling fera revenir tout le monde au lobby
      setGgBattleScreen("lobby");
    } catch (e) {
      console.warn("[GG BATTLE] restart failed:", e);
      setGgBattleError(tr("Erreur au relancement","Error restarting","Fehler beim Neustart","Errore al riavvio","Erro ao reiniciar"));
    } finally {
      setGgBattleLoading(false);
    }
  }
  
  // Synchroniser la progression du joueur dans la room (appelé après chaque case validée)
  // Permet de garder Supabase à jour même si le joueur passe en background ensuite
  async function ggBattleSyncProgress(currentScore, currentCellsFilled, currentLives) {
    if (!ggBattleRoom || !ggBattleRoom.id) return;
    if (ggBattleScreen !== "playing") return;
    // Partie rapide : rien à synchroniser, la room n'existe que côté client.
    // On tient quand même à jour la ligne du joueur pour le classement final.
    if (ggBattleRoom.id === "LOCAL") {
      const snap = {};
      Object.keys(ggFilledCells || {}).forEach(function(k){
        const v = ggFilledCells[k];
        snap[k] = (v && v.name) ? v.name : String(v);
      });
      setGgBattleRoom(function(r){
        if (!r) return r;
        return Object.assign({}, r, { players: r.players.map(function(p){
          return p.id === playerId
            ? Object.assign({}, p, { score: currentScore, cells_filled: currentCellsFilled, lives_left: currentLives, filled_grid: snap })
            : p;
        }) });
      });
      return;
    }
    
    try {
      const data = await sbFetch("bb_gg_rooms?id=eq."+ggBattleRoom.id+"&limit=1");
      if (!Array.isArray(data) || data.length === 0) return;
      const fresh = data[0];
      
      // Snapshot des cases pour la grille (pour la review post-match)
      const filledGrid = {};
      Object.keys(ggFilledCells || {}).forEach(function(k){
        const v = ggFilledCells[k];
        if (typeof v === "string") filledGrid[k] = v;
        else if (v && v.name) filledGrid[k] = v.name;
        else filledGrid[k] = String(v);
      });
      
      const players = (fresh.players || []).map(function(p){
        if (p.id !== playerId) return p;
        // On garde finished_at s'il est déjà set (cas où le joueur a déjà submit)
        return {
          ...p,
          score: currentScore,
          cells_filled: currentCellsFilled,
          lives_left: currentLives,
          filled_grid: filledGrid,
          // Si la partie est déjà finished et qu'on n'a pas encore submit, finaliser nos infos
          finished_at: (fresh.state === "finished" && !p.finished_at) ? new Date().toISOString() : p.finished_at,
          finished_score: (fresh.state === "finished") ? currentScore : p.finished_score,
        };
      });
      
      // PATCH simple, sans optimistic lock (les conflits sur ce champ sont OK : c'est juste live progress)
      // On push TOUJOURS pour ne pas perdre nos données, même si state=finished
      await sbFetch("bb_gg_rooms?id=eq."+fresh.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Prefer": "return=minimal" },
        body: JSON.stringify({ players: players }),
      });
    } catch (e) {
      // Échec silencieux : c'est juste une synchro en background, on retentera à la prochaine case
      console.warn("[GG BATTLE] sync progress failed:", e);
    }
  }
  
  // Soumettre son score final à la room (avec optimistic locking pour éviter les conflits)
  async function ggBattleSubmitFinal(finalScore, cellsFilled, livesLeft) {
    if (!ggBattleRoom) return;

    // Partie rapide : on clôture localement, sans Supabase.
    if (ggBattleRoom.id === "LOCAL") {
      const live = (ggBattleStateRef.current && ggBattleStateRef.current.filledCells) || ggFilledCells || {};
      const snap = {};
      Object.keys(live).forEach(function(k){ const v = live[k]; snap[k] = (v && v.name) ? v.name : String(v); });
      const nowIso = new Date().toISOString();
      setGgBattleRoom(function(r){
        if (!r) return r;
        return Object.assign({}, r, { state:"finished", players: r.players.map(function(p){
          return p.id === playerId
            ? Object.assign({}, p, { score: finalScore, cells_filled: Object.keys(live).length || cellsFilled, lives_left: livesLeft, filled_grid: snap, finished_at: nowIso })
            : Object.assign({}, p, { finished_at: p.finished_at || nowIso });
        }) });
      });
      setGgBattleScreen("finished");
      return;
    }
    
    // IMPORTANT : utiliser la ref pour avoir les valeurs LIVE (pas la closure périmée)
    // Le tick du timer est un setInterval qui capture la closure du premier render
    const liveFilledCells = (ggBattleStateRef && ggBattleStateRef.current && ggBattleStateRef.current.filledCells) || ggFilledCells || {};
    
    // Snapshot des cases remplies par le joueur actuel : {cellKey: playerName}
    const filledGrid = {};
    Object.keys(liveFilledCells).forEach(function(k){
      const v = liveFilledCells[k];
      if (typeof v === "string") filledGrid[k] = v;
      else if (v && v.name) filledGrid[k] = v.name;
      else filledGrid[k] = String(v);
    });
    
    // Sécurité : si cellsFilled passé est 0 mais qu'on a des cellules locales, prendre le compte réel
    if (cellsFilled === 0 && Object.keys(liveFilledCells).length > 0) {
      cellsFilled = Object.keys(liveFilledCells).length;
    }
    // Sécurité : si finalScore est 0 mais qu'on a un score live plus haut, prendre le live
    if ((!finalScore || finalScore === 0) && ggBattleStateRef && ggBattleStateRef.current && ggBattleStateRef.current.score > 0) {
      finalScore = ggBattleStateRef.current.score;
    }
    
    // Boucle de retry : on lit la version la plus récente, on update, on PATCH avec WHERE updated_at
    // Si quelqu'un d'autre a modifié entre temps, le PATCH n'affecte 0 ligne → on retry
    const MAX_RETRIES = 5;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // 1. Read fresh
        const data = await sbFetch("bb_gg_rooms?id=eq."+ggBattleRoom.id+"&limit=1");
        if (!Array.isArray(data) || data.length === 0) return;
        const fresh = data[0];
        const lastUpdate = fresh.updated_at; // pour optimistic lock
        
        // Si déjà finished par quelqu'un d'autre, on s'aligne juste localement et on sort
        if (fresh.state === "finished") {
          setGgBattleRoom(fresh);
          setGgBattleScreen("finished");
          return;
        }
        
        // 2. Compute mes updates
        const players = (fresh.players || []).map(p => {
          if (p.id !== playerId) return p;
          return {
            ...p,
            cells_filled: cellsFilled,
            score: finalScore,
            lives_left: livesLeft,
            finished_at: p.finished_at || new Date().toISOString(),
            finished_score: finalScore,
            filled_grid: filledGrid,
          };
        });
        
        // 3. Vérifier si tout le monde a fini, si quelqu'un a fait 9/9, OU si le timer est écoulé
        const allFinished = players.every(p => p.finished_at);
        const someoneCompleted = players.some(p => p.cells_filled === 9);
        const startMs = fresh.started_at ? new Date(fresh.started_at).getTime() : 0;
        const elapsedSec = startMs ? (Date.now() - startMs) / 1000 : 0;
        const timerExpired = elapsedSec >= 120;
        const updates = { players };
        
        if (allFinished || someoneCompleted || timerExpired) {
          // Si timer écoulé OU quelqu'un a fait 9/9 → finaliser tous les joueurs qui n'ont pas encore submit
          // (avec leurs dernières valeurs synchronisées via sync live)
          if (timerExpired || someoneCompleted) {
            updates.players = players.map(function(p){
              if (p.finished_at) return p; // déjà fini
              return {
                ...p,
                finished_at: new Date().toISOString(),
                finished_score: p.score || 0,
              };
            });
          }
          const finalPlayers = updates.players;
          const completed = finalPlayers.filter(p => p.cells_filled === 9);
          let winner;
          if (completed.length > 0) {
            winner = completed.sort((a,b) => new Date(a.finished_at) - new Date(b.finished_at))[0];
          } else {
            winner = [...finalPlayers].sort((a,b) => (b.score||0) - (a.score||0))[0];
          }
          updates.state = "finished";
          updates.winner_id = winner.id;
          updates.winner_name = winner.name;
        }
        
        // 4. PATCH avec optimistic lock : seulement si updated_at n'a pas changé
        // On utilise Prefer: return=representation pour récupérer la version après update
        const patchUrl = "bb_gg_rooms?id=eq."+fresh.id+"&updated_at=eq."+encodeURIComponent(lastUpdate);
        const patchResult = await sbFetch(patchUrl, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "Prefer": "return=representation" },
          body: JSON.stringify(updates),
        });
        
        // Si patchResult est un tableau vide → aucune ligne affectée → conflit, retry
        if (!Array.isArray(patchResult) || patchResult.length === 0) {
          // Conflit : un autre joueur a écrit pendant qu'on calculait
          console.warn("[GG BATTLE] Conflit détecté, retry " + (attempt + 1) + "/" + MAX_RETRIES);
          // Petit délai aléatoire pour éviter que les 2 joueurs retry au même moment
          await new Promise(r => setTimeout(r, 100 + Math.random() * 200));
          continue;
        }
        
        // ✅ Succès : on a la version finale fraîche (incluant les autres joueurs)
        const updatedRoom = patchResult[0];
        setGgBattleRoom(updatedRoom);
        if (updatedRoom.state === "finished") {
          setGgBattleScreen("finished");
        }
        return;
      } catch (e) {
        console.warn("ggBattleSubmitFinal attempt " + (attempt + 1) + " failed:", e);
        if (attempt < MAX_RETRIES - 1) {
          await new Promise(r => setTimeout(r, 200));
        }
      }
    }
    
    console.warn("[GG BATTLE] ggBattleSubmitFinal: échec après " + MAX_RETRIES + " tentatives");
  }
  
  // ─── GOAT BATTLE — Polling de la room (lobby + playing + finished) ───
  React.useEffect(function() {
    if (!ggBattleRoom || !ggBattleRoom.id) return;
    if (ggBattleScreen !== "lobby" && ggBattleScreen !== "playing" && ggBattleScreen !== "finished") return;
    if (ggBattleRoom.id === "LOCAL") return;   // partie rapide : pas de room serveur à interroger

    let stopped = false;
    async function poll() {
      try {
        const r = await fetch(SB_URL + "/rest/v1/bb_gg_rooms?id=eq." + ggBattleRoom.id + "&select=*", {
          headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY }
        });
        if (!r.ok) return;
        const data = await r.json();
        if (stopped || !data || !data[0]) return;
        const updated = data[0];
        setGgBattleRoom(updated);
        
        // Si state passe à "playing" (host a démarré) → générer la grille
        if (updated.state === "playing" && ggBattleScreen === "lobby") {
          const grid = ggGenerateGrid(updated.seed);
          if (grid) {
            setGgGrid(grid);
            setGgFilledCells({});
            setGgUsedPlayers(new Set());
            setGgLives(999); // mode battle : pas de limite de vies
            setGgScore(0);
            setGgGameOver(false);
            setGgGuess("");
            setGgFlash(null);
            setGgSelectedCell(null);
            setGgBattleTimer(120); // reset 2 min
            setGgBattleScreen("playing");
          }
        }
        
        // Si state passe à "finished" (un joueur a fait 9/9 ou timer écoulé) → écran final
        if (updated.state === "finished" && ggBattleScreen === "playing") {
          // TOUJOURS forcer une mise à jour avec nos dernières valeurs locales avant d'afficher l'écran final
          // (la sync live a pu être trop tardive ou échouer)
          const myLocalCells = Object.keys(ggFilledCells || {}).length;
          try {
            const filledGrid = {};
            Object.keys(ggFilledCells || {}).forEach(function(k){
              const v = ggFilledCells[k];
              if (typeof v === "string") filledGrid[k] = v;
              else if (v && v.name) filledGrid[k] = v.name;
              else filledGrid[k] = String(v);
            });
            // Refetch frais pour ne pas écraser d'autres updates récentes
            const fresh = await sbFetch("bb_gg_rooms?id=eq."+updated.id+"&limit=1");
            const freshRoom = (Array.isArray(fresh) && fresh[0]) ? fresh[0] : updated;
            const updatedPlayers = (freshRoom.players || []).map(function(p){
              if (p.id !== playerId) return p;
              // On prend toujours le MAX entre la valeur en base et la valeur locale
              // (au cas où la sync live a déjà push une valeur correcte plus tard)
              const finalCells = Math.max(myLocalCells, p.cells_filled || 0);
              const finalScore = Math.max(ggScore, p.score || 0);
              return {
                ...p,
                score: finalScore,
                cells_filled: finalCells,
                lives_left: ggLives,
                finished_at: p.finished_at || new Date().toISOString(),
                finished_score: finalScore,
                filled_grid: (p.filled_grid && Object.keys(p.filled_grid).length >= myLocalCells) ? p.filled_grid : filledGrid,
              };
            });
            await sbFetch("bb_gg_rooms?id=eq."+updated.id, {
              method: "PATCH",
              headers: { "Content-Type": "application/json", "Prefer": "return=representation" },
              body: JSON.stringify({ players: updatedPlayers }),
            });
            // Recharger pour avoir les valeurs réelles à afficher
            const refreshData = await sbFetch("bb_gg_rooms?id=eq."+updated.id+"&limit=1");
            if (Array.isArray(refreshData) && refreshData[0]) {
              setGgBattleRoom(refreshData[0]);
            } else {
              setGgBattleRoom(freshRoom);
            }
          } catch (e) {
            console.warn("[GG BATTLE] late sync failed:", e);
            setGgBattleRoom(updated);
          }
          setGgBattleScreen("finished");
        }
        
        // Si le host a relancé une partie : state passe de "finished" à "lobby" → revenir au lobby
        if (updated.state === "lobby" && ggBattleScreen === "finished") {
          // Reset l'état local du jeu pour pouvoir rejouer
          setGgFilledCells({});
          setGgUsedPlayers(new Set());
          setGgLives(3);
          setGgScore(0);
          setGgGameOver(false);
          setGgGuess("");
          setGgFlash(null);
          setGgSelectedCell(null);
          ggBattleStateRef.current.submitted = false;
          setGgBattleScreen("lobby");
        }
      } catch (e) {
        console.warn("battle poll failed:", e);
      }
    }
    
    poll();
    const intervalId = setInterval(poll, 1500); // toutes les 1.5s
    return function() { stopped = true; clearInterval(intervalId); };
  }, [ggBattleRoom && ggBattleRoom.id, ggBattleScreen]);
  
  // ─── GOAT BATTLE — Timer basé sur started_at (résiste au lock screen) ───
  // Mise à jour de la ref avec les valeurs LIVE
  React.useEffect(function() {
    ggBattleStateRef.current.filledCells = ggFilledCells;
    ggBattleStateRef.current.score = ggScore;
    ggBattleStateRef.current.lives = ggLives;
  }, [ggFilledCells, ggScore, ggLives]);
  
  React.useEffect(function() {
    if (ggBattleScreen !== "playing") return;
    if (!ggBattleRoom || !ggBattleRoom.started_at) return;
    
    // Reset le flag de submit et le bonus au démarrage
    ggBattleStateRef.current.submitted = false;
    ggBattleBonusRef.current = 0;
    
    const startMs = new Date(ggBattleRoom.started_at).getTime();
    const DURATION_SEC = 120; // 2 minutes
    
    function tick() {
      const nowMs = Date.now();
      const elapsedMs = nowMs - startMs;
      
      // Phase 1 : Compte à rebours (avant le start)
      if (elapsedMs < 0) {
        const cd = Math.ceil(-elapsedMs / 1000); // 5, 4, 3, 2, 1
        setGgBattleCountdown(cd);
        setGgBattleTimer(DURATION_SEC); // reste à 120 affiché
        return;
      }
      
      // Phase 2 : Partie en cours
      setGgBattleCountdown(0);
      const elapsedSec = Math.floor(elapsedMs / 1000);
      const remaining = Math.max(0, DURATION_SEC + ggBattleBonusRef.current - elapsedSec);
      setGgBattleTimer(remaining);
      
      if (remaining === 0 && !ggBattleStateRef.current.submitted) {
        // Timer écoulé → soumettre le score final UNE SEULE FOIS
        ggBattleStateRef.current.submitted = true;
        const filledCount = Object.keys(ggBattleStateRef.current.filledCells).length;
        ggBattleSubmitFinal(
          ggBattleStateRef.current.score,
          filledCount,
          ggBattleStateRef.current.lives
        );
      }
    }
    
    // Tick immédiat puis toutes les secondes
    tick();
    const intervalId = setInterval(tick, 1000);
    
    // Aussi : tick au retour de focus (au cas où setInterval s'est gelé)
    function onVisibilityChange() {
      if (!document.hidden) tick();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", tick);
    
    return function() {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", tick);
    };
  }, [ggBattleScreen, ggBattleRoom && ggBattleRoom.started_at]);
  
  // ─── GOAT DUEL — le bot marque (partie rapide uniquement) ───
  React.useEffect(function() {
    if (duelScreen !== "playing") return;
    const r = duelRoomRef.current || duelRoom;
    if (!r || !r.bot) return;
    const bot = duelBotRef.current;
    if (!bot) return;
    const id = setInterval(function() {
      const cur = duelRoomRef.current;
      if (!cur || cur.state === "finished") return;
      const el = Date.now() - bot.startMs;
      let gained = 0;
      while (bot.next < bot.plan.length && bot.plan[bot.next].at <= el) {
        gained += bot.plan[bot.next].pts; bot.next++;
      }
      if (gained) duelPatch("LOCAL", { guest_score: (cur.guest_score||0) + gained });
    }, 1000);
    return function(){ clearInterval(id); };
  }, [duelScreen, duelRoom && duelRoom.bot]);

  // ─── GOAT BATTLE — le bot joue (partie rapide uniquement) ───
  // Déroule le programme construit au lancement : à chaque seconde écoulée on
  // applique les réponses dont l'heure est passée. Le bot remplit de vraies
  // cases avec de vrais joueurs, donc sa grille est consultable en fin de match
  // comme celle d'un humain.
  React.useEffect(function() {
    if (ggBattleScreen !== "playing") return;
    if (!ggBattleRoom || ggBattleRoom.id !== "LOCAL" || !ggBattleRoom.started_at) return;
    const bot = ggBattleBotRef.current;
    if (!bot) return;

    const startMs = new Date(ggBattleRoom.started_at).getTime();
    const id = setInterval(function() {
      const elapsed = (Date.now() - startMs) / 1000;
      if (elapsed < 0) return;
      let moved = false;
      while (bot.next < bot.plan.length && bot.plan[bot.next].atSec <= elapsed) {
        bot.next++; moved = true;
      }
      if (!moved) return;
      const done = bot.plan.slice(0, bot.next);
      const grid = {}; let score = 0;
      done.forEach(function(m){ grid[m.cellKey] = m.name; score += m.pts; });
      setGgBattleRoom(function(r){
        if (!r) return r;
        return Object.assign({}, r, { players: r.players.map(function(p){
          return p.id === bot.id
            ? Object.assign({}, p, { cells_filled: done.length, score: score, filled_grid: grid })
            : p;
        }) });
      });
    }, 1000);
    return function(){ clearInterval(id); };
  }, [ggBattleScreen, ggBattleRoom && ggBattleRoom.id, ggBattleRoom && ggBattleRoom.started_at]);

  // ─── ANDROID BACK BUTTON HANDLER ───
  // Empêche la perte de partie quand l'utilisateur appuie sur la touche retour Android.
  // 1er appui : affiche un toast "Re-appuie pour quitter" pendant 2s.
  // 2e appui dans les 2s : quitte la partie proprement (retour home).
  React.useEffect(function() {
    // Détecter si on est dans un état "interceptable"
    const inGame = screen === "game" || showGoatGrid || (ggBattleScreen && ggBattleScreen === "playing");
    if (!inGame) return;

    // Push un state factice dans l'historique pour pouvoir intercepter le back
    try { window.history.pushState({gameActive: true}, ""); } catch (e) {}

    function handlePopState() {
      const ref = backPressRef.current;
      if (ref.pressed) {
        // 2e appui : on quitte la partie
        if (ref.timeoutId) clearTimeout(ref.timeoutId);
        ref.pressed = false;
        setShowBackHint(false);
        if (screen === "game") setScreen("home");
        else if (showGoatGrid) setShowGoatGrid(false);
        else if (ggBattleScreen) setGgBattleScreen(null);
      } else {
        // 1er appui : warning toast
        ref.pressed = true;
        setShowBackHint(true);
        ref.timeoutId = setTimeout(function() {
          ref.pressed = false;
          setShowBackHint(false);
        }, 2000);
        // Re-push pour pouvoir ré-intercepter
        try { window.history.pushState({gameActive: true}, ""); } catch (e) {}
      }
    }

    window.addEventListener("popstate", handlePopState);
    return function() {
      window.removeEventListener("popstate", handlePopState);
      if (backPressRef.current.timeoutId) clearTimeout(backPressRef.current.timeoutId);
      backPressRef.current.pressed = false;
      setShowBackHint(false);
    };
  }, [screen, showGoatGrid, ggBattleScreen]);

  // ─── GOAT BATTLE — Détection 9/9 (pas de limite de vies en mode battle) ───
  React.useEffect(function() {
    if (ggBattleScreen !== "playing") return;
    if (!ggBattleRoom) return;
    if (ggBattleStateRef.current.submitted) return; // déjà soumis
    
    const filledCount = Object.keys(ggFilledCells).length;
    
    // Cas unique : Grille parfaite (9/9) → fin immédiate
    if (filledCount === 9) {
      ggBattleStateRef.current.submitted = true;
      ggBattleSubmitFinal(ggScore, 9, ggLives);
    }
  }, [ggFilledCells, ggBattleScreen]);
  
  // ─── GOAT BATTLE — Sync progression en temps réel ───
  // Push score/cells/lives à Supabase à chaque changement, pour que le serveur
  // ait toujours les valeurs à jour même si le joueur passe son écran en background ensuite
  React.useEffect(function() {
    if (ggBattleScreen !== "playing") return;
    if (!ggBattleRoom) return;
    if (ggBattleStateRef.current.submitted) return; // si déjà soumis, on ne sync plus
    
    const filledCount = Object.keys(ggFilledCells).length;
    if (filledCount === 0) return; // rien à sync au début
    
    // Délai pour debounce (au cas où plusieurs changements rapides) - court pour push rapidement
    const t = setTimeout(function() {
      ggBattleSyncProgress(ggScore, filledCount, ggLives);
    }, 150);
    return function() { clearTimeout(t); };
  }, [ggFilledCells, ggScore, ggBattleScreen]);
  
  // Démarrer/reprendre une partie GOAT GRID
  // Démo : une réponse DISTINCTE par case (un joueur ne peut servir qu'une fois dans la grille).
  // Préfère les joueurs faciles/reconnaissables, en évitant de réutiliser un nom déjà pris.
  function ggDemoAnswers(cells) {
    const used = new Set();
    const ordered = cells.slice().sort(function (a, b) { return (a.row - b.row) || (a.col - b.col); });
    return ordered.map(function (c) {
      const cands = c.candidates || [];
      let best = null, bestRank = 99;
      for (const n of cands) {
        if (used.has(n)) continue;
        const p = PLAYERS_CLEAN.find(x => x.name === n);
        const d = p ? p.diff : "expert";
        const rank = d === "facile" ? 0 : d === "moyen" ? 1 : 2;
        if (rank < bestRank) { bestRank = rank; best = n; if (rank === 0) break; }
      }
      if (!best) best = cands.find(n => !used.has(n)) || cands[0] || "";
      if (best) used.add(best);
      return { cell: c, answer: best };
    });
  }

  // Bascule le mode démo directement dans l'app (appui long sur le titre GOAT GRID)
  function ggToggleDemo() {
    const nv = !ggDemo;
    try { if (nv) localStorage.setItem("bb_gg_demo", "1"); else localStorage.removeItem("bb_gg_demo"); } catch (e) {}
    setGgDemo(nv);
    const seed = nv ? GG_DEMO_SEED : ggGetDailySeed();
    setGgOverrideSeed(nv ? GG_DEMO_SEED : 0);
    const grid = ggGenerateGrid(seed);
    setGgGrid(grid || null); setGgError(!grid);
    setGgFilledCells({}); setGgUsedPlayers(new Set()); setGgLives(3); setGgScore(0); setGgGameOver(false);
    setGgGuess(""); setGgFlash(null); setGgSelectedCell(null); setGgRevealMode(false); setGgRevealCell(null);
    vibrate([30, 50, 30]);
  }
  // 5 taps rapides sur le titre (≤1,2 s entre chaque) → bascule le mode démo.
  // Plus fiable qu'un appui long sur iOS (les taps sont discrets, pas annulés par un micro-mouvement).
  function ggTitleTap() {
    const now = Date.now();
    const r = ggTapRef.current;
    if (now - r.last > 1200) r.count = 0;
    r.count += 1; r.last = now;
    if (r.count >= 5) { r.count = 0; ggToggleDemo(); }
  }

  function ggStartGame() {
    trackPlay("grid");
    const seed = ggOverrideSeed || ggGetDailySeed();
    const grid = ggGenerateGrid(seed);
    if (!grid) {
      setGgError(true);
      setShowGoatGrid(true);
      return;
    }
    setGgError(false);
    setGgGrid(grid);
    
    // Restaurer la progression du jour si elle existe
    const saved = ggLoadFromStorage();
    if (saved) {
      setGgFilledCells(saved.filledCells || {});
      setGgUsedPlayers(new Set(saved.usedPlayers || []));
      setGgLives(typeof saved.lives === "number" ? saved.lives : 3);
      setGgScore(saved.score || 0);
      setGgGameOver(saved.gameOver || false);
    } else {
      // Nouvelle partie
      setGgFilledCells({});
      setGgUsedPlayers(new Set());
      setGgLives(3);
      setGgScore(0);
      setGgGameOver(false);
    }
    setGgGuess("");
    setGgFlash(null);
    setGgSelectedCell(null);
    setShowGoatGrid(true);
  }
  
  // Sauvegarder à chaque changement
  useEffect(function(){
    if (showGoatGrid && ggGrid) ggSaveToStorage();
  }, [ggFilledCells, ggLives, ggScore, ggGameOver]);
  
  
  // ─── GG : Soumettre une réponse pour la case sélectionnée ──
  function ggSubmitAnswer(playerName) {
    if (!ggSelectedCell || !ggGrid || ggGameOver) return;
    const { row, col } = ggSelectedCell;
    const cellKey = row + "-" + col;
    
    // Récupère la cellule du grid
    const cell = ggGrid.cells.find(c => c.row === row && c.col === col);
    if (!cell) return;
    
    // Cherche le joueur dans PLAYERS_CLEAN (insensible accents)
    const norm = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
    const target = norm(playerName.trim());
    const player = PLAYERS_CLEAN.find(p => norm(p.name) === target);
    
    if (!player) {
      // Joueur introuvable
      setGgFlash("ko");
      setGgFlashCell({ row, col });
      setTimeout(function(){ setGgFlash(null); setGgFlashCell(null); setGgGuess(""); }, 700);
      return;
    }
    
    // RÈGLE MÉTRODOKU : 1 joueur par grille
    if (ggUsedPlayers.has(player.name)) {
      // On signale visuellement mais on ne décrémente pas une vie
      setGgFlash("ko");
      setGgFlashCell({ row, col });
      setTimeout(function(){ 
        setGgFlash(null); 
        setGgFlashCell(null); 
        setGgGuess(""); 
        alert((tr("⚠️ Tu as déjà placé ","⚠️ You already placed ","⚠️ Du hast bereits platziert ","⚠️ Hai già inserito ","⚠️ Você já colocou ")) + player.name + (tr(" dans cette grille ! Chaque joueur ne peut être utilisé qu'une fois."," in this grid! Each player can only be used once."," in diesem Raster! Jeder Spieler kann nur einmal verwendet werden."," in questa griglia! Ogni giocatore può essere usato una sola volta."," nesta grade! Cada jogador só pode ser usado uma vez.")));
      }, 400);
      return;
    }
    
    // Vérifier que le joueur matche les 2 critères de la case
    const matchesRow = ggPlayerMatchesCriterion(player, cell.rowCriterion);
    const matchesCol = ggPlayerMatchesCriterion(player, cell.colCriterion);
    
    if (matchesRow && matchesCol) {
      // ✅ BONNE RÉPONSE — pts selon DIFFICULTÉ DU JOUEUR CITÉ
      const playerPts = ggCalculatePointsForPlayer(player.diff, cell.totalCount);
      const playerRarity = ggGetRarityClass(playerPts);
      const newFilled = { ...ggFilledCells, [cellKey]: { name: player.name, pts: playerPts, rarity: playerRarity } };
      const newUsed = new Set(ggUsedPlayers);
      newUsed.add(player.name);
      const newScore = ggScore + playerPts;

      // En mode GOAT Battle : +2s par bonne réponse
      if (ggBattleScreen === "playing") ggBattleBonusRef.current += 2;

      setGgFilledCells(newFilled);
      setGgUsedPlayers(newUsed);
      setGgScore(newScore);
      setGgFlash("ok");
      setGgFlashCell({ row, col });
      
      // Vérifier si la grille est complète
      const isComplete = Object.keys(newFilled).length === 9;
      if (isComplete) {
        // Bonus sans-faute si lives === 3 (pas d'erreurs)
        let finalScore = newScore;
        if (ggLives === 3) {
          finalScore = newScore + 100;
          setGgScore(finalScore);
        }
        setTimeout(function(){
          setGgGameOver(true);
          setGgSelectedCell(null);
          setGgGuess("");
          setGgFlash(null);
          setGgFlashCell(null);
          setGgLastRejected(null);
          setGgReportSent(false);
          // 💾 Sauvegarder le score (sauf en mode test)
          if (ggGrid && ggOverrideSeed === 0) {
            const maxScore = ggGrid.cells.reduce(function(s,c){return s+(c.maxPoints||0);},0) + 100;
            const pattern = ggBuildEmojiPattern(newFilled, ggGrid);
            ggSaveScore(finalScore, maxScore, ggLives, 9, pattern);
          }
        }, 700);
      } else {
        setTimeout(function(){
          setGgFlash(null);
          setGgFlashCell(null);
          setGgSelectedCell(null);
          setGgGuess("");
          setGgLastRejected(null);
          setGgReportSent(false);
        }, 700);
      }
    } else {
      // ❌ MAUVAISE RÉPONSE
      // En mode battle : pas de décrément de vies (vies illimitées)
      const isBattle = ggBattleScreen === "playing";
      const newLives = isBattle ? ggLives : ggLives - 1;
      if (!isBattle) setGgLives(newLives);
      setGgFlash("ko");
      setGgFlashCell({ row, col });
      // Stocker la dernière réponse rejetée pour permettre le signalement
      setGgLastRejected({
        playerName: player.name,
        rowCrit: cell.rowCriterion,
        colCrit: cell.colCriterion,
      });
      setGgReportSent(false);
      
      if (newLives <= 0) {
        // Game over
        setTimeout(function(){
          setGgGameOver(true);
          setGgSelectedCell(null);
          setGgGuess("");
          setGgFlash(null);
          setGgFlashCell(null);
          // 💾 Sauvegarder le score (sauf en mode test)
          if (ggGrid && ggOverrideSeed === 0) {
            const maxScore = ggGrid.cells.reduce(function(s,c){return s+(c.maxPoints||0);},0) + 100;
            const pattern = ggBuildEmojiPattern(ggFilledCells, ggGrid);
            const cellsCount = Object.keys(ggFilledCells).length;
            ggSaveScore(ggScore, maxScore, 0, cellsCount, pattern);
          }
        }, 700);
      } else {
        setTimeout(function(){
          setGgFlash(null);
          setGgFlashCell(null);
          setGgGuess("");
        }, 700);
      }
    }
  }
  
  // ─── GG : Suggestions autocomplete (≥3 lettres) ────────────
  function ggGetSuggestions(input) {
    if (!input || input.length < 3) return [];
    const norm = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
    const q = norm(input.trim());
    const matched = PLAYERS_CLEAN.filter(p => p && p.name && norm(p.name).includes(q));
    
    const diffRank = { facile: 0, moyen: 1, expert: 2 };
    
    // Calcule le rang de match d'un nom :
    // 0 = un mot APRÈS le premier commence par q (= nom de famille / particule)
    // 1 = le nom complet commence par q (= prénom)
    // 2 = un mot quelconque commence par q (cas mixte)
    // 3 = la query est juste contenue (substring)
    function matchRank(name) {
      const nn = norm(name);
      const words = nn.split(" ");
      // Mot après le premier (nom de famille / particule)
      for (let i = 1; i < words.length; i++) {
        if (words[i].startsWith(q)) return 0;
      }
      // Le nom complet commence par q
      if (nn.startsWith(q)) return 1;
      // Premier mot uniquement
      if (words[0].startsWith(q)) return 2;
      // Sinon substring
      return 3;
    }
    
    matched.sort(function(a, b){
      const ra = matchRank(a.name);
      const rb = matchRank(b.name);
      if (ra !== rb) return ra - rb;
      // À rang égal, priorité aux joueurs connus
      const aDiff = diffRank[a.diff] !== undefined ? diffRank[a.diff] : 1;
      const bDiff = diffRank[b.diff] !== undefined ? diffRank[b.diff] : 1;
      if (aDiff !== bDiff) return aDiff - bDiff;
      return a.name.localeCompare(b.name);
    });
    return matched.slice(0, 5); // top 5 suggestions
  }
  
  const [dayStreak, setDayStreak] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem("bb_day_streak")||"{}");
      if (!s.lastDate) return 0;
      // On affiche la streak si lastDate == aujourd'hui OU hier (pas encore perdue)
      const d = new Date();
      const paris = new Date(d.toLocaleString('en-US',{timeZone:'Europe/Paris'}));
      const today = paris.getFullYear()+'-'+String(paris.getMonth()+1).padStart(2,'0')+'-'+String(paris.getDate()).padStart(2,'0');
      paris.setDate(paris.getDate()-1);
      const yesterday = paris.getFullYear()+'-'+String(paris.getMonth()+1).padStart(2,'0')+'-'+String(paris.getDate()).padStart(2,'0');
      if (s.lastDate === today || s.lastDate === yesterday) return s.count || 0;
      return 0;
    } catch { return 0; }
  });
  const [streakBest, setStreakBest] = useState(() => {
    try { return JSON.parse(localStorage.getItem("bb_day_streak")||"{}").best || 0; } catch { return 0; }
  });
  const [streakFreezes, setStreakFreezes] = useState(() => {
    try { return JSON.parse(localStorage.getItem("bb_day_streak")||"{}").freezes || 0; } catch { return 0; }
  });
  const [streakJustIncreased, setStreakJustIncreased] = useState(false);

  // Détection : la streak est-elle en danger (doit jouer aujourd'hui avant minuit) ?
  // Elle est en danger si : streak > 0, pas joué aujourd'hui, il est plus de 18h à Paris
  const streakInDanger = (() => {
    if (dayStreak === 0) return false;
    try {
      const s = JSON.parse(localStorage.getItem("bb_day_streak")||"{}");
      const today = todayParis();
      if (s.lastDate === today) return false; // déjà joué aujourd'hui
      const now = new Date();
      const paris = new Date(now.toLocaleString('en-US',{timeZone:'Europe/Paris'}));
      return paris.getHours() >= 18;
    } catch { return false; }
  })();
  const [streakUsedFreeze, setStreakUsedFreeze] = useState(false);
  const [showStreakDetail, setShowStreakDetail] = useState(false);
  const [lbDiff, setLbDiff] = useState("facile");
  const [playerName, setPlayerName] = useState("");
  const [showInstructions, setShowInstructions] = useState(null);
  const [isDesktop, setIsDesktop] = useState(()=>typeof window!=="undefined" && window.innerWidth >= 768);
  useEffect(()=>{
    const handler = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Auto-start d'un jeu depuis l'URL (?play=pont|chaine|grid)
  // Utilisé par la landing desktop pour entrer directement dans un mode.
  // useLayoutEffect : tourne avant le paint donc le home ne flashe pas.
  const launchedFromLandingRef = useRef(false);
  const duelsFromLandingRef = useRef(false); // true si le salon de défis a été ouvert depuis la landing
  const friendsFromLandingRef = useRef(false); // true si le panneau amis a été ouvert depuis la landing
  // Ferme le salon de défis ; si ouvert depuis la landing, on rend la main à la landing
  function closeOpenDuels() {
    setShowOpenDuels(false); setOpenDuelChooser(false);
    if (duelsFromLandingRef.current) {
      duelsFromLandingRef.current = false;
      try { window.dispatchEvent(new CustomEvent("goatfc:back-to-landing")); } catch(e) {}
    }
  }
  // Ferme le panneau amis ; si ouvert depuis la landing, on rend la main à la landing
  function closeFriends() {
    setShowFriends(false); setFriendMsg(""); setSelectedFriend(null);
    if (friendsFromLandingRef.current) {
      friendsFromLandingRef.current = false;
      try { window.dispatchEvent(new CustomEvent("goatfc:back-to-landing")); } catch(e) {}
    }
  }
  // Bot adversaire (mode EN LIGNE depuis la landing) : pseudo + flag + score généré
  const botOpponentRef = useRef(null);
  const botScoreRef = useRef(null);
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const play = params.get("play");
    const reqRoom = params.get("room");
    const reqDuels = params.get("duels");
    const reqFriends = params.get("friends");
    if (!play && !reqRoom && !reqDuels && !reqFriends) return;
    launchedFromLandingRef.current = true;
    // Skip le splash 2.5s : on rentre direct dans le jeu
    setShowSplash(false);
    // ?duels=1 : ouvrir directement le salon de défis ouverts (pas de partie lancée)
    if (reqDuels === "1") {
      try { localStorage.setItem("bb_welcome_seen","1"); localStorage.setItem("bb_tutorial_done","1"); } catch(e) {}
      duelsFromLandingRef.current = true;
      const wantMine = params.get("duelstab") === "mine";
      try { window.history.replaceState({}, "", window.location.pathname); } catch(e) {}
      setOpenDuelChooser(false);
      setOpenTab(wantMine ? "mine" : "browse");
      loadOpenDuels(); loadMyOpenDuels(wantMine); loadReceivedChallenges(); // wantMine -> marque les tentatives comme vues
      setShowOpenDuels(true);
      return;
    }
    // ?friends=1 : ouvrir directement le panneau amis (demandes reçues visibles)
    if (reqFriends === "1") {
      try { localStorage.setItem("bb_welcome_seen","1"); localStorage.setItem("bb_tutorial_done","1"); } catch(e) {}
      friendsFromLandingRef.current = true;
      try { window.history.replaceState({}, "", window.location.pathname); } catch(e) {}
      requirePseudo(function(){
        setSelectedFriend(null);
        loadFriends().then(function(ids){fetchFriendScores(ids);});
        loadDuels();
        loadFriendRequests();
        setShowFriends(true);
      });
      return;
    }
    // Skip aussi le welcome RGPD et le tutorial : l'utilisateur arrive
    // depuis la landing desktop qui a déjà ses propres tutos/about.
    // Il peut toujours rouvrir le tuto depuis le menu interne du jeu.
    try {
      localStorage.setItem("bb_welcome_seen", "1");
      localStorage.setItem("bb_tutorial_done", "1");
    } catch (e) {}
    // ?room=CODE : on laisse l'autre useEffect (ligne ~4220) lire le code
    // et lancer joinRoom — pas besoin d'autre logique ici.
    if (reqRoom && !play) {
      return;
    }
    // Difficulté choisie côté landing (?diff=facile|moyen|expert)
    const reqDiffRaw = params.get("diff");
    const reqDiff =
      reqDiffRaw === "facile" || reqDiffRaw === "moyen" || reqDiffRaw === "expert"
        ? reqDiffRaw
        : null;
    if (reqDiff) setDiff(reqDiff);
    // Bot adversaire depuis la landing (?bot=Pseudo&flag=🇫🇷&avatar=/win1.png) — mode EN LIGNE
    const botPseudo = params.get("bot");
    const botFlag = params.get("flag");
    const botAvatar = params.get("avatar");
    if (botPseudo && botFlag) {
      botOpponentRef.current = { pseudo: botPseudo, country: botFlag, avatar: botAvatar };
    }
    // Mode multi demandé depuis la landing (?multi=create) — on ouvre la création de salon
    const reqMulti = params.get("multi");
    try {
      window.history.replaceState({}, "", window.location.pathname);
    } catch (e) {}
    try {
      if (reqMulti === "create" && (play === "pont" || play === "chaine" || play === "plug" || play === "mercato")) {
        const mode = (play === "chaine" || play === "mercato") ? "chaine" : "pont";
        setGameMode(mode);
        setDuelMode(mode);
        if (reqDiff) setDuelDiff(reqDiff);
        setDuelRounds(3);
        setShowRoomCreate(true);
        return;
      }
      if (play === "pont" || play === "plug") {
        setGameMode("pont");
        startRound(1, reqDiff);
      } else if (play === "chaine" || play === "mercato") {
        setGameMode("chaine");
        startChain(reqDiff);
      } else if (play === "grid" || play === "goatgrid") {
        ggStartGame();
      } else if (play === "duel" || play === "goatduel") {
        // GOAT Duel : on ouvre son menu (solo / en ligne / entre potes),
        // exactement comme la carte du carrousel mobile.
        requirePseudo(function(){ setDuelError(""); setDuelJoinCode(""); setDuelScreen("menu"); });
      }
    } catch (e) {
      console.warn("autostart failed:", e);
    }
  }, []);

  // Si on a auto-started depuis la landing et que l'utilisateur revient au home
  // de LePont (← interne, fin de partie, etc.), on émet un event pour que
  // la landing ferme l'overlay et reprenne le contrôle.
  const wasInGameRef = useRef(false);
  useEffect(() => {
    if (!launchedFromLandingRef.current) return;
    const inGame =
      screen === "game" ||
      screen === "lobby" ||
      screen === "final" ||
      screen === "chainGame" ||
      screen === "chainEnd" ||
      showGoatGrid ||
      // GOAT Duel vit dans son propre overlay : sans lui, fermer le duel laissait
      // l'utilisateur sur l'accueil de LePont au lieu de rendre la main à la landing.
      !!duelScreen ||
      (ggBattleScreen && ggBattleScreen === "playing");
    if (inGame) {
      wasInGameRef.current = true;
      return;
    }
    if (wasInGameRef.current && screen === "home" && !showGoatGrid && !duelScreen) {
      window.dispatchEvent(new CustomEvent("goatfc:back-to-landing"));
      launchedFromLandingRef.current = false;
      wasInGameRef.current = false;
    }
  }, [screen, showGoatGrid, ggBattleScreen, duelScreen]);

  // Lock viewport : empêche zoom utilisateur, scroll horizontal, overscroll
  // pour que l'app se comporte comme une app native en PWA sur téléphone
  useEffect(()=>{
    // Viewport meta — écrase/complète celui de index.html
    // NOTE: pas de viewport-fit=cover pour que le splash screen iOS s'affiche normalement
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'viewport'; document.head.appendChild(meta); }
    meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no');

    // iOS : mode web-app plein écran (fallback, iOS ignore manifest display)
    let appleCap = document.querySelector('meta[name="apple-mobile-web-app-capable"]');
    if (!appleCap) { appleCap = document.createElement('meta'); appleCap.name = 'apple-mobile-web-app-capable'; appleCap.content = 'yes'; document.head.appendChild(appleCap); }
    // Retire toute balise status-bar-style=black-translucent qui serait dans index.html
    // (cause du bug splash screen "trop haut")
    document.querySelectorAll('meta[name="apple-mobile-web-app-status-bar-style"]').forEach(m => m.remove());

    // Styles globaux pour bloquer scroll horizontal et overscroll rebound
    const styleId = 'bb-lock-viewport';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        html, body, #root {
          overflow-x: hidden;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }
        html, body { max-width: 100vw; position: relative; }
        /* overscroll-behavior:none uniquement sur mobile pour éviter le pull-to-refresh */
        @media (hover: none) and (pointer: coarse) {
          html, body, #root { overscroll-behavior: none; }
        }
        * { -webkit-touch-callout: none; }
      `;
      document.head.appendChild(style);
    }

    // Bloque le pinch-zoom iOS (où user-scalable=no est parfois ignoré par Safari)
    // Ces listeners sont uniquement nécessaires sur mobile/tablette tactile
    // Sur desktop (Mac/Windows), certains trackpads (Magic Trackpad) génèrent des touch events
    // qui peuvent interférer avec le scroll de la page — on les désactive
    const isTouchDevice = typeof window !== "undefined" && (
      ('ontouchstart' in window) || (navigator.maxTouchPoints > 0)
    );
    const isDesktopDevice = typeof window !== "undefined" && window.innerWidth >= 768 && !isTouchDevice;
    const preventZoom = (e) => { if (e.touches && e.touches.length > 1) e.preventDefault(); };
    const preventDblTap = (e) => e.preventDefault();
    if (!isDesktopDevice) {
      document.addEventListener('gesturestart', preventDblTap);
      document.addEventListener('touchmove', preventZoom, { passive: false });
    }
    return () => {
      if (!isDesktopDevice) {
        document.removeEventListener('gesturestart', preventDblTap);
        document.removeEventListener('touchmove', preventZoom);
      }
    };
  }, []);

  const [lang, setLang] = useState(() => {
    try {
      const saved = localStorage.getItem("bb_lang");
      if (saved === "fr" || saved === "en" || saved === "de" || saved === "it" || saved === "pt") return saved;
      // Pas de choix enregistré : on détecte la langue du navigateur (FR / EN / DE / IT / PT),
      // sinon on retombe sur le français (public cible historique).
      const nav = ((navigator.language || navigator.userLanguage || "") + "").toLowerCase();
      if (nav.indexOf("de") === 0) return "de";
      if (nav.indexOf("it") === 0) return "it";
      if (nav.indexOf("pt") === 0) return "pt";
      if (nav.indexOf("en") === 0) return "en";
      return "fr";
    } catch { return "fr"; }
  });
  const setLanguage = (l) => {
    setLang(l);
    try { localStorage.setItem("bb_lang", l); } catch {}
  };
  // Helper i18n 5 langues : tr(français, anglais, allemand, italien, portugais). Une langue
  // non encore fournie retombe sur l'anglais puis le français (déploiement par lots).
  const tr = (fr, en, de, it, pt) => {
    if (lang === "de") return de != null ? de : (en != null ? en : fr);
    if (lang === "it") return it != null ? it : (en != null ? en : fr);
    if (lang === "pt") return pt != null ? pt : (en != null ? en : fr);
    if (lang === "en") return en != null ? en : fr;
    return fr;
  };
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  // Friends
  const [playerId] = useState(() => getPlayerId());
  // Ping "présence" (bb_events) — capte AUSSI les joueurs anonymes, 1× par jour/appareil.
  // Le drapeau anti-doublon n'est posé qu'après un POST réussi (voir pingPresence),
  // pour ne pas "perdre" un appareil dont le 1er ping de la journée aurait échoué.
  useEffect(function(){ pingPresence(); }, []);
  // Mesure du temps réellement passé dans l'app (voir trackTime).
  useEffect(function(){ trackTime(); }, []);
  // Battement "en ligne maintenant" : toutes les 30 s tant que l'app est visible.
  useEffect(function(){
    pingLive();
    const iv = setInterval(function(){ if (document.visibilityState === "visible") pingLive(); }, 30000);
    const onVis = function(){ if (document.visibilityState === "visible") pingLive(); };
    document.addEventListener("visibilitychange", onVis);
    return function(){ clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, []);
  const [showFriends, setShowFriends] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null); // {id, name}
  const [viewedProfile, setViewedProfile] = useState(null); // {id, name} - profile being viewed
  const [viewedProfileData, setViewedProfileData] = useState(null); // fetched stats
  const [profileReturn, setProfileReturn] = useState(null); // "leaderboard" | "friends" | null : d'où on a ouvert le profil (pour la flèche retour)
  const [confirmRemove, setConfirmRemove] = useState(null); // {id, name}
  const [friendInput, setFriendInput] = useState("");
  const [friendsList, setFriendsList] = useState([]);
  const [friendScores, setFriendScores] = useState([]);
  const [friendMsg, setFriendMsg] = useState("");
  const [friendLoading, setFriendLoading] = useState(false);
  const [friendRequests, setFriendRequests] = useState([]); // incoming pending requests
  const [sentRequests, setSentRequests] = useState(function(){ try { return JSON.parse(localStorage.getItem("bb_pending_sent") || "[]"); } catch { return []; } });     // requests I sent
  // Duels
  const [duels, setDuels] = useState([]);
  const [showDuelHistory, setShowDuelHistory] = useState(false); // écran historique des défis
  const [duelLoading, setDuelLoading] = useState(false);
  const [showDuelCreate, setShowDuelCreate] = useState(null); // friend object
  const [duelMode, setDuelMode] = useState("pont");
  const [duelDiff, setDuelDiff] = useState("facile");
  const [duelRounds, setDuelRounds] = useState(1);
  const [activeDuel, setActiveDuel] = useState(null); // duel being played
  const activeDuelRef = useRef(null);
  const [duelResult, setDuelResult] = useState(null); // completed duel for result screen
  const [waitingDuel, setWaitingDuel] = useState(null); // duel in waiting room
  // ─── Défis ouverts (salon de duels asynchrones) ───
  const [showOpenDuels, setShowOpenDuels] = useState(false);
  const [openDuels, setOpenDuels] = useState([]);
  const [openDuelChooser, setOpenDuelChooser] = useState(false); // écran de choix mode/diff pour lancer un défi
  // Défis NOMINATIFS reçus (status "sent", opponent_id = moi) : asynchrones,
  // contrairement à createDuel() qui ouvre une salle d'attente temps réel.
  const [receivedChallenges, setReceivedChallenges] = useState([]);
  const [duelTarget, setDuelTarget] = useState(null); // {id,name} quand on défie quelqu'un en particulier
  const [openNotif, setOpenNotif] = useState(null); // bannière de confirmation "défi posté"
  const [openTab, setOpenTab] = useState("browse"); // onglet du salon : "browse" | "mine"
  const [myOpenChallenges, setMyOpenChallenges] = useState([]); // mes défis encore ouverts
  const [myOpenAttempts, setMyOpenAttempts] = useState([]); // tentatives reçues sur mes défis
  const [openUnseenCount, setOpenUnseenCount] = useState(0); // tentatives non vues (pastille)
  // Room system (multi-player up to 8)
  const [room, setRoom] = useState(null);
  const [roomInput, setRoomInput] = useState("");
  const [pendingRoomCode, setPendingRoomCode] = useState(null);
  const [roomMsg, setRoomMsg] = useState("");const [abandonNotif, setAbandonNotif] = useState("");
  const [showRoomCreate, setShowRoomCreate] = useState(false);
  const roomPollRef = useRef(null);
  const [duelCountdown, setDuelCountdown] = useState(null); // 3..2..1 before launch
  const duelPollRef = useRef(null);
  const countdownRef = useRef(null);

  const [qTimeLeft, setQTimeLeft] = useState(5);
  const [pseudoScreen, setPseudoScreen] = useState(false); // show pseudo creation screen
  // Code de récupération : stocké en localStorage après création pour retrouver son compte
  const [recoveryCode, setRecoveryCode] = useState(() => { try { return localStorage.getItem("bb_recovery_code") || ""; } catch { return ""; } });
  const [showRecoveryCodeModal, setShowRecoveryCodeModal] = useState(null); // {code:"GOATFC-XXXX-YYYY"} pour affichage après création
  const [showRecoveryInput, setShowRecoveryInput] = useState(false); // modal de récupération (input du code)
  const [recoveryInput, setRecoveryInput] = useState("");
  const [recoveryMsg, setRecoveryMsg] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [showMyRecoveryCode, setShowMyRecoveryCode] = useState(false); // affichage du code depuis le profil
  const [recoveryConfirmed, setRecoveryConfirmed] = useState(false); // checkbox "j'ai noté mon code"
  const [pseudoInput, setPseudoInput] = useState("");
  const [pseudoChecking, setPseudoChecking] = useState(false);
  const [pseudoMsg, setPseudoMsg] = useState("");
  const [playerAvatar, setPlayerAvatar] = useState(null);
  const [playerXp, setPlayerXp] = useState(0); // XP cumulé (lifetime), chargé depuis Supabase au démarrage et incrémenté après chaque partie
  const [playerXpSeason, setPlayerXpSeason] = useState(0); // XP du mois en cours, reset à chaque début de mois
  // ─── Collection de cartes ───────────────────────────────────────────────────
  // Les cartes possédées se DÉDUISENT de playerXp (voir lib/collection) : seul
  // le badge choisi est stocké. Repli sur localStorage tant que la colonne
  // `badge` n'existe pas côté Supabase (docs/supabase-badges.sql).
  const [playerBadge, setPlayerBadge] = useState(function(){ try { return localStorage.getItem("bb_badge") || null; } catch (e) { return null; } });
  const [showCollection, setShowCollection] = useState(false);
  const [cardPopup, setCardPopup] = useState(null);   // carte tout juste débloquée
  const [badgeByPid, setBadgeByPid] = useState({});   // pid → {badge, xp} pour le classement
  // Badge du joueur, lu à part du gros select (une colonne absente ferait
  // échouer toute la requête, cf. PSEUDO_COLS).
  useEffect(function(){
    if (!playerId) return;
    let stop = false;
    (async function(){
      const rows = await sbFetch("bb_pseudos?player_id=eq." + playerId + "&select=badge&limit=1");
      if (stop || !Array.isArray(rows) || !rows.length) return; // colonne absente → on garde le choix local
      const id = rows[0].badge || null;
      setPlayerBadge(id);
      try { id ? localStorage.setItem("bb_badge", id) : localStorage.removeItem("bb_badge"); } catch (e) {}
    })();
    return function(){ stop = true; };
  }, [playerId]);
  // Badges des autres joueurs, pour les afficher dans le classement. Une seule
  // requête à l'ouverture, plutôt que de faire circuler le champ dans toute
  // l'agrégation du classement. `xp` sert à valider le badge (cf. badgeToShow).
  useEffect(function(){
    if (!showLeaderboard) return;
    let stop = false;
    (async function(){
      const rows = await sbFetch("bb_pseudos?select=player_id,badge,xp&badge=not.is.null&limit=2000");
      if (stop || !Array.isArray(rows)) return;
      const map = {};
      for (const r of rows) if (r.player_id) map[r.player_id] = { badge: r.badge, xp: r.xp || 0 };
      setBadgeByPid(map);
    })();
    return function(){ stop = true; };
  }, [showLeaderboard]);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [viewingAvatar, setViewingAvatar] = useState(null); // URL de la photo à visualiser en plein écran
  const [cropState, setCropState] = useState(null); // {url, scale, x, y, naturalW, naturalH} — état du cropper
  const [pseudoConfirmed, setPseudoConfirmed] = useState(() => { try { const n = localStorage.getItem("bb_name"); return !!(n && n.trim().length >= 2); } catch { return false; } });
  // Charge mes défis ouverts en entrant sur l'accueil (pour la pastille de tentatives non vues)
  // NB: placé après la déclaration de pseudoConfirmed pour éviter une TDZ ReferenceError.
  useEffect(function(){
    if (screen === "home" && pseudoConfirmed) { loadMyOpenDuels(); loadReceivedChallenges(); }
  }, [screen, pseudoConfirmed]);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [gameConfigModal, setGameConfigModal] = useState(null);
  const [activeCard, setActiveCard] = useState("pont");
  const [swipeDelta, setSwipeDelta] = useState(0); // "pont" | "chaine" | "room-pont" | "room-chaine"
  // Matchmaking du mode EN LIGNE (mobile) : {mode, opponent, phase}
  // phase = "searching" (recherche animée) → "found" (adversaire révélé) → partie
  const [mmSearch, setMmSearch] = useState(null);
  const [waitingForRoom, setWaitingForRoom] = useState(false);
  const [waitingAfterAbandon, setWaitingAfterAbandon] = useState(false);
  const [abandonedAfterOppLeft, setAbandonedAfterOppLeft] = useState(false);
  const qTimerRef = useRef(null);
  const chainPassedRef = useRef(false);
  const handlePassRef = useRef(null);
  const handleChainPassRef = useRef(null);
  const roundStartTime = useRef(null);
  const seenInstructions = useRef(new Set());
  const timerRef = useRef(null);
  const inputRef = useRef(null);
  const scoreRef = useRef(0);
  const chainScoreRef = useRef(0);
  const comboRef = useRef(0);
  const lastAnswerTime = useRef(Date.now());
  const historyEndRef = useRef(null);
  const hasEndedRef = useRef(false);
  const queueRef = useRef([]);
  // Mémoire des paires jouées dans les manches précédentes (reset entre parties)
  // Pour empêcher que la manche 2 reprenne les mêmes questions que la manche 1
  const playedPairsRef = useRef(new Set());
  const chainLogoRef = useRef({});


  useEffect(() => {
    try {
      const cachedAvatar = localStorage.getItem("bb_avatar_url");
      if (cachedAvatar) setPlayerAvatar(cachedAvatar);
      else {
        // Try fetching from Supabase
        const url = SB_URL + "/storage/v1/object/public/avatars/" + playerId + ".jpg";
        fetch(url, { method: "HEAD" }).then(r => {
          if (r.ok) {
            const withBust = url + "?t=" + Date.now();
            setPlayerAvatar(withBust);
            try { localStorage.setItem("bb_avatar_url", withBust); } catch {}
          }
        }).catch(()=>{});
      }
      const r = localStorage.getItem("bb_record"); if(r) setRecord(JSON.parse(r));
      const cr = localStorage.getItem("bb_chain_record"); if(cr) setChainRecord(JSON.parse(cr));
      const n = localStorage.getItem("bb_name"); if(n) setPlayerName(n);
      const seen = localStorage.getItem("bb_seen"); if(seen) JSON.parse(seen).forEach(s=>seenInstructions.current.add(s));
    } catch {}
    loadLeaderboard("pont");
    loadFriends().then(function(ids){fetchFriendScores(ids);});
    loadDuels();
    loadFriendRequests();
    loadSeasons();
    checkAndCloseSeason();
    // Fetch la blacklist des joueurs signalés buggés pour le défi du jour
    // Si le joueur du jour est dans la blacklist (≥3 signalements), on le remplace
    (async function() {
      try {
        const reports = await sbFetch("bb_reports?select=player_name&report_type=eq.daily_bug&limit=2000");
        if (!Array.isArray(reports) || reports.length === 0) return;
        const counts = {};
        reports.forEach(function(r) {
          if (r.player_name) counts[r.player_name] = (counts[r.player_name] || 0) + 1;
        });
        const blacklisted = new Set(Object.keys(counts).filter(n => counts[n] >= 3));
        if (blacklisted.size === 0) return;
        // Remplacer le joueur du jour s'il est blacklisté
        setDailyPlayer(prev => {
          if (prev && blacklisted.has(prev.name)) {
            return getDailyPlayer(blacklisted);
          }
          return prev;
        });
      } catch(e) { /* silent, fallback sur pool sans blacklist */ }
    })();
    // Auto-join depuis lien ?room=XXXXXX
    try {
      const params = new URLSearchParams(window.location.search);
      const roomCode = params.get("room");
      if (roomCode) {
        window.history.replaceState({}, "", window.location.pathname);
        setRoomInput(roomCode.toUpperCase());
        setPendingRoomCode(roomCode.toUpperCase());
      }
    } catch {}
    // Fermer le splash après 2.5s
    setTimeout(function(){setShowSplash(false);}, 2500);
    // Bannière de bienvenue RGPD au tout premier lancement (avant le tutoriel)
    try {
      if (!localStorage.getItem("bb_welcome_seen")) {
        setShowWelcome(true);
      } else if (!localStorage.getItem("bb_tutorial_done")) {
        setShowTutorial(true);
      }
    } catch {}
  }, []);


  // Load pseudo silently on mount
  useEffect(() => {
    (async function() {
      try {
        const mine = await sbFetch("bb_pseudos?player_id=eq."+playerId+"&select="+PSEUDO_COLS+"&limit=1");
        if (Array.isArray(mine) && mine.length > 0) {
          setPlayerName(mine[0].pseudo);
          try { localStorage.setItem("bb_name", mine[0].pseudo); } catch {}
          setPseudoConfirmed(true);
          // Charger XP cumulé depuis Supabase (0 si colonne vide ou pas encore créée)
          if (typeof mine[0].xp === "number") setPlayerXp(mine[0].xp);
          // Charger XP saison : si le mois stocké correspond au mois en cours, on garde. Sinon reset à 0.
          try {
            const currentMonth = getCurrentSeason().monthKey;
            const storedMonth = mine[0].xp_season_month;
            if (storedMonth === currentMonth && typeof mine[0].xp_season === "number") {
              setPlayerXpSeason(mine[0].xp_season);
            } else {
              // Nouveau mois (ou première fois) : reset à 0 et sync Supabase
              setPlayerXpSeason(0);
              if (storedMonth !== currentMonth) {
                // Reset côté serveur pour que ça soit cohérent pour les autres lectures
                sbFetch("bb_pseudos?player_id=eq." + playerId, {
                  method: "PATCH",
                  headers: { "Content-Type":"application/json", "Prefer":"return=minimal" },
                  body: JSON.stringify({ xp_season: 0, xp_season_month: currentMonth })
                }).catch(()=>{});
              }
            }
          } catch(e) {}
          // Charger streak Supabase et réconcilier avec localStorage (le plus élevé gagne)
          try {
            const localS = JSON.parse(localStorage.getItem("bb_day_streak")||"{}");
            const remote = {
              count: mine[0].streak_count || 0,
              lastDate: mine[0].streak_last_date || null,
              best: mine[0].streak_best || 0,
              freezes: mine[0].streak_freezes || 0
            };
            // Prendre la source qui a la date la plus récente
            let winner;
            if (!localS.lastDate && !remote.lastDate) winner = null;
            else if (!localS.lastDate) winner = remote;
            else if (!remote.lastDate) winner = localS;
            else winner = (remote.lastDate >= localS.lastDate) ? remote : localS;
            if (winner) {
              // Le "best" est toujours le max des deux
              winner.best = Math.max(localS.best||0, remote.best||0, winner.count||0);
              localStorage.setItem("bb_day_streak", JSON.stringify(winner));
              setDayStreak(winner.count||0);
              setStreakBest(winner.best||0);
              setStreakFreezes(winner.freezes||0);
            }
          } catch(e){}
        } else {
          const saved = localStorage.getItem("bb_name");
          if (saved && saved.trim().length >= 2) setPlayerName(saved);
        }
      } catch {}
    })();
  }, []);

  // Capture l'event beforeinstallprompt (Android) pour pouvoir déclencher l'installation à notre timing
  useEffect(() => {
    function onBeforeInstall(e) {
      e.preventDefault();
      setDeferredInstall(e);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  // Détermine si on doit proposer l'installation (gros modal)
  // Conditions :
  // - App pas installée, pseudo confirmé
  // - Pas déjà dismissed dans cette session (ref qui reset au reload de la page)
  // - Dernière dismiss > 14 jours
  // - User a joué au moins 1 partie (record ou défi du jour réussi) — pour éviter prompt en tout début
  useEffect(() => {
    if (isStandalone()) return; // Déjà installée
    if (!pseudoConfirmed) return;
    if (installDismissedThisSession.current) return; // Déjà fermé pendant cette session
    try {
      const dismissed = localStorage.getItem("bb_install_dismissed");
      if (dismissed) {
        const elapsed = Date.now() - parseInt(dismissed, 10);
        if (elapsed < 14 * 24 * 60 * 60 * 1000) return; // 14 jours au lieu de 7
      }
      // On attend que le user ait joué au moins 1 partie ou complété le défi du jour
      const hasRecord = (record && record.score > 0) || (chainRecord && chainRecord.score > 0);
      const hasPlayedDaily = dailyDone;
      if (!hasRecord && !hasPlayedDaily) return;
      // Sur iOS : trigger dès la 1ère partie (incitation forte car notifs = installation obligatoire)
      // Sur Android / desktop : trigger si streak >= 3 OU event d'installation dispo
      const shouldShow = isIOS() || (dayStreak >= 3 || deferredInstall);
      if (shouldShow) {
        const t = setTimeout(() => setShowInstallPrompt(true), 1500);
        return () => clearTimeout(t);
      }
    } catch {}
  }, [pseudoConfirmed, dayStreak, deferredInstall, record, chainRecord, dailyDone]);

  // Détermine si on doit proposer d'activer les notifications push
  // Conditions : app déjà installée OU streak >= 2, et permission pas encore accordée/refusée
  useEffect(() => {
    if (!pseudoConfirmed) return;
    if (typeof Notification === "undefined") return; // Pas de support
    if (Notification.permission !== "default") return; // Déjà accordé/refusé, on ne redemande pas
    try {
      const dismissed = localStorage.getItem("bb_notif_dismissed");
      if (dismissed) {
        const elapsed = Date.now() - parseInt(dismissed, 10);
        if (elapsed < 3 * 24 * 60 * 60 * 1000) return; // Re-demander après 3 jours
      }
      // Montrer si l'app est installée OU si le user a une streak >= 2
      const hasRecord = (record && record.score > 0) || (chainRecord && chainRecord.score > 0);
      if (isStandalone() || dayStreak >= 2 || hasRecord) {
        const t = setTimeout(() => setShowNotifPrompt(true), 2500);
        return () => clearTimeout(t);
      }
    } catch {}
  }, [pseudoConfirmed, dayStreak, record, chainRecord]);

  // Poll for friend requests and duels every 15s
  useEffect(() => {
    const poll = setInterval(function() {
      loadFriendRequests();
      loadDuels();
    }, 15000);
    return () => {
      clearInterval(poll);
      clearInterval(duelPollRef.current);
      clearInterval(countdownRef.current);
    };
  }, []);

  useEffect(()=>{scoreRef.current=score;},[score]);

  // Auto-join room une fois le pseudo confirmé
  useEffect(()=>{
    if(pseudoConfirmed && pendingRoomCode) {
      setPendingRoomCode(null);
      setTimeout(function(){ joinRoom(pendingRoomCode); }, 500);
    }
  },[pseudoConfirmed, pendingRoomCode]);
  useEffect(()=>{comboRef.current=combo;},[combo]);
  useEffect(()=>{if(historyEndRef.current)historyEndRef.current.scrollIntoView({behavior:"smooth"});},[chainHistory]);

  // Timer

  // Timer par question supprimé : on garde uniquement le timer global de 90 secondes par manche.
  // Les users peuvent prendre leur temps pour chaque joueur, tant qu'il reste du temps dans la manche.
  // Le useEffect reste pour initialiser l'état interne mais ne lance plus de countdown.
  useEffect(()=>{
    chainPassedRef.current = false;
    clearInterval(qTimerRef.current);
  },[screen,animKey,chainCount]);

  useEffect(()=>{
    if(screen!=="game"&&screen!=="chainGame"){hasEndedRef.current=false;return;}
    hasEndedRef.current=false;
    clearInterval(timerRef.current);
    const duration = screen==="chainGame" ? CHAIN_DURATION : ROUND_DURATION;
    roundStartTime.current = Date.now();
    timerRef.current=setInterval(()=>{
      if(!roundStartTime.current) roundStartTime.current = Date.now();
      const elapsed = Math.floor((Date.now() - roundStartTime.current) / 1000);
      const remaining = Math.max(duration - elapsed, 0);
      setTimeLeft(remaining);
    },500);
    return()=>clearInterval(timerRef.current);
  },[screen,currentRound]);

  useEffect(()=>{
    if((screen!=="game"&&screen!=="chainGame")||timeLeft>0||hasEndedRef.current)return;
    hasEndedRef.current=true;
    
    if(screen==="game")endRound();
    else endChain();
  },[screen,timeLeft]);

  // Quand l'utilisateur arrive sur l'écran home, on check s'il y a un grade up en attente
  // Ça s'affiche 800ms après être revenu sur l'accueil pour un meilleur effet dramatique
  useEffect(function(){
    if(screen!=="home") return;
    let timeoutId;
    try {
      const pending = localStorage.getItem("bb_pending_grade_up");
      if(pending) {
        const grade = JSON.parse(pending);
        localStorage.removeItem("bb_pending_grade_up");
        timeoutId = setTimeout(function(){
          setGradeUpPopup(grade);
          setShowConfetti(true);
          setTimeout(function(){setShowConfetti(false);},4000);
        },800);
      }
    } catch {}
    return function(){ if(timeoutId) clearTimeout(timeoutId); };
  },[screen, playerXp]);


  // Leaderboard (localStorage)
  // ── DUEL FUNCTIONS ──
  async function openUserProfile(id, name, from) {
    setViewedProfile({ id, name });
    setViewedProfileData(null);
    setProfileReturn(from || null); // mémorise l'origine pour la flèche retour
    setScreen("userProfile");
    // Compute sync data first
    const lbData = leaderboard.find(e => e.pid === id);
    // Historique tête-à-tête normalisé {mode, diff, my, opp, when} — duels 1v1
    // (les parties en salon partagées sont ajoutées plus bas, après fetch).
    const duelRows = duels.filter(d =>
      d.status === "complete" &&
      ((d.challenger_id === playerId && d.opponent_id === id) ||
       (d.opponent_id === playerId && d.challenger_id === id))
    ).map(d => {
      const isChal = d.challenger_id === playerId;
      return { mode:d.mode, diff:d.diff, my:isChal?d.challenger_score:d.opponent_score, opp:isChal?d.opponent_score:d.challenger_score, when:d.created_at };
    });
    let myWins = 0, myLosses = 0, draws = 0;
    duelRows.forEach(x => { if((x.my||0)>(x.opp||0)) myWins++; else if((x.my||0)<(x.opp||0)) myLosses++; else draws++; });
    const avatarUrl = SB_URL + "/storage/v1/object/public/avatars/" + id + ".jpg";
    // Set data immediately — avatar will just 404 if no photo, <img> onError handles it
    setViewedProfileData({
      avatar: avatarUrl,
      score: lbData ? lbData.score : 0,
      xp: lbData ? (lbData.xp || 0) : 0, // XP cumulée pour afficher le vrai grade du joueur
      rank: lbData ? leaderboard.findIndex(e => e.pid === id) + 1 : null,
      played: lbData ? lbData.played : 0,
      bestPont: lbData ? lbData.bestPont : 0,
      bestChaine: lbData ? lbData.bestChaine : 0,
      wins: lbData ? lbData.wins : 0,
      draws: lbData ? lbData.draws : 0,
      losses: lbData ? lbData.losses : 0,
      duelsWith: duelRows,
      myWins,
      myLosses,
      duelsDraws: draws,
      isFriend: friendsList.includes(id),
      requestSent: sentRequests.some(function(r){return r.to_id===id && r.status==="pending";}),
    });
    // Fetch le pseudo actuel depuis bb_pseudos (source de vérité)
    // pour afficher le bon nom même si l'user l'a changé après ses parties
    try {
      const userData = await sbFetch("bb_pseudos?player_id=eq."+id+"&select=pseudo,xp&limit=1");
      if (Array.isArray(userData) && userData.length > 0) {
        const currentPseudo = userData[0].pseudo;
        if (currentPseudo && currentPseudo !== name) {
          setViewedProfile({ id, name: currentPseudo });
        }
        // XP cumulée = source de vérité pour la carte "XP" et le grade,
        // quel que soit l'onglet du classement chargé.
        setViewedProfileData(function(prev){ return prev ? {...prev, xp: userData[0].xp || 0} : prev; });
      }
    } catch {}
    // Records réels depuis bb_scores (source de vérité) — indépendant du leaderboard
    // en mémoire (qui, en mode global, remplace le score par l'XP et met les records
    // à 0 pour les joueurs ajoutés via le fallback XP). Corrige "Record Plug/Mercato 0"
    // alors que le joueur a bien des scores.
    try {
      const scores = await sbFetch("bb_scores?player_id=eq."+id+"&select=score,mode&order=score.desc&limit=1000");
      // Parties GOAT Grid (table séparée) pour compter le total réel de parties
      let ggCount = 0;
      try { const gg = await sbFetch("bb_gg_scores?player_id=eq."+id+"&select=id&limit=1000"); if (Array.isArray(gg)) ggCount = gg.length; } catch {}
      if (Array.isArray(scores)) {
        let bp = 0, bc = 0;
        scores.forEach(function(s){
          if (s.mode === "pont" && s.score > bp) bp = s.score;
          if (s.mode === "chaine" && s.score > bc) bc = s.score;
        });
        // "Parties" = nombre réel de parties jouées (Plug + Mercato + Grid), et
        // non le nombre de modes avec un record.
        setViewedProfileData(function(prev){ return prev ? {...prev, bestPont:bp, bestChaine:bc, played:scores.length + ggCount} : prev; });
      }
    } catch {}
    // Parties en salon (multijoueur) partagées avec ce joueur : elles comptent
    // aussi dans le tête-à-tête. Avant, seuls les duels 1v1 étaient pris en
    // compte, d'où "aucun duel" alors qu'on a joué ensemble en salon.
    try {
      const rooms = await sbFetch("bb_rooms?status=eq.complete&select=mode,diff,players,created_at&order=created_at.desc&limit=150");
      if (Array.isArray(rooms)) {
        const roomRows = [];
        for (const r of rooms) {
          let pls = r.players;
          if (typeof pls === "string") { try { pls = JSON.parse(pls); } catch { pls = []; } }
          if (!Array.isArray(pls)) continue;
          const me = pls.find(function(p){return p && p.id===playerId;});
          const them = pls.find(function(p){return p && p.id===id;});
          if (me && them) roomRows.push({ mode:r.mode, diff:r.diff, my:me.score||0, opp:them.score||0, when:r.created_at });
        }
        if (roomRows.length > 0) {
          setViewedProfileData(function(prev){
            if (!prev) return prev;
            const merged = [...(prev.duelsWith||[]), ...roomRows].sort(function(a,b){return (b.when||"").localeCompare(a.when||"");});
            let w=0,l=0,dr=0;
            merged.forEach(function(x){ if((x.my||0)>(x.opp||0)) w++; else if((x.my||0)<(x.opp||0)) l++; else dr++; });
            return {...prev, duelsWith:merged, myWins:w, myLosses:l, duelsDraws:dr};
          });
        }
      }
    } catch {}
  }

  async function loadDuels() {
    try {
      const data = await sbFetch("bb_duels?or=(challenger_id.eq." + playerId + ",opponent_id.eq." + playerId + ")&order=created_at.desc&limit=100");
      setDuels(Array.isArray(data) ? data : []);
    } catch(e) { setDuels([]); }
  }

  // ─── DÉFIS OUVERTS (asynchrones) ───
  // Un joueur poste un défi (mode + diff + son score) que N'IMPORTE QUI peut relever
  // plus tard. Réutilise bb_duels : la "carte" ouverte a status="open" (opponent_id null),
  // et chaque tentative crée une ligne "complete" (le poster reste challenger).
  async function loadOpenDuels() {
    try {
      const data = await sbFetch("bb_duels?status=eq.open&order=created_at.desc&limit=40&select=id,challenger_id,challenger_name,mode,diff,rounds,challenger_score,created_at");
      let done = []; try { done = JSON.parse(localStorage.getItem("bb_open_done")||"[]"); } catch(e) {}
      const list = (Array.isArray(data) ? data : []).filter(function(d){ return d.challenger_id !== playerId && done.indexOf(d.id) === -1; });
      setOpenDuels(list);
    } catch(e) { setOpenDuels([]); }
  }

  // Charge mes défis ouverts (encore en cours) + les tentatives reçues dessus.
  // markSeen=true : marque toutes les tentatives comme vues (efface la pastille)
  // — utilisé quand on ouvre directement sur "Mes défis".
  async function loadMyOpenDuels(markSeen) {
    if (!playerId) return;
    try {
      const mine = await sbFetch("bb_duels?challenger_id=eq."+playerId+"&status=eq.open&order=created_at.desc&limit=50&select=id,mode,diff,challenger_score,created_at");
      setMyOpenChallenges(Array.isArray(mine) ? mine : []);
    } catch(e) { setMyOpenChallenges([]); }
    try {
      const att = await sbFetch("bb_duels?challenger_id=eq."+playerId+"&status=eq.open_done&order=created_at.desc&limit=50&select=id,opponent_name,mode,diff,challenger_score,opponent_score,created_at");
      const list = Array.isArray(att) ? att : [];
      setMyOpenAttempts(list);
      if (markSeen) {
        try { localStorage.setItem("bb_open_seen", JSON.stringify(list.map(function(a){ return a.id; }))); } catch(e) {}
        setOpenUnseenCount(0);
      } else {
        let seen = []; try { seen = JSON.parse(localStorage.getItem("bb_open_seen")||"[]"); } catch(e) {}
        setOpenUnseenCount(list.filter(function(a){ return seen.indexOf(a.id) === -1; }).length);
      }
    } catch(e) { setMyOpenAttempts([]); }
  }
  // Défis nominatifs qui m'attendent
  async function loadReceivedChallenges() {
    if (!playerId) { setReceivedChallenges([]); return; }
    try {
      const data = await sbFetch("bb_duels?opponent_id=eq."+playerId+"&status=eq.sent&order=created_at.desc&limit=50&select=id,challenger_id,challenger_name,mode,diff,rounds,challenger_score,created_at");
      let done = []; try { done = JSON.parse(localStorage.getItem("bb_open_done")||"[]"); } catch(e) {}
      setReceivedChallenges((Array.isArray(data)?data:[]).filter(function(d){ return done.indexOf(d.id) === -1; }));
    } catch(e) { setReceivedChallenges([]); }
  }

  // Marque toutes les tentatives reçues comme "vues" (efface la pastille)
  function markOpenAttemptsSeen() {
    try { localStorage.setItem("bb_open_seen", JSON.stringify(myOpenAttempts.map(function(a){ return a.id; }))); } catch(e) {}
    setOpenUnseenCount(0);
  }

  // Lance une partie pour un défi ouvert. role = "create" (je poste) ou "accept" (je relève)
  function playOpenDuel(duel, role) {
    const d = Object.assign({}, duel, { openRole: role, rounds: duel.rounds || 1, isRoom: false });
    setActiveDuel(d); activeDuelRef.current = d;
    setShowOpenDuels(false); setOpenDuelChooser(false); setShowFriends(false);
    setTotalRounds(d.rounds || 1);
    botOpponentRef.current = null; botScoreRef.current = null;
    if (d.mode === "chaine") {
      if (d.diff) setDiff(d.diff);
      startChain();
    } else {
      setDiff(d.diff || "facile");
      setCombo(0); setMaxCombo(0); comboRef.current = 0;
      lastAnswerTime.current = Date.now();
      setRoundScores([]); setCurrentRound(1);
      setIsNewRecord(false); setMyLbRank(null);
      setTimeout(function(){ startRound(1); }, 50);
    }
  }

  async function createDuel(friend) {
    const name = (playerName || "Anonyme").trim();
    try {
      await sbFetch("bb_duels", {
        method: "POST",
        body: JSON.stringify({
          challenger_id: playerId,
          challenger_name: name,
          opponent_id: friend.id,
          opponent_name: friend.name,
          mode: duelMode,
          diff: duelDiff,
          rounds: duelRounds,
          status: "waiting",
        })
      });
      setShowDuelCreate(null);
      // Enter waiting room
      const data = await sbFetch("bb_duels?challenger_id=eq."+playerId+"&status=eq.waiting&order=created_at.desc&limit=1");
      if (Array.isArray(data) && data.length > 0) {
        setWaitingDuel(data[0]);
        startDuelPolling(data[0]);
      } else {
        loadDuels();
      }
    } catch(e) { console.error(e); }
  }

  function startDuelPolling(duel) {
    clearInterval(duelPollRef.current);
    duelPollRef.current = setInterval(async function() {
      try {
        const data = await sbFetch("bb_duels?id=eq."+duel.id+"&select=id,status,challenger_id,opponent_id,challenger_name,opponent_name,mode,diff,rounds,challenger_score,opponent_score");
        if (!Array.isArray(data) || data.length === 0) return;
        const updated = data[0];
        setWaitingDuel(updated);
        if (updated.status === "ready") {
          clearInterval(duelPollRef.current);
          startCountdown(updated);
        }
      } catch(e) {}
    }, 3000);
  }

  function startCountdown(duel) {
    setDuelCountdown(3);
    let count = 3;
    countdownRef.current = setInterval(function() {
      count--;
      setDuelCountdown(count);
      if (count <= 0) {
        clearInterval(countdownRef.current);
        setDuelCountdown(null);
        setWaitingDuel(null);
        playDuel(duel);
      }
    }, 1000);
  }

  async function joinDuel(duel) {
    try {
      await sbFetch("bb_duels?id=eq."+duel.id, {
        method: "PATCH",
        body: JSON.stringify({status: "ready"}),
        headers: {"Prefer": "return=minimal"}
      });
      const readyDuel = Object.assign({}, duel, {status: "ready"});
      setWaitingDuel(readyDuel);
      // Opponent starts countdown immediately (they just set status to ready)
      startCountdown(readyDuel);
    } catch(e) { console.error(e); }
  }

  function cancelWaiting() {
    clearInterval(duelPollRef.current);
    clearInterval(countdownRef.current);
    if (waitingDuel) {
      sbFetch("bb_duels?id=eq."+waitingDuel.id, {
        method: "PATCH",
        body: JSON.stringify({status: "cancelled"}),
        headers: {"Prefer": "return=minimal"}
      }).catch(function(){});
    }
    setWaitingDuel(null);
    setDuelCountdown(null);
    loadDuels();
  }
  async function playDuel(duel) {
    setActiveDuel(duel);
    activeDuelRef.current = duel;
    setTotalRounds(duel.rounds || 1);
    setShowFriends(false);
    const isChallenger = duel.challenger_id === playerId;
    if (duel.mode === "chaine") {
      if (duel.diff) setDiff(duel.diff);
      startChain();
    } else {
      const duelDiffVal = duel.diff || "facile";
      setDiff(duelDiffVal);
      setCombo(0); setMaxCombo(0); comboRef.current = 0;
      lastAnswerTime.current = Date.now();
      setRoundScores([]); setCurrentRound(1);
      setIsNewRecord(false); setMyLbRank(null);
      setTimeout(function() { startRound(1); }, 50);
    }
    // Poll pour détecter si l'adversaire abandonne
    clearInterval(duelPollRef.current);
    duelPollRef.current = setInterval(async function() {
      try {
        const data = await sbFetch("bb_duels?id=eq."+duel.id+"&select=status,abandoned_by,challenger_score,opponent_score");
        if (!Array.isArray(data) || data.length === 0) return;
        const updated = data[0];
        if (updated.status === "complete" && updated.abandoned_by && updated.abandoned_by !== playerId) {
          clearInterval(duelPollRef.current);
          clearInterval(timerRef.current);
          clearInterval(qTimerRef.current);
          setActiveDuel(null);
          // Adversaire a abandonné — on est vainqueur
          const myScore = isChallenger ? (updated.challenger_score ?? 1) : (updated.opponent_score ?? 1);
          const theirScore = isChallenger ? (updated.opponent_score ?? 0) : (updated.challenger_score ?? 0);
          const oppName = isChallenger ? duel.opponent_name : duel.challenger_name;
          setDuelResult({ myScore, theirScore, oppName, mode: duel.mode, opponentAbandoned: true });
        }
      } catch(e) {}
    }, 3000);
  }

  async function abandonDuel() {
    if (!activeDuel) return;
    const duelId = activeDuel.id;
    const isChallenger = activeDuel.challenger_id === playerId;
    // Abandonner = score 0 pour moi, score garanti > 0 pour l'adversaire
    const update = isChallenger
      ? { challenger_score: 0, opponent_score: activeDuel.opponent_score ?? 1, status: "complete", abandoned_by: playerId }
      : { opponent_score: 0, challenger_score: activeDuel.challenger_score ?? 1, status: "complete", abandoned_by: playerId };
    setActiveDuel(null);
    try {
      await sbFetch("bb_duels?id=eq." + duelId, {
        method: "PATCH",
        body: JSON.stringify(update),
        headers: {"Prefer": "return=minimal"}
      });
      loadDuels();
    } catch(e) { console.error("Abandon error:", e); }
  }

  // Relancer une room Plug/Mercato (host uniquement)
  async function restartRoom() {
    if (!duelResult || !duelResult.isRoom || !duelResult.roomId) return;
    if (duelResult.hostId !== playerId) return;
    try {
      // Récupérer la room actuelle
      const data = await sbFetch("bb_rooms?id=eq."+duelResult.roomId+"&limit=1");
      if (!Array.isArray(data) || data.length === 0) return;
      const r = data[0];
      const players = typeof r.players === "string" ? JSON.parse(r.players) : r.players;
      // Reset les scores et rounds des joueurs (mais on les garde dans la room)
      const resetPlayers = (players || []).filter(function(p){ return !p.abandoned; }).map(function(p){
        return {
          id: p.id,
          name: p.name,
          score: 0,
          partial_score: 0,
          rounds: [],
          status: "playing",
          abandoned: false,
        };
      });
      await sbFetch("bb_rooms?id=eq."+duelResult.roomId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Prefer": "return=minimal" },
        body: JSON.stringify({
          players: JSON.stringify(resetPlayers),
          status: "lobby",
          // On ne change pas le code ni le mode/diff/rounds : même room
        }),
      });
      // Le host rejoint le lobby de la nouvelle partie
      const roomDuel = {id:r.id, isRoom:true, challenger_id:r.host_id, mode:r.mode, diff:r.diff, rounds:r.rounds};
      activeDuelRef.current = roomDuel;
      setActiveDuel(roomDuel);
      setRoom(Object.assign({}, r, {players: resetPlayers, status: "lobby"}));
      setDuelResult(null);
      setRoundAnswers([]);
      setChainHistory([]);
      // Démarrer le polling pour que tous les joueurs reviennent au lobby
      if (typeof startRoomPolling === "function") {
        startRoomPolling(r.id);
      }
      setScreen("lobby");
    } catch(e) {
      console.warn("restartRoom failed:", e);
    }
  }
  
  async function abandonRoom() {
    const duel = activeDuelRef.current;
    if (!duel || !duel.isRoom) return;
    const roomId = duel.id;
    setWaitingForRoom(true);
    setWaitingAfterAbandon(true);
    try {
      const data = await sbFetch("bb_rooms?id=eq."+roomId+"&limit=1");
      if (Array.isArray(data) && data.length > 0) {
        const r = data[0];
        const players = typeof r.players === "string" ? JSON.parse(r.players) : r.players;
        // Est-ce qu'un autre joueur a déjà abandonné AVANT moi ?
        const someoneAlreadyAbandoned = players.some(function(p){ return p.id !== playerId && p.abandoned === true; });
        setAbandonedAfterOppLeft(someoneAlreadyAbandoned);
        const updated = players.map(function(p) {
          return p.id === playerId ? Object.assign({}, p, {score:0, status:"done", abandoned:true}) : p;
        });
        const allDone = updated.every(function(p){return p.status==="done";});
        await sbFetch("bb_rooms?id=eq."+roomId, {
          method:"PATCH",
          body:JSON.stringify({players:JSON.stringify(updated), status:allDone?"complete":"scoring"}),
          headers:{"Prefer":"return=minimal"}
        });
      }
    } catch(e) {
      console.error("Abandon room error:", e);
    }
    activeDuelRef.current = null;
    setActiveDuel(null);
    clearInterval(roomPollRef.current);
    // Pas de polling ni fetch de résultat : le user a abandonné, il verra juste l'écran abandon.
    // Ses stats seront mises à jour automatiquement la prochaine fois qu'il ouvre le classement (lecture bb_rooms status=complete).
  }

  async function submitDuelScore(sc) {
    if (!activeDuel) return;
    // ─── Défis ouverts (asynchrones) ───
    if (activeDuel.openRole === "create") {
      const duel = activeDuel;
      const myRounds = (duel.mode === "chaine") ? chainHistory : roundAnswers;
      setActiveDuel(null); activeDuelRef.current = null;
      // Défi NOMINATIF : même flux asynchrone que le défi ouvert, mais adressé à
      // un joueur précis (status "sent" au lieu de "open"). Il le retrouve dans
      // l'onglet "Reçus" et le relève quand il veut.
      const target = duel.target || null;
      try {
        await sbFetch("bb_duels", { method:"POST", headers:{"Content-Type":"application/json","Prefer":"return=minimal"}, body: JSON.stringify({
          challenger_id: playerId, challenger_name: (playerName||"Anonyme").trim(),
          // sentinelles quand le défi est ouvert à tous : la colonne opponent_id est NOT NULL
          opponent_id: target ? target.id : "OPEN",
          opponent_name: target ? target.name : "",
          mode: duel.mode, diff: duel.diff, rounds: duel.rounds || 1,
          challenger_score: sc, status: target ? "sent" : "open"
        })});
                setOpenNotif(target
          ? (tr("Défi envoyé à ","Challenge sent to ","Herausforderung gesendet an ","Sfida inviata a ","Desafio enviado para ") + target.name + " · " + sc + " pts")
          : (tr("Défi posté ! Score à battre : ","Open challenge posted! Score to beat: ","Herausforderung gepostet! Zu schlagen: ","Sfida pubblicata! Punteggio da battere: ","Desafio publicado! Pontuação a bater: "))+sc+" ⚡");
        setTimeout(function(){ setOpenNotif(null); }, 5000);
        // Notif push : prévenir mes amis qu'un nouveau défi est dispo (best-effort)
        try {
          // Défi nominatif : une seule notif, au joueur visé. Défi ouvert : on
          // prévient tous les amis, comme avant.
          const targets = target ? [target.id] : (friendsList||[]);
          const kind = target ? "duel_challenge" : "duel_new";
          targets.forEach(function(fid){
            fetch(SB_URL + "/functions/v1/send-friend-notification", {
              method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer "+SB_KEY},
              body: JSON.stringify({ to_id: fid, from_name: (playerName||"Quelqu'un").trim(), type:kind, mode: duel.mode })
            }).catch(function(){});
          });
        } catch(e) {}
      } catch(e) { console.error("Open duel post error:", e); }
      return;
    }
    if (activeDuel.openRole === "accept") {
      const duel = activeDuel;
      const myRounds = (duel.mode === "chaine") ? chainHistory : roundAnswers;
      setActiveDuel(null); activeDuelRef.current = null;
      const parseRounds = function(r){ if(!r) return []; if(typeof r==="string"){try{return JSON.parse(r);}catch(e){return [];}} return Array.isArray(r)?r:[]; };
      try {
        await sbFetch("bb_duels", { method:"POST", headers:{"Content-Type":"application/json","Prefer":"return=minimal"}, body: JSON.stringify({
          challenger_id: duel.challenger_id, challenger_name: duel.challenger_name,
          opponent_id: playerId, opponent_name: (playerName||"Anonyme").trim(),
          mode: duel.mode, diff: duel.diff, rounds: duel.rounds || 1,
          challenger_score: duel.challenger_score,
          opponent_score: sc, status: "open_done"
        })});
        try { const done = JSON.parse(localStorage.getItem("bb_open_done")||"[]"); if(duel.id && done.indexOf(duel.id)===-1){ done.push(duel.id); localStorage.setItem("bb_open_done", JSON.stringify(done)); } } catch(e) {}
        // Notif push : prévenir le créateur que son défi a été relevé (best-effort)
        try {
          if (duel.challenger_id && duel.challenger_id !== "OPEN") {
            fetch(SB_URL + "/functions/v1/send-friend-notification", {
              method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer "+SB_KEY},
              body: JSON.stringify({ to_id: duel.challenger_id, from_name: (playerName||"Quelqu'un").trim(), type:"duel_taken" })
            }).catch(function(){});
          }
        } catch(e) {}
      } catch(e) { console.error("Open duel accept error:", e); }
      setDuelResult({ myScore: sc, theirScore: duel.challenger_score, oppName: duel.challenger_name, mode: duel.mode, myRounds: myRounds, theirRounds: parseRounds(duel.challenger_rounds) });
      loadDuels();
      return;
    }
    const duelId = activeDuel.id;
    const duelCopy = Object.assign({}, activeDuel);
    const isChallenger = activeDuel.challenger_id === playerId;
    const otherScore = isChallenger ? activeDuel.opponent_score : activeDuel.challenger_score;
    const newStatus = (otherScore !== null && otherScore !== undefined) ? "complete" : (isChallenger ? "challenger_played" : "opponent_played");
    // Snapshot des manches jouées (Plug ou Mercato)
    const myRounds = (activeDuel.mode === "chaine") ? chainHistory : roundAnswers;
    const update = isChallenger
      ? { challenger_score: sc, status: newStatus, challenger_rounds: myRounds }
      : { opponent_score: sc, status: newStatus, opponent_rounds: myRounds };
    setActiveDuel(null);
    try {
      await sbFetch("bb_duels?id=eq." + duelId, {
        method: "PATCH",
        body: JSON.stringify(update),
        headers: {"Prefer": "return=minimal"}
      });
      // If duel is now complete, build result object and show result screen
      if (newStatus === "complete") {
        const myScore = sc;
        const theirScore = otherScore;
        const oppName = isChallenger ? duelCopy.opponent_name : duelCopy.challenger_name;
        const won = myScore > theirScore;
        // Calculer le streak depuis Supabase
        try {
          const history = await sbFetch("bb_duels?status=eq.complete&or=(challenger_id.eq."+playerId+",opponent_id.eq."+playerId+")&order=created_at.asc&select=challenger_id,challenger_score,opponent_score");
          if (Array.isArray(history)) {
            let streak = 0;
            const results = history.map(function(d){
              const ms = d.challenger_id===playerId ? d.challenger_score : d.opponent_score;
              const ts = d.challenger_id===playerId ? d.opponent_score : d.challenger_score;
              return ms > ts ? "W" : "L";
            });
            // Ajouter le résultat courant
            results.push(won ? "W" : "L");
            for (let i = results.length-1; i >= 0; i--) {
              if (results[i]==="W") streak++;
              else break;
            }
            setWinStreak(streak);
          }
        } catch(e){}
        // Récupérer les rounds (mes rounds + adversaire) depuis bb_duels
        let myRoundsFinal = myRounds;
        let theirRoundsFinal = [];
        try {
          const fresh = await sbFetch("bb_duels?id=eq."+duelId+"&select=challenger_rounds,opponent_rounds&limit=1");
          if (Array.isArray(fresh) && fresh[0]) {
            const cRounds = fresh[0].challenger_rounds;
            const oRounds = fresh[0].opponent_rounds;
            const parseRounds = function(r){
              if (!r) return [];
              if (typeof r === "string") { try { return JSON.parse(r); } catch(e) { return []; } }
              return Array.isArray(r) ? r : [];
            };
            myRoundsFinal = parseRounds(isChallenger ? cRounds : oRounds);
            theirRoundsFinal = parseRounds(isChallenger ? oRounds : cRounds);
          }
        } catch(e) {}
        setDuelResult({
          myScore, theirScore, oppName, mode: duelCopy.mode,
          myRounds: myRoundsFinal,
          theirRounds: theirRoundsFinal,
        });
      }
      loadDuels();
    } catch(e) { console.error("Duel score submit error:", e); }
  }

  function getPendingDuels() {
    // For opponent: show duels where challenger is waiting for them to join
    return duels.filter(function(d) {
      if (d.challenger_id === playerId) return false; // challenger handles via waitingDuel state
      return d.status === "waiting"; // opponent sees "join" invite
    });
  }


  // ── ROOM FUNCTIONS (multi up to 8) ──
  function makeRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({length:6}, function(){return chars[Math.floor(Math.random()*chars.length)];}).join("");
  }

  async function createRoom() {
    const name = (playerName||"Anonyme").trim();
    const code = makeRoomCode();
    const me = [{id:playerId, name:name, score:null, status:"waiting"}];
    setRoomMsg("Création en cours...");
    try {
      const created = await sbFetch("bb_rooms", {
        method: "POST",
        body: JSON.stringify({
          code: code,
          host_id: playerId,
          host_name: name,
          mode: duelMode,
          diff: duelDiff,
          rounds: duelRounds,
          status: "waiting",
          players: me
        }),
        headers: {"Prefer": "return=representation"}
      });
      const roomData = Array.isArray(created) ? created[0] : null;
      if (roomData && roomData.id) {
        setRoom(roomData);
        setShowRoomCreate(false);
        setRoomMsg("");
        startRoomPolling(roomData.id);
      } else {
        // Fallback: fetch by code
        const data = await sbFetch("bb_rooms?code=eq."+code+"&limit=1");
        if (Array.isArray(data) && data.length > 0) {
          setRoom(data[0]);
          setShowRoomCreate(false);
          setRoomMsg("");
          startRoomPolling(data[0].id);
        } else {
          setRoomMsg("Erreur: impossible de créer la salle");
        }
      }
    } catch(e) {
      setRoomMsg("Erreur: "+e.message);
    }
  }


  async function joinRoom(code) {
    const clean = code.trim().toUpperCase();
    if (clean.length !== 6) { setRoomMsg("Code invalide"); return; }
    const name = (playerName||"Anonyme").trim();
    try {
      const data = await sbFetch("bb_rooms?code=eq."+clean+"&limit=1");
      if (!Array.isArray(data) || data.length === 0) { setRoomMsg(tr("Salle introuvable","Room not found","Raum nicht gefunden","Stanza non trovata","Sala não encontrada")); return; }
      const r = data[0];
      if (r.status !== "waiting") { setRoomMsg(tr("Partie déjà lancée !","Game already started!","Spiel bereits gestartet!","Partita già iniziata!","Jogo já começou!")); return; }
      // Retry loop pour gérer la race condition quand plusieurs joueurs rejoignent en même temps
      let success = false;
      let attempt = 0;
      let finalRoom = null;
      while (!success && attempt < 5) {
        attempt++;
        // Re-lire à chaque tentative pour avoir la dernière version
        const fresh = attempt === 1 ? data : await sbFetch("bb_rooms?code=eq."+clean+"&limit=1");
        if (!Array.isArray(fresh) || fresh.length === 0) { setRoomMsg(tr("Salle introuvable","Room not found","Raum nicht gefunden","Stanza non trovata","Sala não encontrada")); return; }
        const cr = fresh[0];
        if (cr.status !== "waiting") { setRoomMsg(tr("Partie déjà lancée !","Game already started!","Spiel bereits gestartet!","Partita già iniziata!","Jogo já começou!")); return; }
        const players = typeof cr.players === "string" ? JSON.parse(cr.players) : cr.players;
        if (players.length >= 8) { setRoomMsg(tr("Salle pleine (8/8)","Room full (8/8)","Raum voll (8/8)","Stanza piena (8/8)","Sala cheia (8/8)")); return; }
        // Déjà dans la salle ? cas du retry où mon ajout a réussi sans qu'on le sache
        if (players.find(function(p){return p.id===playerId;})) {
          success = true;
          finalRoom = cr;
          break;
        }
        const newPlayers = [...players, {id:playerId, name:name, score:null, status:"waiting"}];
        await sbFetch("bb_rooms?id=eq."+cr.id, {
          method:"PATCH",
          body:JSON.stringify({players:JSON.stringify(newPlayers)}),
          headers:{"Prefer":"return=minimal"}
        });
        // Vérifier que mon update a bien été persisté (pas écrasé par un autre joueur en parallèle)
        await new Promise(function(resolve){return setTimeout(resolve, 200 + Math.random() * 300);});
        const verify = await sbFetch("bb_rooms?id=eq."+cr.id+"&limit=1");
        if (Array.isArray(verify) && verify.length > 0) {
          const vr = verify[0];
          const vp = typeof vr.players === "string" ? JSON.parse(vr.players) : vr.players;
          if (vp.find(function(p){return p.id===playerId;})) {
            success = true;
            finalRoom = vr;
          }
          // Sinon : mon ajout a été écrasé, on retry
        }
        if (!success && attempt < 5) {
          await new Promise(function(resolve){return setTimeout(resolve, 300 + attempt * 200 + Math.random() * 200);});
        }
      }
      if (!success) {
        setRoomMsg(tr("Connexion impossible (réessaie)","Could not join (try again)","Beitritt fehlgeschlagen (nochmal)","Accesso non riuscito (riprova)","Não foi possível entrar (tente de novo)"));
        return;
      }
      setRoom(finalRoom);
      setRoomInput("");
      setRoomMsg("");
      startRoomPolling(finalRoom.id);
    } catch(e) { console.error(e); setRoomMsg("Erreur connexion"); }
  }

  function startRoomPolling(roomId) {
    clearInterval(roomPollRef.current);
    let gameStarted = false;
    let rejoinAttempts = 0;
    roomPollRef.current = setInterval(async function() {
      try {
        const data = await sbFetch("bb_rooms?id=eq."+roomId+"&limit=1");
        if (!Array.isArray(data) || data.length === 0) return;
        const r = data[0];
        // Auto-rejoin : si je ne suis plus dans la liste (écrasé par une race), je me re-rejoins
        if (r.status === "waiting") {
          const players = typeof r.players === "string" ? JSON.parse(r.players) : r.players;
          const meInRoom = players.find(function(p){return p.id===playerId;});
          if (!meInRoom && rejoinAttempts < 3 && players.length < 8) {
            rejoinAttempts++;
            const name = (playerName||"Anonyme").trim();
            const newPlayers = [...players, {id:playerId, name:name, score:null, status:"waiting"}];
            try {
              await sbFetch("bb_rooms?id=eq."+roomId, {
                method:"PATCH",
                body:JSON.stringify({players:JSON.stringify(newPlayers)}),
                headers:{"Prefer":"return=minimal"}
              });
            } catch(e) {}
            return;
          } else if (meInRoom) {
            rejoinAttempts = 0; // reset si je suis bien là
          }
        }
        setRoom(r);
        if (r.status === "playing" && !gameStarted) {
          gameStarted = true;
          clearInterval(roomPollRef.current);
          setRoom(r);
          startRoomCountdown(r);
        } else if (r.status === "complete" || r.status === "scoring") {
          clearInterval(roomPollRef.current);
        }
      } catch(e) {}
    }, 2000);
  }

  function startRoomCountdown(r) {
    setDuelCountdown(3);
    let count = 3;
    countdownRef.current = setInterval(function() {
      count--;
      setDuelCountdown(count);
      if (count <= 0) {
        clearInterval(countdownRef.current);
        setDuelCountdown(null);
        launchRoomGame(r);
      }
    }, 1000);
  }

  function launchRoomGame(r) {
    clearInterval(roomPollRef.current); // stopper le polling lobby
    setRoom(null);
    const roomDuel = {id:r.id, isRoom:true, challenger_id:r.host_id, mode:r.mode, diff:r.diff, rounds:r.rounds};
    setActiveDuel(roomDuel);
    activeDuelRef.current = roomDuel;
    setTotalRounds(r.rounds || 1);
    if (r.mode === "chaine") {
      if (r.diff) setDiff(r.diff);
      startChain();
    } else {
      setDiff(r.diff || "facile");
      setCombo(0); setMaxCombo(0); comboRef.current = 0;
      lastAnswerTime.current = Date.now();
      setRoundScores([]); setCurrentRound(1);
      setIsNewRecord(false); setMyLbRank(null);
      setTimeout(function(){ startRound(1); }, 50);
    }
    // Polling en cours de partie pour détecter les abandons
    roomPollRef.current = setInterval(async function() {
      const duel = activeDuelRef.current;
      if (!duel || !duel.isRoom) { clearInterval(roomPollRef.current); return; }
      try {
        const data = await sbFetch("bb_rooms?id=eq."+r.id+"&limit=1");
        if (!Array.isArray(data) || data.length === 0) return;
        const room = data[0];
        const players = typeof room.players === "string" ? JSON.parse(room.players) : room.players;
        const abandoned = players.filter(function(p){ return p.abandoned && p.id !== playerId; });
        if (abandoned.length > 0) {
          const names = abandoned.map(function(p){return p.name||"Un joueur";}).join(", ");
          setAbandonNotif(names + (abandoned.length > 1 ? (tr(" ont abandonné 🏃"," have quit 🏃"," haben aufgegeben 🏃"," hanno abbandonato 🏃"," desistiram 🏃")) : (tr(" a abandonné 🏃"," has quit 🏃"," hat aufgegeben 🏃"," ha abbandonato 🏃"," desistiu 🏃"))));
          setTimeout(function(){setAbandonNotif("");}, 5000);
        }
      } catch(e) {}
    }, 3000);
  }

  async function startRoomGame() {
    if (!room) return;
    clearInterval(roomPollRef.current); // stopper le polling AVANT le patch
    try {
      await sbFetch("bb_rooms?id=eq."+room.id, {
        method:"PATCH",
        body:JSON.stringify({status:"playing"}),
        headers:{"Prefer":"return=minimal"}
      });
      startRoomCountdown(room);
    } catch(e) { console.error(e); }
  }

  async function pushRoundScore(roundScore) {
    const duel = activeDuelRef.current;
    if (!duel || !duel.isRoom) return;
    try {
      const data = await sbFetch("bb_rooms?id=eq."+duel.id+"&limit=1");
      if (!Array.isArray(data) || data.length === 0) return;
      const r = data[0];
      const players = typeof r.players === "string" ? JSON.parse(r.players) : r.players;
      // Snapshot des manches jouées par le joueur courant (Plug ou Mercato)
      const myRounds = (duel.mode === "chaine") ? chainHistory : roundAnswers;
      const updated = players.map(function(p) {
        return p.id === playerId
          ? Object.assign({}, p, {partial_score: scoreRef.current, rounds: myRounds})
          : p;
      });
      await sbFetch("bb_rooms?id=eq."+duel.id, {
        method: "PATCH",
        body: JSON.stringify({players: JSON.stringify(updated)}),
        headers: {"Prefer": "return=minimal"}
      });
      // Attendre un peu que les autres envoient leur score partiel, puis fetch
      setTimeout(async function() {
        try {
          const snap = await sbFetch("bb_rooms?id=eq."+duel.id+"&limit=1");
          if (Array.isArray(snap) && snap.length > 0) {
            const snapPlayers = typeof snap[0].players === "string" ? JSON.parse(snap[0].players) : snap[0].players;
            const sorted = [...snapPlayers].sort(function(a,b){return (b.partial_score||0)-(a.partial_score||0);});
            setRoomRoundSnapshot(sorted);
          }
        } catch(e) {}
      }, 2000);
    } catch(e) {}
  }

  // ─── PLUG / MERCATO MULTI — Polling pour détecter une revanche du host ───
  React.useEffect(function() {
    if (!duelResult || !duelResult.isRoom || !duelResult.roomId) return;
    if (duelResult.hostId === playerId) return; // le host gère lui-même son restart
    
    let stopped = false;
    async function poll() {
      try {
        const data = await sbFetch("bb_rooms?id=eq."+duelResult.roomId+"&limit=1");
        if (stopped || !Array.isArray(data) || data.length === 0) return;
        const r = data[0];
        // Si le host a relancé (status passé à "lobby")
        if (r.status === "lobby" || r.status === "waiting") {
          const players = typeof r.players === "string" ? JSON.parse(r.players) : r.players;
          const meInRoom = (players || []).find(function(p){ return p.id === playerId; });
          if (meInRoom) {
            // Rejoindre le lobby de la nouvelle partie
            const roomDuel = {id:r.id, isRoom:true, challenger_id:r.host_id, mode:r.mode, diff:r.diff, rounds:r.rounds};
            activeDuelRef.current = roomDuel;
            setActiveDuel(roomDuel);
            setRoom(r);
            setDuelResult(null);
            setRoundAnswers([]);
            setChainHistory([]);
            startRoomPolling(r.id);
            setScreen("lobby");
          }
        }
      } catch (e) {
        // Échec silencieux
      }
    }
    
    const intervalId = setInterval(poll, 2000); // toutes 2s
    return function() { stopped = true; clearInterval(intervalId); };
  }, [duelResult && duelResult.roomId]);


  async function submitRoomScore(sc) {
    const duel = activeDuelRef.current;
    if (!duel || !duel.isRoom) return;
    const roomId = duel.id;
    setWaitingForRoom(true);
    setActiveDuel(null);
    activeDuelRef.current = null;
    // Retry loop pour gérer les race conditions quand plusieurs joueurs finissent simultanément
    // (en 8 joueurs, sans retry, certains updates étaient écrasés et le statut "done" était perdu)
    let success = false;
    let attempt = 0;
    let finalRoom = null;
    while (!success && attempt < 5) {
      attempt++;
      try {
        const data = await sbFetch("bb_rooms?id=eq."+roomId+"&limit=1");
        if (!Array.isArray(data) || data.length === 0) { setWaitingForRoom(false); return; }
        const r = data[0];
        const players = typeof r.players === "string" ? JSON.parse(r.players) : r.players;
        // Vérifier si mon statut est déjà "done" (cas d'un retry réussi sans le savoir)
        const me = players.find(function(p){return p.id === playerId;});
        if (me && me.status === "done" && me.score === sc) {
          success = true;
          finalRoom = r;
          break;
        }
        // Snapshot des manches jouées (Plug ou Mercato)
        const myRounds = (duel.mode === "chaine") ? chainHistory : roundAnswers;
        const updated = players.map(function(p){
          return p.id === playerId ? Object.assign({}, p, {score:sc, status:"done", rounds: myRounds}) : p;
        });
        const allDone = updated.every(function(p){return p.status==="done";});
        await sbFetch("bb_rooms?id=eq."+roomId, {
          method:"PATCH",
          body:JSON.stringify({players:JSON.stringify(updated), status:allDone?"complete":"scoring"}),
          headers:{"Prefer":"return=minimal"}
        });
        // Vérifier que mon update a bien été persisté (pas écrasé par un autre joueur en parallèle)
        await new Promise(function(resolve){return setTimeout(resolve, 200 + Math.random() * 300);});
        const verify = await sbFetch("bb_rooms?id=eq."+roomId+"&limit=1");
        if (Array.isArray(verify) && verify.length > 0) {
          const vr = verify[0];
          const vp = typeof vr.players === "string" ? JSON.parse(vr.players) : vr.players;
          const meAfter = vp.find(function(p){return p.id === playerId;});
          if (meAfter && meAfter.status === "done" && meAfter.score === sc) {
            success = true;
            finalRoom = vr;
          }
          // Sinon : mon update a été écrasé, on retry avec un petit délai aléatoire (backoff)
        }
      } catch(e) { console.error("submitRoomScore attempt "+attempt+":", e); }
      if (!success && attempt < 5) {
        await new Promise(function(resolve){return setTimeout(resolve, 300 + attempt * 200 + Math.random() * 200);});
      }
    }
    if (!success) { setWaitingForRoom(false); return; }
    try {
      const players = typeof finalRoom.players === "string" ? JSON.parse(finalRoom.players) : finalRoom.players;
      const allDone = players.every(function(p){return p.status==="done";});
      if (allDone) {
        // On est le dernier — afficher les résultats directement
        showRoomResults(finalRoom);
      } else {
        // Attendre les autres via polling
        startRoomResultPolling(roomId, duel.rounds||1);
      }
    } catch(e) { console.error(e); setWaitingForRoom(false); }
  }

  function startRoomResultPolling(roomId, rounds) {
    clearInterval(roomPollRef.current);
    const maxWait = ((rounds||1) * ROUND_DURATION + 120) * 1000; // timeout = durée théorique + 2 min
    const startedAt = Date.now();
    roomPollRef.current = setInterval(async function() {
      try {
        const data = await sbFetch("bb_rooms?id=eq."+roomId+"&limit=1");
        if (!Array.isArray(data) || data.length === 0) return;
        const r = data[0];
        const players = typeof r.players === "string" ? JSON.parse(r.players) : r.players;
        const abandoned = players.filter(function(p){return p.abandoned && p.id !== playerId;});
        if (abandoned.length > 0) {
          const names = abandoned.map(function(p){return p.name||"Un joueur";}).join(", ");
          setAbandonNotif(names + (abandoned.length > 1 ? (tr(" ont abandonné 🏃"," have quit 🏃"," haben aufgegeben 🏃"," hanno abbandonato 🏃"," desistiram 🏃")) : (tr(" a abandonné 🏃"," has quit 🏃"," hat aufgegeben 🏃"," ha abbandonato 🏃"," desistiu 🏃"))));
          setTimeout(function(){setAbandonNotif("");}, 5000);
        }
        const allDone = players.every(function(p){return p.status==="done";});
        // Auto-reconciliation : si certains joueurs ont un score > 0 mais sont restés "in_progress"
        // depuis plus de 30s, c'est probablement une race condition (leur done a été écrasé).
        // On force leur status à done pour débloquer la salle.
        const elapsed = Date.now() - startedAt;
        const stuckPlayers = players.filter(function(p){
          return p.status !== "done" && (p.score || 0) > 0;
        });
        if (!allDone && elapsed > 30000 && stuckPlayers.length > 0) {
          const fixed = players.map(function(p){
            return (p.status !== "done" && (p.score || 0) > 0) ? Object.assign({}, p, {status:"done"}) : p;
          });
          const nowAllDone = fixed.every(function(p){return p.status==="done";});
          await sbFetch("bb_rooms?id=eq."+roomId, {
            method:"PATCH",
            body:JSON.stringify({players:JSON.stringify(fixed), status:nowAllDone?"complete":"scoring"}),
            headers:{"Prefer":"return=minimal"}
          });
          if (nowAllDone) {
            clearInterval(roomPollRef.current);
            showRoomResults(Object.assign({}, r, {players: JSON.stringify(fixed)}));
            return;
          }
        }
        const timedOut = Date.now() - startedAt > maxWait;
        if (allDone || timedOut) {
          clearInterval(roomPollRef.current);
          // Marquer les joueurs non-finis comme done avec score 0
          if (timedOut && !allDone) {
            const fixed = players.map(function(p){
              return p.status !== "done" ? Object.assign({}, p, {score:p.score||0, status:"done", abandoned:true}) : p;
            });
            await sbFetch("bb_rooms?id=eq."+roomId, {
              method:"PATCH",
              body:JSON.stringify({players:JSON.stringify(fixed), status:"complete"}),
              headers:{"Prefer":"return=minimal"}
            });
            showRoomResults(Object.assign({}, r, {players: JSON.stringify(fixed)}));
          } else {
            await sbFetch("bb_rooms?id=eq."+roomId, {
              method:"PATCH",
              body:JSON.stringify({status:"complete"}),
              headers:{"Prefer":"return=minimal"}
            });
            showRoomResults(r);
          }
        }
      } catch(e) {}
    }, 2000);
  }

  function showRoomResults(r) {
    setWaitingForRoom(false);
    setWaitingAfterAbandon(false);
    setScreen("home");
    const players = typeof r.players === "string" ? JSON.parse(r.players) : r.players;
    const sorted = [...players].sort(function(a,b){
      // Les joueurs qui ont abandonné sont TOUJOURS derniers, peu importe leur score
      if (a.abandoned && !b.abandoned) return 1;
      if (!a.abandoned && b.abandoned) return -1;
      return (b.score||0)-(a.score||0);
    });
    const meInRoom = players.find(function(p){return p.id===playerId;}); setDuelResult({isRoom:true, roomId:r.id, hostId:r.host_id, code:r.code, diff:r.diff, rounds:r.rounds, players:sorted, mode:r.mode, myAbandoned: meInRoom && meInRoom.abandoned === true});
    setActiveDuel(null);
    activeDuelRef.current = null;
    setRoom(null);
    // Sauvegarder V/N/D en local pour le classement
    const me = players.find(function(p){return p.id===playerId;});
    if(me){
      const myScore = me.score||0;
      const myRank = sorted.findIndex(function(p){return p.id===playerId;});
      const isWin = myRank === 0;
      const isDraw = sorted.filter(function(p){return (p.score||0)===myScore;}).length > 1 && myRank === 0;
      const mode = r.mode || "pont";
      const d = r.diff || diff;
      const key = `bb_lb_${mode}_${d}`;
      try {
        const data = localStorage.getItem(key);
        const list = data ? JSON.parse(data) : [];
        const displayName = (playerName||"").trim()||"Anonyme";
        const existingIdx = list.findIndex(e => e.name === displayName);
        const wdlPts = isWin ? 3 : isDraw ? 1 : 0;
        if(existingIdx >= 0){
          list[existingIdx].wins = (list[existingIdx].wins||0) + (isWin?1:0);
          list[existingIdx].draws = (list[existingIdx].draws||0) + (isDraw?1:0);
          list[existingIdx].losses = (list[existingIdx].losses||0) + (!isWin&&!isDraw?1:0);
          list[existingIdx].pts = (list[existingIdx].pts||0) + wdlPts;
          list[existingIdx].played = (list[existingIdx].played||0) + 1;
        }
        localStorage.setItem(key, JSON.stringify(list));
      } catch(e){}
    }
  }

  function leaveRoom() {
    clearInterval(roomPollRef.current);
    clearInterval(countdownRef.current);
    setRoom(null);
    setRoomMsg("");
    setDuelCountdown(null);
  }


  // ── PSEUDO FUNCTIONS ──
  async function checkAndSavePseudo(pseudo) {
    const clean = pseudo.trim();
    if (clean.length < 3) { setPseudoMsg(tr("❌ Minimum 3 caractères","❌ Minimum 3 characters","❌ Mindestens 3 Zeichen","❌ Minimo 3 caratteri","❌ Mínimo 3 caracteres")); return; }
    if (clean.length > 12) { setPseudoMsg(tr("❌ Maximum 12 caractères","❌ Maximum 12 characters","❌ Maximal 12 Zeichen","❌ Massimo 12 caratteri","❌ Máximo 12 caracteres")); return; }
    if (/\s/.test(clean)) { setPseudoMsg(tr("❌ Pas d'espaces","❌ No spaces","❌ Keine Leerzeichen","❌ Niente spazi","❌ Sem espaços")); return; }
    if (!/^[a-zA-Z0-9_\-]+$/.test(clean)) { setPseudoMsg(tr("❌ Lettres, chiffres, _ et - uniquement","❌ Letters, digits, _ and - only","❌ Nur Buchstaben, Ziffern, _ und -","❌ Solo lettere, cifre, _ e -","❌ Apenas letras, números, _ e -")); return; }
    if (/^[_\-]/.test(clean) || /[_\-]$/.test(clean)) { setPseudoMsg(tr("❌ Ne peut pas commencer ou finir par _ ou -","❌ Cannot start or end with _ or -","❌ Darf nicht mit _ oder - beginnen oder enden","❌ Non può iniziare o finire con _ o -","❌ Não pode começar ou terminar com _ ou -")); return; }
    setPseudoChecking(true);
    setPseudoMsg(tr("Vérification...","Checking...","Prüfe...","Verifica...","Verificando..."));
    try {
      // Check if pseudo already taken (case-insensitive)
      const existing = await sbFetch("bb_pseudos?pseudo=ilike."+encodeURIComponent(clean)+"&select=player_id&limit=1");
      if (Array.isArray(existing) && existing.length > 0) {
        if (existing[0].player_id === playerId) {
          // It's mine - confirm it
          setPseudoConfirmed(true);
          setPseudoScreen(false);
          setPlayerName(clean);
          try { localStorage.setItem("bb_name", clean); } catch {}
          setPseudoMsg("");
        } else {
          setPseudoMsg(tr("❌ Ce pseudo est déjà pris !","❌ This username is already taken!","❌ Dieser Name ist schon vergeben!","❌ Questo nome è già preso!","❌ Este nome já está em uso!"));
        }
        setPseudoChecking(false);
        return;
      }
      // Check if I already have a pseudo
      const mine = await sbFetch("bb_pseudos?player_id=eq."+playerId+"&select=player_id,pseudo,country&limit=1");
      const country = await detectCountry();
      let finalRecoveryCode = recoveryCode;
      if (Array.isArray(mine) && mine.length > 0) {
        // Update existing pseudo — on ne touche PAS recovery_code (déjà en base,
        // et non lisible côté public depuis la Phase 2 sécurité).
        const payload = country ? {pseudo: clean, country} : {pseudo: clean};
        await sbFetch("bb_pseudos?player_id=eq."+playerId, {
          method: "PATCH",
          body: JSON.stringify(payload),
          headers: {"Prefer": "return=minimal"}
        });
      } else {
        // Create new pseudo avec code de récupération
        finalRecoveryCode = generateRecoveryCode();
        const payload = country 
          ? {player_id: playerId, pseudo: clean, country, recovery_code: finalRecoveryCode}
          : {player_id: playerId, pseudo: clean, recovery_code: finalRecoveryCode};
        await sbFetch("bb_pseudos", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      }
      setPlayerName(clean);
      try {
        localStorage.setItem("bb_name", clean);
        if (finalRecoveryCode) localStorage.setItem("bb_recovery_code", finalRecoveryCode);
      } catch {}
      if (finalRecoveryCode) setRecoveryCode(finalRecoveryCode);
      setPseudoConfirmed(true);
      setPseudoScreen(false);
      setPseudoMsg(tr("✓ Pseudo réservé !","✓ Username reserved!","✓ Name reserviert!","✓ Nome riservato!","✓ Nome reservado!"));
      // Afficher le code de récupération seulement si c'est une nouvelle création
      if (!Array.isArray(mine) || mine.length === 0) {
        setShowRecoveryCodeModal({code: finalRecoveryCode});
        setRecoveryConfirmed(false);
      }
    } catch(e) {
      setPseudoMsg("Erreur: "+e.message);
    }
    setPseudoChecking(false);
  }

  // Récupération de compte via code
  async function recoverAccount() {
    const code = recoveryInput.trim().toUpperCase();
    if (!code) { setRecoveryMsg(tr("❌ Entre ton code","❌ Enter your code","❌ Gib deinen Code ein","❌ Inserisci il tuo codice","❌ Digite seu código")); return; }
    if (!/^GOATFC-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
      setRecoveryMsg(tr("❌ Format invalide (GOATFC-XXXX-XXXX)","❌ Invalid format (GOATFC-XXXX-XXXX)","❌ Ungültiges Format (GOATFC-XXXX-XXXX)","❌ Formato non valido (GOATFC-XXXX-XXXX)","❌ Formato inválido (GOATFC-XXXX-XXXX)"));
      return;
    }
    setRecoveryLoading(true);
    setRecoveryMsg(tr("Récupération...","Recovering...","Wiederherstellung...","Recupero...","Recuperando..."));
    try {
      // Récupération via fonction serveur sécurisée (le code n'est jamais lu
      // directement côté client — la colonne recovery_code n'est pas exposée).
      const found = await sbFetch("rpc/recover_account", {
        method: "POST",
        body: JSON.stringify({ p_code: code })
      });
      if (!Array.isArray(found) || found.length === 0) {
        setRecoveryMsg(tr("❌ Code introuvable","❌ Code not found","❌ Code nicht gefunden","❌ Codice non trovato","❌ Código não encontrado"));
        setRecoveryLoading(false);
        return;
      }
      const account = found[0];
      // Restaurer le compte localement
      try {
        localStorage.setItem("bb_player_id", account.player_id);
        localStorage.setItem("bb_name", account.pseudo);
        localStorage.setItem("bb_recovery_code", code);
      } catch {}
      setRecoveryMsg(tr("✓ Compte récupéré ! Rechargement...","✓ Account recovered! Reloading...","✓ Konto wiederhergestellt! Wird neu geladen...","✓ Account recuperato! Ricaricamento...","✓ Conta recuperada! Recarregando..."));
      // Recharger la page pour réinitialiser tous les states avec le bon player_id
      setTimeout(()=>{ window.location.reload(); }, 1200);
    } catch(e) {
      setRecoveryMsg("Erreur: "+(e.message||""));
      setRecoveryLoading(false);
    }
  }

  async function initPseudo() {
    // Check if player already has a confirmed pseudo
    const saved = (() => { try { return localStorage.getItem("bb_name"); } catch { return null; } })();
    if (saved && saved.trim().length >= 2) {
      // Verify it's still valid in DB
      try {
        const mine = await sbFetch("bb_pseudos?player_id=eq."+playerId+"&select=player_id,pseudo&limit=1");
        if (Array.isArray(mine) && mine.length > 0) {
          setPlayerName(mine[0].pseudo);
          localStorage.setItem("bb_name", mine[0].pseudo);
          setPseudoConfirmed(true);
          // Le code de récupération vient du localStorage (plus lu depuis la DB :
          // la colonne recovery_code n'est plus exposée côté public).
          return;
        }
      } catch {}
    }
    // No pseudo yet - show pseudo screen
    setPseudoScreen(true);
  }


  // ── FRIEND FUNCTIONS ──
  async function loadFriends() {
    try {
      const removed = JSON.parse(localStorage.getItem("bb_removed_friends") || "[]");
      const names = JSON.parse(localStorage.getItem("bb_friend_names") || "{}");
      let ids = [];

      // Source principale : Supabase (demandes acceptées dans les deux sens)
      const [accepted, received] = await Promise.all([
        sbFetch("bb_friend_requests?from_id=eq."+playerId+"&status=eq.accepted&select=to_id,to_name"),
        sbFetch("bb_friend_requests?to_id=eq."+playerId+"&status=eq.accepted&select=from_id,from_name")
      ]);

      if (Array.isArray(accepted)) {
        accepted.forEach(function(r) {
          if (!ids.includes(r.to_id) && !removed.includes(r.to_id)) {
            ids.push(r.to_id);
            if (r.to_name) names[r.to_id] = r.to_name;
          }
        });
      }
      if (Array.isArray(received)) {
        received.forEach(function(r) {
          if (!ids.includes(r.from_id) && !removed.includes(r.from_id)) {
            ids.push(r.from_id);
            if (r.from_name) names[r.from_id] = r.from_name;
          }
        });
      }

      localStorage.setItem("bb_friend_names", JSON.stringify(names));
      localStorage.setItem("bb_friends", JSON.stringify(ids));
      setFriendsList(ids);
      return ids;
    } catch {
      // Fallback localStorage si Supabase inaccessible
      try {
        const stored = JSON.parse(localStorage.getItem("bb_friends") || "[]");
        setFriendsList(stored);
        return stored;
      } catch { return []; }
    }
  }

  async function fetchFriendScores(ids) {
    if (!ids || ids.length === 0) { setFriendScores([]); return; }
    setFriendLoading(true);
    try {
      const allIds = [playerId, ...ids];
      const filter = "player_id=in.(" + allIds.join(",") + ")";
      const data = await sbFetch("bb_scores?select=player_id,player_name,score,mode,diff,created_at&" + filter + "&order=score.desc");
      const best = {};
      (data || []).forEach(function(row) {
        const key = row.player_id + "_" + row.mode + "_" + (row.diff || "");
        if (!best[key] || row.score > best[key].score) best[key] = row;
      });
      setFriendScores(Object.values(best).sort(function(a,b){return b.score-a.score;}));
    } catch(e) { console.error(e); }
    setFriendLoading(false);
  }

  // Suppression complète du compte — requis par Apple App Store / RGPD
  // Utilise la RPC delete_user_account côté Supabase qui vérifie le recovery_code
  // et supprime tout en une transaction sécurisée.
  async function deleteAccount() {
    try {
      // 1. Appeler la RPC sécurisée Supabase (vérification recovery_code + DELETE en cascade)
      let success = false;
      try {
        const r = await fetch(SB_URL + "/rest/v1/rpc/delete_user_account", {
          method: "POST",
          headers: {
            "apikey": SB_KEY,
            "Authorization": "Bearer " + SB_KEY,
            "Content-Type": "application/json",
            "Prefer": "return=representation"
          },
          body: JSON.stringify({
            p_player_id: playerId,
            p_recovery_code: recoveryCode || ""
          })
        });
        if (r.ok) {
          const result = await r.json();
          success = result && result.ok === true;
        }
      } catch (e) { console.error("RPC delete failed:", e); }

      // 2. Supprimer l'avatar du Storage (best-effort, hors transaction)
      try {
        await fetch(SB_URL + "/storage/v1/object/avatars/" + playerId + ".jpg", {
          method: "DELETE",
          headers: { "Authorization": "Bearer " + SB_KEY, "apikey": SB_KEY }
        });
      } catch(e) {}

      // 3. Vider le localStorage (que la RPC ait réussi ou non — l'user a demandé une suppression locale au minimum)
      try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith("bb_")) keysToRemove.push(k);
        }
        keysToRemove.forEach(function(k){ localStorage.removeItem(k); });
      } catch {}

      // 4. Reload pour réinitialiser l'app entièrement
      window.location.href = "/";
    } catch(e) { console.error("deleteAccount error:", e); }
  }

  async function addFriend(pseudo) {
    const clean = pseudo.trim();
    if (clean.length < 2) { setFriendMsg(tr("Pseudo trop court","Username too short","Name zu kurz","Nome troppo corto","Nome muito curto")); return; }
    if (clean.toLowerCase() === (playerName||"").toLowerCase()) { setFriendMsg(tr("C'est ton propre pseudo !","That's your own username!","Das ist dein eigener Name!","È il tuo stesso nome!","Esse é o seu próprio nome!")); return; }
    setFriendMsg(tr("🔍 Recherche...","🔍 Searching...","🔍 Suche...","🔍 Ricerca...","🔍 Buscando..."));
    try {
      // Chercher le player_id correspondant au pseudo
      const result = await sbFetch("bb_pseudos?pseudo=ilike."+encodeURIComponent(clean)+"&select=player_id,pseudo&limit=1");
      if (!Array.isArray(result) || result.length === 0) {
        setFriendMsg(tr("❌ Pseudo introuvable. Vérifie l'orthographe.","❌ Username not found. Check the spelling.","❌ Name nicht gefunden. Prüfe die Schreibweise.","❌ Nome non trovato. Controlla l'ortografia.","❌ Nome não encontrado. Verifique a grafia."));
        return;
      }
      const targetId = result[0].player_id;
      const targetName = result[0].pseudo;
      if (targetId === playerId) { setFriendMsg(tr("C'est ton propre pseudo !","That's your own username!","Das ist dein eigener Name!","È il tuo stesso nome!","Esse é o seu próprio nome!")); return; }
      if (friendsList.includes(targetId)) { setFriendMsg(tr("Vous êtes déjà amis !","You're already friends!","Ihr seid schon Freunde!","Siete già amici!","Vocês já são amigos!")); return; }
      const alreadySent = sentRequests.find(function(r){return r.to_id===targetId && r.status==="pending";});
      if (alreadySent) { setFriendMsg((tr("Demande déjà envoyée à ","Request already sent to ","Anfrage bereits gesendet an ","Richiesta già inviata a ","Pedido já enviado para "))+targetName+" !"); return; }
      const name = (playerName||"Anonyme").trim();
      // Upsert la demande
      const res = await fetch(SB_URL + "/rest/v1/bb_friend_requests", {
        method: "POST",
        headers: {
          "apikey": SB_KEY,
          "Authorization": "Bearer " + SB_KEY,
          "Content-Type": "application/json",
          "Prefer": "resolution=merge-duplicates,return=minimal"
        },
        body: JSON.stringify({from_id:playerId, from_name:name, to_id:targetId, to_name:targetName, status:"pending"})
      });
      if (!res.ok && res.status !== 201) {
        setFriendMsg(tr("❌ Erreur. Réessaie.","❌ Error. Try again.","❌ Fehler. Versuch's nochmal.","❌ Errore. Riprova.","❌ Erro. Tente de novo."));
        return;
      }
      setFriendMsg((tr("✓ Demande envoyée à ","✓ Request sent to ","✓ Anfrage gesendet an ","✓ Richiesta inviata a ","✓ Pedido enviado para "))+targetName+" !");
      setFriendInput("");
      // Mise à jour du profil consulté : marquer la demande comme envoyée pour feedback visuel
      setViewedProfileData(function(prev){ return prev ? {...prev, requestSent: true} : prev; });
      // Retirer de la blacklist si besoin
      try {
        const removed = JSON.parse(localStorage.getItem("bb_removed_friends") || "[]");
        localStorage.setItem("bb_removed_friends", JSON.stringify(removed.filter(function(id){return id!==targetId;})));
      } catch {}
      // Persister localement
      try {
        const pending = JSON.parse(localStorage.getItem("bb_pending_sent") || "[]");
        if (!pending.find(function(p){return p.to_id===targetId;})) {
          pending.push({id:"tmp-"+Date.now(), from_id:playerId, to_id:targetId, status:"pending"});
          localStorage.setItem("bb_pending_sent", JSON.stringify(pending));
        }
      } catch {}
      setSentRequests(function(prev){return [...prev, {id:"tmp-"+Date.now(), from_id:playerId, to_id:targetId, to_name:targetName, status:"pending"}];});
      // Notif push à la cible (best-effort, ignore les erreurs)
      try {
        fetch(SB_URL + "/functions/v1/send-friend-notification", {
          method: "POST",
          headers: {"Content-Type":"application/json","Authorization":"Bearer "+SB_KEY},
          body: JSON.stringify({to_id: targetId, from_name: playerName||"Quelqu'un", type:"request"})
        }).catch(function(){});
      } catch {}
    } catch(e) { setFriendMsg(tr("❌ Erreur réseau. Réessaie.","❌ Network error. Try again.","❌ Netzwerkfehler. Versuch's nochmal.","❌ Errore di rete. Riprova.","❌ Erro de rede. Tente de novo.")); }
  }

  async function acceptRequest(req) {
    try {
      await sbFetch("bb_friend_requests?id=eq."+req.id, {
        method: "PATCH",
        body: JSON.stringify({status:"accepted"}),
        headers: {"Prefer":"return=minimal"}
      });
      // Add to local friends list (save id and name)
      const newList = [...friendsList, req.from_id];
      localStorage.setItem("bb_friends", JSON.stringify(newList));
      // Save friend name
      try {
        const names = JSON.parse(localStorage.getItem("bb_friend_names") || "{}");
        names[req.from_id] = req.from_name;
        localStorage.setItem("bb_friend_names", JSON.stringify(names));
        // Retirer de la blacklist si l'ami avait été supprimé avant
        const removed = JSON.parse(localStorage.getItem("bb_removed_friends") || "[]");
        localStorage.setItem("bb_removed_friends", JSON.stringify(removed.filter(function(id){return id!==req.from_id;})));
      } catch {}
      setFriendsList(newList);
      fetchFriendScores(newList);
      loadFriendRequests();
      // Notif push à l'expéditeur de la demande pour lui dire qu'on a accepté (best-effort)
      try {
        fetch(SB_URL + "/functions/v1/send-friend-notification", {
          method: "POST",
          headers: {"Content-Type":"application/json","Authorization":"Bearer "+SB_KEY},
          body: JSON.stringify({to_id: req.from_id, from_name: playerName||"Quelqu'un", type:"accepted"})
        }).catch(function(){});
      } catch {}
    } catch(e) { console.error(e); }
  }

  async function declineRequest(req) {
    try {
      await sbFetch("bb_friend_requests?id=eq."+req.id, {
        method: "PATCH",
        body: JSON.stringify({status:"declined"}),
        headers: {"Prefer":"return=minimal"}
      });
      loadFriendRequests();
    } catch(e) { console.error(e); }
  }

  async function removeFriend(fid) {
    const newList = friendsList.filter(function(id){return id !== fid;});
    localStorage.setItem("bb_friends", JSON.stringify(newList));
    // Ajouter à la blacklist pour éviter la re-sync depuis Supabase
    try {
      const removed = JSON.parse(localStorage.getItem("bb_removed_friends") || "[]");
      if (!removed.includes(fid)) removed.push(fid);
      localStorage.setItem("bb_removed_friends", JSON.stringify(removed));
      // Nettoyer aussi les demandes pending locales
      const pending = JSON.parse(localStorage.getItem("bb_pending_sent") || "[]");
      localStorage.setItem("bb_pending_sent", JSON.stringify(pending.filter(function(p){return p.to_id!==fid;})));
    } catch {}
    setFriendsList(newList);
    fetchFriendScores(newList);
    // Nettoie les demandes dans Supabase dans les deux sens
    try {
      await sbFetch("bb_friend_requests?from_id=eq."+playerId+"&to_id=eq."+fid, {method:"DELETE"});
      await sbFetch("bb_friend_requests?from_id=eq."+fid+"&to_id=eq."+playerId, {method:"DELETE"});
      loadFriendRequests();
    } catch(e) { console.error(e); }
  }

  async function loadFriendRequests() {
    try {
      const incoming = await sbFetch("bb_friend_requests?to_id=eq."+playerId+"&status=eq.pending&order=created_at.desc");
      if (Array.isArray(incoming)) setFriendRequests(incoming);
      const sent = await sbFetch("bb_friend_requests?from_id=eq."+playerId+"&order=created_at.desc&limit=20");
      // Charger les demandes en attente persistées localement
      let localPending = [];
      try { localPending = JSON.parse(localStorage.getItem("bb_pending_sent") || "[]"); } catch {}
      if (Array.isArray(sent)) {
        // Retirer du localStorage les demandes qui ont été traitées (acceptée/refusée/trouvée dans Supabase)
        const updatedLocal = localPending.filter(function(p) {
          const found = sent.find(function(s){return s.to_id===p.to_id;});
          return !found; // garder seulement celles absentes de Supabase
        });
        try { localStorage.setItem("bb_pending_sent", JSON.stringify(updatedLocal)); } catch {}
        // Merger : entrées locales + résultats Supabase
        const merged = [...updatedLocal, ...sent];
        setSentRequests(merged);
      } else {
        // Supabase inaccessible : afficher au moins les locales
        setSentRequests(function(prev) {
          const existingIds = prev.map(function(r){return r.to_id;});
          const toAdd = localPending.filter(function(p){return !existingIds.includes(p.to_id);});
          return [...prev, ...toAdd];
        });
      }
    } catch(e) { console.error(e); }
  }

  async function submitScore(name, sc, mode, d) {
    try {
      await sbFetch("bb_scores", {
        method: "POST",
        body: JSON.stringify({player_id:playerId, player_name:(name||"Anonyme").trim(), score:sc, mode:mode, diff:d||null})
      });
    } catch(e) { console.error(e); }
  }


  async function loadSeasons() {
    try {
      const data = await sbFetch("bb_seasons?order=season_number.desc&limit=20");
      if (Array.isArray(data)) setHallOfFame(data);
    } catch(e) {}
  }

  async function checkAndCloseSeason() {
    const season = getCurrentSeason();
    if (season.num <= 1) return; // pas encore de saison précédente à clôturer
    try {
      // Calculer le monthKey de la saison précédente
      const now = new Date();
      const paris = new Date(now.toLocaleString('en-US',{timeZone:'Europe/Paris'}));
      const prevMonth = new Date(paris.getFullYear(), paris.getMonth() - 1, 1);
      const prevMonthKey = prevMonth.getFullYear() + "-" + String(prevMonth.getMonth()+1).padStart(2,'0');
      // Garde supplémentaire : prevMonthKey doit être >= mois de SEASON_START
      // (sinon on essaierait de clôturer une saison qui n'a jamais existé)
      const seasonStartKey = "2026-04";
      if (prevMonthKey < seasonStartKey) return;
      // Vérifier si la saison précédente a déjà été clôturée
      const prev = await sbFetch("bb_seasons?season_number=eq."+(season.num-1)+"&limit=1");
      if (Array.isArray(prev) && prev.length > 0) return; // déjà clôturée

      // Récupérer les joueurs avec xp_season du mois précédent
      const rows = await sbFetch("bb_pseudos?select=player_id,pseudo,xp_season&xp_season_month=eq."+prevMonthKey+"&order=xp_season.desc&limit=10");
      if (!Array.isArray(rows) || rows.length === 0) return;
      const top = rows.filter(r => (r.xp_season || 0) > 0);
      // Garde anti-bidon : il faut au moins 3 joueurs ayant participé pour valider la saison
      if (top.length < 3) return;

      const champion = top[0];
      const runnerUp = top[1] || null;
      const third = top[2] || null;

      // Créer l'entrée Hall of Fame.
      // ⚠️ La table bb_seasons ne contient aujourd'hui que les colonnes du
      // champion (season_number, champion_*, mode, ended_at) : un insert avec
      // le podium complet est rejeté par PostgREST (colonnes inconnues) et les
      // saisons 2+ n'ont jamais été enregistrées. On tente le podium complet
      // (au cas où les colonnes seraient ajoutées côté DB), puis on retombe
      // sur le schéma minimal pour ne jamais perdre le titre du champion.
      const championRow = {
        season_number: season.num - 1,
        champion_id: champion.player_id,
        champion_name: champion.pseudo,
        champion_score: champion.xp_season,
        mode: "global",
        ended_at: new Date().toISOString()
      };
      const fullPodiumRow = {
        ...championRow,
        season_month: prevMonthKey,
        runner_up_id: runnerUp ? runnerUp.player_id : null,
        runner_up_name: runnerUp ? runnerUp.pseudo : null,
        runner_up_xp: runnerUp ? runnerUp.xp_season : null,
        third_id: third ? third.player_id : null,
        third_name: third ? third.pseudo : null,
        third_xp: third ? third.xp_season : null
      };
      let created = await sbFetch("bb_seasons", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(fullPodiumRow)
      });
      if (created === null) {
        created = await sbFetch("bb_seasons", {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify(championRow)
        });
      }
      if (created === null) {
        console.warn("bb_seasons : échec de la clôture de la saison", season.num - 1);
        return;
      }
      loadSeasons();
    } catch(e) { /* silent */ }
  }

  async function loadLeaderboard(mode) {
    try {
      // Mode Saison : classement par XP du mois en cours (table bb_pseudos)
      if (mode === "saison") {
        const currentMonth = getCurrentSeason().monthKey;
        // On récupère tous les joueurs dont xp_season_month correspond au mois en cours
        const rows = await sbFetch("bb_pseudos?select=player_id,pseudo,xp,xp_season,xp_season_month,country&xp_season_month=eq."+currentMonth+"&order=xp_season.desc&limit=50");
        if (!Array.isArray(rows)) { setLeaderboard([]); return; }
        const sorted = rows
          .filter(r => (r.xp_season || 0) > 0)
          .map(function(r, i) { return {
            name: r.pseudo || "?",
            pid: r.player_id,
            score: r.xp_season || 0,
            xp: r.xp || 0, // XP lifetime pour afficher le grade
            xpSeason: r.xp_season || 0,
            country: r.country || null,
            rank: i + 1,
            played: 0, wins:0, draws:0, losses:0, streak:0
          }; });
        setLeaderboard(sorted);
        return;
      }
      const isAmis = mode === "amis";
      const isGlobal = mode === "global" || isAmis;
      const season = getCurrentSeason();

      // Couronner le champion de la saison précédente si pas encore fait (fire-and-forget)
      if (season.num > 1) {
        checkAndCloseSeason();
      }

      // Filtre par saison sauf pour l'onglet Amis
      // Saison 1 = pas de filtre date (tous les scores historiques) — filtre actif dès saison 2
      const seasonFilter = (!isAmis && season.num > 1) ? "&created_at=gte."+season.start.toISOString()+"&created_at=lt."+season.end.toISOString() : "";
      const modeFilter = (!mode || isGlobal) ? "" : "mode=eq."+mode+"&";
      const data = await sbFetch("bb_scores?"+modeFilter+"order=score.desc&limit=1000&select=player_id,player_name,score,mode"+seasonFilter);
      if (!Array.isArray(data)) { setLeaderboard([]); return; }
      const stats = {};
      data.forEach(function(row) {
        if (!stats[row.player_id]) stats[row.player_id] = { name:row.player_name, pid:row.player_id, best:row.score, played:0, bestPont:0, bestChaine:0 };
        if (row.score > stats[row.player_id].best) stats[row.player_id].best = row.score;
        // played is now counted only from duels and rooms (below), not from solo scores
        if (row.mode === "pont" && row.score > stats[row.player_id].bestPont) stats[row.player_id].bestPont = row.score;
        if (row.mode === "chaine" && row.score > stats[row.player_id].bestChaine) stats[row.player_id].bestChaine = row.score;
      });
      const duels = await sbFetch("bb_duels?status=eq.complete"+((!mode||isGlobal)?"":"&mode=eq."+mode)+"&select=challenger_id,opponent_id,challenger_score,opponent_score&limit=500");
      if (Array.isArray(duels)) {
        duels.forEach(function(d) {
          [d.challenger_id, d.opponent_id].forEach(function(pid) {
            if (!stats[pid]) return;
            if (!stats[pid].wins) stats[pid].wins = 0;
            if (!stats[pid].draws) stats[pid].draws = 0;
            if (!stats[pid].losses) stats[pid].losses = 0;
            const myScore = pid === d.challenger_id ? d.challenger_score : d.opponent_score;
            const theirScore = pid === d.challenger_id ? d.opponent_score : d.challenger_score;
            stats[pid].played = (stats[pid].played||0) + 1;
            if (myScore > theirScore) stats[pid].wins++;
            else if (myScore === theirScore) stats[pid].draws++;
            else stats[pid].losses++;
          });
        });
      }
      // Inclure aussi les parties en salle
      const rooms = await sbFetch("bb_rooms?status=eq.complete&select=players,mode&limit=500");
      if (Array.isArray(rooms)) {
        rooms.forEach(function(r) {
          try {
            const players = typeof r.players === "string" ? JSON.parse(r.players) : r.players;
            if (!Array.isArray(players) || players.length < 2) return;
            const sorted = [...players].sort(function(a,b){
              if (a.abandoned && !b.abandoned) return 1;
              if (!a.abandoned && b.abandoned) return -1;
              return (b.score||0)-(a.score||0);
            });
            const topScore = sorted[0].score || 0;
            players.forEach(function(p) {
              const pid = p.id;
              if (!pid || !stats[pid]) return;
              if (!stats[pid].wins) stats[pid].wins = 0;
              if (!stats[pid].draws) stats[pid].draws = 0;
              if (!stats[pid].losses) stats[pid].losses = 0;
              const myScore = p.score || 0;
              const winners = players.filter(function(x){return !x.abandoned && (x.score||0)===topScore;});
              stats[pid].played = (stats[pid].played||0) + 1;
              if (!p.abandoned && myScore === topScore && winners.length === 1) stats[pid].wins++;
              else if (!p.abandoned && myScore === topScore && winners.length > 1) stats[pid].draws++;
              else stats[pid].losses++;
            });
          } catch(e){}
        });
      }
      // Calculer les streaks depuis les duels triés par date
      const duelsDated = await sbFetch("bb_duels?status=eq.complete&select=challenger_id,opponent_id,challenger_score,opponent_score,created_at&order=created_at.asc&limit=1000");
      if (Array.isArray(duelsDated)) {
        // Grouper les résultats par joueur dans l'ordre chronologique
        const playerResults = {};
        duelsDated.forEach(function(d) {
          [d.challenger_id, d.opponent_id].forEach(function(pid) {
            if (!pid) return;
            if (!playerResults[pid]) playerResults[pid] = [];
            const myScore = pid === d.challenger_id ? d.challenger_score : d.opponent_score;
            const theirScore = pid === d.challenger_id ? d.opponent_score : d.challenger_score;
            const result = myScore > theirScore ? "W" : myScore === theirScore ? "D" : "L";
            playerResults[pid].push(result);
          });
        });
        // Calculer le streak actuel (compter depuis la fin)
        Object.keys(playerResults).forEach(function(pid) {
          if (!stats[pid]) return;
          const results = playerResults[pid];
          let streak = 0;
          for (let i = results.length - 1; i >= 0; i--) {
            if (results[i] === "W") streak++;
            else break;
          }
          stats[pid].streak = streak;
        });
      }
      const sorted = Object.values(stats)
        .map(function(r){ return {name:r.name, pid:r.pid||"", score:isGlobal?(r.bestPont+r.bestChaine):r.best, bestPont:r.bestPont, bestChaine:r.bestChaine, played:r.played, wins:r.wins||0, draws:r.draws||0, losses:r.losses||0, streak:r.streak||0}; })
        .sort(function(a,b){ return b.score - a.score; })
        .slice(0,50)
        .map(function(r,i){ return {...r, rank:i+1}; });
      // Fetch countries et XP cumulée depuis bb_pseudos pour pouvoir afficher le vrai grade du joueur
      // En mode global/amis : on remplace le score par l'XP cumulée lifetime pour que le classement
      // reflète le niveau réel du joueur (cohérent avec les grades) et non son meilleur score d'une partie
      try {
        const pseudos = await sbFetch("bb_pseudos?select=player_id,country,xp,pseudo");
        if (Array.isArray(pseudos)) {
          const countryMap = {};
          const xpMap = {};
          const pseudoMap = {};
          pseudos.forEach(function(p) {
            if (p.country) countryMap[p.player_id] = p.country;
            if (typeof p.xp === "number") xpMap[p.player_id] = p.xp;
            if (p.pseudo) pseudoMap[p.player_id] = p.pseudo;
          });
          sorted.forEach(function(row) {
            row.country = countryMap[row.pid] || null;
            row.xp = xpMap[row.pid] || 0;
            // Remplacer le score (best perf d'une partie) par l'XP cumulée
            row.score = row.xp;
            // Utiliser le pseudo actuel de bb_pseudos (source de vérité)
            if (pseudoMap[row.pid]) row.name = pseudoMap[row.pid];
          });
          // Ajouter les users qui ont de l'XP mais n'ont pas encore joué de partie comptée
          // (cas rare : XP gagnée hors bb_scores, défi du jour, etc.)
          const existingPids = new Set(sorted.map(r => r.pid));
          pseudos.forEach(function(p) {
            if (!existingPids.has(p.player_id) && (p.xp || 0) > 0) {
              sorted.push({
                name: p.pseudo || "?",
                pid: p.player_id,
                score: p.xp || 0,
                xp: p.xp || 0,
                country: p.country || null,
                bestPont: 0, bestChaine: 0, played: 0,
                wins: 0, draws: 0, losses: 0, streak: 0
              });
            }
          });
          // Re-trier par XP et re-numéroter
          sorted.sort(function(a,b){ return (b.score||0) - (a.score||0); });
          sorted.forEach(function(r,i){ r.rank = i+1; });
          // Garder top 50
          if (sorted.length > 50) sorted.length = 50;
        }
      } catch(e){}
      setLeaderboard(sorted);
      // Charger le Hall of Fame
      try {
        const hof = await sbFetch("bb_seasons?order=season_number.desc&limit=10");
        if (Array.isArray(hof)) setHallOfFame(hof);
      } catch(e){}
    } catch(e) { setLeaderboard([]); }
  }

  function footballPoints(sc, list) {
    // Comparer à mon propre meilleur score, pas au #1 global
    const myEntry = list.find(e => (e.player_name || e.name) === playerName.trim());
    const myBest = myEntry ? myEntry.score : 0;
    if(myBest === 0) return 10;        // Premier score = toujours victoire
    if(sc > myBest) return 10;         // Nouveau record perso = victoire
    if(sc >= myBest * 0.85) return 5;  // Proche du record = nul
    return 0;                           // Loin = défaite
  }

  // Incrémente l'XP du joueur (lifetime ET saisonnier) en local et dans Supabase
  // Appelé à la fin de chaque partie avec le score gagné
  async function addXp(scoreGained) {
    if (!playerId || !pseudoConfirmed) return;
    const xpGained = Math.max(0, scoreGained); // pas d'XP négatif si score <0
    if (xpGained === 0) return;
    const season = getCurrentSeason();
    const oldXp = playerXp;
    const newXp = oldXp + xpGained;
    // Si on est dans un nouveau mois, on reset automatiquement l'XP saison avant d'ajouter
    // (cas où le joueur n'a pas ouvert l'app au changement de mois)
    const newXpSeason = playerXpSeason + xpGained; // la logique de reset est dans loadPlayerXp au démarrage
    setPlayerXp(newXp);
    setPlayerXpSeason(newXpSeason);

    // Cartes de collection franchies par ce gain d'XP. Rien à stocker : la
    // possession se déduit de l'XP. On mémorise seulement les annonces déjà
    // faites (localStorage) pour ne pas refêter la même carte à chaque partie
    // si l'XP locale et la base se désynchronisent.
    try {
      const gagnees = newlyUnlocked(oldXp, newXp);
      if (gagnees.length) {
        let vues = [];
        try { vues = JSON.parse(localStorage.getItem("bb_cards_seen") || "[]"); } catch (e) { vues = []; }
        const nouvelles = gagnees.filter(function(c){ return vues.indexOf(c.id) === -1; });
        if (nouvelles.length) {
          // La plus rare des cartes gagnées d'un coup : c'est celle qui mérite l'écran.
          const fetee = nouvelles[nouvelles.length - 1];
          try { localStorage.setItem("bb_cards_seen", JSON.stringify(vues.concat(nouvelles.map(function(c){ return c.id; })))); } catch (e) {}
          setTimeout(function(){ setCardPopup(fetee); }, 900); // après l'écran de fin de partie
        }
      }
    } catch (e) { /* jamais bloquant pour l'XP */ }

    // Détection de changement de grade
    // On compare le grade actuel au grade "déjà notifié" (stocké en DB dans last_notified_grade)
    // Ça permet de détecter les grade-ups même si :
    // - playerXp local est désynchro (race condition au chargement)
    // - l'user a raté la notif précédente (pas ouvert l'app)
    // - plusieurs parties d'affilée sans revenir à l'accueil
    // Les grades sont triés du plus haut (GOAT = 0) au plus bas (Joueur du dimanche = 4)
    // Un user qui monte a un index qui DIMINUE
    const oldGradeIdx = GRADES.findIndex(function(g){ return oldXp >= g.min; });
    const newGradeIdx = GRADES.findIndex(function(g){ return newXp >= g.min; });
    let hasLeveledUp = newGradeIdx < oldGradeIdx && newGradeIdx !== -1;
    
    // Double-check : si on vient de franchir un palier MAIS aussi si le grade stocké en DB
    // n'est pas encore à jour (ex: user à 510 XP mais last_notified_grade=4), on force le popup
    try {
      const currentData = await sbFetch("bb_pseudos?player_id=eq." + playerId + "&select=last_notified_grade&limit=1");
      if (Array.isArray(currentData) && currentData.length > 0) {
        const dbNotifiedGrade = currentData[0].last_notified_grade;
        // Si le grade actuel (newGradeIdx) est plus haut que le grade notifié en DB (dbNotifiedGrade)
        // → grade up à afficher
        if (typeof dbNotifiedGrade === "number" && newGradeIdx < dbNotifiedGrade && newGradeIdx !== -1) {
          hasLeveledUp = true;
        }
      }
    } catch(e) {}

    try {
      await sbFetch("bb_pseudos?player_id=eq." + playerId, {
        method: "PATCH",
        headers: { "Content-Type":"application/json", "Prefer":"return=minimal" },
        body: JSON.stringify({
          xp: newXp,
          xp_season: newXpSeason,
          xp_season_month: season.monthKey,
          ...(hasLeveledUp ? { last_notified_grade: newGradeIdx } : {})
        })
      });
    } catch(e) { /* silent - XP reste updaté en local */ }

    // Si grade up, notifier les amis via Edge Function + afficher popup de célébration
    if (hasLeveledUp) {
      const newGrade = GRADES[newGradeIdx];
      // Popup de célébration : on le déclenche avec un délai pour qu'il s'affiche
      // quand l'utilisateur revient sur l'écran principal (l'écran de fin de partie
      // est affiché d'abord, puis l'user clique "retour" → arrive sur home → popup)
      // On utilise un event custom window pour que le popup s'affiche au bon moment
      try { 
        localStorage.setItem("bb_pending_grade_up", JSON.stringify({
          min: newGrade.min,
          label: newGrade.label,
          labelEn: newGrade.labelEn,
          emoji: newGrade.emoji,
          color: newGrade.color,
          timestamp: Date.now()
        }));
      } catch {}
      try {
        fetch(SB_URL + "/functions/v1/send-grade-up-notification", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + SB_KEY,
          },
          body: JSON.stringify({
            playerId: playerId,
            pseudo: playerName || "Un pote",
            newGradeLabel: newGrade.label,
            newGradeEmoji: newGrade.emoji,
          })
        }).catch(function(){});
      } catch(e) {}
    }
  }

  // Les overlays « Trouve le joueur » (FindPlayer) tournent par-dessus LePont et
  // n'ont pas accès à addXp. Ils émettent goatfc:award-xp quand une manche est
  // gagnée → on crédite l'XP ici pour que ça compte dans le classement (Saison/Global/Amis).
  const addXpRef = React.useRef(addXp);
  addXpRef.current = addXp;
  React.useEffect(function() {
    function onAward(e) { try { addXpRef.current((e && e.detail && e.detail.amount) || 0); } catch (_) {} }
    window.addEventListener("goatfc:award-xp", onAward);
    return function() { window.removeEventListener("goatfc:award-xp", onAward); };
  }, []);

  function submitToLeaderboard(name, sc, mode, d) {
    if (!pseudoConfirmed || !playerName.trim()) return; // pas de pseudo = pas de classement
    submitScore(name, sc, mode, d);
    const displayName = (name||"").trim() || "Anonyme";
    try {
      const key = `bb_lb_${mode}_${d}`;
      const data = localStorage.getItem(key);
      const list = data ? JSON.parse(data) : [];
      // Find if player already has an entry to accumulate pts
      const pts = footballPoints(sc, list);
      const existingIdx = list.findIndex(e => e.name === displayName);
      if(existingIdx >= 0) {
        // Update best score if better, always add football pts
        list[existingIdx].pts = (list[existingIdx].pts || 0) + pts;
        list[existingIdx].played = (list[existingIdx].played || 1) + 1;
        list[existingIdx].wins = (list[existingIdx].wins || 0) + (pts===3?1:0);
        list[existingIdx].draws = (list[existingIdx].draws || 0) + (pts===1?1:0);
        if(sc > list[existingIdx].score) {
          list[existingIdx].score = sc;
          list[existingIdx].combo = maxCombo;
          list[existingIdx].date = new Date().toLocaleDateString("fr-FR");
        }
        list[existingIdx].lastPts = pts;
      } else {
        list.push({
          name: displayName, score: sc, combo: maxCombo,
          date: new Date().toLocaleDateString("fr-FR"),
          pts, played:1, wins: pts===3?1:0, draws: pts===1?1:0, lastPts: pts,
        });
      }
      // Sort by football points, then by best score
      list.sort((a,b) => (b.pts||0)-(a.pts||0) || b.score-a.score);
      const top50 = list.slice(0,50);
      localStorage.setItem(key, JSON.stringify(top50));
      const rank = top50.findIndex(e => e.name === displayName) + 1;
      setMyLbRank(rank || null);
      setLeaderboard(top50);
      setMyLastPts(pts);
    } catch(e) { console.error(e); }
  }

  function handleCorrectAnswer(base, isChain=false) {
    hapticSuccess(); // retour haptique natif (no-op sur web)
    const now = Date.now();
    const elapsed = (now - lastAnswerTime.current) / 1000;
    lastAnswerTime.current = now;
    // Speed bonus : +5 pts si réponse rapide
    const speedBonus = elapsed <= COMBO_THRESHOLD ? 5 : 0;
    const newCombo = comboRef.current + 1;
    // Combo bonus : x3 → +10, x5 → +20, x10+ → +30
    const comboBonus = newCombo>=10?30:newCombo>=5?20:newCombo>=3?10:0;
    // Difficulty-based base points: 10 facile / 20 moyen / 30 expert (Mercato garde la même valeur)
    const diffBase = diff==="expert"?30:diff==="moyen"?20:10;
    const total = diffBase + speedBonus + comboBonus;
    setCombo(newCombo); if(newCombo>maxCombo) setMaxCombo(newCombo);
    // Phrase flatteuse aléatoire selon le niveau de combo
    setFeedbackPhrase(getPositiveFeedback(newCombo, lang));
    if(comboBonus>0||speedBonus>0){
      const parts=[];
      if(speedBonus)parts.push(`⚡ SPEED +${speedBonus}`);
      if(comboBonus)parts.push(`x${newCombo} COMBO +${comboBonus}`);
      setComboFloat(parts.join(" · "));
      playSound("combo");
      // Vibration combo : pattern double buzz pour marquer le coup
      vibrate([40,30,60]);
      setTimeout(()=>setComboFloat(null),1200);
    }else{
      playSound("ok");
      // Vibration bonne réponse : buzz court et net
      vibrate(30);
    }
    if(isChain){setChainScore(s=>{chainScoreRef.current=s+total;return s+total;});}
    else{setScore(s=>{scoreRef.current=s+total;return s+total;});}
    setScoreAnim("up"); setTimeout(()=>setScoreAnim(null),600);
    return total;
  }

  function handleWrongAnswer(penalty, isChain=false) {
    hapticError(); // retour haptique natif (no-op sur web)
    setCombo(0); comboRef.current=0; playSound("ko");
    // Vibration mauvaise réponse : buzz plus long et sec
    vibrate(150);
    if(isChain){setChainScore(s=>{chainScoreRef.current=s-penalty;return s-penalty;});}
    else{setScore(s=>{scoreRef.current=s-penalty;return s-penalty;});}
    setScoreAnim("down"); setTimeout(()=>setScoreAnim(null),600);
  }


  function endRound() {
    clearInterval(timerRef.current);
    const rs = scoreRef.current;
    
    // Anti-répétition : mémoriser les paires vues dans cette manche (solo uniquement)
    const isInRoom = activeDuelRef.current && activeDuelRef.current.isRoom;
    if (!isInRoom && queueRef.current && queueRef.current.length > 0) {
      try {
        const seenKey = "goatfc_recent_pairs_" + diff;
        const seen = JSON.parse(localStorage.getItem(seenKey) || "[]");
        // Les paires vues = toutes celles du début jusqu'à qIdx (qIdxRef peut pas exister, on prend tout ce qui est avant)
        const seenThisRound = queueRef.current.slice(0, Math.min(queueRef.current.length, 30))
          .map(item => item.c1 + "|||" + item.c2);
        // Garder uniquement les ~60 paires récentes (2 parties de 30)
        const merged = [...seenThisRound, ...seen].slice(0, 60);
        localStorage.setItem(seenKey, JSON.stringify([...new Set(merged)]));
      } catch(e) {}
    }
    
    setRoundScores(prev=>{
      const next=[...prev,rs];
      if(currentRound>=totalRounds){
        const total=next.reduce((a,b)=>a+b,0);
        try{
          const prev2=record;
          if(!prev2||total>prev2.score){
            const rec={score:total,date:new Date().toLocaleDateString("fr-FR"),name:playerName};
            localStorage.setItem("bb_record",JSON.stringify(rec));
            setRecord(rec); setIsNewRecord(true); setShowConfetti(true); setTimeout(()=>setShowConfetti(false),4000);
          }
        }catch{}
        submitToLeaderboard(playerName,total,"pont",diff);
        addXp(total); // XP cumulé +score de la partie
        updateDayStreak();
        // Bot online : on génère son score juste avant l'écran final
        if (botOpponentRef.current && botScoreRef.current === null) {
          botScoreRef.current = generateBotScore(total);
        }
        if(activeDuelRef.current&&activeDuelRef.current.isRoom){setScreen("waitingRoom");submitRoomScore(total);}else if(activeDuel){submitDuelScore(total); setScreen("final");}else{setScreen("final");}
      } else {
        // Manche intermédiaire — envoyer score partiel et afficher classement
        setRoomRoundSnapshot(null); // reset le temps de fetch
        if(activeDuelRef.current&&activeDuelRef.current.isRoom) pushRoundScore(rs);
        setScreen("roundEnd");
      }
      return next;
    });
  }

  function endChain() {
    clearInterval(timerRef.current);
    const sc = chainScoreRef.current;
    try{
      const prev=chainRecord;
      if(sc>0&&(!prev||sc>prev.score)){
        const rec={score:sc,date:new Date().toLocaleDateString("fr-FR"),name:playerName};
        localStorage.setItem("bb_chain_record",JSON.stringify(rec));
        setChainRecord(rec); setIsNewRecord(true); setShowConfetti(true); setTimeout(()=>setShowConfetti(false),4000);
      }else{setIsNewRecord(false);}
    }catch{}
    submitToLeaderboard(playerName,sc,"chaine",diff);
    addXp(sc); // XP cumulé +score de la partie mercato
    updateDayStreak();
    // Bot online : on génère son score juste avant l'écran final
    if (botOpponentRef.current && botScoreRef.current === null) {
      botScoreRef.current = generateBotScore(sc);
    }
    if(activeDuelRef.current&&activeDuelRef.current.isRoom){setScreen("waitingRoom");submitRoomScore(sc);}else if(activeDuel){submitDuelScore(sc); setScreen("chainEnd");}else{setScreen("chainEnd");}
  }

  function startRound(round, diffOverride) {
    roundStartTime.current = null; // timer will set on next tick
    // Si manche 1, on reset le tracker des paires jouées (nouvelle partie)
    if (round === 1) {
      playedPairsRef.current = new Set();
      botScoreRef.current = null; // nouveau bot score à recalculer en fin de partie
    }
    // FIX multi : lire diff depuis activeDuelRef si en room (évite le stale state React)
    // Si la landing passe une diff via URL (autostart), elle override le state
    // closure (qui est encore "facile" au premier render).
    const isInRoom = activeDuelRef.current && activeDuelRef.current.isRoom;
    const effectiveDiff = isInRoom && activeDuelRef.current.diff
      ? activeDuelRef.current.diff
      : (diffOverride || diff);
    
    // CRESCENDO MODE (anciennement "expert") : construire une queue progressive facile→moyen→expert
    // Sinon (facile/moyen) : pool unique de la difficulté choisie
    const isCrescendo = effectiveDiff === "expert";
    let dbPool;
    if (isCrescendo) {
      // Mix progressif : 1/3 facile + 1/3 moyen + 1/3 expert
      const easyPool = DB["facile"] || [];
      const medPool = DB["moyen"] || [];
      const hardPool = DB["expert"] || [];
      if (easyPool.length === 0 || medPool.length === 0 || hardPool.length === 0) {
        // Fallback si un pool est vide : utiliser tous ceux dispos
        dbPool = [...easyPool, ...medPool, ...hardPool];
      } else {
        dbPool = null; // Marqueur : on construira la queue spécifiquement
      }
    } else {
      dbPool = DB[effectiveDiff] || DB["facile"] || [];
      if (dbPool.length === 0) { console.error("DB empty for diff:", effectiveDiff); return; }
    }
    
    // Seeded shuffle in multiplayer room for fair questions across all players
    const roomSeed = isInRoom ? hashStringToSeed(String(activeDuelRef.current.id) + "_r" + round) : null;
    const doShuffle = isInRoom ? (arr) => seededShuffle(arr, roomSeed) : shuffle;
    
    let q;
    if (isCrescendo && dbPool === null) {
      // CRESCENDO : construire la queue palier par palier
      const easyShuffled = doShuffle([...DB["facile"]]).slice(0, 10);
      const medShuffled = doShuffle([...DB["moyen"]]).slice(0, 10);
      const hardShuffled = doShuffle([...DB["expert"]]).slice(0, 10);
      // Pour chaque palier, prioriser les joueurs current (80/20)
      const buildPalier = (pool, target) => {
        const cur = pool.filter(x => x.isCurrent);
        const ret = pool.filter(x => !x.isCurrent);
        return [
          ...doShuffle([...cur]).slice(0, Math.round(target*0.8)),
          ...doShuffle([...ret]).slice(0, Math.round(target*0.2)),
        ].slice(0, target);
      };
      // On garde l'ordre crescendo : facile d'abord, moyen ensuite, expert à la fin
      q = [
        ...buildPalier(DB["facile"]||[], 10),
        ...buildPalier(DB["moyen"]||[], 10),
        ...buildPalier(DB["expert"]||[], 10),
      ];
      // Si on n'a pas assez (pool trop petit), compléter avec ce qu'on a
      if (q.length < 30) {
        const remaining = doShuffle([...(DB["expert"]||DB["moyen"]||DB["facile"])]).filter(x => !q.includes(x));
        q = [...q, ...remaining].slice(0, 30);
      }
    } else {
      // MODE NORMAL (facile/moyen) : ancien comportement
      const currentQ = dbPool.filter(qq => qq.isCurrent);
      const retiredQ = dbPool.filter(qq => !qq.isCurrent);
      const targetCurrent = Math.round(dbPool.length * 0.8);
      const targetRetired = dbPool.length - targetCurrent;
      const picked = [
        ...doShuffle([...currentQ]).slice(0, Math.max(targetCurrent, currentQ.length)),
        ...doShuffle([...retiredQ]).slice(0, Math.min(targetRetired, retiredQ.length)),
      ];
      q = doShuffle(picked.length > 0 ? picked : [...dbPool]);
    }

    // Anti-répétition INTRA-PARTIE : exclure les paires déjà jouées dans les manches précédentes
    // (sinon en partie de 2 manches on peut retomber sur les mêmes paires)
    if (round > 1 && playedPairsRef.current.size > 0) {
      const fresh = q.filter(item => !playedPairsRef.current.has(item.c1 + "|||" + item.c2));
      const stale = q.filter(item => playedPairsRef.current.has(item.c1 + "|||" + item.c2));
      // Si on a assez de paires fraîches (>20), on exclut totalement les paires jouées
      if (fresh.length >= 20) {
        q = fresh;
      } else {
        // Sinon on met les paires jouées en fin de queue (au cas où on en a besoin)
        q = [...fresh, ...stale];
      }
    }
    
    // Anti-répétition en SOLO uniquement : évite de reposer les paires des 2 dernières parties en premier
    // ⚠️ DÉSACTIVÉ EN MODE CRESCENDO car ça casserait l'ordre progressif facile→moyen→expert
    if (!isInRoom && !isCrescendo) {
      try {
        const recent = JSON.parse(localStorage.getItem("goatfc_recent_pairs_" + effectiveDiff) || "[]");
        const recentSet = new Set(recent);
        if (recentSet.size > 0) {
          const fresh = q.filter(item => !recentSet.has(item.c1 + "|||" + item.c2));
          const stale = q.filter(item => recentSet.has(item.c1 + "|||" + item.c2));
          // Si on a assez de paires fraîches, on ne met les stales qu'à la fin
          if (fresh.length >= 30) {
            q = [...fresh, ...stale];
          }
          // Sinon tant pis, on garde l'ordre random (pool trop petit)
        }
      } catch(e) {}
    }
    
    queueRef.current = q;
    setQueue(q); setQIdx(0); setScore(0); scoreRef.current=0; setRoundAnswers([]);
    setTimeLeft(ROUND_DURATION); setGuess(""); setFlash(null); setFeedback(null);
    // Toujours générer 4 options (boutons cliquables) pour toutes les difficultés
    // Pool des distracteurs : mix des 3 difficultés pour garantir des distracteurs variés et pertinents
    const allPairsForOpts = [...(DB["facile"]||[]), ...(DB["moyen"]||[]), ...(DB["expert"]||[])];
    const optSeed = isInRoom ? hashStringToSeed(String(activeDuelRef.current.id) + "_opt_" + (q[0].p.join("|"))) : null;
    setOptions(generateOptions(q[0].p, allPairsForOpts, optSeed, effectiveDiff));
    setCurrentRound(round); setAnimKey(0); setScreen("game");
    setTimeout(()=>inputRef.current?.focus(),200);
  }

  function startChain(diffOverride) {
    trackPlay("chaine", !!activeDuelRef.current); // en ligne si duel/salon actif
    roundStartTime.current = null;
    botScoreRef.current = null;
    setIsNewRecord(false); setMyLastPts(null); setCombo(0); setMaxCombo(0); comboRef.current=0; lastAnswerTime.current=Date.now();
    // Seeded random in multiplayer room for fair starting player across all players
    // diffOverride permet à la landing autostart d'utiliser sa diff sans race React.
    const isInRoom = activeDuelRef.current && activeDuelRef.current.isRoom;
    const effectiveDiff = isInRoom && activeDuelRef.current.diff
      ? activeDuelRef.current.diff
      : (diffOverride || diff);
    const roomSeed = isInRoom ? hashStringToSeed(String(activeDuelRef.current.id) + "_chain") : null;
    const rand = isInRoom ? seededRandom(roomSeed) : Math.random;
    // CRESCENDO MODE : le starter (lien 0) doit toujours être un joueur FACILE pour amorcer la chaîne en douceur
    // Le pool s'étendra ensuite progressivement avec chainCount (voir handleChainSubmit/handleChainPass)
    const isCrescendo = effectiveDiff === "expert";
    const starterDiff = isCrescendo ? "facile" : effectiveDiff;
    // Filtrer par difficulté — en facile on commence par des stars connues
    const eligible = PLAYERS_CLEAN.filter(p => {
      if (p.clubs.length < 2) return false;
      if (starterDiff === "facile") return p.diff === "facile";
      if (starterDiff === "moyen") return p.diff === "facile" || p.diff === "moyen";
      return true; // expert pur (au cas où, mais Crescendo n'arrive jamais ici car starterDiff='facile')
    });
    // En mode facile (et Crescendo qui démarre facile), le joueur de départ doit avoir AU MOINS 2 clubs populaires
    // (sinon dès qu'un est utilisé la chaîne devient impossible à deviner)
    const eligibleFacile = starterDiff === "facile"
      ? eligible.filter(p => famousClubCount(p) >= 2)
      : eligible;
    const pool = eligibleFacile.length > 0 ? eligibleFacile : (eligible.length > 0 ? eligible : PLAYERS_CLEAN.filter(p => p.clubs.length >= 2));
    // 80% chance to start with a current player
    const currentPool = pool.filter(p => !isRetiredPlayer(p.name));
    const retiredPool = pool.filter(p => isRetiredPlayer(p.name));
    const useCurrentStart = rand() < 0.8 && currentPool.length > 0;
    let startPool = useCurrentStart ? currentPool : (retiredPool.length > 0 ? retiredPool : pool);
    
    // Anti-répétition solo : exclure les starters des 3 dernières parties si on a assez de pool
    if (!isInRoom) {
      try {
        const recent = JSON.parse(localStorage.getItem("goatfc_recent_mercato_starters_" + effectiveDiff) || "[]");
        const recentSet = new Set(recent);
        if (recentSet.size > 0) {
          const fresh = startPool.filter(p => !recentSet.has(p.name));
          // Seulement si on a encore assez de joueurs frais (> 20% du pool)
          if (fresh.length >= Math.max(10, startPool.length * 0.2)) {
            startPool = fresh;
          }
        }
      } catch(e) {}
    }

    const start = startPool[Math.floor(rand() * startPool.length)];

    // Sauvegarder le starter pour anti-répétition (solo hors défi du jour)
    if (!isInRoom) {
      try {
        const key = "goatfc_recent_mercato_starters_" + effectiveDiff;
        const recent = JSON.parse(localStorage.getItem(key) || "[]");
        const updated = [start.name, ...recent.filter(n => n !== start.name)].slice(0, 5);
        localStorage.setItem(key, JSON.stringify(updated));
      } catch(e) {}
    }
    
    const usedP = new Set([start.name]);
    
    setChainPlayer(start.name); setChainUsedClubs(new Set()); setChainUsedPlayers(usedP);
    setChainCount(0); chainCountRef.current=0; setChainScore(0); chainScoreRef.current=0;
    setChainMilestone(null); if(chainMsToRef.current) clearTimeout(chainMsToRef.current);
    setChainLastClub(""); setChainLastPassed(false); setChainHistory([]); setGuess(""); setFlash(null); setFeedback(null); setChainLastRejected(null);
    setTimeLeft(CHAIN_DURATION); setScore(0); scoreRef.current=0;
    setMyLbRank(null); setScreen("chainGame");
    setTimeout(()=>inputRef.current?.focus(),200);
  }

  function startCompetition() {
    trackPlay("pont", !!activeDuelRef.current); // en ligne si duel/salon actif
    setCombo(0); setMaxCombo(0); comboRef.current=0; lastAnswerTime.current=Date.now();
    setRoundScores([]); setCurrentRound(1); setIsNewRecord(false); setMyLbRank(null); setMyLastPts(null);
    startRound(1);
  }

  // Helper : date au format YYYY-MM-DD en timezone Europe/Paris
  function todayParis() {
    const d = new Date();
    const paris = new Date(d.toLocaleString('en-US',{timeZone:'Europe/Paris'}));
    return paris.getFullYear()+'-'+String(paris.getMonth()+1).padStart(2,'0')+'-'+String(paris.getDate()).padStart(2,'0');
  }
  function yesterdayParis() {
    const d = new Date();
    const paris = new Date(d.toLocaleString('en-US',{timeZone:'Europe/Paris'}));
    paris.setDate(paris.getDate() - 1);
    return paris.getFullYear()+'-'+String(paris.getMonth()+1).padStart(2,'0')+'-'+String(paris.getDate()).padStart(2,'0');
  }
  // Helper : nombre de jours entre 2 dates YYYY-MM-DD
  function daysBetween(d1, d2) {
    const a = new Date(d1+'T00:00:00');
    const b = new Date(d2+'T00:00:00');
    return Math.round((b - a) / 86400000);
  }

  async function updateDayStreak() {
    try {
      const today = todayParis();
      const yesterday = yesterdayParis();
      const s = JSON.parse(localStorage.getItem("bb_day_streak")||"{}");

      // Déjà compté aujourd'hui : on ne fait rien mais on met à jour l'UI au cas où
      if (s.lastDate === today) {
        setDayStreak(s.count||0);
        setStreakBest(s.best||s.count||0);
        setStreakFreezes(s.freezes||0);
        return;
      }

      let newCount, newFreezes = s.freezes || 0, usedFreeze = false;

      if (!s.lastDate) {
        // Premier jour de streak
        newCount = 1;
      } else if (s.lastDate === yesterday) {
        // Continuité normale : +1 jour
        newCount = (s.count || 0) + 1;
      } else {
        // Un ou plusieurs jours sautés. On vérifie les freezes.
        const gap = daysBetween(s.lastDate, today);
        if (gap === 2 && newFreezes > 0) {
          // 1 jour raté, on utilise 1 freeze, streak continue
          newCount = (s.count || 0) + 1;
          newFreezes -= 1;
          usedFreeze = true;
        } else {
          // Trop de jours ratés ou pas de freeze → reset
          newCount = 1;
        }
      }

      // Un freeze gagné tous les 7 jours de streak (max 3 en stock)
      if (newCount > 0 && newCount % 7 === 0 && newFreezes < 3) {
        newFreezes += 1;
      }

      const newBest = Math.max(s.best || 0, newCount);
      const updated = { count: newCount, lastDate: today, best: newBest, freezes: newFreezes };
      localStorage.setItem("bb_day_streak", JSON.stringify(updated));

      // Détecter si c'est une augmentation pour déclencher l'animation
      const wasIncrement = newCount > (s.count || 0);
      setDayStreak(newCount);
      setStreakBest(newBest);
      setStreakFreezes(newFreezes);
      if (wasIncrement && newCount > 1) {
        setStreakJustIncreased(true);
        if (usedFreeze) setStreakUsedFreeze(true);
        setTimeout(() => { setStreakJustIncreased(false); setStreakUsedFreeze(false); }, 4000);
      }

      // Sync Supabase (fire-and-forget, ne bloque pas)
      if (playerId && pseudoConfirmed) {
        try {
          await sbFetch("bb_pseudos?player_id=eq." + playerId, {
            method: "PATCH",
            headers: { "Content-Type":"application/json", "Prefer":"return=minimal" },
            body: JSON.stringify({
              streak_count: newCount,
              streak_last_date: today,
              streak_best: newBest,
              streak_freezes: newFreezes
            })
          });
        } catch(e) { /* silencieux */ }
      }
    } catch(e){}
  }

  // Construit un message de partage style Wordle pour le défi du jour
  function buildDailyShare() {
    if (!dailyPlayer) return { text:"", url:"https://goatfc.fr" };
    const theme = getTodayTheme();
    // Jour court en FR/EN
    const dayShortFr = ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];
    const dayShortEn = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const dayShortDe = ["So","Mo","Di","Mi","Do","Fr","Sa"];
    const dayShortIt = ["Dom","Lun","Mar","Mer","Gio","Ven","Sab"];
    const dayShortPt = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
    const d = new Date();
    const paris = new Date(d.toLocaleString('en-US',{timeZone:'Europe/Paris'}));
    const dayShort = (lang==="de"?dayShortDe:lang==="it"?dayShortIt:lang==="pt"?dayShortPt:lang==="en"?dayShortEn:dayShortFr)[paris.getDay()];
    // Label ligue compact
    const themeLabel = theme.id==="L1"?"L1":theme.id==="PL"?"PL":theme.id==="LIGA"?"LIGA":theme.id==="SERIEA"?"Serie A":theme.id==="BUNDESLIGA"?"Buli":theme.id==="LEGEND"?(tr("Légende","Legend","Legende","Leggenda","Lenda")):"Joker";

    // Tentatives façon Wordle : ⬛ pour tentatives ratées, 🟩 pour la bonne
    const tries = dailyTries;
    const maxTries = 5;
    const squares = [];
    for (let i=0; i<tries-1; i++) squares.push("⬛");
    squares.push("🟩");
    while (squares.length < Math.min(tries, maxTries)) squares.push("⬛");

    // Points gagnés
    const pd = dailyPlayer.diff || "moyen";
    const earnedPoints = tries === 1 ? (pd==="expert"?50:pd==="moyen"?35:20) : (pd==="expert"?30:pd==="moyen"?20:10);

    // Emojis "mystère" pour les clubs (sans les révéler) - cases colorées random par club
    const clubEmojis = ["🔴","🔵","🟡","🟢","🟣","🟠","⚫","⚪","🟤"];
    const clubsDisplay = dailyPlayer.clubs.slice(0,3).map((c, i) => {
      // Choix déterministe basé sur le hash du nom du club
      let h = 0;
      for (let j=0; j<c.length; j++) h = ((h<<5)-h) + c.charCodeAt(j);
      return clubEmojis[Math.abs(h) % clubEmojis.length].repeat(3);
    }).join(" × ");

    const title = `🐐 GOAT FC · ${dayShort} ${theme.flag} ${themeLabel}`;
    const scoreLine = `⚡ ${tries}/${maxTries} ${tr("essais","tries","Versuche","tentativi","tentativas")} · +${earnedPoints} pts`;
    const cta = tr("Peux-tu faire mieux ? 👇","Can you do better? 👇","Kannst du es besser? 👇","Sai fare meglio? 👇","Consegue fazer melhor? 👇");
    const url = "https://goatfc.fr";
    const text = `${title}\n${scoreLine}\n\n${clubsDisplay}\n\n${squares.join("")}\n\n${cta}\n${url}`;
    return { text, url, title };
  }

  // Helper pour sauvegarder l'état des indices du défi du jour dans localStorage
  // Permet de retrouver position, nationalité et nombre d'essais quand on ferme et rouvre le défi
  function saveDailyHintState(level, data, used, tries) {
    try {
      const today = (()=>{ const d=new Date(); const paris=new Date(d.toLocaleString('en-US',{timeZone:'Europe/Paris'})); return paris.getFullYear()+'-'+String(paris.getMonth()+1).padStart(2,'0')+'-'+String(paris.getDate()).padStart(2,'0'); })();
      localStorage.setItem("bb_daily_hint", JSON.stringify({
        date: today,
        level: level,
        data: { position: data.position || null, nationality: data.nationality || null },
        used: used,
        tries: tries
      }));
    } catch {}
  }
  // Efface l'état des indices (appelé quand le défi est fini ou abandonné ou révélé)
  function clearDailyHintState() {
    try { localStorage.removeItem("bb_daily_hint"); } catch {}
  }

  // Révèle la réponse sans pénalité ni récompense. 0 point gagné, pas de streak, pas d'abandon non plus.
  function handleRevealDaily() {
    if (!dailyPlayer) return;
    const today = (()=>{ const d=new Date(); const paris=new Date(d.toLocaleString('en-US',{timeZone:'Europe/Paris'})); return paris.getFullYear()+'-'+String(paris.getMonth()+1).padStart(2,'0')+'-'+String(paris.getDate()).padStart(2,'0'); })();
    try {
      localStorage.setItem("bb_daily_result", JSON.stringify({date:today, abandoned:false, revealed:true, tries:dailyTries, points:0}));
      localStorage.setItem("bb_daily_tries", String(dailyTries));
      localStorage.setItem("bb_daily_points", "0");
    } catch{}
    setDailyDone(true);
    setDailyRevealed(true);
    setDailyAbandoned(false);
    setShowRevealConfirm(false);
    // Ne PAS fermer le jeu : l'utilisateur veut voir la réponse !
    // setShowDailyGame reste true, le rendu va afficher la réponse
    // (l'utilisateur ferme manuellement avec la croix comme en cas de victoire)
    setDailyFlash(null);
    setDailySuccess(false);
    setDailyHintLevel(0);
    setDailyUsedHint(false);
    setDailyHintData({ position: null, nationality: null, loading: false });
    clearDailyHintState();
    // Pas d'updateDayStreak() : révéler la réponse ne maintient pas la streak
  }

  function handleDailySubmit(forcedValue) {
    const rawValue = forcedValue !== undefined ? forcedValue : dailyGuess;
    if (!rawValue.trim() || !dailyPlayer) return;
    const normalize = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
    const guess = normalize(rawValue);
    const answer = normalize(dailyPlayer.name);
    const newTries = dailyTries + 1;
    setDailyTries(newTries);
    // Sauvegarde le compteur d'essais pour persister entre fermeture/ouverture
    saveDailyHintState(dailyHintLevel, dailyHintData, dailyUsedHint, newTries);
    const answerParts = answer.split(" ");
    const isCorrect = guess === answer
      || answerParts.some(function(p){ return p.length >= 3 && guess === p; })
      || (answer.includes(guess) && guess.length > 4)
      || (rawValue.trim().length >= 4 && fuzzyMatch(rawValue, dailyPlayer.name));
    if (isCorrect) {
      setDailySuccess(true);
      setDailyFlash("ok");
      // Calculate points: 50 expert / 35 moyen / 20 facile direct, 10 with hint
      const pd = dailyPlayer.diff || "moyen";
      const earnedPoints = dailyUsedHint ? 10 : (pd==="expert"?50:pd==="moyen"?35:20);
      const today = (()=>{ const d=new Date(); const paris=new Date(d.toLocaleString('en-US',{timeZone:'Europe/Paris'})); return paris.getFullYear()+'-'+String(paris.getMonth()+1).padStart(2,'0')+'-'+String(paris.getDate()).padStart(2,'0'); })();
      try {
        localStorage.setItem("bb_daily_result", JSON.stringify({date:today, abandoned:false, tries:newTries, points:earnedPoints}));
        localStorage.setItem("bb_daily_tries", String(newTries));
        localStorage.setItem("bb_daily_points", String(earnedPoints));
      } catch{}
      // Le défi est terminé → on peut clear l'état des indices pour aujourd'hui
      clearDailyHintState();
      // On marque comme terminé tout de suite pour que la home affiche l'état "Trouvé"
      // mais on laisse l'écran de victoire ouvert : l'utilisateur le ferme manuellement avec la croix
      setDailyDone(true);
      setDailyAbandoned(false);
      updateDayStreak();
    } else {
      setDailyFlash("ko");
      setTimeout(function(){ setDailyFlash(null); setDailyGuess(""); }, 800);
    }
  }

  async function fetchHint() {
    if (!dailyPlayer) return;
    if (dailyHintLevel === 0) {
      // First hint: position
      setDailyHintData(d => ({ ...d, loading: true }));
      setDailyUsedHint(true);
      try {
        const url = "https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(dailyPlayer.name.replace(/ /g, "_"));
        const res = await fetch(url);
        const data = await res.json();
        const extract = data.extract || "";
        // Try to extract position from first paragraph
        let position = null;
        const positionMatches = extract.match(/\b(goalkeeper|defender|midfielder|forward|striker|winger|centre-back|full-back|left-back|right-back|attacking midfielder|defensive midfielder|centre forward|central midfielder)\b/i);
        if (positionMatches) {
          const posMapFR = { "goalkeeper":"Gardien", "defender":"Défenseur", "midfielder":"Milieu", "forward":"Attaquant", "striker":"Attaquant", "winger":"Ailier", "centre-back":"Défenseur central", "full-back":"Arrière latéral", "left-back":"Arrière gauche", "right-back":"Arrière droit", "attacking midfielder":"Milieu offensif", "defensive midfielder":"Milieu défensif", "centre forward":"Avant-centre", "central midfielder":"Milieu central" };
          const posMapEN = { "goalkeeper":"Goalkeeper", "defender":"Defender", "midfielder":"Midfielder", "forward":"Forward", "striker":"Striker", "winger":"Winger", "centre-back":"Centre-back", "full-back":"Full-back", "left-back":"Left-back", "right-back":"Right-back", "attacking midfielder":"Attacking midfielder", "defensive midfielder":"Defensive midfielder", "centre forward":"Centre forward", "central midfielder":"Central midfielder" };
          const posMapDE = { "goalkeeper":"Torwart", "defender":"Verteidiger", "midfielder":"Mittelfeld", "forward":"Stürmer", "striker":"Stürmer", "winger":"Flügelspieler", "centre-back":"Innenverteidiger", "full-back":"Außenverteidiger", "left-back":"Linksverteidiger", "right-back":"Rechtsverteidiger", "attacking midfielder":"Offensives Mittelfeld", "defensive midfielder":"Defensives Mittelfeld", "centre forward":"Mittelstürmer", "central midfielder":"Zentrales Mittelfeld" };
          const posMapIT = { "goalkeeper":"Portiere", "defender":"Difensore", "midfielder":"Centrocampista", "forward":"Attaccante", "striker":"Attaccante", "winger":"Ala", "centre-back":"Difensore centrale", "full-back":"Terzino", "left-back":"Terzino sinistro", "right-back":"Terzino destro", "attacking midfielder":"Trequartista", "defensive midfielder":"Mediano", "centre forward":"Centravanti", "central midfielder":"Centrocampista centrale" };
          const posMapPT = { "goalkeeper":"Goleiro", "defender":"Zagueiro", "midfielder":"Meio-campista", "forward":"Atacante", "striker":"Atacante", "winger":"Ponta", "centre-back":"Zagueiro central", "full-back":"Lateral", "left-back":"Lateral-esquerdo", "right-back":"Lateral-direito", "attacking midfielder":"Meia-atacante", "defensive midfielder":"Volante", "centre forward":"Centroavante", "central midfielder":"Meio-campo central" };
          const posMap = lang==="de"?posMapDE:lang==="it"?posMapIT:lang==="pt"?posMapPT:lang==="en"?posMapEN:posMapFR;
          position = posMap[positionMatches[1].toLowerCase()] || positionMatches[1];
        }
        setDailyHintData({ position: position || (tr("Information indisponible","Information unavailable","Information nicht verfügbar","Informazione non disponibile","Informação indisponível")), nationality: null, loading: false });
        setDailyHintLevel(1);
        saveDailyHintState(1, { position: position || (tr("Information indisponible","Information unavailable","Information nicht verfügbar","Informazione non disponibile","Informação indisponível")), nationality: null }, true, dailyTries);
      } catch(e) {
        setDailyHintData({ position: (tr("Information indisponible","Information unavailable","Information nicht verfügbar","Informazione non disponibile","Informação indisponível")), nationality: null, loading: false });
        setDailyHintLevel(1);
        saveDailyHintState(1, { position: (tr("Information indisponible","Information unavailable","Information nicht verfügbar","Informazione non disponibile","Informação indisponível")), nationality: null }, true, dailyTries);
      }
    } else if (dailyHintLevel === 1) {
      // Second hint: nationality
      setDailyHintData(d => ({ ...d, loading: true }));
      try {
        const url = "https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(dailyPlayer.name.replace(/ /g, "_"));
        const res = await fetch(url);
        const data = await res.json();
        const extract = data.extract || "";
        // Try to extract nationality
        // Regex principal : capture la nationalité avant "footballer/soccer player"
        // On accepte un ou plusieurs mots-clés intermédiaires (former, retired, professional, youth...)
        const natMatch = extract.match(/\b(?:is|was)\s+(?:a|an)\s+([A-Z][a-z]+(?:-[A-Z][a-z]+)?)\s+(?:(?:former|retired|professional|youth|international|semi-professional|promising|young|talented|veteran|experienced)\s+)*(?:footballer|soccer player|footballeur)/i);
        let nationality = natMatch ? natMatch[1] : null;
        // Mots à ne JAMAIS considérer comme une nationalité (faux positifs courants)
        const NAT_BLACKLIST = ["professional","former","retired","youth","young","promising","talented","veteran","experienced","international","semi","the","football","soccer","club","team","national"];
        if (nationality && NAT_BLACKLIST.includes(nationality.toLowerCase())) nationality = null;
        if (!nationality) {
          const altMatch = extract.match(/\b([A-Z][a-z]+)\s+footballer/i);
          nationality = altMatch ? altMatch[1] : null;
          if (nationality && NAT_BLACKLIST.includes(nationality.toLowerCase())) nationality = null;
        }
        // Traduction EN→FR des nationalités si lang=fr
        if (nationality && lang === "fr") {
          const natMapFR = {
            "french":"Français","english":"Anglais","british":"Britannique","german":"Allemand","italian":"Italien",
            "spanish":"Espagnol","portuguese":"Portugais","brazilian":"Brésilien","argentine":"Argentin","argentinian":"Argentin",
            "belgian":"Belge","dutch":"Néerlandais","swiss":"Suisse","austrian":"Autrichien","polish":"Polonais",
            "russian":"Russe","ukrainian":"Ukrainien","czech":"Tchèque","slovak":"Slovaque","croatian":"Croate",
            "serbian":"Serbe","bosnian":"Bosniaque","slovenian":"Slovène","hungarian":"Hongrois","romanian":"Roumain",
            "bulgarian":"Bulgare","greek":"Grec","turkish":"Turc","danish":"Danois","swedish":"Suédois",
            "norwegian":"Norvégien","finnish":"Finlandais","icelandic":"Islandais","irish":"Irlandais","scottish":"Écossais",
            "welsh":"Gallois","american":"Américain","canadian":"Canadien","mexican":"Mexicain","colombian":"Colombien",
            "uruguayan":"Uruguayen","chilean":"Chilien","peruvian":"Péruvien","venezuelan":"Vénézuélien","ecuadorian":"Équatorien",
            "paraguayan":"Paraguayen","bolivian":"Bolivien","japanese":"Japonais","korean":"Coréen","chinese":"Chinois",
            "australian":"Australien","egyptian":"Égyptien","moroccan":"Marocain","algerian":"Algérien","tunisian":"Tunisien",
            "senegalese":"Sénégalais","ivorian":"Ivoirien","nigerian":"Nigérian","ghanaian":"Ghanéen","cameroonian":"Camerounais",
            "malian":"Malien","guinean":"Guinéen","gabonese":"Gabonais","liberian":"Libérien","kenyan":"Kényan",
            "ethiopian":"Éthiopien","angolan":"Angolais","mozambican":"Mozambicain","israeli":"Israélien","iranian":"Iranien",
            "iraqi":"Irakien","saudi":"Saoudien","qatari":"Qatari","emirati":"Émirati","lebanese":"Libanais",
            "palestinian":"Palestinien","syrian":"Syrien","jordanian":"Jordanien","pakistani":"Pakistanais","indian":"Indien",
            "indonesian":"Indonésien","thai":"Thaïlandais","vietnamese":"Vietnamien","filipino":"Philippin","malaysian":"Malaisien",
            "albanian":"Albanais","montenegrin":"Monténégrin","macedonian":"Macédonien","kosovar":"Kosovar","armenian":"Arménien",
            "georgian":"Géorgien","azerbaijani":"Azerbaïdjanais","uzbek":"Ouzbek","kazakh":"Kazakh","jamaican":"Jamaïcain",
            "cypriot":"Chypriote","maltese":"Maltais","luxembourgish":"Luxembourgeois"
          };
          // Gère les nationalités à trait d'union (ex: "French-Moroccan")
          nationality = nationality.split("-").map(n => natMapFR[n.toLowerCase()] || n).join("-");
        }
        if (!nationality) {
          nationality = (tr("Information indisponible","Information unavailable","Information nicht verfügbar","Informazione non disponibile","Informação indisponível"));
        }
        setDailyHintData(d => ({ ...d, nationality, loading: false }));
        setDailyHintLevel(2);
        saveDailyHintState(2, { position: dailyHintData.position, nationality: nationality }, true, dailyTries);
      } catch(e) {
        const unavailable = (tr("Information indisponible","Information unavailable","Information nicht verfügbar","Informazione non disponibile","Informação indisponível"));
        setDailyHintData(d => ({ ...d, nationality: unavailable, loading: false }));
        setDailyHintLevel(2);
        saveDailyHintState(2, { position: dailyHintData.position, nationality: unavailable }, true, dailyTries);
      }
    }
  }

  function nextQ() {
    // Enregistrer la paire que l'on vient de quitter (pour anti-répétition entre manches)
    const justPlayed = queue[qIdx % Math.max(queue.length, 1)];
    if (justPlayed) playedPairsRef.current.add(justPlayed.c1 + "|||" + justPlayed.c2);
    setQIdx(i=>{
      const next = i+1;
      const isInRoom = activeDuelRef.current && activeDuelRef.current.isRoom;
      const effectiveDiff = isInRoom && activeDuelRef.current.diff ? activeDuelRef.current.diff : diff;
      // Pool des distracteurs : mix des 3 difficultés pour garantir des distracteurs variés et pertinents
      const allPairsForOpts = [...(DB["facile"]||[]), ...(DB["moyen"]||[]), ...(DB["expert"]||[])];
      // If we've gone through the whole queue, rebuild with fresh shuffle (seeded in room)
      if (next >= queue.length) {
        const reshuffleSeed = isInRoom ? hashStringToSeed(String(activeDuelRef.current.id) + "_r" + currentRound + "_reshuffle") : null;
        const fresh = reshuffleSeed !== null ? seededShuffle(DB[effectiveDiff], reshuffleSeed) : shuffle(DB[effectiveDiff]);
        setQueue(fresh);
        const optSeed = isInRoom ? hashStringToSeed(String(activeDuelRef.current.id) + "_opt_" + (fresh[0].p.join("|"))) : null;
        setOptions(generateOptions(fresh[0].p, allPairsForOpts, optSeed, effectiveDiff));
        return 0;
      }
      const optSeed = isInRoom ? hashStringToSeed(String(activeDuelRef.current.id) + "_opt_" + (queue[next].p.join("|"))) : null;
      setOptions(generateOptions(queue[next].p, allPairsForOpts, optSeed, effectiveDiff));
      return next;
    });
    setGuess(""); setFlash(null); setAnimKey(k=>k+1);
    // Plus besoin de focus l'input car maintenant tous les modes ont des boutons (pas d'input texte)
  }

  function handleSubmit() {
    const g=guess.trim(); if(!g) return;
    const cur=queue[qIdx%Math.max(queue.length,1)];
    if(checkGuess(g,cur.p)){
      setRoundAnswers(a=>[...a,{c1:cur.c1, c2:cur.c2, validPlayers:cur.p, given:g, status:"ok"}]);
      setFlash("ok"); setFeedback("ok"); handleCorrectAnswer(2);
      setTimeout(()=>{setFlash(null);setFeedback(null);nextQ();},900);
    }else{
      setRoundAnswers(a=>[...a,{c1:cur.c1, c2:cur.c2, validPlayers:cur.p, given:g, status:"ko"}]);
      setFlash("ko"); setFeedback("ko"); handleWrongAnswer(5);
      setTimeout(()=>{setFlash(null);setFeedback(null);setGuess("");inputRef.current?.focus();},900);
    }
  }

  // Affiche une onomatopée comic qui surgit en gros et repart aussitôt (quand on passe)
  function triggerSkipOno() {
    const list = ["PFOU !","BOF…","ZUT !","RATÉ !","PSCHIT !","JE SÈCHE !","OUPS !","SUIVANT !","HÉLAS !","PAF !","BOUM !","AÏE !"];
    setSkipOno(list[Math.floor(Math.random()*list.length)]);
    if (skipOnoTimerRef.current) clearTimeout(skipOnoTimerRef.current);
    skipOnoTimerRef.current = setTimeout(()=>setSkipOno(null), 850);
  }

  function handlePass() {
    triggerSkipOno();
    clearInterval(qTimerRef.current);
    const cur=queue[qIdx%Math.max(queue.length,1)];
    if(cur) setRoundAnswers(a=>[...a,{c1:cur.c1, c2:cur.c2, validPlayers:cur.p, given:null, status:"skip"}]);
    setScore(s=>{scoreRef.current=s-10;return s-10;});
    nextQ();
  }
  handlePassRef.current = handlePass;

  function handleOptionClick(opt) {
    if(flash) return;
    const cur=queue[qIdx%Math.max(queue.length,1)];
    if(checkGuess(opt,cur.p)){
      setRoundAnswers(a=>[...a,{c1:cur.c1, c2:cur.c2, validPlayers:cur.p, given:opt, status:"ok"}]);
      setFlash("ok"); setFeedback("ok"); handleCorrectAnswer(2);
      setTimeout(()=>{setFlash(null);setFeedback(null);nextQ();},900);
    }else{
      setRoundAnswers(a=>[...a,{c1:cur.c1, c2:cur.c2, validPlayers:cur.p, given:opt, status:"ko"}]);
      setFlash(opt); setFeedback("ko"); handleWrongAnswer(5);
      setTimeout(()=>{setFlash(null);setFeedback(null);},900);
    }
  }

  function handleChainSubmit(forcedValue) {
    const rawValue = forcedValue !== undefined ? forcedValue : guess;
    const g=rawValue.trim(); if(!g) return;
    const playerClubs=getPlayerClubs(chainPlayer);
    const available=playerClubs.filter(c=>!chainUsedClubs.has(c));
    const matched=matchClub(g,available);
    if(matched){
      setChainLastRejected(null);
      const newUsed=new Set(chainUsedClubs); newUsed.add(matched); setChainUsedClubs(newUsed);
      setChainHistory(prev=>[...prev,{player:chainPlayer,club:matched}]);
      const newChainCount=chainCount+1;
      setChainCount(newChainCount); chainCountRef.current=newChainCount;
      // Palier fêté tous les 10 maillons (10/20/30…)
      if(newChainCount>=10 && newChainCount%10===0){
        const meta=CHAIN_MILESTONES[newChainCount]||{emoji:"🐐",color:"#FFD700"};
        setChainMilestone({n:newChainCount,emoji:meta.emoji,color:meta.color});
        playSound("milestone"); vibrate([40,60,40,60,90]);
        if(chainMsToRef.current) clearTimeout(chainMsToRef.current);
        chainMsToRef.current=setTimeout(function(){setChainMilestone(null);},1600);
      }
      handleCorrectAnswer(2,true);
      setFeedback("ok"); setFlash("ok");
      const clubPlayers=getPlayersForClub(matched).filter(p=>!chainUsedPlayers.has(p)&&getPlayerClubs(p).some(c=>!newUsed.has(c)));
      // Favoriser les joueurs de la bonne difficulté ET les joueurs actuels (80/20)
      const isInRoomCS = activeDuelRef.current && activeDuelRef.current.isRoom;
      const rawDiffCS = isInRoomCS && activeDuelRef.current.diff ? activeDuelRef.current.diff : diff;
      // CRESCENDO : en mode "expert", la diff effective dépend du nombre de liens (chainCount + 1 = on calcule pour LE PROCHAIN joueur)
      const effectiveDiffCS = rawDiffCS === "expert" ? getCrescendoTier(chainCount + 1) : rawDiffCS;
      const submitSeed = isInRoomCS ? hashStringToSeed(String(activeDuelRef.current.id) + "_next_" + chainPlayer + "_" + matched) : null;
      const randCS = submitSeed !== null ? seededRandom(submitSeed) : Math.random;
      if(clubPlayers.length===0){
        // Chaîne bloquée après bonne réponse → on pioche un joueur frais au lieu de finir la partie
        const fallbackPool = PLAYERS_CLEAN.filter(p => {
          if (p.clubs.length < 2) return false;
          if (chainUsedPlayers.has(p.name)) return false;
          if (effectiveDiffCS === "facile") return p.diff === "facile";
          if (effectiveDiffCS === "moyen") return p.diff === "facile" || p.diff === "moyen";
          return true;
        });
        // En mode facile : au moins 2 clubs populaires
        const fallbackFacile = effectiveDiffCS === "facile"
          ? fallbackPool.filter(p => famousClubCount(p) >= 2)
          : fallbackPool;
        const pool = fallbackFacile.length > 0 ? fallbackFacile : (fallbackPool.length > 0 ? fallbackPool : PLAYERS_CLEAN.filter(p => p.clubs.length >= 2 && !chainUsedPlayers.has(p.name)));
        if(pool.length === 0){setTimeout(()=>{setFeedback(null);setFlash(null);endChain();},800);return;}
        const fallback = pool[Math.floor(randCS()*pool.length)].name;
        const newUsedP=new Set(chainUsedPlayers); newUsedP.add(fallback);
        setTimeout(()=>{setChainPlayer(fallback);setChainUsedPlayers(newUsedP);setChainLastClub(matched);setChainLastPassed(false);setGuess("");setFeedback(null);setFlash(null);setTimeout(()=>inputRef.current?.focus(),100);},700);
        return;
      }
      const preferred = effectiveDiffCS === "facile"
        ? easyChainPool(clubPlayers)
        : clubPlayers.filter(p => {
            const pd = PLAYER_BY_NAME.get(p)?.diff;
            if(effectiveDiffCS==="moyen") return pd==="facile"||pd==="moyen";
            return true;
          });
      // En mode FACILE : si le club n'a aucun joueur "facile" dispo, fallback global vers un joueur facile
      // au lieu d'élargir au pool complet du club (sinon on tombe sur des joueurs comme Mathew Ryan)
      if (preferred.length === 0 && effectiveDiffCS === "facile") {
        const globalFallback = PLAYERS_CLEAN.filter(p =>
          p.clubs.length >= 2 && !chainUsedPlayers.has(p.name) &&
          p.diff === "facile" &&
          famousClubCount(p) >= 2
        );
        if (globalFallback.length === 0) { setTimeout(()=>{setFeedback(null);setFlash(null);endChain();},800); return; }
        const fallback = globalFallback[Math.floor(randCS()*globalFallback.length)].name;
        const newUsedP = new Set(chainUsedPlayers); newUsedP.add(fallback);
        setTimeout(()=>{setChainPlayer(fallback);setChainUsedPlayers(newUsedP);setChainLastClub(matched);setChainLastPassed(false);setGuess("");setFeedback(null);setFlash(null);setTimeout(()=>inputRef.current?.focus(),100);},700);
        return;
      }
      const diffPool = preferred.length > 0 ? preferred : clubPlayers;
      // En mode facile : s'assurer qu'il reste au moins UN club populaire disponible
      // pour ce joueur (sinon le joueur tombe sur du "Birmingham" ou autre club peu connu)
      const popularPool = effectiveDiffCS === "facile"
        ? diffPool.filter(p => getPlayerClubs(p).some(c => !newUsed.has(c) && FAMOUS_CLUBS.has(c)))
        : diffPool;
      const finalPool = popularPool.length > 0 ? popularPool : diffPool;
      // 80% current players — seeded en multi pour cohérence entre joueurs qui donnent le même club
      const currentNext = finalPool.filter(p => !isRetiredPlayer(p));
      const useCurrent = randCS() < 0.8 && currentNext.length > 0;
      const nextPool = useCurrent ? currentNext : finalPool;
      const next=nextPool[Math.floor(randCS()*nextPool.length)];
      const newUsedP=new Set(chainUsedPlayers); newUsedP.add(next);
      // Prefetch logos for next player
      
      setTimeout(()=>{setChainPlayer(next);setChainUsedPlayers(newUsedP);setChainLastClub(matched);setChainLastPassed(false);setGuess("");setFeedback(null);setFlash(null);setTimeout(()=>inputRef.current?.focus(),100);},700);
    }else if(matchClub(g,playerClubs)){
      setFlash("used"); setFeedback("used"); playSound("ko");
      setTimeout(()=>{setFlash(null);setFeedback(null);setGuess("");inputRef.current?.focus();},1200);
    }else{
      // Mémorise la tentative refusée pour permettre de la signaler (club correct refusé ?)
      setChainLastRejected({player:chainPlayer, club:g}); setChainReportSent(false);
      handleWrongAnswer(5,true); setFeedback("ko"); setFlash("ko");
      setTimeout(()=>{setFlash(null);setFeedback(null);setGuess("");inputRef.current?.focus();},900);
    }
  }

  function handleChainPass() {
    if(chainPassedRef.current) return; // already passed this question
    setChainLastRejected(null);
    triggerSkipOno();
    clearInterval(qTimerRef.current);
    chainPassedRef.current = true;
    setChainScore(s=>{chainScoreRef.current=s-10;return s-10;});
    // FIX multi : en room, tous les joueurs qui passent sur le même chainPlayer doivent obtenir le même prochain joueur
    const isInRoomCP = activeDuelRef.current && activeDuelRef.current.isRoom;
    const rawDiffCP = isInRoomCP && activeDuelRef.current.diff ? activeDuelRef.current.diff : diff;
    // CRESCENDO : en mode "expert", la diff effective dépend du nombre de liens (chainCount + 1 = pour LE PROCHAIN joueur)
    const effectiveDiffCP = rawDiffCP === "expert" ? getCrescendoTier(chainCount + 1) : rawDiffCP;
    const passSeed = isInRoomCP ? hashStringToSeed(String(activeDuelRef.current.id) + "_pass_" + chainPlayer) : null;
    const randCP = passSeed !== null ? seededRandom(passSeed) : Math.random;
    const validClubs=(PLAYERS_CLEAN.find(p=>p.name===chainPlayer)?.clubs||[]).filter(c=>!chainUsedClubs.has(c));
    const chosen=validClubs.length>0?validClubs[Math.floor(randCP()*validClubs.length)]:null;
    // Le club "chosen" est révélé en bas et BRÛLÉ pour la suite de la partie : sinon c'est de la triche
    // (l'user passe pour découvrir la réponse, puis la retape au tour suivant).
    // Helper : pioche un nouveau joueur aléatoire de la base (fallback quand la chaîne bloque)
    // Au lieu de terminer la partie prématurément, on relance avec un joueur tout frais
    const pickFallbackPlayer = () => {
      const eligible = PLAYERS_CLEAN.filter(p => {
        if (p.clubs.length < 2) return false;
        if (chainUsedPlayers.has(p.name)) return false;
        if (effectiveDiffCP === "facile") return p.diff === "facile";
        if (effectiveDiffCP === "moyen") return p.diff === "facile" || p.diff === "moyen";
        return true;
      });
      // En mode facile : le fallback doit avoir au moins 2 clubs populaires
      const eligibleFacile = effectiveDiffCP === "facile"
        ? eligible.filter(p => famousClubCount(p) >= 2)
        : eligible;
      const pool = eligibleFacile.length > 0 ? eligibleFacile : (eligible.length > 0 ? eligible : PLAYERS_CLEAN.filter(p => p.clubs.length >= 2 && !chainUsedPlayers.has(p.name)));
      if (pool.length === 0) return null;
      return pool[Math.floor(randCP() * pool.length)].name;
    };
    if(!chosen){
      // Pas de club dispo → pioche nouveau joueur frais
      const fallback = pickFallbackPlayer();
      if(!fallback){endChain();return;}
      const newUsedP=new Set(chainUsedPlayers); newUsedP.add(fallback);
      setChainUsedPlayers(newUsedP);
      setChainHistory(prev=>[...prev,{player:chainPlayer,club:"—",passed:true}]);
      setChainPlayer(fallback); setChainLastClub(""); setGuess("");
      setTimeout(()=>inputRef.current?.focus(),100);
      setAnimKey(k=>k+1);
      return;
    }
    const newUsed=new Set(chainUsedClubs); // ne PAS ajouter chosen → l'user ne voit pas le club (cadenas), donc on le laisse réutilisable
    newUsed.delete(chosen); // FIX défensif : si chosen était dans chainUsedClubs pour une autre raison (cas rare), on le retire pour qu'il soit jouable au tour suivant
    setChainUsedClubs(newUsed); // Apply le retrait au state
    const clubPlayers=getPlayersForClub(chosen).filter(p=>!chainUsedPlayers.has(p)&&getPlayerClubs(p).some(c=>!newUsed.has(c)));
    if(clubPlayers.length===0){
      // Pas de joueur pour ce club → pioche nouveau joueur frais
      const fallback = pickFallbackPlayer();
      if(!fallback){endChain();return;}
      const newUsedP=new Set(chainUsedPlayers); newUsedP.add(fallback);
      setChainUsedPlayers(newUsedP);
      setChainHistory(prev=>[...prev,{player:chainPlayer,club:chosen,passed:true}]);
      setChainPlayer(fallback); setChainLastClub(chosen); setChainLastPassed(true); setGuess("");
      setTimeout(()=>inputRef.current?.focus(),100);
      setAnimKey(k=>k+1);
      return;
    }
    const preferred2 = effectiveDiffCP === "facile"
      ? easyChainPool(clubPlayers)
      : clubPlayers.filter(p => {
          const pd = PLAYER_BY_NAME.get(p)?.diff;
          if(effectiveDiffCP==="moyen") return pd==="facile"||pd==="moyen";
          return true;
        });
    // En mode FACILE : si le club n'a aucun joueur "facile" dispo, fallback global au lieu d'élargir
    if (preferred2.length === 0 && effectiveDiffCP === "facile") {
      const fallback = pickFallbackPlayer();
      if(!fallback){endChain();return;}
      const newUsedP=new Set(chainUsedPlayers); newUsedP.add(fallback);
      setChainUsedPlayers(newUsedP);
      setChainHistory(prev=>[...prev,{player:chainPlayer,club:chosen,passed:true}]);
      setChainPlayer(fallback); setChainLastClub(chosen); setChainLastPassed(true); setGuess("");
      setTimeout(()=>inputRef.current?.focus(),100);
      setAnimKey(k=>k+1);
      return;
    }
    const diffPool2 = preferred2.length > 0 ? preferred2 : clubPlayers;
    // En mode facile : s'assurer qu'il reste au moins UN club populaire disponible
    const popularPool2 = effectiveDiffCP === "facile"
      ? diffPool2.filter(p => getPlayerClubs(p).some(c => !newUsed.has(c) && FAMOUS_CLUBS.has(c)))
      : diffPool2;
    const finalPool2 = popularPool2.length > 0 ? popularPool2 : diffPool2;
    const currentNext2 = finalPool2.filter(p => !isRetiredPlayer(p));
    const useCurrent2 = randCP() < 0.8 && currentNext2.length > 0;
    const nextPool2 = useCurrent2 ? currentNext2 : finalPool2;
    const next=nextPool2[Math.floor(randCP()*nextPool2.length)];
    const newUsedP=new Set(chainUsedPlayers); newUsedP.add(next);
    setChainUsedPlayers(newUsedP);
    setChainHistory(prev=>[...prev,{player:chainPlayer,club:chosen,passed:true}]);
    setChainPlayer(next); setChainLastClub(chosen); setChainLastPassed(true); setGuess("");
    setTimeout(()=>inputRef.current?.focus(),100);
    setAnimKey(k=>k+1); // relance le timer de question pour le nouveau joueur
  }
  handleChainPassRef.current = handleChainPass;

  function requirePseudo(callback) {
    // playerName n'est hydraté depuis localStorage que dans un useEffect, donc
    // APRÈS le montage. Un appel très tôt — ouvrir un jeu depuis la landing
    // desktop, par exemple — voyait un pseudo vide et affichait l'écran de
    // création à tort, alors que le compte existe. On relit donc la source.
    let stored = "";
    try { stored = (localStorage.getItem("bb_name") || "").trim(); } catch { /* noop */ }
    const name = playerName.trim() || stored;
    if (name.length < 2) {
      setPseudoScreen(true);
      return;
    }
    callback();
  }

  // ── Matchmaking EN LIGNE (mobile) ──
  // Recherche animée, puis révélation de l'adversaire, puis lancement.
  useEffect(() => {
    if (!mmSearch || mmSearch.phase !== "searching") return;
    const t = setTimeout(function(){
      setMmSearch(function(prev){ return prev ? Object.assign({}, prev, {phase:"found"}) : prev; });
    }, 2500 + Math.floor(Math.random() * 2000));
    return function(){ clearTimeout(t); };
  }, [mmSearch]);

  useEffect(() => {
    if (!mmSearch || mmSearch.phase !== "found") return;
    const t = setTimeout(function(){
      const { mode, opponent } = mmSearch;
      setMmSearch(null);
      if (mode === "battle") ggBattleStartSimulated(opponent);
      else if (mode === "duel") duelQuickStart(opponent);
      else tryStart(mode, opponent);
    }, 2000);
    return function(){ clearTimeout(t); };
  }, [mmSearch]);

  // opponent : adversaire du mode EN LIGNE, ou null/undefined pour une partie
  // solo. On l'assigne ici plutôt qu'au clic car sur mobile LePont reste monté
  // entre deux parties : sans ce reset, l'adversaire d'une partie en ligne
  // resterait affiché à la fin des parties solo suivantes.
  function tryStart(mode, opponent) {
    botOpponentRef.current = opponent || null;
    botScoreRef.current = null;
    setGameMode(mode);
    // Marquer les instructions comme vues directement
    seenInstructions.current.add(mode);
    try{localStorage.setItem("bb_seen",JSON.stringify([...seenInstructions.current]));}catch{}
    if(mode==="chaine")startChain();
    else{setCombo(0);setMaxCombo(0);comboRef.current=0;lastAnswerTime.current=Date.now();setRoundScores([]);setCurrentRound(1);setIsNewRecord(false);setMyLbRank(null);startRound(1);}
  }

  function dismissInstructions() {
    const mode=showInstructions;
    seenInstructions.current.add(mode);
    try{localStorage.setItem("bb_seen",JSON.stringify([...seenInstructions.current]));}catch{}
    setShowInstructions(null);
    if(mode==="chaine")startChain();
    else{setCombo(0);setMaxCombo(0);comboRef.current=0;lastAnswerTime.current=Date.now();setRoundScores([]);setCurrentRound(1);setIsNewRecord(false);setMyLbRank(null);startRound(1);}
  }

  const activeQueue = queue.length > 0 ? queue : queueRef.current;
  const cur = activeQueue[qIdx % Math.max(activeQueue.length, 1)];
  const total = roundScores.length > 0 ? roundScores.reduce(function(a,b){return a+b;},0) : 0;
  const duration = gameMode === "chaine" ? CHAIN_DURATION : ROUND_DURATION;
  const tPct = timeLeft / duration;
  const urgent = timeLeft <= 10 && timeLeft > 0;
  const shell = {
    minHeight:"100vh",display:"flex",flexDirection:"column",
    background:"transparent",
    // Sur mobile : overflow hidden pour les fonds + scroll géré au cas par cas
    // Sur desktop : overflow auto pour permettre le scroll quand le contenu dépasse
    fontFamily:G.font,position:"relative",overflow:isDesktop?"auto":"hidden",
    maxWidth:isDesktop?"100%":430,marginLeft:"auto",marginRight:"auto",
    boxShadow:isDesktop?"none":"0 0 60px rgba(0,0,0,.5)",
  };
  const stripes = {position:"absolute",inset:0,zIndex:0,pointerEvents:"none",background:"radial-gradient(ellipse at 50% 0%,rgba(0,230,118,.06) 0%,transparent 70%)"};
  const sheet = {background:"rgba(0,0,0,.55)",backdropFilter:"blur(2px)",borderRadius:"32px 32px 0 0",flex:1,display:"flex",flexDirection:"column",gap:14,padding:"20px 18px 28px",zIndex:1,boxShadow:"0 -2px 40px rgba(0,0,0,.4)",border:"1px solid rgba(255,255,255,.08)",borderBottom:"none"};

  const backBtn = (onClick) => (
    <button onClick={onClick} style={{background:"rgba(255,255,255,.07)",backdropFilter:"blur(12px)",border:"1px solid rgba(255,255,255,.1)",borderRadius:14,width:40,height:40,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",zIndex:10,color:G.white,fontSize:18,fontWeight:700,flexShrink:0}}>←</button>
  );

  const timerCircle = (size=76) => {
    const r=(size/2)-5; const circ=2*Math.PI*r;
    return (
      <div style={{position:"relative",width:size,height:size,animation:urgent?"heartbeat .8s ease infinite":"none"}}>
        <svg style={{width:size,height:size,transform:"rotate(-90deg)"}} viewBox={`0 0 ${size} ${size}`}>
          <circle fill={urgent?"rgba(255,61,87,.12)":"rgba(255,255,255,.04)"} cx={size/2} cy={size/2} r={size/2}/>
          <circle fill="none" stroke="rgba(255,255,255,.15)" strokeWidth={4} cx={size/2} cy={size/2} r={r}/>
          <circle fill="none" stroke={timeLeft<=20?"#FF3D57":timeLeft<=40?"#FFD600":G.accent} strokeWidth={urgent?6:4}
            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ*(1-tPct)}
            cx={size/2} cy={size/2} r={r} style={{transition:"stroke-dashoffset .9s linear"}}/>
        </svg>
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:G.heading,fontSize:size*.3,color:urgent?"#ef4444":G.white,animation:urgent?"urgentPulse 1s ease infinite":"none"}}>{timeLeft}</div>
      </div>
    );
  };

  const scoreDisplay = (sc, anim) => (
    <span style={{fontFamily:G.heading,fontSize:34,color:G.white,display:"inline-block",animation:anim==="up"?"scoreUp .5s ease":anim==="down"?"scoreDn .5s ease":"none"}}>{sc}</span>
  );

  const comboDisplay = combo>=3?(
    <div key={combo} style={{position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",background:"linear-gradient(135deg,#f59e0b,#ef4444)",color:G.white,borderRadius:20,padding:"4px 14px",fontSize:12,fontWeight:800,letterSpacing:1,animation:"comboFire .5s ease",zIndex:20,whiteSpace:"nowrap",boxShadow:"0 4px 15px rgba(245,158,11,.4)"}}>{getComboLabel(combo)}</div>
  ):null;

  const floatingPoints = comboFloat&&(
    <div style={{position:"fixed",top:"30%",left:"50%",transform:"translateX(-50%)",fontFamily:G.heading,fontSize:28,color:G.gold,letterSpacing:2,animation:"floatUp 1.2s ease forwards",zIndex:100,textShadow:"0 2px 10px rgba(0,0,0,.3)",pointerEvents:"none"}}>{comboFloat}</div>
  );

  const CONFETTI_COLORS=["#fbbf24","#ef4444","#4ade80","#3b82f6","#a855f7","#f97316"];
  const confettiOverlay = showConfetti&&(
    <div style={{position:"fixed",inset:0,zIndex:300,pointerEvents:"none",overflow:"hidden"}}>
      {Array.from({length:40}).map((_,i)=>{
        const left=Math.random()*100,delay=Math.random()*2,dur=2+Math.random()*2,size=6+Math.random()*8;
        return <div key={i} style={{position:"absolute",top:-20,left:`${left}%`,width:size,height:size,background:CONFETTI_COLORS[i%CONFETTI_COLORS.length],borderRadius:Math.random()>.5?"50%":2,animation:`confettiFall ${dur}s ease ${delay}s forwards`}}/>;
      })}
    </div>
  );

  // ── MODAL GRADE UP : célébration quand l'user passe un palier ──
  // ── Popup « nouvelle carte » ── déclenché après une partie qui franchit un
  // palier (voir newlyUnlocked). Un seul bouton : aller la mettre en badge.
  const cardUnlockModal = cardPopup ? (() => {
    const rm = rarityMeta(cardPopup.rarity);
    return (
      <div key="cardUnlock" onClick={function(){setCardPopup(null);}} style={{position:"fixed",inset:0,zIndex:9997,background:"rgba(0,0,0,.88)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,animation:"fadeIn .25s ease"}}>
        <div onClick={function(e){e.stopPropagation();}} style={{width:"100%",maxWidth:330,background:"rgba(10,15,10,.98)",border:"2.5px solid "+rm.color,borderRadius:26,padding:"26px 22px 22px",textAlign:"center",boxShadow:"0 0 60px "+rm.glow,animation:"splashBounceIn .5s ease"}}>
          <div style={{fontSize:11,letterSpacing:3,fontWeight:800,color:"rgba(255,255,255,.5)",marginBottom:14}}>
            {tr("🃏 NOUVELLE CARTE 🃏","🃏 NEW CARD 🃏","🃏 NEUE KARTE 🃏","🃏 NUOVA CARTA 🃏","🃏 NOVA CARTA 🃏")}
          </div>
          <img src={cardPopup.img} alt="" style={{width:"100%",aspectRatio:"3 / 4",objectFit:"cover",borderRadius:16,border:"1.5px solid "+rm.color+"88",display:"block"}}/>
          <div style={{fontFamily:G.heading,fontSize:26,color:G.white,letterSpacing:1,marginTop:14}}>{lang==="fr"?cardPopup.name:cardPopup.nameEn}</div>
          <div style={{fontSize:12,fontWeight:800,letterSpacing:1.5,color:rm.color,textTransform:"uppercase",marginTop:3}}>{lang==="fr"?rm.label:rm.labelEn}</div>
          <div style={{display:"flex",gap:10,marginTop:20}}>
            <button onClick={function(){setCardPopup(null);}} style={{flex:1,padding:"13px 0",borderRadius:13,border:"1px solid rgba(255,255,255,.14)",background:"rgba(255,255,255,.05)",color:"rgba(255,255,255,.7)",fontFamily:G.font,fontWeight:800,fontSize:13.5,cursor:"pointer"}}>
              {tr("Plus tard","Later","Später","Più tardi","Depois")}
            </button>
            <button onClick={function(){ chooseBadge(cardPopup.id); setCardPopup(null); setShowCollection(true); }} style={{flex:1.4,padding:"13px 0",borderRadius:13,border:"none",background:rm.color,color:"#0a0f0a",fontFamily:G.font,fontWeight:900,fontSize:13.5,cursor:"pointer"}}>
              {tr("Mettre en badge","Use as badge","Als Abzeichen","Usa come badge","Usar como selo")}
            </button>
          </div>
        </div>
      </div>
    );
  })() : null;

  const gradeUpModal = gradeUpPopup ? (() => {
    const label = lang === "en" ? (gradeUpPopup.labelEn || gradeUpPopup.label) : gradeUpPopup.label;
    const color = gradeUpPopup.color || G.accent;
    return (
      <div style={{position:"fixed",inset:0,zIndex:600,background:"rgba(0,0,0,.85)",backdropFilter:"blur(14px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,animation:"fadeUp .4s ease"}}>
        {/* Rayons de lumière derrière le modal */}
        <div style={{position:"absolute",inset:0,overflow:"hidden",pointerEvents:"none"}}>
          {Array.from({length:12}).map(function(_,i){
            const angle = (i*30);
            return (
              <div key={i} style={{
                position:"absolute",
                top:"50%",left:"50%",
                width:"200vw",height:60,
                background:`linear-gradient(90deg, transparent, ${color}22 30%, ${color}44 50%, ${color}22 70%, transparent)`,
                transformOrigin:"center",
                transform:`translate(-50%,-50%) rotate(${angle}deg)`,
                animation:`gradeRayPulse 3s ease-in-out ${i*0.1}s infinite`,
              }}/>
            );
          })}
        </div>
        <div style={{position:"relative",width:"100%",maxWidth:360,background:"rgba(10,15,10,.98)",borderRadius:28,padding:"36px 24px 28px",border:`2.5px solid ${color}`,boxShadow:`0 0 60px ${color}66, 0 20px 60px rgba(0,0,0,.6)`,textAlign:"center",animation:"gradeUpPop .6s cubic-bezier(.34,1.56,.64,1)"}}>
          {/* Titre */}
          <div style={{fontSize:11,color:"rgba(255,255,255,.5)",letterSpacing:3,fontWeight:800,marginBottom:6}}>
            {tr("🎉 NOUVEAU GRADE 🎉","🎉 LEVEL UP 🎉","🎉 LEVEL UP 🎉","🎉 LIVELLO SU 🎉","🎉 SUBIU DE NÍVEL 🎉")}
          </div>
          <div style={{fontSize:14,color:"rgba(255,255,255,.75)",marginBottom:22}}>
            {tr("Tu viens d'atteindre le grade","You just reached the rank","Du hast gerade den Rang erreicht","Hai appena raggiunto il grado","Você alcançou a patente")}
          </div>
          {/* Emoji géant avec pulse */}
          <div style={{fontSize:90,lineHeight:1,marginBottom:12,animation:"gradeEmojiPulse 2s ease-in-out infinite",filter:`drop-shadow(0 0 30px ${color}99)`}}>
            {gradeUpPopup.emoji}
          </div>
          {/* Label du grade */}
          <div style={{fontFamily:G.heading,fontSize:28,color:color,lineHeight:1.1,marginBottom:8,textShadow:`0 0 20px ${color}88`,letterSpacing:1}}>
            {label.toUpperCase()}
          </div>
          {/* Min XP */}
          <div style={{fontSize:13,color:"rgba(255,255,255,.5)",marginBottom:24,fontWeight:700}}>
            {gradeUpPopup.min}+ XP
          </div>
          {/* Bouton fermer */}
          <button
            onClick={function(){setGradeUpPopup(null);}}
            style={{width:"100%",padding:"15px",background:color,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800,boxShadow:`0 4px 20px ${color}66`}}
          >
            {tr("CONTINUER","CONTINUE","WEITER","CONTINUA","CONTINUAR")} →
          </button>
        </div>
        <style>{`
          @keyframes gradeUpPop {
            0% { transform:scale(.5); opacity:0; }
            50% { transform:scale(1.05); }
            100% { transform:scale(1); opacity:1; }
          }
          @keyframes gradeEmojiPulse {
            0%, 100% { transform:scale(1) rotate(-3deg); }
            50% { transform:scale(1.12) rotate(3deg); }
          }
          @keyframes gradeRayPulse {
            0%, 100% { opacity:.3; }
            50% { opacity:.7; }
          }
        `}</style>
      </div>
    );
  })() : null;

  const feedbackBar = (fb) => {
    if(!fb) return null;
    return (
      <div style={{position:"fixed",top:0,left:0,right:0,zIndex:50,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"10px 16px",
        background:fb==="ok"?"#dcfce7":fb==="ko"?"#fee2e2":"#fef9c3",
        border:`2px solid ${fb==="ok"?G.accent:fb==="ko"?G.red:"#fbbf24"}`,
        animation:fb==="ok"?"answerOk .5s ease":fb==="ko"?"answerKo .4s ease":"popIn .3s ease",
      }}>
        {fb==="ok"&&<><div style={{display:"flex",alignItems:"center",gap:8,fontSize:17,fontWeight:800,color:"#16a34a"}}>{Icon.ball(18,"#16a34a")} {feedbackPhrase || (tr("BONNE RÉPONSE !","RIGHT ANSWER !","RICHTIG !","RISPOSTA GIUSTA !","RESPOSTA CERTA !"))}</div><div style={{fontSize:12,fontWeight:600,color:"#16a34a",opacity:.7}}>+{diff==="expert"?30:diff==="moyen"?20:10} pts</div></>}
        {fb==="ko"&&<><div style={{display:"flex",alignItems:"center",gap:8,fontSize:17,fontWeight:800,color:G.red}}>{Icon.whistle(18,G.red)} {tr("MAUVAISE RÉPONSE","WRONG ANSWER","FALSCH","RISPOSTA SBAGLIATA","RESPOSTA ERRADA")}</div><div style={{fontSize:12,fontWeight:600,color:G.red,opacity:.7}}>−5 pts</div></>}
        {fb==="used"&&<div style={{display:"flex",alignItems:"center",gap:8,fontSize:15,fontWeight:800,color:"#d97706"}}>{Icon.flag(16,"#d97706")} {tr("CLUB DÉJÀ UTILISÉ","CLUB ALREADY USED","KLUB SCHON BENUTZT","CLUB GIÀ USATO","CLUBE JÁ USADO")}</div>}
      </div>
    );
  };

  const instructionsPopup = showInstructions&&(() => {
    const isPont = showInstructions==="pont";
    const accentColor = isPont ? "#FFD600" : "#60a5fa";
    const accentSecondary = isPont ? "#FF6B35" : "#3b82f6";
    return (
      <div onClick={dismissInstructions} style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px",background:"rgba(0,0,0,.75)",backdropFilter:"blur(12px)",animation:"fadeIn .25s ease",cursor:"pointer"}}>
        <div onClick={(e)=>e.stopPropagation()} style={{position:"relative",borderRadius:28,maxWidth:380,width:"100%",overflow:"hidden",animation:"popIn .4s cubic-bezier(.34,1.56,.64,1)",cursor:"default",boxShadow:`0 30px 80px rgba(0,0,0,.6), 0 0 0 1px ${accentColor}33, 0 0 60px ${accentColor}22`}}>
          {/* Fond pelouse */}
          <div style={{position:"absolute",inset:0,zIndex:0,overflow:"hidden"}}>
            {[0,1,2,3,4,5,6].map(i => (
              <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#0E1F14":"#132819"}}/>
            ))}
            <div style={{position:"absolute",inset:0,background:`linear-gradient(180deg, ${accentColor}25 0%, rgba(10,20,10,.88) 50%, rgba(10,20,10,.95) 100%)`}}/>
            <div style={{position:"absolute",top:-60,left:-60,width:240,height:240,borderRadius:"50%",background:`radial-gradient(circle, ${accentColor}40 0%, transparent 70%)`,filter:"blur(30px)"}}/>
            <div style={{position:"absolute",top:-40,right:-40,width:200,height:200,borderRadius:"50%",background:`radial-gradient(circle, ${accentSecondary}30 0%, transparent 70%)`,filter:"blur(30px)"}}/>
          </div>

          {/* Close button */}
          <button onClick={dismissInstructions} style={{position:"absolute",top:14,right:14,zIndex:2,width:32,height:32,borderRadius:"50%",background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.15)",color:G.white,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(10px)"}}>✕</button>

          {/* Content */}
          <div style={{position:"relative",zIndex:1,padding:"32px 26px 26px"}}>
            {/* Icon */}
            <div style={{display:"flex",justifyContent:"center",marginBottom:14}}>
              <div style={{width:72,height:72,borderRadius:"50%",background:`linear-gradient(135deg, ${accentColor}, ${accentSecondary})`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 8px 24px ${accentColor}66`}}>
                {isPont ? Icon.pitch(36,"#000") : Icon.transfer(36,"#000")}
              </div>
            </div>

            {/* Title */}
            <div style={{fontFamily:G.heading,fontSize:34,color:G.white,letterSpacing:3,textAlign:"center",marginBottom:4,textShadow:`0 2px 12px ${accentColor}66`}}>
              {isPont?"GOAT PLUG":"GOAT MERCATO"}
            </div>
            <div style={{fontSize:11,letterSpacing:3,color:accentColor,textTransform:"uppercase",fontWeight:800,textAlign:"center",marginBottom:22}}>
              {isPont ? (tr("Relie les clubs","Connect the clubs","Verbinde die Klubs","Collega i club","Ligue os clubes")) : (tr("Chaîne infinie","Endless chain","Endlose Kette","Catena infinita","Corrente infinita"))}
            </div>

            {/* Rules cards */}
            {isPont ? (
              <>
                <div style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:16,padding:"14px 16px",marginBottom:12,backdropFilter:"blur(10px)"}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                    <div style={{fontSize:22}}>🎯</div>
                    <div style={{flex:1,fontSize:14,color:"rgba(255,255,255,.9)",lineHeight:1.5}}>
                      {lang==="de"?<>Zwei Klubs erscheinen. Nenne <strong style={{color:accentColor}}>einen Spieler</strong>, der für beide gespielt hat!</>:lang==="it"?<>Appaiono due club. Nomina <strong style={{color:accentColor}}>un giocatore</strong> che ha giocato in entrambi!</>:lang==="pt"?<>Dois clubes aparecem. Diga <strong style={{color:accentColor}}>um jogador</strong> que jogou nos dois!</>:lang==="en"?<>Two clubs appear. Name <strong style={{color:accentColor}}>a player</strong> who played for both!</>:<>Deux clubs s'affichent. Nomme <strong style={{color:accentColor}}>un joueur</strong> qui a joué dans les deux !</>}
                    </div>
                  </div>
                </div>

                {/* Points card */}
                <div style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:16,padding:"14px 16px",marginBottom:12,backdropFilter:"blur(10px)"}}>
                  <div style={{fontSize:10,fontWeight:800,letterSpacing:2,color:"rgba(255,255,255,.4)",textTransform:"uppercase",marginBottom:10,textAlign:"center"}}>{tr("POINTS","POINTS","PUNKTE","PUNTI","PONTOS")}</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                    <div style={{textAlign:"center",padding:"8px 6px",background:"rgba(0,230,118,.1)",borderRadius:10,border:"1px solid rgba(0,230,118,.25)"}}>
                      <div style={{fontSize:20,marginBottom:2}}>✓</div>
                      <div style={{fontSize:13,fontWeight:800,color:"#00E676"}}>+10/20/30</div>
                      <div style={{fontSize:9,color:"rgba(255,255,255,.5)",marginTop:2}}>{tr("bonne","correct","richtig","corrette","certas")}</div>
                    </div>
                    <div style={{textAlign:"center",padding:"8px 6px",background:"rgba(255,61,87,.1)",borderRadius:10,border:"1px solid rgba(255,61,87,.25)"}}>
                      <div style={{fontSize:20,marginBottom:2}}>✗</div>
                      <div style={{fontSize:13,fontWeight:800,color:"#FF3D57"}}>−5</div>
                      <div style={{fontSize:9,color:"rgba(255,255,255,.5)",marginTop:2}}>{tr("mauvaise","wrong","falsch","sbagliate","erradas")}</div>
                    </div>
                    <div style={{textAlign:"center",padding:"8px 6px",background:"rgba(251,226,22,.08)",borderRadius:10,border:"1px solid rgba(251,226,22,.2)"}}>
                      <div style={{fontSize:20,marginBottom:2}}>→</div>
                      <div style={{fontSize:13,fontWeight:800,color:"#FBE216"}}>−10</div>
                      <div style={{fontSize:9,color:"rgba(255,255,255,.5)",marginTop:2}}>{tr("passer","skip","überspringen","salta","pular")}</div>
                    </div>
                  </div>
                </div>

                {/* Combo card */}
                <div style={{background:`linear-gradient(135deg, ${accentColor}14, ${accentSecondary}10)`,border:`1px solid ${accentColor}33`,borderRadius:16,padding:"12px 16px",marginBottom:20}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{fontSize:22}}>🔥</div>
                    <div style={{flex:1,fontSize:13,color:"rgba(255,255,255,.85)",lineHeight:1.4}}>
                      <strong style={{color:accentColor}}>{tr("Bonus combo","Combo bonus","Combo-Bonus","Bonus combo","Bônus combo")} :</strong> {tr("+10 (×3), +20 (×5), +30 (×10)","+10 (×3), +20 (×5), +30 (×10)","+10 (×3), +20 (×5), +30 (×10)","+10 (×3), +20 (×5), +30 (×10)","+10 (×3), +20 (×5), +30 (×10)")}<br/>
                      <span style={{fontSize:11,color:"rgba(255,255,255,.5)"}}>{tr("Réponds vite pour enchaîner !","Answer fast to chain!","Antworte schnell für die Kette!","Rispondi in fretta per concatenare!","Responda rápido para encadear!")}</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:16,padding:"14px 16px",marginBottom:12,backdropFilter:"blur(10px)"}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                    <div style={{fontSize:22}}>⛓️</div>
                    <div style={{flex:1,fontSize:14,color:"rgba(255,255,255,.9)",lineHeight:1.5}}>
                      {lang==="de"?<>Ein Spieler erscheint → nenne <strong style={{color:accentColor}}>einen Klub</strong>, für den er spielte → ein neuer Spieler dieses Klubs → und so weiter!</>:lang==="it"?<>Appare un giocatore → nomina <strong style={{color:accentColor}}>un club</strong> in cui ha giocato → un nuovo giocatore di quel club → e così via!</>:lang==="pt"?<>Aparece um jogador → diga <strong style={{color:accentColor}}>um clube</strong> onde jogou → um novo jogador desse clube → e assim por diante!</>:lang==="en"?<>A player appears → name <strong style={{color:accentColor}}>a club</strong> they played for → a new player from that club → and so on!</>:<>Un joueur apparaît → nomme <strong style={{color:accentColor}}>un club</strong> où il a joué → un nouveau joueur de ce club → et ainsi de suite !</>}
                    </div>
                  </div>
                </div>

                <div style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:16,padding:"14px 16px",marginBottom:12,backdropFilter:"blur(10px)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{fontSize:20}}>⚠️</div>
                    <div style={{flex:1,fontSize:13,color:"rgba(255,255,255,.85)",lineHeight:1.4}}>
                      <strong style={{color:accentColor}}>{tr("Une règle","One rule","Eine Regel","Una regola","Uma regra")} :</strong> {tr("un club ne peut être cité qu'une seule fois.","each club can only be named once.","jeder Klub darf nur einmal genannt werden.","ogni club può essere citato una sola volta.","cada clube só pode ser citado uma vez.")}
                    </div>
                  </div>
                </div>

                <div style={{background:`linear-gradient(135deg, ${accentColor}14, ${accentSecondary}10)`,border:`1px solid ${accentColor}33`,borderRadius:16,padding:"12px 16px",marginBottom:20}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{fontSize:20}}>💡</div>
                    <div style={{flex:1,fontSize:12,color:"rgba(255,255,255,.75)",lineHeight:1.4}}>
                      {tr("Abréviations acceptées : PSG, Barça, Juve...","Abbreviations accepted: PSG, Barça, Juve...","Abkürzungen erlaubt: PSG, Barça, Juve...","Abbreviazioni accettate: PSG, Barça, Juve...","Abreviações aceitas: PSG, Barça, Juve...")}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* CTA Button */}
            <button onClick={dismissInstructions} style={{width:"100%",padding:"16px",background:`linear-gradient(135deg, ${accentColor}, ${accentSecondary})`,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:16,fontWeight:800,letterSpacing:1,boxShadow:`0 8px 24px ${accentColor}55`,display:"flex",alignItems:"center",justifyContent:"center",gap:8,transition:"transform .15s"}} onMouseDown={(e)=>e.currentTarget.style.transform="scale(.97)"} onMouseUp={(e)=>e.currentTarget.style.transform="scale(1)"} onMouseLeave={(e)=>e.currentTarget.style.transform="scale(1)"}>
              {tr("C'EST PARTI","LET'S GO","LOS GEHT'S","SI PARTE","VAMOS LÁ")} →
            </button>
          </div>
        </div>
      </div>
    );
  })();


  // ── INSTALL APP PROMPT ──
  const installPrompt = showInstallPrompt && !isStandalone() && (() => {
    const ios = isIOS();
    return (
      <div onClick={() => { setShowInstallPrompt(false); installDismissedThisSession.current = true; try{localStorage.setItem("bb_install_dismissed", String(Date.now()));}catch{} }} style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,.85)",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px",backdropFilter:"blur(12px)",animation:"fadeIn .25s ease",cursor:"pointer"}}>
        <div onClick={(e)=>e.stopPropagation()} style={{position:"relative",borderRadius:28,maxWidth:380,width:"100%",overflow:"hidden",animation:"popIn .4s cubic-bezier(.34,1.56,.64,1)",cursor:"default",boxShadow:"0 30px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(0,230,118,.3), 0 0 60px rgba(0,230,118,.2)"}}>
          {/* Fond pelouse */}
          <div style={{position:"absolute",inset:0,zIndex:0,overflow:"hidden"}}>
            {[0,1,2,3,4,5,6].map(i => (
              <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#0E1F14":"#132819"}}/>
            ))}
            <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg, rgba(0,230,118,.22) 0%, rgba(10,20,10,.90) 50%, rgba(10,20,10,.95) 100%)"}}/>
            <div style={{position:"absolute",top:-60,left:-60,width:240,height:240,borderRadius:"50%",background:"radial-gradient(circle, rgba(0,230,118,.45) 0%, transparent 70%)",filter:"blur(40px)"}}/>
            <div style={{position:"absolute",top:-40,right:-40,width:200,height:200,borderRadius:"50%",background:"radial-gradient(circle, rgba(255,214,0,.35) 0%, transparent 70%)",filter:"blur(40px)"}}/>
          </div>
          <button onClick={()=>{ setShowInstallPrompt(false); installDismissedThisSession.current = true; try{localStorage.setItem("bb_install_dismissed", String(Date.now()));}catch{} }} style={{position:"absolute",top:14,right:14,zIndex:2,width:32,height:32,borderRadius:"50%",background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.15)",color:G.white,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(10px)"}}>✕</button>

          <div style={{position:"relative",zIndex:1,padding:"32px 26px 26px"}}>
            {/* Icon */}
            <div style={{display:"flex",justifyContent:"center",marginBottom:14}}>
              <div style={{width:84,height:84,borderRadius:20,background:"linear-gradient(135deg,#00E676,#00A855)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 8px 24px rgba(0,230,118,.5)",fontSize:44}}>
                📲
              </div>
            </div>
            <div style={{fontFamily:G.heading,fontSize:28,color:G.white,letterSpacing:2,textAlign:"center",marginBottom:4,textShadow:"0 2px 12px rgba(0,230,118,.5)"}}>
              {tr("INSTALLER GOAT FC","INSTALL GOAT FC","GOAT FC INSTALLIEREN","INSTALLA GOAT FC","INSTALAR GOAT FC")}
            </div>
            <div style={{fontSize:11,letterSpacing:3,color:"#00E676",textTransform:"uppercase",fontWeight:800,textAlign:"center",marginBottom:22}}>
              {tr("Reçois les rappels quotidiens 🔥","Get daily reminders 🔥","Erhalte tägliche Erinnerungen 🔥","Ricevi promemoria quotidiani 🔥","Receba lembretes diários 🔥")}
            </div>

            {/* Benefits */}
            <div style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:16,padding:"14px 16px",marginBottom:14}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:10}}>
                <span style={{fontSize:18}}>🔥</span>
                <div style={{flex:1,fontSize:13,color:"rgba(255,255,255,.9)",lineHeight:1.4}}>
                  {lang==="de"?<>Verliere nie deine <strong style={{color:"#FFD600"}}>Serie</strong> — Erinnerung vor Mitternacht</>:lang==="it"?<>Non perdere mai la tua <strong style={{color:"#FFD600"}}>serie</strong> — promemoria prima di mezzanotte</>:lang==="pt"?<>Nunca perca sua <strong style={{color:"#FFD600"}}>sequência</strong> — lembrete antes da meia-noite</>:lang==="en"?<>Never break your <strong style={{color:"#FFD600"}}>streak</strong> — get pinged before midnight</>:<>Ne casse plus ta <strong style={{color:"#FFD600"}}>série</strong> — rappel avant minuit</>}
                </div>
              </div>
              <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:10}}>
                <span style={{fontSize:18}}>⚡</span>
                <div style={{flex:1,fontSize:13,color:"rgba(255,255,255,.9)",lineHeight:1.4}}>
                  {lang==="de"?<>Schnellerer Zugriff — <strong>ein Tipp</strong> vom Startbildschirm</>:lang==="it"?<>Accesso più rapido — <strong>un tocco</strong> dalla schermata Home</>:lang==="pt"?<>Acesso mais rápido — <strong>um toque</strong> da tela inicial</>:lang==="en"?<>Faster access — <strong>one tap</strong> from your home screen</>:<>Accès rapide — <strong>un tap</strong> depuis l'écran d'accueil</>}
                </div>
              </div>
              <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                <span style={{fontSize:18}}>🎯</span>
                <div style={{flex:1,fontSize:13,color:"rgba(255,255,255,.9)",lineHeight:1.4}}>
                  {lang==="de"?<>Vollbild-Erlebnis, keine Browserleiste</>:lang==="it"?<>Esperienza a schermo intero, senza barra del browser</>:lang==="pt"?<>Experiência em tela cheia, sem barra do navegador</>:lang==="en"?<>Full-screen experience, no browser bar</>:<>Expérience plein écran, pas de barre navigateur</>}
                </div>
              </div>
            </div>

            {/* Instructions spécifiques plateforme */}
            {ios ? (
              <div style={{background:"linear-gradient(135deg, rgba(0,230,118,.12), rgba(255,214,0,.08))",border:"1px solid rgba(0,230,118,.3)",borderRadius:16,padding:"14px 16px",marginBottom:20}}>
                <div style={{fontSize:11,fontWeight:800,letterSpacing:2,color:"#00E676",textTransform:"uppercase",marginBottom:10,textAlign:"center"}}>
                  {tr("📱 iPhone / iPad","📱 iPhone / iPad","📱 iPhone / iPad","📱 iPhone / iPad","📱 iPhone / iPad")}
                </div>
                <div style={{fontSize:13,color:"rgba(255,255,255,.85)",lineHeight:1.6}}>
                  <div style={{marginBottom:6}}><strong style={{color:G.white}}>1.</strong> {lang==="de"?<>Tippe auf den <strong style={{color:"#60a5fa"}}>Teilen-Button</strong> ⬆️ unten in Safari</>:lang==="it"?<>Tocca il <strong style={{color:"#60a5fa"}}>pulsante Condividi</strong> ⬆️ in basso in Safari</>:lang==="pt"?<>Toque no <strong style={{color:"#60a5fa"}}>botão Compartilhar</strong> ⬆️ na parte de baixo do Safari</>:lang==="en"?<>Tap the <strong style={{color:"#60a5fa"}}>Share button</strong> ⬆️ at the bottom of Safari</>:<>Tape le <strong style={{color:"#60a5fa"}}>bouton Partager</strong> ⬆️ en bas de Safari</>}</div>
                  <div style={{marginBottom:6}}><strong style={{color:G.white}}>2.</strong> {lang==="de"?<>Scrolle nach unten und tippe auf <strong style={{color:"#FFD600"}}>"Zum Home-Bildschirm"</strong></>:lang==="it"?<>Scorri e tocca <strong style={{color:"#FFD600"}}>"Aggiungi a Home"</strong></>:lang==="pt"?<>Role para baixo e toque em <strong style={{color:"#FFD600"}}>"Adicionar à Tela de Início"</strong></>:lang==="en"?<>Scroll down and tap <strong style={{color:"#FFD600"}}>"Add to Home Screen"</strong></>:<>Descend et tape <strong style={{color:"#FFD600"}}>"Sur l'écran d'accueil"</strong></>}</div>
                  <div><strong style={{color:G.white}}>3.</strong> {lang==="de"?<>Bestätige mit <strong style={{color:"#00E676"}}>"Hinzufügen"</strong></>:lang==="it"?<>Conferma toccando <strong style={{color:"#00E676"}}>"Aggiungi"</strong></>:lang==="pt"?<>Confirme tocando em <strong style={{color:"#00E676"}}>"Adicionar"</strong></>:lang==="en"?<>Confirm by tapping <strong style={{color:"#00E676"}}>"Add"</strong></>:<>Confirme en tapant <strong style={{color:"#00E676"}}>"Ajouter"</strong></>}</div>
                </div>
              </div>
            ) : deferredInstall ? (
              <button onClick={async function(){
                try {
                  deferredInstall.prompt();
                  const choice = await deferredInstall.userChoice;
                  if (choice.outcome === "accepted") {
                    setShowInstallPrompt(false);
                    setDeferredInstall(null);
                  }
                } catch(e) {}
              }} style={{width:"100%",padding:"16px",background:"linear-gradient(135deg,#00E676,#00A855)",color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:16,fontWeight:800,letterSpacing:1,boxShadow:"0 8px 24px rgba(0,230,118,.5)",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:10}}>
                ⬇ {tr("INSTALLER MAINTENANT","INSTALL NOW","JETZT INSTALLIEREN","INSTALLA ORA","INSTALAR AGORA")}
              </button>
            ) : (
              <div style={{background:"linear-gradient(135deg, rgba(0,230,118,.12), rgba(255,214,0,.08))",border:"1px solid rgba(0,230,118,.3)",borderRadius:16,padding:"14px 16px",marginBottom:20}}>
                <div style={{fontSize:11,fontWeight:800,letterSpacing:2,color:"#00E676",textTransform:"uppercase",marginBottom:10,textAlign:"center"}}>
                  {tr("📱 Sur ton appareil","📱 On your device","📱 Auf deinem Gerät","📱 Sul tuo dispositivo","📱 No seu aparelho")}
                </div>
                <div style={{fontSize:13,color:"rgba(255,255,255,.85)",lineHeight:1.6}}>
                  {tr("Ouvre le menu (⋮) de ton navigateur, puis tape \"Installer l'application\" ou \"Ajouter à l'écran d'accueil\"","Look for the menu (⋮) in your browser, then tap \"Install app\" or \"Add to Home Screen\"","Öffne das Menü (⋮) deines Browsers und tippe auf \"App installieren\" oder \"Zum Startbildschirm hinzufügen\"","Apri il menu (⋮) del browser, poi tocca \"Installa app\" o \"Aggiungi a schermata Home\"","Abra o menu (⋮) do seu navegador e toque em \"Instalar app\" ou \"Adicionar à tela inicial\"")}
                </div>
              </div>
            )}

            {/* Dismiss */}
            <button onClick={()=>{ setShowInstallPrompt(false); installDismissedThisSession.current = true; try{localStorage.setItem("bb_install_dismissed", String(Date.now()));}catch{} }} style={{width:"100%",padding:"12px",background:"transparent",color:"rgba(255,255,255,.5)",border:"1px solid rgba(255,255,255,.15)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:600}}>
              {tr("Plus tard","Maybe later","Vielleicht später","Più tardi","Talvez depois")}
            </button>
          </div>
        </div>
      </div>
    );
  })();

  // ── NOTIFICATION PROMPT ──
  const notifPrompt = showNotifPrompt && !notifGranted && (
    <div style={{position:"fixed",bottom:20,left:16,right:16,zIndex:500,animation:"fadeUp .4s ease"}}>
      <div style={{background:G.dark,borderRadius:20,padding:"16px 18px",boxShadow:"0 8px 32px rgba(0,0,0,.4)",display:"flex",flexDirection:"column",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{fontSize:28}}>🔔</div>
          <div>
            <div style={{fontSize:14,fontWeight:800,color:G.white}}>{tr("Reçois des rappels !","Get reminders!","Erinnerungen erhalten!","Ricevi promemoria!","Receba lembretes!")}</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.6)",marginTop:2}}>{tr("On te pinguera si t'as pas joué depuis 24h","We'll ping you if you haven't played for 24h","Wir erinnern dich, wenn du 24 Std. nicht gespielt hast","Ti avvisiamo se non giochi da 24 ore","A gente te avisa se você não jogar por 24h")}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={async ()=>{
            const ok = await requestNotifPermission();
            setNotifGranted(ok);
            setShowNotifPrompt(false);
            if (ok) {
              scheduleNextNotif();
              // S'abonner aux vraies push notifications (visible même app fermée)
              if (playerId && pseudoConfirmed) {
                const subscribed = await subscribeToPush(playerId, sbFetch);
                setPushSubscribed(subscribed);
              }
            }
          }} style={{flex:2,padding:"11px",background:"#16a34a",color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:800}}>
            {tr("✓ Oui, active !","✓ Yes, enable!","✓ Ja, aktivieren!","✓ Sì, attiva!","✓ Sim, ativar!")}
          </button>
          <button onClick={()=>{ setShowNotifPrompt(false); try{localStorage.setItem("bb_notif_dismissed", String(Date.now()));}catch{} }} style={{flex:1,padding:"11px",background:"rgba(255,255,255,.06)",color:"rgba(255,255,255,.6)",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:600}}>
            {tr("Plus tard","Later","Später","Più tardi","Depois")}
          </button>
        </div>
      </div>
    </div>
  );

  // ── WELCOME BACK BANNER ──
  const welcomeBack = wasAway && (
    <div key="welcome-back" style={{position:"fixed",top:12,left:16,right:16,zIndex:400,animation:"fadeUp .5s ease .3s both"}}>
      <div style={{background:"linear-gradient(135deg,#f59e0b,#ef4444)",borderRadius:16,padding:"12px 16px",boxShadow:"0 6px 24px rgba(245,158,11,.4)",display:"flex",alignItems:"center",gap:12}}>
        {Icon.ball(22,G.white)}
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:800,color:G.white}}>{tr("Content de te revoir ! 🙌","Welcome back! 🙌","Willkommen zurück! 🙌","Bentornato! 🙌","Bem-vindo de volta! 🙌")}</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.8)",marginTop:1}}>{tr("Ça fait +24h — ton record t'attend !","It's been 24h+ — your record awaits!","Über 24 Std. — dein Rekord wartet!","Sono passate +24h — il tuo record ti aspetta!","Já faz +24h — seu recorde espera!")}</div>
        </div>
        <button onClick={()=>setWasAway(false)} style={{background:"rgba(255,255,255,.2)",border:"none",borderRadius:20,width:26,height:26,cursor:"pointer",color:G.white,fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
      </div>
    </div>
  );

  // ── STREAK DETAIL MODAL ──
  const streakModal = showStreakDetail && (
    <div key="streak-modal" onClick={()=>setShowStreakDetail(false)} style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,.85)",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px",animation:"fadeIn .2s ease",backdropFilter:"blur(12px)"}}>
      <div onClick={(e)=>e.stopPropagation()} style={{position:"relative",borderRadius:28,maxWidth:380,width:"100%",overflow:"hidden",animation:"popIn .4s cubic-bezier(.34,1.56,.64,1)",boxShadow:"0 30px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(255,107,53,.3), 0 0 60px rgba(255,107,53,.22)"}}>
        {/* Fond dégradé feu */}
        <div style={{position:"absolute",inset:0,zIndex:0,overflow:"hidden"}}>
          <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg, #1a0f06 0%, #0d1f0d 70%)"}}/>
          <div style={{position:"absolute",top:-80,left:-60,width:280,height:280,borderRadius:"50%",background:"radial-gradient(circle, rgba(255,214,0,.35) 0%, transparent 70%)",filter:"blur(40px)"}}/>
          <div style={{position:"absolute",top:-60,right:-40,width:240,height:240,borderRadius:"50%",background:"radial-gradient(circle, rgba(255,107,53,.4) 0%, transparent 70%)",filter:"blur(40px)"}}/>
        </div>
        {/* Close button */}
        <button onClick={()=>setShowStreakDetail(false)} style={{position:"absolute",top:14,right:14,zIndex:2,width:32,height:32,borderRadius:"50%",background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.15)",color:G.white,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(10px)"}}>✕</button>
        <div style={{position:"relative",zIndex:1,padding:"32px 26px 28px",textAlign:"center"}}>
          {/* Flame emoji with glow */}
          <div style={{fontSize:82,animation:dayStreak>=7?"flameGlow 2s ease-in-out infinite":"none",marginBottom:4}}>🔥</div>
          {/* Streak count - big */}
          <div style={{fontFamily:G.heading,fontSize:"clamp(56px,16vw,72px)",color:dayStreak>=7?"#FFD600":"#FF6B35",letterSpacing:1,lineHeight:1,textShadow:dayStreak>=7?"0 0 24px rgba(255,214,0,.6)":"0 0 16px rgba(255,107,53,.5)"}}>{dayStreak}</div>
          <div style={{fontSize:13,letterSpacing:3,textTransform:"uppercase",color:"rgba(255,255,255,.6)",fontWeight:800,marginTop:8,marginBottom:22}}>
            {dayStreak<=1?(tr("Jour de suite","Day streak","Tag in Folge","Giorno di fila","Dia seguido")):(tr("Jours de suite","Days in a row","Tage in Folge","Giorni di fila","Dias seguidos"))}
          </div>
          {/* Stats */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
            <div style={{background:"rgba(255,214,0,.08)",border:"1px solid rgba(255,214,0,.25)",borderRadius:14,padding:"12px 10px"}}>
              <div style={{fontSize:22,marginBottom:2}}>🏆</div>
              <div style={{fontFamily:G.heading,fontSize:26,color:G.gold,lineHeight:1}}>{streakBest}</div>
              <div style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:"rgba(255,255,255,.5)",fontWeight:700,marginTop:4}}>{tr("Record","Best ever","Bestwert","Record","Recorde")}</div>
            </div>
            <div style={{background:"rgba(96,165,250,.08)",border:"1px solid rgba(96,165,250,.25)",borderRadius:14,padding:"12px 10px"}}>
              <div style={{fontSize:22,marginBottom:2}}>❄️</div>
              <div style={{fontFamily:G.heading,fontSize:26,color:"#60a5fa",lineHeight:1}}>{streakFreezes}</div>
              <div style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:"rgba(255,255,255,.5)",fontWeight:700,marginTop:4}}>{tr("Rattrapages","Freezes","Freezes","Recuperi","Recuperações")}</div>
            </div>
          </div>
          {/* Info text */}
          <div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:14,padding:"14px 16px",textAlign:"left",marginBottom:8}}>
            <div style={{fontSize:12,color:"rgba(255,255,255,.85)",lineHeight:1.6}}>
              <strong style={{color:"#FFD600"}}>{tr("🎯 Comment ça marche","🎯 How it works","🎯 So funktioniert's","🎯 Come funziona","🎯 Como funciona")} :</strong><br/>
              {lang==="de" ? <>
                • Spiele täglich mindestens 1 Partie, um deine Serie zu halten 🔥<br/>
                • Alle 7 Tage bekommst du einen <strong>❄️ Freeze</strong> (max. 3)<br/>
                • Einen Tag verpasst? Ein Freeze rettet deine Serie!<br/>
                • Der Tag wird um Mitternacht zurückgesetzt (Pariser Zeit)
              </> : lang==="it" ? <>
                • Gioca almeno 1 partita al giorno per mantenere la serie 🔥<br/>
                • Ogni 7 giorni ottieni un <strong>❄️ Recupero</strong> (max 3)<br/>
                • Salti un giorno? Un recupero salva la tua serie!<br/>
                • Il giorno si azzera a mezzanotte (ora di Parigi)
              </> : lang==="pt" ? <>
                • Jogue pelo menos 1 partida por dia para manter sua sequência 🔥<br/>
                • A cada 7 dias, ganhe uma <strong>❄️ Recuperação</strong> (máx 3)<br/>
                • Perdeu um dia? Uma recuperação salva sua sequência!<br/>
                • O dia reinicia à meia-noite (horário de Paris)
              </> : lang==="en" ? <>
                • Play at least 1 game each day to keep your streak 🔥<br/>
                • Every 7 days, earn a <strong>❄️ Freeze</strong> (max 3)<br/>
                • Miss a day? A freeze saves your streak!<br/>
                • Day resets at midnight (Paris time)
              </> : <>
                • Joue au moins 1 partie chaque jour pour garder ta série 🔥<br/>
                • Tous les 7 jours, gagne un <strong>❄️ Rattrapage</strong> (max 3)<br/>
                • Raté un jour ? Un rattrapage sauve ta série !<br/>
                • Le jour reset à minuit (heure de Paris)
              </>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ── AVATAR VIEWER MODAL (visualisation photo de profil en plein écran) ──
  const avatarViewer = viewingAvatar && (
    <div key="avatar-viewer" onClick={()=>setViewingAvatar(null)} style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,.92)",display:"flex",alignItems:"center",justifyContent:"center",padding:"40px 20px",animation:"fadeIn .2s ease",cursor:"pointer",backdropFilter:"blur(10px)"}}>
      <button onClick={(e)=>{e.stopPropagation();setViewingAvatar(null);}} style={{position:"absolute",top:20,right:20,width:44,height:44,borderRadius:"50%",background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.2)",color:G.white,fontSize:22,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(10px)"}}>✕</button>
      <img src={viewingAvatar} alt="avatar" onClick={(e)=>e.stopPropagation()} style={{maxWidth:"100%",maxHeight:"100%",borderRadius:20,objectFit:"contain",boxShadow:"0 20px 60px rgba(0,0,0,.8)",cursor:"default"}}/>
    </div>
  );

  // ── DUEL CREATE MODAL (partagé entre écrans userProfile, friends, home, leaderboard) ──
  const duelCreateModal = showDuelCreate && (
    <div key="duel-create-modal" style={{position:"fixed",inset:0,zIndex:9998,background:"rgba(0,0,0,.85)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"rgba(15,25,15,.95)",borderRadius:24,padding:"28px 24px",maxWidth:340,width:"calc(100% - 32px)",border:"1px solid rgba(255,255,255,.1)"}}>
        <div style={{fontFamily:G.heading,fontSize:28,color:G.white,marginBottom:4}}>{tr("DÉFIER","CHALLENGE","HERAUSFORDERN","SFIDA","DESAFIAR")}</div>
        <div style={{fontSize:14,color:"rgba(255,255,255,.5)",marginBottom:20}}>vs <strong style={{color:G.gold}}>{showDuelCreate.name}</strong></div>
        <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.4)",marginBottom:8}}>Mode</div>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          {["pont","chaine"].map(function(m){return(
            <button key={m} onClick={function(){setDuelMode(m);}} style={{flex:1,padding:"10px",borderRadius:12,border:"1.5px solid "+(duelMode===m?G.accent:"rgba(255,255,255,.15)"),background:duelMode===m?"rgba(0,230,118,.1)":"transparent",color:duelMode===m?G.accent:G.white,fontFamily:G.font,fontWeight:700,cursor:"pointer",fontSize:13}}>
              {m==="pont"?"The Plug":"The Mercato"}
            </button>
          );})}
        </div>
        {duelMode==="pont" && (
          <>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.4)",marginBottom:8}}>{tr("Difficulté","Difficulty","Schwierigkeit","Difficoltà","Dificuldade")}</div>
            <div style={{display:"flex",gap:8,marginBottom:16}}>
              {["facile","moyen","expert"].map(function(d){return(
                <button key={d} onClick={function(){setDuelDiff(d);}} style={{flex:1,padding:"8px",borderRadius:10,border:"1.5px solid "+(duelDiff===d?G.gold:"rgba(255,255,255,.15)"),background:duelDiff===d?"rgba(255,214,0,.1)":"transparent",color:duelDiff===d?G.gold:G.white,fontFamily:G.font,fontWeight:700,cursor:"pointer",fontSize:12,textTransform:"capitalize"}}>
                  {d}
                </button>
              );})}
            </div>
            {/* Sélecteur de manches supprimé : 1 manche de 90s par défaut */}
          </>
        )}
        <div style={{display:"flex",gap:8,marginTop:8}}>
          <button onClick={function(){setShowDuelCreate(null);}} style={{flex:1,padding:"12px",background:"rgba(255,255,255,.07)",color:"rgba(255,255,255,.5)",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14}}>{tr("Annuler","Cancel","Abbrechen","Annulla","Cancelar")}</button>
          <button onClick={function(){ const t = { id:showDuelCreate.id, name:showDuelCreate.name }; setShowDuelCreate(null); setShowFriends(false); playOpenDuel({ mode:duelMode, diff:duelDiff, rounds:duelRounds, target:t }, "create"); }} style={{flex:2,padding:"12px",background:G.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800}}>{tr("Envoyer le défi ⚡","Send challenge ⚡","Herausforderung senden ⚡","Invia la sfida ⚡","Enviar desafio ⚡")}</button>
        </div>
      </div>
    </div>
  );

  // ── HISTORY MODAL (historique des questions de la partie qui vient de finir) ──
  const historyModal = showHistory && (
    <div key="history-modal" onClick={()=>setShowHistory(false)} style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,.85)",display:"flex",alignItems:"flex-end",justifyContent:"center",animation:"fadeIn .2s ease",backdropFilter:"blur(8px)"}}>
      <div onClick={(e)=>e.stopPropagation()} style={{background:"linear-gradient(180deg,#0d1f0d 0%,#0a1510 100%)",borderRadius:"24px 24px 0 0",width:"100%",maxWidth:500,maxHeight:"88vh",display:"flex",flexDirection:"column",animation:"slideUp .3s ease",border:"1px solid rgba(255,255,255,.08)"}}>
        {roundAnswers.length > 0 ? (
          <>
            <div style={{padding:"18px 20px",borderBottom:"1px solid rgba(255,255,255,.08)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <div style={{fontFamily:G.heading,fontSize:22,color:G.white,letterSpacing:2}}>
                  {tr("RÉCAP DES QUESTIONS","QUESTIONS RECAP","FRAGEN-ÜBERSICHT","RIEPILOGO DOMANDE","RESUMO DAS PERGUNTAS")}
                </div>
                <div style={{fontSize:12,color:"rgba(255,255,255,.4)",marginTop:2}}>
                  {roundAnswers.length} {roundAnswers.length>1?tr("questions","questions","Fragen","domande","perguntas"):tr("question","question","Frage","domanda","pergunta")} · {roundAnswers.filter(a=>a.status==="ok").length} ✓ · {roundAnswers.filter(a=>a.status==="ko").length} ✗ · {roundAnswers.filter(a=>a.status==="skip").length} →
                </div>
              </div>
              <button onClick={()=>setShowHistory(false)} style={{width:36,height:36,borderRadius:"50%",background:"rgba(255,255,255,.1)",border:"none",color:G.white,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"14px 16px"}}>
              {roundAnswers.map((a,i)=>{
                const [ca1,cb1]=getClubColors(a.c1);
                const [ca2,cb2]=getClubColors(a.c2);
                const statusColor = a.status==="ok"?"#00E676":a.status==="ko"?"#FF3D57":"#FBE216";
                const statusEmoji = a.status==="ok"?"✓":a.status==="ko"?"✗":"→";
                return (
                  <div key={i} style={{background:"rgba(255,255,255,.04)",borderRadius:14,padding:"12px 14px",marginBottom:8,border:`1px solid ${statusColor}33`}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                      <span style={{fontSize:10,fontWeight:800,color:"rgba(255,255,255,.3)",minWidth:22}}>#{i+1}</span>
                      <span style={{fontSize:16,color:statusColor,fontWeight:800}}>{statusEmoji}</span>
                      <div style={{flex:1,display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                        <span style={{fontSize:11,fontWeight:800,color:G.white,background:`linear-gradient(90deg,${ca1} 50%,${cb1} 50%)`,borderRadius:12,padding:"3px 8px",textShadow:"0 1px 3px rgba(0,0,0,.6)"}}>{getClubDisplayName(a.c1)}</span>
                        <span style={{fontSize:11,color:"rgba(255,255,255,.3)"}}>×</span>
                        <span style={{fontSize:11,fontWeight:800,color:G.white,background:`linear-gradient(90deg,${ca2} 50%,${cb2} 50%)`,borderRadius:12,padding:"3px 8px",textShadow:"0 1px 3px rgba(0,0,0,.6)"}}>{getClubDisplayName(a.c2)}</span>
                      </div>
                    </div>
                    {a.status==="ok" ? (
                      <div style={{fontSize:13,color:"rgba(255,255,255,.85)"}}>
                        <span style={{color:"rgba(255,255,255,.4)"}}>{tr("Ta réponse : ","Your answer: ","Deine Antwort: ","La tua risposta: ","Sua resposta: ")}</span>
                        <strong style={{color:"#00E676"}}>{a.given}</strong>
                      </div>
                    ) : (
                      <>
                        {a.given && (
                          <div style={{fontSize:12,color:"rgba(255,255,255,.5)",marginBottom:4}}>
                            <span style={{color:"rgba(255,255,255,.35)"}}>{tr("Ta réponse : ","Your answer: ","Deine Antwort: ","La tua risposta: ","Sua resposta: ")}</span>
                            <span style={{textDecoration:"line-through",color:"#FF3D57"}}>{a.given}</span>
                          </div>
                        )}
                        <div style={{fontSize:12,color:"rgba(255,255,255,.75)",lineHeight:1.5}}>
                          <span style={{color:"rgba(255,255,255,.4)"}}>{tr("Réponses possibles : ","Possible answers: ","Mögliche Antworten: ","Risposte possibili: ","Respostas possíveis: ")}</span>
                          <span style={{color:"#FBE216"}}>{(a.validPlayers||[]).slice(0,4).join(", ")}</span>
                          {a.validPlayers && a.validPlayers.length>4 && <span style={{color:"rgba(255,255,255,.3)"}}> +{a.validPlayers.length-4}</span>}
                        </div>
                      </>
                    )}
                    <button onClick={(e)=>{e.stopPropagation();setReportingAnswer(a);setReportMessage("");setReportSent(false);}} style={{marginTop:8,background:"transparent",border:"none",color:"rgba(255,255,255,.35)",fontSize:11,fontWeight:700,cursor:"pointer",padding:"4px 8px",textDecoration:"underline",letterSpacing:.5}}>
                      🚩 {tr("Signaler une erreur","Report error","Fehler melden","Segnala un errore","Reportar erro")}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        ) : chainHistory.length > 0 ? (
          <>
            <div style={{padding:"18px 20px",borderBottom:"1px solid rgba(255,255,255,.08)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <div style={{fontFamily:G.heading,fontSize:22,color:G.white,letterSpacing:2}}>
                  {tr("TA CHAÎNE","YOUR CHAIN","DEINE KETTE","LA TUA CATENA","SUA CORRENTE")}
                </div>
                <div style={{fontSize:12,color:"rgba(255,255,255,.4)",marginTop:2}}>
                  {chainHistory.length} {chainHistory.length>1?tr("liens","links","Glieder","anelli","elos"):tr("lien","link","Glied","anello","elo")}
                </div>
              </div>
              <button onClick={()=>setShowHistory(false)} style={{width:36,height:36,borderRadius:"50%",background:"rgba(255,255,255,.1)",border:"none",color:G.white,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"14px 16px"}}>
              {chainHistory.map((h,i)=>{
                const [ca,cb]=getClubColors(h.club);
                return (
                  <div key={i} style={{background:"rgba(255,255,255,.04)",borderRadius:14,padding:"12px 14px",marginBottom:8,border:"1px solid rgba(255,255,255,.06)",display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:10,fontWeight:800,color:"rgba(255,255,255,.3)",minWidth:22}}>#{i+1}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:700,color:G.white}}>{h.player}</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,.4)",marginTop:2}}>{tr("a joué à","played at","gespielt um","giocato alle","jogou às")}</div>
                    </div>
                    <span style={{fontSize:11,fontWeight:800,color:G.white,background:`linear-gradient(90deg,${ca} 50%,${cb} 50%)`,borderRadius:12,padding:"4px 10px",textShadow:"0 1px 3px rgba(0,0,0,.6)"}}>{getClubDisplayName(h.club)}</span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div style={{padding:"40px 20px",textAlign:"center",color:"rgba(255,255,255,.3)",fontSize:14}}>
            <div style={{padding:"18px 20px",borderBottom:"1px solid rgba(255,255,255,.08)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontFamily:G.heading,fontSize:22,color:G.white,letterSpacing:2}}>{tr("HISTORIQUE","HISTORY","VERLAUF","CRONOLOGIA","HISTÓRICO")}</div>
              <button onClick={()=>setShowHistory(false)} style={{width:36,height:36,borderRadius:"50%",background:"rgba(255,255,255,.1)",border:"none",color:G.white,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>
            <div style={{padding:"40px 20px"}}>{tr("Aucune donnée","No data","Keine Daten","Nessun dato","Sem dados")}</div>
          </div>
        )}
      </div>
    </div>
  );

  // ── BANNIÈRE "DÉFI POSTÉ" ──
  const openNotifBanner = openNotif && (
    <div key="open-notif" style={{position:"fixed",top:"max(16px, env(safe-area-inset-top))",left:16,right:16,zIndex:12000,background:"linear-gradient(135deg,#FF8A2A,#FFC93C)",color:"#000",borderRadius:14,padding:"12px 16px",textAlign:"center",fontFamily:G.font,fontSize:14,fontWeight:800,boxShadow:"0 8px 24px rgba(255,138,42,.5)",animation:"dropIn .4s ease"}}>
      {openNotif}
    </div>
  );

  // ── GOAT DUEL — Plug temps réel 1v1 ──
  const duelOverlay = duelScreen && (function(){
    const room = duelRoom;
    const isHost = room ? room.host_id===playerId : true;
    const myName = isHost ? (room&&room.host_name) : (room&&room.guest_name);
    const oppName = isHost ? (room&&room.guest_name) : (room&&room.host_name);
    const myScore = room ? (isHost ? (room.host_score||0) : (room.guest_score||0)) : 0;
    const oppScore = room ? (isHost ? (room.guest_score||0) : (room.host_score||0)) : 0;
    const myAnsMs = room ? (isHost ? room.host_answer_ms : room.guest_answer_ms) : null;
    const oppAnsMs = room ? (isHost ? room.guest_answer_ms : room.host_answer_ms) : null;
    const now = duelNow || Date.now();
    // Décompte réponse : gelé à 10 pendant le tirage, puis compte à partir de l'arrêt des rouleaux
    const ansLeft = duelSpin
      ? DUEL_ANSWER_SECS
      : Math.min(DUEL_ANSWER_SECS, Math.max(0, Math.ceil(DUEL_ANSWER_SECS - (now - (duelAnswerShownAtRef.current || now))/1000)));
    const shell2 = { position:"fixed", top:0, left:0, right:0, bottom:0, zIndex:11000, background:"linear-gradient(180deg,#0a1410 0%,#0E1F14 100%)", display:"flex", flexDirection:"column", fontFamily:G.font, color:G.white };
    const bigBtn = (label, onClick, bg, disabled) => (
      <button onClick={onClick} disabled={disabled} style={{width:"100%",padding:"16px",borderRadius:16,border:"none",background:disabled?"rgba(255,255,255,.08)":bg,color:disabled?"rgba(255,255,255,.35)":"#000",fontFamily:G.heading,fontSize:20,letterSpacing:1.5,cursor:disabled?"not-allowed":"pointer",boxShadow:disabled?"none":"0 8px 24px -8px rgba(0,230,118,.5)"}}>{label}</button>
    );
    const header = (
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"max(14px,env(safe-area-inset-top)) 16px 10px",borderBottom:"1px solid rgba(255,255,255,.08)"}}>
        <button onClick={duelLeaveRoom} style={{background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.15)",borderRadius:"50%",width:38,height:38,color:G.white,cursor:"pointer",fontSize:16}}>✕</button>
        <div style={{fontFamily:G.heading,fontSize:22,letterSpacing:2,color:"#FFD600"}}>⚡ GOAT DUEL</div>
        <div style={{width:38}}/>
      </div>
    );
    const isSolo = !!(room && room.solo);
    // SOLO : temps restant sur le chrono GLOBAL (60 s), manches illimitées
    const soloLeft = (isSolo && room && room.solo_ends_at)
      ? Math.max(0, Math.ceil((new Date(room.solo_ends_at).getTime() - now)/1000))
      : null;
    // Partie rapide : moteur solo (chrono global) mais VRAI face-à-face à
    // l'écran — score du joueur, temps restant, score de l'adversaire.
    const scoreBar = room && room.state!=="lobby" && (room && room.bot ? (
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:14,padding:"10px 16px"}}>
        <div style={{textAlign:"center",flex:1,minWidth:0}}>
          <div style={{fontSize:11,color:"rgba(255,255,255,.55)",fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{myName||tr("Toi","You","Du","Tu","Você")}</div>
          <div style={{fontFamily:G.heading,fontSize:34,color:"#00E676",lineHeight:1}}>{myScore}</div>
        </div>
        <div style={{textAlign:"center",flexShrink:0}}>
          <div style={{fontSize:10,color:"rgba(255,255,255,.4)",fontWeight:800,letterSpacing:1}}>{tr("TEMPS","TIME","ZEIT","TEMPO","TEMPO")}</div>
          <div style={{fontFamily:G.heading,fontSize:24,color:(soloLeft!=null&&soloLeft<=10)?"#FF3D57":G.white}}>{soloLeft!=null?soloLeft+"s":"—"}</div>
        </div>
        <div style={{textAlign:"center",flex:1,minWidth:0}}>
          <div style={{fontSize:11,color:"rgba(255,255,255,.55)",fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{oppName||"—"}</div>
          <div style={{fontFamily:G.heading,fontSize:34,color:"#FF6B35",lineHeight:1}}>{oppScore}</div>
        </div>
      </div>
    ) : isSolo ? (
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:24,padding:"10px 16px"}}>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:10,color:"rgba(255,255,255,.5)",fontWeight:800,letterSpacing:1}}>{tr("SCORE","SCORE","SCORE","PUNTEGGIO","PONTUAÇÃO")}</div>
          <div style={{fontFamily:G.heading,fontSize:38,color:"#FFD600",lineHeight:1}}>{myScore}</div>
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:10,color:"rgba(255,255,255,.4)",fontWeight:800,letterSpacing:1}}>{tr("TEMPS","TIME","ZEIT","TEMPO","TEMPO")}</div>
          <div style={{fontFamily:G.heading,fontSize:24,color:(soloLeft!=null&&soloLeft<=10)?"#FF3D57":G.white}}>{soloLeft!=null?soloLeft+"s":"—"}</div>
        </div>
      </div>
    ) : (
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:14,padding:"10px 16px"}}>
        <div style={{textAlign:"center",flex:1}}>
          <div style={{fontSize:11,color:"rgba(255,255,255,.55)",fontWeight:700,letterSpacing:.5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{myName||tr("Toi","You","Du","Tu","Você")}</div>
          <div style={{fontFamily:G.heading,fontSize:34,color:"#00E676",lineHeight:1}}>{myScore}</div>
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:10,color:"rgba(255,255,255,.4)",fontWeight:800,letterSpacing:1}}>{tr("MANCHE","ROUND","RUNDE","TURNO","RODADA")}</div>
          <div style={{fontFamily:G.heading,fontSize:20,color:G.white}}>{room.round||1}/{DUEL_ROUNDS}</div>
        </div>
        <div style={{textAlign:"center",flex:1}}>
          <div style={{fontSize:11,color:"rgba(255,255,255,.55)",fontWeight:700,letterSpacing:.5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{oppName||tr("Adversaire","Opponent","Gegner","Avversario","Adversário")}</div>
          <div style={{fontFamily:G.heading,fontSize:34,color:"#FF6B35",lineHeight:1}}>{oppScore}</div>
        </div>
      </div>
    ));

    let body = null;
    if(duelScreen==="menu" || !room){
      // ── Lanceur style GOAT Plug : grand visuel + pastille + gros boutons ──
      const ac = "#FF8A2A", ac2 = "#FFC93C";
      body = (
        <div style={{position:"relative",width:"100%",minHeight:"100dvh",display:"flex",flexDirection:"column",animation:"fadeIn .3s ease-out"}}>
          {/* X fermer */}
          <button onClick={duelLeaveRoom} style={{position:"fixed",top:"calc(14px + env(safe-area-inset-top))",right:14,zIndex:10,width:38,height:38,borderRadius:"50%",background:"rgba(0,0,0,.65)",color:"#fff",border:"1px solid rgba(255,255,255,.25)",fontSize:22,fontWeight:300,lineHeight:1,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(10px)",boxShadow:"0 4px 16px rgba(0,0,0,.5)"}}>×</button>
          {/* Hero image (visuel entier) */}
          <div style={{position:"relative",width:"100%",height:"48vh",maxHeight:"520px",minHeight:"280px",overflow:"hidden",background:"#000",flexShrink:0}}>
            <img src={DUEL_CARD_IMG} alt="" style={{width:"100%",height:"100%",objectFit:"contain",pointerEvents:"none",userSelect:"none"}} draggable={false}/>
            <div style={{position:"absolute",bottom:0,left:0,right:0,height:50,background:"linear-gradient(to top, #0a0a0a 0%, transparent 100%)",pointerEvents:"none"}}/>
          </div>
          <div style={{position:"relative",zIndex:1,padding:"14px 22px calc(22px + env(safe-area-inset-bottom))",flex:1,display:"flex",flexDirection:"column",maxWidth:480,margin:"0 auto",width:"100%",boxSizing:"border-box"}}>
            {/* Pastille format */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,padding:"10px 16px",background:`${ac}12`,border:`1.5px solid ${ac}40`,borderRadius:12,marginBottom:18,backdropFilter:"blur(10px)",flexWrap:"wrap"}}>
              <span style={{color:ac,fontSize:13,fontWeight:800,letterSpacing:.5}}>⏱ <span style={{color:G.white}}>90 S</span></span>
              <span style={{color:ac,fontSize:14,fontWeight:800}}>·</span>
              <span style={{color:ac,fontSize:13,fontWeight:800,letterSpacing:.5}}>♾ <span style={{color:G.white}}>{tr("MANCHES","ROUNDS","RUNDEN","TURNI","RODADAS")}</span></span>
              <span style={{color:ac,fontSize:14,fontWeight:800}}>·</span>
              <span style={{color:ac,fontSize:13,fontWeight:800,letterSpacing:.5}}>🎯 <span style={{color:G.white}}>10/20 PTS</span></span>
            </div>
            {/* SOLO */}
            <div style={{fontSize:10,fontWeight:800,letterSpacing:3,textTransform:"uppercase",color:"rgba(255,255,255,.45)",marginBottom:8}}>{tr("Solo · score","Solo · score","Solo · Punkte","Solo · punti","Solo · pontos")}</div>
            <button onClick={duelSoloStart} style={{width:"100%",padding:"15px",marginBottom:18,...btn(G.projecteur,null,18),cursor:"pointer",fontFamily:G.font,fontSize:16,fontWeight:800,letterSpacing:1,boxShadow:`0 8px 24px ${ac}55`,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              ▶ {tr("JOUER SOLO","PLAY SOLO","SOLO SPIELEN","GIOCA SOLO","JOGAR SOLO")} <span style={{fontSize:12,fontWeight:700,opacity:.8}}>· 10/20 pts</span>
            </button>
            {/* EN LIGNE — bouton identique à celui de The Plug / The Mercato */}
            <div style={{fontSize:10,fontWeight:800,letterSpacing:3,textTransform:"uppercase",color:"rgba(255,255,255,.45)",marginBottom:8}}>{tr("En ligne","Online","Online","Online","Online")}</div>
            <button onClick={function(){ setDuelScreen(null); setMmSearch({ mode:"duel", opponent: pickOpponent(), phase:"searching" }); }}
              style={{width:"100%",marginBottom:18,padding:"14px 16px",borderRadius:16,border:"1.5px solid rgba(61,165,255,.6)",background:"linear-gradient(135deg,rgba(61,165,255,.22),rgba(61,165,255,.08))",cursor:"pointer",display:"flex",alignItems:"center",gap:12,textAlign:"left",boxShadow:"0 8px 24px -8px rgba(61,165,255,.5)"}}>
              <div style={{fontSize:26}}>🌍</div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:900,color:"#fff",letterSpacing:.5}}>{tr("EN LIGNE","ONLINE","ONLINE","ONLINE","ONLINE")}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.55)",marginTop:2}}>{tr("Affronte un adversaire · sans code","Face an opponent · no code","Tritt gegen einen Gegner an · ohne Code","Sfida un avversario · senza codice","Enfrente um adversário · sem código")}</div>
              </div>
              <div style={{fontSize:18,color:"#3DA5FF"}}>▶</div>
            </button>

            {/* Entre potes */}
            <div style={{fontSize:10,fontWeight:800,letterSpacing:3,textTransform:"uppercase",color:"rgba(255,255,255,.45)",marginBottom:8}}>{tr("Entre potes","With friends","Mit Freunden","Con gli amici","Com amigos")}</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={duelCreateRoom} disabled={duelBusy} style={{flex:1,padding:"14px",background:"rgba(0,230,118,.14)",color:"#00E676",border:"1px solid rgba(0,230,118,.4)",borderRadius:14,cursor:duelBusy?"default":"pointer",fontFamily:G.font,fontSize:13,fontWeight:800,letterSpacing:.5,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>👥 {tr("Créer un salon","Create room","Raum erstellen","Crea una stanza","Criar sala")}</button>
            </div>
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <input value={duelJoinCode} onChange={function(e){setDuelJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6));setDuelError("");}} placeholder={tr("CODE DU SALON","ROOM CODE","RAUMCODE","CODICE STANZA","CÓDIGO DA SALA")} maxLength={6}
                style={{flex:1,minWidth:0,padding:"13px",borderRadius:14,border:"1.5px solid rgba(255,255,255,.15)",background:"rgba(255,255,255,.05)",color:G.white,fontFamily:G.heading,fontSize:18,letterSpacing:4,textAlign:"center",outline:"none"}}/>
              <button onClick={function(){duelJoinRoom(duelJoinCode);}} disabled={duelBusy||duelJoinCode.length!==6} style={{padding:"0 20px",borderRadius:14,border:"none",background:duelJoinCode.length===6?"#FFD600":"rgba(255,255,255,.08)",color:duelJoinCode.length===6?"#000":"rgba(255,255,255,.3)",fontFamily:G.heading,fontSize:16,letterSpacing:1,cursor:duelJoinCode.length===6?"pointer":"not-allowed"}}>{tr("OK","JOIN","OK","OK","OK")}</button>
            </div>
            {duelError && <div style={{textAlign:"center",fontSize:13,color:"#FF6B6B",fontWeight:700,marginTop:12}}>{duelError}</div>}
          </div>
        </div>
      );
    } else if(duelScreen==="lobby"){
      const joined = !!room.guest_id;
      const lobbyPuce = [ {t:"8%",l:"10%",s:22,r:-16},{t:"16%",l:"84%",s:15,r:20},{t:"66%",l:"8%",s:26,r:12},{t:"76%",l:"86%",s:17,r:-24},{t:"46%",l:"5%",s:13,r:15} ];
      body = (
        <div style={{position:"relative",flex:1,minHeight:0,display:"flex",flexDirection:"column",overflowY:"auto",WebkitOverflowScrolling:"touch"}}>
          {/* Décor de fond */}
          <div style={{position:"absolute",inset:0,pointerEvents:"none",background:"radial-gradient(circle at 50% 20%, rgba(255,214,0,.15), transparent 52%), radial-gradient(circle at 50% 92%, rgba(0,230,118,.14), transparent 55%)"}}/>
          {lobbyPuce.map(function(f,i){return <div key={i} style={{position:"absolute",top:f.t,left:f.l,opacity:.12,transform:"rotate("+f.r+"deg)",pointerEvents:"none"}}><div style={{fontSize:f.s,animation:"floatBob 3s ease-in-out infinite",animationDelay:(i*0.5)+"s"}}>⚡</div></div>;})}
          <div style={{position:"relative",zIndex:1,flex:1,display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",gap:16,padding:"24px 22px calc(24px + env(safe-area-inset-bottom))",maxWidth:480,margin:"0 auto",width:"100%",boxSizing:"border-box"}}>
            <div style={{fontSize:11,letterSpacing:2.5,color:"rgba(255,255,255,.5)",fontWeight:800,textTransform:"uppercase"}}>{isHost?tr("Partage ce code","Share this code","Teile diesen Code","Condividi il codice","Compartilhe o código"):tr("Code du salon","Room code","Raumcode","Codice stanza","Código da sala")}</div>
            {/* Ticket code (tap pour partager / copier) */}
            <button onClick={function(){ duelShareCode(room.code); }} style={{position:"relative",width:"100%",maxWidth:340,background:"linear-gradient(160deg, rgba(255,214,0,.16), rgba(255,214,0,.04))",border:"1.5px solid rgba(255,214,0,.45)",borderRadius:22,padding:"22px 20px 18px",cursor:"pointer",boxShadow:"0 14px 40px -14px rgba(255,214,0,.45)"}}>
              <div style={{fontFamily:G.heading,fontSize:"clamp(40px,13vw,60px)",letterSpacing:"min(10px,2.5vw)",color:"#FFD600",lineHeight:1,textShadow:"0 0 26px rgba(255,214,0,.4)",whiteSpace:"nowrap"}}>{room.code}</div>
              <div style={{marginTop:14,display:"inline-flex",alignItems:"center",gap:7,background:"rgba(255,214,0,.16)",border:"1px solid rgba(255,214,0,.35)",borderRadius:50,padding:"8px 16px",color:"#FFD600",fontSize:13,fontWeight:800,letterSpacing:.5}}>
                {duelCodeCopied ? tr("✓ Copié !","✓ Copied!","✓ Kopiert!","✓ Copiato!","✓ Copiado!") : (navigator.share ? tr("📤 Partager","📤 Share","📤 Teilen","📤 Condividi","📤 Compartilhar") : tr("📋 Copier","📋 Copy","📋 Kopieren","📋 Copia","📋 Copiar"))}
              </div>
            </button>
            {/* État d'attente / adversaire */}
            <div style={{width:"100%",maxWidth:340,background:joined?"rgba(0,230,118,.12)":"rgba(255,255,255,.05)",border:"1px solid "+(joined?"rgba(0,230,118,.4)":"rgba(255,255,255,.1)"),borderRadius:16,padding:"14px 18px",textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
              {joined ? (
                <div style={{fontSize:14,fontWeight:800,color:"#00E676"}}>✓ {(room.guest_name||tr("Adversaire","Opponent","Gegner","Avversario","Adversário"))}{tr(" a rejoint !"," joined!"," ist beigetreten!"," è entrato!"," entrou!")}</div>
              ) : (<>
                <div style={{display:"flex",gap:4}}>
                  {[0,1,2].map(function(i){return <span key={i} style={{width:7,height:7,borderRadius:"50%",background:"#FFD600",animation:"floatBob 1s ease-in-out infinite",animationDelay:(i*0.18)+"s"}}/>;})}
                </div>
                <div style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,.6)"}}>{tr("En attente d'un adversaire…","Waiting for an opponent…","Warte auf einen Gegner…","In attesa di un avversario…","Aguardando um adversário…")}</div>
              </>)}
            </div>
            <div style={{width:"100%",maxWidth:340,display:"flex",flexDirection:"column",gap:10,marginTop:4}}>
              {isHost ? bigBtn(tr("DÉMARRER","START","STARTEN","AVVIA","COMEÇAR"), duelHostStart, "linear-gradient(135deg,#00E676,#00A855)", !joined)
                      : <div style={{fontSize:13,color:"rgba(255,255,255,.5)",textAlign:"center",padding:"6px"}}>{tr("En attente que l'hôte lance la partie…","Waiting for the host to start…","Warte, bis der Host startet…","In attesa che l'host avvii la partita…","Aguardando o anfitrião iniciar…")}</div>}
              <button onClick={duelLeaveRoom} style={{background:"none",border:"1px solid rgba(255,255,255,.15)",borderRadius:50,color:"rgba(255,255,255,.6)",padding:"12px 24px",cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:700}}>{tr("Quitter","Leave","Verlassen","Esci","Sair")}</button>
            </div>
          </div>
        </div>
      );
    } else if(duelScreen==="playing"){
      let phaseBody = null;
      if(room.phase==="countdown"){
        const cel = (duelNow||Date.now()) - (room.phase_at?new Date(room.phase_at).getTime():0);
        const cd = Math.max(1, 3 - Math.floor(cel/1000));
        phaseBody = (
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,padding:"20px"}}>
            <div style={{fontSize:14,color:"rgba(255,255,255,.5)",letterSpacing:3,textTransform:"uppercase"}}>{tr("Préparez-vous…","Get ready…","Macht euch bereit…","Preparatevi…","Preparem-se…")}</div>
            <div key={cd} style={{fontFamily:G.heading,fontSize:130,color:G.accent,lineHeight:1,animation:"popIn .3s ease"}}>{cd}</div>
          </div>
        );
      } else if(room.phase==="answer"){
        const answered = duelAnsweredRef.current || myAnsMs!=null;
        const duelSug = answered ? [] : ggGetSuggestions(duelInput);
        // Carte club grand format (empilée) — style GOAT Mercato bicolore.
        // `spinning` = pendant le tirage machine à sous (contenu qui défile).
        const compact = duelKbOpen; // clavier ouvert → cartes plus petites, côte à côte
        const clubCard = (club, spinning) => {
          const cc = getClubColors(club || "");
          return (
            <div style={{width:"100%",position:"relative",overflow:"hidden",height:compact?48:74,borderRadius:compact?12:16,boxShadow:"0 8px 24px "+cc[0]+"66",display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid rgba(255,255,255,.14)"}}>
              <div style={{position:"absolute",inset:0,background:cc[0]}}/>
              <div style={{position:"absolute",top:0,right:0,width:"55%",bottom:0,background:cc[1],clipPath:"polygon(30% 0%, 100% 0%, 100% 100%, 0% 100%)"}}/>
              <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.18)"}}/>
              <span key={(spinning?"s":"f")+club} style={{position:"relative",zIndex:1,fontFamily:G.heading,fontSize:compact?17:23,color:"#fff",fontWeight:800,textShadow:"0 2px 7px rgba(0,0,0,.65)",letterSpacing:.5,padding:"0 10px",textAlign:"center",lineHeight:1.05,filter:spinning?"blur(0.7px)":"none",animation:spinning?"duelReelBlur .1s linear infinite alternate":"duelSettle .5s cubic-bezier(.22,1,.36,1)"}}>{club}</span>
            </div>
          );
        };
        phaseBody = (
          <div style={{position:"relative",flex:1,display:"flex",flexDirection:"column",minHeight:0,padding:"6px 20px 16px",alignItems:"center"}}>
            {/* SOLO : points en flash flottant entre 2 manches (pas d'écran pause) */}
            {isSolo && duelFlash && (
              <div key={duelFlash.id} style={{position:"absolute",top:"38%",left:"50%",zIndex:20,pointerEvents:"none",fontFamily:G.heading,fontSize:duelFlash.pts>=20?46:36,letterSpacing:1,color:duelFlash.pts>=20?"#FFD600":duelFlash.pts>0?"#00E676":"#FF6B35",textShadow:"0 4px 20px rgba(0,0,0,.7)",animation:"duelFloat 1.3s ease-out forwards"}}>
                {duelFlash.pts>=20?"⚡ +20":duelFlash.pts>0?"+10":duelFlash.skipped?tr("PASSÉ","SKIP","ÜBERSPR.","SALTA","PULOU"):tr("RATÉ","MISS","VERPASST","MANCATO","ERROU")}{duelFlash.pts>0?" PTS":""}
              </div>
            )}
            {(function(){
              const big = isSolo ? (soloLeft!=null?soloLeft:0) : ansLeft;
              const danger = isSolo ? (soloLeft!=null&&soloLeft<=10) : ansLeft<=3;
              return <div style={{fontFamily:G.heading,fontSize:compact?28:44,color:danger?"#FF3D57":"#FFD600",lineHeight:1,marginBottom:compact?6:10}}>{big}{isSolo?<span style={{fontSize:compact?13:18,color:"rgba(255,255,255,.4)"}}>s</span>:null}</div>;
            })()}
            {/* Machine à sous : 2 clubs — empilés en grand, ou côte à côte (compact) si clavier ouvert */}
            <div style={{position:"relative",width:"100%",maxWidth:compact?360:300,marginBottom:compact?8:12}}>
              <div style={{display:"flex",flexDirection:compact?"row":"column",gap:compact?8:14}}>
                {clubCard(duelSpin?duelReel1:room.club_c1, duelSpin)}
                {clubCard(duelSpin?duelReel2:room.club_c2, duelSpin)}
              </div>
              <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",zIndex:5,width:compact?30:40,height:compact?30:40,borderRadius:"50%",background:"linear-gradient(135deg,#FFD600,#FF8A2A)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:G.heading,fontSize:compact?15:20,fontWeight:900,color:"#000",boxShadow:"0 4px 12px rgba(0,0,0,.5)",border:"3px solid #0E1F14"}}>×</div>
            </div>
            {duelSpin ? (
              <div style={{textAlign:"center",padding:"10px",fontSize:14,fontWeight:800,color:"#FFD600",letterSpacing:1}}>🎰 {tr("Tirage des clubs…","Drawing clubs…","Klubs werden gezogen…","Sorteggio dei club…","Sorteando os clubes…")}</div>
            ) : (<>
            {!compact && <div style={{fontSize:12,color:"rgba(255,255,255,.5)",marginBottom:12,textAlign:"center"}}>{tr("Un joueur ayant joué dans les DEUX clubs","A player who played for BOTH clubs","Ein Spieler, der für BEIDE Klubs gespielt hat","Un giocatore che ha giocato in ENTRAMBI i club","Um jogador que jogou nos DOIS clubes")}</div>}
            {answered ? (
              <div style={{textAlign:"center",padding:"18px"}}>
                <div style={{fontSize:22,fontWeight:900,color:"#00E676"}}>✅ {tr("Trouvé !","Found!","Gefunden!","Trovato!","Encontrado!")}</div>
                <div style={{fontSize:13,color:"rgba(255,255,255,.6)",marginTop:6}}>{tr("En attente de la fin de la manche…","Waiting for the round to end…","Warte auf das Rundenende…","In attesa della fine del turno…","Aguardando o fim da rodada…")}</div>
              </div>
            ) : (
              <div style={{width:"100%",maxWidth:420}}>
                <div style={{display:"flex",gap:8}}>
                  <input autoFocus value={duelInput} onChange={function(e){setDuelInput(e.target.value);if(duelWrong)setDuelWrong(false);}} onKeyDown={function(e){if(e.key==="Enter"){ if(duelSug.length>0){duelSubmitAnswer(duelSug[0].name);} else {duelSubmitAnswer();} }}} placeholder={tr("Nom du joueur…","Player name…","Spielername…","Nome del giocatore…","Nome do jogador…")}
                    style={{flex:1,minWidth:0,padding:"14px",borderRadius:14,border:"1.5px solid "+(duelWrong?"#FF3D57":"rgba(255,255,255,.15)"),background:duelWrong?"rgba(255,61,87,.14)":"rgba(255,255,255,.06)",color:G.white,fontFamily:G.font,fontSize:16,fontWeight:700,outline:"none",textAlign:"center",animation:duelWrong?"answerKo .4s ease":"none"}}/>
                  <button onClick={function(){ if(duelSug.length>0){duelSubmitAnswer(duelSug[0].name);} else {duelSubmitAnswer();} }} disabled={duelInput.trim().length<3} style={{padding:"0 20px",borderRadius:14,border:"none",background:duelInput.trim().length>=3?"#00E676":"rgba(255,255,255,.08)",color:duelInput.trim().length>=3?"#000":"rgba(255,255,255,.3)",fontFamily:G.heading,fontSize:16,cursor:duelInput.trim().length>=3?"pointer":"not-allowed"}}>OK</button>
                </div>
                {duelSug.length > 0 && (
                  <div style={{marginTop:8,background:"rgba(0,0,0,.35)",border:"1px solid rgba(255,255,255,.1)",borderRadius:12,overflow:"hidden"}}>
                    {duelSug.map(function(p){return(
                      <div key={p.name} onClick={function(){duelSubmitAnswer(p.name);}} style={{padding:"11px 14px",cursor:"pointer",borderBottom:"1px solid rgba(255,255,255,.05)",fontSize:14,fontWeight:700,color:G.white}}>{p.name}</div>
                    );})}
                  </div>
                )}
                {duelWrong && <div style={{textAlign:"center",fontSize:13,color:"#FF3D57",marginTop:10,fontWeight:800}}>❌ {tr("Mauvaise réponse, réessaie !","Wrong answer, try again!","Falsche Antwort, versuch's nochmal!","Risposta sbagliata, riprova!","Resposta errada, tente de novo!")}</div>}
                {isSolo ? (
                  <div style={{textAlign:"center",fontSize:12,color:ansLeft<=5&&ansLeft>0?"#FFD600":"rgba(255,255,255,.4)",marginTop:duelWrong?4:10,fontWeight:700}}>{ansLeft>5?tr("Réponds en moins de 5 s = 20 pts ⚡","Answer under 5s = 20 pts ⚡","Unter 5 Sek. antworten = 20 Pkt ⚡","Rispondi in meno di 5 s = 20 pti ⚡","Responda em menos de 5 s = 20 pts ⚡"):tr("⚡ Vite ! 20 pts","⚡ Quick! 20 pts","⚡ Schnell! 20 Pkt","⚡ Veloce! 20 pti","⚡ Rápido! 20 pts")}</div>
                ) : (
                  <div style={{textAlign:"center",fontSize:12,color:oppAnsMs!=null?"#FF6B35":"rgba(255,255,255,.4)",marginTop:duelWrong?4:10,fontWeight:700}}>{oppAnsMs!=null?tr("⚡ L'adversaire a trouvé !","⚡ Opponent found it!","⚡ Gegner hat's gefunden!","⚡ L'avversario ha trovato!","⚡ O adversário encontrou!"):tr("L'adversaire cherche…","Opponent is searching…","Gegner sucht…","L'avversario sta cercando…","O adversário está procurando…")}</div>
                )}
                {isSolo && (
                  <button onClick={duelSkip} style={{width:"100%",marginTop:12,padding:"12px",borderRadius:14,border:"1px solid rgba(255,255,255,.15)",background:"rgba(255,255,255,.05)",color:"rgba(255,255,255,.6)",fontFamily:G.font,fontSize:13,fontWeight:700,cursor:"pointer"}}>⏭ {tr("Passer (je ne sais pas)","Skip (I don't know)","Überspringen (weiß nicht)","Salta (non lo so)","Pular (não sei)")}</button>
                )}
              </div>
            )}
            </>)}
          </div>
        );
      } else if(room.phase==="result"){
        const rw = room.round_winner;
        const iWon = (rw==="host"&&isHost)||(rw==="guest"&&!isHost);
        const draw = rw==="draw" || !rw;
        const common = duelCommonPlayers(room.club_c1, room.club_c2);
        const example = common && common.length ? common[0] : null;
        const myAns = isHost ? room.host_answer : room.guest_answer;
        const oppAns = isHost ? room.guest_answer : room.host_answer;
        const pts = room.round_pts; // solo
        phaseBody = isSolo ? (
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",padding:"20px",gap:10}}>
            <div style={{fontFamily:G.heading,fontSize:pts>0?46:30,letterSpacing:1,color:pts>=20?"#FFD600":pts>0?"#00E676":"#FF6B35",textAlign:"center"}}>
              {pts>=20 ? (tr("⚡ +20 PTS","⚡ +20 PTS","⚡ +20 PTS","⚡ +20 PTS","⚡ +20 PTS")) : pts>0 ? "+10 PTS" : room.round_skipped ? (tr("PASSÉ","SKIPPED","ÜBERSPRUNGEN","SALTATO","PULADO")) : (tr("RATÉ","MISSED","VERPASST","MANCATO","ERROU"))}
            </div>
            <div style={{fontSize:14,color:"rgba(255,255,255,.7)",textAlign:"center"}}>{room.club_c1} <span style={{color:"#FFD600"}}>×</span> {room.club_c2}</div>
            {pts>0 && myAns
              ? <div style={{fontSize:14,color:"#00E676",textAlign:"center",fontWeight:700}}>✅ <strong style={{color:"#fff"}}>{myAns}</strong></div>
              : (example && <div style={{fontSize:13,color:"rgba(255,255,255,.6)",textAlign:"center"}}>{tr("Une réponse valable : ","A valid answer: ","Eine gültige Antwort: ","Una risposta valida: ","Uma resposta válida: ")}<strong style={{color:G.white}}>{example}</strong></div>)}
            <div style={{fontSize:11,color:"rgba(255,255,255,.5)",fontWeight:800,letterSpacing:1,marginTop:2}}>{tr("TOTAL","TOTAL","GESAMT","TOTALE","TOTAL")}</div>
            <div style={{fontFamily:G.heading,fontSize:40,color:"#FFD600",marginTop:-4}}>{myScore} pts</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.4)"}}>{(room.round||1)<DUEL_ROUNDS?(tr("Manche suivante…","Next round…","Nächste Runde…","Prossimo round…","Próxima rodada…")):(tr("Fin…","Final…","Ende…","Fine…","Fim…"))}</div>
          </div>
        ) : (
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",padding:"20px",gap:10}}>
            <div style={{fontFamily:G.heading,fontSize:30,letterSpacing:1,color:draw?"#FFD600":iWon?"#00E676":"#FF6B35",textAlign:"center"}}>
              {draw ? tr("MANCHE NULLE","DRAW — nobody found","UNENTSCHIEDEN","PAREGGIO","EMPATE") : iWon ? tr("🎉 TU GAGNES LA MANCHE","🎉 YOU WIN THE ROUND","🎉 DU GEWINNST DIE RUNDE","🎉 VINCI IL TURNO","🎉 VOCÊ VENCE A RODADA") : tr("L'ADVERSAIRE GAGNE","OPPONENT WINS","GEGNER GEWINNT","VINCE L'AVVERSARIO","O ADVERSÁRIO VENCE")}
            </div>
            <div style={{fontSize:14,color:"rgba(255,255,255,.7)",textAlign:"center"}}>{room.club_c1} <span style={{color:"#FFD600"}}>×</span> {room.club_c2}</div>
            {/* Qui a répondu quoi */}
            {iWon && myAns && (
              <div style={{fontSize:14,color:"#00E676",textAlign:"center",fontWeight:700}}>✅ {tr("Ta réponse : ","You answered ","Deine Antwort: ","La tua risposta: ","Sua resposta: ")}<strong style={{color:"#fff"}}>{myAns}</strong></div>
            )}
            {!iWon && !draw && oppAns && (
              <div style={{fontSize:14,color:"#FF8A66",textAlign:"center",fontWeight:700}}>{oppName||tr("Adversaire","Opponent","Gegner","Avversario","Adversário")} : <strong style={{color:"#fff"}}>{oppAns}</strong></div>
            )}
            {draw && example && (
              <div style={{fontSize:13,color:"rgba(255,255,255,.6)",textAlign:"center"}}>{tr("Une réponse valable : ","A valid answer: ","Eine gültige Antwort: ","Una risposta valida: ","Uma resposta válida: ")}<strong style={{color:G.white}}>{example}</strong></div>
            )}
            <div style={{fontFamily:G.heading,fontSize:40,color:G.white,marginTop:4}}>{myScore} <span style={{color:"rgba(255,255,255,.3)"}}>–</span> {oppScore}</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.4)"}}>{(room.round||1)<DUEL_ROUNDS?tr("Manche suivante…","Next round…","Nächste Runde…","Prossimo turno…","Próxima rodada…"):tr("Fin…","Final…","Ende…","Fine…","Fim…")}</div>
          </div>
        );
      }
      body = (<><div style={{borderBottom:"1px solid rgba(255,255,255,.08)"}}>{scoreBar}</div>{phaseBody}</>);
    } else if(duelScreen==="finished"){
      const iWon = room.winner_id && room.winner_id===playerId;
      const draw = !room.winner_id;
      if(room.solo){
        // SOLO : 60 s, manches illimitées. Score = total de points. Message selon le score.
        const sc = myScore||0;
        const correct = room.host_correct||0, fast = room.host_fast||0, rounds = room.host_rounds||0;
        const msg = sc>=150 ? tr("LÉGENDE ! 🐐","LEGEND! 🐐","LEGENDE! 🐐","LEGGENDA! 🐐","LENDA! 🐐") : sc>=100 ? tr("BIEN JOUÉ !","GREAT!","GUT GEMACHT!","BRAVO!","MANDOU BEM!") : sc>=50 ? tr("PAS MAL","NOT BAD","NICHT SCHLECHT","NIENTE MALE","NADA MAL") : tr("CONTINUE À T'ENTRAÎNER","KEEP TRYING","WEITER ÜBEN","CONTINUA AD ALLENARTI","CONTINUE TREINANDO");
        const accent = sc>=100 ? "#FFD600" : "#00E676";
        const tiles = [
          { v: correct, e:"✅", c:"#00E676", l: tr("bonnes rép.","correct","richtig","giuste","certas") },
          { v: fast,    e:"⚡", c:"#FFD600", l: tr("éclairs","under 5s","Blitz","lampi","raios") },
          { v: rounds,  e:"🎯", c:"#3DA5FF", l: tr("manches","rounds","Runden","turni","rodadas") },
        ];
        const puce = [ {t:"6%",l:"10%",s:24,r:-18},{t:"14%",l:"84%",s:16,r:22},{t:"64%",l:"8%",s:28,r:12},{t:"74%",l:"86%",s:18,r:-26},{t:"40%",l:"4%",s:14,r:16},{t:"52%",l:"92%",s:20,r:-12} ];
        body = (
          <div style={{position:"relative",flex:1,minHeight:0,display:"flex",flexDirection:"column",overflowY:"auto",WebkitOverflowScrolling:"touch"}}>
            {/* Décor de fond : halos + éclairs flottants */}
            <div style={{position:"absolute",inset:0,pointerEvents:"none",background:"radial-gradient(circle at 50% 24%, rgba(255,214,0,.20), transparent 52%), radial-gradient(circle at 50% 90%, rgba(0,230,118,.16), transparent 55%)"}}/>
            {puce.map(function(f,i){return <div key={i} style={{position:"absolute",top:f.t,left:f.l,opacity:.13,transform:"rotate("+f.r+"deg)",pointerEvents:"none"}}><div style={{fontSize:f.s,animation:"floatBob 3s ease-in-out infinite",animationDelay:(i*0.45)+"s"}}>⚡</div></div>;})}
            <div style={{position:"relative",zIndex:1,flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"20px 24px calc(20px + env(safe-area-inset-bottom))",gap:12,maxWidth:480,margin:"0 auto",width:"100%",boxSizing:"border-box"}}>
              {/* Hero + anneau lumineux */}
              <div style={{position:"relative",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <div style={{position:"absolute",width:"min(260px,60vw)",height:"min(260px,60vw)",borderRadius:"50%",background:"radial-gradient(circle, "+accent+"33, transparent 66%)",filter:"blur(4px)"}}/>
                <div style={{position:"relative",width:"100%"}}><WinBanner maxWidth={360} marginTop={0} lose={!(iWon||draw)} /></div>
              </div>
              {room.bot ? (
                /* Partie rapide : on affiche le résultat ET les deux scores —
                   sans ça l'écran de fin ne disait pas qui avait gagné. */
                <>
                  <div style={{fontFamily:G.heading,fontSize:30,letterSpacing:1,textAlign:"center",color:draw?"#FFD600":iWon?"#00E676":"#FF6B35"}}>
                    {draw?tr("ÉGALITÉ !","DRAW!","UNENTSCHIEDEN!","PAREGGIO!","EMPATE!"):iWon?tr("VICTOIRE !","VICTORY!","SIEG!","VITTORIA!","VITÓRIA!"):tr("DÉFAITE","DEFEAT","NIEDERLAGE","SCONFITTA","DERROTA")}
                  </div>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:14,width:"100%",marginTop:2}}>
                    <div style={{textAlign:"center",flex:1,minWidth:0}}>
                      <div style={{fontSize:11,color:"rgba(255,255,255,.55)",fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{room.host_name||tr("Toi","You","Du","Tu","Você")}</div>
                      <div style={{fontFamily:G.heading,fontSize:46,color:"#00E676",lineHeight:1}}>{myScore||0}</div>
                    </div>
                    <div style={{fontFamily:G.heading,fontSize:22,color:"rgba(255,255,255,.35)",flexShrink:0}}>VS</div>
                    <div style={{textAlign:"center",flex:1,minWidth:0}}>
                      <div style={{fontSize:11,color:"rgba(255,255,255,.55)",fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{room.guest_name||"—"} {room.guest_country||""}</div>
                      <div style={{fontFamily:G.heading,fontSize:46,color:"#FF6B35",lineHeight:1}}>{oppScore||0}</div>
                    </div>
                  </div>
                </>
              ) : (
              <>
              <div style={{fontSize:11,color:"rgba(255,255,255,.5)",fontWeight:800,letterSpacing:3}}>{tr("TON SCORE","YOUR SCORE","DEIN SCORE","IL TUO PUNTEGGIO","SUA PONTUAÇÃO")}</div>
              <div style={{fontFamily:G.heading,fontSize:72,color:"#FFD600",lineHeight:.9,textShadow:"0 0 30px rgba(255,214,0,.4)"}}>{sc}<span style={{fontSize:26,color:"rgba(255,255,255,.4)"}}> pts</span></div>
              <div style={{fontFamily:G.heading,fontSize:26,letterSpacing:1,color:accent,textAlign:"center"}}>{msg}</div>
              </>
              )}
              {/* Tuiles de stats */}
              <div style={{display:"flex",gap:10,width:"100%",marginTop:4}}>
                {tiles.map(function(t,i){return(
                  <div key={i} style={{flex:1,background:"rgba(255,255,255,.05)",border:"1px solid "+t.c+"33",borderRadius:16,padding:"12px 4px",textAlign:"center"}}>
                    <div style={{fontSize:15}}>{t.e}</div>
                    <div style={{fontFamily:G.heading,fontSize:26,color:t.c,lineHeight:1.15}}>{t.v}</div>
                    <div style={{fontSize:9.5,letterSpacing:.5,color:"rgba(255,255,255,.5)",fontWeight:800,textTransform:"uppercase",marginTop:2}}>{t.l}</div>
                  </div>
                );})}
              </div>
              {/* Boutons */}
              <div style={{display:"flex",gap:10,width:"100%",marginTop:12}}>
                <button onClick={function(){ if(room.bot) duelQuickStart({ pseudo:room.guest_name, country:room.guest_country, avatar:room.guest_avatar }); else duelSoloStart(); }} style={{flex:1,padding:"16px",borderRadius:16,border:"none",background:"linear-gradient(135deg,#3DA5FF,#00E676)",color:"#000",fontFamily:G.heading,fontSize:16,letterSpacing:1,cursor:"pointer",boxShadow:"0 10px 26px -10px rgba(0,230,118,.6)"}}>{tr("↻ REJOUER","↻ AGAIN","↻ NOCHMAL","↻ RIGIOCA","↻ JOGAR DE NOVO")}</button>
                <button onClick={duelLeaveRoom} style={{flex:1,padding:"16px",borderRadius:16,border:"1px solid rgba(255,255,255,.15)",background:"rgba(255,255,255,.05)",color:G.white,fontFamily:G.heading,fontSize:16,letterSpacing:1,cursor:"pointer"}}>{tr("MENU","MENU","MENÜ","MENU","MENU")}</button>
              </div>
            </div>
          </div>
        );
      } else {
      body = (
        <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",padding:"24px",gap:16,maxWidth:480,margin:"0 auto",width:"100%"}}>
          <div style={{position:"relative",marginBottom:4}}>
            <WinBanner maxWidth={360} marginTop={0} lose={!(iWon||draw)} />
            <div style={{position:"absolute",bottom:-6,left:"50%",transform:"translateX(-50%)",fontSize:40}}>{draw?"🤝":iWon?"🏆":""}</div>
          </div>
          <div style={{fontFamily:G.heading,fontSize:34,letterSpacing:1,color:draw?"#FFD600":iWon?"#00E676":"#FF6B35",textAlign:"center"}}>
            {draw?tr("ÉGALITÉ !","DRAW!","UNENTSCHIEDEN!","PAREGGIO!","EMPATE!"):iWon?tr("VICTOIRE !","VICTORY!","SIEG!","VITTORIA!","VITÓRIA!"):tr("DÉFAITE","DEFEAT","NIEDERLAGE","SCONFITTA","DERROTA")}
          </div>
          <div style={{fontFamily:G.heading,fontSize:52,color:G.white}}>{myScore} <span style={{color:"rgba(255,255,255,.3)"}}>–</span> {oppScore}</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,.55)",textAlign:"center"}}>{(myName||tr("Toi","You","Du","Tu","Você"))+" vs "+(oppName||tr("Adversaire","Opponent","Gegner","Avversario","Adversário"))}</div>
          {bigBtn(tr("RETOUR À L'ACCUEIL","BACK TO MENU","ZURÜCK ZUM MENÜ","TORNA AL MENU","VOLTAR AO MENU"), duelLeaveRoom, "linear-gradient(135deg,#00E676,#00A855)", false)}
        </div>
      );
      }
    }
    // Clavier ouvert : on cale l'overlay EXACTEMENT sur la zone visible (au-dessus du
    // clavier) → plus rien à faire défiler, les 2 clubs restent visibles.
    const kbFit = duelKbOpen && duelScreen==="playing" && duelVV;
    const overlayStyle = { ...shell2, overflowY: duelScreen==="menu"?"auto":(kbFit?"hidden":"visible") };
    if (kbFit) { overlayStyle.top = duelVV.top; overlayStyle.height = duelVV.height; overlayStyle.bottom = "auto"; }
    return (<div key="duel-overlay" style={overlayStyle}>
      {duelScreen!=="menu" && !kbFit && header}
      {body}
      {/* Nom du joueur en GROS à chaque bonne réponse (visible pour une vidéo) */}
      {duelBigAnswer && (
        <div style={{position:"absolute",inset:0,zIndex:60,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none",background:"radial-gradient(circle at 50% 46%, rgba(0,0,0,.55), transparent 62%)"}}>
          <div key={duelBigAnswer.name} style={{textAlign:"center",padding:"0 22px",animation:"bigAnswerPop 1.2s ease-out forwards"}}>
            <div style={{fontSize:13,fontWeight:900,letterSpacing:3,color:"#00E676"}}>✓ {tr("BONNE RÉPONSE","CORRECT!","RICHTIG!","GIUSTO!","CERTO!")}</div>
            <div style={{fontFamily:G.heading,fontSize:"clamp(34px,9vw,56px)",color:"#fff",textShadow:"0 4px 24px rgba(0,0,0,.85)",lineHeight:1.05,marginTop:8}}>{duelBigAnswer.name}</div>
            {duelBigAnswer.pts && <div style={{fontFamily:G.heading,fontSize:"clamp(24px,7vw,40px)",color:duelBigAnswer.pts>=20?"#FFD600":"#00E676",textShadow:"0 3px 16px rgba(0,0,0,.8)",marginTop:8}}>{duelBigAnswer.pts>=20?"⚡ ":""}+{duelBigAnswer.pts} PTS</div>}
          </div>
        </div>
      )}
    </div>);
  })();

  // ── SALON DES DÉFIS OUVERTS ──
  const openDuelsModal = showOpenDuels && (
    <div key="open-duels" onClick={function(){closeOpenDuels();}} style={{position:"fixed",inset:0,zIndex:10000,background:"rgba(0,0,0,.85)",backdropFilter:"blur(10px)",display:"flex",alignItems:"flex-end",justifyContent:"center",animation:"fadeIn .2s ease"}}>
      <div onClick={function(e){e.stopPropagation();}} style={{width:"100%",maxWidth:520,maxHeight:"85vh",overflowY:"auto",background:"linear-gradient(180deg,#132819 0%,#0A160E 100%)",borderRadius:"24px 24px 0 0",border:"1px solid rgba(255,255,255,.1)",padding:"20px 16px calc(24px + env(safe-area-inset-bottom))",animation:"sheetUp .3s ease"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <div style={{fontFamily:G.heading,fontSize:24,color:G.white,letterSpacing:1}}>⚔️ {tr("DÉFIS OUVERTS","OPEN CHALLENGES","OFFENE HERAUSFORDERUNGEN","SFIDE APERTE","DESAFIOS ABERTOS")}</div>
          <button onClick={function(){closeOpenDuels();}} style={{width:34,height:34,borderRadius:"50%",background:"rgba(255,255,255,.1)",border:"none",color:G.white,fontSize:16,cursor:"pointer",flexShrink:0}}>✕</button>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:14}}>
          <button onClick={function(){setOpenTab("browse");}} style={{flex:1,padding:"9px",borderRadius:12,border:"none",background:openTab==="browse"?G.accent:"rgba(255,255,255,.06)",color:openTab==="browse"?"#000":G.white,fontFamily:G.font,fontSize:13,fontWeight:800,cursor:"pointer"}}>{tr("Parcourir","Browse","Durchsuchen","Sfoglia","Explorar")}</button>
          <button onClick={function(){setOpenTab("recus");loadReceivedChallenges();}} style={{position:"relative",flex:1,padding:"9px",borderRadius:12,border:"none",background:openTab==="recus"?G.accent:"rgba(255,255,255,.07)",color:openTab==="recus"?"#000":G.white,fontFamily:G.font,fontSize:12,fontWeight:800,letterSpacing:.5,cursor:"pointer"}}>{tr("Reçus","Received","Erhalten","Ricevute","Recebidos")}{receivedChallenges.length>0&&<span style={{position:"absolute",top:-5,right:-5,background:"#FF3D57",color:"#fff",borderRadius:"50%",minWidth:18,height:18,padding:"0 5px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900}}>{receivedChallenges.length}</span>}</button>
          <button onClick={function(){setOpenTab("mine");markOpenAttemptsSeen();loadDuels();}} style={{position:"relative",flex:1,padding:"9px",borderRadius:12,border:"none",background:openTab==="mine"?G.accent:"rgba(255,255,255,.06)",color:openTab==="mine"?"#000":G.white,fontFamily:G.font,fontSize:13,fontWeight:800,cursor:"pointer"}}>{tr("Mes défis","My challenges","Meine Herausforderungen","Le mie sfide","Meus desafios")}{openUnseenCount>0&&<span style={{position:"absolute",top:-5,right:-5,background:"#FF3D57",color:"#fff",borderRadius:"50%",minWidth:16,height:16,padding:"0 4px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900}}>{openUnseenCount}</span>}</button>
        </div>
        {openTab==="recus" ? (
          <div>
            <div style={{fontSize:12,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.45)",marginBottom:8}}>{tr("On t'a défié","You've been challenged","Du wurdest herausgefordert","Ti hanno sfidato","Você foi desafiado")}</div>
            {receivedChallenges.length===0 ? (
              <div style={{textAlign:"center",padding:"16px",color:"rgba(255,255,255,.4)",fontSize:13}}>{tr("Aucun défi reçu pour l'instant.","No challenge received yet.","Noch keine Herausforderung erhalten.","Nessuna sfida ricevuta.","Nenhum desafio recebido.")}</div>
            ) : receivedChallenges.map(function(d){
              const modeLabel = d.mode === "chaine" ? "The Mercato" : "The Plug";
              return (
                <div key={d.id} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 12px",marginBottom:8,background:"rgba(255,138,42,.10)",border:"1px solid rgba(255,138,42,.35)",borderRadius:14}}>
                  <div style={{fontSize:20}}>⚔️</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:800,color:G.white,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.challenger_name}</div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginTop:1}}>{modeLabel} · {d.diff} · {d.challenger_score} pts {tr("à battre","to beat","zu schlagen","da battere","para bater")}</div>
                  </div>
                  <button onClick={function(){playOpenDuel(d,"accept");}} style={{flexShrink:0,padding:"9px 14px",background:"#FF8A2A",color:"#000",border:"none",borderRadius:12,cursor:"pointer",fontFamily:G.font,fontSize:12,fontWeight:800}}>{tr("Relever","Take it","Annehmen","Accetta","Aceitar")}</button>
                </div>
              );
            })}
          </div>
        ) : openTab==="mine" ? (
          <div>
            <div style={{fontSize:12,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.45)",marginBottom:8}}>{tr("Tentatives reçues","Attempts received","Erhaltene Versuche","Tentativi ricevuti","Tentativas recebidas")}</div>
            {myOpenAttempts.length===0 ? (
              <div style={{textAlign:"center",padding:"16px",color:"rgba(255,255,255,.4)",fontSize:13}}>{tr("Aucune tentative pour l'instant.","No attempt yet.","Noch keine Versuche.","Ancora nessun tentativo.","Nenhuma tentativa ainda.")}</div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:18}}>
                {myOpenAttempts.map(function(a){ const iWon=(a.challenger_score||0)>=(a.opponent_score||0); return(
                  <div key={a.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:12}}>
                    <div style={{width:4,height:30,borderRadius:2,background:iWon?"#00E676":"#FF3D57",flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:800,color:G.white,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>@{a.opponent_name||"?"}</div>
                      <div style={{fontSize:10,color:"rgba(255,255,255,.45)"}}>{a.mode==="pont"?"The Plug":"The Mercato"} · {a.diff==="facile"?(tr("Facile","Easy","Leicht","Facile","Fácil")):a.diff==="moyen"?(tr("Moyen","Medium","Mittel","Medio","Médio")):"Expert"}</div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div style={{fontFamily:G.heading,fontSize:15,color:G.white}}>{a.opponent_score}<span style={{color:"rgba(255,255,255,.35)"}}> / {a.challenger_score}</span></div>
                      <div style={{fontSize:9,fontWeight:800,letterSpacing:1,textTransform:"uppercase",color:iWon?"#00E676":"#FF3D57"}}>{iWon?(tr("Tu résistes ✓","You held ✓","Gehalten ✓","Hai resistito ✓","Você resistiu ✓")):(tr("Battu","Beaten","Geschlagen","Battuto","Batido"))}</div>
                    </div>
                  </div>
                );})}
              </div>
            )}
            <div style={{fontSize:12,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.45)",marginBottom:8}}>{tr("Tes défis en cours","Your open challenges","Deine offenen Herausforderungen","Le tue sfide in corso","Seus desafios em aberto")}</div>
            {myOpenChallenges.length===0 ? (
              <div style={{textAlign:"center",padding:"16px",color:"rgba(255,255,255,.4)",fontSize:13}}>{tr("Tu n'as aucun défi ouvert. Lance-en un !","You have no open challenge. Post one!","Du hast keine offene Herausforderung. Poste eine!","Non hai sfide aperte. Lanciane una!","Você não tem desafios abertos. Lance um!")}</div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {myOpenChallenges.map(function(c){ const nb=myOpenAttempts.filter(function(a){return a.mode===c.mode&&a.diff===c.diff&&a.challenger_score===c.challenger_score;}).length; return(
                  <div key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:12}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:800,color:G.white}}>{c.mode==="pont"?"The Plug":"The Mercato"} · {c.diff==="facile"?(tr("Facile","Easy","Leicht","Facile","Fácil")):c.diff==="moyen"?(tr("Moyen","Medium","Mittel","Medio","Médio")):"Expert"}</div>
                      <div style={{fontSize:10,color:"rgba(255,255,255,.45)"}}>{nb} {nb!==1?tr("tentatives","attempts","Versuche","tentativi","tentativas"):tr("tentative","attempt","Versuch","tentativo","tentativa")}</div>
                    </div>
                    <div style={{textAlign:"right"}}><div style={{fontFamily:G.heading,fontSize:18,color:G.gold}}>{c.challenger_score}</div><div style={{fontSize:9,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:1}}>{tr("à battre","to beat","zu schlagen","da battere","a bater")}</div></div>
                  </div>
                );})}
              </div>
            )}
            {/* Défis terminés (historique gagné/perdu) */}
            {(function(){
              const done = (duels||[]).filter(function(d){ return d.status==="complete" && (d.challenger_id===playerId || d.opponent_id===playerId); });
              let w=0,l=0,dr=0;
              const rws = done.map(function(d){
                const isChal=d.challenger_id===playerId;
                const my=isChal?(d.challenger_score||0):(d.opponent_score||0);
                const opp=isChal?(d.opponent_score||0):(d.challenger_score||0);
                const res=my>opp?"win":my<opp?"loss":"draw";
                if(res==="win")w++;else if(res==="loss")l++;else dr++;
                return {id:d.id,oppName:(isChal?d.opponent_name:d.challenger_name)||"?",my:my,opp:opp,res:res,mode:d.mode};
              });
              return (
                <div style={{marginTop:18}}>
                  <div style={{fontSize:12,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.45)",marginBottom:8}}>{tr("Tes défis terminés","Your finished duels","Deine beendeten Duelle","I tuoi duelli finiti","Seus duelos terminados")}</div>
                  {rws.length===0 ? (
                    <div style={{textAlign:"center",padding:"14px",color:"rgba(255,255,255,.4)",fontSize:13}}>{tr("Aucun défi terminé pour l'instant.","No finished duel yet.","Noch keine beendeten Duelle.","Ancora nessun duello finito.","Nenhum duelo terminado ainda.")}</div>
                  ) : (
                    <>
                      <div style={{display:"flex",gap:12,justifyContent:"center",marginBottom:10,fontSize:12,fontWeight:800}}>
                        <span style={{color:"#00E676"}}>✅ {w}</span>
                        <span style={{color:"#FFD600"}}>➖ {dr}</span>
                        <span style={{color:"#FF3D57"}}>❌ {l}</span>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:6}}>
                        {rws.slice(0,20).map(function(r){
                          const col=r.res==="win"?"#00E676":r.res==="loss"?"#FF3D57":"#FFD600";
                          const lbl=r.res==="win"?(tr("GAGNÉ","WON","GEWONNEN","VINTO","VENCEU")):r.res==="loss"?(tr("PERDU","LOST","VERLOREN","PERSO","PERDEU")):(tr("NUL","DRAW","UNENTSCHIEDEN","PARI","EMPATE"));
                          return (
                            <div key={r.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"rgba(255,255,255,.04)",borderLeft:"3px solid "+col,borderRadius:10}}>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:13,fontWeight:800,color:G.white,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>vs {r.oppName}</div>
                                <div style={{fontSize:10,color:"rgba(255,255,255,.4)"}}>{r.mode==="pont"?"The Plug":r.mode==="chaine"?"The Mercato":r.mode==="grid"?"GOAT Grid":r.mode}</div>
                              </div>
                              <div style={{fontFamily:G.heading,fontSize:16,color:G.white}}>{r.my}<span style={{color:"rgba(255,255,255,.3)",margin:"0 2px"}}>–</span>{r.opp}</div>
                              <div style={{fontSize:9,fontWeight:900,letterSpacing:1,color:col,background:col+"1a",border:"1px solid "+col+"55",borderRadius:20,padding:"3px 8px",minWidth:48,textAlign:"center"}}>{lbl}</div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        ) : openDuelChooser ? (
          <div>
            <div style={{fontSize:12,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.45)",marginBottom:8}}>{tr("Jeu","Game","Spiel","Gioco","Jogo")}</div>
            <div style={{display:"flex",gap:10,marginBottom:16}}>
              {[{k:"chaine",l:"The Mercato",tag:tr("La chaîne sans fin","The endless chain","Die endlose Kette","La catena infinita","A corrente sem fim"),img:"/mercato-card.png",ac:"#FF8A2A"},{k:"pont",l:"The Plug",tag:tr("Le pont entre deux clubs","The bridge between two clubs","Die Brücke zwischen zwei Klubs","Il ponte tra due club","A ponte entre dois clubes"),img:"/plug-card.png",ac:"#00E676"}].map(function(m){var on=duelMode===m.k;return(
                <button key={m.k} onClick={function(){setDuelMode(m.k);}} style={{flex:1,position:"relative",padding:0,borderRadius:18,overflow:"hidden",border:"2px solid "+(on?m.ac:"rgba(255,255,255,.12)"),background:"rgba(255,255,255,.03)",cursor:"pointer",boxShadow:on?("0 10px 26px -12px "+m.ac):"none",transition:"all .15s"}}>
                  <div style={{position:"relative",height:92,overflow:"hidden"}}>
                    <img src={m.img} alt={m.l} style={{width:"100%",height:"100%",objectFit:"cover",display:"block",opacity:on?1:0.55}}/>
                    <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,.65) 100%)"}}/>
                    {on&&<div style={{position:"absolute",top:6,right:6,width:22,height:22,borderRadius:"50%",background:m.ac,color:"#000",fontSize:13,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 8px rgba(0,0,0,.4)"}}>✓</div>}
                  </div>
                  <div style={{padding:"8px 8px 10px",textAlign:"left"}}>
                    <div style={{fontFamily:G.heading,fontSize:17,letterSpacing:1,lineHeight:1,color:on?m.ac:G.white}}>{m.l}</div>
                    <div style={{fontSize:9.5,color:"rgba(255,255,255,.5)",marginTop:3,fontWeight:600}}>{m.tag}</div>
                  </div>
                </button>
              );})}
            </div>
            <div style={{fontSize:12,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.45)",marginBottom:8}}>{tr("Difficulté","Difficulty","Schwierigkeit","Difficoltà","Dificuldade")}</div>
            <div style={{display:"flex",gap:8,marginBottom:20}}>
              {[{k:"facile",l:tr("Facile","Easy","Leicht","Facile","Fácil")},{k:"moyen",l:tr("Moyen","Medium","Mittel","Medio","Médio")},{k:"expert",l:"Expert"}].map(function(dd){return(
                <button key={dd.k} onClick={function(){setDuelDiff(dd.k);}} style={{flex:1,padding:"12px",borderRadius:14,border:"2px solid "+(duelDiff===dd.k?G.gold:"rgba(255,255,255,.12)"),background:duelDiff===dd.k?"rgba(255,214,0,.12)":"rgba(255,255,255,.04)",color:G.white,fontFamily:G.font,fontSize:13,fontWeight:800,cursor:"pointer"}}>{dd.l}</button>
              );})}
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={function(){setOpenDuelChooser(false);}} style={{flex:1,padding:14,borderRadius:50,border:"1px solid rgba(255,255,255,.15)",background:"rgba(255,255,255,.06)",color:G.white,fontFamily:G.font,fontSize:14,fontWeight:700,cursor:"pointer"}}>{tr("Retour","Back","Zurück","Indietro","Voltar")}</button>
              <button onClick={function(){playOpenDuel({mode:duelMode,diff:duelDiff,rounds:duelRounds},"create");}} style={{flex:2,padding:14,borderRadius:50,border:"none",background:"linear-gradient(135deg,#FF8A2A,#FFC93C)",color:"#000",fontFamily:G.font,fontSize:15,fontWeight:900,cursor:"pointer"}}>{tr("Jouer & poster ⚡","Play & post ⚡","Spielen & posten ⚡","Gioca e pubblica ⚡","Jogar e publicar ⚡")}</button>
            </div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.35)",textAlign:"center",marginTop:10}}>{tr("Tu joues d'abord — ton score devient le défi à battre.","You play first — your score becomes the challenge to beat.","Du spielst zuerst — dein Score wird zur Herausforderung.","Giochi prima tu — il tuo punteggio diventa la sfida da battere.","Você joga primeiro — sua pontuação vira o desafio a bater.")}</div>
          </div>
        ) : (
          <div>
            <button onClick={function(){setOpenDuelChooser(true);}} style={{width:"100%",padding:14,borderRadius:14,border:"none",background:"linear-gradient(135deg,#FF8A2A,#FFC93C)",color:"#000",fontFamily:G.font,fontSize:15,fontWeight:900,cursor:"pointer",marginBottom:14}}>＋ {tr("Lancer un défi","Post a challenge","Herausforderung posten","Lancia una sfida","Lançar um desafio")}</button>
            {openDuels.length===0 ? (
              <div style={{textAlign:"center",padding:"30px 16px",color:"rgba(255,255,255,.4)",fontSize:13}}>{tr("Aucun défi ouvert pour l'instant. Sois le premier ! ⚡","No open challenge yet. Be the first! ⚡","Noch keine offene Herausforderung. Sei der Erste! ⚡","Ancora nessuna sfida aperta. Sii il primo! ⚡","Nenhum desafio aberto ainda. Seja o primeiro! ⚡")}</div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {openDuels.map(function(d){return(
                  <div key={d.id} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:14}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:800,color:G.white,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>@{d.challenger_name}</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginTop:2}}>{d.mode==="pont"?"The Plug":"The Mercato"} · {d.diff==="facile"?(tr("Facile","Easy","Leicht","Facile","Fácil")):d.diff==="moyen"?(tr("Moyen","Medium","Mittel","Medio","Médio")):"Expert"}</div>
                    </div>
                    <div style={{textAlign:"right",marginRight:4}}>
                      <div style={{fontFamily:G.heading,fontSize:20,color:G.gold,lineHeight:1}}>{d.challenger_score}</div>
                      <div style={{fontSize:9,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:1}}>{tr("à battre","to beat","zu schlagen","da battere","a bater")}</div>
                    </div>
                    <button onClick={function(){playOpenDuel(d,"accept");}} style={{padding:"9px 14px",background:G.accent,color:"#000",border:"none",borderRadius:20,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:800,flexShrink:0}}>{tr("Relever","Take on","Annehmen","Affronta","Encarar")}</button>
                  </div>
                );})}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // ── REPORT ERROR MODAL ──
  const reportModal = reportingAnswer && (
    <div key="report-modal" onClick={()=>setReportingAnswer(null)} style={{position:"fixed",inset:0,zIndex:10000,background:"rgba(0,0,0,.85)",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px",animation:"fadeIn .2s ease",backdropFilter:"blur(10px)"}}>
      <div onClick={(e)=>e.stopPropagation()} style={{background:"linear-gradient(180deg,#1a2d1a 0%,#0d1f0d 100%)",borderRadius:24,padding:"24px 22px",maxWidth:420,width:"100%",border:"1px solid rgba(255,255,255,.1)",animation:"popIn .3s ease"}}>
        {reportSent ? (
          <div style={{textAlign:"center",padding:"20px 0"}}>
            <div style={{fontSize:60,marginBottom:10}}>✅</div>
            <div style={{fontFamily:G.heading,fontSize:24,color:"#00E676",letterSpacing:1,marginBottom:8}}>
              {tr("MERCI !","THANKS!","DANKE!","GRAZIE!","OBRIGADO!")}
            </div>
            <div style={{fontSize:14,color:"rgba(255,255,255,.7)",lineHeight:1.5,marginBottom:20}}>
              {tr("Ton signalement a bien été envoyé. Ça aide à améliorer le jeu pour tout le monde.","Your report has been sent. It helps improve the game for everyone.","Deine Meldung wurde gesendet. Sie hilft, das Spiel für alle zu verbessern.","La tua segnalazione è stata inviata. Aiuta a migliorare il gioco per tutti.","Seu reporte foi enviado. Ajuda a melhorar o jogo para todos.")}
            </div>
            <button onClick={()=>setReportingAnswer(null)} style={{padding:"12px 32px",background:G.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800}}>
              {tr("OK","OK","OK","OK","OK")}
            </button>
          </div>
        ) : (
          <>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <div style={{fontFamily:G.heading,fontSize:22,color:G.white,letterSpacing:1}}>
                🚩 {tr("SIGNALER","REPORT","MELDEN","SEGNALA","REPORTAR")}
              </div>
              <button onClick={()=>setReportingAnswer(null)} style={{width:32,height:32,borderRadius:"50%",background:"rgba(255,255,255,.1)",border:"none",color:G.white,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>
            <div style={{fontSize:13,color:"rgba(255,255,255,.6)",marginBottom:12,lineHeight:1.5}}>
              {tr("Quel type d'erreur as-tu trouvé ?","Which type of error did you find?","Welche Art von Fehler hast du gefunden?","Che tipo di errore hai trovato?","Que tipo de erro você encontrou?")}
            </div>
            <div style={{background:"rgba(255,255,255,.05)",borderRadius:12,padding:"10px 12px",marginBottom:14,fontSize:12,color:"rgba(255,255,255,.7)"}}>
              <div><strong style={{color:G.white}}>{reportingAnswer.c1}</strong> × <strong style={{color:G.white}}>{reportingAnswer.c2}</strong></div>
              {reportingAnswer.given && <div style={{marginTop:4,color:"rgba(255,255,255,.5)"}}>{tr("Ta réponse","Your answer","Deine Antwort","La tua risposta","Sua resposta")} : {reportingAnswer.given}</div>}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
              {[
                {t:"wrong_player_club", fr:"❌ Un joueur dans la liste n'a jamais joué à un de ces clubs", en:"❌ A player in the list never played for one of these clubs", de:"❌ Ein Spieler in der Liste hat nie für einen dieser Klubs gespielt", it:"❌ Un giocatore nella lista non ha mai giocato in uno di questi club", pt:"❌ Um jogador da lista nunca jogou em um desses clubes"},
                {t:"missing_player", fr:"➕ Ma réponse était correcte mais elle a été refusée", en:"➕ My answer was correct but got rejected", de:"➕ Meine Antwort war richtig, wurde aber abgelehnt", it:"➕ La mia risposta era corretta ma è stata rifiutata", pt:"➕ Minha resposta estava correta mas foi recusada"},
                {t:"wrong_club_name", fr:"🏟 Erreur dans le nom d'un club", en:"🏟 Error in a club name", de:"🏟 Fehler in einem Klubnamen", it:"🏟 Errore nel nome di un club", pt:"🏟 Erro no nome de um clube"},
                {t:"other", fr:"❓ Autre", en:"❓ Other", de:"❓ Sonstiges", it:"❓ Altro", pt:"❓ Outro"},
              ].map(opt => (
                <button key={opt.t} onClick={async ()=>{
                  try {
                    await sbFetch("bb_reports", {
                      method:"POST",
                      headers:{"Content-Type":"application/json","Prefer":"return=minimal"},
                      body: JSON.stringify({
                        reporter_id: playerId,
                        reporter_name: playerName || null,
                        report_type: opt.t,
                        c1: reportingAnswer.c1,
                        c2: reportingAnswer.c2,
                        given_answer: reportingAnswer.given || null,
                        player_name: (reportingAnswer.validPlayers||[]).join("|") || null,
                        message: reportMessage || null
                      })
                    });
                    setReportSent(true);
                  } catch(e) { setReportSent(true); /* failsafe : on remercie quand même */ }
                }} style={{padding:"12px 14px",background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.12)",borderRadius:12,cursor:"pointer",color:G.white,fontFamily:G.font,fontSize:13,fontWeight:600,textAlign:"left",transition:"all .15s"}} onMouseEnter={(e)=>{e.currentTarget.style.background="rgba(0,230,118,.12)";e.currentTarget.style.borderColor=G.accent;}} onMouseLeave={(e)=>{e.currentTarget.style.background="rgba(255,255,255,.06)";e.currentTarget.style.borderColor="rgba(255,255,255,.12)";}}>
                  {lang==="de"?(opt.de||opt.en):lang==="it"?(opt.it||opt.en):lang==="pt"?(opt.pt||opt.en):lang==="en"?opt.en:opt.fr}
                </button>
              ))}
            </div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.35)",textAlign:"center"}}>
              {tr("Choisis une catégorie pour envoyer le signalement","Select a category to send the report","Wähle eine Kategorie, um die Meldung zu senden","Scegli una categoria per inviare la segnalazione","Escolha uma categoria para enviar o reporte")}
            </div>
          </>
        )}
      </div>
    </div>
  );

  // ── AVATAR CROPPER MODAL ──
  // Refs pour gestures (pas de re-render nécessaire pendant le drag/pinch)
  const cropperGestureRef = useRef({mode:null,startX:0,startY:0,startOffsetX:0,startOffsetY:0,startDist:0,startScale:0});

  // Clamp offsets pour empêcher l'image de sortir du cadre (elle doit toujours "cover")
  function clampCrop(state) {
    const displayedW = state.naturalW * state.scale;
    const displayedH = state.naturalH * state.scale;
    const cs = state.cropSize;
    let x = state.x, y = state.y;
    // L'image doit couvrir le cadre : x ≤ 0 et x ≥ cs - displayedW
    if (displayedW >= cs) { x = Math.min(0, Math.max(cs - displayedW, x)); } else { x = (cs - displayedW) / 2; }
    if (displayedH >= cs) { y = Math.min(0, Math.max(cs - displayedH, y)); } else { y = (cs - displayedH) / 2; }
    return {...state, x, y};
  }

  function onCropperStart(e) {
    if (!cropState) return;
    // Touch
    if (e.touches) {
      if (e.touches.length === 2) {
        // Pinch
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        cropperGestureRef.current = {mode:"pinch", startDist:Math.hypot(dx,dy), startScale:cropState.scale, startOffsetX:cropState.x, startOffsetY:cropState.y};
      } else if (e.touches.length === 1) {
        cropperGestureRef.current = {mode:"drag", startX:e.touches[0].clientX, startY:e.touches[0].clientY, startOffsetX:cropState.x, startOffsetY:cropState.y};
      }
    } else {
      // Mouse
      cropperGestureRef.current = {mode:"drag", startX:e.clientX, startY:e.clientY, startOffsetX:cropState.x, startOffsetY:cropState.y};
    }
  }

  function onCropperMove(e) {
    const g = cropperGestureRef.current;
    if (!g.mode || !cropState) return;
    e.preventDefault();
    if (g.mode === "drag") {
      const point = e.touches ? e.touches[0] : e;
      if (!point) return;
      const nx = g.startOffsetX + (point.clientX - g.startX);
      const ny = g.startOffsetY + (point.clientY - g.startY);
      setCropState(clampCrop({...cropState, x:nx, y:ny}));
    } else if (g.mode === "pinch" && e.touches && e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / g.startDist;
      const newScale = Math.max(cropState.minScale, Math.min(cropState.minScale * 5, g.startScale * ratio));
      // Zoom vers le centre du cadre
      const cs = cropState.cropSize;
      const centerX = cs / 2, centerY = cs / 2;
      const scaleRatio = newScale / g.startScale;
      const nx = centerX - (centerX - g.startOffsetX) * scaleRatio;
      const ny = centerY - (centerY - g.startOffsetY) * scaleRatio;
      setCropState(clampCrop({...cropState, scale:newScale, x:nx, y:ny}));
    }
  }

  function onCropperEnd() {
    cropperGestureRef.current = {mode:null,startX:0,startY:0,startOffsetX:0,startOffsetY:0,startDist:0,startScale:0};
  }

  async function validateCrop() {
    if (!cropState) return;
    setAvatarUploading(true);
    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error("Image load failed"));
        img.src = cropState.url;
      });
      // Canvas de sortie : 300x300 final
      const OUT_SIZE = 300;
      const canvas = document.createElement("canvas");
      canvas.width = OUT_SIZE;
      canvas.height = OUT_SIZE;
      const ctx = canvas.getContext("2d");
      // La zone visible dans le cadre correspond à :
      // en coords display : (-x, -y) à (-x+cropSize, -y+cropSize)
      // en coords natives de l'image : diviser par scale
      const srcX = -cropState.x / cropState.scale;
      const srcY = -cropState.y / cropState.scale;
      const srcSize = cropState.cropSize / cropState.scale;
      ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, OUT_SIZE, OUT_SIZE);
      const blob = await new Promise(r => canvas.toBlob(r, "image/jpeg", 0.85));
      if (!blob) throw new Error("Crop failed");
      // Upload Supabase
      const fileName = playerId + ".jpg";
      const uploadRes = await fetch(SB_URL + "/storage/v1/object/avatars/" + fileName, {
        method: "POST",
        headers: {"apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY, "Content-Type": "image/jpeg", "x-upsert": "true"},
        body: blob
      });
      if (!uploadRes.ok) throw new Error("Upload failed: " + uploadRes.status);
      const publicUrl = SB_URL + "/storage/v1/object/public/avatars/" + fileName + "?t=" + Date.now();
      setPlayerAvatar(publicUrl);
      try { localStorage.setItem("bb_avatar_url", publicUrl); } catch {}
      setCropState(null);
    } catch(err) {
      alert((tr("Erreur upload : ","Upload error: ","Upload-Fehler: ","Errore di caricamento: ","Erro de upload: ")) + err.message);
    }
    setAvatarUploading(false);
  }

  const cropperModal = cropState && (
    <div key="cropper" style={{position:"fixed",inset:0,zIndex:9998,background:"rgba(0,0,0,.96)",display:"flex",flexDirection:"column",animation:"fadeIn .2s ease",backdropFilter:"blur(10px)"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px",borderBottom:"1px solid rgba(255,255,255,.08)"}}>
        <button onClick={()=>setCropState(null)} disabled={avatarUploading} style={{background:"none",border:"none",color:"rgba(255,255,255,.7)",fontSize:14,fontFamily:G.font,fontWeight:600,cursor:avatarUploading?"default":"pointer",padding:"8px 4px",opacity:avatarUploading?.4:1}}>{tr("Annuler","Cancel","Abbrechen","Annulla","Cancelar")}</button>
        <div style={{fontFamily:G.heading,fontSize:16,color:G.white,letterSpacing:1}}>{tr("AJUSTER LA PHOTO","ADJUST PHOTO","FOTO ANPASSEN","REGOLA FOTO","AJUSTAR FOTO")}</div>
        <button onClick={validateCrop} disabled={avatarUploading} style={{background:"none",border:"none",color:avatarUploading?"rgba(0,230,118,.4)":G.accent,fontSize:14,fontFamily:G.font,fontWeight:800,cursor:avatarUploading?"default":"pointer",padding:"8px 4px"}}>{avatarUploading?(tr("Sauvegarde...","Saving...","Speichern...","Salvataggio...","Salvando...")):(tr("Valider","Confirm","Bestätigen","Conferma","Confirmar"))}</button>
      </div>
      {/* Crop zone — centrée */}
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px",touchAction:"none"}}>
        <div
          onTouchStart={onCropperStart}
          onTouchMove={onCropperMove}
          onTouchEnd={onCropperEnd}
          onMouseDown={onCropperStart}
          onMouseMove={onCropperMove}
          onMouseUp={onCropperEnd}
          onMouseLeave={onCropperEnd}
          style={{position:"relative",width:cropState.cropSize,height:cropState.cropSize,maxWidth:"90vw",maxHeight:"90vw",overflow:"hidden",borderRadius:28,boxShadow:"0 0 0 2px rgba(255,255,255,.15), 0 0 0 9999px rgba(0,0,0,.5)",cursor:cropperGestureRef.current.mode==="drag"?"grabbing":"grab",touchAction:"none",userSelect:"none"}}
        >
          <img
            src={cropState.url}
            alt="crop"
            draggable={false}
            style={{position:"absolute",left:cropState.x,top:cropState.y,width:cropState.naturalW*cropState.scale,height:cropState.naturalH*cropState.scale,maxWidth:"none",maxHeight:"none",pointerEvents:"none",userSelect:"none"}}
          />
        </div>
      </div>
      {/* Zoom slider */}
      <div style={{padding:"0 24px 24px",display:"flex",alignItems:"center",gap:12}}>
        <span style={{fontSize:18,color:"rgba(255,255,255,.4)"}}>−</span>
        <input
          type="range"
          min={cropState.minScale}
          max={cropState.minScale * 5}
          step={cropState.minScale / 100}
          value={cropState.scale}
          onChange={(e)=>{
            const newScale = parseFloat(e.target.value);
            // Zoom vers le centre du cadre
            const cs = cropState.cropSize;
            const centerX = cs / 2, centerY = cs / 2;
            const scaleRatio = newScale / cropState.scale;
            const nx = centerX - (centerX - cropState.x) * scaleRatio;
            const ny = centerY - (centerY - cropState.y) * scaleRatio;
            setCropState(clampCrop({...cropState, scale:newScale, x:nx, y:ny}));
          }}
          style={{flex:1,accentColor:G.accent,height:4}}
        />
        <span style={{fontSize:22,color:"rgba(255,255,255,.4)"}}>+</span>
      </div>
      {/* Hint */}
      <div style={{textAlign:"center",padding:"0 20px 20px",fontSize:11,color:"rgba(255,255,255,.35)"}}>{tr("Glisse pour bouger · pince ou curseur pour zoomer","Drag to move · pinch or slider to zoom","Ziehen zum Bewegen · Pinch oder Regler zum Zoomen","Trascina per spostare · pizzica o cursore per lo zoom","Arraste para mover · pinça ou controle para zoom")}</div>
    </div>
  );

  // ── HISTORIQUE DES DÉFIS ──
  if (showDuelHistory) {
    const modeLabel = function(m){ return m==="pont"?"The Plug":m==="chaine"?"The Mercato":m==="grid"?"GOAT Grid":m||"Duel"; };
    const mine = (duels||[]).filter(function(d){ return d.status==="complete" && (d.challenger_id===playerId || d.opponent_id===playerId); });
    let w=0, l=0, dr=0;
    const rows = mine.map(function(d){
      const isChal = d.challenger_id===playerId;
      const my = isChal ? (d.challenger_score||0) : (d.opponent_score||0);
      const opp = isChal ? (d.opponent_score||0) : (d.challenger_score||0);
      const oppName = (isChal ? d.opponent_name : d.challenger_name) || "?";
      const res = my>opp ? "win" : my<opp ? "loss" : "draw";
      if(res==="win") w++; else if(res==="loss") l++; else dr++;
      return { id:d.id, oppName:oppName, my:my, opp:opp, res:res, mode:d.mode, diff:d.diff, when:d.created_at };
    });
    return (
      <div style={{...shell,overflow:isDesktop?"visible":"auto"}} key="duelHistory">
        <div style={{zIndex:3,padding:"12px 16px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          {backBtn(function(){setShowDuelHistory(false);})}
          <div style={{fontFamily:G.heading,fontSize:26,color:G.white,letterSpacing:2}}>{tr("MES DÉFIS","MY DUELS","MEINE DUELLE","LE MIE SFIDE","MEUS DUELOS")}</div>
          <div style={{width:40}}/>
        </div>
        <div style={{...sheet,borderRadius:"28px 28px 0 0",marginTop:16}}>
          {/* Bilan */}
          <div style={{display:"flex",gap:8,marginBottom:6}}>
            <div style={{flex:1,background:"rgba(0,230,118,.08)",border:"1px solid rgba(0,230,118,.2)",borderRadius:16,padding:"14px 0",textAlign:"center"}}>
              <div style={{fontFamily:G.heading,fontSize:30,color:"#00E676"}}>{w}</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase",marginTop:2}}>{tr("Victoires","Wins","Siege","Vittorie","Vitórias")}</div>
            </div>
            <div style={{flex:1,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:16,padding:"14px 0",textAlign:"center"}}>
              <div style={{fontFamily:G.heading,fontSize:30,color:"#FFD600"}}>{dr}</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase",marginTop:2}}>{tr("Nuls","Draws","Remis","Pareggi","Empates")}</div>
            </div>
            <div style={{flex:1,background:"rgba(255,61,87,.08)",border:"1px solid rgba(255,61,87,.2)",borderRadius:16,padding:"14px 0",textAlign:"center"}}>
              <div style={{fontFamily:G.heading,fontSize:30,color:"#FF3D57"}}>{l}</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase",marginTop:2}}>{tr("Défaites","Losses","Niederlagen","Sconfitte","Derrotas")}</div>
            </div>
          </div>
          {/* Liste */}
          {rows.length===0 ? (
            <div style={{textAlign:"center",padding:"36px 20px",color:"rgba(255,255,255,.4)",fontSize:14,lineHeight:1.5}}>{tr("Aucun défi terminé pour l'instant. Défie un ami ! ⚔️","No completed duel yet. Challenge a friend! ⚔️","Noch kein beendetes Duell. Fordere einen Freund heraus! ⚔️","Ancora nessuna sfida completata. Sfida un amico! ⚔️","Ainda nenhum duelo concluído. Desafie um amigo! ⚔️")}</div>
          ) : rows.map(function(r){
            const col = r.res==="win"?"#00E676":r.res==="loss"?"#FF3D57":"#FFD600";
            const label = r.res==="win"?tr("GAGNÉ","WON","GEWONNEN","VINTO","VENCEU"):r.res==="loss"?tr("PERDU","LOST","VERLOREN","PERSO","PERDEU"):tr("NUL","DRAW","UNENT.","PARI","EMPATE");
            let when=""; try{ if(r.when){ const dt=new Date(r.when); const loc={fr:"fr-FR",en:"en-GB",de:"de-DE",it:"it-IT",pt:"pt-PT"}[lang]||"en-GB"; when=dt.toLocaleDateString(loc,{day:"numeric",month:"short"}); } }catch(e){}
            return (
              <div key={r.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:"rgba(255,255,255,.04)",border:"1px solid "+col+"33",borderLeft:"3px solid "+col,borderRadius:14,marginBottom:8}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:800,color:G.white,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>vs {r.oppName}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,.4)",marginTop:1}}>{modeLabel(r.mode)}{when?" · "+when:""}</div>
                </div>
                <div style={{fontFamily:G.heading,fontSize:20,color:G.white,letterSpacing:1}}>{r.my}<span style={{color:"rgba(255,255,255,.3)",margin:"0 3px"}}>–</span>{r.opp}</div>
                <div style={{fontSize:10,fontWeight:900,letterSpacing:1,color:col,background:col+"1a",border:"1px solid "+col+"55",borderRadius:20,padding:"4px 9px",minWidth:52,textAlign:"center"}}>{label}</div>
              </div>
            );
          })}
          <button onClick={function(){setShowDuelHistory(false);}} style={{width:"100%",background:"rgba(255,255,255,.05)",color:"rgba(255,255,255,.5)",border:"1px solid rgba(255,255,255,.1)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,padding:"10px",marginTop:4}}>{tr("↩ Retour","↩ Back","↩ Zurück","↩ Indietro","↩ Voltar")}</button>
        </div>
      </div>
    );
  }

  // ── LEADERBOARD SCREEN ──
  // ── FRIENDS SCREEN ──
  if (showFriends) {
    // ── VUE DÉTAIL AMI ──
    if (selectedFriend) {
      const friendDuels = duels.filter(function(d){
        return d.status==="complete" && (d.challenger_id===selectedFriend.id || d.opponent_id===selectedFriend.id);
      });
      let wins=0, losses=0, draws=0;
      friendDuels.forEach(function(d){
        const myScore = d.challenger_id===playerId ? d.challenger_score : d.opponent_score;
        const theirScore = d.challenger_id===playerId ? d.opponent_score : d.challenger_score;
        if(myScore>theirScore) wins++;
        else if(myScore===theirScore) draws++;
        else losses++;
      });
      const isUnbeaten = friendDuels.length >= 1 && losses === 0;
      const theyDominate = friendDuels.length >= 1 && wins === 0;
      return (
        <div style={{...shell,overflow:isDesktop?"visible":"auto"}} key="friendDetail">
          <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
            {[0,1,2,3,4,5,6].map(function(i){return(<div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#0E1F14":"#132819"}}/>);})}
            <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
            <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
            <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
          </div>
          <div style={{zIndex:3,padding:"12px 16px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            {backBtn(function(){setSelectedFriend(null);})}
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
              <div style={{fontFamily:G.heading,fontSize:22,color:G.white,letterSpacing:2}}>{selectedFriend.name}</div>
              {isUnbeaten && <div style={{fontSize:11,fontWeight:800,color:"#FFD700",background:"rgba(255,215,0,.15)",borderRadius:20,padding:"3px 10px",letterSpacing:.5}}>{tr("😤 T'es invaincu contre lui","😤 You're unbeaten against them","😤 Du bist ungeschlagen gegen ihn","😤 Sei imbattuto contro di lui","😤 Você está invicto contra ele")}</div>}
              {theyDominate && <div style={{fontSize:11,fontWeight:800,color:"#FF3D57",background:"rgba(255,61,87,.15)",borderRadius:20,padding:"3px 10px",letterSpacing:.5}}>{tr("💀 Il n'a jamais perdu contre toi","💀 They've never lost to you","💀 Er hat nie gegen dich verloren","💀 Non ha mai perso contro di te","💀 Nunca perdeu para você")}</div>}
            </div>
            <button onClick={function(){setShowDuelCreate({id:selectedFriend.id,name:selectedFriend.name});}} style={{padding:"8px 14px",background:G.accent,color:"#000",border:"none",borderRadius:20,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:800}}>{tr("⚡ Défier","⚡ Challenge","⚡ Herausfordern","⚡ Sfida","⚡ Desafiar")}</button>
          </div>
          <div style={{...sheet,borderRadius:"28px 28px 0 0",marginTop:16}}>
            {/* Bilan */}
            {friendDuels.length > 0 && (
              <div style={{display:"flex",gap:8,marginBottom:4}}>
                <div style={{flex:1,background:"rgba(0,230,118,.08)",border:"1px solid rgba(0,230,118,.2)",borderRadius:16,padding:"14px 0",textAlign:"center"}}>
                  <div style={{fontFamily:G.heading,fontSize:32,color:"#00E676"}}>{wins}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase",marginTop:2}}>{tr("Victoires","Wins","Siege","Vittorie","Vitórias")}</div>
                </div>
                <div style={{flex:1,background:"rgba(255,214,0,.06)",border:"1px solid rgba(255,214,0,.2)",borderRadius:16,padding:"14px 0",textAlign:"center"}}>
                  <div style={{fontFamily:G.heading,fontSize:32,color:G.gold}}>{draws}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase",marginTop:2}}>{tr("Nuls","Draws","Remis","Pareggi","Empates")}</div>
                </div>
                <div style={{flex:1,background:"rgba(255,61,87,.06)",border:"1px solid rgba(255,61,87,.2)",borderRadius:16,padding:"14px 0",textAlign:"center"}}>
                  <div style={{fontFamily:G.heading,fontSize:32,color:"#FF3D57"}}>{losses}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase",marginTop:2}}>{tr("Défaites","Losses","Niederlagen","Sconfitte","Derrotas")}</div>
                </div>
              </div>
            )}
            {/* Historique */}
            <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.3)",marginBottom:8,marginTop:4}}>{tr("Historique","History","Verlauf","Cronologia","Histórico")}</div>
            {friendDuels.length===0 && (
              <div style={{textAlign:"center",padding:"32px 0",color:"rgba(255,255,255,.3)",fontSize:14}}>{tr("Aucun duel encore joué avec ","No duels played with ","Noch keine Duelle mit ","Ancora nessuna sfida con ","Ainda nenhum duelo com ")}{selectedFriend.name} 👀</div>
            )}
            {friendDuels.map(function(d,i){
              const myScore = d.challenger_id===playerId ? d.challenger_score : d.opponent_score;
              const theirScore = d.challenger_id===playerId ? d.opponent_score : d.challenger_score;
              const won = myScore>theirScore; const draw = myScore===theirScore;
              return(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:"rgba(255,255,255,.04)",borderRadius:12,marginBottom:6,border:"1px solid rgba(255,255,255,.06)"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:800,color:won?"#00E676":draw?G.gold:"#FF3D57"}}>{won?tr("🏆 Victoire","🏆 Win","🏆 Sieg","🏆 Vittoria","🏆 Vitória"):draw?tr("🤝 Égalité","🤝 Draw","🤝 Remis","🤝 Pareggio","🤝 Empate"):tr("😅 Défaite","😅 Loss","😅 Niederlage","😅 Sconfitta","😅 Derrota")}</div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>{d.mode==="pont"?"The Plug":"The Mercato"}{d.diff?" · "+d.diff:""}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontFamily:G.heading,fontSize:22,color:G.white}}>{myScore} <span style={{fontSize:11,color:"rgba(255,255,255,.3)"}}>pts</span></div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,.35)"}}>{selectedFriend.name}: {theirScore}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // ── VUE LISTE AMIS ──
    return (
      <div style={{...shell,overflow:isDesktop?"visible":"auto"}} key="friends">
        <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
          {[0,1,2,3,4,5,6].map(function(i){return(<div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#0E1F14":"#132819"}}/>);})}
          <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
          <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
        </div>
        {duelCreateModal}
        {/* Modal confirmation suppression ami */}
        {confirmRemove && (
          <div style={{position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,.75)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{background:"rgba(15,20,15,.97)",borderRadius:24,padding:"28px 24px",maxWidth:320,width:"calc(100% - 40px)",border:"1px solid rgba(255,255,255,.1)",textAlign:"center"}}>
              <div style={{fontSize:32,marginBottom:12}}>👋</div>
              <div style={{fontFamily:G.heading,fontSize:22,color:G.white,marginBottom:8}}>{tr("Supprimer ","Remove ","Entfernen ","Rimuovere ","Remover ")}{confirmRemove.name}{tr(" ?","?"," ?","?","?")}</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,.4)",marginBottom:24}}>{tr("Il devra renvoyer une demande pour être à nouveau dans ta liste.","They'll need to send a new request to be back on your list.","Er muss eine neue Anfrage senden, um wieder in deiner Liste zu sein.","Dovrà inviare una nuova richiesta per tornare nella tua lista.","Ele precisará enviar um novo pedido para voltar à sua lista.")}</div>
              <div style={{display:"flex",gap:10}}>
                <button onClick={function(){setConfirmRemove(null);}} style={{flex:1,padding:"12px",background:"rgba(255,255,255,.07)",color:"rgba(255,255,255,.6)",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>{tr("Annuler","Cancel","Abbrechen","Annulla","Cancelar")}</button>
                <button onClick={function(){removeFriend(confirmRemove.id);setConfirmRemove(null);}} style={{flex:1,padding:"12px",background:"#FF3D57",color:"#fff",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800}}>{tr("Supprimer","Remove","Entfernen","Rimuovi","Remover")}</button>
              </div>
            </div>
          </div>
        )}
        <div style={{zIndex:3,padding:"12px 16px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          {backBtn(function(){closeFriends();})}
          <div style={{fontFamily:G.heading,fontSize:26,color:G.white,letterSpacing:2}}>{tr("AMIS","FRIENDS","FREUNDE","AMICI","AMIGOS")}</div>
          <div style={{width:40}}/>
        </div>
        <div style={{...sheet,borderRadius:"28px 28px 0 0",marginTop:16}}>
          {/* Demandes reçues */}
          {friendRequests.length > 0 && (
            <div style={{background:"#123a1e",border:"1px solid rgba(0,230,118,.5)",borderRadius:16,padding:14}}>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:G.accent,marginBottom:10}}>👋 {tr("Demandes reçues","Requests received","Erhaltene Anfragen","Richieste ricevute","Pedidos recebidos")}</div>
              {friendRequests.map(function(req){return(
                <div key={req.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:800,color:G.white}}>{req.from_name}</div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>{tr("veut être ton ami · ","wants to be your friend · ","möchte dein Freund sein · ","vuole essere tuo amico · ","quer ser seu amigo · ")}{req.from_id}</div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={function(){acceptRequest(req);}} style={{padding:"8px 14px",background:G.accent,color:"#000",border:"none",borderRadius:20,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:800}}>✓</button>
                    <button onClick={function(){declineRequest(req);}} style={{padding:"8px 12px",background:"rgba(255,255,255,.07)",color:"rgba(255,255,255,.4)",border:"none",borderRadius:20,cursor:"pointer",fontSize:13}}>✕</button>
                  </div>
                </div>
              );})}
            </div>
          )}
          {/* Historique des défis */}
          <button onClick={function(){loadDuels();setShowDuelHistory(true);}} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"13px 16px",background:"rgba(255,214,0,.08)",border:"1px solid rgba(255,214,0,.3)",borderRadius:14,cursor:"pointer",textAlign:"left"}}>
            <span style={{fontSize:20}}>📜</span>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:800,color:G.gold}}>{tr("Historique des défis","Duel history","Duell-Verlauf","Cronologia sfide","Histórico de duelos")}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>{tr("Vois ce que t'as gagné et perdu","See what you won and lost","Sieh, was du gewonnen und verloren hast","Vedi cosa hai vinto e perso","Veja o que você ganhou e perdeu")}</div>
            </div>
            <span style={{fontSize:16,color:"rgba(255,214,0,.6)"}}>›</span>
          </button>
          {/* Ajouter un ami */}
          <div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:16}}>
            <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>{tr("Ajouter un ami","Add a friend","Freund hinzufügen","Aggiungi un amico","Adicionar amigo")}</div>
            <div style={{display:"flex",gap:8}}>
              <input value={friendInput} onChange={function(e){setFriendInput(e.target.value);setFriendMsg("");}}
                placeholder={tr("Pseudo de ton ami...","Your friend's username...","Nutzername deines Freundes...","Nome utente del tuo amico...","Nome de usuário do seu amigo...")} maxLength={20}
                style={{flex:1,padding:"10px 14px",borderRadius:12,border:"1.5px solid rgba(255,255,255,.15)",background:"#141414",color:G.white,fontFamily:G.font,fontSize:15,fontWeight:600,outline:"none"}}/>
              <button onClick={function(){addFriend(friendInput);}}
                style={{padding:"10px 16px",background:G.accent,color:"#000",border:"none",borderRadius:12,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800}}>+</button>
            </div>
            {friendMsg && <div style={{fontSize:12,marginTop:6,color:friendMsg.startsWith("✓")?"#00E676":friendMsg.startsWith("🔍")?"rgba(255,255,255,.5)":"#FF3D57",fontWeight:700}}>{friendMsg}</div>}
          </div>
          {/* Liste des amis + demandes en attente */}
          <div>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.3)",marginBottom:8}}>
              {tr("Mes amis","My friends","Meine Freunde","I miei amici","Meus amigos")} {friendsList.length>0&&<span style={{color:G.accent}}>({friendsList.length})</span>}
            </div>
            {friendsList.length===0 && sentRequests.filter(function(r){return r.status==="pending";}).length===0 && (
              <div style={{textAlign:"center",padding:"24px 0",color:"rgba(255,255,255,.3)",fontSize:14}}>{tr("Aucun ami pour l'instant 👋","No friends yet 👋","Noch keine Freunde 👋","Ancora nessun amico 👋","Ainda sem amigos 👋")}</div>
            )}
            {/* Demandes en attente intégrées dans la liste */}
            {sentRequests.filter(function(r){return r.status==="pending";}).map(function(r,i){return(
              <div key={"pending-"+i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:"rgba(255,214,0,.04)",borderRadius:14,marginBottom:8,border:"1px dashed rgba(255,214,0,.25)"}}>
                <div>
                  <div style={{fontSize:15,fontWeight:800,color:"rgba(255,255,255,.5)"}}>{r.to_name || r.to_id}</div>
                  <div style={{fontSize:11,color:G.gold}}>{tr("⏳ En attente d'acceptation","⏳ Awaiting acceptance","⏳ Warte auf Annahme","⏳ In attesa di accettazione","⏳ Aguardando aceitação")}</div>
                </div>
              </div>
            );})}
            {friendsList.map(function(fid, i) {
              let fname = fid;
              try {
                const names = JSON.parse(localStorage.getItem("bb_friend_names") || "{}");
                const fscores = friendScores.filter(function(s){return s.player_id===fid;});
                fname = names[fid] || (fscores.length > 0 ? fscores[0].player_name : fid);
              } catch { }
              const friendDuelCount = duels.filter(function(d){return d.status==="complete"&&(d.challenger_id===fid||d.opponent_id===fid);}).length;
              return (
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:"rgba(255,255,255,.04)",borderRadius:14,marginBottom:8,border:"1px solid rgba(255,255,255,.06)",cursor:"pointer"}}
                  onClick={function(){setShowFriends(false);openUserProfile(fid,fname,"friends");}}>
                  <div>
                    <div style={{fontSize:15,fontWeight:800,color:G.white}}>{fname}</div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,.35)"}}>{friendDuelCount>0?friendDuelCount+" "+(friendDuelCount>1?tr("duels joués","duels played","Duelle gespielt","sfide giocate","duelos jogados"):tr("duel joué","duel played","Duell gespielt","sfida giocata","duelo jogado")):tr("Aucun duel encore","No duels yet","Noch keine Duelle","Ancora nessuna sfida","Ainda nenhum duelo")}</div>
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <button onClick={function(e){e.stopPropagation();setShowDuelCreate({id:fid,name:fname});}} style={{padding:"7px 12px",background:G.accent,color:"#000",border:"none",borderRadius:20,cursor:"pointer",fontFamily:G.font,fontSize:12,fontWeight:800}}>{tr("⚡ Défier","⚡ Challenge","⚡ Herausfordern","⚡ Sfida","⚡ Desafiar")}</button>
                    <button onClick={function(e){e.stopPropagation();setConfirmRemove({id:fid,name:fname});}} style={{padding:"7px 10px",background:"transparent",border:"1px solid rgba(255,255,255,.15)",borderRadius:20,cursor:"pointer",color:"rgba(255,255,255,.4)",fontSize:12}}>✕</button>
                    <span style={{color:"rgba(255,255,255,.3)",fontSize:18}}>›</span>
                  </div>
                </div>
              );
            })}
          </div>
          <button onClick={function(){closeFriends();}} style={{width:"100%",background:"rgba(255,255,255,.05)",color:"rgba(255,255,255,.5)",border:"1px solid rgba(255,255,255,.1)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,padding:"10px",marginTop:4}}>{tr("↩ Retour","↩ Back","↩ Zurück","↩ Indietro","↩ Voltar")}</button>
        </div>
      </div>
    );
  }

  // ── COLLECTION DE CARTES ──
  // Choisir une carte la met en badge ; recliquer la même l'enlève. Le choix est
  // optimiste côté UI : la persistance Supabase peut échouer (colonne pas encore
  // créée) sans rien casser, le badge reste alors visible pour son propriétaire.
  async function chooseBadge(id) {
    const next = playerBadge === id ? null : id;
    setPlayerBadge(next);
    try { next ? localStorage.setItem("bb_badge", next) : localStorage.removeItem("bb_badge"); } catch (e) {}
    if (!playerId) return;
    await sbFetch("bb_pseudos?player_id=eq." + playerId, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Prefer": "return=minimal" },
      body: JSON.stringify({ badge: next }),
    });
  }

  if (showCollection) {
    const possedees = unlockedCards(playerXp);
    const prochaine = progressToNext(playerXp);
    return (
      <>
      <button onClick={function(){setShowCollection(false);}} style={{position:"fixed",top:14,left:14,zIndex:100,background:"rgba(0,15,0,.85)",border:"1px solid rgba(255,255,255,.15)",borderRadius:"50%",width:42,height:42,cursor:"pointer",color:G.white,fontSize:20,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(10px)",boxShadow:"0 4px 14px rgba(0,0,0,.4)"}}>←</button>
      <div style={{...shell,animation:"fadeUp .4s ease",overflow:isDesktop?"visible":"auto"}} key="collection">
        <div style={{zIndex:1,padding:"50px 20px 10px",textAlign:"center"}}>
          {/* Lettrage de la charte « Olive et Tom » : posterText (Anton, italique
              légère, contour d'encre + ombre dure) et second mot en jaune
              projecteur — même construction que le titre « GOAT FC ». */}
          <div style={{...posterText(40,G.white),lineHeight:.9}}>
            {tr("MA ","MY ","MEINE ","LA MIA ","MINHA ")}
            <span style={{color:G.projecteur}}>{tr("COLLECTION","COLLECTION","SAMMLUNG","COLLEZIONE","COLEÇÃO")}</span>
          </div>
          <div style={{fontSize:13,color:"rgba(255,255,255,.5)",marginTop:6,fontWeight:600}}>
            {possedees.length}/{CARDS.length} · {playerXp.toLocaleString("fr-FR")} XP
          </div>
        </div>

        {/* Progression vers la prochaine carte */}
        {prochaine && (
          <div style={{zIndex:1,maxWidth:560,margin:"0 auto",width:"100%",boxSizing:"border-box",padding:"6px 20px 0"}}>
            <div style={{background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:16,padding:"14px 16px"}}>
              <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:8}}>
                <span style={{fontSize:11,letterSpacing:1.5,fontWeight:800,color:"rgba(255,255,255,.45)",textTransform:"uppercase"}}>{tr("Prochaine carte","Next card","Nächste Karte","Prossima carta","Próxima carta")}</span>
                <span style={{flex:1}}/>
                <span style={{fontSize:12,fontWeight:800,color:rarityMeta(prochaine.card.rarity).color}}>{lang==="fr"?prochaine.card.name:prochaine.card.nameEn}</span>
              </div>
              <div style={{height:8,background:"rgba(255,255,255,.08)",borderRadius:6,overflow:"hidden"}}>
                <div style={{height:"100%",width:Math.round(prochaine.ratio*100)+"%",minWidth:prochaine.ratio>0?6:0,background:"linear-gradient(90deg,#00E676,#B9F600)",borderRadius:6,transition:"width .4s"}}/>
              </div>
              <div style={{fontSize:11.5,color:"rgba(255,255,255,.5)",fontWeight:600,marginTop:7}}>
                {tr("Encore ","","","","")}{prochaine.missing.toLocaleString("fr-FR")} XP
              </div>
            </div>
          </div>
        )}

        {/* Cartes groupées par rareté */}
        <div style={{zIndex:1,padding:"16px 20px 30px",maxWidth:560,margin:"0 auto",width:"100%",boxSizing:"border-box"}}>
          {RARITIES.map(function(rar){
            const cartes = CARDS.filter(function(c){ return c.rarity === rar.key; });
            if (!cartes.length) return null;
            const nbPossedees = cartes.filter(function(c){ return isUnlocked(c, playerXp); }).length;
            return (
              <div key={rar.key} style={{marginBottom:24}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <span style={{fontSize:11,letterSpacing:2,fontWeight:800,color:rar.color,textTransform:"uppercase"}}>{lang==="fr"?rar.label:rar.labelEn}</span>
                  <span style={{flex:1,height:1,background:"linear-gradient(90deg,"+rar.color+"55,transparent)"}}/>
                  <span style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)"}}>{nbPossedees}/{cartes.length}</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(92px,1fr))",gap:12}}>
                  {cartes.map(function(c){
                    const ouverte = isUnlocked(c, playerXp);
                    const active = playerBadge === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={ouverte ? function(){ chooseBadge(c.id); } : undefined}
                        title={ouverte ? (lang==="fr"?c.name:c.nameEn) : (c.xp.toLocaleString("fr-FR") + " XP")}
                        className={ouverte && rar.cls ? rar.cls : undefined}
                        style={{
                          padding:2,border:"none",
                          borderRadius:14,overflow:"hidden",
                          /* le cadre EST le fond : le visuel s'inscrit dedans */
                          background:ouverte?rar.frame:"rgba(255,255,255,.07)",
                          cursor:ouverte?"pointer":"default",position:"relative",display:"block",
                          boxShadow:active?"0 0 18px "+rar.glow:"none",transition:"border-color .15s, box-shadow .15s",
                        }}
                      >
                        <div style={{position:"relative",aspectRatio:"3 / 4",overflow:"hidden",background:"#000",borderRadius:11}}>
                          {hasArt(c)
                            ? <img src={c.img} alt="" loading="lazy" style={{width:"100%",height:"100%",objectFit:"cover",
                                filter:ouverte?"none":"grayscale(1) brightness(.32)",transition:"filter .2s"}}/>
                            : /* Illustration pas encore livrée : emplacement neutre, jamais
                                 une image d'emprunt qui ferait croire à une autre carte. */
                              <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",
                                background:"repeating-linear-gradient(135deg,rgba(255,255,255,.04) 0 8px,rgba(255,255,255,.015) 8px 16px)",
                                color:"rgba(255,255,255,.22)",fontFamily:G.heading,fontSize:30}}>?</div>}
                          {!ouverte && (
                            <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2}}>
                              <span style={{fontSize:18,lineHeight:1}}>🔒</span>
                              <span style={{fontSize:10.5,fontWeight:800,color:"rgba(255,255,255,.85)"}}>{c.xp.toLocaleString("fr-FR")} XP</span>
                            </div>
                          )}
                          {active && (
                            <div style={{position:"absolute",top:4,right:4,width:20,height:20,borderRadius:"50%",background:rar.color,color:"#0a0f0a",fontSize:12,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center"}}>✓</div>
                          )}
                        </div>
                        <div style={{padding:"6px 6px 7px",fontSize:10.5,fontWeight:800,lineHeight:1.25,
                          color:ouverte?G.white:"rgba(255,255,255,.35)",textAlign:"center",fontFamily:G.font}}>
                          {lang==="fr"?c.name:c.nameEn}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div style={{fontSize:11.5,color:"rgba(255,255,255,.35)",fontWeight:600,lineHeight:1.6,textAlign:"center",padding:"0 6px"}}>
            {tr("Touche une carte débloquée pour en faire ta photo de profil. Retouche-la pour revenir à la carte de ton niveau.",
                "Tap an unlocked card to use it as your profile picture. Tap again to go back to your level card.",
                "Tippe eine freigeschaltete Karte an, um sie als Profilbild zu nutzen.",
                "Tocca una carta sbloccata per usarla come foto profilo.",
                "Toque numa carta desbloqueada para usá-la como foto de perfil.")}
          </div>
        </div>
      </div>
      </>
    );
  }

  if (showAccount) {
    return (
      <>
      <button onClick={function(){setShowAccount(false);setConfirmDeleteAccount(0);}} style={{position:"fixed",top:14,left:14,zIndex:100,background:"rgba(0,15,0,.85)",border:"1px solid rgba(255,255,255,.15)",borderRadius:"50%",width:42,height:42,cursor:"pointer",color:G.white,fontSize:20,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(10px)",boxShadow:"0 4px 14px rgba(0,0,0,.4)"}}>←</button>
      <div style={{...shell,animation:"fadeUp .4s ease",overflow:isDesktop?"visible":"auto"}} key="account">
        <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
          <div style={{position:"absolute",top:-100,left:-100,width:300,height:300,background:"radial-gradient(circle, rgba(0,230,118,.15) 0%, transparent 70%)",borderRadius:"50%"}}/>
        </div>
        <div style={{zIndex:1,padding:"50px 20px 14px",textAlign:"center"}}>
          <div style={{...posterText(38,G.white)}}>{tr("MON ","MY ","MEIN ","IL MIO ","MINHA ")}<span style={{color:G.projecteur}}>{tr("COMPTE","ACCOUNT","KONTO","ACCOUNT","CONTA")}</span></div>
          <div style={{fontSize:13,color:"rgba(255,255,255,.5)",marginTop:6,fontWeight:600}}>{tr("Gère les paramètres de ton compte","Manage your account settings","Verwalte deine Kontoeinstellungen","Gestisci le impostazioni del tuo account","Gerencie as configurações da sua conta")}</div>
        </div>

        <div style={{zIndex:1,padding:"20px 20px",display:"flex",flexDirection:"column",gap:14,maxWidth:560,margin:"0 auto",width:"100%",boxSizing:"border-box"}}>

          {/* Identité */}
          <div style={{padding:"18px 20px",background:"rgba(255,255,255,.06)",borderRadius:16,border:"1px solid rgba(255,255,255,.1)"}}>
            <div style={{fontSize:11,color:"rgba(255,255,255,.4)",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>{tr("Pseudo","Pseudo","Nutzername","Nome utente","Apelido")}</div>
            <div style={{fontSize:20,color:G.white,fontWeight:800}}>{playerName||"—"}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.4)",fontWeight:600,marginTop:6}}>ID: {playerId}</div>
          </div>

          {/* Accès à la collection de cartes */}
          {(function(){
            const badge = badgeToShow(playerBadge, playerXp);
            const possedees = unlockedCards(playerXp).length;
            return (
              <button onClick={function(){setShowAccount(false);setShowCollection(true);}} style={{padding:"14px 18px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:14,color:"rgba(255,255,255,.7)",fontFamily:G.font,fontSize:14,fontWeight:700,display:"flex",alignItems:"center",gap:12,textAlign:"left",cursor:"pointer",width:"100%"}}>
                {badge
                  ? <img src={badge.thumb} alt="" style={{width:22,height:29,borderRadius:5,objectFit:"cover",border:"1.5px solid "+rarityMeta(badge.rarity).color,flexShrink:0}}/>
                  : <span style={{fontSize:18}}>🃏</span>}
                <span style={{flex:1}}>{tr("Ma collection","My collection","Meine Sammlung","La mia collezione","Minha coleção")}</span>
                <span style={{fontSize:12.5,fontWeight:800,color:G.accent}}>{possedees}/{CARDS.length}</span>
                <span style={{color:"rgba(255,255,255,.3)"}}>›</span>
              </button>
            );
          })()}

          {/* Liens légaux */}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{padding:"14px 18px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:14,color:"rgba(255,255,255,.7)",fontFamily:G.font,fontSize:14,fontWeight:700,display:"flex",alignItems:"center",gap:12,textAlign:"left",textDecoration:"none"}}>
            <span style={{fontSize:18}}>🔒</span>
            <div style={{flex:1}}>{tr("Politique de confidentialité","Privacy Policy","Datenschutzerklärung","Informativa sulla privacy","Política de Privacidade")}</div>
            <span style={{fontSize:14,color:"rgba(255,255,255,.4)"}}>↗</span>
          </a>

          <a href="/terms" target="_blank" rel="noopener noreferrer" style={{padding:"14px 18px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:14,color:"rgba(255,255,255,.7)",fontFamily:G.font,fontSize:14,fontWeight:700,display:"flex",alignItems:"center",gap:12,textAlign:"left",textDecoration:"none"}}>
            <span style={{fontSize:18}}>📄</span>
            <div style={{flex:1}}>{tr("Conditions générales","Terms of Service","Nutzungsbedingungen","Termini di servizio","Termos de Serviço")}</div>
            <span style={{fontSize:14,color:"rgba(255,255,255,.4)"}}>↗</span>
          </a>

          {/* Zone danger */}
          <div style={{marginTop:20,padding:"16px",background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.2)",borderRadius:14}}>
            <div style={{fontSize:11,color:"#ef4444",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:8}}>{tr("Zone de danger","Danger zone","Gefahrenzone","Zona pericolosa","Zona de perigo")}</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,.7)",marginBottom:14,lineHeight:1.5}}>{tr("La suppression de ton compte est définitive. Tous tes scores, amis et données seront effacés à jamais.","Deleting your account is permanent. All your scores, friends, and data will be erased forever.","Das Löschen deines Kontos ist endgültig. Alle Scores, Freunde und Daten werden für immer gelöscht.","L'eliminazione dell'account è definitiva. Tutti i punteggi, amici e dati saranno cancellati per sempre.","Excluir sua conta é permanente. Todas as pontuações, amigos e dados serão apagados para sempre.")}</div>
            <button onClick={function(){setConfirmDeleteAccount(1);}} style={{width:"100%",padding:"13px",background:"transparent",color:"#ef4444",border:"1px solid #ef4444",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800}}>
              {tr("🗑 Supprimer mon compte","🗑 Delete my account","🗑 Mein Konto löschen","🗑 Elimina il mio account","🗑 Excluir minha conta")}
            </button>
          </div>

          {/* Modal de confirmation suppression compte */}
          {confirmDeleteAccount > 0 && (
            <div onClick={function(e){if(e.target===e.currentTarget)setConfirmDeleteAccount(0);}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(8px)"}}>
              <div style={{background:G.bg,borderRadius:20,padding:"24px 22px",maxWidth:420,width:"100%",border:"1px solid rgba(239,68,68,.4)",boxShadow:"0 12px 40px rgba(0,0,0,.6)"}}>
                <div style={{fontSize:42,textAlign:"center",marginBottom:8}}>⚠️</div>
                <div style={{fontFamily:G.heading,fontSize:22,color:"#ef4444",textAlign:"center",letterSpacing:1.2,marginBottom:14}}>
                  {confirmDeleteAccount === 1 ? (tr("ES-TU SÛR ?","ARE YOU SURE?","BIST DU SICHER?","SEI SICURO?","TEM CERTEZA?")) : (tr("DERNIER AVERTISSEMENT","LAST WARNING","LETZTE WARNUNG","ULTIMO AVVISO","ÚLTIMO AVISO"))}
                </div>
                <div style={{fontSize:14,color:"rgba(255,255,255,.85)",textAlign:"center",marginBottom:6,lineHeight:1.5}}>
                  {confirmDeleteAccount === 1
                    ? (tr("Cela va supprimer définitivement :","This will permanently delete:","Das löscht endgültig:","Questo eliminerà definitivamente:","Isto vai excluir permanentemente:"))
                    : (tr("C'est irréversible. Tu confirmes une dernière fois ?","This cannot be undone. Confirm one last time?","Das kann nicht rückgängig gemacht werden. Ein letztes Mal bestätigen?","Non è reversibile. Confermi un'ultima volta?","Isto não pode ser desfeito. Confirma pela última vez?"))}
                </div>
                {confirmDeleteAccount === 1 && (
                  <ul style={{fontSize:13,color:"rgba(255,255,255,.7)",margin:"10px 0 18px 0",paddingLeft:24,lineHeight:1.7}}>
                    <li>{tr("Ton pseudo et avatar","Your pseudo and avatar","Dein Name und Avatar","Il tuo nome e avatar","Seu apelido e avatar")}</li>
                    <li>{tr("Tous tes scores et XP","All your scores and XP","Alle deine Scores und XP","Tutti i tuoi punteggi e XP","Todas as suas pontuações e XP")}</li>
                    <li>{tr("Tes amis et duels","Your friends and duels","Deine Freunde und Duelle","I tuoi amici e duelli","Seus amigos e duelos")}</li>
                    <li>{tr("Tes notifications push","Your push notifications","Deine Push-Benachrichtigungen","Le tue notifiche push","Suas notificações push")}</li>
                  </ul>
                )}
                <div style={{display:"flex",gap:10,marginTop:18}}>
                  <button onClick={function(){setConfirmDeleteAccount(0);}} style={{flex:1,padding:"13px",background:"rgba(255,255,255,.08)",color:G.white,border:"1px solid rgba(255,255,255,.15)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>
                    {tr("Annuler","Cancel","Abbrechen","Annulla","Cancelar")}
                  </button>
                  <button onClick={function(){
                    if (confirmDeleteAccount === 1) setConfirmDeleteAccount(2);
                    else { setConfirmDeleteAccount(0); deleteAccount(); }
                  }} style={{flex:1,padding:"13px",background:"#ef4444",color:"#fff",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800}}>
                    {confirmDeleteAccount === 1 ? (tr("Continuer","Continue","Weiter","Continua","Continuar")) : (tr("SUPPRIMER","DELETE NOW","JETZT LÖSCHEN","ELIMINA ORA","EXCLUIR AGORA"))}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      </>
    );
  }

  if(showLeaderboard) {
    return (
      <>
      {/* Floating back button — OUTSIDE animated container so it doesn't move during fadeUp */}
      <button onClick={function(){setShowLeaderboard(false);}} style={{position:"fixed",top:14,left:14,zIndex:100,background:"rgba(0,15,0,.85)",border:"1px solid rgba(255,255,255,.15)",borderRadius:"50%",width:42,height:42,cursor:"pointer",color:G.white,fontSize:20,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(10px)",boxShadow:"0 4px 14px rgba(0,0,0,.4)"}}>←</button>
      <div style={{...shell,animation:"fadeUp .4s ease",overflow:isDesktop?"visible":"auto"}} key="lb">
        <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        {/* Bandes pelouse */}
        {[0,1,2,3,4,5,6].map(function(i){return(
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#0E1F14":"#132819"}}/>
        );})}
        {/* Ligne médiane */}
        <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
        {/* Cercle central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
        {/* Point central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:8,height:8,borderRadius:"50%",background:"rgba(255,255,255,.2)"}}/>
        {/* Overlay sombre pour lisibilité */}
        <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
      </div>
        <div style={{zIndex:1,padding:"12px 20px 12px 70px",display:"flex",alignItems:"center",gap:12}}>
          <div style={{flex:1,textAlign:"center"}}>
            <div style={{...posterText(40,G.projecteur)}}>{tr("CLASSEMENT","LEADERBOARD","RANGLISTE","CLASSIFICA","CLASSIFICAÇÃO")}</div>
            {(()=>{ const s=getCurrentSeason(); return lbMode==="amis"
              ? <div style={{fontSize:12,color:"rgba(255,255,255,.4)"}}>{tr("Classement entre amis · Cumulatif","Friends leaderboard · Cumulative","Freunde-Rangliste · Kumulativ","Classifica tra amici · Cumulativa","Classificação entre amigos · Cumulativa")}</div>
              : <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                  <div style={{fontSize:13,fontWeight:800,color:G.gold}}>⚽ {lang==="fr"?s.monthNameFr:s.monthNameEn}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>{tr(`⏳ J-${s.days} ${s.hours}h avant reset`,`⏳ ${s.days}d ${s.hours}h before reset`,`⏳ ${s.days}T ${s.hours}h bis Reset`,`⏳ ${s.days}g ${s.hours}h al reset`,`⏳ ${s.days}d ${s.hours}h até o reset`)}</div>
                </div>;
            })()}
          </div>
          <div style={{width:40}}/>{/* spacer pour centrer le titre */}
        </div>
        <div style={{...sheet,borderRadius:"28px 28px 0 0"}}>
          {/* Saison info */}
          {lbMode!=="amis" && (()=>{
            const s = getCurrentSeason();
            const msLeft = s.end - new Date();
            const daysLeft = Math.max(0, Math.floor(msLeft / 86400000));
            const hoursLeft = Math.max(0, Math.floor((msLeft % 86400000) / 3600000));
            return (
              <div style={{marginBottom:8,padding:"10px 14px",background:"rgba(255,214,0,.08)",borderRadius:14,border:"1px solid rgba(255,214,0,.2)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:11,fontWeight:800,color:G.gold,letterSpacing:1}}>🏆 {(lang==="fr"?s.monthNameFr:s.monthNameEn).toUpperCase()}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.4)",marginTop:2}}>
                    {daysLeft > 0
                      ? tr(`J-${daysLeft} (${hoursLeft}h)`,`${daysLeft}d (${hoursLeft}h) left`,`${daysLeft}T (${hoursLeft}h)`,`${daysLeft}g (${hoursLeft}h)`,`${daysLeft}d (${hoursLeft}h)`)
                      : tr(`Finit dans ${hoursLeft}h`,`Ends in ${hoursLeft}h`,`Endet in ${hoursLeft}h`,`Finisce tra ${hoursLeft}h`,`Termina em ${hoursLeft}h`)}
                  </div>
                </div>
                <button onClick={function(){setShowHallOfFame(true);}} style={{padding:"6px 12px",background:"rgba(255,214,0,.15)",color:G.gold,border:"1px solid rgba(255,214,0,.3)",borderRadius:20,cursor:"pointer",fontFamily:G.font,fontSize:11,fontWeight:800}}>
                  🏅 Hall of Fame
                </button>
              </div>
            );
          })()}
          <div style={{display:"flex",gap:6,marginBottom:4,flexWrap:"wrap"}}>
            {["saison","global","amis"].map(function(m){return(
              <button key={m} onClick={function(){
                setLbMode(m);
                if(m==="saison") loadLeaderboard("saison");
                else if(m!=="amis") loadLeaderboard(m);
                else loadLeaderboard("global");
              }} style={{flex:1,minWidth:60,padding:"10px 6px",borderRadius:12,border:"1.5px solid "+(lbMode===m?G.accent:"rgba(255,255,255,.12)"),background:lbMode===m?"rgba(0,230,118,.1)":"transparent",color:lbMode===m?G.accent:G.white,fontFamily:G.font,fontWeight:700,cursor:"pointer",fontSize:12}}>
                {m==="saison"?tr("⭐ Saison","⭐ Season","⭐ Saison","⭐ Stagione","⭐ Temporada"):m==="global"?"🌍 Global":tr("👥 Amis","👥 Friends","👥 Freunde","👥 Amici","👥 Amigos")}
              </button>
            );})}
          </div>
          {/* Toggle Monde/Amis pour le classement Saison */}
          {lbMode==="saison" && (
            <div style={{display:"flex",gap:4,marginBottom:10,marginTop:6,padding:4,background:"rgba(255,255,255,.04)",borderRadius:10,border:"1px solid rgba(255,255,255,.06)"}}>
              {[{id:"monde",emoji:"🌍"},{id:"amis",emoji:"👥"}].map(function(s){return(
                <button key={s.id} onClick={function(){setLbSeasonScope(s.id);}} style={{flex:1,padding:"8px 10px",borderRadius:8,border:"none",background:lbSeasonScope===s.id?"rgba(0,230,118,.2)":"transparent",color:lbSeasonScope===s.id?G.accent:"rgba(255,255,255,.55)",fontFamily:G.font,fontSize:12,fontWeight:800,cursor:"pointer",letterSpacing:.5,transition:"all .15s"}}>
                  {s.emoji} {s.id==="monde"?tr("Monde","World","Welt","Mondo","Mundo"):tr("Amis","Friends","Freunde","Amici","Amigos")}
                </button>
              );})}
            </div>
          )}
          {leaderboard.length === 0 && (
            <div style={{textAlign:"center",padding:"32px 0",color:"rgba(255,255,255,.3)",fontSize:14}}>{tr("Aucun score pour le moment","No scores yet","Noch keine Scores","Ancora nessun punteggio","Ainda sem pontuações")}</div>
          )}
          {leaderboard.length > 0 && lbMode==="saison" && lbSeasonScope==="amis" && leaderboard.filter(function(e){ return e.pid===playerId || friendsList.includes(e.pid); }).length === 0 && (
            <div style={{textAlign:"center",padding:"32px 16px",color:"rgba(255,255,255,.3)",fontSize:13,lineHeight:1.5}}>{tr("Aucun de tes amis n'a encore joué ce mois-ci","None of your friends have played yet this month","Noch keiner deiner Freunde hat diesen Monat gespielt","Nessuno dei tuoi amici ha ancora giocato questo mese","Nenhum dos seus amigos jogou ainda este mês")}</div>
          )}
          {(lbMode==="amis"
            ? leaderboard.filter(function(e){ return e.pid===playerId || friendsList.includes(e.pid); })
            : lbMode==="saison" && lbSeasonScope==="amis"
            ? leaderboard.filter(function(e){ return e.pid===playerId || friendsList.includes(e.pid); })
            : leaderboard
          ).map(function(entry, i){
            // Recalcule le rang affiché en fonction du filtre (pour que le #1 visible affiche "1" et pas son rang mondial)
            const displayRank = i + 1;
            const isMe = entry.pid === playerId;
            const medals = ["🥇","🥈","🥉"];
            // Le grade affiché est basé sur l'XP cumulée totale du joueur (cohérent avec le profil)
            // — pas le score de la partie (qui peut être trompeur)
            const grade = getGrade(entry.xp || 0);
            return(
              <div key={i} onClick={()=>{ if(!isMe) { setShowLeaderboard(false); openUserProfile(entry.pid, entry.name, "leaderboard"); } }} style={{borderRadius:14,background:i===0?"linear-gradient(135deg,#FFD600,#FF6B35)":i===1?"linear-gradient(135deg,#E8E8E8,#A8A8B0)":i===2?"linear-gradient(135deg,#E3A869,#8B5A2B)":"rgba(0,230,118,.18)",border:i===0?"1px solid rgba(255,214,0,.6)":i===1?"1px solid rgba(200,200,210,.6)":i===2?"1px solid rgba(205,127,50,.6)":isMe?"1px solid rgba(0,230,118,.6)":"1px solid rgba(0,230,118,.35)",marginBottom:6,overflow:"hidden",cursor:isMe?"default":"pointer",boxShadow:i===0?"0 4px 18px rgba(255,107,53,.35)":i===1?"0 4px 18px rgba(200,200,210,.25)":i===2?"0 4px 18px rgba(205,127,50,.3)":"none"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 12px"}}>
                  <div style={{fontFamily:G.heading,fontSize:28,width:34,textAlign:"center",color:i<3?["#FFD600","#C0C0C0","#CD7F32"][i]:"rgba(255,255,255,.3)",flexShrink:0}}>
                    {i<3?medals[i]:(i+1)}
                  </div>
                  {/* Avatar rond (photo Supabase Storage ou fallback emoji grade) */}
                  <div style={{width:36,height:48,borderRadius:7,border:"1.5px solid rgba(255,255,255,.28)",background:"#000",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,color:"#fff",overflow:"hidden",position:"relative",flexShrink:0,border:i<3?"2px solid rgba(0,0,0,.3)":"1.5px solid rgba(255,255,255,.15)"}}>
                    {/* Photo de profil par défaut = la carte du joueur (badge choisi, sinon
                        carte de son niveau). La photo uploadée, si elle existe, se
                        superpose par-dessus ; son onError la retire et laisse voir la carte.
                        objectPosition top : dans un cadre rond, une carte 3:4 doit
                        montrer le visage, pas le maillot. */}
                    {(function(){
                      const b = badgeByPid[entry.pid];
                      const c = avatarCard(b && b.badge, entry.xp || 0);
                      return <img src={c.img} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}}/>;
                    })()}
                    {/* La photo uploadée ne se superpose plus : la carte du joueur
                        (badge choisi, sinon niveau) EST la photo de profil. */}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3,flexWrap:"wrap"}}>
                      <span style={{fontSize:18,fontFamily:G.heading,letterSpacing:1,color:i<3?"#1a0d00":isMe?G.accent:G.white,whiteSpace:"nowrap"}}>{entry.country && <span style={{marginRight:5,fontSize:15}}>{countryToFlag(entry.country)}</span>}{entry.name}{isMe?tr(" (toi)"," (you)"," (du)"," (tu)"," (você)"):""}</span>
                      <span style={{fontSize:11,fontWeight:800,color:i<3?"#1a0d00":grade.color,background:i<3?"rgba(26,13,0,.18)":grade.color+"22",borderRadius:20,padding:"2px 8px",letterSpacing:.5,border:i<3?"1px solid rgba(26,13,0,.25)":"none"}}>{grade.emoji} {grade.label}</span>
                      {entry.streak>=3 && <span style={{fontSize:11,fontWeight:800,color:"#FF6B35",background:"rgba(255,107,53,.15)",borderRadius:20,padding:"2px 8px"}}>🔥 {entry.streak}</span>}
                      {/* Badge de collection — la carte est revalidée contre l'XP
                          du joueur (badgeToShow), pour ne jamais afficher une
                          carte non méritée si la valeur en base est périmée. */}
                      {(function(){
                        const b = badgeByPid[entry.pid];
                        const card = b ? badgeToShow(b.badge, b.xp) : null;
                        if (!card) return null;
                        const rm = rarityMeta(card.rarity);
                        return <img key="badge" src={card.thumb} alt="" title={lang==="fr"?card.name:card.nameEn} style={{width:16,height:21,borderRadius:4,objectFit:"cover",border:"1.5px solid "+rm.color,flexShrink:0}}/>;
                      })()}
                    </div>
                    {lbMode==="saison"
                      ? null
                      : <div style={{fontSize:12,color:i<3?"rgba(26,13,0,.85)":"rgba(255,255,255,.5)",marginTop:3,fontWeight:i<3?700:400}}>{entry.played} {entry.played>1?tr("parties","games","Spiele","partite","jogos"):tr("partie","game","Spiel","partita","jogo")}</div>
                    }
                  </div>
                  <div style={{fontFamily:G.heading,fontSize:28,color:i<3?"#1a0d00":G.white,flexShrink:0}}>{entry.score} <span style={{fontSize:12,color:i<3?"rgba(26,13,0,.7)":"rgba(255,255,255,.3)",fontWeight:i<3?700:400}}>pts</span></div>
                </div>
                {lbMode!=="saison" && (
                <div style={{display:"flex",borderTop:i<3?"1px solid rgba(0,0,0,.2)":"1px solid rgba(255,255,255,.06)",background:i<3?"rgba(0,0,0,.08)":"transparent"}}>
                    <div style={{flex:1,padding:"10px 0",textAlign:"center",borderRight:i<3?"1px solid rgba(0,0,0,.15)":"1px solid rgba(255,255,255,.06)"}}>
                      <div style={{fontFamily:G.heading,fontSize:22,color:i<3?"#0d5c2a":"#00E676"}}>{entry.wins||0}</div>
                      <div style={{fontSize:11,color:i<3?"rgba(26,13,0,.75)":"rgba(255,255,255,.5)",letterSpacing:1,textTransform:"uppercase",fontWeight:i<3?800:400}}>{tr("Victoires","Wins","Siege","Vittorie","Vitórias")}</div>
                    </div>
                    <div style={{flex:1,padding:"10px 0",textAlign:"center",borderRight:i<3?"1px solid rgba(0,0,0,.15)":"1px solid rgba(255,255,255,.06)"}}>
                      <div style={{fontFamily:G.heading,fontSize:22,color:i<3?"#7a5c00":G.gold}}>{entry.draws||0}</div>
                      <div style={{fontSize:11,color:i<3?"rgba(26,13,0,.75)":"rgba(255,255,255,.5)",letterSpacing:1,textTransform:"uppercase",fontWeight:i<3?800:400}}>{tr("Nuls","Draws","Remis","Pareggi","Empates")}</div>
                    </div>
                    <div style={{flex:1,padding:"10px 0",textAlign:"center"}}>
                      <div style={{fontFamily:G.heading,fontSize:22,color:i<3?"#8a1a2e":"#FF3D57"}}>{entry.losses||0}</div>
                      <div style={{fontSize:11,color:i<3?"rgba(26,13,0,.75)":"rgba(255,255,255,.5)",letterSpacing:1,textTransform:"uppercase",fontWeight:i<3?800:400}}>{tr("Défaites","Losses","Niederlagen","Sconfitte","Derrotas")}</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {/* Hall of Fame */}
          {hallOfFame.length > 0 && lbMode !== "amis" && (
            <div style={{marginTop:16,paddingTop:16,borderTop:"1px solid rgba(255,255,255,.08)"}}>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.3)",marginBottom:10,textAlign:"center"}}>🏛 Hall of Fame</div>
              {hallOfFame.slice(0,5).map(function(s,i){
                const monthNamesFr = ["Jan","Fév","Mars","Avr","Mai","Juin","Juil","Août","Sept","Oct","Nov","Déc"];
                const monthNamesEn = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
                let monthShort = tr("Saison "+s.season_number,"Season "+s.season_number,"Saison "+s.season_number,"Stagione "+s.season_number,"Temporada "+s.season_number);
                if (s.season_month) {
                  const [y, m] = s.season_month.split("-");
                  monthShort = (lang==="fr"?monthNamesFr:monthNamesEn)[parseInt(m,10)-1] + " " + y.slice(2);
                }
                return (
                  <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"rgba(255,215,0,.05)",borderRadius:12,marginBottom:6,border:"1px solid rgba(255,215,0,.1)"}}>
                    <span style={{fontSize:20}}>👑</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:800,color:G.gold}}>{s.champion_name}</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,.35)"}}>{monthShort}</div>
                    </div>
                    <div style={{fontFamily:G.heading,fontSize:20,color:G.gold}}>{s.champion_score} <span style={{fontSize:11,color:"rgba(255,255,255,.3)"}}>pts</span></div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {/* Hall of Fame Modal */}
      {showHallOfFame && (
        <div style={{position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,.85)",display:"flex",alignItems:"flex-end"}}
          onClick={function(e){if(e.target===e.currentTarget)setShowHallOfFame(false);}}>
          <div style={{width:"100%",background:"rgba(10,20,10,.97)",borderRadius:"28px 28px 0 0",padding:"20px 20px 48px",border:"1px solid rgba(255,255,255,.1)",borderBottom:"none",maxHeight:"80vh",overflowY:"auto"}}>
            <div style={{fontFamily:G.heading,fontSize:28,color:G.gold,letterSpacing:2,marginBottom:4,textAlign:"center"}}>🏅 HALL OF FAME</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.4)",textAlign:"center",marginBottom:16}}>{tr("Champions des saisons passées","Past season champions","Champions vergangener Saisons","Campioni delle stagioni passate","Campeões das temporadas passadas")}</div>
            {hallOfFame.length === 0 && <div style={{textAlign:"center",color:"rgba(255,255,255,.3)",padding:"24px 0",fontSize:14}}>{tr("Pas encore de champion — la première saison est en cours !","No champion yet — the first season is ongoing!","Noch kein Champion — die erste Saison läuft!","Ancora nessun campione — la prima stagione è in corso!","Ainda sem campeão — a primeira temporada está em andamento!")}</div>}
            {hallOfFame.map(function(s,i){
              // Transformer le monthKey "2026-04" en nom lisible
              const monthNamesFr = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
              const monthNamesEn = ["January","February","March","April","May","June","July","August","September","October","November","December"];
              let monthLabel = "";
              if (s.season_month) {
                const [y, m] = s.season_month.split("-");
                const mi = parseInt(m,10) - 1;
                monthLabel = (lang==="fr"?monthNamesFr:monthNamesEn)[mi] + " " + y;
              }
              return (
                <div key={i} style={{background:"linear-gradient(135deg, rgba(255,214,0,.1), rgba(255,107,53,.05))",borderRadius:18,border:"1.5px solid rgba(255,214,0,.3)",marginBottom:14,padding:"16px 14px",boxShadow:"0 4px 16px rgba(255,214,0,.08)"}}>
                  {/* Header saison */}
                  <div style={{textAlign:"center",marginBottom:12}}>
                    <div style={{fontSize:11,fontWeight:800,letterSpacing:3,color:"rgba(255,214,0,.7)",textTransform:"uppercase"}}>{tr("Saison","Season","Saison","Stagione","Temporada")} {s.season_number}</div>
                    {monthLabel && <div style={{fontFamily:G.heading,fontSize:18,color:G.white,letterSpacing:1,marginTop:2}}>{monthLabel}</div>}
                  </div>
                  {/* Podium */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1.3fr 1fr",gap:8,alignItems:"flex-end"}}>
                    {/* 2nd */}
                    {s.runner_up_name ? (
                      <div style={{textAlign:"center",background:"rgba(200,200,210,.12)",border:"1px solid rgba(200,200,210,.3)",borderRadius:12,padding:"12px 6px"}}>
                        <div style={{fontSize:26,marginBottom:4}}>🥈</div>
                        <div style={{fontSize:13,fontWeight:800,color:"#E8E8E8",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.runner_up_name}</div>
                        <div style={{fontFamily:G.heading,fontSize:16,color:"#C0C0C0"}}>{s.runner_up_xp}</div>
                        <div style={{fontSize:9,color:"rgba(255,255,255,.4)",letterSpacing:1}}>pts</div>
                      </div>
                    ) : <div/>}
                    {/* 1st (champion) */}
                    <div style={{textAlign:"center",background:"linear-gradient(180deg,rgba(255,214,0,.25),rgba(255,214,0,.1))",border:"1.5px solid #FFD600",borderRadius:14,padding:"14px 6px",boxShadow:"0 4px 14px rgba(255,214,0,.25)",transform:"translateY(-4px)"}}>
                      <div style={{fontSize:32,marginBottom:4}}>👑</div>
                      <div style={{fontSize:14,fontWeight:800,color:G.gold,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textShadow:"0 1px 6px rgba(255,214,0,.5)"}}>{s.champion_name}</div>
                      <div style={{fontFamily:G.heading,fontSize:20,color:G.gold}}>{s.champion_score}</div>
                      <div style={{fontSize:9,color:"rgba(255,214,0,.7)",letterSpacing:1,fontWeight:700}}>pts</div>
                    </div>
                    {/* 3rd */}
                    {s.third_name ? (
                      <div style={{textAlign:"center",background:"rgba(205,127,50,.12)",border:"1px solid rgba(205,127,50,.3)",borderRadius:12,padding:"12px 6px"}}>
                        <div style={{fontSize:26,marginBottom:4}}>🥉</div>
                        <div style={{fontSize:13,fontWeight:800,color:"#E3A869",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.third_name}</div>
                        <div style={{fontFamily:G.heading,fontSize:16,color:"#CD7F32"}}>{s.third_xp}</div>
                        <div style={{fontSize:9,color:"rgba(255,255,255,.4)",letterSpacing:1}}>pts</div>
                      </div>
                    ) : <div/>}
                  </div>
                </div>
              );
            })}
            <button onClick={function(){setShowHallOfFame(false);}} style={{width:"100%",padding:"14px",background:"rgba(255,255,255,.07)",color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700,marginTop:8}}>{tr("Fermer","Close","Schließen","Chiudi","Fechar")}</button>
          </div>
        </div>
      )}
      </>
    );
  }
  if (room) {
    const players = typeof room.players === "string" ? JSON.parse(room.players) : (room.players || []);
    const isHost = room.host_id === playerId;
    const me = players.find(function(p){return p.id===playerId;});
    if (duelCountdown !== null) {
      const oppName = players.filter(function(p){return p.id!==playerId;}).map(function(p){return p.name;}).join(", ");
      return (
        <div style={{...shell,alignItems:"center",justifyContent:"center"}} key="countdown">
          <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        {/* Bandes pelouse */}
        {[0,1,2,3,4,5,6].map(function(i){return(
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#0E1F14":"#132819"}}/>
        );})}
        {/* Ligne médiane */}
        <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
        {/* Cercle central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
        {/* Point central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:8,height:8,borderRadius:"50%",background:"rgba(255,255,255,.2)"}}/>
        {/* Overlay sombre pour lisibilité */}
        <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
      </div>
          <div style={{textAlign:"center",zIndex:1}}>
            <div style={{fontSize:14,color:"rgba(255,255,255,.5)",letterSpacing:3,textTransform:"uppercase",marginBottom:16}}>{tr("C'est parti !","Let's go!","Los geht's!","Si parte!","Vamos lá!")}</div>
            <div style={{fontFamily:G.heading,fontSize:120,color:G.accent,lineHeight:1,animation:"popIn .3s ease"}} key={duelCountdown}>{duelCountdown}</div>
            <div style={{fontSize:14,color:"rgba(255,255,255,.4)",marginTop:16}}>{players.length} {tr("joueurs","players","Spieler","giocatori","jogadores")}</div>
          </div>
        </div>
      );
    }
    return (
      <div style={{...shell,overflow:isDesktop?"visible":"auto"}} key="room">
        <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        {/* Bandes pelouse */}
        {[0,1,2,3,4,5,6].map(function(i){return(
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#0E1F14":"#132819"}}/>
        );})}
        {/* Ligne médiane */}
        <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
        {/* Cercle central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
        {/* Point central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:8,height:8,borderRadius:"50%",background:"rgba(255,255,255,.2)"}}/>
        {/* Overlay sombre pour lisibilité */}
        <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
      </div>
        <div style={{zIndex:1,padding:"20px 18px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          {backBtn(leaveRoom)}
          <div style={{fontFamily:G.heading,fontSize:24,color:G.white,letterSpacing:2}}>{tr("SALLE","ROOM","RAUM","STANZA","SALA")}</div>
          <div style={{background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.1)",borderRadius:12,padding:"6px 14px",textAlign:"center",display:"flex",alignItems:"center",gap:8}}>
            <div>
              <div style={{fontSize:9,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase"}}>{tr("Code","Code","Code","Codice","Código")}</div>
              <div style={{fontFamily:G.heading,fontSize:20,color:G.gold,letterSpacing:4}}>{room.code}</div>
            </div>
            <button onClick={function(){
              const link = "https://goatfc.fr?room="+room.code;
              const shareTitle = tr("GOAT FC — Rejoins ma salle !","GOAT FC — Join my room!","GOAT FC — Tritt meinem Raum bei!","GOAT FC — Entra nella mia stanza!","GOAT FC — Entre na minha sala!");
              const shareText = tr("Rejoins ma salle sur GOAT FC 🐐","Join my room on GOAT FC 🐐","Tritt meinem Raum auf GOAT FC bei 🐐","Entra nella mia stanza su GOAT FC 🐐","Entre na minha sala no GOAT FC 🐐");
              const copiedMsg = tr("Lien copié ! 📋","Link copied! 📋","Link kopiert! 📋","Link copiato! 📋","Link copiado! 📋");
              if(navigator.share){navigator.share({title:shareTitle,text:shareText,url:link});}
              else{navigator.clipboard.writeText(link).then(function(){alert(copiedMsg);});}
            }} style={{background:"rgba(0,230,118,.15)",border:"1px solid rgba(0,230,118,.3)",borderRadius:8,padding:"6px 10px",color:G.accent,cursor:"pointer",fontSize:13,fontWeight:800,lineHeight:1}}>🔗 {tr("Inviter","Invite","Einladen","Invita","Convidar")}</button>
          </div>
        </div>
        <div style={{...sheet,borderRadius:"28px 28px 0 0",marginTop:16}}>
          <div style={{background:"rgba(255,255,255,.04)",borderRadius:14,padding:"10px 14px",marginBottom:4}}>
            <div style={{fontSize:11,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase",marginBottom:2}}>{tr("Mode","Mode","Modus","Modalità","Modo")}</div>
            <div style={{fontSize:15,fontWeight:800,color:G.white}}>{room.mode==="pont"?"The Plug":"The Mercato"}{room.diff?" · "+(room.diff==="facile"?"AMATEUR":room.diff==="moyen"?"PRO":"CRESCENDO"):""} · {room.rounds||1} {(room.rounds||1)>1?tr("manches","rounds","Runden","turni","rodadas"):tr("manche","round","Runde","turno","rodada")}</div>
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.3)",marginBottom:8}}>
              {tr("Joueurs","Players","Spieler","Giocatori","Jogadores")} ({players.length}/8)
            </div>
            {players.map(function(p, i){return(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"rgba(255,255,255,.04)",borderRadius:12,marginBottom:6,border:p.id===playerId?"1px solid rgba(0,230,118,.3)":"1px solid rgba(255,255,255,.05)"}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,#0E1F14,#00E676)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:"#fff",flexShrink:0}}>
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:800,color:p.id===playerId?G.accent:G.white}}>{p.name}{p.id===room.host_id?" 👑":""}{p.id===playerId?tr(" (toi)"," (you)"," (du)"," (tu)"," (você)"):""}</div>
                </div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>✓ {tr("Prêt","Ready","Bereit","Pronto","Pronto")}</div>
              </div>
            );})}
          </div>
          {players.length < 2 && (
            <div style={{textAlign:"center",padding:"8px 0",fontSize:13,color:"rgba(255,255,255,.3)"}}>
              {tr(<>Partage le code <strong style={{color:G.gold}}>{room.code}</strong> à tes amis</>,<>Share code <strong style={{color:G.gold}}>{room.code}</strong> with your friends</>,<>Teile den Code <strong style={{color:G.gold}}>{room.code}</strong> mit deinen Freunden</>,<>Condividi il codice <strong style={{color:G.gold}}>{room.code}</strong> con i tuoi amici</>,<>Compartilhe o código <strong style={{color:G.gold}}>{room.code}</strong> com seus amigos</>)}
            </div>
          )}
          {isHost ? (
            <button onClick={startRoomGame} disabled={players.length < 2}
              style={{width:"100%",padding:"16px",background:players.length>=2?G.accent:"rgba(255,255,255,.1)",color:players.length>=2?"#000":"rgba(255,255,255,.3)",border:"none",borderRadius:50,cursor:players.length>=2?"pointer":"not-allowed",fontFamily:G.font,fontSize:15,fontWeight:800,marginTop:4}}>
              {players.length < 2 ? tr("En attente de joueurs...","Waiting for players...","Warte auf Spieler...","In attesa di giocatori...","Aguardando jogadores...") : tr("🚀 Lancer la partie ("+players.length+" joueurs)","🚀 Start game ("+players.length+" players)","🚀 Spiel starten ("+players.length+" Spieler)","🚀 Avvia la partita ("+players.length+" giocatori)","🚀 Iniciar jogo ("+players.length+" jogadores)")}
            </button>
          ) : (
            <div style={{textAlign:"center",padding:"14px",fontSize:13,color:"rgba(255,255,255,.4)",background:"rgba(255,255,255,.04)",borderRadius:16}}>
              ⏳ {tr("En attente que "+room.host_name+" lance la partie...","Waiting for "+room.host_name+" to start...",room.host_name+" startet gleich...","In attesa che "+room.host_name+" avvii la partita...","Aguardando "+room.host_name+" iniciar...")}
            </div>
          )}
        </div>
      </div>
    );
  }


  // ── TUTORIAL ──
  const TUTORIAL_BASE = [
    { icon:"⚽", color:"#1a4a2e", accent:"#00E676", t:{
      fr:{title:"GOAT PLUG",subtitle:"Trouve le joueur qui relie 2 clubs",desc:"On te montre 2 clubs. Trouve le joueur qui a joué dans les deux !"},
      en:{title:"GOAT PLUG",subtitle:"Find the player linking 2 clubs",desc:"We show you 2 clubs. Find the player who played for both!"},
      de:{title:"GOAT PLUG",subtitle:"Finde den Spieler, der 2 Klubs verbindet",desc:"Wir zeigen dir 2 Klubs. Finde den Spieler, der in beiden gespielt hat!"},
      it:{title:"GOAT PLUG",subtitle:"Trova il giocatore che collega 2 club",desc:"Ti mostriamo 2 club. Trova il giocatore che ha giocato in entrambi!"},
      pt:{title:"GOAT PLUG",subtitle:"Encontre o jogador que liga 2 clubes",desc:"Mostramos 2 clubes. Encontre o jogador que jogou nos dois!"} } },
    { icon:"⛓", color:"#1a2a4a", accent:"#60a5fa", t:{
      fr:{title:"GOAT MERCATO",subtitle:"Enchaîne joueur → club → joueur",desc:"Un joueur est affiché. Tape un club où il a joué, puis un autre joueur de ce club… et ainsi de suite !"},
      en:{title:"GOAT MERCATO",subtitle:"Chain player → club → player",desc:"A player is shown. Type a club they played for, then another player from that club… and so on!"},
      de:{title:"GOAT MERCATO",subtitle:"Verkette Spieler → Klub → Spieler",desc:"Ein Spieler wird angezeigt. Nenne einen seiner Klubs, dann einen anderen Spieler dieses Klubs… und so weiter!"},
      it:{title:"GOAT MERCATO",subtitle:"Concatena giocatore → club → giocatore",desc:"Viene mostrato un giocatore. Scrivi un club in cui ha giocato, poi un altro giocatore di quel club… e così via!"},
      pt:{title:"GOAT MERCATO",subtitle:"Encadeie jogador → clube → jogador",desc:"Um jogador é mostrado. Digite um clube dele, depois outro jogador desse clube… e assim por diante!"} } },
    { icon:"⚡", color:"#3a2a00", accent:"#FFD600", t:{
      fr:{title:"DÉFI DU JOUR",subtitle:"Un joueur mystère chaque jour",desc:"Chaque jour, un nouveau joueur mystère à deviner. Reviens tous les jours pour ne pas perdre ta série !"},
      en:{title:"DAILY CHALLENGE",subtitle:"A mystery player every day",desc:"Every day, a new mystery player to guess. Come back daily to keep your streak alive!"},
      de:{title:"TAGES-CHALLENGE",subtitle:"Jeden Tag ein Rätselspieler",desc:"Jeden Tag ein neuer Rätselspieler zum Erraten. Komm täglich zurück, um deine Serie zu halten!"},
      it:{title:"SFIDA DEL GIORNO",subtitle:"Un giocatore misterioso ogni giorno",desc:"Ogni giorno un nuovo giocatore misterioso da indovinare. Torna ogni giorno per non perdere la serie!"},
      pt:{title:"DESAFIO DO DIA",subtitle:"Um jogador misterioso todo dia",desc:"Todo dia, um novo jogador misterioso para adivinhar. Volte diariamente para manter sua sequência!"} } },
    { icon:"👥", color:"#2a1a3a", accent:"#c084fc", t:{
      fr:{title:"MULTIJOUEUR",subtitle:"Joue avec tes potes",desc:"Crée une salle, partage le code, et affrontez-vous en temps réel jusqu'à 8 joueurs !"},
      en:{title:"MULTIPLAYER",subtitle:"Play with your friends",desc:"Create a room, share the code, and battle in real time with up to 8 players!"},
      de:{title:"MEHRSPIELER",subtitle:"Spiel mit deinen Freunden",desc:"Erstelle einen Raum, teile den Code und tretet in Echtzeit mit bis zu 8 Spielern an!"},
      it:{title:"MULTIGIOCATORE",subtitle:"Gioca con i tuoi amici",desc:"Crea una stanza, condividi il codice e sfidatevi in tempo reale fino a 8 giocatori!"},
      pt:{title:"MULTIJOGADOR",subtitle:"Jogue com seus amigos",desc:"Crie uma sala, compartilhe o código e enfrentem-se em tempo real com até 8 jogadores!"} } },
  ];
  const TUTORIAL_SLIDES = TUTORIAL_BASE.map(function(s){ return Object.assign({ icon:s.icon, color:s.color, accent:s.accent }, s.t[lang] || s.t.en); });
  // Le tutoriel s'affiche comme un overlay par-dessus l'écran d'accueil
  // (pas comme un écran qui remplace tout) → l'utilisateur voit le home en arrière-plan
  // avec son logo, ses modes de jeu, etc. → contexte visuel avant de commencer
  const tutorialOverlay = showTutorial ? (() => {
    const sl = TUTORIAL_SLIDES[tutorialStep];
    const closeTutorial = () => { setShowTutorial(false); try{localStorage.setItem("bb_tutorial_done","1");}catch{} };
    return (
      <div style={{position:"fixed",inset:0,zIndex:9998,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 20px",background:"rgba(0,0,0,.75)",backdropFilter:"blur(10px)",animation:"fadeIn .3s ease"}}>
        <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:380,background:sl.color,borderRadius:28,padding:"36px 24px 28px",border:"1px solid rgba(255,255,255,.1)",textAlign:"center",boxShadow:"0 20px 60px rgba(0,0,0,.5)"}}>
          <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:28}}>
            {TUTORIAL_SLIDES.map((_,i)=>(<div key={i} style={{width:i===tutorialStep?24:8,height:8,borderRadius:4,background:i===tutorialStep?sl.accent:"rgba(255,255,255,.2)",transition:"all .3s"}}/>))}
          </div>
          <div style={{fontSize:56,marginBottom:16}}>{sl.icon}</div>
          <div style={{fontFamily:G.heading,fontSize:32,color:"#fff",letterSpacing:2,marginBottom:6}}>{sl.title}</div>
          <div style={{fontSize:13,color:sl.accent,fontWeight:700,letterSpacing:1,marginBottom:16,textTransform:"uppercase"}}>{sl.subtitle}</div>
          <div style={{fontSize:15,color:"rgba(255,255,255,.7)",lineHeight:1.6,marginBottom:32}}>{sl.desc}</div>
          <div style={{display:"flex",gap:10}}>
            {tutorialStep > 0 && <button onClick={()=>setTutorialStep(s=>s-1)} style={{flex:1,padding:"14px",background:"rgba(255,255,255,.07)",color:"rgba(255,255,255,.5)",border:"1px solid rgba(255,255,255,.1)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>{tr("← Retour","← Back","← Zurück","← Indietro","← Voltar")}</button>}
            {tutorialStep < TUTORIAL_SLIDES.length-1
              ? <button onClick={()=>setTutorialStep(s=>s+1)} style={{flex:2,padding:"14px",background:sl.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800}}>{tr("Suivant →","Next →","Weiter →","Avanti →","Próximo →")}</button>
              : <button onClick={closeTutorial} style={{flex:2,padding:"14px",background:sl.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800}}>{tr("C'est parti 🚀","Let's go 🚀","Los geht's 🚀","Si parte 🚀","Vamos lá 🚀")}</button>
            }
          </div>
          {tutorialStep < TUTORIAL_SLIDES.length-1 && <button onClick={closeTutorial} style={{marginTop:16,background:"none",border:"none",color:"rgba(255,255,255,.3)",cursor:"pointer",fontFamily:G.font,fontSize:13}}>{tr("Passer","Skip","Überspringen","Salta","Pular")}</button>}
        </div>
      </div>
    );
  })() : null;

  // Bannière de bienvenue RGPD (1er lancement) — confirme que l'app stocke des données localement
  // mais sans tracking marketing. Affichée AVANT le tutoriel.
  const welcomeOverlay = showWelcome ? (() => {
    const closeWelcome = () => {
      setShowWelcome(false);
      try { localStorage.setItem("bb_welcome_seen", "1"); } catch {}
      // Enchaîner sur le tutoriel après le welcome
      try { if (!localStorage.getItem("bb_tutorial_done")) setShowTutorial(true); } catch {}
    };
    return (
      <div style={{position:"fixed",inset:0,zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 20px",background:"rgba(0,0,0,.85)",backdropFilter:"blur(10px)",animation:"fadeIn .3s ease"}}>
        <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:380,background:G.bg,borderRadius:28,padding:"32px 24px 24px",border:"1px solid rgba(0,230,118,.2)",textAlign:"center",boxShadow:"0 20px 60px rgba(0,0,0,.5)"}}>
          <div style={{fontSize:56,marginBottom:16}}>🐐</div>
          <div style={{fontFamily:G.heading,fontSize:26,color:G.white,letterSpacing:1.2,marginBottom:14}}>
            {tr("BIENVENUE SUR GOAT FC","WELCOME TO GOAT FC","WILLKOMMEN BEI GOAT FC","BENVENUTO SU GOAT FC","BEM-VINDO AO GOAT FC")}
          </div>
          <div style={{fontSize:14,color:"rgba(255,255,255,.75)",lineHeight:1.6,marginBottom:20,textAlign:"left"}}>
            {(function(){
              const li = {padding:0}, ul = {paddingLeft:20,margin:"0 0 12px",color:"rgba(255,255,255,.65)",fontSize:13};
              const S = {color:G.accent};
              const blocks = {
                fr:<><p style={{margin:"0 0 12px"}}>Petit point sur tes données :</p><ul style={ul}><li style={{marginBottom:6}}>On stocke ton <strong style={S}>pseudo, scores et préférences</strong> localement</li><li style={{marginBottom:6}}>Pas de pub trackée, aucune donnée revendue</li><li>Tu peux supprimer ton compte à tout moment dans les paramètres</li></ul></>,
                en:<><p style={{margin:"0 0 12px"}}>Quick heads-up about your data:</p><ul style={ul}><li style={{marginBottom:6}}>We store your <strong style={S}>username, scores and preferences</strong> locally</li><li style={{marginBottom:6}}>No advertising tracking, no data sold to third parties</li><li>You can delete your account anytime in settings</li></ul></>,
                de:<><p style={{margin:"0 0 12px"}}>Kurz zu deinen Daten:</p><ul style={ul}><li style={{marginBottom:6}}>Wir speichern deinen <strong style={S}>Benutzernamen, Scores und Einstellungen</strong> lokal</li><li style={{marginBottom:6}}>Kein Werbe-Tracking, keine Daten an Dritte verkauft</li><li>Du kannst dein Konto jederzeit in den Einstellungen löschen</li></ul></>,
                it:<><p style={{margin:"0 0 12px"}}>Due parole sui tuoi dati:</p><ul style={ul}><li style={{marginBottom:6}}>Salviamo il tuo <strong style={S}>nome utente, punteggi e preferenze</strong> localmente</li><li style={{marginBottom:6}}>Nessun tracciamento pubblicitario, nessun dato venduto a terzi</li><li>Puoi eliminare il tuo account in qualsiasi momento nelle impostazioni</li></ul></>,
                pt:<><p style={{margin:"0 0 12px"}}>Um aviso rápido sobre seus dados:</p><ul style={ul}><li style={{marginBottom:6}}>Armazenamos seu <strong style={S}>nome de usuário, pontuações e preferências</strong> localmente</li><li style={{marginBottom:6}}>Sem rastreamento de anúncios, nenhum dado vendido a terceiros</li><li>Você pode excluir sua conta a qualquer momento nas configurações</li></ul></>,
              };
              return blocks[lang] || blocks.en;
            })()}
          </div>
          <div style={{display:"flex",gap:8,fontSize:11,color:"rgba(255,255,255,.4)",marginBottom:18,justifyContent:"center"}}>
            <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{color:"rgba(255,255,255,.5)",textDecoration:"underline"}}>{tr("Politique de confidentialité","Privacy Policy","Datenschutz","Privacy","Privacidade")}</a>
            <span>·</span>
            <a href="/terms" target="_blank" rel="noopener noreferrer" style={{color:"rgba(255,255,255,.5)",textDecoration:"underline"}}>{tr("CGU","Terms","AGB","Termini","Termos")}</a>
          </div>
          <button onClick={closeWelcome} style={{width:"100%",padding:"14px",background:G.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800}}>
            {tr("J'ai compris 🐐","Got it 🐐","Verstanden 🐐","Ho capito 🐐","Entendi 🐐")}
          </button>
        </div>
      </div>
    );
  })() : null;


  // ── PSEUDO MODAL (first time only) ──
  if (showSplash) {
    return (
      <div style={{position:"fixed",inset:0,zIndex:9999,background:"#000",overflow:"hidden"}} key="splash">
        {/* Fond flou — visible seulement sur un écran plus large qu'un téléphone,
            où l'image est affichée en entier (voir .bbSplashImg dans le CSS). */}
        <img src={SPLASH_IMG} alt="" aria-hidden="true" className="bbSplashBlur"/>
        {/* Image de lancement */}
        <img src={SPLASH_IMG} alt="" className="bbSplashImg"/>
        {/* Visuel paysage pour les écrans larges (voir .bbSplashWide) */}
        <div className="bbSplashWide" aria-hidden="true"/>
        {/* Barre de chargement */}
        <div style={{position:"absolute",bottom:55,left:"50%",transform:"translateX(-50%)",width:120,zIndex:5}}>
          <div style={{height:3,background:"rgba(255,255,255,.15)",borderRadius:2,overflow:"hidden"}}>
            <div style={{height:"100%",background:"#00E676",borderRadius:2,animation:"splashLoad 2.2s ease forwards"}}/>
          </div>
        </div>
      </div>
    );
  }

  const pseudoModal = pseudoScreen ? (
    <div style={{position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,.92)",backdropFilter:"blur(12px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:"calc(100% - 40px)",maxWidth:360,background:"rgba(10,20,10,.97)",borderRadius:28,padding:"32px 24px",border:"1px solid rgba(255,255,255,.1)",position:"relative"}}>
        {/* Bouton fermer — seulement si pas encore de pseudo */}
        {<button onClick={function(){setPseudoScreen(false);}} style={{position:"absolute",top:14,right:14,background:"rgba(255,255,255,.1)",border:"none",borderRadius:"50%",width:30,height:30,color:"rgba(255,255,255,.5)",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>}
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{...posterText(52,G.white),lineHeight:.9}}>GOAT<span style={{color:G.projecteur}}>FC</span></div>
          <div style={{fontSize:12,color:"rgba(255,255,255,.4)",marginTop:8,letterSpacing:2}}>{tr("CHOISIS TON PSEUDO","CHOOSE YOUR USERNAME","WÄHLE DEINEN NAMEN","SCEGLI IL TUO NOME","ESCOLHA SEU NOME")}</div>
        </div>
        <input
          value={pseudoInput}
          onChange={function(e){setPseudoInput(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g,""));setPseudoMsg("");}}
          onKeyDown={function(e){if(e.key==="Enter")checkAndSavePseudo(pseudoInput);}}
          placeholder={tr("Ton pseudo unique...","Your unique username...","Dein einzigartiger Name...","Il tuo nome unico...","Seu nome único...")}
          maxLength={12}
          autoFocus
          style={{width:"100%",background:"rgba(255,255,255,.06)",border:"1.5px solid rgba(255,255,255,.15)",borderRadius:14,padding:"14px 16px",fontFamily:G.font,fontSize:17,color:G.white,outline:"none",boxSizing:"border-box",marginBottom:8,textAlign:"center"}}
        />
        {pseudoMsg && <div style={{fontSize:13,fontWeight:700,color:pseudoMsg.startsWith("❌")?"#FF3D57":"#00E676",marginBottom:8,textAlign:"center"}}>{pseudoMsg}</div>}
        <div style={{fontSize:11,color:"rgba(255,255,255,.2)",marginBottom:16,textAlign:"center"}}>{tr("3–12 caractères · lettres, chiffres, _ et . · pas d'espaces","3–12 characters · letters, digits, _ and . · no spaces","3–12 Zeichen · Buchstaben, Ziffern, _ und . · keine Leerzeichen","3–12 caratteri · lettere, cifre, _ e . · niente spazi","3–12 caracteres · letras, números, _ e . · sem espaços")}</div>
        <button
          onClick={function(){checkAndSavePseudo(pseudoInput);}}
          disabled={pseudoChecking||pseudoInput.trim().length<3}
          style={{width:"100%",padding:"15px",background:pseudoInput.trim().length>=3?G.accent:"rgba(255,255,255,.08)",color:pseudoInput.trim().length>=3?"#000":"rgba(255,255,255,.3)",border:"none",borderRadius:50,cursor:pseudoInput.trim().length>=3?"pointer":"not-allowed",fontFamily:G.font,fontSize:15,fontWeight:800}}
        >
          {pseudoChecking?(tr("Vérification...","Checking...","Prüfe...","Verifica...","Verificando...")):(tr("Confirmer →","Confirm →","Bestätigen →","Conferma →","Confirmar →"))}
        </button>
        {/* Séparateur + bouton récupération de compte */}
        <div style={{display:"flex",alignItems:"center",margin:"18px 0 12px",gap:10}}>
          <div style={{flex:1,height:1,background:"rgba(255,255,255,.1)"}}/>
          <span style={{fontSize:10,color:"rgba(255,255,255,.3)",letterSpacing:1}}>{tr("OU","OR","ODER","OPPURE","OU")}</span>
          <div style={{flex:1,height:1,background:"rgba(255,255,255,.1)"}}/>
        </div>
        <button
          onClick={function(){setShowRecoveryInput(true);setRecoveryInput("");setRecoveryMsg("");}}
          style={{width:"100%",padding:"13px",background:"rgba(255,255,255,.06)",color:"rgba(255,255,255,.85)",border:"1.5px solid rgba(255,255,255,.15)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}
        >
          🔐 {tr("J'ai déjà un compte","I already have an account","Ich habe schon ein Konto","Ho già un account","Já tenho uma conta")}
        </button>
      </div>
    </div>
  ) : null;

  // ── MODAL : Affichage du code de récupération après création ──
  const recoveryCodeAfterCreationModal = showRecoveryCodeModal ? (
    <div style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,.92)",backdropFilter:"blur(12px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{width:"100%",maxWidth:380,background:"rgba(10,20,10,.97)",borderRadius:28,padding:"32px 24px",border:"1.5px solid rgba(0,230,118,.35)",boxShadow:"0 10px 40px rgba(0,230,118,.15)"}}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:44,marginBottom:8}}>🔐</div>
          <div style={{fontFamily:G.heading,fontSize:24,color:G.white,lineHeight:1.1,marginBottom:6}}>{tr("Ton code de récupération","Your recovery code","Dein Wiederherstellungscode","Il tuo codice di recupero","Seu código de recuperação")}</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,.55)"}}>{tr("Sauvegarde-le pour retrouver ton compte sur un autre appareil","Save it to access your account from another device","Speichere ihn, um dein Konto auf einem anderen Gerät zu nutzen","Salvalo per accedere al tuo account da un altro dispositivo","Guarde-o para acessar sua conta em outro aparelho")}</div>
        </div>
        <div style={{background:G.accent,borderRadius:14,padding:"22px 16px",textAlign:"center",marginBottom:16,boxShadow:"0 4px 20px rgba(0,230,118,.25)"}}>
          <div style={{fontFamily:"ui-monospace, Menlo, monospace",fontSize:22,fontWeight:800,color:"#000",letterSpacing:2,userSelect:"all"}}>{showRecoveryCodeModal.code}</div>
        </div>
        <button
          onClick={async function(){
            try { await navigator.clipboard.writeText(showRecoveryCodeModal.code); setPseudoMsg(tr("✓ Copié !","✓ Copied!","✓ Kopiert!","✓ Copiato!","✓ Copiado!")); } catch {}
          }}
          style={{width:"100%",padding:"11px",background:"rgba(255,255,255,.06)",color:G.white,border:"1px solid rgba(255,255,255,.15)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:700,marginBottom:14}}
        >
          📋 {tr("Copier","Copy","Kopieren","Copia","Copiar")}
        </button>
        <div style={{background:"rgba(255,214,0,.08)",border:"1px solid rgba(255,214,0,.3)",borderRadius:12,padding:"11px 14px",marginBottom:16}}>
          <div style={{fontSize:12,color:"rgba(255,214,0,.95)",lineHeight:1.5}}>⚠️ {tr("Sans ce code, tu ne pourras pas récupérer ton compte si tu changes de téléphone.","Without this code, you won't be able to recover your account if you change phone.","Ohne diesen Code kannst du dein Konto bei einem Handywechsel nicht wiederherstellen.","Senza questo codice non potrai recuperare l'account se cambi telefono.","Sem este código, você não poderá recuperar sua conta se trocar de telefone.")}</div>
        </div>
        <label style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:16,cursor:"pointer"}}>
          <input type="checkbox" checked={recoveryConfirmed} onChange={function(e){setRecoveryConfirmed(e.target.checked);}} style={{marginTop:2,cursor:"pointer"}}/>
          <span style={{fontSize:13,color:"rgba(255,255,255,.85)",lineHeight:1.4}}>{tr("J'ai bien noté mon code en lieu sûr","I've saved my code somewhere safe","Ich habe meinen Code sicher gespeichert","Ho salvato il mio codice in un posto sicuro","Guardei meu código em local seguro")}</span>
        </label>
        <button
          onClick={function(){setShowRecoveryCodeModal(null);setRecoveryConfirmed(false);}}
          disabled={!recoveryConfirmed}
          style={{width:"100%",padding:"15px",background:recoveryConfirmed?G.accent:"rgba(255,255,255,.06)",color:recoveryConfirmed?"#000":"rgba(255,255,255,.3)",border:"none",borderRadius:50,cursor:recoveryConfirmed?"pointer":"not-allowed",fontFamily:G.font,fontSize:15,fontWeight:800}}
        >
          {tr("OK, c'est noté","OK, I've saved it","OK, gespeichert","OK, salvato","OK, guardado")}
        </button>
      </div>
    </div>
  ) : null;

  // ── MODAL : Saisie du code pour récupérer un compte ──
  const recoveryInputModal = showRecoveryInput ? (
    <div style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,.92)",backdropFilter:"blur(12px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{width:"100%",maxWidth:360,background:"rgba(10,20,10,.97)",borderRadius:28,padding:"28px 24px",border:"1px solid rgba(255,255,255,.1)",position:"relative"}}>
        <button onClick={function(){setShowRecoveryInput(false);}} style={{position:"absolute",top:14,right:14,background:"rgba(255,255,255,.1)",border:"none",borderRadius:"50%",width:30,height:30,color:"rgba(255,255,255,.5)",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        <div style={{textAlign:"center",marginBottom:22}}>
          <div style={{fontSize:40,marginBottom:6}}>🔐</div>
          <div style={{fontFamily:G.heading,fontSize:22,color:G.white,lineHeight:1.1,marginBottom:6}}>{tr("Récupérer mon compte","Recover my account","Mein Konto wiederherstellen","Recupera il mio account","Recuperar minha conta")}</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,.55)"}}>{tr("Entre le code que tu as sauvegardé","Enter the code you saved","Gib den gespeicherten Code ein","Inserisci il codice che hai salvato","Digite o código que você salvou")}</div>
        </div>
        <input
          value={recoveryInput}
          onChange={function(e){setRecoveryInput(e.target.value.toUpperCase());setRecoveryMsg("");}}
          onKeyDown={function(e){if(e.key==="Enter")recoverAccount();}}
          placeholder="GOATFC-XXXX-XXXX"
          autoFocus
          maxLength={16}
          style={{width:"100%",background:"rgba(255,255,255,.06)",border:"1.5px solid rgba(255,255,255,.15)",borderRadius:14,padding:"14px 16px",fontFamily:"ui-monospace, Menlo, monospace",fontSize:17,color:G.white,outline:"none",boxSizing:"border-box",marginBottom:10,textAlign:"center",letterSpacing:1.5}}
        />
        {recoveryMsg && <div style={{fontSize:13,fontWeight:700,color:recoveryMsg.startsWith("❌")?"#FF3D57":G.accent,marginBottom:10,textAlign:"center"}}>{recoveryMsg}</div>}
        <button
          onClick={recoverAccount}
          disabled={recoveryLoading||recoveryInput.trim().length<16}
          style={{width:"100%",padding:"15px",background:recoveryInput.trim().length>=16?G.accent:"rgba(255,255,255,.08)",color:recoveryInput.trim().length>=16?"#000":"rgba(255,255,255,.3)",border:"none",borderRadius:50,cursor:recoveryInput.trim().length>=16?"pointer":"not-allowed",fontFamily:G.font,fontSize:15,fontWeight:800,marginTop:6}}
        >
          {recoveryLoading?(tr("Récupération...","Recovering...","Wiederherstellung...","Recupero...","Recuperando...")):(tr("Récupérer →","Recover →","Wiederherstellen →","Recupera →","Recuperar →"))}
        </button>
      </div>
    </div>
  ) : null;

  // ── MODAL : Affichage du code depuis le profil (l'user a cliqué "Mon code de récup") ──
  const myRecoveryCodeModal = showMyRecoveryCode ? (
    <div style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,.92)",backdropFilter:"blur(12px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{width:"100%",maxWidth:380,background:"rgba(10,20,10,.97)",borderRadius:28,padding:"32px 24px",border:"1.5px solid rgba(0,230,118,.35)",position:"relative"}}>
        <button onClick={function(){setShowMyRecoveryCode(false);}} style={{position:"absolute",top:14,right:14,background:"rgba(255,255,255,.1)",border:"none",borderRadius:"50%",width:30,height:30,color:"rgba(255,255,255,.5)",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:44,marginBottom:8}}>🔐</div>
          <div style={{fontFamily:G.heading,fontSize:22,color:G.white,lineHeight:1.1,marginBottom:6}}>{tr("Mon code de récupération","My recovery code","Mein Wiederherstellungscode","Il mio codice di recupero","Meu código de recuperação")}</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,.55)"}}>{tr("Utilise-le pour retrouver ton compte sur un autre appareil","Use it to access your account from another device","Nutze ihn, um dein Konto auf einem anderen Gerät zu öffnen","Usalo per accedere al tuo account da un altro dispositivo","Use-o para acessar sua conta em outro aparelho")}</div>
        </div>
        <div style={{background:G.accent,borderRadius:14,padding:"22px 16px",textAlign:"center",marginBottom:14,boxShadow:"0 4px 20px rgba(0,230,118,.25)"}}>
          <div style={{fontFamily:"ui-monospace, Menlo, monospace",fontSize:recoveryCode?22:14,fontWeight:800,color:"#000",letterSpacing:recoveryCode?2:0,userSelect:"all"}}>
            {recoveryCode || (tr("Chargement...","Loading...","Wird geladen...","Caricamento...","Carregando..."))}
          </div>
        </div>
        {recoveryCode ? (
          <button
            onClick={async function(){
              try { await navigator.clipboard.writeText(recoveryCode); } catch {}
            }}
            style={{width:"100%",padding:"12px",background:"rgba(255,255,255,.06)",color:G.white,border:"1px solid rgba(255,255,255,.15)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:700}}
          >
            📋 {tr("Copier","Copy","Kopieren","Copia","Copiar")}
          </button>
        ) : (
          <div style={{fontSize:12,color:"rgba(255,255,255,.5)",textAlign:"center",lineHeight:1.5}}>
            {tr("Génération de ton code en cours...","Generating your code...","Dein Code wird erstellt...","Generazione del codice...","Gerando seu código...")}
          </div>
        )}
      </div>
    </div>
  ) : null;


  // ── WAITING ROOM ──
  if (waitingDuel) {
    const isChal = waitingDuel.challenger_id === playerId;
    const oppName = isChal ? waitingDuel.opponent_name : waitingDuel.challenger_name;
    const isReady = waitingDuel.status === "ready";
    if (duelCountdown !== null) {
      return (
        <div style={{...shell,alignItems:"center",justifyContent:"center"}} key="countdown">
          <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        {/* Bandes pelouse */}
        {[0,1,2,3,4,5,6].map(function(i){return(
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#0E1F14":"#132819"}}/>
        );})}
        {/* Ligne médiane */}
        <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
        {/* Cercle central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
        {/* Point central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:8,height:8,borderRadius:"50%",background:"rgba(255,255,255,.2)"}}/>
        {/* Overlay sombre pour lisibilité */}
        <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
      </div>
          <div style={{textAlign:"center",zIndex:1}}>
            <div style={{fontSize:14,color:"rgba(255,255,255,.5)",letterSpacing:3,textTransform:"uppercase",marginBottom:16}}>{tr("Adversaire trouvé !","Opponent found!","Gegner gefunden!","Avversario trovato!","Adversário encontrado!")}</div>
            <div style={{fontFamily:G.heading,fontSize:120,color:G.accent,lineHeight:1,animation:"popIn .3s ease"}} key={duelCountdown}>{duelCountdown}</div>
            <div style={{fontSize:16,color:"rgba(255,255,255,.5)",marginTop:16}}>vs <strong style={{color:G.white}}>{oppName}</strong></div>
          </div>
        </div>
      );
    }
    return (
      <div style={{...shell,alignItems:"center",justifyContent:"center"}} key="waiting">
        <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        {/* Bandes pelouse */}
        {[0,1,2,3,4,5,6].map(function(i){return(
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#0E1F14":"#132819"}}/>
        );})}
        {/* Ligne médiane */}
        <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
        {/* Cercle central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
        {/* Point central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:8,height:8,borderRadius:"50%",background:"rgba(255,255,255,.2)"}}/>
        {/* Overlay sombre pour lisibilité */}
        <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
      </div>
        <div style={{textAlign:"center",zIndex:1,padding:"0 32px"}}>
          <div style={{fontSize:48,marginBottom:16,animation:"spin 2s linear infinite",display:"inline-block"}}>⚽</div>
          <div style={{fontFamily:G.heading,fontSize:32,color:G.white,marginBottom:8}}>
            {isReady ? (tr("PRÊT !","READY!","BEREIT!","PRONTO!","PRONTO!")) : (tr("EN ATTENTE...","WAITING...","WARTEN...","IN ATTESA...","AGUARDANDO..."))}
          </div>
          <div style={{fontSize:14,color:"rgba(255,255,255,.5)",marginBottom:32}}>
            {isReady ? (tr("La partie va commencer !","Game about to start!","Das Spiel startet gleich!","La partita sta per iniziare!","O jogo vai começar!")) : (tr("En attente de ","Waiting for ","Warte auf ","In attesa di ","Aguardando ")+oppName+"...")}
          </div>
          <div style={{background:"rgba(255,255,255,.06)",borderRadius:20,padding:"16px 24px",marginBottom:24,border:"1px solid rgba(255,255,255,.08)"}}>
            <div style={{fontSize:11,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>Mode</div>
            <div style={{fontSize:16,fontWeight:800,color:G.white}}>{waitingDuel.mode==="pont"?"The Plug":"The Mercato"}{waitingDuel.diff?" · "+waitingDuel.diff:""}</div>
          </div>
          {!isReady && (
            <button onClick={cancelWaiting} style={{padding:"12px 28px",background:"rgba(255,61,87,.15)",color:"#FF3D57",border:"1px solid rgba(255,61,87,.3)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>
              Annuler
            </button>
          )}
        </div>
      </div>
    );
  }


  // ── ROOM RESULT (priorité sur l'écran d'attente) ──
  if (duelResult && duelResult.isRoom) {
    const medals = ["🥇","🥈","🥉"];
    const myEntry = duelResult.players.find(function(p){return p.id===playerId;});
    const myRank = duelResult.players.findIndex(function(p){return p.id===playerId;}) + 1;
    const winner = duelResult.players[0];
    const L_msg = RESULT_MESSAGES[(lang==="fr"?"fr":"en")];
    const oppNameRoom = (winner && winner.id !== playerId) ? winner.name : "";
    const iAbandoned = duelResult.myAbandoned === true;
    let msg;
    if (iAbandoned) {
      // J'ai abandonné → message spécifique
      msg = tr("T'as même pas eu le courage d'aller au bout 😂","You didn't even finish the match 😂","Du hast das Match nicht mal beendet 😂","Non hai nemmeno finito la partita 😂","Você nem terminou a partida 😂");
    } else if (myRank === 1) {
      // Je gagne → message de victoire (on passe le nom du 2e pour oppName si besoin)
      const runnerUp = duelResult.players[1];
      const opp = runnerUp ? runnerUp.name : "";
      const fn = pickResultMessage(L_msg.winCentral, (myEntry?.score||0));
      msg = typeof fn === "function" ? fn(opp) : fn;
    } else {
      // Je perds → message de défaite (oppName = vainqueur)
      const fn = pickResultMessage(L_msg.loseCentral, myRank * 3);
      msg = typeof fn === "function" ? fn(oppNameRoom) : fn;
    }
    return (
      <div style={{...shell,animation:"fadeUp .4s ease",overflow:isDesktop?"visible":"auto"}} key="roomResult2">
        <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
          {[0,1,2,3,4,5,6].map(function(i){return(<div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#0E1F14":"#132819"}}/>);})}
          <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
          <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
        </div>
        <div style={{zIndex:1,padding:"32px 20px 12px",textAlign:"center"}}>
          <div style={{fontSize:52,marginBottom:8}}>{iAbandoned?"🏳️":(myRank<=3?medals[myRank-1]:myRank+"ème")}</div>
          <div style={{fontFamily:G.heading,fontSize:"clamp(30px,8vw,50px)",color:iAbandoned?"#FF3D57":(myRank===1?G.gold:G.white),letterSpacing:2}}>
            {iAbandoned?(tr("ABANDON","FORFEIT","AUFGABE","RESA","DESISTÊNCIA")):(myRank===1?(tr("VICTOIRE !","VICTORY!","SIEG!","VITTORIA!","VITÓRIA!")):myRank===2?(tr("2ÈME PLACE","2ND PLACE","2. PLATZ","2° POSTO","2º LUGAR")):myRank===3?(tr("3ÈME PLACE","3RD PLACE","3. PLATZ","3° POSTO","3º LUGAR")):(tr("RÉSULTATS","RESULTS","ERGEBNISSE","RISULTATI","RESULTADOS")))}
          </div>
          <div style={{fontSize:18,color:iAbandoned?"#fff":(myRank===1?G.gold:"#fff"),marginTop:12,fontWeight:800,padding:"0 16px",lineHeight:1.4,textAlign:"center",animation:"popIn .6s cubic-bezier(.22,1,.36,1) .4s both",textShadow:myRank===1&&!iAbandoned?"0 0 20px rgba(255,214,0,.4)":"none"}}>{msg}</div>
          {!iAbandoned && <WinBanner maxWidth={300} marginTop={10} lose={myRank!==1} />}
        </div>
        <div style={{...sheet,borderRadius:"28px 28px 0 0"}}>
          {duelResult.players.map(function(p,i){
            const hasRounds = Array.isArray(p.rounds) && p.rounds.length > 0;
            const onClickHandler = hasRounds ? function(){
              setReviewRoundsModal({
                mode: duelResult.mode || "pont",
                playerName: p.name + (p.id===playerId ? (tr(" (toi)"," (you)"," (du)"," (tu)"," (você)")) : ""),
                rounds: p.rounds,
              });
            } : null;
            return (
            <div key={i} onClick={onClickHandler} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:14,background:p.id===playerId?"rgba(0,230,118,.08)":"rgba(255,255,255,.03)",border:p.id===playerId?"1px solid rgba(0,230,118,.25)":"1px solid rgba(255,255,255,.05)",marginBottom:6,cursor:hasRounds?"pointer":"default"}}>
              <div style={{fontFamily:G.heading,fontSize:30,width:40,textAlign:"center",color:i<3?["#FFD600","#C0C0C0","#CD7F32"][i]:"rgba(255,255,255,.3)"}}>{i<3?medals[i]:i+1}</div>
              <div style={{flex:1,fontSize:14,fontWeight:800,color:p.id===playerId?G.accent:G.white}}>{p.name}{p.id===playerId?" (toi)":""}{p.abandoned?" 🏳️":""}</div>
              <div style={{fontFamily:G.heading,fontSize:26,color:i===0?G.gold:G.white}}>{p.score||0} <span style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>pts</span></div>
              {hasRounds && <div style={{fontSize:14,color:"rgba(255,214,0,.7)",marginLeft:4}}>👁️</div>}
            </div>
          );})}
          {duelResult.players.some(function(p){return Array.isArray(p.rounds) && p.rounds.length > 0;}) && (
            <div style={{fontSize:10,color:"rgba(255,255,255,.4)",textAlign:"center",marginTop:6,marginBottom:6,fontStyle:"italic"}}>
              👁️ {tr("Tape sur un joueur pour voir ses réponses","Tap a player to see their answers","Tippe auf einen Spieler, um seine Antworten zu sehen","Tocca un giocatore per vedere le sue risposte","Toque num jogador para ver suas respostas")}
            </div>
          )}
          {((!duelResult.isChain && roundAnswers.length>0) || (duelResult.isChain && chainHistory.length>0)) && (
            <button onClick={()=>setShowHistory(true)} style={{width:"100%",padding:"13px",background:"rgba(251,226,22,.12)",color:"#FBE216",border:"1.5px solid rgba(251,226,22,.5)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:8}}>
              📋 {duelResult.isChain?(tr("Voir ma chaîne","See my chain","Meine Kette ansehen","Vedi la mia catena","Ver minha corrente")):(tr("Récap des questions","Questions recap","Fragen-Übersicht","Riepilogo domande","Resumo das perguntas"))}
            </button>
          )}
          {/* Bouton Relancer (host uniquement) */}
          {duelResult.hostId && duelResult.hostId === playerId && (
            <button onClick={restartRoom} style={{width:"100%",padding:"14px",background:"linear-gradient(135deg,#00E676,#00B85F)",color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:900,marginTop:8,letterSpacing:1}}>
              🔄 {tr("RELANCER","REMATCH","REVANCHE","RIVINCITA","REVANCHE")}
            </button>
          )}
          {duelResult.hostId && duelResult.hostId !== playerId && duelResult.isRoom && (
            <div style={{textAlign:"center",fontSize:11,color:"rgba(255,255,255,.5)",marginTop:8,fontStyle:"italic"}}>
              {tr("En attente d'une revanche...","Waiting for the host to rematch...","Warten auf Revanche vom Host...","In attesa della rivincita dell'host...","Aguardando a revanche do anfitrião...")}
            </div>
          )}
          <button onClick={function(){setDuelResult(null);setScreen("home");}} style={{width:"100%",padding:"16px",background:G.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800,marginTop:8}}>
            {tr("Retour à l'accueil","Back home","Zurück zum Start","Torna alla home","Voltar ao início")}
          </button>
        </div>
        {historyModal}
        {reportModal}
      </div>
    );
  }

  // ── WAITING FOR ROOM RESULTS ──
  if (waitingForRoom || screen==="waitingRoom") {
    return (
      <div style={{...shell,alignItems:"center",justifyContent:"center"}} key="waitingRoom">
        <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
          {[0,1,2,3,4,5,6].map(function(i){return(<div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(i/7*100)+"%",background:i%2===0?"#0E1F14":"#132819"}}/>);})}
          <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
          <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
        </div>
        <div style={{textAlign:"center",zIndex:1,padding:"0 32px"}}>
          {waitingAfterAbandon ? (
            <>
              <div style={{fontSize:64,marginBottom:20}}>🏳️</div>
              <div style={{fontFamily:G.heading,fontSize:36,color:"#FF3D57",marginBottom:16,letterSpacing:2}}>{tr("ABANDON","FORFEIT","AUFGABE","RESA","DESISTÊNCIA")}</div>
              <div style={{fontSize:17,color:G.white,fontWeight:800,marginBottom:28,lineHeight:1.4,padding:"0 8px"}}>{
                abandonedAfterOppLeft
                  ? (tr("Pas de match, pas de drame. Reviens quand tu veux 🤝","No match, no drama. Come back anytime 🤝","Kein Match, kein Drama. Komm jederzeit wieder 🤝","Niente partita, niente dramma. Torna quando vuoi 🤝","Sem partida, sem drama. Volte quando quiser 🤝"))
                  : (tr("T'as même pas eu le courage d'aller au bout 😂","You didn't even finish 😂","Du hast nicht mal zu Ende gespielt 😂","Non hai nemmeno finito 😂","Você nem terminou 😂"))
              }</div>
              <button onClick={function(){
                clearInterval(roomPollRef.current);
                setWaitingForRoom(false);
                setWaitingAfterAbandon(false);
                setAbandonedAfterOppLeft(false);
                setDuelResult(null);
                setScreen("home");
              }} style={{width:"100%",maxWidth:280,padding:"16px",background:G.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800}}>{tr("Retour à l'accueil","Back home","Zurück zum Start","Torna alla home","Voltar ao início")}</button>
            </>
          ) : (
            <>
              <div style={{fontSize:56,marginBottom:20}}>⏳</div>
              <div style={{fontFamily:G.heading,fontSize:30,color:G.white,marginBottom:12,letterSpacing:1}}>{tr("PARTIE TERMINÉE !","GAME OVER!","GAME OVER!","GAME OVER!","FIM DE JOGO!")}</div>
              <div style={{fontSize:16,color:G.accent,fontWeight:800,marginBottom:10}}>{tr("Tu as fini ta partie 💪","You finished your game 💪","Du hast dein Spiel beendet 💪","Hai finito la tua partita 💪","Você terminou seu jogo 💪")}</div>
              <div style={{fontSize:14,color:"rgba(255,255,255,.6)",lineHeight:1.7,marginBottom:8}}>{tr("Les autres joueurs sont encore en train de jouer.","The other players are still playing.","Die anderen Spieler spielen noch.","Gli altri giocatori stanno ancora giocando.","Os outros jogadores ainda estão jogando.")}</div>
              <div style={{fontSize:14,color:"rgba(255,255,255,.9)",fontWeight:700,lineHeight:1.7,marginBottom:24,background:"rgba(255,255,255,.07)",borderRadius:14,padding:"12px 16px"}}>{tr("👉 Reste sur cet écran — les résultats apparaîtront automatiquement dès que tout le monde aura terminé.","👉 Stay on this screen — results will appear automatically as soon as everyone is done.","👉 Bleib auf diesem Bildschirm — die Ergebnisse erscheinen automatisch, sobald alle fertig sind.","👉 Resta su questa schermata — i risultati appariranno automaticamente appena tutti avranno finito.","👉 Fique nesta tela — os resultados aparecerão automaticamente assim que todos terminarem.")}</div>
              {abandonNotif && <div style={{fontSize:13,color:"#000",fontWeight:800,marginBottom:16,background:"rgba(255,214,0,.9)",borderRadius:12,padding:"10px 14px"}}>{abandonNotif}</div>}
              <div style={{display:"flex",justifyContent:"center",gap:6}}>
                {[0,1,2].map(i=>(
                  <div key={i} style={{width:8,height:8,borderRadius:"50%",background:G.accent,animation:`pulse 1.2s ease-in-out ${i*.3}s infinite`}}/>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── HOME ──
  // ── USER PROFILE SCREEN (other player) ──
  if(screen==="userProfile" && viewedProfile) {
    const d = viewedProfileData;
    const grade = d ? getGrade(d.xp || 0) : null;
    return (
      <div style={{...shell,overflow:isDesktop?"visible":"auto"}} key="userProfile">
        <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
          {[0,1,2,3,4,5,6].map(function(i){return(
            <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#0E1F14":"#132819"}}/>
          );})}
          <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.7)"}}/>
        </div>
        <div style={{zIndex:50,padding:"max(16px, env(safe-area-inset-top)) 16px 8px",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,background:"rgba(0,15,0,.92)",backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)"}}>
          <button onClick={()=>{const ret=profileReturn;setViewedProfile(null);setFriendMsg("");setProfileReturn(null);setScreen("home");if(ret==="leaderboard"){setShowLeaderboard(true);}else if(ret==="friends"){setShowFriends(true);}}} style={{background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.15)",borderRadius:"50%",width:40,height:40,cursor:"pointer",color:G.white,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 4px 14px rgba(0,0,0,.4)"}}>←</button>
          <div style={{fontFamily:G.heading,fontSize:22,color:G.white,letterSpacing:2,flex:1}}>{tr("PROFIL","PROFILE","PROFIL","PROFILO","PERFIL")}</div>
        </div>
        {!d ? (
          <div style={{zIndex:1,padding:"60px 20px",textAlign:"center",color:"rgba(255,255,255,.5)"}}>{tr("Chargement...","Loading...","Wird geladen...","Caricamento...","Carregando...")}</div>
        ) : (
          <>
            <div style={{zIndex:1,padding:"16px 20px 8px",textAlign:"center"}}>
              <div style={{width:84,height:112,borderRadius:10,margin:"0 auto 14px",border:"2px solid rgba(255,255,255,.3)",background:"#000",display:"flex",alignItems:"center",justifyContent:"center",fontSize:44,color:"#fff",boxShadow:"0 8px 30px rgba(0,230,118,.35)",overflow:"hidden",position:"relative"}}>
                {/* Photo de profil = carte du niveau du joueur consulté. */}
                <img src={levelCard(d.xp || 0).img || undefined} alt="" onClick={function(){ const c = levelCard(d.xp || 0); if (c.img) setViewingAvatar(c.img); }} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",objectPosition:"top",cursor:"zoom-in"}}/>
              </div>
              <div style={{fontFamily:G.heading,fontSize:28,color:G.white,letterSpacing:1}}>@{viewedProfile.name}</div>
              {grade && (
                <div style={{marginTop:6,display:"inline-block",fontSize:11,fontWeight:800,color:grade.color,background:grade.color+"22",borderRadius:20,padding:"3px 12px",letterSpacing:1}}>{grade.emoji} {grade.label}</div>
              )}
              {d.rank && (
                <div style={{marginTop:8,fontSize:13,color:"rgba(255,255,255,.6)"}}>{tr("Classement : #","Rank: #","Rang: #","Posizione: #","Posição: #")}{d.rank}</div>
              )}
            </div>
            <div style={{zIndex:1,padding:"8px 16px",display:"flex",gap:10}}>
              {!d.isFriend ? (
                d.requestSent ? (
                  <button disabled style={{flex:1,padding:"13px",background:"rgba(255,255,255,.07)",color:"rgba(255,255,255,.5)",border:"1px solid rgba(255,255,255,.15)",borderRadius:50,cursor:"default",fontFamily:G.font,fontSize:14,fontWeight:700}}>{tr("✓ Demande envoyée","✓ Request sent","✓ Anfrage gesendet","✓ Richiesta inviata","✓ Pedido enviado")}</button>
                ) : (
                  <button onClick={()=>{requirePseudo(function(){addFriend(viewedProfile.name);});}} style={{flex:1,padding:"13px",background:G.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800}}>{tr("+ Ajouter en ami","+ Add friend","+ Freund hinzufügen","+ Aggiungi amico","+ Adicionar amigo")}</button>
                )
              ) : (
                <button onClick={()=>{setConfirmRemove({id:viewedProfile.id,name:viewedProfile.name});}} style={{flex:1,padding:"13px",background:"rgba(255,255,255,.07)",color:"rgba(255,255,255,.7)",border:"1px solid rgba(255,255,255,.15)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>{tr("✓ Ami · Retirer","✓ Friend · Remove","✓ Freund · Entfernen","✓ Amico · Rimuovi","✓ Amigo · Remover")}</button>
              )}
              <button onClick={()=>requirePseudo(function(){setShowDuelCreate({id:viewedProfile.id,name:viewedProfile.name});})} style={{flex:1,padding:"13px",background:"linear-gradient(135deg,#FFD600,#FF6B35)",color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800}}>{tr("⚡ Défier","⚡ Challenge","⚡ Herausfordern","⚡ Sfida","⚡ Desafiar")}</button>
            </div>
            {/* Collection du joueur consulté : déduite de son XP, comme pour soi.
                Seules les cartes illustrées sont montrées. */}
            {(function(){
              const ses = unlockedCards(d.xp || 0).filter(hasArt);
              if (!ses.length) return null;
              return (
                <>
                  <div style={{zIndex:1,padding:"16px 20px 0",fontSize:10.5,fontWeight:800,letterSpacing:3,textTransform:"uppercase",color:"rgba(255,255,255,.4)"}}>{tr("Sa collection","Their collection","Seine Sammlung","La sua collezione","A coleção dele")}</div>
                  <div style={{zIndex:1,margin:"10px 16px 0",padding:"14px 16px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:16}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                      <span style={{fontFamily:G.heading,fontSize:24,color:G.accent,lineHeight:1}}>{ses.length}</span>
                      <span style={{fontSize:12.5,color:"rgba(255,255,255,.55)",fontWeight:700}}>/ {CARDS.filter(hasArt).length} {tr("cartes","cards","Karten","carte","cartas")}</span>
                    </div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {ses.map(function(c){
                        const rm = rarityMeta(c.rarity);
                        return <img key={c.id} src={c.thumb} alt="" title={lang==="fr"?c.name:c.nameEn} style={{width:38,height:50,borderRadius:7,objectFit:"cover",border:"1.5px solid "+rm.color}}/>;
                      })}
                    </div>
                  </div>
                </>
              );
            })()}
            {friendMsg && !d.isFriend && (
              <div style={{zIndex:1,padding:"0 16px 8px",fontSize:12,color:friendMsg.indexOf("✓")>=0?G.accent:friendMsg.indexOf("❌")>=0?G.red:"rgba(255,255,255,.7)",textAlign:"center",fontWeight:700}}>{friendMsg}</div>
            )}
            <div style={{zIndex:1,padding:"14px 20px 2px",fontSize:10.5,fontWeight:800,letterSpacing:3,textTransform:"uppercase",color:"rgba(255,255,255,.4)"}}>{tr("Statistiques","Stats","Statistiken","Statistiche","Estatísticas")}</div>
            <div style={{zIndex:1,padding:"8px 16px 8px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {[
                {icon:"🏆", ac:"#00E676", label:tr("Record Plug","Plug record","Plug-Rekord","Record Plug","Recorde Plug"), val:d.bestPont||0},
                {icon:"⛓️", ac:"#3DA5FF", label:tr("Record Mercato","Mercato record","Mercato-Rekord","Record Mercato","Recorde Mercato"), val:d.bestChaine||0},
                {icon:"🎮", ac:"#C084FC", label:tr("Parties","Games","Spiele","Partite","Jogos"), val:d.played||0},
                {icon:"⭐", ac:"#FFC93C", label:"XP", val:d.xp||0},
              ].map(function(s,i){return(
                <div key={i} style={{background:`linear-gradient(160deg, ${s.ac}26 0%, rgba(255,255,255,.03) 55%, rgba(0,0,0,.25) 100%)`,border:`1px solid ${s.ac}55`,borderRadius:20,padding:"14px 16px",boxShadow:`0 14px 34px -16px ${s.ac}66`}}>
                  <div style={{width:38,height:38,borderRadius:G.rayonS,border:G.traitFin,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,background:`${s.ac}22`,border:`1px solid ${s.ac}55`,marginBottom:10}}>{s.icon}</div>
                  <div style={{fontFamily:G.heading,fontSize:34,color:s.ac,lineHeight:1,textShadow:`0 0 18px ${s.ac}55`}}>{s.val}</div>
                  <div style={{fontSize:10,fontWeight:800,letterSpacing:1.5,textTransform:"uppercase",color:"rgba(255,255,255,.45)",marginTop:6}}>{s.label}</div>
                </div>
              );})}
            </div>
            <div style={{zIndex:1,padding:"8px 16px"}}>
              <div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:14,padding:"10px",display:"flex"}}>
                <div style={{flex:1,textAlign:"center",borderRight:"1px solid rgba(255,255,255,.06)"}}>
                  <div style={{fontFamily:G.heading,fontSize:20,color:"#00E676"}}>{d.wins||0}</div>
                  <div style={{fontSize:9,color:"rgba(255,255,255,.4)",letterSpacing:1,textTransform:"uppercase"}}>{tr("Victoires","Wins","Siege","Vittorie","Vitórias")}</div>
                </div>
                <div style={{flex:1,textAlign:"center",borderRight:"1px solid rgba(255,255,255,.06)"}}>
                  <div style={{fontFamily:G.heading,fontSize:20,color:G.gold}}>{d.draws||0}</div>
                  <div style={{fontSize:9,color:"rgba(255,255,255,.4)",letterSpacing:1,textTransform:"uppercase"}}>{tr("Nuls","Draws","Unentschieden","Pareggi","Empates")}</div>
                </div>
                <div style={{flex:1,textAlign:"center"}}>
                  <div style={{fontFamily:G.heading,fontSize:20,color:"#FF3D57"}}>{d.losses||0}</div>
                  <div style={{fontSize:9,color:"rgba(255,255,255,.4)",letterSpacing:1,textTransform:"uppercase"}}>{tr("Défaites","Losses","Niederlagen","Sconfitte","Derrotas")}</div>
                </div>
              </div>
            </div>
            {d.duelsWith.length > 0 ? (
              <div style={{zIndex:1,padding:"16px 16px 8px"}}>
                <div style={{fontSize:11,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.5)",marginBottom:10}}>{tr("Vos parties (","Your games (","Deine Spiele (","Le tue partite (","Seus jogos (")}{d.duelsWith.length}{tr(")",")",")",")",")")}</div>
                <div style={{background:"rgba(255,255,255,.03)",borderRadius:14,padding:"10px",marginBottom:8,display:"flex",justifyContent:"space-around",border:"1px solid rgba(255,255,255,.06)"}}>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontFamily:G.heading,fontSize:18,color:"#00E676"}}>{d.myWins}</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,.4)",letterSpacing:1,textTransform:"uppercase"}}>{tr("Tes victoires","Your wins","Deine Siege","Le tue vittorie","Suas vitórias")}</div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontFamily:G.heading,fontSize:18,color:G.gold}}>{d.duelsDraws}</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,.4)",letterSpacing:1,textTransform:"uppercase"}}>{tr("Nuls","Draws","Unentschieden","Pareggi","Empates")}</div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontFamily:G.heading,fontSize:18,color:"#FF3D57"}}>{d.myLosses}</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,.4)",letterSpacing:1,textTransform:"uppercase"}}>{tr("Ses victoires","Their wins","Seine Siege","Le sue vittorie","As vitórias dele")}</div>
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {d.duelsWith.slice(0,10).map((duel, i) => {
                    const myScore = duel.my || 0;
                    const oppScore = duel.opp || 0;
                    const won = myScore > oppScore;
                    const draw = myScore === oppScore;
                    return (
                      <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"rgba(255,255,255,.03)",borderRadius:12,border:"1px solid rgba(255,255,255,.05)"}}>
                        <div style={{width:4,height:28,borderRadius:2,background:draw?"#FFD600":won?"#00E676":"#FF3D57"}}/>
                        <div style={{flex:1}}>
                          <div style={{fontSize:12,fontWeight:700,color:G.white}}>{draw?(tr("Match nul","Draw","Unentschieden","Pareggio","Empate")):won?(tr("Victoire","Win","Sieg","Vittoria","Vitória")):(tr("Défaite","Loss","Niederlage","Sconfitta","Derrota"))}</div>
                          <div style={{fontSize:10,color:"rgba(255,255,255,.4)"}}>{duel.mode==="pont"?"The Plug":"The Mercato"} · {duel.diff}</div>
                        </div>
                        <div style={{fontFamily:G.heading,fontSize:16,color:G.white}}>{myScore}–{oppScore}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{zIndex:1,padding:"20px 16px",textAlign:"center",color:"rgba(255,255,255,.4)",fontSize:13}}>{tr("Aucune partie encore jouée contre ce joueur","No game played against this player yet","Noch kein Spiel gegen diesen Spieler","Ancora nessuna partita contro questo giocatore","Nenhum jogo contra este jogador ainda")}</div>
            )}
            <div style={{zIndex:1,padding:"20px 16px 40px"}}/>
          </>
        )}
        {avatarViewer}
        {duelCreateModal}
      </div>
    );
  }

  // ── PROFILE SCREEN ──
  if(screen==="profile") return (
    <div style={{...shell,overflow:isDesktop?"visible":"auto"}} key="profile">
      <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        {[0,1,2,3,4,5,6].map(function(i){return(
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#0E1F14":"#132819"}}/>
        );})}
        <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.7)"}}/>
        <div style={{position:"absolute",top:-60,left:"50%",transform:"translateX(-50%)",width:460,height:360,background:"radial-gradient(ellipse at center, rgba(0,230,118,.20) 0%, transparent 65%)"}}/>
      </div>

      {/* Header */}
      <div style={{zIndex:2,padding:"16px 16px 8px",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,background:"rgba(0,15,0,.85)",backdropFilter:"blur(10px)"}}>
        <button onClick={()=>setScreen("home")} style={{background:"rgba(255,255,255,.1)",border:"none",borderRadius:"50%",width:38,height:38,cursor:"pointer",color:G.white,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>←</button>
        <div style={{...posterText(26,G.white),flex:1}}>{tr("MON ","MY ","MEIN ","IL MIO ","MEU ")}<span style={{color:G.projecteur}}>{tr("PROFIL","PROFILE","PROFIL","PROFILO","PERFIL")}</span></div>
      </div>

      {/* Avatar + Pseudo */}
      <div style={{zIndex:1,padding:"16px 20px 8px",textAlign:"center"}}>
        <div style={{display:"inline-block",width:116,height:154,margin:"0 auto 14px",position:"relative",padding:4,borderRadius:G.rayon,background:"conic-gradient(from 200deg, #2A9B4E, #2A6FBF, #F5C22B, #2A9B4E)",border:G.traitFin,boxShadow:G.ombreL}}>
          <div onClick={function(){ const c = avatarCard(playerBadge, playerXp); if (c.img) setViewingAvatar(c.img); }} style={{width:108,height:146,borderRadius:12,background:"#000",display:"flex",alignItems:"center",justifyContent:"center",fontSize:56,color:"#fff",boxShadow:"0 8px 30px rgba(0,230,118,.35)",overflow:"hidden",cursor:"pointer"}}>
            {/* La carte fait office de photo de profil pour tout le monde : elle
                remplace la photo uploadée, qui n'est plus affichée. */}
            <img src={avatarCard(playerBadge, playerXp).img} alt="" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}}/>
          </div>
          <button onClick={function(){setShowCollection(true);}} title={tr("Choisir une carte","Choose a card","Karte wählen","Scegli una carta","Escolher uma carta")} style={{position:"absolute",bottom:-2,right:-2,width:34,height:34,borderRadius:"50%",background:G.accent,border:"3px solid #0d1f0d",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,zIndex:2,cursor:"pointer",padding:0}}>🃏</button>
        </div>
        <div style={{...posterText(32,G.white)}}>@{playerName||(tr("anonyme","anonymous","anonym","anonimo","anônimo"))}</div>
        {(() => { const g = getGrade(playerXp); return (
          <div style={{display:"inline-flex",alignItems:"center",gap:6,marginTop:8,padding:"5px 14px",borderRadius:999,background:g.color+"1f",border:"1px solid "+g.color+"55",color:g.color,fontSize:11,fontWeight:800,letterSpacing:1.5,textTransform:"uppercase"}}>{g.emoji} {g.label}</div>
        ); })()}
      </div>

      {/* Niveau + XP progression */}
      <div style={{zIndex:1,padding:"0 16px 12px"}}>
        {(() => {
          const grade = getGrade(playerXp);
          // Trouver le prochain palier
          const sorted = [...GRADES].sort((a,b)=>a.min-b.min);
          const currentIdx = sorted.findIndex(g => g.min === grade.min);
          const nextGrade = currentIdx < sorted.length-1 ? sorted[currentIdx+1] : null;
          const progressPct = nextGrade
            ? Math.min(100, ((playerXp - grade.min) / (nextGrade.min - grade.min)) * 100)
            : 100;
          return (
            <div style={{background:"rgba(255,255,255,.05)",border:"1px solid "+grade.color+"55",borderRadius:18,padding:"14px 16px"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:28}}>{grade.emoji}</span>
                  <div>
                    <div style={{fontSize:10,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.5)"}}>{tr("Niveau","Level","Level","Livello","Nível")}</div>
                    <div style={{fontSize:14,fontWeight:800,color:grade.color}}>{grade.label}</div>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontFamily:G.heading,fontSize:22,color:G.white,lineHeight:1}}>{playerXp.toLocaleString()}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.4)",fontWeight:700,letterSpacing:1}}>pts</div>
                </div>
              </div>
              {nextGrade ? (
                <>
                  <div style={{height:8,background:"rgba(255,255,255,.08)",borderRadius:4,overflow:"hidden",marginBottom:6}}>
                    <div style={{height:"100%",width:progressPct+"%",background:`linear-gradient(90deg, ${grade.color}, ${nextGrade.color})`,borderRadius:4,transition:"width .5s ease",boxShadow:`0 0 12px ${grade.color}88`}}/>
                  </div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,.5)",textAlign:"center"}}>
                    {lang==="en"
                      ? `${(nextGrade.min - playerXp).toLocaleString()} XP to ${nextGrade.labelEn} ${nextGrade.emoji}`
                      : `${(nextGrade.min - playerXp).toLocaleString()} XP avant ${nextGrade.label} ${nextGrade.emoji}`}
                  </div>
                </>
              ) : (
                <div style={{fontSize:11,color:grade.color,textAlign:"center",fontWeight:800,letterSpacing:1,textTransform:"uppercase"}}>🏆 {tr("Niveau max atteint","Max level reached","Max-Level erreicht","Livello massimo raggiunto","Nível máximo atingido")}</div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Ma collection — dans le corps du profil (et plus seulement dans Mon
          compte) : c'est une récompense à montrer, pas un réglage. Aperçu des
          dernières cartes obtenues, la plus récente en tête. */}
      {(function(){
        const possedees = unlockedCards(playerXp);
        const apercu = possedees.filter(hasArt).slice(-5).reverse();
        const prochaine = progressToNext(playerXp);
        return (
          <>
            <div style={{zIndex:1,padding:"14px 20px 0",fontSize:10.5,fontWeight:800,letterSpacing:3,textTransform:"uppercase",color:"rgba(255,255,255,.4)"}}>{tr("Ma collection","My collection","Meine Sammlung","La mia collezione","Minha coleção")}</div>
            <div onClick={function(){setShowCollection(true);}} style={{zIndex:1,margin:"10px 16px 8px",padding:"14px 16px",background:G.nuit,border:G.traitFin,borderRadius:G.rayon,boxShadow:G.ombre,cursor:"pointer"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                <span style={{fontFamily:G.heading,fontSize:26,color:G.accent,lineHeight:1}}>{possedees.length}</span>
                <span style={{fontSize:12.5,color:"rgba(255,255,255,.55)",fontWeight:700}}>/ {CARDS.length} {tr("cartes","cards","Karten","carte","cartas")}</span>
                <span style={{flex:1}}/>
                {prochaine && <span style={{fontSize:11,color:"rgba(255,255,255,.4)",fontWeight:600}}>{tr("encore","next in","noch","ancora","faltam")} {prochaine.missing.toLocaleString("fr-FR")} XP</span>}
                <span style={{color:"rgba(255,255,255,.3)",fontSize:15}}>›</span>
              </div>
              <div style={{display:"flex",gap:8}}>
                {apercu.map(function(c){
                  const rm = rarityMeta(c.rarity);
                  return <img key={c.id} src={c.thumb} alt="" title={lang==="fr"?c.name:c.nameEn} style={{width:42,height:56,borderRadius:8,objectFit:"cover",border:"1.5px solid "+rm.color,flexShrink:0}}/>;
                })}
                {prochaine && (
                  <div style={{width:42,height:56,borderRadius:8,border:"1.5px dashed rgba(255,255,255,.18)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:15,color:"rgba(255,255,255,.35)"}}>🔒</div>
                )}
              </div>
            </div>
          </>
        );
      })()}

      {/* Stats cards */}
      <div style={{zIndex:1,padding:"14px 20px 0",fontSize:10.5,fontWeight:800,letterSpacing:3,textTransform:"uppercase",color:"rgba(255,255,255,.4)"}}>{tr("Statistiques","Stats","Statistiken","Statistiche","Estatísticas")}</div>
      <div style={{zIndex:1,padding:"10px 16px 8px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {/* Record Plug */}
        <div style={{background:"linear-gradient(160deg, rgba(0,230,118,.22), rgba(0,0,0,.35))",border:G.trait,borderRadius:G.rayon,padding:"14px 16px",boxShadow:G.ombre}}>
          <div style={{width:38,height:38,borderRadius:G.rayonS,border:G.traitFin,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,background:"rgba(0,230,118,.16)",border:"1px solid rgba(0,230,118,.35)",marginBottom:10}}>🏆</div>
          <div style={{fontFamily:G.heading,fontSize:34,color:"#00E676",lineHeight:1,textShadow:"0 0 18px rgba(0,230,118,.45)"}}>{record?record.score:0}</div>
          <div style={{fontSize:10,fontWeight:800,letterSpacing:1.5,textTransform:"uppercase",color:"rgba(255,255,255,.45)",marginTop:6}}>{tr("Record Plug","Plug record","Plug-Rekord","Record Plug","Recorde Plug")}</div>
        </div>
        {/* Record Mercato */}
        <div style={{background:"linear-gradient(160deg, rgba(61,165,255,.22), rgba(0,0,0,.35))",border:G.trait,borderRadius:G.rayon,padding:"14px 16px",boxShadow:G.ombre}}>
          <div style={{width:38,height:38,borderRadius:G.rayonS,border:G.traitFin,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,background:"rgba(61,165,255,.16)",border:"1px solid rgba(61,165,255,.35)",marginBottom:10}}>⛓️</div>
          <div style={{fontFamily:G.heading,fontSize:34,color:"#3DA5FF",lineHeight:1,textShadow:"0 0 18px rgba(61,165,255,.45)"}}>{chainRecord?chainRecord.score:0}</div>
          <div style={{fontSize:10,fontWeight:800,letterSpacing:1.5,textTransform:"uppercase",color:"rgba(255,255,255,.45)",marginTop:6}}>{tr("Record Mercato","Mercato record","Mercato-Rekord","Record Mercato","Recorde Mercato")}</div>
        </div>
        {/* Amis */}
        <div style={{background:"linear-gradient(160deg, rgba(255,201,60,.22), rgba(0,0,0,.35))",border:G.trait,borderRadius:G.rayon,padding:"14px 16px",boxShadow:G.ombre}}>
          <div style={{width:38,height:38,borderRadius:G.rayonS,border:G.traitFin,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,background:"rgba(255,201,60,.16)",border:"1px solid rgba(255,201,60,.35)",marginBottom:10}}>👥</div>
          <div style={{fontFamily:G.heading,fontSize:34,color:"#FFC93C",lineHeight:1,textShadow:"0 0 18px rgba(255,201,60,.45)"}}>{friendsList.length}</div>
          <div style={{fontSize:10,fontWeight:800,letterSpacing:1.5,textTransform:"uppercase",color:"rgba(255,255,255,.45)",marginTop:6}}>{tr("Amis","Friends","Freunde","Amici","Amigos")}</div>
        </div>
        {/* Parties */}
        <div style={{background:"linear-gradient(160deg, rgba(192,132,252,.22), rgba(0,0,0,.35))",border:G.trait,borderRadius:G.rayon,padding:"14px 16px",boxShadow:G.ombre}}>
          <div style={{width:38,height:38,borderRadius:G.rayonS,border:G.traitFin,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,background:"rgba(192,132,252,.16)",border:"1px solid rgba(192,132,252,.35)",marginBottom:10}}>🎮</div>
          <div style={{fontFamily:G.heading,fontSize:34,color:"#C084FC",lineHeight:1,textShadow:"0 0 18px rgba(192,132,252,.45)"}}>{(record?1:0)+(chainRecord?1:0)}</div>
          <div style={{fontSize:10,fontWeight:800,letterSpacing:1.5,textTransform:"uppercase",color:"rgba(255,255,255,.45)",marginTop:6}}>{tr("Parties","Games","Spiele","Partite","Jogos")}</div>
        </div>
      </div>

      {/* WhatsApp communauté */}
      <div style={{zIndex:1,padding:"6px 16px 2px"}}>
        <a href="https://chat.whatsapp.com/GpKyFjaxixCJviQawGHNUp" target="_blank" rel="noopener noreferrer"
          style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:"rgba(37,211,102,.1)",border:"1px solid rgba(37,211,102,.3)",borderRadius:14,textDecoration:"none"}}>
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="16" fill="#25D366"/>
            <path d="M16 7.5C11.306 7.5 7.5 11.306 7.5 16c0 1.76.504 3.4 1.376 4.785L7.5 24.5l3.837-1.356A8.463 8.463 0 0016 24.5c4.694 0 8.5-3.806 8.5-8.5S20.694 7.5 16 7.5z" fill="white"/>
            <path d="M20.844 18.68c-.248-.124-1.47-.725-1.698-.808-.228-.082-.394-.124-.56.124-.165.248-.64.808-.785.973-.144.166-.29.186-.537.062-.248-.124-1.047-.386-1.994-1.23-.737-.657-1.235-1.468-1.38-1.716-.144-.248-.015-.382.109-.505.111-.111.248-.29.372-.435.124-.145.165-.248.248-.414.082-.165.041-.31-.021-.434-.062-.124-.56-1.35-.767-1.848-.202-.485-.408-.42-.56-.427l-.477-.008c-.165 0-.434.062-.662.31-.227.248-.868.848-.868 2.068 0 1.22.889 2.398 1.013 2.563.124.165 1.748 2.67 4.236 3.745.592.255 1.054.407 1.414.521.594.189 1.135.162 1.562.098.476-.071 1.47-.6 1.677-1.18.207-.58.207-1.077.145-1.18-.062-.103-.228-.165-.476-.29z" fill="#25D366"/>
          </svg>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:800,color:"#25D366"}}>{tr("Rejoins la communauté GOAT FC 🐐","Join the GOAT FC community 🐐","Tritt der GOAT FC Community bei 🐐","Unisciti alla community GOAT FC 🐐","Junte-se à comunidade GOAT FC 🐐")}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.4)",marginTop:1}}>{tr("Matchs · Discussions foot · Bugs & Idées","Matches · Football talk · Bugs & Ideas","Matches · Fußball-Talk · Bugs & Ideen","Partite · Chiacchiere di calcio · Bug e idee","Partidas · Papo de futebol · Bugs e ideias")}</div>
          </div>
          <span style={{fontSize:16,color:"rgba(37,211,102,.6)"}}>›</span>
        </a>
      </div>

      {/* Actions */}
      <div style={{zIndex:1,padding:"10px 20px 0",fontSize:10.5,fontWeight:800,letterSpacing:3,textTransform:"uppercase",color:"rgba(255,255,255,.4)"}}>{tr("Menu","Menu","Menü","Menu","Menu")}</div>
      <div style={{zIndex:1,padding:"10px 16px 8px",display:"flex",flexDirection:"column",gap:10}}>
        {/* Mes amis */}
        <button onClick={()=>{setShowFriends(true);setScreen("home");}} style={{padding:"15px 16px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:18,cursor:"pointer",color:G.white,fontFamily:G.font,fontSize:15,fontWeight:800,display:"flex",alignItems:"center",gap:13,textAlign:"left"}}>
          <span style={{width:40,height:40,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,background:"rgba(0,230,118,.12)",border:"1px solid rgba(0,230,118,.28)",flexShrink:0}}>👥</span>
          <div style={{flex:1}}>
            <div>{tr("Mes amis","My friends","Meine Freunde","I miei amici","Meus amigos")}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.45)",fontWeight:600,marginTop:3,letterSpacing:.3}}>{friendsList.length} {friendsList.length>1?tr("amis","friends","Freunde","amici","amigos"):tr("ami","friend","Freund","amico","amigo")}</div>
          </div>
          <span style={{fontSize:18,color:"rgba(255,255,255,.35)"}}>→</span>
        </button>

        {/* Classement */}
        <button onClick={()=>{setLbMode("pont");setLbDiff("facile");loadLeaderboard("pont");setShowLeaderboard(true);setScreen("home");}} style={{padding:"15px 16px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:18,cursor:"pointer",color:G.white,fontFamily:G.font,fontSize:15,fontWeight:800,display:"flex",alignItems:"center",gap:13,textAlign:"left"}}>
          <span style={{width:40,height:40,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,background:"rgba(255,201,60,.12)",border:"1px solid rgba(255,201,60,.28)",flexShrink:0}}>🏆</span>
          <div style={{flex:1}}>
            <div>{tr("Classement","Leaderboard","Rangliste","Classifica","Ranking")}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.45)",fontWeight:600,marginTop:3,letterSpacing:.3}}>{tr("Vois ton rang mondial","See your world rank","Sieh deinen Weltrang","Vedi il tuo rango mondiale","Veja seu ranking mundial")}</div>
          </div>
          <span style={{fontSize:18,color:"rgba(255,255,255,.35)"}}>→</span>
        </button>

        {/* Comment jouer */}
        <button onClick={()=>{setShowTutorial(true);setTutorialStep(0);}} style={{padding:"15px 16px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:18,cursor:"pointer",color:G.white,fontFamily:G.font,fontSize:15,fontWeight:800,display:"flex",alignItems:"center",gap:13,textAlign:"left"}}>
          <span style={{width:40,height:40,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,background:"rgba(61,165,255,.12)",border:"1px solid rgba(61,165,255,.28)",flexShrink:0}}>❓</span>
          <div style={{flex:1}}>
            <div>{tr("Comment jouer ?","How to play?","Wie man spielt?","Come si gioca?","Como jogar?")}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.45)",fontWeight:600,marginTop:3,letterSpacing:.3}}>{tr("Revoir le tutoriel","See the tutorial again","Tutorial nochmal ansehen","Rivedi il tutorial","Rever o tutorial")}</div>
          </div>
          <span style={{fontSize:18,color:"rgba(255,255,255,.35)"}}>→</span>
        </button>

        {/* Code de récupération */}
        <button onClick={async function(){
          setShowMyRecoveryCode(true);
          // Pas de code en local : la colonne recovery_code n'est plus lisible
          // côté public, donc on en (re)génère un et on l'enregistre en base.
          if (!recoveryCode && playerId) {
            try {
              const newCode = generateRecoveryCode();
              await sbFetch("bb_pseudos?player_id=eq."+playerId, {
                method: "PATCH",
                body: JSON.stringify({recovery_code: newCode}),
                headers: {"Prefer": "return=minimal"}
              });
              setRecoveryCode(newCode);
              try { localStorage.setItem("bb_recovery_code", newCode); } catch {}
            } catch(e) {}
          }
        }} style={{padding:"15px 16px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:18,cursor:"pointer",color:G.white,fontFamily:G.font,fontSize:15,fontWeight:800,display:"flex",alignItems:"center",gap:13,textAlign:"left"}}>
          <span style={{width:40,height:40,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,background:"rgba(192,132,252,.12)",border:"1px solid rgba(192,132,252,.28)",flexShrink:0}}>🔐</span>
          <div style={{flex:1}}>
            <div>{tr("Mon code de récupération","My recovery code","Mein Wiederherstellungscode","Il mio codice di recupero","Meu código de recuperação")}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.45)",fontWeight:600,marginTop:3,letterSpacing:.3}}>{tr("Pour retrouver ton compte sur un autre appareil","To use your account on another device","Um dein Konto auf einem anderen Gerät zu nutzen","Per usare il tuo account su un altro dispositivo","Para usar sua conta em outro aparelho")}</div>
          </div>
          <span style={{fontSize:18,color:"rgba(255,255,255,.35)"}}>→</span>
        </button>

        {/* Langue */}
        <div style={{padding:"15px 16px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:18,color:G.white,fontFamily:G.font,fontSize:15,fontWeight:800,display:"flex",alignItems:"center",gap:13}}>
          <span style={{width:40,height:40,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,background:"rgba(255,255,255,.12)",border:"1px solid rgba(255,255,255,.28)",flexShrink:0}}>🌐</span>
          <div style={{flex:1}}>
            <div>{tr("Langue","Language","Sprache","Lingua","Idioma")}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.45)",fontWeight:600,marginTop:3,letterSpacing:.3}}>{tr("Choisis ta langue","Choose your language","Wähle deine Sprache","Scegli la lingua","Escolha seu idioma")}</div>
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>setLanguage("fr")} style={{padding:"7px 9px",background:lang==="fr"?G.accent:"rgba(255,255,255,.08)",color:lang==="fr"?"#06130B":"rgba(255,255,255,.6)",border:"none",borderRadius:20,cursor:"pointer",fontFamily:G.font,fontSize:12,fontWeight:800}}>🇫🇷 FR</button>
            <button onClick={()=>setLanguage("en")} style={{padding:"7px 9px",background:lang==="en"?G.accent:"rgba(255,255,255,.08)",color:lang==="en"?"#06130B":"rgba(255,255,255,.6)",border:"none",borderRadius:20,cursor:"pointer",fontFamily:G.font,fontSize:12,fontWeight:800}}>🇬🇧 EN</button>
            <button onClick={()=>setLanguage("de")} style={{padding:"7px 9px",background:lang==="de"?G.accent:"rgba(255,255,255,.08)",color:lang==="de"?"#06130B":"rgba(255,255,255,.6)",border:"none",borderRadius:20,cursor:"pointer",fontFamily:G.font,fontSize:12,fontWeight:800}}>🇩🇪 DE</button>
            <button onClick={()=>setLanguage("it")} style={{padding:"7px 9px",background:lang==="it"?G.accent:"rgba(255,255,255,.08)",color:lang==="it"?"#06130B":"rgba(255,255,255,.6)",border:"none",borderRadius:20,cursor:"pointer",fontFamily:G.font,fontSize:12,fontWeight:800}}>🇮🇹 IT</button>
            <button onClick={()=>setLanguage("pt")} style={{padding:"7px 9px",background:lang==="pt"?G.accent:"rgba(255,255,255,.08)",color:lang==="pt"?"#06130B":"rgba(255,255,255,.6)",border:"none",borderRadius:20,cursor:"pointer",fontFamily:G.font,fontSize:12,fontWeight:800}}>🇵🇹 PT</button>
          </div>
        </div>

        {/* Suggérer un joueur - subtil */}
        <button onClick={function(){
          const subject = encodeURIComponent(tr("[GOAT FC] Suggestion de joueur","[GOAT FC] Player suggestion","[GOAT FC] Spielervorschlag","[GOAT FC] Suggerimento giocatore","[GOAT FC] Sugestão de jogador"));
          const body = encodeURIComponent(
            (tr("Salut l'équipe GOAT FC,\n\nJe souhaite suggérer le(s) joueur(s) suivant(s) à ajouter à la base :\n\n","Hi GOAT FC team,\n\nI'd like to suggest the following player(s) to be added to the database:\n\n","Hallo GOAT FC Team,\n\nich möchte folgende(n) Spieler zur Datenbank vorschlagen:\n\n","Ciao team GOAT FC,\n\nvorrei suggerire i seguenti giocatori da aggiungere al database:\n\n","Olá equipe GOAT FC,\n\ngostaria de sugerir o(s) seguinte(s) jogador(es) para adicionar à base:\n\n")
            ) + (tr("Nom du/des joueur(s) : \n\nMerci !","Player name(s): \n\nThanks!","Spielername(n): \n\nDanke!","Nome giocatore/i: \n\nGrazie!","Nome do(s) jogador(es): \n\nObrigado!"))
          );
          window.location.href = "mailto:contact@goatfc.online?subject="+subject+"&body="+body;
        }} style={{padding:"14px 18px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.12)",borderRadius:18,cursor:"pointer",color:"rgba(255,255,255,.7)",fontFamily:G.font,fontSize:14,fontWeight:700,display:"flex",alignItems:"center",gap:12,textAlign:"left",marginTop:6}}>
          <span style={{fontSize:18}}>💡</span>
          <div style={{flex:1}}>
            <div>{tr("Suggérer un joueur","Suggest a player","Spieler vorschlagen","Suggerisci un giocatore","Sugerir um jogador")}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.45)",fontWeight:600,marginTop:2}}>{tr("Un joueur manque ? Dis-le nous !","A missing player? Tell us!","Fehlt ein Spieler? Sag es uns!","Manca un giocatore? Diccelo!","Falta um jogador? Avise a gente!")}</div>
          </div>
          <span style={{fontSize:18,color:"rgba(255,255,255,.4)"}}>→</span>
        </button>

        {/* Mon compte (paramètres + suppression) - subtil */}
        <button onClick={()=>setShowAccount(true)} style={{padding:"14px 18px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.12)",borderRadius:18,cursor:"pointer",color:"rgba(255,255,255,.7)",fontFamily:G.font,fontSize:14,fontWeight:700,display:"flex",alignItems:"center",gap:12,textAlign:"left",marginTop:6}}>
          <span style={{fontSize:18}}>⚙️</span>
          <div style={{flex:1}}>{tr("Mon compte","My account","Mein Konto","Il mio account","Minha conta")}</div>
          <span style={{fontSize:18,color:"rgba(255,255,255,.4)"}}>→</span>
        </button>
      </div>

      {/* Footer */}
      <div style={{zIndex:1,padding:"20px 16px 40px",textAlign:"center"}}>
        <div style={{fontSize:10,color:"rgba(255,255,255,.2)",letterSpacing:2,textTransform:"uppercase"}}>GOAT FC · v1</div>
      </div>

      {pseudoModal}
      {recoveryCodeAfterCreationModal}
      {recoveryInputModal}
      {myRecoveryCodeModal}
      {avatarViewer}
      {cropperModal}
    </div>
  );

  // ── BANNIÈRE DISCRÈTE D'INSTALL (iOS Safari / Android Chrome non installé) ──
  // Reste visible en permanence pour les users qui n'ont pas encore installé
  // Clic → ouvre le gros modal d'instructions
  const installBanner = !isStandalone() && pseudoConfirmed && (isIOS() || deferredInstall) && (
    <div onClick={function(){ installDismissedThisSession.current = false; setShowInstallPrompt(true); }} style={{position:"sticky",top:0,zIndex:40,margin:"0 -16px 12px",padding:"10px 16px",background:"linear-gradient(135deg, rgba(0,230,118,.12), rgba(0,168,85,.08))",borderBottom:"1px solid rgba(0,230,118,.25)",cursor:"pointer",display:"flex",alignItems:"center",gap:10,backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)"}}>
      <span style={{fontSize:20,flexShrink:0}}>📲</span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:12,fontWeight:800,color:G.accent,letterSpacing:.3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
          {tr("Installer GOAT FC","Install GOAT FC","GOAT FC installieren","Installa GOAT FC","Instalar GOAT FC")}
        </div>
        <div style={{fontSize:10,color:"rgba(255,255,255,.55)",marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
          {tr("Reçois les rappels et accède plus vite","Get daily reminders & faster access","Erhalte tägliche Erinnerungen & schnelleren Zugriff","Ricevi promemoria quotidiani e accesso più rapido","Receba lembretes diários e acesso mais rápido")}
        </div>
      </div>
      <span style={{fontSize:18,color:G.accent,flexShrink:0}}>→</span>
    </div>
  );

  if(screen==="home") return (
    // Fond « match en nocturne » : le trait d'encre (#081109) ne se voit que sur
    // un fond plus clair que lui. Sur les bandes de pelouse d'origine (#0E1F14),
    // bordures et ombres dures disparaissaient purement et simplement.
    // Le grain de trame est posé en superposition, sans intercepter les clics.
    // NB : on écrase la clé `background` de `shell` plutôt que d'ajouter
    // `backgroundImage` — sinon le raccourci `background:transparent` gagne.
    <div style={{...shell,animation:"fadeUp .5s ease",height:isDesktop?"auto":"100dvh",minHeight:isDesktop?"100vh":0,overflow:isDesktop?"visible":"hidden",
      background:"radial-gradient(70% 22% at 14% 2%, rgba(245,194,43,.26), transparent 70%),radial-gradient(70% 22% at 86% 2%, rgba(245,194,43,.26), transparent 70%),linear-gradient(180deg,#081109 0%,#0E2C17 48%,#17572C 100%) #0E2C17"}} key="home">
      <div aria-hidden="true" style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",opacity:.16,
        backgroundImage:"radial-gradient(circle,#000 1px,transparent 1.3px)",backgroundSize:"5px 5px"}}/>
      {pseudoModal}
      {recoveryCodeAfterCreationModal}
      {recoveryInputModal}
      {myRecoveryCodeModal}
      {streakModal}
      {installPrompt}
      {notifPrompt}
      {tutorialOverlay}
      {welcomeOverlay}
      {duelCreateModal}
      {showRoomCreate && (
        <div
          style={{position:"fixed",inset:0,zIndex:400,display:"flex",alignItems:"flex-end"}}
          onClick={function(e){if(e.target===e.currentTarget)setShowRoomCreate(false);}}
        >
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.6)",backdropFilter:"blur(4px)"}} onClick={function(){setShowRoomCreate(false);}}/>
          <div style={{position:"relative",zIndex:1,width:"100%",background:"rgba(10,25,10,.96)",backdropFilter:"blur(20px)",borderRadius:"28px 28px 0 0",padding:"16px 20px 48px",border:"1px solid rgba(255,255,255,.1)",borderBottom:"none",animation:"slideUp .35s cubic-bezier(.22,1,.36,1)"}}>
            <div style={{width:40,height:4,background:"rgba(255,255,255,.2)",borderRadius:2,margin:"0 auto 20px"}}/>
            <div style={{fontFamily:G.heading,fontSize:28,color:G.white,letterSpacing:2,marginBottom:6}}>{tr("CRÉER UNE SALLE","CREATE A ROOM","RAUM ERSTELLEN","CREA UNA STANZA","CRIAR UMA SALA")}</div>
            {/* Recap config */}
            <div style={{background:"rgba(255,255,255,.06)",borderRadius:16,padding:"14px 16px",marginBottom:20,border:"1px solid rgba(255,255,255,.08)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:800,color:G.white}}>{duelMode==="pont"?"The Plug":"The Mercato"}</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.4)"}}>{duelDiff==="facile"?"AMATEUR":duelDiff==="moyen"?"PRO":"CRESCENDO"} · {duelRounds} {duelRounds>1?tr("manches","rounds","Runden","round","rodadas"):tr("manche","round","Runde","round","rodada")}</div>
                </div>
                <div style={{fontFamily:G.heading,fontSize:32,color:G.accent}}>2-8 👥</div>
              </div>
            </div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.35)",marginBottom:20,textAlign:"center"}}>
              {tr("Un code sera généré pour que tes amis puissent rejoindre","A code will be generated so your friends can join","Ein Code wird erstellt, damit deine Freunde beitreten können","Verrà generato un codice così i tuoi amici possono unirsi","Um código será gerado para seus amigos entrarem")}
            </div>
            {roomMsg && <div style={{fontSize:13,color:"#FF3D57",fontWeight:700,marginBottom:12,textAlign:"center"}}>{roomMsg}</div>}
            <div style={{display:"flex",gap:10}}>
              <button onClick={function(){setShowRoomCreate(false);}} style={{flex:1,padding:"15px",background:"rgba(255,255,255,.07)",color:"rgba(255,255,255,.5)",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14}}>{tr("Annuler","Cancel","Abbrechen","Annulla","Cancelar")}</button>
              <button onClick={createRoom} style={{flex:2,padding:"15px",background:G.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800}}>{tr("Créer la salle 🚀","Create room 🚀","Raum erstellen 🚀","Crea la stanza 🚀","Criar sala 🚀")}</button>
            </div>
          </div>
        </div>
      )}
      <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        {/* Bandes pelouse */}
        {[0,1,2,3,4,5,6].map(function(i){return(
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#0E1F14":"#132819"}}/>
        );})}
        {/* Ligne médiane */}
        <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
        {/* Cercle central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
        {/* Point central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:8,height:8,borderRadius:"50%",background:"rgba(255,255,255,.2)"}}/>
        {/* Overlay sombre pour lisibilité */}
        <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
      </div>

      {/* ── HEADER compact ── */}
      <div style={{zIndex:1,padding:"6px 20px 2px"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
          <div style={{flex:1,display:"flex",alignItems:"center"}}>
            <div style={{display:"flex",background:"rgba(0,0,0,.3)",border:"1px solid rgba(255,255,255,.12)",borderRadius:12,padding:3}}>
              <button onClick={()=>setLanguage("fr")} style={{padding:"5px 6px",background:lang==="fr"?G.accent:"transparent",color:lang==="fr"?"#000":"rgba(255,255,255,.7)",border:"none",borderRadius:9,cursor:"pointer",fontFamily:G.font,fontSize:11,fontWeight:800}}>🇫🇷 FR</button>
              <button onClick={()=>setLanguage("en")} style={{padding:"5px 6px",background:lang==="en"?G.accent:"transparent",color:lang==="en"?"#000":"rgba(255,255,255,.7)",border:"none",borderRadius:9,cursor:"pointer",fontFamily:G.font,fontSize:11,fontWeight:800}}>🇬🇧 EN</button>
              <button onClick={()=>setLanguage("de")} style={{padding:"5px 6px",background:lang==="de"?G.accent:"transparent",color:lang==="de"?"#000":"rgba(255,255,255,.7)",border:"none",borderRadius:9,cursor:"pointer",fontFamily:G.font,fontSize:11,fontWeight:800}}>🇩🇪 DE</button>
              <button onClick={()=>setLanguage("it")} style={{padding:"5px 6px",background:lang==="it"?G.accent:"transparent",color:lang==="it"?"#000":"rgba(255,255,255,.7)",border:"none",borderRadius:9,cursor:"pointer",fontFamily:G.font,fontSize:11,fontWeight:800}}>🇮🇹 IT</button>
              <button onClick={()=>setLanguage("pt")} style={{padding:"5px 6px",background:lang==="pt"?G.accent:"transparent",color:lang==="pt"?"#000":"rgba(255,255,255,.7)",border:"none",borderRadius:9,cursor:"pointer",fontFamily:G.font,fontSize:11,fontWeight:800}}>🇵🇹 PT</button>
            </div>
          </div>
          <div style={{textAlign:"center",flex:2}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center"}}>
              <img src="/logo.png" style={{height:"clamp(78px,19.5vw,120px)",maxWidth:"100%",objectFit:"contain"}} alt="GOAT FC"/>
            </div>
          </div>
          <div style={{flex:1,display:"flex",justifyContent:"flex-end",alignItems:"center",gap:8}}>
  {!launchedFromLandingRef.current && dayStreak > 0 && (() => {
    // Paliers visuels de streak
    // Pastille des jours de suite retirée de l'accueil : l'information vit
    // dans le profil et dans le détail de série. Le reste de ce bloc est
    // conservé tel quel pour pouvoir la remettre sans le réécrire.
    return null;
    // eslint-disable-next-line no-unreachable
    const tier = dayStreak >= 100 ? "platine" : dayStreak >= 30 ? "mythic" : dayStreak >= 7 ? "gold" : dayStreak >= 3 ? "bronze" : "base";
    const tierStyles = {
      base:    { bg:"linear-gradient(135deg,rgba(255,107,53,.25),rgba(255,214,0,.15))", border:"rgba(255,107,53,.5)", color:"#FFD600", shadow:"0 2px 8px rgba(255,107,53,.2)", textColor:"#FFD600", emoji:"🔥" },
      bronze:  { bg:"linear-gradient(135deg,#D97706,#FBA94F)", border:"#FBA94F", color:"#000", shadow:"0 4px 14px rgba(217,119,6,.45)", textColor:"#000", emoji:"🔥" },
      gold:    { bg:"linear-gradient(135deg,#FF6B35,#FFD600)", border:"#FFD600", color:"#000", shadow:"0 4px 14px rgba(255,107,53,.45)", textColor:"#000", emoji:"🔥" },
      mythic:  { bg:"linear-gradient(135deg,#C084FC,#FFD600)", border:"#FFD600", color:"#000", shadow:"0 6px 18px rgba(192,132,252,.55)", textColor:"#000", emoji:"⚡" },
      platine: { bg:"linear-gradient(135deg,#E5E4E2,#B6B6B6,#FFFFFF)", border:"#FFFFFF", color:"#000", shadow:"0 6px 20px rgba(255,255,255,.55)", textColor:"#000", emoji:"💎" }
    };
    // La pastille garde toujours l'apparence de son palier : la variante rouge
    // « série en danger » (fond #FF3D57, triangle ⚠️, pulsation) alarmait sur
    // l'accueil pour une information que le détail de série suffit à porter.
    const t = tierStyles[tier];
    return (
      <div onClick={()=>setShowStreakDetail(true)} style={{
        display:"flex",alignItems:"center",gap:5,
        background:t.bg,
        border:`1.5px solid ${t.border}`,
        borderRadius:12,
        padding:"7px 11px",
        cursor:"pointer",
        boxShadow:t.shadow,
        animation: streakJustIncreased ? "pulseStreak .6s ease-in-out 3" : (tier==="platine" || tier==="mythic" ? "flameGlow 2.5s ease-in-out infinite" : "none")
      }}>
        <span style={{fontSize:18,filter: tier==="gold" || tier==="mythic" ? "drop-shadow(0 0 6px #FFD60099)" : tier==="platine" ? "drop-shadow(0 0 6px #FFFFFFAA)" : "none"}}>{t.emoji}</span>
        <span style={{fontFamily:G.heading,fontSize:17,color:t.textColor,fontWeight:800,letterSpacing:.5}}>{dayStreak}</span>
      </div>
    );
  })()}
{!launchedFromLandingRef.current && (
<div onClick={function(){if(!pseudoConfirmed) setPseudoScreen(true); else setScreen("profile");}} style={{background:"linear-gradient(135deg,#00E676,#00A855)",border:"1px solid rgba(0,230,118,.4)",borderRadius:7,width:34,height:45,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",boxShadow:"0 4px 14px rgba(0,230,118,.25)",overflow:"hidden"}}>
  {/* Bouton profil de l'accueil : la carte remplace l'initiale du pseudo. */}
  {/* Bouton profil de l'accueil : la carte, pas la photo uploadée. */}
  <img src={avatarCard(playerBadge, playerXp).img} alt="" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}}/>
</div>
)}
          </div>
        </div>
      </div>

      <div style={{...sheet,gap:10}}>

        {/* Alerte streak en danger — bande supprimée pour gagner de la place verticale.
            L'info reste visible via le badge alerte rouge dans le header (cliquable pour le détail). */}

        {/* Bandeau room en attente */}
        {pendingRoomCode && !pseudoConfirmed && (
          <div style={{background:"rgba(0,230,118,.1)",border:"1px solid rgba(0,230,118,.3)",borderRadius:12,padding:"10px 14px",textAlign:"center"}}>
            <div style={{fontSize:13,fontWeight:800,color:G.accent}}>🔗 {tr("Salle ","Room ","Raum ","Stanza ","Sala ")}{pendingRoomCode}{tr(" en attente"," pending"," ausstehend"," in attesa"," pendente")}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginTop:2}}>{tr("Crée ton pseudo pour rejoindre automatiquement","Create your username to join automatically","Erstelle deinen Namen, um automatisch beizutreten","Crea il tuo nome per unirti automaticamente","Crie seu nome para entrar automaticamente")}</div>
          </div>
        )}
        {/* Bannière installation app (iOS Safari / Android non installé) */}
        {installBanner}
        {/* Bandeau demandes d'amis */}
        {friendRequests.length > 0 && (
          <div style={{background:"#123a1e",border:"1px solid rgba(0,230,118,.5)",borderRadius:12,padding:"10px 14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:12,fontWeight:700,color:G.accent}}>👋 {friendRequests.length} {friendRequests.length>1?tr("demandes d'ami","friend requests","Freundschaftsanfragen","richieste di amicizia","pedidos de amizade"):tr("demande d'ami","friend request","Freundschaftsanfrage","richiesta di amicizia","pedido de amizade")}</div>
              <button onClick={function(){setShowFriends(true);loadFriendRequests();}} style={{padding:"5px 12px",background:G.accent,color:"#000",border:"none",borderRadius:20,cursor:"pointer",fontFamily:G.font,fontSize:12,fontWeight:800}}>{tr("Voir","View","Ansehen","Vedi","Ver")}</button>
            </div>
          </div>
        )}

        {/* Défis en attente */}
        {getPendingDuels().length > 0 && (
          <div style={{background:"rgba(255,214,0,.08)",border:"1px solid rgba(255,214,0,.25)",borderRadius:12,padding:"10px 14px"}}>
            {getPendingDuels().slice(0,2).map(function(d){
              const oppName = d.challenger_id===playerId?d.opponent_name:d.challenger_name;
              return(
                <div key={d.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{fontSize:12,fontWeight:700,color:G.gold}}>⚡ {tr("Défi de ","Challenge from ","Herausforderung von ","Sfida di ","Desafio de ")}{oppName}</div>
                  <button onClick={function(){joinDuel(d);}} style={{padding:"5px 12px",background:G.gold,color:"#000",border:"none",borderRadius:20,cursor:"pointer",fontFamily:G.font,fontSize:12,fontWeight:800}}>{tr("Rejoindre","Join","Beitreten","Unisciti","Entrar")}</button>
                </div>
              );})}
          </div>
        )}

        {/* ── DEVINETTE DU JOUR — accès permanent ──
            Elle a été retirée du carrousel (#369) au profit d'un pop-up
            automatique une fois par jour. Problème : le pop-up marque le jour
            comme « vu » dès son affichage, donc répondre « Plus tard » (ou le
            fermer) rendait la devinette injoignable jusqu'au lendemain. Cette
            barre est le point d'entrée qui manquait.
            Une fois la devinette jouée, la barre disparaît de l'accueil : il n'y
            a plus rien à y faire jusqu'au lendemain, et un « déjà jouée » grisé
            n'était que du bruit visuel au-dessus du carrousel. */}
        {!dailyRiddle.done && (
        <button
          onClick={function(){ requirePseudo(function(){ window.dispatchEvent(new CustomEvent("goatfc:open-devinette")); }); }}
          style={{width:"100%",display:"flex",alignItems:"center",gap:11,padding:"11px 14px",background:G.projecteur,border:G.trait,boxShadow:G.ombre,borderRadius:G.rayon,cursor:"pointer",fontFamily:G.font,textAlign:"left",color:"#1A1206"}}
        >
          <span style={{fontSize:20,lineHeight:1}}>🕵️</span>
          <span style={{flex:1,minWidth:0}}>
            <span style={{display:"block",...posterLight(17),transformOrigin:"left"}}>
              {tr("DEVINETTE DU JOUR","DAILY RIDDLE","RÄTSEL DES TAGES","INDOVINELLO DEL GIORNO","ADIVINHA DO DIA")}
            </span>
            <span style={{display:"block",fontSize:11,fontWeight:900,color:"rgba(26,18,6,.72)",marginTop:2}}>
              {tr("Un joueur mystère à deviner","A mystery player to guess","Ein Rätselspieler zu erraten","Un giocatore misterioso da indovinare","Um jogador misterioso para adivinhar")}
            </span>
          </span>
          {dailyRiddle.streak > 0 && (
            <span style={{flexShrink:0,padding:"4px 10px",borderRadius:999,background:"rgba(255,138,42,.16)",border:"1px solid rgba(255,138,42,.5)",color:"#FF8A2A",fontSize:12,fontWeight:900}}>🔥 {dailyRiddle.streak}</span>
          )}
          <span style={{flexShrink:0,color:"#1A1206",fontSize:16,fontWeight:900}}>›</span>
        </button>
        )}

        {/* ── HOME CAROUSEL — les modes de jeu ── */}
        {/* Mobile : le carrousel absorbe l'espace restant (flex) pour que toute
            la page tienne sur l'écran sans scroll (fix 100vh Safari → 100dvh). */}
        {(() => {
          const homeCards = [
              {key:"duel",    img:DUEL_CARD_IMG,    onClick: function(){requirePseudo(function(){setDuelError("");setDuelJoinCode("");setDuelScreen("menu");});}, record: null, recordIcon:null, recordColor:"#3DA5FF"},
              {key:"grid",    img:REVEAL_CARD_IMG,  onClick: function(){window.dispatchEvent(new CustomEvent("goatfc:open-findplayer"));}, record: null, recordIcon:null, recordColor:"#00E676"},
              {key:"mercato", img:MERCATO_CARD_IMG, onClick: function(){setGameConfigModal("chaine");}, record: chainRecord, recordIcon:"⛓",  recordColor:"#60a5fa"},
              {key:"plug",    img:PLUG_CARD_IMG,    onClick: function(){setGameConfigModal("pont");},   record: record,      recordIcon:"🏆", recordColor:"#FFD600"},
              {key:"guess",   img:GUESS_CARD_IMG,   onClick: function(){window.dispatchEvent(new CustomEvent("goatfc:open-guess"));}, record: null, recordIcon:null, recordColor:"#C084FC"},
              // GOAT GRID (grille 3×3 solo). Ajouté en fin de liste pour ne pas
              // décaler les index déjà mémorisés dans bb_home_card.
              {key:"goatgrid",img:GRID_CARD_IMG,    onClick: function(){setGgModeChoice(true);}, record: null, recordIcon:null, recordColor:"#FF6B35"},
            ]; const homeN = homeCards.length; return (
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",flex:isDesktop?"none":"1 1 auto",minHeight:0}}>
          <div
            style={{
              position:"relative",
              // Mobile : la carte GARDE son ratio portrait (aspectRatio) et sa
              // largeur suit la hauteur dispo (flex) → jamais écrasée sur écran court.
              aspectRatio:"1086 / 1448",
              flex:isDesktop?undefined:"1 1 auto",
              width:isDesktop?"min(280px, 75vw)":"auto",
              maxWidth:"min(280px, 75vw)",
              height:isDesktop?"clamp(340px, 82vw, 400px)":undefined,
              minHeight:isDesktop?undefined:0,
              maxHeight:isDesktop?undefined:400,
              alignSelf:"center",
            }}
            onTouchStart={function(e){homeSwipeStartRef.current = e.touches[0].clientX;}}
            onTouchEnd={function(e){
              const startX = homeSwipeStartRef.current;
              if(startX==null) return;
              const endX = e.changedTouches[0].clientX;
              const delta = endX - startX;
              homeSwipeStartRef.current = null;
              if(Math.abs(delta) > 50){
                const newIdx = (homeCardIndex + (delta < 0 ? 1 : -1) + homeN) % homeN;
                setHomeCardIndex(newIdx);
                localStorage.setItem("bb_home_card", String(newIdx));
              }
            }}
            onMouseDown={function(e){homeSwipeStartRef.current = e.clientX;}}
            onMouseUp={function(e){
              const startX = homeSwipeStartRef.current;
              if(startX==null) return;
              const delta = e.clientX - startX;
              homeSwipeStartRef.current = null;
              if(Math.abs(delta) > 50){
                const newIdx = (homeCardIndex + (delta < 0 ? 1 : -1) + homeN) % homeN;
                setHomeCardIndex(newIdx);
                localStorage.setItem("bb_home_card", String(newIdx));
              }
            }}
          >
            {homeCards.map(function(card, i){
              const offset = (i - homeCardIndex + homeN) % homeN;
              const isActive = offset === 0;
              let translateX, scale, opacity, zIndex;
              if(offset === 0){ translateX = 0;  scale = 1;    opacity = 1;    zIndex = 40; }
              else if(offset === 1){ translateX = 24; scale = 0.92; opacity = 0.65; zIndex = 30; }
              else if(offset === 2){ translateX = 44; scale = 0.84; opacity = 0.35; zIndex = 20; }
              else { translateX = 60; scale = 0.76; opacity = 0.15; zIndex = 10; }
              return (
                <div
                  key={card.key}
                  onClick={function(e){
                    e.stopPropagation();
                    if(homeSwipeStartRef.current!=null) return; // ignore si en cours de swipe
                    if(isActive){
                      card.onClick();
                    } else {
                      setHomeCardIndex(i);
                      localStorage.setItem("bb_home_card", String(i));
                    }
                  }}
                  style={{
                    position:"absolute", top:0, left:0, right:0, bottom:0,
                    borderRadius:22, cursor:"pointer", overflow:"hidden",
                    background:"#000",
                    transform:"translateX("+translateX+"px) scale("+scale+")",
                    opacity:opacity, zIndex:zIndex,
                    transition:"transform 0.35s cubic-bezier(.2,.7,.3,1), opacity 0.35s, box-shadow 0.35s",
                    boxShadow: isActive ? "0 12px 36px rgba(0,0,0,.6)" : "0 4px 12px rgba(0,0,0,.3)",
                    willChange:"transform",
                  }}
                >
                  {card.node ? card.node : <img src={card.img} alt="" style={{width:"100%",height:"100%",objectFit:"cover",pointerEvents:"none",userSelect:"none"}} draggable={false}/>}
                  {/* Bouton info (i) en haut à droite — toujours visible */}
                  {isActive && (
                    <button
                      onClick={function(e){e.stopPropagation();setHomeRulesModal(card.key);}}
                      onMouseDown={function(e){e.stopPropagation();}}
                      onTouchStart={function(e){e.stopPropagation();}}
                      aria-label={tr("Règles du jeu","Game rules","Spielregeln","Regole del gioco","Regras do jogo")}
                      style={{
                        position:"absolute", top:12, right:12, zIndex:3,
                        width:30, height:30, borderRadius:"50%",
                        background:"rgba(0,0,0,.6)", color:"#fff",
                        border:"1.5px solid rgba(255,255,255,.35)",
                        fontFamily:"Georgia, serif", fontSize:17, fontWeight:700, fontStyle:"italic",
                        cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                        backdropFilter:"blur(6px)", padding:0, lineHeight:1,
                        boxShadow:"0 2px 8px rgba(0,0,0,.4)",
                      }}
                    >i</button>
                  )}
                  {/* Record badge */}
                  {isActive && card.record && (
                    <div style={{position:"absolute",top:12,left:12,display:"flex",alignItems:"center",gap:5,background:"rgba(0,0,0,.65)",padding:"5px 10px",borderRadius:14,backdropFilter:"blur(6px)",zIndex:2}}>
                      <span style={{fontSize:13,color:card.recordColor}}>{card.recordIcon}</span>
                      <span style={{fontFamily:G.heading,fontSize:14,color:card.recordColor,fontWeight:700}}>{card.record.score} pts</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Dots indicator */}
          <div style={{display:"flex",justifyContent:"center",gap:8,marginTop:10}}>
            {homeCards.map(function(_c, i){
              const colors = ["#00E676","#60a5fa","#FFD600","#C084FC","#3DA5FF"];
              const isActive = homeCardIndex === i;
              return (
                <div
                  key={i}
                  onClick={function(){setHomeCardIndex(i);localStorage.setItem("bb_home_card", String(i));}}
                  style={{
                    width: isActive ? 28 : 9,
                    height: 9,
                    borderRadius: 5,
                    border: G.traitFin,
                    background: isActive ? G.projecteur : "rgba(255,255,255,.25)",
                    transition:"all 0.3s",
                    cursor:"pointer",
                  }}
                />
              );
            })}
          </div>

          {/* Hint */}
          <div style={{textAlign:"center",fontSize:9,color:"rgba(255,255,255,.35)",marginTop:6,letterSpacing:1.5,textTransform:"uppercase"}}>
            {tr("← Glisse • Tape pour jouer →","← Swipe • Tap to play →","← Wischen • Tippen zum Spielen →","← Scorri • Tocca per giocare →","← Deslize • Toque para jogar →")}
          </div>
        </div>
        ); })()}

        {/* ── TABLEAU DE BORD PRIVÉ (?stats=CODE) ── */}
        {statsMode && (
          <div style={{position:"fixed",inset:0,zIndex:9999,background:"radial-gradient(ellipse 120% 60% at 50% 0%, #0f2a1a 0%, #060d09 60%, #030603 100%)",overflowY:"auto",WebkitOverflowScrolling:"touch",padding:"calc(30px + env(safe-area-inset-top)) 20px calc(40px + env(safe-area-inset-bottom))",fontFamily:G.font}}>
            <div style={{maxWidth:520,margin:"0 auto"}}>
              <div style={{textAlign:"center",marginBottom:24}}>
                <div style={{fontSize:11,letterSpacing:3,color:"rgba(255,255,255,.45)",fontWeight:800,textTransform:"uppercase"}}>Tableau de bord · privé</div>
                <div style={{fontFamily:G.heading,fontSize:34,letterSpacing:2,color:"#fff",marginTop:4}}>GOAT <span style={{color:"#00E676"}}>STATS</span></div>
              </div>
                {/* Rafraîchir en haut : en bas de page, il fallait traverser tout le
                    tableau de bord pour le trouver. */}
                  <button onClick={function(){setStatsData(null);}} style={{width:"100%",padding:"11px",borderRadius:14,marginBottom:14,border:"1px solid rgba(255,255,255,.15)",background:"rgba(255,255,255,.05)",color:"#fff",fontFamily:G.font,fontWeight:800,fontSize:14,cursor:"pointer"}}>↻ Rafraîchir</button>
              {!statsData ? (
                <div style={{textAlign:"center",padding:"60px 0",color:"rgba(255,255,255,.5)",fontSize:15}}>⏳ Chargement…</div>
              ) : (() => {
                const v = statsView; if (!v) return null;
                const maxP = Math.max(1, ...v.days.map(function(d){return d.players;}));
                const fmtDay = function(iso){ const dt = new Date(iso+"T12:00:00"); return dt.toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"}); };
                const rangeLabel = v.range===1 ? "Aujourd'hui" : ("Sur "+v.range+" jours");
                return (
                <>
                  {/* EN CE MOMENT — nombre de personnes actuellement sur l'app (temps réel) */}
                  <div style={{position:"relative",background:"linear-gradient(135deg, rgba(0,230,118,.18), rgba(0,0,0,.25))",border:"1px solid rgba(0,230,118,.4)",borderRadius:18,padding:"16px 18px",marginBottom:14,display:"flex",alignItems:"center",gap:14,overflow:"hidden"}}>
                    <div style={{position:"relative",width:12,height:12,flexShrink:0}}>
                      <span style={{position:"absolute",inset:0,borderRadius:"50%",background:"#00E676",boxShadow:"0 0 10px #00E676"}}/>
                      <span style={{position:"absolute",inset:-4,borderRadius:"50%",border:"2px solid #00E676",animation:"livePulse 1.8s ease-out infinite"}}/>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:11,letterSpacing:2,color:"rgba(255,255,255,.6)",fontWeight:800,textTransform:"uppercase"}}>En ce moment</div>
                      <div style={{fontSize:12,color:"rgba(255,255,255,.45)",fontWeight:600,marginTop:1}}>{liveNow==null?"table bb_presence à créer":(liveNow>1?"personnes sur l'app":"personne sur l'app")}</div>
                    </div>
                    <div style={{fontFamily:G.heading,fontSize:44,color:"#00E676",lineHeight:1,textShadow:"0 0 20px rgba(0,230,118,.45)"}}>{liveNow==null?"—":liveNow}</div>
                  </div>
                  {/* Sélecteur de plage : 1 / 5 / 10 / 14 jours */}
                  <div style={{display:"flex",gap:8,marginBottom:16}}>
                    {[1,5,10,14].map(function(r){
                      const active = statsRange===r;
                      return <button key={r} onClick={function(){setStatsRange(r);}} style={{flex:1,padding:"11px 0",borderRadius:12,border:"1px solid "+(active?"#00E676":"rgba(255,255,255,.14)"),background:active?"rgba(0,230,118,.16)":"rgba(255,255,255,.04)",color:active?"#00E676":"rgba(255,255,255,.6)",fontFamily:G.font,fontWeight:800,fontSize:13.5,cursor:"pointer",transition:"all .15s"}}>{r} j</button>;
                    })}
                  </div>
                  {/* Résumé de la fenêtre sélectionnée */}
                  <div style={{background:"linear-gradient(160deg, rgba(0,230,118,.16), rgba(255,255,255,.03) 55%, rgba(0,0,0,.25))",border:"1px solid rgba(0,230,118,.35)",borderRadius:22,padding:"22px 20px",textAlign:"center",boxShadow:"0 16px 44px -16px rgba(0,230,118,.4)",marginBottom:14}}>
                    <div style={{fontSize:11,letterSpacing:2,color:"rgba(255,255,255,.55)",fontWeight:800,textTransform:"uppercase"}}>{rangeLabel}</div>
                    <div style={{fontFamily:G.heading,fontSize:76,color:"#00E676",lineHeight:1,textShadow:"0 0 26px rgba(0,230,118,.45)"}}>{v.activeWindow}</div>
                    <div style={{fontSize:14,color:"rgba(255,255,255,.7)",fontWeight:700}}>{v.range===1?"actifs aujourd'hui":`joueurs actifs · ${v.range} j`}{statsData.hasEvents?` · dont ${v.anonWindow} anonyme${v.anonWindow>1?"s":""}`:""} · {v.gamesWindow} parties{v.duelsWindow?` · ${v.duelsWindow} duels`:""}</div>
                  </div>
                  {/* ─── DEPUIS LE DÉBUT (tout l'historique) ─── */}
                  {statsData.allTime && (function(){
                    const at = statsData.allTime;
                    const fmt = function(n){ return (n==null) ? "—" : n.toLocaleString("fr-FR"); };
                    const onlineTot = (at.duels||0) + (at.rooms||0);
                    // Vrai total de parties = somme des événements play_* (tous
                    // les modes). bb_scores ne reçoit que les modes qui
                    // enregistrent un score (surtout The Plug / The Mercato) :
                    // s'en servir de « parties au total » sous-comptait GOAT
                    // Guess, GOAT Grid, la devinette… d'où deux cartes distinctes.
                    const pat = statsData.playsAllTime;
                    const playsTot = pat ? Object.keys(pat).reduce(function(s,k){ return s + pat[k].solo + pat[k].online; }, 0) : null;
                    const cards = [
                      { v: playsTot,   label: "parties jouées",     color: "#00E676", sub: pat ? "tous modes confondus" : "table bb_events absente" },
                      { v: at.games,   label: "scores enregistrés", color: "#60a5fa", sub: "modes qui classent un score" },
                      { v: onlineTot,  label: "parties en ligne",   color: "#FF8A2A", sub: `${fmt(at.duels)} duels · ${fmt(at.rooms)} salons` },
                      { v: at.accounts,label: "comptes créés",      color: "#FFD600", sub: "depuis le lancement" },
                    ];
                    return (
                      <div style={{marginBottom:20}}>
                        <div style={{fontSize:11,letterSpacing:2,color:"rgba(255,255,255,.4)",fontWeight:800,textTransform:"uppercase",marginBottom:10,paddingLeft:4}}>📈 Depuis le début</div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                          {cards.map(function(c,i){return(
                            <div key={i} style={{background:"linear-gradient(150deg, "+c.color+"1f, rgba(255,255,255,.03) 60%, rgba(0,0,0,.2))",border:"1px solid "+c.color+"44",borderRadius:18,padding:"16px 14px",textAlign:"center"}}>
                              <div style={{fontFamily:G.heading,fontSize:38,color:c.color,lineHeight:1,textShadow:"0 0 20px "+c.color+"40"}}>{fmt(c.v)}</div>
                              <div style={{fontSize:10.5,letterSpacing:1,color:"rgba(255,255,255,.6)",fontWeight:800,textTransform:"uppercase",marginTop:7}}>{c.label}</div>
                              <div style={{fontSize:10,color:"rgba(255,255,255,.35)",fontWeight:600,marginTop:3}}>{c.sub}</div>
                            </div>
                          );})}
                        </div>
                      </div>
                    );
                  })()}
                  {/* ─── PARTIES PAR MODE · DEPUIS LE DÉBUT ───
                      La section « Modes de jeu · N j » plus bas ne voit que la
                      fenêtre d'analyse (14 j max). Celle-ci donne l'historique
                      complet, avec la répartition solo / en ligne. */}
                  {statsData.playsAllTime && (function(){
                    const pat = statsData.playsAllTime;
                    const rows = PLAY_MODES_META
                      .map(function(m){ const c = pat[m.key] || {solo:0,online:0}; return {...m, solo:c.solo, online:c.online, n:c.solo+c.online}; })
                      .sort(function(a,b){ return b.n - a.n; });
                    const total = rows.reduce(function(s,r){ return s + r.n; }, 0);
                    const maxN = Math.max(1, ...rows.map(function(r){ return r.n; }));
                    const sinceLabel = statsData.trackingSince
                      ? new Date(statsData.trackingSince).toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})
                      : null;
                    return (
                      <div style={{marginBottom:24}}>
                        <div style={{fontSize:11,letterSpacing:2,color:"rgba(255,255,255,.4)",fontWeight:800,textTransform:"uppercase",marginBottom:10,paddingLeft:4}}>🎮 Parties par mode · depuis le début</div>
                        {total === 0 ? (
                          <div style={{fontSize:12.5,color:"rgba(255,255,255,.45)",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.07)",borderRadius:12,padding:"14px",lineHeight:1.5}}>Aucune partie enregistrée pour l'instant.</div>
                        ) : (
                          <>
                            <div style={{display:"flex",flexDirection:"column",gap:13}}>
                              {rows.map(function(r,i){
                                const pct = total ? Math.round(r.n/total*100) : 0;
                                return (
                                  // Nom AU-DESSUS de la barre : en colonne fixe,
                                  // « Devinette du jour » ou « Trouve le joueur »
                                  // se faisaient tronquer sur un écran de téléphone.
                                  <div key={r.key}>
                                    <div style={{display:"flex",alignItems:"baseline",gap:6,marginBottom:4}}>
                                      <span style={{fontSize:12.5}}>{r.emoji}</span>
                                      <span style={{fontSize:12.5,color:i===0?r.color:"rgba(255,255,255,.7)",fontWeight:i===0?800:600}}>{r.label}</span>
                                      {i===0?<span style={{fontSize:11}}>👑</span>:null}
                                      <span style={{flex:1}}/>
                                      <span style={{fontSize:13,color:"#fff",fontWeight:800}}>{r.n}<span style={{color:"rgba(255,255,255,.35)",fontWeight:600,fontSize:11}}> · {pct}%</span></span>
                                    </div>
                                    <div style={{height:22,background:"rgba(255,255,255,.05)",borderRadius:8,overflow:"hidden"}}>
                                      <div style={{height:"100%",width:Math.round(r.n/maxN*100)+"%",minWidth:r.n?8:0,background:r.color,opacity:i===0?1:.55,borderRadius:8,transition:"width .4s"}}/>
                                    </div>
                                    <div style={{fontSize:10.5,color:"rgba(255,255,255,.34)",fontWeight:600,marginTop:3}}>{r.solo} solo{r.online?" · "+r.online+" en ligne":""}</div>
                                  </div>
                                );
                              })}
                            </div>
                            <div style={{textAlign:"right",fontSize:11,color:"rgba(255,255,255,.35)",fontWeight:600,paddingRight:4,marginTop:8}}>{total.toLocaleString("fr-FR")} parties au total</div>
                            {sinceLabel && (
                              <div style={{fontSize:11,color:"rgba(255,255,255,.3)",fontWeight:600,lineHeight:1.5,marginTop:6,paddingLeft:4}}>Suivi par mode démarré le {sinceLabel} — les parties jouées avant ne sont pas comptées ici.</div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })()}
                  {/* Cartes parties (fenêtre) / comptes (total) */}
                  <div style={{display:"flex",gap:12,marginBottom:20}}>
                    <div style={{flex:1,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:18,padding:"16px",textAlign:"center"}}>
                      <div style={{fontFamily:G.heading,fontSize:34,color:"#60a5fa",lineHeight:1}}>{v.gamesWindow}</div>
                      <div style={{fontSize:10.5,letterSpacing:1,color:"rgba(255,255,255,.5)",fontWeight:800,textTransform:"uppercase",marginTop:6}}>parties / {v.range} j</div>
                    </div>
                    <div style={{flex:1,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:18,padding:"16px",textAlign:"center"}}>
                      <div style={{fontFamily:G.heading,fontSize:34,color:"#FFD600",lineHeight:1}}>{statsData.accounts}</div>
                      <div style={{fontSize:10.5,letterSpacing:1,color:"rgba(255,255,255,.5)",fontWeight:800,textTransform:"uppercase",marginTop:6}}>comptes créés</div>
                    </div>
                  </div>
                  {/* Détail jour par jour — toujours 14 jours (indépendant de la plage) */}
                  <div style={{fontSize:11,letterSpacing:2,color:"rgba(255,255,255,.4)",fontWeight:800,textTransform:"uppercase",marginBottom:10,paddingLeft:4}}>Jour par jour · 14 j · heure de Paris</div>
                  <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:24}}>
                    {v.days.map(function(d,i){
                      return (
                        <div key={i} style={{display:"flex",alignItems:"center",gap:12}}>
                          <div style={{width:104,fontSize:12.5,color:i===0?"#00E676":"rgba(255,255,255,.6)",fontWeight:i===0?800:600,textTransform:"capitalize",flexShrink:0}}>{i===0?"Aujourd'hui":fmtDay(d.day)}</div>
                          <div style={{flex:1,height:26,background:"rgba(255,255,255,.05)",borderRadius:8,overflow:"hidden",position:"relative"}}>
                            <div style={{height:"100%",width:Math.round(d.players/maxP*100)+"%",minWidth:d.players?8:0,background:i===0?"linear-gradient(90deg,#00E676,#B9F600)":"rgba(96,165,250,.55)",borderRadius:8,transition:"width .4s"}}/>
                          </div>
                          <div style={{width:74,textAlign:"right",fontSize:13,color:"#fff",fontWeight:800,flexShrink:0}}>{d.players}<span style={{color:"rgba(255,255,255,.35)",fontWeight:600,fontSize:11}}> · {d.games}p</span></div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Modes de jeu les plus joués (sur la fenêtre) */}
                  <div style={{fontSize:11,letterSpacing:2,color:"rgba(255,255,255,.4)",fontWeight:800,textTransform:"uppercase",marginBottom:10,paddingLeft:4}}>Modes de jeu · {v.range} j</div>
                  {(function(){
                    const pbm = v.playsByMode || {pont:0,chaine:0,grid:0,guess:0,battle:0,reveal:0,devinette:0};
                    const total = v.totalPlays || 0;
                    const rows = PLAY_MODES_META.map(function(m){return {...m, n: pbm[m.key]||0};}).sort(function(a,b){return b.n-a.n;});
                    const maxN = Math.max(1, ...rows.map(function(r){return r.n;}));
                    if (!statsData.hasEvents) {
                      return <div style={{fontSize:12.5,color:"rgba(255,200,0,.7)",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.07)",borderRadius:12,padding:"14px",marginBottom:24,lineHeight:1.5}}>⚠️ Table <code>bb_events</code> absente : le suivi par mode arrivera dès qu'elle existe.</div>;
                    }
                    if (total === 0) {
                      return <div style={{fontSize:12.5,color:"rgba(255,255,255,.45)",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.07)",borderRadius:12,padding:"14px",marginBottom:24,lineHeight:1.5}}>Aucune partie enregistrée pour l'instant. Le suivi démarre avec ce déploiement — reviens dans quelques heures.</div>;
                    }
                    return (
                      <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:24}}>
                        {rows.map(function(r,i){
                          const pct = total ? Math.round(r.n/total*100) : 0;
                          return (
                            <div key={r.key}>
                              <div style={{display:"flex",alignItems:"baseline",gap:6,marginBottom:4}}>
                                <span style={{fontSize:12.5}}>{r.emoji}</span>
                                <span style={{fontSize:12.5,color:i===0?r.color:"rgba(255,255,255,.7)",fontWeight:i===0?800:600}}>{r.label}</span>
                                {i===0&&r.n>0?<span style={{fontSize:11}}>👑</span>:null}
                                <span style={{flex:1}}/>
                                <span style={{fontSize:13,color:"#fff",fontWeight:800}}>{r.n}<span style={{color:"rgba(255,255,255,.35)",fontWeight:600,fontSize:11}}> · {pct}%</span></span>
                              </div>
                              <div style={{height:22,background:"rgba(255,255,255,.05)",borderRadius:8,overflow:"hidden"}}>
                                <div style={{height:"100%",width:Math.round(r.n/maxN*100)+"%",minWidth:r.n?8:0,background:r.color,opacity:i===0?1:.55,borderRadius:8,transition:"width .4s"}}/>
                              </div>
                            </div>
                          );
                        })}
                        <div style={{textAlign:"right",fontSize:11,color:"rgba(255,255,255,.35)",fontWeight:600,paddingRight:4}}>{total} parties lancées au total</div>
                      </div>
                    );
                  })()}
                  {/* ─── QUI JOUE À QUOI (fenêtre) ───
                      Les sections précédentes disent COMBIEN de parties par mode,
                      pas QUI les a jouées. Ici : un joueur par ligne, ses parties
                      et son détail par mode. */}
                  {statsData.hasEvents && (function(){
                    const all = v.players || [];
                    if (!all.length) return null;
                    const pseudoById = statsData.pseudoById || {};
                    const shown = all.slice(0, 15);
                    const named = all.filter(function(p){ return pseudoById[p.pid]; }).length;
                    const emojiOf = {};
                    PLAY_MODES_META.forEach(function(m){ emojiOf[m.key] = m; });
                    return (
                      <div style={{marginBottom:24}}>
                        <div style={{fontSize:11,letterSpacing:2,color:"rgba(255,255,255,.4)",fontWeight:800,textTransform:"uppercase",marginBottom:4,paddingLeft:4}}>👤 Qui joue à quoi · {v.range} j</div>
                        <div style={{fontSize:11,color:"rgba(255,255,255,.3)",fontWeight:600,marginBottom:10,paddingLeft:4,lineHeight:1.5}}>{all.length} joueurs · {named} inscrits, {all.length - named} sans compte (identifiant d'appareil).</div>
                        <div style={{display:"flex",flexDirection:"column",gap:10}}>
                          {shown.map(function(p,i){
                            const pseudo = pseudoById[p.pid];
                            const modes = Object.keys(p.modes).map(function(k){ return {k:k, n:p.modes[k], meta:emojiOf[k]}; }).sort(function(a,b){ return b.n - a.n; });
                            return (
                              <div key={p.pid} style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:12,padding:"10px 12px"}}>
                                <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                                  <span style={{fontSize:11,color:"rgba(255,255,255,.3)",fontWeight:800,minWidth:16}}>{i+1}</span>
                                  <span style={{fontSize:13,fontWeight:800,color:pseudo?"#fff":"rgba(255,255,255,.5)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pseudo ? "@"+pseudo : "anonyme · "+p.pid}</span>
                                  <span style={{flex:1}}/>
                                  <span style={{fontSize:13,fontWeight:800,color:"#00E676",flexShrink:0}}>{p.n}</span>
                                </div>
                                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:7}}>
                                  {modes.map(function(m){
                                    const meta = m.meta || {emoji:"•",label:m.k,color:"#888"};
                                    return <span key={m.k} style={{fontSize:11,fontWeight:700,color:meta.color,background:meta.color+"1a",border:"1px solid "+meta.color+"33",borderRadius:999,padding:"3px 8px",whiteSpace:"nowrap"}}>{meta.emoji} {meta.label} · {m.n}</span>;
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {all.length > shown.length && (
                          <div style={{textAlign:"right",fontSize:11,color:"rgba(255,255,255,.35)",fontWeight:600,paddingRight:4,marginTop:8}}>+ {all.length - shown.length} autres joueurs</div>
                        )}
                      </div>
                    );
                  })()}
                  {/* ─── TEMPS PASSÉ DANS L'APP (fenêtre) ───
                      Alimenté par les événements "dur_<s>" (trackTime). Rien
                      n'était mesuré avant : tant qu'aucune session n'est
                      remontée, on le dit au lieu d'afficher 0. */}
                  {statsData.hasEvents && (function(){
                    const fmtDur = function(sec){
                      if (sec < 60) return Math.round(sec) + " s";
                      const m = Math.floor(sec/60), s = Math.round(sec%60);
                      if (m < 60) return m + " min" + (s ? " " + s + " s" : "");
                      return Math.floor(m/60) + " h " + String(m%60).padStart(2,"0");
                    };
                    const title = <div style={{fontSize:11,letterSpacing:2,color:"rgba(255,255,255,.4)",fontWeight:800,textTransform:"uppercase",marginBottom:10,paddingLeft:4}}>⏱️ Temps passé dans l'app · {v.range} j</div>;
                    if (!v.sessions) {
                      return (
                        <div style={{marginBottom:24}}>
                          {title}
                          <div style={{fontSize:12.5,color:"rgba(255,255,255,.45)",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.07)",borderRadius:12,padding:"14px",lineHeight:1.5}}>La mesure du temps démarre avec ce déploiement — aucune session enregistrée avant. Reviens dans quelques heures.</div>
                        </div>
                      );
                    }
                    const cards = [
                      { v: fmtDur(v.timeTotalS / v.sessions), label:"par session", color:"#00E676" },
                      { v: fmtDur(v.timeTotalS / Math.max(1, v.timePlayers)), label:"par joueur", color:"#60a5fa" },
                      { v: fmtDur(v.timeTotalS), label:"temps cumulé", color:"#FFD600" },
                    ];
                    return (
                      <div style={{marginBottom:24}}>
                        {title}
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                          {cards.map(function(c,i){return(
                            <div key={i} style={{background:"linear-gradient(150deg, "+c.color+"1f, rgba(255,255,255,.03) 60%, rgba(0,0,0,.2))",border:"1px solid "+c.color+"44",borderRadius:16,padding:"14px 8px",textAlign:"center"}}>
                              <div style={{fontFamily:G.heading,fontSize:24,color:c.color,lineHeight:1.1}}>{c.v}</div>
                              <div style={{fontSize:9.5,letterSpacing:1,color:"rgba(255,255,255,.55)",fontWeight:800,textTransform:"uppercase",marginTop:6}}>{c.label}</div>
                            </div>
                          );})}
                        </div>
                        <div style={{fontSize:11,color:"rgba(255,255,255,.3)",fontWeight:600,lineHeight:1.5,marginTop:8,paddingLeft:4}}>{v.sessions} sessions · {v.timePlayers} joueurs. Seul le temps écran réel compte : app en arrière-plan exclue.</div>
                      </div>
                    );
                  })()}
                  {/* Solo vs En ligne (fenêtre) */}
                  {statsData.hasEvents && (v.playsSolo + v.playsOnline) > 0 ? (function(){
                    const solo = v.playsSolo || 0, online = v.playsOnline || 0, tot = solo + online;
                    const pOnline = Math.round(online/tot*100);
                    return (
                      <div style={{marginBottom:24}}>
                        <div style={{fontSize:11,letterSpacing:2,color:"rgba(255,255,255,.4)",fontWeight:800,textTransform:"uppercase",marginBottom:10,paddingLeft:4}}>Solo vs En ligne · {v.range} j</div>
                        <div style={{display:"flex",height:34,borderRadius:10,overflow:"hidden",border:"1px solid rgba(255,255,255,.1)"}}>
                          <div style={{width:(100-pOnline)+"%",background:"rgba(96,165,250,.55)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#fff",minWidth:solo?40:0}}>{solo?(100-pOnline)+"%":""}</div>
                          <div style={{width:pOnline+"%",background:"linear-gradient(90deg,#00E676,#B9F600)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#0A1410",minWidth:online?40:0}}>{online?pOnline+"%":""}</div>
                        </div>
                        <div style={{display:"flex",justifyContent:"space-between",marginTop:8,fontSize:12,fontWeight:700}}>
                          <span style={{color:"#8CC0FF"}}>🎮 Solo · {solo}</span>
                          <span style={{color:"#00E676"}}>🌐 En ligne · {online}</span>
                        </div>
                      </div>
                    );
                  })() : null}
                  {/* Répartition par OS mobile (iOS / Android) */}
                  {v.osCount && (v.osCount.ios + v.osCount.android + v.osCount.other) > 0 ? (function(){
                    const os = v.osCount; const tot = os.ios + os.android + os.other;
                    const pct = (n)=> tot ? Math.round(n/tot*100) : 0;
                    return (
                      <div style={{marginBottom:24}}>
                        <div style={{fontSize:11,letterSpacing:2,color:"rgba(255,255,255,.4)",fontWeight:800,textTransform:"uppercase",marginBottom:10,paddingLeft:4}}>📱 Appareils · {v.range} j</div>
                        <div style={{display:"flex",height:34,borderRadius:10,overflow:"hidden",border:"1px solid rgba(255,255,255,.1)"}}>
                          {os.ios>0 && <div style={{width:pct(os.ios)+"%",background:"rgba(255,255,255,.75)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#000",minWidth:34}}>{pct(os.ios)}%</div>}
                          {os.android>0 && <div style={{width:pct(os.android)+"%",background:"linear-gradient(90deg,#3DDC84,#00E676)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#0A1410",minWidth:34}}>{pct(os.android)}%</div>}
                          {os.other>0 && <div style={{width:pct(os.other)+"%",background:"rgba(255,255,255,.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#fff",minWidth:34}}>{pct(os.other)}%</div>}
                        </div>
                        <div style={{display:"flex",justifyContent:"space-between",marginTop:8,fontSize:12,fontWeight:700,gap:8}}>
                          <span style={{color:"#fff"}}>🍎 iOS · {os.ios}</span>
                          <span style={{color:"#3DDC84"}}>🤖 Android · {os.android}</span>
                          {os.other>0 && <span style={{color:"rgba(255,255,255,.5)"}}>💻 Autre · {os.other}</span>}
                        </div>
                        <div style={{fontSize:10.5,color:"rgba(255,255,255,.3)",marginTop:6,paddingLeft:4}}>Appareils uniques ayant ouvert l'app (depuis l'ajout du suivi OS).</div>
                      </div>
                    );
                  })() : null}
                  {/* Derniers comptes créés */}
                  <div style={{fontSize:11,letterSpacing:2,color:"rgba(255,255,255,.4)",fontWeight:800,textTransform:"uppercase",marginBottom:10,paddingLeft:4}}>Derniers comptes créés</div>
                  {(statsData.recent && statsData.recent.length) ? (
                    <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>
                      {statsData.recent.map(function(u,i){
                        const dt = statsData.recentHasDate && u.created_at ? new Date(u.created_at) : null;
                        const when = dt ? dt.toLocaleDateString("fr-FR",{day:"numeric",month:"short"})+" · "+dt.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}) : "";
                        return (
                          <div key={i} style={{display:"flex",alignItems:"center",gap:10,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.07)",borderRadius:12,padding:"10px 14px"}}>
                            <span style={{fontSize:16,width:22,textAlign:"center",flexShrink:0}}>{u.country?countryToFlag(u.country):"🌍"}</span>
                            <span style={{flex:1,fontSize:14,fontWeight:800,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>@{u.pseudo}</span>
                            <span style={{fontSize:12,color:"rgba(255,255,255,.45)",fontWeight:600,flexShrink:0}}>{when}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{fontSize:12.5,color:"rgba(255,255,255,.45)",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.07)",borderRadius:12,padding:"14px",marginBottom:14,lineHeight:1.5}}>Aucun compte à afficher.</div>
                  )}
                  {statsData.recent && statsData.recent.length && !statsData.recentHasDate ? (
                    <div style={{fontSize:11,color:"rgba(255,200,0,.7)",marginBottom:14,paddingLeft:4}}>⚠️ La date de création n'est pas enregistrée dans la base (colonne <code>created_at</code> absente de bb_pseudos). Je peux te l'ajouter si tu veux les dates.</div>
                  ) : null}

                  {statsData.hasEvents ? (
                    <div style={{textAlign:"center",fontSize:11,color:"rgba(255,255,255,.3)",marginTop:16,lineHeight:1.5}}>Actifs = joueurs uniques (inscrits + anonymes) ayant ouvert l'app ce jour-là (heure UTC). « Parties » = parties terminées.</div>
                  ) : (
                    <div style={{textAlign:"center",fontSize:11,color:"rgba(255,200,0,.7)",marginTop:16,lineHeight:1.5}}>⚠️ Table <code>bb_events</code> absente : les anonymes ne sont pas encore comptés (chiffres basés sur les parties d'inscrits). Crée la table pour les voir.</div>
                  )}
                </>
                );
              })()}
            </div>
          </div>
        )}

        {/* ── HOME RULES MODAL ── */}
        {homeRulesModal && (() => {
          const RULES_DATA = {
            grid:    { title: "TROUVE LE JOUEUR", emoji: "🕵️", accent: "#00E676", bg: "linear-gradient(135deg,rgba(0,230,118,.18),rgba(255,214,0,.12))",
              rules_fr: ["Un joueur mystère à deviner, en illimité","6 essais : chaque proposition révèle des indices (nationalité, zone, poste, âge, club…)","Feedback façon Wordle : ✓ vert, ✗ rouge, ↑↓ pour l'âge","Le parcours est caché — pure déduction (révélable en indice)","Enchaîne les bonnes réponses pour monter ta SÉRIE 🔥 et grimper au classement"],
              rules_en: ["A mystery player to guess, unlimited","6 tries: each guess reveals clues (nationality, zone, position, age, club…)","Wordle-style feedback: ✓ green, ✗ red, ↑↓ for age","The career is hidden — pure deduction (revealable as a hint)","Chain correct answers to build your STREAK 🔥 and climb the leaderboard"]
            },
            mercato: { title: "GOAT MERCATO", emoji: "⛓",  accent: "#60a5fa", bg: "linear-gradient(135deg,rgba(96,165,250,.18),rgba(59,130,246,.12))",
              rules_fr: ["Démarre avec un joueur, enchaîne sans t'arrêter","Tape un club où il a joué","Puis un autre joueur qui a joué dans ce club","Et ainsi de suite jusqu'à la fin du chrono","Plus la chaîne est longue, plus tu scores"],
              rules_en: ["Start with a player, chain without stopping","Type a club they played for","Then another player who played at that club","And so on until time runs out","The longer the chain, the bigger the score"]
            },
            plug:    { title: "GOAT PLUG",    emoji: "⚽", accent: "#FFD600", bg: "linear-gradient(135deg,rgba(255,214,0,.18),rgba(255,107,53,.12))",
              rules_fr: ["On te montre 2 clubs","Trouve un joueur qui a joué dans les deux","Tu as 60 secondes par manche","+2 points par bonne réponse, −10 par pass","Difficulté progressive : facile → moyen → expert"],
              rules_en: ["We show you 2 clubs","Find a player who played for both","You have 60 seconds per round","+2 points per correct answer, −10 per skip","Progressive difficulty: easy → medium → expert"]
            },
            guess:   { title: "GOAT GUESS",   emoji: "🔮", accent: "#C084FC", bg: "linear-gradient(135deg,rgba(192,132,252,.18),rgba(255,138,42,.12))",
              rules_fr: ["Pense à un footballeur connu (actuel ou retraité)","Je te pose jusqu'à 25 questions oui / non / sais pas","Tu réponds honnêtement, je restreins mes candidats","Je devine ton joueur — si je rate, je retente jusqu'à 5 fois","Questions par étapes : Continent → Nation → Ligue → Club → Poste"],
              rules_en: ["Think of a famous footballer (active or retired)","I'll ask up to 25 yes / no / don't know questions","Answer honestly — I narrow down my candidates","I guess your player — if I'm wrong, I try up to 5 times","Questions by stage: Continent → Nation → League → Club → Position"]
            },
            goatgrid:{ title: "GOAT GRID",    emoji: "🎯", accent: "#FF6B35", bg: "linear-gradient(135deg,rgba(255,107,53,.18),rgba(255,68,68,.12))",
              rules_fr: ["Une grille 3×3 : 9 cases à remplir","Chaque case croise deux critères (club, nationalité, poste, ligue)","Nomme un joueur qui coche les deux à la fois","Un joueur ne peut servir qu'une seule fois dans la grille","Plus le joueur cité est rare, plus la case rapporte de points"],
              rules_en: ["A 3×3 grid: 9 cells to fill","Each cell crosses two criteria (club, nationality, position, league)","Name a player who matches both at once","A player can only be used once per grid","The rarer the player you name, the more the cell scores"]
            },
            duel:    { title: "GOAT BATTLE",  emoji: "⚔️", accent: "#3DA5FF", bg: "linear-gradient(135deg,rgba(61,165,255,.18),rgba(0,230,118,.12))",
              rules_fr: ["Duel en direct sur The Plug","Deux clubs s'affichent, trouve le joueur qui relie les deux","Le plus rapide à répondre marque le point","Crée un salon et partage le code, ou rejoins celui d'un pote","Le meilleur score à la fin des manches l'emporte"],
              rules_en: ["Live head-to-head on The Plug","Two clubs appear — find the player who links them","Fastest correct answer takes the point","Create a room and share the code, or join a friend's","Best score at the end of the rounds wins"]
            },
          };
          const data = RULES_DATA[homeRulesModal];
          // Garde : une carte sans règles ne doit pas casser l'app (le bouton ⓘ
          // de la carte duel plantait, aucune entrée n'existait pour elle).
          if (!data) return null;
          const rules = lang === "en" ? data.rules_en : data.rules_fr;
          return (
            <div
              style={{position:"fixed",inset:0,zIndex:400,display:"flex",alignItems:"flex-end"}}
              onClick={function(e){if(e.target===e.currentTarget)setHomeRulesModal(null);}}
            >
              <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.75)",backdropFilter:"blur(10px)"}} onClick={function(){setHomeRulesModal(null);}}/>
              <div style={{position:"relative",width:"100%",background:"#0d1f1a",borderTopLeftRadius:24,borderTopRightRadius:24,padding:"22px 22px 28px",zIndex:1,maxHeight:"80vh",overflowY:"auto",boxShadow:"0 -8px 32px rgba(0,0,0,.6)"}}>
                {/* Bandeau accent + handle */}
                <div style={{width:48,height:4,background:"rgba(255,255,255,.2)",borderRadius:2,margin:"0 auto 16px"}}/>
                {/* Titre + emoji */}
                <div style={{textAlign:"center",marginBottom:18}}>
                  <div style={{fontSize:48,marginBottom:8,filter:"drop-shadow(0 4px 16px "+data.accent+"55)"}}>{data.emoji}</div>
                  <div style={{fontFamily:G.heading,fontSize:26,letterSpacing:2,color:data.accent,lineHeight:1,marginBottom:6,textShadow:"0 4px 24px "+data.accent+"33"}}>{data.title}</div>
                  <div style={{fontSize:11,letterSpacing:2,color:"rgba(255,255,255,.5)",textTransform:"uppercase",fontWeight:700}}>{tr("Règles du jeu","How to play","Spielregeln","Come si gioca","Como jogar")}</div>
                </div>
                {/* Liste des règles */}
                <div style={{background:data.bg,border:"1.5px solid "+data.accent+"40",borderRadius:16,padding:"16px 18px",marginBottom:18}}>
                  {rules.map(function(r, i){
                    return (
                      <div key={i} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"8px 0",borderBottom:i<rules.length-1?"1px solid rgba(255,255,255,.08)":"none"}}>
                        <div style={{minWidth:22,height:22,borderRadius:"50%",background:data.accent,color:"#000",fontSize:11,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",marginTop:1}}>{i+1}</div>
                        <div style={{flex:1,fontSize:14,color:G.white,lineHeight:1.4,fontWeight:500}}>{r}</div>
                      </div>
                    );
                  })}
                </div>
                {/* Bouton fermer */}
                <button
                  onClick={function(){setHomeRulesModal(null);}}
                  style={{width:"100%",padding:"15px",background:data.accent,color:"#000",border:"none",borderRadius:14,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800,letterSpacing:1}}
                >{tr("COMPRIS","GOT IT","VERSTANDEN","CAPITO","ENTENDI")}</button>
              </div>
            </div>
          );
        })()}

        {/* ── BACK BUTTON HINT (Android double-tap) ── */}
        {showBackHint && (
          <div style={{
            position:"fixed",
            bottom:"calc(40px + env(safe-area-inset-bottom))",
            left:"50%",
            transform:"translateX(-50%)",
            background:"rgba(0,0,0,.88)",
            color:"#fff",
            padding:"13px 22px",
            borderRadius:30,
            fontSize:13,
            fontWeight:700,
            letterSpacing:.5,
            zIndex:10000,
            backdropFilter:"blur(10px)",
            border:"1px solid rgba(255,255,255,.18)",
            animation:"fadeIn .2s ease-out",
            pointerEvents:"none",
            boxShadow:"0 8px 32px rgba(0,0,0,.5)",
            whiteSpace:"nowrap"
          }}>
            ⚠️ {tr("Re-appuie sur retour pour quitter","Tap back again to quit","Nochmal Zurück tippen zum Beenden","Tocca di nuovo indietro per uscire","Toque em voltar de novo para sair")}
          </div>
        )}

        {/* ── CONFIG MODAL ── */}
        {/* ── MATCHMAKING EN LIGNE (mobile) ── */}
        {mmSearch && (() => {
          const found = mmSearch.phase === "found";
          const opp = mmSearch.opponent;
          const myName = (playerName || "").trim() || tr("Toi","You","Du","Tu","Você");
          // Photo de profil du joueur si elle existe ; sinon on retombe sur le
          // visuel GOAT FC dérivé du pseudo.
          // Carte de collection, comme partout ailleurs : l'ancienne photo uploadée
           // n'a plus cours (elle restait visible sur ce seul écran).
           const myAvatar = avatarCard(playerBadge, playerXp).img;
          // isPhoto : photo de profil de l'utilisateur → cadrage centré et repli
          // sur le visuel GOAT FC si l'image ne charge pas (photo supprimée).
          const card = function(name, flag, ring, avatar, revealed, isPhoto){
            return (
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",flex:1,minWidth:0}}>
                <div style={{
                  width:96,height:96,borderRadius:"50%",overflow:"hidden",
                  border:`3px solid ${ring}`,boxShadow:`0 0 34px ${ring}55`,
                  background:`linear-gradient(135deg, ${ring}, #0F2017)`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  transition:"opacity .3s",opacity:revealed?1:.45
                }}>
                  {revealed && avatar
                    ? <img src={avatar} alt="" onError={isPhoto ? function(e){ e.currentTarget.src = avatarFor(name); } : undefined}
                        style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:isPhoto?"center":"top"}}/>
                    : <span style={{fontFamily:G.heading,fontSize:38,color:"rgba(255,255,255,.55)"}}>{revealed ? name.charAt(0).toUpperCase() : "?"}</span>}
                </div>
                <div style={{
                  marginTop:12,fontFamily:G.heading,fontSize:20,letterSpacing:1,textAlign:"center",
                  color:revealed?"#fff":"rgba(255,255,255,.4)",
                  maxWidth:"100%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"
                }}>{revealed ? name : "?????"}</div>
                {revealed && flag && <div style={{fontSize:20,marginTop:2}}>{flag}</div>}
              </div>
            );
          };
          return (
            <div role="dialog" aria-modal="true" style={{
              position:"fixed",inset:0,zIndex:340,background:"rgba(0,0,0,.96)",
              backdropFilter:"blur(8px)",display:"flex",flexDirection:"column",
              alignItems:"center",justifyContent:"center",padding:24
            }}>
              <div style={{
                position:"absolute",inset:0,pointerEvents:"none",opacity:.5,
                background:"radial-gradient(circle at center, rgba(61,165,255,.25) 0%, transparent 55%)"
              }}/>

              <button onClick={function(){ setMmSearch(null); }} style={{
                position:"absolute",top:"calc(14px + env(safe-area-inset-top))",right:14,
                padding:"8px 16px",borderRadius:999,background:"rgba(255,255,255,.06)",
                color:"rgba(255,255,255,.6)",border:"1px solid rgba(255,255,255,.15)",
                fontFamily:G.font,fontSize:12,letterSpacing:2,cursor:"pointer"
              }}>{tr("ANNULER","CANCEL","ABBRECHEN","ANNULLA","CANCELAR")}</button>

              <div style={{position:"relative",textAlign:"center",marginBottom:28}}>
                <div style={{fontFamily:G.font,fontSize:11,letterSpacing:5,color:"#3DA5FF",marginBottom:6}}>
                  {tr("MODE EN LIGNE","ONLINE MODE","ONLINE-MODUS","MODALITÀ ONLINE","MODO ONLINE")}
                </div>
                <div style={{fontFamily:G.heading,fontSize:32,letterSpacing:2,color:"#fff"}}>
                  {mmSearch.mode === "pont" ? "THE PLUG" : mmSearch.mode === "battle" ? "GOAT BATTLE" : mmSearch.mode === "duel" ? "GOAT DUEL" : "THE MERCATO"}
                </div>
              </div>

              <div style={{position:"relative",display:"flex",alignItems:"flex-start",gap:8,width:"100%",maxWidth:400,marginBottom:32}}>
                {card(myName, null, "#00E676", myAvatar, true, false)}
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",paddingTop:28,flexShrink:0}}>
                  <div style={{fontFamily:G.heading,fontSize:28,letterSpacing:4,color:found?G.gold:"rgba(255,255,255,.3)",transition:"color .3s"}}>VS</div>
                  {found && <div style={{fontFamily:G.font,fontSize:9,letterSpacing:3,color:G.accent,marginTop:4}}>{tr("✓ TROUVÉ","✓ FOUND","✓ GEFUNDEN","✓ TROVATO","✓ ENCONTRADO")}</div>}
                </div>
                {card(opp.pseudo, opp.country, "#3DA5FF", oppCard(opp), found, false)}
              </div>

              <div style={{position:"relative",textAlign:"center",minHeight:72}}>
                {found ? (
                  <>
                    <div style={{fontFamily:G.heading,fontSize:24,letterSpacing:3,color:G.accent}}>
                      {tr("MATCH PRÊT","MATCH READY","MATCH BEREIT","MATCH PRONTO","PARTIDA PRONTA")}
                    </div>
                    <div style={{fontSize:13,color:"rgba(255,255,255,.5)",marginTop:6}}>
                      {tr("La partie va commencer…","The game is about to start…","Das Spiel startet gleich…","La partita sta per iniziare…","O jogo vai começar…")}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{display:"flex",justifyContent:"center",gap:10,marginBottom:12}}>
                      {[0,1,2].map(function(i){return (
                        <div key={i} className="goat-blink" style={{width:10,height:10,borderRadius:"50%",background:"#3DA5FF",animationDelay:(i*0.3)+"s"}}/>
                      );})}
                    </div>
                    <div style={{fontFamily:G.heading,fontSize:22,letterSpacing:2,color:"#fff"}}>
                      {tr("RECHERCHE D'UN ADVERSAIRE","FINDING AN OPPONENT","SUCHE NACH GEGNER","RICERCA AVVERSARIO","PROCURANDO ADVERSÁRIO")}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })()}

        {gameConfigModal && (
          <div
            style={{position:"fixed",inset:0,zIndex:300,background:"#0a0a0a",overflowY:"auto",WebkitOverflowScrolling:"touch"}}
          >
            {(() => {
              const isPont = gameConfigModal==="pont";
              const accentColor = isPont ? "#FFD600" : "#60a5fa";
              const accentSecondary = isPont ? "#FF6B35" : "#3b82f6";
              return (
                <div style={{
                  position:"relative",
                  width:"100%",
                  minHeight:"100vh",
                  display:"flex",
                  flexDirection:"column",
                  animation:"fadeIn .3s ease-out",
                }}>
                  {/* ── BOUTON FERMER (X en haut à droite) ── */}
                  <button onClick={function(){setGameConfigModal(null);}} style={{
                    position:"fixed",top:"calc(14px + env(safe-area-inset-top))",right:14,zIndex:10,
                    width:38,height:38,borderRadius:"50%",
                    background:"rgba(0,0,0,.65)",color:"#fff",
                    border:"1px solid rgba(255,255,255,.25)",
                    fontSize:22,fontWeight:300,lineHeight:1,
                    cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
                    backdropFilter:"blur(10px)",
                    boxShadow:"0 4px 16px rgba(0,0,0,.5)"
                  }}>×</button>

                  {/* ── HERO IMAGE — visuel ENTIER (pas de crop), hauteur limitée pour laisser place au contenu ── */}
                  <div style={{position:"relative",width:"100%",height:"50vh",maxHeight:"540px",minHeight:"300px",overflow:"hidden",background:"#000",flexShrink:0}}>
                    <img
                      src={isPont ? PLUG_CARD_IMG : MERCATO_CARD_IMG}
                      alt=""
                      style={{width:"100%",height:"100%",objectFit:"contain",pointerEvents:"none",userSelect:"none"}}
                      draggable={false}
                    />
                    {/* Gradient bottom pour transition douce vers le contenu */}
                    <div style={{position:"absolute",bottom:0,left:0,right:0,height:50,background:"linear-gradient(to top, #0a0a0a 0%, transparent 100%)",pointerEvents:"none"}}/>
                  </div>

                  <div style={{position:"relative",zIndex:1,padding:"14px 22px calc(20px + env(safe-area-inset-bottom))",flex:1,display:"flex",flexDirection:"column",justifyContent:"flex-start"}}>
                    {/* Badge format de jeu (🔗 2 CLUBS → 👤 1 JOUEUR) */}
                    <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:14,padding:"10px 16px",background:`${accentColor}10`,border:`1.5px solid ${accentColor}40`,borderRadius:12,marginBottom:18,backdropFilter:"blur(10px)"}}>
                      {isPont ? (
                        <>
                          <span style={{display:"flex",alignItems:"center",gap:6,color:accentColor,fontSize:14,fontWeight:800,letterSpacing:1}}>🔗 <span style={{color:G.white}}>2 {tr("CLUBS","CLUBS","KLUBS","CLUB","CLUBES")}</span></span>
                          <span style={{color:accentColor,fontSize:15,fontWeight:800}}>→</span>
                          <span style={{display:"flex",alignItems:"center",gap:6,color:accentColor,fontSize:14,fontWeight:800,letterSpacing:1}}>👤 <span style={{color:G.white}}>1 {tr("JOUEUR","PLAYER","SPIELER","GIOCATORE","JOGADOR")}</span></span>
                        </>
                      ) : (
                        <>
                          <span style={{display:"flex",alignItems:"center",gap:6,color:accentColor,fontSize:14,fontWeight:800,letterSpacing:1}}>👤 <span style={{color:G.white}}>{tr("JOUEUR","PLAYER","SPIELER","GIOCATORE","JOGADOR")}</span></span>
                          <span style={{color:accentColor,fontSize:15,fontWeight:800}}>→</span>
                          <span style={{display:"flex",alignItems:"center",gap:6,color:accentColor,fontSize:14,fontWeight:800,letterSpacing:1}}>🛡 <span style={{color:G.white}}>{tr("CLUB","CLUB","KLUB","CLUB","CLUBE")}</span></span>
                          <span style={{color:accentColor,fontSize:15,fontWeight:800}}>→</span>
                          <span style={{color:accentColor,fontSize:14,fontWeight:800,letterSpacing:1}}>👤<span style={{color:G.white,marginLeft:6}}>...</span></span>
                        </>
                      )}
                    </div>

                    {/* Difficulté */}
                    <div style={{fontSize:10,fontWeight:800,letterSpacing:3,textTransform:"uppercase",color:"rgba(255,255,255,.45)",marginBottom:8}}>{tr("Difficulté","Difficulty","Schwierigkeit","Difficoltà","Dificuldade")}</div>
                    <div style={{display:"flex",gap:8,marginBottom:16}}>
                      {["facile","moyen","expert"].map(function(d){
                        const dLabel = d==="facile"?"AMATEUR":d==="moyen"?"PRO":"CRESCENDO";
                        const dColor = d==="facile"?"#00E676":d==="moyen"?"#FFD600":"#FF3D57";
                        const stars = d==="facile"?1:d==="moyen"?2:3;
                        return(
                          <button key={d} onClick={function(){setDiff(d);}} style={{
                            flex:1,padding:"11px 4px",borderRadius:12,
                            border:`1.5px solid ${diff===d?dColor:"rgba(255,255,255,.1)"}`,
                            background:diff===d?`${dColor}15`:"rgba(255,255,255,.03)",
                            color:diff===d?dColor:"rgba(255,255,255,.5)",
                            fontFamily:G.font,fontWeight:800,cursor:"pointer",fontSize:12,letterSpacing:1,transition:"all .15s",
                            display:"flex",flexDirection:"column",alignItems:"center",gap:3,
                            boxShadow:diff===d?`0 4px 16px ${dColor}33`:"none"
                          }}>
                            <div style={{fontSize:11,letterSpacing:1}}>{d==="expert"?"📈":"⭐".repeat(stars)}</div>
                            <div>{dLabel}</div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Manches sélecteur supprimé : 1 manche de 90s par défaut pour Mercato et Plug */}

                    {/* ── EN LIGNE — matchmaking (même mécanique que sur desktop) ── */}
                    <button onClick={function(){
                      const m = gameConfigModal;
                      setGameConfigModal(null);
                      setMmSearch({ mode: m, opponent: pickOpponent(), phase: "searching" });
                    }} style={{
                      width:"100%",marginBottom:10,padding:"14px 16px",borderRadius:16,
                      border:"1.5px solid rgba(61,165,255,.6)",
                      background:"linear-gradient(135deg,rgba(61,165,255,.22),rgba(61,165,255,.08))",
                      cursor:"pointer",display:"flex",alignItems:"center",gap:12,textAlign:"left",
                      boxShadow:"0 8px 24px -8px rgba(61,165,255,.5)"
                    }}>
                      <div style={{fontSize:26}}>🌍</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:14,fontWeight:900,color:"#fff",letterSpacing:.5}}>{tr("EN LIGNE","ONLINE","ONLINE","ONLINE","ONLINE")}</div>
                        <div style={{fontSize:11,color:"rgba(255,255,255,.55)",marginTop:2}}>
                          {tr("Affronte un adversaire · même série de clubs","Face an opponent · same club series","Tritt gegen einen Gegner an · gleiche Klubserie","Sfida un avversario · stessa serie di club","Enfrente um adversário · mesma série de clubes")}
                        </div>
                      </div>
                      <div style={{fontSize:18,color:"#3DA5FF"}}>▶</div>
                    </button>

                    {/* Boutons */}
                    <div style={{display:"flex",gap:10}}>
                      <button onClick={function(){const m=gameConfigModal;setGameConfigModal(null);setTimeout(function(){tryStart(m);},50);}} style={{
                        flex:2,padding:"14px",
                        ...btn(G.projecteur),
                        transition:"transform .15s"
                      }} onMouseDown={(e)=>e.currentTarget.style.transform="scale(.97)"} onMouseUp={(e)=>e.currentTarget.style.transform="scale(1)"} onMouseLeave={(e)=>e.currentTarget.style.transform="scale(1)"}>
                        ▶ {tr("Jouer seul","Play solo","Solo spielen","Gioca da solo","Jogar sozinho")}
                      </button>
                      <button onClick={function(){setDuelMode(gameConfigModal);setDuelDiff(diff);setDuelRounds(totalRounds);setGameConfigModal(null);setTimeout(function(){setShowRoomCreate(true);},100);}} style={{
                        flex:1,padding:"14px",
                        ...btn("#0B2213", G.white, 15)
                      }}>
                        👥 {tr("Entre potes","With friends","Mit Freunden","Con gli amici","Com amigos")}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* 🐐 GOAT GRID — Désormais dans le carousel des 3 modes ci-dessus */}

        {/* Défi du jour — CACHÉ (remplacé par GOAT GRID, plomberie conservée pour push notif + streak) */}
        {false && dailyPlayer && (
          <div style={{borderRadius:14,background:dailyDone?"rgba(255,255,255,.04)":"linear-gradient(135deg,rgba(255,214,0,.12),rgba(255,107,53,.12))",border:dailyDone?"1px solid rgba(255,255,255,.1)":"1.5px solid rgba(255,214,0,.3)",padding:"10px 12px",display:"flex",alignItems:"center",gap:10,opacity:dailyDone?.7:1}}>
            <div style={{fontSize:22}}>{dailyDone?(dailyRevealed?"👁️":dailyAbandoned?"🔒":"✅"):"⚡"}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:10,fontWeight:800,letterSpacing:1.5,textTransform:"uppercase",color:dailyDone?"rgba(255,255,255,.3)":"rgba(255,214,0,.7)",marginBottom:1}}>{tr("Défi du jour","Daily challenge","Tägliche Challenge","Sfida del giorno","Desafio do dia")}</div>
              <div style={{fontSize:13,fontWeight:800,color:dailyDone?"rgba(255,255,255,.4)":G.white}}>
                {dailyDone ? (tr("Revenez demain 🔒","Come back tomorrow 🔒","Komm morgen wieder 🔒","Torna domani 🔒","Volte amanhã 🔒")) : (tr("Devine le joueur mystère","Guess the mystery player","Errate den Mystery-Spieler","Indovina il giocatore misterioso","Adivinhe o jogador misterioso"))}
              </div>
              {dailyDone && <div style={{fontSize:10,color:"rgba(255,255,255,.3)",marginTop:1}}>{dailyRevealed ? (tr("Réponse révélée — ","Answer revealed — ","Antwort verraten — ","Risposta rivelata — ","Resposta revelada — "))+dailyPlayer.name : dailyAbandoned ? (tr("Abandonné — ","Abandoned — ","Aufgegeben — ","Abbandonato — ","Abandonado — "))+dailyPlayer.name : (tr("Trouvé en ","Found in ","Gefunden in ","Trovato in ","Encontrado em ")+localStorage.getItem("bb_daily_tries")+" "+(parseInt(localStorage.getItem("bb_daily_tries")||"1")>1?tr("essais","attempts","Versuchen","tentativi","tentativas"):tr("essai","attempt","Versuch","tentativo","tentativa"))+tr(" !","!","!","!","!"))}</div>}
            </div>
            {!dailyDone && <button onClick={function(){setShowDailyGame(true);setDailyGuess("");setDailyFlash(null);setDailySuccess(false);}} style={{padding:"9px 13px",background:"linear-gradient(135deg,#FFD600,#FF6B35)",color:"#000",border:"none",borderRadius:12,cursor:"pointer",fontFamily:G.font,fontSize:12,fontWeight:800,whiteSpace:"nowrap"}}>{tr("Jouer ⚡","Play ⚡","Spielen ⚡","Gioca ⚡","Jogar ⚡")}</button>}
          </div>
        )}

        {/* 🐐 Modal de choix Solo / Multi pour GOAT GRID */}
        {ggModeChoice && (
          <div style={{position:"fixed",inset:0,zIndex:450,background:"#0B1310",backgroundImage:"radial-gradient(ellipse 120% 50% at 50% -5%, rgba(0,230,118,0.10) 0%, transparent 60%)",overflowY:"auto",WebkitOverflowScrolling:"touch"}}>
            <div style={{position:"relative",width:"100%",minHeight:"100vh",display:"flex",flexDirection:"column",animation:"fadeIn .3s ease-out"}}>

              {/* Fermer */}
              <button onClick={function(){setGgModeChoice(false);}} style={{position:"fixed",top:"calc(14px + env(safe-area-inset-top))",right:14,zIndex:10,width:40,height:40,borderRadius:"50%",background:"rgba(255,255,255,.08)",color:"#fff",border:"1px solid rgba(255,255,255,.18)",fontSize:22,fontWeight:300,lineHeight:1,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(10px)"}}>×</button>

              {/* Hero compact : l'affiche en couverture, fondue dans le fond sombre */}
              <div style={{position:"relative",width:"100%",height:"27vh",maxHeight:310,minHeight:200,overflow:"hidden",flexShrink:0}}>
                <img src={GRID_CARD_IMG} alt="" style={{width:"100%",height:"165%",objectFit:"cover",objectPosition:"center 20%",pointerEvents:"none",userSelect:"none"}} draggable={false}/>
                <div style={{position:"absolute",inset:0,background:"linear-gradient(to top, #0B1310 6%, rgba(11,19,16,.35) 42%, rgba(11,19,16,.10) 100%)",pointerEvents:"none"}}/>
                <div style={{position:"absolute",bottom:14,left:0,right:0,textAlign:"center",pointerEvents:"none"}}>
                  <div style={{fontFamily:G.heading,fontSize:34,letterSpacing:3,lineHeight:1,textShadow:"0 4px 24px rgba(0,0,0,.8)"}}>
                    <span style={{color:"#FFFFFF"}}>GOAT </span><span style={{color:"#B9F600"}}>GRID</span>
                  </div>
                </div>
              </div>

              {/* Contenu */}
              <div style={{padding:"16px 16px calc(24px + env(safe-area-inset-bottom))",flex:1,display:"flex",flexDirection:"column",gap:12,maxWidth:520,width:"100%",margin:"0 auto"}}>

                <div style={{textAlign:"center",fontSize:11,color:"rgba(255,255,255,.45)",letterSpacing:3,fontWeight:800,textTransform:"uppercase",marginBottom:2}}>
                  {tr("Choisis ton mode","Choose your mode","Wähle deinen Modus","Scegli la modalità","Escolha seu modo")}
                </div>

                {/* Carte SOLO */}
                <div onClick={function(){setGgModeChoice(false);ggStartGame();}} style={{position:"relative",overflow:"hidden",borderRadius:20,border:"1px solid rgba(0,230,118,.38)",background:"linear-gradient(135deg, rgba(0,230,118,.12) 0%, rgba(255,255,255,.03) 45%, rgba(0,0,0,.25) 100%)",padding:"16px 14px 16px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:14,boxShadow:"0 14px 36px -12px rgba(0,230,118,.3)"}}>
                  <div style={{width:54,height:54,borderRadius:16,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:27,background:"rgba(0,230,118,.14)",border:"1px solid rgba(0,230,118,.4)",boxShadow:"inset 0 2px 10px rgba(0,0,0,.35)"}}>🐐</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:10,fontWeight:800,letterSpacing:2.5,color:"#00E676",textTransform:"uppercase"}}>{tr("Défi du jour","Daily challenge","Tägliche Challenge","Sfida del giorno","Desafio do dia")}</div>
                    <div style={{fontFamily:G.heading,fontSize:26,color:"#fff",letterSpacing:2,lineHeight:1.1,margin:"3px 0 9px"}}>SOLO</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      <span style={{fontSize:10.5,fontWeight:700,color:"rgba(255,255,255,.85)",background:"rgba(0,0,0,.35)",border:"1px solid rgba(255,255,255,.12)",padding:"4px 9px",borderRadius:999,letterSpacing:.3}}>{tr("Grille 3×3","3×3 grid","3×3-Raster","Griglia 3×3","Grade 3×3")}</span>
                      <span style={{fontSize:10.5,fontWeight:700,color:"rgba(255,255,255,.85)",background:"rgba(0,0,0,.35)",border:"1px solid rgba(255,255,255,.12)",padding:"4px 9px",borderRadius:999,letterSpacing:.3}}>❤️ {tr("3 vies","3 lives","3 Leben","3 vite","3 vidas")}</span>
                      <span style={{fontSize:10.5,fontWeight:700,color:"rgba(255,255,255,.85)",background:"rgba(0,0,0,.35)",border:"1px solid rgba(255,255,255,.12)",padding:"4px 9px",borderRadius:999,letterSpacing:.3}}>🏆 {tr("Classé","Ranked","Gewertet","Classificato","Ranqueado")}</span>
                    </div>
                  </div>
                  <div style={{fontSize:28,color:"rgba(0,230,118,.85)",flexShrink:0,fontWeight:300,lineHeight:1}}>›</div>
                </div>

                {/* Carte BATTLE */}
                <div onClick={function(){setGgModeChoice(false);setGgBattleScreen("menu");setGgBattleError("");setGgBattleCode("");}} style={{position:"relative",overflow:"hidden",borderRadius:20,border:"1px solid rgba(255,107,53,.4)",background:"linear-gradient(135deg, rgba(255,107,53,.13) 0%, rgba(255,255,255,.03) 45%, rgba(0,0,0,.25) 100%)",padding:"16px 14px 16px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:14,boxShadow:"0 14px 36px -12px rgba(255,107,53,.32)"}}>
                  <div style={{width:54,height:54,borderRadius:16,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:27,background:"rgba(255,107,53,.15)",border:"1px solid rgba(255,107,53,.45)",boxShadow:"inset 0 2px 10px rgba(0,0,0,.35)"}}>⚔️</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:10,fontWeight:800,letterSpacing:2.5,color:"#FF8A2A",textTransform:"uppercase"}}>{tr("Mode versus","Versus mode","Versus-Modus","Modalità versus","Modo versus")}</div>
                    <div style={{fontFamily:G.heading,fontSize:26,color:"#fff",letterSpacing:2,lineHeight:1.1,margin:"3px 0 9px"}}>BATTLE</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      <span style={{fontSize:10.5,fontWeight:700,color:"rgba(255,255,255,.85)",background:"rgba(0,0,0,.35)",border:"1px solid rgba(255,255,255,.12)",padding:"4px 9px",borderRadius:999,letterSpacing:.3}}>⏱️ 2 min</span>
                      <span style={{fontSize:10.5,fontWeight:700,color:"rgba(255,255,255,.85)",background:"rgba(0,0,0,.35)",border:"1px solid rgba(255,255,255,.12)",padding:"4px 9px",borderRadius:999,letterSpacing:.3}}>👥 {tr("2-8 joueurs","2-8 players","2-8 Spieler","2-8 giocatori","2-8 jogadores")}</span>
                      <span style={{fontSize:10.5,fontWeight:700,color:"rgba(255,255,255,.85)",background:"rgba(0,0,0,.35)",border:"1px solid rgba(255,255,255,.12)",padding:"4px 9px",borderRadius:999,letterSpacing:.3}}>♾️ {tr("Vies","Lives","Leben","Vite","Vidas")}</span>
                    </div>
                  </div>
                  <div style={{fontSize:28,color:"rgba(255,138,42,.85)",flexShrink:0,fontWeight:300,lineHeight:1}}>›</div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ⚔️ Modal GOAT BATTLE — Multijoueur Menu */}
        {ggBattleScreen === "menu" && (
          <div style={{position:"fixed",inset:0,zIndex:450,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"80px 20px 40px",background:"rgba(0,0,0,.92)",backdropFilter:"blur(10px)",overflowY:"auto"}}>
            <div style={{background:"linear-gradient(160deg, #14181F 0%, #0B0E12 100%)",border:"1px solid rgba(255,107,53,.35)",borderRadius:24,boxShadow:"0 24px 60px -20px rgba(255,107,53,.25)",padding:24,maxWidth:380,width:"100%"}}>
              <div style={{textAlign:"center",marginBottom:20}}>
                <div style={{fontSize:50,marginBottom:6}}>⚔️</div>
                <div style={{fontFamily:G.heading,fontSize:28,letterSpacing:2,color:"#FF6B35",lineHeight:1}}>GOAT BATTLE</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.6)",marginTop:6}}>{tr("2 minutes · 2-8 joueurs · Même grille","2 minutes · 2-8 players · Same grid","2 Minuten · 2-8 Spieler · Gleiches Raster","2 minuti · 2-8 giocatori · Stessa griglia","2 minutos · 2-8 jogadores · Mesma grade")}</div>
              </div>
              
              {ggBattleError && (
                <div style={{padding:10,background:"rgba(255,68,68,.15)",border:"1px solid rgba(255,68,68,.4)",borderRadius:10,color:"#FF6B6B",fontSize:12,marginBottom:14,textAlign:"center"}}>{ggBattleError}</div>
              )}
              
              {/* Partie rapide — adversaire trouvé automatiquement */}
              <button onClick={function(){
                setGgBattleScreen(null); setGgBattleError(""); setGgBattleCode("");
                setMmSearch({ mode:"battle", opponent: pickOpponent(), phase:"searching" });
              }} style={{width:"100%",padding:"14px",borderRadius:14,border:"1.5px solid rgba(61,165,255,.55)",background:"linear-gradient(135deg,rgba(61,165,255,.25),rgba(61,165,255,.08))",color:"#fff",fontWeight:900,fontSize:14,letterSpacing:1,cursor:"pointer",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                🌍 {tr("EN LIGNE","ONLINE","ONLINE","ONLINE","ONLINE")}
              </button>
              <div style={{fontSize:10,color:"rgba(255,255,255,.4)",textAlign:"center",marginBottom:14}}>
                {tr("Affronte un adversaire · sans code","Face an opponent · no code","Tritt gegen einen Gegner an · ohne Code","Sfida un avversario · senza codice","Enfrente um adversário · sem código")}
              </div>

              {/* Créer une room */}
              <button onClick={ggBattleCreateRoom} disabled={ggBattleLoading} style={{width:"100%",padding:"14px",borderRadius:14,border:"none",background:"linear-gradient(135deg,#FF6B35,#FF4444)",color:"#fff",fontWeight:800,fontSize:14,letterSpacing:1,cursor:ggBattleLoading?"not-allowed":"pointer",marginBottom:12,opacity:ggBattleLoading?.5:1}}>
                {ggBattleLoading ? "..." : (tr("⚔️ CRÉER UNE ROOM","⚔️ CREATE ROOM","⚔️ RAUM ERSTELLEN","⚔️ CREA UNA ROOM","⚔️ CRIAR UMA SALA"))}
              </button>
              
              {/* Rejoindre via code */}
              <div style={{display:"flex",gap:8,marginBottom:14}}>
                <input
                  type="text"
                  value={ggBattleCode}
                  onChange={function(e){setGgBattleCode(e.target.value.toUpperCase().slice(0,6));}}
                  placeholder={tr("CODE","CODE","CODE","CODICE","CÓDIGO")}
                  maxLength={6}
                  style={{flex:1,minWidth:0,padding:"12px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.15)",borderRadius:12,color:G.white,fontSize:16,fontWeight:800,letterSpacing:3,textAlign:"center",fontFamily:"monospace"}}
                />
                <button onClick={function(){ggBattleJoinRoom(ggBattleCode);}} disabled={ggBattleLoading || ggBattleCode.length < 4} style={{flexShrink:0,padding:"12px 16px",borderRadius:12,border:"1px solid rgba(255,107,53,.4)",background:"rgba(255,107,53,.15)",color:"#FF6B35",fontWeight:800,fontSize:13,cursor:(ggBattleLoading||ggBattleCode.length<4)?"not-allowed":"pointer",opacity:(ggBattleLoading||ggBattleCode.length<4)?.5:1}}>
                  {tr("REJOINDRE","JOIN","BEITRETEN","UNISCITI","ENTRAR")}
                </button>
              </div>
              
              <button onClick={function(){setGgBattleScreen(null);setGgBattleError("");setGgBattleCode("");}} style={{width:"100%",padding:12,borderRadius:50,border:"none",background:"rgba(255,255,255,.05)",color:"rgba(255,255,255,.7)",fontWeight:700,fontSize:13,letterSpacing:1,cursor:"pointer"}}>
                {tr("Fermer","Close","Schließen","Chiudi","Fechar")}
              </button>
            </div>
          </div>
        )}

        {/* ⚔️ Modal GOAT BATTLE — Lobby */}
        {ggBattleScreen === "lobby" && ggBattleRoom && (
          <div style={{position:"fixed",inset:0,zIndex:450,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"80px 20px 40px",background:"rgba(0,0,0,.92)",backdropFilter:"blur(10px)",overflowY:"auto"}}>
            <div style={{background:"linear-gradient(160deg, #14181F 0%, #0B0E12 100%)",border:"1px solid rgba(255,107,53,.35)",borderRadius:24,boxShadow:"0 24px 60px -20px rgba(255,107,53,.25)",padding:24,maxWidth:380,width:"100%"}}>
              <div style={{textAlign:"center",marginBottom:20}}>
                <div style={{fontSize:11,letterSpacing:2,color:"rgba(255,107,53,.7)",fontWeight:700,marginBottom:6}}>⚔️ GOAT BATTLE · LOBBY</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginBottom:8}}>{tr("Partage ce code","Share this code","Teile diesen Code","Condividi questo codice","Compartilhe este código")}</div>
                <div style={{display:"inline-block",padding:"10px 20px",background:"rgba(255,107,53,.15)",border:"2px solid rgba(255,107,53,.5)",borderRadius:14,fontFamily:"monospace",fontSize:28,fontWeight:900,letterSpacing:6,color:"#FF6B35"}}>
                  {ggBattleRoom.code}
                </div>
              </div>
              
              {/* Liste des joueurs */}
              <div style={{marginBottom:18}}>
                <div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginBottom:8,letterSpacing:1}}>
                  {(ggBattleRoom.players || []).length} / 8 {tr("JOUEURS","PLAYERS","SPIELER","GIOCATORI","JOGADORES")}
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {(ggBattleRoom.players || []).map(function(p, idx){
                    const isHost = p.id === ggBattleRoom.host_id;
                    const isMe = p.id === playerId;
                    return (
                      <div key={p.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:isMe?"rgba(255,107,53,.1)":"rgba(255,255,255,.04)",border:"1px solid "+(isMe?"rgba(255,107,53,.3)":"rgba(255,255,255,.08)"),borderRadius:10}}>
                        <div style={{fontSize:18}}>{isHost?"👑":"⚔️"}</div>
                        <div style={{flex:1,fontSize:13,fontWeight:700,color:G.white}}>
                          {p.name} {isMe && <span style={{fontSize:10,color:"rgba(255,107,53,.7)"}}>({tr("toi","you","du","tu","você")})</span>}
                        </div>
                        {isHost && <div style={{fontSize:9,color:"#FFD600",letterSpacing:1,fontWeight:800}}>HOST</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {ggBattleError && (
                <div style={{padding:10,background:"rgba(255,68,68,.15)",border:"1px solid rgba(255,68,68,.4)",borderRadius:10,color:"#FF6B6B",fontSize:12,marginBottom:12,textAlign:"center"}}>{ggBattleError}</div>
              )}
              
              {/* Boutons */}
              {ggBattleRoom.host_id === playerId ? (
                <button onClick={ggBattleStartGame} disabled={ggBattleLoading || (ggBattleRoom.players || []).length < 2} style={{width:"100%",padding:14,borderRadius:14,border:"none",background:((ggBattleRoom.players || []).length < 2 || ggBattleLoading)?"rgba(255,255,255,.1)":"linear-gradient(135deg,#FF6B35,#FF4444)",color:((ggBattleRoom.players || []).length < 2 || ggBattleLoading)?"rgba(255,255,255,.3)":"#fff",fontWeight:900,fontSize:14,letterSpacing:1,cursor:((ggBattleRoom.players || []).length < 2 || ggBattleLoading)?"not-allowed":"pointer",marginBottom:10}}>
                  {(ggBattleRoom.players || []).length < 2 ? (tr("EN ATTENTE DE JOUEURS...","WAITING FOR PLAYERS...","WARTE AUF SPIELER...","IN ATTESA DI GIOCATORI...","AGUARDANDO JOGADORES...")) : (tr("⚔️ LANCER LA BATTLE","⚔️ START BATTLE","⚔️ BATTLE STARTEN","⚔️ AVVIA LA BATTLE","⚔️ INICIAR BATALHA"))}
                </button>
              ) : (
                <div style={{padding:14,textAlign:"center",fontSize:13,color:"rgba(255,255,255,.6)",fontStyle:"italic",marginBottom:10}}>
                  {tr("En attente du host...","Waiting for the host to start...","Warte auf den Host...","In attesa dell'host...","Aguardando o anfitrião...")}
                </div>
              )}
              
              <button onClick={ggBattleLeaveRoom} style={{width:"100%",padding:12,borderRadius:50,border:"none",background:"rgba(255,255,255,.05)",color:"rgba(255,255,255,.7)",fontWeight:700,fontSize:13,letterSpacing:1,cursor:"pointer"}}>
                {tr("Quitter la room","Leave room","Raum verlassen","Esci dalla room","Sair da sala")}
              </button>
            </div>
          </div>
        )}

        {/* ⚔️ Modal GOAT BATTLE — Finished (résultats) */}
        {ggBattleScreen === "finished" && ggBattleRoom && (() => {
          const sortedPlayers = [...(ggBattleRoom.players || [])].sort(function(a, b){
            // Priorité : (1) cells_filled DESC, (2) finished_at ASC (plus rapide), (3) score DESC
            if ((b.cells_filled || 0) !== (a.cells_filled || 0)) return (b.cells_filled || 0) - (a.cells_filled || 0);
            if (a.finished_at && b.finished_at) {
              const diff = new Date(a.finished_at).getTime() - new Date(b.finished_at).getTime();
              if (diff !== 0) return diff;
            }
            return (b.score || 0) - (a.score || 0);
          });
          const winner = sortedPlayers[0];
          const isWinner = winner && winner.id === playerId;
          
          return (
            <div style={{position:"fixed",inset:0,zIndex:450,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"80px 20px 40px",background:"rgba(0,0,0,.92)",backdropFilter:"blur(10px)",overflowY:"auto"}}>
              <div style={{background:"linear-gradient(160deg, #14181F 0%, #0B0E12 100%)",border:"1.5px solid "+(isWinner?"rgba(255,214,0,.6)":"rgba(255,107,53,.4)"),borderRadius:24,padding:24,maxWidth:380,width:"100%",textAlign:"center"}}>
                <div style={{fontSize:60,marginBottom:8}}>{isWinner?"👑":"⚔️"}</div>
                <div style={{fontFamily:G.heading,fontSize:26,letterSpacing:2,color:isWinner?"#FFD600":"#FF6B35",lineHeight:1,marginBottom:6}}>
                  {isWinner ? (tr("VICTOIRE !","VICTORY!","SIEG!","VITTORIA!","VITÓRIA!")) : (tr("BATTLE TERMINÉE","BATTLE OVER","BATTLE VORBEI","BATTLE FINITA","BATALHA ENCERRADA"))}
                </div>
                <div style={{fontSize:13,color:"rgba(255,255,255,.7)",marginBottom:18}}>
                  {winner ? ((tr("Gagnant : ","Winner: ","Gewinner: ","Vincitore: ","Vencedor: ")) + winner.name) : ""}
                </div>
                
                {/* Classement */}
                <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:18,textAlign:"left"}}>
                  {sortedPlayers.map(function(p, idx){
                    const isMe = p.id === playerId;
                    const medal = idx===0?"🥇":idx===1?"🥈":idx===2?"🥉":"  ";
                    const hasGrid = p.filled_grid && Object.keys(p.filled_grid).length > 0;
                    return (
                      <div key={p.id} onClick={hasGrid ? function(){setGgBattleViewGrid({player:p, room:ggBattleRoom});} : null} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:isMe?"rgba(255,107,53,.12)":"rgba(255,255,255,.04)",border:"1px solid "+(isMe?"rgba(255,107,53,.3)":"rgba(255,255,255,.08)"),borderRadius:10,cursor:hasGrid?"pointer":"default"}}>
                        <div style={{fontSize:18,minWidth:24}}>{medal}</div>
                        <div style={{flex:1,fontSize:13,fontWeight:700,color:G.white}}>
                          {p.name} {isMe && <span style={{fontSize:10,color:"rgba(255,107,53,.7)"}}>({tr("toi","you","du","tu","você")})</span>}
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontSize:14,fontWeight:900,color:idx===0?"#FFD600":G.white}}>{p.cells_filled || 0}/9</div>
                          <div style={{fontSize:10,color:"rgba(255,255,255,.5)"}}>{p.score || 0} pts</div>
                        </div>
                        {hasGrid && <div style={{fontSize:14,color:"rgba(255,107,53,.7)",marginLeft:4}}>👁️</div>}
                      </div>
                    );
                  })}
                </div>
                {sortedPlayers.some(function(p){return p.filled_grid && Object.keys(p.filled_grid).length > 0;}) && (
                  <div style={{fontSize:10,color:"rgba(255,255,255,.4)",marginBottom:14,textAlign:"center",fontStyle:"italic"}}>
                    👁️ {tr("Tape sur un joueur pour voir sa grille","Tap a player to see their grid","Tippe auf einen Spieler, um sein Raster zu sehen","Tocca un giocatore per vedere la sua griglia","Toque num jogador para ver sua grade")}
                  </div>
                )}
                
                {/* Bouton Relancer (host uniquement) */}
                {ggBattleRoom.host_id === playerId && (
                  <button onClick={ggBattleRestartGame} disabled={ggBattleLoading} style={{width:"100%",padding:14,borderRadius:50,border:"none",background:"linear-gradient(135deg,#00E676,#00B85F)",color:"#000",fontWeight:900,fontSize:14,letterSpacing:1,cursor:ggBattleLoading?"not-allowed":"pointer",marginBottom:8,opacity:ggBattleLoading?.5:1}}>
                    {ggBattleLoading ? "..." : "🔄 " + (tr("RELANCER","REMATCH","REVANCHE","RIVINCITA","REVANCHE"))}
                  </button>
                )}
                {ggBattleRoom.host_id !== playerId && (
                  <div style={{textAlign:"center",fontSize:11,color:"rgba(255,255,255,.5)",marginBottom:8,fontStyle:"italic"}}>
                    {tr("En attente d'une revanche...","Waiting for the host to rematch...","Warten auf Revanche vom Host...","In attesa della rivincita dell'host...","Aguardando a revanche do anfitrião...")}
                  </div>
                )}
                
                <button onClick={function(){
                  setGgBattleScreen(null);
                  setGgBattleRoom(null);
                  setGgBattleCode("");
                  setGgBattleError("");
                  setGgGameOver(false);
                }} style={{width:"100%",padding:14,borderRadius:50,border:"none",background:"linear-gradient(135deg,#FF6B35,#FF4444)",color:"#fff",fontWeight:800,fontSize:13,letterSpacing:1,cursor:"pointer"}}>
                  {tr("RETOUR","BACK TO HOME","ZUM START","ALLA HOME","VOLTAR")}
                </button>
              </div>
            </div>
          );
        })()}
        
        {/* ⚔️ Modal GOAT BATTLE — Visualiser la grille d'un joueur */}
        {ggBattleViewGrid && ggBattleViewGrid.player && ggBattleViewGrid.room && (() => {
          const p = ggBattleViewGrid.player;
          const room = ggBattleViewGrid.room;
          const isMe = p.id === playerId;
          // Régénérer la grille à partir du seed pour avoir les critères
          const grid = ggGenerateGrid(room.seed);
          if (!grid) return null;
          const filled = p.filled_grid || {};
          
          return (
            <div onClick={function(){setGgBattleViewGrid(null);}} style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,.92)",backdropFilter:"blur(10px)",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"30px 8px 20px",overflowY:"auto"}}>
              <div onClick={function(e){e.stopPropagation();}} style={{background:"linear-gradient(160deg, #14181F 0%, #0B0E12 100%)",border:"1.5px solid rgba(255,107,53,.4)",borderRadius:20,padding:14,maxWidth:480,width:"100%"}}>
                {/* Header */}
                <div style={{textAlign:"center",marginBottom:14}}>
                  <div style={{fontSize:11,color:"rgba(255,107,53,.8)",letterSpacing:2,fontWeight:700,marginBottom:4}}>👁️ {tr("GRILLE DE","GRID OF","RASTER VON","GRIGLIA DI","GRADE DE")}</div>
                  <div style={{fontSize:22,fontWeight:900,color:G.white,marginBottom:6}}>
                    {p.name} {isMe && <span style={{fontSize:12,color:"rgba(255,107,53,.7)"}}>({tr("toi","you","du","tu","você")})</span>}
                  </div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,.7)"}}>
                    {p.cells_filled || 0}/9 · {p.score || 0} pts
                  </div>
                </div>
                
                {/* Grille 3x3 — version GRANDE */}
                <div style={{display:"grid",gridTemplateColumns:"72px 1fr 1fr 1fr",gridTemplateRows:"64px 105px 105px 105px",gap:5,marginBottom:14}}>
                  {/* Coin vide */}
                  <div></div>
                  {/* Critères de colonnes */}
                  {grid.colCriteria.map(function(col, idx){
                    const icon = col.type==="trophy"?(col.value==="world_cup"?"🏆":"⭐"):col.type==="nationality"?"🌍":col.type==="league"?"🏟️":col.type==="position"?"⚽":"🏆";
                    return (
                      <div key={"col-"+idx} style={{background:"rgba(0,0,0,.3)",borderRadius:8,padding:"6px 4px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:G.white,textAlign:"center",lineHeight:1.15}}>
                        <div style={{fontSize:20,marginBottom:2}}>{icon}</div>
                        <div style={{textTransform:"uppercase",fontSize:10}}>{col.label}</div>
                      </div>
                    );
                  })}
                  
                  {/* Lignes */}
                  {grid.rowCriteria.map(function(row, rIdx){
                    const rIcon = row.type==="club"?"🛡️":row.type==="nationality"?"🌍":row.type==="position"?"⚽":"🏆";
                    return [
                      // Critère de la ligne
                      <div key={"row-"+rIdx} style={{background:"rgba(0,0,0,.3)",borderRadius:8,padding:"6px 4px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:G.white,textAlign:"center",lineHeight:1.15}}>
                        <div style={{fontSize:18,marginBottom:2}}>{rIcon}</div>
                        <div style={{textTransform:"uppercase",fontSize:9.5}}>{row.label}</div>
                      </div>,
                      // 3 cases pour cette ligne
                      ...grid.colCriteria.map(function(col, cIdx){
                        const key = rIdx + "-" + cIdx;
                        const playerName = filled[key];
                        const isFilled = !!playerName;
                        return (
                          <div key={key} style={{background:isFilled?"linear-gradient(135deg,rgba(0,230,118,.25),rgba(0,184,95,.2))":"rgba(255,255,255,.04)",border:"1px solid "+(isFilled?"rgba(0,230,118,.5)":"rgba(255,255,255,.08)"),borderRadius:8,padding:"6px 5px",display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center",fontSize:12,fontWeight:700,color:isFilled?"#fff":"rgba(255,255,255,.3)",lineHeight:1.2,wordBreak:"break-word"}}>
                            {isFilled ? playerName : "—"}
                          </div>
                        );
                      })
                    ];
                  })}
                </div>
                
                <button onClick={function(){setGgBattleViewGrid(null);}} style={{width:"100%",padding:12,borderRadius:50,border:"none",background:"rgba(255,255,255,.08)",color:G.white,fontWeight:700,fontSize:13,letterSpacing:1,cursor:"pointer"}}>
                  {tr("Fermer","Close","Schließen","Chiudi","Fechar")}
                </button>
              </div>
            </div>
          );
        })()}

        {/* 📋 Modal de revue des manches (Plug / Mercato Multi+Duel) */}
        {reviewRoundsModal && (
          <div onClick={function(){setReviewRoundsModal(null);}} style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,.92)",backdropFilter:"blur(10px)",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"60px 14px 30px",overflowY:"auto"}}>
            <div onClick={function(e){e.stopPropagation();}} style={{background:"linear-gradient(135deg, #0a1410, #102018)",border:"1.5px solid rgba(251,226,22,.4)",borderRadius:24,padding:18,maxWidth:480,width:"100%"}}>
              {/* Header */}
              <div style={{textAlign:"center",marginBottom:14}}>
                <div style={{fontSize:11,color:"rgba(251,226,22,.8)",letterSpacing:2,fontWeight:700,marginBottom:4}}>📋 {tr("RÉPONSES DE","ANSWERS OF","ANTWORTEN VON","RISPOSTE DI","RESPOSTAS DE")}</div>
                <div style={{fontSize:20,fontWeight:900,color:G.white,marginBottom:4}}>{reviewRoundsModal.playerName}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.5)"}}>
                  {reviewRoundsModal.rounds.length} {tr("manches","rounds","Runden","round","rodadas")} · {reviewRoundsModal.mode === "chaine" ? "The Mercato" : "The Plug"}
                </div>
              </div>
              
              {/* Liste des manches */}
              <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>
                {reviewRoundsModal.rounds.map(function(r, idx){
                  // Plug : status "ok"/"ko"/"skip" ; Mercato : pas de status, "passed:true" = wrong
                  const isPlug = (reviewRoundsModal.mode !== "chaine");
                  const isOk = isPlug ? (r.status === "ok") : (r.club !== "—" && !r.passed);
                  const isSkip = isPlug ? (r.status === "skip") : false;
                  const isKo = isPlug ? (r.status === "ko") : (r.passed === true);
                  const validList = Array.isArray(r.validPlayers) ? r.validPlayers.slice(0,3).join(", ") : "";
                  return (
                    <div key={idx} style={{padding:"10px 12px",background:isOk?"rgba(0,230,118,.08)":(isSkip?"rgba(255,214,0,.06)":"rgba(255,68,68,.08)"),border:"1px solid "+(isOk?"rgba(0,230,118,.3)":(isSkip?"rgba(255,214,0,.3)":"rgba(255,68,68,.3)")),borderRadius:10}}>
                      {/* Header de la manche */}
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                        <div style={{fontSize:10,fontWeight:800,letterSpacing:1.5,color:"rgba(255,255,255,.5)"}}>{tr("MANCHE","ROUND","RUNDE","ROUND","RODADA")} #{idx+1}</div>
                        <div style={{fontSize:14}}>{isOk?"✅":isSkip?"⏭️":"❌"}</div>
                      </div>
                      {/* Plug : c1 → c2 */}
                      {isPlug && r.c1 && r.c2 ? (
                        <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.85)",marginBottom:4}}>
                          {r.c1} → {r.c2}
                        </div>
                      ) : null}
                      {/* Mercato : afficher player + club */}
                      {!isPlug && r.player ? (
                        <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.85)",marginBottom:4}}>
                          🐐 {r.player} {r.club && r.club !== "—" ? "→ " + r.club : ""}
                        </div>
                      ) : null}
                      {/* Plug : Réponse donnée */}
                      {isPlug && (
                        <div style={{fontSize:13,fontWeight:600,color:isOk?"#00E676":(isSkip?"#FFD600":"#FF6B6B")}}>
                          {isSkip ? (tr("Passé","Skipped","Übersprungen","Saltato","Pulado")) : (r.given || "—")}
                        </div>
                      )}
                      {/* Réponses correctes possibles si pas OK (Plug uniquement) */}
                      {isPlug && !isOk && validList && (
                        <div style={{fontSize:10,color:"rgba(255,255,255,.5)",marginTop:4,fontStyle:"italic"}}>
                          {tr("Valides : ","Valid: ","Gültig: ","Valide: ","Válidas: ")}{validList}{r.validPlayers.length > 3 ? "..." : ""}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              <button onClick={function(){setReviewRoundsModal(null);}} style={{width:"100%",padding:12,borderRadius:50,border:"none",background:"rgba(255,255,255,.08)",color:G.white,fontWeight:700,fontSize:13,letterSpacing:1,cursor:"pointer"}}>
                {tr("Fermer","Close","Schließen","Chiudi","Fechar")}
              </button>
            </div>
          </div>
        )}

        {/* 🐐 Modal GOAT GRID — Mode quotidien grille 3x3 (ou battle playing) */}
        {(showGoatGrid || ggBattleScreen === "playing") && (
          <div style={{position:"fixed",inset:0,zIndex:400,display:"flex",flexDirection:"column",background:"linear-gradient(180deg, #0a1410 0%, #0E1F14 100%)"}}>
            {/* Fond pelouse */}
            <div style={{position:"absolute",inset:0,zIndex:0,overflow:"hidden",opacity:.4}}>
              {[0,1,2,3,4,5,6].map(function(i){return(<div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#0E1F14":"#132819"}}/>);})}
            </div>
            
            {/* Compte à rebours pré-jeu (mode battle uniquement) */}
            {ggBattleScreen === "playing" && ggBattleCountdown > 0 && (
              <div style={{position:"absolute",inset:0,zIndex:50,background:"rgba(0,0,0,.85)",backdropFilter:"blur(8px)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:20}}>
                <div style={{fontFamily:G.heading,fontSize:32,letterSpacing:3,color:"#FF6B35",textAlign:"center"}}>⚔️ GOAT BATTLE</div>
                <div style={{fontSize:14,color:"rgba(255,255,255,.7)",textAlign:"center",letterSpacing:1}}>{tr("PRÊT ?","GET READY...","BEREIT...","PRONTI...","PREPARE-SE...")}</div>
                <div key={ggBattleCountdown} style={{fontSize:140,fontWeight:900,color:"#FFD600",lineHeight:1,textShadow:"0 4px 30px rgba(255,214,0,.4)",animation:"countdownPulse .9s ease-out"}}>
                  {ggBattleCountdown}
                </div>
              </div>
            )}
            
            <div style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",height:"100%",padding:"12px 14px",overflowY: ggBattleScreen==="playing" ? "hidden" : "auto",WebkitOverflowScrolling:"touch"}}>
              
              {/* Header avec bouton fermer */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexShrink:0}}>
                <div style={{flex:1}}/>
                <div style={{textAlign:"center"}}>
                  {ggBattleScreen === "playing" ? (
                    <>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:0}}>
                        <div style={{fontFamily:G.heading,fontSize:22,letterSpacing:1.5,color:"#FF6B35",lineHeight:1}}>GOAT BATTLE ⚔️</div>
                        <div style={{fontSize:18,color:ggBattleTimer<=30?"#FF4444":"#FFD600",letterSpacing:1,fontWeight:900,fontFamily:"monospace",padding:"3px 10px",background:"rgba(0,0,0,.3)",borderRadius:8,border:"1px solid "+(ggBattleTimer<=30?"rgba(255,68,68,.5)":"rgba(255,214,0,.4)")}}>
                          {Math.floor(ggBattleTimer/60)}:{String(ggBattleTimer%60).padStart(2,"0")}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div onClick={ggTitleTap} style={{fontFamily:G.heading,fontSize:26,letterSpacing:2,color:"#FFD600",lineHeight:1,userSelect:"none",WebkitUserSelect:"none",WebkitTouchCallout:"none",cursor:"pointer"}}>GOAT GRID 🐐</div>
                      {ggOverrideSeed > 0 && (
                        <div style={{fontSize:9,color:ggDemo?"#00E676":"#FFD600",marginTop:2,letterSpacing:1.5,fontWeight:800}}>{ggDemo?"🎬 MODE DÉMO":"🔄 GRILLE TEST"}</div>
                      )}
                    </>
                  )}
                </div>
                <div style={{flex:1,display:"flex",justifyContent:"flex-end",gap:6}}>
                  {ggBattleScreen !== "playing" && !launchedFromLandingRef.current && (
                    <>
                      <button onClick={function(){
                        // Génère un seed aléatoire pour avoir une autre grille (mode test)
                        const newSeed = Math.floor(Math.random() * 1000000) + 1;
                        setGgOverrideSeed(newSeed);
                        setGgFilledCells({});
                        setGgUsedPlayers(new Set());
                        setGgLives(3);
                        setGgScore(0);
                        setGgGameOver(false);
                        setGgGuess("");
                        setGgFlash(null);
                        setGgSelectedCell(null);
                        setGgRevealMode(false);
                        setGgRevealCell(null);
                        const newGrid = ggGenerateGrid(newSeed);
                        if (newGrid) {
                          setGgGrid(newGrid);
                          setGgError(false);
                        } else {
                          setGgError(true);
                        }
                      }} title={tr("Essayer une autre grille","Try another grid","Anderes Raster versuchen","Prova un'altra griglia","Tentar outra grade")} style={{background:"rgba(255,214,0,.15)",border:"1px solid rgba(255,214,0,.4)",borderRadius:"50%",width:36,height:36,color:"#FFD600",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>🔄</button>
                      <button onClick={function(){setShowGoatGrid(false);}} style={{background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.15)",borderRadius:"50%",width:36,height:36,color:G.white,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                    </>
                  )}
                </div>
              </div>

              {ggError && (
                <div style={{margin:"40px 20px",padding:24,background:"rgba(255,255,255,.05)",borderRadius:14,textAlign:"center"}}>
                  <div style={{fontSize:48,marginBottom:12}}>⚠️</div>
                  <div style={{fontSize:14,color:"rgba(255,255,255,.85)",lineHeight:1.5}}>{tr("Impossible de générer la grille du jour. Les données ne sont pas encore enrichies (nationalités/postes manquants).","Could not generate today's grid. Data not yet enriched (nationalities/positions missing).","Das heutige Raster konnte nicht erstellt werden. Daten noch nicht angereichert (Nationalitäten/Positionen fehlen).","Impossibile generare la griglia di oggi. Dati non ancora completi (nazionalità/ruoli mancanti).","Não foi possível gerar a grade de hoje. Dados ainda não completos (nacionalidades/posições faltando).")}</div>
                </div>
              )}

              {!ggError && ggGrid && (
                <>
                  {/* Info bar : vies + score + remplissage */}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"6px 0",padding:"9px 14px",background:"rgba(255,255,255,.04)",backdropFilter:"blur(10px)",borderRadius:16,border:"1px solid rgba(255,255,255,.08)",flexShrink:0,fontSize:13,fontWeight:700}}>
                    {ggBattleScreen !== "playing" ? (
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{fontSize:10,color:"rgba(255,255,255,.5)",fontWeight:600,letterSpacing:1}}>{tr("VIES","LIVES","LEBEN","VITE","VIDAS")}</span>
                        <div style={{display:"flex",gap:3}}>
                          {[0,1,2].map(function(i){return(<span key={i} style={{fontSize:14,opacity:i<ggLives?1:.25,filter:i<ggLives?"none":"grayscale(1)"}}>{i<ggLives?"❤️":"💔"}</span>);})}
                        </div>
                      </div>
                    ) : (
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{fontSize:10,color:"rgba(255,107,53,.7)",fontWeight:700,letterSpacing:1}}>♾️ {tr("ILLIMITÉ","NO LIMIT","UNBEGRENZT","ILLIMITATO","SEM LIMITE")}</span>
                      </div>
                    )}
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:10,color:"rgba(255,255,255,.5)",fontWeight:600,letterSpacing:1}}>{tr("SCORE","SCORE","SCORE","PUNTEGGIO","PONTUAÇÃO")}</span>
                      <span style={{color:"#FFD600",fontFamily:G.heading,fontSize:16}}>{ggScore}</span>
                      <span style={{fontSize:11,color:"rgba(255,255,255,.5)",fontFamily:G.heading}}>/ {ggGrid.cells.reduce(function(s,c){return s+c.maxPoints;},0) + 100}</span>
                      <span style={{fontSize:10,color:"rgba(255,255,255,.4)"}}>pts</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:10,color:"rgba(255,255,255,.5)",fontWeight:600,letterSpacing:1}}>{tr("REMPLI","FILLED","GEFÜLLT","RIEMPITA","PREENCHIDA")}</span>
                      <span style={{color:"#FFD600",fontFamily:G.heading,fontSize:16}}>{Object.keys(ggFilledCells).length}/9</span>
                    </div>
                  </div>

                  {/* Mini explainer scoring (masqué en mode battle pour gagner de la place) */}
                  {ggBattleScreen !== "playing" && (
                    <div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:20,padding:"5px 12px",marginBottom:8,fontSize:9.5,color:"rgba(255,255,255,.7)",textAlign:"center",lineHeight:1.3,flexShrink:0}}>
                      <span style={{color:"#FFD600",fontWeight:800}}>💡 {tr("⭐ 15 · ⭐⭐ / ⭐⭐⭐ 50 pts · 🐐 Sans-faute = +100","⭐ 15 · ⭐⭐ / ⭐⭐⭐ 50 pts · 🐐 No-mistake = +100","⭐ 15 · ⭐⭐ / ⭐⭐⭐ 50 Pkt · 🐐 Fehlerfrei = +100","⭐ 15 · ⭐⭐ / ⭐⭐⭐ 50 pt · 🐐 Senza errori = +100","⭐ 15 · ⭐⭐ / ⭐⭐⭐ 50 pts · 🐐 Sem erros = +100")}</span>
                    </div>
                  )}

                  {/* Grille 3x3 */}
                  <div style={{background:"rgba(0,0,0,.4)",backdropFilter:"blur(12px)",borderRadius:16,padding:6,border:"1px solid rgba(255,255,255,.08)",marginBottom:(ggRevealMode||ggReviewMode)?130:8,display:"flex",flex:1,minHeight:0}}>
                    <div style={{display:"grid",gridTemplateColumns:"80px minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)",gridTemplateRows:"60px minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)",gap:4,flex:1,width:"100%"}}>
                      
                      {/* Coin haut-gauche vide */}
                      <div/>
                      
                      {/* Critères colonnes */}
                      {ggGrid.colCriteria.map(function(crit, j){
                        const [cMain] = ggGetCriterionColors(crit);
                        const emoji = ggGetCriterionEmoji(crit);
                        return(
                          <div key={"col-"+j} onClick={function(){setGgShowTooltip({title: ggGetCriterionDisplayLabel(crit, lang), text: ggGetCriterionTooltip(crit, lang)});}} style={{position:"relative",overflow:"hidden",borderRadius:14,border:"1px solid rgba(255,255,255,.14)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:"4px",boxShadow:"0 6px 16px -8px rgba(0,0,0,.75)"}}>
                            <div style={{position:"absolute",inset:0,background:"linear-gradient(155deg, "+cMain+" 0%, "+cMain+" 52%, rgba(0,0,0,.34) 100%)"}}/>
                            <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg, rgba(255,255,255,.28) 0%, rgba(255,255,255,0) 42%, rgba(0,0,0,.14) 100%)"}}/>
                            <div style={{position:"relative",zIndex:1,color:"#fff",textShadow:"0 1px 4px rgba(0,0,0,.6)",fontWeight:900,fontSize:13,letterSpacing:0.3,lineHeight:1.15,textAlign:"center"}}>
                              {emoji && <div style={{fontSize:20,marginBottom:2}}>{emoji}</div>}
                              <div>{ggGetCriterionDisplayLabel(crit, lang).toUpperCase()}</div>
                            </div>
                            <div style={{position:"absolute",top:4,right:4,width:15,height:15,borderRadius:"50%",background:"rgba(0,0,0,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"rgba(255,255,255,.85)",zIndex:2}}>ⓘ</div>
                          </div>
                        );
                      })}
                      
                      {/* 3 lignes : critère ligne + 3 cases */}
                      {ggGrid.rowCriteria.map(function(rowCrit, i){
                        const [rcMain] = ggGetCriterionColors(rowCrit);
                        const emoji = ggGetCriterionEmoji(rowCrit);
                        return(
                          <React.Fragment key={"row-"+i}>
                            {/* Critère ligne */}
                            <div onClick={function(){setGgShowTooltip({title: ggGetCriterionDisplayLabel(rowCrit, lang), text: ggGetCriterionTooltip(rowCrit, lang)});}} style={{position:"relative",overflow:"hidden",borderRadius:14,border:"1px solid rgba(255,255,255,.14)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:"4px",boxShadow:"0 6px 16px -8px rgba(0,0,0,.75)"}}>
                              <div style={{position:"absolute",inset:0,background:"linear-gradient(155deg, "+rcMain+" 0%, "+rcMain+" 52%, rgba(0,0,0,.34) 100%)"}}/>
                              <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg, rgba(255,255,255,.28) 0%, rgba(255,255,255,0) 42%, rgba(0,0,0,.14) 100%)"}}/>
                              <div style={{position:"relative",zIndex:1,color:"#fff",textShadow:"0 1px 4px rgba(0,0,0,.6)",fontWeight:900,fontSize:13,letterSpacing:0.3,lineHeight:1.15,textAlign:"center"}}>
                                {emoji && <div style={{fontSize:20,marginBottom:2}}>{emoji}</div>}
                                <div>{ggGetCriterionDisplayLabel(rowCrit, lang).toUpperCase()}</div>
                              </div>
                              <div style={{position:"absolute",top:4,right:4,width:15,height:15,borderRadius:"50%",background:"rgba(0,0,0,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"rgba(255,255,255,.85)",zIndex:2}}>ⓘ</div>
                            </div>
                            
                            {/* 3 cases de la ligne */}
                            {[0,1,2].map(function(j){
                              const cellKey = i+"-"+j;
                              const filled = ggFilledCells[cellKey];
                              const isFlashing = ggFlashCell && ggFlashCell.row===i && ggFlashCell.col===j;
                              
                              if (filled) {
                                // Couleurs selon rareté
                                const rarityStyles = {
                                  legendary: { bg: "linear-gradient(135deg, rgba(255,214,0,.55), rgba(255,140,0,.4))", border: "rgba(255,214,0,.9)", glow: "0 0 18px rgba(255,214,0,.4)" },
                                  epic:      { bg: "linear-gradient(135deg, rgba(185,70,240,.55), rgba(120,30,180,.4))", border: "rgba(185,70,240,.9)", glow: "0 0 14px rgba(185,70,240,.35)" },
                                  rare:      { bg: "linear-gradient(135deg, rgba(74,158,255,.55), rgba(30,90,200,.4))", border: "rgba(74,158,255,.9)", glow: "0 0 12px rgba(74,158,255,.3)" },
                                  common:    { bg: "linear-gradient(135deg, rgba(0,230,118,.55), rgba(0,140,80,.4))", border: "rgba(0,230,118,.85)", glow: "none" },
                                  trivial:   { bg: "rgba(180,180,180,.4)", border: "rgba(180,180,180,.7)", glow: "none" },
                                };
                                const s = rarityStyles[filled.rarity] || rarityStyles.trivial;
                                return(
                                  <div key={cellKey} onClick={function(){
                                    if(ggRevealMode){
                                      const c = ggGrid.cells.find(c => c.row===i && c.col===j);
                                      if(c) setGgRevealCell(c);
                                    }
                                  }} style={{borderRadius:12,padding:4,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,background:s.bg,border:"1.5px solid "+s.border,boxShadow:s.glow,animation:"slideUp .4s ease",cursor:ggRevealMode?"pointer":"default"}}>
                                    <div style={{fontSize:12,fontWeight:900,color:"#fff",textShadow:"0 1px 3px rgba(0,0,0,.5)",lineHeight:1.1,textAlign:"center"}}>
                                      {filled.name.toUpperCase().split(" ").map(function(w,wi){return<div key={wi}>{w}</div>;})}
                                    </div>
                                    <div style={{fontSize:13,fontWeight:900,fontFamily:G.heading,letterSpacing:.5,color:"#fff",textShadow:"0 1px 3px rgba(0,0,0,.5)"}}>+{filled.pts} pts</div>
                                  </div>
                                );
                              }
                              
                              // Couleur unique de la ligne (club) : première couleur du club
                              const [rowMain] = ggGetCriterionColors(rowCrit);
                              
                              return(
                                <div key={cellKey} onClick={function(){
                                  if(ggRevealMode){
                                    // Mode reveal : afficher les réponses possibles
                                    const c = ggGrid.cells.find(c => c.row===i && c.col===j);
                                    if(c) setGgRevealCell(c);
                                  } else if(!ggGameOver){
                                    setGgSelectedCell({row:i,col:j});
                                  }
                                }} style={{position:"relative",overflow:"hidden",background:isFlashing&&ggFlash==="ko"?"rgba(239,68,68,.3)":ggRevealMode?"rgba(74,158,255,.15)":"transparent",border:"1px solid "+(isFlashing&&ggFlash==="ko"?"rgba(239,68,68,.7)":ggRevealMode?"rgba(74,158,255,.4)":"rgba(255,255,255,.15)"),cursor:(ggRevealMode||!ggGameOver)?"pointer":"default",transition:"all .15s",padding:4,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:12,animation:isFlashing&&ggFlash==="ko"?"answerKo .4s ease":"none"}}>
                                  {/* Fond unique : couleur dominante du club (ligne) */}
                                  {!ggRevealMode && !(isFlashing&&ggFlash==="ko") && (
                                    <>
                                      <div style={{position:"absolute",inset:0,background:rowMain,opacity:.14}}/>
                                      <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg, rgba(0,0,0,.1) 0%, rgba(0,0,0,.45) 100%)"}}/>
                                    </>
                                  )}
                                  <div style={{position:"relative",zIndex:1,width:34,height:34,borderRadius:11,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.18)",boxShadow:"inset 0 1px 0 rgba(255,255,255,.12)",fontSize:ggRevealMode?15:22,color:ggRevealMode?"#7AB8FF":"rgba(255,255,255,.78)",fontWeight:ggRevealMode?800:300}}>{ggRevealMode?"?":"+"}</div>
                                </div>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>

                  {/* 🎬 MODE DÉMO : feuille de réponses (grille fixe) — pour enregistrer une vidéo */}
                  {ggDemo && ggGrid && (
                    <div style={{margin:"14px 16px",background:"rgba(255,214,0,.06)",border:"1px dashed rgba(255,214,0,.4)",borderRadius:14,padding:"12px 14px"}}>
                      <div style={{fontSize:11,fontWeight:900,letterSpacing:1,color:"#FFD600",marginBottom:8}}>🎬 MODE DÉMO — réponses (une par case)</div>
                      <div style={{display:"flex",flexDirection:"column",gap:5}}>
                        {ggDemoAnswers(ggGrid.cells).map(function(entry,idx){
                          const c = entry.cell;
                          return (
                            <div key={idx} style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}>
                              <span style={{width:16,color:"rgba(255,255,255,.4)",fontWeight:800,flexShrink:0}}>{idx+1}</span>
                              <span style={{flex:1,color:"rgba(255,255,255,.7)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.rowCriterion.label} × {c.colCriterion.label}</span>
                              <span style={{color:"#00E676",fontWeight:800,flexShrink:0}}>{entry.answer}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{fontSize:10,color:"rgba(255,255,255,.4)",marginTop:8,lineHeight:1.4}}>Grille fixe (identique à chaque fois). Tape le nom → touche la suggestion. Désactiver : ?demo=0</div>
                    </div>
                  )}

                </>
              )}

              {/* Modal de saisie (clic sur une case vide) */}
              {ggSelectedCell && !ggGameOver && ggGrid && (() => {
                const cell = ggGrid.cells.find(c => c.row === ggSelectedCell.row && c.col === ggSelectedCell.col);
                if (!cell) return null;
                const rowCrit = cell.rowCriterion;
                const colCrit = cell.colCriterion;
                const rowEmoji = ggGetCriterionEmoji(rowCrit);
                const colEmoji = ggGetCriterionEmoji(colCrit);
                const [rowMain, rowSecond] = ggGetCriterionColors(rowCrit);
                const [colMain, colSecond] = ggGetCriterionColors(colCrit);
                const suggestions = ggGetSuggestions(ggGuess);
                // Carte critère "design" : dégradé aux couleurs du critère + pastille emoji
                const critCard = (emoji, main, second, label) => (
                  <div style={{flex:1,position:"relative",background:"linear-gradient(150deg, "+main+"33, "+second+"1f 70%, rgba(0,0,0,.25))",border:"1.5px solid "+main+"88",borderRadius:16,padding:"14px 8px 12px",textAlign:"center",boxShadow:"0 8px 22px -10px "+main+"aa, inset 0 1px 0 rgba(255,255,255,.06)",overflow:"hidden"}}>
                    <div style={{position:"absolute",top:-18,left:"50%",transform:"translateX(-50%)",width:60,height:60,borderRadius:"50%",background:main,opacity:.25,filter:"blur(18px)"}}/>
                    {emoji && <div style={{position:"relative",width:40,height:40,margin:"0 auto 6px",borderRadius:"50%",background:"rgba(0,0,0,.35)",border:"1px solid "+main+"66",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,boxShadow:"0 2px 8px rgba(0,0,0,.4)"}}>{emoji}</div>}
                    <div style={{position:"relative",fontSize:11.5,fontWeight:900,color:"#fff",lineHeight:1.2,letterSpacing:.3,textShadow:"0 1px 3px rgba(0,0,0,.6)"}}>{label.toUpperCase()}</div>
                  </div>
                );
                return (
                  <div onClick={function(){if(!ggFlash){setGgSelectedCell(null);setGgGuess("");}}} style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,.82)",backdropFilter:"blur(10px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
                    <div onClick={function(e){e.stopPropagation();}} style={{position:"relative",background:"linear-gradient(165deg, #16241c 0%, #0d1712 55%, #0a0f0c 100%)",border:"1px solid rgba(0,230,118,.28)",borderRadius:24,padding:22,maxWidth:370,width:"100%",boxShadow:"0 30px 80px -24px rgba(0,0,0,.85), inset 0 1px 0 rgba(255,255,255,.05)"}}>
                      {/* Halo d'ambiance en haut de la carte */}
                      <div style={{position:"absolute",top:0,left:0,right:0,height:120,borderRadius:"24px 24px 0 0",background:"radial-gradient(ellipse 70% 100% at 50% 0%, rgba(0,230,118,.14), transparent 70%)",pointerEvents:"none"}}/>
                      <div style={{position:"relative",textAlign:"center",marginBottom:16}}>
                        <div style={{fontSize:13,fontWeight:900,letterSpacing:1,color:"#fff"}}>🎯 {tr("QUI MATCHE ?","WHO FITS?","WER PASST?","CHI CI STA?","QUEM ENCAIXA?")}</div>
                        <div style={{fontSize:10,letterSpacing:2,color:"rgba(255,255,255,.4)",fontWeight:700,marginTop:3}}>{tr("UN JOUEUR POUR CES 2 CRITÈRES","A PLAYER FOR THESE 2 CRITERIA","EIN SPIELER FÜR DIESE 2 KRITERIEN","UN GIOCATORE PER QUESTI 2 CRITERI","UM JOGADOR PARA ESTES 2 CRITÉRIOS")}</div>
                      </div>
                      <div style={{position:"relative",display:"flex",gap:10,marginBottom:18,alignItems:"stretch"}}>
                        {critCard(rowEmoji, rowMain, rowSecond, ggGetCriterionDisplayLabel(rowCrit, lang))}
                        <div style={{alignSelf:"center",flexShrink:0,width:30,height:30,borderRadius:"50%",background:"linear-gradient(135deg,#FFD600,#FF8A2A)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:900,color:"#000",boxShadow:"0 3px 10px rgba(255,138,42,.5)"}}>×</div>
                        {critCard(colEmoji, colMain, colSecond, ggGetCriterionDisplayLabel(colCrit, lang))}
                      </div>
                      <input
                        type="text"
                        autoFocus
                        value={ggGuess}
                        onChange={function(e){setGgGuess(e.target.value);}}
                        onKeyDown={function(e){if(e.key==="Enter"){ if(suggestions.length>0){ggSubmitAnswer(suggestions[0].name);} else if(ggGuess.trim().length>=3){ggSubmitAnswer(ggGuess);} }}}
                        placeholder={tr("Tape au moins 3 lettres...","Type at least 3 letters...","Mindestens 3 Buchstaben eingeben...","Scrivi almeno 3 lettere...","Digite ao menos 3 letras...")}
                        style={{width:"100%",background:ggFlash==="ko"?"rgba(239,68,68,.15)":"rgba(255,255,255,.08)",border:"2px solid "+(ggFlash==="ko"?"rgba(239,68,68,.7)":"rgba(255,255,255,.15)"),borderRadius:14,padding:"14px 16px",color:"#fff",fontSize:16,fontWeight:700,outline:"none",textAlign:"center",boxSizing:"border-box",animation:ggFlash==="ko"?"answerKo .4s ease":"none"}}
                      />
                      {suggestions.length > 0 && (
                        <div style={{marginTop:8,background:"rgba(255,255,255,.04)",borderRadius:12,maxHeight:180,overflowY:"auto"}}>
                          {suggestions.map(function(p){return(
                            <div key={p.name} onClick={function(){ggSubmitAnswer(p.name);}} style={{padding:"10px 14px",cursor:"pointer",borderBottom:"1px solid rgba(255,255,255,.04)",fontSize:14,fontWeight:700,color:"#fff",transition:"background .1s"}} onMouseEnter={function(e){e.currentTarget.style.background="rgba(0,230,118,.08)";}} onMouseLeave={function(e){e.currentTarget.style.background="transparent";}}>
                              {p.name}
                            </div>
                          );})}
                        </div>
                      )}
                      {/* Bouton "Signaler" : apparaît après une mauvaise réponse */}
                      {ggLastRejected && (
                        <div style={{marginTop:10,padding:10,background:"rgba(255,107,53,.1)",border:"1px solid rgba(255,107,53,.3)",borderRadius:12}}>
                          {ggReportSent ? (
                            <div style={{textAlign:"center",fontSize:12,color:"#00E676",fontWeight:700,padding:6}}>
                              ✅ {tr("Merci ! On va vérifier.","Thanks! We'll check it.","Danke! Wir prüfen es.","Grazie! Controlleremo.","Obrigado! Vamos verificar.")}
                            </div>
                          ) : (
                            <>
                              <div style={{fontSize:11,color:"rgba(255,255,255,.7)",marginBottom:6,textAlign:"center"}}>
                                <strong style={{color:"#FF6B35"}}>{ggLastRejected.playerName}</strong> {tr("refusé ?","refused?","abgelehnt?","rifiutato?","recusado?")}
                              </div>
                              <button onClick={async function(){
                                try {
                                  await sbFetch("bb_reports", {
                                    method:"POST",
                                    headers:{"Content-Type":"application/json","Prefer":"return=minimal"},
                                    body: JSON.stringify({
                                      reporter_id: playerId,
                                      reporter_name: playerName || null,
                                      report_type: "gg_missed",
                                      c1: ggLastRejected.rowCrit.label,
                                      c2: ggLastRejected.colCrit.label,
                                      given_answer: ggLastRejected.playerName,
                                      player_name: ggLastRejected.playerName,
                                      message: "GOAT GRID: l'utilisateur affirme que cette réponse devrait être valide",
                                    })
                                  });
                                  setGgReportSent(true);
                                } catch(e) { setGgReportSent(true); }
                              }} style={{width:"100%",padding:10,borderRadius:50,border:"none",background:"rgba(255,107,53,.25)",color:"#FF8A66",fontWeight:800,fontSize:12,letterSpacing:1,cursor:"pointer"}}>
                                ⚠️ {tr("Je suis sûr que ça devrait passer","I'm sure it should pass","Ich bin sicher, das sollte gelten","Sono sicuro che dovrebbe valere","Tenho certeza que deveria valer")}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                      {/* Boutons Valider + Annuler */}
                      <div style={{display:"flex",gap:8,marginTop:14}}>
                        <button onClick={function(){setGgSelectedCell(null);setGgGuess("");setGgLastRejected(null);setGgReportSent(false);}} style={{flex:1,padding:14,borderRadius:50,border:"none",background:"rgba(255,255,255,.08)",color:"#fff",fontWeight:800,fontSize:13,letterSpacing:1,cursor:"pointer"}}>{tr("Annuler","Cancel","Abbrechen","Annulla","Cancelar")}</button>
                        <button 
                          onClick={function(){ if(suggestions.length>0){ggSubmitAnswer(suggestions[0].name);} else if(ggGuess.trim().length>=3){ggSubmitAnswer(ggGuess);} }}
                          disabled={ggGuess.trim().length<3}
                          style={{flex:2,padding:14,borderRadius:50,border:"none",background:ggGuess.trim().length>=3?"#00E676":"rgba(255,255,255,.05)",color:ggGuess.trim().length>=3?"#000":"rgba(255,255,255,.3)",fontWeight:900,fontSize:14,letterSpacing:1.5,cursor:ggGuess.trim().length>=3?"pointer":"not-allowed"}}
                        >{tr("VALIDER","VALIDATE","BESTÄTIGEN","CONVALIDA","VALIDAR")}</button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 🐐 ÉCRAN FIN DE PARTIE (game over) */}
              {ggGameOver && !ggRevealMode && !ggReviewMode && (() => {
                const filledCount = Object.keys(ggFilledCells).length;
                const isPerfect = filledCount === 9 && ggLives === 3;
                const isVictory = filledCount === 9;
                const isDefeat = ggLives <= 0 && !isVictory;
                
                // Génère l'emoji grid Wordle-style pour le partage
                const gridEmojis = [];
                for (let i = 0; i < 3; i++) {
                  const row = [];
                  for (let j = 0; j < 3; j++) {
                    const filled = ggFilledCells[i+"-"+j];
                    if (!filled) { row.push("⬜"); continue; }
                    const e = { legendary:"🟨", epic:"🟪", rare:"🟦", common:"🟩", trivial:"⬛" }[filled.rarity] || "🟩";
                    row.push(e);
                  }
                  gridEmojis.push(row.join(""));
                }
                const todayDate = new Date().toLocaleDateString(tr("fr-FR","en-US","de-DE","it-IT","pt-PT"),{day:'numeric',month:'short'});
                const shareText = "🐐 GOAT GRID — " + todayDate + "\n\n" + gridEmojis.join("\n") + "\n\n" + ggScore + " pts · " + filledCount + "/9" + (isPerfect ? " · " + tr("PARFAIT","PERFECT","PERFEKT","PERFETTO","PERFEITO") + " 🐐" : "") + "\n\n" + tr("Joue sur goatfc.online","Play on goatfc.online","Spiel auf goatfc.online","Gioca su goatfc.online","Jogue em goatfc.online");
                
                return (
                  <div style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,.92)",backdropFilter:"blur(10px)",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"80px 20px 40px",overflowY:"auto"}}>
                    <div style={{background:"linear-gradient(135deg, #1a2419, #0f1812)",border:"1px solid "+(isVictory?"rgba(0,230,118,.5)":"rgba(255,107,53,.5)"),borderRadius:24,padding:24,maxWidth:380,width:"100%",textAlign:"center"}}>
                      
                      {/* Titre selon résultat */}
                      <div style={{fontSize:60,marginBottom:8}}>
                        {isPerfect ? "🐐" : isVictory ? "🎉" : "😔"}
                      </div>
                      <div style={{fontFamily:G.heading,fontSize:30,color:isVictory?"#00E676":"#FF6B35",letterSpacing:1,marginBottom:4}}>
                        {isPerfect ? (tr("PARFAIT !","PERFECT!","PERFEKT!","PERFETTO!","PERFEITO!")) : isVictory ? (tr("VICTOIRE !","VICTORY!","SIEG!","VITTORIA!","VITÓRIA!")) : (tr("PARTIE TERMINÉE","GAME OVER","GAME OVER","GAME OVER","FIM DE JOGO"))}
                      </div>
                      <div style={{fontSize:13,color:"rgba(255,255,255,.6)",marginBottom:18}}>
                        {isPerfect ? (tr("Grille parfaite, aucune erreur !","Grid filled without mistakes!","Raster fehlerfrei gefüllt!","Griglia completata senza errori!","Grade preenchida sem erros!")) : isVictory ? (tr("Tu as rempli toute la grille","You filled the whole grid","Du hast das ganze Raster gefüllt","Hai riempito tutta la griglia","Você preencheu toda a grade")) : (tr("Tu as utilisé toutes tes vies","You used all your lives","Du hast alle Leben verbraucht","Hai usato tutte le vite","Você usou todas as vidas"))}
                      </div>
                      
                      {/* Score final (consolidé : score + remplissage + vies) */}
                      <div style={{background:"rgba(255,214,0,.1)",border:"1px solid rgba(255,214,0,.3)",borderRadius:16,padding:"16px 20px",marginBottom:16}}>
                        <div style={{fontSize:11,color:"rgba(255,214,0,.7)",fontWeight:700,letterSpacing:2,marginBottom:2}}>SCORE</div>
                        <div style={{fontFamily:G.heading,fontSize:44,color:"#FFD600",lineHeight:1}}>{ggScore} <span style={{fontSize:18,opacity:.7}}>pts</span></div>
                        <div style={{fontSize:12,color:"rgba(255,255,255,.6)",marginTop:6,fontWeight:700}}>
                          {filledCount}/9 {tr("rempli","filled","gefüllt","riempito","preenchido")} · {[0,1,2].map(function(i){return(<span key={i}>{i<ggLives?"❤️":"💔"}</span>);})}
                        </div>
                        {isPerfect && (
                          <div style={{fontSize:11,color:"#00E676",fontWeight:800,marginTop:6}}>+100 {tr("BONUS SANS-FAUTE","NO-MISTAKE BONUS","FEHLERFREI-BONUS","BONUS SENZA ERRORI","BÔNUS SEM ERROS")}</div>
                        )}
                      </div>

                      {/* Mini aperçu Wordle-style */}
                      <div style={{background:"rgba(0,0,0,.3)",borderRadius:14,padding:14,marginBottom:14,fontFamily:"monospace",fontSize:24,letterSpacing:6,lineHeight:1.3}}>
                        {gridEmojis.map(function(row,i){return(<div key={i}>{row}</div>);})}
                      </div>
                      
                      {/* Boutons d'action */}
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        <button onClick={async function(){
                          try {
                            if (navigator.share) {
                              await navigator.share({ text: shareText });
                            } else {
                              await navigator.clipboard.writeText(shareText);
                              setGgShareCopied(true);
                              setTimeout(function(){setGgShareCopied(false);}, 2000);
                            }
                          } catch(e) {}
                        }} style={{padding:14,borderRadius:50,border:"none",background:"linear-gradient(135deg,#00E676,#FFD600)",color:"#000",fontWeight:900,fontSize:14,letterSpacing:1.5,cursor:"pointer"}}>
                          {ggShareCopied ? "✅ " + tr("COPIÉ !","COPIED!","KOPIERT!","COPIATO!","COPIADO!") : "📤 " + tr("PARTAGER MON RÉSULTAT","SHARE MY RESULT","MEIN ERGEBNIS TEILEN","CONDIVIDI IL RISULTATO","COMPARTILHAR RESULTADO")}
                        </button>
                        <button onClick={function(){setGgRevealMode(true);setGgReviewMode(false);}} style={{padding:12,borderRadius:50,border:"1px solid rgba(74,158,255,.4)",background:"rgba(74,158,255,.15)",color:"#7AB8FF",fontWeight:800,fontSize:13,letterSpacing:1,cursor:"pointer"}}>
                          💡 {tr("VOIR LES RÉPONSES POSSIBLES","SEE POSSIBLE ANSWERS","MÖGLICHE ANTWORTEN ANSEHEN","VEDI LE RISPOSTE POSSIBILI","VER RESPOSTAS POSSÍVEIS")}
                        </button>
                        <button onClick={function(){setGgReviewMode(true);setGgRevealMode(false);setGgRevealCell(null);}} style={{padding:12,borderRadius:50,border:"1px solid rgba(0,230,118,.4)",background:"rgba(0,230,118,.15)",color:"#00E676",fontWeight:800,fontSize:13,letterSpacing:1,cursor:"pointer"}}>
                          📋 {tr("REVOIR MA GRILLE","REVIEW MY GRID","MEIN RASTER ANSEHEN","RIVEDI LA GRIGLIA","REVER MINHA GRADE")}
                        </button>
                        {ggOverrideSeed === 0 && (
                          <button onClick={function(){ggLoadLeaderboard();setGgLeaderboardTab("global");}} style={{padding:12,borderRadius:50,border:"1px solid rgba(255,214,0,.4)",background:"rgba(255,214,0,.15)",color:"#FFD600",fontWeight:800,fontSize:13,letterSpacing:1,cursor:"pointer"}}>
                            🏆 {tr("CLASSEMENT","LEADERBOARD","RANGLISTE","CLASSIFICA","CLASSIFICAÇÃO")}
                          </button>
                        )}
                        <button onClick={function(){
                          const newSeed = Math.floor(Math.random() * 1000000) + 1;
                          setGgOverrideSeed(newSeed);
                          setGgFilledCells({});
                          setGgUsedPlayers(new Set());
                          setGgLives(3);
                          setGgScore(0);
                          setGgGameOver(false);
                          setGgGuess("");
                          setGgFlash(null);
                          setGgSelectedCell(null);
                          setGgRevealMode(false);
                          setGgRevealCell(null);
                          setGgReviewMode(false);
                          setGgScoreSaved(false);
                          const newGrid = ggGenerateGrid(newSeed);
                          if (newGrid) { setGgGrid(newGrid); setGgError(false); }
                          else setGgError(true);
                        }} style={{padding:12,borderRadius:50,border:"1px solid rgba(255,214,0,.4)",background:"rgba(255,214,0,.15)",color:"#FFD600",fontWeight:800,fontSize:13,letterSpacing:1,cursor:"pointer"}}>
                          🔄 {tr("NOUVELLE GRILLE","NEW GRID","NEUES RASTER","NUOVA GRIGLIA","NOVA GRADE")}
                        </button>
                        <button onClick={function(){setShowGoatGrid(false);}} style={{padding:12,borderRadius:50,border:"none",background:"rgba(255,255,255,.05)",color:"rgba(255,255,255,.7)",fontWeight:700,fontSize:13,letterSpacing:1,cursor:"pointer"}}>
                          {tr("Fermer","Close","Schließen","Chiudi","Fechar")}
                        </button>
                      </div>

                      <div style={{marginTop:14,fontSize:11,color:"rgba(255,255,255,.4)",fontStyle:"italic"}}>
                        {tr("Nouvelle grille demain à minuit 🐐","New grid tomorrow at midnight 🐐","Neues Raster morgen um Mitternacht 🐐","Nuova griglia domani a mezzanotte 🐐","Nova grade amanhã à meia-noite 🐐")}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 🔍 Mode REVEAL : indicateur en haut + bouton retour */}
              {ggRevealMode && !ggRevealCell && (
                <div style={{position:"fixed",bottom:20,left:20,right:20,zIndex:450,display:"flex",flexDirection:"column",gap:8}}>
                  <div style={{background:"rgba(74,158,255,.15)",border:"1px solid rgba(74,158,255,.4)",borderRadius:14,padding:"10px 14px",color:"#7AB8FF",fontSize:13,fontWeight:700,textAlign:"center"}}>
                    💡 {tr("Clique sur n'importe quelle case pour voir les réponses","Click any cell to see possible answers","Klicke auf eine Zelle, um mögliche Antworten zu sehen","Clicca su una casella per vedere le risposte","Clique em qualquer célula para ver as respostas")}
                  </div>
                  <button onClick={function(){setGgRevealMode(false);}} style={{padding:12,borderRadius:50,border:"none",background:"#FFD600",color:"#000",fontWeight:900,fontSize:13,letterSpacing:1,cursor:"pointer"}}>
                    ← {tr("RETOUR AU RÉSULTAT","BACK TO RESULT","ZURÜCK ZUM ERGEBNIS","TORNA AL RISULTATO","VOLTAR AO RESULTADO")}
                  </button>
                </div>
              )}
              
              {/* 📋 Mode REVIEW : bouton retour en bas */}
              {ggReviewMode && (
                <div style={{position:"fixed",bottom:20,left:20,right:20,zIndex:450,display:"flex",flexDirection:"column",gap:8}}>
                  <div style={{background:"rgba(0,230,118,.15)",border:"1px solid rgba(0,230,118,.4)",borderRadius:14,padding:"10px 14px",color:"#00E676",fontSize:13,fontWeight:700,textAlign:"center"}}>
                    📋 {tr("Revue de ta grille remplie","Review your filled grid","Sieh dir dein gefülltes Raster an","Rivedi la tua griglia completata","Reveja sua grade preenchida")}
                  </div>
                  <button onClick={function(){setGgReviewMode(false);}} style={{padding:12,borderRadius:50,border:"none",background:"#FFD600",color:"#000",fontWeight:900,fontSize:13,letterSpacing:1,cursor:"pointer"}}>
                    ← {tr("RETOUR AU RÉSULTAT","BACK TO RESULT","ZURÜCK ZUM ERGEBNIS","TORNA AL RISULTATO","VOLTAR AO RESULTADO")}
                  </button>
                </div>
              )}
              
              {/* 🏆 Modal Leaderboard */}
              {ggLeaderboardData && (ggLeaderboardData.global.length > 0 || ggLeaderboardData.friends.length > 0 || ggLeaderboardLoading) && !ggReviewMode && !ggRevealMode && (
                <div onClick={function(){setGgLeaderboardData({global:[],friends:[]});}} style={{position:"fixed",inset:0,zIndex:600,background:"rgba(0,0,0,.85)",backdropFilter:"blur(8px)",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"80px 20px 40px",overflowY:"auto"}}>
                  <div onClick={function(e){e.stopPropagation();}} style={{background:"linear-gradient(135deg, #1a2419, #0f1812)",border:"1px solid rgba(255,214,0,.4)",borderRadius:20,padding:20,maxWidth:420,width:"100%",maxHeight:"85vh",display:"flex",flexDirection:"column"}}>
                    <div style={{textAlign:"center",marginBottom:14}}>
                      <div style={{fontSize:11,letterSpacing:2,color:"rgba(255,214,0,.7)",fontWeight:700,marginBottom:4}}>🏆 {tr("CLASSEMENT","LEADERBOARD","RANGLISTE","CLASSIFICA","RANKING")}</div>
                      <div style={{fontSize:13,color:"rgba(255,255,255,.6)"}}>{new Date().toLocaleDateString(tr("fr-FR","en-US","de-DE","it-IT","pt-PT"),{day:'numeric',month:'long'})}</div>
                    </div>
                    {/* Tabs */}
                    <div style={{display:"flex",gap:6,marginBottom:12,background:"rgba(0,0,0,.3)",padding:4,borderRadius:50}}>
                      <button onClick={function(){setGgLeaderboardTab("global");}} style={{flex:1,padding:8,borderRadius:50,border:"none",background:ggLeaderboardTab==="global"?"#FFD600":"transparent",color:ggLeaderboardTab==="global"?"#000":"rgba(255,255,255,.6)",fontWeight:800,fontSize:12,letterSpacing:1,cursor:"pointer"}}>
                        🌍 {tr("MONDIAL","GLOBAL","GLOBAL","GLOBALE","GLOBAL")}
                      </button>
                      <button onClick={function(){setGgLeaderboardTab("friends");}} style={{flex:1,padding:8,borderRadius:50,border:"none",background:ggLeaderboardTab==="friends"?"#00E676":"transparent",color:ggLeaderboardTab==="friends"?"#000":"rgba(255,255,255,.6)",fontWeight:800,fontSize:12,letterSpacing:1,cursor:"pointer"}}>
                        👥 {tr("AMIS","FRIENDS","FREUNDE","AMICI","AMIGOS")}
                      </button>
                    </div>
                    {/* Liste */}
                    <div style={{flex:1,overflowY:"auto",background:"rgba(255,255,255,.04)",borderRadius:12,padding:6}}>
                      {ggLeaderboardLoading ? (
                        <div style={{textAlign:"center",padding:20,color:"rgba(255,255,255,.5)"}}>{tr("Chargement...","Loading...","Wird geladen...","Caricamento...","Carregando...")}</div>
                      ) : (() => {
                        const list = ggLeaderboardTab === "global" ? ggLeaderboardData.global : ggLeaderboardData.friends;
                        if (list.length === 0) {
                          return <div style={{textAlign:"center",padding:20,color:"rgba(255,255,255,.5)",fontSize:13}}>
                            {ggLeaderboardTab === "friends" ? (tr("Aucun de tes amis n'a encore joué aujourd'hui.","None of your friends played yet today.","Keiner deiner Freunde hat heute schon gespielt.","Nessuno dei tuoi amici ha ancora giocato oggi.","Nenhum dos seus amigos jogou hoje ainda.")) : (tr("Aucun score aujourd'hui pour l'instant.","No scores yet today.","Heute noch keine Scores.","Ancora nessun punteggio oggi.","Nenhuma pontuação hoje ainda."))}
                          </div>;
                        }
                        return list.map(function(entry, idx){
                          const isMe = entry.player_id === playerId;
                          const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : (idx+1)+".";
                          return(
                            <div key={entry.player_id+"-"+idx} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",background:isMe?"rgba(255,214,0,.15)":"transparent",borderRadius:10,marginBottom:3,border:isMe?"1px solid rgba(255,214,0,.3)":"none"}}>
                              <div style={{minWidth:30,fontSize:idx<3?16:13,fontWeight:800,color:idx<3?"#FFD600":"rgba(255,255,255,.6)",textAlign:"center"}}>{medal}</div>
                              <div style={{flex:1}}>
                                <div style={{fontSize:13,fontWeight:isMe?900:700,color:isMe?"#FFD600":"#fff"}}>{entry.player_name}{isMe?" (toi)":""}</div>
                                <div style={{fontSize:10,color:"rgba(255,255,255,.4)",fontFamily:"monospace"}}>{entry.cells_filled}/9 · {"❤️".repeat(entry.lives_left)}{"💔".repeat(3-entry.lives_left)}</div>
                              </div>
                              <div style={{textAlign:"right"}}>
                                <div style={{fontSize:15,fontWeight:900,color:"#FFD600",fontFamily:G.heading}}>{entry.score}</div>
                                <div style={{fontSize:9,color:"rgba(255,255,255,.4)"}}>/ {entry.max_score}</div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                    <button onClick={function(){setGgLeaderboardData({global:[],friends:[]});}} style={{marginTop:12,padding:12,borderRadius:50,border:"none",background:"rgba(255,255,255,.08)",color:"#fff",fontWeight:800,fontSize:13,letterSpacing:1,cursor:"pointer"}}>
                      {tr("Fermer","Close","Schließen","Chiudi","Fechar")}
                    </button>
                  </div>
                </div>
              )}
              
              {/* 📜 Modal liste des réponses possibles d'une case */}
              {ggRevealCell && (
                <div onClick={function(){setGgRevealCell(null);}} style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,.85)",backdropFilter:"blur(8px)",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"80px 20px 40px",overflowY:"auto"}}>
                  <div onClick={function(e){e.stopPropagation();}} style={{background:"linear-gradient(135deg, #1a2419, #0f1812)",border:"1px solid rgba(74,158,255,.4)",borderRadius:20,padding:20,maxWidth:380,width:"100%"}}>
                    <div style={{textAlign:"center",marginBottom:14}}>
                      <div style={{fontSize:11,letterSpacing:2,color:"rgba(74,158,255,.7)",fontWeight:700,marginBottom:4}}>{tr("RÉPONSES POSSIBLES","POSSIBLE ANSWERS","MÖGLICHE ANTWORTEN","RISPOSTE POSSIBILI","RESPOSTAS POSSÍVEIS")}</div>
                      <div style={{fontSize:14,color:"#fff",fontWeight:700}}>{ggGetCriterionDisplayLabel(ggRevealCell.rowCriterion, lang)} × {ggGetCriterionDisplayLabel(ggRevealCell.colCriterion, lang)}</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginTop:4}}>{ggRevealCell.totalCount} {tr("candidats","candidates","Kandidaten","candidati","candidatos")} · {ggRevealCell.points} pts</div>
                    </div>
                    <div style={{maxHeight:280,overflowY:"auto",background:"rgba(255,255,255,.04)",borderRadius:12,padding:8}}>
                      {ggRevealCell.candidates.slice(0, 30).map(function(name){
                        const wasUsed = ggUsedPlayers.has(name);
                        return(
                          <div key={name} style={{padding:"10px 14px",borderBottom:"1px solid rgba(255,255,255,.04)",fontSize:14,fontWeight:700,color:wasUsed?"#00E676":"#fff",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <span>{name}</span>
                            {wasUsed && <span style={{fontSize:11,color:"#00E676"}}>✓ {tr("Trouvé","Found","Gefunden","Trovato","Encontrado")}</span>}
                          </div>
                        );
                      })}
                      {ggRevealCell.candidates.length > 30 && (
                        <div style={{padding:"10px 14px",fontSize:12,color:"rgba(255,255,255,.5)",textAlign:"center",fontStyle:"italic"}}>
                          {tr("... et ","... and ","... und ","... e ","... e ")}{ggRevealCell.candidates.length - 30} {tr("autres","others","weitere","altri","outros")}
                        </div>
                      )}
                    </div>
                    <button onClick={function(){setGgRevealCell(null);}} style={{marginTop:14,width:"100%",padding:12,borderRadius:50,border:"none",background:"#7AB8FF",color:"#000",fontWeight:800,fontSize:13,letterSpacing:1,cursor:"pointer"}}>{tr("Fermer","Close","Schließen","Chiudi","Fechar")}</button>
                  </div>
                </div>
              )}

              {/* Tooltip critère (clic sur ⓘ) */}
              {ggShowTooltip && (
                <div onClick={function(){setGgShowTooltip(null);}} style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,.85)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
                  <div onClick={function(e){e.stopPropagation();}} style={{background:"linear-gradient(135deg, #1a2419, #0f1812)",border:"1px solid rgba(255,214,0,.3)",borderRadius:20,padding:20,maxWidth:340,width:"100%",textAlign:"center"}}>
                    <div style={{fontSize:11,letterSpacing:2,color:"rgba(255,214,0,.7)",fontWeight:700,marginBottom:8}}>{tr("CRITÈRE","CRITERION","KRITERIUM","CRITERIO","CRITÉRIO")}</div>
                    <div style={{fontFamily:G.heading,fontSize:24,color:"#FFD600",letterSpacing:1,marginBottom:14}}>{ggShowTooltip.title.toUpperCase()}</div>
                    <div style={{fontSize:14,lineHeight:1.5,color:"rgba(255,255,255,.85)",textAlign:"left",background:"rgba(255,255,255,.04)",borderRadius:12,padding:14,marginBottom:14}}>{ggShowTooltip.text}</div>
                    <button onClick={function(){setGgShowTooltip(null);}} style={{width:"100%",padding:12,borderRadius:50,border:"none",background:"#00E676",color:"#000",fontWeight:800,fontSize:13,letterSpacing:1,cursor:"pointer"}}>{tr("OK","GOT IT","OK","OK","OK")}</button>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* Modal défi du jour — Devine le joueur */}
        {showDailyGame && dailyPlayer && (
          <div style={{position:"fixed",inset:0,zIndex:400,display:"flex",flexDirection:"column"}}>
            {/* Fond pelouse */}
            <div style={{position:"absolute",inset:0,zIndex:0,overflow:"hidden"}}>
              {[0,1,2,3,4,5,6].map(function(i){return(<div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#0E1F14":"#132819"}}/>);})}
              <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
              <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
              <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg, rgba(255,214,0,.15) 0%, rgba(255,107,53,.15) 40%, rgba(0,15,0,.85) 100%)"}}/>
              <div style={{position:"absolute",top:-80,left:-80,width:300,height:300,borderRadius:"50%",background:"radial-gradient(circle, rgba(255,214,0,.25) 0%, transparent 70%)",filter:"blur(40px)"}}/>
              <div style={{position:"absolute",top:-60,right:-60,width:250,height:250,borderRadius:"50%",background:"radial-gradient(circle, rgba(255,107,53,.2) 0%, transparent 70%)",filter:"blur(40px)"}}/>
            </div>
            {/* Header */}
            <div style={{zIndex:1,padding:"20px 20px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontFamily:G.heading,fontSize:26,color:G.gold,letterSpacing:2}}>⚡ {tr("DÉFI DU JOUR","DAILY CHALLENGE","TÄGLICHE CHALLENGE","SFIDA DEL GIORNO","DESAFIO DO DIA")}</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,.5)",marginTop:2}}>{tr("Devine le joueur mystère","Guess the mystery player","Errate den Mystery-Spieler","Indovina il giocatore misterioso","Adivinhe o jogador misterioso")}</div>
              </div>
              <button onClick={function(){setShowDailyGame(false);setDailySuccess(false);setDailyHintLevel(0);setDailyUsedHint(false);setDailyHintData({ position: null, nationality: null, loading: false });}} style={{background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.15)",borderRadius:"50%",width:36,height:36,color:G.white,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>
            {/* Contenu */}
            <div style={{...sheet,borderRadius:"28px 28px 0 0",marginTop:20,zIndex:1,flex:1,justifyContent:"flex-start",overflowY:"auto",paddingTop:20,paddingBottom:40,background:"linear-gradient(180deg, rgba(255,214,0,.08) 0%, rgba(10,20,10,.92) 60%)",backdropFilter:"blur(10px)"}}>
              {/* Theme banner (jour de la semaine) */}
              {(() => {
                const theme = getTodayTheme();
                return (
                  <div style={{textAlign:"center",marginBottom:12,padding:"8px 16px",background:`linear-gradient(135deg, ${theme.color}33, ${theme.color}11)`,border:`1px solid ${theme.color}66`,borderRadius:14,display:"inline-block",alignSelf:"center",margin:"0 auto 12px"}}>
                    <div style={{fontSize:22,marginBottom:2}}>{theme.flag}</div>
                    <div style={{fontSize:11,fontWeight:800,letterSpacing:2,color:G.white,textTransform:"uppercase"}}>
                      {lang==="de"?(theme.labelDe||theme.labelEn):lang==="it"?(theme.labelIt||theme.labelEn):lang==="pt"?(theme.labelPt||theme.labelEn):lang==="en"?theme.labelEn:theme.labelFr}
                    </div>
                  </div>
                );
              })()}
              {/* Clubs — masqués quand la partie est finie pour montrer le résultat en haut */}
              {!dailySuccess && !dailyRevealed && (
              <div>
                <div style={{textAlign:"center",marginBottom:8}}>
                  <span style={{
                    fontSize:11,fontWeight:800,letterSpacing:2,textTransform:"uppercase",padding:"3px 10px",borderRadius:20,
                    color: dailyPlayer.diff==="facile"?"#00E676":dailyPlayer.diff==="moyen"?"#FFD600":"#FF3D57",
                    background: dailyPlayer.diff==="facile"?"rgba(0,230,118,.15)":dailyPlayer.diff==="moyen"?"rgba(255,214,0,.15)":"rgba(255,61,87,.15)",
                    border: `1px solid ${dailyPlayer.diff==="facile"?"rgba(0,230,118,.3)":dailyPlayer.diff==="moyen"?"rgba(255,214,0,.3)":"rgba(255,61,87,.3)"}`
                  }}>
                    {dailyPlayer.diff==="facile"?"⭐ AMATEUR":dailyPlayer.diff==="moyen"?"⭐⭐ PRO":"⭐⭐⭐ LEGEND"}
                  </span>
                </div>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:G.accent,marginBottom:8,textAlign:"center"}}>{tr("Clubs dans sa carrière","Clubs in career","Klubs in seiner Karriere","Club in carriera","Clubes na carreira")}</div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:0,marginBottom:12}}>
                  {dailyPlayer.clubs.map(function(club,i){
                    const [ca,cb] = getClubColors(club);
                    return (
                      <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",width:"100%",animation:`dailySlide .5s cubic-bezier(.22,1,.36,1) ${i*.12}s both`}}>
                        <div style={{borderRadius:24,overflow:"hidden",position:"relative",height:36,width:"80%",maxWidth:260,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 12px rgba(0,0,0,.5)"}}>
                          <div style={{position:"absolute",inset:0,background:ca}}/>
                          <div style={{position:"absolute",top:0,right:0,width:"55%",bottom:0,background:cb,clipPath:"polygon(30% 0%, 100% 0%, 100% 100%, 0% 100%)"}}/>
                          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.1)"}}/>
                          <span style={{position:"relative",zIndex:1,fontSize:12,fontWeight:800,color:"#fff",padding:"0 16px",textShadow:"0 1px 4px rgba(0,0,0,.7)"}}>{getClubDisplayName(club)}</span>
                        </div>
                        {i < dailyPlayer.clubs.length - 1 && (
                          <div style={{display:"flex",flexDirection:"column",alignItems:"center",margin:"1px 0"}}>
                            <div style={{width:2,height:5,background:G.accent,borderRadius:1,opacity:.6}}/>
                            <div style={{fontSize:12,color:G.accent,lineHeight:1}}>▼</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              )}

              {/* Tentatives */}
              {dailyTries > 0 && !dailySuccess && (
                <div style={{textAlign:"center",marginBottom:12}}>
                  <span style={{fontSize:13,color:"rgba(255,255,255,.4)",fontWeight:700}}>{dailyTries>1?tr("Tentatives","Attempts","Versuche","Tentativi","Tentativas"):tr("Tentative","Attempt","Versuch","Tentativo","Tentativa")} : {dailyTries}</span>
                </div>
              )}

              {/* Bravo ou input */}
              {dailySuccess ? (
                <div style={{textAlign:"center",padding:"16px 0",flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                  <div style={{fontSize:72,marginBottom:12}}>🎉</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,.5)",fontWeight:600,letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>
                    {tr("La réponse était","The answer was","Die Antwort war","La risposta era","A resposta era")}
                  </div>
                  <div style={{fontFamily:G.heading,fontSize:"clamp(32px,9vw,54px)",color:"#00E676",letterSpacing:1,marginBottom:14,lineHeight:1.1,padding:"0 10px"}}>
                    {dailyPlayer.name}
                  </div>
                  <div style={{fontSize:16,color:"rgba(255,255,255,.7)",fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:6}}>
                    {pickResultMessage(RESULT_MESSAGES[(lang==="fr"?"fr":"en")].soloWin, dailyTries * 7 + (dailyPlayer?.name?.length||0))}
                  </div>
                  <div style={{fontSize:14,color:"rgba(255,255,255,.4)",marginTop:4,marginBottom:24}}>
                    {dailyTries === 1 ? (tr("Trouvé du premier coup 🐐","Got it first try 🐐","Beim ersten Versuch 🐐","Indovinato al primo colpo 🐐","Acertou de primeira 🐐")) : (tr("Trouvé en ","Found in ","Gefunden in ","Trovato in ","Encontrado em ")+dailyTries+" "+(dailyTries>1?tr("essais","attempts","Versuchen","tentativi","tentativas"):tr("essai","attempt","Versuch","tentativo","tentativa")))}
                  </div>

                  {/* Bouton de partage style Wordle */}
                  <button onClick={async function(){
                    const share = buildDailyShare();
                    try {
                      if (navigator.share) {
                        await navigator.share({ title: share.title || "GOAT FC", text: share.text });
                        setDailyShared(true);
                        setTimeout(() => setDailyShared(false), 2500);
                      } else {
                        await navigator.clipboard.writeText(share.text);
                        setDailyShared(true);
                        setTimeout(() => setDailyShared(false), 2500);
                      }
                    } catch(e) {
                      // Utilisateur a annulé le partage natif — on ne fait rien
                    }
                  }} style={{
                    width:"100%",maxWidth:320,
                    padding:"16px",
                    background: dailyShared ? "linear-gradient(135deg,#00E676,#00A855)" : "linear-gradient(135deg,#FFD600,#FF6B35)",
                    color:"#000",border:"none",borderRadius:50,cursor:"pointer",
                    fontFamily:G.font,fontSize:16,fontWeight:800,letterSpacing:1,
                    boxShadow: dailyShared ? "0 6px 20px rgba(0,230,118,.45)" : "0 6px 20px rgba(255,107,53,.45)",
                    display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                    transition:"all .25s"
                  }}>
                    {dailyShared
                      ? (tr("✓ COPIÉ !","✓ COPIED!","✓ KOPIERT!","✓ COPIATO!","✓ COPIADO!"))
                      : (tr("📤 PARTAGER MON RÉSULTAT","📤 SHARE MY RESULT","📤 MEIN ERGEBNIS TEILEN","📤 CONDIVIDI IL RISULTATO","📤 COMPARTILHAR RESULTADO"))}
                  </button>
                  <div style={{fontSize:11,color:"rgba(255,255,255,.35)",marginTop:10,textAlign:"center",padding:"0 20px"}}>
                    {tr("Challenge tes amis sur WhatsApp, Insta, X...","Challenge your friends on WhatsApp, Insta, X...","Fordere deine Freunde auf WhatsApp, Insta, X heraus...","Sfida i tuoi amici su WhatsApp, Insta, X...","Desafie seus amigos no WhatsApp, Insta, X...")}
                  </div>
                </div>
              ) : dailyRevealed ? (
                <div style={{textAlign:"center",padding:"16px 0",flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                  <div style={{fontSize:72,marginBottom:12}}>👁️</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,.5)",fontWeight:600,letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>
                    {tr("La réponse était","The answer was","Die Antwort war","La risposta era","A resposta era")}
                  </div>
                  <div style={{fontFamily:G.heading,fontSize:"clamp(32px,9vw,54px)",color:"#60a5fa",letterSpacing:1,marginBottom:14,lineHeight:1.1,padding:"0 10px"}}>
                    {dailyPlayer.name}
                  </div>
                  <div style={{fontSize:14,color:"rgba(255,255,255,.5)",marginTop:4,marginBottom:28,maxWidth:300,lineHeight:1.5}}>
                    {tr("Reviens demain pour un nouveau défi !","Come back tomorrow for a new challenge!","Komm morgen für eine neue Challenge wieder!","Torna domani per una nuova sfida!","Volte amanhã para um novo desafio!")}
                  </div>
                  <button onClick={function(){setShowDailyGame(false);}} style={{
                    width:"100%",maxWidth:320,padding:"16px",
                    background:"rgba(255,255,255,.08)",color:G.white,
                    border:"1px solid rgba(255,255,255,.2)",borderRadius:50,cursor:"pointer",
                    fontFamily:G.font,fontSize:15,fontWeight:800,letterSpacing:1
                  }}>
                    {tr("FERMER","CLOSE","SCHLIESSEN","CHIUDI","FECHAR")}
                  </button>
                </div>
              ) : (
                <>
                  <div style={{position:"relative",marginBottom:8}}>
                    <input
                      value={dailyGuess}
                      onChange={function(e){setDailyGuess(e.target.value);setDailyFlash(null);}}
                      onKeyDown={function(e){if(e.key==="Enter") handleDailySubmit();}}
                      placeholder={tr("Nom du joueur...","Player name...","Spielername...","Nome del giocatore...","Nome do jogador...")}
                      autoComplete="off"
                      style={{width:"100%",background:dailyFlash==="ko"?"rgba(255,61,87,.15)":"rgba(255,255,255,.08)",border:"2px solid "+(dailyFlash==="ko"?"#FF3D57":"rgba(255,255,255,.2)"),borderRadius:18,padding:"18px",fontFamily:G.font,fontSize:19,fontWeight:700,color:"#ffffff",outline:"none",textAlign:"center",transition:"all .2s",boxSizing:"border-box"}}
                    />
                    {dailyGuess.length>=3&&!dailyFlash&&(()=>{
                      const norm=s=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
                      const q=norm(dailyGuess);
                      const matched=PLAYERS_CLEAN.filter(p=>p&&p.name&&norm(p.name).includes(q));const sugg=matched.sort((a,b)=>{const an=norm(a.name),bn=norm(b.name);const aStarts=an.startsWith(q),bStarts=bn.startsWith(q);if(aStarts!==bStarts)return aStarts?-1:1;const aWord=an.split(" ").some(w=>w.startsWith(q)),bWord=bn.split(" ").some(w=>w.startsWith(q));if(aWord!==bWord)return aWord?-1:1;const ord={facile:0,moyen:1,expert:2};if(a.diff!==b.diff)return ord[a.diff]-ord[b.diff];return a.name.localeCompare(b.name);}).slice(0,5);
                      if(!sugg.length) return null;
                      return (<div style={{position:"absolute",top:"100%",left:0,right:0,background:"rgba(25,35,25,.98)",border:"1px solid rgba(255,255,255,.15)",borderRadius:14,boxShadow:"0 8px 24px rgba(0,0,0,.5)",zIndex:100,overflow:"hidden",marginTop:4,backdropFilter:"blur(12px)"}}>
                        {sugg.map(p=>(<div key={p.name} onClick={function(){setDailyGuess(p.name);handleDailySubmit(p.name);}} style={{padding:"14px 18px",fontFamily:G.font,fontSize:15,fontWeight:700,color:"#fff",cursor:"pointer",borderBottom:"1px solid rgba(255,255,255,.08)",textAlign:"left"}}>{p.name}</div>))}
                      </div>);
                    })()}
                  </div>
                  {dailyFlash==="ko" && <div style={{textAlign:"center",fontSize:13,color:"#FF3D57",marginBottom:8,fontWeight:700}}>{tr("Ce n'est pas ça... réessaie !","That's not it... try again!","Das ist es nicht... versuch's nochmal!","Non è quello... riprova!","Não é isso... tente de novo!")}</div>}

                  {/* Hints display */}
                  {dailyHintLevel >= 1 && (
                    <div style={{background:"#123a1e",border:"1px solid rgba(96,165,250,.5)",borderRadius:14,padding:"12px 14px",marginBottom:8,display:"flex",flexDirection:"column",gap:6}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:16}}>💡</span>
                        <span style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"#60a5fa"}}>{tr("Indice","Hint","Tipp","Indizio","Dica")} {dailyHintLevel}/2</span>
                      </div>
                      <div style={{fontSize:13,color:"#fff",lineHeight:1.5}}>
                        <strong>{tr("Poste : ","Position: ","Position: ","Ruolo: ","Posição: ")}</strong> {dailyHintData.position || "..."}
                      </div>
                      {dailyHintLevel >= 2 && (
                        <div style={{fontSize:13,color:"#fff",lineHeight:1.5}}>
                          <strong>{tr("Nationalité : ","Nationality: ","Nationalität: ","Nazionalità: ","Nacionalidade: ")}</strong> {dailyHintData.nationality || "..."}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Hint button */}
                  {dailyHintLevel < 2 && (() => {
                    // Coût du 1er indice = différence entre points normaux et points avec indice (10)
                    const pd = dailyPlayer.diff || "moyen";
                    const basePoints = pd==="expert"?50:pd==="moyen"?35:20;
                    const firstHintCost = basePoints - 10; // ce que tu perds en prenant le 1er indice
                    return (
                      <button onClick={fetchHint} disabled={dailyHintData.loading} style={{width:"100%",padding:"12px",background:"rgba(96,165,250,.08)",color:"#60a5fa",border:"1px solid rgba(96,165,250,.3)",borderRadius:50,cursor:dailyHintData.loading?"not-allowed":"pointer",fontFamily:G.font,fontSize:13,fontWeight:700,marginBottom:10,opacity:dailyHintData.loading?0.5:1}}>
                        {dailyHintData.loading ? (tr("Chargement...","Loading...","Wird geladen...","Caricamento...","Carregando...")) : (dailyHintLevel === 0 ? (tr("💡 Voir le poste (−","💡 Show position (−","💡 Position zeigen (−","💡 Mostra il ruolo (−","💡 Ver a posição (−")+firstHintCost+" pts)") : (tr("💡 Voir la nationalité (gratuit)","💡 Show nationality (free)","💡 Nationalität zeigen (gratis)","💡 Mostra nazionalità (gratis)","💡 Ver nacionalidade (grátis)")))}
                      </button>
                    );
                  })()}
                  <div style={{display:"flex",gap:10,marginTop:8}}>
                    <button onClick={handleDailySubmit} style={{flex:1,padding:"16px",background:"linear-gradient(135deg,#FFD600,#FF6B35)",color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:16,fontWeight:800}}>
                      {tr("Valider ✓","Submit ✓","Bestätigen ✓","Conferma ✓","Enviar ✓")}
                    </button>
                  </div>
                  {/* Voir la réponse (sans pénalité ni récompense) */}
                  <button onClick={function(){setShowRevealConfirm(true);}} style={{width:"100%",marginTop:10,padding:"11px",background:"transparent",color:"rgba(255,255,255,.5)",border:"1px solid rgba(255,255,255,.15)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:12,fontWeight:700,letterSpacing:.3}}>
                    👁️ {tr("Voir la réponse (0 pt)","Reveal answer (0 pts)","Antwort zeigen (0 Pkt)","Rivela la risposta (0 pt)","Revelar resposta (0 pts)")}
                  </button>
                  {/* Signaler une erreur sur le défi */}
                  <button onClick={function(){setShowDailyReportConfirm(true);}} style={{width:"100%",marginTop:8,padding:"8px",background:"transparent",color:"rgba(255,255,255,.3)",border:"none",cursor:"pointer",fontFamily:G.font,fontSize:11,fontWeight:600,textDecoration:"underline",letterSpacing:.2}}>
                    ⚠️ {tr("Signaler une erreur sur ce défi","Report an error with this challenge","Fehler bei dieser Challenge melden","Segnala un errore in questa sfida","Reportar um erro neste desafio")}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Modal confirmation "Voir la réponse" */}
        {showRevealConfirm && dailyPlayer && (
          <div onClick={function(){setShowRevealConfirm(false);}} style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,.85)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,cursor:"pointer"}}>
            <div onClick={function(e){e.stopPropagation();}} style={{background:"rgba(15,25,15,.96)",borderRadius:24,padding:"28px 24px",maxWidth:340,width:"100%",border:"1px solid rgba(255,255,255,.1)",textAlign:"center",cursor:"default"}}>
              <div style={{fontSize:42,marginBottom:12}}>👁️</div>
              <div style={{fontFamily:G.heading,fontSize:24,color:G.white,letterSpacing:1,marginBottom:8}}>{tr("VOIR LA RÉPONSE ?","REVEAL ANSWER?","ANTWORT ZEIGEN?","RIVELARE LA RISPOSTA?","REVELAR RESPOSTA?")}</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,.55)",marginBottom:22,lineHeight:1.5}}>
                {lang==="de"?<>Du siehst die Antwort, bekommst heute aber <strong style={{color:G.white}}>0 Punkte</strong>. Deine Serie bleibt nicht erhalten.</>:lang==="it"?<>Vedrai la risposta ma guadagni <strong style={{color:G.white}}>0 punti</strong> oggi. La tua serie non sarà mantenuta.</>:lang==="pt"?<>Você verá a resposta mas ganha <strong style={{color:G.white}}>0 pontos</strong> hoje. Sua sequência não será mantida.</>:lang==="en"?<>You'll see the answer but earn <strong style={{color:G.white}}>0 points</strong> today. Your streak won't be maintained.</>:<>Tu verras la réponse mais tu gagnes <strong style={{color:G.white}}>0 point</strong>. Ta série ne sera pas maintenue.</>}
              </div>
              <div style={{display:"flex",gap:10}}>
                <button onClick={function(){setShowRevealConfirm(false);}} style={{flex:1,padding:"13px",background:"rgba(255,255,255,.07)",color:G.white,border:"1px solid rgba(255,255,255,.1)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>
                  {tr("Annuler","Cancel","Abbrechen","Annulla","Cancelar")}
                </button>
                <button onClick={handleRevealDaily} style={{flex:1,padding:"13px",background:"rgba(96,165,250,.2)",color:"#60a5fa",border:"1px solid rgba(96,165,250,.4)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800}}>
                  {tr("👁️ Voir","👁️ Reveal","👁️ Zeigen","👁️ Rivela","👁️ Revelar")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal confirmation "Signaler une erreur" sur le défi du jour */}
        {showDailyReportConfirm && dailyPlayer && (
          <div onClick={function(){if(!dailyReportSent)setShowDailyReportConfirm(false);}} style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,.85)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,cursor:"pointer"}}>
            <div onClick={function(e){e.stopPropagation();}} style={{background:"rgba(15,25,15,.96)",borderRadius:24,padding:"28px 24px",maxWidth:340,width:"100%",border:"1px solid rgba(255,255,255,.1)",textAlign:"center",cursor:"default"}}>
              {dailyReportSent ? (
                <>
                  <div style={{fontSize:42,marginBottom:12}}>✅</div>
                  <div style={{fontFamily:G.heading,fontSize:22,color:G.accent,letterSpacing:1,marginBottom:8}}>{tr("MERCI !","THANK YOU!","DANKE!","GRAZIE!","OBRIGADO!")}</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,.55)",marginBottom:22,lineHeight:1.5}}>
                    {tr("Ton signalement a été envoyé. On corrige ça au plus vite.","Your report has been sent. We'll fix it as soon as possible.","Deine Meldung wurde gesendet. Wir beheben es so schnell wie möglich.","La tua segnalazione è stata inviata. La correggeremo il prima possibile.","Seu reporte foi enviado. Vamos corrigir o quanto antes.")}
                  </div>
                  <button onClick={function(){setShowDailyReportConfirm(false);setDailyReportSent(false);}} style={{width:"100%",padding:"13px",background:"rgba(0,230,118,.15)",color:G.accent,border:"1px solid rgba(0,230,118,.3)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800}}>
                    OK
                  </button>
                </>
              ) : (
                <>
                  <div style={{fontSize:42,marginBottom:12}}>⚠️</div>
                  <div style={{fontFamily:G.heading,fontSize:24,color:G.white,letterSpacing:1,marginBottom:8}}>{tr("SIGNALER UNE ERREUR ?","REPORT AN ERROR?","FEHLER MELDEN?","SEGNALARE UN ERRORE?","REPORTAR UM ERRO?")}</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,.55)",marginBottom:22,lineHeight:1.5}}>
                    {lang==="de"?<>Wenn <strong style={{color:G.white}}>{dailyPlayer.name}</strong> fehlende Klubs oder falsche Infos hat, tippe auf Melden. Bei genügend Meldungen wird der Spieler automatisch ausgeschlossen.</>:lang==="it"?<>Se <strong style={{color:G.white}}>{dailyPlayer.name}</strong> ha club mancanti o informazioni errate, tocca Segnala. Se abbastanza utenti segnalano, il giocatore sarà escluso automaticamente.</>:lang==="pt"?<>Se <strong style={{color:G.white}}>{dailyPlayer.name}</strong> tem clubes faltando ou informações incorretas, toque em Reportar. Se usuários suficientes reportarem, o jogador será excluído automaticamente.</>:lang==="en"?<>If <strong style={{color:G.white}}>{dailyPlayer.name}</strong> has missing clubs or incorrect information, tap Report. If enough users report, the player will be automatically excluded.</>:<>Si <strong style={{color:G.white}}>{dailyPlayer.name}</strong> a des clubs manquants ou des infos fausses, tape Signaler. Si assez d'users signalent, le joueur sera automatiquement exclu.</>}
                  </div>
                  <div style={{display:"flex",gap:10}}>
                    <button onClick={function(){setShowDailyReportConfirm(false);}} style={{flex:1,padding:"13px",background:"rgba(255,255,255,.07)",color:G.white,border:"1px solid rgba(255,255,255,.1)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>
                      {tr("Annuler","Cancel","Abbrechen","Annulla","Cancelar")}
                    </button>
                    <button onClick={async function(){
                      try {
                        await sbFetch("bb_reports", {
                          method:"POST",
                          headers:{"Content-Type":"application/json","Prefer":"return=minimal"},
                          body: JSON.stringify({
                            reporter_id: playerId,
                            reporter_name: playerName || null,
                            report_type: "daily_bug",
                            player_name: dailyPlayer.name,
                            message: "Défi du jour signalé — "+(dailyPlayer.clubs||[]).join("|")
                          })
                        });
                      } catch(e) {}
                      setDailyReportSent(true);
                    }} style={{flex:1,padding:"13px",background:"rgba(255,61,87,.2)",color:"#FF3D57",border:"1px solid rgba(255,61,87,.4)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800}}>
                      ⚠️ {tr("Signaler","Report","Melden","Segnala","Reportar")}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Multijoueur - rejoindre */}
        <div style={{background:"#0B2213",border:G.trait,boxShadow:G.ombre,borderRadius:G.rayon,padding:"14px 14px 12px"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <span style={{fontSize:18}}>👥</span>
            <div>
              <div style={{...posterText(16,G.white),transformOrigin:"left"}}>{tr("Joue avec tes potes !","Play with friends!","Spiel mit deinen Freunden!","Gioca con i tuoi amici!","Jogue com seus amigos!")}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.55)",fontWeight:700,marginTop:2}}>{tr("Crée une salle ou rejoins avec un code","Create a room or join with a code","Erstelle einen Raum oder tritt per Code bei","Crea una stanza o entra con un codice","Crie uma sala ou entre com um código")}</div>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <input value={roomInput} onChange={function(e){setRoomInput(e.target.value.toUpperCase());setRoomMsg("");}}
              placeholder={tr("Code salle","Room code","Raumcode","Codice stanza","Código da sala")} maxLength={6}
              style={{flex:1,padding:"10px 12px",borderRadius:G.rayonS,border:G.trait,background:"#061007",color:G.white,fontFamily:G.font,fontSize:14,fontWeight:700,letterSpacing:3,textTransform:"uppercase",outline:"none"}}/>
            <button onClick={function(){requirePseudo(async function(){
              const code = (roomInput||"").trim().toUpperCase();
              if (code.length !== 6) { setRoomMsg(tr("Code invalide","Invalid code","Ungültiger Code","Codice non valido","Código inválido")); return; }
              setRoomMsg("");
              // Étape 0 : salon GOAT DUEL (Plug temps réel) ?
              try {
                const dRoom = await sbFetch("bb_duel_rooms?code=eq."+code+"&limit=1");
                if (Array.isArray(dRoom) && dRoom.length > 0) {
                  setRoomInput(""); setDuelError(""); setDuelJoinCode(code);
                  setDuelScreen("menu");
                  duelJoinRoom(code);
                  return;
                }
              } catch (e) {
                // pas un salon duel → on continue
              }
              // Étape 1 : essayer en priorité une room GOAT BATTLE
              try {
                const ggRoom = await sbFetch("bb_gg_rooms?code=eq."+code+"&limit=1");
                if (Array.isArray(ggRoom) && ggRoom.length > 0) {
                  // C'est une room Battle → ouvrir le menu battle puis rejoindre
                  setGgBattleCode(code);
                  setGgBattleScreen("menu");
                  setRoomInput("");
                  // Petit délai pour que le state du menu se monte avant de join
                  setTimeout(function(){ ggBattleJoinRoom(code); }, 100);
                  return;
                }
              } catch (e) {
                // Si erreur, on tombe sur le fallback Plug/Mercato
              }
              // Étape 2 : fallback Plug/Mercato
              joinRoom(code);
            });}} style={{padding:"10px 16px",...btn(G.projecteur)}}>{tr("Rejoindre","Join","Beitreten","Entra","Entrar")}</button>
          </div>
        </div>
        {roomMsg && <div style={{fontSize:12,color:"#FF3D57",fontWeight:700,marginTop:-4}}>{roomMsg}</div>}
        {/* Actions */}
        <div style={{display:"flex",gap:8}}>
          <button onClick={function(){loadLeaderboard(lbMode);setShowLeaderboard(true);}} style={{flex:1,...btn(G.pelouse,G.encre)}}>
            {Icon.trophy(14,G.encre)} {tr("Classement","Leaderboard","Rangliste","Classifica","Classificação")}
          </button>
          <button onClick={function(){requirePseudo(function(){setShowFriends(true);loadFriends().then(function(ids){fetchFriendScores(ids);});loadDuels();loadFriendRequests();});}} style={{flex:1,...btn("#0B2213",G.white),justifyContent:"center",gap:6,position:"relative"}}>
            <span style={{WebkitTextStroke:0,textShadow:"none",fontSize:15,lineHeight:1}}>👥</span> {tr("Amis","Friends","Freunde","Amici","Amigos")}{friendRequests.length>0&&<span style={{position:"absolute",top:-4,right:-4,background:"#FF3D57",color:"#fff",borderRadius:"50%",width:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900}}>{friendRequests.length}</span>}
          </button>
        </div>

        {/* Défis ouverts (salon de duels asynchrones) */}
        <button onClick={function(){requirePseudo(function(){setOpenTab("browse");setOpenDuelChooser(false);loadOpenDuels();loadMyOpenDuels();loadReceivedChallenges();setShowOpenDuels(true);});}}
          style={{position:"relative",display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:G.maillot,border:G.trait,boxShadow:G.ombre,borderRadius:G.rayon,cursor:"pointer",width:"100%",textAlign:"left"}}>
          <div style={{width:28,height:28,borderRadius:"50%",background:G.projecteur,border:G.traitFin,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>⚔️</div>
          <div style={{flex:1}}>
            <div style={{...posterText(16,G.white),transformOrigin:"left"}}>{tr("Défis ouverts ⚔️","Open challenges ⚔️","Offene Duelle ⚔️","Sfide aperte ⚔️","Desafios abertos ⚔️")}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.82)",fontWeight:800,marginTop:2}}>{openUnseenCount>0?tr(openUnseenCount+" tentative"+(openUnseenCount>1?"s":"")+" sur tes défis !", openUnseenCount+" new attempt"+(openUnseenCount>1?"s":"")+" on your challenges!", openUnseenCount+(openUnseenCount>1?" neue Versuche":" neuer Versuch")+" auf deine Duelle!", openUnseenCount+(openUnseenCount>1?" nuovi tentativi":" nuovo tentativo")+" sulle tue sfide!", openUnseenCount+(openUnseenCount>1?" novas tentativas":" nova tentativa")+" nos seus desafios!"):tr("Bats les scores des autres — ou lance le tien","Beat other players' scores — or post yours","Schlag die Scores der anderen — oder poste deinen","Batti i punteggi degli altri — o lancia il tuo","Supere as pontuações dos outros — ou lance a sua")}</div>
          </div>
          {(openUnseenCount+receivedChallenges.length)>0 && <span style={{position:"absolute",top:8,right:28,background:"#FF3D57",color:"#fff",borderRadius:"50%",minWidth:18,height:18,padding:"0 5px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900}}>{openUnseenCount+receivedChallenges.length}</span>}
          <span style={{fontSize:16,color:"rgba(255,255,255,.85)",fontWeight:900}}>›</span>
        </button>

        {/* GOAT BATTLE (grille 3×3 multijoueur) n'a pas de bouton dédié ici :
            il vit sous la carte GOAT GRID du carrousel, via le modal
            ggModeChoice qui propose Solo ou Battle. Un bouton séparé faisait
            doublon visuel avec la carte du carrousel, dont le visuel s'appelle
            aussi « GOAT BATTLE » alors qu'elle ouvre le duel Plug 1v1. */}

        {/* Duel en direct : désormais une carte du carrousel (plus de bouton en bas) */}

        {/* Footer discret : version + liens légaux */}
        <div style={{textAlign:"center",padding:"8px 0 2px",fontSize:10,color:"rgba(255,255,255,.3)",letterSpacing:1.5,flexShrink:0}}>
          GOAT FC · <a href="/privacy/" target="_blank" rel="noopener noreferrer" style={{color:"rgba(255,255,255,.45)",textDecoration:"underline"}}>{tr("Confidentialité","Privacy","Datenschutz","Privacy","Privacidade")}</a> · <a href="/terms/" target="_blank" rel="noopener noreferrer" style={{color:"rgba(255,255,255,.45)",textDecoration:"underline"}}>{tr("Conditions","Terms","Bedingungen","Termini","Termos")}</a>
        </div>

      </div>
      {openDuelsModal}
      {duelOverlay}
      {openNotifBanner}
    </div>
  );


  if(screen==="game"&&cur) {
    const [ca1,cb1]=getClubColors(cur.c1);
    const [ca2,cb2]=getClubColors(cur.c2);
    const tc1=textColor(ca1); const tc2=textColor(ca2);
    return (
      <div style={{...shell,animation:"fadeIn .2s ease",overflow:isDesktop?"visible":"auto"}} key={"game-"+currentRound}>
        <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        {/* Bandes pelouse */}
        {[0,1,2,3,4,5,6].map(function(i){return(
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#0E1F14":"#132819"}}/>
        );})}
        {/* Ligne médiane */}
        <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
        {/* Cercle central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
        {/* Point central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:8,height:8,borderRadius:"50%",background:"rgba(255,255,255,.2)"}}/>
        {/* Overlay sombre pour lisibilité */}
        <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
      </div>
        {showQuitConfirm && (
        <div style={{position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,.85)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"rgba(15,25,15,.95)",borderRadius:24,padding:"28px 24px",maxWidth:320,width:"calc(100% - 32px)",border:"1px solid rgba(255,255,255,.1)",textAlign:"center"}}>
            <div style={{fontSize:40,marginBottom:12}}>🏳️</div>
            <div style={{fontFamily:G.heading,fontSize:26,color:G.white,marginBottom:8}}>{tr("ABANDONNER ?","QUIT?","AUFGEBEN?","ABBANDONARE?","DESISTIR?")}</div>
            <div style={{fontSize:14,color:"rgba(255,255,255,.5)",marginBottom:24}}>
              {activeDuel ? (tr("Ton adversaire sera déclaré vainqueur.","Your opponent will be declared the winner.","Dein Gegner wird zum Sieger erklärt.","Il tuo avversario sarà dichiarato vincitore.","Seu adversário será declarado vencedor.")) : (tr("Ta partie sera perdue et ton score sera de 0.","Your game will be lost and your score will be 0.","Dein Spiel geht verloren und dein Score ist 0.","La tua partita sarà persa e il punteggio sarà 0.","Seu jogo será perdido e sua pontuação será 0."))}
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={function(){setShowQuitConfirm(false);}} style={{flex:1,padding:"13px",background:"rgba(255,255,255,.07)",color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>{tr("Continuer","Continue","Weiter","Continua","Continuar")}</button>
              <button onClick={async function(){
                setShowQuitConfirm(false);
                clearInterval(timerRef.current);
                clearInterval(qTimerRef.current);
                if(activeDuelRef.current&&activeDuelRef.current.isRoom){ await abandonRoom(); /* navigation gérée par abandonRoom → showRoomResults ou polling */ }
                else if(activeDuel){ abandonDuel(); setScreen("home"); }
                else { setScreen("home"); }
              }} style={{flex:1,padding:"13px",background:"#FF3D57",color:"#fff",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>{tr("Abandonner","Quit","Aufgeben","Abbandona","Desistir")}</button>
            </div>
          </div>
        </div>
      )}

        {floatingPoints}
        {/* Screen flash */}
        <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:10,animation:feedback==="ok"?"flashOk .6s ease":feedback==="ko"?"flashKo .6s ease":"none"}}/>

        {/* Onomatopée comic quand on passe une question (surgit en gros, repart aussitôt) */}
        {skipOno && (
          <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:60,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{fontFamily:G.heading,fontSize:"clamp(64px,20vw,150px)",lineHeight:1,color:"#FFD600",WebkitTextStroke:"3px rgba(0,0,0,.55)",textShadow:"0 6px 0 rgba(0,0,0,.35),0 0 34px rgba(255,214,0,.5)",animation:"onoPop .85s cubic-bezier(.2,.8,.3,1) forwards"}}>{skipOno}</div>
          </div>
        )}

        {/* Notification abandon en salle */}
        {abandonNotif && (
          <div style={{position:"fixed",top:60,left:16,right:16,zIndex:20,
            background:"rgba(255,214,0,.95)",backdropFilter:"blur(8px)",
            borderRadius:14,padding:"10px 16px",textAlign:"center",
            fontSize:13,fontWeight:800,color:"#000",
            boxShadow:"0 4px 20px rgba(255,214,0,.4)",
            animation:"slideDown .4s cubic-bezier(.22,1,.36,1)"}}>
            {abandonNotif}
          </div>
        )}
        <div style={{zIndex:3,padding:"12px 16px 0",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexShrink:0}}>
          {backBtn(()=>{setShowQuitConfirm(true);})}
          <div style={{background:"rgba(255,255,255,.13)",backdropFilter:"blur(10px)",borderRadius:18,padding:"8px 18px",display:"flex",alignItems:"center",gap:8,position:"relative"}}>
            {comboDisplay}
            <span style={{fontSize:11,color:"rgba(255,255,255,.4)",fontWeight:700,letterSpacing:1}}>M{currentRound}/{totalRounds}</span>
            {scoreDisplay(score,scoreAnim)}
            <span style={{fontSize:11,color:"rgba(255,255,255,.5)",fontWeight:600}}>pts</span>
          </div>
          {timerCircle()}
          {record?<div style={{background:"rgba(255,255,255,.13)",backdropFilter:"blur(10px)",borderRadius:18,padding:"8px 14px",display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:13}}>🏆</span><span style={{fontFamily:G.heading,fontSize:22,color:G.gold}}>{record.score}</span></div>:<div style={{width:70}}/>}
        </div>

        {/* CRESCENDO BADGE — Plug mode */}
        {(activeDuelRef.current && activeDuelRef.current.isRoom ? activeDuelRef.current.diff : diff) === "expert" && (() => {
          // Au Plug, on calcule le palier selon qIdx (0-9 facile, 10-19 moyen, 20+ expert)
          const tier = qIdx < 10 ? "facile" : qIdx < 20 ? "moyen" : "expert";
          const tierColor = tier === "facile" ? "#00E676" : tier === "moyen" ? "#FFD600" : "#FF3D57";
          const tierLabel = tier === "facile" ? (tr("FACILE","EASY","LEICHT","FACILE","FÁCIL")) : tier === "moyen" ? (tr("MOYEN","MEDIUM","MITTEL","MEDIO","MÉDIO")) : (tr("EXPERT","EXPERT","EXPERTE","ESPERTO","EXPERT"));
          const tierEmoji = tier === "facile" ? "🟢" : tier === "moyen" ? "🟡" : "🔴";
          return (
            <div style={{zIndex:2,display:"flex",justifyContent:"center",padding:"0 16px 4px"}}>
              <div style={{background:`${tierColor}22`,border:`1px solid ${tierColor}55`,borderRadius:14,padding:"4px 12px",display:"flex",alignItems:"center",gap:6,backdropFilter:"blur(8px)"}}>
                <span style={{fontSize:11}}>{tierEmoji}</span>
                <span style={{fontSize:10,fontWeight:800,letterSpacing:2,color:tierColor}}>📈 CRESCENDO · {tierLabel}</span>
              </div>
            </div>
          );
        })()}

        {/* Club cards — full height */}
        <div key={"clubs-"+animKey} style={{flex:1,display:"flex",flexDirection:"column",gap:0,padding:"10px 0 0",zIndex:1,minHeight:0}}>
          {/* Club 1 */}
          <div style={{flex:1,margin:"0 14px 0 14px",borderRadius:28,position:"relative",overflow:"hidden",boxShadow:"0 12px 40px "+ca1+"55",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",animation:"clubSlideLeft .55s cubic-bezier(.22,1,.36,1)",animationFillMode:"both"}}>
            {/* Fond diagonal club 1 */}
            <div style={{position:"absolute",inset:0,background:ca1}}/>
            <div style={{position:"absolute",top:0,right:0,width:"55%",bottom:0,background:cb1,clipPath:"polygon(30% 0%, 100% 0%, 100% 100%, 0% 100%)"}}/>
            <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.18)"}}/>
            <div style={{position:"absolute",width:220,height:220,borderRadius:"50%",border:"3px solid rgba(255,255,255,.1)",top:-40,right:-40,pointerEvents:"none"}}/>
            <div style={{fontFamily:G.heading,fontSize:"clamp(28px,7.5vw,52px)",color:"#fff",lineHeight:1.05,textAlign:"center",padding:"0 16px",zIndex:1,textShadow:"0 3px 16px rgba(0,0,0,.6)",letterSpacing:1}}>{getClubDisplayName(cur.c1)}</div>
          </div>

          {/* VS */}
          <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:44,zIndex:2,flexShrink:0}}>
            <div style={{fontFamily:G.heading,fontSize:20,color:G.white,letterSpacing:4,background:"rgba(0,0,0,.4)",backdropFilter:"blur(12px)",borderRadius:30,padding:"5px 18px",border:"1.5px solid rgba(255,255,255,.15)",animation:"vsAppear .5s cubic-bezier(.22,1,.36,1) .3s both"}}>VS</div>
          </div>

          {/* Club 2 */}
          <div style={{flex:1,margin:"0 14px 10px 14px",borderRadius:28,position:"relative",overflow:"hidden",boxShadow:"0 12px 40px "+ca2+"55",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",animation:"clubSlideRight .55s cubic-bezier(.22,1,.36,1)",animationFillMode:"both"}}>
            {/* Fond diagonal club 2 */}
            <div style={{position:"absolute",inset:0,background:ca2}}/>
            <div style={{position:"absolute",top:0,right:0,width:"55%",bottom:0,background:cb2,clipPath:"polygon(30% 0%, 100% 0%, 100% 100%, 0% 100%)"}}/>
            <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.18)"}}/>
            <div style={{position:"absolute",width:200,height:200,borderRadius:"50%",border:"3px solid rgba(255,255,255,.1)",bottom:-30,left:-30,pointerEvents:"none"}}/>
            <div style={{fontFamily:G.heading,fontSize:"clamp(28px,7.5vw,52px)",color:"#fff",lineHeight:1.05,textAlign:"center",padding:"0 16px",zIndex:1,textShadow:"0 3px 16px rgba(0,0,0,.6)",letterSpacing:1}}>{getClubDisplayName(cur.c2)}</div>
          </div>
        </div>

        {/* Bottom sheet */}
        <div style={{...sheet,borderRadius:"28px 28px 0 0",animation:"sheetUp .45s cubic-bezier(.22,1,.36,1) .15s both",flexShrink:0,paddingTop:14,gap:10}}>
          {combo>=3&&<div style={{textAlign:"center",animation:"comboFire .5s ease"}}><span style={{background:"linear-gradient(135deg,#f59e0b,#ef4444)",color:G.white,borderRadius:20,padding:"4px 14px",fontSize:12,fontWeight:800,letterSpacing:1}}>{getComboLabel(combo)} x{combo}</span></div>}
          {feedbackBar(feedback)}

          <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div key={"opts-"+animKey} style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                {options.map((opt,oi)=>{
                  const isOk=flash==="ok"&&checkGuess(opt,cur.p);
                  const isKo=flash===opt;
                  const playerEntry = PLAYERS_CLEAN.find(p=>p.name===opt);
                  const mainClub = (playerEntry&&playerEntry.clubs&&playerEntry.clubs[0]) || "";
                  const [oca,ocb] = getClubColors(mainClub);
                  const otc = textColor(oca);
                  return(
                    <button key={opt} onClick={()=>handleOptionClick(opt)} disabled={!!flash}
                      style={{
                        padding:"22px 12px", borderRadius:20, cursor:"pointer",
                        fontFamily:G.font, fontSize:"clamp(15px,4vw,20px)", fontWeight:800,
                        lineHeight:1.25, transition:"all .15s", position:"relative", overflow:"hidden",
                        minHeight:72,
                        border: isOk?"2px solid #00E676": isKo?"2px solid #FF3D57":"none",
                        background: isOk?"#052e16": isKo?"#2d0a0a": "rgba(255,255,255,.1)",
                        color: isOk?"#00E676": isKo?G.red: G.white,
                        boxShadow: isOk?"0 0 20px rgba(74,222,128,.4)": isKo?"0 0 20px rgba(239,68,68,.3)":"none",
                        animation: isOk?"answerOk .4s ease": isKo?"answerKo .4s ease": "optionIn .4s cubic-bezier(.22,1,.36,1) "+(oi*.07)+"s both",
                      }}>
                      <div style={{display:"flex",alignItems:"center",gap:8,justifyContent:"center",position:"relative",zIndex:1}}>
                        {isOk&&<span style={{fontSize:20}}>✓</span>}
                        {isKo&&<span style={{fontSize:20}}>✗</span>}
                        <span style={{fontSize:"clamp(15px,4vw,20px)",fontWeight:800}}>{opt}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <button onClick={handlePass} disabled={!!flash} style={{padding:"12px",pointerEvents:flash?"none":"auto",background:"transparent",color:"#bbb",border:"2px solid #e5e5e0",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:700,opacity:flash ? 0.3 : 1}}>{tr("Passer → (−10 pts)","Skip → (−10 pts)","Überspringen → (−10 Pkt)","Salta → (−10 pt)","Pular → (−10 pts)")}</button>
            </div>
      {/* Timer par question supprimé — seul le timer global de la manche reste */}
    </div>
    </div>
    );
  }

  // ── CHAIN GAME ──
  if(screen==="chainGame") {
    const chainPlayerEntry = PLAYERS_CLEAN.find(p => p.name === chainPlayer);
    const chainPlayerClubs = chainPlayerEntry ? chainPlayerEntry.clubs : [];
    const chainMainClub = chainPlayerClubs[0] || "";
    const [pca, pcb] = getClubColors(chainMainClub);
    const ptc = textColor(pca);
    const chainAvailableClubs = chainPlayerClubs.filter(cl => !chainUsedClubs.has(cl));
    const [cla, clb] = chainLastClub ? getClubColors(chainLastClub) : ["#1a7a3a","#fff"];
    const clTagColor = chainLastClub ? textColor(cla) : "#fff";
    return (
    <div style={{...shell,animation:"fadeIn .3s ease",overflow:isDesktop?"visible":"auto"}} key={"chain-"+chainCount}>
      <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        {/* Bandes pelouse */}
        {[0,1,2,3,4,5,6].map(function(i){return(
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#0E1F14":"#132819"}}/>
        );})}
        {/* Ligne médiane */}
        <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
        {/* Cercle central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
        {/* Point central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:8,height:8,borderRadius:"50%",background:"rgba(255,255,255,.2)"}}/>
        {/* Overlay sombre pour lisibilité */}
        <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
      </div>
      {showQuitConfirm && (
        <div style={{position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,.85)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"rgba(15,25,15,.95)",borderRadius:24,padding:"28px 24px",maxWidth:320,width:"calc(100% - 32px)",border:"1px solid rgba(255,255,255,.1)",textAlign:"center"}}>
            <div style={{fontSize:40,marginBottom:12}}>🏳️</div>
            <div style={{fontFamily:G.heading,fontSize:26,color:G.white,marginBottom:8}}>{tr("ABANDONNER ?","QUIT?","AUFGEBEN?","ABBANDONARE?","DESISTIR?")}</div>
            <div style={{fontSize:14,color:"rgba(255,255,255,.5)",marginBottom:24}}>{tr("Ta partie sera perdue et ton score sera de 0.","Your game will be lost and your score will be 0.","Dein Spiel geht verloren und dein Score ist 0.","La tua partita sarà persa e il punteggio sarà 0.","Seu jogo será perdido e sua pontuação será 0.")}</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={function(){setShowQuitConfirm(false);}} style={{flex:1,padding:"13px",background:"rgba(255,255,255,.07)",color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>{tr("Continuer","Continue","Weiter","Continua","Continuar")}</button>
              <button onClick={async function(){setShowQuitConfirm(false);clearInterval(timerRef.current);clearInterval(qTimerRef.current);if(activeDuelRef.current&&activeDuelRef.current.isRoom){await abandonRoom();/* navigation gérée par abandonRoom */}else if(activeDuel){abandonDuel();setChainPlayer("");setScreen("home");}else{setChainPlayer("");setScreen("home");}}} style={{flex:1,padding:"13px",background:"#FF3D57",color:"#fff",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>{tr("Abandonner","Quit","Aufgeben","Abbandona","Desistir")}</button>
            </div>
          </div>
        </div>
      )}

      {floatingPoints}
      {/* 🔗 PALIER DE CHAÎNE FÊTÉ (10/20/30…) */}
      {chainMilestone && (
        <div style={{position:"fixed",inset:0,zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
          <div style={{position:"absolute",inset:0,background:`radial-gradient(circle at center, ${chainMilestone.color}40 0%, transparent 62%)`,animation:"fadeIn .2s ease"}}/>
          <div style={{position:"relative",textAlign:"center",animation:"chainMsPop .55s cubic-bezier(.22,1.4,.36,1) both"}}>
            <div style={{fontSize:76,lineHeight:1,filter:`drop-shadow(0 0 26px ${chainMilestone.color})`}}>{chainMilestone.emoji}</div>
            <div style={{fontFamily:G.heading,fontSize:"clamp(48px,15vw,72px)",color:chainMilestone.color,letterSpacing:2,lineHeight:1,marginTop:4,textShadow:`0 0 34px ${chainMilestone.color}aa`}}>{chainMilestone.n}</div>
            <div style={{fontFamily:G.heading,fontSize:20,color:G.white,letterSpacing:5,marginTop:2}}>{tr("MAILLONS","LINKS","GLIEDER","ANELLI","ELOS")}</div>
            <div style={{fontSize:13,fontWeight:800,color:"rgba(255,255,255,.9)",marginTop:12,letterSpacing:.5}}>{tr("En feu ! Continue 🔥","On fire! Keep going 🔥","Du brennst! Weiter so 🔥","Sei in fiamme! Continua 🔥","Pegando fogo! Continue 🔥")}</div>
          </div>
        </div>
      )}
      {/* Notification abandon en salle (Mercato) */}
      {abandonNotif && (
        <div style={{position:"fixed",top:60,left:16,right:16,zIndex:20,
          background:"rgba(255,214,0,.95)",backdropFilter:"blur(8px)",
          borderRadius:14,padding:"10px 16px",textAlign:"center",
          fontSize:13,fontWeight:800,color:"#000",
          boxShadow:"0 4px 20px rgba(255,214,0,.4)",
          animation:"slideDown .4s cubic-bezier(.22,1,.36,1)"}}>
          {abandonNotif}
        </div>
      )}
      <div style={{zIndex:2,padding:"12px 16px 8px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,position:"sticky",top:0}}>
        {backBtn(()=>{setShowQuitConfirm(true);})}
        <div style={{background:"rgba(255,255,255,.12)",backdropFilter:"blur(8px)",borderRadius:18,padding:"8px 14px",display:"flex",alignItems:"center",gap:8,position:"relative"}}>
          {comboDisplay}
          <span style={{fontFamily:G.heading,fontSize:30,color:G.white,display:"inline-block",animation:scoreAnim==="up"?"scoreUp .5s ease":scoreAnim==="down"?"scoreDn .5s ease":"none"}}>{chainScore}</span>
          <span style={{fontSize:11,color:"rgba(255,255,255,.5)",fontWeight:600}}>pts</span>
        </div>
        {timerCircle(64)}
        {chainRecord
          ? <div style={{background:"rgba(255,255,255,.12)",backdropFilter:"blur(8px)",borderRadius:18,padding:"8px 12px",display:"flex",alignItems:"center",gap:6}}>
              {Icon.trophy(16,G.gold)}
              <span style={{fontFamily:G.heading,fontSize:20,color:G.gold}}>{chainRecord.score}</span>
            </div>
          : <div style={{width:50}}/>
        }
      </div>

      {/* 🥕 CAROTTE DU PROCHAIN GRADE — progression live (playerXp + score en cours) */}
      {(() => {
        const live = playerXp + chainScore;
        const ng = getNextGrade(live);
        if (!ng) return null;
        const cur = getGrade(live);
        const span = ng.min - cur.min;
        const done = live - cur.min;
        const pct = Math.max(0, Math.min(100, span > 0 ? (done / span) * 100 : 0));
        const remain = Math.max(0, ng.min - live);
        const carrot = tr(`Plus que ${remain} pts avant`, `${remain} pts to`, `Noch ${remain} Pkt bis`, `Ancora ${remain} pt a`, `Faltam ${remain} pts para`);
        return (
          <div style={{zIndex:2,padding:"0 16px 6px",maxWidth:420,margin:"0 auto",width:"100%",boxSizing:"border-box"}}>
            <div style={{fontSize:10,fontWeight:800,letterSpacing:.5,color:"rgba(255,255,255,.55)",marginBottom:3,textAlign:"center"}}>{carrot} <span style={{color:ng.color}}>{ng.emoji} {ng.label}</span></div>
            <div style={{height:5,borderRadius:3,background:"rgba(255,255,255,.12)",overflow:"hidden"}}>
              <div style={{height:"100%",width:pct+"%",background:`linear-gradient(90deg, ${ng.color}, #fff)`,borderRadius:3,transition:"width .4s ease"}}/>
            </div>
          </div>
        );
      })()}

      {/* CRESCENDO BADGE — affiché uniquement en mode Crescendo (diff="expert") */}
      {(activeDuelRef.current && activeDuelRef.current.isRoom ? activeDuelRef.current.diff : diff) === "expert" && (() => {
        const tier = getCrescendoTier(chainCount);
        const tierColor = tier === "facile" ? "#00E676" : tier === "moyen" ? "#FFD600" : "#FF3D57";
        const tierLabel = tier === "facile" ? (tr("FACILE","EASY","LEICHT","FACILE","FÁCIL")) : tier === "moyen" ? (tr("MOYEN","MEDIUM","MITTEL","MEDIO","MÉDIO")) : (tr("EXPERT","EXPERT","EXPERTE","ESPERTO","EXPERT"));
        const tierEmoji = tier === "facile" ? "🟢" : tier === "moyen" ? "🟡" : "🔴";
        return (
          <div style={{zIndex:2,display:"flex",justifyContent:"center",padding:"0 16px 4px"}}>
            <div style={{background:`${tierColor}22`,border:`1px solid ${tierColor}55`,borderRadius:14,padding:"4px 12px",display:"flex",alignItems:"center",gap:6,backdropFilter:"blur(8px)"}}>
              <span style={{fontSize:11}}>{tierEmoji}</span>
              <span style={{fontSize:10,fontWeight:800,letterSpacing:2,color:tierColor}}>📈 CRESCENDO · {tierLabel}</span>
            </div>
          </div>
        );
      })()}

      {chainLastClub && (
        <div style={{zIndex:1,padding:"4px 16px",animation:"clubTagPop .4s cubic-bezier(.22,1,.36,1)"}}>
          <div style={{borderRadius:14,overflow:"hidden",position:"relative",height:36,boxShadow:`0 4px 16px ${chainLastPassed?"rgba(0,0,0,.4)":cla+"55"}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
            {chainLastPassed ? (
              <>
                <div style={{position:"absolute",inset:0,background:"linear-gradient(135deg,#3a3a3a 0%,#1a1a1a 100%)"}}/>
                <div style={{position:"relative",zIndex:1,display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:18}}>🔒</span>
                  <span style={{fontSize:13,color:"rgba(255,255,255,.7)",fontWeight:700,letterSpacing:1}}>{tr("PASSÉ","PASSED","ÜBERSPRUNGEN","SALTATO","PULADO")}</span>
                </div>
              </>
            ) : (
              <>
                <div style={{position:"absolute",inset:0,background:cla}}/>
                <div style={{position:"absolute",top:0,right:0,width:"55%",bottom:0,background:clb,clipPath:"polygon(30% 0%, 100% 0%, 100% 100%, 0% 100%)"}}/>
                <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.18)"}}/>
                <span style={{position:"relative",zIndex:1,fontSize:14,color:"#fff",fontWeight:800,textShadow:"0 1px 4px rgba(0,0,0,.5)",letterSpacing:.5}}>{chainLastClub}</span>
              </>
            )}
          </div>
        </div>
      )}

      <div key={"cp-"+chainCount} style={{
        zIndex:2, margin:"4px 16px", borderRadius:24,
        background:`linear-gradient(145deg, ${pca} 0%, ${pcb} 100%)`,
        padding:"20px", textAlign:"center",
        boxShadow:`0 12px 35px ${pca}55`,
        animation:"playerDrop .55s cubic-bezier(.22,1,.36,1)",
        position:"sticky", top:70, flexShrink:0, overflow:"hidden",
      }}>
        <div style={{position:"absolute",width:180,height:180,borderRadius:"50%",border:`2px solid ${ptc==="#FFF"?"rgba(255,255,255,.1)":"rgba(0,0,0,.06)"}`,top:-50,right:-30,pointerEvents:"none"}}/>
        <div style={{position:"absolute",width:90,height:90,borderRadius:"50%",border:`2px solid ${ptc==="#FFF"?"rgba(255,255,255,.07)":"rgba(0,0,0,.04)"}`,bottom:-20,left:10,pointerEvents:"none"}}/>
        <div style={{fontSize:10,letterSpacing:4,textTransform:"uppercase",color:ptc==="#FFF"?"rgba(255,255,255,.6)":"rgba(0,0,0,.35)",marginBottom:10,fontWeight:700,zIndex:1,position:"relative",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
          {Icon.ball(12,ptc==="#FFF"?"rgba(255,255,255,.6)":"rgba(0,0,0,.35)")} {tr("Donne un club de","Name a club of","Nenne einen Klub von","Nomina un club di","Diga um clube de")}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:14,zIndex:1,position:"relative",justifyContent:"center",flexWrap:"wrap"}}>
          <div style={{textAlign:"center"}}>
            <div style={{fontFamily:G.heading,fontSize:"clamp(18px,5vw,34px)",color:ptc==="#FFF"?"#fff":"#111",lineHeight:1.05,textShadow:ptc==="#FFF"?"0 2px 10px rgba(0,0,0,.25)":"none",letterSpacing:1}}>{chainPlayer}</div>
            {chainUsedClubs.size>0 && <div style={{fontSize:10,color:ptc==="#FFF"?"rgba(255,255,255,.55)":"rgba(0,0,0,.35)",marginTop:3,fontWeight:600}}>{chainAvailableClubs.length} {chainAvailableClubs.length!==1?tr("clubs disponibles","clubs available","Klubs verfügbar","club disponibili","clubes disponíveis"):tr("club disponible","club available","Klub verfügbar","club disponibile","clube disponível")}</div>}
          </div>
        </div>
        {combo>=3 && <div style={{marginTop:6,fontSize:12,fontWeight:800,color:ptc==="#FFF"?"#fff":"#111",animation:"comboFire .5s ease",zIndex:1,position:"relative"}}>{getComboLabel(combo)} x{combo}</div>}
      </div>

      <div style={{...sheet,marginTop:0,borderRadius:"28px 28px 0 0"}}>
        {feedbackBar(feedback)}
        <div style={{position:"relative"}}>
          <input ref={inputRef} value={guess} onChange={e=>setGuess(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleChainSubmit()}
            placeholder={tr("Nom du club...","Club name...","Klubname...","Nome del club...","Nome do clube...")} autoComplete="off"
            style={{width:"100%",background:flash==="ko"?"#fee2e2":flash==="ok"?"#dcfce7":G.offWhite,border:("2px solid "+(flash==="ko"?G.red:flash==="ok"?G.accent:"#e5e5e0")+""),borderRadius:18,padding:"16px 18px",fontFamily:G.font,fontSize:18,fontWeight:700,color:G.dark,outline:"none",textAlign:"center",transition:"all .15s",boxSizing:"border-box"}}/>
          {guess.length>=2&&!flash&&(()=>{
            const norm=s=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
            const q=norm(guess);
            // Suggérer parmi TOUS les clubs connus (aide à l'orthographe, pas d'indice sur le bon club)
            const matched=ALL_CLUBS_LIST.filter(c=>norm(c).includes(q));
            // Tri intelligent :
            // 1. startsWith d'abord (le club commence par la requête)
            // 2. puis par rang de popularité (Real Madrid avant Real Betis)
            // 3. puis alphabétique
            const sugg=matched.sort((a,b)=>{
              const aStarts=norm(a).startsWith(q), bStarts=norm(b).startsWith(q);
              if(aStarts!==bStarts) return aStarts?-1:1;
              const rankA=getClubRank(a), rankB=getClubRank(b);
              if(rankA!==rankB) return rankA-rankB;
              return a.localeCompare(b);
            }).slice(0,5);
            if(!sugg.length) return null;
            return (<div style={{position:"absolute",top:"100%",left:0,right:0,background:"#fff",border:"1px solid #e5e5e0",borderRadius:14,boxShadow:"0 8px 24px rgba(0,0,0,.15)",zIndex:100,overflow:"hidden",marginTop:4}}>
              {sugg.map(c=>(<div key={c} onClick={function(){setGuess(c);handleChainSubmit(c);}} style={{padding:"12px 16px",fontFamily:G.font,fontSize:15,fontWeight:700,color:G.dark,cursor:"pointer",borderBottom:"1px solid #f0f0f0",display:"flex",alignItems:"center",gap:10}}><ClubLogo club={c} size={22}/>{getClubDisplayName(c)}</div>))}
            </div>);
          })()}
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={handleChainPass} disabled={!!flash} style={{flex:1,padding:16,background:G.offWhite,color:"#aaa",border:"2px solid #e5e5e0",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700,opacity:flash ? 0.3 : 1}}>{tr("Passer → (−10 pts)","Skip → (−10 pts)","Überspringen → (−10 Pkt)","Salta → (−10 pt)","Pular → (−10 pts)")}</button>
          <button onClick={handleChainSubmit} style={{flex:2,padding:"16px",background:G.dark,color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:16,fontWeight:800}}>{tr("Valider","Submit","Bestätigen","Conferma","Enviar")}</button>
        </div>
        {/* Signaler une erreur : apparaît quand un club vient d'être refusé */}
        {chainLastRejected && (
          <div style={{marginTop:4,padding:10,background:"rgba(255,107,53,.1)",border:"1px solid rgba(255,107,53,.3)",borderRadius:12}}>
            {chainReportSent ? (
              <div style={{textAlign:"center",fontSize:12,color:"#1a9e5c",fontWeight:800,padding:4}}>✅ {tr("Merci ! On va vérifier.","Thanks! We'll check it.","Danke! Wir prüfen es.","Grazie! Controlleremo.","Obrigado! Vamos verificar.")}</div>
            ) : (
              <>
                <div style={{fontSize:12,color:"#555",marginBottom:8,textAlign:"center",fontWeight:600}}>
                  <strong style={{color:"#FF6B35"}}>{getClubDisplayName(chainLastRejected.club)}</strong> {tr("refusé pour","refused for","abgelehnt für","rifiutato per","recusado para")} <strong style={{color:"#FF6B35"}}>{chainLastRejected.player}</strong> ?
                </div>
                <button onClick={async function(){
                  try {
                    await sbFetch("bb_reports", {
                      method:"POST",
                      headers:{"Content-Type":"application/json","Prefer":"return=minimal"},
                      body: JSON.stringify({
                        reporter_id: playerId,
                        reporter_name: playerName || null,
                        report_type: "chain_missed",
                        c1: chainLastRejected.player,
                        c2: chainLastRejected.club,
                        given_answer: chainLastRejected.club,
                        player_name: chainLastRejected.player,
                        message: "THE MERCATO: le joueur affirme que ce club est correct pour ce joueur"
                      })
                    });
                  } catch(e) {}
                  setChainReportSent(true);
                }} style={{width:"100%",padding:"9px",background:"#FF6B35",color:"#fff",border:"none",borderRadius:10,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:800}}>🚩 {tr("Signaler une erreur","Report error","Fehler melden","Segnala un errore","Reportar erro")}</button>
              </>
            )}
          </div>
        )}
        {chainHistory.length>0 && (
          <div style={{maxHeight:200,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"#ccc",textAlign:"center"}}>The Mercato</div>
            {[...chainHistory].reverse().map((h,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 12px",background:G.offWhite,borderRadius:12,animation:`slideIn .3s ease ${i*.04}s both`,opacity:h.passed ? 0.7 : 1}}>
                <span style={{fontSize:10,color:"#bbb",fontWeight:700,minWidth:18}}>{i+1}.</span>
                <span style={{fontSize:12,color:G.dark,fontWeight:700,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.player}</span>
                <span style={{display:"flex",alignItems:"center",flexShrink:0}}>{Icon.transfer(11,"#ccc")}</span>
                {h.passed ? (
                  <span style={{display:"flex",alignItems:"center",gap:4,flexShrink:0,fontSize:14}}>🔒</span>
                ) : (
                  <span style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}}><ClubLogo club={h.club} size={18}/><span style={{fontSize:12,color:G.bg,fontWeight:700}}>{getClubDisplayName(h.club)}</span></span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Timer par question supprimé — seul le timer global de la manche reste */}
    </div>
    );
  }


  // ── CHAIN GAME TIMER BAR (injected via CSS position:fixed, already in game screen) ──
  // ── ROUND END ──
  if(screen==="roundEnd") return (
    <div style={{...shell,animation:"fadeUp .4s ease",overflow:isDesktop?"visible":"auto"}} key="roundEnd">
      <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        {/* Bandes pelouse */}
        {[0,1,2,3,4,5,6].map(function(i){return(
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#0E1F14":"#132819"}}/>
        );})}
        {/* Ligne médiane */}
        <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
        {/* Cercle central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
        {/* Point central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:8,height:8,borderRadius:"50%",background:"rgba(255,255,255,.2)"}}/>
        {/* Overlay sombre pour lisibilité */}
        <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
      </div>
      <div style={{zIndex:1,padding:"40px 20px 20px",textAlign:"center"}}>
        <div style={{fontSize:13,letterSpacing:4,textTransform:"uppercase",color:"rgba(255,255,255,.5)",fontWeight:600}}>Fin de manche {currentRound} · {diff}</div>
        <div style={{fontFamily:G.heading,fontSize:"clamp(36px,9vw,56px)",color:totalRounds===2&&currentRound===1?G.gold:G.white,letterSpacing:2,marginTop:6}}>
          {totalRounds===2&&currentRound===1?(tr("⚽ MI-TEMPS !","⚽ HALF-TIME!","⚽ HALBZEIT!","⚽ INTERVALLO!","⚽ INTERVALO!")):(tr("MANCHE ","ROUND ","RUNDE ","ROUND ","RODADA ")+currentRound+tr(" TERMINÉE"," DONE"," FERTIG"," FINITO"," CONCLUÍDA"))}
        </div>
        {totalRounds===2&&currentRound===1&&<div style={{fontSize:14,color:"rgba(255,255,255,.6)",marginTop:8,letterSpacing:2}}>{tr("Retour sur le terrain dans 3... 2... 1...","Back on the pitch in 3... 2... 1...","Zurück auf den Platz in 3... 2... 1...","Di nuovo in campo tra 3... 2... 1...","De volta ao campo em 3... 2... 1...")}</div>}
      </div>
      <div style={sheet}>
        {roundScores.map((s,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:i===roundScores.length-1?G.dark:G.offWhite,borderRadius:18,padding:"16px 20px",animation:`slideIn .4s ease ${i*.08}s both`}}>
            <span style={{fontSize:15,color:i===roundScores.length-1?G.white:"#888",fontWeight:700}}>{tr("Manche ","Round ","Runde ","Round ","Rodada ")}{i+1}</span>
            <span style={{fontFamily:G.heading,fontSize:32,color:i===roundScores.length-1?G.white:G.dark}}>{s} pts</span>
          </div>
        ))}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"linear-gradient(135deg,#fef3c7,#fde68a)",borderRadius:18,padding:"16px 20px",border:"2px solid #fbbf24"}}>
          <span style={{fontSize:15,color:"#92400e",fontWeight:700}}>Total ({roundScores.length}/{totalRounds})</span>
          <span style={{fontFamily:G.heading,fontSize:32,color:"#92400e"}}>{roundScores.reduce((a,b)=>a+b,0)} pts</span>
        </div>
        {/* Classement multi intermédiaire */}
        {activeDuelRef.current&&activeDuelRef.current.isRoom&&(
          <div style={{marginTop:16}}>
            <div style={{fontSize:11,letterSpacing:3,textTransform:"uppercase",color:"rgba(255,255,255,.4)",marginBottom:10,textAlign:"center"}}>{tr("Classement en cours","Live leaderboard","Live-Rangliste","Classifica in tempo reale","Ranking ao vivo")}</div>
            {roomRoundSnapshot ? roomRoundSnapshot.map(function(p,i){
              const medals=["🥇","🥈","🥉"];
              return(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:12,background:p.id===playerId?"rgba(0,230,118,.1)":"rgba(255,255,255,.04)",border:p.id===playerId?"1px solid rgba(0,230,118,.3)":"1px solid rgba(255,255,255,.06)",marginBottom:6}}>
                  <span style={{fontSize:18,width:28}}>{i<3?medals[i]:i+1}</span>
                  <span style={{flex:1,fontSize:13,fontWeight:800,color:p.id===playerId?G.accent:G.white}}>{p.name}{p.id===playerId?" (toi)":""}{p.abandoned?" 🏳️":""}</span>
                  <span style={{fontFamily:G.heading,fontSize:22,color:G.white}}>{p.partial_score||0} <span style={{fontSize:11,color:"rgba(255,255,255,.3)"}}>pts</span></span>
                </div>
              );
            }) : (
              <div style={{textAlign:"center",padding:"16px",color:"rgba(255,255,255,.35)",fontSize:13}}>⏳ {tr("Chargement des scores...","Loading scores...","Scores werden geladen...","Caricamento punteggi...","Carregando pontuações...")}</div>
            )}
          </div>
        )}
        <button onClick={()=>startRound(currentRound+1)} style={{width:"100%",padding:"18px",background:totalRounds===2&&currentRound===1?"#16a34a":G.dark,color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:17,fontWeight:800,marginTop:16,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>{Icon.whistle(18,G.white)} {totalRounds===2&&currentRound===1?(tr("REPRENDRE LA PARTIE →","RESUME GAME →","SPIEL FORTSETZEN →","RIPRENDI LA PARTITA →","RETOMAR JOGO →")):(tr("MANCHE ","ROUND ","RUNDE ","ROUND ","RODADA ")+(currentRound+1))}</button>
      </div>
    </div>
  );

  // ── FINAL ──
const makeResultScreen = (sc, mode, isChain) => {    return (    <div style={{...shell,animation:"fadeUp .4s ease",overflow:isDesktop?"visible":"auto"}} key={isChain?"chainEnd":"final"}>
      {openNotifBanner}
      {pseudoModal}
      {recoveryCodeAfterCreationModal}
      {recoveryInputModal}
      {myRecoveryCodeModal}
      {confettiOverlay}{gradeUpModal}{cardUnlockModal}<div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        {/* Bandes pelouse */}
        {[0,1,2,3,4,5,6].map(function(i){return(
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#0E1F14":"#132819"}}/>
        );})}
        {/* Ligne médiane */}
        <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
        {/* Cercle central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
        {/* Point central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:8,height:8,borderRadius:"50%",background:"rgba(255,255,255,.2)"}}/>
        {/* Overlay sombre pour lisibilité */}
        <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
      </div>
      <div style={{zIndex:1,padding:"16px 20px 0",textAlign:"center"}}>
        <WinBanner maxWidth={380} marginTop={0} lose={sc <= 0} />
        <div style={{fontFamily:G.heading,fontSize:"clamp(20px,5.5vw,32px)",color:isNewRecord?G.gold:G.white,letterSpacing:2,animation:"fadeUp .4s ease .15s both",marginTop:4}}>{isNewRecord?tr("NOUVEAU RECORD !","NEW RECORD!","NEUER REKORD!","NUOVO RECORD!","NOVO RECORDE!"):isChain?tr("TEMPS ÉCOULÉ !","TIME'S UP!","ZEIT ABGELAUFEN!","TEMPO SCADUTO!","TEMPO ESGOTADO!"):""}</div>
        <div style={{fontSize:"clamp(16px,4.5vw,22px)",color:G.white,fontWeight:800,marginTop:isNewRecord||isChain?6:16,animation:"fadeUp .4s ease .25s both",textTransform:"uppercase",letterSpacing:1,textShadow:"0 2px 10px rgba(0,0,0,.4)"}}>{(function(){
          const TAUNTS={
            win:{
              fr:["BALLON D'OR MÉRITÉ 🏆","T'AS PLIÉ LE MATCH 🎩","CLASSE INTERNATIONALE 🌍","PRESTATION 5 ÉTOILES ⭐","T'ES DANS LE ONZE TYPE 🏟️","MAN OF THE MATCH 🥇","DE LA MAGIE PURE 🪄","RECORD BATTU 📈"],
              en:["DESERVED BALLON D'OR 🏆","YOU OWNED THE GAME 🎩","WORLD CLASS 🌍","5-STAR PERFORMANCE ⭐","TEAM OF THE WEEK 🏟️","MAN OF THE MATCH 🥇","PURE MAGIC 🪄","RECORD BROKEN 📈"],
              de:["VERDIENTER BALLON D'OR 🏆","DU HAST DAS SPIEL ZERLEGT 🎩","WELTKLASSE 🌍","5-STERNE-LEISTUNG ⭐","ELF DER WOCHE 🏟️","MAN OF THE MATCH 🥇","REINE MAGIE 🪄","REKORD GEBROCHEN 📈"],
              it:["PALLONE D'ORO MERITATO 🏆","HAI DOMINATO 🎩","CLASSE MONDIALE 🌍","PRESTAZIONE 5 STELLE ⭐","TOP 11 DELLA SETTIMANA 🏟️","MAN OF THE MATCH 🥇","MAGIA PURA 🪄","RECORD BATTUTO 📈"],
              pt:["BOLA DE OURO MERECIDA 🏆","VOCÊ DOMINOU O JOGO 🎩","CLASSE MUNDIAL 🌍","ATUAÇÃO 5 ESTRELAS ⭐","SELEÇÃO DA SEMANA 🏟️","MAN OF THE MATCH 🥇","MÁGICA PURA 🪄","RECORDE BATIDO 📈"],
            },
            lose:{
              fr:["T'AS PAS LE NIVEAU.. 👀","C'EST TOUT CE QUE T'AS ? 💀","LE GOAT C'EST TOI OU PAS ? 🐐","ON JOUE PAS, ON DOMINE 😤","T'AS KIFFÉ OU T'AS SOUFFERT ? 😂","PROUVE QUE T'ES PAS UN RANDOM 🔥","LE FOOT C'EST DANS LA TÊTE FRÈRE 🧠","T'AURAIS PAS DÛ RATER LES AUTRES 😏"],
              en:["NOT GOOD ENOUGH.. 👀","IS THAT ALL YOU GOT? 💀","ARE YOU THE GOAT OR NOT? 🐐","WE DON'T PLAY, WE DOMINATE 😤","DID YOU ENJOY OR SUFFER? 😂","PROVE YOU'RE NOT A RANDOM 🔥","FOOTBALL IS IN THE HEAD BRO 🧠","YOU SHOULDN'T HAVE MISSED THE OTHERS 😏"],
              de:["NICHT GUT GENUG.. 👀","IST DAS ALLES? 💀","BIST DU DER GOAT ODER NICHT? 🐐","WIR SPIELEN NICHT, WIR DOMINIEREN 😤","SPASS GEHABT ODER GELITTEN? 😂","BEWEIS, DASS DU KEIN NIEMAND BIST 🔥","FUSSBALL IST KOPFSACHE BRUDER 🧠","DU HÄTTEST DIE ANDEREN NICHT VERPASSEN SOLLEN 😏"],
              it:["NON SEI ALL'ALTEZZA.. 👀","TUTTO QUI? 💀","SEI TU IL GOAT O NO? 🐐","NON SI GIOCA, SI DOMINA 😤","TI SEI DIVERTITO O HAI SOFFERTO? 😂","DIMOSTRA DI NON ESSERE UNO A CASO 🔥","IL CALCIO È NELLA TESTA FRA 🧠","NON DOVEVI SBAGLIARE GLI ALTRI 😏"],
              pt:["SEM NÍVEL.. 👀","SÓ ISSO? 💀","VOCÊ É O GOAT OU NÃO? 🐐","NÃO SE JOGA, SE DOMINA 😤","CURTIU OU SOFREU? 😂","PROVE QUE VOCÊ NÃO É UM QUALQUER 🔥","FUTEBOL É NA CABEÇA IRMÃO 🧠","NÃO DEVIA TER ERRADO OS OUTROS 😏"],
            },
          };
          const set=isNewRecord?TAUNTS.win:TAUNTS.lose;
          const arr=set[lang]||set.en||set.fr;
          return arr[Math.abs(Math.floor(sc * 3 + totalRounds)) % 8];
        })()}</div>
      </div>
      <div style={sheet}>
        <div style={{background:"rgba(8,14,10,.78)",borderRadius:22,padding:"20px",textAlign:"center",border:"1px solid rgba(0,230,118,.28)",boxShadow:"0 18px 50px -18px rgba(0,230,118,.35)",backdropFilter:"blur(10px)"}}>
          <div style={{fontSize:11,letterSpacing:3,textTransform:"uppercase",color:"rgba(255,255,255,.5)"}}>{isChain?tr("Score","Score","Score","Punteggio","Pontuação"):tr("Score total","Total score","Gesamtpunktzahl","Punteggio totale","Pontuação total")}</div>
          <div style={{fontFamily:G.heading,fontSize:"clamp(54px,13vw,80px)",color:G.white,lineHeight:1}}>{sc}</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.5)"}}>pts{isChain?` · ${chainCount} ${chainCount>1?tr("liens","links","Glieder","anelli","elos"):tr("lien","link","Glied","anello","elo")}`:`  ·  ${totalRounds} ${totalRounds>1?tr("manches","rounds","Runden","turni","rodadas"):tr("manche","round","Runde","turno","rodada")}`}</div>
          {maxCombo>=3&&<div style={{fontSize:13,color:"#f59e0b",marginTop:4,fontWeight:700}}>🔥 {tr("Meilleur combo","Best combo","Bester Combo","Miglior combo","Melhor combo")} : x{maxCombo}</div>}
          {isNewRecord&&<div style={{fontSize:12,color:G.accent,marginTop:6,fontStyle:"italic"}}>{tr("Ancien record battu 🎉","Previous record beaten 🎉","Alter Rekord geschlagen 🎉","Vecchio record battuto 🎉","Recorde anterior batido 🎉")}</div>}
          {dayStreak>=2&&<div style={{fontSize:12,color:"#FF6B35",marginTop:6,fontWeight:700}}>🔥 {dayStreak} {tr("jours de suite","days in a row","Tage in Folge","giorni di fila","dias seguidos")} !</div>}
        </div>

        {/* 🗓 MERCATO DU JOUR — score du jour + classement + partage */}

        {/* 🎯 NEAR-MISS — score en dessous du record : « il te manquait X pts » (pousse à relancer) */}
        {isChain && !isNewRecord && chainRecord && chainRecord.score > sc && (() => {
          const gap = chainRecord.score - sc;
          const close = gap <= Math.max(20, Math.round(chainRecord.score * 0.12));
          return (
            <div style={{marginTop:12,background:close?"rgba(255,138,42,.13)":"rgba(255,255,255,.04)",border:`1px solid ${close?"rgba(255,138,42,.55)":"rgba(255,255,255,.1)"}`,borderRadius:16,padding:"12px 16px",textAlign:"center"}}>
              <div style={{fontSize:13.5,fontWeight:900,color:close?"#FF8A2A":"#fff",letterSpacing:.3}}>
                {close ? tr("SI PROCHE ! 😤 ","SO CLOSE! 😤 ","SO KNAPP! 😤 ","COSÌ VICINO! 😤 ","POR POUCO! 😤 ") : ""}
                {tr(`Il te manquait ${gap} pts pour ton record`,`${gap} pts short of your record`,`Nur ${gap} Pkt bis zum Rekord`,`Ti mancavano ${gap} pt per il record`,`Faltaram ${gap} pts para o recorde`)}
              </div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginTop:3}}>🏆 {tr("Record","Record","Rekord","Record","Recorde")} : {chainRecord.score}</div>
            </div>
          );
        })()}

        {/* 🥕 CAROTTE DU PROCHAIN GRADE — incite à relancer pour l'atteindre */}
        {(() => {
          const ng = getNextGrade(playerXp);
          if (!ng) return null;
          const cur = getGrade(playerXp);
          const span = ng.min - cur.min;
          const done = playerXp - cur.min;
          const pct = Math.max(0, Math.min(100, span > 0 ? (done / span) * 100 : 0));
          const remain = Math.max(0, ng.min - playerXp);
          const carrot = tr(`Plus que ${remain} pts avant`, `${remain} pts to`, `Noch ${remain} Pkt bis`, `Ancora ${remain} pt a`, `Faltam ${remain} pts para`);
          return (
            <div style={{marginTop:12,background:"rgba(255,255,255,.04)",border:`1px solid ${ng.color}44`,borderRadius:16,padding:"12px 16px"}}>
              <div style={{fontSize:12,fontWeight:800,color:"rgba(255,255,255,.85)",marginBottom:7,textAlign:"center"}}>{carrot} <span style={{color:ng.color}}>{ng.emoji} {ng.label}</span></div>
              <div style={{height:7,borderRadius:4,background:"rgba(255,255,255,.1)",overflow:"hidden"}}>
                <div style={{height:"100%",width:pct+"%",background:`linear-gradient(90deg, ${ng.color}, #fff)`,borderRadius:4,transition:"width .5s ease"}}/>
              </div>
            </div>
          );
        })()}

        {/* Duel bot (mode EN LIGNE depuis la landing) */}
        {botOpponentRef.current && botScoreRef.current !== null && (() => {
          const myScore = sc;
          const botScore = botScoreRef.current;
          const win = myScore > botScore;
          const draw = myScore === botScore;
          const verdictColor = draw ? "#FFC93C" : win ? "#00E676" : "#FF3D6E";
          const verdictText = draw ? "ÉGALITÉ" : win ? "VICTOIRE !" : "DÉFAITE";
          const verdictBg = draw ? "rgba(255,201,60,.12)" : win ? "rgba(0,230,118,.12)" : "rgba(255,61,110,.12)";
          return (
            <div style={{borderRadius:20,padding:"18px",border:`2px solid ${verdictColor}55`,background:verdictBg,animation:"fadeUp .4s ease .15s both"}}>
              <div style={{textAlign:"center",fontFamily:G.heading,fontSize:24,letterSpacing:3,color:verdictColor,marginBottom:14}}>
                {verdictText}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",alignItems:"center",gap:10}}>
                {/* Toi */}
                <div style={{textAlign:"center"}}>
                  <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:64,height:64,borderRadius:"50%",overflow:"hidden",background:"linear-gradient(135deg,#00E676,#0E1F14)",border:"2px solid #00E676",marginBottom:8,marginInline:"auto"}}>
                    <img src={avatarCard(playerBadge, playerXp).img} alt="" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}}/>
                  </div>
                  <div style={{fontSize:11,color:"#bbb",letterSpacing:1,textTransform:"uppercase"}}>{playerName||"Toi"}</div>
                  <div style={{fontFamily:G.heading,fontSize:32,color:win?verdictColor:G.white,lineHeight:1,marginTop:2}}>{myScore}</div>
                </div>
                {/* VS */}
                <div style={{fontFamily:G.heading,fontSize:18,color:"#888",letterSpacing:2}}>VS</div>
                {/* Bot */}
                <div style={{textAlign:"center"}}>
                  <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:64,height:64,borderRadius:"50%",overflow:"hidden",background:"linear-gradient(135deg,#3DA5FF,#0E1F14)",border:"2px solid #3DA5FF",marginBottom:8,marginInline:"auto"}}>
                    {botOpponentRef.current.avatar
                      ? <img src={botOpponentRef.current.avatar} alt="" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}}/>
                      : <span style={{fontFamily:G.heading,fontSize:28,color:G.white}}>{botOpponentRef.current.pseudo[0].toUpperCase()}</span>
                    }
                  </div>
                  <div style={{fontSize:11,color:"#bbb",letterSpacing:1,textTransform:"uppercase",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                    {botOpponentRef.current.pseudo} <span style={{fontSize:13}}>{botOpponentRef.current.country}</span>
                  </div>
                  <div style={{fontFamily:G.heading,fontSize:32,color:(!win&&!draw)?verdictColor:G.white,lineHeight:1,marginTop:2}}>{botScore}</div>
                </div>
              </div>
            </div>
          );
        })()}

        {!isChain&&roundScores.length>1&&(
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {roundScores.map((s,i)=>{
              const best=Math.max(...roundScores);
              return(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:s===best?G.dark:G.offWhite,borderRadius:12,padding:"10px 16px",animation:`slideIn .4s ease ${i*.07}s both`}}>
                  <span style={{fontSize:13,fontWeight:700,color:s===best?G.white:"#aaa"}}>{tr("Manche ","Round ","Runde ","Round ","Rodada ")}{i+1} {s===best?"⭐":""}</span>
                  <span style={{fontFamily:G.heading,fontSize:24,color:s===best?G.white:G.dark}}>{s} pts</span>
                </div>
              );
            })}
          </div>
        )}
      
        {/* Actions secondaires compactes : classement / chaîne / partage */}
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>{setLbMode(mode);setLbDiff(diff);loadLeaderboard(lbMode);setShowLeaderboard(true);}} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,padding:"12px 4px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.12)",borderRadius:16,cursor:"pointer",color:"rgba(255,255,255,.85)"}}>
            <span style={{fontSize:20,lineHeight:1}}>🏆</span>
            <span style={{fontSize:10,fontWeight:800,letterSpacing:.6,textTransform:"uppercase",whiteSpace:"nowrap"}}>{tr("Classement","Ranking","Rangliste","Classifica","Ranking")}{myLbRank?` #${myLbRank}`:""}</span>
          </button>
          {((!isChain && roundAnswers.length>0) || (isChain && chainHistory.length>0)) && (
          <button onClick={()=>setShowHistory(true)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,padding:"12px 4px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.12)",borderRadius:16,cursor:"pointer",color:"rgba(255,255,255,.85)"}}>
            <span style={{fontSize:20,lineHeight:1}}>📋</span>
            <span style={{fontSize:10,fontWeight:800,letterSpacing:.6,textTransform:"uppercase",whiteSpace:"nowrap"}}>{isChain?(tr("Ma chaîne","My chain","Meine Kette","La mia catena","Minha corrente")):(tr("Récap","Recap","Übersicht","Riepilogo","Resumo"))}</span>
          </button>
          )}
          <button onClick={function(){
            const grade = getGrade(playerXp);
            const mode = isChain?"The Mercato":"The Plug";
            const txt = tr(
              `${grade.emoji} J'ai scoré ${sc} pts en mode ${mode} sur GOAT FC !\nGrade : ${grade.label}\nT'as le niveau ? 👇\nhttps://goatfc.fr`,
              `${grade.emoji} I scored ${sc} pts in ${mode} mode on GOAT FC!\nRank: ${grade.label}\nCan you beat me? 👇\nhttps://goatfc.fr`,
              `${grade.emoji} Ich habe ${sc} Pkt im Modus ${mode} auf GOAT FC erzielt!\nRang: ${grade.label}\nSchaffst du das? 👇\nhttps://goatfc.fr`,
              `${grade.emoji} Ho fatto ${sc} pt in modalità ${mode} su GOAT FC!\nGrado: ${grade.label}\nCe la fai? 👇\nhttps://goatfc.fr`,
              `${grade.emoji} Fiz ${sc} pts no modo ${mode} no GOAT FC!\nPatente: ${grade.label}\nVocê tem nível? 👇\nhttps://goatfc.fr`);
            if(navigator.share){navigator.share({title:"GOAT FC",text:txt});}
            else{navigator.clipboard.writeText(txt).then(function(){alert(tr("Copié ! Colle-le où tu veux 📋","Copied! Paste it anywhere 📋","Kopiert! Füg es überall ein 📋","Copiato! Incollalo dove vuoi 📋","Copiado! Cole onde quiser 📋"));});}
          }} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,padding:"12px 4px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.12)",borderRadius:16,cursor:"pointer",color:"rgba(255,255,255,.85)"}}>
            <span style={{fontSize:20,lineHeight:1}}>📤</span>
            <span style={{fontSize:10,fontWeight:800,letterSpacing:.6,textTransform:"uppercase",whiteSpace:"nowrap"}}>{tr("Partager","Share","Teilen","Condividi","Compartilhar")}</span>
          </button>
        </div>
        {!pseudoConfirmed && (
          <div style={{background:"rgba(255,200,0,.1)",border:"1px solid rgba(255,200,0,.3)",borderRadius:14,padding:"12px 16px",textAlign:"center"}}>
            <div style={{fontSize:13,color:"#ffd600",fontWeight:700,marginBottom:6}}>⚠️ {tr("Score non enregistré","Score not saved","Score nicht gespeichert","Punteggio non salvato","Pontuação não salva")}</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.5)",marginBottom:10}}>{tr("Crée un pseudo pour apparaître au classement","Create a username to appear on the leaderboard","Erstelle einen Namen, um in der Rangliste zu erscheinen","Crea un nome per apparire in classifica","Crie um nome para aparecer no ranking")}</div>
            <button onClick={()=>setPseudoScreen(true)} style={{padding:"8px 20px",background:"#ffd600",color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:800}}>{tr("Créer mon pseudo","Create username","Namen erstellen","Crea nome","Criar nome")}</button>
          </div>
        )}
        {<button onClick={()=>{if(isChain)startChain();else startCompetition();}} style={{width:"100%",padding:"17px",background:"linear-gradient(135deg,#00E676,#00B85C)",color:"#06130B",border:"none",borderRadius:18,cursor:"pointer",fontFamily:G.font,fontSize:17,fontWeight:900,letterSpacing:1.5,display:"flex",alignItems:"center",justifyContent:"center",gap:10,boxShadow:"0 14px 34px -10px rgba(0,230,118,.5)"}}>{Icon.ball(18,"#06130B")} {tr("REJOUER","PLAY AGAIN","NOCHMAL SPIELEN","GIOCA ANCORA","JOGAR DE NOVO")}</button>}
        <button onClick={()=>setScreen("home")} style={{width:"100%",padding:"13px",background:"transparent",color:"rgba(255,255,255,.55)",border:"1px solid rgba(255,255,255,.16)",borderRadius:18,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700,letterSpacing:.5}}>{tr("↩ Accueil","↩ Home","↩ Start","↩ Home","↩ Início")}</button>
      </div>
      {historyModal}
      {reportModal}
    </div>
  );
}


  // ── WAITING FOR ROOM RESULTS ──
  // ── DUEL RESULT SCREEN ──
  if (duelResult && duelResult.isRoom) {
    const medals = ["🥇","🥈","🥉"];
    const myEntry = duelResult.players.find(function(p){return p.id===playerId;});
    const myRank = duelResult.players.findIndex(function(p){return p.id===playerId;}) + 1;
    const iAbandoned = duelResult.myAbandoned === true;
    return (
      <div style={{...shell,animation:"fadeUp .4s ease",overflow:isDesktop?"visible":"auto"}} key="roomResult">
        <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        {/* Bandes pelouse */}
        {[0,1,2,3,4,5,6].map(function(i){return(
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#0E1F14":"#132819"}}/>
        );})}
        {/* Ligne médiane */}
        <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
        {/* Cercle central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
        {/* Point central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:8,height:8,borderRadius:"50%",background:"rgba(255,255,255,.2)"}}/>
        {/* Overlay sombre pour lisibilité */}
        <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
      </div>
        <div style={{zIndex:1,padding:"32px 20px 16px",textAlign:"center"}}>
          <div style={{fontSize:52,marginBottom:8}}>{iAbandoned?"🏳️":(myRank<=3?medals[myRank-1]:myRank+"ème")}</div> {!iAbandoned && <WinBanner maxWidth={300} marginTop={8} lose={myRank!==1} />}
          <div style={{fontFamily:G.heading,fontSize:"clamp(30px,8vw,50px)",color:iAbandoned?"#FF3D57":(myRank===1?G.gold:G.white),letterSpacing:2}}>
            {iAbandoned?(tr("ABANDON","FORFEIT","AUFGABE","RESA","DESISTÊNCIA")):(myRank===1?(tr("VICTOIRE !","VICTORY!","SIEG!","VITTORIA!","VITÓRIA!")):myRank===2?(tr("2ÈME PLACE","2ND PLACE","2. PLATZ","2° POSTO","2º LUGAR")):myRank===3?(tr("3ÈME PLACE","3RD PLACE","3. PLATZ","3° POSTO","3º LUGAR")):(tr("RÉSULTATS","RESULTS","ERGEBNISSE","RISULTATI","RESULTADOS")))}
          </div>
          {iAbandoned && <div style={{fontSize:15,color:"#fff",marginTop:10,fontWeight:700,padding:"0 16px",lineHeight:1.4}}>{tr("T'as même pas eu le courage d'aller au bout 😂","You didn't even finish 😂","Du hast nicht mal zu Ende gespielt 😂","Non hai nemmeno finito 😂","Você nem terminou 😂")}</div>}
        </div>
        <div style={{...sheet,borderRadius:"28px 28px 0 0"}}>
          {duelResult.players.map(function(p,i){
            const hasRounds = Array.isArray(p.rounds) && p.rounds.length > 0;
            const onClickHandler = hasRounds ? function(){
              setReviewRoundsModal({
                mode: duelResult.mode || "pont",
                playerName: p.name + (p.id===playerId ? (tr(" (toi)"," (you)"," (du)"," (tu)"," (você)")) : ""),
                rounds: p.rounds,
              });
            } : null;
            return (
            <div key={i} onClick={onClickHandler} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:14,background:p.id===playerId?"rgba(0,230,118,.08)":"rgba(255,255,255,.03)",border:p.id===playerId?"1px solid rgba(0,230,118,.25)":"1px solid rgba(255,255,255,.05)",marginBottom:6,cursor:hasRounds?"pointer":"default"}}>
              <div style={{fontFamily:G.heading,fontSize:30,width:40,textAlign:"center",color:i<3?["#FFD600","#C0C0C0","#CD7F32"][i]:"rgba(255,255,255,.3)"}}>{i<3?medals[i]:i+1}</div>
              <div style={{flex:1,fontSize:14,fontWeight:800,color:p.id===playerId?G.accent:G.white}}>{p.name}{p.id===playerId?" (toi)":""}{p.abandoned?" 🏳️":""}</div>
              <div style={{fontFamily:G.heading,fontSize:26,color:i===0?G.gold:G.white}}>{p.score||0} <span style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>pts</span></div>
              {hasRounds && <div style={{fontSize:14,color:"rgba(255,214,0,.7)",marginLeft:4}}>👁️</div>}
            </div>
          );})}
          {duelResult.players.some(function(p){return Array.isArray(p.rounds) && p.rounds.length > 0;}) && (
            <div style={{fontSize:10,color:"rgba(255,255,255,.4)",textAlign:"center",marginTop:6,marginBottom:6,fontStyle:"italic"}}>
              👁️ {tr("Tape sur un joueur pour voir ses réponses","Tap a player to see their answers","Tippe auf einen Spieler, um seine Antworten zu sehen","Tocca un giocatore per vedere le sue risposte","Toque num jogador para ver suas respostas")}
            </div>
          )}
          <button onClick={function(){
            const myEntry = duelResult.players.find(function(p){return p.id===playerId;});
            const grade = getGrade(playerXp);
            const rank = duelResult.players.findIndex(function(p){return p.id===playerId;})+1;
            const sc = myEntry?.score||0;
            const txt = rank===1
              ? tr(
                  `${grade.emoji} J'ai remporté la salle sur GOAT FC avec ${sc} pts 🏆\nGrade : ${grade.label}\nT'as le niveau ? 👇\nhttps://goatfc.fr`,
                  `${grade.emoji} I won the room on GOAT FC with ${sc} pts 🏆\nRank: ${grade.label}\nCan you beat me? 👇\nhttps://goatfc.fr`,
                  `${grade.emoji} Ich habe den Raum auf GOAT FC mit ${sc} Pkt gewonnen 🏆\nRang: ${grade.label}\nSchaffst du das? 👇\nhttps://goatfc.fr`,
                  `${grade.emoji} Ho vinto la stanza su GOAT FC con ${sc} pt 🏆\nGrado: ${grade.label}\nCe la fai? 👇\nhttps://goatfc.fr`,
                  `${grade.emoji} Venci a sala no GOAT FC com ${sc} pts 🏆\nPatente: ${grade.label}\nVocê tem nível? 👇\nhttps://goatfc.fr`)
              : tr(
                  `J'ai terminé ${rank}ème sur GOAT FC avec ${sc} pts\nGrade : ${grade.label}\nhttps://goatfc.fr`,
                  `I finished #${rank} on GOAT FC with ${sc} pts\nRank: ${grade.label}\nhttps://goatfc.fr`,
                  `Ich wurde ${rank}. auf GOAT FC mit ${sc} Pkt\nRang: ${grade.label}\nhttps://goatfc.fr`,
                  `Ho chiuso ${rank}° su GOAT FC con ${sc} pt\nGrado: ${grade.label}\nhttps://goatfc.fr`,
                  `Terminei em ${rank}º no GOAT FC com ${sc} pts\nPatente: ${grade.label}\nhttps://goatfc.fr`);
            if(navigator.share){navigator.share({title:"GOAT FC",text:txt});}
            else{navigator.clipboard.writeText(txt).then(function(){alert(tr("Copié ! 📋","Copied! 📋","Kopiert! 📋","Copiato! 📋","Copiado! 📋"));});}
          }} style={{width:"100%",padding:"13px",background:"linear-gradient(135deg,#1d4ed8,#7c3aed)",color:"#fff",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:8,marginBottom:6}}>
            {tr("📤 Partager le résultat","📤 Share the result","📤 Ergebnis teilen","📤 Condividi il risultato","📤 Compartilhar resultado")}
          </button>
          <button onClick={function(){setDuelResult(null);setScreen("home");}} style={{width:"100%",padding:"16px",background:G.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800,marginTop:0}}>
            {tr("Retour à l'accueil","Back home","Zurück zum Start","Torna alla home","Voltar ao início")}
          </button>
        </div>
      </div>
    );
  }
  if (duelResult) {
    const won = duelResult.myScore > duelResult.theirScore;
    const draw = duelResult.myScore === duelResult.theirScore;
    const abandoned = duelResult.opponentAbandoned;
    const emoji = abandoned ? "🏃" : won ? "🏆" : draw ? "🤝" : "😅";
    const label = abandoned
      ? (tr("ABANDON !","FORFEIT!","AUFGABE!","RESA!","DESISTÊNCIA!"))
      : won
      ? (tr("VICTOIRE !","VICTORY!","SIEG!","VITTORIA!","VITÓRIA!"))
      : draw
      ? (tr("ÉGALITÉ !","DRAW!","UNENTSCHIEDEN!","PAREGGIO!","EMPATE!"))
      : (tr("DÉFAITE","DEFEAT","NIEDERLAGE","SCONFITTA","DERROTA"));
    const labelColor = won || abandoned ? G.accent : draw ? G.gold : "#FF3D57";
    return (
      <div style={{...shell,animation:"fadeUp .4s ease",overflow:isDesktop?"visible":"auto"}} key="duelResult">
        <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        {/* Bandes pelouse */}
        {[0,1,2,3,4,5,6].map(function(i){return(
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#0E1F14":"#132819"}}/>
        );})}
        {/* Ligne médiane */}
        <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
        {/* Cercle central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
        {/* Point central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:8,height:8,borderRadius:"50%",background:"rgba(255,255,255,.2)"}}/>
        {/* Overlay sombre pour lisibilité */}
        <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
      </div>
      {/* Joueur célébration duel */}
        <div style={{zIndex:1,padding:"16px 20px 0",textAlign:"center"}}>
          <WinBanner maxWidth={380} marginTop={0} lose={!won && !draw} />
          <div style={{fontFamily:G.heading,fontSize:"clamp(30px,8vw,46px)",color:labelColor,letterSpacing:2,marginTop:4}}>{label}</div>
          <div style={{fontSize:"clamp(13px,3.5vw,18px)",color:G.white,fontWeight:800,marginTop:6,animation:"fadeUp .4s ease .25s both",textTransform:"uppercase",letterSpacing:1,textShadow:"0 2px 10px rgba(0,0,0,.4)"}}>{
            won
              ? pickResultMessage(RESULT_MESSAGES[(lang==="fr"?"fr":"en")].winLabels, duelResult.myScore)
              : draw
              ? pickResultMessage(RESULT_MESSAGES[(lang==="fr"?"fr":"en")].drawLabels, duelResult.myScore)
              : pickResultMessage(RESULT_MESSAGES[(lang==="fr"?"fr":"en")].loseLabels, duelResult.theirScore)
          }</div>
          {(()=>{const grade=getGrade(playerXp); return <div style={{display:"inline-flex",alignItems:"center",gap:8,marginTop:8,background:grade.color+"22",borderRadius:20,padding:"6px 14px"}}><span style={{fontSize:13,fontWeight:800,color:grade.color,letterSpacing:.5}}>{grade.label}</span></div>; })()}
          <div style={{fontSize:14,color:"rgba(255,255,255,.4)",marginTop:8}}>
            {abandoned ? duelResult.oppName+(tr(" a abandonné 🏃"," forfeited 🏃"," hat aufgegeben 🏃"," ha abbandonato 🏃"," desistiu 🏃")) : (tr("Duel ","Duel ","Duell ","Duello ","Duelo "))+(duelResult.mode==="pont"?"The Plug":"The Mercato")}
          </div>
        </div>
        <div style={{...sheet,borderRadius:"28px 28px 0 0"}}>
          {/* Scores */}
          <div style={{display:"flex",gap:12,marginBottom:8}}>
            <div onClick={Array.isArray(duelResult.myRounds) && duelResult.myRounds.length > 0 ? function(){setReviewRoundsModal({mode:duelResult.mode||"pont",playerName:(tr("Toi","You","Du","Tu","Você")),rounds:duelResult.myRounds});} : null} style={{flex:1,background:"rgba(0,230,118,.08)",border:"2px solid "+(won?"#00E676":"rgba(255,255,255,.08)"),borderRadius:20,padding:"20px 12px",textAlign:"center",cursor:Array.isArray(duelResult.myRounds)&&duelResult.myRounds.length>0?"pointer":"default",position:"relative"}}>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.4)",marginBottom:6}}>{tr("Toi","You","Du","Tu","Você")}</div>
              <div style={{fontFamily:G.heading,fontSize:52,color:won?G.accent:G.white,lineHeight:1}}>{duelResult.myScore}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.3)",marginTop:4}}>pts</div>
              {Array.isArray(duelResult.myRounds) && duelResult.myRounds.length > 0 && (
                <div style={{position:"absolute",top:6,right:8,fontSize:14,color:"rgba(255,214,0,.7)"}}>👁️</div>
              )}
            </div>
            <div style={{display:"flex",alignItems:"center",fontFamily:G.heading,fontSize:24,color:"rgba(255,255,255,.3)"}}>VS</div>
            <div onClick={Array.isArray(duelResult.theirRounds) && duelResult.theirRounds.length > 0 ? function(){setReviewRoundsModal({mode:duelResult.mode||"pont",playerName:duelResult.oppName,rounds:duelResult.theirRounds});} : null} style={{flex:1,background:"rgba(255,255,255,.04)",border:"2px solid "+(!won&&!draw?"#FF3D57":"rgba(255,255,255,.08)"),borderRadius:20,padding:"20px 12px",textAlign:"center",cursor:Array.isArray(duelResult.theirRounds)&&duelResult.theirRounds.length>0?"pointer":"default",position:"relative"}}>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.4)",marginBottom:6}}>{duelResult.oppName}</div>
              <div style={{fontFamily:G.heading,fontSize:52,color:(!won&&!draw)?"#FF3D57":G.white,lineHeight:1}}>{duelResult.theirScore}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.3)",marginTop:4}}>pts</div>
              {Array.isArray(duelResult.theirRounds) && duelResult.theirRounds.length > 0 && (
                <div style={{position:"absolute",top:6,right:8,fontSize:14,color:"rgba(255,214,0,.7)"}}>👁️</div>
              )}
            </div>
          </div>
          {Array.isArray(duelResult.myRounds) && duelResult.myRounds.length > 0 && (
            <div style={{fontSize:10,color:"rgba(255,255,255,.4)",textAlign:"center",marginTop:-2,marginBottom:8,fontStyle:"italic"}}>
              👁️ {tr("Tape sur un score pour voir les réponses","Tap a score box to see the answers","Tippe auf einen Score, um die Antworten zu sehen","Tocca un punteggio per vedere le risposte","Toque numa pontuação para ver as respostas")}
            </div>
          )}
          {/* Streak banner */}
          {won && winStreak >= 2 && (
            <div style={{textAlign:"center",marginBottom:8,padding:"10px 16px",background:"linear-gradient(135deg,rgba(255,107,53,.2),rgba(255,214,0,.2))",borderRadius:14,border:"1px solid rgba(255,107,53,.3)"}}>
              <span style={{fontSize:20}}>🔥</span>
              <span style={{fontFamily:G.heading,fontSize:18,color:"#FF6B35",marginLeft:8,letterSpacing:1}}>
                {winStreak} {tr("VICTOIRES D'AFFILÉE","WINS IN A ROW","SIEGE IN FOLGE","VITTORIE DI FILA","VITÓRIAS SEGUIDAS")}
              </span>
              {winStreak >= 5 && <div style={{fontSize:12,color:"rgba(255,107,53,.8)",marginTop:2}}>
                {winStreak >= 10 ? (tr("T'es inarrêtable 🐐","You're unstoppable 🐐","Du bist unaufhaltsam 🐐","Sei inarrestabile 🐐","Você é imparável 🐐")) : winStreak >= 7 ? (tr("Personne peut t'arrêter 😤","Nobody can stop you 😤","Niemand kann dich stoppen 😤","Nessuno può fermarti 😤","Ninguém te para 😤")) : (tr("T'es en feu frère 🔥","You're on fire mate 🔥","Du bist in Flammen 🔥","Sei in fiamme fra 🔥","Você está pegando fogo 🔥"))}
              </div>}
            </div>
          )}
          {/* Badge Invaincu */}
          {won && duelResult.oppName && (()=>{
            const h2h = duels.filter(function(d){return d.status==="complete"&&(d.challenger_id===playerId||d.opponent_id===playerId)&&(d.challenger_name===duelResult.oppName||d.opponent_name===duelResult.oppName);});
            const lost = h2h.some(function(d){const ms=d.challenger_id===playerId?d.challenger_score:d.opponent_score;const ts=d.challenger_id===playerId?d.opponent_score:d.challenger_score;return ms<ts;});
            return !lost && h2h.length >= 2 ? (
              <div style={{textAlign:"center",marginBottom:8,padding:"10px 16px",background:"rgba(255,215,0,.1)",borderRadius:14,border:"1px solid rgba(255,215,0,.3)"}}>
                <span style={{fontFamily:G.heading,fontSize:16,color:"#FFD700",letterSpacing:1}}>😤 {tr("INVAINCU CONTRE","UNBEATEN VS","UNGESCHLAGEN GEGEN","IMBATTUTO CONTRO","INVICTO CONTRA")} {duelResult.oppName.toUpperCase()}</span>
              </div>
            ) : null;
          })()}
          {/* Message auto du vainqueur au perdant */}
          {!won && !draw && !abandoned && duelResult.oppName && (
            <div style={{marginBottom:8,padding:"12px 16px",background:"rgba(255,255,255,.05)",borderRadius:14,border:"1px solid rgba(255,255,255,.1)"}}>
              <div style={{fontSize:10,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>💬 {tr("Message de","Message from","Nachricht von","Messaggio da","Mensagem de")} {duelResult.oppName}</div>
              <div style={{fontSize:14,fontWeight:700,color:G.white}}>
                {pickResultMessage(RESULT_MESSAGES[(lang==="fr"?"fr":"en")].winTaunts, duelResult.theirScore - duelResult.myScore + duelResult.theirScore)}
              </div>
            </div>
          )}
          <div style={{fontSize:15,color:"rgba(255,255,255,.85)",textAlign:"center",padding:"10px 0",fontWeight:700,lineHeight:1.4}}>
            {(()=>{
              const L = RESULT_MESSAGES[(lang==="fr"?"fr":"en")];
              const oppName = duelResult.oppName || "";
              if (abandoned) {
                const fn = pickResultMessage(L.abandonedCentral, duelResult.myScore);
                return typeof fn === "function" ? fn(oppName) : fn;
              }
              if (won) {
                const fn = pickResultMessage(L.winCentral, duelResult.myScore);
                return typeof fn === "function" ? fn(oppName) : fn;
              }
              if (draw) {
                return pickResultMessage(L.drawCentral, duelResult.myScore);
              }
              const fn = pickResultMessage(L.loseCentral, duelResult.theirScore);
              return typeof fn === "function" ? fn(oppName) : fn;
            })()}
          </div>
          {won && !abandoned && (
            <div style={{marginBottom:8,padding:"10px 16px",background:"rgba(0,230,118,.05)",borderRadius:14,border:"1px solid rgba(0,230,118,.1)"}}>
              <div style={{fontSize:10,color:"rgba(0,230,118,.5)",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>💬 {tr("Message envoyé à","Message sent to","Nachricht gesendet an","Messaggio inviato a","Mensagem enviada para")} {duelResult.oppName}</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,.5)",fontStyle:"italic"}}>
                {pickResultMessage(RESULT_MESSAGES[(lang==="fr"?"fr":"en")].winTaunts, duelResult.myScore * 3 + duelResult.theirScore)}
              </div>
            </div>
          )}
          <button onClick={function(){
            const grade = getGrade(playerXp);
            const opp = duelResult.oppName, my = duelResult.myScore, their = duelResult.theirScore;
            const txt = won
              ? tr(
                  `${grade.emoji} J'ai écrasé ${opp} ${my}-${their} sur GOAT FC 😤\nGrade : ${grade.label}\nT'as le niveau ? 👇\nhttps://goatfc.fr`,
                  `${grade.emoji} I crushed ${opp} ${my}-${their} on GOAT FC 😤\nRank: ${grade.label}\nCan you beat me? 👇\nhttps://goatfc.fr`,
                  `${grade.emoji} Ich habe ${opp} ${my}-${their} auf GOAT FC zerlegt 😤\nRang: ${grade.label}\nSchaffst du das? 👇\nhttps://goatfc.fr`,
                  `${grade.emoji} Ho asfaltato ${opp} ${my}-${their} su GOAT FC 😤\nGrado: ${grade.label}\nCe la fai? 👇\nhttps://goatfc.fr`,
                  `${grade.emoji} Atropelei ${opp} ${my}-${their} no GOAT FC 😤\nPatente: ${grade.label}\nVocê tem nível? 👇\nhttps://goatfc.fr`)
              : tr(
                  `J'ai perdu ${my}-${their} contre ${opp} sur GOAT FC 😤\nLa revanche arrive...\nhttps://goatfc.fr`,
                  `I lost ${my}-${their} to ${opp} on GOAT FC 😤\nRematch incoming...\nhttps://goatfc.fr`,
                  `Ich habe ${my}-${their} gegen ${opp} auf GOAT FC verloren 😤\nDie Revanche kommt...\nhttps://goatfc.fr`,
                  `Ho perso ${my}-${their} contro ${opp} su GOAT FC 😤\nLa rivincita arriva...\nhttps://goatfc.fr`,
                  `Perdi ${my}-${their} para ${opp} no GOAT FC 😤\nA revanche vem aí...\nhttps://goatfc.fr`);
            if(navigator.share){navigator.share({title:"GOAT FC",text:txt});}
            else{navigator.clipboard.writeText(txt).then(function(){alert(tr("Copié ! 📋","Copied! 📋","Kopiert! 📋","Copiato! 📋","Copiado! 📋"));});}
          }} style={{width:"100%",padding:"13px",background:"linear-gradient(135deg,#1d4ed8,#7c3aed)",color:"#fff",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:6}}>
            {tr("📤 Partager le résultat","📤 Share the result","📤 Ergebnis teilen","📤 Condividi il risultato","📤 Compartilhar resultado")}
          </button>
          {((!duelResult.isChain && roundAnswers.length>0) || (duelResult.isChain && chainHistory.length>0)) && (
            <button onClick={()=>setShowHistory(true)} style={{width:"100%",padding:"13px",background:"rgba(251,226,22,.12)",color:"#FBE216",border:"1.5px solid rgba(251,226,22,.5)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:6}}>
              📋 {duelResult.isChain?(tr("Voir ma chaîne","See my chain","Meine Kette ansehen","Vedi la mia catena","Ver minha corrente")):(tr("Récap des questions","Questions recap","Fragen-Übersicht","Riepilogo domande","Resumo das perguntas"))}
            </button>
          )}
          <button onClick={function(){setDuelResult(null);setScreen("home");}} style={{width:"100%",padding:"16px",background:G.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800,marginTop:2}}>
            {tr("Retour à l'accueil","Back home","Zurück zum Start","Torna alla home","Voltar ao início")}
          </button>
        </div>
        {historyModal}
        {reportModal}
      </div>
    );
  }
  if(screen==="final") return makeResultScreen(total,"pont",false);
  if(screen==="chainEnd") return makeResultScreen(chainScore,"chaine",true);

  return <div style={{...shell,justifyContent:"center",alignItems:"center"}}><div style={{color:G.white}}>{tr("Chargement…","Loading…","Wird geladen…","Caricamento…","Carregando…")}</div></div>;
}
