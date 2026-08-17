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
// ── Ordre de la collection : UNE carrière, pas une galerie ───────────────────
// Les vingt-neuf visuels montrent LE MÊME joueur, de ses seize ans à sa
// retraite. La collection ne se lit donc pas comme un panthéon mais comme une
// progression : le gamin qui entre dans un vestiaire vide sur « La Recrue » est
// le vétéran de « L'Immortel », vingt-huit cartes plus loin.
//
// C'est ce qui aligne enfin le NOM et le VISUEL. Les noms décrivaient déjà des
// étapes de carrière (La Recrue → Le GOAT) ; ils décrivent maintenant aussi ce
// qu'on voit. Conséquence directe : l'ordre des cartes n'est plus arbitrable au
// goût, il suit l'âge du personnage. Déplacer une carte d'une catégorie à
// l'autre demande une nouvelle illustration, pas seulement un nouveau palier.
//
// ⚠️ Deux cartes portent un `id` qui ne correspond plus à leur nom :
// `ballon-or` s'appelle « L'Intenable » et `phenomene` « Le Roi ». L'id reste
// tel quel — c'est la clé stockée en base, la renommer ferait pointer dans le
// vide le badge des joueurs qui ont choisi la carte. Attention en manipulant
// les fichiers : `ballon-or.webp` n'a rien à voir avec un Ballon d'Or.
//
// ── Pourquoi plus aucun footballeur réel ─────────────────────────────────────
// Les visuels précédents représentaient des joueurs identifiables (Mbappé,
// Messi…), en maillot de sélection, écussons de fédération et logos
// d'équipementier visibles. Sur une app commerciale — publicités, lot en
// argent, fiches stores — c'est un risque à trois têtes : droit à l'image des
// personnes, marques déposées, et surtout retrait de la fiche Play sur simple
// signalement, avec le compte développeur en jeu.
//
// Le remplacement ne coûte rien au jeu parce que les noms de cartes n'ont
// jamais nommé personne. Règle à tenir pour tout visuel futur : personnage
// inventé, maillot rouge uni, aucun écusson, aucune marque, aucun texte
// lisible, aucun trophée existant.
//
// ── Les fichiers ─────────────────────────────────────────────────────────────
// public/cards/, WebP 600 × 800 (~75 Ko) plus une vignette 48 × 64 pour le
// badge affiché à côté du pseudo. Les fichiers portent l'`id` de la carte :
// c'était faux tant qu'un visuel représentait quelqu'un d'autre que la carte,
// c'est exact maintenant qu'il n'y a qu'un personnage et une carte par étape.
//
// La vignette n'est PAS l'image réduite : elle est recadrée sur le visage. Sur
// un plan en pied, la tête fait 10 % de la hauteur — réduite en 48 × 64 elle
// donnerait six pixels. Les repères de recadrage vivent dans scripts/cartes.mjs.
//
// img/thumb peuvent valoir null — la carte s'affiche alors en emplacement
// « à venir », surtout PAS avec une image d'emprunt : les visuels de modes de
// jeu qui servaient de bouche-trous se lisaient comme de vraies cartes.

export type Rarity = "depart" | "bronze" | "argent" | "or" | "diamant";

import { getLang } from "./lang";

export type RarityMeta = {
  key: Rarity;
  label: string;
  labelEn: string;
  labelDe?: string;
  labelIt?: string;
  labelPt?: string;
  labelEs?: string;
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
  { key: "depart",  label: "Départ",  labelEn: "Starter",  labelDe: "Start",   labelIt: "Inizio",   labelPt: "Início",   labelEs: "Inicio",
    color: "#8D99AE", glow: "rgba(141,153,174,.4)",
    frame: "linear-gradient(160deg,#9AA5B1,#5C6672)" },
  { key: "bronze",  label: "Bronze",  labelEn: "Bronze",   labelDe: "Bronze",  labelIt: "Bronzo",   labelPt: "Bronze",   labelEs: "Bronce",
    color: "#CD7F32", glow: "rgba(205,127,50,.45)",
    frame: "linear-gradient(160deg,#E8A860,#8C4E1A)" },
  { key: "argent",  label: "Argent",  labelEn: "Silver",   labelDe: "Silber",  labelIt: "Argento",  labelPt: "Prata",    labelEs: "Plata",
    color: "#C8CDD4", glow: "rgba(200,205,212,.45)",
    frame: "linear-gradient(160deg,#FFFFFF,#8E97A3)" },
  { key: "or",      label: "Or",      labelEn: "Gold",     labelDe: "Gold",    labelIt: "Oro",      labelPt: "Ouro",     labelEs: "Oro",
    color: "#F5C22B", glow: "rgba(245,194,43,.5)",
    frame: "linear-gradient(160deg,#FFE066,#B98407)" },
  { key: "diamant", label: "Diamant", labelEn: "Diamond",  labelDe: "Diamant", labelIt: "Diamante", labelPt: "Diamante", labelEs: "Diamante",
    color: "#8FE9FF", glow: "rgba(143,233,255,.65)",
    frame: "linear-gradient(160deg,#FFFFFF,#8FE9FF,#5AA6FF,#FFFFFF)", cls: "bbDiamant" },
];

/** Nom de la rareté dans la langue courante — même repli que `tr` : en, puis fr. */
export function rarityLabel(r: RarityMeta): string {
  const l = getLang();
  if (l === "de") return r.labelDe || r.labelEn || r.label;
  if (l === "it") return r.labelIt || r.labelEn || r.label;
  if (l === "pt") return r.labelPt || r.labelEn || r.label;
  if (l === "es") return r.labelEs || r.labelEn || r.label;
  if (l === "en") return r.labelEn || r.label;
  return r.label;
}

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
// contrairement au nom, au palier et au visuel — qui, eux, se corrigent.
export const CARDS: Card[] = [
  // ── Départ : tout le monde l'a. Seize ans, vestiaire vide, lumière froide ──
  { id: "recrue",          name: "La Recrue",          nameEn: "The Rookie",         img: "/cards/recrue.webp",      thumb: "/cards/recrue-64.webp",      xp: 0,      rarity: "depart" },
  // ── Bronze : les débuts. ~20 ans, petit stade, lumière cuivrée sobre ──
  { id: "premier-but",     name: "Premier But",        nameEn: "First Goal",         img: "/cards/premier-but.webp",   thumb: "/cards/premier-but-64.webp",   xp: 50,     rarity: "bronze" },
  { id: "premier-contrat", name: "Le Premier Contrat", nameEn: "First Contract",     img: "/cards/premier-contrat.webp",    thumb: "/cards/premier-contrat-64.webp",    xp: 100,    rarity: "bronze" },
  { id: "banc",            name: "Sur le Banc",        nameEn: "On the Bench",       img: "/cards/banc.webp",     thumb: "/cards/banc-64.webp",     xp: 150,    rarity: "bronze" },
  { id: "entrant",         name: "L'Entrant",          nameEn: "The Sub",            img: "/cards/entrant.webp",     thumb: "/cards/entrant-64.webp",     xp: 300,    rarity: "bronze" },
  { id: "premier-onze",    name: "Premier Onze",       nameEn: "First Eleven",       img: "/cards/premier-onze.webp",     thumb: "/cards/premier-onze-64.webp",     xp: 500,    rarity: "bronze" },
  { id: "regulier",        name: "Le Régulier",        nameEn: "The Regular",        img: "/cards/regulier.webp",       thumb: "/cards/regulier-64.webp",       xp: 800,    rarity: "bronze" },
  { id: "revelation",      name: "La Révélation",      nameEn: "The Breakout",       img: "/cards/revelation.webp",      thumb: "/cards/revelation-64.webp",      xp: 1000,   rarity: "bronze" },
  // ── Argent : le cadre installé. ~30 ans, stade plein, plein jour cru ──
  { id: "titulaire",       name: "Le Titulaire",       nameEn: "The Starter",        img: "/cards/titulaire.webp",    thumb: "/cards/titulaire-64.webp",    xp: 1200,   rarity: "argent" },
  { id: "cadre",           name: "Le Cadre",           nameEn: "The Mainstay",       img: "/cards/cadre.webp",     thumb: "/cards/cadre-64.webp",     xp: 1400,   rarity: "argent" },
  { id: "numero-10",       name: "Le Numéro 10",       nameEn: "The Number 10",      img: "/cards/numero-10.webp",     thumb: "/cards/numero-10-64.webp",     xp: 1700,   rarity: "argent" },
  { id: "brassard",        name: "Le Brassard",        nameEn: "The Armband",        img: "/cards/brassard.webp",    thumb: "/cards/brassard-64.webp",    xp: 2300,   rarity: "argent" },
  { id: "meneur",          name: "Le Meneur",          nameEn: "The Playmaker",      img: "/cards/meneur.webp",     thumb: "/cards/meneur-64.webp",     xp: 3000,   rarity: "argent" },
  { id: "patron",          name: "Le Patron",          nameEn: "The Boss",           img: "/cards/patron.webp",     thumb: "/cards/patron-64.webp",     xp: 3500,   rarity: "argent" },
  { id: "buteur",          name: "Le Buteur",          nameEn: "The Striker",        img: "/cards/buteur.webp",     thumb: "/cards/buteur-64.webp",     xp: 4000,   rarity: "argent" },
  // ── Or : la maîtrise. ~35 ans, fin de journée, doré rasant ──
  { id: "international",   name: "L'International",    nameEn: "The Cap",            img: "/cards/international.webp",    thumb: "/cards/international-64.webp",    xp: 5000,   rarity: "or" },
  { id: "recordman",       name: "Le Recordman",       nameEn: "The Record Holder",  img: "/cards/recordman.webp",       thumb: "/cards/recordman-64.webp",       xp: 6500,   rarity: "or" },
  { id: "maestro",         name: "Le Maestro",         nameEn: "The Maestro",        img: "/cards/maestro.webp",      thumb: "/cards/maestro-64.webp",      xp: 8000,   rarity: "or" },
  { id: "finisseur",       name: "Le Finisseur",       nameEn: "The Finisher",       img: "/cards/finisseur.webp",     thumb: "/cards/finisseur-64.webp",     xp: 12000,  rarity: "or" },
  { id: "ballon-or",       name: "L'Intenable",        nameEn: "Unstoppable",        img: "/cards/ballon-or.webp",     thumb: "/cards/ballon-or-64.webp",     xp: 18000,  rarity: "or" },
  { id: "palmares",        name: "Le Palmarès",        nameEn: "The Trophy Cabinet", img: "/cards/palmares.webp",     thumb: "/cards/palmares-64.webp",     xp: 22000,  rarity: "or" },
  { id: "intouchable",     name: "L'Intouchable",      nameEn: "Untouchable",        img: "/cards/intouchable.webp",      thumb: "/cards/intouchable-64.webp",      xp: 26000,  rarity: "or" },
  // ── Diamant : le monument. Vétéran, nuit, contre-jour et bleu glacier ──
  { id: "phenomene",       name: "Le Roi",             nameEn: "The King",           img: "/cards/phenomene.webp",      thumb: "/cards/phenomene-64.webp",      xp: 38000,  rarity: "diamant" },
  { id: "sorcier",         name: "Le Sorcier",         nameEn: "The Wizard",         img: "/cards/sorcier.webp", thumb: "/cards/sorcier-64.webp", xp: 45000,  rarity: "diamant" },
  { id: "legende",         name: "La Légende",         nameEn: "The Legend",         img: "/cards/legende.webp",        thumb: "/cards/legende-64.webp",        xp: 55000,  rarity: "diamant" },
  { id: "hall-of-fame",    name: "Hall of Fame",       nameEn: "Hall of Fame",       img: "/cards/hall-of-fame.webp",      thumb: "/cards/hall-of-fame-64.webp",      xp: 90000,  rarity: "diamant" },
  { id: "sacre",           name: "Le Sacre",           nameEn: "The Crowning",       img: "/cards/sacre.webp",         thumb: "/cards/sacre-64.webp",         xp: 120000, rarity: "diamant" },
  { id: "immortel",        name: "L'Immortel",         nameEn: "The Immortal",       img: "/cards/immortel.webp",     thumb: "/cards/immortel-64.webp",     xp: 150000, rarity: "diamant" },
  { id: "goat",            name: "Le GOAT",            nameEn: "The GOAT",           img: "/cards/goat.webp",   thumb: "/cards/goat-64.webp",   xp: 250000, rarity: "diamant" },
];

// ── Noms de cartes dans les six langues ──────────────────────────────────────
// La table CARDS ne porte que le français et l'anglais, et ses lignes sont déjà
// larges : les quatre autres langues vivent ici, indexées par `id`. Sans elles,
// une collection en allemand affichait « The Rookie » sous un titre « MEINE
// SAMMLUNG ».
//
// Ce sont des noms de CARTE, pas des traductions littérales : on garde le
// registre — court, imagé, un peu solennel — plutôt que le mot à mot.
const NOMS_CARTES: Record<string, { de: string; it: string; pt: string; es: string }> = {
  "recrue":          { de: "Der Neuzugang",     it: "La Recluta",         pt: "O Novato",           es: "El Novato" },
  "premier-but":     { de: "Erstes Tor",        it: "Primo Gol",          pt: "Primeiro Gol",       es: "Primer Gol" },
  "premier-contrat": { de: "Erster Vertrag",    it: "Primo Contratto",    pt: "Primeiro Contrato",  es: "Primer Contrato" },
  "banc":            { de: "Auf der Bank",      it: "In Panchina",        pt: "No Banco",           es: "En el Banquillo" },
  "entrant":         { de: "Der Joker",         it: "Il Subentrante",     pt: "O Reserva",          es: "El Suplente" },
  "premier-onze":    { de: "Erste Elf",         it: "Primo Undici",       pt: "Onze Inicial",       es: "El Once Inicial" },
  "regulier":        { de: "Der Dauerbrenner",  it: "Il Costante",        pt: "O Constante",        es: "El Fijo" },
  "revelation":      { de: "Die Entdeckung",    it: "La Rivelazione",     pt: "A Revelação",        es: "La Revelación" },
  "titulaire":       { de: "Der Stammspieler",  it: "Il Titolare",        pt: "O Titular",          es: "El Titular" },
  "cadre":           { de: "Die Stütze",        it: "Il Pilastro",        pt: "O Pilar",            es: "El Pilar" },
  "numero-10":       { de: "Die Nummer 10",     it: "Il Numero 10",       pt: "O Camisa 10",        es: "El Número 10" },
  "brassard":        { de: "Die Kapitänsbinde", it: "La Fascia",          pt: "A Braçadeira",       es: "El Brazalete" },
  "meneur":          { de: "Der Spielmacher",   it: "Il Regista",         pt: "O Armador",          es: "El Organizador" },
  "patron":          { de: "Der Chef",          it: "Il Capo",            pt: "O Chefe",            es: "El Jefe" },
  "buteur":          { de: "Der Torjäger",      it: "Il Bomber",          pt: "O Artilheiro",       es: "El Goleador" },
  "international":   { de: "Der Nationalspieler", it: "Il Nazionale",     pt: "O Internacional",    es: "El Internacional" },
  "recordman":       { de: "Der Rekordhalter",  it: "Il Recordman",       pt: "O Recordista",       es: "El Recordista" },
  "maestro":         { de: "Der Maestro",       it: "Il Maestro",         pt: "O Maestro",          es: "El Maestro" },
  "finisseur":       { de: "Der Vollstrecker",  it: "Il Finalizzatore",   pt: "O Finalizador",      es: "El Finalizador" },
  "ballon-or":       { de: "Unaufhaltsam",      it: "L'Inarrestabile",    pt: "O Imparável",        es: "El Imparable" },
  "palmares":        { de: "Die Titelsammlung", it: "La Bacheca",         pt: "A Sala de Troféus",  es: "El Palmarés" },
  "intouchable":     { de: "Unantastbar",       it: "L'Intoccabile",      pt: "O Intocável",        es: "El Intocable" },
  "phenomene":       { de: "Der König",         it: "Il Re",              pt: "O Rei",              es: "El Rey" },
  "sorcier":         { de: "Der Zauberer",      it: "Il Mago",            pt: "O Mago",             es: "El Mago" },
  "legende":         { de: "Die Legende",       it: "La Leggenda",        pt: "A Lenda",            es: "La Leyenda" },
  "hall-of-fame":    { de: "Hall of Fame",      it: "Hall of Fame",       pt: "Hall of Fame",       es: "Hall of Fame" },
  "sacre":           { de: "Die Krönung",       it: "La Consacrazione",   pt: "A Consagração",      es: "La Consagración" },
  "immortel":        { de: "Der Unsterbliche",  it: "L'Immortale",        pt: "O Imortal",          es: "El Inmortal" },
  "goat":            { de: "Der GOAT",          it: "Il GOAT",            pt: "O GOAT",             es: "El GOAT" },
};

/** Nom d'une carte dans la langue courante. Repli : anglais, puis français. */
export function cardName(card: { id: string; name: string; nameEn: string }): string {
  const l = getLang();
  if (l === "fr") return card.name;
  const autres = NOMS_CARTES[card.id];
  if (autres && (autres as any)[l]) return (autres as any)[l];
  return card.nameEn || card.name;
}

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
 * Carte du NIVEAU : la meilleure carte possédée à cette XP. C'est LA photo de
 * profil du joueur, partout et sans exception — classement, salle, profil, VS,
 * bouton d'accueil.
 *
 * ── IL N'Y A PLUS DE CHOIX, ET C'EST LE POINT ────────────────────────────────
 *
 * On pouvait avant choisir n'importe quelle carte débloquée comme badge, ce qui
 * figeait sa photo sur elle. Deux défauts, et le second est le vrai :
 *
 *  • un joueur pouvait afficher « La Recrue » à 60 000 XP, si bien que sa photo
 *    ne disait plus rien de son niveau — or c'est tout ce qu'on lui demande de
 *    dire ;
 *  • surtout, le badge ne bougeait plus. Passer un palier ne changeait rien à
 *    l'écran, alors que la récompense EST le changement de tête.
 *
 * La carte suit donc l'XP, automatiquement. Franchir un palier remplace la
 * photo de profil, sans rien à faire et sans possibilité de la figer.
 *
 * Corollaire : deux joueurs à la même XP ont la même carte. C'est voulu — la
 * carte est un grade, pas une décoration.
 */
export function levelCard(xp: number): Card {
  // Seules les cartes illustrées peuvent servir de photo de profil : sinon un
  // joueur très avancé se retrouverait avec un cadre vide.
  const owned = unlockedCards(xp).filter(hasArt);
  return owned[owned.length - 1] || CARDS[0]; // CARDS[0] est à 0 XP et illustrée
}
