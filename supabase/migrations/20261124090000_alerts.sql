-- B3b: alert emails (FR-16, FR-17, US-12, US-13).
-- The sync-events function reads Pause events from Solana every minute,
-- fills withdrawal_alerts / change_alerts, and sends the emails.

-- Less-safe setting changes (always urgent). One row per proposal; the
-- *_alerted_at columns make sure each email goes out once.
create table public.change_alerts (
  signature text primary key,
  vault text not null,
  kind jsonb not null,
  proposed_at timestamptz not null,
  apply_after timestamptz not null,
  -- The guardian at the time of the proposal (null when adding the first one).
  guardian text,
  status text not null default 'waiting'
    check (status in ('waiting', 'applied', 'cancelled')),
  guardian_alerted_at timestamptz,
  owner_alerted_at timestamptz,
  created_at timestamptz not null default now()
);
create index change_alerts_vault_idx on public.change_alerts (vault);
alter table public.change_alerts enable row level security;

-- Which guardian a withdrawal alert is for (the vault's guardian when it was
-- requested), so a later guardian change doesn't redirect old alerts.
alter table public.withdrawal_alerts add column guardian text;

-- Every minute, call sync-events. Two values live in Supabase Vault, set
-- once per project with vault.create_secret (never in git):
--   pause_functions_url  e.g. https://<project>.supabase.co/functions/v1
--   pause_cron_secret    random; generated in the database, e.g.
--     select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'),
--                                'pause_cron_secret');
-- The function checks the secret with check_cron_secret below, so it never
-- has to be copied anywhere.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create function public.check_cron_secret(candidate text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'pause_cron_secret' and decrypted_secret = candidate
  );
$$;
revoke execute on function public.check_cron_secret(text) from public, anon, authenticated;
grant execute on function public.check_cron_secret(text) to service_role;

select cron.schedule(
  'pause-sync-events',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets
            where name = 'pause_functions_url') || '/sync-events',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets
                        where name = 'pause_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);
