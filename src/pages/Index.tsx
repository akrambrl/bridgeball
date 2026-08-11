import { useEffect, useState } from "react";
import LePont from "@/components/LePont.jsx";
import Home from "./Home";
import { GoatGuess } from "@/components/landing/GoatGuess";
import { FindPlayer } from "@/components/landing/FindPlayer";
import { tr } from "@/lib/lang";
import { displayStreak } from "@/lib/streak";
import { G, posterTitre, btn } from "@/lib/charte.jsx";

const BREAKPOINT = 768;

// Jeu demandé par l'URL (`/?play=<mode>`), tel que l'émettent les pages SEO.
//
// Ces deux modes-là vivent dans des overlays montés ICI, pas dans LePont : c'est
// donc à Index de lire le paramètre. Et il faut le lire à l'INITIALISATION de
// l'état, pas dans un effet : LePont est un enfant, ses effets tournent avant
// ceux du parent, et il efface l'URL au passage. Un effet d'Index arriverait
// toujours après le ménage.
//
// Attention aux deux noms proches, cf. le type GameMode : `grid` = « Trouve le
// joueur », `goatgrid` = la grille 3×3 (celle-là démarre bien dans LePont).
function jeuDemandeParURL(): string | null {
  try { return new URLSearchParams(window.location.search).get("play"); } catch { return null; }
}

// Le tableau de bord privé est demandé (`/?stats=…`). Lu au niveau module, comme
// `jeuDemandeParURL`, parce que trois initialiseurs d'état et un effet en ont
// besoin AVANT que LePont n'efface l'URL.
//
// Pourquoi ça compte : ouvrir le tableau de bord n'est pas jouer. Le pop-up de la
// devinette du jour se déclenchait 1,4 s après le montage sans regarder l'URL,
// donc il s'ouvrait PAR-DESSUS le tableau de bord — et les trois overlays de jeu
// mémorisés en sessionStorage se rouvraient de la même façon si on consultait les
// stats juste après une partie.
function tableauDeBordDemande(): boolean {
  try { return new URLSearchParams(window.location.search).has("stats"); } catch { return false; }
}

const Index = () => {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < BREAKPOINT
  );
  // On mémorise quel jeu est ouvert (sessionStorage) : si iOS recharge la PWA
  // quand on la quitte un instant (ex. faire une capture d'écran à envoyer à un
  // pote), on rouvre le jeu au lieu de retomber sur l'accueil.
  const [goatGuessOpen, setGoatGuessOpen] = useState(() => {
    if (tableauDeBordDemande()) return false;
    if (jeuDemandeParURL() === "guess") return true;
    try { return sessionStorage.getItem("bb_active_overlay") === "guess"; } catch { return false; }
  });
  const [findPlayerOpen, setFindPlayerOpen] = useState(() => {
    if (tableauDeBordDemande()) return false;
    if (jeuDemandeParURL() === "grid") return true;
    try { return sessionStorage.getItem("bb_active_overlay") === "findplayer"; } catch { return false; }
  });
  const [devinetteOpen, setDevinetteOpen] = useState(() => {
    if (tableauDeBordDemande()) return false;
    // La devinette était le SEUL des trois overlays à ne pas lire `?play=`. La
    // notification quotidienne pointait donc sur l'accueil : elle annonçait la
    // devinette du jour et n'y menait pas.
    if (jeuDemandeParURL() === "devinette") return true;
    try { return sessionStorage.getItem("bb_active_overlay") === "devinette"; } catch { return false; }
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

  // LePont émet ces events quand l'utilisateur clique sur une card du carrousel
  // mobile (GOAT Guess ou Trouve le joueur). On ouvre l'overlay dédié par-dessus.
  useEffect(() => {
    const onGuess = () => setGoatGuessOpen(true);
    const onFindPlayer = () => setFindPlayerOpen(true);
    const onDevinette = () => setDevinetteOpen(true);
    window.addEventListener("goatfc:open-guess", onGuess);
    window.addEventListener("goatfc:open-findplayer", onFindPlayer);
    window.addEventListener("goatfc:open-devinette", onDevinette);
    return () => {
      window.removeEventListener("goatfc:open-guess", onGuess);
      window.removeEventListener("goatfc:open-findplayer", onFindPlayer);
      window.removeEventListener("goatfc:open-devinette", onDevinette);
    };
  }, []);

  // Devinette du jour = pop-up automatique (pas une carte des modes). On la propose
  // à chaque lancement TANT QU'ELLE N'A PAS ÉTÉ JOUÉE aujourd'hui (une fois par
  // session pour ne pas être insistant). Une fois trouvée/terminée → plus de pop-up.
  useEffect(() => {
    if (!isMobile) return;
    if (tableauDeBordDemande()) return;   // consulter les stats n'est pas jouer
    try {
      const d = new Date();
      const paris = new Date(d.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
      const today = paris.getFullYear() + "-" + String(paris.getMonth() + 1).padStart(2, "0") + "-" + String(paris.getDate()).padStart(2, "0");
      const hasName = (localStorage.getItem("bb_name") || "").trim().length >= 2;
      let playedToday = false;
      try { const raw = localStorage.getItem("bb_devinette_" + today); if (raw) playedToday = !!JSON.parse(raw).over; } catch { /* noop */ }
      // localStorage (pas sessionStorage) : iOS tue et recrée la sessionStorage à chaque
      // réouverture de la PWA, ce qui faisait réapparaître le pop-up à chaque lancement.
      const shownToday = localStorage.getItem("bb_devinette_popup_shown") === today;
      const alreadyOpen = sessionStorage.getItem("bb_active_overlay") === "devinette";
      if (hasName && !playedToday && !shownToday && !alreadyOpen) {
        const t = setTimeout(() => {
          try { setPromptStreak(displayStreak(today).current); } catch { /* noop */ }
          setDevinettePrompt(true); // petit pop-up d'invitation (pas d'ouverture directe)
          try { localStorage.setItem("bb_devinette_popup_shown", today); } catch { /* noop */ }
        }, 1400);
        return () => clearTimeout(t);
      }
    } catch { /* noop */ }
  }, [isMobile]);

  // Le tableau de bord privé (?stats=…) vit dans LePont. Sur desktop on rend
  // normalement <Home />, donc le paramètre n'était jamais lu et le lien
  // retombait sur le jeu. On monte LePont dès que le paramètre est présent ;
  // c'est LePont qui valide le code, comme sur mobile.
  const wantsStats = tableauDeBordDemande();

  if (!isMobile && !wantsStats) return <Home />;

  return (
    <>
      <LePont />
      {goatGuessOpen && <GoatGuess onClose={() => setGoatGuessOpen(false)} />}
      {findPlayerOpen && <FindPlayer onClose={() => setFindPlayerOpen(false)} />}
      {devinetteOpen && (
        <FindPlayer
          daily
          onClose={() => {
            setDevinetteOpen(false);
            // LePont affiche l'état de la devinette (jouée ? série ?) sur
            // l'accueil : il doit le relire à la fermeture de l'overlay.
            window.dispatchEvent(new CustomEvent("goatfc:devinette-closed"));
          }}
        />
      )}
      {devinettePrompt && !devinetteOpen && (
        <div onClick={() => setDevinettePrompt(false)} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(8,17,9,.86)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 360, background: G.nuit, border: G.trait, borderRadius: G.rayonL, padding: "26px 22px", textAlign: "center", boxShadow: G.ombreL }}>
            <div style={{ fontSize: 42, marginBottom: 4 }}>🕵️</div>
            <div style={posterTitre(30, G.projecteur)}>{tr("DEVINETTE DU JOUR", "DAILY RIDDLE", "RÄTSEL DES TAGES", "INDOVINELLO DEL GIORNO", "ADIVINHA DO DIA","ADIVINANZA DEL DÍA")}</div>
            {promptStreak > 0 && (
              <div style={{ margin: "10px auto 0", display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: G.rayonS, background: G.maillot, border: G.traitFin, boxShadow: "2px 2px 0 " + G.encre, color: G.white, fontSize: 13, fontWeight: 900, letterSpacing: .3 }}>🔥 {tr("Ne perds pas ta série de", "Don't lose your", "Verliere nicht deine Serie von", "Non perdere la tua serie di", "Não perca sua sequência de","No pierdas tu racha de")} {promptStreak} {tr(promptStreak > 1 ? "jours" : "jour", promptStreak > 1 ? "days" : "day", promptStreak > 1 ? "Tage" : "Tag", promptStreak > 1 ? "giorni" : "giorno", promptStreak > 1 ? "dias" : "dia",promptStreak > 1 ? "días" : "día")} !</div>
            )}
            <div style={{ fontSize: 14, color: "rgba(255,255,255,.6)", margin: "8px 0 20px", lineHeight: 1.45 }}>{promptStreak > 0 ? tr("Joue aujourd'hui pour la faire grandir 👇", "Play today to keep it going 👇", "Spiele heute weiter 👇", "Gioca oggi per continuarla 👇", "Jogue hoje para mantê-la 👇","Juega hoy para hacerla crecer 👇") : tr("Un joueur mystère t'attend. Sauras-tu le deviner grâce aux indices ?", "A mystery player awaits. Can you guess him from the clues?", "Ein Rätselspieler wartet. Errätst du ihn anhand der Hinweise?", "Ti aspetta un giocatore misterioso. Sai indovinarlo con gli indizi?", "Um jogador misterioso te espera. Consegue adivinhar pelas dicas?","Te espera un jugador misterioso. ¿Sabrás adivinarlo con las pistas?")}</div>
            <button onClick={() => { setDevinettePrompt(false); setDevinetteOpen(true); }} style={{ ...btn(G.projecteur, G.encre, 20), width: "100%", padding: "13px", marginBottom: 10 }}>{tr("JOUER", "PLAY", "SPIELEN", "GIOCA", "JOGAR","JUGAR")} 🎯</button>
            <button onClick={() => setDevinettePrompt(false)} style={{ ...btn(G.nuit, G.white, 16), width: "100%", padding: "11px" }}>{tr("Plus tard", "Later", "Später", "Più tardi", "Mais tarde","Más tarde")}</button>
          </div>
        </div>
      )}
    </>
  );
};

export default Index;
