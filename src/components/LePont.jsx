import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { PLAYERS, RETIRED_PLAYERS, GG_WC_WINNERS, GG_CL_WINNERS } from "../players.jsx";



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
function countryToFlag(code) {
  if (!code || code.length !== 2) return "";
  const codePoints = code.toUpperCase().split("").map(c => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
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

const GRADES = [
  { min:10000, label:"GOAT",      labelEn:"GOAT",    emoji:"🐐", color:"#FFD700" },
  { min:5000,  label:"Légende",   labelEn:"Legend",  emoji:"☄️", color:"#FF6B35" },
  { min:2000,  label:"Titulaire", labelEn:"Starter", emoji:"🐺", color:"#00B4D8" },
  { min:500,   label:"Espoir",    labelEn:"Rookie",  emoji:"👦🏻", color:"#2EC4B6" },
  { min:0,     label:"Amateur",   labelEn:"Amateur", emoji:"🏖️", color:"#8D99AE" },
];

function getGrade(score) {
  const g = GRADES.find(function(g){ return score >= g.min; }) || GRADES[GRADES.length-1];
  let lang = "fr";
  try { lang = localStorage.getItem("bb_lang") === "en" ? "en" : "fr"; } catch {}
  return { ...g, label: lang === "en" ? (g.labelEn || g.label) : g.label };
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

const CLUB_COLORS = {
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
  "Stoke":["#E03A3E","#FFFFFF"],
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
  "Stoke","Bolton","Swansea","Sheffield United","Blackburn","Ipswich Town","Portsmouth",
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

const SPLASH_IMG = "/splash.png";


const WIN_IMGS = ["/win1.png", "/win2.png", "/win3.png", "/win4.png", "/win5.png"];
const LOSE_IMGS = ["/lose1.png", "/lose2.png", "/lose3.png", "/lose4.png"];
const randomImg = (arr) => arr[Math.floor(Math.random()*arr.length)];
const PLUG_CARD_IMG = "/plug-card.png";
const MERCATO_CARD_IMG = "/mercato-card.png";
const GRID_CARD_IMG = "/grid-card.png";
const GUESS_CARD_IMG = "/guess-card.png";

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
       "Leeds United", "Burnley", "Watford", "Norwich City", "Sheffield United", "Stoke", "Swansea",
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

// Thèmes par jour de la semaine (0=dim, 1=lun, ... 6=sam)
const DAILY_THEMES = {
  1: { id:"L1",         flag:"🇫🇷", labelFr:"LUNDI LIGUE 1",       labelEn:"MONDAY LIGUE 1",       color:"#1B2C5C", filter:"L1" },
  2: { id:"PL",         flag:"🇬🇧", labelFr:"MARDI PREMIER LEAGUE", labelEn:"TUESDAY PREMIER LEAGUE", color:"#3D195B", filter:"PL" },
  3: { id:"LIGA",       flag:"🇪🇸", labelFr:"MERCREDI LA LIGA",     labelEn:"WEDNESDAY LA LIGA",     color:"#C8102E", filter:"LIGA" },
  4: { id:"SERIEA",     flag:"🇮🇹", labelFr:"JEUDI SERIE A",        labelEn:"THURSDAY SERIE A",      color:"#008C45", filter:"SERIEA" },
  5: { id:"BUNDESLIGA", flag:"🇩🇪", labelFr:"VENDREDI BUNDESLIGA",  labelEn:"FRIDAY BUNDESLIGA",     color:"#D4AF37", filter:"BUNDESLIGA" },
  6: { id:"LEGEND",     flag:"🐐", labelFr:"SAMEDI LÉGENDE",        labelEn:"SATURDAY LEGEND",        color:"#FFD700", filter:"LEGEND" },
  0: { id:"JOKER",      flag:"🎲", labelFr:"DIMANCHE JOKER",        labelEn:"SUNDAY JOKER",           color:"#00E676", filter:"JOKER" },
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
function norm(s){return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9 ]/g,"").trim();}
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
    return false;
  });
}
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
function getPlayerClubs(name){const p=PLAYERS_CLEAN.find(x=>x.name===name);return p?p.clubs:[];}
function getPlayersForClub(club){return CLUB_INDEX[club]||[];}

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
  const pool = POSITIVE_FEEDBACK[lang==="en"?"en":"fr"];
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
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;700;800&display=swap');
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
    @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
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
favLink.href = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAABCGlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGA8wQAELAYMDLl5JUVB7k4KEZFRCuwPGBiBEAwSk4sLGHADoKpv1yBqL+viUYcLcKakFicD6Q9ArFIEtBxopAiQLZIOYWuA2EkQtg2IXV5SUAJkB4DYRSFBzkB2CpCtkY7ETkJiJxcUgdT3ANk2uTmlyQh3M/Ck5oUGA2kOIJZhKGYIYnBncAL5H6IkfxEDg8VXBgbmCQixpJkMDNtbGRgkbiHEVBYwMPC3MDBsO48QQ4RJQWJRIliIBYiZ0tIYGD4tZ2DgjWRgEL7AwMAVDQsIHG5TALvNnSEfCNMZchhSgSKeDHkMyQx6QJYRgwGDIYMZAKbWPz9HbOBQAAAh10lEQVR4nI16d5icxZF+VfcXJu/szOYgbdCupFVAAYElFAgiiSAMB8bnwwF8xuZ4OCf8AL97bJ85w9nY2GcDZxvuwJzBPkwUUUgrhJWllYRWOaw272ycHL7Q3fX7YxZJizjf9TN/zPNNT3/1dlVX11tVCP+3gQCACAAICADAAAiIiIgQEJCIJqdRcSIBaEACAAE5kASkyZUI6Ow6SICAwBAAiksCAE2uNkUAhPMfTgr2v4iOiAwUBwACDuAB0AHk5IdLXoQBCMBgEhsH5Egc9BYdHHJPuiAABAEgEEx+EBARCSXIyX8hgABQgASISACkimD/GgDtr4oOwJEUkQnYCL75gdDscDQa1m3NMI28sLq7urNHMnAKWJ5hcWsJkCNwQB1FSNzy0C3WROG1H7+mJbkSVFQaEDBAJZXyE0wH72z/9IbpUS3oCjuVTA8PxtP9GXVCQhJAA1QIkgg+Xfq/pgFkCJyIQ3BRsHJNdfXsWrffzfUk+QRze0TDjOm1DbVlsyKZYH7XyO7d73fANqVJLlGRIgBgjIW+XHJz6JbkRLzdac/8KaO4Ag7oMuYyaQh+IZu/cuFnl91QXfD3dwzIePbIwWOW5rglPFVFY+Xpsf3Dhfa0GpWMI8lPMaq/BgA5kkasis2+sy2yIFqWLRvfODbSHbNStpN3MolMbjQHAD7NM3tx09IrlydmJfdkOk/8xzFe4PWX1mMt6+44fdndq/M/yjlZK/BoYMtzW5oWNRV6CqMfjMqQrF8z7cbZa68uufi1p//c3Te0q2NvAVS4ptQT8Hg9ZsDwV7fW0TXGqWxv8q3hxMZRJATx6Rg+BQBqSBp5Fnou+NaCgQMD6R3JsC88OjIGErjU/CW+8sqysCc0fHjo9L5+AGAI1152+Q3fuelV/tL7/7p13po5c5359mqnPlb3zG3PhEPhFT9ZJuaSvkHb7u7o3di79K6lv7vmia2/feWxZ54p5DOxZGHBmrmmxzuWHZ8YiltZSyFxyaoqK8YDiaq/aYAB99QTx9BCEmePxP8IADmSDuZcfdGji09t6Bp7dhRcAAHgAqiPvYwGvnrf/EtmY1rueOUjv9/nCwRKDPPRZx58lr/zzo63ZpxuNTZwo8Y4uO9QdXW17tG0DBfXU3f49J03f+Xekm988yv3JbPDsURqbDxxyZqL0jx3eNdRNa5AfXzEOQACaAAV0PTdFoP0Yz85woZRnYdhCgBkAAayBnbBP8/paR+Mr5tgWZ0koQRFCgBQUdF7KFDghwtvWuh0Wp37jmo6b26ZEWTBS+9eeOKik1V+338t2VQoWIGSQLQs2tvVW1UTvuLdOT2d1q3a5977XXu4uuTD9q0j2dgtP7xh11v7+3b1IyASEgEBICEAAmcACk1QtWL+/5ubPpbu+VkfE6jcKQjYFDg6ko+a7po2cTgZ/+OEZvvJo4PPJI0j44gMGAICAWmGBhnoeGN/8CL/rFnTpJAnjh7Pq1zHG/v+Bq8Yei8+Y0kzAORS+aHeYQBonFOXeCv9+M3ffuOll+K5RMfuvcMTsQWXLNyzubNva7/mMQAYERIyQEaMgc5AY+DRATU+YB58/FB0UUngIr9CQjZ108/ZfiSTIqtLWj7XsuuRTuYGlSG48lBekC3AFuQIIIkIAJLydPEtS77yxVvfObxuYH2yZ193PJ0LhYKtM+aWNdtGm38ibwck18N+hcpJZzN5Z+xQfMGM6bFD7rLlS3/7m6ejVWU1V1Uuu3zBwP6x//71q+AyphtKUvFOQx3B0LihC53AJMg4ZZ8tab6gYtf3DmAWyT1rSGc1gBqCF1qubB7YPA6D8sovXfn8f/2+6co2VW4aZSEsMdGvM9MgUGTgN//ta3d8+aa3X96w61fHu/v7Fy1rBQbZbC6dHTuwZSiiYSwR23h81/p9H7bv2/7hsX1dp4cuuaypc/PxkbHR3/3m6byen76k/uCfD+/9/ZHFF7Q9+sJD4Yawci3u0cHg6NfQb+iRgCjjS2+//NWX/7zg+kvG3x5hhla6JESCEM/uOzujCEXKM93kXh7bNuKPhDSDX9K26Pkf/Pz+H31L1Zt6yMdDXvKCr9z3yPP3AzlP/+i/D2w+lk5nE/EUq/XU15QRUCw23Nw8Y/N/HmuKlDW3tlRWVIX8wVqqvXLlzL/88WBr84Wtrc2ZXLZxekPcSuQz+e7Ont//+PX9Hx74wR/urb9kulQF7tGYT8eg6WkL/+JXjz310MPzW2aVVIX1jNnzYax+aTUYgOcYvnbWfhRVzilLd+dVTDg1dOn8SzoGD+UKuX+47PaLW+bd/8jDfXtP6yWef3rsa107enb/+eh4bCQWH+M+E0HrHOyeu7Chf2A8n89395weH0vP6G2867abhvJjZoDJHtmxZcdwTzYaGBrqjwGDQHPgRH8PBYzesZFIriDfosRE+oFfffXRb//nwOFxbhgzV7Y99aOfzC5vfuvk5payxqsvWrXtpQ3jHcmWxVVYg9RHnwQACMDBV+sfPzEBtjQMXYDUCRfUztrUu6PSE7n6y6v/VHj9ji9fdGDX3p3PdcVGhxzbgjBIKAA3h0cnFtzUUL0zFBtLDw4OhcMlu985un19JwdeUJYn6MnHbI+pdXYeEq4IR4IyohWOuuBB0GU8PR7vi1t240u07p6f3fzI/X8uq667+u5rmUZbBvcur1t0KHYqnc96dCM3nHFcx1tt5nutTwIgADDBCHBrJAeu8gUCly5e+tHYEUhDa7jhQPLoK39469qbFrBM8sjrsfAMP2uq0ms8dW3TXZ26BruH5WBqJg9XlMfG0pyzfD7v9Xq50GzHQYWm5tFLdCmFJCWFrG+uxXkGJ8/0kobWuiaZd/r6u1nMnegu7H5p9z0/uvnFFzq2b+lYXDWnyaw+FD/pcmfNssuf9DxBKelmhKfUyJNVvJCmulEPmCYTGQkKEydiN3/tjsRgMujz2ZrV3rG1oiLcMM1Z/4u9iBg/njBHNeq0xbvZlmR5C69aWNlmHuDdpwYQkQiIyOPxlFVENZ0DgtfnCYVC0WhU13UA7O8dioway2ctXFrW1jRaZrVP+E6i3WXZY4VtLxyHofFZ88rzWXvr0T2aj5d7Sw91HvvcV++w+pJAiDlleDTAydj+HBMiAAZCCXIVAHDJRnb1fX/4X5rmt/zd7beM5XMXr44cevf46NFszj9UXlJ2bP8pADgJ3X/ZtM0b8jppR4IskgRE1HTd7/cFg6Gx0XGllGVZVVVVXNPGJiaAUTKR3vzjv3Bk5AFVUGc2sK6tlrn8/Sc7Pvura5/6t+29lf1vyPaXX3nj1I5jukWoCBwCl5BNuX6nhNOMF8GQKLi66TXzWs+OU/988Gfzr5wTWeJf/+fBAuTtuE2trNatHjwRY5whgp23wQAUqPk4CuY6rqHrnPNMJq2UIiLbtguFguXYHo/HH/Cls6mCa5EG4CDXOClSSjUvbkq4ucTIBBe8e8vJi5c373zjo41DG3hKGDmFQCLvAIBDrpDy3GjirBsFBEmCkBAQJIhEwR7PGYRqMB2J5rvb++L9BUc6XPcMHhk1Z/uaLpyGEqVQSijlKF7NSeHiJQsvvWaloRuFQiGVSruuS0RKqVgslkwkLlu1avmFy7xRj1GpK1cpKaWQuslnrWy2Am68L0mAuXzu8Fs9TdM8oyd7edwCoaTlOGMZkAAETKlPMINzDjEAY8SwyDoUKiRXWPEsGLJhvrHtkdOOcBQopjNWwNMdg3UryuctanEHnEwqnx91JHMLF1i7rT1rG6+vGao+euSorutSCgAQQti2XVtXM5ob2e108FbwHtVDLT4zonm8mq/WO9yXGvsoqYFXacKS9sD+cRL5qtklI+0DOveAJCBUtgsAGjCuGKjzABS1IGyXLAJA1DgiSEvInAgtCnJ0hw9nUVPIGEkCzpjNBraMDDXyksaAtsBTclFFasvAvbd/raWi9Vv3fys4EgBAISRjnHPODa4pfXx8Ih3MPPWzJ979y7tbN25WNaY14KT7C5ldCRgGzkzgyBiXjp0dKyS6Mo1zyoZfPc2jHmAobIHFSLjI6c74oCleiIHGNVAIRKrgkFTIEIQqb/FNjCeyI44SAqQCAmQIipit0SlM7M6NbZroPTRSNq+mfcuGpdMuvuH260dGR5Ukv98XDod0Xa+sqPLopq3sL379jll1bQdO7o/U1wzvSU605zP7HBY3mKYDA1AuCEfYruuK2LHRymofaCBd4aQLdJYdK1B07iGeEo0iR9QRGWMaI6lIEXAobfZmBhwpFEhCQaAUCYkAoHM0NMYNpnn0rL/ySPX+hzvnX7Zg/c/f13RNSEEAhmHoug4AebtgePU//uuflt66tOu3XSUpH6LJdZ1pHEghEiipLFdZkmtckDvSHTcrNDBROEJJhYiMMwAAVIj0aV4IAQCkkASAAIwzAiBbAJIRwtSYgwx1v0GKpCAQElChAEIOBaUs1NPeMm9ZeaBsfPNEiqWQIwBIKTVNCwR0UIAaMM5T76cYsarGiN8fJN1DzAJXFQ0DpGIMuc6VUqQgPZJnHoAgg5RiCMzgDEA4kgFOhtOfMCEEAAnKVcpVxIFpTPdqmsFBAWmqkLOIyFtmBiv9vhKTawwlgeWiK1AAZMhvez1CKysvJ/w4VGQghdQ0nTEmHJebvEiDFKiG+c3xzoKBfhKEpgYAqBQjMny6J+I1y72gMyfnuOAwHVGRYWiMM1Ifiz2ZezrfhAhQEQgiSUqR5teMqAkKhCu4F4lkdijnWiJY4w/WBIJVISNocB05B0DRUF2fSsajdaXc4Kp4TjgIV6bT6UIhD0oqpuy8TURmVA9EjJyb9Hl10IgzZXpZoDYQmRktu6AMDHSStsg7iisbbMgTB6aFTaYhTdqIoqkcbIobRWCIiAqkJa0J26zzYES3x91AOQNgICk9kM0OZ3W/4asM8pAHdSAACIpZFfU73l2fyycjM8JjhyfQi4zxsB6qqK7w+QP5dD5uJFVOFgp2zexw5/a9TRdfUNVW+cHxATPk94R1SonMSGb8iCVtyTWGiIEKL9hEgvRyjxTkZNxJGRWQ+DQARRAuOAQEjCEjaYv86Rzz8/RAoWxmgCHTvKj7UAopbJnonkCdcb8mvRSd1QDZfHdXt8iK0kUhAAhU+IFQy+v5QiFfsELeULQ6kk2mC+O2nRNDx/NY2rWkrYb7eKE3mz8lZMFFQiOgGX5dukplpK9Gy8QLYIFwXSdhI0dkAFDMztE5ez7VjQIjVMA46l6NmRoBqKwY6yx4Krg3xAMBPRjWQ2HTE9SDVT4zaKBOWI6f/czqD99ttwuOFCp5MAMI0Yqok3Yq6yprq2vDJSXTZ9Snh9OhSAkAjBxLA+DI8ETXtsOL5s4SwbwZ0H2V3kCd31/u9UfMYLmHI/e3GbHOCUorN+sgZ5rBNUMDACQC/j+TekUIEkkR11gwbATCJjNY7pTrOm6olTtZxXT0hwxfSNdMxvwgIvILf//5zvUdp7d3c+IAICwFBJG5AfTiyaOnXOkS0Z4d+8wS019rAoCyFQBBEo/uPslzcv6d8/NmzgwYRkg3vBoocvMCNTJmGrGOFDJkGgtEzUDI4w/qiKAUwuQhwE8AIFDFM44Mi0lR5gkaRkDHLPTuykWv0jMpJz1iJ+I2Kcrkc74Zns/9w/Vdm4/sfn83Ry5dBR8HuSIhg40+15E7tu/8qPMjUqBKnOxEojgBAVReqSTseaOjtqR05fcvzkby6bEsCMY4y43Z4UX+XMHNHrCMoO4LmF6PjowcWxKRAFD06RcZAgAqQE6ggRJgZQTXmCdgGEFj6C2btzIjwJSk9EQunssvWTv/utuW7f3j/u1/2l103pMxFgEgHHu7KwAeEbB1j2HoxmhmpDBuDeyMA4BSRIAkFEhFNm78wTYjye746tqGlTXD42PZuIWSVVwX7H19nBXQDBqcM+UqX4C5jgIAQiwG7WfOwJRwWgEpRcDJiKLOmZV1XKFIyfxBlT6pwtdoIy/nG5fXLb994fCp0T9+Z72TElxjSqgpaUsCq2APHBsBga7luABMZ/kTUolJhFgMaSQBU2IUNn5/R8OculWfu2jGrIbNv9ypytxCUCTey6KOKi81Q7NAug4a5czJo1BSnRV+CgACAldJJUnkZF5zfeU6q9fEuKIEElPdTyaqr42uuG+Wt8LT/sLuoR0jjHOu8zPSc84nrzAEIKioDg6fSJ1ZXC/VnQmXc15kPEQkhEAFnHPmsJ5dAwPHhi+6ecH1D1x6urt/3y+PUlLpIYOi6I0aatTKT9iyoM7WPT4NAAACx8m6iZMSTkpyg6GPCcvVyrX5V7U2tdZ3bjl+4omeYjSrpAQJiIiIjKGU8lxljvbFI9NDI8fSDJleymVBkiKhzvpwxphSSojJJyIltj/bEZoWXH7Los9+4/Kt7R+Nbh1XE3Jk0FGWIqJiKkUB0pT3nAWAwAgQJw8DQ8ZROhKEnH5NTfOamsE9Iy8/sL441e/3hcIl0Wj0+LHjruMiopTqppvWzpkzV9d1j8cTCPjb29s/2POeGTJEQTLF7azb3Nz0wAMP5nI5x3VOnjjx9NPPlJeXrbr00pGRkfHx8Xh8IpVOp/sy7/ziQ5wGbZ9vbF5Yv+/5w3bcYTpDNRlAK5JFI/rkQI5QBo0PlZu1OnzsTCJtocsfXvCZB2ZDCILe0E9/8tPX33ht564dPT098URcKdm+qT0ajXo8nv989lmaOvr7e5ZdstRTzTWfphs6ADzwwPfOnTB79qxwaTifzxORkCIej5/uPr1r165XX33l5489fvvttzddWXfrb66ZdUvjpMY4AkDDnRXhG/3A4Zzc3BkAlVD1zbBexRGAG3zxV5qvfGxe3cXlAHDZistOd3ed+3rLsmzbIqJp06ZdccVqInIcZ9eunQ8+9OB9/3jfs889S0R79uyeu3A2MuSMA0B7e7vrurlcLpfLSSn/8Ic/AMBrr79WKBSSyQSdNxrrmvwR71X/tGzl9xf7yrxMQwCo/1JFaG0A+PllAVYEUKpXaQBQsyR8zeOzdcMDwKJl0YmJMSLq6+3+h3vvuXbNtVddfWVR+iNHDgHAD37wAyEEEd1zzzeKq33xi3cU6fyDDz5QfFJTU5NIJIho//7927ZtU0rl8/mm5uaFCxfOu2BebW3tQw89pJSybXvPnj2PP/7zrVu3PPXvTwKgF/zL71s4/86W4jr1XyovuTEA2lkAU7yQyCtQBADeOj50OEkOAqprrr4mEikjonVvvvnkE08VZ1934/V9vX3JRBIRFy5cyDkHgKFYTNM0AGhqai66miKbAYCVK1eGw2EA2Llzx4YNG1955RWv13v/d7/7jW9MYn7u988+8MADwWDQ6/V++9vfAYCFCxeaHsOy86P7Er4lZnGaFLJYqTjjhz6+yIoxvIZFLuKpgHzCkeACwS233EyklBTtmzbpuj5v3tzLLrvMo5s33rC2saGRiGbPnqmUsGyru7tHCCGEiEYjAICIhUKhuPzVV19V/HLo0OFXX321v78fAG6//fbGxkbOuWHoQ4Ox7Tu2A8CcOXPWrl3LGNu/f79t2USQGc8z/1R5z7mLp/ABYlAMu3kUszGXQNRPq1+xYrkQTl9/36b2TatXr+7sPLhhw/o333zrsZ/+1O/3VVZW1tTUOI47PjY+MDCAiIyxaDRadNm27QBAMBhcvny56zpSyuHh4WAw+MILLxBROBz++tfvllIyxgFg3bo3AYCIbrvtNqWUruuAAECFCQc8yLwMisVWNYXQTLkHCIEUAYIR0u1xCwCuW7OmNByWUu7cuTOVSq9atXJwcIBz5vV60+n0tm3bL7/8cp/PZ9t2b2/vxPh4UYJAIOi6LufcsiwAuPDCCxsaGnO5LCL79a9/XSgUhBDpdNIwPF/84pcef/wXo6OjAPDBB5sSiQmPx7tq1ary8rKxsXHGmALlZlwNuBkxCoMW43hOGHG+BgCIgPs413hu3AaAG264IZ/Pu6775ttvM8YeeeTR+/7xvmAwyBg7efKUbdtz5861bUdKFRuOhUKh6urq5ubmmpqabDYrhCjebpdfcQUiOo5LBCUloenT6ltbW70eXyaTqaysvOuuu4hI07STJ092dHRI4ZaVRa+66moA4JwBgmsJmROeMgMAHEnSVcWC/xQARIAEwlLSUkaIJyzbSbotLTPmtM3OZrNdp0+/8fobSql0On3pylWWZUkp9+zZAwAXLr7QsuyRkdGFCxZu2bJl84ebP/jgg+rqatd1het2dXUBwMoVKxLJhGmab6x7fdmyZTd8du2111378I8fZozFhof/9gtfCIfDUkrhio0bNylFmXRqzZprAUApBQASZDqR56UcAIQjz9Li800IHAAXWAidGALB5auv0HU9m81Ylv3ggw9Oq6+vqamur5+WSqVN01j//vuI+Ma61z+z9DOlpWHGWFVVpVTKdRwllWVbX/3uNzdv3jx//vzmGY35XC5Q4d+0qf3Agc4DnZ1A8N6776298aYZzc3h6dPv/trdP/npTwBg0wftf//VO4UQc+e01dfX9/f3M40pJfPjDosyAFCS4FPTKlhUioZApJdq+RGHAbtuzZpkMmlZdjhc8o2770ZEIYTripGx0e898L0PNn2gadqLL/6xp6fnM8uWDg4OpRLJdDaby+ccckZGR+ODYwDQG+tdumolKfD5vd1HT3/sQ5Bx/OHD/3z99WtKS0sXX7Q4HA4nk8mDnQdPneqaObPVMDxXXHHFc889V8xlOCOuMcsAAPo4bD+jg3NIPQE3GCAwP7eHBQBs/vDD1pYWZPbY2NihI4f7hwb6hvqHYrFde3Z1H+wCACEEY2z79h27juzyVXi9Ad0f9PjqPMGIv8JbFy5p2/pC50R/ouWy2khtIJvMlV4wQ+TIzthj3amRrvG317319rq3AICbOgNgGgqS//4fv119xRV1NdOWXbLsxRdfdF0XAO0Rx7PYLHoIkAgA9DGCKXyAiABRL2XOCVeBevxnjx/Y/1Eqk+rp6RsfHT/38DPQfAFToihk7JmXNH5tw1XKcP3cNED3gukDLwPoTk+899TOzz+++vpvLRbgGKBZ4DjgJCGTi4t37zm496WjXGPB8kAhYRUKNgAByHWvrFv3yjoEVlNfPSkSoEwqpn3sb2hSh8Vk4zkFDgDigCbTq7j8SBYr8u3tm4q/+6o9oWZ/6exg6ZxA2axAVXNpeU3k+ZUb+/eOBGeZY95hVzpDGzOxzjhpzMkJkZWx7Sk7bUcv9faonsyQ/ODJQxBWms1abq2IzvYufqK2882TdsG5+LGWps9Vj55MT/Sk40fTqUP57OFCpjs32D94hl64WaEYMoMpUsDoY5d5rgYQQAGYyIPMP12LxRUQcp1FF5RoyxifDryCecpNn6nJhBs7MXH6vcFslz18Mg4A2CJ6aZgz/pfvnxjcMY4BjesMAdyEA4B9E4MuBgoS9vzypLIlEIyPpGpuDJOjzBLdzjvbvn/40J9Omw2G0WhAFbLp4FthGHGmMqQ6Mb0pa6eEk3eBC62UIwdEBHneRYaAZJNyOTF0epym+wMjL1rpg87YniTvQ+LElQYAHJge1vSIVtoY9Jo+kRtFQNZKI5iUGdX6m8pF+nTNp5sRHPxDatu9R0nBiBy3ME0eHogYuWGbefD487HjT8XO2m0WInOiyYFs6kjaHnKdpEuKpKXIJEqRsinY5IvcGOAmFxkZDGkyOYXRnHMGbBA5YBVa95OJyApv89cDdlJ1P50t9LgI6G3SvGt030W6WWV6I2ak3pd9x6KXQTdYocTOxjKswIwyZnFNZhGH1YkX4wDIOc/mLJl3VJY5jpRKyQKYAb3imrCdcAv9bmYoB14I3anrEEgNscKg7cR0d7PMfVBwUkLzaXV3RX1zPGMbkxPvpADBjGiZj/JnbB7OagIRgMyrQhjSrZcnij/X3Owvu9LMnVSDr+StXgcB0USuM9QQbSZsIZX0Vhq1LwScUsEO8eEHs9JPChRIoD5QQgGA73vgvVEr8fkLj4JzXEoLfM1a2e+8Dkn7v6nn/nFCMpgBOoEBIiuJgEihzqrXRkou9Sf354ZfmCCLEAGjrPbO8oHnR2GUSH1CA0TAQJzIe26qRm8cbACAoVdzsXfy078QmPXDYHqf6P2vjEwqf7kZviFQ/eXS/h/GY++OG9Xcclx7xKVjmjXkAgMEZIhKqtnzZs9rm5cfyR38t87+2f1V3wn5TA0lulk51BEnRsyvc50JVzY+WkENmHg6O7YhCUCVN4Urrgpneu2ux4acXhcQmIZKUKDFdNIuTRQT4OelVRBRDgqZcvgCv9ieRY5MA3Ko5z8y+mus4cvBWY9F4lud2J/SmX8vxD/MiLgEAKOBC1tCHsSQAoaIhIBSqhltMza9v6mysiI+lrRShVvvvXXf0K6SJT6lSTBJOcBRt18GKRUyGHhuvDDsqLgqvTRYcWNQFajrieH8EQsMYAaSW/Sl4L3Amz6Yg6nJ3SkDOfAZuufeGvABckQERChyOQDw1GnND5Uuebau9rYw6MW6JvhnGoGbDM8Fmt6gMQMZQ2TY2ta6e88uIuro6CivLL/uxus2rH9fA66Vadp0TW/TjAWa2aoDYJHpAkDpxYGFv26c+fO6wGJv8QkzEBkgTlIUfZYRvicCXkDtk3TyXAAICPrlIfOGCACgVsSAiHgGRqDFnPP9yiXP1lbfXgLRqRUqBowjcHj8Nz8bHBgoFPKvvPJyKBRasWL5yEjswosXAwCbrEV/fAARIsuCbT+vn/fEtOiq4ORjvSg6TL5dA/Sj/+4S3qYVn/+1gRqCDp6bosYKf1GmYqrlE9oIzfbMe7h8ybPVFTf70YdF7aEGAGBE9WvuuLq6uvp3z/ymUMjt3btn+/at7RvXL1+7FBC4xs7semixb8Evp1342xnRKydFZ2dFR0TAYuecAd6/DeirTOCA/DyBz4eAHIiTZ4UfSFnbLbCKzcXFpmFEJOCTjWvBOcb0G4P+Bm/P5uTYpoIal0Cg+Xn0M9GRDaN/9/m//cpdX8oXCls+3L63f8/J0Km+Z/qRAAz0XGQ0XB0pqfT1rY8PvZYABUxDICj2nE6W3YmIgEWZZ7VXxISz08bzqhufCgAAARmQAmOBqTVozjFHdguy6BP/QURFBACBJqNibVCr1xMdhfjGrByVvll+LcJn6jOn19QP9Azt3LFTa9M14tZRy7PAiKwp9ZVoifdTE5uzIIt2BDSFZgEAYAh5k6bP0t1jrjjiIgG453dd/rXOXSAFLMK0Nh19QDmSYwryRPJMdnaSXEtLQQ48rXroMj+fb6b+krPeKRghnVfrZoXhTDjOkA1jAJXkvSXgbfTkN2QzG7KUJyxBZiBRsbYCyIAIUQMsYSwMLMLVhHKPupQkRPhERvF/BwDn9FtjAHkFx1JEHwIHIgIBUKDJ5jsJZINKKUqTVqOZl3hYA9pbbHVYsTAwzokhn8f0Oaa9x7a3FcgmXsHQROAAXgQdkCNogAyLbJ0KpCaUGlGULZrsp/S7/p8AnKuK/30aIjAgSQDAyph+iY51jE4QZwxnozyirK0W5AkZAMNiC/iZ0uJkSy2cZ0x4nmGdN/4/IRQQgEyF6jUAAAAASUVORK5CYII=';
document.head.appendChild(favLink);
document.title = 'GOAT FC';
// Favicon dynamique
(function(){
  var link = document.querySelector("link[rel*='icon']") || document.createElement('link');
  link.type = 'image/png';
  link.rel = 'shortcut icon';
  link.href = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAl9ElEQVR4nIWbebyeVXXvv3vvZ3iHMw8ZSQhJGBMSJCSAClgQp1pxuLWKXktRqxWnOlWt108dWmqvrRX12ivOaC3eqogDVgQDVgIEMiEhDAkZyEnOfM47PtPe+/6xnnOA295738/nfM55h/O8z95rrd9a67d+WwGeZz4UKAXeydOBlYqR0w39K+W5jj1KQZZ58q6if1Cx5VKDiaHTdNR7DFp5alVNmpUX956k49n1m4IkgSAG5zx4hbfg8TirQHmGlxg2bTHkhccEoLRH+YDMWlzu8YAOPHlHsfc+iwWas54gUOSZR3uFspDMKuaPOWaekoUoDd7/h9USPGvtSj7kPSw7R7HyYk3fck3a8ijnaU1B0fSocqds7vEO0o7HdSAONXnXk2WOPPHYAoJQkyQOm3mMASykLQ8K0PL/NoWwIq+5whMEkKXgNbQaHq1yokgRGGi1nSzGKmwO1nmqPXI5pUGHnnqfoljpOWWrZu64ZnyfY+Jx96w1/ocNWHgjrinOe61h6XkwfdLTnXfYFLKWR6MINRQZhBXZTeUgT8Arz0Cvpt3yGBRJW64ZRwqs/L2w+8ornPU4D0EAhS89zoK3nm7H473HZqCsIs0dWkPe1mitiEJotBxJxxNUQFnIU4+1Cg00Jzz1QUVz1hENKS59p+HknoCd/1KQdt2zNkE/c/G1fsVl7wk556WaaqigpbAd8KlHOeg0PWkChYUi9cQVuUp/v6Fa1eQpoDxGa7xTpInDFg6tFM6KNZ315AnYArSCwMhvm4P3ClDkiWPqpCVJIIoU9bpGoTFGPlPkkKal1Z1aDFnvPGlL1uOcxyhFpKEnhue8XPHiDxkqfQrvS4MAuvRnTAjPfWvEmvM1w/2KSsWTtDwuhay0pjHyRVpJCLhcobSi23HkiSLJHLZQNGfBew9otJYby1PozEORymY7JwvIU3CFLMIWnizx5LknjBRBKL9VoEgSj1cebz2uAG/FE731pB3ZFDwoI9iRNCBte5ozHlUoklnHwKlwydsDdPg03ukF62/5LyFnXgL9dY9RHqMg0HLDeQp5VxFFpcvmAkRFDkXu0VpcutNy5CkUhcM7TxhBY1ZA02hFEEKRq8XNTDuKPNV4L16BFU9whUIZifNO1zIzbQGwubhvnojnhKGiKKDb8tj86RDLU+i2ZYPjUOFzSFoQ5J4ztsLmV5tFL9DewejpmnNfrqmGniL3pA2IvKbIZIHeyY3ZQoAmCMHlcoNFCp2mxXuPt4o8t0QVT9KFpO2x1pPlnjT1WCuojve4VJOllmajQDm5maTjSdtQFIpAKTotT6cJPlMo78GJ12WpbD4KrAVXgA5k/a6AblOwCS+fzVIPDnzhyZue816iWXKGLr1ZwfmvCunrB5UrQqUJlEYDeeLxHoxROGQBvnQ/Z8FaSUsohXMerVmM9yiWz6RdT54obAGVaul33jA2VhAVo6wePp2jTzlc6sBpwgjCyKO9IYoUSddRqUIl1qAkFBSQdBXdjsdZqNTEEN6C1hBXIKoo8lwyURRLKraFIggV2nvO+D3xRD16qubsCxVBCS4+B5t6ul1ZfJ6KFwRGYYzCBAo85Lm8pzVkmaPbhkArlJP3kxYkrRKwEnk/6xjSxPLk4zkXnHkx2//5en79kTN443M3cnK6xtysLUNO0elYuh1PJTJ4r0gSyDqQFx7rFPVesBngJP8bLe5vLaTJ02Hhy+dxRaOcYn7a023AyrOlxtFrtwb0DWps6mnNetrzggnaA05izQQCfN2WJ+l68GA0RBVI2pB2wRh5XSnJ4d2OxytLEBhsGtBt55wYywmzZdzw8b/ml9+7nrvveoC//uK9fOk1lu/96WbWLDmNYydh7KmMbtstFkczE5Z2w5F0JUSzVO7TGAgisbi1YhBbCOgGASgv910Unm5bwrBIxUt7BzWrztUEp24KyDNPoBV9PRpXIrErFHmmCCNBliwV9HUZhHGZOq3k/zCQFNVNHN5KClRekSc5MzMp7XlY0r+Cj7/zLVz3prfSmD3I6/7LR7n5B/cCmp/+NuEzbx7nljeOcNtTF/DL8TmOTByhVkuohlCtGPJE4fESYl4wSRuwuaC+LTwKRRBLVVnkcp+2NKIva6/AKOJYQHdwtSKoDDhcKikjjqXa6rYV4AhCaDWe9oLAlKWTgjBWtOYgjhW20Cg83jta7QzroNMG7QY4fdlGXvXa1/DSS/+Q9nzCX/23v+HzN3yLeLSHK//w+ew9tI8HjjS54iMpL9s0x/tfPcBnn3Mq+/ML+dXxJntPjjE5M0UUZPTUwBhDpWbQBnBaAA4pq1UARSp5vcjFK4IQ8gwqNdmBSkVCVAF9yzzqXTdVvAk8LgdV5hGjFM05uOdXObaQUMhSCCP521oAR7slu7x2k7yvqDNQH+HsFady6cY1PG/TKoZWbuTgIyFf+OKP+eZ3b8FGsO3S8zHWc/9d++h2UuLTHapP03g4h3nPlRsMb/v9Gi/YMkIa97JrOuLeiYLdR8aZapzExAVZAUcehiiU1OxR4BXaKJx3AtyF9B0bL9L09ENcUYSBJs0cVnvyHIJKTeMKyF0BTiova8Vlsk5ZLxhJf84J8BSpB91Db3WA1SuHuWLTCOsHh3jOmh7WLTOgEo4fmeb733qE79z6LR783SQ9y3t5/iufS2hCHrnvUR59+HE+/bE3cEb/Y7z2gzsJBwyjG6qkFNz+RM7tf9dk7WiTV15keN3lVT59xTpY8wqOJ6fxyNEOTxx7hF+GRzh0fJqZVpMsnSLQFhN4sIqwBoUWg2klIdmYs9RqYsgskcyl3n1T1Tvn8eWPMZpKrJiftuy43ZJ0QBtPkUljMz9jOWftWXzpQ6/jtCVt4h4Ls8c58eRR7t83zS93zLD9/ib7n8qgN+aszaeyfsMK8sQy/XCTw48dZXZunj/6oyu46cYr0Pu/wQc/N8Hn/mUW5y3RaECwXBPXA+bHLXbMQeI4ZdhwyfNW8YIXXsBFF53L6aekVIuDuBMneexYxOd/Nc/N9+ygr89QFJ5qXeGVePTGrZqBIc38vKVvUIuRnSfLIdDlLhVW8rwtHBSavFBo4xe7Q8rfaeoZrA5y1pkzfOav7+T2u09y4NEmx6cScZfhGr2rY7ZsW0uhCqqzNR791VG68ylpnlC4nGq1wgfevh6tTtCa7fKOV/bxnTsyxqcaZJOWdLKgrTMYBnW6oqcvYnZe871fHuR7tx4EbqYnDDl9Tci56yM+e3XIatNLY0bRG0uDlCUS6NpAp+UJAke9pqnEkBaubL40QZ55vHUYrXFWUpktJA06p9C6LGVDKUHTNphC47oFn7vxScanWiy/ZIiLV6xHVw2knmTaMrevy4WbNjNRzNGOMtqmTZ4WeO/odJp85vP3873vXEI1tPzNt+c5OdEgChW5B2M0o0NDrBjp59TRKrftfJxw1DG0sU7Qp0m7OdZ4dj/YYffjdT72pnXU40lcYfDe4XIEC6zcu9aaPPdUavK6TxRp6slSh8Z5igKUUsSRoVIJJK04KWNNIHW8s5L7nYXeWoTOE7CWVZcu5cz1pzK3L+fk3S0O3j7Fid2zHDs4zqpT69x+xwf51MdexdjxE2RZQrPZxHl44aVrIZmi28m4/FwHaLLco/HYwvHpd23mwe9pLjynSdLMaB1KmXmgzcSdTdp7M/S8ZvlLezA6wwSOvrqHEvmLQn60kXQdxZ5aXfiLNJGFp4nHAdp7RbWicYWjsI48d4LyHox6urhQlOVvAb31CJ97Gp2celhj9pGEmfF50ixBxx6rC+o9AV/68s8Ze3I3Z24IOffcs0m6jt6+Ef7qw1fxltcpVGOWTtdz1ZaUv79uKUtH+/FhH2vXruec4RMcf+gof/fdCcCjtCr7Xyg6js6jGb2uhnUF3lToq2t8LgCtAJv5RRDPM+kw83Idi8yQVQShUXgr1i6cFBN5Kl6Rp7JoVYJJGEo2qFUiikKYn9AEOOewWFQBRZ5TWIsxilZrjh/9YB/XfeAsdmx/Pyen66wdPYoKHyB78jizDcfhp9pUfcGbLmxx+Rk9NP0Ioz1dRoMn+P79fczMzqDL/v6ZDxUqwjAECrJwgPpgB7RHGYUJpEq1OWQJqEBJdRgqOh3ZoCAAnCcwRhGEGq015I4s8YSRJukI9RRVJP25QqxvC6hWQ7LCY70jDAM6aU5e5DgsRVHgnCv7fccddx3kunfXqPeEqIkan7r+h/zuoQmCeBle15lrbGZ6/BhFZ4LR+ARvuHycdZtC5uYVd++Xa6j/k8dCeIBAB0BONxghGvSQP4jW0uQoI0yRLj9rrXhQe86xZLmm3quYm/EESddhrSLPLNooolhIzUqscU6anTCC1EFeyEbUajGpiwCIdYVmnlKUvbK1FucsRSFe9vCBCX75g2k+8dlbOD7ZwxVXvoJzn3ca7fY84ydP8oHrrmbrtgv53e8e4daf3sbH/+W7/P2tj/G+1yxj/5EW/wmPKRsAxLoKODI1QFS3oD3OaWnh1UIPI5VhkngqVcXAsCZNFN0ONOY8Ok0hTR1Kq9L9c1ptKf+iWKyfZ6XbSYVMFNWwVAHQsaEoxPJP/8jzIAg4dHiMF199K5sufBPb7/4NF1+8mdmpY3z9q1/mm9+4kRde8Xvc/oufsmrFMO9/15u547ZbuPy1H+IdNzZ56PF5VNlq/4cN8J7YRGWMZ4RKKOg8cdiSWPVOGKIoViikrY8CRVF4ktQJ0RpFLLIjzno8GrwlSyDP5cMLAKgUoMEENXw4IpsSKQpXYJ1FWV+6v0NRghbwvX/+Lq97/dUcO3aMW350C61Wi/n5BvV6nU984hM8/5JLOXniBIcPH+GHP/whc41Z3v/+d/OVf7qR8fFxlFIlxVYaory20RpQ+O4Mzo8BWrrDqtBlUNYBbU//gCaKJITDUGFCyDqKIAhVSUgKuaEUKKelByh9TZtyA7QSZkVV8MFS+QJtKJTDOYt7xo0qpciLnK997Wu87vVXMzMzw/6H9/ORj36Uufk5/v03/87atet461vfQqfdJlq1ilNWnsIdd97Bt2/6Nnv27OXat1zLDf94A91ud9HqaoHNNOC0BwJ8c5IsHQNlULrAZtIYoYRbUF6aIhQ05qUeqPcKVaaz3D1raOCtQiuN85I6XCFI6ksS0zsoXIAyAwvmkNjzYnnvvRQeRc6rX/1qrr32WuZm59hxzw62XbiN5z3vefz+y36f66+/nuXLl9NutWi1WjSaTSYmxnnhFVdQq9U4euQoP/vlz3nxVS8Rj1pYuJIWXIUKF4pbps0Ok+MNMApfyGeKdGG444mq0krnmTRESQe6TUU38WjlodsWLj7QijACHbiy3VyINxa9Q9iglMDIm2nQxkaCeB7h84uiYGhoiGv/5FrefO2bufbNb2bJ0iUMDg7S7XZpNZtkaYpWMDY2Rr1Wp9Pp0Gw2abaarD/9dJRS7Nu5l7O2nMWSpUtkE7R+OgxiRdd0UEbjrGK+BSYwmCBAa0VYKXkLLR2jLUpQNOJFecl16m4bcuvxeNLMCSWtFRqFLjtAX7r0AhZ1Og0CNQ0KmmqeIspAg8dhjMF7z2te/Rp2PvAAX//G1/nNb+5mcnISvF+0eJokHDt2jLf+6dv4+3/4B5489CQP79/Pnj17+dAHPsgf//GbWHXKahpzDTZduqkMN4UxBhMZTF2T1hK8d8zPpTz8+Bx2psv0RE7StVICK08UittEkV7sa6p1Ke3jKgTaCAPrcVg8nQYMDAn4SYmMzPCcR2lpNFrNOWI/jo4ViU5RsYCjV0JHAWzYuIFvfPObGGOYmpripz/5Kb932QtIuwlaa2758Y/5/A038Mgjj3DXXdsZGBjgyiuv5OUvexn79u2l0+4wMNLPrTf/mNH1o4sYYAsrJe+M5fCvZujtrfGlf2vj9Vm84LJB1q1by0NPPMChqYeo9WkqNaHMdADWe3Q5YLHWgYVAG+mc4kjhnIzGOi2huaJYCiNvn8EIe2jMNzD5BNU4IAstwagmqAQoFK7rqVarNJIGj+zfj3OOKIo4fPgwf/HhDzM/N4fSmu/+83cpimLRpefm5pgYn+DRxx7jZz//OfPz84yOjrJ2xVpG6iM81vsYzWaTj/zlRzj//C0MDw4xOriEoSWDRJUavT09xJFM+s6/8DzSjqfWA6gFcteRZzKziCsKl0OaeQJvKa2r6akrum1Hjsc6GWaGkZSW7TmJGRTMzTUJmgeIXM5TB6aQEe3TObpbFGz/97tYu3YdBw48Qp7nmMBwfOw43nuWLl3KJz/5SVauXEmSJFx//fUcOXKEkxPj/Oa3v2Vqaop7772XNWvWLF5z7dq15HnO33z6b/h/Pfbt3cejBx4lHJbmxxaK2WlH/4giL8v7el3htFDqAcoRRpB0HNMTHqU8lbomSwXknBUkDSIhQU0ASZLzhS88Tq13iIuHLmZ0ZISRC0dZtmQpy5Yto16v881vfJO5uVnCMORv//Zvectb3kJfX99/etNxHHPNNdcwPzfHoUOHeO973sOaNWtIkgRjjJTpwPLly9mzZw9jY2Nopbn8issJgoADBw7w3ve+l/n5OSbGp1CBw4QSks5KWs8SMWjcKzS6d4qoogi08VLCKhllRRUZYngFReYXK0GlFK7wDA4att+9n+Lil3LfzhtYuWL5f7qoyy+/nIGBAV7/+qt53/veh3OOLMuYnp5mZmaG3t5eRkdHCcOQVqsl4NrtEAYB73rXuxZDxzkB1uHhYXbt2sW2bdvI85xX/MEreMlLXwLA9u3buf322+WLNfQsMWX/IE2UNsICh6HCLQxFjcwSdNbRzM/IqDqqQKvpCUIwCPqbQBHEUo5a58lTj8sN3/ja/2DliuWkWcrY2Bi/+93v2LVrF51OB2st8/NSxr7qVa/EOfGma665hg0bNrB582Z+9rOfUa1WCYKAe+65BxBseeMb3siqVatIkoRHDzy6aP1arYZzDq2lcbvyRS9a3OxdD+7CGENtoEJlQKNj8YAgKkd5gXCdcVUaozBSNJvQaoIuCk9uPVnuyk5PoZQnqohUJO16cinEiGLD3JRjy/lbGBkdxTnHnXfcycaNG9myZQsf/chHqdVqGGO455578N6zefNmtNbMz89z2223MTs7i7WWCy64AICiKHjooYfk+lHEu94t1t+3dy8/uuVHz9oAYLHU3rx50+L/79r1INZafFAQ1DxhTYkFF5QuRjjANPGYQNFpy7jNFqVAot4r46PUesIQ2m3QTqGVNBAKCQOPwrXhvM3nL1Z8d999N7OzswDsuHcHmzdvZnJykmazyWmnncbq1asBePyxx2k0GiilWLZsGWeecSYATz31FIcOHQLgqquuYuPGjQB87etfp16rL1p5YQPyPGdgYIDT1qzBOcfhw4c59MTj1KoKHziimiKMIawuaACUjPZiqeukIpTOsFJVaCl/PVGoqNWFMa3XNLaQf3RO6LGiKOnwBLZt3bpYmt5///309vbykhe/hBe96EVccMEF/Nmf/Rn1ep1zzjmHSqUCwN69exZL5Q0bNtDXL4C4b98+2u02Wmveed11AExPTXPTTTcRV2KxunWL1wE444wz6entJel22bvvIVqtNr29Mdp4whh0SDm6F4o/imRmkHZlfiF8IYQBBGFcxrrW5JlggVJ+0X1s4RfjKO8UhJWAczedC0Cr1WLHjh1cffXVfPWrX30WCH72s59l69ati8/vve++xb+3nL9FcMF7du7ciVKKyy+/nK1bt5JnGd/57ndQSjE0OEi3I/H3zA3YvGkTtihoZxk7dz5ApMCEGrSMwlQp4jCBpPikI7ohVRFxl1KiVVBAYAtAaZx1MvlF0W0qOm0r4zAru2kCTbNRsHrlalasWIZzjv0PP0y32+Wyyy4jS1NmZ2cZGBhk5wM7aTQasqA0o9PtsHv37kWvOe+8zbSbTYrCcv999+G9521/+jbyLGdifJwLt13IXb/eztDQECdPnGBoaIg4ihY34Kyzz2JyYhLnHLt3PchgHfKFbg2hwlQgUhhtSk5TyRyxr0/T7Yh+oVJFQqDIHVmyQHl5rHOEUakFM4DyZF3ozMA5Z28kjmK6nc6i9a6//nre8Y53EJiAIsu4d8cOtNasXXMazUaDJw89yWOPPbaIG+vWracx3+DEiRPcd//9nH32OTz34ucydmKMIAg5fd061qw5FYD5+XmazSZBKLqWMAxZfcoqZmamGZ+Y4PChxxkZhm7hRLrjhcFSxlNkMiJXGrKu9BI6gKL07E7DE2AgUBoTeRoNR6WiiMvBQpaI9RWKIFD4BDadu4l2u421Bffddz/eex555BFecNkLsNbSbLX47T33cOrqU+mp12m1Whw8eBBrLUNDQ2zbdiGDAwM0Wy0OHjrE/Pw8n/rkp0iSLlmWc+NXb+SJJ55gZnaWSy+5lBdfeSUzM9NEoXjAypUrGR4ZJs9zTk5M0Z4dY2RpRNa21AMhOoJQYUIRZjjLorgjL2B62jG6XFEb1CKbSTqi4iqsp6dXYwJwVmFCaYlVIUqRIJC28IwzzmBubhZbOI4eO8rg4CBDQ0O84LLLmJmZQSnFrl272bZ1K3lRMDkxwSmnnMJPbv0J1WqFnnoPU1NTLF++nF/dcTsrVqzgyhe+kG7S4YlDT/CJT35y0dXXrFlDX38/aZLQ398PwPr163HWMTM3ywMP7iIkIfU1CpujA4XSQoOjFEE52tdo0SB6qPcJz9mYLYVYGpmSCNiJB1grIKKlFJBR+IxlsL+PFcuXMzMzQ2Etf/nRv8QYTa1aQylFt9NhemaGY8eOcfFFFxEGISYIiOOYwcEBvPKkaUKlHvPrf/81X7nxRv78PX/O+OQ4M9OzfOXLC0Aqisr7dtzPXzU/wcT4BE8ePryYda5+wxtod1q0212ed1bI0aYMRbVRQo2X2qG0C9UeJRS4gnoPBJGi04Sk6wlCT4B31OpCjXc7nixDsqUvlZdlm2sCUWQ5b4miCJ9ljAwPi2orz3HO0ey0+Mcvfh7vHbf+5FZGRkc4+6yzmZqaYmpqkhNPTtFqtplvznHvnh2A56bv3sTnPvePhBVD/ykxZz5/BfXRkKjXsPOHD7Jrz4NPpxYFjUaDBg0Jh2HDkqGInScT4l6FdWBKvlAvUPre02hA/5C8nieyEVEojFCgI41WovVTSoofpR1JIaIkpUWxabRmttvgLz78EV7z6leRpAnjExM0Gk0a83O0222eOHSQE2MnxBu6Xb70pS89KzVe/M5V9K6OWL4s5C2rt7Lk1B7+9S920/PbiLdt38bgeo1G0yEhxtB3vuGO9x0SXaGIigFRg5oo4pXP7eOhYxmZc1S1zA6MXhBUSvpWTrKBzRcEoV6kekZEXoFWAngeRaUmZaI2wgblz0BRh6M6pNmzdzd79u7m//ZQPJvBBYXWinXPXcZVXziLFh0aSUZrosPRmSbje1tc+r7Tqazv8IuvjXHotlm2XHsKm142wOTRJhhP//oKRe5w1qEstCczLtm4kg2rE/55R4dK1WNi6VmULueauSeIRWyptUg/vJfCrtMS4UQUKoKiYEFbKqRhrMFI07NAISkNUVWJdndFgC1FjVkXTl9eZXlPxt0HClAeFSiCmibsMfQsqZB3LFP7mwxuijhRTHLXZ46z52OTz9geQ99lmsN+hns/c5zW4xmqCHj0zgkevWma4fN62Pz2ZYw/Ns/8kZT2UynODfP2F/fwi51zzLZShlZpVCD36L1HGXCpsN1xRTEyoul0Hd4rwqAUeXvQgSJIE4gjaYVdSWyKJMZTjgQXZwJBBZRx5EE5LDWOp2YL/vzlfaxdMs/XdntWnFclGg2Jl2pGV/UyuavN1P4mvRcbxswMKlKcdc0o9VUxD91wkkoQkZ7T4fiJJslxmV4e/PHU4gZNzDa4/U8bQrqUavP3vv5cRuvH+eHOgqheoEyZvbxoFfFi4SCANPEkmUyH81JhZkKR/KXpwnhNe0BJsRCWqi+t0YHFlNmgyMFElG2mzN5NoJk90eX7u3q58b/2sH+syY7tDaHZHTyKWDo0Adm5bU6oLiMfrBKi6cwV5H9bMHxRldnqHCd+2aXoOOK+kCXbaiSdgqn7O7LoGKKNIen9GRc8ZwPveck87/xKyly7xeAKjdIQVkTQYQsxWFi2wnh57lWpdwi8CCcRyZ+u1bQUOaXyM89LCZUSXiCIWMQEraW0DCIv3VYIwys1dzwyxd//m+Grb4/ZuCbGO6isCzE9osXuPTXGnpYxuTfjvitm2b55gns2TOJzqG7RzNJl7k5LgGH1G/tZc7uhepXHFx4/7IkvD0nHMpYvOY2bP1Dh5rtm+NlDbfpGHToWa0NZ8i7omazEvAkkHWa5J4wlVXY7Qu/VegxBlnkRKRdiXW0URS4qq6LU4SrtiaoiOlCUX6LAVYEc1qz3fOnOWZb1DXDTdZ4/+Z8Be55oE28KSB/zxOs1DZ8y84uCxp35swAz2OqZn8yoXhVw2lVV1Jo2x09aJn/oMCs1Q2+vMfkvLUZbp7L9y8s5sP9RPv6DnOElXdAas6D8xi8q2b0vFZIIKxRXIAyEFlNAtapBldLe9pwoJUwEPT0a7ZXIY+zCyRBxoyIv5fLIpoSxeERQh8GVmmWrCz5+6zzf/g18+ZqIF124jPRhh3IQXORp5jnpHlABmKpCR4LM079JSR/WpG1HczZj7teWybd60iOe+qsjJr/VYn33THb/4Azmxh/ljz6fE/c1qA8YdCT1iQx1ZfzllRC5SomizeYlp+Hl9SwXeVxUgW7LEqQdqPSKqLnb8QRGWNOk658eheXiZqasqHypxDahJ4wV1X7FyCqNUgWf+7VjbMbygd/zLK/3861fN5n6dUK8X5Pc7fCFpCkVyvxu+p8yzLcVriPDGdAEQxo/Yml80fIHL7mUf71xDXf/9Le86i9zXK3B8lMNcR3Sk4JfYaxwXRbnGN6LQRf+DqPybIEqp8alcLo15wkaM56eJfIPNgETynxAB9JbWyvZwTlB1bCUnaaJR5eHmmp1MMsV1ZpGa8vN+zIeP2m57pKQZS8NueluGGt1IYD4OSFFw2FPWqFoqmC7Hr1E07clJq8UdO4uqJ1cyme/+Ar+7O1L+e8f/ykf+sxxaiMJy9YY+kZK2axhUQ4TxXKfRe4Jq6J91KFQe3kmtF8YC4ArL01RY8YTTD/lGV6niY2nVpXOKcsVWeny+YJc3so0Vi1UXIFsRBDKplXKWeLwKk0Ye353zPKBH3uu2aL54jt6uf3JpXznjnmax2aJtmjqWyoULYcqND1rQnKTM/tQir+rhz+88mxuuH4jpqJ4+cv+Fz/7t8cYXAODKw0Dy2BwRFx9+mQJflY8MwiEvbZWCp6iW0rvAwWlxL8SQ7frCWvQnYNg9ohDB4puF0xFhqPOelwhJKLSpV7QCTeolLSWxkjXWK1Ks+Es9A2JLD2MZdZw8pjlc/fA7hMdrnluxsvfu5KbH1jL928/SmN4kiWvrDAwUufg7bPYPTUu23wmn/iHPp6/cYZ/+t5v+dgXxpjrNFm+wdCzBAaXKnr6FBjp/cO4xKay+lRAFAuRaxYOUJQD3kql7AWsRwUimZl4QgZCftsbQlac7bHlSCwMRRq/5x5HUQhgeCcjZxOWoJjJxYeWas58jqLdEI7NOk+nJRPnuXFPe8Zz4piikge8bmvEm67oZzZfwY92Btxy32HaZFx+9hr+5PI6206b5u6903zmxwkHDjboWeEYWm6o9sPgCkXvQDmjVKICPfiQI2tBEKsyHHn6dIgCVVax6zcphkcNWQZJUZBaxfRRz8O3OMG5oTWK51+rUZlMf0Ktsbln92+dnN0ROrU88lKqxpH82jekOPsCjXUiuC7yp/V5jVnoNj3tWRg/4pg5bBjuDXjpWTmv2DaE7llJSg91prl3/0l+tKvg0WM50VDC0pWa+pCiNuip92riOiQdAeIwkrz+5MNytgkEABdSonSocp9KwZoNiv5+Te48znjSHPb8q2P2qCdQCmYOe47uhnUXQWvcoyqepJSaKgVRtTw5kgno5FZek7pBpsbag1OKKJYCKs89A0OaShXC2IPWuMLSmC/4zk7DD/fOcMm6Sfp7e7jzgGNqNoO4oHcZLD3NUBuAah9Ue8uzPQb6h4XzyjJPxSjiUCa+JgCHkjxv5HxjtS6s9sLhjrRwhBWFVTC2B2aPCm8QLAgfHv65o3fEMHo62JbH6rI3KKDIBAei8gCCKfXFcUWVBylUKUUVXUGWWhloaOjp1wShQynP3KQijDVuyNOa9/zbEwZcl6Bq6V+pINDUB2HZOggrTxc5UQRB6HFOUmX/oMIVGmUK8nY54AhlsToQGU+WCBAqXZ4p8pDgmT0CB7fbhRqJoDxrQJ56HrjZse2PNXEf5E60ADgWAQbH4nkBpYVGC2PJEt6D1k6yhStB0kl6rfZoOm1HVJPUiZJiyBdyk7rMrSqQw5v1PlXWBFCpyTkhv0B0eI3yirlpS9L28t1lvWZCCVevIMso1S6QevCxZ/Kg57HbHEVKqfdZODpbqsS6Dcc9N3rWvUBTW66IBj1Fk/JIq7CpyogHeOtFll4TPZFS0ncXmeTeqFSVdtoeEwoXV+tVJB0PumxUykILVbqxhaAKtR5VhtfTJ890KEAnSjY5/RXV5GiMKb11QdFe5LJxyihM1dNJYWq/58ntjjx5ukCCZ5wdXpDK5YnnwC8svSs0fWsVUZ/o7LzzhF6QtcikO/W5kgzhnZAOXtxNKWg3RZoaVjw2V9SqwtdpIzcb1ySt2lLRDeACyduVOnSa0oilqad3cCGeRauQJo6iWDgrJJMg/NOCyjyHoAYqgs40HPiJY+bo/+fw9MImLDQAzTFHcwyqQ4raKMT9Qjg4V9YGeOKauGW9V0ZpznmKshWt1KX4iGNDqh3dTulpRhEF5SHKhZ7FS/3Q7chmtJqeuKoxWlGtKdJUPhwEnqQreFStlXlOC0DjFXkiB6Zs4UlmIZ13tMfL1apnrPEZj/8NeefcPlL5MmMAAAAASUVORK5CYII=';
  document.getElementsByTagName('head')[0].appendChild(link);
})();
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
    bg:"#1E5C2A",bgPanel:"rgba(0,0,0,.5)",bgCard:"#141414",dark:"#0a0a0a",white:"#ffffff",
    offWhite:"#F5F5F5",accent:"#00E676",gold:"#FFD600",red:"#FF3D57",
    font:"'Bebas Neue',cursive,sans-serif",heading:"'Bebas Neue',cursive,sans-serif",
  };
  const [showSplash, setShowSplash] = useState(true);
  const [screen, setScreen] = useState("home");
  const [resultImg, setResultImg] = useState(null);
  const [gameMode, setGameMode] = useState("pont");
  // ─── Home Carousel State (0=GRID, 1=MERCATO, 2=PLUG) ──
  const [homeCardIndex, setHomeCardIndex] = useState(() => {
    // Card 3 = GOAT Guess par défaut au premier lancement
    const saved = parseInt(localStorage.getItem("bb_home_card") || "3", 10);
    return isNaN(saved) || saved < 0 || saved > 3 ? 3 : saved;
  });
  const homeSwipeStartRef = useRef(null);
  const [homeRulesModal, setHomeRulesModal] = useState(null); // null | "grid" | "mercato" | "plug"
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
  const [roundAnswers, setRoundAnswers] = useState([]); // Historique questions mode Plug: [{c1, c2, validPlayers, given, status, isSkip}]
  const [showHistory, setShowHistory] = useState(false); // Modal affichage historique
  const [reportingAnswer, setReportingAnswer] = useState(null); // Pour signaler une erreur : {c1, c2, given, validPlayers}
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
  const [ggOverrideSeed, setGgOverrideSeed] = useState(0); // 0 = seed du jour, sinon seed forcé
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
  const [ggBattleCountdown, setGgBattleCountdown] = useState(0); // 5..1 avant départ, 0 = en jeu
  const [ggBattleViewGrid, setGgBattleViewGrid] = useState(null); // {player, room} pour voir la grille d'un joueur
  const [reviewRoundsModal, setReviewRoundsModal] = useState(null); // {mode:"pont"|"chaine", playerName, rounds:[...]} ou null
  const [ggModeChoice, setGgModeChoice] = useState(false); // modal de choix solo/multi pour GOAT GRID
  const [ggBattleLoading, setGgBattleLoading] = useState(false);
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
      setGgBattleError(lang==="en"?"Please log in first":"Connecte-toi d'abord");
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
      setGgBattleError((lang==="en"?"Could not create room: ":"Erreur création : ") + (lastError || "unknown"));
    } catch (e) {
      console.warn("[GOAT BATTLE] Outer error:", e);
      setGgBattleError(lang==="en"?"Error creating room":"Erreur de création");
    } finally {
      setGgBattleLoading(false);
    }
  }
  
  // Rejoindre une room avec un code
  async function ggBattleJoinRoom(rawCode) {
    if (!playerId || !playerName) {
      setGgBattleError(lang==="en"?"Please log in first":"Connecte-toi d'abord");
      return;
    }
    const code = (rawCode || "").trim().toUpperCase();
    if (code.length !== 6) {
      setGgBattleError(lang==="en"?"Code must be 6 characters":"Le code doit faire 6 caractères");
      return;
    }
    setGgBattleLoading(true);
    setGgBattleError("");
    try {
      const data = await sbFetch("bb_gg_rooms?code=eq."+code+"&limit=1");
      if (!Array.isArray(data) || data.length === 0) {
        setGgBattleError(lang==="en"?"Room not found":"Room introuvable");
        return;
      }
      const room = data[0];
      if (room.state !== "lobby") {
        setGgBattleError(lang==="en"?"Game already started":"Partie déjà en cours");
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
        setGgBattleError(lang==="en"?"Room is full (8 max)":"Room pleine (8 max)");
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
      setGgBattleError(lang==="en"?"Error joining room":"Erreur de connexion");
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
  async function ggBattleStartGame() {
    if (!ggBattleRoom || ggBattleRoom.host_id !== playerId) return;
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
      setGgBattleError(lang==="en"?"Error starting game":"Erreur au démarrage");
    } finally {
      setGgBattleLoading(false);
    }
  }
  
  // Relancer la partie (host uniquement) → reset la room avec une nouvelle grille
  async function ggBattleRestartGame() {
    if (!ggBattleRoom || ggBattleRoom.host_id !== playerId) return;
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
      setGgBattleError(lang==="en"?"Error restarting":"Erreur au relancement");
    } finally {
      setGgBattleLoading(false);
    }
  }
  
  // Synchroniser la progression du joueur dans la room (appelé après chaque case validée)
  // Permet de garder Supabase à jour même si le joueur passe en background ensuite
  async function ggBattleSyncProgress(currentScore, currentCellsFilled, currentLives) {
    if (!ggBattleRoom || !ggBattleRoom.id) return;
    if (ggBattleScreen !== "playing") return;
    
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
    
    // Reset le flag de submit au démarrage
    ggBattleStateRef.current.submitted = false;
    
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
      const remaining = Math.max(0, DURATION_SEC - elapsedSec);
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
  function ggStartGame() {
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
        alert((lang==="en"?"⚠️ You already placed ":"⚠️ Tu as déjà placé ") + player.name + (lang==="en"?" in this grid! Each player can only be used once.":" dans cette grille ! Chaque joueur ne peut être utilisé qu'une fois."));
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
  // Bot adversaire (mode EN LIGNE depuis la landing) : pseudo + flag + score généré
  const botOpponentRef = useRef(null);
  const botScoreRef = useRef(null);
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const play = params.get("play");
    const reqRoom = params.get("room");
    if (!play && !reqRoom) return;
    launchedFromLandingRef.current = true;
    // Skip le splash 2.5s : on rentre direct dans le jeu
    setShowSplash(false);
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
      showGoatGrid ||
      (ggBattleScreen && ggBattleScreen === "playing");
    if (inGame) {
      wasInGameRef.current = true;
      return;
    }
    if (wasInGameRef.current && screen === "home" && !showGoatGrid) {
      window.dispatchEvent(new CustomEvent("goatfc:back-to-landing"));
      launchedFromLandingRef.current = false;
      wasInGameRef.current = false;
    }
  }, [screen, showGoatGrid, ggBattleScreen]);

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
      if (saved === "fr" || saved === "en") return saved;
      const nav = (navigator.language || "fr").toLowerCase();
      return nav.startsWith("fr") ? "fr" : "en";
    } catch { return "fr"; }
  });
  const setLanguage = (l) => {
    setLang(l);
    try { localStorage.setItem("bb_lang", l); } catch {}
  };
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  // Friends
  const [playerId] = useState(() => getPlayerId());
  const [showFriends, setShowFriends] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null); // {id, name}
  const [viewedProfile, setViewedProfile] = useState(null); // {id, name} - profile being viewed
  const [viewedProfileData, setViewedProfileData] = useState(null); // fetched stats
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
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [viewingAvatar, setViewingAvatar] = useState(null); // URL de la photo à visualiser en plein écran
  const [cropState, setCropState] = useState(null); // {url, scale, x, y, naturalW, naturalH} — état du cropper
  const [pseudoConfirmed, setPseudoConfirmed] = useState(() => { try { const n = localStorage.getItem("bb_name"); return !!(n && n.trim().length >= 2); } catch { return false; } });
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [gameConfigModal, setGameConfigModal] = useState(null);
  const [activeCard, setActiveCard] = useState("pont");
  const [swipeDelta, setSwipeDelta] = useState(0); // "pont" | "chaine" | "room-pont" | "room-chaine"
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
        const mine = await sbFetch("bb_pseudos?player_id=eq."+playerId+"&limit=1");
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
  async function openUserProfile(id, name) {
    setViewedProfile({ id, name });
    setViewedProfileData(null);
    setScreen("userProfile");
    // Compute sync data first
    const lbData = leaderboard.find(e => e.pid === id);
    const duelsWith = duels.filter(d =>
      d.status === "complete" &&
      ((d.challenger_id === playerId && d.opponent_id === id) ||
       (d.opponent_id === playerId && d.challenger_id === id))
    );
    let myWins = 0, myLosses = 0, draws = 0;
    duelsWith.forEach(d => {
      const isChal = d.challenger_id === playerId;
      const myScore = isChal ? d.challenger_score : d.opponent_score;
      const oppScore = isChal ? d.opponent_score : d.challenger_score;
      if (myScore > oppScore) myWins++;
      else if (myScore < oppScore) myLosses++;
      else draws++;
    });
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
      duelsWith,
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
        if (!lbData) {
          setViewedProfileData(function(prev){ return prev ? {...prev, xp: userData[0].xp || 0} : prev; });
        }
      }
    } catch {}
  }

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
      if (!Array.isArray(data) || data.length === 0) { setRoomMsg(lang==="en"?"Room not found":"Salle introuvable"); return; }
      const r = data[0];
      if (r.status !== "waiting") { setRoomMsg(lang==="en"?"Game already started!":"Partie déjà lancée !"); return; }
      // Retry loop pour gérer la race condition quand plusieurs joueurs rejoignent en même temps
      let success = false;
      let attempt = 0;
      let finalRoom = null;
      while (!success && attempt < 5) {
        attempt++;
        // Re-lire à chaque tentative pour avoir la dernière version
        const fresh = attempt === 1 ? data : await sbFetch("bb_rooms?code=eq."+clean+"&limit=1");
        if (!Array.isArray(fresh) || fresh.length === 0) { setRoomMsg(lang==="en"?"Room not found":"Salle introuvable"); return; }
        const cr = fresh[0];
        if (cr.status !== "waiting") { setRoomMsg(lang==="en"?"Game already started!":"Partie déjà lancée !"); return; }
        const players = typeof cr.players === "string" ? JSON.parse(cr.players) : cr.players;
        if (players.length >= 8) { setRoomMsg(lang==="en"?"Room full (8/8)":"Salle pleine (8/8)"); return; }
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
        setRoomMsg(lang==="en"?"Could not join (try again)":"Connexion impossible (réessaie)");
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
          setAbandonNotif(names + (abandoned.length > 1 ? (lang==="en"?" have quit 🏃":" ont abandonné 🏃") : (lang==="en"?" has quit 🏃":" a abandonné 🏃")));
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
          setAbandonNotif(names + (abandoned.length > 1 ? (lang==="en"?" have quit 🏃":" ont abandonné 🏃") : (lang==="en"?" has quit 🏃":" a abandonné 🏃")));
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
    const meInRoom = players.find(function(p){return p.id===playerId;}); const myRankInRoom = sorted.findIndex(function(p){return p.id===playerId;}); const roomImgs = myRankInRoom === 0 ? WIN_IMGS : LOSE_IMGS; setResultImg(roomImgs[Math.floor(Math.random()*roomImgs.length)]); setDuelResult({isRoom:true, roomId:r.id, hostId:r.host_id, code:r.code, diff:r.diff, rounds:r.rounds, players:sorted, mode:r.mode, myAbandoned: meInRoom && meInRoom.abandoned === true});
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
    if (clean.length < 3) { setPseudoMsg(lang==="en"?"❌ Minimum 3 characters":"❌ Minimum 3 caractères"); return; }
    if (clean.length > 12) { setPseudoMsg(lang==="en"?"❌ Maximum 12 characters":"❌ Maximum 12 caractères"); return; }
    if (/\s/.test(clean)) { setPseudoMsg(lang==="en"?"❌ No spaces":"❌ Pas d'espaces"); return; }
    if (!/^[a-zA-Z0-9_\-]+$/.test(clean)) { setPseudoMsg(lang==="en"?"❌ Letters, digits, _ and - only":"❌ Lettres, chiffres, _ et - uniquement"); return; }
    if (/^[_\-]/.test(clean) || /[_\-]$/.test(clean)) { setPseudoMsg(lang==="en"?"❌ Cannot start or end with _ or -":"❌ Ne peut pas commencer ou finir par _ ou -"); return; }
    setPseudoChecking(true);
    setPseudoMsg(lang==="en"?"Checking...":"Vérification...");
    try {
      // Check if pseudo already taken (case-insensitive)
      const existing = await sbFetch("bb_pseudos?pseudo=ilike."+encodeURIComponent(clean)+"&limit=1");
      if (Array.isArray(existing) && existing.length > 0) {
        if (existing[0].player_id === playerId) {
          // It's mine - confirm it
          setPseudoConfirmed(true);
          setPseudoScreen(false);
          setPlayerName(clean);
          try { localStorage.setItem("bb_name", clean); } catch {}
          setPseudoMsg("");
        } else {
          setPseudoMsg(lang==="en"?"❌ This username is already taken!":"❌ Ce pseudo est déjà pris !");
        }
        setPseudoChecking(false);
        return;
      }
      // Check if I already have a pseudo
      const mine = await sbFetch("bb_pseudos?player_id=eq."+playerId+"&limit=1");
      const country = await detectCountry();
      let finalRecoveryCode = recoveryCode;
      if (Array.isArray(mine) && mine.length > 0) {
        // Update existing pseudo
        const payload = country ? {pseudo: clean, country} : {pseudo: clean};
        // Si pas de code existant, en générer un
        if (!mine[0].recovery_code) {
          finalRecoveryCode = generateRecoveryCode();
          payload.recovery_code = finalRecoveryCode;
        } else {
          finalRecoveryCode = mine[0].recovery_code;
        }
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
        localStorage.setItem("bb_recovery_code", finalRecoveryCode);
      } catch {}
      setRecoveryCode(finalRecoveryCode);
      setPseudoConfirmed(true);
      setPseudoScreen(false);
      setPseudoMsg(lang==="en"?"✓ Username reserved!":"✓ Pseudo réservé !");
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
    if (!code) { setRecoveryMsg(lang==="en"?"❌ Enter your code":"❌ Entre ton code"); return; }
    if (!/^GOATFC-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
      setRecoveryMsg(lang==="en"?"❌ Invalid format (GOATFC-XXXX-XXXX)":"❌ Format invalide (GOATFC-XXXX-XXXX)");
      return;
    }
    setRecoveryLoading(true);
    setRecoveryMsg(lang==="en"?"Recovering...":"Récupération...");
    try {
      const found = await sbFetch("bb_pseudos?recovery_code=eq."+encodeURIComponent(code)+"&limit=1");
      if (!Array.isArray(found) || found.length === 0) {
        setRecoveryMsg(lang==="en"?"❌ Code not found":"❌ Code introuvable");
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
      setRecoveryMsg(lang==="en"?"✓ Account recovered! Reloading...":"✓ Compte récupéré ! Rechargement...");
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
        const mine = await sbFetch("bb_pseudos?player_id=eq."+playerId+"&limit=1");
        if (Array.isArray(mine) && mine.length > 0) {
          setPlayerName(mine[0].pseudo);
          localStorage.setItem("bb_name", mine[0].pseudo);
          setPseudoConfirmed(true);
          // Restaurer le code de récupération en localStorage (migration pour les users existants)
          if (mine[0].recovery_code) {
            try { localStorage.setItem("bb_recovery_code", mine[0].recovery_code); } catch {}
            setRecoveryCode(mine[0].recovery_code);
          } else {
            // User existant sans code : lui en générer un et le sauver en DB
            const newCode = generateRecoveryCode();
            try {
              await sbFetch("bb_pseudos?player_id=eq."+playerId, {
                method: "PATCH",
                body: JSON.stringify({recovery_code: newCode}),
                headers: {"Prefer": "return=minimal"}
              });
              localStorage.setItem("bb_recovery_code", newCode);
              setRecoveryCode(newCode);
            } catch {}
          }
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
    if (clean.length < 2) { setFriendMsg(lang==="en"?"Username too short":"Pseudo trop court"); return; }
    if (clean.toLowerCase() === (playerName||"").toLowerCase()) { setFriendMsg(lang==="en"?"That's your own username!":"C'est ton propre pseudo !"); return; }
    setFriendMsg(lang==="en"?"🔍 Searching...":"🔍 Recherche...");
    try {
      // Chercher le player_id correspondant au pseudo
      const result = await sbFetch("bb_pseudos?pseudo=ilike."+encodeURIComponent(clean)+"&limit=1");
      if (!Array.isArray(result) || result.length === 0) {
        setFriendMsg(lang==="en"?"❌ Username not found. Check the spelling.":"❌ Pseudo introuvable. Vérifie l'orthographe.");
        return;
      }
      const targetId = result[0].player_id;
      const targetName = result[0].pseudo;
      if (targetId === playerId) { setFriendMsg(lang==="en"?"That's your own username!":"C'est ton propre pseudo !"); return; }
      if (friendsList.includes(targetId)) { setFriendMsg(lang==="en"?"You're already friends!":"Vous êtes déjà amis !"); return; }
      const alreadySent = sentRequests.find(function(r){return r.to_id===targetId && r.status==="pending";});
      if (alreadySent) { setFriendMsg((lang==="en"?"Request already sent to ":"Demande déjà envoyée à ")+targetName+" !"); return; }
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
        setFriendMsg(lang==="en"?"❌ Error. Try again.":"❌ Erreur. Réessaie.");
        return;
      }
      setFriendMsg((lang==="en"?"✓ Request sent to ":"✓ Demande envoyée à ")+targetName+" !");
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
    } catch(e) { setFriendMsg(lang==="en"?"❌ Network error. Try again.":"❌ Erreur réseau. Réessaie."); }
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
      if(!prev||sc>prev.score){
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
      ? eligible.filter(p => p.clubs.filter(c => FAMOUS_CLUBS.has(c)).length >= 2)
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
    
    // Sauvegarder le starter pour anti-répétition (solo uniquement)
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
    setChainCount(0); setChainScore(0); chainScoreRef.current=0;
    setChainLastClub(""); setChainLastPassed(false); setChainHistory([]); setGuess(""); setFlash(null); setFeedback(null);
    setTimeLeft(CHAIN_DURATION); setScore(0); scoreRef.current=0;
    setMyLbRank(null); setScreen("chainGame");
    setTimeout(()=>inputRef.current?.focus(),200);
  }

  function startCompetition() {
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
  // Helper : hier en timezone Europe/Paris (fix du bug UTC)
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
    const d = new Date();
    const paris = new Date(d.toLocaleString('en-US',{timeZone:'Europe/Paris'}));
    const dayShort = (lang==="en"?dayShortEn:dayShortFr)[paris.getDay()];
    // Label ligue compact
    const themeLabel = theme.id==="L1"?"L1":theme.id==="PL"?"PL":theme.id==="LIGA"?"LIGA":theme.id==="SERIEA"?"Serie A":theme.id==="BUNDESLIGA"?"Buli":theme.id==="LEGEND"?(lang==="en"?"Legend":"Légende"):"Joker";

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
    const scoreLine = lang==="en"
      ? `⚡ ${tries}/${maxTries} tries · +${earnedPoints} pts`
      : `⚡ ${tries}/${maxTries} essais · +${earnedPoints} pts`;
    const cta = lang==="en"
      ? "Can you do better? 👇"
      : "Peux-tu faire mieux ? 👇";
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
          const posMap = lang==="en" ? posMapEN : posMapFR;
          position = posMap[positionMatches[1].toLowerCase()] || positionMatches[1];
        }
        setDailyHintData({ position: position || (lang==="en"?"Information unavailable":"Information indisponible"), nationality: null, loading: false });
        setDailyHintLevel(1);
        saveDailyHintState(1, { position: position || (lang==="en"?"Information unavailable":"Information indisponible"), nationality: null }, true, dailyTries);
      } catch(e) {
        setDailyHintData({ position: (lang==="en"?"Information unavailable":"Information indisponible"), nationality: null, loading: false });
        setDailyHintLevel(1);
        saveDailyHintState(1, { position: (lang==="en"?"Information unavailable":"Information indisponible"), nationality: null }, true, dailyTries);
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
          nationality = (lang==="en"?"Information unavailable":"Information indisponible");
        }
        setDailyHintData(d => ({ ...d, nationality, loading: false }));
        setDailyHintLevel(2);
        saveDailyHintState(2, { position: dailyHintData.position, nationality: nationality }, true, dailyTries);
      } catch(e) {
        const unavailable = (lang==="en"?"Information unavailable":"Information indisponible");
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

  function handlePass() {
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
      const newUsed=new Set(chainUsedClubs); newUsed.add(matched); setChainUsedClubs(newUsed);
      setChainHistory(prev=>[...prev,{player:chainPlayer,club:matched}]);
      setChainCount(c=>c+1); handleCorrectAnswer(2,true);
      setFeedback("ok"); setFlash("ok");
      const clubPlayers=getPlayersForClub(matched).filter(p=>!chainUsedPlayers.has(p)&&getPlayerClubs(p).some(c=>!newUsed.has(c)));
      // Favoriser les joueurs de la bonne difficulté ET les joueurs actuels (80/20)
      const isInRoomCS = activeDuelRef.current && activeDuelRef.current.isRoom;
      const rawDiffCS = isInRoomCS && activeDuelRef.current.diff ? activeDuelRef.current.diff : diff;
      // CRESCENDO : en mode "expert", la diff effective dépend du nombre de liens (chainCount + 1 = on calcule pour LE PROCHAIN joueur)
      const effectiveDiffCS = rawDiffCS === "expert" ? getCrescendoTier(chainCount + 1) : rawDiffCS;
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
          ? fallbackPool.filter(p => p.clubs.filter(c => FAMOUS_CLUBS.has(c)).length >= 2)
          : fallbackPool;
        const pool = fallbackFacile.length > 0 ? fallbackFacile : (fallbackPool.length > 0 ? fallbackPool : PLAYERS_CLEAN.filter(p => p.clubs.length >= 2 && !chainUsedPlayers.has(p.name)));
        if(pool.length === 0){setTimeout(()=>{setFeedback(null);setFlash(null);endChain();},800);return;}
        const fallback = pool[Math.floor(Math.random()*pool.length)].name;
        const newUsedP=new Set(chainUsedPlayers); newUsedP.add(fallback);
        setTimeout(()=>{setChainPlayer(fallback);setChainUsedPlayers(newUsedP);setChainLastClub(matched);setChainLastPassed(false);setGuess("");setFeedback(null);setFlash(null);setTimeout(()=>inputRef.current?.focus(),100);},700);
        return;
      }
      const preferred = clubPlayers.filter(p => {
        const pd = PLAYERS_CLEAN.find(x=>x.name===p)?.diff;
        if(effectiveDiffCS==="facile") return pd==="facile";
        if(effectiveDiffCS==="moyen") return pd==="facile"||pd==="moyen";
        return true;
      });
      // En mode FACILE : si le club n'a aucun joueur "facile" dispo, fallback global vers un joueur facile
      // au lieu d'élargir au pool complet du club (sinon on tombe sur des joueurs comme Mathew Ryan)
      if (preferred.length === 0 && effectiveDiffCS === "facile") {
        const globalFallback = PLAYERS_CLEAN.filter(p =>
          p.clubs.length >= 2 && !chainUsedPlayers.has(p.name) &&
          p.diff === "facile" &&
          p.clubs.filter(c => FAMOUS_CLUBS.has(c)).length >= 2
        );
        if (globalFallback.length === 0) { setTimeout(()=>{setFeedback(null);setFlash(null);endChain();},800); return; }
        const fallback = globalFallback[Math.floor(Math.random()*globalFallback.length)].name;
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
      const submitSeed = isInRoomCS ? hashStringToSeed(String(activeDuelRef.current.id) + "_next_" + chainPlayer + "_" + matched) : null;
      const randCS = submitSeed !== null ? seededRandom(submitSeed) : Math.random;
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
      handleWrongAnswer(5,true); setFeedback("ko"); setFlash("ko");
      setTimeout(()=>{setFlash(null);setFeedback(null);setGuess("");inputRef.current?.focus();},900);
    }
  }

  function handleChainPass() {
    if(chainPassedRef.current) return; // already passed this question
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
        ? eligible.filter(p => p.clubs.filter(c => FAMOUS_CLUBS.has(c)).length >= 2)
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
    const preferred2 = clubPlayers.filter(p => {
      const pd = PLAYERS_CLEAN.find(x=>x.name===p)?.diff;
      if(effectiveDiffCP==="facile") return pd==="facile";
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
            {lang==="en" ? "🎉 LEVEL UP 🎉" : "🎉 NOUVEAU GRADE 🎉"}
          </div>
          <div style={{fontSize:14,color:"rgba(255,255,255,.75)",marginBottom:22}}>
            {lang==="en" ? "You just reached the rank" : "Tu viens d'atteindre le grade"}
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
            {lang==="en" ? "CONTINUE" : "CONTINUER"} →
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
        {fb==="ok"&&<><div style={{display:"flex",alignItems:"center",gap:8,fontSize:17,fontWeight:800,color:"#16a34a"}}>{Icon.ball(18,"#16a34a")} {feedbackPhrase || (lang==="en"?"RIGHT ANSWER !":"BONNE RÉPONSE !")}</div><div style={{fontSize:12,fontWeight:600,color:"#16a34a",opacity:.7}}>+{diff==="expert"?30:diff==="moyen"?20:10} pts</div></>}
        {fb==="ko"&&<><div style={{display:"flex",alignItems:"center",gap:8,fontSize:17,fontWeight:800,color:G.red}}>{Icon.whistle(18,G.red)} {lang==="en"?"WRONG ANSWER":"MAUVAISE RÉPONSE"}</div><div style={{fontSize:12,fontWeight:600,color:G.red,opacity:.7}}>−5 pts</div></>}
        {fb==="used"&&<div style={{display:"flex",alignItems:"center",gap:8,fontSize:15,fontWeight:800,color:"#d97706"}}>{Icon.flag(16,"#d97706")} {lang==="en"?"CLUB ALREADY USED":"CLUB DÉJÀ UTILISÉ"}</div>}
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
              <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>
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
              {isPont ? (lang==="en"?"Connect the clubs":"Relie les clubs") : (lang==="en"?"Endless chain":"Chaîne infinie")}
            </div>

            {/* Rules cards */}
            {isPont ? (
              <>
                <div style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:16,padding:"14px 16px",marginBottom:12,backdropFilter:"blur(10px)"}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                    <div style={{fontSize:22}}>🎯</div>
                    <div style={{flex:1,fontSize:14,color:"rgba(255,255,255,.9)",lineHeight:1.5}}>
                      {lang==="en"?<>Two clubs appear. Name <strong style={{color:accentColor}}>a player</strong> who played for both!</>:<>Deux clubs s'affichent. Nomme <strong style={{color:accentColor}}>un joueur</strong> qui a joué dans les deux !</>}
                    </div>
                  </div>
                </div>

                {/* Points card */}
                <div style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:16,padding:"14px 16px",marginBottom:12,backdropFilter:"blur(10px)"}}>
                  <div style={{fontSize:10,fontWeight:800,letterSpacing:2,color:"rgba(255,255,255,.4)",textTransform:"uppercase",marginBottom:10,textAlign:"center"}}>{lang==="en"?"POINTS":"POINTS"}</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                    <div style={{textAlign:"center",padding:"8px 6px",background:"rgba(0,230,118,.1)",borderRadius:10,border:"1px solid rgba(0,230,118,.25)"}}>
                      <div style={{fontSize:20,marginBottom:2}}>✓</div>
                      <div style={{fontSize:13,fontWeight:800,color:"#00E676"}}>+10/20/30</div>
                      <div style={{fontSize:9,color:"rgba(255,255,255,.5)",marginTop:2}}>{lang==="en"?"correct":"bonne"}</div>
                    </div>
                    <div style={{textAlign:"center",padding:"8px 6px",background:"rgba(255,61,87,.1)",borderRadius:10,border:"1px solid rgba(255,61,87,.25)"}}>
                      <div style={{fontSize:20,marginBottom:2}}>✗</div>
                      <div style={{fontSize:13,fontWeight:800,color:"#FF3D57"}}>−5</div>
                      <div style={{fontSize:9,color:"rgba(255,255,255,.5)",marginTop:2}}>{lang==="en"?"wrong":"mauvaise"}</div>
                    </div>
                    <div style={{textAlign:"center",padding:"8px 6px",background:"rgba(251,226,22,.08)",borderRadius:10,border:"1px solid rgba(251,226,22,.2)"}}>
                      <div style={{fontSize:20,marginBottom:2}}>→</div>
                      <div style={{fontSize:13,fontWeight:800,color:"#FBE216"}}>−10</div>
                      <div style={{fontSize:9,color:"rgba(255,255,255,.5)",marginTop:2}}>{lang==="en"?"skip":"passer"}</div>
                    </div>
                  </div>
                </div>

                {/* Combo card */}
                <div style={{background:`linear-gradient(135deg, ${accentColor}14, ${accentSecondary}10)`,border:`1px solid ${accentColor}33`,borderRadius:16,padding:"12px 16px",marginBottom:20}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{fontSize:22}}>🔥</div>
                    <div style={{flex:1,fontSize:13,color:"rgba(255,255,255,.85)",lineHeight:1.4}}>
                      <strong style={{color:accentColor}}>{lang==="en"?"Combo bonus":"Bonus combo"} :</strong> {lang==="en"?"+10 (×3), +20 (×5), +30 (×10)":"+10 (×3), +20 (×5), +30 (×10)"}<br/>
                      <span style={{fontSize:11,color:"rgba(255,255,255,.5)"}}>{lang==="en"?"Answer fast to chain!":"Réponds vite pour enchaîner !"}</span>
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
                      {lang==="en"?<>A player appears → name <strong style={{color:accentColor}}>a club</strong> they played for → a new player from that club → and so on!</>:<>Un joueur apparaît → nomme <strong style={{color:accentColor}}>un club</strong> où il a joué → un nouveau joueur de ce club → et ainsi de suite !</>}
                    </div>
                  </div>
                </div>

                <div style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:16,padding:"14px 16px",marginBottom:12,backdropFilter:"blur(10px)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{fontSize:20}}>⚠️</div>
                    <div style={{flex:1,fontSize:13,color:"rgba(255,255,255,.85)",lineHeight:1.4}}>
                      <strong style={{color:accentColor}}>{lang==="en"?"One rule":"Une règle"} :</strong> {lang==="en"?"each club can only be named once.":"un club ne peut être cité qu'une seule fois."}
                    </div>
                  </div>
                </div>

                <div style={{background:`linear-gradient(135deg, ${accentColor}14, ${accentSecondary}10)`,border:`1px solid ${accentColor}33`,borderRadius:16,padding:"12px 16px",marginBottom:20}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{fontSize:20}}>💡</div>
                    <div style={{flex:1,fontSize:12,color:"rgba(255,255,255,.75)",lineHeight:1.4}}>
                      {lang==="en"?"Abbreviations accepted: PSG, Barça, Juve...":"Abréviations acceptées : PSG, Barça, Juve..."}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* CTA Button */}
            <button onClick={dismissInstructions} style={{width:"100%",padding:"16px",background:`linear-gradient(135deg, ${accentColor}, ${accentSecondary})`,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:16,fontWeight:800,letterSpacing:1,boxShadow:`0 8px 24px ${accentColor}55`,display:"flex",alignItems:"center",justifyContent:"center",gap:8,transition:"transform .15s"}} onMouseDown={(e)=>e.currentTarget.style.transform="scale(.97)"} onMouseUp={(e)=>e.currentTarget.style.transform="scale(1)"} onMouseLeave={(e)=>e.currentTarget.style.transform="scale(1)"}>
              {lang==="en"?"LET'S GO":"C'EST PARTI"} →
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
              <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>
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
              {lang==="en"?"INSTALL GOAT FC":"INSTALLER GOAT FC"}
            </div>
            <div style={{fontSize:11,letterSpacing:3,color:"#00E676",textTransform:"uppercase",fontWeight:800,textAlign:"center",marginBottom:22}}>
              {lang==="en"?"Get daily reminders 🔥":"Reçois les rappels quotidiens 🔥"}
            </div>

            {/* Benefits */}
            <div style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:16,padding:"14px 16px",marginBottom:14}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:10}}>
                <span style={{fontSize:18}}>🔥</span>
                <div style={{flex:1,fontSize:13,color:"rgba(255,255,255,.9)",lineHeight:1.4}}>
                  {lang==="en"?<>Never break your <strong style={{color:"#FFD600"}}>streak</strong> — get pinged before midnight</>:<>Ne casse plus ta <strong style={{color:"#FFD600"}}>série</strong> — rappel avant minuit</>}
                </div>
              </div>
              <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:10}}>
                <span style={{fontSize:18}}>⚡</span>
                <div style={{flex:1,fontSize:13,color:"rgba(255,255,255,.9)",lineHeight:1.4}}>
                  {lang==="en"?<>Faster access — <strong>one tap</strong> from your home screen</>:<>Accès rapide — <strong>un tap</strong> depuis l'écran d'accueil</>}
                </div>
              </div>
              <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                <span style={{fontSize:18}}>🎯</span>
                <div style={{flex:1,fontSize:13,color:"rgba(255,255,255,.9)",lineHeight:1.4}}>
                  {lang==="en"?<>Full-screen experience, no browser bar</>:<>Expérience plein écran, pas de barre navigateur</>}
                </div>
              </div>
            </div>

            {/* Instructions spécifiques plateforme */}
            {ios ? (
              <div style={{background:"linear-gradient(135deg, rgba(0,230,118,.12), rgba(255,214,0,.08))",border:"1px solid rgba(0,230,118,.3)",borderRadius:16,padding:"14px 16px",marginBottom:20}}>
                <div style={{fontSize:11,fontWeight:800,letterSpacing:2,color:"#00E676",textTransform:"uppercase",marginBottom:10,textAlign:"center"}}>
                  {lang==="en"?"📱 iPhone / iPad":"📱 iPhone / iPad"}
                </div>
                <div style={{fontSize:13,color:"rgba(255,255,255,.85)",lineHeight:1.6}}>
                  <div style={{marginBottom:6}}><strong style={{color:G.white}}>1.</strong> {lang==="en"?<>Tap the <strong style={{color:"#60a5fa"}}>Share button</strong> ⬆️ at the bottom of Safari</>:<>Tape le <strong style={{color:"#60a5fa"}}>bouton Partager</strong> ⬆️ en bas de Safari</>}</div>
                  <div style={{marginBottom:6}}><strong style={{color:G.white}}>2.</strong> {lang==="en"?<>Scroll down and tap <strong style={{color:"#FFD600"}}>"Add to Home Screen"</strong></>:<>Descend et tape <strong style={{color:"#FFD600"}}>"Sur l'écran d'accueil"</strong></>}</div>
                  <div><strong style={{color:G.white}}>3.</strong> {lang==="en"?<>Confirm by tapping <strong style={{color:"#00E676"}}>"Add"</strong></>:<>Confirme en tapant <strong style={{color:"#00E676"}}>"Ajouter"</strong></>}</div>
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
                ⬇ {lang==="en"?"INSTALL NOW":"INSTALLER MAINTENANT"}
              </button>
            ) : (
              <div style={{background:"linear-gradient(135deg, rgba(0,230,118,.12), rgba(255,214,0,.08))",border:"1px solid rgba(0,230,118,.3)",borderRadius:16,padding:"14px 16px",marginBottom:20}}>
                <div style={{fontSize:11,fontWeight:800,letterSpacing:2,color:"#00E676",textTransform:"uppercase",marginBottom:10,textAlign:"center"}}>
                  {lang==="en"?"📱 On your device":"📱 Sur ton appareil"}
                </div>
                <div style={{fontSize:13,color:"rgba(255,255,255,.85)",lineHeight:1.6}}>
                  {lang==="en"?"Look for the menu (⋮) in your browser, then tap \"Install app\" or \"Add to Home Screen\"":"Ouvre le menu (⋮) de ton navigateur, puis tape \"Installer l'application\" ou \"Ajouter à l'écran d'accueil\""}
                </div>
              </div>
            )}

            {/* Dismiss */}
            <button onClick={()=>{ setShowInstallPrompt(false); installDismissedThisSession.current = true; try{localStorage.setItem("bb_install_dismissed", String(Date.now()));}catch{} }} style={{width:"100%",padding:"12px",background:"transparent",color:"rgba(255,255,255,.5)",border:"1px solid rgba(255,255,255,.15)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:600}}>
              {lang==="en"?"Maybe later":"Plus tard"}
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
            <div style={{fontSize:14,fontWeight:800,color:G.white}}>{lang==="en"?"Get reminders!":"Reçois des rappels !"}</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.6)",marginTop:2}}>{lang==="en"?"We'll ping you if you haven't played for 24h":"On te pinguera si t'as pas joué depuis 24h"}</div>
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
            {lang==="en"?"✓ Yes, enable!":"✓ Oui, active !"}
          </button>
          <button onClick={()=>{ setShowNotifPrompt(false); try{localStorage.setItem("bb_notif_dismissed", String(Date.now()));}catch{} }} style={{flex:1,padding:"11px",background:"rgba(255,255,255,.06)",color:"rgba(255,255,255,.6)",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:600}}>
            {lang==="en"?"Later":"Plus tard"}
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
          <div style={{fontSize:13,fontWeight:800,color:G.white}}>{lang==="en"?"Welcome back! 🙌":"Content de te revoir ! 🙌"}</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.8)",marginTop:1}}>{lang==="en"?"It's been 24h+ — your record awaits!":"Ça fait +24h — ton record t'attend !"}</div>
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
            {dayStreak<=1?(lang==="en"?"Day streak":"Jour de suite"):(lang==="en"?"Days in a row":"Jours de suite")}
          </div>
          {/* Stats */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
            <div style={{background:"rgba(255,214,0,.08)",border:"1px solid rgba(255,214,0,.25)",borderRadius:14,padding:"12px 10px"}}>
              <div style={{fontSize:22,marginBottom:2}}>🏆</div>
              <div style={{fontFamily:G.heading,fontSize:26,color:G.gold,lineHeight:1}}>{streakBest}</div>
              <div style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:"rgba(255,255,255,.5)",fontWeight:700,marginTop:4}}>{lang==="en"?"Best ever":"Record"}</div>
            </div>
            <div style={{background:"rgba(96,165,250,.08)",border:"1px solid rgba(96,165,250,.25)",borderRadius:14,padding:"12px 10px"}}>
              <div style={{fontSize:22,marginBottom:2}}>❄️</div>
              <div style={{fontFamily:G.heading,fontSize:26,color:"#60a5fa",lineHeight:1}}>{streakFreezes}</div>
              <div style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:"rgba(255,255,255,.5)",fontWeight:700,marginTop:4}}>{lang==="en"?"Freezes":"Rattrapages"}</div>
            </div>
          </div>
          {/* Info text */}
          <div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:14,padding:"14px 16px",textAlign:"left",marginBottom:8}}>
            <div style={{fontSize:12,color:"rgba(255,255,255,.85)",lineHeight:1.6}}>
              <strong style={{color:"#FFD600"}}>{lang==="en"?"🎯 How it works":"🎯 Comment ça marche"} :</strong><br/>
              {lang==="en" ? <>
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
        <div style={{fontFamily:G.heading,fontSize:28,color:G.white,marginBottom:4}}>{lang==="en"?"CHALLENGE":"DÉFIER"}</div>
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
            <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.4)",marginBottom:8}}>{lang==="en"?"Difficulty":"Difficulté"}</div>
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
          <button onClick={function(){setShowDuelCreate(null);}} style={{flex:1,padding:"12px",background:"rgba(255,255,255,.07)",color:"rgba(255,255,255,.5)",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14}}>{lang==="en"?"Cancel":"Annuler"}</button>
          <button onClick={function(){createDuel(showDuelCreate);}} style={{flex:2,padding:"12px",background:G.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800}}>{lang==="en"?"Send challenge ⚡":"Envoyer le défi ⚡"}</button>
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
                  {lang==="en"?"QUESTIONS RECAP":"RÉCAP DES QUESTIONS"}
                </div>
                <div style={{fontSize:12,color:"rgba(255,255,255,.4)",marginTop:2}}>
                  {roundAnswers.length} {lang==="en"?(roundAnswers.length>1?"questions":"question"):(roundAnswers.length>1?"questions":"question")} · {roundAnswers.filter(a=>a.status==="ok").length} ✓ · {roundAnswers.filter(a=>a.status==="ko").length} ✗ · {roundAnswers.filter(a=>a.status==="skip").length} →
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
                        <span style={{color:"rgba(255,255,255,.4)"}}>{lang==="en"?"Your answer: ":"Ta réponse : "}</span>
                        <strong style={{color:"#00E676"}}>{a.given}</strong>
                      </div>
                    ) : (
                      <>
                        {a.given && (
                          <div style={{fontSize:12,color:"rgba(255,255,255,.5)",marginBottom:4}}>
                            <span style={{color:"rgba(255,255,255,.35)"}}>{lang==="en"?"Your answer: ":"Ta réponse : "}</span>
                            <span style={{textDecoration:"line-through",color:"#FF3D57"}}>{a.given}</span>
                          </div>
                        )}
                        <div style={{fontSize:12,color:"rgba(255,255,255,.75)",lineHeight:1.5}}>
                          <span style={{color:"rgba(255,255,255,.4)"}}>{lang==="en"?"Possible answers: ":"Réponses possibles : "}</span>
                          <span style={{color:"#FBE216"}}>{(a.validPlayers||[]).slice(0,4).join(", ")}</span>
                          {a.validPlayers && a.validPlayers.length>4 && <span style={{color:"rgba(255,255,255,.3)"}}> +{a.validPlayers.length-4}</span>}
                        </div>
                      </>
                    )}
                    <button onClick={(e)=>{e.stopPropagation();setReportingAnswer(a);setReportMessage("");setReportSent(false);}} style={{marginTop:8,background:"transparent",border:"none",color:"rgba(255,255,255,.35)",fontSize:11,fontWeight:700,cursor:"pointer",padding:"4px 8px",textDecoration:"underline",letterSpacing:.5}}>
                      🚩 {lang==="en"?"Report error":"Signaler une erreur"}
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
                  {lang==="en"?"YOUR CHAIN":"TA CHAÎNE"}
                </div>
                <div style={{fontSize:12,color:"rgba(255,255,255,.4)",marginTop:2}}>
                  {chainHistory.length} {lang==="en"?(chainHistory.length>1?"links":"link"):(chainHistory.length>1?"liens":"lien")}
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
                      <div style={{fontSize:11,color:"rgba(255,255,255,.4)",marginTop:2}}>{lang==="en"?"played at":"a joué à"}</div>
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
              <div style={{fontFamily:G.heading,fontSize:22,color:G.white,letterSpacing:2}}>{lang==="en"?"HISTORY":"HISTORIQUE"}</div>
              <button onClick={()=>setShowHistory(false)} style={{width:36,height:36,borderRadius:"50%",background:"rgba(255,255,255,.1)",border:"none",color:G.white,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>
            <div style={{padding:"40px 20px"}}>{lang==="en"?"No data":"Aucune donnée"}</div>
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
              {lang==="en"?"THANKS!":"MERCI !"}
            </div>
            <div style={{fontSize:14,color:"rgba(255,255,255,.7)",lineHeight:1.5,marginBottom:20}}>
              {lang==="en"?"Your report has been sent. It helps improve the game for everyone.":"Ton signalement a bien été envoyé. Ça aide à améliorer le jeu pour tout le monde."}
            </div>
            <button onClick={()=>setReportingAnswer(null)} style={{padding:"12px 32px",background:G.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800}}>
              {lang==="en"?"OK":"OK"}
            </button>
          </div>
        ) : (
          <>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <div style={{fontFamily:G.heading,fontSize:22,color:G.white,letterSpacing:1}}>
                🚩 {lang==="en"?"REPORT":"SIGNALER"}
              </div>
              <button onClick={()=>setReportingAnswer(null)} style={{width:32,height:32,borderRadius:"50%",background:"rgba(255,255,255,.1)",border:"none",color:G.white,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>
            <div style={{fontSize:13,color:"rgba(255,255,255,.6)",marginBottom:12,lineHeight:1.5}}>
              {lang==="en"?"Which type of error did you find?":"Quel type d'erreur as-tu trouvé ?"}
            </div>
            <div style={{background:"rgba(255,255,255,.05)",borderRadius:12,padding:"10px 12px",marginBottom:14,fontSize:12,color:"rgba(255,255,255,.7)"}}>
              <div><strong style={{color:G.white}}>{reportingAnswer.c1}</strong> × <strong style={{color:G.white}}>{reportingAnswer.c2}</strong></div>
              {reportingAnswer.given && <div style={{marginTop:4,color:"rgba(255,255,255,.5)"}}>{lang==="en"?"Your answer":"Ta réponse"} : {reportingAnswer.given}</div>}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
              {[
                {t:"wrong_player_club", fr:"❌ Un joueur dans la liste n'a jamais joué à un de ces clubs", en:"❌ A player in the list never played for one of these clubs"},
                {t:"missing_player", fr:"➕ Ma réponse était correcte mais elle a été refusée", en:"➕ My answer was correct but got rejected"},
                {t:"wrong_club_name", fr:"🏟 Erreur dans le nom d'un club", en:"🏟 Error in a club name"},
                {t:"other", fr:"❓ Autre", en:"❓ Other"},
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
                  {lang==="en"?opt.en:opt.fr}
                </button>
              ))}
            </div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.35)",textAlign:"center"}}>
              {lang==="en"?"Select a category to send the report":"Choisis une catégorie pour envoyer le signalement"}
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
      alert((lang==="en"?"Upload error: ":"Erreur upload : ") + err.message);
    }
    setAvatarUploading(false);
  }

  const cropperModal = cropState && (
    <div key="cropper" style={{position:"fixed",inset:0,zIndex:9998,background:"rgba(0,0,0,.96)",display:"flex",flexDirection:"column",animation:"fadeIn .2s ease",backdropFilter:"blur(10px)"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px",borderBottom:"1px solid rgba(255,255,255,.08)"}}>
        <button onClick={()=>setCropState(null)} disabled={avatarUploading} style={{background:"none",border:"none",color:"rgba(255,255,255,.7)",fontSize:14,fontFamily:G.font,fontWeight:600,cursor:avatarUploading?"default":"pointer",padding:"8px 4px",opacity:avatarUploading?.4:1}}>{lang==="en"?"Cancel":"Annuler"}</button>
        <div style={{fontFamily:G.heading,fontSize:16,color:G.white,letterSpacing:1}}>{lang==="en"?"ADJUST PHOTO":"AJUSTER LA PHOTO"}</div>
        <button onClick={validateCrop} disabled={avatarUploading} style={{background:"none",border:"none",color:avatarUploading?"rgba(0,230,118,.4)":G.accent,fontSize:14,fontFamily:G.font,fontWeight:800,cursor:avatarUploading?"default":"pointer",padding:"8px 4px"}}>{avatarUploading?(lang==="en"?"Saving...":"Sauvegarde..."):(lang==="en"?"Confirm":"Valider")}</button>
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
      <div style={{textAlign:"center",padding:"0 20px 20px",fontSize:11,color:"rgba(255,255,255,.35)"}}>{lang==="en"?"Drag to move · pinch or slider to zoom":"Glisse pour bouger · pince ou curseur pour zoomer"}</div>
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
        <div style={{...shell,overflow:isDesktop?"visible":"auto"}} key="friendDetail">
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
              {isUnbeaten && <div style={{fontSize:11,fontWeight:800,color:"#FFD700",background:"rgba(255,215,0,.15)",borderRadius:20,padding:"3px 10px",letterSpacing:.5}}>{lang==="en"?"😤 You're unbeaten against them":"😤 T'es invaincu contre lui"}</div>}
              {theyDominate && <div style={{fontSize:11,fontWeight:800,color:"#FF3D57",background:"rgba(255,61,87,.15)",borderRadius:20,padding:"3px 10px",letterSpacing:.5}}>{lang==="en"?"💀 They've never lost to you":"💀 Il t'a jamais perdu contre toi"}</div>}
            </div>
            <button onClick={function(){setShowDuelCreate({id:selectedFriend.id,name:selectedFriend.name});}} style={{padding:"8px 14px",background:G.accent,color:"#000",border:"none",borderRadius:20,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:800}}>{lang==="en"?"⚡ Challenge":"⚡ Défier"}</button>
          </div>
          <div style={{...sheet,borderRadius:"28px 28px 0 0",marginTop:16}}>
            {/* Bilan */}
            {friendDuels.length > 0 && (
              <div style={{display:"flex",gap:8,marginBottom:4}}>
                <div style={{flex:1,background:"rgba(0,230,118,.08)",border:"1px solid rgba(0,230,118,.2)",borderRadius:16,padding:"14px 0",textAlign:"center"}}>
                  <div style={{fontFamily:G.heading,fontSize:32,color:"#00E676"}}>{wins}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase",marginTop:2}}>{lang==="en"?"Wins":"Victoires"}</div>
                </div>
                <div style={{flex:1,background:"rgba(255,214,0,.06)",border:"1px solid rgba(255,214,0,.2)",borderRadius:16,padding:"14px 0",textAlign:"center"}}>
                  <div style={{fontFamily:G.heading,fontSize:32,color:G.gold}}>{draws}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase",marginTop:2}}>{lang==="en"?"Draws":"Nuls"}</div>
                </div>
                <div style={{flex:1,background:"rgba(255,61,87,.06)",border:"1px solid rgba(255,61,87,.2)",borderRadius:16,padding:"14px 0",textAlign:"center"}}>
                  <div style={{fontFamily:G.heading,fontSize:32,color:"#FF3D57"}}>{losses}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase",marginTop:2}}>{lang==="en"?"Losses":"Défaites"}</div>
                </div>
              </div>
            )}
            {/* Historique */}
            <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.3)",marginBottom:8,marginTop:4}}>{lang==="en"?"History":"Historique"}</div>
            {friendDuels.length===0 && (
              <div style={{textAlign:"center",padding:"32px 0",color:"rgba(255,255,255,.3)",fontSize:14}}>{lang==="en"?"No duels played with ":"Aucun duel encore joué avec "}{selectedFriend.name} 👀</div>
            )}
            {friendDuels.map(function(d,i){
              const myScore = d.challenger_id===playerId ? d.challenger_score : d.opponent_score;
              const theirScore = d.challenger_id===playerId ? d.opponent_score : d.challenger_score;
              const won = myScore>theirScore; const draw = myScore===theirScore;
              return(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:"rgba(255,255,255,.04)",borderRadius:12,marginBottom:6,border:"1px solid rgba(255,255,255,.06)"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:800,color:won?"#00E676":draw?G.gold:"#FF3D57"}}>{won?(lang==="en"?"🏆 Win":"🏆 Victoire"):draw?(lang==="en"?"🤝 Draw":"🤝 Égalité"):(lang==="en"?"😅 Loss":"😅 Défaite")}</div>
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
          {[0,1,2,3,4,5,6].map(function(i){return(<div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>);})}
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
              <div style={{fontFamily:G.heading,fontSize:22,color:G.white,marginBottom:8}}>{lang==="en"?"Remove ":"Supprimer "}{confirmRemove.name}{lang==="en"?"?":" ?"}</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,.4)",marginBottom:24}}>{lang==="en"?"They'll need to send a new request to be back on your list.":"Il devra renvoyer une demande pour être à nouveau dans ta liste."}</div>
              <div style={{display:"flex",gap:10}}>
                <button onClick={function(){setConfirmRemove(null);}} style={{flex:1,padding:"12px",background:"rgba(255,255,255,.07)",color:"rgba(255,255,255,.6)",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>{lang==="en"?"Cancel":"Annuler"}</button>
                <button onClick={function(){removeFriend(confirmRemove.id);setConfirmRemove(null);}} style={{flex:1,padding:"12px",background:"#FF3D57",color:"#fff",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800}}>{lang==="en"?"Remove":"Supprimer"}</button>
              </div>
            </div>
          </div>
        )}
        <div style={{zIndex:3,padding:"12px 16px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          {backBtn(function(){setShowFriends(false);setFriendMsg("");setSelectedFriend(null);})}
          <div style={{fontFamily:G.heading,fontSize:26,color:G.white,letterSpacing:2}}>{lang==="en"?"FRIENDS":"AMIS"}</div>
          <div style={{width:40}}/>
        </div>
        <div style={{...sheet,borderRadius:"28px 28px 0 0",marginTop:16}}>
          {/* Demandes reçues */}
          {friendRequests.length > 0 && (
            <div style={{background:"#123a1e",border:"1px solid rgba(0,230,118,.5)",borderRadius:16,padding:14}}>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:G.accent,marginBottom:10}}>👋 {lang==="en"?"Requests received":"Demandes reçues"}</div>
              {friendRequests.map(function(req){return(
                <div key={req.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:800,color:G.white}}>{req.from_name}</div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>{lang==="en"?"wants to be your friend · ":"veut être ton ami · "}{req.from_id}</div>
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
            <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>{lang==="en"?"Add a friend":"Ajouter un ami"}</div>
            <div style={{display:"flex",gap:8}}>
              <input value={friendInput} onChange={function(e){setFriendInput(e.target.value);setFriendMsg("");}}
                placeholder={lang==="en"?"Your friend's username...":"Pseudo de ton ami..."} maxLength={20}
                style={{flex:1,padding:"10px 14px",borderRadius:12,border:"1.5px solid rgba(255,255,255,.15)",background:"#141414",color:G.white,fontFamily:G.font,fontSize:15,fontWeight:600,outline:"none"}}/>
              <button onClick={function(){addFriend(friendInput);}}
                style={{padding:"10px 16px",background:G.accent,color:"#000",border:"none",borderRadius:12,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800}}>+</button>
            </div>
            {friendMsg && <div style={{fontSize:12,marginTop:6,color:friendMsg.startsWith("✓")?"#00E676":friendMsg.startsWith("🔍")?"rgba(255,255,255,.5)":"#FF3D57",fontWeight:700}}>{friendMsg}</div>}
          </div>
          {/* Liste des amis + demandes en attente */}
          <div>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.3)",marginBottom:8}}>
              {lang==="en"?"My friends":"Mes amis"} {friendsList.length>0&&<span style={{color:G.accent}}>({friendsList.length})</span>}
            </div>
            {friendsList.length===0 && sentRequests.filter(function(r){return r.status==="pending";}).length===0 && (
              <div style={{textAlign:"center",padding:"24px 0",color:"rgba(255,255,255,.3)",fontSize:14}}>{lang==="en"?"No friends yet 👋":"Aucun ami pour l'instant 👋"}</div>
            )}
            {/* Demandes en attente intégrées dans la liste */}
            {sentRequests.filter(function(r){return r.status==="pending";}).map(function(r,i){return(
              <div key={"pending-"+i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:"rgba(255,214,0,.04)",borderRadius:14,marginBottom:8,border:"1px dashed rgba(255,214,0,.25)"}}>
                <div>
                  <div style={{fontSize:15,fontWeight:800,color:"rgba(255,255,255,.5)"}}>{r.to_name || r.to_id}</div>
                  <div style={{fontSize:11,color:G.gold}}>{lang==="en"?"⏳ Awaiting acceptance":"⏳ En attente d'acceptation"}</div>
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
                  onClick={function(){setShowFriends(false);openUserProfile(fid,fname);}}>
                  <div>
                    <div style={{fontSize:15,fontWeight:800,color:G.white}}>{fname}</div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,.35)"}}>{friendDuelCount>0?friendDuelCount+(lang==="en"?" duel"+(friendDuelCount>1?"s played":" played"):" duel"+(friendDuelCount>1?"s joués":" joué")):(lang==="en"?"No duels yet":"Aucun duel encore")}</div>
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <button onClick={function(e){e.stopPropagation();setShowDuelCreate({id:fid,name:fname});}} style={{padding:"7px 12px",background:G.accent,color:"#000",border:"none",borderRadius:20,cursor:"pointer",fontFamily:G.font,fontSize:12,fontWeight:800}}>{lang==="en"?"⚡ Challenge":"⚡ Défier"}</button>
                    <button onClick={function(e){e.stopPropagation();setConfirmRemove({id:fid,name:fname});}} style={{padding:"7px 10px",background:"transparent",border:"1px solid rgba(255,255,255,.15)",borderRadius:20,cursor:"pointer",color:"rgba(255,255,255,.4)",fontSize:12}}>✕</button>
                    <span style={{color:"rgba(255,255,255,.3)",fontSize:18}}>›</span>
                  </div>
                </div>
              );
            })}
          </div>
          <button onClick={function(){setShowFriends(false);setSelectedFriend(null);}} style={{width:"100%",background:"rgba(255,255,255,.05)",color:"rgba(255,255,255,.5)",border:"1px solid rgba(255,255,255,.1)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,padding:"10px",marginTop:4}}>{lang==="en"?"↩ Back":"↩ Retour"}</button>
        </div>
      </div>
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
          <div style={{fontFamily:G.heading,fontSize:34,color:G.white,letterSpacing:1.4}}>{lang==="en"?"MY ACCOUNT":"MON COMPTE"}</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,.5)",marginTop:6,fontWeight:600}}>{lang==="en"?"Manage your account settings":"Gère les paramètres de ton compte"}</div>
        </div>

        <div style={{zIndex:1,padding:"20px 20px",display:"flex",flexDirection:"column",gap:14,maxWidth:560,margin:"0 auto",width:"100%",boxSizing:"border-box"}}>

          {/* Identité */}
          <div style={{padding:"18px 20px",background:"rgba(255,255,255,.06)",borderRadius:16,border:"1px solid rgba(255,255,255,.1)"}}>
            <div style={{fontSize:11,color:"rgba(255,255,255,.4)",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>{lang==="en"?"Pseudo":"Pseudo"}</div>
            <div style={{fontSize:20,color:G.white,fontWeight:800}}>{playerName||"—"}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.4)",fontWeight:600,marginTop:6}}>ID: {playerId}</div>
          </div>

          {/* Liens légaux */}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{padding:"14px 18px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:14,color:"rgba(255,255,255,.7)",fontFamily:G.font,fontSize:14,fontWeight:700,display:"flex",alignItems:"center",gap:12,textAlign:"left",textDecoration:"none"}}>
            <span style={{fontSize:18}}>🔒</span>
            <div style={{flex:1}}>{lang==="en"?"Privacy Policy":"Politique de confidentialité"}</div>
            <span style={{fontSize:14,color:"rgba(255,255,255,.4)"}}>↗</span>
          </a>

          <a href="/terms" target="_blank" rel="noopener noreferrer" style={{padding:"14px 18px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:14,color:"rgba(255,255,255,.7)",fontFamily:G.font,fontSize:14,fontWeight:700,display:"flex",alignItems:"center",gap:12,textAlign:"left",textDecoration:"none"}}>
            <span style={{fontSize:18}}>📄</span>
            <div style={{flex:1}}>{lang==="en"?"Terms of Service":"Conditions générales"}</div>
            <span style={{fontSize:14,color:"rgba(255,255,255,.4)"}}>↗</span>
          </a>

          {/* Zone danger */}
          <div style={{marginTop:20,padding:"16px",background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.2)",borderRadius:14}}>
            <div style={{fontSize:11,color:"#ef4444",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:8}}>{lang==="en"?"Danger zone":"Zone de danger"}</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,.7)",marginBottom:14,lineHeight:1.5}}>{lang==="en"?"Deleting your account is permanent. All your scores, friends, and data will be erased forever.":"La suppression de ton compte est définitive. Tous tes scores, amis et données seront effacés à jamais."}</div>
            <button onClick={function(){setConfirmDeleteAccount(1);}} style={{width:"100%",padding:"13px",background:"transparent",color:"#ef4444",border:"1px solid #ef4444",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800}}>
              {lang==="en"?"🗑 Delete my account":"🗑 Supprimer mon compte"}
            </button>
          </div>

          {/* Modal de confirmation suppression compte */}
          {confirmDeleteAccount > 0 && (
            <div onClick={function(e){if(e.target===e.currentTarget)setConfirmDeleteAccount(0);}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(8px)"}}>
              <div style={{background:G.bg,borderRadius:20,padding:"24px 22px",maxWidth:420,width:"100%",border:"1px solid rgba(239,68,68,.4)",boxShadow:"0 12px 40px rgba(0,0,0,.6)"}}>
                <div style={{fontSize:42,textAlign:"center",marginBottom:8}}>⚠️</div>
                <div style={{fontFamily:G.heading,fontSize:22,color:"#ef4444",textAlign:"center",letterSpacing:1.2,marginBottom:14}}>
                  {confirmDeleteAccount === 1 ? (lang==="en"?"ARE YOU SURE?":"ES-TU SÛR ?") : (lang==="en"?"LAST WARNING":"DERNIER AVERTISSEMENT")}
                </div>
                <div style={{fontSize:14,color:"rgba(255,255,255,.85)",textAlign:"center",marginBottom:6,lineHeight:1.5}}>
                  {confirmDeleteAccount === 1
                    ? (lang==="en"?"This will permanently delete:":"Cela va supprimer définitivement :")
                    : (lang==="en"?"This cannot be undone. Confirm one last time?":"C'est irréversible. Tu confirmes une dernière fois ?")}
                </div>
                {confirmDeleteAccount === 1 && (
                  <ul style={{fontSize:13,color:"rgba(255,255,255,.7)",margin:"10px 0 18px 0",paddingLeft:24,lineHeight:1.7}}>
                    <li>{lang==="en"?"Your pseudo and avatar":"Ton pseudo et avatar"}</li>
                    <li>{lang==="en"?"All your scores and XP":"Tous tes scores et XP"}</li>
                    <li>{lang==="en"?"Your friends and duels":"Tes amis et duels"}</li>
                    <li>{lang==="en"?"Your push notifications":"Tes notifications push"}</li>
                  </ul>
                )}
                <div style={{display:"flex",gap:10,marginTop:18}}>
                  <button onClick={function(){setConfirmDeleteAccount(0);}} style={{flex:1,padding:"13px",background:"rgba(255,255,255,.08)",color:G.white,border:"1px solid rgba(255,255,255,.15)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>
                    {lang==="en"?"Cancel":"Annuler"}
                  </button>
                  <button onClick={function(){
                    if (confirmDeleteAccount === 1) setConfirmDeleteAccount(2);
                    else { setConfirmDeleteAccount(0); deleteAccount(); }
                  }} style={{flex:1,padding:"13px",background:"#ef4444",color:"#fff",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800}}>
                    {confirmDeleteAccount === 1 ? (lang==="en"?"Continue":"Continuer") : (lang==="en"?"DELETE NOW":"SUPPRIMER")}
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
        <div style={{zIndex:1,padding:"12px 20px 12px 70px",display:"flex",alignItems:"center",gap:12}}>
          <div style={{flex:1,textAlign:"center"}}>
            <div style={{fontFamily:G.heading,fontSize:"clamp(28px,7vw,46px)",color:G.white,letterSpacing:3}}>{lang==="en"?"LEADERBOARD":"CLASSEMENT"}</div>
            {(()=>{ const s=getCurrentSeason(); return lbMode==="amis"
              ? <div style={{fontSize:12,color:"rgba(255,255,255,.4)"}}>{lang==="en"?"Friends leaderboard · Cumulative":"Classement entre amis · Cumulatif"}</div>
              : <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                  <div style={{fontSize:13,fontWeight:800,color:G.gold}}>⚽ {lang==="en"?s.monthNameEn:s.monthNameFr}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>{lang==="en"?`⏳ ${s.days}d ${s.hours}h before reset`:`⏳ J-${s.days} ${s.hours}h avant reset`}</div>
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
                  <div style={{fontSize:11,fontWeight:800,color:G.gold,letterSpacing:1}}>🏆 {(lang==="en"?s.monthNameEn:s.monthNameFr).toUpperCase()}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.4)",marginTop:2}}>
                    {lang==="en" ? (daysLeft > 0 ? `${daysLeft}d (${hoursLeft}h) left` : `Ends in ${hoursLeft}h`) : (daysLeft > 0 ? `J-${daysLeft} (${hoursLeft}h)` : `Finit dans ${hoursLeft}h`)}
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
                {m==="saison"?(lang==="en"?"⭐ Season":"⭐ Saison"):m==="global"?(lang==="en"?"🌍 Global":"🌍 Global"):(lang==="en"?"👥 Friends":"👥 Amis")}
              </button>
            );})}
          </div>
          {/* Toggle Monde/Amis pour le classement Saison */}
          {lbMode==="saison" && (
            <div style={{display:"flex",gap:4,marginBottom:10,marginTop:6,padding:4,background:"rgba(255,255,255,.04)",borderRadius:10,border:"1px solid rgba(255,255,255,.06)"}}>
              {[{id:"monde",emoji:"🌍",labelFr:"Monde",labelEn:"World"},{id:"amis",emoji:"👥",labelFr:"Amis",labelEn:"Friends"}].map(function(s){return(
                <button key={s.id} onClick={function(){setLbSeasonScope(s.id);}} style={{flex:1,padding:"8px 10px",borderRadius:8,border:"none",background:lbSeasonScope===s.id?"rgba(0,230,118,.2)":"transparent",color:lbSeasonScope===s.id?G.accent:"rgba(255,255,255,.55)",fontFamily:G.font,fontSize:12,fontWeight:800,cursor:"pointer",letterSpacing:.5,transition:"all .15s"}}>
                  {s.emoji} {lang==="en"?s.labelEn:s.labelFr}
                </button>
              );})}
            </div>
          )}
          {leaderboard.length === 0 && (
            <div style={{textAlign:"center",padding:"32px 0",color:"rgba(255,255,255,.3)",fontSize:14}}>{lang==="en"?"No scores yet":"Aucun score pour le moment"}</div>
          )}
          {leaderboard.length > 0 && lbMode==="saison" && lbSeasonScope==="amis" && leaderboard.filter(function(e){ return e.pid===playerId || friendsList.includes(e.pid); }).length === 0 && (
            <div style={{textAlign:"center",padding:"32px 16px",color:"rgba(255,255,255,.3)",fontSize:13,lineHeight:1.5}}>{lang==="en"?"None of your friends have played yet this month":"Aucun de tes amis n'a encore joué ce mois-ci"}</div>
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
              <div key={i} onClick={()=>{ if(!isMe) { setShowLeaderboard(false); openUserProfile(entry.pid, entry.name); } }} style={{borderRadius:14,background:i===0?"linear-gradient(135deg,#FFD600,#FF6B35)":i===1?"linear-gradient(135deg,#E8E8E8,#A8A8B0)":i===2?"linear-gradient(135deg,#E3A869,#8B5A2B)":"rgba(0,230,118,.18)",border:i===0?"1px solid rgba(255,214,0,.6)":i===1?"1px solid rgba(200,200,210,.6)":i===2?"1px solid rgba(205,127,50,.6)":isMe?"1px solid rgba(0,230,118,.6)":"1px solid rgba(0,230,118,.35)",marginBottom:6,overflow:"hidden",cursor:isMe?"default":"pointer",boxShadow:i===0?"0 4px 18px rgba(255,107,53,.35)":i===1?"0 4px 18px rgba(200,200,210,.25)":i===2?"0 4px 18px rgba(205,127,50,.3)":"none"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 12px"}}>
                  <div style={{fontFamily:G.heading,fontSize:28,width:34,textAlign:"center",color:i<3?["#FFD600","#C0C0C0","#CD7F32"][i]:"rgba(255,255,255,.3)",flexShrink:0}}>
                    {i<3?medals[i]:(i+1)}
                  </div>
                  {/* Avatar rond (photo Supabase Storage ou fallback emoji grade) */}
                  <div style={{width:42,height:42,borderRadius:"50%",background:"linear-gradient(135deg,#00E676,#00A855)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,color:"#fff",overflow:"hidden",position:"relative",flexShrink:0,border:i<3?"2px solid rgba(0,0,0,.3)":"1.5px solid rgba(255,255,255,.15)"}}>
                    <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{grade.emoji}</div>
                    <img src={SB_URL + "/storage/v1/object/public/avatars/" + entry.pid + ".jpg"} alt="" onError={function(e){e.currentTarget.style.display="none";}} style={{width:"100%",height:"100%",objectFit:"cover",position:"relative",zIndex:1}}/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3,flexWrap:"wrap"}}>
                      <span style={{fontSize:18,fontFamily:G.heading,letterSpacing:1,color:i<3?"#1a0d00":isMe?G.accent:G.white,whiteSpace:"nowrap"}}>{entry.country && <span style={{marginRight:5,fontSize:15}}>{countryToFlag(entry.country)}</span>}{entry.name}{isMe?" (toi)":""}</span>
                      <span style={{fontSize:11,fontWeight:800,color:i<3?"#1a0d00":grade.color,background:i<3?"rgba(26,13,0,.18)":grade.color+"22",borderRadius:20,padding:"2px 8px",letterSpacing:.5,border:i<3?"1px solid rgba(26,13,0,.25)":"none"}}>{grade.emoji} {grade.label}</span>
                      {entry.streak>=3 && <span style={{fontSize:11,fontWeight:800,color:"#FF6B35",background:"rgba(255,107,53,.15)",borderRadius:20,padding:"2px 8px"}}>🔥 {entry.streak}</span>}
                    </div>
                    {lbMode==="saison"
                      ? null
                      : <div style={{fontSize:12,color:i<3?"rgba(26,13,0,.85)":"rgba(255,255,255,.5)",marginTop:3,fontWeight:i<3?700:400}}>{entry.played} {lang==="en"?(entry.played>1?"games":"game"):(entry.played>1?"parties":"partie")}</div>
                    }
                  </div>
                  <div style={{fontFamily:G.heading,fontSize:28,color:i<3?"#1a0d00":G.white,flexShrink:0}}>{entry.score} <span style={{fontSize:12,color:i<3?"rgba(26,13,0,.7)":"rgba(255,255,255,.3)",fontWeight:i<3?700:400}}>pts</span></div>
                </div>
                {lbMode!=="saison" && (
                <div style={{display:"flex",borderTop:i<3?"1px solid rgba(0,0,0,.2)":"1px solid rgba(255,255,255,.06)",background:i<3?"rgba(0,0,0,.08)":"transparent"}}>
                    <div style={{flex:1,padding:"10px 0",textAlign:"center",borderRight:i<3?"1px solid rgba(0,0,0,.15)":"1px solid rgba(255,255,255,.06)"}}>
                      <div style={{fontFamily:G.heading,fontSize:22,color:i<3?"#0d5c2a":"#00E676"}}>{entry.wins||0}</div>
                      <div style={{fontSize:11,color:i<3?"rgba(26,13,0,.75)":"rgba(255,255,255,.5)",letterSpacing:1,textTransform:"uppercase",fontWeight:i<3?800:400}}>{lang==="en"?"Wins":"Victoires"}</div>
                    </div>
                    <div style={{flex:1,padding:"10px 0",textAlign:"center",borderRight:i<3?"1px solid rgba(0,0,0,.15)":"1px solid rgba(255,255,255,.06)"}}>
                      <div style={{fontFamily:G.heading,fontSize:22,color:i<3?"#7a5c00":G.gold}}>{entry.draws||0}</div>
                      <div style={{fontSize:11,color:i<3?"rgba(26,13,0,.75)":"rgba(255,255,255,.5)",letterSpacing:1,textTransform:"uppercase",fontWeight:i<3?800:400}}>{lang==="en"?"Draws":"Nuls"}</div>
                    </div>
                    <div style={{flex:1,padding:"10px 0",textAlign:"center"}}>
                      <div style={{fontFamily:G.heading,fontSize:22,color:i<3?"#8a1a2e":"#FF3D57"}}>{entry.losses||0}</div>
                      <div style={{fontSize:11,color:i<3?"rgba(26,13,0,.75)":"rgba(255,255,255,.5)",letterSpacing:1,textTransform:"uppercase",fontWeight:i<3?800:400}}>{lang==="en"?"Losses":"Défaites"}</div>
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
                let monthShort = lang==="en"?("Season "+s.season_number):("Saison "+s.season_number);
                if (s.season_month) {
                  const [y, m] = s.season_month.split("-");
                  monthShort = (lang==="en"?monthNamesEn:monthNamesFr)[parseInt(m,10)-1] + " " + y.slice(2);
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
            <div style={{fontSize:12,color:"rgba(255,255,255,.4)",textAlign:"center",marginBottom:16}}>{lang==="en"?"Past season champions":"Champions des saisons passées"}</div>
            {hallOfFame.length === 0 && <div style={{textAlign:"center",color:"rgba(255,255,255,.3)",padding:"24px 0",fontSize:14}}>{lang==="en"?"No champion yet — the first season is ongoing!":"Pas encore de champion — la première saison est en cours !"}</div>}
            {hallOfFame.map(function(s,i){
              // Transformer le monthKey "2026-04" en nom lisible
              const monthNamesFr = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
              const monthNamesEn = ["January","February","March","April","May","June","July","August","September","October","November","December"];
              let monthLabel = "";
              if (s.season_month) {
                const [y, m] = s.season_month.split("-");
                const mi = parseInt(m,10) - 1;
                monthLabel = (lang==="en"?monthNamesEn:monthNamesFr)[mi] + " " + y;
              }
              return (
                <div key={i} style={{background:"linear-gradient(135deg, rgba(255,214,0,.1), rgba(255,107,53,.05))",borderRadius:18,border:"1.5px solid rgba(255,214,0,.3)",marginBottom:14,padding:"16px 14px",boxShadow:"0 4px 16px rgba(255,214,0,.08)"}}>
                  {/* Header saison */}
                  <div style={{textAlign:"center",marginBottom:12}}>
                    <div style={{fontSize:11,fontWeight:800,letterSpacing:3,color:"rgba(255,214,0,.7)",textTransform:"uppercase"}}>{lang==="en"?"Season":"Saison"} {s.season_number}</div>
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
            <button onClick={function(){setShowHallOfFame(false);}} style={{width:"100%",padding:"14px",background:"rgba(255,255,255,.07)",color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700,marginTop:8}}>{lang==="en"?"Close":"Fermer"}</button>
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
            <div style={{fontSize:14,color:"rgba(255,255,255,.5)",letterSpacing:3,textTransform:"uppercase",marginBottom:16}}>{lang==="en"?"Let's go!":"C'est parti !"}</div>
            <div style={{fontFamily:G.heading,fontSize:120,color:G.accent,lineHeight:1,animation:"popIn .3s ease"}} key={duelCountdown}>{duelCountdown}</div>
            <div style={{fontSize:14,color:"rgba(255,255,255,.4)",marginTop:16}}>{players.length} {lang==="en"?"players":"joueurs"}</div>
          </div>
        </div>
      );
    }
    return (
      <div style={{...shell,overflow:isDesktop?"visible":"auto"}} key="room">
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
          <div style={{fontFamily:G.heading,fontSize:24,color:G.white,letterSpacing:2}}>{lang==="en"?"ROOM":"SALLE"}</div>
          <div style={{background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.1)",borderRadius:12,padding:"6px 14px",textAlign:"center",display:"flex",alignItems:"center",gap:8}}>
            <div>
              <div style={{fontSize:9,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase"}}>{lang==="en"?"Code":"Code"}</div>
              <div style={{fontFamily:G.heading,fontSize:20,color:G.gold,letterSpacing:4}}>{room.code}</div>
            </div>
            <button onClick={function(){
              const link = "https://goatfc.fr?room="+room.code;
              const shareTitle = lang==="en" ? "GOAT FC — Join my room!" : "GOAT FC — Rejoins ma salle !";
              const shareText = lang==="en" ? "Join my room on GOAT FC 🐐" : "Rejoins ma salle sur GOAT FC 🐐";
              const copiedMsg = lang==="en" ? "Link copied! 📋" : "Lien copié ! 📋";
              if(navigator.share){navigator.share({title:shareTitle,text:shareText,url:link});}
              else{navigator.clipboard.writeText(link).then(function(){alert(copiedMsg);});}
            }} style={{background:"rgba(0,230,118,.15)",border:"1px solid rgba(0,230,118,.3)",borderRadius:8,padding:"6px 10px",color:G.accent,cursor:"pointer",fontSize:13,fontWeight:800,lineHeight:1}}>🔗 {lang==="en"?"Invite":"Inviter"}</button>
          </div>
        </div>
        <div style={{...sheet,borderRadius:"28px 28px 0 0",marginTop:16}}>
          <div style={{background:"rgba(255,255,255,.04)",borderRadius:14,padding:"10px 14px",marginBottom:4}}>
            <div style={{fontSize:11,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase",marginBottom:2}}>{lang==="en"?"Mode":"Mode"}</div>
            <div style={{fontSize:15,fontWeight:800,color:G.white}}>{room.mode==="pont"?"The Plug":"The Mercato"}{room.diff?" · "+(room.diff==="facile"?"AMATEUR":room.diff==="moyen"?"PRO":"CRESCENDO"):""} · {room.rounds||1} {lang==="en"?("round"+((room.rounds||1)>1?"s":"")):("manche"+((room.rounds||1)>1?"s":""))}</div>
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.3)",marginBottom:8}}>
              {lang==="en"?"Players":"Joueurs"} ({players.length}/8)
            </div>
            {players.map(function(p, i){return(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"rgba(255,255,255,.04)",borderRadius:12,marginBottom:6,border:p.id===playerId?"1px solid rgba(0,230,118,.3)":"1px solid rgba(255,255,255,.05)"}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,#1E5C2A,#00E676)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:"#fff",flexShrink:0}}>
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:800,color:p.id===playerId?G.accent:G.white}}>{p.name}{p.id===room.host_id?" 👑":""}{p.id===playerId?(lang==="en"?" (you)":" (toi)"):""}</div>
                </div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>✓ {lang==="en"?"Ready":"Prêt"}</div>
              </div>
            );})}
          </div>
          {players.length < 2 && (
            <div style={{textAlign:"center",padding:"8px 0",fontSize:13,color:"rgba(255,255,255,.3)"}}>
              {lang==="en"?<>Share code <strong style={{color:G.gold}}>{room.code}</strong> with your friends</>:<>Partage le code <strong style={{color:G.gold}}>{room.code}</strong> à tes amis</>}
            </div>
          )}
          {isHost ? (
            <button onClick={startRoomGame} disabled={players.length < 2}
              style={{width:"100%",padding:"16px",background:players.length>=2?G.accent:"rgba(255,255,255,.1)",color:players.length>=2?"#000":"rgba(255,255,255,.3)",border:"none",borderRadius:50,cursor:players.length>=2?"pointer":"not-allowed",fontFamily:G.font,fontSize:15,fontWeight:800,marginTop:4}}>
              {players.length < 2 ? (lang==="en"?"Waiting for players...":"En attente de joueurs...") : (lang==="en"?"🚀 Start game ("+players.length+" players)":"🚀 Lancer la partie ("+players.length+" joueurs)")}
            </button>
          ) : (
            <div style={{textAlign:"center",padding:"14px",fontSize:13,color:"rgba(255,255,255,.4)",background:"rgba(255,255,255,.04)",borderRadius:16}}>
              ⏳ {lang==="en"?"Waiting for "+room.host_name+" to start...":"En attente que "+room.host_name+" lance la partie..."}
            </div>
          )}
        </div>
      </div>
    );
  }


  // ── TUTORIAL ──
  const TUTORIAL_SLIDES = lang === "en" ? [
    { icon:"⚽", title:"GOAT PLUG", subtitle:"Find the player linking 2 clubs", desc:"We show you 2 clubs. Find the player who played for both!", color:"#1a4a2e", accent:"#00E676" },
    { icon:"⛓", title:"GOAT MERCATO", subtitle:"Chain player → club → player", desc:"A player is shown. Type a club they played for, then another player from that club… and so on!", color:"#1a2a4a", accent:"#60a5fa" },
    { icon:"⚡", title:"DAILY CHALLENGE", subtitle:"A mystery player every day", desc:"Every day, a new mystery player to guess. Come back daily to keep your streak alive!", color:"#3a2a00", accent:"#FFD600" },
    { icon:"👥", title:"MULTIPLAYER", subtitle:"Play with your friends", desc:"Create a room, share the code, and battle in real time with up to 8 players!", color:"#2a1a3a", accent:"#c084fc" },
  ] : [
    { icon:"⚽", title:"GOAT PLUG", subtitle:"Trouve le joueur qui relie 2 clubs", desc:"On te montre 2 clubs. Trouve le joueur qui a joué dans les deux !", color:"#1a4a2e", accent:"#00E676" },
    { icon:"⛓", title:"GOAT MERCATO", subtitle:"Enchaîne joueur → club → joueur", desc:"Un joueur est affiché. Tape un club où il a joué, puis un autre joueur de ce club… et ainsi de suite !", color:"#1a2a4a", accent:"#60a5fa" },
    { icon:"⚡", title:"DÉFI DU JOUR", subtitle:"Un joueur mystère chaque jour", desc:"Chaque jour, un nouveau joueur mystère à deviner. Reviens tous les jours pour ne pas perdre ta série !", color:"#3a2a00", accent:"#FFD600" },
    { icon:"👥", title:"MULTIJOUEUR", subtitle:"Joue avec tes potes", desc:"Crée une salle, partage le code, et affrontez-vous en temps réel jusqu'à 8 joueurs !", color:"#2a1a3a", accent:"#c084fc" },
  ];
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
            {tutorialStep > 0 && <button onClick={()=>setTutorialStep(s=>s-1)} style={{flex:1,padding:"14px",background:"rgba(255,255,255,.07)",color:"rgba(255,255,255,.5)",border:"1px solid rgba(255,255,255,.1)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>{lang==="en"?"← Back":"← Retour"}</button>}
            {tutorialStep < TUTORIAL_SLIDES.length-1
              ? <button onClick={()=>setTutorialStep(s=>s+1)} style={{flex:2,padding:"14px",background:sl.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800}}>{lang==="en"?"Next →":"Suivant →"}</button>
              : <button onClick={closeTutorial} style={{flex:2,padding:"14px",background:sl.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800}}>{lang==="en"?"Let's go 🚀":"C'est parti 🚀"}</button>
            }
          </div>
          {tutorialStep < TUTORIAL_SLIDES.length-1 && <button onClick={closeTutorial} style={{marginTop:16,background:"none",border:"none",color:"rgba(255,255,255,.3)",cursor:"pointer",fontFamily:G.font,fontSize:13}}>{lang==="en"?"Skip":"Passer"}</button>}
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
            {lang==="en" ? "WELCOME TO GOAT FC" : "BIENVENUE SUR GOAT FC"}
          </div>
          <div style={{fontSize:14,color:"rgba(255,255,255,.75)",lineHeight:1.6,marginBottom:20,textAlign:"left"}}>
            {lang==="en" ? (
              <>
                <p style={{margin:"0 0 12px"}}>Quick heads-up about your data:</p>
                <ul style={{paddingLeft:20,margin:"0 0 12px",color:"rgba(255,255,255,.65)",fontSize:13}}>
                  <li style={{marginBottom:6}}>We store your <strong style={{color:G.accent}}>username, scores and preferences</strong> locally</li>
                  <li style={{marginBottom:6}}>No advertising tracking, no data sold to third parties</li>
                  <li>You can delete your account anytime in settings</li>
                </ul>
              </>
            ) : (
              <>
                <p style={{margin:"0 0 12px"}}>Petit point sur tes données :</p>
                <ul style={{paddingLeft:20,margin:"0 0 12px",color:"rgba(255,255,255,.65)",fontSize:13}}>
                  <li style={{marginBottom:6}}>On stocke ton <strong style={{color:G.accent}}>pseudo, scores et préférences</strong> localement</li>
                  <li style={{marginBottom:6}}>Pas de pub trackée, aucune donnée revendue</li>
                  <li>Tu peux supprimer ton compte à tout moment dans les paramètres</li>
                </ul>
              </>
            )}
          </div>
          <div style={{display:"flex",gap:8,fontSize:11,color:"rgba(255,255,255,.4)",marginBottom:18,justifyContent:"center"}}>
            <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{color:"rgba(255,255,255,.5)",textDecoration:"underline"}}>{lang==="en" ? "Privacy Policy" : "Politique de confidentialité"}</a>
            <span>·</span>
            <a href="/terms" target="_blank" rel="noopener noreferrer" style={{color:"rgba(255,255,255,.5)",textDecoration:"underline"}}>{lang==="en" ? "Terms" : "CGU"}</a>
          </div>
          <button onClick={closeWelcome} style={{width:"100%",padding:"14px",background:G.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800}}>
            {lang==="en" ? "Got it 🐐" : "J'ai compris 🐐"}
          </button>
        </div>
      </div>
    );
  })() : null;


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
          <div style={{fontSize:12,color:"rgba(255,255,255,.4)",marginTop:8,letterSpacing:2}}>{lang==="en"?"CHOOSE YOUR USERNAME":"CHOISIS TON PSEUDO"}</div>
        </div>
        <input
          value={pseudoInput}
          onChange={function(e){setPseudoInput(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g,""));setPseudoMsg("");}}
          onKeyDown={function(e){if(e.key==="Enter")checkAndSavePseudo(pseudoInput);}}
          placeholder={lang==="en"?"Your unique username...":"Ton pseudo unique..."}
          maxLength={12}
          autoFocus
          style={{width:"100%",background:"rgba(255,255,255,.06)",border:"1.5px solid rgba(255,255,255,.15)",borderRadius:14,padding:"14px 16px",fontFamily:G.font,fontSize:17,color:G.white,outline:"none",boxSizing:"border-box",marginBottom:8,textAlign:"center"}}
        />
        {pseudoMsg && <div style={{fontSize:13,fontWeight:700,color:pseudoMsg.startsWith("❌")?"#FF3D57":"#00E676",marginBottom:8,textAlign:"center"}}>{pseudoMsg}</div>}
        <div style={{fontSize:11,color:"rgba(255,255,255,.2)",marginBottom:16,textAlign:"center"}}>{lang==="en"?"3–12 characters · letters, digits, _ and . · no spaces":"3–12 caractères · lettres, chiffres, _ et . · pas d'espaces"}</div>
        <button
          onClick={function(){checkAndSavePseudo(pseudoInput);}}
          disabled={pseudoChecking||pseudoInput.trim().length<3}
          style={{width:"100%",padding:"15px",background:pseudoInput.trim().length>=3?G.accent:"rgba(255,255,255,.08)",color:pseudoInput.trim().length>=3?"#000":"rgba(255,255,255,.3)",border:"none",borderRadius:50,cursor:pseudoInput.trim().length>=3?"pointer":"not-allowed",fontFamily:G.font,fontSize:15,fontWeight:800}}
        >
          {pseudoChecking?(lang==="en"?"Checking...":"Vérification..."):(lang==="en"?"Confirm →":"Confirmer →")}
        </button>
        {/* Séparateur + bouton récupération de compte */}
        <div style={{display:"flex",alignItems:"center",margin:"18px 0 12px",gap:10}}>
          <div style={{flex:1,height:1,background:"rgba(255,255,255,.1)"}}/>
          <span style={{fontSize:10,color:"rgba(255,255,255,.3)",letterSpacing:1}}>{lang==="en"?"OR":"OU"}</span>
          <div style={{flex:1,height:1,background:"rgba(255,255,255,.1)"}}/>
        </div>
        <button
          onClick={function(){setShowRecoveryInput(true);setRecoveryInput("");setRecoveryMsg("");}}
          style={{width:"100%",padding:"13px",background:"rgba(255,255,255,.06)",color:"rgba(255,255,255,.85)",border:"1.5px solid rgba(255,255,255,.15)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}
        >
          🔐 {lang==="en"?"I already have an account":"J'ai déjà un compte"}
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
          <div style={{fontFamily:G.heading,fontSize:24,color:G.white,lineHeight:1.1,marginBottom:6}}>{lang==="en"?"Your recovery code":"Ton code de récupération"}</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,.55)"}}>{lang==="en"?"Save it to access your account from another device":"Sauvegarde-le pour retrouver ton compte sur un autre appareil"}</div>
        </div>
        <div style={{background:G.accent,borderRadius:14,padding:"22px 16px",textAlign:"center",marginBottom:16,boxShadow:"0 4px 20px rgba(0,230,118,.25)"}}>
          <div style={{fontFamily:"ui-monospace, Menlo, monospace",fontSize:22,fontWeight:800,color:"#000",letterSpacing:2,userSelect:"all"}}>{showRecoveryCodeModal.code}</div>
        </div>
        <button
          onClick={async function(){
            try { await navigator.clipboard.writeText(showRecoveryCodeModal.code); setPseudoMsg(lang==="en"?"✓ Copied!":"✓ Copié !"); } catch {}
          }}
          style={{width:"100%",padding:"11px",background:"rgba(255,255,255,.06)",color:G.white,border:"1px solid rgba(255,255,255,.15)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:700,marginBottom:14}}
        >
          📋 {lang==="en"?"Copy":"Copier"}
        </button>
        <div style={{background:"rgba(255,214,0,.08)",border:"1px solid rgba(255,214,0,.3)",borderRadius:12,padding:"11px 14px",marginBottom:16}}>
          <div style={{fontSize:12,color:"rgba(255,214,0,.95)",lineHeight:1.5}}>⚠️ {lang==="en"?"Without this code, you won't be able to recover your account if you change phone.":"Sans ce code, tu ne pourras pas récupérer ton compte si tu changes de téléphone."}</div>
        </div>
        <label style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:16,cursor:"pointer"}}>
          <input type="checkbox" checked={recoveryConfirmed} onChange={function(e){setRecoveryConfirmed(e.target.checked);}} style={{marginTop:2,cursor:"pointer"}}/>
          <span style={{fontSize:13,color:"rgba(255,255,255,.85)",lineHeight:1.4}}>{lang==="en"?"I've saved my code somewhere safe":"J'ai bien noté mon code en lieu sûr"}</span>
        </label>
        <button
          onClick={function(){setShowRecoveryCodeModal(null);setRecoveryConfirmed(false);}}
          disabled={!recoveryConfirmed}
          style={{width:"100%",padding:"15px",background:recoveryConfirmed?G.accent:"rgba(255,255,255,.06)",color:recoveryConfirmed?"#000":"rgba(255,255,255,.3)",border:"none",borderRadius:50,cursor:recoveryConfirmed?"pointer":"not-allowed",fontFamily:G.font,fontSize:15,fontWeight:800}}
        >
          {lang==="en"?"OK, I've saved it":"OK, c'est noté"}
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
          <div style={{fontFamily:G.heading,fontSize:22,color:G.white,lineHeight:1.1,marginBottom:6}}>{lang==="en"?"Recover my account":"Récupérer mon compte"}</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,.55)"}}>{lang==="en"?"Enter the code you saved":"Entre le code que tu as sauvegardé"}</div>
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
          {recoveryLoading?(lang==="en"?"Recovering...":"Récupération..."):(lang==="en"?"Recover →":"Récupérer →")}
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
          <div style={{fontFamily:G.heading,fontSize:22,color:G.white,lineHeight:1.1,marginBottom:6}}>{lang==="en"?"My recovery code":"Mon code de récupération"}</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,.55)"}}>{lang==="en"?"Use it to access your account from another device":"Utilise-le pour retrouver ton compte sur un autre appareil"}</div>
        </div>
        <div style={{background:G.accent,borderRadius:14,padding:"22px 16px",textAlign:"center",marginBottom:14,boxShadow:"0 4px 20px rgba(0,230,118,.25)"}}>
          <div style={{fontFamily:"ui-monospace, Menlo, monospace",fontSize:recoveryCode?22:14,fontWeight:800,color:"#000",letterSpacing:recoveryCode?2:0,userSelect:"all"}}>
            {recoveryCode || (lang==="en"?"Loading...":"Chargement...")}
          </div>
        </div>
        {recoveryCode ? (
          <button
            onClick={async function(){
              try { await navigator.clipboard.writeText(recoveryCode); } catch {}
            }}
            style={{width:"100%",padding:"12px",background:"rgba(255,255,255,.06)",color:G.white,border:"1px solid rgba(255,255,255,.15)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:700}}
          >
            📋 {lang==="en"?"Copy":"Copier"}
          </button>
        ) : (
          <div style={{fontSize:12,color:"rgba(255,255,255,.5)",textAlign:"center",lineHeight:1.5}}>
            {lang==="en"?"Generating your code...":"Génération de ton code en cours..."}
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
            <div style={{fontSize:14,color:"rgba(255,255,255,.5)",letterSpacing:3,textTransform:"uppercase",marginBottom:16}}>{lang==="en"?"Opponent found!":"Adversaire trouvé !"}</div>
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
            {isReady ? (lang==="en"?"READY!":"PRÊT !") : (lang==="en"?"WAITING...":"EN ATTENTE...")}
          </div>
          <div style={{fontSize:14,color:"rgba(255,255,255,.5)",marginBottom:32}}>
            {isReady ? (lang==="en"?"Game about to start!":"La partie va commencer !") : (lang==="en"?"Waiting for "+oppName+"...":"En attente de "+oppName+"...")}
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
    const L_msg = RESULT_MESSAGES[lang==="en"?"en":"fr"];
    const oppNameRoom = (winner && winner.id !== playerId) ? winner.name : "";
    const iAbandoned = duelResult.myAbandoned === true;
    let msg;
    if (iAbandoned) {
      // J'ai abandonné → message spécifique
      msg = lang==="en" ? "You didn't even finish the match 😂" : "T'as même pas eu le courage d'aller au bout 😂";
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
          {[0,1,2,3,4,5,6].map(function(i){return(<div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>);})}
          <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
          <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
        </div>
        <div style={{zIndex:1,padding:"32px 20px 12px",textAlign:"center"}}>
          <div style={{fontSize:52,marginBottom:8}}>{iAbandoned?"🏳️":(myRank<=3?medals[myRank-1]:myRank+"ème")}</div>
          <div style={{fontFamily:G.heading,fontSize:"clamp(30px,8vw,50px)",color:iAbandoned?"#FF3D57":(myRank===1?G.gold:G.white),letterSpacing:2}}>
            {iAbandoned?(lang==="en"?"FORFEIT":"ABANDON"):(myRank===1?(lang==="en"?"VICTORY!":"VICTOIRE !"):myRank===2?(lang==="en"?"2ND PLACE":"2ÈME PLACE"):myRank===3?(lang==="en"?"3RD PLACE":"3ÈME PLACE"):(lang==="en"?"RESULTS":"RÉSULTATS"))}
          </div>
          <div style={{fontSize:18,color:iAbandoned?"#fff":(myRank===1?G.gold:"#fff"),marginTop:12,fontWeight:800,padding:"0 16px",lineHeight:1.4,textAlign:"center",animation:"popIn .6s cubic-bezier(.22,1,.36,1) .4s both",textShadow:myRank===1&&!iAbandoned?"0 0 20px rgba(255,214,0,.4)":"none"}}>{msg}</div>
          {!iAbandoned && resultImg && <img src={resultImg} style={{width:"60%",maxWidth:220,margin:"8px auto",display:"block",objectFit:"contain"}} />}
        </div>
        <div style={{...sheet,borderRadius:"28px 28px 0 0"}}>
          {duelResult.players.map(function(p,i){
            const hasRounds = Array.isArray(p.rounds) && p.rounds.length > 0;
            const onClickHandler = hasRounds ? function(){
              setReviewRoundsModal({
                mode: duelResult.mode || "pont",
                playerName: p.name + (p.id===playerId ? (lang==="en"?" (you)":" (toi)") : ""),
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
              👁️ {lang==="en"?"Tap a player to see their answers":"Tape sur un joueur pour voir ses réponses"}
            </div>
          )}
          {((!duelResult.isChain && roundAnswers.length>0) || (duelResult.isChain && chainHistory.length>0)) && (
            <button onClick={()=>setShowHistory(true)} style={{width:"100%",padding:"13px",background:"rgba(251,226,22,.12)",color:"#FBE216",border:"1.5px solid rgba(251,226,22,.5)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:8}}>
              📋 {duelResult.isChain?(lang==="en"?"See my chain":"Voir ma chaîne"):(lang==="en"?"Questions recap":"Récap des questions")}
            </button>
          )}
          {/* Bouton Relancer (host uniquement) */}
          {duelResult.hostId && duelResult.hostId === playerId && (
            <button onClick={restartRoom} style={{width:"100%",padding:"14px",background:"linear-gradient(135deg,#00E676,#00B85F)",color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:900,marginTop:8,letterSpacing:1}}>
              🔄 {lang==="en"?"REMATCH":"RELANCER"}
            </button>
          )}
          {duelResult.hostId && duelResult.hostId !== playerId && duelResult.isRoom && (
            <div style={{textAlign:"center",fontSize:11,color:"rgba(255,255,255,.5)",marginTop:8,fontStyle:"italic"}}>
              {lang==="en"?"Waiting for the host to rematch...":"En attente d'une revanche..."}
            </div>
          )}
          <button onClick={function(){setDuelResult(null);setScreen("home");}} style={{width:"100%",padding:"16px",background:G.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800,marginTop:8}}>
            {lang==="en"?"Back home":"Retour à l'accueil"}
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
          {[0,1,2,3,4,5,6].map(function(i){return(<div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(i/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>);})}
          <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
          <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
        </div>
        <div style={{textAlign:"center",zIndex:1,padding:"0 32px"}}>
          {waitingAfterAbandon ? (
            <>
              <div style={{fontSize:64,marginBottom:20}}>🏳️</div>
              <div style={{fontFamily:G.heading,fontSize:36,color:"#FF3D57",marginBottom:16,letterSpacing:2}}>{lang==="en"?"FORFEIT":"ABANDON"}</div>
              <div style={{fontSize:17,color:G.white,fontWeight:800,marginBottom:28,lineHeight:1.4,padding:"0 8px"}}>{
                abandonedAfterOppLeft
                  ? (lang==="en" ? "No match, no drama. Come back anytime 🤝" : "Pas de match, pas de drame. Reviens quand tu veux 🤝")
                  : (lang==="en" ? "You didn't even finish 😂" : "T'as même pas eu le courage d'aller au bout 😂")
              }</div>
              <button onClick={function(){
                clearInterval(roomPollRef.current);
                setWaitingForRoom(false);
                setWaitingAfterAbandon(false);
                setAbandonedAfterOppLeft(false);
                setDuelResult(null);
                setScreen("home");
              }} style={{width:"100%",maxWidth:280,padding:"16px",background:G.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800}}>{lang==="en"?"Back home":"Retour à l'accueil"}</button>
            </>
          ) : (
            <>
              <div style={{fontSize:56,marginBottom:20}}>⏳</div>
              <div style={{fontFamily:G.heading,fontSize:30,color:G.white,marginBottom:12,letterSpacing:1}}>{lang==="en"?"GAME OVER!":"PARTIE TERMINÉE !"}</div>
              <div style={{fontSize:16,color:G.accent,fontWeight:800,marginBottom:10}}>{lang==="en"?"You finished your game 💪":"Tu as fini ta partie 💪"}</div>
              <div style={{fontSize:14,color:"rgba(255,255,255,.6)",lineHeight:1.7,marginBottom:8}}>{lang==="en"?"The other players are still playing.":"Les autres joueurs sont encore en train de jouer."}</div>
              <div style={{fontSize:14,color:"rgba(255,255,255,.9)",fontWeight:700,lineHeight:1.7,marginBottom:24,background:"rgba(255,255,255,.07)",borderRadius:14,padding:"12px 16px"}}>{lang==="en"?"👉 Stay on this screen — results will appear automatically as soon as everyone is done.":"👉 Reste sur cet écran — les résultats apparaîtront automatiquement dès que tout le monde aura terminé."}</div>
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
            <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>
          );})}
          <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.7)"}}/>
        </div>
        <div style={{zIndex:50,padding:"max(16px, env(safe-area-inset-top)) 16px 8px",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,background:"rgba(0,15,0,.92)",backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)"}}>
          <button onClick={()=>{setViewedProfile(null);setFriendMsg("");setScreen("home");}} style={{background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.15)",borderRadius:"50%",width:40,height:40,cursor:"pointer",color:G.white,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 4px 14px rgba(0,0,0,.4)"}}>←</button>
          <div style={{fontFamily:G.heading,fontSize:22,color:G.white,letterSpacing:2,flex:1}}>{lang==="en"?"PROFILE":"PROFIL"}</div>
        </div>
        {!d ? (
          <div style={{zIndex:1,padding:"60px 20px",textAlign:"center",color:"rgba(255,255,255,.5)"}}>{lang==="en"?"Loading...":"Chargement..."}</div>
        ) : (
          <>
            <div style={{zIndex:1,padding:"16px 20px 8px",textAlign:"center"}}>
              <div style={{width:100,height:100,borderRadius:"50%",margin:"0 auto 14px",background:"linear-gradient(135deg,#00E676,#00A855)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:44,color:"#fff",boxShadow:"0 8px 30px rgba(0,230,118,.35)",overflow:"hidden",position:"relative"}}>
                <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:56}}>{grade?grade.emoji:"🐣"}</div>
                {d.avatar && <img src={d.avatar} alt="avatar" onClick={()=>setViewingAvatar(d.avatar)} onError={(e)=>{e.currentTarget.style.display="none";}} style={{width:"100%",height:"100%",objectFit:"cover",position:"relative",zIndex:1,cursor:"pointer"}}/>}
              </div>
              <div style={{fontFamily:G.heading,fontSize:28,color:G.white,letterSpacing:1}}>@{viewedProfile.name}</div>
              {grade && (
                <div style={{marginTop:6,display:"inline-block",fontSize:11,fontWeight:800,color:grade.color,background:grade.color+"22",borderRadius:20,padding:"3px 12px",letterSpacing:1}}>{grade.emoji} {grade.label}</div>
              )}
              {d.rank && (
                <div style={{marginTop:8,fontSize:13,color:"rgba(255,255,255,.6)"}}>{lang==="en"?"Rank: #":"Classement: #"}{d.rank}</div>
              )}
            </div>
            <div style={{zIndex:1,padding:"8px 16px",display:"flex",gap:10}}>
              {!d.isFriend ? (
                d.requestSent ? (
                  <button disabled style={{flex:1,padding:"13px",background:"rgba(255,255,255,.07)",color:"rgba(255,255,255,.5)",border:"1px solid rgba(255,255,255,.15)",borderRadius:50,cursor:"default",fontFamily:G.font,fontSize:14,fontWeight:700}}>{lang==="en"?"✓ Request sent":"✓ Demande envoyée"}</button>
                ) : (
                  <button onClick={()=>{requirePseudo(function(){addFriend(viewedProfile.name);});}} style={{flex:1,padding:"13px",background:G.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800}}>{lang==="en"?"+ Add friend":"+ Ajouter en ami"}</button>
                )
              ) : (
                <button onClick={()=>{setConfirmRemove({id:viewedProfile.id,name:viewedProfile.name});}} style={{flex:1,padding:"13px",background:"rgba(255,255,255,.07)",color:"rgba(255,255,255,.7)",border:"1px solid rgba(255,255,255,.15)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>{lang==="en"?"✓ Friend · Remove":"✓ Ami · Retirer"}</button>
              )}
              <button onClick={()=>requirePseudo(function(){setShowDuelCreate({id:viewedProfile.id,name:viewedProfile.name});})} style={{flex:1,padding:"13px",background:"linear-gradient(135deg,#FFD600,#FF6B35)",color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800}}>{lang==="en"?"⚡ Challenge":"⚡ Défier"}</button>
            </div>
            {friendMsg && !d.isFriend && (
              <div style={{zIndex:1,padding:"0 16px 8px",fontSize:12,color:friendMsg.indexOf("✓")>=0?G.accent:friendMsg.indexOf("❌")>=0?G.red:"rgba(255,255,255,.7)",textAlign:"center",fontWeight:700}}>{friendMsg}</div>
            )}
            <div style={{zIndex:1,padding:"16px 16px 8px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div style={{background:G.accent,borderRadius:16,padding:"14px 10px",textAlign:"center",boxShadow:"0 4px 16px rgba(0,230,118,.35)"}}>
                <div style={{fontSize:22,marginBottom:4}}>🏆</div>
                <div style={{fontSize:10,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:"rgba(0,0,0,.75)",marginBottom:4}}>{lang==="en"?"Plug record":"Record Plug"}</div>
                <div style={{fontFamily:G.heading,fontSize:26,color:"#000"}}>{d.bestPont||0}</div>
              </div>
              <div style={{background:G.accent,borderRadius:16,padding:"14px 10px",textAlign:"center",boxShadow:"0 4px 16px rgba(0,230,118,.35)"}}>
                <div style={{fontSize:22,marginBottom:4}}>⛓</div>
                <div style={{fontSize:10,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:"rgba(0,0,0,.75)",marginBottom:4}}>{lang==="en"?"Mercato record":"Record Mercato"}</div>
                <div style={{fontFamily:G.heading,fontSize:26,color:"#000"}}>{d.bestChaine||0}</div>
              </div>
              <div style={{background:G.accent,borderRadius:16,padding:"14px 10px",textAlign:"center",boxShadow:"0 4px 16px rgba(0,230,118,.35)"}}>
                <div style={{fontSize:22,marginBottom:4}}>🎮</div>
                <div style={{fontSize:10,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:"rgba(0,0,0,.75)",marginBottom:4}}>{lang==="en"?"Games":"Parties"}</div>
                <div style={{fontFamily:G.heading,fontSize:26,color:"#000"}}>{d.played||0}</div>
              </div>
              <div style={{background:G.accent,borderRadius:16,padding:"14px 10px",textAlign:"center",boxShadow:"0 4px 16px rgba(0,230,118,.35)"}}>
                <div style={{fontSize:22,marginBottom:4}}>⭐</div>
                <div style={{fontSize:10,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:"rgba(0,0,0,.75)",marginBottom:4}}>{lang==="en"?"Total Score":"Score Total"}</div>
                <div style={{fontFamily:G.heading,fontSize:26,color:"#000"}}>{d.score||0}</div>
              </div>
            </div>
            <div style={{zIndex:1,padding:"8px 16px"}}>
              <div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:14,padding:"10px",display:"flex"}}>
                <div style={{flex:1,textAlign:"center",borderRight:"1px solid rgba(255,255,255,.06)"}}>
                  <div style={{fontFamily:G.heading,fontSize:20,color:"#00E676"}}>{d.wins||0}</div>
                  <div style={{fontSize:9,color:"rgba(255,255,255,.4)",letterSpacing:1,textTransform:"uppercase"}}>{lang==="en"?"Wins":"Victoires"}</div>
                </div>
                <div style={{flex:1,textAlign:"center",borderRight:"1px solid rgba(255,255,255,.06)"}}>
                  <div style={{fontFamily:G.heading,fontSize:20,color:G.gold}}>{d.draws||0}</div>
                  <div style={{fontSize:9,color:"rgba(255,255,255,.4)",letterSpacing:1,textTransform:"uppercase"}}>{lang==="en"?"Draws":"Nuls"}</div>
                </div>
                <div style={{flex:1,textAlign:"center"}}>
                  <div style={{fontFamily:G.heading,fontSize:20,color:"#FF3D57"}}>{d.losses||0}</div>
                  <div style={{fontSize:9,color:"rgba(255,255,255,.4)",letterSpacing:1,textTransform:"uppercase"}}>{lang==="en"?"Losses":"Défaites"}</div>
                </div>
              </div>
            </div>
            {d.duelsWith.length > 0 ? (
              <div style={{zIndex:1,padding:"16px 16px 8px"}}>
                <div style={{fontSize:11,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.5)",marginBottom:10}}>{lang==="en"?"Your duels (":"Vos duels ("}{d.duelsWith.length}{lang==="en"?")":")"}</div>
                <div style={{background:"rgba(255,255,255,.03)",borderRadius:14,padding:"10px",marginBottom:8,display:"flex",justifyContent:"space-around",border:"1px solid rgba(255,255,255,.06)"}}>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontFamily:G.heading,fontSize:18,color:"#00E676"}}>{d.myWins}</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,.4)",letterSpacing:1,textTransform:"uppercase"}}>{lang==="en"?"Your wins":"Tes victoires"}</div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontFamily:G.heading,fontSize:18,color:G.gold}}>{d.duelsDraws}</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,.4)",letterSpacing:1,textTransform:"uppercase"}}>{lang==="en"?"Draws":"Nuls"}</div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontFamily:G.heading,fontSize:18,color:"#FF3D57"}}>{d.myLosses}</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,.4)",letterSpacing:1,textTransform:"uppercase"}}>{lang==="en"?"Their wins":"Ses victoires"}</div>
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {d.duelsWith.slice(0,10).map((duel, i) => {
                    const isChal = duel.challenger_id === playerId;
                    const myScore = isChal ? duel.challenger_score : duel.opponent_score;
                    const oppScore = isChal ? duel.opponent_score : duel.challenger_score;
                    const won = myScore > oppScore;
                    const draw = myScore === oppScore;
                    return (
                      <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"rgba(255,255,255,.03)",borderRadius:12,border:"1px solid rgba(255,255,255,.05)"}}>
                        <div style={{width:4,height:28,borderRadius:2,background:draw?"#FFD600":won?"#00E676":"#FF3D57"}}/>
                        <div style={{flex:1}}>
                          <div style={{fontSize:12,fontWeight:700,color:G.white}}>{draw?(lang==="en"?"Draw":"Match nul"):won?(lang==="en"?"Win":"Victoire"):(lang==="en"?"Loss":"Défaite")}</div>
                          <div style={{fontSize:10,color:"rgba(255,255,255,.4)"}}>{duel.mode==="pont"?"The Plug":"The Mercato"} · {duel.diff}</div>
                        </div>
                        <div style={{fontFamily:G.heading,fontSize:16,color:G.white}}>{myScore}–{oppScore}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{zIndex:1,padding:"20px 16px",textAlign:"center",color:"rgba(255,255,255,.4)",fontSize:13}}>{lang==="en"?"No duels played against this player yet":"Aucun duel encore joué contre ce joueur"}</div>
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
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>
        );})}
        <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.7)"}}/>
      </div>

      {/* Header */}
      <div style={{zIndex:2,padding:"16px 16px 8px",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,background:"rgba(0,15,0,.85)",backdropFilter:"blur(10px)"}}>
        <button onClick={()=>setScreen("home")} style={{background:"rgba(255,255,255,.1)",border:"none",borderRadius:"50%",width:38,height:38,cursor:"pointer",color:G.white,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>←</button>
        <div style={{fontFamily:G.heading,fontSize:22,color:G.white,letterSpacing:2,flex:1}}>{lang==="en"?"MY PROFILE":"MON PROFIL"}</div>
      </div>

      {/* Avatar + Pseudo */}
      <div style={{zIndex:1,padding:"16px 20px 8px",textAlign:"center"}}>
        <div style={{display:"inline-block",width:100,height:100,margin:"0 auto 14px",position:"relative"}}>
          <div onClick={playerAvatar ? ()=>setViewingAvatar(playerAvatar) : ()=>{const el=document.getElementById("avatar-upload");if(el)el.click();}} style={{width:100,height:100,borderRadius:"50%",background:playerAvatar?"#000":"linear-gradient(135deg,#00E676,#00A855)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:56,color:"#fff",boxShadow:"0 8px 30px rgba(0,230,118,.35)",overflow:"hidden",cursor:"pointer"}}>
            {playerAvatar ? <img src={playerAvatar} alt="avatar" style={{width:"100%",height:"100%",objectFit:"cover"}}/> : getGrade(playerXp).emoji}
          </div>
          <label htmlFor="avatar-upload" style={{position:"absolute",bottom:-2,right:-2,width:34,height:34,borderRadius:"50%",background:G.accent,border:"3px solid #0d1f0d",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,zIndex:2,cursor:"pointer"}}>{avatarUploading?"⏳":"📷"}</label>
        </div>
        <input id="avatar-upload" type="file" accept="image/*" style={{display:"none"}} onChange={(e)=>{
          const file = e.target.files?.[0];
          if (!file) return;
          if (file.size > 10*1024*1024) { alert(lang==="en"?"Image too large (max 10 MB)":"Image trop grande (max 10 Mo)"); e.target.value=""; return; }
          // Charge l'image en dataURL pour ouvrir le cropper
          const reader = new FileReader();
          reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
              // Initial scale: l'image "cover" le cadre (remplit complètement)
              const CROP_SIZE = 300; // taille virtuelle de référence, ajustée au display
              const initialScale = CROP_SIZE / Math.min(img.width, img.height);
              const displayedW = img.width * initialScale;
              const displayedH = img.height * initialScale;
              setCropState({
                url: ev.target.result,
                scale: initialScale,
                minScale: initialScale, // ne peut pas zoomer en-dessous (sinon fond vide)
                x: (CROP_SIZE - displayedW) / 2,
                y: (CROP_SIZE - displayedH) / 2,
                naturalW: img.width,
                naturalH: img.height,
                cropSize: CROP_SIZE
              });
            };
            img.src = ev.target.result;
          };
          reader.readAsDataURL(file);
          e.target.value = "";
        }}/>
        <div style={{fontFamily:G.heading,fontSize:28,color:G.white,letterSpacing:1}}>@{playerName||(lang==="en"?"anonymous":"anonyme")}</div>
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
            <div style={{background:"#123a1e",border:"1.5px solid "+grade.color+"55",borderRadius:16,padding:"14px 16px"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:28}}>{grade.emoji}</span>
                  <div>
                    <div style={{fontSize:10,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.5)"}}>{lang==="en"?"Level":"Niveau"}</div>
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
                    <div style={{height:"100%",width:progressPct+"%",background:`linear-gradient(90deg, ${grade.color}, ${nextGrade.color})`,borderRadius:4,transition:"width .5s ease"}}/>
                  </div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,.5)",textAlign:"center"}}>
                    {lang==="en"
                      ? `${(nextGrade.min - playerXp).toLocaleString()} XP to ${nextGrade.labelEn} ${nextGrade.emoji}`
                      : `${(nextGrade.min - playerXp).toLocaleString()} XP avant ${nextGrade.label} ${nextGrade.emoji}`}
                  </div>
                </>
              ) : (
                <div style={{fontSize:11,color:grade.color,textAlign:"center",fontWeight:800,letterSpacing:1,textTransform:"uppercase"}}>🏆 {lang==="en"?"Max level reached":"Niveau max atteint"}</div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Stats cards */}
      <div style={{zIndex:1,padding:"16px 16px 8px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {/* Record Plug */}
        <div style={{background:G.accent,borderRadius:20,padding:"18px 14px",textAlign:"center",boxShadow:"0 4px 16px rgba(0,230,118,.35)"}}>
          <div style={{fontSize:32,marginBottom:8}}>🏆</div>
          <div style={{fontSize:11,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:"rgba(0,0,0,.75)",marginBottom:8}}>{lang==="en"?"Plug record":"Record Plug"}</div>
          <div style={{fontFamily:G.heading,fontSize:40,color:"#000",lineHeight:1}}>{record?record.score:0}</div>
        </div>
        {/* Record Mercato */}
        <div style={{background:G.accent,borderRadius:20,padding:"18px 14px",textAlign:"center",boxShadow:"0 4px 16px rgba(0,230,118,.35)"}}>
          <div style={{fontSize:32,marginBottom:8}}>⛓️</div>
          <div style={{fontSize:11,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:"rgba(0,0,0,.75)",marginBottom:8}}>{lang==="en"?"Mercato record":"Record Mercato"}</div>
          <div style={{fontFamily:G.heading,fontSize:40,color:"#000",lineHeight:1}}>{chainRecord?chainRecord.score:0}</div>
        </div>
        {/* Amis */}
        <div style={{background:G.accent,borderRadius:20,padding:"18px 14px",textAlign:"center",boxShadow:"0 4px 16px rgba(0,230,118,.35)"}}>
          <div style={{fontSize:32,marginBottom:8}}>👥</div>
          <div style={{fontSize:11,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:"rgba(0,0,0,.75)",marginBottom:8}}>{lang==="en"?"Friends":"Amis"}</div>
          <div style={{fontFamily:G.heading,fontSize:40,color:"#000",lineHeight:1}}>{friendsList.length}</div>
        </div>
        {/* Parties */}
        <div style={{background:G.accent,borderRadius:20,padding:"18px 14px",textAlign:"center",boxShadow:"0 4px 16px rgba(0,230,118,.35)"}}>
          <div style={{fontSize:32,marginBottom:8}}>🎮</div>
          <div style={{fontSize:11,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:"rgba(0,0,0,.75)",marginBottom:8}}>{lang==="en"?"Games":"Parties"}</div>
          <div style={{fontFamily:G.heading,fontSize:40,color:"#000",lineHeight:1}}>{(record?1:0)+(chainRecord?1:0)}</div>
        </div>
      </div>

      {/* Actions */}
      <div style={{zIndex:1,padding:"8px 16px",display:"flex",flexDirection:"column",gap:10}}>
        {/* Mes amis */}
        <button onClick={()=>{setShowFriends(true);setScreen("home");}} style={{padding:"18px",background:G.accent,border:"none",borderRadius:18,cursor:"pointer",color:"#000",fontFamily:G.font,fontSize:17,fontWeight:800,display:"flex",alignItems:"center",gap:14,textAlign:"left",boxShadow:"0 4px 16px rgba(0,230,118,.35)"}}>
          <span style={{fontSize:26}}>👥</span>
          <div style={{flex:1}}>
            <div>{lang==="en"?"My friends":"Mes amis"}</div>
            <div style={{fontSize:12,color:"rgba(0,0,0,.65)",fontWeight:700,marginTop:3,letterSpacing:.3}}>{friendsList.length} {lang==="en"?(friendsList.length>1?"friends":"friend"):(friendsList.length>1?"amis":"ami")}</div>
          </div>
          <span style={{fontSize:22,color:"rgba(0,0,0,.7)"}}>→</span>
        </button>

        {/* Classement */}
        <button onClick={()=>{setLbMode("pont");setLbDiff("facile");loadLeaderboard("pont");setShowLeaderboard(true);setScreen("home");}} style={{padding:"18px",background:G.accent,border:"none",borderRadius:18,cursor:"pointer",color:"#000",fontFamily:G.font,fontSize:17,fontWeight:800,display:"flex",alignItems:"center",gap:14,textAlign:"left",boxShadow:"0 4px 16px rgba(0,230,118,.35)"}}>
          <span style={{fontSize:26}}>🏆</span>
          <div style={{flex:1}}>
            <div>{lang==="en"?"Leaderboard":"Classement"}</div>
            <div style={{fontSize:12,color:"rgba(0,0,0,.65)",fontWeight:700,marginTop:3,letterSpacing:.3}}>{lang==="en"?"See your world rank":"Vois ton rang mondial"}</div>
          </div>
          <span style={{fontSize:22,color:"rgba(0,0,0,.7)"}}>→</span>
        </button>

        {/* Comment jouer */}
        <button onClick={()=>{setShowTutorial(true);setTutorialStep(0);}} style={{padding:"18px",background:G.accent,border:"none",borderRadius:18,cursor:"pointer",color:"#000",fontFamily:G.font,fontSize:17,fontWeight:800,display:"flex",alignItems:"center",gap:14,textAlign:"left",boxShadow:"0 4px 16px rgba(0,230,118,.35)"}}>
          <span style={{fontSize:26}}>❓</span>
          <div style={{flex:1}}>
            <div>{lang==="en"?"How to play?":"Comment jouer ?"}</div>
            <div style={{fontSize:12,color:"rgba(0,0,0,.65)",fontWeight:700,marginTop:3,letterSpacing:.3}}>{lang==="en"?"See the tutorial again":"Revoir le tutoriel"}</div>
          </div>
          <span style={{fontSize:22,color:"rgba(0,0,0,.7)"}}>→</span>
        </button>

        {/* Code de récupération */}
        <button onClick={async function(){
          setShowMyRecoveryCode(true);
          // Si pas de code en state, fetch depuis la DB
          if (!recoveryCode && playerId) {
            try {
              const mine = await sbFetch("bb_pseudos?player_id=eq."+playerId+"&select=recovery_code&limit=1");
              if (Array.isArray(mine) && mine.length > 0 && mine[0].recovery_code) {
                setRecoveryCode(mine[0].recovery_code);
                try { localStorage.setItem("bb_recovery_code", mine[0].recovery_code); } catch {}
              } else {
                // Pas de code en DB : en générer un et le sauver
                const newCode = generateRecoveryCode();
                await sbFetch("bb_pseudos?player_id=eq."+playerId, {
                  method: "PATCH",
                  body: JSON.stringify({recovery_code: newCode}),
                  headers: {"Prefer": "return=minimal"}
                });
                setRecoveryCode(newCode);
                try { localStorage.setItem("bb_recovery_code", newCode); } catch {}
              }
            } catch(e) {}
          }
        }} style={{padding:"18px",background:G.accent,border:"none",borderRadius:18,cursor:"pointer",color:"#000",fontFamily:G.font,fontSize:17,fontWeight:800,display:"flex",alignItems:"center",gap:14,textAlign:"left",boxShadow:"0 4px 16px rgba(0,230,118,.35)"}}>
          <span style={{fontSize:26}}>🔐</span>
          <div style={{flex:1}}>
            <div>{lang==="en"?"My recovery code":"Mon code de récupération"}</div>
            <div style={{fontSize:12,color:"rgba(0,0,0,.65)",fontWeight:700,marginTop:3,letterSpacing:.3}}>{lang==="en"?"To use your account on another device":"Pour retrouver ton compte sur un autre appareil"}</div>
          </div>
          <span style={{fontSize:22,color:"rgba(0,0,0,.7)"}}>→</span>
        </button>

        {/* Langue */}
        <div style={{padding:"18px",background:G.accent,border:"none",borderRadius:18,color:"#000",fontFamily:G.font,fontSize:17,fontWeight:800,display:"flex",alignItems:"center",gap:14,boxShadow:"0 4px 16px rgba(0,230,118,.35)"}}>
          <span style={{fontSize:26}}>🌐</span>
          <div style={{flex:1}}>
            <div>{lang==="en"?"Language":"Langue"}</div>
            <div style={{fontSize:12,color:"rgba(0,0,0,.65)",fontWeight:700,marginTop:3,letterSpacing:.3}}>{lang==="en"?"Choose your language":"Choisis ta langue"}</div>
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>setLanguage("fr")} style={{padding:"7px 13px",background:lang==="fr"?"#000":"rgba(0,0,0,.15)",color:lang==="fr"?G.accent:"rgba(0,0,0,.7)",border:"none",borderRadius:20,cursor:"pointer",fontFamily:G.font,fontSize:12,fontWeight:800}}>🇫🇷 FR</button>
            <button onClick={()=>setLanguage("en")} style={{padding:"7px 13px",background:lang==="en"?"#000":"rgba(0,0,0,.15)",color:lang==="en"?G.accent:"rgba(0,0,0,.7)",border:"none",borderRadius:20,cursor:"pointer",fontFamily:G.font,fontSize:12,fontWeight:800}}>🇬🇧 EN</button>
          </div>
        </div>

        {/* Suggérer un joueur - subtil */}
        <button onClick={function(){
          const subject = encodeURIComponent(lang==="en" ? "[GOAT FC] Player suggestion" : "[GOAT FC] Suggestion de joueur");
          const body = encodeURIComponent(
            (lang==="en" 
              ? "Hi GOAT FC team,\n\nI'd like to suggest the following player(s) to be added to the database:\n\n"
              : "Salut l'équipe GOAT FC,\n\nJe souhaite suggérer le(s) joueur(s) suivant(s) à ajouter à la base :\n\n"
            ) + (lang==="en" ? "Player name(s): \n\nThanks!" : "Nom du/des joueur(s) : \n\nMerci !")
          );
          window.location.href = "mailto:contact@goatfc.online?subject="+subject+"&body="+body;
        }} style={{padding:"14px 18px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.12)",borderRadius:18,cursor:"pointer",color:"rgba(255,255,255,.7)",fontFamily:G.font,fontSize:14,fontWeight:700,display:"flex",alignItems:"center",gap:12,textAlign:"left",marginTop:6}}>
          <span style={{fontSize:18}}>💡</span>
          <div style={{flex:1}}>
            <div>{lang==="en"?"Suggest a player":"Suggérer un joueur"}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.45)",fontWeight:600,marginTop:2}}>{lang==="en"?"A missing player? Tell us!":"Un joueur manque ? Dis-le nous !"}</div>
          </div>
          <span style={{fontSize:18,color:"rgba(255,255,255,.4)"}}>→</span>
        </button>

        {/* Mon compte (paramètres + suppression) - subtil */}
        <button onClick={()=>setShowAccount(true)} style={{padding:"14px 18px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.12)",borderRadius:18,cursor:"pointer",color:"rgba(255,255,255,.7)",fontFamily:G.font,fontSize:14,fontWeight:700,display:"flex",alignItems:"center",gap:12,textAlign:"left",marginTop:6}}>
          <span style={{fontSize:18}}>⚙️</span>
          <div style={{flex:1}}>{lang==="en"?"My account":"Mon compte"}</div>
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
          {lang==="en"?"Install GOAT FC":"Installer GOAT FC"}
        </div>
        <div style={{fontSize:10,color:"rgba(255,255,255,.55)",marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
          {lang==="en"?"Get daily reminders & faster access":"Reçois les rappels et accède plus vite"}
        </div>
      </div>
      <span style={{fontSize:18,color:G.accent,flexShrink:0}}>→</span>
    </div>
  );

  if(screen==="home") return (
    <div style={{...shell,animation:"fadeUp .5s ease",overflow:isDesktop?"visible":"auto"}} key="home">
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
            <div style={{fontFamily:G.heading,fontSize:28,color:G.white,letterSpacing:2,marginBottom:6}}>{lang==="en"?"CREATE A ROOM":"CRÉER UNE SALLE"}</div>
            {/* Recap config */}
            <div style={{background:"rgba(255,255,255,.06)",borderRadius:16,padding:"14px 16px",marginBottom:20,border:"1px solid rgba(255,255,255,.08)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:800,color:G.white}}>{duelMode==="pont"?"The Plug":"The Mercato"}</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.4)"}}>{duelDiff==="facile"?"AMATEUR":duelDiff==="moyen"?"PRO":"CRESCENDO"} · {duelRounds} {lang==="en"?("round"+(duelRounds>1?"s":"")):("manche"+(duelRounds>1?"s":""))}</div>
                </div>
                <div style={{fontFamily:G.heading,fontSize:32,color:G.accent}}>2-8 👥</div>
              </div>
            </div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.35)",marginBottom:20,textAlign:"center"}}>
              {lang==="en"?"A code will be generated so your friends can join":"Un code sera généré pour que tes amis puissent rejoindre"}
            </div>
            {roomMsg && <div style={{fontSize:13,color:"#FF3D57",fontWeight:700,marginBottom:12,textAlign:"center"}}>{roomMsg}</div>}
            <div style={{display:"flex",gap:10}}>
              <button onClick={function(){setShowRoomCreate(false);}} style={{flex:1,padding:"15px",background:"rgba(255,255,255,.07)",color:"rgba(255,255,255,.5)",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14}}>{lang==="en"?"Cancel":"Annuler"}</button>
              <button onClick={createRoom} style={{flex:2,padding:"15px",background:G.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800}}>{lang==="en"?"Create room 🚀":"Créer la salle 🚀"}</button>
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
          <div style={{flex:1,display:"flex",alignItems:"center"}}>
            <div style={{display:"flex",background:"rgba(0,0,0,.3)",border:"1px solid rgba(255,255,255,.12)",borderRadius:12,padding:3}}>
              <button onClick={()=>setLanguage("fr")} style={{padding:"5px 9px",background:lang==="fr"?G.accent:"transparent",color:lang==="fr"?"#000":"rgba(255,255,255,.7)",border:"none",borderRadius:9,cursor:"pointer",fontFamily:G.font,fontSize:11,fontWeight:800}}>🇫🇷 FR</button>
              <button onClick={()=>setLanguage("en")} style={{padding:"5px 9px",background:lang==="en"?G.accent:"transparent",color:lang==="en"?"#000":"rgba(255,255,255,.7)",border:"none",borderRadius:9,cursor:"pointer",fontFamily:G.font,fontSize:11,fontWeight:800}}>🇬🇧 EN</button>
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
    const tier = dayStreak >= 100 ? "platine" : dayStreak >= 30 ? "mythic" : dayStreak >= 7 ? "gold" : dayStreak >= 3 ? "bronze" : "base";
    const tierStyles = {
      base:    { bg:"linear-gradient(135deg,rgba(255,107,53,.25),rgba(255,214,0,.15))", border:"rgba(255,107,53,.5)", color:"#FFD600", shadow:"0 2px 8px rgba(255,107,53,.2)", textColor:"#FFD600", emoji:"🔥" },
      bronze:  { bg:"linear-gradient(135deg,#D97706,#FBA94F)", border:"#FBA94F", color:"#000", shadow:"0 4px 14px rgba(217,119,6,.45)", textColor:"#000", emoji:"🔥" },
      gold:    { bg:"linear-gradient(135deg,#FF6B35,#FFD600)", border:"#FFD600", color:"#000", shadow:"0 4px 14px rgba(255,107,53,.45)", textColor:"#000", emoji:"🔥" },
      mythic:  { bg:"linear-gradient(135deg,#C084FC,#FFD600)", border:"#FFD600", color:"#000", shadow:"0 6px 18px rgba(192,132,252,.55)", textColor:"#000", emoji:"⚡" },
      platine: { bg:"linear-gradient(135deg,#E5E4E2,#B6B6B6,#FFFFFF)", border:"#FFFFFF", color:"#000", shadow:"0 6px 20px rgba(255,255,255,.55)", textColor:"#000", emoji:"💎" }
    };
    const t = streakInDanger ? { bg:"linear-gradient(135deg,#FF3D57,#FF6B35)", border:"#FF3D57", shadow:"0 4px 14px rgba(255,61,87,.55)", textColor:"#fff", emoji:"⚠️" } : tierStyles[tier];
    return (
      <div onClick={()=>setShowStreakDetail(true)} style={{
        display:"flex",alignItems:"center",gap:5,
        background:t.bg,
        border:`1.5px solid ${t.border}`,
        borderRadius:12,
        padding:"7px 11px",
        cursor:"pointer",
        boxShadow:t.shadow,
        animation: streakInDanger ? "dangerPulse 1.2s ease-in-out infinite" : streakJustIncreased ? "pulseStreak .6s ease-in-out 3" : (tier==="platine" || tier==="mythic" ? "flameGlow 2.5s ease-in-out infinite" : "none")
      }}>
        <span style={{fontSize:18,filter: tier==="gold" || tier==="mythic" ? "drop-shadow(0 0 6px #FFD60099)" : tier==="platine" ? "drop-shadow(0 0 6px #FFFFFFAA)" : "none"}}>{t.emoji}</span>
        <span style={{fontFamily:G.heading,fontSize:17,color:t.textColor,fontWeight:800,letterSpacing:.5}}>{dayStreak}</span>
      </div>
    );
  })()}
{!launchedFromLandingRef.current && (
<div onClick={function(){if(!pseudoConfirmed) setPseudoScreen(true); else setScreen("profile");}} style={{background:"linear-gradient(135deg,#00E676,#00A855)",border:"1px solid rgba(0,230,118,.4)",borderRadius:12,width:38,height:38,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",boxShadow:"0 4px 14px rgba(0,230,118,.25)",overflow:"hidden"}}>
  {playerAvatar ? <img src={playerAvatar} alt="avatar" style={{width:"100%",height:"100%",objectFit:"cover"}}/> : <span style={{fontSize:16,color:"#000",fontWeight:800}}>{(playerName||"?")[0].toUpperCase()}</span>}
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
            <div style={{fontSize:13,fontWeight:800,color:G.accent}}>🔗 {lang==="en"?"Room ":"Salle "}{pendingRoomCode}{lang==="en"?" pending":" en attente"}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginTop:2}}>{lang==="en"?"Create your username to join automatically":"Crée ton pseudo pour rejoindre automatiquement"}</div>
          </div>
        )}
        {/* Bannière installation app (iOS Safari / Android non installé) */}
        {installBanner}
        {/* Bandeau demandes d'amis */}
        {friendRequests.length > 0 && (
          <div style={{background:"#123a1e",border:"1px solid rgba(0,230,118,.5)",borderRadius:12,padding:"10px 14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:12,fontWeight:700,color:G.accent}}>👋 {friendRequests.length} {lang==="en"?(friendRequests.length>1?"friend requests":"friend request"):(friendRequests.length>1?"demandes d'ami":"demande d'ami")}</div>
              <button onClick={function(){setShowFriends(true);loadFriendRequests();}} style={{padding:"5px 12px",background:G.accent,color:"#000",border:"none",borderRadius:20,cursor:"pointer",fontFamily:G.font,fontSize:12,fontWeight:800}}>{lang==="en"?"View":"Voir"}</button>
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
                  <div style={{fontSize:12,fontWeight:700,color:G.gold}}>⚡ {lang==="en"?"Challenge from ":"Défi de "}{oppName}</div>
                  <button onClick={function(){joinDuel(d);}} style={{padding:"5px 12px",background:G.gold,color:"#000",border:"none",borderRadius:20,cursor:"pointer",fontFamily:G.font,fontSize:12,fontWeight:800}}>{lang==="en"?"Join":"Rejoindre"}</button>
                </div>
              );})}
          </div>
        )}

        {/* ── HOME CAROUSEL — 3 modes (GRID, MERCATO, PLUG) ── */}
        <div style={{flexShrink:0}}>
          <div
            style={{
              position:"relative",
              width:"min(280px, 75vw)",
              height:"clamp(340px, 82vw, 400px)",
              margin:"0 auto",
            }}
            onTouchStart={function(e){homeSwipeStartRef.current = e.touches[0].clientX;}}
            onTouchEnd={function(e){
              const startX = homeSwipeStartRef.current;
              if(startX==null) return;
              const endX = e.changedTouches[0].clientX;
              const delta = endX - startX;
              homeSwipeStartRef.current = null;
              if(Math.abs(delta) > 50){
                const newIdx = (homeCardIndex + (delta < 0 ? 1 : -1) + 4) % 4;
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
                const newIdx = (homeCardIndex + (delta < 0 ? 1 : -1) + 4) % 4;
                setHomeCardIndex(newIdx);
                localStorage.setItem("bb_home_card", String(newIdx));
              }
            }}
          >
            {[
              {key:"grid",    img:GRID_CARD_IMG,    onClick: function(){setGgModeChoice(true);},        record: chainRecord ? null : null, recordIcon:null, recordColor:"#00E676"},
              {key:"mercato", img:MERCATO_CARD_IMG, onClick: function(){setGameConfigModal("chaine");}, record: chainRecord, recordIcon:"⛓",  recordColor:"#60a5fa"},
              {key:"plug",    img:PLUG_CARD_IMG,    onClick: function(){setGameConfigModal("pont");},   record: record,      recordIcon:"🏆", recordColor:"#FFD600"},
              {key:"guess",   img:GUESS_CARD_IMG,   onClick: function(){window.dispatchEvent(new CustomEvent("goatfc:open-guess"));}, record: null, recordIcon:null, recordColor:"#C084FC"},
            ].map(function(card, i){
              const offset = (i - homeCardIndex + 4) % 4;
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
                  <img src={card.img} alt="" style={{width:"100%",height:"100%",objectFit:"cover",pointerEvents:"none",userSelect:"none"}} draggable={false}/>
                  {/* Bouton info (i) en haut à droite — toujours visible */}
                  {isActive && (
                    <button
                      onClick={function(e){e.stopPropagation();setHomeRulesModal(card.key);}}
                      onMouseDown={function(e){e.stopPropagation();}}
                      onTouchStart={function(e){e.stopPropagation();}}
                      aria-label={lang==="en"?"Game rules":"Règles du jeu"}
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
            {[0,1,2,3].map(function(i){
              const colors = ["#00E676","#60a5fa","#FFD600","#C084FC"];
              const isActive = homeCardIndex === i;
              return (
                <div
                  key={i}
                  onClick={function(){setHomeCardIndex(i);localStorage.setItem("bb_home_card", String(i));}}
                  style={{
                    width: isActive ? 28 : 8,
                    height: 8,
                    borderRadius: 4,
                    background: isActive ? colors[i] : "rgba(255,255,255,.25)",
                    transition:"all 0.3s",
                    cursor:"pointer",
                  }}
                />
              );
            })}
          </div>

          {/* Hint */}
          <div style={{textAlign:"center",fontSize:9,color:"rgba(255,255,255,.35)",marginTop:6,letterSpacing:1.5,textTransform:"uppercase"}}>
            {lang==="en" ? "← Swipe • Tap to play →" : "← Glisse • Tape pour jouer →"}
          </div>
        </div>

        {/* ── HOME RULES MODAL ── */}
        {homeRulesModal && (() => {
          const RULES_DATA = {
            grid:    { title: "GOAT GRID",    emoji: "🐐", accent: "#00E676", bg: "linear-gradient(135deg,rgba(0,230,118,.18),rgba(255,214,0,.12))",
              rules_fr: ["Une grille 3×3 quotidienne avec 9 défis","Pour chaque case : un joueur qui valide la ligne ET la colonne","Un seul essai par case — choisis bien !","Plus le joueur est rare, plus tu marques de points","Mode solo ou duel multijoueur"],
              rules_en: ["A daily 3×3 grid with 9 challenges","For each cell: a player matching both row AND column","Only one try per cell — choose wisely!","The rarer the player, the more points you score","Solo or multiplayer duel mode"]
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
          };
          const data = RULES_DATA[homeRulesModal];
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
                  <div style={{fontSize:11,letterSpacing:2,color:"rgba(255,255,255,.5)",textTransform:"uppercase",fontWeight:700}}>{lang==="en"?"How to play":"Règles du jeu"}</div>
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
                >{lang==="en"?"GOT IT":"COMPRIS"}</button>
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
            ⚠️ {lang==="en" ? "Tap back again to quit" : "Re-appuie sur retour pour quitter"}
          </div>
        )}

        {/* ── CONFIG MODAL ── */}
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
                          <span style={{display:"flex",alignItems:"center",gap:6,color:accentColor,fontSize:14,fontWeight:800,letterSpacing:1}}>🔗 <span style={{color:G.white}}>2 {lang==="en"?"CLUBS":"CLUBS"}</span></span>
                          <span style={{color:accentColor,fontSize:15,fontWeight:800}}>→</span>
                          <span style={{display:"flex",alignItems:"center",gap:6,color:accentColor,fontSize:14,fontWeight:800,letterSpacing:1}}>👤 <span style={{color:G.white}}>1 {lang==="en"?"PLAYER":"JOUEUR"}</span></span>
                        </>
                      ) : (
                        <>
                          <span style={{display:"flex",alignItems:"center",gap:6,color:accentColor,fontSize:14,fontWeight:800,letterSpacing:1}}>👤 <span style={{color:G.white}}>{lang==="en"?"PLAYER":"JOUEUR"}</span></span>
                          <span style={{color:accentColor,fontSize:15,fontWeight:800}}>→</span>
                          <span style={{display:"flex",alignItems:"center",gap:6,color:accentColor,fontSize:14,fontWeight:800,letterSpacing:1}}>🛡 <span style={{color:G.white}}>{lang==="en"?"CLUB":"CLUB"}</span></span>
                          <span style={{color:accentColor,fontSize:15,fontWeight:800}}>→</span>
                          <span style={{color:accentColor,fontSize:14,fontWeight:800,letterSpacing:1}}>👤<span style={{color:G.white,marginLeft:6}}>...</span></span>
                        </>
                      )}
                    </div>

                    {/* Difficulté */}
                    <div style={{fontSize:10,fontWeight:800,letterSpacing:3,textTransform:"uppercase",color:"rgba(255,255,255,.45)",marginBottom:8}}>{lang==="en"?"Difficulty":"Difficulté"}</div>
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

                    {/* Boutons */}
                    <div style={{display:"flex",gap:10}}>
                      <button onClick={function(){const m=gameConfigModal;setGameConfigModal(null);setTimeout(function(){tryStart(m);},50);}} style={{
                        flex:2,padding:"14px",
                        background:`linear-gradient(135deg, ${accentColor}, ${accentSecondary})`,
                        color:"#000",border:"none",borderRadius:50,cursor:"pointer",
                        fontFamily:G.font,fontSize:15,fontWeight:800,letterSpacing:1,
                        boxShadow:`0 8px 24px ${accentColor}55`,
                        display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                        transition:"transform .15s"
                      }} onMouseDown={(e)=>e.currentTarget.style.transform="scale(.97)"} onMouseUp={(e)=>e.currentTarget.style.transform="scale(1)"} onMouseLeave={(e)=>e.currentTarget.style.transform="scale(1)"}>
                        ▶ {lang==="en"?"Play solo":"Jouer seul"}
                      </button>
                      <button onClick={function(){setDuelMode(gameConfigModal);setDuelDiff(diff);setDuelRounds(totalRounds);setGameConfigModal(null);setTimeout(function(){setShowRoomCreate(true);},100);}} style={{
                        flex:1,padding:"14px",
                        background:"rgba(255,255,255,.08)",color:G.white,
                        border:"1px solid rgba(255,255,255,.15)",
                        borderRadius:50,cursor:"pointer",
                        fontFamily:G.font,fontSize:12,fontWeight:700,
                        backdropFilter:"blur(10px)"
                      }}>
                        👥 {lang==="en"?"With friends":"Entre potes"}
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
              <div style={{fontSize:10,fontWeight:800,letterSpacing:1.5,textTransform:"uppercase",color:dailyDone?"rgba(255,255,255,.3)":"rgba(255,214,0,.7)",marginBottom:1}}>{lang==="en"?"Daily challenge":"Défi du jour"}</div>
              <div style={{fontSize:13,fontWeight:800,color:dailyDone?"rgba(255,255,255,.4)":G.white}}>
                {dailyDone ? (lang==="en"?"Come back tomorrow 🔒":"Revenez demain 🔒") : (lang==="en"?"Guess the mystery player":"Devine le joueur mystère")}
              </div>
              {dailyDone && <div style={{fontSize:10,color:"rgba(255,255,255,.3)",marginTop:1}}>{dailyRevealed ? (lang==="en"?"Answer revealed — ":"Réponse révélée — ")+dailyPlayer.name : dailyAbandoned ? (lang==="en"?"Abandoned — ":"Abandonné — ")+dailyPlayer.name : (lang==="en"?"Found in "+localStorage.getItem("bb_daily_tries")+" attempt"+(parseInt(localStorage.getItem("bb_daily_tries")||"1")>1?"s":"")+"!":"Trouvé en "+localStorage.getItem("bb_daily_tries")+" essai"+(parseInt(localStorage.getItem("bb_daily_tries")||"1")>1?"s":"")+" !")}</div>}
            </div>
            {!dailyDone && <button onClick={function(){setShowDailyGame(true);setDailyGuess("");setDailyFlash(null);setDailySuccess(false);}} style={{padding:"9px 13px",background:"linear-gradient(135deg,#FFD600,#FF6B35)",color:"#000",border:"none",borderRadius:12,cursor:"pointer",fontFamily:G.font,fontSize:12,fontWeight:800,whiteSpace:"nowrap"}}>{lang==="en"?"Play ⚡":"Jouer ⚡"}</button>}
          </div>
        )}

        {/* 🐐 Modal de choix Solo / Multi pour GOAT GRID */}
        {ggModeChoice && (
          <div style={{position:"fixed",inset:0,zIndex:450,background:"#0a0a0a",overflowY:"auto",WebkitOverflowScrolling:"touch"}}>
            <div style={{position:"relative",width:"100%",minHeight:"100vh",display:"flex",flexDirection:"column",animation:"fadeIn .3s ease-out"}}>

              {/* ── BOUTON FERMER (X en haut à droite) ── */}
              <button onClick={function(){setGgModeChoice(false);}} style={{
                position:"fixed",top:"calc(14px + env(safe-area-inset-top))",right:14,zIndex:10,
                width:38,height:38,borderRadius:"50%",
                background:"rgba(0,0,0,.65)",color:"#fff",
                border:"1px solid rgba(255,255,255,.25)",
                fontSize:22,fontWeight:300,lineHeight:1,
                cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
                backdropFilter:"blur(10px)",
                boxShadow:"0 4px 16px rgba(0,0,0,.5)"
              }}>×</button>

              {/* ── HERO IMAGE — GRID_CARD_IMG entière ── */}
              <div style={{position:"relative",width:"100%",height:"35vh",maxHeight:"380px",minHeight:"240px",overflow:"hidden",background:"#000",flexShrink:0}}>
                <img
                  src={GRID_CARD_IMG}
                  alt=""
                  style={{width:"100%",height:"100%",objectFit:"contain",pointerEvents:"none",userSelect:"none"}}
                  draggable={false}
                />
                {/* Gradient bottom pour transition douce */}
                <div style={{position:"absolute",bottom:0,left:0,right:0,height:50,background:"linear-gradient(to top, #0a0a0a 0%, transparent 100%)",pointerEvents:"none"}}/>
              </div>

              {/* ── CONTENU : sous-titre + 2 cartes ── */}
              <div style={{padding:"4px 16px calc(20px + env(safe-area-inset-bottom))",flex:1}}>

                {/* Sous-titre */}
                <div style={{textAlign:"center",fontSize:11,color:"rgba(255,255,255,.5)",letterSpacing:2.5,fontWeight:700,textTransform:"uppercase",marginBottom:14}}>
                  {lang==="en"?"Choose your battle":"Choisis ton mode"}
                </div>

                {/* Carte SOLO */}
                <div onClick={function(){setGgModeChoice(false);ggStartGame();}} style={{position:"relative",overflow:"hidden",borderRadius:18,border:"2px solid rgba(0,230,118,.5)",background:"linear-gradient(135deg, #0a3a1a 0%, #0a1410 100%)",padding:"18px 18px",marginBottom:12,cursor:"pointer",display:"flex",flexDirection:"column",justifyContent:"space-between",boxShadow:"0 8px 30px rgba(0,230,118,.15)"}}>
                  {/* Pattern grille en fond (illustration) */}
                  <div style={{position:"absolute",top:-10,right:-10,opacity:.18,pointerEvents:"none"}}>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3, 34px)",gridTemplateRows:"repeat(3, 34px)",gap:3}}>
                      {[0,1,2,3,4,5,6,7,8].map(function(i){
                        const filled = [0,2,4,6,8].indexOf(i) !== -1;
                        return <div key={i} style={{borderRadius:5,background:filled?"#00E676":"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.15)"}}/>;
                      })}
                    </div>
                  </div>
                  {/* Header de la carte */}
                  <div style={{display:"flex",alignItems:"center",gap:10,position:"relative",zIndex:1}}>
                    <div style={{fontSize:32,filter:"drop-shadow(0 2px 8px rgba(0,230,118,.4))"}}>🐐</div>
                    <div>
                      <div style={{fontSize:10,fontWeight:800,letterSpacing:2,color:"rgba(0,230,118,.9)",textTransform:"uppercase"}}>{lang==="en"?"Daily challenge":"Défi du jour"}</div>
                      <div style={{fontFamily:G.heading,fontSize:24,fontWeight:900,color:"#FFFFFF",letterSpacing:2,lineHeight:1,marginTop:2}}>SOLO</div>
                    </div>
                  </div>
                  {/* Détails */}
                  <div style={{display:"flex",gap:8,marginTop:12,position:"relative",zIndex:1}}>
                    <div style={{flex:1,background:"rgba(0,0,0,.35)",borderRadius:8,padding:"5px 8px",border:"1px solid rgba(0,230,118,.2)"}}>
                      <div style={{fontSize:9,color:"rgba(255,255,255,.5)",letterSpacing:1,fontWeight:700}}>{lang==="en"?"GRID":"GRILLE"}</div>
                      <div style={{fontSize:11,color:"#fff",fontWeight:800,marginTop:1}}>3×3</div>
                    </div>
                    <div style={{flex:1,background:"rgba(0,0,0,.35)",borderRadius:8,padding:"5px 8px",border:"1px solid rgba(0,230,118,.2)"}}>
                      <div style={{fontSize:9,color:"rgba(255,255,255,.5)",letterSpacing:1,fontWeight:700}}>{lang==="en"?"LIVES":"VIES"}</div>
                      <div style={{fontSize:11,color:"#fff",fontWeight:800,marginTop:1}}>❤️❤️❤️</div>
                    </div>
                    <div style={{flex:1,background:"rgba(0,0,0,.35)",borderRadius:8,padding:"5px 8px",border:"1px solid rgba(0,230,118,.2)"}}>
                      <div style={{fontSize:9,color:"rgba(255,255,255,.5)",letterSpacing:1,fontWeight:700}}>{lang==="en"?"RANKED":"CLASSÉ"}</div>
                      <div style={{fontSize:11,color:"#fff",fontWeight:800,marginTop:1}}>🏆</div>
                    </div>
                  </div>
                </div>

                {/* Carte BATTLE */}
                <div onClick={function(){setGgModeChoice(false);setGgBattleScreen("menu");setGgBattleError("");setGgBattleCode("");}} style={{position:"relative",overflow:"hidden",borderRadius:18,border:"2px solid rgba(255,107,53,.5)",background:"linear-gradient(135deg, #4a1810 0%, #1a0a08 100%)",padding:"18px 18px",cursor:"pointer",display:"flex",flexDirection:"column",justifyContent:"space-between",boxShadow:"0 8px 30px rgba(255,107,53,.2)"}}>
                  {/* Avatars en fond (illustration) */}
                  <div style={{position:"absolute",top:8,right:-8,opacity:.18,pointerEvents:"none",fontSize:32,letterSpacing:-2,whiteSpace:"nowrap"}}>
                    ⚔️🛡️⚔️
                  </div>
                  {/* Header */}
                  <div style={{display:"flex",alignItems:"center",gap:10,position:"relative",zIndex:1}}>
                    <div style={{fontSize:32,filter:"drop-shadow(0 2px 8px rgba(255,107,53,.4))"}}>⚔️</div>
                    <div>
                      <div style={{fontSize:10,fontWeight:800,letterSpacing:2,color:"rgba(255,107,53,.95)",textTransform:"uppercase"}}>{lang==="en"?"Versus mode":"Mode versus"}</div>
                      <div style={{fontFamily:G.heading,fontSize:24,fontWeight:900,color:"#FFFFFF",letterSpacing:2,lineHeight:1,marginTop:2}}>BATTLE</div>
                    </div>
                  </div>
                  {/* Détails */}
                  <div style={{display:"flex",gap:8,marginTop:12,position:"relative",zIndex:1}}>
                    <div style={{flex:1,background:"rgba(0,0,0,.35)",borderRadius:8,padding:"5px 8px",border:"1px solid rgba(255,107,53,.2)"}}>
                      <div style={{fontSize:9,color:"rgba(255,255,255,.5)",letterSpacing:1,fontWeight:700}}>{lang==="en"?"TIMER":"DURÉE"}</div>
                      <div style={{fontSize:11,color:"#fff",fontWeight:800,marginTop:1}}>2 min ⏱️</div>
                    </div>
                    <div style={{flex:1,background:"rgba(0,0,0,.35)",borderRadius:8,padding:"5px 8px",border:"1px solid rgba(255,107,53,.2)"}}>
                      <div style={{fontSize:9,color:"rgba(255,255,255,.5)",letterSpacing:1,fontWeight:700}}>{lang==="en"?"PLAYERS":"JOUEURS"}</div>
                      <div style={{fontSize:11,color:"#fff",fontWeight:800,marginTop:1}}>2-8 👥</div>
                    </div>
                    <div style={{flex:1,background:"rgba(0,0,0,.35)",borderRadius:8,padding:"5px 8px",border:"1px solid rgba(255,107,53,.2)"}}>
                      <div style={{fontSize:9,color:"rgba(255,255,255,.5)",letterSpacing:1,fontWeight:700}}>{lang==="en"?"LIVES":"VIES"}</div>
                      <div style={{fontSize:11,color:"#fff",fontWeight:800,marginTop:1}}>♾️</div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ⚔️ Modal GOAT BATTLE — Multijoueur Menu */}
        {ggBattleScreen === "menu" && (
          <div style={{position:"fixed",inset:0,zIndex:450,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"80px 20px 40px",background:"rgba(0,0,0,.92)",backdropFilter:"blur(10px)",overflowY:"auto"}}>
            <div style={{background:"linear-gradient(135deg, #1a1410, #100a08)",border:"1.5px solid rgba(255,107,53,.4)",borderRadius:24,padding:24,maxWidth:380,width:"100%"}}>
              <div style={{textAlign:"center",marginBottom:20}}>
                <div style={{fontSize:50,marginBottom:6}}>⚔️</div>
                <div style={{fontFamily:G.heading,fontSize:28,letterSpacing:2,color:"#FF6B35",lineHeight:1}}>GOAT BATTLE</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.6)",marginTop:6}}>{lang==="en"?"2 minutes · 2-8 players · Same grid":"2 minutes · 2-8 joueurs · Même grille"}</div>
              </div>
              
              {ggBattleError && (
                <div style={{padding:10,background:"rgba(255,68,68,.15)",border:"1px solid rgba(255,68,68,.4)",borderRadius:10,color:"#FF6B6B",fontSize:12,marginBottom:14,textAlign:"center"}}>{ggBattleError}</div>
              )}
              
              {/* Créer une room */}
              <button onClick={ggBattleCreateRoom} disabled={ggBattleLoading} style={{width:"100%",padding:"14px",borderRadius:14,border:"none",background:"linear-gradient(135deg,#FF6B35,#FF4444)",color:"#fff",fontWeight:800,fontSize:14,letterSpacing:1,cursor:ggBattleLoading?"not-allowed":"pointer",marginBottom:12,opacity:ggBattleLoading?.5:1}}>
                {ggBattleLoading ? "..." : (lang==="en"?"⚔️ CREATE ROOM":"⚔️ CRÉER UNE ROOM")}
              </button>
              
              {/* Rejoindre via code */}
              <div style={{display:"flex",gap:8,marginBottom:14}}>
                <input
                  type="text"
                  value={ggBattleCode}
                  onChange={function(e){setGgBattleCode(e.target.value.toUpperCase().slice(0,6));}}
                  placeholder={lang==="en"?"CODE":"CODE"}
                  maxLength={6}
                  style={{flex:1,padding:"12px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.15)",borderRadius:12,color:G.white,fontSize:16,fontWeight:800,letterSpacing:3,textAlign:"center",fontFamily:"monospace"}}
                />
                <button onClick={function(){ggBattleJoinRoom(ggBattleCode);}} disabled={ggBattleLoading || ggBattleCode.length < 4} style={{padding:"12px 18px",borderRadius:12,border:"1px solid rgba(255,107,53,.4)",background:"rgba(255,107,53,.15)",color:"#FF6B35",fontWeight:800,fontSize:13,cursor:(ggBattleLoading||ggBattleCode.length<4)?"not-allowed":"pointer",opacity:(ggBattleLoading||ggBattleCode.length<4)?.5:1}}>
                  {lang==="en"?"JOIN":"REJOINDRE"}
                </button>
              </div>
              
              <button onClick={function(){setGgBattleScreen(null);setGgBattleError("");setGgBattleCode("");}} style={{width:"100%",padding:12,borderRadius:50,border:"none",background:"rgba(255,255,255,.05)",color:"rgba(255,255,255,.7)",fontWeight:700,fontSize:13,letterSpacing:1,cursor:"pointer"}}>
                {lang==="en"?"Close":"Fermer"}
              </button>
            </div>
          </div>
        )}

        {/* ⚔️ Modal GOAT BATTLE — Lobby */}
        {ggBattleScreen === "lobby" && ggBattleRoom && (
          <div style={{position:"fixed",inset:0,zIndex:450,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"80px 20px 40px",background:"rgba(0,0,0,.92)",backdropFilter:"blur(10px)",overflowY:"auto"}}>
            <div style={{background:"linear-gradient(135deg, #1a1410, #100a08)",border:"1.5px solid rgba(255,107,53,.4)",borderRadius:24,padding:24,maxWidth:380,width:"100%"}}>
              <div style={{textAlign:"center",marginBottom:20}}>
                <div style={{fontSize:11,letterSpacing:2,color:"rgba(255,107,53,.7)",fontWeight:700,marginBottom:6}}>⚔️ GOAT BATTLE · LOBBY</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginBottom:8}}>{lang==="en"?"Share this code":"Partage ce code"}</div>
                <div style={{display:"inline-block",padding:"10px 20px",background:"rgba(255,107,53,.15)",border:"2px solid rgba(255,107,53,.5)",borderRadius:14,fontFamily:"monospace",fontSize:28,fontWeight:900,letterSpacing:6,color:"#FF6B35"}}>
                  {ggBattleRoom.code}
                </div>
              </div>
              
              {/* Liste des joueurs */}
              <div style={{marginBottom:18}}>
                <div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginBottom:8,letterSpacing:1}}>
                  {(ggBattleRoom.players || []).length} / 8 {lang==="en"?"PLAYERS":"JOUEURS"}
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {(ggBattleRoom.players || []).map(function(p, idx){
                    const isHost = p.id === ggBattleRoom.host_id;
                    const isMe = p.id === playerId;
                    return (
                      <div key={p.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:isMe?"rgba(255,107,53,.1)":"rgba(255,255,255,.04)",border:"1px solid "+(isMe?"rgba(255,107,53,.3)":"rgba(255,255,255,.08)"),borderRadius:10}}>
                        <div style={{fontSize:18}}>{isHost?"👑":"⚔️"}</div>
                        <div style={{flex:1,fontSize:13,fontWeight:700,color:G.white}}>
                          {p.name} {isMe && <span style={{fontSize:10,color:"rgba(255,107,53,.7)"}}>({lang==="en"?"you":"toi"})</span>}
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
                  {(ggBattleRoom.players || []).length < 2 ? (lang==="en"?"WAITING FOR PLAYERS...":"EN ATTENTE DE JOUEURS...") : (lang==="en"?"⚔️ START BATTLE":"⚔️ LANCER LA BATTLE")}
                </button>
              ) : (
                <div style={{padding:14,textAlign:"center",fontSize:13,color:"rgba(255,255,255,.6)",fontStyle:"italic",marginBottom:10}}>
                  {lang==="en"?"Waiting for the host to start...":"En attente du host..."}
                </div>
              )}
              
              <button onClick={ggBattleLeaveRoom} style={{width:"100%",padding:12,borderRadius:50,border:"none",background:"rgba(255,255,255,.05)",color:"rgba(255,255,255,.7)",fontWeight:700,fontSize:13,letterSpacing:1,cursor:"pointer"}}>
                {lang==="en"?"Leave room":"Quitter la room"}
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
              <div style={{background:"linear-gradient(135deg, #1a1410, #100a08)",border:"1.5px solid "+(isWinner?"rgba(255,214,0,.6)":"rgba(255,107,53,.4)"),borderRadius:24,padding:24,maxWidth:380,width:"100%",textAlign:"center"}}>
                <div style={{fontSize:60,marginBottom:8}}>{isWinner?"👑":"⚔️"}</div>
                <div style={{fontFamily:G.heading,fontSize:26,letterSpacing:2,color:isWinner?"#FFD600":"#FF6B35",lineHeight:1,marginBottom:6}}>
                  {isWinner ? (lang==="en"?"VICTORY!":"VICTOIRE !") : (lang==="en"?"BATTLE OVER":"BATTLE TERMINÉE")}
                </div>
                <div style={{fontSize:13,color:"rgba(255,255,255,.7)",marginBottom:18}}>
                  {winner ? ((lang==="en"?"Winner: ":"Gagnant : ") + winner.name) : ""}
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
                          {p.name} {isMe && <span style={{fontSize:10,color:"rgba(255,107,53,.7)"}}>({lang==="en"?"you":"toi"})</span>}
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
                    👁️ {lang==="en"?"Tap a player to see their grid":"Tape sur un joueur pour voir sa grille"}
                  </div>
                )}
                
                {/* Bouton Relancer (host uniquement) */}
                {ggBattleRoom.host_id === playerId && (
                  <button onClick={ggBattleRestartGame} disabled={ggBattleLoading} style={{width:"100%",padding:14,borderRadius:50,border:"none",background:"linear-gradient(135deg,#00E676,#00B85F)",color:"#000",fontWeight:900,fontSize:14,letterSpacing:1,cursor:ggBattleLoading?"not-allowed":"pointer",marginBottom:8,opacity:ggBattleLoading?.5:1}}>
                    {ggBattleLoading ? "..." : "🔄 " + (lang==="en"?"REMATCH":"RELANCER")}
                  </button>
                )}
                {ggBattleRoom.host_id !== playerId && (
                  <div style={{textAlign:"center",fontSize:11,color:"rgba(255,255,255,.5)",marginBottom:8,fontStyle:"italic"}}>
                    {lang==="en"?"Waiting for the host to rematch...":"En attente d'une revanche..."}
                  </div>
                )}
                
                <button onClick={function(){
                  setGgBattleScreen(null);
                  setGgBattleRoom(null);
                  setGgBattleCode("");
                  setGgBattleError("");
                  setGgGameOver(false);
                }} style={{width:"100%",padding:14,borderRadius:50,border:"none",background:"linear-gradient(135deg,#FF6B35,#FF4444)",color:"#fff",fontWeight:800,fontSize:13,letterSpacing:1,cursor:"pointer"}}>
                  {lang==="en"?"BACK TO HOME":"RETOUR"}
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
              <div onClick={function(e){e.stopPropagation();}} style={{background:"linear-gradient(135deg, #1a1410, #100a08)",border:"1.5px solid rgba(255,107,53,.4)",borderRadius:20,padding:14,maxWidth:480,width:"100%"}}>
                {/* Header */}
                <div style={{textAlign:"center",marginBottom:14}}>
                  <div style={{fontSize:11,color:"rgba(255,107,53,.8)",letterSpacing:2,fontWeight:700,marginBottom:4}}>👁️ {lang==="en"?"GRID OF":"GRILLE DE"}</div>
                  <div style={{fontSize:22,fontWeight:900,color:G.white,marginBottom:6}}>
                    {p.name} {isMe && <span style={{fontSize:12,color:"rgba(255,107,53,.7)"}}>({lang==="en"?"you":"toi"})</span>}
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
                  {lang==="en"?"Close":"Fermer"}
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
                <div style={{fontSize:11,color:"rgba(251,226,22,.8)",letterSpacing:2,fontWeight:700,marginBottom:4}}>📋 {lang==="en"?"ANSWERS OF":"RÉPONSES DE"}</div>
                <div style={{fontSize:20,fontWeight:900,color:G.white,marginBottom:4}}>{reviewRoundsModal.playerName}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.5)"}}>
                  {reviewRoundsModal.rounds.length} {lang==="en"?"rounds":"manches"} · {reviewRoundsModal.mode === "chaine" ? "The Mercato" : "The Plug"}
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
                        <div style={{fontSize:10,fontWeight:800,letterSpacing:1.5,color:"rgba(255,255,255,.5)"}}>{lang==="en"?"ROUND":"MANCHE"} #{idx+1}</div>
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
                          {isSkip ? (lang==="en"?"Skipped":"Passé") : (r.given || "—")}
                        </div>
                      )}
                      {/* Réponses correctes possibles si pas OK (Plug uniquement) */}
                      {isPlug && !isOk && validList && (
                        <div style={{fontSize:10,color:"rgba(255,255,255,.5)",marginTop:4,fontStyle:"italic"}}>
                          {lang==="en"?"Valid: ":"Valides : "}{validList}{r.validPlayers.length > 3 ? "..." : ""}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              <button onClick={function(){setReviewRoundsModal(null);}} style={{width:"100%",padding:12,borderRadius:50,border:"none",background:"rgba(255,255,255,.08)",color:G.white,fontWeight:700,fontSize:13,letterSpacing:1,cursor:"pointer"}}>
                {lang==="en"?"Close":"Fermer"}
              </button>
            </div>
          </div>
        )}

        {/* 🐐 Modal GOAT GRID — Mode quotidien grille 3x3 (ou battle playing) */}
        {(showGoatGrid || ggBattleScreen === "playing") && (
          <div style={{position:"fixed",inset:0,zIndex:400,display:"flex",flexDirection:"column",background:"linear-gradient(180deg, #0a1410 0%, #1E5C2A 100%)"}}>
            {/* Fond pelouse */}
            <div style={{position:"absolute",inset:0,zIndex:0,overflow:"hidden",opacity:.4}}>
              {[0,1,2,3,4,5,6].map(function(i){return(<div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>);})}
            </div>
            
            {/* Compte à rebours pré-jeu (mode battle uniquement) */}
            {ggBattleScreen === "playing" && ggBattleCountdown > 0 && (
              <div style={{position:"absolute",inset:0,zIndex:50,background:"rgba(0,0,0,.85)",backdropFilter:"blur(8px)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:20}}>
                <div style={{fontFamily:G.heading,fontSize:32,letterSpacing:3,color:"#FF6B35",textAlign:"center"}}>⚔️ GOAT BATTLE</div>
                <div style={{fontSize:14,color:"rgba(255,255,255,.7)",textAlign:"center",letterSpacing:1}}>{lang==="en"?"GET READY...":"PRÊT ?"}</div>
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
                      <div style={{display:"inline-block",background:"linear-gradient(135deg,#00E676,#00B85F)",color:"#000",fontSize:9,fontWeight:900,letterSpacing:2,padding:"3px 10px",borderRadius:20,marginBottom:4}}>{lang==="en"?"⚡ DAILY · NEW":"⚡ DÉFI DU JOUR · NOUVEAU"}</div>
                      <div style={{fontFamily:G.heading,fontSize:26,letterSpacing:2,color:"#FFD600",lineHeight:1}}>GOAT GRID 🐐</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,.7)",marginTop:3,letterSpacing:1}}>{new Date().toLocaleDateString(lang==="en"?"en-US":"fr-FR",{weekday:'long',day:'numeric',month:'long'})}</div>
                      {ggOverrideSeed > 0 && (
                        <div style={{fontSize:9,color:"#FFD600",marginTop:2,letterSpacing:1.5,fontWeight:800}}>🔄 GRILLE TEST</div>
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
                      }} title={lang==="en"?"Try another grid":"Essayer une autre grille"} style={{background:"rgba(255,214,0,.15)",border:"1px solid rgba(255,214,0,.4)",borderRadius:"50%",width:36,height:36,color:"#FFD600",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>🔄</button>
                      <button onClick={function(){setShowGoatGrid(false);}} style={{background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.15)",borderRadius:"50%",width:36,height:36,color:G.white,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                    </>
                  )}
                </div>
              </div>

              {ggError && (
                <div style={{margin:"40px 20px",padding:24,background:"rgba(255,255,255,.05)",borderRadius:14,textAlign:"center"}}>
                  <div style={{fontSize:48,marginBottom:12}}>⚠️</div>
                  <div style={{fontSize:14,color:"rgba(255,255,255,.85)",lineHeight:1.5}}>{lang==="en"?"Could not generate today's grid. Data not yet enriched (nationalities/positions missing).":"Impossible de générer la grille du jour. Les données ne sont pas encore enrichies (nationalités/postes manquants)."}</div>
                </div>
              )}

              {!ggError && ggGrid && (
                <>
                  {/* Info bar : vies + score + remplissage */}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"6px 0",padding:"6px 12px",background:"rgba(0,0,0,.3)",backdropFilter:"blur(8px)",borderRadius:12,border:"1px solid rgba(255,255,255,.1)",flexShrink:0,fontSize:13,fontWeight:700}}>
                    {ggBattleScreen !== "playing" ? (
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{fontSize:10,color:"rgba(255,255,255,.5)",fontWeight:600,letterSpacing:1}}>{lang==="en"?"LIVES":"VIES"}</span>
                        <div style={{display:"flex",gap:3}}>
                          {[0,1,2].map(function(i){return(<span key={i} style={{fontSize:14,opacity:i<ggLives?1:.25,filter:i<ggLives?"none":"grayscale(1)"}}>{i<ggLives?"❤️":"💔"}</span>);})}
                        </div>
                      </div>
                    ) : (
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{fontSize:10,color:"rgba(255,107,53,.7)",fontWeight:700,letterSpacing:1}}>♾️ {lang==="en"?"NO LIMIT":"ILLIMITÉ"}</span>
                      </div>
                    )}
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:10,color:"rgba(255,255,255,.5)",fontWeight:600,letterSpacing:1}}>{lang==="en"?"SCORE":"SCORE"}</span>
                      <span style={{color:"#FFD600",fontFamily:G.heading,fontSize:16}}>{ggScore}</span>
                      <span style={{fontSize:11,color:"rgba(255,255,255,.5)",fontFamily:G.heading}}>/ {ggGrid.cells.reduce(function(s,c){return s+c.maxPoints;},0) + 100}</span>
                      <span style={{fontSize:10,color:"rgba(255,255,255,.4)"}}>pts</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:10,color:"rgba(255,255,255,.5)",fontWeight:600,letterSpacing:1}}>{lang==="en"?"FILLED":"REMPLI"}</span>
                      <span style={{color:"#FFD600",fontFamily:G.heading,fontSize:16}}>{Object.keys(ggFilledCells).length}/9</span>
                    </div>
                  </div>

                  {/* Mini explainer scoring (masqué en mode battle pour gagner de la place) */}
                  {ggBattleScreen !== "playing" && (
                    <div style={{background:"rgba(255,214,0,.08)",border:"1px solid rgba(255,214,0,.2)",borderRadius:10,padding:"4px 10px",marginBottom:6,fontSize:9,color:"rgba(255,255,255,.75)",textAlign:"center",lineHeight:1.3,flexShrink:0}}>
                      <span style={{color:"#FFD600",fontWeight:800}}>💡 {lang==="en"?"⭐ 15 · ⭐⭐ / ⭐⭐⭐ 50 pts · 🐐 No-mistake = +100":"⭐ 15 · ⭐⭐ / ⭐⭐⭐ 50 pts · 🐐 Sans-faute = +100"}</span>
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
                          <div key={"col-"+j} onClick={function(){setGgShowTooltip({title: ggGetCriterionDisplayLabel(crit, lang), text: ggGetCriterionTooltip(crit, lang)});}} style={{position:"relative",overflow:"hidden",borderRadius:12,border:"1.5px solid rgba(255,255,255,.2)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:"4px"}}>
                            <div style={{position:"absolute",inset:0,background:cMain}}/>
                            <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.18)"}}/>
                            <div style={{position:"relative",zIndex:1,color:"#fff",textShadow:"0 1px 4px rgba(0,0,0,.6)",fontWeight:900,fontSize:13,letterSpacing:0.3,lineHeight:1.15,textAlign:"center"}}>
                              {emoji && <div style={{fontSize:20,marginBottom:2}}>{emoji}</div>}
                              <div>{ggGetCriterionDisplayLabel(crit, lang).toUpperCase()}</div>
                            </div>
                            <div style={{position:"absolute",top:3,right:5,fontSize:9,color:"rgba(255,255,255,.7)",zIndex:2}}>ⓘ</div>
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
                            <div onClick={function(){setGgShowTooltip({title: ggGetCriterionDisplayLabel(rowCrit, lang), text: ggGetCriterionTooltip(rowCrit, lang)});}} style={{position:"relative",overflow:"hidden",borderRadius:12,border:"1.5px solid rgba(255,255,255,.2)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:"4px"}}>
                              <div style={{position:"absolute",inset:0,background:rcMain}}/>
                              <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.18)"}}/>
                              <div style={{position:"relative",zIndex:1,color:"#fff",textShadow:"0 1px 4px rgba(0,0,0,.6)",fontWeight:900,fontSize:13,letterSpacing:0.3,lineHeight:1.15,textAlign:"center"}}>
                                {emoji && <div style={{fontSize:20,marginBottom:2}}>{emoji}</div>}
                                <div>{ggGetCriterionDisplayLabel(rowCrit, lang).toUpperCase()}</div>
                              </div>
                              <div style={{position:"absolute",top:3,right:5,fontSize:9,color:"rgba(255,255,255,.7)",zIndex:2}}>ⓘ</div>
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
                                      <div style={{position:"absolute",inset:0,background:rowMain,opacity:.22}}/>
                                      <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg, rgba(0,0,0,.1) 0%, rgba(0,0,0,.45) 100%)"}}/>
                                    </>
                                  )}
                                  <div style={{position:"relative",zIndex:1,fontSize:ggRevealMode?16:28,color:ggRevealMode?"#7AB8FF":"rgba(255,255,255,.55)",fontWeight:ggRevealMode?700:100,textShadow:"0 1px 3px rgba(0,0,0,.6)"}}>{ggRevealMode?"?":"+"}</div>
                                </div>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>

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
                const suggestions = ggGetSuggestions(ggGuess);
                return (
                  <div onClick={function(){if(!ggFlash){setGgSelectedCell(null);setGgGuess("");}}} style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,.85)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
                    <div onClick={function(e){e.stopPropagation();}} style={{background:"linear-gradient(135deg, #1a2419, #0f1812)",border:"1px solid rgba(0,230,118,.3)",borderRadius:20,padding:20,maxWidth:360,width:"100%"}}>
                      <div style={{textAlign:"center",marginBottom:14}}>
                        <div style={{fontSize:11,letterSpacing:2,color:"rgba(255,255,255,.5)",fontWeight:700}}>{lang==="en"?"WHO MATCHES THESE 2 CRITERIA?":"QUI MATCHE CES 2 CRITÈRES ?"}</div>
                      </div>
                      <div style={{display:"flex",gap:8,marginBottom:16,alignItems:"center"}}>
                        <div style={{flex:1,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:12,padding:10,textAlign:"center"}}>
                          {rowEmoji && <div style={{fontSize:22}}>{rowEmoji}</div>}
                          <div style={{fontSize:11,fontWeight:800,color:"#fff",marginTop:4,lineHeight:1.2}}>{ggGetCriterionDisplayLabel(rowCrit, lang).toUpperCase()}</div>
                        </div>
                        <div style={{display:"flex",alignItems:"center",fontSize:18,color:"#FFD600",fontWeight:900}}>×</div>
                        <div style={{flex:1,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:12,padding:10,textAlign:"center"}}>
                          {colEmoji && <div style={{fontSize:22}}>{colEmoji}</div>}
                          <div style={{fontSize:11,fontWeight:800,color:"#fff",marginTop:4,lineHeight:1.2}}>{ggGetCriterionDisplayLabel(colCrit, lang).toUpperCase()}</div>
                        </div>
                      </div>
                      <input
                        type="text"
                        autoFocus
                        value={ggGuess}
                        onChange={function(e){setGgGuess(e.target.value);}}
                        onKeyDown={function(e){if(e.key==="Enter"){ if(suggestions.length>0){ggSubmitAnswer(suggestions[0].name);} else if(ggGuess.trim().length>=3){ggSubmitAnswer(ggGuess);} }}}
                        placeholder={lang==="en"?"Type at least 3 letters...":"Tape au moins 3 lettres..."}
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
                              ✅ {lang==="en"?"Thanks! We'll check it.":"Merci ! On va vérifier."}
                            </div>
                          ) : (
                            <>
                              <div style={{fontSize:11,color:"rgba(255,255,255,.7)",marginBottom:6,textAlign:"center"}}>
                                <strong style={{color:"#FF6B35"}}>{ggLastRejected.playerName}</strong> {lang==="en"?"refused?":"refusé ?"}
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
                                ⚠️ {lang==="en"?"I'm sure it should pass":"Je suis sûr que ça devrait passer"}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                      {/* Boutons Valider + Annuler */}
                      <div style={{display:"flex",gap:8,marginTop:14}}>
                        <button onClick={function(){setGgSelectedCell(null);setGgGuess("");setGgLastRejected(null);setGgReportSent(false);}} style={{flex:1,padding:14,borderRadius:50,border:"none",background:"rgba(255,255,255,.08)",color:"#fff",fontWeight:800,fontSize:13,letterSpacing:1,cursor:"pointer"}}>{lang==="en"?"Cancel":"Annuler"}</button>
                        <button 
                          onClick={function(){ if(suggestions.length>0){ggSubmitAnswer(suggestions[0].name);} else if(ggGuess.trim().length>=3){ggSubmitAnswer(ggGuess);} }}
                          disabled={ggGuess.trim().length<3}
                          style={{flex:2,padding:14,borderRadius:50,border:"none",background:ggGuess.trim().length>=3?"#00E676":"rgba(255,255,255,.05)",color:ggGuess.trim().length>=3?"#000":"rgba(255,255,255,.3)",fontWeight:900,fontSize:14,letterSpacing:1.5,cursor:ggGuess.trim().length>=3?"pointer":"not-allowed"}}
                        >{lang==="en"?"VALIDATE":"VALIDER"}</button>
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
                const todayDate = new Date().toLocaleDateString(lang==="en"?"en-US":"fr-FR",{day:'numeric',month:'short'});
                const shareText = "🐐 GOAT GRID — " + todayDate + "\n\n" + gridEmojis.join("\n") + "\n\n" + ggScore + " pts · " + filledCount + "/9" + (isPerfect ? " · PARFAIT 🐐" : "") + "\n\n" + "Joue sur goatfc.online";
                
                return (
                  <div style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,.92)",backdropFilter:"blur(10px)",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"80px 20px 40px",overflowY:"auto"}}>
                    <div style={{background:"linear-gradient(135deg, #1a2419, #0f1812)",border:"1px solid "+(isVictory?"rgba(0,230,118,.5)":"rgba(255,107,53,.5)"),borderRadius:24,padding:24,maxWidth:380,width:"100%",textAlign:"center"}}>
                      
                      {/* Titre selon résultat */}
                      <div style={{fontSize:60,marginBottom:8}}>
                        {isPerfect ? "🐐" : isVictory ? "🎉" : "😔"}
                      </div>
                      <div style={{fontFamily:G.heading,fontSize:30,color:isVictory?"#00E676":"#FF6B35",letterSpacing:1,marginBottom:4}}>
                        {isPerfect ? (lang==="en"?"PERFECT!":"PARFAIT !") : isVictory ? (lang==="en"?"VICTORY!":"VICTOIRE !") : (lang==="en"?"GAME OVER":"PARTIE TERMINÉE")}
                      </div>
                      <div style={{fontSize:13,color:"rgba(255,255,255,.6)",marginBottom:18}}>
                        {isPerfect ? (lang==="en"?"Grid filled without mistakes!":"Grille parfaite, aucune erreur !") : isVictory ? (lang==="en"?"You filled the whole grid":"Tu as rempli toute la grille") : (lang==="en"?"You used all your lives":"Tu as utilisé toutes tes vies")}
                      </div>
                      
                      {/* Score final */}
                      <div style={{background:"rgba(255,214,0,.1)",border:"1px solid rgba(255,214,0,.3)",borderRadius:16,padding:"14px 20px",marginBottom:14}}>
                        <div style={{fontSize:11,color:"rgba(255,214,0,.7)",fontWeight:700,letterSpacing:2,marginBottom:2}}>SCORE</div>
                        <div style={{fontFamily:G.heading,fontSize:42,color:"#FFD600",lineHeight:1}}>{ggScore} <span style={{fontSize:18,opacity:.7}}>pts</span></div>
                        <div style={{fontSize:11,color:"rgba(255,255,255,.6)",marginTop:4,fontFamily:G.heading}}>/ {ggGrid.cells.reduce(function(s,c){return s+c.maxPoints;},0) + 100} {lang==="en"?"max":"max"}</div>
                        {isPerfect && (
                          <div style={{fontSize:11,color:"#00E676",fontWeight:800,marginTop:4}}>+100 {lang==="en"?"NO-MISTAKE BONUS":"BONUS SANS-FAUTE"}</div>
                        )}
                      </div>
                      
                      {/* Stats */}
                      <div style={{display:"flex",gap:8,marginBottom:18}}>
                        <div style={{flex:1,background:"rgba(255,255,255,.05)",borderRadius:12,padding:10}}>
                          <div style={{fontSize:10,color:"rgba(255,255,255,.5)",letterSpacing:1,fontWeight:700}}>{lang==="en"?"FILLED":"REMPLI"}</div>
                          <div style={{fontFamily:G.heading,fontSize:22,color:"#fff"}}>{filledCount}/9</div>
                        </div>
                        <div style={{flex:1,background:"rgba(255,255,255,.05)",borderRadius:12,padding:10}}>
                          <div style={{fontSize:10,color:"rgba(255,255,255,.5)",letterSpacing:1,fontWeight:700}}>{lang==="en"?"LIVES LEFT":"VIES RESTANTES"}</div>
                          <div style={{fontFamily:G.heading,fontSize:22,color:"#fff"}}>{[0,1,2].map(function(i){return(<span key={i}>{i<ggLives?"❤️":"💔"}</span>);})}</div>
                        </div>
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
                          {ggShareCopied ? "✅ " + (lang==="en"?"COPIED!":"COPIÉ !") : "📤 " + (lang==="en"?"SHARE MY RESULT":"PARTAGER MON RÉSULTAT")}
                        </button>
                        <button onClick={function(){setGgRevealMode(true);setGgReviewMode(false);}} style={{padding:12,borderRadius:50,border:"1px solid rgba(74,158,255,.4)",background:"rgba(74,158,255,.15)",color:"#7AB8FF",fontWeight:800,fontSize:13,letterSpacing:1,cursor:"pointer"}}>
                          💡 {lang==="en"?"SEE POSSIBLE ANSWERS":"VOIR LES RÉPONSES POSSIBLES"}
                        </button>
                        <button onClick={function(){setGgReviewMode(true);setGgRevealMode(false);setGgRevealCell(null);}} style={{padding:12,borderRadius:50,border:"1px solid rgba(0,230,118,.4)",background:"rgba(0,230,118,.15)",color:"#00E676",fontWeight:800,fontSize:13,letterSpacing:1,cursor:"pointer"}}>
                          📋 {lang==="en"?"REVIEW MY GRID":"REVOIR MA GRILLE"}
                        </button>
                        {ggOverrideSeed === 0 && (
                          <button onClick={function(){ggLoadLeaderboard();setGgLeaderboardTab("global");}} style={{padding:12,borderRadius:50,border:"1px solid rgba(255,214,0,.4)",background:"rgba(255,214,0,.15)",color:"#FFD600",fontWeight:800,fontSize:13,letterSpacing:1,cursor:"pointer"}}>
                            🏆 {lang==="en"?"LEADERBOARD":"CLASSEMENT"}
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
                          🔄 {lang==="en"?"NEW GRID":"NOUVELLE GRILLE"}
                        </button>
                        <button onClick={function(){setShowGoatGrid(false);}} style={{padding:12,borderRadius:50,border:"none",background:"rgba(255,255,255,.05)",color:"rgba(255,255,255,.7)",fontWeight:700,fontSize:13,letterSpacing:1,cursor:"pointer"}}>
                          {lang==="en"?"Close":"Fermer"}
                        </button>
                      </div>
                      
                      <div style={{marginTop:14,fontSize:11,color:"rgba(255,255,255,.4)",fontStyle:"italic"}}>
                        {lang==="en"?"New grid tomorrow at midnight 🐐":"Nouvelle grille demain à minuit 🐐"}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 🔍 Mode REVEAL : indicateur en haut + bouton retour */}
              {ggRevealMode && !ggRevealCell && (
                <div style={{position:"fixed",bottom:20,left:20,right:20,zIndex:450,display:"flex",flexDirection:"column",gap:8}}>
                  <div style={{background:"rgba(74,158,255,.15)",border:"1px solid rgba(74,158,255,.4)",borderRadius:14,padding:"10px 14px",color:"#7AB8FF",fontSize:13,fontWeight:700,textAlign:"center"}}>
                    💡 {lang==="en"?"Click any cell to see possible answers":"Clique sur n'importe quelle case pour voir les réponses"}
                  </div>
                  <button onClick={function(){setGgRevealMode(false);}} style={{padding:12,borderRadius:50,border:"none",background:"#FFD600",color:"#000",fontWeight:900,fontSize:13,letterSpacing:1,cursor:"pointer"}}>
                    ← {lang==="en"?"BACK TO RESULT":"RETOUR AU RÉSULTAT"}
                  </button>
                </div>
              )}
              
              {/* 📋 Mode REVIEW : bouton retour en bas */}
              {ggReviewMode && (
                <div style={{position:"fixed",bottom:20,left:20,right:20,zIndex:450,display:"flex",flexDirection:"column",gap:8}}>
                  <div style={{background:"rgba(0,230,118,.15)",border:"1px solid rgba(0,230,118,.4)",borderRadius:14,padding:"10px 14px",color:"#00E676",fontSize:13,fontWeight:700,textAlign:"center"}}>
                    📋 {lang==="en"?"Review your filled grid":"Revue de ta grille remplie"}
                  </div>
                  <button onClick={function(){setGgReviewMode(false);}} style={{padding:12,borderRadius:50,border:"none",background:"#FFD600",color:"#000",fontWeight:900,fontSize:13,letterSpacing:1,cursor:"pointer"}}>
                    ← {lang==="en"?"BACK TO RESULT":"RETOUR AU RÉSULTAT"}
                  </button>
                </div>
              )}
              
              {/* 🏆 Modal Leaderboard */}
              {ggLeaderboardData && (ggLeaderboardData.global.length > 0 || ggLeaderboardData.friends.length > 0 || ggLeaderboardLoading) && !ggReviewMode && !ggRevealMode && (
                <div onClick={function(){setGgLeaderboardData({global:[],friends:[]});}} style={{position:"fixed",inset:0,zIndex:600,background:"rgba(0,0,0,.85)",backdropFilter:"blur(8px)",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"80px 20px 40px",overflowY:"auto"}}>
                  <div onClick={function(e){e.stopPropagation();}} style={{background:"linear-gradient(135deg, #1a2419, #0f1812)",border:"1px solid rgba(255,214,0,.4)",borderRadius:20,padding:20,maxWidth:420,width:"100%",maxHeight:"85vh",display:"flex",flexDirection:"column"}}>
                    <div style={{textAlign:"center",marginBottom:14}}>
                      <div style={{fontSize:11,letterSpacing:2,color:"rgba(255,214,0,.7)",fontWeight:700,marginBottom:4}}>🏆 {lang==="en"?"LEADERBOARD":"CLASSEMENT"}</div>
                      <div style={{fontSize:13,color:"rgba(255,255,255,.6)"}}>{new Date().toLocaleDateString(lang==="en"?"en-US":"fr-FR",{day:'numeric',month:'long'})}</div>
                    </div>
                    {/* Tabs */}
                    <div style={{display:"flex",gap:6,marginBottom:12,background:"rgba(0,0,0,.3)",padding:4,borderRadius:50}}>
                      <button onClick={function(){setGgLeaderboardTab("global");}} style={{flex:1,padding:8,borderRadius:50,border:"none",background:ggLeaderboardTab==="global"?"#FFD600":"transparent",color:ggLeaderboardTab==="global"?"#000":"rgba(255,255,255,.6)",fontWeight:800,fontSize:12,letterSpacing:1,cursor:"pointer"}}>
                        🌍 {lang==="en"?"GLOBAL":"MONDIAL"}
                      </button>
                      <button onClick={function(){setGgLeaderboardTab("friends");}} style={{flex:1,padding:8,borderRadius:50,border:"none",background:ggLeaderboardTab==="friends"?"#00E676":"transparent",color:ggLeaderboardTab==="friends"?"#000":"rgba(255,255,255,.6)",fontWeight:800,fontSize:12,letterSpacing:1,cursor:"pointer"}}>
                        👥 {lang==="en"?"FRIENDS":"AMIS"}
                      </button>
                    </div>
                    {/* Liste */}
                    <div style={{flex:1,overflowY:"auto",background:"rgba(255,255,255,.04)",borderRadius:12,padding:6}}>
                      {ggLeaderboardLoading ? (
                        <div style={{textAlign:"center",padding:20,color:"rgba(255,255,255,.5)"}}>{lang==="en"?"Loading...":"Chargement..."}</div>
                      ) : (() => {
                        const list = ggLeaderboardTab === "global" ? ggLeaderboardData.global : ggLeaderboardData.friends;
                        if (list.length === 0) {
                          return <div style={{textAlign:"center",padding:20,color:"rgba(255,255,255,.5)",fontSize:13}}>
                            {ggLeaderboardTab === "friends" ? (lang==="en"?"None of your friends played yet today.":"Aucun de tes amis n'a encore joué aujourd'hui.") : (lang==="en"?"No scores yet today.":"Aucun score aujourd'hui pour l'instant.")}
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
                      {lang==="en"?"Close":"Fermer"}
                    </button>
                  </div>
                </div>
              )}
              
              {/* 📜 Modal liste des réponses possibles d'une case */}
              {ggRevealCell && (
                <div onClick={function(){setGgRevealCell(null);}} style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,.85)",backdropFilter:"blur(8px)",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"80px 20px 40px",overflowY:"auto"}}>
                  <div onClick={function(e){e.stopPropagation();}} style={{background:"linear-gradient(135deg, #1a2419, #0f1812)",border:"1px solid rgba(74,158,255,.4)",borderRadius:20,padding:20,maxWidth:380,width:"100%"}}>
                    <div style={{textAlign:"center",marginBottom:14}}>
                      <div style={{fontSize:11,letterSpacing:2,color:"rgba(74,158,255,.7)",fontWeight:700,marginBottom:4}}>{lang==="en"?"POSSIBLE ANSWERS":"RÉPONSES POSSIBLES"}</div>
                      <div style={{fontSize:14,color:"#fff",fontWeight:700}}>{ggGetCriterionDisplayLabel(ggRevealCell.rowCriterion, lang)} × {ggGetCriterionDisplayLabel(ggRevealCell.colCriterion, lang)}</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginTop:4}}>{ggRevealCell.totalCount} {lang==="en"?"candidates":"candidats"} · {ggRevealCell.points} pts</div>
                    </div>
                    <div style={{maxHeight:280,overflowY:"auto",background:"rgba(255,255,255,.04)",borderRadius:12,padding:8}}>
                      {ggRevealCell.candidates.slice(0, 30).map(function(name){
                        const wasUsed = ggUsedPlayers.has(name);
                        return(
                          <div key={name} style={{padding:"10px 14px",borderBottom:"1px solid rgba(255,255,255,.04)",fontSize:14,fontWeight:700,color:wasUsed?"#00E676":"#fff",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <span>{name}</span>
                            {wasUsed && <span style={{fontSize:11,color:"#00E676"}}>✓ {lang==="en"?"Found":"Trouvé"}</span>}
                          </div>
                        );
                      })}
                      {ggRevealCell.candidates.length > 30 && (
                        <div style={{padding:"10px 14px",fontSize:12,color:"rgba(255,255,255,.5)",textAlign:"center",fontStyle:"italic"}}>
                          {lang==="en"?"... and ":"... et "}{ggRevealCell.candidates.length - 30} {lang==="en"?"others":"autres"}
                        </div>
                      )}
                    </div>
                    <button onClick={function(){setGgRevealCell(null);}} style={{marginTop:14,width:"100%",padding:12,borderRadius:50,border:"none",background:"#7AB8FF",color:"#000",fontWeight:800,fontSize:13,letterSpacing:1,cursor:"pointer"}}>{lang==="en"?"Close":"Fermer"}</button>
                  </div>
                </div>
              )}

              {/* Tooltip critère (clic sur ⓘ) */}
              {ggShowTooltip && (
                <div onClick={function(){setGgShowTooltip(null);}} style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,.85)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
                  <div onClick={function(e){e.stopPropagation();}} style={{background:"linear-gradient(135deg, #1a2419, #0f1812)",border:"1px solid rgba(255,214,0,.3)",borderRadius:20,padding:20,maxWidth:340,width:"100%",textAlign:"center"}}>
                    <div style={{fontSize:11,letterSpacing:2,color:"rgba(255,214,0,.7)",fontWeight:700,marginBottom:8}}>{lang==="en"?"CRITERION":"CRITÈRE"}</div>
                    <div style={{fontFamily:G.heading,fontSize:24,color:"#FFD600",letterSpacing:1,marginBottom:14}}>{ggShowTooltip.title.toUpperCase()}</div>
                    <div style={{fontSize:14,lineHeight:1.5,color:"rgba(255,255,255,.85)",textAlign:"left",background:"rgba(255,255,255,.04)",borderRadius:12,padding:14,marginBottom:14}}>{ggShowTooltip.text}</div>
                    <button onClick={function(){setGgShowTooltip(null);}} style={{width:"100%",padding:12,borderRadius:50,border:"none",background:"#00E676",color:"#000",fontWeight:800,fontSize:13,letterSpacing:1,cursor:"pointer"}}>{lang==="en"?"GOT IT":"OK"}</button>
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
              {[0,1,2,3,4,5,6].map(function(i){return(<div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>);})}
              <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
              <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
              <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg, rgba(255,214,0,.15) 0%, rgba(255,107,53,.15) 40%, rgba(0,15,0,.85) 100%)"}}/>
              <div style={{position:"absolute",top:-80,left:-80,width:300,height:300,borderRadius:"50%",background:"radial-gradient(circle, rgba(255,214,0,.25) 0%, transparent 70%)",filter:"blur(40px)"}}/>
              <div style={{position:"absolute",top:-60,right:-60,width:250,height:250,borderRadius:"50%",background:"radial-gradient(circle, rgba(255,107,53,.2) 0%, transparent 70%)",filter:"blur(40px)"}}/>
            </div>
            {/* Header */}
            <div style={{zIndex:1,padding:"20px 20px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontFamily:G.heading,fontSize:26,color:G.gold,letterSpacing:2}}>⚡ {lang==="en"?"DAILY CHALLENGE":"DÉFI DU JOUR"}</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,.5)",marginTop:2}}>{lang==="en"?"Guess the mystery player":"Devine le joueur mystère"}</div>
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
                      {lang==="en"?theme.labelEn:theme.labelFr}
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
                <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:G.accent,marginBottom:8,textAlign:"center"}}>{lang==="en"?"Clubs in career":"Clubs dans sa carrière"}</div>
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
                  <span style={{fontSize:13,color:"rgba(255,255,255,.4)",fontWeight:700}}>{lang==="en"?(dailyTries>1?"Attempts":"Attempt"):(dailyTries>1?"Tentatives":"Tentative")} : {dailyTries}</span>
                </div>
              )}

              {/* Bravo ou input */}
              {dailySuccess ? (
                <div style={{textAlign:"center",padding:"16px 0",flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                  <div style={{fontSize:72,marginBottom:12}}>🎉</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,.5)",fontWeight:600,letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>
                    {lang==="en"?"The answer was":"La réponse était"}
                  </div>
                  <div style={{fontFamily:G.heading,fontSize:"clamp(32px,9vw,54px)",color:"#00E676",letterSpacing:1,marginBottom:14,lineHeight:1.1,padding:"0 10px"}}>
                    {dailyPlayer.name}
                  </div>
                  <div style={{fontSize:16,color:"rgba(255,255,255,.7)",fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:6}}>
                    {pickResultMessage(RESULT_MESSAGES[lang==="en"?"en":"fr"].soloWin, dailyTries * 7 + (dailyPlayer?.name?.length||0))}
                  </div>
                  <div style={{fontSize:14,color:"rgba(255,255,255,.4)",marginTop:4,marginBottom:24}}>
                    {dailyTries === 1 ? (lang==="en"?"Got it first try 🐐":"Trouvé du premier coup 🐐") : (lang==="en"?`Found in ${dailyTries} attempts`:`Trouvé en ${dailyTries} essai${dailyTries>1?"s":""}`)}
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
                      ? (lang==="en"?"✓ COPIED!":"✓ COPIÉ !")
                      : (lang==="en"?"📤 SHARE MY RESULT":"📤 PARTAGER MON RÉSULTAT")}
                  </button>
                  <div style={{fontSize:11,color:"rgba(255,255,255,.35)",marginTop:10,textAlign:"center",padding:"0 20px"}}>
                    {lang==="en"?"Challenge your friends on WhatsApp, Insta, X...":"Challenge tes amis sur WhatsApp, Insta, X..."}
                  </div>
                </div>
              ) : dailyRevealed ? (
                <div style={{textAlign:"center",padding:"16px 0",flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                  <div style={{fontSize:72,marginBottom:12}}>👁️</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,.5)",fontWeight:600,letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>
                    {lang==="en"?"The answer was":"La réponse était"}
                  </div>
                  <div style={{fontFamily:G.heading,fontSize:"clamp(32px,9vw,54px)",color:"#60a5fa",letterSpacing:1,marginBottom:14,lineHeight:1.1,padding:"0 10px"}}>
                    {dailyPlayer.name}
                  </div>
                  <div style={{fontSize:14,color:"rgba(255,255,255,.5)",marginTop:4,marginBottom:28,maxWidth:300,lineHeight:1.5}}>
                    {lang==="en"?"Come back tomorrow for a new challenge!":"Reviens demain pour un nouveau défi !"}
                  </div>
                  <button onClick={function(){setShowDailyGame(false);}} style={{
                    width:"100%",maxWidth:320,padding:"16px",
                    background:"rgba(255,255,255,.08)",color:G.white,
                    border:"1px solid rgba(255,255,255,.2)",borderRadius:50,cursor:"pointer",
                    fontFamily:G.font,fontSize:15,fontWeight:800,letterSpacing:1
                  }}>
                    {lang==="en"?"CLOSE":"FERMER"}
                  </button>
                </div>
              ) : (
                <>
                  <div style={{position:"relative",marginBottom:8}}>
                    <input
                      value={dailyGuess}
                      onChange={function(e){setDailyGuess(e.target.value);setDailyFlash(null);}}
                      onKeyDown={function(e){if(e.key==="Enter") handleDailySubmit();}}
                      placeholder={lang==="en"?"Player name...":"Nom du joueur..."}
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
                  {dailyFlash==="ko" && <div style={{textAlign:"center",fontSize:13,color:"#FF3D57",marginBottom:8,fontWeight:700}}>{lang==="en"?"That's not it... try again!":"Ce n'est pas ça... réessaie !"}</div>}

                  {/* Hints display */}
                  {dailyHintLevel >= 1 && (
                    <div style={{background:"#123a1e",border:"1px solid rgba(96,165,250,.5)",borderRadius:14,padding:"12px 14px",marginBottom:8,display:"flex",flexDirection:"column",gap:6}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:16}}>💡</span>
                        <span style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"#60a5fa"}}>{lang==="en"?"Hint":"Indice"} {dailyHintLevel}/2</span>
                      </div>
                      <div style={{fontSize:13,color:"#fff",lineHeight:1.5}}>
                        <strong>{lang==="en"?"Position: ":"Poste : "}</strong> {dailyHintData.position || "..."}
                      </div>
                      {dailyHintLevel >= 2 && (
                        <div style={{fontSize:13,color:"#fff",lineHeight:1.5}}>
                          <strong>{lang==="en"?"Nationality: ":"Nationalité : "}</strong> {dailyHintData.nationality || "..."}
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
                        {dailyHintData.loading ? (lang==="en"?"Loading...":"Chargement...") : (dailyHintLevel === 0 ? (lang==="en"?`💡 Show position (−${firstHintCost} pts)`:`💡 Voir le poste (−${firstHintCost} pts)`) : (lang==="en"?"💡 Show nationality (free)":"💡 Voir la nationalité (gratuit)"))}
                      </button>
                    );
                  })()}
                  <div style={{display:"flex",gap:10,marginTop:8}}>
                    <button onClick={handleDailySubmit} style={{flex:1,padding:"16px",background:"linear-gradient(135deg,#FFD600,#FF6B35)",color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:16,fontWeight:800}}>
                      {lang==="en"?"Submit ✓":"Valider ✓"}
                    </button>
                  </div>
                  {/* Voir la réponse (sans pénalité ni récompense) */}
                  <button onClick={function(){setShowRevealConfirm(true);}} style={{width:"100%",marginTop:10,padding:"11px",background:"transparent",color:"rgba(255,255,255,.5)",border:"1px solid rgba(255,255,255,.15)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:12,fontWeight:700,letterSpacing:.3}}>
                    👁️ {lang==="en"?"Reveal answer (0 pts)":"Voir la réponse (0 pt)"}
                  </button>
                  {/* Signaler une erreur sur le défi */}
                  <button onClick={function(){setShowDailyReportConfirm(true);}} style={{width:"100%",marginTop:8,padding:"8px",background:"transparent",color:"rgba(255,255,255,.3)",border:"none",cursor:"pointer",fontFamily:G.font,fontSize:11,fontWeight:600,textDecoration:"underline",letterSpacing:.2}}>
                    ⚠️ {lang==="en"?"Report an error with this challenge":"Signaler une erreur sur ce défi"}
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
              <div style={{fontFamily:G.heading,fontSize:24,color:G.white,letterSpacing:1,marginBottom:8}}>{lang==="en"?"REVEAL ANSWER?":"VOIR LA RÉPONSE ?"}</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,.55)",marginBottom:22,lineHeight:1.5}}>
                {lang==="en"?<>You'll see the answer but earn <strong style={{color:G.white}}>0 points</strong> today. Your streak won't be maintained.</>:<>Tu verras la réponse mais tu gagnes <strong style={{color:G.white}}>0 point</strong>. Ta série ne sera pas maintenue.</>}
              </div>
              <div style={{display:"flex",gap:10}}>
                <button onClick={function(){setShowRevealConfirm(false);}} style={{flex:1,padding:"13px",background:"rgba(255,255,255,.07)",color:G.white,border:"1px solid rgba(255,255,255,.1)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>
                  {lang==="en"?"Cancel":"Annuler"}
                </button>
                <button onClick={handleRevealDaily} style={{flex:1,padding:"13px",background:"rgba(96,165,250,.2)",color:"#60a5fa",border:"1px solid rgba(96,165,250,.4)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800}}>
                  {lang==="en"?"👁️ Reveal":"👁️ Voir"}
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
                  <div style={{fontFamily:G.heading,fontSize:22,color:G.accent,letterSpacing:1,marginBottom:8}}>{lang==="en"?"THANK YOU!":"MERCI !"}</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,.55)",marginBottom:22,lineHeight:1.5}}>
                    {lang==="en"?"Your report has been sent. We'll fix it as soon as possible.":"Ton signalement a été envoyé. On corrige ça au plus vite."}
                  </div>
                  <button onClick={function(){setShowDailyReportConfirm(false);setDailyReportSent(false);}} style={{width:"100%",padding:"13px",background:"rgba(0,230,118,.15)",color:G.accent,border:"1px solid rgba(0,230,118,.3)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800}}>
                    OK
                  </button>
                </>
              ) : (
                <>
                  <div style={{fontSize:42,marginBottom:12}}>⚠️</div>
                  <div style={{fontFamily:G.heading,fontSize:24,color:G.white,letterSpacing:1,marginBottom:8}}>{lang==="en"?"REPORT AN ERROR?":"SIGNALER UNE ERREUR ?"}</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,.55)",marginBottom:22,lineHeight:1.5}}>
                    {lang==="en"?<>If <strong style={{color:G.white}}>{dailyPlayer.name}</strong> has missing clubs or incorrect information, tap Report. If enough users report, the player will be automatically excluded.</>:<>Si <strong style={{color:G.white}}>{dailyPlayer.name}</strong> a des clubs manquants ou des infos fausses, tape Signaler. Si assez d'users signalent, le joueur sera automatiquement exclu.</>}
                  </div>
                  <div style={{display:"flex",gap:10}}>
                    <button onClick={function(){setShowDailyReportConfirm(false);}} style={{flex:1,padding:"13px",background:"rgba(255,255,255,.07)",color:G.white,border:"1px solid rgba(255,255,255,.1)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>
                      {lang==="en"?"Cancel":"Annuler"}
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
                      ⚠️ {lang==="en"?"Report":"Signaler"}
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
              <div style={{fontSize:14,fontWeight:800,color:G.white}}>{lang==="en"?"Play with friends!":"Joue avec tes potes !"}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>{lang==="en"?"Create a room or join with a code":"Crée une salle ou rejoins avec un code"}</div>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <input value={roomInput} onChange={function(e){setRoomInput(e.target.value.toUpperCase());setRoomMsg("");}}
              placeholder={lang==="en"?"Room code":"Code salle"} maxLength={6}
              style={{flex:1,padding:"10px 12px",borderRadius:12,border:"1.5px solid rgba(255,255,255,.12)",background:"rgba(255,255,255,.05)",color:G.white,fontFamily:G.font,fontSize:14,fontWeight:700,letterSpacing:3,textTransform:"uppercase",outline:"none"}}/>
            <button onClick={function(){requirePseudo(async function(){
              const code = (roomInput||"").trim().toUpperCase();
              if (code.length !== 6) { setRoomMsg(lang==="en"?"Invalid code":"Code invalide"); return; }
              setRoomMsg("");
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
            });}} style={{padding:"10px 14px",background:"rgba(255,255,255,.07)",color:G.white,border:"1px solid rgba(255,255,255,.12)",borderRadius:12,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:700}}>{lang==="en"?"Join":"Rejoindre"}</button>
          </div>
        </div>
        {roomMsg && <div style={{fontSize:12,color:"#FF3D57",fontWeight:700,marginTop:-4}}>{roomMsg}</div>}
        {/* Actions */}
        <div style={{display:"flex",gap:8}}>
          <button onClick={function(){loadLeaderboard(lbMode);setShowLeaderboard(true);}} style={{flex:1,padding:"12px",background:"rgba(0,230,118,.08)",color:G.accent,border:"1px solid rgba(0,230,118,.2)",borderRadius:14,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            {Icon.trophy(14,G.accent)} {lang==="en"?"Leaderboard":"Classement"}
          </button>
          <button onClick={function(){requirePseudo(function(){setShowFriends(true);loadFriends().then(function(ids){fetchFriendScores(ids);});loadDuels();loadFriendRequests();});}} style={{flex:1,padding:"12px",background:"rgba(255,255,255,.05)",color:G.white,border:"1px solid rgba(255,255,255,.1)",borderRadius:14,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:6,position:"relative"}}>
            {lang==="en"?"👥 Friends":"👥 Amis"}{friendRequests.length>0&&<span style={{position:"absolute",top:-4,right:-4,background:"#FF3D57",color:"#fff",borderRadius:"50%",width:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900}}>{friendRequests.length}</span>}
          </button>
        </div>

        {/* Ko-fi — soutien volontaire */}
        <a href="https://ko-fi.com/goatfc" target="_blank" rel="noopener noreferrer"
          style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:"linear-gradient(90deg, rgba(255,94,91,.18), rgba(255,138,42,.12))",border:"1px solid rgba(255,94,91,.4)",borderRadius:14,textDecoration:"none"}}>
          <div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#FF5E5B,#FF8A2A)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,boxShadow:"0 2px 8px rgba(255,94,91,.4)"}}>☕</div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:800,color:"#FF5E5B"}}>{lang==="en"?"Support GOAT FC ☕":"Soutenez-nous ☕"}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.4)",marginTop:1}}>{lang==="en"?"No ads, no paywall — keep us going":"Sans pub, sans paywall — aide-nous à tenir"}</div>
          </div>
          <span style={{fontSize:16,color:"rgba(255,94,91,.6)"}}>›</span>
        </a>

      </div>
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
            <div style={{fontFamily:G.heading,fontSize:26,color:G.white,marginBottom:8}}>{lang==="en"?"QUIT?":"ABANDONNER ?"}</div>
            <div style={{fontSize:14,color:"rgba(255,255,255,.5)",marginBottom:24}}>
              {activeDuel ? (lang==="en"?"Your opponent will be declared the winner.":"Ton adversaire sera déclaré vainqueur.") : (lang==="en"?"Your game will be lost and your score will be 0.":"Ta partie sera perdue et ton score sera de 0.")}
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={function(){setShowQuitConfirm(false);}} style={{flex:1,padding:"13px",background:"rgba(255,255,255,.07)",color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>{lang==="en"?"Continue":"Continuer"}</button>
              <button onClick={async function(){
                setShowQuitConfirm(false);
                clearInterval(timerRef.current);
                clearInterval(qTimerRef.current);
                if(activeDuelRef.current&&activeDuelRef.current.isRoom){ await abandonRoom(); /* navigation gérée par abandonRoom → showRoomResults ou polling */ }
                else if(activeDuel){ abandonDuel(); setScreen("home"); }
                else { setScreen("home"); }
              }} style={{flex:1,padding:"13px",background:"#FF3D57",color:"#fff",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>{lang==="en"?"Quit":"Abandonner"}</button>
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

        {/* CRESCENDO BADGE — Plug mode */}
        {(activeDuelRef.current && activeDuelRef.current.isRoom ? activeDuelRef.current.diff : diff) === "expert" && (() => {
          // Au Plug, on calcule le palier selon qIdx (0-9 facile, 10-19 moyen, 20+ expert)
          const tier = qIdx < 10 ? "facile" : qIdx < 20 ? "moyen" : "expert";
          const tierColor = tier === "facile" ? "#00E676" : tier === "moyen" ? "#FFD600" : "#FF3D57";
          const tierLabel = tier === "facile" ? (lang==="en"?"EASY":"FACILE") : tier === "moyen" ? (lang==="en"?"MEDIUM":"MOYEN") : (lang==="en"?"EXPERT":"EXPERT");
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
              <button onClick={handlePass} disabled={!!flash} style={{padding:"12px",pointerEvents:flash?"none":"auto",background:"transparent",color:"#bbb",border:"2px solid #e5e5e0",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:700,opacity:flash ? 0.3 : 1}}>{lang==="en"?"Skip → (−10 pts)":"Passer → (−10 pts)"}</button>
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
            <div style={{fontFamily:G.heading,fontSize:26,color:G.white,marginBottom:8}}>{lang==="en"?"QUIT?":"ABANDONNER ?"}</div>
            <div style={{fontSize:14,color:"rgba(255,255,255,.5)",marginBottom:24}}>{lang==="en"?"Your game will be lost and your score will be 0.":"Ta partie sera perdue et ton score sera de 0."}</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={function(){setShowQuitConfirm(false);}} style={{flex:1,padding:"13px",background:"rgba(255,255,255,.07)",color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>{lang==="en"?"Continue":"Continuer"}</button>
              <button onClick={async function(){setShowQuitConfirm(false);clearInterval(timerRef.current);clearInterval(qTimerRef.current);if(activeDuelRef.current&&activeDuelRef.current.isRoom){await abandonRoom();/* navigation gérée par abandonRoom */}else if(activeDuel){abandonDuel();setChainPlayer("");setScreen("home");}else{setChainPlayer("");setScreen("home");}}} style={{flex:1,padding:"13px",background:"#FF3D57",color:"#fff",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>{lang==="en"?"Quit":"Abandonner"}</button>
            </div>
          </div>
        </div>
      )}

      {floatingPoints}
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

      {/* CRESCENDO BADGE — affiché uniquement en mode Crescendo (diff="expert") */}
      {(activeDuelRef.current && activeDuelRef.current.isRoom ? activeDuelRef.current.diff : diff) === "expert" && (() => {
        const tier = getCrescendoTier(chainCount);
        const tierColor = tier === "facile" ? "#00E676" : tier === "moyen" ? "#FFD600" : "#FF3D57";
        const tierLabel = tier === "facile" ? (lang==="en"?"EASY":"FACILE") : tier === "moyen" ? (lang==="en"?"MEDIUM":"MOYEN") : (lang==="en"?"EXPERT":"EXPERT");
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
                  <span style={{fontSize:13,color:"rgba(255,255,255,.7)",fontWeight:700,letterSpacing:1}}>{lang==="en"?"PASSED":"PASSÉ"}</span>
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
          {Icon.ball(12,ptc==="#FFF"?"rgba(255,255,255,.6)":"rgba(0,0,0,.35)")} {lang==="en"?"Name a club of":"Donne un club de"}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:14,zIndex:1,position:"relative",justifyContent:"center",flexWrap:"wrap"}}>
          <div style={{textAlign:"center"}}>
            <div style={{fontFamily:G.heading,fontSize:"clamp(18px,5vw,34px)",color:ptc==="#FFF"?"#fff":"#111",lineHeight:1.05,textShadow:ptc==="#FFF"?"0 2px 10px rgba(0,0,0,.25)":"none",letterSpacing:1}}>{chainPlayer}</div>
            {chainUsedClubs.size>0 && <div style={{fontSize:10,color:ptc==="#FFF"?"rgba(255,255,255,.55)":"rgba(0,0,0,.35)",marginTop:3,fontWeight:600}}>{chainAvailableClubs.length} {lang==="en"?("club"+(chainAvailableClubs.length!==1?"s":"")+" available"):("club"+(chainAvailableClubs.length!==1?"s":"")+" disponible"+(chainAvailableClubs.length!==1?"s":""))}</div>}
          </div>
        </div>
        {combo>=3 && <div style={{marginTop:6,fontSize:12,fontWeight:800,color:ptc==="#FFF"?"#fff":"#111",animation:"comboFire .5s ease",zIndex:1,position:"relative"}}>{getComboLabel(combo)} x{combo}</div>}
      </div>

      <div style={{...sheet,marginTop:0,borderRadius:"28px 28px 0 0"}}>
        {feedbackBar(feedback)}
        <div style={{position:"relative"}}>
          <input ref={inputRef} value={guess} onChange={e=>setGuess(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleChainSubmit()}
            placeholder={lang==="en"?"Club name...":"Nom du club..."} autoComplete="off"
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
          <button onClick={handleChainPass} disabled={!!flash} style={{flex:1,padding:16,background:G.offWhite,color:"#aaa",border:"2px solid #e5e5e0",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700,opacity:flash ? 0.3 : 1}}>{lang==="en"?"Skip → (−10 pts)":"Passer → (−10 pts)"}</button>
          <button onClick={handleChainSubmit} style={{flex:2,padding:"16px",background:G.dark,color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:16,fontWeight:800}}>{lang==="en"?"Submit":"Valider"}</button>
        </div>
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
          {totalRounds===2&&currentRound===1?(lang==="en"?"⚽ HALF-TIME!":"⚽ MI-TEMPS !"):(lang==="en"?"ROUND "+currentRound+" DONE":"MANCHE "+currentRound+" TERMINÉE")}
        </div>
        {totalRounds===2&&currentRound===1&&<div style={{fontSize:14,color:"rgba(255,255,255,.6)",marginTop:8,letterSpacing:2}}>{lang==="en"?"Back on the pitch in 3... 2... 1...":"Retour sur le terrain dans 3... 2... 1..."}</div>}
      </div>
      <div style={sheet}>
        {roundScores.map((s,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:i===roundScores.length-1?G.dark:G.offWhite,borderRadius:18,padding:"16px 20px",animation:`slideIn .4s ease ${i*.08}s both`}}>
            <span style={{fontSize:15,color:i===roundScores.length-1?G.white:"#888",fontWeight:700}}>{lang==="en"?"Round ":"Manche "}{i+1}</span>
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
            <div style={{fontSize:11,letterSpacing:3,textTransform:"uppercase",color:"rgba(255,255,255,.4)",marginBottom:10,textAlign:"center"}}>{lang==="en"?"Live leaderboard":"Classement en cours"}</div>
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
              <div style={{textAlign:"center",padding:"16px",color:"rgba(255,255,255,.35)",fontSize:13}}>⏳ {lang==="en"?"Loading scores...":"Chargement des scores..."}</div>
            )}
          </div>
        )}
        <button onClick={()=>startRound(currentRound+1)} style={{width:"100%",padding:"18px",background:totalRounds===2&&currentRound===1?"#16a34a":G.dark,color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:17,fontWeight:800,marginTop:16,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>{Icon.whistle(18,G.white)} {totalRounds===2&&currentRound===1?(lang==="en"?"RESUME GAME →":"REPRENDRE LA PARTIE →"):(lang==="en"?"ROUND "+(currentRound+1):"MANCHE "+(currentRound+1))}</button>
      </div>
    </div>
  );

  // ── FINAL ──
const makeResultScreen = (sc, mode, isChain) => { const img = resultImg || (sc > 0 ? WIN_IMGS : LOSE_IMGS)[0];    return (    <div style={{...shell,animation:"fadeUp .4s ease"}} key={isChain?"chainEnd":"final"}>
      {pseudoModal}
      {recoveryCodeAfterCreationModal}
      {recoveryInputModal}
      {myRecoveryCodeModal}
      {confettiOverlay}{gradeUpModal}<div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
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
        <div style={{fontSize:"clamp(16px,4.5vw,22px)",color:G.white,fontWeight:800,marginTop:isNewRecord||isChain?6:16,animation:"fadeUp .4s ease .25s both",textTransform:"uppercase",letterSpacing:1,textShadow:"0 2px 10px rgba(0,0,0,.4)"}}>{(isNewRecord?[
          "BALLON D'OR MÉRITÉ 🏆",
          "T'AS PLIÉ LE MATCH 🎩",
          "CLASSE INTERNATIONALE 🌍",
          "PRESTATION 5 ÉTOILES ⭐",
          "T'ES DANS LE ONZE TYPE 🏟️",
          "MAN OF THE MATCH 🥇",
          "DE LA MAGIE PURE 🪄",
          "RECORD BATTU 📈",
        ]:[
          "T'AS PAS LE NIVEAU.. 👀",
          "C'EST TOUT CE QUE T'AS ? 💀",
          "LE GOAT C'EST TOI OU PAS ? 🐐",
          "ON JOUE PAS, ON DOMINE 😤",
          "T'AS KIFFÉ OU T'AS SOUFFERT ? 😂",
          "PROUVE QUE T'ES PAS UN RANDOM 🔥",
          "LE FOOT C'EST DANS LA TÊTE FRÈRE 🧠",
          "T'AURAIS PAS DÛ RATER LES AUTRES 😏",
        ])[Math.abs(Math.floor(sc * 3 + totalRounds)) % 8]}</div>
      </div>
      <div style={sheet}>
        <div style={{background:"rgba(255,255,255,.06)",borderRadius:20,padding:"20px",textAlign:"center",border:"1.5px solid #eee"}}>
          <div style={{fontSize:11,letterSpacing:3,textTransform:"uppercase",color:"#bbb"}}>Score{isChain?"":" total"}</div>
          <div style={{fontFamily:G.heading,fontSize:"clamp(54px,13vw,80px)",color:G.white,lineHeight:1}}>{sc}</div>
          <div style={{fontSize:11,color:"#bbb"}}>pts{isChain?` · ${chainCount} lien${chainCount>1?"s":""}`:`  ·  ${totalRounds} manche${totalRounds>1?"s":""}`}</div>
          {maxCombo>=3&&<div style={{fontSize:13,color:"#f59e0b",marginTop:4,fontWeight:700}}>🔥 Meilleur combo : x{maxCombo}</div>}
          {isNewRecord&&<div style={{fontSize:12,color:G.accent,marginTop:6,fontStyle:"italic"}}>{lang==="en"?"Previous record beaten 🎉":"Ancien record battu 🎉"}</div>}
          {dayStreak>=2&&<div style={{fontSize:12,color:"#FF6B35",marginTop:6,fontWeight:700}}>🔥 {dayStreak} jours de suite !</div>}
        </div>

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
                  <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:64,height:64,borderRadius:"50%",overflow:"hidden",background:"linear-gradient(135deg,#00E676,#1E5C2A)",border:"2px solid #00E676",marginBottom:8,marginInline:"auto"}}>
                    {playerAvatar
                      ? <img src={playerAvatar} alt="" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}}/>
                      : <span style={{fontFamily:G.heading,fontSize:28,color:G.white}}>{(playerName||"?")[0].toUpperCase()}</span>
                    }
                  </div>
                  <div style={{fontSize:11,color:"#bbb",letterSpacing:1,textTransform:"uppercase"}}>{playerName||"Toi"}</div>
                  <div style={{fontFamily:G.heading,fontSize:32,color:win?verdictColor:G.white,lineHeight:1,marginTop:2}}>{myScore}</div>
                </div>
                {/* VS */}
                <div style={{fontFamily:G.heading,fontSize:18,color:"#888",letterSpacing:2}}>VS</div>
                {/* Bot */}
                <div style={{textAlign:"center"}}>
                  <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:64,height:64,borderRadius:"50%",overflow:"hidden",background:"linear-gradient(135deg,#3DA5FF,#1E5C2A)",border:"2px solid #3DA5FF",marginBottom:8,marginInline:"auto"}}>
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
                  <span style={{fontSize:13,fontWeight:700,color:s===best?G.white:"#aaa"}}>{lang==="en"?"Round ":"Manche "}{i+1} {s===best?"⭐":""}</span>
                  <span style={{fontFamily:G.heading,fontSize:24,color:s===best?G.white:G.dark}}>{s} pts</span>
                </div>
              );
            })}
          </div>
        )}
      
        <button onClick={()=>{setLbMode(mode);setLbDiff(diff);loadLeaderboard(lbMode);setShowLeaderboard(true);}}
          style={{width:"100%",padding:"14px",background:"#f0f9f4",color:"#16a34a",border:"2px solid #86efac",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800}}>
          <span style={{display:"flex",alignItems:"center",gap:8,justifyContent:"center"}}>{Icon.stadium(16,"#16a34a")} {lang==="en"?"See leaderboard":"Voir le classement"}{myLbRank?` · #${myLbRank}`:""}</span>
        </button>
        {!pseudoConfirmed && (
          <div style={{background:"rgba(255,200,0,.1)",border:"1px solid rgba(255,200,0,.3)",borderRadius:14,padding:"12px 16px",textAlign:"center"}}>
            <div style={{fontSize:13,color:"#ffd600",fontWeight:700,marginBottom:6}}>⚠️ {lang==="en"?"Score not saved":"Score non enregistré"}</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.5)",marginBottom:10}}>{lang==="en"?"Create a username to appear on the leaderboard":"Crée un pseudo pour apparaître au classement"}</div>
            <button onClick={()=>setPseudoScreen(true)} style={{padding:"8px 20px",background:"#ffd600",color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:800}}>{lang==="en"?"Create username":"Créer mon pseudo"}</button>
          </div>
        )}
        <button onClick={()=>{if(isChain)startChain();else startCompetition();}} style={{width:"100%",padding:"18px",background:G.dark,color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:17,fontWeight:800,letterSpacing:1,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>{Icon.ball(18,G.white)} {lang==="en"?"Play again":"Rejouer"}</button>
        {((!isChain && roundAnswers.length>0) || (isChain && chainHistory.length>0)) && (
          <button onClick={()=>setShowHistory(true)} style={{width:"100%",padding:"14px",background:"rgba(251,226,22,.12)",color:"#FBE216",border:"1.5px solid rgba(251,226,22,.5)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            📋 {isChain?(lang==="en"?"See my chain":"Voir ma chaîne"):(lang==="en"?"Questions recap":"Récap des questions")}
          </button>
        )}
        <button onClick={function(){
          const grade = getGrade(playerXp);
          const txt = `${grade.emoji} J'ai scoré ${sc} pts en mode ${isChain?"The Mercato":"The Plug"} sur GOAT FC !\nGrade : ${grade.label}\nT'as le niveau ? 👇\nhttps://goatfc.fr`;
          if(navigator.share){navigator.share({title:"GOAT FC",text:txt});}
          else{navigator.clipboard.writeText(txt).then(function(){alert(lang==="en"?"Copied! Paste it anywhere 📋":"Copié ! Colle-le où tu veux 📋");});}
        }} style={{width:"100%",padding:"14px",background:"linear-gradient(135deg,#1d4ed8,#7c3aed)",color:"#fff",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          {lang==="en"?"📤 Share my score":"📤 Partager mon score"}
        </button>
        <button onClick={()=>setScreen("home")} style={{width:"100%",padding:"14px",background:"transparent",color:"#bbb",border:"2px solid #e5e5e0",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:700}}>{lang==="en"?"↩ Home":"↩ Accueil"}</button>
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
          <div style={{fontSize:52,marginBottom:8}}>{iAbandoned?"🏳️":(myRank<=3?medals[myRank-1]:myRank+"ème")}</div> {!iAbandoned && (myRank===1?WIN_IMGS:LOSE_IMGS)[Math.floor(Date.now()%(myRank===1?WIN_IMGS:LOSE_IMGS).length)] && (   <img src={(myRank===1?WIN_IMGS:LOSE_IMGS)[Math.floor(Date.now()%(myRank===1?WIN_IMGS:LOSE_IMGS).length)]} style={{width:"60%",maxWidth:220,margin:"8px auto",display:"block",objectFit:"contain"}} /> )}
          <div style={{fontFamily:G.heading,fontSize:"clamp(30px,8vw,50px)",color:iAbandoned?"#FF3D57":(myRank===1?G.gold:G.white),letterSpacing:2}}>
            {iAbandoned?(lang==="en"?"FORFEIT":"ABANDON"):(myRank===1?(lang==="en"?"VICTORY!":"VICTOIRE !"):myRank===2?(lang==="en"?"2ND PLACE":"2ÈME PLACE"):myRank===3?(lang==="en"?"3RD PLACE":"3ÈME PLACE"):(lang==="en"?"RESULTS":"RÉSULTATS"))}
          </div>
          {iAbandoned && <div style={{fontSize:15,color:"#fff",marginTop:10,fontWeight:700,padding:"0 16px",lineHeight:1.4}}>{lang==="en"?"You didn't even finish 😂":"T'as même pas eu le courage d'aller au bout 😂"}</div>}
        </div>
        <div style={{...sheet,borderRadius:"28px 28px 0 0"}}>
          {duelResult.players.map(function(p,i){
            const hasRounds = Array.isArray(p.rounds) && p.rounds.length > 0;
            const onClickHandler = hasRounds ? function(){
              setReviewRoundsModal({
                mode: duelResult.mode || "pont",
                playerName: p.name + (p.id===playerId ? (lang==="en"?" (you)":" (toi)") : ""),
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
              👁️ {lang==="en"?"Tap a player to see their answers":"Tape sur un joueur pour voir ses réponses"}
            </div>
          )}
          <button onClick={function(){
            const myEntry = duelResult.players.find(function(p){return p.id===playerId;});
            const grade = getGrade(playerXp);
            const rank = duelResult.players.findIndex(function(p){return p.id===playerId;})+1;
            const txt = rank===1
              ? `${grade.emoji} J'ai remporté la salle sur GOAT FC avec ${myEntry?.score||0} pts 🏆\nGrade : ${grade.label}\nT'as le niveau ? 👇\nhttps://goatfc.fr`
              : `J'ai terminé ${rank}ème sur GOAT FC avec ${myEntry?.score||0} pts\nGrade : ${grade.label}\nhttps://goatfc.fr`;
            if(navigator.share){navigator.share({title:"GOAT FC",text:txt});}
            else{navigator.clipboard.writeText(txt).then(function(){alert(lang==="en"?"Copied! 📋":"Copié ! 📋");});}
          }} style={{width:"100%",padding:"13px",background:"linear-gradient(135deg,#1d4ed8,#7c3aed)",color:"#fff",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:8,marginBottom:6}}>
            {lang==="en"?"📤 Share the result":"📤 Partager le résultat"}
          </button>
          <button onClick={function(){setDuelResult(null);setScreen("home");}} style={{width:"100%",padding:"16px",background:G.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800,marginTop:0}}>
            {lang==="en"?"Back home":"Retour à l'accueil"}
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
      ? (lang==="en"?"FORFEIT!":"ABANDON !")
      : won
      ? (lang==="en"?"VICTORY!":"VICTOIRE !")
      : draw
      ? (lang==="en"?"DRAW!":"ÉGALITÉ !")
      : (lang==="en"?"DEFEAT":"DÉFAITE");
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
          <div style={{fontSize:"clamp(13px,3.5vw,18px)",color:G.white,fontWeight:800,marginTop:6,animation:"fadeUp .4s ease .25s both",textTransform:"uppercase",letterSpacing:1,textShadow:"0 2px 10px rgba(0,0,0,.4)"}}>{
            won
              ? pickResultMessage(RESULT_MESSAGES[lang==="en"?"en":"fr"].winLabels, duelResult.myScore)
              : draw
              ? pickResultMessage(RESULT_MESSAGES[lang==="en"?"en":"fr"].drawLabels, duelResult.myScore)
              : pickResultMessage(RESULT_MESSAGES[lang==="en"?"en":"fr"].loseLabels, duelResult.theirScore)
          }</div>
          {(()=>{const grade=getGrade(playerXp); return <div style={{display:"inline-flex",alignItems:"center",gap:8,marginTop:8,background:grade.color+"22",borderRadius:20,padding:"6px 14px"}}><span style={{fontSize:13,fontWeight:800,color:grade.color,letterSpacing:.5}}>{grade.label}</span></div>; })()}
          <div style={{fontSize:14,color:"rgba(255,255,255,.4)",marginTop:8}}>
            {abandoned ? duelResult.oppName+(lang==="en"?" forfeited 🏃":" a abandonné 🏃") : (lang==="en"?"Duel ":"Duel ")+(duelResult.mode==="pont"?"The Plug":"The Mercato")}
          </div>
        </div>
        <div style={{...sheet,borderRadius:"28px 28px 0 0"}}>
          {/* Scores */}
          <div style={{display:"flex",gap:12,marginBottom:8}}>
            <div onClick={Array.isArray(duelResult.myRounds) && duelResult.myRounds.length > 0 ? function(){setReviewRoundsModal({mode:duelResult.mode||"pont",playerName:(lang==="en"?"You":"Toi"),rounds:duelResult.myRounds});} : null} style={{flex:1,background:"rgba(0,230,118,.08)",border:"2px solid "+(won?"#00E676":"rgba(255,255,255,.08)"),borderRadius:20,padding:"20px 12px",textAlign:"center",cursor:Array.isArray(duelResult.myRounds)&&duelResult.myRounds.length>0?"pointer":"default",position:"relative"}}>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.4)",marginBottom:6}}>{lang==="en"?"You":"Toi"}</div>
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
              👁️ {lang==="en"?"Tap a score box to see the answers":"Tape sur un score pour voir les réponses"}
            </div>
          )}
          {/* Streak banner */}
          {won && winStreak >= 2 && (
            <div style={{textAlign:"center",marginBottom:8,padding:"10px 16px",background:"linear-gradient(135deg,rgba(255,107,53,.2),rgba(255,214,0,.2))",borderRadius:14,border:"1px solid rgba(255,107,53,.3)"}}>
              <span style={{fontSize:20}}>🔥</span>
              <span style={{fontFamily:G.heading,fontSize:18,color:"#FF6B35",marginLeft:8,letterSpacing:1}}>
                {winStreak} {lang==="en"?"WINS IN A ROW":"VICTOIRES D'AFFILÉE"}
              </span>
              {winStreak >= 5 && <div style={{fontSize:12,color:"rgba(255,107,53,.8)",marginTop:2}}>
                {winStreak >= 10 ? (lang==="en"?"You're unstoppable 🐐":"T'es inarrêtable 🐐") : winStreak >= 7 ? (lang==="en"?"Nobody can stop you 😤":"Personne peut t'arrêter 😤") : (lang==="en"?"You're on fire mate 🔥":"T'es en feu frère 🔥")}
              </div>}
            </div>
          )}
          {/* Badge Invaincu */}
          {won && duelResult.oppName && (()=>{
            const h2h = duels.filter(function(d){return d.status==="complete"&&(d.challenger_id===playerId||d.opponent_id===playerId)&&(d.challenger_name===duelResult.oppName||d.opponent_name===duelResult.oppName);});
            const lost = h2h.some(function(d){const ms=d.challenger_id===playerId?d.challenger_score:d.opponent_score;const ts=d.challenger_id===playerId?d.opponent_score:d.challenger_score;return ms<ts;});
            return !lost && h2h.length >= 2 ? (
              <div style={{textAlign:"center",marginBottom:8,padding:"10px 16px",background:"rgba(255,215,0,.1)",borderRadius:14,border:"1px solid rgba(255,215,0,.3)"}}>
                <span style={{fontFamily:G.heading,fontSize:16,color:"#FFD700",letterSpacing:1}}>😤 {lang==="en"?"UNBEATEN VS":"INVAINCU CONTRE"} {duelResult.oppName.toUpperCase()}</span>
              </div>
            ) : null;
          })()}
          {/* Message auto du vainqueur au perdant */}
          {!won && !draw && !abandoned && duelResult.oppName && (
            <div style={{marginBottom:8,padding:"12px 16px",background:"rgba(255,255,255,.05)",borderRadius:14,border:"1px solid rgba(255,255,255,.1)"}}>
              <div style={{fontSize:10,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>💬 {lang==="en"?"Message from":"Message de"} {duelResult.oppName}</div>
              <div style={{fontSize:14,fontWeight:700,color:G.white}}>
                {pickResultMessage(RESULT_MESSAGES[lang==="en"?"en":"fr"].winTaunts, duelResult.theirScore - duelResult.myScore + duelResult.theirScore)}
              </div>
            </div>
          )}
          <div style={{fontSize:15,color:"rgba(255,255,255,.85)",textAlign:"center",padding:"10px 0",fontWeight:700,lineHeight:1.4}}>
            {(()=>{
              const L = RESULT_MESSAGES[lang==="en"?"en":"fr"];
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
              <div style={{fontSize:10,color:"rgba(0,230,118,.5)",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>💬 {lang==="en"?"Message sent to":"Message envoyé à"} {duelResult.oppName}</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,.5)",fontStyle:"italic"}}>
                {pickResultMessage(RESULT_MESSAGES[lang==="en"?"en":"fr"].winTaunts, duelResult.myScore * 3 + duelResult.theirScore)}
              </div>
            </div>
          )}
          <button onClick={function(){
            const grade = getGrade(playerXp);
            const result = won ? "victoire" : draw ? "nul" : "défaite";
            const txt = won
              ? `${grade.emoji} J'ai écrasé ${duelResult.oppName} ${duelResult.myScore}-${duelResult.theirScore} sur GOAT FC 😤\nGrade : ${grade.label}\nT'as le niveau ? 👇\nhttps://goatfc.fr`
              : `J'ai perdu ${duelResult.myScore}-${duelResult.theirScore} contre ${duelResult.oppName} sur GOAT FC 😤\nLa revanche arrive...\nhttps://goatfc.fr`;
            if(navigator.share){navigator.share({title:"GOAT FC",text:txt});}
            else{navigator.clipboard.writeText(txt).then(function(){alert(lang==="en"?"Copied! 📋":"Copié ! 📋");});}
          }} style={{width:"100%",padding:"13px",background:"linear-gradient(135deg,#1d4ed8,#7c3aed)",color:"#fff",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:6}}>
            {lang==="en"?"📤 Share the result":"📤 Partager le résultat"}
          </button>
          {((!duelResult.isChain && roundAnswers.length>0) || (duelResult.isChain && chainHistory.length>0)) && (
            <button onClick={()=>setShowHistory(true)} style={{width:"100%",padding:"13px",background:"rgba(251,226,22,.12)",color:"#FBE216",border:"1.5px solid rgba(251,226,22,.5)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:6}}>
              📋 {duelResult.isChain?(lang==="en"?"See my chain":"Voir ma chaîne"):(lang==="en"?"Questions recap":"Récap des questions")}
            </button>
          )}
          <button onClick={function(){setDuelResult(null);setScreen("home");}} style={{width:"100%",padding:"16px",background:G.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800,marginTop:2}}>
            {lang==="en"?"Back home":"Retour à l'accueil"}
          </button>
        </div>
        {historyModal}
        {reportModal}
      </div>
    );
  }
  if(screen==="final") return makeResultScreen(total,"pont",false);
  if(screen==="chainEnd") return makeResultScreen(chainScore,"chaine",true);

  return <div style={{...shell,justifyContent:"center",alignItems:"center"}}><div style={{color:G.white}}>{lang==="en"?"Loading…":"Chargement…"}</div></div>;
}
