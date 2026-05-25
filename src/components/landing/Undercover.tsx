import { useCallback, useMemo, useState } from "react";
import { PLAYERS } from "../../players.jsx";

// ── Mode "Undercover" foot, en local (pass-and-play) ──────────────────────────
// Chaque joueur reçoit en secret le nom d'un footballeur. Les CIVILS ont tous le
// même joueur ; le(s) UNDERCOVER ont un joueur proche (même poste, même époque) ;
// le MR. WHITE n'a aucun mot. À tour de rôle on donne un indice oral, puis on
// vote pour éliminer un suspect. Les civils gagnent en éliminant imposteurs +
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
  role: Role;
  word: string | null; // null pour Mr. White
  alive: boolean;
};

type Phase = "setup" | "reveal" | "clues" | "vote" | "mrwhite" | "end";

const ALL = (PLAYERS as Player[]).filter(
  (p) => p && p.birthYear && (p.diff === "facile" || p.diff === "moyen") && p.positions?.length
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
  // Repli : deux joueurs distincts au hasard
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

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .trim();

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
  const [withWhite, setWithWhite] = useState(true);

  const [slots, setSlots] = useState<Slot[]>([]);
  const [pair, setPair] = useState<{ civ: string; und: string }>({ civ: "", und: "" });
  const [revealIdx, setRevealIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [order, setOrder] = useState<number[]>([]);
  const [eliminated, setEliminated] = useState<Slot | null>(null);
  const [mrWhiteGuess, setMrWhiteGuess] = useState("");
  const [winner, setWinner] = useState<"civils" | "imposteurs" | "mrwhite" | null>(null);

  // Au moins 2 civils de plus que d'imposteurs pour une partie jouable.
  const impostors = nbUnder + (withWhite ? 1 : 0);
  const configValid = nbPlayers >= 3 && impostors >= 1 && nbPlayers - impostors >= 2;

  const startGame = useCallback(() => {
    const p = makePair();
    setPair(p);
    const roles: Role[] = [];
    for (let i = 0; i < nbUnder; i++) roles.push("undercover");
    if (withWhite) roles.push("mrwhite");
    while (roles.length < nbPlayers) roles.push("civil");
    const shuffledRoles = shuffle(roles);
    const newSlots: Slot[] = shuffledRoles.map((role, i) => ({
      id: i + 1,
      role,
      word: role === "civil" ? p.civ : role === "undercover" ? p.und : null,
      alive: true,
    }));
    setSlots(newSlots);
    setRevealIdx(0);
    setRevealed(false);
    setEliminated(null);
    setMrWhiteGuess("");
    setWinner(null);
    setPhase("reveal");
  }, [nbPlayers, nbUnder, withWhite]);

  // ── Vérifie l'issue après une élimination ───────────────────────────────────
  const checkWin = useCallback((next: Slot[]): typeof winner => {
    const alive = next.filter((s) => s.alive);
    const imp = alive.filter((s) => s.role !== "civil").length;
    const civ = alive.filter((s) => s.role === "civil").length;
    if (imp === 0) return "civils";
    if (imp >= civ) return "imposteurs";
    return null;
  }, []);

  const startCluesRound = useCallback((src: Slot[]) => {
    const aliveIds = src.filter((s) => s.alive).map((s) => s.id);
    setOrder(shuffle(aliveIds));
    setEliminated(null);
    setPhase("clues");
  }, []);

  // Élimine un joueur (vote du groupe).
  const eliminate = (id: number) => {
    const slot = slots.find((s) => s.id === id);
    if (!slot) return;
    const next = slots.map((s) => (s.id === id ? { ...s, alive: false } : s));
    setSlots(next);
    setEliminated(slot);
    if (slot.role === "mrwhite") {
      // Mr. White éliminé → une chance de deviner le joueur des civils.
      setMrWhiteGuess("");
      setPhase("mrwhite");
      return;
    }
    const w = checkWin(next);
    if (w) {
      setWinner(w);
      setPhase("end");
    } else {
      setPhase("vote"); // reste sur l'écran de révélation d'élimination
    }
  };

  const submitMrWhiteGuess = () => {
    const g = normalize(mrWhiteGuess);
    const target = normalize(pair.civ);
    const lastName = target.split(" ").slice(-1)[0];
    const ok = g.length > 1 && (g === target || target.includes(g) || g === lastName);
    if (ok) {
      setWinner("mrwhite");
      setPhase("end");
      return;
    }
    // Raté : on poursuit, vérifier si les civils/imposteurs ont gagné entretemps.
    const w = checkWin(slots);
    if (w) {
      setWinner(w);
      setPhase("end");
    } else {
      setPhase("vote");
    }
  };

  const aliveSlots = slots.filter((s) => s.alive);

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
            setNbPlayers={(n) => {
              setNbPlayers(n);
              const maxU = Math.max(1, n - (withWhite ? 1 : 0) - 2);
              if (nbUnder > maxU) setNbUnder(maxU);
            }}
            nbUnder={nbUnder}
            setNbUnder={setNbUnder}
            withWhite={withWhite}
            setWithWhite={setWithWhite}
            maxUnder={Math.max(1, nbPlayers - (withWhite ? 1 : 0) - 2)}
            impostors={impostors}
            valid={configValid}
            onStart={startGame}
          />
        )}

        {phase === "reveal" && (
          <RevealView
            slot={slots[revealIdx]}
            index={revealIdx}
            total={slots.length}
            revealed={revealed}
            onReveal={() => setRevealed(true)}
            onNext={() => {
              if (revealIdx + 1 >= slots.length) {
                startCluesRound(slots);
              } else {
                setRevealIdx(revealIdx + 1);
                setRevealed(false);
              }
            }}
          />
        )}

        {phase === "clues" && (
          <CluesView
            order={order}
            onVote={() => setPhase("vote")}
          />
        )}

        {phase === "vote" && !eliminated && (
          <VoteView alive={aliveSlots} onEliminate={eliminate} />
        )}

        {phase === "vote" && eliminated && (
          <EliminatedView
            slot={eliminated}
            onContinue={() => startCluesRound(slots)}
          />
        )}

        {phase === "mrwhite" && eliminated && (
          <MrWhiteView
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

const Stepper = ({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) => (
  <div className="flex items-center justify-between rounded-2xl bg-black/30 border border-white/10 px-4 py-3">
    <span className="font-display text-sm tracking-wider text-white/80">{label}</span>
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white text-xl leading-none disabled:opacity-30"
        disabled={value <= min}
      >
        −
      </button>
      <span className="font-display text-2xl text-white w-8 text-center">{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white text-xl leading-none disabled:opacity-30"
        disabled={value >= max}
      >
        +
      </button>
    </div>
  </div>
);

const SetupView = ({
  nbPlayers,
  setNbPlayers,
  nbUnder,
  setNbUnder,
  withWhite,
  setWithWhite,
  maxUnder,
  impostors,
  valid,
  onStart,
}: {
  nbPlayers: number;
  setNbPlayers: (n: number) => void;
  nbUnder: number;
  setNbUnder: (n: number) => void;
  withWhite: boolean;
  setWithWhite: (b: boolean) => void;
  maxUnder: number;
  impostors: number;
  valid: boolean;
  onStart: () => void;
}) => (
  <div className="space-y-3">
    <h1 className="font-display text-3xl lg:text-4xl tracking-wider text-white text-center mb-1 leading-tight">
      QUI EST L'IMPOSTEUR ?
    </h1>
    <p className="text-center text-white/60 text-sm mb-4 leading-snug">
      Un seul téléphone, on se le passe. Chacun reçoit en secret un joueur de foot.
      Les <span className="text-[#FF8A2A] font-bold">undercover</span> ont un joueur
      proche, le <span className="text-[#C084FC] font-bold">Mr. White</span> n'a aucun mot.
    </p>

    <Stepper label="Nombre de joueurs" value={nbPlayers} min={3} max={12} onChange={setNbPlayers} />
    <Stepper label="Undercover" value={nbUnder} min={1} max={maxUnder} onChange={setNbUnder} />

    <button
      onClick={() => setWithWhite(!withWhite)}
      className="w-full flex items-center justify-between rounded-2xl bg-black/30 border border-white/10 px-4 py-3"
    >
      <span className="font-display text-sm tracking-wider text-white/80">Mr. White</span>
      <span
        className={
          "relative h-7 w-12 rounded-full transition-colors " +
          (withWhite ? "bg-[#C084FC]" : "bg-white/15")
        }
      >
        <span
          className={
            "absolute top-1 h-5 w-5 rounded-full bg-white transition-all " +
            (withWhite ? "left-6" : "left-1")
          }
        />
      </span>
    </button>

    <div className="text-center text-xs text-white/50 pt-1">
      {impostors} imposteur{impostors > 1 ? "s" : ""} ·{" "}
      {nbPlayers - impostors} civil{nbPlayers - impostors > 1 ? "s" : ""}
    </div>

    <button
      onClick={onStart}
      disabled={!valid}
      className="w-full py-4 mt-2 rounded-2xl bg-gradient-to-r from-[#FF4D6D] to-[#FF8A2A] text-white font-display text-xl tracking-widest hover:scale-[1.02] active:scale-[0.97] transition-transform shadow-[0_10px_30px_rgba(255,77,109,0.4)] disabled:opacity-40 disabled:hover:scale-100"
    >
      ▶ DISTRIBUER LES RÔLES
    </button>
  </div>
);

const RevealView = ({
  slot,
  index,
  total,
  revealed,
  onReveal,
  onNext,
}: {
  slot: Slot;
  index: number;
  total: number;
  revealed: boolean;
  onReveal: () => void;
  onNext: () => void;
}) => (
  <div className="flex-1 flex flex-col items-center justify-center text-center gap-5">
    <div className="font-display text-xs tracking-[0.4em] text-white/50">
      {index + 1} / {total}
    </div>
    {!revealed ? (
      <>
        <div className="text-6xl">📱</div>
        <h2 className="font-display text-3xl tracking-wider text-white">
          Passe le téléphone au<br />
          <span className="text-[#FFC93C]">JOUEUR {slot.id}</span>
        </h2>
        <p className="text-white/60 text-sm max-w-xs">
          Personne d'autre ne doit regarder. Appuie pour voir ton joueur secret.
        </p>
        <button
          onClick={onReveal}
          className="px-10 py-4 rounded-2xl bg-gradient-to-r from-[#00C966] to-[#00E676] text-[#0A1410] font-display text-xl tracking-widest hover:scale-[1.03] active:scale-[0.97] transition-transform"
        >
          👁 VOIR MON RÔLE
        </button>
      </>
    ) : (
      <>
        <div className="font-display text-sm tracking-[0.35em] text-white/50">
          JOUEUR {slot.id} — TON JOUEUR
        </div>
        {slot.word ? (
          <div
            className="rounded-3xl px-8 py-7 border-2 max-w-sm"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(0,0,0,0.4))",
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
              background:
                "linear-gradient(180deg, rgba(192,132,252,0.18), rgba(0,0,0,0.5))",
              borderColor: "rgba(192,132,252,0.6)",
            }}
          >
            <div className="text-5xl mb-2">🕵️</div>
            <div className="font-display text-3xl tracking-wide text-[#C084FC]">
              MR. WHITE
            </div>
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
      </>
    )}
  </div>
);

const CluesView = ({ order, onVote }: { order: number[]; onVote: () => void }) => (
  <div className="flex-1 flex flex-col">
    <h2 className="font-display text-2xl tracking-wider text-white text-center mb-1">
      TOUR DE TABLE
    </h2>
    <p className="text-center text-white/60 text-sm mb-4">
      Dans cet ordre, chacun donne <b>un mot d'indice</b> sur son joueur (sans le nommer).
    </p>
    <div className="space-y-2 mb-6">
      {order.map((id, i) => (
        <div
          key={id}
          className="flex items-center gap-3 rounded-xl bg-black/30 border border-white/10 px-4 py-3"
        >
          <span className="h-7 w-7 rounded-full bg-[#FFC93C] text-[#1A0F00] font-display text-sm flex items-center justify-center">
            {i + 1}
          </span>
          <span className="font-display text-lg tracking-wide text-white">JOUEUR {id}</span>
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
          className="py-5 rounded-2xl bg-black/30 border-2 border-white/10 hover:border-[#FF4D6D] hover:bg-[#FF4D6D]/10 text-white font-display text-xl tracking-wider transition-all active:scale-[0.97]"
        >
          JOUEUR {s.id}
        </button>
      ))}
    </div>
  </div>
);

const EliminatedView = ({
  slot,
  onContinue,
}: {
  slot: Slot;
  onContinue: () => void;
}) => (
  <div className="flex-1 flex flex-col items-center justify-center text-center gap-5">
    <div className="text-6xl">{slot.role === "civil" ? "💀" : "🎯"}</div>
    <h2 className="font-display text-3xl tracking-wider text-white">
      JOUEUR {slot.id} ÉLIMINÉ
    </h2>
    <div
      className="rounded-2xl px-6 py-4 border-2"
      style={{ borderColor: RoleColor[slot.role] + "80", background: RoleColor[slot.role] + "1A" }}
    >
      <div className="font-display text-2xl tracking-widest" style={{ color: RoleColor[slot.role] }}>
        C'ÉTAIT UN {RoleLabel[slot.role]}
      </div>
      {slot.word && (
        <div className="text-sm text-white/70 mt-1">Son joueur : {slot.word}</div>
      )}
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
  guess,
  setGuess,
  onSubmit,
}: {
  guess: string;
  setGuess: (s: string) => void;
  onSubmit: () => void;
}) => (
  <div className="flex-1 flex flex-col items-center justify-center text-center gap-5">
    <div className="text-6xl">🕵️</div>
    <h2 className="font-display text-3xl tracking-wider text-[#C084FC]">
      MR. WHITE DÉMASQUÉ !
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
          <div key={s.id} className="flex items-center justify-between text-sm px-2 py-1">
            <span className={"font-display tracking-wide " + (s.alive ? "text-white" : "text-white/40 line-through")}>
              JOUEUR {s.id}
            </span>
            <span className="font-display tracking-wider" style={{ color: RoleColor[s.role] }}>
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
