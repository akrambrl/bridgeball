import { useEffect, useMemo, useState } from "react";
import { PLAYERS, RETIRED_PLAYERS } from "../../players.jsx";

type Player = {
  name: string;
  clubs: string[];
  nationalities: string[];
  positions: string[];
  diff: "facile" | "moyen" | "expert";
};

type Question = {
  id: string;
  label: string;
  predicate: (p: Player) => boolean;
};

const MAX_QUESTIONS = 20;

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
  { id: "is-gk", label: "Est-ce un gardien de but ?", predicate: (p) => hasPos(p, POS_GARDIEN) },
  { id: "is-def", label: "Est-ce un défenseur ?", predicate: isDefender },
  { id: "is-mid", label: "Est-ce un milieu de terrain ?", predicate: (p) => hasPos(p, POS_MIL) },
  { id: "is-att", label: "Est-ce un attaquant ?", predicate: (p) => hasPos(p, POS_ATT) },
  {
    id: "is-offensive",
    label: "Joue-t-il à un poste offensif (milieu ou attaquant) ?",
    predicate: (p) => hasPos(p, POS_MIL) || hasPos(p, POS_ATT),
  },
  {
    id: "is-defensive",
    label: "Joue-t-il à un poste défensif (gardien ou défenseur) ?",
    predicate: (p) => hasPos(p, POS_GARDIEN) || isDefender(p),
  },
  {
    id: "is-versatile",
    label: "Peut-il jouer à plusieurs postes différents ?",
    predicate: (p) => p.positions.length >= 2,
  },

  // Nationalités majeures
  { id: "nat-fr", label: "Est-il français ?", predicate: (p) => hasNat(p, "France") },
  { id: "nat-es", label: "Est-il espagnol ?", predicate: (p) => hasNat(p, "Espagne") },
  { id: "nat-en", label: "Est-il anglais ?", predicate: (p) => hasNat(p, "Angleterre") },
  { id: "nat-de", label: "Est-il allemand ?", predicate: (p) => hasNat(p, "Allemagne") },
  { id: "nat-it", label: "Est-il italien ?", predicate: (p) => hasNat(p, "Italie") },
  { id: "nat-pt", label: "Est-il portugais ?", predicate: (p) => hasNat(p, "Portugal") },
  { id: "nat-nl", label: "Est-il néerlandais ?", predicate: (p) => hasNat(p, "Pays-Bas") },
  { id: "nat-be", label: "Est-il belge ?", predicate: (p) => hasNat(p, "Belgique") },
  { id: "nat-hr", label: "Est-il croate ?", predicate: (p) => hasNat(p, "Croatie") },
  { id: "nat-ar", label: "Est-il argentin ?", predicate: (p) => hasNat(p, "Argentine") },
  { id: "nat-br", label: "Est-il brésilien ?", predicate: (p) => hasNat(p, "Brésil") },
  { id: "nat-uy", label: "Est-il uruguayen ?", predicate: (p) => hasNat(p, "Uruguay") },
  { id: "nat-co", label: "Est-il colombien ?", predicate: (p) => hasNat(p, "Colombie") },
  { id: "nat-ma", label: "Est-il marocain ?", predicate: (p) => hasNat(p, "Maroc") },
  { id: "nat-dz", label: "Est-il algérien ?", predicate: (p) => hasNat(p, "Algérie") },
  { id: "nat-sn", label: "Est-il sénégalais ?", predicate: (p) => hasNat(p, "Sénégal") },
  { id: "nat-ci", label: "Est-il ivoirien ?", predicate: (p) => hasNat(p, "Côte d'Ivoire") },
  { id: "nat-cm", label: "Est-il camerounais ?", predicate: (p) => hasNat(p, "Cameroun") },
  { id: "nat-ng", label: "Est-il nigérian ?", predicate: (p) => hasNat(p, "Nigeria") },
  { id: "nat-gh", label: "Est-il ghanéen ?", predicate: (p) => hasNat(p, "Ghana") },

  // Continents
  {
    id: "cont-eu",
    label: "Vient-il d'un pays européen ?",
    predicate: (p) => p.nationalities.some((n) => EUROPE.has(n)),
  },
  {
    id: "cont-sa",
    label: "Vient-il d'un pays sud-américain ?",
    predicate: (p) => p.nationalities.some((n) => SOUTH_AMERICA.has(n)),
  },
  {
    id: "cont-af",
    label: "Vient-il d'un pays africain ?",
    predicate: (p) => p.nationalities.some((n) => AFRICA.has(n)),
  },
  {
    id: "multi-nat",
    label: "A-t-il plusieurs nationalités ?",
    predicate: (p) => p.nationalities.length >= 2,
  },

  // Clubs majeurs
  { id: "club-real", label: "A-t-il joué au Real Madrid ?", predicate: (p) => playedFor(p, "Real Madrid") },
  { id: "club-barca", label: "A-t-il joué au FC Barcelone ?", predicate: (p) => playedFor(p, "Barcelona") },
  { id: "club-atm", label: "A-t-il joué à l'Atlético Madrid ?", predicate: (p) => playedFor(p, "Atletico Madrid") },
  { id: "club-sevilla", label: "A-t-il joué au FC Séville ?", predicate: (p) => playedFor(p, "Sevilla") },
  { id: "club-mu", label: "A-t-il joué à Manchester United ?", predicate: (p) => playedFor(p, "Manchester United") },
  { id: "club-mc", label: "A-t-il joué à Manchester City ?", predicate: (p) => playedFor(p, "Manchester City") },
  { id: "club-liv", label: "A-t-il joué à Liverpool ?", predicate: (p) => playedFor(p, "Liverpool") },
  { id: "club-che", label: "A-t-il joué à Chelsea ?", predicate: (p) => playedFor(p, "Chelsea") },
  { id: "club-ars", label: "A-t-il joué à Arsenal ?", predicate: (p) => playedFor(p, "Arsenal") },
  { id: "club-tot", label: "A-t-il joué à Tottenham ?", predicate: (p) => playedFor(p, "Tottenham") },
  { id: "club-juv", label: "A-t-il joué à la Juventus ?", predicate: (p) => playedFor(p, "Juventus FC") },
  { id: "club-milan", label: "A-t-il joué à l'AC Milan ?", predicate: (p) => playedFor(p, "AC Milan") },
  { id: "club-inter", label: "A-t-il joué à l'Inter Milan ?", predicate: (p) => playedFor(p, "Inter Milan") },
  { id: "club-roma", label: "A-t-il joué à l'AS Roma ?", predicate: (p) => playedFor(p, "AS Roma") },
  { id: "club-napoli", label: "A-t-il joué à Naples ?", predicate: (p) => playedFor(p, "Napoli") },
  { id: "club-bayern", label: "A-t-il joué au Bayern Munich ?", predicate: (p) => playedFor(p, "Bayern Munich") },
  { id: "club-bvb", label: "A-t-il joué au Borussia Dortmund ?", predicate: (p) => playedFor(p, "Borussia Dortmund") },
  { id: "club-psg", label: "A-t-il joué au PSG ?", predicate: (p) => playedFor(p, "PSG") },
  { id: "club-om", label: "A-t-il joué à l'Olympique de Marseille ?", predicate: (p) => playedFor(p, "Marseille") },
  { id: "club-ol", label: "A-t-il joué à l'Olympique Lyonnais ?", predicate: (p) => playedFor(p, "Lyon") },
  { id: "club-monaco", label: "A-t-il joué à l'AS Monaco ?", predicate: (p) => playedFor(p, "Monaco") },
  { id: "club-lille", label: "A-t-il joué au LOSC Lille ?", predicate: (p) => playedFor(p, "Lille") },
  { id: "club-ajax", label: "A-t-il joué à l'Ajax Amsterdam ?", predicate: (p) => playedFor(p, "Ajax Amsterdam") },
  { id: "club-porto", label: "A-t-il joué au FC Porto ?", predicate: (p) => playedFor(p, "Porto") },
  { id: "club-benfica", label: "A-t-il joué au Benfica ?", predicate: (p) => playedFor(p, "Benfica") },
  { id: "club-sporting", label: "A-t-il joué au Sporting CP ?", predicate: (p) => playedFor(p, "Sporting CP") },
  { id: "club-newcastle", label: "A-t-il joué à Newcastle ?", predicate: (p) => playedFor(p, "Newcastle") },

  // Ligues
  { id: "lg-pl", label: "A-t-il joué en Premier League anglaise ?", predicate: (p) => playedForAny(p, PREMIER_LEAGUE) },
  { id: "lg-liga", label: "A-t-il joué en Liga espagnole ?", predicate: (p) => playedForAny(p, LIGA) },
  { id: "lg-seriea", label: "A-t-il joué en Serie A italienne ?", predicate: (p) => playedForAny(p, SERIE_A) },
  { id: "lg-l1", label: "A-t-il joué en Ligue 1 française ?", predicate: (p) => playedForAny(p, LIGUE_1) },
  { id: "lg-bl", label: "A-t-il joué en Bundesliga allemande ?", predicate: (p) => playedForAny(p, BUNDESLIGA) },

  // Statut / divers
  {
    id: "retired",
    label: "Est-il retraité (n'a plus joué récemment) ?",
    predicate: (p) => RETIRED_PLAYERS.has(p.name),
  },
  {
    id: "nomad",
    label: "A-t-il joué dans au moins 5 clubs différents ?",
    predicate: (p) => p.clubs.length >= 5,
  },
  {
    id: "loyal",
    label: "A-t-il joué dans au plus 2 clubs (un joueur fidèle) ?",
    predicate: (p) => p.clubs.length <= 2,
  },
];

// Entropie binaire — plus c'est élevé (max=1), mieux la question discrimine.
const entropy = (yes: number, total: number) => {
  if (yes === 0 || yes === total) return 0;
  const p = yes / total;
  return -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
};

const pickQuestion = (candidates: Player[], askedIds: Set<string>) => {
  let best: { q: Question; score: number } | null = null;
  for (const q of QUESTIONS) {
    if (askedIds.has(q.id)) continue;
    let yes = 0;
    for (const p of candidates) if (q.predicate(p)) yes++;
    const score = entropy(yes, candidates.length);
    if (score <= 0) continue;
    if (!best || score > best.score) best = { q, score };
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
  // Pool initial filtré : joueurs reconnaissables (facile + moyen)
  const initialPool = useMemo<Player[]>(
    () =>
      (PLAYERS as Player[]).filter(
        (p) => p.diff === "facile" || p.diff === "moyen"
      ),
    []
  );

  const [phase, setPhase] = useState<Phase>("intro");
  const [candidates, setCandidates] = useState<Player[]>(initialPool);
  const [asked, setAsked] = useState<Set<string>>(new Set());
  const [questionCount, setQuestionCount] = useState(0);
  const [rejectedGuesses, setRejectedGuesses] = useState<Set<string>>(new Set());
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [currentGuess, setCurrentGuess] = useState<Player | null>(null);

  const startGame = () => {
    setPhase("asking");
    setCandidates(initialPool);
    setAsked(new Set());
    setQuestionCount(0);
    setRejectedGuesses(new Set());
    const q = pickQuestion(initialPool, new Set());
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
    const q = pickQuestion(candidates, asked);
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
  }, [phase, currentQuestion, candidates, asked, rejectedGuesses]);

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
    setAsked(nextAsked);
    setQuestionCount(nextCount);

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
    const nextQ = pickQuestion(nextCandidates, nextAsked);
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
    setRejectedGuesses(nextRejected);

    // Si on a encore des candidats et des questions, on retente
    if (remaining.length === 0 || questionCount >= MAX_QUESTIONS) {
      setCandidates(remaining);
      setPhase("lost");
      return;
    }
    if (remaining.length === 1) {
      // Plus qu'un candidat → on devine direct
      setCandidates(remaining);
      setCurrentGuess(remaining[0]);
      setPhase("guessing");
      return;
    }
    // Sinon, retour aux questions
    setCandidates(remaining);
    const nextQ = pickQuestion(remaining, asked);
    if (!nextQ) {
      goToGuess(remaining);
    } else {
      setCurrentQuestion(nextQ);
      setPhase("asking");
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
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
        onClick={handleClose}
        className="fixed top-3 right-3 z-[90] flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white font-display text-sm tracking-widest transition-colors"
        aria-label="Fermer GOAT Guess"
      >
        ✕ FERMER
      </button>

      <div className="relative w-full max-w-2xl rounded-3xl bg-[#0F2017] border-2 border-white/10 p-6 lg:p-10 shadow-2xl">
        <div className="text-center mb-6">
          <div className="font-display text-xs tracking-[0.4em] text-[#C084FC] mb-2">
            🔮 GOAT GUESS
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
          <WonView guess={currentGuess} onRestart={startGame} onClose={handleClose} />
        )}
        {phase === "lost" && (
          <LostView onRestart={startGame} onClose={handleClose} />
        )}
      </div>
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
      Astuce : pense à un joueur reconnu — l'app marche mieux avec les stars.
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

const LostView = ({ onRestart, onClose }: { onRestart: () => void; onClose: () => void }) => (
  <div className="text-center">
    <div className="text-7xl mb-4">🙏</div>
    <div className="font-display text-4xl lg:text-5xl tracking-wider text-white mb-2">
      BIEN JOUÉ
    </div>
    <p className="text-white/70 text-base mb-6">
      Tu m'as eu — je n'ai pas trouvé ton joueur cette fois.
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

export default GoatGuess;
