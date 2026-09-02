#!/usr/bin/env node
// TAMPON DE VERSION DU SERVICE WORKER, À CHAQUE BUILD DE PROD.
//
// Le rechargement auto de l'app (voir index.html : controllerchange → reload)
// ne se déclenche QUE si le navigateur détecte un nouveau `sw.js`, c.-à-d. si
// le fichier a changé octet pour octet. Le SW ne met en cache aucun bundle, donc
// son SEUL rôle de version est ce `CACHE_NAME` : s'il ne bouge pas, aucun
// utilisateur en PWA installée ne reçoit la nouvelle version — il reste bloqué
// sur l'ancien code, en silence.
//
// Ça s'est produit : `CACHE_NAME` est resté figé au 15 août alors que plusieurs
// déploiements ont suivi (dont « la devinette rapporte des points »). Résultat :
// les joueurs installés avant continuaient de tourner sur un bundle qui n'envoie
// pas le score — leurs points ne comptaient pas, sans le moindre signe.
//
// Pour que ça ne dépende plus JAMAIS d'un bump manuel oublié, ce script réécrit
// `CACHE_NAME` dans dist/sw.js après le build, avec un identifiant qui change à
// chaque commit (le SHA git ; à défaut, l'horodatage). Idempotent pour un même
// commit — deux builds du même code produisent le même SW.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ici = dirname(fileURLToPath(import.meta.url));
const CHEMIN = join(ici, "..", "dist", "sw.js");

if (!existsSync(CHEMIN)) {
  // Pas de build sous la main (ex. build:dev qui n'écrit pas là) : on ne casse
  // pas la chaîne, on signale juste.
  console.log("bump-sw : dist/sw.js introuvable, ignoré.");
  process.exit(0);
}

// Un identifiant qui change quand le code change. Le SHA du commit est parfait :
// stable pour un même état du dépôt, différent au moindre changement livré.
function version() {
  // Vercel expose le SHA sans .git ; on l'utilise en priorité.
  const env = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA;
  if (env) return env.slice(0, 12);
  try {
    return execSync("git rev-parse --short=12 HEAD", { cwd: join(ici, "..") })
      .toString().trim();
  } catch {
    return String(Date.now()); // dernier recours : toujours unique
  }
}

const jour = new Date().toISOString().slice(0, 10);
const marque = `goatfc-${jour}-${version()}`;

let src = readFileSync(CHEMIN, "utf8");
const avant = src;
src = src.replace(
  /const CACHE_NAME = "[^"]*";/,
  `const CACHE_NAME = "${marque}";`
);

if (src === avant) {
  console.error("bump-sw : ligne CACHE_NAME introuvable dans dist/sw.js — RIEN changé.");
  process.exit(1);
}

writeFileSync(CHEMIN, src);
console.log(`bump-sw : CACHE_NAME → ${marque}`);
