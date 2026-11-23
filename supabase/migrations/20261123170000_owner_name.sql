-- The owner's first name, for invites and alerts ("Ama asked you to be
-- their guardian"). Stored only here, never on Solana.
alter table public.vault_profiles
  add column owner_name text check (char_length(owner_name) between 1 and 40);
