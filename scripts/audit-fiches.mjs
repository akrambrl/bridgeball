#!/usr/bin/env node
// VÉRIFIE que chaque fiche de src/players.jsx est jouable : un parcours complet
// et dans l'ordre, une année de naissance, une nationalité, un poste.
//
//     npx tsx scripts/audit-fiches.mjs              # contrôle interne, hors ligne
//     npx tsx scripts/audit-fiches.mjs --wikidata   # + recoupement Wikidata
//     npx tsx scripts/audit-fiches.mjs --wikidata --moissonne   # rafraîchit le cache
//
// ── CE QUE CE SCRIPT PEUT PROUVER, ET CE QU'IL NE PEUT PAS ───────────────
//
// La PRÉSENCE d'un champ se prouve : il est là ou il n'y est pas, sur 5 622
// fiches, sans discussion. Le passage 1 rend un verdict.
//
// La COMPLÉTUDE d'un parcours ne se prouve pas. Wikidata n'est pas exhaustif —
// sa fiche Pogba ignore son premier passage à United et son retour à la Juve —
// donc « Wikidata ne connaît pas d'autre club » ne veut pas dire « le parcours
// est complet ». Le passage 2 produit des CANDIDATS à relire, jamais un feu vert.
//
// Entre les deux, le passage 1 bis recoupe players.jsx avec CLUB_SPELLS, la
// table de dates écrite et vérifiée à la main dans ce dépôt. Elle ne couvre que
// 341 joueurs, mais sur ceux-là elle est fiable, et un désaccord entre les deux
// est une contradiction INTERNE : l'une des deux sources se trompe, il faut
// trancher. C'est le contrôle le plus rentable du lot.
//
// ── UN DÉSACCORD D'ORDRE NE DIT PAS QUI A TORT ───────────────────────────
//
// Abidal est passé par Monaco, Lyon, Barcelone, puis Monaco à nouveau. La fiche
// commence par Monaco, la table de dates par Lyon : c'est la TABLE qui ignore le
// premier passage, pas la fiche qui se trompe. À l'inverse Banega, que la fiche
// envoie à l'Inter avant Séville alors qu'il a fait Séville d'abord, est une
// vraie erreur de fiche. Le script signale la contradiction et s'arrête là.
//
// Les clubs sont comparés à leur PREMIÈRE occurrence : sans ça, tout joueur
// revenu dans un club (Ronaldo, Rooney, Buffon…) sortirait comme désordonné.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PLAYERS } from "../src/players.jsx";
import { CLUB_SPELLS } from "../src/lib/clubSpells.ts";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(racine, ".cache", "wikidata-carrieres.json");
const AVEC_WIKIDATA = process.argv.includes("--wikidata");
const MOISSONNE = process.argv.includes("--moissonne");

const titre = (t) => console.log("\n" + "─".repeat(74) + "\n" + t + "\n");
const liste = (n, lignes, max = 40) => {
  console.log(`${String(lignes.length).padStart(5)}  ${n}`);
  for (const l of lignes.slice(0, max)) console.log("        " + l);
  if (max && lignes.length > max) console.log(`        … et ${lignes.length - max} autres`);
};

// ═══ PASSAGE 1 — les quatre champs obligatoires ════════════════════════════

titre("PASSAGE 1 — présence des champs, sur les " + PLAYERS.length + " fiches");

const AN = new Date().getFullYear();
const sans = { naissance: [], nationalite: [], poste: [], club: [] };
const parcours = { unSeulClub: [], repeteDeSuite: [], clubVide: [] };
const naissanceDouteuse = [];

for (const p of PLAYERS) {
  const c = p.clubs ?? [];
  if (p.birthYear == null) sans.naissance.push(p.name);
  // Zamora est né en 1901 et Matthews en 1915 : la borne basse est là pour
  // attraper une faute de frappe (1091), pas pour douter des anciens.
  else if (p.birthYear < 1890 || p.birthYear > AN - 15) naissanceDouteuse.push(`${p.name} — ${p.birthYear}`);
  if (!(p.nationalities ?? []).length) sans.nationalite.push(p.name);
  if (!(p.positions ?? []).length) sans.poste.push(p.name);
  if (!c.length) sans.club.push(p.name);
  else if (c.length === 1) parcours.unSeulClub.push(`${p.name} — ${c[0]} [${p.diff}]`);
  if (c.some((x) => typeof x !== "string" || !x.trim())) parcours.clubVide.push(p.name);
  // Un club répété À LA SUITE est une saisie double ; répété plus loin, c'est un
  // vrai retour (Ronaldo à United) et ça ne se signale pas.
  for (let i = 1; i < c.length; i++) if (c[i] === c[i - 1]) parcours.repeteDeSuite.push(`${p.name} — ${c[i]}`);
}

liste("sans année de naissance", sans.naissance, 0);
liste("sans nationalité", sans.nationalite, 0);
liste("sans poste", sans.poste, 0);
liste("sans aucun club", sans.club, 0);
liste("club vide ou non textuel", parcours.clubVide, 0);
liste("même club deux fois de suite (saisie double)", parcours.repeteDeSuite, 10);
liste("année de naissance hors bornes", naissanceDouteuse, 10);
liste("un seul club au compteur — carrière d'un club, ou fiche à compléter", parcours.unSeulClub, 15);

// ═══ PASSAGE 1 bis — contradiction avec la table de dates du dépôt ═════════

titre("PASSAGE 1 bis — players.jsx confronté à CLUB_SPELLS (" + Object.keys(CLUB_SPELLS).length + " joueurs datés)");

const premiere = (a) => a.filter((c, i) => a.indexOf(c) === i);
const parNom = new Map(PLAYERS.map((p) => [p.name, p]));
const ordre = [], absentsFiche = [];

for (const [nom, spells] of Object.entries(CLUB_SPELLS)) {
  const p = parNom.get(nom);
  if (!p) { absentsFiche.push(`${nom} — présent dans CLUB_SPELLS, absent de players.jsx`); continue; }
  const dates = premiere([...spells].sort((a, b) => a.from - b.from).map((s) => s.club));
  const communs = new Set(dates.filter((c) => p.clubs.includes(c)));
  const vuFiche = premiere(p.clubs).filter((c) => communs.has(c));
  const vuDates = dates.filter((c) => communs.has(c));
  if (vuFiche.join("|") !== vuDates.join("|"))
    ordre.push(`${nom}\n          fiche : ${vuFiche.join(" > ")}\n          dates : ${vuDates.join(" > ")}`);
  const manquants = dates.filter((c) => !p.clubs.includes(c));
  if (manquants.length) absentsFiche.push(`${nom.padEnd(24)} manque : ${manquants.join(", ")}`);
}
liste("ordre en contradiction avec les dates — à arbitrer", ordre, 40);
liste("club daté mais absent de la fiche", absentsFiche, 40);

// ═══ PASSAGE 2 — recoupement Wikidata ══════════════════════════════════════

if (!AVEC_WIKIDATA) {
  console.log("\n(passage Wikidata non demandé — relancer avec --wikidata)");
  process.exit(0);
}

const sansParenthese = (n) => n.replace(/\s*\(.*\)\s*$/, "").trim();

async function moissonner(noms, acquis) {
  const LOT = 60;
  const req = (lot) => `
SELECT DISTINCT ?nom ?naissance ?club ?clubLabel ?debut WHERE {
  VALUES ?nom { ${lot.map((n) => `"${n.replace(/"/g, '\\"')}"@fr "${n.replace(/"/g, '\\"')}"@en`).join(" ")} }
  ?j rdfs:label ?nom ; wdt:P106 wd:Q937857 .
  OPTIONAL { ?j wdt:P569 ?naissance }
  ?j p:P54 ?st . ?st ps:P54 ?club .
  ?club wdt:P31/wdt:P279* wd:Q476028 .
  OPTIONAL { ?st pq:P580 ?debut }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,fr". }
}`;
  for (let i = 0; i < noms.length; i += LOT) {
    const lot = noms.slice(i, i + LOT);
    for (const n of lot) acquis[n] ??= { naissance: null, clubs: [] };
    for (let essai = 0; essai < 3; essai++) {
      try {
        const r = await fetch("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(req(lot)),
          { headers: { "User-Agent": "GOATFC-audit/1.0 (contact@goatfc.online)", Accept: "application/sparql-results+json" } });
        if (!r.ok) throw new Error("HTTP " + r.status);
        for (const b of (await r.json()).results.bindings) {
          const e = acquis[b.nom.value];
          if (!e) continue;
          if (b.naissance && !e.naissance) e.naissance = b.naissance.value.slice(0, 4);
          const debut = b.debut?.value.slice(0, 4) ?? null;
          if (!e.clubs.some((c) => c.nom === b.clubLabel.value && c.debut === debut))
            e.clubs.push({ nom: b.clubLabel.value, debut });
        }
        break;
      } catch (err) {
        if (essai === 2) console.log(`  lot ${i} abandonné : ${err.message}`);
        else await new Promise((r) => setTimeout(r, 3000 * (essai + 1)));
      }
    }
    if (i % (LOT * 10) === 0) { mkdirSync(dirname(CACHE), { recursive: true }); writeFileSync(CACHE, JSON.stringify(acquis)); }
  }
  mkdirSync(dirname(CACHE), { recursive: true });
  writeFileSync(CACHE, JSON.stringify(acquis));
}

let cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
const voulus = [...new Set(PLAYERS.map((p) => sansParenthese(p.name)))];
const aFaire = MOISSONNE ? voulus : voulus.filter((n) => !(n in cache));
if (aFaire.length) {
  console.log(`\nmoisson Wikidata : ${aFaire.length} noms…`);
  await moissonner(aFaire, cache);
}

titre("PASSAGE 2 — recoupement Wikidata (indicatif, jamais un feu vert)");

// Wikidata écrit « Valencia CF », « Manchester United F.C. », « 1. FC Köln ».
const cle = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim()
  .replace(/^(fc|ac|as|sc|ss|ssc|cf|cd|rc|sv|ca|ud|sl|afc|vfb|vfl|tsg|bsc|1 fc|1 fsv|1)\s+/, "")
  .replace(/\s+(fc|cf|sc|ac|calcio|bc|jk|sad|sk|s k|f c|a c|u s|1919|1899|04|05|96|98)$/, "")
  .replace(/^borussia\s+/, "");

// Le vocabulaire de clubs de la base : ce qu'elle emploie déjà pour d'autres joueurs.
const vocabulaire = new Set();
for (const p of PLAYERS) for (const c of p.clubs ?? []) vocabulaire.add(cle(c));

const naissanceTrouvee = [], ordreWD = [], clubsEnPlus = [], inconnuWD = [];
for (const p of PLAYERS) {
  const e = cache[sansParenthese(p.name)];
  if (!e || !e.clubs.length) { inconnuWD.push(p.name); continue; }
  if (p.birthYear == null && e.naissance) naissanceTrouvee.push(`${p.name.padEnd(26)} ${e.naissance}`);

  const dates = premiere(e.clubs.filter((c) => c.debut).sort((a, b) => a.debut.localeCompare(b.debut)).map((c) => cle(c.nom)));
  const fiche = premiere(p.clubs.map(cle));
  const communs = new Set(dates.filter((c) => fiche.includes(c)));
  const a = fiche.filter((c) => communs.has(c)), b = dates.filter((c) => communs.has(c));
  if (a.length >= 3 && a.join("|") !== b.join("|"))
    ordreWD.push(`${p.name}\n          fiche : ${a.join(" > ")}\n          dates : ${b.join(" > ")}`);

  // Un club que Wikidata date et que la fiche ignore : candidat, pas verdict.
  // Deux filtres, sinon la pile fait 3 500 lignes et ne se lit plus :
  //  • les équipes réserve et jeunes (Barcelona B, Real Madrid Castilla, les U19)
  //    n'ont pas leur place dans un jeu de devinettes — la base n'en garde que
  //    quelques-unes, choisies ;
  //  • un club que la base ne connaît NULLE PART est presque toujours une graphie
  //    non rapprochée, pas un trou. Les vrais trous se voient sur des clubs que la
  //    base emploie déjà pour d'autres joueurs.
  const reserve = (n) => /\b(B|II|C|U-?\d{2}|Castilla|Mestalla|reserves?|youth|academy)\b/i.test(n);
  const enPlus = e.clubs.filter((c) => c.debut && !fiche.includes(cle(c.nom))
    && !reserve(c.nom) && vocabulaire.has(cle(c.nom)));
  if (enPlus.length) clubsEnPlus.push(`${p.name.padEnd(26)} ${enPlus.map((c) => c.nom + " (" + c.debut + ")").join(", ")}`);
}
liste("année de naissance manquante que Wikidata donne", naissanceTrouvee, 25);
liste("ordre en désaccord avec Wikidata (≥3 clubs communs) — à arbitrer", ordreWD, 25);
liste("clubs datés par Wikidata et absents de la fiche — à relire", clubsEnPlus, 30);
liste("fiches sur lesquelles Wikidata n'a rien — recoupement impossible", inconnuWD, 10);
