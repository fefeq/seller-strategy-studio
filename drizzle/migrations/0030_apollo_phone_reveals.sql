-- Apollo: stakeholders keep the revealed mobile; phone_reveals is the per-company cache of
-- asynchronous phone deliveries (Apollo POSTs them to /api/public/apollo/phone-webhook).
alter table public.stakeholders add column if not exists phone text;

create table public.phone_reveals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references public.organizations(id) on delete cascade,
  apollo_person_id text not null check (length(apollo_person_id) between 1 and 64),
  stakeholder_id uuid references public.stakeholders(id) on delete set null,
  name text not null default '',
  status text not null default 'pending' check (status in ('pending', 'delivered', 'not_found')),
  phones jsonb not null default '[]'::jsonb,
  requested_by uuid default auth.uid(),
  requested_at timestamptz not null default now(),
  received_at timestamptz,
  constraint phone_reveals_unique unique (org_id, apollo_person_id)
);
create index phone_reveals_person on public.phone_reveals (apollo_person_id);
grant select, insert, update on public.phone_reveals to authenticated;
grant all on public.phone_reveals to service_role;
alter table public.phone_reveals enable row level security;
create policy "org read" on public.phone_reveals for select to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id));
create policy "org request" on public.phone_reveals for insert to authenticated
  with check (public.is_org_member(org_id));
create policy "org re-request" on public.phone_reveals for update to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id))
  with check (public.is_org_member(org_id));