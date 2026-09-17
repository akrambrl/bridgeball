-- ============================================================================
--  GOAT FC — Sécurisation Supabase (Row Level Security)
--  À coller dans Supabase → SQL Editor → Run.
--  Idempotent : peut être relancé sans risque.
--
--  Contexte À L'ORIGINE : l'app était 100 % ANONYME (pas de Supabase Auth). La
--  clé `anon` est publique (dans le bundle JS). Le rôle Postgres utilisé par
--  tous les appels était donc `anon`. On ne peut pas isoler par utilisateur
--  (pas de auth.uid()), MAIS on peut appliquer le MOINDRE PRIVILÈGE par table :
--  n'autoriser que les opérations que l'app fait réellement.
--
--  Bénéfice concret : personne ne peut plus « DELETE FROM bb_scores » et vider
--  ton classement, lire la table des abonnements push, etc.
--
--  ⚠️ CE N'EST PLUS VRAI DEPUIS `docs/supabase-auth-anonyme.sql` : les appareils
--  qui ont une session (la plupart) appellent désormais SOUS LE RÔLE
--  `authenticated`, pas `anon` — `sbFetch` (LePont.jsx) préfère le jeton de
--  session dès qu'il existe. Ce fichier n'a jamais été mis à jour en
--  conséquence : TOUTES ses politiques restaient écrites `to anon` seul.
--
--  CONSÉQUENCE RÉELLE, DÉCOUVERTE LE 17 SEPTEMBRE 2026 : le classement du mois
--  (bb_classement_mois, lit bb_scores et bb_gg_scores) renvoyait un total
--  ÉNORMÉMENT plus bas pour un joueur authentifié que pour un appel à la clé
--  publique nue — RLS activée + aucune politique pour `authenticated` = ces
--  lignes sont simplement INVISIBLES pour ce rôle, silencieusement, sans
--  erreur. « night » voyait 12 994 points en jeu contre 45 511 en lisant
--  directement l'API avec la clé publique — même joueur, même mois, deux
--  rôles Postgres différents. Le bug touchait potentiellement TOUTES les
--  tables ci-dessous, pas seulement le classement.
--
--  Toutes les politiques sont donc maintenant `to anon, authenticated` — sauf
--  mention contraire explicite. `docs/supabase-auth-anonyme.sql` tentait de
--  couvrir ça en ÉTENDANT dynamiquement les politiques existantes au moment de
--  son exécution ; ce fichier-ci, relancé après coup, écrivait `to anon` en
--  dur et effaçait cette extension à chaque réapplication. La corriger ICI,
--  dans la définition, évite que le problème revienne au prochain « Run ».
-- ============================================================================


-- ############################################################################
-- ## PHASE 1 — À APPLIQUER MAINTENANT (ne casse rien, calqué sur l'app)
-- ############################################################################

-- Helper : (ré)active RLS sur une table si elle existe.
do $$
declare t text;
begin
  foreach t in array array[
    'bb_scores','bb_gg_scores','bb_events','bb_reports','bb_seasons',
    'bb_push_subscriptions','bb_pseudos','bb_rooms','bb_gg_rooms',
    'bb_duels','bb_friend_requests'
  ] loop
    if exists (select 1 from information_schema.tables
               where table_schema='public' and table_name=t) then
      execute format('alter table public.%I enable row level security;', t);
    end if;
  end loop;
end $$;


-- ─── Tables « append + lecture » : INSERT + SELECT, PAS d'UPDATE/DELETE ───
-- (protège scores, stats et signalements contre toute modification/suppression)

-- bb_scores  (classement The Plug / The Mercato)
drop policy if exists p_bb_scores_insert on public.bb_scores;
drop policy if exists p_bb_scores_select on public.bb_scores;
create policy p_bb_scores_insert on public.bb_scores for insert to anon, authenticated with check (true);
create policy p_bb_scores_select on public.bb_scores for select to anon, authenticated using (true);

-- bb_gg_scores  (classement GOAT Grid)
drop policy if exists p_bb_gg_scores_insert on public.bb_gg_scores;
drop policy if exists p_bb_gg_scores_select on public.bb_gg_scores;
create policy p_bb_gg_scores_insert on public.bb_gg_scores for insert to anon, authenticated with check (true);
create policy p_bb_gg_scores_select on public.bb_gg_scores for select to anon, authenticated using (true);

-- bb_events  (présence + tracking des modes de jeu)
drop policy if exists p_bb_events_insert on public.bb_events;
drop policy if exists p_bb_events_select on public.bb_events;
create policy p_bb_events_insert on public.bb_events for insert to anon, authenticated with check (true);
create policy p_bb_events_select on public.bb_events for select to anon, authenticated using (true);

-- bb_reports  (signalements de bugs / joueurs)
drop policy if exists p_bb_reports_insert on public.bb_reports;
drop policy if exists p_bb_reports_select on public.bb_reports;
create policy p_bb_reports_insert on public.bb_reports for insert to anon, authenticated with check (true);
create policy p_bb_reports_select on public.bb_reports for select to anon, authenticated using (true);

-- bb_seasons  (saisons / Hall of Fame — l'app lit et bootstrap la saison courante)
drop policy if exists p_bb_seasons_insert on public.bb_seasons;
drop policy if exists p_bb_seasons_select on public.bb_seasons;
create policy p_bb_seasons_insert on public.bb_seasons for insert to anon, authenticated with check (true);
create policy p_bb_seasons_select on public.bb_seasons for select to anon, authenticated using (true);


-- ─── Table write-only : INSERT seulement, JAMAIS de lecture ───
-- bb_push_subscriptions contient les endpoints push (données sensibles) :
-- l'app y écrit mais ne les relit jamais côté client.
drop policy if exists p_bb_push_insert on public.bb_push_subscriptions;
drop policy if exists p_bb_push_select on public.bb_push_subscriptions;   -- au cas où
create policy p_bb_push_insert on public.bb_push_subscriptions for insert to anon, authenticated with check (true);
-- (pas de policy SELECT → lecture bloquée pour anon ET authenticated)


-- ─── Tables « éphémères multijoueur » : INSERT + SELECT + UPDATE (+DELETE) ───
-- Nécessaires au fonctionnement des salons ; données jetables et non sensibles.

-- bb_rooms  (salons The Plug / The Mercato) — insert/select/update
drop policy if exists p_bb_rooms_insert on public.bb_rooms;
drop policy if exists p_bb_rooms_select on public.bb_rooms;
drop policy if exists p_bb_rooms_update on public.bb_rooms;
create policy p_bb_rooms_insert on public.bb_rooms for insert to anon, authenticated with check (true);
create policy p_bb_rooms_select on public.bb_rooms for select to anon, authenticated using (true);
create policy p_bb_rooms_update on public.bb_rooms for update to anon, authenticated using (true) with check (true);

-- bb_gg_rooms  (salons GOAT Grid battle) — insert/select/update/delete
drop policy if exists p_bb_gg_rooms_insert on public.bb_gg_rooms;
drop policy if exists p_bb_gg_rooms_select on public.bb_gg_rooms;
drop policy if exists p_bb_gg_rooms_update on public.bb_gg_rooms;
drop policy if exists p_bb_gg_rooms_delete on public.bb_gg_rooms;
create policy p_bb_gg_rooms_insert on public.bb_gg_rooms for insert to anon, authenticated with check (true);
create policy p_bb_gg_rooms_select on public.bb_gg_rooms for select to anon, authenticated using (true);
create policy p_bb_gg_rooms_update on public.bb_gg_rooms for update to anon, authenticated using (true) with check (true);
create policy p_bb_gg_rooms_delete on public.bb_gg_rooms for delete to anon, authenticated using (true);

-- bb_duels  (défis entre amis) — insert/select/update
drop policy if exists p_bb_duels_insert on public.bb_duels;
drop policy if exists p_bb_duels_select on public.bb_duels;
drop policy if exists p_bb_duels_update on public.bb_duels;
create policy p_bb_duels_insert on public.bb_duels for insert to anon, authenticated with check (true);
create policy p_bb_duels_select on public.bb_duels for select to anon, authenticated using (true);
create policy p_bb_duels_update on public.bb_duels for update to anon, authenticated using (true) with check (true);

-- bb_friend_requests  (demandes d'amis) — insert/select/update/delete
drop policy if exists p_bb_fr_insert on public.bb_friend_requests;
drop policy if exists p_bb_fr_select on public.bb_friend_requests;
drop policy if exists p_bb_fr_update on public.bb_friend_requests;
drop policy if exists p_bb_fr_delete on public.bb_friend_requests;
create policy p_bb_fr_insert on public.bb_friend_requests for insert to anon, authenticated with check (true);
create policy p_bb_fr_select on public.bb_friend_requests for select to anon, authenticated using (true);
create policy p_bb_fr_update on public.bb_friend_requests for update to anon, authenticated using (true) with check (true);
create policy p_bb_fr_delete on public.bb_friend_requests for delete to anon, authenticated using (true);


-- ─── bb_pseudos (profils) — insert/select/update/delete ───
-- ⚠️ Contient recovery_code (secret de récupération de compte). La lecture
-- reste ouverte en PHASE 1 pour ne rien casser → voir PHASE 2 pour fermer la
-- colonne recovery_code (la faille la plus importante).
drop policy if exists p_bb_pseudos_insert on public.bb_pseudos;
drop policy if exists p_bb_pseudos_select on public.bb_pseudos;
drop policy if exists p_bb_pseudos_update on public.bb_pseudos;
drop policy if exists p_bb_pseudos_delete on public.bb_pseudos;
create policy p_bb_pseudos_insert on public.bb_pseudos for insert to anon, authenticated with check (true);
create policy p_bb_pseudos_select on public.bb_pseudos for select to anon, authenticated using (true);
create policy p_bb_pseudos_update on public.bb_pseudos for update to anon, authenticated using (true) with check (true);
create policy p_bb_pseudos_delete on public.bb_pseudos for delete to anon, authenticated using (true);


-- ─── Tables mortes (ancien stack multijoueur, non montées côté client) ───
-- On active RLS SANS policy → accès anon totalement bloqué (défense en profondeur).
do $$
declare t text;
begin
  foreach t in array array['game_rooms','game_players'] loop
    if exists (select 1 from information_schema.tables
               where table_schema='public' and table_name=t) then
      execute format('alter table public.%I enable row level security;', t);
    end if;
  end loop;
end $$;


-- ############################################################################
-- ## PHASE 2 — FERMER LA FAILLE recovery_code (à faire avec le changement
-- ##            client fourni dans docs/SECURITY-SUPABASE.md)
-- ############################################################################
--
-- Problème : aujourd'hui l'app récupère un compte via
--     GET bb_pseudos?recovery_code=eq.<code>
-- ce qui exige que le rôle anon puisse LIRE la colonne recovery_code. Or si
-- anon peut la lire, il peut aussi la MOISSONNER en masse (SELECT player_id,
-- recovery_code ...) → prise de contrôle de TOUS les comptes.
--
-- Solution : déplacer la récupération dans une fonction SECURITY DEFINER qui
-- vérifie le code côté serveur et ne renvoie QUE le player_id/pseudo, puis
-- retirer le privilège de lecture de la colonne.
--
-- ⚠️ N'exécute ce bloc QU'APRÈS avoir déployé le changement client (déjà fait).

-- 1) Fonction serveur : vérifie le code et ne renvoie QUE player_id + pseudo.
create or replace function public.recover_account(p_code text)
returns table (player_id text, pseudo text)
language sql
security definer
set search_path = public
as $$
  select player_id, pseudo
  from public.bb_pseudos
  where recovery_code = p_code
  limit 1;
$$;
revoke all on function public.recover_account(text) from public, anon, authenticated;
grant execute on function public.recover_account(text) to anon, authenticated;

-- 2) Masque UNIQUEMENT la colonne recovery_code, à `anon` ET `authenticated` —
--    un retrait qui n'aurait visé qu'anon laisserait la colonne exposée aux
--    sessions authentifiées, exactement le trou que ce fichier vient de fermer
--    ailleurs pour bb_scores/bb_gg_scores.
--    On retire le SELECT global puis on le redonne sur toutes les AUTRES
--    colonnes (dont player_id, indispensable aux UPDATE ... WHERE player_id).
--    La suppression de compte (delete_user_account, SECURITY DEFINER) continue
--    de lire recovery_code sans problème (le definer ignore ce retrait).
revoke select on public.bb_pseudos from anon, authenticated;
grant select (
  id, player_id, pseudo, created_at, country, xp,
  streak_count, streak_last_date, streak_best, streak_freezes,
  last_notified_grade, xp_season, xp_season_month
) on public.bb_pseudos to anon, authenticated;


-- ############################################################################
-- ## VÉRIFICATION — l'account deletion RPC doit bien contrôler le code
-- ############################################################################
-- delete_user_account(p_player_id, p_recovery_code) existe déjà et est appelée
-- par l'app. Vérifie qu'elle est SECURITY DEFINER et qu'elle NE supprime QUE si
-- p_recovery_code correspond au recovery_code du player_id (sinon n'importe qui
-- peut supprimer le compte d'autrui en connaissant juste son player_id) :
--
--   select prosecdef, pg_get_functiondef(oid)
--   from pg_proc where proname = 'delete_user_account';
