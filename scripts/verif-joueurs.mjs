#!/usr/bin/env node
// SUIVI DE LA VÉRIFICATION DES FICHES, JOUEUR PAR JOUEUR.
//
//     npx tsx scripts/verif-joueurs.mjs list [N]     # les N prochaines fiches à vérifier (défaut 20)
//     npx tsx scripts/verif-joueurs.mjs done <clé…>  # marque ces fiches comme vérifiées
//     npx tsx scripts/verif-joueurs.mjs stats        # avancement
//     npx tsx scripts/verif-joueurs.mjs reset        # repart à zéro (nouvelle passe)
//
// ── POURQUOI CE FICHIER ────────────────────────────────────────────────────
//
// La base a ~5600 fiches ; beaucoup datent d'avant le dernier mercato ou d'avant
// la carrière récente d'un joueur encore en activité. Plutôt que de tout revoir
// d'un coup, on avance par lots (20/nuit via un job planifié) et on GARDE LA
// TRACE de ce qui a été vu, pour finir par couvrir toute la base sans repasser
// deux fois sur les mêmes tant que le tour n'est pas bouclé.
//
// La clé d'une fiche est `nom#année#premierClub` : le nom seul ne suffit pas
// (268 homonymes connus), l'index de tableau bouge quand le mercato insère des
// clubs. Ce triplet est stable tant que la fiche existe.
//
// PRIORITÉ : les joueurs probablement ACTIFS d'abord (non retraités, nés en 1992
// ou après) — ce sont leurs fiches qui périment. Le reste ensuite. Une fois tout
// vu, `reset` (ou le job) relance une passe : la base ne cesse jamais de bouger.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, "..");
const CHEMIN = join(ici, "verif-joueurs.progress.json");

const { PLAYERS, RETIRED_PLAYERS } = await import(join(racine, "src", "players.jsx"));

const cle = (p) => `${p.name}#${p.birthYear || "?"}#${(p.clubs && p.clubs[0]) || "?"}`;

// Ordre de passage : actifs d'abord, puis les autres, chaque groupe dans l'ordre
// du fichier. On fige cet ordre pour que `list` et `done` parlent des mêmes.
function ordonne() {
  const actif = (p) => p.birthYear && p.birthYear >= 1992 && !(RETIRED_PLAYERS?.has?.(p.name));
  const a = [], b = [];
  for (const p of PLAYERS) (actif(p) ? a : b).push(p);
  return [...a, ...b];
}

function charge() {
  if (!existsSync(CHEMIN)) return { passe: 1, checked: [] };
  try { return JSON.parse(readFileSync(CHEMIN, "utf8")); } catch { return { passe: 1, checked: [] }; }
}
function sauve(etat) { writeFileSync(CHEMIN, JSON.stringify(etat, null, 2) + "\n"); }

const etat = charge();
const vus = new Set(etat.checked);
const tous = ordonne();
const restants = tous.filter((p) => !vus.has(cle(p)));

const cmd = process.argv[2] || "list";

if (cmd === "stats") {
  console.log(`passe ${etat.passe} · vérifiés ${vus.size} / ${tous.length} · restants ${restants.length}`);
} else if (cmd === "reset") {
  sauve({ passe: (etat.passe || 1) + 1, checked: [] });
  console.log(`remis à zéro — passe ${(etat.passe || 1) + 1}`);
} else if (cmd === "done") {
  const cles = process.argv.slice(3);
  if (!cles.length) { console.error("aucune clé fournie"); process.exit(1); }
  const avant = vus.size;
  for (const c of cles) vus.add(c);
  sauve({ passe: etat.passe || 1, checked: [...vus] });
  const nouv = restants2();
  console.log(`+${vus.size - avant} marqués · total ${vus.size}/${tous.length} · restants ${nouv.length}`);
  function restants2() { return tous.filter((p) => !vus.has(cle(p))); }
} else { // list
  const n = Number(process.argv[3]) || 20;
  const lot = restants.slice(0, n).map((p) => ({
    cle: cle(p),
    name: p.name,
    birthYear: p.birthYear ?? null,
    nationalities: p.nationalities ?? [],
    positions: p.positions ?? [],
    clubs: p.clubs ?? [],
  }));
  if (!lot.length) { console.log("[]  # tout est vérifié — lance `reset` pour une nouvelle passe"); }
  else console.log(JSON.stringify(lot, null, 2));
}
