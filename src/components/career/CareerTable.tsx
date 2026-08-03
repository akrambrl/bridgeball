import { CareerState, sortedTable } from "@/lib/careerEngine";

type Props = { state: CareerState; onBack: () => void };

const G = {
  bg: "#080808", gold: "#F2D680", goldDark: "#C89A32",
  text: "rgba(255,255,255,.9)", sub: "rgba(255,255,255,.5)",
  card: "#111111", border: "rgba(255,255,255,.08)",
  font: "Anton, sans-serif", green: "#00E676", red: "#FF3B3B",
};

const DIV_LABEL: Record<number, string> = { 1: "Division 1", 2: "Division 2", 3: "Division 3" };

export default function CareerTable({ state, onBack }: Props) {
  const table = sortedTable(state.table);

  return (
    <div style={{ position: "fixed", inset: 0, background: G.bg, zIndex: 550, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: `1px solid ${G.border}` }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: G.sub, fontSize: 22, cursor: "pointer", padding: 0 }}>←</button>
        <div>
          <div style={{ fontFamily: G.font, fontSize: 18, color: G.gold }}>CLASSEMENT</div>
          <div style={{ fontSize: 12, color: G.sub }}>Saison {state.season} · {DIV_LABEL[state.division]}</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
        {/* Column headers */}
        <div style={{ display: "grid", gridTemplateColumns: "24px 1fr 28px 28px 28px 28px 28px 32px", gap: 4, padding: "0 4px 8px", borderBottom: `1px solid ${G.border}` }}>
          {["#","Club","J","V","N","D","DB","Pts"].map(h => (
            <div key={h} style={{ fontSize: 10, color: G.sub, textAlign: h === "Club" ? "left" : "center", fontWeight: 700 }}>{h}</div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 6 }}>
          {table.map((row, i) => {
            const isMe = row.clubId === state.clubId;
            const isPromotion = i < 2;
            const isRelegation = i >= table.length - 2;
            return (
              <div key={row.clubId} style={{
                display: "grid", gridTemplateColumns: "24px 1fr 28px 28px 28px 28px 28px 32px",
                gap: 4, padding: "9px 4px", borderRadius: 8, alignItems: "center",
                background: isMe ? "#1a1500" : "transparent",
                border: isMe ? `1px solid ${G.goldDark}44` : "1px solid transparent",
              }}>
                <div style={{ fontSize: 12, color: isPromotion ? G.green : isRelegation ? G.red : G.sub, textAlign: "center", fontWeight: 700 }}>{i + 1}</div>
                <div style={{ fontSize: 12, color: isMe ? G.gold : G.text, fontWeight: isMe ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {isMe ? "⭐ " : ""}{row.name}
                </div>
                {[row.p, row.w, row.d, row.l, row.gf - row.ga, row.pts].map((v, vi) => (
                  <div key={vi} style={{ fontSize: 12, textAlign: "center", color: vi === 5 ? (isMe ? G.gold : G.text) : G.sub, fontWeight: vi === 5 ? 700 : 400 }}>
                    {vi === 4 ? (v > 0 ? `+${v}` : String(v)) : String(v)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{ marginTop: 16, display: "flex", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: G.green }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: G.green }} />
            Promotion
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: G.red }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: G.red }} />
            Relégation
          </div>
        </div>
      </div>
    </div>
  );
}
