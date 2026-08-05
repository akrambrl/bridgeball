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

// ─── Temps passé dans l'app ───────────────────────────────────────────────────
// Rien ne le mesurait : bb_presence n'est qu'un upsert d'UNE ligne par appareil
// (last_seen écrasé, aucun historique), et les événements de partie sont trop
// espacés pour en déduire une durée.
//
// bb_events n'a que (player_id, type, created_at) : on encode donc la durée dans
// le type, "dur_<secondes>", et on écrit UNE ligne par session — pas de
// battement de cœur régulier, qui multiplierait les lignes par 20 et finirait
// par étouffer la fenêtre de lecture du tableau de bord.
//
// Le temps compté est le temps réellement VISIBLE : l'onglet en arrière-plan ou
// l'app minimisée ne comptent pas.

const MIN_SESSION_S = 5;        // en dessous, c'est du bruit (rebond, rechargement)
const MAX_SESSION_S = 4 * 3600; // garde-fou : onglet oublié ouvert, horloge qui saute

let visibleSince: number | null = null;
let pendingMs = 0;
let timeInstalled = false;

function flushDuration(): void {
  try {
    if (visibleSince != null) {
      pendingMs += Date.now() - visibleSince;
      visibleSince = null;
    }
    let s = Math.round(pendingMs / 1000);
    pendingMs = 0;
    if (!isFinite(s) || s < MIN_SESSION_S) return;
    if (s > MAX_SESSION_S) s = MAX_SESSION_S;
    fetch(SB_URL + "/rest/v1/bb_events", {
      method: "POST",
      headers: {
        apikey: SB_KEY,
        Authorization: "Bearer " + SB_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ player_id: getPlayerId(), type: "dur_" + s }),
      keepalive: true, // la requête doit survivre à la fermeture de l'onglet
    }).catch(() => {});
  } catch {
    /* jamais bloquant */
  }
}

/**
 * Démarre la mesure du temps passé dans l'app. Idempotent : les appels suivants
 * ne font rien. À appeler une fois au montage.
 */
export function trackTime(): void {
  try {
    if (timeInstalled) return;
    timeInstalled = true;
    if (document.visibilityState === "visible") visibleSince = Date.now();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        if (visibleSince == null) visibleSince = Date.now();
      } else {
        flushDuration(); // l'app passe en arrière-plan = fin de session
      }
    });
    // pagehide couvre la fermeture/navigation, y compris le bfcache iOS où
    // "unload" ne se déclenche pas.
    window.addEventListener("pagehide", flushDuration);
  } catch {
    /* jamais bloquant */
  }
}
