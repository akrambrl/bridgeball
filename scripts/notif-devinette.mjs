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
// Secrets attendus : SB_SERVICE_KEY, VAPID_PRIVATE_KEY. Voir
// docs/NOTIFICATIONS.md ; le circuit lui-même vit dans scripts/push-io.mjs.

import { PLAYERS, RETIRED_PLAYERS } from "../src/players.jsx";
import { parisDay, poolDevinette, joueurDuJour, accrocheDevinette } from "../src/lib/devinette.js";
import { tagDuJour } from "../src/lib/push.js";
import { preparer, lireAbonnements, envoyerLot, nettoyer, signalerAlertes, journalAbonnes, log } from "./push-io.mjs";

// `play=devinette` OUVRE la devinette. Sans ce paramètre, la notification
// annonçait le joueur mystère du jour et déposait sur l'accueil, où il fallait
// encore le trouver soi-même — une notification qui ne mène pas où elle promet.
// Le nom du paramètre est celui que lisent déjà Index.tsx et Home.tsx pour les
// autres modes, et que les pages SEO utilisent dans leurs boutons.
const CIBLE = "https://goatfc.fr/?play=devinette&utm_source=push&utm_medium=notif&utm_campaign=devinette";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const jourArg = (args.find((a) => a.startsWith("--jour=")) || "").slice(7);

async function main() {
  const jour = jourArg || parisDay();
  const joueur = joueurDuJour(poolDevinette(PLAYERS, RETIRED_PLAYERS), jour);
  const { titre, corps } = accrocheDevinette(joueur);

  log("── Notification devinette du " + jour + (dryRun ? "  [À BLANC]" : ""));
  log("   titre : " + titre);
  log("   corps : " + corps);
  // Le nom n'est PAS dans la notification, mais il est utile dans le journal du
  // workflow pour vérifier que le serveur parle bien du joueur du jeu.
  if (joueur) log("   (joueur du jour, hors notification : " + joueur.name + ")");

  preparer({ signature: !dryRun });

  const abos = await lireAbonnements(null);
  log("── " + abos.brut + " lignes en base → " + abos.garder.length + " abonnés uniques"
    + (abos.doublons.length ? ", " + abos.doublons.length + " doublons" : "")
    + (abos.inutilisables.length ? ", " + abos.inutilisables.length + " inutilisables" : ""));

  if (!abos.garder.length) {
    log("Aucun abonné : rien à envoyer. (Normal si personne ne s'est encore abonné avec la clé courante.)");
    return;
  }

  const charge = JSON.stringify({
    title: titre, body: corps, url: CIBLE, tag: tagDuJour(jour), icon: "/icon-192.png",
  });

  if (dryRun) {
    log("── À BLANC : " + abos.garder.length + " envois simulés, rien n'est parti.");
    // Par SERVICE de push et non par `platform` : c'est le service qui accepte
    // ou refuse, et `platform` n'est qu'une déclaration de l'app. Voir
    // repartitionHotes.
    journalAbonnes(abos.garder);
    return;
  }

  const resultat = await envoyerLot(abos.garder, function(){ return charge; });
  await nettoyer(resultat, abos, dryRun);
  signalerAlertes(resultat.alertes);
}

main().catch((e) => { console.error("ÉCHEC : " + (e && e.message ? e.message : e)); process.exit(1); });
