import { useState, useCallback } from "react";
import { CareerState, loadCareer, saveCareer, deleteCareer, hasCareer } from "@/lib/careerEngine";
import CareerOnboarding from "./CareerOnboarding";
import CareerHub from "./CareerHub";
import CareerMatch from "./CareerMatch";
import CareerMatchResult from "./CareerMatchResult";
import CareerSquad from "./CareerSquad";
import CareerTransfer from "./CareerTransfer";
import CareerTable from "./CareerTable";

type Props = { onClose: () => void };

const G = {
  bg: "#080808", gold: "#F2D680", goldDark: "#C89A32",
  text: "rgba(255,255,255,.9)", sub: "rgba(255,255,255,.5)",
  card: "#111111", border: "rgba(255,255,255,.08)",
  font: "Anton, sans-serif",
};

function StartScreen({ onNew, onContinue, hasSave }: { onNew: () => void; onContinue: () => void; hasSave: boolean }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: G.bg, zIndex: 500, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      {/* Field illustration (CSS only) */}
      <div style={{ width: 90, height: 90, borderRadius: 22, background: "linear-gradient(135deg,#004400,#007700)", border: "3px solid #00aa00", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, boxShadow: "0 0 30px #00aa0044" }}>
        <span style={{ fontSize: 44 }}>⚽</span>
      </div>
      <div style={{ fontFamily: G.font, fontSize: 32, color: G.gold, letterSpacing: 2, marginBottom: 6, textAlign: "center" }}>MODE CARRIÈRE</div>
      <div style={{ fontSize: 14, color: G.sub, textAlign: "center", marginBottom: 32, lineHeight: 1.5 }}>
        Choisis un club de D3, monte les divisions,<br />signe des stars, domine la ligue.
      </div>

      <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 12 }}>
        {hasSave && (
          <button onClick={onContinue}
            style={{ width: "100%", padding: 16, borderRadius: 14, border: "none", background: `linear-gradient(135deg,${G.gold},${G.goldDark})`, color: "#1a0a00", fontFamily: G.font, fontSize: 18, letterSpacing: 1, cursor: "pointer" }}>
            CONTINUER MA CARRIÈRE ▶
          </button>
        )}
        <button onClick={onNew}
          style={{ width: "100%", padding: 16, borderRadius: 14, border: `1.5px solid ${G.border}`, background: G.card, color: G.text, fontFamily: G.font, fontSize: 18, letterSpacing: 1, cursor: "pointer" }}>
          {hasSave ? "NOUVELLE CARRIÈRE" : "COMMENCER ▶"}
        </button>
      </div>

      <div style={{ marginTop: 20, fontSize: 12, color: G.sub, textAlign: "center", lineHeight: 1.6 }}>
        Matchs = 12 questions foot ⚽<br />
        Bonne réponse → ton équipe attaque 🔥
      </div>
    </div>
  );
}

type Screen = "start" | "onboarding" | "hub" | "match" | "match_result" | "squad" | "transfer" | "table";

export default function CareerMode({ onClose }: Props) {
  const [screen, setScreen] = useState<Screen>(() => {
    if (hasCareer()) return "hub";
    return "start";
  });
  const [careerState, setCareerState] = useState<CareerState | null>(() => loadCareer());

  const handleStateChange = useCallback((newState: CareerState) => {
    saveCareer(newState);
    setCareerState(newState);
    // Navigate based on phase
    if (newState.phase === "match") setScreen("match");
    else if (newState.phase === "match_result") setScreen("match_result");
    else if (newState.phase === "season_end") setScreen("hub");
    else setScreen("hub");
  }, []);

  function handleNewCareer() {
    setScreen("onboarding");
  }

  function handleContinue() {
    setScreen("hub");
  }

  function handleOnboardingStart(state: CareerState) {
    saveCareer(state);
    setCareerState(state);
    setScreen("hub");
  }

  function handleQuit() {
    onClose();
  }

  function confirmNewCareer() {
    if (careerState && !window.confirm("Supprimer ta carrière actuelle et repartir de zéro ?")) return;
    deleteCareer();
    setCareerState(null);
    setScreen("onboarding");
  }

  if (screen === "start") {
    return <StartScreen onNew={handleNewCareer} onContinue={handleContinue} hasSave={!!careerState} />;
  }

  if (screen === "onboarding") {
    return <CareerOnboarding onStart={handleOnboardingStart} onBack={() => setScreen("start")} />;
  }

  if (!careerState) return null;

  if (screen === "match" || careerState.phase === "match") {
    return <CareerMatch state={careerState} onChange={handleStateChange} />;
  }

  if (screen === "match_result" || careerState.phase === "match_result") {
    return <CareerMatchResult state={careerState} onChange={handleStateChange} />;
  }

  if (screen === "squad") {
    return <CareerSquad state={careerState} onChange={s => { saveCareer(s); setCareerState(s); }} onBack={() => setScreen("hub")} />;
  }

  if (screen === "transfer") {
    return <CareerTransfer state={careerState} onChange={s => { saveCareer(s); setCareerState(s); }} onBack={() => setScreen("hub")} />;
  }

  if (screen === "table") {
    return <CareerTable state={careerState} onBack={() => setScreen("hub")} />;
  }

  // Default: hub
  return (
    <CareerHub
      state={careerState}
      onChange={handleStateChange}
      onOpenSquad={() => setScreen("squad")}
      onOpenTransfer={() => setScreen("transfer")}
      onOpenTable={() => setScreen("table")}
      onQuit={handleQuit}
    />
  );
}
