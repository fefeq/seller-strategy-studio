# SDD-20261025-theory-u-proactive-decision-support · [Feature] Theory U con IA proactiva para decidir

**Tipo:** Feature · **Prioridad propuesta:** Media
**Estado:** Borrador · **Pide:** Fede · **Para:** Dani · **Fecha:** 2026-10-25
**Depende de:** SDD universal de campos; SDD de acciones sobre campos

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
- Theory U no aparece en el onboarding ni en «Configura tu estrategia».
**Apuesta declarada:** se medirá tras el lanzamiento con las métricas de la sección 4.

## 4. Resultado buscado
- Nº de decisiones registradas desde un resumen de decisión por empresa y mes (fuente: base de datos). Línea base: sin dato.
- % de resúmenes que el usuario marca como útiles (fuente: valoración en producto; hoy no existe). Línea base: sin dato.
- Tiempo entre la última nota de sensing y su síntesis (fuente: registros). Línea base: sin dato.

## 5. Alcance
**Incluye:** avisos proactivos por reglas; síntesis con IA de lo acumulado; resumen de decisión; propuestas de cambio sobre ICP, posicionamiento y mensajes que quedan pendientes de tu confirmación; IA en clínicas y prototipos; acceso desde el Agente.
**No incluye:** grabar o transcribir llamadas; análisis de perfiles de LinkedIn; cambios automáticos de la estrategia sin tu aprobación; rediseño completo de las cinco fases.

## 6. Cambios de comportamiento (delta)
**Añadido:** avisos proactivos; resumen de decisión con opciones; propuestas de cambio pendientes; IA en clínicas y prototipos; valoración de utilidad.
**Modificado:** síntesis (antes: solo a petición; después: también sugerida cuando toca).
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como founder, quiero que NOKKO me avise cuando Theory U tiene algo que decidir.
- CA-1: CUANDO hay N notas de sensing sin sintetizar (N lo fija Fede), el sistema DEBE avisarme y ofrecerme sintetizarlas.
- CA-2: CUANDO un recorrido lleva más de N días en la misma fase sin actividad, el sistema DEBE avisarme con la pregunta clave de esa fase.
- CA-3: CUANDO termina un prototipo sin resultado registrado, el sistema DEBE pedirme qué aprendimos.
- CA-4: El sistema DEBE mostrar como máximo un aviso de Theory U por sesión y permitirme posponer o silenciar un tipo de aviso.

### H-2: Como founder, quiero un resumen para decidir.
- CA-5: CUANDO lo pido o acepto un aviso, el sistema DEBE generar un resumen de decisión con: qué hemos oído (con las notas de origen citadas), patrones, opciones, y qué cambiaría en ICP, posicionamiento o mensajes.
- CA-6: El sistema DEBE citar la nota, clínica o prototipo de origen de cada afirmación del resumen.
- CA-7: SI hay menos notas que el mínimo N para sintetizar, ENTONCES el sistema DEBE decir qué falta en lugar de generar un resumen.
- CA-8: SI falta una cifra o una cita en las notas, ENTONCES el sistema DEBE decir «sin dato» en lugar de inventarla.

### H-3: Como founder, quiero que lo aprendido llegue a la estrategia sin perder el control.
- CA-9: CUANDO el resumen propone un cambio en ICP, posicionamiento o mensajes, el sistema DEBE guardarlo como propuesta pendiente de confirmar, sin modificar el valor actual.
- CA-10: CUANDO confirmo una propuesta, el sistema DEBE aplicarla con origen «Theory U» y permitir deshacer.
- CA-11: El sistema DEBE registrar mi decisión (aceptada, rechazada, pospuesta) con fecha y motivo opcional.

### H-4: Como founder, quiero ayuda de IA en clínicas y prototipos.
- CA-12: CUANDO abro una clínica de casos con datos suficientes, el sistema DEBE ofrecer preguntas de reflexión y riesgos del deal.
- CA-13: CUANDO defino un prototipo, el sistema DEBE ofrecer hipótesis comprobable, señal de éxito y fecha de revisión sugeridas, editables.

### H-5: Como founder, quiero usarlo desde el Agente.
- CA-14: CUANDO pregunto al Agente qué he aprendido o qué decidir, el sistema DEBE responder con el resumen de decisión y sus fuentes.

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
Se leen notas de sensing (entrevistado, lo oído, sorpresas), clínicas, prototipos y reuniones de la empresa. Pueden contener datos de personas entrevistadas: no se exponen fuera de la empresa y no se usan en ejemplos. LinkedIn: no se usa.

## 11. Unidades de trabajo
- U-1: Reglas de aviso y gestión de avisos (H-1).
- U-2: Resumen de decisión con fuentes (H-2).
- U-3: Propuestas pendientes sobre la estrategia (H-3; depende de SDD universal y de acciones).
- U-4: IA en clínicas y prototipos (H-4).
- U-5: Agente (H-5; depende de U-2).

## 12. Notas técnicas [Sugerencia — Dani valida]
- Código: `src/lib/theory-u.ts` (reglas con pruebas), `src/components/theory-u/*`, `src/lib/ai.functions.ts` (`synthesizeJourney`, `sensingPatterns`), `ai-core.ts` (`U_SYSTEM`, `listeningCoachingCore`), tablas `u_journeys`, `sensing_notes`, `case_clinics`, `gtm_experiments`, `meetings`.
- Los avisos se añaden como detectores del motor proactivo existente (`src/lib/proactive/detectors/`).
- **Uso de LLM:** decidir CUÁNDO avisar = reglas deterministas (cero LLM). La síntesis solo corre al aceptar el aviso o al pedirla, `effort:"low"` por defecto, con caché por huella de las notas de entrada (si no cambian, no se regenera) y respuesta estructurada con fuentes. Sin LLM para clasificar niveles de escucha si ya están guardados.

## 13. Riesgos y dependencias
- Ruido: demasiados avisos (CA-4).
- Alucinación en resúmenes: mitigada por CA-6 a CA-8.
- Depende de los SDD universal y de acciones para propuestas y origen.
- Dueño de «propuesta pendiente»: SDD universal de campos (CA-9).

## 14. Preguntas para Dani
1. ¿Existe ya algún detector de Theory U en el motor proactivo?
2. ¿Dónde se guardarían las propuestas pendientes (sin tabla propia)?

## 15. Pendiente de verificar
- [Por verificar] Detectores proactivos existentes sobre Theory U.
- [Por verificar] Valor de N (decisión de Fede).
- [Por verificar] Coste real de una síntesis (sin dato).
- [Por verificar] Estado en `production`.

## 16. Sección de Dani (la completa él)
- Diseño técnico:
- Tareas:
- Estimación:
- Decisión: Aceptado / Cambios pedidos / Rechazado

---
Validación: OK (autorrevisión). Auditoría: solo linter; la independiente queda pendiente.
