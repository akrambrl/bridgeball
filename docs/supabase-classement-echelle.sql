-- ============================================================================
--  GOAT FC — RECALIBRAGE DU BARÈME et ÉCHELLE ×10
--  À coller dans Supabase → SQL Editor → Run. Idempotent : relançable.
--
--  Deux changements décidés après avoir REGARDÉ les chiffres réels, pas avant.
--
--  ── 1. L'ÉCHELLE PASSE DE 100 À 1000 ──────────────────────────────────────
--
--  Le plafond à 100 donnait des totaux dix fois plus petits que l'XP affichée
--  jusque-là : une partie de Plug à 950 points en rapportait 95, et le premier du
--  classement tombait de 33 700 à 2 398. L'onglet Saison paraissait cassé à côté
--  de l'onglet Global, resté en XP.
--
--  Ce n'était PAS un défaut de calcul. Recalcul indépendant depuis bb_scores et
--  bb_gg_scores, sans passer par la fonction serveur : chiffres identiques pour
--  les six premiers du classement. Et le plafond n'y était presque pour rien —
--  sur les 36 entrées du premier ce mois-ci, 4 seulement étaient plafonnées.
--  C'était l'UNITÉ qui avait changé sans le dire.
--
--  À 1000, l'échelle retrouve l'ordre de grandeur familier sans rien changer à la
--  mécanique : le meilleur score du jour par mode, et rien de plus.
--
--  ── 2. LE BARÈME DEVIENT COMPARABLE ENTRE MODES ───────────────────────────
--
--  La première version prenait « un très bon score » par mode sans regarder ce que
--  ça donnait pour une partie ORDINAIRE. Mesuré sur la production, une partie
--  médiane rapportait (ancienne échelle sur 100) :
--
--    mode              n    médiane   points   verdict
--    chaine          665       125        25   aligné
--    pont            547       260        26   aligné
--    findscore       225      1900        10   2,5× moins pour un effort égal
--    mercatoday        4       170        57   2× plus
--
--  Le classement disait donc silencieusement quel mode farmer. La cause n'est pas
--  une faute de saisie mais la FORME des distributions : la médiane de « Trouve le
--  joueur » est à 8 % de son maximum, celle du Plug à 22 %.
--
--  findscore passe de 20 000 à 7 500, mercatoday de 300 à 700. Éprouvé au banc :
--  l'écart entre modes sur une partie médiane tombe de 470 à 17 points sur 1000.
--
--  ⚠️ LE CLASSEMENT EST RECALCULÉ DEPUIS LES SCORES, donc ces deux changements
--     s'appliquent RÉTROACTIVEMENT : les totaux du mois en cours bougent dès le
--     Run. C'est voulu, et c'est la raison de le faire maintenant plutôt qu'en
--     septembre avec un lot en jeu.
--
--  Éprouvé par `npm run sql:essai` (17 contrôles, en numeric et en double
--  precision) et par une application sur une base restée à l'ancienne échelle.
-- ============================================================================


-- ─── 1. LE BARÈME ───────────────────────────────────────────────────────────
update public.bb_modes_bareme set reference = 7500 where mode = 'findscore';
update public.bb_modes_bareme set reference =  700 where mode = 'mercatoday';


-- ─── 2. LA NORMALISATION, SUR 1000 ──────────────────────────────────────────
create or replace function public.bb_points_normalises(p_mode text, p_score numeric)
returns int language sql stable as $$
  select coalesce((
    select least(1000, greatest(0, round(1000.0 * p_score / b.reference)))::int
      from public.bb_modes_bareme b where b.mode = p_mode
  ), 0)
$$;


-- ─── 3. LE CLASSEMENT ───────────────────────────────────────────────────────
-- Remplacé aussi : la branche GOAT GRID porte le plafond EN DUR dans sa requête,
-- donc remplacer la seule fonction de normalisation aurait laissé GOAT GRID sur
-- 100 pendant que tout le reste passait à 1000. Un mode dix fois moins payant que
-- les autres, sans que rien ne le signale.
create or replace function public.bb_classement_mois(p_mois text)
returns table (
  player_id text,
  pseudo    text,
  points    bigint,
  jours     bigint,
  modes     bigint
) language sql stable as $$
  with journalier as (
    -- Le meilleur score de chaque joueur, par jour de Paris et par mode.
    select s.player_id,
           (s.created_at at time zone 'Europe/Paris')::date as jour,
           s.mode,
           -- `::numeric` explicite : voir la section 3. La colonne n'est pas
           -- entière en production, et un cast explicite passe quel que soit son
           -- type réel — c'est ici que le fichier s'arrêtait en 42883.
           public.bb_points_normalises(s.mode, max(s.score)::numeric) as pts
      from public.bb_scores s
     where to_char(s.created_at at time zone 'Europe/Paris', 'YYYY-MM') = p_mois
     group by 1, 2, 3
    union all
    -- GOAT GRID : une grille par jour, normalisée par son propre maximum.
    select g.player_id,
           (g.created_at at time zone 'Europe/Paris')::date as jour,
           'goatgrid' as mode,
           least(1000, greatest(0, round(1000.0 * max(g.score)
                 / nullif(max(g.max_score), 0))))::int as pts
      from public.bb_gg_scores g
     where to_char(g.created_at at time zone 'Europe/Paris', 'YYYY-MM') = p_mois
     group by 1, 2
  )
  select j.player_id,
         coalesce(p.pseudo, '?') as pseudo,
         sum(j.pts)::bigint       as points,
         count(distinct j.jour)::bigint  as jours,
         count(distinct j.mode)::bigint  as modes
    from journalier j
    left join public.bb_pseudos p on p.player_id = j.player_id
   where j.pts > 0
   group by 1, 2
   order by points desc, jours desc, pseudo asc
$$;


-- ─── CONTRÔLES, À LANCER APRÈS ──────────────────────────────────────────────
-- a) Les nouveaux totaux. Le premier devrait être autour de dix fois l'ancien.
--    select * from public.bb_classement_courant() limit 10;
--
-- b) Une partie médiane vaut-elle à peu près pareil partout ?
--    select 'pont' as mode, public.bb_points_normalises('pont', 260) as pts
--    union all select 'chaine',     public.bb_points_normalises('chaine', 125)
--    union all select 'findscore',  public.bb_points_normalises('findscore', 1900)
--    union all select 'mercatoday', public.bb_points_normalises('mercatoday', 170);
--
-- c) Le barème appliqué :
--    select mode, reference, libelle from public.bb_modes_bareme order by mode;
