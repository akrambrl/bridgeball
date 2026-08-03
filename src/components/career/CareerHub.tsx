import { CareerState, getNextFixture, sortedTable, formatBudget, avgRating, startMatch, startNewSeason } from "@/lib/careerEngine";
import { PLAYERS, GG_BALLON_DOR, RETIRED_PLAYERS } from "../../players.jsx";

type Props = {
  state: CareerState;
  onChange: (s: CareerState) => void;
  onOpenSquad: () => void;
  onOpenTransfer: () => void;
  onOpenTable: () => void;
  onQuit: () => void;
};

const G = {
  bg: "#080808", gold: "#F2D680", goldDark: "#C89A32",
  text: "rgba(255,255,255,.9)", sub: "rgba(255,255,255,.5)",
  card: "#111111", border: "rgba(255,255,255,.08)",
  font: "Anton, sans-serif", green: "#00E676", red: "#FF3B3B",
};

const DIV_LABEL: Record<number, string> = { 1: "Division 1", 2: "Division 2", 3: "Division 3" };

export default function CareerHub({ state, onChange, onOpenSquad, onOpenTransfer, onOpenTable, onQuit }: Props) {
  const next = getNextFixture(state);
  const myRating = avgRating(state.squad, state.startingXI);
  const table = sortedTable(state.table);
  const myPos = table.findIndex(r => r.clubId === state.clubId) + 1;
  const myRow = table.find(r => r.clubId === state.clubId);

  // Last result
  const lastPlayed = [...state.fixtures].filter(f => f.played).pop();
  const won = lastPlayed ? (lastPlayed.myGoals ?? 0) > (lastPlayed.opponentGoals ?? 0) : null;
  const drawn = lastPlayed ? (lastPlayed.myGoals ?? 0) === (lastPlayed.opponentGoals ?? 0) : null;

  function handlePlayNext() {
    if (!next) return;
    const s = startMatch(state, next.uid, PLAYERS as any, GG_BALLON_DOR as Set<string>, RETIRED_PLAYERS as Set<string>);
    onChange(s);
  }

  function handleNewSeason() {
    onChange(startNewSeason(state));
  }

  const leagueGames = state.fixtures.filter(f => f.type === "league");
  const cupGames = state.fixtures.filter(f => f.type === "cup");
  const played = state.fixtures.filter(f => f.played).length;

  const isSeasonEnd = state.phase === "season_end";

  return (
    <div style={{ position: "fixed", inset: 0, background: G.bg, zIndex: 500, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${G.border}`, padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 9, background: `linear-gradient(135deg,${state.clubPrimary},${state.clubSecondary})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color: state.clubSecondary === "#FFFFFF" ? state.clubPrimary : "#fff" }}>
              {state.clubName.split(" ").map(w => w[0]).join("").slice(0, 3)}
            </div>
            <div>
              <div style={{ fontFamily: G.font, fontSize: 16, color: G.text }}>{state.clubName}</div>
              <div style={{ fontSize: 11, color: G.sub }}>Saison {state.season} · {DIV_LABEL[state.division]}</div>
            </div>
          </div>
          <button onClick={onQuit} style={{ background: "none", border: "none", color: G.sub, fontSize: 13, cursor: "pointer" }}>Quitter</button>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Manager banner */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#111500", border: `1px solid ${G.goldDark}33`, borderRadius: 12 }}>
          <div style={{ fontSize: 28 }}>👔</div>
          <div>
            <div style={{ fontFamily: G.font, fontSize: 14, color: G.gold }}>{state.managerName}</div>
            <div style={{ fontSize: 11, color: G.sub }}>{state.totalWins}V · {state.totalLosses}D · Force : {myRating}/99</div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontFamily: G.font, fontSize: 16, color: G.green }}>{formatBudget(state.budget)}</div>
            <div style={{ fontSize: 11, color: G.sub }}>Budget</div>
          </div>
        </div>

        {/* Season end */}
        {isSeasonEnd && (
          <div style={{ background: "#1a1000", border: `1px solid ${G.gold}44`, borderRadius: 14, padding: "16px", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{myPos <= 2 ? "🚀" : myPos >= 7 ? "😭" : "📋"}</div>
            <div style={{ fontFamily: G.font, fontSize: 20, color: G.gold, marginBottom: 6 }}>FIN DE SAISON {state.season}</div>
            <div style={{ fontSize: 13, color: G.sub, marginBottom: 14 }}>
              {myPos <= 2 ? `🎉 ${myPos}ème — PROMOTION en Division ${state.division - 1} !` :
               myPos >= 7 ? `😔 ${myPos}ème — Relégation en Division ${state.division + 1}` :
               `${myPos}ème au classement. Continue comme ça !`}
            </div>
            <div style={{ fontSize: 12, color: G.sub, marginBottom: 14 }}>
              Bilan : {state.fixtures.filter(f=>f.played && (f.myGoals??0)>(f.opponentGoals??0)).length}V — {state.fixtures.filter(f=>f.played && (f.myGoals??0)===(f.opponentGoals??0)).length}N — {state.fixtures.filter(f=>f.played && (f.myGoals??0)<(f.opponentGoals??0)).length}D
            </div>
            <button onClick={handleNewSeason}
              style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: `linear-gradient(135deg,${G.gold},${G.goldDark})`, color: "#1a0a00", fontFamily: G.font, fontSize: 16, cursor: "pointer" }}>
              DÉMARRER LA SAISON {state.season + 1} →
            </button>
          </div>
        )}

        {/* Next match */}
        {!isSeasonEnd && next && (
          <div>
            <div style={{ fontFamily: G.font, fontSize: 13, color: G.sub, marginBottom: 8, letterSpacing: .5 }}>PROCHAIN MATCH</div>
            <div style={{ background: "#0d1a0d", border: `1.5px solid ${G.green}22`, borderRadius: 14, padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>
                  <div style={{ fontFamily: G.font, fontSize: 15, color: G.text }}>{next.opponentName.replace("⚽ ","")}</div>
                  <div style={{ fontSize: 11, color: G.sub }}>
                    {next.homeAway === "home" ? "🏟 Domicile" : "✈️ Extérieur"} · Semaine {next.week}
                    {next.type === "cup" ? " · ⚽ COUPE" : " · 📋 Championnat"}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: G.font, fontSize: 22, color: G.gold }}>{next.opponentRating}</div>
                  <div style={{ fontSize: 10, color: G.sub }}>Force adv.</div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: G.sub, marginBottom: 12 }}>
                <span>Ton équipe : <strong style={{ color: myRating >= next.opponentRating ? G.green : myRating >= next.opponentRating - 10 ? G.gold : G.red }}>{myRating}</strong></span>
                <span>{myRating >= next.opponentRating ? "Favori 💪" : myRating >= next.opponentRating - 8 ? "Match équilibré ⚖️" : "Outsider 😤"}</span>
              </div>
              <button onClick={handlePlayNext}
                style={{ width: "100%", padding: 13, borderRadius: 12, border: "none", background: `linear-gradient(135deg,${G.gold},${G.goldDark})`, color: "#1a0a00", fontFamily: G.font, fontSize: 16, letterSpacing: 1, cursor: "pointer" }}>
                JOUER LE MATCH ⚽
              </button>
            </div>
          </div>
        )}

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {[
            { label: "Classement", value: myPos ? `${myPos}e/${state.table.length}` : "—", color: myPos <= 2 ? G.green : myPos >= 7 ? G.red : G.gold },
            { label: "Matchs joués", value: `${played}/${state.fixtures.length}`, color: G.text },
            { label: "Points", value: myRow ? String(myRow.pts) : "0", color: G.gold },
          ].map(s => (
            <div key={s.label} style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
              <div style={{ fontFamily: G.font, fontSize: 22, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: G.sub, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Last result */}
        {lastPlayed && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: G.card, border: `1px solid ${G.border}`, borderRadius: 12 }}>
            <div style={{ fontSize: 20 }}>{won ? "✅" : drawn ? "🤝" : "❌"}</div>
            <div>
              <div style={{ fontSize: 12, color: G.sub }}>Dernier match</div>
              <div style={{ fontFamily: G.font, fontSize: 14, color: won ? G.green : drawn ? G.gold : G.red }}>
                {state.clubName} {lastPlayed.myGoals} — {lastPlayed.opponentGoals} {lastPlayed.opponentName.replace("⚽ ","")}
              </div>
            </div>
          </div>
        )}

        {/* Quick nav */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {[
            { label: "EFFECTIF", emoji: "👥", onClick: onOpenSquad },
            { label: "TRANSFERTS", emoji: "💰", onClick: onOpenTransfer },
            { label: "CLASSEMENT", emoji: "📊", onClick: onOpenTable },
          ].map(btn => (
            <button key={btn.label} onClick={btn.onClick}
              style={{ padding: "14px 8px", borderRadius: 12, border: `1px solid ${G.border}`, background: G.card, color: G.text, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 22 }}>{btn.emoji}</span>
              <span style={{ fontFamily: G.font, fontSize: 11, color: G.sub, letterSpacing: .5 }}>{btn.label}</span>
            </button>
          ))}
        </div>

        {/* Upcoming fixtures */}
        {!isSeasonEnd && (
          <div>
            <div style={{ fontFamily: G.font, fontSize: 13, color: G.sub, marginBottom: 8, letterSpacing: .5 }}>CALENDRIER</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {state.fixtures.slice(0, 8).map(f => (
                <div key={f.uid} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: G.card, borderRadius: 10, opacity: f.played ? .5 : 1 }}>
                  <div style={{ fontSize: 11, color: G.sub, width: 20, textAlign: "center" }}>S{f.week}</div>
                  <div style={{ fontSize: 11, color: f.type === "cup" ? "#FFD700" : G.sub }}>{f.type === "cup" ? "⚽ CUP" : "📋"}</div>
                  <div style={{ flex: 1, fontSize: 12, color: G.text }}>{f.opponentName.replace("⚽ ","")}</div>
                  {f.played ? (
                    <div style={{ fontSize: 12, fontFamily: G.font, color: (f.myGoals??0)>(f.opponentGoals??0)?G.green:(f.myGoals??0)===(f.opponentGoals??0)?G.gold:G.red }}>
                      {f.myGoals}—{f.opponentGoals}
                    </div>
                  ) : (
                    <div style={{ fontSize: 10, color: G.sub }}>{f.homeAway === "home" ? "DOM" : "EXT"}</div>
                  )}
                </div>
              ))}
              {state.fixtures.length > 8 && (
                <div style={{ fontSize: 11, color: G.sub, textAlign: "center" }}>+ {state.fixtures.length - 8} autres matchs</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
