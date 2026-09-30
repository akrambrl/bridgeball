#!/usr/bin/env node
// ENVOI de la notification « bravo, tu as gagné — réclame ton lot ».
//
// Pourquoi ce script existe. Le règlement promet que les gagnants « reçoivent
// également une notification » : jusqu'ici, rien ne l'envoyait. Un gagnant qui
// n'ouvre pas l'app ne savait rien de sa victoire, alors que le délai de
// réclamation court (30 jours).
//
// Ce qu'il fait : pour chaque saison CLOSE dotée d'un lot, il relit le
// classement du mois (bb_classement_mois, la fonction même qui sert à
// réclamer), retrouve qui occupe une place dotée, et prévient ceux qui ne l'ont
// pas encore été. La décision vit dans `gagnantsANotifier` (src/lib/push.js).
//
// UNE TABLE DE SUIVI (bb_gagnants_notifies, clé saison + joueur) rend l'envoi
// rejouable : relancer le script, ou le laisser tourner trois jours de suite,
// ne prévient personne deux fois. Un joueur n'y est inscrit QU'APRÈS un envoi
// réussi — un gagnant injoignable (pas de notifications) reste à prévenir, et
// le script le liste pour qu'on le contacte à la main.
//
// Lancement : npx tsx scripts/notif-gagnants.mjs [--dry-run]
// Secrets attendus : SB_SERVICE_KEY, VAPID_PRIVATE_KEY.
// Table à créer avant le premier lancement : voir docs/NOTIFICATIONS.md.

import { gagnantsANotifier, accrocheGagnant } from "../src/lib/push.js";
import { moisDeLaSaison } from "../src/lib/reclamation.js";
import { preparer, lireTout, lireAbonnements, postRpc, upsertLignes,
         envoyerLot, nettoyer, signalerAlertes, log } from "./push-io.mjs";

// `onglet=saison` ouvre directement le classement, où se trouve le bandeau
// « Réclamer mon lot ».
const CIBLE = "https://goatfc.fr/?onglet=saison&utm_source=push&utm_medium=notif&utm_campaign=gagnant";
const TABLE_SUIVI = "bb_gagnants_notifies";

const dryRun = process.argv.slice(2).includes("--dry-run");

async function main() {
  log("── Notification aux gagnants" + (dryRun ? "  [À BLANC]" : ""));
  preparer({ signature: !dryRun });

  const saisons = (await lireTout("bb_seasons", "select=season_number&order=season_number.asc"))
    .map(function(s){ return s.season_number; });
  const lots = await lireTout("bb_lots",
    "select=season_number,rang,intitule,ouvert_jusqu_a&order=season_number.asc,rang.asc");
  const dotees = saisons.filter(function(n){ return lots.some(function(l){ return l.season_number === n; }); });
  log("── saisons closes et dotées : " + (dotees.length ? dotees.join(", ") : "(aucune)"));
  if (!dotees.length) { log("Rien à annoncer."); return; }

  const classements = {}, mois = {};
  for (const n of dotees) {
    mois[n] = moisDeLaSaison(n);
    classements[n] = await postRpc("bb_classement_mois", { p_mois: mois[n] });
  }
  const dejaNotifies = await lireTout(TABLE_SUIVI,
    "select=season_number,player_id&order=season_number.asc,player_id.asc");

  const gagnants = gagnantsANotifier({ saisonsCloses: dotees, lots, classements, dejaNotifies, mois });
  log("── " + gagnants.length + " gagnant(s) à prévenir");
  for (const g of gagnants) {
    log("   " + g.rang + ". " + (g.pseudo || g.player_id) + "  (saison " + g.season_number + ")");
  }
  if (!gagnants.length) { log("Rien à annoncer."); return; }

  const abos = await lireAbonnements(gagnants.map(function(g){ return g.player_id; }));
  const abonnes = new Set(abos.garder.map(function(a){ return a.player_id; }));
  const injoignables = gagnants.filter(function(g){ return !abonnes.has(g.player_id); });
  log("── " + abos.garder.length + " appareils abonnés");
  if (injoignables.length) {
    log("── ⚠ sans notifications, À PRÉVENIR À LA MAIN : "
      + injoignables.map(function(g){ return (g.pseudo || g.player_id) + " (" + g.rang + "e)"; }).join(", "));
  }

  const parJoueur = new Map();
  for (const g of gagnants) {
    const { titre, corps } = accrocheGagnant(g);
    parJoueur.set(g.player_id, JSON.stringify({
      title: titre, body: corps, url: CIBLE, tag: "goatfc-gagnant-" + g.season_number + "-" + g.player_id,
      icon: "/icon-192.png",
    }));
    log("   → " + (g.pseudo || g.player_id) + " : " + titre + " / " + corps);
  }

  if (dryRun) {
    log("── À BLANC : " + abos.garder.length + " envois simulés, rien n'est parti ni marqué.");
    return;
  }
  if (!abos.garder.length) { log("Aucun gagnant abonné : rien à envoyer."); return; }

  const resultat = await envoyerLot(abos.garder, function(a){ return parJoueur.get(a.player_id); });
  await nettoyer(resultat, abos, dryRun);

  // Marqués UNIQUEMENT ceux qui ont reçu : les autres restent à prévenir.
  const notifies = gagnants.filter(function(g){ return resultat.reussis.has(g.player_id); });
  await upsertLignes(TABLE_SUIVI, notifies.map(function(g){
    return { season_number: g.season_number, player_id: g.player_id, rang: g.rang, notifie_le: new Date().toISOString() };
  }), dryRun);
  signalerAlertes(resultat.alertes);
}

main().catch((e) => { console.error("ÉCHEC : " + (e && e.message ? e.message : e)); process.exit(1); });
