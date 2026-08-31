-- ============================================================================
--  GOAT FC — PARRAINAGE : ramène un pote, gagne des points
--  À coller dans Supabase → SQL Editor → Run. Idempotent : relançable.
--
--  ⚠️ NE JAMAIS MODIFIER CE FICHIER SANS LE LANCER : `npm run sql:parrainage`.
--     Il monte un Postgres jetable au schéma de production, rejoue le classement,
--     PREND le rôle anon et essaie vraiment ce qui doit échouer.
--
--  ⚠️ ORDRE DE DÉPLOIEMENT : APRÈS docs/supabase-classement.sql (il en étend la
--     fonction bb_classement_mois). Rejouer le classement APRÈS ce fichier
--     écraserait l'extension : si les deux sont rejoués, ce fichier en dernier.
--
--  ── CE QU'IL FAIT ──────────────────────────────────────────────────────────
--  Chaque joueur a un CODE de parrainage (lien goatfc.fr/?p=CODE). Quand un pote
--  s'inscrit avec ce code, il devient son FILLEUL. Le parrain gagne :
--    • 500 points quand le filleul joue sa PREMIÈRE partie (pas à l'inscription
--      sèche : un compte qui ne joue jamais ne rapporte rien) ;
--    • 50 points par (filleul, jour, mode) joué — même granularité que le
--      classement, donc rejouer vingt fois le même mode dans la journée ne
--      compte qu'une fois. L'anti-farming du classement protège aussi celui-ci.
--  Ces points comptent DANS le classement mensuel (le concours doté) ET, côté
--  app, dans l'XP cosmétique (cartes de collection).
--
--  ── POURQUOI CÔTÉ SERVEUR ──────────────────────────────────────────────────
--  Le classement est recalculé par le serveur depuis les scores (voir
--  supabase-classement.sql) précisément pour qu'aucun client ne puisse s'ajouter
--  de points. Le parrainage doit donc être crédité PAR LE MÊME RECALCUL, pas par
--  un PATCH du client — sinon il rouvrirait la porte que le classement a fermée.
--  D'où : une table que le client NE PEUT PAS écrire directement, une fonction
--  SECURITY DEFINER pour rattacher un filleul, un trigger serveur pour valider à
--  la première partie, et l'extension de bb_classement_mois.
--
--  ── L'HONNÊTETÉ SUR LA LIMITE, COMME AILLEURS ─────────────────────────────
--  Il n'y a toujours pas d'authentification forte pour les comptes NON liés :
--  bb_parrainer ne peut pas prouver que l'appelant EST le filleul qu'il déclare.
--  Le garde-fou est ailleurs et il suffit : premier-écrit-gagne (on ne peut pas
--  voler un filleul déjà rattaché), et surtout AUCUN point tant que le filleul
--  n'a pas joué. Pré-réclamer le player_id d'un inconnu suppose de le connaître
--  AVANT qu'il ne s'inscrive — les player_id sont tirés au sort par le client.
--  Le gain d'un tel abus est nul (le faux filleul ne joue pas), son coût réel.
-- ============================================================================


-- ─── 1. LE CODE DE PARRAINAGE, UN PAR JOUEUR ────────────────────────────────
-- Un code court (6 caractères) plutôt que le player_id : les player_id sont
-- énumérables et n'ont rien à faire dans un lien qu'on colle sur Instagram. Le
-- code exclut les caractères ambigus (0/O, 1/I/L) pour être dictable à voix haute.
create or replace function public.bb_gen_parrain_code()
returns text language plpgsql as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.bb_pseudos where parrain_code = code);
  end loop;
  return code;
end $$;

alter table public.bb_pseudos add column if not exists parrain_code text;

-- Backfill des comptes existants. Fait une fois ; les relances ne retouchent pas
-- les codes déjà posés (where … is null).
update public.bb_pseudos
   set parrain_code = public.bb_gen_parrain_code()
 where parrain_code is null;

-- Unicité du code. Index partiel : la colonne peut rester null le temps qu'un
-- backfill concurrent tourne, sans casser la contrainte.
create unique index if not exists bb_pseudos_parrain_code_idx
  on public.bb_pseudos (parrain_code) where parrain_code is not null;

-- Les nouveaux comptes reçoivent leur code TOUT SEULS : le DEFAULT est évalué
-- côté serveur à l'INSERT, donc il s'applique même si le client — qui n'a le
-- droit d'écrire que certaines colonnes de bb_pseudos — ne mentionne pas
-- parrain_code. C'est ce qui évite d'avoir à toucher le code d'inscription.
alter table public.bb_pseudos alter column parrain_code set default public.bb_gen_parrain_code();


-- ─── 2. LA TABLE DES FILLEULS ───────────────────────────────────────────────
-- Une ligne par filleul : chacun a AU PLUS un parrain, définitif (filleul_id est
-- la clé primaire). valide_at reste null tant que le filleul n'a pas joué.
create table if not exists public.bb_parrainage (
  filleul_id text primary key,
  parrain_id text not null,
  created_at timestamptz not null default now(),
  valide_at  timestamptz,
  constraint bb_parrainage_pas_soi_meme check (parrain_id <> filleul_id)
);

create index if not exists bb_parrainage_parrain_idx
  on public.bb_parrainage (parrain_id);

alter table public.bb_parrainage enable row level security;

-- LECTURE ouverte : l'app affiche « tu as N filleuls » et le graphe n'est pas
-- sensible (pas d'email, pas de code de récupération — juste des player_id, déjà
-- énumérables). ÉCRITURE fermée à tous : seule bb_parrainer (SECURITY DEFINER)
-- insère, seul le trigger valide. Pas de policy insert/update/delete = interdit.
drop policy if exists p_parrainage_select on public.bb_parrainage;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    create policy p_parrainage_select on public.bb_parrainage
      for select to anon using (true);
    grant select on public.bb_parrainage to anon;
  end if;
end $$;


-- ─── 3. RATTACHER UN FILLEUL ────────────────────────────────────────────────
-- Appelée par le client du FILLEUL, à l'inscription : « mon parrain est ce code ».
-- Résout le code (ou un pseudo, pour la saisie manuelle) vers un parrain, puis
-- refuse l'auto-parrainage, le code inconnu, et le filleul déjà rattaché.
--
-- SECURITY DEFINER + revoke public : sinon une fonction est appelable par
-- quiconque a la clé publique (leçon de la saison 999, cf. supabase-reclamation).
create or replace function public.bb_parrainer(p_filleul_id text, p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare v_parrain text;
begin
  if p_filleul_id is null or coalesce(trim(p_code), '') = '' then
    return 'refus:params';
  end if;

  -- Code d'abord (comparaison insensible à la casse), pseudo en repli pour la
  -- saisie manuelle où le pote tape le NOM de son parrain.
  select player_id into v_parrain
    from public.bb_pseudos
   where upper(parrain_code) = upper(trim(p_code))
      or lower(pseudo)       = lower(trim(p_code))
   limit 1;

  if v_parrain is null then return 'refus:code_inconnu'; end if;
  if v_parrain = p_filleul_id then return 'refus:soi_meme'; end if;

  insert into public.bb_parrainage (filleul_id, parrain_id)
  values (p_filleul_id, v_parrain);
  return 'ok';
exception
  -- Filleul déjà rattaché : premier-écrit-gagne, on ne vole pas un parrainage.
  when unique_violation then return 'refus:deja_parraine';
end $$;

revoke execute on function public.bb_parrainer(text, text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.bb_parrainer(text, text) to anon;
  end if;
end $$;


-- ─── 4. LA VALIDATION À LA PREMIÈRE PARTIE ──────────────────────────────────
-- Le parrainage ne rapporte rien tant que le filleul n'a pas joué. Un trigger
-- AFTER INSERT sur bb_scores pose valide_at à la première partie. AFTER et non
-- BEFORE : le garde-fou des scores (bb_scores_garde) est un BEFORE, on ne s'en
-- mêle pas. L'UPDATE ne touche que les filleuls non encore validés (index sur la
-- PK + filtre valide_at is null) : coût nul pour l'immense majorité des scores,
-- qui ne sont pas d'un filleul en attente.
create or replace function public.bb_parrainage_valide()
returns trigger language plpgsql as $$
begin
  update public.bb_parrainage
     set valide_at = now()
   where filleul_id = new.player_id and valide_at is null;
  return null;
end $$;

drop trigger if exists bb_parrainage_valide_trg on public.bb_scores;
create trigger bb_parrainage_valide_trg
  after insert on public.bb_scores
  for each row execute function public.bb_parrainage_valide();


-- ─── 5. LE CLASSEMENT, ÉTENDU AUX POINTS DE PARRAINAGE ──────────────────────
-- On REDÉFINIT bb_classement_mois pour ajouter, au total de chaque parrain :
--   • 500 par filleul VALIDÉ ce mois-ci (le mois de sa première partie) ;
--   • 50 par (filleul, jour, mode) joué ce mois-ci — mêmes seaux jour/mode que
--     le classement lui-même, donc naturellement plafonné.
-- La partie « journalier » est identique à supabase-classement.sql : le
-- parrainage se GREFFE dessus, il ne le remplace pas.
create or replace function public.bb_classement_mois(p_mois text)
returns table (
  player_id text,
  pseudo    text,
  points    bigint,
  jours     bigint,
  modes     bigint
) language sql stable as $$
  with journalier as (
    select s.player_id,
           (s.created_at at time zone 'Europe/Paris')::date as jour,
           s.mode,
           public.bb_points_normalises(s.mode, max(s.score)::numeric) as pts
      from public.bb_scores s
     where to_char(s.created_at at time zone 'Europe/Paris', 'YYYY-MM') = p_mois
     group by 1, 2, 3
    union all
    select g.player_id,
           (g.created_at at time zone 'Europe/Paris')::date as jour,
           'goatgrid' as mode,
           least(1000, greatest(0, round(1000.0 * max(g.score)
                 / nullif(max(g.max_score), 0))))::int as pts
      from public.bb_gg_scores g
     where to_char(g.created_at at time zone 'Europe/Paris', 'YYYY-MM') = p_mois
     group by 1, 2
  ),
  -- Le classement « joué » : points, jours et modes du joueur lui-même.
  base as (
    select j.player_id,
           sum(j.pts)::bigint              as points,
           count(distinct j.jour)::bigint  as jours,
           count(distinct j.mode)::bigint  as modes
      from journalier j
     where j.pts > 0
     group by 1
  ),
  -- 50 par seau (filleul, jour, mode) joué ce mois, crédité au parrain. On passe
  -- par les mêmes seaux « journalier » : rejouer le même mode dans la journée ne
  -- gonfle rien, et le filleul doit être validé (donc avoir déjà joué).
  parr_parties as (
    select pa.parrain_id as player_id,
           (50 * count(*))::bigint as points
      from journalier j
      join public.bb_parrainage pa
        on pa.filleul_id = j.player_id and pa.valide_at is not null
     where j.pts > 0
     group by 1
  ),
  -- 500 par filleul dont la PREMIÈRE partie tombe ce mois-ci.
  parr_inscr as (
    select pa.parrain_id as player_id,
           (500 * count(*))::bigint as points
      from public.bb_parrainage pa
     where pa.valide_at is not null
       and to_char(pa.valide_at at time zone 'Europe/Paris', 'YYYY-MM') = p_mois
     group by 1
  ),
  -- On empile tout ; jours/modes ne viennent que du jeu réel (les lignes de
  -- parrainage portent 0), donc un parrain qui ne joue pas apparaît avec 0 jour.
  tous as (
    select player_id, points, jours, modes from base
    union all select player_id, points, 0::bigint, 0::bigint from parr_parties
    union all select player_id, points, 0::bigint, 0::bigint from parr_inscr
  )
  select t.player_id,
         coalesce(p.pseudo, '?') as pseudo,
         sum(t.points)::bigint   as points,
         max(t.jours)::bigint     as jours,
         max(t.modes)::bigint     as modes
    from tous t
    left join public.bb_pseudos p on p.player_id = t.player_id
   group by 1, 2
  having sum(t.points) > 0
   order by points desc, jours desc, pseudo asc
$$;


-- ─── 6. LE RÉSUMÉ POUR L'ÉCRAN PARRAINAGE ───────────────────────────────────
-- Ce que l'app affiche : le code du joueur, son nombre de filleuls (total et
-- validés), et les points de parrainage GAGNÉS ce mois-ci — la même formule que
-- la section 5, isolée, pour montrer au parrain ce que ses filleuls lui rapportent.
create or replace function public.bb_parrainage_resume(p_player_id text)
returns table (
  code            text,
  filleuls        bigint,
  filleuls_valides bigint,
  points_mois     bigint
) language sql stable security definer set search_path = public as $$
  with mois as (select to_char(now() at time zone 'Europe/Paris', 'YYYY-MM') as m),
  journalier as (
    select s.player_id,
           (s.created_at at time zone 'Europe/Paris')::date as jour,
           s.mode
      from public.bb_scores s, mois
     where to_char(s.created_at at time zone 'Europe/Paris', 'YYYY-MM') = mois.m
     group by 1, 2, 3
    union all
    select g.player_id,
           (g.created_at at time zone 'Europe/Paris')::date as jour,
           'goatgrid'
      from public.bb_gg_scores g, mois
     where to_char(g.created_at at time zone 'Europe/Paris', 'YYYY-MM') = mois.m
     group by 1, 2
  )
  select
    (select parrain_code from public.bb_pseudos where player_id = p_player_id),
    (select count(*) from public.bb_parrainage where parrain_id = p_player_id),
    (select count(*) from public.bb_parrainage
       where parrain_id = p_player_id and valide_at is not null),
    (
      coalesce((select 50 * count(*) from journalier j
                  join public.bb_parrainage pa
                    on pa.filleul_id = j.player_id and pa.valide_at is not null
                 where pa.parrain_id = p_player_id), 0)
      +
      coalesce((select 500 * count(*) from public.bb_parrainage pa, mois
                 where pa.parrain_id = p_player_id and pa.valide_at is not null
                   and to_char(pa.valide_at at time zone 'Europe/Paris', 'YYYY-MM') = mois.m), 0)
    )::bigint
$$;

revoke execute on function public.bb_parrainage_resume(text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.bb_parrainage_resume(text) to anon;
  end if;
end $$;
