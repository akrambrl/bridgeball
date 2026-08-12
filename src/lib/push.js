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
export function decisionFinale(status, auMoinsUnSucces, corps) {
  const d = decisionEnvoi(status);
  if (d === "alerter" && (status === 401 || status === 403) && auMoinsUnSucces) return "purger";
  if (d === "alerter" && status === 400 && abonnementMortSelonCorps(corps)) return "purger";
  return d;
}

// Ce qui, dans le corps d'un refus, désigne l'ABONNEMENT et pas nous.
//
// Les services ne s'accordent pas sur le code à rendre pour un abonnement mort.
// 404 et 410 sont les cas propres, déjà traités ; mais Apple répond 400
// « BadDeviceToken » pour un jeton qui n'est plus valide, et FCM 400 pour un
// jeton de notification périmé. Sans cette lecture, ces lignes-là échouent
// éternellement : jamais purgées puisque le code n'est pas 410, jamais
// délivrées puisque le jeton est mort.
const CORPS_ABONNEMENT_MORT = /bad ?device ?token|bad ?subscription|expired ?token|unregistered|not ?registered|invalid ?registration|unauthorized ?registration|registration token is not|invalid subscription|subscription (?:has |is )?expired/i;

// …mais surtout, ce qui désigne NOTRE configuration et interdit donc de purger.
// Un refus qui parle de signature, de JWT ou de VAPID parle de la clé du serveur :
// purger là-dessus viderait la table sur une erreur de secret, exactement ce que
// decisionEnvoi refuse de faire sur un 403. Ce garde passe AVANT l'autre, parce
// qu'un même corps peut contenir les deux mots — « ExpiredProviderToken » d'Apple
// désigne notre jeton d'autorisation, pas l'appareil.
const CORPS_NOTRE_FAUTE = /jwt|vapid|provider|signature|authorization|authentication|payload|encryption|header|topic|too large/i;

/**
 * VRAI si le corps d'un HTTP 400 dit que l'ABONNEMENT est mort.
 *
 * Volontairement étroit : en cas de doute, on n'efface pas. Ce qui n'est pas
 * reconnu ici reste rapporté tel quel dans le journal (voir resumerCorps), ce
 * qui permet d'élargir la règle sur pièces plutôt que par supposition.
 */
export function abonnementMortSelonCorps(corps) {
  if (!corps) return false;
  const t = String(corps);
  if (CORPS_NOTRE_FAUTE.test(t)) return false;
  return CORPS_ABONNEMENT_MORT.test(t);
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

/**
 * Faut-il (re)transmettre cet endpoint à Supabase ?
 *
 * L'app garde en local l'endpoint déjà envoyé, pour ne pas ajouter une ligne à
 * chaque ouverture — la table n'a pas de contrainte d'unicité, donc un POST
 * ajoute, il ne remplace pas. Mais cette mémoire est LOCALE : elle ne sait pas si
 * la ligne existe encore côté serveur.
 *
 * C'est un piège concret. Dès que l'envoyeur purge une ligne — abonnement mort,
 * doublon, refus définitif du service de push — le marqueur local continue
 * d'affirmer « déjà transmis » et l'abonné n'est JAMAIS réinscrit : de son côté
 * la permission reste accordée, donc rien ne le lui signale et rien ne le lui
 * redemande. Il disparaît des notifications pour de bon, sans qu'aucun des deux
 * camps ne le sache.
 *
 * D'où une péremption d'une semaine, et le format « endpoint|horodatage ». Coût
 * maximal : une ligne en doublon par abonné et par semaine, que dedupeAbonnements
 * écarte et que la purge des doublons supprime le jour même. C'est ce qui rend
 * une purge RÉPARABLE, donc défendable.
 *
 * Un marqueur sans horodatage vient de l'ancien format : traité comme périmé, il
 * repose une fois les lignes éventuellement déjà purgées.
 */
const PUSH_MARQUEUR_MS = 7 * 24 * 3600 * 1000;

export function pushARetransmettre(marqueur, endpoint, maintenant) {
  if (!marqueur) return true;
  const sep = marqueur.lastIndexOf("|");
  if (sep < 0) return true;
  if (marqueur.slice(0, sep) !== endpoint) return true;
  const pose = Number(marqueur.slice(sep + 1));
  if (!Number.isFinite(pose) || pose <= 0) return true;
  return maintenant - pose >= PUSH_MARQUEUR_MS;
}

/**
 * Ce que le service de push a RÉPONDU, en une ligne lisible.
 *
 * Pourquoi ça existe. web-push lève une erreur dont le `message` est toujours le
 * même — « Received unexpected response code » — et met l'explication réelle
 * dans `body`, que le journal jetait. Résultat : sept échecs quotidiens
 * rapportés comme « HTTP 400 » sans un mot sur la cause, donc indiagnostiquables.
 *
 * Chaque service a son format, et aucun n'est celui du voisin :
 *   Apple    {"reason":"BadDeviceToken"}
 *   FCM      {"error":{"code":400,"message":"…","status":"INVALID_ARGUMENT"}}
 *   Mozilla  {"code":400,"errno":110,"error":"Bad Request","message":"…"}
 * D'où la liste de pistes plutôt qu'un champ unique. `errno` est conservé parce
 * que chez Mozilla c'est lui qui distingue « abonnement invalide » de « en-tête
 * de chiffrement invalide » — deux causes opposées sous le même HTTP 400.
 *
 * Un corps illisible n'est pas une erreur : on rend le texte brut resserré,
 * ce qui vaut toujours mieux que rien.
 */
export function resumerCorps(corps) {
  if (corps === null || corps === undefined) return "";
  const texte = String(corps).trim();
  if (!texte) return "";
  try {
    const j = JSON.parse(texte);
    if (j && typeof j === "object") {
      const pistes = [
        j.reason,
        j.message,
        j.error && j.error.message,
        typeof j.error === "string" ? j.error : null,
        j.error && j.error.status,
        j.errno !== undefined && j.errno !== null ? "errno " + j.errno : null,
      ];
      const vues = new Set(), retenues = [];
      for (const p of pistes) {
        if (!p) continue;
        const s = String(p).replace(/\s+/g, " ").trim();
        if (!s || vues.has(s)) continue;
        vues.add(s); retenues.push(s);
      }
      if (retenues.length) return retenues.join(" / ").slice(0, 200);
    }
  } catch (e) { /* pas du JSON : on retombe sur le texte brut */ }
  return texte.replace(/\s+/g, " ").slice(0, 200);
}

/**
 * Combien d'abonnés par SERVICE de push, et sur quelles longueurs d'endpoint.
 *
 * `platform` ne répond pas à la question : elle est déclarée par l'app d'après
 * l'agent utilisateur (`ios`, `android`, `desktop`), alors qu'un échec en masse
 * se lit par service — Apple, FCM et Mozilla n'ont ni les mêmes exigences ni les
 * mêmes messages d'erreur. Sans ce découpage, « 2 réussis, 7 en 400 » ne dit pas
 * si la frontière est un service ou un hasard.
 *
 * Les longueurs sont là pour une panne précise : un `endpoint` tronqué à
 * l'écriture (colonne trop courte, copie partielle) produit un jeton refusé par
 * le service — donc un 400 — et se repère à un écart de longueur au sein d'un
 * même hôte, où tous les endpoints font normalement la même taille à quelques
 * caractères près.
 */
export function repartitionHotes(abonnes) {
  const parHote = new Map();
  for (const a of abonnes || []) {
    let hote = "?";
    try { hote = new URL(a.endpoint).host; } catch (e) { /* endpoint illisible */ }
    let e = parHote.get(hote);
    if (!e) { e = { hote, nombre: 0, longueurMin: Infinity, longueurMax: 0, plateformes: {} }; parHote.set(hote, e); }
    e.nombre++;
    const n = a && typeof a.endpoint === "string" ? a.endpoint.length : 0;
    e.longueurMin = Math.min(e.longueurMin, n);
    e.longueurMax = Math.max(e.longueurMax, n);
    const p = (a && a.platform) || "?";
    e.plateformes[p] = (e.plateformes[p] || 0) + 1;
  }
  return [...parHote.values()].sort(function(x, y){ return y.nombre - x.nombre || x.hote.localeCompare(y.hote); });
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
