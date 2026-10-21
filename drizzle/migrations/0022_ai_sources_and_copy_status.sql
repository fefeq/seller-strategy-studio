-- Knowledge docs the agents must follow in every deliverable (the Reglas section always counts as such).
alter table public.knowledge_docs add column mandatory boolean not null default false;
comment on column public.knowledge_docs.mandatory is 'Always loaded into GTM cycle drafts and listed as a source; the rules section is mandatory regardless';
-- Per-piece status of public-facing copy in positioning (tagline, pitches): { "<field>": { "status": "approved", "by": uuid, "at": ts } }.
-- A piece without an entry is an internal draft.
alter table public.positioning add column copy_status jsonb not null default '{}'::jsonb;
comment on column public.positioning.copy_status is 'Approval of public-facing copy per field; missing = internal draft';
