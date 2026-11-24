-- B4: automatic release (US-9, FR-12) and arrival emails (US-6, FR-9).

-- When a withdrawal's money went out (released or approved early), and
-- whether the owner was emailed about it.
alter table public.withdrawal_alerts
  add column arrived_at timestamptz,
  add column arrival_emailed_at timestamptz;

-- The backend's own Solana wallet, which pays the fee to release withdrawals
-- (anyone may release once the wait ends; the program only pays the named
-- recipient). Its key is a random 32-byte seed generated here, inside
-- Supabase Vault, so it is never copied anywhere. Fund its address (shown
-- in sync-events' response) with a little devnet SOL.
select vault.create_secret(
  encode(extensions.gen_random_bytes(32), 'hex'),
  'pause_releaser_seed'
)
where not exists (
  select 1 from vault.secrets where name = 'pause_releaser_seed'
);

create function public.get_releaser_seed()
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets
  where name = 'pause_releaser_seed';
$$;
revoke execute on function public.get_releaser_seed() from public, anon, authenticated;
grant execute on function public.get_releaser_seed() to service_role;
