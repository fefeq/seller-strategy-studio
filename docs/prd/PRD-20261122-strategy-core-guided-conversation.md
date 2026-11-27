# PRD-20261122-strategy-core-guided-conversation · [Iniciativa] Núcleo de estrategia: una conversación guiada que termina en un tablero de hipótesis

**Tipo:** Iniciativa (varios SDD; sección 8) · **Prioridad propuesta:** Alta. Hoy NOKKO no se usa, y este núcleo es la condición para que se use. Es una apuesta declarada: no hay datos de uso, porque no hay uso.
**Estado:** Aprobado · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-22
**Ticket:** sin ticket (el ledger está desfasado; se asigna al aprobar)
**SDD que lo desarrollan:** pendiente (sección 8)
**Contexto:** [Mapa de flujos NOKKO](https://claude.ai/artifact/9iRqGkLHVByCaupeiUE6b9) · entrevista con Fede del 2026-11-22

> Un PRD dice qué se quiere y por qué. No dice cómo se construye ni cómo se prueba: eso es del SDD.

## 1. Problema
El founder quiere tener claro a quién vende, con qué mensaje y por qué canal, y poder revisarlo. NOKKO tiene el motor para ayudarle, pero no lo usa. Al entrar no sabe por dónde empezar, la herramienta le pide mucho antes de darle algo útil y la estrategia está repartida entre muchas pantallas. El resultado es que la estrategia no existe en ningún sitio como algo vivo y revisable.

## 2. Para quién
El founder que lleva el GTM él solo. Hoy NOKKO tiene un único usuario, Fede, que lo usa para el GTM de Postin. Los flujos se diseñan para una persona, y queda marcado dónde entraría un equipo más adelante. Sin nombres ni datos de clientes.

## 3. Evidencia y por qué ahora
| Qué | Nivel | Fuente |
|---|---|---|
| Fede no abre NOKKO «porque me resulta difícil usarlo» | Indicio (declaración del único usuario) | Entrevista del 2026-11-22 |
| Se rinde porque no sabe por dónde empezar, le pide demasiado antes de dar y la información está dispersa. **No** marcó «no confío en lo que genera» | Indicio | Entrevista del 2026-11-22 |
| El valor que más perdería si apagaran NOKKO: claridad de estrategia | Indicio | Entrevista del 2026-11-22 |
| Hay 4 puertas para definir la estrategia: Onboarding (6 pasos), Completar (3 vías), Configuración (redirige a Completar) y Estrategia (9 pestañas). Empresa, Productos, Conocimiento y Memoria también guardan piezas de estrategia | Dato | `docs/PANTALLAS.md` (actualizado el 2026-11-22 frente a `main` @ 945079e) |
| Estrategia mezcla diseño con medición (Payback real, Presupuesto vs real, Diagnóstico AARRR) | Dato | `docs/PANTALLAS.md` §3 |
| Ya existe una entidad con forma de hipótesis: `gtm_experiments` (hipótesis, audiencia, métrica, objetivo, resultado, aprendizaje, estado idea/running/learned/adopted/discarded, regla de cierre y decisión). Se usa en Theory U, en el asesor, en la revisión de estrategia y en las herramientas del agente | Dato | `drizzle/migrations/0003_theory_u.sql:52`, `0069_experiment_close_rule.sql`; `src/lib/experiments*.ts`, `strategy-review.ts`, `advisor.tsx` |
| No hay vínculo en el esquema entre plays y experimentos | Dato (búsqueda en migraciones) [Por verificar] que no exista por otra vía | `drizzle/migrations/` |
| Inicio tiene unos 10 bloques, dos de ellos repetidos | Dato (lectura de código, sin uso real) | `docs/UX-INFORME-20261031.md` P0-3 |
| 0 deals y 0 plays activos en prod | Dato a 2026-11-15, [Por verificar] hoy | Memoria del proyecto |

**Por qué ahora:** mientras el núcleo no funcione, cada mejora en Ejecución o en Aprendizaje se construye sobre una herramienta que nadie abre.

## 4. Objetivos
| ID | Objetivo | Cómo se mide | Línea base | Fuente |
|---|---|---|---|---|
| G-1 | El founder llega a una estrategia útil sin perderse | Completa la conversación guiada y llega al tablero con al menos una hipótesis por pieza clave | sin dato | Se medirá tras el lanzamiento; [Por verificar] si hay eventos de producto para medirlo |
| G-2 | Recibe valor antes de que se le pida esfuerzo | Tiempo y número de respuestas hasta la primera pieza en borrador que el founder aprueba | sin dato | Se medirá tras el lanzamiento |
| G-3 | La estrategia se vuelve algo vivo | Fede abre el tablero al menos una vez por semana durante 4 semanas seguidas | «Nunca» (declarado, no medido) | Registro de sesiones; [Por verificar] la fuente exacta |

Nunca se pone una línea base estimada.

## 5. No-objetivos
- Rediseñar Ejecución: Hoy, plays, cuentas, contactos y pipeline. Va en su propio PRD.
- Rediseñar Aprendizaje: ritual semanal, avisos por umbral y métricas. Va en su propio PRD.
- Fusionar leads, personas y descubiertos.
- Unificar Ajustes.
- Quitar roles o permisos de la seguridad de datos: solo se ocultan en la interfaz.
- Borrar pantallas o datos: lo sustituido sale del menú y no se borra.
- Mejorar la calidad de lo que genera el agente: no está señalado como problema.

## 6. Requisitos de producto
- R-1: Si entro sin estrategia, NOKKO me lleva a una sola conversación guiada y no me ofrece otras vías para definirla.
- R-2: En la conversación veo en qué paso estoy y cuánto falta.
- R-3: Cada paso me da un borrador útil de una pieza de la estrategia antes de pedirme el siguiente dato.
- R-4: Puedo darle mis fuentes (web, documentos) y NOKKO propone a partir de ellas en lugar de preguntarme lo que ya puede leer.
- R-5: Puedo dejar la conversación a medias y retomarla donde la dejé.
- R-6: Nada de lo que propone la conversación entra en mi estrategia sin que yo lo apruebe, y puedo deshacer lo aprobado.
- R-7: Al terminar, llego al tablero de hipótesis, que es mi pantalla de inicio desde entonces.
- R-8: El tablero muestra toda la estrategia en una sola vista: a quién vendo, qué dolor resuelvo, qué ofrezco, con qué mensaje, por qué canal y contra quién compito.
- R-9: Cada hipótesis del tablero tiene un estado visible: sin probar, en ejecución, confirmada o descartada.
- R-10: Desde cualquier pieza del tablero puedo ver su detalle y reabrir la conversación solo sobre esa pieza.
- R-11: Puedo corregir una pieza a mano desde su detalle sin repetir la conversación entera.
- R-12: En el núcleo no veo nombres de marcos metodológicos, solo hipótesis.
- R-13: No veo controles de rol, reparto ni equipo.
- R-14: Lo que ya tengo definido hoy (ICP, posicionamiento, mensajes, productos, empresa) aparece en el tablero sin que tenga que volver a rellenarlo.
- R-15: Onboarding, Completar y Configuración dejan de aparecer como destinos; sus datos se conservan.

## 7. Alternativas consideradas
| Alternativa | Decisión | Por qué |
|---|---|---|
| A. No hacer nada | Descartada | NOKKO sigue sin usarse y lo que se construya encima no tiene usuario |
| B. Arreglos UX puntuales (informe del 31-oct: contraste, Inicio más corto, menos botones) | Descartada como solución; compatible como complemento | Mejora cada pantalla, pero no resuelve «no sé por dónde empezar» ni la dispersión |
| C. Hacer la conversación desde un asistente externo conectado a NOKKO por MCP, sin cambiar la interfaz | **Propuesta como prueba barata previa**, no como solución | Valida en días si la conversación guiada da claridad, con el motor actual. No resuelve el tablero ni la dispersión |
| D. Conversación guiada en NOKKO y tablero de hipótesis como home | **Elegida** | Responde a las tres causas de abandono y a la forma ideal que eligió Fede (conversacional + guiada + tablero con profundidad) |

## 8. Criterio de descarte
- **Antes de construir:** si en la prueba C Fede no termina una conversación guiada, o termina sin una estrategia que considere útil, se para y se revisa el recorrido antes de construir interfaz.
- **Después de lanzar:** si en las 4 semanas siguientes Fede no abre el tablero al menos una vez por semana (G-3), se para antes de abordar los PRD de Ejecución y Aprendizaje y se vuelve a entrevistar.

## 9. Decisiones tomadas y abiertas
| Tema | Decisión | Quién y cuándo |
|---|---|---|
| Usuario objetivo | Una persona; queda marcado dónde entraría un equipo | Fede, 2026-11-22 |
| Puerta de entrada | Una sola: la conversación guiada sustituye a Onboarding, Completar y Configuración | Fede, 2026-11-22 |
| Marco visible | Solo la hipótesis; el resto, lógica interna del agente | Fede, 2026-11-22 |
| Aprender | Ritual semanal más avisos por umbral (fuera de este PRD) | Fede, 2026-11-22 |
| Dónde quedan las pestañas de medición de Estrategia hasta que exista Aprendizaje | Abierta. Propuesta: un enlace secundario «Medición» desde el tablero | — |
| Hacer la prueba C antes de construir | Abierta. Propuesta: sí | — |
| Qué piezas forman el tablero (lista de R-8) | Abierta. Propuesta: la de R-8 | — |

## 10. Riesgos y dependencias
- **Valor:** n = 1. Lo que funcione para Fede puede no generalizar. Se acepta porque NOKKO es una herramienta interna «por ahora».
- **Usabilidad:** una conversación larga puede volver a «pedir antes de dar». Lo mitigan R-3, R-4 y R-5.
- **Proceso:** si Lovable sigue construyendo feature a feature en `main`, pueden reaparecer puertas nuevas. Se propone una regla: cada feature declara en cuál de los 5 espacios vive.
- **Pruebas protegidas:** sacar destinos del menú toca pruebas protegidas (`nav-wave-one.test.ts`, según `docs/ESTADO-Y-DEUDA.md` §6).
- **Depende de:** ninguna otra iniciativa. Bloquea los PRD de Ejecución y Aprendizaje.

**Preguntas para el equipo técnico:**
1. ¿`gtm_experiments` sirve como entidad de hipótesis para todo el ciclo, o hace falta una nueva? ¿Qué pasa con su vínculo a Theory U?
2. ¿Cómo se convierten las piezas ya definidas (ICP, posicionamiento, mensajes) en hipótesis sin perder datos (R-14)?
3. ¿Qué parte del motor actual de Onboarding y Completar (lectura de fuentes, diagnóstico, aprobación por bloques con deshacer) se puede reutilizar tal cual?
4. ¿Hay eventos de producto suficientes para medir G-1 a G-3?
5. ¿El estado «en ejecución» de una hipótesis puede derivarse de los plays, si hoy no hay vínculo entre ellos?

## 11. Orden de entrega (tentativo)
| # | SDD | Tipo | Depende de | Cubre |
|---|---|---|---|---|
| 0 | Prueba C: conversación guiada desde un asistente externo (sin código nuevo, si es posible) | Experimento | — | Criterio de descarte |
| 1 | Hipótesis como pieza común y conversión de lo existente | Feature | — | R-9, R-14 |
| 2 | Tablero de hipótesis como home | Feature | 1 | R-7, R-8, R-10, R-11, R-12, R-13 |
| 3 | Conversación guiada como puerta única | Feature | 1 | R-1 a R-6 |
| 4 | Retirada de las puertas antiguas del menú | Mejora | 2, 3 | R-15 |

## 12. Pendiente de verificar
- Si hay vínculo entre plays y experimentos por una vía que no sean las migraciones.
- 0 deals y 0 plays activos en prod (dato de 2026-11-15).
- Fuente de eventos para medir G-1, G-2 y G-3.

## 13. Aprobación
- [x] Fede aprueba el PRD (primer GO de dirección). Fecha: 2026-11-23. Las decisiones abiertas de la sección 9 siguen abiertas y se resuelven en los SDD.
- Al aprobarse, el Estado pasa a «Aprobado» y se redactan los SDD con `nokko-shape`.
