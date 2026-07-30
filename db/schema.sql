-- Schéma Postgres pour la bascule depuis localStorage.
--
-- Non utilisé aujourd'hui : l'application tourne sur l'adaptateur `local`.
-- Ce fichier existe pour que le passage à une base soit un exercice de plomberie
-- et non de conception. Chaque méthode de `Repository` (lib/storage/types.ts) se
-- traduit ici en une requête, indiquée en commentaire.
--
-- Le modèle suit la même logique que le moteur : le journal d'évènements est la
-- source de vérité, aucun total n'est stocké. On garde `events` en `jsonb` parce
-- qu'une partie fait quelques centaines d'octets et qu'on la lit toujours en entier ;
-- si un jour on veut requêter les tours (statistiques inter-parties), les éclater
-- dans une table `turns` sera une migration additive.

create extension if not exists "pgcrypto";

-- Un propriétaire = un appareil ou un compte. Sans authentification aujourd'hui,
-- on peut y mettre un identifiant d'appareil tiré une fois côté client.
create table if not exists owners (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now()
);

-- Le roster : les joueurs habituels, indépendants des parties.
--   listPlayers   → select … from players where owner_id = $1 order by created_at
--   upsertPlayer  → insert … on conflict (id) do update set …
--   deletePlayer  → delete from players where id = $1 and owner_id = $2
create table if not exists players (
  id           uuid primary key,
  owner_id     uuid not null references owners (id) on delete cascade,
  name         text not null check (length(trim(name)) between 1 and 40),
  emoji        text not null,
  color_index  smallint not null check (color_index >= 0),
  created_at   timestamptz not null default now()
);

create index if not exists players_owner_idx on players (owner_id, created_at);

-- Les parties. `finished_at is null` identifie la partie en cours.
--   loadGame   → select … from games where owner_id = $1 and finished_at is null limit 1
--   saveGame   → insert … on conflict (id) do update set events = $2, revision = games.revision + 1
--   deleteGame → delete from games where id = $1 and owner_id = $2
create table if not exists games (
  id               uuid primary key,
  owner_id         uuid not null references owners (id) on delete cascade,
  -- Ordre de jeu figé, sérialisé tel quel : les joueurs d'une partie sont un
  -- instantané du roster (renommer quelqu'un ne doit pas réécrire l'historique).
  players          jsonb not null,
  first_player_id  uuid not null,
  events           jsonb not null default '[]'::jsonb,
  -- Concurrence optimiste, pour le jour où plusieurs téléphones écrivent la même
  -- partie : le client renvoie la révision lue, l'UPDATE échoue si elle a bougé.
  revision         integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  finished_at      timestamptz
);

-- Une seule partie en cours par propriétaire — la règle métier de SPEC.md §5,
-- garantie par la base et non par le client.
create unique index if not exists games_one_active_per_owner
  on games (owner_id)
  where finished_at is null;

--   loadSettings / saveSettings → select / upsert sur la clé du propriétaire
create table if not exists settings (
  owner_id   uuid primary key references owners (id) on delete cascade,
  sound      boolean not null default false,
  vibration  boolean not null default true,
  updated_at timestamptz not null default now()
);
