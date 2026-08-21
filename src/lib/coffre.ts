// LE COFFRE — le code de récupération, rangé là où une désinstallation ne
// l'efface pas.
//
// ── LE PROBLÈME, VÉCU PAR SON PROPRE AUTEUR ───────────────────────────────
//
// Le code de récupération vit dans localStorage (`bb_recovery_code`). Or iOS et
// Android EFFACENT tout le stockage local à la désinstallation : localStorage,
// UserDefaults, IndexedDB, tout. Un joueur qui désinstalle puis réinstalle — ou
// qui change de téléphone — perd son code, et avec lui son pseudo, son XP et son
// classement. C'est arrivé pendant la préparation du dépôt Apple, en suivant une
// consigne de désinstallation/réinstallation.
//
// ── LES SEULS MAGASINS QUI SURVIVENT ──────────────────────────────────────
//
//   • iOS : le TROUSSEAU (Keychain). Contrairement au reste, il n'est PAS vidé à
//     la désinstallation, et avec `kSecAttrSynchronizable` il se synchronise via
//     le Trousseau iCloud d'un appareil à l'autre.
//   • Android : le BLOCK STORE des services Google Play, conçu exactement pour
//     ça — restaurer une petite donnée après réinstallation ou sur un nouvel
//     appareil.
//
// Ni l'un ni l'autre ne s'atteint en JavaScript : il faut du Swift et du Kotlin.
// Ce fichier est la façade, le vrai travail est dans le greffon natif `Coffre`
// (ios/App/App/Coffre.swift, android/.../Coffre.java).
//
// ── LA RÈGLE ABSOLUE : NE JAMAIS CASSER L'APP ─────────────────────────────
//
// Tout, ici, retombe en silence sur « rien » :
//
//   • hors coque native (web), le greffon n'existe pas ;
//   • dans la coque, si le greffon n'est pas enregistré, l'appel LÈVE, et on le
//     rattrape ;
//   • si le Trousseau ou le Block Store refuse (iCloud éteint, pas de compte
//     Google, refus utilisateur), on rattrape aussi.
//
// Dans tous ces cas, `lire()` rend null et `sauver()` ne fait rien — et l'app se
// comporte EXACTEMENT comme avant ce fichier : le joueur tape son code à la
// main. Cette fonction ne peut donc qu'AJOUTER une récupération, jamais en
// retirer une.

import { registerPlugin } from "@capacitor/core";
import { Capacitor } from "@capacitor/core";

/** Le contrat du greffon natif. Deux valeurs : le code, et le player_id, pour
 *  restaurer sans un aller-retour serveur de plus si un jour on le veut. */
interface CoffrePlugin {
  sauver(options: { code: string }): Promise<void>;
  lire(): Promise<{ code: string | null }>;
  effacer(): Promise<void>;
}

// registerPlugin ne lève pas ici : il rend un mandataire. C'est l'APPEL d'une
// méthode qui lève, quand aucune implémentation native n'est enregistrée — d'où
// les try/catch sur chaque méthode et non autour de cet appel.
const Coffre = registerPlugin<CoffrePlugin>("Coffre");

const natif = (): boolean => {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
};

/**
 * Range le code dans le coffre de la plateforme. Sans effet et sans bruit hors
 * coque native, ou si le greffon n'est pas là. N'attend RIEN de l'appelant : on
 * l'invoque avec `void`, une sauvegarde qui traîne ne doit rien retarder.
 */
export async function coffreSauver(code: string): Promise<void> {
  if (!natif() || !code) return;
  try { await Coffre.sauver({ code }); } catch { /* pas de coffre : tant pis */ }
}

/**
 * Relit le code rangé, ou null s'il n'y en a pas — ce qui est le cas normal
 * d'un premier lancement, et pas une erreur. Ne lève jamais.
 */
export async function coffreLire(): Promise<string | null> {
  if (!natif()) return null;
  try {
    const r = await Coffre.lire();
    const code = r && typeof r.code === "string" ? r.code.trim().toUpperCase() : "";
    // On revalide la forme AVANT de rendre : un coffre corrompu ou une valeur
    // d'une autre version ne doit pas partir en récupération.
    return /^GOATFC-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code) ? code : null;
  } catch { return null; }
}

/**
 * Vide le coffre. Appelé quand le joueur SUPPRIME son compte : sans ça, la
 * prochaine réinstallation ressusciterait le compte qu'il vient d'effacer.
 */
export async function coffreEffacer(): Promise<void> {
  if (!natif()) return;
  try { await Coffre.effacer(); } catch { /* rien à faire */ }
}
