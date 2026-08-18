-- ============================================================================
--  SCHÉMA D'ESSAI POUR docs/supabase-auth-anonyme.sql
--  ---------------------------------------------------------------------------
--  Un Postgres nu n'est pas Supabase. Deux choses lui manquent, et ce sont
--  précisément les deux dont la migration dépend :
--
--    • les RÔLES `anon` et `authenticated`, que Supabase crée d'office. Toute la
--      section 1 consiste à recopier les droits de l'un vers l'autre : sans les
--      deux rôles, elle ne prouverait rien ;
--
--    • la fonction `auth.uid()`, qui rend l'identifiant du compte porté par le
--      jeton. On la remplace ici par une version qui lit un réglage de session,
--      ce qui permet de SIMULER plusieurs joueurs dans le même banc — y compris
--      l'absence de jeton, qui est le cas des anciennes versions du client.
--
--  Le schéma des tables est réduit à ce que la migration touche, mais les types
--  et les politiques sont ceux de la production, recopiés de supabase-rls.sql.
-- ============================================================================

\set ON_ERROR_STOP on

-- ─── LES RÔLES DE SUPABASE ──────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;
grant usage on schema public to anon, authenticated;

-- ─── auth.uid() SIMULÉE ─────────────────────────────────────────────────────
-- `essai.uid` vide ou absent = requête NON authentifiée, donc le comportement
-- d'un client qui n'a pas encore été mis à jour. C'est le cas le plus important
-- du banc : c'est lui qui doit continuer de fonctionner.
create schema if not exists auth;
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('essai.uid', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

-- ─── LES TABLES ─────────────────────────────────────────────────────────────
drop table if exists public.bb_bannis, public.bb_gg_scores, public.bb_scores,
                     public.bb_pseudos, public.bb_events cascade;

create table public.bb_pseudos (
  id            bigserial primary key,
  player_id     text unique not null,
  pseudo        text,
  country       text,
  xp            integer default 0,
  recovery_code text,
  xp_season     integer default 0
);

create table public.bb_scores (
  id         bigserial primary key,
  player_id  text not null,
  score      numeric,
  mode       text,
  created_at timestamptz not null default now()
);

create table public.bb_gg_scores (
  id         bigserial primary key,
  player_id  text not null,
  score      integer,
  max_score  integer,
  created_at timestamptz not null default now()
);

-- Une table de plus, qui ne sert QU'À vérifier que la boucle de la section 1
-- traite bien toutes les tables et pas seulement celles qu'on a en tête.
create table public.bb_events (
  id        bigserial primary key,
  player_id text,
  type      text
);

-- ─── LES POLITIQUES, TELLES QU'EN PRODUCTION : `to anon` SEULEMENT ───────────
alter table public.bb_pseudos    enable row level security;
alter table public.bb_scores     enable row level security;
alter table public.bb_gg_scores  enable row level security;
alter table public.bb_events     enable row level security;

create policy p_bb_pseudos_insert   on public.bb_pseudos   for insert to anon with check (true);
create policy p_bb_pseudos_select   on public.bb_pseudos   for select to anon using (true);
create policy p_bb_pseudos_update   on public.bb_pseudos   for update to anon using (true) with check (true);
create policy p_bb_scores_insert    on public.bb_scores    for insert to anon with check (true);
create policy p_bb_scores_select    on public.bb_scores    for select to anon using (true);
create policy p_bb_gg_scores_insert on public.bb_gg_scores for insert to anon with check (true);
create policy p_bb_gg_scores_select on public.bb_gg_scores for select to anon using (true);
create policy p_bb_events_insert    on public.bb_events    for insert to anon with check (true);
create policy p_bb_events_select    on public.bb_events    for select to anon using (true);

-- ─── LES DROITS, DONT LE MASQUAGE DE recovery_code ──────────────────────────
-- Recopié de supabase-rls.sql : le SELECT global est RETIRÉ puis redonné sur
-- toutes les colonnes SAUF recovery_code. C'est ce masquage que la section 1 de
-- la migration ne doit surtout pas défaire en recopiant les droits.
grant insert, select, update on public.bb_pseudos to anon;
grant insert, select on public.bb_scores, public.bb_gg_scores, public.bb_events to anon;
grant usage, select on all sequences in schema public to anon;

revoke select on public.bb_pseudos from anon;
grant select (id, player_id, pseudo, country, xp, xp_season) on public.bb_pseudos to anon;
-- L'UPDATE aussi est accordé colonne par colonne : personne ne doit pouvoir
-- réécrire le code de récupération d'autrui, ni s'attribuer un auth_uid à la main.
revoke update on public.bb_pseudos from anon;
grant update (pseudo, country, xp, xp_season) on public.bb_pseudos to anon;

-- Une fonction en SECURITY DEFINER exécutable par anon, pour éprouver la boucle
-- qui recopie les droits d'exécution — l'oublier casserait la récupération et la
-- suppression de compte, deux fonctions que l'App Store vérifie.
create or replace function public.recover_account(p_code text)
returns table (player_id text, pseudo text)
language sql security definer set search_path = public as $$
  select player_id, pseudo from public.bb_pseudos where recovery_code = p_code limit 1;
$$;
revoke all on function public.recover_account(text) from public, anon;
grant execute on function public.recover_account(text) to anon;

-- ─── LE JEU D'ESSAI ─────────────────────────────────────────────────────────
insert into public.bb_pseudos (player_id, pseudo, xp, recovery_code) values
  ('AAA111', 'jules',   4200, 'CODE-JULES'),   -- avec code, sera lié
  ('BBB222', 'nadia',   3100, 'CODE-NADIA'),   -- avec code, restera non lié
  ('CCC333', 'ancien',  900,  null);           -- SANS code : cas des vieux comptes
