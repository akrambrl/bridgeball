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

export type MatchSituation = {
  phase: "attack" | "defense";
  context: string;
  playerName: string;
  playerRating: number;
  successProbs: [number, number, number]; // displayed % for each of the 3 actions
  chosenIdx?: number;
  outcome?: "success" | "fail";
  outcomeText?: string;
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
  situation: number; // current situation index (0–5)
  half: 1 | 2;
  situations: MatchSituation[];
  log: MatchLogEntry[];
};

export type CareerPhase =
  | "hub" | "pre_match" | "match" | "match_result"
  | "squad" | "transfer" | "table" | "season_end";

export type CareerState = {
  v: 3;
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

const STORAGE_KEY = "bb_career_v3";
const TOTAL_SITUATIONS = 6;

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

// ─── Tactical action configs ──────────────────────────────────────────────────

type ActionCfg = {
  label: string; emoji: string; description: string;
  baseProb: number;
  goalIfSuccess?: number;
  counterIfFail?: number;
  concedIfFail?: number;
};

const ATTACK_ACTIONS_CFG: ActionCfg[] = [
  { label: "TIRER",   emoji: "🎯", description: "Tentative directe au but", baseProb: 0.40, goalIfSuccess: 0.65, counterIfFail: 0.20 },
  { label: "DÉBORDER", emoji: "🏃", description: "Éliminer le défenseur",   baseProb: 0.55, goalIfSuccess: 0.35, counterIfFail: 0.22 },
  { label: "CENTRER", emoji: "↗️", description: "Servir un coéquipier",     baseProb: 0.65, goalIfSuccess: 0.25, counterIfFail: 0.14 },
];

const DEFENSE_ACTIONS_CFG: ActionCfg[] = [
  { label: "TACLER",  emoji: "💪", description: "Récupérer le ballon",    baseProb: 0.45, concedIfFail: 0.45 },
  { label: "BLOQUER", emoji: "🛡️", description: "Couper la trajectoire", baseProb: 0.60, concedIfFail: 0.35 },
  { label: "DÉGAGER", emoji: "🦶", description: "Éloigner le danger",    baseProb: 0.72, concedIfFail: 0.18 },
];

export type TacticalActionInfo = { label: string; emoji: string; description: string };

export const CAREER_ATTACK_ACTIONS: TacticalActionInfo[] = ATTACK_ACTIONS_CFG;
export const CAREER_DEFENSE_ACTIONS: TacticalActionInfo[] = DEFENSE_ACTIONS_CFG;

// ─── Situation context pools ──────────────────────────────────────────────────

const ATTACK_CONTEXTS: Array<{ text: string; prefPos: CareerPos }> = [
  { text: "{name} reçoit un centre dans la surface !", prefPos: "ATT" },
  { text: "{name} part en profondeur sur une passe en retrait !", prefPos: "ATT" },
  { text: "{name} élimine un défenseur et fonce vers le but !", prefPos: "ATT" },
  { text: "{name} récupère le ballon à l'entrée de la surface !", prefPos: "MID" },
  { text: "{name} se retrouve seul face au gardien !", prefPos: "ATT" },
  { text: "Corner ! {name} attaque le ballon au premier poteau !", prefPos: "DEF" },
  { text: "{name} part en contre-attaque avec de l'espace !", prefPos: "ATT" },
  { text: "Erreur défensive adverse — {name} en profite !", prefPos: "MID" },
];

const DEFENSE_CONTEXTS: Array<{ text: string; prefPos: CareerPos }> = [
  { text: "L'attaquant adverse fonce vers {name} !", prefPos: "DEF" },
  { text: "Tir adverse cadré — {name} est sur la trajectoire !", prefPos: "GK" },
  { text: "Centre dangereux dans la surface, {name} doit intervenir !", prefPos: "DEF" },
  { text: "Contre-attaque adverse — {name} est le dernier défenseur !", prefPos: "DEF" },
  { text: "Corner adverse — {name} doit détourner !", prefPos: "GK" },
  { text: "L'ailier adverse déborde, {name} doit le stopper !", prefPos: "DEF" },
  { text: "Coup franc adverse dangereux, {name} couvre le mur !", prefPos: "DEF" },
  { text: "La frappe adverse file vers {name} !", prefPos: "GK" },
];

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
  if (diff === "facile") return 82 + Math.floor(Math.random() * 13);
  if (diff === "moyen")  return 68 + Math.floor(Math.random() * 13);
  return 52 + Math.floor(Math.random() * 14);
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

  const shuffled = shuffle(clubs);
  shuffled.forEach((opp, i) => {
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
    v: 3,
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

// ─── Match situation generation ───────────────────────────────────────────────

function clampProb(p: number): number {
  return Math.min(88, Math.max(15, Math.round(p * 100)));
}

function generateMatchSituations(
  squad: CareerPlayer[],
  startingXI: string[],
  opponentRating: number,
): MatchSituation[] {
  const starters = squad.filter(p => startingXI.includes(p.uid));

  const byPos: Record<CareerPos, CareerPlayer[]> = { GK: [], DEF: [], MID: [], ATT: [] };
  for (const p of starters) byPos[p.position].push(p);

  function getPlayer(prefPos: CareerPos): CareerPlayer {
    const opts = byPos[prefPos];
    if (opts.length) return pick(opts);
    return starters.length ? pick(starters) : { uid: "", name: "Ton joueur", position: prefPos, rating: 50, age: 25, nationality: "France", value: 0, wage: 0, morale: 70 };
  }

  // 3 attack + 3 defense, shuffled
  const phases = shuffle(["attack","attack","attack","defense","defense","defense"] as const);

  return phases.map(phase => {
    if (phase === "attack") {
      const ctx = pick(ATTACK_CONTEXTS);
      const player = getPlayer(ctx.prefPos);
      const diff = (player.rating - opponentRating) * 0.004;
      return {
        phase: "attack",
        context: ctx.text.replace("{name}", player.name),
        playerName: player.name,
        playerRating: player.rating,
        successProbs: [
          clampProb(ATTACK_ACTIONS_CFG[0].baseProb + diff),
          clampProb(ATTACK_ACTIONS_CFG[1].baseProb + diff),
          clampProb(ATTACK_ACTIONS_CFG[2].baseProb + diff),
        ],
      };
    } else {
      const ctx = pick(DEFENSE_CONTEXTS);
      const player = getPlayer(ctx.prefPos);
      const diff = (player.rating - opponentRating) * 0.004;
      return {
        phase: "defense",
        context: ctx.text.replace("{name}", player.name),
        playerName: player.name,
        playerRating: player.rating,
        successProbs: [
          clampProb(DEFENSE_ACTIONS_CFG[0].baseProb + diff),
          clampProb(DEFENSE_ACTIONS_CFG[1].baseProb + diff),
          clampProb(DEFENSE_ACTIONS_CFG[2].baseProb + diff),
        ],
      };
    }
  });
}

// ─── Match logic ──────────────────────────────────────────────────────────────

export function startMatch(state: CareerState, fixtureUid: string): CareerState {
  const fixture = state.fixtures.find(f => f.uid === fixtureUid);
  if (!fixture) return state;
  const yourRating = avgRating(state.squad, state.startingXI);
  const situations = generateMatchSituations(state.squad, state.startingXI, fixture.opponentRating);
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
      situation: 0, half: 1,
      situations,
      log: [{ text: `Coup d'envoi ! ${state.clubName} vs ${fixture.opponentName.replace("⚽ ","")}`, type: "neutral" }],
    },
  };
}

export function chooseSituationAction(
  state: CareerState,
  actionIdx: number,
): CareerState {
  if (!state.match) return state;
  const m = state.match;
  const sitIdx = m.situation;
  const sit = m.situations[sitIdx];
  if (!sit || sit.chosenIdx !== undefined) return state;

  const prob = sit.successProbs[actionIdx] / 100;
  const success = Math.random() < prob;

  let myGoals = m.myGoals;
  let opponentGoals = m.opponentGoals;
  let logType: MatchLogEntry["type"];
  let outcomeText: string;

  const cfg = sit.phase === "attack" ? ATTACK_ACTIONS_CFG[actionIdx] : DEFENSE_ACTIONS_CFG[actionIdx];

  if (sit.phase === "attack") {
    if (success) {
      if (Math.random() < (cfg.goalIfSuccess ?? 0.4)) {
        myGoals++;
        outcomeText = `${cfg.emoji} ${cfg.label} réussi — BUUUT ! ${sit.playerName} marque ! ⚽`;
        logType = "goal_us";
      } else {
        outcomeText = `${cfg.emoji} ${cfg.label} réussi — mais le gardien repousse !`;
        logType = "chance_us";
      }
    } else {
      if (Math.random() < (cfg.counterIfFail ?? 0.18)) {
        opponentGoals++;
        outcomeText = `${cfg.emoji} ${cfg.label} raté — contre-attaque adverse... BUT ! ⚽`;
        logType = "goal_them";
      } else {
        outcomeText = `${cfg.emoji} ${cfg.label} raté — ballon perdu.`;
        logType = "chance_them";
      }
    }
  } else {
    if (success) {
      outcomeText = `${cfg.emoji} ${cfg.label} réussi — danger écarté !`;
      logType = "chance_us";
    } else {
      if (Math.random() < (cfg.concedIfFail ?? 0.30)) {
        opponentGoals++;
        outcomeText = `${cfg.emoji} ${cfg.label} raté — l'adversaire marque ! ⚽`;
        logType = "goal_them";
      } else {
        outcomeText = `${cfg.emoji} ${cfg.label} raté — l'attaquant rate son tir !`;
        logType = "chance_them";
      }
    }
  }

  const updatedSituations = m.situations.map((s, i) =>
    i === sitIdx ? { ...s, chosenIdx: actionIdx, outcome: success ? "success" as const : "fail" as const, outcomeText } : s
  );

  const nextSit = sitIdx + 1;
  const half: 1|2 = nextSit < TOTAL_SITUATIONS / 2 ? 1 : 2;
  const halfLog: MatchLogEntry[] = [];
  if (nextSit === TOTAL_SITUATIONS / 2) {
    halfLog.push({ text: `🔔 Mi-temps ! ${state.clubName} ${myGoals} — ${opponentGoals} ${m.opponentName.replace("⚽ ","")}`, type: "neutral" });
  }

  const logEntry: MatchLogEntry = { text: outcomeText, type: logType };
  const newLog = [...m.log, logEntry, ...halfLog];
  const finished = nextSit >= TOTAL_SITUATIONS;

  return {
    ...state,
    phase: finished ? "match_result" : "match",
    match: {
      ...m,
      myGoals, opponentGoals,
      situation: nextSit,
      half,
      situations: updatedSituations,
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

type QuizPlayer = { name: string; clubs: string[]; nationalities: string[]; positions: string[]; birthYear?: number; diff?: string };

export function generateTransferMarket(
  division: 1|2|3,
  quizPlayers: QuizPlayer[],
): CareerPlayer[] {
  const market: CareerPlayer[] = [];

  const unknownCount = 5 + Math.floor(Math.random() * 4);
  const positions: CareerPos[] = ["GK","DEF","DEF","MID","MID","ATT","ATT","DEF","MID"];
  for (let i = 0; i < unknownCount; i++) {
    market.push(genSquadPlayer(positions[i % positions.length], division));
  }

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
    if (s.v !== 3) return null;
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
