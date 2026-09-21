#!/usr/bin/env node
// ENVOI des notifications d'amitié : demande reçue, ET demande acceptée.
//
// Différence de nature avec la devinette : celle-ci part à heure fixe, une fois
// par jour, et le même message pour tout le monde. Une demande d'ami — ou son
// acceptation — arrive à l'improviste, s'adresse à UNE personne, et surtout ne
// doit être annoncée QU'UNE FOIS. C'est cette dernière contrainte qui commande
// tout le reste.
//
// Pourquoi un sondage et non un déclenchement immédiat : envoyer au moment de
// l'insertion supposerait de signer la notification côté client, donc d'y mettre
// la clé privée VAPID — impossible, elle serait publique. Il faut un serveur, et
// le seul dont on dispose est le cron GitHub. Un délai de dix minutes reste
// utile pour les deux annonces ; un défi en direct ne le supporterait pas.
//
// LES DEUX VOLETS PARTAGENT LE MÊME SONDAGE DE LA MÊME TABLE, mais chacun sa
// colonne de marquage :
//   • `notified_at`          → le DESTINATAIRE a été prévenu qu'une demande
//     lui est arrivée (volet historique).
//   • `accepted_notified_at` → l'EXPÉDITEUR a été prévenu que sa demande a été
//     acceptée (volet ajouté ensuite) — la moitié du dialogue qui manquait :
//     sans elle, on ne sait jamais si la personne à qui on a écrit a dit oui.
// Un tag remplacerait une notification encore AFFICHÉE, mais dès qu'elle est
// balayée, le sondage suivant en recrée une : il faut une trace en base.
//
// Lancement : npx tsx scripts/notif-amis.mjs [--dry-run]
// Secrets attendus : SB_SERVICE_KEY, VAPID_PRIVATE_KEY.
// Colonne à créer avant le premier lancement : voir docs/NOTIFICATIONS.md.

import { demandesANotifier, accrocheAmis, acceptationsANotifier, accrocheAmiAccepte, grouperPar } from "../src/lib/push.js";
import { preparer, lireTout, lireAbonnements, modifier, envoyerLot, nettoyer,
         signalerAlertes, log } from "./push-io.mjs";

const TABLE = "bb_friend_requests";
// `friends=1` ouvre le panneau « Mes amis », où une demande est acceptable et
// un ami tout juste ajouté visible d'un tap. Sans ce paramètre la notification
// déposait sur l'accueil : elle annonçait quelque chose et laissait le chercher.
const CIBLE = "https://goatfc.fr/?friends=1&utm_source=push&utm_medium=notif&utm_campaign=ami";
// Au-delà, une demande REÇUE n'est plus annoncée : elle est seulement marquée.
// Garde-fou de la première exécution, où toutes les demandes en attente depuis
// des mois partiraient sinon d'un coup. Les ACCEPTATIONS n'ont pas cette fenêtre
// — voir le commentaire au-dessus de `acceptationsANotifier` dans push.js.
const FENETRE_MS = 24 * 60 * 60 * 1000;

const dryRun = process.argv.slice(2).includes("--dry-run");

async function main() {
  log("── Notifications amis (demandes + acceptations)" + (dryRun ? "  [À BLANC]" : ""));
  preparer({ signature: !dryRun });
  const marque = new Date().toISOString();

  // ── Volet 1 : demandes reçues, jamais annoncées au destinataire ──
  const lignesPending = await lireTout(TABLE,
    "select=id,from_id,from_name,to_id,to_name,status,created_at,notified_at"
    + "&notified_at=is.null&order=created_at.asc,id.asc");
  const { aEnvoyer, aMarquerSansEnvoi } = demandesANotifier(lignesPending, Date.now(), FENETRE_MS);
  log("── " + lignesPending.length + " demandes jamais notifiées → " + aEnvoyer.length + " à annoncer"
    + (aMarquerSansEnvoi.length ? ", " + aMarquerSansEnvoi.length + " à classer sans envoi "
      + "(déjà traitées, ou plus vieilles que " + (FENETRE_MS / 3600000) + " h)" : ""));
  if (aMarquerSansEnvoi.length) {
    await modifier(TABLE, aMarquerSansEnvoi.map(function(d){ return d.id; }),
      { notified_at: marque }, "classées sans envoi", dryRun);
  }

  // ── Volet 2 : demandes acceptées, jamais annoncées à l'expéditeur ──
  const lignesAcceptees = await lireTout(TABLE,
    "select=id,from_id,from_name,to_id,to_name,status,accepted_notified_at"
    + "&status=eq.accepted&accepted_notified_at=is.null&order=id.asc");
  const aAnnoncerAcceptation = acceptationsANotifier(lignesAcceptees);
  log("── " + lignesAcceptees.length + " acceptations jamais notifiées → " + aAnnoncerAcceptation.length + " à annoncer");

  if (!aEnvoyer.length && !aAnnoncerAcceptation.length) { log("Rien à annoncer."); return; }

  // Une notification par personne, pas par ligne : trois événements simultanés
  // ne font pas trois notifications qui s'empilent.
  const parDestinataire = grouperPar(aEnvoyer, "to_id");
  const parExpediteur = grouperPar(aAnnoncerAcceptation, "from_id");
  const tousDestinataires = [...new Set([...parDestinataire.keys(), ...parExpediteur.keys()])];
  const abos = await lireAbonnements(tousDestinataires);
  log("── " + tousDestinataires.length + " personnes à prévenir → " + abos.garder.length + " appareils abonnés");

  if (dryRun) {
    log("── À BLANC : rien n'est parti, rien n'est marqué.");
    for (const [dest, demandes] of parDestinataire) {
      const { corps } = accrocheAmis(demandes);
      log("   [demande]   → " + (demandes[0].to_name || dest) + " : " + corps);
    }
    for (const [exp, acceptations] of parExpediteur) {
      const { corps } = accrocheAmiAccepte(acceptations);
      log("   [acceptée]  → " + (acceptations[0].from_name || exp) + " : " + corps);
    }
    return;
  }

  if (!abos.garder.length) {
    // Personne d'abonné : on marque quand même. L'état reste visible dans
    // l'app, et le garder « à notifier » ne ferait que le repousser sans fin.
    log("Aucune personne à prévenir n'est abonnée aux notifications : tout est classé sans envoi.");
    if (aEnvoyer.length) await modifier(TABLE, aEnvoyer.map(function(d){ return d.id; }),
      { notified_at: marque }, "destinataires non abonnés", dryRun);
    if (aAnnoncerAcceptation.length) await modifier(TABLE, aAnnoncerAcceptation.map(function(d){ return d.id; }),
      { accepted_notified_at: marque }, "expéditeurs non abonnés", dryRun);
    return;
  }

  // Les résultats des DEUX envois sont fusionnés avant le ménage : `nettoyer`
  // s'appuie aussi sur `abos.doublons`/`abos.inutilisables`, qu'il ne faut
  // purger qu'une fois, pas une fois par volet.
  const purgeGlobale = { aPurger: [], perimes: [], alertes: [] };

  if (parDestinataire.size) {
    const abosPending = abos.garder.filter(function(a){ return parDestinataire.has(a.player_id); });
    if (!abosPending.length) {
      await modifier(TABLE, aEnvoyer.map(function(d){ return d.id; }),
        { notified_at: marque }, "destinataires non abonnés", dryRun);
    } else {
      const charges = new Map();
      for (const [dest, demandes] of parDestinataire) {
        const { titre, corps } = accrocheAmis(demandes);
        charges.set(dest, JSON.stringify({
          title: titre, body: corps, url: CIBLE,
          // Un tag par destinataire : une deuxième demande remplace la
          // notification en cours au lieu de s'empiler à côté.
          tag: "goatfc-ami-" + dest, icon: "/icon-192.png",
        }));
        log("   → " + (demandes[0].to_name || dest) + " : " + corps);
      }
      const r = await envoyerLot(abosPending, function(a){ return charges.get(a.player_id); });
      purgeGlobale.aPurger.push(...r.aPurger); purgeGlobale.perimes.push(...r.perimes); purgeGlobale.alertes.push(...r.alertes);
      // On ne marque que ce qui a été REÇU. Une panne passagère du service de
      // push laisse la demande annonçable au prochain tour, au lieu de la
      // perdre définitivement.
      const annoncees = aEnvoyer.filter(function(d){ return r.reussis.has(d.to_id); });
      if (annoncees.length) await modifier(TABLE, annoncees.map(function(d){ return d.id; }),
        { notified_at: marque }, "demandes annoncées", dryRun);
      const reportees = aEnvoyer.length - annoncees.length;
      if (reportees > 0) log("── " + reportees + " demandes non annoncées, reportées au prochain sondage.");
    }
  }

  if (parExpediteur.size) {
    const abosAcceptees = abos.garder.filter(function(a){ return parExpediteur.has(a.player_id); });
    if (!abosAcceptees.length) {
      await modifier(TABLE, aAnnoncerAcceptation.map(function(d){ return d.id; }),
        { accepted_notified_at: marque }, "expéditeurs non abonnés", dryRun);
    } else {
      const charges = new Map();
      for (const [exp, acceptations] of parExpediteur) {
        const { titre, corps } = accrocheAmiAccepte(acceptations);
        charges.set(exp, JSON.stringify({
          title: titre, body: corps, url: CIBLE,
          tag: "goatfc-ami-accepte-" + exp, icon: "/icon-192.png",
        }));
        log("   → " + (acceptations[0].from_name || exp) + " : " + corps);
      }
      const r = await envoyerLot(abosAcceptees, function(a){ return charges.get(a.player_id); });
      purgeGlobale.aPurger.push(...r.aPurger); purgeGlobale.perimes.push(...r.perimes); purgeGlobale.alertes.push(...r.alertes);
      const annoncees = aAnnoncerAcceptation.filter(function(d){ return r.reussis.has(d.from_id); });
      if (annoncees.length) await modifier(TABLE, annoncees.map(function(d){ return d.id; }),
        { accepted_notified_at: marque }, "acceptations annoncées", dryRun);
      const reportees = aAnnoncerAcceptation.length - annoncees.length;
      if (reportees > 0) log("── " + reportees + " acceptations non annoncées, reportées au prochain sondage.");
    }
  }

  await nettoyer(purgeGlobale, abos, dryRun);
  signalerAlertes(purgeGlobale.alertes);
}

main().catch((e) => { console.error("ÉCHEC : " + (e && e.message ? e.message : e)); process.exit(1); });
