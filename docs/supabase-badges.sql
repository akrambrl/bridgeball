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
-- d''écrire n''importe quoi dans la colonne depuis la clé publique anon.
alter table public.bb_pseudos
  drop constraint if exists bb_pseudos_badge_format;
alter table public.bb_pseudos
  add constraint bb_pseudos_badge_format
  check (badge is null or badge ~ '^[a-z0-9-]{1,40}$');

-- Rappel : la colonne est lisible publiquement (le badge s'affiche dans le
-- classement) et modifiable par le joueur via la politique d''UPDATE existante
-- de bb_pseudos. Aucune politique supplémentaire n'est nécessaire.
--
-- Vérification :
--   select player_id, pseudo, xp, badge from public.bb_pseudos
--   where badge is not null order by xp desc limit 20;
