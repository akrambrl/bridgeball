// LES DONNÉES DE JEU, SERVIES EN FICHIER ET PLUS EMPAQUETÉES DANS LE JS
//
// ── CE QUE ÇA CHANGE, ET POURQUOI C'EST LE VRAI SUJET ─────────────────────
//
// `src/players.jsx` était importé par LePont.jsx, FindPlayer.tsx et
// GoatGuess.tsx : 1008 Ko de source dans le bundle JS. Corriger le parcours d'un
// joueur exigeait donc un nouveau build, une soumission, et 24 à 48 h de revue
// Apple — pour une virgule dans une liste de clubs.
//
// Servies en fichier, les données se corrigent en publiant un JSON sur le site.
// Les apps installées le récupèrent au lancement suivant, sur iOS comme sur
// Android, sans passer par les stores. Pour une app de foot pendant un mercato,
// c'est la différence entre corriger en heures et corriger en jours.
//
// ── TROIS SOURCES, DANS CET ORDRE, ET AUCUNE N'EST OBLIGATOIRE ────────────
//
//   1. le CACHE — la dernière version téléchargée depuis le site. C'est la plus
//      fraîche connue, donc la première essayée ;
//   2. le FICHIER DU PAQUET — `public/donnees/joueurs.json`, embarqué. Toujours
//      présent, donc le premier lancement fonctionne SANS RÉSEAU, y compris dans
//      la coque native où l'URL relative désigne un fichier local ;
//   3. le SITE, en arrière-plan — on ne l'attend pas. S'il porte une version
//      différente, elle est rangée dans le cache et servira au lancement suivant.
//
// On n'attend PAS le réseau au démarrage, et c'est un choix : attendre ferait
// dépendre l'ouverture de l'app de la qualité du réseau, pour un gain — une fiche
// corrigée quelques heures plus tôt — qui ne le justifie pas. Une correction qui
// arrive au lancement suivant arrive assez vite.
//
// ── LE PIÈGE DU SERVICE WORKER ────────────────────────────────────────────
//
// public/sw.js purge TOUS les caches sauf le sien à chaque activation, donc à
// chaque déploiement. Sans la ligne qui préserve `CACHE_DONNEES`, les données
// mises à jour seraient effacées à chaque mise en ligne du site, et les joueurs
// retomberaient en silence sur celles du paquet. Trouvé en lisant le SW avant
// d'écrire ce fichier, pas après.
//
// ── LES LIAISONS SONT VIVANTES ────────────────────────────────────────────
//
// `export let` plus réaffectation : en ESM, les importateurs voient la nouvelle
// valeur. C'est ce qui permet à LePont.jsx de garder ses 41 usages de `PLAYERS`
// inchangés — la seule contrainte est de ne rien CALCULER sur ces données au
// chargement du module, d'où PLAYERS_CLEAN et PLAYER_BY_NAME exportés d'ici
// plutôt que dérivés là-bas.

export type Joueur = {
  name: string;
  clubs?: string[];
  diff?: string;
  nationalities?: string[];
  positions?: string[];
  birthYear?: number;
};

export let PLAYERS: Joueur[] = [];
export let RETIRED_PLAYERS: Set<string> = new Set();
export let GG_SHIRT_10: Set<string> = new Set();
export let GG_WC_WINNERS: Set<string> = new Set();
export let GG_CL_WINNERS: Set<string> = new Set();
export let GG_BALLON_DOR: Set<string> = new Set();
export let GG_BALLON_DOR_MULTI: Set<string> = new Set();

/** Les joueurs exploitables. Dérivé ici, et non chez l'appelant : il serait
 *  calculé au chargement du module, donc sur un tableau encore vide. */
export let PLAYERS_CLEAN: Joueur[] = [];
export let PLAYER_BY_NAME: Map<string, Joueur> = new Map();

const CHEMIN_LOCAL = "/donnees/joueurs.json";
const CHEMIN_SITE = "https://www.goatfc.fr/donnees/joueurs.json";
const CACHE_DONNEES = "goatfc-donnees";
const FORMAT_ATTENDU = 1;

let etat: "vide" | "pret" | "echec" = "vide";
let origine = "";
let promesse: Promise<void> | null = null;

export const donneesPretes = (): boolean => etat === "pret";
/** D'où viennent les données affichées : « cache », « paquet » ou « échec ». */
export const origineDonnees = (): string => origine;

type Paquet = {
  v: number;
  cles: string[];
  joueurs: unknown[][];
  RETIRED_PLAYERS: string[];
  GG_SHIRT_10: string[];
  GG_WC_WINNERS: string[];
  GG_CL_WINNERS: string[];
  GG_BALLON_DOR: string[];
  GG_BALLON_DOR_MULTI: string[];
};

/**
 * Reconstruit les objets depuis le format colonnaire, et REFUSE un paquet qui ne
 * tient pas debout. Le contrôle n'est pas décoratif : un fichier tronqué par un
 * déploiement à moitié fini donnerait un JSON valide mais un jeu vide, et l'app
 * démarrerait sur une base sans joueurs — sans erreur, avec des écrans qui ne
 * proposent rien. Mieux vaut refuser et retomber sur la source suivante.
 */
function appliquer(p: Paquet, source: string): boolean {
  if (!p || p.v !== FORMAT_ATTENDU || !Array.isArray(p.joueurs) || !Array.isArray(p.cles)) return false;
  // 5 000 est un plancher volontairement grossier : il attrape un fichier vide ou
  // tronqué sans se casser à chaque ajout de joueur. La base en compte 5 625.
  if (p.joueurs.length < 5000) return false;

  const iNom = p.cles.indexOf("name");
  if (iNom < 0) return false;

  const joueurs: Joueur[] = new Array(p.joueurs.length);
  for (let i = 0; i < p.joueurs.length; i++) {
    const ligne = p.joueurs[i];
    const o: Record<string, unknown> = {};
    for (let k = 0; k < p.cles.length; k++) {
      // `null` = clé absente sur cette fiche. On ne la pose pas, pour que
      // `p.birthYear === undefined` reste vrai là où le jeu le teste.
      if (ligne[k] !== null) o[p.cles[k]] = ligne[k];
    }
    joueurs[i] = o as Joueur;
  }

  PLAYERS = joueurs;
  RETIRED_PLAYERS = new Set(p.RETIRED_PLAYERS || []);
  GG_SHIRT_10 = new Set(p.GG_SHIRT_10 || []);
  GG_WC_WINNERS = new Set(p.GG_WC_WINNERS || []);
  GG_CL_WINNERS = new Set(p.GG_CL_WINNERS || []);
  GG_BALLON_DOR = new Set(p.GG_BALLON_DOR || []);
  GG_BALLON_DOR_MULTI = new Set(p.GG_BALLON_DOR_MULTI || []);

  // Les deux index dérivés, recopiés à l'identique de ce que LePont.jsx calculait.
  PLAYERS_CLEAN = PLAYERS.filter((j) => j && j.name && j.clubs && Array.isArray(j.clubs));
  PLAYER_BY_NAME = new Map(PLAYERS_CLEAN.map((j) => [j.name, j]));

  etat = "pret";
  origine = source;
  return true;
}

/**
 * Charge la base depuis un texte JSON déjà en main, sans réseau ni cache.
 *
 * Sert au harnais de test et aux scripts Node, où il n'y a ni `fetch` relatif ni
 * `caches` : sans elle, les tests qui exercent les vraies données tourneraient
 * sur une base VIDE et passeraient au vert en ne vérifiant rien. Cinq d'entre eux
 * ont d'ailleurs échoué juste après ce refactor, ce qui était la bonne réaction.
 *
 * Rend faux si le paquet ne passe pas les contrôles de forme.
 */
export function chargerDepuisTexte(txt: string): boolean {
  try { return appliquer(JSON.parse(txt) as Paquet, "texte"); } catch { return false; }
}

async function lireCache(): Promise<Paquet | null> {
  try {
    if (typeof caches === "undefined") return null;
    const c = await caches.open(CACHE_DONNEES);
    const r = await c.match(CHEMIN_SITE);
    return r ? ((await r.json()) as Paquet) : null;
  } catch { return null; }
}

/**
 * Va voir si le site a une version différente, et la range pour le lancement
 * suivant. Lancé sans être attendu — son échec n'a aucune conséquence.
 */
async function revalider(actuel: string): Promise<void> {
  try {
    if (typeof caches === "undefined") return;
    // `cache: "no-store"` parce que c'est justement le cache HTTP qu'on veut
    // court-circuiter : sans ça le navigateur pourrait resservir sa copie et la
    // vérification ne verrait jamais rien changer.
    const r = await fetch(CHEMIN_SITE, { cache: "no-store" });
    if (!r.ok) return;
    const txt = await r.text();
    if (txt === actuel) return;
    let p: Paquet;
    try { p = JSON.parse(txt) as Paquet; } catch { return; }
    // On VALIDE avant de ranger : mettre en cache un fichier cassé le ferait
    // servir en priorité au lancement suivant, donc casser l'app durablement.
    // On applique sur des variables jetables via une copie de la logique de
    // contrôle — le plancher et le format suffisent ici.
    if (p.v !== FORMAT_ATTENDU || !Array.isArray(p.joueurs) || p.joueurs.length < 5000) return;
    const c = await caches.open(CACHE_DONNEES);
    await c.put(CHEMIN_SITE, new Response(txt, { headers: { "Content-Type": "application/json" } }));
    console.info("[donnees] nouvelle version rangée, active au prochain lancement");
  } catch { /* réseau absent : rien à faire */ }
}

/**
 * À appeler UNE FOIS avant d'afficher l'app. Ne lève jamais : en cas d'échec
 * total, `donneesPretes()` reste faux et l'appelant décide quoi montrer.
 */
export function chargerDonnees(): Promise<void> {
  if (promesse) return promesse;
  promesse = (async () => {
    // 1. le cache, s'il porte quelque chose de valable
    const duCache = await lireCache();
    if (duCache && appliquer(duCache, "cache")) {
      void revalider(JSON.stringify(duCache));
      return;
    }
    // 2. le fichier du paquet — présent par construction
    try {
      const r = await fetch(CHEMIN_LOCAL);
      if (r.ok) {
        const txt = await r.text();
        if (appliquer(JSON.parse(txt) as Paquet, "paquet")) {
          void revalider(txt);
          return;
        }
      }
    } catch { /* on tombe dans l'échec ci-dessous */ }
    etat = "echec";
    origine = "échec";
    console.error("[donnees] aucune source lisible pour la base joueurs");
  })();
  return promesse;
}
