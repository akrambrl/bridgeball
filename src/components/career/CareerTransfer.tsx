import { useState, useEffect } from "react";
import { CareerState, CareerPlayer, generateTransferMarket, buyPlayer, formatBudget } from "@/lib/careerEngine";
import { PLAYERS } from "../../players.jsx";

type Props = { state: CareerState; onChange: (s: CareerState) => void; onBack: () => void };

const G = {
  bg: "#080808", gold: "#F2D680", goldDark: "#C89A32",
  text: "rgba(255,255,255,.9)", sub: "rgba(255,255,255,.5)",
  card: "#111111", border: "rgba(255,255,255,.08)",
  font: "Anton, sans-serif", green: "#00E676", red: "#FF3B3B",
};

const POS_COLOR: Record<string, string> = { GK: "#FF8C00", DEF: "#1565C0", MID: "#2E7D32", ATT: "#B71C1C" };

function MarketCard({ player, budget, onBuy }: { player: CareerPlayer; budget: number; onBuy: () => void }) {
  const canAfford = budget >= player.value;
  return (
    <div style={{ background: G.card, border: `1px solid ${player.isKnown ? G.goldDark + "44" : G.border}`, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: POS_COLOR[player.position], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, color: "#fff" }}>
          {player.position}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: G.text }}>{player.name}</div>
            {player.isKnown && <div style={{ fontSize: 9, background: G.goldDark, color: "#000", borderRadius: 4, padding: "1px 5px", fontWeight: 900 }}>STAR</div>}
          </div>
          <div style={{ fontSize: 11, color: G.sub }}>{player.nationality} · {player.age} ans</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: G.font, fontSize: 20, color: player.isKnown ? G.gold : G.text }}>{player.rating}</div>
          <div style={{ fontSize: 10, color: G.sub }}>Note</div>
        </div>
      </div>
      {player.isKnown && player.quizClubs && player.quizClubs.length > 0 && (
        <div style={{ fontSize: 11, color: G.sub, marginBottom: 8 }}>
          🏟 {player.quizClubs.slice(-3).join(" → ")}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: G.font, fontSize: 16, color: canAfford ? G.green : G.red }}>{formatBudget(player.value)}</div>
          <div style={{ fontSize: 10, color: G.sub }}>{formatBudget(player.wage)}/sem.</div>
        </div>
        <button onClick={onBuy} disabled={!canAfford}
          style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: canAfford ? `linear-gradient(135deg,${G.gold},${G.goldDark})` : "#333", color: canAfford ? "#1a0a00" : G.sub, fontFamily: G.font, fontSize: 13, cursor: canAfford ? "pointer" : "not-allowed", letterSpacing: .5 }}>
          SIGNER
        </button>
      </div>
    </div>
  );
}

export default function CareerTransfer({ state, onChange, onBack }: Props) {
  const [market, setMarket] = useState<CareerPlayer[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setMarket(generateTransferMarket(state.division, PLAYERS as any));
  }, []);

  function handleBuy(player: CareerPlayer) {
    const result = buyPlayer(state, player);
    if (typeof result === "string") { setMsg(result); return; }
    onChange(result);
    setMarket(prev => prev.filter(p => p.uid !== player.uid));
    setMsg(`✅ ${player.name} a rejoint ${state.clubName} !`);
    setTimeout(() => setMsg(null), 2500);
  }

  const stars = market.filter(p => p.isKnown);
  const unknowns = market.filter(p => !p.isKnown);

  return (
    <div style={{ position: "fixed", inset: 0, background: G.bg, zIndex: 550, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: `1px solid ${G.border}` }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: G.sub, fontSize: 22, cursor: "pointer", padding: 0 }}>←</button>
        <div>
          <div style={{ fontFamily: G.font, fontSize: 18, color: G.gold }}>MERCATO</div>
          <div style={{ fontSize: 12, color: G.sub }}>Budget : {formatBudget(state.budget)} · Effectif : {state.squad.length}/25</div>
        </div>
      </div>

      {msg && (
        <div style={{ margin: "8px 16px", padding: "10px 14px", background: msg.startsWith("✅") ? "rgba(0,230,118,.1)" : "rgba(255,59,59,.1)", border: `1px solid ${msg.startsWith("✅") ? G.green : G.red}33`, borderRadius: 10, fontSize: 13, color: msg.startsWith("✅") ? G.green : G.red }}>
          {msg}
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 20 }}>
        {stars.length > 0 && (
          <div>
            <div style={{ fontFamily: G.font, fontSize: 13, color: G.gold, marginBottom: 8, letterSpacing: .5 }}>⭐ JOUEURS CONNUS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {stars.map(p => <MarketCard key={p.uid} player={p} budget={state.budget} onBuy={() => handleBuy(p)} />)}
            </div>
          </div>
        )}
        {unknowns.length > 0 && (
          <div>
            <div style={{ fontFamily: G.font, fontSize: 13, color: G.sub, marginBottom: 8, letterSpacing: .5 }}>🔍 JOUEURS INCONNUS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {unknowns.map(p => <MarketCard key={p.uid} player={p} budget={state.budget} onBuy={() => handleBuy(p)} />)}
            </div>
          </div>
        )}
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}
