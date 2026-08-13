-- ============================================================================
--  BANC D'ESSAI de docs/supabase-classement.sql — un Postgres jetable.
--
--      npm run sql:essai
--
--  POURQUOI CE FICHIER EXISTE. La première version de supabase-classement.sql a
--  été envoyée sans avoir jamais été exécutée : elle déclarait
--  `bb_points_normalises(text, int)` et l'appelait avec `max(s.score)`. Sur la
--  vraie base, `bb_scores.score` N'EST PAS un entier — un filtre décimal y est
--  accepté, alors qu'il est refusé sur bb_gg_scores.score, bb_pseudos.xp et
--  bb_seasons.champion_score, tous entiers. Postgres ne descend pas
--  implicitement de numeric vers int pour résoudre une fonction, donc le fichier
--  s'arrêtait en 42883 à la ligne 206, au milieu du déploiement.
--
--  Relire le SQL ne suffisait pas à voir ça : il fallait le LANCER, sur un
--  schéma aux types de la production. C'est tout l'objet de ce banc.
--
--  LES TYPES CI-DESSOUS SONT MESURÉS, pas supposés. Sonde utilisée, en lecture
--  seule avec la clé publique : filtrer `?colonne=eq.1.5` — un entier répond
--  400 « invalid input syntax for type integer », un décimal répond 200.
--
--  Le score est éprouvé DEUX FOIS, en numeric puis en double precision : la
--  sonde prouve que la colonne n'est pas entière sans dire laquelle des deux
--  elle est, et le fichier doit tenir dans les deux cas.
-- ============================================================================

\set ON_ERROR_STOP on

create schema if not exists public;

-- ─── LE SCHÉMA DE PRODUCTION, RÉDUIT AUX COLONNES QUE LE FICHIER TOUCHE ─────
create table public.bb_scores (
  id          bigserial primary key,
  player_id   text not null,
  player_name text,
  mode        text not null,
  -- LE TYPE EN CAUSE. :type_score vaut numeric au premier passage, double
  -- precision au second.
  score       :type_score,
  created_at  timestamptz not null default now()
);

create table public.bb_gg_scores (
  id         bigserial primary key,
  player_id  text not null,
  score      integer,
  max_score  integer,
  created_at timestamptz not null default now()
);

-- TOUTES les colonnes que l'app écrit, parce que la section 6 rend le droit
-- d'écriture COLONNE PAR COLONNE : en oublier une, c'est casser un PATCH entier
-- en production. Relevé dans les sept sites d'écriture de LePont.jsx, seul
-- fichier qui écrive cette table.
create table public.bb_pseudos (
  id                  bigserial primary key,
  player_id           text unique not null,
  pseudo              text,
  country             text,
  xp                  integer default 0,
  last_notified_grade integer,
  streak_count        integer default 0,
  streak_last_date    text,
  streak_best         integer default 0,
  streak_freezes      integer default 0,
  badge               text,
  recovery_code       text,
  xp_season           integer default 0,
  xp_season_month     text
);

-- PAS de contrainte d'unicité sur season_number, et c'est CONFORME à la
-- production : la table y contient deux fois la saison 4, avec le même champion
-- et le même horodatage à la seconde — trace de l'ancienne clôture côté client,
-- qui tournait sur le téléphone du premier joueur à ouvrir l'app. Le seul
-- rempart contre le doublon est donc le test `if exists` de bb_cloturer_saison,
-- et le banc doit éprouver CE rempart, pas une contrainte que la vraie base n'a
-- pas.
create table public.bb_seasons (
  id             bigserial primary key,
  season_number  int not null,
  champion_id    text,
  champion_name  text,
  champion_score integer,
  mode           text,
  ended_at       timestamptz
);

-- Le rôle que Supabase donne au navigateur. Les politiques RLS et les `revoke`
-- du fichier le visent nommément ; sans lui, ces sections seraient sautées et
-- l'essai ne prouverait rien de la sécurité.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
end $$;
grant usage on schema public to anon;
grant select, insert, update on all tables in schema public to anon;


-- ─── DE QUOI FAIRE UN CLASSEMENT ────────────────────────────────────────────
-- Trois joueurs au moins : la clôture refuse en dessous, et c'est ce refus
-- qu'on veut aussi voir fonctionner.
insert into public.bb_pseudos (player_id, pseudo) values
  ('p1','jules'), ('p2','nadia'), ('p3','james10'), ('p4','vice');

-- Des scores sur le mois EN COURS, plusieurs jours et plusieurs modes, avec les
-- valeurs de la vraie distribution (médiane 130 en chaine, 220 en pont).
insert into public.bb_scores (player_id, player_name, mode, score, created_at)
select j.pid, j.nom, m.mode, m.val + (d * 7),
       date_trunc('month', now()) + (d || ' days')::interval + interval '14 hours'
  from (values ('p1','jules'), ('p2','nadia'), ('p3','james10'), ('p4','vice')) as j(pid, nom),
       (values ('pont', 220), ('chaine', 130), ('findscore', 2000)) as m(mode, val),
       generate_series(0, 4) as d;

insert into public.bb_gg_scores (player_id, score, max_score, created_at)
select j.pid, 6 + d, 9,
       date_trunc('month', now()) + (d || ' days')::interval + interval '15 hours'
  from (values ('p1'), ('p2'), ('p3')) as j(pid), generate_series(0, 3) as d;

-- Un score NÉGATIF (pénalités de pass) : il doit valoir 0 point, pas retirer.
insert into public.bb_scores (player_id, player_name, mode, score, created_at)
values ('p4','vice','pont',-450, date_trunc('month', now()) + interval '2 days');
