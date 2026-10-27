# SDD-20261027-strategic-suggestions-engine · [Feature] Motor de sugerencias estratégicas para diseñar, ejecutar y monitorear el GTM

**Tipo:** Feature (maestro, dividido en fases) · **Prioridad propuesta:** Alta
**Estado:** Borrador con decisiones 1 a 4 resueltas · **Pide:** Fede · **Para:** Claude Code (implementación), con auditoría independiente · **Fecha:** 2026-10-27
**Depende de:** SDD universal de campos (1) y acciones sobre campos (2) para propuestas pendientes, origen y deshacer; SDD 7b (competidores como entidad) para las reglas sobre competidores; SDD 9 (Theory U proactivo) como fuente de evidencia, sin duplicarlo.
**Nota de proceso:** en NOKKO, Dani no participa (decisión de Fede, 2026-10-27). Las secciones 14 y 16 conservan el nombre de la plantilla: las preguntas las responde Fede y la sección 16 la completa Claude Code.

## 1. Resumen
NOKKO avisa hoy de cosas operativas y tiene un Asesor GTM que responde a petición, pero ninguno contrasta la estrategia de la empresa con lo que pasa de verdad ni propone cambios concretos que se puedan aplicar. Se quiere un **motor de sugerencias estratégicas** que lea todo lo que el founder carga en NOKKO (ICP, segmentos, posicionamiento, competidores, productos y precios, pipeline, leads, llamadas, señales, métricas reales y experimentos) y proponga cambios sobre cada elemento. Cada sugerencia lleva evidencia, nivel de evidencia y una acción; el founder la acepta, pospone o descarta, y lo aceptado se convierte en cambio pendiente de confirmar, tarea o experimento con criterio de cierre. Después se monitorea.

Cobertura del ciclo: **Diseñar** (fases 0, 1 y 4), **Ejecutar** (fases 2 y 3), **Monitorear** (fase 5), con acceso desde el Agente (fase 6) y fuentes de terceros (fase 7).

## 2. Problema y para quién
Founder o líder comercial de un equipo pequeño (2 a 5 personas, objetivo de NOKKO según Fede) que escribe su estrategia una vez y no la contrasta con los resultados. Dolores: no sabe qué parte de la estrategia está desmentida por los datos, las pruebas que lanza no se cierran nunca, y el Asesor le da texto sin una acción que pueda aplicar.

## 3. Evidencia y por qué ahora
Fuente: código de `main` en el commit d0e4821 (leído el 2026-10-27), auditoría del chat del 24 de octubre de 2026, foto de partida de la Fase A (21 de octubre de 2026) y petición de Fede. Sin datos de uso (sin dato).
- Hay 16 reglas proactivas (fuente: `src/lib/proactive/index.ts`). Ninguna cubre ICP, competidores, posicionamiento, precio ni experimentos.
- El Asesor GTM solo lo usan Owner y Sales Leader; lee pipeline, segmentos con sus objetivos, historial de etapas, cuotas y contexto de estrategia; devuelve diagnóstico, recomendaciones, riesgos y huecos como texto, y las acciones son frases, no acciones ejecutables (fuente: `src/lib/advisor.ts`, `src/lib/ai.functions.ts`).
- El Asesor no está en el registro de herramientas del Agente ni en el MCP; de los experimentos solo existe «crear» (fuente: `src/lib/agent/tools/core-write.ts`, `src/lib/mcp/tools/agent-tools.ts`). Coincide con el hallazgo de la auditoría del 24 de octubre.
- Los experimentos guardan título, hipótesis, métrica, objetivo, prototipo, fechas, estado, resultado y aprendizaje, pero no regla de cierre ni decisión de cierre, y ninguna regla proactiva los vigila (fuente: tipos generados y `src/lib/proactive/`).
- Los deals no tienen motivo de pérdida ni competidor como dato propio; solo existe el campo libre «Competition» dentro de MEDDPICC (fuente: tipos generados de la base de datos y `src/lib/roles.ts` en `main`). Los competidores viven como texto en el plan de cuenta y en el posicionamiento.
- Ya existe el patrón de propuesta pendiente para campos de cuenta (`src/lib/field-proposals.ts`) y las sugerencias reutilizan herramientas del Agente.
- La foto de partida de la Fase A mostró 0 leads, 2 deals abiertos y 0 perfiles ICP (fuente: foto de partida de la Fase A, 21 de octubre de 2026). Con poca base, muchas sugerencias saldrán como «falta dato».
**Apuesta declarada:** Fede apuesta por que sugerir cambios con evidencia, y no solo avisar, mejora las decisiones de estrategia. Se medirá con las métricas de la sección 4.

## 4. Resultado buscado
- Sugerencias estratégicas decididas por empresa y mes (fuente: registro de decisiones de NOKKO). Línea base: sin dato.
- Proporción de sugerencias aceptadas sobre las decididas (fuente: registro de decisiones). Línea base: sin dato.
- Experimentos con regla de cierre y revisados en su fecha (fuente: registro de experimentos). Línea base: sin dato.
- Días entre la fecha de revisión de un experimento y su decisión (fuente: registro de experimentos). Línea base: sin dato.
- Coste de IA por revisión estratégica (fuente: registro de uso de integraciones). Línea base: sin dato.

## 5. Alcance
**Incluye:**
- Modelo de sugerencia estratégica con evidencia, nivel de evidencia, acción propuesta y estado.
- Captura del motivo de pérdida y del competidor al perder un deal.
- Reglas fijas por elemento: ICP, segmentos, posicionamiento, competidores, producto y precio, pipeline.
- Experimentos con regla de cierre, fecha de revisión y decisión.
- Convertir una sugerencia aceptada en cambio pendiente, tarea o experimento.
- Revisión estratégica con IA, incluido el modo «Revisión crítica».
- Monitoreo: bloque en el informe semanal, tendencia de lo aceptado, revisión periódica e historial de decisiones.
- Acceso desde el Agente, Telegram y el MCP.
- Fuentes de terceros como evidencia, solo cuando su licencia esté confirmada.
**No incluye:**
- Aplicar cambios sin tu confirmación o enviar mensajes a terceros.
- Los frameworks de McKinsey como funcionalidad (decisión del 27 de octubre de 2026: solo se toma el criterio de cierre de experimentos y la mirada por horizontes como pregunta del informe).
- Benchmarks externos que no figuren en las notas y fuentes de la empresa.
- Valoración de personas a partir de datos de LinkedIn, o extracción de LinkedIn con robots, hasta que Fede decida (auditoría del 24 de octubre, punto P1.2).
- Uso de datos de Apollo y Clay en sugerencias de empresas sin cuenta propia hasta resolver su licencia (auditoría, punto P1.1).
- Cambiar el proveedor de IA, rediseñar las pantallas existentes o crear un panel nuevo de análisis.
- Conservar el Asesor GTM actual como pantalla aparte: Fede decidió el 27 oct que la revisión estratégica lo sustituye; el historial de `gtm_advisories` se conserva en solo lectura.

## 6. Cambios de comportamiento (delta)
**Añadido:** sugerencias estratégicas con evidencia y acción; motivo de pérdida y competidor por deal perdido; reglas fijas por elemento; regla de cierre y revisión en experimentos; conversión de sugerencia en cambio, tarea o experimento; revisión estratégica con IA; bloque de estrategia en el informe semanal; historial de decisiones; herramientas del Agente y del MCP.
**Modificado:** Asesor GTM (antes: texto sin acciones, solo pipeline y segmentos, solo en pantalla; después: recomendaciones con acción propuesta y más fuentes, también desde el Agente); informe semanal (añade un bloque); experimentos (añaden campos nuevos, los existentes se conservan).
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
Los valores numéricos de los criterios (2 deals, 90 días, 3 deals perdidos, 14 días y el tope de 7 sugerencias) fueron validados por Fede el 27 oct.

### H-1: Como founder, quiero que cada sugerencia estratégica diga en qué se apoya y cuánto se puede confiar. (Fase 0)
- CA-1: El sistema DEBE guardar cada sugerencia estratégica con el elemento que afecta, el tipo (crear, cambiar, validar, cerrar o falta dato), la evidencia con enlace a cada registro de origen, el nivel de evidencia, la acción propuesta (cambio de estrategia, prueba, acción comercial o dato a completar), la prioridad y el estado.
- CA-2: SI una sugerencia no tiene al menos un registro de la empresa como evidencia, ENTONCES el sistema DEBE mostrarla solo como «falta dato» y nunca como recomendación.
- CA-3: El sistema DEBE marcar el nivel de evidencia como baja, media o alta con una regla fija y visible, y DEBE mostrar el tamaño de la muestra.
- CA-4: CUANDO decido una sugerencia (aceptar, posponer o descartar), el sistema DEBE registrar la decisión con fecha, autor y motivo opcional.
- CA-5: SI descarté una sugerencia y no hay evidencia nueva desde entonces, ENTONCES el sistema DEBE no volver a mostrarla.
- CA-6: MIENTRAS una sugerencia esté pospuesta, el sistema DEBE ocultarla hasta su fecha de reaparición o hasta que cambie su evidencia.
- CA-7: El sistema DEBE mostrar como máximo 7 sugerencias estratégicas abiertas a la vez por empresa, ordenadas por prioridad.

### H-2: Como founder, quiero que NOKKO sepa por qué pierdo deals y contra quién. (Fase 0)
- CA-8: CUANDO marco un deal como perdido, el sistema DEBE pedirme el motivo (lista fija más texto libre) y, de forma opcional, el competidor.
- CA-9: El sistema DEBE permitir completar el motivo y el competidor de deals ya perdidos, sin obligarme.
- CA-10: SI no indico motivo, ENTONCES el sistema DEBE guardar el deal como perdido sin motivo y contarlo como «sin dato» en el análisis.
- CA-11: El sistema DEBE mantener intactos los deals y los datos existentes al añadir estos campos.

### H-3: Como founder, quiero sugerencias sobre cada elemento de mi estrategia calculadas con reglas fijas. (Fase 1)
- CA-12: CUANDO existen al menos 2 deals ganados cuyas cuentas comparten sector, tamaño o país que ningún ICP incluye, el sistema DEBE sugerir crear o ampliar un ICP citando esos deals y cuentas.
- CA-13: CUANDO un ICP lleva más de 90 días sin ningún lead, cuenta ni deal que encaje, el sistema DEBE sugerir revisarlo o archivarlo.
- CA-14: CUANDO un segmento tiene objetivo de payback o de coste de adquisición y no hay costes cargados, el sistema DEBE sugerir cargar los costes y no DEBE mostrar un payback proyectado.
- CA-15: CUANDO un segmento lleva dos trimestres con cobertura por debajo del rango sano que ya usa NOKKO (de 3 a 4 veces la cuota trimestral, según el código actual), el sistema DEBE sugerir revisar el objetivo, el segmento o el esfuerzo asignado.
- CA-16: CUANDO hay deals abiertos sin segmento, el sistema DEBE sugerir asignarlos y listarlos.
- CA-17: CUANDO una etapa concentra deals abiertos y su conversión a la siguiente es la más baja entre las etapas con muestra, el sistema DEBE sugerir revisarla citando conversión y muestra.
- CA-18: CUANDO el mismo descuento o la misma línea libre se repite en los deals de un producto, el sistema DEBE sugerir revisar el precio o el catálogo.
- CA-19: SI mi rol no puede ver precios, ENTONCES el sistema DEBE no mostrarme sugerencias de precio.
- CA-20: CUANDO un producto activo no aparece en ningún deal del último año, el sistema DEBE sugerir revisar si sigue a la venta.
- CA-21: CUANDO falta un campo del posicionamiento que el onboarding marca como necesario, el sistema DEBE sugerir completarlo, y SI ya existe un aviso de configuración incompleta para ese campo, ENTONCES el sistema DEBE no duplicarlo.
- CA-22: CUANDO existe un competidor registrado sin ficha de contramedida, el sistema DEBE sugerir crearla.
- CA-23: CUANDO un motivo de pérdida o un competidor se repite en al menos 3 deals perdidos, el sistema DEBE sugerir actuar sobre él citando esos deals.
- CA-24: El sistema DEBE calcular las sugerencias de esta fase solo con reglas fijas, sin llamar a ningún modelo de IA.
- CA-25: SI la muestra no alcanza el mínimo de una regla, ENTONCES el sistema DEBE emitir la sugerencia con nivel de evidencia baja o como «falta dato».

### H-4: Como founder, quiero que mis experimentos tengan criterio de cierre y se revisen a tiempo. (Fase 2)
- CA-26: CUANDO creo o edito un experimento, el sistema DEBE ofrecerme hipótesis, métrica, umbral de éxito, regla de cierre y fecha de revisión, todos editables.
- CA-27: SI un experimento en marcha no tiene regla de cierre, ENTONCES el sistema DEBE sugerir definirla.
- CA-28: CUANDO llega la fecha de revisión de un experimento sin decisión, el sistema DEBE avisarme y pedirme decidir: escalar, ajustar o cerrar.
- CA-29: CUANDO cierro un experimento, el sistema DEBE guardar resultado y aprendizaje y, si procede, proponer un cambio sobre ICP, segmento, posicionamiento o producto como propuesta pendiente.
- CA-30: SI un experimento superó su fecha de fin y lleva más de 14 días sin resultado, ENTONCES el sistema DEBE sugerir registrarlo o cerrarlo.
- CA-31: El sistema DEBE conservar los experimentos existentes sin perder datos, con los campos nuevos vacíos.

### H-5: Como founder, quiero convertir una sugerencia aceptada en algo que se ejecute sin perder el control. (Fase 3)
- CA-32: CUANDO acepto una sugerencia que cambia ICP, segmento, posicionamiento, competidor o producto, el sistema DEBE guardarla como propuesta pendiente de confirmar, sin modificar el valor actual.
- CA-33: CUANDO confirmo la propuesta, el sistema DEBE aplicarla con origen «Revisión estratégica» y permitir deshacerla durante 24 horas.
- CA-34: SI el valor actual lo escribió o confirmó una persona, ENTONCES el sistema DEBE dejar la propuesta pendiente y no aplicarla sola.
- CA-35: CUANDO acepto una sugerencia de tipo prueba, el sistema DEBE crear un experimento con hipótesis, métrica y fecha de revisión rellenos desde la sugerencia y editables antes de guardar.
- CA-36: CUANDO acepto una sugerencia de acción comercial, el sistema DEBE crear una tarea con responsable y fecha propuestos y editables.
- CA-37: El sistema DEBE enlazar cada cambio, tarea o experimento con la sugerencia que lo originó.
- CA-38: SI mi rol no puede aplicar el cambio, ENTONCES el sistema DEBE dejarme ver la sugerencia y no aplicarla.
- CA-39: El sistema DEBE no enviar mensajes a terceros ni cambiar datos de la empresa sin una confirmación mía.

### H-6: Como founder, quiero una revisión crítica de mi estrategia con todo lo que NOKKO sabe. (Fase 4)
- CA-40: CUANDO un Owner o un Sales Leader pide una revisión estratégica, el sistema DEBE leer ICP, segmentos, posicionamiento y pilares de mensaje, competidores, productos, pipeline, leads, reuniones y llamadas, señales, métricas reales conectadas y experimentos, y devolver como máximo 7 sugerencias.
- CA-41: El sistema DEBE acompañar cada sugerencia de la revisión con su evidencia citada, su nivel de evidencia, la acción propuesta y el dato que la invalidaría.
- CA-42: SI falta una cifra, ENTONCES el sistema DEBE decir «sin dato» y no estimarla ni usar benchmarks externos que no figuren en las notas y fuentes de la empresa.
- CA-43: DONDE elijo el modo «Revisión crítica», el sistema DEBE priorizar supuestos débiles y contradicciones entre lo declarado y lo observado.
- CA-44: CUANDO los datos de entrada no han cambiado desde la última revisión, el sistema DEBE reutilizarla, indicarlo y no hacer una llamada nueva a la IA.
- CA-45: SI se agota el presupuesto de la empresa, ENTONCES el sistema DEBE avisarme y mostrar la última revisión.
- CA-46: SI la IA falla, ENTONCES el sistema DEBE conservar la última revisión y mostrar un error comprensible.
- CA-47: SI una sugerencia de la revisión coincide con una sugerencia fija ya abierta sobre el mismo elemento, ENTONCES el sistema DEBE mostrar solo una.
- CA-48: El sistema DEBE no incluir nombres de entrevistados ni de clientes en las sugerencias salvo que consten en el registro de origen y mi rol pueda verlos.

### H-7: Como founder, quiero seguir si lo que acepté funciona y si mi estrategia se desvía. (Fase 5)
- CA-49: CUANDO hay sugerencias abiertas o experimentos por revisar, el sistema DEBE incluir en el informe semanal un bloque de estrategia con las tres de mayor prioridad.
- CA-50: CUANDO cambia la evidencia de una sugerencia aceptada, el sistema DEBE mostrar su tendencia desde la aceptación.
- CA-51: CUANDO desaparece la evidencia que originó una sugerencia abierta, el sistema DEBE marcarla como resuelta, salvo las decididas por una persona.
- CA-52: CUANDO vence el periodo de revisión periódica de la empresa, el sistema DEBE ofrecerme una revisión que compare con la anterior: qué cambió, qué se cumplió y qué sigue abierto.
- CA-53: El sistema DEBE permitirme silenciar un tipo de sugerencia estratégica por empresa y reactivarlo.
- CA-54: El sistema DEBE mostrar un historial de decisiones estratégicas con fecha, autor y motivo.

### H-8: Como founder, quiero usarlo desde el Agente y desde Telegram. (Fase 6)
- CA-55: CUANDO pregunto al Agente qué debería cambiar en mi estrategia, el sistema DEBE devolver las sugerencias abiertas con su evidencia.
- CA-56: CUANDO pido al Agente una revisión o una decisión, el sistema DEBE proponerla como acción pendiente de mi confirmación.
- CA-57: El sistema DEBE aplicar en el Agente, en Telegram y en el MCP las mismas reglas de rol que en pantalla.
- CA-58: SI no puedo ver una sugerencia en pantalla, ENTONCES el sistema DEBE no mostrármela en el Agente, en Telegram ni en el MCP.
- CA-59: El sistema DEBE permitir al Agente listar y actualizar experimentos, incluida la regla de cierre y la decisión.
- CA-60: CUANDO el Agente solo lee sugerencias ya guardadas, el sistema DEBE no gastar crédito de ningún proveedor.

### H-9: Como founder, quiero que las fuentes de terceros aporten evidencia solo cuando sea legítimo. (Fase 7)
- CA-61: DONDE la empresa use su propia cuenta de proveedor, el sistema DEBE poder usar señales de cuentas, reseñas de competidores y datos de uso del producto como evidencia.
- CA-62: SI una fuente no tiene licencia confirmada para mostrar sus datos a esa empresa, ENTONCES el sistema DEBE excluirla de las sugerencias.
- CA-63: El sistema DEBE indicar la fuente y la fecha de cada evidencia externa.
- CA-64: SI una fuente exige extraer LinkedIn fuera de la API oficial, ENTONCES el sistema DEBE excluirla hasta que Fede decida.

## 8. Casos límite y errores
- Empresa sin datos (como la foto de partida de la Fase A): todo sale como «falta dato» con la lista de lo que hay que rellenar (CA-2, CA-25).
- Muestra pequeña: nivel de evidencia baja y tamaño de muestra visible (CA-3, CA-25).
- Deal perdido sin motivo: cuenta como «sin dato» (CA-10).
- IA caída o presupuesto agotado: se conserva la última revisión (CA-45, CA-46).
- Sugerencia contra un valor confirmado por una persona: queda pendiente (CA-34).
- Sugerencia descartada: no vuelve sin evidencia nueva (CA-5).
- Sugerencia de precio para un rol sin permiso: no se muestra (CA-19).
- Fuente sin licencia o que exige extraer LinkedIn: excluida (CA-62, CA-64).
- Rol sin permiso para aplicar: puede ver, no aplicar (CA-38).
- Persona con varias empresas: las sugerencias, decisiones y silencios son por empresa (CA-53, CA-54).
- Telegram: mismas reglas de rol y de confirmación (CA-57, CA-58).
- Evidencia que desaparece o cambia: sugerencia resuelta o con tendencia (CA-50, CA-51).
- Sugerencia fija y de IA sobre lo mismo: se muestra una (CA-47).
- Datos personales en notas de llamada: no se copian a las sugerencias (CA-48).

## 9. Experiencia y copy
Sugerencias en el Inicio y en Sugerencias, con su evidencia desplegable, el nivel de evidencia con palabra («Baja», «Media», «Alta»), el tamaño de la muestra y tres botones: «Aceptar», «Más tarde», «Descartar». Estados con palabra: Nueva, Aceptada, Pospuesta, Descartada, Aplicada, Resuelta. «Tú», sin iconos, sin signos de exclamación. Copy de ejemplo con datos ficticios:
- «Tus últimas ventas se concentran en un sector que ningún ICP incluye. ¿Creamos un ICP para ese sector?»
- «Este experimento llegó a su fecha de revisión. ¿Lo escalas, lo ajustas o lo cierras?»
- «No hay datos para evaluar este objetivo. Falta cargar los costes de adquisición del segmento.»
Modo «Revisión crítica»: botón en Estrategia y en el Asesor, con la misma salida estructurada.

## 10. Datos, permisos y privacidad
- Lee ICP, segmentos, posicionamiento, competidores, productos y líneas de deal, pipeline, leads, reuniones y notas de llamada, señales de cuentas, métricas reales conectadas y experimentos de la empresa activa.
- Las notas de llamada y de sensing pueden contener datos de personas: no se exponen fuera de la empresa, no se usan en ejemplos y no se copian a las sugerencias salvo permiso (CA-48).
- Quién decide: todos los roles de la empresa pueden aceptar, posponer o descartar una sugerencia (decisión de Fede, 27 oct). Aplicar el cambio sigue limitado por el permiso de cada rol sobre ese dato (CA-38), y pedir una revisión con IA queda para Owner y Sales Leader (CA-40) por su coste.
- Los precios y costes solo los ven los roles que ya los ven (CA-19).
- LinkedIn: solo API oficial; ninguna valoración de personas con datos de LinkedIn.
- Los datos de proveedores se usan solo con licencia confirmada (CA-62).

## 11. Unidades de trabajo (fases)
Este SDD es maestro. Se recomienda un PR por fase; cada fase puede promoverse a SDD propio si Fede lo prefiere. No se arranca una fase sin aprobar la anterior.
- **F0 · Fundación y captura de datos** (H-1, H-2). Sin IA. Salida: sugerencia con evidencia y decisión registrada; motivo de pérdida y competidor al perder un deal.
- **F1 · Reglas fijas por elemento** (H-3). Sin IA. Depende de F0; la regla de competidores depende del SDD 7b. Salida: sugerencias de ICP, segmentos, pipeline, producto, precio y posicionamiento.
- **F2 · Experimentos con criterio de cierre** (H-4). Sin IA. Depende de F0. Salida: experimentos con regla de cierre, revisión y decisión.
- **F3 · Ejecutar** (H-5). Sin IA. Depende de F0, F1 y de los SDD 1 y 2. Salida: aceptar una sugerencia crea cambio pendiente, tarea o experimento enlazado.
- **F4 · Revisión estratégica con IA** (H-6). Una llamada estructurada por revisión. Depende de F0 a F3. Salida: hasta 7 sugerencias con evidencia citada y modo «Revisión crítica».
- **F5 · Monitorear** (H-7). Sin IA nueva. Depende de F0 a F4. Salida: bloque semanal, tendencias, revisión periódica e historial.
- **F6 · Agente, Telegram y MCP** (H-8). Sin IA nueva. Puede ir después de F1; las herramientas de experimentos, después de F2; se completa tras F4.
- **F7 · Fuentes de terceros** (H-9). Bloqueada hasta que Fede resuelva las decisiones P1.1 y P1.2 de la auditoría del 24 de octubre.

## 12. Notas técnicas [Sugerencia — Claude Code valida; la auditoría independiente revisa]
- Reglas fijas: un archivo por regla en `src/lib/proactive/detectors/`, listado en `DETECTORS`, ampliando `Snapshot` con campos opcionales como hacen las demás; claves de deduplicación por elemento y causa para que un descarte no vuelva; acciones que reutilizan herramientas del registro del Agente.
- Almacén: reutilizar las sugerencias existentes con detectores nuevos de la familia `strategy_*`; la evidencia estructurada y el nivel necesitan un lugar propio **[Por verificar]** (columnas actuales de la tabla de sugerencias).
- Asesor: ampliar `buildSnapshot` en `src/lib/advisor.ts` (puro y con pruebas) con ICP, cuentas, leads y experimentos; ampliar `ADVISOR_SCHEMA` con evidencia citada, nivel y acción propuesta; conservar `gtm_advisories` como historial.
- Experimentos: migración nueva en `drizzle/migrations` con los campos de umbral de éxito, regla de cierre, fecha de revisión y decisión, con RLS por `org_id` y `GRANT`; los existentes quedan con valores vacíos.
- Deals perdidos: motivo y competidor como campos propios; el competidor puede proponerse desde el campo «Competition» de MEDDPICC; lista de motivos propuesta: Precio, Competidor, Sin decisión, Sin presupuesto, Sin encaje con el producto, Mal momento, Cambio de contacto, Otro (más texto libre). Fede la valida antes de F0 **[Por verificar]**.
- Propuestas y origen: reutilizar `applySetupItems`, `undoSetupItems`, `provenance.ts`, `autoWriteDecision` y el patrón de `field-proposals.ts`; origen «Revisión estratégica».
- Monitoreo: ampliar `src/lib/weekly-report.ts` y reutilizar el trabajo horario existente y `background_jobs` para la revisión periódica.
- Agente y MCP: módulo nuevo en `src/lib/agent/tools/`, títulos en `TITLES` y manifiesto actualizado; las herramientas que gastan crédito o escriben son de escritura con confirmación (auditoría, punto P1.4); pruebas con `expectScoped` por empresa.
- **Uso de LLM:** decidir cuándo avisar y qué sugerir en F0 a F3 = reglas fijas, cero LLM; la redacción de cada sugerencia sale de plantillas. F4: una llamada con respuesta estructurada, `effort:"low"` por defecto y «A fondo» solo a petición explícita, con caché por huella de las entradas. F5 a F7: sin LLM nuevo. Una llamada no declarada aquí obliga a parar y preguntar.
- Nivel de evidencia (propuesta): baja con menos de 5 registros de origen, media de 5 a 9, alta desde 10; validada por Fede el 27 oct.

## 13. Riesgos y dependencias
- Ruido por demasiadas sugerencias: tope de 7, deduplicación y silencio por tipo (CA-5, CA-7, CA-53).
- Falsa precisión con pocos datos: nivel de evidencia y «falta dato» (CA-2, CA-3, CA-25).
- Alucinación de la IA: evidencia citada obligatoria y «sin dato» (CA-41, CA-42).
- Coste de IA: caché, modo barato por defecto y presupuesto (CA-44, CA-45).
- Dependencia de SDD 1, 2, 7b y 9, todos en borrador según `docs/sdd/README.md`; y de las migraciones 0058, 0060, 0061 y 0063, que `AGENTS.md` describe como verificadas en local y no aplicadas a la base real **[Por verificar]**.
- Licencia de datos de Apollo y Clay y extracción de LinkedIn con robots: decisiones P1.1 y P1.2 pendientes (fase 7).
- Solapamiento con el Asesor GTM actual: resuelto, la revisión estratégica lo sustituye (pregunta 4).
- Datos personales en notas de llamada (CA-48).
- Hueco conocido: `decide_approval` falla desde Telegram según la auditoría; no bloquea este SDD salvo que una sugerencia pase por aprobaciones.

## 14. Preguntas para Dani (en NOKKO las responde Fede)
Respondidas por Fede el 27 oct:
1. ¿Quién decide? Todos los roles.
2. ¿Umbrales? Validados tal como se proponen.
3. ¿Frecuencia de la revisión periódica? Mensual.
4. ¿El Asesor GTM actual? Lo sustituye la revisión estratégica.

Abierta:
5. ¿Validas esta lista de motivos de pérdida: Precio, Competidor, Sin decisión, Sin presupuesto, Sin encaje con el producto, Mal momento, Cambio de contacto, Otro?

## 15. Pendiente de verificar
- [Por verificar] Columnas y estados actuales de la tabla de sugerencias y si admite evidencia estructurada y nivel.
- [Por verificar] Estado en `production` y en la preproducción: solo se leyó `main` en el commit d0e4821.
- [Por verificar] Coste real de una revisión estratégica (sin dato) y cómo se contabiliza en el presupuesto de la empresa.
- [Por verificar] Volumen de datos reales por empresa (sin dato; la Fase A mostró 0 leads el 21 de octubre de 2026).
- [Por verificar] Si existe motivo de pérdida o competidor por deal fuera de lo que muestran los tipos generados (no hay columna en `main`).
- [Por verificar] Estado de aplicación de las migraciones 0058, 0060, 0061 y 0063 en la base real.
- [Por verificar] Contenido real del campo «Competition» de MEDDPICC en deals de empresas reales (sin dato).
- [Por verificar] Lista de motivos de pérdida propuesta, pendiente de validar por Fede (pregunta 5).

## 16. Sección de Dani (en NOKKO la completa Claude Code; decide Fede)
- Diseño técnico:
- Tareas:
- Estimación:
- Decisión: Aceptado / Cambios pedidos / Rechazado

---
Validación: linter PASA (0 bloqueantes, 0 avisos). Auditoría hecha en el mismo contexto, no por un agente independiente. Decisiones 1 a 4 respondidas por Fede el 27 oct; pendiente su OK final y la pregunta 5.
