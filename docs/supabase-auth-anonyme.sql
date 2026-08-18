-- ============================================================================
--  AUTHENTIFICATION ANONYME : FERMER L'USURPATION, OUVRIR LE BANNISSEMENT
--  ---------------------------------------------------------------------------
--  À jouer une fois dans l'éditeur SQL de Supabase. Idempotent : rejouable.
--
--  ⚠️ CE FICHIER NE CHANGE RIEN D'OBSERVABLE À LUI SEUL. Il élargit des droits,
--     ajoute une colonne et pose un déclencheur qui ne fait RIEN tant qu'aucun
--     compte n'est lié. Le comportement ne change qu'avec le client qui
--     s'authentifie — donc il peut être joué avant, après, ou entre les deux.
--
--  ── LE DÉFAUT, MESURÉ ─────────────────────────────────────────────────────
--
--  L'app n'a aucune authentification : `player_id` est une chaîne tirée au sort
--  côté client et rangée dans localStorage, et la clé publique est dans le
--  paquet, donc lisible par quiconque décompresse l'app.
--
--  Vérifié en production plutôt que supposé, avec cette seule clé publique :
--
--    • les player_id sont ÉNUMÉRABLES — `bb_pseudos?select=player_id` répond 200,
--      et `bb_scores` les expose aussi. 337 pseudos lisibles ;
--    • toutes les politiques d'écriture sont en `with check (true)`, donc
--      n'importe qui peut insérer un score sous l'identité de n'importe qui ;
--    • `bb_pseudos` est modifiable en `using (true)` : on peut réécrire l'XP ou
--      le pseudo d'un autre joueur, ce qui est pire qu'un faux score ;
--    • en revanche `recovery_code` est bien protégé — 401 même sur un filtre.
--      Cette porte-là est fermée, et c'est ce qui rend le reste réparable.
--
--  Avec un concours doté, c'est le genre de chose qui se produit.
--
--  ── LE CHOIX : UNE APPLICATION PROGRESSIVE, SANS DATE À CHOISIR ────────────
--
--  La solution évidente — exiger un compte authentifié pour toute écriture —
--  casserait tous les clients pas encore mis à jour, y compris le build 12 qui
--  est en vérification chez Apple au moment où ces lignes sont écrites.
--
--  Le déclencheur ci-dessous dit autre chose :
--
--      si ce player_id est DÉJÀ LIÉ à un compte, seul ce compte écrit pour lui.
--      s'il n'est pas encore lié, on laisse passer comme aujourd'hui.
--
--  Conséquences, et c'est tout l'intérêt :
--
--    • un joueur qui met à jour est protégé IMMÉDIATEMENT ;
--    • un joueur sur une vieille version continue de jouer, exactement comme
--      avant — aucune régression, personne de bloqué ;
--    • la protection s'étend d'elle-même à mesure que les gens mettent à jour,
--      sans qu'il y ait un interrupteur à basculer ni une date à trancher ;
--    • les joueurs de tête, ceux qui ont un lot en jeu, sont les premiers à
--      mettre à jour.
--
--  Ce que ça ne fait pas : protéger un compte pas encore lié. C'est le prix de
--  l'absence de régression, et c'est un choix, pas un oubli.
--
--  ── LE PIÈGE QUI AURAIT TOUT CASSÉ ────────────────────────────────────────
--
--  Dès que le client envoie un jeton, PostgREST n'utilise plus le rôle `anon`
--  mais `authenticated`. Or les 29 politiques du dépôt sont écrites `to anon`,
--  et les droits de `bb_pseudos` sont accordés colonne par colonne AU RÔLE anon.
--  Sans la section 1, l'app authentifiée perdrait l'accès à tout, en silence.
--
--  On ÉTEND à `anon, authenticated` au lieu de basculer : les deux rôles
--  fonctionnent, donc aucune version du client ne casse, dans aucun sens.
--
--  ── L'ÉTAPE QUI N'EST PAS DANS CE FICHIER ─────────────────────────────────
--
--  La connexion anonyme est un INTERRUPTEUR du tableau de bord, éteint par
--  défaut. Relevé sur le projet au moment d'écrire ces lignes :
--
--      GET /auth/v1/settings  →  "anonymous_users": false
--
--  Tant qu'il est éteint, le client retombe sur la clé publique et RIEN ne
--  change — c'est ce qui rend le déploiement du code sans risque. Pour activer :
--
--      Authentication → Sign In / Providers → Anonymous Sign-Ins → activer
--
--  L'ordre conseillé est : ce fichier d'abord, l'interrupteur ensuite. L'inverse
--  fonctionne aussi — le client éprouve son jeton par une requête de contrôle et
--  se replie si le serveur le refuse — mais autant ne pas compter dessus.
--
--  ⚠️ Un compte anonyme est un compte : la table auth.users grossira d'une ligne
--     par appareil. Supabase les compte dans les utilisateurs actifs mensuels du
--     palier gratuit (50 000), ce qui laisse une marge confortable, mais c'est à
--     savoir avant de regarder la facture.
-- ============================================================================


-- ─── 1. ÉTENDRE POLITIQUES ET DROITS AU RÔLE authenticated ──────────────────
--
-- Fait en boucle plutôt qu'à la main : 29 politiques recopiées une à une, c'est
-- 29 occasions d'en oublier une, et l'oubli est SILENCIEUX — la table concernée
-- cesse simplement de répondre pour les clients authentifiés.
--
-- `pg_policies.roles` est un tableau de noms de rôles. On ne touche qu'aux
-- politiques qui ciblent anon sans déjà cibler authenticated.
do $$
declare p record; n int := 0;
begin
  for p in
    select schemaname, tablename, policyname, roles
      from pg_policies
     where schemaname = 'public'
       and 'anon' = any(roles)
       and not ('authenticated' = any(roles))
  loop
    execute format('alter policy %I on %I.%I to anon, authenticated',
                   p.policyname, p.schemaname, p.tablename);
    n := n + 1;
  end loop;
  raise notice 'politiques étendues à authenticated : %', n;
end $$;

-- Les DROITS de table et de COLONNE, que les politiques ne remplacent pas : une
-- politique RLS filtre ce qu'un privilège autorise déjà, elle n'accorde rien.
-- C'est exactement le piège relevé dans supabase-rls.sql à propos de xp_season.
--
-- On recopie sur `authenticated` ce que `anon` détient, colonne par colonne,
-- en lisant information_schema plutôt qu'en réécrivant la liste à la main — la
-- liste des colonnes de bb_pseudos a déjà changé plusieurs fois.
do $$
declare g record; n int := 0;
begin
  for g in
    select table_name, column_name, privilege_type
      from information_schema.column_privileges
     where table_schema = 'public' and grantee = 'anon'
  loop
    execute format('grant %s (%I) on public.%I to authenticated',
                   g.privilege_type, g.column_name, g.table_name);
    n := n + 1;
  end loop;
  raise notice 'droits de colonne recopiés : %', n;
end $$;

do $$
declare g record; n int := 0;
begin
  for g in
    select table_name, privilege_type
      from information_schema.role_table_grants
     where table_schema = 'public' and grantee = 'anon'
  loop
    execute format('grant %s on public.%I to authenticated', g.privilege_type, g.table_name);
    n := n + 1;
  end loop;
  raise notice 'droits de table recopiés : %', n;
end $$;

-- LES SÉQUENCES, et ce n'est pas un détail : toute insertion dans une table à
-- clé `bigserial` a besoin de USAGE sur sa séquence, sinon elle échoue en
-- « permission denied for sequence ». Comme sbFetch avale les échecs, l'app
-- cesserait simplement d'enregistrer les scores, sans un mot.
--
-- Trouvé par le banc (npm run sql:auth), pas par relecture : les droits de table
-- et de colonne étaient recopiés, ceux des séquences non, et rien dans le SQL ne
-- le signalait. Supabase accorde probablement déjà ces droits aux deux rôles —
-- mais « probablement » n'est pas une base pour une migration.
do $$
declare g record; n int := 0;
begin
  for g in
    select sequence_name, privilege_type
      from information_schema.usage_privileges u
      join information_schema.sequences q
        on q.sequence_schema = u.object_schema and q.sequence_name = u.object_name
     where u.object_schema = 'public' and u.grantee = 'anon'
  loop
    execute format('grant %s on sequence public.%I to authenticated',
                   g.privilege_type, g.sequence_name);
    n := n + 1;
  end loop;
  -- USAGE ne suffit pas partout : PostgREST lit parfois la valeur courante, d'où
  -- SELECT en plus. On l'accorde sur tout le schéma, c'est sans risque : une
  -- séquence ne contient aucune donnée de joueur.
  execute 'grant usage, select on all sequences in schema public to authenticated';
  raise notice 'droits de séquence recopiés : % (+ usage,select sur tout le schéma)', n;
end $$;

-- Les fonctions appelées par l'app. `recover_account` et `delete_user_account`
-- sont en SECURITY DEFINER : sans EXECUTE, la récupération de compte et la
-- suppression de compte cesseraient de fonctionner pour un client authentifié —
-- deux fonctions que l'App Store vérifie explicitement.
do $$
declare f record; n int := 0;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public'
       and has_function_privilege('anon', p.oid, 'EXECUTE')
  loop
    execute format('grant execute on function %s to authenticated', f.sig);
    n := n + 1;
  end loop;
  raise notice 'fonctions rendues exécutables à authenticated : %', n;
end $$;


-- ─── 2. LE LIEN ENTRE UN COMPTE ET UN PSEUDO ────────────────────────────────
-- Nullable, et ça n'est pas un oubli : `null` signifie « pas encore lié », et
-- c'est cet état qui laisse jouer les anciennes versions. Le jour où toutes les
-- lignes sont renseignées, l'usurpation est fermée partout — sans rien changer.
alter table public.bb_pseudos
  add column if not exists auth_uid uuid;

comment on column public.bb_pseudos.auth_uid is
  'Compte anonyme Supabase propriétaire de ce pseudo. NULL = pas encore lié, '
  'donc écriture laissée libre pour compatibilité avec les anciennes versions.';

-- Pas de contrainte UNIQUE, et c'est délibéré : un même appareil peut
-- légitimement récupérer un second compte avec son code de récupération, et une
-- contrainte d'unicité ferait échouer cette récupération sans message utile.
create index if not exists bb_pseudos_auth_uid_idx
  on public.bb_pseudos (auth_uid) where auth_uid is not null;


-- ─── 3. LES BANNISSEMENTS ───────────────────────────────────────────────────
-- Par compte ET par pseudo : le compte suffit pour l'avenir, mais un tricheur
-- qui reviendrait avec un nouveau compte anonyme sur le même pseudo doit rester
-- dehors. Les deux colonnes sont nullables, on renseigne celle qu'on connaît.
create table if not exists public.bb_bannis (
  id         bigserial primary key,
  player_id  text,
  auth_uid   uuid,
  motif      text not null,
  cree_le    timestamptz not null default now(),
  constraint bb_bannis_cible check (player_id is not null or auth_uid is not null)
);

create index if not exists bb_bannis_player_idx on public.bb_bannis (player_id) where player_id is not null;
create index if not exists bb_bannis_uid_idx    on public.bb_bannis (auth_uid)  where auth_uid  is not null;

-- AUCUNE politique : RLS activée sans policy = table invisible et intouchable
-- depuis l'app, dans les deux rôles. Elle ne se lit et ne s'écrit qu'avec la clé
-- de service, depuis le tableau de bord. Même procédé que pour bb_seasons.
alter table public.bb_bannis enable row level security;
revoke all on public.bb_bannis from anon, authenticated;

-- Bannir depuis l'éditeur SQL, sans avoir à se souvenir de la forme de la table :
--   select public.bb_bannir('3DYA9A', 'scores forgés le 12 septembre');
create or replace function public.bb_bannir(p_player_id text, p_motif text)
returns text language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  select auth_uid into u from public.bb_pseudos where player_id = p_player_id;
  insert into public.bb_bannis (player_id, auth_uid, motif)
  values (p_player_id, u, p_motif);
  return 'banni : ' || p_player_id || coalesce(' (compte ' || u::text || ')', ' (aucun compte lié)');
end $$;
revoke all on function public.bb_bannir(text, text) from public, anon, authenticated;


-- ─── 4. LIER SON PSEUDO À SON COMPTE ────────────────────────────────────────
--
-- Appelée par l'app après signInAnonymously(). Le code de récupération sert de
-- PREUVE de propriété, et c'est la clé de tout : les player_id étant publiquement
-- énumérables, une revendication « premier arrivé, premier servi » permettrait de
-- voler le compte de n'importe quel joueur pas encore mis à jour. Le code, lui,
-- n'est pas lisible avec la clé publique — vérifié, 401 même sur un filtre.
--
-- SECURITY DEFINER parce qu'elle doit comparer recovery_code, que le rôle de
-- l'appelant n'a pas le droit de lire. C'est la même raison que recover_account.
create or replace function public.lier_compte(p_player_id text, p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare l record; moi uuid := auth.uid();
begin
  if moi is null then return 'non_authentifie'; end if;

  select player_id, recovery_code, auth_uid into l
    from public.bb_pseudos where player_id = p_player_id;
  if not found then return 'inconnu'; end if;

  if exists (select 1 from public.bb_bannis
              where (player_id = p_player_id) or (auth_uid = moi)) then
    return 'banni';
  end if;

  if l.auth_uid is not null then
    -- Déjà lié : idempotent pour le propriétaire, refusé pour les autres. C'est
    -- ce refus qui rend le lien définitif, et donc la protection durable.
    if l.auth_uid = moi then return 'deja_lie'; end if;
    return 'appartient_a_un_autre';
  end if;

  -- Une ligne SANS code de récupération ne peut pas exiger de preuve. Elle est
  -- donc liable sans code — c'est le cas des comptes créés avant l'arrivée des
  -- codes, et ne pas les lier les laisserait vulnérables pour toujours.
  if l.recovery_code is not null then
    if p_code is null or upper(btrim(p_code)) <> upper(btrim(l.recovery_code)) then
      return 'code_invalide';
    end if;
  end if;

  update public.bb_pseudos set auth_uid = moi where player_id = p_player_id;
  return 'lie';
end $$;
revoke all on function public.lier_compte(text, text) from public;
grant execute on function public.lier_compte(text, text) to anon, authenticated;


-- ─── 5. LE GARDE-FOU, PROGRESSIF ────────────────────────────────────────────
--
-- Un déclencheur et non une politique RLS, pour une raison précise : une
-- politique ne peut pas lire `bb_pseudos.auth_uid` sans que l'appelant ait le
-- droit de lire cette colonne, et le déclencheur en SECURITY DEFINER peut. Même
-- choix que le garde-fou des bornes de score, pour la même raison.
create or replace function public.bb_garde_identite()
returns trigger language plpgsql security definer set search_path = public as $$
declare cible text; proprietaire uuid; moi uuid := auth.uid();
begin
  -- Sur un UPDATE de bb_pseudos, la cible est la LIGNE EXISTANTE : regarder
  -- new.player_id laisserait renommer la clé pour contourner le contrôle.
  cible := case when tg_table_name = 'bb_pseudos' and tg_op = 'UPDATE'
                then old.player_id else new.player_id end;

  if exists (select 1 from public.bb_bannis
              where (player_id = cible) or (moi is not null and auth_uid = moi)) then
    raise exception 'compte banni';
  end if;

  select auth_uid into proprietaire from public.bb_pseudos where player_id = cible;

  -- Pas encore lié — ou pseudo inconnu : on laisse passer, comme aujourd'hui.
  if proprietaire is null then return new; end if;

  if moi is null or moi <> proprietaire then
    raise exception 'ce pseudo appartient à un autre compte';
  end if;
  return new;
end $$;

-- bb_scores et bb_gg_scores : les deux tables qui décident du classement, donc
-- du lot. bb_pseudos en UPDATE : réécrire l'XP ou voler le pseudo d'un autre est
-- plus grave qu'un faux score, et c'était possible en `using (true)`.
--
-- Nommés `zz_` pour passer APRÈS le garde-fou des bornes, que Postgres déclenche
-- par ordre alphabétique : autant refuser un score hors bornes avant de se
-- demander à qui il appartient.
drop trigger if exists zz_garde_identite on public.bb_scores;
create trigger zz_garde_identite before insert on public.bb_scores
  for each row execute function public.bb_garde_identite();

drop trigger if exists zz_garde_identite on public.bb_gg_scores;
create trigger zz_garde_identite before insert on public.bb_gg_scores
  for each row execute function public.bb_garde_identite();

drop trigger if exists zz_garde_identite on public.bb_pseudos;
create trigger zz_garde_identite before update on public.bb_pseudos
  for each row execute function public.bb_garde_identite();


-- ─── CONTRÔLES, À LANCER APRÈS ──────────────────────────────────────────────
--
-- a) Aucune politique ne doit être restée sur le seul rôle anon :
--
--      select tablename, policyname, roles from pg_policies
--       where schemaname='public' and 'anon'=any(roles)
--         and not ('authenticated'=any(roles));
--
--    Attendu : zéro ligne.
--
-- b) La colonne recovery_code reste MASQUÉE aux deux rôles — la section 1 a
--    recopié les droits colonne par colonne, elle ne doit pas l'avoir rendue :
--
--      select grantee, string_agg(column_name, ', ') from information_schema.column_privileges
--       where table_schema='public' and table_name='bb_pseudos' and privilege_type='SELECT'
--         and grantee in ('anon','authenticated') group by grantee;
--
--    Attendu : la même liste pour les deux, et recovery_code ABSENT des deux.
--
-- c) Le déclencheur ne fait rien tant que rien n'est lié :
--
--      select count(*) from public.bb_pseudos where auth_uid is not null;
--
--    Attendu : 0 avant le déploiement du client.
--
-- d) L'avancement de la protection, à regarder de temps en temps après :
--
--      select count(*) filter (where auth_uid is not null) as lies,
--             count(*) as total,
--             round(100.0 * count(*) filter (where auth_uid is not null) / count(*)) as pct
--        from public.bb_pseudos;
