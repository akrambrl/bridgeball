#!/usr/bin/env node
// ENVOI UNIQUE : « je cherche 12 testeurs Android pour la sortie Play Store ».
//
//     npx tsx scripts/notif-testeurs.mjs --dry-run     # simule, n'envoie rien
//     npx tsx scripts/notif-testeurs.mjs               # envoie
//
// Secrets attendus : SB_SERVICE_KEY, VAPID_PRIVATE_KEY. Le circuit lui-même vit
// dans scripts/push-io.mjs, et il n'est pas retouché ici — ce fichier n'ajoute
// que le CIBLAGE et le texte.
//
// ── CE QUE CET ENVOI PEUT ET NE PEUT PAS FAIRE ─────────────────────────────
//
// Il ne recrutera pas douze personnes, et il ne faut pas compter dessus. Le
// dernier envoi réel a touché SIX appareils sur treize abonnements — les sept
// autres étaient des jetons signés par une ancienne clé VAPID. Presque aucun
// joueur n'a accepté les notifications, alors que 90 appareils Android ouvrent
// l'app chaque semaine. Le canal qui porte est le message direct ; les messages
// sont dans docs/recrutement-testeurs.md. Celui-ci est un complément, envoyé
// parce qu'il coûte une minute, pas parce qu'il suffit.
//
// ── POURQUOI ON EXCLUT iOS, ET COMMENT ─────────────────────────────────────
//
// Un test fermé Play ne concerne QUE Android. Envoyer cette demande à un joueur
// iPhone, c'est lui promettre quelque chose qu'il ne peut pas faire — le pire
// usage possible d'une permission de notification, qui ne se redemande pas une
// fois refusée.
//
// Le tri se fait sur DEUX signaux, et l'ordre compte :
//
//  1. LE SERVICE DE PUSH, qui est un fait : un endpoint chez web.push.apple.com
//     est un appareil Apple, sans discussion possible. C'est le filtre dur.
//  2. `platform`, qui est une DÉCLARATION de l'app d'après l'agent utilisateur.
//     Utile, mais pas une preuve — d'où son rôle secondaire.
//
// Un abonnement dont le service est Apple est écarté même si `platform` dit
// « android ». L'inverse — service Google, platform « ios » — est gardé et
// signalé : c'est vraisemblablement un Chrome sur Android mal détecté, et le
// service, lui, ne se trompe pas.
//
// Les abonnements « desktop » sont GARDÉS. Un joueur sur Chrome PC a très
// probablement un téléphone Android dans la poche, et c'est justement quelqu'un
// qui joue assez pour avoir accepté les notifications.

// Le ciblage vit dans src/lib/push.js, avec le reste de la logique de push, et
// il est couvert par src/test/push.test.ts. Il ne peut pas vivre ici : ce script
// a besoin de SB_SERVICE_KEY pour tourner, donc rien de ce qu'il contient ne
// serait éprouvé par les tests — et la règle qui décide qui reçoit un message
// est exactement ce qu'il faut éprouver.
import { ciblerAndroid } from "../src/lib/push.js";
import { preparer, lireAbonnements, envoyerLot, nettoyer, signalerAlertes, journalAbonnes, log } from "./push-io.mjs";

// La page d'accueil et non un mode : la notification ne promet pas une partie,
// elle ouvre une conversation. Le paramètre utm distingue cette campagne des
// autres dans le suivi.
const CIBLE = "https://goatfc.fr/?utm_source=push&utm_medium=notif&utm_campaign=testeurs-android";

// Le titre est tronqué vers 40 caractères sur Android : la promesse doit tenir
// avant la coupe. « GOAT FC arrive sur Android » fait 26 caractères hors emoji.
const TITRE = "📱 GOAT FC arrive sur Android";
const CORPS = "Il me faut 12 testeurs pour valider la sortie. Tu joues déjà — 2 min pour m'aider ?";

// Un tag FIXE, et c'est volontaire. Le tag est la clé de remplacement côté
// appareil : si l'envoi est relancé par erreur, la notification REMPLACE la
// précédente au lieu de s'empiler. Ça ne rend pas le script idempotent — un
// second lancement re-sonne — mais ça borne les dégâts à une répétition, pas à
// une pile. Voir l'avertissement du workflow.
const TAG = "testeurs-android";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

async function main() {
  log("── Notification « recherche de testeurs »" + (dryRun ? "  [À BLANC]" : ""));
  log("   titre : " + TITRE);
  log("   corps : " + CORPS);

  preparer({ signature: !dryRun });

  const abos = await lireAbonnements(null);
  log("── " + abos.brut + " lignes en base → " + abos.garder.length + " abonnés uniques"
    + (abos.doublons.length ? ", " + abos.doublons.length + " doublons" : "")
    + (abos.inutilisables.length ? ", " + abos.inutilisables.length + " inutilisables" : ""));

  // ── LE CIBLAGE ────────────────────────────────────────────────────────────
  const { cibles, apple, desaccords } = ciblerAndroid(abos.garder);

  log("── Ciblage : " + cibles.length + " abonné(s) retenu(s), " + apple.length + " écarté(s) (service Apple)");
  if (desaccords.length) {
    log("   " + desaccords.length + " abonnement(s) déclarés « ios » mais servis par Google :"
      + " gardés, le service prime sur la déclaration de l'app.");
  }
  // Le détail par service, toujours : c'est lui qui explique un échec en masse.
  journalAbonnes(cibles);

  if (!cibles.length) {
    log("Aucun abonné Android : rien à envoyer.");
    log("Les 90 appareils Android de bb_presence n'ont pas accepté les notifications —"
      + " passe par les messages de docs/recrutement-testeurs.md.");
    return;
  }

  const charge = JSON.stringify({
    title: TITRE, body: CORPS, url: CIBLE, tag: TAG, icon: "/icon-192.png",
  });

  if (dryRun) {
    log("── À BLANC : " + cibles.length + " envoi(s) simulé(s), rien n'est parti.");
    return;
  }

  const resultat = await envoyerLot(cibles, function () { return charge; });
  // On ne nettoie QUE d'après les abonnements qu'on a réellement sollicités : les
  // doublons et les lignes sans clés de chiffrement viennent du dédoublonnage et
  // restent purgeables, mais les abonnements Apple n'ont pas été testés par cet
  // envoi et ne doivent surtout pas être jugés dessus.
  await nettoyer(resultat, abos, dryRun);
  signalerAlertes(resultat.alertes);
  log("── Rappel : ce canal est un complément. Les messages directs sont dans"
    + " docs/recrutement-testeurs.md, et c'est eux qui trouveront les 12.");
}

main().catch((e) => { console.error("ÉCHEC : " + (e && e.message ? e.message : e)); process.exit(1); });
