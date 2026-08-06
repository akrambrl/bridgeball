import { useEffect, useState } from "react";
import type { GameMode } from "@/pages/Home";
import { tr } from "@/lib/lang";
import {
  fetchTopPlayers,
  getCurrentSeason,
  getGrade,
  countryToFlag,
  type LbMode,
  type TopPlayer,
} from "@/lib/leaderboard";
// Carte de niveau : même photo de profil que sur mobile.
import { levelCard } from "@/lib/collection";

type Props = { onPlay: (game?: GameMode) => void };

// Habillage des 3 premiers, repris du classement mobile : dégradé or / argent /
// bronze et texte sombre par-dessus. Au-delà, carte verte translucide.
const PODIUM = [
  { bg: "linear-gradient(135deg,#FFD600,#FF6B35)", border: "rgba(255,214,0,.6)",   shadow: "0 4px 18px rgba(255,107,53,.35)",  rank: "#FFD600", medal: "🥇" },
  { bg: "linear-gradient(135deg,#E8E8E8,#A8A8B0)", border: "rgba(200,200,210,.6)", shadow: "0 4px 18px rgba(200,200,210,.25)", rank: "#C0C0C0", medal: "🥈" },
  { bg: "linear-gradient(135deg,#E3A869,#8B5A2B)", border: "rgba(205,127,50,.6)",  shadow: "0 4px 18px rgba(205,127,50,.3)",   rank: "#CD7F32", medal: "🥉" },
];
const DARK_INK = "#1a0d00"; // texte posé sur les dégradés du podium

export const LeaderboardView = ({ onPlay }: Props) => {
  // Même défaut que le mobile : l'onglet ouvert est "global" (XP cumulée).
  const [mode, setMode] = useState<LbMode>("global");
  const [rows, setRows] = useState<TopPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchTopPlayers(10, mode)
      .then((r) => { if (alive) { setRows(r); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [mode]);

  const season = getCurrentSeason();
  const msLeft = season.end.getTime() - Date.now();
  const daysLeft = Math.max(0, Math.floor(msLeft / 86400000));
  const hoursLeft = Math.max(0, Math.floor((msLeft % 86400000) / 3600000));

  return (
    <div className="container max-w-2xl mx-auto px-6 lg:px-10 py-10">
      <div className="text-center mb-6">
        <span className="inline-block px-3 py-1 rounded-full bg-[#FFC93C]/10 text-[#FFC93C] font-display text-xs tracking-[0.3em] mb-3">
          {tr("PALMARÈS", "HONOURS", "BESTENLISTE", "ALBO D'ORO", "PALMARÉS")}
        </span>
        <h2 className="font-display text-5xl md:text-6xl tracking-wide leading-none">
          {tr("CLASSEMENT", "LEADERBOARD", "RANGLISTE", "CLASSIFICA", "CLASSIFICAÇÃO")}
        </h2>
        <p className="mt-3 text-white/55 text-sm">
          {mode === "saison"
            ? tr("XP gagnée ce mois-ci. Le classement de la saison se réinitialise chaque mois.", "XP earned this month. The season leaderboard resets every month.", "Diesen Monat gesammelte XP. Die Saison-Rangliste wird jeden Monat zurückgesetzt.", "XP guadagnati questo mese. La classifica stagionale si azzera ogni mese.", "XP ganho este mês. O ranking da temporada reinicia todo mês.")
            : tr("XP cumulée depuis le début. Le même classement que dans l'app mobile.", "Total XP since day one. The same leaderboard as in the mobile app.", "Gesamte XP seit dem ersten Tag. Dieselbe Rangliste wie in der Mobile-App.", "XP totali dall'inizio. La stessa classifica dell'app mobile.", "XP acumulado desde o início. O mesmo ranking do app mobile.")}
        </p>
      </div>

      {/* Bandeau saison — comme sur mobile : mois en cours + compte à rebours */}
      <div className="flex items-center justify-between gap-4 mb-4 px-4 py-3 rounded-2xl bg-[#FFD600]/[0.08] border border-[#FFD600]/20">
        <div>
          <div className="font-display text-xs tracking-[0.15em] text-[#FFD600]">
            🏆 {season.monthLabel.toUpperCase()}
          </div>
          <div className="text-[11px] text-white/40 mt-0.5">
            {daysLeft > 0
              ? tr(`J-${daysLeft} (${hoursLeft}h)`, `${daysLeft}d (${hoursLeft}h) left`, `${daysLeft}T (${hoursLeft}h)`, `${daysLeft}g (${hoursLeft}h)`, `${daysLeft}d (${hoursLeft}h)`)
              : tr(`Finit dans ${hoursLeft}h`, `Ends in ${hoursLeft}h`, `Endet in ${hoursLeft}h`, `Finisce tra ${hoursLeft}h`, `Termina em ${hoursLeft}h`)}
          </div>
        </div>
        <div className="font-display text-xs tracking-widest text-white/35">
          {tr("SAISON", "SEASON", "SAISON", "STAGIONE", "TEMPORADA")} {season.num}
        </div>
      </div>

      {/* Mêmes onglets que le mobile */}
      <div className="flex gap-2 mb-4">
        {(["saison", "global"] as LbMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={
              "flex-1 py-2.5 rounded-xl border-[1.5px] font-display text-sm tracking-widest transition-colors " +
              (m === mode
                ? "border-[#00E676] bg-[#00E676]/10 text-[#00E676]"
                : "border-white/12 text-white/70 hover:border-white/30 hover:text-white")
            }
          >
            {m === "saison"
              ? "⭐ " + tr("SAISON", "SEASON", "SAISON", "STAGIONE", "TEMPORADA")
              : "🌍 GLOBAL"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-14 text-center text-white/35 text-sm">
          {tr("Chargement…", "Loading…", "Laden…", "Caricamento…", "Carregando…")}
        </div>
      ) : rows.length === 0 ? (
        <div className="py-14 text-center text-white/30 text-sm">
          {tr("Aucun score pour le moment", "No scores yet", "Noch keine Scores", "Ancora nessun punteggio", "Ainda sem pontuações")}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {rows.map((p, i) => {
            const podium = i < 3 ? PODIUM[i] : null;
            const grade = getGrade(p.xp);
            const flag = countryToFlag(p.country);
            return (
              <div
                key={p.pid}
                className="rounded-2xl overflow-hidden"
                style={{
                  background: podium ? podium.bg : "rgba(0,230,118,.18)",
                  border: "1px solid " + (podium ? podium.border : "rgba(0,230,118,.35)"),
                  boxShadow: podium ? podium.shadow : undefined,
                }}
              >
                <div className="flex items-center gap-3 px-3 py-3">
                  <div
                    className="w-9 flex-shrink-0 text-center font-display text-2xl leading-none"
                    style={{ color: podium ? podium.rank : "rgba(255,255,255,.3)" }}
                  >
                    {podium ? podium.medal : p.rank}
                  </div>

                  {/* Photo de profil = carte du niveau du joueur, comme sur mobile.
                      Cadre au format de la carte (3:4) et non rond : un cadrage
                      circulaire amputerait le haut et le bas de l'illustration. */}
                  <div
                    className="relative flex-shrink-0 h-12 w-9 rounded-md overflow-hidden"
                    style={{
                      background: "#000",
                      border: podium ? "2px solid rgba(0,0,0,.3)" : "1.5px solid rgba(255,255,255,.28)",
                    }}
                  >
                    <img
                      src={levelCard(p.xp ?? 0).img ?? undefined}
                      alt=""
                      className="h-full w-full object-cover"
                      style={{ objectPosition: "top" }}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="font-display text-lg tracking-wide truncate"
                        style={{ color: podium ? DARK_INK : "#fff" }}
                      >
                        {flag && <span className="mr-1.5 text-[15px]">{flag}</span>}
                        {p.name}
                      </span>
                      <span
                        className="text-[11px] font-bold rounded-full px-2 py-0.5 tracking-wide whitespace-nowrap"
                        style={{
                          color: podium ? DARK_INK : grade.color,
                          background: podium ? "rgba(26,13,0,.18)" : grade.color + "22",
                          border: podium ? "1px solid rgba(26,13,0,.25)" : "none",
                        }}
                      >
                        {grade.emoji} {grade.label}
                      </span>
                    </div>
                  </div>

                  <div
                    className="flex-shrink-0 font-display text-2xl tabular-nums"
                    style={{ color: podium ? DARK_INK : "#fff" }}
                  >
                    {p.score.toLocaleString("fr-FR")}
                    <span
                      className="text-xs ml-1"
                      style={{ color: podium ? "rgba(26,13,0,.7)" : "rgba(255,255,255,.3)" }}
                    >
                      XP
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
