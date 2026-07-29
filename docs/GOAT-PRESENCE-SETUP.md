# GOAT STATS — « En ce moment » (présence temps réel)

Le tableau de bord affiche le **nombre de personnes actuellement sur l'app**.
Chaque appareil ouvert envoie un « battement de cœur » toutes les 30 s
(`pingLive()`), qui met à jour **une seule ligne par appareil** dans la table
`bb_presence`. Le dashboard compte les appareils vus dans les **80 dernières
secondes**.

Tant que la table n'existe pas, la carte « En ce moment » affiche « — » (aucun
effet côté app).

## À exécuter dans Supabase → SQL Editor

```sql
create table if not exists public.bb_presence (
  player_id   text primary key,       -- 1 ligne par appareil (upsert)
  player_name text,
  os          text,                   -- ios | android | other
  last_seen   timestamptz not null default now()
);

-- Le jeu utilise la clé anon (comme les autres tables bb_*)
alter table public.bb_presence enable row level security;
create policy "presence_all" on public.bb_presence
  for all using (true) with check (true);

-- last_seen est TOUJOURS estampillé côté serveur (insert + update) → pas de
-- dépendance à l'horloge du téléphone.
create or replace function public.bb_presence_touch()
returns trigger as $$
begin
  new.last_seen := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists bb_presence_touch_trg on public.bb_presence;
create trigger bb_presence_touch_trg
  before insert or update on public.bb_presence
  for each row execute function public.bb_presence_touch();
```

## Comment ça marche

- À l'ouverture de l'app et toutes les 30 s (si l'onglet est visible), le client
  fait un **upsert** `{ player_id, player_name, os }` dans `bb_presence`
  (`Prefer: resolution=merge-duplicates`). Le trigger met `last_seen = now()`.
- Le dashboard interroge `bb_presence?last_seen=gte.<il y a 80 s>` toutes les
  15 s et compte les lignes → **« En ce moment »**.
- Une seule ligne par appareil : la table ne grossit pas avec le temps.

## (Optionnel) Ménage des vieux appareils

```sql
delete from public.bb_presence where last_seen < now() - interval '7 days';
```
