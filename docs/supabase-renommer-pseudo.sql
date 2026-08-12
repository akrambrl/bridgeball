-- ============================================================================
--  GOAT FC — Renommer un pseudo déjà en base
--  À coller dans Supabase → SQL Editor. Idempotent : relançable sans risque.
--
--  Produit pour les cas trouvés par `node scripts/audit-pseudos.mjs` :
--  le trigger de modération ne regarde que les ÉCRITURES, donc les pseudos
--  posés avant lui restent en place.
--
--  ── LE PIÈGE, ET C'EST TOUT L'INTÉRÊT DE CE FICHIER ────────────────────────
--  Un UPDATE sur bb_pseudos NE SUFFIT PAS. Le pseudo est recopié — dénormalisé —
--  dans une dizaine d'autres colonnes au moment où l'action a lieu :
--  bb_scores.player_name, bb_duels.challenger_name / opponent_name,
--  bb_friend_requests.from_name / to_name, bb_rooms.host_name,
--  bb_seasons.champion_name… Renommer la seule table des pseudos laisse le mot
--  offensant AFFICHÉ dans le classement, dans l'historique des duels et au Hall
--  of Fame, c'est-à-dire précisément là où on voulait le faire disparaître.
--
--  Les colonnes ne sont donc PAS listées à la main : elles sont découvertes dans
--  le catalogue. Une table ajoutée plus tard avec une colonne « …_name » sera
--  traitée sans qu'on ait à penser à modifier ce fichier.
--
--  ── APRÈS ──────────────────────────────────────────────────────────────────
--  Le téléphone du joueur garde son ancien pseudo dans son stockage local, mais
--  se corrige tout seul au chargement suivant : l'app relit son pseudo en base
--  par player_id et réécrit sa copie locale. Rien à faire de son côté.
-- ============================================================================


-- ─── ÉTAPE 1 — REGARDER, sans rien changer ──────────────────────────────────
-- À lancer seul d'abord. La colonne `motif` dit pourquoi chaque ligne remonte.
select p.player_id, p.pseudo,
       public.bb_pseudo_interdit(p.pseudo) as motif,
       case when p.pseudo ~ '^[a-zA-Z0-9_-]{3,12}$' then '' else 'hors format' end as format
  from public.bb_pseudos p
 where public.bb_pseudo_interdit(p.pseudo) is not null
    or p.pseudo !~ '^[a-zA-Z0-9_-]{3,12}$'
 order by motif nulls last, p.pseudo;


-- ─── ÉTAPE 2 — LA FONCTION DE RENOMMAGE ─────────────────────────────────────
-- Elle fait le travail partout, et rend le nombre de lignes touchées par table
-- pour qu'on VOIE ce qui s'est passé au lieu de l'espérer.
create or replace function public.bb_renommer_pseudo(p_id text, p_nouveau text)
returns table (cible text, lignes bigint) language plpgsql as $$
declare
  ancien text;
  col record;
  n bigint;
begin
  select pseudo into ancien from public.bb_pseudos where player_id = p_id;
  if ancien is null then
    raise exception 'aucun joueur avec player_id = %', p_id;
  end if;
  if ancien = p_nouveau then
    raise exception 'le pseudo est deja %', p_nouveau;
  end if;
  -- Le nouveau nom passe-t-il la modération ? Le trigger le refuserait de toute
  -- façon, mais échouer ICI donne un message clair au lieu d'un check_violation.
  if public.bb_pseudo_interdit(p_nouveau) is not null then
    raise exception 'le nouveau pseudo est refuse par la moderation (%)',
      public.bb_pseudo_interdit(p_nouveau);
  end if;
  if p_nouveau !~ '^[a-zA-Z0-9_-]{3,12}$' then
    raise exception 'le nouveau pseudo ne respecte pas le format 3-12 [a-zA-Z0-9_-]';
  end if;
  -- Déjà pris ? La comparaison est insensible à la casse, comme dans l'app.
  if exists (select 1 from public.bb_pseudos
              where lower(pseudo) = lower(p_nouveau) and player_id <> p_id) then
    raise exception 'le pseudo % est deja pris', p_nouveau;
  end if;

  -- La table des pseudos, la seule qui fasse autorité.
  update public.bb_pseudos set pseudo = p_nouveau where player_id = p_id;
  return query select 'bb_pseudos.pseudo'::text, 1::bigint;

  -- Puis TOUTES les copies. Découvertes dans le catalogue : les lister à la main
  -- serait la façon la plus sûre d'en oublier une, et une seule oubliée laisse
  -- le mot visible quelque part.
  for col in
    select c.table_name, c.column_name
      from information_schema.columns c
     where c.table_schema = 'public'
       and c.table_name like 'bb\_%'
       and c.table_name <> 'bb_pseudos'
       and c.data_type in ('text', 'character varying')
       and (c.column_name like '%\_name' or c.column_name = 'pseudo')
     order by c.table_name, c.column_name
  loop
    -- Comparaison sur lower() et non sur l'égalité stricte : une copie écrite
    -- avec une autre casse (« AchrafHitler » là où la table des pseudos dit
    -- « achrafhitler ») serait sinon laissée en place, et c'est justement le
    -- genre de trace qu'on cherche à ne pas oublier.
    --
    -- Et surtout PAS `ilike ancien` : le pseudo peut contenir un « _ », qui est
    -- un joker dans LIKE. « audit_bot_temp » aurait alors aussi attrapé
    -- « auditXbotYtemp ».
    execute format('update public.%I set %I = $2 where lower(%I) = lower($1)',
                   col.table_name, col.column_name, col.column_name)
      using ancien, p_nouveau;
    get diagnostics n = row_count;
    if n > 0 then
      return query select (col.table_name || '.' || col.column_name)::text, n;
    end if;
  end loop;
end $$;


-- ─── ÉTAPE 3 — LES CAS TROUVÉS PAR L'AUDIT ──────────────────────────────────
-- Le nouveau nom est DÉRIVÉ du player_id : neutre, reproductible, et sans
-- collision possible avec un autre joueur. « joueur » + le début de l'identifiant,
-- coupé à 12 signes pour rester dans le gabarit.
--
--   RRLLR3  achrafhitler   → haine, à traiter
--
-- Décommente la ligne pour l'exécuter :

-- select * from public.bb_renommer_pseudo('RRLLR3', left('joueur' || lower('RRLLR3'), 12));


-- ─── ÉTAPE 4 — LE CAS À TON APPRÉCIATION ────────────────────────────────────
--   EY4LNL  Zboubati   → « zboub », argot grossier mais léger. Ce n'est pas de
--                        la haine, et c'est visiblement choisi pour faire rire.
--                        À toi de dire si ça reste. Si tu le gardes tel quel,
--                        retire « zboub » de la liste des termes, sinon le joueur
--                        ne pourra plus RE-confirmer son propre pseudo :
--
--     delete from public.bb_termes_interdits where terme = 'zboub';
--     -- et le retirer aussi de src/lib/pseudo.ts, pour que les deux concordent.
--
-- Ou le renommer, comme au-dessus :
-- select * from public.bb_renommer_pseudo('EY4LNL', left('joueur' || lower('EY4LNL'), 12));


-- ─── ÉTAPE 5 — CE QU'IL NE FAUT PAS RENOMMER ────────────────────────────────
--   67YKCZ  « Dz »              2 signes  (« Dz » = l'Algérie)
--   9EV3XD  « Tmaxdetchoupi »  13 signes
--
-- Ces deux-là ne sont PAS offensants : ils sont juste antérieurs à la règle de
-- format. Les renommer détruirait une identité choisie pour un détail technique.
-- Ils s'affichent normalement et le trigger ne les touche pas — il ne regarde
-- que les écritures. Leur seule conséquence : ces joueurs ne peuvent plus
-- RÉ-enregistrer ce pseudo-là, ce que l'app leur refuse déjà côté saisie.
--
-- En revanche celui-ci est une ligne d'essai, à supprimer :
--   AUDIT31789  « audit_bot_temp »
--
-- delete from public.bb_pseudos where player_id = 'AUDIT31789';


-- ─── ÉTAPE 6 — VÉRIFIER ─────────────────────────────────────────────────────
-- Doit ne plus rien rendre, hors les deux pseudos hors format laissés exprès.
select p.player_id, p.pseudo, public.bb_pseudo_interdit(p.pseudo) as motif
  from public.bb_pseudos p
 where public.bb_pseudo_interdit(p.pseudo) is not null
 order by p.pseudo;

-- Et qu'aucune COPIE ne traîne. Remplace le mot par celui que tu viens de
-- retirer : si une ligne remonte ici, c'est qu'une table porte une colonne que
-- la boucle n'a pas vue — dis-le, c'est un défaut de ce fichier.
-- do $$
-- declare col record; n bigint;
-- begin
--   for col in select c.table_name, c.column_name from information_schema.columns c
--              where c.table_schema='public' and c.table_name like 'bb\_%'
--                and c.data_type in ('text','character varying')
--                and (c.column_name like '%\_name' or c.column_name='pseudo') loop
--     execute format('select count(*) from public.%I where %I ilike %L',
--                    col.table_name, col.column_name, '%hitler%') into n;
--     if n > 0 then raise notice '% . % : % ligne(s)', col.table_name, col.column_name, n; end if;
--   end loop;
-- end $$;


-- ─── COMMENT CE FICHIER A ÉTÉ VÉRIFIÉ ───────────────────────────────────────
-- Sur un Postgres 16 jetable, avec une reconstitution du schéma : bb_pseudos,
-- bb_scores, bb_gg_scores, bb_duels, bb_friend_requests, bb_rooms, bb_seasons,
-- bb_reports — et le mot recopié dans les neuf colonnes de nom, dont quatre
-- écrites dans une CASSE différente (« AchrafHitler », « ACHRAFHITLER »,
-- « ACHRAFhitler », « AchrafHITLER »).
--
-- Résultat : 9 sites mis à jour, 0 trace restante. Les quatre garde-fous
-- refusent bien, chacun avec son message — nouveau pseudo interdit, hors format,
-- déjà pris, player_id inconnu.
--
-- Un détail appris en testant, et qui peut surprendre : une fois le trigger en
-- place, on ne peut PLUS reposer un pseudo interdit, même à la main en SQL. Pour
-- rejouer un essai il faut le désactiver le temps de semer :
--
--   alter table public.bb_pseudos disable trigger bb_pseudos_moderation_trg;
--   -- ... on sème ...
--   alter table public.bb_pseudos enable  trigger bb_pseudos_moderation_trg;
--
-- Le schéma ci-dessus est une RECONSTITUTION, lue dans le code de l'app. C'est
-- exactement pourquoi la boucle découvre les colonnes dans le catalogue au lieu
-- de les lister : sur la vraie base, l'ensemble peut différer, et le fichier
-- s'adapte au lieu d'en oublier une.
