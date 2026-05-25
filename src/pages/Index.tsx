import { useEffect, useState } from "react";
import LePont from "@/components/LePont.jsx";
import Home from "./Home";
import { GoatGuess } from "@/components/landing/GoatGuess";
import { Undercover } from "@/components/landing/Undercover";

const BREAKPOINT = 768;

const Index = () => {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < BREAKPOINT
  );
  const [goatGuessOpen, setGoatGuessOpen] = useState(false);
  const [undercoverOpen, setUndercoverOpen] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(window.innerWidth < BREAKPOINT);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // LePont émet cet event quand l'utilisateur clique sur la card GOAT Guess
  // du carrousel mobile. On ouvre l'overlay du composant GoatGuess par-dessus.
  useEffect(() => {
    const onOpen = () => setGoatGuessOpen(true);
    window.addEventListener("goatfc:open-guess", onOpen);
    return () => window.removeEventListener("goatfc:open-guess", onOpen);
  }, []);

  // Carte Undercover du carrousel mobile.
  useEffect(() => {
    const onOpen = () => setUndercoverOpen(true);
    window.addEventListener("goatfc:open-undercover", onOpen);
    return () => window.removeEventListener("goatfc:open-undercover", onOpen);
  }, []);

  if (!isMobile) return <Home />;

  return (
    <>
      <LePont />
      {goatGuessOpen && <GoatGuess onClose={() => setGoatGuessOpen(false)} />}
      {undercoverOpen && <Undercover onClose={() => setUndercoverOpen(false)} />}
    </>
  );
};

export default Index;
