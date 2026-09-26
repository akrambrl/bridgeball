-- ============================================================================
--  GOAT FC — Classement mensuel VÉRIFIABLE côté serveur
--  À coller dans Supabase → SQL Editor → Run. Idempotent : relançable.
--
--  ⚠️ NE JAMAIS MODIFIER CE FICHIER SANS LE LANCER : `npm run sql:essai`.
--     Il monte un Postgres jetable au schéma de production et le passe en
--     entier. Sa première version avait été envoyée sans avoir jamais été
--     exécutée, et elle contenait DEUX défauts qu'aucune relecture n'a vus :
--     un arrêt en 42883 au milieu du déploiement (paramètre `int` contre une
--     colonne qui n'est pas entière, section 3), et une section 6 qui ne
--     bloquait rien du tout (un privilège de colonne ne restreint pas un rôle
--     qui a l'UPDATE de la table). Les deux sont expliqués sur place.
--
--  ⚠️ ORDRE DE DÉPLOIEMENT : l'application d'abord, ce fichier ENSUITE.
--     La dernière section retire au client le droit d'écrire `xp_season`. Si
--     elle est appliquée avant que l'app ait cessé de l'envoyer, le PATCH entier
--     est rejeté par Postgres — et c'est l'XP des joueurs qui s'arrête, pas
--     seulement le classement. Voir la section 6.
--
--  ── LE PROBLÈME QU'IL RÉSOUT ───────────────────────────────────────────────
--  Le champion du mois était décidé par `bb_pseudos.xp_season`, une colonne que
--  le CLIENT écrit lui-même. La clé `anon` est publique — elle est dans le
--  bundle — donc une seule requête HTTP suffisait :
--
--      PATCH /rest/v1/bb_pseudos?player_id=eq.MOI
--      {"xp_season": 999999999, "xp_season_month": "2026-08"}
--
--  Et comme le filtre est un simple `player_id`, on pouvait aussi remettre un
--  rival à zéro. Pire : la clôture de saison était faite PAR L'APP — le premier
--  joueur à l'ouvrir après le 1er du mois écrivait le Hall of Fame — et
--  `bb_seasons` était ouverte en écriture, donc on pouvait s'y déclarer champion
--  directement.
--
--  Tant qu'un lot dépend de ce classement, ce sont trois portes ouvertes.
--
--  ── CE QU'IL FAIT ──────────────────────────────────────────────────────────
--  1. un barème par mode, en table, réglable sans redéployer ;
--  2. un garde-fou à l'écriture des scores : bornes, cadence, mode connu ;
--  3. le classement RECALCULÉ depuis les scores — plus rien à falsifier, il n'y
--     a plus de compteur à modifier ;
--  4. GOAT GRID inclus, normalisé par son propre max ;
--  5. la clôture de saison réservée au serveur ;
--  6. le retrait des droits d'écriture devenus inutiles.
--
--  ── CE QU'IL NE FAIT PAS, ET IL FAUT LE SAVOIR ─────────────────────────────
--  Il n'y a toujours pas d'authentification : le serveur ne sait pas QUI
--  l'appelle. Quelqu'un peut donc encore déclarer un score humainement plausible
--  sans avoir joué. Ce que ce fichier garantit, c'est qu'un tel score ne peut pas
--  faire gagner : les points sont PLAFONNÉS par jour et par mode (section 3),
--  donc réclamer 60 000 sur la devinette rapporte exactement autant que le
--  réussir honnêtement — 1000 points, une fois. Le classement ne retenant que les
--  K meilleurs JOURS (section 4), truquer un mois revient à poser un bon score
--  plusieurs jours dans plusieurs modes — détectable (jours/modes joués, contrôle
--  d) et, surtout, revient à jouer.
--
--  Le classement devient donc CRÉDIBLE ET CONTRÔLABLE, pas mathématiquement
--  infalsifiable. Avant d'expédier un lot, passer la section 7.
-- ============================================================================


-- ─── 1. LE BARÈME ───────────────────────────────────────────────────────────
-- `reference` est le score qui vaut 1000 points. Il n'a pas à être le record :
-- c'est « un très bon score », et tout ce qui dépasse est plafonné à 1000.
--
-- `score_max` sert à un autre usage : refuser l'absurde à l'entrée. Il peut être
-- large — trois fois le meilleur score observé — parce que ce n'est PAS lui qui
-- protège le classement, c'est le plafond. Le garder large évite de refuser un
-- vrai record humain.
--
-- ── LE BARÈME DOIT ÊTRE COMPARABLE ENTRE MODES ─────────────────────────────
--
-- La première version prenait « un très bon score » par mode, sans regarder ce
-- que ça donnait pour une partie ORDINAIRE. Mesuré ensuite sur la vraie
-- distribution, une partie médiane rapportait :
--
--   mode              n    médiane   points   verdict
--   chaine          665       125       250   aligné
--   pont            547       260       260   aligné
--   findscore       225      1900       100   2,5× moins pour un effort égal
--   mercatoday        4       170       570   2× plus
--
-- Le classement disait donc silencieusement quel mode farmer. La cause n'est pas
-- une faute de saisie mais la FORME des distributions : la médiane de « Trouve le
-- joueur » est à 8 % de son maximum, celle du Plug à 22 %. Prendre « un très bon
-- score » comme référence pénalise donc les modes à longue traîne.
--
-- findscore passe de 20 000 à 7 500 et mercatoday de 300 à 700, pour qu'une
-- partie médiane vaille à peu près la même chose partout. `score_max` ne change
-- pas : ce n'est pas lui qui protège le classement, c'est le plafond.
--
-- CE BARÈME EST UNE TABLE, et c'est le point : le recalibrer est un UPDATE, sans
-- redéploiement de l'app ni mise à jour du store. Le classement étant recalculé
-- depuis les scores, il s'applique rétroactivement.
create table if not exists public.bb_modes_bareme (
  mode      text primary key,
  reference int  not null check (reference > 0),
  score_min int  not null,
  score_max int  not null,
  libelle   text
);

insert into public.bb_modes_bareme (mode, reference, score_min, score_max, libelle) values
  ('pont',       1000, -600,  3000, 'GOAT Plug'),
  ('chaine',      500, -600,  2000, 'GOAT Mercato'),
  ('findscore',  7500,    0, 60000, 'Trouve le joueur — score'),
  -- Devinette du jour : UNE manche par jour, points 100/200/500/1000 selon le
  -- nombre d'essais (voir roundScore dans FindPlayer.tsx). reference = 1000 =
  -- le maximum, donc la normalisation est l'identité : les points affichés à la
  -- fin de la manche sont exactement ceux qui tombent au classement. Le plafond
  -- « un score par jour et par mode » du classement suffit à empêcher le farm.
  ('devinette',  1000,    0,  1000, 'Devinette du jour'),
  ('mercatoday',  700,    0,  2000, 'Mercato du jour'),
  ('findplayer',  600,    0,  3000, 'Trouve le joueur'),
  ('findstreak',   10,    0,   200, 'Trouve le joueur — série')
on conflict (mode) do update
  set reference = excluded.reference, score_min = excluded.score_min,
      score_max = excluded.score_max, libelle = excluded.libelle;

alter table public.bb_modes_bareme enable row level security;
-- Lisible par l'app (elle peut vouloir afficher le barème), jamais modifiable.
-- Conditionnel : les deux rôles existent toujours ENSEMBLE sur Supabase, mais
-- pas forcément sur un Postgres nu — et ce fichier doit pouvoir être rejoué
-- ailleurs pour être testé, ce qui est exactement comme il a été validé.
--
-- ⚠️ `anon` ET `authenticated` : `bb_classement_mois` n'est pas SECURITY
-- DEFINER, elle lit ce barème SOUS L'IDENTITÉ de l'appelant — et `sbFetch`
-- (LePont.jsx) préfère le jeton de session dès qu'il existe
-- (docs/supabase-auth-anonyme.sql), donc la plupart des appels tournent sous
-- `authenticated`. Une policy `anon` seul rendait ce barème invisible pour
-- `authenticated`, donc `bb_points_normalises` retombait à 0 pour ce rôle —
-- une partie de ce qui a fait croire à un « bug » de classement le 17
-- septembre 2026 (même défaut que docs/supabase-rls.sql).
drop policy if exists p_bareme_select on public.bb_modes_bareme;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon')
     and exists (select 1 from pg_roles where rolname = 'authenticated') then
    create policy p_bareme_select on public.bb_modes_bareme for select to anon, authenticated using (true);
    -- Le GRANT en plus de la politique, et pas seulement la politique : une
    -- politique RLS n'accorde aucun privilège, elle ne fait que filtrer ce que
    -- le privilège autorise déjà. Sur Supabase le grant vient des privilèges par
    -- défaut du schéma public, donc l'oubli ne se voyait pas — mais
    -- `bb_classement_mois` n'est pas en SECURITY DEFINER : elle lit ce barème
    -- SOUS L'IDENTITÉ de l'appelant, donc sans ce droit l'onglet Saison tombe
    -- en erreur au lieu de s'afficher. L'écrire ici rend le fichier autonome.
    grant select on public.bb_modes_bareme to anon, authenticated;
  end if;
end $$;


-- ─── 2. GARDE-FOU À L'ÉCRITURE DES SCORES ───────────────────────────────────
-- Un trigger et non une fonction RPC : le client n'a AUCUNE ligne à changer, donc
-- aucun risque de casser une partie en cours de déploiement. Même choix que pour
-- la modération des pseudos.
create or replace function public.bb_scores_garde()
returns trigger language plpgsql as $$
declare
  b record;
  recent int;
  dujour int;
begin
  -- L'HORODATAGE EST IMPOSÉ PAR LE SERVEUR, et ce n'est pas un détail : il
  -- arrivait du client, qui pouvait donc antidater un score. Deux conséquences
  -- qu'on ferme d'un coup :
  --   • poser des scores dans un mois DÉJÀ CLÔTURÉ, ou dans le mois en cours à
  --     des dates choisies pour paraître régulier ;
  --   • contourner le contrôle de cadence juste en dessous, qui se compare à
  --     `now()` — un score annoncé « il y a une heure » y échappait.
  -- Découvert en testant : la première version comparait la fraîcheur des lignes
  -- existantes sans regarder l'horodatage de la nouvelle, ce qui refusait aussi
  -- toute insertion historique légitime.
  new.created_at := now();

  select * into b from public.bb_modes_bareme where mode = new.mode;

  -- Mode INCONNU : accepté, et c'est volontaire. Refuser bloquerait un mode
  -- ajouté plus tard dont on aurait oublié le barème — un joueur perdrait sa
  -- partie pour une ligne de configuration manquante. Il rapportera 0 point
  -- (section 3), et la section 7 liste ces modes pour qu'on les voie.
  if b is null then
    return new;
  end if;

  if new.score < b.score_min or new.score > b.score_max then
    raise exception 'score hors bornes pour le mode % (recu %, attendu entre % et %)',
      new.mode, new.score, b.score_min, b.score_max
      using errcode = 'check_violation', hint = 'bornes';
  end if;

  -- Cadence. Mesuré sur 1059 intervalles réels entre deux scores du même mode :
  -- médiane 278 s, 5e centile 90 s, et seulement 13 intervalles sous 10 s. Un
  -- plancher à 10 s ne gêne donc personne et arrête les doubles envois comme les
  -- scripts. La borne haute journalière est à 150 quand le maximum observé est 65.
  select count(*) into recent from public.bb_scores s
   where s.player_id = new.player_id and s.mode = new.mode
     and s.created_at > now() - interval '10 seconds';
  if recent > 0 then
    raise exception 'score deja enregistre il y a moins de 10 s pour ce mode'
      using errcode = 'check_violation', hint = 'cadence';
  end if;

  select count(*) into dujour from public.bb_scores s
   where s.player_id = new.player_id and s.created_at > now() - interval '1 day';
  if dujour >= 150 then
    raise exception 'trop de scores enregistres en 24 h (%)', dujour
      using errcode = 'check_violation', hint = 'quota';
  end if;

  return new;
end $$;

drop trigger if exists bb_scores_garde_trg on public.bb_scores;
create trigger bb_scores_garde_trg
  before insert on public.bb_scores
  for each row execute function public.bb_scores_garde();


-- ─── 3. LA NORMALISATION ────────────────────────────────────────────────────
-- 1000 points pour la référence du mode, plafonné. Un score négatif vaut 0 : les
-- pénalités de pass n'ont pas à faire perdre des points de classement, elles ont
-- déjà coûté le score de la partie.
--
-- POURQUOI 1000 ET NON 100. Le plafond à 100 donnait des totaux dix fois plus
-- petits que l'XP affichée jusque-là — une partie de Plug à 950 points valait
-- 95 — et l'onglet Saison paraissait cassé à côté de l'onglet Global, qui montre
-- toujours l'XP. Ce n'était pas un défaut de calcul (recalcul indépendant depuis
-- bb_scores : chiffres identiques au serveur) mais un changement d'UNITÉ non dit.
-- À 1000, l'échelle retrouve l'ordre de grandeur familier sans rien changer à la
-- mécanique : le meilleur score du jour par mode, et rien de plus.
--
-- LE PARAMÈTRE EST `numeric` ET NON `int`, et ce n'est pas une préférence :
-- `bb_scores.score` n'est PAS un entier sur la base de production. Mesuré, pas
-- supposé — un filtre `?score=eq.1.5` y est accepté, alors qu'il répond 400
-- « invalid input syntax for type integer » sur bb_gg_scores.score,
-- bb_pseudos.xp et bb_seasons.champion_score. Or Postgres ne descend pas
-- IMPLICITEMENT de numeric vers int pour résoudre une fonction : déclarée en
-- `int`, celle-ci était introuvable depuis `bb_classement_mois`, et le fichier
-- s'arrêtait en plein déploiement sur
--     42883: function public.bb_points_normalises(text, numeric) does not exist
-- Les appels castent en plus explicitement, ce qui rend le fichier indifférent
-- au type exact de la colonne — la sonde prouve qu'elle n'est pas entière sans
-- dire si elle est numeric ou double precision, et un cast explicite couvre les
-- deux. Éprouvé dans les deux cas : npm run sql:essai.
create or replace function public.bb_points_normalises(p_mode text, p_score numeric)
returns int language sql stable as $$
  select coalesce((
    select least(1000, greatest(0, round(1000.0 * p_score / b.reference)))::int
      from public.bb_modes_bareme b where b.mode = p_mode
  ), 0)
$$;


-- ─── 4. LE CLASSEMENT DU MOIS ───────────────────────────────────────────────
-- LA RÈGLE DE BASE : pour chaque JOUR et chaque MODE, seul le MEILLEUR score du
-- joueur compte, et il rapporte au plus 1000 points. Ce plafond est le cœur de la
-- sécurité :
--   • un score gonflé ne rapporte pas plus qu'un très bon score honnête ;
--   • rejouer vingt fois le même mode dans la journée ne rapporte rien de plus ;
--   • pour accumuler, il faut jouer plusieurs modes — le comportement voulu.
--
-- ── DEUX RÈGLES EN PLUS, POUR QUE LES DERNIERS ET LES NOUVEAUX REMONTENT ────
-- Le problème : la première version SOMMAIT tous les jours du mois. Un joueur
-- arrivé le 15 avait dix jours de retard IMPOSSIBLES à rattraper, et jouer des
-- heures n'y changeait rien puisqu'un jour est plafonné. C'était injuste pour les
-- retardataires et le bas de tableau.
--
--  A) MEILLEURS JOURS. On ne somme plus tous les jours mais les K MEILLEURS
--     (K = 15, ~une demi-saison, voir `bb_parametre_k`). Un joueur qui commence
--     au milieu du mois et joue bien ses quinze jours atteint le MÊME plafond
--     qu'un joueur présent tout le mois : les jours ratés en début de mois ne le
--     condamnent plus. Au-delà de quinze jours, jouer encore ne se cumule pas à
--     l'infini — ce qui remet nouveaux et réguliers à portée l'un de l'autre.
--     C'est la moyenne des bons jours qui prime, pas le simple fait d'avoir été
--     là chaque jour.
--
--  B) BONUS DE RATTRAPAGE. Par-dessus, plus un joueur est loin du 1er du mois,
--     plus ses points affichés sont rehaussés (jusqu'à +50 % pour le fond de
--     tableau, 0 % pour le leader). Le but est motivant : l'écart paraît
--     rattrapable. C'est une fonction CROISSANTE des points bruts, donc elle ne
--     change AUCUN rang — elle resserre seulement l'affichage. Un joueur ne double
--     personne grâce au bonus ; il double en jouant (règle A). Le leader honnête
--     reste leader.
--
-- Le bonus est une constante en tête de la fonction : la régler, c'est relancer
-- ce fichier (idempotent), sans redéploiement de l'app. K vit dans
-- `bb_parametre_k()`, seule source de vérité (section 4bis en dépend aussi).
--
-- Les jours sont comptés en HEURE DE PARIS, comme le reste de l'app (la devinette
-- du jour, les séries) : en UTC, une partie jouée à 23 h 30 tomberait le lendemain.
--
-- GOAT GRID (bb_gg_scores) est inclus et se normalise tout seul : la table porte
-- `max_score`, donc le pourcentage de grille remplie est la mesure naturelle.
--
-- ── LE PLANCHER (section 4bis, définie juste en dessous) ────────────────────
-- Le passage à la règle A a fait chuter, LE JOUR MÊME de son application, le
-- total affiché de joueurs qui avaient plus de K jours cumulés sous l'ANCIENNE
-- règle (tout le mois, sans plafond) — signalé en production le 17 septembre
-- 2026. `bb_classement_hwm` empêche ça : les points affichés ne redescendent
-- jamais sous le plus haut total déjà montré, exactement comme l'XP de toujours
-- (`src/lib/xp.ts`) ne redescend jamais. `brut` ci-dessous calcule le total
-- SELON LA RÈGLE A, et c'est seulement au moment de le combiner au plancher
-- (`avec_plancher`) que le pire des deux mondes est écarté.
--
-- ⚠️ `bb_parametre_k()` et la table `bb_classement_hwm` sont donc créées ICI,
-- AVANT `bb_classement_mois` : une fonction SQL valide l'EXISTENCE de ce
-- qu'elle appelle dès sa création, pas seulement à l'exécution — les définir
-- après aurait arrêté le fichier en 42883 (« function … does not exist »), et
-- c'est exactement ce qui s'est produit en l'écrivant.
create or replace function public.bb_parametre_k()
returns int language sql immutable as $$ select 15 $$;

create table if not exists public.bb_classement_hwm (
  player_id text not null,
  mois      text not null,
  points    bigint not null default 0,
  primary key (player_id, mois)
);
alter table public.bb_classement_hwm enable row level security;
-- Lisible par l'app (bb_classement_mois la lit SOUS L'IDENTITÉ de l'appelant,
-- comme le barème section 1 — sans ce droit l'onglet Saison tombe en erreur).
-- Jamais modifiable directement : voir le revoke à la fin de la section 4bis.
--
-- ⚠️ `anon` ET `authenticated` : `sbFetch` (LePont.jsx) préfère le jeton de
-- session dès qu'il existe (docs/supabase-auth-anonyme.sql), donc la plupart
-- des appels tournent sous `authenticated`, pas `anon`. Une policy `anon` seul
-- rend la table INVISIBLE pour `authenticated` — silencieusement, sans erreur —
-- et le plancher ne s'applique alors jamais pour un joueur connecté : `pts_brut`
-- de `avec_plancher` retombe à la valeur SANS plancher pour ce rôle. C'est
-- exactement le défaut qui a fait croire à un « bug » le 17 septembre 2026 (même
-- défaut que docs/supabase-rls.sql, découvert par ce signalement).
-- Les deux rôles sont vérifiés ENSEMBLE : `to anon, authenticated` échoue tout
-- entier si l'un des deux manque (ex. un Postgres nu sans `authenticated`).
drop policy if exists p_hwm_select on public.bb_classement_hwm;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon')
     and exists (select 1 from pg_roles where rolname = 'authenticated') then
    create policy p_hwm_select on public.bb_classement_hwm for select to anon, authenticated using (true);
    grant select on public.bb_classement_hwm to anon, authenticated;
  end if;
end $$;

create or replace function public.bb_classement_mois(p_mois text)
returns table (
  player_id text,
  pseudo    text,
  points    bigint,
  jours     bigint,
  modes     bigint
) language sql stable as $$
  with parametres as (
    -- Le bonus (règle B) plafonne à +bonus_max pour le fond de tableau. K (règle
    -- A) vient de `bb_parametre_k()`, pas d'ici — une seule source de vérité,
    -- partagée avec le plancher de la section 4bis.
    select public.bb_parametre_k() as k, 0.5::numeric as bonus_max
  ),
  journalier as (
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
  ),
  par_jour as (
    -- Total d'un joueur POUR UN JOUR = somme de ses meilleurs par mode ce jour-là.
    -- Jouer plusieurs modes dans la journée compte donc toujours ; c'est
    -- l'accumulation SUR LES JOURS qui est plafonnée à K (règle A), pas la journée.
    select player_id, jour, sum(pts) as pts_jour
      from journalier
     where pts > 0
     group by 1, 2
  ),
  classe as (
    -- Les jours de chaque joueur, du meilleur au moins bon.
    select player_id, jour, pts_jour,
           row_number() over (partition by player_id order by pts_jour desc, jour) as rang_jour
      from par_jour
  ),
  brut as (
    -- Points BRUTS SELON LA RÈGLE A = somme des K meilleurs jours. `jours` reste
    -- le nombre TOTAL de jours joués (indicateur de régularité affiché dans
    -- l'app), pas le nombre retenu.
    select c.player_id,
           sum(c.pts_jour) filter (where c.rang_jour <= (select k from parametres))::bigint as pts_brut,
           count(distinct c.jour)::bigint as jours
      from classe c
     group by 1
  ),
  -- Le plancher : le plus haut total déjà montré à ce joueur ce mois-ci (voir
  -- section 4bis). `coalesce` à 0 pour un joueur jamais vu par le plancher —
  -- son brut de la règle A s'applique alors tel quel, aucun plancher à lui
  -- opposer.
  avec_plancher as (
    select b.player_id, b.jours,
           greatest(b.pts_brut, coalesce(h.points, 0))::bigint as pts_brut
      from brut b
      left join public.bb_classement_hwm h
        on h.player_id = b.player_id and h.mois = p_mois
  ),
  modes_joues as (
    select player_id, count(distinct mode)::bigint as modes
      from journalier where pts > 0 group by 1
  ),
  sommet as (
    -- Le meilleur total (après plancher) du mois : la référence du bonus de
    -- rattrapage. Basé sur `avec_plancher`, pas sur `brut` seul, pour que le
    -- bonus de chacun se compare à ce qui est RÉELLEMENT affiché au 1er.
    select coalesce(max(pts_brut), 0)::numeric as top from avec_plancher
  )
  select b.player_id,
         coalesce(p.pseudo, '?') as pseudo,
         -- Règle B : rehausse d'autant plus qu'on est loin du sommet. Croissante
         -- en pts_brut (dérivée minimale 1 - bonus_max > 0), donc elle préserve
         -- l'ordre des rangs et ne fait que resserrer l'affichage.
         round(b.pts_brut * (1 + pr.bonus_max
               * greatest(0, so.top - b.pts_brut) / nullif(so.top, 0)))::bigint as points,
         b.jours,
         coalesce(m.modes, 0) as modes
    from avec_plancher b
    cross join parametres pr
    cross join sommet so
    left join public.bb_pseudos p on p.player_id = b.player_id
    left join modes_joues m on m.player_id = b.player_id
   where b.pts_brut > 0
   order by points desc, b.jours desc, pseudo asc
$$;


-- ─── 4bis. LE PLANCHER : CE QUI EST DÉJÀ ATTEINT NE REDESCEND JAMAIS ────────
-- Signalé en production le 17 septembre 2026 : le passage à la règle A a fait
-- chuter le total affiché de « night » de 20 774 à 12 994 points, le jour même
-- où le fichier a été rappliqué — il avait cumulé plus de K jours sous l'ANCIENNE
-- règle (tous les jours du mois, sans plafond), et ces jours en trop ont cessé
-- de compter d'un coup. Un total qui recule ressemble à une triche côté serveur,
-- même quand la cause est un changement de barème légitime.
--
-- ── LA RÈGLE ─────────────────────────────────────────────────────────────
-- 1. UNE SEULE FOIS, à l'application de cette section, on fige pour chaque
--    joueur actif ce mois-ci son total SELON L'ANCIENNE RÈGLE (tous les jours,
--    sans plafond de K) — c'est le pire cas qu'un changement de barème ne doit
--    jamais faire redescendre.
-- 2. ENSUITE, à CHAQUE score inséré, le plancher ne monte que selon la RÈGLE A
--    (les K meilleurs jours) — jamais selon l'ancienne règle illimitée. Sinon
--    un acharné qui joue son 20e jour referait grimper son plancher au-delà de
--    ce que K meilleurs jours autorise, et on aurait tout simplement RECONSTRUIT
--    l'ancien défaut (le retardataire à nouveau impossible à rattraper) —
--    seulement décalé de quelques jours au lieu de disparaître.
--
-- Le résultat : le plancher protège le total déjà vu AUJOURD'HUI, mais toute
-- CROISSANCE FUTURE suit la même règle A que tout le monde, retardataires
-- compris.
--
-- ── CE N'EST PAS UN COMPTEUR RÉOUVERT À LA TRICHE ───────────────────────────
-- La seule écriture possible sur `bb_classement_hwm` vient du trigger
-- ci-dessous, déclenché par une insertion RÉELLE dans `bb_scores` — donc déjà
-- filtrée par `bb_scores_garde` (bornes, cadence, quota, section 2). `anon` n'a
-- aucun droit d'écriture direct sur cette table (revoke plus bas) : impossible
-- d'y poser 999 999 999 comme sur l'ancien `xp_season`.
--
-- `bb_parametre_k()` et la table `bb_classement_hwm` sont définies plus haut,
-- juste avant `bb_classement_mois` — voir la remarque à cet endroit.

-- Le total d'un joueur selon la RÈGLE A (les K meilleurs jours), pour un mois
-- donné. Même logique que la CTE `brut` de `bb_classement_mois`, isolée ici
-- pour être appelée PAR JOUEUR depuis le trigger de mise à jour du plancher.
create or replace function public.bb_points_bruts_topk(p_player_id text, p_mois text)
returns bigint language sql stable as $$
  with journalier as (
    select (s.created_at at time zone 'Europe/Paris')::date as jour,
           public.bb_points_normalises(s.mode, max(s.score)::numeric) as pts
      from public.bb_scores s
     where s.player_id = p_player_id
       and to_char(s.created_at at time zone 'Europe/Paris', 'YYYY-MM') = p_mois
     group by 1, s.mode
    union all
    select (g.created_at at time zone 'Europe/Paris')::date as jour,
           least(1000, greatest(0, round(1000.0 * max(g.score)
                 / nullif(max(g.max_score), 0))))::int as pts
      from public.bb_gg_scores g
     where g.player_id = p_player_id
       and to_char(g.created_at at time zone 'Europe/Paris', 'YYYY-MM') = p_mois
     group by 1
  ),
  par_jour as (
    select jour, sum(pts) as pts_jour from journalier where pts > 0 group by 1
  ),
  classe as (
    select pts_jour, row_number() over (order by pts_jour desc, jour) as rang_jour
      from par_jour
  )
  select coalesce(sum(pts_jour) filter (where rang_jour <= public.bb_parametre_k()), 0)::bigint
    from classe
$$;

-- Le total d'un joueur selon L'ANCIENNE RÈGLE (tous les jours, sans plafond).
-- Sert UNIQUEMENT à la migration ponctuelle ci-dessous, jamais au trigger
-- courant — voir « LA RÈGLE » plus haut pour pourquoi les deux ne doivent pas
-- se confondre.
create or replace function public.bb_points_bruts_illimites(p_player_id text, p_mois text)
returns bigint language sql stable as $$
  with journalier as (
    select (s.created_at at time zone 'Europe/Paris')::date as jour,
           public.bb_points_normalises(s.mode, max(s.score)::numeric) as pts
      from public.bb_scores s
     where s.player_id = p_player_id
       and to_char(s.created_at at time zone 'Europe/Paris', 'YYYY-MM') = p_mois
     group by 1, s.mode
    union all
    select (g.created_at at time zone 'Europe/Paris')::date as jour,
           least(1000, greatest(0, round(1000.0 * max(g.score)
                 / nullif(max(g.max_score), 0))))::int as pts
      from public.bb_gg_scores g
     where g.player_id = p_player_id
       and to_char(g.created_at at time zone 'Europe/Paris', 'YYYY-MM') = p_mois
     group by 1
  )
  select coalesce(sum(pts), 0)::bigint
    from (select jour, sum(pts) as pts from journalier where pts > 0 group by 1) par_jour
$$;

-- Le trigger qui fait monter le plancher : après CHAQUE score inséré (donc déjà
-- passé par bb_scores_garde), on relit le total RÈGLE A du joueur pour ce mois
-- et on ne garde que le plus grand des deux. SECURITY DEFINER : c'est lui qui a
-- le droit d'écrire sur bb_classement_hwm, pas anon — voir le revoke plus bas.
-- `set search_path` fixe : une fonction security definer sans ça est
-- détournable en posant un objet de même nom dans un schéma placé avant public.
create or replace function public.bb_classement_hwm_maj()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m text := to_char(new.created_at at time zone 'Europe/Paris', 'YYYY-MM');
  b bigint;
begin
  b := public.bb_points_bruts_topk(new.player_id, m);
  insert into public.bb_classement_hwm (player_id, mois, points)
  values (new.player_id, m, b)
  on conflict (player_id, mois) do update
    set points = greatest(bb_classement_hwm.points, excluded.points);
  return null;
end $$;

drop trigger if exists bb_classement_hwm_trg on public.bb_scores;
create trigger bb_classement_hwm_trg
  after insert on public.bb_scores
  for each row execute function public.bb_classement_hwm_maj();

-- ── LA MIGRATION UNE FOIS, POUR LE MOIS EN COURS ────────────────────────────
-- Fige le plancher de CHAQUE joueur ayant marqué ce mois-ci à son total SELON
-- L'ANCIENNE RÈGLE (illimitée), évalué à l'instant où ce fichier est appliqué.
-- Idempotent (`greatest`) : le rejouer ne fait jamais redescendre un plancher
-- déjà posé, et n'a d'effet que sur le mois EN COURS — les mois déjà clôturés
-- n'ont pas besoin de plancher.
insert into public.bb_classement_hwm (player_id, mois, points)
select s.player_id,
       to_char(now() at time zone 'Europe/Paris', 'YYYY-MM'),
       public.bb_points_bruts_illimites(s.player_id,
         to_char(now() at time zone 'Europe/Paris', 'YYYY-MM'))
  from (
    select distinct player_id from public.bb_scores
     where to_char(created_at at time zone 'Europe/Paris', 'YYYY-MM')
         = to_char(now() at time zone 'Europe/Paris', 'YYYY-MM')
  ) s
on conflict (player_id, mois) do update
  set points = greatest(bb_classement_hwm.points, excluded.points);

-- ── NI ANON NI AUTHENTICATED NE PEUVENT ÉCRIRE DIRECTEMENT SUR LE PLANCHER ──
-- Même piège que la section 6 pour bb_pseudos : Supabase accorde par défaut
-- l'INSERT/UPDATE/DELETE de table à `anon` ET À `authenticated` sur tout le
-- schéma public. Un revoke qui n'aurait visé qu'`anon` laisserait n'importe
-- quelle session authentifiée (la plupart des joueurs, voir plus haut) poser
-- son propre plancher à 999 999 999 — exactement le défaut que ce fichier
-- corrige déjà une fois pour xp_season.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke insert, update, delete on public.bb_classement_hwm from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke insert, update, delete on public.bb_classement_hwm from authenticated;
  end if;
end $$;

-- Raccourci pour l'app : le mois EN COURS, heure de Paris.
create or replace function public.bb_classement_courant()
returns table (player_id text, pseudo text, points bigint, jours bigint, modes bigint)
language sql stable as $$
  select * from public.bb_classement_mois(
    to_char(now() at time zone 'Europe/Paris', 'YYYY-MM'))
$$;


-- ─── 4ter. MES JOURS, POUR MOI-MÊME SEULEMENT ───────────────────────────────
--
-- `bb_classement_mois` ne renvoie qu'un TOTAL par joueur : le détail
-- jour par jour (quels jours comptent parmi les K meilleurs, lequel ne compte
-- plus) n'était nulle part exposé — signalé, le joueur ne peut aujourd'hui que
-- lire le texte expliquant la règle, jamais la voir appliquée à SES parties.
--
-- Le détail existe déjà : la CTE `journalier`/`par_jour`/`classe` de la section
-- 4 le calcule à la volée pour TOUT LE MONDE avant de le réduire à un total.
-- Cette fonction rejoue exactement la même logique, mais SCOPÉE À UN SEUL
-- JOUEUR — le sien, jamais un autre :
--
--   • PAS DE `p_player_id` en paramètre. Si la fonction acceptait l'identité en
--     entrée, n'importe qui pourrait lire le détail jour par jour de n'importe
--     quel adversaire (que `bb_classement_mois` ne fait jamais fuiter, lui : il
--     n'expose qu'un total, jamais un historique). Le joueur est retrouvé tout
--     seul, depuis `auth.uid()` — comme `bb_garde_identite()` le fait déjà pour
--     interdire de renommer le pseudo d'un autre (supabase-auth-anonyme.sql).
--   • `moi` vide (compte jamais lié, ou anonyme non authentifié) → aucune ligne
--     renvoyée, jamais une erreur : l'appelant voit un tableau vide, pas un
--     joueur qui n'existe pas.
--   • NI SECURITY DEFINER, ni policy à part : elle lit `bb_scores`/`bb_gg_scores`
--     SOUS L'IDENTITÉ DE L'APPELANT, comme `bb_classement_mois` — mais avec un
--     filtre `player_id = (select player_id from moi)` qui la rend même PLUS
--     restrictive que la fonction publique dont elle réutilise la logique.
create or replace function public.bb_mes_jours(p_mois text)
returns table (
  jour    date,
  points  bigint,
  retenu  boolean
) language sql stable as $$
  with moi as (
    select player_id from public.bb_pseudos where auth_uid = auth.uid()
  ),
  parametres as (
    select public.bb_parametre_k() as k
  ),
  journalier as (
    -- Même calcul que la section 4, restreint à `moi` : un joueur non lié
    -- (`moi` vide) ne matche jamais aucune ligne de `bb_scores`, ce qui suffit
    -- à rendre le résultat vide sans avoir à tester `moi` séparément.
    select s.player_id,
           (s.created_at at time zone 'Europe/Paris')::date as jour,
           s.mode,
           public.bb_points_normalises(s.mode, max(s.score)::numeric) as pts
      from public.bb_scores s
     where s.player_id = (select player_id from moi)
       and to_char(s.created_at at time zone 'Europe/Paris', 'YYYY-MM') = p_mois
     group by 1, 2, 3
    union all
    select g.player_id,
           (g.created_at at time zone 'Europe/Paris')::date as jour,
           'goatgrid' as mode,
           least(1000, greatest(0, round(1000.0 * max(g.score)
                 / nullif(max(g.max_score), 0))))::int as pts
      from public.bb_gg_scores g
     where g.player_id = (select player_id from moi)
       and to_char(g.created_at at time zone 'Europe/Paris', 'YYYY-MM') = p_mois
     group by 1, 2
  ),
  par_jour as (
    select jour, sum(pts) as pts_jour
      from journalier
     where pts > 0
     group by 1
  )
  select j.jour, j.pts_jour::bigint as points,
         (row_number() over (order by j.pts_jour desc, j.jour)
            <= (select k from parametres)) as retenu
    from par_jour j
   order by j.jour desc
$$;

-- Raccourci pour l'app : le mois EN COURS, heure de Paris — même convention
-- que `bb_classement_courant`.
create or replace function public.bb_mes_jours_courant()
returns table (jour date, points bigint, retenu boolean)
language sql stable as $$
  select * from public.bb_mes_jours(
    to_char(now() at time zone 'Europe/Paris', 'YYYY-MM'))
$$;


-- ─── 5. LA CLÔTURE, RÉSERVÉE AU SERVEUR ─────────────────────────────────────
-- `bb_seasons` n'est plus écrite par l'app. C'est une tâche planifiée qui appelle
-- cette fonction avec la clé de service — voir .github/workflows/cloture-saison.yml.
--
-- La fonction REFUSE de clôturer si un mode inconnu du barème a rapporté des
-- scores dans le mois : mieux vaut un Hall of Fame en retard d'un jour qu'un
-- champion désigné sur un barème incomplet.
create or replace function public.bb_cloturer_saison(p_mois text, p_numero int)
returns table (etat text, detail text) language plpgsql security definer
set search_path = public as $$
declare
  inconnus text;
  n int;
  c record;
begin
  select string_agg(distinct s.mode, ', ') into inconnus
    from public.bb_scores s
    left join public.bb_modes_bareme b on b.mode = s.mode
   where to_char(s.created_at at time zone 'Europe/Paris', 'YYYY-MM') = p_mois
     and b.mode is null;
  if inconnus is not null then
    return query select 'refus'::text,
      ('mode(s) absent(s) du bareme : ' || inconnus)::text;
    return;
  end if;

  if exists (select 1 from public.bb_seasons where season_number = p_numero) then
    return query select 'deja'::text, ('saison ' || p_numero || ' deja cloturee')::text;
    return;
  end if;

  select count(*) into n from public.bb_classement_mois(p_mois);
  -- Le garde-fou d'origine, conservé : sans trois participants, pas de titre.
  if n < 3 then
    return query select 'refus'::text, ('seulement ' || n || ' participant(s)')::text;
    return;
  end if;

  select * into c from public.bb_classement_mois(p_mois) limit 1;
  insert into public.bb_seasons
    (season_number, champion_id, champion_name, champion_score, mode, ended_at)
  values (p_numero, c.player_id, c.pseudo, c.points, 'global', now());

  return query select 'ok'::text, (c.pseudo || ' — ' || c.points || ' points')::text;
end $$;

-- ── PLUS PERSONNE D'AUTRE QUE LE SERVEUR N'ÉCRIT LE HALL OF FAME ───────────
--
-- ⚠️ LE RETRAIT SE FAIT SUR `public`, PAS SUR `anon`, et la nuance a coûté une
--    fausse saison en production. La première version disait
--
--        revoke execute on function public.bb_cloturer_saison(text, int) from anon;
--
--    et ne retirait RIEN. Postgres accorde EXECUTE à PUBLIC sur toute fonction
--    dès sa création, et PUBLIC couvre `anon` : retirer le grant direct d'un rôle
--    qui n'en a jamais eu ne change rien. La fonction étant en SECURITY DEFINER,
--    n'importe qui muni de la clé publique — qui est dans le bundle — pouvait
--    donc couronner qui il voulait, quels que soient les droits sur bb_seasons.
--    Constaté pour de vrai : un appel de contrôle a écrit une saison 999.
--
--    Pourquoi le `revoke insert on bb_seasons` juste en dessous, lui, marchait :
--    les TABLES n'ont pas de grant PUBLIC par défaut. Les FONCTIONS si. C'est la
--    même erreur que la section 6, où un privilège de colonne ne restreignait
--    pas un rôle détenant l'UPDATE de la table.
--
-- Éprouvé par npm run sql:essai, qui prend le rôle `anon` et essaie vraiment
-- d'appeler la clôture — le contrôle qui manquait.
drop policy if exists p_bb_seasons_insert on public.bb_seasons;

revoke execute on function public.bb_cloturer_saison(text, int) from public;
-- Le service, lui, doit pouvoir l'appeler : c'est la tâche planifiée du 1er du
-- mois, avec la clé de service. Le grant est explicite parce qu'il ne dépend
-- plus de PUBLIC, qu'on vient de retirer.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.bb_cloturer_saison(text, int) to service_role;
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke insert on public.bb_seasons from anon;
    -- Ceinture et bretelles : si un grant direct existait par ailleurs (les
    -- privilèges par défaut de Supabase en posent un sur les nouvelles
    -- fonctions), le retrait de PUBLIC seul ne l'enlèverait pas.
    revoke execute on function public.bb_cloturer_saison(text, int) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke execute on function public.bb_cloturer_saison(text, int) from authenticated;
  end if;
end $$;


-- ─── 6. RETRAIT DU COMPTEUR FALSIFIABLE ─────────────────────────────────────
-- ⚠️ À N'APPLIQUER QU'APRÈS avoir déployé l'application qui a cessé d'écrire
--    `xp_season`. Un privilège retiré sur une colonne fait échouer le PATCH
--    ENTIER : si l'app envoie encore `xp` et `xp_season` ensemble, la retirer
--    trop tôt arrête aussi l'XP, les grades et les cartes.
--
-- ── POURQUOI UN REVOKE DE COLONNE NE SUFFIT PAS ────────────────────────────
--
-- La première version de cette section disait simplement :
--
--     revoke update (xp_season, xp_season_month) on public.bb_pseudos from anon;
--
-- et elle NE FAISAIT RIEN. En Postgres, un privilège de colonne ne restreint
-- rien quand le rôle détient déjà l'UPDATE au niveau de la TABLE : le droit de
-- table couvre toutes les colonnes, présentes et futures, et `revoke update
-- (col)` ne retire qu'une éventuelle attribution colonne par colonne. Or
-- Supabase accorde précisément l'UPDATE de table à `anon` sur tout le schéma
-- public. Le compteur restait donc modifiable par n'importe qui, et le fichier
-- prétendait le contraire.
--
-- Découvert en EXÉCUTANT le fichier, pas en le relisant : `npm run sql:essai`
-- prend le rôle `anon` et essaie vraiment de se poser à 999 999 999.
--
-- La forme qui marche est donc : retirer le droit de table, puis rendre
-- exactement les colonnes que l'app écrit. La liste vient des sept sites
-- d'écriture de LePont.jsx, seul fichier qui écrive cette table — et le banc
-- d'essai vérifie CHACUNE d'elles, parce qu'en oublier une casserait un PATCH
-- entier en production.
--
-- L'INSERT reste au niveau de la table : la création d'un pseudo écrit
-- player_id, pseudo, country et recovery_code d'un coup, et rien de ce qui est
-- inséré ne décide du classement.
--
-- Décommenter APRÈS le déploiement :
--
-- do $$ begin
--   if exists (select 1 from pg_roles where rolname = 'anon') then
--     revoke update on public.bb_pseudos from anon;
--     grant update (pseudo, country, xp, last_notified_grade,
--                   streak_count, streak_last_date, streak_best, streak_freezes,
--                   badge, recovery_code)
--       on public.bb_pseudos to anon;
--   end if;
-- end $$;
--
-- `xp` reste modifiable par le client, en connaissance de cause : il ne décide
-- plus rien au classement, il ne sert qu'aux grades et aux cartes à
-- collectionner. C'est du cosmétique, et le falsifier ne fait gagner aucun lot.


-- ─── 7. CONTRÔLES, À LANCER APRÈS ───────────────────────────────────────────
-- Note d'exploitation : le trigger imposant `created_at = now()`, il est
-- impossible d'insérer de l'historique tant qu'il est actif. Pour une reprise de
-- données, le désactiver le temps du chargement :
--   alter table public.bb_scores disable trigger bb_scores_garde_trg;
--   -- ... chargement ...
--   alter table public.bb_scores enable  trigger bb_scores_garde_trg;
--
-- a) Le classement du mois en cours. C'est lui qui décide, désormais.
--    select * from public.bb_classement_courant() limit 10;
--
-- b) Un mode joué mais absent du barème ? Il rapporte 0 point et bloque la
--    clôture. À corriger avant le 1er du mois.
--    select s.mode, count(*), min(s.score), max(s.score)
--      from public.bb_scores s
--      left join public.bb_modes_bareme b on b.mode = s.mode
--     where b.mode is null group by 1 order by 2 desc;
--
-- c) Les bornes refusent-elles quelque chose de déjà en base ? Si oui, ce sont
--    des scores à regarder — ils étaient hors bornes AVANT la pose du trigger.
--    select s.mode, s.player_name, s.score, s.created_at
--      from public.bb_scores s join public.bb_modes_bareme b on b.mode = s.mode
--     where s.score < b.score_min or s.score > b.score_max
--     order by s.score desc;
--
-- d) AVANT D'EXPÉDIER UN LOT : regarder le gagnant. Un classement crédible n'est
--    pas un classement prouvé, et une revue par mois ne coûte rien.
--    Points, jours joués, modes touchés — un vrai joueur touche plusieurs modes
--    sur plusieurs jours ; un score posé à la main se voit à 1 jour, 1 mode.
--    select * from public.bb_classement_courant() limit 5;
--
--    Et le détail du gagnant, partie par partie :
--    select mode, score, created_at from public.bb_scores
--     where player_id = 'ID_DU_GAGNANT' order by created_at;
