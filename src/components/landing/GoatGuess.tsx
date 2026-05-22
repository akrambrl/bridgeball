import { useEffect, useMemo, useState } from "react";
import { PLAYERS, RETIRED_PLAYERS } from "../../players.jsx";

type Player = {
  name: string;
  clubs: string[];
  nationalities: string[];
  positions: string[];
  diff: "facile" | "moyen" | "expert";
};

type QCategory = "cont" | "nat" | "league" | "club" | "pos" | "profile";

type Question = {
  id: string;
  label: string;
  category: QCategory;
  predicate: (p: Player) => boolean;
};

const MAX_QUESTIONS = 25;
const MAX_GUESSES = 5;

const POS_GARDIEN = "gardien";
const POS_ATT = "attaquant";
const POS_MIL = "milieu";
const isDefender = (p: Player) =>
  p.positions.some((x) => x === "défenseur" || x === "defenseur");
const hasPos = (p: Player, pos: string) => p.positions.includes(pos);
const hasNat = (p: Player, nat: string) => p.nationalities.includes(nat);
const playedFor = (p: Player, club: string) => p.clubs.includes(club);
const playedForAny = (p: Player, clubs: string[]) =>
  p.clubs.some((c) => clubs.includes(c));

const PREMIER_LEAGUE = [
  "Manchester United",
  "Manchester City",
  "Liverpool",
  "Chelsea",
  "Arsenal",
  "Tottenham",
  "Newcastle",
  "Aston Villa",
  "West Ham",
  "Everton",
  "Leicester",
  "Leeds",
  "Southampton",
  "Crystal Palace",
  "Wolverhampton",
  "Brighton",
  "Fulham",
  "Brentford",
];
const LIGA = [
  "Real Madrid",
  "Barcelona",
  "Atletico Madrid",
  "Sevilla",
  "Valencia",
  "Villarreal",
  "Real Sociedad",
  "Athletic Bilbao",
  "Real Betis",
  "Celta Vigo",
  "Getafe",
  "Espanyol",
];
const SERIE_A = [
  "Juventus FC",
  "AC Milan",
  "Inter Milan",
  "AS Roma",
  "Napoli",
  "Lazio",
  "Atalanta",
  "Fiorentina",
  "Torino",
  "Sampdoria",
  "Udinese",
  "Bologna",
];
const LIGUE_1 = [
  "PSG",
  "Marseille",
  "Lyon",
  "Monaco",
  "Lille",
  "Rennes",
  "Bordeaux",
  "Saint-Étienne",
  "Nice",
  "Nantes",
  "Toulouse",
  "Lens",
  "Strasbourg",
  "Montpellier",
];
const BUNDESLIGA = [
  "Bayern Munich",
  "Borussia Dortmund",
  "RB Leipzig",
  "Bayer Leverkusen",
  "Borussia Mönchengladbach",
  "Schalke 04",
  "VfB Stuttgart",
  "Eintracht Frankfurt",
  "Werder Bremen",
  "Hamburg",
  "Wolfsburg",
  "Hertha Berlin",
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

const QUESTIONS: Question[] = [
  // Postes
  { id: "is-gk", category: "pos", label: "Est-ce un gardien de but ?", predicate: (p) => hasPos(p, POS_GARDIEN) },
  { id: "is-def", category: "pos", label: "Est-ce un défenseur ?", predicate: isDefender },
  { id: "is-mid", category: "pos", label: "Est-ce un milieu de terrain ?", predicate: (p) => hasPos(p, POS_MIL) },
  { id: "is-att", category: "pos", label: "Est-ce un attaquant ?", predicate: (p) => hasPos(p, POS_ATT) },
  {
    id: "is-offensive", category: "pos",
    label: "Joue-t-il à un poste offensif (milieu ou attaquant) ?",
    predicate: (p) => hasPos(p, POS_MIL) || hasPos(p, POS_ATT),
  },
  {
    id: "is-defensive", category: "pos",
    label: "Joue-t-il à un poste défensif (gardien ou défenseur) ?",
    predicate: (p) => hasPos(p, POS_GARDIEN) || isDefender(p),
  },
  {
    id: "is-versatile", category: "pos",
    label: "Peut-il jouer à plusieurs postes différents ?",
    predicate: (p) => p.positions.length >= 2,
  },

  // Nationalités majeures
  { id: "nat-fr", category: "nat", label: "Est-il français ?", predicate: (p) => hasNat(p, "France") },
  { id: "nat-es", category: "nat", label: "Est-il espagnol ?", predicate: (p) => hasNat(p, "Espagne") },
  { id: "nat-en", category: "nat", label: "Est-il anglais ?", predicate: (p) => hasNat(p, "Angleterre") },
  { id: "nat-de", category: "nat", label: "Est-il allemand ?", predicate: (p) => hasNat(p, "Allemagne") },
  { id: "nat-it", category: "nat", label: "Est-il italien ?", predicate: (p) => hasNat(p, "Italie") },
  { id: "nat-pt", category: "nat", label: "Est-il portugais ?", predicate: (p) => hasNat(p, "Portugal") },
  { id: "nat-nl", category: "nat", label: "Est-il néerlandais ?", predicate: (p) => hasNat(p, "Pays-Bas") },
  { id: "nat-be", category: "nat", label: "Est-il belge ?", predicate: (p) => hasNat(p, "Belgique") },
  { id: "nat-hr", category: "nat", label: "Est-il croate ?", predicate: (p) => hasNat(p, "Croatie") },
  { id: "nat-ar", category: "nat", label: "Est-il argentin ?", predicate: (p) => hasNat(p, "Argentine") },
  { id: "nat-br", category: "nat", label: "Est-il brésilien ?", predicate: (p) => hasNat(p, "Brésil") },
  { id: "nat-uy", category: "nat", label: "Est-il uruguayen ?", predicate: (p) => hasNat(p, "Uruguay") },
  { id: "nat-co", category: "nat", label: "Est-il colombien ?", predicate: (p) => hasNat(p, "Colombie") },
  { id: "nat-ma", category: "nat", label: "Est-il marocain ?", predicate: (p) => hasNat(p, "Maroc") },
  { id: "nat-dz", category: "nat", label: "Est-il algérien ?", predicate: (p) => hasNat(p, "Algérie") },
  { id: "nat-sn", category: "nat", label: "Est-il sénégalais ?", predicate: (p) => hasNat(p, "Sénégal") },
  { id: "nat-ci", category: "nat", label: "Est-il ivoirien ?", predicate: (p) => hasNat(p, "Côte d'Ivoire") },
  { id: "nat-cm", category: "nat", label: "Est-il camerounais ?", predicate: (p) => hasNat(p, "Cameroun") },
  { id: "nat-ng", category: "nat", label: "Est-il nigérian ?", predicate: (p) => hasNat(p, "Nigeria") },
  { id: "nat-gh", category: "nat", label: "Est-il ghanéen ?", predicate: (p) => hasNat(p, "Ghana") },

  // Continents
  {
    id: "cont-eu", category: "cont",
    label: "Vient-il d'un pays européen ?",
    predicate: (p) => p.nationalities.some((n) => EUROPE.has(n)),
  },
  {
    id: "cont-sa", category: "cont",
    label: "Vient-il d'un pays sud-américain ?",
    predicate: (p) => p.nationalities.some((n) => SOUTH_AMERICA.has(n)),
  },
  {
    id: "cont-af", category: "cont",
    label: "Vient-il d'un pays africain ?",
    predicate: (p) => p.nationalities.some((n) => AFRICA.has(n)),
  },

  // Clubs majeurs
  { id: "club-real", category: "club", label: "A-t-il joué au Real Madrid ?", predicate: (p) => playedFor(p, "Real Madrid") },
  { id: "club-barca", category: "club", label: "A-t-il joué au FC Barcelone ?", predicate: (p) => playedFor(p, "Barcelona") },
  { id: "club-atm", category: "club", label: "A-t-il joué à l'Atlético Madrid ?", predicate: (p) => playedFor(p, "Atletico Madrid") },
  { id: "club-sevilla", category: "club", label: "A-t-il joué au FC Séville ?", predicate: (p) => playedFor(p, "Sevilla") },
  { id: "club-mu", category: "club", label: "A-t-il joué à Manchester United ?", predicate: (p) => playedFor(p, "Manchester United") },
  { id: "club-mc", category: "club", label: "A-t-il joué à Manchester City ?", predicate: (p) => playedFor(p, "Manchester City") },
  { id: "club-liv", category: "club", label: "A-t-il joué à Liverpool ?", predicate: (p) => playedFor(p, "Liverpool") },
  { id: "club-che", category: "club", label: "A-t-il joué à Chelsea ?", predicate: (p) => playedFor(p, "Chelsea") },
  { id: "club-ars", category: "club", label: "A-t-il joué à Arsenal ?", predicate: (p) => playedFor(p, "Arsenal") },
  { id: "club-tot", category: "club", label: "A-t-il joué à Tottenham ?", predicate: (p) => playedFor(p, "Tottenham") },
  { id: "club-juv", category: "club", label: "A-t-il joué à la Juventus ?", predicate: (p) => playedFor(p, "Juventus FC") },
  { id: "club-milan", category: "club", label: "A-t-il joué à l'AC Milan ?", predicate: (p) => playedFor(p, "AC Milan") },
  { id: "club-inter", category: "club", label: "A-t-il joué à l'Inter Milan ?", predicate: (p) => playedFor(p, "Inter Milan") },
  { id: "club-roma", category: "club", label: "A-t-il joué à l'AS Roma ?", predicate: (p) => playedFor(p, "AS Roma") },
  { id: "club-napoli", category: "club", label: "A-t-il joué à Naples ?", predicate: (p) => playedFor(p, "Napoli") },
  { id: "club-bayern", category: "club", label: "A-t-il joué au Bayern Munich ?", predicate: (p) => playedFor(p, "Bayern Munich") },
  { id: "club-bvb", category: "club", label: "A-t-il joué au Borussia Dortmund ?", predicate: (p) => playedFor(p, "Borussia Dortmund") },
  { id: "club-psg", category: "club", label: "A-t-il joué au PSG ?", predicate: (p) => playedFor(p, "PSG") },
  { id: "club-om", category: "club", label: "A-t-il joué à l'Olympique de Marseille ?", predicate: (p) => playedFor(p, "Marseille") },
  { id: "club-ol", category: "club", label: "A-t-il joué à l'Olympique Lyonnais ?", predicate: (p) => playedFor(p, "Lyon") },
  { id: "club-monaco", category: "club", label: "A-t-il joué à l'AS Monaco ?", predicate: (p) => playedFor(p, "Monaco") },
  { id: "club-lille", category: "club", label: "A-t-il joué au LOSC Lille ?", predicate: (p) => playedFor(p, "Lille") },
  { id: "club-ajax", category: "club", label: "A-t-il joué à l'Ajax Amsterdam ?", predicate: (p) => playedFor(p, "Ajax Amsterdam") },
  { id: "club-porto", category: "club", label: "A-t-il joué au FC Porto ?", predicate: (p) => playedFor(p, "Porto") },
  { id: "club-benfica", category: "club", label: "A-t-il joué au Benfica ?", predicate: (p) => playedFor(p, "Benfica") },
  { id: "club-sporting", category: "club", label: "A-t-il joué au Sporting CP ?", predicate: (p) => playedFor(p, "Sporting CP") },
  { id: "club-newcastle", category: "club", label: "A-t-il joué à Newcastle ?", predicate: (p) => playedFor(p, "Newcastle") },

  // Ligues
  { id: "lg-pl", category: "league", label: "A-t-il joué en Premier League anglaise ?", predicate: (p) => playedForAny(p, PREMIER_LEAGUE) },
  { id: "lg-liga", category: "league", label: "A-t-il joué en Liga espagnole ?", predicate: (p) => playedForAny(p, LIGA) },
  { id: "lg-seriea", category: "league", label: "A-t-il joué en Serie A italienne ?", predicate: (p) => playedForAny(p, SERIE_A) },
  { id: "lg-l1", category: "league", label: "A-t-il joué en Ligue 1 française ?", predicate: (p) => playedForAny(p, LIGUE_1) },
  { id: "lg-bl", category: "league", label: "A-t-il joué en Bundesliga allemande ?", predicate: (p) => playedForAny(p, BUNDESLIGA) },

  // Clubs additionnels (deuxième couche, ~30-100 joueurs chacun)
  { id: "club-leverkusen", category: "club", label: "A-t-il joué au Bayer Leverkusen ?", predicate: (p) => playedFor(p, "Bayer Leverkusen") },
  { id: "club-leipzig", category: "club", label: "A-t-il joué au RB Leipzig ?", predicate: (p) => playedFor(p, "RB Leipzig") },
  { id: "club-schalke", category: "club", label: "A-t-il joué à Schalke 04 ?", predicate: (p) => playedFor(p, "Schalke 04") },
  { id: "club-wolfsburg", category: "club", label: "A-t-il joué à Wolfsburg ?", predicate: (p) => playedFor(p, "Wolfsburg") },
  { id: "club-frankfurt", category: "club", label: "A-t-il joué à l'Eintracht Frankfurt ?", predicate: (p) => playedFor(p, "Eintracht Frankfurt") },
  { id: "club-stuttgart", category: "club", label: "A-t-il joué à Stuttgart ?", predicate: (p) => playedFor(p, "Stuttgart") },
  { id: "club-lazio", category: "club", label: "A-t-il joué à la Lazio ?", predicate: (p) => playedFor(p, "Lazio") },
  { id: "club-atalanta", category: "club", label: "A-t-il joué à l'Atalanta ?", predicate: (p) => playedFor(p, "Atalanta BC") },
  { id: "club-fiorentina", category: "club", label: "A-t-il joué à la Fiorentina ?", predicate: (p) => playedFor(p, "Fiorentina") },
  { id: "club-villarreal", category: "club", label: "A-t-il joué à Villarreal ?", predicate: (p) => playedFor(p, "Villarreal") },
  { id: "club-valencia", category: "club", label: "A-t-il joué à Valence ?", predicate: (p) => playedFor(p, "Valencia") },
  { id: "club-sociedad", category: "club", label: "A-t-il joué à la Real Sociedad ?", predicate: (p) => playedFor(p, "Real Sociedad") },
  { id: "club-betis", category: "club", label: "A-t-il joué au Real Betis ?", predicate: (p) => playedFor(p, "Real Betis") },
  { id: "club-westham", category: "club", label: "A-t-il joué à West Ham ?", predicate: (p) => playedFor(p, "West Ham") },
  { id: "club-everton", category: "club", label: "A-t-il joué à Everton ?", predicate: (p) => playedFor(p, "Everton") },
  { id: "club-aston", category: "club", label: "A-t-il joué à Aston Villa ?", predicate: (p) => playedFor(p, "Aston Villa") },
  { id: "club-fulham", category: "club", label: "A-t-il joué à Fulham ?", predicate: (p) => playedFor(p, "Fulham") },
  { id: "club-nice", category: "club", label: "A-t-il joué à l'OGC Nice ?", predicate: (p) => playedFor(p, "Nice") },
  { id: "club-rennes", category: "club", label: "A-t-il joué au Stade Rennais ?", predicate: (p) => playedFor(p, "Rennes") },
  { id: "club-bordeaux", category: "club", label: "A-t-il joué aux Girondins de Bordeaux ?", predicate: (p) => playedFor(p, "Bordeaux") },
  { id: "club-saintet", category: "club", label: "A-t-il joué à l'AS Saint-Étienne ?", predicate: (p) => playedForAny(p, ["Saint-Étienne", "Saint-Etienne"]) },
  { id: "club-nantes", category: "club", label: "A-t-il joué au FC Nantes ?", predicate: (p) => playedFor(p, "Nantes") },
  { id: "club-lens", category: "club", label: "A-t-il joué au RC Lens ?", predicate: (p) => playedFor(p, "Lens") },
  { id: "club-feyenoord", category: "club", label: "A-t-il joué à Feyenoord ?", predicate: (p) => playedFor(p, "Feyenoord") },
  { id: "club-psv", category: "club", label: "A-t-il joué au PSV Eindhoven ?", predicate: (p) => playedFor(p, "PSV Eindhoven") },
  { id: "club-galata", category: "club", label: "A-t-il joué à Galatasaray ?", predicate: (p) => playedFor(p, "Galatasaray") },
  { id: "club-fener", category: "club", label: "A-t-il joué à Fenerbahçe ?", predicate: (p) => playedFor(p, "Fenerbahce") },
  { id: "club-celtic", category: "club", label: "A-t-il joué au Celtic Glasgow ?", predicate: (p) => playedFor(p, "Celtic") },
  { id: "club-boca", category: "club", label: "A-t-il joué à Boca Juniors ?", predicate: (p) => playedFor(p, "Boca Juniors") },
  { id: "club-river", category: "club", label: "A-t-il joué à River Plate ?", predicate: (p) => playedFor(p, "River Plate") },

  // Nationalités additionnelles
  { id: "nat-dk", category: "nat", label: "Est-il danois ?", predicate: (p) => hasNat(p, "Danemark") },
  { id: "nat-se", category: "nat", label: "Est-il suédois ?", predicate: (p) => hasNat(p, "Suède") },
  { id: "nat-no", category: "nat", label: "Est-il norvégien ?", predicate: (p) => hasNat(p, "Norvège") },
  { id: "nat-ch", category: "nat", label: "Est-il suisse ?", predicate: (p) => hasNat(p, "Suisse") },
  { id: "nat-pl", category: "nat", label: "Est-il polonais ?", predicate: (p) => hasNat(p, "Pologne") },
  { id: "nat-cz", category: "nat", label: "Est-il tchèque ?", predicate: (p) => hasNat(p, "Tchéquie") },
  { id: "nat-rs", category: "nat", label: "Est-il serbe ?", predicate: (p) => hasNat(p, "Serbie") },
  { id: "nat-tr", category: "nat", label: "Est-il turc ?", predicate: (p) => hasNat(p, "Turquie") },
  { id: "nat-gr", category: "nat", label: "Est-il grec ?", predicate: (p) => hasNat(p, "Grèce") },
  { id: "nat-mx", category: "nat", label: "Est-il mexicain ?", predicate: (p) => hasNat(p, "Mexique") },
  { id: "nat-jp", category: "nat", label: "Est-il japonais ?", predicate: (p) => hasNat(p, "Japon") },
  { id: "nat-us", category: "nat", label: "Est-il américain (USA) ?", predicate: (p) => hasNat(p, "États-Unis") },
  { id: "nat-ml", category: "nat", label: "Est-il malien ?", predicate: (p) => hasNat(p, "Mali") },

  // Statut / profil
  {
    id: "retired", category: "profile",
    label: "Est-il retraité (n'a plus joué récemment) ?",
    predicate: (p) => RETIRED_PLAYERS.has(p.name),
  },
  {
    id: "nomad", category: "profile",
    label: "A-t-il joué dans 5 clubs différents ou plus ?",
    predicate: (p) => p.clubs.length >= 5,
  },
  {
    id: "very-nomad", category: "profile",
    label: "A-t-il eu une carrière de globe-trotter (7 clubs ou plus) ?",
    predicate: (p) => p.clubs.length >= 7,
  },
  {
    id: "loyal", category: "profile",
    label: "Est-ce un joueur fidèle (1 ou 2 clubs dans toute sa carrière) ?",
    predicate: (p) => p.clubs.length <= 2,
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
  "profile",
];

const pickQuestion = (
  candidates: Player[],
  askedIds: Set<string>,
  lastCategories: QCategory[]
) => {
  const last = lastCategories[lastCategories.length - 1];
  const last2 = lastCategories[lastCategories.length - 2];
  const blocked = last && last === last2 ? last : null;

  for (const stage of STAGE_ORDER) {
    if (blocked === stage) continue; // skip cette étape pour ce tour
    let best: { q: Question; score: number } | null = null;
    for (const q of QUESTIONS) {
      if (q.category !== stage) continue;
      if (askedIds.has(q.id)) continue;
      let yes = 0;
      for (const p of candidates) if (q.predicate(p)) yes++;
      const ent = entropy(yes, candidates.length);
      if (ent <= 0) continue;
      // Pénalité si on enchaîne 2 questions de la même catégorie
      const score = ent * (q.category === last ? 0.55 : 1);
      if (!best || score > best.score) best = { q, score };
    }
    if (best) return best.q;
  }

  // Fallback : si le blocage a écarté tout, on relâche la rotation.
  if (blocked) {
    for (const stage of STAGE_ORDER) {
      let best: { q: Question; score: number } | null = null;
      for (const q of QUESTIONS) {
        if (q.category !== stage) continue;
        if (askedIds.has(q.id)) continue;
        let yes = 0;
        for (const p of candidates) if (q.predicate(p)) yes++;
        const ent = entropy(yes, candidates.length);
        if (ent <= 0) continue;
        if (!best || ent > best.score) best = { q, score: ent };
      }
      if (best) return best.q;
    }
  }
  return null;
};

const pickGuess = (candidates: Player[]): Player => {
  // On choisit le candidat le plus "connu" (facile > moyen > expert)
  const order = { facile: 0, moyen: 1, expert: 2 } as const;
  return [...candidates].sort(
    (a, b) => order[a.diff] - order[b.diff]
  )[0];
};

type Answer = "yes" | "no" | "dunno";

type Phase = "intro" | "asking" | "guessing" | "won" | "lost";

type Props = {
  onClose: () => void;
};

export const GoatGuess = ({ onClose }: Props) => (
  <div
    role="dialog"
    aria-modal="true"
    className="fixed inset-0 z-[9000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
  >
    <div
      className="pointer-events-none absolute inset-0 opacity-40"
      style={{
        background:
          "radial-gradient(circle at 30% 20%, #C084FC40 0%, transparent 50%), radial-gradient(circle at 70% 80%, #00E67630 0%, transparent 55%)",
      }}
      aria-hidden
    />

    <button
      onClick={onClose}
      className="fixed top-3 right-3 z-[9001] flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white font-display text-sm tracking-widest transition-colors"
      aria-label="Fermer GOAT Guess"
    >
      ✕ FERMER
    </button>

    <div className="relative w-full max-w-2xl max-h-[95vh] overflow-y-auto rounded-3xl bg-[#0F2017] border-2 border-white/10 p-6 lg:p-10 shadow-2xl">
      <GoatGuessGame onClose={onClose} />
    </div>
  </div>
);

const GoatGuessGame = ({ onClose }: { onClose: () => void }) => {
  // Pool initial : tous les joueurs de la base (le pickGuess privilégie
  // ensuite les joueurs facile > moyen > expert, donc l'app devine en
  // priorité les stars en cas d'ambiguïté).
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

  const startGame = () => {
    setPhase("asking");
    setCandidates(initialPool);
    setAsked(new Set());
    setQuestionCount(0);
    setGuessCount(0);
    setRejectedGuesses(new Set());
    setLastCategories([]);
    const q = pickQuestion(initialPool, new Set(), []);
    setCurrentQuestion(q);
  };

  const goToGuess = (pool: Player[]) => {
    const available = pool.filter((p) => !rejectedGuesses.has(p.name));
    if (available.length === 0) {
      setPhase("lost");
      return;
    }
    setCurrentGuess(pickGuess(available));
    setPhase("guessing");
  };

  // Backstop : si on entre en phase "asking" sans question courante (ne devrait
  // arriver qu'au tout début), on en choisit une — ou on devine s'il n'en
  // reste aucune de discriminante.
  useEffect(() => {
    if (phase !== "asking" || currentQuestion) return;
    const q = pickQuestion(candidates, asked, lastCategories);
    if (q) {
      setCurrentQuestion(q);
    } else {
      const available = candidates.filter((p) => !rejectedGuesses.has(p.name));
      if (available.length === 0) {
        setPhase("lost");
      } else {
        setCurrentGuess(pickGuess(available));
        setPhase("guessing");
      }
    }
  }, [phase, currentQuestion, candidates, asked, rejectedGuesses, lastCategories]);

  const answerQuestion = (ans: Answer) => {
    if (!currentQuestion) return;
    const nextAsked = new Set(asked);
    nextAsked.add(currentQuestion.id);

    let nextCandidates = candidates;
    if (ans === "yes") {
      nextCandidates = candidates.filter((p) => currentQuestion.predicate(p));
    } else if (ans === "no") {
      nextCandidates = candidates.filter((p) => !currentQuestion.predicate(p));
    }
    // "dunno" → on ne filtre pas

    // Filtre les déjà-rejetés
    nextCandidates = nextCandidates.filter(
      (p) => !rejectedGuesses.has(p.name)
    );

    const nextCount = questionCount + 1;
    const nextLastCats = [...lastCategories, currentQuestion.category].slice(-2);
    setAsked(nextAsked);
    setQuestionCount(nextCount);
    setLastCategories(nextLastCats);

    if (nextCandidates.length === 0) {
      setCandidates(nextCandidates);
      setPhase("lost");
      return;
    }
    // On devine si : un seul candidat, OU on a atteint la limite de questions
    if (nextCandidates.length === 1 || nextCount >= MAX_QUESTIONS) {
      setCandidates(nextCandidates);
      goToGuess(nextCandidates);
      return;
    }

    // Sinon, on cherche une question qui peut encore discriminer le set.
    // Si plus aucune question utile (entropie = 0 partout), on devine.
    const nextQ = pickQuestion(nextCandidates, nextAsked, nextLastCats);
    setCandidates(nextCandidates);
    if (!nextQ) {
      goToGuess(nextCandidates);
    } else {
      setCurrentQuestion(nextQ);
    }
  };

  const onGuessCorrect = () => setPhase("won");

  const onGuessWrong = () => {
    if (!currentGuess) return;
    const nextRejected = new Set(rejectedGuesses);
    nextRejected.add(currentGuess.name);
    const remaining = candidates.filter((p) => !nextRejected.has(p.name));
    const nextGuessCount = guessCount + 1;
    setRejectedGuesses(nextRejected);
    setGuessCount(nextGuessCount);
    setCandidates(remaining);

    // Plus aucun candidat ou quota de devinettes atteint → on abandonne
    if (remaining.length === 0 || nextGuessCount >= MAX_GUESSES) {
      setPhase("lost");
      return;
    }

    // Si peu de candidats restants OU plus de questions disponibles : on
    // enchaîne directement la devinette suivante (top-N successif).
    if (remaining.length <= 3 || questionCount >= MAX_QUESTIONS) {
      setCurrentGuess(pickGuess(remaining));
      setPhase("guessing");
      return;
    }

    // Sinon, on repose une question pour mieux discriminer le set restant.
    const nextQ = pickQuestion(remaining, asked, lastCategories);
    if (!nextQ) {
      setCurrentGuess(pickGuess(remaining));
      setPhase("guessing");
    } else {
      setCurrentQuestion(nextQ);
      setPhase("asking");
    }
  };

  return (
    <div>
      <div className="text-center mb-6">
        <div className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-[#C084FC]/20 to-[#FFC93C]/20 border border-white/10 mb-3">
          <span className="font-display text-[10px] tracking-[0.4em] text-white/80">
            🔮 GOAT GUESS
          </span>
        </div>
        <div className="font-display text-3xl lg:text-4xl tracking-wider text-white">
          JE DEVINE TON JOUEUR
        </div>
      </div>

      {phase === "intro" && <IntroView onStart={startGame} />}
      {phase === "asking" && currentQuestion && (
        <AskingView
          question={currentQuestion}
          count={questionCount + 1}
          max={MAX_QUESTIONS}
          remaining={candidates.length}
          onAnswer={answerQuestion}
        />
      )}
      {phase === "guessing" && currentGuess && (
        <GuessingView
          guess={currentGuess}
          onCorrect={onGuessCorrect}
          onWrong={onGuessWrong}
        />
      )}
      {phase === "won" && currentGuess && (
        <WonView guess={currentGuess} onRestart={startGame} onClose={onClose} />
      )}
      {phase === "lost" && (
        <LostView
          onRestart={startGame}
          onClose={onClose}
          shortlist={candidates.filter((p) => !rejectedGuesses.has(p.name)).slice(0, 8)}
          tried={Array.from(rejectedGuesses)}
        />
      )}
    </div>
  );
};

const IntroView = ({ onStart }: { onStart: () => void }) => (
  <div className="text-center">
    <div className="text-6xl mb-5">🔮</div>
    <p className="text-white/80 text-base lg:text-lg mb-3">
      Pense à un footballeur connu (actuel ou retraité).
    </p>
    <p className="text-white/60 text-sm mb-8">
      Je vais te poser jusqu'à <span className="text-white font-bold">20 questions</span>{" "}
      pour le deviner. Réponds <span className="text-[#00E676] font-bold">oui</span>,{" "}
      <span className="text-[#FF3D6E] font-bold">non</span> ou{" "}
      <span className="text-white/70 font-bold">je sais pas</span>.
    </p>

    <button
      onClick={onStart}
      className="goat-pulse inline-flex items-center gap-3 px-10 py-4 rounded-2xl bg-gradient-to-r from-[#C084FC] to-[#FF8A2A] text-[#1A0F00] font-display text-2xl tracking-widest hover:scale-[1.03] active:scale-[0.98] transition-transform"
    >
      <span className="text-xl">▶</span> COMMENCER
    </button>

    <p className="mt-4 text-xs text-white/40">
      Astuce : plus tu réponds précisément (évite les "sais pas"), mieux je devine.
    </p>
  </div>
);

const AskingView = ({
  question,
  count,
  max,
  remaining,
  onAnswer,
}: {
  question: Question;
  count: number;
  max: number;
  remaining: number;
  onAnswer: (a: Answer) => void;
}) => {
  const progress = (count / max) * 100;
  return (
    <div>
      {/* Compteur + barre de progression */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-display tracking-widest text-white/50">
            QUESTION {count} / {max}
          </span>
          <span className="text-white/40 tabular-nums">
            {remaining} candidat{remaining > 1 ? "s" : ""} restant{remaining > 1 ? "s" : ""}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#C084FC] to-[#FF8A2A] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="min-h-[120px] flex items-center justify-center mb-8 px-2">
        <h3 className="font-display text-2xl lg:text-3xl tracking-wide text-white text-center leading-tight">
          {question.label}
        </h3>
      </div>

      {/* Boutons réponse */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <button
          onClick={() => onAnswer("yes")}
          className="py-4 rounded-2xl bg-[#00E676] hover:bg-[#00C966] text-[#0A1410] font-display text-xl tracking-widest hover:scale-[1.03] active:scale-[0.97] transition-transform"
        >
          ✓ OUI
        </button>
        <button
          onClick={() => onAnswer("dunno")}
          className="py-4 rounded-2xl border-2 border-white/10 bg-white/[0.03] hover:bg-white/[0.07] text-white/80 font-display text-base tracking-widest transition-colors"
        >
          ? SAIS PAS
        </button>
        <button
          onClick={() => onAnswer("no")}
          className="py-4 rounded-2xl bg-[#FF3D6E] hover:bg-[#E62E5E] text-white font-display text-xl tracking-widest hover:scale-[1.03] active:scale-[0.97] transition-transform"
        >
          ✗ NON
        </button>
      </div>

      <button
        onClick={() => onAnswer("dunno")}
        className="block mx-auto mt-2 text-xs text-white/40 hover:text-white/70 tracking-widest transition-colors"
      >
        passer cette question →
      </button>
    </div>
  );
};

const GuessingView = ({
  guess,
  onCorrect,
  onWrong,
}: {
  guess: Player;
  onCorrect: () => void;
  onWrong: () => void;
}) => (
  <div className="text-center">
    <div className="inline-block px-3 py-1 rounded-full bg-[#FFC93C]/15 border border-[#FFC93C]/30 mb-3">
      <span className="font-display text-[10px] tracking-[0.35em] text-[#FFC93C]">
        🔮 MA DEVINETTE
      </span>
    </div>
    <div className="font-display text-2xl lg:text-3xl tracking-wider text-white mb-5 leading-tight">
      JE PARIE QUE C'EST...
    </div>

    <PlayerRevealCard player={guess} accent="#C084FC" />

    <p className="text-white/60 text-sm mt-5 mb-4 tracking-wide">
      Alors, j'ai bon ?
    </p>

    <div className="grid grid-cols-2 gap-3">
      <button
        onClick={onCorrect}
        className="py-4 rounded-2xl bg-gradient-to-r from-[#00C966] to-[#00E676] text-[#0A1410] font-display text-xl tracking-widest hover:scale-[1.03] active:scale-[0.97] transition-transform shadow-[0_8px_24px_rgba(0,230,118,0.35)]"
      >
        ✓ OUI !
      </button>
      <button
        onClick={onWrong}
        className="py-4 rounded-2xl bg-gradient-to-r from-[#FF3D6E] to-[#E62E5E] text-white font-display text-xl tracking-widest hover:scale-[1.03] active:scale-[0.97] transition-transform shadow-[0_8px_24px_rgba(255,61,110,0.35)]"
      >
        ✗ NON
      </button>
    </div>
  </div>
);

const WonView = ({
  guess,
  onRestart,
  onClose,
}: {
  guess: Player;
  onRestart: () => void;
  onClose: () => void;
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

    <div className="text-7xl mb-3 animate-in zoom-in duration-300">🎉</div>
    <div className="font-display text-5xl lg:text-6xl tracking-wider mb-1 leading-none bg-gradient-to-r from-[#C084FC] via-[#FFC93C] to-[#C084FC] bg-clip-text text-transparent">
      JE T'AI EU !
    </div>
    <p className="text-white/60 text-sm mb-5 tracking-wide">
      Tu pensais bien à...
    </p>

    <PlayerRevealCard player={guess} accent="#C084FC" />

    <div className="grid grid-cols-2 gap-3 mt-6">
      <button
        onClick={onRestart}
        className="py-4 rounded-2xl bg-gradient-to-r from-[#FF8A2A] to-[#FFC93C] text-[#1A0F00] font-display text-lg tracking-widest hover:scale-[1.02] active:scale-[0.97] transition-transform shadow-[0_8px_24px_rgba(255,201,60,0.4)]"
      >
        ▶ REJOUER
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

const LostView = ({
  onRestart,
  onClose,
  shortlist,
  tried,
}: {
  onRestart: () => void;
  onClose: () => void;
  shortlist: Player[];
  tried: string[];
}) => (
  <div className="text-center">
    <div className="text-7xl mb-3">🙏</div>
    <div className="font-display text-5xl lg:text-6xl tracking-wider mb-1 leading-none bg-gradient-to-r from-[#C084FC] via-[#FFC93C] to-[#C084FC] bg-clip-text text-transparent">
      BIEN JOUÉ
    </div>
    <p className="text-white/60 text-sm mb-5 tracking-wide">
      Tu m'as eu — je n'ai pas trouvé ton joueur.
    </p>

    {tried.length > 0 && (
      <div className="mb-4 inline-block px-4 py-2 rounded-xl bg-[#FF3D6E]/10 border border-[#FF3D6E]/30">
        <div className="text-[10px] tracking-[0.3em] text-[#FF3D6E] mb-1">
          MES DEVINETTES RATÉES
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
          🤔 PEUT-ÊTRE UN DE CES JOUEURS ?
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
      Si ton joueur n'apparaît nulle part, il n'est peut-être pas dans ma base.
    </p>

    <div className="grid grid-cols-2 gap-3">
      <button
        onClick={onRestart}
        className="py-4 rounded-2xl bg-gradient-to-r from-[#C084FC] to-[#FF8A2A] text-[#1A0F00] font-display text-lg tracking-widest hover:scale-[1.02] active:scale-[0.97] transition-transform shadow-[0_8px_24px_rgba(192,132,252,0.4)]"
      >
        ▶ REVANCHE
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

const PlayerRevealCard = ({
  player,
  accent = "#FFC93C",
}: {
  player: Player;
  accent?: string;
}) => (
  <div className="relative inline-block my-2 animate-in zoom-in-95 duration-500">
    <div
      className="absolute inset-0 blur-3xl opacity-50 rounded-3xl"
      style={{ background: accent }}
      aria-hidden
    />
    <div
      className="relative rounded-3xl p-5 lg:p-6 min-w-[260px] max-w-[340px] border-2 shadow-2xl"
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.4) 100%), linear-gradient(135deg, #1A2A20 0%, #0A1410 100%)",
        borderColor: `${accent}80`,
        boxShadow: `0 20px 50px -10px ${accent}40, inset 0 1px 0 rgba(255,255,255,0.1)`,
      }}
    >
      {/* Coin "GOAT" stylisé */}
      <div
        className="absolute top-3 right-3 px-2 py-0.5 rounded-md font-display text-[9px] tracking-[0.3em]"
        style={{ background: accent, color: "#1A0F00" }}
      >
        GOAT
      </div>

      {/* Avatar / ballon */}
      <div className="text-5xl mb-3">⚽</div>

      {/* Nom du joueur */}
      <div className="font-display text-2xl lg:text-3xl tracking-wider text-white mb-3 leading-tight break-words">
        {player.name}
      </div>

      {/* Drapeau + nationalité */}
      <div className="mb-3">
        <div className="text-[9px] tracking-[0.3em] text-white/40 mb-1">
          NATION
        </div>
        <div
          className="font-display text-sm tracking-wide"
          style={{ color: accent }}
        >
          {player.nationalities[0] || "—"}
        </div>
      </div>

      {/* Postes */}
      <div className="mb-3">
        <div className="text-[9px] tracking-[0.3em] text-white/40 mb-1">
          POSTE{player.positions.length > 1 ? "S" : ""}
        </div>
        <div className="flex flex-wrap gap-1">
          {player.positions.map((p) => (
            <span
              key={p}
              className="px-2 py-0.5 rounded-md text-[11px] bg-white/10 text-white/90 uppercase"
            >
              {p}
            </span>
          ))}
        </div>
      </div>

      {/* Clubs (max 6) */}
      <div>
        <div className="text-[9px] tracking-[0.3em] text-white/40 mb-1">
          CARRIÈRE
        </div>
        <div className="flex flex-wrap gap-1">
          {player.clubs.slice(0, 6).map((c) => (
            <span
              key={c}
              className="px-2 py-0.5 rounded-md text-[10px] bg-black/40 border border-white/10 text-white/80"
            >
              {c}
            </span>
          ))}
          {player.clubs.length > 6 && (
            <span className="px-2 py-0.5 rounded-md text-[10px] text-white/40">
              +{player.clubs.length - 6}
            </span>
          )}
        </div>
      </div>
    </div>
  </div>
);


export default GoatGuess;
