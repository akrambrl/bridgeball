import { useEffect, useState } from "react";
import type { GameMode } from "@/pages/Home";
import { tr } from "@/lib/lang";
import { fetchTopPlayers, type TopPlayer } from "@/lib/leaderboard";

type Props = { onPlay: (game?: GameMode) => void };

export const LeaderboardView = ({ onPlay }: Props) => {
  const [rows, setRows] = useState<TopPlayer[]>([]);

  useEffect(() => {
    fetchTopPlayers(10).then(setRows).catch(() => {});
  }, []);

  return (
    <div className="container max-w-3xl mx-auto px-6 lg:px-10 py-10">
      <div className="text-center mb-8">
        <span className="inline-block px-3 py-1 rounded-full bg-[#FFC93C]/10 text-[#FFC93C] font-display text-xs tracking-[0.3em] mb-3">
          {tr("PALMARÈS", "HONOURS", "BESTENLISTE", "ALBO D'ORO", "PALMARÉS")}
        </span>
        <h2 className="font-display text-6xl md:text-7xl tracking-wide leading-none">
          {tr("LES GOAT DU MOIS", "GOATS OF THE MONTH", "GOATS DES MONATS", "I GOAT DEL MESE", "OS GOATS DO MÊS")}
        </h2>
        <p className="mt-3 text-white/60">
          {tr("Le classement se réinitialise chaque mois. Nouvelle saison, nouvelle chance de finir en tête.", "The leaderboard resets every month. New season, new chance to finish on top.", "Die Rangliste wird jeden Monat zurückgesetzt. Neue Saison, neue Chance auf Platz eins.", "La classifica si azzera ogni mese. Nuova stagione, nuova occasione per finire in testa.", "O ranking reinicia todo mês. Nova temporada, nova chance de terminar no topo.")}
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 md:p-5">
        <ul className="divide-y divide-white/10">
          {rows.length === 0 ? (
            <li className="py-6 text-center text-white/40 text-sm">{tr("Chargement…", "Loading…", "Laden…", "Caricamento…", "Carregando…")}</li>
          ) : rows.map((p) => (
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
              </div>
              <div className="text-right">
                <p className="font-display text-2xl tabular-nums text-[#FFC93C] tracking-wider">
                  {p.score.toLocaleString("fr-FR")}
                </p>
                <p className="font-display text-xs text-white/40 tracking-widest">
                  {tr("PTS", "PTS", "PKT", "PT", "PTS")}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 text-center">
        <button
          onClick={() => onPlay("pont")}
          className="inline-flex items-center gap-2 px-10 py-4 rounded-2xl bg-gradient-to-r from-[#FF8A2A] to-[#FFC93C] text-[#1A0F00] font-display text-2xl tracking-widest shadow-[0_10px_40px_-5px_rgba(255,201,60,0.5)] hover:scale-[1.03] transition-transform"
        >
          ▶ {tr("TENTER MA PLACE", "GO FOR MY SPOT", "UM MEINEN PLATZ KÄMPFEN", "TENTA IL TUO POSTO", "IR ATRÁS DO MEU LUGAR")}
        </button>
      </div>
    </div>
  );
};
