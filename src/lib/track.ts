// Tracking léger « quel mode de jeu est joué » — écrit dans la table Supabase
// bb_events (même table que le ping de présence "open"), avec un type
// "play_<mode>". Fire-and-forget : n'échoue jamais côté UI.
//
// Modes suivis : "pont" (The Plug), "chaine" (The Mercato), "grid" (GOAT Grid),
// "guess" (GOAT Guess / Le Devin), "battle" (GOAT Battle / GOAT Duel).

const SB_URL = "https://ialjlsrgcolocoaegzrc.supabase.co";
const SB_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhbGpsc3JnY29sb2NvYWVnenJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MDM3NzksImV4cCI6MjA5MTA3OTc3OX0.-SU8anuPhnpoa-PYhIHQqrcuOBsHxdtBJKRZuiGcGwM";

export type PlayMode = "pont" | "chaine" | "grid" | "guess" | "battle";

// Récupère (ou crée) l'identifiant anonyme d'appareil — même clé que LePont.
function getPlayerId(): string {
  try {
    let id = localStorage.getItem("bb_player_id");
    if (!id) {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      id = Array.from({ length: 6 }, () =>
        chars[Math.floor(Math.random() * chars.length)]
      ).join("");
      localStorage.setItem("bb_player_id", id);
    }
    return id;
  } catch {
    return "anon";
  }
}

// Enregistre un démarrage de partie pour le mode donné. Chaque appel = 1 partie.
// `online` = true si la partie est jouée en duel / salon multijoueur (sinon solo).
// Le type devient "play_<mode>" (solo) ou "play_<mode>_online" (en ligne), ce qui
// permet au dashboard de compter le total par mode ET la répartition solo/en ligne.
export function trackPlay(mode: PlayMode, online = false): void {
  try {
    const type = "play_" + mode + (online ? "_online" : "");
    fetch(SB_URL + "/rest/v1/bb_events", {
      method: "POST",
      headers: {
        apikey: SB_KEY,
        Authorization: "Bearer " + SB_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ player_id: getPlayerId(), type }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* jamais bloquant */
  }
}
