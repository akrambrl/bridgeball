import { useState, useEffect } from "react";
import { CareerState, resolveMatchAction, genPlayerName, MatchQuestion } from "@/lib/careerEngine";

type Props = {
  state: CareerState;
  onChange: (s: CareerState) => void;
};

const G = {
  bg: "#080808",
  gold: "#F2D680",
  goldDark: "#C89A32",
  text: "rgba(255,255,255,.9)",
  sub: "rgba(255,255,255,.5)",
  card: "#111111",
  border: "rgba(255,255,255,.08)",
  font: "Anton, sans-serif",
  green: "#00E676",
  red: "#FF3B3B",
};

function ProgressBar({ action, total }: { action: number; total: number }) {
  return (
    <div style={{ display: "flex", gap: 3, margin: "12px 0" }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          flex: 1, height: 5, borderRadius: 3,
          background: i < action ? G.gold : i === action ? "rgba(242,214,128,.4)" : "rgba(255,255,255,.1)",
          transition: "background .3s",
        }} />
      ))}
    </div>
  );
}

function ScoreBoard({ state }: { state: CareerState }) {
  const m = state.match!;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", padding: "16px 0 8px" }}>
      {/* Your club */}
      <div style={{ textAlign: "center", flex: 1 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 10, margin: "0 auto 6px",
          background: `linear-gradient(135deg,${state.clubPrimary},${state.clubSecondary})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 900, color: state.clubSecondary === "#FFFFFF" ? state.clubPrimary : "#fff",
        }}>
          {state.clubName.split(" ").map(w => w[0]).join("").slice(0, 3)}
        </div>
        <div style={{ fontFamily: G.font, fontSize: 12, color: G.text, letterSpacing: .5 }}>{state.clubName.split(" ").slice(-1)[0].toUpperCase()}</div>
      </div>
      {/* Score */}
      <div style={{ textAlign: "center", padding: "0 8px" }}>
        <div style={{ fontFamily: G.font, fontSize: 42, color: G.gold, letterSpacing: 4 }}>
          {m.myGoals} — {m.opponentGoals}
        </div>
        <div style={{ fontSize: 11, color: G.sub }}>{m.half === 1 ? "1ère mi-temps" : "2ème mi-temps"}</div>
      </div>
      {/* Opponent */}
      <div style={{ textAlign: "center", flex: 1 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 10, margin: "0 auto 6px",
          background: `linear-gradient(135deg,${m.opponentPrimary},#ffffff22)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 900, color: "#fff",
        }}>
          {m.opponentName.replace("⚽ ", "").split(" ").map(w => w[0]).join("").replace(/[^A-Z]/g,"").slice(0, 3)}
        </div>
        <div style={{ fontFamily: G.font, fontSize: 12, color: G.text, letterSpacing: .5 }}>{m.opponentName.replace("⚽ ", "").split(" ").slice(-1)[0].replace("(Coupe)","CUP").toUpperCase()}</div>
      </div>
    </div>
  );
}

export default function CareerMatch({ state, onChange }: Props) {
  const [feedback, setFeedback] = useState<{ text: string; type: "good"|"bad" } | null>(null);
  const [showLog, setShowLog] = useState(false);

  const m = state.match;
  if (!m) return null;

  const actionIdx = m.action;
  const finished = actionIdx >= m.questions.length;
  const q: MatchQuestion | undefined = m.questions[actionIdx];

  // Pick attacker and defender names from starting XI
  const starters = state.squad.filter(p => state.startingXI.includes(p.uid));
  const attackers = starters.filter(p => p.position === "ATT" || p.position === "MID");
  const defenders = starters.filter(p => p.position === "DEF" || p.position === "GK");
  const attackerName = attackers.length > 0 ? attackers[Math.floor(actionIdx * 0.37 * attackers.length) % attackers.length].name.split(" ")[0] : "Ton attaquant";
  const defenderName = defenders.length > 0 ? defenders[Math.floor(actionIdx * 0.61 * defenders.length) % defenders.length].name.split(" ")[0] : "Ton défenseur";

  function handleAnswer(idx: number) {
    if (!q || q.answered) return;
    const newState = resolveMatchAction(state, idx, attackerName, defenderName);
    const lastLog = newState.match?.log.slice(-1)[0];
    setFeedback({
      text: lastLog?.text ?? "",
      type: idx === q.correctIdx ? "good" : "bad",
    });
    setTimeout(() => {
      setFeedback(null);
      onChange(newState);
    }, 1400);
  }

  const halfwayLog = m.log.filter(l => l.text.includes("Mi-temps"));
  const lastLog = m.log[m.log.length - 1];

  return (
    <div style={{ position: "fixed", inset: 0, background: G.bg, zIndex: 600, display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <div style={{ padding: "10px 16px", borderBottom: `1px solid ${G.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
          <div style={{ fontFamily: G.font, fontSize: 13, color: G.sub, letterSpacing: 1 }}>
            {m.type === "cup" ? "⚽ COUPE" : "📋 CHAMPIONNAT"}
          </div>
          <div style={{ fontSize: 12, color: G.sub }}>
            Action {actionIdx + 1}/{m.questions.length}
          </div>
        </div>
        <ScoreBoard state={state} />
        <ProgressBar action={actionIdx} total={m.questions.length} />
      </div>

      {/* Last log entry */}
      {lastLog && lastLog.type !== "neutral" && (
        <div style={{
          margin: "8px 16px 0",
          padding: "8px 12px",
          borderRadius: 10,
          fontSize: 12,
          background: lastLog.type === "goal_us" ? "rgba(0,230,118,.12)" :
                      lastLog.type === "goal_them" ? "rgba(255,59,59,.12)" :
                      "rgba(255,255,255,.05)",
          color: lastLog.type === "goal_us" ? G.green :
                 lastLog.type === "goal_them" ? G.red : G.sub,
          lineHeight: 1.4,
        }}>
          {lastLog.text}
        </div>
      )}

      {/* Quiz area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
        {q && !feedback && (
          <>
            {/* Player card */}
            <div style={{ background: "#161616", border: `1.5px solid ${G.border}`, borderRadius: 16, padding: "16px", textAlign: "center" }}>
              <div style={{ fontSize: 11, color: G.sub, letterSpacing: 1, marginBottom: 6 }}>JOUEUR MYSTÈRE</div>
              <div style={{ fontFamily: G.font, fontSize: 22, color: G.gold, letterSpacing: .5, marginBottom: 4 }}>{q.playerName.toUpperCase()}</div>
              <div style={{ fontSize: 13, color: G.sub }}>{q.question}</div>
            </div>

            {/* Answer buttons */}
            <div style={{ display: "grid", gridTemplateColumns: q.options.length === 2 ? "1fr 1fr" : "1fr 1fr", gap: 10 }}>
              {q.options.map((opt, i) => (
                <button key={i} onClick={() => handleAnswer(i)}
                  style={{
                    padding: "16px 10px", borderRadius: 14, border: `1.5px solid ${G.border}`,
                    background: "#161616", color: G.text, fontSize: 14, fontWeight: 700,
                    cursor: "pointer", lineHeight: 1.3, transition: "transform .1s, border-color .15s",
                    fontFamily: "inherit",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = G.gold; e.currentTarget.style.transform = "scale(1.02)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = G.border; e.currentTarget.style.transform = "scale(1)"; }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Feedback overlay */}
        {feedback && (
          <div style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            textAlign: "center", padding: 20,
          }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>{feedback.type === "good" ? "⚽" : "😤"}</div>
            <div style={{
              fontFamily: G.font, fontSize: 20,
              color: feedback.type === "good" ? G.green : G.red,
              letterSpacing: .5, lineHeight: 1.3,
            }}>
              {feedback.text.replace(/^[✅❌] /, "").split("→")[1]?.trim() ?? feedback.text}
            </div>
          </div>
        )}

        {/* Half-time notice */}
        {halfwayLog.length > 0 && actionIdx === m.questions.length / 2 && !feedback && (
          <div style={{ background: "#1a1800", border: `1px solid ${G.goldDark}33`, borderRadius: 12, padding: "12px 16px", textAlign: "center" }}>
            <div style={{ fontFamily: G.font, fontSize: 14, color: G.gold }}>🔔 MI-TEMPS</div>
            <div style={{ fontSize: 13, color: G.sub, marginTop: 4 }}>{halfwayLog[0].text}</div>
          </div>
        )}

        {/* Commentary log toggle */}
        {m.log.length > 1 && (
          <div>
            <button onClick={() => setShowLog(v => !v)}
              style={{ background: "none", border: "none", color: G.sub, fontSize: 12, cursor: "pointer", padding: 0 }}>
              {showLog ? "▲ Masquer le fil du match" : "▼ Voir le fil du match"}
            </button>
            {showLog && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, maxHeight: 180, overflowY: "auto" }}>
                {m.log.map((l, i) => (
                  <div key={i} style={{
                    fontSize: 11, lineHeight: 1.4, padding: "4px 8px", borderRadius: 6,
                    color: l.type === "goal_us" ? G.green : l.type === "goal_them" ? G.red : G.sub,
                    background: l.type === "goal_us" ? "rgba(0,230,118,.08)" : l.type === "goal_them" ? "rgba(255,59,59,.08)" : "transparent",
                  }}>{l.text}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
