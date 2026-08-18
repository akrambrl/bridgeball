// LES PAYS : DRAPEAUX ET CONTINENTS, EN UN SEUL ENDROIT
//
// ── POURQUOI CE FICHIER EXISTE ────────────────────────────────────────────
//
// Il y avait TROIS tables de pays recopiées dans trois fichiers, et elles avaient
// divergé. Mesuré sur les 125 nationalités réellement présentes dans la base :
//
//     GoatGuess     FLAGS      127 clés ·  0 trou
//     vocabulaire   CODE_PAYS  126 clés ·  0 trou  (les nations britanniques
//                                                   passent par une table à part)
//     FindPlayer    NAT_CONT    99 clés · 30 trous
//     FindPlayer    NAT_FLAG    90 clés · 37 trous
//
// 41 nationalités sur 125 avaient au moins un trou, soit 887 joueurs affichés
// sans drapeau ou sans zone dans « Trouve le joueur ». George Weah en faisait
// partie — Liberia manquait dans les DEUX tables de cet écran — et c'est un
// joueur qui l'a remarqué avant nous.
//
// Le défaut n'était pas une donnée absente : la table de GoatGuess était complète.
// La donnée existait dans le dépôt, elle n'était simplement pas partagée. C'est
// pour ça que la réparation consiste à FUSIONNER et non à compléter : trois
// copies rediviseront toujours, une seule table ne peut pas.
//
// ── LA LOGIQUE DES CONTINENTS EST FOOTBALLISTIQUE, PAS GÉOGRAPHIQUE ───────
//
// Israël, la Géorgie, l'Arménie et Chypre sont classés EU parce qu'ils jouent en
// UEFA. C'était déjà le choix de la table d'origine, et le conserver importe : la
// zone sert d'INDICE dans « Trouve le joueur », donc elle doit correspondre à ce
// qu'un joueur de foot a en tête, pas à un atlas.
//
// ── CE QUI EMPÊCHE LA DÉRIVE DE REVENIR ──────────────────────────────────
//
// src/test/pays.test.ts échoue si une seule nationalité de la base n'a pas son
// drapeau ET son continent. Ajouter un joueur d'un pays inconnu casse donc le
// test au lieu de produire un écran à trou — ce qui est exactement l'inverse de
// ce qui s'est passé pendant des mois.

/** Drapeau emoji par nationalité, en français. */
export const DRAPEAUX: Record<string, string> = {
  "Afrique du Sud": "🇿🇦",
  "Albanie": "🇦🇱",
  "Algérie": "🇩🇿",
  "Allemagne": "🇩🇪",
  "Angleterre": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "Angola": "🇦🇴",
  "Arabie saoudite": "🇸🇦",
  "Argentine": "🇦🇷",
  "Arménie": "🇦🇲",
  "Australie": "🇦🇺",
  "Autriche": "🇦🇹",
  "Barbade": "🇧🇧",
  "Belgique": "🇧🇪",
  "Bénin": "🇧🇯",
  "Biélorussie": "🇧🇾",
  "Bolivie": "🇧🇴",
  "Bosnie": "🇧🇦",
  "Bosnie-Herzégovine": "🇧🇦",
  "Brésil": "🇧🇷",
  "Bulgarie": "🇧🇬",
  "Burkina Faso": "🇧🇫",
  "Burundi": "🇧🇮",
  "Cameroun": "🇨🇲",
  "Canada": "🇨🇦",
  "Cap-Vert": "🇨🇻",
  "Centrafrique": "🇨🇫",
  "Chili": "🇨🇱",
  "Chine": "🇨🇳",
  "Chypre": "🇨🇾",
  "Colombie": "🇨🇴",
  "Comores": "🇰🇲",
  "Corée du Sud": "🇰🇷",
  "Costa Rica": "🇨🇷",
  "Côte d'Ivoire": "🇨🇮",
  "Croatie": "🇭🇷",
  "Curaçao": "🇨🇼",
  "Danemark": "🇩🇰",
  "Dominique": "🇩🇲",
  "Écosse": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  "Égypte": "🇪🇬",
  "Équateur": "🇪🇨",
  "Espagne": "🇪🇸",
  "Estonie": "🇪🇪",
  "État de Palestine": "🇵🇸",
  "États-Unis": "🇺🇸",
  "Finlande": "🇫🇮",
  "France": "🇫🇷",
  "Gabon": "🇬🇦",
  "Gambie": "🇬🇲",
  "Géorgie": "🇬🇪",
  "Ghana": "🇬🇭",
  "Grèce": "🇬🇷",
  "Grenade": "🇬🇩",
  "Guinée": "🇬🇳",
  "Guinée équatoriale": "🇬🇶",
  "Guinée-Bissau": "🇬🇼",
  "Haïti": "🇭🇹",
  "Honduras": "🇭🇳",
  "Hongrie": "🇭🇺",
  "Îles Féroé": "🇫🇴",
  "Indonésie": "🇮🇩",
  "Irak": "🇮🇶",
  "Iran": "🇮🇷",
  "Irlande": "🇮🇪",
  "Irlande du Nord": "🇬🇧",
  "Islande": "🇮🇸",
  "Israël": "🇮🇱",
  "Italie": "🇮🇹",
  "Jamaïque": "🇯🇲",
  "Japon": "🇯🇵",
  "Jordanie": "🇯🇴",
  "Kenya": "🇰🇪",
  "Kosovo": "🇽🇰",
  "Lettonie": "🇱🇻",
  "Liberia": "🇱🇷",
  "Libye": "🇱🇾",
  "Lituanie": "🇱🇹",
  "Luxembourg": "🇱🇺",
  "Macédoine du Nord": "🇲🇰",
  "Mali": "🇲🇱",
  "Malte": "🇲🇹",
  "Maroc": "🇲🇦",
  "Mauritanie": "🇲🇷",
  "Mexique": "🇲🇽",
  "Monténégro": "🇲🇪",
  "Mozambique": "🇲🇿",
  "Nigeria": "🇳🇬",
  "Norvège": "🇳🇴",
  "Nouvelle-Zélande": "🇳🇿",
  "Oman": "🇴🇲",
  "Ouzbékistan": "🇺🇿",
  "Pakistan": "🇵🇰",
  "Panama": "🇵🇦",
  "Paraguay": "🇵🇾",
  "Pays de Galles": "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
  "Pays-Bas": "🇳🇱",
  "Pérou": "🇵🇪",
  "Pologne": "🇵🇱",
  "Portugal": "🇵🇹",
  "Qatar": "🇶🇦",
  "RD Congo": "🇨🇩",
  "République dominicaine": "🇩🇴",
  "République Dominicaine": "🇩🇴",
  "République du Congo": "🇨🇬",
  "Roumanie": "🇷🇴",
  "Russie": "🇷🇺",
  "Sénégal": "🇸🇳",
  "Serbie": "🇷🇸",
  "Sierra Leone": "🇸🇱",
  "Slovaquie": "🇸🇰",
  "Slovénie": "🇸🇮",
  "Soudan": "🇸🇩",
  "Suède": "🇸🇪",
  "Suisse": "🇨🇭",
  "Suriname": "🇸🇷",
  "Syrie": "🇸🇾",
  "Taïwan": "🇹🇼",
  "Tchéquie": "🇨🇿",
  "Togo": "🇹🇬",
  "Trinité-et-Tobago": "🇹🇹",
  "Tunisie": "🇹🇳",
  "Turquie": "🇹🇷",
  "Ukraine": "🇺🇦",
  "Uruguay": "🇺🇾",
  "Venezuela": "🇻🇪",
  "Zambie": "🇿🇲",
  "Zimbabwe": "🇿🇼",
};

/**
 * Zone d'appartenance, telle qu'affichée en indice.
 *
 * EU · AF · AS · AmN · AmS · OC — six codes, et pas plus : l'indice se lit d'un
 * coup d'œil, une granularité plus fine le rendrait inutile.
 */
export const CONTINENTS: Record<string, string> = {
  "Afrique du Sud": "AF",
  "Albanie": "EU",
  "Algérie": "AF",
  "Allemagne": "EU",
  "Angleterre": "EU",
  "Angola": "AF",
  "Arabie saoudite": "AS",
  "Argentine": "AmS",
  "Arménie": "EU",
  "Australie": "OC",
  "Autriche": "EU",
  "Barbade": "AmN",
  "Belgique": "EU",
  "Bénin": "AF",
  "Biélorussie": "EU",
  "Bolivie": "AmS",
  "Bosnie": "EU",
  "Bosnie-Herzégovine": "EU",
  "Brésil": "AmS",
  "Bulgarie": "EU",
  "Burkina Faso": "AF",
  "Burundi": "AF",
  "Cameroun": "AF",
  "Canada": "AmN",
  "Cap-Vert": "AF",
  "Centrafrique": "AF",
  "Chili": "AmS",
  "Chine": "AS",
  "Chypre": "EU",
  "Colombie": "AmS",
  "Comores": "AF",
  "Congo": "AF",
  "Corée du Sud": "AS",
  "Costa Rica": "AmN",
  "Côte d'Ivoire": "AF",
  "Croatie": "EU",
  "Curaçao": "AmN",
  "Danemark": "EU",
  "Dominique": "AmN",
  "Écosse": "EU",
  "Égypte": "AF",
  "Émirats arabes unis": "AS",
  "Équateur": "AmS",
  "Espagne": "EU",
  "Estonie": "EU",
  "État de Palestine": "AS",
  "États-Unis": "AmN",
  "Finlande": "EU",
  "France": "EU",
  "Gabon": "AF",
  "Gambie": "AF",
  "Géorgie": "EU",
  "Ghana": "AF",
  "Grèce": "EU",
  "Grenade": "AmN",
  "Guinée": "AF",
  "Guinée équatoriale": "AF",
  "Guinée-Bissau": "AF",
  "Haïti": "AmN",
  "Honduras": "AmN",
  "Hongrie": "EU",
  "Îles Féroé": "EU",
  "Indonésie": "AS",
  "Irak": "AS",
  "Iran": "AS",
  "Irlande": "EU",
  "Irlande du Nord": "EU",
  "Islande": "EU",
  "Israël": "EU",
  "Italie": "EU",
  "Jamaïque": "AmN",
  "Japon": "AS",
  "Jordanie": "AS",
  "Kenya": "AF",
  "Kosovo": "EU",
  "Lettonie": "EU",
  "Liberia": "AF",
  "Libye": "AF",
  "Lituanie": "EU",
  "Luxembourg": "EU",
  "Macédoine du Nord": "EU",
  "Mali": "AF",
  "Malte": "EU",
  "Maroc": "AF",
  "Mauritanie": "AF",
  "Mexique": "AmN",
  "Monténégro": "EU",
  "Mozambique": "AF",
  "Nigeria": "AF",
  "Norvège": "EU",
  "Nouvelle-Zélande": "OC",
  "Oman": "AS",
  "Ouzbékistan": "AS",
  "Pakistan": "AS",
  "Panama": "AmN",
  "Paraguay": "AmS",
  "Pays de Galles": "EU",
  "Pays-Bas": "EU",
  "Pérou": "AmS",
  "Pologne": "EU",
  "Portugal": "EU",
  "Qatar": "AS",
  "RD Congo": "AF",
  "République dominicaine": "AmN",
  "République du Congo": "AF",
  "République tchèque": "EU",
  "Roumanie": "EU",
  "Russie": "EU",
  "Sénégal": "AF",
  "Serbie": "EU",
  "Sierra Leone": "AF",
  "Slovaquie": "EU",
  "Slovénie": "EU",
  "Soudan": "AF",
  "Suède": "EU",
  "Suisse": "EU",
  "Suriname": "AmS",
  "Syrie": "AS",
  "Taïwan": "AS",
  "Tchéquie": "EU",
  "Togo": "AF",
  "Trinité-et-Tobago": "AmN",
  "Tunisie": "AF",
  "Turquie": "EU",
  "Ukraine": "EU",
  "Uruguay": "AmS",
  "Venezuela": "AmS",
  "Zambie": "AF",
  "Zimbabwe": "AF",
};

/** Le drapeau, ou un repli lisible plutôt qu'un vide. */
export function drapeau(nationalite?: string): string {
  if (!nationalite) return "?";
  // Le repli garde les trois premières lettres et non un point d'interrogation :
  // « LIB » dit encore quelque chose, « ? » ne dit rien. Il ne devrait plus jamais
  // servir — le test l'interdit sur la base — mais il reste pour une donnée
  // arrivée du serveur après une correction à distance.
  return DRAPEAUX[nationalite] || nationalite.slice(0, 3).toUpperCase();
}

/** La zone, ou « ? » si elle est inconnue. */
export function continent(nationalite?: string): string {
  return (nationalite && CONTINENTS[nationalite]) || "?";
}
