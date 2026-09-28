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
-- ── OÙ ON EN EST ─────────────────────────────────────────────────────────
--
-- Une fonctionnalité de cette taille se construit par étapes indépendantes,
-- chacune vérifiable seule :
--   ✅ Phase 1 (sections 1-5) : le schéma, l'inscription (50 places,
--      atomique, filtrée par les notifications), le tirage du mode.
--   ✅ Phase 2, le moteur (sections 6-12, plus bas) : le calendrier des
--      manches, la proposition de contenu (premier arrivé, verrouillé),
--      les réponses, le classement de session. En polling REST (2-3s),
--      PAS Supabase Realtime — son fonctionnement en prod n'est pas
--      garanti aujourd'hui (docs/supabase-realtime.sql).
--   ✅ Phase 2, l'écran de jeu React (LePont.jsx, goatSessionModal) : les
--      4 écrans (liste, salon, jeu, fin), le polling, l'entrée notifs.
--   ⏳ Phase 3 : l'ouverture à l'heure PILE (pg_cron + Edge Function, PAS
--      les cron GitHub Actions existants — trop de retard observé, voir
--      docs/NOTIFICATIONS.md) + l'envoi de la notification juste avant.
--   ⏳ Phase 4 : les 5000 / 3000 / 1500 points, injectés dans
--      bb_classement_mois, à partir de bb_session_classement.
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
-- Calendrier des 3 (ou N) manches : QUE des horodatages, jamais le contenu
-- d'une manche (une paire de clubs, par exemple). Le serveur ne PEUT pas
-- générer ce contenu — la base des joueurs/clubs vit dans un fichier JSON
-- chargé côté client (public/donnees/joueurs.json), jamais en Postgres,
-- exactement comme pour tous les modes existants (le score est auto-
-- déclaré par le client, borné côté serveur, jamais recalculé — voir
-- bb_scores_garde, supabase-classement.sql section 2). Voir
-- `bb_proposer_manche` plus bas pour qui remplit ce contenu, et comment.
--
-- Purement fonction des paramètres (même entrée → même calendrier) : pas
-- besoin d'accéder à une table pour ça, `language sql` suffit.
create or replace function public.bb_calendrier_manches(p_depart timestamptz, p_manches int)
returns jsonb language sql as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'n', n,
           -- 15s avant la 1ère manche : le temps que les 50 téléphones
           -- reçoivent « le salon est complet » et affichent l'écran de jeu.
           -- 20s par manche, 6s de battement entre deux : des constantes à
           -- ajuster librement, rien dans le reste du système n'en dépend.
           'starts_at', p_depart + interval '15 seconds'
                      + (n-1) * (interval '20 seconds' + interval '6 seconds'),
           'ends_at',   p_depart + interval '15 seconds' + interval '20 seconds'
                      + (n-1) * (interval '20 seconds' + interval '6 seconds'),
           'data', null
         ) order by n), '[]'::jsonb)
    from generate_series(1, p_manches) as n
$$;

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

  -- Les 50 places atteintes : c'est ICI, et seulement ici (donc une seule
  -- fois, par construction — v_n ne peut valoir v_capacite que pour l'appel
  -- qui a fait passer le compteur au maximum) qu'on fige le calendrier des
  -- 3 manches. Voir la section 6 : ce calendrier ne contient QUE des
  -- horodatages, jamais le contenu d'une manche (la paire de clubs, par
  -- exemple) — ça, le serveur ne sait pas le générer (section 6).
  if v_n >= v_capacite then
    update public.bb_sessions
       set statut = 'complet',
           rounds = public.bb_calendrier_manches(now(), manches)
     where id = p_session_id;
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


-- ═══════════════════════════════════════════════════════════════════════
-- PHASE 2 — LE MOTEUR DES MANCHES SYNCHRONISÉES (backend seulement)
-- ═══════════════════════════════════════════════════════════════════════
--
-- Ce qui suit fait tourner les 3 manches une fois le salon complet (voir la
-- mise à jour de `bb_rejoindre_session` plus haut, qui fige maintenant
-- `rounds` via `bb_calendrier_manches` dès que la 50e place est prise).
-- L'écran de jeu React (Phase 2, suite) n'est PAS dans ce fichier — ce
-- morceau-ci est testable seul, à la main dans l'éditeur SQL, avant même
-- qu'un pixel de l'app ne change.
--
-- ── AUCUN « HÔTE-ARBITRE », MÊME À 50 ────────────────────────────────────
--
-- GOAT DUEL (1 contre 1) fait reposer l'avancement de la partie sur
-- l'appareil de l'hôte — invivable à 50 joueurs sans hôte désigné. Ici,
-- PERSONNE n'arbitre : le calendrier (section 2, `bb_calendrier_manches`)
-- est fixé UNE fois, à l'ouverture du salon, et chaque téléphone se cale
-- dessus indépendamment — une alarme partagée, pas un chef d'orchestre.
--
-- Seul vrai besoin d'un « premier arrivé » : le CONTENU d'une manche (la
-- paire de clubs à deviner, par exemple), que seul un client peut générer
-- puisque la base des joueurs/clubs ne vit que dans son navigateur. La
-- section 7 (`bb_proposer_manche`) verrouille ça exactement comme la
-- section 2 verrouille les 50 places : un `UPDATE` sous condition,
-- sérialisé par Postgres, jamais une boucle de retry côté client.

-- ─── 6. LES RÉPONSES ─────────────────────────────────────────────────────

create table if not exists public.bb_session_reponses (
  session_id  uuid not null references public.bb_sessions(id) on delete cascade,
  manche      int  not null,
  player_id   text not null,
  correct     boolean not null,
  -- Temps de réponse depuis l'OUVERTURE de la manche (starts_at), en
  -- millisecondes — auto-déclaré par le client, comme n'importe quel score
  -- ailleurs dans l'app. Borné à l'insertion par bb_repondre_manche.
  temps_ms    int not null,
  created_at  timestamptz not null default now(),
  primary key (session_id, manche, player_id)
);
alter table public.bb_session_reponses enable row level security;


-- ─── 7. PROPOSER LE CONTENU D'UNE MANCHE — PREMIER ARRIVÉ, VERROUILLÉ ───
--
-- Le client qui affiche l'écran de jeu et constate que `rounds[manche].data`
-- est encore vide propose son contenu (généré depuis les données qu'IL a en
-- mémoire — la paire de clubs pour Plug, le joueur de départ pour Mercato).
-- Le contenu lui-même est une boîte noire pour Postgres : `jsonb`, jamais
-- interprété ici, seulement gardé et re-servi tel quel à tout le monde.
--
-- SECURITY DEFINER : aucune policy UPDATE n'existe sur bb_sessions pour
-- anon/authenticated (section 4bis) — seule cette fonction peut écrire.
create or replace function public.bb_proposer_manche(p_session_id uuid, p_manche int, p_donnees jsonb)
returns boolean language plpgsql security definer
set search_path = public as $$
declare
  v_player_id text;
  v_idx int := p_manche - 1; -- un tableau jsonb s'indexe à partir de 0
  v_ok boolean;
begin
  select player_id into v_player_id from public.bb_pseudos where auth_uid = auth.uid();
  if v_player_id is null then return false; end if;

  -- Seuls les inscrits à CETTE session peuvent proposer son contenu —
  -- empêche un compte qui n'a jamais rejoint d'y injecter n'importe quoi.
  if not exists (select 1 from public.bb_session_joueurs
                  where session_id = p_session_id and player_id = v_player_id) then
    return false;
  end if;

  -- LE VERROU : `rounds->v_idx->'data' is null` dans le WHERE. Deux
  -- téléphones qui proposent à la microseconde près sont sérialisés par
  -- Postgres sur cette ligne (même principe que le compteur de la section
  -- 2) — le second voit `data` déjà posé par le premier et n'affecte aucune
  -- ligne, sans écraser ni dupliquer.
  update public.bb_sessions
     set rounds = jsonb_set(rounds, array[v_idx::text, 'data'], p_donnees, false)
   where id = p_session_id
     and rounds is not null
     and jsonb_array_length(rounds) > v_idx
     and (rounds->v_idx->>'n')::int = p_manche
     and rounds->v_idx->'data' is null
  returning true into v_ok;

  return coalesce(v_ok, false);
end $$;


-- ─── 8. RÉPONDRE À UNE MANCHE ────────────────────────────────────────────
--
-- Même trust model que tout le reste de l'app : la CORRECTION est décidée
-- par le client (qui a les données de jeu), le serveur ne fait que borner
-- la plausibilité (temps de réponse, fenêtre de la manche, un seul essai
-- par joueur et par manche) — comme bb_scores_garde le fait pour bb_scores
-- (supabase-classement.sql, section 2).
create or replace function public.bb_repondre_manche(
  p_session_id uuid, p_manche int, p_correct boolean, p_temps_ms int
) returns text language plpgsql security definer
set search_path = public as $$
declare
  v_player_id text;
  v_idx int := p_manche - 1;
  v_ends_at timestamptz;
begin
  select player_id into v_player_id from public.bb_pseudos where auth_uid = auth.uid();
  if v_player_id is null then return 'compte_introuvable'; end if;

  if not exists (select 1 from public.bb_session_joueurs
                  where session_id = p_session_id and player_id = v_player_id) then
    return 'pas_inscrit';
  end if;

  select (rounds->v_idx->>'ends_at')::timestamptz into v_ends_at
    from public.bb_sessions where id = p_session_id;
  if v_ends_at is null then return 'manche_introuvable'; end if;

  -- 3s de marge après la clôture officielle : un aller-retour réseau ne
  -- doit pas transformer une réponse tapée à temps en refus.
  if now() > v_ends_at + interval '3 seconds' then
    return 'trop_tard';
  end if;

  -- Borne large (3x la durée théorique d'une manche) : assez pour absorber
  -- un décalage d'horloge client, assez strict pour bloquer une valeur
  -- fabriquée à la main.
  if p_temps_ms < 0 or p_temps_ms > 180000 then
    return 'temps_invalide';
  end if;

  insert into public.bb_session_reponses (session_id, manche, player_id, correct, temps_ms)
    values (p_session_id, p_manche, v_player_id, p_correct, p_temps_ms)
  on conflict (session_id, manche, player_id) do nothing;

  if not found then return 'deja_repondu'; end if;

  return 'ok';
end $$;


-- ─── 9. LE CLASSEMENT DE LA SESSION — EN DIRECT ET FINAL ────────────────
--
-- Une seule et même fonction pour les deux usages : appelée PENDANT la
-- session (le client la sonde toutes les 2-3s, même cadence que les salons
-- bb_rooms existants — pas de dépendance à Supabase Realtime, dont le
-- fonctionnement en prod n'est pas garanti aujourd'hui, voir
-- docs/supabase-realtime.sql) elle donne un classement live ; appelée APRÈS
-- (bb_session_terminer), le même résultat EST le classement final —
-- aucune divergence possible entre les deux par construction.
--
-- Le point d'une manche va à la réponse CORRECTE la plus rapide, jamais à
-- une réponse fausse aussi rapide soit-elle (« le plus rapide à répondre
-- marque le point », règle déjà affichée pour GOAT DUEL). Les égalités se
-- tranchent par le nombre de bonnes réponses, puis par le temps cumulé.
create or replace function public.bb_session_classement(p_session_id uuid)
returns table (
  player_id text, pseudo text,
  manches_gagnees int, bonnes_reponses int, temps_total_ms bigint,
  rang int
) language sql stable as $$
  with gagnants as (
    select distinct on (manche) manche, player_id
      from public.bb_session_reponses
     where session_id = p_session_id and correct
     order by manche, temps_ms asc
  ),
  agrege as (
    select j.player_id,
           count(g.manche)::int as manches_gagnees,
           count(r.manche) filter (where r.correct)::int as bonnes_reponses,
           coalesce(sum(r.temps_ms) filter (where r.correct), 0)::bigint as temps_total_ms
      from public.bb_session_joueurs j
      left join gagnants g on g.player_id = j.player_id
      left join public.bb_session_reponses r
        on r.session_id = p_session_id and r.player_id = j.player_id
     where j.session_id = p_session_id
     group by j.player_id
  )
  select a.player_id, coalesce(p.pseudo,'?') as pseudo,
         a.manches_gagnees, a.bonnes_reponses, a.temps_total_ms,
         row_number() over (order by a.manches_gagnees desc, a.bonnes_reponses desc,
                             a.temps_total_ms asc)::int as rang
    from agrege a
    left join public.bb_pseudos p on p.player_id = a.player_id
   order by rang
$$;


-- ─── 10. CLÔTURER LA SESSION ─────────────────────────────────────────────
--
-- Idempotente et sans effet de bord sensible (juste un statut) : n'importe
-- quel client peut l'appeler sans risque, une fois la dernière manche
-- passée. Volontairement SANS injection de points ici — les 5000 / 3000 /
-- 1500 au classement mensuel sont la Phase 4, qui consommera
-- bb_session_classement(p_session_id) une fois ce statut à 'termine'.
create or replace function public.bb_session_terminer(p_session_id uuid)
returns text language plpgsql security definer
set search_path = public as $$
declare
  v_statut text;
  v_derniere_fin timestamptz;
begin
  select statut, (rounds->-1->>'ends_at')::timestamptz into v_statut, v_derniere_fin
    from public.bb_sessions where id = p_session_id;

  if v_statut is null then return 'session_introuvable'; end if;
  if v_statut = 'termine' then return 'deja_termine'; end if;
  if v_derniere_fin is null or now() < v_derniere_fin + interval '3 seconds' then
    return 'pas_encore_finie';
  end if;

  update public.bb_sessions set statut = 'termine' where id = p_session_id;
  return 'ok';
end $$;


-- ─── 11. RLS DE bb_session_reponses — MÊME PRINCIPE QUE LA SECTION 4 ────
drop policy if exists p_bb_session_reponses_select on public.bb_session_reponses;
create policy p_bb_session_reponses_select on public.bb_session_reponses for select to anon, authenticated using (true);
grant select on public.bb_session_reponses to anon, authenticated;


-- ─── 12. CONTRÔLES PHASE 2, À LANCER APRÈS ──────────────────────────────
--
-- a) Remplir une session de test à la main (sans passer par 50 vraies
--    inscriptions) pour obtenir un calendrier, puis regarder sa forme :
--    update bb_sessions set rounds = bb_calendrier_manches(now(), 3),
--      statut = 'complet' where id = '<id>';
--    select rounds from bb_sessions where id = '<id>';
--
-- b) Proposer le contenu de la manche 1, vérifier qu'une deuxième
--    proposition est refusée (renvoie false, ne remplace pas la première) :
--    select bb_proposer_manche('<id>', 1, '{"c1":"Real Madrid","c2":"PSG"}');
--    select bb_proposer_manche('<id>', 1, '{"c1":"Autre","c2":"Truc"}');
--    select rounds->0 from bb_sessions where id = '<id>'; -- doit garder la 1ère
--
-- c) Répondre, vérifier le classement, vérifier le refus de double réponse :
--    select bb_repondre_manche('<id>', 1, true, 4200);
--    select bb_repondre_manche('<id>', 1, true, 500);  -- 'deja_repondu'
--    select * from bb_session_classement('<id>');
--
-- d) Vérifier qu'on ne peut pas clôturer avant l'heure :
--    select bb_session_terminer('<id>'); -- 'pas_encore_finie' si trop tôt
