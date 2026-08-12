#!/usr/bin/env node
// GÉNÈRE le verrou Postgres depuis la liste JavaScript.
//
//     node scripts/pseudos-sql.mjs
//
// Entrée  : src/lib/pseudo.ts
// Sortie  : docs/supabase-pseudos-interdits.sql
//
// Pourquoi générer plutôt qu'écrire le SQL à la main : deux listes finissent
// TOUJOURS par diverger. Celle du client sert à donner un message tout de suite,
// celle de la base est le seul verrou réel — si la seconde prend du retard, on
// croit bloquer ce qu'on ne bloque plus. Une seule source, un script.
//
// Le fichier .ts est lu COMME TEXTE : l'importer depuis Node réclamerait un
// transpileur. C'est déjà ce que fait scripts/cartes-modes.mjs avec charte.jsx.
// Le format attendu est donc strict — des tableaux de chaînes entre guillemets
// doubles — et le script échoue franchement s'il ne retrouve pas les listes,
// plutôt que d'émettre un SQL à moitié vide.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, "..");
const source = await readFile(join(racine, "src", "lib", "pseudo.ts"), "utf8");

// Extrait les chaînes d'un bloc « nom: Record<...> = { motif: [...], ... } ».
function listesParMotif(nomBloc) {
  const debut = source.indexOf("const " + nomBloc + ":");
  if (debut < 0) throw new Error("bloc introuvable dans pseudo.ts : " + nomBloc);
  // On s'arrête au « }; » de fin de bloc, en colonne 0.
  const fin = source.indexOf("\n};", debut);
  if (fin < 0) throw new Error("fin de bloc introuvable : " + nomBloc);
  const bloc = source.slice(debut, fin);
  const par = {};
  for (const m of bloc.matchAll(/^\s{2}(haine|insulte|usurpation):\s*\[([\s\S]*?)\],?\s*$/gm)) {
    par[m[1]] = [...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  }
  const motifs = Object.keys(par);
  if (motifs.length !== 3) throw new Error(nomBloc + " : 3 motifs attendus, " + motifs.length + " trouvés");
  return par;
}

function listeSimple(nom) {
  const debut = source.indexOf("const " + nom + " = [");
  if (debut < 0) throw new Error("liste introuvable : " + nom);
  const fin = source.indexOf("\n];", debut);
  const bloc = source.slice(debut, fin);
  return [...bloc.matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

const PARTIELS = listesParMotif("PARTIELS");
const EXACTS = listesParMotif("EXACTS");
const EXCEPTIONS = listeSimple("EXCEPTIONS");

// Les termes partent en base tels qu'écrits : c'est la fonction SQL qui les
// normalise, avec exactement les mêmes règles que le JS. Les normaliser ici
// obligerait à garder DEUX normalisations d'accord, ce qu'on cherche à éviter.
const lignes = [];
for (const [niveau, table] of [["partiel", PARTIELS], ["exact", EXACTS]]) {
  for (const [motif, termes] of Object.entries(table)) {
    for (const t of termes) lignes.push(`  (${sql(t)}, '${niveau}', '${motif}')`);
  }
}
for (const t of EXCEPTIONS) lignes.push(`  (${sql(t)}, 'exception', 'haine')`);

function sql(s) { return "'" + s.replace(/'/g, "''") + "'"; }

const total = lignes.length;

const fichier = `-- ============================================================================
--  GOAT FC — Pseudos interdits, verrou côté BASE
--
--  ⚠️ FICHIER GÉNÉRÉ. Ne pas modifier à la main :
--         node scripts/pseudos-sql.mjs
--     La source est src/lib/pseudo.ts, qui sert aussi au contrôle côté client.
--
--  À coller dans Supabase → SQL Editor → Run. Idempotent : relançable.
--
--  ── POURQUOI CE FICHIER EXISTE ─────────────────────────────────────────────
--  Le contrôle JavaScript arrête les joueurs, pas un attaquant : la clé \`anon\`
--  est publique — elle est dans le bundle — donc n'importe qui peut faire un
--  POST direct sur bb_pseudos et se poser le pseudo qu'il veut. Sans ce
--  trigger, la modération des pseudos est une politesse, pas une garantie.
--
--  ── CE QU'IL FAIT ──────────────────────────────────────────────────────────
--  1. une table des termes, ${String(total).padStart(3)} lignes, rejouant la liste du client ;
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
-- Le revoke est conditionnel : le rôle \`anon\` existe toujours sur Supabase, mais
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
${lignes.join(",\n")}
on conflict (terme) do nothing;


-- ─── 2. La normalisation, identique au JS ───────────────────────────────────
-- \`lecture_du_un\` vaut 'i' ou 'l' : le « 1 » imite les deux, et choisir aurait
-- laissé passer « h1tler » ou « hit1er » selon le choix. On appelle donc la
-- fonction deux fois.
--
-- Pas de dépendance à l'extension \`unaccent\` : translate() suffit et ne
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
  select regexp_replace(coalesce(p, ''), '(.)\\1{2,}', '\\1', 'g')
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
`;

await writeFile(join(racine, "docs", "supabase-pseudos-interdits.sql"), fichier);
console.log("docs/supabase-pseudos-interdits.sql — " + total + " termes");
for (const [niveau, table] of [["partiels", PARTIELS], ["exacts", EXACTS]]) {
  const parMotif = Object.entries(table).map(([m, l]) => m + " " + l.length).join(", ");
  console.log("  " + niveau.padEnd(9) + parMotif);
}
console.log("  exceptions " + EXCEPTIONS.length);
