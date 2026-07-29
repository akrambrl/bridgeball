# GOAT DUEL — table Supabase à créer

Le mode **Duel en direct** (Plug temps réel 1v1, 5 manches, par code d'ami)
a besoin d'une table `bb_duel_rooms`. Tant qu'elle n'existe pas, le bouton
« Créer un salon » renverra une erreur.

## À exécuter dans Supabase → SQL Editor

```sql
create table if not exists public.bb_duel_rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  host_id text,
  host_name text,
  guest_id text,
  guest_name text,
  state text default 'lobby',      -- lobby | playing | finished
  phase text default 'wait',       -- wait | pick | answer | result | done
  round int default 0,             -- 1..5
  phase_at timestamptz,            -- début de la phase courante (décomptes)
  club_c1 text,                    -- club révélé n°1 (pick de l'hôte)
  club_c2 text,                    -- club révélé n°2 (pick de l'invité)
  host_pick text,
  guest_pick text,
  host_answer text,
  guest_answer text,
  host_answer_ms int8,             -- temps de réaction (ms) — plus bas = plus rapide
  guest_answer_ms int8,
  round_winner text,               -- host | guest | draw
  host_score int default 0,
  guest_score int default 0,
  winner_id text,
  winner_name text
);

-- Le jeu utilise la clé anon (comme les autres tables bb_*)
alter table public.bb_duel_rooms enable row level security;

create policy "duel_rooms_select" on public.bb_duel_rooms for select using (true);
create policy "duel_rooms_insert" on public.bb_duel_rooms for insert with check (true);
create policy "duel_rooms_update" on public.bb_duel_rooms for update using (true) with check (true);
create policy "duel_rooms_delete" on public.bb_duel_rooms for delete using (true);
```

## (Optionnel) Ménage des vieux salons

Pour éviter que la table grossisse, tu peux supprimer les salons de plus
d'un jour de temps en temps :

```sql
delete from public.bb_duel_rooms where created_at < now() - interval '1 day';
```

## Comment ça marche (rappel)

- 2 joueurs, **par code de salon** (un crée, partage le code, l'autre rejoint).
- **5 manches.** Chaque manche : décompte de **5 s** pendant lequel chacun
  choisit un club parmi 20 tops clubs → les 2 clubs s'affichent → **10 s** pour
  taper un joueur ayant joué dans les **deux** clubs.
- **Le premier à trouver gagne la manche.** Personne en 10 s → manche nulle.
- Vainqueur = celui qui gagne le plus de manches sur 5.
- Si les 2 clubs n'ont aucun joueur commun (très rare), la manche est
  annulée et rejouée.

L'**hôte** est l'arbitre : c'est son appareil qui fait avancer les phases
(les 2 joueurs synchronisent via un polling ~0,8 s). Il faut donc que l'hôte
reste connecté pendant la partie.
