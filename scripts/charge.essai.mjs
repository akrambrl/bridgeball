#!/usr/bin/env node
// BANC DE CHARGE — salles à 8 joueurs, et 200 joueurs simultanés.
//
//     npm run sql:charge
//
// CE QU'IL ÉPROUVE, ET POURQUOI ÇA NE SE VOIT PAS EN LISANT LE CODE
//
// Les trois systèmes de salle de GOAT FC rangent leurs joueurs dans une colonne
// `players` de type jsonb — un TABLEAU ENTIER réécrit à chaque arrivée. Le
// client lit le tableau, s'y ajoute, et réécrit le tout. Entre la lecture et
// l'écriture il y a un aller-retour réseau, et pendant ce temps quelqu'un
// d'autre a pu écrire : sa version est alors écrasée. C'est la mise à jour
// perdue, le défaut de concurrence le plus classique qui soit, et il est
// invisible à un joueur seul — donc invisible à tout essai fait à la main.
//
// Les trois algorithmes ne se défendent PAS pareil, et c'est tout l'objet du
// banc :
//
//   • bb_rooms (The Plug / The Mercato) — `joinRoom()` réécrit, PUIS RELIT pour
//     vérifier qu'il est bien dans la liste, et recommence jusqu'à cinq fois
//     avec une attente aléatoire. C'est une reprise optimiste : elle ne
//     supprime pas la collision, elle la rattrape.
//
//   • bb_gg_rooms (GOAT BATTLE) — `ggBattleJoinRoom()` réécrit et s'arrête là.
//     Ni relecture, ni reprise. Et il affiche le salon avec lui-même dedans
//     quoi qu'il arrive : le joueur éjecté CROIT être entré.
//
//   • bb_duel_rooms (GOAT DUEL) — 1 contre 1, deux colonnes au lieu d'un
//     tableau. `duelJoinRoom()` vérifie que `guest_id` est libre, puis l'occupe.
//     Le trou entre le contrôle et l'écriture est le même.
//
// POURQUOI UN POSTGRES LOCAL. Lancer 200 écrivains concurrents sur la vraie base
// y injecterait des milliers de lignes fausses la semaine de la sortie, sur une
// offre gratuite, avec le risque de se faire limiter. Ce qu'on mesure — la
// sémantique d'un `update` concurrent, un index unique, une vue d'agrégation —
// est du Postgres et ne dépend pas de l'hébergeur.
//
// POURQUOI DES PROCESSUS SÉPARÉS. Chaque requête PostgREST est sa PROPRE
// transaction : la lecture est validée et les verrous relâchés avant que
// l'écriture ne parte. Mettre lecture et écriture dans la même transaction
// plpgsql donnerait un résultat FAUX — la seconde attendrait le verrou de la
// première et rien ne serait perdu. Un `psql` par requête reproduit la vraie
// architecture.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const lancer = promisify(execFile);
const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, "..");
const SCHEMA = join(racine, "docs", "supabase-charge.essai.sql");

const PORT = process.env.PG_PORT || "5434";
const PGBIN = process.env.PGBIN || "/usr/lib/postgresql/16/bin";
const SOCKET = "/tmp";
const DONNEES = process.env.PGDATA_CHARGE || "/var/tmp/pg-goatfc-charge";
const BASE = "charge";

// 200 sessions en même temps, c'est le sujet : le défaut de Postgres est 100, et
// on veut mesurer 200 RÉELLEMENT concurrents, pas 200 mis en file d'attente.
const MAX_CONN = 320;

async function psql(sql, base = BASE, tolerant = false) {
  try {
    const { stdout, stderr } = await lancer("psql",
      ["-h", SOCKET, "-p", PORT, "-U", "postgres", "-d", base, "-tAq",
       ...(tolerant ? [] : ["-v", "ON_ERROR_STOP=1"]), "-c", sql],
      { maxBuffer: 1 << 26 });
    return { ok: true, out: (stdout || "").trim(), err: (stderr || "").trim() };
  } catch (e) {
    return { ok: false, out: (e.stdout || "").trim(), err: (e.stderr || String(e)).trim() };
  }
}

async function vivant() {
  return (await psql("select 1", "postgres")).ok;
}

async function demarrer() {
  if (await vivant()) return "déjà en route";
  try { await lancer("bash", ["-c", `test -x ${PGBIN}/initdb`]); }
  catch {
    console.error("Postgres introuvable dans " + PGBIN);
    process.exit(2);
  }
  await lancer("bash", ["-c",
    `rm -rf ${DONNEES} && mkdir -p ${DONNEES} && chown postgres:postgres ${DONNEES} && chmod 700 ${DONNEES}`]);
  await lancer("su", ["postgres", "-c", `${PGBIN}/initdb -D ${DONNEES} -U postgres --auth=trust`]);
  await lancer("su", ["postgres", "-c",
    `${PGBIN}/pg_ctl -D ${DONNEES} -l ${DONNEES}/log`
    + ` -o '-p ${PORT} -k ${SOCKET} -c max_connections=${MAX_CONN}' start`]);
  for (let i = 0; i < 30; i++) {
    if (await vivant()) return "démarré";
    await new Promise((ok) => setTimeout(ok, 300));
  }
  throw new Error("le cluster ne répond pas sur le port " + PORT);
}

const jsonSql = (v) => "$json$" + JSON.stringify(v) + "$json$";
const dodo = (ms) => new Promise((ok) => setTimeout(ok, ms));
/** Une latence de trajet plausible, et VARIABLE : c'est la variance qui crée les
 *  entrelacements ; une latence fixe les alignerait artificiellement. */
const latence = () => 20 + Math.random() * 120;

// ══════════════════════════════════════════════════════════════════════════
//  A. GOAT BATTLE — sept arrivées, aucune reprise
// ══════════════════════════════════════════════════════════════════════════
async function battle8() {
  await psql("truncate public.bb_gg_rooms");
  await psql(`insert into public.bb_gg_rooms (id, code, host_id, players)
              values (1, 'BATL01', 'hote', ${jsonSql([{ id: "hote", name: "hote" }])}::jsonb)`);

  // Fidèle à ggBattleJoinRoom() : lire, ajouter, PATCH. Rien d'autre.
  const client = async (n) => {
    const moi = "j" + n;
    const lu = await psql("select players from public.bb_gg_rooms where id = 1");
    const joueurs = JSON.parse(lu.out || "[]");
    await dodo(latence());
    if (joueurs.find((p) => p.id === moi)) return;
    if (joueurs.length >= 8) return;
    joueurs.push({ id: moi, name: moi, score: 0, lives_left: 3 });
    await psql(`update public.bb_gg_rooms set players = ${jsonSql(joueurs)}::jsonb where id = 1`);
  };

  await Promise.all(Array.from({ length: 7 }, (_, i) => client(i + 1)));
  return Number((await psql(
    "select jsonb_array_length(players) from public.bb_gg_rooms where id = 1")).out);
}

// ══════════════════════════════════════════════════════════════════════════
//  B. The Plug / The Mercato — sept arrivées, avec reprise et vérification
// ══════════════════════════════════════════════════════════════════════════
async function plug8() {
  await psql("truncate public.bb_rooms");
  const salle = (await psql(`insert into public.bb_rooms (code, host_id, host_name, players)
    values ('PLUG01', 'hote', 'hote',
      ${jsonSql([{ id: "hote", name: "hote", score: null, status: "waiting" }])}::jsonb)
    returning id`)).out;

  // Fidèle à joinRoom() : cinq tentatives, PATCH puis RELECTURE de contrôle,
  // attente croissante et aléatoire entre deux essais.
  const client = async (n) => {
    const moi = "j" + n;
    for (let essai = 1; essai <= 5; essai++) {
      const lu = await psql(`select players from public.bb_rooms where id = '${salle}'`);
      const joueurs = JSON.parse(lu.out || "[]");
      if (joueurs.find((p) => p.id === moi)) return { moi, essai, entre: true };
      if (joueurs.length >= 8) return { moi, essai, entre: false, motif: "salle vue pleine" };
      joueurs.push({ id: moi, name: moi, score: null, status: "waiting" });
      await dodo(latence());
      await psql(`update public.bb_rooms set players = ${jsonSql(joueurs)}::jsonb where id = '${salle}'`);
      await dodo(200 + Math.random() * 300);
      const verif = await psql(`select players from public.bb_rooms where id = '${salle}'`);
      if (JSON.parse(verif.out || "[]").find((p) => p.id === moi)) return { moi, essai, entre: true };
      await dodo(300 + essai * 200 + Math.random() * 200);
    }
    return { moi, essai: 5, entre: false, motif: "abandon après 5 essais" };
  };

  const res = await Promise.all(Array.from({ length: 7 }, (_, i) => client(i + 1)));
  const dedans = Number((await psql(
    `select jsonb_array_length(players) from public.bb_rooms where id = '${salle}'`)).out);
  return { dedans, res };
}

// ══════════════════════════════════════════════════════════════════════════
//  C. GOAT DUEL — deux invités pour une seule place
// ══════════════════════════════════════════════════════════════════════════
async function duel2() {
  await psql("truncate public.bb_duel_rooms");
  const salle = (await psql(`insert into public.bb_duel_rooms (code, host_id)
                             values ('DUEL01', 'hote') returning id`)).out;

  const client = async (n) => {
    const moi = "j" + n;
    const lu = await psql(`select coalesce(guest_id,'') from public.bb_duel_rooms where id = '${salle}'`);
    await dodo(latence());
    if (lu.out) return { moi, entre: false, motif: "salon vu complet" };
    await psql(`update public.bb_duel_rooms
                set guest_id = '${moi}', guest_name = '${moi}' where id = '${salle}'`);
    return { moi, entre: true };
  };

  const res = await Promise.all([client(1), client(2)]);
  const retenu = (await psql(
    `select coalesce(guest_id,'—') from public.bb_duel_rooms where id = '${salle}'`)).out;
  return { retenu, res };
}

// ══════════════════════════════════════════════════════════════════════════
//  D. 200 JOUEURS SIMULTANÉS
// ══════════════════════════════════════════════════════════════════════════
async function charge200() {
  await psql("truncate public.bb_scores, public.bb_gg_scores, public.bb_pseudos");
  const MODES = ["pont", "chaine", "findscore", "mercatoday", "findplayer", "findstreak"];
  const t0 = Date.now();

  // Chaque joueur : réserver son pseudo, poser trois scores, lire le classement.
  // Une invocation psql par joueur, mais 200 processus en vol en même temps —
  // donc 200 sessions réellement concurrentes.
  const joueur = async (n) => {
    const pid = "p" + n;
    const sql = [
      `insert into public.bb_pseudos (player_id, pseudo, xp, xp_season, xp_season_month)
         values ('${pid}', 'joueur${n}', ${n * 37}, ${n * 11}, '2026-08')`,
      `insert into public.bb_scores (player_id, player_name, mode, score)
         values ('${pid}', 'joueur${n}', '${MODES[n % MODES.length]}', ${100 + (n % 900)})`,
      `insert into public.bb_scores (player_id, player_name, mode, score)
         values ('${pid}', 'joueur${n}', '${MODES[(n + 1) % MODES.length]}', ${50 + (n % 400)})`,
      `insert into public.bb_gg_scores (player_id, score, vie_rachetee)
         values ('${pid}', ${200 + (n % 600)}, ${n % 5 === 0})`,
      "select count(*) from public.bb_classement_courant()",
    ].join("; ");
    const r = await psql(sql, BASE, true);
    return { pid, ok: r.ok, err: r.err };
  };

  const res = await Promise.all(Array.from({ length: 200 }, (_, i) => joueur(i + 1)));
  const ms = Date.now() - t0;
  const rates = res.filter((r) => !r.ok);
  const [pseudos, scores, gg, classes] = (await psql(`select
      (select count(*) from public.bb_pseudos),
      (select count(*) from public.bb_scores),
      (select count(*) from public.bb_gg_scores),
      (select count(*) from public.bb_classement_courant())`)).out.split("|").map(Number);

  const tc = Date.now();
  const tete = (await psql(
    "select player_id || ' → ' || points from public.bb_classement_courant() limit 1")).out;
  const msClassement = Date.now() - tc;

  return { ms, msClassement, rates, pseudos, scores, gg, classes, tete };
}

// ══════════════════════════════════════════════════════════════════════════
//  E. L'INDEX UNIQUE SOUS CONCURRENCE — 40 joueurs, un seul pseudo
// ══════════════════════════════════════════════════════════════════════════
async function memePseudo() {
  await psql("truncate public.bb_pseudos");
  // Casse mélangée exprès : c'est le défaut constaté en production — quatre
  // doublons qui ne différaient que par la casse, le contrôle client ne voyant
  // rien parce qu'il interroge AVANT d'écrire.
  const formes = ["Akram", "akram", "AKRAM", "AkRaM"];
  const client = async (n) => {
    const forme = formes[n % formes.length];
    const lu = await psql(
      `select count(*) from public.bb_pseudos where lower(pseudo) = lower('${forme}')`);
    await dodo(latence());
    if (Number(lu.out) > 0) return { n, pose: false, motif: "vu comme pris" };
    const r = await psql(`insert into public.bb_pseudos (player_id, pseudo)
                          values ('u${n}', '${forme}')`, BASE, true);
    return { n, pose: r.ok, motif: r.ok ? "posé" : "refusé par l'index" };
  };
  const res = await Promise.all(Array.from({ length: 40 }, (_, i) => client(i + 1)));
  const lignes = Number((await psql(
    "select count(*) from public.bb_pseudos where pseudo is not null")).out);
  return { lignes, res };
}

// ══════════════════════════════════════════════════════════════════════════
//  F. LE TYPE DE `players` — le client écrit-il un tableau, ou une chaîne ?
// ══════════════════════════════════════════════════════════════════════════
async function typePlayers() {
  await psql("truncate public.bb_rooms");
  const salle = (await psql(`insert into public.bb_rooms (code, host_id, players)
    values ('TYPE01', 'h', ${jsonSql([{ id: "h" }])}::jsonb) returning id`)).out;
  const apresCreate = (await psql(
    `select jsonb_typeof(players) from public.bb_rooms where id = '${salle}'`)).out;
  // `joinRoom()` envoie JSON.stringify(newPlayers) : PostgREST transmet donc une
  // CHAÎNE JSON dans une colonne jsonb, pas un tableau.
  const chaine = JSON.stringify([{ id: "h" }, { id: "j1" }]);
  await psql(`update public.bb_rooms set players = to_jsonb(${jsonSql(chaine)}::text)
              where id = '${salle}'`);
  const apresJoin = (await psql(
    `select jsonb_typeof(players) from public.bb_rooms where id = '${salle}'`)).out;
  const l = await psql(
    `select jsonb_array_length(players) from public.bb_rooms where id = '${salle}'`, BASE, true);
  return { apresCreate, apresJoin,
           arrayLength: l.ok ? l.out : "ERREUR — " + (l.err.split("\n")[0] || "").slice(0, 70) };
}

// ══════════════════════════════════════════════════════════════════════════
const ligne = (etat, txt) => console.log("  " + etat + " " + txt);
let defauts = 0;

console.log("\n═══ BANC DE CHARGE GOAT FC ═══════════════════════════════════════════");
console.log("  cluster : " + (await demarrer()));
await psql(`drop database if exists ${BASE}`, "postgres");
await psql(`create database ${BASE}`, "postgres");
await lancer("psql", ["-h", SOCKET, "-p", PORT, "-U", "postgres", "-d", BASE,
  "-v", "ON_ERROR_STOP=1", "-q", "-f", SCHEMA], { maxBuffer: 1 << 24 });
console.log("  schéma  : posé");

console.log("\n── A · GOAT BATTLE : 7 joueurs rejoignent l'hôte en même temps");
{
  const dedans = await battle8();
  if (dedans < 8) {
    defauts++;
    ligne("✗", `${dedans}/8 joueurs dans la salle — ${8 - dedans} PERDUS`);
    ligne(" ", "ggBattleJoinRoom() ne relit pas et ne reprend pas : le dernier PATCH");
    ligne(" ", "écrase les autres. Et il ouvre le salon quand même, donc l'éjecté");
    ligne(" ", "croit être entré — il attend une partie qui se lancera sans lui.");
  } else ligne("✓", `${dedans}/8 joueurs`);
}

console.log("\n── B · The Plug : 7 joueurs rejoignent l'hôte en même temps");
{
  const { dedans, res } = await plug8();
  const entres = res.filter((r) => r.entre).length;
  if (dedans === 8 && entres === 7) {
    ligne("✓", `${dedans}/8 joueurs — la reprise rattrape (essais : `
      + res.map((r) => r.essai).join(",") + ")");
  } else {
    defauts++;
    ligne("✗", `${dedans}/8 en base, ${entres}/7 se croient entrés`);
    for (const r of res.filter((x) => !x.entre)) ligne(" ", `${r.moi} : ${r.motif}`);
  }
}

console.log("\n── C · GOAT DUEL : 2 invités pour 1 place");
{
  const { retenu, res } = await duel2();
  const croient = res.filter((r) => r.entre).length;
  if (croient > 1) {
    defauts++;
    ligne("✗", `${croient} invités se croient entrés, la place est à « ${retenu} »`);
    ligne(" ", "l'autre reste sur un salon qui l'a oublié, sans message");
  } else ligne("✓", `1 invité retenu (« ${retenu} »), l'autre refusé`);
}

console.log("\n── D · 200 joueurs simultanés");
{
  const r = await charge200();
  ligne(r.rates.length ? "✗" : "✓",
    `200 sessions concurrentes en ${r.ms} ms — ${r.rates.length} échec(s)`);
  if (r.rates.length) { defauts++; ligne(" ", (r.rates[0].err.split("\n")[0] || "").slice(0, 90)); }
  ligne(r.pseudos === 200 ? "✓" : "✗",
    `${r.pseudos}/200 pseudos · ${r.scores} scores · ${r.gg} scores GRID`);
  if (r.pseudos !== 200) defauts++;
  ligne(r.classes === 200 ? "✓" : "✗", `${r.classes}/200 joueurs classés`);
  if (r.classes !== 200) defauts++;
  ligne(r.msClassement < 1000 ? "✓" : "✗",
    `classement recalculé en ${r.msClassement} ms — tête : ${r.tete}`);
  if (r.msClassement >= 1000) defauts++;
}

console.log("\n── E · 40 joueurs réservent le MÊME pseudo (casses mélangées)");
{
  const { lignes, res } = await memePseudo();
  const poses = res.filter((r) => r.pose).length;
  const refuses = res.filter((r) => r.motif === "refusé par l'index").length;
  if (lignes === 1) {
    ligne("✓", `1 seule ligne en base — l'index a refusé ${refuses} insertion(s)`);
    ligne(" ", `${poses + refuses} client(s) ont cru pouvoir écrire : le contrôle`);
    ligne(" ", "client ne tient pas sous la concurrence, et c'est pour ça que");
    ligne(" ", "l'index unique existe.");
  } else {
    defauts++;
    ligne("✗", `${lignes} lignes pour un seul pseudo — l'index ne tient pas`);
  }
}

console.log("\n── F · le type de bb_rooms.players après un « rejoindre »");
{
  const t = await typePlayers();
  ligne("·", `après createRoom   : ${t.apresCreate}`);
  ligne(t.apresJoin === "array" ? "✓" : "✗", `après joinRoom     : ${t.apresJoin}`);
  ligne("·", `jsonb_array_length : ${t.arrayLength}`);
  if (t.apresJoin !== "array") {
    defauts++;
    ligne(" ", "joinRoom() envoie JSON.stringify(players) : la colonne jsonb reçoit");
    ligne(" ", "une CHAÎNE, pas un tableau. Le client s'en sort — il reparse — mais");
    ligne(" ", "le type de la colonne dépend de qui a écrit en dernier, et tout SQL");
    ligne(" ", "qui traiterait players comme un tableau échouerait.");
  }
}

console.log("\n══════════════════════════════════════════════════════════════════════");
console.log(defauts === 0 ? "\nAucun défaut de concurrence trouvé.\n"
                          : "\n" + defauts + " défaut(s) de concurrence.\n");
process.exit(0);
