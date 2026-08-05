import type { GameMode } from "@/pages/Home";
import { tr } from "@/lib/lang";

// "bot" a disparu du choix : il menait au MÊME adversaire simulé que "online",
// à l'animation de recherche près. Deux entrées pour une seule partie, dont une
// qui promettait « un joueur au hasard sur le web ».
export type PlayMode = "solo" | "online" | "multi";

type Props = {
  game: Extract<GameMode, "pont" | "chaine">;
  onPick: (mode: PlayMode) => void;
  onClose: () => void;
};

// Palette et structure reprises telles quelles du lanceur GOAT Duel (LePont) :
// visuel plein cadre, pastille de format, puis une section par façon de jouer.
const ORANGE = "#FF8A2A";
const ORANGE_2 = "#FFC93C";
const BLUE = "#3DA5FF";
const GREEN = "#00E676";

const GAMES: Record<Props["game"], { label: string; img: string; pills: () => string[] }> = {
  chaine: {
    label: "THE MERCATO",
    img: "/mercato-card.png",
    pills: () => [
      "⏱ 90 S",
      "🔁 " + tr("CHAÎNE SANS FIN", "ENDLESS CHAIN", "ENDLOSE KETTE", "CATENA INFINITA", "CORRENTE SEM FIM"),
      "🎯 " + tr("3 NIVEAUX", "3 LEVELS", "3 STUFEN", "3 LIVELLI", "3 NÍVEIS"),
    ],
  },
  pont: {
    label: "THE PLUG",
    img: "/plug-card.png",
    pills: () => [
      "⏱ 90 S",
      "🔗 " + tr("2 CLUBS", "2 CLUBS", "2 KLUBS", "2 CLUB", "2 CLUBES"),
      "🎯 " + tr("3 NIVEAUX", "3 LEVELS", "3 STUFEN", "3 LIVELLI", "3 NÍVEIS"),
    ],
  },
};

const sectionLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 3,
  textTransform: "uppercase",
  color: "rgba(255,255,255,.45)",
  marginBottom: 8,
};

export const ModeChoiceModal = ({ game, onPick, onClose }: Props) => {
  const g = GAMES[game];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={g.label}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 11000,
        background: "linear-gradient(180deg,#0a1410 0%,#0E1F14 100%)",
        overflowY: "auto",
        fontFamily: "inherit",
        color: "#fff",
        animation: "modeFadeIn .3s ease-out",
      }}
    >
      <style>{`@keyframes modeFadeIn{from{opacity:0}to{opacity:1}}`}</style>

      <button
        onClick={onClose}
        aria-label={tr("Fermer", "Close", "Schließen", "Chiudi", "Fechar")}
        style={{
          position: "fixed", top: 14, right: 14, zIndex: 10, width: 38, height: 38,
          borderRadius: "50%", background: "rgba(0,0,0,.65)", color: "#fff",
          border: "1px solid rgba(255,255,255,.25)", fontSize: 22, fontWeight: 300,
          lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center",
          justifyContent: "center", backdropFilter: "blur(10px)",
          boxShadow: "0 4px 16px rgba(0,0,0,.5)",
        }}
      >
        ×
      </button>

      {/* Visuel du mode, entier (object-contain) — comme sur le lanceur du duel */}
      <div style={{ position: "relative", width: "100%", height: "48vh", maxHeight: 520, minHeight: 280, overflow: "hidden", background: "#000" }}>
        <img src={g.img} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none", userSelect: "none" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 50, background: "linear-gradient(to top,#0a1410 0%,transparent 100%)", pointerEvents: "none" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, padding: "14px 22px 40px", maxWidth: 480, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        {/* Pastille de format */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "10px 16px", background: ORANGE + "12", border: "1.5px solid " + ORANGE + "40", borderRadius: 12, marginBottom: 18, flexWrap: "wrap" }}>
          {g.pills().map((p, i) => (
            <span key={p} style={{ display: "contents" }}>
              {i > 0 && <span style={{ color: ORANGE, fontSize: 14, fontWeight: 800 }}>·</span>}
              <span style={{ color: ORANGE, fontSize: 13, fontWeight: 800, letterSpacing: .5 }}>
                {p.slice(0, 2)}
                <span style={{ color: "#fff" }}>{p.slice(2)}</span>
              </span>
            </span>
          ))}
        </div>

        {/* Solo */}
        <div style={sectionLabel}>{tr("Solo · score", "Solo · score", "Solo · Punkte", "Solo · punti", "Solo · pontos")}</div>
        <button
          onClick={() => onPick("solo")}
          style={{ width: "100%", padding: 15, marginBottom: 18, background: "linear-gradient(135deg," + ORANGE + "," + ORANGE_2 + ")", color: "#000", border: "none", borderRadius: 50, cursor: "pointer", fontFamily: "inherit", fontSize: 16, fontWeight: 800, letterSpacing: 1, boxShadow: "0 8px 24px " + ORANGE + "55", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          ▶ {tr("JOUER SOLO", "PLAY SOLO", "SOLO SPIELEN", "GIOCA SOLO", "JOGAR SOLO")}
          <span style={{ fontSize: 12, fontWeight: 700, opacity: .8 }}>
            · {tr("bats ton record", "beat your record", "schlag deinen Rekord", "batti il tuo record", "bata seu recorde")}
          </span>
        </button>

        {/* En ligne */}
        <div style={sectionLabel}>{tr("En ligne", "Online", "Online", "Online", "Online")}</div>
        <button
          onClick={() => onPick("online")}
          style={{ width: "100%", marginBottom: 18, padding: "14px 16px", borderRadius: 16, border: "1.5px solid rgba(61,165,255,.6)", background: "linear-gradient(135deg,rgba(61,165,255,.22),rgba(61,165,255,.08))", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textAlign: "left", color: "#fff", fontFamily: "inherit", boxShadow: "0 8px 24px -8px rgba(61,165,255,.5)" }}
        >
          <div style={{ fontSize: 26 }}>🌍</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: .5 }}>{tr("EN LIGNE", "ONLINE", "ONLINE", "ONLINE", "ONLINE")}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.55)", marginTop: 2 }}>
              {tr("Affronte un adversaire · sans code", "Face an opponent · no code", "Tritt gegen einen Gegner an · ohne Code", "Sfida un avversario · senza codice", "Enfrente um adversário · sem código")}
            </div>
          </div>
          <div style={{ fontSize: 18, color: BLUE }}>▶</div>
        </button>

        {/* Entre potes */}
        <div style={sectionLabel}>{tr("Entre potes", "With friends", "Mit Freunden", "Con gli amici", "Com amigos")}</div>
        <button
          onClick={() => onPick("multi")}
          style={{ width: "100%", padding: 14, background: "rgba(0,230,118,.14)", color: GREEN, border: "1px solid rgba(0,230,118,.4)", borderRadius: 14, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 800, letterSpacing: .5, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        >
          👥 {tr("Créer un salon", "Create room", "Raum erstellen", "Crea una stanza", "Criar sala")}
        </button>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)", textAlign: "center", marginTop: 8 }}>
          {tr("Tu as déjà un code ? Colle-le sur l'accueil.", "Got a code already? Paste it on the home page.", "Schon einen Code? Füg ihn auf der Startseite ein.", "Hai già un codice? Incollalo in home.", "Já tem um código? Cole na página inicial.")}
        </div>
      </div>
    </div>
  );
};
