#!/usr/bin/env node
// CRÉE les sessions GOAT SESSION des prochains jours : chaque mercredi et samedi à 19 h 30,
// heure de Paris. Lancement : node scripts/creer-sessions.mjs [--dry-run] [--jours=21]
//
// Jusqu'ici une session se créait à la main (bb_creer_session dans l'éditeur SQL), donc
// il n'y avait jamais de session à rejoindre sans quelqu'un pour y penser. Ce script
// repasse tous les jours (voir le workflow) et s'assure que chaque créneau des prochaines
// semaines a SA session.
//
// ── IDEMPOTENT, DEUX FOIS ───────────────────────────────────────────────────
// Le script regarde d'abord ce qui existe, et bb_creer_session répond elle-même avec la
// session déjà présente quand le créneau est pris : le repasser, ou le lancer deux fois
// en même temps, ne crée jamais de doublon.
//
// ── POURQUOI GITHUB ACTIONS ET PAS pg_cron ──────────────────────────────────
// Créer une session une à deux semaines à l'avance n'est pas un geste à l'heure près ; le
// retard des déclencheurs GitHub (parfois plusieurs heures) n'y change rien. Le DÉMARRAGE,
// lui, ne dépend pas de ce script : les joueurs présents le déclenchent (60 s après l'heure).
//
// Secret attendu : SB_SERVICE_KEY (bb_creer_session est réservée à la clé de service).

import { creneauxSessions } from "../src/lib/sessions-creneaux.js";

const SB_URL = process.env.SB_URL || "https://ialjlsrgcolocoaegzrc.supabase.co";
const CLE = process.env.SB_SERVICE_KEY || "";
const SIMULATION = process.argv.includes("--dry-run");
const jours = Number((process.argv.find((a) => a.startsWith("--jours=")) || "").split("=")[1]) || 21;

if (!CLE) { console.error("SB_SERVICE_KEY manquant."); process.exit(1); }

const entetes = { apikey: CLE, Authorization: "Bearer " + CLE, "Content-Type": "application/json" };

async function existantes() {
  const depuis = new Date(Date.now() - 86400000).toISOString();
  const r = await fetch(SB_URL + "/rest/v1/bb_sessions?select=id,starts_at,statut&statut=neq.annule&starts_at=gte."
    + encodeURIComponent(depuis) + "&order=starts_at.asc", { headers: entetes });
  if (!r.ok) throw new Error("lecture bb_sessions : HTTP " + r.status + " " + (await r.text()).slice(0, 200));
  return r.json();
}

async function creer(iso) {
  const r = await fetch(SB_URL + "/rest/v1/rpc/bb_creer_session", {
    method: "POST", headers: entetes, body: JSON.stringify({ p_starts_at: iso }),
  });
  if (!r.ok) throw new Error("bb_creer_session(" + iso + ") : HTTP " + r.status + " " + (await r.text()).slice(0, 200));
  return r.json();
}

const voulus = creneauxSessions(new Date(), jours);
const deja = new Set((await existantes()).map((s) => new Date(s.starts_at).toISOString()));
console.log("── créneaux sur " + jours + " jours : " + voulus.length + " · déjà créés : "
  + voulus.filter((c) => deja.has(c)).length);

let crees = 0;
for (const iso of voulus) {
  const paris = new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  if (deja.has(iso)) { console.log("   = " + paris + "  (existe déjà)"); continue; }
  if (SIMULATION) { console.log("   + " + paris + "  (à blanc : serait créée)"); continue; }
  const id = await creer(iso);
  crees++;
  console.log("   + " + paris + "  → " + id);
}
console.log(SIMULATION ? "\n--dry-run : rien n'a été créé." : "\n" + crees + " session(s) créée(s).");
