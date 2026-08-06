// ─── Collection de cartes ─────────────────────────────────────────────────────
// Des cartes à collectionner, débloquées par l'XP cumulée (bb_pseudos.xp), que
// le joueur peut afficher en badge à côté de son pseudo.
//
// Le déblocage est DÉDUIT de l'XP, jamais stocké : « possédée » veut dire
// xp >= card.xp. Rien à synchroniser, donc rien à désynchroniser — seul le
// badge CHOISI est persisté (une carte non débloquée est refusée à la lecture).
//
// Paliers calibrés sur la vraie distribution des comptes (145 comptes) :
// médiane 145 XP, p75 ≈ 960, p90 ≈ 2 255, p95 ≈ 4 180, p99 ≈ 17 400. Un barème
// qui grimperait à 30 000+ dès le milieu du tableau n'aurait débloqué presque
// rien pour presque personne : les 12 premières cartes tiennent donc sous
// 5 000 XP, et les légendaires servent d'objectif long terme.
//
// Visuels : les 12 premières cartes (commune + rare) ont leur illustration
// définitive dans public/cards/ ; les 9 dernières (épique + légendaire) portent
// encore un placeholder repris des visuels existants. Pour en livrer une, il
// suffit de déposer public/cards/<id>.webp (+ <id>-64.webp pour le badge) et de
// pointer `img`/`thumb` dessus : aucune autre ligne de code à toucher.

export type Rarity = "commune" | "rare" | "epique" | "legendaire";

export type RarityMeta = {
  key: Rarity;
  label: string;
  labelEn: string;
  color: string;
  glow: string;
};

// Ordre croissant de rareté — sert aussi à trier l'affichage de la collection.
export const RARITIES: RarityMeta[] = [
  { key: "commune",    label: "Commune",    labelEn: "Common",    color: "#8D99AE", glow: "rgba(141,153,174,.45)" },
  { key: "rare",       label: "Rare",       labelEn: "Rare",      color: "#00B4D8", glow: "rgba(0,180,216,.5)" },
  { key: "epique",     label: "Épique",     labelEn: "Epic",      color: "#A855F7", glow: "rgba(168,85,247,.55)" },
  { key: "legendaire", label: "Légendaire", labelEn: "Legendary", color: "#FFD700", glow: "rgba(255,215,0,.6)" },
];

export type Card = {
  id: string;
  name: string;
  nameEn: string;
  /** Visuel plein format (3:4), affiché dans la collection et le popup. */
  img: string;
  /** Vignette ~48×64 pour le badge à côté du pseudo : le classement en charge
   *  une par joueur, inutile d'y tirer le visuel plein format. */
  thumb: string;
  xp: number;
  rarity: Rarity;
};

// 21 cartes. `id` est la clé stockée en base : ne jamais le renommer (le badge
// d'un joueur pointerait dans le vide), contrairement au nom et au visuel.
export const CARDS: Card[] = [
  // ── Communes : les toutes premières parties ──
  { id: "recrue",      name: "La Recrue",        nameEn: "The Rookie",      img: "/cards/recrue.webp",    thumb: "/cards/recrue-64.webp", xp: 0,     rarity: "commune" },
  { id: "premier-but", name: "Premier But",      nameEn: "First Goal",      img: "/cards/premier-but.webp", thumb: "/cards/premier-but-64.webp", xp: 50,    rarity: "commune" },
  { id: "banc",        name: "Sur le Banc",      nameEn: "On the Bench",    img: "/cards/banc.webp",    thumb: "/cards/banc-64.webp", xp: 150,   rarity: "commune" },
  { id: "entrant",     name: "L'Entrant",        nameEn: "The Sub",         img: "/cards/entrant.webp",   thumb: "/cards/entrant-64.webp", xp: 300,   rarity: "commune" },
  { id: "premier-onze",name: "Premier Onze",     nameEn: "First Eleven",    img: "/cards/premier-onze.webp",  thumb: "/cards/premier-onze-64.webp", xp: 500,   rarity: "commune" },
  { id: "regulier",    name: "Le Régulier",      nameEn: "The Regular",     img: "/cards/regulier.webp",    thumb: "/cards/regulier-64.webp", xp: 800,   rarity: "commune" },
  // ── Rares : joueur installé (p75 → p95) ──
  { id: "titulaire",   name: "Le Titulaire",     nameEn: "The Starter",     img: "/cards/titulaire.webp",      thumb: "/cards/titulaire-64.webp", xp: 1200,  rarity: "rare" },
  { id: "numero-10",   name: "Le Numéro 10",     nameEn: "The Number 10",   img: "/cards/numero-10.webp",      thumb: "/cards/numero-10-64.webp", xp: 1700,  rarity: "rare" },
  { id: "brassard",    name: "Le Brassard",      nameEn: "The Armband",     img: "/cards/brassard.webp",      thumb: "/cards/brassard-64.webp", xp: 2300,  rarity: "rare" },
  { id: "meneur",      name: "Le Meneur",        nameEn: "The Playmaker",   img: "/cards/meneur.webp",      thumb: "/cards/meneur-64.webp", xp: 3000,  rarity: "rare" },
  { id: "buteur",      name: "Le Buteur",        nameEn: "The Striker",     img: "/cards/buteur.webp",        thumb: "/cards/buteur-64.webp", xp: 4000,  rarity: "rare" },
  { id: "international",name: "L'International", nameEn: "The Cap",         img: "/cards/international.webp",        thumb: "/cards/international-64.webp", xp: 5000,  rarity: "rare" },
  // ── Épiques : haut du classement ──
  { id: "maestro",     name: "Le Maestro",       nameEn: "The Maestro",     img: "/plug-card.png",        thumb: "/plug-card.png", xp: 6500,  rarity: "epique" },
  { id: "finisseur",   name: "Le Finisseur",     nameEn: "The Finisher",    img: "/mercato-card.png",        thumb: "/mercato-card.png", xp: 8000,  rarity: "epique" },
  { id: "ballon-or",   name: "Ballon d'Or",      nameEn: "Golden Ball",     img: "/grid-card.png",         thumb: "/grid-card.png", xp: 10000, rarity: "epique" },
  { id: "intouchable", name: "L'Intouchable",    nameEn: "Untouchable",     img: "/guess-card.png",         thumb: "/guess-card.png", xp: 12500, rarity: "epique" },
  { id: "phenomene",   name: "Le Phénomène",     nameEn: "The Phenomenon",  img: "/reveal-card.png",         thumb: "/reveal-card.png", xp: 15000, rarity: "epique" },
  // ── Légendaires : objectif long terme ──
  { id: "legende",     name: "La Légende",       nameEn: "The Legend",      img: "/duel-card.png",         thumb: "/duel-card.png", xp: 20000, rarity: "legendaire" },
  { id: "hall-of-fame",name: "Hall of Fame",     nameEn: "Hall of Fame",    img: "/devin-1.png",         thumb: "/devin-1.png", xp: 27000, rarity: "legendaire" },
  { id: "immortel",    name: "L'Immortel",       nameEn: "The Immortal",    img: "/devin-2.png",         thumb: "/devin-2.png", xp: 35000, rarity: "legendaire" },
  { id: "goat",        name: "Le GOAT",          nameEn: "The GOAT",        img: "/devin-3.png",     thumb: "/devin-3.png", xp: 50000, rarity: "legendaire" },
];

export function rarityMeta(rarity: Rarity): RarityMeta {
  return RARITIES.find((r) => r.key === rarity) || RARITIES[0];
}

export function cardById(id: string | null | undefined): Card | null {
  if (!id) return null;
  return CARDS.find((c) => c.id === id) || null;
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

/** Badge valide seulement si la carte existe ET est débloquée à cette XP. */
export function badgeToShow(badgeId: string | null | undefined, xp: number): Card | null {
  const card = cardById(badgeId);
  return card && isUnlocked(card, xp) ? card : null;
}
