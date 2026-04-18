import React, { useState, useEffect, useRef, useCallback } from "react";
import { PLAYERS, RETIRED_PLAYERS } from "../players.jsx";



const SB_URL = "https://ialjlsrgcolocoaegzrc.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhbGpsc3JnY29sb2NvYWVnenJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MDM3NzksImV4cCI6MjA5MTA3OTc3OX0.-SU8anuPhnpoa-PYhIHQqrcuOBsHxdtBJKRZuiGcGwM";


async function sbFetch(path, options) {
  const res = await fetch(SB_URL + "/rest/v1/" + path, {
    ...options,
    headers: Object.assign({"apikey":SB_KEY,"Authorization":"Bearer "+SB_KEY,"Content-Type":"application/json"},
      options&&options.method==="POST"?{"Prefer":"return=minimal"}:{},
      options&&options.headers?options.headers:{})
  });
  if (!res.ok && res.status !== 201) return null;
  if (res.status === 201 || res.headers.get("content-length") === "0") return [];
  try { return await res.json(); } catch { return []; }
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
const SEASON_START = new Date("2026-04-13T00:00:00Z");
const SEASON_DURATION_DAYS = 14;

function getCurrentSeason() {
  const now = new Date();
  const elapsed = now - SEASON_START;
  const seasonMs = SEASON_DURATION_DAYS * 24 * 60 * 60 * 1000;
  const num = Math.floor(elapsed / seasonMs);
  const start = new Date(SEASON_START.getTime() + num * seasonMs);
  const end = new Date(start.getTime() + seasonMs);
  const remaining = end - now;
  const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return { num: num + 1, start, end, days, hours };
}

const GRADES = [
  { min:500, label:"GOAT",    emoji:"🐐", color:"#FFD700" },
  { min:300, label:"Légende", emoji:"🦅", color:"#FF6B35" },
  { min:200, label:"Elite",   emoji:"🦁", color:"#00B4D8" },
  { min:150, label:"Expert",  emoji:"🐺", color:"#E63946" },
  { min:100, label:"Pro",     emoji:"🦊", color:"#2EC4B6" },
  { min:50,  label:"Amateur", emoji:"🐢", color:"#A8DADC" },
  { min:0,   label:"Rookie",  emoji:"🐣", color:"#8D99AE" },
];

function getGrade(score) {
  return GRADES.find(function(g){ return score >= g.min; }) || GRADES[GRADES.length-1];
}
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
  "Borussia Monchengladbach":["gladbach","monchengladbach"],
  "RB Leipzig":["leipzig","rb"],
  "Bayer Leverkusen":["leverkusen","bayer"],
  "Juventus":["juve","juventus turin","la juve"],
  "Napoli":["naples","ssc napoli","ssc naples"],
  "Roma":["as roma","as rome","rome"],
  "Lazio":["ss lazio"],
  "Fiorentina":["la viola","florence"],
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
  "Empoli":["empoli fc","gli azzurri"],
  "Udinese":["udinese calcio","zebrette"],
  "Hoffenheim":["tsg hoffenheim","tsg 1899","1899 hoffenheim"],
  "Genoa":["genoa cfc","genova"],
  "Granada":["granada cf","los nazaríes"],
  "Amiens":["amiens sc","asc amiens"],
  "Torino":["torino fc","toro","granata"],
  "West Brom":["west bromwich","wba","west bromwich albion"],
  "Sunderland":["sunderland afc","safc","black cats"],
  "Sochaux":["fc sochaux","fcsm"],
  "Servette":["servette fc","servette geneve"],
  "Charleroi":["sporting charleroi","rsc charleroi"],
  "Espérance de Tunis":["esperance tunis","est","esperance sportive de tunis"],
  "CS Sfaxien":["sfaxien","csf","club sportif sfaxien"],
  "Caen":["sm caen","stade malherbe"],
  "Lorient":["fc lorient","les merlus"],
  "Valenciennes":["valenciennes fc","vafc"],
  "Gent":["kaa gent","aa gent"],
  "Stoke City":["stoke","the potters"],
  "FC Cologne":["cologne","koln","1. fc köln"],
  "Mainz":["mainz 05","fsv mainz"],
  "Reims":["stade de reims","stade reims"],
  "Angers":["angers sco","sco angers"],
  "Al Shamal":["al-shamal","shamal"],
  "Al-Sadd":["al sadd","sadd","al-sadd sc"],
  "Genk":["racing genk","krc genk"],
  "Real Valladolid":["valladolid"],
  "Real Zaragoza":["zaragoza"],
};

const CLUB_COLORS = {
  "Arsenal":["#EF0107","#063672"],"Chelsea":["#034694","#DBA111"],"Liverpool":["#C8102E","#FFFFFF"],
  "Manchester United":["#DA291C","#FFFFFF"],"Manchester City":["#6CABDD","#1C2C5B"],"Tottenham":["#132257","#FFFFFF"],
  "Newcastle":["#241F20","#FFFFFF"],"Everton":["#003399","#FFFFFF"],"West Ham":["#7A263A","#1BB1E7"],
  "Aston Villa":["#670E36","#95BFE5"],"Leicester City":["#003090","#FDBE11"],
  "Brighton":["#0057B8","#FFFFFF"],"Southampton":["#D71920","#FFFFFF"],"Wolverhampton":["#FDB913","#231F20"],
  "Real Madrid":["#FEBE10","#FFFFFF"],"Barcelona":["#A50044","#004D98"],"Atletico Madrid":["#CB3524","#FFFFFF"],
  "Sevilla":["#D71920","#FFFFFF"],"Valencia":["#F47920","#000000"],"Villarreal":["#FCD000","#004C8C"],
  "Athletic Bilbao":["#EE2523","#FFFFFF"],"Real Betis":["#00954C","#FFFFFF"],
  "Juventus":["#000000","#FFFFFF"],"AC Milan":["#FB090B","#000000"],"Inter Milan":["#0066B2","#000000"],
  "Napoli":["#12A0C3","#FFFFFF"],"Roma":["#8E1F2F","#F0BC42"],"Lazio":["#87CEEB","#FFFFFF"],
  "Fiorentina":["#4B0082","#FFFFFF"],"Atalanta":["#1D2951","#E32221"],
  "PSG":["#004170","#DA291C"],"Marseille":["#009BCE","#FFFFFF"],"Lyon":["#032CA6","#E4003A"],
  "Monaco":["#D4011D","#FFFFFF"],"Lille":["#E31B23","#1F3764"],"Bordeaux":["#1A1255","#FFFFFF"],
  "Rennes":["#D0021B","#000000"],"Nice":["#000000","#DF212A"],"Saint-Etienne":["#007744","#FFFFFF"],
  "Bayern Munich":["#DC052D","#0066B2"],"Borussia Dortmund":["#FDE100","#000000"],
  "Bayer Leverkusen":["#E32221","#000000"],"Schalke":["#004D9D","#FFFFFF"],
  "Werder Bremen":["#1D8348","#FFFFFF"],"RB Leipzig":["#DD0741","#FFFFFF"],
  "Eintracht Frankfurt":["#E1000F","#000000"],"Wolfsburg":["#65B32E","#FFFFFF"],
  "Sporting CP":["#007848","#FFFFFF"],"Benfica":["#E31B23","#FFFFFF"],"Porto":["#003F87","#FFFFFF"],
  "Ajax Amsterdam":["#D2122E","#FFFFFF"],"PSV Eindhoven":["#E1002A","#FFFFFF"],"Feyenoord":["#C8102E","#FFFFFF"],"AZ Alkmaar":["#E31B23","#FFFFFF"],
  "Al Nassr":["#F5C518","#0B4EA2"],"Al Hilal":["#0046AD","#FFFFFF"],"Al Ittihad":["#F5C518","#000000"],"Al Ahli":["#007A3D","#FFFFFF"],
  "LA Galaxy":["#00245D","#FFD700"],"DC United":["#000000","#EF3E42"],"Toronto FC":["#B81137","#FFFFFF"],"Inter Miami":["#F7B5CD","#000000"],"New York City FC":["#6CACE4","#003087"],"New York Red Bulls":["#ED1E36","#003087"],"Seattle Sounders":["#5D9732","#003DA5"],"Atlanta United":["#80000A","#9DC2B6"],"LAFC":["#000000","#C39E6D"],"Portland Timbers":["#004812","#EBE72B"],"Chicago Fire":["#73000A","#6CACE4"],
  "Spartak Moscow":["#CE1126","#FFFFFF"],"CSKA Moscow":["#C8102E","#003F87"],"Zenit Saint Petersburg":["#003F87","#FFFFFF"],"Lokomotiv Moscow":["#007A3D","#E31B23"],
  "Fenerbahce":["#003F7F","#FFFF00"],"Besiktas":["#000000","#FFFFFF"],"Trabzonspor":["#A41E34","#004B8D"],
  "Celtic":["#138a3e","#FFFFFF"],
  "Galatasaray":["#FFA500","#D40000"],"Lens":["#EE1C25","#F5C842"],
  "RC Strasbourg":["#003B8E","#FFFFFF"],"Sparta Rotterdam":["#CC0000","#FFFFFF"],
  "Deportivo Alavés":["#003DA5","#FFFFFF"],"CD Mirandés":["#FF0000","#000000"],
  "Fulham":["#FFFFFF","#000000"],"Brentford":["#CC0000","#FFFFFF"],
  "Sampdoria":["#0E4FA3","#FFFFFF"],"Midtjylland":["#CC0000","#FFFFFF"],
  "Parma":["#FFD700","#003082"],"Sint-Truiden":["#FFD700","#000000"],
  "Hamburg":["#001F5B","#FFFFFF"],"RB Salzburg":["#CC0000","#FFFFFF"],
  "Standard Liège":["#CC0000","#FFFFFF"],"Almería":["#CC0000","#FFFFFF"],
  "Málaga":["#003082","#FFFFFF"],"River Plate":["#FFFFFF","#CC0000"],"Boca Juniors":["#003399","#FFD700"],
  "Racing Club":["#1565C0","#FFFFFF"],"Palmeiras":["#006B3F","#FFFFFF"],"Santos":["#000000","#FFFFFF"],"Flamengo":["#E82020","#000000"],"Cruzeiro":["#003399","#FFFFFF"],
  "Cannes":["#E31B23","#FFFFFF"],"Orlando City":["#633492","#F7B024"],
  "Leeds United":["#FFFFFF","#FFD700"],"Empoli":["#1565C0","#FFFFFF"],"Udinese":["#000000","#FFFFFF"],"Bologna":["#CC0000","#003082"],
  "Granada":["#CC0000","#FFFFFF"],
  "Sunderland":["#E31B23","#000000"],"Sochaux":["#FABE00","#003082"],
  "Charleroi":["#000000","#FFFFFF"],"Espérance de Tunis":["#CC0000","#FFD700"],
  "CS Sfaxien":["#CC0000","#000000"],"Caen":["#003189","#FFFFFF"],
  "Lorient":["#F7700A","#000000"],"Valenciennes":["#CC0000","#FFFFFF"],
  "Gent":["#1B67B2","#FFFFFF"],
  "FC Cologne":["#ED1C24","#FFFFFF"],"Mainz":["#C8102E","#FFFFFF"],
  "Angers":["#000000","#FFFFFF"],"Al Shamal":["#006A4E","#FFFFFF"],
  "Genk":["#1B67B2","#FFFFFF"],"Real Valladolid":["#4B0082","#FFFFFF"],
  "Real Zaragoza":["#003399","#FFFFFF"],
};

// ── BUILD DATABASES ──
const PONT_CLUBS = new Set([
  "Manchester City","Arsenal","Liverpool","Chelsea","Manchester United",
  "Real Madrid","Barcelona","Atletico Madrid","Sevilla","Valencia",
  "Juventus","AC Milan","Inter Milan","Napoli","Roma",
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
]);

function buildPontDB() {
  const pairMap = {};

  for (const p of PLAYERS_CLEAN) {
    if(!p||!p.clubs)continue;
    const bigClubs = p.clubs.filter(c => PONT_CLUBS.has(c));
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
    db[val.diff].push({c1,c2,p:val.players,isCurrent:val.hasCurrent});
  }
for (const diff of ["facile","moyen","expert"]) {
  const current = db[diff].filter(q => q.isCurrent);
  const retired = db[diff].filter(q => !q.isCurrent);

  // 80% paires avec joueurs actifs, 20% paires full retraités
  const retiredTarget = Math.round((current.length / 0.8) * 0.2);
  const retiredPick = retired
    .sort(() => Math.random() - 0.5)
    .slice(0, retiredTarget);

  db[diff] = [...current, ...retiredPick];

  // Shuffle final
  for (let i = db[diff].length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [db[diff][i], db[diff][j]] = [db[diff][j], db[diff][i]];
  }
}
return db;
}
const PLAYERS_CLEAN = PLAYERS.filter(function(p){return p&&p.name&&p.clubs&&Array.isArray(p.clubs);});


function isRetiredPlayer(name) {
  return RETIRED_PLAYERS.has(name);
}

const SPLASH_IMG = "/splash.png";


const WIN_IMGS = ["/win1.png", "/win2.png", "/win3.png", "/win4.png", "/win5.png"];
const LOSE_IMGS = ["/lose1.png", "/lose2.png", "/lose3.png", "/lose4.png"];
const randomImg = (arr) => arr[Math.floor(Math.random()*arr.length)];
const GOAT_LOGO_NEW = "data:image/webp;base64,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";
const GOAT_LOGO = "data:image/webp;base64,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";
const PLUG_CARD_IMG = "/plug-card.png";
const MERCATO_CARD_IMG = "/mercato-card.png";
const DB = buildPontDB();

// ── DAILY CHALLENGE ──
function getDailyPlayer() {
  const today = (()=>{ const d=new Date(); const paris=new Date(d.toLocaleString('en-US',{timeZone:'Europe/Paris'})); return paris.getFullYear()+'-'+String(paris.getMonth()+1).padStart(2,'0')+'-'+String(paris.getDate()).padStart(2,'0'); })();
  let hash = 0;
  for (let i = 0; i < today.length; i++) {
    hash = ((hash << 5) - hash) + today.charCodeAt(i);
    hash |= 0;
  }
  hash = Math.abs(hash);
  const pool = PLAYERS_CLEAN.filter(function(p){ return p.clubs && p.clubs.length >= 2; });
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

  const playerEntry = PLAYERS_CLEAN.find(p => p.name === name);
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
function norm(s){return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9 ]/g,"").trim();}
function checkGuess(g,players){const gn=norm(g);return players.some(p=>{const pn=norm(p);return gn===pn||pn.split(" ").some(part=>part.length>2&&gn.includes(part));});}
function matchClub(input,playerClubs){
  const n=norm(input);
  for(const c of playerClubs){if(norm(c)===n)return c;}
  for(const c of playerClubs){const aliases=CLUB_ALIASES[c];if(aliases&&aliases.some(a=>norm(a)===n))return c;}
  if(n.length>=3){
    for(const c of playerClubs){if(norm(c).includes(n)||n.includes(norm(c)))return c;}
    for(const c of playerClubs){const aliases=CLUB_ALIASES[c];if(aliases&&aliases.some(a=>norm(a).includes(n)||n.includes(norm(a))))return c;}
  }
  return null;
}
function getPlayerClubs(name){const p=PLAYERS_CLEAN.find(x=>x.name===name);return p?p.clubs:[];}
function getPlayersForClub(club){return CLUB_INDEX[club]||[];}

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
  const initials = club.split(" ").map(w => w[0]).join("").slice(0, 3).toUpperCase();
  const fontSize = size < 36 ? size * 0.32 : size * 0.28;
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
function generateOptions(correctPlayers,allPairs){
  const correct=correctPlayers[Math.floor(Math.random()*correctPlayers.length)];
  const pool=[];allPairs.forEach(pair=>pair.p.forEach(p=>{if(!correctPlayers.includes(p))pool.push(p);}));
  const wrongs=[...new Set(pool.sort(()=>Math.random()-.5))].slice(0,3);
  return [correct,...wrongs].sort(()=>Math.random()-.5);
}
function getComboLabel(c){if(c>=10)return"🔥 LÉGENDAIRE";if(c>=7)return"💫 INCROYABLE";if(c>=5)return"⚡ EN FEU";if(c>=3)return"🎯 COMBO";return"";}

// ── SOUNDS ──
function playSound(type){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
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
    }else{
      const osc=ctx.createOscillator(),g=ctx.createGain();
      osc.connect(g);g.connect(ctx.destination);osc.frequency.setValueAtTime(220,ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110,ctx.currentTime+.3);osc.type="sawtooth";
      g.gain.setValueAtTime(.3,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.3);
      osc.start(ctx.currentTime);osc.stop(ctx.currentTime+.3);
    }
  }catch(e){}
}

// ── CSS ──
if(typeof document!=="undefined"&&!document.getElementById("bb-css")){
  const s=document.createElement("style");s.id="bb-css";
  s.textContent=`
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;700;800&display=swap');
    @keyframes splashRoll{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
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
    @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    @keyframes popIn{0%{transform:scale(.6);opacity:0}70%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
    @keyframes slideIn{from{opacity:0;transform:translateX(-18px)}to{opacity:1;transform:translateX(0)}}
    @keyframes scoreUp{0%{transform:scale(1)}50%{transform:scale(1.5);color:#4ade80}100%{transform:scale(1)}}
    @keyframes scoreDn{0%{transform:scale(1)}50%{transform:scale(1.3);color:#ef4444}100%{transform:scale(1)}}
    @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} @keyframes comboFire{0%{transform:scale(1) rotate(0)}25%{transform:scale(1.3) rotate(-3deg)}50%{transform:scale(1.1) rotate(3deg)}100%{transform:scale(1) rotate(0)}}
    @keyframes floatUp{0%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(-60px) scale(1.3)}}
    @keyframes slideInRight{from{opacity:0;transform:translateX(80px) translateY(20px)}to{opacity:1;transform:translateX(0) translateY(0)}}
    @keyframes confettiFall{0%{transform:translateY(-100vh) rotate(0deg);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
    @keyframes clubSlideLeft{0%{opacity:0;transform:translateX(-110%) scale(.88)}65%{transform:translateX(4%) scale(1.02)}100%{opacity:1;transform:translateX(0) scale(1)}}
    @keyframes clubSlideRight{0%{opacity:0;transform:translateX(110%) scale(.88)}65%{transform:translateX(-4%) scale(1.02)}100%{opacity:1;transform:translateX(0) scale(1)}}
    @keyframes vsAppear{0%{opacity:0;transform:scale(0) rotate(-15deg)}65%{transform:scale(1.25) rotate(4deg)}100%{opacity:1;transform:scale(1) rotate(0)}}
    @keyframes sheetUp{0%{transform:translateY(100%);opacity:0}100%{transform:translateY(0);opacity:1}}
    @keyframes answerOk{0%{transform:scale(1)}30%{transform:scale(1.06)}60%{transform:scale(.97)}100%{transform:scale(1)}}
    @keyframes answerKo{0%,100%{transform:translateX(0)}15%{transform:translateX(-12px)}30%{transform:translateX(10px)}45%{transform:translateX(-8px)}60%{transform:translateX(6px)}75%{transform:translateX(-3px)}}
    @keyframes flashOk{0%{background:rgba(74,222,128,0)}40%{background:rgba(74,222,128,.18)}100%{background:rgba(74,222,128,0)}}
    @keyframes flashKo{0%{background:rgba(239,68,68,0)}40%{background:rgba(239,68,68,.15)}100%{background:rgba(239,68,68,0)}}
    @keyframes chainPop{0%{transform:scale(.8);opacity:0}100%{transform:scale(1);opacity:1}}
    @keyframes playerDrop{0%{opacity:0;transform:translateY(-80%) scale(.88)}65%{transform:translateY(5%) scale(1.03)}100%{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes clubTagPop{0%{opacity:0;transform:scale(.7) translateX(-10px)}70%{transform:scale(1.08) translateX(2px)}100%{opacity:1;transform:scale(1) translateX(0)}}
    @keyframes optionIn{0%{opacity:0;transform:translateY(16px) scale(.95)}100%{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes optionPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}
    @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
    @keyframes floatBall{0%{transform:translateY(0) rotate(0deg)}100%{transform:translateY(-18px) rotate(20deg)}}
    @keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}
    @keyframes slideDown{from{opacity:0;transform:translateY(-20px)}to{opacity:1;transform:translateY(0)}}
    @keyframes kickBall{0%{transform:scale(1) rotate(0)}40%{transform:scale(1.15) rotate(-15deg)}100%{transform:scale(1) rotate(10deg)}}
    @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
    @keyframes heartbeat{0%,100%{transform:scale(1)}15%{transform:scale(1.15)}30%{transform:scale(1)}45%{transform:scale(1.1)}60%{transform:scale(1)}}
    @keyframes urgentPulse{0%,100%{opacity:1}50%{opacity:.6}} @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
    html,body,#root{background:#1E5C2A!important;min-height:100vh;min-height:100dvh;}
    html{background:#1E5C2A!important;}
    #root{background-image:repeating-linear-gradient(90deg,#1E5C2A 0,#1E5C2A 14.28%,#276B34 14.28%,#276B34 28.57%,#1E5C2A 28.57%,#1E5C2A 42.86%,#276B34 42.86%,#276B34 57.14%,#1E5C2A 57.14%,#1E5C2A 71.43%,#276B34 71.43%,#276B34 85.71%,#1E5C2A 85.71%)!important;padding-top:env(safe-area-inset-top);}
  `;
  // Favicon dynamique
const favLink = document.querySelector("link[rel*='icon']") || document.createElement('link');
favLink.type = 'image/png'; favLink.rel = 'icon';
favLink.href = 'data:image/png;base64,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';
document.head.appendChild(favLink);
document.title = 'GOAT FC';
// Favicon dynamique
(function(){
  var link = document.querySelector("link[rel*='icon']") || document.createElement('link');
  link.type = 'image/png';
  link.rel = 'shortcut icon';
  link.href = 'data:image/png;base64,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';
  document.getElementsByTagName('head')[0].appendChild(link);
})();
document.head.appendChild(s);
}

// ── NOTIFICATIONS ──
const NOTIF_MESSAGES = [
  { title:"⚽ GOAT FC t'attend !", body:"Tu connais tous les transferts ? Prouve-le !" },
  { title:"🏆 Bats ton record !", body:"Ton record t'attend. Reviens jouer !" },
  { title:"⚽ C'est l'heure du quiz !", body:"Qui a joué dans ces deux clubs ? Viens tester !" },
  { title:"🔗 La Chaîne t'appelle !", body:"Combien de clubs peux-tu enchaîner aujourd'hui ?" },
  { title:"📊 Le classement bouge !", body:"Quelqu'un a peut-être battu ton record..." },
];

function pickRandom(arr) { return arr[Math.floor(Math.random()*arr.length)]; }

async function requestNotifPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
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
    const msg = pickRandom(NOTIF_MESSAGES);
    sendNotif(msg.title, msg.body);
    scheduleNextNotif(); // Reschedule for next 24h
  }, h24);
}


export default function LePont() {
  const [showSplash, setShowSplash] = useState(true);
  const [screen, setScreen] = useState("home");
  const [resultImg, setResultImg] = useState(null);
  const [gameMode, setGameMode] = useState("pont");
  const [diff, setDiff] = useState("facile");
  const [totalRounds, setTotalRounds] = useState(1);
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
  const [feedback, setFeedback] = useState(null);
  const [options, setOptions] = useState([]);
  const [animKey, setAnimKey] = useState(0);
  const [scoreAnim, setScoreAnim] = useState(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [comboFloat, setComboFloat] = useState(null);
  const [chainPlayer, setChainPlayer] = useState("");
  const [chainUsedClubs, setChainUsedClubs] = useState(new Set());
  const [chainUsedPlayers, setChainUsedPlayers] = useState(new Set());
  const [chainCount, setChainCount] = useState(0);
  const [chainScore, setChainScore] = useState(0);
  const [chainHistory, setChainHistory] = useState([]);
  const [chainLastClub, setChainLastClub] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);
  const [hallOfFame, setHallOfFame] = useState([]);
  const [showHallOfFame, setShowHallOfFame] = useState(false);
  const [myLbRank, setMyLbRank] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const [myLastPts, setMyLastPts] = useState(null);
  const [winStreak, setWinStreak] = useState(0);
  const [wasAway, setWasAway] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [lbMode, setLbMode] = useState("global");
  const [dailyPlayer] = useState(() => getDailyPlayer());
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
  const [dailyTries, setDailyTries] = useState(0);
  const [dailyGuess, setDailyGuess] = useState("");
  const [dailyFlash, setDailyFlash] = useState(null);
  const [dailySuccess, setDailySuccess] = useState(false);
  const [showDailyGame, setShowDailyGame] = useState(false);
  const [dayStreak, setDayStreak] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem("bb_day_streak")||"{}");
      const today = (()=>{ const d=new Date(); const paris=new Date(d.toLocaleString('en-US',{timeZone:'Europe/Paris'})); return paris.getFullYear()+'-'+String(paris.getMonth()+1).padStart(2,'0')+'-'+String(paris.getDate()).padStart(2,'0'); })();
      const yesterday = new Date(Date.now()-86400000).toISOString().slice(0,10);
      if (s.lastDate === today || s.lastDate === yesterday) return s.count || 0;
      return 0;
    } catch { return 0; }
  });
  const [lbDiff, setLbDiff] = useState("facile");
  const [playerName, setPlayerName] = useState("");
  const [showInstructions, setShowInstructions] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  // Friends
  const [playerId] = useState(() => getPlayerId());
  const [showFriends, setShowFriends] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null); // {id, name}
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
  const [duelLoading, setDuelLoading] = useState(false);
  const [showDuelCreate, setShowDuelCreate] = useState(null); // friend object
  const [duelMode, setDuelMode] = useState("pont");
  const [duelDiff, setDuelDiff] = useState("facile");
  const [duelRounds, setDuelRounds] = useState(1);
  const [activeDuel, setActiveDuel] = useState(null); // duel being played
  const activeDuelRef = useRef(null);
  const [duelResult, setDuelResult] = useState(null); // completed duel for result screen
  const [waitingDuel, setWaitingDuel] = useState(null); // duel in waiting room
  // Room system (multi-player up to 8)
  const [room, setRoom] = useState(null);
  const [roomInput, setRoomInput] = useState("");
  const [pendingRoomCode, setPendingRoomCode] = useState(null);
  const [roomMsg, setRoomMsg] = useState("");
  const [abandonNotif, setAbandonNotif] = useState("");
  const [showRoomCreate, setShowRoomCreate] = useState(false);
  const roomPollRef = useRef(null);
  const [duelCountdown, setDuelCountdown] = useState(null); // 3..2..1 before launch
  const duelPollRef = useRef(null);
  const countdownRef = useRef(null);

  const [qTimeLeft, setQTimeLeft] = useState(5);
  const [pseudoScreen, setPseudoScreen] = useState(false); // show pseudo creation screen
  const [pseudoInput, setPseudoInput] = useState("");
  const [pseudoChecking, setPseudoChecking] = useState(false);
  const [pseudoMsg, setPseudoMsg] = useState("");
  const [playerAvatar, setPlayerAvatar] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [pseudoConfirmed, setPseudoConfirmed] = useState(() => { try { const n = localStorage.getItem("bb_name"); return !!(n && n.trim().length >= 2); } catch { return false; } });
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [gameConfigModal, setGameConfigModal] = useState(null);
  const [activeCard, setActiveCard] = useState("pont");
  const [swipeDelta, setSwipeDelta] = useState(0); // "pont" | "chaine" | "room-pont" | "room-chaine"
  const [waitingForRoom, setWaitingForRoom] = useState(false);
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
    try { if (!localStorage.getItem("bb_tutorial_done")) setShowTutorial(true); } catch {}
  }, []);


  // Load pseudo silently on mount
  useEffect(() => {
    (async function() {
      try {
        const mine = await sbFetch("bb_pseudos?player_id=eq."+playerId+"&limit=1");
        if (Array.isArray(mine) && mine.length > 0) {
          setPlayerName(mine[0].pseudo);
          try { localStorage.setItem("bb_name", mine[0].pseudo); } catch {}
          setPseudoConfirmed(true);
        } else {
          const saved = localStorage.getItem("bb_name");
          if (saved && saved.trim().length >= 2) setPlayerName(saved);
        }
      } catch {}
    })();
  }, []);

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

  // Question timer (Le Pont + La Chaîne)
  useEffect(()=>{
    chainPassedRef.current = false;
    clearInterval(qTimerRef.current);
    if(screen!=="game"&&screen!=="chainGame"){clearInterval(qTimerRef.current);return;}
    const duration = screen==="chainGame" ? CHAIN_QUESTION_DURATION : QUESTION_DURATION;
    const qStart = Date.now();
    const capturedChainCount = chainCount;
    chainPassedRef.current = false;
    setQTimeLeft(duration);
    clearInterval(qTimerRef.current);
    qTimerRef.current=setInterval(()=>{
      const elapsed = Math.floor((Date.now() - qStart) / 1000);
      const remaining = Math.max(duration - elapsed, 0);
      setQTimeLeft(remaining);
      if(remaining <= 0){
        clearInterval(qTimerRef.current);
        if(screen==="chainGame"){
          if(!chainPassedRef.current && capturedChainCount === chainCount){
            handleChainPassRef.current && handleChainPassRef.current();
          }
        } else {
          handlePassRef.current && handlePassRef.current();
        }
      }
    },300);
    return()=>clearInterval(qTimerRef.current);
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


  // Leaderboard (localStorage)
  // ── DUEL FUNCTIONS ──
  async function loadDuels() {
    try {
      const data = await sbFetch("bb_duels?or=(challenger_id.eq." + playerId + ",opponent_id.eq." + playerId + ")&order=created_at.desc&limit=20");
      setDuels(Array.isArray(data) ? data : []);
    } catch(e) { setDuels([]); }
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

  async function abandonRoom() {
    const duel = activeDuelRef.current;
    if (!duel || !duel.isRoom) return;
    const roomId = duel.id;
    try {
      const data = await sbFetch("bb_rooms?id=eq."+roomId+"&limit=1");
      if (!Array.isArray(data) || data.length === 0) return;
      const r = data[0];
      const players = typeof r.players === "string" ? JSON.parse(r.players) : r.players;
      const updated = players.map(function(p) {
        return p.id === playerId ? Object.assign({}, p, {score:0, status:"done", abandoned:true}) : p;
      });
      const allDone = updated.every(function(p){return p.status==="done";});
      await sbFetch("bb_rooms?id=eq."+roomId, {
        method:"PATCH",
        body:JSON.stringify({players:JSON.stringify(updated), status:allDone?"complete":"scoring"}),
        headers:{"Prefer":"return=minimal"}
      });
    } catch(e) { console.error("Abandon room error:", e); }
    activeDuelRef.current = null;
    setActiveDuel(null);
    clearInterval(roomPollRef.current);
  }

  async function submitDuelScore(sc) {
    if (!activeDuel) return;
    const duelId = activeDuel.id;
    const duelCopy = Object.assign({}, activeDuel);
    const isChallenger = activeDuel.challenger_id === playerId;
    const otherScore = isChallenger ? activeDuel.opponent_score : activeDuel.challenger_score;
    const newStatus = (otherScore !== null && otherScore !== undefined) ? "complete" : (isChallenger ? "challenger_played" : "opponent_played");
    const update = isChallenger ? { challenger_score: sc, status: newStatus } : { opponent_score: sc, status: newStatus };
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
        setDuelResult({ myScore, theirScore, oppName, mode: duelCopy.mode });
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
      if (!Array.isArray(data) || data.length === 0) { setRoomMsg("Salle introuvable"); return; }
      const r = data[0];
      if (r.status !== "waiting") { setRoomMsg("Partie déjà lancée !"); return; }
      const players = typeof r.players === "string" ? JSON.parse(r.players) : r.players;
      if (players.length >= 8) { setRoomMsg("Salle pleine (8/8)"); return; }
      if (players.find(function(p){return p.id===playerId;})) {
        setRoom(r); startRoomPolling(r.id); return;
      }
      const newPlayers = [...players, {id:playerId, name:name, score:null, status:"waiting"}];
      await sbFetch("bb_rooms?id=eq."+r.id, {
        method:"PATCH",
        body:JSON.stringify({players:JSON.stringify(newPlayers)}),
        headers:{"Prefer":"return=minimal"}
      });
      const updated = await sbFetch("bb_rooms?id=eq."+r.id+"&limit=1");
      if (Array.isArray(updated) && updated.length > 0) {
        setRoom(updated[0]);
        setRoomInput("");
        setRoomMsg("");
        startRoomPolling(r.id);
      }
    } catch(e) { console.error(e); setRoomMsg("Erreur connexion"); }
  }

  function startRoomPolling(roomId) {
    clearInterval(roomPollRef.current);
    let gameStarted = false;
    roomPollRef.current = setInterval(async function() {
      try {
        const data = await sbFetch("bb_rooms?id=eq."+roomId+"&limit=1");
        if (!Array.isArray(data) || data.length === 0) return;
        const r = data[0];
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
          setAbandonNotif(names + (abandoned.length > 1 ? " ont abandonné 🏃" : " a abandonné 🏃"));
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
      const updated = players.map(function(p) {
        return p.id === playerId
          ? Object.assign({}, p, {partial_score: scoreRef.current})
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


  async function submitRoomScore(sc) {
    const duel = activeDuelRef.current;
    if (!duel || !duel.isRoom) return;
    const roomId = duel.id;
    setWaitingForRoom(true);
    setActiveDuel(null);
    activeDuelRef.current = null;
    try {
      const data = await sbFetch("bb_rooms?id=eq."+roomId+"&limit=1");
      if (!Array.isArray(data) || data.length === 0) { setWaitingForRoom(false); return; }
      const r = data[0];
      const players = typeof r.players === "string" ? JSON.parse(r.players) : r.players;
      const updated = players.map(function(p){
        return p.id === playerId ? Object.assign({}, p, {score:sc, status:"done"}) : p;
      });
      const allDone = updated.every(function(p){return p.status==="done";});
      await sbFetch("bb_rooms?id=eq."+roomId, {
        method:"PATCH",
        body:JSON.stringify({players:JSON.stringify(updated), status:allDone?"complete":"scoring"}),
        headers:{"Prefer":"return=minimal"}
      });
      if (allDone) {
        // On est le dernier — afficher les résultats directement
        const finalData = await sbFetch("bb_rooms?id=eq."+roomId+"&limit=1");
        if (Array.isArray(finalData) && finalData.length > 0) {
          showRoomResults(finalData[0]);
        }
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
          setAbandonNotif(names + (abandoned.length > 1 ? " ont abandonné 🏃" : " a abandonné 🏃"));
          setTimeout(function(){setAbandonNotif("");}, 5000);
        }
        const allDone = players.every(function(p){return p.status==="done";});
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
    setScreen("home");
    const players = typeof r.players === "string" ? JSON.parse(r.players) : r.players;
    const sorted = [...players].sort(function(a,b){return (b.score||0)-(a.score||0);});
    const meInRoom = players.find(function(p){return p.id===playerId;}); const myRankInRoom = sorted.findIndex(function(p){return p.id===playerId;}); const roomImgs = myRankInRoom === 0 ? WIN_IMGS : LOSE_IMGS; setResultImg(roomImgs[Math.floor(Math.random()*roomImgs.length)]); setDuelResult({isRoom:true, players:sorted, mode:r.mode});
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
    if (clean.length < 3) { setPseudoMsg("❌ Minimum 3 caractères"); return; }
    if (clean.length > 16) { setPseudoMsg("❌ Maximum 16 caractères"); return; }
    if (/\s/.test(clean)) { setPseudoMsg("❌ Pas d'espaces"); return; }
    if (!/^[a-zA-Z0-9_\-]+$/.test(clean)) { setPseudoMsg("❌ Lettres, chiffres, _ et - uniquement"); return; }
    if (/^[_\-]/.test(clean) || /[_\-]$/.test(clean)) { setPseudoMsg("❌ Ne peut pas commencer ou finir par _ ou -"); return; }
    setPseudoChecking(true);
    setPseudoMsg("Vérification...");
    try {
      // Check if pseudo already taken
      const existing = await sbFetch("bb_pseudos?pseudo=eq."+encodeURIComponent(clean)+"&limit=1");
      if (Array.isArray(existing) && existing.length > 0) {
        if (existing[0].player_id === playerId) {
          // It's mine - confirm it
          setPseudoConfirmed(true);
          setPseudoScreen(false);
          setPlayerName(clean);
          try { localStorage.setItem("bb_name", clean); } catch {}
          setPseudoMsg("");
        } else {
          setPseudoMsg("❌ Ce pseudo est déjà pris !");
        }
        setPseudoChecking(false);
        return;
      }
      // Check if I already have a pseudo
      const mine = await sbFetch("bb_pseudos?player_id=eq."+playerId+"&limit=1");
      if (Array.isArray(mine) && mine.length > 0) {
        // Update existing pseudo
        await sbFetch("bb_pseudos?player_id=eq."+playerId, {
          method: "PATCH",
          body: JSON.stringify({pseudo: clean}),
          headers: {"Prefer": "return=minimal"}
        });
      } else {
        // Create new pseudo
        await sbFetch("bb_pseudos", {
          method: "POST",
          body: JSON.stringify({player_id: playerId, pseudo: clean})
        });
      }
      setPlayerName(clean);
      try { localStorage.setItem("bb_name", clean); } catch {}
      setPseudoConfirmed(true);
      setPseudoScreen(false);
      setPseudoMsg("✓ Pseudo réservé !");
    } catch(e) {
      setPseudoMsg("Erreur: "+e.message);
    }
    setPseudoChecking(false);
  }

  async function initPseudo() {
    // Check if player already has a confirmed pseudo
    const saved = (() => { try { return localStorage.getItem("bb_name"); } catch { return null; } })();
    if (saved && saved.trim().length >= 2) {
      // Verify it's still valid in DB
      try {
        const mine = await sbFetch("bb_pseudos?player_id=eq."+playerId+"&limit=1");
        if (Array.isArray(mine) && mine.length > 0) {
          setPlayerName(mine[0].pseudo);
          localStorage.setItem("bb_name", mine[0].pseudo);
          setPseudoConfirmed(true);
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

  async function addFriend(pseudo) {
    const clean = pseudo.trim();
    if (clean.length < 2) { setFriendMsg("Pseudo trop court"); return; }
    if (clean.toLowerCase() === (playerName||"").toLowerCase()) { setFriendMsg("C'est ton propre pseudo !"); return; }
    setFriendMsg("🔍 Recherche...");
    try {
      // Chercher le player_id correspondant au pseudo
      const result = await sbFetch("bb_pseudos?pseudo=ilike."+encodeURIComponent(clean)+"&limit=1");
      if (!Array.isArray(result) || result.length === 0) {
        setFriendMsg("❌ Pseudo introuvable. Vérifie l'orthographe.");
        return;
      }
      const targetId = result[0].player_id;
      const targetName = result[0].pseudo;
      if (targetId === playerId) { setFriendMsg("C'est ton propre pseudo !"); return; }
      if (friendsList.includes(targetId)) { setFriendMsg("Vous êtes déjà amis !"); return; }
      const alreadySent = sentRequests.find(function(r){return r.to_id===targetId && r.status==="pending";});
      if (alreadySent) { setFriendMsg("Demande déjà envoyée à "+targetName+" !"); return; }
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
        setFriendMsg("❌ Erreur. Réessaie.");
        return;
      }
      setFriendMsg("✓ Demande envoyée à "+targetName+" !");
      setFriendInput("");
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
    } catch(e) { setFriendMsg("❌ Erreur réseau. Réessaie."); }
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
    const { seasonNumber, seasonStartDate, seasonEndDate } = getCurrentSeason();
    const now = new Date();
    // Vérifier si la saison précédente a déjà été clôturée
    try {
      const prev = await sbFetch("bb_seasons?season_number=eq."+(seasonNumber-1)+"&limit=1");
      if (Array.isArray(prev) && prev.length > 0) return; // déjà clôturée
      if (seasonNumber <= 1) return; // pas encore de saison à clôturer
      // Récupérer le champion de la saison précédente
      const prevStart = new Date(SEASON_START.getTime() + (seasonNumber - 2) * SEASON_DURATION_DAYS * 86400000);
      const prevEnd = seasonStartDate;
      const scores = await sbFetch("bb_scores?order=score.desc&limit=1000&select=player_id,player_name,score,mode&created_at=gte."+prevStart.toISOString()+"&created_at=lt."+prevEnd.toISOString());
      if (!Array.isArray(scores) || scores.length === 0) return;
      // Calculer le meilleur score par joueur
      const stats = {};
      scores.forEach(function(r) {
        if (!stats[r.player_id]) stats[r.player_id] = { name: r.player_name, bestPont: 0, bestChaine: 0 };
        if (r.mode === "pont" && r.score > stats[r.player_id].bestPont) stats[r.player_id].bestPont = r.score;
        if (r.mode === "chaine" && r.score > stats[r.player_id].bestChaine) stats[r.player_id].bestChaine = r.score;
      });
      const ranked = Object.entries(stats).map(function([pid, s]) {
        return { pid, name: s.name, score: s.bestPont + s.bestChaine };
      }).sort(function(a, b) { return b.score - a.score; });
      if (ranked.length === 0) return;
      const champion = ranked[0];
      await sbFetch("bb_seasons", {
        method: "POST",
        body: JSON.stringify({ season_number: seasonNumber - 1, champion_name: champion.name, champion_score: champion.score, champion_id: champion.pid })
      });
      loadSeasons();
    } catch(e) {}
  }

  async function loadLeaderboard(mode) {
    try {
      const isAmis = mode === "amis";
      const isGlobal = mode === "global" || isAmis;
      const season = getCurrentSeason();

      // Couronner le champion de la saison précédente si pas encore fait
      if (season.num > 1) {
        try {
          const prevSeason = season.num - 1;
          const existing = await sbFetch("bb_seasons?season_number=eq."+prevSeason+"&limit=1");
          if (Array.isArray(existing) && existing.length === 0) {
            const prevStart = new Date(SEASON_START.getTime() + (prevSeason-1) * SEASON_DURATION_DAYS * 24*60*60*1000);
            const prevEnd = new Date(prevStart.getTime() + SEASON_DURATION_DAYS * 24*60*60*1000);
            const prevScores = await sbFetch("bb_scores?order=score.desc&limit=1000&select=player_id,player_name,score&created_at=gte."+prevStart.toISOString()+"&created_at=lt."+prevEnd.toISOString());
            if (Array.isArray(prevScores) && prevScores.length > 0) {
              const best = {};
              prevScores.forEach(function(r){ if(!best[r.player_id]||r.score>best[r.player_id].score) best[r.player_id]=r; });
              const champ = Object.values(best).sort(function(a,b){return b.score-a.score;})[0];
              if (champ) await sbFetch("bb_seasons", {method:"POST", body:JSON.stringify({season_number:prevSeason, champion_name:champ.player_name, champion_score:champ.score, champion_id:champ.player_id})});
            }
          }
        } catch(e){}
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
        stats[row.player_id].played += 1;
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
            const sorted = [...players].sort(function(a,b){return (b.score||0)-(a.score||0);});
            const topScore = sorted[0].score || 0;
            players.forEach(function(p) {
              const pid = p.id;
              if (!pid || !stats[pid]) return;
              if (!stats[pid].wins) stats[pid].wins = 0;
              if (!stats[pid].draws) stats[pid].draws = 0;
              if (!stats[pid].losses) stats[pid].losses = 0;
              const myScore = p.score || 0;
              const winners = players.filter(function(x){return (x.score||0)===topScore;});
              if (myScore === topScore && winners.length === 1) stats[pid].wins++;
              else if (myScore === topScore && winners.length > 1) stats[pid].draws++;
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
    const now = Date.now();
    const elapsed = (now - lastAnswerTime.current) / 1000;
    lastAnswerTime.current = now;
    const speedBonus = elapsed <= COMBO_THRESHOLD ? 1 : 0;
    const newCombo = comboRef.current + 1;
    const comboBonus = newCombo>=10?3:newCombo>=5?2:newCombo>=3?1:0;
    const total = base + speedBonus + comboBonus;
    setCombo(newCombo); if(newCombo>maxCombo) setMaxCombo(newCombo);
    if(comboBonus>0||speedBonus>0){
      const parts=[];
      if(speedBonus)parts.push("⚡ SPEED");
      if(comboBonus)parts.push(`x${newCombo} COMBO +${comboBonus}`);
      setComboFloat(parts.join(" · "));
      playSound("combo");
      setTimeout(()=>setComboFloat(null),1200);
    }else{playSound("ok");}
    if(isChain){setChainScore(s=>{chainScoreRef.current=s+total;return s+total;});}
    else{setScore(s=>{scoreRef.current=s+total;return s+total;});}
    setScoreAnim("up"); setTimeout(()=>setScoreAnim(null),600);
    return total;
  }

  function handleWrongAnswer(penalty, isChain=false) {
    setCombo(0); comboRef.current=0; playSound("ko");
    if(isChain){setChainScore(s=>{chainScoreRef.current=s-penalty;return s-penalty;});}
    else{setScore(s=>{scoreRef.current=s-penalty;return s-penalty;});}
    setScoreAnim("down"); setTimeout(()=>setScoreAnim(null),600);
  }


  function endRound() {
    clearInterval(timerRef.current);
    const rs = scoreRef.current;
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
        updateDayStreak();
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
      if(!prev||sc>prev.score){
        const rec={score:sc,date:new Date().toLocaleDateString("fr-FR"),name:playerName};
        localStorage.setItem("bb_chain_record",JSON.stringify(rec));
        setChainRecord(rec); setIsNewRecord(true); setShowConfetti(true); setTimeout(()=>setShowConfetti(false),4000);
      }else{setIsNewRecord(false);}
    }catch{}
    submitToLeaderboard(playerName,sc,"chaine",diff);
    updateDayStreak();
    if(activeDuelRef.current&&activeDuelRef.current.isRoom){setScreen("waitingRoom");submitRoomScore(sc);}else if(activeDuel){submitDuelScore(sc); setScreen("chainEnd");}else{setScreen("chainEnd");}
  }

  function startRound(round) {
    roundStartTime.current = null; // timer will set on next tick
    const dbPool = DB[diff] || DB["facile"] || [];
    if (dbPool.length === 0) { console.error("DB empty for diff:", diff); return; }
    // 80% current players, 20% retired/legends
    const currentQ = dbPool.filter(q => q.isCurrent);
    const retiredQ = dbPool.filter(q => !q.isCurrent);
    const targetCurrent = Math.round(dbPool.length * 0.8);
    const targetRetired = dbPool.length - targetCurrent;
    const picked = [
      ...shuffle([...currentQ]).slice(0, Math.max(targetCurrent, currentQ.length)),
      ...shuffle([...retiredQ]).slice(0, Math.min(targetRetired, retiredQ.length)),
    ];
    const q = shuffle(picked.length > 0 ? picked : [...dbPool]);
    queueRef.current = q;
    setQueue(q); setQIdx(0); setScore(0); scoreRef.current=0;
    setTimeLeft(ROUND_DURATION); setGuess(""); setFlash(null); setFeedback(null);
    if(diff==="facile") setOptions(generateOptions(q[0].p, DB[diff]||[]));
    setCurrentRound(round); setAnimKey(0); setScreen("game");
    setTimeout(()=>inputRef.current?.focus(),200);
  }

  function startChain() {
    roundStartTime.current = null;
    setIsNewRecord(false); setMyLastPts(null); setCombo(0); setMaxCombo(0); comboRef.current=0; lastAnswerTime.current=Date.now();
    // Filtrer par difficulté — en facile on commence par des stars connues
    const eligible = PLAYERS_CLEAN.filter(p => {
      if (p.clubs.length < 2) return false;
      if (diff === "facile") return p.diff === "facile";
      if (diff === "moyen") return p.diff === "facile" || p.diff === "moyen";
      return true; // expert = tous
    });
    const pool = eligible.length > 0 ? eligible : PLAYERS_CLEAN.filter(p => p.clubs.length >= 2);
    // 80% chance to start with a current player
    const currentPool = pool.filter(p => !isRetiredPlayer(p.name));
    const retiredPool = pool.filter(p => isRetiredPlayer(p.name));
    const useCurrentStart = Math.random() < 0.8 && currentPool.length > 0;
    const startPool = useCurrentStart ? currentPool : (retiredPool.length > 0 ? retiredPool : pool);
    const start = startPool[Math.floor(Math.random() * startPool.length)];
    const usedP = new Set([start.name]);
    
    setChainPlayer(start.name); setChainUsedClubs(new Set()); setChainUsedPlayers(usedP);
    setChainCount(0); setChainScore(0); chainScoreRef.current=0;
    setChainLastClub(""); setChainHistory([]); setGuess(""); setFlash(null); setFeedback(null);
    setTimeLeft(CHAIN_DURATION); setScore(0); scoreRef.current=0;
    setMyLbRank(null); setScreen("chainGame");
    setTimeout(()=>inputRef.current?.focus(),200);
  }

  function startCompetition() {
    setCombo(0); setMaxCombo(0); comboRef.current=0; lastAnswerTime.current=Date.now();
    setRoundScores([]); setCurrentRound(1); setIsNewRecord(false); setMyLbRank(null); setMyLastPts(null);
    startRound(1);
  }

  function updateDayStreak() {
    try {
      const today = (()=>{ const d=new Date(); const paris=new Date(d.toLocaleString('en-US',{timeZone:'Europe/Paris'})); return paris.getFullYear()+'-'+String(paris.getMonth()+1).padStart(2,'0')+'-'+String(paris.getDate()).padStart(2,'0'); })();
      const s = JSON.parse(localStorage.getItem("bb_day_streak")||"{}");
      if (s.lastDate === today) return; // déjà compté aujourd'hui
      const yesterday = new Date(Date.now()-86400000).toISOString().slice(0,10);
      const newCount = s.lastDate === yesterday ? (s.count||0) + 1 : 1;
      const updated = { count: newCount, lastDate: today };
      localStorage.setItem("bb_day_streak", JSON.stringify(updated));
      setDayStreak(newCount);
    } catch(e){}
  }

  function handleDailySubmit() {
    if (!dailyGuess.trim() || !dailyPlayer) return;
    const normalize = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
    const guess = normalize(dailyGuess);
    const answer = normalize(dailyPlayer.name);
    const newTries = dailyTries + 1;
    setDailyTries(newTries);
    const answerParts = answer.split(" ");
    const isCorrect = guess === answer
      || answerParts.some(function(p){ return p.length > 3 && guess === p; })
      || (answer.includes(guess) && guess.length > 4);
    if (isCorrect) {
      setDailySuccess(true);
      setDailyFlash("ok");
      const today = (()=>{ const d=new Date(); const paris=new Date(d.toLocaleString('en-US',{timeZone:'Europe/Paris'})); return paris.getFullYear()+'-'+String(paris.getMonth()+1).padStart(2,'0')+'-'+String(paris.getDate()).padStart(2,'0'); })();
      try {
        localStorage.setItem("bb_daily_result", JSON.stringify({date:today, abandoned:false, tries:newTries}));
        localStorage.setItem("bb_daily_tries", String(newTries));
      } catch{}
      setTimeout(function(){
        setShowDailyGame(false);
        setDailyDone(true);
        setDailyAbandoned(false);
        setDailySuccess(false);
        updateDayStreak();
      }, 3000);
    } else {
      setDailyFlash("ko");
      setTimeout(function(){ setDailyFlash(null); setDailyGuess(""); }, 800);
    }
  }

  function nextQ() {
    setQIdx(i=>{
      const next = i+1;
      // If we've gone through the whole queue, rebuild with fresh shuffle
      if (next >= queue.length) {
        const fresh = shuffle(DB[diff]);
        setQueue(fresh);
        if(diff==="facile") setOptions(generateOptions(fresh[0].p, DB[diff]));
        return 0;
      }
      if(diff==="facile") setOptions(generateOptions(queue[next].p,DB[diff]));
      return next;
    });
    setGuess(""); setFlash(null); setAnimKey(k=>k+1);
    if(diff!=="facile") setTimeout(()=>inputRef.current?.focus(),100);
  }

  function handleSubmit() {
    const g=guess.trim(); if(!g) return;
    const cur=queue[qIdx%Math.max(queue.length,1)];
    if(checkGuess(g,cur.p)){
      setFlash("ok"); setFeedback("ok"); handleCorrectAnswer(2);
      setTimeout(()=>{setFlash(null);setFeedback(null);nextQ();},900);
    }else{
      setFlash("ko"); setFeedback("ko"); handleWrongAnswer(1);
      setTimeout(()=>{setFlash(null);setFeedback(null);setGuess("");inputRef.current?.focus();},900);
    }
  }

  function handlePass() {
    clearInterval(qTimerRef.current);
    setScore(s=>{scoreRef.current=s-.5;return s-.5;});
    nextQ();
  }
  handlePassRef.current = handlePass;

  function handleOptionClick(opt) {
    if(flash) return;
    const cur=queue[qIdx%Math.max(queue.length,1)];
    if(checkGuess(opt,cur.p)){
      setFlash("ok"); setFeedback("ok"); handleCorrectAnswer(2);
      setTimeout(()=>{setFlash(null);setFeedback(null);nextQ();},900);
    }else{
      setFlash(opt); setFeedback("ko"); handleWrongAnswer(1);
      setTimeout(()=>{setFlash(null);setFeedback(null);},900);
    }
  }

  function handleChainSubmit() {
    const g=guess.trim(); if(!g) return;
    const playerClubs=getPlayerClubs(chainPlayer);
    const available=playerClubs.filter(c=>!chainUsedClubs.has(c));
    const matched=matchClub(g,available);
    if(matched){
      const newUsed=new Set(chainUsedClubs); newUsed.add(matched); setChainUsedClubs(newUsed);
      setChainHistory(prev=>[...prev,{player:chainPlayer,club:matched}]);
      setChainCount(c=>c+1); handleCorrectAnswer(2,true);
      setFeedback("ok"); setFlash("ok");
      const clubPlayers=getPlayersForClub(matched).filter(p=>!chainUsedPlayers.has(p)&&getPlayerClubs(p).some(c=>!newUsed.has(c)));
      if(clubPlayers.length===0){setTimeout(()=>{setFeedback(null);setFlash(null);endChain();},800);return;}
      // Favoriser les joueurs de la bonne difficulté ET les joueurs actuels (80/20)
      const preferred = clubPlayers.filter(p => {
        const pd = PLAYERS_CLEAN.find(x=>x.name===p)?.diff;
        if(diff==="facile") return pd==="facile";
        if(diff==="moyen") return pd==="facile"||pd==="moyen";
        return true;
      });
      const diffPool = preferred.length > 0 ? preferred : clubPlayers;
      // 80% current players
      const currentNext = diffPool.filter(p => !isRetiredPlayer(p));
      const useCurrent = Math.random() < 0.8 && currentNext.length > 0;
      const nextPool = useCurrent ? currentNext : diffPool;
      const next=nextPool[Math.floor(Math.random()*nextPool.length)];
      const newUsedP=new Set(chainUsedPlayers); newUsedP.add(next);
      // Prefetch logos for next player
      
      setTimeout(()=>{setChainPlayer(next);setChainUsedPlayers(newUsedP);setChainLastClub(matched);setGuess("");setFeedback(null);setFlash(null);setTimeout(()=>inputRef.current?.focus(),100);},700);
    }else if(matchClub(g,playerClubs)){
      setFlash("used"); setFeedback("used"); playSound("ko");
      setTimeout(()=>{setFlash(null);setFeedback(null);setGuess("");inputRef.current?.focus();},1200);
    }else{
      handleWrongAnswer(1,true); setFeedback("ko"); setFlash("ko");
      setTimeout(()=>{setFlash(null);setFeedback(null);setGuess("");inputRef.current?.focus();},900);
    }
  }

  function handleChainPass() {
    if(chainPassedRef.current) return; // already passed this question
    clearInterval(qTimerRef.current);
    chainPassedRef.current = true;
    setChainScore(s=>{chainScoreRef.current=s-.5;return s-.5;});
    const validClubs=(PLAYERS_CLEAN.find(p=>p.name===chainPlayer)?.clubs||[]).filter(c=>!chainUsedClubs.has(c));
    const chosen=validClubs.length>0?validClubs[Math.floor(Math.random()*validClubs.length)]:null;
    if(!chosen){endChain();return;}
    const newUsed=new Set(chainUsedClubs); newUsed.add(chosen);
    const clubPlayers=getPlayersForClub(chosen).filter(p=>!chainUsedPlayers.has(p)&&getPlayerClubs(p).some(c=>!newUsed.has(c)));
    if(clubPlayers.length===0){endChain();return;}
    const preferred2 = clubPlayers.filter(p => {
      const pd = PLAYERS_CLEAN.find(x=>x.name===p)?.diff;
      if(diff==="facile") return pd==="facile";
      if(diff==="moyen") return pd==="facile"||pd==="moyen";
      return true;
    });
    const diffPool2 = preferred2.length > 0 ? preferred2 : clubPlayers;
    const currentNext2 = diffPool2.filter(p => !isRetiredPlayer(p));
    const useCurrent2 = Math.random() < 0.8 && currentNext2.length > 0;
    const nextPool2 = useCurrent2 ? currentNext2 : diffPool2;
    const next=nextPool2[Math.floor(Math.random()*nextPool2.length)];
    const newUsedP=new Set(chainUsedPlayers); newUsedP.add(next);
    setChainUsedClubs(newUsed); setChainUsedPlayers(newUsedP);
    setChainHistory(prev=>[...prev,{player:chainPlayer,club:chosen,passed:true}]);
    setChainPlayer(next); setChainLastClub(chosen); setGuess("");
    setTimeout(()=>inputRef.current?.focus(),100);
    setAnimKey(k=>k+1); // relance le timer de question pour le nouveau joueur
  }
  handleChainPassRef.current = handleChainPass;

  function requirePseudo(callback) {
    if (!pseudoConfirmed || !playerName.trim()) {
      setPseudoScreen(true);
      return;
    }
    callback();
  }

  function tryStart(mode) {
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
  // Design system
  const G = {
    bg:"#1E5C2A",bgPanel:"rgba(0,0,0,.5)",bgCard:"#141414",dark:"#0a0a0a",white:"#ffffff",
    offWhite:"#F5F5F5",accent:"#00E676",gold:"#FFD600",red:"#FF3D57",
    font:"'Bebas Neue',cursive,sans-serif",heading:"'Bebas Neue',cursive,sans-serif",
  };
  const shell = {
    minHeight:"100vh",display:"flex",flexDirection:"column",
    background:"transparent",
    fontFamily:G.font,position:"relative",overflow:"hidden",
    maxWidth:430,marginLeft:"auto",marginRight:"auto",
    boxShadow:"0 0 60px rgba(0,0,0,.5)",
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

  const feedbackBar = (fb) => {
    if(!fb) return null;
    return (
      <div style={{position:"fixed",top:0,left:0,right:0,zIndex:50,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"10px 16px",
        background:fb==="ok"?"#dcfce7":fb==="ko"?"#fee2e2":"#fef9c3",
        border:`2px solid ${fb==="ok"?G.accent:fb==="ko"?G.red:"#fbbf24"}`,
        animation:fb==="ok"?"answerOk .5s ease":fb==="ko"?"answerKo .4s ease":"popIn .3s ease",
      }}>
        {fb==="ok"&&<><div style={{display:"flex",alignItems:"center",gap:8,fontSize:17,fontWeight:800,color:"#16a34a"}}>{Icon.ball(18,"#16a34a")} BONNE RÉPONSE !</div><div style={{fontSize:12,fontWeight:600,color:"#16a34a",opacity:.7}}>+2 pts</div></>}
        {fb==="ko"&&<><div style={{display:"flex",alignItems:"center",gap:8,fontSize:17,fontWeight:800,color:G.red}}>{Icon.whistle(18,G.red)} MAUVAISE RÉPONSE</div><div style={{fontSize:12,fontWeight:600,color:G.red,opacity:.7}}>−1 pt</div></>}
        {fb==="used"&&<div style={{display:"flex",alignItems:"center",gap:8,fontSize:15,fontWeight:800,color:"#d97706"}}>{Icon.flag(16,"#d97706")} CLUB DÉJÀ UTILISÉ</div>}
      </div>
    );
  };

  const instructionsPopup = showInstructions&&(
    <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.6)",backdropFilter:"blur(6px)",animation:"fadeIn .2s ease"}}>
      <div style={{background:G.white,borderRadius:28,padding:"32px 24px",maxWidth:360,width:"calc(100% - 40px)",animation:"popIn .3s ease",textAlign:"center"}}>
        <div style={{marginBottom:12,display:"flex",justifyContent:"center"}}>{showInstructions==="pont"?Icon.pitch(52,G.dark):Icon.transfer(52,G.dark)}</div>
        <div style={{fontFamily:G.heading,fontSize:32,color:G.dark,letterSpacing:2,marginBottom:16}}>
          {showInstructions==="pont"?"THE PLUG":"THE MERCATO"}
        </div>
        {showInstructions==="pont"?(
          <div style={{fontSize:14,color:"#555",lineHeight:1.8,marginBottom:20}}>
            Deux clubs s'affichent. Trouve <strong>un joueur</strong> qui a joué dans les deux !<br/><br/>
            <span style={{color:"#16a34a",fontWeight:800}}>✓ +2</span> bonne réponse &nbsp;·&nbsp; <span style={{color:G.red,fontWeight:800}}>✗ −1</span> mauvaise &nbsp;·&nbsp; <span style={{color:"#aaa",fontWeight:800}}>→ −0.5</span> passer<br/><br/>
            <span style={{fontSize:12,color:"#999"}}>🔥 Réponds vite pour activer les combos !</span>
          </div>
        ):(
          <div style={{fontSize:14,color:"#555",lineHeight:1.8,marginBottom:20}}>
            Un joueur apparaît → donne un <strong>club</strong> où il a joué → un nouveau joueur de ce club → et ainsi de suite !<br/><br/>
            <strong>Un club ne peut être cité qu'une seule fois.</strong><br/>
            <span style={{fontSize:12,color:"#999"}}>Abréviations acceptées (PSG, Barça, Juve...)</span>
          </div>
        )}
        <button onClick={dismissInstructions} style={{width:"100%",padding:"16px",background:G.dark,color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:16,fontWeight:800,letterSpacing:1}}>
          C'est parti ! →
        </button>
      </div>
    </div>
  );


  // ── NOTIFICATION PROMPT ──
  const notifPrompt = showNotifPrompt && !notifGranted && (
    <div style={{position:"fixed",bottom:20,left:16,right:16,zIndex:500,animation:"fadeUp .4s ease"}}>
      <div style={{background:G.dark,borderRadius:20,padding:"16px 18px",boxShadow:"0 8px 32px rgba(0,0,0,.4)",display:"flex",flexDirection:"column",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{fontSize:28}}>🔔</div>
          <div>
            <div style={{fontSize:14,fontWeight:800,color:G.white}}>Reçois des rappels !</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.6)",marginTop:2}}>On te pinguera si t'as pas joué depuis 24h</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={async ()=>{
            const ok = await requestNotifPermission();
            setNotifGranted(ok);
            setShowNotifPrompt(false);
            if(ok) scheduleNextNotif();
          }} style={{flex:2,padding:"11px",background:"#16a34a",color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:800}}>
            ✓ Oui, active !
          </button>
          <button onClick={()=>setShowNotifPrompt(false)} style={{flex:1,padding:"11px",background:"rgba(255,255,255,.06)",color:"rgba(255,255,255,.6)",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:600}}>
            Plus tard
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
          <div style={{fontSize:13,fontWeight:800,color:G.white}}>Content de te revoir ! 🙌</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.8)",marginTop:1}}>Ça fait +24h — ton record t'attend !</div>
        </div>
        <button onClick={()=>setWasAway(false)} style={{background:"rgba(255,255,255,.2)",border:"none",borderRadius:20,width:26,height:26,cursor:"pointer",color:G.white,fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
      </div>
    </div>
  );

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
        <div style={{...shell,overflow:"auto"}} key="friendDetail">
          <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
            {[0,1,2,3,4,5,6].map(function(i){return(<div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>);})}
            <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
            <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
            <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
          </div>
          <div style={{zIndex:3,padding:"12px 16px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            {backBtn(function(){setSelectedFriend(null);})}
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
              <div style={{fontFamily:G.heading,fontSize:22,color:G.white,letterSpacing:2}}>{selectedFriend.name}</div>
              {isUnbeaten && <div style={{fontSize:11,fontWeight:800,color:"#FFD700",background:"rgba(255,215,0,.15)",borderRadius:20,padding:"3px 10px",letterSpacing:.5}}>😤 T'es invaincu contre lui</div>}
              {theyDominate && <div style={{fontSize:11,fontWeight:800,color:"#FF3D57",background:"rgba(255,61,87,.15)",borderRadius:20,padding:"3px 10px",letterSpacing:.5}}>💀 Il t'a jamais perdu contre toi</div>}
            </div>
            <button onClick={function(){setShowDuelCreate({id:selectedFriend.id,name:selectedFriend.name});}} style={{padding:"8px 14px",background:G.accent,color:"#000",border:"none",borderRadius:20,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:800}}>⚡ Défier</button>
          </div>
          <div style={{...sheet,borderRadius:"28px 28px 0 0",marginTop:16}}>
            {/* Bilan */}
            {friendDuels.length > 0 && (
              <div style={{display:"flex",gap:8,marginBottom:4}}>
                <div style={{flex:1,background:"rgba(0,230,118,.08)",border:"1px solid rgba(0,230,118,.2)",borderRadius:16,padding:"14px 0",textAlign:"center"}}>
                  <div style={{fontFamily:G.heading,fontSize:32,color:"#00E676"}}>{wins}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase",marginTop:2}}>Victoires</div>
                </div>
                <div style={{flex:1,background:"rgba(255,214,0,.06)",border:"1px solid rgba(255,214,0,.2)",borderRadius:16,padding:"14px 0",textAlign:"center"}}>
                  <div style={{fontFamily:G.heading,fontSize:32,color:G.gold}}>{draws}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase",marginTop:2}}>Nuls</div>
                </div>
                <div style={{flex:1,background:"rgba(255,61,87,.06)",border:"1px solid rgba(255,61,87,.2)",borderRadius:16,padding:"14px 0",textAlign:"center"}}>
                  <div style={{fontFamily:G.heading,fontSize:32,color:"#FF3D57"}}>{losses}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase",marginTop:2}}>Défaites</div>
                </div>
              </div>
            )}
            {/* Historique */}
            <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.3)",marginBottom:8,marginTop:4}}>Historique</div>
            {friendDuels.length===0 && (
              <div style={{textAlign:"center",padding:"32px 0",color:"rgba(255,255,255,.3)",fontSize:14}}>Aucun duel encore joué avec {selectedFriend.name} 👀</div>
            )}
            {friendDuels.map(function(d,i){
              const myScore = d.challenger_id===playerId ? d.challenger_score : d.opponent_score;
              const theirScore = d.challenger_id===playerId ? d.opponent_score : d.challenger_score;
              const won = myScore>theirScore; const draw = myScore===theirScore;
              return(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:"rgba(255,255,255,.04)",borderRadius:12,marginBottom:6,border:"1px solid rgba(255,255,255,.06)"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:800,color:won?"#00E676":draw?G.gold:"#FF3D57"}}>{won?"🏆 Victoire":draw?"🤝 Égalité":"😅 Défaite"}</div>
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
      <div style={{...shell,overflow:"auto"}} key="friends">
        <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
          {[0,1,2,3,4,5,6].map(function(i){return(<div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>);})}
          <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
          <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
        </div>
        {showDuelCreate && (
          <div style={{position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,.85)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{background:"rgba(15,25,15,.95)",borderRadius:24,padding:"28px 24px",maxWidth:340,width:"calc(100% - 32px)",border:"1px solid rgba(255,255,255,.1)"}}>
              <div style={{fontFamily:G.heading,fontSize:28,color:G.white,marginBottom:4}}>DÉFIER</div>
              <div style={{fontSize:14,color:"rgba(255,255,255,.5)",marginBottom:20}}>vs <strong style={{color:G.gold}}>{showDuelCreate.name}</strong></div>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.4)",marginBottom:8}}>Mode</div>
              <div style={{display:"flex",gap:8,marginBottom:16}}>
                {["pont","chaine"].map(function(m){return(
                  <button key={m} onClick={function(){setDuelMode(m);}} style={{flex:1,padding:"10px",borderRadius:12,border:"1.5px solid "+(duelMode===m?G.accent:"rgba(255,255,255,.15)"),background:duelMode===m?"rgba(0,230,118,.1)":"transparent",color:duelMode===m?G.accent:G.white,fontFamily:G.font,fontWeight:700,cursor:"pointer",fontSize:13}}>
                    {m==="pont"?"The Plug":"The Mercato"}
                  </button>
                );})}
              </div>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.4)",marginBottom:8}}>Difficulté</div>
              <div style={{display:"flex",gap:8,marginBottom:16}}>
                {["facile","moyen","expert"].map(function(d){return(
                  <button key={d} onClick={function(){setDuelDiff(d);}} style={{flex:1,padding:"8px",borderRadius:10,border:"1.5px solid "+(duelDiff===d?G.gold:"rgba(255,255,255,.15)"),background:duelDiff===d?"rgba(255,214,0,.1)":"transparent",color:duelDiff===d?G.gold:G.white,fontFamily:G.font,fontWeight:700,cursor:"pointer",fontSize:12,textTransform:"capitalize"}}>
                    {d}
                  </button>
                );})}
              </div>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.4)",marginBottom:8}}>Manches</div>
              <div style={{display:"flex",gap:8,marginBottom:20}}>
                {[1,2,3].map(function(r){return(
                  <button key={r} onClick={function(){setDuelRounds(r);}} style={{flex:1,padding:"10px",borderRadius:12,border:"1.5px solid "+(duelRounds===r?"#fff":"rgba(255,255,255,.15)"),background:duelRounds===r?"rgba(255,255,255,.1)":"transparent",color:G.white,fontFamily:G.font,fontWeight:700,cursor:"pointer",fontSize:15}}>{r}</button>
                );})}
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={function(){setShowDuelCreate(null);}} style={{flex:1,padding:"12px",background:"rgba(255,255,255,.07)",color:"rgba(255,255,255,.5)",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14}}>Annuler</button>
                <button onClick={function(){createDuel(showDuelCreate);}} style={{flex:2,padding:"12px",background:G.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800}}>Envoyer le défi ⚡</button>
              </div>
            </div>
          </div>
        )}
        {/* Modal confirmation suppression ami */}
        {confirmRemove && (
          <div style={{position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,.75)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{background:"rgba(15,20,15,.97)",borderRadius:24,padding:"28px 24px",maxWidth:320,width:"calc(100% - 40px)",border:"1px solid rgba(255,255,255,.1)",textAlign:"center"}}>
              <div style={{fontSize:32,marginBottom:12}}>👋</div>
              <div style={{fontFamily:G.heading,fontSize:22,color:G.white,marginBottom:8}}>Supprimer {confirmRemove.name} ?</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,.4)",marginBottom:24}}>Il devra renvoyer une demande pour être à nouveau dans ta liste.</div>
              <div style={{display:"flex",gap:10}}>
                <button onClick={function(){setConfirmRemove(null);}} style={{flex:1,padding:"12px",background:"rgba(255,255,255,.07)",color:"rgba(255,255,255,.6)",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>Annuler</button>
                <button onClick={function(){removeFriend(confirmRemove.id);setConfirmRemove(null);}} style={{flex:1,padding:"12px",background:"#FF3D57",color:"#fff",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800}}>Supprimer</button>
              </div>
            </div>
          </div>
        )}
        <div style={{zIndex:3,padding:"12px 16px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          {backBtn(function(){setShowFriends(false);setFriendMsg("");setSelectedFriend(null);})}
          <div style={{fontFamily:G.heading,fontSize:26,color:G.white,letterSpacing:2}}>AMIS</div>
          <div style={{width:40}}/>
        </div>
        <div style={{...sheet,borderRadius:"28px 28px 0 0",marginTop:16}}>
          {/* Demandes reçues */}
          {friendRequests.length > 0 && (
            <div style={{background:"rgba(0,230,118,.08)",border:"1px solid rgba(0,230,118,.25)",borderRadius:16,padding:14}}>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:G.accent,marginBottom:10}}>👋 Demandes reçues</div>
              {friendRequests.map(function(req){return(
                <div key={req.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:800,color:G.white}}>{req.from_name}</div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>veut être ton ami · {req.from_id}</div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={function(){acceptRequest(req);}} style={{padding:"8px 14px",background:G.accent,color:"#000",border:"none",borderRadius:20,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:800}}>✓</button>
                    <button onClick={function(){declineRequest(req);}} style={{padding:"8px 12px",background:"rgba(255,255,255,.07)",color:"rgba(255,255,255,.4)",border:"none",borderRadius:20,cursor:"pointer",fontSize:13}}>✕</button>
                  </div>
                </div>
              );})}
            </div>
          )}
          {/* Ajouter un ami */}
          <div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:16}}>
            <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Ajouter un ami</div>
            <div style={{display:"flex",gap:8}}>
              <input value={friendInput} onChange={function(e){setFriendInput(e.target.value);setFriendMsg("");}}
                placeholder="Pseudo de ton ami..." maxLength={20}
                style={{flex:1,padding:"10px 14px",borderRadius:12,border:"1.5px solid rgba(255,255,255,.15)",background:"#141414",color:G.white,fontFamily:G.font,fontSize:15,fontWeight:600,outline:"none"}}/>
              <button onClick={function(){addFriend(friendInput);}}
                style={{padding:"10px 16px",background:G.accent,color:"#000",border:"none",borderRadius:12,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800}}>+</button>
            </div>
            {friendMsg && <div style={{fontSize:12,marginTop:6,color:friendMsg.startsWith("✓")?"#00E676":friendMsg.startsWith("🔍")?"rgba(255,255,255,.5)":"#FF3D57",fontWeight:700}}>{friendMsg}</div>}
          </div>
          {/* Liste des amis + demandes en attente */}
          <div>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.3)",marginBottom:8}}>
              Mes amis {friendsList.length>0&&<span style={{color:G.accent}}>({friendsList.length})</span>}
            </div>
            {friendsList.length===0 && sentRequests.filter(function(r){return r.status==="pending";}).length===0 && (
              <div style={{textAlign:"center",padding:"24px 0",color:"rgba(255,255,255,.3)",fontSize:14}}>Aucun ami pour l'instant 👋</div>
            )}
            {/* Demandes en attente intégrées dans la liste */}
            {sentRequests.filter(function(r){return r.status==="pending";}).map(function(r,i){return(
              <div key={"pending-"+i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:"rgba(255,214,0,.04)",borderRadius:14,marginBottom:8,border:"1px dashed rgba(255,214,0,.25)"}}>
                <div>
                  <div style={{fontSize:15,fontWeight:800,color:"rgba(255,255,255,.5)"}}>{r.to_name || r.to_id}</div>
                  <div style={{fontSize:11,color:G.gold}}>⏳ En attente d'acceptation</div>
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
                  onClick={function(){setSelectedFriend({id:fid,name:fname});loadDuels();}}>
                  <div>
                    <div style={{fontSize:15,fontWeight:800,color:G.white}}>{fname}</div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,.35)"}}>{friendDuelCount>0?friendDuelCount+" duel"+(friendDuelCount>1?"s":"")+" joué"+(friendDuelCount>1?"s":""):"Aucun duel encore"}</div>
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <button onClick={function(e){e.stopPropagation();setShowDuelCreate({id:fid,name:fname});}} style={{padding:"7px 12px",background:G.accent,color:"#000",border:"none",borderRadius:20,cursor:"pointer",fontFamily:G.font,fontSize:12,fontWeight:800}}>⚡ Défier</button>
                    <button onClick={function(e){e.stopPropagation();setConfirmRemove({id:fid,name:fname});}} style={{padding:"7px 10px",background:"transparent",border:"1px solid rgba(255,255,255,.15)",borderRadius:20,cursor:"pointer",color:"rgba(255,255,255,.4)",fontSize:12}}>✕</button>
                    <span style={{color:"rgba(255,255,255,.3)",fontSize:18}}>›</span>
                  </div>
                </div>
              );
            })}
          </div>
          <button onClick={function(){setShowFriends(false);setSelectedFriend(null);}} style={{width:"100%",background:"rgba(255,255,255,.05)",color:"rgba(255,255,255,.5)",border:"1px solid rgba(255,255,255,.1)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,padding:"10px",marginTop:4}}>↩ Retour</button>
        </div>
      </div>
    );
  }

  if(showLeaderboard) {
    return (
      <>
      <div style={{...shell,animation:"fadeUp .4s ease",overflow:"auto"}} key="lb">
        <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        {/* Bandes pelouse */}
        {[0,1,2,3,4,5,6].map(function(i){return(
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>
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
        <div style={{zIndex:1,padding:"12px 20px 12px",display:"flex",alignItems:"center",gap:12}}>
          {backBtn(function(){setShowLeaderboard(false);})}
          <div style={{flex:1,textAlign:"center"}}>
            <div style={{fontFamily:G.heading,fontSize:"clamp(28px,7vw,46px)",color:G.white,letterSpacing:3}}>CLASSEMENT</div>
            {(()=>{ const s=getCurrentSeason(); return lbMode==="amis"
              ? <div style={{fontSize:12,color:"rgba(255,255,255,.4)"}}>Classement entre amis · Cumulatif</div>
              : <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                  <div style={{fontSize:13,fontWeight:800,color:G.gold}}>⚽ Saison {s.num}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>⏳ J-{s.days} {s.hours}h avant reset</div>
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
                  <div style={{fontSize:11,fontWeight:800,color:G.gold,letterSpacing:1}}>🏆 SAISON {s.num}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.4)",marginTop:2}}>
                    {daysLeft > 0 ? `J-${daysLeft} (${hoursLeft}h)` : `Finit dans ${hoursLeft}h`}
                  </div>
                </div>
                <button onClick={function(){setShowHallOfFame(true);}} style={{padding:"6px 12px",background:"rgba(255,214,0,.15)",color:G.gold,border:"1px solid rgba(255,214,0,.3)",borderRadius:20,cursor:"pointer",fontFamily:G.font,fontSize:11,fontWeight:800}}>
                  🏅 Hall of Fame
                </button>
              </div>
            );
          })()}
          <div style={{display:"flex",gap:6,marginBottom:4,flexWrap:"wrap"}}>
            {["global","pont","chaine","amis"].map(function(m){return(
              <button key={m} onClick={function(){
                setLbMode(m);
                if(m!=="amis") loadLeaderboard(m);
                else loadLeaderboard("global");
              }} style={{flex:1,minWidth:60,padding:"10px 6px",borderRadius:12,border:"1.5px solid "+(lbMode===m?G.accent:"rgba(255,255,255,.12)"),background:lbMode===m?"rgba(0,230,118,.1)":"transparent",color:lbMode===m?G.accent:G.white,fontFamily:G.font,fontWeight:700,cursor:"pointer",fontSize:12}}>
                {m==="global"?"🌍 Global":m==="pont"?"🏟 Plug":m==="chaine"?"⛓ Mercato":"👥 Amis"}
              </button>
            );})}
          </div>
          {leaderboard.length === 0 && (
            <div style={{textAlign:"center",padding:"32px 0",color:"rgba(255,255,255,.3)",fontSize:14}}>Aucun score pour le moment</div>
          )}
          {(lbMode==="amis"
            ? leaderboard.filter(function(e){ return e.pid===playerId || friendsList.includes(e.pid); })
            : leaderboard
          ).map(function(entry, i){
            const isMe = entry.pid === playerId;
            const medals = ["🥇","🥈","🥉"];
            const grade = getGrade(entry.score);
            return(
              <div key={i} style={{borderRadius:14,background:isMe?"rgba(0,230,118,.08)":"rgba(255,255,255,.03)",border:isMe?"1px solid rgba(0,230,118,.25)":"1px solid rgba(255,255,255,.05)",marginBottom:6,overflow:"hidden"}}>
                <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px"}}>
                  <div style={{fontFamily:G.heading,fontSize:22,width:32,textAlign:"center",color:i<3?["#FFD600","#C0C0C0","#CD7F32"][i]:"rgba(255,255,255,.3)"}}>
                    {i<3?medals[i]:(i+1)}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                      <span style={{fontSize:14,fontWeight:800,color:isMe?G.accent:G.white}}>{entry.name}{isMe?" (toi)":""}</span>
                      <span style={{fontSize:10,fontWeight:800,color:grade.color,background:grade.color+"22",borderRadius:20,padding:"2px 7px",letterSpacing:.5}}>{grade.emoji} {grade.label}</span>
                      {entry.streak>=3 && <span style={{fontSize:10,fontWeight:800,color:"#FF6B35",background:"rgba(255,107,53,.15)",borderRadius:20,padding:"2px 7px"}}>🔥 {entry.streak}</span>}
                    </div>
                    {lbMode==="global"
                      ? <div style={{fontSize:11,color:"rgba(255,255,255,.35)"}}>🏟 {entry.bestPont} pts &nbsp;·&nbsp; ⛓ {entry.bestChaine} pts</div>
                      : <div style={{fontSize:11,color:"rgba(255,255,255,.35)"}}>{entry.played} partie{entry.played>1?"s":""}</div>
                    }
                  </div>
                  <div style={{fontFamily:G.heading,fontSize:26,color:i===0?G.gold:G.white}}>{entry.score} <span style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>pts</span></div>
                </div>
                <div style={{display:"flex",borderTop:"1px solid rgba(255,255,255,.06)"}}>
                    <div style={{flex:1,padding:"6px 0",textAlign:"center",borderRight:"1px solid rgba(255,255,255,.06)"}}>
                      <div style={{fontFamily:G.heading,fontSize:18,color:"#00E676"}}>{entry.wins||0}</div>
                      <div style={{fontSize:9,color:"rgba(255,255,255,.35)",letterSpacing:1,textTransform:"uppercase"}}>Victoires</div>
                    </div>
                    <div style={{flex:1,padding:"6px 0",textAlign:"center",borderRight:"1px solid rgba(255,255,255,.06)"}}>
                      <div style={{fontFamily:G.heading,fontSize:18,color:G.gold}}>{entry.draws||0}</div>
                      <div style={{fontSize:9,color:"rgba(255,255,255,.35)",letterSpacing:1,textTransform:"uppercase"}}>Nuls</div>
                    </div>
                    <div style={{flex:1,padding:"6px 0",textAlign:"center"}}>
                      <div style={{fontFamily:G.heading,fontSize:18,color:"#FF3D57"}}>{entry.losses||0}</div>
                      <div style={{fontSize:9,color:"rgba(255,255,255,.35)",letterSpacing:1,textTransform:"uppercase"}}>Défaites</div>
                    </div>
                  </div>
              </div>
            );
          })}
          {/* Hall of Fame */}
          {hallOfFame.length > 0 && lbMode !== "amis" && (
            <div style={{marginTop:16,paddingTop:16,borderTop:"1px solid rgba(255,255,255,.08)"}}>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.3)",marginBottom:10,textAlign:"center"}}>🏛 Hall of Fame</div>
              {hallOfFame.map(function(s,i){
                return (
                  <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"rgba(255,215,0,.05)",borderRadius:12,marginBottom:6,border:"1px solid rgba(255,215,0,.1)"}}>
                    <span style={{fontSize:20}}>👑</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:800,color:G.gold}}>{s.champion_name}</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,.35)"}}>Saison {s.season_number}</div>
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
            <div style={{fontSize:12,color:"rgba(255,255,255,.4)",textAlign:"center",marginBottom:16}}>Champions des saisons passées</div>
            {hallOfFame.length === 0 && <div style={{textAlign:"center",color:"rgba(255,255,255,.3)",padding:"24px 0",fontSize:14}}>Pas encore de champion — la première saison est en cours !</div>}
            {hallOfFame.map(function(s,i){
              const grade = getGrade(s.champion_score||0);
              return (
                <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"14px",background:"rgba(255,214,0,.06)",borderRadius:14,border:"1px solid rgba(255,214,0,.15)",marginBottom:8}}>
                  <div style={{fontSize:32}}>🏆</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,color:"rgba(255,255,255,.4)",letterSpacing:1}}>SAISON {s.season_number}</div>
                    <div style={{fontSize:16,fontWeight:800,color:G.gold}}>{s.champion_name}</div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,.4)",marginTop:2}}>{grade.emoji} {grade.label}</div>
                  </div>
                  <div style={{fontFamily:G.heading,fontSize:28,color:G.gold}}>{s.champion_score} <span style={{fontSize:11,color:"rgba(255,255,255,.3)"}}>pts</span></div>
                </div>
              );
            })}
            <button onClick={function(){setShowHallOfFame(false);}} style={{width:"100%",padding:"14px",background:"rgba(255,255,255,.07)",color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700,marginTop:8}}>Fermer</button>
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
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>
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
            <div style={{fontSize:14,color:"rgba(255,255,255,.5)",letterSpacing:3,textTransform:"uppercase",marginBottom:16}}>C'est parti !</div>
            <div style={{fontFamily:G.heading,fontSize:120,color:G.accent,lineHeight:1,animation:"popIn .3s ease"}} key={duelCountdown}>{duelCountdown}</div>
            <div style={{fontSize:14,color:"rgba(255,255,255,.4)",marginTop:16}}>{players.length} joueurs</div>
          </div>
        </div>
      );
    }
    return (
      <div style={{...shell,overflow:"auto"}} key="room">
        <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        {/* Bandes pelouse */}
        {[0,1,2,3,4,5,6].map(function(i){return(
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>
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
          <div style={{fontFamily:G.heading,fontSize:24,color:G.white,letterSpacing:2}}>SALLE</div>
          <div style={{background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.1)",borderRadius:12,padding:"6px 14px",textAlign:"center",display:"flex",alignItems:"center",gap:8}}>
            <div>
              <div style={{fontSize:9,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase"}}>Code</div>
              <div style={{fontFamily:G.heading,fontSize:20,color:G.gold,letterSpacing:4}}>{room.code}</div>
            </div>
            <button onClick={function(){
              const link = "https://goatfc.fr?room="+room.code;
              if(navigator.share){navigator.share({title:"GOAT FC — Rejoins ma salle !",text:"Rejoins ma salle sur GOAT FC 🐐",url:link});}
              else{navigator.clipboard.writeText(link).then(function(){alert("Lien copié ! 📋");});}
            }} style={{background:"rgba(0,230,118,.15)",border:"1px solid rgba(0,230,118,.3)",borderRadius:8,padding:"6px 10px",color:G.accent,cursor:"pointer",fontSize:13,fontWeight:800,lineHeight:1}}>🔗 Inviter</button>
          </div>
        </div>
        <div style={{...sheet,borderRadius:"28px 28px 0 0",marginTop:16}}>
          <div style={{background:"rgba(255,255,255,.04)",borderRadius:14,padding:"10px 14px",marginBottom:4}}>
            <div style={{fontSize:11,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase",marginBottom:2}}>Mode</div>
            <div style={{fontSize:15,fontWeight:800,color:G.white}}>{room.mode==="pont"?"The Plug":"The Mercato"}{room.diff?" · "+room.diff:""} · {room.rounds||1} manche{(room.rounds||1)>1?"s":""}</div>
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.3)",marginBottom:8}}>
              Joueurs ({players.length}/8)
            </div>
            {players.map(function(p, i){return(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"rgba(255,255,255,.04)",borderRadius:12,marginBottom:6,border:p.id===playerId?"1px solid rgba(0,230,118,.3)":"1px solid rgba(255,255,255,.05)"}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,#1E5C2A,#00E676)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:"#fff",flexShrink:0}}>
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:800,color:p.id===playerId?G.accent:G.white}}>{p.name}{p.id===room.host_id?" 👑":""}{p.id===playerId?" (toi)":""}</div>
                </div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>✓ Prêt</div>
              </div>
            );})}
          </div>
          {players.length < 2 && (
            <div style={{textAlign:"center",padding:"8px 0",fontSize:13,color:"rgba(255,255,255,.3)"}}>
              Partage le code <strong style={{color:G.gold}}>{room.code}</strong> à tes amis
            </div>
          )}
          {isHost ? (
            <button onClick={startRoomGame} disabled={players.length < 2}
              style={{width:"100%",padding:"16px",background:players.length>=2?G.accent:"rgba(255,255,255,.1)",color:players.length>=2?"#000":"rgba(255,255,255,.3)",border:"none",borderRadius:50,cursor:players.length>=2?"pointer":"not-allowed",fontFamily:G.font,fontSize:15,fontWeight:800,marginTop:4}}>
              {players.length < 2 ? "En attente de joueurs..." : "🚀 Lancer la partie ("+players.length+" joueurs)"}
            </button>
          ) : (
            <div style={{textAlign:"center",padding:"14px",fontSize:13,color:"rgba(255,255,255,.4)",background:"rgba(255,255,255,.04)",borderRadius:16}}>
              ⏳ En attente que {room.host_name} lance la partie...
            </div>
          )}
        </div>
      </div>
    );
  }


  // ── TUTORIAL ──
  const TUTORIAL_SLIDES = [
    { icon:"⚽", title:"THE PLUG", subtitle:"Trouve le joueur qui relie 2 clubs", desc:"On te montre 2 clubs. Trouve le joueur qui a joué dans les deux !", color:"#1a4a2e", accent:"#00E676" },
    { icon:"⛓", title:"THE MERCATO", subtitle:"Enchaîne joueur → club → joueur", desc:"Un joueur est affiché. Tape un club où il a joué, puis un autre joueur de ce club… et ainsi de suite !", color:"#1a2a4a", accent:"#60a5fa" },
    { icon:"⚡", title:"DÉFI DU JOUR", subtitle:"Un joueur mystère chaque jour", desc:"Chaque jour, un nouveau joueur mystère à deviner. Reviens tous les jours pour ne pas perdre ta série !", color:"#3a2a00", accent:"#FFD600" },
    { icon:"👥", title:"MULTIJOUEUR", subtitle:"Joue avec tes potes", desc:"Crée une salle, partage le code, et affrontez-vous en temps réel jusqu'à 8 joueurs !", color:"#2a1a3a", accent:"#c084fc" },
  ];
  if(showTutorial) {
    const sl = TUTORIAL_SLIDES[tutorialStep];
    const closeTutorial = () => { setShowTutorial(false); try{localStorage.setItem("bb_tutorial_done","1");}catch{} };
    return (
      <div style={{...shell}}>
        <div style={{position:"fixed",inset:0,zIndex:9998,background:"rgba(0,0,0,.92)",backdropFilter:"blur(10px)",display:"flex",alignItems:"center",justifyContent:"center",padding:"0 20px"}}>
          <div style={{width:"100%",maxWidth:380,background:sl.color,borderRadius:28,padding:"36px 24px 28px",border:"1px solid rgba(255,255,255,.1)",textAlign:"center"}}>
            <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:28}}>
              {TUTORIAL_SLIDES.map((_,i)=>(<div key={i} style={{width:i===tutorialStep?24:8,height:8,borderRadius:4,background:i===tutorialStep?sl.accent:"rgba(255,255,255,.2)",transition:"all .3s"}}/>))}
            </div>
            <div style={{fontSize:56,marginBottom:16}}>{sl.icon}</div>
            <div style={{fontFamily:G.heading,fontSize:32,color:"#fff",letterSpacing:2,marginBottom:6}}>{sl.title}</div>
            <div style={{fontSize:13,color:sl.accent,fontWeight:700,letterSpacing:1,marginBottom:16,textTransform:"uppercase"}}>{sl.subtitle}</div>
            <div style={{fontSize:15,color:"rgba(255,255,255,.7)",lineHeight:1.6,marginBottom:32}}>{sl.desc}</div>
            <div style={{display:"flex",gap:10}}>
              {tutorialStep > 0 && <button onClick={()=>setTutorialStep(s=>s-1)} style={{flex:1,padding:"14px",background:"rgba(255,255,255,.07)",color:"rgba(255,255,255,.5)",border:"1px solid rgba(255,255,255,.1)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>← Retour</button>}
              {tutorialStep < TUTORIAL_SLIDES.length-1
                ? <button onClick={()=>setTutorialStep(s=>s+1)} style={{flex:2,padding:"14px",background:sl.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800}}>Suivant →</button>
                : <button onClick={closeTutorial} style={{flex:2,padding:"14px",background:sl.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800}}>C'est parti 🚀</button>
              }
            </div>
            {tutorialStep < TUTORIAL_SLIDES.length-1 && <button onClick={closeTutorial} style={{marginTop:16,background:"none",border:"none",color:"rgba(255,255,255,.3)",cursor:"pointer",fontFamily:G.font,fontSize:13}}>Passer</button>}
          </div>
        </div>
      </div>
    );
  }


  // ── PSEUDO MODAL (first time only) ──
  if (showSplash) {
    return (
      <div style={{position:"fixed",inset:0,zIndex:9999,background:"#000"}} key="splash">
        {/* Image plein écran */}
        <img src={SPLASH_IMG} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"center",display:"block"}}/>
        {/* Barre de chargement */}
        <div style={{position:"absolute",bottom:55,left:"50%",transform:"translateX(-50%)",width:120}}>
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
          <div style={{fontFamily:G.heading,fontSize:52,color:G.white,lineHeight:.9}}>GOAT<span style={{color:G.accent}}>FC</span></div>
          <div style={{fontSize:12,color:"rgba(255,255,255,.4)",marginTop:8,letterSpacing:2}}>CHOISIS TON PSEUDO</div>
        </div>
        <input
          value={pseudoInput}
          onChange={function(e){setPseudoInput(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g,""));setPseudoMsg("");}}
          onKeyDown={function(e){if(e.key==="Enter")checkAndSavePseudo(pseudoInput);}}
          placeholder="Ton pseudo unique..."
          maxLength={16}
          autoFocus
          style={{width:"100%",background:"rgba(255,255,255,.06)",border:"1.5px solid rgba(255,255,255,.15)",borderRadius:14,padding:"14px 16px",fontFamily:G.font,fontSize:17,color:G.white,outline:"none",boxSizing:"border-box",marginBottom:8,textAlign:"center"}}
        />
        {pseudoMsg && <div style={{fontSize:13,fontWeight:700,color:pseudoMsg.startsWith("❌")?"#FF3D57":"#00E676",marginBottom:8,textAlign:"center"}}>{pseudoMsg}</div>}
        <div style={{fontSize:11,color:"rgba(255,255,255,.2)",marginBottom:16,textAlign:"center"}}>3–16 caractères · lettres, chiffres, _ et . · pas d'espaces</div>
        <button
          onClick={function(){checkAndSavePseudo(pseudoInput);}}
          disabled={pseudoChecking||pseudoInput.trim().length<3}
          style={{width:"100%",padding:"15px",background:pseudoInput.trim().length>=3?G.accent:"rgba(255,255,255,.08)",color:pseudoInput.trim().length>=3?"#000":"rgba(255,255,255,.3)",border:"none",borderRadius:50,cursor:pseudoInput.trim().length>=3?"pointer":"not-allowed",fontFamily:G.font,fontSize:15,fontWeight:800}}
        >
          {pseudoChecking?"Vérification...":"Confirmer →"}
        </button>
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
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>
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
            <div style={{fontSize:14,color:"rgba(255,255,255,.5)",letterSpacing:3,textTransform:"uppercase",marginBottom:16}}>Adversaire trouvé !</div>
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
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>
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
            {isReady ? "PRÊT !" : "EN ATTENTE..."}
          </div>
          <div style={{fontSize:14,color:"rgba(255,255,255,.5)",marginBottom:32}}>
            {isReady ? "La partie va commencer !" : "En attente de "+oppName+"..."}
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
    const winMessages = [
      "T'as les crampons ET le niveau frère 👑",
      "T'as mis la misère à tout le monde 💀",
      "T'es chaud comme Mbappé un soir de CL 🔥",
      "LA COUPE IL RESTE AU MAROOOC, T'ES UN JNOUN OU QUOI?! 🏆",
      "On joue pas dans la même cour frère 🐐",
    ];
    const loseMessages = [
      "Même pas un but ! Même pas un but ! 😂",
      "T'as les crampons mais pas le niveau frère 💀",
      "Retourne jouer à la Playstation 🎮",
      "Même en Division 5 tu ferais banc 🤡",
      "T'as cru quoi, que c'était FIFA ? 😭",
    ];
    const msg = myRank === 1
      ? winMessages[Math.floor((myEntry?.score||0) * 7) % 5]
      : loseMessages[Math.floor(myRank * 3) % 5];
    return (
      <div style={{...shell,animation:"fadeUp .4s ease",overflow:"auto"}} key="roomResult2">
        <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
          {[0,1,2,3,4,5,6].map(function(i){return(<div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>);})}
          <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
          <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
        </div>
        <div style={{zIndex:1,padding:"32px 20px 12px",textAlign:"center"}}>
          <div style={{fontSize:52,marginBottom:8}}>{myRank<=3?medals[myRank-1]:myRank+"ème"}</div>
          <div style={{fontFamily:G.heading,fontSize:"clamp(30px,8vw,50px)",color:myRank===1?G.gold:G.white,letterSpacing:2}}>
            {myRank===1?"VICTOIRE !":myRank===2?"2ÈME PLACE":myRank===3?"3ÈME PLACE":"RÉSULTATS"}
          </div>
          <div style={{fontSize:18,color:myRank===1?G.gold:"#fff",marginTop:12,fontWeight:800,padding:"0 16px",lineHeight:1.4,textAlign:"center",animation:"popIn .6s cubic-bezier(.22,1,.36,1) .4s both",textShadow:myRank===1?"0 0 20px rgba(255,214,0,.4)":"none"}}>{msg}</div>
          {resultImg && <img src={resultImg} style={{width:"60%",maxWidth:220,margin:"8px auto",display:"block",objectFit:"contain"}} />}
        </div>
        <div style={{...sheet,borderRadius:"28px 28px 0 0"}}>
          {duelResult.players.map(function(p,i){return(
            <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:14,background:p.id===playerId?"rgba(0,230,118,.08)":"rgba(255,255,255,.03)",border:p.id===playerId?"1px solid rgba(0,230,118,.25)":"1px solid rgba(255,255,255,.05)",marginBottom:6}}>
              <div style={{fontFamily:G.heading,fontSize:22,width:32,textAlign:"center",color:i<3?["#FFD600","#C0C0C0","#CD7F32"][i]:"rgba(255,255,255,.3)"}}>{i<3?medals[i]:i+1}</div>
              <div style={{flex:1,fontSize:14,fontWeight:800,color:p.id===playerId?G.accent:G.white}}>{p.name}{p.id===playerId?" (toi)":""}</div>
              <div style={{fontFamily:G.heading,fontSize:26,color:i===0?G.gold:G.white}}>{p.score||0} <span style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>pts</span></div>
            </div>
          );})}
          <button onClick={function(){setDuelResult(null);setScreen("home");}} style={{width:"100%",padding:"16px",background:G.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800,marginTop:8}}>
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  // ── WAITING FOR ROOM RESULTS ──
  if (waitingForRoom || screen==="waitingRoom") {
    return (
      <div style={{...shell,alignItems:"center",justifyContent:"center"}} key="waitingRoom">
        <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
          {[0,1,2,3,4,5,6].map(function(i){return(<div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(i/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>);})}
          <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
          <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
        </div>
        <div style={{textAlign:"center",zIndex:1,padding:"0 32px"}}>
          <div style={{fontSize:56,marginBottom:20}}>⏳</div>
          <div style={{fontFamily:G.heading,fontSize:30,color:G.white,marginBottom:12,letterSpacing:1}}>PARTIE TERMINÉE !</div>
          <div style={{fontSize:16,color:G.accent,fontWeight:800,marginBottom:10}}>Tu as fini ta partie 💪</div>
          <div style={{fontSize:14,color:"rgba(255,255,255,.6)",lineHeight:1.7,marginBottom:8}}>Les autres joueurs sont encore en train de jouer.</div>
          <div style={{fontSize:14,color:"rgba(255,255,255,.9)",fontWeight:700,lineHeight:1.7,marginBottom:24,background:"rgba(255,255,255,.07)",borderRadius:14,padding:"12px 16px"}}>👉 Reste sur cet écran — les résultats apparaîtront automatiquement dès que tout le monde aura terminé.</div>
          {abandonNotif && <div style={{fontSize:13,color:"#000",fontWeight:800,marginBottom:16,background:"rgba(255,214,0,.9)",borderRadius:12,padding:"10px 14px"}}>{abandonNotif}</div>}
          <div style={{display:"flex",justifyContent:"center",gap:6}}>
            {[0,1,2].map(i=>(
              <div key={i} style={{width:8,height:8,borderRadius:"50%",background:G.accent,animation:`pulse 1.2s ease-in-out ${i*.3}s infinite`}}/>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── HOME ──
  // ── PROFILE SCREEN ──
  if(screen==="profile") return (
    <div style={{...shell,overflow:"auto"}} key="profile">
      <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        {[0,1,2,3,4,5,6].map(function(i){return(
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>
        );})}
        <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.7)"}}/>
      </div>

      {/* Header */}
      <div style={{zIndex:2,padding:"16px 16px 8px",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,background:"rgba(0,15,0,.85)",backdropFilter:"blur(10px)"}}>
        <button onClick={()=>setScreen("home")} style={{background:"rgba(255,255,255,.1)",border:"none",borderRadius:"50%",width:38,height:38,cursor:"pointer",color:G.white,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>←</button>
        <div style={{fontFamily:G.heading,fontSize:22,color:G.white,letterSpacing:2,flex:1}}>MON PROFIL</div>
      </div>

      {/* Avatar + Pseudo */}
      <div style={{zIndex:1,padding:"16px 20px 8px",textAlign:"center"}}>
        <label htmlFor="avatar-upload" style={{display:"block",width:100,height:100,borderRadius:"50%",background:playerAvatar?"#000":"linear-gradient(135deg,#00E676,#00A855)",margin:"0 auto 14px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:44,boxShadow:"0 8px 30px rgba(0,230,118,.35)",cursor:"pointer",overflow:"hidden",position:"relative"}}>
          {playerAvatar ? <img src={playerAvatar} alt="avatar" style={{width:"100%",height:"100%",objectFit:"cover"}}/> : (playerName||"?")[0].toUpperCase()}
          <div style={{position:"absolute",bottom:0,right:0,width:32,height:32,borderRadius:"50%",background:"#000",border:"2px solid #fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>{avatarUploading?"⏳":"📷"}</div>
        </label>
        <input id="avatar-upload" type="file" accept="image/*" style={{display:"none"}} onChange={async (e)=>{
          const file = e.target.files?.[0];
          if (!file) return;
          if (file.size > 5*1024*1024) { alert("Image trop grande (max 5 Mo)"); return; }
          setAvatarUploading(true);
          try {
            // Resize image to 300x300 square
            const blob = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                  const canvas = document.createElement("canvas");
                  const size = 300;
                  canvas.width = size; canvas.height = size;
                  const ctx = canvas.getContext("2d");
                  const minDim = Math.min(img.width, img.height);
                  const sx = (img.width-minDim)/2;
                  const sy = (img.height-minDim)/2;
                  ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
                  canvas.toBlob(resolve, "image/jpeg", 0.85);
                };
                img.onerror = reject;
                img.src = ev.target.result;
              };
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            // Upload to Supabase Storage
            const fileName = playerId + ".jpg";
            const uploadRes = await fetch(SB_URL + "/storage/v1/object/avatars/" + fileName, {
              method: "POST",
              headers: {
                "apikey": SB_KEY,
                "Authorization": "Bearer " + SB_KEY,
                "Content-Type": "image/jpeg",
                "x-upsert": "true"
              },
              body: blob
            });
            if (!uploadRes.ok) throw new Error("Upload failed: " + uploadRes.status);
            const publicUrl = SB_URL + "/storage/v1/object/public/avatars/" + fileName + "?t=" + Date.now();
            setPlayerAvatar(publicUrl);
            try { localStorage.setItem("bb_avatar_url", publicUrl); } catch {}
          } catch(err) {
            alert("Erreur upload: " + err.message);
          }
          setAvatarUploading(false);
          e.target.value = "";
        }}/>
        <div style={{fontFamily:G.heading,fontSize:28,color:G.white,letterSpacing:1}}>@{playerName||"anonyme"}</div>
        <button onClick={()=>{setPseudoInput(playerName||"");setPseudoScreen(true);}} style={{marginTop:10,padding:"7px 16px",background:"rgba(255,255,255,.08)",color:"rgba(255,255,255,.7)",border:"1px solid rgba(255,255,255,.15)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:12,fontWeight:700}}>✏️ Modifier</button>
      </div>

      {/* Stats cards */}
      <div style={{zIndex:1,padding:"16px 16px 8px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div style={{background:"rgba(255,214,0,.1)",border:"1px solid rgba(255,214,0,.3)",borderRadius:16,padding:"14px 10px",textAlign:"center"}}>
          <div style={{fontSize:22,marginBottom:4}}>🏆</div>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,214,0,.7)",marginBottom:4}}>Record Plug</div>
          <div style={{fontFamily:G.heading,fontSize:26,color:G.gold}}>{record?record.score:0}</div>
        </div>
        <div style={{background:"rgba(96,165,250,.1)",border:"1px solid rgba(96,165,250,.3)",borderRadius:16,padding:"14px 10px",textAlign:"center"}}>
          <div style={{fontSize:22,marginBottom:4}}>⛓</div>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(96,165,250,.7)",marginBottom:4}}>Record Mercato</div>
          <div style={{fontFamily:G.heading,fontSize:26,color:"#60a5fa"}}>{chainRecord?chainRecord.score:0}</div>
        </div>
        <div style={{background:"rgba(0,230,118,.08)",border:"1px solid rgba(0,230,118,.25)",borderRadius:16,padding:"14px 10px",textAlign:"center"}}>
          <div style={{fontSize:22,marginBottom:4}}>👥</div>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(0,230,118,.7)",marginBottom:4}}>Amis</div>
          <div style={{fontFamily:G.heading,fontSize:26,color:G.accent}}>{friendsList.length}</div>
        </div>
        <div style={{background:"rgba(192,132,252,.08)",border:"1px solid rgba(192,132,252,.25)",borderRadius:16,padding:"14px 10px",textAlign:"center"}}>
          <div style={{fontSize:22,marginBottom:4}}>🎮</div>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(192,132,252,.7)",marginBottom:4}}>Parties</div>
          <div style={{fontFamily:G.heading,fontSize:26,color:"#c084fc"}}>{(record?1:0)+(chainRecord?1:0)}</div>
        </div>
      </div>

      {/* Actions */}
      <div style={{zIndex:1,padding:"8px 16px",display:"flex",flexDirection:"column",gap:10}}>
        <button onClick={()=>{setShowFriends(true);setScreen("home");}} style={{padding:"16px",background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.12)",borderRadius:16,cursor:"pointer",color:G.white,fontFamily:G.font,fontSize:15,fontWeight:700,display:"flex",alignItems:"center",gap:12,textAlign:"left"}}>
          <span style={{fontSize:22}}>👥</span>
          <div style={{flex:1}}>
            <div>Mes amis</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.4)",fontWeight:400,marginTop:2}}>{friendsList.length} ami{friendsList.length>1?"s":""}</div>
          </div>
          <span style={{fontSize:18,color:"rgba(255,255,255,.3)"}}>→</span>
        </button>

        <button onClick={()=>{setLbMode("pont");setLbDiff("facile");loadLeaderboard("pont");setShowLeaderboard(true);setScreen("home");}} style={{padding:"16px",background:"rgba(255,214,0,.06)",border:"1px solid rgba(255,214,0,.2)",borderRadius:16,cursor:"pointer",color:G.white,fontFamily:G.font,fontSize:15,fontWeight:700,display:"flex",alignItems:"center",gap:12,textAlign:"left"}}>
          <span style={{fontSize:22}}>🏆</span>
          <div style={{flex:1}}>
            <div>Classement</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.4)",fontWeight:400,marginTop:2}}>Vois ton rang mondial</div>
          </div>
          <span style={{fontSize:18,color:"rgba(255,255,255,.3)"}}>→</span>
        </button>

        <button onClick={()=>{setShowTutorial(true);setTutorialStep(0);}} style={{padding:"16px",background:"rgba(96,165,250,.06)",border:"1px solid rgba(96,165,250,.2)",borderRadius:16,cursor:"pointer",color:G.white,fontFamily:G.font,fontSize:15,fontWeight:700,display:"flex",alignItems:"center",gap:12,textAlign:"left"}}>
          <span style={{fontSize:22}}>❓</span>
          <div style={{flex:1}}>
            <div>Comment jouer ?</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.4)",fontWeight:400,marginTop:2}}>Revoir le tutoriel</div>
          </div>
          <span style={{fontSize:18,color:"rgba(255,255,255,.3)"}}>→</span>
        </button>
      </div>

      {/* Footer */}
      <div style={{zIndex:1,padding:"20px 16px 40px",textAlign:"center"}}>
        <div style={{fontSize:10,color:"rgba(255,255,255,.2)",letterSpacing:2,textTransform:"uppercase"}}>GOAT FC · v1</div>
      </div>

      {pseudoModal}
    </div>
  );

  if(screen==="home") return (
    <div style={{...shell,animation:"fadeUp .5s ease",overflow:"auto"}} key="home">
      {pseudoModal}
      {showDuelCreate && (
        <div style={{position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,.85)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"rgba(15,25,15,.95)",borderRadius:24,padding:"28px 24px",maxWidth:340,width:"calc(100% - 32px)",border:"1px solid rgba(255,255,255,.1)"}}>
            <div style={{fontFamily:G.heading,fontSize:28,color:G.white,marginBottom:4}}>DÉFIER</div>
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
              <div style={{marginBottom:16}}>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.4)",marginBottom:8}}>Difficulté</div>
                <div style={{display:"flex",gap:8}}>
                  {["facile","moyen","expert"].map(function(d){return(
                    <button key={d} onClick={function(){setDuelDiff(d);}} style={{flex:1,padding:"8px",borderRadius:10,border:"1.5px solid "+(duelDiff===d?G.gold:"rgba(255,255,255,.15)"),background:duelDiff===d?"rgba(255,214,0,.1)":"transparent",color:duelDiff===d?G.gold:G.white,fontFamily:G.font,fontWeight:700,cursor:"pointer",fontSize:12,textTransform:"capitalize"}}>
                      {d}
                    </button>
                  );})}
                </div>
              </div>
            )}
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <button onClick={function(){setShowDuelCreate(null);}} style={{flex:1,padding:"12px",background:"rgba(255,255,255,.07)",color:"rgba(255,255,255,.5)",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14}}>Annuler</button>
              <button onClick={function(){createDuel(showDuelCreate);}} style={{flex:2,padding:"12px",background:G.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800}}>Envoyer le défi ⚡</button>
            </div>
          </div>
        </div>
      )}
      {showRoomCreate && (
        <div
          style={{position:"fixed",inset:0,zIndex:400,display:"flex",alignItems:"flex-end"}}
          onClick={function(e){if(e.target===e.currentTarget)setShowRoomCreate(false);}}
        >
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.6)",backdropFilter:"blur(4px)"}} onClick={function(){setShowRoomCreate(false);}}/>
          <div style={{position:"relative",zIndex:1,width:"100%",background:"rgba(10,25,10,.96)",backdropFilter:"blur(20px)",borderRadius:"28px 28px 0 0",padding:"16px 20px 48px",border:"1px solid rgba(255,255,255,.1)",borderBottom:"none",animation:"slideUp .35s cubic-bezier(.22,1,.36,1)"}}>
            <div style={{width:40,height:4,background:"rgba(255,255,255,.2)",borderRadius:2,margin:"0 auto 20px"}}/>
            <div style={{fontFamily:G.heading,fontSize:28,color:G.white,letterSpacing:2,marginBottom:6}}>CRÉER UNE SALLE</div>
            {/* Recap config */}
            <div style={{background:"rgba(255,255,255,.06)",borderRadius:16,padding:"14px 16px",marginBottom:20,border:"1px solid rgba(255,255,255,.08)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:800,color:G.white}}>{duelMode==="pont"?"The Plug":"The Mercato"}</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.4)"}}>{duelDiff} · {duelRounds} manche{duelRounds>1?"s":""}</div>
                </div>
                <div style={{fontFamily:G.heading,fontSize:32,color:G.accent}}>2-8 👥</div>
              </div>
            </div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.35)",marginBottom:20,textAlign:"center"}}>
              Un code sera généré pour que tes amis puissent rejoindre
            </div>
            {roomMsg && <div style={{fontSize:13,color:"#FF3D57",fontWeight:700,marginBottom:12,textAlign:"center"}}>{roomMsg}</div>}
            <div style={{display:"flex",gap:10}}>
              <button onClick={function(){setShowRoomCreate(false);}} style={{flex:1,padding:"15px",background:"rgba(255,255,255,.07)",color:"rgba(255,255,255,.5)",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14}}>Annuler</button>
              <button onClick={createRoom} style={{flex:2,padding:"15px",background:G.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800}}>Créer la salle 🚀</button>
            </div>
          </div>
        </div>
      )}
      <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        {/* Bandes pelouse */}
        {[0,1,2,3,4,5,6].map(function(i){return(
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>
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
          <div style={{flex:1}}/>
          <div style={{textAlign:"center",flex:2}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center"}}>
              <img src={GOAT_LOGO_NEW} style={{height:"clamp(78px,19.5vw,120px)",maxWidth:"100%",objectFit:"contain"}} alt="GOAT FC"/>
            </div>
          </div>
          <div style={{flex:1,display:"flex",justifyContent:"flex-end",alignItems:"center",gap:8}}>
  
<div onClick={function(){if(!pseudoConfirmed) setPseudoScreen(true); else setScreen("profile");}} style={{background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.12)",borderRadius:"50%",width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
  <span style={{fontSize:16}}>👤</span>
</div>              
          </div>
        </div>
      </div>

      <div style={{...sheet,gap:10}}>

        {/* Bandeau room en attente */}
        {pendingRoomCode && !pseudoConfirmed && (
          <div style={{background:"rgba(0,230,118,.1)",border:"1px solid rgba(0,230,118,.3)",borderRadius:12,padding:"10px 14px",textAlign:"center"}}>
            <div style={{fontSize:13,fontWeight:800,color:G.accent}}>🔗 Salle {pendingRoomCode} en attente</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginTop:2}}>Crée ton pseudo pour rejoindre automatiquement</div>
          </div>
        )}
        {/* Bandeau demandes d'amis */}
        {friendRequests.length > 0 && (
          <div style={{background:"rgba(0,230,118,.08)",border:"1px solid rgba(0,230,118,.25)",borderRadius:12,padding:"10px 14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:12,fontWeight:700,color:G.accent}}>👋 {friendRequests.length} demande{friendRequests.length>1?"s":""} d'ami</div>
              <button onClick={function(){setShowFriends(true);loadFriendRequests();}} style={{padding:"5px 12px",background:G.accent,color:"#000",border:"none",borderRadius:20,cursor:"pointer",fontFamily:G.font,fontSize:12,fontWeight:800}}>Voir</button>
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
                  <div style={{fontSize:12,fontWeight:700,color:G.gold}}>⚡ Défi de {oppName}</div>
                  <button onClick={function(){joinDuel(d);}} style={{padding:"5px 12px",background:G.gold,color:"#000",border:"none",borderRadius:20,cursor:"pointer",fontFamily:G.font,fontSize:12,fontWeight:800}}>Rejoindre</button>
                </div>
              );})}
          </div>
        )}

        {/* ── GAME CARDS (côte à côte) ── */}
        <div style={{display:"flex",gap:10,height:"clamp(320px,80vw,420px)",flexShrink:0}}>
          {/* ── Carte THE PLUG ── */}
          <div
            onClick={function(){setGameConfigModal("pont");}}
            style={{flex:1,borderRadius:22,cursor:"pointer",overflow:"hidden",position:"relative",
              boxShadow:"0 8px 24px rgba(0,0,0,.5)",display:"flex",flexDirection:"column"}}
          >
            {/* Image en fond, rogne le haut pour garder le visuel principal */}
            <div style={{position:"absolute",inset:0,overflow:"hidden",borderRadius:22,background:"#000"}}>
              <img src={PLUG_CARD_IMG} style={{position:"absolute",width:"100%",height:"100%",top:0,objectFit:"contain",objectPosition:"top",pointerEvents:"none"}}/>
              <div style={{position:"absolute",bottom:0,left:0,right:0,height:"30%",background:"linear-gradient(to top, rgba(0,0,0,.95) 0%, transparent 100%)"}}/>
            </div>
            {/* Record */}
            {record && <div style={{position:"absolute",top:10,left:12,display:"flex",alignItems:"center",gap:4,zIndex:2}}>
              <span style={{fontSize:12,color:G.gold}}>🏆</span>
              <span style={{fontFamily:G.heading,fontSize:15,color:G.gold}}>{record.score} pts</span>
            </div>}
            {/* Bouton jouer */}
            <div style={{position:"absolute",bottom:6,left:8,right:8,zIndex:2,background:G.accent,borderRadius:50,padding:"4px 0",color:"#000",fontFamily:G.font,fontWeight:800,fontSize:10,textAlign:"center"}}>▶ Jouer</div>
          </div>

          {/* ── Carte THE MERCATO ── */}
          <div
            onClick={function(){setGameConfigModal("chaine");}}
            style={{flex:1,borderRadius:22,cursor:"pointer",overflow:"hidden",position:"relative",
              boxShadow:"0 8px 24px rgba(0,0,0,.5)",display:"flex",flexDirection:"column"}}
          >
            <div style={{position:"absolute",inset:0,overflow:"hidden",borderRadius:22,background:"#000"}}>
              <img src={MERCATO_CARD_IMG} style={{position:"absolute",width:"100%",height:"100%",top:0,objectFit:"contain",objectPosition:"top",pointerEvents:"none"}}/>
              <div style={{position:"absolute",bottom:0,left:0,right:0,height:"30%",background:"linear-gradient(to top, rgba(0,0,0,.95) 0%, transparent 100%)"}}/>
            </div>
            {chainRecord&&<div style={{position:"absolute",top:10,left:12,display:"flex",alignItems:"center",gap:4,zIndex:2}}>
              <span style={{fontSize:12,color:G.accent}}>⛓</span>
              <span style={{fontFamily:G.heading,fontSize:15,color:G.accent}}>{chainRecord.score} pts</span>
            </div>}
            <div style={{position:"absolute",bottom:6,left:8,right:8,zIndex:2,background:G.accent,borderRadius:50,padding:"4px 0",color:"#000",fontFamily:G.font,fontWeight:800,fontSize:10,textAlign:"center"}}>▶ Jouer</div>
          </div>
        </div>

        {/* ── CONFIG MODAL ── */}
        {gameConfigModal && (
          <div
            style={{position:"fixed",inset:0,zIndex:300,display:"flex",alignItems:"flex-end"}}
            onClick={function(e){if(e.target===e.currentTarget)setGameConfigModal(null);}}
          >
            {/* Backdrop */}
            <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.5)",backdropFilter:"blur(4px)"}} onClick={function(){setGameConfigModal(null);}}/>
            {/* Sheet */}
            <div style={{
              position:"relative",zIndex:1,
              width:"100%",
              background:gameConfigModal==="pont"
                ?"linear-gradient(180deg,#0B1624 0%,#1C3D73 100%)"
                :"linear-gradient(180deg,#0F2A1A 0%,#1A5C34 100%)",
              backdropFilter:"blur(20px)",
              borderRadius:"28px 28px 0 0",
              padding:"16px 20px 48px",
              border:"1px solid rgba(255,255,255,.1)",
              borderBottom:"none",
              animation:"slideUp .35s cubic-bezier(.22,1,.36,1)"
            }}>
              {/* Handle */}
              <div style={{width:40,height:4,background:"rgba(255,255,255,.2)",borderRadius:2,margin:"0 auto 20px"}}/>
              {/* Mode name */}
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:4}}>
                <div style={{opacity:.8}}>{gameConfigModal==="pont"?Icon.pitch(28,"#fff"):Icon.transfer(28,"#fff")}</div>
                <div style={{fontFamily:G.heading,fontSize:36,color:G.white,letterSpacing:2}}>
                  {gameConfigModal==="pont"?"THE PLUG":"THE MERCATO"}
                </div>
              </div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.4)",marginBottom:20,paddingLeft:40}}>
                {gameConfigModal==="pont"?"2 clubs → trouve le joueur commun":"joueur → club → joueur..."}
              </div>
              {/* Difficulté */}
              <div style={{fontSize:10,fontWeight:700,letterSpacing:3,textTransform:"uppercase",color:"rgba(255,255,255,.3)",marginBottom:8}}>Difficulté</div>
              <div style={{display:"flex",gap:8,marginBottom:20}}>
                {["facile","moyen","expert"].map(function(d){return(
                  <button key={d} onClick={function(){setDiff(d);}} style={{flex:1,padding:"12px 4px",borderRadius:14,border:"1.5px solid "+(diff===d?G.accent:"rgba(255,255,255,.1)"),background:diff===d?"rgba(0,230,118,.12)":"rgba(255,255,255,.04)",color:diff===d?G.accent:"rgba(255,255,255,.5)",fontFamily:G.font,fontWeight:700,cursor:"pointer",fontSize:13,textTransform:"capitalize",transition:"all .15s"}}>
                    {d}
                  </button>
                );})}
              </div>
              {/* Manches */}
              <div style={{fontSize:10,fontWeight:700,letterSpacing:3,textTransform:"uppercase",color:"rgba(255,255,255,.3)",marginBottom:8}}>Manches</div>
              <div style={{display:"flex",gap:8,marginBottom:24}}>
                {[1,2,3].map(function(n){return(
                  <button key={n} onClick={function(){setTotalRounds(n);}} style={{flex:1,padding:"12px",borderRadius:14,border:"1.5px solid "+(totalRounds===n?"rgba(255,255,255,.7)":"rgba(255,255,255,.1)"),background:totalRounds===n?"rgba(255,255,255,.1)":"rgba(255,255,255,.04)",color:totalRounds===n?G.white:"rgba(255,255,255,.35)",fontFamily:G.heading,fontWeight:700,cursor:"pointer",fontSize:22,transition:"all .15s"}}>
                    {n}
                  </button>
                );})}
              </div>
              {/* Boutons */}
              <div style={{display:"flex",gap:10}}>
                <button onClick={function(){const m=gameConfigModal;setGameConfigModal(null);setTimeout(function(){tryStart(m);},50);}} style={{flex:2,padding:"16px",background:G.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:16,fontWeight:800,letterSpacing:.5}}>
                  ▶ Jouer seul
                </button>
                <button onClick={function(){setDuelMode(gameConfigModal);setDuelDiff(diff);setDuelRounds(totalRounds);setGameConfigModal(null);setTimeout(function(){setShowRoomCreate(true);},100);}} style={{flex:1,padding:"16px",background:"rgba(255,255,255,.07)",color:G.white,border:"1px solid rgba(255,255,255,.12)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:700}}>
                  👥 Entre potes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Défi du jour */}
        {dailyPlayer && (
          <div style={{borderRadius:14,background:dailyDone?"rgba(255,255,255,.04)":"linear-gradient(135deg,rgba(255,214,0,.12),rgba(255,107,53,.12))",border:dailyDone?"1px solid rgba(255,255,255,.1)":"1.5px solid rgba(255,214,0,.3)",padding:"10px 12px",display:"flex",alignItems:"center",gap:10,opacity:dailyDone?.7:1}}>
            <div style={{fontSize:22}}>{dailyDone?(dailyAbandoned?"🔒":"✅"):"⚡"}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:10,fontWeight:800,letterSpacing:1.5,textTransform:"uppercase",color:dailyDone?"rgba(255,255,255,.3)":"rgba(255,214,0,.7)",marginBottom:1}}>Défi du jour</div>
              <div style={{fontSize:13,fontWeight:800,color:dailyDone?"rgba(255,255,255,.4)":G.white}}>
                {dailyDone ? "Revenez demain 🔒" : "Devine le joueur mystère"}
              </div>
              {dailyDone && <div style={{fontSize:10,color:"rgba(255,255,255,.3)",marginTop:1}}>{dailyAbandoned ? "Abandonné — "+dailyPlayer.name : "Trouvé en "+localStorage.getItem("bb_daily_tries")+" essai"+(parseInt(localStorage.getItem("bb_daily_tries")||"1")>1?"s":"")+" !"}</div>}
            </div>
            {!dailyDone && <button onClick={function(){setShowDailyGame(true);setDailyGuess("");setDailyFlash(null);setDailySuccess(false);}} style={{padding:"9px 13px",background:"linear-gradient(135deg,#FFD600,#FF6B35)",color:"#000",border:"none",borderRadius:12,cursor:"pointer",fontFamily:G.font,fontSize:12,fontWeight:800,whiteSpace:"nowrap"}}>Jouer ⚡</button>}
          </div>
        )}

        {/* Modal défi du jour — Devine le joueur */}
        {showDailyGame && dailyPlayer && (
          <div style={{position:"fixed",inset:0,zIndex:400,display:"flex",flexDirection:"column"}}>
            {/* Fond pelouse */}
            <div style={{position:"absolute",inset:0,zIndex:0,overflow:"hidden"}}>
              {[0,1,2,3,4,5,6].map(function(i){return(<div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>);})}
              <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
              <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
              <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.82)"}}/>
            </div>
            {/* Header */}
            <div style={{zIndex:1,padding:"20px 20px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontFamily:G.heading,fontSize:26,color:G.gold,letterSpacing:2}}>⚡ DÉFI DU JOUR</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,.5)",marginTop:2}}>Devine le joueur mystère</div>
              </div>
              <button onClick={function(){setShowDailyGame(false);}} style={{background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.15)",borderRadius:"50%",width:36,height:36,color:G.white,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>
            {/* Contenu */}
            <div style={{...sheet,borderRadius:"28px 28px 0 0",marginTop:20,zIndex:1,flex:1,justifyContent:"center",overflowY:"auto",paddingBottom:40}}>
              {/* Clubs */}
              <div>
                <div style={{textAlign:"center",marginBottom:8}}>
                  <span style={{
                    fontSize:11,fontWeight:800,letterSpacing:2,textTransform:"uppercase",padding:"3px 10px",borderRadius:20,
                    color: dailyPlayer.diff==="facile"?"#00E676":dailyPlayer.diff==="moyen"?"#FFD600":"#FF3D57",
                    background: dailyPlayer.diff==="facile"?"rgba(0,230,118,.15)":dailyPlayer.diff==="moyen"?"rgba(255,214,0,.15)":"rgba(255,61,87,.15)",
                    border: `1px solid ${dailyPlayer.diff==="facile"?"rgba(0,230,118,.3)":dailyPlayer.diff==="moyen"?"rgba(255,214,0,.3)":"rgba(255,61,87,.3)"}`
                  }}>
                    {dailyPlayer.diff==="facile"?"⭐ Facile":dailyPlayer.diff==="moyen"?"⭐⭐ Moyen":"⭐⭐⭐ Expert"}
                  </span>
                </div>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:G.accent,marginBottom:8,textAlign:"center"}}>Clubs dans sa carrière</div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:0,marginBottom:12}}>
                  {dailyPlayer.clubs.map(function(club,i){
                    const [ca,cb] = getClubColors(club);
                    return (
                      <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",width:"100%"}}>
                        <div style={{borderRadius:24,overflow:"hidden",position:"relative",height:36,width:"80%",maxWidth:260,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 12px rgba(0,0,0,.5)"}}>
                          <div style={{position:"absolute",inset:0,background:ca}}/>
                          <div style={{position:"absolute",top:0,right:0,width:"55%",bottom:0,background:cb,clipPath:"polygon(30% 0%, 100% 0%, 100% 100%, 0% 100%)"}}/>
                          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.1)"}}/>
                          <span style={{position:"relative",zIndex:1,fontSize:12,fontWeight:800,color:"#fff",padding:"0 16px",textShadow:"0 1px 4px rgba(0,0,0,.7)"}}>{club}</span>
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

              {/* Tentatives */}
              {dailyTries > 0 && !dailySuccess && (
                <div style={{textAlign:"center",marginBottom:12}}>
                  <span style={{fontSize:13,color:"rgba(255,255,255,.4)",fontWeight:700}}>Tentative{dailyTries>1?"s":""} : {dailyTries}</span>
                </div>
              )}

              {/* Bravo ou input */}
              {dailySuccess ? (
                <div style={{textAlign:"center",padding:"16px 0",flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                  <div style={{fontSize:72,marginBottom:12}}>🎉</div>
                  <div style={{fontFamily:G.heading,fontSize:42,color:"#00E676",letterSpacing:2,marginBottom:8}}>BRAVO !</div>
                  <div style={{fontSize:17,color:"rgba(255,255,255,.85)",fontWeight:700,marginBottom:6}}>
                    C'était <span style={{color:"#00E676"}}>{dailyPlayer.name}</span>
                  </div>
                  <div style={{fontSize:14,color:"rgba(255,255,255,.4)",marginTop:4}}>
                    {dailyTries === 1 ? "Trouvé du premier coup 🐐" : `Trouvé en ${dailyTries} essai${dailyTries>1?"s":""}`}
                  </div>
                </div>
              ) : (
                <>
                  <input
                    value={dailyGuess}
                    onChange={function(e){setDailyGuess(e.target.value);setDailyFlash(null);}}
                    onKeyDown={function(e){if(e.key==="Enter") handleDailySubmit();}}
                    placeholder="Nom du joueur..."
                    autoComplete="off"
                    style={{width:"100%",background:dailyFlash==="ko"?"rgba(255,61,87,.15)":"rgba(255,255,255,.08)",border:"2px solid "+(dailyFlash==="ko"?"#FF3D57":"rgba(255,255,255,.2)"),borderRadius:18,padding:"18px",fontFamily:G.font,fontSize:19,fontWeight:700,color:"#ffffff",outline:"none",textAlign:"center",transition:"all .2s",boxSizing:"border-box",marginBottom:8}}
                  />
                  {dailyFlash==="ko" && <div style={{textAlign:"center",fontSize:13,color:"#FF3D57",marginBottom:8,fontWeight:700}}>Ce n'est pas ça... réessaie !</div>}
                  <div style={{display:"flex",gap:10,marginTop:8}}>
                    <button onClick={function(){
                      setShowDailyGame(false);
                      const today = (()=>{ const d=new Date(); const paris=new Date(d.toLocaleString('en-US',{timeZone:'Europe/Paris'})); return paris.getFullYear()+'-'+String(paris.getMonth()+1).padStart(2,'0')+'-'+String(paris.getDate()).padStart(2,'0'); })();
                      try { localStorage.setItem("bb_daily_result", JSON.stringify({date:today,abandoned:true})); } catch{}
                      setDailyDone(true); setDailyAbandoned(true); updateDayStreak();
                    }} style={{flex:1,padding:"16px",background:"rgba(255,255,255,.05)",color:"rgba(255,255,255,.5)",border:"1px solid rgba(255,255,255,.1)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>
                      Abandonner
                    </button>
                    <button onClick={handleDailySubmit} style={{flex:2,padding:"16px",background:"linear-gradient(135deg,#FFD600,#FF6B35)",color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:16,fontWeight:800}}>
                      Valider ✓
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Multijoueur - rejoindre */}
        <div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",borderRadius:16,padding:"14px 14px 12px"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <span style={{fontSize:18}}>👥</span>
            <div>
              <div style={{fontSize:14,fontWeight:800,color:G.white}}>Joue avec tes potes !</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>Crée une salle ou rejoins avec un code</div>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <input value={roomInput} onChange={function(e){setRoomInput(e.target.value.toUpperCase());setRoomMsg("");}}
              placeholder="Code salle" maxLength={6}
              style={{flex:1,padding:"10px 12px",borderRadius:12,border:"1.5px solid rgba(255,255,255,.12)",background:"rgba(255,255,255,.05)",color:G.white,fontFamily:G.font,fontSize:14,fontWeight:700,letterSpacing:3,textTransform:"uppercase",outline:"none"}}/>
            <button onClick={function(){requirePseudo(function(){joinRoom(roomInput);});}} style={{padding:"10px 14px",background:"rgba(255,255,255,.07)",color:G.white,border:"1px solid rgba(255,255,255,.12)",borderRadius:12,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:700}}>Rejoindre</button>
          </div>
        </div>
        {roomMsg && <div style={{fontSize:12,color:"#FF3D57",fontWeight:700,marginTop:-4}}>{roomMsg}</div>}
        {/* Actions */}
        <div style={{display:"flex",gap:8}}>
          <button onClick={function(){requirePseudo(function(){loadLeaderboard(lbMode);setShowLeaderboard(true);});}} style={{flex:1,padding:"12px",background:"rgba(0,230,118,.08)",color:G.accent,border:"1px solid rgba(0,230,118,.2)",borderRadius:14,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            {Icon.trophy(14,G.accent)} Classement
          </button>
          <button onClick={function(){requirePseudo(function(){setShowFriends(true);loadFriends().then(function(ids){fetchFriendScores(ids);});loadDuels();loadFriendRequests();});}} style={{flex:1,padding:"12px",background:"rgba(255,255,255,.05)",color:G.white,border:"1px solid rgba(255,255,255,.1)",borderRadius:14,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:6,position:"relative"}}>
            👥 Amis{friendRequests.length>0&&<span style={{position:"absolute",top:-4,right:-4,background:"#FF3D57",color:"#fff",borderRadius:"50%",width:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900}}>{friendRequests.length}</span>}
          </button>
        </div>

        {/* WhatsApp communauté */}
        <a href="https://chat.whatsapp.com/GpKyFjaxixCJviQawGHNUp" target="_blank" rel="noopener noreferrer"
          style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:"rgba(37,211,102,.1)",border:"1px solid rgba(37,211,102,.3)",borderRadius:14,textDecoration:"none"}}>
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="16" fill="#25D366"/>
            <path d="M16 7.5C11.306 7.5 7.5 11.306 7.5 16c0 1.76.504 3.4 1.376 4.785L7.5 24.5l3.837-1.356A8.463 8.463 0 0016 24.5c4.694 0 8.5-3.806 8.5-8.5S20.694 7.5 16 7.5z" fill="white"/>
            <path d="M20.844 18.68c-.248-.124-1.47-.725-1.698-.808-.228-.082-.394-.124-.56.124-.165.248-.64.808-.785.973-.144.166-.29.186-.537.062-.248-.124-1.047-.386-1.994-1.23-.737-.657-1.235-1.468-1.38-1.716-.144-.248-.015-.382.109-.505.111-.111.248-.29.372-.435.124-.145.165-.248.248-.414.082-.165.041-.31-.021-.434-.062-.124-.56-1.35-.767-1.848-.202-.485-.408-.42-.56-.427l-.477-.008c-.165 0-.434.062-.662.31-.227.248-.868.848-.868 2.068 0 1.22.889 2.398 1.013 2.563.124.165 1.748 2.67 4.236 3.745.592.255 1.054.407 1.414.521.594.189 1.135.162 1.562.098.476-.071 1.47-.6 1.677-1.18.207-.58.207-1.077.145-1.18-.062-.103-.228-.165-.476-.29z" fill="#25D366"/>
          </svg>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:800,color:"#25D366"}}>Rejoins la communauté GOAT FC 🐐</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.4)",marginTop:1}}>Matchs · Discussions foot · Bugs & Idées</div>
          </div>
          <span style={{fontSize:16,color:"rgba(37,211,102,.6)"}}>›</span>
        </a>

      </div>
    </div>
  );


  if(screen==="game"&&cur) {
    const [ca1,cb1]=getClubColors(cur.c1);
    const [ca2,cb2]=getClubColors(cur.c2);
    const tc1=textColor(ca1); const tc2=textColor(ca2);
    return (
      <div style={{...shell,animation:"fadeIn .2s ease",overflow:"auto"}} key={"game-"+currentRound}>
        <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        {/* Bandes pelouse */}
        {[0,1,2,3,4,5,6].map(function(i){return(
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>
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
            <div style={{fontFamily:G.heading,fontSize:26,color:G.white,marginBottom:8}}>ABANDONNER ?</div>
            <div style={{fontSize:14,color:"rgba(255,255,255,.5)",marginBottom:24}}>
              {activeDuel ? "Ton adversaire sera déclaré vainqueur." : "Ta partie sera perdue et ton score sera de 0."}
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={function(){setShowQuitConfirm(false);}} style={{flex:1,padding:"13px",background:"rgba(255,255,255,.07)",color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>Continuer</button>
              <button onClick={async function(){
                setShowQuitConfirm(false);
                clearInterval(timerRef.current);
                clearInterval(qTimerRef.current);
                if(activeDuelRef.current&&activeDuelRef.current.isRoom){ await abandonRoom(); }
                else if(activeDuel){ abandonDuel(); }
                setScreen("home");
              }} style={{flex:1,padding:"13px",background:"#FF3D57",color:"#fff",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>Abandonner</button>
            </div>
          </div>
        </div>
      )}

        {floatingPoints}
        {/* Screen flash */}
        <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:10,animation:feedback==="ok"?"flashOk .6s ease":feedback==="ko"?"flashKo .6s ease":"none"}}/>

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

        {/* Club cards — full height */}
        <div key={"clubs-"+animKey} style={{flex:1,display:"flex",flexDirection:"column",gap:0,padding:"10px 0 0",zIndex:1,minHeight:0}}>
          {/* Club 1 */}
          <div style={{flex:1,margin:"0 14px 0 14px",borderRadius:28,position:"relative",overflow:"hidden",boxShadow:"0 12px 40px "+ca1+"55",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",animation:"clubSlideLeft .55s cubic-bezier(.22,1,.36,1)",animationFillMode:"both"}}>
            {/* Fond diagonal club 1 */}
            <div style={{position:"absolute",inset:0,background:ca1}}/>
            <div style={{position:"absolute",top:0,right:0,width:"55%",bottom:0,background:cb1,clipPath:"polygon(30% 0%, 100% 0%, 100% 100%, 0% 100%)"}}/>
            <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.18)"}}/>
            <div style={{position:"absolute",width:220,height:220,borderRadius:"50%",border:"3px solid rgba(255,255,255,.1)",top:-40,right:-40,pointerEvents:"none"}}/>
            <div style={{fontFamily:G.heading,fontSize:"clamp(28px,7.5vw,52px)",color:"#fff",lineHeight:1.05,textAlign:"center",padding:"0 16px",zIndex:1,textShadow:"0 3px 16px rgba(0,0,0,.6)",letterSpacing:1}}>{cur.c1}</div>
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
            <div style={{fontFamily:G.heading,fontSize:"clamp(28px,7.5vw,52px)",color:"#fff",lineHeight:1.05,textAlign:"center",padding:"0 16px",zIndex:1,textShadow:"0 3px 16px rgba(0,0,0,.6)",letterSpacing:1}}>{cur.c2}</div>
          </div>
        </div>

        {/* Bottom sheet */}
        <div style={{...sheet,borderRadius:"28px 28px 0 0",animation:"sheetUp .45s cubic-bezier(.22,1,.36,1) .15s both",flexShrink:0,paddingTop:14,gap:10}}>
          {combo>=3&&<div style={{textAlign:"center",animation:"comboFire .5s ease"}}><span style={{background:"linear-gradient(135deg,#f59e0b,#ef4444)",color:G.white,borderRadius:20,padding:"4px 14px",fontSize:12,fontWeight:800,letterSpacing:1}}>{getComboLabel(combo)} x{combo}</span></div>}
          {feedbackBar(feedback)}

          {diff==="facile"?(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div key={"opts-"+animKey} style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
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
                        padding:"14px 10px", borderRadius:18, cursor:"pointer",
                        fontFamily:G.font, fontSize:"clamp(12px,3vw,16px)", fontWeight:800,
                        lineHeight:1.3, transition:"all .15s", position:"relative", overflow:"hidden",
                        border: isOk?"2px solid #00E676": isKo?"2px solid #FF3D57":"none",
                        background: isOk?"#052e16": isKo?"#2d0a0a": "rgba(255,255,255,.1)",
                        color: isOk?"#00E676": isKo?G.red: G.white,
                        boxShadow: isOk?"0 0 20px rgba(74,222,128,.4)": isKo?"0 0 20px rgba(239,68,68,.3)":"none",
                        animation: isOk?"answerOk .4s ease": isKo?"answerKo .4s ease": "optionIn .4s cubic-bezier(.22,1,.36,1) "+(oi*.07)+"s both",
                      }}>
                      <div style={{display:"flex",alignItems:"center",gap:8,justifyContent:"center",position:"relative",zIndex:1}}>
                        {isOk&&<span style={{fontSize:16}}>✓</span>}
                        {isKo&&<span style={{fontSize:16}}>✗</span>}
                        <span style={{fontSize:"clamp(12px,3vw,16px)",fontWeight:800}}>{opt}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <button onClick={handlePass} disabled={!!flash} style={{padding:"12px",pointerEvents:flash?"none":"auto",background:"transparent",color:"#bbb",border:"2px solid #e5e5e0",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:700,opacity:flash ? 0.3 : 1}}>Passer → (−0.5 pt)</button>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div style={{position:"relative"}}>
                <input ref={inputRef} value={guess} onChange={e=>setGuess(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
                  placeholder="Nom du joueur..." autoComplete="off"
                  style={{width:"100%",background:flash==="ko"?"#fee2e2":flash==="ok"?"#dcfce7":G.offWhite,border:("2px solid "+(flash==="ko"?G.red:flash==="ok"?G.accent:"#e5e5e0")+""),borderRadius:18,padding:"15px 18px",fontFamily:G.font,fontSize:18,fontWeight:700,color:G.dark,outline:"none",textAlign:"center",transition:"all .15s",animation:flash==="ko"?"answerKo .4s ease":flash==="ok"?"answerOk .4s ease":"none",boxSizing:"border-box"}}/>
                {guess.length>=3&&!flash&&(()=>{
                  const sugg=PLAYERS_CLEAN.filter(p=>p&&p.name&&p.name.toLowerCase().includes(guess.toLowerCase())).slice(0,5);
                  if(!sugg.length) return null;
                  return (<div style={{position:"absolute",top:"100%",left:0,right:0,background:G.offWhite,borderRadius:14,boxShadow:"0 8px 24px rgba(0,0,0,.2)",zIndex:100,overflow:"hidden",marginTop:4}}>
                    {sugg.map(p=>(<div key={p.name} onClick={()=>{setGuess(p.name);setTimeout(()=>handleSubmit(),50);}} style={{padding:"12px 18px",fontFamily:G.font,fontSize:15,fontWeight:700,color:G.dark,cursor:"pointer",borderBottom:"1px solid rgba(0,0,0,.06)",textAlign:"left"}}>{p.name}</div>))}
                  </div>);
                })()}
              </div>
              <div style={{display:"flex",gap:10}}>
                <button onClick={handlePass} disabled={!!flash} style={{flex:1,padding:15,pointerEvents:flash?"none":"auto",background:G.offWhite,color:"#aaa",border:"2px solid #e5e5e0",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700,opacity:flash ? 0.3 : 1}}>Passer →</button>
                <button onClick={handleSubmit} style={{flex:2,padding:"15px",background:G.dark,color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:16,fontWeight:800}}>Valider</button>
              </div>
            </div>
          )}
      {/* Question timer bar */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,height:25,background:"rgba(255,255,255,.08)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div key={animKey} style={{position:"absolute",inset:0,background:qTimeLeft>3?"#00E676":qTimeLeft>1?"#FFD600":"#FF3D57",width:(qTimeLeft/QUESTION_DURATION*100)+"%",transition:"width 0.3s linear",borderRadius:"4px 0 0 4px",marginLeft:"auto"}}/>
        <span style={{position:"relative",zIndex:1,fontFamily:G.heading,fontSize:14,fontWeight:800,color:"rgba(255,255,255,.9)",letterSpacing:1}}>{qTimeLeft}s</span>
      </div>
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
    <div style={{...shell,animation:"fadeIn .3s ease",overflow:"auto"}} key={"chain-"+chainCount}>
      <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        {/* Bandes pelouse */}
        {[0,1,2,3,4,5,6].map(function(i){return(
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>
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
            <div style={{fontFamily:G.heading,fontSize:26,color:G.white,marginBottom:8}}>ABANDONNER ?</div>
            <div style={{fontSize:14,color:"rgba(255,255,255,.5)",marginBottom:24}}>Ta partie sera perdue et ton score sera de 0.</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={function(){setShowQuitConfirm(false);}} style={{flex:1,padding:"13px",background:"rgba(255,255,255,.07)",color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>Continuer</button>
              <button onClick={async function(){setShowQuitConfirm(false);clearInterval(timerRef.current);clearInterval(qTimerRef.current);if(activeDuelRef.current&&activeDuelRef.current.isRoom){await abandonRoom();}else if(activeDuel){abandonDuel();}setChainPlayer("");setScreen("home");}} style={{flex:1,padding:"13px",background:"#FF3D57",color:"#fff",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>Abandonner</button>
            </div>
          </div>
        </div>
      )}

      {floatingPoints}
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

      {chainLastClub && (
        <div style={{zIndex:1,padding:"4px 16px",animation:"clubTagPop .4s cubic-bezier(.22,1,.36,1)"}}>
          <div style={{borderRadius:14,overflow:"hidden",position:"relative",height:36,boxShadow:`0 4px 16px ${cla}55`,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{position:"absolute",inset:0,background:cla}}/>
            <div style={{position:"absolute",top:0,right:0,width:"55%",bottom:0,background:clb,clipPath:"polygon(30% 0%, 100% 0%, 100% 100%, 0% 100%)"}}/>
            <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.18)"}}/>
            <span style={{position:"relative",zIndex:1,fontSize:14,color:"#fff",fontWeight:800,textShadow:"0 1px 4px rgba(0,0,0,.5)",letterSpacing:.5}}>{chainLastClub}</span>
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
          {Icon.ball(12,ptc==="#FFF"?"rgba(255,255,255,.6)":"rgba(0,0,0,.35)")} Donne un club de
        </div>
        <div style={{display:"flex",alignItems:"center",gap:14,zIndex:1,position:"relative",justifyContent:"center",flexWrap:"wrap"}}>
          <div style={{textAlign:"center"}}>
            <div style={{fontFamily:G.heading,fontSize:"clamp(18px,5vw,34px)",color:ptc==="#FFF"?"#fff":"#111",lineHeight:1.05,textShadow:ptc==="#FFF"?"0 2px 10px rgba(0,0,0,.25)":"none",letterSpacing:1}}>{chainPlayer}</div>
            {chainUsedClubs.size>0 && <div style={{fontSize:10,color:ptc==="#FFF"?"rgba(255,255,255,.55)":"rgba(0,0,0,.35)",marginTop:3,fontWeight:600}}>{chainAvailableClubs.length} club{chainAvailableClubs.length!==1?"s":""} disponible{chainAvailableClubs.length!==1?"s":""}</div>}
          </div>
        </div>
        {combo>=3 && <div style={{marginTop:6,fontSize:12,fontWeight:800,color:ptc==="#FFF"?"#fff":"#111",animation:"comboFire .5s ease",zIndex:1,position:"relative"}}>{getComboLabel(combo)} x{combo}</div>}
      </div>

      <div style={{...sheet,marginTop:0,borderRadius:"28px 28px 0 0"}}>
        {feedbackBar(feedback)}
        <input ref={inputRef} value={guess} onChange={e=>setGuess(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleChainSubmit()}
          placeholder="Nom du club..." autoComplete="off"
          style={{width:"100%",background:flash==="ko"?"#fee2e2":flash==="ok"?"#dcfce7":G.offWhite,border:("2px solid "+(flash==="ko"?G.red:flash==="ok"?G.accent:"#e5e5e0")+""),borderRadius:18,padding:"16px 18px",fontFamily:G.font,fontSize:18,fontWeight:700,color:G.dark,outline:"none",textAlign:"center",transition:"all .15s"}}/>
        <div style={{display:"flex",gap:10}}>
          <button onClick={handleChainPass} disabled={!!flash} style={{flex:1,padding:16,background:G.offWhite,color:"#aaa",border:"2px solid #e5e5e0",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700,opacity:flash ? 0.3 : 1}}>Passer →</button>
          <button onClick={handleChainSubmit} style={{flex:2,padding:"16px",background:G.dark,color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:16,fontWeight:800}}>Valider</button>
        </div>
        {chainHistory.length>0 && (
          <div style={{maxHeight:200,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"#ccc",textAlign:"center"}}>The Mercato</div>
            {[...chainHistory].reverse().map((h,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 12px",background:G.offWhite,borderRadius:12,animation:`slideIn .3s ease ${i*.04}s both`,opacity:h.passed ? 0.7 : 1}}>
                <span style={{fontSize:10,color:"#bbb",fontWeight:700,minWidth:18}}>{i+1}.</span>
                <span style={{fontSize:12,color:G.dark,fontWeight:700,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.player}</span>
                <span style={{display:"flex",alignItems:"center",flexShrink:0}}>{Icon.transfer(11,"#ccc")}</span>
                <span style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}}><ClubLogo club={h.club} size={18}/><span style={{fontSize:12,color:h.passed?"#aaa":G.bg,fontWeight:700}}>{h.club}</span></span>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Chain question timer bar */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,height:25,background:"rgba(255,255,255,.08)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div key={chainCount} style={{position:"absolute",inset:0,background:qTimeLeft>8?"#00E676":qTimeLeft>4?"#FFD600":"#FF3D57",width:(qTimeLeft/CHAIN_QUESTION_DURATION*100)+"%",borderRadius:"4px 0 0 4px",marginLeft:"auto"}}/>
        <span style={{position:"relative",zIndex:1,fontFamily:G.heading,fontSize:14,fontWeight:800,color:"rgba(255,255,255,.9)",letterSpacing:1}}>{qTimeLeft}s</span>
      </div>
    </div>
    );
  }


  // ── CHAIN GAME TIMER BAR (injected via CSS position:fixed, already in game screen) ──
  // ── ROUND END ──
  if(screen==="roundEnd") return (
    <div style={{...shell,animation:"fadeUp .4s ease"}} key="roundEnd">
      <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        {/* Bandes pelouse */}
        {[0,1,2,3,4,5,6].map(function(i){return(
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>
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
          {totalRounds===2&&currentRound===1?"⚽ MI-TEMPS !":"MANCHE "+currentRound+" TERMINÉE"}
        </div>
        {totalRounds===2&&currentRound===1&&<div style={{fontSize:14,color:"rgba(255,255,255,.6)",marginTop:8,letterSpacing:2}}>Retour sur le terrain dans 3... 2... 1...</div>}
      </div>
      <div style={sheet}>
        {roundScores.map((s,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:i===roundScores.length-1?G.dark:G.offWhite,borderRadius:18,padding:"16px 20px",animation:`slideIn .4s ease ${i*.08}s both`}}>
            <span style={{fontSize:15,color:i===roundScores.length-1?G.white:"#888",fontWeight:700}}>Manche {i+1}</span>
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
            <div style={{fontSize:11,letterSpacing:3,textTransform:"uppercase",color:"rgba(255,255,255,.4)",marginBottom:10,textAlign:"center"}}>Classement en cours</div>
            {roomRoundSnapshot ? roomRoundSnapshot.map(function(p,i){
              const medals=["🥇","🥈","🥉"];
              return(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:12,background:p.id===playerId?"rgba(0,230,118,.1)":"rgba(255,255,255,.04)",border:p.id===playerId?"1px solid rgba(0,230,118,.3)":"1px solid rgba(255,255,255,.06)",marginBottom:6}}>
                  <span style={{fontSize:18,width:28}}>{i<3?medals[i]:i+1}</span>
                  <span style={{flex:1,fontSize:13,fontWeight:800,color:p.id===playerId?G.accent:G.white}}>{p.name}{p.id===playerId?" (toi)":""}</span>
                  <span style={{fontFamily:G.heading,fontSize:22,color:G.white}}>{p.partial_score||0} <span style={{fontSize:11,color:"rgba(255,255,255,.3)"}}>pts</span></span>
                </div>
              );
            }) : (
              <div style={{textAlign:"center",padding:"16px",color:"rgba(255,255,255,.35)",fontSize:13}}>⏳ Chargement des scores...</div>
            )}
          </div>
        )}
        <button onClick={()=>startRound(currentRound+1)} style={{width:"100%",padding:"18px",background:totalRounds===2&&currentRound===1?"#16a34a":G.dark,color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:17,fontWeight:800,marginTop:16,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>{Icon.whistle(18,G.white)} {totalRounds===2&&currentRound===1?"REPRENDRE LA PARTIE →":"MANCHE "+(currentRound+1)}</button>
      </div>
    </div>
  );

  // ── FINAL ──
const makeResultScreen = (sc, mode, isChain) => { const img = resultImg || (sc > 0 ? WIN_IMGS : LOSE_IMGS)[0];    return (    <div style={{...shell,animation:"fadeUp .4s ease"}} key={isChain?"chainEnd":"final"}>
      {pseudoModal}
      {confettiOverlay}<div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        {/* Bandes pelouse */}
        {[0,1,2,3,4,5,6].map(function(i){return(
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>
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
        <img src={img} style={{height:"clamp(204px,51vw,289px)",objectFit:"contain",objectPosition:"center bottom",animation:"slideInRight .5s ease both",filter:"drop-shadow(0 4px 20px rgba(0,230,118,.3))",display:"block",margin:"0 auto"}} alt=""/>
        <div style={{fontFamily:G.heading,fontSize:"clamp(20px,5.5vw,32px)",color:isNewRecord?G.gold:G.white,letterSpacing:2,animation:"fadeUp .4s ease .15s both",marginTop:4}}>{isNewRecord?"NOUVEAU RECORD !":isChain?"TEMPS ÉCOULÉ !":""}</div>
        <div style={{fontSize:"clamp(16px,4.5vw,22px)",color:G.white,fontWeight:800,marginTop:isNewRecord||isChain?6:16,animation:"fadeUp .4s ease .25s both",textTransform:"uppercase",letterSpacing:1,textShadow:"0 2px 10px rgba(0,0,0,.4)"}}>{[
          "T'AS PAS LE NIVEAU.. 👀",
          "C'EST TOUT CE QUE T'AS ? 💀",
          "LE GOAT C'EST TOI OU PAS ? 🐐",
          "ON JOUE PAS, ON DOMINE 😤",
          "T'AS KIFFÉ OU T'AS SOUFFERT ? 😂",
          "PROUVE QUE T'ES PAS UN RANDOM 🔥",
          "LE FOOT C'EST DANS LA TÊTE FRÈRE 🧠",
          "T'AURAIS PAS DÛ RATER LES AUTRES 😏",
        ][Math.abs(Math.floor(sc * 3 + totalRounds)) % 8]}</div>
      </div>
      <div style={sheet}>
        <div style={{background:"rgba(255,255,255,.06)",borderRadius:20,padding:"20px",textAlign:"center",border:"1.5px solid #eee"}}>
          <div style={{fontSize:11,letterSpacing:3,textTransform:"uppercase",color:"#bbb"}}>Score{isChain?"":" total"}</div>
          <div style={{fontFamily:G.heading,fontSize:"clamp(54px,13vw,80px)",color:G.white,lineHeight:1}}>{sc}</div>
          <div style={{fontSize:11,color:"#bbb"}}>pts{isChain?` · ${chainCount} lien${chainCount>1?"s":""}`:`  ·  ${totalRounds} manche${totalRounds>1?"s":""}`}</div>
          {maxCombo>=3&&<div style={{fontSize:13,color:"#f59e0b",marginTop:4,fontWeight:700}}>🔥 Meilleur combo : x{maxCombo}</div>}
          {isNewRecord&&<div style={{fontSize:12,color:G.accent,marginTop:6,fontStyle:"italic"}}>Ancien record battu 🎉</div>}
          {dayStreak>=2&&<div style={{fontSize:12,color:"#FF6B35",marginTop:6,fontWeight:700}}>🔥 {dayStreak} jours de suite !</div>}
        </div>

        {!isChain&&roundScores.length>1&&(
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {roundScores.map((s,i)=>{
              const best=Math.max(...roundScores);
              return(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:s===best?G.dark:G.offWhite,borderRadius:12,padding:"10px 16px",animation:`slideIn .4s ease ${i*.07}s both`}}>
                  <span style={{fontSize:13,fontWeight:700,color:s===best?G.white:"#aaa"}}>Manche {i+1} {s===best?"⭐":""}</span>
                  <span style={{fontFamily:G.heading,fontSize:24,color:s===best?G.white:G.dark}}>{s} pts</span>
                </div>
              );
            })}
          </div>
        )}
      
        <button onClick={()=>{setLbMode(mode);setLbDiff(diff);loadLeaderboard(lbMode);setShowLeaderboard(true);}}
          style={{width:"100%",padding:"14px",background:"#f0f9f4",color:"#16a34a",border:"2px solid #86efac",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800}}>
          <span style={{display:"flex",alignItems:"center",gap:8,justifyContent:"center"}}>{Icon.stadium(16,"#16a34a")} Voir le classement{myLbRank?` · #${myLbRank}`:""}</span>
        </button>
        {!pseudoConfirmed && (
          <div style={{background:"rgba(255,200,0,.1)",border:"1px solid rgba(255,200,0,.3)",borderRadius:14,padding:"12px 16px",textAlign:"center"}}>
            <div style={{fontSize:13,color:"#ffd600",fontWeight:700,marginBottom:6}}>⚠️ Score non enregistré</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.5)",marginBottom:10}}>Crée un pseudo pour apparaître au classement</div>
            <button onClick={()=>setPseudoScreen(true)} style={{padding:"8px 20px",background:"#ffd600",color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:800}}>Créer mon pseudo</button>
          </div>
        )}
        <button onClick={()=>{if(isChain)startChain();else startCompetition();}} style={{width:"100%",padding:"18px",background:G.dark,color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:17,fontWeight:800,letterSpacing:1,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>{Icon.ball(18,G.white)} Rejouer</button>
        <button onClick={function(){
          const grade = getGrade(sc);
          const txt = `${grade.emoji} J'ai scoré ${sc} pts en mode ${isChain?"The Mercato":"The Plug"} sur GOAT FC !\nGrade : ${grade.label}\nT'as le niveau ? 👇\nhttps://bridgeball.vercel.app`;
          if(navigator.share){navigator.share({title:"GOAT FC",text:txt});}
          else{navigator.clipboard.writeText(txt).then(function(){alert("Copié ! Colle-le où tu veux 📋");});}
        }} style={{width:"100%",padding:"14px",background:"linear-gradient(135deg,#1d4ed8,#7c3aed)",color:"#fff",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          📤 Partager mon score
        </button>
        <button onClick={()=>setScreen("home")} style={{width:"100%",padding:"14px",background:"transparent",color:"#bbb",border:"2px solid #e5e5e0",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:700}}>↩ Accueil</button>
      </div>
    </div>
  );
}


  // ── WAITING FOR ROOM RESULTS ──
  // ── DUEL RESULT SCREEN ──
  if (duelResult && duelResult.isRoom) {
    const medals = ["🥇","🥈","🥉"];
    const myEntry = duelResult.players.find(function(p){return p.id===playerId;});
    const myRank = duelResult.players.findIndex(function(p){return p.id===playerId;}) + 1;
    return (
      <div style={{...shell,animation:"fadeUp .4s ease",overflow:"auto"}} key="roomResult">
        <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        {/* Bandes pelouse */}
        {[0,1,2,3,4,5,6].map(function(i){return(
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>
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
          <div style={{fontSize:52,marginBottom:8}}>{myRank<=3?medals[myRank-1]:myRank+"ème"}</div> {(myRank===1?WIN_IMGS:LOSE_IMGS)[Math.floor(Date.now()%(myRank===1?WIN_IMGS:LOSE_IMGS).length)] && (   <img src={(myRank===1?WIN_IMGS:LOSE_IMGS)[Math.floor(Date.now()%(myRank===1?WIN_IMGS:LOSE_IMGS).length)]} style={{width:"60%",maxWidth:220,margin:"8px auto",display:"block",objectFit:"contain"}} /> )}
          <div style={{fontFamily:G.heading,fontSize:"clamp(30px,8vw,50px)",color:myRank===1?G.gold:G.white,letterSpacing:2}}>
            {myRank===1?"VICTOIRE !":myRank===2?"2ÈME PLACE":myRank===3?"3ÈME PLACE":"RÉSULTATS"}
          </div>
        </div>
        <div style={{...sheet,borderRadius:"28px 28px 0 0"}}>
          {duelResult.players.map(function(p,i){return(
            <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:14,background:p.id===playerId?"rgba(0,230,118,.08)":"rgba(255,255,255,.03)",border:p.id===playerId?"1px solid rgba(0,230,118,.25)":"1px solid rgba(255,255,255,.05)",marginBottom:6}}>
              <div style={{fontFamily:G.heading,fontSize:22,width:32,textAlign:"center",color:i<3?["#FFD600","#C0C0C0","#CD7F32"][i]:"rgba(255,255,255,.3)"}}>{i<3?medals[i]:i+1}</div>
              <div style={{flex:1,fontSize:14,fontWeight:800,color:p.id===playerId?G.accent:G.white}}>{p.name}{p.id===playerId?" (toi)":""}</div>
              <div style={{fontFamily:G.heading,fontSize:26,color:i===0?G.gold:G.white}}>{p.score||0} <span style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>pts</span></div>
            </div>
          );})}
          <button onClick={function(){
            const myEntry = duelResult.players.find(function(p){return p.id===playerId;});
            const grade = getGrade(myEntry?.score||0);
            const rank = duelResult.players.findIndex(function(p){return p.id===playerId;})+1;
            const txt = rank===1
              ? `${grade.emoji} J'ai remporté la salle sur GOAT FC avec ${myEntry?.score||0} pts 🏆\nGrade : ${grade.label}\nT'as le niveau ? 👇\nhttps://bridgeball.vercel.app`
              : `J'ai terminé ${rank}ème sur GOAT FC avec ${myEntry?.score||0} pts\nGrade : ${grade.label}\nhttps://bridgeball.vercel.app`;
            if(navigator.share){navigator.share({title:"GOAT FC",text:txt});}
            else{navigator.clipboard.writeText(txt).then(function(){alert("Copié ! 📋");});}
          }} style={{width:"100%",padding:"13px",background:"linear-gradient(135deg,#1d4ed8,#7c3aed)",color:"#fff",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:8,marginBottom:6}}>
            📤 Partager le résultat
          </button>
          <button onClick={function(){setDuelResult(null);setScreen("home");}} style={{width:"100%",padding:"16px",background:G.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800,marginTop:0}}>
            Retour à l'accueil
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
    const label = abandoned ? "ABANDON !" : won ? "VICTOIRE !" : draw ? "ÉGALITÉ !" : "DÉFAITE";
    const labelColor = won || abandoned ? G.accent : draw ? G.gold : "#FF3D57";
    return (
      <div style={{...shell,animation:"fadeUp .4s ease"}} key="duelResult">
        <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        {/* Bandes pelouse */}
        {[0,1,2,3,4,5,6].map(function(i){return(
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>
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
          <img src={won?randomImg(WIN_IMGS):randomImg(LOSE_IMGS)} style={{height:"clamp(196px,49vw,272px)",objectFit:"contain",objectPosition:"center bottom",animation:"slideInRight .5s ease both",filter:won?"drop-shadow(0 4px 20px rgba(0,230,118,.35))":"drop-shadow(0 4px 10px rgba(0,0,0,.4))",display:"block",margin:"0 auto"}} alt=""/>
          <div style={{fontFamily:G.heading,fontSize:"clamp(30px,8vw,46px)",color:labelColor,letterSpacing:2,marginTop:4}}>{label}</div>
          <div style={{fontSize:"clamp(13px,3.5vw,18px)",color:G.white,fontWeight:800,marginTop:6,animation:"fadeUp .4s ease .25s both",textTransform:"uppercase",letterSpacing:1,textShadow:"0 2px 10px rgba(0,0,0,.4)"}}>{won ? [
            "T'AS MIS LA MISÈRE 💀",
            "T'ES CHAUD COMME BRAISE 🔥",
            "ON JOUE PAS, ON DOMINE 😤",
            "LE GOAT C'EST TOI 🐐",
            "TROP FACILE FRÈRE 😴",
          ][Math.abs(Math.floor(duelResult.myScore * 7)) % 5] : draw ? [
            "MATCH NUL MAIS ON SAIT QUI ÉTAIT MEILLEUR 👀",
            "T'AS EU DE LA CHANCE 😏",
          ][Math.abs(Math.floor(duelResult.myScore * 3)) % 2] : [
            "RETOURNE T'ENTRAÎNER 😂",
            "T'AS CRU QUOI ? 🤡",
            "C'EST DUR HEIN ? 💀",
            "LA PROCHAINE FOIS PEUT-ÊTRE 😴",
            "T'AS LES CRAMPONS MAIS PAS LE NIVEAU 🎮",
          ][Math.abs(Math.floor(duelResult.theirScore * 7)) % 5]}</div>
          {(()=>{const grade=getGrade(duelResult.myScore||0); return <div style={{display:"inline-flex",alignItems:"center",gap:8,marginTop:8,background:grade.color+"22",borderRadius:20,padding:"6px 14px"}}><span style={{fontSize:13,fontWeight:800,color:grade.color,letterSpacing:.5}}>{grade.label}</span></div>; })()}
          <div style={{fontSize:14,color:"rgba(255,255,255,.4)",marginTop:8}}>
            {abandoned ? duelResult.oppName+" a abandonné 🏃" : "Duel "+(duelResult.mode==="pont"?"The Plug":"The Mercato")}
          </div>
        </div>
        <div style={{...sheet,borderRadius:"28px 28px 0 0"}}>
          {/* Scores */}
          <div style={{display:"flex",gap:12,marginBottom:8}}>
            <div style={{flex:1,background:"rgba(0,230,118,.08)",border:"2px solid "+(won?"#00E676":"rgba(255,255,255,.08)"),borderRadius:20,padding:"20px 12px",textAlign:"center"}}>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.4)",marginBottom:6}}>Toi</div>
              <div style={{fontFamily:G.heading,fontSize:52,color:won?G.accent:G.white,lineHeight:1}}>{duelResult.myScore}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.3)",marginTop:4}}>pts</div>
            </div>
            <div style={{display:"flex",alignItems:"center",fontFamily:G.heading,fontSize:24,color:"rgba(255,255,255,.3)"}}>VS</div>
            <div style={{flex:1,background:"rgba(255,255,255,.04)",border:"2px solid "+(!won&&!draw?"#FF3D57":"rgba(255,255,255,.08)"),borderRadius:20,padding:"20px 12px",textAlign:"center"}}>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.4)",marginBottom:6}}>{duelResult.oppName}</div>
              <div style={{fontFamily:G.heading,fontSize:52,color:(!won&&!draw)?"#FF3D57":G.white,lineHeight:1}}>{duelResult.theirScore}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.3)",marginTop:4}}>pts</div>
            </div>
          </div>
          {/* Streak banner */}
          {won && winStreak >= 2 && (
            <div style={{textAlign:"center",marginBottom:8,padding:"10px 16px",background:"linear-gradient(135deg,rgba(255,107,53,.2),rgba(255,214,0,.2))",borderRadius:14,border:"1px solid rgba(255,107,53,.3)"}}>
              <span style={{fontSize:20}}>🔥</span>
              <span style={{fontFamily:G.heading,fontSize:18,color:"#FF6B35",marginLeft:8,letterSpacing:1}}>
                {winStreak} VICTOIRES D'AFFILÉE
              </span>
              {winStreak >= 5 && <div style={{fontSize:12,color:"rgba(255,107,53,.8)",marginTop:2}}>
                {winStreak >= 10 ? "T'es inarrêtable 🐐" : winStreak >= 7 ? "Personne peut t'arrêter 😤" : "T'es en feu frère 🔥"}
              </div>}
            </div>
          )}
          {/* Badge Invaincu */}
          {won && duelResult.oppName && (()=>{
            const h2h = duels.filter(function(d){return d.status==="complete"&&(d.challenger_id===playerId||d.opponent_id===playerId)&&(d.challenger_name===duelResult.oppName||d.opponent_name===duelResult.oppName);});
            const lost = h2h.some(function(d){const ms=d.challenger_id===playerId?d.challenger_score:d.opponent_score;const ts=d.challenger_id===playerId?d.opponent_score:d.challenger_score;return ms<ts;});
            return !lost && h2h.length >= 2 ? (
              <div style={{textAlign:"center",marginBottom:8,padding:"10px 16px",background:"rgba(255,215,0,.1)",borderRadius:14,border:"1px solid rgba(255,215,0,.3)"}}>
                <span style={{fontFamily:G.heading,fontSize:16,color:"#FFD700",letterSpacing:1}}>😤 INVAINCU CONTRE {duelResult.oppName.toUpperCase()}</span>
              </div>
            ) : null;
          })()}
          {/* Message auto du vainqueur au perdant */}
          {!won && !draw && !abandoned && duelResult.oppName && (
            <div style={{marginBottom:8,padding:"12px 16px",background:"rgba(255,255,255,.05)",borderRadius:14,border:"1px solid rgba(255,255,255,.1)"}}>
              <div style={{fontSize:10,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>💬 Message de {duelResult.oppName}</div>
              <div style={{fontSize:14,fontWeight:700,color:G.white}}>
                {[
                  "Trop facile 😴 Reviens quand t'es prêt",
                  "T'as vu la différence ? C'est ce qu'on appelle le niveau 🐐",
                  "Même pas besoin de transpirer frère 😂",
                  "Merci pour les points 🙏",
                  "La next fois prépare-toi mieux 💀",
                  "J'ai joué les yeux fermés et t'as quand même perdu 😤",
                  "C'est dur hein ? Normal, t'as en face 😏",
                  "Viens on refait si t'as le courage 👀",
                ][Math.abs(Math.floor(duelResult.theirScore - duelResult.myScore + duelResult.theirScore)) % 8]}
              </div>
            </div>
          )}
          <div style={{fontSize:15,color:"rgba(255,255,255,.85)",textAlign:"center",padding:"10px 0",fontWeight:700,lineHeight:1.4}}>
            {abandoned
              ? "T'as même pas eu le courage de finir 😂"
              : won
              ? [
                  "T'as mis la misère à "+duelResult.oppName+" 💀",
                  "T'es chaud comme Mbappé un soir de CL 🔥",
                  duelResult.oppName+" vient de prendre une leçon 😤",
                  "LA COUPE IL RESTE AU MAROOOC, T'ES UN JNOUN OU QUOI?! 🏆",
                  "On joue pas dans la même cour frère 🐐",
                ][Math.floor(duelResult.myScore * 7) % 5]
              : draw
              ? "Match nul, mais on sait qui était le meilleur 👀"
              : [
                  "Même pas un but ! Même pas un but ! 😂",
                  "T'as les crampons mais pas le niveau frère 💀",
                  "Retourne jouer à la Playstation 🎮",
                  duelResult.oppName+" t'a mis dans sa poche 😭",
                  "T'as cru quoi, que c'était FIFA ? 🤡",
                ][Math.floor(duelResult.theirScore * 7) % 5]
            }
          </div>
          {won && !abandoned && (
            <div style={{marginBottom:8,padding:"10px 16px",background:"rgba(0,230,118,.05)",borderRadius:14,border:"1px solid rgba(0,230,118,.1)"}}>
              <div style={{fontSize:10,color:"rgba(0,230,118,.5)",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>💬 Message envoyé à {duelResult.oppName}</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,.5)",fontStyle:"italic"}}>
                {[
                  "Trop facile 😴 Reviens quand t'es prêt",
                  "T'as vu la différence ? C'est ce qu'on appelle le niveau 🐐",
                  "Même pas besoin de transpirer frère 😂",
                  "Merci pour les points 🙏",
                  "La next fois prépare-toi mieux 💀",
                  "J'ai joué les yeux fermés et t'as quand même perdu 😤",
                  "C'est dur hein ? Normal, t'as en face 😏",
                  "Viens on refait si t'as le courage 👀",
                ][Math.abs(Math.floor(duelResult.myScore * 3 + duelResult.theirScore)) % 8]}
              </div>
            </div>
          )}
          <button onClick={function(){
            const grade = getGrade(duelResult.myScore||0);
            const result = won ? "victoire" : draw ? "nul" : "défaite";
            const txt = won
              ? `${grade.emoji} J'ai écrasé ${duelResult.oppName} ${duelResult.myScore}-${duelResult.theirScore} sur GOAT FC 😤\nGrade : ${grade.label}\nT'as le niveau ? 👇\nhttps://bridgeball.vercel.app`
              : `J'ai perdu ${duelResult.myScore}-${duelResult.theirScore} contre ${duelResult.oppName} sur GOAT FC 😤\nLa revanche arrive...\nhttps://bridgeball.vercel.app`;
            if(navigator.share){navigator.share({title:"GOAT FC",text:txt});}
            else{navigator.clipboard.writeText(txt).then(function(){alert("Copié ! 📋");});}
          }} style={{width:"100%",padding:"13px",background:"linear-gradient(135deg,#1d4ed8,#7c3aed)",color:"#fff",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:6}}>
            📤 Partager le résultat
          </button>
          <button onClick={function(){setDuelResult(null);setScreen("home");}} style={{width:"100%",padding:"16px",background:G.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800,marginTop:2}}>
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }
  if(screen==="final") return makeResultScreen(total,"pont",false);
  if(screen==="chainEnd") return makeResultScreen(chainScore,"chaine",true);

  return <div style={{...shell,justifyContent:"center",alignItems:"center"}}><div style={{color:G.white}}>Chargement…</div></div>;
}
