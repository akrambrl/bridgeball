import { useCallback, useEffect, useMemo, useState } from "react";
import { PLAYERS, RETIRED_PLAYERS, GG_WC_WINNERS, GG_CL_WINNERS, GG_BALLON_DOR, GG_BALLON_DOR_MULTI } from "../../players.jsx";

type Player = {
  name: string;
  clubs: string[];
  nationalities: string[];
  positions: string[];
  diff: "facile" | "moyen" | "expert";
  birthYear?: number;
};

type QCategory = "cont" | "nat" | "league" | "club" | "pos" | "era" | "profile" | "anecdote" | "physique";

type Question = {
  id: string;
  label: string;
  labelEn?: string; // traduction affichée quand l'app est en anglais
  category: QCategory;
  // null = on ne sait pas (info absente de la base) → le joueur n'est pas
  // filtré quelle que soit la réponse de l'utilisateur.
  predicate: (p: Player) => boolean | null;
};

// Objectif "normal" affiché à l'utilisateur (la barre de progression vise ça).
const MAX_QUESTIONS = 25;
// Garde-fou : on continue de questionner AU-DELÀ de MAX_QUESTIONS tant qu'une
// question discrimine encore les candidats, afin de converger vers UN seul
// joueur — mais au maximum 5 questions bonus (25 + 5 = 30). Au-delà, on devine.
const HARD_CAP = 30;
const MAX_GUESSES = 6;

const POS_GARDIEN = "gardien";
const POS_ATT = "attaquant";
const POS_MIL = "milieu";
const isDefender = (p: Player) =>
  p.positions.some((x) => x === "défenseur" || x === "defenseur");
const hasPos = (p: Player, pos: string) => p.positions.includes(pos);

// Pour les questions "Est-ce un X ?" (poste unique), on retourne null
// (info ambiguë) quand le joueur a plusieurs positions, car CR7 par
// exemple est tagué ["attaquant","milieu"] : il EST attaquant ET milieu
// selon les saisons. Donc on ne filtre pas dans ce cas.
const isUniquelyPos = (p: Player, pos: string): boolean | null => {
  if (!hasPos(p, pos)) return false;
  if (p.positions.length === 1) return true;
  return null; // polyvalent → ambigu → on garde
};
const isUniquelyDefender = (p: Player): boolean | null => {
  if (!isDefender(p)) return false;
  if (p.positions.length === 1) return true;
  return null;
};
const hasNat = (p: Player, nat: string) => p.nationalities.includes(nat);
// Langue de l'app (réglée dans LePont via le toggle FR/EN, stockée en localStorage).
// Lue à chaque rendu : le composant est monté après un éventuel changement de langue.
const isEn = () => { try { return localStorage.getItem("bb_lang") === "en"; } catch { return false; } };
const qLabel = (q: Question) => (isEn() && q.labelEn) || q.label;

const playedFor = (p: Player, club: string) => p.clubs.includes(club);
const playedForAny = (p: Player, clubs: string[]) =>
  p.clubs.some((c) => clubs.includes(c));

// Listes étendues pour matcher TOUTES les variantes de noms de clubs
// présentes dans players.jsx (ex: "Atalanta" et "Atalanta BC", "Napoli" et
// "SSC Napoli", "Fiorentina" et "ACF Fiorentina", etc.) ainsi que tous les
// clubs ayant évolué dans la ligue depuis ~25 ans.
const PREMIER_LEAGUE = [
  "Manchester United", "Manchester City", "Liverpool", "Chelsea", "Arsenal",
  "Tottenham", "Newcastle", "Aston Villa", "West Ham", "Everton", "Leicester",
  "Leeds", "Leeds United", "Southampton", "Crystal Palace", "Wolverhampton",
  "Brighton", "Fulham", "Brentford", "Bournemouth", "Nottingham Forest",
  "Burnley", "Sheffield United", "Watford", "Norwich", "Norwich City",
  "Stoke", "Stoke City", "Hull City", "Sunderland", "Middlesbrough",
  "Cardiff", "Swansea", "Blackburn", "Bolton", "QPR", "Reading", "Wigan",
  "West Brom", "West Bromwich", "Birmingham", "Birmingham City", "Ipswich Town",
  "Luton", "Luton Town", "Coventry",
];
const LIGA = [
  "Real Madrid", "Barcelona", "Atletico Madrid",
  "Sevilla", "Valencia", "Villarreal", "Real Sociedad", "Athletic Bilbao",
  "Real Betis", "Celta Vigo", "Getafe", "Espanyol", "Mallorca", "Girona",
  "Cadiz", "Alaves", "Granada", "Osasuna", "Las Palmas", "Levante",
  "Rayo Vallecano", "Elche", "Almeria", "Leganés", "Eibar", "Real Valladolid",
  "Sporting Gijón", "Oviedo", "Real Oviedo", "Málaga", "Malaga", "Numancia",
  "Tenerife", "Deportivo La Coruña", "Cultural Leonesa",
  "Cádiz", "Alavés", "Almería", "Deportivo La Coruna",
];
const SERIE_A = [
  "Juventus FC", "AC Milan", "Milan", "Inter Milan", "Internazionale", "AS Roma",
  "Roma", "Napoli", "SSC Napoli", "Lazio", "SS Lazio", "Atalanta", "Atalanta BC",
  "Fiorentina", "ACF Fiorentina", "Torino", "Torino FC", "Sampdoria", "Udinese",
  "Udinese Calcio", "Bologna", "Bologna FC", "Hellas Verona", "Verona",
  "Chievo Verona", "Sassuolo", "Genoa", "Genoa CFC", "Como", "Como 1907",
  "Parma", "Parma FC", "Cagliari", "Cagliari Calcio", "Lecce", "Cremonese",
  "Spezia", "Salernitana", "Monza", "Brescia", "Venezia", "Frosinone",
  "Pescara", "Ascoli", "Reggina", "Benevento", "Crotone", "Cesena", "SPAL",
  "Chievo", "ChievoVerona", "Empoli", "Empoli FC", "Palermo", "Catania",
  "Siena", "Bari", "Avellino",
];
const LIGUE_1 = [
  "PSG", "Marseille", "Lyon", "Monaco", "Lille", "Rennes", "Bordeaux",
  "Saint-Étienne", "Saint-Etienne", "Nice", "Nantes", "Toulouse", "Lens",
  "Strasbourg", "RC Strasbourg", "Montpellier", "Brest", "Reims", "Angers",
  "Le Havre", "Auxerre", "Metz", "Sochaux", "Bastia", "Caen", "Troyes",
  "Dijon", "Amiens", "Guingamp", "Ajaccio", "Lorient", "Clermont", "Évian",
  "Valenciennes", "Arles-Avignon", "Paris FC", "Le Mans", "Grenoble",
  "Boulogne", "Gueugnon",
];
const BUNDESLIGA = [
  "Bayern Munich", "Borussia Dortmund", "RB Leipzig", "Bayer Leverkusen",
  "Borussia Mönchengladbach", "Schalke 04", "VfB Stuttgart", "Stuttgart",
  "Eintracht Frankfurt", "Werder Bremen", "Hamburg", "Hamburger SV",
  "Wolfsburg", "VfL Wolfsburg", "Hertha Berlin", "Hoffenheim", "Köln",
  "FC Köln", "Mainz", "FSV Mainz", "Augsburg", "Bochum", "Heidenheim",
  "Holstein Kiel", "Hannover", "Hannover 96", "Düsseldorf", "Fortuna Düsseldorf",
  "Nuremberg", "Nürnberg", "Kaiserslautern", "Freiburg", "SC Freiburg",
  "Union Berlin", "Bielefeld", "Ingolstadt", "Paderborn", "Greuther Fürth",
  "Darmstadt",
  "Schalke", "Arminia Bielefeld",
];

const EUROPE = new Set([
  "France",
  "Espagne",
  "Angleterre",
  "Allemagne",
  "Italie",
  "Portugal",
  "Pays-Bas",
  "Belgique",
  "Croatie",
  "Pologne",
  "Tchéquie",
  "Suède",
  "Norvège",
  "Danemark",
  "Suisse",
  "Autriche",
  "Écosse",
  "Pays de Galles",
  "Irlande",
  "Serbie",
  "Roumanie",
  "Russie",
  "Ukraine",
  "Turquie",
  "Grèce",
  "Hongrie",
  "Slovaquie",
  "Slovénie",
  "Finlande",
  "Bosnie-Herzégovine",
  "Bulgarie",
  "République d'Irlande",
  "Irlande du Nord",
  "Islande",
  "Albanie",
  "Monténégro",
  "Macédoine du Nord",
]);
const SOUTH_AMERICA = new Set([
  "Argentine",
  "Brésil",
  "Uruguay",
  "Colombie",
  "Chili",
  "Pérou",
  "Équateur",
  "Paraguay",
  "Venezuela",
  "Bolivie",
]);
const AFRICA = new Set([
  "Maroc",
  "Algérie",
  "Tunisie",
  "Égypte",
  "Sénégal",
  "Côte d'Ivoire",
  "Cameroun",
  "Nigeria",
  "Ghana",
  "Mali",
  "Afrique du Sud",
  "Burkina Faso",
  "RD Congo",
  "Gabon",
  "Guinée",
  "Togo",
  "Cap-Vert",
]);

// ─── Anecdotes / faits atypiques (départage de fin de partie) ───
// Listes curées de faits publics et bien documentés. Un joueur n'est taggé
// que s'il est déjà présent dans la base. Comme ces faits ne concernent que
// quelques joueurs, l'entropie ne les fait remonter qu'en fin de partie,
// quand il reste peu de candidats — exactement le bon moment pour départager.
const ANEC_BAGARRE_COEQUIPIER = new Set([
  "Adrien Rabiot", "Jonathan Rowe", // bagarre dans le vestiaire de l'OM, août 2025
]);
const ANEC_MORSURE = new Set([
  "Luis Suárez", // Bakkal 2010, Ivanović 2013, Chiellini (CdM 2014)
]);
const ANEC_RED_FINALE_CDM = new Set([
  "Zinédine Zidane", // coup de boule sur Materazzi, finale 2006
  "Marcel Desailly",  // 2e carton jaune, finale 1998
]);
const ANEC_BUT_DE_LA_MAIN = new Set([
  "Diego Maradona", // « Main de Dieu », CdM 1986
  "Thierry Henry",  // main décisive vs Irlande, barrage CdM 2009
  "Luis Suárez",    // main sur sa ligne vs Ghana, CdM 2010
]);
const ANEC_TRANSFERT_RIVAUX = new Set([
  "Luis Figo",       // Barcelone → Real Madrid, 2000
  "Sol Campbell",    // Tottenham → Arsenal, 2001
  "Carlos Tevez",    // Man United → Man City, 2009
  "Gonzalo Higuain", // Naples → Juventus, 2016
  "Ashley Cole",     // Arsenal → Chelsea, 2006
]);
const ANEC_TRANSFERT_100M = new Set([
  // A fait l'objet d'au moins un transfert > 100 M€
  "Neymar", "Kylian Mbappé", "Philippe Coutinho", "Ousmane Dembélé", "João Félix",
  "Enzo Fernández", "Jack Grealish", "Declan Rice", "Moisés Caicedo",
  "Jude Bellingham", "Paul Pogba", "Gareth Bale", "Cristiano Ronaldo",
  "Antoine Griezmann", "Romelu Lukaku", "Eden Hazard", "Florian Wirtz",
  "Alexander Isak",
]);
const ANEC_FRATRIE = new Set([
  // A (au moins) un frère footballeur.
  // Paires dont les deux frères sont présents en base :
  "Frank de Boer", "Ronald de Boer",
  "Eden Hazard", "Thorgan Hazard",
  "Jerome Boateng", "Kevin-Prince Boateng",
  "Gary Neville", "Phil Neville",
  "Sven Bender", "Lars Bender",
  "Theo Hernández", "Lucas Hernandez",
  "Marcus Thuram", "Khephren Thuram",
  "Giovanni Simeone", "Giuliano Simeone",
  "Sami Khedira", "Rani Khedira",
  "Jude Bellingham", "Jobe Bellingham",
  "Thiago Alcântara", "Rafinha",
  "Kylian Mbappé", "Ethan Mbappé",
  // Frère pro absent de la base (mais le fait reste vrai pour ce joueur) :
  "Yaya Touré", "Kolo Toure",   // + Ibrahim
  "Granit Xhaka",               // Taulant
  "Filippo Inzaghi",            // Simone
  "Romelu Lukaku",              // Jordan
  "Rio Ferdinand",              // Anton
  "Paul Pogba",                 // Florentin, Mathias
  "Rafael",                     // Fabio da Silva (son jumeau)
  "Toni Kroos",                 // Felix
  "Mario Götze",                // Felix
  "André Ayew", "Jordan Ayew",  // + Ibrahim (fils d'Abedi Pelé)
  "Shaun Wright-Phillips",      // Bradley
  "Steve Mandanda",             // Parfait, Riffi, Over
  "Bobby Charlton",             // Jack
  "Daniel Maldini",             // Christian
  "Pierre-Emerick Aubameyang",  // Willy, Catilina
  "Gonzalo Higuain",            // Federico, Nicolás
  "Diego Milito",               // Gabriel
  "Robert Kovac",               // Niko
  "Kaká",                       // Digão
  "Luca Zidane",                // Enzo, Theo, Elyaz
  "Edinson Cavani",             // Walter Guglielmone (attaquant)
  "Xabi Alonso",                // Mikel
  "Saúl Ñíguez",                // Jonathan, Aaron
  "Ronaldinho",                 // Roberto Assis
]);
const ANEC_CHANGE_SELECTION = new Set([
  // A changé de sélection nationale au cours de sa carrière
  "Diego Costa",        // Brésil → Espagne
  "Wilfried Zaha",      // Angleterre → Côte d'Ivoire
  "Aymeric Laporte",    // France (jeunes) → Espagne
  "Thiago Motta",       // Brésil (jeunes) → Italie
  "Munir El Haddadi",   // Espagne → Maroc
  "Declan Rice",        // Irlande → Angleterre
  "Jack Grealish",      // Irlande (jeunes) → Angleterre
  "Sheraldo Becker",    // Pays-Bas (jeunes) → Suriname
  "Maarten Paes",       // Pays-Bas (jeunes) → Indonésie
  "Pablo Rosario",      // Pays-Bas → République dominicaine
  "Carney Chukwuemeka", // Angleterre (jeunes) → Autriche
  "Rayane Bounida",     // Belgique (jeunes) → Maroc
]);
const ANEC_BUT_FINALE_CDM = new Set([
  // A marqué lors d'une finale de Coupe du Monde
  "Zinédine Zidane", "Kylian Mbappé", "Lionel Messi", "Paul Pogba",
  "Antoine Griezmann", "Mario Götze", "Marco Materazzi", "Pelé",
  "Gerd Müller", "Andres Iniesta", "Ronaldo Nazário",
]);
// La liste complète des lauréats du Ballon d'Or (1956→2025) est désormais
// centralisée dans players.jsx (GG_BALLON_DOR) — voir la question "anec-ballon-dor".
const ANEC_PENALTY_FINALE = new Set([
  // A raté un penalty resté célèbre lors d'une grande finale
  "Roberto Baggio",  // tir au but raté, finale CdM 1994
  "Franco Baresi",   // tir au but raté, finale CdM 1994
  "David Trezeguet", // tir au but raté, finale CdM 2006
  "John Terry",      // penalty décisif manqué, finale LdC 2008
]);
const ANEC_PRISON = new Set([
  // A déjà été incarcéré (faits de notoriété publique)
  "Souleymane Diawara", // détention provisoire, affaire d'extorsion (2017)
  "Joey Barton",        // peine de prison pour agression (2008)
  "Robinho",            // condamnation purgée au Brésil (2024)
  "Ronaldinho",         // détention au Paraguay, faux passeport (2020)
]);
const ANEC_EXTORSION_FRERE = new Set([
  // Victime d'une tentative d'extorsion orchestrée par son propre frère
  "Paul Pogba", // séquestration/extorsion par Mathias Pogba + amis (2022), condamnés en 2024
]);
const ANEC_EXTORSION = new Set([
  // Victime d'une tentative d'extorsion (au sens large)
  "Paul Pogba",   // séquestration/extorsion par son frère + amis (2022)
  "N'Golo Kanté", // menacé/extorqué (commissions d'agent) par un proche de son entourage (2017)
]);
const ANEC_PARIS = new Set([
  // Suspendu pour des infractions liées aux paris sportifs (sanctions effectives)
  "Sandro Tonali",    // 10 mois, paris illégaux (Italie, 2023)
  "Nicolò Fagioli",   // 7 mois, paris illégaux (Italie, 2023)
  "Ivan Toney",       // 8 mois, 232 manquements aux règles (FA, 2023)
  "Kieran Trippier",  // 10 semaines, info de transfert transmise à des parieurs (FA, 2020)
  "Joey Barton",      // suspension pour paris sur des matchs (FA, 2017)
]);
const ANEC_DOPAGE = new Set([
  // Suspendu dans une affaire de dopage (sanctions effectivement purgées)
  "Paul Pogba",      // testostérone, 2023 (4 ans → 18 mois en appel)
  "Adrian Mutu",     // cocaïne 2004, puis sibutramine 2010
  "Diego Maradona",  // cocaïne 1991, éphédrine (CdM 1994)
  "Rio Ferdinand",   // 8 mois, test antidopage manqué (2004)
  "Kolo Toure",      // 6 mois, substance interdite (2011)
  "Edgar Davids",    // nandrolone (2001)
  "Jaap Stam",       // nandrolone (2001)
  "Fernando Couto",  // nandrolone (2001)
  "Frank de Boer",   // nandrolone (2001)
  "Andre Onana",     // furosémide, 9 mois (2021)
  "Bernard Lama",    // cannabis (1997)
]);
const ANEC_CELEBRITE = new Set([
  // Marié ou en couple (avéré) avec une célébrité indépendamment célèbre
  "Gerard Pique",            // Shakira (chanteuse)
  "David Beckham",           // Victoria Beckham (Spice Girls)
  "Adil Rami",               // Pamela Anderson (actrice)
  "Bastian Schweinsteiger",  // Ana Ivanović (n°1 mondiale de tennis)
  "Cristiano Ronaldo",       // Irina Shayk puis Georgina Rodríguez (mannequins)
  "Carles Puyol",            // Vanesa Lorenzo (mannequin)
  "Mauro Icardi",            // Wanda Nara (animatrice TV, MasterChef Argentina)
  "Sergio Ramos",            // Pilar Rubio (animatrice TV, célèbre avant la relation)
  "Iker Casillas",           // Sara Carbonero (journaliste sportive)
  "Kylian Mbappé",           // Ester Expósito (actrice) — relation publiquement constatée
]);
const ANEC_TRANSFERT_RECORD = new Set([
  // A détenu le record du transfert le plus cher du monde, à son époque
  "Neymar",            // Barcelone → PSG, 2017 (222 M€, record actuel)
  "Paul Pogba",        // Juventus → Man United, 2016
  "Gareth Bale",       // Tottenham → Real Madrid, 2013
  "Cristiano Ronaldo", // Man United → Real Madrid, 2009
  "Kaká",              // Milan → Real Madrid, 2009 (record quelques semaines)
  "Zinédine Zidane",   // Juventus → Real Madrid, 2001
  "Luis Figo",         // Barcelone → Real Madrid, 2000
  "Hernán Crespo",     // Parma → Lazio, 2000
  "Christian Vieri",   // Lazio → Inter, 1999
  "Denílson",          // São Paulo → Real Betis, 1998
  "Ronaldo Nazário",   // PSV → Barça (1996), Barça → Inter (1997)
  "Alan Shearer",      // Blackburn → Newcastle, 1996
  "Jean-Pierre Papin", // Marseille → Milan, 1992
  "Diego Maradona",    // Boca → Barça (1982), Barça → Naples (1984)
]);
const ANEC_FILS_PRO = new Set([
  // Est le fils d'un footballeur professionnel
  "Federico Chiesa",        // Enrico Chiesa
  "Giovanni Simeone", "Giuliano Simeone", // Diego Simeone
  "Marcus Thuram", "Khephren Thuram",     // Lilian Thuram
  "Daniel Maldini",         // Paolo Maldini
  "Paolo Maldini",          // Cesare Maldini
  "Timothy Weah",           // George Weah
  "Justin Kluivert",        // Patrick Kluivert
  "Luca Zidane",            // Zinédine Zidane
  "Shaun Wright-Phillips",  // Ian Wright (père adoptif)
  "Marcos Llorente",        // Paco Llorente
  "Erling Haaland",         // Alf-Inge Håland
  "Kasper Schmeichel",      // Peter Schmeichel
  "Thiago Alcântara", "Rafinha", // Mazinho (champion du monde 1994)
  "Xabi Alonso",            // Periko Alonso
  "Frank Lampard",          // Frank Lampard Sr.
  "Sergio Busquets",        // Carles Busquets
  "Gio Reyna",              // Claudio Reyna
]);
const ANEC_ENTRAINEUR = new Set([
  // Devenu entraîneur après sa carrière de joueur
  "Zinédine Zidane", "Pep Guardiola", "Thierry Henry", "Andrea Pirlo",
  "Gennaro Gattuso", "Frank Lampard", "Steven Gerrard", "Xavi",
  "Mikel Arteta", "Filippo Inzaghi", "Didier Deschamps", "Diego Simeone",
  "Wayne Rooney", "Vincent Kompany", "Patrick Vieira", "Roberto Mancini",
  "Frank de Boer", "Ronald Koeman", "Clarence Seedorf", "Edgar Davids",
  "Gary Neville", "Laurent Blanc", "Raúl González", "Xabi Alonso",
  "Cesc Fabregas", "Nuno Espírito Santo", "Vincenzo Montella", "Hristo Stoichkov",
  "Carlo Ancelotti", "Luis Enrique", "Rudi Garcia", "Álvaro Arbeloa",
]);
const ANEC_JOUE_40 = new Set([
  // A joué (en professionnel) jusqu'à 40 ans ou plus
  "Gianluigi Buffon", "Paolo Maldini", "Francesco Totti", "Zlatan Ibrahimovic",
  "Cristiano Ronaldo", "Luka Modrić", "Pepe (Portugal)", "Edwin van der Sar",
  "Ryan Giggs", "Roger Milla", "Javier Zanetti", "Teddy Sheringham",
  "Alessandro Del Piero", "Didier Drogba", "Shunsuke Nakamura", "Rivaldo",
  "Roberto Carlos", "Andres Iniesta", "Sergio Ramos", "Thiago Silva",
  "Alessandro Costacurta", "Pepe Reina", "Gianluca Pagliuca",
]);

// ─── Apparence physique / signe distinctif visuel ───
// Faits visuels marquants : ne discriminent qu'en fin de partie (peu de joueurs
// concernés), exactement quand il faut départager les derniers candidats.
const PHYS_PROTECTION = new Set([
  "Victor Osimhen", // masque de protection
  "Petr Čech",      // casque (head guard)
  "Edgar Davids",   // lunettes de protection
]);
const PHYS_CICATRICE = new Set(["Franck Ribéry", "Carlos Tevez"]); // cicatrices au visage/cou
const PHYS_AFRO = new Set(["Carlos Valderrama", "Marouane Fellaini", "Marcelo"]);
const PHYS_MOHAWK = new Set(["Marek Hamšík"]); // crête
const PHYS_DREADS = new Set(["Ruud Gullit"]); // dreadlocks
const PHYS_CHEVEUX_LONGS = new Set([
  "David Luiz", "Carles Puyol", "Andrea Pirlo", "Luka Modrić", "René Higuita",
]);
const PHYS_QUEUE = new Set(["Roberto Baggio"]); // queue de cheval (codino)
const PHYS_BARBE = new Set(["Karim Benzema", "Mohamed Salah", "Andrea Pirlo"]);
const PHYS_TATOUE = new Set(["Sergio Ramos", "David Beckham"]);
const PHYS_COIFFURE = new Set(["Neymar", "Paul Pogba", "Antoine Griezmann"]);
const PHYS_SOURIRE = new Set(["Ronaldinho"]);
const PHYS_CHAUVE = new Set(["Arjen Robben", "Zinédine Zidane", "Jaap Stam"]);
const PHYS_PETIT = new Set(["N'Golo Kanté", "Lionel Messi"]); // ≤ 1m70
const PHYS_GRAND = new Set(["Peter Crouch", "Erling Haaland", "Virgil van Dijk"]); // > 1m90
const PHYS_COUPE_2002 = new Set(["Ronaldo Nazário"]); // coupe culte CdM 2002

const QUESTIONS: Question[] = [
  // Postes
  { id: "is-gk", category: "pos", label: "Est-ce un gardien de but ?", labelEn: "Is he a goalkeeper?", predicate: (p) => isUniquelyPos(p, POS_GARDIEN) },
  { id: "is-def", category: "pos", label: "Est-ce un défenseur ?", labelEn: "Is he a defender?", predicate: isUniquelyDefender },
  { id: "is-mid", category: "pos", label: "Est-ce un milieu de terrain ?", labelEn: "Is he a midfielder?", predicate: (p) => isUniquelyPos(p, POS_MIL) },
  { id: "is-att", category: "pos", label: "Est-ce un attaquant ?", labelEn: "Is he a forward?", predicate: (p) => isUniquelyPos(p, POS_ATT) },
  {
    id: "is-offensive", category: "pos",
    label: "Joue-t-il à un poste offensif (milieu ou attaquant) ?", labelEn: "Does he play in an attacking position (midfield or forward)?",
    predicate: (p) => hasPos(p, POS_MIL) || hasPos(p, POS_ATT),
  },
  {
    id: "is-defensive", category: "pos",
    label: "Joue-t-il à un poste défensif (gardien ou défenseur) ?", labelEn: "Does he play in a defensive position (goalkeeper or defender)?",
    predicate: (p) => hasPos(p, POS_GARDIEN) || isDefender(p),
  },
  {
    id: "is-versatile", category: "pos",
    label: "Peut-il jouer à plusieurs postes différents ?", labelEn: "Can he play in several different positions?",
    predicate: (p) => p.positions.length >= 2,
  },

  // Nationalités majeures
  { id: "nat-fr", category: "nat", label: "Est-il français ?", labelEn: "Is he French?", predicate: (p) => hasNat(p, "France") },
  { id: "nat-es", category: "nat", label: "Est-il espagnol ?", labelEn: "Is he Spanish?", predicate: (p) => hasNat(p, "Espagne") },
  { id: "nat-en", category: "nat", label: "Est-il anglais ?", labelEn: "Is he English?", predicate: (p) => hasNat(p, "Angleterre") },
  { id: "nat-de", category: "nat", label: "Est-il allemand ?", labelEn: "Is he German?", predicate: (p) => hasNat(p, "Allemagne") },
  { id: "nat-it", category: "nat", label: "Est-il italien ?", labelEn: "Is he Italian?", predicate: (p) => hasNat(p, "Italie") },
  { id: "nat-pt", category: "nat", label: "Est-il portugais ?", labelEn: "Is he Portuguese?", predicate: (p) => hasNat(p, "Portugal") },
  { id: "nat-nl", category: "nat", label: "Est-il néerlandais ?", labelEn: "Is he Dutch?", predicate: (p) => hasNat(p, "Pays-Bas") },
  { id: "nat-be", category: "nat", label: "Est-il belge ?", labelEn: "Is he Belgian?", predicate: (p) => hasNat(p, "Belgique") },
  { id: "nat-hr", category: "nat", label: "Est-il croate ?", labelEn: "Is he Croatian?", predicate: (p) => hasNat(p, "Croatie") },
  { id: "nat-ar", category: "nat", label: "Est-il argentin ?", labelEn: "Is he Argentinian?", predicate: (p) => hasNat(p, "Argentine") },
  { id: "nat-br", category: "nat", label: "Est-il brésilien ?", labelEn: "Is he Brazilian?", predicate: (p) => hasNat(p, "Brésil") },
  { id: "nat-uy", category: "nat", label: "Est-il uruguayen ?", labelEn: "Is he Uruguayan?", predicate: (p) => hasNat(p, "Uruguay") },
  { id: "nat-co", category: "nat", label: "Est-il colombien ?", labelEn: "Is he Colombian?", predicate: (p) => hasNat(p, "Colombie") },
  { id: "nat-ma", category: "nat", label: "Est-il marocain ?", labelEn: "Is he Moroccan?", predicate: (p) => hasNat(p, "Maroc") },
  { id: "nat-dz", category: "nat", label: "Est-il algérien ?", labelEn: "Is he Algerian?", predicate: (p) => hasNat(p, "Algérie") },
  { id: "nat-sn", category: "nat", label: "Est-il sénégalais ?", labelEn: "Is he Senegalese?", predicate: (p) => hasNat(p, "Sénégal") },
  { id: "nat-ci", category: "nat", label: "Est-il ivoirien ?", labelEn: "Is he Ivorian?", predicate: (p) => hasNat(p, "Côte d'Ivoire") },
  { id: "nat-cm", category: "nat", label: "Est-il camerounais ?", labelEn: "Is he Cameroonian?", predicate: (p) => hasNat(p, "Cameroun") },
  { id: "nat-ng", category: "nat", label: "Est-il nigérian ?", labelEn: "Is he Nigerian?", predicate: (p) => hasNat(p, "Nigeria") },
  { id: "nat-gh", category: "nat", label: "Est-il ghanéen ?", labelEn: "Is he Ghanaian?", predicate: (p) => hasNat(p, "Ghana") },

  // Continents
  {
    id: "cont-eu", category: "cont",
    label: "Vient-il d'un pays européen ?", labelEn: "Is he from a European country?",
    predicate: (p) => p.nationalities.some((n) => EUROPE.has(n)),
  },
  {
    id: "cont-sa", category: "cont",
    label: "Vient-il d'un pays sud-américain ?", labelEn: "Is he from a South American country?",
    predicate: (p) => p.nationalities.some((n) => SOUTH_AMERICA.has(n)),
  },
  {
    id: "cont-af", category: "cont",
    label: "Vient-il d'un pays africain ?", labelEn: "Is he from an African country?",
    predicate: (p) => p.nationalities.some((n) => AFRICA.has(n)),
  },

  // Clubs majeurs
  { id: "club-real", category: "club", label: "A-t-il joué au Real Madrid ?", labelEn: "Did he play for Real Madrid?", predicate: (p) => playedFor(p, "Real Madrid") },
  { id: "club-barca", category: "club", label: "A-t-il joué au FC Barcelone ?", labelEn: "Did he play for Barcelona?", predicate: (p) => playedFor(p, "Barcelona") },
  { id: "club-atm", category: "club", label: "A-t-il joué à l'Atlético Madrid ?", labelEn: "Did he play for Atletico Madrid?", predicate: (p) => playedFor(p, "Atletico Madrid") },
  { id: "club-sevilla", category: "club", label: "A-t-il joué au FC Séville ?", labelEn: "Did he play for Sevilla?", predicate: (p) => playedFor(p, "Sevilla") },
  { id: "club-mu", category: "club", label: "A-t-il joué à Manchester United ?", labelEn: "Did he play for Manchester United?", predicate: (p) => playedFor(p, "Manchester United") },
  { id: "club-mc", category: "club", label: "A-t-il joué à Manchester City ?", labelEn: "Did he play for Manchester City?", predicate: (p) => playedFor(p, "Manchester City") },
  { id: "club-liv", category: "club", label: "A-t-il joué à Liverpool ?", labelEn: "Did he play for Liverpool?", predicate: (p) => playedFor(p, "Liverpool") },
  { id: "club-che", category: "club", label: "A-t-il joué à Chelsea ?", labelEn: "Did he play for Chelsea?", predicate: (p) => playedFor(p, "Chelsea") },
  { id: "club-ars", category: "club", label: "A-t-il joué à Arsenal ?", labelEn: "Did he play for Arsenal?", predicate: (p) => playedFor(p, "Arsenal") },
  { id: "club-tot", category: "club", label: "A-t-il joué à Tottenham ?", labelEn: "Did he play for Tottenham?", predicate: (p) => playedFor(p, "Tottenham") },
  { id: "club-juv", category: "club", label: "A-t-il joué à la Juventus ?", labelEn: "Did he play for Juventus FC?", predicate: (p) => playedFor(p, "Juventus FC") },
  { id: "club-milan", category: "club", label: "A-t-il joué à l'AC Milan ?", labelEn: "Did he play for AC Milan?", predicate: (p) => playedFor(p, "AC Milan") },
  { id: "club-inter", category: "club", label: "A-t-il joué à l'Inter Milan ?", labelEn: "Did he play for Inter Milan?", predicate: (p) => playedFor(p, "Inter Milan") },
  { id: "club-roma", category: "club", label: "A-t-il joué à l'AS Roma ?", labelEn: "Did he play for AS Roma?", predicate: (p) => playedFor(p, "AS Roma") },
  { id: "club-napoli", category: "club", label: "A-t-il joué à Naples ?", labelEn: "Did he play for SSC Napoli?", predicate: (p) => playedFor(p, "SSC Napoli") },
  { id: "club-bayern", category: "club", label: "A-t-il joué au Bayern Munich ?", labelEn: "Did he play for Bayern Munich?", predicate: (p) => playedFor(p, "Bayern Munich") },
  { id: "club-bvb", category: "club", label: "A-t-il joué au Borussia Dortmund ?", labelEn: "Did he play for Borussia Dortmund?", predicate: (p) => playedFor(p, "Borussia Dortmund") },
  { id: "club-psg", category: "club", label: "A-t-il joué au PSG ?", labelEn: "Did he play for PSG?", predicate: (p) => playedFor(p, "PSG") },
  { id: "club-om", category: "club", label: "A-t-il joué à l'Olympique de Marseille ?", labelEn: "Did he play for Marseille?", predicate: (p) => playedFor(p, "Marseille") },
  { id: "club-ol", category: "club", label: "A-t-il joué à l'Olympique Lyonnais ?", labelEn: "Did he play for Lyon?", predicate: (p) => playedFor(p, "Lyon") },
  { id: "club-monaco", category: "club", label: "A-t-il joué à l'AS Monaco ?", labelEn: "Did he play for Monaco?", predicate: (p) => playedFor(p, "Monaco") },
  { id: "club-lille", category: "club", label: "A-t-il joué au LOSC Lille ?", labelEn: "Did he play for Lille?", predicate: (p) => playedFor(p, "Lille") },
  { id: "club-ajax", category: "club", label: "A-t-il joué à l'Ajax Amsterdam ?", labelEn: "Did he play for Ajax Amsterdam?", predicate: (p) => playedFor(p, "Ajax Amsterdam") },
  { id: "club-porto", category: "club", label: "A-t-il joué au FC Porto ?", labelEn: "Did he play for Porto?", predicate: (p) => playedFor(p, "Porto") },
  { id: "club-benfica", category: "club", label: "A-t-il joué au Benfica ?", labelEn: "Did he play for Benfica?", predicate: (p) => playedFor(p, "Benfica") },
  { id: "club-sporting", category: "club", label: "A-t-il joué au Sporting CP ?", labelEn: "Did he play for Sporting CP?", predicate: (p) => playedFor(p, "Sporting CP") },
  { id: "club-newcastle", category: "club", label: "A-t-il joué à Newcastle ?", labelEn: "Did he play for Newcastle?", predicate: (p) => playedFor(p, "Newcastle") },

  // Ligues
  { id: "lg-pl", category: "league", label: "A-t-il joué en Premier League anglaise ?", labelEn: "Has he played in the English Premier League?", predicate: (p) => playedForAny(p, PREMIER_LEAGUE) },
  { id: "lg-liga", category: "league", label: "A-t-il joué en Liga espagnole ?", labelEn: "Has he played in the Spanish La Liga?", predicate: (p) => playedForAny(p, LIGA) },
  { id: "lg-seriea", category: "league", label: "A-t-il joué en Serie A italienne ?", labelEn: "Has he played in the Italian Serie A?", predicate: (p) => playedForAny(p, SERIE_A) },
  { id: "lg-l1", category: "league", label: "A-t-il joué en Ligue 1 française ?", labelEn: "Has he played in the French Ligue 1?", predicate: (p) => playedForAny(p, LIGUE_1) },
  { id: "lg-bl", category: "league", label: "A-t-il joué en Bundesliga allemande ?", labelEn: "Has he played in the German Bundesliga?", predicate: (p) => playedForAny(p, BUNDESLIGA) },

  // Clubs additionnels (deuxième couche, ~30-100 joueurs chacun)
  { id: "club-leverkusen", category: "club", label: "A-t-il joué au Bayer Leverkusen ?", labelEn: "Did he play for Bayer Leverkusen?", predicate: (p) => playedFor(p, "Bayer Leverkusen") },
  { id: "club-leipzig", category: "club", label: "A-t-il joué au RB Leipzig ?", labelEn: "Did he play for RB Leipzig?", predicate: (p) => playedFor(p, "RB Leipzig") },
  { id: "club-schalke", category: "club", label: "A-t-il joué à Schalke 04 ?", labelEn: "Did he play for Schalke?", predicate: (p) => playedFor(p, "Schalke") },
  { id: "club-wolfsburg", category: "club", label: "A-t-il joué à Wolfsburg ?", labelEn: "Did he play for Wolfsburg?", predicate: (p) => playedFor(p, "Wolfsburg") },
  { id: "club-frankfurt", category: "club", label: "A-t-il joué à l'Eintracht Frankfurt ?", labelEn: "Did he play for Eintracht Frankfurt?", predicate: (p) => playedFor(p, "Eintracht Frankfurt") },
  { id: "club-stuttgart", category: "club", label: "A-t-il joué à Stuttgart ?", labelEn: "Did he play for Stuttgart?", predicate: (p) => playedFor(p, "Stuttgart") },
  { id: "club-lazio", category: "club", label: "A-t-il joué à la Lazio ?", labelEn: "Did he play for SS Lazio?", predicate: (p) => playedFor(p, "SS Lazio") },
  { id: "club-atalanta", category: "club", label: "A-t-il joué à l'Atalanta ?", labelEn: "Did he play for Atalanta BC?", predicate: (p) => playedFor(p, "Atalanta BC") },
  { id: "club-fiorentina", category: "club", label: "A-t-il joué à la Fiorentina ?", labelEn: "Did he play for Fiorentina?", predicate: (p) => playedForAny(p, ["Fiorentina", "ACF Fiorentina"]) },
  { id: "club-sassuolo", category: "club", label: "A-t-il joué à Sassuolo ?", labelEn: "Did he play for Sassuolo?", predicate: (p) => playedFor(p, "Sassuolo") },
  { id: "club-villarreal", category: "club", label: "A-t-il joué à Villarreal ?", labelEn: "Did he play for Villarreal?", predicate: (p) => playedFor(p, "Villarreal") },
  { id: "club-valencia", category: "club", label: "A-t-il joué à Valence ?", labelEn: "Did he play for Valencia?", predicate: (p) => playedFor(p, "Valencia") },
  { id: "club-sociedad", category: "club", label: "A-t-il joué à la Real Sociedad ?", labelEn: "Did he play for Real Sociedad?", predicate: (p) => playedFor(p, "Real Sociedad") },
  { id: "club-betis", category: "club", label: "A-t-il joué au Real Betis ?", labelEn: "Did he play for Real Betis?", predicate: (p) => playedFor(p, "Real Betis") },
  { id: "club-westham", category: "club", label: "A-t-il joué à West Ham ?", labelEn: "Did he play for West Ham?", predicate: (p) => playedFor(p, "West Ham") },
  { id: "club-everton", category: "club", label: "A-t-il joué à Everton ?", labelEn: "Did he play for Everton?", predicate: (p) => playedFor(p, "Everton") },
  { id: "club-aston", category: "club", label: "A-t-il joué à Aston Villa ?", labelEn: "Did he play for Aston Villa?", predicate: (p) => playedFor(p, "Aston Villa") },
  { id: "club-fulham", category: "club", label: "A-t-il joué à Fulham ?", labelEn: "Did he play for Fulham?", predicate: (p) => playedFor(p, "Fulham") },
  { id: "club-nice", category: "club", label: "A-t-il joué à l'OGC Nice ?", labelEn: "Did he play for Nice?", predicate: (p) => playedFor(p, "Nice") },
  { id: "club-rennes", category: "club", label: "A-t-il joué au Stade Rennais ?", labelEn: "Did he play for Rennes?", predicate: (p) => playedFor(p, "Rennes") },
  { id: "club-bordeaux", category: "club", label: "A-t-il joué aux Girondins de Bordeaux ?", labelEn: "Did he play for Bordeaux?", predicate: (p) => playedFor(p, "Bordeaux") },
  { id: "club-saintet", category: "club", label: "A-t-il joué à l'AS Saint-Étienne ?", labelEn: "Did he play for Saint-Étienne?", predicate: (p) => playedForAny(p, ["Saint-Étienne", "Saint-Etienne"]) },
  { id: "club-nantes", category: "club", label: "A-t-il joué au FC Nantes ?", labelEn: "Did he play for Nantes?", predicate: (p) => playedFor(p, "Nantes") },
  { id: "club-lens", category: "club", label: "A-t-il joué au RC Lens ?", labelEn: "Did he play for Lens?", predicate: (p) => playedFor(p, "Lens") },
  { id: "club-feyenoord", category: "club", label: "A-t-il joué à Feyenoord ?", labelEn: "Did he play for Feyenoord?", predicate: (p) => playedFor(p, "Feyenoord") },
  { id: "club-psv", category: "club", label: "A-t-il joué au PSV Eindhoven ?", labelEn: "Did he play for PSV Eindhoven?", predicate: (p) => playedFor(p, "PSV Eindhoven") },
  { id: "club-galata", category: "club", label: "A-t-il joué à Galatasaray ?", labelEn: "Did he play for Galatasaray?", predicate: (p) => playedFor(p, "Galatasaray") },
  { id: "club-fener", category: "club", label: "A-t-il joué à Fenerbahçe ?", labelEn: "Did he play for Fenerbahce?", predicate: (p) => playedFor(p, "Fenerbahce") },
  { id: "club-celtic", category: "club", label: "A-t-il joué au Celtic Glasgow ?", labelEn: "Did he play for Celtic?", predicate: (p) => playedFor(p, "Celtic") },
  { id: "club-boca", category: "club", label: "A-t-il joué à Boca Juniors ?", labelEn: "Did he play for Boca Juniors?", predicate: (p) => playedFor(p, "Boca Juniors") },
  { id: "club-river", category: "club", label: "A-t-il joué à River Plate ?", labelEn: "Did he play for River Plate?", predicate: (p) => playedFor(p, "River Plate") },

  // Nationalités additionnelles
  { id: "nat-dk", category: "nat", label: "Est-il danois ?", labelEn: "Is he Danish?", predicate: (p) => hasNat(p, "Danemark") },
  { id: "nat-se", category: "nat", label: "Est-il suédois ?", labelEn: "Is he Swedish?", predicate: (p) => hasNat(p, "Suède") },
  { id: "nat-no", category: "nat", label: "Est-il norvégien ?", labelEn: "Is he Norwegian?", predicate: (p) => hasNat(p, "Norvège") },
  { id: "nat-ch", category: "nat", label: "Est-il suisse ?", labelEn: "Is he Swiss?", predicate: (p) => hasNat(p, "Suisse") },
  { id: "nat-pl", category: "nat", label: "Est-il polonais ?", labelEn: "Is he Polish?", predicate: (p) => hasNat(p, "Pologne") },
  { id: "nat-cz", category: "nat", label: "Est-il tchèque ?", labelEn: "Is he Czech?", predicate: (p) => hasNat(p, "Tchéquie") },
  { id: "nat-rs", category: "nat", label: "Est-il serbe ?", labelEn: "Is he Serbian?", predicate: (p) => hasNat(p, "Serbie") },
  { id: "nat-tr", category: "nat", label: "Est-il turc ?", labelEn: "Is he Turkish?", predicate: (p) => hasNat(p, "Turquie") },
  { id: "nat-gr", category: "nat", label: "Est-il grec ?", labelEn: "Is he Greek?", predicate: (p) => hasNat(p, "Grèce") },
  { id: "nat-mx", category: "nat", label: "Est-il mexicain ?", labelEn: "Is he Mexican?", predicate: (p) => hasNat(p, "Mexique") },
  { id: "nat-jp", category: "nat", label: "Est-il japonais ?", labelEn: "Is he Japanese?", predicate: (p) => hasNat(p, "Japon") },
  { id: "nat-us", category: "nat", label: "Est-il américain (USA) ?", labelEn: "Is he American (USA)?", predicate: (p) => hasNat(p, "États-Unis") },
  { id: "nat-ml", category: "nat", label: "Est-il malien ?", labelEn: "Is he Malian?", predicate: (p) => hasNat(p, "Mali") },

  // Statut / profil
  {
    id: "retired", category: "profile",
    label: "Est-il retraité (n'a plus joué récemment) ?", labelEn: "Is he retired (no longer playing)?",
    predicate: (p) => RETIRED_PLAYERS.has(p.name),
  },
  {
    id: "nomad", category: "profile",
    label: "A-t-il joué dans 5 clubs différents ou plus ?", labelEn: "Has he played for 5 different clubs or more?",
    predicate: (p) => p.clubs.length >= 5,
  },
  {
    id: "very-nomad", category: "profile",
    label: "A-t-il eu une carrière de globe-trotter (7 clubs ou plus) ?", labelEn: "Has he had a globe-trotter career (7 clubs or more)?",
    predicate: (p) => p.clubs.length >= 7,
  },
  {
    id: "loyal", category: "profile",
    label: "Est-ce un joueur fidèle (1 ou 2 clubs dans toute sa carrière) ?", labelEn: "Is he a loyal player (1 or 2 clubs in his whole career)?",
    predicate: (p) => p.clubs.length <= 2,
  },

  // Palmarès — basés sur les sets GG_WC_WINNERS et GG_CL_WINNERS
  {
    id: "won-ucl", category: "profile",
    label: "A-t-il déjà gagné la Ligue des Champions avec son club ?", labelEn: "Has he ever won the Champions League with his club?",
    predicate: (p) => GG_CL_WINNERS.has(p.name),
  },
  {
    id: "won-wc", category: "profile",
    label: "A-t-il déjà gagné la Coupe du Monde avec sa sélection ?", labelEn: "Has he ever won the World Cup with his national team?",
    predicate: (p) => GG_WC_WINNERS.has(p.name),
  },

  // Année de naissance (predicate retourne null si info absente)
  {
    id: "era-90s", category: "era",
    label: "Est-il né dans les années 90 (entre 1990 et 1999) ?", labelEn: "Was he born in the 1990s (between 1990 and 1999)?",
    predicate: (p) =>
      p.birthYear === undefined
        ? null
        : p.birthYear >= 1990 && p.birthYear <= 1999,
  },
  {
    id: "era-2000s", category: "era",
    label: "Est-il né dans les années 2000 (entre 2000 et 2009) ?", labelEn: "Was he born in the 2000s (between 2000 and 2009)?",
    predicate: (p) =>
      p.birthYear === undefined
        ? null
        : p.birthYear >= 2000 && p.birthYear <= 2009,
  },
  {
    id: "era-80s", category: "era",
    label: "Est-il né dans les années 80 (entre 1980 et 1989) ?", labelEn: "Was he born in the 1980s (between 1980 and 1989)?",
    predicate: (p) =>
      p.birthYear === undefined
        ? null
        : p.birthYear >= 1980 && p.birthYear <= 1989,
  },
  {
    id: "era-old", category: "era",
    label: "Est-il né avant 1980 (légende plus ancienne) ?", labelEn: "Was he born before 1980 (an older legend)?",
    predicate: (p) =>
      p.birthYear === undefined ? null : p.birthYear < 1980,
  },
  {
    id: "era-gen-z", category: "era",
    label: "A-t-il moins de 25 ans aujourd'hui (né après 2001) ?", labelEn: "Is he under 25 today (born after 2001)?",
    predicate: (p) =>
      p.birthYear === undefined ? null : p.birthYear >= 2001,
  },

  // Anecdotes / faits atypiques (départage de fin de partie)
  {
    id: "anec-bagarre", category: "anecdote",
    label: "A-t-il créé une polémique après une bagarre avec un coéquipier ?", labelEn: "Did he spark controversy after a fight with a teammate?",
    predicate: (p) => ANEC_BAGARRE_COEQUIPIER.has(p.name),
  },
  {
    id: "anec-morsure", category: "anecdote",
    label: "A-t-il déjà mordu un adversaire sur le terrain ?", labelEn: "Has he ever bitten an opponent on the pitch?",
    predicate: (p) => ANEC_MORSURE.has(p.name),
  },
  {
    id: "anec-red-finale", category: "anecdote",
    label: "A-t-il été expulsé lors d'une finale de Coupe du Monde ?", labelEn: "Was he sent off in a World Cup final?",
    predicate: (p) => ANEC_RED_FINALE_CDM.has(p.name),
  },
  {
    id: "anec-main", category: "anecdote",
    label: "A-t-il marqué ou sauvé un but de la main de façon célèbre ?", labelEn: "Did he famously score or stop a goal with his hand?",
    predicate: (p) => ANEC_BUT_DE_LA_MAIN.has(p.name),
  },
  {
    id: "anec-transfert-rival", category: "anecdote",
    label: "A-t-il fait un transfert très controversé vers un grand rival ?", labelEn: "Did he make a highly controversial transfer to a big rival?",
    predicate: (p) => ANEC_TRANSFERT_RIVAUX.has(p.name),
  },
  {
    id: "anec-fratrie", category: "anecdote",
    label: "A-t-il un frère footballeur ?", labelEn: "Does he have a brother who is a footballer?",
    predicate: (p) => ANEC_FRATRIE.has(p.name),
  },
  {
    id: "anec-change-selection", category: "anecdote",
    label: "A-t-il changé de sélection nationale au cours de sa carrière ?", labelEn: "Did he switch national teams during his career?",
    predicate: (p) => ANEC_CHANGE_SELECTION.has(p.name),
  },
  {
    id: "anec-but-finale-cdm", category: "anecdote",
    label: "A-t-il marqué lors d'une finale de Coupe du Monde ?", labelEn: "Did he score in a World Cup final?",
    predicate: (p) => ANEC_BUT_FINALE_CDM.has(p.name),
  },
  {
    id: "anec-ballon-dor", category: "anecdote",
    label: "A-t-il remporté le Ballon d'Or ?", labelEn: "Has he won the Ballon d'Or?",
    predicate: (p) => GG_BALLON_DOR.has(p.name),
  },
  {
    id: "anec-ballon-dor-multi", category: "anecdote",
    label: "A-t-il remporté plusieurs Ballons d'Or ?", labelEn: "Has he won several Ballons d'Or?",
    predicate: (p) => GG_BALLON_DOR_MULTI.has(p.name),
  },
  {
    id: "anec-penalty-finale", category: "anecdote",
    label: "A-t-il raté un penalty resté célèbre lors d'une grande finale ?", labelEn: "Did he miss a famous penalty in a major final?",
    predicate: (p) => ANEC_PENALTY_FINALE.has(p.name),
  },
  {
    id: "anec-prison", category: "anecdote",
    label: "A-t-il déjà fait de la prison ?", labelEn: "Has he ever been to prison?",
    predicate: (p) => ANEC_PRISON.has(p.name),
  },
  {
    id: "anec-extorsion-frere", category: "anecdote",
    label: "A-t-il été victime d'une tentative d'extorsion orchestrée par son frère ?", labelEn: "Was he the victim of an extortion attempt orchestrated by his brother?",
    predicate: (p) => ANEC_EXTORSION_FRERE.has(p.name),
  },
  {
    id: "anec-extorsion", category: "anecdote",
    label: "A-t-il été victime d'une tentative d'extorsion ?", labelEn: "Was he the victim of an extortion attempt?",
    predicate: (p) => ANEC_EXTORSION.has(p.name),
  },
  {
    id: "anec-paris", category: "anecdote",
    label: "A-t-il été suspendu pour des infractions liées aux paris sportifs ?", labelEn: "Was he suspended for betting-related offences?",
    predicate: (p) => ANEC_PARIS.has(p.name),
  },
  {
    id: "anec-dopage", category: "anecdote",
    label: "A-t-il été suspendu pour une affaire de dopage ?", labelEn: "Was he suspended over a doping case?",
    predicate: (p) => ANEC_DOPAGE.has(p.name),
  },
  {
    id: "anec-celebrite", category: "anecdote",
    label: "A-t-il été marié ou en couple avec une célébrité ?", labelEn: "Has he been married to or in a relationship with a celebrity?",
    predicate: (p) => ANEC_CELEBRITE.has(p.name),
  },
  {
    id: "anec-transfert-record", category: "anecdote",
    label: "A-t-il été, à son époque, le joueur le plus cher du monde ?", labelEn: "Was he, in his time, the most expensive player in the world?",
    predicate: (p) => ANEC_TRANSFERT_RECORD.has(p.name),
  },
  {
    id: "anec-transfert-100m", category: "anecdote",
    label: "A-t-il fait l'objet d'un transfert à plus de 100 millions d'euros ?", labelEn: "Was he involved in a transfer worth more than €100 million?",
    predicate: (p) => ANEC_TRANSFERT_100M.has(p.name),
  },
  {
    id: "anec-fils-pro", category: "anecdote",
    label: "Est-il le fils d'un footballeur professionnel ?", labelEn: "Is he the son of a professional footballer?",
    predicate: (p) => ANEC_FILS_PRO.has(p.name),
  },
  {
    id: "anec-entraineur", category: "anecdote",
    label: "Est-il devenu entraîneur après sa carrière de joueur ?", labelEn: "Did he become a manager after his playing career?",
    predicate: (p) => ANEC_ENTRAINEUR.has(p.name),
  },
  {
    id: "anec-joue-40", category: "anecdote",
    label: "A-t-il joué jusqu'à 40 ans ou plus ?", labelEn: "Did he play until age 40 or beyond?",
    predicate: (p) => ANEC_JOUE_40.has(p.name),
  },
  {
    id: "anec-real-barca", category: "anecdote",
    label: "A-t-il joué à la fois au Real Madrid et au FC Barcelone ?", labelEn: "Has he played for both Real Madrid and FC Barcelona?",
    predicate: (p) => playedFor(p, "Real Madrid") && playedFor(p, "Barcelona"),
  },
  {
    id: "anec-psg-om", category: "anecdote",
    label: "A-t-il joué à la fois au PSG et à l'Olympique de Marseille ?", labelEn: "Has he played for both PSG and Olympique de Marseille?",
    predicate: (p) => playedFor(p, "PSG") && playedFor(p, "Marseille"),
  },

  // Apparence physique / signe distinctif (départage de fin de partie)
  {
    id: "phys-protection", category: "physique",
    label: "A-t-il joué avec une protection sur le visage ou la tête (masque, casque, lunettes) ?", labelEn: "Has he played with face or head protection (mask, helmet, goggles)?",
    predicate: (p) => PHYS_PROTECTION.has(p.name),
  },
  {
    id: "phys-cicatrice", category: "physique",
    label: "A-t-il une cicatrice visible sur le visage ?", labelEn: "Does he have a visible scar on his face?",
    predicate: (p) => PHYS_CICATRICE.has(p.name),
  },
  {
    id: "phys-afro", category: "physique",
    label: "Est-il reconnaissable à sa coupe afro ?", labelEn: "Is he recognizable by his afro haircut?",
    predicate: (p) => PHYS_AFRO.has(p.name),
  },
  {
    id: "phys-mohawk", category: "physique",
    label: "A-t-il porté une crête (mohawk) ?", labelEn: "Has he worn a mohawk?",
    predicate: (p) => PHYS_MOHAWK.has(p.name),
  },
  {
    id: "phys-dreads", category: "physique",
    label: "A-t-il porté de longues dreadlocks ?", labelEn: "Has he worn long dreadlocks?",
    predicate: (p) => PHYS_DREADS.has(p.name),
  },
  {
    id: "phys-cheveux-longs", category: "physique",
    label: "Est-il connu pour ses cheveux longs ?", labelEn: "Is he known for his long hair?",
    predicate: (p) => PHYS_CHEVEUX_LONGS.has(p.name),
  },
  {
    id: "phys-queue", category: "physique",
    label: "A-t-il porté une queue de cheval iconique ?", labelEn: "Has he worn an iconic ponytail?",
    predicate: (p) => PHYS_QUEUE.has(p.name),
  },
  {
    id: "phys-barbe", category: "physique",
    label: "A-t-il une barbe très reconnaissable ?", labelEn: "Does he have a very recognizable beard?",
    predicate: (p) => PHYS_BARBE.has(p.name),
  },
  {
    id: "phys-tatoue", category: "physique",
    label: "Est-il connu pour être très tatoué ?", labelEn: "Is he known for being heavily tattooed?",
    predicate: (p) => PHYS_TATOUE.has(p.name),
  },
  {
    id: "phys-coiffure", category: "physique",
    label: "Change-t-il souvent de coiffure (coupes originales) ?", labelEn: "Does he often change haircuts (original styles)?",
    predicate: (p) => PHYS_COIFFURE.has(p.name),
  },
  {
    id: "phys-sourire", category: "physique",
    label: "Est-il célèbre pour son grand sourire ?", labelEn: "Is he famous for his big smile?",
    predicate: (p) => PHYS_SOURIRE.has(p.name),
  },
  {
    id: "phys-chauve", category: "physique",
    label: "Est-il chauve ou dégarni ?", labelEn: "Is he bald or balding?",
    predicate: (p) => PHYS_CHAUVE.has(p.name),
  },
  {
    id: "phys-petit", category: "physique",
    label: "Est-il de petit gabarit (1m70 ou moins) ?", labelEn: "Is he short (1.70m or less)?",
    predicate: (p) => PHYS_PETIT.has(p.name),
  },
  {
    id: "phys-grand", category: "physique",
    label: "Mesure-t-il plus d'1m90 (très grand) ?", labelEn: "Is he taller than 1.90m (very tall)?",
    predicate: (p) => PHYS_GRAND.has(p.name),
  },
  {
    id: "phys-coupe-2002", category: "physique",
    label: "A-t-il arboré une coupe de cheveux culte à la Coupe du Monde 2002 ?", labelEn: "Did he sport a cult haircut at the 2002 World Cup?",
    predicate: (p) => PHYS_COUPE_2002.has(p.name),
  },
];

// Entropie binaire — plus c'est élevé (max=1), mieux la question discrimine.
const entropy = (yes: number, total: number) => {
  if (yes === 0 || yes === total) return 0;
  const p = yes / total;
  return -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
};

// Funnel par étapes pour le mode Akinator :
//   1. Continent → 2. Nation → 3. Ligue → 4. Club → 5. Poste → 6. Profil
//
// Mais sans enchaîner mécaniquement 5 questions de la même catégorie : on
// alterne avec une pénalité de rotation. Si on vient de poser 2 questions
// de suite dans la même catégorie, on bloque cette catégorie pour ce tour
// (on y reviendra plus tard si elle a encore des questions utiles).
const STAGE_ORDER: QCategory[] = [
  "cont",
  "nat",
  "league",
  "club",
  "pos",
  "era",
  "profile",
  "anecdote",
  "physique",
];

const pickQuestion = (
  candidates: Player[],
  askedIds: Set<string>,
  lastCategories: QCategory[]
) => {
  const last = lastCategories[lastCategories.length - 1];
  const last2 = lastCategories[lastCategories.length - 2];
  const blocked = last && last === last2 ? last : null;

  // Calcule yes/total en ignorant les "null" (= info inconnue).
  // Une question reste valide tant qu'au moins 2 candidats ont la réponse
  // connue ET que ces 2 candidats se partagent (entropy > 0). C'est ce qui
  // permet de distinguer des candidats indiscernables sur les autres axes.
  const scoreQuestion = (q: Question) => {
    let yes = 0, known = 0;
    for (const p of candidates) {
      const a = q.predicate(p);
      if (a === null) continue;
      known++;
      if (a) yes++;
    }
    if (known < 2) return 0; // 0 ou 1 candidat avec info → pas discriminant
    return entropy(yes, known);
  };

  // On évalue TOUTES les étapes en parallèle (pas de funnel rigide), avec un
  // léger bonus pour les étapes en début (cont → nat → league → club → pos → era → profile).
  // Ça permet de "sauter" à l'étape suivante quand le gain marginal d'une
  // question dans l'étape courante est faible vs une question d'une étape
  // ultérieure (ex: continuer à poser des clubs alors que "défenseur ?"
  // discriminerait mieux).
  let best: { q: Question; score: number } | null = null;
  for (let s = 0; s < STAGE_ORDER.length; s++) {
    const stage = STAGE_ORDER[s];
    if (blocked === stage) continue;
    // Bonus dégressif : étape 0 → 1.0, étape 1 → 0.92, ..., étape 6 → 0.52
    const stageBonus = 1 - s * 0.08;
    for (const q of QUESTIONS) {
      if (q.category !== stage) continue;
      if (askedIds.has(q.id)) continue;
      const ent = scoreQuestion(q);
      if (ent <= 0) continue;
      // Pénalité si la dernière question était de la même catégorie
      const rotationPenalty = q.category === last ? 0.55 : 1;
      const score = ent * stageBonus * rotationPenalty;
      if (!best || score > best.score) best = { q, score };
    }
  }
  if (best) return best.q;

  // Fallback : si on est bloqué par la rotation et rien trouvé, relâche
  if (blocked) {
    for (const q of QUESTIONS) {
      if (askedIds.has(q.id)) continue;
      const ent = scoreQuestion(q);
      if (ent <= 0) continue;
      if (!best || ent > best.score) best = { q, score: ent };
    }
    if (best) return best.q;
  }
  return null;
};

type Answer = "yes" | "no" | "dunno";

type QA = { q: Question; answer: Answer };

// Tolérance légère : un joueur peut contredire AU PLUS MAX_MISMATCH réponse et
// rester en lice. Évite qu'une seule erreur de l'utilisateur sur un fait obscur
// (ex: la saison de Mandanda à Crystal Palace, ou son année de naissance)
// n'élimine définitivement le bon joueur. Le questionnement continue sur cet
// ensemble tolérant jusqu'à isoler un seul candidat.
const MAX_MISMATCH = 1;
const DIFF_ORDER = { facile: 0, moyen: 1, expert: 2 } as const;

// Nombre de réponses contradictoires (sur les infos connues) entre un joueur
// et l'historique des questions. "dunno" et info absente (null) ne comptent pas.
const countMismatch = (p: Player, history: QA[]): number => {
  let s = 0;
  for (const { q, answer } of history) {
    if (answer === "dunno") continue;
    const a = q.predicate(p);
    if (a === null) continue;
    if (answer === "yes" ? a === false : a === true) {
      s++;
      if (s > MAX_MISMATCH) break; // inutile de compter plus loin
    }
  }
  return s;
};

type Phase = "intro" | "asking" | "guessing" | "won" | "lost";

type Props = {
  onClose: () => void;
};

const DEVIN_IMAGES = [
  "/devin-1.png?v=2",
  "/devin-2.png?v=2",
  "/devin-3.png?v=2",
  "/devin-4.png?v=2",
];

const DevinAvatar = ({
  src,
  imgClass,
  emojiClass,
}: {
  src: string;
  imgClass: string;
  emojiClass: string;
}) => {
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  if (failed[src]) {
    return <span className={emojiClass}>🧙</span>;
  }
  return (
    <img
      key={src}
      src={src}
      alt="Le devin"
      onError={() => setFailed((f) => ({ ...f, [src]: true }))}
      className={imgClass}
      draggable={false}
    />
  );
};

export const GoatGuess = ({ onClose }: Props) => {
  const [devinIdx, setDevinIdx] = useState(() =>
    Math.floor(Math.random() * DEVIN_IMAGES.length)
  );
  const advanceDevin = useCallback(() => {
    setDevinIdx((prev) => {
      if (DEVIN_IMAGES.length <= 1) return prev;
      let next = prev;
      while (next === prev) {
        next = Math.floor(Math.random() * DEVIN_IMAGES.length);
      }
      return next;
    });
  }, []);
  const devinSrc = DEVIN_IMAGES[devinIdx];
  const [gamePhase, setGamePhase] = useState<Phase>("intro");
  // Écrans à contenu dense (carte joueur) : on réduit la mascotte mobile pour
  // que tout tienne sans scroller.
  const compactMobileDevin =
    gamePhase === "guessing" || gamePhase === "won" || gamePhase === "lost";
  return (
  <div
    role="dialog"
    aria-modal="true"
    className="fixed inset-0 z-[9000] overflow-y-auto"
    style={{
      // Fond sombre profond (raccord avec l'accueil de l'app) : plus moderne
      // que la pelouse vert vif, il fait ressortir la carte et l'accent violet.
      backgroundColor: "#0B1310",
      backgroundImage:
        "radial-gradient(ellipse 120% 55% at 50% -5%, rgba(139,92,246,0.16) 0%, transparent 60%), radial-gradient(ellipse 90% 40% at 50% 105%, rgba(0,230,118,0.05) 0%, transparent 60%)",
      paddingTop: "env(safe-area-inset-top)",
      paddingBottom: "env(safe-area-inset-bottom)",
    }}
  >
    {/* Halo violet subtil en haut — signature GOAT Guess */}
    <div
      className="pointer-events-none fixed inset-x-0 top-0 h-[60vh]"
      style={{
        background:
          "radial-gradient(ellipse at 50% 0%, rgba(192,132,252,0.08) 0%, transparent 70%)",
      }}
      aria-hidden
    />

    {/* Mobile : bouton rond compact pour ne pas chevaucher le titre centré ;
        desktop : libellé complet. */}
    <button
      onClick={onClose}
      className="fixed top-3 right-3 z-[9001] flex items-center justify-center w-10 h-10 p-0 lg:w-auto lg:h-auto lg:gap-2 lg:px-4 lg:py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white backdrop-blur-md font-display text-sm tracking-widest shadow-[0_8px_24px_rgba(0,0,0,0.4)] hover:scale-[1.03] active:scale-[0.98] transition-all"
      aria-label={isEn() ? "Quit GOAT Guess" : "Quitter GOAT Guess"}
    >
      <span className="lg:hidden text-lg leading-none">←</span>
      <span className="hidden lg:inline">{isEn() ? "← QUIT" : "← QUITTER"}</span>
    </button>

    <div className="relative min-h-screen lg:min-h-screen container max-w-5xl mx-auto px-3 lg:px-6 py-2 lg:py-10">
      {/* Header branding */}
      <div className="text-center mb-2 lg:mb-8">
        <div className="inline-block px-3 py-1 rounded-full bg-black/40 border border-white/15 backdrop-blur-sm mb-2 lg:mb-3">
          <span className="font-display text-[10px] tracking-[0.4em] text-[#C084FC]">
            🔮 GOAT GUESS
          </span>
        </div>
        <h1 className="hidden lg:block font-display text-4xl lg:text-6xl tracking-wider text-white leading-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
          {isEn() ? "I'LL GUESS YOUR PLAYER" : "JE DEVINE TON JOUEUR"}
        </h1>
      </div>

      {/* Layout 2 colonnes desktop, stacked mobile — pas d'encadré global */}
      <div className="grid lg:grid-cols-[1fr_280px] gap-2 lg:gap-10 items-start">
        {/* Contenu principal du jeu — sans encadré sombre, directement sur la pelouse */}
        <div className="relative w-full">
          <GoatGuessGame
            onClose={onClose}
            onAdvanceDevin={advanceDevin}
            onPhaseChange={setGamePhase}
          />
        </div>

        {/* Mascotte mobile — sous le contenu, sans cadre, brouillard magique animé.
            Grande sur intro/questions, réduite sur les écrans à carte (devinette/
            gagné/perdu) pour tenir sans scroller. */}
        <div
          className={`lg:hidden flex flex-col items-center ${
            compactMobileDevin ? "mt-2 mb-1" : "mt-4 mb-3"
          }`}
        >
          <div
            className={`relative flex items-center justify-center ${
              compactMobileDevin
                ? "h-28 w-28 text-[68px]"
                : "h-60 w-60 text-[150px]"
            } leading-none`}
          >
            <div
              className="goat-fog-a pointer-events-none absolute inset-[-22%] rounded-full blur-3xl"
              style={{ background: "radial-gradient(circle at 50% 45%, rgba(192,132,252,0.6), transparent 65%)" }}
              aria-hidden
            />
            <div
              className="goat-fog-b pointer-events-none absolute inset-[-12%] rounded-full blur-2xl"
              style={{ background: "radial-gradient(circle at 40% 60%, rgba(255,255,255,0.22), transparent 60%)" }}
              aria-hidden
            />
            <DevinAvatar
              src={devinSrc}
              imgClass="goat-float relative h-full w-full object-contain drop-shadow-[0_12px_30px_rgba(0,0,0,0.55)]"
              emojiClass="goat-float relative drop-shadow-[0_12px_30px_rgba(0,0,0,0.55)]"
            />
          </div>
          {!compactMobileDevin && (
            <div className="mt-3 text-center">
              <div className="font-display text-[10px] tracking-[0.4em] text-[#FFC93C] mb-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">
                {isEn() ? "THE ORACLE" : "LE DEVIN"}
              </div>
              <div className="text-[11px] text-white/70 max-w-[260px] leading-snug italic text-balance">
                {isEn() ? "“Think of your player. I read your mind.”" : "«\u00A0Pense à ton joueur. Je le lis dans ton esprit.\u00A0»"}
              </div>
            </div>
          )}
        </div>

        {/* Mascotte desktop — colonne droite, sans cadre, brouillard magique animé */}
        <div className="hidden lg:flex sticky top-24 flex-col items-center pointer-events-none">
          <div className="relative flex items-center justify-center h-[440px] w-[270px] text-[250px] leading-none">
            <div
              className="goat-fog-a pointer-events-none absolute inset-[-18%] rounded-full blur-3xl"
              style={{ background: "radial-gradient(circle at 50% 45%, rgba(192,132,252,0.55), transparent 65%)" }}
              aria-hidden
            />
            <div
              className="goat-fog-b pointer-events-none absolute inset-[-8%] rounded-full blur-2xl"
              style={{ background: "radial-gradient(circle at 40% 60%, rgba(255,255,255,0.2), transparent 60%)" }}
              aria-hidden
            />
            <DevinAvatar
              src={devinSrc}
              imgClass="goat-float relative h-full w-full object-contain drop-shadow-[0_18px_40px_rgba(0,0,0,0.55)]"
              emojiClass="goat-float relative drop-shadow-[0_18px_40px_rgba(0,0,0,0.55)]"
            />
          </div>
          <div className="mt-5 text-center">
            <div className="font-display text-xs tracking-[0.4em] text-[#FFC93C] mb-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">
              {isEn() ? "THE ORACLE" : "LE DEVIN"}
            </div>
            <div className="text-[11px] text-white/70 max-w-[210px] leading-snug italic text-balance">
              {isEn() ? "“Think of your player. I read your mind.”" : "«\u00A0Pense à ton joueur. Je le lis dans ton esprit.\u00A0»"}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

const GoatGuessGame = ({
  onClose,
  onAdvanceDevin,
  onPhaseChange,
}: {
  onClose: () => void;
  onAdvanceDevin: () => void;
  onPhaseChange?: (phase: Phase) => void;
}) => {
  // Pool initial : tous les joueurs de la base (le classement des propositions
  // privilégie ensuite moins d'erreurs puis facile > moyen > expert, donc l'app
  // devine en priorité les stars en cas d'ambiguïté).
  const initialPool = useMemo<Player[]>(
    () => (PLAYERS as Player[]).filter((p) => p),
    []
  );

  const [phase, setPhase] = useState<Phase>("intro");
  const [candidates, setCandidates] = useState<Player[]>(initialPool);
  const [asked, setAsked] = useState<Set<string>>(new Set());
  const [questionCount, setQuestionCount] = useState(0);
  const [guessCount, setGuessCount] = useState(0);
  // Trace les 2 dernières catégories pour pénaliser/bloquer la répétition.
  const [lastCategories, setLastCategories] = useState<QCategory[]>([]);
  const [rejectedGuesses, setRejectedGuesses] = useState<Set<string>>(new Set());
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [currentGuess, setCurrentGuess] = useState<Player | null>(null);
  // Historique des Q+R pour le récap de fin de partie (debug / apprentissage)
  const [qaHistory, setQaHistory] = useState<
    Array<{ q: Question; answer: Answer }>
  >([]);

  // Remonte la phase au parent (pour adapter la mascotte mobile : grande sur
  // intro/questions, réduite sur les écrans devinette/gagné/perdu afin que tout
  // tienne sans scroller).
  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  const startGame = () => {
    setPhase("asking");
    setCandidates(initialPool);
    setAsked(new Set());
    setQuestionCount(0);
    setGuessCount(0);
    setRejectedGuesses(new Set());
    setLastCategories([]);
    setQaHistory([]);
    const q = pickQuestion(initialPool, new Set(), []);
    setCurrentQuestion(q);
    onAdvanceDevin();
  };

  // Ensemble « vivant » tolérant : joueurs contredisant AU PLUS MAX_MISMATCH
  // réponse et non encore rejetés. C'est sur cet ensemble qu'on continue à
  // poser des questions, afin de départager jusqu'au dernier joueur (plutôt
  // que d'enchaîner plusieurs devinettes).
  const computeLive = (history: QA[], rejected: Set<string>): Player[] =>
    initialPool.filter(
      (p) => !rejected.has(p.name) && countMismatch(p, history) <= MAX_MISMATCH
    );

  // Classement des propositions : le mieux collant d'abord (moins d'erreurs),
  // puis le plus connu (facile > moyen > expert).
  const rankGuesses = (pool: Player[], history: QA[]): Player[] =>
    [...pool].sort(
      (a, b) =>
        countMismatch(a, history) - countMismatch(b, history) ||
        DIFF_ORDER[a.diff] - DIFF_ORDER[b.diff]
    );

  // Étape suivante : tant qu'il reste > 1 candidat vivant ET qu'une question
  // discrimine encore, on repose une question. Sinon (un seul candidat, plus
  // de question utile, ou quota de questions atteint) on propose le meilleur.
  const advance = (
    live: Player[],
    history: QA[],
    askedSet: Set<string>,
    lastCats: QCategory[],
    qCount: number
  ) => {
    const ranked = rankGuesses(live, history);
    if (ranked.length === 0) {
      setPhase("lost");
      return;
    }
    if (ranked.length === 1) {
      setCurrentGuess(ranked[0]);
      setPhase("guessing");
      return;
    }
    // On continue à questionner tant qu'une question discrimine encore les
    // candidats vivants — MÊME au-delà de MAX_QUESTIONS — pour converger vers
    // UN seul joueur. On ne devine que s'il ne reste qu'un candidat (ci-dessus),
    // qu'aucune question ne les sépare plus (nextQ === null), ou au garde-fou.
    const nextQ = qCount >= HARD_CAP ? null : pickQuestion(live, askedSet, lastCats);
    if (!nextQ) {
      setCurrentGuess(ranked[0]);
      setPhase("guessing");
    } else {
      setCurrentQuestion(nextQ);
      setPhase("asking");
      onAdvanceDevin();
    }
  };

  // Backstop : si on entre en phase "asking" sans question courante (ne devrait
  // arriver qu'au tout début), on en choisit une — ou on devine s'il n'en
  // reste aucune de discriminante.
  useEffect(() => {
    if (phase !== "asking" || currentQuestion) return;
    advance(candidates, qaHistory, asked, lastCategories, questionCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentQuestion, candidates, asked, rejectedGuesses, lastCategories, questionCount]);

  const answerQuestion = (ans: Answer) => {
    if (!currentQuestion) return;
    const nextAsked = new Set(asked);
    nextAsked.add(currentQuestion.id);
    const nextHistory: QA[] = [...qaHistory, { q: currentQuestion, answer: ans }];
    const nextCount = questionCount + 1;
    const nextLastCats = [...lastCategories, currentQuestion.category].slice(-2);

    // Ensemble tolérant recalculé depuis tout l'historique (≤ 1 erreur).
    const live = computeLive(nextHistory, rejectedGuesses);

    setQaHistory(nextHistory);
    setAsked(nextAsked);
    setQuestionCount(nextCount);
    setLastCategories(nextLastCats);
    setCandidates(live);
    setCurrentQuestion(null);
    advance(live, nextHistory, nextAsked, nextLastCats, nextCount);
  };

  // Annule la dernière Q+R (ou la phase de devinette courante) et restaure
  // l'état précédent : utile si l'utilisateur s'est trompé / a répondu trop vite.
  const goBack = () => {
    // Cas 1 : on est en phase "guessing" → on revient simplement à la dernière
    // question posée sans toucher à l'historique (la Q a déjà filtré candidates).
    if (phase === "guessing" && qaHistory.length > 0) {
      const lastQa = qaHistory[qaHistory.length - 1];
      setCurrentGuess(null);
      setCurrentQuestion(lastQa.q);
      setPhase("asking");
      return;
    }
    if (qaHistory.length === 0) return;
    const newHistory = qaHistory.slice(0, -1);
    const removedQA = qaHistory[qaHistory.length - 1];

    // On recalcule l'ensemble tolérant à partir de l'historique restant.
    const newCandidates = computeLive(newHistory, rejectedGuesses);

    const newAsked = new Set(asked);
    newAsked.delete(removedQA.q.id);
    const newLastCategories = newHistory.slice(-2).map((r) => r.q.category);

    setQaHistory(newHistory);
    setCandidates(newCandidates);
    setAsked(newAsked);
    setQuestionCount(Math.max(0, questionCount - 1));
    setLastCategories(newLastCategories);
    setCurrentQuestion(removedQA.q);
    setCurrentGuess(null);
    setPhase("asking");
    onAdvanceDevin();
  };

  const onGuessCorrect = () => setPhase("won");

  const onGuessWrong = () => {
    if (!currentGuess) return;
    const nextRejected = new Set(rejectedGuesses);
    nextRejected.add(currentGuess.name);
    const nextGuessCount = guessCount + 1;
    // Recalcule l'ensemble tolérant sans le joueur rejeté.
    const live = computeLive(qaHistory, nextRejected);
    setRejectedGuesses(nextRejected);
    setGuessCount(nextGuessCount);
    setCandidates(live);

    // Quota de devinettes atteint → on abandonne
    if (nextGuessCount >= MAX_GUESSES) {
      setPhase("lost");
      return;
    }

    // On repose une question discriminante si possible ; sinon on propose le
    // meilleur candidat restant.
    setCurrentQuestion(null);
    advance(live, qaHistory, asked, lastCategories, questionCount);
  };

  return (
    <div>
      {phase === "intro" && <IntroView onStart={startGame} />}
      {phase === "asking" && currentQuestion && (
        <AskingView
          question={currentQuestion}
          count={questionCount + 1}
          max={MAX_QUESTIONS}
          remaining={candidates.length}
          onAnswer={answerQuestion}
          onBack={goBack}
          canGoBack={qaHistory.length > 0}
          qaHistory={qaHistory}
        />
      )}
      {phase === "guessing" && currentGuess && (
        <GuessingView
          guess={currentGuess}
          onCorrect={onGuessCorrect}
          onWrong={onGuessWrong}
          onBack={goBack}
          canGoBack={qaHistory.length > 0}
        />
      )}
      {phase === "won" && currentGuess && (
        <WonView
          guess={currentGuess}
          onRestart={startGame}
          onClose={onClose}
          qaHistory={qaHistory}
        />
      )}
      {phase === "lost" && (
        <LostView
          onRestart={startGame}
          onClose={onClose}
          qaHistory={qaHistory}
          shortlist={candidates.filter((p) => !rejectedGuesses.has(p.name)).slice(0, 8)}
          tried={Array.from(rejectedGuesses)}
        />
      )}
    </div>
  );
};

const IntroView = ({ onStart }: { onStart: () => void }) => (
  <div className="text-center">
    <div className="text-4xl lg:text-6xl mb-3 lg:mb-5">🔮</div>
    <p className="text-white/80 text-sm lg:text-lg mb-2 lg:mb-3">
      {isEn() ? "Think of a famous footballer (current or retired)." : "Pense à un footballeur connu (actuel ou retraité)."}
    </p>
    <p className="text-white/60 text-xs lg:text-sm mb-4 lg:mb-8">
      {isEn() ? (
        <>I'll ask <span className="text-white font-bold">as many questions as needed</span>{" "}
        to guess them (usually around twenty). Answer <span className="text-[#00E676] font-bold">yes</span>,{" "}
        <span className="text-[#FF3D6E] font-bold">no</span> or{" "}
        <span className="text-white/70 font-bold">not sure</span>.</>
      ) : (
        <>Je te pose <span className="text-white font-bold">autant de questions qu'il faut</span>{" "}
        pour le deviner (en général une vingtaine). Réponds <span className="text-[#00E676] font-bold">oui</span>,{" "}
        <span className="text-[#FF3D6E] font-bold">non</span> ou{" "}
        <span className="text-white/70 font-bold">je sais pas</span>.</>
      )}
    </p>

    <button
      onClick={onStart}
      className="goat-pulse inline-flex items-center gap-3 px-8 lg:px-10 py-3 lg:py-4 rounded-2xl bg-gradient-to-r from-[#A855F7] to-[#6D28D9] text-white font-display text-xl lg:text-2xl tracking-widest shadow-[0_12px_32px_-6px_rgba(168,85,247,0.55)] hover:scale-[1.03] active:scale-[0.98] transition-transform"
    >
      <span className="text-xl">{"▶︎"}</span> {isEn() ? "START" : "COMMENCER"}
    </button>

    <p className="mt-4 text-xs text-white/40">
      {isEn() ? 'Tip: the more precisely you answer (avoid "not sure"), the better I guess.' : 'Astuce : plus tu réponds précisément (évite les "sais pas"), mieux je devine.'}
    </p>
  </div>
);

const AskingView = ({
  question,
  count,
  max,
  remaining,
  onAnswer,
  onBack,
  canGoBack,
  qaHistory,
}: {
  question: Question;
  count: number;
  max: number;
  remaining: number;
  onAnswer: (a: Answer) => void;
  onBack: () => void;
  canGoBack: boolean;
  qaHistory: Array<{ q: Question; answer: Answer }>;
}) => {
  const overtime = count > max;
  const progress = Math.min(100, (count / max) * 100);
  return (
    <div>
      {/* Compteur + barre de progression */}
      <div className="mb-3 lg:mb-6">
        <div className="flex items-center justify-between text-[10px] lg:text-xs mb-1 lg:mb-2">
          <span className="font-display tracking-widest text-white/50">
            {overtime ? `QUESTION ${count} · ${isEn() ? "EXTRA TIME" : "PROLONGATIONS"} 🔥` : `QUESTION ${count} / ${max}`}
          </span>
          <span className="text-white/40 tabular-nums">
            {isEn()
              ? `${remaining} candidate${remaining > 1 ? "s" : ""} left`
              : `${remaining} candidat${remaining > 1 ? "s" : ""} restant${remaining > 1 ? "s" : ""}`}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#C084FC] to-[#FF8A2A] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question — bannière dégradé orange→or façon THE PLUG/MERCATO */}
      <div
        key={question.id}
        className="goat-pop relative overflow-hidden min-h-[88px] lg:min-h-[200px] flex flex-col items-center justify-center text-center mb-3 lg:mb-6 px-4 lg:px-8 py-5 lg:py-8 rounded-[22px] lg:rounded-[30px] shadow-[0_16px_44px_-8px_rgba(139,92,246,0.55)]"
        style={{ background: "linear-gradient(135deg,#8B5CF6 0%,#7C3AED 45%,#4C1D95 100%)" }}
      >
        {/* reflet animé qui balaie la bannière */}
        <div
          className="goat-shine pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-18deg] bg-white/25 blur-md"
          aria-hidden
        />
        {/* moitié diagonale plus claire (forme signature) */}
        <div
          className="pointer-events-none absolute top-0 right-0 bottom-0 w-[55%]"
          style={{ background: "rgba(255,255,255,0.10)", clipPath: "polygon(34% 0%, 100% 0%, 100% 100%, 0% 100%)" }}
          aria-hidden
        />
        <div className="relative font-display text-[10px] lg:text-xs tracking-[0.45em] text-white/70 mb-1.5 lg:mb-3 flex items-center gap-1.5">
          <span>🔮</span> QUESTION {count}
        </div>
        <h3 className="relative font-display text-xl lg:text-4xl tracking-wide text-white leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.35)]">
          {qLabel(question)}
        </h3>
      </div>

      {/* Boutons réponse — plus hauts pour meilleur tap-target */}
      <div className="grid grid-cols-3 gap-2 lg:gap-3 mb-2 lg:mb-3">
        <button
          onClick={() => onAnswer("yes")}
          className="py-3 lg:py-6 rounded-2xl bg-[#00E676] hover:bg-[#00C966] text-[#0A1410] font-display text-base lg:text-2xl tracking-widest hover:scale-[1.03] active:scale-[0.97] transition-transform shadow-[0_8px_24px_rgba(0,230,118,0.35)]"
        >
          ✓ {isEn() ? "YES" : "OUI"}
        </button>
        <button
          onClick={() => onAnswer("dunno")}
          className="py-3 lg:py-6 rounded-2xl border-2 border-white/10 bg-white/[0.05] hover:bg-white/[0.10] text-white/80 font-display text-xs lg:text-lg tracking-widest transition-colors"
        >
          ? {isEn() ? "NOT SURE" : "SAIS PAS"}
        </button>
        <button
          onClick={() => onAnswer("no")}
          className="py-3 lg:py-6 rounded-2xl bg-[#FF3D6E] hover:bg-[#E62E5E] text-white font-display text-base lg:text-2xl tracking-widest hover:scale-[1.03] active:scale-[0.97] transition-transform shadow-[0_8px_24px_rgba(255,61,110,0.35)]"
        >
          ✗ {isEn() ? "NO" : "NON"}
        </button>
      </div>

      <div className="flex items-center justify-between mt-1 lg:mt-2 px-1 mb-2 lg:mb-4">
        {canGoBack ? (
          <button
            onClick={onBack}
            className="text-[10px] lg:text-xs text-white/60 hover:text-white tracking-widest transition-colors"
          >
            {isEn() ? "← back" : "← précédent"}
          </button>
        ) : (
          <span />
        )}
        <button
          onClick={() => onAnswer("dunno")}
          className="text-[10px] lg:text-xs text-white/40 hover:text-white/70 tracking-widest transition-colors"
        >
          {isEn() ? "skip this question →" : "passer cette question →"}
        </button>
      </div>

      {/* Récap des déductions en cours — caché sur mobile pour tenir sur 1 écran */}
      <div className="hidden lg:block">
        <LiveDeductions history={qaHistory} />
      </div>
    </div>
  );
};

const LiveDeductions = ({
  history,
}: {
  history: Array<{ q: Question; answer: Answer }>;
}) => {
  if (history.length === 0) {
    return (
      <div className="mt-6 rounded-2xl bg-black/20 border border-white/5 px-5 py-6 text-center backdrop-blur-sm">
        <div className="text-3xl mb-2 opacity-70">🔮</div>
        <p className="text-[12px] text-white/50 italic max-w-xs mx-auto leading-relaxed">
          {isEn() ? "The oracle awaits your first answers to zero in on your player…" : "Le devin attend tes premières réponses pour cerner ton joueur…"}
        </p>
      </div>
    );
  }
  const ansIcon = (a: Answer) =>
    a === "yes" ? "✓" : a === "no" ? "✗" : "?";
  const ansColor = (a: Answer) =>
    a === "yes" ? "#00E676" : a === "no" ? "#FF3D6E" : "rgba(255,255,255,0.45)";
  // On affiche en priorité les 6 dernières (les plus récentes en haut)
  const recent = [...history].reverse().slice(0, 6);
  return (
    <div className="mt-6 rounded-2xl bg-black/30 border border-white/10 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/[0.03]">
        <span className="font-display text-[10px] tracking-[0.3em] text-[#C084FC]">
          🧠 {isEn() ? "WHAT I'M DEDUCING" : "CE QUE JE DÉDUIS"}
        </span>
        <span className="text-[10px] text-white/40 tabular-nums">
          {history.length} {isEn() ? "clue" : "indice"}{history.length > 1 ? "s" : ""}
        </span>
      </div>
      <ol className="divide-y divide-white/[0.04]">
        {recent.map((r, i) => (
          <li
            key={history.length - 1 - i}
            className="flex items-start gap-3 px-4 py-2.5"
          >
            <span
              className="font-display text-base shrink-0 leading-none mt-0.5"
              style={{ color: ansColor(r.answer) }}
            >
              {ansIcon(r.answer)}
            </span>
            <span className="flex-1 text-[12.5px] text-white/80 leading-snug">
              {qLabel(r.q)}
            </span>
          </li>
        ))}
      </ol>
      {history.length > 6 && (
        <div className="px-4 py-2 text-center text-[10px] text-white/30 border-t border-white/5">
          + {history.length - 6} {isEn() ? "more above" : (history.length - 6 > 1 ? "autres plus haut" : "autre plus haut")}
        </div>
      )}
    </div>
  );
};

const GuessingView = ({
  guess,
  onCorrect,
  onWrong,
  onBack,
  canGoBack,
}: {
  guess: Player;
  onCorrect: () => void;
  onWrong: () => void;
  onBack: () => void;
  canGoBack: boolean;
}) => (
  <div className="text-center">
    <div className="inline-block px-3 py-1 rounded-full bg-[#C084FC]/15 border border-[#C084FC]/30 mb-2 lg:mb-3">
      <span className="font-display text-[10px] tracking-[0.35em] text-[#C084FC]">
        🔮 {isEn() ? "MY GUESS" : "MA DEVINETTE"}
      </span>
    </div>
    <div className="font-display text-xl lg:text-3xl tracking-wider text-white mb-2 lg:mb-5 leading-tight">
      {isEn() ? "I BET IT'S..." : "JE PARIE QUE C'EST..."}
    </div>

    <PlayerRevealCard player={guess} accent="#C084FC" />

    <p className="text-white/60 text-sm mt-3 mb-3 lg:mt-5 lg:mb-4 tracking-wide">
      {isEn() ? "So, am I right?" : "Alors, j'ai bon ?"}
    </p>

    <div className="grid grid-cols-2 gap-3">
      <button
        onClick={onCorrect}
        className="py-3 lg:py-4 rounded-2xl bg-gradient-to-r from-[#00C966] to-[#00E676] text-[#0A1410] font-display text-lg lg:text-xl tracking-widest hover:scale-[1.03] active:scale-[0.97] transition-transform shadow-[0_8px_24px_rgba(0,230,118,0.35)]"
      >
        ✓ {isEn() ? "YES!" : "OUI !"}
      </button>
      <button
        onClick={onWrong}
        className="py-3 lg:py-4 rounded-2xl bg-gradient-to-r from-[#FF3D6E] to-[#E62E5E] text-white font-display text-lg lg:text-xl tracking-widest hover:scale-[1.03] active:scale-[0.97] transition-transform shadow-[0_8px_24px_rgba(255,61,110,0.35)]"
      >
        ✗ {isEn() ? "NO" : "NON"}
      </button>
    </div>

    {canGoBack && (
      <button
        onClick={onBack}
        className="mt-3 text-xs text-white/50 hover:text-white tracking-widest transition-colors"
      >
        {isEn() ? "← back to the previous question" : "← revenir à la question précédente"}
      </button>
    )}
  </div>
);

const WonView = ({
  guess,
  onRestart,
  onClose,
  qaHistory,
}: {
  guess: Player;
  onRestart: () => void;
  onClose: () => void;
  qaHistory: Array<{ q: Question; answer: Answer }>;
}) => (
  <div className="text-center relative">
    {/* Confettis CSS */}
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {Array.from({ length: 16 }).map((_, i) => (
        <span
          key={i}
          className="absolute block w-1.5 h-1.5 rounded-sm opacity-80"
          style={{
            left: `${(i * 6.5 + 5) % 100}%`,
            top: `-10px`,
            background: ["#C084FC", "#FFC93C", "#00E676", "#FF8A2A"][i % 4],
            animation: `goat-confetti ${2 + (i % 4) * 0.4}s linear ${(i % 5) * 0.15}s forwards`,
          }}
        />
      ))}
    </div>

    <div className="text-4xl mb-2 animate-in zoom-in duration-300">🔮</div>
    <div className="font-display text-5xl lg:text-6xl tracking-wider mb-1 leading-none text-white drop-shadow-[0_6px_24px_rgba(168,85,247,0.55)]">
      {isEn() ? "GOT YOU!" : "JE T'AI EU !"}
    </div>
    <p className="text-white/60 text-sm mb-5 tracking-wide">
      {isEn() ? "You were thinking of..." : "Tu pensais bien à..."}
    </p>

    <PlayerRevealCard player={guess} accent="#C084FC" />

    <QaRecap history={qaHistory} accent="#C084FC" />

    <div className="grid grid-cols-2 gap-3 mt-6">
      <button
        onClick={onRestart}
        className="py-4 rounded-2xl bg-gradient-to-r from-[#A855F7] to-[#6D28D9] text-white font-display text-lg tracking-widest hover:scale-[1.02] active:scale-[0.97] transition-transform shadow-[0_10px_28px_-6px_rgba(168,85,247,0.55)]"
      >
        {"▶︎"} {isEn() ? "PLAY AGAIN" : "REJOUER"}
      </button>
      <button
        onClick={onClose}
        className="py-4 rounded-2xl border-2 border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-white/80 font-display text-base tracking-widest transition-colors"
      >
        ← MODES
      </button>
    </div>
  </div>
);

// Récap des questions posées + réponses utilisateur. Utile pour comprendre
// où l'on s'est trompé (notamment sur l'écran défaite). Repliable.
const QaRecap = ({
  history,
  accent,
}: {
  history: Array<{ q: Question; answer: Answer }>;
  accent: string;
}) => {
  const [open, setOpen] = useState(false);
  if (history.length === 0) return null;
  const ansLabel = (a: Answer) =>
    isEn()
      ? (a === "yes" ? "✓ Yes" : a === "no" ? "✗ No" : "? Not sure")
      : (a === "yes" ? "✓ Oui" : a === "no" ? "✗ Non" : "? Sais pas");
  const ansColor = (a: Answer) =>
    a === "yes" ? "#00E676" : a === "no" ? "#FF3D6E" : "rgba(255,255,255,0.5)";
  return (
    <div className="mt-5 text-left">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white/80 transition-colors"
      >
        <span className="font-display text-xs tracking-[0.25em]">
          📋 {isEn() ? `RECAP OF THE ${history.length} QUESTION${history.length > 1 ? "S" : ""}` : `RÉCAP DES ${history.length} QUESTION${history.length > 1 ? "S" : ""}`}
        </span>
        <span className="text-white/40 text-sm">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <ol className="mt-2 space-y-1 max-h-[40vh] overflow-y-auto rounded-xl bg-black/30 p-2 border border-white/5">
          {history.map((r, i) => (
            <li
              key={i}
              className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.03]"
            >
              <span className="text-[10px] text-white/30 tabular-nums shrink-0 mt-0.5">
                {(i + 1).toString().padStart(2, "0")}
              </span>
              <span className="flex-1 text-[13px] text-white/80 leading-snug">
                {qLabel(r.q)}
              </span>
              <span
                className="text-[11px] font-display tracking-widest shrink-0"
                style={{ color: ansColor(r.answer) }}
              >
                {ansLabel(r.answer)}
              </span>
            </li>
          ))}
        </ol>
      )}
      {open && (
        <p className="text-[10px] text-white/30 mt-2 text-center" style={{ color: `${accent}80` }}>
          💡 {isEn() ? "If you were thinking of another player, look for where your answer eliminated the right one" : "Si tu pensais à un autre joueur, regarde où ta réponse a éliminé le bon"}
        </p>
      )}
    </div>
  );
};

const LostView = ({
  onRestart,
  onClose,
  shortlist,
  tried,
  qaHistory,
}: {
  onRestart: () => void;
  onClose: () => void;
  shortlist: Player[];
  tried: string[];
  qaHistory: Array<{ q: Question; answer: Answer }>;
}) => (
  <div className="text-center">
    <div className="text-4xl mb-2">🫡</div>
    <div className="font-display text-5xl lg:text-6xl tracking-wider mb-1 leading-none text-white drop-shadow-[0_6px_24px_rgba(168,85,247,0.55)]">
      {isEn() ? "WELL PLAYED" : "BIEN JOUÉ"}
    </div>
    <p className="text-white/60 text-sm mb-5 tracking-wide">
      {isEn() ? "You got me — I couldn't find your player." : "Tu m'as eu — je n'ai pas trouvé ton joueur."}
    </p>

    {tried.length > 0 && (
      <div className="mb-4 inline-block px-4 py-2 rounded-xl bg-[#FF3D6E]/10 border border-[#FF3D6E]/30">
        <div className="text-[10px] tracking-[0.3em] text-[#FF3D6E] mb-1">
          {isEn() ? "MY FAILED GUESSES" : "MES DEVINETTES RATÉES"}
        </div>
        <div className="text-xs text-white/70">
          {tried.slice(0, 3).join(" · ")}
          {tried.length > 3 ? " · …" : ""}
        </div>
      </div>
    )}

    {shortlist.length > 0 && (
      <div className="mb-5 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent p-4">
        <div className="font-display text-[10px] tracking-[0.3em] text-[#C084FC] mb-3">
          🤔 {isEn() ? "MAYBE ONE OF THESE PLAYERS?" : "PEUT-ÊTRE UN DE CES JOUEURS ?"}
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          {shortlist.map((p) => (
            <span
              key={p.name}
              className="px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-white/85 text-sm hover:bg-[#C084FC]/15 hover:border-[#C084FC]/40 transition-colors"
            >
              {p.name}
            </span>
          ))}
        </div>
      </div>
    )}

    <p className="text-[11px] text-white/35 mb-5 max-w-sm mx-auto leading-relaxed">
      {isEn() ? "If your player doesn't appear anywhere, they may not be in my database." : "Si ton joueur n'apparaît nulle part, il n'est peut-être pas dans ma base."}
    </p>

    <QaRecap history={qaHistory} accent="#C084FC" />

    <div className="grid grid-cols-2 gap-3 mt-6">
      <button
        onClick={onRestart}
        className="py-4 rounded-2xl bg-gradient-to-r from-[#A855F7] to-[#6D28D9] text-white font-display text-lg tracking-widest hover:scale-[1.02] active:scale-[0.97] transition-transform shadow-[0_10px_28px_-6px_rgba(168,85,247,0.55)]"
      >
        {"▶︎"} {isEn() ? "REMATCH" : "REVANCHE"}
      </button>
      <button
        onClick={onClose}
        className="py-4 rounded-2xl border-2 border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-white/80 font-display text-base tracking-widest transition-colors"
      >
        ← MODES
      </button>
    </div>
  </div>
);

// ── Carte joueur façon FUT ──────────────────────────────────────────
// Drapeaux par nationalité (libellés français de players.jsx)
const FLAGS: Record<string, string> = {
  "Afrique du Sud":"🇿🇦","Albanie":"🇦🇱","Algérie":"🇩🇿","Allemagne":"🇩🇪","Angleterre":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","Angola":"🇦🇴",
  "Arabie saoudite":"🇸🇦","Argentine":"🇦🇷","Arménie":"🇦🇲","Australie":"🇦🇺","Autriche":"🇦🇹","Barbade":"🇧🇧",
  "Belgique":"🇧🇪","Biélorussie":"🇧🇾","Bolivie":"🇧🇴","Bosnie":"🇧🇦","Bosnie-Herzégovine":"🇧🇦","Brésil":"🇧🇷",
  "Bulgarie":"🇧🇬","Burkina Faso":"🇧🇫","Burundi":"🇧🇮","Bénin":"🇧🇯","Cameroun":"🇨🇲","Canada":"🇨🇦",
  "Cap-Vert":"🇨🇻","Centrafrique":"🇨🇫","Chili":"🇨🇱","Chine":"🇨🇳","Chypre":"🇨🇾","Colombie":"🇨🇴",
  "Comores":"🇰🇲","Corée du Sud":"🇰🇷","Costa Rica":"🇨🇷","Croatie":"🇭🇷","Curaçao":"🇨🇼","Côte d'Ivoire":"🇨🇮",
  "Danemark":"🇩🇰","Dominique":"🇩🇲","Espagne":"🇪🇸","Estonie":"🇪🇪","Finlande":"🇫🇮","France":"🇫🇷",
  "Gabon":"🇬🇦","Gambie":"🇬🇲","Ghana":"🇬🇭","Grenade":"🇬🇩","Grèce":"🇬🇷","Guinée équatoriale":"🇬🇶",
  "Guinée":"🇬🇳","Guinée-Bissau":"🇬🇼","Géorgie":"🇬🇪","Haïti":"🇭🇹","Honduras":"🇭🇳","Hongrie":"🇭🇺",
  "Indonésie":"🇮🇩","Iran":"🇮🇷","Irlande du Nord":"🇬🇧","Irlande":"🇮🇪","Islande":"🇮🇸","Israël":"🇮🇱",
  "Italie":"🇮🇹","Jamaïque":"🇯🇲","Japon":"🇯🇵","Jordanie":"🇯🇴","Kenya":"🇰🇪","Kosovo":"🇽🇰",
  "Lettonie":"🇱🇻","Liberia":"🇱🇷","Libye":"🇱🇾","Lituanie":"🇱🇹","Luxembourg":"🇱🇺","Macédoine du Nord":"🇲🇰",
  "Mali":"🇲🇱","Malte":"🇲🇹","Maroc":"🇲🇦","Mauritanie":"🇲🇷","Mexique":"🇲🇽","Monténégro":"🇲🇪",
  "Mozambique":"🇲🇿","Nigeria":"🇳🇬","Norvège":"🇳🇴","Nouvelle-Zélande":"🇳🇿","Oman":"🇴🇲","Ouzbékistan":"🇺🇿",
  "Pakistan":"🇵🇰","Panama":"🇵🇦","Paraguay":"🇵🇾","Pays de Galles":"🏴󠁧󠁢󠁷󠁬󠁳󠁿","Pays-Bas":"🇳🇱","Pologne":"🇵🇱",
  "Portugal":"🇵🇹","Pérou":"🇵🇪","Qatar":"🇶🇦","RD Congo":"🇨🇩","Roumanie":"🇷🇴","Russie":"🇷🇺",
  "République Dominicaine":"🇩🇴","République dominicaine":"🇩🇴","République du Congo":"🇨🇬","Serbie":"🇷🇸",
  "Sierra Leone":"🇸🇱","Slovaquie":"🇸🇰","Slovénie":"🇸🇮","Soudan":"🇸🇩","Suisse":"🇨🇭","Suriname":"🇸🇷",
  "Suède":"🇸🇪","Syrie":"🇸🇾","Sénégal":"🇸🇳","Taïwan":"🇹🇼","Tchéquie":"🇨🇿","Togo":"🇹🇬",
  "Trinité-et-Tobago":"🇹🇹","Tunisie":"🇹🇳","Turquie":"🇹🇷","Ukraine":"🇺🇦","Uruguay":"🇺🇾","Venezuela":"🇻🇪",
  "Zambie":"🇿🇲","Zimbabwe":"🇿🇼","Écosse":"🏴󠁧󠁢󠁳󠁣󠁴󠁿","Égypte":"🇪🇬","Équateur":"🇪🇨","État de Palestine":"🇵🇸",
  "États-Unis":"🇺🇸","Îles Féroé":"🇫🇴",
};
const flagOf = (nat?: string) => (nat && FLAGS[nat]) || "🏳️";
const POS_ABBR: Record<string, string> = { gardien: "GB", defenseur: "DEF", milieu: "MIL", attaquant: "BU" };
// Note façon FUT : dérivée de la notoriété (diff) + variation stable par nom.
// Purement cosmétique — pas une vraie note.
const futRating = (p: Player) => {
  let h = 0;
  for (let i = 0; i < p.name.length; i++) h = (h * 31 + p.name.charCodeAt(i)) >>> 0;
  const base = p.diff === "facile" ? 89 : p.diff === "moyen" ? 83 : 77;
  return base + (h % 5);
};
const initialsOf = (name: string) =>
  name.split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

// Forme bouclier FUT (bord dégradé simulé par double clip-path)
const CARD_SHAPE =
  "polygon(50% 0%, 78% 3%, 94% 10%, 94% 80%, 74% 93%, 50% 100%, 26% 93%, 6% 80%, 6% 10%, 22% 3%)";

const PlayerRevealCard = ({
  player,
  accent = "#C084FC",
}: {
  player: Player;
  accent?: string;
}) => {
  const rating = futRating(player);
  const pos = POS_ABBR[player.positions[0]] || "?";
  const flag = flagOf(player.nationalities[0]);
  const gold = "#F5D67B";
  return (
    <div className="goat-card-in relative inline-block w-full max-w-[330px] my-1 lg:my-2">
      {/* Halo pulsé derrière la carte */}
      <div
        className="goat-halo absolute inset-0 blur-3xl"
        style={{ background: `radial-gradient(circle at 50% 38%, ${accent}55, transparent 70%)` }}
        aria-hidden
      />
      {/* Bord dégradé or→violet, forme bouclier */}
      <div
        className="relative mx-auto"
        style={{
          clipPath: CARD_SHAPE,
          padding: 3,
          background: `linear-gradient(160deg, ${gold} 0%, #B48A3C 35%, ${accent} 75%, #6D28D9 100%)`,
        }}
      >
        <div
          className="relative px-4 pt-7 pb-12"
          style={{
            clipPath: CARD_SHAPE,
            background: "linear-gradient(180deg, #251B3B 0%, #161026 55%, #0D0918 100%)",
          }}
        >
          {/* Lueur douce derrière le médaillon */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(circle at 50% 22%, rgba(192,132,252,0.16), transparent 55%)" }}
            aria-hidden
          />
          {/* Bloc haut : note / poste / drapeau + médaillon initiales */}
          <div className="relative flex items-start">
            <div className="flex flex-col items-center leading-none pl-3" style={{ color: gold }}>
              <div className="font-display text-4xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">{rating}</div>
              <div className="font-display text-xs tracking-[0.25em] mt-1">{pos}</div>
              <div className="text-2xl mt-1.5 leading-none">{flag}</div>
            </div>
            <div className="flex-1 flex items-center justify-center pr-6">
              <div
                className="w-28 h-28 rounded-full flex items-center justify-center font-display text-4xl text-white/90"
                style={{
                  background: "radial-gradient(circle at 35% 30%, #3D2B62, #1A1330 72%)",
                  border: `2px solid ${gold}55`,
                  boxShadow: "inset 0 6px 20px rgba(0,0,0,0.55), 0 8px 24px rgba(0,0,0,0.4)",
                }}
              >
                {initialsOf(player.name)}
              </div>
            </div>
          </div>
          {/* Nom entre filets dorés */}
          <div className="relative mt-4 text-center">
            <div className="mx-auto h-px w-4/5" style={{ background: `linear-gradient(90deg, transparent, ${gold}99, transparent)` }} />
            <div className="font-display text-2xl lg:text-3xl tracking-wider text-white leading-tight py-1.5 px-6 break-words drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
              {player.name}
            </div>
            <div className="mx-auto h-px w-4/5" style={{ background: `linear-gradient(90deg, transparent, ${gold}99, transparent)` }} />
          </div>
          {/* Nation + carrière */}
          <div className="relative mt-2.5 text-center">
            <div className="text-[10px] tracking-[0.3em] text-white/50 mb-2">
              {flag} {(player.nationalities[0] || "—").toUpperCase()}
            </div>
            <div className="flex flex-wrap gap-1 justify-center px-8">
              {player.clubs.slice(0, 4).map((c) => (
                <span key={c} className="px-2 py-0.5 rounded-md text-[10px] bg-white/[0.06] border border-white/10 text-white/80">
                  {c}
                </span>
              ))}
              {player.clubs.length > 4 && (
                <span className="px-1.5 py-0.5 text-[10px] text-white/40">+{player.clubs.length - 4}</span>
              )}
            </div>
          </div>
          {/* Badge GOAT */}
          <div
            className="absolute top-4 right-8 px-2 py-0.5 rounded-md font-display text-[9px] tracking-[0.3em]"
            style={{ background: "rgba(0,0,0,0.55)", color: gold, border: `1px solid ${gold}44` }}
          >
            🐐 GOAT
          </div>
        </div>
      </div>
    </div>
  );
};


export default GoatGuess;
