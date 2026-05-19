import { useState } from "react";
import LePont from "@/components/LePont.jsx";
import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { GamesSection } from "@/components/landing/GamesSection";
import { TutosSection } from "@/components/landing/TutosSection";
import { LeaderboardSection } from "@/components/landing/LeaderboardSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { AboutSection } from "@/components/landing/AboutSection";
import { Footer } from "@/components/landing/Footer";

const Home = () => {
  const [playing, setPlaying] = useState(false);

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

  const launch = () => setPlaying(true);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header onPlay={launch} />
      <main className="flex-1">
        <Hero onPlay={launch} />
        <GamesSection onPlay={launch} />
        <TutosSection />
        <LeaderboardSection onPlay={launch} />
        <FaqSection />
        <AboutSection />
      </main>
      <Footer />
    </div>
  );
};

export default Home;
