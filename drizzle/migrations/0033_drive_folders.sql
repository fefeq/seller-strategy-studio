-- Google Drive: one folder per company (created by Nokko inside "Nokko" in the connected Drive) and an
-- optional folder per account (created by Nokko or linked from inside the company folder). Only server
-- code writes these rows, after checking the folder sits inside the company's folder; members read them.
create table public.drive_folders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete cascade,
  folder_id text not null check (folder_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  name text not null default '',
  created_by_app boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now()
);
create unique index drive_folders_org_root on public.drive_folders (org_id) where account_id is null;
create unique index drive_folders_account on public.drive_folders (org_id, account_id) where account_id is not null;
grant select on public.drive_folders to authenticated;
grant all on public.drive_folders to service_role;
alter table public.drive_folders enable row level security;
create policy "org read" on public.drive_folders for select to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id));