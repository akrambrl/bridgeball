import { useState } from "react";
import { LEAGUES, League, LeagueClub } from "@/data/career/leagues";
import { createCareer, CareerState, formatBudget } from "@/lib/careerEngine";

type Step = "league" | "club" | "name";

type Props = { onStart: (state: CareerState) => void; onBack: () => void };

const G = {
  bg: "#080808",
  gold: "#F2D680",
  goldDark: "#C89A32",
  text: "rgba(255,255,255,.9)",
  sub: "rgba(255,255,255,.5)",
  card: "#111111",
  border: "rgba(255,255,255,.08)",
  font: "Anton, sans-serif",
};

const REP_STARS = (n: number) => "⭐".repeat(n) + "☆".repeat(5 - n);

export default function CareerOnboarding({ onStart, onBack }: Props) {
  const [step, setStep] = useState<Step>("league");
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [selectedClub, setSelectedClub] = useState<LeagueClub | null>(null);
  const [managerName, setManagerName] = useState("");

  const div3clubs = selectedLeague
    ? selectedLeague.divisions.find(d => d.level === 3)?.clubs ?? []
    : [];

  function handleStart() {
    if (!selectedLeague || !selectedClub || managerName.trim().length < 2) return;
    const state = createCareer(
      selectedLeague.id,
      selectedClub.id,
      selectedClub.name,
      selectedClub.primary,
      selectedClub.secondary,
      3,
      selectedClub.budget,
      managerName.trim(),
    );
    onStart(state);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: G.bg, zIndex: 500, display: "flex", flexDirection: "column", overflowY: "auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: "16px 20px", borderBottom: `1px solid ${G.border}`, gap: 12 }}>
        <button onClick={step === "league" ? onBack : () => setStep(step === "club" ? "league" : "club")}
          style={{ background: "none", border: "none", color: G.sub, fontSize: 22, cursor: "pointer", padding: 0 }}>←</button>
        <div>
          <div style={{ fontFamily: G.font, fontSize: 20, color: G.gold, letterSpacing: 1 }}>MODE CARRIÈRE</div>
          <div style={{ fontSize: 12, color: G.sub }}>
            {step === "league" ? "1/3 — Choisis ton championnat" : step === "club" ? "2/3 — Choisis ton club" : "3/3 — Ton nom de manager"}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, padding: "20px 16px", maxWidth: 480, margin: "0 auto", width: "100%" }}>
        {/* Step 1: League */}
        {step === "league" && (
          <>
            <div style={{ fontFamily: G.font, fontSize: 15, color: G.sub, marginBottom: 14, letterSpacing: .5 }}>SÉLECTIONNE UN CHAMPIONNAT</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {LEAGUES.map(league => (
                <button key={league.id}
                  onClick={() => { setSelectedLeague(league); setSelectedClub(null); setStep("club"); }}
                  style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 18px", background: G.card, border: `1.5px solid ${G.border}`, borderRadius: 14, cursor: "pointer", textAlign: "left", transition: "border-color .2s" }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = G.goldDark)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = G.border)}
                >
                  <span style={{ fontSize: 36 }}>{league.flag}</span>
                  <div>
                    <div style={{ fontFamily: G.font, fontSize: 18, color: G.text, letterSpacing: .5 }}>{league.name}</div>
                    <div style={{ fontSize: 12, color: G.sub }}>{league.country} · 3 divisions · 8 clubs</div>
                  </div>
                  <span style={{ marginLeft: "auto", color: G.goldDark, fontSize: 20 }}>›</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 2: Club */}
        {step === "club" && selectedLeague && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 24 }}>{selectedLeague.flag}</span>
              <div>
                <div style={{ fontFamily: G.font, fontSize: 16, color: G.gold }}>{selectedLeague.name} — Division 3</div>
                <div style={{ fontSize: 11, color: G.sub }}>Tu commences toujours en D3 🏚️</div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {div3clubs.map(club => (
                <button key={club.id}
                  onClick={() => { setSelectedClub(club); setStep("name"); }}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: G.card, border: `1.5px solid ${selectedClub?.id === club.id ? G.gold : G.border}`, borderRadius: 14, cursor: "pointer", textAlign: "left" }}
                >
                  {/* Club color pill */}
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: `linear-gradient(135deg,${club.primary},${club.secondary})`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, color: club.secondary === "#FFFFFF" ? club.primary : "#fff" }}>
                    {club.name.split(" ").map(w => w[0]).join("").slice(0, 3)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: G.font, fontSize: 16, color: G.text }}>{club.name}</div>
                    <div style={{ fontSize: 11, color: G.sub }}>{club.city}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: G.gold }}>{REP_STARS(club.rep)}</div>
                    <div style={{ fontSize: 11, color: G.sub }}>{formatBudget(club.budget)}</div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 3: Name */}
        {step === "name" && selectedClub && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              {/* Club badge */}
              <div style={{ width: 80, height: 80, borderRadius: 20, background: `linear-gradient(135deg,${selectedClub.primary},${selectedClub.secondary})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 900, color: selectedClub.secondary === "#FFFFFF" ? selectedClub.primary : "#fff", margin: "0 auto 12px" }}>
                {selectedClub.name.split(" ").map(w => w[0]).join("").slice(0, 3)}
              </div>
              <div style={{ fontFamily: G.font, fontSize: 22, color: G.text }}>{selectedClub.name}</div>
              <div style={{ fontSize: 12, color: G.sub, marginTop: 4 }}>{selectedLeague?.name} — Division 3 · Budget : {formatBudget(selectedClub.budget)}</div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: G.sub, marginBottom: 8, letterSpacing: .5 }}>TON NOM DE MANAGER</div>
              <input
                type="text"
                value={managerName}
                onChange={e => setManagerName(e.target.value)}
                placeholder="Ex : Mourinho Jr."
                maxLength={24}
                style={{ width: "100%", padding: "14px 16px", background: "#1a1a1a", border: `1.5px solid ${G.border}`, borderRadius: 12, color: G.text, fontSize: 16, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                onFocus={e => (e.currentTarget.style.borderColor = G.gold)}
                onBlur={e => (e.currentTarget.style.borderColor = G.border)}
              />
            </div>

            <div style={{ background: "#1a1a0a", border: `1px solid ${G.border}`, borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontFamily: G.font, fontSize: 13, color: G.gold, marginBottom: 8 }}>CE QUI T'ATTEND</div>
              <div style={{ fontSize: 13, color: G.sub, lineHeight: 1.6 }}>
                • 15 joueurs dans ton effectif (D3)<br />
                • Budget de {formatBudget(selectedClub.budget)}<br />
                • Saison : 14 matchs (ligue + coupe)<br />
                • Chaque match = 12 questions foot<br />
                • Bonne réponse = ton équipe attaque 🔥<br />
                • Top 2 = promotion en D2 ⬆️
              </div>
            </div>

            <button
              onClick={handleStart}
              disabled={managerName.trim().length < 2}
              style={{ width: "100%", padding: 16, borderRadius: 14, border: "none", background: managerName.trim().length >= 2 ? `linear-gradient(135deg,${G.gold},${G.goldDark})` : "#333", color: managerName.trim().length >= 2 ? "#1a0a00" : G.sub, fontFamily: G.font, fontSize: 18, letterSpacing: 1, cursor: managerName.trim().length >= 2 ? "pointer" : "not-allowed" }}
            >
              LANCER LA CARRIÈRE 🚀
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
