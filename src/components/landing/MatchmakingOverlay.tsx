import { useEffect, useRef, useState } from "react";
import type { GameMode } from "@/pages/Home";
import { tr } from "@/lib/lang";
import { avatarFor, pickOpponent } from "@/lib/opponents";

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
  if (typeof window === "undefined") return tr("Toi", "You", "Du", "Tu", "Você");
  try {
    return (
      localStorage.getItem("bb_pseudo") ||
      localStorage.getItem("bb_name") ||
      tr("Toi", "You", "Du", "Tu", "Você")
    );
  } catch {
    return tr("Toi", "You", "Du", "Tu", "Você");
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
        <div
          className="absolute inset-0 rounded-full blur-3xl opacity-50"
          style={{ backgroundColor: ringColor }}
        />
        <div
          className="relative h-28 w-28 lg:h-32 lg:w-32 rounded-full overflow-hidden flex items-center justify-center shadow-2xl"
          style={{
            background: `linear-gradient(135deg, ${ringColor}, #0F2017)`,
            boxShadow: `0 0 40px ${ringColor}55`,
            border: `3px solid ${ringColor}`,
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
              className="font-display text-5xl"
              style={{ color: revealed ? "#fff" : "rgba(255,255,255,0.5)" }}
            >
              {revealed ? pseudo.charAt(0).toUpperCase() : "?"}
            </span>
          )}
        </div>
      </div>
      <div
        className={
          "mt-4 font-display text-2xl lg:text-3xl tracking-wider text-center min-h-[2.5rem] transition-opacity " +
          (revealed ? "opacity-100 text-white" : "opacity-40 text-white/40")
        }
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
  // Photo de profil si le joueur en a une (même clé que le mobile), sinon
  // visuel GOAT FC dérivé du pseudo.
  const myPhotoRef = useRef<string | null>(
    typeof window === "undefined" ? null : (() => { try { return localStorage.getItem("bb_avatar_url"); } catch { return null; } })()
  );
  const myAvatarRef = useRef(myPhotoRef.current || avatarFor(myPseudoRef.current));

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
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md"
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-50"
        style={{
          background:
            "radial-gradient(circle at center, #3DA5FF40 0%, transparent 55%)",
        }}
        aria-hidden
      />

      <button
        onClick={onCancel}
        className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs font-display tracking-widest border border-white/10"
      >
        {tr("ANNULER", "CANCEL", "ABBRECHEN", "ANNULLA", "CANCELAR")}
      </button>

      <div className="relative text-center mb-8">
        <div className="font-display text-xs lg:text-sm tracking-[0.4em] text-[#3DA5FF] mb-2">
          {tr("MODE EN LIGNE", "ONLINE MODE", "ONLINE-MODUS", "MODALITÀ ONLINE", "MODO ONLINE")}
        </div>
        <div className="font-display text-3xl lg:text-5xl tracking-wider text-white">
          {GAME_LABEL[game]}
        </div>
      </div>

      <div className="relative flex items-center gap-6 lg:gap-16 mb-10">
        <PlayerCard
          pseudo={myPseudoRef.current}
          ringColor="#00E676"
          avatar={myAvatarRef.current}
          isPhoto={!!myPhotoRef.current}
        />

        <div className="flex flex-col items-center">
          <div
            className={
              "font-display text-3xl lg:text-5xl tracking-[0.25em] transition-colors " +
              (phase === "found" ? "text-[#FFC93C]" : "text-white/30")
            }
          >
            VS
          </div>
          {phase === "found" && (
            <div className="font-display text-[10px] tracking-[0.3em] text-[#00E676] mt-2 animate-in fade-in duration-300">
              {tr("✓ TROUVÉ", "✓ FOUND", "✓ GEFUNDEN", "✓ TROVATO", "✓ ENCONTRADO")}
            </div>
          )}
        </div>

        <PlayerCard
          pseudo={opp.pseudo}
          country={opp.country}
          ringColor="#3DA5FF"
          avatar={opp.avatar}
          revealed={phase === "found"}
        />
      </div>

      <div className="relative text-center min-h-[80px]">
        {phase === "searching" ? (
          <div>
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="h-3 w-3 rounded-full bg-[#3DA5FF] goat-blink" />
              <div
                className="h-3 w-3 rounded-full bg-[#3DA5FF] goat-blink"
                style={{ animationDelay: "0.3s" }}
              />
              <div
                className="h-3 w-3 rounded-full bg-[#3DA5FF] goat-blink"
                style={{ animationDelay: "0.6s" }}
              />
            </div>
            <div className="font-display text-2xl lg:text-3xl tracking-widest text-white">
              {tr("RECHERCHE D'UN ADVERSAIRE", "FINDING AN OPPONENT", "SUCHE NACH GEGNER", "RICERCA AVVERSARIO", "PROCURANDO ADVERSÁRIO")}
              <span className="inline-block w-12 text-left">
                {".".repeat(dots)}
              </span>
            </div>
            <div className="text-sm text-white/40 mt-3">
              {tr("Tri par niveau et région...", "Sorting by level and region...", "Sortierung nach Level und Region...", "Ordinamento per livello e regione...", "Ordenando por nível e região...")}
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in duration-300">
            <div className="font-display text-2xl lg:text-3xl tracking-widest text-[#00E676]">
              {tr("MATCH PRÊT", "MATCH READY", "MATCH BEREIT", "MATCH PRONTO", "PARTIDA PRONTA")}
            </div>
            <div className="text-sm text-white/50 mt-2">
              {tr("La partie va commencer...", "The game is about to start...", "Das Spiel startet gleich...", "La partita sta per iniziare...", "O jogo vai começar...")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
