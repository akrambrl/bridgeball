// Compare le journal maxifoot à src/players.jsx.
// Voir l'en-tête de mercato-maxifoot.py pour le mode d'emploi et les pièges.
import { PLAYERS } from "../src/players.jsx";
import fs from "fs";
const D = "./";   // maxifoot.json produit par mercato-maxifoot.py
const tr = JSON.parse(fs.readFileSync(D+"maxifoot.json","utf8"));

// maxifoot écrit les clubs à la française ; on les ramène aux noms de la base
const ALIAS = {
  "Paris SG":"PSG", "Juventus Turin":"Juventus FC", "Milan AC":"AC Milan",
  "Manchester Utd":"Manchester United", "AS Rome":"AS Roma", "FC Barcelone":"Barcelona",
  "Fiorentina":"ACF Fiorentina", "Atl. Madrid":"Atletico Madrid", "Hambourg SV":"Hamburg",
  "FC Cologne":"Köln", "Genoa":"Genoa CFC", "Eintracht Francfort":"Eintracht Frankfurt",
  "Naples":"SSC Napoli", "FC Porto":"Porto", "Calcio Côme":"Como", "Betis Séville":"Real Betis",
  "Fribourg":"SC Freiburg", "Benfica Lisbonne":"Benfica", "La Corogne":"Deportivo La Coruna",
  "Espanyol Barcelone":"Espanyol", "FC Seville":"Sevilla", "Mayence":"Mainz",
  "Atalanta Bergame":"Atalanta BC", "Al Hilal Riyadh":"Al Hilal", "Coventry":"Coventry City",
  "Sporting Lisbonne":"Sporting CP", "PAOK Salonique":"PAOK", "Sampdoria Gênes":"Sampdoria",
  "Cercle Bruges":"Cercle Brugge", "CD Leganés":"Leganés", "FC Sion":"Sion",
  "Dynamo Kiev":"Dynamo Kyiv", "Feyenoord Rotterdam":"Feyenoord", "Cagliari":"Cagliari Calcio",
  "Clermont F.":"Clermont",
};
const nettoieClub = s => (s||"").replace(/\s*[\[(][A-Za-z\-]+[\])]\s*$/,"").trim();
const norm = s => s.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase()
  .replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();

const clubs = new Set();
for (const p of PLAYERS) for (const c of (p.clubs||[])) clubs.add(c);
const parNorm = new Map();
for (const c of clubs) if (!parNorm.has(norm(c))) parNorm.set(norm(c), c);
const versBase = brut => {
  const c = nettoieClub(brut);
  if (ALIAS[c]) return ALIAS[c];
  return parNorm.get(norm(c)) || null;
};

// index des joueurs : nom complet normalisé, et « initiale + nom de famille »
const parNom = new Map(), parInitiale = new Map();
for (const p of PLAYERS) {
  const k = norm(p.name);
  if (!parNom.has(k)) parNom.set(k, []);
  parNom.get(k).push(p);
  const mots = p.name.split(/\s+/);
  if (mots.length >= 2) {
    const ini = norm(mots[0][0] + " " + mots.slice(1).join(" "));
    if (!parInitiale.has(ini)) parInitiale.set(ini, []);
    parInitiale.get(ini).push(p);
  }
}
const trouve = t => {
  const direct = parNom.get(norm(t.joueur));
  if (direct) return { liste: direct, via: "nom complet" };
  const m = t.abrege.match(/^([A-Z])\.\s*(.+)$/);
  if (m) {
    const l = parInitiale.get(norm(m[1] + " " + m[2]));
    if (l) return { liste: l, via: "initiale+nom" };
  }
  return null;
};

const aAjouter = [], ambigus = [], clubHorsBase = [], joueurAbsent = [], nonConfirmes = [];
for (const t of tr) {
  const club = versBase(t.vers);
  if (!club) { clubHorsBase.push(t); continue; }
  const r = trouve(t);
  if (!r) { joueurAbsent.push(t); continue; }
  if (r.liste.length > 1) { ambigus.push({t, club, n: r.liste.length}); continue; }
  const p = r.liste[0];
  if ((p.clubs||[]).includes(club)) continue;
  // Garde-fou : « M. Sarr » ne dit pas de quel Sarr il s'agit. On n'accepte une
  // correspondance par initiale que si le club QUITTÉ figure déjà dans la fiche
  // — c'est la même personne, au même endroit, au bon moment.
  const clubDepart = versBase(t.de);
  const coherent = clubDepart && (p.clubs||[]).includes(clubDepart);
  if (r.via === "initiale+nom" && !coherent) { nonConfirmes.push({nom:p.name, club, de:t.de, date:t.date}); continue; }
  aAjouter.push({ nom: p.name, club, via: r.via, date: t.date, de: t.de, type: t.type,
                  an: p.birthYear, clubs: p.clubs, diff: p.diff, coherent, source: t.source });
}
console.log("=== À AJOUTER :", aAjouter.length);
for (const a of aAjouter)
  console.log(`  ${a.date.padEnd(9)} ${a.nom.padEnd(26)} → ${a.club.padEnd(20)} (${a.via}, ${a.type}) [${a.diff} ${a.an}] ${a.clubs.join(", ")}`);
console.log("\n=== AMBIGUS (plusieurs joueurs de ce nom) :", ambigus.length);
for (const a of ambigus.slice(0,15)) console.log(`  ${a.t.joueur} → ${a.club} (${a.n} candidats)`);
console.log("\n=== ÉCARTÉS faute de club de départ concordant :", nonConfirmes.length);
for (const a of nonConfirmes) console.log(`  ${a.nom} → ${a.club} (venu de ${a.de})`);
console.log("\n=== joueur absent de la base :", joueurAbsent.length, "| club hors base :", clubHorsBase.length);
fs.writeFileSync(D+"mf-ajouts.json", JSON.stringify(aAjouter,null,1));
