# SDD-20261028-no-explicit-any-cleanup · [Mejora] Cero usos del tipo `any` explícito, sin cambio visible

**Tipo:** Mejora · **Prioridad propuesta:** Media (la regla ya existe en `AGENTS.md` y hoy no se cumple) · **Track:** medio (un PR por unidad, sin cambios de datos)
**Estado:** Borrador · **Pide:** Fede · **Para:** Dani · **Fecha:** 2026-10-28

## 1. Resumen
Tras el SDD `SDD-20261028-hooks-lint-hygiene` (fusionado en `main`, commit `90811098`), el lint reporta 14.941 problemas (14.900 errores y 41 warnings). El siguiente grupo con riesgo real son los **111 usos de `any` explícito** (regla `@typescript-eslint/no-explicit-any`, nivel error) repartidos en 45 archivos: 106 en código de producción y 5 en pruebas. Se pide sustituirlos por tipos concretos, **sin cambiar el comportamiento**, y dejar la regla en 0.

## 2. Problema y para quién
`AGENTS.md` dice: «No `as any`: use the generated types (Tables/TablesUpdate)… a casting gap is a narrow typed cast with a reason». El roadmap marca «6. Quitar `as any`» como hecho, pero el lint de hoy sigue reportando 111 usos de `any`. Con `any`, el verificador de tipos no detecta errores de forma en datos de Supabase, de proveedores (Apify, Apollo, Clay, Stripe, PostHog…) ni de la IA, así que un error de campo aparece en ejecución y no al compilar. Afecta a quien mantiene el código (Dani y su agente). No afecta hoy a usuarios finales (sin dato de incidencias; fuente: ninguna consultada).

## 3. Evidencia y por qué ahora
- Salida de `npx eslint . -f json` del 2026-10-28 sobre `main` (commit `90811098`): 111 mensajes de `no-explicit-any`, 45 archivos, 5 en pruebas (fuente: ejecución propia con dependencias instaladas por `npm` sin lockfile).
- Concentración: `agent.tsx` (12) y `ai-text.tsx` (11) suman 23 y repiten el mismo bloque de renderizado de Markdown; `setup/wizard.tsx` (11); `account/stakeholders-tab.tsx` (7); `assignment.functions.ts` (6).
- Ya existen 5 silenciados con motivo en el repo (3 archivos de pruebas de base de datos, 1 línea en `migrations.pg.test.ts` y `strategy-execute-core.ts`).
- Por qué ahora: el SDD de hooks dejó el lint de hooks en 0; este es el siguiente grupo que puede ocultar fallos. Es apuesta de Fede por mantenimiento, sin dato de impacto en usuarios.

## 4. Resultado buscado
- `npx eslint src --rule 'prettier/prettier: off' -f json` no devuelve ningún mensaje de `@typescript-eslint/no-explicit-any`, salvo los silenciados con motivo (CA-3). Fuente: salida de ese comando, medida con el `bun.lock` de Dani.
- `npx tsc --noEmit` y todas las pruebas siguen pasando, sin eliminar ni saltar ninguna (hoy pasan al 100 %; fuente: `tsc`, `vitest`).

## 5. Alcance
**Incluye:**
- Los 111 usos de `any` explícito listados en la sección 6.
- Una prueba por cada CA de la sección 7 que hoy no tenga prueba, donde se toque lógica.

**No incluye:**
- El resto del lint: 14.776 avisos de formato Prettier, 41 `only-export-components`, 11 `no-unused-expressions`, 1 `no-control-regex`, 1 `ban-ts-comment`. Cada grupo merece su propio SDD.
- Reformatear archivos con Prettier (reescribe el diff que sincroniza Lovable).
- Activar las opciones estrictas extra del verificador de tipos (`AGENTS.md` dice que están apagadas a propósito).
- Cambios de esquema, datos, pantallas o textos.
- Arreglar errores de funcionamiento que el tipado correcto pueda destapar: se anotan y se abren como Bug aparte (CA-5).

## 6. Cambios de comportamiento (delta)
**Añadido:** nada visible.
**Modificado:** solo tipos internos; comportamiento antes → después idéntico.
**Eliminado:** 111 usos de `any` explícito.

Reparto por archivo, con suma comprobada contra la salida del lint (fuente: salida del lint del 2026-10-28; los números de línea los ofrece el lint, no se copian aquí):

| Unidad | Archivos (usos) | Total |
|---|---|---|
| U-1 Render de Markdown duplicado | `components/agent.tsx` (12), `components/ai-text.tsx` (11) | 23 |
| U-2 Pantallas y rutas | `setup/wizard.tsx` (11), `account/stakeholders-tab.tsx` (7), `account/meetings-tab.tsx` (5), `background.tsx` (3), `routes/_authenticated/cycle.tsx` (3), `account/calls-deals-tabs.tsx` (2), `import-review.tsx` (2), `strategy/positioning.tsx` (2), `routes/_authenticated/deals.tsx` (2), y 10 archivos con 1 uso cada uno (`plan-tab`, `icp-editor`, `parallel`, `case-clinic`, `journey`, `prototypes`, `use-me`, `approvals`, `metrics`, `people`) | 47 |
| U-3 Módulos de servidor y librería | `assignment.functions.ts` (6), `apify.ts` (4), `leads.ts` (4), `ai-core.ts` (2), `apify-core.ts` (2), `job-runner.server.ts` (2), `web-research-core.ts` (2), y 14 archivos con 1 uso cada uno (4 herramientas del agente, `ai.functions`, `apollo-gateway`, `clay-gateway`, `firecrawl`, `icp`, `imports.functions`, `parallel-core`, `posthog.functions`, `stripe.functions`, webhook de Telegram) | 36 |
| U-4 Pruebas | `agent-tools.test.ts` (3), `migrations.pg.test.ts` (1), `migrations-acquisition-motion.pg.test.ts` (1) | 5 |

Comprobación de la suma: 23 + 47 + 36 + 5 = 111, sobre 2 + 19 + 21 + 3 = 45 archivos (U-1: 2; U-2: 9 con varios usos y 10 con uno; U-3: 7 con varios usos y 14 con uno; U-4: 3).

## 7. Historias y criterios de aceptación
### H-1: Como mantenedor, quiero que el verificador de tipos detecte errores de forma en datos externos
- CA-1: CUANDO se ejecute el comando de la sección 4, el resultado DEBE contener 0 avisos de la regla contra el tipo `any` explícito, sin contar los silenciados según CA-3.
- CA-2: CUANDO se ejecute el verificador de tipos sobre el repo, el sistema DEBE terminar sin errores.
- CA-3: SI un uso de `any` no puede sustituirse por un tipo concreto, ENTONCES DEBE quedar silenciado con un comentario de motivo en la misma línea, y el PR DEBE listarlo. Máximo 10 silenciados nuevos en código de producción; en pruebas se admite un único silenciado por archivo con motivo común, como ya hacen los archivos de pruebas de migraciones.
- CA-4: SI hace falta un salto de tipos, ENTONCES el sistema DEBE usar una conversión acotada con su motivo, y NO DEBE introducir `as any` ni comentarios de supresión de tipos nuevos.

### H-2: Como persona usuaria, quiero que nada cambie en pantalla
- CA-5 (regresión): SI al tipar correctamente aparece un fallo de funcionamiento real, ENTONCES el sistema DEBE conservar el comportamiento actual y el fallo DEBE anotarse en la descripción del PR para abrir un Bug aparte.
- CA-6 (regresión): El sistema DEBE mostrar el mismo texto formateado (párrafos, listas, tablas, enlaces, código y encabezados) en el chat del agente y en los textos generados por IA, para la misma entrada de Markdown.
- CA-7 (regresión): El sistema DEBE pasar todas las pruebas existentes sin modificarlas, salvo las 3 que usan `any` en `agent-tools.test.ts`, y sin eliminar ni saltar ninguna.
- CA-8 (regresión): CUANDO se construya la aplicación para producción, el sistema DEBE terminar sin errores.

## 8. Casos límite y errores
- Datos de proveedores con campos opcionales o ausentes: el tipado DEBE reflejarlos como opcionales; el comportamiento con campos ausentes no cambia (CA-5).
- Filas de Supabase con campos JSON: se leen con los ayudantes existentes (`jsonObject`, `actionTool`) y se escriben con `as unknown as Json`, según `AGENTS.md` (CA-4).
- Entrada de Markdown vacía o con tabla vacía en el chat del agente: se muestra igual que hoy (CA-6).
- Un `any` en un manejador de eventos de un proveedor externo sin tipos publicados: se silencia con motivo (CA-3).

## 9. Experiencia y copy
Sin cambios de pantalla ni de texto.

## 10. Datos, permisos y privacidad
Sin cambios en datos, permisos ni integraciones. No toca LinkedIn. Las pruebas nuevas usan datos ficticios (`demo@ejemplo.com`, «Cuenta A»).

## 11. Unidades de trabajo
Un PR por unidad, en este orden. Cada unidad deja `tsc`, pruebas y la regla en verde antes de pasar a la siguiente:
- U-1: render de Markdown de `agent.tsx` y `ai-text.tsx` (cubre CA-6). Es la que más reutiliza.
- U-2: pantallas y rutas (cubre H-1 en componentes).
- U-3: módulos de servidor y librería (cubre H-1 en servidor; es la de más riesgo por tocar datos de proveedores).
- U-4: pruebas, y cierre de la regla (cubre CA-1).

## 12. Notas técnicas [Sugerencia — Dani valida]
- U-1: `agent.tsx` y `ai-text.tsx` repiten el mismo mapa de elementos de Markdown con `(p: any)`. Sugerencia: un único módulo compartido con los tipos de props de los elementos, que ambos usen. Reutilizar antes de crear.
- Filas de Supabase: usar los tipos generados (`Tables`, `TablesUpdate`) y los ayudantes de `src/lib/json.ts`, como pide `AGENTS.md`.
- Datos de proveedores (Apify, Apollo, Clay, Firecrawl, Stripe, PostHog, Telegram): definir tipos mínimos con los campos que el código lee realmente; `unknown` más comprobación de forma cuando el dato no se controla.
- Cada unidad puede apoyarse en la salida del lint para listar sus usos exactos al empezar.
- Las cifras (111, 45 archivos, 14.941) se midieron con `npm` sin lockfile porque `bun.lock` apunta a un mirror privado que el entorno de esta sesión no alcanzó; con el lock, el recuento puede variar.
- Roadmap: el ítem «6. Quitar `as any`» figura como hecho; conviene que Dani confirme si cubría solo `as any` y no `: any`.

## 13. Riesgos y dependencias
- Tipar bien puede destapar errores de forma ya presentes. Mitigación: CA-5 (no arreglar en silencio; anotar y abrir Bug).
- U-3 toca módulos que llaman a proveedores de pago o de datos; sin pruebas contra los servicios reales, el riesgo se contiene con tipos mínimos y revisión de Dani.
- Lovable sincroniza los commits de la rama conectada: cada PR debe mantener la rama funcional y no reescribir historia publicada (`AGENTS.md`).
- Dependencia: ninguna con otros SDD. El SDD de hooks (`SDD-20261028-hooks-lint-hygiene`) ya está fusionado.

## 14. Preguntas para Dani
1. ¿Prefieres un PR por unidad (4) o uno solo?
2. ¿Existe un tipo compartido para las respuestas de los proveedores o se define por proveedor?
3. ¿Qué pruebas cubren hoy `assignment.functions.ts`, `apify.ts` y `leads.ts`, y qué datos de referencia uso para CA-5?
4. ¿El ítem 6 del roadmap («Quitar `as any`») cubría `: any` o solo `as any`?
5. ¿Hay CI que ejecute lint y `tsc`? Si no, ¿cómo se comprueba CA-1 y CA-2 en cada PR?

## 15. Pendiente de verificar
- [Por verificar] Qué hay desplegado en `production` frente a `main`: el análisis es de `main`, sin acceso a producción.
- [Por verificar] Que el desglose por archivo sigue vigente en la rama que use Dani (el lint cambia con cada fusión).
- [Por verificar] Que ninguno de los 111 usos es necesario por una restricción real de un proveedor sin tipos (CA-3 cubre esos casos).
- [Por verificar] Qué cubren hoy las pruebas de las pantallas y módulos de las unidades U-2 y U-3: no lo he comprobado.

## 16. Sección de Dani (la completa él)
- Diseño técnico:
- Tareas:
- Estimación:
- Decisión: Aceptado / Cambios pedidos / Rechazado

---
Validación: pendiente de linter, auditoría y OK de Fede.
