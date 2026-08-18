#!/usr/bin/env node
// LANCE docs/supabase-goatgrid-vie.sql sur un Postgres jetable, et le CONTRÔLE.
//
//     npm run sql:goatgrid
//
// POURQUOI CE BANC. Le dépôt a une histoire précise sur ce point : le fichier du
// classement a été envoyé une première fois sans avoir jamais été exécuté, et il
// s'arrêtait en 42883 au milieu du déploiement. Relire ne suffit pas.
//
// Ce fichier-ci est encore plus piégeux que la moyenne, pour une raison : il
// RECOPIE une fonction de 30 lignes pour n'y changer qu'une clause. Postgres ne
// sait pas modifier une seule branche d'un `union all`, donc il faut remplacer le
// tout — et une recopie approximative ne casse rien de visible, elle change
// simplement les points de tout le monde. C'est exactement le genre de faute qui
// passerait la relecture et se verrait le 1er du mois, sur un classement doté.
//
// D'où le contrôle central ci-dessous : APRÈS application, le classement doit
// être IDENTIQUE à la ligne près, puisque toutes les grilles existantes valent
// `vie_rachetee = false`. Si un seul total bouge, la recopie est fautive.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const lancer = promisify(execFile);
const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, "..");

const SCHEMA    = join(racine, "docs", "supabase-classement.essai.sql");
const CLASSEMENT= join(racine, "docs", "supabase-classement.sql");
const ECHELLE   = join(racine, "docs", "supabase-classement-echelle.sql");
const FICHIER   = join(racine, "docs", "supabase-goatgrid-vie.sql");

const PORT = process.env.PG_PORT || "5433";
const PGBIN = process.env.PGBIN || "/usr/lib/postgresql/16/bin";
const SOCKET = "/tmp";
const DONNEES = process.env.PGDATA_ESSAI || "/var/tmp/pg-goatfc";

async function psql(args, base = "postgres") {
  const { stdout, stderr } = await lancer("psql",
    ["-h", SOCKET, "-p", PORT, "-U", "postgres", "-d", base, "-v", "ON_ERROR_STOP=1", ...args],
    { maxBuffer: 1 << 24 });
  return (stdout || "") + (stderr || "");
}
const valeur = async (sql, base) => (await psql(["-tAc", sql], base)).trim();

async function clusterVivant() {
  try { await psql(["-tAc", "select 1"]); return true; } catch { return false; }
}

async function demarrer() {
  if (await clusterVivant()) return "déjà en route";
  try { await lancer("bash", ["-c", `test -x ${PGBIN}/initdb`]); }
  catch {
    console.error("Postgres introuvable dans " + PGBIN
      + "\n  Règle PGBIN sur le dossier des binaires (initdb, pg_ctl).");
    process.exit(2);
  }
  await lancer("bash", ["-c",
    `rm -rf ${DONNEES} && mkdir -p ${DONNEES} && chown postgres:postgres ${DONNEES} && chmod 700 ${DONNEES}`]);
  await lancer("su", ["postgres", "-c",
    `${PGBIN}/initdb -D ${DONNEES} -U postgres --auth=trust`]);
  await lancer("su", ["postgres", "-c",
    `${PGBIN}/pg_ctl -D ${DONNEES} -l ${DONNEES}/log -o '-p ${PORT} -k ${SOCKET}' start`]);
  for (let i = 0; i < 20; i++) {
    if (await clusterVivant()) return "démarré";
    await new Promise((ok) => setTimeout(ok, 300));
  }
  throw new Error("le cluster ne répond pas sur le port " + PORT);
}

/**
 * Le classement entier, sérialisé pour être comparé caractère par caractère.
 * Comparer les seuls totaux laisserait passer une permutation de l'ordre, qui
 * décide du champion — donc du lot.
 */
const classement = (base) => valeur(
  `select coalesce(string_agg(pseudo || ':' || points || ':' || jours || ':' || modes, '|'
     order by points desc, jours desc, pseudo asc), '(vide)')
     from public.bb_classement_courant()`, base);

async function eprouver(typeScore) {
  const base = "gg_" + typeScore.replace(/\W/g, "");
  console.log("\n══ score en " + typeScore + " ══");
  await psql(["-c", `drop database if exists ${base}`]);
  await psql(["-c", `create database ${base}`]);
  await psql(["-v", "type_score=" + typeScore, "-f", SCHEMA, "-q"], base);
  await psql(["-f", CLASSEMENT, "-q"], base);
  await psql(["-f", ECHELLE, "-q"], base);

  let bon = true;
  const dire = (ok, texte, detail) => {
    if (!ok) bon = false;
    console.log((ok ? "✅ " : "❌ ") + texte + (detail ? "  " + detail : ""));
  };

  // ── L'ÉTAT DE RÉFÉRENCE, PRIS AVANT ────────────────────────────────────
  const avant = await classement(base);
  const ggAvant = await valeur(
    `select count(*) from public.bb_gg_scores`, base);
  console.log("   référence : " + avant.split("|").length + " joueur(s) classé(s), "
    + ggAvant + " grille(s)");

  // ── APPLICATION ────────────────────────────────────────────────────────
  let sortie = "";
  try { sortie = await psql(["-f", FICHIER, "-q"], base); }
  catch (e) {
    dire(false, "le fichier s'applique sans erreur", "← " + String(e.message).split("\n")[0]);
    return bon;
  }
  dire(true, "le fichier s'applique sans erreur");
  if (sortie.trim()) console.log("   sortie psql : " + sortie.trim().slice(0, 200));

  // ── 1. LA COLONNE ──────────────────────────────────────────────────────
  const col = await valeur(
    `select data_type || '/' || is_nullable || '/' || coalesce(column_default,'∅')
       from information_schema.columns
      where table_schema='public' and table_name='bb_gg_scores'
        and column_name='vie_rachetee'`, base);
  dire(col === "boolean/NO/false", "la colonne est boolean NOT NULL DEFAULT false",
    "→ " + (col || "ABSENTE"));

  // Rejouable : c'est la promesse de l'en-tête du fichier, et un `add column`
  // sans `if not exists` la casserait.
  try {
    await psql(["-f", FICHIER, "-q"], base);
    dire(true, "le fichier est rejouable sans erreur");
  } catch (e) {
    dire(false, "le fichier est rejouable sans erreur", "← " + String(e.message).split("\n")[0]);
  }

  // ── 2. LE CONTRÔLE CENTRAL : RIEN N'A BOUGÉ ────────────────────────────
  // Toutes les grilles valent false, donc le classement doit être au caractère
  // près celui d'avant. C'est ce qui prouve que la recopie de la fonction est
  // fidèle — le seul défaut que ce fichier peut réellement introduire.
  const apres = await classement(base);
  dire(apres === avant, "le classement est INCHANGÉ après application",
    apres === avant ? "(recopie fidèle)" : "\n     avant : " + avant + "\n     après : " + apres);

  // ── 3. MARQUER UNE GRILLE RETIRE EXACTEMENT SES POINTS ─────────────────
  // p1 a quatre grilles à 6..9 / 9. On marque celle du jour 0 et on vérifie que
  // le total baisse de la valeur normalisée de CETTE grille, ni plus ni moins.
  const ptsAvant = Number(await valeur(
    `select points from public.bb_classement_courant() where pseudo = 'jules'`, base));
  const attendu = Number(await valeur(
    `select least(1000, greatest(0, round(1000.0 * score / nullif(max_score,0))))
       from public.bb_gg_scores
      where player_id='p1' and created_at::date = date_trunc('month', now())::date`, base));
  await psql(["-c", `update public.bb_gg_scores set vie_rachetee = true
     where player_id='p1' and created_at::date = date_trunc('month', now())::date`], base);
  const ptsApres = Number(await valeur(
    `select points from public.bb_classement_courant() where pseudo = 'jules'`, base));
  dire(ptsAvant - ptsApres === attendu,
    "une grille marquée retire EXACTEMENT ses points",
    ptsAvant + " → " + ptsApres + " (attendu −" + attendu + ", constaté −" + (ptsAvant - ptsApres) + ")");

  // ── 4. UNE PUB NE PEUT PLUS RIEN RAPPORTER DU TOUT ─────────────────────
  // Le cas qui motive tout le fichier : un joueur classé UNIQUEMENT par
  // GOAT GRID. Toutes ses grilles marquées, il doit QUITTER le classement — pas
  // y rester avec zéro, sinon le mode compterait encore comme « mode joué », ce
  // qui départage les ex æquo.
  await psql(["-c", `delete from public.bb_scores where player_id='p3'`], base);
  const p3Avant = await valeur(
    `select coalesce(max(points)::text,'absent') from public.bb_classement_courant() where pseudo='james10'`, base);
  await psql(["-c", `update public.bb_gg_scores set vie_rachetee = true where player_id='p3'`], base);
  const p3Apres = await valeur(
    `select coalesce(max(points)::text,'absent') from public.bb_classement_courant() where pseudo='james10'`, base);
  dire(p3Avant !== "absent" && p3Apres === "absent",
    "un joueur classé par la SEULE GOAT GRID quitte le classement si tout est marqué",
    p3Avant + " → " + p3Apres);

  // ── 5. LES GRILLES HONNÊTES DU MÊME JOUEUR RESTENT ─────────────────────
  // Le correctif doit être chirurgical : marquer une grille ne doit pas coûter
  // les autres jours. Sans le `group by` intact, l'exclusion emporterait tout.
  await psql(["-c", `update public.bb_gg_scores set vie_rachetee = false where player_id='p3'`], base);
  await psql(["-c", `update public.bb_gg_scores set vie_rachetee = true
     where player_id='p3' and created_at::date = date_trunc('month', now())::date`], base);
  const joursP3 = Number(await valeur(
    `select jours from public.bb_classement_courant() where pseudo='james10'`, base));
  const grillesHonnetes = Number(await valeur(
    `select count(distinct created_at::date) from public.bb_gg_scores
      where player_id='p3' and not vie_rachetee`, base));
  dire(joursP3 === grillesHonnetes,
    "les autres jours du même joueur sont intacts",
    joursP3 + " jour(s) classé(s) pour " + grillesHonnetes + " grille(s) honnête(s)");

  // ── 6. UNE COLONNE NULLABLE NE FAIT PAS DISPARAÎTRE LES POINTS ──────────
  // La raison d'être du `coalesce`. Si quelqu'un rend la colonne nullable un
  // jour, `not NULL` vaut NULL et la ligne serait filtrée EN SILENCE : tous les
  // points de GOAT GRID s'évaporeraient sans message d'erreur.
  await psql(["-c", `update public.bb_gg_scores set vie_rachetee = false`], base);
  const refNullable = await classement(base);
  await psql(["-c", `alter table public.bb_gg_scores alter column vie_rachetee drop not null;
     update public.bb_gg_scores set vie_rachetee = null where player_id='p2'`], base);
  const avecNull = await classement(base);
  dire(avecNull === refNullable,
    "une valeur NULL est traitée comme « pas de vie rachetée »",
    avecNull === refNullable ? "(coalesce efficace)"
      : "\n     sans null : " + refNullable + "\n     avec null : " + avecNull);

  return bon;
}

console.log("cluster : " + await demarrer());
let tout = true;
// Les deux types possibles de bb_scores.score, comme dans sql-essai.mjs : la
// sonde prouve que la colonne n'est pas entière sans dire laquelle des deux.
for (const t of ["numeric", "double precision"]) {
  if (!(await eprouver(t))) tout = false;
}
console.log("\n" + (tout
  ? "✅ le fichier tient dans les deux cas de type — bon pour Supabase."
  : "❌ au moins un contrôle échoue — NE PAS coller dans Supabase."));
process.exit(tout ? 0 : 1);
