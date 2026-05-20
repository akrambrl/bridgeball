import type { GameMode } from "@/pages/Home";

type Props = { onPlay: (game?: GameMode) => void };

const MOCK = [
  { rank: 1, name: "EagleEye", score: 12850, badge: "GOAT" },
  { rank: 2, name: "TransferKing", score: 11420, badge: "Légende" },
  { rank: 3, name: "MercatoMaster", score: 10780, badge: "Pro" },
  { rank: 4, name: "BridgeBuilder", score: 9650, badge: "Pro" },
  { rank: 5, name: "FootGuru", score: 8990, badge: "Confirmé" },
  { rank: 6, name: "ZidaneFan10", score: 8420, badge: "Confirmé" },
  { rank: 7, name: "RonaldoSiu", score: 7980, badge: "Confirmé" },
  { rank: 8, name: "PetitPont", score: 7510, badge: "Amateur+" },
  { rank: 9, name: "Cantona7", score: 7220, badge: "Amateur+" },
  { rank: 10, name: "LeMercatoGuy", score: 6890, badge: "Amateur+" },
];

export const LeaderboardView = ({ onPlay }: Props) => {
  return (
    <div className="container max-w-3xl mx-auto px-6 lg:px-10 py-10">
      <div className="text-center mb-8">
        <span className="inline-block px-3 py-1 rounded-full bg-[#FFC93C]/10 text-[#FFC93C] font-display text-xs tracking-[0.3em] mb-3">
          PALMARÈS
        </span>
        <h2 className="font-display text-6xl md:text-7xl tracking-wide leading-none">
          LES GOAT DU MOIS
        </h2>
        <p className="mt-3 text-white/60">
          Le classement se réinitialise chaque mois. Nouvelle saison, nouvelle
          chance de finir en tête.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 md:p-5">
        <ul className="divide-y divide-white/10">
          {MOCK.map((p) => (
            <li
              key={p.rank}
              className="flex items-center gap-4 py-3.5 px-2 md:px-3"
            >
              <div
                className={
                  "flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center font-black " +
                  (p.rank === 1
                    ? "bg-[#FFD700] text-black"
                    : p.rank === 2
                    ? "bg-[#C0C0C0] text-black"
                    : p.rank === 3
                    ? "bg-[#CD7F32] text-black"
                    : "bg-white/10 text-white")
                }
              >
                {p.rank}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display text-xl tracking-wider truncate">{p.name}</p>
                <p className="text-xs text-white/50">{p.badge}</p>
              </div>
              <div className="text-right">
                <p className="font-display text-2xl tabular-nums text-[#FFC93C] tracking-wider">
                  {p.score.toLocaleString("fr-FR")}
                </p>
                <p className="font-display text-xs text-white/40 tracking-widest">
                  PTS
                </p>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-center text-[10px] text-white/30 pt-3 pb-1">
          * Aperçu — sera branché sur Supabase live
        </p>
      </div>

      <div className="mt-8 text-center">
        <button
          onClick={() => onPlay("pont")}
          className="inline-flex items-center gap-2 px-10 py-4 rounded-2xl bg-gradient-to-r from-[#FF8A2A] to-[#FFC93C] text-[#1A0F00] font-display text-2xl tracking-widest shadow-[0_10px_40px_-5px_rgba(255,201,60,0.5)] hover:scale-[1.03] transition-transform"
        >
          ▶ TENTER MA PLACE
        </button>
      </div>
    </div>
  );
};
