import { useState } from "react";
import LePont from "@/components/LePont.jsx";
import { LobbyHeader, type TabKey } from "@/components/landing/LobbyHeader";
import { LobbyView } from "@/components/landing/LobbyView";
import { TutosView } from "@/components/landing/TutosView";
import { LeaderboardView } from "@/components/landing/LeaderboardView";
import { FaqView } from "@/components/landing/FaqView";
import { AboutView } from "@/components/landing/AboutView";

export type GameMode = "pont" | "chaine" | "grid";

const Home = () => {
  const [playing, setPlaying] = useState(false);
  const [tab, setTab] = useState<TabKey>("play");

  if (playing) {
    return (
      <div className="fixed inset-0 z-50 bg-background overflow-auto">
        <button
          onClick={() => setPlaying(false)}
          className="fixed top-4 right-4 z-[60] h-10 w-10 rounded-full bg-black/70 text-white text-xl font-light hover:bg-black flex items-center justify-center shadow-lg"
          aria-label="Fermer le jeu"
        >
          ✕
        </button>
        <LePont />
      </div>
    );
  }

  // Lance LePont. Si un mode est donné, on injecte ?play=<mode> dans l'URL
  // pour que LePont auto-démarre directement dans ce jeu.
  const onPlay = (game?: GameMode) => {
    if (game) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("play", game);
        window.history.replaceState({}, "", url.toString());
      } catch {}
    }
    setPlaying(true);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0A1410] text-white flex flex-col">
      {/* Background : filigrane GOAT FC géant + grille de terrain */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04] select-none flex items-center justify-center"
        aria-hidden
      >
        <span className="text-[28vw] font-black tracking-tighter leading-none">
          GOAT FC
        </span>
      </div>
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, #ffffff 0 1px, transparent 1px 100px)",
        }}
        aria-hidden
      />
      {/* Halo vert subtil */}
      <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-[#1E5C2A]/15 blur-[120px]" />

      <LobbyHeader active={tab} onChange={setTab} onPlay={onPlay} />

      <main className="relative flex-1 z-10">
        {tab === "play" && <LobbyView onPlay={onPlay} />}
        {tab === "tutos" && <TutosView />}
        {tab === "leaderboard" && <LeaderboardView onPlay={onPlay} />}
        {tab === "faq" && <FaqView />}
        {tab === "about" && <AboutView />}
      </main>

      {/* Ticker scrolling — actions récentes (mock) */}
      <ScoreTicker />
    </div>
  );
};

const TICKER_ITEMS = [
  { who: "EagleEye", what: "vient de scorer 12 850 pts sur The Plug 🔥" },
  { who: "TransferKing", what: "a explosé son record · +1 420 pts" },
  { who: "MercatoMaster", what: "enchaîne 18 transferts sans erreur 💪" },
  { who: "ZidaneFan10", what: "rejoint le Top 10 du mois 🚀" },
  { who: "FootGuru", what: "complète la GOAT Grid en 4'12 ⚡" },
  { who: "Cantona7", what: "défie BridgeBuilder en multi 🆚" },
  { who: "RonaldoSiu", what: "atteint le palier LÉGENDE 🏆" },
  { who: "LeMercatoGuy", what: "trouve un pont rare : Bordeaux × Newcastle 🤯" },
];

const ScoreTicker = () => (
  <div className="relative z-10 border-t border-white/5 bg-black/30 backdrop-blur-sm overflow-hidden">
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className="goat-blink shrink-0 px-2 py-0.5 rounded-md bg-[#FF8A2A] text-[#1A0F00] font-display text-xs tracking-widest">
        LIVE
      </span>
      <div className="flex-1 overflow-hidden">
        <div className="goat-marquee flex gap-12 whitespace-nowrap">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((it, i) => (
            <span key={i} className="text-sm text-white/70 flex items-center gap-2">
              <span className="font-display text-base tracking-wider text-white">
                {it.who}
              </span>
              <span>{it.what}</span>
              <span className="text-white/20 ml-8">•</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default Home;
