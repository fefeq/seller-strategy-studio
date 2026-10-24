-- Lead intake enrichment (U-1). Nokko fills the empty sector, size and country of an account from
-- prioritized sources (person > provider > web). What a person typed is never overwritten; what
-- Nokko filled is marked «Automático» with its source and date, and the mark goes away as soon as
-- a person edits the value.

-- {field: {source, at}} for the fields Nokko filled. A field that is not here is manual (or empty).
alter table public.accounts add column auto_filled jsonb not null default '{}'::jsonb;
comment on column public.accounts.auto_filled is 'Fields filled by enrichment: {industry|size|country: {source, at}}; absent = manual';

-- A human edit of a filled field makes it manual: the mark is dropped unless the enrichment itself writes.
create or replace function public.accounts_clear_auto_filled()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('nokko.enriching', true), '') = 'on' then
    return new;
  end if;
  if new.industry is distinct from old.industry then new.auto_filled := new.auto_filled - 'industry'; end if;
  if new.size is distinct from old.size then new.auto_filled := new.auto_filled - 'size'; end if;
  if new.country is distinct from old.country then new.auto_filled := new.auto_filled - 'country'; end if;
  return new;
end $$;
create trigger accounts_clear_auto_filled before update on public.accounts
  for each row execute function public.accounts_clear_auto_filled();

-- One row per enrichment attempt: what was tried, which source answered, what was filled and what it used.
create table public.account_enrichments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references public.organizations(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed', 'skipped')),
  source text,
  fields jsonb not null default '{}'::jsonb,
  -- Units consumed by the source (pages read, tokens…). The price per unit is not stored: cost_usd stays
  -- null until a source with a known price is connected.
  usage jsonb not null default '{}'::jsonb,
  cost_usd numeric,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
comment on table public.account_enrichments is 'Enrichment attempts per account: status, source, fields filled, usage and cost';
create index account_enrichments_org on public.account_enrichments (org_id, created_at desc);
create index account_enrichments_account on public.account_enrichments (account_id, created_at desc);
create index account_enrichments_open on public.account_enrichments (created_at) where status in ('pending', 'running');

grant select on public.account_enrichments to authenticated;
grant all on public.account_enrichments to service_role;
alter table public.account_enrichments enable row level security;
-- Cost is for the people who run the company's sales.
create policy "leaders read" on public.account_enrichments for select to authenticated
  using (org_id = public.current_org() and (public.has_org_role(org_id, 'owner') or public.has_org_role(org_id, 'sales_leader')));

-- Writes the enrichment result. _patch = {industry?, size?, country?}. A field is written only if it is
-- empty or was filled by enrichment before; a manual value is never touched. Returns the fields written.
create or replace function public.apply_account_enrichment(_account uuid, _org uuid, _patch jsonb, _source text, _at timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a public.accounts%rowtype;
  written jsonb := '{}'::jsonb;
  f text;
  v text;
begin
  select * into a from public.accounts where id = _account and org_id = _org for update;
  if not found then return written; end if;
  perform set_config('nokko.enriching', 'on', true);
  foreach f in array array['industry', 'size', 'country'] loop
    v := nullif(btrim(_patch ->> f), '');
    if v is null then continue; end if;
    if f = 'industry' and (a.industry is null or a.industry = '' or a.auto_filled ? 'industry') then
      update public.accounts set industry = v where id = _account;
    elsif f = 'size' and (a.size is null or a.size = '' or a.auto_filled ? 'size') then
      update public.accounts set size = v where id = _account;
    elsif f = 'country' and (a.country is null or a.country = '' or a.auto_filled ? 'country') then
      update public.accounts set country = v where id = _account;
    else
      continue;
    end if;
    update public.accounts set auto_filled = auto_filled || jsonb_build_object(f, jsonb_build_object('source', _source, 'at', _at)) where id = _account;
    written := written || jsonb_build_object(f, v);
  end loop;
  perform set_config('nokko.enriching', 'off', true);
  return written;
end $$;
revoke all on function public.apply_account_enrichment(uuid, uuid, jsonb, text, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_account_enrichment(uuid, uuid, jsonb, text, timestamptz) to service_role;
