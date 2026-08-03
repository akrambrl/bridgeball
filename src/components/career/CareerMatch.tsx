import { useState } from "react";
import { CareerState, chooseSituationAction, CAREER_ATTACK_ACTIONS, CAREER_DEFENSE_ACTIONS } from "@/lib/careerEngine";

type Props = { state: CareerState; onChange: (s: CareerState) => void };

const G = {
  bg: "#080808", gold: "#F2D680", goldDark: "#C89A32",
  text: "rgba(255,255,255,.9)", sub: "rgba(255,255,255,.5)",
  card: "#111111", border: "rgba(255,255,255,.08)",
  font: "Anton, sans-serif", green: "#00E676", red: "#FF3B3B",
};

function ScoreBoard({ state }: { state: CareerState }) {
  const m = state.match!;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", padding: "14px 0 6px" }}>
      <div style={{ textAlign: "center", flex: 1 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, margin: "0 auto 5px", background: `linear-gradient(135deg,${state.clubPrimary},${state.clubSecondary})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color: state.clubSecondary === "#FFFFFF" ? state.clubPrimary : "#fff" }}>
          {state.clubName.split(" ").map(w => w[0]).join("").slice(0, 3)}
        </div>
        <div style={{ fontFamily: G.font, fontSize: 11, color: G.text }}>{state.clubName.split(" ").slice(-1)[0].toUpperCase()}</div>
      </div>
      <div style={{ textAlign: "center", padding: "0 8px" }}>
        <div style={{ fontFamily: G.font, fontSize: 40, color: G.gold, letterSpacing: 4 }}>{m.myGoals} — {m.opponentGoals}</div>
        <div style={{ fontSize: 11, color: G.sub }}>{m.half === 1 ? "1ère mi-temps" : "2ème mi-temps"}</div>
      </div>
      <div style={{ textAlign: "center", flex: 1 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, margin: "0 auto 5px", background: `linear-gradient(135deg,${m.opponentPrimary},#ffffff22)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color: "#fff" }}>
          {m.opponentName.replace("⚽ ","").split(" ").map(w => w[0]).join("").replace(/[^A-Z]/g,"").slice(0, 3)}
        </div>
        <div style={{ fontFamily: G.font, fontSize: 11, color: G.text }}>{m.opponentName.replace("⚽ ","").split(" ").slice(-1)[0].replace("(Coupe)","CUP").toUpperCase()}</div>
      </div>
    </div>
  );
}

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div style={{ display: "flex", gap: 5, justifyContent: "center", margin: "10px 0 4px" }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          width: i === current ? 22 : 8, height: 8, borderRadius: 4,
          background: i < current ? G.gold : i === current ? G.goldDark : "rgba(255,255,255,.15)",
          transition: "all .3s",
        }} />
      ))}
    </div>
  );
}

export default function CareerMatch({ state, onChange }: Props) {
  const [pending, setPending] = useState(false);
  const [outcomeDisplay, setOutcomeDisplay] = useState<{ text: string; type: "good" | "bad" } | null>(null);

  const m = state.match;
  if (!m) return null;

  const sitIdx = m.situation;
  const sit = m.situations[sitIdx];
  const isFinished = sitIdx >= m.situations.length;

  const actions = sit?.phase === "attack" ? CAREER_ATTACK_ACTIONS : CAREER_DEFENSE_ACTIONS;

  function handleChoose(actionIdx: number) {
    if (pending || !sit || sit.chosenIdx !== undefined) return;
    setPending(true);

    const newState = chooseSituationAction(state, actionIdx);
    const updatedSit = newState.match?.situations[sitIdx];
    const type = updatedSit?.outcome === "success" ? "good" : "bad";
    const text = updatedSit?.outcomeText ?? "";

    setOutcomeDisplay({ text, type });
    setTimeout(() => {
      setOutcomeDisplay(null);
      setPending(false);
      onChange(newState);
    }, 1600);
  }

  // Last non-neutral log (shows after each action)
  const lastLog = [...m.log].reverse().find(l => l.type !== "neutral");

  return (
    <div style={{ position: "fixed", inset: 0, background: G.bg, zIndex: 600, display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <div style={{ padding: "10px 16px 0", borderBottom: `1px solid ${G.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: G.font, fontSize: 12, color: G.sub, letterSpacing: 1 }}>
            {m.type === "cup" ? "⚽ COUPE" : "📋 CHAMPIONNAT"}
          </div>
          <div style={{ fontSize: 12, color: G.sub }}>
            Situation {Math.min(sitIdx + 1, m.situations.length)}/{m.situations.length}
          </div>
        </div>
        <ScoreBoard state={state} />
        <ProgressDots current={sitIdx} total={m.situations.length} />
      </div>

      {/* Recent event strip */}
      {lastLog && !outcomeDisplay && (
        <div style={{ margin: "8px 16px 0", padding: "8px 12px", borderRadius: 10, fontSize: 12, lineHeight: 1.4,
          background: lastLog.type === "goal_us" ? "rgba(0,230,118,.12)" : lastLog.type === "goal_them" ? "rgba(255,59,59,.12)" : "rgba(255,255,255,.05)",
          color: lastLog.type === "goal_us" ? G.green : lastLog.type === "goal_them" ? G.red : G.sub,
        }}>
          {lastLog.text}
        </div>
      )}

      {/* Main area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Outcome animation */}
        {outcomeDisplay && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 24px" }}>
            <div style={{ fontSize: 64, marginBottom: 12 }}>{outcomeDisplay.type === "good" ? "⚽" : "😤"}</div>
            <div style={{ fontFamily: G.font, fontSize: 18, color: outcomeDisplay.type === "good" ? G.green : G.red, letterSpacing: .5, lineHeight: 1.4 }}>
              {outcomeDisplay.text}
            </div>
          </div>
        )}

        {/* Situation card + actions */}
        {!outcomeDisplay && sit && !isFinished && (
          <>
            {/* Phase badge + context */}
            <div style={{ background: "#161616", border: `1.5px solid ${sit.phase === "attack" ? "#ff4444" : "#1565C0"}44`, borderRadius: 16, padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ padding: "3px 10px", borderRadius: 999, background: sit.phase === "attack" ? "rgba(255,68,68,.18)" : "rgba(21,101,192,.18)", border: `1px solid ${sit.phase === "attack" ? "#ff4444" : "#1565C0"}66`, fontFamily: G.font, fontSize: 11, color: sit.phase === "attack" ? "#ff6666" : "#64b5f6", letterSpacing: .5 }}>
                  {sit.phase === "attack" ? "⚔️ ATTAQUE" : "🛡️ DÉFENSE"}
                </div>
                <div style={{ marginLeft: "auto", fontSize: 11, color: G.sub }}>
                  {sit.playerName.split(" ")[0]} · {sit.playerRating}
                </div>
              </div>
              <div style={{ fontSize: 15, color: G.text, lineHeight: 1.5, fontWeight: 600 }}>
                {sit.context}
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ fontFamily: G.font, fontSize: 12, color: G.sub, letterSpacing: .5, textAlign: "center" }}>
              QUELLE DÉCISION ?
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {actions.map((action, i) => {
                const prob = sit.successProbs[i];
                const probColor = prob >= 65 ? G.green : prob >= 50 ? G.gold : G.red;
                return (
                  <button key={i} onClick={() => handleChoose(i)} disabled={pending}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 14, border: `1.5px solid ${G.border}`, background: "#161616", cursor: pending ? "not-allowed" : "pointer", textAlign: "left", transition: "border-color .15s" }}
                    onMouseEnter={e => { if (!pending) e.currentTarget.style.borderColor = G.goldDark; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = G.border; }}
                  >
                    <div style={{ fontSize: 28, flexShrink: 0, width: 36, textAlign: "center" }}>{action.emoji}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: G.font, fontSize: 15, color: G.text, letterSpacing: .5 }}>{action.label}</div>
                      <div style={{ fontSize: 12, color: G.sub, marginTop: 2 }}>{action.description}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontFamily: G.font, fontSize: 20, color: probColor }}>{prob}%</div>
                      <div style={{ fontSize: 10, color: G.sub }}>succès</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Match log toggle */}
            {m.log.length > 1 && (
              <details style={{ marginTop: 4 }}>
                <summary style={{ color: G.sub, fontSize: 12, cursor: "pointer", listStyle: "none" }}>
                  ▼ Voir le fil du match
                </summary>
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                  {m.log.map((l, i) => (
                    <div key={i} style={{ fontSize: 11, lineHeight: 1.4, padding: "4px 8px", borderRadius: 6,
                      color: l.type === "goal_us" ? G.green : l.type === "goal_them" ? G.red : G.sub,
                      background: l.type === "goal_us" ? "rgba(0,230,118,.08)" : l.type === "goal_them" ? "rgba(255,59,59,.08)" : "transparent",
                    }}>
                      {l.text}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </>
        )}

        {/* Finished state (should auto-transition via onChange, but safety fallback) */}
        {isFinished && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontFamily: G.font, fontSize: 18, color: G.gold }}>Fin du match…</div>
          </div>
        )}
      </div>
    </div>
  );
}
