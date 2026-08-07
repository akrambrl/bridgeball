import { useEffect, useRef, useState } from "react";
import { tr, getLang, setLang, LANGS } from "@/lib/lang";
import { G, posterText, btn, pastilleCharte } from "@/lib/charte.jsx";

export type TabKey = "play" | "tutos" | "leaderboard" | "faq" | "about";

type Props = {
  active: TabKey;
  onChange: (t: TabKey) => void;
};

const TAB_KEYS: TabKey[] = ["play", "tutos", "leaderboard", "faq", "about"];

function tabLabel(key: TabKey): string {
  switch (key) {
    case "play": return tr("JOUER", "PLAY", "SPIELEN", "GIOCA", "JOGAR","JUGAR");
    case "tutos": return tr("TUTOS", "GUIDES", "ANLEITUNG", "GUIDE", "GUIAS","GUÍAS");
    case "leaderboard": return tr("CLASSEMENT", "LEADERBOARD", "RANGLISTE", "CLASSIFICA", "RANKING","CLASIFICACIÓN");
    case "faq": return "FAQ";
    case "about": return tr("À PROPOS", "ABOUT", "ÜBER UNS", "CHI SIAMO", "SOBRE","ACERCA DE");
  }
}

// Lit le pseudo stocké par LePont (sinon "Invité")
function getStoredPseudo(): string {
  const guest = tr("Invité", "Guest", "Gast", "Ospite", "Convidado","Invitado");
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
        aria-label={tr("Changer la langue", "Change language", "Sprache ändern", "Cambia lingua", "Mudar idioma","Cambiar el idioma")}
        aria-expanded={open}
        className="flex items-center gap-1.5 px-3 py-2"
        style={{ background:G.nuit, border:G.traitFin, borderRadius:G.rayonS,
          boxShadow:"2px 2px 0 "+G.encre, cursor:"pointer" }}
      >
        <span className="text-base leading-none">{current.flag}</span>
        <span style={{ ...posterText(1, G.white, 0), fontSize:15, letterSpacing:1.5 }}>{current.label}</span>
        <span className="text-[10px] text-white/50">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-36 overflow-hidden"
          style={{ background:G.nuit, border:G.trait, borderRadius:G.rayonS, boxShadow:G.ombre }}>
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors"
              style={l.code === current.code
                ? { background:G.pelouse, color:G.white }
                : { background:"transparent", color:"rgba(255,255,255,.75)" }}
            >
              <span className="text-base leading-none">{l.flag}</span>
              <span style={{ ...posterText(1, "currentColor", 0), fontSize:15, letterSpacing:1.5 }}>{l.label}</span>
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
          className="h-10 lg:h-12 w-auto transition-transform group-hover:scale-[1.04]"
          style={{ filter:"drop-shadow(3px 3px 0 "+G.encre+")" }}
        />
      </button>

      {/* Onglets : aplat + trait d'encre + ombre dure, comme tout bouton de la
          charte. L'onglet actif porte le jaune projecteur, les autres la nuit —
          le contour translucide d'avant était le dernier reste de « verre ». */}
      <nav className="hidden md:flex items-center gap-2 lg:gap-3">
        {TAB_KEYS.map((key) => {
          const isActive = key === active;
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className="px-4 lg:px-6"
              style={{ ...btn(isActive ? G.projecteur : G.nuit, isActive ? G.encre : G.white, 18),
                padding:"9px 18px", borderRadius:G.rayonS }}
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
        <div className="hidden md:flex items-center gap-2.5 pl-1.5 pr-3 py-1.5"
          style={{ background:G.nuit, border:G.traitFin, borderRadius:G.rayonS,
            boxShadow:"2px 2px 0 "+G.encre }}>
          <div style={{ ...pastilleCharte(G.pelouse, 32), ...posterText(1, G.white, 0), fontSize:19,
            width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center" }}>
            {initial}
          </div>
          <div className="flex flex-col leading-tight">
            <span className="truncate max-w-[100px]" style={{ ...posterText(1, G.white, 0), fontSize:15 }}>
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
