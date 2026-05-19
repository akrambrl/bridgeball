export type TabKey = "play" | "tutos" | "leaderboard" | "faq" | "about";

type Props = {
  active: TabKey;
  onChange: (t: TabKey) => void;
  onPlay: () => void;
};

const TABS: { key: TabKey; label: string }[] = [
  { key: "play", label: "PLAY" },
  { key: "tutos", label: "TUTOS" },
  { key: "leaderboard", label: "LEADERBOARD" },
  { key: "faq", label: "FAQ" },
  { key: "about", label: "ABOUT" },
];

export const LobbyHeader = ({ active, onChange, onPlay }: Props) => {
  return (
    <header className="relative z-20 px-6 lg:px-10 py-5 flex items-center justify-between gap-6">
      {/* Logo */}
      <button
        onClick={() => onChange("play")}
        className="flex items-baseline gap-2 group"
      >
        <span className="font-display text-3xl tracking-wider text-white leading-none">
          GOAT
        </span>
        <span className="font-display text-3xl tracking-wider text-[#FFC93C] leading-none">
          FC
        </span>
      </button>

      {/* Pills nav */}
      <nav className="hidden md:flex items-center gap-2 lg:gap-3">
        {TABS.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className={
                "px-4 lg:px-6 py-2.5 rounded-full font-display text-base tracking-widest border-2 transition-all " +
                (isActive
                  ? "border-[#FFC93C] text-[#FFC93C] bg-[#FFC93C]/5"
                  : "border-white/15 text-white/70 hover:text-white hover:border-white/30")
              }
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* Right side : CTA Play rapide */}
      <button
        onClick={onPlay}
        className="px-5 py-2.5 rounded-full font-display text-lg tracking-widest bg-gradient-to-r from-[#FF8A2A] to-[#FFC93C] text-[#1A0F00] shadow-lg shadow-[#FFC93C]/20 hover:shadow-[#FFC93C]/40 hover:scale-[1.02] transition-all"
      >
        ▶ JOUER
      </button>
    </header>
  );
};
