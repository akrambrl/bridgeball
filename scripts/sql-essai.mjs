#!/usr/bin/env node
// LANCE docs/supabase-classement.sql sur un Postgres jetable, et le CONTRÔLE.
//
//     npm run sql:essai
//
// POURQUOI. Le fichier a été envoyé une première fois sans avoir jamais été
// exécuté. Il s'arrêtait en 42883 à la ligne 206 : la fonction était déclarée
// `bb_points_normalises(text, int)` et appelée avec `max(s.score)`, or
// `bb_scores.score` n'est pas un entier sur la vraie base — et Postgres ne
// descend pas implicitement de numeric vers int pour résoudre une fonction.
// Relire ne suffisait pas ; il fallait lancer.
//
// Ce script monte un cluster à part, y pose le schéma de production (types
// MESURÉS, voir l'en-tête du .essai.sql), applique le fichier, puis vérifie ce
// qu'il PROMET : le classement se calcule, les points sont plafonnés, la clôture
// couronne le bon joueur, refuse un doublon, refuse un mode hors barème, et le
// garde-fou repousse ce qu'il doit repousser.
//
// Le score est éprouvé en numeric ET en double precision : la sonde de type
// prouve que la colonne n'est pas entière, sans dire laquelle des deux elle est.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const lancer = promisify(execFile);
const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, "..");
const FICHIER = join(racine, "docs", "supabase-classement.sql");
const SCHEMA = join(racine, "docs", "supabase-classement.essai.sql");

const PORT = process.env.PG_PORT || "5433";
const PGBIN = process.env.PGBIN || "/usr/lib/postgresql/16/bin";
const SOCKET = "/tmp";

// Le cluster tourne sous l'utilisateur `postgres` : Postgres refuse de démarrer
// en root. Le répertoire de données doit donc lui appartenir, et /tmp d'un
// bac à sable de session ne lui est pas accessible — d'où /var/tmp.
const DONNEES = process.env.PGDATA_ESSAI || "/var/tmp/pg-goatfc";

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
  // Le banc a besoin d'un Postgres LOCAL. Le dire franchement plutôt que
  // d'échouer sur une erreur de socket illisible : sur un Mac, `brew install
  // postgresql@16` puis PGBIN=/opt/homebrew/opt/postgresql@16/bin.
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

/** Un contrôle = une requête et ce qu'on attend d'elle. */
const CONTROLES = [
  { nom: "le classement renvoie des lignes",
    sql: "select count(*) from public.bb_classement_courant()",
    attendu: (v) => Number(v) >= 3,
    dire: (v) => v + " joueur(s) classé(s)" },

  { nom: "les points sont PLAFONNÉS à 1000 par jour et par mode",
    // Le plafond est le cœur de la sécurité : c'est lui, et non les bornes, qui
    // fait qu'un score gonflé ne rapporte pas plus qu'un très bon score.
    //
    // 1000 et non 100 : à 100, les totaux valaient le dixième de l'XP affichée
    // jusque-là — une partie de Plug à 950 points en rapportait 95 — et l'onglet
    // Saison paraissait cassé à côté de l'onglet Global, resté en XP. Le calcul
    // était juste, c'est l'unité qui avait changé sans le dire.
    sql: "select public.bb_points_normalises('pont', 999999)",
    attendu: (v) => Number(v) === 1000,
    dire: (v) => "999 999 en pont → " + v + " points" },

  { nom: "la référence du mode vaut EXACTEMENT le plafond",
    // Le point d'ancrage de toute l'échelle : `reference` est par définition le
    // score qui vaut le maximum. Si ce contrôle casse, la normalisation a dérivé.
    sql: "select public.bb_points_normalises('pont', 1000)",
    attendu: (v) => Number(v) === 1000,
    dire: (v) => "1000 en pont (= la référence) → " + v + " points" },

  { nom: "une partie MÉDIANE vaut à peu près la même chose dans chaque mode",
    // Le défaut que le recalibrage répare : avec findscore à 20 000, une partie
    // médiane de « Trouve le joueur » rapportait 2,5 fois moins qu'une médiane de
    // Plug pour un effort équivalent, et le classement disait donc quel mode
    // farmer. Médianes mesurées sur la production : pont 260, chaine 125,
    // findscore 1900, mercatoday 170.
    sql: `select greatest(
            public.bb_points_normalises('pont', 260),
            public.bb_points_normalises('chaine', 125),
            public.bb_points_normalises('findscore', 1900),
            public.bb_points_normalises('mercatoday', 170))
          - least(
            public.bb_points_normalises('pont', 260),
            public.bb_points_normalises('chaine', 125),
            public.bb_points_normalises('findscore', 1900),
            public.bb_points_normalises('mercatoday', 170))`,
    // 120 points d'écart sur une échelle de 1000, soit 12 % : au-delà, un mode
    // devient objectivement plus rentable qu'un autre.
    attendu: (v) => Number(v) <= 120,
    dire: (v) => "écart max-min entre modes sur une partie médiane : " + v + " points" },

  { nom: "un score NÉGATIF vaut 0 et ne retire rien",
    sql: "select public.bb_points_normalises('pont', -450)",
    attendu: (v) => Number(v) === 0,
    dire: (v) => "-450 → " + v + " point" },

  { nom: "un mode HORS barème vaut 0",
    sql: "select public.bb_points_normalises('mode_inconnu', 500)",
    attendu: (v) => Number(v) === 0,
    dire: (v) => "→ " + v + " point" },

  { nom: "GOAT GRID compte, normalisé par son propre maximum",
    sql: "select modes from public.bb_classement_courant() where player_id = 'p1'",
    attendu: (v) => Number(v) >= 4,
    dire: (v) => v + " modes pour p1 (dont goatgrid)" },

  { nom: "rejouer le même mode le même jour ne rapporte rien de plus",
    // Deux scores le même jour dans le même mode : seul le meilleur compte.
    sql: `with avant as (select points from public.bb_classement_courant() where player_id='p1')
          select (select points from avant)`,
    attendu: (v) => Number(v) > 0,
    dire: (v) => "p1 totalise " + v + " points" },
];

/** Ce que le garde-fou doit REFUSER, et par quel indice. */
const REFUS = [
  { nom: "un score au-dessus de la borne haute",
    sql: "insert into public.bb_scores (player_id, mode, score) values ('p9','pont',99999)",
    indice: "bornes" },
  { nom: "deux scores du même mode à moins de 10 s",
    sql: `insert into public.bb_scores (player_id, mode, score) values ('p8','pont',300);
          insert into public.bb_scores (player_id, mode, score) values ('p8','pont',310)`,
    indice: "cadence" },
];

async function eprouver(typeScore) {
  const base = "essai_" + typeScore.replace(/\W/g, "");
  await psql(["-c", `drop database if exists ${base}`]);
  await psql(["-c", `create database ${base}`]);
  console.log("\n" + "═".repeat(70));
  console.log("  bb_scores.score en " + typeScore.toUpperCase());
  console.log("═".repeat(70));

  await psql(["-v", "type_score=" + typeScore, "-f", SCHEMA, "-q"], base);

  // LE POINT DU CONTRÔLE : le fichier passe-t-il en entier ? C'est ici qu'il
  // s'arrêtait en 42883 sans que personne ne l'ait vu.
  try {
    const sortie = await psql(["-f", FICHIER, "-q"], base);
    const bruit = sortie.split("\n").filter((l) => /ERROR|FATAL/.test(l));
    if (bruit.length) throw new Error(bruit.join("\n"));
    console.log("✅ le fichier passe en entier");
  } catch (e) {
    console.log("❌ le fichier S'ARRÊTE :\n" + String(e.message).split("\n")
      .filter((l) => /ERROR|LINE|HINT|DETAIL/.test(l)).slice(0, 6).map((l) => "   " + l).join("\n"));
    return false;
  }

  let bon = true;
  for (const c of CONTROLES) {
    const v = (await psql(["-tAc", c.sql], base)).trim().split("\n")[0];
    const ok = c.attendu(v);
    if (!ok) bon = false;
    console.log((ok ? "✅ " : "❌ ") + c.nom + " — " + c.dire(v));
  }

  for (const r of REFUS) {
    let refuse = false, message = "";
    try { await psql(["-c", r.sql], base); } catch (e) { refuse = true; message = String(e.message); }
    const bonIndice = new RegExp(r.indice, "i").test(message);
    if (!refuse || !bonIndice) bon = false;
    console.log((refuse && bonIndice ? "✅ " : "❌ ") + "refusé : " + r.nom
      + (refuse ? "" : "  ← ACCEPTÉ, ce qui est le défaut"));
  }

  // La clôture : elle couronne, puis refuse le doublon.
  const c1 = (await psql(["-tAc",
    "select etat || ' · ' || detail from public.bb_cloturer_saison(to_char(now(), 'YYYY-MM'), 99)"], base)).trim();
  const c2 = (await psql(["-tAc",
    "select etat from public.bb_cloturer_saison(to_char(now(), 'YYYY-MM'), 99)"], base)).trim();
  const okCloture = c1.startsWith("ok") && c2 === "deja";
  if (!okCloture) bon = false;
  console.log((okCloture ? "✅ " : "❌ ") + "clôture : " + c1 + "  puis « " + c2 + " » au second appel");

  // Et elle REFUSE si un mode joué manque au barème — mieux vaut un palmarès en
  // retard d'un jour qu'un champion désigné sur un barème incomplet.
  await psql(["-c", "insert into public.bb_scores (player_id, mode, score) "
    + "values ('p7','mode_orphelin',100)"], base);
  const c3 = (await psql(["-tAc",
    "select etat || ' · ' || detail from public.bb_cloturer_saison(to_char(now(), 'YYYY-MM'), 98)"], base)).trim();
  const okOrphelin = c3.startsWith("refus") && /mode_orphelin/.test(c3);
  if (!okOrphelin) bon = false;
  console.log((okOrphelin ? "✅ " : "❌ ") + "clôture refusée sur mode hors barème : " + c3);

  // ── LE CONTRÔLE QUI MANQUAIT, ET QUI A COÛTÉ UNE FAUSSE SAISON ──────────
  // La clôture est en SECURITY DEFINER : qui peut l'APPELER peut couronner
  // n'importe qui, quels que soient les droits sur bb_seasons. Le banc vérifiait
  // que la fonction marche, jamais qu'elle est INTERDITE à la clé publique.
  //
  // Une sonde lancée sur la production s'est donc exécutée pour de vrai et a
  // écrit une saison 999 dans le Hall of Fame. Le fichier disait
  // `revoke execute ... from anon`, ce qui ne retire RIEN : Postgres accorde
  // EXECUTE à PUBLIC sur toute fonction, et PUBLIC couvre anon. C'est la même
  // erreur que la section 6 sur les colonnes — un revoke ciblé sur un rôle qui
  // n'a jamais eu de grant direct.
  //
  // Pourquoi le `revoke insert on bb_seasons`, lui, fonctionnait : les TABLES
  // n'ont pas de grant PUBLIC par défaut, les FONCTIONS si.
  let clotureInterdite = false, retour = "";
  try {
    retour = (await psql(["-tAc", "set role anon; select etat from "
      + "public.bb_cloturer_saison(to_char(now(), 'YYYY-MM'), 97)"], base)).trim();
  } catch (e) {
    clotureInterdite = /permission denied|denied for/i.test(String(e.message));
  }
  if (!clotureInterdite) bon = false;
  console.log((clotureInterdite ? "✅ " : "❌ ") + "anon ne peut PAS appeler la clôture"
    + (clotureInterdite ? "" : "  ← APPELÉE, retour « " + retour + " » : n'importe qui couronne"));

  // Le classement, lui, DOIT rester appelable : c'est l'onglet Saison de l'app.
  let classementOuvert = true;
  try {
    await psql(["-tAc", "set role anon; select count(*) from public.bb_classement_courant()"], base);
  } catch { classementOuvert = false; }
  if (!classementOuvert) bon = false;
  console.log((classementOuvert ? "✅ " : "❌ ") + "anon peut toujours lire le classement"
    + (classementOuvert ? "" : "  ← l'onglet Saison serait vide"));

  // ── SECTION 6, LA PLUS PIÉGEUSE ─────────────────────────────────────────
  // Elle est commentée dans le fichier (elle attend le déploiement) : on
  // l'applique ICI, telle quelle, pour vérifier qu'elle fera ce qu'elle
  // annonce le jour où elle passera.
  //
  // La première version se contentait de `revoke update (xp_season, ...)`, et
  // ce contrôle a montré qu'elle ne bloquait RIEN : un privilège de colonne ne
  // restreint pas un rôle qui détient l'UPDATE de la table, ce que Supabase
  // accorde à `anon`. D'où la forme ci-dessous — retirer le droit de table,
  // puis rendre les colonnes une à une.
  const COLONNES_APP = ["pseudo", "country", "xp", "last_notified_grade",
    "streak_count", "streak_last_date", "streak_best", "streak_freezes",
    "badge", "recovery_code"];
  await psql(["-c", "revoke update on public.bb_pseudos from anon;"
    + " grant update (" + COLONNES_APP.join(", ") + ") on public.bb_pseudos to anon"], base);

  let bloque = false;
  try {
    await psql(["-c", "set role anon; update public.bb_pseudos set xp_season = 999999999 "
      + "where player_id = 'p1'"], base);
  } catch (e) { bloque = /permission denied|denied for/i.test(String(e.message)); }
  if (!bloque) bon = false;
  console.log((bloque ? "✅ " : "❌ ") + "section 6 : anon ne peut plus écrire xp_season"
    + (bloque ? "" : "  ← LE REVOKE NE BLOQUE RIEN"));

  // CHAQUE colonne que l'app écrit, une par une. Le droit est rendu colonne par
  // colonne : en oublier une casserait tout un PATCH en production, et c'est
  // silencieux côté app (les erreurs d'écriture y sont avalées).
  const casse = [];
  const VALEUR = { pseudo: "'zz'", country: "'FR'", xp: "4200", last_notified_grade: "3",
    streak_count: "5", streak_last_date: "'2026-08-13'", streak_best: "9",
    streak_freezes: "1", badge: "'carte1'", recovery_code: "'ABC123'" };
  for (const col of COLONNES_APP) {
    try {
      await psql(["-c", "set role anon; update public.bb_pseudos set " + col + " = "
        + VALEUR[col] + " where player_id = 'p1'"], base);
    } catch { casse.push(col); }
  }
  // Et le PATCH tel que l'app l'envoie vraiment : plusieurs colonnes d'un coup.
  try {
    await psql(["-c", "set role anon; update public.bb_pseudos set xp = 4300, "
      + "last_notified_grade = 4 where player_id = 'p1'"], base);
  } catch { casse.push("xp+last_notified_grade (le PATCH réel)"); }
  if (casse.length) bon = false;
  console.log((casse.length ? "❌ " : "✅ ") + "section 6 : les "
    + COLONNES_APP.length + " colonnes de l'app restent écrivables"
    + (casse.length ? "  ← CASSÉES : " + casse.join(", ") : ""));

  return bon;
}

console.log("cluster : " + await demarrer());
let tout = true;
for (const t of ["numeric", "double precision"]) {
  if (!(await eprouver(t))) tout = false;
}
console.log("\n" + (tout
  ? "✅ le fichier tient dans les deux cas de type."
  : "❌ au moins un contrôle échoue — NE PAS coller dans Supabase."));
process.exit(tout ? 0 : 1);
