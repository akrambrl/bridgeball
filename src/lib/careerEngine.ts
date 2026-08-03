import { getDivisionClubs } from "@/data/career/leagues";

// ─── Types ───────────────────────────────────────────────────────────────────

export type CareerPos = "GK" | "DEF" | "MID" | "ATT";

export type CareerPlayer = {
  uid: string;
  name: string;
  position: CareerPos;
  rating: number;
  age: number;
  nationality: string;
  value: number;
  wage: number;
  quizClubs?: string[];
  isKnown?: boolean;
  morale: number; // 0-100
};

export type CareerFixture = {
  uid: string;
  week: number;
  type: "league" | "cup" | "friendly";
  opponentId: string;
  opponentName: string;
  opponentPrimary: string;
  homeAway: "home" | "away";
  myGoals?: number;
  opponentGoals?: number;
  played: boolean;
  opponentRating: number;
};

export type TableEntry = {
  clubId: string;
  name: string;
  p: number; w: number; d: number; l: number;
  gf: number; ga: number; pts: number;
};

export type MatchQuestion = {
  playerName: string;
  question: string;
  options: string[];
  correctIdx: number;
  answered: boolean;
  correct?: boolean;
};

export type MatchLogEntry = {
  text: string;
  type: "neutral" | "goal_us" | "goal_them" | "chance_us" | "chance_them";
};

export type ActiveMatch = {
  fixtureUid: string;
  type?: "league" | "cup" | "friendly";
  opponentName: string;
  opponentPrimary: string;
  opponentRating: number;
  yourRating: number;
  myGoals: number;
  opponentGoals: number;
  action: number;
  half: 1 | 2;
  questions: MatchQuestion[];
  log: MatchLogEntry[];
};

export type CareerPhase =
  | "hub" | "pre_match" | "match" | "match_result"
  | "squad" | "transfer" | "table" | "season_end";

export type CareerState = {
  v: 2;
  leagueId: string;
  clubId: string;
  clubName: string;
  clubPrimary: string;
  clubSecondary: string;
  division: 1 | 2 | 3;
  budget: number;
  season: number;
  week: number;
  squad: CareerPlayer[];
  startingXI: string[];
  fixtures: CareerFixture[];
  table: TableEntry[];
  phase: CareerPhase;
  match?: ActiveMatch;
  managerName: string;
  totalWins: number;
  totalLosses: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "bb_career_v2";
const TOTAL_ACTIONS = 12;

const FIRST_NAMES_FR = ["Lucas","Tom","Nathan","Mathieu","Antoine","Kevin","Samir","Younes","Bryan","Théo","Kylian","Rayan","Mehdi","Enzo","Hugo","Loïc","Dylan","Alexis","Julien","Pierre"];
const FIRST_NAMES_EN = ["James","Oliver","Harry","Charlie","George","Noah","Liam","Jack","Ryan","Dan","Sam","Will","Adam","Josh","Tyler","Cole","Marcus","Reece","Leon","Dean"];
const FIRST_NAMES_ES = ["Pablo","Diego","Carlos","Miguel","Alejandro","Sergio","David","Javier","Rubén","Marcos","Iker","Raúl","Álvaro","Adrián","Borja","Víctor","Iñaki","Óscar","Rodrigo","Tomás"];
const FIRST_NAMES_BR = ["Lucas","Gabriel","Matheus","Vitor","Felipe","Rafael","Bruno","Gustavo","Leonardo","Thiago","Anderson","Fabio","Leandro","Rodrigo","Claudinho","Wesley","Kaio","Everton","Reinaldo","Caio"];
const FIRST_NAMES_AF = ["Moussa","Ismaïl","Oumar","Cheikh","Ibrahima","Mamadou","Samba","Lamine","Pape","Abou","Samuel","Emmanuel","Kwame","Nana","Eric","Solomon","David","Clifford","Desmond","Prince"];
const LAST_NAMES_FR = ["Dupont","Martin","Bernard","Thomas","Laurent","Moreau","Lecomte","Petit","Garnier","Faure","Renard","Blanc","Roy","Meyer","Fontaine","Aubert","Legrand","Boyer","Perrin","Girard"];
const LAST_NAMES_EN = ["Smith","Jones","Brown","Taylor","Wilson","Davies","Evans","Thomas","Roberts","Johnson","Williams","Walker","White","Hall","Green","Harris","Lewis","Clarke","Jackson","Wood"];
const LAST_NAMES_ES = ["García","Fernández","González","Rodríguez","López","Martínez","Sánchez","Pérez","Romero","Torres","Herrera","Moreno","Jiménez","Ruiz","Navarro","Molina","Ortega","Delgado","Castro","Suárez"];
const LAST_NAMES_BR = ["Silva","Santos","Oliveira","Costa","Souza","Ferreira","Alves","Pereira","Lima","Carvalho","Rodrigues","Almeida","Nascimento","Barbosa","Ribeiro","Martins","Araújo","Medeiros","Campos","Viana"];
const LAST_NAMES_AF = ["Diallo","Koné","Traoré","Camara","Touré","Konaté","Coulibaly","Dembélé","Kouyaté","Sidibé","Mensah","Asante","Owusu","Quaye","Boateng","Addo","Osei","Amoah","Tetteh","Ankrah"];

const NAT_POOL = ["France","Argentine","Brésil","Espagne","Portugal","Angleterre","Allemagne","Italie","Pays-Bas","Belgique","Sénégal","Côte d'Ivoire","Cameroun","Nigeria","Uruguay","Croatie","Serbie","Danemark","Suède","Maroc","Algérie","Ghana","Colombie","Mexique","Chili","Ghana","Mali","Guinée","Tunisie","Écosse","Pologne","Autriche"];

const POS_LABELS: Record<CareerPos, string> = { GK:"Gardien", DEF:"Défenseur", MID:"Milieu", ATT:"Attaquant" };

const FAMOUS_CLUBS_NOT_QUIZ = ["Real Madrid","FC Barcelone","Manchester United","Liverpool","Chelsea","Arsenal","Manchester City","PSG","Bayern Munich","Juventus","AC Milan","Inter Milan","Borussia Dortmund","Ajax Amsterdam","Porto","Atletico Madrid","Napoli","Roma","Tottenham","Séville FC","Benfica","Galatasaray","Fenerbahçe","Olympique de Marseille","Celtic","Rangers"];

// ─── Utilities ────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function ratingForDiff(diff: string): number {
  if (diff === "facile") return 82 + Math.floor(Math.random() * 13); // 82-94
  if (diff === "moyen")  return 68 + Math.floor(Math.random() * 13); // 68-80
  return 52 + Math.floor(Math.random() * 14); // 52-65
}

function valueForRating(rating: number, age: number): number {
  const base = Math.pow(rating / 40, 3) * 10_000;
  const ageMult = age < 24 ? 1.4 : age < 28 ? 1.0 : age < 32 ? 0.7 : 0.4;
  return Math.round(base * ageMult / 1000) * 1000;
}

function wageForRating(rating: number): number {
  return Math.round(rating * rating * 0.8 / 100) * 100;
}

function posFromQuiz(positions: string[]): CareerPos {
  const p = (positions[0] || "").toLowerCase();
  if (p.includes("gardien")) return "GK";
  if (p.includes("defen") || p.includes("défens")) return "DEF";
  if (p.includes("attaq")) return "ATT";
  return "MID";
}

export function genPlayerName(nat: string): string {
  if (nat === "France") return `${pick(FIRST_NAMES_FR)} ${pick(LAST_NAMES_FR)}`;
  if (nat === "Angleterre" || nat === "Écosse") return `${pick(FIRST_NAMES_EN)} ${pick(LAST_NAMES_EN)}`;
  if (nat === "Espagne") return `${pick(FIRST_NAMES_ES)} ${pick(LAST_NAMES_ES)}`;
  if (nat === "Brésil") return `${pick(FIRST_NAMES_BR)} ${pick(LAST_NAMES_BR)}`;
  if (["Sénégal","Côte d'Ivoire","Cameroun","Nigeria","Ghana","Mali","Guinée","Algérie","Maroc","Tunisie"].includes(nat))
    return `${pick(FIRST_NAMES_AF)} ${pick(LAST_NAMES_AF)}`;
  return `${pick(FIRST_NAMES_EN)} ${pick(LAST_NAMES_EN)}`;
}

// ─── Squad generation ─────────────────────────────────────────────────────────

function genSquadPlayer(position: CareerPos, division: 1|2|3): CareerPlayer {
  const maxRating = division === 3 ? 52 : division === 2 ? 65 : 78;
  const minRating = division === 3 ? 30 : division === 2 ? 45 : 60;
  const rating = minRating + Math.floor(Math.random() * (maxRating - minRating));
  const age = 18 + Math.floor(Math.random() * 15);
  const nat = pick(NAT_POOL);
  return {
    uid: uid(), name: genPlayerName(nat), position, rating, age,
    nationality: nat, value: valueForRating(rating, age),
    wage: wageForRating(rating), morale: 70 + Math.floor(Math.random() * 20),
  };
}

function generateStartingSquad(division: 1|2|3): CareerPlayer[] {
  const squad: CareerPlayer[] = [];
  const counts: Record<CareerPos, number> = { GK: 2, DEF: 5, MID: 5, ATT: 3 };
  for (const [pos, count] of Object.entries(counts)) {
    for (let i = 0; i < count; i++) {
      squad.push(genSquadPlayer(pos as CareerPos, division));
    }
  }
  return squad;
}

// ─── Starting XI auto-selection ───────────────────────────────────────────────

export function bestStartingXI(squad: CareerPlayer[]): string[] {
  const byPos: Record<CareerPos, CareerPlayer[]> = { GK:[], DEF:[], MID:[], ATT:[] };
  for (const p of squad) byPos[p.position].push(p);
  for (const pos of ["GK","DEF","MID","ATT"] as CareerPos[]) {
    byPos[pos].sort((a, b) => b.rating - a.rating);
  }
  const xi: string[] = [];
  const take = (pos: CareerPos, n: number) => {
    xi.push(...byPos[pos].slice(0, n).map(p => p.uid));
  };
  take("GK", 1); take("DEF", 4); take("MID", 4); take("ATT", 2);
  return xi;
}

export function avgRating(squad: CareerPlayer[], startingXI: string[]): number {
  const starters = squad.filter(p => startingXI.includes(p.uid));
  if (!starters.length) return 40;
  return Math.round(starters.reduce((s, p) => s + p.rating, 0) / starters.length);
}

// ─── Fixtures generation ──────────────────────────────────────────────────────

function generateFixtures(leagueId: string, clubId: string, division: 1|2|3): CareerFixture[] {
  const clubs = getDivisionClubs(leagueId, division).filter(c => c.id !== clubId);
  const fixtures: CareerFixture[] = [];
  let week = 1;

  // 7 opponents — 7 home + 5 away = 12 league games spread over 14 weeks
  const shuffled = shuffle(clubs);
  shuffled.forEach((opp, i) => {
    // Cup in week 4 and 9
    if (week === 4 || week === 9) week++;
    if (week === 4 || week === 9) week++;

    const homeAway: "home"|"away" = i < 4 ? "home" : "away";
    const divRating = division === 3 ? 38 + Math.floor(Math.random() * 15) :
                      division === 2 ? 55 + Math.floor(Math.random() * 15) :
                                       68 + Math.floor(Math.random() * 15);
    fixtures.push({
      uid: uid(), week, type: "league",
      opponentId: opp.id, opponentName: opp.name,
      opponentPrimary: opp.primary,
      homeAway, played: false, opponentRating: divRating,
    });
    week++;
  });

  // 2 cup games
  [4, 9].forEach(cupWeek => {
    const opp = pick(clubs);
    const cupRating = division === 3 ? 42 + Math.floor(Math.random() * 20) :
                      division === 2 ? 58 + Math.floor(Math.random() * 20) :
                                       70 + Math.floor(Math.random() * 18);
    fixtures.push({
      uid: uid(), week: cupWeek, type: "cup",
      opponentId: opp.id, opponentName: "⚽ " + opp.name + " (Coupe)",
      opponentPrimary: opp.primary,
      homeAway: "home", played: false, opponentRating: cupRating,
    });
  });

  return fixtures.sort((a, b) => a.week - b.week);
}

function generateTable(leagueId: string, clubId: string, clubName: string, division: 1|2|3): TableEntry[] {
  const clubs = getDivisionClubs(leagueId, division);
  return clubs.map(c => ({
    clubId: c.id,
    name: c.id === clubId ? clubName : c.name,
    p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0,
  }));
}

// ─── Career init ──────────────────────────────────────────────────────────────

export function createCareer(
  leagueId: string,
  clubId: string,
  clubName: string,
  clubPrimary: string,
  clubSecondary: string,
  division: 1|2|3,
  initialBudget: number,
  managerName: string,
): CareerState {
  const squad = generateStartingSquad(division);
  const startingXI = bestStartingXI(squad);
  return {
    v: 2,
    leagueId, clubId, clubName, clubPrimary, clubSecondary,
    division, budget: initialBudget, season: 1, week: 1, squad,
    startingXI,
    fixtures: generateFixtures(leagueId, clubId, division),
    table: generateTable(leagueId, clubId, clubName, division),
    phase: "hub",
    managerName,
    totalWins: 0, totalLosses: 0,
  };
}

// ─── Quiz question generation ─────────────────────────────────────────────────

type QuizPlayer = { name: string; clubs: string[]; nationalities: string[]; positions: string[]; birthYear?: number; diff?: string };

export function generateMatchQuestion(
  players: QuizPlayer[],
  ballonDorSet: Set<string>,
  retiredSet: Set<string>,
): MatchQuestion {
  // Filter to playable players
  const pool = players.filter(p => p.nationalities.length > 0 && p.positions.length > 0);
  const player = pick(pool);

  const types = ["nationality", "nationality", "position", "club_yes", "club_no", "ballon_dor", "retired"];
  const type = pick(types);

  if (type === "nationality") {
    const correct = player.nationalities[0];
    const wrong = shuffle(NAT_POOL.filter(n => n !== correct)).slice(0, 3);
    const options = shuffle([correct, ...wrong]);
    return {
      playerName: player.name,
      question: `Quelle est la nationalité de`,
      options, correctIdx: options.indexOf(correct), answered: false,
    };
  }

  if (type === "position") {
    const correct = POS_LABELS[posFromQuiz(player.positions)];
    const all = ["Gardien","Défenseur","Milieu","Attaquant"];
    const wrong = shuffle(all.filter(p => p !== correct)).slice(0, 3);
    const options = shuffle([correct, ...wrong]);
    return {
      playerName: player.name,
      question: `À quel poste joue`,
      options, correctIdx: options.indexOf(correct), answered: false,
    };
  }

  if (type === "club_yes" && player.clubs.length > 0) {
    const club = pick(player.clubs);
    return {
      playerName: player.name,
      question: `A joué pour ${club} ?`,
      options: ["Oui ✅", "Non ❌"],
      correctIdx: 0, answered: false,
    };
  }

  if (type === "club_no") {
    const notClub = pick(FAMOUS_CLUBS_NOT_QUIZ.filter(c => !player.clubs.includes(c)));
    return {
      playerName: player.name,
      question: `A joué pour ${notClub} ?`,
      options: ["Oui ✅", "Non ❌"],
      correctIdx: 1, answered: false,
    };
  }

  if (type === "ballon_dor") {
    const won = ballonDorSet.has(player.name);
    return {
      playerName: player.name,
      question: `A remporté le Ballon d'Or ?`,
      options: ["Oui ✅", "Non ❌"],
      correctIdx: won ? 0 : 1, answered: false,
    };
  }

  // retired
  const isRetired = retiredSet.has(player.name);
  return {
    playerName: player.name,
    question: `Est encore en activité ?`,
    options: ["Oui ✅", "Non ❌"],
    correctIdx: isRetired ? 1 : 0, answered: false,
  };
}

// ─── Match logic ──────────────────────────────────────────────────────────────

const ATTACK_NARRATIVES = [
  "Ton avant-centre percute la défense !",
  "Superbe centre, {name} peut frapper !",
  "{name} se retrouve seul face au gardien !",
  "{name} frappe de loin !",
  "Coup franc dangereux pour {name} !",
  "{name} part en contre-attaque !",
  "Corner, {name} attaque au premier poteau !",
  "Passe décisive pour {name} dans la surface !",
  "{name} élimine deux défenseurs !",
  "{name} se bat pour le ballon dans les 16 mètres !",
  "Magnifique combinaison, {name} conclut !",
  "Erreur adverse, {name} en profite !",
];

const DEFENSE_NARRATIVES = [
  "{name} doit intercepter le ballon !",
  "L'adversaire arrive, {name} couvre !",
  "{name} lutte au duel !",
  "Contre-attaque adverse, {name} en défense !",
  "Tir adverse, {name} doit bloquer !",
  "L'adversaire frappe, {name} sur la ligne !",
];

function pickNarrative(attackerName: string, defenderName: string, action: number): string {
  const isAttack = action % 2 === 0;
  const list = isAttack ? ATTACK_NARRATIVES : DEFENSE_NARRATIVES;
  const name = isAttack ? attackerName : defenderName;
  return pick(list).replace("{name}", name);
}

function resolveGoal(correct: boolean, yourRating: number, opponentRating: number): {myGoal: boolean; theirGoal: boolean} {
  const yourChance = 0.15 + (yourRating / 99) * 0.18;
  const theirChance = 0.15 + (opponentRating / 99) * 0.18;
  const r = Math.random();
  if (correct) {
    return { myGoal: r < yourChance * 1.6, theirGoal: r < theirChance * 0.3 };
  } else {
    return { myGoal: r < yourChance * 0.25, theirGoal: r < theirChance * 1.5 };
  }
}

export function startMatch(
  state: CareerState,
  fixtureUid: string,
  players: QuizPlayer[],
  ballonDorSet: Set<string>,
  retiredSet: Set<string>,
): CareerState {
  const fixture = state.fixtures.find(f => f.uid === fixtureUid);
  if (!fixture) return state;
  const yourRating = avgRating(state.squad, state.startingXI);
  const questions = Array.from({ length: TOTAL_ACTIONS }, () =>
    generateMatchQuestion(players, ballonDorSet, retiredSet)
  );
  return {
    ...state,
    phase: "match",
    match: {
      fixtureUid,
      type: fixture.type,
      opponentName: fixture.opponentName,
      opponentPrimary: fixture.opponentPrimary,
      opponentRating: fixture.opponentRating,
      yourRating,
      myGoals: 0, opponentGoals: 0,
      action: 0, half: 1,
      questions,
      log: [{ text: `Coup d'envoi ! ${state.clubName} vs ${fixture.opponentName}`, type: "neutral" }],
    },
  };
}

export function resolveMatchAction(
  state: CareerState,
  selectedIdx: number,
  attackerName: string,
  defenderName: string,
): CareerState {
  if (!state.match) return state;
  const m = state.match;
  const q = m.questions[m.action];
  if (!q || q.answered) return state;

  const correct = selectedIdx === q.correctIdx;
  const { myGoal, theirGoal } = resolveGoal(correct, m.yourRating, m.opponentRating);

  const narrative = pickNarrative(attackerName, defenderName, m.action);
  let logEntry: MatchLogEntry;
  let myGoals = m.myGoals;
  let opponentGoals = m.opponentGoals;

  if (correct && myGoal) {
    myGoals++;
    logEntry = { text: `✅ ${narrative} → BUUUT ! ${state.clubName} marque ! ⚽`, type: "goal_us" };
  } else if (correct && !myGoal) {
    logEntry = { text: `✅ ${narrative} → Belle tentative, mais le gardien sauve !`, type: "chance_us" };
  } else if (!correct && theirGoal) {
    opponentGoals++;
    logEntry = { text: `❌ ${narrative} → Mauvaise réponse ! L'adversaire contre-attaque... BUT ! ⚽`, type: "goal_them" };
  } else {
    logEntry = { text: `❌ ${narrative} → Mauvaise réponse ! Le ballon est perdu.`, type: "chance_them" };
  }

  const updatedQuestions = m.questions.map((q2, i) =>
    i === m.action ? { ...q2, answered: true, correct } : q2
  );

  const nextAction = m.action + 1;
  const half: 1|2 = nextAction < TOTAL_ACTIONS / 2 ? 1 : 2;

  const halfLog: MatchLogEntry[] = [];
  if (nextAction === TOTAL_ACTIONS / 2) {
    halfLog.push({ text: `🔔 Mi-temps ! ${state.clubName} ${myGoals} - ${opponentGoals} ${m.opponentName}`, type: "neutral" });
  }

  const newLog = [...m.log, logEntry, ...halfLog];
  const finished = nextAction >= TOTAL_ACTIONS;

  return {
    ...state,
    phase: finished ? "match_result" : "match",
    match: {
      ...m,
      myGoals, opponentGoals,
      action: nextAction,
      half,
      questions: updatedQuestions,
      log: newLog,
    },
  };
}

export function finishMatch(state: CareerState): CareerState {
  if (!state.match) return state;
  const m = state.match;
  const fixture = state.fixtures.find(f => f.uid === m.fixtureUid);
  if (!fixture) return state;

  const won = m.myGoals > m.opponentGoals;
  const drawn = m.myGoals === m.opponentGoals;
  const prize = won ? 5_000 : drawn ? 2_000 : 0;

  // Update table
  const table = state.table.map(row => {
    if (row.clubId === state.clubId) {
      return {
        ...row,
        p: row.p + 1,
        w: row.w + (won ? 1 : 0),
        d: row.d + (drawn ? 1 : 0),
        l: row.l + (!won && !drawn ? 1 : 0),
        gf: row.gf + m.myGoals,
        ga: row.ga + m.opponentGoals,
        pts: row.pts + (won ? 3 : drawn ? 1 : 0),
      };
    }
    // Simulate opponent result in table
    const oppWon = !won && !drawn;
    const oppDrawn = drawn;
    return {
      ...row,
      p: row.p + (row.clubId === fixture.opponentId ? 1 : 0),
      w: row.w + (row.clubId === fixture.opponentId && oppWon ? 1 : 0),
      d: row.d + (row.clubId === fixture.opponentId && oppDrawn ? 1 : 0),
      l: row.l + (row.clubId === fixture.opponentId && !oppWon && !oppDrawn ? 1 : 0),
      gf: row.gf + (row.clubId === fixture.opponentId ? m.opponentGoals : 0),
      ga: row.ga + (row.clubId === fixture.opponentId ? m.myGoals : 0),
      pts: row.pts + (row.clubId === fixture.opponentId ? (oppWon ? 3 : oppDrawn ? 1 : 0) : 0),
    };
  });

  // Simulate other matches in table
  const tableUpdated = table.map(row => {
    if (row.clubId === state.clubId || row.clubId === fixture.opponentId) return row;
    const chance = Math.random();
    if (chance < 0.4) return { ...row, p: row.p+1, w: row.w+1, gf: row.gf+2, ga: row.ga+1, pts: row.pts+3 };
    if (chance < 0.6) return { ...row, p: row.p+1, d: row.d+1, gf: row.gf+1, ga: row.ga+1, pts: row.pts+1 };
    return { ...row, p: row.p+1, l: row.l+1, gf: row.gf+1, ga: row.ga+2 };
  });

  const updatedFixtures = state.fixtures.map(f =>
    f.uid === m.fixtureUid
      ? { ...f, played: true, myGoals: m.myGoals, opponentGoals: m.opponentGoals }
      : f
  );

  const allPlayed = updatedFixtures.every(f => f.played);

  return {
    ...state,
    budget: state.budget + prize,
    fixtures: updatedFixtures,
    table: tableUpdated,
    phase: allPlayed ? "season_end" : "match_result",
    week: state.week + 1,
    totalWins: state.totalWins + (won ? 1 : 0),
    totalLosses: state.totalLosses + (!won && !drawn ? 1 : 0),
    match: state.match,
  };
}

// ─── Season end & promotion/relegation ────────────────────────────────────────

export function startNewSeason(state: CareerState): CareerState {
  const sorted = [...state.table].sort((a, b) =>
    b.pts !== a.pts ? b.pts - a.pts : (b.gf - b.ga) - (a.gf - a.ga)
  );
  const myPos = sorted.findIndex(r => r.clubId === state.clubId) + 1;

  let newDivision = state.division;
  if (myPos <= 2 && state.division > 1) newDivision = (state.division - 1) as 1|2|3;
  if (myPos >= 7 && state.division < 3) newDivision = (state.division + 1) as 1|2|3;

  const squad = state.squad.map(p => ({ ...p, age: p.age + 1 }));
  const startingXI = bestStartingXI(squad);

  return {
    ...state,
    division: newDivision,
    season: state.season + 1,
    week: 1,
    squad, startingXI,
    fixtures: generateFixtures(state.leagueId, state.clubId, newDivision),
    table: generateTable(state.leagueId, state.clubId, state.clubName, newDivision),
    phase: "hub",
    match: undefined,
  };
}

// ─── Transfer market ──────────────────────────────────────────────────────────

export function generateTransferMarket(
  division: 1|2|3,
  quizPlayers: QuizPlayer[],
): CareerPlayer[] {
  const market: CareerPlayer[] = [];

  // 5-8 unknown players
  const unknownCount = 5 + Math.floor(Math.random() * 4);
  const positions: CareerPos[] = ["GK","DEF","DEF","MID","MID","ATT","ATT","DEF","MID"];
  for (let i = 0; i < unknownCount; i++) {
    market.push(genSquadPlayer(positions[i % positions.length], division));
  }

  // 4-6 known (quiz) players
  const tier = division === 3 ? "expert" : division === 2 ? "moyen" : "facile";
  const tiers = [tier, "expert"];
  const pool = quizPlayers.filter(p => p.diff && tiers.includes(p.diff) && p.positions.length > 0 && p.nationalities.length > 0);
  const picks = shuffle(pool).slice(0, 5 + Math.floor(Math.random() * 3));

  for (const qp of picks) {
    const rating = ratingForDiff(qp.diff ?? "expert");
    const age = qp.birthYear ? new Date().getFullYear() - qp.birthYear : 28;
    market.push({
      uid: uid(),
      name: qp.name,
      position: posFromQuiz(qp.positions),
      rating, age,
      nationality: qp.nationalities[0],
      value: valueForRating(rating, age),
      wage: wageForRating(rating),
      quizClubs: qp.clubs,
      isKnown: true,
      morale: 70 + Math.floor(Math.random() * 20),
    });
  }

  return market;
}

export function buyPlayer(state: CareerState, player: CareerPlayer): CareerState | string {
  if (state.budget < player.value) return "Budget insuffisant !";
  if (state.squad.length >= 25) return "Effectif complet (25 joueurs max) !";
  const newSquad = [...state.squad, { ...player, uid: uid() }];
  return {
    ...state,
    budget: state.budget - player.value,
    squad: newSquad,
    startingXI: bestStartingXI(newSquad),
  };
}

export function releasePlayer(state: CareerState, playerUid: string): CareerState | string {
  if (state.squad.length <= 11) return "Il te faut au moins 11 joueurs !";
  const newSquad = state.squad.filter(p => p.uid !== playerUid);
  return {
    ...state,
    budget: state.budget + 1_000,
    squad: newSquad,
    startingXI: bestStartingXI(newSquad),
  };
}

// ─── Storage ──────────────────────────────────────────────────────────────────

export function saveCareer(state: CareerState): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* noop */ }
}

export function loadCareer(): CareerState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s.v !== 2) return null;
    return s as CareerState;
  } catch { return null; }
}

export function deleteCareer(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
}

export function hasCareer(): boolean {
  try { return !!localStorage.getItem(STORAGE_KEY); } catch { return false; }
}

export function getNextFixture(state: CareerState): CareerFixture | null {
  return state.fixtures.find(f => !f.played) ?? null;
}

export function sortedTable(table: TableEntry[]): TableEntry[] {
  return [...table].sort((a, b) =>
    b.pts !== a.pts ? b.pts - a.pts : (b.gf - b.ga) - (a.gf - a.ga)
  );
}

export function formatBudget(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M€`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K€`;
  return `${n}€`;
}
