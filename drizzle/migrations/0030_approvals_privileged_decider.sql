-- Approvals decided from Telegram (and other server paths with the privileged client).
-- guard_approval checked the decider with auth.uid(), which is null there, so every decision from
-- Telegram failed, even the Owner's. With a signed-in user nothing changes: the role is checked and
-- decided_by is that user. Without one, the decider must come in decided_by and hold a deciding role
-- (owner, sales_leader, deal_desk) in the approval's company; otherwise the change is refused.
create or replace function public.guard_approval()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status <> old.status then
    if auth.uid() is not null then
      if not (public.has_org_role(new.org_id,'owner') or public.has_org_role(new.org_id,'sales_leader') or public.has_org_role(new.org_id,'deal_desk')) then
        raise exception 'Solo owner, sales leader o deal desk pueden decidir aprobaciones';
      end if;
      new.decided_by := auth.uid();
    elsif new.decided_by is null or not exists (
      select 1 from public.org_members m
      where m.org_id = new.org_id and m.user_id = new.decided_by and m.role in ('owner', 'sales_leader', 'deal_desk')
    ) then
      raise exception 'Solo owner, sales leader o deal desk pueden decidir aprobaciones';
    end if;
  end if;
  return new;
end $$;
