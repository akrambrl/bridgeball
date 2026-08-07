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
import { G, posterText, posterTitre, posterLight, btn } from "@/lib/charte.jsx";

type Props = { onPlay: (game?: GameMode) => void };

// Habillage des 3 premiers, repris du classement mobile passé à la charte :
// APLATS francs cerclés d'encre, plus de dégradé métallique ni d'ombre portée
// diffuse. L'or devient le jaune projecteur, l'argent et le bronze deux teintes
// sourdes qui tiennent à côté d'un aplat.
const PODIUM = [
  { bg: G.projecteur, medal: "🥇" },
  { bg: "#C9CBC4",    medal: "🥈" },
  { bg: "#C08A4A",    medal: "🥉" },
];
const DARK_INK = G.encre; // texte posé sur les aplats clairs du podium

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
        <span className="inline-block px-3 py-1 mb-3"
          style={{ ...posterLight(15, G.encre), letterSpacing:3, background:G.projecteur,
            borderRadius:G.rayonS, border:G.traitFin, boxShadow:"2px 2px 0 "+G.encre }}>
          {tr("PALMARÈS", "HONOURS", "BESTENLISTE", "ALBO D'ORO", "PALMARÉS","PALMARÉS")}
        </span>
        <h2 style={{ ...posterTitre(72, G.white), fontSize:"clamp(48px,7vw,72px)" }}>
          {tr("CLASSEMENT", "LEADERBOARD", "RANGLISTE", "CLASSIFICA", "CLASSIFICAÇÃO","CLASIFICACIÓN")}
        </h2>
        <p className="mt-3 text-white/55 text-sm">
          {mode === "saison"
            ? tr("XP gagnée ce mois-ci. Le classement de la saison se réinitialise chaque mois.", "XP earned this month. The season leaderboard resets every month.", "Diesen Monat gesammelte XP. Die Saison-Rangliste wird jeden Monat zurückgesetzt.", "XP guadagnati questo mese. La classifica stagionale si azzera ogni mese.", "XP ganho este mês. O ranking da temporada reinicia todo mês.","XP conseguida este mes. La clasificación de temporada se reinicia cada mes.")
            : tr("XP cumulée depuis le début. Le même classement que dans l'app mobile.", "Total XP since day one. The same leaderboard as in the mobile app.", "Gesamte XP seit dem ersten Tag. Dieselbe Rangliste wie in der Mobile-App.", "XP totali dall'inizio. La stessa classifica dell'app mobile.", "XP acumulado desde o início. O mesmo ranking do app mobile.","XP acumulada desde el principio. La misma clasificación que en la app móvil.")}
        </p>
      </div>

      {/* Bandeau saison — comme sur mobile : mois en cours + compte à rebours */}
      <div className="flex items-center justify-between gap-4 mb-4 px-4 py-3"
        style={{ background:G.nuit, border:G.trait, borderRadius:G.rayon, boxShadow:G.ombre }}>
        <div>
          <div style={{ ...posterText(1, G.projecteur, 0), fontSize:16, letterSpacing:2 }}>
            🏆 {season.monthLabel.toUpperCase()}
          </div>
          <div className="text-[11px] text-white/40 mt-0.5">
            {daysLeft > 0
              ? tr(`J-${daysLeft} (${hoursLeft}h)`, `${daysLeft}d (${hoursLeft}h) left`, `${daysLeft}T (${hoursLeft}h)`, `${daysLeft}g (${hoursLeft}h)`, `${daysLeft}d (${hoursLeft}h)`,`${daysLeft}d (${hoursLeft}h)`)
              : tr(`Finit dans ${hoursLeft}h`, `Ends in ${hoursLeft}h`, `Endet in ${hoursLeft}h`, `Finisce tra ${hoursLeft}h`, `Termina em ${hoursLeft}h`,`Termina en ${hoursLeft}h`)}
          </div>
        </div>
        <div className="font-display text-xs tracking-widest text-white/35">
          {tr("SAISON", "SEASON", "SAISON", "STAGIONE", "TEMPORADA","TEMPORADA")} {season.num}
        </div>
      </div>

      {/* Mêmes onglets que le mobile */}
      <div className="flex gap-2 mb-4">
        {(["saison", "global"] as LbMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{ ...btn(m === mode ? G.projecteur : G.nuit, m === mode ? G.encre : G.white, 18),
              flex:1, padding:"10px 12px", borderRadius:G.rayonS }}
          >
            {m === "saison"
              ? "⭐ " + tr("SAISON", "SEASON", "SAISON", "STAGIONE", "TEMPORADA","TEMPORADA")
              : "🌍 GLOBAL"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-14 text-center text-white/35 text-sm">
          {tr("Chargement…", "Loading…", "Laden…", "Caricamento…", "Carregando…","Cargando…")}
        </div>
      ) : rows.length === 0 ? (
        <div className="py-14 text-center text-white/30 text-sm">
          {tr("Aucun score pour le moment", "No scores yet", "Noch keine Scores", "Ancora nessun punteggio", "Ainda sem pontuações","Todavía no hay puntuaciones")}
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
                className="overflow-hidden"
                style={{
                  background: podium ? podium.bg : G.nuit,
                  border: G.trait,
                  borderRadius: G.rayon,
                  boxShadow: G.ombre,
                }}
              >
                <div className="flex items-center gap-3 px-3 py-3">
                  <div
                    className="w-9 flex-shrink-0 text-center"
                    style={{ ...posterText(1, podium ? DARK_INK : G.white, 0), fontSize:26 }}
                  >
                    {podium ? podium.medal : p.rank}
                  </div>

                  {/* Photo de profil = carte du niveau du joueur, comme sur mobile.
                      Cadre au format de la carte (3:4) et non rond : un cadrage
                      circulaire amputerait le haut et le bas de l'illustration. */}
                  <div
                    className="relative flex-shrink-0 h-12 w-9 overflow-hidden"
                    style={{
                      background: G.encre,
                      borderRadius: 8,
                      border: G.traitFin,
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
                        className="truncate"
                        style={{ ...posterText(1, podium ? DARK_INK : G.white, 0), fontSize:21 }}
                      >
                        {flag && <span className="mr-1.5 text-[15px]">{flag}</span>}
                        {p.name}
                      </span>
                      <span
                        className="text-[11px] font-bold px-2 py-0.5 tracking-wide whitespace-nowrap"
                        style={{
                          color: G.white,
                          background: grade.color,
                          borderRadius: 8,
                          border: "1.5px solid " + G.encre,
                        }}
                      >
                        {grade.emoji} {grade.label}
                      </span>
                    </div>
                  </div>

                  <div
                    className="flex-shrink-0 tabular-nums"
                    style={{ ...posterText(1, podium ? DARK_INK : G.white, 0), fontSize:28 }}
                  >
                    {p.score.toLocaleString("fr-FR")}
                    <span
                      className="text-xs ml-1"
                      style={{ color: podium ? "rgba(8,17,9,.7)" : "rgba(255,255,255,.4)" }}
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
          className="inline-flex"
          style={{ ...btn(G.projecteur, G.encre, 30), padding:"14px 40px", boxShadow:G.ombreL }}
        >
          ▶ {tr("TENTER MA PLACE", "GO FOR MY SPOT", "UM MEINEN PLATZ KÄMPFEN", "TENTA IL TUO POSTO", "IR ATRÁS DO MEU LUGAR","IR A POR MI PUESTO")}
        </button>
      </div>
    </div>
  );
};
