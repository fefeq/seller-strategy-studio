-- Call notes in five lines (what hurts, what not solving it costs, who decides and how, what holds them back,
-- the agreed next step), written right after the meeting, and the AI teardown of the call.
alter table public.meetings add column call_notes jsonb not null default '{}'::jsonb;
alter table public.meetings add column call_review text not null default '';
comment on column public.meetings.call_notes is 'Five-line call notes: {dolor, impacto, decision, freno, siguiente}';
comment on column public.meetings.call_review is 'AI teardown of the call (markdown)';
