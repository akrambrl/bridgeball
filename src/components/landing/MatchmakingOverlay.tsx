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

// Pseudos crédibles + drapeau pays (mock du matchmaking en ligne)
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

export const MatchmakingOverlay = ({ game, onFound, onCancel }: Props) => {
  const [phase, setPhase] = useState<"searching" | "found">("searching");
  const [dots, setDots] = useState(1);
  const opponentRef = useRef(pickOpponent());

  // Animation des points "..."
  useEffect(() => {
    if (phase !== "searching") return;
    const id = setInterval(() => setDots((d) => (d % 3) + 1), 400);
    return () => clearInterval(id);
  }, [phase]);

  // Phase searching : durée aléatoire entre 2.5s et 4.5s
  useEffect(() => {
    if (phase !== "searching") return;
    const dur = 2500 + Math.floor(Math.random() * 2000);
    const t = setTimeout(() => setPhase("found"), dur);
    return () => clearTimeout(t);
  }, [phase]);

  // Phase found : 1.6s puis on lance la partie
  useEffect(() => {
    if (phase !== "found") return;
    const t = setTimeout(() => onFound(opponentRef.current), 1800);
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

      <div className="relative text-center">
        <div className="font-display text-xs lg:text-sm tracking-[0.4em] text-[#3DA5FF] mb-2">
          MODE EN LIGNE
        </div>
        <div className="font-display text-3xl lg:text-5xl tracking-wider text-white mb-10">
          {GAME_LABEL[game]}
        </div>

        {phase === "searching" ? (
          <div>
            {/* Loader animé */}
            <div className="flex items-center justify-center gap-3 mb-8">
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
            <div className="font-display text-3xl lg:text-4xl tracking-widest text-white">
              RECHERCHE D'UN ADVERSAIRE
              <span className="inline-block w-12 text-left">
                {".".repeat(dots)}
              </span>
            </div>
            <div className="text-sm text-white/40 mt-4">
              Tri par niveau et région...
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in zoom-in duration-300">
            <div className="font-display text-base tracking-[0.3em] text-[#00E676] mb-6">
              ✓ ADVERSAIRE TROUVÉ
            </div>
            <div className="relative inline-block">
              <div
                className="absolute inset-0 rounded-full blur-3xl"
                style={{ background: "#3DA5FF60" }}
              />
              <div className="relative h-24 w-24 mx-auto rounded-full bg-gradient-to-br from-[#3DA5FF] to-[#1E5C2A] flex items-center justify-center font-display text-4xl text-white shadow-2xl mb-4">
                {opp.pseudo.charAt(0).toUpperCase()}
              </div>
            </div>
            <div className="font-display text-4xl lg:text-5xl tracking-wider text-white">
              {opp.pseudo}
            </div>
            <div className="text-2xl mt-2">{opp.country}</div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes goat-blink {
          0%, 100% { opacity: 0.3; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
};
