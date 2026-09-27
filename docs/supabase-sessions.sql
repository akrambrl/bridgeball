-- ─────────────────────────────────────────────────────────────────────────
-- GOAT SESSION — les rendez-vous programmés à 50 joueurs
-- ─────────────────────────────────────────────────────────────────────────
--
-- Deux rendez-vous par semaine (ex. mercredi 19h, samedi 16h, heure de
-- Paris) : un salon de 50 places sur un mode GOAT DUEL tiré au sort (Plug ou
-- Mercato), 3 manches, réservé à qui a activé les notifications. Premier
-- arrivé, premier servi ; une fois 50 dedans, le salon se ferme et démarre.
-- Le vainqueur touche 5000 points au classement, 3000 pour le 2e, 1500 pour
-- le 3e — un vrai bonus HORS barème normalisé (section 4 de
-- supabase-classement.sql), assumé comme tel : voir la section 3 plus bas.
--
-- ── CE FICHIER, PHASE 1 SEULEMENT ──────────────────────────────────────
--
-- Une fonctionnalité de cette taille se construit par étapes indépendantes,
-- chacune vérifiable seule :
--   1. CE FICHIER : le schéma, l'inscription (50 places, atomique, filtrée
--      par les notifications), le tirage du mode. Rien à voir côté app
--      pour l'instant — un salon créé ici reste vide de joueurs tant que
--      l'écran client n'existe pas.
--   2. Le moteur des 3 manches synchronisées + l'écran de jeu live
--      (Supabase Realtime, horaires précalculés — voir la section 2).
--   3. L'ouverture à l'heure PILE (pg_cron + Edge Function, PAS les cron
--      GitHub Actions existants — trop de retard observé, voir
--      docs/NOTIFICATIONS.md) + l'envoi de la notification juste avant.
--   4. Les 5000 / 3000 / 1500 points, injectés dans bb_classement_mois.
--
-- ── POURQUOI PAS LE MÊME PATRON QUE bb_rooms ────────────────────────────
--
-- bb_rooms (docs/supabase-rls.sql, section « salons éphémères ») autorise
-- le CLIENT à écrire directement dans un blob JSON `players`, avec une
-- boucle de retry optimiste côté app pour absorber les collisions — tenable
-- à 8 joueurs, hasardeux à 50 qui arrivent en rafale au même instant.
--
-- Ici, RIEN n'est accordé en écriture directe au client (voir la RLS en
-- section 4) : la SEULE porte d'entrée est `bb_rejoindre_session`, une
-- fonction SECURITY DEFINER qui fait le contrôle de capacité par un simple
-- UPDATE sur un compteur — Postgres sérialise les écritures concurrentes
-- sur une même ligne, ce qui rend le contrôle « 50 places, pas une de
-- plus » atomique par construction, sans retry ni collision possible.

-- ─── 1. LES TABLES ───────────────────────────────────────────────────────

create table if not exists public.bb_sessions (
  id            uuid primary key default gen_random_uuid(),
  -- 'pont' (The Plug) ou 'chaine' (The Mercato) — les deux modes que GOAT
  -- DUEL sait jouer aujourd'hui (LePont.jsx, duelMode). Tiré au sort à la
  -- création par bb_creer_session, jamais choisi par un joueur.
  mode          text not null check (mode in ('pont','chaine')),
  starts_at     timestamptz not null,
  manches       int not null default 3,
  capacite      int not null default 50,
  -- Compteur maintenu par bb_rejoindre_session, PAS par
  -- `select count(*) from bb_session_joueurs` : c'est ce compteur, mis à
  -- jour par un seul UPDATE atomique, qui fait office de verrou de
  -- capacité — voir la fonction plus bas.
  joined_count  int not null default 0,
  -- a_venir  : créée mais pas encore ouverte aux inscriptions (réservé à un
  --            futur usage, ex. affichage « prochaine session » avant
  --            l'heure — la phase 3 décidera si elle passe par cet état).
  -- ouvert   : inscriptions en cours.
  -- complet  : 50/50 atteint, la phase 2 peut démarrer le jeu.
  -- termine  : les 3 manches sont jouées, les points ont été distribués.
  -- annule   : ouverte mais jamais remplie / annulée manuellement.
  statut        text not null default 'ouvert'
                  check (statut in ('a_venir','ouvert','complet','en_cours','termine','annule')),
  -- Rempli par la phase 2 : les horaires précalculés de chaque manche
  -- (question, ouverture, clôture), pour que chaque téléphone se cale sur
  -- un horodatage partagé plutôt que sur un appareil-arbitre. Vide en
  -- phase 1.
  rounds        jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists bb_sessions_statut_idx on public.bb_sessions (statut, starts_at);

create table if not exists public.bb_session_joueurs (
  session_id  uuid not null references public.bb_sessions(id) on delete cascade,
  player_id   text not null,
  joined_at   timestamptz not null default now(),
  primary key (session_id, player_id)
);

alter table public.bb_sessions        enable row level security;
alter table public.bb_session_joueurs enable row level security;


-- ─── 2. L'INSCRIPTION — ATOMIQUE, FILTRÉE PAR LES NOTIFICATIONS ─────────
--
-- Pas de `p_player_id` en paramètre, même raisonnement que
-- `bb_mes_jours` (supabase-classement.sql, section 4ter) : le joueur est
-- retrouvé depuis `auth.uid()`, jamais reçu en entrée — impossible de faire
-- rejoindre quelqu'un d'autre.
--
-- SECURITY DEFINER, et c'est nécessaire ici (pas juste par prudence) :
-- `bb_push_subscriptions` n'a AUCUNE policy SELECT (supabase-rls.sql,
-- « write-only » — ses endpoints sont sensibles). Une fonction normale,
-- qui tourne sous l'identité de l'appelant, ne verrait donc jamais ses
-- propres lignes et refuserait tout le monde à tort. Le définisseur
-- contourne cette RLS UNIQUEMENT pour vérifier qu'une ligne existe —
-- jamais pour la lire ou la renvoyer.
create or replace function public.bb_rejoindre_session(p_session_id uuid)
returns table (etat text, place int) language plpgsql security definer
set search_path = public as $$
declare
  v_player_id text;
  v_statut text;
  v_capacite int;
  v_n int;
begin
  select player_id into v_player_id from public.bb_pseudos where auth_uid = auth.uid();
  if v_player_id is null then
    return query select 'compte_introuvable'::text, null::int; return;
  end if;

  select statut, capacite into v_statut, v_capacite
    from public.bb_sessions where id = p_session_id;
  if v_statut is null then
    return query select 'session_introuvable'::text, null::int; return;
  end if;

  -- Déjà inscrit : idempotent, on redonne juste sa place plutôt que
  -- de refuser — un double-tap sur le bouton ne doit jamais consommer
  -- une deuxième place.
  if exists (select 1 from public.bb_session_joueurs
              where session_id = p_session_id and player_id = v_player_id) then
    select count(*) into v_n from public.bb_session_joueurs
      where session_id = p_session_id and joined_at <= (
        select joined_at from public.bb_session_joueurs
         where session_id = p_session_id and player_id = v_player_id);
    return query select 'deja_inscrit'::text, v_n; return;
  end if;

  if v_statut <> 'ouvert' then
    return query select ('statut_'||v_statut)::text, null::int; return;
  end if;

  if not exists (select 1 from public.bb_push_subscriptions where player_id = v_player_id) then
    return query select 'notifs_requises'::text, null::int; return;
  end if;

  -- LE VERROU DE CAPACITÉ : un UPDATE sur une ligne unique. Deux joueurs
  -- qui arrivent à la microseconde près sont sérialisés par Postgres lui-
  -- même (verrou de ligne classique) — le second des deux voit
  -- nécessairement le `joined_count` déjà incrémenté par le premier, sans
  -- qu'aucun retry ni collision ne soit possible. C'est tout l'intérêt de
  -- ne PAS modéliser ça en tableau JSON réécrit en entier (voir l'en-tête
  -- du fichier).
  update public.bb_sessions
     set joined_count = joined_count + 1
   where id = p_session_id and joined_count < capacite
  returning joined_count into v_n;

  if v_n is null then
    return query select 'complet'::text, null::int; return;
  end if;

  insert into public.bb_session_joueurs (session_id, player_id) values (p_session_id, v_player_id);

  if v_n >= v_capacite then
    update public.bb_sessions set statut = 'complet' where id = p_session_id;
  end if;

  return query select 'ok'::text, v_n;
end $$;


-- ─── 3. CRÉER UNE SESSION — RÉSERVÉ À LA PROGRAMMATION, PAS AU CLIENT ───
--
-- Même esprit que `bb_cloturer_saison` (supabase-classement.sql, section
-- 5) : appelée avec la clé de service, jamais par l'app. La phase 3
-- l'appellera depuis pg_cron / une Edge Function, à l'heure pile ; en
-- attendant, elle peut être testée à la main dans l'éditeur SQL.
create or replace function public.bb_creer_session(p_starts_at timestamptz)
returns uuid language plpgsql security definer
set search_path = public as $$
declare
  v_mode text;
  v_id uuid;
begin
  -- Tirage au sort du mode : les deux seuls que GOAT DUEL sait jouer
  -- aujourd'hui. `random() < 0.5` plutôt qu'un tableau + index : rien à
  -- tenir à jour si un 3e mode DUEL apparaît un jour (il faudra alors
  -- remplacer cette ligne, pas juste une constante).
  v_mode := case when random() < 0.5 then 'pont' else 'chaine' end;

  insert into public.bb_sessions (mode, starts_at, statut)
    values (v_mode, p_starts_at, 'ouvert')
  returning id into v_id;

  return v_id;
end $$;


-- ─── 4. RLS — LECTURE OUVERTE, AUCUNE ÉCRITURE DIRECTE ──────────────────
--
-- Le client doit pouvoir LIRE (afficher « 37/50 », la liste des sessions à
-- venir, qui est déjà inscrit) mais n'a AUCUNE porte d'écriture directe :
-- ni INSERT, ni UPDATE, ni DELETE sur ces deux tables. La seule façon
-- d'agir dessus est `bb_rejoindre_session`, qui tourne en SECURITY
-- DEFINER et n'est donc pas soumise à ces policies.
drop policy if exists p_bb_sessions_select on public.bb_sessions;
create policy p_bb_sessions_select on public.bb_sessions for select to anon, authenticated using (true);

drop policy if exists p_bb_session_joueurs_select on public.bb_session_joueurs;
create policy p_bb_session_joueurs_select on public.bb_session_joueurs for select to anon, authenticated using (true);

grant select on public.bb_sessions, public.bb_session_joueurs to anon, authenticated;


-- ─── 5. CONTRÔLES, À LANCER APRÈS ───────────────────────────────────────
--
-- a) Créer une session de test dans 5 minutes et vérifier le tirage du mode :
--    select * from public.bb_creer_session(now() + interval '5 minutes');
--    select * from public.bb_sessions order by created_at desc limit 1;
--
-- b) Vérifier que la capacité tient sous concurrence (à lancer depuis DEUX
--    onglets de l'éditeur SQL en même temps, avec deux comptes différents,
--    ou en simulant l'auth.uid() — voir supabase-auth.essai.sql) :
--    select * from public.bb_rejoindre_session('<id de la session>');
--
-- c) Vérifier qu'un joueur SANS abonnement push est bien refusé :
--    select * from public.bb_rejoindre_session('<id>') ; -- doit renvoyer
--    'notifs_requises' pour un player_id absent de bb_push_subscriptions.
--
-- d) Vérifier qu'aucune écriture directe n'est possible :
--    insert into public.bb_session_joueurs values ('<id>', 'triche', now());
--    -- doit échouer (RLS), preuve que bb_rejoindre_session est la seule porte.
