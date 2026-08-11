#!/usr/bin/env node
// ENVOI de la notification quotidienne « devinette du jour ».
//
// Ce script est la pièce qui MANQUAIT. L'app demandait la permission d'envoyer
// des notifications, enregistrait les abonnements dans bb_push_subscriptions, et
// promettait « on te pinguera » — mais rien, nulle part, n'envoyait quoi que ce
// soit : ni Edge Function, ni cron, ni dépendance web-push. La permission était
// demandée pour rien, et un refus de notification est définitif.
//
// Lancement : npx tsx scripts/notif-devinette.mjs [--dry-run] [--jour=YYYY-MM-DD]
// (tsx et non node : ce script importe src/players.jsx, que Node ne sait pas
// charger seul.)
//
// Variables d'environnement attendues :
//   SB_SERVICE_KEY     clé service_role Supabase. Indispensable : la table est
//                      volontairement illisible pour anon (les endpoints push
//                      sont des données sensibles), donc la clé publique ne
//                      permet pas de lire les abonnés.
//   VAPID_PRIVATE_KEY  clé privée VAPID, celle qui va avec la clé publique du
//                      client. Jamais dans le dépôt.
//   VAPID_SUBJECT      optionnel — URL ou mailto de contact (défaut goatfc.fr).

import webpush from "web-push";
import { PLAYERS, RETIRED_PLAYERS } from "../src/players.jsx";
import { parisDay, poolDevinette, joueurDuJour, accrocheDevinette } from "../src/lib/devinette.js";
import { dedupeAbonnements, decisionEnvoi, tagDuJour } from "../src/lib/push.js";

// Surchargeable pour pouvoir exercer l'envoi de bout en bout contre un faux
// Supabase et un faux service de push, sans toucher à la production. C'est ce
// que fait scripts/notif-devinette.essai.mjs.
const SB_URL = process.env.SB_URL || "https://ialjlsrgcolocoaegzrc.supabase.co";
const VAPID_PUBLIC_KEY = "BIDTT9eBO0qcUxJQq4WnNwOe9RR39XlWTo3bFTIjc7Uwt6V4kFwbA2qcLYkBOBw391wbecoBkhAN41MvKvIIkyk";
const TABLE = "bb_push_subscriptions";
const PAGE = 1000;          // plafond « max rows » de l'API PostgREST
const PARALLELE = 10;       // envois simultanés
const CIBLE = "https://goatfc.fr/?utm_source=push&utm_medium=notif&utm_campaign=devinette";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const jourArg = (args.find((a) => a.startsWith("--jour=")) || "").slice(7);

const SERVICE_KEY = process.env.SB_SERVICE_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "https://goatfc.fr";

function log(...a) { console.log(...a); }

/** Lit toutes les lignes de la table, page par page (l'API plafonne à 1000). */
async function lireAbonnements() {
  const out = [];
  for (let debut = 0; ; debut += PAGE) {
    // `order=` obligatoire : sans tri stable, la pagination peut sauter ou
    // répéter des lignes.
    const url = SB_URL + "/rest/v1/" + TABLE
      + "?select=id,endpoint,p256dh,auth,platform,created_at&order=created_at.asc,id.asc";
    const res = await fetch(url, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: "Bearer " + SERVICE_KEY,
        Range: debut + "-" + (debut + PAGE - 1),
      },
    });
    if (!res.ok) throw new Error("lecture " + TABLE + " : HTTP " + res.status + " " + (await res.text()).slice(0, 200));
    const lot = await res.json();
    out.push(...lot);
    if (lot.length < PAGE) return out;
  }
}

/** Supprime des lignes par id, par paquets (URL trop longue sinon). */
async function supprimer(ids, raison) {
  if (!ids.length) return 0;
  if (dryRun) { log("  (dry-run) " + ids.length + " lignes à supprimer — " + raison); return 0; }
  let faits = 0;
  for (let i = 0; i < ids.length; i += 50) {
    const lot = ids.slice(i, i + 50);
    const url = SB_URL + "/rest/v1/" + TABLE + "?id=in.(" + lot.join(",") + ")";
    const res = await fetch(url, {
      method: "DELETE",
      headers: { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY, Prefer: "return=minimal" },
    });
    if (res.ok) faits += lot.length;
    else log("  ⚠ suppression refusée : HTTP " + res.status);
  }
  log("  " + faits + " lignes supprimées — " + raison);
  return faits;
}

/** Envoie à un abonné et renvoie la décision à prendre. */
async function envoyer(a, charge) {
  try {
    await webpush.sendNotification(
      { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
      charge,
      { TTL: 12 * 3600, urgency: "normal" }
    );
    return { decision: "ok", status: 201 };
  } catch (e) {
    const status = e && typeof e.statusCode === "number" ? e.statusCode : 0;
    return { decision: decisionEnvoi(status), status, message: e && e.message ? String(e.message).slice(0, 160) : "" };
  }
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

async function main() {
  const jour = jourArg || parisDay();
  const joueur = joueurDuJour(poolDevinette(PLAYERS, RETIRED_PLAYERS), jour);
  const { titre, corps } = accrocheDevinette(joueur);

  log("── Notification devinette du " + jour + (dryRun ? "  [DRY-RUN]" : ""));
  log("   titre : " + titre);
  log("   corps : " + corps);
  // Le nom n'est PAS dans la notification, mais il est utile dans les logs du
  // workflow pour vérifier que le serveur parle bien du joueur du jeu.
  if (joueur) log("   (joueur du jour, hors notification : " + joueur.name + ")");

  if (!SERVICE_KEY) throw new Error("SB_SERVICE_KEY absente — impossible de lire les abonnés (la table est illisible pour anon).");
  if (!VAPID_PRIVATE_KEY && !dryRun) throw new Error("VAPID_PRIVATE_KEY absente — impossible de signer l'envoi.");
  if (VAPID_PRIVATE_KEY) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const lignes = await lireAbonnements();
  const { garder, doublons, inutilisables } = dedupeAbonnements(lignes);
  log("── " + lignes.length + " lignes en base → " + garder.length + " abonnés uniques"
    + (doublons.length ? ", " + doublons.length + " doublons" : "")
    + (inutilisables.length ? ", " + inutilisables.length + " inutilisables" : ""));

  if (!garder.length) {
    log("Aucun abonné : rien à envoyer. (Normal si personne n'a encore accepté depuis le déploiement.)");
    return;
  }

  const charge = JSON.stringify({
    title: titre, body: corps, url: CIBLE, tag: tagDuJour(jour), icon: "/icon-192.png",
  });

  if (dryRun) {
    log("── DRY-RUN : " + garder.length + " envois simulés, rien n'est parti.");
    const parPlateforme = {};
    for (const a of garder) parPlateforme[a.platform || "?"] = (parPlateforme[a.platform || "?"] || 0) + 1;
    log("   plateformes : " + JSON.stringify(parPlateforme));
    return;
  }

  const resultats = await enParallele(garder, PARALLELE, (a) => envoyer(a, charge));

  const compte = { ok: 0, purger: 0, alerter: 0, reessayer: 0 };
  const aPurger = [], alertes = [];
  resultats.forEach((r, i) => {
    compte[r.decision] = (compte[r.decision] || 0) + 1;
    if (r.decision === "purger") aPurger.push(garder[i].id);
    if (r.decision === "alerter") alertes.push("HTTP " + r.status + " — " + (r.message || ""));
  });

  log("── Envoyé : " + compte.ok + " ✓  |  morts : " + compte.purger
    + "  |  à retenter : " + compte.reessayer + "  |  erreurs : " + compte.alerter);

  await supprimer(aPurger, "abonnements morts (404/410)");
  await supprimer(doublons.map((d) => d.id), "doublons d'endpoint");
  await supprimer(inutilisables.map((d) => d.id), "lignes sans clés de chiffrement");

  if (alertes.length) {
    // 401/403 = notre clé VAPID est refusée. Ce n'est pas un abonné cassé, c'est
    // la configuration : il faut que le workflow ÉCHOUE, sinon la panne passe
    // pour un envoi réussi à zéro personne.
    log("── ⚠ " + alertes.length + " erreurs non imputables aux abonnés :");
    for (const a of alertes.slice(0, 5)) log("   " + a);
    process.exitCode = 1;
  }
}

main().catch((e) => { console.error("ÉCHEC : " + (e && e.message ? e.message : e)); process.exit(1); });
