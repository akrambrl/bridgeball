#!/usr/bin/env node
// ENVOI de la relance « tu n'as pas joué depuis 3 jours ».
//
// Une seule question la gouverne : comment ne PAS relancer tous les jours
// quelqu'un qui ne revient jamais ? La réponse est `relance_inactivite_at`
// (bb_pseudos) — posée après un envoi réussi, et qui n'autorise une NOUVELLE
// relance que si le joueur a rejoué DEPUIS. Voir `joueursARelancer` dans
// src/lib/push.js : c'est elle qui porte la vraie décision, ce script ne fait
// que les entrées-sorties.
//
// D'où vient « la dernière activité » : bb_scores ET bb_gg_scores, réduits à
// une date par joueur (`derniereActivitePar`). La lecture est bornée à une
// fenêtre glissante — voir FENETRE_ACTIVITE_MS — pour ne jamais relire tout
// l'historique, qui ne cesse de grossir.
//
// Lancement : npx tsx scripts/notif-inactivite.mjs [--dry-run]
// Secrets attendus : SB_SERVICE_KEY, VAPID_PRIVATE_KEY.
// Colonne à créer avant le premier lancement : voir docs/NOTIFICATIONS.md.

import { derniereActivitePar, joueursARelancer, accrocheRelanceInactivite } from "../src/lib/push.js";
import { preparer, lireTout, lireAbonnements, envoyerLot, nettoyer, signalerAlertes,
         SB_URL, SERVICE_KEY, log } from "./push-io.mjs";

const CIBLE = "https://goatfc.fr/?utm_source=push&utm_medium=notif&utm_campaign=relance";
const SEUIL_MS = 3 * 24 * 60 * 60 * 1000;
// Bornée et non « tout l'historique » : une lecture qui grossirait pour
// toujours n'a rien à faire dans un cron quotidien. Au-delà, une relance a de
// toute façon peu de chances de faire revenir quelqu'un — pas besoin d'aller
// chercher plus loin dans le passé pour le savoir.
const FENETRE_ACTIVITE_MS = 30 * 24 * 60 * 60 * 1000;

const dryRun = process.argv.slice(2).includes("--dry-run");

/** PATCH bb_pseudos par player_id, par paquets — modifier() de push-io.mjs cible `id`, pas ce cas. */
async function marquerRelances(playerIds, champ, valeur, dryRunLocal) {
  if (!playerIds.length) return 0;
  if (dryRunLocal) { log("  (à blanc) " + playerIds.length + " joueurs à marquer relancés"); return 0; }
  let faits = 0;
  for (let i = 0; i < playerIds.length; i += 50) {
    const lot = playerIds.slice(i, i + 50);
    const filtre = lot.map(function(id){ return '"' + id + '"'; }).join(",");
    const res = await fetch(SB_URL + "/rest/v1/bb_pseudos?player_id=in.(" + filtre + ")", {
      method: "PATCH",
      headers: { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY,
                 "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ [champ]: valeur }),
    });
    if (res.ok) faits += lot.length;
    else log("  ⚠ marquage refusé : HTTP " + res.status);
  }
  log("  " + faits + " joueurs marqués relancés");
  return faits;
}

async function main() {
  log("── Notification de relance (inactivité 3 jours)" + (dryRun ? "  [À BLANC]" : ""));
  preparer({ signature: !dryRun });

  const depuis = new Date(Date.now() - FENETRE_ACTIVITE_MS).toISOString();
  const [scores, ggScores] = await Promise.all([
    lireTout("bb_scores", "select=player_id,created_at&created_at=gte." + depuis + "&order=created_at.asc"),
    lireTout("bb_gg_scores", "select=player_id,created_at&created_at=gte." + depuis + "&order=created_at.asc"),
  ]);
  const activites = derniereActivitePar(scores.concat(ggScores));
  log("── " + activites.length + " joueurs actifs sur les " + Math.round(FENETRE_ACTIVITE_MS / 86400000) + " derniers jours");

  const pseudos = await lireTout("bb_pseudos", "select=player_id,relance_inactivite_at");
  const aRelancer = joueursARelancer(activites, pseudos, Date.now(), SEUIL_MS);
  log("── " + aRelancer.length + " joueurs inactifs depuis 3 jours ou plus, jamais relancés pour cet épisode");

  if (!aRelancer.length) { log("Rien à envoyer."); return; }

  const abos = await lireAbonnements(aRelancer.map(function(a){ return a.player_id; }));
  log("── " + aRelancer.length + " candidats → " + abos.garder.length + " appareils abonnés");

  const { titre, corps } = accrocheRelanceInactivite();
  log("   " + corps);

  if (dryRun) {
    log("── À BLANC : " + abos.garder.length + " envois simulés, rien n'est parti, rien n'est marqué.");
    return;
  }
  if (!abos.garder.length) { log("Aucun candidat abonné : rien à envoyer."); return; }

  // Un seul message pour tout le monde, comme la devinette : pas de nom à
  // faire varier, donc pas besoin d'une charge par destinataire.
  const charge = JSON.stringify({ title: titre, body: corps, url: CIBLE, tag: "goatfc-relance", icon: "/icon-192.png" });
  const resultat = await envoyerLot(abos.garder, function(){ return charge; });

  // On ne marque « relancé » que ce qui a été REÇU : un envoi manqué (panne du
  // service de push) ne doit pas priver ce joueur de toute relance future.
  const marque = new Date().toISOString();
  const relances = aRelancer.filter(function(a){ return resultat.reussis.has(a.player_id); });
  await marquerRelances(relances.map(function(a){ return a.player_id; }), "relance_inactivite_at", marque, dryRun);
  const reportes = aRelancer.length - relances.length;
  if (reportes > 0) log("── " + reportes + " relances non envoyées, reportées au prochain passage.");

  await nettoyer(resultat, abos, dryRun);
  signalerAlertes(resultat.alertes);
}

main().catch((e) => { console.error("ÉCHEC : " + (e && e.message ? e.message : e)); process.exit(1); });
