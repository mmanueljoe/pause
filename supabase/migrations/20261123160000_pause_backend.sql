-- Pause backend: data that must never go on Solana (names, emails, time
-- zones) plus bookkeeping for alerts and automatic release.
-- docs/requirements.md: FR-4, FR-13, FR-16, FR-17, Alert levels, Privacy.
--
-- Every table has row-level security ON and NO policies, so the public
-- (anon) key the website uses can't read or write anything. Only Edge
-- Functions, using the service role, can, after checking a wallet signature.

-- One row per vault: details the owner chose to give us.
create table public.vault_profiles (
  vault text primary key,
  owner text not null,
  guardian_name text check (char_length(guardian_name) between 1 and 40),
  owner_email text check (owner_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  owner_time_zone text check (char_length(owner_time_zone) between 1 and 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Invite links (FR-13): work once, expire after 7 days. Only a hash of the
-- code is stored, so a database leak can't be used to accept invites.
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  vault text not null references public.vault_profiles (vault) on delete cascade,
  guardian text not null,
  code_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index invites_vault_idx on public.invites (vault);

-- Guardians who accepted an invite, and where to email them.
create table public.guardian_contacts (
  vault text not null references public.vault_profiles (vault) on delete cascade,
  guardian text not null,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  accepted_at timestamptz not null default now(),
  primary key (vault, guardian)
);

-- One row per withdrawal the backend has seen: its alert level and reasons
-- (shown in the app as "Why this looks urgent"), and which emails went out.
create table public.withdrawal_alerts (
  withdrawal text primary key,
  vault text not null,
  withdrawal_id bigint not null,
  recipient text not null,
  amount_lamports bigint not null check (amount_lamports > 0),
  requested_at timestamptz not null,
  release_at timestamptz not null,
  level text not null check (level in ('urgent', 'quiet')),
  reasons jsonb not null default '[]'::jsonb,
  status text not null default 'waiting'
    check (status in ('waiting', 'stopped', 'released', 'approved_early')),
  guardian_alerted_at timestamptz,
  owner_alerted_at timestamptz,
  request_signature text not null,
  created_at timestamptz not null default now()
);
create index withdrawal_alerts_vault_idx on public.withdrawal_alerts (vault);
create index withdrawal_alerts_due_idx on public.withdrawal_alerts (release_at)
  where status = 'waiting';

-- Addresses a vault has actually paid (released or approved). Anything else
-- is a "New address". A request alone never adds one.
create table public.paid_addresses (
  vault text not null,
  address text not null,
  first_paid_at timestamptz not null default now(),
  primary key (vault, address)
);

-- Where the event reader got to, so no Solana transaction is read twice.
create table public.sync_state (
  id smallint primary key default 1 check (id = 1),
  last_signature text,
  updated_at timestamptz not null default now()
);
insert into public.sync_state (id) values (1);

-- Wallet-signed messages already used, so one can't be replayed.
create table public.used_signatures (
  signature text primary key,
  used_at timestamptz not null default now()
);

alter table public.vault_profiles enable row level security;
alter table public.invites enable row level security;
alter table public.guardian_contacts enable row level security;
alter table public.withdrawal_alerts enable row level security;
alter table public.paid_addresses enable row level security;
alter table public.sync_state enable row level security;
alter table public.used_signatures enable row level security;
