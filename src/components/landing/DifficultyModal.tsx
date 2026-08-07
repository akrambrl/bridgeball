import type { GameMode } from "@/pages/Home";
import { tr } from "@/lib/lang";
import { G, posterText, retourStyle } from "@/lib/charte.jsx";

export type Difficulty = "facile" | "moyen" | "expert";

type Props = {
  game: Extract<GameMode, "pont" | "chaine">;
  onPick: (diff: Difficulty) => void;
  onClose: () => void;
};

const DIFFS: {
  key: Difficulty;
  label: () => string;
  subtitle: () => string;
  accent: string;
}[] = [
  {
    key: "facile",
    label: () => tr("FACILE", "EASY", "LEICHT", "FACILE", "FÁCIL","FÁCIL"),
    subtitle: () => tr("Stars très connues", "Very famous stars", "Sehr bekannte Stars", "Star molto famose", "Estrelas muito famosas","Estrellas muy conocidas"),
    accent: G.pelouse,
  },
  {
    key: "moyen",
    label: () => tr("MOYEN", "MEDIUM", "MITTEL", "MEDIO", "MÉDIO","MEDIO"),
    subtitle: () => tr("Bons joueurs", "Good players", "Gute Spieler", "Buoni giocatori", "Bons jogadores","Buenos jugadores"),
    accent: G.projecteur,
  },
  {
    key: "expert",
    label: () => tr("CRESCENDO", "CRESCENDO", "CRESCENDO", "CRESCENDO", "CRESCENDO","CRESCENDO"),
    subtitle: () => tr("Facile → Moyen → Expert", "Easy → Medium → Expert", "Leicht → Mittel → Experte", "Facile → Medio → Esperto", "Fácil → Médio → Expert","Fácil → Medio → Experto"),
    accent: G.maillot,
  },
];

const GAME_LABEL: Record<Props["game"], string> = {
  pont: "THE PLUG",
  chaine: "THE MERCATO",
};

export const DifficultyModal = ({ game, onPick, onClose }: Props) => {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200"
      style={{ background:"rgba(8,17,9,.86)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md p-6 lg:p-8"
        style={{ background:G.nuit, border:G.trait, borderRadius:G.rayonL, boxShadow:G.ombreL }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3"
          style={{ ...retourStyle, width:38, height:38, fontSize:22, fontWeight:400 }}
          aria-label="Fermer"
        >
          ✕
        </button>

        <div className="text-center mb-6">
          <div className="mb-2" style={{ ...posterText(1, G.projecteur, 0), fontSize:14, letterSpacing:4 }}>
            {GAME_LABEL[game]}
          </div>
          <h3 style={posterText(42, G.white)}>
            {tr("CHOISIS TA DIFFICULTÉ", "CHOOSE YOUR DIFFICULTY", "WÄHLE DEINE SCHWIERIGKEIT", "SCEGLI LA DIFFICOLTÀ", "ESCOLHA A DIFICULDADE","ELIGE TU DIFICULTAD")}
          </h3>
        </div>

        <div className="space-y-3">
          {DIFFS.map((d) => (
            <button
              key={d.key}
              onClick={() => onPick(d.key)}
              className="group w-full flex items-center justify-between gap-3 px-5 py-4"
              style={{
                background: d.accent, border: G.trait, borderRadius: G.rayon,
                boxShadow: G.ombre, cursor: "pointer",
              }}
            >
              <div className="text-left">
                <div style={{ ...posterText(1, d.accent === G.projecteur ? G.encre : G.white, 0),
                  fontSize:28, letterSpacing:2 }}>
                  {d.label()}
                </div>
                <div className="text-xs mt-0.5"
                  style={{ color: d.accent === G.projecteur ? "rgba(8,17,9,.7)" : "rgba(255,255,255,.75)" }}>{d.subtitle()}</div>
              </div>
              <span
                className="text-2xl transition-transform group-hover:translate-x-1"
                style={{ color: d.accent === G.projecteur ? G.encre : G.white }}
              >
                ▶
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
