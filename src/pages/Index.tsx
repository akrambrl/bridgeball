import { useEffect, useState } from "react";
import LePont from "@/components/LePont.jsx";
import Home from "./Home";
import { GoatGuess } from "@/components/landing/GoatGuess";
import { FindPlayer } from "@/components/landing/FindPlayer";
import CareerMode from "@/components/career/CareerMode";
import { tr } from "@/lib/lang";
import { displayStreak } from "@/lib/streak";

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
  const [devinetteOpen, setDevinetteOpen] = useState(() => {
    try { return sessionStorage.getItem("bb_active_overlay") === "devinette"; } catch { return false; }
  });
  const [careerOpen, setCareerOpen] = useState(() => {
    try { return sessionStorage.getItem("bb_active_overlay") === "career"; } catch { return false; }
  });
  const [devinettePrompt, setDevinettePrompt] = useState(false); // petit pop-up d'invitation sur l'accueil
  const [promptStreak, setPromptStreak] = useState(0); // série en cours (loss-aversion dans le pop-up)

  useEffect(() => {
    try {
      if (findPlayerOpen) sessionStorage.setItem("bb_active_overlay", "findplayer");
      else if (sessionStorage.getItem("bb_active_overlay") === "findplayer") sessionStorage.removeItem("bb_active_overlay");
    } catch { /* noop */ }
  }, [findPlayerOpen]);

  useEffect(() => {
    try {
      if (devinetteOpen) sessionStorage.setItem("bb_active_overlay", "devinette");
      else if (sessionStorage.getItem("bb_active_overlay") === "devinette") sessionStorage.removeItem("bb_active_overlay");
    } catch { /* noop */ }
  }, [devinetteOpen]);

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

  useEffect(() => {
    try {
      if (careerOpen) sessionStorage.setItem("bb_active_overlay", "career");
      else if (sessionStorage.getItem("bb_active_overlay") === "career") sessionStorage.removeItem("bb_active_overlay");
    } catch { /* noop */ }
  }, [careerOpen]);

  // LePont émet ces events quand l'utilisateur clique sur une card du carrousel
  // mobile (GOAT Guess ou Trouve le joueur). On ouvre l'overlay dédié par-dessus.
  useEffect(() => {
    const onGuess = () => setGoatGuessOpen(true);
    const onFindPlayer = () => setFindPlayerOpen(true);
    const onDevinette = () => setDevinetteOpen(true);
    const onCareer = () => setCareerOpen(true);
    window.addEventListener("goatfc:open-guess", onGuess);
    window.addEventListener("goatfc:open-findplayer", onFindPlayer);
    window.addEventListener("goatfc:open-devinette", onDevinette);
    window.addEventListener("goatfc:open-career", onCareer);
    return () => {
      window.removeEventListener("goatfc:open-guess", onGuess);
      window.removeEventListener("goatfc:open-findplayer", onFindPlayer);
      window.removeEventListener("goatfc:open-devinette", onDevinette);
      window.removeEventListener("goatfc:open-career", onCareer);
    };
  }, []);

  // Devinette du jour = pop-up automatique (pas une carte des modes). On la propose
  // à chaque lancement TANT QU'ELLE N'A PAS ÉTÉ JOUÉE aujourd'hui (une fois par
  // session pour ne pas être insistant). Une fois trouvée/terminée → plus de pop-up.
  useEffect(() => {
    if (!isMobile) return;
    try {
      const d = new Date();
      const paris = new Date(d.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
      const today = paris.getFullYear() + "-" + String(paris.getMonth() + 1).padStart(2, "0") + "-" + String(paris.getDate()).padStart(2, "0");
      const hasName = (localStorage.getItem("bb_name") || "").trim().length >= 2;
      let playedToday = false;
      try { const raw = localStorage.getItem("bb_devinette_" + today); if (raw) playedToday = !!JSON.parse(raw).over; } catch { /* noop */ }
      const shownThisSession = sessionStorage.getItem("bb_devinette_popup_session") === today;
      const alreadyOpen = sessionStorage.getItem("bb_active_overlay") === "devinette";
      if (hasName && !playedToday && !shownThisSession && !alreadyOpen) {
        const t = setTimeout(() => {
          try { setPromptStreak(displayStreak(today).current); } catch { /* noop */ }
          setDevinettePrompt(true); // petit pop-up d'invitation (pas d'ouverture directe)
          try { sessionStorage.setItem("bb_devinette_popup_session", today); } catch { /* noop */ }
        }, 1400);
        return () => clearTimeout(t);
      }
    } catch { /* noop */ }
  }, [isMobile]);

  if (!isMobile) return <Home />;

  return (
    <>
      <LePont />
      {goatGuessOpen && <GoatGuess onClose={() => setGoatGuessOpen(false)} />}
      {findPlayerOpen && <FindPlayer onClose={() => setFindPlayerOpen(false)} />}
      {devinetteOpen && <FindPlayer daily onClose={() => setDevinetteOpen(false)} />}
      {careerOpen && <CareerMode onClose={() => setCareerOpen(false)} />}
      {devinettePrompt && !devinetteOpen && (
        <div onClick={() => setDevinettePrompt(false)} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,.72)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 360, background: "linear-gradient(180deg,#14110a,#0a0a0a)", border: "1px solid rgba(224,184,92,.4)", borderRadius: 22, padding: "26px 22px", textAlign: "center", boxShadow: "0 24px 70px rgba(0,0,0,.65)" }}>
            <div style={{ fontSize: 42, marginBottom: 4 }}>🕵️</div>
            <div style={{ fontFamily: "Anton, sans-serif", fontSize: 26, letterSpacing: 1, color: "#F2D680" }}>{tr("DEVINETTE DU JOUR", "DAILY RIDDLE", "RÄTSEL DES TAGES", "INDOVINELLO DEL GIORNO", "ADIVINHA DO DIA")}</div>
            {promptStreak > 0 && (
              <div style={{ margin: "10px auto 0", display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 999, background: "rgba(255,138,42,.16)", border: "1px solid rgba(255,138,42,.5)", color: "#FF8A2A", fontSize: 13, fontWeight: 900, letterSpacing: .3 }}>🔥 {tr("Ne perds pas ta série de", "Don't lose your", "Verliere nicht deine Serie von", "Non perdere la tua serie di", "Não perca sua sequência de")} {promptStreak} {tr(promptStreak > 1 ? "jours" : "jour", promptStreak > 1 ? "days" : "day", promptStreak > 1 ? "Tage" : "Tag", promptStreak > 1 ? "giorni" : "giorno", promptStreak > 1 ? "dias" : "dia")} !</div>
            )}
            <div style={{ fontSize: 14, color: "rgba(255,255,255,.6)", margin: "8px 0 20px", lineHeight: 1.45 }}>{promptStreak > 0 ? tr("Joue aujourd'hui pour la faire grandir 👇", "Play today to keep it going 👇", "Spiele heute weiter 👇", "Gioca oggi per continuarla 👇", "Jogue hoje para mantê-la 👇") : tr("Un joueur mystère t'attend. Sauras-tu le deviner grâce aux indices ?", "A mystery player awaits. Can you guess him from the clues?", "Ein Rätselspieler wartet. Errätst du ihn anhand der Hinweise?", "Ti aspetta un giocatore misterioso. Sai indovinarlo con gli indizi?", "Um jogador misterioso te espera. Consegue adivinhar pelas dicas?")}</div>
            <button onClick={() => { setDevinettePrompt(false); setDevinetteOpen(true); }} style={{ width: "100%", padding: "14px", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#F6D477,#C89A32)", color: "#3a2a05", fontSize: 16, fontWeight: 900, letterSpacing: .5, cursor: "pointer", marginBottom: 10 }}>{tr("JOUER", "PLAY", "SPIELEN", "GIOCA", "JOGAR")} 🎯</button>
            <button onClick={() => setDevinettePrompt(false)} style={{ width: "100%", padding: "10px", borderRadius: 12, border: "none", background: "transparent", color: "rgba(255,255,255,.5)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{tr("Plus tard", "Later", "Später", "Più tardi", "Mais tarde")}</button>
          </div>
        </div>
      )}
    </>
  );
};

export default Index;
