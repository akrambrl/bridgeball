-- ─── Badges de collection ─────────────────────────────────────────────────────
-- À exécuter UNE FOIS dans Supabase → SQL Editor.
--
-- Ajoute la colonne qui mémorise la carte choisie comme badge (voir
-- src/lib/collection.ts). On ne stocke QUE ce choix : les cartes possédées sont
-- déduites de bb_pseudos.xp, donc rien à synchroniser.
--
-- Tant que cette colonne n'existe pas, l'app fonctionne quand même : le choix
-- reste dans le navigateur du joueur (localStorage) et n'est simplement pas
-- visible par les autres. Aucune erreur affichée.

alter table public.bb_pseudos
  add column if not exists badge text;

comment on column public.bb_pseudos.badge is
  'Identifiant de la carte affichée en badge (CARDS[].id dans src/lib/collection.ts). NULL = aucun badge.';

-- Garde-fou : un identifiant de carte est court et sans espace. Empêche
-- d'écrire n'importe quoi dans la colonne depuis la clé publique anon.
alter table public.bb_pseudos
  drop constraint if exists bb_pseudos_badge_format;
alter table public.bb_pseudos
  add constraint bb_pseudos_badge_format
  check (badge is null or badge ~ '^[a-z0-9-]{1,40}$');

-- ⚠️ INDISPENSABLE sur ce projet : le SELECT de bb_pseudos est accordé COLONNE
-- PAR COLONNE (voir docs/supabase-rls.sql, qui masque recovery_code au rôle
-- anon). Une colonne neuve n'hérite donc d'AUCUN droit de lecture : sans la
-- ligne ci-dessous, l'app écrit bien le badge mais ne peut jamais le relire —
-- ni le sien, ni celui des autres dans le classement. Symptôme : erreur
-- « 42501 permission denied for table bb_pseudos » sur select=badge.
grant select (badge) on public.bb_pseudos to anon;

-- L'écriture, elle, ne demande rien : le privilège UPDATE d'anon porte sur la
-- table entière, il couvre donc les colonnes ajoutées ensuite. Vérifié par un
-- PATCH ne ciblant aucune ligne → 204.
--
-- Rappel : aucune politique RLS supplémentaire n'est nécessaire, la colonne
-- suit celles déjà en place sur bb_pseudos.
--
-- Vérification :
--   select player_id, pseudo, xp, badge from public.bb_pseudos
--   where badge is not null order by xp desc limit 20;
