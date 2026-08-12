#!/usr/bin/env node
// FIGE le calendrier de la devinette du jour.
//
//     node scripts/devinette-rotation.mjs            # étend la rotation
//     node scripts/devinette-rotation.mjs --init     # la crée (une seule fois)
//     node scripts/devinette-rotation.mjs --verifie   # ne touche à rien, rapporte
//
// ── LE DÉFAUT QUE CE FICHIER EXISTE POUR EMPÊCHER ──────────────────────────
//
// `joueurDuJour` faisait `arr[jour % vivier.length]` sur un vivier RECALCULÉ à
// chaque exécution depuis players.jsx. Le mélange avait bien une graine fixe, mais
// il mélangeait une liste dont le CONTENU et la TAILLE bougent : il suffit qu'un
// joueur entre ou sorte du vivier pour que tout le calendrier se réordonne, passé
// comme futur.
//
// Ce n'est pas théorique. En passant le comptage des clubs de `clubs.length` à
// `nbClubs` — pour que Zlatan et Lukaku cessent d'être exclus par un club compté
// deux fois — le vivier est passé de 96 à 97 joueurs, et les DOUZE jours de la
// fenêtre examinée ont changé de joueur. Sur la même semaine, players.jsx a été
// modifié cinq fois (mercato, comptage des clubs) : cinq réordonnancements, donc
// autant d'occasions de resservir quelqu'un déjà vu.
//
// Or toucher à players.jsx est une activité HEBDOMADAIRE : c'est le mercato. Un
// calendrier qui se réordonne à chaque transfert n'est pas un calendrier.
//
// ── POURQUOI UNE LISTE FIGÉE, ET PAS UN MEILLEUR CALCUL ────────────────────
//
// Il y a une tension irréductible entre les deux promesses du mode :
//
//   « chaque joueur passe une seule fois »  → il faut une PERMUTATION du vivier,
//                                              qui dépend donc de son contenu ;
//   « le joueur d'un jour ne change jamais » → il faut que le choix d'un jour soit
//                                              INDÉPENDANT des autres membres.
//
// Aucune formule ne tient les deux. Un tirage par hachage indépendant (chaque
// joueur tire un jeton pour le jour, le plus fort gagne) rendrait les jours
// stables, mais autoriserait des répétitions à quelques jours d'intervalle — le
// défaut qu'on répare. Une permutation garde l'unicité mais bouge avec le vivier.
//
// La sortie est de ne plus CALCULER le calendrier mais de l'ÉCRIRE : une liste
// ordonnée de noms, à laquelle on ne fait qu'AJOUTER. Les positions déjà
// attribuées ne bougent jamais, et un nouveau joueur prend une place à la fin.
// C'est la seule construction qui tienne les deux promesses.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, "..");
const CHEMIN = join(racine, "src", "lib", "devinette-rotation.js");

const args = process.argv.slice(2);
const INIT = args.includes("--init");
const VERIFIE = args.includes("--verifie");

// players.jsx est un fichier de données pur : il s'importe tel quel depuis Node.
const { PLAYERS, RETIRED_PLAYERS } = await import(join(racine, "src", "players.jsx"));
const dev = await import(join(racine, "src", "lib", "devinette.js"));

const vivier = dev.poolDevinette(PLAYERS, RETIRED_PLAYERS);
const noms = vivier.map((p) => p.name);

let actuel = { epoque: null, rotation: [] };
try {
  const mod = await import(CHEMIN + "?t=" + Date.now());
  actuel = { epoque: mod.EPOQUE_JOUR, rotation: mod.ROTATION.slice() };
} catch (e) {
  if (!INIT) {
    console.error("Rotation absente. Crée-la d'abord :\n  node scripts/devinette-rotation.mjs --init");
    process.exit(1);
  }
}

/** Mélange déterministe : même entrée, même sortie, sur toutes les machines. */
function melanger(liste, graine) {
  let s = graine % 2147483647;
  if (s <= 0) s += 2147483646;
  const suivant = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const a = liste.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(suivant() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

let epoque = actuel.epoque;
let rotation = actuel.rotation;

if (INIT) {
  // ── QUEL JOUR OUVRE LE CALENDRIER ────────────────────────────────────────
  // Par défaut le jour de PARIS en cours, réglable par --epoque=YYYY-MM-DD.
  //
  // Remplacer la devinette d'un jour déjà commencé n'est acceptable que tôt, et
  // avant que la notification ne soit partie : ceux qui ont déjà joué gardent leur
  // partie en localStorage, avec l'ancien joueur, et se retrouveraient avec une
  // réponse différente de celle des autres. C'était le cas ici — quelques minutes
  // après minuit à Paris, notification de midi non encore envoyée — donc corriger
  // le jour même valait mieux qu'attendre 24 h de plus avec une répétition à
  // l'écran. Plus tard dans la journée, passe --epoque=<demain>.
  const demande = (args.find((a) => a.startsWith("--epoque=")) || "").split("=")[1];
  const jourParis = dev.parisDay();
  const ouverture = demande || jourParis;
  epoque = dev.jourIndex(ouverture);

  // Les joueurs servis RÉCEMMENT par l'ancien calcul sont repoussés en fin de
  // premier cycle : c'est tout l'objet du signalement — ne pas resservir dans la
  // semaine quelqu'un qu'on vient de voir.
  const recents = new Set();
  for (let i = 1; i <= 21; i++) {
    const j = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const p = dev.joueurDuJour(vivier, j);
    if (p) recents.add(p.name);
  }
  const premier = melanger(noms, 20260813);
  rotation = [...premier.filter((n) => !recents.has(n)), ...premier.filter((n) => recents.has(n))];
  console.log("époque = " + ouverture + (ouverture === jourParis
    ? "  (le jour EN COURS est remplacé — voir le commentaire)" : ""));
  console.log(recents.size + " joueurs vus dans les 21 derniers jours, repoussés en fin de cycle");
} else {
  // ── L'EXTENSION : on n'AJOUTE que. Réordonner reviendrait à reproduire le
  // défaut, et insérer au milieu décalerait tous les jours suivants.
  const deja = new Set(rotation);
  const nouveaux = melanger(noms.filter((n) => !deja.has(n)), 20260813 + rotation.length);
  const partis = rotation.filter((n) => !noms.includes(n));
  if (nouveaux.length) console.log("+ " + nouveaux.length + " joueur(s) ajouté(s) en fin de liste : "
    + nouveaux.slice(0, 8).join(", ") + (nouveaux.length > 8 ? "…" : ""));
  if (partis.length) console.log("⚠ " + partis.length + " nom(s) de la rotation ne sont plus dans le vivier : "
    + partis.slice(0, 8).join(", ") + "\n  Ils RESTENT dans la liste : les retirer décalerait tous les jours"
    + "\n  suivants. joueurDuJour les enjambe pour la journée concernée.");
  if (!nouveaux.length && !partis.length) console.log("rien à faire : la rotation couvre exactement le vivier.");
  rotation = [...rotation, ...nouveaux];
}

// ── DE QUOI TENIR UN AN, ET LA JOINTURE DES CYCLES ─────────────────────────
//
// Un seul cycle ne fait que la taille du vivier — environ trois mois. Passé sa
// fin, joueurDuJour retombe sur l'ancien calcul, donc sur l'instabilité qu'on
// répare : la liste doit couvrir large.
//
// Et une jointure de cycles est un endroit à risque : rien n'empêche le dernier
// joueur d'un cycle de rouvrir le suivant, ce qui donnerait deux jours de suite le
// même joueur. Chaque nouveau cycle est donc pivoté pour que ses premiers noms ne
// figurent pas dans la fin du précédent.
const COUVERTURE_MINI = Number(process.env.COUVERTURE || 400);
const ECART_JOINTURE = 12;
let cycle = 1;
while (rotation.length < COUVERTURE_MINI && noms.length > ECART_JOINTURE) {
  const suivant = melanger(noms, 20260813 + 7919 * ++cycle);
  const finPrecedente = new Set(rotation.slice(-ECART_JOINTURE));
  // Il ne suffit PAS que le premier nom diffère : le premier essai a produit deux
  // répétitions à 11 jours d'écart, un peu après la jointure. La condition qui
  // suffit est que les DOUZE premiers noms du nouveau cycle soient disjoints des
  // douze derniers du précédent — alors tout écart vaut au moins treize jours,
  // puisqu'un nom présent dans une fenêtre est absent de l'autre.
  let d = 0;
  for (let essai = 0; essai < suivant.length; essai++) {
    const debut = [...suivant.slice(essai, essai + ECART_JOINTURE),
                   ...suivant.slice(0, Math.max(0, essai + ECART_JOINTURE - suivant.length))];
    if (!debut.some((n) => finPrecedente.has(n))) { d = essai; break; }
  }
  const pivote = [...suivant.slice(d), ...suivant.slice(0, d)];
  rotation = [...rotation, ...pivote];
}

// Contrôle avant écriture : aucun joueur ne doit revenir à moins de 12 jours.
const trop = [];
for (let i = 1; i < rotation.length; i++) {
  for (let k = 1; k <= ECART_JOINTURE && i - k >= 0; k++) {
    if (rotation[i] === rotation[i - k]) trop.push(rotation[i] + " aux positions " + (i - k) + " et " + i);
  }
}
if (trop.length) {
  console.error("REFUS : " + trop.length + " répétition(s) à moins de " + ECART_JOINTURE
    + " jours — " + trop.slice(0, 3).join(", "));
  process.exit(1);
}
console.log("contrôle : aucune répétition à moins de " + ECART_JOINTURE + " jours sur "
  + rotation.length + " jours");

if (VERIFIE) {
  console.log("\n--verifie : rien n'a été écrit.");
  console.log("  époque " + epoque + " · " + rotation.length + " noms · vivier " + noms.length);
  process.exit(0);
}

const entete = `// LE CALENDRIER DE LA DEVINETTE DU JOUR — écrit, pas calculé.
//
// Généré par scripts/devinette-rotation.mjs. À N'ÉDITER QUE PAR CE SCRIPT, qui
// n'AJOUTE jamais qu'à la fin.
//
// Pourquoi ce fichier existe : le joueur du jour était \`vivier[jour % taille]\`,
// donc il changeait dès qu'un joueur entrait ou sortait du vivier. Un simple
// transfert écrit dans players.jsx réordonnait tout le calendrier, passé compris —
// et players.jsx bouge chaque semaine. Le tout est expliqué en tête du script.
//
// EPOQUE_JOUR est l'index de jour (jourIndex) de la première case. ROTATION[0] est
// donc le joueur de ce jour-là, ROTATION[1] celui du lendemain, et ainsi de suite.
// Une case déjà attribuée ne doit JAMAIS changer de nom.

export const EPOQUE_JOUR = ${epoque};

export const ROTATION = [
${rotation.map((n) => "  " + JSON.stringify(n) + ",").join("\n")}
];
`;
await writeFile(CHEMIN, entete);
console.log("\nécrit " + CHEMIN.replace(racine + "/", "") + " — " + rotation.length + " jours de calendrier ("
  + (rotation.length / 30.4).toFixed(1) + " mois)");
