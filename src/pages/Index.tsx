import { useEffect, useState } from "react";
import LePont from "@/components/LePont.jsx";
import Home from "./Home";
import { GoatGuess } from "@/components/landing/GoatGuess";

const BREAKPOINT = 768;

const Index = () => {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < BREAKPOINT
  );
  const [goatGuessOpen, setGoatGuessOpen] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(window.innerWidth < BREAKPOINT);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  if (!isMobile) return <Home />;

  return (
    <>
      <LePont />

      {/* Bouton flottant GOAT Guess (mobile uniquement). LePont est massif
          et a sa propre nav interne — on superpose ce point d'entrée sans
          modifier LePont. L'overlay GoatGuess passe au-dessus grâce à
          son z-index plus élevé. */}
      {!goatGuessOpen && (
        <button
          onClick={() => setGoatGuessOpen(true)}
          aria-label="Ouvrir GOAT Guess"
          className="fixed bottom-4 right-4 z-[70] flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-[#C084FC] to-[#FF8A2A] text-[#1A0F00] font-display text-sm tracking-widest shadow-[0_8px_24px_rgba(192,132,252,0.4)] hover:scale-[1.03] active:scale-[0.97] transition-transform"
        >
          🔮 GOAT GUESS
        </button>
      )}

      {goatGuessOpen && <GoatGuess onClose={() => setGoatGuessOpen(false)} />}
    </>
  );
};

export default Index;
