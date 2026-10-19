create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid default public.current_org() references public.organizations(id) on delete cascade,
  title text not null,
  notes text not null default '',
  due_date date,
  done boolean not null default false,
  owner_id uuid,
  account_id uuid references public.accounts(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  source text not null default 'manual',
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.tasks to authenticated;
grant all on public.tasks to service_role;
alter table public.tasks enable row level security;
create trigger tasks_audit before insert or update on public.tasks for each row execute function public.set_audit();
create policy "org read" on public.tasks for select to authenticated using (org_id = public.current_org() and public.is_org_member(org_id));
create policy "org insert" on public.tasks for insert to authenticated with check (public.is_org_member(org_id));
create policy "org update" on public.tasks for update to authenticated using (org_id = public.current_org() and public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy "org delete owner" on public.tasks for delete to authenticated using (org_id = public.current_org() and public.has_org_role(org_id, 'owner'));

create table public.agent_conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  channel text not null default 'app' check (channel in ('app','telegram')),
  mode text not null default 'chat' check (mode in ('chat','interview')),
  title text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index agent_conversations_user_idx on public.agent_conversations (user_id, org_id, updated_at desc);
grant select, insert, update, delete on public.agent_conversations to authenticated;
grant all on public.agent_conversations to service_role;
alter table public.agent_conversations enable row level security;
create policy "own read" on public.agent_conversations for select to authenticated using (user_id = auth.uid() and public.is_org_member(org_id));
create policy "own insert" on public.agent_conversations for insert to authenticated with check (user_id = auth.uid() and public.is_org_member(org_id));
create policy "own update" on public.agent_conversations for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_org_member(org_id));
create policy "own delete" on public.agent_conversations for delete to authenticated using (user_id = auth.uid());

create table public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.agent_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null default '',
  created_at timestamptz not null default now()
);
create index agent_messages_conv_idx on public.agent_messages (conversation_id, created_at);
grant select, insert, delete on public.agent_messages to authenticated;
grant all on public.agent_messages to service_role;
alter table public.agent_messages enable row level security;
create policy "own read" on public.agent_messages for select to authenticated using (exists (select 1 from public.agent_conversations c where c.id = conversation_id and c.user_id = auth.uid()));
create policy "own insert" on public.agent_messages for insert to authenticated with check (exists (select 1 from public.agent_conversations c where c.id = conversation_id and c.user_id = auth.uid()));

create table public.agent_pending_actions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  conversation_id uuid references public.agent_conversations(id) on delete cascade,
  tool text not null,
  args jsonb not null default '{}'::jsonb,
  summary text not null default '',
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled','failed')),
  result text not null default '',
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index agent_pending_conv_idx on public.agent_pending_actions (conversation_id, created_at);
grant select, insert, update on public.agent_pending_actions to authenticated;
grant all on public.agent_pending_actions to service_role;
alter table public.agent_pending_actions enable row level security;
create policy "own read" on public.agent_pending_actions for select to authenticated using (user_id = auth.uid() and public.is_org_member(org_id));
create policy "own insert" on public.agent_pending_actions for insert to authenticated with check (user_id = auth.uid() and public.is_org_member(org_id));
create policy "own update" on public.agent_pending_actions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid,
  detector text not null,
  dedupe_key text not null,
  priority int not null default 2 check (priority between 1 and 3),
  title text not null,
  body text not null default '',
  link text,
  action jsonb,
  status text not null default 'pending' check (status in ('pending','approved','snoozed','dismissed','resolved')),
  snoozed_until timestamptz,
  notified_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (org_id, dedupe_key)
);
create index suggestions_org_status_idx on public.suggestions (org_id, status, priority);
grant select, insert, update on public.suggestions to authenticated;
grant all on public.suggestions to service_role;
alter table public.suggestions enable row level security;
create policy "org read" on public.suggestions for select to authenticated using (org_id = public.current_org() and public.is_org_member(org_id) and (user_id is null or user_id = auth.uid()));
create policy "org insert" on public.suggestions for insert to authenticated with check (public.is_org_member(org_id));
create policy "org update" on public.suggestions for update to authenticated using (org_id = public.current_org() and public.is_org_member(org_id) and (user_id is null or user_id = auth.uid())) with check (public.is_org_member(org_id));

create table public.channel_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  channel text not null default 'telegram' check (channel in ('telegram')),
  chat_id text,
  link_code text,
  code_expires_at timestamptz,
  linked_at timestamptz,
  daily_digest boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, channel)
);
create unique index channel_links_chat_uniq on public.channel_links (channel, chat_id) where chat_id is not null;
create unique index channel_links_code_uniq on public.channel_links (link_code) where link_code is not null;
grant select, insert, update, delete on public.channel_links to authenticated;
grant all on public.channel_links to service_role;
alter table public.channel_links enable row level security;
create policy "own all" on public.channel_links for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.telegram_updates (
  update_id bigint primary key,
  payload jsonb not null,
  processed_at timestamptz,
  error text,
  received_at timestamptz not null default now()
);
grant all on public.telegram_updates to service_role;
alter table public.telegram_updates enable row level security;

create table public.job_locks (
  name text primary key,
  locked_until timestamptz,
  last_run_at timestamptz,
  paused_reason text
);
grant all on public.job_locks to service_role;
alter table public.job_locks enable row level security;