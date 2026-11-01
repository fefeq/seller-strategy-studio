-- Superadmin: people who see and manage every company. They are made Owner of every company
-- (existing and future), so every screen, rule and server check treats them as Owner without special cases.
CREATE TABLE public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform admins read own" ON public.platform_admins FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_platform_admin(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ select exists (select 1 from public.platform_admins where user_id = _user) $$;

-- Every new company gets each superadmin as Owner.
CREATE OR REPLACE FUNCTION public.organizations_add_platform_admins()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
begin
  insert into public.org_members (org_id, user_id, role)
    select new.id, a.user_id, 'owner' from public.platform_admins a
    on conflict (org_id, user_id) do update set role = 'owner';
  return new;
end $$;
CREATE TRIGGER organizations_add_platform_admins AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.organizations_add_platform_admins();

-- A new superadmin becomes Owner of every existing company.
CREATE OR REPLACE FUNCTION public.platform_admins_join_all()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
begin
  insert into public.org_members (org_id, user_id, role)
    select o.id, new.user_id, 'owner' from public.organizations o
    on conflict (org_id, user_id) do update set role = 'owner';
  return new;
end $$;
CREATE TRIGGER platform_admins_join_all AFTER INSERT ON public.platform_admins
  FOR EACH ROW EXECUTE FUNCTION public.platform_admins_join_all();

-- A company Owner cannot remove or demote a superadmin; deleting the whole company still works.
CREATE OR REPLACE FUNCTION public.org_members_protect_platform_admins()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
begin
  if public.is_platform_admin(old.user_id)
     and exists (select 1 from public.organizations where id = old.org_id)
     and (tg_op = 'DELETE' or new.role <> 'owner' or new.org_id <> old.org_id or new.user_id <> old.user_id) then
    raise exception 'El superadmin no se puede quitar ni cambiar de rol';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
CREATE TRIGGER org_members_protect_platform_admins BEFORE UPDATE OR DELETE ON public.org_members
  FOR EACH ROW EXECUTE FUNCTION public.org_members_protect_platform_admins();

INSERT INTO public.platform_admins (user_id)
  SELECT p.id FROM public.profiles p WHERE lower(p.email) = 'cosentinofede@gmail.com'
  ON CONFLICT DO NOTHING;