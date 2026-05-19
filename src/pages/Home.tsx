import { useState } from "react";
import LePont from "@/components/LePont.jsx";
import { LobbyHeader, type TabKey } from "@/components/landing/LobbyHeader";
import { LobbyView } from "@/components/landing/LobbyView";
import { TutosView } from "@/components/landing/TutosView";
import { LeaderboardView } from "@/components/landing/LeaderboardView";
import { FaqView } from "@/components/landing/FaqView";
import { AboutView } from "@/components/landing/AboutView";

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

  const onPlay = () => setPlaying(true);

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
    </div>
  );
};

export default Home;
