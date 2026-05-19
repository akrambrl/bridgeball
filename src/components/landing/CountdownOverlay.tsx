import { useEffect, useState } from "react";
import type { GameMode } from "@/pages/Home";

type Props = {
  game: GameMode;
  onDone: () => void;
  onCancel: () => void;
};

const GAME_INFO: Record<
  GameMode,
  { name: string; tagline: string; accent: string }
> = {
  pont: {
    name: "THE PLUG",
    tagline: "Le pont entre deux clubs",
    accent: "#00E676",
  },
  chaine: {
    name: "THE MERCATO",
    tagline: "La chaîne sans fin",
    accent: "#FF8A2A",
  },
  grid: {
    name: "GOAT GRID",
    tagline: "La grille des légendes",
    accent: "#3DA5FF",
  },
};

const START_FROM = 5;

export const CountdownOverlay = ({ game, onDone, onCancel }: Props) => {
  const [n, setN] = useState(START_FROM);
  const info = GAME_INFO[game];

  useEffect(() => {
    if (n <= 0) {
      const t = setTimeout(onDone, 350); // petit délai pour voir "GO !"
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setN((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [n, onDone]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md"
    >
      {/* Halo couleur du jeu */}
      <div
        className="absolute inset-0 pointer-events-none opacity-50 transition-opacity"
        style={{
          background: `radial-gradient(circle at center, ${info.accent}40 0%, transparent 55%)`,
        }}
        aria-hidden
      />

      <button
        onClick={onCancel}
        className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs font-display tracking-widest border border-white/10"
      >
        ANNULER
      </button>

      <div className="relative text-center">
        <div
          className="font-display text-xs lg:text-sm tracking-[0.4em] mb-2"
          style={{ color: info.accent }}
        >
          GET READY
        </div>
        <div className="font-display text-3xl lg:text-5xl tracking-wider text-white mb-1">
          {info.name}
        </div>
        <div className="text-sm text-white/50 mb-10">{info.tagline}</div>

        {/* Le gros chiffre */}
        <div
          key={n}
          className="font-display leading-none select-none"
          style={{
            color: n === 0 ? info.accent : "#FFFFFF",
            fontSize: "clamp(160px, 28vw, 380px)",
            textShadow: `0 8px 60px ${info.accent}80`,
            animation: "countdownPop 1s ease-out forwards",
          }}
        >
          {n === 0 ? "GO !" : n}
        </div>
      </div>

      {/* Keyframes inline */}
      <style>{`
        @keyframes countdownPop {
          0% { opacity: 0; transform: scale(2.2); }
          25% { opacity: 1; transform: scale(0.85); }
          45% { transform: scale(1.05); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};
