import { useEffect, useState } from "react";
import type { GameMode } from "@/pages/Home";
import { tr } from "@/lib/lang";
import { G, posterText, posterTitre, retourStyle } from "@/lib/charte.jsx";

// Le décompte ne sert qu'aux parties lancées depuis le choix de mode /
// difficulté, c'est-à-dire The Plug et The Mercato. Les autres jeux démarrent
// directement. Le type le dit désormais, au lieu de couvrir tout GameMode et de
// traîner une entrée "grid" morte.
type CountdownGame = Extract<GameMode, "pont" | "chaine">;

type Props = {
  game: CountdownGame;
  onDone: () => void;
  onCancel: () => void;
};

const GAME_INFO: Record<
  CountdownGame,
  { name: string; tagline: string; accent: string }
> = {
  pont: {
    name: "THE PLUG",
    tagline: "Le pont entre deux clubs",
    accent: G.pelouse,
  },
  chaine: {
    name: "THE MERCATO",
    tagline: "La chaîne sans fin",
    accent: G.projecteur,
  },
};

const START_FROM = 3;

function countdownTagline(game: CountdownGame): string {
  switch (game) {
    case "pont": return tr("Le pont entre deux clubs", "The bridge between two clubs", "Die Brücke zwischen zwei Klubs", "Il ponte tra due club", "A ponte entre dois clubes","El puente entre dos clubes");
    case "chaine": return tr("La chaîne sans fin", "The endless chain", "Die endlose Kette", "La catena infinita", "A corrente sem fim","La cadena sin fin");
  }
}

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
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center"
      style={{ background:"rgba(8,17,9,.95)" }}
    >
      {/* Halo couleur du jeu */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40 transition-opacity"
        style={{
          background: `radial-gradient(circle at center, ${info.accent} 0%, transparent 55%)`,
        }}
        aria-hidden
      />

      <button
        onClick={onCancel}
        className="absolute top-4 right-4"
        style={{ ...retourStyle, width:"auto", padding:"9px 16px", fontSize:15, letterSpacing:1.5 }}
      >
        {tr("ANNULER", "CANCEL", "ABBRECHEN", "ANNULLA", "CANCELAR","CANCELAR")}
      </button>

      <div className="relative text-center">
        <div
          className="mb-2"
          style={{ ...posterText(1, info.accent, 0), fontSize:15, letterSpacing:6 }}
        >
          {tr("PRÊT ?", "READY?", "BEREIT?", "PRONTO?", "PRONTO?","¿PREPARADO?")}
        </div>
        <div className="mb-1" style={{ ...posterTitre(56, G.white), fontSize:"clamp(34px,6vw,56px)" }}>
          {info.name}
        </div>
        <div className="text-sm text-white/50 mb-10">{countdownTagline(game)}</div>

        {/* Le gros chiffre */}
        <div
          key={n}
          className="select-none"
          style={{
            ...posterText(300, n === 0 ? info.accent : G.white),
            fontSize: "clamp(160px, 28vw, 380px)",
            animation: "countdownPop 1s ease-out forwards",
          }}
        >
          {n === 0 ? tr("GO !", "GO!", "LOS!", "VIA!", "JÁ!","¡YA!") : n}
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
