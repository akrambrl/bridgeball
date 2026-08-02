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
  // On mémorise quel jeu est ouvert (sessionStorage) : si iOS recharge la PWA
  // quand on la quitte un instant (ex. faire une capture d'écran à envoyer à un
  // pote), on rouvre le jeu au lieu de retomber sur l'accueil.
  const [goatGuessOpen, setGoatGuessOpen] = useState(() => {
    try { return sessionStorage.getItem("bb_active_overlay") === "guess"; } catch { return false; }
  });
  const [findPlayerOpen, setFindPlayerOpen] = useState(() => {
    try { return sessionStorage.getItem("bb_active_overlay") === "findplayer"; } catch { return false; }
  });

  useEffect(() => {
    try {
      if (findPlayerOpen) sessionStorage.setItem("bb_active_overlay", "findplayer");
      else if (sessionStorage.getItem("bb_active_overlay") === "findplayer") sessionStorage.removeItem("bb_active_overlay");
    } catch { /* noop */ }
  }, [findPlayerOpen]);

  useEffect(() => {
    try {
      if (goatGuessOpen) sessionStorage.setItem("bb_active_overlay", "guess");
      else if (sessionStorage.getItem("bb_active_overlay") === "guess") sessionStorage.removeItem("bb_active_overlay");
    } catch { /* noop */ }
  }, [goatGuessOpen]);

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
