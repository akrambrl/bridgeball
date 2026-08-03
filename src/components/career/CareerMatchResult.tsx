import { CareerState, finishMatch, formatBudget, getNextFixture } from "@/lib/careerEngine";

type Props = {
  state: CareerState;
  onChange: (s: CareerState) => void;
};

const G = {
  bg: "#080808", gold: "#F2D680", goldDark: "#C89A32",
  text: "rgba(255,255,255,.9)", sub: "rgba(255,255,255,.5)",
  card: "#111111", border: "rgba(255,255,255,.08)",
  font: "Anton, sans-serif", green: "#00E676", red: "#FF3B3B",
};

export default function CareerMatchResult({ state, onChange }: Props) {
  const m = state.match;
  if (!m) return null;

  const won = m.myGoals > m.opponentGoals;
  const drawn = m.myGoals === m.opponentGoals;
  const lost = m.opponentGoals > m.myGoals;

  const correct = m.questions.filter(q => q.correct).length;
  const accuracy = Math.round((correct / m.questions.length) * 100);

  const prize = won ? 5_000 : drawn ? 2_000 : 0;

  function handleContinue() {
    onChange(finishMatch(state));
  }

  const emoji = won ? "🏆" : drawn ? "🤝" : "😔";
  const label = won ? "VICTOIRE !" : drawn ? "MATCH NUL" : "DÉFAITE";
  const color = won ? G.green : drawn ? G.gold : G.red;

  // Stats from questions
  const natQ = m.questions.filter(q => q.question.includes("nationalité")).length;
  const posQ = m.questions.filter(q => q.question.includes("poste")).length;
  const clubQ = m.questions.filter(q => q.question.includes("joué pour") || q.question.includes("A joué")).length;

  return (
    <div style={{ position: "fixed", inset: 0, background: G.bg, zIndex: 600, display: "flex", flexDirection: "column", overflowY: "auto" }}>
      <div style={{ maxWidth: 440, margin: "0 auto", width: "100%", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Result hero */}
        <div style={{ textAlign: "center", padding: "20px 0 12px" }}>
          <div style={{ fontSize: 64, marginBottom: 8 }}>{emoji}</div>
          <div style={{ fontFamily: G.font, fontSize: 34, color, letterSpacing: 2, marginBottom: 10 }}>{label}</div>
          {/* Score */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 50, height: 50, borderRadius: 12, background: `linear-gradient(135deg,${state.clubPrimary},${state.clubSecondary})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: state.clubSecondary === "#FFFFFF" ? state.clubPrimary : "#fff", margin: "0 auto 6px" }}>
                {state.clubName.split(" ").map(w => w[0]).join("").slice(0, 3)}
              </div>
              <div style={{ fontFamily: G.font, fontSize: 11, color: G.sub }}>{state.clubName.split(" ").pop()?.toUpperCase()}</div>
            </div>
            <div style={{ fontFamily: G.font, fontSize: 48, color: G.gold, letterSpacing: 4, padding: "0 8px" }}>
              {m.myGoals} — {m.opponentGoals}
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 50, height: 50, borderRadius: 12, background: `linear-gradient(135deg,${m.opponentPrimary},#ffffff22)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: "#fff", margin: "0 auto 6px" }}>
                {m.opponentName.replace("⚽ ","").split(" ").map(w => w[0]).join("").replace(/[^A-Z]/g,"").slice(0, 3)}
              </div>
              <div style={{ fontFamily: G.font, fontSize: 11, color: G.sub }}>{m.opponentName.replace("⚽ ","").split(" ").pop()?.replace("(Coupe)","CUP").toUpperCase()}</div>
            </div>
          </div>
        </div>

        {/* Performance */}
        <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 14, padding: "14px 16px" }}>
          <div style={{ fontFamily: G.font, fontSize: 13, color: G.gold, marginBottom: 12 }}>PERFORMANCE</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: G.font, fontSize: 28, color: accuracy >= 70 ? G.green : accuracy >= 50 ? G.gold : G.red }}>{accuracy}%</div>
              <div style={{ fontSize: 11, color: G.sub }}>Précision</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: G.font, fontSize: 28, color: G.text }}>{correct}/{m.questions.length}</div>
              <div style={{ fontSize: 11, color: G.sub }}>Réponses ✅</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: G.font, fontSize: 28, color: G.gold }}>+{formatBudget(prize)}</div>
              <div style={{ fontSize: 11, color: G.sub }}>Gains</div>
            </div>
          </div>
        </div>

        {/* Match log highlights */}
        <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 14, padding: "14px 16px" }}>
          <div style={{ fontFamily: G.font, fontSize: 13, color: G.gold, marginBottom: 10 }}>BUTS DU MATCH</div>
          {m.log.filter(l => l.type === "goal_us" || l.type === "goal_them").length === 0 && (
            <div style={{ fontSize: 13, color: G.sub }}>Aucun but. 0-0 🥱</div>
          )}
          {m.log.filter(l => l.type === "goal_us" || l.type === "goal_them").map((l, i) => (
            <div key={i} style={{
              fontSize: 12, lineHeight: 1.5, marginBottom: 6, padding: "6px 10px", borderRadius: 8,
              background: l.type === "goal_us" ? "rgba(0,230,118,.08)" : "rgba(255,59,59,.08)",
              color: l.type === "goal_us" ? G.green : G.red,
            }}>
              {l.text.replace(/^[✅❌] /, "")}
            </div>
          ))}
        </div>

        {/* Budget */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#0f1800", border: `1px solid rgba(0,230,118,.15)`, borderRadius: 12 }}>
          <div style={{ fontSize: 13, color: G.sub }}>Budget après le match</div>
          <div style={{ fontFamily: G.font, fontSize: 18, color: G.green }}>{formatBudget(state.budget + prize)}</div>
        </div>

        {/* Continue */}
        <button onClick={handleContinue}
          style={{ width: "100%", padding: 16, borderRadius: 14, border: "none", background: `linear-gradient(135deg,${G.gold},${G.goldDark})`, color: "#1a0a00", fontFamily: G.font, fontSize: 18, letterSpacing: 1, cursor: "pointer" }}>
          CONTINUER →
        </button>
      </div>
    </div>
  );
}
