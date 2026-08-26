// PUBLICITÉS RÉCOMPENSÉES — le joueur les lance, il en tire quelque chose.
//
// C'est le seul format qu'on veut : le joueur clique lui-même sur « regarder une
// pub pour X », voit la vidéo, reçoit X. S'il ferme avant la fin, il n'a rien et
// il n'a rien perdu non plus. Google paie deux à trois fois mieux qu'une
// interstitielle parce que l'attention est volontaire, et aucune règle du Play
// Store ne s'applique à une pub qu'on est allé chercher.
//
// ── CE MODULE NE FAIT RIEN SUR LE WEB, ET C'EST VOULU ─────────────────────
//
// AdMob est un SDK NATIF : il n'existe pas dans un navigateur. Le même bundle
// sert goatfc.fr et la coque Android, donc tout ce qui touche à la pub doit
// passer par `estDisponible()` — qui rend false hors coque. Un bouton « regarder
// une pub » affiché sur le web serait un bouton qui ne fait rien.
//
// ── ON N'ACCORDE LA RÉCOMPENSE QUE SUR L'ÉVÉNEMENT « Rewarded » ───────────
//
// Le plugin émet `Dismissed` quand la pub se ferme, quelle qu'en soit la raison,
// et `Rewarded` seulement quand le joueur est allé au bout. Les deux arrivent, et
// dans cet ordre-là quand tout se passe bien. Accorder sur `Dismissed` reviendrait
// à payer ceux qui ferment au bout d'une seconde — c'est l'erreur classique de
// cette intégration, et elle ne se voit pas en testant soi-même, puisqu'on
// regarde la pub en entier.
//
// ── LE CONSENTEMENT VIENT AVANT LA PREMIÈRE PUB ──────────────────────────
//
// En France, afficher une pub personnalisée sans consentement est illégal, et
// Google refuse de servir sans une CMP. UMP est celle de Google, gratuite, et le
// plugin la porte. `preparer()` demande donc le consentement AVANT de charger
// quoi que ce soit, et s'arrête si `canRequestAds` est faux.

import { Capacitor } from "@capacitor/core";
import {
  AdMob, AdmobConsentStatus, RewardAdPluginEvents,
  type AdMobRewardItem, type RewardAdOptions,
} from "@capacitor-community/admob";

// ── LES IDENTIFIANTS ──────────────────────────────────────────────────────
//
// CEUX-CI SONT LES IDENTIFIANTS DE TEST DE GOOGLE, publics et documentés. Ils
// servent une vraie vidéo, sans jamais facturer un annonceur ni créditer un
// éditeur : c'est avec eux qu'on met au point, et avec eux seulement.
//
// Cliquer sur ses PROPRES vraies publicités, même une seule fois, fait fermer un
// compte AdMob — définitivement, sans appel utile. D'où cette règle : on ne
// remplace ces identifiants qu'au moment de publier, et on ne teste jamais sur
// son téléphone avec les vrais.
//
// https://developers.google.com/admob/android/test-ads
const ID_TEST_RECOMPENSE = {
  android: "ca-app-pub-3940256099942544/5224354917",
  ios: "ca-app-pub-3940256099942544/1712485313",
};

// Les identifiants de l'unité « Récompensée » créée dans AdMob, un par
// plateforme. Ce sont des identifiants de BLOC : ils portent une barre oblique.
// Les confondre avec ceux d'APPLICATION (un tilde) fait planter l'app au
// lancement — src/test/admob.test.ts refuse désormais cette inversion.
//
// Renseigner ces deux champs suffit à faire basculer TOUT le module : enModeTest()
// devient faux, et initialize() part avec initializeForTesting: false. Il n'y a
// pas d'autre interrupteur.
//
// Les vider remet le module en mode test, ce qui reste le bon repli — une erreur
// de configuration ne coûte alors que des pubs non facturées, jamais un compte
// fermé. Mais le test de cohérence exige alors que les quatre emplacements
// repassent en test ensemble.
const ID_REEL_RECOMPENSE = {
  android: "ca-app-pub-4450845101011880/5151840587",
  ios: "ca-app-pub-4450845101011880/9506957915",
};

const estIos = () => Capacitor.getPlatform() === "ios";
const idRecompense = (): string => {
  const reel = estIos() ? ID_REEL_RECOMPENSE.ios : ID_REEL_RECOMPENSE.android;
  return reel || (estIos() ? ID_TEST_RECOMPENSE.ios : ID_TEST_RECOMPENSE.android);
};

/** Vrai quand on tourne dans la coque native ET que la pub peut être servie. */
export const enModeTest = (): boolean =>
  !(estIos() ? ID_REEL_RECOMPENSE.ios : ID_REEL_RECOMPENSE.android);

let demarre = false;
let peutServir = false;
/** Le joueur a-t-il un consentement à reprendre ? Faux hors EEE. */
let optionsDispo = false;
let prete = false;
let enChargement = false;

const natif = (): boolean => {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
};

/**
 * Attend que l'app soit au premier plan (active), condition NÉCESSAIRE pour
 * qu'iOS affiche la fenêtre ATT. Import dynamique : ne s'exécute qu'en natif,
 * jamais sur le web ni dans les tests. Repli de 3 s : on ne bloque jamais
 * l'initialisation de la pub, même si l'événement n'arrive pas.
 */
async function attendreActif(): Promise<void> {
  try {
    const { App: CapApp } = await import("@capacitor/app");
    const etat = await CapApp.getState();
    if (etat.isActive) return;
    await new Promise<void>((resolve) => {
      let fini = false;
      let handle: { remove: () => void } | null = null;
      const done = () => { if (!fini) { fini = true; handle?.remove?.(); resolve(); } };
      void CapApp.addListener("appStateChange", (s: { isActive: boolean }) => {
        if (s.isActive) done();
      }).then((h) => { handle = h; if (fini) h.remove(); });
      setTimeout(done, 3000);
    });
  } catch { /* pas de plugin App, ou web : on n'attend pas */ }
}

/**
 * Démarre le SDK et demande le consentement. À appeler une fois, au lancement,
 * à côté de initNative(). Ne lève jamais : une pub qui ne démarre pas ne doit
 * pas empêcher de jouer.
 */
export async function initPub(): Promise<void> {
  if (!natif() || demarre) return;
  demarre = true;
  try {
    // ── iOS : l'autorisation de suivi se demande AVANT d'initialiser ────────
    //
    // Sans elle, le SDK part sans l'IDFA et ne sert que du non-personnalisé,
    // qui rapporte nettement moins. La demander après l'initialisation ne
    // rattrape pas la première requête de pub, qui est justement celle qu'on
    // préchargera dans la seconde qui suit.
    //
    // Le plugin ne fait rien sur Android, sur le web, et sur iOS 13 et
    // antérieurs : l'appel est donc inconditionnel, et il ne lève pas. Il exige
    // en revanche NSUserTrackingUsageDescription dans Info.plist — sans cette
    // phrase, iOS fait planter l'app au moment d'afficher la fenêtre.
    //
    // Un refus n'est PAS un échec : on continue, avec des pubs moins ciblées.
    // C'est aussi pour ça qu'on ne lit pas le statut derrière — il ne change
    // rien à ce qu'on fait ensuite.
    //
    // ── LA FENÊTRE ATT EXIGE QUE L'APP SOIT ACTIVE ──────────────────────────
    //
    // iOS n'affiche la demande d'autorisation de suivi que si l'app est au
    // PREMIER PLAN et active. Or initPub() part au chargement du module, parfois
    // avant que la coque n'ait fini de passer au premier plan : la demande
    // échouait alors en silence — statut « refusé », aucune fenêtre — ce
    // qu'Apple a signalé (« unable to locate the ATT permission request »). On
    // attend donc l'état actif avant de demander, avec un repli de sécurité
    // pour ne jamais bloquer l'initialisation.
    await attendreActif();
    try { await AdMob.requestTrackingAuthorization(); } catch { /* refus, ou iOS trop ancien */ }

    await AdMob.initialize({ initializeForTesting: enModeTest() });

    // Le formulaire n'est montré QUE s'il est requis : le présenter à quelqu'un
    // qui a déjà répondu, ou qui n'a pas à répondre, est une interruption gratuite.
    let infos = await AdMob.requestConsentInfo();
    if (infos.status === AdmobConsentStatus.REQUIRED && infos.isConsentFormAvailable) {
      infos = await AdMob.showConsentForm();
    }
    // Le joueur est-il dans une zone où le consentement se pose ? REQUIRED avant
    // l'affichage, OBTAINED après : dans les deux cas il a un consentement à
    // reprendre. NOT_REQUIRED — hors EEE — n'a aucune option à gérer, et lui
    // proposer un écran vide serait pire que de ne rien proposer.
    optionsDispo = infos.status === AdmobConsentStatus.REQUIRED
                || infos.status === AdmobConsentStatus.OBTAINED;
    peutServir = infos.canRequestAds !== false;
    if (peutServir) void precharger();
  } catch {
    peutServir = false;
  }
}

/**
 * Vrai quand il y a un consentement à reprendre, donc quand il faut proposer
 * l'entrée « Confidentialité et publicité » dans l'écran Compte.
 */
export const confidentialiteReprenable = (): boolean => natif() && optionsDispo;

/**
 * ── LE LIEN DE RÉVOCATION, QU'EXIGE LE RGPD ET QUE LA BANNIÈRE PROMET ──────
 *
 * Un consentement doit pouvoir être retiré aussi facilement qu'il a été donné.
 * Ce n'est pas une lecture militante du texte : le formulaire de Google le dit
 * lui-même au joueur, en toutes lettres — « Look for a link or button in the app
 * menu to manage or withdraw consent in privacy and cookie settings ». Sans
 * cette entrée, la bannière promettait quelque chose qui n'existait pas, et
 * l'écran de publication de la console AdMob le rappelle à chaque message publié.
 *
 * `showPrivacyOptionsForm()` affiche l'écran d'options rendu depuis la même
 * configuration RGPD que la bannière : il n'y a donc rien à dessiner ici, et rien
 * qui puisse diverger de ce que le joueur a vu au premier lancement.
 *
 * Rend faux si l'écran n'a pas pu s'ouvrir, pour que l'appelant le dise plutôt
 * que de laisser un bouton sans effet.
 */
export async function ouvrirConfidentialite(): Promise<boolean> {
  if (!natif()) return false;
  try {
    await AdMob.showPrivacyOptionsForm();
    return true;
  } catch {
    return false;
  }
}

/**
 * Charge une pub à l'avance. Une pub demandée au moment du clic met plusieurs
 * secondes à arriver : le joueur voit un bouton qui ne répond pas et le
 * reclique. On la tient donc prête, et on en recharge une après chaque passage.
 */
async function precharger(): Promise<void> {
  if (!natif() || !peutServir || prete || enChargement) return;
  enChargement = true;
  try {
    const options: RewardAdOptions = { adId: idRecompense() };
    await AdMob.prepareRewardVideoAd(options);
    prete = true;
  } catch {
    prete = false;
  } finally {
    enChargement = false;
  }
}

/**
 * Vrai quand une pub est chargée et peut être montrée tout de suite. C'est ce
 * qui doit conditionner l'AFFICHAGE du bouton : proposer une récompense qu'on ne
 * peut pas servir déçoit plus que ne pas la proposer.
 */
export const estDisponible = (): boolean => natif() && peutServir && prete;

/**
 * Montre la pub et rend VRAI si le joueur est allé au bout. Rend faux dans tous
 * les autres cas — hors coque, pub non chargée, fermeture anticipée, erreur.
 *
 * L'appelant n'a donc qu'une chose à faire : accorder la récompense si c'est
 * vrai. Il n'a pas à connaître AdMob, ni à distinguer « fermée » de « échouée ».
 */
export async function montrerRecompensee(): Promise<boolean> {
  if (!estDisponible()) return false;
  prete = false;

  let gagne = false;
  const surRecompense = await AdMob.addListener(
    RewardAdPluginEvents.Rewarded,
    (_item: AdMobRewardItem) => { gagne = true; },
  );
  try {
    await AdMob.showRewardVideoAd();
  } catch {
    gagne = false;
  } finally {
    try { await surRecompense.remove(); } catch { /* rien à faire */ }
    // La suivante se charge tout de suite : le joueur qui a accepté une fois
    // acceptera souvent la fois d'après.
    void precharger();
  }
  return gagne;
}
