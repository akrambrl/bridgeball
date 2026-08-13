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
--  réussir honnêtement — 1000 points, une fois. Pour truquer un mois entier il
--  faudrait poser un bon score chaque jour dans chaque mode, ce qui est
--  détectable et, surtout, revient à jouer.
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
  ('mercatoday',  700,    0,  2000, 'Mercato du jour'),
  ('findplayer',  600,    0,  3000, 'Trouve le joueur'),
  ('findstreak',   10,    0,   200, 'Trouve le joueur — série')
on conflict (mode) do update
  set reference = excluded.reference, score_min = excluded.score_min,
      score_max = excluded.score_max, libelle = excluded.libelle;

alter table public.bb_modes_bareme enable row level security;
-- Lisible par l'app (elle peut vouloir afficher le barème), jamais modifiable.
-- Conditionnel : le rôle `anon` existe toujours sur Supabase, mais pas sur un
-- Postgres nu — et ce fichier doit pouvoir être rejoué ailleurs pour être testé,
-- ce qui est exactement comme il a été validé.
drop policy if exists p_bareme_select on public.bb_modes_bareme;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    create policy p_bareme_select on public.bb_modes_bareme for select to anon using (true);
    -- Le GRANT en plus de la politique, et pas seulement la politique : une
    -- politique RLS n'accorde aucun privilège, elle ne fait que filtrer ce que
    -- le privilège autorise déjà. Sur Supabase le grant vient des privilèges par
    -- défaut du schéma public, donc l'oubli ne se voyait pas — mais
    -- `bb_classement_mois` n'est pas en SECURITY DEFINER : elle lit ce barème
    -- SOUS L'IDENTITÉ de l'appelant, donc sans ce droit l'onglet Saison tombe
    -- en erreur au lieu de s'afficher. L'écrire ici rend le fichier autonome.
    grant select on public.bb_modes_bareme to anon;
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
-- LA RÈGLE, en une phrase : pour chaque JOUR et chaque MODE, seul le MEILLEUR
-- score du joueur compte, et il rapporte au plus 1000 points.
--
-- Ce plafond est le cœur de la sécurité, et il n'est pas là par hasard :
--   • un score gonflé ne rapporte pas plus qu'un très bon score honnête ;
--   • rejouer vingt fois le même mode dans la journée ne rapporte rien de plus ;
--   • pour accumuler, il faut jouer plusieurs modes, plusieurs jours — c'est-à-dire
--     exactement le comportement qu'on veut encourager.
--
-- Les jours sont comptés en HEURE DE PARIS, comme le reste de l'app (la devinette
-- du jour, les séries) : en UTC, une partie jouée à 23 h 30 tomberait le lendemain.
--
-- GOAT GRID (bb_gg_scores) est inclus et se normalise tout seul : la table porte
-- `max_score`, donc le pourcentage de grille remplie est la mesure naturelle.
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

-- Raccourci pour l'app : le mois EN COURS, heure de Paris.
create or replace function public.bb_classement_courant()
returns table (player_id text, pseudo text, points bigint, jours bigint, modes bigint)
language sql stable as $$
  select * from public.bb_classement_mois(
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
