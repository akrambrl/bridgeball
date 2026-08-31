#!/usr/bin/env node
// LANCE docs/supabase-parrainage.sql sur un Postgres jetable, et le CONTRÔLE.
//
//     npm run sql:parrainage
//
// POURQUOI CE BANC. Le parrainage crédite des points qui comptent DANS le
// concours doté. bb_parrainer est en SECURITY DEFINER : mal grée, elle est
// appelable par quiconque a la clé publique. Et l'extension de bb_classement_mois
// doit créditer EXACTEMENT ce qu'on croit : 500 à la première partie du filleul,
// 50 par (filleul, jour, mode). Relire le SQL ne suffit pas — il faut PRENDRE le
// rôle anon et éprouver.
//
// Ce qu'il éprouve :
//   1. un code inconnu ne rattache rien ;
//   2. on ne peut pas se parrainer soi-même ;
//   3. un bon code rattache — une seule fois (pas de vol de filleul) ;
//   4. le pseudo marche aussi (saisie manuelle) ;
//   5. AVANT que le filleul joue : aucun point ;
//   6. à la première partie : validé, +500 au parrain ;
//   7. plusieurs (jour, mode) : +50 chacun, sans gonfler en rejouant un mode ;
//   8. anon ne peut PAS écrire dans bb_parrainage en direct ;
//   9. anon PEUT lire la table et appeler les fonctions.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const lancer = promisify(execFile);
const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, "..");
const FICHIER = join(racine, "docs", "supabase-parrainage.sql");
const SCHEMA_CLASSEMENT = join(racine, "docs", "supabase-classement.essai.sql");
const FONCTIONS_CLASSEMENT = join(racine, "docs", "supabase-classement.sql");

const PORT = process.env.PG_PORT || "5433";
const PGBIN = process.env.PGBIN || "/usr/lib/postgresql/16/bin";
const SOCKET = "/tmp";
const DONNEES = process.env.PGDATA_ESSAI || "/var/tmp/pg-goatfc-parr";

async function psql(args, base = "postgres") {
  const { stdout, stderr } = await lancer("psql",
    ["-h", SOCKET, "-p", PORT, "-U", "postgres", "-d", base, "-v", "ON_ERROR_STOP=1", ...args],
    { maxBuffer: 1 << 24 });
  return (stdout || "") + (stderr || "");
}

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

// Un parrain, deux filleuls. Le parrain reçoit un code CONNU après le backfill.
const JEU = `
insert into public.bb_pseudos (player_id, pseudo, recovery_code) values
  ('parrain', 'akram2',  'GOATFC-AAAA-BBBB'),
  ('filleul', 'lepote',  'GOATFC-CCCC-DDDD'),
  ('filleul2','autrepot','GOATFC-EEEE-FFFF');
`;

async function commeAnon(sql, base) {
  return (await psql(["-q", "-c", "set role anon", "-tAc", sql], base)).trim();
}
async function refuse(sql, base) {
  try { await psql(["-q", "-c", "set role anon", "-c", sql], base); return false; }
  catch { return true; }
}

async function eprouver() {
  const base = "essai_parr";
  await psql(["-c", "drop database if exists " + base]);
  await psql(["-c", "create database " + base]);
  await psql(["-v", "type_score=numeric", "-f", SCHEMA_CLASSEMENT], base);
  await psql(["-f", FONCTIONS_CLASSEMENT], base);
  await psql(["-c", JEU], base);

  // ── ON REPRODUIT LE GARDE-FOU D'IDENTITÉ DE LA PRODUCTION ─────────────────
  // Le backfill du code touche bb_pseudos, ce qui réveille zz_garde_identite
  // (correctif auth anonyme) : un BEFORE UPDATE qui refuse de modifier une ligne
  // liée à un compte quand auth.uid() ne correspond pas. Dans l'éditeur SQL,
  // auth.uid() est nul → il bloquait le déploiement (« ce pseudo appartient a un
  // autre compte »). Le banc ne l'avait pas, donc ne l'avait pas vu. On le pose
  // ici, avec un compte LIÉ, pour que le backfill DOIVE le contourner.
  await psql(["-c", `
    create schema if not exists auth;
    create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    alter table public.bb_pseudos add column if not exists auth_uid uuid;
    create or replace function public.g_ident() returns trigger language plpgsql as $$
    begin
      if tg_op = 'UPDATE' and old.auth_uid is not null
         and old.auth_uid is distinct from auth.uid() then
        raise exception 'ce pseudo appartient a un autre compte';
      end if;
      return new;
    end $$;
    drop trigger if exists zz_garde_identite on public.bb_pseudos;
    create trigger zz_garde_identite before update on public.bb_pseudos
      for each row execute function public.g_ident();
    update public.bb_pseudos set auth_uid = gen_random_uuid() where player_id = 'parrain';
  `], base);

  await psql(["-f", FICHIER], base);
  // Droits d'anon pour insérer un score : c'est LE point qui reproduit le bug de
  // validation. Le trigger bb_parrainage_valide tourne sous le rôle qui insère le
  // score ; s'il n'est pas SECURITY DEFINER, l'UPDATE de bb_parrainage est filtré
  // par le RLS quand ce rôle est anon. En superutilisateur (postgres) le RLS est
  // contourné et le bug reste invisible — c'est ce qui l'avait masqué.
  await psql(["-c",
    "grant insert, select on public.bb_scores to anon; "
    + "grant usage, select on all sequences in schema public to anon;"], base);

  // Code connu pour des contrôles déterministes (le backfill en a posé un au hasard).
  // 'parrain' est lié (auth_uid), donc même geste d'admin que le backfill : on
  // suspend les triggers le temps de forcer le code.
  await psql(["-c",
    "set session_replication_role = replica; "
    + "update public.bb_pseudos set parrain_code = 'PARR01' where player_id = 'parrain'; "
    + "set session_replication_role = origin;"], base);

  let bon = true;
  const dire = (ok, texte) => { if (!ok) bon = false; console.log((ok ? "✅ " : "❌ ") + texte); };

  // ── 1. CODE INCONNU ───────────────────────────────────────────────────────
  const inconnu = await commeAnon("select public.bb_parrainer('filleul', 'ZZZZZZ')", base);
  dire(inconnu === "refus:code_inconnu", "un code inconnu est refusé  (" + inconnu + ")");

  // ── 2. AUTO-PARRAINAGE ────────────────────────────────────────────────────
  const soi = await commeAnon("select public.bb_parrainer('parrain', 'PARR01')", base);
  dire(soi === "refus:soi_meme", "on ne peut pas se parrainer soi-même  (" + soi + ")");

  // ── 3. BON CODE, UNE SEULE FOIS ───────────────────────────────────────────
  const ok1 = await commeAnon("select public.bb_parrainer('filleul', 'parr01')", base);
  dire(ok1 === "ok", "un bon code rattache le filleul  (" + ok1 + ")");
  const ok2 = await commeAnon("select public.bb_parrainer('filleul', 'PARR01')", base);
  dire(ok2 === "refus:deja_parraine", "un filleul déjà rattaché ne l'est pas deux fois  (" + ok2 + ")");
  const lien = await commeAnon("select parrain_id from public.bb_parrainage where filleul_id = 'filleul'", base);
  dire(lien === "parrain", "le lien pointe vers le bon parrain  (" + lien + ")");

  // ── 4. LE PSEUDO MARCHE AUSSI (saisie manuelle) ───────────────────────────
  const parPseudo = await commeAnon("select public.bb_parrainer('filleul2', 'Akram2')", base);
  dire(parPseudo === "ok", "le pseudo du parrain rattache aussi  (" + parPseudo + ")");

  // ── 5. AVANT DE JOUER : AUCUN POINT ───────────────────────────────────────
  const avant = await commeAnon(
    "select filleuls || '/' || filleuls_valides || '/' || points_mois "
    + "from public.bb_parrainage_resume('parrain')", base);
  dire(avant === "2/0/0", "deux filleuls, zéro validé, zéro point avant qu'ils jouent  (" + avant + ")");
  const clsAvant = await commeAnon(
    "select coalesce((select points from public.bb_classement_courant() where player_id='parrain'),0)", base);
  dire(clsAvant === "0", "le parrain n'est pas au classement tant que rien n'est validé  (" + clsAvant + ")");

  // ── 6. PREMIÈRE PARTIE DU FILLEUL : VALIDÉ, +500 ──────────────────────────
  // Insertion EN TANT QU'ANON — c'est le rôle de l'app. C'est ici que le bug se
  // révèle : sous RLS, un trigger non-SECURITY-DEFINER ne peut pas poser valide_at.
  await psql(["-q", "-c", "set role anon", "-c",
    "insert into public.bb_scores (player_id, player_name, mode, score) "
    + "values ('filleul', 'lepote', 'pont', 800)"], base);
  const valide = await commeAnon(
    "select valide_at is not null from public.bb_parrainage where filleul_id='filleul'", base);
  dire(valide === "t", "la première partie valide le filleul  (" + valide + ")");
  const resume6 = await commeAnon(
    "select filleuls_valides || '/' || points_mois from public.bb_parrainage_resume('parrain')", base);
  // 1 filleul validé ce mois = 500, + 1 seau (filleul, jour, 'pont') = 50 → 550.
  dire(resume6 === "1/550", "un filleul validé + sa partie = 550 points  (" + resume6 + ")");
  // Le point CLÉ : l'insertion en tant qu'anon (parrain LIÉ) a réussi. Si le
  // trigger avait tenté d'écrire la ligne du parrain, bb_garde_identite aurait
  // levé « ce pseudo appartient à un autre compte » et l'insert aurait échoué —
  // c'est ce qui cassait la partie du filleul. Qu'on arrive ici le prouve.

  // ── 7. PLUSIEURS (JOUR, MODE) : +50 CHACUN, SANS GONFLER ──────────────────
  // Deux modes de plus AUJOURD'HUI (nouveaux seaux) + un doublon de 'pont' dans
  // un autre mode déjà compté : rejouer ne doit rien ajouter au titre de 'pont'.
  await psql(["-c",
    "insert into public.bb_scores (player_id, player_name, mode, score) "
    + "values ('filleul', 'lepote', 'chaine', 300)"], base);
  await psql(["-c",
    "insert into public.bb_scores (player_id, player_name, mode, score) "
    + "values ('filleul', 'lepote', 'findplayer', 400)"], base);
  const resume7 = await commeAnon(
    "select points_mois from public.bb_parrainage_resume('parrain')", base);
  // 500 (inscription) + 3 seaux (pont, chaine, findplayer) × 50 = 650.
  dire(resume7 === "650", "trois modes joués = 500 + 150 = 650 points  (" + resume7 + ")");
  const cls7 = await commeAnon(
    "select points from public.bb_classement_courant() where player_id='parrain'", base);
  dire(cls7 === "650", "le classement crédite bien 650 au parrain  (" + cls7 + ")");

  // ── XP : LE TOTAL MÉRITÉ, ET LE RATTRAPAGE IDEMPOTENT ─────────────────────
  // bb_parrainage_xp_total = même barème que le classement (500 + 3×50 = 650).
  const total = await commeAnon("select public.bb_parrainage_xp_total('parrain')", base);
  dire(total === "650", "l'XP de parrainage méritée = 650  (" + total + ")");
  // Rejouer le MÊME mode le même jour ne change pas le total (anti-farming). On
  // désactive UNIQUEMENT le garde de cadence, pas le trigger de validation.
  await psql(["-c",
    "alter table public.bb_scores disable trigger bb_scores_garde_trg; "
    + "insert into public.bb_scores (player_id, player_name, mode, score) "
    + "values ('filleul', 'lepote', 'pont', 500); "
    + "alter table public.bb_scores enable trigger bb_scores_garde_trg;"], base);
  const totalBis = await commeAnon("select public.bb_parrainage_xp_total('parrain')", base);
  dire(totalBis === "650", "rejouer le même mode le même jour ne change pas le total  (" + totalBis + ")");
  // Le rattrapage (section 4 bis) recale l'XP sur l'écart non crédité : ici 650 - 0.
  // On le rejoue une 2e fois pour prouver l'idempotence (aucun ajout).
  const reconcile =
    "update public.bb_pseudos ps "
    + "set xp = coalesce(ps.xp,0) + (public.bb_parrainage_xp_total(ps.player_id) - ps.xp_parrain_credite), "
    + "    xp_parrain_credite = public.bb_parrainage_xp_total(ps.player_id) "
    + "where public.bb_parrainage_xp_total(ps.player_id) > ps.xp_parrain_credite;";
  await psql(["-c", "set session_replication_role = replica; " + reconcile + " set session_replication_role = origin;"], base);
  await psql(["-c", "set session_replication_role = replica; " + reconcile + " set session_replication_role = origin;"], base);
  const xpFinal = await commeAnon(
    "select coalesce(xp,0) || '/' || xp_parrain_credite from public.bb_pseudos where player_id='parrain'", base);
  dire(xpFinal === "650/650", "le rattrapage recale l'XP à 650, sans double-compter  (" + xpFinal + ")");

  // ── 8. ANON NE PEUT PAS ÉCRIRE LA TABLE EN DIRECT ─────────────────────────
  dire(await refuse(
    "insert into public.bb_parrainage (filleul_id, parrain_id) values ('x','parrain')", base),
    "anon ne peut pas INSÉRER un filleul en direct");
  dire(await refuse(
    "update public.bb_parrainage set valide_at = now() where filleul_id='filleul2'", base),
    "anon ne peut pas VALIDER un filleul en direct");

  // ── 9. ANON PEUT LIRE ─────────────────────────────────────────────────────
  const lecture = await commeAnon("select count(*) from public.bb_parrainage", base);
  dire(lecture === "2", "anon peut lire la table des filleuls  (" + lecture + ")");

  return bon;
}

(async () => {
  const etat = await demarrer();
  console.log("Postgres : " + etat + "\n");
  const bon = await eprouver();
  console.log(bon ? "\n✅ Banc parrainage : tout passe." : "\n❌ Banc parrainage : au moins un contrôle a échoué.");
  process.exit(bon ? 0 : 1);
})();
