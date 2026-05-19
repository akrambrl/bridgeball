import { useEffect, useState } from "react";
import LePont from "@/components/LePont.jsx";
import { LobbyHeader, type TabKey } from "@/components/landing/LobbyHeader";
import { LobbyView } from "@/components/landing/LobbyView";
import { TutosView } from "@/components/landing/TutosView";
import { LeaderboardView } from "@/components/landing/LeaderboardView";
import { FaqView } from "@/components/landing/FaqView";
import { AboutView } from "@/components/landing/AboutView";
import { DifficultyModal, type Difficulty } from "@/components/landing/DifficultyModal";
import { ModeChoiceModal, type PlayMode } from "@/components/landing/ModeChoiceModal";
import { MatchmakingOverlay } from "@/components/landing/MatchmakingOverlay";
import { CountdownOverlay } from "@/components/landing/CountdownOverlay";

export type GameMode = "pont" | "chaine" | "grid";

const Home = () => {
  const [playing, setPlaying] = useState(false);
  const [tab, setTab] = useState<TabKey>("play");
  // 1) Choix Solo/Multi (pont/chaine seulement)
  const [pendingMode, setPendingMode] = useState<"pont" | "chaine" | null>(null);
  // 2) Choix difficulté — on conserve le mode déjà choisi
  const [pendingDiff, setPendingDiff] = useState<
    { game: "pont" | "chaine"; mode: PlayMode } | null
  >(null);
  // 3a) Matchmaking en ligne (recherche d'un faux adversaire)
  const [matchmaking, setMatchmaking] = useState<
    { game: "pont" | "chaine"; diff: Difficulty } | null
  >(null);
  // 3b) Countdown 3..0 avant lancement effectif (solo / après matchmaking)
  const [countdown, setCountdown] = useState<
    {
      game: GameMode;
      diff?: Difficulty;
      bot?: { pseudo: string; country: string };
    } | null
  >(null);
  // Pop-up de confirmation avant de quitter une partie
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);

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
          onClick={() => setShowQuitConfirm(true)}
          className="fixed top-3 right-3 z-[60] flex items-center gap-2 px-4 py-2 rounded-full bg-[#FF8A2A] hover:bg-[#FF7A1A] text-[#1A0F00] font-display text-base tracking-widest shadow-[0_8px_24px_rgba(0,0,0,0.5)] hover:scale-[1.03] active:scale-[0.98] transition-all"
          aria-label="Quitter et revenir à la landing GOAT FC"
          title="Quitter et revenir à la landing"
        >
          ← QUITTER
        </button>
        <LePont />

        {showQuitConfirm && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
            onClick={() => setShowQuitConfirm(false)}
          >
            <div
              className="w-full max-w-sm rounded-3xl bg-[#0F2017] border-2 border-white/10 p-6 lg:p-8 shadow-2xl text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-5xl mb-3">⚠️</div>
              <h3 className="font-display text-3xl tracking-wide text-white mb-2">
                QUITTER LA PARTIE ?
              </h3>
              <p className="text-sm text-white/60 mb-7">
                Ta progression en cours sera perdue.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setShowQuitConfirm(false)}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-[#FF8A2A] to-[#FFC93C] text-[#1A0F00] font-display text-lg tracking-widest hover:scale-[1.02] transition-transform"
                >
                  ▶ CONTINUER
                </button>
                <button
                  onClick={() => {
                    setShowQuitConfirm(false);
                    setPlaying(false);
                  }}
                  className="w-full py-3 rounded-xl border-2 border-white/10 bg-white/[0.02] hover:bg-white/[0.06] text-white/80 font-display text-base tracking-widest transition-colors"
                >
                  Quitter quand même
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Clic JOUER sur une card : grid = direct ; pont/chaine = choix solo/multi
  const onPlay = (game?: GameMode) => {
    if (game === "grid") {
      launchGame("grid");
      return;
    }
    if (game === "pont" || game === "chaine") {
      setPendingMode(game);
      return;
    }
    setPlaying(true);
  };

  // Après le choix Solo/Multi/Online :
  // - online : pas de demande de diff (random, comme un vrai matchmaking)
  // - solo/multi : on passe au choix de difficulté
  const onModePicked = (mode: PlayMode) => {
    if (!pendingMode) return;
    const game = pendingMode;
    setPendingMode(null);
    if (mode === "online") {
      const diffs: Difficulty[] = ["facile", "moyen", "expert"];
      const randomDiff = diffs[Math.floor(Math.random() * diffs.length)];
      setMatchmaking({ game, diff: randomDiff });
      return;
    }
    setPendingDiff({ game, mode });
  };

  // Après le choix de difficulté :
  // - multi  → ouvre direct la création de salon LePont
  // - online → matchmaking (faux adversaire) puis countdown
  // - solo   → countdown direct
  const onDiffPicked = (diff: Difficulty) => {
    if (!pendingDiff) return;
    const { game, mode } = pendingDiff;
    setPendingDiff(null);
    if (mode === "multi") {
      launchGame(game, diff, "create");
      return;
    }
    if (mode === "online") {
      setMatchmaking({ game, diff });
      return;
    }
    setCountdown({ game, diff });
  };

  // Fin du countdown OU clic multi : ouvre LePont avec les bons params URL
  const launchGame = (
    game: GameMode,
    diff?: Difficulty,
    multi?: "create",
    bot?: { pseudo: string; country: string }
  ) => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("play", game);
      if (diff) url.searchParams.set("diff", diff);
      if (multi) url.searchParams.set("multi", multi);
      if (bot) {
        url.searchParams.set("bot", bot.pseudo);
        url.searchParams.set("flag", bot.country);
      }
      window.history.replaceState({}, "", url.toString());
    } catch {}
    setCountdown(null);
    setPlaying(true);
  };

  // Rejoindre une room avec un code : on injecte ?room=CODE et LePont
  // lit le code dans son propre useEffect pour appeler joinRoom().
  const onJoinRoom = (code: string) => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("room", code);
      window.history.replaceState({}, "", url.toString());
    } catch {}
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

      <LobbyHeader active={tab} onChange={setTab} />

      <main className="relative flex-1 z-10">
        {tab === "play" && <LobbyView onPlay={onPlay} onJoinRoom={onJoinRoom} />}
        {tab === "tutos" && <TutosView />}
        {tab === "leaderboard" && <LeaderboardView onPlay={onPlay} />}
        {tab === "faq" && <FaqView />}
        {tab === "about" && <AboutView />}
      </main>

      {/* Ticker scrolling — actions récentes (mock) */}
      <ScoreTicker />

      {/* 1) Choix Solo / Multi */}
      {pendingMode && (
        <ModeChoiceModal
          game={pendingMode}
          onPick={onModePicked}
          onClose={() => setPendingMode(null)}
        />
      )}

      {/* 2) Choix de difficulté */}
      {pendingDiff && (
        <DifficultyModal
          game={pendingDiff.game}
          onPick={onDiffPicked}
          onClose={() => setPendingDiff(null)}
        />
      )}

      {/* 3a) Matchmaking (mode EN LIGNE — faux adversaire) */}
      {matchmaking && (
        <MatchmakingOverlay
          game={matchmaking.game}
          onFound={(opponent) => {
            const { game, diff } = matchmaking;
            setMatchmaking(null);
            setCountdown({ game, diff, bot: opponent });
          }}
          onCancel={() => setMatchmaking(null)}
        />
      )}

      {/* Countdown 5..0 avant d'ouvrir LePont */}
      {countdown && (
        <CountdownOverlay
          game={countdown.game}
          onDone={() => launchGame(countdown.game, countdown.diff, undefined, countdown.bot)}
          onCancel={() => setCountdown(null)}
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
