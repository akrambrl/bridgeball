// Le JOUEUR MYSTÈRE DU JOUR, isolé ici pour être calculable hors du navigateur.
//
// Pourquoi ce fichier existe : la notification quotidienne est envoyée par un
// script Node (scripts/notif-devinette.mjs) qui doit annoncer LA devinette du
// jour — donc calculer exactement le même joueur que l'app. Ce calcul vivait à
// l'intérieur de FindPlayer.tsx, un composant React qui importe LePont.jsx
// (15 000 lignes) : impossible à charger depuis un script sans embarquer toute
// l'app. Recopier la formule dans le script aurait garanti sa divergence — et
// une notification qui décrit un autre joueur que celui du jeu est un mensonge
// visible par tout le monde.
//
// En .js et non .ts, comme src/lib/tirage.js : Node charge ce fichier tel quel
// (package.json est en "type": "module"), sans étape de compilation. Aucun
// import ici, pour la même raison.

/** Jour calendaire parisien au format "YYYY-MM-DD". */
export function parisDay(maintenant) {
  const d = maintenant == null ? new Date() : new Date(maintenant);
  // Intl plutôt que `new Date(d.toLocaleString("en-US", …))` : ce détour-là
  // reconstruit une date en RE-PARSANT une chaîne localisée, ce que la spec ne
  // garantit pour aucun format. Ici on lit directement les champs voulus.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d);
  let y = "", m = "", j = "";
  for (const p of parts) {
    if (p.type === "year") y = p.value;
    else if (p.type === "month") m = p.value;
    else if (p.type === "day") j = p.value;
  }
  return y + "-" + m + "-" + j;
}

// Année de naissance plancher, partagée par la devinette du jour, le mode
// illimité et le tirage au hasard du dé.
//
// Elle valait 1975, avec le commentaire « a joué après 2000 » — ce qui était
// faux : un joueur né en 1975 débute vers 1994, en pleine décennie précédente.
// Le plancher ne faisait donc pas ce qu'il annonçait, et le jeu proposait des
// carrières que la plupart des joueurs n'ont jamais vues.
//
// 1982 → première saison vers 2001 (même hypothèse de début à 19 ans que
// l'indice « j'ai percé dans les années »). La carrière est alors entièrement
// dans les années 2000 et après.
export const MODERN_MIN_BY = 1982;

/** Numéro de jour absolu, base de la rotation. */
export function jourIndex(jour) {
  return Math.floor(Date.parse(jour + "T00:00:00Z") / 86400000);
}

/**
 * Le vivier de la devinette : des stars EN ACTIVITÉ, au parcours lisible
 * (difficulté « facile », de 3 à 9 clubs).
 *
 * Que des joueurs en activité, pas d'anciens. Le mode illimité appliquait déjà
 * cette règle, la devinette du jour ne le faisait pas — 89 des 195 joueurs du
 * vivier étaient des retraités (Ramos, Rooney, Kroos, Beckham…).
 *
 * Deux garde-fous plutôt qu'un : la liste des retraités, tenue à la main et qui
 * peut manquer un départ récent, et l'année de naissance, qui écarte les anciens
 * qu'elle n'a pas encore enregistrés (Hagi, Milla, Nedvěd…).
 */
export function poolDevinette(joueurs, retraites) {
  const enActivite = (p) => !retraites.has(p.name) && !!p.birthYear && p.birthYear >= MODERN_MIN_BY;
  const pool = joueurs.filter((p) => p.diff === "facile" && p.clubs
    && p.clubs.length >= 3 && p.clubs.length <= 9 && enActivite(p));
  // Filet de sécurité si la base bouge : on relâche le nombre de clubs, jamais
  // la règle « en activité », sinon un ancien reviendrait par la porte du repli.
  return pool.length > 0 ? pool : joueurs.filter((p) => p.clubs && p.clubs.length >= 3 && enActivite(p));
}

/** Générateur pseudo-aléatoire à graine (Lehmer) — même ordre pour tout le monde. */
function aleaGraine(graine) {
  let s = graine % 2147483647;
  if (s <= 0) s += 2147483646;
  return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

// Graine fixe : le vivier est mélangé une fois dans un ordre identique pour
// tous, puis on tourne selon le numéro de jour. Chaque joueur passe donc une
// seule fois avant un cycle complet.
const GRAINE = 987654321;

/** Le joueur mystère d'un jour donné. */
export function joueurDuJour(pool, jour) {
  if (!pool || pool.length === 0) return null;
  const alea = aleaGraine(GRAINE);
  const arr = pool.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(alea() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  const idx = jourIndex(jour);
  return arr[((idx % arr.length) + arr.length) % arr.length];
}

const POSTES_FR = { attaquant: "attaquant", milieu: "milieu", defenseur: "défenseur", gardien: "gardien" };

/**
 * Le texte de la notification : une ACCROCHE, pas une réponse.
 *
 * Ne cite ni le nom ni aucun club : la notification arrive avant que le joueur
 * n'ouvre le jeu, et un nom dans la barre de notification supprimerait la
 * partie du jour pour tout le monde. On ne donne que ce que le jeu offre
 * gratuitement dès le premier essai — poste, nombre de clubs, décennie
 * d'éclosion — de quoi donner envie sans rien résoudre.
 *
 * La décennie suit la convention de l'indice « j'ai percé dans les années » :
 * début de carrière supposé à 19 ans.
 */
export function accrocheDevinette(joueur) {
  const titre = "Devinette du jour ⚽";
  if (!joueur) return { titre, corps: "Le joueur mystère du jour t'attend. Tu le trouves ?" };
  const bouts = [];
  if (joueur.clubs && joueur.clubs.length) bouts.push(joueur.clubs.length + " clubs");
  const poste = joueur.positions && joueur.positions.length ? POSTES_FR[joueur.positions[0]] : null;
  if (poste) bouts.push(poste);
  if (joueur.birthYear) bouts.push("révélé dans les années " + Math.floor((joueur.birthYear + 19) / 10) * 10);
  return { titre, corps: "🕵️ " + bouts.join(", ") + ". Tu le trouves ?" };
}
