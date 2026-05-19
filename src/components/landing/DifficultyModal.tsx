import type { GameMode } from "@/pages/Home";

export type Difficulty = "facile" | "moyen" | "expert";

type Props = {
  game: Extract<GameMode, "pont" | "chaine">;
  onPick: (diff: Difficulty) => void;
  onClose: () => void;
};

const DIFFS: {
  key: Difficulty;
  label: string;
  subtitle: string;
  accent: string;
}[] = [
  {
    key: "facile",
    label: "FACILE",
    subtitle: "Stars très connues",
    accent: "#00E676",
  },
  {
    key: "moyen",
    label: "MOYEN",
    subtitle: "Bons joueurs",
    accent: "#FFC93C",
  },
  {
    key: "expert",
    label: "CRESCENDO",
    subtitle: "Facile → Moyen → Expert",
    accent: "#FF3D6E",
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
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-3xl bg-[#0F2017] border-2 border-white/10 p-6 lg:p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 h-9 w-9 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center text-base"
          aria-label="Fermer"
        >
          ✕
        </button>

        <div className="text-center mb-6">
          <div className="font-display text-xs tracking-[0.3em] text-white/40 mb-2">
            {GAME_LABEL[game]}
          </div>
          <h3 className="font-display text-4xl tracking-wide text-white leading-none">
            CHOISIS TA
            <br />
            DIFFICULTÉ
          </h3>
        </div>

        <div className="space-y-3">
          {DIFFS.map((d) => (
            <button
              key={d.key}
              onClick={() => onPick(d.key)}
              className="group w-full flex items-center justify-between gap-3 px-5 py-4 rounded-2xl border-2 border-white/10 bg-white/[0.02] hover:bg-white/[0.06] transition-all"
              style={
                {
                  ["--accent" as never]: d.accent,
                } as React.CSSProperties
              }
            >
              <div className="text-left">
                <div
                  className="font-display text-2xl tracking-widest"
                  style={{ color: d.accent }}
                >
                  {d.label}
                </div>
                <div className="text-xs text-white/50 mt-0.5">{d.subtitle}</div>
              </div>
              <span
                className="text-2xl transition-transform group-hover:translate-x-1"
                style={{ color: d.accent }}
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
