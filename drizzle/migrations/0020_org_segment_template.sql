-- New companies choose whether to start from the ACV segment template (SMB, Mid-market, Enterprise,
-- Strategic) or from no segments. The old one-argument signature is dropped so calls with only _name
-- resolve to this one (its default keeps the old behaviour).
drop function if exists public.create_organization(text);

create function public.create_organization(_name text, _segments text default 'template')
returns uuid language plpgsql security definer set search_path = public as $$
declare o uuid; u uuid := auth.uid();
begin
  if u is null then raise exception 'No autenticado'; end if;
  if coalesce(trim(_name), '') = '' then raise exception 'Nombre requerido'; end if;
  if _segments not in ('template', 'empty') then raise exception 'Plantilla de segmentos no válida'; end if;
  insert into public.organizations (name, created_by) values (trim(_name), u) returning id into o;
  insert into public.org_members (org_id, user_id, role) values (o, u, 'owner');
  update public.profiles set current_org_id = o where id = u;

  -- The ACV template only when asked for: a company that sells below 5K a year would otherwise start
  -- with Enterprise and Strategic segments it can't delete from its numbers.
  if _segments = 'template' then
    insert into public.segments (org_id, name, acv_min, acv_max, motion, cycle_days, sdr_per_ae, ae_per_se, cac_target, payback_months) values
      (o, 'SMB', 0, 5000, 'plg', 14, null, null, 500, 6),
      (o, 'Mid-market', 5000, 50000, 'inside', 60, 2.5, null, 15000, 12),
      (o, 'Enterprise', 50000, 250000, 'field', 135, 2, 2.5, 100000, 24),
      (o, 'Strategic', 250000, null, 'strategic', 270, 2, 2, null, null);
  end if;
  insert into public.positioning (org_id) values (o);
  insert into public.integrations (org_id, category, name, purpose) values
    (o,'Conocimiento','GitHub','Repositorio del cerebro GTM'),
    (o,'Llamadas','Fireflies','Transcripciones de llamadas'),
    (o,'Llamadas','Gong','Inteligencia conversacional'),
    (o,'CRM','Attio','CRM de personas con intención'),
    (o,'CRM','HubSpot','CRM alternativo'),
    (o,'Comunicación','Slack','Aprobaciones y alertas'),
    (o,'Email y calendario','Gmail','Emails y seguimiento'),
    (o,'Email y calendario','Google Calendar','Reuniones del Meeting Planner'),
    (o,'Enriquecimiento','Apollo','Datos de contacto'),
    (o,'Enriquecimiento','Clay','Enriquecimiento y research'),
    (o,'Enriquecimiento','LinkedIn Sales Navigator','Research de stakeholders'),
    (o,'Secuencias','Instantly','Secuencias de cold email'),
    (o,'Secuencias','Lemlist','Secuencias multicanal'),
    (o,'Firma y propuestas','DocuSign','Firma de contratos'),
    (o,'Firma y propuestas','PandaDoc','Propuestas');
  insert into public.knowledge_docs (org_id, section, title, body) values
    (o,'company','ICP','Describe aquí tu cliente ideal: industria, tamaño, cargo comprador, disparadores de compra.'),
    (o,'playbooks','Discovery', E'1. Contexto\n2. Dolor\n3. Impacto\n4. Proceso de decisión\n5. Próximos pasos'),
    (o,'methodology','MEDDPICC','Metrics, Economic buyer, Decision criteria, Decision process, Paper process, Identify pain, Champion, Competition'),
    (o,'rules','Aprobación humana','Ningún agente envía propuestas, cambia precios ni mueve deals a "Ganado" sin aprobación de una persona.');
  return o;
end $$;
revoke all on function public.create_organization(text, text) from public, anon;
grant execute on function public.create_organization(text, text) to authenticated;
