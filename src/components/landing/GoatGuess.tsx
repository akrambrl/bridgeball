import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { PLAYERS, RETIRED_PLAYERS, GG_WC_WINNERS, GG_CL_WINNERS, GG_BALLON_DOR, GG_BALLON_DOR_MULTI, GG_SHIRT_10 } from "../../players.jsx";
import { CLUB_COLORS } from "../LePont.jsx";
import { trackPlay } from "../../lib/track";
import { getLang, tr } from "@/lib/lang";
import { G, posterText, btn, fondCharte, terrainCharte } from "@/lib/charte.jsx";

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
  labelDe?: string; // allemand
  labelIt?: string; // italien
  labelPt?: string; // portugais
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
// Les questions n'existent qu'en FR (label) et EN (labelEn). Pour DE/IT/PT on
// retombe sur l'anglais (mieux que le français). Le FR reste en français.
const qLabel = (q: Question) => {
  const l = getLang();
  if (l === "de") return q.labelDe || q.labelEn || q.label;
  if (l === "it") return q.labelIt || q.labelEn || q.label;
  if (l === "pt") return q.labelPt || q.labelEn || q.label;
  if (l === "en") return q.labelEn || q.label;
  return q.label;
};

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
  // Membres UEFA : le joueur joue en Europe, la question « est-il européen ? »
  // répondait « non » à tort pour eux.
  "Géorgie",
  "Kosovo",
  "Arménie",
  "Biélorussie",
  "Lituanie",
  "Lettonie",
  "Estonie",
  "Luxembourg",
  "Malte",
  "Chypre",
  "Îles Féroé",
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
  "Suriname",
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
  "Angola",
  "Zambie",
  "Guinée-Bissau",
  "Guinée équatoriale",
  "Liberia",
  "Gambie",
  "Mauritanie",
  "Mozambique",
  "Bénin",
  "Kenya",
  "Comores",
  "Libye",
  "Burundi",
  "Zimbabwe",
  "Centrafrique",
  "Soudan",
  "Sierra Leone",
  "République du Congo",
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
export const ANEC_ENTRAINEUR = new Set([
  // Devenu entraîneur après sa carrière de joueur
  "Zinédine Zidane", "Pep Guardiola", "Thierry Henry", "Andrea Pirlo",
  "Gennaro Gattuso", "Frank Lampard", "Steven Gerrard", "Xavi",
  "Mikel Arteta", "Filippo Inzaghi", "Didier Deschamps", "Diego Simeone",
  "Wayne Rooney", "Vincent Kompany", "Patrick Vieira", "Roberto Mancini",
  "Frank de Boer", "Ronald Koeman", "Clarence Seedorf", "Edgar Davids",
  "Gary Neville", "Laurent Blanc", "Raúl González", "Xabi Alonso",
  "Cesc Fabregas", "Nuno Espírito Santo", "Vincenzo Montella", "Hristo Stoichkov",
  "Carlo Ancelotti", "Luis Enrique", "Rudi Garcia", "Álvaro Arbeloa",

  // Ajout : reconvertis en entraîneur (occupation "association football manager" sur Wikidata)
  "Julen Lopetegui",
  "Rubén Baraja",
  "Rubén de la Red",
  "Steve Savidan",
  "Just Fontaine",
  "Sepp Maier",
  "Oliver Bierhoff",
  "Christoph Metzelder",
  "Arne Friedrich",
  "Guido Buchwald",
  "Torsten Frings",
  "Dieter Eilts",
  "Thomas Doll",
  "Bernd Hölzenbein",
  "Horst Hrubesch",
  "Pierre Littbarski",
  "Ulf Kirsten",
  "Thomas Berthold",
  "Peter Shilton",
  "Jack Charlton",
  "Geoff Hurst",
  "Gordon Banks",
  "Ray Wilkins",
  "Trevor Brooking",
  "Miguel Veloso",
  "Jorge Andrade",
  "Eduardo Carvalho",
  "Abel Xavier",
  "Sérgio Conceição",
  "Fernando Chalana",
  "Rui Barros",
  "Domingos Paciência",
  "Pierre van Hooijdonk",
  "Johnny Rep",
  "Wim Jonk",
  "Aron Winter",
  "Jan Wouters",
  "Wim Suurbier",
  "Abe Lenstra",
  "Stijn Schaars",
  "Walter Zenga",
  "Claudio Gentile",
  "Christian Panucci",
  "Antonio Di Natale",
  "Fabrizio Ravanelli",
  "Enrico Chiesa",
  "Stefano Fiore",
  "Alessio Tacchinardi",
  "Luigi Di Biagio",
  "Angelo Di Livio",
  "Chris Sutton",
  "Ole Gunnar Solskjær",
  // Ajout : légendes Serie A / Ligue 1 / Liga devenues entraîneurs
  "Luca Vialli",
  "Roberto Boninsegna",
  "Giuseppe Meazza",
  "Silvio Piola",
  "Claude Puel",
  "Carlos Bianchi",
  "Delio Onnis",
  "Hervé Revelli",
  "Josip Skoblar",
  "Carlos Mozer",
  "Safet Sušić",
  "Vahid Halilhodžić",
  "Michel Der Zakarian",
  "Bernard Lacombe",
  "Josep Samitier",
  "Ricardo Zamora",
  "Amancio Amaro",
  "Paco Gento",
  "José Antonio Camacho",
  "Juanito",
  "Marcelo Gallardo",
  "Míchel",
  "Luis Suárez Miramontes",
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
  { id: "is-gk", category: "pos", label: "Est-ce un gardien de but ?", labelEn: "Is he a goalkeeper?", labelDe: "Ist er ein Torwart?", labelIt: "È un portiere?", labelPt: "É um goleiro?", predicate: (p) => isUniquelyPos(p, POS_GARDIEN) },
  { id: "is-def", category: "pos", label: "Est-ce un défenseur ?", labelEn: "Is he a defender?", labelDe: "Ist er ein Verteidiger?", labelIt: "È un difensore?", labelPt: "É um zagueiro?", predicate: isUniquelyDefender },
  { id: "is-mid", category: "pos", label: "Est-ce un milieu de terrain ?", labelEn: "Is he a midfielder?", labelDe: "Ist er ein Mittelfeldspieler?", labelIt: "È un centrocampista?", labelPt: "É um meio-campista?", predicate: (p) => isUniquelyPos(p, POS_MIL) },
  { id: "is-att", category: "pos", label: "Est-ce un attaquant ?", labelEn: "Is he a forward?", labelDe: "Ist er ein Stürmer?", labelIt: "È un attaccante?", labelPt: "É um atacante?", predicate: (p) => isUniquelyPos(p, POS_ATT) },
  {
    id: "is-offensive", category: "pos",
    label: "Joue-t-il à un poste offensif (milieu ou attaquant) ?", labelEn: "Does he play in an attacking position (midfield or forward)?", labelDe: "Spielt er auf einer offensiven Position (Mittelfeld oder Sturm)?", labelIt: "Gioca in una posizione offensiva (centrocampo o attacco)?", labelPt: "Joga numa posição ofensiva (meio-campo ou ataque)?",
    predicate: (p) => hasPos(p, POS_MIL) || hasPos(p, POS_ATT),
  },
  {
    id: "is-defensive", category: "pos",
    label: "Joue-t-il à un poste défensif (gardien ou défenseur) ?", labelEn: "Does he play in a defensive position (goalkeeper or defender)?", labelDe: "Spielt er auf einer defensiven Position (Torwart oder Verteidiger)?", labelIt: "Gioca in una posizione difensiva (portiere o difensore)?", labelPt: "Joga numa posição defensiva (goleiro ou zagueiro)?",
    predicate: (p) => hasPos(p, POS_GARDIEN) || isDefender(p),
  },
  {
    id: "is-versatile", category: "pos",
    label: "Peut-il jouer à plusieurs postes différents ?", labelEn: "Can he play in several different positions?", labelDe: "Kann er auf mehreren verschiedenen Positionen spielen?", labelIt: "Può giocare in diversi ruoli?", labelPt: "Pode jogar em várias posições diferentes?",
    predicate: (p) => p.positions.length >= 2,
  },

  // Nationalités majeures
  { id: "nat-fr", category: "nat", label: "Est-il français ?", labelEn: "Is he French?", labelDe: "Ist er Franzose?", labelIt: "È francese?", labelPt: "É francês?", predicate: (p) => hasNat(p, "France") },
  { id: "nat-es", category: "nat", label: "Est-il espagnol ?", labelEn: "Is he Spanish?", labelDe: "Ist er Spanier?", labelIt: "È spagnolo?", labelPt: "É espanhol?", predicate: (p) => hasNat(p, "Espagne") },
  { id: "nat-en", category: "nat", label: "Est-il anglais ?", labelEn: "Is he English?", labelDe: "Ist er Engländer?", labelIt: "È inglese?", labelPt: "É inglês?", predicate: (p) => hasNat(p, "Angleterre") },
  { id: "nat-de", category: "nat", label: "Est-il allemand ?", labelEn: "Is he German?", labelDe: "Ist er Deutscher?", labelIt: "È tedesco?", labelPt: "É alemão?", predicate: (p) => hasNat(p, "Allemagne") },
  { id: "nat-it", category: "nat", label: "Est-il italien ?", labelEn: "Is he Italian?", labelDe: "Ist er Italiener?", labelIt: "È italiano?", labelPt: "É italiano?", predicate: (p) => hasNat(p, "Italie") },
  { id: "nat-pt", category: "nat", label: "Est-il portugais ?", labelEn: "Is he Portuguese?", labelDe: "Ist er Portugiese?", labelIt: "È portoghese?", labelPt: "É português?", predicate: (p) => hasNat(p, "Portugal") },
  { id: "nat-nl", category: "nat", label: "Est-il néerlandais ?", labelEn: "Is he Dutch?", labelDe: "Ist er Niederländer?", labelIt: "È olandese?", labelPt: "É holandês?", predicate: (p) => hasNat(p, "Pays-Bas") },
  { id: "nat-be", category: "nat", label: "Est-il belge ?", labelEn: "Is he Belgian?", labelDe: "Ist er Belgier?", labelIt: "È belga?", labelPt: "É belga?", predicate: (p) => hasNat(p, "Belgique") },
  { id: "nat-hr", category: "nat", label: "Est-il croate ?", labelEn: "Is he Croatian?", labelDe: "Ist er Kroate?", labelIt: "È croato?", labelPt: "É croata?", predicate: (p) => hasNat(p, "Croatie") },
  { id: "nat-ar", category: "nat", label: "Est-il argentin ?", labelEn: "Is he Argentinian?", labelDe: "Ist er Argentinier?", labelIt: "È argentino?", labelPt: "É argentino?", predicate: (p) => hasNat(p, "Argentine") },
  { id: "nat-br", category: "nat", label: "Est-il brésilien ?", labelEn: "Is he Brazilian?", labelDe: "Ist er Brasilianer?", labelIt: "È brasiliano?", labelPt: "É brasileiro?", predicate: (p) => hasNat(p, "Brésil") },
  { id: "nat-uy", category: "nat", label: "Est-il uruguayen ?", labelEn: "Is he Uruguayan?", labelDe: "Ist er Uruguayer?", labelIt: "È uruguaiano?", labelPt: "É uruguaio?", predicate: (p) => hasNat(p, "Uruguay") },
  { id: "nat-co", category: "nat", label: "Est-il colombien ?", labelEn: "Is he Colombian?", labelDe: "Ist er Kolumbianer?", labelIt: "È colombiano?", labelPt: "É colombiano?", predicate: (p) => hasNat(p, "Colombie") },
  { id: "nat-ma", category: "nat", label: "Est-il marocain ?", labelEn: "Is he Moroccan?", labelDe: "Ist er Marokkaner?", labelIt: "È marocchino?", labelPt: "É marroquino?", predicate: (p) => hasNat(p, "Maroc") },
  { id: "nat-dz", category: "nat", label: "Est-il algérien ?", labelEn: "Is he Algerian?", labelDe: "Ist er Algerier?", labelIt: "È algerino?", labelPt: "É argelino?", predicate: (p) => hasNat(p, "Algérie") },
  { id: "nat-sn", category: "nat", label: "Est-il sénégalais ?", labelEn: "Is he Senegalese?", labelDe: "Ist er Senegalese?", labelIt: "È senegalese?", labelPt: "É senegalês?", predicate: (p) => hasNat(p, "Sénégal") },
  { id: "nat-ci", category: "nat", label: "Est-il ivoirien ?", labelEn: "Is he Ivorian?", labelDe: "Ist er Ivorer?", labelIt: "È ivoriano?", labelPt: "É marfinense?", predicate: (p) => hasNat(p, "Côte d'Ivoire") },
  { id: "nat-cm", category: "nat", label: "Est-il camerounais ?", labelEn: "Is he Cameroonian?", labelDe: "Ist er Kameruner?", labelIt: "È camerunese?", labelPt: "É camaronês?", predicate: (p) => hasNat(p, "Cameroun") },
  { id: "nat-ng", category: "nat", label: "Est-il nigérian ?", labelEn: "Is he Nigerian?", labelDe: "Ist er Nigerianer?", labelIt: "È nigeriano?", labelPt: "É nigeriano?", predicate: (p) => hasNat(p, "Nigeria") },
  { id: "nat-gh", category: "nat", label: "Est-il ghanéen ?", labelEn: "Is he Ghanaian?", labelDe: "Ist er Ghanaer?", labelIt: "È ghanese?", labelPt: "É ganês?", predicate: (p) => hasNat(p, "Ghana") },

  // Continents
  {
    id: "cont-eu", category: "cont",
    label: "Vient-il d'un pays européen ?", labelEn: "Is he from a European country?", labelDe: "Kommt er aus einem europäischen Land?", labelIt: "Viene da un paese europeo?", labelPt: "É de um país europeu?",
    predicate: (p) => p.nationalities.some((n) => EUROPE.has(n)),
  },
  {
    id: "cont-sa", category: "cont",
    label: "Vient-il d'un pays sud-américain ?", labelEn: "Is he from a South American country?", labelDe: "Kommt er aus einem südamerikanischen Land?", labelIt: "Viene da un paese sudamericano?", labelPt: "É de um país sul-americano?",
    predicate: (p) => p.nationalities.some((n) => SOUTH_AMERICA.has(n)),
  },
  {
    id: "cont-af", category: "cont",
    label: "Vient-il d'un pays africain ?", labelEn: "Is he from an African country?", labelDe: "Kommt er aus einem afrikanischen Land?", labelIt: "Viene da un paese africano?", labelPt: "É de um país africano?",
    predicate: (p) => p.nationalities.some((n) => AFRICA.has(n)),
  },

  // Clubs majeurs
  { id: "club-real", category: "club", label: "A-t-il joué au Real Madrid ?", labelEn: "Did he play for Real Madrid?", labelDe: "Hat er für Real Madrid gespielt?", labelIt: "Ha giocato nel Real Madrid?", labelPt: "Jogou pelo Real Madrid?", predicate: (p) => playedFor(p, "Real Madrid") },
  { id: "club-barca", category: "club", label: "A-t-il joué au FC Barcelone ?", labelEn: "Did he play for Barcelona?", labelDe: "Hat er für den FC Barcelona gespielt?", labelIt: "Ha giocato nel Barcellona?", labelPt: "Jogou pelo Barcelona?", predicate: (p) => playedFor(p, "Barcelona") },
  { id: "club-atm", category: "club", label: "A-t-il joué à l'Atlético Madrid ?", labelEn: "Did he play for Atletico Madrid?", labelDe: "Hat er für Atlético Madrid gespielt?", labelIt: "Ha giocato nell'Atlético Madrid?", labelPt: "Jogou pelo Atlético de Madrid?", predicate: (p) => playedFor(p, "Atletico Madrid") },
  { id: "club-sevilla", category: "club", label: "A-t-il joué au FC Séville ?", labelEn: "Did he play for Sevilla?", labelDe: "Hat er für den FC Sevilla gespielt?", labelIt: "Ha giocato nel Siviglia?", labelPt: "Jogou pelo Sevilla?", predicate: (p) => playedFor(p, "Sevilla") },
  { id: "club-mu", category: "club", label: "A-t-il joué à Manchester United ?", labelEn: "Did he play for Manchester United?", labelDe: "Hat er für Manchester United gespielt?", labelIt: "Ha giocato nel Manchester United?", labelPt: "Jogou pelo Manchester United?", predicate: (p) => playedFor(p, "Manchester United") },
  { id: "club-mc", category: "club", label: "A-t-il joué à Manchester City ?", labelEn: "Did he play for Manchester City?", labelDe: "Hat er für Manchester City gespielt?", labelIt: "Ha giocato nel Manchester City?", labelPt: "Jogou pelo Manchester City?", predicate: (p) => playedFor(p, "Manchester City") },
  { id: "club-liv", category: "club", label: "A-t-il joué à Liverpool ?", labelEn: "Did he play for Liverpool?", labelDe: "Hat er für Liverpool gespielt?", labelIt: "Ha giocato nel Liverpool?", labelPt: "Jogou pelo Liverpool?", predicate: (p) => playedFor(p, "Liverpool") },
  { id: "club-che", category: "club", label: "A-t-il joué à Chelsea ?", labelEn: "Did he play for Chelsea?", labelDe: "Hat er für Chelsea gespielt?", labelIt: "Ha giocato nel Chelsea?", labelPt: "Jogou pelo Chelsea?", predicate: (p) => playedFor(p, "Chelsea") },
  { id: "club-ars", category: "club", label: "A-t-il joué à Arsenal ?", labelEn: "Did he play for Arsenal?", labelDe: "Hat er für Arsenal gespielt?", labelIt: "Ha giocato nell'Arsenal?", labelPt: "Jogou pelo Arsenal?", predicate: (p) => playedFor(p, "Arsenal") },
  { id: "club-tot", category: "club", label: "A-t-il joué à Tottenham ?", labelEn: "Did he play for Tottenham?", labelDe: "Hat er für Tottenham gespielt?", labelIt: "Ha giocato nel Tottenham?", labelPt: "Jogou pelo Tottenham?", predicate: (p) => playedFor(p, "Tottenham") },
  { id: "club-juv", category: "club", label: "A-t-il joué à la Juventus ?", labelEn: "Did he play for Juventus FC?", labelDe: "Hat er für Juventus gespielt?", labelIt: "Ha giocato nella Juventus?", labelPt: "Jogou pela Juventus?", predicate: (p) => playedFor(p, "Juventus FC") },
  { id: "club-milan", category: "club", label: "A-t-il joué à l'AC Milan ?", labelEn: "Did he play for AC Milan?", labelDe: "Hat er für den AC Mailand gespielt?", labelIt: "Ha giocato nel Milan?", labelPt: "Jogou pelo Milan?", predicate: (p) => playedFor(p, "AC Milan") },
  { id: "club-inter", category: "club", label: "A-t-il joué à l'Inter Milan ?", labelEn: "Did he play for Inter Milan?", labelDe: "Hat er für Inter Mailand gespielt?", labelIt: "Ha giocato nell'Inter?", labelPt: "Jogou pela Inter de Milão?", predicate: (p) => playedFor(p, "Inter Milan") },
  { id: "club-roma", category: "club", label: "A-t-il joué à l'AS Roma ?", labelEn: "Did he play for AS Roma?", labelDe: "Hat er für die AS Rom gespielt?", labelIt: "Ha giocato nella Roma?", labelPt: "Jogou pela Roma?", predicate: (p) => playedFor(p, "AS Roma") },
  { id: "club-napoli", category: "club", label: "A-t-il joué à Naples ?", labelEn: "Did he play for SSC Napoli?", labelDe: "Hat er für die SSC Neapel gespielt?", labelIt: "Ha giocato nel Napoli?", labelPt: "Jogou pelo Napoli?", predicate: (p) => playedFor(p, "SSC Napoli") },
  { id: "club-bayern", category: "club", label: "A-t-il joué au Bayern Munich ?", labelEn: "Did he play for Bayern Munich?", labelDe: "Hat er für den FC Bayern München gespielt?", labelIt: "Ha giocato nel Bayern Monaco?", labelPt: "Jogou pelo Bayern de Munique?", predicate: (p) => playedFor(p, "Bayern Munich") },
  { id: "club-bvb", category: "club", label: "A-t-il joué au Borussia Dortmund ?", labelEn: "Did he play for Borussia Dortmund?", labelDe: "Hat er für Borussia Dortmund gespielt?", labelIt: "Ha giocato nel Borussia Dortmund?", labelPt: "Jogou pelo Borussia Dortmund?", predicate: (p) => playedFor(p, "Borussia Dortmund") },
  { id: "club-psg", category: "club", label: "A-t-il joué au PSG ?", labelEn: "Did he play for PSG?", labelDe: "Hat er für PSG gespielt?", labelIt: "Ha giocato nel PSG?", labelPt: "Jogou pelo PSG?", predicate: (p) => playedFor(p, "PSG") },
  { id: "club-om", category: "club", label: "A-t-il joué à l'Olympique de Marseille ?", labelEn: "Did he play for Marseille?", labelDe: "Hat er für Olympique Marseille gespielt?", labelIt: "Ha giocato nell'Olympique Marsiglia?", labelPt: "Jogou pelo Olympique de Marselha?", predicate: (p) => playedFor(p, "Marseille") },
  { id: "club-ol", category: "club", label: "A-t-il joué à l'Olympique Lyonnais ?", labelEn: "Did he play for Lyon?", labelDe: "Hat er für Olympique Lyon gespielt?", labelIt: "Ha giocato nell'Olympique Lione?", labelPt: "Jogou pelo Olympique Lyon?", predicate: (p) => playedFor(p, "Lyon") },
  { id: "club-monaco", category: "club", label: "A-t-il joué à l'AS Monaco ?", labelEn: "Did he play for Monaco?", labelDe: "Hat er für die AS Monaco gespielt?", labelIt: "Ha giocato nel Monaco?", labelPt: "Jogou pelo Monaco?", predicate: (p) => playedFor(p, "Monaco") },
  { id: "club-lille", category: "club", label: "A-t-il joué au LOSC Lille ?", labelEn: "Did he play for Lille?", labelDe: "Hat er für den LOSC Lille gespielt?", labelIt: "Ha giocato nel Lille?", labelPt: "Jogou pelo Lille?", predicate: (p) => playedFor(p, "Lille") },
  { id: "club-ajax", category: "club", label: "A-t-il joué à l'Ajax Amsterdam ?", labelEn: "Did he play for Ajax Amsterdam?", labelDe: "Hat er für Ajax Amsterdam gespielt?", labelIt: "Ha giocato nell'Ajax?", labelPt: "Jogou pelo Ajax?", predicate: (p) => playedFor(p, "Ajax Amsterdam") },
  { id: "club-porto", category: "club", label: "A-t-il joué au FC Porto ?", labelEn: "Did he play for Porto?", labelDe: "Hat er für den FC Porto gespielt?", labelIt: "Ha giocato nel Porto?", labelPt: "Jogou pelo Porto?", predicate: (p) => playedFor(p, "Porto") },
  { id: "club-benfica", category: "club", label: "A-t-il joué au Benfica ?", labelEn: "Did he play for Benfica?", labelDe: "Hat er für Benfica gespielt?", labelIt: "Ha giocato nel Benfica?", labelPt: "Jogou pelo Benfica?", predicate: (p) => playedFor(p, "Benfica") },
  { id: "club-sporting", category: "club", label: "A-t-il joué au Sporting CP ?", labelEn: "Did he play for Sporting CP?", labelDe: "Hat er für Sporting CP gespielt?", labelIt: "Ha giocato nello Sporting CP?", labelPt: "Jogou pelo Sporting CP?", predicate: (p) => playedFor(p, "Sporting CP") },
  { id: "club-newcastle", category: "club", label: "A-t-il joué à Newcastle ?", labelEn: "Did he play for Newcastle?", labelDe: "Hat er für Newcastle gespielt?", labelIt: "Ha giocato nel Newcastle?", labelPt: "Jogou pelo Newcastle?", predicate: (p) => playedFor(p, "Newcastle") },

  // Ligues
  { id: "lg-pl", category: "league", label: "A-t-il joué en Premier League anglaise ?", labelEn: "Has he played in the English Premier League?", labelDe: "Hat er in der englischen Premier League gespielt?", labelIt: "Ha giocato nella Premier League inglese?", labelPt: "Jogou na Premier League inglesa?", predicate: (p) => playedForAny(p, PREMIER_LEAGUE) },
  { id: "lg-liga", category: "league", label: "A-t-il joué en Liga espagnole ?", labelEn: "Has he played in the Spanish La Liga?", labelDe: "Hat er in der spanischen La Liga gespielt?", labelIt: "Ha giocato nella Liga spagnola?", labelPt: "Jogou na La Liga espanhola?", predicate: (p) => playedForAny(p, LIGA) },
  { id: "lg-seriea", category: "league", label: "A-t-il joué en Serie A italienne ?", labelEn: "Has he played in the Italian Serie A?", labelDe: "Hat er in der italienischen Serie A gespielt?", labelIt: "Ha giocato nella Serie A italiana?", labelPt: "Jogou na Serie A italiana?", predicate: (p) => playedForAny(p, SERIE_A) },
  { id: "lg-l1", category: "league", label: "A-t-il joué en Ligue 1 française ?", labelEn: "Has he played in the French Ligue 1?", labelDe: "Hat er in der französischen Ligue 1 gespielt?", labelIt: "Ha giocato nella Ligue 1 francese?", labelPt: "Jogou na Ligue 1 francesa?", predicate: (p) => playedForAny(p, LIGUE_1) },
  { id: "lg-bl", category: "league", label: "A-t-il joué en Bundesliga allemande ?", labelEn: "Has he played in the German Bundesliga?", labelDe: "Hat er in der deutschen Bundesliga gespielt?", labelIt: "Ha giocato nella Bundesliga tedesca?", labelPt: "Jogou na Bundesliga alemã?", predicate: (p) => playedForAny(p, BUNDESLIGA) },

  // Clubs additionnels (deuxième couche, ~30-100 joueurs chacun)
  { id: "club-leverkusen", category: "club", label: "A-t-il joué au Bayer Leverkusen ?", labelEn: "Did he play for Bayer Leverkusen?", labelDe: "Hat er für Bayer Leverkusen gespielt?", labelIt: "Ha giocato nel Bayer Leverkusen?", labelPt: "Jogou pelo Bayer Leverkusen?", predicate: (p) => playedFor(p, "Bayer Leverkusen") },
  { id: "club-leipzig", category: "club", label: "A-t-il joué au RB Leipzig ?", labelEn: "Did he play for RB Leipzig?", labelDe: "Hat er für RB Leipzig gespielt?", labelIt: "Ha giocato nel RB Lipsia?", labelPt: "Jogou pelo RB Leipzig?", predicate: (p) => playedFor(p, "RB Leipzig") },
  { id: "club-schalke", category: "club", label: "A-t-il joué à Schalke 04 ?", labelEn: "Did he play for Schalke?", labelDe: "Hat er für Schalke 04 gespielt?", labelIt: "Ha giocato nello Schalke 04?", labelPt: "Jogou pelo Schalke 04?", predicate: (p) => playedFor(p, "Schalke") },
  { id: "club-wolfsburg", category: "club", label: "A-t-il joué à Wolfsburg ?", labelEn: "Did he play for Wolfsburg?", labelDe: "Hat er für Wolfsburg gespielt?", labelIt: "Ha giocato nel Wolfsburg?", labelPt: "Jogou pelo Wolfsburg?", predicate: (p) => playedFor(p, "Wolfsburg") },
  { id: "club-frankfurt", category: "club", label: "A-t-il joué à l'Eintracht Frankfurt ?", labelEn: "Did he play for Eintracht Frankfurt?", labelDe: "Hat er für Eintracht Frankfurt gespielt?", labelIt: "Ha giocato nell'Eintracht Francoforte?", labelPt: "Jogou pelo Eintracht Frankfurt?", predicate: (p) => playedFor(p, "Eintracht Frankfurt") },
  { id: "club-stuttgart", category: "club", label: "A-t-il joué à Stuttgart ?", labelEn: "Did he play for Stuttgart?", labelDe: "Hat er für den VfB Stuttgart gespielt?", labelIt: "Ha giocato nello Stoccarda?", labelPt: "Jogou pelo Stuttgart?", predicate: (p) => playedFor(p, "Stuttgart") },
  { id: "club-lazio", category: "club", label: "A-t-il joué à la Lazio ?", labelEn: "Did he play for SS Lazio?", labelDe: "Hat er für Lazio Rom gespielt?", labelIt: "Ha giocato nella Lazio?", labelPt: "Jogou pela Lazio?", predicate: (p) => playedFor(p, "SS Lazio") },
  { id: "club-atalanta", category: "club", label: "A-t-il joué à l'Atalanta ?", labelEn: "Did he play for Atalanta BC?", labelDe: "Hat er für Atalanta Bergamo gespielt?", labelIt: "Ha giocato nell'Atalanta?", labelPt: "Jogou pela Atalanta?", predicate: (p) => playedFor(p, "Atalanta BC") },
  { id: "club-fiorentina", category: "club", label: "A-t-il joué à la Fiorentina ?", labelEn: "Did he play for Fiorentina?", labelDe: "Hat er für den AC Florenz gespielt?", labelIt: "Ha giocato nella Fiorentina?", labelPt: "Jogou pela Fiorentina?", predicate: (p) => playedForAny(p, ["Fiorentina", "ACF Fiorentina"]) },
  { id: "club-sassuolo", category: "club", label: "A-t-il joué à Sassuolo ?", labelEn: "Did he play for Sassuolo?", labelDe: "Hat er für Sassuolo gespielt?", labelIt: "Ha giocato nel Sassuolo?", labelPt: "Jogou pelo Sassuolo?", predicate: (p) => playedFor(p, "Sassuolo") },
  { id: "club-villarreal", category: "club", label: "A-t-il joué à Villarreal ?", labelEn: "Did he play for Villarreal?", labelDe: "Hat er für Villarreal gespielt?", labelIt: "Ha giocato nel Villarreal?", labelPt: "Jogou pelo Villarreal?", predicate: (p) => playedFor(p, "Villarreal") },
  { id: "club-valencia", category: "club", label: "A-t-il joué à Valence ?", labelEn: "Did he play for Valencia?", labelDe: "Hat er für den FC Valencia gespielt?", labelIt: "Ha giocato nel Valencia?", labelPt: "Jogou pelo Valencia?", predicate: (p) => playedFor(p, "Valencia") },
  { id: "club-sociedad", category: "club", label: "A-t-il joué à la Real Sociedad ?", labelEn: "Did he play for Real Sociedad?", labelDe: "Hat er für Real Sociedad gespielt?", labelIt: "Ha giocato nella Real Sociedad?", labelPt: "Jogou pela Real Sociedad?", predicate: (p) => playedFor(p, "Real Sociedad") },
  { id: "club-betis", category: "club", label: "A-t-il joué au Real Betis ?", labelEn: "Did he play for Real Betis?", labelDe: "Hat er für Real Betis gespielt?", labelIt: "Ha giocato nel Real Betis?", labelPt: "Jogou pelo Real Betis?", predicate: (p) => playedFor(p, "Real Betis") },
  { id: "club-westham", category: "club", label: "A-t-il joué à West Ham ?", labelEn: "Did he play for West Ham?", labelDe: "Hat er für West Ham gespielt?", labelIt: "Ha giocato nel West Ham?", labelPt: "Jogou pelo West Ham?", predicate: (p) => playedFor(p, "West Ham") },
  { id: "club-everton", category: "club", label: "A-t-il joué à Everton ?", labelEn: "Did he play for Everton?", labelDe: "Hat er für Everton gespielt?", labelIt: "Ha giocato nell'Everton?", labelPt: "Jogou pelo Everton?", predicate: (p) => playedFor(p, "Everton") },
  { id: "club-aston", category: "club", label: "A-t-il joué à Aston Villa ?", labelEn: "Did he play for Aston Villa?", labelDe: "Hat er für Aston Villa gespielt?", labelIt: "Ha giocato nell'Aston Villa?", labelPt: "Jogou pelo Aston Villa?", predicate: (p) => playedFor(p, "Aston Villa") },
  { id: "club-fulham", category: "club", label: "A-t-il joué à Fulham ?", labelEn: "Did he play for Fulham?", labelDe: "Hat er für Fulham gespielt?", labelIt: "Ha giocato nel Fulham?", labelPt: "Jogou pelo Fulham?", predicate: (p) => playedFor(p, "Fulham") },
  { id: "club-nice", category: "club", label: "A-t-il joué à l'OGC Nice ?", labelEn: "Did he play for Nice?", labelDe: "Hat er für den OGC Nizza gespielt?", labelIt: "Ha giocato nel Nizza?", labelPt: "Jogou pelo Nice?", predicate: (p) => playedFor(p, "Nice") },
  { id: "club-rennes", category: "club", label: "A-t-il joué au Stade Rennais ?", labelEn: "Did he play for Rennes?", labelDe: "Hat er für Stade Rennais gespielt?", labelIt: "Ha giocato nel Rennes?", labelPt: "Jogou pelo Rennes?", predicate: (p) => playedFor(p, "Rennes") },
  { id: "club-bordeaux", category: "club", label: "A-t-il joué aux Girondins de Bordeaux ?", labelEn: "Did he play for Bordeaux?", labelDe: "Hat er für Girondins Bordeaux gespielt?", labelIt: "Ha giocato nel Bordeaux?", labelPt: "Jogou pelo Bordeaux?", predicate: (p) => playedFor(p, "Bordeaux") },
  { id: "club-saintet", category: "club", label: "A-t-il joué à l'AS Saint-Étienne ?", labelEn: "Did he play for Saint-Étienne?", labelDe: "Hat er für AS Saint-Étienne gespielt?", labelIt: "Ha giocato nel Saint-Étienne?", labelPt: "Jogou pelo Saint-Étienne?", predicate: (p) => playedForAny(p, ["Saint-Étienne", "Saint-Etienne"]) },
  { id: "club-nantes", category: "club", label: "A-t-il joué au FC Nantes ?", labelEn: "Did he play for Nantes?", labelDe: "Hat er für den FC Nantes gespielt?", labelIt: "Ha giocato nel Nantes?", labelPt: "Jogou pelo Nantes?", predicate: (p) => playedFor(p, "Nantes") },
  { id: "club-lens", category: "club", label: "A-t-il joué au RC Lens ?", labelEn: "Did he play for Lens?", labelDe: "Hat er für den RC Lens gespielt?", labelIt: "Ha giocato nel Lens?", labelPt: "Jogou pelo Lens?", predicate: (p) => playedFor(p, "Lens") },
  { id: "club-feyenoord", category: "club", label: "A-t-il joué à Feyenoord ?", labelEn: "Did he play for Feyenoord?", labelDe: "Hat er für Feyenoord gespielt?", labelIt: "Ha giocato nel Feyenoord?", labelPt: "Jogou pelo Feyenoord?", predicate: (p) => playedFor(p, "Feyenoord") },
  { id: "club-psv", category: "club", label: "A-t-il joué au PSV Eindhoven ?", labelEn: "Did he play for PSV Eindhoven?", labelDe: "Hat er für die PSV Eindhoven gespielt?", labelIt: "Ha giocato nel PSV Eindhoven?", labelPt: "Jogou pelo PSV Eindhoven?", predicate: (p) => playedFor(p, "PSV Eindhoven") },
  { id: "club-galata", category: "club", label: "A-t-il joué à Galatasaray ?", labelEn: "Did he play for Galatasaray?", labelDe: "Hat er für Galatasaray gespielt?", labelIt: "Ha giocato nel Galatasaray?", labelPt: "Jogou pelo Galatasaray?", predicate: (p) => playedFor(p, "Galatasaray") },
  { id: "club-fener", category: "club", label: "A-t-il joué à Fenerbahçe ?", labelEn: "Did he play for Fenerbahce?", labelDe: "Hat er für Fenerbahçe gespielt?", labelIt: "Ha giocato nel Fenerbahçe?", labelPt: "Jogou pelo Fenerbahçe?", predicate: (p) => playedFor(p, "Fenerbahce") },
  { id: "club-celtic", category: "club", label: "A-t-il joué au Celtic Glasgow ?", labelEn: "Did he play for Celtic?", labelDe: "Hat er für Celtic Glasgow gespielt?", labelIt: "Ha giocato nel Celtic?", labelPt: "Jogou pelo Celtic?", predicate: (p) => playedFor(p, "Celtic") },
  { id: "club-boca", category: "club", label: "A-t-il joué à Boca Juniors ?", labelEn: "Did he play for Boca Juniors?", labelDe: "Hat er für die Boca Juniors gespielt?", labelIt: "Ha giocato nel Boca Juniors?", labelPt: "Jogou pelo Boca Juniors?", predicate: (p) => playedFor(p, "Boca Juniors") },
  { id: "club-river", category: "club", label: "A-t-il joué à River Plate ?", labelEn: "Did he play for River Plate?", labelDe: "Hat er für River Plate gespielt?", labelIt: "Ha giocato nel River Plate?", labelPt: "Jogou pelo River Plate?", predicate: (p) => playedFor(p, "River Plate") },

  // Nationalités additionnelles
  { id: "nat-dk", category: "nat", label: "Est-il danois ?", labelEn: "Is he Danish?", labelDe: "Ist er Däne?", labelIt: "È danese?", labelPt: "É dinamarquês?", predicate: (p) => hasNat(p, "Danemark") },
  { id: "nat-se", category: "nat", label: "Est-il suédois ?", labelEn: "Is he Swedish?", labelDe: "Ist er Schwede?", labelIt: "È svedese?", labelPt: "É sueco?", predicate: (p) => hasNat(p, "Suède") },
  { id: "nat-no", category: "nat", label: "Est-il norvégien ?", labelEn: "Is he Norwegian?", labelDe: "Ist er Norweger?", labelIt: "È norvegese?", labelPt: "É norueguês?", predicate: (p) => hasNat(p, "Norvège") },
  { id: "nat-ch", category: "nat", label: "Est-il suisse ?", labelEn: "Is he Swiss?", labelDe: "Ist er Schweizer?", labelIt: "È svizzero?", labelPt: "É suíço?", predicate: (p) => hasNat(p, "Suisse") },
  { id: "nat-pl", category: "nat", label: "Est-il polonais ?", labelEn: "Is he Polish?", labelDe: "Ist er Pole?", labelIt: "È polacco?", labelPt: "É polonês?", predicate: (p) => hasNat(p, "Pologne") },
  { id: "nat-cz", category: "nat", label: "Est-il tchèque ?", labelEn: "Is he Czech?", labelDe: "Ist er Tscheche?", labelIt: "È ceco?", labelPt: "É tcheco?", predicate: (p) => hasNat(p, "Tchéquie") },
  { id: "nat-rs", category: "nat", label: "Est-il serbe ?", labelEn: "Is he Serbian?", labelDe: "Ist er Serbe?", labelIt: "È serbo?", labelPt: "É sérvio?", predicate: (p) => hasNat(p, "Serbie") },
  { id: "nat-tr", category: "nat", label: "Est-il turc ?", labelEn: "Is he Turkish?", labelDe: "Ist er Türke?", labelIt: "È turco?", labelPt: "É turco?", predicate: (p) => hasNat(p, "Turquie") },
  { id: "nat-gr", category: "nat", label: "Est-il grec ?", labelEn: "Is he Greek?", labelDe: "Ist er Grieche?", labelIt: "È greco?", labelPt: "É grego?", predicate: (p) => hasNat(p, "Grèce") },
  { id: "nat-mx", category: "nat", label: "Est-il mexicain ?", labelEn: "Is he Mexican?", labelDe: "Ist er Mexikaner?", labelIt: "È messicano?", labelPt: "É mexicano?", predicate: (p) => hasNat(p, "Mexique") },
  { id: "nat-jp", category: "nat", label: "Est-il japonais ?", labelEn: "Is he Japanese?", labelDe: "Ist er Japaner?", labelIt: "È giapponese?", labelPt: "É japonês?", predicate: (p) => hasNat(p, "Japon") },
  { id: "nat-us", category: "nat", label: "Est-il américain (USA) ?", labelEn: "Is he American (USA)?", labelDe: "Ist er Amerikaner (USA)?", labelIt: "È americano (USA)?", labelPt: "É americano (EUA)?", predicate: (p) => hasNat(p, "États-Unis") },
  { id: "nat-ml", category: "nat", label: "Est-il malien ?", labelEn: "Is he Malian?", labelDe: "Ist er Malier?", labelIt: "È maliano?", labelPt: "É malinês?", predicate: (p) => hasNat(p, "Mali") },

  // Statut / profil
  {
    id: "retired", category: "profile",
    label: "Est-il retraité (n'a plus joué récemment) ?", labelEn: "Is he retired (no longer playing)?", labelDe: "Ist er im Ruhestand (spielt nicht mehr)?", labelIt: "È in pensione (non gioca più)?", labelPt: "Está aposentado (não joga mais)?",
    predicate: (p) => RETIRED_PLAYERS.has(p.name),
  },
  {
    id: "nomad", category: "profile",
    label: "A-t-il joué dans 5 clubs différents ou plus ?", labelEn: "Has he played for 5 different clubs or more?", labelDe: "Hat er für 5 oder mehr verschiedene Klubs gespielt?", labelIt: "Ha giocato in 5 o più club diversi?", labelPt: "Jogou em 5 clubes diferentes ou mais?",
    predicate: (p) => p.clubs.length >= 5,
  },
  {
    id: "very-nomad", category: "profile",
    label: "A-t-il eu une carrière de globe-trotter (7 clubs ou plus) ?", labelEn: "Has he had a globe-trotter career (7 clubs or more)?", labelDe: "Hatte er eine Globetrotter-Karriere (7 Klubs oder mehr)?", labelIt: "Ha avuto una carriera da giramondo (7 club o più)?", labelPt: "Teve uma carreira de globe-trotter (7 clubes ou mais)?",
    predicate: (p) => p.clubs.length >= 7,
  },
  {
    id: "loyal", category: "profile",
    label: "Est-ce un joueur fidèle (1 ou 2 clubs dans toute sa carrière) ?", labelEn: "Is he a loyal player (1 or 2 clubs in his whole career)?", labelDe: "Ist er ein treuer Spieler (1 oder 2 Klubs in seiner ganzen Karriere)?", labelIt: "È un giocatore fedele (1 o 2 club in tutta la carriera)?", labelPt: "É um jogador fiel (1 ou 2 clubes na carreira toda)?",
    predicate: (p) => p.clubs.length <= 2,
  },

  // Palmarès — basés sur les sets GG_WC_WINNERS et GG_CL_WINNERS
  {
    id: "won-ucl", category: "profile",
    label: "A-t-il déjà gagné la Ligue des Champions avec son club ?", labelEn: "Has he ever won the Champions League with his club?", labelDe: "Hat er jemals die Champions League mit seinem Klub gewonnen?", labelIt: "Ha mai vinto la Champions League con il suo club?", labelPt: "Já ganhou a Liga dos Campeões com seu clube?",
    predicate: (p) => GG_CL_WINNERS.has(p.name),
  },
  {
    id: "won-wc", category: "profile",
    label: "A-t-il déjà gagné la Coupe du Monde avec sa sélection ?", labelEn: "Has he ever won the World Cup with his national team?", labelDe: "Hat er jemals die Weltmeisterschaft mit seiner Nationalmannschaft gewonnen?", labelIt: "Ha mai vinto la Coppa del Mondo con la sua nazionale?", labelPt: "Já ganhou a Copa do Mundo com sua seleção?",
    predicate: (p) => GG_WC_WINNERS.has(p.name),
  },

  // Année de naissance (predicate retourne null si info absente)
  {
    id: "era-90s", category: "era",
    label: "Est-il né dans les années 90 (entre 1990 et 1999) ?", labelEn: "Was he born in the 1990s (between 1990 and 1999)?", labelDe: "Wurde er in den 1990ern geboren (zwischen 1990 und 1999)?", labelIt: "È nato negli anni '90 (tra il 1990 e il 1999)?", labelPt: "Nasceu nos anos 90 (entre 1990 e 1999)?",
    predicate: (p) =>
      p.birthYear === undefined
        ? null
        : p.birthYear >= 1990 && p.birthYear <= 1999,
  },
  {
    id: "era-2000s", category: "era",
    label: "Est-il né dans les années 2000 (entre 2000 et 2009) ?", labelEn: "Was he born in the 2000s (between 2000 and 2009)?", labelDe: "Wurde er in den 2000ern geboren (zwischen 2000 und 2009)?", labelIt: "È nato negli anni 2000 (tra il 2000 e il 2009)?", labelPt: "Nasceu nos anos 2000 (entre 2000 e 2009)?",
    predicate: (p) =>
      p.birthYear === undefined
        ? null
        : p.birthYear >= 2000 && p.birthYear <= 2009,
  },
  {
    id: "era-80s", category: "era",
    label: "Est-il né dans les années 80 (entre 1980 et 1989) ?", labelEn: "Was he born in the 1980s (between 1980 and 1989)?", labelDe: "Wurde er in den 1980ern geboren (zwischen 1980 und 1989)?", labelIt: "È nato negli anni '80 (tra il 1980 e il 1989)?", labelPt: "Nasceu nos anos 80 (entre 1980 e 1989)?",
    predicate: (p) =>
      p.birthYear === undefined
        ? null
        : p.birthYear >= 1980 && p.birthYear <= 1989,
  },
  {
    id: "era-old", category: "era",
    label: "Est-il né avant 1980 (légende plus ancienne) ?", labelEn: "Was he born before 1980 (an older legend)?", labelDe: "Wurde er vor 1980 geboren (eine ältere Legende)?", labelIt: "È nato prima del 1980 (una leggenda più vecchia)?", labelPt: "Nasceu antes de 1980 (uma lenda mais antiga)?",
    predicate: (p) =>
      p.birthYear === undefined ? null : p.birthYear < 1980,
  },
  {
    id: "era-gen-z", category: "era",
    label: "A-t-il moins de 25 ans aujourd'hui (né après 2001) ?", labelEn: "Is he under 25 today (born after 2001)?", labelDe: "Ist er heute unter 25 (nach 2001 geboren)?", labelIt: "Ha meno di 25 anni oggi (nato dopo il 2001)?", labelPt: "Tem menos de 25 anos hoje (nascido depois de 2001)?",
    predicate: (p) =>
      p.birthYear === undefined ? null : p.birthYear >= 2001,
  },

  // Anecdotes / faits atypiques (départage de fin de partie)
  {
    id: "anec-bagarre", category: "anecdote",
    label: "A-t-il créé une polémique après une bagarre avec un coéquipier ?", labelEn: "Did he spark controversy after a fight with a teammate?", labelDe: "Sorgte er für Kontroversen nach einem Streit mit einem Mitspieler?", labelIt: "Ha creato polemiche dopo una rissa con un compagno?", labelPt: "Causou polêmica após uma briga com um companheiro?",
    predicate: (p) => ANEC_BAGARRE_COEQUIPIER.has(p.name),
  },
  {
    id: "anec-morsure", category: "anecdote",
    label: "A-t-il déjà mordu un adversaire sur le terrain ?", labelEn: "Has he ever bitten an opponent on the pitch?", labelDe: "Hat er jemals einen Gegner auf dem Platz gebissen?", labelIt: "Ha mai morso un avversario in campo?", labelPt: "Já mordeu um adversário em campo?",
    predicate: (p) => ANEC_MORSURE.has(p.name),
  },
  {
    id: "anec-red-finale", category: "anecdote",
    label: "A-t-il été expulsé lors d'une finale de Coupe du Monde ?", labelEn: "Was he sent off in a World Cup final?", labelDe: "Wurde er in einem WM-Finale vom Platz gestellt?", labelIt: "È stato espulso in una finale dei Mondiali?", labelPt: "Foi expulso numa final de Copa do Mundo?",
    predicate: (p) => ANEC_RED_FINALE_CDM.has(p.name),
  },
  {
    id: "anec-main", category: "anecdote",
    label: "A-t-il marqué ou sauvé un but de la main de façon célèbre ?", labelEn: "Did he famously score or stop a goal with his hand?", labelDe: "Hat er berühmt ein Tor mit der Hand erzielt oder verhindert?", labelIt: "Ha segnato o parato un gol con la mano in modo celebre?", labelPt: "Marcou ou impediu um gol com a mão de forma famosa?",
    predicate: (p) => ANEC_BUT_DE_LA_MAIN.has(p.name),
  },
  {
    id: "anec-transfert-rival", category: "anecdote",
    label: "A-t-il fait un transfert très controversé vers un grand rival ?", labelEn: "Did he make a highly controversial transfer to a big rival?", labelDe: "Hat er einen hochumstrittenen Wechsel zu einem großen Rivalen gemacht?", labelIt: "Ha fatto un trasferimento molto controverso a una grande rivale?", labelPt: "Fez uma transferência muito polêmica para um grande rival?",
    predicate: (p) => ANEC_TRANSFERT_RIVAUX.has(p.name),
  },
  {
    id: "anec-fratrie", category: "anecdote",
    label: "A-t-il un frère footballeur ?", labelEn: "Does he have a brother who is a footballer?", labelDe: "Hat er einen Bruder, der Fußballer ist?", labelIt: "Ha un fratello calciatore?", labelPt: "Tem um irmão que é jogador de futebol?",
    predicate: (p) => ANEC_FRATRIE.has(p.name),
  },
  {
    id: "anec-change-selection", category: "anecdote",
    label: "A-t-il changé de sélection nationale au cours de sa carrière ?", labelEn: "Did he switch national teams during his career?", labelDe: "Hat er während seiner Karriere die Nationalmannschaft gewechselt?", labelIt: "Ha cambiato nazionale durante la carriera?", labelPt: "Trocou de seleção nacional durante a carreira?",
    predicate: (p) => ANEC_CHANGE_SELECTION.has(p.name),
  },
  {
    id: "anec-but-finale-cdm", category: "anecdote",
    label: "A-t-il marqué lors d'une finale de Coupe du Monde ?", labelEn: "Did he score in a World Cup final?", labelDe: "Hat er in einem WM-Finale getroffen?", labelIt: "Ha segnato in una finale dei Mondiali?", labelPt: "Marcou numa final de Copa do Mundo?",
    predicate: (p) => ANEC_BUT_FINALE_CDM.has(p.name),
  },
  {
    id: "anec-ballon-dor", category: "anecdote",
    label: "A-t-il remporté le Ballon d'Or ?", labelEn: "Has he won the Ballon d'Or?", labelDe: "Hat er den Ballon d'Or gewonnen?", labelIt: "Ha vinto il Pallone d'Oro?", labelPt: "Ganhou a Bola de Ouro?",
    predicate: (p) => GG_BALLON_DOR.has(p.name),
  },
  {
    id: "anec-ballon-dor-multi", category: "anecdote",
    label: "A-t-il remporté plusieurs Ballons d'Or ?", labelEn: "Has he won several Ballons d'Or?", labelDe: "Hat er mehrere Ballons d'Or gewonnen?", labelIt: "Ha vinto più Palloni d'Oro?", labelPt: "Ganhou várias Bolas de Ouro?",
    predicate: (p) => GG_BALLON_DOR_MULTI.has(p.name),
  },
  {
    id: "anec-shirt-10", category: "anecdote",
    label: "A-t-il porté le mythique numéro 10 ?", labelEn: "Did he wear the iconic number 10?", labelDe: "Trug er die legendäre Nummer 10?", labelIt: "Ha indossato la mitica maglia numero 10?", labelPt: "Usou a mítica camisa 10?",
    predicate: (p) => GG_SHIRT_10.has(p.name),
  },
  {
    id: "anec-penalty-finale", category: "anecdote",
    label: "A-t-il raté un penalty resté célèbre lors d'une grande finale ?", labelEn: "Did he miss a famous penalty in a major final?", labelDe: "Hat er einen berühmten Elfmeter in einem großen Finale verschossen?", labelIt: "Ha sbagliato un rigore celebre in una grande finale?", labelPt: "Perdeu um pênalti famoso numa grande final?",
    predicate: (p) => ANEC_PENALTY_FINALE.has(p.name),
  },
  {
    id: "anec-prison", category: "anecdote",
    label: "A-t-il déjà fait de la prison ?", labelEn: "Has he ever been to prison?", labelDe: "War er jemals im Gefängnis?", labelIt: "È mai stato in prigione?", labelPt: "Já esteve na prisão?",
    predicate: (p) => ANEC_PRISON.has(p.name),
  },
  {
    id: "anec-extorsion-frere", category: "anecdote",
    label: "A-t-il été victime d'une tentative d'extorsion orchestrée par son frère ?", labelEn: "Was he the victim of an extortion attempt orchestrated by his brother?", labelDe: "War er Opfer eines von seinem Bruder inszenierten Erpressungsversuchs?", labelIt: "È stato vittima di un tentativo di estorsione orchestrato dal fratello?", labelPt: "Foi vítima de uma tentativa de extorsão orquestrada pelo irmão?",
    predicate: (p) => ANEC_EXTORSION_FRERE.has(p.name),
  },
  {
    id: "anec-extorsion", category: "anecdote",
    label: "A-t-il été victime d'une tentative d'extorsion ?", labelEn: "Was he the victim of an extortion attempt?", labelDe: "War er Opfer eines Erpressungsversuchs?", labelIt: "È stato vittima di un tentativo di estorsione?", labelPt: "Foi vítima de uma tentativa de extorsão?",
    predicate: (p) => ANEC_EXTORSION.has(p.name),
  },
  {
    id: "anec-paris", category: "anecdote",
    label: "A-t-il été suspendu pour des infractions liées aux paris sportifs ?", labelEn: "Was he suspended for betting-related offences?", labelDe: "Wurde er wegen wettbezogener Vergehen gesperrt?", labelIt: "È stato squalificato per illeciti legati alle scommesse?", labelPt: "Foi suspenso por infrações ligadas a apostas?",
    predicate: (p) => ANEC_PARIS.has(p.name),
  },
  {
    id: "anec-dopage", category: "anecdote",
    label: "A-t-il été suspendu pour une affaire de dopage ?", labelEn: "Was he suspended over a doping case?", labelDe: "Wurde er wegen eines Dopingfalls gesperrt?", labelIt: "È stato squalificato per un caso di doping?", labelPt: "Foi suspenso por um caso de doping?",
    predicate: (p) => ANEC_DOPAGE.has(p.name),
  },
  {
    id: "anec-celebrite", category: "anecdote",
    label: "A-t-il été marié ou en couple avec une célébrité ?", labelEn: "Has he been married to or in a relationship with a celebrity?", labelDe: "War er mit einer Berühmtheit verheiratet oder liiert?", labelIt: "È stato sposato o in coppia con una celebrità?", labelPt: "Foi casado ou namorou uma celebridade?",
    predicate: (p) => ANEC_CELEBRITE.has(p.name),
  },
  {
    id: "anec-transfert-record", category: "anecdote",
    label: "A-t-il été, à son époque, le joueur le plus cher du monde ?", labelEn: "Was he, in his time, the most expensive player in the world?", labelDe: "War er zu seiner Zeit der teuerste Spieler der Welt?", labelIt: "È stato, ai suoi tempi, il giocatore più costoso del mondo?", labelPt: "Foi, na sua época, o jogador mais caro do mundo?",
    predicate: (p) => ANEC_TRANSFERT_RECORD.has(p.name),
  },
  {
    id: "anec-transfert-100m", category: "anecdote",
    label: "A-t-il fait l'objet d'un transfert à plus de 100 millions d'euros ?", labelEn: "Was he involved in a transfer worth more than €100 million?", labelDe: "War er an einem Transfer für mehr als 100 Millionen Euro beteiligt?", labelIt: "È stato coinvolto in un trasferimento da oltre 100 milioni di euro?", labelPt: "Esteve envolvido numa transferência de mais de 100 milhões de euros?",
    predicate: (p) => ANEC_TRANSFERT_100M.has(p.name),
  },
  {
    id: "anec-fils-pro", category: "anecdote",
    label: "Est-il le fils d'un footballeur professionnel ?", labelEn: "Is he the son of a professional footballer?", labelDe: "Ist er der Sohn eines Profifußballers?", labelIt: "È figlio di un calciatore professionista?", labelPt: "É filho de um jogador profissional?",
    predicate: (p) => ANEC_FILS_PRO.has(p.name),
  },
  {
    id: "anec-entraineur", category: "anecdote",
    label: "Est-il devenu entraîneur après sa carrière de joueur ?", labelEn: "Did he become a manager after his playing career?", labelDe: "Wurde er nach seiner Spielerkarriere Trainer?", labelIt: "È diventato allenatore dopo la carriera da giocatore?", labelPt: "Virou treinador após a carreira de jogador?",
    predicate: (p) => ANEC_ENTRAINEUR.has(p.name),
  },
  {
    id: "anec-joue-40", category: "anecdote",
    label: "A-t-il joué jusqu'à 40 ans ou plus ?", labelEn: "Did he play until age 40 or beyond?", labelDe: "Hat er bis 40 oder länger gespielt?", labelIt: "Ha giocato fino a 40 anni o oltre?", labelPt: "Jogou até os 40 anos ou mais?",
    predicate: (p) => ANEC_JOUE_40.has(p.name),
  },
  {
    id: "anec-real-barca", category: "anecdote",
    label: "A-t-il joué à la fois au Real Madrid et au FC Barcelone ?", labelEn: "Has he played for both Real Madrid and FC Barcelona?", labelDe: "Hat er sowohl für Real Madrid als auch für den FC Barcelona gespielt?", labelIt: "Ha giocato sia nel Real Madrid sia nel Barcellona?", labelPt: "Jogou tanto pelo Real Madrid quanto pelo FC Barcelona?",
    predicate: (p) => playedFor(p, "Real Madrid") && playedFor(p, "Barcelona"),
  },
  {
    id: "anec-psg-om", category: "anecdote",
    label: "A-t-il joué à la fois au PSG et à l'Olympique de Marseille ?", labelEn: "Has he played for both PSG and Olympique de Marseille?", labelDe: "Hat er sowohl für PSG als auch für Olympique Marseille gespielt?", labelIt: "Ha giocato sia nel PSG sia nell'Olympique Marsiglia?", labelPt: "Jogou tanto pelo PSG quanto pelo Olympique de Marselha?",
    predicate: (p) => playedFor(p, "PSG") && playedFor(p, "Marseille"),
  },

  // Apparence physique / signe distinctif (départage de fin de partie)
  {
    id: "phys-protection", category: "physique",
    label: "A-t-il joué avec une protection sur le visage ou la tête (masque, casque, lunettes) ?", labelEn: "Has he played with face or head protection (mask, helmet, goggles)?", labelDe: "Hat er mit Gesichts- oder Kopfschutz gespielt (Maske, Helm, Brille)?", labelIt: "Ha giocato con una protezione al viso o alla testa (maschera, casco, occhiali)?", labelPt: "Jogou com proteção no rosto ou na cabeça (máscara, capacete, óculos)?",
    predicate: (p) => PHYS_PROTECTION.has(p.name),
  },
  {
    id: "phys-cicatrice", category: "physique",
    label: "A-t-il une cicatrice visible sur le visage ?", labelEn: "Does he have a visible scar on his face?", labelDe: "Hat er eine sichtbare Narbe im Gesicht?", labelIt: "Ha una cicatrice visibile sul viso?", labelPt: "Tem uma cicatriz visível no rosto?",
    predicate: (p) => PHYS_CICATRICE.has(p.name),
  },
  {
    id: "phys-afro", category: "physique",
    label: "Est-il reconnaissable à sa coupe afro ?", labelEn: "Is he recognizable by his afro haircut?", labelDe: "Ist er an seinem Afro-Haarschnitt erkennbar?", labelIt: "È riconoscibile per il suo taglio afro?", labelPt: "É reconhecível pelo seu cabelo black power?",
    predicate: (p) => PHYS_AFRO.has(p.name),
  },
  {
    id: "phys-mohawk", category: "physique",
    label: "A-t-il porté une crête (mohawk) ?", labelEn: "Has he worn a mohawk?", labelDe: "Hat er einen Irokesenschnitt getragen?", labelIt: "Ha portato una cresta (mohawk)?", labelPt: "Já usou um moicano?",
    predicate: (p) => PHYS_MOHAWK.has(p.name),
  },
  {
    id: "phys-dreads", category: "physique",
    label: "A-t-il porté de longues dreadlocks ?", labelEn: "Has he worn long dreadlocks?", labelDe: "Hat er lange Dreadlocks getragen?", labelIt: "Ha portato lunghi dreadlock?", labelPt: "Já usou dreadlocks longos?",
    predicate: (p) => PHYS_DREADS.has(p.name),
  },
  {
    id: "phys-cheveux-longs", category: "physique",
    label: "Est-il connu pour ses cheveux longs ?", labelEn: "Is he known for his long hair?", labelDe: "Ist er für seine langen Haare bekannt?", labelIt: "È noto per i suoi capelli lunghi?", labelPt: "É conhecido pelo cabelo comprido?",
    predicate: (p) => PHYS_CHEVEUX_LONGS.has(p.name),
  },
  {
    id: "phys-queue", category: "physique",
    label: "A-t-il porté une queue de cheval iconique ?", labelEn: "Has he worn an iconic ponytail?", labelDe: "Hat er einen ikonischen Pferdeschwanz getragen?", labelIt: "Ha portato una coda di cavallo iconica?", labelPt: "Já usou um rabo de cavalo icônico?",
    predicate: (p) => PHYS_QUEUE.has(p.name),
  },
  {
    id: "phys-barbe", category: "physique",
    label: "A-t-il une barbe très reconnaissable ?", labelEn: "Does he have a very recognizable beard?", labelDe: "Hat er einen sehr wiedererkennbaren Bart?", labelIt: "Ha una barba molto riconoscibile?", labelPt: "Tem uma barba muito reconhecível?",
    predicate: (p) => PHYS_BARBE.has(p.name),
  },
  {
    id: "phys-tatoue", category: "physique",
    label: "Est-il connu pour être très tatoué ?", labelEn: "Is he known for being heavily tattooed?", labelDe: "Ist er dafür bekannt, stark tätowiert zu sein?", labelIt: "È noto per essere molto tatuato?", labelPt: "É conhecido por ser muito tatuado?",
    predicate: (p) => PHYS_TATOUE.has(p.name),
  },
  {
    id: "phys-coiffure", category: "physique",
    label: "Change-t-il souvent de coiffure (coupes originales) ?", labelEn: "Does he often change haircuts (original styles)?", labelDe: "Wechselt er oft die Frisur (originelle Schnitte)?", labelIt: "Cambia spesso pettinatura (tagli originali)?", labelPt: "Muda muito de corte de cabelo (estilos originais)?",
    predicate: (p) => PHYS_COIFFURE.has(p.name),
  },
  {
    id: "phys-sourire", category: "physique",
    label: "Est-il célèbre pour son grand sourire ?", labelEn: "Is he famous for his big smile?", labelDe: "Ist er für sein großes Lächeln berühmt?", labelIt: "È famoso per il suo grande sorriso?", labelPt: "É famoso pelo seu grande sorriso?",
    predicate: (p) => PHYS_SOURIRE.has(p.name),
  },
  {
    id: "phys-chauve", category: "physique",
    label: "Est-il chauve ou dégarni ?", labelEn: "Is he bald or balding?", labelDe: "Ist er kahl oder hat eine Glatze?", labelIt: "È calvo o stempiato?", labelPt: "É careca ou está ficando careca?",
    predicate: (p) => PHYS_CHAUVE.has(p.name),
  },
  {
    id: "phys-petit", category: "physique",
    label: "Est-il de petit gabarit (1m70 ou moins) ?", labelEn: "Is he short (1.70m or less)?", labelDe: "Ist er klein (1,70 m oder weniger)?", labelIt: "È basso (1,70 m o meno)?", labelPt: "É baixo (1,70 m ou menos)?",
    predicate: (p) => PHYS_PETIT.has(p.name),
  },
  {
    id: "phys-grand", category: "physique",
    label: "Mesure-t-il plus d'1m90 (très grand) ?", labelEn: "Is he taller than 1.90m (very tall)?", labelDe: "Ist er größer als 1,90 m (sehr groß)?", labelIt: "È più alto di 1,90 m (molto alto)?", labelPt: "É mais alto que 1,90 m (muito alto)?",
    predicate: (p) => PHYS_GRAND.has(p.name),
  },
  {
    id: "phys-coupe-2002", category: "physique",
    label: "A-t-il arboré une coupe de cheveux culte à la Coupe du Monde 2002 ?", labelEn: "Did he sport a cult haircut at the 2002 World Cup?", labelDe: "Trug er bei der WM 2002 einen Kult-Haarschnitt?", labelIt: "Ha sfoggiato un taglio di capelli cult ai Mondiali 2002?", labelPt: "Exibiu um corte de cabelo cult na Copa de 2002?",
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
  const scored: { q: Question; score: number }[] = [];
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
      scored.push({ q, score });
    }
  }
  if (scored.length > 0) {
    const best = scored.reduce((a, b) => b.score > a.score ? b : a);
    // Variété : tirer au hasard parmi les questions dans les 85 % du meilleur score
    // → évite que Séville/Valence sortent systématiquement à chaque partie.
    const pool = scored.filter(c => c.score >= best.score * 0.85);
    return pool[Math.floor(Math.random() * pool.length)].q;
  }

  // Fallback : si on est bloqué par la rotation et rien trouvé, relâche
  if (blocked) {
    const fallback: { q: Question; score: number }[] = [];
    for (const q of QUESTIONS) {
      if (askedIds.has(q.id)) continue;
      const ent = scoreQuestion(q);
      if (ent <= 0) continue;
      fallback.push({ q, score: ent });
    }
    if (fallback.length > 0) {
      const best = fallback.reduce((a, b) => b.score > a.score ? b : a);
      const pool = fallback.filter(c => c.score >= best.score * 0.85);
      return pool[Math.floor(Math.random() * pool.length)].q;
    }
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
      // La pelouse éclairée de la charte, comme partout ailleurs dans l'app. Le
      // fond sombre à halo violet faisait de cet écran un monde à part, et sur
      // un fond plus sombre que l'encre aucun trait de la charte n'existe.
      background: fondCharte,
      // Contexte d'empilement pour le terrain (calque à zIndex -1).
      isolation: "isolate",
      paddingTop: "env(safe-area-inset-top)",
      paddingBottom: "env(safe-area-inset-bottom)",
    }}
  >
    {terrainCharte}

    {/* Mobile : bouton rond compact pour ne pas chevaucher le titre centré ;
        desktop : libellé complet. */}
    <button
      onClick={onClose}
      className="fixed top-3 right-3 z-[9001] flex items-center justify-center w-11 h-11 p-0 lg:w-auto lg:h-auto lg:gap-2 lg:px-4 lg:py-2"
      style={{ ...btn(G.nuit, G.white, 18), borderRadius: G.rayonS }}
      aria-label={tr("Quitter GOAT Guess","Quit GOAT Guess","GOAT Guess beenden","Esci da GOAT Guess","Sair do GOAT Guess")}
    >
      <span className="lg:hidden text-lg leading-none">←</span>
      <span className="hidden lg:inline">{tr("← QUITTER","← QUIT","← BEENDEN","← ESCI","← SAIR")}</span>
    </button>

    <div className="relative min-h-screen lg:min-h-screen container max-w-5xl mx-auto px-3 lg:px-6 py-2 lg:py-10">
      {/* Header branding */}
      <div className="text-center mb-2 lg:mb-8">
        <div className="inline-block px-3 py-1 mb-2 lg:mb-3" style={{ background: G.nuit, border: G.traitFin, borderRadius: G.rayonS, boxShadow: "2px 2px 0 " + G.encre }}>
          <span className="font-display text-[10px] tracking-[0.4em]" style={{ color: G.projecteur }}>
            🔮 GOAT GUESS
          </span>
        </div>
        <h1 className="hidden lg:block" style={{ ...posterText(58, G.white) }}>
          {tr("JE DEVINE TON JOUEUR","I'LL GUESS YOUR PLAYER","ICH ERRATE DEINEN SPIELER","INDOVINO IL TUO GIOCATORE","EU ADIVINHO SEU JOGADOR")}
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
              <div className="font-display text-[10px] tracking-[0.4em] text-[#F5C22B] mb-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">
                {tr("LE DEVIN","THE ORACLE","DAS ORAKEL","L'ORACOLO","O ORÁCULO")}
              </div>
              <div className="text-[11px] text-white/70 max-w-[260px] leading-snug italic text-balance">
                {tr("«\u00A0Pense à ton joueur. Je le lis dans ton esprit.\u00A0»","“Think of your player. I read your mind.”","„Denk an deinen Spieler. Ich lese deine Gedanken.“","«\u00A0Pensa al tuo giocatore. Te lo leggo nella mente.\u00A0»","“Pense no seu jogador. Eu leio sua mente.”")}
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
            <div className="font-display text-xs tracking-[0.4em] text-[#F5C22B] mb-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">
              {tr("LE DEVIN","THE ORACLE","DAS ORAKEL","L'ORACOLO","O ORÁCULO")}
            </div>
            <div className="text-[11px] text-white/70 max-w-[210px] leading-snug italic text-balance">
              {tr("«\u00A0Pense à ton joueur. Je le lis dans ton esprit.\u00A0»","“Think of your player. I read your mind.”","„Denk an deinen Spieler. Ich lese deine Gedanken.“","«\u00A0Pensa al tuo giocatore. Te lo leggo nella mente.\u00A0»","“Pense no seu jogador. Eu leio sua mente.”")}
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
  // « Fumée de génie » : nombre de réponses tranchées (oui/non). Chaque réponse
  // fait monter la barre de fumée ; un « je sais pas » ne la remplit pas.
  const [smokeSteps, setSmokeSteps] = useState(0);
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
    trackPlay("guess");
    setPhase("asking");
    setCandidates(initialPool);
    setAsked(new Set());
    setQuestionCount(0);
    setGuessCount(0);
    setRejectedGuesses(new Set());
    setLastCategories([]);
    setQaHistory([]);
    setSmokeSteps(0);
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
    // Préférer un joueur facile/moyen pour la devinette ; ne tomber sur un expert
    // qu'en dernier recours (évite de proposer des joueurs inconnus de l'utilisateur).
    const bestGuess = ranked.find(p => p.diff !== "expert") ?? ranked[0];
    if (ranked.length === 1) {
      setCurrentGuess(bestGuess);
      setPhase("guessing");
      return;
    }
    // On continue à questionner tant qu'une question discrimine encore les
    // candidats vivants — MÊME au-delà de MAX_QUESTIONS — pour converger vers
    // UN seul joueur. On ne devine que s'il ne reste qu'un candidat (ci-dessus),
    // qu'aucune question ne les sépare plus (nextQ === null), ou au garde-fou.
    const nextQ = qCount >= HARD_CAP ? null : pickQuestion(live, askedSet, lastCats);
    if (!nextQ) {
      setCurrentGuess(bestGuess);
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
    // Une réponse tranchée (oui/non) fait monter la fumée ; « je sais pas » non.
    if (ans !== "dunno") setSmokeSteps((s) => s + 1);
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
    if (removedQA.answer !== "dunno") setSmokeSteps((s) => Math.max(0, s - 1));
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
          smokeSteps={smokeSteps}
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
      {tr("Pense à un footballeur connu (actuel ou retraité).","Think of a famous footballer (current or retired).","Denk an einen bekannten Fußballer (aktiv oder ehemalig).","Pensa a un calciatore famoso (attuale o ritirato).","Pense num jogador famoso (atual ou aposentado).")}
    </p>
    <p className="text-white/60 text-xs lg:text-sm mb-4 lg:mb-8">
      {(() => { const l = getLang();
        if (l === "de") return <>Ich stelle <span className="text-white font-bold">so viele Fragen wie nötig</span>{" "}um ihn zu erraten (meist etwa zwanzig). Antworte <span className="font-bold" style={{ color: G.pelouse }}>ja</span>,{" "}<span className="font-bold" style={{ color: G.maillot }}>nein</span> oder{" "}<span className="text-white/70 font-bold">weiß nicht</span>.</>;
        if (l === "it") return <>Ti faccio <span className="text-white font-bold">tutte le domande necessarie</span>{" "}per indovinarlo (di solito una ventina). Rispondi <span className="font-bold" style={{ color: G.pelouse }}>sì</span>,{" "}<span className="font-bold" style={{ color: G.maillot }}>no</span> o{" "}<span className="text-white/70 font-bold">non so</span>.</>;
        if (l === "pt") return <>Eu faço <span className="text-white font-bold">quantas perguntas forem precisas</span>{" "}para adivinhar (geralmente umas vinte). Responda <span className="font-bold" style={{ color: G.pelouse }}>sim</span>,{" "}<span className="font-bold" style={{ color: G.maillot }}>não</span> ou{" "}<span className="text-white/70 font-bold">não sei</span>.</>;
        if (l === "en") return <>I'll ask <span className="text-white font-bold">as many questions as needed</span>{" "}to guess them (usually around twenty). Answer <span className="font-bold" style={{ color: G.pelouse }}>yes</span>,{" "}<span className="font-bold" style={{ color: G.maillot }}>no</span> or{" "}<span className="text-white/70 font-bold">not sure</span>.</>;
        return <>Je te pose <span className="text-white font-bold">autant de questions qu'il faut</span>{" "}pour le deviner (en général une vingtaine). Réponds <span className="font-bold" style={{ color: G.pelouse }}>oui</span>,{" "}<span className="font-bold" style={{ color: G.maillot }}>non</span> ou{" "}<span className="text-white/70 font-bold">je sais pas</span>.</>;
      })()}
    </p>

    <button
      onClick={onStart}
      className="goat-pulse inline-flex items-center gap-3 px-8 lg:px-10 py-3 lg:py-4"
      style={{ ...btn(G.projecteur, G.encre, 24) }}
    >
      <span className="text-xl">{"▶︎"}</span> {tr("COMMENCER","START","START","INIZIA","COMEÇAR")}
    </button>

    <p className="mt-4 text-xs text-white/40">
      {tr('Astuce : plus tu réponds précisément (évite les "sais pas"), mieux je devine.', 'Tip: the more precisely you answer (avoid "not sure"), the better I guess.', 'Tipp: Je genauer du antwortest (vermeide „weiß nicht"), desto besser errate ich.', 'Consiglio: più rispondi con precisione (evita i "non so"), meglio indovino.', 'Dica: quanto mais preciso você responde (evite "não sei"), melhor eu adivinho.')}
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
  smokeSteps,
}: {
  question: Question;
  count: number;
  max: number;
  remaining: number;
  onAnswer: (a: Answer) => void;
  onBack: () => void;
  canGoBack: boolean;
  qaHistory: Array<{ q: Question; answer: Answer }>;
  smokeSteps: number;
}) => {
  const overtime = count > max;
  const progress = Math.min(100, (count / max) * 100);
  // Remplissage de la fumée : ~16 réponses tranchées → barre pleine. On
  // plafonne à 96 % pour garder un soupçon de suspense jusqu'à la devinette.
  const SMOKE_TARGET = 16;
  const smokeFill = Math.min(96, (smokeSteps / SMOKE_TARGET) * 100);
  return (
    <div>
      {/* Compteur + barre de progression */}
      <div className="mb-3 lg:mb-6">
        <div className="flex items-center justify-between text-[10px] lg:text-xs mb-1 lg:mb-2">
          <span className="font-display tracking-widest text-white/50">
            {overtime ? `QUESTION ${count} · ${tr("PROLONGATIONS","EXTRA TIME","VERLÄNGERUNG","SUPPLEMENTARI","PRORROGAÇÃO")} 🔥` : `QUESTION ${count} / ${max}`}
          </span>
          <span className="text-white/40 tabular-nums">
            {(() => { const l = getLang(); const m = remaining > 1;
              if (l === "de") return `${remaining} Kandidat${m ? "en" : ""} übrig`;
              if (l === "it") return `${remaining} candidat${m ? "i" : "o"} rimast${m ? "i" : "o"}`;
              if (l === "pt") return `${remaining} candidato${m ? "s" : ""} restante${m ? "s" : ""}`;
              if (l === "en") return `${remaining} candidate${m ? "s" : ""} left`;
              return `${remaining} candidat${m ? "s" : ""} restant${m ? "s" : ""}`;
            })()}
          </span>
        </div>
        <div className="w-full overflow-hidden" style={{ height: 12, background: "rgba(8,17,9,.55)", border: G.traitFin, borderRadius: G.rayonS }}>
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${progress}%`, background: G.projecteur, borderRight: progress > 0 && progress < 100 ? G.traitFin : "none" }}
          />
        </div>
      </div>

      {/* Question — bannière dégradé orange→or façon THE PLUG/MERCATO */}
      <div
        key={question.id}
        className="goat-pop relative overflow-hidden min-h-[88px] lg:min-h-[200px] flex flex-col items-center justify-center text-center mb-3 lg:mb-6 px-4 lg:px-8 py-5 lg:py-8"
        style={{ background: G.nuit, border: G.trait, borderRadius: G.rayon, boxShadow: G.ombre }}
      >
        <div className="relative font-display text-[10px] lg:text-xs tracking-[0.45em] mb-1.5 lg:mb-3 flex items-center gap-1.5" style={{ color: G.projecteur }}>
          <span>🔮</span> QUESTION {count}
        </div>
        <h3 className="relative" style={{ ...posterText(30, G.white) }}>
          {qLabel(question)}
        </h3>
      </div>

      {/* Boutons réponse — plus hauts pour meilleur tap-target */}
      <div className="grid grid-cols-3 gap-2 lg:gap-3 mb-2 lg:mb-3">
        <button
          onClick={() => onAnswer("yes")}
          className="py-3 lg:py-6"
          style={{ ...btn(G.pelouse, G.encre, 20) }}
        >
          ✓ {tr("OUI","YES","JA","SÌ","SIM")}
        </button>
        <button
          onClick={() => onAnswer("dunno")}
          className="py-3 lg:py-6"
          style={{ ...btn(G.nuit, G.white, 16) }}
        >
          ? {tr("SAIS PAS","NOT SURE","WEISS NICHT","NON SO","NÃO SEI")}
        </button>
        <button
          onClick={() => onAnswer("no")}
          className="py-3 lg:py-6"
          style={{ ...btn(G.maillot, G.white, 20) }}
        >
          ✗ {tr("NON","NO","NEIN","NO","NÃO")}
        </button>
      </div>

      <div className="flex items-center justify-between mt-1 lg:mt-2 px-1 mb-2 lg:mb-4">
        {canGoBack ? (
          <button
            onClick={onBack}
            className="text-[10px] lg:text-xs text-white/60 hover:text-white tracking-widest transition-colors"
          >
            {tr("← précédent","← back","← zurück","← indietro","← voltar")}
          </button>
        ) : (
          <span />
        )}
        <button
          onClick={() => onAnswer("dunno")}
          className="text-[10px] lg:text-xs text-white/40 hover:text-white/70 tracking-widest transition-colors"
        >
          {tr("passer cette question →","skip this question →","diese Frage überspringen →","salta questa domanda →","pular esta pergunta →")}
        </button>
      </div>

      {/* Récap des déductions en cours — caché sur mobile pour tenir sur 1 écran */}
      <div className="hidden lg:block">
        <LiveDeductions history={qaHistory} />
      </div>

      {/* Barre de « fumée de génie » : chaque réponse tranchée la remplit un peu
          plus — le devin se rapproche de la réponse. Un « je sais pas » ne la
          fait pas monter. */}
      <div className="mt-3 lg:mt-5">
        <div className="flex items-center justify-between text-[9px] lg:text-[11px] mb-1 tracking-widest font-display text-white/45">
          <span>🔮 {tr("LE GÉNIE SE RAPPROCHE","THE GENIE CLOSES IN","DER GENIE KOMMT NÄHER","IL GENIO SI AVVICINA","O GÊNIO SE APROXIMA")}</span>
          <span className="tabular-nums" style={{ color: G.projecteur }}>{Math.round(smokeFill)}%</span>
        </div>
        <div className="relative h-3 lg:h-4 w-full overflow-hidden" style={{ background: "rgba(8,17,9,.55)", border: G.traitFin, borderRadius: G.rayonS }}>
          <div
            className="goat-smokebar-fill absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out"
            style={{ width: `${smokeFill}%` }}
          >
            {/* panache de fumée pulsant à la tête de la traînée */}
            <div className="goat-smokebar-head absolute top-1/2 right-0 h-6 w-6 lg:h-7 lg:w-7 rounded-full" aria-hidden />
          </div>
        </div>
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
          {tr("Le devin attend tes premières réponses pour cerner ton joueur…","The oracle awaits your first answers to zero in on your player…","Das Orakel wartet auf deine ersten Antworten, um deinen Spieler einzugrenzen…","L'oracolo aspetta le tue prime risposte per individuare il tuo giocatore…","O oráculo aguarda suas primeiras respostas para cercar seu jogador…")}
        </p>
      </div>
    );
  }
  const ansIcon = (a: Answer) =>
    a === "yes" ? "✓" : a === "no" ? "✗" : "?";
  const ansColor = (a: Answer) =>
    a === "yes" ? G.pelouse : a === "no" ? G.maillot : "rgba(255,255,255,0.45)";
  // On affiche en priorité les 6 dernières (les plus récentes en haut)
  const recent = [...history].reverse().slice(0, 6);
  return (
    <div className="mt-6 rounded-2xl bg-black/30 border border-white/10 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/[0.03]">
        <span className="font-display text-[10px] tracking-[0.3em] text-[#F5C22B]">
          🧠 {tr("CE QUE JE DÉDUIS","WHAT I'M DEDUCING","WAS ICH ABLEITE","COSA STO DEDUCENDO","O QUE ESTOU DEDUZINDO")}
        </span>
        <span className="text-[10px] text-white/40 tabular-nums">
          {history.length} {history.length > 1 ? tr("indices","clues","Hinweise","indizi","pistas") : tr("indice","clue","Hinweis","indizio","pista")}
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
          + {history.length - 6} {history.length - 6 > 1 ? tr("autres plus haut","more above","weitere oben","altri sopra","outros acima") : tr("autre plus haut","more above","weitere oben","altro sopra","outro acima")}
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
    <div className="inline-block px-3 py-1 rounded-full bg-[#0E2C17] border-2 border-[#081109] mb-2 lg:mb-3">
      <span className="font-display text-[10px] tracking-[0.35em] text-[#F5C22B]">
        🔮 {tr("MA DEVINETTE","MY GUESS","MEINE VERMUTUNG","LA MIA IPOTESI","MEU PALPITE")}
      </span>
    </div>
    <div className="font-display text-xl lg:text-3xl tracking-wider text-white mb-2 lg:mb-5 leading-tight">
      {tr("JE PARIE QUE C'EST...","I BET IT'S...","ICH WETTE, ES IST...","SCOMMETTO CHE È...","APOSTO QUE É...")}
    </div>

    <PlayerRevealCard player={guess} accent={G.projecteur} />

    <p className="text-white/60 text-sm mt-3 mb-3 lg:mt-5 lg:mb-4 tracking-wide">
      {tr("Alors, j'ai bon ?","So, am I right?","Und, hab ich recht?","Allora, ho indovinato?","E aí, acertei?")}
    </p>

    <div className="grid grid-cols-2 gap-3">
      <button
        onClick={onCorrect}
        className="py-3 lg:py-4"
        style={{ ...btn(G.pelouse, G.encre, 20) }}
      >
        ✓ {tr("OUI !","YES!","JA!","SÌ!","SIM!")}
      </button>
      <button
        onClick={onWrong}
        className="py-3 lg:py-4"
        style={{ ...btn(G.maillot, G.white, 20) }}
      >
        ✗ {tr("NON","NO","NEIN","NO","NÃO")}
      </button>
    </div>

    {canGoBack && (
      <button
        onClick={onBack}
        className="mt-3 text-xs text-white/50 hover:text-white tracking-widest transition-colors"
      >
        {tr("← revenir à la question précédente","← back to the previous question","← zurück zur vorherigen Frage","← torna alla domanda precedente","← voltar à pergunta anterior")}
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
            background: [G.projecteur, G.pelouse, G.ciel, G.maillot][i % 4],
            animation: `goat-confetti ${2 + (i % 4) * 0.4}s linear ${(i % 5) * 0.15}s forwards`,
          }}
        />
      ))}
    </div>

    <div className="text-4xl mb-2 animate-in zoom-in duration-300">🔮</div>
    <div className="font-display text-5xl lg:text-6xl tracking-wider mb-1 leading-none text-white drop-shadow-[0_6px_24px_rgba(168,85,247,0.55)]">
      {tr("JE T'AI EU !","GOT YOU!","ERWISCHT!","TI HO BECCATO!","PEGUEI VOCÊ!")}
    </div>
    <p className="text-white/60 text-sm mb-5 tracking-wide">
      {tr("Tu pensais bien à...","You were thinking of...","Du hast gedacht an...","Stavi pensando a...","Você estava pensando em...")}
    </p>

    <PlayerRevealCard player={guess} accent={G.projecteur} />

    <QaRecap history={qaHistory} accent={G.projecteur} />

    <div className="grid grid-cols-2 gap-3 mt-6">
      <button
        onClick={onRestart}
        className="py-4"
        style={{ ...btn(G.projecteur, G.encre, 20) }}
      >
        {"▶︎"} {tr("REJOUER","PLAY AGAIN","NOCHMAL SPIELEN","GIOCA ANCORA","JOGAR DE NOVO")}
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
    a === "yes"
      ? tr("✓ Oui", "✓ Yes", "✓ Ja", "✓ Sì", "✓ Sim")
      : a === "no"
      ? tr("✗ Non", "✗ No", "✗ Nein", "✗ No", "✗ Não")
      : tr("? Sais pas", "? Not sure", "? Weiß nicht", "? Non so", "? Não sei");
  const ansColor = (a: Answer) =>
    a === "yes" ? G.pelouse : a === "no" ? G.maillot : "rgba(255,255,255,0.5)";
  return (
    <div className="mt-5 text-left">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white/80 transition-colors"
      >
        <span className="font-display text-xs tracking-[0.25em]">
          📋 {(() => { const l = getLang(); const S = history.length > 1 ? "S" : "";
            if (l === "de") return `ÜBERSICHT DER ${history.length} FRAGE${history.length > 1 ? "N" : ""}`;
            if (l === "it") return `RIEPILOGO DELLE ${history.length} DOMANDE`;
            if (l === "pt") return `RESUMO DAS ${history.length} PERGUNTA${S}`;
            if (l === "en") return `RECAP OF THE ${history.length} QUESTION${S}`;
            return `RÉCAP DES ${history.length} QUESTION${S}`;
          })()}
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
          💡 {tr("Si tu pensais à un autre joueur, regarde où ta réponse a éliminé le bon","If you were thinking of another player, look for where your answer eliminated the right one","Wenn du an einen anderen Spieler gedacht hast, schau, wo deine Antwort den richtigen ausgeschlossen hat","Se stavi pensando a un altro giocatore, guarda dove la tua risposta ha eliminato quello giusto","Se você estava pensando em outro jogador, veja onde sua resposta eliminou o certo")}
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
      {tr("BIEN JOUÉ","WELL PLAYED","GUT GESPIELT","BEN GIOCATO","BEM JOGADO")}
    </div>
    <p className="text-white/60 text-sm mb-5 tracking-wide">
      {tr("Tu m'as eu — je n'ai pas trouvé ton joueur.","You got me — I couldn't find your player.","Du hast mich — ich konnte deinen Spieler nicht finden.","Mi hai battuto — non ho trovato il tuo giocatore.","Você me pegou — não achei seu jogador.")}
    </p>

    {tried.length > 0 && (
      <div className="mb-4 inline-block px-4 py-2" style={{ background: G.nuit, border: G.trait, borderRadius: G.rayon, boxShadow: G.ombre }}>
        <div className="text-[10px] tracking-[0.3em] mb-1" style={{ color: G.maillot }}>
          {tr("MES DEVINETTES RATÉES","MY FAILED GUESSES","MEINE FEHLVERSUCHE","I MIEI TENTATIVI FALLITI","MEUS PALPITES ERRADOS")}
        </div>
        <div className="text-xs text-white/70">
          {tried.slice(0, 3).join(" · ")}
          {tried.length > 3 ? " · …" : ""}
        </div>
      </div>
    )}

    {shortlist.length > 0 && (
      <div className="mb-5 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent p-4">
        <div className="font-display text-[10px] tracking-[0.3em] text-[#F5C22B] mb-3">
          🤔 {tr("PEUT-ÊTRE UN DE CES JOUEURS ?","MAYBE ONE OF THESE PLAYERS?","VIELLEICHT EINER DIESER SPIELER?","FORSE UNO DI QUESTI GIOCATORI?","TALVEZ UM DESTES JOGADORES?")}
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          {shortlist.map((p) => (
            <span
              key={p.name}
              className="px-3 py-1.5 rounded-xl bg-[#0E2C17] border-2 border-[#081109] text-white text-sm font-bold hover:bg-[#2A9B4E] transition-colors"
            >
              {p.name}
            </span>
          ))}
        </div>
      </div>
    )}

    <p className="text-[11px] text-white/35 mb-5 max-w-sm mx-auto leading-relaxed">
      {tr("Si ton joueur n'apparaît nulle part, il n'est peut-être pas dans ma base.","If your player doesn't appear anywhere, they may not be in my database.","Wenn dein Spieler nirgends auftaucht, ist er vielleicht nicht in meiner Datenbank.","Se il tuo giocatore non appare da nessuna parte, forse non è nel mio database.","Se seu jogador não aparece em lugar nenhum, talvez não esteja na minha base.")}
    </p>

    <QaRecap history={qaHistory} accent={G.projecteur} />

    <div className="grid grid-cols-2 gap-3 mt-6">
      <button
        onClick={onRestart}
        className="py-4"
        style={{ ...btn(G.projecteur, G.encre, 20) }}
      >
        {"▶︎"} {tr("REVANCHE","REMATCH","REVANCHE","RIVINCITA","REVANCHE")}
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
  "Indonésie":"🇮🇩","Iran":"🇮🇷","Irak":"🇮🇶","Irlande du Nord":"🇬🇧","Irlande":"🇮🇪","Islande":"🇮🇸","Israël":"🇮🇱",
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
// Palette par rareté façon FUT : or (stars), argent (moyens), bronze (experts)
const TIERS = {
  facile: {
    edge: "linear-gradient(160deg,#FFE9A8 0%,#F5D67B 30%,#C9992F 70%,#8A6420 100%)",
    body: "linear-gradient(180deg,#3A2E14 0%,#241C0C 55%,#140F06 100%)",
    ink: "#F5D67B",
    glow: "rgba(245,214,123,0.55)",
    inner: "radial-gradient(circle at 50% 22%, rgba(245,214,123,0.14), transparent 55%)",
  },
  moyen: {
    edge: "linear-gradient(160deg,#F4F6FA 0%,#C9CFDA 35%,#8E96A6 70%,#5C6470 100%)",
    body: "linear-gradient(180deg,#2C3038 0%,#1B1E24 55%,#0E1013 100%)",
    ink: "#D9DEE8",
    glow: "rgba(217,222,232,0.45)",
    inner: "radial-gradient(circle at 50% 22%, rgba(217,222,232,0.12), transparent 55%)",
  },
  expert: {
    edge: "linear-gradient(160deg,#E8B584 0%,#C98D50 35%,#96602C 70%,#5E3B1A 100%)",
    body: "linear-gradient(180deg,#33241A 0%,#201610 55%,#120C08 100%)",
    ink: "#E2A96F",
    glow: "rgba(226,169,111,0.5)",
    inner: "radial-gradient(circle at 50% 22%, rgba(226,169,111,0.12), transparent 55%)",
  },
} as const;

// Couleurs de maillot du club le plus récent connu (on remonte la carrière)
const kitColorsOf = (p: Player): [string, string] | null => {
  for (let i = p.clubs.length - 1; i >= 0; i--) {
    const c = (CLUB_COLORS as Record<string, [string, string]>)[p.clubs[i]];
    if (c) return c;
  }
  return null;
};

const initialsOf = (name: string) =>
  name.split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

// Forme bouclier FUT (bord dégradé simulé par double clip-path)
const CARD_SHAPE =
  "polygon(50% 0%, 78% 3%, 94% 10%, 94% 80%, 74% 93%, 50% 100%, 26% 93%, 6% 80%, 6% 10%, 22% 3%)";

// Volutes de fumée et étincelles de la révélation (positions fixes)
const SMOKE_PUFFS = [
  { left: "6%", bottom: "8%", size: 110, dx: "-30px", delay: "0s", dur: "1.5s", o: 0.85 },
  { left: "55%", bottom: "5%", size: 140, dx: "35px", delay: "0.08s", dur: "1.7s", o: 0.8 },
  { left: "28%", bottom: "16%", size: 120, dx: "-15px", delay: "0.16s", dur: "1.6s", o: 0.75 },
  { left: "68%", bottom: "22%", size: 100, dx: "45px", delay: "0.22s", dur: "1.8s", o: 0.7 },
  { left: "12%", bottom: "40%", size: 90, dx: "-40px", delay: "0.3s", dur: "1.7s", o: 0.6 },
  { left: "60%", bottom: "46%", size: 110, dx: "30px", delay: "0.36s", dur: "1.9s", o: 0.6 },
  { left: "36%", bottom: "60%", size: 95, dx: "0px", delay: "0.42s", dur: "1.8s", o: 0.5 },
  { left: "20%", bottom: "72%", size: 80, dx: "-25px", delay: "0.5s", dur: "1.9s", o: 0.5 },
  { left: "40%", bottom: "30%", size: 150, dx: "10px", delay: "0.04s", dur: "1.9s", o: 0.9 },
  { left: "18%", bottom: "24%", size: 130, dx: "-35px", delay: "0.12s", dur: "2s", o: 0.85 },
  { left: "58%", bottom: "34%", size: 135, dx: "40px", delay: "0.2s", dur: "2.1s", o: 0.8 },
];
const SPARKS = [
  { left: "10%", bottom: "18%", delay: "0.1s", dur: "1.4s" },
  { left: "82%", bottom: "14%", delay: "0.25s", dur: "1.5s" },
  { left: "45%", bottom: "34%", delay: "0.4s", dur: "1.6s" },
  { left: "70%", bottom: "56%", delay: "0.55s", dur: "1.5s" },
  { left: "24%", bottom: "66%", delay: "0.7s", dur: "1.6s" },
  { left: "55%", bottom: "82%", delay: "0.85s", dur: "1.4s" },
];

// Avatar pictogramme par poste (SVG pur, aucune personne réelle représentée)
const PositionAvatar = ({ position }: { position?: string }) => {
  const st = { stroke: "#FFFFFF", strokeWidth: 3.4, strokeLinecap: "round" as const, fill: "none" };
  const cls = "w-16 h-16 drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)]";
  switch (position) {
    case "gardien":
      // Bras levés vers le ballon
      return (
        <svg viewBox="0 0 48 48" className={cls} aria-hidden>
          <circle cx="24" cy="5.5" r="3.2" fill="#FFFFFF" />
          <circle cx="24" cy="15" r="4.5" fill="#FFFFFF" />
          <path d="M24 21 L24 31" {...st} />
          <path d="M24 22 L11 11" {...st} />
          <path d="M24 22 L37 11" {...st} />
          <path d="M24 31 L16 43" {...st} />
          <path d="M24 31 L32 43" {...st} />
        </svg>
      );
    case "defenseur":
      // Position d'interception, bras écartés bas, appui large
      return (
        <svg viewBox="0 0 48 48" className={cls} aria-hidden>
          <circle cx="24" cy="9" r="4.5" fill="#FFFFFF" />
          <path d="M24 15 L24 28" {...st} />
          <path d="M24 19 L10 26" {...st} />
          <path d="M24 19 L38 26" {...st} />
          <path d="M24 28 L13 42" {...st} />
          <path d="M24 28 L35 42" {...st} />
        </svg>
      );
    case "milieu":
      // Course balle au pied
      return (
        <svg viewBox="0 0 48 48" className={cls} aria-hidden>
          <circle cx="26" cy="9" r="4.5" fill="#FFFFFF" />
          <path d="M26 15 L24 28" {...st} />
          <path d="M25 19 L15 25" {...st} />
          <path d="M25 19 L35 13" {...st} />
          <path d="M24 28 L15 40" {...st} />
          <path d="M24 28 L32 38" {...st} />
          <circle cx="36" cy="41" r="3.2" fill="#FFFFFF" />
        </svg>
      );
    default:
      // Attaquant : frappe, jambe tendue vers le ballon
      return (
        <svg viewBox="0 0 48 48" className={cls} aria-hidden>
          <circle cx="20" cy="9" r="4.5" fill="#FFFFFF" />
          <path d="M20 15 L24 27" {...st} />
          <path d="M21 19 L10 23" {...st} />
          <path d="M21 19 L31 12" {...st} />
          <path d="M24 27 L17 41" {...st} />
          <path d="M24 27 L38 33" {...st} />
          <circle cx="43" cy="35" r="3.2" fill="#FFFFFF" />
        </svg>
      );
  }
};

const PlayerRevealCard = ({
  player,
  accent = G.projecteur,
}: {
  player: Player;
  accent?: string;
}) => {
  const rating = futRating(player);
  const pos = POS_ABBR[player.positions[0]] || "?";
  const flag = flagOf(player.nationalities[0]);
  const tier = TIERS[player.diff] || TIERS.expert;
  const gold = tier.ink;
  const kit = kitColorsOf(player);
  return (
    <div className="relative inline-block w-full max-w-[330px] my-1 lg:my-2">
      {/* Fumée magique + étincelles à la révélation */}
      <div className="pointer-events-none absolute -inset-10 z-20 overflow-visible" aria-hidden>
        {SMOKE_PUFFS.map((p, i) => (
          <div
            key={i}
            className="goat-smoke"
            style={{ left: p.left, bottom: p.bottom, width: p.size, height: p.size, "--dx": p.dx, "--delay": p.delay, "--dur": p.dur, "--o": String(p.o) } as CSSProperties}
          />
        ))}
        {SPARKS.map((s, i) => (
          <span key={`s${i}`} className="goat-spark text-base" style={{ left: s.left, bottom: s.bottom, "--delay": s.delay, "--dur": s.dur } as CSSProperties}>
            ✨
          </span>
        ))}
      </div>
      <div className="goat-materialize relative w-full">
      {/* Halo pulsé derrière la carte */}
      <div
        className="goat-halo absolute inset-0 blur-3xl"
        style={{ background: `radial-gradient(circle at 50% 38%, ${tier.glow}, transparent 70%)` }}
        aria-hidden
      />
      {/* Bord dégradé or→violet, forme bouclier */}
      <div
        className="relative mx-auto"
        style={{
          clipPath: CARD_SHAPE,
          padding: 3,
          background: tier.edge,
        }}
      >
        <div
          className="relative px-8 pt-8 pb-14"
          style={{
            clipPath: CARD_SHAPE,
            background: kit
              ? `linear-gradient(rgba(10,8,16,0.58), rgba(10,8,16,0.58)), linear-gradient(165deg, ${kit[0]} 0%, ${kit[0]} 48%, ${kit[1]} 52%, ${kit[1]} 100%)`
              : tier.body,
          }}
        >
          {/* Lueur douce derrière le médaillon */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: tier.inner }}
            aria-hidden
          />
          {/* Bloc haut : médaillon centré, note/poste/drapeau en colonne à gauche */}
          <div className="relative h-28 mt-2">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col items-center leading-none" style={{ color: gold }}>
              <div className="font-display text-4xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">{rating}</div>
              <div className="font-display text-xs tracking-[0.25em] mt-1">{pos}</div>
              <div className="text-2xl mt-1.5 leading-none">{flag}</div>
            </div>
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full flex items-center justify-center"
              style={{
                // Disque sombre contrasté sur la carte aux couleurs du club
                background: "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.08), rgba(5,4,10,0.72) 74%)",
                border: `2px solid ${gold}66`,
                boxShadow: "inset 0 6px 20px rgba(0,0,0,0.6), 0 8px 24px rgba(0,0,0,0.45)",
              }}
            >
              <PositionAvatar position={player.positions[0]} />
            </div>
          </div>
          {/* Nom entre filets dorés */}
          <div className="relative mt-4 text-center">
            <div className="mx-auto h-px w-4/5" style={{ background: `linear-gradient(90deg, transparent, ${gold}99, transparent)` }} />
            <div className="font-display text-2xl lg:text-3xl tracking-wider text-white leading-tight py-1.5 px-2 break-words drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
              {player.name}
            </div>
            <div className="mx-auto h-px w-4/5" style={{ background: `linear-gradient(90deg, transparent, ${gold}99, transparent)` }} />
          </div>
          {/* Nation + carrière */}
          <div className="relative mt-2.5 text-center">
            <div className="text-[10px] tracking-[0.3em] text-white/75 mb-2">
              {flag} {(player.nationalities[0] || "—").toUpperCase()}
            </div>
            {/* Carrières longues : débuts + clubs récents (les plus parlants),
                le reste résumé par « +N » au centre. */}
            <div className="flex flex-wrap gap-1 justify-center px-1">
              {(player.clubs.length <= 4
                ? player.clubs
                : [...player.clubs.slice(0, 2), `+${player.clubs.length - 4}`, ...player.clubs.slice(-2)]
              ).map((c, i) =>
                c.startsWith("+") ? (
                  <span key={`more-${i}`} className="px-1.5 py-0.5 rounded-md text-[9px] text-white/45 border border-white/10 bg-black/20 self-center">
                    {c}
                  </span>
                ) : (
                  <span
                    key={c}
                    className={`px-2 py-0.5 rounded-md ${player.clubs.length > 3 ? "text-[9px]" : "text-[10px]"} bg-black/35 border border-white/15 text-white/90`}
                  >
                    {c}
                  </span>
                )
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};


export default GoatGuess;
