-- Stripe as the source of truth for paying customers, MRR and churn. Each company pastes a restricted,
-- read-only key; it is kept encrypted in Supabase Vault and only the server (service role) can read it
-- back. The browser sees the connection status and the last four characters, never the key.

create table public.stripe_connections (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  vault_secret_id uuid not null,
  key_hint text not null,
  livemode boolean not null,
  restricted boolean not null,
  account_name text,
  status text not null default 'pending' check (status in ('pending', 'ok', 'error')),
  last_error text,
  last_synced_at timestamptz,
  connected_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
comment on table public.stripe_connections is 'One Stripe account per company; the key itself lives in vault.secrets';
-- Every column but the Vault id: the browser has no use for it.
grant select (org_id, key_hint, livemode, restricted, account_name, status, last_error, last_synced_at, connected_by, created_at) on public.stripe_connections to authenticated;
grant all on public.stripe_connections to service_role;
alter table public.stripe_connections enable row level security;
create policy "org read" on public.stripe_connections for select to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id));

-- What each sync read, so Métricas and the agent show the figures with their date.
create table public.stripe_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  taken_at timestamptz not null default now(),
  currency text not null,
  mrr numeric not null,
  active_customers integer not null,
  trialing integer not null default 0,
  new_customers integer not null default 0,
  new_mrr numeric not null default 0,
  churned_customers integer not null default 0,
  churned_mrr numeric not null default 0,
  logo_churn_pct numeric,
  revenue_churn_pct numeric,
  window_days integer not null default 30,
  details jsonb not null default '{}'::jsonb
);
create index stripe_snapshots_org_taken on public.stripe_snapshots (org_id, taken_at desc);
grant select on public.stripe_snapshots to authenticated;
grant all on public.stripe_snapshots to service_role;
alter table public.stripe_snapshots enable row level security;
create policy "org read" on public.stripe_snapshots for select to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id));

-- The Owner connects or replaces the key of the current company.
create or replace function public.set_stripe_key(_key text)
returns void language plpgsql security definer set search_path = public, vault as $$
declare o uuid := public.current_org(); existing uuid; k text := trim(_key);
begin
  if o is null or not public.has_org_role(o, 'owner') then
    raise exception 'Solo el Owner puede conectar Stripe.' using errcode = '42501';
  end if;
  if k !~ '^(rk|sk)_(live|test)_[A-Za-z0-9]{10,}$' then
    raise exception 'Esa no parece una clave de Stripe. Copia la clave restringida completa: empieza por rk_live_.' using errcode = '22023';
  end if;
  select vault_secret_id into existing from public.stripe_connections where org_id = o;
  if existing is not null then
    perform vault.update_secret(existing, k);
    update public.stripe_connections set key_hint = right(k, 4), livemode = k like '%\_live\_%', restricted = k like 'rk\_%',
      status = 'pending', last_error = null, connected_by = auth.uid() where org_id = o;
  else
    insert into public.stripe_connections (org_id, vault_secret_id, key_hint, livemode, restricted)
    values (o, vault.create_secret(k, 'stripe:' || o::text, 'Stripe key of organization ' || o::text), right(k, 4), k like '%\_live\_%', k like 'rk\_%');
  end if;
end $$;
revoke all on function public.set_stripe_key(text) from public, anon;
grant execute on function public.set_stripe_key(text) to authenticated;

-- The Owner disconnects: the key is deleted from Vault; past snapshots stay as history.
create or replace function public.remove_stripe_key()
returns void language plpgsql security definer set search_path = public, vault as $$
declare o uuid := public.current_org();
begin
  if o is null or not public.has_org_role(o, 'owner') then
    raise exception 'Solo el Owner puede desconectar Stripe.' using errcode = '42501';
  end if;
  -- stripe_connections_cleanup deletes the key from Vault.
  delete from public.stripe_connections where org_id = o;
end $$;
revoke all on function public.remove_stripe_key() from public, anon;
grant execute on function public.remove_stripe_key() to authenticated;

-- Only the server reads the key back, to call Stripe.
create or replace function public.stripe_key_for(_org uuid)
returns text language sql security definer set search_path = public, vault as $$
  select s.decrypted_secret from public.stripe_connections c join vault.decrypted_secrets s on s.id = c.vault_secret_id where c.org_id = _org;
$$;
revoke all on function public.stripe_key_for(uuid) from public, anon, authenticated;
grant execute on function public.stripe_key_for(uuid) to service_role;

-- A deleted company takes its key with it.
create or replace function public.stripe_connections_cleanup()
returns trigger language plpgsql security definer set search_path = public, vault as $$
begin
  delete from vault.secrets where id = old.vault_secret_id;
  return old;
end $$;
create trigger stripe_connections_cleanup after delete on public.stripe_connections
  for each row execute function public.stripe_connections_cleanup();
