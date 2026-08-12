#!/usr/bin/env node
// CLÔTURE la saison du mois écoulé et couronne le champion.
//
//     node scripts/cloture-saison.mjs [--dry-run] [--mois=2026-07]
//
// Pourquoi un script serveur et pas l'app. La clôture était faite par le CLIENT :
// le premier joueur qui ouvrait l'app après le 1er du mois lisait le top 10 et
// écrivait lui-même le Hall of Fame, avec la clé publique, sur un classement
// lui-même falsifiable. Trois problèmes en un — qui décide, avec quelle autorité,
// sur quelles données.
//
// Ici, la décision revient à `bb_cloturer_saison` en base, appelée avec la clé de
// service. Ce script ne calcule RIEN : il choisit le mois, appelle, et rapporte.
// Tout le raisonnement — le classement, le barème, le refus s'il manque un mode —
// est dans docs/supabase-classement.sql, donc au même endroit que les données.
//
// La clé lue est SB_SERVICE_KEY, le secret qui sert déjà aux notifications. Elle
// n'apparaît jamais dans la sortie.

const SB_URL = "https://ialjlsrgcolocoaegzrc.supabase.co";
const CLE = process.env.SB_SERVICE_KEY;
const SIMULATION = process.argv.includes("--dry-run");
const moisDemande = (process.argv.find((a) => a.startsWith("--mois=")) || "").split("=")[1];

if (!CLE) {
  console.error("SB_SERVICE_KEY manquant. Settings → Secrets and variables → Actions.");
  process.exit(1);
}

// Le mois ÉCOULÉ, en heure de Paris — le même découpage que le reste de l'app.
// Un script lancé le 1er à 03:00 UTC est déjà le 1er à Paris : c'est bien le mois
// d'avant qu'il faut clôturer, et c'est pour ça qu'on retire un mois plutôt que
// de faire confiance à l'heure UTC.
function moisEcoule() {
  const paris = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const p = new Date(paris.getFullYear(), paris.getMonth() - 1, 1);
  return p.getFullYear() + "-" + String(p.getMonth() + 1).padStart(2, "0");
}

// SEASON_START est la référence de numérotation des saisons dans l'app : le
// numéro doit être calculé PAREIL ici, sinon la saison serait enregistrée sous un
// numéro que l'app ne reconnaît pas.
const SEASON_START = new Date(2026, 3, 1); // avril 2026, comme getCurrentSeason()
function numeroDeSaison(mois) {
  const [a, m] = mois.split("-").map(Number);
  return (a - SEASON_START.getFullYear()) * 12 + (m - 1 - SEASON_START.getMonth()) + 1;
}

async function rpc(nom, corps) {
  const r = await fetch(SB_URL + "/rest/v1/rpc/" + nom, {
    method: "POST",
    headers: { apikey: CLE, Authorization: "Bearer " + CLE, "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  });
  const texte = await r.text();
  if (!r.ok) throw new Error("HTTP " + r.status + " sur " + nom + " : " + texte.slice(0, 300));
  return texte ? JSON.parse(texte) : null;
}

const mois = moisDemande || moisEcoule();
const numero = numeroDeSaison(mois);
console.log("mois à clôturer : " + mois + "  (saison " + numero + ")");
if (numero < 2) {
  console.log("saison 1 : rien à clôturer avant elle.");
  process.exit(0);
}

// On regarde AVANT d'écrire, et on l'affiche : c'est cette sortie qu'on relit
// pour savoir si le champion mérite son lot.
const classement = await rpc("bb_classement_mois", { p_mois: mois });
if (!Array.isArray(classement) || !classement.length) {
  console.log("aucun joueur classé sur " + mois + " — rien à faire.");
  process.exit(0);
}
console.log("\npodium du mois — points, jours joués, modes touchés");
for (const [i, l] of classement.slice(0, 5).entries()) {
  console.log("  " + (i + 1) + ". " + String(l.pseudo).padEnd(14)
    + String(l.points).padStart(6) + " pts"
    + String(l.jours).padStart(4) + " j"
    + String(l.modes).padStart(3) + " modes");
}
// Un champion à 1 jour et 1 mode n'est pas un joueur régulier : ça n'invalide
// rien automatiquement, mais ça doit sauter aux yeux dans le journal.
const c = classement[0];
if (c.jours <= 1 || c.modes <= 1) {
  console.log("\n⚠️  le premier n'a joué que " + c.jours + " jour(s) sur "
    + c.modes + " mode(s) — à regarder avant d'envoyer quoi que ce soit.");
}

if (SIMULATION) {
  console.log("\n--dry-run : rien n'a été écrit.");
  process.exit(0);
}

const res = await rpc("bb_cloturer_saison", { p_mois: mois, p_numero: numero });
const ligne = Array.isArray(res) ? res[0] : res;
console.log("\n" + (ligne ? ligne.etat + " — " + ligne.detail : "réponse vide"));
// « refus » n'est pas une erreur d'exécution : c'est la base qui protège le
// palmarès (mode absent du barème, moins de trois participants). On sort en
// échec quand même, pour que la tâche planifiée le signale au lieu de le taire.
if (ligne && ligne.etat === "refus") process.exit(1);
