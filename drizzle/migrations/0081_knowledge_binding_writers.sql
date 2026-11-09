-- SDD-20261109-rules-write-permissions (NK-0095, U-1): only the Owner and Sales Leaders write binding knowledge documents.
-- A binding document is a team document of the Reglas section or marked mandatory: the agent of the whole team reads it as a rule
-- (src/lib/knowledge-rules.ts, isBindingDoc mirrors knowledge_doc_is_binding). Two RESTRICTIVE policies are added on top of the
-- permissive ones of 0002 (left untouched): USING checks the old row (edit or unmark a binding document), WITH CHECK the new one
-- (create, mark, move to rules, share a personal one with the team). Delete stays Owner only (0002).
-- service_role (admin client: background jobs, Telegram) bypasses RLS: the code repeats the rule (importToKnowledge, authorize,
-- drive_import_to_knowledge). No row changes. Safe to run twice. Never applied to a real database from the implementation branch.

-- The column exists in the live database (types.ts) but only in commented SQL in the repo (0022): a no-op there.
alter table public.knowledge_docs add column if not exists mandatory boolean not null default false;

create or replace function public.knowledge_doc_is_binding(_section text, _scope text, _mandatory boolean)
returns boolean language sql immutable set search_path = public as $$
  select _scope = 'team' and (_section = 'rules' or coalesce(_mandatory, false))
$$;
revoke all on function public.knowledge_doc_is_binding(text, text, boolean) from public, anon;
grant execute on function public.knowledge_doc_is_binding(text, text, boolean) to authenticated, service_role;

drop policy if exists "knowledge binding insert" on public.knowledge_docs;
create policy "knowledge binding insert" on public.knowledge_docs as restrictive for insert to authenticated
  with check (not public.knowledge_doc_is_binding(section, scope, mandatory)
              or public.has_org_role(org_id, 'owner') or public.has_org_role(org_id, 'sales_leader'));

drop policy if exists "knowledge binding update" on public.knowledge_docs;
create policy "knowledge binding update" on public.knowledge_docs as restrictive for update to authenticated
  using (not public.knowledge_doc_is_binding(section, scope, mandatory)
         or public.has_org_role(org_id, 'owner') or public.has_org_role(org_id, 'sales_leader'))
  with check (not public.knowledge_doc_is_binding(section, scope, mandatory)
              or public.has_org_role(org_id, 'owner') or public.has_org_role(org_id, 'sales_leader'));
