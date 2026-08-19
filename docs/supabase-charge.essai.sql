-- ============================================================================
--  BANC DE CHARGE — les salles à 8 et les 200 joueurs simultanés
--
--      npm run sql:charge
--
--  POURQUOI UN POSTGRES LOCAL ET PAS LA PRODUCTION. Éprouver 200 écrivains
--  concurrents contre la base réelle, c'est y injecter des milliers de lignes
--  fausses la semaine de la sortie, sur une offre gratuite, avec le risque de se
--  faire limiter. On monte donc le schéma ici. Ce qu'on éprouve — la sémantique
--  d'un `update` concurrent, un index unique, une vue d'agrégation — ne dépend
--  pas de l'hébergeur : c'est du Postgres.
--
--  LES TYPES SONT MESURÉS, comme dans docs/supabase-classement.essai.sql. Sonde
--  utilisée ici : lire une ligne de chaque table avec la clé publique et
--  regarder ce que PostgREST rend.
--
--      bb_rooms.players       → tableau JSON       ⇒ jsonb
--      bb_gg_rooms.players    → tableau JSON       ⇒ jsonb
--      bb_gg_rooms.id         → 17                 ⇒ entier (bigserial)
--      bb_rooms.id            → uuid              ⇒ uuid
--      bb_duel_rooms.guest_id → texte ou null      ⇒ text
--
--  L'ORDRE DES CLÉS RENDUES LE CONFIRME pour players : la production rend
--  {"id","name","score","status"} pour bb_rooms et
--  {"id","name","score","joined_at","lives_left","finished_at",…} pour
--  bb_gg_rooms — c'est-à-dire les clés RÉORDONNÉES par longueur puis par ordre
--  alphabétique, la signature de jsonb. Un champ `text` aurait rendu la chaîne
--  telle qu'écrite par le client.
-- ============================================================================

\set ON_ERROR_STOP on
create schema if not exists public;

-- ─── LES TROIS SYSTÈMES DE SALLE ────────────────────────────────────────────
-- Trois tables, trois algorithmes de « rejoindre » différents dans LePont.jsx.
-- C'est cette divergence que le banc met à l'épreuve.

-- The Plug / The Mercato, jusqu'à 8. `joinRoom()` : lire, ajouter, PATCH, RELIRE
-- pour vérifier, et recommencer jusqu'à cinq fois.
create table public.bb_rooms (
  id         uuid primary key default gen_random_uuid(),
  code       text not null,
  host_id    text not null,
  host_name  text,
  mode       text,
  diff       text,
  rounds     integer default 1,
  status     text default 'waiting',
  players    jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- GOAT BATTLE, jusqu'à 8. `ggBattleJoinRoom()` : lire, ajouter, PATCH. Sans
-- relecture et sans reprise — c'est l'écart qu'on mesure.
create table public.bb_gg_rooms (
  id         bigserial primary key,
  code       text not null,
  host_id    text not null,
  state      text default 'lobby',
  seed       integer,
  players    jsonb default '[]'::jsonb,
  started_at timestamptz,
  winner_id  text,
  created_at timestamptz not null default now()
);

-- GOAT DUEL, 1 contre 1. `duelJoinRoom()` : vérifier que la place est libre,
-- puis l'occuper. Deux colonnes, pas de tableau — mais le même trou entre le
-- contrôle et l'écriture.
create table public.bb_duel_rooms (
  id         uuid primary key default gen_random_uuid(),
  code       text not null,
  host_id    text not null,
  guest_id   text,
  guest_name text,
  state      text default 'lobby',
  created_at timestamptz not null default now()
);

-- ─── CE QUE 200 JOUEURS ÉCRIVENT VRAIMENT ───────────────────────────────────
create table public.bb_pseudos (
  id                  bigserial primary key,
  player_id           text unique not null,
  pseudo              text,
  country             text,
  xp                  integer default 0,
  xp_season           integer default 0,
  xp_season_month     text,
  recovery_code       text,
  created_at          timestamptz not null default now()
);

-- L'index unique insensible à la casse, posé par docs/supabase-pseudo-unique.sql.
-- C'est LUI qu'on éprouve : le contrôle côté client ne peut pas tenir sous la
-- concurrence, quatre doublons de casse l'ont montré en production.
create unique index bb_pseudos_pseudo_unique on public.bb_pseudos (lower(pseudo))
  where pseudo is not null;

create table public.bb_scores (
  id          bigserial primary key,
  player_id   text not null,
  player_name text,
  mode        text not null,
  score       numeric,
  created_at  timestamptz not null default now()
);

create table public.bb_gg_scores (
  id            bigserial primary key,
  player_id     text not null,
  score         integer,
  vie_rachetee  boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ─── LE CLASSEMENT, RÉDUIT À CE QUI SE MESURE SOUS CHARGE ───────────────────
-- Même forme que docs/supabase-classement.sql : meilleur score du jour par mode,
-- normalisé sur un plafond de 1000, et la vie rachetée exclue de GOAT GRID.
create table public.bb_modes_bareme (
  mode      text primary key,
  reference numeric not null
);
insert into public.bb_modes_bareme (mode, reference) values
  ('pont', 1000), ('chaine', 500), ('findscore', 7500),
  ('mercatoday', 650), ('findplayer', 600), ('findstreak', 30);

create or replace function public.bb_points_normalises(p_mode text, p_score numeric)
returns integer language sql immutable as $$
  select least(1000, greatest(0, round(1000 * p_score / b.reference)))::int
  from public.bb_modes_bareme b where b.mode = p_mode
$$;

create or replace view public.bb_classement_mois as
  select s.player_id, s.mode, (s.created_at at time zone 'Europe/Paris')::date as jour,
         max(s.score) as meilleur
    from public.bb_scores s
    join public.bb_modes_bareme b on b.mode = s.mode
   group by 1, 2, 3
  union all
  select g.player_id, 'goatgrid'::text, (g.created_at at time zone 'Europe/Paris')::date,
         max(g.score)::numeric
    from public.bb_gg_scores g
   where not coalesce(g.vie_rachetee, false)
   group by 1, 2, 3;

create or replace function public.bb_classement_courant()
returns table (player_id text, points bigint, jours bigint, modes bigint)
language sql stable as $$
  select c.player_id,
         sum(coalesce(public.bb_points_normalises(c.mode, c.meilleur), least(1000, c.meilleur)::int))::bigint,
         count(distinct c.jour)::bigint,
         count(distinct c.mode)::bigint
    from public.bb_classement_mois c
   group by c.player_id
   order by 2 desc, 3 desc
$$;
