# NOKKO — Plan de cierre de gaps para lanzamiento (para Claude Code)

Origen: auditoría "Auditoría de lanzamiento de Nokko" (https://claude.ai/artifact/8viqxJRFhs8bdNzUa94zPq).
Repo: `fefeq/seller-strategy-studio` (HEAD revisado: `d0e4821`).
Autor del plan: Fede. Ejecuta: Claude Code. Revisión independiente antes de cada merge: Fede.

---

## 0. Reglas de trabajo (léelas antes de tocar nada)

1. **Una rama y un PR pequeño por pieza.** Nombre de rama: `fix/<id>-<slug>` (ej. `fix/f1-spend-caps`). Un PR = un cambio revisable en <15 min.
2. **No reescribas historia publicada.** El repo está conectado a Lovable. Sin `push --force`, sin rebase de ramas ya publicadas.
3. **Idioma:** textos de producto, copy y descripciones de PR en español con «tú» (nunca «usted» ni «vos»). Código, identificadores, nombres de rama y commits en inglés.
4. **Sin secretos** en `.env` ni en variables `VITE_`.
5. **NOKKO no se mezcla con Postin.** No uses proyectos Supabase de Postin.
6. **No crees proyectos Supabase para tests.** Usa Postgres local / PGlite (`migrations.pg.test.ts`).
7. **Lee `AGENTS.md` (raíz) y `src/lib/AGENTS.md`** antes de empezar. Convenciones clave: sin `as any`, `errorText()` para errores, titulares en `src/lib/headlines.ts`, guía de Inicio en `src/components/home/guide-card.tsx` + `src/lib/guide.ts`, navegación en `src/lib/nav.ts`.
8. **Registro de herramientas del agente** (`src/lib/agent/tools/*`): cada tool se define con `def({ name, kind: "read"|"write", input: z..., summarize, run })`. `read` se ejecuta al momento; `write` solo crea `agent_pending_actions` que se confirman en Sugerencias. Si añades/renombras/cambias `kind` o las anotaciones MCP de una tool: actualiza `TITLES` y regenera el manifest (si el `sdk_version` del manifest cambia por tus dependencias, déjalo como estaba):
   `node node_modules/@lovable.dev/mcp-js/dist/cli/extract-manifest.cjs .`
9. **Tests obligatorios** en cada PR (`vitest`). Usa el cliente falso de `src/lib/agent-tools.test.ts` (`expectScoped`) para comprobar que toda consulta va filtrada por `org_id`. Migraciones: verificadas en PGlite.
10. **Antes de abrir el PR:** `npm run lint`, `npm run typecheck` (o el equivalente de `package.json`), `npm test`. Pega el resultado en el PR.
11. **Atribución** (commits y PR):
    - Commits terminan con:
      `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`
      `Claude-Session: https://claude.ai/code/session_013oUyrHdHaQ4SjMaiyKsvHA`
    - Descripción del PR termina con:
      `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
      `https://claude.ai/code/session_013oUyrHdHaQ4SjMaiyKsvHA`
12. **Nada se publica ni se envía** (emails, LinkedIn, etc.) sin aprobación humana. No cambies esa garantía.
13. **No inventes métricas** ni datos de demo que parezcan reales. Si falta un dato, dilo en el PR.
14. **Dani no participa en NOKKO.** No generes peticiones para él.

## 1. Estado de la auditoría: qué está verificado y qué no

Parte de la auditoría es del 24 oct y `main` ya ha avanzado. **Antes de cada PR, reproduce el problema en el código actual.** Si ya está arreglado, cierra la pieza con una nota y pasa a la siguiente.

**Verificado en el código (HEAD `d0e4821`):**
- Anti-ICP por solapamiento de tokens sueltos (`src/lib/scoring.ts` ~101–110).
- SLA en días naturales y `new: 1` (`src/lib/lead-funnel.ts`, `DEFAULT_LEAD_SLA`, `leadDelay`).
- Detector de leads atrasados propone tarea para «mañana» (día natural) con `owner_id` que en datos reales viene `null` (`src/lib/proactive/detectors/late-leads.ts`) y una sugerencia por lead.
- Completitud de setup solo mira existencia (`accounts > 0`, `deals > 0`) (`src/lib/setup-schema.ts`).
- Sin tope mensual por defecto: `monthBudget()` devuelve `limit: null` si no hay fila en `org_budgets`, y `budgetState` no aplica tope sin límite (`src/lib/orchestrator/runner.ts`, `planner.ts`, migración `0041`). Los topes solo pausan trabajo `automatic`.
- Tools que gastan créditos o guardan datos están como `kind: "read"`: `linkedin_company_posts`, `linkedin_profile_posts`, `company_job_postings`, `competitor_reviews`, `research_account`, `enrich_accounts_table`, `apollo_find_people`, `apollo_find_companies`, `apollo_enrich_account`, `clay_find_companies`, `clay_find_people`, `clay_enrich_account`. `linkedin_company_posts` además guarda `accounts.linkedin_url` (`src/lib/apify-core.ts` ~32).
- `create_lead` (`src/lib/agent/tools/pipeline.ts` ~63) no emite evento de lead; `update_lead` sí (`core-write.ts` 112–113). `leads-ingest.ts` no contiene `trySend`/`leadEvents`.
- `decide_approval` desde Telegram: hueco `guard_approval`/`auth.uid()` documentado en `src/lib/AGENTS.md` (`0000_migration.sql:226`, `0002_multitenant_organizations.sql:181`).

**Sin verificar → paso «verifica primero» en la pieza que corresponda:**
- Por qué la sugerencia en vivo salía con fecha de hoy (¿zona horaria / momento del snapshot?).
- Origen de los contadores distintos (topbar «Avisos», sidebar «Sugerencias pendientes», API).
- Mapeo de Sales Navigator (dominio/email, creación de persona) en `leads-ingest.ts` y `normalizeLead` de `leads.ts`.
- Si `ingestLead` ya emite eventos por otra vía.
- Dos versiones del informe semanal, «Oportunidades creadas 1 (0 abiertas)», solapes de ACV.
- Comportamiento del flujo de leads sin dominio (`lead-flow.ts`, `enrichLead` en `tasks.server.ts` / `lead-tasks.server.ts`).
- Landing (`src/routes/index.tsx`) y `/precios` (devolvía 404), contenido de `guide-card`.

## 2. Wave 0 — Decisiones de Fede (bloquean, no son código)

| ID | Decisión | Por qué bloquea |
|---|---|---|
| D1 | Licencias de Apollo/Clay: ¿cuenta compartida de NOKKO para todos los clientes o cada cliente trae la suya? | Define coste por cliente y el diseño de F1 (topes). |
| D2 | Apify/scraping de LinkedIn: ¿se mantiene? (Postin solo usa API oficial; NOKKO es otro producto, pero hay riesgo legal/reputacional.) | Define si F1 deja `linkedin_*` activas o las desactiva por defecto. |
| D3 | Google Drive: ¿una sola cuenta compartida o por empresa? | Riesgo de mezclar datos entre clientes. |

Claude Code: **no implementes nada que dependa de D1–D3** hasta que Fede responda. Recomendación vigente: D1 cuenta compartida solo durante la beta (el tope por empresa protege la factura); D2 Apify/LinkedIn apagado por defecto; D3 pendiente.

## 3. Wave 1 — Arreglos de confianza (antes de cualquier cliente externo)

### Estado de las piezas (actualizado 27 oct)

| Pieza | Estado | Dónde |
|---|---|---|
| F6 | Hecha (parche) | `0001-fix-agent-emit-lead-events…` |
| F4 | Hecha (parche); falta alinear `followup.ts` (días 3/7/14 siguen en días naturales) | `0001-fix-leads-count-SLA…` |
| F2 | Parte 1 hecha (anti-ICP por cláusula). **Pendiente:** dispersión del score y actividad basada en toques reales | `0001-fix-scoring-match…` |
| F1b | Hecha con diseño distinto al plan original (ver abajo) | `0001-fix-agent-cap-and-log…` |
| F1a | Hecha (depende de F1b) | `0002-feat-budget-default-caps` |
| F3 | Hecha (parche): cuentas y deals solo cuentan si ≥50 % tienen dominio/sector/tamaño/país e importe/fecha. **Pendiente:** productos y objetivos CAC/payback/margen como ítems nuevos (requieren pantalla en el asistente) | `07-f3-setup-data-quality` |
| F5 | Hecha (parche + migración 0064; pide revisión reforzada) | `0003-fix-approvals-telegram-decide` |

**Auditoría independiente hecha (27 oct).** Corregido tras ella: el chat se saltaba el guard de gasto (F1b), regresiones del anti-ICP (F2), textos y etiquetas de F4/F1a, bloqueo manual en el orquestador. **Abierto, decide Fede:** (1) RESUELTO: las empresas existentes se quedan como están (migración 0065 les da una fila «sin límite»); solo las nuevas parten con 25 €/mes y 5 €/día. Matiz: una empresa con límite ya guardado gana el tope diario del 20 % de su límite; (2) SLAs ya guardados cambian de significado a días laborables; (3) F4: si un grupo de leads atrasados se deshace (4→3), los individuales ya cerrados no reabren; (4) el tope de gasto es blando (llamadas concurrentes); (5) F5 menores: exigir `new.org_id = old.org_id` en la rama de servicio y poner `decided_by` a null al revertir; (6) costes de Clay por resultado son una cifra fija aproximada.

Los parches están en `nokko-wave1-patches.zip` (ver `LEEME.md` para aplicarlos). **Si ya están mergeados, no los rehagas: empieza por lo pendiente.**

### F1b — Tope y registro de gasto en las tools de integraciones (HECHA; diseño corregido)
- **Por qué NO se pasan a `write`:** estas tools devuelven datos al chat (p. ej. una búsqueda de empresas cuyos resultados usa el siguiente paso). Una tool `write` solo queda pendiente en Sugerencias y no devuelve nada hasta confirmar: se rompe el flujo. Las tools siguen siendo `read`.
- **Problema real (verificado):** los gateways de Apollo, Clay, Parallel y Apify no comprueban ningún tope ni registran el gasto; solo lo hace el orquestador automático. Todo lo que gastaba el chat o el MCP era invisible para el medidor y no tenía tope.
- **Qué hace el parche:** `executeTool` (`src/lib/agent/tools.ts`) comprueba el tope antes de llamar y registra el gasto aproximado después, con el catálogo de costes de `planner.ts` (`src/lib/agent/spend-guard.ts`, 11 tools). El MCP deja de marcarlas como solo lectura. Manifest regenerado.
- **Aún sin cubrir:** las tools `write` que gastan (`apollo_reveal_contacts`, `apollo_reveal_stakeholder`, `start_account_report`, `start_icp_account_list`) no registran gasto al confirmarse. PR pequeño pendiente.
- **D2 (Apify/LinkedIn):** recomendación de Fede/Claude: apagado por defecto. Pendiente de decisión; si se apaga, hacerlo tras un flag en `linkedin.ts`/`web.ts`.

### F1a — Tope mensual y diario por defecto (HECHA)
- Sin fila en `org_budgets` → tope por defecto **25 €/mes** (`DEFAULT_MONTHLY_LIMIT` en `planner.ts`). Una fila con límite vacío sigue significando «sin límite» (decisión del owner).
- Tope diario = **20 % del mensual** (`DAILY_SHARE`), sin migración ni columna nueva.
- `budgetCaps()` combina ambos; `monthBudget()` (`runner.ts`) lo usa; `guardSpend` también. Panel de Integraciones muestra «Hoy: X de Y €».
- **Pendiente menor:** el día se cuenta en UTC; pasarlo al calendario de Madrid (`localIsoDay` de F4).
- **Aviso al mergear:** empresas sin fila pasan de «sin tope» a 25 €. Revisar antes el gasto del mes de Postin V2.

### F2 — Puntuación de fit creíble (anti-ICP, dispersión, actividad) — parte 1 hecha; quedan dispersión y actividad
- **Verifica primero:** lee `src/lib/scoring.ts` y sus tests; reproduce con una cuenta cuyo sector solo comparte una palabra suelta con el anti-ICP.
- **Cambios:**
  1. Anti-ICP por **frase/semántica**, no por token suelto: exige coincidencia de n-gramas o de frase completa y excluye tokens que también aparecen en el texto objetivo del propio ICP/segmento.
  2. Ensancha la dispersión del score (que no se concentre en un rango estrecho): revisa pesos y la función `combine` (hoy fit 70 % / actividad 30 %).
  3. Actividad basada en **toques reales** (`log_touch`/reuniones), no solo en etapa + recencia.
- **Aceptación:** caso de falso anti-ICP deja de salir; test de regresión; distribución de scores en dataset de ejemplo con rango razonable (documenta antes/después en el PR **con datos de test, nunca de clientes**).

### F3 — (pasa a Wave 2)

### F4 — SLAs y alertas de leads atrasados que no molesten
- **Archivos:** `src/lib/lead-funnel.ts`, `src/lib/proactive/detectors/late-leads.ts`, tests de ambos.
- **Cambios:**
  1. `leadDelay`: cuenta **días laborables** (sin sábado/domingo). Default `new` más blando (propón 2 laborables; confírmalo con Fede).
  2. Detector: fecha de la tarea = **siguiente día laborable**, no «mañana» natural. Verifica primero por qué salía con fecha de hoy (zona horaria Europe/Madrid vs UTC en `isoDate`).
  3. `owner_id`: si el lead no tiene, usa el dueño de la cuenta; si tampoco, el owner de la org.
  4. **Una sugerencia agrupada** («N leads atrasados») en lugar de una por lead; mantén la clave de deduplicación estable (`late_lead:<id>:<stage>:<fecha>`) para el detalle.
  5. Respeta `followupStatus` (silencio durante secuencias), ya existe.
- **Aceptación:** lead creado viernes no se marca atrasado el domingo; la tarea cae en lunes; owner nunca `null` si hay alguien a quien asignar; una sola sugerencia agrupada.
- **Tests:** puros, con `now` inyectado en viernes/sábado/lunes y en cambio de hora.

### F5 — `decide_approval` desde Telegram (HECHA; pide revisión reforzada)
- **Qué pasaba:** `guard_approval` lee `auth.uid()`, que es NULL para el cliente de servicio que usa Telegram; toda decisión fallaba con «Solo owner…». Fallaba cerrado: era un fallo funcional, no una fuga.
- **Qué hace el parche:** migración `0064_guard_approval_privileged_path.sql`. El usuario autenticado se comprueba igual que antes. El rol de servicio solo puede decidir si la fila lleva `decided_by` y esa persona es owner/sales_leader/deal_desk **de la empresa de esa aprobación**. Cualquier otro caso se rechaza. `decide_approval` (`inbox.ts`) envía `decided_by: c.userId`.
- **Verificado:** 7 tests en PGlite (`approvals-guard.pg.test.ts`), incluido el caso «aprobador de la empresa B no decide en la A».
- **Qué debe mirar quien revise:** (1) `current_user = 'service_role'` es la forma de detectar al cliente de servicio; (2) el rol de servicio ya se salta RLS, así que el trigger no protege ante una clave filtrada, solo mantiene el rol y la auditoría correctos; (3) probar en una copia/rama de base de datos antes de producción (no en proyectos de Postin).

### F6 — `create_lead` emite el evento `lead.created`
- **Archivos:** `src/lib/agent/tools/pipeline.ts` (~63), patrón en `core-write.ts` 112–113.
- **Verifica primero:** si `ingestLead` ya emite evento por otra vía (`src/lib/leads-ingest.ts`). Si no:
  ```ts
  const [{ leadEvents }, { trySend }] = await Promise.all([
    import("@/lib/inngest/lead-events"),
    import("@/lib/inngest/send.server"),
  ]);
  if (saved) await trySend(leadEvents(c.orgId, saved));
  ```
- **Aceptación:** un lead creado desde el chat/MCP dispara la misma cadena (cualificación, enriquecimiento) que uno creado en la app; test con cliente falso que comprueba la emisión.

### F7 — Importación desde Sales Navigator
- **Verifica primero:** `src/lib/leads-ingest.ts` y `normalizeLead` en `src/lib/leads.ts` con un CSV de ejemplo **sintético**.
- **Cambios:** mapear dominio y email cuando existan; crear persona (`people`) vinculada al lead; si no hay dominio, no romper la cadena de enriquecimiento (`enrichLead`): marcar «falta dominio» y pedirlo.
- **Aceptación:** CSV sintético con y sin dominio genera lead + persona correctos y un aviso claro cuando falta el dominio.

### F8 — Incoherencias de cuenta (13 puntos de la auditoría) — agrupar en PRs pequeños
Un PR por fila, en este orden:

| PR | Cambio | Verifica primero |
|---|---|---|
| F8-1 | Un único contador de pendientes (topbar «Avisos», sidebar «Sugerencias pendientes» y API deben coincidir) | Fuente de cada contador |
| F8-2 | Una sola versión del informe semanal visible | Por qué hay dos |
| F8-3 | Mover «preguntas abiertas de la IA» fuera de Sugerencias | — |
| F8-4 | Cuota coherente entre pantallas | Dónde se calcula cada una |
| F8-5 | Validación de ACV: solapes y huecos entre rangos | `ACV` en `products`/ICP |
| F8-6 | Aplicar plantilla de ticket bajo cuando corresponda (doc `benchmarks-ticket-bajo.md` del proyecto) | — |
| F8-7 | No contar actividad sin toques | Depende de F2 |
| F8-8 | Formato de números (miles, decimales, moneda) en un helper único | — |
| F8-9 | Archivar borradores superados del ciclo | Nada se borra: archivar |
| F8-10 | Normalizar el texto de posicionamiento | — |
| F8-11 | «Oportunidades creadas 1 (0 abiertas)»: definir la métrica | Origen del conteo |

Si alguna incoherencia no se reproduce, dilo en el PR de cierre; no inventes el arreglo.

## 4. Wave 2 — Primera experiencia del founder

| ID | Pieza | Archivos/notas | Aceptación |
|---|---|---|---|
| F3 | Completitud de setup con calidad de datos | `src/lib/setup-schema.ts`: añade ítems (dominio/tamaño/país en cuentas, productos, objetivos CAC/payback/margen). Hoy 100 % con base vacía | Con cuentas sin dominio el setup no pasa del 100 %; `setupStatus()` testeado |
| W2-1 | Enriquecimiento al entrar el lead | `lead-flow.ts`, `tasks.server.ts` | Lead nuevo con dominio se enriquece sin pasos manuales (respeta F1) |
| W2-2 | Datos de demo claramente etiquetados | Nuevo módulo + flag `is_demo` | Nunca se mezclan con métricas reales; se borran con un clic |
| W2-3 | Copy de Inicio orientado a founder | `guide-card.tsx`, `guide.ts`, `headlines.ts` | Primer paso claro en <1 min; tono «tú» |
| W2-4 | Landing y `/precios` | `src/routes/index.tsx` + ruta nueva. **Los precios solo salen de la fuente oficial**; si no existen, pregunta a Fede | Sin 404; sin precios inventados |
| W2-5 | Aviso de ICP demasiado amplio | `scoring`/ICP | Aviso cuando el ICP no filtra |
| W2-6 | Conexión guiada de Stripe/PostHog | `integrations.tsx` | Pasos con comprobación; métricas reales solo desde Stripe/BD |
| W2-7 | Panel de gasto | Usa `org_budgets` (F1a) | El founder ve gastado/tope/mes |
| W2-8 | Estados vacíos neutros | Pantallas con listas | Sin textos que asuman datos |
| W2-9 | Métrica de activación | Definir con Fede | **Pregunta la definición**; no la inventes |

## 5. Wave 3 — Cobertura del chat y canales

**12 tools mínimas** (todas `write` salvo las de lectura; confirmación en Sugerencias):
`list_segments` (read), `upsert_product`, `list_members` (read), `invite_member`, `set_member_role`, `qualify_lead`, `enrich_lead`, `sync_stripe_now`, `list_trials` (read), `get_link` (read), `list_capabilities` (read), `undo_last_action`.

Reglas: un PR por 2–3 tools; cada una con test de aislamiento por `org_id`; actualiza `TITLES` y manifest; `invite_member`/`set_member_role` solo para owner/admin.

Resto de Wave 3:
- Tests de aislamiento para las **29 integraciones** (`expectScoped`).
- Telegram: acuse inmediato + trabajo en segundo plano (Inngest).
- Capa conversacional: respuestas con enlaces a la pantalla correcta.
- WhatsApp: solo spec (SDD), no implementar sin decisión de Fede.

## 6. Orden recomendado de PRs

**Estado (27 oct 2026):** hechos y con parche listo (carpeta `patches/`, ver `LEEME.md`): F6, F4, F2 (+F2b), F1b, F1a, F5, F3, F7, F8-5, F8-8, F8-11, W2-1 (ya cubierto por F6 y la cadena de enriquecimiento existente), W2-5, W2-7 (parcial, con F1a), Wave 3: `list_segments`, `list_members`, `list_trials`, `get_link`, `upsert_product`, `sync_stripe_now`, test de aislamiento de integraciones.

**Pendiente y por qué:**
- F8-1 (no es un fallo: «Avisos» cuenta avisos sin leer y «Sugerencias» las pendientes; decidir si se unifica o se renombra), F8-2/4/6/9/10 (hay que reproducirlos en la cuenta real), F8-3 (decisión de producto), F8-7 y resto de F2 (definición de «toque»).
- W2-4 (precios), W2-9 (definición de activación), W2-2/3/6/8 (copy y diseño con revisión visual).
- Wave 3: `invite_member`/`set_member_role` no se implementan por chat (decisión de seguridad; recomendado: solo en pantalla); `qualify_lead`, `undo_last_action`, `enrich_lead` ya están cubiertos por `update_lead`, `list_recent_changes`+`undo_change`, `complete_account`/`find_key_people`; Telegram con acuse inmediato y WhatsApp: SDD aparte.
- Seguimientos de la primera auditoría: hueco de duplicados en F4, aviso/migración de SLA guardados, día UTC→Madrid en los topes, menores en F5, registro de gasto de herramientas de escritura (reveals, informes), `followup.ts` aún en días naturales.
- Decisiones de Fede: D1 (Apollo/Clay compartidos: solo en beta), D2 (Apify/LinkedIn: apagado por defecto), D3 (un solo Drive).

**Orden de merge sugerido:** F6 → F4 → F2 → F2b → F1b → F1a → F5 → F3 → F7 → F8 (10, 11) → W2-5 → W3a → W3b → W3c. Cada uno con su auditoría y prueba en rama de base de datos antes de la migración (F5, F1a).

## 7. Plantilla de descripción de PR

```
## Qué cambia
## Por qué (ID de la auditoría: F#)
## Cómo lo he verificado (tests, comandos y salida)
## Riesgos y lo que NO cubre
## Qué debe mirar quien revise (RLS / org_id / copy / datos)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_013oUyrHdHaQ4SjMaiyKsvHA
```

## 8. Checklist de lanzamiento (resumen)

- [ ] D1, D2, D3 decididas
- [ ] F1a, F1b, F2, F4, F5, F6, F7 mergeadas con revisión independiente
- [ ] Incoherencias F8 cerradas o descartadas con prueba
- [ ] Setup, Inicio, landing y /precios sin 404 ni copy inventado
- [ ] Tests de aislamiento verdes en las 29 integraciones
- [ ] Nada de datos de clientes reales en tests, demos, ejemplos ni PRs
