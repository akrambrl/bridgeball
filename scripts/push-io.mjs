// Le CIRCUIT d'envoi : ce qui parle à Supabase et aux services de push.
//
// Partagé par les deux envoyeurs — notif-devinette.mjs (une fois par jour) et
// notif-amis.mjs (par sondage). Sans ce module, le second aurait recopié la
// lecture paginée, le chiffrement, la purge et la limite de parallélisme du
// premier, et les deux auraient divergé au premier correctif.
//
// Les DÉCISIONS restent dans src/lib/push.js, qui ne touche pas au réseau et se
// teste unitairement. Ici, il n'y a que des entrées-sorties.

import webpush from "web-push";
import { dedupeAbonnements, decisionEnvoi, decisionFinale, resumerCorps, repartitionHotes } from "../src/lib/push.js";

export const SB_URL = process.env.SB_URL || "https://ialjlsrgcolocoaegzrc.supabase.co";
export const VAPID_PUBLIC_KEY = "BIDTT9eBO0qcUxJQq4WnNwOe9RR39XlWTo3bFTIjc7Uwt6V4kFwbA2qcLYkBOBw391wbecoBkhAN41MvKvIIkyk";
export const TABLE_ABOS = "bb_push_subscriptions";

const PAGE = 1000;        // plafond « max rows » de l'API PostgREST
const PARALLELE = 10;     // envois simultanés

export const SERVICE_KEY = process.env.SB_SERVICE_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "https://goatfc.fr";

export function log(...a) { console.log(...a); }

function entetes(extra) {
  return Object.assign({ apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY }, extra || {});
}

/**
 * Vérifie les secrets AVANT toute lecture, et arme la signature VAPID.
 * @param {{signature: boolean}} besoins
 */
export function preparer(besoins) {
  if (!SERVICE_KEY) {
    throw new Error("SB_SERVICE_KEY absente — impossible de lire quoi que ce soit "
      + "(bb_push_subscriptions est volontairement illisible avec la clé publique).");
  }
  if (besoins && besoins.signature) {
    if (!VAPID_PRIVATE_KEY) throw new Error("VAPID_PRIVATE_KEY absente — impossible de signer l'envoi.");
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  }
}

/**
 * Lit toutes les lignes d'une table, page par page.
 *
 * `requete` DOIT contenir un `order=` stable : sans tri, la pagination peut
 * sauter des lignes ou en rendre deux fois.
 */
export async function lireTout(table, requete) {
  const out = [];
  for (let debut = 0; ; debut += PAGE) {
    const res = await fetch(SB_URL + "/rest/v1/" + table + "?" + requete, {
      headers: entetes({ Range: debut + "-" + (debut + PAGE - 1) }),
    });
    if (!res.ok) {
      const texte = (await res.text()).slice(0, 300);
      // Message dédié : la cause la plus probable d'un 400 ici est une colonne
      // qui n'existe pas encore, et l'erreur brute de PostgREST ne dit pas quoi
      // faire. Voir docs/NOTIFICATIONS.md.
      if (/does not exist/.test(texte)) {
        throw new Error("lecture " + table + " : une colonne manque en base.\n  " + texte
          + "\n  → voir la section « Colonnes à créer » de docs/NOTIFICATIONS.md");
      }
      throw new Error("lecture " + table + " : HTTP " + res.status + " " + texte);
    }
    const lot = await res.json();
    out.push(...lot);
    if (lot.length < PAGE) return out;
  }
}

/** Supprime des lignes par id, par paquets (l'URL serait trop longue sinon). */
export async function supprimer(table, ids, raison, dryRun) {
  if (!ids.length) return 0;
  if (dryRun) { log("  (à blanc) " + ids.length + " lignes à supprimer — " + raison); return 0; }
  let faits = 0;
  for (let i = 0; i < ids.length; i += 50) {
    const lot = ids.slice(i, i + 50);
    const res = await fetch(SB_URL + "/rest/v1/" + table + "?id=in.(" + lot.join(",") + ")", {
      method: "DELETE", headers: entetes({ Prefer: "return=minimal" }),
    });
    if (res.ok) faits += lot.length;
    else log("  ⚠ suppression refusée : HTTP " + res.status);
  }
  log("  " + faits + " lignes supprimées — " + raison);
  return faits;
}

/** Modifie des lignes par id, par paquets. */
export async function modifier(table, ids, corps, raison, dryRun) {
  if (!ids.length) return 0;
  if (dryRun) { log("  (à blanc) " + ids.length + " lignes à marquer — " + raison); return 0; }
  let faits = 0;
  for (let i = 0; i < ids.length; i += 50) {
    const lot = ids.slice(i, i + 50);
    const res = await fetch(SB_URL + "/rest/v1/" + table + "?id=in.(" + lot.join(",") + ")", {
      method: "PATCH",
      headers: entetes({ "Content-Type": "application/json", Prefer: "return=minimal" }),
      body: JSON.stringify(corps),
    });
    if (res.ok) faits += lot.length;
    else log("  ⚠ marquage refusé : HTTP " + res.status + " " + (await res.text()).slice(0, 200));
  }
  log("  " + faits + " lignes marquées — " + raison);
  return faits;
}

/** Les abonnements push, dédoublonnés par endpoint. `pourJoueurs` = null → tous. */
export async function lireAbonnements(pourJoueurs) {
  let requete = "select=id,endpoint,p256dh,auth,platform,player_id,created_at&order=created_at.asc,id.asc";
  if (pourJoueurs) {
    const ids = [...new Set(pourJoueurs)].filter(Boolean);
    if (!ids.length) return { garder: [], doublons: [], inutilisables: [], brut: 0 };
    requete += "&player_id=in.(" + ids.map(function(i){ return '"' + i + '"'; }).join(",") + ")";
  }
  const lignes = await lireTout(TABLE_ABOS, requete);
  return Object.assign(dedupeAbonnements(lignes), { brut: lignes.length });
}

/** Exécute `tache` sur chaque élément, `limite` en parallèle. */
async function enParallele(items, limite, tache) {
  const res = new Array(items.length);
  let suivant = 0;
  await Promise.all(Array.from({ length: Math.min(limite, items.length) }, async () => {
    while (true) {
      const i = suivant++;
      if (i >= items.length) return;
      res[i] = await tache(items[i], i);
    }
  }));
  return res;
}

/** L'hôte d'un endpoint : le service de push, seule granularité utile au journal. */
function hoteDe(endpoint) {
  try { return new URL(endpoint).host; } catch (e) { return "?"; }
}

async function envoyerUn(abonne, charge) {
  const hote = hoteDe(abonne.endpoint);
  try {
    await webpush.sendNotification(
      { endpoint: abonne.endpoint, keys: { p256dh: abonne.p256dh, auth: abonne.auth } },
      charge, { TTL: 12 * 3600, urgency: "normal" }
    );
    return { decision: "ok", status: 201, hote };
  } catch (e) {
    const status = e && typeof e.statusCode === "number" ? e.statusCode : 0;
    // `e.body` PORTE la cause ; `e.message` vaut invariablement « Received
    // unexpected response code ». Ne garder que le message, c'était rapporter
    // sept échecs par jour sans un mot sur leur raison. Un statut 0 signale un
    // échec AVANT la requête (chiffrement, DNS) : là, le message est tout ce
    // qu'on a, et il est parlant.
    const corps = e && e.body !== undefined ? resumerCorps(e.body) : "";
    return { decision: decisionEnvoi(status), status, hote, corps,
      message: e && e.message ? String(e.message).slice(0, 160) : "" };
  }
}

/** La ligne d'alerte : l'hôte d'abord, puisque c'est lui qui refuse. */
function ligneAlerte(r, abonne) {
  const plateforme = (abonne && abonne.platform) || "?";
  const cause = r.corps || r.message || "(réponse vide)";
  return "HTTP " + r.status + " sur " + r.hote + " (" + plateforme + ") — " + cause;
}

/**
 * Envoie une charge à une liste d'abonnés, puis classe les échecs.
 *
 * `charges` est une fonction abonné → chaîne JSON : la devinette envoie le même
 * message à tout le monde, les demandes d'ami un message par destinataire.
 *
 * @returns {{compte: object, aPurger: string[], perimes: string[], alertes: string[], reussis: Set<string>}}
 */
export async function envoyerLot(abonnes, charges) {
  const resultats = await enParallele(abonnes, PARALLELE, function(a){ return envoyerUn(a, charges(a)); });

  // Deuxième passe, une fois l'issue de TOUS les envois connue : un 403 isolé au
  // milieu d'envois réussis ne parle pas de notre clé mais d'un abonnement créé
  // avec une autre — voir decisionFinale.
  const auMoinsUnSucces = resultats.some(function(r){ return r.decision === "ok"; });
  const compte = { ok: 0, purger: 0, alerter: 0, reessayer: 0 };
  const aPurger = [], perimes = [], alertes = [], reussis = new Set();
  resultats.forEach(function(r, i){
    const d = decisionFinale(r.status, auMoinsUnSucces);
    compte[d] = (compte[d] || 0) + 1;
    if (d === "ok") reussis.add(abonnes[i].player_id);
    if (d === "purger") (r.status === 401 || r.status === 403 ? perimes : aPurger).push(abonnes[i].id);
    if (d === "alerter") alertes.push(ligneAlerte(r, abonnes[i]));
  });

  log("── Envoyé : " + compte.ok + " ✓  |  morts : " + compte.purger
    + "  |  à retenter : " + compte.reessayer + "  |  erreurs : " + compte.alerter);
  journalParHote(resultats, abonnes);
  return { compte, aPurger, perimes, alertes, reussis };
}

/**
 * Le bilan PAR SERVICE de push, toujours affiché.
 *
 * « 2 réussis, 7 en erreur » ne dit pas où passe la frontière. Si les sept
 * échecs sont tous chez le même service et les deux succès chez un autre, la
 * cause est dans ce que ce service exige de nous ; s'ils sont mélangés, elle est
 * dans les abonnements. C'est la première question à trancher, donc elle est
 * dans le journal de chaque exécution et pas seulement en cas d'échec.
 */
function journalParHote(resultats, abonnes) {
  const parHote = new Map();
  resultats.forEach(function(r, i){
    const hote = r.hote || hoteDe(abonnes[i] && abonnes[i].endpoint);
    let e = parHote.get(hote);
    if (!e) { e = { ok: 0, echecs: new Map() }; parHote.set(hote, e); }
    if (r.decision === "ok") e.ok++;
    else {
      const cle = r.status + " " + (r.corps || r.message || "");
      e.echecs.set(cle, (e.echecs.get(cle) || 0) + 1);
    }
  });
  for (const [hote, e] of parHote) {
    const total = e.ok + [...e.echecs.values()].reduce(function(s, n){ return s + n; }, 0);
    log("   " + hote + " : " + e.ok + "/" + total + " reçus");
    for (const [cle, n] of e.echecs) log("     ×" + n + "  " + cle);
  }
}

/** Purge d'après le résultat d'un envoi, plus les rebuts du dédoublonnage. */
export async function nettoyer(resultat, abos, dryRun) {
  await supprimer(TABLE_ABOS, resultat.aPurger, "abonnements morts (404/410)", dryRun);
  await supprimer(TABLE_ABOS, resultat.perimes, "abonnements signés par une ancienne clé VAPID (403)", dryRun);
  await supprimer(TABLE_ABOS, abos.doublons.map(function(d){ return d.id; }), "doublons d'endpoint", dryRun);
  await supprimer(TABLE_ABOS, abos.inutilisables.map(function(d){ return d.id; }), "lignes sans clés de chiffrement", dryRun);
}

/**
 * Signale les erreurs non imputables aux abonnés en faisant ÉCHOUER le script.
 *
 * Sans ça, une clé VAPID refusée passerait pour « envoi réussi à zéro
 * personne ». Le premier lancement après un changement de paire tombe
 * légitimement ici : aucun succès ne vient prouver que la nouvelle clé est
 * bonne, ce qui est indiscernable d'un secret mal collé.
 */
export function signalerAlertes(alertes) {
  if (!alertes.length) return;
  log("── ⚠ " + alertes.length + " erreurs non imputables aux abonnés :");
  // Regroupées, PAS tronquées. La version précédente affichait les cinq
  // premières lignes : sur sept erreurs identiques elle n'en montrait aucune de
  // neuve, et sur sept erreurs dont une seule différait, c'est précisément
  // celle-là qu'elle risquait de cacher. Ici, chaque cause distincte apparaît
  // une fois avec son nombre d'occurrences.
  const causes = new Map();
  for (const a of alertes) causes.set(a, (causes.get(a) || 0) + 1);
  for (const [cause, n] of [...causes].sort(function(x, y){ return y[1] - x[1]; })) {
    log("   ×" + n + "  " + cause);
  }
  process.exitCode = 1;
}

/** Le détail des abonnés par service de push, pour les exécutions à blanc. */
export function journalAbonnes(abonnes) {
  for (const h of repartitionHotes(abonnes)) {
    const longueur = h.longueurMin === h.longueurMax
      ? String(h.longueurMin) : h.longueurMin + "–" + h.longueurMax;
    log("   " + h.hote + " : " + h.nombre + " abonné(s), endpoint " + longueur
      + " car., " + JSON.stringify(h.plateformes));
  }
}
