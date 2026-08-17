// Intégrations natives (Capacitor) — actives uniquement dans la coque iOS/Android.
// Sur le web, TOUT est no-op : les helpers vérifient Capacitor.isNativePlatform()
// et n'ont aucun effet dans le navigateur. Objectif : donner à l'app un vrai
// comportement natif (barre de statut, splash, retour haptique) — nécessaire
// pour passer la règle Apple 4.2 (« Minimum Functionality »).

import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { App } from "@capacitor/app";

export const isNative = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

// À appeler une fois au démarrage de l'app (depuis main.tsx).
export async function initNative(): Promise<void> {
  if (!isNative()) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    // ── overlay:false — LA PAGE S'ARRÊTE SOUS L'HORLOGE, ET C'EST VOULU ──────
    //
    // En superposition (`true`), la vue web couvre l'écran entier, barre d'état
    // comprise. Pour que le contenu ne passe pas DERRIÈRE l'heure, il faut
    // ensuite le décaler — ce que la charte fait avec
    // `env(safe-area-inset-top)`. Sauf que ces env() valent 0 : la balise
    // viewport est posée sans `viewport-fit=cover`, et la remettre créerait 60 px
    // de défilement parasite sur huit écrans (mesuré, cf. le commentaire dans
    // src/components/LePont.jsx).
    //
    // Résultat sur iPhone : vue web plein écran, aucun décalage, et le
    // `contentInset` de WKWebView qui décalait le contenu à sa place — d'où deux
    // bandes d'or inertes en haut et en bas, l'app qui « ne remplissait pas
    // l'écran » alors que la même page installée depuis goatfc.fr le remplissait.
    //
    // `false` donne exactement la géométrie de cette PWA : la vue web occupe la
    // zone sûre, `100dvh` vaut donc la hauteur réellement disponible, et les huit
    // écrans en `height:100dvh` tombent juste sans rien décaler. La barre d'état
    // est peinte par le fond natif, déjà réglé sur l'or de la charte dans
    // capacitor.config.ts.
    try { await StatusBar.setOverlaysWebView({ overlay: false }); } catch {}
  } catch {}
  try {
    // Bouton retour matériel (Android) : ne pas quitter l'app par accident.
    App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) window.history.back();
    });
  } catch {}
}

/**
 * Efface l'écran de lancement natif. À appeler quand le jeu est MONTÉ et peint,
 * pas depuis initNative() : initNative tourne avant createRoot().render(), donc
 * tout délai posé ici serait une devinette sur le temps de premier affichage.
 *
 * C'était un setTimeout de 400 ms. Il tenait parce qu'une affiche plein écran
 * dans l'app couvrait les 2 500 ms suivantes ; cette affiche a été retirée, et
 * un splash qui s'efface avant le premier rendu laisserait un écran or vide.
 *
 * Le filet de sécurité reste dans capacitor.config.ts : `launchShowDuration`
 * masque le splash de toute façon passé ce délai. Un appel manquant ou une
 * erreur JS au démarrage ne peut donc pas bloquer l'app sur son écran de
 * lancement — ce qui est exactement ce que produirait `launchAutoHide: false`.
 */
export function masquerSplashNatif(): void {
  if (!isNative()) return;
  SplashScreen.hide().catch(() => {});
}

// ── Retour haptique (no-op sur web) ──
export function hapticSuccess(): void {
  if (!isNative()) return;
  Haptics.notification({ type: NotificationType.Success }).catch(() => {});
}
export function hapticError(): void {
  if (!isNative()) return;
  Haptics.notification({ type: NotificationType.Error }).catch(() => {});
}
export function hapticLight(): void {
  if (!isNative()) return;
  Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}
export function hapticMedium(): void {
  if (!isNative()) return;
  Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
}
export function hapticHeavy(): void {
  if (!isNative()) return;
  Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
}
