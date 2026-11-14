CREATE TABLE public.platform_legal_flags (
  key text PRIMARY KEY,
  paused boolean NOT NULL DEFAULT true,
  reason text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_legal_flags TO authenticated;
GRANT ALL ON public.platform_legal_flags TO service_role;
ALTER TABLE public.platform_legal_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY platform_legal_flags_read ON public.platform_legal_flags FOR SELECT TO authenticated USING (true);

INSERT INTO public.platform_legal_flags (key, paused, reason) VALUES (
  'linkedin_extraction',
  true,
  'Pausa legal: extracción robotizada de LinkedIn pendiente de revisión legal. Las reseñas de G2 no están pausadas y las fuentes de LinkedIn ya guardadas se conservan.'
);

CREATE OR REPLACE FUNCTION public.set_platform_legal_flag(_key text, _paused boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Solo un superadmin puede cambiar el estado legal de las integraciones.';
  END IF;
  UPDATE public.platform_legal_flags
  SET paused = _paused, updated_by = auth.uid(), updated_at = now()
  WHERE key = _key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Estado legal desconocido: %', _key;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.set_platform_legal_flag(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_platform_legal_flag(text, boolean) TO authenticated;