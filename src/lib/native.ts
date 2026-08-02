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
    // Barre de statut : texte clair sur fond sombre, en superposition.
    await StatusBar.setStyle({ style: Style.Dark });
    try { await StatusBar.setOverlaysWebView({ overlay: true }); } catch {}
  } catch {}
  try {
    // On masque le splash une fois l'app prête (petit délai pour éviter le flash).
    setTimeout(() => { SplashScreen.hide().catch(() => {}); }, 400);
  } catch {}
  try {
    // Bouton retour matériel (Android) : ne pas quitter l'app par accident.
    App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) window.history.back();
    });
  } catch {}
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
