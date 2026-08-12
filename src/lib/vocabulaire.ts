// Vocabulaire foot en six langues : pays, postes, ligues, trophées.
//
// POURQUOI CE FICHIER EXISTE
// La base (players.jsx) est écrite en français : `nationalities:["Pays-Bas"]`,
// `positions:["milieu"]`. Ces chaînes sont à la fois une CLÉ (les critères de
// jeu comparent par égalité stricte) et un LIBELLÉ (elles finissent affichées
// telles quelles). Résultat : l'app traduite en allemand montrait une grille
// GOAT GRID dont le cadre était en allemand — « WER PASST? », « BESTÄTIGEN » —
// mais dont les critères restaient « MILIEU », « DEFENSEUR », « PAYS-BAS ».
//
// La règle posée ici : la clé reste française, l'affichage passe par une
// fonction. Ne JAMAIS afficher `p.nationalities[0]` ou `criterion.value`
// directement — toujours `nomPays(...)` / `nomPoste(...)`.
//
// LES PAYS NE SONT PAS ÉCRITS À LA MAIN
// 125 nationalités × 5 langues, ce serait 625 traductions à maintenir et à
// relire. On stocke une seule colonne — le code ISO 3166-1 — et on laisse
// `Intl.DisplayNames` sortir le nom dans la langue voulue : c'est la table du
// navigateur (CLDR), donc juste, accentuée et à jour. Les quatre nations
// britanniques n'ont pas de code ISO ; elles seules sont écrites à la main.

export type Langue = "fr" | "en" | "de" | "it" | "pt" | "es";

/** Un mot dans les six langues. `fr` sert de repli ultime. */
export interface Mot {
  fr: string;
  en: string;
  de: string;
  it: string;
  pt: string;
  es: string;
}

/** Choisit la bonne langue, avec repli anglais puis français (même règle que `tr`). */
export function choisir(mot: Mot, lang?: string): string {
  const l = (lang || "fr") as Langue;
  return mot[l] || mot.en || mot.fr;
}

// ── Pays ────────────────────────────────────────────────────────────────────
// Nom français tel qu'écrit dans players.jsx → code ISO 3166-1 alpha-2.
// Toute nationalité absente d'ici s'affiche en français : c'est visible, donc
// corrigeable. Le test `vocabulaire.test.ts` refuse justement qu'il en manque.
const CODE_PAYS: Record<string, string> = {
  "Afrique du Sud": "ZA", "Albanie": "AL", "Algérie": "DZ", "Allemagne": "DE",
  "Angola": "AO", "Arabie saoudite": "SA", "Argentine": "AR", "Arménie": "AM",
  "Australie": "AU", "Autriche": "AT", "Barbade": "BB", "Belgique": "BE",
  "Biélorussie": "BY", "Bolivie": "BO", "Bosnie-Herzégovine": "BA", "Brésil": "BR",
  "Bulgarie": "BG", "Burkina Faso": "BF", "Burundi": "BI", "Bénin": "BJ",
  "Cameroun": "CM", "Canada": "CA", "Cap-Vert": "CV", "Centrafrique": "CF",
  "Chili": "CL", "Chine": "CN", "Chypre": "CY", "Colombie": "CO",
  "Comores": "KM", "Corée du Sud": "KR", "Costa Rica": "CR", "Croatie": "HR",
  "Curaçao": "CW", "Côte d'Ivoire": "CI", "Danemark": "DK", "Dominique": "DM",
  "Espagne": "ES", "Estonie": "EE", "Finlande": "FI", "France": "FR",
  "Gabon": "GA", "Gambie": "GM", "Ghana": "GH", "Grenade": "GD",
  "Grèce": "GR", "Guinée": "GN", "Guinée équatoriale": "GQ", "Guinée-Bissau": "GW",
  "Géorgie": "GE", "Haïti": "HT", "Honduras": "HN", "Hongrie": "HU",
  "Indonésie": "ID", "Irak": "IQ", "Iran": "IR", "Irlande": "IE",
  "Islande": "IS", "Israël": "IL", "Italie": "IT", "Jamaïque": "JM",
  "Japon": "JP", "Jordanie": "JO", "Kenya": "KE", "Kosovo": "XK",
  "Lettonie": "LV", "Liberia": "LR", "Libye": "LY", "Lituanie": "LT",
  "Luxembourg": "LU", "Macédoine du Nord": "MK", "Mali": "ML", "Malte": "MT",
  "Maroc": "MA", "Mauritanie": "MR", "Mexique": "MX", "Monténégro": "ME",
  "Mozambique": "MZ", "Nigeria": "NG", "Norvège": "NO", "Nouvelle-Zélande": "NZ",
  "Oman": "OM", "Ouzbékistan": "UZ", "Pakistan": "PK", "Panama": "PA",
  "Paraguay": "PY", "Pays-Bas": "NL", "Pologne": "PL", "Portugal": "PT",
  "Pérou": "PE", "Qatar": "QA", "RD Congo": "CD", "Roumanie": "RO",
  "Russie": "RU", "République dominicaine": "DO", "République du Congo": "CG",
  "Serbie": "RS", "Sierra Leone": "SL", "Slovaquie": "SK", "Slovénie": "SI",
  "Soudan": "SD", "Suisse": "CH", "Suriname": "SR", "Suède": "SE",
  "Syrie": "SY", "Sénégal": "SN", "Taïwan": "TW", "Tchéquie": "CZ",
  "Togo": "TG", "Trinité-et-Tobago": "TT", "Tunisie": "TN", "Turquie": "TR",
  "Ukraine": "UA", "Uruguay": "UY", "Venezuela": "VE", "Zambie": "ZM",
  "Zimbabwe": "ZW", "Égypte": "EG", "Équateur": "EC",
  "État de Palestine": "PS", "États-Unis": "US", "Îles Féroé": "FO",
  // Graphies alternatives croisées ailleurs dans le code (tables de drapeaux,
  // de continents) : elles ne coûtent rien et évitent un trou d'affichage si
  // une fiche les emploie un jour.
  "République tchèque": "CZ", "Bosnie": "BA", "Congo": "CG",
  "Émirats arabes unis": "AE",
};

// Les quatre nations britanniques ne sont pas des pays ISO : la FIFA les
// reconnaît, la norme non. Elles sont donc écrites à la main.
const NATIONS_BRITANNIQUES: Record<string, Mot> = {
  "Angleterre": { fr: "Angleterre", en: "England", de: "England", it: "Inghilterra", pt: "Inglaterra", es: "Inglaterra" },
  "Écosse": { fr: "Écosse", en: "Scotland", de: "Schottland", it: "Scozia", pt: "Escócia", es: "Escocia" },
  "Pays de Galles": { fr: "Pays de Galles", en: "Wales", de: "Wales", it: "Galles", pt: "País de Gales", es: "Gales" },
  "Irlande du Nord": { fr: "Irlande du Nord", en: "Northern Ireland", de: "Nordirland", it: "Irlanda del Nord", pt: "Irlanda do Norte", es: "Irlanda del Norte" },
};

const afficheurs: Record<string, any> = {};
const cachePays = new Map<string, string>();

/**
 * Nom d'un pays dans la langue demandée, à partir de son nom FRANÇAIS.
 *
 * `nomPays("Pays-Bas", "de")` → « Niederlande ».
 *
 * En cas de doute — pays inconnu, `Intl.DisplayNames` absent — on rend le nom
 * français plutôt que rien : une chaîne dans la mauvaise langue reste lisible,
 * une chaîne vide casse la puce.
 */
export function nomPays(pays: string, lang?: string): string {
  if (!pays) return "";
  if (!lang || lang === "fr") return pays;
  const britannique = NATIONS_BRITANNIQUES[pays];
  if (britannique) return choisir(britannique, lang);
  const code = CODE_PAYS[pays];
  if (!code) return pays;
  const cle = lang + "|" + code;
  const connu = cachePays.get(cle);
  if (connu !== undefined) return connu;
  let nom = pays;
  try {
    if (!afficheurs[lang]) afficheurs[lang] = new (Intl as any).DisplayNames([lang], { type: "region" });
    // CLDR écrit « Congo - Kinshasa » avec des espaces autour du tiret ; sur une
    // puce de 80 px ça part en trois lignes pour rien.
    nom = (afficheurs[lang].of(code) || pays).replace(/\s+-\s+/g, "-");
  } catch {
    nom = pays;
  }
  cachePays.set(cle, nom);
  return nom;
}

/** Les nationalités que le module sait traduire — sert au test de couverture. */
export function paysConnus(): string[] {
  return [...Object.keys(CODE_PAYS), ...Object.keys(NATIONS_BRITANNIQUES)];
}

// ── Postes ──────────────────────────────────────────────────────────────────
// players.jsx écrit sans accent et en minuscules : gardien, defenseur, milieu,
// attaquant. On accepte aussi la forme accentuée, croisée dans quelques fiches.
const POSTES: Record<string, Mot> = {
  gardien: { fr: "Gardien", en: "Goalkeeper", de: "Torwart", it: "Portiere", pt: "Goleiro", es: "Portero" },
  defenseur: { fr: "Défenseur", en: "Defender", de: "Verteidiger", it: "Difensore", pt: "Zagueiro", es: "Defensa" },
  milieu: { fr: "Milieu", en: "Midfielder", de: "Mittelfeld", it: "Centrocampista", pt: "Meio-campo", es: "Centrocampista" },
  attaquant: { fr: "Attaquant", en: "Forward", de: "Stürmer", it: "Attaccante", pt: "Atacante", es: "Delantero" },
};

const clePoste = (p: string) =>
  (p || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Nom d'un poste dans la langue demandée. `nomPoste("milieu","de")` → « Mittelfeld ». */
export function nomPoste(poste: string, lang?: string): string {
  const mot = POSTES[clePoste(poste)];
  return mot ? choisir(mot, lang) : poste;
}

/** Poste au long, pour une phrase (« évolue au poste de … »). */
const POSTES_LONGS: Record<string, Mot> = {
  gardien: { fr: "gardien de but", en: "goalkeeper", de: "Torwart", it: "portiere", pt: "goleiro", es: "portero" },
  defenseur: { fr: "défenseur", en: "defender", de: "Verteidiger", it: "difensore", pt: "zagueiro", es: "defensa" },
  milieu: { fr: "milieu de terrain", en: "midfielder", de: "Mittelfeldspieler", it: "centrocampista", pt: "meio-campista", es: "centrocampista" },
  attaquant: { fr: "attaquant", en: "forward", de: "Stürmer", it: "attaccante", pt: "atacante", es: "delantero" },
};

export function nomPosteLong(poste: string, lang?: string): string {
  const mot = POSTES_LONGS[clePoste(poste)];
  return mot ? choisir(mot, lang) : poste;
}

// ── Ligues ──────────────────────────────────────────────────────────────────
// Le libellé est court exprès : il s'affiche dans une puce de grille de 80 px.
const LIGUES: Record<string, Mot> = {
  ligue1: { fr: "A joué en L1", en: "Played in L1", de: "Spielte in der L1", it: "Ha giocato in L1", pt: "Jogou na L1", es: "Jugó en la L1" },
  premier_league: { fr: "A joué en PL", en: "Played in PL", de: "Spielte in der PL", it: "Ha giocato in PL", pt: "Jogou na PL", es: "Jugó en la PL" },
  liga: { fr: "A joué en Liga", en: "Played in Liga", de: "Spielte in der Liga", it: "Ha giocato in Liga", pt: "Jogou na Liga", es: "Jugó en la Liga" },
  serie_a: { fr: "A joué en Serie A", en: "Played in Serie A", de: "Spielte in der Serie A", it: "Ha giocato in Serie A", pt: "Jogou na Serie A", es: "Jugó en la Serie A" },
  bundesliga: { fr: "A joué en Bundesliga", en: "Played in Bundesliga", de: "Spielte in der Bundesliga", it: "Ha giocato in Bundesliga", pt: "Jogou na Bundesliga", es: "Jugó en la Bundesliga" },
};

/** Nom complet du championnat, pour l'infobulle. */
const LIGUES_LONGUES: Record<string, Mot> = {
  ligue1: { fr: "Ligue 1 française", en: "French Ligue 1", de: "französischen Ligue 1", it: "Ligue 1 francese", pt: "Ligue 1 francesa", es: "Ligue 1 francesa" },
  premier_league: { fr: "Premier League anglaise", en: "English Premier League", de: "englischen Premier League", it: "Premier League inglese", pt: "Premier League inglesa", es: "Premier League inglesa" },
  liga: { fr: "Liga espagnole", en: "Spanish La Liga", de: "spanischen La Liga", it: "Liga spagnola", pt: "La Liga espanhola", es: "Liga española" },
  serie_a: { fr: "Serie A italienne", en: "Italian Serie A", de: "italienischen Serie A", it: "Serie A italiana", pt: "Serie A italiana", es: "Serie A italiana" },
  bundesliga: { fr: "Bundesliga allemande", en: "German Bundesliga", de: "deutschen Bundesliga", it: "Bundesliga tedesca", pt: "Bundesliga alemã", es: "Bundesliga alemana" },
};

export function nomLigue(ligue: string, lang?: string): string {
  const mot = LIGUES[ligue];
  return mot ? choisir(mot, lang) : ligue;
}

export function nomLigueLongue(ligue: string, lang?: string): string {
  const mot = LIGUES_LONGUES[ligue];
  return mot ? choisir(mot, lang) : ligue;
}

// ── Trophées et reconversion ────────────────────────────────────────────────
const TROPHEES: Record<string, Mot> = {
  world_cup: { fr: "Vainqueur CDM", en: "WC Winner", de: "WM-Sieger", it: "Vincitore Mondiale", pt: "Campeão do Mundo", es: "Campeón del Mundo" },
  champions_league: { fr: "Vainqueur LDC", en: "UCL Winner", de: "CL-Sieger", it: "Vincitore UCL", pt: "Campeão da UCL", es: "Campeón de la UCL" },
};

export function nomTrophee(trophee: string, lang?: string): string {
  const mot = TROPHEES[trophee];
  return mot ? choisir(mot, lang) : trophee;
}

// ── Mois ────────────────────────────────────────────────────────────────────
// Même raisonnement que pour les pays : la table du navigateur plutôt que douze
// noms × six langues recopiés à la main. La saison et l'historique du classement
// affichaient « OCTOBER 2026 » à un joueur allemand, faute de troisième colonne.
const cacheMois = new Map<string, string>();

/**
 * Nom du mois (0 = janvier) dans la langue demandée, capitale initiale.
 * `court` donne la forme abrégée des graphiques (« Okt. »).
 */
export function nomMois(index: number, lang?: string, court = false): string {
  const l = lang || "fr";
  const cle = l + "|" + index + "|" + (court ? "c" : "l");
  const connu = cacheMois.get(cle);
  if (connu !== undefined) return connu;
  // Un 15 : aucun mois n'a moins de 28 jours, et le milieu du mois met à l'abri
  // des décalages de fuseau qui feraient basculer sur le mois voisin.
  const d = new Date(Date.UTC(2021, index, 15));
  let nom = String(index + 1);
  try {
    nom = new Intl.DateTimeFormat(l, { month: court ? "short" : "long", timeZone: "UTC" }).format(d);
    nom = nom.charAt(0).toUpperCase() + nom.slice(1);
  } catch { /* repli sur le numéro, jamais sur du vide */ }
  cacheMois.set(cle, nom);
  return nom;
}

export const MOT_ENTRAINEUR: Mot = {
  fr: "Devenu entraîneur", en: "Became coach", de: "Wurde Trainer",
  it: "Diventato allenatore", pt: "Virou treinador", es: "Se hizo entrenador",
};
