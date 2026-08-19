import { useEffect, useRef, useState } from "react";
import { tr, getLang, setLang, LANGS } from "@/lib/lang";
import { G, posterText, btn, pastilleCharte } from "@/lib/charte.jsx";
import { levelCard, rarityMeta, cardName, hasArt } from "@/lib/collection";
import { fetchMonProfil } from "@/lib/leaderboard";

export type TabKey = "play" | "tutos" | "leaderboard" | "faq" | "about";

type Props = {
  active: TabKey;
  onChange: (t: TabKey) => void;
  /** Ouvre l'écran de profil (monté par LePont). Sans lui, le bloc n'est pas
   *  cliquable — c'était le défaut : un profil affiché mais inatteignable. */
  onOpenProfile?: () => void;
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

// L'identifiant d'appareil, posé par LePont et par le suivi. On ne le CRÉE pas
// ici : un visiteur qui n'a jamais joué n'a rien à afficher, et lui fabriquer un
// identifiant au seul passage sur la landing serait une écriture pour rien.
function playerIdStocke(): string {
  if (typeof window === "undefined") return "";
  try { return localStorage.getItem("bb_player_id") || ""; } catch { return ""; }
}

export const LobbyHeader = ({ active, onChange, onOpenProfile }: Props) => {
  const [pseudo, setPseudo] = useState(getStoredPseudo);
  // `null` tant qu'on ne sait pas : on n'affiche PAS « La Recrue » par défaut,
  // sinon un joueur avancé verrait sa carte de départ le temps du chargement,
  // c'est-à-dire une fausse information au lieu d'une information absente.
  const [xp, setXp] = useState<number | null>(null);

  // L'XP vit dans bb_pseudos, pas en localStorage : la landing la lit elle-même.
  // Un échec ne casse rien — on garde le pseudo local et pas de carte.
  useEffect(() => {
    let vivant = true;
    const pid = playerIdStocke();
    if (!pid) return;
    fetchMonProfil(pid).then((p) => {
      if (!vivant || !p) return;
      setXp(p.xp);
      if (p.pseudo) setPseudo(p.pseudo);
    });
    return () => { vivant = false; };
  }, []);

  const carte = xp === null ? null : levelCard(xp);
  const meta = carte ? rarityMeta(carte.rarity) : null;
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
          src="/logo.webp"
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

        {/* ── PROFIL : UN BOUTON, LA VRAIE CARTE, LE VRAI GRADE ──────────────
            Ce bloc était un <div> sans gestionnaire de clic. Il montrait donc un
            profil que rien ne permettait d'ouvrir : sur ordinateur, la
            collection de cartes — vingt-neuf paliers, la récompense de toute la
            progression — n'était atteignable par AUCUN chemin.

            Il montrait aussi deux choses fausses. L'initiale du pseudo dans un
            rond, alors que la carte de niveau EST la photo de profil partout
            ailleurs (mobile, classement, écran de duel). Et « LVL 1 » écrit en
            dur : GOAT FC n'a pas de numéro de niveau, le grade est le nom de la
            carte atteinte. Un joueur à 60 000 XP lisait « LVL 1 ».

            La vignette prend son cadre de rareté, comme dans la collection et
            sur l'écran de profil qu'elle ouvre. */}
        <button
          onClick={onOpenProfile}
          disabled={!onOpenProfile}
          aria-label={tr("Voir mon profil et mes cartes", "View my profile and cards", "Mein Profil und meine Karten", "Il mio profilo e le mie carte", "Meu perfil e minhas cartas", "Mi perfil y mis cartas")}
          title={tr("Mon profil et mes cartes", "My profile and cards", "Mein Profil und meine Karten", "Il mio profilo e le mie carte", "Meu perfil e minhas cartas", "Mi perfil y mis cartas")}
          className="hidden md:flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 text-left transition-transform hover:scale-[1.03]"
          style={{ background:G.nuit, border:G.traitFin, borderRadius:G.rayonS,
            boxShadow:"2px 2px 0 "+G.encre, cursor: onOpenProfile ? "pointer" : "default" }}>
          {carte && hasArt(carte) ? (
            <span style={{ display:"block", width:34, height:44, flexShrink:0, padding:2,
              borderRadius:8, background:meta!.frame, border:G.traitFin }}>
              <img src={carte.thumb} alt="" style={{ width:"100%", height:"100%",
                objectFit:"cover", objectPosition:"top", borderRadius:6, display:"block" }}/>
            </span>
          ) : (
            <span style={{ ...pastilleCharte(G.pelouse, 32), ...posterText(1, G.white, 0), fontSize:19,
              width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              {initial}
            </span>
          )}
          <span className="flex flex-col leading-tight min-w-0">
            <span className="truncate max-w-[110px]" style={{ ...posterText(1, G.white, 0), fontSize:15 }}>
              {pseudo}
            </span>
            {/* Le grade, ou rien tant qu'on ne le connaît pas. Le nom de la carte
                porte la couleur de sa rareté, comme sur l'écran de profil. */}
            {carte && meta ? (
              <span className="truncate max-w-[110px] text-[10px] font-bold uppercase"
                style={{ letterSpacing:1, color:meta.color }}>
                {cardName(carte)}
              </span>
            ) : (
              <span className="text-[10px] text-white/50 font-medium">
                {tr("Mon profil", "My profile", "Mein Profil", "Il mio profilo", "Meu perfil", "Mi perfil")}
              </span>
            )}
          </span>
        </button>
      </div>
    </header>
  );
};
