#!/usr/bin/env node
// ENVOI de la notification « tu as perdu ta place sur le podium ».
//
// « Perdre sa place » veut dire sortir du top 3 du classement du mois — pas
// descendre dedans. La décision vit dans `evolutionPodium` (src/lib/push.js) ;
// ce script ne fait que lire le classement, le comparer au dernier suivi
// connu, et réécrire ce suivi pour le prochain passage.
//
// POURQUOI UNE TABLE DE SUIVI (bb_podium_suivi) ET PAS UN SIMPLE CALCUL À LA
// VOLÉE : `evolutionPodium` a besoin du top 3 D'AVANT pour voir qui en est
// sorti. Rien d'autre ne le garde — le classement lui-même ne connaît que le
// présent. La table est donc réécrite à CHAQUE passage sur l'état actuel,
// que quelqu'un ait été déchu ou non : un déchu qu'on laisserait dans le
// suivi reviendrait identique au tour suivant et repartirait en notification
// indéfiniment, exactement le défaut que `notified_at` évite ailleurs.
//
// Cadence horaire (voir le workflow) : assez réactif pour qu'une notification
// de podium reste pertinente, assez espacé pour ne pas tourner en continu sur
// un classement qui ne bouge pas à la minute.
//
// Lancement : npx tsx scripts/notif-podium.mjs [--dry-run]
// Secrets attendus : SB_SERVICE_KEY, VAPID_PRIVATE_KEY.
// Table à créer avant le premier lancement : voir docs/NOTIFICATIONS.md.

import { parisMoisCourant, evolutionPodium, accrocheDechu } from "../src/lib/push.js";
import { preparer, lireTout, lireAbonnements, postRpc, upsertLignes, supprimerFiltre,
         envoyerLot, nettoyer, signalerAlertes, log } from "./push-io.mjs";

// `onglet=saison` ouvre directement le classement du mois — pas l'accueil,
// où il faudrait encore aller le chercher.
const CIBLE = "https://goatfc.fr/?onglet=saison&utm_source=push&utm_medium=notif&utm_campaign=podium";
const TABLE_SUIVI = "bb_podium_suivi";

const dryRun = process.argv.slice(2).includes("--dry-run");

async function main() {
  log("── Notification de podium" + (dryRun ? "  [À BLANC]" : ""));
  preparer({ signature: !dryRun });

  const mois = parisMoisCourant();
  const classement = await postRpc("bb_classement_courant", {});
  const actuelTop3 = (classement || []).slice(0, 3).map(function(c, i){
    return { player_id: c.player_id, pseudo: c.pseudo, rang: i + 1 };
  });
  log("── podium actuel (" + mois + ") : "
    + (actuelTop3.length ? actuelTop3.map(function(c){ return c.rang + ". " + (c.pseudo || c.player_id); }).join(" · ") : "(vide)"));

  const precedentTop3 = await lireTout(TABLE_SUIVI, "select=player_id,rang&mois=eq." + mois);
  const dechus = evolutionPodium(actuelTop3, precedentTop3);
  log("── " + dechus.length + " joueur(s) sorti(s) du podium depuis le dernier passage");

  if (dryRun) {
    log("  (à blanc) le suivi du podium ne sera pas mis à jour");
  } else {
    // Mois révolus : ménage, pour que la table ne grossisse pas mois après mois.
    await supprimerFiltre(TABLE_SUIVI, "mois=neq." + mois, "mois révolus", dryRun);
    // Sortis du podium CE mois : retirés du suivi, sinon ils repartiraient en
    // notification à chaque passage — voir le commentaire d'en-tête.
    if (precedentTop3.length) {
      const idsActuels = actuelTop3.map(function(c){ return c.player_id; });
      const aRetirer = precedentTop3.filter(function(p){ return idsActuels.indexOf(p.player_id) === -1; });
      if (aRetirer.length) {
        const filtre = "mois=eq." + mois + "&player_id=in.("
          + aRetirer.map(function(p){ return '"' + p.player_id + '"'; }).join(",") + ")";
        await supprimerFiltre(TABLE_SUIVI, filtre, "sortis du podium", dryRun);
      }
    }
    if (actuelTop3.length) {
      await upsertLignes(TABLE_SUIVI, actuelTop3.map(function(c){
        return { mois: mois, player_id: c.player_id, rang: c.rang, vu_le: new Date().toISOString() };
      }), dryRun);
    }
  }

  if (!dechus.length) { log("Rien à annoncer."); return; }

  const abos = await lireAbonnements(dechus.map(function(d){ return d.player_id; }));
  log("── " + dechus.length + " déchu(s) → " + abos.garder.length + " appareils abonnés");

  const charges = new Map();
  for (const d of dechus) {
    const { titre, corps } = accrocheDechu(d);
    charges.set(d.player_id, JSON.stringify({
      title: titre, body: corps, url: CIBLE, tag: "goatfc-podium-" + d.player_id, icon: "/icon-192.png",
    }));
    log("   → " + d.player_id + " (ex-" + d.ancienRang + "e) : " + corps);
  }

  if (dryRun) {
    log("── À BLANC : " + abos.garder.length + " envois simulés, rien n'est parti.");
    return;
  }
  if (!abos.garder.length) { log("Aucun déchu abonné : rien à envoyer."); return; }

  const resultat = await envoyerLot(abos.garder, function(a){ return charges.get(a.player_id); });
  await nettoyer(resultat, abos, dryRun);
  signalerAlertes(resultat.alertes);
}

main().catch((e) => { console.error("ÉCHEC : " + (e && e.message ? e.message : e)); process.exit(1); });
