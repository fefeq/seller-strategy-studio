# SDD-20261113-email-verification-apollo · [Feature] Guardar el estado de Apollo al revelar y registrar el gasto

**Tipo:** Feature · **Prioridad propuesta:** Media
**Estado:** En curso · **Pide:** Fede · **Aprueba:** Fede (autorización general) · **Fecha:** 2026-11-13
**PRD:** docs/prd/PRD-20261113-verificacion-de-email.md · **Depende de:** SDD-20261113-email-verification-model

## 1. Resumen
Cada revelado de Apollo guarda el estado del email que ya viene en la respuesta en `email_verifications`, escrito solo por el servidor con `org_id` explícito. Todo revelado (pantalla, agente, MCP y orquestador) registra su gasto en `integration_usage`. Lo manual con coste deja de pausarse al llegar al límite (Q-6) y un email distinto de Apollo se conserva y se propone, nunca se sustituye (aclaración de Fede).

## 2. Problema y para quién
Hoy el estado del email se lee y se tira, y parte del gasto de Apollo no entra en `org_budgets` (PRD 3.4). Owner y Sales Leader necesitan el gasto real; cualquier miembro necesita que el estado quede guardado para las superficies del SDD 3.

## 3. Evidencia y por qué ahora
Leído en `main` @ f6efda9. `apollo-gateway.ts:310` sustituye el email del stakeholder si Apollo devuelve otro; `:201` solo rellena vacíos. `apollo.functions.ts:30,35` y `agent/tools/apollo.ts:141,168` llaman a los núcleos sin `logUsage`; solo `revealKeyPeople` (`runner.ts:477-485`) registra. `planFor` (`planner.ts:165-167`) descarta opciones con `cost > remaining` sea cual sea el disparador; la sonda del PRD confirmó que un `find_email` manual se bloquea al 100 %. Sin datos de uso.

## 4. Resultado buscado
G-1: cada revelado deja estado guardado. G-3: ningún revelado gasta sin fila en `integration_usage`; lo manual se registra siempre y nunca se bloquea por presupuesto. G-5: reparto de estados disponible en base de datos. Línea base sin dato; se verifica por prueba automática.

## 5. Alcance
**Incluye:** escritura de `email_verifications` en los dos núcleos de revelado; registro de gasto dentro de los núcleos (todas las rutas lo heredan); alineación de `revealKeyPeople` (deja de registrar por su cuenta); cambio transversal Q-6 en `planFor` y corrección de los textos que lo describen; conservar y proponer en `revealStakeholder`.
**No incluye:** interfaz de estados ni puerta en borradores (SDD 3); necesidad `verify_email` ni verificador independiente (2b); cambios en NK-0171; revelado de leads o people (no existe); ninguna llamada de pago nueva.

## 6. Cambios de comportamiento (delta)
**Añadido:** fila de verificación por email revelado (estado mapeado cerrado por defecto, valor literal corto, fecha, quién lo pidió); registro de gasto en pantalla y agente; propuesta visible cuando Apollo devuelve un email distinto.
**Modificado:** `planFor` — lo manual ignora `remaining` (sigue registrando); `revealStakeholder` — un email distinto ya no sobrescribe, se devuelve como propuesta; `revealKeyPeople` — el registro lo hace el núcleo.
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como miembro, quiero que lo que pido yo no se pare por el límite mensual.
- **CA-1** Una necesidad manual con coste y presupuesto agotado devuelve pasos y `blocked` nulo; la automática sigue bloqueada con el mensaje de límite · G-3 · prueba: `src/lib/orchestrator/planner-manual-budget.test.ts`
- **CA-2** Lo manual sigue saltando lo no conectado y lo ya cacheado, y el aviso 80 %/pausa automática 100 % no cambia · G-3 · misma prueba
### H-2: Como Owner, quiero que cada revelado quede registrado con su estado y su gasto.
- **CA-3** Al revelar (cuenta o stakeholder) se escribe `email_verifications` con email normalizado, estado mapeado (solo `verified` verifica), `provider_status` literal ≤ 120, `provider`/`source` fijos, `checked_at` y `requested_by`, con `org_id` explícito y cliente privilegiado · G-1, G-5 · prueba: `src/lib/email-verification-writer.test.ts`
- **CA-4** Un valor de proveedor desconocido o ausente deja «no verificable», nunca «verificado»; sin email no se escribe fila · G-1 · misma prueba
- **CA-5** `revealToAccount` y `revealStakeholder` registran su gasto (`find_email`/`find_phone`, coste `revealCost`) sea quien sea el llamador; `revealKeyPeople` no duplica el registro · G-3 · prueba: `src/lib/apollo-gateway-logging.test.ts`
### H-3: Como miembro, quiero que Apollo nunca pise un email que ya tenía.
- **CA-6** Si Apollo devuelve un email distinto al guardado, la ficha conserva el suyo y el resultado lleva `proposedEmail`; si no había email, se rellena como hoy · G-1 · prueba: `src/lib/apollo-gateway-logging.test.ts`
- **CA-7** La pantalla y el agente dicen la propuesta en una frase («Apollo propone otro email: …; no lo he cambiado») · G-1 · misma prueba (núcleo) y revisión de copy

## 8. Casos límite y errores
Fallo al escribir la verificación o el gasto: se anota con `safeErrorLog` y no rompe el revelado (el dato principal ya se entregó). Email con mayúsculas o espacios: se normaliza antes de escribir. Otra empresa: todo filtra por `org_id` explícito. Revelado repetido: `upsert` por (org_id, email) actualiza estado y fecha. `revealStakeholder` sin cambios no escribe parche vacío.

## 9. Experiencia y copy
Propuesta de email: «Apollo propone otro email: … No lo he cambiado; edítalo tú si quieres usarlo.» Sin iconos nuevos (NK-0168 en curso). Errores por `errorText`.

## 10. Datos, permisos y privacidad
Escritura en `email_verifications` (esquema del SDD 1) solo con `supabaseAdmin` cargado dentro del núcleo y `org_id` explícito; la tabla no tiene política de inserción para `authenticated`. Ningún email en logs ni en pruebas (direcciones sintéticas `.invalid`). `integration_usage` ya tiene RLS por empresa.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna | — | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | Q-6 en `planFor` + textos | CA-1, CA-2 | `src/lib/orchestrator/planner-manual-budget.test.ts` |
| U-2 | Escritor de verificación y conexión a los núcleos | CA-3, CA-4 | `src/lib/email-verification-writer.test.ts` |
| U-3 | Gasto en los núcleos + alineación de `revealKeyPeople` | CA-5 | `src/lib/apollo-gateway-logging.test.ts` |
| U-4 | Conservar y proponer + copy en pantalla y agente | CA-6, CA-7 | `src/lib/apollo-gateway-logging.test.ts` |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
Constructor de fila puro en `src/lib/email-verification-writer.ts` (probado); la escritura usa `await import("@/integrations/supabase/client.server")` dentro del núcleo, como `background-jobs.server.ts:113`. El registro de gasto entra en `apollo-gateway.ts` importando `logUsage` de `runner.ts`… riesgo de ciclo: `runner.ts` ya importa `apollo-gateway.ts`. Alternativa elegida: mover `logUsage`/`monthBudget` a un módulo propio (`src/lib/orchestrator/usage.ts`) que ambos importan, sin ciclo. `revealKeyPeople` pasa a no registrar (el núcleo lo hace con el mismo coste `revealCost`).

## 14. Riesgos y dependencias
El gasto de pantalla y agente empieza a contar en `org_budgets`: el consumo visible sube y el aviso del 80 % puede llegar antes (riesgo declarado en el PRD 7, aceptado). El cambio Q-6 es transversal: afecta a toda necesidad manual con coste; hay que avisar al dueño de NK-0171, cuyo PRD documenta lo contrario. Vuelta atrás: revertir los cuatro archivos; las filas escritas siguen siendo válidas.

## 15. Preguntas para Fede y para la revisión técnica
Ninguna abierta: Q-6 y la aclaración de conservar/proponer están decididas en `docs/decisiones-fede-20261113.md`. No publicar ni desplegar.

## 16. Pendiente de verificar
Que el plan de Apollo incluya `email_status` sin crédito aparte [Por verificar con una respuesta real]. Gasto real frente a estimado [Por verificar con `integration_usage` tras publicar]. Tipos sin comprobar por restricción del entorno.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
No revisado; no se rellena veredicto independiente.

## 18. Delta de implementación
U-1 a U-4 implementadas el 2026-11-13. Las tres pruebas nuevas fallaron primero (8 fallos) y pasan tras la implementación (16/16). `logUsage` se movió a `src/lib/orchestrator/usage.ts` (runner lo reexporta; sin ciclo gateway↔runner). `revealKeyPeople` ya no registra por su cuenta: lo hace el núcleo con el mismo coste. `revealStakeholder` devuelve `proposedEmail` y nunca sobrescribe; pantalla y agente dicen la propuesta en una frase. Comentario de `planner.ts` y línea del orquestador en `src/lib/AGENTS.md` corregidos (Q-6). Suite completa 342 archivos y 5.617 pruebas en verde; compilación automática OK. Tipos sin comprobar por restricción del entorno. Ninguna prueba existente modificada. Aviso pendiente al dueño de NK-0171: su PRD documenta que lo manual de pago se para al límite; desde esta entrega no se para.
