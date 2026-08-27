import { useEffect, useState } from "react";
import { nombre, tr } from "@/lib/lang";
import {
  fetchMonProfil,
  fetchBilanDuels,
  fetchProfilStats,
  countryToFlag,
  type MonProfil,
  type BilanDuels,
  type ProfilStats,
} from "@/lib/leaderboard";
import {
  CARDS,
  levelCard,
  isUnlocked,
  unlockedCards,
  progressToNext,
  cardName,
  rarityMeta,
  rarityLabel,
} from "@/lib/collection";
import { G, posterText, posterTitre, posterLight, btn, fondCharte, areneCharte } from "@/lib/charte.jsx";

// ── LA PAGE PROFIL D'ORDINATEUR ─────────────────────────────────────────────
//
// Jusqu'ici, ouvrir « Mon profil » sur ordinateur montait l'écran MOBILE de
// LePont (une colonne de 520 px posée au milieu d'un grand fond jaune). Ça
// tenait, mais ça ne ressemblait pas à une page d'ordinateur. Cette vue est la
// version large, à la charte : carte de niveau en grand, palmarès en tuiles,
// bilan en duel, et la collection étalée en grille.
//
// Toutes les données se lisent depuis bb_pseudos / bb_scores / bb_duels via la
// lib leaderboard — les mêmes sources que le mobile, portées une fois pour ne
// pas dupliquer la logique dans deux composants.

function playerIdStocke(): string {
  try { return localStorage.getItem("bb_player_id") || ""; } catch { return ""; }
}
function pseudoStocke(): string {
  try { return localStorage.getItem("bb_pseudo") || localStorage.getItem("bb_name") || ""; } catch { return ""; }
}

export const ProfileView = ({ onClose }: { onClose: () => void }) => {
  const pid = playerIdStocke();
  const [profil, setProfil] = useState<MonProfil | null>(null);
  const [bilan, setBilan] = useState<BilanDuels | null>(null);
  const [stats, setStats] = useState<ProfilStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      fetchMonProfil(pid),
      fetchBilanDuels(pid),
      fetchProfilStats(pid),
    ]).then(([p, b, s]) => {
      if (!alive) return;
      setProfil(p); setBilan(b); setStats(s); setLoading(false);
    }).catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [pid]);

  // L'XP vient de la base ; à défaut (hors ligne, compte tout neuf), 0 — la
  // première carte s'affiche, jamais un écran vide.
  const xp = profil?.xp ?? 0;
  const pseudo = profil?.pseudo || pseudoStocke() || tr("anonyme", "anonymous", "anonym", "anonimo", "anônimo", "anónimo");
  const flag = countryToFlag(profil?.country ?? null);
  const carte = levelCard(xp);
  const meta = rarityMeta(carte.rarity);
  const suite = progressToNext(xp);
  const nbDebloquees = unlockedCards(xp).length;

  const tuile = (valeur: string, libelle: string, couleur: string) => (
    <div className="text-center px-3 py-4" style={{ background: G.nuit, border: G.trait, borderRadius: G.rayon, boxShadow: G.ombre }}>
      <div style={{ ...posterText(1, couleur, 0), fontSize: 30 }} className="tabular-nums">{valeur}</div>
      <div className="mt-1 text-[10.5px] font-extrabold uppercase tracking-widest text-white/45">{libelle}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-auto" style={{ background: fondCharte, isolation: "isolate" }}>
      {/* Le terrain doré de la charte, comme sur tout le site (lobby, classement,
          profil mobile). Le fond nuit d'avant tranchait avec le reste. */}
      {areneCharte}
      {/* En-tête collant : titre + fermeture, à l'encre, comme le reste des
          barres de la charte. */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-5 lg:px-10 py-3"
        style={{ background: G.encre, borderBottom: G.traitFin }}>
        <div style={{ ...posterText(1, G.white, 0), fontSize: 22 }}>
          {tr("MON ", "MY ", "MEIN ", "IL MIO ", "MEU ", "MI ")}
          <span style={{ color: G.projecteur }}>{tr("PROFIL", "PROFILE", "PROFIL", "PROFILO", "PERFIL", "PERFIL")}</span>
        </div>
        <button onClick={onClose}
          style={{ ...btn(G.projecteur, G.encre, 16), fontFamily: G.font, fontWeight: 800, letterSpacing: 1.5, transform: "none" }}>
          ← {tr("QUITTER", "QUIT", "BEENDEN", "ESCI", "SAIR", "SALIR")}
        </button>
      </div>

      <div className="container relative z-10 max-w-4xl mx-auto px-6 lg:px-10 py-8 lg:py-10">
        {loading ? (
          <div className="py-24 text-center text-white/35 text-sm">
            {tr("Chargement…", "Loading…", "Laden…", "Caricamento…", "Carregando…", "Cargando…")}
          </div>
        ) : (
          <>
            {/* ── HÉROS : la carte de niveau en grand + identité ─────────── */}
            <div className="grid gap-6 lg:gap-8 items-center mb-8"
              style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
              <div className="flex flex-col lg:flex-row items-center lg:items-stretch gap-6 lg:gap-8">
                {/* La carte, dans son cadre de rareté, format 3:4 comme partout. */}
                <div className="flex-shrink-0 mx-auto lg:mx-0"
                  style={{ width: 232, padding: 6, borderRadius: G.rayon, background: meta.frame, border: G.traitFin, boxShadow: G.ombreL }}>
                  <div style={{ aspectRatio: "3 / 4", borderRadius: 14, overflow: "hidden", background: G.encre }}>
                    {carte.img && <img src={carte.img} alt="" className="w-full h-full object-cover" style={{ objectPosition: "top" }} />}
                  </div>
                </div>

                {/* Identité : pseudo, grade, XP, progression vers la carte suivante. */}
                <div className="flex-1 min-w-0 flex flex-col justify-center text-center lg:text-left">
                  <div style={{ ...posterTitre(44, G.white), fontSize: "clamp(34px,5vw,48px)" }}>
                    {flag && <span className="mr-2">{flag}</span>}@{pseudo}
                  </div>

                  <div className="mt-3 flex items-center gap-3 justify-center lg:justify-start flex-wrap">
                    <span className="inline-block px-3 py-1"
                      style={{ ...posterLight(13, G.encre), letterSpacing: 2, background: meta.color, borderRadius: G.rayonS, border: G.traitFin, boxShadow: "2px 2px 0 " + G.encre }}>
                      {rarityLabel(meta)}
                    </span>
                    <span style={{ ...posterText(1, meta.color, 0), fontSize: 24 }}>{cardName(carte)}</span>
                  </div>

                  <div className="mt-4 flex items-baseline gap-2 justify-center lg:justify-start">
                    <span style={{ ...posterText(1, G.white, 0), fontSize: 40 }} className="tabular-nums">{nombre(xp)}</span>
                    <span className="text-xs font-extrabold tracking-widest" style={{ color: "rgba(8,17,9,.55)" }}>PTS</span>
                  </div>

                  {/* Barre de progression vers la prochaine carte. */}
                  {suite ? (
                    <div className="mt-4 max-w-md mx-auto lg:mx-0 w-full">
                      <div style={{ height: 14, background: "rgba(8,17,9,.55)", border: G.traitFin, borderRadius: G.rayonS, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: Math.round(suite.ratio * 100) + "%", background: meta.color }} />
                      </div>
                      <div className="mt-2 text-[12px] font-bold" style={{ color: "rgba(8,17,9,.72)" }}>
                        {(() => {
                          const reste = nombre(suite.missing);
                          const cible = cardName(suite.card);
                          return tr(`${reste} XP avant ${cible}`, `${reste} XP to ${cible}`, `${reste} XP bis ${cible}`, `${reste} XP prima di ${cible}`, `${reste} XP até ${cible}`, `${reste} XP para ${cible}`);
                        })()}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4" style={{ ...posterText(1, meta.color, 0), fontSize: 18 }}>
                      🏆 {tr("Collection complète", "Collection complete", "Sammlung komplett", "Collezione completa", "Coleção completa", "Colección completa")}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── PALMARÈS EN TUILES ─────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
              {tuile(nombre(stats?.played ?? 0), tr("Parties", "Games", "Spiele", "Partite", "Jogos", "Partidas"), G.projecteur)}
              {tuile(nombre(bilan?.v ?? 0), tr("Duels gagnés", "Duels won", "Duelle gewonnen", "Duelli vinti", "Duelos ganhos", "Duelos ganados"), G.pelouse)}
              {tuile(nombre(stats?.bestPont ?? 0), tr("Record The Plug", "The Plug best", "The Plug Rekord", "Record The Plug", "Recorde The Plug", "Récord The Plug"), G.white)}
              {tuile(nombre(stats?.bestChaine ?? 0), tr("Record Mercato", "Mercato best", "Mercato Rekord", "Record Mercato", "Recorde Mercato", "Récord Mercato"), G.white)}
            </div>

            {/* ── BILAN EN DUEL ──────────────────────────────────────────── */}
            {bilan && bilan.total > 0 && (
              <div className="mb-8">
                <div style={{ ...posterLight(20, G.encre) }} className="mb-3">
                  {tr("Mes duels", "My duels", "Meine Duelle", "I miei duelli", "Meus duelos", "Mis duelos")}
                </div>
                <div className="overflow-hidden" style={{ background: G.nuit, border: G.trait, borderRadius: G.rayon, boxShadow: G.ombre }}>
                  <div className="grid grid-cols-3">
                    <div className="text-center py-4" style={{ borderRight: G.traitFin }}>
                      <div style={{ ...posterText(1, G.pelouse, 0), fontSize: 30 }}>{bilan.v}</div>
                      <div className="mt-1 text-[10.5px] font-extrabold uppercase tracking-widest text-white/45">{tr("Victoires", "Wins", "Siege", "Vittorie", "Vitórias", "Victorias")}</div>
                    </div>
                    <div className="text-center py-4" style={{ borderRight: G.traitFin }}>
                      <div style={{ ...posterText(1, G.projecteur, 0), fontSize: 30 }}>{bilan.n}</div>
                      <div className="mt-1 text-[10.5px] font-extrabold uppercase tracking-widest text-white/45">{tr("Nuls", "Draws", "Remis", "Pareggi", "Empates", "Empates")}</div>
                    </div>
                    <div className="text-center py-4">
                      <div style={{ ...posterText(1, G.maillot, 0), fontSize: 30 }}>{bilan.d}</div>
                      <div className="mt-1 text-[10.5px] font-extrabold uppercase tracking-widest text-white/45">{tr("Défaites", "Losses", "Niederlagen", "Sconfitte", "Derrotas", "Derrotas")}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2" style={{ borderTop: G.traitFin, background: "rgba(0,0,0,.22)" }}>
                    <div className="text-center py-3" style={{ borderRight: G.traitFin }}>
                      <div style={{ ...posterText(1, G.white, 0), fontSize: 22 }}>{bilan.serie > 0 ? "🔥 " + bilan.serie : "—"}</div>
                      <div className="mt-0.5 text-[10.5px] font-extrabold uppercase tracking-widest text-white/45">{tr("Série en cours", "Current streak", "Aktuelle Serie", "Serie attuale", "Sequência atual", "Racha actual")}</div>
                    </div>
                    <div className="text-center py-3">
                      <div style={{ ...posterText(1, G.white, 0), fontSize: 22 }}>{bilan.meilleure}</div>
                      <div className="mt-0.5 text-[10.5px] font-extrabold uppercase tracking-widest text-white/45">{tr("Meilleure série", "Best streak", "Beste Serie", "Serie migliore", "Melhor sequência", "Mejor racha")}</div>
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-[11px] leading-snug" style={{ color: "rgba(8,17,9,.6)" }}>
                  {tr("Le palmarès en duel ne compte pas dans le classement du mois — il se joue au meilleur score de chaque mode.",
                    "Duel record doesn't count toward the monthly leaderboard — that's decided by your best score in each mode.",
                    "Die Duellbilanz zählt nicht für die Monatsrangliste — die entscheidet dein Bestwert pro Modus.",
                    "Il bilancio dei duelli non conta per la classifica mensile — decide il miglior punteggio di ogni modalità.",
                    "O histórico de duelos não conta no ranking do mês — vale o melhor placar de cada modo.",
                    "El historial de duelos no cuenta para la clasificación del mes — la decide tu mejor puntuación en cada modo.")}
                </p>
              </div>
            )}

            {/* ── COLLECTION ─────────────────────────────────────────────── */}
            <div>
              <div className="flex items-baseline gap-2 mb-3">
                <span style={{ ...posterLight(20, G.encre) }}>
                  {tr("Ma collection", "My collection", "Meine Sammlung", "La mia collezione", "Minha coleção", "Mi colección")}
                </span>
                <span style={{ ...posterText(1, G.encre, 0), fontSize: 18 }} className="tabular-nums">{nbDebloquees}</span>
                <span className="text-xs font-bold" style={{ color: "rgba(8,17,9,.5)" }}>/ {CARDS.length} {tr("cartes", "cards", "Karten", "carte", "cartas", "cartas")}</span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2.5">
                {CARDS.map((c) => {
                  const ok = isUnlocked(c, xp);
                  const rm = rarityMeta(c.rarity);
                  return (
                    <div key={c.id} title={ok ? cardName(c) : undefined}
                      style={{ padding: 2, borderRadius: G.rayonS, background: ok ? rm.frame : "rgba(255,255,255,.06)", border: G.traitFin, opacity: ok ? 1 : 0.55 }}>
                      <div className="relative flex items-center justify-center"
                        style={{ aspectRatio: "3 / 4", borderRadius: 8, overflow: "hidden", background: G.encre }}>
                        {ok && c.thumb
                          ? <img src={c.thumb} alt="" className="w-full h-full object-cover" style={{ objectPosition: "top" }} />
                          : <span style={{ fontSize: 18, opacity: 0.5 }}>🔒</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
