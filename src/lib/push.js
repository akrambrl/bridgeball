// Règles de l'ENVOI des notifications push, isolées ici pour être testables.
//
// L'envoi lui-même vit dans scripts/notif-devinette.mjs, qui parle à Supabase et
// aux serveurs de push. Ce qui est décidable sans réseau est ici : quel
// abonnement garder, que faire d'un abonnement refusé, comment nommer la notif.
//
// En .js et non .ts, comme src/lib/tirage.js : le script d'envoi le charge
// directement depuis Node. Aucun import.

/** Un abonnement inutilisable : il manque de quoi chiffrer le message. */
export function abonnementUtilisable(a) {
  return !!a && typeof a.endpoint === "string" && a.endpoint.startsWith("https://")
    && typeof a.p256dh === "string" && a.p256dh.length > 0
    && typeof a.auth === "string" && a.auth.length > 0;
}

/**
 * Un seul abonnement par endpoint : le plus RÉCENT.
 *
 * Pourquoi c'est nécessaire : le client écrit avec `Prefer:
 * resolution=merge-duplicates`, mais PostgREST cible alors la clé primaire, et
 * `id` est généré à chaque insertion — la collision n'a donc jamais lieu et la
 * table accumule une ligne par réabonnement. Sans ce filtre, un utilisateur qui
 * a rouvert l'app dix fois reçoit dix notifications identiques.
 *
 * Le plus récent et non le premier : les clés de chiffrement (`p256dh`, `auth`)
 * peuvent avoir été renouvelées par le navigateur pour un même endpoint, et
 * seules les dernières déchiffrent.
 *
 * @param {Array} lignes lues de bb_push_subscriptions
 * @returns {{garder: Array, doublons: Array, inutilisables: Array}}
 */
export function dedupeAbonnements(lignes) {
  const inutilisables = [], groupes = new Map();
  for (const l of lignes || []) {
    if (!abonnementUtilisable(l)) { inutilisables.push(l); continue; }
    const groupe = groupes.get(l.endpoint);
    if (groupe) groupe.push(l); else groupes.set(l.endpoint, [l]);
  }
  const garder = [], doublons = [];
  for (const groupe of groupes.values()) {
    let recent = groupe[0];
    for (const l of groupe) if (dateLigne(l) > dateLigne(recent)) recent = l;
    garder.push(recent);
    for (const l of groupe) if (l !== recent) doublons.push(l);
  }
  return { garder, doublons, inutilisables };
}

function dateLigne(l) {
  const t = Date.parse(l && l.created_at);
  return isNaN(t) ? 0 : t;
}

/**
 * Ce qu'il faut faire d'une réponse du serveur de push.
 *
 * La distinction qui compte est entre « purger » et « alerter » :
 *  • 404 / 410 : l'abonnement est mort (app désinstallée, permission retirée).
 *    On supprime la ligne, sinon la table grossit indéfiniment et le taux
 *    d'échec finit par masquer les vrais problèmes.
 *  • 401 / 403 : c'est NOTRE clé VAPID qui est refusée, pas l'abonné. Purger
 *    ici viderait toute la table sur une erreur de configuration — la panne
 *    deviendrait irréparable. On alerte, on ne touche à rien.
 *  • 429 / 5xx : le serveur de push est saturé ou en panne. À retenter.
 *
 * @param {number} status
 * @returns {"ok"|"purger"|"alerter"|"reessayer"}
 */
export function decisionEnvoi(status) {
  if (status >= 200 && status < 300) return "ok";
  if (status === 404 || status === 410) return "purger";
  if (status === 401 || status === 403) return "alerter";
  if (status === 429 || status >= 500) return "reessayer";
  return "alerter";
}

/**
 * Le `tag` de la notification du jour.
 *
 * Deux notifications de même tag se REMPLACENT sur l'appareil au lieu de
 * s'empiler. C'est le garde-fou contre un double envoi (workflow relancé à la
 * main, cron qui se déclenche deux fois) : l'utilisateur ne voit jamais deux
 * fois la même devinette, même si le serveur l'a envoyée deux fois.
 */
export function tagDuJour(jour) {
  return "goatfc-devinette-" + jour;
}
