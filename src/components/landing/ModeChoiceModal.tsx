import type { GameMode } from "@/pages/Home";
import { tr } from "@/lib/lang";

export type PlayMode = "solo" | "online" | "bot" | "multi";

type Props = {
  game: Extract<GameMode, "pont" | "chaine">;
  onPick: (mode: PlayMode) => void;
  onClose: () => void;
};

const GAME_LABEL: Record<Props["game"], string> = {
  pont: "THE PLUG",
  chaine: "THE MERCATO",
};

export const ModeChoiceModal = ({ game, onPick, onClose }: Props) => {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
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
            {tr("COMMENT TU JOUES ?", "HOW DO YOU PLAY?", "WIE SPIELST DU?", "COME GIOCHI?", "COMO VOCÊ JOGA?")}
          </h3>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => onPick("solo")}
            className="group w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 border-[#FFC93C]/40 bg-[#FFC93C]/5 hover:bg-[#FFC93C]/10 hover:border-[#FFC93C] transition-all"
          >
            <span className="text-4xl">🎯</span>
            <div className="text-left flex-1">
              <div className="font-display text-2xl tracking-widest text-[#FFC93C]">
                {tr("SOLO", "SOLO", "SOLO", "SOLO", "SOLO")}
              </div>
              <div className="text-xs text-white/60 mt-0.5">
                {tr("Bats ton record, monte au classement", "Beat your record, climb the leaderboard", "Schlag deinen Rekord, klettere in der Rangliste", "Batti il tuo record, scala la classifica", "Bata seu recorde, suba no ranking")}
              </div>
            </div>
            <span className="text-2xl text-[#FFC93C] transition-transform group-hover:translate-x-1">
              ▶
            </span>
          </button>

          <button
            onClick={() => onPick("online")}
            className="group w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 border-[#3DA5FF]/40 bg-[#3DA5FF]/5 hover:bg-[#3DA5FF]/10 hover:border-[#3DA5FF] transition-all"
          >
            <span className="text-4xl">🌐</span>
            <div className="text-left flex-1">
              <div className="font-display text-2xl tracking-widest text-[#3DA5FF]">
                {tr("EN LIGNE", "ONLINE", "ONLINE", "ONLINE", "ONLINE")}
              </div>
              <div className="text-xs text-white/60 mt-0.5">
                {tr("Affronte un joueur au hasard sur le web", "Face a random player on the web", "Tritt gegen einen zufälligen Spieler im Netz an", "Sfida un giocatore a caso sul web", "Enfrente um jogador aleatório na web")}
              </div>
            </div>
            <span className="text-2xl text-[#3DA5FF] transition-transform group-hover:translate-x-1">
              ▶
            </span>
          </button>

          <button
            onClick={() => onPick("bot")}
            className="group w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 border-[#FF8A2A]/40 bg-[#FF8A2A]/5 hover:bg-[#FF8A2A]/10 hover:border-[#FF8A2A] transition-all"
          >
            <span className="text-4xl">🤖</span>
            <div className="text-left flex-1">
              <div className="font-display text-2xl tracking-widest text-[#FF8A2A]">
                {tr("VS BOT", "VS BOT", "VS BOT", "VS BOT", "VS BOT")}
              </div>
              <div className="text-xs text-white/60 mt-0.5">
                {tr("Duel random instantané, sans attente", "Instant random duel, no waiting", "Sofortiges Zufallsduell, ohne Warten", "Duello casuale istantaneo, senza attesa", "Duelo aleatório instantâneo, sem espera")}
              </div>
            </div>
            <span className="text-2xl text-[#FF8A2A] transition-transform group-hover:translate-x-1">
              ▶
            </span>
          </button>

          <button
            onClick={() => onPick("multi")}
            className="group w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 border-[#C084FC]/40 bg-[#C084FC]/5 hover:bg-[#C084FC]/10 hover:border-[#C084FC] transition-all"
          >
            <span className="text-4xl">👥</span>
            <div className="text-left flex-1">
              <div className="font-display text-2xl tracking-widest text-[#C084FC]">
                {tr("ENTRE POTES", "WITH FRIENDS", "MIT FREUNDEN", "CON GLI AMICI", "COM AMIGOS")}
              </div>
              <div className="text-xs text-white/60 mt-0.5">
                {tr("Crée un salon, partage le code, jouez ensemble", "Create a room, share the code, play together", "Erstelle einen Raum, teile den Code, spielt zusammen", "Crea una stanza, condividi il codice, giocate insieme", "Crie uma sala, compartilhe o código, joguem juntos")}
              </div>
            </div>
            <span className="text-2xl text-[#C084FC] transition-transform group-hover:translate-x-1">
              ▶
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
