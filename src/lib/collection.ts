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
//    partie : 16 cartes tiennent sous 5 000 XP (p95 ≈ 4 180), pour qu'il y ait
//    toujours un objectif proche.
//  • haut de l'échelle — à ~425 XP/partie, un plafond à 50 000 se bouclait en
//    ~120 parties, soit une semaine pour un joueur assidu. Les dernières cartes
//    montent donc jusqu'à 250 000 XP (~590 parties).
//
// ⚠️ La possession étant DÉDUITE de l'XP, relever un palier retire la carte à
// ceux qui l'avaient. Ne recalibrer qu'en connaissance de cause. Les 8 cartes
// ajoutées au deuxième lot s'intercalent donc ENTRE les paliers d'origine, qui
// n'ont pas bougé d'un point.
//
// ── Ordre de la collection ───────────────────────────────────────────────────
// Le classement va du plus jeune au plus légendaire : Yamal ouvre, Maradona
// ferme. L'âge donne la trame, la stature la corrige — sans quoi un tri par date
// de naissance placerait Davids et Totti au-dessus de Messi et Cristiano. Cinq
// joueurs remontent ainsi au-dessus de leur génération (Henry, Ronaldinho, CR7,
// Messi, R9) : c'est ce qui rend la bande diamant crédible.
//
// Le NOM de la carte décrit une étape de carrière (La Recrue → Le GOAT), le
// VISUEL le joueur qu'on débloque en y arrivant. Les deux ne parlent donc pas de
// la même personne, et c'est voulu : « tu es titulaire, tu débloques van Dijk ».
//
// ⚠️ Deux cartes ont changé de nom sans changer d'`id` : `ballon-or` s'appelle
// « L'Intenable » (Drogba n'a jamais gagné le Ballon d'Or) et `phenomene`
// « Le Roi » (ce surnom est celui de Ronaldo, qui est plus haut). L'id reste tel
// quel — c'est la clé stockée en base, la renommer ferait pointer dans le vide
// le badge des joueurs qui ont choisi la carte.
//
// Visuels : les 29 cartes sont illustrées, dans public/cards/, en WebP 600 × 800
// (~80 Ko) avec une vignette 48 × 64 pour le badge. Les FICHIERS portent le nom
// du joueur, pas celui de la carte : un reclassement ne déplace alors que le
// chemin img/thumb, sans jamais laisser un fichier mentir sur son contenu.
// img/thumb peuvent valoir null — la carte s'affiche en emplacement « à venir »,
// surtout PAS avec une image d'emprunt : les visuels de modes de jeu qui
// servaient de bouche-trous se lisaient comme de vraies cartes.

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

// 29 cartes : 1 de départ, puis 7 par catégorie. `id` est la clé stockée en
// base : ne jamais le renommer (le badge d'un joueur pointerait dans le vide),
// contrairement au nom et au visuel. Le commentaire de fin de ligne donne le
// joueur illustré, que le nom de la carte ne dit pas.
export const CARDS: Card[] = [
  // ── Carte de départ : tout le monde l'a ──
  { id: "recrue",          name: "La Recrue",          nameEn: "The Rookie",         img: "/cards/yamal.webp",      thumb: "/cards/yamal-64.webp",      xp: 0,      rarity: "depart" },  // Lamine Yamal · 2007
  // ── Bronze : la nouvelle vague, celle qu'on voit jouer aujourd'hui ──
  { id: "premier-but",     name: "Premier But",        nameEn: "First Goal",         img: "/cards/vinicius.webp",   thumb: "/cards/vinicius-64.webp",   xp: 50,     rarity: "bronze" },  // Vinícius Júnior · 2000
  { id: "premier-contrat", name: "Le Premier Contrat", nameEn: "First Contract",     img: "/cards/haaland.webp",    thumb: "/cards/haaland-64.webp",    xp: 100,    rarity: "bronze" },  // Erling Haaland · 2000
  { id: "banc",            name: "Sur le Banc",        nameEn: "On the Bench",       img: "/cards/hakimi.webp",     thumb: "/cards/hakimi-64.webp",     xp: 150,    rarity: "bronze" },  // Achraf Hakimi · 1998
  { id: "entrant",         name: "L'Entrant",          nameEn: "The Sub",            img: "/cards/mbappe.webp",     thumb: "/cards/mbappe-64.webp",     xp: 300,    rarity: "bronze" },  // Kylian Mbappé · 1998
  { id: "premier-onze",    name: "Premier Onze",       nameEn: "First Eleven",       img: "/cards/mahrez.webp",     thumb: "/cards/mahrez-64.webp",     xp: 500,    rarity: "bronze" },  // Riyad Mahrez · 1991
  { id: "regulier",        name: "Le Régulier",        nameEn: "The Regular",        img: "/cards/mane.webp",       thumb: "/cards/mane-64.webp",       xp: 800,    rarity: "bronze" },  // Sadio Mané · 1992
  { id: "revelation",      name: "La Révélation",      nameEn: "The Breakout",       img: "/cards/salah.webp",      thumb: "/cards/salah-64.webp",      xp: 1000,   rarity: "bronze" },  // Mohamed Salah · 1992
  // ── Argent : les cadres installés, une génération au-dessus ──
  { id: "titulaire",       name: "Le Titulaire",       nameEn: "The Starter",        img: "/cards/vandijk.webp",    thumb: "/cards/vandijk-64.webp",    xp: 1200,   rarity: "argent" },  // Virgil van Dijk · 1991
  { id: "cadre",           name: "Le Cadre",           nameEn: "The Mainstay",       img: "/cards/muller.webp",     thumb: "/cards/muller-64.webp",     xp: 1400,   rarity: "argent" },  // Thomas Müller · 1989
  { id: "numero-10",       name: "Le Numéro 10",       nameEn: "The Number 10",      img: "/cards/neymar.webp",     thumb: "/cards/neymar-64.webp",     xp: 1700,   rarity: "argent" },  // Neymar Jr · 1992
  { id: "brassard",        name: "Le Brassard",        nameEn: "The Armband",        img: "/cards/benzema.webp",    thumb: "/cards/benzema-64.webp",    xp: 2300,   rarity: "argent" },  // Karim Benzema · 1987
  { id: "meneur",          name: "Le Meneur",          nameEn: "The Playmaker",      img: "/cards/modric.webp",     thumb: "/cards/modric-64.webp",     xp: 3000,   rarity: "argent" },  // Luka Modrić · 1985
  { id: "patron",          name: "Le Patron",          nameEn: "The Boss",           img: "/cards/rooney.webp",     thumb: "/cards/rooney-64.webp",     xp: 3500,   rarity: "argent" },  // Wayne Rooney · 1985
  { id: "buteur",          name: "Le Buteur",          nameEn: "The Striker",        img: "/cards/suarez.webp",     thumb: "/cards/suarez-64.webp",     xp: 4000,   rarity: "argent" },  // Luis Suárez · 1987
  // ── Or : les maîtres, ceux dont la carrière est déjà écrite ──
  { id: "international",   name: "L'International",    nameEn: "The Cap",            img: "/cards/iniesta.webp",    thumb: "/cards/iniesta-64.webp",    xp: 5000,   rarity: "or" },  // Andrés Iniesta · 1984
  { id: "recordman",       name: "Le Recordman",       nameEn: "The Record Holder",  img: "/cards/etoo.webp",       thumb: "/cards/etoo-64.webp",       xp: 6500,   rarity: "or" },  // Samuel Eto'o · 1981
  { id: "maestro",         name: "Le Maestro",         nameEn: "The Maestro",        img: "/cards/pirlo.webp",      thumb: "/cards/pirlo-64.webp",      xp: 8000,   rarity: "or" },  // Andrea Pirlo · 1979
  { id: "finisseur",       name: "Le Finisseur",       nameEn: "The Finisher",       img: "/cards/zlatan.webp",     thumb: "/cards/zlatan-64.webp",     xp: 12000,  rarity: "or" },  // Zlatan Ibrahimović · 1981
  { id: "ballon-or",       name: "L'Intenable",        nameEn: "Unstoppable",        img: "/cards/drogba.webp",     thumb: "/cards/drogba-64.webp",     xp: 18000,  rarity: "or" },  // Didier Drogba · 1978
  { id: "palmares",        name: "Le Palmarès",        nameEn: "The Trophy Cabinet", img: "/cards/davids.webp",     thumb: "/cards/davids-64.webp",     xp: 22000,  rarity: "or" },  // Edgar Davids · 1973
  { id: "intouchable",     name: "L'Intouchable",      nameEn: "Untouchable",        img: "/cards/totti.webp",      thumb: "/cards/totti-64.webp",      xp: 26000,  rarity: "or" },  // Francesco Totti · 1976
  // ── Diamant : les monuments, objectif long terme ──
  { id: "phenomene",       name: "Le Roi",             nameEn: "The King",           img: "/cards/henry.webp",      thumb: "/cards/henry-64.webp",      xp: 38000,  rarity: "diamant" },  // Thierry Henry · 1977
  { id: "sorcier",         name: "Le Sorcier",         nameEn: "The Wizard",         img: "/cards/ronaldinho.webp", thumb: "/cards/ronaldinho-64.webp", xp: 45000,  rarity: "diamant" },  // Ronaldinho · 1980
  { id: "legende",         name: "La Légende",         nameEn: "The Legend",         img: "/cards/cr7.webp",        thumb: "/cards/cr7-64.webp",        xp: 55000,  rarity: "diamant" },  // Cristiano Ronaldo · 1985
  { id: "hall-of-fame",    name: "Hall of Fame",       nameEn: "Hall of Fame",       img: "/cards/messi.webp",      thumb: "/cards/messi-64.webp",      xp: 90000,  rarity: "diamant" },  // Lionel Messi · 1987
  { id: "sacre",           name: "Le Sacre",           nameEn: "The Crowning",       img: "/cards/r9.webp",         thumb: "/cards/r9-64.webp",         xp: 120000, rarity: "diamant" },  // Ronaldo R9 · 1976
  { id: "immortel",        name: "L'Immortel",         nameEn: "The Immortal",       img: "/cards/zidane.webp",     thumb: "/cards/zidane-64.webp",     xp: 150000, rarity: "diamant" },  // Zinédine Zidane · 1972
  { id: "goat",            name: "Le GOAT",            nameEn: "The GOAT",           img: "/cards/maradona.webp",   thumb: "/cards/maradona-64.webp",   xp: 250000, rarity: "diamant" },  // Diego Maradona · 1960
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
