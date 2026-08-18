-- ============================================================================
--  UNE GRILLE REPRISE CONTRE UNE PUB NE RAPPORTE PLUS DE POINTS
--  ---------------------------------------------------------------------------
--  À jouer une fois dans l'éditeur SQL de Supabase. Idempotent : rejouable.
--
--  ── LE DÉFAUT ─────────────────────────────────────────────────────────────
--
--  Le commentaire de src/components/LePont.jsx affirmait que GOAT GRID ne
--  comptait pas au classement mensuel, et la publicité récompensée y avait été
--  placée pour cette raison. C'était faux : `bb_classement_mois` fait un
--  `union all` sur bb_gg_scores, sous le mode 'goatgrid'.
--
--  Vérifié en base plutôt que supposé — trois joueurs n'ayant AUCUNE ligne dans
--  bb_scores sur le mois d'août :
--
--      pseudo    bb_scores   grilles   points au classement   somme des grilles
--      bap           0          1              309                  309
--      rwwnnn        0          1              627                  627
--      lucas         0          1              500                  500
--
--  Concordance exacte, trois fois. Onze joueurs sur 176 étaient classés en août
--  par la seule GOAT GRID.
--
--  Conséquence : regarder une publicité achetait une vie, qui montait le score
--  de la grille, qui rapportait des points au classement qui désigne le
--  champion du mois — celui qui reçoit le lot. Une récompense payée en attention
--  publicitaire se transformait en avantage dans un concours doté.
--
--  ── LE CHOIX ──────────────────────────────────────────────────────────────
--
--  Trois issues étaient possibles :
--
--    a) retirer GOAT GRID du classement, ce que le commentaire croyait déjà
--       vrai. Refusé : onze joueurs y sont classés par ce seul mode, leur retirer
--       leurs points effacerait une participation réelle ;
--    b) retirer la publicité. Refusé : c'est le placement le plus naturel de
--       l'app — le joueur la lance lui-même, au seul moment où elle a du sens ;
--    c) marquer la grille et l'exclure. Retenu.
--
--  La publicité reste, le revenu reste, et le classement redevient défendable
--  si quelqu'un conteste un résultat. Le joueur est prévenu AVANT de lancer la
--  vidéo : « cette grille ne comptera plus au classement du mois ». Un troc
--  annoncé, pas une prime cachée.
--
--  ── CE QUE CE CORRECTIF NE FAIT PAS ───────────────────────────────────────
--
--  Il n'empêche pas un client modifié d'écrire `vie_rachetee = false` après
--  avoir pris la vie. C'est vrai de TOUS les scores écrits par l'app avec la clé
--  publique, et cela relève de l'authentification anonyme — pas d'ici. Ce
--  correctif ferme un trou de CONCEPTION, pas un trou d'authentification.
--
--  ⚠️ LE CLASSEMENT EST RECALCULÉ DEPUIS LES SCORES : l'exclusion s'applique
--     RÉTROACTIVEMENT dès que cette fonction est remplacée. Les grilles déjà
--     enregistrées gardent `vie_rachetee = false` (valeur par défaut), donc
--     aucun point d'août n'est retiré à personne — l'app ne renseignait pas la
--     colonne, on ne peut pas deviner après coup qui avait racheté une vie. Le
--     correctif ne mord que sur les parties à venir, et c'est la seule lecture
--     honnête possible.
-- ============================================================================


-- ─── 1. LA COLONNE ──────────────────────────────────────────────────────────
-- `not null default false` et non `null` : une colonne à trois états — vrai,
-- faux, inconnu — obligerait chaque requête à choisir un camp pour les anciennes
-- lignes, et ce choix se ferait différemment selon l'endroit. Avec un défaut, les
-- grilles d'avant le correctif sont traitées comme honnêtes, ce qui est à la fois
-- indémontrable et le seul parti défendable.
alter table public.bb_gg_scores
  add column if not exists vie_rachetee boolean not null default false;

comment on column public.bb_gg_scores.vie_rachetee is
  'Vrai si le joueur a obtenu une vie supplémentaire en regardant une publicité. '
  'Ces grilles sont exclues du classement mensuel (bb_classement_mois) : une '
  'récompense publicitaire ne doit pas peser sur un concours doté.';

-- La politique d''insertion de bb_gg_scores est `with check (true)` sans liste de
-- colonnes (docs/supabase-rls.sql), donc l'app peut écrire cette colonne sans
-- nouvelle politique. Vérifié avant d'écrire ce fichier, pas supposé.


-- ─── 2. LE CLASSEMENT ───────────────────────────────────────────────────────
-- Recopié à l'identique de docs/supabase-classement-echelle.sql, à une clause
-- près. La fonction est remplacée EN ENTIER parce que PostgreSQL ne sait pas
-- modifier une branche d'un `union all` : c'est tout ou rien.
--
-- La seule différence est le `where` de la branche GOAT GRID, signalé sur place.
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
       -- ◀ LA SEULE LIGNE AJOUTÉE.
       --
       --   `coalesce` alors que la colonne est NOT NULL : ce n'est PAS pour
       --   survivre à une colonne absente — Postgres valide le corps d'une
       --   fonction SQL à sa création, donc la section 1 doit forcément avoir été
       --   jouée avant celle-ci, et l'ordre du fichier n'est pas négociable.
       --
       --   C'est pour survivre au jour où quelqu'un rendra la colonne nullable :
       --   sans coalesce, `not null_value` vaut NULL, la ligne serait filtrée en
       --   silence, et toutes les grilles concernées disparaîtraient du
       --   classement sans que rien ne le signale. Ça ne coûte rien ici et ça
       --   retire un mode de défaillance muet.
       and not coalesce(g.vie_rachetee, false)
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
--
-- a) La colonne existe et vaut faux partout (aucun point retiré rétroactivement) :
--
--      select vie_rachetee, count(*) from public.bb_gg_scores group by 1;
--
--    Attendu au premier passage : une seule ligne, `false`, avec le total.
--
-- b) Le classement n'a pas bougé — c'est le contrôle qui compte, parce qu'un
--    `union all` mal recopié se voit ici et nulle part ailleurs :
--
--      select * from public.bb_classement_courant() limit 10;
--
--    Attendu : exactement les mêmes totaux qu'avant l'exécution de ce fichier.
--    Note les trois premiers AVANT de lancer, et compare.
--
-- c) L'exclusion fonctionne vraiment. À faire sur une ligne de test qu'on retire
--    ensuite, PAS sur la grille d'un vrai joueur :
--
--      -- avant : noter les points du joueur de test
--      update public.bb_gg_scores set vie_rachetee = true
--       where player_id = '<un id de test>' and seed_date = '<une date>';
--      -- ses points doivent avoir baissé de la valeur de cette grille
--      update public.bb_gg_scores set vie_rachetee = false
--       where player_id = '<un id de test>' and seed_date = '<une date>';
--
-- d) Les onze joueurs classés par la seule GOAT GRID sont toujours là :
--
--      select pseudo, points, modes from public.bb_classement_courant()
--       where modes = 1 order by points desc;
