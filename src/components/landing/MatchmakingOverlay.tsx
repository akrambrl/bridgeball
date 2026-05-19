import { useEffect, useRef, useState } from "react";
import type { GameMode } from "@/pages/Home";

type Props = {
  game: Extract<GameMode, "pont" | "chaine">;
  onFound: (opponent: { pseudo: string; country: string }) => void;
  onCancel: () => void;
};

const GAME_LABEL: Record<Props["game"], string> = {
  pont: "THE PLUG",
  chaine: "THE MERCATO",
};

const POOL: { pseudo: string; country: string }[] = [
  { pseudo: "EagleEye_92", country: "🇫🇷" },
  { pseudo: "TransferKing", country: "🇪🇸" },
  { pseudo: "MercatoMaster", country: "🇮🇹" },
  { pseudo: "BridgeBuilder", country: "🇬🇧" },
  { pseudo: "FootGuru42", country: "🇧🇷" },
  { pseudo: "ZidaneFan10", country: "🇫🇷" },
  { pseudo: "RonaldoSiu", country: "🇵🇹" },
  { pseudo: "PetitPont", country: "🇫🇷" },
  { pseudo: "Cantona7", country: "🇫🇷" },
  { pseudo: "LeMercatoGuy", country: "🇫🇷" },
  { pseudo: "DiegoLover", country: "🇦🇷" },
  { pseudo: "OldTrafford_99", country: "🇬🇧" },
  { pseudo: "BernabeuKid", country: "🇪🇸" },
  { pseudo: "SanSiro_AC", country: "🇮🇹" },
  { pseudo: "AllianzWolf", country: "🇩🇪" },
  { pseudo: "ParcDesGOAT", country: "🇫🇷" },
  { pseudo: "VeloDromeFan", country: "🇫🇷" },
  { pseudo: "Bombonera_Boca", country: "🇦🇷" },
  { pseudo: "Maracana10", country: "🇧🇷" },
  { pseudo: "AnfieldRoad", country: "🇬🇧" },
  { pseudo: "PlugMaster_X", country: "🇧🇪" },
  { pseudo: "GoatHunter", country: "🇳🇱" },
  { pseudo: "ChainBreaker", country: "🇲🇦" },
  { pseudo: "Iniesta_8", country: "🇪🇸" },
  { pseudo: "Pirlo_21", country: "🇮🇹" },
  { pseudo: "Modric_LM10", country: "🇭🇷" },
];

function pickOpponent(): { pseudo: string; country: string } {
  return POOL[Math.floor(Math.random() * POOL.length)];
}

function getStoredPseudo(): string {
  if (typeof window === "undefined") return "Toi";
  try {
    return (
      localStorage.getItem("bb_pseudo") ||
      localStorage.getItem("bb_name") ||
      "Toi"
    );
  } catch {
    return "Toi";
  }
}

// Carte joueur : avatar + pseudo (avec option "révélation")
const PlayerCard = ({
  pseudo,
  country,
  color,
  revealed = true,
  side,
}: {
  pseudo: string;
  country?: string;
  color: string;
  revealed?: boolean;
  side: "left" | "right";
}) => {
  const initial = revealed ? pseudo.charAt(0).toUpperCase() : "?";
  return (
    <div className={"flex flex-col items-center " + (side === "left" ? "" : "")}>
      <div className="relative">
        <div
          className="absolute inset-0 rounded-full blur-3xl opacity-50"
          style={{ backgroundColor: color }}
        />
        <div
          className="relative h-28 w-28 lg:h-32 lg:w-32 rounded-full flex items-center justify-center font-display text-5xl lg:text-6xl text-white shadow-2xl"
          style={{
            background: `linear-gradient(135deg, ${color}, ${color}80)`,
            boxShadow: `0 0 40px ${color}40`,
          }}
        >
          {initial}
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
      {revealed && country && (
        <div className="text-2xl mt-1">{country}</div>
      )}
    </div>
  );
};

const START_FROM = 5;

export const MatchmakingOverlay = ({ game, onFound, onCancel }: Props) => {
  const [phase, setPhase] = useState<"searching" | "found">("searching");
  const [dots, setDots] = useState(1);
  const opponentRef = useRef(pickOpponent());
  const myPseudo = useRef(getStoredPseudo()).current;

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
        ANNULER
      </button>

      <div className="relative text-center mb-8">
        <div className="font-display text-xs lg:text-sm tracking-[0.4em] text-[#3DA5FF] mb-2">
          MODE EN LIGNE
        </div>
        <div className="font-display text-3xl lg:text-5xl tracking-wider text-white">
          {GAME_LABEL[game]}
        </div>
      </div>

      {/* Duel TOI vs ADVERSAIRE */}
      <div className="relative flex items-center gap-6 lg:gap-16 mb-10">
        <PlayerCard
          pseudo={myPseudo}
          color="#00E676"
          side="left"
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
              ✓ TROUVÉ
            </div>
          )}
        </div>

        <PlayerCard
          pseudo={opp.pseudo}
          country={opp.country}
          color="#3DA5FF"
          revealed={phase === "found"}
          side="right"
        />
      </div>

      {/* Status sous le duel */}
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
              RECHERCHE D'UN ADVERSAIRE
              <span className="inline-block w-12 text-left">
                {".".repeat(dots)}
              </span>
            </div>
            <div className="text-sm text-white/40 mt-3">
              Tri par niveau et région...
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in duration-300">
            <div className="font-display text-2xl lg:text-3xl tracking-widest text-[#00E676]">
              MATCH PRÊT
            </div>
            <div className="text-sm text-white/50 mt-2">
              La partie va commencer...
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
