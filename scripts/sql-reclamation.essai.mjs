#!/usr/bin/env node
// LANCE docs/supabase-reclamation.sql sur un Postgres jetable, et le CONTRÔLE.
//
//     npm run sql:reclamation
//
// POURQUOI CE BANC. La fonction de réclamation décide qui repart avec un jeu à
// 80 €. Elle est en SECURITY DEFINER, donc elle contourne toutes les politiques
// de la base : si ses droits sont mal posés, n'importe qui muni de la clé
// publique — qui est dans le bundle — peut l'appeler. C'est exactement ce qui
// s'était produit avec bb_cloturer_saison, où un `revoke ... from anon` ne
// retirait rien parce que le droit venait de PUBLIC, et où un appel de contrôle
// avait écrit une saison 999 dans le Hall of Fame.
//
// Relire le SQL ne suffit pas à voir ça. Il faut PRENDRE le rôle anon et
// essayer. C'est ce que fait ce banc.
//
// Ce qu'il éprouve, dans l'ordre où ça compte :
//   1. un mauvais code ne réclame rien ;
//   2. le bon code réclame, et une seule fois ;
//   3. un champion d'une saison SANS lot ne réclame rien ;
//   4. le délai dépassé refuse ;
//   5. anon ne peut PAS lire les emails des réclamations ;
//   6. anon ne peut PAS écrire directement dans la table ;
//   7. anon PEUT lire la liste des lots — l'app en a besoin.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const lancer = promisify(execFile);
const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, "..");
const FICHIER = join(racine, "docs", "supabase-reclamation.sql");

const PORT = process.env.PG_PORT || "5433";
const PGBIN = process.env.PGBIN || "/usr/lib/postgresql/16/bin";
const SOCKET = "/tmp";
const DONNEES = process.env.PGDATA_ESSAI || "/var/tmp/pg-goatfc-lot";

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

// Le schéma de production réduit aux tables que le fichier touche. Les types
// suivent docs/supabase-classement.essai.sql, qui les a MESURÉS.
// Pas de `\set` ici : c'est une méta-commande de psql, refusée par `-c`, qui
// n'envoie que du SQL. L'arrêt sur erreur est déjà posé par -v ON_ERROR_STOP=1.
const SCHEMA = `
create table public.bb_pseudos (
  id bigserial primary key,
  player_id text unique not null,
  pseudo text,
  recovery_code text
);
create table public.bb_seasons (
  id bigserial primary key,
  season_number int not null,
  champion_id text,
  champion_name text,
  champion_score integer,
  mode text,
  ended_at timestamptz
);
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;
grant usage on schema public to anon, authenticated, service_role;

insert into public.bb_pseudos (player_id, pseudo, recovery_code) values
  ('gagnant', 'akram2',  'GOATFC-AAAA-BBBB'),
  ('perdant', 'badbr2',  'GOATFC-CCCC-DDDD'),
  ('ancien',  'sodinho2','GOATFC-EEEE-FFFF');

-- Saison 6 = septembre 2026, celle qui porte le lot. Saison 5 n'en porte pas :
-- son champion ne doit rien pouvoir réclamer.
insert into public.bb_seasons (season_number, champion_id, champion_name, champion_score, mode, ended_at)
values (6, 'gagnant', 'akram2', 4200, 'global', now()),
       (5, 'ancien',  'sodinho2', 3900, 'global', now());
`;

/**
 * Rend la première colonne de la première ligne, en tant qu'anon.
 *
 * Le `set role` part dans un -c SÉPARÉ, et non collé devant la requête : psql
 * exécute les -c successifs dans la MÊME session, mais imprime le compte-rendu
 * de chacun. Collés ensemble, la ligne « SET » se retrouvait mêlée au résultat
 * et tous les contrôles échouaient sur une comparaison de chaîne — un banc qui
 * dit « ❌ » alors que la base répond juste est pire qu'un banc absent.
 */
async function commeAnon(sql, base) {
  // `-q` (quiet) supprime les comptes-rendus de commande — sans lui, psql
  // imprime « SET » pour le changement de rôle, et cette ligne se retrouve
  // collée devant le résultat.
  return (await psql(["-q", "-c", "set role anon", "-tAc", sql], base)).trim();
}

/** Vrai si la requête ÉCHOUE — c'est ce qu'on veut pour les interdits. */
async function refuse(sql, base) {
  try { await psql(["-q", "-c", "set role anon", "-c", sql], base); return false; }
  catch { return true; }
}

async function eprouver() {
  const base = "essai_lot";
  await psql(["-c", "drop database if exists " + base]);
  await psql(["-c", "create database " + base]);
  await psql(["-c", SCHEMA], base);
  await psql(["-f", FICHIER], base);

  let bon = true;
  const dire = (ok, texte) => { if (!ok) bon = false; console.log((ok ? "✅ " : "❌ ") + texte); };

  // ── 1. UN MAUVAIS CODE NE RÉCLAME RIEN ────────────────────────────────────
  const inconnu = await commeAnon(
    "select etat || ':' || detail from public.bb_reclamer_lot("
    + "'GOATFC-ZZZZ-ZZZZ', 'x@y.fr', 'ps5', true)", base);
  dire(inconnu === "refus:code_inconnu", "un code inconnu est refusé  (" + inconnu + ")");

  // ── 2. UNE ADRESSE IMPOSSIBLE EST REFUSÉE ─────────────────────────────────
  const mail = await commeAnon(
    "select etat || ':' || detail from public.bb_reclamer_lot("
    + "'GOATFC-AAAA-BBBB', 'pas-une-adresse', 'ps5', true)", base);
  dire(mail === "refus:email", "une adresse impossible est refusée  (" + mail + ")");

  // ── 3. SANS L'AUTORISATION DÉCLARÉE, RIEN ─────────────────────────────────
  const auto = await commeAnon(
    "select etat || ':' || detail from public.bb_reclamer_lot("
    + "'GOATFC-AAAA-BBBB', 'a@b.fr', 'ps5', false)", base);
  dire(auto === "refus:autorisation", "la case d'autorisation est obligatoire  (" + auto + ")");

  // ── 4. UN CHAMPION D'UNE SAISON SANS LOT NE RÉCLAME RIEN ──────────────────
  //     C'est le contrôle qui empêche « tous les anciens champions voient un
  //     bouton réclamer » dès la deuxième saison.
  const sansLot = await commeAnon(
    "select etat || ':' || detail from public.bb_reclamer_lot("
    + "'GOATFC-EEEE-FFFF', 'a@b.fr', 'pc', true)", base);
  dire(sansLot === "refus:pas_de_lot",
    "champion d'une saison SANS lot : refusé  (" + sansLot + ")");

  // ── 5. UN JOUEUR QUI N'A RIEN GAGNÉ NON PLUS ──────────────────────────────
  const pasChampion = await commeAnon(
    "select etat || ':' || detail from public.bb_reclamer_lot("
    + "'GOATFC-CCCC-DDDD', 'a@b.fr', 'pc', true)", base);
  dire(pasChampion === "refus:pas_de_lot",
    "un joueur qui n'a rien gagné : refusé  (" + pasChampion + ")");

  // ── 6. LE VRAI GAGNANT RÉCLAME ────────────────────────────────────────────
  const ok = await commeAnon(
    "select etat from public.bb_reclamer_lot("
    + "'goatfc-aaaa-bbbb', '  Akram@Exemple.fr ', 'ps5', true)", base);
  dire(ok === "ok", "le gagnant réclame, code en minuscules et espaces compris  (" + ok + ")");

  // ── 7. ET UNE SEULE FOIS ──────────────────────────────────────────────────
  //     L'idempotence n'est pas un luxe : un double clic ou un réseau qui repart
  //     ne doit pas ouvrir un second dossier.
  const deux = await commeAnon(
    "select etat from public.bb_reclamer_lot("
    + "'GOATFC-AAAA-BBBB', 'autre@exemple.fr', 'pc', true)", base);
  dire(deux === "deja", "une deuxième réclamation répond « déjà »  (" + deux + ")");
  const combien = await psql(["-tAc", "select count(*) from public.bb_reclamations"], base);
  dire(combien.trim() === "1", "une seule ligne enregistrée  (" + combien.trim() + ")");

  // ── 8. LE DÉLAI ───────────────────────────────────────────────────────────
  await psql(["-c", "delete from public.bb_reclamations;"
    + " update public.bb_lots set ouvert_jusqu_a = now() - interval '1 day' where season_number = 6"], base);
  const tard = await commeAnon(
    "select etat || ':' || detail from public.bb_reclamer_lot("
    + "'GOATFC-AAAA-BBBB', 'a@b.fr', 'ps5', true)", base);
  dire(tard === "refus:delai_depasse", "après le délai, c'est refusé  (" + tard + ")");
  await psql(["-c", "update public.bb_lots set ouvert_jusqu_a = now() + interval '30 days'"], base);

  // ── 9. LES DROITS — LE CŒUR DU BANC ───────────────────────────────────────
  //
  // La table contient des ADRESSES EMAIL. Si anon peut la lire, la fuite est
  // totale et silencieuse.
  await psql(["-c", "insert into public.bb_reclamations "
    + "(season_number, player_id, email, autorisation) "
    + "values (6, 'gagnant', 'prive@exemple.fr', true)"], base);
  dire(await refuse("select email from public.bb_reclamations", base),
    "anon ne peut PAS lire les adresses des réclamations");
  dire(await refuse("insert into public.bb_reclamations "
    + "(season_number, player_id, email, autorisation) "
    + "values (6, 'usurpateur', 'x@y.fr', true)", base),
    "anon ne peut PAS écrire directement dans les réclamations");
  dire(await refuse("update public.bb_reclamations set statut = 'remis'", base),
    "anon ne peut PAS changer le statut d'une réclamation");
  dire(await refuse("insert into public.bb_lots (season_number, intitule) "
    + "values (7, 'un lot que je m''invente')", base),
    "anon ne peut PAS s'inventer un lot");

  // Et ce qui doit RESTER ouvert : sans ça, l'app ne sait pas s'il faut
  // proposer la réclamation, et le bouton n'apparaît jamais.
  let lots = "";
  const lisible = await (async () => {
    try { lots = await commeAnon("select count(*) from public.bb_lots", base); return true; }
    catch { return false; }
  })();
  dire(lisible && Number(lots) >= 1,
    "anon PEUT lire la liste des lots  (" + lots + " lot(s))");

  // ── 10. LE SUIVI NE FUIT PAS L'ADRESSE ────────────────────────────────────
  const suivi = await commeAnon(
    "select statut from public.bb_etat_reclamation('GOATFC-AAAA-BBBB')", base);
  dire(suivi === "recue", "le gagnant peut suivre l'état de sa réclamation  (" + suivi + ")");
  // La fonction de suivi ne doit déclarer aucune colonne « email ».
  const sortie = await psql(["-tAc",
    "select pg_get_function_result(oid) from pg_proc where proname = 'bb_etat_reclamation'"], base);
  dire(!/email/i.test(sortie),
    "le suivi ne rend PAS l'adresse email  (" + sortie.trim().replace(/\s+/g, " ") + ")");

  return bon;
}

console.log("cluster : " + await demarrer());
const tout = await eprouver();
console.log("\n" + (tout
  ? "✅ le fichier tient. Il peut être collé dans Supabase."
  : "❌ au moins un contrôle échoue — NE PAS coller dans Supabase."));
process.exit(tout ? 0 : 1);
