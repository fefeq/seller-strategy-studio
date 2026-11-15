CREATE OR REPLACE FUNCTION public.reserve_intake_quota(_source uuid, _n integer, _today date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; used integer;
BEGIN
  SELECT id, max_per_request, daily_limit, day_count, day_date INTO s FROM public.lead_sources WHERE id = _source FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'status', 401, 'error', 'Clave no válida', 'pause', false); END IF;
  IF _n > s.max_per_request THEN
    RETURN jsonb_build_object('ok', false, 'status', 413, 'error', format('Máximo %s filas por envío', s.max_per_request), 'pause', false);
  END IF;
  used := CASE WHEN s.day_date = _today THEN s.day_count ELSE 0 END;
  IF used + _n > s.daily_limit THEN
    RETURN jsonb_build_object('ok', false, 'status', 429, 'error', format('Límite diario de %s filas superado: la conexión se ha pausado', s.daily_limit), 'pause', true);
  END IF;
  UPDATE public.lead_sources SET day_count = used + _n, day_date = _today WHERE id = _source;
  RETURN jsonb_build_object('ok', true, 'dayCount', used + _n, 'dayDate', _today);
END $$;

CREATE OR REPLACE FUNCTION public.bump_intake_received(_source uuid, _n integer)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.lead_sources SET received_count = received_count + _n, last_received_at = now() WHERE id = _source;
$$;

REVOKE ALL ON FUNCTION public.reserve_intake_quota(uuid, integer, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_intake_received(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_intake_quota(uuid, integer, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.bump_intake_received(uuid, integer) TO service_role;