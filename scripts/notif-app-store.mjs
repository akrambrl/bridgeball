#!/usr/bin/env node
// ENVOI UNIQUE : « GOAT FC est sur l'App Store / sur Google Play ».
//
//     npx tsx scripts/notif-app-store.mjs --dry-run     # simule, n'envoie rien
//     npx tsx scripts/notif-app-store.mjs               # envoie
//
// Secrets attendus : SB_SERVICE_KEY, VAPID_PRIVATE_KEY. Le circuit lui-même vit
// dans scripts/push-io.mjs et n'est pas retouché ici — ce fichier n'ajoute que le
// CIBLAGE et le texte.
//
// ── QUI LA REÇOIT ──────────────────────────────────────────────────────────
//
// Les abonnements de bb_push_subscriptions sont des abonnements WEB PUSH : ils
// viennent donc de joueurs sur la PWA ou dans un navigateur, c'est-à-dire
// exactement ceux qu'on veut faire passer sur l'app native. Rien à exclure côté
// « déjà sur l'app ».
//
// Le message change d'un store à l'autre, et se tromper de côté envoie « sur
// l'App Store » à quelqu'un qui n'a pas d'iPhone. Le tri suit donc le SERVICE de
// push (un fait) et non `platform` (une déclaration) — voir ciblerParStore dans
// src/lib/push.js, éprouvée par src/test/push.test.ts. Les navigateurs de PC sont
// écartés : il n'y a pas de fiche de store à leur ouvrir.
//
// ── POURQUOI LA NOTIFICATION N'OUVRE PAS LE STORE DIRECTEMENT ──────────────
//
// public/sw.js fait `client.navigate(url)` quand l'app est déjà ouverte, et un
// navigateur refuse de naviguer hors de l'origine : le clic n'aurait alors rien
// fait. La notification ouvre donc goatfc.fr, où le bandeau doré d'installation
// (installBanner, LePont.jsx) mène au bon store en un appui.
//
// ── ET ELLE NE SONNE QU'UNE FOIS ────────────────────────────────────────────
//
// Rien ne mémorise qui a déjà été prévenu. Le tag est fixe, donc un second
// lancement REMPLACE la notification sur l'appareil au lieu de s'y empiler, mais
// il re-sonne. À ne relancer que si le premier envoi a échoué.

import { ciblerParStore } from "../src/lib/push.js";
import { preparer, lireAbonnements, envoyerLot, nettoyer, signalerAlertes, journalAbonnes, log } from "./push-io.mjs";

// La page d'accueil, avec un paramètre utm pour distinguer cette campagne dans
// le suivi.
const CIBLE = "https://goatfc.fr/?utm_source=push&utm_medium=notif&utm_campaign=app-store";

const MESSAGES = {
  ios: {
    title: "📲 GOAT FC est sur l'App Store",
    body: "Plus fluide, et les notifications de GOAT SESSION y sont fiables. Passe sur l'app.",
  },
  android: {
    title: "📲 GOAT FC est sur Google Play",
    body: "Plus fluide, et les notifications de GOAT SESSION y sont fiables. Passe sur l'app.",
  },
};

// Tag FIXE : voir l'avertissement en tête de fichier.
const TAG = "app-store";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

async function main() {
  log("── Notification « l'app est sur le store »" + (dryRun ? "  [À BLANC]" : ""));
  log("   iPhone  : " + MESSAGES.ios.title + " — " + MESSAGES.ios.body);
  log("   Android : " + MESSAGES.android.title + " — " + MESSAGES.android.body);

  preparer({ signature: !dryRun });

  const abos = await lireAbonnements(null);
  log("── " + abos.brut + " lignes en base → " + abos.garder.length + " abonnés uniques"
    + (abos.doublons.length ? ", " + abos.doublons.length + " doublons" : "")
    + (abos.inutilisables.length ? ", " + abos.inutilisables.length + " inutilisables" : ""));

  const { ios, android, ecartes } = ciblerParStore(abos.garder);
  log("── Ciblage : " + ios.length + " iPhone, " + android.length + " Android, "
    + ecartes.length + " écarté(s) (PC ou endpoint illisible)");
  journalAbonnes(ios.concat(android));

  const cibles = ios.concat(android);
  if (!cibles.length) {
    log("Aucun abonné à prévenir : rien à envoyer.");
    return;
  }

  if (dryRun) {
    log("── À BLANC : " + cibles.length + " envoi(s) simulé(s), rien n'est parti.");
    return;
  }

  const estIos = new Set(ios.map(function (a) { return a.endpoint; }));
  const resultat = await envoyerLot(cibles, function (a) {
    const m = estIos.has(a.endpoint) ? MESSAGES.ios : MESSAGES.android;
    return JSON.stringify({ title: m.title, body: m.body, url: CIBLE, tag: TAG, icon: "/icon-192.png" });
  });
  // On ne nettoie QUE d'après les abonnements réellement sollicités : les
  // abonnements écartés (PC) n'ont pas été testés par cet envoi et ne doivent
  // surtout pas être jugés dessus.
  await nettoyer(resultat, abos, dryRun);
  signalerAlertes(resultat.alertes);
}

main().catch((e) => { console.error("ÉCHEC : " + (e && e.message ? e.message : e)); process.exit(1); });
