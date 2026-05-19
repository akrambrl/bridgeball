import { useEffect, useState } from "react";

type Props = { onPlay: () => void };

type GameKey = "plug" | "mercato" | "grid";

const GAMES: {
  key: GameKey;
  name: string;
  tagline: string;
  img: string;
  mascot: string;
  description: string;
  accent: string;
  badge: string;
}[] = [
  {
    key: "plug",
    name: "The Plug",
    tagline: "Le pont entre deux clubs",
    img: "/plug-card.png",
    mascot: "/win3.png",
    description:
      "Deux clubs, un seul joueur. À toi de trouver le maillon qui les relie.",
    accent: "#00E676",
    badge: "SIGNATURE",
  },
  {
    key: "mercato",
    name: "The Mercato",
    tagline: "La chaîne sans fin",
    img: "/mercato-card.png",
    mascot: "/win1.png",
    description:
      "Pars d'un joueur et enchaîne les transferts. Bats ton record.",
    accent: "#FF8A2A",
    badge: "MARATHON",
  },
  {
    key: "grid",
    name: "GOAT Grid",
    tagline: "La grille des légendes",
    img: "/grid-card.png",
    mascot: "/win2.png",
    description:
      "Une grille 3×3, 9 cases à remplir avec les bons joueurs. Stratégie.",
    accent: "#3DA5FF",
    badge: "STRATÉGIE",
  },
];

// Daily countdown
function useDailyCountdown() {
  const [s, setS] = useState(() => secondsUntilMidnight());
  useEffect(() => {
    const id = setInterval(() => setS(secondsUntilMidnight()), 1000);
    return () => clearInterval(id);
  }, []);
  return s;
}
function secondsUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.floor((midnight.getTime() - now.getTime()) / 1000);
}
function formatCountdown(s: number) {
  const h = Math.floor(s / 3600).toString().padStart(2, "0");
  const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

// Compteur "live" qui fluctue entre 80 et 320 joueurs (mock)
function useLiveOnline() {
  const [n, setN] = useState(() => 120 + Math.floor(Math.random() * 80));
  useEffect(() => {
    const id = setInterval(() => {
      setN((prev) => {
        const drift = Math.floor(Math.random() * 13) - 6;
        const next = prev + drift;
        return Math.max(60, Math.min(380, next));
      });
    }, 2500);
    return () => clearInterval(id);
  }, []);
  return n;
}

const TOP5 = [
  { rank: 1, name: "EagleEye", score: 12850 },
  { rank: 2, name: "TransferKing", score: 11420 },
  { rank: 3, name: "MercatoMaster", score: 10780 },
  { rank: 4, name: "BridgeBuilder", score: 9650 },
  { rank: 5, name: "FootGuru", score: 8990 },
];

export const LobbyView = ({ onPlay }: Props) => {
  const [selected, setSelected] = useState<GameKey>("plug");
  const game = GAMES.find((g) => g.key === selected)!;
  const cd = useDailyCountdown();
  const online = useLiveOnline();

  return (
    <div className="container max-w-7xl mx-auto px-6 lg:px-10 py-6 lg:py-8 grid lg:grid-cols-[280px_1fr_320px] gap-6 items-start">
      {/* COLONNE GAUCHE — choix du jeu */}
      <div className="space-y-3">
        <div className="font-display text-sm tracking-[0.25em] text-white/40 px-1 mb-2">
          NOS JEUX
        </div>
        {GAMES.map((g) => {
          const isActive = g.key === selected;
          return (
            <button
              key={g.key}
              onClick={() => setSelected(g.key)}
              className={
                "w-full text-left rounded-2xl border-2 p-3 flex items-center gap-3 transition-all " +
                (isActive
                  ? "border-[#FFC93C] bg-white/[0.04]"
                  : "border-white/10 hover:border-white/30 bg-white/[0.02] hover:bg-white/[0.04]")
              }
            >
              <div className="relative h-14 w-14 rounded-xl overflow-hidden flex-shrink-0">
                <img src={g.img} alt={g.name} className="h-full w-full object-cover" />
                {isActive && (
                  <div className="absolute inset-0 ring-2 ring-[#FFC93C] rounded-xl" />
                )}
              </div>
              <div className="min-w-0">
                <div className="font-display text-xl tracking-wider truncate">{g.name}</div>
                <div className="text-xs text-white/50 truncate">{g.tagline}</div>
              </div>
            </button>
          );
        })}

        {/* Live online counter */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-3 flex items-center gap-2.5">
          <span className="goat-blink h-2.5 w-2.5 rounded-full bg-[#00E676] shadow-[0_0_10px_#00E676]" />
          <span className="font-display text-base tracking-wider text-white tabular-nums">
            {online}
          </span>
          <span className="text-xs text-white/50">en ligne</span>
        </div>
      </div>

      {/* CENTRE — preview du jeu sélectionné + mascotte + bouton PLAY */}
      <div className="relative">
        <div
          className="relative rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur"
          style={{ minHeight: "620px" }}
        >
          {/* Halo couleur jeu */}
          <div
            className="absolute -top-32 left-1/2 -translate-x-1/2 h-[380px] w-[640px] rounded-full blur-[110px] opacity-30"
            style={{ backgroundColor: game.accent }}
          />

          <div className="relative p-6 lg:p-8 grid md:grid-cols-[1fr_240px] gap-6 items-center">
            {/* Texte + CTA */}
            <div className="flex flex-col items-center md:items-start text-center md:text-left">
              <span
                className="px-3 py-1 rounded-full font-display text-xs tracking-[0.25em] mb-4"
                style={{
                  backgroundColor: `${game.accent}20`,
                  color: game.accent,
                  border: `1px solid ${game.accent}40`,
                }}
              >
                {game.badge}
              </span>

              <h2 className="font-display text-6xl lg:text-8xl tracking-wide leading-none mb-2">
                {game.name}
              </h2>
              <p
                className="font-display text-xl lg:text-2xl tracking-widest mb-5"
                style={{ color: game.accent }}
              >
                {game.tagline}
              </p>

              {/* Card preview (illu plus petite) */}
              <div className="relative my-2 mb-6">
                <div
                  className="absolute inset-0 blur-2xl opacity-50 rounded-2xl"
                  style={{ backgroundColor: game.accent }}
                />
                <img
                  src={game.img}
                  alt={game.name}
                  className="relative h-32 lg:h-36 w-auto rounded-xl shadow-2xl"
                />
              </div>

              <p className="text-white/70 max-w-md mb-6 text-sm lg:text-base">{game.description}</p>

              {/* Gros bouton PLAY */}
              <button
                onClick={onPlay}
                className="goat-pulse group relative inline-flex items-center gap-3 px-12 py-5 rounded-2xl bg-gradient-to-r from-[#FF8A2A] to-[#FFC93C] text-[#1A0F00] font-display text-4xl tracking-widest hover:scale-[1.03] active:scale-[0.98] transition-transform"
              >
                <span className="text-3xl">▶</span> JOUER
                <span className="absolute inset-0 rounded-2xl bg-white/0 group-hover:bg-white/10 transition-colors pointer-events-none" />
              </button>

              <p className="mt-3 text-xs text-white/40">
                Gratuit · Sans inscription · 3 minutes
              </p>
            </div>

            {/* Mascotte joueur GOAT FC */}
            <div className="hidden md:flex justify-center relative">
              <div
                className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[80%] w-[80%] rounded-full blur-3xl opacity-30"
                style={{ backgroundColor: game.accent }}
              />
              <img
                key={game.key}
                src={game.mascot}
                alt=""
                className="goat-float relative h-[480px] w-auto object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.7)]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* COLONNE DROITE — widgets gamifiés */}
      <div className="space-y-4">
        {/* Daily challenge */}
        <div className="relative rounded-2xl border-2 border-[#FF8A2A]/40 bg-gradient-to-br from-[#FF8A2A]/15 to-transparent p-4 cursor-pointer hover:from-[#FF8A2A]/25 transition-colors">
          <div className="absolute -top-2 left-3 px-2 py-0.5 rounded-md bg-[#FF8A2A] text-[#1A0F00] font-display text-xs tracking-widest">
            NEW
          </div>
          <div className="flex items-start justify-between gap-3 mt-1">
            <div>
              <div className="font-display text-base text-[#FF8A2A] tracking-[0.2em]">
                🔥 DAILY CHALLENGE
              </div>
              <div className="text-xs text-white/50 mt-1">
                Ends in{" "}
                <span className="font-mono font-bold text-white">{formatCountdown(cd)}</span>
              </div>
            </div>
            <span className="text-white/40 text-lg leading-none">›</span>
          </div>
        </div>

        {/* Daily Coins */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="font-display text-base tracking-[0.2em] text-white/70 mb-2">
            💰 DAILY COINS
          </div>
          <button className="w-full mt-1 py-2.5 rounded-xl border-2 border-[#FFC93C]/60 bg-[#FFC93C]/10 hover:bg-[#FFC93C]/15 hover:border-[#FFC93C] font-display text-lg tracking-wider text-[#FFC93C] transition-colors">
            🪙 CLAIM 10 COINS
          </button>
        </div>

        {/* Versus a friend */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] p-4 cursor-pointer transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#00E676] to-[#1E5C2A] ring-2 ring-[#0A1410]" />
              <div className="h-8 w-8 rounded-full bg-white/10 ring-2 ring-[#0A1410] flex items-center justify-center text-white/40 text-xs font-bold">
                ?
              </div>
            </div>
            <div className="flex-1">
              <div className="font-display text-lg tracking-widest">CHALLENGE A FRIEND</div>
              <div className="text-xs text-white/50">Crée un salon multi</div>
            </div>
            <span className="text-white/40 text-lg leading-none">›</span>
          </div>
        </div>

        {/* Leaderboard preview */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-display text-base tracking-[0.2em] text-white/70">
              🏆 HALL OF FAME
            </div>
            <span className="font-display text-xs tracking-widest text-white/40">CE MOIS-CI</span>
          </div>
          <ul className="space-y-2">
            {TOP5.map((p) => (
              <li
                key={p.rank}
                className="flex items-center gap-2 text-sm"
              >
                <span
                  className={
                    "flex-shrink-0 h-6 w-6 rounded-md flex items-center justify-center font-display text-base " +
                    (p.rank === 1
                      ? "bg-[#FFD700] text-black"
                      : p.rank === 2
                      ? "bg-[#C0C0C0] text-black"
                      : p.rank === 3
                      ? "bg-[#CD7F32] text-black"
                      : "bg-white/10 text-white/70")
                  }
                >
                  {p.rank}
                </span>
                <span className="flex-1 truncate text-white/90 font-medium">
                  {p.name}
                </span>
                <span className="font-display text-base tabular-nums text-[#FFC93C] tracking-wider">
                  {p.score.toLocaleString("fr-FR")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
