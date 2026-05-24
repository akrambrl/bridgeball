-- Schéma de base de données pour l'outil de gestion de flotte (PostgreSQL / Supabase).
-- À exécuter dans le SQL Editor d'un projet Supabase pour passer du stockage
-- navigateur (MVP) à un back-end réel et multi-utilisateur.
--
-- Modèle de rôles :
--   * employer : accès complet en lecture/écriture sur sa flotte.
--   * driver   : accès en lecture à son véhicule, ses amendes et ses entretiens ;
--                peut créer ses propres trajets (tracker GPS).

create extension if not exists "pgcrypto";

-- Profil applicatif lié à un compte auth Supabase.
create table if not exists profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        text not null default 'driver' check (role in ('employer', 'driver')),
  first_name  text,
  last_name   text,
  email       text,
  phone       text,
  license_number text,
  created_at  timestamptz not null default now()
);

create table if not exists vehicles (
  id              uuid primary key default gen_random_uuid(),
  plate           text not null unique,
  brand           text not null,
  model           text not null,
  year            int,
  fuel            text check (fuel in ('essence', 'diesel', 'electrique', 'hybride')),
  status          text not null default 'active' check (status in ('active', 'maintenance', 'inactive')),
  mileage         int not null default 0,
  next_service_km int not null default 15000,
  driver_id       uuid references profiles (id) on delete set null,
  created_at      timestamptz not null default now()
);

create table if not exists fines (
  id         uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles (id) on delete cascade,
  driver_id  uuid references profiles (id) on delete set null,
  date       date not null,
  reason     text not null,
  amount     numeric(10, 2) not null,
  location   text,
  status     text not null default 'pending' check (status in ('pending', 'paid', 'contested')),
  created_at timestamptz not null default now()
);

create table if not exists maintenance (
  id         uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles (id) on delete cascade,
  date       date not null,
  kind       text not null,
  cost       numeric(10, 2) not null default 0,
  mileage    int,
  status     text not null default 'scheduled' check (status in ('scheduled', 'done')),
  notes      text,
  created_at timestamptz not null default now()
);

create table if not exists trips (
  id           uuid primary key default gen_random_uuid(),
  vehicle_id   uuid not null references vehicles (id) on delete cascade,
  driver_id    uuid references profiles (id) on delete set null,
  date         date not null,
  origin       text,
  destination  text,
  distance_km  numeric(8, 1) not null default 0,
  duration_min int not null default 0,
  source       text not null default 'manual' check (source in ('manual', 'gps')),
  path         jsonb, -- tracé GPS [[lat, lng], ...]
  created_at   timestamptz not null default now()
);

-- Purge RGPD : trajets conservés 12 mois maximum (à planifier via pg_cron).
-- select cron.schedule('purge-trips', '0 3 * * *',
--   $$delete from trips where created_at < now() - interval '12 months'$$);

-- ---------------------------------------------------------------------------
-- Sécurité au niveau des lignes (RLS)
-- ---------------------------------------------------------------------------
alter table profiles    enable row level security;
alter table vehicles    enable row level security;
alter table fines       enable row level security;
alter table maintenance enable row level security;
alter table trips       enable row level security;

create or replace function is_employer() returns boolean
language sql security definer stable as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'employer');
$$;

-- profiles
create policy "profiles: self read"     on profiles for select using (id = auth.uid() or is_employer());
create policy "profiles: employer write" on profiles for all    using (is_employer()) with check (is_employer());

-- vehicles : employeur tout, conducteur lit le sien
create policy "vehicles: employer all"  on vehicles for all    using (is_employer()) with check (is_employer());
create policy "vehicles: driver read"   on vehicles for select using (driver_id = auth.uid());

-- fines : employeur tout, conducteur lit les siennes
create policy "fines: employer all"     on fines for all    using (is_employer()) with check (is_employer());
create policy "fines: driver read"      on fines for select using (driver_id = auth.uid());

-- maintenance : employeur tout, conducteur lit celle de son véhicule
create policy "maint: employer all"     on maintenance for all using (is_employer()) with check (is_employer());
create policy "maint: driver read"      on maintenance for select using (
  exists (select 1 from vehicles v where v.id = maintenance.vehicle_id and v.driver_id = auth.uid())
);

-- trips : employeur tout, conducteur lit et crée les siens (tracker GPS)
create policy "trips: employer all"     on trips for all    using (is_employer()) with check (is_employer());
create policy "trips: driver read"      on trips for select using (driver_id = auth.uid());
create policy "trips: driver insert"    on trips for insert with check (driver_id = auth.uid());
