import { CareerState, CareerPlayer, CareerPos, buyPlayer, releasePlayer, bestStartingXI, formatBudget } from "@/lib/careerEngine";

type Props = { state: CareerState; onChange: (s: CareerState) => void; onBack: () => void };

const G = {
  bg: "#080808", gold: "#F2D680", goldDark: "#C89A32",
  text: "rgba(255,255,255,.9)", sub: "rgba(255,255,255,.5)",
  card: "#111111", border: "rgba(255,255,255,.08)",
  font: "Anton, sans-serif", green: "#00E676", red: "#FF3B3B",
};

const POS_COLOR: Record<CareerPos, string> = {
  GK: "#FF8C00", DEF: "#1565C0", MID: "#2E7D32", ATT: "#B71C1C",
};
const POS_LABEL: Record<CareerPos, string> = {
  GK: "GB", DEF: "DEF", MID: "MIL", ATT: "ATT",
};

function RatingBar({ rating }: { rating: number }) {
  const pct = Math.round((rating / 99) * 100);
  const color = rating >= 80 ? G.gold : rating >= 65 ? G.green : rating >= 50 ? "#FFA726" : G.red;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flex: 1, height: 4, borderRadius: 2, background: "#222", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2 }} />
      </div>
      <div style={{ fontFamily: G.font, fontSize: 14, color, minWidth: 26, textAlign: "right" }}>{rating}</div>
    </div>
  );
}

function PlayerCard({ player, isStarter, onRelease }: { player: CareerPlayer; isStarter: boolean; onRelease: (e: React.MouseEvent) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: G.card, border: `1px solid ${isStarter ? G.goldDark + "66" : G.border}`, borderRadius: 12, position: "relative" }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: POS_COLOR[player.position], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, color: "#fff", flexShrink: 0 }}>
        {POS_LABEL[player.position]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: G.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{player.name}</div>
          {player.isKnown && <div style={{ fontSize: 9, background: G.goldDark, color: "#000", borderRadius: 4, padding: "1px 5px", fontWeight: 900, flexShrink: 0 }}>STAR</div>}
          {isStarter && <div style={{ fontSize: 9, background: G.green, color: "#000", borderRadius: 4, padding: "1px 5px", fontWeight: 900, flexShrink: 0 }}>XI</div>}
        </div>
        <div style={{ fontSize: 11, color: G.sub }}>{player.nationality} · {player.age} ans · {formatBudget(player.wage)}/sem.</div>
        <RatingBar rating={player.rating} />
      </div>
      <button onClick={(e) => onRelease(e)}
        style={{ background: "none", border: `1px solid ${G.red}44`, borderRadius: 8, color: G.red, padding: "4px 8px", fontSize: 11, cursor: "pointer", flexShrink: 0 }}>
        Libérer
      </button>
    </div>
  );
}

export default function CareerSquad({ state, onChange, onBack }: Props) {
  const starters = new Set(state.startingXI);

  function handleRelease(uid: string) {
    const result = releasePlayer(state, uid);
    if (typeof result === "string") { alert(result); return; }
    onChange(result);
  }

  function toggleStarter(uid: string) {
    const newXI = starters.has(uid)
      ? state.startingXI.filter(id => id !== uid)
      : state.startingXI.length < 11
        ? [...state.startingXI, uid]
        : state.startingXI;
    onChange({ ...state, startingXI: newXI });
  }

  const byPos: Record<CareerPos, CareerPlayer[]> = { GK:[], DEF:[], MID:[], ATT:[] };
  for (const p of state.squad) byPos[p.position].push(p);
  for (const pos of ["GK","DEF","MID","ATT"] as CareerPos[]) {
    byPos[pos].sort((a, b) => b.rating - a.rating);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: G.bg, zIndex: 550, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: `1px solid ${G.border}` }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: G.sub, fontSize: 22, cursor: "pointer", padding: 0 }}>←</button>
        <div>
          <div style={{ fontFamily: G.font, fontSize: 18, color: G.gold }}>EFFECTIF</div>
          <div style={{ fontSize: 12, color: G.sub }}>{state.squad.length} joueurs · XI titulaire : {state.startingXI.length}/11</div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 20 }}>
        {(["GK","DEF","MID","ATT"] as CareerPos[]).map(pos => (
          byPos[pos].length > 0 && (
            <div key={pos}>
              <div style={{ fontFamily: G.font, fontSize: 13, color: POS_COLOR[pos], marginBottom: 8, letterSpacing: .5 }}>
                {pos === "GK" ? "GARDIENS" : pos === "DEF" ? "DÉFENSEURS" : pos === "MID" ? "MILIEUX" : "ATTAQUANTS"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {byPos[pos].map(player => (
                  <div key={player.uid} onClick={() => toggleStarter(player.uid)} style={{ cursor: "pointer" }}>
                    <PlayerCard
                      player={player}
                      isStarter={starters.has(player.uid)}
                      onRelease={(e) => { e.stopPropagation(); handleRelease(player.uid); }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )
        ))}
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}
