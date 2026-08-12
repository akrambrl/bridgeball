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

// Import STATIQUE et non dynamique : le fichier est généré puis commité, donc il
// existe toujours. Un `await import()` en repli aurait introduit un top-level await
// dans une bibliothèque que l'app charge au démarrage — un coût de compatibilité
// réel pour se protéger d'un fichier qui ne peut pas manquer.
import { ROTATION, EPOQUE_JOUR } from "./devinette-rotation.js";

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
/**
 * Les clubs d'un joueur SANS répétition, et leur nombre.
 *
 * `clubs` est une liste ORDONNÉE dont le dernier élément est publié comme
 * « 🏁 Dernier maillot ». Un joueur qui revient dans un club y figure donc DEUX
 * FOIS, à sa place chronologique — c'est voulu, et c'est la seule façon d'avoir
 * à la fois le bon ordre et le bon dernier maillot (Kolo Muani : Juventus,
 * Tottenham, Juventus).
 *
 * Mais alors `clubs.length` n'est plus un nombre de clubs, et il était utilisé
 * comme tel à trois endroits. Conséquences mesurées sur 80 joueurs à doublon :
 *
 *  • l'ÉLIGIBILITÉ à la devinette du jour exige 3 à 9 clubs. Comptés avec les
 *    répétitions, Zlatan Ibrahimović (10 entrées, 9 clubs), Lukaku, Nani et
 *    Valderrama passaient au-dessus du plafond et disparaissaient du vivier
 *    quotidien — quatre des noms les plus reconnaissables du jeu, écartés par un
 *    doublon. À l'inverse, Trubin, Vítor Baía et Robbie Fowler y entraient avec
 *    2 clubs réels, ce que le plancher de 3 existe précisément pour empêcher.
 *  • l'accroche de la notification annonçait « 8 clubs » pour un joueur qui en a
 *    porté 7.
 *  • l'indice « J'ai porté les couleurs de N clubs DIFFÉRENTS » comptait les
 *    répétitions, ce que le mot « différents » démentait.
 *
 * D'où cette fonction : la liste garde ses doublons pour l'ordre, les COMPTES
 * passent par ici.
 */
export function clubsDistincts(joueur) {
  return joueur && joueur.clubs ? [...new Set(joueur.clubs)] : [];
}

/** Combien de clubs différents — jamais `clubs.length`, voir clubsDistincts. */
export function nbClubs(joueur) {
  return clubsDistincts(joueur).length;
}

export function poolDevinette(joueurs, retraites) {
  const enActivite = (p) => !retraites.has(p.name) && !!p.birthYear && p.birthYear >= MODERN_MIN_BY;
  const pool = joueurs.filter((p) => p.diff === "facile" && p.clubs
    && nbClubs(p) >= 3 && nbClubs(p) <= 9 && enActivite(p));
  // Filet de sécurité si la base bouge : on relâche le nombre de clubs, jamais
  // la règle « en activité », sinon un ancien reviendrait par la porte du repli.
  return pool.length > 0 ? pool : joueurs.filter((p) => p.clubs && nbClubs(p) >= 3 && enActivite(p));
}

/** Le nom inscrit au calendrier pour ce jour, ou null s'il n'y en a pas. */
export function nomInscritPour(jour) {
  if (!ROTATION || EPOQUE_JOUR == null) return null;
  const pos = jourIndex(jour) - EPOQUE_JOUR;
  if (pos < 0 || pos >= ROTATION.length) return null;
  return ROTATION[pos];
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
/**
 * Le joueur d'un jour donné.
 *
 * LA ROTATION EST ÉCRITE, PAS CALCULÉE, et c'est une correction de fond. La
 * version précédente faisait `melange(vivier)[jour % vivier.length]`. Le mélange
 * avait bien une graine fixe, mais il mélangeait une liste dont le contenu et la
 * taille bougent : il suffisait qu'un joueur entre ou sorte du vivier pour que
 * TOUT le calendrier se réordonne, passé comme futur.
 *
 * Constaté en production : en corrigeant le comptage des clubs (un club où le
 * joueur est revenu était compté deux fois, ce qui excluait Zlatan et Lukaku du
 * vivier), celui-ci est passé de 96 à 97 joueurs — et les douze jours examinés ont
 * tous changé de joueur. players.jsx a été modifié cinq fois dans la même semaine
 * à cause du mercato : cinq réordonnancements, donc autant d'occasions de
 * resservir quelqu'un qui venait de passer. C'est ce qui a été signalé.
 *
 * La liste figée (src/lib/devinette-rotation.js) est donc consultée d'abord. Le
 * calcul d'origine reste en REPLI pour trois cas : avant l'époque de la liste,
 * au-delà de sa fin, et quand le nom inscrit n'est plus dans le vivier (joueur
 * devenu retraité, fiche renommée). Le repli ne rend pas le mauvais joueur, il
 * rend seulement un joueur dont le choix redevient sensible au vivier — pour cette
 * journée-là uniquement.
 */
export function joueurDuJour(pool, jour) {
  if (!pool || pool.length === 0) return null;
  const inscrit = nomInscritPour(jour);
  if (inscrit) {
    const trouve = pool.find(function (p) { return p && p.name === inscrit; });
    if (trouve) return trouve;
  }
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
  if (nbClubs(joueur)) bouts.push(nbClubs(joueur) + " clubs");
  const poste = joueur.positions && joueur.positions.length ? POSTES_FR[joueur.positions[0]] : null;
  if (poste) bouts.push(poste);
  if (joueur.birthYear) bouts.push("révélé dans les années " + Math.floor((joueur.birthYear + 19) / 10) * 10);
  return { titre, corps: "🕵️ " + bouts.join(", ") + ". Tu le trouves ?" };
}
