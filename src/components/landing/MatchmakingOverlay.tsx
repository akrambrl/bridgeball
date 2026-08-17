import { useEffect, useRef, useState } from "react";
import type { GameMode } from "@/pages/Home";
import { tr } from "@/lib/lang";
import { avatarFor, pickOpponent } from "@/lib/opponents";
import { G, posterText, posterTitre, retourStyle } from "@/lib/charte.jsx";

// Ré-exportés pour les consommateurs existants (Home.tsx pour le mode VS BOT,
// qui saute le matchmaking mais veut un adversaire du même pool).
export { avatarFor, pickOpponent };

type Props = {
  game: Extract<GameMode, "pont" | "chaine">;
  onFound: (opponent: {
    pseudo: string;
    country: string;
    avatar: string;
  }) => void;
  onCancel: () => void;
};

const GAME_LABEL: Record<Props["game"], string> = {
  pont: "THE PLUG",
  chaine: "THE MERCATO",
};

function getStoredPseudo(): string {
  if (typeof window === "undefined") return tr("Toi", "You", "Du", "Tu", "Você","Tú");
  try {
    return (
      localStorage.getItem("bb_pseudo") ||
      localStorage.getItem("bb_name") ||
      tr("Toi", "You", "Du", "Tu", "Você","Tú")
    );
  } catch {
    return tr("Toi", "You", "Du", "Tu", "Você","Tú");
  }
}

const PlayerCard = ({
  pseudo,
  country,
  ringColor,
  avatar,
  revealed = true,
  isPhoto = false,
}: {
  pseudo: string;
  country?: string;
  ringColor: string;
  avatar?: string;
  revealed?: boolean;
  /** Photo de profil de l'utilisateur : cadrage centré et repli si elle ne charge pas. */
  isPhoto?: boolean;
}) => {
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        {/* Cadre d'encre et ombre dure, à la place du halo flouté et du liseré
            lumineux : la couleur du camp reste, portée par l'aplat de fond. */}
        <div
          className="relative h-28 w-28 lg:h-32 lg:w-32 overflow-hidden flex items-center justify-center"
          style={{
            background: ringColor,
            borderRadius: G.rayon,
            border: G.trait,
            boxShadow: G.ombreL,
          }}
        >
          {revealed && avatar ? (
            <img
              src={avatar}
              alt=""
              onError={isPhoto ? (e) => { e.currentTarget.src = avatarFor(pseudo); } : undefined}
              className={"w-full h-full object-cover " + (isPhoto ? "object-center" : "object-top")}
            />
          ) : (
            <span
              style={{ ...posterText(1, revealed ? G.white : "rgba(255,255,255,.6)", 0), fontSize:58 }}
            >
              {revealed ? pseudo.charAt(0).toUpperCase() : "?"}
            </span>
          )}
        </div>
      </div>
      <div
        className={"mt-4 text-center min-h-[2.5rem] transition-opacity " + (revealed ? "opacity-100" : "opacity-45")}
        style={{ ...posterText(1, G.white, 0), fontSize:32 }}
      >
        {revealed ? pseudo : "?????"}
      </div>
      {revealed && country && <div className="text-2xl mt-1">{country}</div>}
    </div>
  );
};

export const MatchmakingOverlay = ({ game, onFound, onCancel }: Props) => {
  const [phase, setPhase] = useState<"searching" | "found">("searching");
  const [dots, setDots] = useState(1);
  const opponentRef = useRef(pickOpponent());
  const myPseudoRef = useRef(getStoredPseudo());
  // Visuel GOAT FC dérivé du pseudo. Il lisait avant `bb_avatar_url`, la photo
  // téléversée : cette clé n'est plus jamais écrite, la photo de profil étant
  // devenue la carte de niveau, que cet écran de recherche n'a pas à charger.
  const myAvatarRef = useRef(avatarFor(myPseudoRef.current));

  useEffect(() => {
    if (phase !== "searching") return;
    const id = setInterval(() => setDots((d) => (d % 3) + 1), 400);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== "searching") return;
    const dur = 2500 + Math.floor(Math.random() * 2000);
    const t = setTimeout(() => setPhase("found"), dur);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "found") return;
    const t = setTimeout(() => onFound(opponentRef.current), 2200);
    return () => clearTimeout(t);
  }, [phase, onFound]);

  const opp = opponentRef.current;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center"
      style={{ background:"rgba(8,17,9,.95)" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at center, rgba(42,111,191,.28) 0%, transparent 55%)",
        }}
        aria-hidden
      />

      <button
        onClick={onCancel}
        className="absolute top-4 right-4"
        style={{ ...retourStyle, width:"auto", padding:"9px 16px", fontSize:15, letterSpacing:1.5 }}
      >
        {tr("ANNULER", "CANCEL", "ABBRECHEN", "ANNULLA", "CANCELAR","CANCELAR")}
      </button>

      <div className="relative text-center mb-8">
        <div className="mb-2" style={{ ...posterText(1, G.ciel, 0), fontSize:15, letterSpacing:6 }}>
          {tr("MODE EN LIGNE", "ONLINE MODE", "ONLINE-MODUS", "MODALITÀ ONLINE", "MODO ONLINE","MODO EN LÍNEA")}
        </div>
        <div style={{ ...posterTitre(56, G.white), fontSize:"clamp(34px,6vw,56px)" }}>
          {GAME_LABEL[game]}
        </div>
      </div>

      <div className="relative flex items-center gap-6 lg:gap-16 mb-10">
        <PlayerCard
          pseudo={myPseudoRef.current}
          ringColor={G.pelouse}
          avatar={myAvatarRef.current}
          isPhoto={!!myPhotoRef.current}
        />

        <div className="flex flex-col items-center">
          <div
            style={{ ...posterText(52, phase === "found" ? G.projecteur : "rgba(255,255,255,.35)"),
              fontSize:"clamp(32px,6vw,52px)", letterSpacing:6 }}
          >
            VS
          </div>
          {phase === "found" && (
            <div className="mt-2 animate-in fade-in duration-300"
              style={{ ...posterText(1, G.pelouse, 0), fontSize:13, letterSpacing:4 }}>
              {tr("✓ TROUVÉ", "✓ FOUND", "✓ GEFUNDEN", "✓ TROVATO", "✓ ENCONTRADO","✓ ENCONTRADO")}
            </div>
          )}
        </div>

        <PlayerCard
          pseudo={opp.pseudo}
          country={opp.country}
          ringColor={G.ciel}
          avatar={opp.avatar}
          revealed={phase === "found"}
        />
      </div>

      <div className="relative text-center min-h-[80px]">
        {phase === "searching" ? (
          <div>
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="h-3 w-3 goat-blink" style={{ borderRadius:"50%", background:G.ciel, border:"1.5px solid "+G.encre }} />
              <div
                className="h-3 w-3 goat-blink"
                style={{ borderRadius:"50%", background:G.ciel, border:"1.5px solid "+G.encre, animationDelay: "0.3s" }}
              />
              <div
                className="h-3 w-3 goat-blink"
                style={{ borderRadius:"50%", background:G.ciel, border:"1.5px solid "+G.encre, animationDelay: "0.6s" }}
              />
            </div>
            <div style={{ ...posterText(1, G.white, 0), fontSize:32, letterSpacing:2 }}>
              {tr("RECHERCHE D'UN ADVERSAIRE", "FINDING AN OPPONENT", "SUCHE NACH GEGNER", "RICERCA AVVERSARIO", "PROCURANDO ADVERSÁRIO","BUSCANDO RIVAL")}
              <span className="inline-block w-12 text-left">
                {".".repeat(dots)}
              </span>
            </div>
            <div className="text-sm text-white/40 mt-3">
              {tr("Tri par niveau et région...", "Sorting by level and region...", "Sortierung nach Level und Region...", "Ordinamento per livello e regione...", "Ordenando por nível e região...","Ordenando por nivel y región...")}
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in duration-300">
            <div style={{ ...posterText(1, G.pelouse, 0), fontSize:32, letterSpacing:2 }}>
              {tr("MATCH PRÊT", "MATCH READY", "MATCH BEREIT", "MATCH PRONTO", "PARTIDA PRONTA","PARTIDA LISTA")}
            </div>
            <div className="text-sm text-white/50 mt-2">
              {tr("La partie va commencer...", "The game is about to start...", "Das Spiel startet gleich...", "La partita sta per iniziare...", "O jogo vai começar...","La partida está a punto de empezar...")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
