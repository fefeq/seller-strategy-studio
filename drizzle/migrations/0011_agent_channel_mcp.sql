alter table public.agent_conversations drop constraint if exists agent_conversations_channel_check;
alter table public.agent_conversations add constraint agent_conversations_channel_check check (channel in ('app','telegram','mcp'));
alter table public.agent_pending_actions add column source text not null default 'agent';