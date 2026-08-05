import { useEffect, useRef, useState } from "react";
import { tr, getLang, setLang, LANGS } from "@/lib/lang";

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

// Sélecteur de langue — il n'existait que sur mobile (dans LePont), le desktop
// se contentait de la langue détectée dans le navigateur, sans moyen d'en changer.
const LangPicker = () => {
  const [open, setOpen] = useState(false);
  const current = LANGS.find((l) => l.code === getLang()) ?? LANGS[0];
  const box = useRef<HTMLDivElement>(null);

  // Fermeture au clic en dehors
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="relative" ref={box}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={tr("Changer la langue", "Change language", "Sprache ändern", "Cambia lingua", "Mudar idioma")}
        aria-expanded={open}
        className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/5 border border-white/10 hover:border-white/30 transition-colors"
      >
        <span className="text-base leading-none">{current.flag}</span>
        <span className="font-display text-sm tracking-widest text-white/80">{current.label}</span>
        <span className="text-[10px] text-white/40">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-36 rounded-xl border border-white/15 bg-[#0A1410] shadow-[0_16px_50px_rgba(0,0,0,.7)] overflow-hidden">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className={
                "w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors " +
                (l.code === current.code
                  ? "bg-[#00E676]/10 text-[#00E676]"
                  : "text-white/75 hover:bg-white/5 hover:text-white")
              }
            >
              <span className="text-base leading-none">{l.flag}</span>
              <span className="font-display text-sm tracking-widest">{l.label}</span>
              {l.code === current.code && <span className="ml-auto text-xs">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const LobbyHeader = ({ active, onChange }: Props) => {
  const pseudo = getStoredPseudo();
  const initial = pseudo.charAt(0).toUpperCase();

  return (
    <header className="relative z-20 px-6 lg:px-10 pt-7 pb-5 flex items-center justify-between gap-6">
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

      {/* Right side : langue + profil */}
      <div className="flex items-center gap-3">
        <LangPicker />

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
