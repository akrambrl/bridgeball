import { useCallback, useState } from "react";
import { PLAYERS } from "../../players.jsx";

// ── Mode "Undercover" foot, en local (pass-and-play) ──────────────────────────
// Chaque joueur reçoit en secret le nom d'un footballeur. Les CIVILS ont tous le
// même joueur ; le(s) UNDERCOVER ont un joueur proche (même poste, même époque) ;
// le(s) MR. WHITE n'ont aucun mot. Quand on prend le téléphone, on saisit son
// prénom puis on dévoile son mot. À tour de rôle on donne un indice oral, puis
// on vote pour éliminer un suspect. Les civils gagnent en éliminant imposteurs +
// Mr. White ; les imposteurs gagnent à la parité ; Mr. White peut voler la
// victoire en devinant le joueur des civils s'il est éliminé.

type Player = {
  name: string;
  clubs?: string[];
  nationalities?: string[];
  positions?: string[];
  diff?: string;
  birthYear?: number;
};

type Role = "civil" | "undercover" | "mrwhite";

type Slot = {
  id: number;
  name: string;
  role: Role;
  word: string | null; // null pour Mr. White
  alive: boolean;
};

type Phase = "setup" | "reveal" | "clues" | "vote" | "mrwhite" | "end";

// Normalisation tolérante (sans accents ni ponctuation) pour comparer les noms.
const normName = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

// Liste blanche de superstars "grand public" : indépendante du tag de la base,
// elle garantit que civils comme undercover tombent sur un joueur que tout le
// monde connaît (et non un "facile" trop pointu type Dimarco).
const SUPERSTARS = [
  // Attaquants
  "Pele", "Diego Maradona", "George Weah", "Roberto Baggio", "Gabriel Batistuta",
  "Ronaldo Nazario", "Thierry Henry", "Didier Drogba", "Ronaldinho", "Fernando Torres",
  "Cristiano Ronaldo", "Wayne Rooney", "Lionel Messi", "Karim Benzema", "Luis Suarez",
  "Edinson Cavani", "Robert Lewandowski", "Antoine Griezmann", "Neymar", "Mohamed Salah",
  "Sadio Mane", "Harry Kane", "Romelu Lukaku", "Lautaro Martinez", "Marcus Rashford",
  "Kylian Mbappe", "Erling Haaland", "Vinicius Junior", "Phil Foden", "Bukayo Saka",
  "Zlatan Ibrahimovic", "Samuel Eto'o", "Sergio Aguero", "Rafael Leao", "Heung-min Son",
  "David Beckham",
  // Milieux
  "Zinedine Zidane", "Andres Iniesta", "Xavi", "Frank Lampard", "Steven Gerrard",
  "Andrea Pirlo", "Kaka", "Luka Modric", "David Silva", "Mesut Ozil", "Toni Kroos",
  "Kevin De Bruyne", "Paul Pogba", "N'Golo Kante", "Cesc Fabregas", "Bernardo Silva",
  "Federico Valverde", "Pedri", "Jude Bellingham",
  // Défenseurs
  "Paolo Maldini", "Cafu", "Fabio Cannavaro", "Roberto Carlos", "Alessandro Nesta",
  "Carles Puyol", "John Terry", "Dani Alves", "Philipp Lahm", "Thiago Silva",
  "Sergio Ramos", "Marcelo", "Virgil van Dijk", "Ruben Dias", "Achraf Hakimi",
  "Trent Alexander-Arnold", "Gerard Pique",
  // Gardiens
  "Oliver Kahn", "Edwin van der Sar", "Gianluigi Buffon", "Iker Casillas", "Petr Cech",
  "Manuel Neuer", "Thibaut Courtois", "Marc-Andre ter Stegen", "Ederson", "Alisson Becker",
];
const SUPERSTAR_SET = new Set(SUPERSTARS.map(normName));

const ALL = (PLAYERS as Player[]).filter(
  (p) => p && p.birthYear && p.positions?.length && SUPERSTAR_SET.has(normName(p.name))
);

const primaryPos = (p: Player) => p.positions?.[0] ?? "";
const rnd = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Construit une paire "civil / undercover" plausible : même poste principal et
// époque proche (±6 ans) pour que les deux joueurs soient confondables.
function makePair(): { civ: string; und: string } {
  for (let i = 0; i < 300; i++) {
    const civ = rnd(ALL);
    const pos = primaryPos(civ);
    const pool = ALL.filter(
      (p) =>
        p.name !== civ.name &&
        primaryPos(p) === pos &&
        Math.abs((p.birthYear || 0) - (civ.birthYear || 0)) <= 6
    );
    if (pool.length) return { civ: civ.name, und: rnd(pool).name };
  }
  const a = rnd(ALL);
  let b = rnd(ALL);
  while (b.name === a.name) b = rnd(ALL);
  return { civ: a.name, und: b.name };
}

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const RoleLabel: Record<Role, string> = {
  civil: "CIVIL",
  undercover: "UNDERCOVER",
  mrwhite: "MR. WHITE",
};
const RoleColor: Record<Role, string> = {
  civil: "#00E676",
  undercover: "#FF8A2A",
  mrwhite: "#C084FC",
};

export const Undercover = ({ onClose }: { onClose: () => void }) => {
  const [phase, setPhase] = useState<Phase>("setup");
  const [nbPlayers, setNbPlayers] = useState(5);
  const [nbUnder, setNbUnder] = useState(1);
  const [nbWhite, setNbWhite] = useState(1);

  const [slots, setSlots] = useState<Slot[]>([]);
  const [pair, setPair] = useState<{ civ: string; und: string }>({ civ: "", und: "" });
  const [revealIdx, setRevealIdx] = useState(0);
  const [revealStage, setRevealStage] = useState<"name" | "word">("name");
  const [nameInput, setNameInput] = useState("");
  const [order, setOrder] = useState<number[]>([]);
  const [eliminated, setEliminated] = useState<Slot | null>(null);
  const [mrWhiteGuess, setMrWhiteGuess] = useState("");
  const [winner, setWinner] = useState<"civils" | "imposteurs" | "mrwhite" | null>(null);

  const impostors = nbUnder + nbWhite;
  const civils = nbPlayers - impostors;
  const maxUnder = Math.max(1, nbPlayers - nbWhite - 2);
  const maxWhite = Math.max(0, nbPlayers - nbUnder - 2);
  const configValid = nbPlayers >= 3 && impostors >= 1 && civils >= 2;

  // Réglage du nombre de joueurs : on reborne les rôles pour garder ≥ 2 civils.
  const changePlayers = (n: number) => {
    const v = Math.max(3, Math.min(12, n));
    setNbPlayers(v);
    setNbUnder((u) => Math.min(u, Math.max(1, v - nbWhite - 2)));
    setNbWhite((w) => Math.min(w, Math.max(0, v - nbUnder - 2)));
  };

  const startGame = useCallback(() => {
    const p = makePair();
    setPair(p);
    const roles: Role[] = [];
    for (let i = 0; i < nbUnder; i++) roles.push("undercover");
    for (let i = 0; i < nbWhite; i++) roles.push("mrwhite");
    while (roles.length < nbPlayers) roles.push("civil");
    const newSlots: Slot[] = shuffle(roles).map((role, i) => ({
      id: i + 1,
      name: `Joueur ${i + 1}`,
      role,
      word: role === "civil" ? p.civ : role === "undercover" ? p.und : null,
      alive: true,
    }));
    setSlots(newSlots);
    setRevealIdx(0);
    setRevealStage("name");
    setNameInput("");
    setEliminated(null);
    setMrWhiteGuess("");
    setWinner(null);
    setPhase("reveal");
  }, [nbPlayers, nbUnder, nbWhite]);

  const checkWin = useCallback((next: Slot[]): "civils" | "imposteurs" | null => {
    const alive = next.filter((s) => s.alive);
    const imp = alive.filter((s) => s.role !== "civil").length;
    const civ = alive.filter((s) => s.role === "civil").length;
    if (imp === 0) return "civils";
    if (imp >= civ) return "imposteurs";
    return null;
  }, []);

  const startCluesRound = useCallback((src: Slot[]) => {
    const alive = src.filter((s) => s.alive);
    const ids = shuffle(alive.map((s) => s.id));
    const roleOf = (id: number) => alive.find((s) => s.id === id)?.role;
    // Mr. White n'a pas de mot : il ne doit jamais ouvrir le tour de table.
    if (roleOf(ids[0]) === "mrwhite") {
      const j = ids.findIndex((id, i) => i > 0 && roleOf(id) !== "mrwhite");
      if (j > 0) [ids[0], ids[j]] = [ids[j], ids[0]];
    }
    setOrder(ids);
    setEliminated(null);
    setPhase("clues");
  }, []);

  // Le joueur courant saisit son prénom → on dévoile sa carte.
  const confirmName = () => {
    const nm = nameInput.trim();
    if (!nm) return;
    setSlots((prev) => prev.map((s, i) => (i === revealIdx ? { ...s, name: nm } : s)));
    setRevealStage("word");
  };

  const nextReveal = () => {
    if (revealIdx + 1 >= slots.length) {
      startCluesRound(slots);
    } else {
      setRevealIdx(revealIdx + 1);
      setRevealStage("name");
      setNameInput("");
    }
  };

  const eliminate = (id: number) => {
    const slot = slots.find((s) => s.id === id);
    if (!slot) return;
    const next = slots.map((s) => (s.id === id ? { ...s, alive: false } : s));
    setSlots(next);
    setEliminated(slot);
    if (slot.role === "mrwhite") {
      setMrWhiteGuess("");
      setPhase("mrwhite");
      return;
    }
    const w = checkWin(next);
    if (w) {
      setWinner(w);
      setPhase("end");
    } else {
      setPhase("vote");
    }
  };

  const submitMrWhiteGuess = () => {
    const g = normName(mrWhiteGuess);
    const target = normName(pair.civ);
    const lastName = target.split(" ").slice(-1)[0];
    const ok = g.length > 1 && (g === target || target.includes(g) || g === lastName);
    if (ok) {
      setWinner("mrwhite");
      setPhase("end");
      return;
    }
    const w = checkWin(slots);
    if (w) {
      setWinner(w);
      setPhase("end");
    } else {
      setPhase("vote");
    }
  };

  const aliveSlots = slots.filter((s) => s.alive);
  const current = slots[revealIdx];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9000] overflow-y-auto"
      style={{
        backgroundColor: "#1E5C2A",
        backgroundImage:
          "repeating-linear-gradient(90deg,#1E5C2A 0,#1E5C2A 14.28%,#276B34 14.28%,#276B34 28.57%,#1E5C2A 28.57%,#1E5C2A 42.86%,#276B34 42.86%,#276B34 57.14%,#1E5C2A 57.14%,#1E5C2A 71.43%,#276B34 71.43%,#276B34 85.71%,#1E5C2A 85.71%)",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <button
        onClick={onClose}
        className="fixed top-3 right-3 z-[9001] flex items-center gap-2 px-4 py-2 rounded-full bg-[#FF8A2A] hover:bg-[#FF7A1A] text-[#1A0F00] font-display text-sm tracking-widest shadow-[0_8px_24px_rgba(0,0,0,0.6)] hover:scale-[1.03] active:scale-[0.98] transition-all"
      >
        ← QUITTER
      </button>

      <div className="relative min-h-screen container max-w-2xl mx-auto px-4 py-6 flex flex-col">
        <div className="text-center mb-4">
          <div className="inline-block px-3 py-1 rounded-full bg-black/40 border border-white/15 backdrop-blur-sm">
            <span className="font-display text-[10px] tracking-[0.4em] text-[#FF4D6D]">
              🕵️ UNDERCOVER FOOT
            </span>
          </div>
        </div>

        {phase === "setup" && (
          <SetupView
            nbPlayers={nbPlayers}
            nbUnder={nbUnder}
            nbWhite={nbWhite}
            civils={civils}
            maxUnder={maxUnder}
            maxWhite={maxWhite}
            valid={configValid}
            onPlayers={changePlayers}
            onUnder={(n) => setNbUnder(Math.max(1, Math.min(maxUnder, n)))}
            onWhite={(n) => setNbWhite(Math.max(0, Math.min(maxWhite, n)))}
            onStart={startGame}
          />
        )}

        {phase === "reveal" && current && (
          <RevealView
            slot={current}
            index={revealIdx}
            total={slots.length}
            stage={revealStage}
            nameInput={nameInput}
            setNameInput={setNameInput}
            onConfirmName={confirmName}
            onNext={nextReveal}
          />
        )}

        {phase === "clues" && (
          <CluesView
            order={order}
            nameOf={(id) => slots.find((s) => s.id === id)?.name ?? ""}
            onVote={() => setPhase("vote")}
          />
        )}

        {phase === "vote" && !eliminated && (
          <VoteView alive={aliveSlots} onEliminate={eliminate} />
        )}

        {phase === "vote" && eliminated && (
          <EliminatedView slot={eliminated} onContinue={() => startCluesRound(slots)} />
        )}

        {phase === "mrwhite" && eliminated && (
          <MrWhiteView
            slot={eliminated}
            guess={mrWhiteGuess}
            setGuess={setMrWhiteGuess}
            onSubmit={submitMrWhiteGuess}
          />
        )}

        {phase === "end" && winner && (
          <EndView
            winner={winner}
            slots={slots}
            pair={pair}
            onReplay={() => setPhase("setup")}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
};

// ── Sous-vues ─────────────────────────────────────────────────────────────────

const RoleStepper = ({
  label,
  value,
  min,
  max,
  color,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  color: string;
  onChange: (n: number) => void;
}) => (
  <div className="flex items-center justify-between gap-3">
    <button
      onClick={() => onChange(value - 1)}
      disabled={value <= min}
      className="h-9 w-9 shrink-0 rounded-full bg-black/40 text-white text-2xl leading-none disabled:opacity-25"
    >
      −
    </button>
    <div
      className="flex-1 text-center rounded-full py-2 font-display text-lg tracking-wider"
      style={{ background: color + "22", color, border: `1.5px solid ${color}66` }}
    >
      {value} {label}
    </div>
    <button
      onClick={() => onChange(value + 1)}
      disabled={value >= max}
      className="h-9 w-9 shrink-0 rounded-full bg-black/40 text-white text-2xl leading-none disabled:opacity-25"
    >
      +
    </button>
  </div>
);

const SetupView = ({
  nbPlayers,
  nbUnder,
  nbWhite,
  civils,
  maxUnder,
  maxWhite,
  valid,
  onPlayers,
  onUnder,
  onWhite,
  onStart,
}: {
  nbPlayers: number;
  nbUnder: number;
  nbWhite: number;
  civils: number;
  maxUnder: number;
  maxWhite: number;
  valid: boolean;
  onPlayers: (n: number) => void;
  onUnder: (n: number) => void;
  onWhite: (n: number) => void;
  onStart: () => void;
}) => (
  <div className="flex-1 flex flex-col">
    <h1 className="font-display text-4xl tracking-wider text-white text-center leading-none mb-1">
      JOUEURS : {nbPlayers}
    </h1>
    <p className="text-center text-white/55 text-sm mb-5">
      Un seul téléphone, on se le passe. 🕵️
    </p>

    {/* Stepper joueurs */}
    <div className="flex items-center justify-center gap-5 mb-6">
      <button
        onClick={() => onPlayers(nbPlayers - 1)}
        disabled={nbPlayers <= 3}
        className="h-12 w-12 rounded-full bg-black/40 text-white text-3xl leading-none disabled:opacity-25 active:scale-95 transition-transform"
      >
        −
      </button>
      <div className="font-display text-5xl text-[#FFC93C] w-16 text-center">{nbPlayers}</div>
      <button
        onClick={() => onPlayers(nbPlayers + 1)}
        disabled={nbPlayers >= 12}
        className="h-12 w-12 rounded-full bg-black/40 text-white text-3xl leading-none disabled:opacity-25 active:scale-95 transition-transform"
      >
        +
      </button>
    </div>

    {/* Carte rôles */}
    <div className="rounded-3xl bg-black/35 border border-white/10 p-5 space-y-3">
      <div className="flex justify-center">
        <span
          className="px-5 py-1.5 rounded-full font-display text-lg tracking-wider"
          style={{ background: "#00E67622", color: "#00E676", border: "1.5px solid #00E67666" }}
        >
          {civils} Civil{civils > 1 ? "s" : ""}
        </span>
      </div>
      <RoleStepper
        label="Undercover"
        value={nbUnder}
        min={1}
        max={maxUnder}
        color="#FF8A2A"
        onChange={onUnder}
      />
      <RoleStepper
        label="Mr. White"
        value={nbWhite}
        min={0}
        max={maxWhite}
        color="#C084FC"
        onChange={onWhite}
      />
    </div>

    <p className="text-center text-[11px] text-white/40 mt-4 italic">
      Chacun écrira son prénom au moment de découvrir sa carte.
    </p>

    <button
      onClick={onStart}
      disabled={!valid}
      className="w-full py-4 mt-auto rounded-2xl bg-gradient-to-r from-[#00C966] to-[#00E676] text-[#0A1410] font-display text-2xl tracking-widest hover:scale-[1.02] active:scale-[0.97] transition-transform shadow-[0_10px_30px_rgba(0,230,118,0.35)] disabled:opacity-40 disabled:hover:scale-100"
    >
      COMMENCER
    </button>
  </div>
);

const RevealView = ({
  slot,
  index,
  total,
  stage,
  nameInput,
  setNameInput,
  onConfirmName,
  onNext,
}: {
  slot: Slot;
  index: number;
  total: number;
  stage: "name" | "word";
  nameInput: string;
  setNameInput: (s: string) => void;
  onConfirmName: () => void;
  onNext: () => void;
}) => {
  const named = nameInput.trim().length > 0;
  if (stage === "name") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-5">
        <div className="font-display text-xs tracking-[0.4em] text-white/50">
          JOUEUR {index + 1} / {total}
        </div>
        <div className="text-5xl">📱</div>
        <h2 className="font-display text-2xl tracking-wider text-white leading-tight">
          Passe le téléphone au<br />joueur suivant
        </h2>
        <div
          className="rounded-3xl px-6 py-6 border-2 w-full max-w-sm"
          style={{
            background: "linear-gradient(180deg, rgba(0,201,102,0.12), rgba(0,0,0,0.4))",
            borderColor: "rgba(0,230,118,0.5)",
          }}
        >
          <div className="text-4xl mb-3">🙂</div>
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onConfirmName()}
            maxLength={14}
            autoFocus
            placeholder="Écris ton prénom"
            className="w-full rounded-xl bg-black/40 border-2 border-white/15 px-4 py-3 text-center text-white font-display text-xl tracking-wide outline-none focus:border-[#00E676]"
          />
          <div className="text-[13px] text-white/70 mt-3 font-bold">
            Écris ton prénom pour voir ta carte
          </div>
        </div>
        <button
          onClick={onConfirmName}
          disabled={!named}
          className="px-10 py-4 rounded-2xl bg-gradient-to-r from-[#00C966] to-[#00E676] text-[#0A1410] font-display text-xl tracking-widest hover:scale-[1.03] active:scale-[0.97] transition-transform disabled:opacity-40 disabled:hover:scale-100"
        >
          👁 VOIR MA CARTE
        </button>
      </div>
    );
  }

  // stage === "word"
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-5">
      <div className="font-display text-sm tracking-[0.35em] text-white/50">
        {slot.name.toUpperCase()}
      </div>
      {slot.word ? (
        <div
          className="rounded-3xl px-8 py-7 border-2 max-w-sm"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(0,0,0,0.4))",
            borderColor: "rgba(255,201,60,0.5)",
          }}
        >
          <div className="text-5xl mb-2">⚽</div>
          <div className="font-display text-3xl tracking-wide text-white break-words">
            {slot.word}
          </div>
          <div className="text-[11px] text-white/50 mt-3 italic">
            Donne un indice à l'oral, sans dire le nom !
          </div>
        </div>
      ) : (
        <div
          className="rounded-3xl px-8 py-7 border-2 max-w-sm"
          style={{
            background: "linear-gradient(180deg, rgba(192,132,252,0.18), rgba(0,0,0,0.5))",
            borderColor: "rgba(192,132,252,0.6)",
          }}
        >
          <div className="text-5xl mb-2">🕵️</div>
          <div className="font-display text-3xl tracking-wide text-[#C084FC]">MR. WHITE</div>
          <div className="text-[11px] text-white/60 mt-3 italic">
            Tu n'as aucun mot. Écoute, bluffe, et fais-toi passer pour un civil !
          </div>
        </div>
      )}
      <button
        onClick={onNext}
        className="px-10 py-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-display text-lg tracking-widest transition-colors"
      >
        OK, CACHER ET PASSER →
      </button>
    </div>
  );
};

const CluesView = ({
  order,
  nameOf,
  onVote,
}: {
  order: number[];
  nameOf: (id: number) => string;
  onVote: () => void;
}) => (
  <div className="flex-1 flex flex-col">
    <h2 className="font-display text-2xl tracking-wider text-white text-center mb-3">
      TOUR DE TABLE
    </h2>
    {order.length > 0 && (
      <div
        className="rounded-2xl px-5 py-4 mb-4 text-center border-2"
        style={{
          background: "linear-gradient(135deg, rgba(255,201,60,0.18), rgba(255,138,42,0.12))",
          borderColor: "rgba(255,201,60,0.6)",
        }}
      >
        <div className="text-3xl mb-1">🎤</div>
        <div className="font-display text-2xl tracking-wider text-[#FFC93C] break-words">
          {nameOf(order[0])} commence !
        </div>
      </div>
    )}
    <p className="text-center text-white/60 text-sm mb-4">
      Dans cet ordre, chacun donne <b>un mot d'indice</b> sur son joueur (sans le nommer).
    </p>
    <div className="grid grid-cols-2 gap-3 mb-6">
      {order.map((id, i) => (
        <div
          key={id}
          className={
            "relative flex flex-col items-center justify-center gap-2 rounded-2xl border-2 py-5 px-2 " +
            (i === 0
              ? "bg-[#FFC93C]/15 border-[#FFC93C]/70 shadow-[0_6px_20px_rgba(255,201,60,0.25)]"
              : "bg-black/30 border-white/10")
          }
        >
          <span
            className={
              "h-9 w-9 rounded-full font-display text-base flex items-center justify-center " +
              (i === 0 ? "bg-[#FFC93C] text-[#1A0F00]" : "bg-white/15 text-white")
            }
          >
            {i + 1}
          </span>
          <span className="font-display text-lg tracking-wide text-white text-center break-words leading-tight">
            {nameOf(id)}
          </span>
          {i === 0 && (
            <span className="text-[10px] font-display tracking-widest text-[#FFC93C]">DÉBUT</span>
          )}
        </div>
      ))}
    </div>
    <button
      onClick={onVote}
      className="w-full py-4 mt-auto rounded-2xl bg-gradient-to-r from-[#FF4D6D] to-[#FF8A2A] text-white font-display text-xl tracking-widest hover:scale-[1.02] active:scale-[0.97] transition-transform"
    >
      🗳 PASSER AU VOTE
    </button>
  </div>
);

const VoteView = ({
  alive,
  onEliminate,
}: {
  alive: Slot[];
  onEliminate: (id: number) => void;
}) => (
  <div className="flex-1 flex flex-col">
    <h2 className="font-display text-2xl tracking-wider text-white text-center mb-1">
      QUI EST ÉLIMINÉ ?
    </h2>
    <p className="text-center text-white/60 text-sm mb-4">
      Débattez, votez à l'oral, puis appuyez sur le joueur éliminé.
    </p>
    <div className="grid grid-cols-2 gap-3">
      {alive.map((s) => (
        <button
          key={s.id}
          onClick={() => onEliminate(s.id)}
          className="py-5 px-2 rounded-2xl bg-black/30 border-2 border-white/10 hover:border-[#FF4D6D] hover:bg-[#FF4D6D]/10 text-white font-display text-xl tracking-wider transition-all active:scale-[0.97] break-words"
        >
          {s.name}
        </button>
      ))}
    </div>
  </div>
);

const EliminatedView = ({ slot, onContinue }: { slot: Slot; onContinue: () => void }) => (
  <div className="flex-1 flex flex-col items-center justify-center text-center gap-5">
    <div className="text-6xl">{slot.role === "civil" ? "💀" : "🎯"}</div>
    <h2 className="font-display text-3xl tracking-wider text-white break-words max-w-sm">
      {slot.name} ÉLIMINÉ·E
    </h2>
    <div
      className="rounded-2xl px-6 py-4 border-2"
      style={{ borderColor: RoleColor[slot.role] + "80", background: RoleColor[slot.role] + "1A" }}
    >
      <div className="font-display text-2xl tracking-widest" style={{ color: RoleColor[slot.role] }}>
        C'ÉTAIT UN {RoleLabel[slot.role]}
      </div>
      {slot.word && <div className="text-sm text-white/70 mt-1">Son joueur : {slot.word}</div>}
    </div>
    <button
      onClick={onContinue}
      className="px-10 py-4 rounded-2xl bg-gradient-to-r from-[#00C966] to-[#00E676] text-[#0A1410] font-display text-lg tracking-widest hover:scale-[1.03] transition-transform"
    >
      MANCHE SUIVANTE →
    </button>
  </div>
);

const MrWhiteView = ({
  slot,
  guess,
  setGuess,
  onSubmit,
}: {
  slot: Slot;
  guess: string;
  setGuess: (s: string) => void;
  onSubmit: () => void;
}) => (
  <div className="flex-1 flex flex-col items-center justify-center text-center gap-5">
    <div className="text-6xl">🕵️</div>
    <h2 className="font-display text-3xl tracking-wider text-[#C084FC] break-words max-w-sm">
      {slot.name} ÉTAIT MR. WHITE !
    </h2>
    <p className="text-white/70 text-sm max-w-xs">
      Dernière chance : devine le <b>joueur des civils</b>. Si tu trouves, tu voles la victoire !
    </p>
    <input
      value={guess}
      onChange={(e) => setGuess(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && onSubmit()}
      placeholder="Nom du joueur…"
      autoFocus
      className="w-full max-w-sm rounded-2xl bg-black/40 border-2 border-[#C084FC]/50 px-5 py-4 text-center text-white font-display text-xl tracking-wide outline-none focus:border-[#C084FC]"
    />
    <button
      onClick={onSubmit}
      className="px-10 py-4 rounded-2xl bg-gradient-to-r from-[#C084FC] to-[#7C3AED] text-white font-display text-lg tracking-widest hover:scale-[1.03] transition-transform"
    >
      DEVINER
    </button>
  </div>
);

const EndView = ({
  winner,
  slots,
  pair,
  onReplay,
  onClose,
}: {
  winner: "civils" | "imposteurs" | "mrwhite";
  slots: Slot[];
  pair: { civ: string; und: string };
  onReplay: () => void;
  onClose: () => void;
}) => {
  const title =
    winner === "civils"
      ? "LES CIVILS GAGNENT !"
      : winner === "mrwhite"
      ? "MR. WHITE GAGNE !"
      : "LES IMPOSTEURS GAGNENT !";
  const color = winner === "civils" ? "#00E676" : winner === "mrwhite" ? "#C084FC" : "#FF8A2A";
  return (
    <div className="flex-1 flex flex-col items-center text-center gap-4 pt-2">
      <div className="text-6xl">🏆</div>
      <h2 className="font-display text-4xl tracking-wider leading-none" style={{ color }}>
        {title}
      </h2>
      <div className="text-sm text-white/70">
        Civils : <span className="text-[#00E676] font-bold">{pair.civ}</span> · Undercover :{" "}
        <span className="text-[#FF8A2A] font-bold">{pair.und}</span>
      </div>

      <div className="w-full max-w-sm rounded-2xl bg-black/30 border border-white/10 p-3 space-y-1 mt-1">
        {slots.map((s) => (
          <div key={s.id} className="flex items-center justify-between text-sm px-2 py-1 gap-2">
            <span
              className={
                "font-display tracking-wide truncate " +
                (s.alive ? "text-white" : "text-white/40 line-through")
              }
            >
              {s.name}
            </span>
            <span
              className="font-display tracking-wider text-right shrink-0"
              style={{ color: RoleColor[s.role] }}
            >
              {RoleLabel[s.role]}
              {s.word ? ` · ${s.word}` : ""}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-sm mt-2">
        <button
          onClick={onReplay}
          className="py-4 rounded-2xl bg-gradient-to-r from-[#FF8A2A] to-[#FFC93C] text-[#1A0F00] font-display text-lg tracking-widest hover:scale-[1.02] transition-transform"
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
};
