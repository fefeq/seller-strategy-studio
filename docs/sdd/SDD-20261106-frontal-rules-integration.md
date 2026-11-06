# SDD-20261106-frontal-rules-integration · [Mejora] Reglas de outreach y reactivación dentro de los módulos existentes

**Tipo:** Mejora · **Prioridad propuesta:** Media
**Estado:** Borrador (decisiones de Fede cerradas el 2026-11-06, ver sección 15; falta su aprobación para ejecutar) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-06
**PRD:** No aplica (mejora acotada) · **Depende de:** — · **Coordinado con:** `SDD-20261106-signal-freshness` (sustituye a la antigua U-2 de este SDD)
**Diseño de origen:** `claude/diseno-integracion-reglas-frontal.md` (Proyecto «Nokko GTM Brain»)

> Un SDD dice cómo se verifica que está bien hecho. Cada CA-n tiene una prueba automática que lo nombra.

## 1. Resumen
Tres cambios pequeños, sin migraciones, en módulos que ya existen: control de calidad de los borradores de outreach, reactivación de deals perdidos según su motivo y dos jugadas nuevas en la biblioteca. La vigencia de las señales por tipo (antes U-2 de este SDD) se hace en `SDD-20261106-signal-freshness`, que queda como única regla. Cada regla vive en un archivo puro con constantes exportadas que leen a la vez la pantalla, el detector y el agente.

## 2. Problema y para quién
Equipos de 2–5 vendedores. (a) El borrador de seguimiento tiene dos límites distintos (≈45 palabras en `followup.ts`, 60 en el prompt de `draft_followup`). (b) Un deal perdido no vuelve a aparecer: solo hay un detector agregado (`repeatedLoss`, ≥3 pérdidas). (c) La biblioteca de jugadas no incluye reactivación ni outreach con señal. (La caducidad uniforme de 7 días de las señales se trata en `signal-freshness`.)

## 3. Evidencia y por qué ahora
- Leído en `main` (HEAD 47ec72c, 2026-11-02): `followup.ts`, `proactive/detectors/{followup-sequence,account-signal,strategy-losses}.ts`, `proactive/{index,types}.ts`, `scoring.ts`, `agent/tools/core-read.ts` (`draft_followup`), `agent/agent.server.ts`, `loss-reasons.ts`, `web-research.ts`, `AGENTS.md` y `src/lib/AGENTS.md`.
- Origen de las reglas: skills públicas de Frontal (MIT), reescritas en español y con palabras propias. Sus ventanas y benchmarks **no citan fuente** y algunos se contradicen: se usan como valores por defecto declarados, nunca como resultado.
- Sin datos de uso de NOKKO sobre respuesta o reactivación: línea base **sin dato**.
- **[Por verificar]** contenido de `roles.ts` frente a los 5 roles de comité; comportamiento en producción.

## 4. Resultado buscado
- Un solo valor de límite de palabras en toda la cadena (UI, detector, herramienta, prompt). Medida: tests de contrato en verde.
- Reactivaciones sugeridas dentro de su ventana, sin inundar Sugerencias. Línea base de aprobación/descarte: **sin dato**; se mide tras 4 semanas con las decisiones ya registradas (no se inventa objetivo).

## 5. Alcance
**Incluye:** `draft-rules.ts`, `revival.ts` + detector + herramienta `draft_revival`, dos jugadas nuevas en `playbooks/base.ts`, línea en `briefing.ts` y `weekly-report.ts`, una línea en el prompt del sistema.
**No incluye:** migraciones; vigencia de señales (SDD `signal-freshness`); fecha de renovación del competidor (decidido: fuera de v1); score de actividad del lead por toques (ver sección 15, decisión 5); multiplicadores de recencia en el score; cambios de roles de comité; proveedores de señales (Apollo/Lusha, Fase B); infraestructura de email; pixel de visitantes; raspado de interacciones; ABM; envío automático de nada.

## 6. Cambios de comportamiento (delta)
**Añadido:** `src/lib/draft-rules.ts`; `src/lib/revival.ts`; detector `closed-lost-revival`; herramienta de lectura `draft_revival`; campo opcional `lostDeals` en `Snapshot`; jugadas «Reactivación» y «Outreach con señal».
**Modificado:** límite de palabras de seguimiento 45/60 → 60 único (`DRAFT_LIMITS`); `draft_followup` devuelve `avisos` si el borrador incumple el lint.
**Eliminado:** el número 45 y el 60 escritos a mano.

## 7. Historias y criterios de aceptación
### H-1: Como vendedor, quiero borradores de seguimiento que respeten un único límite para no editar la longitud a mano.
- **CA-1** `DRAFT_LIMITS` es la única fuente: `followup.ts` y el prompt/descripción de `draft_followup` contienen su valor y ningún otro número de palabras · prueba: `src/lib/draft-rules.test.ts`
- **CA-2** Las plantillas de `followupDraft` (nudge, value, breakup) pasan `lintDraft` · prueba: `src/lib/draft-rules.test.ts`
- **CA-3** `lintDraft` avisa de: exceso de palabras, más de una pregunta, viñetas, exclamaciones/emoji y cumplido genérico; un texto correcto no devuelve avisos · prueba: `src/lib/draft-rules.test.ts`
- **CA-4** `draft_followup` devuelve `avisos` cuando el texto de la IA incumple y no los devuelve cuando cumple; no envía nada ni cambia el lead · prueba: `src/lib/agent-tools.test.ts`

### H-2: Vigencia de señales (movida)
- **CA-5 a CA-8** Sustituidos: los cubre `SDD-20261106-signal-freshness` (CA-1 a CA-5, CA-7, CA-10, CA-11 y CA-12 de ese SDD). Este SDD no implementa nada de señales; la numeración se conserva para no romper referencias.

### H-3: Como vendedor, quiero que NOKKO me avise de cuándo volver a un deal perdido y con qué borrador.
- **CA-9** `revivalStatus` devuelve ventana y motivo por cada clave de `LOSS_REASONS`; `price`, `no_product_fit`, `competitor` y `other` no se reactivan por calendario · prueba: `src/lib/revival.test.ts`
- **CA-10** El detector emite una sugerencia por deal y ventana con `dedupe_key = revival:<deal>:<ventana>`; un deal fuera de su ventana, ganado o abierto no emite · prueba: `src/lib/proactive.test.ts`
- **CA-11** Un máximo por ejecución y **por empresa** (constante `MAX_REVIVALS_PER_RUN`) limita las sugerencias de reactivación; el resto espera a la siguiente · prueba: `src/lib/proactive.test.ts`
- **CA-12** Sin `lostDeals` en el snapshot la regla no dispara (snapshots antiguos siguen funcionando) · prueba: `src/lib/proactive.test.ts`
- **CA-13** `draft_revival` es de lectura, filtra por `org_id`, comprueba con `mustFind` el deal, devuelve borrador sin enviar ni cambiar el deal, y su resultado pasa `lintDraft` o trae `avisos` · prueba: `src/lib/agent-tools.test.ts` (`expectScoped`)
- **CA-14** Cada `action.tool` del detector existe en el registro y en `TITLES`; `.lovable/mcp/manifest.json` está regenerado · prueba: `src/lib/proactive.test.ts` y test de manifiesto existente
- **CA-15** El briefing de Inicio y el informe semanal muestran las reactivaciones con el mismo texto que la sugerencia · prueba: `src/lib/briefing.test.ts` y `src/lib/weekly-report.test.ts`

### H-4: Como Owner/Sales Leader, quiero que la biblioteca incluya jugadas de reactivación y de outreach con señal con los mismos números que las reglas.
- **CA-16** `base.ts` contiene las dos jugadas nuevas y `adapt.ts` las lista como «faltantes» para una empresa que no las tiene · prueba: `src/lib/playbooks.test.ts`
- **CA-17** Los números del texto de las jugadas son los de `REVIVAL_WINDOWS`, `DRAFT_LIMITS` y la tabla de ventanas de `src/lib/signal-freshness.ts` (cambiar la constante cambia el texto) · prueba: `src/lib/playbooks.test.ts`
- **CA-18** El prompt del sistema gana una sola línea que remite a la herramienta para reactivar y a la vigencia de señales; no repite ningún número. Convive con la línea de `proven-findings` (CA-10 de ese SDD): el test de herramientas nombradas cubre ambas · prueba: `src/lib/agent-tools.test.ts`

## 8. Casos límite y errores
- Datos vacíos: deal perdido sin `closed_at` o sin `lost_reason` → no emite (CA-10).
- Duplicados: la clave de dedupe impide repetir una sugerencia descartada.
- Multitenant: toda lectura nueva con `org_id` explícito y `fetchAll`; Telegram/cron/MCP usan cliente privilegiado, así que el filtro es en código (CA-13).
- Histórico: solo deals cerrados dentro de su ventana; tope por ejecución y empresa (CA-11).
- Red/IA caída: `draft_revival` falla con texto «qué pasó + qué hacer» vía `errorText()`; la sugerencia sigue llevando la plantilla sin IA.
- Empresas con biblioteca ya creada: no reciben las jugadas nuevas hasta repetir «crear biblioteca» (idempotente, ya lista solo las que faltan).

## 9. Experiencia y copy
Español, «tú», sin iconos, estados con palabra. Ejemplo: título «Acme (ficticia): vuelve a escribirles, hace 45 días que se quedó en “Mal momento”». Nada afirma tasas de respuesta ni cifras de Frontal. Los textos de producto no mencionan «Frontal».

## 10. Datos, permisos y privacidad
Sin tablas ni columnas nuevas, sin migraciones. Sin cambios de RLS ni GRANTs. `draft_revival` es de lectura (cualquier miembro, como `draft_followup`). Ningún dato de clientes en código, tests, fixtures ni logs: solo datos ficticios.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| `draft_followup` (existente) | regla (plantilla) → modelo barato | `effort: "low"` (sin cambio) | sin dato |
| `draft_revival` (nueva) | regla (plantilla) → modelo barato | `effort: "low"`, bajo demanda del agente | sin dato |
| Detectores, ventanas, lint | regla determinista | ninguno | 0 |

## 12. Unidades de trabajo
| U | Qué entrega (un PR, sin migración) | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | `feat/draft-rules`: `draft-rules.ts`, enganche en `followup.ts` y `draft_followup` | CA-1 a CA-4 | `draft-rules.test.ts` |
| U-2 | Sustituida por `SDD-20261106-signal-freshness` (se ejecuta aparte) | CA-5 a CA-8 (allí) | — |
| U-3 | `feat/closed-lost-revival`: `revival.ts`, `lostDeals`, detector, `draft_revival`, briefing y semanal, manifiesto | CA-9 a CA-15 | `revival.test.ts`, `proactive.test.ts`, `agent-tools.test.ts` |
| U-4 | `feat/playbook-base-plays`: dos jugadas, línea de prompt | CA-16 a CA-18 | `playbooks.test.ts` |

Orden global de los tres SDD del 2026-11-06: U-1 de este SDD → `signal-freshness` → `proven-findings` → U-3 → U-4. U-4 va última porque depende de las constantes de las anteriores. Dos PR no pueden ir en paralelo si tocan `proactive.test.ts` o `agent-tools.test.ts`.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Patrón existente a copiar: `guia.mensaje` en `get_setup_status` («no elijas tú el siguiente paso»), constantes interpoladas en descripciones de herramientas (`BUYING_ROLES`), un detector por archivo listado en `DETECTORS`.
- `followupStatus`/`followupDraft` no se tocan salvo para cumplir CA-1/CA-2. `late_lead` y la secuencia siguen como están.
- `lostDeals`: campo opcional en `Snapshot` (`proactive/types.ts`), cargado en `loadSnapshot` (`org-data.ts`), no dependiente de `strategy`.
- Tras cambiar herramientas: `node node_modules/@lovable.dev/mcp-js/dist/cli/extract-manifest.cjs .` (hace falta `bun install` antes) y añadir el título a `TITLES`.
- Descartado: módulo «frontal»; multiplicadores de score; esquema de 7 campos por jugada; ICP en tres capas.

## 14. Riesgos y dependencias
- Ventanas sin fuente: se declaran «por defecto» y se miden con las decisiones de Sugerencias.
- Ruido en Sugerencias: mitigado con ventana + tope por empresa (CA-11); si aun así molesta, se baja el tope sin migración.
- Jugadas ya sembradas: aviso manual al Owner (sección 8).
- Revisión del gate obligatoria por PR; el autor no califica su propio trabajo.

## 15. Decisiones y preguntas
Decididas por Fede el 2026-11-06:
1. Orden 1→4 (con la U-2 sustituida, ver sección 12).
2. Seguimiento unificado en 60 palabras.
3. Fecha de renovación del competidor fuera de v1.
4. Tope de reactivaciones por empresa (CA-11).
5. Definición de «toque» para el score de actividad del lead: mensaje saliente, llamada o reunión registrada con ese lead. **El score sigue fuera de v1**: ese registro no está construido y necesita su propio SDD; aquí solo queda fijada la definición.
6. Valores de ventana de lanzamiento, alianza y expansión: los de la tabla de `signal-freshness`.
Abierta: valor concreto de `MAX_REVIVALS_PER_RUN` (por defecto, 5, igual que el tope de señales; Claude Code lo anota y Fede lo ajusta tras ver el lote real).

## 16. Pendiente de verificar
- `roles.ts` frente a los 5 roles de comité → Claude Code lo compara y lo reporta sin cambiarlo.
- Deals perdidos por motivo y fecha de cierre en preproducción (conteos agregados) → Claude Code, antes de abrir el PR de U-3.
- Comportamiento real en producción → solo Fede, tras publicar.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
- Veredicto del gate: No revisado
- CA sin prueba posible o sin G-n: sin revisar
- [Por verificar] que sigue sin comprobarse: sin revisar
- Contradicciones con el código o con decisiones previas: sin revisar
- Lo que esta revisión NO demuestra: sin revisar

## 18. Delta de implementación (lo rellena el agente al entregar)
Pendiente. Estado a «En curso» al empezar U-1; «Hecho» solo cuando el gate pase y Fede apruebe la entrega.
