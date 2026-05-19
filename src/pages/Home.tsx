import { useEffect, useState } from "react";
import LePont from "@/components/LePont.jsx";
import { LobbyHeader, type TabKey } from "@/components/landing/LobbyHeader";
import { LobbyView } from "@/components/landing/LobbyView";
import { TutosView } from "@/components/landing/TutosView";
import { LeaderboardView } from "@/components/landing/LeaderboardView";
import { FaqView } from "@/components/landing/FaqView";
import { AboutView } from "@/components/landing/AboutView";
import { DifficultyModal, type Difficulty } from "@/components/landing/DifficultyModal";

export type GameMode = "pont" | "chaine" | "grid";

const Home = () => {
  const [playing, setPlaying] = useState(false);
  const [tab, setTab] = useState<TabKey>("play");
  // Si non null, on affiche le sélecteur de difficulté avant de lancer le jeu
  const [pendingGame, setPendingGame] = useState<"pont" | "chaine" | null>(null);

  // LePont émet cet event quand l'utilisateur quitte la partie autolaunchée
  // (← interne, fin de partie). On ferme l'overlay pour revenir à la landing.
  useEffect(() => {
    const onBack = () => setPlaying(false);
    window.addEventListener("goatfc:back-to-landing", onBack);
    return () => window.removeEventListener("goatfc:back-to-landing", onBack);
  }, []);

  if (playing) {
    return (
      <div className="fixed inset-0 z-50 bg-background overflow-auto">
        <button
          onClick={() => setPlaying(false)}
          className="fixed top-3 right-3 z-[60] flex items-center gap-2 px-4 py-2 rounded-full bg-[#FF8A2A] hover:bg-[#FF7A1A] text-[#1A0F00] font-display text-base tracking-widest shadow-[0_8px_24px_rgba(0,0,0,0.5)] hover:scale-[1.03] active:scale-[0.98] transition-all"
          aria-label="Quitter et revenir à la landing GOAT FC"
          title="Quitter et revenir à la landing"
        >
          ← QUITTER
        </button>
        <LePont />
      </div>
    );
  }

  // Demande la difficulté pour pont/chaine, ou lance direct pour grid (pas de diff)
  const onPlay = (game?: GameMode) => {
    if (game === "grid") {
      launchGame("grid");
      return;
    }
    if (game === "pont" || game === "chaine") {
      setPendingGame(game);
      return;
    }
    // Fallback : ouvrir LePont sans param
    setPlaying(true);
  };

  // Lance vraiment le jeu : ajoute ?play=<mode>&diff=<diff> et ouvre l'overlay
  const launchGame = (game: GameMode, diff?: Difficulty) => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("play", game);
      if (diff) url.searchParams.set("diff", diff);
      window.history.replaceState({}, "", url.toString());
    } catch {}
    setPendingGame(null);
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

      {/* Sélecteur de difficulté */}
      {pendingGame && (
        <DifficultyModal
          game={pendingGame}
          onPick={(diff) => launchGame(pendingGame, diff)}
          onClose={() => setPendingGame(null)}
        />
      )}
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
