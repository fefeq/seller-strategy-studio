# Revisión de coherencia entre los SDD del Sprint 2 (2026-11-09)

Revisión independiente (`nokko-gate`) de NK-0094, NK-0095 y NK-0096 con los bugs del sprint. Copiada sin editar. Bloqueantes: NK-0096 depende de NK-0095 (decisión del coordinador en el §14 de NK-0096); NK-0093 se integró antes que NK-0094 (hecho, merge 19beb33).

**Veredicto del gate: Objeciones**

- **CA sin prueba posible o sin G-n:** ninguno sin G-n (los tres van sin PRD). Hay uno cuya prueba no cubre lo que afirma: NK-0095 CA-10, segunda mitad («el ejecutor también lo rechaza porque pasa los roles de `jobCtx`»). La prueba asignada, `src/lib/drive-core.test.ts`, solo ejercita `importToKnowledge`. No comprueba que `job-runner.server.ts:194-198` le pase los roles: hoy construye `{ db, orgId, userId }` sin roles.
- **[Por verificar] que sigue sin comprobarse:**
  - NK-0095: las políticas vivas de `knowledge_docs`; el tipo y el valor por defecto de `mandatory`; la versión viva de `create_organization`; que Telegram pase `ctx.roles`; que PGlite `^0.5.11` acepte `as restrictive`.
  - NK-0096: que Vitest importe `src/lib/mcp/index.ts`; que el extractor del manifiesto corra en el worktree; que los clientes externos llamen a `get_team_rules`; el volumen de reglas en producción.
  - NK-0094: que sus dos tests fallen en la base; las cifras de producción que pasan a «Sin dato»; quién depende de `payback.source`; la clasificación de los «—».
  - **Resueltos:**
    - Numeración de migraciones (NK-0095 §14): en el sprint solo NK-0095 añade migración. La última de `main` es `drizzle/migrations/0080_unversioned_schema_capture.sql`. NK-0094 y NK-0096 declaran «sin migraciones» (NK-0094 §5 y §10, NK-0096 §10), y los briefs de NK-0091, NK-0093 y NK-0098 las prohíben. La `0081` no choca con nada.
    - Ruta de `check-migration-journal.mjs` (NK-0095 §16): no existe en el repo (`find` vacío fuera de `node_modules`). Lo que sí existe y corre en vitest es `src/lib/migrations-journal.ts` con su test. `src/lib/AGENTS.md:58` cita un script inexistente.
- **Contradicciones con el código o con decisiones previas:**
  1. El brief de NK-0093 obliga a cambiar la parte de leads de `PipelineBoardPanel` (`src/components/pipeline-board-panel.tsx:34`, `useLeads`). El mismo brief prohíbe tocar archivos de NK-0094, y NK-0094 U-3 reescribe ese archivo (`:184-226`) y su test.
  2. NK-0096 da por hecho que NK-0095 acota la inyección (`SDD-20261109-rules-in-ai-readers.md:177`), pero no la declara como dependencia (`:6`). NK-0095 admite que, hasta aplicar la migración a mano, la API sigue abierta (`SDD-20261109-rules-write-permissions.md:209`).
  3. NK-0095 §13 da a entender que cambiar solo la descripción de `drive_import_to_knowledge` no toca el manifiesto. Esa descripción sí está en `.lovable/mcp/manifest.json:3820`, y NK-0095 no prevé regenerarlo.
- **Lo que esta revisión NO demuestra:**
  - No he ejecutado tests ni el extractor.
  - No he consultado la base real.
  - No he revisado la corrección interna de cada SDD (fórmulas de NK-0094, SQL de NK-0095, núcleos de NK-0096), solo su coherencia mutua y con los briefs de NK-0091, NK-0093 y NK-0098 en `f59681f`.
  - No he leído las ramas en curso de esos bugs: puede que ya hayan tocado archivos compartidos.

**Objeciones bloqueantes**

1. **Seguridad: NK-0096 sin dependencia declarada de NK-0095.**
   - NK-0096 multiplica los sitios donde el texto de una regla pasa a ser instrucción (cinco núcleos de `ai-core`, la biblioteca de playbooks y `get_team_rules` para asistentes externos).
   - Hoy cualquier miembro puede escribir reglas: `drizzle/migrations/0002_multitenant_organizations.sql:128-129`, `src/lib/drive-core.ts:144-152`, `src/lib/inngest/job-runner.server.ts:192-198`.
   - Si NK-0096 se entrega antes que NK-0095 con la `0081` aplicada, se amplía la inyección entre usuarios que NK-0087 dejó abierta.
   - **Corrección:** en la cabecera de NK-0096, «Depende de: NK-0095 (código y `0081` aplicada en la base real)». En su §14, «no se entrega a producción antes de que la entrega de NK-0095 confirme la migración aplicada». Al brief de NK-0096, el mismo requisito.
2. **NK-0093 (en curso) frente a NK-0094: mismo archivo y orden imposible tal como está escrito.**
   - El brief de NK-0093 exige `ScreenState` en la parte de leads de `PipelineBoardPanel` (`src/components/pipeline-board-panel.tsx:7`, `:34`) y a la vez prohíbe tocar archivos de NK-0094.
   - NK-0094 U-3 cambia `pipeline-board-panel.tsx` y `src/components/pipeline-board-panel.test.tsx`, que ya existe.
   - **Corrección (contrato):**
     - NK-0093 puede tocar `pipeline-board-panel.tsx` solo en el bloque de `useLeads` y su estado de carga y error, y añade sus tests en un `describe` propio.
     - Se integra NK-0093 antes de NK-0094 U-3.
     - El brief de NK-0094 toma como base la rama de integración con NK-0093 dentro.
     - Añadir esto al brief de NK-0093 y al §14 de NK-0094.

**Notas para el brief**

- **Orden de integración propuesto:**
  1. NK-0098, independiente: ningún SDD toca `src/routes/_authenticated/route.tsx` ni `session-check.ts`.
  2. NK-0091.
  3. NK-0093.
  4. NK-0095, de U-1 a U-5, con la migración.
  5. NK-0096.
  6. NK-0094, de U-0 a U-5. Es la más grande y se rebasa al final sobre `advisor.ts` y `pipeline-board-panel.tsx`.
  7. Regenerar el manifiesto una vez al final.
  8. Gate.
- **Contrato común:**
  - **`src/lib/knowledge-rules.ts`:** NK-0095 solo añade exportaciones. Nadie cambia `isMandatory`, `pickRules`, `loadAgentRules`, `rulesBlock`, `AGENT_RULE_LIMITS` ni `RULES_READ_FAILED`. Los dos SDD ya lo dicen (NK-0095 §14, NK-0096 §5) y la definición es coherente: `isBindingDoc` (equipo y Reglas u obligatorio) coincide con el filtro de `loadAgentRules` (`knowledge-rules.ts:56`, `:110-112`).
  - **`.lovable/mcp/manifest.json`:** lo cambian NK-0094 (descripciones de métricas), NK-0095 (descripción de `drive_import_to_knowledge`, `:3820`) y NK-0096 (`get_team_rules`). Cada rama lo regenera con el extractor, nunca se fusiona a mano, y quien integra lo regenera tras cada merge. Hay que añadir el manifiesto al alcance de NK-0095.
  - **Tests compartidos:** NK-0094 (CA-10) y NK-0095 (CA-11) añaden casos a `src/lib/agent-tools.test.ts`. Cada ticket va en su `describe` y solo cambia aserciones ajenas cuando lo exige un CA suyo, citándolo.
- **`advisor.ts`:**
  - NK-0091 cambia `:81` y su brief pide un test que compara el snapshot entero, salvo esa clave.
  - NK-0094 CA-12 pone `win_rate_global_pct` a null sin cerrados y añade `ventana_win_rate`, en el mismo `buildSnapshot` y en `src/lib/advisor.test.ts`.
  - Con NK-0091 integrado antes, el brief de NK-0094 U-5 debe permitir explícitamente ampliar el test de comparación de NK-0091, citando CA-12.
  - El null de CA-12 va en el asesor, no en `winRate` de `src/lib/metrics.ts:114-117`: ese `winRate` tiene 6 llamadores fuera de los tests.
- **`job-runner.server.ts`:** NK-0095 toca el caso `drive_import` (`:192-198`) y NK-0096 los casos `stakeholder_research` (`:165-180`) y `playbook_library` (`:413-427`). Son bloques distintos. NK-0096 crea `src/lib/inngest/job-runner.test.ts`. Ahí, o en un test propio de NK-0095, debe ir el caso que cierra la segunda mitad de NK-0095 CA-10.
- **`drive-core.ts`:** NK-0093 cambia `:221` (resúmenes) y NK-0095 `:143-152` (`importToKnowledge`). Los dos pueden crear `src/lib/drive-core.test.ts`, que hoy no existe, y chocar al añadirlo. Lo crea el primero que se integre (NK-0093) y NK-0095 añade un `describe`.
- **Archivos de un solo dueño:** `hub-screen.tsx`, `doc-editor.tsx` y `src/components/drive.tsx` solo los cambia NK-0095. NK-0096 cita `hub-screen.tsx:53` y `:202` sin cambiarlos, así que no hay conflicto. `src/lib/mcp/index.ts` solo lo toca NK-0096, y `src/lib/mcp/tools/metrics.ts` solo NK-0094.
- **NK-0097:** está fuera del sprint. NK-0094 mueve `DataMark` a un sitio común; NK-0097 debe apuntar a la ruta nueva.
- **`src/lib/AGENTS.md`:** NK-0095 añade una línea. `:58` cita `check-migration-journal.mjs`, que no existe: hay que corregirlo o crear el script en un ticket aparte.
- **NK-0091 y `deals.tsx`:** el grep de NK-0091 encontrará también `src/routes/_authenticated/deals.tsx:558` (`?? "outbound"`). NK-0094 excluye `deals.tsx`, así que no hay conflicto.
