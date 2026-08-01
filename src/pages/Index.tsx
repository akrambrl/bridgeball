import { useEffect, useState } from "react";
import LePont from "@/components/LePont.jsx";
import Home from "./Home";
import { GoatGuess } from "@/components/landing/GoatGuess";
import { FindPlayer } from "@/components/landing/FindPlayer";

const BREAKPOINT = 768;

const Index = () => {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < BREAKPOINT
  );
  const [goatGuessOpen, setGoatGuessOpen] = useState(false);
  const [findPlayerOpen, setFindPlayerOpen] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(window.innerWidth < BREAKPOINT);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // LePont émet ces events quand l'utilisateur clique sur une card du carrousel
  // mobile (GOAT Guess ou Trouve le joueur). On ouvre l'overlay dédié par-dessus.
  useEffect(() => {
    const onGuess = () => setGoatGuessOpen(true);
    const onFindPlayer = () => setFindPlayerOpen(true);
    window.addEventListener("goatfc:open-guess", onGuess);
    window.addEventListener("goatfc:open-findplayer", onFindPlayer);
    return () => {
      window.removeEventListener("goatfc:open-guess", onGuess);
      window.removeEventListener("goatfc:open-findplayer", onFindPlayer);
    };
  }, []);

  if (!isMobile) return <Home />;

  return (
    <>
      <LePont />
      {goatGuessOpen && <GoatGuess onClose={() => setGoatGuessOpen(false)} />}
      {findPlayerOpen && <FindPlayer onClose={() => setFindPlayerOpen(false)} />}
    </>
  );
};

export default Index;
