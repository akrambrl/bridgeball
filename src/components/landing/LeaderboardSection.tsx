import { Button } from "@/components/ui/button";

type Props = { onPlay: () => void };

// Placeholder : sera remplacé par un vrai fetch live du leaderboard Supabase
const MOCK_TOP = [
  { rank: 1, name: "EagleEye", score: 12850, badge: "GOAT" },
  { rank: 2, name: "TransferKing", score: 11420, badge: "Légende" },
  { rank: 3, name: "MercatoMaster", score: 10780, badge: "Pro" },
  { rank: 4, name: "BridgeBuilder", score: 9650, badge: "Pro" },
  { rank: 5, name: "FootGuru", score: 8990, badge: "Confirmé" },
];

export const LeaderboardSection = ({ onPlay }: Props) => {
  return (
    <section
      id="classements"
      className="py-20 md:py-28 bg-gradient-to-br from-[#0F2E18] to-[#1E5C2A] text-white"
    >
      <div className="container max-w-5xl">
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 rounded-full bg-[#00E676]/15 text-[#00E676] text-xs font-bold uppercase tracking-wider mb-3">
            Hall of Fame
          </span>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            Les GOAT du mois
          </h2>
          <p className="mt-4 text-lg text-white/70">
            Le classement se réinitialise chaque mois. Nouvelle saison, nouvelle
            chance de finir en tête.
          </p>
        </div>

        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-2 md:p-6">
          <ul className="divide-y divide-white/10">
            {MOCK_TOP.map((p) => (
              <li
                key={p.rank}
                className="flex items-center gap-4 py-4 px-3 md:px-4"
              >
                <div
                  className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center font-bold ${
                    p.rank === 1
                      ? "bg-[#FFD700] text-black"
                      : p.rank === 2
                      ? "bg-[#C0C0C0] text-black"
                      : p.rank === 3
                      ? "bg-[#CD7F32] text-black"
                      : "bg-white/10 text-white"
                  }`}
                >
                  {p.rank}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{p.name}</p>
                  <p className="text-xs text-white/60">{p.badge}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold tabular-nums">
                    {p.score.toLocaleString("fr-FR")}
                  </p>
                  <p className="text-xs text-white/60">pts</p>
                </div>
              </li>
            ))}
          </ul>

          <p className="text-center text-xs text-white/40 pt-4 pb-2">
            * Aperçu — le classement live sera branché sur Supabase
          </p>
        </div>

        <div className="mt-10 text-center">
          <Button
            onClick={onPlay}
            size="lg"
            className="bg-[#00E676] hover:bg-[#00C966] text-[#0F2E18] font-bold h-12 px-8"
          >
            Tenter ma place
          </Button>
        </div>
      </div>
    </section>
  );
};
