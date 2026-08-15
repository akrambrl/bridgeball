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

// ── LE SCHÉMA VIENT DU BANC DU CLASSEMENT, PAS D'UNE COPIE ────────────────
//
// bb_reclamer_lot appelle bb_classement_mois pour RECALCULER le rang. Le banc
// doit donc poser le vrai classement, pas un champion écrit à la main : sinon
// il éprouverait une fonction différente de celle qui tournera en production.
// On rejoue donc docs/supabase-classement.essai.sql (les tables, aux types
// mesurés) puis docs/supabase-classement.sql (les fonctions), avant notre
// fichier.
const SCHEMA_CLASSEMENT = join(racine, "docs", "supabase-classement.essai.sql");
const FONCTIONS_CLASSEMENT = join(racine, "docs", "supabase-classement.sql");

// Quatre joueurs, des scores qui donnent un podium NET : 1er, 2e, 3e, 4e. Le
// quatrième est celui qui compte le plus dans ce banc — c'est lui qui ne doit
// rien pouvoir réclamer.
const JEU = `
insert into public.bb_pseudos (player_id, pseudo, recovery_code) values
  ('or',     'akram2',   'GOATFC-AAAA-BBBB'),
  ('argent', 'badbr2',   'GOATFC-CCCC-DDDD'),
  ('bronze', 'faridp9',  'GOATFC-EEEE-FFFF'),
  ('quatre', 'sodinho2', 'GOATFC-GGGG-HHHH');

-- Des scores en SEPTEMBRE 2026, le mois de la saison 6. Chacun joue plusieurs
-- jours et plusieurs modes, sinon le classement les écarte.
--
-- LE DÉCLENCHEUR ANTI-SPAM EST DÉSACTIVÉ LE TEMPS DE POSER LE JEU D'ESSAI.
-- bb_scores_garde() refuse deux scores du même joueur dans le même mode à moins
-- de dix secondes d'intervalle — c'est exactement son travail, et il l'a fait :
-- il a rejeté cette insertion groupée. On le contourne pour SEMER, jamais pour
-- éprouver : les contrôles qui suivent passent tous par la fonction publique,
-- avec ses gardes en place.
alter table public.bb_scores disable trigger user;

insert into public.bb_scores (player_id, player_name, mode, score, created_at)
select j.pid, j.nom, m.mode, j.base + m.bonus,
       timestamptz '2026-09-05 12:00:00+02' + (d || ' day')::interval
  from (values ('or','akram2',900), ('argent','badbr2',700),
               ('bronze','faridp9',500), ('quatre','sodinho2',300)) as j(pid,nom,base),
       (values ('pont',0), ('chaine',-40)) as m(mode,bonus),
       generate_series(0, 3) as d;

alter table public.bb_scores enable trigger user;

-- La saison 6 est CLOSE : c'est cette ligne qui ouvre la réclamation.
insert into public.bb_seasons (season_number, champion_id, champion_name, champion_score, mode, ended_at)
values (6, 'or', 'akram2', 4200, 'global', now());

-- La saison 5 est close AUSSI mais ne porte aucun lot : son champion ne doit
-- rien pouvoir réclamer.
insert into public.bb_seasons (season_number, champion_id, champion_name, champion_score, mode, ended_at)
values (5, 'quatre', 'sodinho2', 3900, 'global', now());
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
  // Le type du score est éprouvé en numeric : le banc du classement le passe
  // aussi en double precision, et le nôtre n'en dépend pas.
  await psql(["-v", "type_score=numeric", "-f", SCHEMA_CLASSEMENT], base);
  await psql(["-f", FONCTIONS_CLASSEMENT], base);
  await psql(["-c", JEU], base);
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

  // ── 4. LE PODIUM EST BIEN CELUI QU'ON CROIT ───────────────────────────────
  //     On lit le classement réel avant de réclamer quoi que ce soit : si le
  //     jeu d'essai ne produit pas le podium attendu, tous les contrôles qui
  //     suivent ne prouveraient rien.
  const podium = await commeAnon(
    "select string_agg(player_id, ',' order by points desc, jours desc, pseudo asc) "
    + "from public.bb_classement_mois('2026-09')", base);
  dire(podium === "or,argent,bronze,quatre",
    "le classement de septembre est bien or > argent > bronze > quatre  (" + podium + ")");
  const mois = await commeAnon("select public.bb_mois_de_saison(6)", base);
  dire(mois === "2026-09", "la saison 6 est bien septembre 2026  (" + mois + ")");

  // ── 5. LES TROIS RANGS RÉCOMPENSÉS RÉCLAMENT ──────────────────────────────
  for (const [code, qui, rangAttendu] of [
    ["GOATFC-AAAA-BBBB", "1er", 1],
    ["GOATFC-CCCC-DDDD", "2e",  2],
    ["GOATFC-EEEE-FFFF", "3e",  3],
  ]) {
    const r = await commeAnon(
      "select etat || ':' || detail from public.bb_reclamer_lot("
      + "'" + code + "', 'a@b.fr', 'ps5', true)", base);
    const attendu = new RegExp("^ok:GOATFC-LOT-6-" + rangAttendu + "-");
    dire(attendu.test(r), "le " + qui + " réclame, et son rang est " + rangAttendu + "  (" + r + ")");
  }

  // ── 6. LE QUATRIÈME NE RÉCLAME RIEN ───────────────────────────────────────
  //     LE contrôle de ce banc. Trois lots, quatre joueurs : celui qui rate le
  //     podium d'une place ne doit rien recevoir, et c'est aussi celui qui est
  //     le plus tenté d'essayer.
  const quatre = await commeAnon(
    "select etat || ':' || detail from public.bb_reclamer_lot("
    + "'GOATFC-GGGG-HHHH', 'a@b.fr', 'pc', true)", base);
  dire(quatre === "refus:pas_de_lot",
    "le 4e ne réclame rien, alors qu'il est champion d'une saison SANS lot  ("
    + quatre + ")");

  // ── 7. ET UNE SEULE FOIS ──────────────────────────────────────────────────
  //     L'idempotence n'est pas un luxe : un double clic ou un réseau qui repart
  //     ne doit pas ouvrir un second dossier.
  const deux = await commeAnon(
    "select etat from public.bb_reclamer_lot("
    + "'GOATFC-AAAA-BBBB', 'autre@exemple.fr', 'pc', true)", base);
  dire(deux === "deja", "une deuxième réclamation répond « déjà »  (" + deux + ")");
  const combien = await psql(["-tAc", "select count(*) from public.bb_reclamations"], base);
  dire(combien.trim() === "3", "trois lignes enregistrées, une par gagnant  (" + combien.trim() + ")");
  const rangs = await psql(["-tAc",
    "select string_agg(rang || ':' || player_id, ' ' order by rang) from public.bb_reclamations"], base);
  dire(rangs.trim() === "1:or 2:argent 3:bronze",
    "chaque réclamation porte le bon rang  (" + rangs.trim() + ")");

  // ── 7 bis. UN PODIUM QUI SE CORRIGE ───────────────────────────────────────
  //     Le rang est RECALCULÉ, pas figé. Si les scores d'un tricheur sont
  //     effacés après la clôture, le 4e devient 3e — et il peut réclamer.
  //     C'est la propriété qui distingue ce modèle d'un podium gravé à la
  //     clôture, lequel aurait donné le lot au tricheur.
  await psql(["-c", "delete from public.bb_reclamations;"
    + " delete from public.bb_scores where player_id = 'bronze'"], base);
  const promu = await commeAnon(
    "select etat || ':' || detail from public.bb_reclamer_lot("
    + "'GOATFC-GGGG-HHHH', 'a@b.fr', 'pc', true)", base);
  dire(/^ok:GOATFC-LOT-6-3-/.test(promu),
    "le 4e devient 3e quand le bronze est écarté des scores  (" + promu + ")");
  // On remet le jeu d'essai en état pour la suite.
  await psql(["-c", "delete from public.bb_reclamations"], base);

  // ── 8. LE DÉLAI ───────────────────────────────────────────────────────────
  await psql(["-c", "delete from public.bb_reclamations;"
    + " update public.bb_lots set ouvert_jusqu_a = now() - interval '1 day'"], base);
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
    + "(season_number, rang, player_id, email, autorisation) "
    + "values (6, 1, 'or', 'prive@exemple.fr', true)"], base);
  dire(await refuse("select email from public.bb_reclamations", base),
    "anon ne peut PAS lire les adresses des réclamations");
  dire(await refuse("insert into public.bb_reclamations "
    + "(season_number, rang, player_id, email, autorisation) "
    + "values (6, 1, 'usurpateur', 'x@y.fr', true)", base),
    "anon ne peut PAS écrire directement dans les réclamations");
  dire(await refuse("update public.bb_reclamations set statut = 'remis'", base),
    "anon ne peut PAS changer le statut d'une réclamation");
  dire(await refuse("insert into public.bb_lots (season_number, rang, intitule) "
    + "values (7, 1, 'un lot que je m''invente')", base),
    "anon ne peut PAS s'inventer un lot");

  // Et ce qui doit RESTER ouvert : sans ça, l'app ne sait pas s'il faut
  // proposer la réclamation, et le bouton n'apparaît jamais.
  let lots = "";
  const lisible = await (async () => {
    try { lots = await commeAnon("select count(*) from public.bb_lots", base); return true; }
    catch { return false; }
  })();
  dire(lisible && Number(lots) === 3,
    "anon PEUT lire les TROIS lots  (" + lots + ")");

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
