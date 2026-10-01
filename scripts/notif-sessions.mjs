#!/usr/bin/env node
// ENVOI du rappel « GOAT SESSION ce soir » : une notification, une fois, à tous les abonnés,
// dans les 40 dernières minutes avant le départ d'une session.
//
//     npx tsx scripts/notif-sessions.mjs [--dry-run]
//
// ── UNE SEULE FOIS, MÊME SI LE DÉCLENCHEUR PASSE DEUX FOIS ─────────────────
// La session est « réclamée » par un UPDATE conditionnel (`rappel_envoye_le is null`) AVANT
// l'envoi : seul l'exécution qui obtient la ligne envoie. Deux passages simultanés ne
// préviennent donc pas deux fois.
//
// ── LE RETARD DE GITHUB, ET CE QU'ON EN FAIT ────────────────────────────────
// Les déclencheurs planifiés peuvent arriver bien après l'heure. Le workflow repasse toutes
// les 10 minutes autour des créneaux, et un rappel qui arriverait après le départ n'est jamais
// envoyé (voir sessionsARappeler). Le message dit combien de minutes il reste AU MOMENT de
// l'envoi, pas une heure figée.
//
// ── CE QUE ÇA NE COUVRE PAS ─────────────────────────────────────────────────
// Seuls les abonnements Web Push (navigateur / application web installée) reçoivent la
// notification. L'app native n'a pas de plugin de push : ses joueurs n'en reçoivent aucune.
//
// Secrets : SB_SERVICE_KEY, VAPID_PRIVATE_KEY.

import { sessionsARappeler, accrocheSession } from "../src/lib/push.js";
import { preparer, lireTout, lireAbonnements, envoyerLot, nettoyer, signalerAlertes, log,
         SB_URL, SERVICE_KEY } from "./push-io.mjs";

const CIBLE = "https://goatfc.fr/?play=session&utm_source=push&utm_medium=notif&utm_campaign=session";
const dryRun = process.argv.slice(2).includes("--dry-run");

const entetes = (extra) => Object.assign({ apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY }, extra || {});

/** Marque la session comme rappelée. Rend true seulement pour l'exécution qui l'a obtenue. */
async function reclamer(id) {
  const r = await fetch(SB_URL + "/rest/v1/bb_sessions?id=eq." + id + "&rappel_envoye_le=is.null", {
    method: "PATCH",
    headers: entetes({ "Content-Type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify({ rappel_envoye_le: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error("réclamation de la session : HTTP " + r.status + " " + (await r.text()).slice(0, 200));
  const lignes = await r.json();
  return Array.isArray(lignes) && lignes.length === 1;
}

async function main() {
  log("── Rappel GOAT SESSION" + (dryRun ? "  [À BLANC]" : ""));
  preparer({ signature: !dryRun });

  const depuis = new Date(Date.now() - 3600000).toISOString();
  const sessions = await lireTout("bb_sessions",
    "select=id,mode,starts_at,statut,rappel_envoye_le&statut=eq.ouvert&starts_at=gte." + encodeURIComponent(depuis)
    + "&order=starts_at.asc,id.asc");
  const aRappeler = sessionsARappeler(sessions, Date.now());
  log("── " + sessions.length + " session(s) ouverte(s) à venir, " + aRappeler.length + " à rappeler maintenant");
  if (!aRappeler.length) { log("Rien à envoyer."); return; }

  const abos = await lireAbonnements(null);
  log("── " + abos.garder.length + " appareils abonnés");

  for (const s of aRappeler) {
    const { titre, corps } = accrocheSession(s, Date.now());
    log("   → " + s.id + " : " + titre + " / " + corps);
    if (dryRun) { log("   (à blanc) " + abos.garder.length + " envois simulés, la session n'est PAS marquée."); continue; }
    if (!(await reclamer(s.id))) { log("   (déjà rappelée par une autre exécution)"); continue; }
    if (!abos.garder.length) { log("   Aucun abonné : rien à envoyer."); continue; }
    const charge = JSON.stringify({ title: titre, body: corps, url: CIBLE, tag: "goatfc-session-" + s.id, icon: "/icon-192.png" });
    const resultat = await envoyerLot(abos.garder, function(){ return charge; });
    await nettoyer(resultat, abos, dryRun);
    signalerAlertes(resultat.alertes);
  }
}

main().catch((e) => { console.error("ÉCHEC : " + (e && e.message ? e.message : e)); process.exit(1); });
