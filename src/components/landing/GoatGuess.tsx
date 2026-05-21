import { useEffect, useMemo, useState } from "react";
import { PLAYERS, RETIRED_PLAYERS } from "../../players.jsx";

type Player = {
  name: string;
  clubs: string[];
  nationalities: string[];
  positions: string[];
  diff: "facile" | "moyen" | "expert";
};

type QCategory = "pos" | "nat" | "club" | "league" | "profile";

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
    id: "cont-eu", category: "nat",
    label: "Vient-il d'un pays européen ?",
    predicate: (p) => p.nationalities.some((n) => EUROPE.has(n)),
  },
  {
    id: "cont-sa", category: "nat",
    label: "Vient-il d'un pays sud-américain ?",
    predicate: (p) => p.nationalities.some((n) => SOUTH_AMERICA.has(n)),
  },
  {
    id: "cont-af", category: "nat",
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

// Choisit la prochaine question en maximisant l'entropie, mais avec une
// pénalité contre la répétition de catégorie : si on vient d'en poser 2
// d'affilée dans la même catégorie, on bloque cette catégorie pour ce tour.
// Si la précédente est de la même catégorie, on applique une pénalité ×0.55.
// Ça force l'algo à alterner postes / nation / club / ligue / profil au lieu
// de balayer mécaniquement tous les clubs d'une même ligue.
const pickQuestion = (
  candidates: Player[],
  askedIds: Set<string>,
  lastCategories: QCategory[]
) => {
  const last = lastCategories[lastCategories.length - 1];
  const last2 = lastCategories[lastCategories.length - 2];
  const blocked = last && last === last2 ? last : null;

  let best: { q: Question; score: number } | null = null;
  for (const q of QUESTIONS) {
    if (askedIds.has(q.id)) continue;
    if (blocked && q.category === blocked) continue;
    let yes = 0;
    for (const p of candidates) if (q.predicate(p)) yes++;
    const ent = entropy(yes, candidates.length);
    if (ent <= 0) continue;
    const penalty = q.category === last ? 0.55 : 1;
    const score = ent * penalty;
    if (!best || score > best.score) best = { q, score };
  }
  // Fallback : si la pénalité a bloqué toutes les questions valides
  // (très rare), on relâche la contrainte de catégorie.
  if (!best && blocked) {
    for (const q of QUESTIONS) {
      if (askedIds.has(q.id)) continue;
      let yes = 0;
      for (const p of candidates) if (q.predicate(p)) yes++;
      const ent = entropy(yes, candidates.length);
      if (ent <= 0) continue;
      if (!best || ent > best.score) best = { q, score: ent };
    }
  }
  return best?.q ?? null;
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

export const GoatGuess = ({ onClose }: Props) => {
  const [mode, setMode] = useState<null | "akinator" | "reverse">(null);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
    >
      {/* Halo violet/cyan magique */}
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
        {mode === null && <ModeMenu onPick={setMode} />}
        {mode === "akinator" && <AkinatorMode onBack={() => setMode(null)} />}
        {mode === "reverse" && <ReverseMode onBack={() => setMode(null)} />}
      </div>
    </div>
  );
};

const ModeMenu = ({
  onPick,
}: {
  onPick: (mode: "akinator" | "reverse") => void;
}) => (
  <div className="text-center">
    <div className="font-display text-xs tracking-[0.4em] text-[#C084FC] mb-2">
      🔮 GOAT GUESS
    </div>
    <div className="font-display text-3xl lg:text-4xl tracking-wider text-white mb-2">
      CHOISIS TON MODE
    </div>
    <p className="text-white/50 text-sm mb-8">
      Deux façons de jouer — qui devine qui ?
    </p>

    <div className="grid gap-4">
      <button
        onClick={() => onPick("akinator")}
        className="group text-left rounded-2xl border-2 border-[#C084FC]/30 bg-gradient-to-br from-[#C084FC]/10 to-transparent p-5 hover:border-[#C084FC] hover:bg-[#C084FC]/15 transition-all"
      >
        <div className="flex items-center gap-4">
          <div className="text-4xl">🧠</div>
          <div className="flex-1">
            <div className="font-display text-xl tracking-wider text-white mb-1">
              JE DEVINE TON JOUEUR
            </div>
            <div className="text-xs text-white/60">
              Pense à un footballeur. Je te pose des questions pour le trouver.
            </div>
          </div>
          <div className="text-[#C084FC] text-2xl group-hover:translate-x-1 transition-transform">
            →
          </div>
        </div>
      </button>

      <button
        onClick={() => onPick("reverse")}
        className="group text-left rounded-2xl border-2 border-[#FFC93C]/30 bg-gradient-to-br from-[#FFC93C]/10 to-transparent p-5 hover:border-[#FFC93C] hover:bg-[#FFC93C]/15 transition-all"
      >
        <div className="flex items-center gap-4">
          <div className="text-4xl">🎯</div>
          <div className="flex-1">
            <div className="font-display text-xl tracking-wider text-white mb-1">
              DEVINE MON JOUEUR
            </div>
            <div className="text-xs text-white/60">
              Je choisis un footballeur. Pose-moi 20 questions pour le trouver.
            </div>
          </div>
          <div className="text-[#FFC93C] text-2xl group-hover:translate-x-1 transition-transform">
            →
          </div>
        </div>
      </button>
    </div>
  </div>
);

const AkinatorMode = ({ onBack }: { onBack: () => void }) => {
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

    // Devinette si peu de candidats restants ou max questions atteint
    if (nextCandidates.length === 0) {
      setCandidates(nextCandidates);
      setPhase("lost");
      return;
    }
    if (nextCandidates.length <= 2 || nextCount >= MAX_QUESTIONS) {
      setCandidates(nextCandidates);
      goToGuess(nextCandidates);
      return;
    }

    // Choisir la question suivante
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
      <button
        onClick={onBack}
        className="mb-4 text-xs text-white/40 hover:text-white/80 tracking-widest transition-colors"
      >
        ← MODES
      </button>

      <div className="text-center mb-6">
        <div className="font-display text-xs tracking-[0.4em] text-[#C084FC] mb-2">
          🧠 AKINATOR
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
        <WonView guess={currentGuess} onRestart={startGame} onClose={onBack} />
      )}
      {phase === "lost" && (
        <LostView
          onRestart={startGame}
          onClose={onBack}
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
    <div className="font-display text-xs tracking-[0.3em] text-[#FFC93C] mb-4">
      JE PARIE QUE C'EST...
    </div>

    {/* Carte joueur */}
    <div className="relative inline-block mb-6">
      <div className="absolute inset-0 blur-2xl opacity-40 rounded-3xl bg-gradient-to-br from-[#C084FC] to-[#FFC93C]" />
      <div className="relative rounded-3xl bg-gradient-to-br from-[#1A2A20] to-[#0A1410] border-2 border-[#FFC93C]/40 p-6 lg:p-8 min-w-[300px]">
        <div className="text-5xl mb-3">⚽</div>
        <div className="font-display text-3xl lg:text-4xl tracking-wider text-white mb-3 leading-tight">
          {guess.name}
        </div>
        <div className="flex flex-wrap justify-center gap-1.5 text-xs">
          {guess.nationalities.slice(0, 2).map((n) => (
            <span key={n} className="px-2 py-0.5 rounded-full bg-white/10 text-white/70">
              {n}
            </span>
          ))}
          {guess.positions.slice(0, 2).map((p) => (
            <span key={p} className="px-2 py-0.5 rounded-full bg-[#C084FC]/20 text-[#C084FC]">
              {p}
            </span>
          ))}
        </div>
      </div>
    </div>

    <p className="text-white/70 text-base mb-6">C'est bien lui ?</p>

    <div className="grid grid-cols-2 gap-3">
      <button
        onClick={onCorrect}
        className="py-4 rounded-2xl bg-[#00E676] hover:bg-[#00C966] text-[#0A1410] font-display text-xl tracking-widest hover:scale-[1.03] active:scale-[0.97] transition-transform"
      >
        ✓ OUI !
      </button>
      <button
        onClick={onWrong}
        className="py-4 rounded-2xl bg-[#FF3D6E] hover:bg-[#E62E5E] text-white font-display text-xl tracking-widest hover:scale-[1.03] active:scale-[0.97] transition-transform"
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
  <div className="text-center">
    <div className="text-7xl mb-4 animate-in zoom-in duration-300">🎉</div>
    <div className="font-display text-4xl lg:text-5xl tracking-wider text-[#FFC93C] mb-2">
      JE T'AI EU !
    </div>
    <p className="text-white/70 text-base mb-6">
      Tu pensais bien à <span className="text-white font-bold">{guess.name}</span>.
    </p>
    <div className="grid grid-cols-2 gap-3">
      <button
        onClick={onRestart}
        className="py-4 rounded-2xl bg-gradient-to-r from-[#FF8A2A] to-[#FFC93C] text-[#1A0F00] font-display text-lg tracking-widest hover:scale-[1.02] transition-transform"
      >
        ▶ REJOUER
      </button>
      <button
        onClick={onClose}
        className="py-4 rounded-2xl border-2 border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-white/80 font-display text-base tracking-widest transition-colors"
      >
        QUITTER
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
    <div className="text-7xl mb-4">🙏</div>
    <div className="font-display text-4xl lg:text-5xl tracking-wider text-white mb-2">
      BIEN JOUÉ
    </div>
    <p className="text-white/70 text-base mb-6">
      Tu m'as eu — je n'ai pas trouvé ton joueur cette fois.
    </p>

    {tried.length > 0 && (
      <div className="mb-4 text-xs text-white/40">
        J'ai essayé : {tried.slice(0, 3).join(", ")}
        {tried.length > 3 ? "…" : ""}
      </div>
    )}

    {shortlist.length > 0 && (
      <div className="mb-6 text-left">
        <div className="font-display text-xs tracking-[0.25em] text-white/50 mb-2">
          C'ÉTAIT PEUT-ÊTRE...
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          {shortlist.map((p) => (
            <span
              key={p.name}
              className="px-3 py-1 rounded-full bg-white/[0.05] border border-white/10 text-white/80 text-sm"
            >
              {p.name}
            </span>
          ))}
        </div>
      </div>
    )}

    <p className="text-xs text-white/40 mb-5">
      Si ton joueur n'apparaît nulle part, il n'est peut-être pas encore dans
      ma base.
    </p>

    <div className="grid grid-cols-2 gap-3">
      <button
        onClick={onRestart}
        className="py-4 rounded-2xl bg-gradient-to-r from-[#C084FC] to-[#FF8A2A] text-[#1A0F00] font-display text-lg tracking-widest hover:scale-[1.02] transition-transform"
      >
        ▶ REVANCHE
      </button>
      <button
        onClick={onClose}
        className="py-4 rounded-2xl border-2 border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-white/80 font-display text-base tracking-widest transition-colors"
      >
        QUITTER
      </button>
    </div>
  </div>
);

// ===================== REVERSE MODE =====================
// L'app pense à un joueur, l'utilisateur pose 20 questions pour le deviner.

const REVERSE_MAX_QUESTIONS = 20;

type ReverseDifficulty = "facile" | "moyen" | "expert" | "all";
type ReversePhase = "config" | "playing" | "won" | "lost";

const ReverseMode = ({ onBack }: { onBack: () => void }) => {
  const [phase, setPhase] = useState<ReversePhase>("config");
  const [difficulty, setDifficulty] = useState<ReverseDifficulty>("facile");
  const [secret, setSecret] = useState<Player | null>(null);
  const [askedIds, setAskedIds] = useState<Set<string>>(new Set());
  const [revealed, setRevealed] = useState<
    Array<{ q: Question; answer: boolean }>
  >([]);
  const [questionsLeft, setQuestionsLeft] = useState(REVERSE_MAX_QUESTIONS);
  const [wrongGuesses, setWrongGuesses] = useState<string[]>([]);
  const [showGuessModal, setShowGuessModal] = useState(false);
  const [activeCategory, setActiveCategory] = useState<QCategory>("nat");
  const [search, setSearch] = useState("");

  const allPlayers = useMemo<Player[]>(
    () => (PLAYERS as Player[]).filter((p) => p),
    []
  );

  const startGame = (diff: ReverseDifficulty) => {
    const pool =
      diff === "all"
        ? allPlayers
        : allPlayers.filter((p) => p.diff === diff);
    if (pool.length === 0) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    setSecret(pick);
    setDifficulty(diff);
    setAskedIds(new Set());
    setRevealed([]);
    setQuestionsLeft(REVERSE_MAX_QUESTIONS);
    setWrongGuesses([]);
    setSearch("");
    setActiveCategory("nat");
    setPhase("playing");
  };

  const askQ = (q: Question) => {
    if (!secret || askedIds.has(q.id)) return;
    const answer = q.predicate(secret);
    const nextAsked = new Set(askedIds);
    nextAsked.add(q.id);
    const nextLeft = questionsLeft - 1;
    setAskedIds(nextAsked);
    setRevealed((prev) => [...prev, { q, answer }]);
    setQuestionsLeft(nextLeft);
    if (nextLeft === 0) setPhase("lost");
  };

  const submitGuess = (player: Player) => {
    if (!secret) return;
    setShowGuessModal(false);
    if (player.name === secret.name) {
      setPhase("won");
      return;
    }
    setWrongGuesses((prev) => [...prev, player.name]);
    const nextLeft = questionsLeft - 1;
    setQuestionsLeft(nextLeft);
    if (nextLeft <= 0) setPhase("lost");
  };

  const restart = () => setPhase("config");

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 text-xs text-white/40 hover:text-white/80 tracking-widest transition-colors"
      >
        ← MODES
      </button>

      <div className="text-center mb-6">
        <div className="font-display text-xs tracking-[0.4em] text-[#FFC93C] mb-2">
          🎯 DEVINE
        </div>
        <div className="font-display text-3xl lg:text-4xl tracking-wider text-white">
          {phase === "config"
            ? "CHOISIS TA DIFFICULTÉ"
            : phase === "won"
            ? "BRAVO !"
            : phase === "lost"
            ? "DOMMAGE"
            : "DEVINE MON JOUEUR"}
        </div>
      </div>

      {phase === "config" && <ReverseConfig onStart={startGame} />}

      {phase === "playing" && secret && (
        <ReversePlaying
          questionsLeft={questionsLeft}
          maxQuestions={REVERSE_MAX_QUESTIONS}
          revealed={revealed}
          askedIds={askedIds}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          search={search}
          setSearch={setSearch}
          onAsk={askQ}
          onOpenGuess={() => setShowGuessModal(true)}
          wrongGuesses={wrongGuesses}
        />
      )}

      {phase === "won" && secret && (
        <ReverseWon
          secret={secret}
          questionsUsed={REVERSE_MAX_QUESTIONS - questionsLeft}
          difficulty={difficulty}
          onRestart={restart}
          onBack={onBack}
        />
      )}

      {phase === "lost" && secret && (
        <ReverseLost
          secret={secret}
          onRestart={restart}
          onBack={onBack}
        />
      )}

      {showGuessModal && (
        <GuessModal
          allPlayers={allPlayers}
          onPick={submitGuess}
          onClose={() => setShowGuessModal(false)}
        />
      )}
    </div>
  );
};

const ReverseConfig = ({
  onStart,
}: {
  onStart: (diff: ReverseDifficulty) => void;
}) => {
  const options: { diff: ReverseDifficulty; label: string; desc: string; color: string }[] = [
    { diff: "facile", label: "FACILE", desc: "Stars connues (148 joueurs)", color: "#00E676" },
    { diff: "moyen", label: "MOYEN", desc: "Bons internationaux (1370 joueurs)", color: "#FFC93C" },
    { diff: "expert", label: "EXPERT", desc: "Joueurs pointus (2626 joueurs)", color: "#FF3D6E" },
    { diff: "all", label: "RANDOM", desc: "N'importe qui (4145 joueurs)", color: "#C084FC" },
  ];
  return (
    <div>
      <p className="text-center text-white/60 text-sm mb-6">
        Je vais choisir un joueur au hasard. Tu auras{" "}
        <span className="text-white font-bold">{REVERSE_MAX_QUESTIONS} questions</span>{" "}
        pour le trouver.
      </p>
      <div className="grid gap-3">
        {options.map((o) => (
          <button
            key={o.diff}
            onClick={() => onStart(o.diff)}
            className="text-left rounded-2xl border-2 p-4 transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              borderColor: `${o.color}50`,
              background: `linear-gradient(to right, ${o.color}10, transparent)`,
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="font-display text-lg tracking-widest"
                style={{ color: o.color }}
              >
                {o.label}
              </div>
              <div className="text-xs text-white/60 flex-1">{o.desc}</div>
              <div className="text-white/30">→</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

const REVERSE_CATEGORIES: { key: QCategory; label: string; icon: string }[] = [
  { key: "nat", label: "NATIONS", icon: "🌍" },
  { key: "pos", label: "POSTES", icon: "⚽" },
  { key: "club", label: "CLUBS", icon: "🏟️" },
  { key: "league", label: "LIGUES", icon: "🏆" },
  { key: "profile", label: "PROFIL", icon: "📋" },
];

const ReversePlaying = ({
  questionsLeft,
  maxQuestions,
  revealed,
  askedIds,
  activeCategory,
  setActiveCategory,
  search,
  setSearch,
  onAsk,
  onOpenGuess,
  wrongGuesses,
}: {
  questionsLeft: number;
  maxQuestions: number;
  revealed: Array<{ q: Question; answer: boolean }>;
  askedIds: Set<string>;
  activeCategory: QCategory;
  setActiveCategory: (c: QCategory) => void;
  search: string;
  setSearch: (s: string) => void;
  onAsk: (q: Question) => void;
  onOpenGuess: () => void;
  wrongGuesses: string[];
}) => {
  const progress = (questionsLeft / maxQuestions) * 100;

  // Questions filtrées : par catégorie + par recherche
  const filteredQuestions = useMemo(() => {
    const lower = search.trim().toLowerCase();
    return QUESTIONS.filter((q) => {
      if (q.category !== activeCategory) return false;
      if (!lower) return true;
      return q.label.toLowerCase().includes(lower);
    });
  }, [activeCategory, search]);

  return (
    <div>
      {/* Compteur */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-display tracking-widest text-white/50">
            QUESTIONS RESTANTES
          </span>
          <span className="font-display text-lg tabular-nums text-white">
            {questionsLeft} / {maxQuestions}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#FFC93C] to-[#FF8A2A] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Faits connus */}
      {revealed.length > 0 && (
        <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="font-display text-xs tracking-[0.25em] text-white/50 mb-2">
            CE QUE TU SAIS
          </div>
          <div className="flex flex-wrap gap-1.5">
            {revealed.map((r, i) => (
              <span
                key={i}
                className={
                  "px-2.5 py-1 rounded-full text-xs " +
                  (r.answer
                    ? "bg-[#00E676]/15 text-[#00E676] border border-[#00E676]/30"
                    : "bg-[#FF3D6E]/15 text-[#FF3D6E] border border-[#FF3D6E]/30")
                }
                title={r.q.label}
              >
                {r.answer ? "✅" : "❌"} {r.q.label.replace(/^(Est-ce un |Est-il |A-t-il |Joue-t-il |Vient-il |Peut-il |Est-ce )/, "")}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Mauvaises devinettes */}
      {wrongGuesses.length > 0 && (
        <div className="mb-4 text-xs text-white/40 text-center">
          ❌ Pas {wrongGuesses.join(", ")}
        </div>
      )}

      {/* Tabs catégories */}
      <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
        {REVERSE_CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setActiveCategory(c.key)}
            className={
              "shrink-0 px-3 py-1.5 rounded-lg font-display text-xs tracking-widest transition-colors " +
              (activeCategory === c.key
                ? "bg-[#FFC93C] text-[#1A0F00]"
                : "bg-white/[0.05] text-white/60 hover:bg-white/[0.1]")
            }
          >
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Filtrer les questions…"
        className="w-full mb-3 px-3 py-2 rounded-lg bg-black/30 border border-white/10 focus:border-[#FFC93C] focus:outline-none text-sm text-white placeholder-white/30"
      />

      {/* Liste de questions */}
      <div className="max-h-[40vh] overflow-y-auto rounded-xl border border-white/5 bg-black/20 p-2 mb-4 space-y-1">
        {filteredQuestions.length === 0 && (
          <div className="text-center text-xs text-white/40 py-6">
            Aucune question dans cette catégorie.
          </div>
        )}
        {filteredQuestions.map((q) => {
          const asked = askedIds.has(q.id);
          return (
            <button
              key={q.id}
              onClick={() => !asked && onAsk(q)}
              disabled={asked}
              className={
                "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors " +
                (asked
                  ? "bg-white/[0.02] text-white/20 cursor-not-allowed line-through"
                  : "bg-white/[0.04] hover:bg-white/[0.08] text-white/85")
              }
            >
              {q.label}
            </button>
          );
        })}
      </div>

      {/* Bouton deviner */}
      <button
        onClick={onOpenGuess}
        className="w-full goat-pulse py-4 rounded-2xl bg-gradient-to-r from-[#FFC93C] to-[#FF8A2A] text-[#1A0F00] font-display text-xl tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-transform"
      >
        💭 JE DEVINE
      </button>
      <p className="text-center text-[10px] text-white/30 mt-2 tracking-wider">
        Mauvaise devinette = -1 question
      </p>
    </div>
  );
};

const GuessModal = ({
  allPlayers,
  onPick,
  onClose,
}: {
  allPlayers: Player[];
  onPick: (p: Player) => void;
  onClose: () => void;
}) => {
  const [query, setQuery] = useState("");
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return allPlayers
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, allPlayers]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-[#0F2017] border-2 border-[#FFC93C]/40 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-display text-xs tracking-[0.3em] text-[#FFC93C] mb-2 text-center">
          💭 TA RÉPONSE FINALE
        </div>
        <div className="font-display text-2xl tracking-wide text-white mb-4 text-center">
          QUEL JOUEUR ?
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tape un nom de joueur…"
          autoFocus
          className="w-full px-4 py-3 rounded-xl bg-black/40 border-2 border-white/10 focus:border-[#FFC93C] focus:outline-none text-white text-base mb-3"
        />

        {suggestions.length > 0 && (
          <div className="space-y-1 mb-4 max-h-[40vh] overflow-y-auto">
            {suggestions.map((p) => (
              <button
                key={p.name}
                onClick={() => onPick(p)}
                className="w-full text-left px-3 py-2.5 rounded-xl bg-white/[0.04] hover:bg-[#FFC93C]/15 text-white transition-colors flex items-center gap-2"
              >
                <span className="text-sm">⚽</span>
                <span className="text-sm">{p.name}</span>
                <span className="ml-auto text-xs text-white/40">
                  {p.nationalities[0]}
                </span>
              </button>
            ))}
          </div>
        )}

        {query.trim().length >= 2 && suggestions.length === 0 && (
          <div className="text-center text-xs text-white/40 py-4 mb-3">
            Aucun joueur trouvé pour "{query}".
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl border-2 border-white/10 bg-white/[0.02] hover:bg-white/[0.06] text-white/70 font-display text-sm tracking-widest transition-colors"
        >
          ANNULER
        </button>
      </div>
    </div>
  );
};

const ReverseWon = ({
  secret,
  questionsUsed,
  difficulty,
  onRestart,
  onBack,
}: {
  secret: Player;
  questionsUsed: number;
  difficulty: ReverseDifficulty;
  onRestart: () => void;
  onBack: () => void;
}) => {
  const remaining = REVERSE_MAX_QUESTIONS - questionsUsed;
  const bonus =
    difficulty === "expert" ? 50 : difficulty === "moyen" ? 20 : difficulty === "all" ? 30 : 0;
  const score = remaining * 5 + bonus;
  return (
    <div className="text-center">
      <div className="text-7xl mb-4 animate-in zoom-in duration-300">🎉</div>
      <div className="font-display text-4xl lg:text-5xl tracking-wider text-[#FFC93C] mb-2">
        BIEN JOUÉ !
      </div>
      <p className="text-white/70 text-base mb-2">
        Tu as trouvé <span className="text-white font-bold">{secret.name}</span> en{" "}
        <span className="text-[#FFC93C] font-bold">{questionsUsed}</span> questions.
      </p>
      <div className="my-5 inline-block px-6 py-3 rounded-2xl border-2 border-[#FFC93C]/40 bg-[#FFC93C]/10">
        <div className="text-xs text-white/50 mb-1 tracking-widest">SCORE</div>
        <div className="font-display text-4xl tracking-wider text-[#FFC93C] tabular-nums">
          {score}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-2">
        <button
          onClick={onRestart}
          className="py-4 rounded-2xl bg-gradient-to-r from-[#FF8A2A] to-[#FFC93C] text-[#1A0F00] font-display text-lg tracking-widest hover:scale-[1.02] transition-transform"
        >
          ▶ REJOUER
        </button>
        <button
          onClick={onBack}
          className="py-4 rounded-2xl border-2 border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-white/80 font-display text-base tracking-widest transition-colors"
        >
          MODES
        </button>
      </div>
    </div>
  );
};

const ReverseLost = ({
  secret,
  onRestart,
  onBack,
}: {
  secret: Player;
  onRestart: () => void;
  onBack: () => void;
}) => (
  <div className="text-center">
    <div className="text-7xl mb-4">😔</div>
    <div className="font-display text-4xl lg:text-5xl tracking-wider text-white mb-2">
      DOMMAGE
    </div>
    <p className="text-white/70 text-base mb-1">
      Le joueur était...
    </p>
    <div className="my-5 inline-block px-6 py-3 rounded-2xl border-2 border-[#FFC93C]/40 bg-gradient-to-br from-[#1A2A20] to-[#0A1410]">
      <div className="font-display text-3xl tracking-wider text-white mb-2">
        {secret.name}
      </div>
      <div className="flex flex-wrap justify-center gap-1.5 text-xs">
        <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/70">
          {secret.nationalities[0]}
        </span>
        {secret.positions.slice(0, 2).map((p) => (
          <span key={p} className="px-2 py-0.5 rounded-full bg-[#C084FC]/20 text-[#C084FC]">
            {p}
          </span>
        ))}
        <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/60">
          {secret.clubs.length} clubs
        </span>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <button
        onClick={onRestart}
        className="py-4 rounded-2xl bg-gradient-to-r from-[#C084FC] to-[#FF8A2A] text-[#1A0F00] font-display text-lg tracking-widest hover:scale-[1.02] transition-transform"
      >
        ▶ REVANCHE
      </button>
      <button
        onClick={onBack}
        className="py-4 rounded-2xl border-2 border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-white/80 font-display text-base tracking-widest transition-colors"
      >
        MODES
      </button>
    </div>
  </div>
);

export default GoatGuess;
