#!/usr/bin/env node
// AUDITE les pseudos DÉJÀ en base contre la liste de modération.
//
//     node scripts/audit-pseudos.mjs
//
// Le trigger de `docs/supabase-pseudos-interdits.sql` ne regarde que les
// écritures : les pseudos posés AVANT lui restent en place, et il n'y a aucune
// raison de croire qu'ils sont tous propres. Ce script les relit et applique la
// même règle que le client.
//
// LECTURE SEULE. Il ne renomme rien, exprès : le renommage demande d'écrire dans
// `bb_pseudos` pour le compte d'un autre joueur, ce que la clé publique ne peut
// pas faire — et ce qui, avec la clé de service, mérite d'être fait à la main en
// regardant chaque cas. La sortie est la liste des pseudos à traiter, avec le
// motif ; la décision reste humaine.
//
// La clé lue est la clé ANONYME, celle qui est déjà dans le bundle de l'app. La
// clé `service_role` n'a rien à faire ici, ni dans aucun script du dépôt.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, "..");

// Le module de modération est en TypeScript : plutôt qu'un transpileur, on le
// relit comme du texte et on réutilise le générateur SQL... non. On importe la
// logique en la réimplémentant ? Non plus : DEUX implémentations divergent.
// On passe donc par le compilateur de Vite via une extraction minimale — voir
// plus bas : le fichier ne contient que des `const` et des fonctions pures, donc
// un simple retrait des annotations de type suffit et reste vérifiable.
const ts = await readFile(join(racine, "src", "lib", "pseudo.ts"), "utf8");
const js = ts
  .replace(/^export type[^\n]*\n/gm, "")
  .replace(/^export interface[\s\S]*?^}\n/gm, "")
  .replace(/: Record<[^>]+>/g, "")
  .replace(/: MotifRefus\[\]/g, "")
  .replace(/: MotifRefus \| null/g, "")
  .replace(/: string\[\]/g, "")
  .replace(/\(([a-zA-Z]+): string\)/g, "($1)")
  .replace(/\bas any\b/g, "")
  .replace(/new Map<string, string\[\]>\(\)/g, "new Map()")
  .replace(/new Set<string>\(\)/g, "new Set()");
const mod = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const { pseudoInterdit } = mod;
if (typeof pseudoInterdit !== "function") throw new Error("pseudoInterdit introuvable après extraction");
// Garde-fou : si l'extraction avait cassé la logique, ces deux appels le disent
// tout de suite plutôt que de rendre un audit faussement rassurant.
if (pseudoInterdit("H1tl3r") !== "haine") throw new Error("extraction cassée : H1tl3r devrait tomber");
if (pseudoInterdit("Nigeria") !== null) throw new Error("extraction cassée : Nigeria ne devrait pas tomber");

const composant = await readFile(join(racine, "src", "components", "LePont.jsx"), "utf8");
const SB_URL = composant.match(/const SB_URL = "([^"]+)"/)[1];
const SB_KEY = composant.match(/const SB_KEY = "([^"]+)"/)[1];

const entetes = { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY };

// Pagination : PostgREST plafonne à 1000 lignes par requête, et lire la première
// page en croyant avoir tout est une façon classique de rater les cas.
const pseudos = [];
for (let debut = 0; ; debut += 1000) {
  const r = await fetch(SB_URL + "/rest/v1/bb_pseudos?select=player_id,pseudo&order=pseudo",
    { headers: { ...entetes, Range: debut + "-" + (debut + 999) } });
  if (!r.ok) {
    console.error("lecture refusée : HTTP " + r.status + " " + (await r.text()).slice(0, 200));
    process.exit(1);
  }
  const page = await r.json();
  pseudos.push(...page);
  if (page.length < 1000) break;
}

const fautifs = pseudos
  .map((p) => ({ ...p, motif: pseudoInterdit(p.pseudo || "") }))
  .filter((p) => p.motif);

// Le format aussi : la base ne l'imposait pas avant le trigger, donc un pseudo
// hors gabarit (trop long, accentué, homoglyphe cyrillique) peut déjà y être.
const horsFormat = pseudos.filter((p) => !/^[a-zA-Z0-9_-]{3,12}$/.test(p.pseudo || ""));

console.log(pseudos.length + " pseudos lus");
if (!fautifs.length && !horsFormat.length) {
  console.log("aucun pseudo à traiter ✅");
} else {
  for (const f of fautifs) console.log("  " + f.motif.padEnd(11) + f.pseudo + "   (" + f.player_id + ")");
  for (const f of horsFormat) console.log("  " + "format".padEnd(11) + JSON.stringify(f.pseudo) + "   (" + f.player_id + ")");
  console.log("\n" + (fautifs.length + horsFormat.length) + " à traiter — renommage à faire à la main "
    + "depuis le tableau de bord Supabase.");
}
