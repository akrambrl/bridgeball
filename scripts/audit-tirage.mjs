// Audit du TIRAGE des questions dans les quatre modes de jeu.
//
//     node scripts/audit-tirage.mjs            # rapport
//     PARTIES=5000 node scripts/audit-tirage.mjs
//
// La question posée : « est-ce que ce ne sont pas toujours les mêmes questions
// qui sortent ? » Elle ne se répond pas en lisant le code, parce que la variété
// ne dépend pas seulement du tirage : elle dépend de la TAILLE du vivier qu'il
// tire dedans, et cette taille est une propriété des données, pas du code. Un
// shuffle parfait sur 30 questions répète tout le temps.
//
// Ce script simule donc des parties et compte. Deux mesures par mode :
//   • le vivier — combien de questions distinctes le mode peut poser ;
//   • la reprise — sur N parties d'affilée, quelle part des questions vues dans
//     une partie l'avaient déjà été dans la précédente.
//
// POURQUOI ON EXTRAIT LE CODE AU LIEU DE LE RECOPIER : buildPontDB, DUEL_CLUBS,
// duelRollPair et les listes de clubs vivent dans LePont.jsx, un fichier de
// composant React qu'on ne peut pas importer hors du bundle. Les recopier ici
// ferait un audit de la copie et non du jeu : le jour où le vivier change dans
// LePont.jsx, le script continuerait à afficher les anciens chiffres. On lit
// donc le source et on en extrait les déclarations telles quelles.
import { readFileSync } from "node:fs";
// Les règles de tirage anti-répétition sont dans une lib .js sans import, donc
// Node sait la lire : on la charge pour de vrai au lieu de la découper dans le
// source. Ce qui est mesuré ici est exactement ce que le jeu exécute.
import { clePaire, pairesJouables, tirerEnEvitant, memoriser } from "../src/lib/tirage.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, "..");
const PARTIES = parseInt(process.env.PARTIES || "2000", 10);

// ── Extraction des déclarations depuis LePont.jsx ────────────────────────────
const SRC = readFileSync(join(racine, "src", "components", "LePont.jsx"), "utf8");

// Découpe une déclaration entière à partir de son mot-clé, en équilibrant
// (){}[] et en ignorant ce qui est dans une chaîne ou un commentaire. Un simple
// « jusqu'à la prochaine ligne qui commence par const » casse dès qu'un objet
// contient une accolade en début de ligne, et un regex non balancé coupe
// PONT_CLUBS au milieu.
//
// Deux règles de fin, parce que les deux formes ne finissent pas pareil :
//   • `function f(a){…}` finit sur l'accolade qui ferme son CORPS. On ne peut
//     pas s'arrêter au premier retour à l'équilibre : ce serait la parenthèse
//     fermante des paramètres, et on rendrait « function shuffle(arr) ».
//   • `const X = …` finit au point-virgule ou au saut de ligne hors de tout bloc.
function extrait(nom) {
  const debuts = [`\nconst ${nom} = `, `\nconst ${nom}=`, `\nfunction ${nom}(`];
  let i = -1;
  for (const d of debuts) { i = SRC.indexOf(d); if (i !== -1) { i += 1; break; } }
  if (i === -1) throw new Error(`déclaration introuvable dans LePont.jsx : ${nom}`);
  const estFonction = SRC.startsWith("function", i);
  let prof = 0, corpsOuvert = false, chaine = null, commentaire = null;
  for (let j = i; j < SRC.length; j++) {
    const c = SRC[j], suivant = SRC[j + 1];
    if (commentaire === "ligne") { if (c === "\n") commentaire = null; continue; }
    if (commentaire === "bloc") { if (c === "*" && suivant === "/") { commentaire = null; j++; } continue; }
    if (chaine) {
      if (c === "\\") { j++; continue; }
      if (c === chaine) chaine = null;
      continue;
    }
    if (c === "/" && suivant === "/") { commentaire = "ligne"; j++; continue; }
    if (c === "/" && suivant === "*") { commentaire = "bloc"; j++; continue; }
    if (c === '"' || c === "'" || c === "`") { chaine = c; continue; }
    if (c === "(" || c === "[") prof++;
    else if (c === "{") { prof++; if (estFonction && prof === 1) corpsOuvert = true; }
    else if (c === ")" || c === "]") prof--;
    else if (c === "}") {
      prof--;
      if (estFonction && corpsOuvert && prof === 0) return SRC.slice(i, j + 1);
    } else if (!estFonction && (c === ";" || c === "\n") && prof === 0) {
      return SRC.slice(i, j + 1);
    }
  }
  throw new Error(`déclaration non terminée : ${nom}`);
}

// players.jsx porte l'extension .jsx sans contenir de JSX : Node refuse de
// l'importer (ERR_UNKNOWN_FILE_EXTENSION) alors que son contenu est du JS pur.
// Les tests y accèdent via Vite, qui transforme. Ici on l'évalue directement —
// c'est un fichier de données, pas de composants.
const { PLAYERS, RETIRED_PLAYERS } = (function () {
  const txt = readFileSync(join(racine, "src", "players.jsx"), "utf8");
  const noms = [...txt.matchAll(/^export const (\w+)/gm)].map(m => m[1]);
  return new Function(txt.replace(/^export /gm, "") + `\nreturn {${noms.join(",")}};`)();
})();

// On évalue les déclarations dans UN seul scope, dans l'ordre des dépendances,
// avec PLAYERS/RETIRED_PLAYERS injectés. G n'est référencé que par des couleurs
// de thème, jamais par le tirage : un bouchon suffit.
// L'ORDRE compte : DUEL_PAIRES est un const dont l'initialiseur s'exécute à
// l'évaluation et appelle duelCommonPlayers sur DUEL_CLUBS — les deux doivent
// donc être déclarés avant lui. Les `function` sont hissées, les `const` non.
const A_EXTRAIRE = [
  "POPULAR_CLUBS_FACILE", "PONT_CLUBS", "ELITE_CLUBS_RANK", "FAMOUS_CLUBS", "DUEL_CLUBS",
  "shuffle", "isRetiredPlayer", "famousClubCount", "getClubRank",
  "getPlayersForClub", "duelCommonPlayers",
  "DUEL_PAIRES", "DUEL_MEMOIRE", "DUEL_MEMOIRE_MAX", "duelPairesRecentes", "duelRollPair",
  "buildPontDB",
];
const source = A_EXTRAIRE.map(extrait).join("\n");

// duelRollPair mémorise désormais ses paires dans localStorage, qui n'existe pas
// dans Node. On lui en fournit un, et on l'expose : chaque « joueur » simulé doit
// partir d'une mémoire vierge, sinon les 400 essais de la médiane se partagent
// l'historique et le résultat ne veut plus rien dire.
const memoire = new Map();
const faussestockage = {
  getItem: k => (memoire.has(k) ? memoire.get(k) : null),
  setItem: (k, v) => { memoire.set(k, String(v)); },
  removeItem: k => { memoire.delete(k); },
  clear: () => memoire.clear(),
};

const jeu = new Function("PLAYERS", "RETIRED_PLAYERS", "G", "localStorage",
  "clePaire", "pairesJouables", "tirerEnEvitant", "memoriser", `
  const PLAYERS_CLEAN = PLAYERS.filter(p => p && p.name && p.clubs && Array.isArray(p.clubs));
  const CLUB_INDEX = {};
  for (const p of PLAYERS_CLEAN) {
    if (!p || !p.clubs) continue;
    for (const c of p.clubs) {
      if (!CLUB_INDEX[c]) CLUB_INDEX[c] = [];
      if (!CLUB_INDEX[c].includes(p.name)) CLUB_INDEX[c].push(p.name);
    }
  }
  ${source}
  return { PLAYERS_CLEAN, CLUB_INDEX, DUEL_CLUBS, DUEL_PAIRES, FAMOUS_CLUBS,
           POPULAR_CLUBS_FACILE, PONT_CLUBS, shuffle, isRetiredPlayer, famousClubCount,
           duelCommonPlayers, duelRollPair, buildPontDB };
`)(PLAYERS, RETIRED_PLAYERS, new Proxy({}, { get: () => "#000" }), faussestockage,
   clePaire, pairesJouables, tirerEnEvitant, memoriser);

const { PLAYERS_CLEAN, DUEL_CLUBS, DUEL_PAIRES, shuffle, isRetiredPlayer,
        famousClubCount, duelCommonPlayers, duelRollPair, buildPontDB } = jeu;
const DB = buildPontDB();

// ── Outils de mesure ────────────────────────────────────────────────────────
// Pourquoi la reprise se mesure d'une partie à la SUIVANTE et non sur toutes :
// c'est ce que le joueur ressent. « J'ai déjà eu cette question » se dit de la
// partie d'avant, pas de la 40e d'il y a trois semaines.
function reprise(fabrique, n = 200) {
  const tirer = fabrique();
  const parties = Array.from({ length: n }, () => tirer());
  let recouvre = 0, total = 0;
  for (let i = 1; i < parties.length; i++) {
    const avant = new Set(parties[i - 1]);
    for (const q of parties[i]) { total++; if (avant.has(q)) recouvre++; }
  }
  return total ? recouvre / total : 0;
}

// Combien de parties avant de revoir une question déjà vue (médiane) — l'autre
// façon de dire la même chose, celle qui parle en nombre de parties.
function medianeAvantRepetition(fabrique, essais = 400) {
  const mesures = [];
  for (let e = 0; e < essais; e++) {
    const tirer = fabrique();   // état d'anti-répétition NEUF à chaque essai
    const vues = new Set();
    let n = 0;
    for (;;) {
      n++;
      const partie = tirer();
      let doublon = false;
      for (const q of partie) if (vues.has(q)) { doublon = true; break; }
      for (const q of partie) vues.add(q);
      if (doublon || n > 500) break;
    }
    mesures.push(n);
  }
  mesures.sort((a, b) => a - b);
  return mesures[Math.floor(mesures.length / 2)];
}

function pct(x) { return (x * 100).toFixed(1) + " %"; }
function titre(t) { console.log("\n" + "━".repeat(74) + "\n" + t + "\n" + "━".repeat(74)); }

// Combien de questions distinctes sur PARTIES parties, et la part du vivier
// effectivement visitée.
function couverture(fabrique, vivier, parties = PARTIES) {
  const tirer = fabrique();
  const vues = new Map();
  let posees = 0;
  for (let i = 0; i < parties; i++) {
    for (const q of tirer()) { vues.set(q, (vues.get(q) || 0) + 1); posees++; }
  }
  const compte = [...vues.entries()].sort((a, b) => b[1] - a[1]);
  return { distinctes: vues.size, vivier, posees, top: compte.slice(0, 5), compte };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. THE PLUG (pont) — deux clubs, trouver un joueur passé par les deux
// ═══════════════════════════════════════════════════════════════════════════
// Le tirage reproduit ici est celui de startRound() : shuffle du vivier de la
// difficulté, priorité aux paires avec joueur actif, puis anti-répétition solo
// qui repousse en fin de queue les paires des parties récentes. La queue contient
// TOUT le vivier ; ce qui compte est donc combien de questions le joueur consomme
// en tête de queue avant que le chrono tombe.
//
// Ce nombre n'est pas deviné : il vient de la production. Sur bb_scores, la
// médiane de « pont / facile » est de 315 points, et une bonne réponse en facile
// rapporte 10 (base) + 5 si rapide + 0/10/20/30 de combo, soit ~25 en moyenne
// sur une série — donc ~13 questions par partie de 90 s. Le p90 (700 pts) monte
// à ~26. On prend 13 : la mesure doit décrire le joueur médian, pas le meilleur.
const QUESTIONS_PAR_PARTIE_PONT = 13;

function tirerPont(diff, avecAntiRepetition) {
  const recentKey = [];
  return function () {
    const dbPool = DB[diff] || [];
    const currentQ = dbPool.filter(q => q.isCurrent);
    const retiredQ = dbPool.filter(q => !q.isCurrent);
    const targetCurrent = Math.round(dbPool.length * 0.8);
    const targetRetired = dbPool.length - targetCurrent;
    const picked = [
      ...shuffle([...currentQ]).slice(0, Math.max(targetCurrent, currentQ.length)),
      ...shuffle([...retiredQ]).slice(0, Math.min(targetRetired, retiredQ.length)),
    ];
    let q = shuffle(picked.length > 0 ? picked : [...dbPool]);
    if (avecAntiRepetition && recentKey.length) {
      const recentSet = new Set(recentKey);
      const fresh = q.filter(it => !recentSet.has(it.c1 + "|||" + it.c2));
      const stale = q.filter(it => recentSet.has(it.c1 + "|||" + it.c2));
      if (fresh.length >= 30) q = [...fresh, ...stale];
    }
    const partie = q.slice(0, QUESTIONS_PAR_PARTIE_PONT).map(it => it.c1 + " / " + it.c2);
    // Fidèle à endRound() : on mémorise les 30 PREMIÈRES de la queue — pas les
    // questions réellement jouées — dédoublonnées, plafond 60 (« 2 parties de
    // 30 »). Le plafond est ce qui décide de l'efficacité de l'anti-répétition,
    // et 60 sur un vivier de 259 en facile, c'est près d'un quart du vivier
    // écarté à chaque partie.
    const vues = q.slice(0, 30).map(it => it.c1 + "|||" + it.c2);
    const fusion = [...new Set([...vues, ...recentKey])].slice(0, 60);
    recentKey.length = 0;
    recentKey.push(...fusion);
    return partie;
  };
}

titre("1. THE PLUG — vivier de paires de clubs");
for (const diff of ["facile", "moyen", "expert"]) {
  const pool = DB[diff] || [];
  console.log(`  ${diff.padEnd(7)} : ${String(pool.length).padStart(5)} paires`
    + `   (dont ${pool.filter(q => q.isCurrent).length} avec joueur actif)`);
}
console.log(`  ${"TOTAL".padEnd(7)} : ${String(["facile","moyen","expert"].reduce((n,d)=>n+(DB[d]||[]).length,0)).padStart(5)} paires`);

for (const diff of ["facile", "moyen"]) {
  const vivier = (DB[diff] || []).length;
  const fab = () => tirerPont(diff, true);
  const c = couverture(fab, vivier);
  const r = reprise(fab);
  console.log(`\n  → ${diff} : ${QUESTIONS_PAR_PARTIE_PONT} questions/partie sur un vivier de ${vivier}`);
  console.log(`     ${c.distinctes} paires distinctes vues sur ${PARTIES} parties (${pct(c.distinctes / vivier)} du vivier)`);
  console.log(`     reprise d'une partie à la suivante : ${pct(r)}`);
  console.log(`     médiane avant la 1re répétition : ${medianeAvantRepetition(fab)} parties`);
  console.log(`     paires les plus vues : ${c.top.map(([k, n]) => k + " ×" + n).join(", ")}`);
}

// Combien de clubs différents le vivier « facile » du Plug fait-il tourner ?
// Une paire est une combinaison de deux clubs : si le vivier ne contient que
// 25 clubs, le joueur voit 25 écussons en boucle même avec 259 paires distinctes.
{
  const clubs = new Set();
  for (const q of DB["facile"] || []) { clubs.add(q.c1); clubs.add(q.c2); }
  const clubsMoyen = new Set();
  for (const q of DB["moyen"] || []) { clubsMoyen.add(q.c1); clubsMoyen.add(q.c2); }
  console.log(`\n  Clubs distincts dans le vivier : ${clubs.size} en facile, ${clubsMoyen.size} en moyen`);
  console.log(`  → en facile, ${clubs.size} clubs donneraient ${clubs.size * (clubs.size - 1) / 2} paires possibles ;`
    + ` ${(DB["facile"]||[]).length} sont réellement jouables (les autres n'ont aucun joueur commun).`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. THE MERCATO (chaine) — un joueur de départ, puis on enchaîne
// ═══════════════════════════════════════════════════════════════════════════
// Ici UNE SEULE chose est tirée : le joueur de départ. Tout le reste de la
// partie découle des clubs de ce joueur et des réponses données. Le vivier des
// « questions » est donc le vivier des STARTERS — c'est lui qui décide si deux
// parties se ressemblent.
function starterPool(diff) {
  const starterDiff = diff === "expert" ? "facile" : diff;
  const eligible = PLAYERS_CLEAN.filter(p => {
    if (p.clubs.length < 2) return false;
    if (starterDiff === "facile") return p.diff === "facile";
    if (starterDiff === "moyen") return p.diff === "facile" || p.diff === "moyen";
    return true;
  });
  const eligibleFacile = starterDiff === "facile" ? eligible.filter(p => famousClubCount(p) >= 2) : eligible;
  return eligibleFacile.length > 0 ? eligibleFacile : eligible;
}

function tirerMercato(diff) {
  const recents = [];
  const pool = starterPool(diff);
  const currentPool = pool.filter(p => !isRetiredPlayer(p.name));
  const retiredPool = pool.filter(p => isRetiredPlayer(p.name));
  return function () {
    const useCurrent = Math.random() < 0.8 && currentPool.length > 0;
    let startPool = useCurrent ? currentPool : (retiredPool.length > 0 ? retiredPool : pool);
    if (recents.length) {
      const recentSet = new Set(recents);
      const fresh = startPool.filter(p => !recentSet.has(p.name));
      if (fresh.length >= Math.max(10, startPool.length * 0.2)) startPool = fresh;
    }
    const start = startPool[Math.floor(Math.random() * startPool.length)];
    recents.unshift(start.name);
    recents.length = Math.min(recents.length, 5); // cap réel dans localStorage
    return [start.name];
  };
}

titre("2. THE MERCATO — vivier de joueurs de départ");
for (const diff of ["facile", "moyen", "expert"]) {
  const pool = starterPool(diff);
  const actifs = pool.filter(p => !isRetiredPlayer(p.name)).length;
  console.log(`  ${diff.padEnd(7)} : ${String(pool.length).padStart(4)} joueurs éligibles`
    + `   (${actifs} actifs / ${pool.length - actifs} retraités)`
    + (diff === "expert" ? "   ← Crescendo démarre en facile" : ""));
}
for (const diff of ["facile", "moyen"]) {
  const pool = starterPool(diff);
  const actifs = pool.filter(p => !isRetiredPlayer(p.name));
  const fab = () => tirerMercato(diff);
  const c = couverture(fab, pool.length);
  console.log(`\n  → ${diff} : 1 starter/partie`);
  console.log(`     ${c.distinctes} starters distincts sur ${PARTIES} parties`);
  console.log(`     médiane avant de revoir un starter : ${medianeAvantRepetition(fab)} parties`);
  console.log(`     starters les plus vus : ${c.top.map(([k, n]) => k + " ×" + n).join(", ")}`);
  console.log(`     vivier réel des 80 % de tirages « joueur actif » : ${actifs.length} joueurs`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. TROUVE LE JOUEUR (reveal) — deviner un joueur à ses indices
// ═══════════════════════════════════════════════════════════════════════════
// randomPlayer() de FindPlayer.tsx : 70 % facile / 30 % moyen, joueurs de 3 à 9
// clubs nés en 1982 ou après, et un Set `seen` qui interdit de rejouer un joueur
// avant d'avoir vidé son pool. Ce Set n'est PAS persisté (useRef(new Set())) :
// il repart vide à chaque montage du composant, donc à chaque ouverture du mode.
const MODERN_MIN_BY = 1982;
const revealPools = (() => {
  const inRange = p => !!p.clubs && p.clubs.length >= 3 && p.clubs.length <= 9
    && !!p.birthYear && p.birthYear >= MODERN_MIN_BY;
  return {
    facile: PLAYERS_CLEAN.filter(p => p.diff === "facile" && inRange(p)),
    moyen: PLAYERS_CLEAN.filter(p => p.diff === "moyen" && inRange(p)),
  };
})();

// Deux comportements à chiffrer, et c'est tout l'objet de la correction :
// « mémoire vivante » = le Set survit d'une partie à l'autre (ce qui se passe
// depuis qu'il est persisté dans bb_reveal_vus) ; « mémoire neuve » = le Set
// repart vide à chaque ouverture du mode (l'ancien useRef(new Set())).
function tirerRevealEnchaine() {
  const seen = new Set();
  return function () {
    const wantFacile = Math.random() < 0.7;
    let pool = wantFacile ? revealPools.facile : revealPools.moyen;
    if (pool.length === 0) pool = wantFacile ? revealPools.moyen : revealPools.facile;
    let cand = pool.filter(p => !seen.has(p.name));
    if (cand.length === 0) { pool.forEach(p => seen.delete(p.name)); cand = pool; }
    const pick = cand[Math.floor(Math.random() * cand.length)];
    seen.add(pick.name);
    return [pick.name];
  };
}
function tirerRevealSansMemoire() {
  // Un Set neuf par PARTIE : c'est exactement ce que faisait useRef(new Set())
  // pour un joueur qui ouvre le mode, joue une manche, et ferme.
  return function () { return tirerRevealEnchaine()(); };
}

titre("3. TROUVE LE JOUEUR — vivier de joueurs mystère");
console.log(`  facile  : ${String(revealPools.facile.length).padStart(4)} joueurs  (tiré 70 % du temps)`);
console.log(`  moyen   : ${String(revealPools.moyen.length).padStart(4)} joueurs  (tiré 30 % du temps)`);
{
  const vivier = revealPools.facile.length + revealPools.moyen.length;
  const cE = couverture(tirerRevealEnchaine, vivier);
  const cR = couverture(tirerRevealSansMemoire, vivier);
  console.log(`\n  → APRÈS — mémoire persistée (bb_reveal_vus)`);
  console.log(`     ${cE.distinctes} joueurs distincts sur ${PARTIES} parties (${pct(cE.distinctes / vivier)} du vivier)`);
  console.log(`     médiane avant répétition : ${medianeAvantRepetition(tirerRevealEnchaine)} parties`);
  console.log(`  → AVANT — mémoire jetée à chaque ouverture du mode`);
  console.log(`     ${cR.distinctes} joueurs distincts sur ${PARTIES} parties (${pct(cR.distinctes / vivier)} du vivier)`);
  console.log(`     médiane avant répétition : ${medianeAvantRepetition(tirerRevealSansMemoire)} parties`);
  console.log(`     joueurs les plus vus : ${cR.top.map(([k, n]) => k + " ×" + n).join(", ")}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. GOAT BATTLE (battle) — machine à sous : deux clubs, un joueur commun
// ═══════════════════════════════════════════════════════════════════════════
// duelRollPair() tire deux clubs au hasard parmi 20, refuse la paire sans joueur
// commun, et n'a AUCUNE mémoire : ni des manches déjà jouées dans la partie en
// cours, ni des parties précédentes.
// GOAT BATTLE n'écrit rien dans bb_scores (aucune ligne mode=battle) : impossible
// de calibrer sur la production comme pour Le Plug. On calcule donc : 90 s de
// partie, 1 s de tirage « machine à sous » (DUEL_SOLO_SPIN_MS) plus le temps de
// taper un nom, soit ~7 s par manche → 12 manches. Le chiffre est prudent : moins
// de manches donnerait MOINS de répétitions, pas plus.
const MANCHES_PAR_BATTLE = 12;

// Nom distinct de la fonction pairesJouables importée : ici c'est l'ENSEMBLE des
// paires du mode, sous forme de libellés lisibles pour le comptage.
const paires = new Set(DUEL_PAIRES.map(p => [...p].sort().join(" / ")));

// AVANT : le tirage d'origine, deux clubs au hasard jusqu'à tomber sur une paire
// jouable, sans aucune mémoire. Recopié ici EXPRÈS — c'est la seule façon de
// chiffrer ce que la correction apporte, et le code d'origine n'existe plus.
function tirerBattleSansMemoire() {
  return function () {
    const partie = [];
    for (let i = 0; i < MANCHES_PAR_BATTLE; i++) {
      let c1 = "Real Madrid", c2 = "Barcelona";
      for (let k = 0; k < 80; k++) {
        const a = DUEL_CLUBS[Math.floor(Math.random() * DUEL_CLUBS.length)];
        const b = DUEL_CLUBS[Math.floor(Math.random() * DUEL_CLUBS.length)];
        if (a === b) continue;
        if (duelCommonPlayers(a, b).length > 0) { c1 = a; c2 = b; break; }
      }
      partie.push([c1, c2].sort().join(" / "));
    }
    return partie;
  };
}

// APRÈS : le vrai duelRollPair, mémoire comprise. On vide le stockage à chaque
// fabrique — un nouveau joueur n'hérite pas de l'historique du précédent.
function tirerBattle() {
  faussestockage.clear();
  return function () {
    const partie = [];
    for (let i = 0; i < MANCHES_PAR_BATTLE; i++) {
      const [c1, c2] = duelRollPair();
      partie.push([c1, c2].sort().join(" / "));
    }
    return partie;
  };
}

titre("4. GOAT BATTLE — vivier de paires de clubs");
console.log(`  ${DUEL_CLUBS.length} clubs au tirage → ${DUEL_CLUBS.length * (DUEL_CLUBS.length - 1) / 2} paires possibles,`
  + ` dont ${paires.size} jouables`);
for (const [nom, fab] of [["AVANT (aucune mémoire)", tirerBattleSansMemoire], ["APRÈS (mémoire de 60)", tirerBattle]]) {
  const c = couverture(fab, paires.size);
  const r = reprise(fab);
  // Le doublon DANS la même partie est la mesure qui compte ici : c'est la
  // répétition qu'un joueur ne peut pas ne pas voir.
  let avecDoublon = 0;
  for (let i = 0; i < PARTIES; i++) {
    const p = fab()();
    if (new Set(p).size < p.length) avecDoublon++;
  }
  console.log(`\n  → ${nom} — ${MANCHES_PAR_BATTLE} manches/partie sur un vivier de ${paires.size}`);
  console.log(`     parties posant DEUX FOIS la même question : ${pct(avecDoublon / PARTIES)}`);
  console.log(`     reprise d'une partie à la suivante : ${pct(r)}`);
  console.log(`     médiane avant répétition : ${medianeAvantRepetition(fab)} partie(s)`);
  console.log(`     ${c.distinctes} paires distinctes vues sur ${PARTIES} parties (${pct(c.distinctes / paires.size)} du vivier)`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Clubs jamais tirés par Battle alors qu'ils sont dans la base
// ═══════════════════════════════════════════════════════════════════════════
titre("Clubs absents du tirage GOAT BATTLE");
const clubsParPoids = Object.entries(jeu.CLUB_INDEX)
  .map(([c, noms]) => [c, noms.length])
  .filter(([c]) => !DUEL_CLUBS.includes(c))
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15);
console.log("  Les 15 clubs les plus fournis de la base qui ne sortent JAMAIS en Battle :");
for (const [c, n] of clubsParPoids) console.log(`    ${String(n).padStart(3)} joueurs  ${c}`);
