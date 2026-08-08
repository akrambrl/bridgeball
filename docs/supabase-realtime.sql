-- ── Activer le temps réel sur les tables de salon ─────────────────────────
--
-- POURQUOI
-- Toute la synchronisation multijoueur passe aujourd'hui par du sondage REST :
-- chaque joueur dans un salon interroge la base jusqu'à 75 fois par minute.
-- C'est de loin la requête la plus coûteuse de l'app, et elle grimpe
-- linéairement avec le nombre de joueurs simultanés.
--
-- Le temps réel inverse la charge : le serveur pousse la mise à jour au lieu
-- d'être interrogé. Un joueur en salon passerait de ~75 requêtes/minute à
-- quasiment zéro.
--
-- CE QUI BLOQUE
-- Un abonnement `postgres_changes` répond SUBSCRIBED même quand la table n'est
-- PAS publiée — il ne reçoit simplement jamais rien. C'est un échec silencieux,
-- et c'est précisément ce que fait le projet aujourd'hui : vérifié le 8 août
-- 2026 sur bb_rooms, bb_duel_rooms et bb_gg_rooms, l'abonnement se connecte et
-- aucun événement n'arrive.
--
-- Ces trois lignes ne peuvent pas être jouées depuis l'app : elles demandent
-- les droits propriétaire, que la clé publique n'a pas. À exécuter dans
-- l'éditeur SQL du tableau de bord Supabase.

alter publication supabase_realtime add table public.bb_duel_rooms;
alter publication supabase_realtime add table public.bb_gg_rooms;
alter publication supabase_realtime add table public.bb_rooms;

-- ── Vérifier que c'est pris ───────────────────────────────────────────────
-- Doit renvoyer les trois tables :
--
--   select tablename from pg_publication_tables
--   where pubname = 'supabase_realtime' and schemaname = 'public';

-- ── REPLICA IDENTITY ──────────────────────────────────────────────────────
-- Par défaut, un UPDATE ne transmet que la clé primaire dans l'ancienne
-- version de la ligne. Les filtres d'abonnement (`id=eq.…`) fonctionnent quand
-- même, mais si un jour on veut filtrer sur autre chose que la clé primaire,
-- il faudra passer ces tables en identité complète :
--
--   alter table public.bb_duel_rooms replica identity full;
--
-- Inutile pour l'usage actuel — à ne faire que si le besoin se présente, la
-- réplication complète coûte de la bande passante à chaque écriture.

-- ── APRÈS L'AVOIR JOUÉ ────────────────────────────────────────────────────
-- Prévenir côté code : le client peut alors s'abonner et ne garder le sondage
-- que comme filet de sécurité. Tant que ce fichier n'a pas été exécuté, le
-- sondage reste le SEUL canal de synchronisation — ne pas le retirer.
