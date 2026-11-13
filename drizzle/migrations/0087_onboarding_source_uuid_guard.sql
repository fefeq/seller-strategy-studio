-- F9: additive replacement; existing source policies and rows are unchanged.
-- Rollback: restore public.onboarding_source_path_ok(text,boolean) from migration 0086;
-- this restores the earlier permissive UUID pattern (including its malformed-input error).
CREATE OR REPLACE FUNCTION public.onboarding_source_path_ok(_name text, _own boolean)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE parts text[] := string_to_array(_name, '/');
BEGIN
  IF array_length(parts, 1) IS DISTINCT FROM 3 THEN RETURN false; END IF;
  IF parts[1] !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN RETURN false; END IF;
  IF parts[2] !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN RETURN false; END IF;
  IF NOT public.is_org_member(parts[1]::uuid) THEN RETURN false; END IF;
  IF _own AND parts[2] IS DISTINCT FROM auth.uid()::text THEN RETURN false; END IF;
  RETURN true;
END;
$$;