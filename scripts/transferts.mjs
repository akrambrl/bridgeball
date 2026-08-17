#!/usr/bin/env node
// CHERCHE dans src/players.jsx les fiches qu'un mercato a périmées.
//
//     node scripts/transferts.mjs [--annee=2026] [--fenetre=summer] [--ecrire]
//
// Les deux outils qui existaient déjà (mercato-diff, mercato-maxifoot-diff)
// partent d'un JSON qu'un script Python doit produire avant, et comparent des
// EFFECTIFS : « qui est à Chelsea aujourd'hui ». Ils répondent bien à « la fiche
// connaît-elle ce club », mal à « ce joueur a-t-il bougé cet été » — un effectif
// ne dit pas d'où l'on vient.
//
// Celui-ci lit les listes de transferts de Wikipédia, qui sont des MOUVEMENTS :
// un joueur, un club quitté, un club rejoint. Le club quitté est ce qui manquait,
// et c'est lui qui fait tout le travail ci-dessous.
//
// ── LE CLUB DE DÉPART EST LA PIÈCE D'IDENTITÉ ────────────────────────────
//
// La base a 268 collisions de noms connues, et le mercato en fabrique d'autres :
// un « Javi Martínez » a quitté Eibar pour l'Eldense cet été, ce n'est pas celui
// du Bayern ; un « Mohamed Koné » a quitté Aston Villa, ce n'est pas celui de
// Charleroi. Comparer les prénoms/noms les confond, comparer les dates de
// naissance suppose que Wikipédia les donne — ce qu'il ne fait pas ici.
//
// Le club de départ, lui, est dans le mouvement ET dans la fiche. S'il n'y est
// pas, ce n'est pas le même homme, et on ne touche à rien. C'est ce qui sépare
// les trois piles de la sortie, et --ecrire n'inscrit QUE la première.
//
// ── ON N'INVENTE PAS DE CLUB ─────────────────────────────────────────────
//
// Un club absent de la base est écarté même quand le transfert est certain. Deux
// raisons : sa graphie serait choisie par ce script et non par la base, ce que
// clubs-canoniques.test.ts refuse ; et GOAT MERCATO enchaîne joueur → club →
// joueur, donc un club à un seul joueur est une impasse, pas un enrichissement.
// Ces cas sortent dans leur propre pile, à trancher à la main.

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (n, d) => (process.argv.find((a) => a.startsWith("--" + n + "=")) || "").split("=")[1] || d;
const ANNEE = arg("annee", String(new Date().getFullYear()));
const FENETRE = arg("fenetre", "summer");        // summer | winter
const ECRIRE = process.argv.includes("--ecrire");

// Les cinq grands championnats ne suffisent pas, et c'est un joueur qui l'a
// montré : il a signalé « N'Golo Kanté → Fenerbahçe » alors que la fiche
// s'arrêtait à Al-Ittihad. Le transfert était réel, mais un mouvement
// Arabie saoudite → Turquie n'apparaît dans AUCUNE des cinq listes. Tout ce
// qui se joue hors de l'Europe de l'Ouest était donc invisible — or ce sont
// précisément les fins de carrière, celles qui manquent le plus aux fiches.
//
// ── LA LISTE CI-DESSOUS N'EST PAS DEVINÉE ────────────────────────────────────
//
// Un premier élargissement avait ajouté Portugal, Turquie et Arabie saoudite.
// Les trois répondaient 404 à chaque passage : ces listes N'EXISTENT PAS sur
// Wikipédia en anglais. L'élargissement n'avait donc réellement apporté que les
// Pays-Bas et la Belgique, sous trois avertissements qui semblaient anodins.
//
// Les 28 listes existantes ont été énumérées à la source, par
// `intitle:"football transfers summer 2026"` sur l'API de recherche. Celles
// retenues sont celles dont les clubs sont VRAIMENT dans players.jsx, compté
// club par club :
//
//   Écosse      Celtic 88 fiches, Rangers 86
//   Russie      Spartak 26, Zenit 25, CSKA 20, Dynamo 20
//   Autriche    Salzburg 44
//   Suisse      Basel 38
//   Ukraine     Shakhtar 31
//   Danemark    Copenhague 36
//   Tchéquie    Slavia 38, Plzeň 19
//
// Écartées faute de présence dans la base : Arménie, Azerbaïdjan, Biélorussie,
// Bulgarie, Kazakhstan, Lettonie, Lituanie, Mexique, Norvège, Pologne,
// Roumanie, Slovaquie, Suède. Et « English women's », hors sujet ici.
//
// ⚠️ CE QUI RESTE AVEUGLE, ET QU'AUCUNE LISTE NE COUVRIRA : la Turquie, le
// Portugal et l'Arabie saoudite. Le signalement qui a lancé tout ça reste donc
// hors de portée de cet outil — les fins de carrière au Golfe et en Turquie ne
// se trouveront qu'à la main, ou par les signalements des joueurs.
const PAYS = ["English", "Spanish", "Italian", "French", "German",
              "Dutch", "Belgian", "Scottish", "Russian", "Austrian",
              "Swiss", "Ukrainian", "Danish", "Czech"];

// players.jsx porte l'extension .jsx sans contenir de JSX : Node refuse de
// l'importer. Même contournement que dans audit-tirage.mjs.
const CHEMIN = join(racine, "src", "players.jsx");
const { PLAYERS } = (function () {
  const txt = readFileSync(CHEMIN, "utf8");
  const noms = [...txt.matchAll(/^export const (\w+)/gm)].map((m) => m[1]);
  return new Function(txt.replace(/^export /gm, "") + `\nreturn {${noms.join(",")}};`)();
})();

// ── lecture des listes ───────────────────────────────────────────────────

// `other=to [[SL Benfica|Benfica]]` contient un « | » DANS le lien : découper les
// paramètres du modèle dessus coupe le nom du club en deux. On lit donc chaque
// champ jusqu'à la fin du lien.
const CHAMP = (c) => new RegExp(c + "=((?:\\[\\[[^\\]]*\\]\\]|\\{\\{[^}]*\\}\\}|[^|}])+)");

const lien = (s) => {
  const t = s.replace(/\{\{[^}]*\}\}/g, " ").trim();   // {{flagicon|ESP}} devant le lien
  const m = t.match(/\[\[([^\]]+)\]\]/);
  if (!m) return t.trim();
  const p = m[1].split("|");
  return (p[1] ?? p[0]).trim();
};

async function listeDe(pays) {
  const page = `List_of_${pays}_football_transfers_${FENETRE}_${ANNEE}`;
  const r = await fetch(`https://en.wikipedia.org/w/index.php?title=${page}&action=raw`);
  if (!r.ok) { console.log(`  ⚠️  ${pays} : HTTP ${r.status}, liste ignorée`); return []; }
  const texte = await r.text();

  // Les mouvements sont rangés sous un titre de club (=== [[FC Barcelona|Barcelona]] ===),
  // et chaque ligne dit « from X » (arrivée) ou « to Y » (départ). Le club de la
  // section est donc l'autre bout du mouvement.
  const out = [];
  let section = null;
  for (const ligne of texte.split("\n")) {
    // Les listes néerlandaise et belge rangent les clubs un niveau plus bas,
    // en `==== Club ====`. Avec un motif figé à trois signes, le quatrième
    // fuyait dans le nom : « =Antwerp= ». Le rapprochement tenait quand même —
    // `cle()` ignore la ponctuation — mais la sortie affichait un club qui
    // n'existe pas, et le prochain format aurait fini par casser la comparaison.
    const t = ligne.match(/^={3,}\s*(.+?)\s*={3,}\s*$/);
    if (t) { section = lien(t[1]); continue; }
    const fp = ligne.match(/\{\{fs player\|(.*)$/i);
    if (!fp || !section) continue;
    const nom = fp[1].match(CHAMP("name"));
    const autre = fp[1].match(CHAMP("other"));
    if (!nom || !autre) continue;
    const brut = autre[1].trim();
    const sens = /^from\b/i.test(brut) ? "from" : /^to\b/i.test(brut) ? "to" : null;
    if (!sens) continue;
    const club = lien(brut.replace(/^(from|to)\s*/i, ""));
    if (!club || /^TBD$/i.test(club)) continue;        // libéré, sans club connu
    out.push(sens === "from"
      ? { joueur: lien(nom[1]), de: club, vers: section }
      : { joueur: lien(nom[1]), de: section, vers: club });
  }
  return out;
}

// ── rapprochement des graphies ───────────────────────────────────────────

const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

// Wikipédia écrit « VfL Wolfsburg » là où la base écrit « Wolfsburg ». On rabote
// les formes juridiques et les années de fondation, puis on traite à la main ce
// qui reste — un alias faux crée un doublon de club, que le test canonique
// refuse ; il vaut mieux rater un rapprochement que d'en inventer un.
const ALIAS = {
  "paris saintgermain": "psg", "internazionale": "inter", "inter milan": "inter",
  "tottenham hotspur": "tottenham", "newcastle united": "newcastle",
  "wolverhampton wanderers": "wolves", "juventus fc": "juventus",
  "hamburger": "hamburg", "stade rennais": "rennes", "olympique lyonnais": "lyon",
  "olympique de marseille": "marseille", "sporting lisbon": "sporting cp",
  "st pauli": "sankt pauli", "1899 hoffenheim": "hoffenheim", "red bull salzburg": "salzburg",
  "athletic club": "athletic bilbao", "real betis balompie": "real betis", "betis": "real betis",
  "ajax amsterdam": "ajax", "psv eindhoven": "psv", "paok thessaloniki": "paok",
  "deportivo a coruna": "deportivo la coruna", "heart of midlothian": "hearts",
  "hertha bsc": "hertha berlin", "royal antwerp": "antwerp",
  "union de santa fe": "union santa fe",
};
const cle = (s) => {
  const k = norm(s)
    .replace(/^(fc|ac|as|sc|ss|ssc|cf|cd|rc|sv|ca|ud|sl|afc|vfb|vfl|tsg|bsc|fsv|1 fc|1 fsv|1)\s+/, "")
    .replace(/\s+(fc|cf|sc|ac|calcio|bc|jk|sad|sv|04|05|96|98|1899|1846)$/, "")
    .replace(/^borussia\s+/, "");
  return ALIAS[k] ?? k;
};

// La graphie de référence d'un club est celle que la base emploie déjà le plus —
// on ne fait jamais entrer une orthographe venue d'ailleurs.
const vocabulaire = new Map();
for (const p of PLAYERS) for (const c of p.clubs ?? []) {
  const k = cle(c), m = vocabulaire.get(k) ?? new Map();
  m.set(c, (m.get(c) ?? 0) + 1);
  vocabulaire.set(k, m);
}
const canonique = (club) => {
  const v = vocabulaire.get(cle(club));
  return v ? [...v].sort((a, b) => b[1] - a[1])[0][0] : null;
};

// ── tri ──────────────────────────────────────────────────────────────────

console.log(`listes ${FENETRE} ${ANNEE} — ${PAYS.join(", ")}`);
const mouvements = (await Promise.all(PAYS.map(listeDe))).flat();
console.log(`${mouvements.length} mouvements lus\n`);

const parNom = new Map(PLAYERS.map((p) => [norm(p.name), p]));
const connait = (p, club) => (p.clubs ?? []).some((c) => cle(c) === cle(club));

const aInscrire = [], clubInconnu = [], homonymes = [];
const vus = new Set();
for (const m of mouvements) {
  const p = parNom.get(norm(m.joueur));
  if (!p || connait(p, m.vers)) continue;               // absent de la base, ou déjà à jour
  const k = p.name + "|" + cle(m.vers);
  if (vus.has(k)) continue;
  vus.add(k);
  if (!connait(p, m.de)) { homonymes.push({ p, ...m }); continue; }
  const club = canonique(m.vers);
  if (!club) { clubInconnu.push({ p, ...m }); continue; }
  aInscrire.push({ p, ...m, club });
}

const pile = (titre, liste, ligne) => {
  console.log(`\n═══ ${titre} : ${liste.length}\n`);
  for (const r of [...liste].sort((a, b) => a.p.name.localeCompare(b.p.name))) console.log("  " + ligne(r));
};
pile("À INSCRIRE — le club de départ confirme que c'est bien lui", aInscrire,
  (r) => r.p.name.padEnd(26) + (r.de + " → " + r.club).padEnd(46) + "[" + r.p.diff + "]");
pile("CLUB ABSENT DE LA BASE — à créer à la main, ou à laisser", clubInconnu,
  (r) => r.p.name.padEnd(26) + r.de + " → " + r.vers);
pile("DÉPART INCONNU DE LA FICHE — homonyme, ou fiche incomplète", homonymes,
  (r) => r.p.name.padEnd(26) + (r.de + " → " + r.vers).padEnd(46) + "fiche=[" + (r.p.clubs ?? []).join(", ") + "]");

// ── écriture ─────────────────────────────────────────────────────────────

if (!ECRIRE) {
  console.log(`\n(lecture seule — relancer avec --ecrire pour inscrire les ${aInscrire.length} premiers)`);
  process.exit(0);
}

// Une fiche par ligne : on remplace le clubs:[…] de CETTE ligne, et seulement si
// le nom n'y apparaît qu'une fois — un nom porté par deux fiches est justement le
// cas où l'on ne sait pas laquelle mettre à jour.
const lignes = readFileSync(CHEMIN, "utf8").split("\n");
const faits = [], sautes = [];
for (const r of aInscrire) {
  const idx = lignes.flatMap((l, i) => (l.includes(`name:"${r.p.name}"`) ? [i] : []));
  if (idx.length !== 1) { sautes.push(`${r.p.name} — ${idx.length} fiches portent ce nom`); continue; }
  const i = idx[0];
  if (!/clubs:\[(.*?)\]/.test(lignes[i])) { sautes.push(`${r.p.name} — pas de clubs:[]`); continue; }
  lignes[i] = lignes[i].replace(/clubs:\[(.*?)\]/, `clubs:[$1, "${r.club}"]`);
  faits.push(`${r.p.name} → ${r.club}`);
}
writeFileSync(CHEMIN, lignes.join("\n"));
console.log(`\n${faits.length} fiches mises à jour dans src/players.jsx`);
for (const s of sautes) console.log("  sautée : " + s);
console.log("\nLancer `npm test` : clubs-canoniques refuse une graphie de club en double.");
