# Base de datos

Postgres en Supabase (Lovable Cloud). El esquema vive en `drizzle/migrations` (75 archivos SQL, 0000–0076). Los tipos TypeScript generados están en `src/integrations/supabase/types.ts` (91 tablas en `public`, el reflejo de la base viva).

> **Atención**: un replay de las migraciones desde cero **no reproduce** la base real. Detalle en la sección 6.

## 1. Archivos base

| Archivo | Qué es |
| --- | --- |
| `drizzle/migrations/*.sql` | 75 migraciones. Faltan los números 0059 y 0074 |
| `drizzle/migrations/meta/_journal.json` | 75 entradas; el número del archivo es un nombre, no un orden de aplicación |
| `drizzle/schema.ts` | Vacío a propósito («auto-generated and intentionally left blank») |
| `drizzle.config.ts` | Usa la variable `LOVABLE_DB_MIGRATION_URL` |
| `supabase/config.toml` | Solo el `project_id` |
| `src/integrations/supabase/types.ts` | Tipos generados; fuente de verdad de tablas y enums |
| `docs/sdd/annex/field-inventory-20261025.md` | Inventario del esquema a 2026-10-25: 84 tablas, 1043 columnas, 35 jsonb, 48 estados en texto |

Enum `app_role`: `owner`, `sales_leader`, `marketing`, `sdr`, `ae`, `se`, `cs`, `deal_desk`, `enablement`.

## 2. Modelo multitenant

- **Empresa** = `organizations`. **Pertenencia y rol** = `org_members` (un rol por persona y empresa). **Invitaciones** = `org_invites` (se aceptan con el RPC `accept_invites`).
- **Empresa activa** de cada persona: `profiles.current_org_id`. `current_org()` la devuelve (`security definer`, `stable`).
- Casi toda tabla de negocio lleva `org_id uuid default current_org() references organizations on delete cascade` y un índice `<tabla>_org_idx`. El cliente no envía `org_id`.
- El trigger `guard_current_org` impide fijar como activa una empresa de la que no eres miembro.
- Helpers `security definer`: `is_org_member`, `has_org_role`, `shares_org`.
- `set_audit()` rellena `created_by`, `updated_by`, `updated_at` y `org_id`; sin empresa activa lanza «Selecciona una empresa antes de crear datos».

### Quién puede qué

| Ámbito | Regla |
| --- | --- |
| Lectura de datos de empresa | `org_id = current_org()` y ser miembro |
| Inserción | Ser miembro de la empresa |
| Actualización | `org_id = current_org()` y ser miembro |
| Borrado | Solo Owner |
| Miembros e invitaciones | Solo Owner (nunca puede quitarse a sí mismo) |
| `quotas`, `segment_targets`, `gtm_advisories`, `lead_sources`, `lead_settings`, `strategy_reviews` | Owner y Sales Leader |
| `cac_costs` | Owner, Sales Leader y Marketing |
| Decidir `approvals` (trigger `guard_approval`) | Owner, Sales Leader y Deal Desk |
| `org_budgets` (escritura) | Solo Owner |
| Activar entrada directa en `lead_sources` | Owner o Sales Leader (trigger `guard_lead_source_mode`) |
| Deshacer una edición (`undo_field_edit`) | Solo Owner |
| Lectura de finanzas | Owner y Sales Leader según `src/lib/AGENTS.md`; la función `is_finance_member` aparece en `types.ts` y ninguna migración activa la define |

La UI repite estas reglas para ocultar acciones; la protección real es RLS.

### Superadmins (`platform_admins`, 0075/0076)
- Tabla con `user_id` PK a `profiles`; `authenticated` solo puede leer su propia fila.
- Las filas entran **solo por migración o SQL**.
- Triggers: `organizations_add_platform_admins` (cada empresa nueva los hace Owner), `platform_admins_join_all` (un superadmin nuevo es Owner de todas) y `org_members_protect_platform_admins` (no se les puede quitar ni degradar, salvo al borrar la empresa entera).
- 0076 evita el choque del trigger con el insert del creador dentro de `create_organization`.
- La migración 0075 siembra el primer superadmin con un email escrito en el SQL. **Recomendación**: no copiar ese email a documentación ni a ejemplos.

### Alta y ciclo de vida de empresas
- `create_organization(_name)` (0002): cualquier `authenticated` crea una empresa, queda como Owner y la fija como activa. Siembra segmentos ACV, `positioning`, integraciones y documentos por defecto.
- `create_organization_full(_name, _segments, _website, _currency)` (0056, reescrita en 0071).
- `archive_organization` y `delete_organization(_org, _confirm_name)` (0056): solo Owner; borrar exige el nombre exacto.

## 3. Tablas por dominio

Entre paréntesis, la migración de origen.

**Multitenant y administración**
`organizations`, `org_members`, `org_invites` (0002) · `profiles`, `user_roles` (0000; `user_roles` retirada) · `platform_admins` (0075) · `knowledge_docs` (0000).

**Estrategia**
`segments`, `icp_profiles`, `positioning`, `messaging_pillars`, `quotas` (0001) · `segment_targets` (0009) · `cac_costs` (0015) · `segment_budget_quarters` (0017; `segment_budgets` de 0016 está retirada) · Theory U: `u_journeys`, `sensing_notes`, `case_clinics`, `gtm_experiments` (0003; cierre y decisión en 0069) · `gtm_advisories` (0005) · `gtm_artifacts`, `debates` (0008).
Motor de sugerencias estratégicas: `strategy_decisions` (0068), `strategy_changes`, `strategy_links` (0070), `strategy_reviews` (0072). Trazabilidad: `field_edit_log` (0060).

**Cuentas y personas**
`accounts`, `account_plans`, `stakeholders`, `people` (0000) · `partners`, `deal_registrations`, `account_touches` (0001) · `phone_reveals` (0030) · `account_signals` (0031) · `drive_folders` (0033) · `drive_doc_summaries` (0040) · `memories` (0042).

**Leads y entrada de datos**
`lead_sources`, `lead_events` (0010) · `leads`, `lead_settings` (0012) · `trials` (0006) · `research_runs` (0038) · `discoveries` (0044) · `import_batches`, `import_rows` (0047) · `product_usage` (0035).

**Pipeline**
`deals`, `meetings`, `mutual_action_items`, `campaigns`, `campaign_results`, `calls`, `approvals` (0000) · `deal_stage_history` (0001) · `tasks` (0007).

**Agente y canales**
`agent_conversations`, `agent_messages`, `agent_pending_actions`, `suggestions`, `channel_links`, `telegram_updates`, `job_locks` (0007) · `org_budgets`, `integration_usage` (0041).

**Onboarding y guía**
`onboarding_sessions` (0052/0053/0054) · `setup_step_snoozes` (0062).

**Avisos y trabajos**
`background_jobs` (0037; ampliada en 0049, 0050, 0053) · `notifications` (0049) · `notification_prefs` (0050, 0055).

**Conexiones**
`integrations` (0000) · `posthog_connections` (0035).

**Existen en `types.ts` pero no se crean en SQL activo**
- Solo en SQL comentado: `deal_stages`, `products`, `deal_lines`, `stripe_connections`, `stripe_snapshots`, `account_assignment_rules`.
- Sin migración en `main`: `activities`, `deal_offers`, `email_templates`, `forecast_snapshots`, `teams`, `team_members`, y las cuatro tablas `finance_*` (`finance_cost_lines`, `finance_invoices`, `finance_months`, `finance_settings`; la 0057 solo les hace GRANT).
- `org_connections`, `drive_connections` y `connection_events` existen en ramas aparte, no en `main`.

## 4. Patrones de seguridad

### GRANT
- 0000/0002/0003 dan CRUD a `authenticated` y ALL a `service_role`.
- Desde 0060 (y 0062, 0068, 0070, 0072) se hace `REVOKE ALL ... FROM anon, authenticated` y se concede lo mínimo. Motivo: Supabase da todos los privilegios a una tabla nueva y `TRUNCATE` se salta RLS.
- **Grants por columna**: `discoveries` (solo `status`, `dismiss_reason`, `decided_by`, `decided_at`, `result_id`) y `posthog_connections` (SELECT sin la clave cifrada).

### Familias de tablas
- **Por persona** (`user_id = auth.uid()`): `agent_*`, `channel_links`, `background_jobs`, `notifications`, `notification_prefs`, `onboarding_sessions`.
- **Solo servidor escribe**: `drive_folders`, `discoveries` (filas).
- **Solo añadir** (sin UPDATE ni DELETE para la app): `strategy_decisions`, `strategy_reviews`, `strategy_links`. `field_edit_log` solo se escribe vía trigger.
- **Plantilla estándar** de cuatro políticas (lectura, inserción, actualización, borrado solo Owner): 0002.

### Funciones y triggers destacados
| Elemento | Qué hace |
| --- | --- |
| `track_deal_changes` (0002) | Historial de etapas y `closed_at` |
| `lead_stage_change` (0012) | Al llegar a «oportunidad» crea cuenta y deal |
| `notify_job_end` (0049) | Aviso al terminar un trabajo |
| `track_field_sources` (0058, ampliada en 0061) | Procedencia: si edita una persona el campo queda sellado como «persona»; si es un servicio, la marca se borra. Cubre cuentas, `positioning`, `messaging_pillars`, `segments` e `icp_profiles` |
| `log_field_edit` / `undo_field_edit` (0060, 0063, 0066) | Registro de ediciones con plazo de 24 h; deshacer solo si la fila sigue igual al «after» del log |
| `stamp_human_edit` (0064) | Sella `last_human_edit_at` en 7 tablas |
| `company_diagnosis(_org)` (0065) | Devuelve solo el diagnóstico sin abrir la política de `onboarding_sessions` |
| `decide_strategy_suggestion`, `strategy_decisions_stamp`, `suggestions_strategy_guard` (0068–0073) | Único camino a decidir una sugerencia estratégica; el navegador no puede cambiar `status` ni `snoozed_until` sin la configuración transaccional `nokko.strategy_decision` |
| `can_complete_setup_step` (0062) | Reglas de cierre de pasos de la guía |
| `accept_invites` (0002) | Acepta invitaciones al entrar |
| `handle_new_user` (0002) | Crea el perfil y las pertenencias por invitación pendiente |

**Realtime** (`supabase_realtime`): `deals`, `lead_events`, `leads`, `background_jobs`, `research_runs`, `notifications`.

**Stripe**: la clave restringida de cada empresa va en Supabase Vault (`set_stripe_key` solo Owner, `stripe_key_for` solo `service_role`). Estas funciones están solo en SQL comentado en el repo.

### Retiradas
- `user_roles`: `DEPRECATED` (0002/0051); lectura restringida a la propia fila (0014).
- `segment_budgets`: `DEPRECATED` (0017/0051); sustituida por `segment_budget_quarters`.
- Borrar tablas retiradas es un cambio que rompe y está bloqueado (roadmap).

## 5. Cronología

| Rango | Qué introduce |
| --- | --- |
| 0000–0001 | Base de equipo único, roles globales `app_role`, estrategia, partners, ABM, toques |
| 0002 | Pivote a multitenant: empresas, miembros, invitaciones, `org_id` en todo, nuevas políticas, `create_organization` |
| 0003–0009 | Theory U y experimentos, moneda y métricas de segmento, asesor GTM, trials, agente y sugerencias, Ciclo GTM y debates, objetivos por segmento |
| 0010–0017 | Entrada de leads, embudo de leads, CAC, presupuestos por segmento y trimestre |
| 0018–0029 | 12 migraciones **completamente comentadas** («cannot be applied»): ya estaban aplicadas antes del historial (`deal_stages`, `products`, `deal_lines`, Stripe, asignación de cuentas…) |
| 0030–0050 | Apollo, Firecrawl, Drive, PostHog, trabajos en segundo plano, Parallel, cualificación de leads, memorias, Descubiertos, cuarentena de importaciones, centro de avisos |
| 0051–0057 | Marcas de retirada, onboarding, preferencias de email diario, archivar/borrar empresa, grants de finanzas |
| 0058–0067 | Procedencia de campos, registro de ediciones y deshacer, guía de estrategia |
| 0068–0073 | Motor de sugerencias estratégicas (decisiones, ejecución, revisión con IA, `acquisition_motion`, guard) |
| 0075–0076 | Superadmins de plataforma (renumeradas desde 0073 por conflicto, PR #74) |

## 6. Cómo se aplican las migraciones y qué es incoherente

### Cómo se aplican hoy
- **No hay script de migración** en `package.json` ni `drizzle-kit migrate` contra producción. El SQL lo aplica una persona o el agente de Lovable contra Lovable Cloud (checklist: `docs/sdd/annex/apply-migrations-checklist-20261027.md`; última nota: `docs/sdd/annex/migraciones-pendientes-lovable-20261101.md`, que aplicó 0071–0073 el 2026-11-01).
- Se verifican **antes** en local con PGlite (`src/lib/migrations.pg.test.ts` y otros `*.pg.test.ts`). Casi todas las migraciones recientes dicen «NOT applied to any real database».
- Las reglas de `docs/sdd/EXECUTION.md`: migraciones nuevas con GRANTs y RLS por empresa, no cambiar migraciones aplicadas, no tocar datos reales.
- **[Por verificar]** el contenido de `drizzle.__drizzle_migrations` en la base viva y cómo se aplicaron las migraciones anteriores a 0071.

### Incoherencias detectadas
1. **Deriva repo ↔ base viva**: 6 tablas solo en SQL comentado y 10 sin migración; `accounts.country` solo en una migración comentada; `is_finance_member` sin definición; `0057` fallaría en una base reconstruida.
2. **`create_organization` viva no está en el repo activo**: las versiones de 0020 y 0028 están comentadas; `0056` llama a `create_organization(_name, _segments)` y fallaría en un replay.
3. **Documentación contradictoria sobre qué está aplicado**: `src/lib/AGENTS.md` dice que 0071 no está aplicada; la nota de 2026-11-01 dice que sí. Las cabeceras de 0068–0073 dicen «Never applied».
4. **Archivo citado que no existe**: `check-migration-journal.mjs`.
5. **Numeración rota**: faltan 0059 y 0074 (están en ramas abiertas).
6. **Snapshots incompletos**: 60 snapshots; no hay de 0058 a 0073.
