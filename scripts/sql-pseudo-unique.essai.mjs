#!/usr/bin/env node
// LANCE docs/supabase-pseudo-unique.sql sur un Postgres jetable, et le CONTRÔLE.
//
//     npm run sql:pseudo
//
// POURQUOI CE BANC EXISTE. docs/supabase-classement.sql a été envoyé une
// première fois sans avoir jamais été exécuté, et s'est arrêté en 42883 en
// pleine migration. Relire ne suffit pas : il faut lancer. Ce fichier-ci pose un
// index unique sur une table qui contient DÉJÀ des doublons en production — la
// création échouera si l'étape de renommage n'est pas faite d'abord, et c'est
// précisément ce qu'il faut prouver avant d'envoyer quoi que ce soit.
//
// Le banc reproduit la production telle qu'elle est : quatre paires de pseudos
// ne différant que par la majuscule.
//
// CE QU'IL ÉPROUVE, dans cet ordre :
//   1. l'étape 1 VOIT les conflits (sinon on renomme à l'aveugle) ;
//   2. l'index REFUSE de se créer tant qu'ils sont là — l'avertissement du
//      fichier est vrai, pas décoratif ;
//   3. le renommage les résout ET propage dans les colonnes dénormalisées ;
//   4. l'index se crée alors ;
//   5. il MORD : un doublon de casse est refusé, et le bloc de l'étape 4 le
//      démontre sans rien laisser derrière lui ;
//   6. il laisse passer un pseudo légitime — un index qui refuse tout serait
//      aussi « vert » sur le contrôle 5.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const lancer = promisify(execFile);
const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, "..");
const D = (f) => join(racine, "docs", f);

const PORT = process.env.PG_PORT || "5433";
const PGBIN = process.env.PGBIN || "/usr/lib/postgresql/16/bin";
const SOCKET = "/tmp";
// Le cluster tourne sous l'utilisateur `postgres` : Postgres refuse de démarrer
// en root, et /tmp d'un bac à sable de session ne lui est pas accessible.
const DONNEES = process.env.PGDATA_ESSAI || "/var/tmp/pg-goatfc-pseudo";
const BASE = "essai_pseudo";

async function psql(args, base = "postgres") {
  const { stdout, stderr } = await lancer("psql",
    ["-h", SOCKET, "-p", PORT, "-U", "postgres", "-d", base, "-v", "ON_ERROR_STOP=1", ...args],
    { maxBuffer: 1 << 24 });
  return (stdout || "") + (stderr || "");
}
const q = (sql) => psql(["-tAc", sql], BASE);

async function vivant() { try { await psql(["-tAc", "select 1"]); return true; } catch { return false; } }

async function demarrer() {
  if (await vivant()) return "déjà en route";
  try { await lancer("bash", ["-c", `test -x ${PGBIN}/initdb`]); }
  catch {
    console.error("Postgres introuvable dans " + PGBIN
      + "\n  Règle PGBIN sur le dossier des binaires (initdb, pg_ctl).");
    process.exit(2);
  }
  await lancer("bash", ["-c",
    `rm -rf ${DONNEES} && mkdir -p ${DONNEES} && chown postgres:postgres ${DONNEES} && chmod 700 ${DONNEES}`]);
  await lancer("su", ["postgres", "-c", `${PGBIN}/initdb -D ${DONNEES} -U postgres --auth=trust`]);
  await lancer("su", ["postgres", "-c",
    `${PGBIN}/pg_ctl -D ${DONNEES} -l ${DONNEES}/log -o '-p ${PORT} -k ${SOCKET}' start`]);
  for (let i = 0; i < 20; i++) {
    if (await vivant()) return "démarré";
    await new Promise((ok) => setTimeout(ok, 300));
  }
  throw new Error("le cluster ne répond pas sur le port " + PORT);
}

/** Joue un fichier SQL, en rendant la sortie. */
async function fichier(chemin) { return psql(["-f", chemin], BASE); }

/** Joue un morceau de SQL passé en texte, via un fichier temporaire. */
async function bout(sql, dossier, nom) {
  const p = join(dossier, nom + ".sql");
  await writeFile(p, sql);
  return fichier(p);
}

let bon = true;
const dire = (ok, t) => { if (!ok) bon = false; console.log((ok ? "✅ " : "❌ ") + t); };

// ── LES DOUBLONS DE PRODUCTION, relevés le 13 août 2026 sur 235 comptes ─────
// Trois des quatre paires suffisent à couvrir les cas ; la quatrième
// (faridprezu94) est gardée parce qu'elle fait DÉJÀ 12 caractères, la longueur
// maximale : c'est le seul cas où le renommage ne peut pas juste suffixer.
const PAIRES = [
  ["4TJKHN", "akram"], ["CWH84T", "Akram"],
  ["TJ7BJM", "Badbr"], ["42CW76", "BADBR"],
  ["J3V8XK", "faridprezu94"], ["57ZKBX", "Faridprezu94"],
  ["X2QCPE", "sodinho"], ["PJJHUA", "Sodinho"],
];

const tmp = await mkdtemp(join(tmpdir(), "goatfc-pseudo-"));
try {
  console.log("── cluster :", await demarrer(), "\n");
  await psql(["-tAc", `drop database if exists ${BASE}`]);
  await psql(["-tAc", `create database ${BASE}`]);

  // Le schéma de production, puis la modération et le renommage : le fichier à
  // éprouver appelle bb_renommer_pseudo, qui appelle bb_pseudo_interdit.
  //
  // `-v type_score` : le schéma d'essai paramètre le type de bb_scores.score,
  // parce que la sonde de type prouve qu'il n'est pas entier sans dire s'il est
  // numeric ou double precision. Ici le type du score n'entre pas en jeu — c'est
  // la table des pseudos qu'on éprouve — mais le fichier l'exige.
  await psql(["-v", "type_score=numeric", "-f", D("supabase-classement.essai.sql")], BASE);
  await fichier(D("supabase-pseudos-interdits.sql"));
  await fichier(D("supabase-renommer-pseudo.sql"));

  // On repart d'une table propre, puis on y met EXACTEMENT les doublons vus en
  // production. Le schéma d'essai insère ses propres lignes ; on les garde, elles
  // servent de témoins « pseudos sains ».
  for (const [id, p] of PAIRES) {
    await q(`insert into public.bb_pseudos (player_id, pseudo) values ('${id}', '${p}')
             on conflict (player_id) do update set pseudo = excluded.pseudo`);
  }
  // Une copie dénormalisée, pour prouver que le renommage la suit. C'est LE
  // piège de cette table : le pseudo est recopié dans une dizaine de colonnes.
  await q(`insert into public.bb_scores (player_id, player_name, mode, score, created_at)
           values ('CWH84T', 'Akram', 'pont', 120, now())`);
  const copies = await q(`select count(*) from public.bb_scores where lower(player_name) = 'akram'`);
  console.log("── posé :", PAIRES.length, "comptes en doublon de casse,",
    copies.trim(), "copie(s) dénormalisée(s)\n");

  // ── 1. L'ÉTAPE 1 VOIT-ELLE LES CONFLITS ? ────────────────────────────────
  const conflits = await q(`select count(*) from (
      select lower(pseudo) from public.bb_pseudos group by lower(pseudo) having count(*) > 1) x`);
  dire(Number(conflits) === 4, "l'étape 1 voit " + conflits.trim() + " conflit(s) (4 attendus)");

  // ── 2. L'INDEX REFUSE-T-IL DE SE CRÉER AVANT LE MÉNAGE ? ─────────────────
  // Le contrôle qui donne sa valeur à l'avertissement du fichier. Sans lui, on
  // écrirait « il faut d'abord renommer » sans savoir si c'est vrai.
  let refus = "";
  try {
    await q(`create unique index bb_essai_ci on public.bb_pseudos (lower(pseudo))`);
  } catch (e) { refus = String(e.stderr || e.message || ""); }
  dire(/duplicate|unique/i.test(refus),
    refus ? "l'index est REFUSÉ tant que les doublons sont là (" + (refus.match(/ERROR:[^\n]*/) || ["?"])[0].slice(7, 70).trim() + ")"
          : "L'INDEX S'EST CRÉÉ MALGRÉ LES DOUBLONS — l'avertissement du fichier serait faux");

  // ── 3. LE RENOMMAGE RÉSOUT-IL, ET PROPAGE-T-IL ? ─────────────────────────
  const sortie = await bout(`
    select * from public.bb_renommer_pseudo('CWH84T', 'akram2');
    select * from public.bb_renommer_pseudo('42CW76', 'badbr2');
    select * from public.bb_renommer_pseudo('57ZKBX', 'faridprezu9');
    select * from public.bb_renommer_pseudo('PJJHUA', 'sodinho2');
  `, tmp, "renommage");
  const restants = await q(`select count(*) from (
      select lower(pseudo) from public.bb_pseudos group by lower(pseudo) having count(*) > 1) x`);
  dire(Number(restants) === 0, "après renommage : " + restants.trim() + " conflit(s) restant(s)");
  const copieSuivie = await q(`select player_name from public.bb_scores where player_id = 'CWH84T'`);
  dire(copieSuivie.trim() === "akram2",
    "la copie dénormalisée suit : bb_scores.player_name = « " + copieSuivie.trim() + " »");
  // Le cas long : 12 caractères, on ne pouvait pas suffixer.
  const long = await q(`select pseudo from public.bb_pseudos where player_id = '57ZKBX'`);
  dire(long.trim() === "faridprezu9" && long.trim().length <= 12,
    "le pseudo de 12 caractères est renommé dans le format : « " + long.trim() + " »");

  // ── 4. LE FICHIER À ÉPROUVER, EN ENTIER ──────────────────────────────────
  // Étapes 1, 3 et 4 telles qu'elles sont écrites. L'étape 2 est en commentaire
  // dans le fichier (elle demande de choisir qui garde son nom) : on vient de la
  // jouer ci-dessus, à sa place.
  const journal = await fichier(D("supabase-pseudo-unique.sql"));
  const cree = await q(`select count(*) from pg_indexes
                         where indexname = 'bb_pseudos_pseudo_unique_ci'`);
  dire(Number(cree) === 1, "l'index bb_pseudos_pseudo_unique_ci est créé");

  // ── 5. LE BLOC D'AUTO-CONTRÔLE DU FICHIER A-T-IL MORDU ? ─────────────────
  // Il doit annoncer le refus, et surtout ne RIEN laisser derrière lui.
  dire(/OK : le doublon .* refuse/i.test(journal.replace(/[éÉ]/g, "e")),
    "l'étape 4 du fichier annonce le refus du doublon");
  const residu = await q(`select count(*) from public.bb_pseudos where player_id = 'ZZTEST'`);
  dire(Number(residu) === 0, "le bloc d'essai ne laisse AUCUNE ligne derrière lui");
  dire(/un pseudo par joueur/.test(journal), "le verdict final du fichier est au vert");

  // ── 6. L'INDEX MORD-IL VRAIMENT, ET SEULEMENT LÀ OÙ IL FAUT ? ────────────
  // Un index qui refuserait TOUT passerait aussi le contrôle 5. On éprouve donc
  // les deux sens : le doublon refusé, le pseudo légitime accepté.
  let bloque = "";
  try { await q(`insert into public.bb_pseudos (player_id, pseudo) values ('NEUF01','AKRAM2')`); }
  catch (e) { bloque = String(e.stderr || e.message || ""); }
  dire(/unique|duplicate/i.test(bloque), "« AKRAM2 » face à « akram2 » : refusé");
  let libre = true;
  try { await q(`insert into public.bb_pseudos (player_id, pseudo) values ('NEUF02','zidane10')`); }
  catch { libre = false; }
  dire(libre, "« zidane10 », libre : accepté");
  // Et le renommage vers un nom pris doit être refusé par la FONCTION, avec un
  // message lisible, avant même que l'index n'ait à s'en mêler.
  let parFonction = "";
  try { await q(`select * from public.bb_renommer_pseudo('NEUF02', 'akram2')`); }
  catch (e) { parFonction = String(e.stderr || e.message || ""); }
  dire(/deja pris/i.test(parFonction.replace(/[éÉ]/g, "e")),
    "la fonction de renommage refuse un nom pris, avec un message clair");

} finally {
  await rm(tmp, { recursive: true, force: true });
  if (!process.env.GARDER_CLUSTER) {
    await lancer("su", ["postgres", "-c", `${PGBIN}/pg_ctl -D ${DONNEES} stop -m fast`]).catch(() => {});
    await lancer("bash", ["-c", `rm -rf ${DONNEES}`]).catch(() => {});
  }
}

console.log("\n" + (bon ? "✅ le fichier fait ce qu'il promet." : "❌ le fichier ne tient pas ses promesses."));
process.exit(bon ? 0 : 1);
