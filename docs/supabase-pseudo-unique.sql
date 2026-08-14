-- ============================================================================
--  GOAT FC — UN PSEUDO, UN SEUL JOUEUR
--  À coller dans Supabase → SQL Editor, dans l'ordre. Idempotent.
--
--  ── LE PROBLÈME ────────────────────────────────────────────────────────────
--
--  Rien n'empêche aujourd'hui deux joueurs de porter le même pseudo. Le seul
--  garde-fou est un contrôle CÔTÉ APPLICATION :
--
--      GET bb_pseudos?pseudo=ilike.<saisie>&select=player_id&limit=1
--
--  et il cède de trois façons :
--
--   1. IL ÉCHOUAIT EN S'OUVRANT. sbFetch rend `null` sur toute panne réseau ou
--      réponse en erreur, et ce null traversait le test sans rien déclencher :
--      l'exécution filait vers la création du pseudo. Une seule requête ratée
--      suffisait à poser un pseudo déjà pris. Corrigé côté app, mais un correctif
--      côté client ne protège que les clients à jour.
--
--   2. LA COURSE. Deux joueurs qui confirment le même pseudo dans la même
--      seconde lisent tous les deux « libre », puis écrivent tous les deux.
--      Aucun contrôle en deux temps « je lis puis j'écris » ne peut fermer ça.
--
--   3. L'API EST PUBLIQUE, PAR CONSTRUCTION. La clé anon est livrée dans le
--      bundle — c'est normal, c'est son rôle — et les policies de bb_pseudos
--      sont `using (true) with check (true)` pour insert, update ET delete.
--      N'importe qui sachant lire un bundle peut donc écrire :
--
--          PATCH /rest/v1/bb_pseudos?player_id=eq.<n'importe qui>
--          {"pseudo":"thibault"}
--
--      sans jamais passer par l'écran de saisie.
--
--  Constaté en production le 13 août 2026 sur 235 comptes : aucun doublon
--  exact, mais QUATRE paires ne différant que par la majuscule —
--  akram/Akram, Badbr/BADBR, faridprezu94/Faridprezu94, sodinho/Sodinho.
--
--  ── CE QUE CE FICHIER FAIT, ET NE FAIT PAS ─────────────────────────────────
--
--  Il pose un index unique sur lower(pseudo). C'est la seule garantie qui tienne
--  quel que soit le client : elle ferme la course ET l'écriture directe, parce
--  que c'est Postgres qui refuse, pas l'app qui demande gentiment.
--
--  Il ne règle PAS le point 3 dans son ensemble : avec les policies actuelles,
--  on peut toujours RENOMMER le compte de quelqu'un d'autre, ou le supprimer.
--  Fermer ça demande une identité côté serveur — l'authentification anonyme
--  Supabase, suivie au point #13. L'index unique est la moitié qui ne coûte rien
--  et qui protège le classement dès aujourd'hui.
-- ============================================================================


-- ─── ÉTAPE 1 — REGARDER. Ne rien changer. ───────────────────────────────────
--
-- L'index unique NE POURRA PAS se créer tant qu'il reste un conflit : Postgres
-- refuse avec « could not create unique index … Key (lower(pseudo)) is
-- duplicated ». On liste donc d'abord, avec de quoi décider qui garde le nom.
--
-- La date du dernier score sert à ça : entre akram et Akram, celui qui joue
-- encore garde son pseudo, l'autre est renommé.
select lower(p.pseudo)                     as clef,
       count(*)                            as comptes,
       string_agg(p.pseudo || ' [' || p.player_id || ']', '  |  '
                  order by p.pseudo)        as qui
  from public.bb_pseudos p
 group by lower(p.pseudo)
having count(*) > 1
 order by clef;

-- Le détail joueur par joueur, pour trancher : qui a joué, et quand.
select p.player_id, p.pseudo, p.xp,
       (select count(*)      from public.bb_scores s where s.player_id = p.player_id) as scores,
       (select max(s.created_at) from public.bb_scores s where s.player_id = p.player_id) as dernier_score
  from public.bb_pseudos p
 where lower(p.pseudo) in (select lower(pseudo) from public.bb_pseudos
                            group by lower(pseudo) having count(*) > 1)
 order by lower(p.pseudo), dernier_score desc nulls last;


-- ─── ÉTAPE 2 — RENOMMER LES PERDANTS ────────────────────────────────────────
--
-- On réutilise bb_renommer_pseudo de docs/supabase-renommer-pseudo.sql, et ce
-- n'est pas un détail : le pseudo est RECOPIÉ dans une dizaine de colonnes
-- (bb_scores.player_name, bb_duels.challenger_name, bb_seasons.champion_name…).
-- Un simple `update bb_pseudos` laisserait l'ancien nom affiché dans le
-- classement et au Hall of Fame — donc deux « akram » toujours visibles, ce
-- qu'on cherche précisément à supprimer.
--
-- La fonction refuse d'elle-même un nom déjà pris, hors format, ou bloqué par la
-- modération. Elle rend le nombre de lignes touchées par table : on VOIT ce qui
-- s'est passé.
--
-- Décommenter et adapter, une ligne par joueur à renommer. Le suffixe numérique
-- est le choix le moins surprenant pour le joueur, qui retrouve son nom.
--
--   select * from public.bb_renommer_pseudo('CWH84T', 'akram2');
--   select * from public.bb_renommer_pseudo('42CW76', 'badbr2');
--   select * from public.bb_renommer_pseudo('57ZKBX', 'faridprezu9');
--   select * from public.bb_renommer_pseudo('PJJHUA', 'sodinho2');
--
-- ⚠️ `faridprezu94` fait déjà 12 caractères, la longueur maximale : y ajouter un
--    chiffre serait refusé par le format. D'où `faridprezu9`, qui tient.
--
-- Puis on relance l'ÉTAPE 1 : elle doit ne plus rien rendre.


-- ─── ÉTAPE 3 — L'INDEX UNIQUE ───────────────────────────────────────────────
--
-- Sur lower(pseudo) et non sur pseudo : sans le lower(), « Akram » et « akram »
-- resteraient deux entrées légales et on n'aurait rien fermé. C'est exactement
-- le défaut constaté.
--
-- À lancer SEULEMENT quand l'étape 1 ne rend plus rien.
create unique index if not exists bb_pseudos_pseudo_unique_ci
  on public.bb_pseudos (lower(pseudo));

comment on index public.bb_pseudos_pseudo_unique_ci is
  'Un pseudo, un seul joueur, casse ignorée. Seule garantie indépendante du client : '
  'ferme la course entre deux confirmations simultanées ET l''écriture directe par '
  'l''API publique. Voir docs/supabase-pseudo-unique.sql.';


-- ─── ÉTAPE 4 — VÉRIFIER QUE ÇA MORD ─────────────────────────────────────────
--
-- Un index qu'on n'a pas vu refuser une écriture n'est pas un index vérifié.
-- Ce bloc tente le doublon dans une transaction qu'il ANNULE : la base ressort
-- exactement dans l'état où elle était.
do $$
declare
  cible text;
begin
  select pseudo into cible from public.bb_pseudos limit 1;
  if cible is null then
    raise notice 'table vide : rien a eprouver';
    return;
  end if;
  begin
    insert into public.bb_pseudos (player_id, pseudo)
    values ('ZZTEST', upper(cible));
    -- Si on arrive ici, l'index n'a pas mordu.
    raise exception 'ECHEC : le doublon "%" a ete accepte', upper(cible);
  exception
    when unique_violation then
      raise notice 'OK : le doublon "%" a bien ete refuse par l''index', upper(cible);
  end;
  -- Ceinture et bretelles : même si l'insert avait passé, on ne garde rien.
  delete from public.bb_pseudos where player_id = 'ZZTEST';
end $$;

-- Et l'état final, à lire avant de fermer l'onglet.
select count(*) as comptes,
       count(distinct lower(pseudo)) as pseudos_distincts,
       case when count(*) = count(distinct lower(pseudo))
            then 'un pseudo par joueur ✅' else 'IL RESTE DES DOUBLONS' end as verdict
  from public.bb_pseudos;
