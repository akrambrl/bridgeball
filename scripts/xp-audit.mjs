// Vérifie que l'XP stockée dans bb_pseudos est cohérente avec les parties jouées.
//
//     node scripts/xp-audit.mjs              # lecture seule, affiche le tableau
//     node scripts/xp-audit.mjs --reparer    # remonte les comptes sous-évalués
//
// Pourquoi ce script existe
// -------------------------
// Le champion de juillet, thibault, affichait 5 065 XP alors que bb_seasons
// gardait la trace d'une saison à 33 700. La cause est corrigée dans addXp
// (LePont.jsx) : le cumul était calculé depuis l'état React puis écrit tel quel,
// donc un état local à 0 remplaçait le total stocké par « 0 + gain ». Le correctif
// arrête l'hémorragie mais ne rend pas l'XP déjà perdue — c'est le rôle de ce
// script.
//
// Comment on reconstruit un total
// -------------------------------
// addXp n'est appelé qu'à la fin d'une partie de « pont » et d'une partie de
// « chaine », avec exactement le score que submitToLeaderboard écrit dans
// bb_scores juste avant. La somme des scores positifs de ces deux modes est donc
// l'XP que le joueur a gagnée. Le mode « findscore » (Trouve le joueur) écrit
// dans bb_scores mais ne donne pas d'XP : il est exclu.
//
// Cette somme est un PLANCHER, pas une valeur exacte : une trentaine de comptes
// ont plus d'XP que leurs parties n'en justifient, par multiples de 500 (18 à
// +1000 exactement), vraisemblablement des parties d'une version antérieure dont
// la ligne bb_scores n'existe pas. C'est pourquoi la réparation ne fait que
// monter : elle n'écrit jamais une valeur inférieure à celle déjà stockée.
//
// La clé utilisée est la clé anon publique, la même que celle du navigateur : ce
// script ne peut rien faire que l'app ne fasse déjà.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ici = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(ici, "..", "src", "components", "LePont.jsx"), "utf8");
const URL_SB = /const SB_URL = "([^"]+)"/.exec(source)[1] + "/rest/v1";
const CLE = /const SB_KEY = "([^"]+)"/.exec(source)[1];
const ENTETES = { apikey: CLE, Authorization: "Bearer " + CLE };
const MODES_XP = ["pont", "chaine"];
const REPARER = process.argv.includes("--reparer");

const moisCourant = (function () {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
})();

async function lireTout(chemin) {
  const tout = [];
  for (let offset = 0; ; offset += 1000) {
    const r = await fetch(URL_SB + chemin + "&limit=1000&offset=" + offset, { headers: ENTETES });
    if (!r.ok) throw new Error(chemin + " → " + r.status + " " + (await r.text()));
    const lot = await r.json();
    tout.push(...lot);
    if (lot.length < 1000) return tout;
  }
}

const parties = await lireTout(
  "/bb_scores?select=player_id,score,mode,created_at&mode=in.(" + MODES_XP.join(",") + ")&order=created_at");
const comptes = await lireTout(
  "/bb_pseudos?select=player_id,pseudo,created_at,xp,xp_season,xp_season_month&order=created_at");

const plancher = new Map(), plancherSaison = new Map(), nbParties = new Map();
for (const p of parties) {
  if (!p.player_id) continue;
  const gain = Math.max(0, p.score || 0);
  plancher.set(p.player_id, (plancher.get(p.player_id) || 0) + gain);
  nbParties.set(p.player_id, (nbParties.get(p.player_id) || 0) + 1);
  if (String(p.created_at).slice(0, 7) === moisCourant)
    plancherSaison.set(p.player_id, (plancherSaison.get(p.player_id) || 0) + gain);
}

// Un écart de moins de 100 XP ne prouve rien : une seule partie non enregistrée
// suffit à l'expliquer. On ne signale que les pertes franches.
const SEUIL = 100;
const touches = comptes
  .map(function (c) {
    const sol = plancher.get(c.player_id) || 0;
    return { ...c, sol, solSaison: plancherSaison.get(c.player_id) || 0,
             parties: nbParties.get(c.player_id) || 0, perdu: sol - (c.xp || 0) };
  })
  .filter(function (c) { return c.perdu > SEUIL; })
  .sort(function (a, b) { return b.perdu - a.perdu; });

console.log(parties.length + " parties donnant de l'XP · " + comptes.length + " comptes · mois " + moisCourant);
console.log("");
if (!touches.length) {
  console.log("Aucun compte sous son plancher. Rien à réparer.");
} else {
  console.log("pseudo".padEnd(18) + "stocké".padStart(9) + "plancher".padStart(10) +
              "perdu".padStart(9) + "parties".padStart(9) + "  créé le");
  for (const c of touches) {
    console.log((c.pseudo || "?").slice(0, 18).padEnd(18) +
      String(c.xp || 0).padStart(9) + String(c.sol).padStart(10) +
      String(c.perdu).padStart(9) + String(c.parties).padStart(9) +
      "  " + String(c.created_at).slice(0, 10));
  }
  console.log("");
  console.log("XP à restituer : " + touches.reduce(function (a, c) { return a + c.perdu; }, 0));
}

if (!REPARER) {
  if (touches.length) console.log("\nLecture seule. Relancer avec --reparer pour écrire.");
  process.exit(0);
}

for (const c of touches) {
  // Monter, jamais descendre : ni le cumul ni l'XP de saison ne peuvent baisser.
  const corps = { xp: Math.max(c.xp || 0, c.sol) };
  const saisonStockee = c.xp_season_month === moisCourant ? (c.xp_season || 0) : 0;
  if (c.solSaison > saisonStockee) {
    corps.xp_season = c.solSaison;
    corps.xp_season_month = moisCourant;
  }
  const r = await fetch(URL_SB + "/bb_pseudos?player_id=eq." + c.player_id, {
    method: "PATCH",
    headers: { ...ENTETES, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(corps)
  });
  console.log((r.ok ? "ok   " : "ÉCHEC ") + (c.pseudo || c.player_id) + " → " + JSON.stringify(corps) +
    (r.ok ? "" : " · " + r.status + " " + (await r.text())));
}
