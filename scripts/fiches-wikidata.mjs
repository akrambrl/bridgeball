#!/usr/bin/env node
// PROPOSE DES FICHES JOUEURS DEPUIS WIKIDATA, SANS JAMAIS EN INVENTER
//
//     npx tsx scripts/fiches-wikidata.mjs "Alen Halilović" "Ravel Morrison"
//     npx tsx scripts/fiches-wikidata.mjs --fichier liste.txt
//
// ── POURQUOI CE SCRIPT, ET PAS LA MÉMOIRE ─────────────────────────────────
//
// Écrire 40 parcours de mémoire injecterait des erreurs dans une base que le jeu
// traite comme la vérité. Une seule faute crée une PAIRE INSOLUBLE : le tirage
// propose « Lyngby × Arsenal » parce qu'une fiche prétend les avoir joués tous
// les deux, et la vérification refuse ensuite la seule réponse possible. C'est
// exactement le défaut trouvé sur Christian Nørgaard.
//
// Wikidata donne des parcours DATÉS, donc ordonnés, ce qui est ce que le jeu
// attend.
//
// ── CE QUE CE SCRIPT NE PROUVE PAS ────────────────────────────────────────
//
// Wikidata n'est pas exhaustif, et il se TROMPE. Vérifié pendant l'écriture de
// ce fichier sur Éric Cantona : Wikidata OMET Marseille, où il a passé trois ans,
// et lui prête un passage au PSG. Sur Sergio Agüero, la recherche par libellé
// anglais ne rend rien du tout.
//
// Ce script produit donc des CANDIDATS à relire, jamais un feu vert — la même
// conclusion que scripts/audit-fiches.mjs, écrite avant lui. Ce qu'il apporte,
// c'est de ne rien inventer : ce qu'il ne trouve pas, il le dit.
//
// ── LE POINT CRITIQUE EST L'ORTHOGRAPHE DES CLUBS ─────────────────────────
//
// Les modes de jeu comparent les noms de clubs en chaînes STRICTES. « Mainz » et
// « 1. FSV Mainz 05 » sont deux clubs différents pour le moteur, donc écrire le
// second casse toutes les paires du premier.
//
// Le script traduit chaque libellé Wikidata vers l'orthographe déjà employée
// dans la base — 1551 clubs, avec leur nombre d'occurrences — et REFUSE de
// deviner : un club qu'il ne sait pas rattacher est signalé, pas inventé. La
// règle du dépôt s'applique alors : on ajoute un club déjà présent, on n'ajoute
// un club nouveau que s'il est reconnaissable, et on saute le reste — un club
// obscur devient un cul-de-sac de chaîne.
import { PLAYERS } from "../src/players.jsx";
import { readFileSync } from "node:fs";

// ── LE VOCABULAIRE DES CLUBS DE LA BASE ───────────────────────────────────
const occurrences = new Map();
for (const p of PLAYERS) for (const c of p.clubs || []) {
  occurrences.set(c, (occurrences.get(c) || 0) + 1);
}

/**
 * Réduit un nom de club à son noyau comparable.
 *
 * Les jetons retirés sont les ornements juridiques et régionaux qui varient d'une
 * source à l'autre : « 1. FSV Mainz 05 » et « Mainz » désignent le même club, et
 * seul « mainz » subsiste des deux côtés.
 *
 * On ne retire PAS « inter », « real », « athletic », « atletico », « sporting »
 * ni « dynamo » : ce sont des éléments DISTINCTIFS. Les retirer confondrait
 * l'Inter Milan avec l'AC Milan, et le Real Madrid avec l'Atlético.
 */
const ORNEMENTS = new Set([
  "fc", "cf", "afc", "sc", "ac", "as", "ss", "ssc", "sv", "tsv", "vfl", "vfb",
  "bv", "bsc", "fsv", "sad", "aas", "rc", "rcd", "ud", "cd", "ca", "sd", "kv",
  "kaa", "rsc", "psv", "nk", "hnk", "gnk", "nec", "aik", "if", "ff", "bk",
  "club", "de", "del", "the", "football", "futbol", "fussball", "calcio",
  "association", "team", "society", "sportive", "sportiva", "deportivo",
  "deportiva", "clube", "esporte", "esporte", "e", "ec", "sp",
]);

function noyau(nom) {
  const sansAccents = nom.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return sansAccents
    .toLowerCase()
    .replace(/[.,'’"()\-–—/]/g, " ")
    // TOUS les nombres, et pas seulement les années de fondation : « Bayer 04 »,
    // « Mainz 05 », mais aussi le « 1. » de « 1. FC Köln ». Ma première version ne
    // retirait que les années, donc « 1. FC Köln » gardait un jeton « 1 » et ne se
    // rattachait plus à « Köln » — 59 joueurs dans la base.
    .replace(/\b\d+\b/g, " ")
    .split(/\s+/)
    // Les jetons d'UNE LETTRE tombent aussi : « Stade Rennais F.C. » devient
    // « stade rennais f c » après retrait de la ponctuation, et « fc » n'est plus
    // reconnaissable comme ornement. Ma première version gardait donc « f » et
    // « c », et Rennes restait non rattaché.
    .filter((m) => m && m.length > 1 && !ORNEMENTS.has(m))
    .join(" ")
    .trim();
}

const parNoyau = new Map();
for (const [club, n] of occurrences) {
  const k = noyau(club);
  // À noyau égal, on garde l'orthographe la PLUS EMPLOYÉE : c'est elle qui fait
  // le plus de paires, donc celle qu'il faut renforcer.
  const actuel = parNoyau.get(k);
  if (!actuel || occurrences.get(actuel) < n) parNoyau.set(k, club);
}

// ── LES GRAPHIES QUE LES JETONS NE PEUVENT PAS RELIER ─────────────────────
//
// Certaines villes changent de nom d'une langue à l'autre : Wikidata écrit
// « Luzern », la base « Lucerne ». Aucune comparaison de forme ne peut les
// rapprocher, il faut le dire. La table reste courte et se remplit au fil des
// signalements — mieux vaut cinq lignes vérifiées qu'un algorithme qui devine.
const SYNONYMES = new Map(Object.entries({
  luzern: "Lucerne",
  // Libellés officiels ou français que Wikidata rend parfois, et que les jetons
  // ne peuvent pas relier. Chacun a été VU dans un lot, pas anticipé.
  // Les clés sont des NOYAUX, pas des libellés : « SV » et « FC » ont déjà été
  // retirés par noyau(). Ma première version écrivait « hambourgsv », qui ne
  // pouvait jamais correspondre.
  hamburger: "Hamburg",
  hambourg: "Hamburg",
  athletic: "Athletic Bilbao",
  olympiquelyonnais: "Lyon",
  staderennais: "Rennes",
  internazionalemilano: "Inter Milan",
  chievoverona: "Chievo",
  athleticbilbao: "Athletic Bilbao",
  koeln: "Köln",
  muenchen: "Bayern Munich",
  genk: "Genk",
  praha: "Slavia Prague",
  moskva: "Spartak Moscow",
}));

/** Rattache un libellé Wikidata à un club de la base, ou rend null. */
function canoniser(libelle) {
  const k = noyau(libelle);
  if (!k) return null;
  const direct = parNoyau.get(k);
  if (direct) return direct;

  const synonyme = SYNONYMES.get(k.replace(/ /g, ""));
  // On ne rend le synonyme que s'il EXISTE vraiment dans la base : la table
  // pourrait vieillir, et rendre un club absent serait pire que ne rien rendre.
  if (synonyme && occurrences.has(synonyme)) return synonyme;

  // ── RATTACHEMENT PAR JETONS, ET NON PAR SOUS-CHAÎNE ─────────────────────
  //
  // Ma première version comparait des sous-chaînes avec un plancher de cinq
  // lettres pour éviter que « lens » ne se rattache à « valenciennes ». Ce
  // plancher écartait Köln, Lens, Lyon, Nice, Roma, Ajax, Genoa — des clubs
  // majeurs, et « 1. FC Köln » restait donc non rattaché alors que la base
  // compte 59 joueurs à Köln.
  //
  // Comparer des ENSEMBLES DE JETONS règle les deux problèmes d'un coup :
  // « lens » n'est pas un jeton de « valenciennes », donc la confusion
  // disparaît sans plancher de longueur, et un club d'un seul mot redevient
  // rattachable.
  //
  // On garde le candidat qui partage le PLUS de jetons : sans ça « Inter Milan »
  // se rattacherait à « AC Milan », dont le noyau « milan » est bien un
  // sous-ensemble du sien.
  const jetons = new Set(k.split(" "));
  const candidats = [];
  for (const [kb, club] of parNoyau) {
    const jb = kb.split(" ");
    const inclusBase = jb.every((m) => jetons.has(m));
    const inclusWiki = [...jetons].every((m) => jb.includes(m));
    if (!inclusBase && !inclusWiki) continue;
    const commun = jb.filter((m) => jetons.has(m));
    // Un rattachement sur un SEUL jeton court est trop fragile : « as » ou
    // « rio » ne désignent rien. Quatre lettres suffisent pour « lens » ou
    // « roma », qui sont des noms de clubs entiers.
    if (commun.length === 1 && commun[0].length < 4) continue;
    candidats.push({ club, commun: commun.length });
  }
  if (!candidats.length) return null;

  // ── À ÉGALITÉ, ON REFUSE ────────────────────────────────────────────────
  //
  // Ma première version départageait par NOMBRE D'OCCURRENCES, et ça a produit
  // une vraie faute : Wikidata rend « Athletic Club » — le nom officiel de
  // Bilbao — qui partage un jeton avec « Athletic Bilbao » ET avec « Wigan
  // Athletic ». Wigan comptant 101 joueurs contre 43, Peio Canales s'est vu
  // attribuer un club anglais où il n'a jamais joué.
  //
  // Une fausse appartenance est bien pire qu'un club manquant : elle crée une
  // paire que le tirage propose et que la vérification refuse. Donc à égalité de
  // jetons partagés, on ne tranche pas — on signale, et un humain décide.
  const maxi = Math.max(...candidats.map((c) => c.commun));
  const tetes = candidats.filter((c) => c.commun === maxi);
  if (tetes.length > 1) return null;
  const meilleur = tetes[0].club;
  return meilleur;
}

// ── WIKIDATA ──────────────────────────────────────────────────────────────
// Les sélections nationales et les équipes de jeunes ne sont pas des clubs. Le
// motif couvre l'anglais ET le français, parce que le repli sur le libellé
// français rend « équipe du Brésil de football des moins de 17 ans » — que la
// version anglaise seule laissait passer.
//
// `^Q\d+$` écarte les entités SANS libellé : Wikidata rend alors son identifiant
// brut, et « Q18151494 » se retrouvait signalé comme un club à décider.
const EXCLUS = /national|under-?\s?\d|u-?\d\d|olympic|women|youth|reserve|selecci|amateur|équipe (de|du|d')|sélection|moins de \d|espoirs|^Q\d+$/i;

async function sparql(requete) {
  const url = "https://query.wikidata.org/sparql?query=" + encodeURIComponent(requete);
  const r = await fetch(url, {
    headers: {
      Accept: "application/sparql-results+json",
      // Wikidata demande un agent identifiable ; sans lui les requêtes finissent
      // par être refusées en 429.
      "User-Agent": "GOATFC-fiches/1.0 (audit de la base joueurs)",
    },
  });
  if (!r.ok) throw new Error("SPARQL " + r.status);
  return (await r.json()).results.bindings;
}

/**
 * Les clubs d'un joueur, datés. On essaie le libellé ANGLAIS d'abord : il est
 * beaucoup plus proche de la convention de la base que le français, qui écrit
 * « Mayence 05 » pour Mainz et « Milan AC » pour l'AC Milan.
 */
async function clubsDe(nom) {
  for (const langue of ["en", "fr"]) {
    const lignes = await sparql(`
      SELECT ?clubLabel ?debut ?naissance ?posLabel ?natLabel WHERE {
        ?j rdfs:label ${JSON.stringify(nom)}@${langue} ; wdt:P106 wd:Q937857 .
        OPTIONAL { ?j wdt:P569 ?naissance }
        OPTIONAL { ?j wdt:P413 ?pos }
        OPTIONAL { ?j wdt:P27 ?nat }
        ?j p:P54 ?s . ?s ps:P54 ?club .
        OPTIONAL { ?s pq:P580 ?debut }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "${langue}". }
      } ORDER BY ?debut`);
    if (lignes.length) return { lignes, langue };
  }
  return { lignes: [], langue: null };
}

// ── SORTIE ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let noms = [];
if (args[0] === "--fichier") {
  noms = readFileSync(args[1], "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
} else {
  noms = args;
}
if (!noms.length) {
  console.error("usage : npx tsx scripts/fiches-wikidata.mjs \"Nom Joueur\" …");
  process.exit(2);
}

const dejaLa = new Set(PLAYERS.filter((p) => p?.name).map((p) => p.name));
const aDecider = new Map();
let trouves = 0, muets = 0;

for (const nom of noms) {
  if (dejaLa.has(nom)) { console.log(`\n══ ${nom}\n  DÉJÀ DANS LA BASE, ignoré`); continue; }

  let res;
  try { res = await clubsDe(nom); }
  catch (e) { console.log(`\n══ ${nom}\n  ⚠️ requête en échec : ${e.message}`); continue; }

  if (!res.lignes.length) {
    muets++;
    console.log(`\n══ ${nom}\n  ❌ WIKIDATA NE RÉPOND RIEN — à saisir à la main, ou nom différent là-bas`);
    continue;
  }
  trouves++;

  const vus = [], exclus = [], inconnus = [];
  let naissance = null, positions = new Set(), nationalites = new Set();
  for (const l of res.lignes) {
    if (l.naissance) naissance = l.naissance.value.slice(0, 4);
    if (l.posLabel) positions.add(l.posLabel.value);
    if (l.natLabel) nationalites.add(l.natLabel.value);
    const brut = l.clubLabel.value;
    if (EXCLUS.test(brut)) { if (!exclus.includes(brut)) exclus.push(brut); continue; }
    const c = canoniser(brut);
    if (!c) { if (!inconnus.includes(brut)) inconnus.push(brut); continue; }
    if (!vus.includes(c)) vus.push(c);
  }

  console.log(`\n══ ${nom}   (libellé ${res.langue}${naissance ? ", né en " + naissance : ""})`);
  console.log(`  clubs : ${vus.map((c) => `${c} [${occurrences.get(c)}]`).join(" → ") || "(aucun rattaché)"}`);
  if (inconnus.length) {
    console.log(`  ⚠️ CLUBS NON RATTACHÉS (à décider) : ${inconnus.join(" · ")}`);
    for (const i of inconnus) aDecider.set(i, (aDecider.get(i) || 0) + 1);
  }
  if (positions.size) console.log(`  postes Wikidata : ${[...positions].join(", ")}`);
  if (nationalites.size) console.log(`  nationalités Wikidata : ${[...nationalites].join(", ")}`);
  if (exclus.length) console.log(`  (sélections écartées : ${exclus.length})`);

  // La fiche telle qu'elle s'écrirait, à relire avant de la coller. Les postes et
  // la nationalité restent à traduire à la main : Wikidata les rend dans son
  // vocabulaire, pas dans celui du jeu.
  console.log(`  → { name:${JSON.stringify(nom)}, clubs:${JSON.stringify(vus)}, diff:"expert",`
    + ` nationalities:["?"], positions:["?"]${naissance ? `, birthYear:${naissance}` : ""} },`);

  // Wikidata refuse les rafales. Une seconde et demie entre deux requêtes.
  await new Promise((ok) => setTimeout(ok, 1500));
}

console.log(`\n\n══════ BILAN ══════`);
console.log(`  fiches proposées : ${trouves} · sans réponse Wikidata : ${muets}`);
if (aDecider.size) {
  console.log(`\n  CLUBS À DÉCIDER (absents de la base), par fréquence dans ce lot :`);
  for (const [c, n] of [...aDecider].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(n).padStart(2)}× ${c}`);
  }
  console.log(`\n  Règle du dépôt : ajouter un club DÉJÀ présent, n'ajouter un club`);
  console.log(`  nouveau que s'il est reconnaissable, sauter le reste — un club`);
  console.log(`  obscur devient un cul-de-sac de chaîne.`);
}
