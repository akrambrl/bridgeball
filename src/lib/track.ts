// Tracking léger « quel mode de jeu est joué » — écrit dans la table Supabase
// bb_events (même table que le ping de présence "open"), avec un type
// "play_<mode>". Fire-and-forget : n'échoue jamais côté UI.
//
// Modes suivis : "pont" (The Plug), "chaine" (The Mercato), "grid" (GOAT Grid),
// "guess" (GOAT Guess / Le Devin), "battle" (GOAT Battle / GOAT Duel),
// "reveal" (GOAT reveal / Trouve le joueur).

const SB_URL = "https://ialjlsrgcolocoaegzrc.supabase.co";
const SB_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhbGpsc3JnY29sb2NvYWVnenJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MDM3NzksImV4cCI6MjA5MTA3OTc3OX0.-SU8anuPhnpoa-PYhIHQqrcuOBsHxdtBJKRZuiGcGwM";

export type PlayMode = "pont" | "chaine" | "grid" | "guess" | "battle" | "reveal" | "devinette";

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

// Détecte l'OS mobile : "ios" | "android" | "other" (même logique que LePont).
function detectOS(): "ios" | "android" | "other" {
  try {
    const ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1)) return "ios";
    if (/Android/i.test(ua)) return "android";
    return "other";
  } catch {
    return "other";
  }
}

// Battement de cœur "en ligne maintenant" — upsert d'UNE ligne par appareil dans
// bb_presence (player_id = clé primaire). Le dashboard compte les appareils vus
// dans les ~80 dernières secondes. Pas de gonflement de table (1 ligne / appareil).
// Nécessite la table bb_presence (voir docs/GOAT-PRESENCE-SETUP.md) ; sinon no-op.
export function pingLive(): void {
  try {
    let name = "";
    try { name = (localStorage.getItem("bb_name") || "").slice(0, 40); } catch { /* noop */ }
    fetch(SB_URL + "/rest/v1/bb_presence", {
      method: "POST",
      headers: {
        apikey: SB_KEY,
        Authorization: "Bearer " + SB_KEY,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({ player_id: getPlayerId(), player_name: name, os: detectOS() }),
      keepalive: true,
    }).catch(() => { /* table absente ou hors-ligne : sans effet */ });
  } catch {
    /* jamais bloquant */
  }
}

// Ping de présence "open_<os>" — sert au comptage des appareils (iOS / Android).
// 1× par jour et par appareil. IMPORTANT : le drapeau "déjà pingé aujourd'hui"
// n'est posé qu'APRÈS un POST réussi — sinon un envoi raté (réseau mobile
// capricieux, app ouverte hors-ligne, ancien bundle en cache) marquerait
// l'appareil comme compté et il ne serait JAMAIS enregistré de la journée.
let pingInFlight = false;
export function pingPresence(): void {
  try {
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem("bb_ping_day") === today) return;
    if (pingInFlight) return;
    pingInFlight = true;
    fetch(SB_URL + "/rest/v1/bb_events", {
      method: "POST",
      headers: {
        apikey: SB_KEY,
        Authorization: "Bearer " + SB_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ player_id: getPlayerId(), type: "open_" + detectOS() }),
      keepalive: true,
    })
      .then((res) => {
        if (res && res.ok) {
          try { localStorage.setItem("bb_ping_day", today); } catch { /* noop */ }
        }
      })
      .catch(() => { /* on réessaiera à la prochaine ouverture / partie */ })
      .finally(() => { pingInFlight = false; });
  } catch {
    /* jamais bloquant */
  }
}

// Enregistre un démarrage de partie pour le mode donné. Chaque appel = 1 partie.
// `online` = true si la partie est jouée en duel / salon multijoueur (sinon solo).
// Le type devient "play_<mode>" (solo) ou "play_<mode>_online" (en ligne), ce qui
// permet au dashboard de compter le total par mode ET la répartition solo/en ligne.
export function trackPlay(mode: PlayMode, online = false): void {
  try {
    // Jouer une partie garantit aussi que l'appareil (OS) est compté ce jour-là,
    // même si le ping d'ouverture avait échoué (réseau, cache…).
    pingPresence();
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
