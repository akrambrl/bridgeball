import type { GameMode } from "@/pages/Home";
import { tr } from "@/lib/lang";
import { G, posterText, posterLight, btn, fondCharte, terrainCharte, retourStyle } from "@/lib/charte.jsx";

// "bot" a disparu du choix : il menait au MÊME adversaire simulé que "online",
// à l'animation de recherche près. Deux entrées pour une seule partie, dont une
// qui promettait « un joueur au hasard sur le web ».
export type PlayMode = "solo" | "online" | "multi";

type Props = {
  game: Extract<GameMode, "pont" | "chaine">;
  onPick: (mode: PlayMode) => void;
  onClose: () => void;
};

// Palette et structure reprises du lanceur GOAT Duel (LePont), lui-même passé à
// la charte : visuel plein cadre, pastille de format, puis une section par façon
// de jouer. Les jetons remplacent l'ancienne palette orange / bleu / vert LED.

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
  ...posterText(1, G.projecteur, 0),
  fontSize: 13,
  letterSpacing: 3,
  textTransform: "uppercase",
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
        background: fondCharte,
        overflowY: "auto",
        fontFamily: "inherit",
        color: "#fff",
        animation: "modeFadeIn .3s ease-out",
      }}
    >
      <style>{`@keyframes modeFadeIn{from{opacity:0}to{opacity:1}}`}</style>
      {terrainCharte}

      <button
        onClick={onClose}
        aria-label={tr("Fermer", "Close", "Schließen", "Chiudi", "Fechar")}
        style={{ ...retourStyle, position: "fixed", top: 14, right: 14, zIndex: 10,
          fontSize: 24, fontWeight: 400 }}
      >
        ×
      </button>

      {/* Visuel du mode, entier (object-contain) — comme sur le lanceur du duel */}
      <div style={{ position: "relative", zIndex: 1, width: "100%", height: "48vh", maxHeight: 520, minHeight: 280, padding: "16px 0", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <img src={g.img} alt="" draggable={false} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", pointerEvents: "none", userSelect: "none", borderRadius: G.rayon, border: G.trait, boxShadow: G.ombreL }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, padding: "14px 22px 40px", maxWidth: 480, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        {/* Pastille de format */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "10px 16px", background: G.nuit, border: G.trait, borderRadius: G.rayonS, boxShadow: G.ombre, marginBottom: 18, flexWrap: "wrap" }}>
          {g.pills().map((p, i) => (
            <span key={p} style={{ display: "contents" }}>
              {i > 0 && <span style={{ color: G.projecteur, fontSize: 14, fontWeight: 800 }}>·</span>}
              <span style={{ ...posterText(1, G.projecteur, 0), fontSize: 15 }}>
                {p.slice(0, 2)}
                <span style={{ color: G.white }}>{p.slice(2)}</span>
              </span>
            </span>
          ))}
        </div>

        {/* Solo */}
        <div style={sectionLabel}>{tr("Solo · score", "Solo · score", "Solo · Punkte", "Solo · punti", "Solo · pontos")}</div>
        <button
          onClick={() => onPick("solo")}
          style={{ ...btn(G.projecteur, G.encre, 22), width: "100%", padding: 15, marginBottom: 18 }}
        >
          ▶ {tr("JOUER SOLO", "PLAY SOLO", "SOLO SPIELEN", "GIOCA SOLO", "JOGAR SOLO")}
          <span style={{ ...posterLight(14, G.encre), opacity: .75 }}>
            · {tr("bats ton record", "beat your record", "schlag deinen Rekord", "batti il tuo record", "bata seu recorde")}
          </span>
        </button>

        {/* En ligne */}
        <div style={sectionLabel}>{tr("En ligne", "Online", "Online", "Online", "Online")}</div>
        <button
          onClick={() => onPick("online")}
          style={{ width: "100%", marginBottom: 18, padding: "14px 16px", borderRadius: G.rayon, border: G.trait, background: G.ciel, boxShadow: G.ombre, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textAlign: "left", color: G.white, fontFamily: "inherit" }}
        >
          <div style={{ fontSize: 26 }}>🌍</div>
          <div style={{ flex: 1 }}>
            <div style={{ ...posterText(1, G.white, 0), fontSize: 20 }}>{tr("EN LIGNE", "ONLINE", "ONLINE", "ONLINE", "ONLINE")}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.8)", marginTop: 2 }}>
              {tr("Affronte un adversaire · sans code", "Face an opponent · no code", "Tritt gegen einen Gegner an · ohne Code", "Sfida un avversario · senza codice", "Enfrente um adversário · sem código")}
            </div>
          </div>
          <div style={{ fontSize: 18, color: G.white }}>▶</div>
        </button>

        {/* Entre potes */}
        <div style={sectionLabel}>{tr("Entre potes", "With friends", "Mit Freunden", "Con gli amici", "Com amigos")}</div>
        <button
          onClick={() => onPick("multi")}
          style={{ ...btn(G.pelouse, G.white, 18), width: "100%", padding: 14 }}
        >
          👥 {tr("Créer un salon", "Create room", "Raum erstellen", "Crea una stanza", "Criar sala")}
        </button>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,.55)", textAlign: "center", marginTop: 8 }}>
          {tr("Tu as déjà un code ? Colle-le sur l'accueil.", "Got a code already? Paste it on the home page.", "Schon einen Code? Füg ihn auf der Startseite ein.", "Hai già un codice? Incollalo in home.", "Já tem um código? Cole na página inicial.")}
        </div>
      </div>
    </div>
  );
};
