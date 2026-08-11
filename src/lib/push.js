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
 * La décision définitive, une fois l'issue des AUTRES envois connue.
 *
 * `decisionEnvoi` refuse de purger sur 401/403 parce qu'un refus de signature
 * peut venir de notre configuration, et purger là-dessus viderait toute la table
 * sur une simple erreur de clé. Mais si UN SEUL envoi a réussi, cette hypothèse
 * tombe : la clé privée est manifestement valide, donc un 403 isolé ne parle plus
 * de nous — il parle de cet abonnement-là, créé avec une AUTRE clé publique. Un
 * abonnement est lié pour toujours à la clé qui l'a créé : celui-ci ne recevra
 * jamais rien, il faut le supprimer pour que son propriétaire se réabonne.
 *
 * C'est exactement le cas au changement de paire VAPID : les anciens abonnements
 * disparaissent d'eux-mêmes dès que les premiers réabonnés reçoivent leur
 * notification, sans intervention et sans risque.
 *
 * @param {number} status
 * @param {boolean} auMoinsUnSucces
 * @returns {"ok"|"purger"|"alerter"|"reessayer"}
 */
export function decisionFinale(status, auMoinsUnSucces) {
  const d = decisionEnvoi(status);
  if (d === "alerter" && (status === 401 || status === 403) && auMoinsUnSucces) return "purger";
  return d;
}

/**
 * Quelles demandes d'ami notifier, et lesquelles marquer sans rien envoyer.
 *
 * Le tri se joue sur trois questions, et chacune évite une bêtise précise :
 *
 *  • `notified_at` déjà rempli → on ne renvoie pas. Sans cette colonne, un
 *    sondage toutes les 10 minutes réenverrait la même demande indéfiniment
 *    jusqu'à ce qu'elle soit acceptée. Le `tag` ne suffirait pas : il remplace
 *    une notification encore affichée, mais une fois qu'elle est balayée, la
 *    suivante réalerte.
 *  • la demande n'est plus en attente → rien à annoncer, mais on la marque quand
 *    même : elle n'a plus à être réexaminée à chaque tour.
 *  • la demande est plus vieille que la fenêtre → on la marque SANS envoyer.
 *    C'est le garde-fou de la première exécution : sans lui, toutes les demandes
 *    en attente depuis des mois partiraient d'un coup, et chacun recevrait une
 *    rafale de « X t'a ajouté en ami » vieux de l'été dernier.
 *
 * @param {Array} lignes de bb_friend_requests
 * @param {number} maintenant horodatage
 * @param {number} fenetreMs âge maximal d'une demande encore annonçable
 * @returns {{aEnvoyer: Array, aMarquerSansEnvoi: Array}}
 */
export function demandesANotifier(lignes, maintenant, fenetreMs) {
  const aEnvoyer = [], aMarquerSansEnvoi = [];
  for (const l of lignes || []) {
    if (!l || l.notified_at) continue;
    if (l.status !== "pending") { aMarquerSansEnvoi.push(l); continue; }
    const cree = Date.parse(l.created_at);
    // Date illisible : on marque sans envoyer, plutôt que de traiter la ligne
    // comme neuve et de l'annoncer à tort.
    if (isNaN(cree) || maintenant - cree > fenetreMs) { aMarquerSansEnvoi.push(l); continue; }
    aEnvoyer.push(l);
  }
  return { aEnvoyer, aMarquerSansEnvoi };
}

/**
 * Une notification par DESTINATAIRE, pas par demande.
 *
 * Quelqu'un qui revient après une absence peut avoir trois demandes en attente :
 * trois notifications simultanées se lisent comme du harcèlement, alors qu'une
 * seule dit la même chose.
 *
 * @param {Array} demandes du même destinataire
 * @returns {{titre: string, corps: string}}
 */
export function accrocheAmis(demandes) {
  const noms = (demandes || []).map(function(d){ return (d.from_name || "Quelqu'un").trim() || "Quelqu'un"; });
  if (noms.length <= 1) {
    return { titre: "Nouvelle demande d'ami 🤝", corps: noms[0] + " veut être ton ami. Accepte et défie-le !" };
  }
  // À deux, on nomme les deux : « Karim et 1 autre » est plus froid et pas plus
  // court que « Karim et Léa ». Au-delà, le décompte reprend la main.
  const qui = noms.length === 2 ? noms[0] + " et " + noms[1] : noms[0] + " et " + (noms.length - 1) + " autres";
  return {
    titre: noms.length + " demandes d'ami 🤝",
    // « veulent » dans les deux cas : le sujet est pluriel dès qu'ils sont deux.
    corps: qui + " veulent être tes amis. Accepte et défie-les !",
  };
}

/** Regroupe des lignes par la valeur d'une clé. */
export function grouperPar(lignes, cle) {
  const out = new Map();
  for (const l of lignes || []) {
    const k = l[cle];
    const groupe = out.get(k);
    if (groupe) groupe.push(l); else out.set(k, [l]);
  }
  return out;
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
