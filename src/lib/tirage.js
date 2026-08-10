// Règles de TIRAGE des questions, isolées ici pour être testables.
//
// Pourquoi ce fichier existe : un audit (scripts/audit-tirage.mjs) a montré que
// GOAT Battle n'avait aucune mémoire de ses tirages — 30 % des parties posaient
// deux fois la même question en 90 secondes — et que celle de « Trouve le
// joueur » était jetée à chaque ouverture du mode. Dans les deux cas la faute
// n'était pas le hasard mais l'absence (ou la perte) de la liste des questions
// déjà posées. Cette liste est une règle, elle mérite d'être écrite une fois et
// verrouillée par des tests.
//
// En .js et non .ts, comme src/lib/tracking.js : scripts/audit-tirage.mjs
// l'importe directement depuis Node, qui ne sait pas lire du TypeScript. Aucun
// import ici, pour la même raison — un seul `import "./charte.jsx"` rendrait le
// fichier illisible hors du bundle.

/** Clé d'ordre stable pour une paire de clubs : (A,B) et (B,A) donnent la même. */
export function clePaire(c1, c2) {
  return c1 < c2 ? c1 + "|||" + c2 : c2 + "|||" + c1;
}

/**
 * Toutes les paires de `clubs` qui ont au moins un joueur commun.
 *
 * Calculé UNE fois par l'appelant plutôt qu'à chaque manche : c'est ce qui permet
 * d'exclure les paires déjà vues. Le tirage d'origine faisait « deux clubs au
 * hasard, on recommence si la paire n'est pas jouable », et cette forme-là ne
 * peut pas filtrer — sur un vivier rétréci elle épuise ses essais et retombe
 * toujours sur la même paire de repli.
 *
 * @param {string[]} clubs
 * @param {(a: string, b: string) => number} nbCommuns
 * @returns {[string, string][]}
 */
export function pairesJouables(clubs, nbCommuns) {
  const out = [];
  for (let i = 0; i < clubs.length; i++) {
    for (let j = i + 1; j < clubs.length; j++) {
      if (nbCommuns(clubs[i], clubs[j]) > 0) out.push([clubs[i], clubs[j]]);
    }
  }
  return out;
}

/**
 * Tire un élément au hasard en écartant ceux dont la clé est dans `recentes`.
 *
 * Si TOUT est écarté, on rouvre l'ensemble au lieu de ne rien rendre : mieux vaut
 * une répétition qu'un mode qui ne démarre pas. C'est le cas qui arrive le jour
 * où quelqu'un réduit la liste des clubs sans toucher au plafond de mémoire.
 *
 * @template T
 * @param {T[]} items
 * @param {(x: T) => string} cle
 * @param {Set<string>} recentes
 * @param {() => number} [alea] injectable pour les tests
 * @returns {T | null} null seulement si `items` est vide
 */
export function tirerEnEvitant(items, cle, recentes, alea) {
  if (!items || items.length === 0) return null;
  const rnd = alea || Math.random;
  let candidats = items.filter(function (x) { return !recentes.has(cle(x)); });
  if (candidats.length === 0) candidats = items;
  return candidats[Math.floor(rnd() * candidats.length)];
}

/**
 * Ajoute `cle` en tête d'une mémoire bornée, sans doublon.
 *
 * La plus récente en tête et non en queue : quand le plafond coupe, c'est la plus
 * ANCIENNE qui doit tomber. Une liste qui pousse par la fin et coupe par la fin
 * ne mémorise jamais rien au-delà des premières parties.
 *
 * @param {string} cle
 * @param {string[]} liste
 * @param {number} max
 * @returns {string[]} une nouvelle liste (l'entrée n'est pas modifiée)
 */
export function memoriser(cle, liste, max) {
  const reste = (liste || []).filter(function (k) { return k !== cle; });
  return [cle].concat(reste).slice(0, Math.max(0, max));
}

/**
 * Filtre une liste de noms lue d'un stockage : ne garde que les chaînes qui
 * existent encore dans `connus`.
 *
 * Sans ce filtre, un nom renommé ou retiré de la base resterait mémorisé pour
 * toujours et rognerait le vivier sans qu'aucun cycle ne puisse l'en sortir —
 * la mémoire anti-répétition finirait par interdire des joueurs qui n'existent
 * plus, au lieu de faire tourner ceux qui existent.
 *
 * @param {unknown} brut ce que JSON.parse a rendu (donc n'importe quoi)
 * @param {Set<string>} connus
 * @returns {Set<string>}
 */
export function nettoyerVus(brut, connus) {
  if (!Array.isArray(brut)) return new Set();
  return new Set(brut.filter(function (n) { return typeof n === "string" && connus.has(n); }));
}
