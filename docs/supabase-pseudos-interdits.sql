-- ============================================================================
--  GOAT FC — Pseudos interdits, verrou côté BASE
--
--  ⚠️ FICHIER GÉNÉRÉ. Ne pas modifier à la main :
--         node scripts/pseudos-sql.mjs
--     La source est src/lib/pseudo.ts, qui sert aussi au contrôle côté client.
--
--  À coller dans Supabase → SQL Editor → Run. Idempotent : relançable.
--
--  ── POURQUOI CE FICHIER EXISTE ─────────────────────────────────────────────
--  Le contrôle JavaScript arrête les joueurs, pas un attaquant : la clé `anon`
--  est publique — elle est dans le bundle — donc n'importe qui peut faire un
--  POST direct sur bb_pseudos et se poser le pseudo qu'il veut. Sans ce
--  trigger, la modération des pseudos est une politesse, pas une garantie.
--
--  ── CE QU'IL FAIT ──────────────────────────────────────────────────────────
--  1. une table des termes, 190 lignes, rejouant la liste du client ;
--  2. la MÊME normalisation qu'en JS (accents, chiffres relus comme des
--     lettres, séparateurs retirés, lettres étirées détirées, double lecture
--     du « 1 ») ;
--  3. un trigger BEFORE INSERT OR UPDATE sur bb_pseudos qui REFUSE l'écriture.
--
--  ── AJOUTER UN TERME PLUS TARD ─────────────────────────────────────────────
--  Sans redéployer l'app, en base :
--      insert into public.bb_termes_interdits values ('nouveauterme','partiel','haine');
--  Mais pense à l'ajouter AUSSI dans src/lib/pseudo.ts, sinon le joueur n'a
--  plus de message immédiat et se prend une erreur réseau opaque.
-- ============================================================================

-- ─── 1. La liste ────────────────────────────────────────────────────────────
create table if not exists public.bb_termes_interdits (
  terme  text primary key,
  -- 'partiel'   : refusé n'importe où dans le pseudo (mots longs, sans double sens)
  -- 'exact'     : refusé seulement si le pseudo entier ne dit que ça (sigles,
  --               mots courts, tout ce qu'un mot banal contient — « ss » est
  --               dans « boss », « cunt » dans « Scunthorpe »)
  -- 'exception' : mot légitime CONSOMMÉ avant comparaison (« Nazionale »)
  niveau text not null check (niveau in ('partiel','exact','exception')),
  motif  text not null check (motif in ('haine','insulte','usurpation'))
);

-- La liste n'a pas à être lisible publiquement : la donner en clair, c'est
-- offrir la carte des trous. Elle est de toute façon dans le bundle JS, mais
-- inutile d'en faire une seconde copie servie par l'API.
alter table public.bb_termes_interdits enable row level security;
-- Le revoke est conditionnel : le rôle `anon` existe toujours sur Supabase, mais
-- pas sur un Postgres nu — et le fichier doit pouvoir se rejouer ailleurs sans
-- s'arrêter sur cette ligne (c'est comme ça qu'il a été testé).
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.bb_termes_interdits from anon;
  end if;
end $$;

-- Remise à plat : le fichier est régénéré, la table doit suivre exactement.
truncate public.bb_termes_interdits;
insert into public.bb_termes_interdits (terme, niveau, motif) values
  ('hitler', 'partiel', 'haine'),
  ('siegheil', 'partiel', 'haine'),
  ('sieghail', 'partiel', 'haine'),
  ('nazi', 'partiel', 'haine'),
  ('fuhrer', 'partiel', 'haine'),
  ('fuehrer', 'partiel', 'haine'),
  ('gestapo', 'partiel', 'haine'),
  ('waffenss', 'partiel', 'haine'),
  ('goebbels', 'partiel', 'haine'),
  ('himmler', 'partiel', 'haine'),
  ('mengele', 'partiel', 'haine'),
  ('eichmann', 'partiel', 'haine'),
  ('auschwitz', 'partiel', 'haine'),
  ('birkenau', 'partiel', 'haine'),
  ('treblinka', 'partiel', 'haine'),
  ('sobibor', 'partiel', 'haine'),
  ('buchenwald', 'partiel', 'haine'),
  ('holocaust', 'partiel', 'haine'),
  ('swastika', 'partiel', 'haine'),
  ('hakenkreuz', 'partiel', 'haine'),
  ('troisiemereich', 'partiel', 'haine'),
  ('thirdreich', 'partiel', 'haine'),
  ('drittesreich', 'partiel', 'haine'),
  ('sturmabteilung', 'partiel', 'haine'),
  ('blutundehre', 'partiel', 'haine'),
  ('bloodandhonour', 'partiel', 'haine'),
  ('kuklux', 'partiel', 'haine'),
  ('whitepower', 'partiel', 'haine'),
  ('whitepride', 'partiel', 'haine'),
  ('whitesupremac', 'partiel', 'haine'),
  ('suprematieblanche', 'partiel', 'haine'),
  ('aryanbrotherhood', 'partiel', 'haine'),
  ('aryannation', 'partiel', 'haine'),
  ('racewar', 'partiel', 'haine'),
  ('mussolini', 'partiel', 'haine'),
  ('stalin', 'partiel', 'haine'),
  ('polpot', 'partiel', 'haine'),
  ('binladen', 'partiel', 'haine'),
  ('daesh', 'partiel', 'haine'),
  ('daech', 'partiel', 'haine'),
  ('alqaeda', 'partiel', 'haine'),
  ('bokoharam', 'partiel', 'haine'),
  ('breivik', 'partiel', 'haine'),
  ('milosevic', 'partiel', 'haine'),
  ('genocide', 'partiel', 'haine'),
  ('killall', 'partiel', 'haine'),
  ('tuezles', 'partiel', 'haine'),
  ('mortaux', 'partiel', 'haine'),
  ('deathto', 'partiel', 'haine'),
  ('gasthe', 'partiel', 'haine'),
  ('gazez', 'partiel', 'haine'),
  ('negro', 'partiel', 'haine'),
  ('negre', 'partiel', 'haine'),
  ('nigger', 'partiel', 'haine'),
  ('nigga', 'partiel', 'haine'),
  ('bougnoul', 'partiel', 'haine'),
  ('youpin', 'partiel', 'haine'),
  ('chinetoque', 'partiel', 'haine'),
  ('wetback', 'partiel', 'haine'),
  ('salearabe', 'partiel', 'haine'),
  ('salejuif', 'partiel', 'haine'),
  ('salenoir', 'partiel', 'haine'),
  ('saleblanc', 'partiel', 'haine'),
  ('salebeur', 'partiel', 'haine'),
  ('tarlouze', 'partiel', 'haine'),
  ('tapette', 'partiel', 'haine'),
  ('fagot', 'partiel', 'haine'),
  ('faggot', 'partiel', 'haine'),
  ('tranny', 'partiel', 'haine'),
  ('travelo', 'partiel', 'haine'),
  ('battyman', 'partiel', 'haine'),
  ('mongolien', 'partiel', 'haine'),
  ('mongoloid', 'partiel', 'haine'),
  ('trisomique', 'partiel', 'haine'),
  ('retarded', 'partiel', 'haine'),
  ('encule', 'partiel', 'insulte'),
  ('salope', 'partiel', 'insulte'),
  ('salopard', 'partiel', 'insulte'),
  ('putain', 'partiel', 'insulte'),
  ('putassier', 'partiel', 'insulte'),
  ('niquetamer', 'partiel', 'insulte'),
  ('filsdepute', 'partiel', 'insulte'),
  ('fuckyou', 'partiel', 'insulte'),
  ('motherfucker', 'partiel', 'insulte'),
  ('cocksucker', 'partiel', 'insulte'),
  ('blowjob', 'partiel', 'insulte'),
  ('cumshot', 'partiel', 'insulte'),
  ('dickhead', 'partiel', 'insulte'),
  ('asshole', 'partiel', 'insulte'),
  ('ashole', 'partiel', 'insulte'),
  ('bullshit', 'partiel', 'insulte'),
  ('connard', 'partiel', 'insulte'),
  ('connasse', 'partiel', 'insulte'),
  ('batard', 'partiel', 'insulte'),
  ('bastard', 'partiel', 'insulte'),
  ('shithead', 'partiel', 'insulte'),
  ('sucemoi', 'partiel', 'insulte'),
  ('lechemoi', 'partiel', 'insulte'),
  ('branleur', 'partiel', 'insulte'),
  ('branlette', 'partiel', 'insulte'),
  ('zboub', 'partiel', 'insulte'),
  ('couille', 'partiel', 'insulte'),
  ('sperme', 'partiel', 'insulte'),
  ('masturb', 'partiel', 'insulte'),
  ('pornhub', 'partiel', 'insulte'),
  ('xvideos', 'partiel', 'insulte'),
  ('onlyfans', 'partiel', 'insulte'),
  ('pedophile', 'partiel', 'insulte'),
  ('pedobear', 'partiel', 'insulte'),
  ('violeur', 'partiel', 'insulte'),
  ('rapist', 'partiel', 'insulte'),
  ('zoophile', 'partiel', 'insulte'),
  ('inceste', 'partiel', 'insulte'),
  ('suicide', 'partiel', 'insulte'),
  ('pendstoi', 'partiel', 'insulte'),
  ('killyourself', 'partiel', 'insulte'),
  ('goatfcofficiel', 'partiel', 'usurpation'),
  ('goatfcofficial', 'partiel', 'usurpation'),
  ('goatfcadmin', 'partiel', 'usurpation'),
  ('goatfcsupport', 'partiel', 'usurpation'),
  ('goatfcteam', 'partiel', 'usurpation'),
  ('equipegoatfc', 'partiel', 'usurpation'),
  ('administrateur', 'partiel', 'usurpation'),
  ('administrator', 'partiel', 'usurpation'),
  ('moderateur', 'partiel', 'usurpation'),
  ('moderator', 'partiel', 'usurpation'),
  ('ss', 'exact', 'haine'),
  ('hh', 'exact', 'haine'),
  ('kkk', 'exact', 'haine'),
  ('nsdap', 'exact', 'haine'),
  ('zog', 'exact', 'haine'),
  ('raciste', 'exact', 'haine'),
  ('racist', 'exact', 'haine'),
  ('coon', 'exact', 'haine'),
  ('spic', 'exact', 'haine'),
  ('chink', 'exact', 'haine'),
  ('gook', 'exact', 'haine'),
  ('paki', 'exact', 'haine'),
  ('kike', 'exact', 'haine'),
  ('raton', 'exact', 'haine'),
  ('1488', 'exact', 'haine'),
  ('8814', 'exact', 'haine'),
  ('hh88', 'exact', 'haine'),
  ('heil', 'exact', 'haine'),
  ('sieg', 'exact', 'haine'),
  ('swast', 'exact', 'haine'),
  ('pd', 'exact', 'insulte'),
  ('pede', 'exact', 'insulte'),
  ('pute', 'exact', 'insulte'),
  ('nique', 'exact', 'insulte'),
  ('ntm', 'exact', 'insulte'),
  ('fdp', 'exact', 'insulte'),
  ('fuck', 'exact', 'insulte'),
  ('shit', 'exact', 'insulte'),
  ('cul', 'exact', 'insulte'),
  ('sexe', 'exact', 'insulte'),
  ('sex', 'exact', 'insulte'),
  ('porn', 'exact', 'insulte'),
  ('porno', 'exact', 'insulte'),
  ('bite', 'exact', 'insulte'),
  ('con', 'exact', 'insulte'),
  ('conne', 'exact', 'insulte'),
  ('merde', 'exact', 'insulte'),
  ('penis', 'exact', 'insulte'),
  ('vagin', 'exact', 'insulte'),
  ('chatte', 'exact', 'insulte'),
  ('clito', 'exact', 'insulte'),
  ('zizi', 'exact', 'insulte'),
  ('pedo', 'exact', 'insulte'),
  ('viol', 'exact', 'insulte'),
  ('kys', 'exact', 'insulte'),
  ('bitch', 'exact', 'insulte'),
  ('whore', 'exact', 'insulte'),
  ('slut', 'exact', 'insulte'),
  ('cunt', 'exact', 'insulte'),
  ('cum', 'exact', 'insulte'),
  ('anal', 'exact', 'insulte'),
  ('admin', 'exact', 'usurpation'),
  ('root', 'exact', 'usurpation'),
  ('support', 'exact', 'usurpation'),
  ('staff', 'exact', 'usurpation'),
  ('systeme', 'exact', 'usurpation'),
  ('system', 'exact', 'usurpation'),
  ('goatfc', 'exact', 'usurpation'),
  ('null', 'exact', 'usurpation'),
  ('undefined', 'exact', 'usurpation'),
  ('nazionale', 'exception', 'haine'),
  ('nazional', 'exception', 'haine'),
  ('nazioni', 'exception', 'haine'),
  ('renaissance', 'exception', 'haine')
on conflict (terme) do nothing;


-- ─── 2. La normalisation, identique au JS ───────────────────────────────────
-- `lecture_du_un` vaut 'i' ou 'l' : le « 1 » imite les deux, et choisir aurait
-- laissé passer « h1tler » ou « hit1er » selon le choix. On appelle donc la
-- fonction deux fois.
--
-- Pas de dépendance à l'extension `unaccent` : translate() suffit et ne
-- demande rien à installer.
create or replace function public.bb_squelette(p text, lecture_du_un text)
returns text language sql immutable as $$
  select regexp_replace(
    translate(
      translate(
        lower(replace(coalesce(p, ''), '1', lecture_du_un)),
        'àáâãäåèéêëìíîïòóôõöùúûüýÿçñ',
        'aaaaaaeeeeiiiiooooouuuuyycn'
      ),
      -- Les 16 paires de SUBSTITUTIONS, dans le même ordre que le JS. translate()
      -- apparie caractère par caractère : les deux chaînes doivent faire la même
      -- longueur, et un décalage d'un seul signe rend la fonction absurde.
      '03456789@$!|+€£¡',
      'oeasgtbgasiiteli'
    ),
    '[^a-z]', '', 'g')
$$;

-- Réduit les lettres répétées TROIS fois ou plus à une seule — et pas les
-- doubles. Écraser les doubles confondrait « nigger » et « niger », un pays.
create or replace function public.bb_destretch(p text)
returns text language sql immutable as $$
  select regexp_replace(coalesce(p, ''), '(.)\1{2,}', '\1', 'g')
$$;


-- ─── 3. Le verdict ──────────────────────────────────────────────────────────
-- Rend le motif ('haine' | 'insulte' | 'usurpation') ou NULL si le pseudo passe.
create or replace function public.bb_pseudo_interdit(p text)
returns text language plpgsql stable as $$
declare
  formes text[];
  f text;
  r record;
  cle text;
  ordre text[] := array['haine','insulte','usurpation'];
  m text;
begin
  formes := array[]::text[];
  foreach f in array array[public.bb_squelette(p, 'i'), public.bb_squelette(p, 'l')] loop
    if f <> '' then
      formes := formes || f;
      formes := formes || public.bb_destretch(f);
    end if;
  end loop;
  if array_length(formes, 1) is null then return null; end if;

  -- Les exceptions sont CONSOMMÉES d'abord : « AzzurriNazionale » devient
  -- « azzurri », alors que « NazionaleNazi » laisse « nazi » et tombera.
  for r in select terme from public.bb_termes_interdits where niveau = 'exception' loop
    foreach cle in array array[public.bb_squelette(r.terme, 'i'), public.bb_squelette(r.terme, 'l')] loop
      if cle <> '' then
        formes := array(select replace(x, cle, '') from unnest(formes) as x);
      end if;
    end loop;
  end loop;
  formes := array(select x from unnest(formes) as x where x <> '');
  if array_length(formes, 1) is null then return null; end if;

  -- La haine d'abord : sur un pseudo qui coche deux cases, c'est le motif qu'on
  -- veut voir remonter.
  foreach m in array ordre loop
    for r in select terme from public.bb_termes_interdits where niveau = 'partiel' and motif = m loop
      foreach cle in array array[public.bb_squelette(r.terme, 'i'), public.bb_squelette(r.terme, 'l')] loop
        if cle <> '' and exists (select 1 from unnest(formes) as x where x like '%' || cle || '%') then
          return m;
        end if;
      end loop;
    end loop;
  end loop;

  foreach m in array ordre loop
    for r in select terme from public.bb_termes_interdits where niveau = 'exact' and motif = m loop
      foreach cle in array array[public.bb_squelette(r.terme, 'i'), public.bb_squelette(r.terme, 'l')] loop
        if cle <> '' and exists (select 1 from unnest(formes) as x where x = cle) then
          return m;
        end if;
      end loop;
    end loop;
  end loop;

  return null;
end $$;


-- ─── 4. Le trigger ──────────────────────────────────────────────────────────
-- Le message d'erreur ne dit PAS quel terme a matché : la liste se devinerait
-- par tâtonnement, et ce serait offrir un jeu à qui cherche à passer.
create or replace function public.bb_pseudos_moderation()
returns trigger language plpgsql as $$
declare motif text;
begin
  -- Le format d'abord, et ce n'est pas cosmétique : l'app n'accepte que
  -- [a-zA-Z0-9_-] sur 3 à 12 signes, mais la base ne l'imposait pas. Sans cette
  -- ligne, une écriture directe pouvait poser « Hitlеr » avec un « е »
  -- cyrillique — invisible à l'oeil, et qu'aucune liste de termes n'attrape.
  -- Refuser tout ce qui n'est pas ASCII ferme le trou d'un coup, là où
  -- énumérer les homoglyphes ne finit jamais.
  if new.pseudo !~ '^[a-zA-Z0-9_-]{3,12}$' then
    raise exception 'pseudo invalide (format)'
      using errcode = 'check_violation', hint = 'format';
  end if;
  motif := public.bb_pseudo_interdit(new.pseudo);
  if motif is not null then
    raise exception 'pseudo refuse (moderation)'
      using errcode = 'check_violation', hint = motif;
  end if;
  return new;
end $$;

drop trigger if exists bb_pseudos_moderation_trg on public.bb_pseudos;
create trigger bb_pseudos_moderation_trg
  before insert or update of pseudo on public.bb_pseudos
  for each row execute function public.bb_pseudos_moderation();


-- ─── 5. Contrôle, à lancer juste après ──────────────────────────────────────
-- Doit rendre 'haine' sur la première ligne, et NULL sur les trois suivantes.
-- Si « Nigeria » ou « antiraciste » ressort non-NULL, la normalisation SQL a
-- divergé du JS : ne pas laisser le trigger en place dans cet etat.
--
--   select public.bb_pseudo_interdit('H1tl3r_88');   -- haine
--   select public.bb_pseudo_interdit('Nigeria');     -- NULL
--   select public.bb_pseudo_interdit('antiraciste'); -- NULL
--   select public.bb_pseudo_interdit('Scunthorpe');  -- NULL
--
-- Le format, lui, est vérifié par le trigger et non par cette fonction :
--   insert into public.bb_pseudos (player_id, pseudo) values ('x', 'Hitlеr');
--   -- doit échouer avec hint = 'format' (le « e » est cyrillique)
--
-- Et l'audit des pseudos DÉJÀ en base, que le trigger ne touche pas :
--
--   select pseudo, public.bb_pseudo_interdit(pseudo) as motif
--     from public.bb_pseudos
--    where public.bb_pseudo_interdit(pseudo) is not null
--    order by motif, pseudo;
