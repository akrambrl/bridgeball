import { useEffect, useState } from "react";
import type { GameMode } from "@/pages/Home";
import { tr } from "@/lib/lang";
import { fetchTopPlayers, type LbMode, type TopPlayer } from "@/lib/leaderboard";

type Props = { onPlay: (game?: GameMode) => void };

export const LeaderboardView = ({ onPlay }: Props) => {
  // Même défaut que le mobile : l'onglet ouvert est "global" (XP cumulée).
  const [mode, setMode] = useState<LbMode>("global");
  const [rows, setRows] = useState<TopPlayer[]>([]);

  useEffect(() => {
    let alive = true;
    setRows([]);
    fetchTopPlayers(10, mode)
      .then((r) => { if (alive) setRows(r); })
      .catch(() => {});
    return () => { alive = false; };
  }, [mode]);

  return (
    <div className="container max-w-3xl mx-auto px-6 lg:px-10 py-10">
      <div className="text-center mb-8">
        <span className="inline-block px-3 py-1 rounded-full bg-[#FFC93C]/10 text-[#FFC93C] font-display text-xs tracking-[0.3em] mb-3">
          {tr("PALMARÈS", "HONOURS", "BESTENLISTE", "ALBO D'ORO", "PALMARÉS")}
        </span>
        <h2 className="font-display text-6xl md:text-7xl tracking-wide leading-none">
          {mode === "saison"
            ? tr("LES GOAT DU MOIS", "GOATS OF THE MONTH", "GOATS DES MONATS", "I GOAT DEL MESE", "OS GOATS DO MÊS")
            : tr("LES GOAT DE TOUS LES TEMPS", "ALL-TIME GOATS", "GOATS ALLER ZEITEN", "I GOAT DI SEMPRE", "OS GOATS DE TODOS OS TEMPOS")}
        </h2>
        <p className="mt-3 text-white/60">
          {mode === "saison"
            ? tr("XP gagnée ce mois-ci. Le classement de la saison se réinitialise chaque mois : nouvelle chance de finir en tête.", "XP earned this month. The season leaderboard resets every month: a new chance to finish on top.", "Diesen Monat gesammelte XP. Die Saison-Rangliste wird jeden Monat zurückgesetzt: neue Chance auf Platz eins.", "XP guadagnati questo mese. La classifica stagionale si azzera ogni mese: nuova occasione per finire in testa.", "XP ganho este mês. O ranking da temporada reinicia todo mês: nova chance de terminar no topo.")
            : tr("XP cumulée depuis le début. Exactement le même classement que dans l'app mobile.", "Total XP since day one. Exactly the same leaderboard as in the mobile app.", "Gesamte XP seit dem ersten Tag. Genau dieselbe Rangliste wie in der Mobile-App.", "XP totali dall'inizio. Esattamente la stessa classifica dell'app mobile.", "XP acumulado desde o início. Exatamente o mesmo ranking do app mobile.")}
        </p>
      </div>

      {/* Mêmes onglets que le mobile : Global (XP cumulée) / Saison (XP du mois) */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {(["global", "saison"] as LbMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={
              "px-6 py-2.5 rounded-full font-display text-base tracking-widest border-2 transition-all " +
              (m === mode
                ? "border-[#FFC93C] text-[#FFC93C] bg-[#FFC93C]/5"
                : "border-white/15 text-white/70 hover:text-white hover:border-white/30")
            }
          >
            {m === "global"
              ? tr("GLOBAL", "GLOBAL", "GLOBAL", "GLOBALE", "GLOBAL")
              : tr("SAISON", "SEASON", "SAISON", "STAGIONE", "TEMPORADA")}
          </button>
        ))}
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
                  XP
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
