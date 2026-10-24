ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS archived_at timestamptz;
COMMENT ON COLUMN public.organizations.archived_at IS 'Archived by its owner: hidden from the switcher and skipped by automatic work; restorable.';

CREATE OR REPLACE FUNCTION public.create_organization_full(_name text, _segments text DEFAULT 'empty', _website text DEFAULT NULL, _currency text DEFAULT 'EUR')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare o uuid;
begin
  if _currency !~ '^[A-Z]{3}$' then raise exception 'Moneda no válida'; end if;
  o := public.create_organization(_name, _segments);
  update public.organizations set currency = _currency, website = nullif(left(trim(coalesce(_website, '')), 300), '') where id = o;
  return o;
end $$;
REVOKE ALL ON FUNCTION public.create_organization_full(text, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_organization_full(text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.archive_organization(_org uuid, _archived boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  if not public.has_org_role(_org, 'owner') then raise exception 'Solo el Owner puede archivar la empresa'; end if;
  update public.organizations set archived_at = case when _archived then now() else null end where id = _org;
  if _archived then
    update public.profiles p set current_org_id = (select m.org_id from public.org_members m join public.organizations x on x.id = m.org_id where m.user_id = p.id and m.org_id <> _org and x.archived_at is null order by x.created_at desc limit 1)
    where p.current_org_id = _org;
  end if;
end $$;
REVOKE ALL ON FUNCTION public.archive_organization(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.archive_organization(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_organization(_org uuid, _confirm_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare n text;
begin
  if not public.has_org_role(_org, 'owner') then raise exception 'Solo el Owner puede borrar la empresa'; end if;
  select name into n from public.organizations where id = _org;
  if n is null or trim(_confirm_name) <> n then raise exception 'El nombre no coincide: escribe el nombre exacto de la empresa'; end if;
  update public.profiles p set current_org_id = (select m.org_id from public.org_members m join public.organizations x on x.id = m.org_id where m.user_id = p.id and m.org_id <> _org and x.archived_at is null order by x.created_at desc limit 1)
  where p.current_org_id = _org;
  delete from public.organizations where id = _org;
end $$;
REVOKE ALL ON FUNCTION public.delete_organization(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_organization(uuid, text) TO authenticated;