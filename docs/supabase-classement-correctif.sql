-- ============================================================================
--  CORRECTIF pour les bases où supabase-classement.sql a DÉJÀ été appliqué.
--  À coller dans Supabase → SQL Editor → Run. Idempotent.
--
--  Deux choses, dont une urgente.
--
--  ── 1. LA CLÔTURE ÉTAIT APPELABLE PAR N'IMPORTE QUI ────────────────────────
--
--  La section 5 disait :
--
--      revoke execute on function public.bb_cloturer_saison(text, int) from anon;
--
--  et ne retirait RIEN. Postgres accorde EXECUTE à PUBLIC sur toute fonction dès
--  sa création, et PUBLIC couvre `anon` : retirer le grant direct d'un rôle qui
--  n'en a jamais eu ne change rien. La fonction étant en SECURITY DEFINER, elle
--  écrit bb_seasons avec les droits de son propriétaire — donc le `revoke insert
--  on bb_seasons`, qui lui fonctionnait, ne protégeait rien du tout : il suffisait
--  de passer par la fonction.
--
--  Ce n'est pas une hypothèse. Un appel de contrôle avec la clé publique a
--  répondu 200 et écrit une saison 999 dans le Hall of Fame.
--
--  Pourquoi le revoke sur la TABLE marchait et pas celui sur la FONCTION : les
--  tables n'ont pas de grant PUBLIC par défaut, les fonctions si.
--
--  ── 2. LA FAUSSE SAISON À SUPPRIMER ────────────────────────────────────────
--
--  La saison 999 posée par ce contrôle s'affiche EN TÊTE du palmarès, l'app
--  lisant bb_seasons?order=season_number.desc. Elle part ci-dessous.
-- ============================================================================


-- ─── 1. LE DROIT D'APPELER LA CLÔTURE ───────────────────────────────────────
revoke execute on function public.bb_cloturer_saison(text, int) from public;

do $$ begin
  -- Le service garde le droit : c'est la tâche planifiée du 1er du mois, avec la
  -- clé de service. Explicite, puisqu'il ne dépend plus de PUBLIC.
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.bb_cloturer_saison(text, int) to service_role;
  end if;
  -- Ceinture et bretelles : les privilèges par défaut de Supabase posent un grant
  -- direct sur les nouvelles fonctions, que le retrait de PUBLIC ne touche pas.
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function public.bb_cloturer_saison(text, int) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke execute on function public.bb_cloturer_saison(text, int) from authenticated;
  end if;
end $$;

-- Le barème doit rester LISIBLE par l'app : `bb_classement_mois` n'est pas en
-- SECURITY DEFINER, elle le lit sous l'identité de l'appelant. Une politique RLS
-- n'accorde aucun privilège, elle ne fait que filtrer — d'où ce grant explicite.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant select on public.bb_modes_bareme to anon;
  end if;
end $$;


-- ─── 2. LA FAUSSE SAISON ────────────────────────────────────────────────────
-- Ciblée sur le numéro ET sur le champion, pour ne rien emporter d'autre.
delete from public.bb_seasons
 where season_number = 999 and mode = 'global';


-- ─── 3. À DÉCIDER — LA SAISON 4 EST EN DOUBLE ───────────────────────────────
-- La table contient DEUX fois la saison 4, même champion, même score, même
-- horodatage à la seconde. C'est une trace de l'ancienne clôture côté client,
-- qui tournait sur le téléphone du premier joueur à ouvrir l'app après le 1er du
-- mois : deux appareils au même instant, deux lignes. Le palmarès l'affiche donc
-- deux fois. La saison 3, elle, n'existe pas du tout — ce mois-là n'a jamais été
-- clôturé, et il est trop tard pour le faire honnêtement.
--
-- Rien n'est supprimé automatiquement : c'est de la donnée, pas un privilège.
-- Décommenter pour ne garder que la plus ancienne des deux lignes :
--
-- delete from public.bb_seasons a
--  where a.season_number = 4
--    and a.id > (select min(b.id) from public.bb_seasons b where b.season_number = 4);


-- ─── CONTRÔLES ──────────────────────────────────────────────────────────────
-- a) La clôture n'est plus appelable par la clé publique. Depuis l'app, un appel
--    à rpc/bb_cloturer_saison doit répondre 401 ou 403, et non 200.
--
-- b) Le palmarès, sans la fausse saison :
--    select season_number, champion_name, champion_score, ended_at
--      from public.bb_seasons order by season_number desc;
--
-- c) L'onglet Saison marche toujours :
--    select * from public.bb_classement_courant() limit 5;
