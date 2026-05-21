import { useEffect, useState } from "react";
import type { GameMode } from "@/pages/Home";

type Props = {
  onPlay: (game?: GameMode) => void;
  onJoinRoom: (code: string) => void;
};

type GameKey = "plug" | "mercato" | "grid" | "guess";

const GAMES: {
  key: GameKey;
  mode: GameMode;
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
    mode: "pont",
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
    mode: "chaine",
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
    mode: "grid",
    name: "GOAT Grid",
    tagline: "La grille des légendes",
    img: "/grid-card.png",
    mascot: "/win2.png",
    description:
      "Une grille 3×3, 9 cases à remplir avec les bons joueurs. Stratégie.",
    accent: "#3DA5FF",
    badge: "STRATÉGIE",
  },
  {
    key: "guess",
    mode: "guess",
    name: "GOAT Guess",
    tagline: "Je devine ton joueur",
    img: "/grid-card.png",
    mascot: "/win1.png",
    description:
      "Pense à un footballeur. En 20 questions max, je devine de qui il s'agit. 🔮",
    accent: "#C084FC",
    badge: "MAGIE",
  },
];

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

export const LobbyView = ({ onPlay, onJoinRoom }: Props) => {
  const [selected, setSelected] = useState<GameKey>("plug");
  const game = GAMES.find((g) => g.key === selected)!;
  const online = useLiveOnline();
  const [roomCode, setRoomCode] = useState("");

  const submitRoom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = roomCode.trim().toUpperCase();
    if (code.length < 4) return;
    onJoinRoom(code);
  };

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
                onClick={() => onPlay(game.mode)}
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

        {/* Rejoindre une partie via un code */}
        <form
          onSubmit={submitRoom}
          className="rounded-2xl border-2 border-[#C084FC]/30 bg-gradient-to-br from-[#C084FC]/10 to-transparent p-4"
        >
          <div className="font-display text-base tracking-[0.2em] text-[#C084FC] mb-3">
            🔑 REJOINDRE UNE PARTIE
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={roomCode}
              onChange={(e) =>
                setRoomCode(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                    .slice(0, 8)
                )
              }
              placeholder="CODE"
              autoComplete="off"
              maxLength={8}
              className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 focus:border-[#C084FC] focus:outline-none font-display text-lg tracking-[0.3em] text-center text-white placeholder-white/30"
            />
            <button
              type="submit"
              disabled={roomCode.trim().length < 4}
              className="px-4 py-2.5 rounded-xl font-display text-sm tracking-widest bg-[#C084FC] hover:bg-[#B070EE] disabled:bg-white/10 disabled:text-white/30 disabled:cursor-not-allowed text-[#0A1410] transition-colors"
            >
              GO
            </button>
          </div>
          <div className="text-xs text-white/40 mt-2">
            Tu as un code d'un ami ? Colle-le ici.
          </div>
        </form>

        {/* Leaderboard preview */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-display text-base tracking-[0.2em] text-white/70">
              🏆 TOP JOUEURS
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
