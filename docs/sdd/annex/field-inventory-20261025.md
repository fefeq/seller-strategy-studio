# Anexo — inventario de campos de la plataforma (generado el 2026-10-25)

Generado por script determinista (sin IA) a partir de `src/integrations/supabase/types.ts` en `main` @12de513. Es el punto de partida de la Unidad U-1 del SDD de definiciones universales; no es la definición final.

- Tablas: **84** · Columnas: **1043**

- Columnas de tipo libre (jsonb): **35** en 23 tablas

- Columnas tipo estado/etapa/tipo/rol/origen guardadas como texto libre (sin enum en el tipo generado): **48**


## 1. Conceptos con varias representaciones (clústeres)

Cada fila agrupa columnas que, por nombre, hablan del mismo concepto. «Tipos» muestra si el mismo concepto se guarda con tipos distintos. **La interpretación es de lectura de nombres: marcar [Por verificar] con Dani antes de decidir.**

| Concepto | Variantes (tabla.columna : tipo) | Nº variantes | Tipos distintos |
|---|---|---|---|
| Nombre de persona | leads.contact_name:string | null; people.full_name:string; profiles.full_name:string | 3 | 1 |
| Dominio / web | accounts.domain:string | null; organizations.website:string | null; product_usage.domain:string | 3 | 1 |
| Sector | accounts.industry:string | null; icp_profiles.industries:string | null | 2 | 1 |
| Tamaño de empresa | accounts.size:string | null; icp_profiles.company_size:string | null; icp_profiles.max_employees:number | null; icp_profiles.min_employees:number | null | 4 | 2 |
| País / geografía | account_assignment_rules.country:string | null; accounts.country:string | null; icp_profiles.countries:string[]; icp_profiles.geography:string | null | 4 | 2 |
| Importe | cac_costs.amount:number; deals.amount:number | null; finance_cost_lines.amount:number; finance_invoices.amount:number; leads.amount:number | null; quotas.amount:number; segment_budget_quarters.actual_revenue:number | null; segment_budget_quarters.plan_revenue:number | null; segment_budgets.actual_revenue:number | null; segment_budgets.plan_revenue:number | null; segment_targets.amount:number | 11 | 1 |
| Periodo | cac_costs.period:string; discoveries.week:string; quotas.period:string; segment_budget_quarters.period:string; segment_budgets.year:number; segment_targets.period:string | 6 | 2 |
| Etapa | deals.stage:string; email_templates.stage:string | null; icp_profiles.growth_stage:string | null; leads.stage:string; people.crm_stage:string | null; people.sequence_stage:string | null | 6 | 1 |
| Nivel / tier | accounts.abm_tier:string | null; accounts.tier:string | null; debates.level:string; people.tier:string | null; segments.priority:number | null; suggestions.priority:number | 6 | 2 |
| Origen / procedencia | account_signals.source:string; accounts.field_sources:Json; agent_pending_actions.source:string; deals.source:string | null; discoveries.source:string; drive_folders.created_by_app:boolean; leads.source:string | null; memories.source:string; people.source:string | null; tasks.source:string; trials.source:string | 11 | 3 |
| Competidores / alternativas | positioning.alternatives:string | null; positioning.competitive_alternative:string | null | 2 | 1 |
| Cliente objetivo | icp_profiles.anti_icp:string | null; icp_profiles.why_fit:string | null; positioning.best_customers:string | null; positioning.target_customer:string | null | 4 | 1 |
| Diferenciación | positioning.differentiation:string | null; positioning.differentiator:string | null | 2 | 1 |
| Valor / beneficio | positioning.key_benefit:string | null; positioning.value:string | null | 2 | 1 |

## 2. Columnas libres (jsonb) — datos sin esquema

| Tabla | Columnas jsonb |
|---|---|
| accounts | field_sources |
| agent_pending_actions | args |
| background_jobs | input, result |
| deal_offers | lines |
| deals | meddpicc |
| debates | synthesis, turns |
| discoveries | detail |
| finance_settings | plan_assumptions |
| forecast_snapshots | assumptions, summary |
| gtm_advisories | result |
| gtm_artifacts | meta |
| import_rows | raw, result |
| lead_settings | qualification, sla |
| leads | flow, qualification |
| meetings | call_notes |
| onboarding_sessions | block_status, diagnosis, findings, opinions, proposal, sources |
| phone_reveals | phones |
| positioning | copy_status |
| research_runs | input, result |
| stripe_snapshots | details |
| suggestions | action |
| telegram_updates | payload |
| u_journeys | answers |

## 3. Estado/etapa/tipo/rol/origen como texto libre

| Columna | Tablas |
|---|---|
| kind | account_signals, activities, approvals, background_jobs, deal_stages, discoveries, gtm_artifacts, import_batches, lead_sources, memories, notifications, research_runs, sensing_notes |
| motion | segments |
| role | agent_messages |
| source | account_signals, agent_pending_actions, deals, discoveries, leads, memories, people, tasks, trials |
| stage | deals, email_templates, leads |
| status | agent_pending_actions, approvals, background_jobs, case_clinics, deal_offers, deal_registrations, discoveries, gtm_artifacts, gtm_experiments, import_batches, import_rows, integrations, lead_events, partners, phone_reveals, posthog_connections, research_runs, stripe_connections, suggestions |
| tier | accounts, people |

## 4. Inventario completo por tabla

| Tabla | Nº columnas | Columnas |
|---|---|---|
| account_assignment_rules | 8 | country, created_at, id, members, org_id, position, region, segment_id |
| account_plans | 15 | account_id, action_plan, competitors, created_at, created_by, current_state, id, initiatives, objectives, org_id, pains, risks, updated_at, updated_by, whitespace |
| account_signals | 11 | account_id, found_at, id, kind, org_id, published_at, relevance, source, summary, title, url |
| account_touches | 10 | account_id, channel, created_at, created_by, id, notes, occurred_at, org_id, updated_at, updated_by |
| accounts | 22 | abm_tier, auto_researched_at, country, created_at, created_by, domain, field_sources, health, id, industry, is_target, linkedin_url, name, notes, org_id, owner_id, segment_id, signals_checked_at, size, tier, updated_at, updated_by |
| activities | 13 | account_id, body, created_at, created_by, deal_id, id, kind, occurred_at, org_id, person_id, subject, updated_at, updated_by |
| agent_conversations | 8 | channel, created_at, id, mode, org_id, title, updated_at, user_id |
| agent_messages | 5 | content, conversation_id, created_at, id, role |
| agent_pending_actions | 12 | args, conversation_id, created_at, decided_at, id, org_id, result, source, status, summary, tool, user_id |
| approvals | 11 | created_at, created_by, decided_by, evidence, id, kind, org_id, status, title, updated_at, updated_by |
| background_jobs | 16 | cancel_requested, created_at, error, finished_at, id, input, kind, label, org_id, result, retry_of, status, step, target_id, target_type, user_id |
| cac_costs | 10 | amount, channel, created_at, created_by, id, org_id, period, segment_id, updated_at, updated_by |
| calls | 12 | account_id, created_at, created_by, deal_id, id, next_steps, occurred_at, org_id, summary, title, updated_at, updated_by |
| campaign_results | 9 | campaign_id, created_at, created_by, id, org_id, person_id, result, updated_at, updated_by |
| campaigns | 11 | channel, copy, created_at, created_by, id, list_description, meetings_booked, name, org_id, updated_at, updated_by |
| case_clinics | 21 | case_giver, closing, coaches, created_at, created_by, deal_id, dialogue, edge, held_on, help_needed, id, mirror_feeling, mirror_gesture, mirror_image, next_steps, org_id, situation, status, title, updated_at, updated_by |
| channel_links | 9 | channel, chat_id, code_expires_at, created_at, daily_digest, id, link_code, linked_at, user_id |
| deal_lines | 12 | billing, created_at, created_by, deal_id, discount_pct, id, name, org_id, product_id, quantity, unit_cost, unit_price |
| deal_offers | 15 | created_at, created_by, deal_id, id, lines, notes, one_off_total, org_id, recurring_total, status, title, updated_at, updated_by, valid_until, version |
| deal_registrations | 13 | account_id, account_name, created_at, created_by, deal_id, expires_at, id, notes, org_id, partner_id, status, updated_at, updated_by |
| deal_stage_history | 7 | changed_at, changed_by, deal_id, from_stage, id, org_id, to_stage |
| deal_stages | 10 | board_group, color, created_at, id, key, kind, label, org_id, position, probability |
| deals | 25 | account_id, amount, close_date, closed_at, created_at, created_by, external_id, forecast_category, gross_margin, health, id, lead_source_id, meddpicc, name, one_off_amount, org_id, owner_id, partner_id, probability, segment_id, slip_count, source, stage, updated_at, updated_by |
| debates | 13 | created_at, created_by, id, level, org_id, participants, subject_id, subject_type, synthesis, topic, turns, updated_at, updated_by |
| discoveries | 15 | created_at, decided_at, decided_by, dedupe_key, detail, dismiss_reason, id, kind, name, org_id, reason, result_id, source, status, week |
| drive_doc_summaries | 8 | account_id, created_by, file_id, file_modified_at, id, org_id, summary, updated_at |
| drive_folders | 8 | account_id, created_at, created_by, created_by_app, folder_id, id, name, org_id |
| email_templates | 10 | body, created_at, created_by, id, name, org_id, stage, subject, updated_at, updated_by |
| finance_cost_lines | 13 | amount, category, created_at, created_by, ends_on, id, name, notes, org_id, segment_id, starts_on, updated_at, updated_by |
| finance_invoices | 14 | account_id, amount, created_at, created_by, deal_id, due_on, id, issued_on, notes, number, org_id, paid_on, updated_at, updated_by |
| finance_months | 12 | cash_end, closed_at, costs, created_at, created_by, id, month, notes, org_id, revenue, updated_at, updated_by |
| finance_settings | 12 | annual_discount_pct, cash_as_of, created_at, created_by, horizon_months, include_pipeline, opening_cash, org_id, plan_assumptions, scenario_spread_pct, updated_at, updated_by |
| forecast_snapshots | 9 | assumptions, created_at, created_by, id, month, org_id, summary, updated_at, updated_by |
| gtm_advisories | 9 | created_at, created_by, goal, horizon, id, org_id, result, updated_at, updated_by |
| gtm_artifacts | 15 | approved_at, approved_by, content, created_at, created_by, id, kind, meta, org_id, persona, status, title, updated_at, updated_by, version |
| gtm_experiments | 18 | audience, created_at, created_by, ends_on, hypothesis, id, journey_id, learning, metric, org_id, prototype, result, starts_on, status, target, title, updated_at, updated_by |
| icp_profiles | 25 | adoption, anti_icp, company_size, countries, created_at, created_by, funding_signals, geography, growth_stage, hiring_signals, id, industries, max_employees, min_employees, name, org_id, pains, search_keywords, segment_id, seniorities, target_titles, tech_stack, updated_at, updated_by, why_fit |
| import_batches | 15 | created_at, created_count, decided_at, decided_by, error_count, id, kind, lead_source_id, org_id, row_count, status, undone_at, undone_by, updated_at, updated_count |
| import_rows | 13 | action, applied_at, batch_id, created_at, error, id, line, org_id, raw, reason, result, status, summary |
| integration_usage | 8 | cost, created_at, id, need, org_id, service, trigger, user_id |
| integrations | 10 | category, created_at, created_by, id, name, org_id, purpose, status, updated_at, updated_by |
| job_locks | 4 | last_run_at, locked_until, name, paused_reason |
| knowledge_docs | 11 | body, created_at, created_by, id, mandatory, org_id, scope, section, title, updated_at, updated_by |
| lead_events | 11 | account_id, channel, deal_id, error, id, lead_id, lead_source_id, org_id, received_at, status, summary |
| lead_settings | 6 | auto_enrich, org_id, qualification, sla, updated_at, updated_by |
| lead_sources | 20 | active, created_at, created_by, daily_limit, day_count, day_date, default_stage, id, kind, last_received_at, max_per_request, mode, name, org_id, paused_reason, received_count, token_hash, token_hint, updated_at, updated_by |
| leads | 34 | account_id, amount, company, contact_name, contacted_at, created_at, created_by, deal_id, disqualified_at, disqualified_reason, email, enriched_at, external_id, flow, id, lead_source_id, mql_at, next_step, next_step_at, notes, opportunity_at, org_id, owner_id, person_id, qualification, qualified_at, segment_id, source, sql_at, stage, stage_entered_at, title, updated_at, updated_by |
| meetings | 26 | account_id, agenda, ai_brief, attendees, auto_prepped_at, call_notes, call_review, created_at, created_by, deal_id, desired_outcome, id, listening_coaching, listening_level, listening_reflection, materials, next_steps, notes, objections, objective, org_id, questions, scheduled_at, title, updated_at, updated_by |
| memories | 14 | account_id, active, content, created_at, id, kind, learned, org_id, pinned, scope, source, supersedes, updated_at, user_id |
| messaging_pillars | 11 | created_at, created_by, id, message, org_id, pain, position, proof, title, updated_at, updated_by |
| mutual_action_items | 11 | created_at, created_by, deal_id, done, due_date, id, org_id, owner_side, title, updated_at, updated_by |
| notification_prefs | 8 | daily_email, daily_email_hour, quiet_from, quiet_to, telegram, timezone, updated_at, user_id |
| notifications | 11 | body, created_at, id, job_id, kind, link, org_id, read_at, telegram_sent_at, title, user_id |
| onboarding_sessions | 15 | block_status, completed_at, created_at, depth, diagnosis, findings, id, opinions, org_id, proposal, read_job_id, sources, step, updated_at, user_id |
| org_budgets | 5 | monthly_limit, org_id, updated_at, updated_by, warn_pct |
| org_invites | 7 | accepted_at, created_at, email, id, invited_by, org_id, role |
| org_members | 6 | created_at, id, max_accounts, org_id, role, user_id |
| organizations | 8 | archived_at, company_name, created_at, created_by, currency, id, name, website |
| partners | 12 | contact, created_at, created_by, id, margin_pct, name, notes, org_id, partner_type, status, updated_at, updated_by |
| people | 16 | account_id, company, created_at, created_by, crm_stage, email, full_name, id, linkedin_url, org_id, sequence_stage, source, tier, title, updated_at, updated_by |
| phone_reveals | 10 | apollo_person_id, id, name, org_id, phones, received_at, requested_at, requested_by, stakeholder_id, status |
| positioning | 23 | alternatives, best_customers, category, competitive_alternative, copy_status, created_at, created_by, differentiation, differentiator, elevator_pitch, id, key_benefit, need, one_liner, org_id, product_name, short_pitch, tagline, target_customer, trend, updated_at, updated_by, value |
| posthog_connections | 15 | activation_event, api_key_enc, created_at, created_by, domain_property, host, key_hint, last_error, last_synced_at, org_id, paid_event, project_id, signup_event, status, updated_at |
| product_usage | 10 | account_id, active_users_30d, active_users_7d, active_users_prev_7d, domain, events_30d, id, last_seen_at, org_id, synced_at |
| products | 13 | active, billing, cost, created_at, created_by, description, id, name, org_id, price, sku, updated_at, updated_by |
| profiles | 5 | created_at, current_org_id, email, full_name, id |
| quotas | 9 | amount, created_at, created_by, id, org_id, period, updated_at, updated_by, user_id |
| research_runs | 14 | account_id, created_at, error, finished_at, id, input, kind, label, org_id, processor, result, run_id, status, user_id |
| segment_budget_quarters | 14 | actual_cost_to_serve, actual_revenue, created_at, created_by, id, org_id, period, plan_acquisition, plan_cost_to_serve, plan_new_customers, plan_revenue, segment_id, updated_at, updated_by |
| segment_budgets | 14 | actual_cost_to_serve, actual_revenue, created_at, created_by, id, org_id, plan_acquisition, plan_cost_to_serve, plan_new_customers, plan_revenue, segment_id, updated_at, updated_by, year |
| segment_targets | 9 | amount, created_at, created_by, id, org_id, period, segment_id, updated_at, updated_by |
| segments | 20 | acv_max, acv_min, ae_per_se, ae_quota, cac_target, created_at, created_by, cycle_days, gross_margin_pct, id, motion, name, notes, org_id, payback_months, priority, sdr_per_ae, updated_at, updated_by, win_rate_target |
| sensing_notes | 16 | account_id, context, created_at, created_by, emerging, heard, id, interviewee, journey_id, kind, listening_level, occurred_on, org_id, surprised, updated_at, updated_by |
| stakeholders | 17 | account_id, buying_role, created_at, created_by, email, id, linkedin_url, name, org_id, phone, priorities, reports_to, research, support, title, updated_at, updated_by |
| stripe_connections | 11 | account_name, connected_by, created_at, key_hint, last_error, last_synced_at, livemode, org_id, restricted, status, vault_secret_id |
| stripe_snapshots | 15 | active_customers, churned_customers, churned_mrr, currency, details, id, logo_churn_pct, mrr, new_customers, new_mrr, org_id, revenue_churn_pct, taken_at, trialing, window_days |
| suggestions | 15 | action, body, created_at, dedupe_key, detector, id, link, notified_at, org_id, priority, snoozed_until, status, title, updated_at, user_id |
| tasks | 14 | account_id, created_at, created_by, deal_id, done, due_date, id, notes, org_id, owner_id, source, title, updated_at, updated_by |
| team_members | 8 | created_at, created_by, id, org_id, team_id, updated_at, updated_by, user_id |
| teams | 8 | created_at, created_by, id, lead_id, name, org_id, updated_at, updated_by |
| telegram_updates | 5 | error, payload, processed_at, received_at, update_id |
| trials | 16 | activated_at, company, converted_at, created_at, created_by, email, id, mrr, org_id, plan, posthog_person_id, segment_id, signed_up_at, source, updated_at, updated_by |
| u_journeys | 11 | ai_synthesis, answers, created_at, created_by, id, intention, org_id, phase, title, updated_at, updated_by |
| user_roles | 3 | id, role, user_id |
