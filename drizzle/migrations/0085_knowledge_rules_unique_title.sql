-- NK-0136 (SDD-20261110-company-voice-and-escalation-rules, base rules): a company cannot have two team rules with the same title.
-- «Añadir reglas base» reads the titles it lacks and then inserts them, which is not atomic: two sessions of the same company
-- can both read «nothing», and both insert the nine. The database refuses the second one (unique_violation, 23505); the core
-- (src/lib/default-rules.ts) reads again and adds only what is still missing. The batch insert is all or nothing, so the loser
-- writes nothing.
-- Scope of the index: team rules only (section 'rules', scope 'team'), by company and by lower(btrim(title)), the same
-- comparison the core makes. Personal documents and other sections may repeat a title; so may two different companies.
-- Side effect: the same refusal also reaches a person who writes or renames a team rule to a title the company already has; the
-- app shows it as «Ya existe un registro con esos datos…» (errorText).
-- Before it runs it checks the data: if a company already has two team rules with the same title it stops with a message (counts
-- only, never a title: they are the customer's text), creates nothing and changes no row. In that case the coordinator decides
-- between merging those rules by hand or an index limited to the nine base titles.
-- No row changes. Safe to run twice. Never applied to a real database from the implementation branch: the coordinator applies it.
--
-- Rollback script (run by hand if needed; it only removes the index, no data is touched):
-- drop index if exists public.knowledge_docs_team_rule_title_uniq;

do $$
declare dup integer;
begin
  select count(*) into dup from (
    select 1 from public.knowledge_docs
    where section = 'rules' and scope = 'team' and org_id is not null
    group by org_id, lower(btrim(title))
    having count(*) > 1
  ) d;
  if dup > 0 then
    raise exception 'Migration 0085 stopped: % group(s) of team rules share the same title inside a company (misma regla de equipo repetida). Resolve them first; no index was created and no row changed.', dup;
  end if;
end $$;

create unique index if not exists knowledge_docs_team_rule_title_uniq
  on public.knowledge_docs (org_id, lower(btrim(title)))
  where section = 'rules' and scope = 'team';
