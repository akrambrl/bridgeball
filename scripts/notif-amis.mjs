#!/usr/bin/env node
// ENVOI des notifications « X t'a ajouté en ami ».
//
// Différence de nature avec la devinette : celle-ci part à heure fixe, une fois
// par jour, et le même message pour tout le monde. Une demande d'ami arrive à
// l'improviste, s'adresse à UNE personne, et surtout ne doit être annoncée
// QU'UNE FOIS. C'est cette dernière contrainte qui commande tout le reste.
//
// Pourquoi un sondage et non un déclenchement immédiat : envoyer au moment de
// l'insertion supposerait de signer la notification côté client, donc d'y mettre
// la clé privée VAPID — impossible, elle serait publique. Il faut un serveur, et
// le seul dont on dispose est le cron GitHub. Une demande d'ami annoncée dix
// minutes plus tard reste utile, ce qui rend le compromis acceptable ; un défi
// en direct ne le supporterait pas.
//
// Pourquoi une colonne `notified_at` et pas seulement le `tag` : un tag remplace
// une notification encore AFFICHÉE. Dès qu'elle est balayée, le sondage suivant
// en recrée une, avec vibration. Il faut donc une trace en base.
//
// Lancement : npx tsx scripts/notif-amis.mjs [--dry-run]
// Secrets attendus : SB_SERVICE_KEY, VAPID_PRIVATE_KEY.

import { demandesANotifier, accrocheAmis, grouperPar } from "../src/lib/push.js";
import { preparer, lireTout, lireAbonnements, modifier, envoyerLot, nettoyer,
         signalerAlertes, log } from "./push-io.mjs";

const TABLE = "bb_friend_requests";
// `friends=1` ouvre le panneau « Mes amis », où la demande est acceptable d'un
// tap. Sans ce paramètre la notification déposait sur l'accueil : elle annonçait
// une demande d'ami et laissait la chercher. C'est le même paramètre que le
// bouton « Mes amis » du lobby utilise déjà.
const CIBLE = "https://goatfc.fr/?friends=1&utm_source=push&utm_medium=notif&utm_campaign=ami";
// Au-delà, une demande n'est plus annoncée : elle est seulement marquée. Sert de
// garde-fou à la première exécution, où toutes les demandes en attente depuis
// des mois partiraient sinon d'un coup.
const FENETRE_MS = 24 * 60 * 60 * 1000;

const dryRun = process.argv.slice(2).includes("--dry-run");

async function main() {
  log("── Notifications de demandes d'ami" + (dryRun ? "  [À BLANC]" : ""));
  preparer({ signature: !dryRun });

  // Seules les lignes jamais notifiées : la table entière n'a pas à être relue à
  // chaque sondage, et elle ne cesse de grandir.
  const lignes = await lireTout(TABLE,
    "select=id,from_id,from_name,to_id,to_name,status,created_at,notified_at"
    + "&notified_at=is.null&order=created_at.asc,id.asc");

  const { aEnvoyer, aMarquerSansEnvoi } = demandesANotifier(lignes, Date.now(), FENETRE_MS);
  log("── " + lignes.length + " demandes jamais notifiées → " + aEnvoyer.length + " à annoncer"
    + (aMarquerSansEnvoi.length ? ", " + aMarquerSansEnvoi.length + " à classer sans envoi "
      + "(déjà traitées, ou plus vieilles que " + (FENETRE_MS / 3600000) + " h)" : ""));

  const marque = new Date().toISOString();
  // Les demandes hors fenêtre sont marquées même si l'envoi n'a pas lieu : sans
  // ça, elles reviendraient à chaque tour de sondage jusqu'à la fin des temps.
  if (aMarquerSansEnvoi.length) {
    await modifier(TABLE, aMarquerSansEnvoi.map(function(d){ return d.id; }),
      { notified_at: marque }, "classées sans envoi", dryRun);
  }
  if (!aEnvoyer.length) { log("Rien à annoncer."); return; }

  // Une notification par DESTINATAIRE : trois demandes en attente ne font pas
  // trois notifications simultanées.
  const parDestinataire = grouperPar(aEnvoyer, "to_id");
  const abos = await lireAbonnements([...parDestinataire.keys()]);
  log("── " + parDestinataire.size + " destinataires → " + abos.garder.length + " appareils abonnés");

  if (!abos.garder.length) {
    // Pas d'abonnement : on marque quand même. La demande reste visible dans
    // l'app, et la garder « à notifier » ne ferait que la repousser sans fin.
    log("Aucun destinataire abonné aux notifications : demandes classées sans envoi.");
    await modifier(TABLE, aEnvoyer.map(function(d){ return d.id; }),
      { notified_at: marque }, "destinataires non abonnés", dryRun);
    return;
  }

  const charges = new Map();
  for (const [dest, demandes] of parDestinataire) {
    const { titre, corps } = accrocheAmis(demandes);
    charges.set(dest, JSON.stringify({
      title: titre, body: corps, url: CIBLE,
      // Un tag par destinataire : une deuxième demande remplace la notification
      // en cours au lieu de s'empiler à côté.
      tag: "goatfc-ami-" + dest, icon: "/icon-192.png",
    }));
    log("   → " + (demandes[0].to_name || dest) + " : " + corps);
  }

  if (dryRun) {
    log("── À BLANC : " + abos.garder.length + " envois simulés, rien n'est parti, rien n'est marqué.");
    return;
  }

  const resultat = await envoyerLot(abos.garder, function(a){ return charges.get(a.player_id); });

  // On ne marque que les demandes dont le destinataire a REÇU quelque chose. Une
  // panne passagère du service de push laisse donc la demande annonçable au
  // prochain tour, au lieu de la perdre définitivement.
  const annoncees = aEnvoyer.filter(function(d){ return resultat.reussis.has(d.to_id); });
  if (annoncees.length) {
    await modifier(TABLE, annoncees.map(function(d){ return d.id; }),
      { notified_at: marque }, "annoncées", dryRun);
  }
  const reportees = aEnvoyer.length - annoncees.length;
  if (reportees > 0) log("── " + reportees + " demandes non annoncées, reportées au prochain sondage.");

  await nettoyer(resultat, abos, dryRun);
  signalerAlertes(resultat.alertes);
}

main().catch((e) => { console.error("ÉCHEC : " + (e && e.message ? e.message : e)); process.exit(1); });
