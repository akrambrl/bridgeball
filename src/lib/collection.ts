// ─── Collection de cartes ─────────────────────────────────────────────────────
// Des cartes à collectionner, débloquées par l'XP cumulée (bb_pseudos.xp), que
// le joueur peut afficher en badge à côté de son pseudo.
//
// Le déblocage est DÉDUIT de l'XP, jamais stocké : « possédée » veut dire
// xp >= card.xp. Rien à synchroniser, donc rien à désynchroniser — seul le
// badge CHOISI est persisté (une carte non débloquée est refusée à la lecture).
//
// Paliers calibrés sur les comptes réels ET sur la vitesse de gain observée.
// L'XP est la SOMME DES SCORES (pas un forfait par partie) : ~425 XP par partie
// pour un bon joueur, avec des pointes à 2 500 sur une seule partie. Le meilleur
// compte a atteint 56 875 XP en 134 parties.
//
// D'où deux moitiés très différentes :
//  • bas de l'échelle — le joueur médian est à 145 XP, soit moins d'une bonne
//    partie : les 12 premières cartes tiennent sous 5 000 XP (p95 ≈ 4 180), pour
//    qu'il y ait toujours un objectif proche.
//  • haut de l'échelle — à ~425 XP/partie, un plafond à 50 000 se bouclait en
//    ~120 parties, soit une semaine pour un joueur assidu. Les 9 dernières
//    cartes montent donc jusqu'à 250 000 XP (~590 parties).
//
// ⚠️ La possession étant DÉDUITE de l'XP, relever un palier retire la carte à
// ceux qui l'avaient. Ne recalibrer qu'en connaissance de cause.
//
// Visuels : les 12 premières cartes (commune + rare) ont leur illustration dans
// public/cards/. Les 9 dernières (épique + légendaire) ont img/thumb à null et
// s'affichent en emplacement « à venir » — surtout PAS une image d'emprunt : les
// visuels de modes de jeu qui servaient de bouche-trous se lisaient comme de
// vraies cartes. Pour en livrer une : déposer public/cards/<id>.webp (+
// <id>-64.webp) et pointer img/thumb dessus, rien d'autre à toucher.

export type Rarity = "depart" | "bronze" | "argent" | "or" | "diamant";

export type RarityMeta = {
  key: Rarity;
  label: string;
  labelEn: string;
  /** Couleur du liseré et du nom de la catégorie. */
  color: string;
  /** Halo porté par la carte (boxShadow). */
  glow: string;
  /** Dégradé du cadre, façon carte FUT : deux tons du même métal. */
  frame: string;
  /** Classe CSS optionnelle — le diamant reçoit un reflet animé. */
  cls?: string;
};

// Ordre croissant de rareté — sert aussi à trier l'affichage de la collection.
export const RARITIES: RarityMeta[] = [
  { key: "depart",  label: "Départ",  labelEn: "Starter",  color: "#8D99AE", glow: "rgba(141,153,174,.4)",
    frame: "linear-gradient(160deg,#9AA5B1,#5C6672)" },
  { key: "bronze",  label: "Bronze",  labelEn: "Bronze",   color: "#CD7F32", glow: "rgba(205,127,50,.45)",
    frame: "linear-gradient(160deg,#E8A860,#8C4E1A)" },
  { key: "argent",  label: "Argent",  labelEn: "Silver",   color: "#C8CDD4", glow: "rgba(200,205,212,.45)",
    frame: "linear-gradient(160deg,#FFFFFF,#8E97A3)" },
  { key: "or",      label: "Or",      labelEn: "Gold",     color: "#F5C22B", glow: "rgba(245,194,43,.5)",
    frame: "linear-gradient(160deg,#FFE066,#B98407)" },
  { key: "diamant", label: "Diamant", labelEn: "Diamond",  color: "#8FE9FF", glow: "rgba(143,233,255,.65)",
    frame: "linear-gradient(160deg,#FFFFFF,#8FE9FF,#5AA6FF,#FFFFFF)", cls: "bbDiamant" },
];

export type Card = {
  id: string;
  name: string;
  nameEn: string;
  /** Visuel plein format (3:4). null = illustration pas encore livrée : la
   *  carte s'affiche alors en emplacement « à venir », jamais avec une image
   *  d'emprunt (les visuels de modes de jeu faisaient croire à des cartes). */
  img: string | null;
  /** Vignette ~48×64 pour les petits formats. null quand img est null. */
  thumb: string | null;
  xp: number;
  rarity: Rarity;
};

// 21 cartes. `id` est la clé stockée en base : ne jamais le renommer (le badge
// d'un joueur pointerait dans le vide), contrairement au nom et au visuel.
export const CARDS: Card[] = [
  // ── Carte de départ : tout le monde l'a ──
  { id: "recrue",      name: "La Recrue",        nameEn: "The Rookie",      img: "/cards/recrue.webp",    thumb: "/cards/recrue-64.webp", xp: 0,     rarity: "depart" },
  // ── Bronze : les premières parties ──
  { id: "premier-but", name: "Premier But",      nameEn: "First Goal",      img: "/cards/premier-but.webp", thumb: "/cards/premier-but-64.webp", xp: 50,    rarity: "bronze" },
  { id: "banc",        name: "Sur le Banc",      nameEn: "On the Bench",    img: "/cards/banc.webp",    thumb: "/cards/banc-64.webp", xp: 150,   rarity: "bronze" },
  { id: "entrant",     name: "L'Entrant",        nameEn: "The Sub",         img: "/cards/entrant.webp",   thumb: "/cards/entrant-64.webp", xp: 300,   rarity: "bronze" },
  { id: "premier-onze",name: "Premier Onze",     nameEn: "First Eleven",    img: "/cards/premier-onze.webp",  thumb: "/cards/premier-onze-64.webp", xp: 500,   rarity: "bronze" },
  { id: "regulier",    name: "Le Régulier",      nameEn: "The Regular",     img: "/cards/regulier.webp",    thumb: "/cards/regulier-64.webp", xp: 800,   rarity: "bronze" },
  // ── Argent : le joueur s'installe (p75 → p95) ──
  { id: "titulaire",   name: "Le Titulaire",     nameEn: "The Starter",     img: "/cards/titulaire.webp",      thumb: "/cards/titulaire-64.webp", xp: 1200,  rarity: "argent" },
  { id: "numero-10",   name: "Le Numéro 10",     nameEn: "The Number 10",   img: "/cards/numero-10.webp",      thumb: "/cards/numero-10-64.webp", xp: 1700,  rarity: "argent" },
  { id: "brassard",    name: "Le Brassard",      nameEn: "The Armband",     img: "/cards/brassard.webp",      thumb: "/cards/brassard-64.webp", xp: 2300,  rarity: "argent" },
  { id: "meneur",      name: "Le Meneur",        nameEn: "The Playmaker",   img: "/cards/meneur.webp",      thumb: "/cards/meneur-64.webp", xp: 3000,  rarity: "argent" },
  { id: "buteur",      name: "Le Buteur",        nameEn: "The Striker",     img: "/cards/buteur.webp",        thumb: "/cards/buteur-64.webp", xp: 4000,  rarity: "argent" },
  // ── Or : haut du classement ──
  { id: "international",name: "L'International", nameEn: "The Cap",         img: "/cards/international.webp",        thumb: "/cards/international-64.webp", xp: 5000,  rarity: "or" },
  { id: "maestro",     name: "Le Maestro",       nameEn: "The Maestro",     img: null,        thumb: null, xp: 8000,  rarity: "or" },
  { id: "finisseur",   name: "Le Finisseur",     nameEn: "The Finisher",    img: null,        thumb: null, xp: 12000,  rarity: "or" },
  { id: "ballon-or",   name: "Ballon d'Or",      nameEn: "Golden Ball",     img: null,         thumb: null, xp: 18000, rarity: "or" },
  { id: "intouchable", name: "L'Intouchable",    nameEn: "Untouchable",     img: null,         thumb: null, xp: 26000, rarity: "or" },
  // ── Diamant : objectif long terme, cartes qui brillent ──
  { id: "phenomene",   name: "Le Phénomène",     nameEn: "The Phenomenon",  img: null,         thumb: null, xp: 38000, rarity: "diamant" },
  { id: "legende",     name: "La Légende",       nameEn: "The Legend",      img: null,         thumb: null, xp: 55000, rarity: "diamant" },
  { id: "hall-of-fame",name: "Hall of Fame",     nameEn: "Hall of Fame",    img: null,         thumb: null, xp: 90000, rarity: "diamant" },
  { id: "immortel",    name: "L'Immortel",       nameEn: "The Immortal",    img: null,         thumb: null, xp: 150000, rarity: "diamant" },
  { id: "goat",        name: "Le GOAT",          nameEn: "The GOAT",        img: null,     thumb: null, xp: 250000, rarity: "diamant" },
];

export function rarityMeta(rarity: Rarity): RarityMeta {
  return RARITIES.find((r) => r.key === rarity) || RARITIES[0];
}

export function cardById(id: string | null | undefined): Card | null {
  if (!id) return null;
  return CARDS.find((c) => c.id === id) || null;
}

/** Une carte a-t-elle son illustration ? Les autres restent « à venir ». */
export function hasArt(card: Card): boolean {
  return !!card.img;
}

export function isUnlocked(card: Card, xp: number): boolean {
  return (xp || 0) >= card.xp;
}

export function unlockedCards(xp: number): Card[] {
  return CARDS.filter((c) => isUnlocked(c, xp));
}

/** Prochaine carte à débloquer, ou null si la collection est complète. */
export function nextCard(xp: number): Card | null {
  return CARDS.find((c) => !isUnlocked(c, xp)) || null;
}

/**
 * Progression vers la prochaine carte, pour la barre d'avancement :
 * `ratio` part du palier de la dernière carte obtenue (et non de 0), sinon la
 * barre semble immobile dès qu'on atteint les paliers élevés.
 */
export function progressToNext(xp: number): { card: Card; missing: number; ratio: number } | null {
  const next = nextCard(xp);
  if (!next) return null;
  const owned = unlockedCards(xp);
  const from = owned.length ? owned[owned.length - 1].xp : 0;
  const span = next.xp - from;
  const done = Math.max(0, (xp || 0) - from);
  return {
    card: next,
    missing: Math.max(0, next.xp - (xp || 0)),
    ratio: span > 0 ? Math.min(1, done / span) : 1,
  };
}

/**
 * Cartes franchies entre deux totaux d'XP — sert à annoncer un déblocage juste
 * après une partie. Un recul d'XP (correction, désynchro) ne renvoie rien.
 */
export function newlyUnlocked(oldXp: number, newXp: number): Card[] {
  if (!(newXp > oldXp)) return [];
  return CARDS.filter((c) => c.xp > (oldXp || 0) && c.xp <= newXp);
}

/**
 * Carte du NIVEAU : la meilleure carte possédée à cette XP. C'est elle qui sert
 * de photo de profil par défaut, pour que chaque joueur en ait une sans rien
 * faire — et qu'elle progresse d'elle-même quand il monte.
 */
export function levelCard(xp: number): Card {
  // Seules les cartes illustrées peuvent servir de photo de profil : sinon un
  // joueur très avancé se retrouverait avec un cadre vide.
  const owned = unlockedCards(xp).filter(hasArt);
  return owned[owned.length - 1] || CARDS[0]; // CARDS[0] est à 0 XP et illustrée
}

/**
 * Carte à afficher comme avatar : le badge choisi s'il est valide, sinon la
 * carte du niveau. Choisir un badge revient donc à figer sa photo de profil sur
 * une carte précise, au lieu de suivre automatiquement son niveau.
 */
export function avatarCard(badgeId: string | null | undefined, xp: number): Card {
  return badgeToShow(badgeId, xp) || levelCard(xp);
}

/** Badge valide seulement si la carte existe ET est débloquée à cette XP. */
export function badgeToShow(badgeId: string | null | undefined, xp: number): Card | null {
  const card = cardById(badgeId);
  return card && isUnlocked(card, xp) && hasArt(card) ? card : null;
}
