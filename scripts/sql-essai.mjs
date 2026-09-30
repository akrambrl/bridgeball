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
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
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

  { nom: "les points d'UNE PARTIE sont plafonnés à 1000 (normalisation, comparable entre modes)",
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

  { nom: "un joueur qui a joué plusieurs modes plusieurs jours est classé (p1)",
    // Deux scores le même jour dans le même mode : seul le meilleur compte.
    sql: `with avant as (select points from public.bb_classement_courant() where player_id='p1')
          select (select points from avant)`,
    attendu: (v) => Number(v) > 0,
    dire: (v) => "p1 totalise " + v + " points" },

  { nom: "règle A seule (sans plancher) plafonnerait pcap à 15 000",
    // Vérité de la fonction ISOLÉE, sans la migration du plancher : pcap joue
    // 20 jours à 1000/jour, K=15 → exactement 15 000 bruts. C'est la valeur que
    // rule A donnerait à un joueur qui n'aurait JAMAIS eu de plancher.
    sql: "select public.bb_points_bruts_topk('pcap', to_char(now(), 'YYYY-MM'))",
    attendu: (v) => Number(v) === 15000,
    dire: (v) => "bb_points_bruts_topk('pcap') → " + v + " (15 meilleurs jours × 1000)" },

  { nom: "plancher (4bis) — pcap garde son ANCIEN total (20 000), pas le plafond de rule A",
    seulement: "ancien",
    // pcap a 20 jours DÉJÀ JOUÉS avant que le fichier (et le plancher) existent —
    // exactement la situation de « night » en production. La migration ponctuelle
    // a dû figer son plancher à l'ancien total ILLIMITÉ (20 000), et
    // bb_classement_mois doit afficher CE total, pas les 15 000 de rule A seule.
    sql: "select points from public.bb_classement_courant() where player_id='pcap'",
    attendu: (v) => Number(v) === 20000,
    dire: (v) => "pcap affiché → " + v + " (20 000 attendus : le plancher tient, pas de recul)" },

  { nom: "plancher (4bis) — un joueur sans excédent (pref, 15 jours) n'est pas gonflé",
    seulement: "ancien",
    // pref n'a que 15 jours : illimité == rule A == 15 000 en BRUT (avant bonus).
    // Le plancher ne fait QUE protéger un excédent, jamais gonfler un joueur qui
    // n'en a pas. On compare au brut, pas à `points` (qui inclut le bonus de
    // rattrapage, normal puisque pref n'est pas en tête).
    sql: `select public.bb_points_bruts_topk('pref', to_char(now(), 'YYYY-MM'))
               = coalesce((select points from public.bb_classement_hwm
                            where player_id='pref' and mois = to_char(now(), 'YYYY-MM')), 0)`,
    attendu: (v) => v === "t",
    dire: (v) => "brut(pref) == plancher(pref) : " + v + " (aucun excédent à protéger)" },

  { nom: "règle B — le bonus de rattrapage rehausse le fond de tableau",
    // pbottom a 1000 points bruts (un jour, à la référence). Loin du sommet
    // (20 000, planché par pcap), le bonus doit le remonter au-dessus de 1000 —
    // sans le faire passer devant, ce que vérifie le contrôle suivant.
    sql: "select points from public.bb_classement_courant() where player_id='pbottom'",
    attendu: (v) => Number(v) > 1000 && Number(v) < 1500,
    dire: (v) => "pbottom : 1000 bruts → " + v + " affichés (bonus de remontée)" },

  { nom: "règle B — le bonus ne change AUCUN rang (fonction croissante)",
    // Le bas remonte à l'affichage mais ne double personne : on grimpe en jouant
    // (règle A) ou en ayant déjà un plancher plus haut, pas grâce au bonus seul.
    // pbottom reste sous pcap.
    sql: `select (select points from public.bb_classement_courant() where player_id='pbottom')
               < (select points from public.bb_classement_courant() where player_id='pcap')`,
    attendu: (v) => v === "t",
    dire: (v) => "pbottom < pcap : " + v },

];

/** Les contrôles qui DISTINGUENT les deux règles (voir « CHANGEMENT DE RÈGLE » en tête du fichier). */
const CONTROLES_REGLE = {
  ancien: [
    { nom: "AVANT octobre — 18 parties le même jour dans le même mode ne comptent que pour UNE (pgrind)",
      // Le plafond « meilleur score par jour et par mode » : septembre 2026 se clôt
      // dessous, et ne doit pas avoir bougé d'un point.
      sql: "select points from public.bb_classement_courant() where player_id='pgrind'",
      attendu: (v) => Number(v) > 1000 && Number(v) < 3000,
      dire: (v) => "pgrind : 18 parties × 1000, un seul jour → " + v + " (1000 bruts + bonus, pas 18 000)" },
    { nom: "AVANT octobre — bb_mes_jours ne retient que les 15 meilleurs jours (pcap en joue 20)",
      sql: `select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1', false);
            select count(*) filter (where retenu) || '/' || count(*)
              from public.bb_mes_jours(to_char(now(),'YYYY-MM'))`,
      attendu: (v) => v.endsWith("15/20"),
      dire: (v) => "jours retenus : " + v + " (15/20 attendus)" },
  ],
  cumul: [
    { nom: "À PARTIR d'octobre — chaque partie compte : 18 parties le même jour valent 18 000 (pgrind)",
      sql: "select points from public.bb_classement_courant() where player_id='pgrind'",
      attendu: (v) => Number(v) >= 18000 && Number(v) <= 20000,
      dire: (v) => "pgrind : 18 parties × 1000 → " + v + " (18 000 bruts + bonus, contre ~1 475 à l'ancienne règle)" },
    { nom: "À PARTIR d'octobre — plus de plafond de jours : bb_mes_jours retient les 20 jours de pcap",
      sql: `select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1', false);
            select count(*) filter (where retenu) || '/' || count(*)
              from public.bb_mes_jours(to_char(now(),'YYYY-MM'))`,
      attendu: (v) => v.endsWith("20/20"),
      dire: (v) => "jours retenus : " + v + " (20/20 attendus)" },
    { nom: "À PARTIR d'octobre — le plancher n'est plus posé (pas de ligne pour pcap)",
      sql: "select count(*) from public.bb_classement_hwm where player_id='pcap'",
      attendu: (v) => Number(v) === 0,
      dire: (v) => v + " ligne(s) de plancher pour pcap (0 attendue : rien à protéger au cumul)" },
  ],
};

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

async function eprouver(typeScore, regime) {
  const base = "essai_" + typeScore.replace(/\W/g, "");
  await psql(["-c", `drop database if exists ${base}`]);
  await psql(["-c", `create database ${base}`]);
  console.log("\n" + "═".repeat(70));
  console.log("  bb_scores.score en " + typeScore.toUpperCase() + "  ·  règle : "
    + (regime === "cumul" ? "CUMUL (à partir d'octobre 2026)" : "ANCIENNE (jusqu'à septembre 2026)"));
  console.log("═".repeat(70));

  await psql(["-v", "type_score=" + typeScore, "-f", SCHEMA, "-q"], base);

  // LE POINT DU CONTRÔLE : le fichier passe-t-il en entier ? C'est ici qu'il
  // s'arrêtait en 42883 sans que personne ne l'ait vu.
  try {
    // La date de bascule est REMPLACÉE dans une copie du fichier : l'essai ne
    // doit pas dépendre du jour où on le lance (avant le 1er octobre les deux
    // règles seraient éprouvées sous la même, après elles le seraient aussi).
    const coupure = regime === "cumul" ? "2000-01" : "2999-01";
    const source = await readFile(FICHIER, "utf8");
    const cible = "select '2026-10' $$";
    if (!source.includes(cible)) throw new Error("bb_debut_cumul() introuvable dans le fichier");
    const copie = join(await mkdtemp(join(tmpdir(), "classement-")), "classement.sql");
    // Une FONCTION de remplacement, pas une chaîne : dans String.replace, « $$ » veut
    // dire « un seul $ », ce qui cassait les guillemets dollar du SQL.
    await writeFile(copie, source.replace(cible, () => "select '" + coupure + "' $$"));
    const sortie = await psql(["-f", copie, "-q"], base);
    const bruit = sortie.split("\n").filter((l) => /ERROR|FATAL/.test(l));
    if (bruit.length) throw new Error(bruit.join("\n"));
    console.log("✅ le fichier passe en entier");
  } catch (e) {
    console.log("❌ le fichier S'ARRÊTE :\n" + String(e.message).split("\n")
      .filter((l) => /ERROR|LINE|HINT|DETAIL/.test(l)).slice(0, 6).map((l) => "   " + l).join("\n"));
    return false;
  }

  let bon = true;
  for (const c of CONTROLES.concat(CONTROLES_REGLE[regime])) {
    if (c.seulement && c.seulement !== regime) continue;
    const v = (await psql(["-tAc", c.sql], base)).trim().split("\n").pop();
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

  // ── LE QUOTA RELEVÉ À 2000 / 24 h ─────────────────────────────────────────
  // Il valait 150. Un joueur qui enchaîne les parties toute la journée en fait
  // quelques centaines : c'est LUI qu'on veut récompenser, et l'ancien quota
  // l'aurait coupé. Le garde-fou est désactivé le temps de poser l'historique
  // (procédure d'exploitation de la section 7) : le trigger impose created_at =
  // now() et refuserait de charger 200 lignes d'un coup.
  await psql(["-c", "alter table public.bb_scores disable trigger bb_scores_garde_trg;"
    + " insert into public.bb_scores (player_id, mode, score, created_at)"
    + "   select 'pquota','pont',0, now() - (n * interval '30 seconds')"
    + "     from generate_series(1, 200) as n;"
    + " alter table public.bb_scores enable trigger bb_scores_garde_trg"], base);
  let apres150 = true;
  try { await psql(["-c", "insert into public.bb_scores (player_id, mode, score) values ('pquota','pont',0)"], base); }
  catch { apres150 = false; }
  if (!apres150) bon = false;
  console.log((apres150 ? "✅ " : "❌ ") + "la 201e partie en 24 h est ACCEPTÉE (l'ancien quota coupait à 150)");

  await psql(["-c", "alter table public.bb_scores disable trigger bb_scores_garde_trg;"
    + " insert into public.bb_scores (player_id, mode, score, created_at)"
    + "   select 'pquota','pont',0, now() - (n * interval '30 seconds') - interval '1 hour'"
    + "     from generate_series(1, 1900) as n;"
    + " alter table public.bb_scores enable trigger bb_scores_garde_trg"], base);
  let quotaTient = false, msgQuota = "";
  try { await psql(["-c", "insert into public.bb_scores (player_id, mode, score) values ('pquota','pont',0)"], base); }
  catch (e) { msgQuota = String(e.message); quotaTient = /quota/i.test(msgQuota); }
  if (!quotaTient) bon = false;
  console.log((quotaTient ? "✅ " : "❌ ") + "au-delà de 2000 parties en 24 h : refusé (garde-fou contre une boucle folle)");

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

  // ── LE PLANCHER (4bis) NE DOIT ÊTRE ÉCRIVABLE QUE PAR SON TRIGGER ────────
  // Même piège que xp_season en son temps : si anon peut écrire directement sur
  // bb_classement_hwm, n'importe qui pose son propre plancher à 999 999 999 et
  // ne redescend plus jamais — le plancher deviendrait le nouveau compteur
  // falsifiable que ce fichier existe justement pour supprimer.
  let hwmInterdit = false;
  try {
    await psql(["-c", "set role anon; update public.bb_classement_hwm "
      + "set points = 999999999 where player_id = 'pcap'"], base);
  } catch (e) { hwmInterdit = /permission denied|denied for/i.test(String(e.message)); }
  if (!hwmInterdit) bon = false;
  console.log((hwmInterdit ? "✅ " : "❌ ") + "anon ne peut pas écrire directement sur le plancher"
    + (hwmInterdit ? "" : "  ← ÉCRIT : n'importe qui se pose à 999 999 999"));

  // Mais anon doit pouvoir le LIRE : bb_classement_mois le lit sous son identité.
  let hwmLisible = true;
  try {
    await psql(["-tAc", "set role anon; select points from public.bb_classement_hwm "
      + "where player_id = 'pcap'"], base);
  } catch { hwmLisible = false; }
  if (!hwmLisible) bon = false;
  console.log((hwmLisible ? "✅ " : "❌ ") + "anon peut lire le plancher"
    + (hwmLisible ? "" : "  ← bb_classement_mois échouerait à le lire"));

  // ── LE VRAI BUG DE PRODUCTION DU 17 SEPTEMBRE 2026, REJOUÉ ICI ───────────
  // `sbFetch` (LePont.jsx) préfère le jeton de session dès qu'il existe : la
  // plupart des joueurs appellent donc SOUS LE RÔLE `authenticated`, pas
  // `anon`. Une policy `to anon` seul sur bb_classement_hwm (ou bb_modes_bareme)
  // rend ces tables invisibles pour `authenticated`, silencieusement — et
  // « night » voyait 12 994 points en jeu contre 45 511 en lisant directement
  // l'API avec la clé publique. Ce contrôle réclame le MÊME total pour les deux
  // rôles ; sans le fix, `authenticated` retomberait à la valeur SANS plancher
  // (pts_brut de rule A seule, bien en dessous de 20000).
  // `.pop()` et non `.trim()` seul : `set role` produit sa propre ligne « SET »
  // avant le résultat de la requête suivante, dans la même sortie psql.
  const parAnon = (await psql(["-tAc", "set role anon; select points from "
    + "public.bb_classement_courant() where player_id='pcap'"], base)).trim().split("\n").pop();
  const parAuth = (await psql(["-tAc", "set role authenticated; select points from "
    + "public.bb_classement_courant() where player_id='pcap'"], base)).trim().split("\n").pop();
  const okMemeTotal = parAnon === parAuth && Number(parAnon) === 20000;
  if (!okMemeTotal) bon = false;
  console.log((okMemeTotal ? "✅ " : "❌ ") + "anon et authenticated voient le MÊME total pour pcap : "
    + parAnon + " (anon) vs " + parAuth + " (authenticated)"
    + (okMemeTotal ? "" : "  ← RÉGRESSION DU 17/09 : authenticated ne voit pas le plancher"));

  // authenticated non plus ne peut pas écrire directement sur le plancher —
  // même garde-fou que pour anon, testé pour le second rôle qui compte vraiment
  // en production.
  let hwmInterditAuth = false;
  try {
    await psql(["-c", "set role authenticated; update public.bb_classement_hwm "
      + "set points = 999999999 where player_id = 'pcap'"], base);
  } catch (e) { hwmInterditAuth = /permission denied|denied for/i.test(String(e.message)); }
  if (!hwmInterditAuth) bon = false;
  console.log((hwmInterditAuth ? "✅ " : "❌ ") + "authenticated ne peut pas non plus écrire sur le plancher"
    + (hwmInterditAuth ? "" : "  ← ÉCRIT : n'importe quelle session connectée se pose à 999 999 999"));

  // ── LE TRIGGER FIGE LE PLANCHER D'UN NOUVEAU JOUEUR, SANS AVANTAGE ───────
  // ptrigger n'a AUCUN score avant l'application du fichier : son premier score
  // arrive maintenant, alors que le trigger existe déjà. Sans historique à
  // figer, son plancher ne peut venir QUE du trigger — et doit valoir
  // EXACTEMENT rule A (1000, un seul jour), aucun bonus caché.
  //
  // Deux requêtes séparées, PAS une CTE insert+lecture combinée : un WITH qui
  // insère puis relit une table modifiée par un trigger déclenché en chaîne
  // (bb_scores → trigger → bb_classement_hwm) s'exécute sur l'instantané pris
  // au DÉBUT de la requête, donc AVANT l'effet du trigger — la lecture aurait
  // pu ne rien voir. Deux commandes distinctes n'ont pas ce piège.
  await psql(["-c", "insert into public.bb_scores (player_id, mode, score) "
    + "values ('ptrigger','pont',1000)"], base);
  const planchTrigger = (await psql(["-tAc", "select points from public.bb_classement_hwm "
    + "where player_id = 'ptrigger'"], base)).trim();
  // Ancienne règle : le trigger pose le plancher (1000). Au cumul il ne fait
  // plus rien (rien à protéger) : aucune ligne.
  const okPlanchTrigger = regime === "cumul" ? planchTrigger === "" : Number(planchTrigger) === 1000;
  if (!okPlanchTrigger) bon = false;
  console.log((okPlanchTrigger ? "✅ " : "❌ ") + "le trigger "
    + (regime === "cumul" ? "ne pose plus de plancher au cumul : « " + planchTrigger + " » (rien attendu)"
                          : "fige le plancher d'un nouveau joueur : " + planchTrigger + " (attendu 1000, posé par le trigger seul)"));

  // ── AU CUMUL, LE TOTAL EST LA SOMME DES PARTIES — SANS PLAFOND DE JOURS ──
  // `plate` joue 22 jours à 1000. À l'ancienne règle, il aurait été plafonné à
  // 15 000 ; au cumul il vaut 22 000. Placé APRÈS les contrôles qui supposent
  // que pcap (20 000) est en tête : plate prend le sommet, donc pas de bonus,
  // donc EXACTEMENT 22 000. Historique posé garde-fou désactivé, comme plus haut.
  if (regime === "cumul") {
    await psql(["-c", "alter table public.bb_scores disable trigger bb_scores_garde_trg;"
      + " insert into public.bb_pseudos (player_id, pseudo) values ('plate','tardif');"
      + " insert into public.bb_scores (player_id, player_name, mode, score, created_at)"
      + "   select 'plate','tardif','pont',1000,"
      + "          date_trunc('month', now()) + (n || ' days')::interval + interval '18 hours'"
      + "     from generate_series(0, 21) as n;"
      + " alter table public.bb_scores enable trigger bb_scores_garde_trg"], base);
    const plate = (await psql(["-tAc", "select points from public.bb_classement_courant() where player_id='plate'"], base)).trim();
    const okPlate = Number(plate) === 22000;
    if (!okPlate) bon = false;
    console.log((okPlate ? "✅ " : "❌ ") + "22 jours à 1000 valent 22 000 au cumul : " + plate
      + (okPlate ? "" : "  ← toujours plafonné à K jours ?"));

    // Et un joueur qui joue h24 dépasse bien un joueur régulier : l'objet même
    // de la décision.
    const devant = (await psql(["-tAc", "select (select points from public.bb_classement_courant() where player_id='plate')"
      + " > (select points from public.bb_classement_courant() where player_id='pcap')"], base)).trim();
    const okDevant = devant === "t";
    if (!okDevant) bon = false;
    console.log((okDevant ? "✅ " : "❌ ") + "plus on joue, plus on monte : plate (22 jours) devant pcap (20 jours) : " + devant);
  }

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
for (const regime of ["ancien", "cumul"]) {
  for (const t of ["numeric", "double precision"]) {
    if (!(await eprouver(t, regime))) tout = false;
  }
}
console.log("\n" + (tout
  ? "✅ le fichier tient dans les deux cas de type, sous l'ancienne règle ET au cumul."
  : "❌ au moins un contrôle échoue — NE PAS coller dans Supabase."));
process.exit(tout ? 0 : 1);
