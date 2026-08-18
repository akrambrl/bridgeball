#!/usr/bin/env node
// FABRIQUE public/donnees/joueurs.json DEPUIS src/players.jsx
//
//     npm run donnees          (lancé aussi par npm run build)
//
// ── POURQUOI SORTIR LES DONNÉES DU PAQUET JS ───────────────────────────────
//
// `src/players.jsx` était importé par LePont.jsx, FindPlayer.tsx et
// GoatGuess.tsx, donc empaqueté dans le JS : 1008 Ko de source dans un bundle
// de 2,1 Mo. Deux conséquences, et la seconde est la vraie :
//
//   • le JS doit être ANALYSÉ ET COMPILÉ au démarrage, alors qu'un JSON n'est
//     que lu. À taille égale, le JSON coûte bien moins cher à l'ouverture ;
//
//   • surtout, une correction de transfert exigeait une REVUE APPLE. Les données
//     voyageant dans le binaire, corriger le parcours d'un joueur voulait dire un
//     nouveau build, une soumission, et 24 à 48 h d'attente. Servies en fichier,
//     elles se corrigent en cinq minutes, sur iOS comme sur Android.
//
// ── LE FORMAT EST COLONNAIRE, ET CE N'EST PAS DE LA COQUETTERIE ────────────
//
// Les 5 625 joueurs ont tous les mêmes six clés. Un JSON naïf répète donc
// « name », « clubs », « nationalities »… 5 625 fois. Mesuré :
//
//     source players.jsx    1008 Ko
//     JSON naïf              982 Ko   (gzip 179 Ko)
//     JSON colonnaire        644 Ko   (gzip 163 Ko)   ← retenu
//
// 338 Ko gagnés pour une boucle de reconstruction de dix lignes. Et surtout, le
// colonnaire passe SOUS le plafond de 1 Mo par fichier que src/test/images.test.ts
// impose déjà à public/ — le format naïf l'aurait fait échouer, ce qui aurait été
// une bonne raison de plus de le refuser.
//
// ── LA SOURCE DE VÉRITÉ RESTE src/players.jsx ─────────────────────────────
//
// Ce fichier-ci produit un ARTEFACT, il ne le remplace pas. Onze scripts du dépôt
// lisent players.jsx — transferts, audit-fiches, mercato-diff… — et continuent de
// le faire. C'est src/test/donnees.test.ts qui interdit à l'artefact de dériver de
// sa source : il regénère et compare.
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PLAYERS, RETIRED_PLAYERS, GG_SHIRT_10, GG_WC_WINNERS,
  GG_CL_WINNERS, GG_BALLON_DOR, GG_BALLON_DOR_MULTI,
} from "../src/players.jsx";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
export const CHEMIN = join(racine, "public", "donnees", "joueurs.json");

/**
 * Le JSON, construit de façon DÉTERMINISTE : mêmes entrées, même octet. C'est ce
 * qui permet au test de comparer par empreinte plutôt que de tout relire.
 *
 * Les clés sont triées, et non prises dans l'ordre de rencontre : l'ordre des
 * clés d'un objet JavaScript dépend de l'ordre d'écriture dans players.jsx, donc
 * réordonner un champ sur une seule fiche changerait tout le fichier.
 */
export function construire() {
  const clesVues = new Set();
  for (const p of PLAYERS) for (const k of Object.keys(p)) clesVues.add(k);
  const cles = [...clesVues].sort();

  return JSON.stringify({
    // `v` est la version du FORMAT, pas des données : elle sert au chargeur à
    // refuser un fichier qu'il ne sait pas lire, plutôt qu'à le mal lire.
    v: 1,
    cles,
    // `undefined` deviendrait `null` dans un tableau JSON de toute façon ; on
    // l'écrit explicitement pour que le chargeur puisse distinguer « absent » de
    // « présent et vide », et ne pose pas de clé qui n'existait pas.
    joueurs: PLAYERS.map((p) => cles.map((k) => (p[k] === undefined ? null : p[k]))),
    RETIRED_PLAYERS: [...RETIRED_PLAYERS],
    GG_SHIRT_10: [...GG_SHIRT_10],
    GG_WC_WINNERS: [...GG_WC_WINNERS],
    GG_CL_WINNERS: [...GG_CL_WINNERS],
    GG_BALLON_DOR: [...GG_BALLON_DOR],
    GG_BALLON_DOR_MULTI: [...GG_BALLON_DOR_MULTI],
  });
}

export const empreinte = (txt) => createHash("sha256").update(txt).digest("hex").slice(0, 16);

// Lancé directement — et pas seulement importé par le test.
if (process.argv[1] && process.argv[1].endsWith("donnees-json.mjs")) {
  const txt = construire();
  const avant = existsSync(CHEMIN) ? readFileSync(CHEMIN, "utf8") : "";
  mkdirSync(dirname(CHEMIN), { recursive: true });
  writeFileSync(CHEMIN, txt);
  const ko = Math.round(Buffer.byteLength(txt) / 1024);
  console.log(`public/donnees/joueurs.json  ${PLAYERS.length} joueurs · ${ko} Ko · ${empreinte(txt)}`);
  if (avant && avant !== txt) console.log("  (le fichier a changé)");
  else if (avant) console.log("  (inchangé)");
}
