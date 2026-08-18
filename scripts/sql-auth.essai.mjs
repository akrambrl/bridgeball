#!/usr/bin/env node
// LANCE docs/supabase-auth-anonyme.sql sur un Postgres jetable, et le CONTRÔLE.
//
//     npm run sql:auth
//
// POURQUOI CE BANC. Cette migration touche les DROITS de 29 politiques et pose un
// déclencheur sur les deux tables qui décident du classement, donc du lot. Deux
// façons de tout casser, et les deux sont silencieuses :
//
//   • oublier d'étendre une politique au rôle `authenticated` : la table cesse
//     simplement de répondre pour les clients authentifiés, sans erreur visible
//     côté app puisque sbFetch avale les échecs ;
//   • défaire le masquage de `recovery_code` en recopiant les droits de colonne.
//     La section 1 recopie ce que `anon` détient — si elle recopiait trop, les
//     codes de récupération deviendraient lisibles, et c'est le seul secret qui
//     protège la revendication d'un compte.
//
// Le banc éprouve donc les deux, plus le comportement PROGRESSIF du garde-fou :
// un client non authentifié doit continuer de fonctionner sur un pseudo non lié,
// et être refusé sur un pseudo lié. C'est toute la promesse du fichier.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const lancer = promisify(execFile);
const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, "..");

const SCHEMA  = join(racine, "docs", "supabase-auth.essai.sql");
const FICHIER = join(racine, "docs", "supabase-auth-anonyme.sql");

const PORT = process.env.PG_PORT || "5433";
const PGBIN = process.env.PGBIN || "/usr/lib/postgresql/16/bin";
const SOCKET = "/tmp";
const DONNEES = process.env.PGDATA_ESSAI || "/var/tmp/pg-goatfc";
const BASE = "auth_essai";

// Deux comptes anonymes simulés, et l'absence de compte.
const JULES = "11111111-1111-1111-1111-111111111111";
const PIRATE = "22222222-2222-2222-2222-222222222222";

async function psql(args, base = "postgres") {
  const { stdout, stderr } = await lancer("psql",
    ["-h", SOCKET, "-p", PORT, "-U", "postgres", "-d", base, "-v", "ON_ERROR_STOP=1", ...args],
    { maxBuffer: 1 << 24 });
  return (stdout || "") + (stderr || "");
}
const valeur = async (sql) => (await psql(["-tAc", sql], BASE)).trim();

/**
 * Joue une requête SOUS un rôle et une identité donnés, et dit si elle passe.
 * `uid` à null simule une requête sans jeton — le client d'avant la mise à jour.
 */
async function tenter(sql, { role = "anon", uid = null } = {}) {
  const prefixe = `set role ${role}; select set_config('essai.uid', '${uid || ""}', false);`;
  try { await psql(["-c", prefixe + " " + sql], BASE); return { ok: true }; }
  catch (e) {
    const m = String(e.message).match(/ERROR:\s*([^\n]+)/);
    return { ok: false, erreur: m ? m[1].trim() : String(e.message).split("\n")[0] };
  }
}

async function clusterVivant() {
  try { await psql(["-tAc", "select 1"]); return true; } catch { return false; }
}

async function demarrer() {
  if (await clusterVivant()) return "déjà en route";
  try { await lancer("bash", ["-c", `test -x ${PGBIN}/initdb`]); }
  catch {
    console.error("Postgres introuvable dans " + PGBIN);
    process.exit(2);
  }
  await lancer("bash", ["-c",
    `rm -rf ${DONNEES} && mkdir -p ${DONNEES} && chown postgres:postgres ${DONNEES} && chmod 700 ${DONNEES}`]);
  await lancer("su", ["postgres", "-c", `${PGBIN}/initdb -D ${DONNEES} -U postgres --auth=trust`]);
  await lancer("su", ["postgres", "-c",
    `${PGBIN}/pg_ctl -D ${DONNEES} -l ${DONNEES}/log -o '-p ${PORT} -k ${SOCKET}' start`]);
  for (let i = 0; i < 20; i++) {
    if (await clusterVivant()) return "démarré";
    await new Promise((ok) => setTimeout(ok, 300));
  }
  throw new Error("le cluster ne répond pas sur le port " + PORT);
}

let bon = true;
const dire = (ok, texte, detail) => {
  if (!ok) bon = false;
  console.log((ok ? "✅ " : "❌ ") + texte + (detail ? "  " + detail : ""));
};

console.log("cluster : " + await demarrer());
await psql(["-c", `drop database if exists ${BASE}`]);
await psql(["-c", `create database ${BASE}`]);
await psql(["-f", SCHEMA, "-q"], BASE);

// ── L'ÉTAT AVANT, pour prouver que le banc part bien de la production ────────
const avantAuth = await valeur(`select count(*) from pg_policies
  where schemaname='public' and 'anon'=any(roles) and not ('authenticated'=any(roles))`);
console.log(`   départ : ${avantAuth} politique(s) sur le seul rôle anon`);
if (Number(avantAuth) === 0) dire(false, "le schéma d'essai doit partir de politiques anon SEULES");

// ── APPLICATION ─────────────────────────────────────────────────────────────
try {
  const sortie = await psql(["-f", FICHIER, "-q"], BASE);
  dire(true, "le fichier s'applique sans erreur");
  for (const l of sortie.split("\n").filter((l) => l.includes("NOTICE"))) {
    console.log("   " + l.replace(/^psql:[^:]+:\d+:\s*/, "").trim());
  }
} catch (e) {
  dire(false, "le fichier s'applique sans erreur", "← " + String(e.message).split("\n").slice(0, 3).join(" | "));
  console.log("\n❌ inutile de continuer.");
  process.exit(1);
}

try { await psql(["-f", FICHIER, "-q"], BASE); dire(true, "le fichier est rejouable"); }
catch (e) { dire(false, "le fichier est rejouable", "← " + String(e.message).split("\n")[0]); }

// ── 1. PLUS AUCUNE POLITIQUE SUR LE SEUL RÔLE anon ──────────────────────────
const restantes = await valeur(`select coalesce(string_agg(tablename||'.'||policyname, ', '), 'aucune')
  from pg_policies where schemaname='public' and 'anon'=any(roles) and not ('authenticated'=any(roles))`);
dire(restantes === "aucune",
  "toutes les politiques ciblent anon ET authenticated", "→ restantes : " + restantes);

// ── 2. recovery_code RESTE MASQUÉ AUX DEUX RÔLES ────────────────────────────
// Le piège de la section 1 : elle recopie les droits de colonne de anon vers
// authenticated. Si elle recopiait trop large, les codes deviendraient lisibles.
const lisibles = await valeur(`select coalesce(string_agg(distinct grantee, ','), 'personne')
  from information_schema.column_privileges
 where table_schema='public' and table_name='bb_pseudos'
   and column_name='recovery_code' and privilege_type='SELECT'
   and grantee in ('anon','authenticated')`);
dire(lisibles === "personne", "recovery_code reste illisible aux deux rôles", "→ " + lisibles);

// Et le pendant : les colonnes légitimes SONT bien lisibles par authenticated.
const colsAuth = await valeur(`select count(*) from information_schema.column_privileges
 where table_schema='public' and table_name='bb_pseudos' and grantee='authenticated'
   and privilege_type='SELECT'`);
const colsAnon = await valeur(`select count(*) from information_schema.column_privileges
 where table_schema='public' and table_name='bb_pseudos' and grantee='anon'
   and privilege_type='SELECT'`);
dire(colsAuth === colsAnon && Number(colsAuth) > 0,
  "authenticated lit exactement les mêmes colonnes que anon",
  `→ ${colsAnon} pour anon, ${colsAuth} pour authenticated`);

// ── 3. LES FONCTIONS RESTENT EXÉCUTABLES ────────────────────────────────────
// recover_account et delete_user_account sont ce que l'App Store vérifie.
const execOk = await valeur(
  `select has_function_privilege('authenticated', 'public.recover_account(text)', 'EXECUTE')`);
dire(execOk === "t", "recover_account reste exécutable par authenticated", "→ " + execOk);

// ── 4. LE GARDE-FOU NE FAIT RIEN TANT QUE RIEN N'EST LIÉ ────────────────────
// LE contrôle qui compte : le client d'avant la mise à jour doit continuer de
// fonctionner. S'il casse, on a régressé pour 337 joueurs.
let r = await tenter(`insert into public.bb_scores (player_id, score, mode) values ('AAA111', 500, 'pont')`);
dire(r.ok, "un client NON authentifié écrit encore sur un pseudo non lié",
  r.ok ? "(aucune régression)" : "← " + r.erreur);

r = await tenter(`insert into public.bb_gg_scores (player_id, score, max_score) values ('BBB222', 300, 550)`);
dire(r.ok, "idem sur bb_gg_scores", r.ok ? "" : "← " + r.erreur);

// ── 5. lier_compte ──────────────────────────────────────────────────────────
const lier = async (pid, code, uid) => (await psql(["-tAc",
  `select set_config('essai.uid', '${uid || ""}', false); select public.lier_compte('${pid}', ${code === null ? "null" : "'" + code + "'"})`],
  BASE)).trim().split("\n").pop().trim();

dire(await lier("AAA111", "CODE-JULES", null) === "non_authentifie",
  "lier_compte refuse une requête sans jeton");
dire(await lier("AAA111", "MAUVAIS", JULES) === "code_invalide",
  "lier_compte refuse un mauvais code de récupération");
dire(await lier("ZZZ999", "CODE-JULES", JULES) === "inconnu",
  "lier_compte refuse un pseudo inexistant");
dire(await lier("AAA111", "code-jules", JULES) === "lie",
  "lier_compte accepte le bon code, insensible à la casse");
dire(await lier("AAA111", "CODE-JULES", JULES) === "deja_lie",
  "lier_compte est idempotent pour le propriétaire");
dire(await lier("AAA111", "CODE-JULES", PIRATE) === "appartient_a_un_autre",
  "lier_compte refuse un compte déjà lié à quelqu'un d'autre",
  "← c'est ce refus qui rend la protection durable");
dire(await lier("CCC333", null, PIRATE) === "lie",
  "un compte SANS code de récupération est liable sans code",
  "← sinon les vieux comptes resteraient vulnérables pour toujours");

// ── 6. UNE FOIS LIÉ, SEUL LE PROPRIÉTAIRE ÉCRIT ─────────────────────────────
r = await tenter(`insert into public.bb_scores (player_id, score, mode) values ('AAA111', 900, 'pont')`,
  { role: "authenticated", uid: JULES });
dire(r.ok, "le propriétaire écrit son propre score", r.ok ? "" : "← " + r.erreur);

r = await tenter(`insert into public.bb_scores (player_id, score, mode) values ('AAA111', 99999, 'pont')`,
  { role: "authenticated", uid: PIRATE });
dire(!r.ok && /autre compte/.test(r.erreur || ""),
  "un AUTRE compte ne peut plus écrire sous ce pseudo", "→ " + (r.erreur || "PASSÉ !"));

r = await tenter(`insert into public.bb_scores (player_id, score, mode) values ('AAA111', 99999, 'pont')`);
dire(!r.ok && /autre compte/.test(r.erreur || ""),
  "un client non authentifié ne peut plus écrire sous ce pseudo lié",
  "→ " + (r.erreur || "PASSÉ !"));

// Et le pseudo NON lié reste ouvert : la protection est bien progressive.
r = await tenter(`insert into public.bb_scores (player_id, score, mode) values ('BBB222', 400, 'pont')`);
dire(r.ok, "un pseudo encore non lié reste écrivable", r.ok ? "(progressif)" : "← " + r.erreur);

// ── 7. bb_pseudos EN UPDATE : PLUS GRAVE QU'UN FAUX SCORE ───────────────────
r = await tenter(`update public.bb_pseudos set xp = 999999 where player_id = 'AAA111'`,
  { role: "authenticated", uid: PIRATE });
dire(!r.ok, "on ne peut plus réécrire l'XP d'un compte lié depuis un autre compte",
  r.ok ? "← PASSÉ !" : "→ " + r.erreur);

r = await tenter(`update public.bb_pseudos set xp = 5000 where player_id = 'AAA111'`,
  { role: "authenticated", uid: JULES });
dire(r.ok, "le propriétaire modifie encore son propre XP", r.ok ? "" : "← " + r.erreur);

// Le contournement le plus évident : renommer la clé pour viser une autre ligne.
// Le déclencheur regarde OLD.player_id sur un UPDATE, précisément pour ça.
r = await tenter(`update public.bb_pseudos set pseudo = 'vole' where player_id = 'AAA111'`,
  { role: "anon", uid: null });
dire(!r.ok, "renommer le pseudo d'un compte lié est refusé même sans jeton",
  r.ok ? "← PASSÉ !" : "→ " + r.erreur);

// ── 8. LES BANNISSEMENTS ────────────────────────────────────────────────────
const banni = await valeur(`select public.bb_bannir('BBB222', 'essai')`);
dire(banni.startsWith("banni : BBB222"), "bb_bannir enregistre le bannissement", "→ " + banni);

r = await tenter(`insert into public.bb_scores (player_id, score, mode) values ('BBB222', 500, 'pont')`);
dire(!r.ok && /banni/.test(r.erreur || ""),
  "un pseudo banni ne peut plus écrire, même sans jeton", "→ " + (r.erreur || "PASSÉ !"));

// Le compte de CCC333 est lié au PIRATE : on le bannit par son compte, et il
// doit tomber même s'il change de pseudo.
await valeur(`select public.bb_bannir('CCC333', 'essai compte')`);
r = await tenter(`insert into public.bb_scores (player_id, score, mode) values ('AAA111', 1, 'pont')`,
  { role: "authenticated", uid: PIRATE });
// `!r.ok` NE SUFFIT PAS : ce contrôle est passé au vert la première fois à
// cause d'une erreur de droits sur la séquence, pas à cause du bannissement.
// Un test qui réussit pour la mauvaise raison est pire qu'un test qui échoue,
// puisqu'il fait croire qu'une protection existe. On exige le motif.
dire(!r.ok && /banni/.test(r.erreur || ""),
  "un COMPTE banni est refusé quel que soit le pseudo visé",
  r.ok ? "← PASSÉ !" : "→ " + r.erreur);

// ── 9. bb_bannis EST INVISIBLE DEPUIS L'APP ─────────────────────────────────
for (const role of ["anon", "authenticated"]) {
  r = await tenter(`select count(*) from public.bb_bannis`, { role });
  dire(!r.ok, `bb_bannis est illisible par ${role}`, r.ok ? "← LISIBLE !" : "→ " + r.erreur);
}
r = await tenter(`select public.bb_bannir('AAA111', 'depuis l app')`, { role: "authenticated", uid: JULES });
dire(!r.ok, "bb_bannir n'est pas appelable depuis l'app", r.ok ? "← APPELABLE !" : "→ " + r.erreur);

console.log("\n" + (bon
  ? "✅ tous les contrôles passent — bon pour Supabase."
  : "❌ au moins un contrôle échoue — NE PAS coller dans Supabase."));
process.exit(bon ? 0 : 1);
