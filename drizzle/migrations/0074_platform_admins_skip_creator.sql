-- create_organization inserts the creator as Owner itself; skip them here so that insert does not collide.
CREATE OR REPLACE FUNCTION public.organizations_add_platform_admins()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
begin
  insert into public.org_members (org_id, user_id, role)
    select new.id, a.user_id, 'owner' from public.platform_admins a
    where a.user_id is distinct from new.created_by
    on conflict (org_id, user_id) do update set role = 'owner';
  return new;
end $$;