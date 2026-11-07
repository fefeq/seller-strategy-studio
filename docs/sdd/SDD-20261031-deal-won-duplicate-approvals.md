# SDD-20261031-deal-won-duplicate-approvals · [Bug] Soltar un deal en «Ganado» crea una solicitud de aprobación por cada intento

**Tipo:** Bug · **Severidad propuesta:** S3 (el fallo existe en el código, pero el 2026-10-31 no había ninguna solicitud pendiente en la base leída; ver §3)
**Prioridad propuesta:** Baja · **Estado:** Borrador · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-31
**PRD:** No aplica (bug acotado; contexto en `docs/UX-INFORME-20261031.md`) · **Depende de:** — · **Ticket:** por asignar
**Base de trabajo:** `origin/main` (decidido por Fede el 2026-10-31). Este SDD se leyó sobre `feat/software-factory`, que puede estar desfasada: **[Por verificar]** que `deals.tsx:59-74` y `approvals.tsx` sean iguales en `origin/main` y reproducir allí el fallo antes de U-1.

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre.
> Al no haber PRD, los objetivos G-n se definen en §4 y cada CA cita el suyo.

## 1. Resumen
Mover un deal a «Ganado» no lo mueve: crea una solicitud en Aprobaciones. Hoy se crea una solicitud nueva en cada intento, aunque ya haya una pendiente para ese deal, y la tarjeta no cambia ni dice que está esperando. Quien suelta el deal dos veces, o dos personas a la vez, llena Aprobaciones de duplicados. Este bug pide una sola solicitud pendiente por deal, que se vea cuál espera y que no se pueda mover un deal con solicitud pendiente hasta resolverla.

## 2. Problema y para quién
Sales Leader, Owner y Deal Desk, que aprueban, ven solicitudes repetidas y no saben cuál es la buena. Quien mueve el deal no ve que ya lo pidió y vuelve a intentarlo.

## 3. Evidencia y por qué ahora
Leído el 2026-10-31 en `seller-strategy-studio` (`feat/software-factory`; las líneas pueden moverse). Lectura de código; **no se ha reproducido en la app en vivo** y **no hay datos de uso**.
- `move` en `src/routes/_authenticated/deals.tsx:59-74`: si la etapa destino es `won`, inserta una fila en `approvals` (tipo `stage_change`, título «Marcar como Ganado: …», evidencia con `deal_id` y `stage` como texto JSON) y avisa con un toast; **no comprueba si ya hay una pendiente** para ese deal (`:65-69`). Después invalida las consultas, pero la tarjeta no cambia.
- El mismo `move` lo usan el arrastre y el selector «Etapa» del panel del deal (`:182`).
- Aprobaciones (`src/routes/_authenticated/approvals.tsx:43-60`): lista las pendientes con «Aplicar» y «Omitir», sin agrupar por deal.
- Relación deal↔aprobación: está dentro del texto de `evidence` (JSON como texto); **[Por verificar]** que no exista ya otra forma fiable de identificarla.
- Reproducción (datos ficticios): en Pipeline, con un deal «Cuenta Demo – Plan A» en una etapa abierta, suelta su tarjeta dos veces seguidas en «Ganado» (o pide el cambio dos veces desde su panel). Resultado actual: dos solicitudes pendientes iguales en Aprobaciones; la tarjeta sigue en su etapa.
- Hoy un deal con solicitud pendiente se puede mover a otra etapa; la solicitud queda sin relación con el estado real del deal (**[Por verificar]** qué ocurre al aplicarla entonces).
- **Medido el 2026-10-31** (solo lectura, solo agregados, con el conector de Lovable sobre el proyecto «Seller Strategy Studio»): 2 empresas, 1 deal, 0 deals en «Ganado», **0 filas en `approvals`**, 0 pasos a «Ganado» en el historial. Es decir, hoy no hay solicitudes duplicadas ni de ningún tipo en esa base. Eso **no prueba que el fallo no ocurra** (casi no hay uso de «Ganado»), solo que aún no ha dejado rastro. **[Por verificar]** que esa base sea la de producción de nokko.ai y no solo la del proyecto de Lovable.

## 4. Resultado buscado
- **G-1** Un deal no tiene nunca más de una solicitud pendiente para pasar a «Ganado».
- **G-2** Se ve en la tarjeta qué deals esperan aprobación.
- **G-3** No cambia quién aprueba, ni el contenido de la solicitud, ni el resto de movimientos de etapa.
- Métrica de éxito: solicitudes pendientes de «Ganado» por deal ≤ 1 (medido en la base de datos tras la entrega; línea base: **sin dato**).

## 5. Alcance
**Incluye:**
- Una sola solicitud pendiente de «Ganado» por deal, también con peticiones simultáneas.
- Aviso claro si ya está pendiente.
- Marca «Pendiente de aprobación» en la tarjeta del deal, visible para cualquier miembro de la empresa.
- No mover a otra etapa un deal con solicitud pendiente de «Ganado» (propuesta; Fede confirma en §15 · 2).
- Duplicados existentes: hoy hay 0 (§3); no hace falta limpieza. Se vuelve a contar justo antes de U-2.

**Comportamiento que NO debe cambiar (regresión):** quién puede aprobar; el texto y los datos de la solicitud; que crear una solicitud no cambia la etapa, la probabilidad ni el historial del deal; que «omitir» no mueve el deal; el movimiento a cualquier otra etapa de un deal sin solicitud pendiente; el aviso de cualificación (MEDDPICC); la regla de que «Ganado» exige aprobación; el aislamiento entre empresas.

**No incluye:**
- «Mover a…» en el menú de la tarjeta y arrastre accesible (SDD `ux-move-without-drag`).
- Cambiar etapas, probabilidades o roles.
- Rediseño de Aprobaciones.
- Crear aprobaciones de otro tipo.

## 6. Cambios de comportamiento (delta)
**Añadido:** marca «Pendiente de aprobación» en la tarjeta; aviso «Ya está pendiente de aprobación»; bloqueo de movimiento con solicitud pendiente (por confirmar).
**Modificado:** mover un deal a «Ganado» con una solicitud ya pendiente → no crea otra (antes creaba una por intento).
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como persona que mueve un deal a Ganado, quiero que se pida la aprobación una sola vez.
- **CA-1** CUANDO se pide mover un deal a «Ganado», por arrastre o por el selector «Etapa» de su panel, y no tiene solicitud pendiente, el sistema DEBE crear una sola solicitud de aprobación y avisar «Enviado a Aprobaciones: mover a Ganado requiere aprobación.» · cubre G-1, G-3 · prueba: `src/lib/won-approval.test.ts`
- **CA-2** SI el deal ya tiene una o más solicitudes pendientes para pasar a «Ganado», ENTONCES el sistema NO DEBE crear otra, por ninguno de los dos caminos, y DEBE avisar «Ya está pendiente de aprobación. Míralo en Aprobaciones.» con enlace a Aprobaciones · cubre G-1 · prueba: `src/lib/won-approval.test.ts`
- **CA-3** SI dos personas, o dos clics, piden a la vez que el mismo deal pase a «Ganado», ENTONCES el sistema NO DEBE dejar más de una solicitud pendiente para ese deal, y quien llegue segundo DEBE ver el aviso de CA-2 · cubre G-1 · prueba: `src/lib/won-approval.pg.test.ts` (peticiones simultáneas contra una base de pruebas; puede exigir un cambio de datos, ver §10)
- **CA-4a** CUANDO la solicitud anterior de un deal ya se aplicó o se omitió y se pide «Ganado» otra vez, el sistema DEBE crear una solicitud nueva (si el deal no está ya Ganado) · cubre G-1 · prueba: `src/lib/won-approval.test.ts`
- **CA-4b** SI el deal ya está en «Ganado», ENTONCES el sistema NO DEBE crear solicitud y DEBE avisar «Este deal ya está Ganado» (decidido por Fede el 2026-10-31) · cubre G-1 · prueba: `src/lib/won-approval.test.ts`
- **CA-4c** SI falla el guardado de la solicitud, ENTONCES el sistema DEBE avisar con «qué pasó + qué hacer» y NO DEBE mostrar la marca de pendiente · cubre G-1 · prueba: `src/lib/won-approval.test.ts`
- **CA-4d** El sistema DEBE contar solo las solicitudes pendientes de la empresa activa: una pendiente en otra empresa no afecta a este deal · cubre G-3 · prueba: `src/lib/won-approval.pg.test.ts` (dos empresas de prueba)

### H-2: Como miembro de la empresa, quiero ver qué deals esperan aprobación.
- **CA-4** MIENTRAS un deal tenga una o más solicitudes pendientes de «Ganado», el sistema DEBE mostrar en su tarjeta «Pendiente de aprobación» a cualquier miembro de la empresa · cubre G-2 · prueba: `src/components/won-pending.test.tsx` (**[Por verificar]** que todo miembro pueda leer las aprobaciones: si la política de datos lo limita a quien aprueba, este CA no se cumple sin un cambio aparte)
- **CA-5** CUANDO la solicitud pasa a aplicada o a omitida («omitir» = rechazar; no mueve el deal), el sistema DEBE actualizar la lista de aprobaciones y la tarjeta en la siguiente carga o refresco de la pantalla, sin marca de pendiente · cubre G-2 · prueba: `src/components/won-pending.test.tsx` (la consulta se invalida y la tarjeta cambia; **[Por verificar]** si hay actualización en vivo)

### H-3: Como Sales Leader, quiero que un deal con solicitud pendiente no cambie de etapa por otro camino.
- **CA-6** SI el deal tiene una solicitud pendiente de «Ganado» y se intenta moverlo a cualquier otra etapa (abierta o «Perdido»), por arrastre o por selector, ENTONCES el sistema NO DEBE moverlo y DEBE avisar «Tiene una solicitud pendiente para pasar a Ganado. Resuélvela en Aprobaciones.» con enlace · cubre G-1, G-3 · prueba: `src/lib/won-approval.test.ts` (decidido por Fede el 2026-10-31: se bloquea)

### H-4: Regresión
- **CA-7** El sistema DEBE seguir moviendo con las mismas reglas (cualificación, probabilidad, historial) cualquier deal sin solicitud pendiente a cualquier etapa distinta de «Ganado» · cubre G-3 · prueba: pruebas existentes de etapas y `src/lib/won-approval.test.ts`
- **CA-8** El sistema DEBE seguir permitiendo aplicar u omitir la solicitud solo a quien hoy puede · cubre G-3 · prueba: pruebas existentes de aprobaciones (**[Por verificar]** que existan; si no, se añade una)

## 8. Casos límite y errores
- **Falla el guardado de la solicitud:** CA-4c.
- **Solicitud aplicada u omitida y se pide otra vez:** CA-4a; la marca desaparece (CA-5).
- **Duplicados existentes:** CA-2, CA-4 y CA-6 valen con una o más pendientes. **La limpieza de duplicados existentes es precondición de U-2** (una garantía de unicidad no se puede aplicar con duplicados pendientes); Fede decide cómo en §15 · 3.
- **Otra empresa (multitenant):** CA-4d.
- **Deal ya Ganado:** CA-4b.
- **Varias personas a la vez:** CA-3.

## 9. Experiencia y copy
- Español, «tú», sin iconos. Propuestas, a aprobar por Fede (guía de voz de Nokko: **[Por verificar]**): marca «Pendiente de aprobación»; «Ya está pendiente de aprobación. Míralo en Aprobaciones.»; «Tiene una solicitud pendiente para pasar a Ganado. Resuélvela en Aprobaciones.»; el aviso de envío que ya existe.

## 10. Datos, permisos y privacidad
- Hoy el deal de cada solicitud está dentro del texto de la evidencia. **CA-3 puede exigir una garantía de unicidad en la base** (una forma de identificar el deal y de impedir dos pendientes), lo que sería un cambio de datos: **no está aprobado en este SDD**. Si Dani lo ve necesario, lo propone y Fede lo aprueba aparte antes de U-2.
- Permisos: no cambian. Datos ficticios en pruebas y capturas.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna | — | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | Regla única «¿hay solicitud pendiente?» y aviso, sin crear duplicados en el caso simple (arrastre y selector) | CA-1, CA-2, CA-4a, CA-4b, CA-4c, CA-6, CA-7, CA-8 | `src/lib/won-approval.test.ts` |
| U-2 | Garantía ante peticiones simultáneas y aislamiento por empresa. **Precondición:** decisión de datos aprobada y duplicados existentes limpiados | CA-3, CA-4d | `src/lib/won-approval.pg.test.ts` |
| U-3 | Marca «Pendiente de aprobación» en la tarjeta. **Puede depender de la relación estructurada deal↔solicitud** (§13), es decir, de la decisión de datos | CA-4, CA-5 | `src/components/won-pending.test.tsx` |

Orden: U-1 → U-3 → U-2. Si la relación estructurada hace falta para U-3, U-3 espera a esa decisión.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Comprobar en el cliente antes de insertar no es atómico (CA-3): una garantía en la base o una operación única en servidor lo resolvería. Decisión de Dani.
- Identificar el deal de la solicitud: hoy solo en el texto de la evidencia. Una forma estructurada evitaría interpretar texto en cada render de la tarjeta.
- `move` (`deals.tsx:59-74`) es el único punto de entrada de arrastre y selector; basta tocarlo ahí.
- Para la prueba de carrera, el repo ya tiene el patrón de pruebas contra una base de pruebas (`*.pg.test.ts`).

## 14. Riesgos y dependencias
- Si hay solicitudes duplicadas ya creadas, la marca y el bloqueo se aplican sobre una de ellas; hay que decidir qué pasa con el resto (§15 · 3).
- Bloquear el movimiento con solicitud pendiente cambia un comportamiento actual (CA-6); si Fede lo rechaza, hay que decidir qué hacer con una solicitud huérfana.
- El SDD `ux-move-without-drag` ofrece «Ganado» en el menú de la tarjeta solo cuando este bug esté entregado.

## 15. Preguntas para Fede y para la revisión técnica
1. Severidad: S3 propuesta y prioridad Baja, porque hoy hay 0 solicitudes (§3). Fede la sube si espera uso de «Ganado» pronto. **Abierta.**
2. ~~¿Bloquear mover un deal con solicitud pendiente?~~ **Decidido por Fede (2026-10-31): sí, bloquear** (CA-6).
3. ~~¿Qué hacemos con los duplicados ya existentes?~~ **Resuelto:** hay 0, sin limpieza; se recuenta antes de U-2.
4. Para el gate: ¿cómo garantizar una sola pendiente (§10, §13)? ¿Hay otra forma ya fiable de relacionar solicitud y deal? ¿Puede leer `approvals` cualquier miembro (CA-4)?
5. ~~Deal ya Ganado: ¿aviso sin crear solicitud?~~ **Decidido por Fede (2026-10-31): sí** (CA-4b).
6. ~~Base de trabajo~~ **Decidida por Fede (2026-10-31): `origin/main`.** Pendiente reproducir el fallo allí.

## 16. Pendiente de verificar
- Que la base medida (0 aprobaciones) sea la de producción de nokko.ai, y reproducir el fallo en `origin/main`.
- Cómo identifica `approvals` al deal y si hace falta un cambio de datos.
- Qué ocurre hoy al aplicar una solicitud cuando el deal ya cambió de etapa.
- Si las aprobaciones se actualizan en vivo (CA-5).
- Guía de voz de Nokko para los textos de §9.
- Que existan pruebas de aprobaciones (CA-8).

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
- Veredicto del gate: PASS (`gate.mjs`, ticket NK-0051, commit 8ee3543f3b80; informe literal debajo)
- CA sin prueba posible o sin G-n: no revisado
- [Por verificar] que sigue sin comprobarse: ver §16
- Contradicciones con el código o con decisiones previas: no revisado
- Lo que esta revisión NO demuestra: el gate automático no evalúa los CA uno a uno, ni la app en vivo, ni claro/oscuro, táctil, Safari/Firefox ni lectores de pantalla; no hay segunda máquina ni soak (ver informe).

Informe del gate, sin editar:

```
PASS  clean tree on exact commit  8ee3543f3b80b0f6847f1ba1ae784a1735b52bee
PASS  canary: runner detects failure
PASS  guard: no `as any`
PASS  guard: no window.confirm/prompt
PASS  guard: no committed secrets
PASS  guard: no secret in VITE_ vars
PASS  guard: no .only/.skip in tests
PASS  guard: no raw error.message toasts
PASS  guard: .env untouched
PASS  guard: assertions not weakened
PASS  guard: no longer timeouts in tests
PASS  typecheck
PASS  lint (touched files, 75)
PASS  release build (outside network best-effort blocked)
PASS  full unit suite  2936/2936 passed; known failures 0; unexpected 0; files with no assertion run 0
PASS  touched test files, whole (10)
PASS  second-machine full run  NOT RUN: no second runner configured; canary + secret guard above are the local substitute
PASS  artifact size recorded  NOT A SOAK: file handles, memory and restarts are not measured here
PASS  extra: bunx vitest run src/lib/won-approval.pg.test.ts src/lib/board-move.pg.test.ts

VERDICT PASS on 8ee3543f3b80  evidence: /Users/fedecosentino/NOKKO GTM BRAIN/seller-strategy-studio/.factory/evidence/NK-0051/8ee3543f3b80
```

## 18. Delta de implementación (lo rellena el agente al entregar)
Pendiente.

---
Validación: pendiente. SDD nuevo, sale del SDD `ux-move-without-drag`. Auditoría independiente ronda 1: «Bloqueado»; se corrigieron los puntos mecánicos (CA nuevos de ya Ganado, fallo, nueva solicitud, otra empresa; caminos; precondición de U-2). Decisiones de Fede del 2026-10-31 aplicadas (base `origin/main`, bloquear con solicitud pendiente, aviso si ya está Ganado, sin limpieza porque hay 0 duplicados). **Quedan abiertas** la severidad (§15 · 1), los textos y la decisión de datos de Dani; no hay segunda ronda ni gate.
