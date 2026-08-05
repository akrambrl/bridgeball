import type { GameMode } from "@/pages/Home";
import { tr } from "@/lib/lang";

// "bot" a disparu du choix : il menait au MÊME adversaire simulé que "online",
// à l'animation de recherche près. Deux entrées pour une seule partie, dont une
// qui promettait « un joueur au hasard sur le web ».
export type PlayMode = "solo" | "online" | "multi" | "daily";

type Props = {
  game: Extract<GameMode, "pont" | "chaine">;
  onPick: (mode: PlayMode) => void;
  onClose: () => void;
};

const GAME_LABEL: Record<Props["game"], string> = {
  pont: "THE PLUG",
  chaine: "THE MERCATO",
};

type Choice = {
  mode: PlayMode;
  icon: string;
  color: string;
  title: string;
  desc: string;
  featured?: boolean;
};

export const ModeChoiceModal = ({ game, onPick, onClose }: Props) => {
  const choices: Choice[] = [
    // Le Mercato du jour est le rendez-vous quotidien : mis en avant, en tête.
    ...(game === "chaine"
      ? [{
          mode: "daily" as PlayMode,
          icon: "🗓",
          color: "#60a5fa",
          featured: true,
          title: tr("MERCATO DU JOUR", "DAILY MERCATO", "MERCATO DES TAGES", "MERCATO DEL GIORNO", "MERCATO DO DIA"),
          desc: tr("Même départ pour tous · 1 essai · classé", "Same start for all · 1 try · ranked", "Gleicher Start für alle · 1 Versuch · gewertet", "Stessa partenza per tutti · 1 tentativo · classificato", "Mesmo início para todos · 1 tentativa · ranqueado"),
        }]
      : []),
    {
      mode: "solo",
      icon: "🎯",
      color: "#FFC93C",
      title: tr("SOLO", "SOLO", "SOLO", "SOLO", "SOLO"),
      desc: tr("Bats ton record, monte au classement", "Beat your record, climb the leaderboard", "Schlag deinen Rekord, klettere in der Rangliste", "Batti il tuo record, scala la classifica", "Bata seu recorde, suba no ranking"),
    },
    {
      mode: "online",
      icon: "⚔️",
      color: "#3DA5FF",
      title: tr("EN LIGNE", "ONLINE", "ONLINE", "ONLINE", "ONLINE"),
      desc: tr("Duel instantané contre un adversaire", "Instant duel against an opponent", "Sofortiges Duell gegen einen Gegner", "Duello istantaneo contro un avversario", "Duelo instantâneo contra um adversário"),
    },
    {
      mode: "multi",
      icon: "👥",
      color: "#C084FC",
      title: tr("ENTRE POTES", "WITH FRIENDS", "MIT FREUNDEN", "CON GLI AMICI", "COM AMIGOS"),
      desc: tr("Crée un salon et partage le code", "Create a room and share the code", "Erstelle einen Raum und teile den Code", "Crea una stanza e condividi il codice", "Crie uma sala e compartilhe o código"),
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl bg-[#0B1611] border border-white/10 p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,.9)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white flex items-center justify-center text-sm transition-colors"
          aria-label={tr("Fermer", "Close", "Schließen", "Chiudi", "Fechar")}
        >
          ✕
        </button>

        <div className="mb-5 pr-10">
          <div className="font-display text-[10px] tracking-[0.35em] text-white/35">
            {GAME_LABEL[game]}
          </div>
          {/* text-2xl : à 3xl, « COMMENT TU JOUES ? » passait sur deux lignes
              une fois la place de la croix de fermeture réservée. */}
          <h3 className="font-display text-2xl tracking-wide text-white leading-tight mt-1">
            {tr("COMMENT TU JOUES ?", "HOW DO YOU PLAY?", "WIE SPIELST DU?", "COME GIOCHI?", "COMO VOCÊ JOGA?")}
          </h3>
        </div>

        {/* Une seule couleur d'accent par ligne, portée par la pastille et le
            titre — les fonds pleins multicolores donnaient un effet arc-en-ciel. */}
        <div className="flex flex-col gap-2.5">
          {choices.map((c) => {
            const base = {
              border: c.featured ? c.color + "66" : "rgba(255,255,255,.09)",
              bg: c.featured ? c.color + "14" : "rgba(255,255,255,.03)",
            };
            return (
              <button
                key={c.mode}
                onClick={() => onPick(c.mode)}
                className="group w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl border text-left transition-colors"
                style={{ borderColor: base.border, background: base.bg }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = c.color + "99";
                  e.currentTarget.style.background = c.color + "1a";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = base.border;
                  e.currentTarget.style.background = base.bg;
                }}
              >
                <span
                  className="flex-shrink-0 h-11 w-11 rounded-xl flex items-center justify-center text-xl"
                  style={{ background: c.color + "1f", border: "1px solid " + c.color + "38" }}
                >
                  {c.icon}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-display text-lg tracking-[0.12em] leading-none" style={{ color: c.color }}>
                    {c.title}
                  </span>
                  <span className="block text-[11.5px] text-white/45 mt-1 leading-snug">
                    {c.desc}
                  </span>
                </span>
                <span
                  className="flex-shrink-0 text-lg transition-transform group-hover:translate-x-0.5"
                  style={{ color: c.featured ? c.color : "rgba(255,255,255,.25)" }}
                >
                  ›
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
