# SDD-20261025-theory-u-proactive-decision-support · [Feature] Theory U con IA proactiva para decidir

**Tipo:** Feature · **Prioridad propuesta:** Media
**Estado:** Borrador · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-25
**PRD:** docs/prd/PRD-20261028-ux-onboarding-coherencia.md (cubre G-8) · **Depende de:** SDD universal de campos; SDD de acciones sobre campos

## 1. Resumen
Theory U hoy es un cuaderno: lo rellenas tú y la IA solo responde si se lo pides. Se quiere que sea **proactivo**: que detecte cuándo hay material suficiente, te avise, sintetice lo aprendido y te dé **lo necesario para decidir** (qué hemos visto, qué opciones hay, qué cambiaría en la estrategia), sin que tengas que recordar usarlo.

## 2. Problema y para quién
Founder o líder comercial que hace entrevistas de sensing, clínicas de casos y prototipos, pero no ve el hilo entre ellos ni cuándo toca decidir (soltar un mensaje, cambiar un ICP, escalar un prototipo).

## 3. Evidencia y por qué ahora
Fuente: código del repo `main` (2026-10-25) y petición de Fede. Sin datos de uso (sin dato).
- Cinco pestañas: Recorrido U (cinco fases), Sensing, Escucha, Clínica de casos, Prototipos.
- IA solo a petición en tres puntos: «Sintetizar con IA» en el recorrido, análisis de patrones en Sensing, coaching de escucha en reuniones.
- Clínicas de casos y Prototipos no tienen IA.
- No hay detector proactivo de Theory U entre los detectores del repo (`src/lib/proactive/`): **[Por verificar]**.
- Los resultados del recorrido no se convierten en cambios de ICP o posicionamiento: la fase «Co-evolucionar» es solo texto.
- Theory U no aparece en el onboarding ni en «Configura tu estrategia». Decisión de Fede: queda aparte y la guía de estrategia lo sugiere al terminar.
**Apuesta declarada:** se medirá tras el lanzamiento con las métricas de la sección 4.

## 4. Resultado buscado
- Nº de decisiones registradas desde un resumen de decisión por empresa y mes (fuente: base de datos). Línea base: sin dato.
- % de resúmenes que el usuario marca como útiles (fuente: valoración en producto; hoy no existe). Línea base: sin dato.
- Tiempo entre la última nota de sensing y su síntesis (fuente: registros). Línea base: sin dato.

Cubre el objetivo G-8 del PRD.

## 5. Alcance
**Incluye:** avisos proactivos por reglas; síntesis con IA de lo acumulado; resumen de decisión; propuestas de cambio sobre ICP, posicionamiento y mensajes que quedan pendientes de tu confirmación; IA en clínicas y prototipos; acceso desde el Agente.
**No incluye:** grabar o transcribir llamadas; análisis de perfiles de LinkedIn; cambios automáticos de la estrategia sin tu aprobación; rediseño completo de las cinco fases.

## 6. Cambios de comportamiento (delta)
**Añadido:** avisos proactivos; resumen de decisión con opciones; propuestas de cambio pendientes; IA en clínicas y prototipos; valoración de utilidad.
**Modificado:** síntesis (antes: solo a petición; después: también sugerida cuando toca).
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como founder, quiero que NOKKO me avise cuando Theory U tiene algo que decidir.
- CA-1: CUANDO hay 8 notas de sensing sin sintetizar (decidido por Fede), el sistema DEBE avisarme y ofrecerme sintetizarlas. · cubre G-8 · prueba: por nombrar en el brief
- CA-2: CUANDO un recorrido lleva más de 14 días en la misma fase sin actividad (decidido por Fede), el sistema DEBE avisarme con la pregunta clave de esa fase. · cubre G-8 · prueba: por nombrar en el brief
- CA-3: CUANDO termina un prototipo sin resultado registrado, el sistema DEBE pedirme qué aprendimos. · cubre G-8 · prueba: por nombrar en el brief
- CA-4: El sistema DEBE mostrar como máximo un aviso de Theory U por sesión y permitirme posponer o silenciar un tipo de aviso. · cubre G-8 · prueba: por nombrar en el brief

### H-2: Como founder, quiero un resumen para decidir.
- CA-5: CUANDO lo pido o acepto un aviso, el sistema DEBE generar un resumen de decisión con: qué hemos oído (con las notas de origen citadas), patrones, opciones, y qué cambiaría en ICP, posicionamiento o mensajes. · cubre G-8 · prueba: por nombrar en el brief
- CA-6: El sistema DEBE citar la nota, clínica o prototipo de origen de cada afirmación del resumen. · cubre G-8 · prueba: por nombrar en el brief
- CA-7: SI hay menos de 8 notas para sintetizar, ENTONCES el sistema DEBE decir qué falta en lugar de generar un resumen. · cubre G-8 · prueba: por nombrar en el brief
- CA-8: SI falta una cifra o una cita en las notas, ENTONCES el sistema DEBE decir «sin dato» en lugar de inventarla. · cubre G-8 · prueba: por nombrar en el brief

### H-3: Como founder, quiero que lo aprendido llegue a la estrategia sin perder el control.
- CA-9: CUANDO el resumen propone un cambio en ICP, posicionamiento o mensajes, el sistema DEBE guardarlo como propuesta pendiente de confirmar, sin modificar el valor actual. · cubre G-8 · prueba: por nombrar en el brief
- CA-10: CUANDO confirmo una propuesta, el sistema DEBE aplicarla con origen «Theory U» y permitir deshacer. · cubre G-8 · prueba: por nombrar en el brief
- CA-11: El sistema DEBE registrar mi decisión (aceptada, rechazada, pospuesta) con fecha y motivo opcional. · cubre G-8 · prueba: por nombrar en el brief

### H-4: Como founder, quiero ayuda de IA en clínicas y prototipos.
- CA-12: CUANDO abro una clínica de casos con datos suficientes, el sistema DEBE ofrecer preguntas de reflexión y riesgos del deal. · cubre G-8 · prueba: por nombrar en el brief
- CA-13: CUANDO defino un prototipo, el sistema DEBE ofrecer hipótesis comprobable, señal de éxito y fecha de revisión sugeridas, editables. · cubre G-8 · prueba: por nombrar en el brief

### H-5: Como founder, quiero usarlo desde el Agente.
- CA-14: CUANDO pregunto al Agente qué he aprendido o qué decidir, el sistema DEBE responder con el resumen de decisión y sus fuentes. · cubre G-8 · prueba: por nombrar en el brief

## 8. Casos límite y errores
- Sin notas ni clínicas: explicar cómo empezar (CA-7).
- Notas con datos personales de entrevistados: no copiar nombres a resúmenes salvo que ya estén en la nota y el rol lo permita (CA-5).
- Fallo de la IA: mostrar el error y conservar las notas (CA-5).
- Presupuesto agotado: aplicar la regla actual de presupuesto y avisar (CA-1).
- Propuesta que contradice un valor confirmado por una persona: queda pendiente, no se aplica (CA-9).
- Aviso ya atendido: no repetirlo hasta que haya material nuevo (CA-4).
- Rol sin permiso para aplicar cambios: puede ver el resumen, no aplicar (CA-10).

## 9. Experiencia y copy
Aviso: «Llevas *N* entrevistas de sensing sin sintetizar. ¿Te preparo qué hemos aprendido y qué decidir?» Resumen en bloques: Lo que hemos oído · Patrones · Opciones · Qué cambiaría. Botones: «Aplicar como propuesta», «Descartar», «Más tarde». «Tú», sin iconos.

## 10. Datos, permisos y privacidad
Se leen notas de sensing (entrevistado, lo oído, sorpresas), clínicas, prototipos y reuniones de la empresa. Pueden contener datos de personas entrevistadas: no se exponen fuera de la empresa y no se usan en ejemplos. El nombre del entrevistado (`interviewee`) no se envía al modelo (decidido por Fede, 2026-10-28); hoy `src/lib/ai.functions.ts:69` lo selecciona y hay que corregirlo al implementar. LinkedIn: no se usa.

**Columnas nuevas para CA-1 y CA-2 (decidido por Fede, 2026-10-28: se declaran en este SDD).** Hoy `sensing_notes` no tiene marca de síntesis y `u_journeys` solo tiene `updated_at` (`src/integrations/supabase/types.ts`). [Sugerencia — la revisión del gate valida]:
- `sensing_notes.synthesized_at` (fecha y hora, vacía por defecto): se rellena al incluir la nota en una síntesis. «Sin sintetizar» (CA-1) = vacía.
- `u_journeys.phase_changed_at` (fecha y hora, por defecto el momento de creación): se actualiza al cambiar `phase`. «Más de 14 días en la misma fase sin actividad» (CA-2) = `phase_changed_at` y la última actividad del recorrido, ambas, anteriores a 14 días.
- Migración nueva en `drizzle/migrations` con GRANTs; `org_id` con valor por defecto `current_org()` y RLS por empresa se mantienen en ambas tablas. Sin tocar migraciones aplicadas ni datos reales.
- [Por verificar] Qué cuenta como «actividad» de un recorrido (notas, clínicas, prototipos o edición del recorrido) y cómo se rellenan los datos existentes: lo decide la revisión técnica antes de construir.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Decidir cuándo avisar | regla (deterministas, cero LLM) | ninguno | no aplica |
| Síntesis y resumen de decisión (solo al aceptar el aviso o al pedirla) | regla → caché por huella de las notas de entrada (si no cambian, no se regenera) → modelo; respuesta estructurada con fuentes | modelo: el que decide `aiProviders()` (`src/lib/gemini.ts`: claves propias primero, pasarela de Lovable de respaldo); `effort:"low"` por defecto | sin dato (el coste real de una síntesis está por verificar) |
| Clasificar niveles de escucha | sin LLM si ya están guardados | ninguno | no aplica |
| IA en clínicas de casos y prototipos (CA-12, CA-13) | regla → caché por huella de la entrada → modelo barato; «A fondo» solo a petición (decidido por Fede, 2026-10-28) | `effort:"low"`; modelo: el que decide `aiProviders()` (`src/lib/gemini.ts`: claves propias primero, pasarela de Lovable de respaldo) | sin dato (el coste real está por medir) |

Una llamada no declarada aquí no se implementa.

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | Reglas de aviso y gestión de avisos (H-1) | los de H-1: CA-1 a CA-4 | por nombrar en el brief |
| U-2 | Resumen de decisión con fuentes (H-2) | los de H-2: CA-5 a CA-8 | por nombrar en el brief |
| U-3 | Propuestas pendientes sobre la estrategia (H-3; depende de SDD universal y de acciones) | los de H-3: CA-9 a CA-11 | por nombrar en el brief |
| U-4 | IA en clínicas y prototipos (H-4) | los de H-4: CA-12, CA-13 | por nombrar en el brief |
| U-5 | Agente (H-5; depende de U-2) | CA-14 | por nombrar en el brief |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Código: `src/lib/theory-u.ts` (reglas con pruebas), `src/components/theory-u/*`, `src/lib/ai.functions.ts` (`synthesizeJourney`, `sensingPatterns`), `ai-core.ts` (`U_SYSTEM`, `listeningCoachingCore`), tablas `u_journeys`, `sensing_notes`, `case_clinics`, `gtm_experiments`, `meetings`.
- Los avisos se añaden como detectores del motor proactivo existente (`src/lib/proactive/detectors/`).
- **Uso de LLM:** decidir CUÁNDO avisar = reglas deterministas (cero LLM). La síntesis solo corre al aceptar el aviso o al pedirla, `effort:"low"` por defecto, con caché por huella de las notas de entrada (si no cambian, no se regenera) y respuesta estructurada con fuentes. Sin LLM para clasificar niveles de escucha si ya están guardados.

## 14. Riesgos y dependencias
- Ruido: demasiados avisos (CA-4).
- Alucinación en resúmenes: mitigada por CA-6 a CA-8.
- Depende de los SDD universal y de acciones para propuestas y origen.
- Dueño de «propuesta pendiente»: SDD universal de campos (CA-9).

## 15. Preguntas para Fede y para la revisión técnica
1. ¿Existe ya algún detector de Theory U en el motor proactivo?
2. ¿Dónde se guardarían las propuestas pendientes (sin tabla propia)?

## 16. Pendiente de verificar
- [Por verificar] Detectores proactivos existentes sobre Theory U.
- [Por verificar] Coste real de una síntesis (sin dato).
- [Por verificar] Estado en `production`.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Un agente `nokko-gate` con contexto fresco lee este SDD y el código, y devuelve su informe. El coordinador lo copia aquí sin editarlo. El gate no aprueba el SDD: informa; la aprobación es de Fede.
Informe del gate recibido el 2026-10-28, copiado sin editar. El veredicto no aprueba el SDD: la aprobación es de Fede.
- **Veredicto del gate:** Objeciones
- **CA sin prueba posible o sin G-n:** todos citan G-8 y es el objetivo correcto (PRD:31, 78). Ninguno nombra un test: CA-1 a CA-14 dicen «por nombrar en el brief» (SDD:41-62, 92-96). La plantilla pide un archivo concreto (templates/sdd.md:33). CA-4 habla de un aviso «por sesión», pero el motor proactivo funciona con sugerencias que genera un cron, no con sesiones (src/lib/AGENTS.md:9, 11). CA-12 depende de «datos suficientes», que no se define en ningún sitio (SDD:58). CA-1 cuenta notas «sin sintetizar», pero `sensing_notes` no tiene ningún marcador para eso (types.ts:4429-4447) y la síntesis de patrones no se guarda (sensing.tsx:49). CA-2 necesita saber cuándo cambió la fase, y `u_journeys` solo tiene `updated_at` (types.ts:5022-5034). La sección 10 no declara columnas nuevas para cubrir ninguno de estos huecos.
- **[Por verificar] que sigue sin comprobarse:** el de los detectores ya se puede cerrar. En `src/lib/proactive/detectors/` no hay ninguno de Theory U y `Snapshot` no lee sus tablas (types.ts:3-30). Quedan abiertos el coste real de una síntesis y el estado en `production`.
- **Contradicciones con el código o con decisiones previas:**
  - Las secciones 7 y 12 piden IA para U-4 (CA-12, CA-13), pero la sección 11 la deja sin declarar (SDD:85), y el propio SDD dice que «una llamada no declarada aquí no se implementa» (SDD:87).
  - CA-14 implica una llamada del Agente que no aparece en la sección 11.
  - La sección 8 remite a «la regla actual de presupuesto» (SDD:68), pero `ask()` no consulta ningún presupuesto (ai-gateway.ts:11-12). Solo lo hace el orquestador (runner.ts).
  - «Silenciar un tipo» de aviso no existe en el motor: solo hay `snoozed_until` por sugerencia (types.ts:4714).
  - La síntesis actual ya envía `interviewee` al modelo (ai.functions.ts:69), lo que choca con la regla de privacidad de la sección 8 (SDD:66).
- **Lo que esta revisión NO demuestra:** no se ha ejecutado ningún test. No se ha revisado producción, ni las migraciones SQL (no encontré `supabase/migrations/*.sql`), ni los SDD de los que depende (universal y acciones). Tampoco se ha revisado la calidad de las respuestas del modelo.

## 18. Delta de implementación
Sin entrega todavía.

---
Validación: migrado a la plantilla de NOKKO el 2026-10-28. Revisión técnica: ver sección 17. `AUDIT-20261025.md` es el registro histórico anterior.
