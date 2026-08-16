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

// À remplacer par les identifiants de l'unité « Récompensée » créée dans AdMob.
// Laissés vides, le module reste en mode test — ce qui est le bon défaut : une
// erreur de configuration ne coûte alors que des pubs non facturées, jamais un
// compte fermé.
const ID_REEL_RECOMPENSE = {
  android: "",
  ios: "",
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
let prete = false;
let enChargement = false;

const natif = (): boolean => {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
};

/**
 * Démarre le SDK et demande le consentement. À appeler une fois, au lancement,
 * à côté de initNative(). Ne lève jamais : une pub qui ne démarre pas ne doit
 * pas empêcher de jouer.
 */
export async function initPub(): Promise<void> {
  if (!natif() || demarre) return;
  demarre = true;
  try {
    await AdMob.initialize({ initializeForTesting: enModeTest() });

    // Le formulaire n'est montré QUE s'il est requis : le présenter à quelqu'un
    // qui a déjà répondu, ou qui n'a pas à répondre, est une interruption gratuite.
    let infos = await AdMob.requestConsentInfo();
    if (infos.status === AdmobConsentStatus.REQUIRED && infos.isConsentFormAvailable) {
      infos = await AdMob.showConsentForm();
    }
    peutServir = infos.canRequestAds !== false;
    if (peutServir) void precharger();
  } catch {
    peutServir = false;
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
