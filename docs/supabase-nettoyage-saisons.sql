-- NETTOYAGE DE bb_seasons — le doublon de la saison 4, et le verrou qui empêche
-- qu'il revienne.
--
-- À coller dans le SQL Editor de Supabase. Idempotent : relançable sans risque,
-- il ne fait rien s'il a déjà tourné.
--
-- ── CE QU'ON A TROUVÉ ─────────────────────────────────────────────────────
--
--   id | season_number | champion | ended_at
--    4 |             4 | thibault | 2026-07-31T23:36:02.899
--    5 |             4 | thibault | 2026-07-31T23:36:02.942
--
-- Quarante-trois MILLISECONDES d'écart. Ce n'est pas une double saisie : c'est
-- une course. Le Hall of Fame était alors écrit par le CLIENT — le premier
-- joueur à ouvrir l'app après le 1er du mois lisait le classement et écrivait la
-- saison. Deux joueurs ont ouvert l'app dans la même seconde, aucun des deux n'a
-- vu la ligne de l'autre, et les deux ont écrit.
--
-- C'est précisément la panne que `bb_cloturer_saison` a remplacée : elle refuse
-- déjà un numéro de saison déjà présent (`if exists … return 'refus'`), et elle
-- est appelée par une tâche planifiée avec `concurrency: cloture-saison`. Le
-- chemin actuel ne peut plus produire ce doublon. Le verrou ci-dessous couvre le
-- reste : une écriture manuelle, un ancien client resté ouvert, un script.
--
-- ── CE QU'ON NE FAIT PAS ──────────────────────────────────────────────────
--
-- ON NE RENUMÉROTE PAS. Il manque la saison 3 — juin 2026 n'a jamais été
-- clôturé, et il ne pouvait pas l'être : deux joueurs classés sur le mois, alors
-- que `bb_cloturer_saison` en exige trois. Le trou est donc légitime.
--
-- Et le numéro n'est pas un rang dans une liste : `bb_mois_de_saison(n)` calcule
-- avril 2026 + (n − 1) mois. Décaler les numéros pour boucher le trou ferait
-- pointer la saison 6 — celle qui porte les lots du concours — sur août au lieu
-- de septembre. Le palmarès sauterait de 2 à 4 : c'est la vérité de ce qui s'est
-- passé.
--
-- ON N'INVENTE PAS DE CHAMPION DE JUIN. Couronner à la main quelqu'un sur un
-- mois qui ne remplit pas les conditions, ce serait écrire dans le palmarès un
-- titre que la fonction a refusé de décerner.

begin;

-- 1. LE DOUBLON. On garde la ligne au plus PETIT id : c'est la première écrite,
--    donc celle que l'app a affichée depuis le 1er août. Les deux portent le
--    même champion et les mêmes dauphins — le choix ne change rien à ce qui est
--    montré, il change seulement l'identifiant, et autant garder le plus ancien.
delete from public.bb_seasons a
 using public.bb_seasons b
 where a.season_number = b.season_number
   and a.id > b.id;

-- 2. LE VERROU. Sans lui, la ligne supprimée ci-dessus peut revenir dès qu'une
--    écriture concurrente repasse. Une contrainte UNIQUE fait échouer la seconde
--    insertion au lieu de la laisser doubler la première.
--
--    L'ordre compte : cette contrainte REFUSE de se créer tant qu'il reste des
--    doublons, d'où le delete juste avant. Et le `if not exists` la rend
--    relançable — `add constraint` seul échouerait au deuxième passage.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.bb_seasons'::regclass
       and conname  = 'bb_seasons_season_number_unique'
  ) then
    alter table public.bb_seasons
      add constraint bb_seasons_season_number_unique unique (season_number);
  end if;
end $$;

-- 3. LE MOIS DES DEUX PREMIÈRES SAISONS. `season_month` est arrivé plus tard :
--    les saisons 1 et 2 l'ont à null, et tout ce qui lit cette colonne doit
--    retomber sur `ended_at` — une date de CLÔTURE, qui tombe le 1er du mois
--    SUIVANT pour la saison 2 (2026-06-01 pour le mois de mai). Un repli qui
--    demande de reculer d'un jour avant de lire le mois est un piège à bug.
--
--    On remplit donc la colonne depuis la NUMÉROTATION, qui est la source de
--    vérité : avril 2026 + (numéro − 1) mois. Seules les lignes à null sont
--    touchées — une valeur déjà écrite par la fonction de clôture est laissée
--    telle quelle.
update public.bb_seasons
   set season_month = to_char(date '2026-04-01'
         + ((season_number - 1) || ' month')::interval, 'YYYY-MM')
 where season_month is null;

commit;

-- ── VÉRIFICATION ──────────────────────────────────────────────────────────
-- Attendu après passage : trois lignes, numéros 1, 2 et 4, un mois sur chacune,
-- et la colonne `doublons` à 1 partout.
select s.id, s.season_number, s.season_month, s.champion_name,
       count(*) over (partition by s.season_number) as doublons
  from public.bb_seasons s
 order by s.season_number;
