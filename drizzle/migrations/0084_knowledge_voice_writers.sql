-- SDD-20261110-company-voice-and-escalation-rules (NK-0128, U-2): only the Owner and Sales Leaders write the «Voz» of the company.
-- Voice documents are team knowledge (section 'voice') that the drafts use as a mould (src/lib/knowledge-rules.ts: VOICE_SECTION,
-- canEditDoc). They are never rules, so a voice document cannot be marked mandatory by anyone. Same shape as 0081 but its own
-- policies: knowledge_doc_is_binding is NOT changed (it would change what «binding» means). Two RESTRICTIVE policies on top of the
-- permissive ones of 0002 (left untouched): USING checks the old row (edit, move out of voice), WITH CHECK the new one (create,
-- move in, mark). Any scope: a personal voice document is blocked for non-leaders too. Delete stays Owner only (0002).
-- service_role (admin client) bypasses RLS; no code path writes voice with it (Drive and the agent lists refuse the section).
-- No row changes. Safe to run twice. Never applied to a real database from the implementation branch: the coordinator applies it.
--
-- Rollback script (run by hand if needed; it only removes the two policies, no data is touched):
-- drop policy if exists "knowledge voice insert" on public.knowledge_docs;
-- drop policy if exists "knowledge voice update" on public.knowledge_docs;

-- The column exists in the live database (types.ts) but only in commented SQL in the repo (0022): a no-op there (as in 0081).
alter table public.knowledge_docs add column if not exists mandatory boolean not null default false;

drop policy if exists "knowledge voice insert" on public.knowledge_docs;
create policy "knowledge voice insert" on public.knowledge_docs as restrictive for insert to authenticated
  with check (section <> 'voice'
              or (mandatory is not true and (public.has_org_role(org_id, 'owner') or public.has_org_role(org_id, 'sales_leader'))));

drop policy if exists "knowledge voice update" on public.knowledge_docs;
create policy "knowledge voice update" on public.knowledge_docs as restrictive for update to authenticated
  using (section <> 'voice'
         or public.has_org_role(org_id, 'owner') or public.has_org_role(org_id, 'sales_leader'))
  with check (section <> 'voice'
              or (mandatory is not true and (public.has_org_role(org_id, 'owner') or public.has_org_role(org_id, 'sales_leader'))));
