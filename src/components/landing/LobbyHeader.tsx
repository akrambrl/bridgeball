import { tr } from "@/lib/lang";

export type TabKey = "play" | "tutos" | "leaderboard" | "faq" | "about";

type Props = {
  active: TabKey;
  onChange: (t: TabKey) => void;
};

const TAB_KEYS: TabKey[] = ["play", "tutos", "leaderboard", "faq", "about"];

function tabLabel(key: TabKey): string {
  switch (key) {
    case "play": return tr("JOUER", "PLAY", "SPIELEN", "GIOCA", "JOGAR");
    case "tutos": return tr("TUTOS", "GUIDES", "ANLEITUNG", "GUIDE", "GUIAS");
    case "leaderboard": return tr("CLASSEMENT", "LEADERBOARD", "RANGLISTE", "CLASSIFICA", "RANKING");
    case "faq": return "FAQ";
    case "about": return tr("À PROPOS", "ABOUT", "ÜBER UNS", "CHI SIAMO", "SOBRE");
  }
}

// Lit le pseudo stocké par LePont (sinon "Invité")
function getStoredPseudo(): string {
  const guest = tr("Invité", "Guest", "Gast", "Ospite", "Convidado");
  if (typeof window === "undefined") return guest;
  try {
    return (
      localStorage.getItem("bb_pseudo") ||
      localStorage.getItem("bb_name") ||
      guest
    );
  } catch {
    return guest;
  }
}

export const LobbyHeader = ({ active, onChange }: Props) => {
  const pseudo = getStoredPseudo();
  const initial = pseudo.charAt(0).toUpperCase();

  return (
    <header className="relative z-20 px-6 lg:px-10 py-5 flex items-center justify-between gap-6">
      {/* Logo */}
      <button
        onClick={() => onChange("play")}
        className="flex items-center group"
        aria-label="GOAT FC accueil"
      >
        <img
          src="/logo.png"
          alt="GOAT FC"
          className="h-10 lg:h-12 w-auto drop-shadow-[0_4px_20px_rgba(0,230,118,0.25)] group-hover:drop-shadow-[0_4px_25px_rgba(0,230,118,0.5)] transition-all"
        />
      </button>

      {/* Pills nav */}
      <nav className="hidden md:flex items-center gap-2 lg:gap-3">
        {TAB_KEYS.map((key) => {
          const isActive = key === active;
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className={
                "px-4 lg:px-6 py-2.5 rounded-full font-display text-base tracking-widest border-2 transition-all " +
                (isActive
                  ? "border-[#FFC93C] text-[#FFC93C] bg-[#FFC93C]/5"
                  : "border-white/15 text-white/70 hover:text-white hover:border-white/30")
              }
            >
              {tabLabel(key)}
            </button>
          );
        })}
      </nav>

      {/* Right side : profil */}
      <div className="flex items-center gap-3">
        {/* Profil compact */}
        <div className="hidden md:flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-full bg-white/5 border border-white/10">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#00E676] to-[#1E5C2A] flex items-center justify-center font-display text-lg text-[#0A1410]">
            {initial}
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-display text-sm tracking-wider text-white truncate max-w-[100px]">
              {pseudo}
            </span>
            <span className="text-[10px] text-white/50 font-medium">
              LVL 1
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
