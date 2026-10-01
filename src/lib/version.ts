// MISE À JOUR OBLIGATOIRE OU CONSEILLÉE DE L'APP NATIVE.
//
// L'app est EMPAQUETÉE (voir capacitor.config.ts) : un correctif du code web n'atteint
// un joueur qu'avec une nouvelle version des stores. Rien ne permettait de demander
// aux anciennes versions de se mettre à jour. Ce module décide, d'après deux seuils
// lus en base, si la version installée doit être mise à jour (ou peut l'être).
//
// ── CE QUE ÇA NE PEUT PAS FAIRE ─────────────────────────────────────────────
// Seules les versions qui contiennent CE code savent se faire bloquer. Les versions
// déjà installées avant lui ne liront jamais ces seuils.
//
// ── POURQUOI LA BASE ET PAS UN FICHIER SUR goatfc.fr ────────────────────────
// La webview de l'app est servie depuis `capacitor://localhost` : lire un fichier
// d'un autre domaine exige des en-têtes CORS que le site statique n'envoie pas.
// Supabase, lui, les envoie, et l'app lui parle déjà.
//
// ── ÉCHEC OUVERT ────────────────────────────────────────────────────────────
// Réseau coupé, table absente, valeur illisible, numéro de version inconnu : on laisse
// jouer. Bloquer un joueur par erreur est pire que de le laisser sur une vieille version.

import { Capacitor } from "@capacitor/core";

export const SB_URL = "https://ialjlsrgcolocoaegzrc.supabase.co";
const SB_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhbGpsc3JnY29sb2NvYWVnenJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MDM3NzksImV4cCI6MjA5MTA3OTc3OX0.-SU8anuPhnpoa-PYhIHQqrcuOBsHxdtBJKRZuiGcGwM";

export const URL_APP_STORE = "https://apps.apple.com/fr/app/goat-fc/id6802330074";
export const URL_PLAY_STORE = "https://play.google.com/store/apps/details?id=fr.goatfc.app";

export type EtatVersion = "ok" | "conseillee" | "obligatoire";
export type Seuils = { obligatoire: number; conseillee: number };

/** Un entier positif, ou 0 pour tout ce qui n'en est pas un (0 = « pas de seuil »). */
export function entierOuZero(v: unknown): number {
  const n = typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? Math.floor(v) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Les seuils d'une plateforme, d'après la ligne `version_min` de bb_config :
 *   { "ios": { "obligatoire": 0, "conseillee": 0 }, "android": { ... } }
 * Tout ce qui est absent ou illisible vaut 0, donc aucun seuil.
 */
export function seuilsDe(valeur: unknown, plateforme: string): Seuils {
  const v = (valeur && typeof valeur === "object" ? (valeur as any)[plateforme] : null) || {};
  return { obligatoire: entierOuZero(v.obligatoire), conseillee: entierOuZero(v.conseillee) };
}

/**
 * Que faut-il dire à une version installée ?
 *
 * `build` est le numéro de build de l'app (CFBundleVersion sur iOS, versionCode sur
 * Android — les workflows de build y mettent le numéro d'exécution). Un build inconnu
 * ou nul ne bloque jamais.
 */
export function etatVersion(build: number, seuils: Seuils): EtatVersion {
  if (!(build > 0)) return "ok";
  if (seuils.obligatoire > 0 && build < seuils.obligatoire) return "obligatoire";
  if (seuils.conseillee > 0 && build < seuils.conseillee) return "conseillee";
  return "ok";
}

/** Le numéro de build installé, ou 0 s'il est illisible. */
export async function lireBuild(): Promise<number> {
  try {
    const { App } = await import("@capacitor/app");
    const info = await App.getInfo();
    return entierOuZero(info.build);
  } catch {
    return 0;
  }
}

/** Lit les seuils dans bb_config. Rend des seuils nuls en cas d'échec (échec ouvert). */
export async function chargerSeuils(): Promise<Seuils> {
  try {
    const r = await fetch(SB_URL + "/rest/v1/bb_config?cle=eq.version_min&select=valeur", {
      headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY },
      cache: "no-store",
    });
    if (!r.ok) return { obligatoire: 0, conseillee: 0 };
    const rows = await r.json();
    const plateforme = Capacitor.getPlatform();
    return seuilsDe(Array.isArray(rows) && rows[0] ? rows[0].valeur : null, plateforme);
  } catch {
    return { obligatoire: 0, conseillee: 0 };
  }
}

/** L'état de CETTE installation. Toujours « ok » hors coque native. */
export async function verifierVersion(): Promise<EtatVersion> {
  if (!Capacitor.isNativePlatform()) return "ok";
  const [build, seuils] = await Promise.all([lireBuild(), chargerSeuils()]);
  return etatVersion(build, seuils);
}
