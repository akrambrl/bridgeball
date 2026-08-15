-- ============================================================================
--  RÉCLAMATION DU LOT — à coller dans l'éditeur SQL de Supabase.
--
--  Ce fichier est autonome et rejouable : le relancer deux fois ne casse rien.
--
--  ── CE QU'IL FAIT ─────────────────────────────────────────────────────────
--
--  1. `bb_lots`         : les saisons qui ont VRAIMENT porté un lot. Sans cette
--                         table, dès la deuxième saison tous les anciens
--                         champions verraient un bouton « réclamer » qui ne mène
--                         nulle part.
--  2. `bb_reclamations` : les réclamations reçues. Elle contient des ADRESSES
--                         EMAIL, donc elle n'est lisible par personne d'autre
--                         que le service.
--  3. `bb_reclamer_lot` : la fonction que l'app appelle. C'est ELLE qui vérifie.
--
--  ── POURQUOI LA VÉRIFICATION EST ICI ET NON DANS L'APP ────────────────────
--
--  Le ticket d'origine parlait d'un « HMAC du player_id » calculé côté client.
--  Une signature calculée dans le navigateur suppose une clé DANS LE BUNDLE,
--  donc lisible par quiconque ouvre les outils de développement — et cette clé
--  permettrait de signer le player_id d'un AUTRE joueur pour réclamer son lot.
--  Une serrure dont la clé est collée sur la porte est pire qu'une porte
--  ouverte : elle fait croire que c'est fermé.
--
--  Le seul secret que possède un joueur est son code de récupération. Il n'est
--  vérifiable que là où il est stocké : ici, dans une colonne que le client ne
--  peut pas lire. C'est le même principe que `recover_account`, déjà en place.
--
--  ── LA LEÇON DE LA SAISON 999, APPLIQUÉE ──────────────────────────────────
--
--  Postgres accorde EXECUTE à PUBLIC sur toute fonction dès sa création, et
--  PUBLIC couvre `anon`. Une fonction SECURITY DEFINER est donc appelable par
--  n'importe qui muni de la clé publique — qui est dans le bundle — tant qu'on
--  n'a pas retiré le droit à PUBLIC. C'est ainsi qu'un appel de contrôle avait
--  pu écrire une saison 999 dans le Hall of Fame.
--
--  Toutes les fonctions de ce fichier commencent donc par un
--  `revoke execute … from public`, suivi d'un grant NOMMÉ à qui doit l'appeler.
--
--  Éprouvé par `npm run sql:reclamation`, qui monte un Postgres jetable, prend
--  le rôle `anon` et essaie VRAIMENT ce qui doit échouer.
-- ============================================================================

-- ─── 1. LES LOTS : UNE LIGNE PAR RANG RÉCOMPENSÉ ────────────────────────────
--
-- Un lot par PLACE, et non un lot par saison : le concours de septembre en
-- récompense trois. La clé est donc (saison, rang).
create table if not exists public.bb_lots (
  season_number  int not null,
  rang           int not null,
  intitule       text not null,
  -- Le délai de réclamation annoncé par le règlement : trente jours après
  -- l'annonce. NULL = pas de date limite.
  ouvert_jusqu_a timestamptz,
  created_at     timestamptz not null default now()
);

-- ── REPRISE D'UNE VERSION DÉJÀ APPLIQUÉE ──────────────────────────────────
-- La première version de ce fichier n'avait qu'un lot par saison, avec
-- season_number en clé primaire. Si elle a déjà été passée, la table existe
-- sans colonne `rang` : on l'ajoute, on suppose que le lot déjà inscrit était
-- celui du premier, et on refait la clé. Sans ce bloc, relancer le fichier
-- échouerait sur une table qui ne ressemble plus à sa définition — et c'est
-- précisément le moment où on n'a pas envie de réfléchir.
do $$ begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'bb_lots'
                    and column_name = 'rang') then
    alter table public.bb_lots add column rang int not null default 1;
  end if;
  alter table public.bb_lots drop constraint if exists bb_lots_pkey;
  if not exists (select 1 from pg_constraint where conname = 'bb_lots_saison_rang') then
    alter table public.bb_lots add constraint bb_lots_saison_rang
      primary key (season_number, rang);
  end if;
end $$;

comment on table public.bb_lots is
  'Lots mis en jeu, une ligne par saison ET par rang récompensé. Lisible par '
  'tous (aucun secret) : l''app doit savoir s''il faut proposer la réclamation.';

-- ─── 1 bis. LE MOIS D'UNE SAISON ────────────────────────────────────────────
--
-- Saison 1 = avril 2026, puis un mois calendaire par saison. La table
-- bb_seasons porte une colonne season_month, mais bb_cloturer_saison ne la
-- remplit PAS : s'y fier reviendrait à ne rien savoir du mois là où ça compte.
-- Le numéro, lui, est toujours écrit.
create or replace function public.bb_mois_de_saison(p_numero int)
returns text language sql immutable as $$
  select to_char(date '2026-04-01' + ((p_numero - 1) || ' month')::interval, 'YYYY-MM');
$$;

-- ─── 2. LES RÉCLAMATIONS ────────────────────────────────────────────────────
create table if not exists public.bb_reclamations (
  id            bigserial primary key,
  season_number int  not null,
  -- Le rang au classement final. Enregistré pour que la remise sache QUEL lot
  -- envoyer sans avoir à recalculer, et pour garder trace de ce qui a été promis
  -- au moment de la réclamation.
  rang          int  not null default 1,
  player_id     text not null,
  pseudo        text,
  email         text not null,
  -- Le compte Instagram du gagnant. C'est le SEUL moyen de rapprocher un compte
  -- GOAT FC — anonyme — d'un abonné, d'un commentaire et d'une story. Sans lui,
  -- les conditions de l'article 5.1 du règlement seraient invérifiables, donc
  -- décoratives : annoncées mais jamais appliquées, ce qui est pire que ne pas
  -- les annoncer.
  instagram     text,
  plateforme    text,
  -- Le règlement demande l'autorisation du représentant légal pour les 16-17
  -- ans. On garde la déclaration, pas l'âge : l'app ne connaît pas l'âge.
  autorisation  boolean not null default false,
  statut        text not null default 'recue',
  created_at    timestamptz not null default now()
);

-- Une seule réclamation par saison et par joueur. C'est ce qui rend l'appel
-- IDEMPOTENT : un double clic, un réseau qui repart, une page rechargée — la
-- deuxième tentative répond « déjà reçue » au lieu d'ouvrir un second dossier.
do $$ begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'bb_reclamations'
                    and column_name = 'rang') then
    alter table public.bb_reclamations add column rang int not null default 1;
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'bb_reclamations'
                    and column_name = 'instagram') then
    alter table public.bb_reclamations add column instagram text;
  end if;
end $$;

create unique index if not exists bb_reclamations_saison_joueur
  on public.bb_reclamations (season_number, player_id);

-- ─── 3. PERSONNE NE LIT LES RÉCLAMATIONS ────────────────────────────────────
--
-- Cette table contient des adresses email. Elle est fermée à `anon` ET à
-- `authenticated` : seuls le service (clé de service, côté serveur) et le
-- tableau de bord Supabase y accèdent. La fonction ci-dessous y écrit en
-- SECURITY DEFINER, donc sans avoir besoin d'ouvrir la table à qui que ce soit.
alter table public.bb_reclamations enable row level security;

-- `bb_lots` en revanche est publique en LECTURE : elle ne contient que le numéro
-- de saison, le rang et l'intitulé du lot, trois choses déjà annoncées
-- publiquement.
alter table public.bb_lots enable row level security;
drop policy if exists p_bb_lots_select on public.bb_lots;
create policy p_bb_lots_select on public.bb_lots for select using (true);

-- LES RÔLES SONT TESTÉS AVANT D'ÊTRE VISÉS. Sur Supabase, anon, authenticated
-- et service_role existent toujours ; sur un Postgres nu — celui du banc
-- d'essai, ou une base de reprise — non, et un `revoke ... from authenticated`
-- arrête le fichier au milieu du déploiement. C'est la forme qu'emploie déjà
-- docs/supabase-classement.sql, pour la même raison.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.bb_reclamations from anon';
    execute 'revoke all on public.bb_lots from anon';
    execute 'grant select on public.bb_lots to anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.bb_reclamations from authenticated';
    execute 'revoke all on public.bb_lots from authenticated';
    execute 'grant select on public.bb_lots to authenticated';
  end if;
end $$;

-- ─── 4. LA FONCTION DE RÉCLAMATION ──────────────────────────────────────────
--
-- Elle prend le CODE et rien d'autre pour identifier le compte. Le player_id
-- n'est pas un paramètre, et c'est délibéré : il est public (il figure dans
-- bb_seasons.champion_id, que tout le monde peut lire), donc le demander
-- ouvrirait la porte à une réclamation « au nom de ». Le code, lui, est le seul
-- élément que seul le titulaire possède ; on en DÉDUIT le compte.
--
-- Sur la force du code : 31 caractères non ambigus sur 8 positions, soit
-- 8,5 × 10^11 combinaisons. Une recherche exhaustive en ligne est hors de
-- portée, et il n'y a donc pas de limitation de débit ici — en ajouter une
-- exigerait un état par appelant que le rôle anonyme ne fournit pas.
drop function if exists public.bb_reclamer_lot(text, text, text, boolean);

create or replace function public.bb_reclamer_lot(
  p_code         text,
  p_email        text,
  p_instagram    text default null,
  p_plateforme   text default null,
  p_autorisation boolean default false
) returns table (etat text, detail text)
language plpgsql security definer set search_path = public as $$
declare
  v_player   text;
  v_pseudo   text;
  v_saison   record;
  v_rang     int;
  v_num      int;
  v_limite   timestamptz;
begin
  -- 4.1 — Le code identifie-t-il un compte ?
  --       Comparaison insensible à la casse et aux espaces, comme la saisie :
  --       le code est fait pour être recopié à la main depuis un écran.
  select p.player_id, p.pseudo into v_player, v_pseudo
    from public.bb_pseudos p
   where upper(btrim(p.recovery_code)) = upper(btrim(p_code))
   limit 1;
  if v_player is null then
    return query select 'refus'::text, 'code_inconnu'::text;
    return;
  end if;

  -- 4.2 — L'adresse doit pouvoir recevoir le lot. On écarte seulement ce qui ne
  --       peut manifestement pas aboutir : la seule vraie validation d'une
  --       adresse est qu'un message y arrive.
  --
  --       ON VALIDE LA VERSION NETTOYÉE, et c'est le banc d'essai qui l'a
  --       imposé : la première version validait `p_email` brut puis insérait
  --       `btrim(p_email)`. Une adresse collée depuis un mail ou un carnet
  --       d'adresses arrive presque toujours avec une espace au bout, et le
  --       gagnant se voyait répondre « adresse invalide » sur une adresse
  --       parfaitement valide, sans comprendre pourquoi.
  if p_email is null or btrim(p_email) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-zA-Z]{2,}$' then
    return query select 'refus'::text, 'email'::text;
    return;
  end if;

  -- 4.3 — Le règlement conditionne la remise à l'autorisation du représentant
  --       légal pour les mineurs. La case doit être cochée.
  if not coalesce(p_autorisation, false) then
    return query select 'refus'::text, 'autorisation'::text;
    return;
  end if;

  -- 4.3 bis — Le compte Instagram, sans lequel les conditions de l'article 5.1
  --           (abonnement, deux amis identifiés, partage en story) ne peuvent
  --           pas être vérifiées. On contrôle qu'il y a un pseudo plausible, pas
  --           qu'il existe : Instagram n'expose aucune interface publique
  --           permettant de le savoir, et prétendre le vérifier ici serait un
  --           contrôle de façade. La VRAIE vérification est manuelle, à la
  --           remise — le règlement le dit ainsi.
  if btrim(coalesce(p_instagram, '')) !~ '^@?[A-Za-z0-9._]{1,30}$' then
    return query select 'refus'::text, 'instagram'::text;
    return;
  end if;

  -- 4.4 — CE COMPTE EST-IL SUR UN PODIUM DOTÉ ?
  --
  --       Le rang n'est PAS lu quelque part : il est RECALCULÉ, par
  --       bb_classement_mois, la même fonction qui alimente le classement de
  --       l'app. Deux raisons, et la seconde est la vraie :
  --
  --       1. bb_seasons n'enregistre que le CHAMPION. Le 2e et le 3e n'y
  --          figurent nulle part — il n'y a donc rien à lire.
  --       2. Un classement recalculé se CORRIGE. Si un tricheur est écarté des
  --          scores après la clôture, le podium se réordonne tout seul et le
  --          joueur qui était 4e devient 3e. Un podium figé au moment de la
  --          clôture aurait donné le lot au tricheur, et rien au joueur honnête.
  --
  --       La présence d'une ligne dans bb_seasons reste la CONDITION D'OUVERTURE :
  --       elle prouve que la saison est close. Sans elle, le joueur en tête le
  --       12 septembre pourrait réclamer son lot avant la fin du mois.
  for v_saison in
    select distinct s.season_number as num
      from public.bb_seasons s
      join public.bb_lots l on l.season_number = s.season_number
     order by s.season_number desc
  loop
    select t.rang into v_rang from (
      select c.player_id,
             row_number() over (order by c.points desc, c.jours desc, c.pseudo asc) as rang
        from public.bb_classement_mois(public.bb_mois_de_saison(v_saison.num)) c
    ) t where t.player_id = v_player;

    if v_rang is not null then
      select l.ouvert_jusqu_a into v_limite
        from public.bb_lots l
       where l.season_number = v_saison.num and l.rang = v_rang;
      -- `found` porte sur le SELECT ci-dessus : vrai si un lot existe pour ce
      -- rang. Un rang hors podium ne fait pas sortir de la boucle — le joueur
      -- peut avoir été 12e en septembre et 2e en octobre.
      if found then
        v_num := v_saison.num;
        exit;
      end if;
    end if;
    v_rang := null;
  end loop;

  if v_num is null or v_rang is null then
    return query select 'refus'::text, 'pas_de_lot'::text;
    return;
  end if;

  -- 4.5 — Le délai de réclamation.
  if v_limite is not null and now() > v_limite then
    return query select 'refus'::text, 'delai_depasse'::text;
    return;
  end if;

  -- 4.6 — L'enregistrement. Le conflit sur l'index unique n'est pas une erreur :
  --       c'est la réponse « déjà reçue », et c'est ce qui rend l'appel sûr à
  --       répéter.
  begin
    insert into public.bb_reclamations
      (season_number, rang, player_id, pseudo, email, instagram, plateforme, autorisation)
    values
      (v_num, v_rang, v_player, v_pseudo, btrim(p_email),
       -- Rangé SANS l'arobase, pour que « @toto » et « toto » ne fassent qu'un
       -- seul dossier à vérifier.
       ltrim(btrim(p_instagram), '@'),
       nullif(btrim(coalesce(p_plateforme, '')), ''), true);
  exception when unique_violation then
    return query select 'deja'::text,
      ('GOATFC-LOT-' || v_num || '-' || v_rang || '-' || v_player)::text;
    return;
  end;

  return query select 'ok'::text,
    ('GOATFC-LOT-' || v_num || '-' || v_rang || '-' || v_player)::text;
end $$;

-- ─── 5. LE SUIVI, POUR QUE LE GAGNANT SACHE OÙ IL EN EST ────────────────────
--
-- Rend l'état d'une réclamation SANS jamais rendre l'adresse email : le code
-- pourrait être lu par-dessus l'épaule, l'adresse n'a aucune raison de
-- ressortir. Ce qu'on rend est ce que le joueur sait déjà.
create or replace function public.bb_etat_reclamation(p_code text)
returns table (saison int, rang int, statut text, recue_le timestamptz)
language sql security definer set search_path = public stable as $$
  select r.season_number, r.rang, r.statut, r.created_at
    from public.bb_reclamations r
    join public.bb_pseudos p on p.player_id = r.player_id
   where upper(btrim(p.recovery_code)) = upper(btrim(p_code))
   order by r.season_number desc
   limit 1;
$$;

-- ─── 6. LES DROITS ──────────────────────────────────────────────────────────
--
-- ⚠️ LE RETRAIT SE FAIT SUR `public`, PAS SUR `anon`. Voir l'en-tête : retirer
--    un droit à un rôle qui ne l'a jamais eu nommément ne retire rien, parce que
--    le droit vient de PUBLIC. C'est l'erreur qui a produit la saison 999.
revoke execute on function public.bb_reclamer_lot(text, text, text, text, boolean) from public;
revoke execute on function public.bb_etat_reclamation(text) from public;

-- L'app appelle ces deux fonctions avec la clé publique : le rôle `anon` doit
-- donc les exécuter. C'est volontaire et suffisant — la fonction ne rend rien
-- sans le code, et n'écrit rien sans lui.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'grant execute on function public.bb_reclamer_lot(text, text, text, text, boolean) to anon';
    execute 'grant execute on function public.bb_etat_reclamation(text) to anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.bb_reclamer_lot(text, text, text, text, boolean) to authenticated';
    execute 'grant execute on function public.bb_etat_reclamation(text) to authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant all on public.bb_reclamations to service_role';
    execute 'grant all on public.bb_lots to service_role';
    execute 'grant usage, select on sequence public.bb_reclamations_id_seq to service_role';
  end if;
end $$;

-- ─── 7. LE LOT DE SEPTEMBRE 2026 ────────────────────────────────────────────
--
-- Saison 1 = avril 2026, donc septembre 2026 = SAISON 6.
-- Le délai suit le règlement : trente jours après l'annonce, l'annonce ayant
-- lieu à la clôture du 1er octobre.
insert into public.bb_lots (season_number, rang, intitule, ouvert_jusqu_a) values
  (6, 1, 'EA SPORTS FC 27 — édition Ultimate, dématérialisée, sur la plateforme au choix du gagnant (109,99 €)', '2026-10-31 23:59:59+01'),
  (6, 2, 'Carte cadeau dématérialisée de 50 € — enseigne au choix du gagnant',  '2026-10-31 23:59:59+01'),
  (6, 3, 'Carte cadeau dématérialisée de 30 € — enseigne au choix du gagnant',  '2026-10-31 23:59:59+01')
on conflict (season_number, rang) do update
  set intitule = excluded.intitule,
      ouvert_jusqu_a = excluded.ouvert_jusqu_a;

-- ─── 8. POUR LIRE LES RÉCLAMATIONS REÇUES ───────────────────────────────────
-- Depuis le tableau de bord Supabase (qui n'est pas `anon`) :
--
--   select season_number, rang, pseudo, email, instagram, plateforme, statut, created_at
--     from public.bb_reclamations order by season_number desc, rang;
--
-- Et pour marquer un lot comme remis :
--
--   update public.bb_reclamations set statut = 'remis' where id = 1;
