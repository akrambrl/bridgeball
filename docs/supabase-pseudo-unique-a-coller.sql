-- ============================================================================
--  GOAT FC — UN PSEUDO, UN SEUL JOUEUR.  À COLLER TEL QUEL.
--
--  Supabase → SQL Editor → coller TOUT → Run. Une seule fois suffit, et le
--  relancer ne casse rien.
--
--  ── POURQUOI CETTE VERSION EXISTE ──────────────────────────────────────────
--
--  docs/supabase-pseudo-unique.sql demande de choisir qui garde son nom, puis
--  d'appeler bb_renommer_pseudo — une fonction créée par un AUTRE fichier
--  (docs/supabase-renommer-pseudo.sql), qui n'a peut-être jamais été appliqué.
--  Un `42883 function does not exist` en plein milieu, c'est exactement la panne
--  qu'on a déjà eue une fois sur ce projet.
--
--  Ce fichier-ci ne dépend de RIEN : il porte son propre renommage, et les choix
--  sont déjà faits d'après les données de production. Zéro décision à prendre.
--
--  ── LES CHOIX, ET SUR QUOI ILS REPOSENT ────────────────────────────────────
--
--  Relevé le 14 août 2026 sur les 239 comptes. Dans chaque paire, celui qui a
--  JOUÉ garde son pseudo ; l'autre est renommé. Les huit comptes sont dormants
--  depuis avril, donc personne ne verra son nom changer sous ses yeux.
--
--    pseudo         id       xp   scores  dernière partie   décision
--    Akram          CWH84T   27   18      2026-04-18        garde
--    akram          4TJKHN    0    0      jamais            → akram2
--    BADBR          42CW76   73    3      2026-04-14        garde
--    Badbr          TJ7BJM   44    1      2026-04-14        → badbr2
--    Faridprezu94   57ZKBX   83    3      2026-04-12        garde
--    faridprezu94   J3V8XK    0    1      2026-04-12        → faridprezu9
--    sodinho        X2QCPE   31    2      2026-04-14        garde
--    Sodinho        PJJHUA    0    0      jamais            → sodinho2
--
--  `faridprezu9` et non `faridprezu942` : le format est borné à 12 caractères et
--  le nom en fait déjà 12. C'est le seul cas où on ne pouvait pas suffixer.
--
--  Les quatre nouveaux noms ont été vérifiés LIBRES sur la base, casse ignorée.
--
--  ⚠️ Si « akram » est TON compte et que tu préfères garder la minuscule,
--     échange les deux identifiants de la première paire à l'étape 2 — ni l'un ni
--     l'autre n'a d'historique qui compte (0 et 18 parties, dormants depuis avril).
--
--  ── LE PIÈGE QUE CE FICHIER ÉVITE ──────────────────────────────────────────
--
--  Le pseudo est RECOPIÉ — dénormalisé — dans une dizaine de colonnes :
--  bb_scores.player_name, bb_duels.challenger_name / opponent_name,
--  bb_rooms.host_name, bb_seasons.champion_name… Un simple `update bb_pseudos`
--  laisserait l'ancien nom AFFICHÉ dans le classement et au Hall of Fame. Les
--  colonnes ne sont donc pas listées à la main : elles sont découvertes dans le
--  catalogue, pour qu'une table ajoutée plus tard soit traitée sans qu'on y pense.
--
--  Éprouvé sur un Postgres jetable avant envoi : `npm run sql:pseudo`.
-- ============================================================================


-- ─── ÉTAPE 1 — REGARDER (ne change rien) ────────────────────────────────────
select lower(p.pseudo) as clef,
       count(*)        as comptes,
       string_agg(p.pseudo || ' [' || p.player_id || ']', '  |  ' order by p.pseudo) as qui
  from public.bb_pseudos p
 group by lower(p.pseudo)
having count(*) > 1
 order by clef;


-- ─── ÉTAPE 2 — RENOMMER, ET PROPAGER PARTOUT ────────────────────────────────
do $$
declare
  cible record;
  ancien text;
  col record;
  n bigint;
  total bigint := 0;
begin
  for cible in
    select * from (values
      ('4TJKHN', 'akram2'),
      ('TJ7BJM', 'badbr2'),
      ('J3V8XK', 'faridprezu9'),
      ('PJJHUA', 'sodinho2')
    ) as t(id, nouveau)
  loop
    select pseudo into ancien from public.bb_pseudos where player_id = cible.id;

    -- Chaque cas est SAUTÉ plutôt que fatal : relancer ce fichier ne doit pas
    -- échouer, et un compte déjà renommé n'est pas une erreur.
    if ancien is null then
      raise notice 'IGNORE %  : aucun compte avec cet identifiant', cible.id;
      continue;
    end if;
    if lower(ancien) = lower(cible.nouveau) then
      raise notice 'IGNORE %  : deja nomme %', cible.id, ancien;
      continue;
    end if;
    if cible.nouveau !~ '^[a-zA-Z0-9_-]{3,12}$' then
      raise exception 'le nouveau pseudo % ne respecte pas le format 3-12 [a-zA-Z0-9_-]', cible.nouveau;
    end if;
    if exists (select 1 from public.bb_pseudos
                where lower(pseudo) = lower(cible.nouveau) and player_id <> cible.id) then
      raise exception 'le pseudo % est deja pris — choisis-en un autre', cible.nouveau;
    end if;

    update public.bb_pseudos set pseudo = cible.nouveau where player_id = cible.id;
    raise notice 'RENOMME % : % -> %', cible.id, ancien, cible.nouveau;

    -- Puis TOUTES les copies, découvertes dans le catalogue.
    total := 0;
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
      -- Sur lower() et NON `ilike ancien` : le pseudo peut contenir un « _ », qui
      -- est un joker dans LIKE — « audit_bot » aurait aussi attrapé « auditXbot ».
      -- Et sur lower() plutôt que sur l'égalité stricte : une copie écrite avec
      -- une autre casse serait sinon laissée en place.
      execute format('update public.%I set %I = $2 where lower(%I) = lower($1)',
                     col.table_name, col.column_name, col.column_name)
        using ancien, cible.nouveau;
      get diagnostics n = row_count;
      if n > 0 then
        total := total + n;
        raise notice '   %.% : % ligne(s)', col.table_name, col.column_name, n;
      end if;
    end loop;
    raise notice '   → % copie(s) mise(s) a jour', total;
  end loop;
end $$;


-- ─── ÉTAPE 3 — L'INDEX UNIQUE, la seule vraie garantie ──────────────────────
--
-- Sur lower(pseudo) et non sur pseudo : sans le lower(), « Akram » et « akram »
-- resteraient deux entrées légales et on n'aurait rien fermé.
--
-- C'est Postgres qui refusera, pas l'app qui demandera gentiment : ça ferme la
-- course entre deux confirmations simultanées ET l'écriture directe par l'API
-- publique, que la clé anon rend possible à quiconque lit le bundle.
create unique index if not exists bb_pseudos_pseudo_unique_ci
  on public.bb_pseudos (lower(pseudo));

comment on index public.bb_pseudos_pseudo_unique_ci is
  'Un pseudo, un seul joueur, casse ignoree. Seule garantie independante du client. '
  'Voir docs/supabase-pseudo-unique.sql.';


-- ─── ÉTAPE 4 — VÉRIFIER QUE ÇA MORD ─────────────────────────────────────────
--
-- Un index qu'on n'a pas vu refuser une écriture n'est pas un index vérifié. Ce
-- bloc tente le doublon puis ANNULE : la base ressort exactement comme avant.
do $$
declare
  cible text;
begin
  select pseudo into cible from public.bb_pseudos where pseudo is not null limit 1;
  if cible is null then
    raise notice 'table vide : rien a eprouver';
    return;
  end if;
  begin
    insert into public.bb_pseudos (player_id, pseudo) values ('ZZTEST', upper(cible));
    raise exception 'ECHEC : le doublon "%" a ete ACCEPTE', upper(cible);
  exception
    when unique_violation then
      raise notice 'OK : le doublon "%" a bien ete refuse par l''index', upper(cible);
  end;
  delete from public.bb_pseudos where player_id = 'ZZTEST';
end $$;


-- ─── LE VERDICT, à lire avant de fermer l'onglet ────────────────────────────
select count(*)                      as comptes,
       count(distinct lower(pseudo))  as pseudos_distincts,
       case when count(*) = count(distinct lower(pseudo))
            then 'un pseudo par joueur ✅'
            else 'IL RESTE DES DOUBLONS — relance l''etape 1' end as verdict
  from public.bb_pseudos
 where pseudo is not null;
