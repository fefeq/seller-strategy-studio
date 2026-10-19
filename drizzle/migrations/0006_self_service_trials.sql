create table public.trials (
  id uuid primary key default gen_random_uuid(),
  org_id uuid default public.current_org() references public.organizations(id) on delete cascade,
  email text not null default '',
  company text not null default '',
  segment_id uuid references public.segments(id) on delete set null,
  source text not null default '',
  plan text not null default '',
  signed_up_at timestamptz not null default now(),
  activated_at timestamptz,
  converted_at timestamptz,
  mrr numeric check (mrr is null or mrr >= 0),
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint trials_activation_after_signup check (activated_at is null or activated_at >= signed_up_at),
  constraint trials_conversion_after_signup check (converted_at is null or converted_at >= signed_up_at)
);
grant select, insert, update, delete on public.trials to authenticated;
grant all on public.trials to service_role;
alter table public.trials enable row level security;
create index trials_org_signup_idx on public.trials (org_id, signed_up_at);
create unique index trials_org_email_uniq on public.trials (org_id, lower(email)) where email <> '';
create trigger trials_audit before insert or update on public.trials for each row execute function public.set_audit();
create policy "org read" on public.trials for select to authenticated using (org_id = public.current_org() and public.is_org_member(org_id));
create policy "org insert" on public.trials for insert to authenticated with check (public.is_org_member(org_id));
create policy "org update" on public.trials for update to authenticated using (org_id = public.current_org() and public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy "org delete owner" on public.trials for delete to authenticated using (org_id = public.current_org() and public.has_org_role(org_id, 'owner'));