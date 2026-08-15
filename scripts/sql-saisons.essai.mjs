#!/usr/bin/env node
// LANCE docs/supabase-nettoyage-saisons.sql sur un Postgres jetable, et le CONTRÔLE.
//
//     npm run sql:saisons
//
// POURQUOI CE BANC. Ce fichier-là SUPPRIME des lignes du palmarès en production.
// Relire un `delete … using` ne dit pas ce qu'il enlève : la clause se lit vite
// « les doublons », alors qu'écrite à l'envers (`a.id < b.id`) elle garderait la
// mauvaise, et écrite sans la comparaison d'id elle viderait les deux. On sème
// donc l'état RÉEL de la base — la saison 4 en double, à 43 ms d'écart — et on
// vérifie ce qui reste.
//
// Ce qu'il éprouve :
//   1. le doublon part, et c'est le PLUS ANCIEN qui reste ;
//   2. les autres saisons ne bougent pas ;
//   3. la contrainte existe et REFUSE une seconde saison 4 ;
//   4. season_month est rempli, et depuis la NUMÉROTATION (mai pour la saison 2,
//      dont la clôture est datée du 1er juin — un repli sur ended_at donnerait
//      juin) ;
//   5. le fichier est relançable : deuxième passage, rien ne change.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const lancer = promisify(execFile);
const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, "..");
const FICHIER = join(racine, "docs", "supabase-nettoyage-saisons.sql");

const PORT = process.env.PG_PORT || "5434";
const PGBIN = process.env.PGBIN || "/usr/lib/postgresql/16/bin";
const SOCKET = "/tmp";
const DONNEES = process.env.PGDATA_ESSAI || "/var/tmp/pg-goatfc-saisons";

async function psql(args, base = "postgres") {
  const { stdout, stderr } = await lancer("psql",
    ["-h", SOCKET, "-p", PORT, "-U", "postgres", "-d", base, "-v", "ON_ERROR_STOP=1", ...args],
    { maxBuffer: 1 << 24 });
  return (stdout || "") + (stderr || "");
}
const clusterVivant = async () => { try { await psql(["-tAc", "select 1"]); return true; } catch { return false; } };

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
  await lancer("su", ["postgres", "-c", `${PGBIN}/initdb -D ${DONNEES} -U postgres --auth=trust`]);
  await lancer("su", ["postgres", "-c",
    `${PGBIN}/pg_ctl -D ${DONNEES} -l ${DONNEES}/log -o '-p ${PORT} -k ${SOCKET}' start`]);
  for (let i = 0; i < 20; i++) {
    if (await clusterVivant()) return "démarré";
    await new Promise((ok) => setTimeout(ok, 300));
  }
  throw new Error("le cluster ne répond pas sur le port " + PORT);
}

// L'ÉTAT RÉEL de la table, relevé le 15 août 2026 avec la clé publique. Les
// horodatages sont ceux de la production, à la milliseconde : c'est leur écart
// de 43 ms qui prouve que le doublon est une course entre deux clients, et pas
// une double saisie.
const ETAT_REEL = `
create table public.bb_seasons (
  id             bigserial primary key,
  season_number  int not null,
  champion_name  text,
  champion_score int,
  champion_id    text,
  mode           text,
  ended_at       timestamp,
  season_month   text,
  runner_up_id   text, runner_up_name text, runner_up_xp int,
  third_id       text, third_name     text, third_xp     int
);
insert into public.bb_seasons
  (id, season_number, champion_name, champion_score, champion_id, mode, ended_at, season_month,
   runner_up_id, runner_up_name, runner_up_xp, third_id, third_name, third_xp) values
  (2, 1, 'modou',    490,   'KF6SPP', 'global', '2026-04-29T16:57:02.316368', null, null,null,null, null,null,null),
  (3, 2, 'halimouh', 2830,  'FANWCP', 'global', '2026-06-01T00:00:00',        null, null,null,null, null,null,null),
  (4, 4, 'thibault', 33700, 'BLFEF6', 'global', '2026-07-31T23:36:02.899', '2026-07', 'ZCWVX2','bybo',5555, 'E926H5','matiox',4405),
  (5, 4, 'thibault', 33700, 'BLFEF6', 'global', '2026-07-31T23:36:02.942', '2026-07', 'ZCWVX2','bybo',5555, 'E926H5','matiox',4405);
-- Poser les id à la main laisse la séquence à 1 : l'insertion suivante repart de
-- 2 et se cogne à la clé primaire. En production la séquence a suivi les
-- écritures — sans ce recalage, le banc échouerait sur un défaut qui n'existe
-- que chez lui, et ferait douter d'un fichier sain.
select setval(pg_get_serial_sequence('public.bb_seasons', 'id'),
              (select max(id) from public.bb_seasons));
`;

let ko = 0;
const dire = (bon, quoi) => { console.log((bon ? "  ✅ " : "  ❌ ") + quoi); if (!bon) ko++; };

console.log("cluster : " + await demarrer());
await psql(["-c", "drop database if exists essai_saisons"]);
await psql(["-c", "create database essai_saisons"]);
await psql(["-c", ETAT_REEL], "essai_saisons");
console.log("état réel semé : 4 lignes, dont la saison 4 en double\n");

// ── PREMIER PASSAGE ────────────────────────────────────────────────────────
await psql(["-f", FICHIER], "essai_saisons");
const lire = async (sql) => (await psql(["-tAc", sql], "essai_saisons")).trim();

console.log("après le premier passage :");
dire(await lire("select count(*) from bb_seasons") === "3", "il reste 3 saisons");
dire(await lire("select count(*) from bb_seasons where season_number = 4") === "1",
  "la saison 4 n'apparaît plus qu'une fois");
// C'est LA vérification qui compte : le delete pouvait garder la mauvaise.
dire(await lire("select id from bb_seasons where season_number = 4") === "4",
  "c'est la PREMIÈRE écrite (id 4) qui reste, pas la seconde");
dire(await lire("select string_agg(season_number::text, ',' order by season_number) from bb_seasons") === "1,2,4",
  "les numéros sont 1, 2 et 4 — le trou de juin n'est pas rebouché");
dire(await lire("select champion_name from bb_seasons where season_number = 1") === "modou",
  "les autres saisons sont intactes");

dire(await lire("select season_month from bb_seasons where season_number = 1") === "2026-04",
  "saison 1 datée d'avril 2026");
// Le piège : la clôture de la saison 2 est horodatée au 1er JUIN. Un remplissage
// qui lirait ended_at écrirait 2026-06 ; la numérotation, elle, donne mai.
dire(await lire("select season_month from bb_seasons where season_number = 2") === "2026-05",
  "saison 2 datée de MAI, pas du mois de sa clôture");
dire(await lire("select season_month from bb_seasons where season_number = 4") === "2026-07",
  "saison 4 inchangée, la fonction de clôture l'avait déjà datée");

// ── LE VERROU ──────────────────────────────────────────────────────────────
let refuse = false;
try {
  await psql(["-c", "insert into bb_seasons (season_number, champion_name) values (4, 'intrus')"], "essai_saisons");
} catch { refuse = true; }
dire(refuse, "une seconde saison 4 est REFUSÉE par la contrainte");
dire(await lire("select count(*) from bb_seasons") === "3", "et rien n'a été écrit");

// Une saison NEUVE doit rester possible : une contrainte trop large aurait pu
// fermer la porte à la clôture du 1er septembre.
await psql(["-c", "insert into bb_seasons (season_number, champion_name) values (5, 'aout')"], "essai_saisons");
dire(await lire("select count(*) from bb_seasons where season_number = 5") === "1",
  "une saison inédite passe toujours");
await psql(["-c", "delete from bb_seasons where season_number = 5"], "essai_saisons");

// ── DEUXIÈME PASSAGE ───────────────────────────────────────────────────────
// `add constraint` échoue au deuxième passage s'il n'est pas gardé, et un fichier
// qu'on n'ose relancer est un fichier qu'on relance quand même, à l'aveugle.
let relance = true;
try { await psql(["-f", FICHIER], "essai_saisons"); } catch (e) { relance = false; console.log("     " + e.message.split("\n")[0]); }
dire(relance, "le fichier se relance sans erreur");
dire(await lire("select count(*) from bb_seasons") === "3", "et n'a rien changé au deuxième passage");

console.log("\n" + (ko ? "❌ " + ko + " contrôle(s) en échec." : "✅ tous les contrôles passent."));
console.log("   Le fichier est prêt à coller dans le SQL Editor de Supabase.");
process.exit(ko ? 1 : 0);
