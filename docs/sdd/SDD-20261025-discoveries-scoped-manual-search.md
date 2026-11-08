# SDD-20261025-discoveries-scoped-manual-search · [Mejora] Descubiertos: qué busca, cuándo, y búsqueda manual acotada

**Tipo:** Mejora · **Prioridad propuesta:** Alta
**Estado:** Aprobado por Fede el 2026-11-08 solo para la U-2 (alcance e ICP en la búsqueda manual, con el reloj semanal intacto); U-1, U-3 y U-4 pasan a un ticket aparte (antes: Borrador) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-25
**PRD:** docs/prd/PRD-20261028-ux-onboarding-coherencia.md (cubre G-7) · **Depende de:** SDD-20261025-field-actions-edit-delete-confirm (confirmar competidores; NK-0007 ya en producción)

## 1. Resumen
Tres cosas: (a) dejar claro al usuario **qué busca** Descubiertos y **cuándo**; (b) poder lanzar una búsqueda manual **eligiendo qué buscar** (solo empresas, solo contactos, solo competidores o combinaciones); (c) que la búsqueda manual no altere sin avisar el ritmo semanal.

## 2. Problema y para quién
Founder que dispara una búsqueda manual y no puede decidir el alcance, no sabe cuándo se ejecutó ni cuándo toca la próxima, ni cuánto gasta.

## 3. Evidencia y por qué ahora
- Petición directa de Fede (2026-10-25 13:25).
- Nota: `https://nokko.ai/discoveries` exige sesión y no se pudo leer; el análisis se basa en el código del repo (`main`, 2026-10-25). **[Por verificar]** que producción coincide.
- Comportamiento actual (código):
  - Búsqueda semanal por empresa; bloqueo por empresa que impide repetir antes de ~7 días menos 1 hora.
  - Hasta 3 ICP por ejecución. Por ICP: 4 empresas, 4 contactos y 2 búsquedas. Máximos por ejecución: 12 empresas, 12 contactos, 5 competidores.
  - Umbral de encaje: 60. Deduplicación por clave. Presupuesto por empresa con pausa automática al 100 % (regla de presupuesto actual, fuente: código del repo).
  - Hasta ~7 llamadas a IA por ejecución.
  - La ejecución manual con «forzar» **reinicia el reloj semanal**, lo que retrasa la siguiente automática.
  - Los competidores hallados se añaden a las alternativas competitivas del posicionamiento cuando la persona pulsa «Añadir a competidores» (`src/routes/_authenticated/discoveries.tsx`); Fede decidió que piden su OK.
  - La información de última/próxima ejecución no es legible desde la interfaz.
  - No hay herramienta del Agente para lanzar una búsqueda.

**Apuesta declarada:** no hay datos de uso; la prioridad se apoya en el código de `main` y en la petición de Fede. Se medirá tras el lanzamiento con las métricas de la sección 4.

## 4. Resultado buscado
- % de búsquedas manuales con alcance acotado (fuente: registro de ejecuciones). Línea base: sin dato.
- Coste medio de una búsqueda acotada vs completa (fuente: registro de presupuesto). Línea base: sin dato.
- Reclamaciones por «no sé cuándo busca»: sin dato.
- Cubre el objetivo G-7 del PRD.

## 5. Alcance
**Incluye:** selector de alcance (empresas / contactos / competidores, combinables) y de ICP; vista de qué se busca y cuándo (última, próxima, qué se buscó); estimación de coste antes de lanzar; reloj semanal intacto (CA-11); herramienta para lanzar desde el Agente.
**No incluye:** nuevas fuentes de datos; cambiar umbrales de encaje o máximos; búsqueda de contactos sin empresa base si no es viable (pregunta 1); automatización semanal distinta de la actual.

## 6. Cambios de comportamiento (delta)
**Añadido:** alcance elegible; panel de "qué y cuándo"; estimación previa; lanzamiento desde el Agente.
**Modificado:** búsqueda manual (antes: siempre completa y reinicia reloj; después: acotada y con el reloj semanal intacto).
**Eliminado:** reinicio silencioso del reloj semanal.

## 7. Historias y criterios de aceptación
### H-1: Como founder, quiero saber qué busca NOKKO y cuándo.
- CA-1: El sistema DEBE mostrar para mi empresa la fecha de la última ejecución, la próxima prevista, el origen (automática/manual) y el alcance buscado · cubre G-7 · prueba: por nombrar en el brief
- CA-2: El sistema DEBE mostrar para cada ICP activo qué criterios se usan y los máximos por tipo · cubre G-7 · prueba: por nombrar en el brief
- CA-3: SI la búsqueda está pausada por presupuesto, ENTONCES el sistema DEBE indicarlo con el motivo y cómo reanudar · cubre G-7 · prueba: por nombrar en el brief

### H-2: Como founder, quiero elegir qué buscar al lanzar manualmente.
- CA-4: CUANDO lanzo una búsqueda manual, el sistema DEBE permitirme elegir uno o varios tipos: empresas, contactos, competidores · cubre G-7 · prueba: `src/lib/discoveries.test.ts` («Descubiertos scope»)
- CA-5: CUANDO lanzo una búsqueda manual, el sistema DEBE permitirme elegir qué ICP incluir · cubre G-7 · prueba: `src/lib/discoveries-scope.test.ts` (ICP de esta empresa)
- CA-6: CUANDO elijo un alcance, el sistema DEBE ejecutar y gastar presupuesto solo en los tipos elegidos · cubre G-7 · prueba: `src/lib/discoveries-scope.test.ts` («only competitors»)
- CA-7: SI elijo contactos sin empresas, ENTONCES el sistema DEBE usar las empresas ya guardadas de ese ICP y avisar si no hay ninguna. **[Por verificar viabilidad]** · cubre G-7 · prueba: por nombrar en el brief
- CA-8: SI elijo competidores, ENTONCES el sistema DEBE mostrarme los candidatos y NO añadirlos al posicionamiento hasta que los confirme · cubre G-7 · prueba: por nombrar en el brief

### H-3: Como founder, quiero ver el coste antes de lanzar.
- CA-9: CUANDO voy a lanzar una búsqueda, el sistema DEBE mostrar el máximo de resultados y la estimación de coste del alcance elegido y el presupuesto restante · cubre G-7 · prueba: por nombrar en el brief
- CA-10: SI el coste estimado supera el presupuesto restante, ENTONCES el sistema DEBE avisar y ofrecer reducir el alcance · cubre G-7 · prueba: por nombrar en el brief

### H-4: Como founder, quiero controlar el ritmo semanal.
- CA-11: CUANDO lanzo una búsqueda manual, el sistema DEBE dejar el reloj de la búsqueda automática intacto, siempre (decidido por Fede, 2026-10-28: sin excepción) · cubre G-7 · prueba: `src/lib/discoveries-scope.test.ts` («never moves the weekly clock»)
- CA-12: Retirado (decidido por Fede, 2026-10-28): el reloj semanal nunca se reinicia desde una búsqueda manual; lo cubre CA-11. · cubre G-7 · prueba: no aplica

### H-5: Como founder, quiero lanzarlo desde el Agente.
- CA-13: CUANDO pido al Agente una búsqueda con un alcance, el sistema DEBE mostrar alcance, coste y ejecutar solo con mi aprobación · cubre G-7 · prueba: por nombrar en el brief
- CA-14: El sistema DEBE aplicar las mismas reglas de rol y presupuesto que en pantalla · cubre G-7 · prueba: por nombrar en el brief

## 8. Casos límite y errores
- Ya hay una búsqueda en curso: no lanzar otra y mostrar el estado (CA-1).
- Sin ICP definidos: indicar que hay que crear uno y enlazar (CA-5).
- Resultados bajo el umbral de encaje: no se guardan; informar del número descartado (CA-6).
- Duplicados: no se guardan de nuevo; informar del número (CA-6).
- Fallo del proveedor de datos: informar, no gastar presupuesto no consumido y permitir reintentar (CA-9).
- Rol sin permiso para lanzar: ocultar/desactivar con explicación (CA-14).

## 9. Experiencia y copy
Botón «Buscar ahora» abre selector: «¿Qué quieres buscar?» Empresas / Contactos / Competidores; «¿En qué ICP?». Antes de lanzar: «Hasta 12 empresas. Coste estimado: *X*. Te quedan *Y*.» Panel: «Última búsqueda: *fecha*. Próxima: *fecha*.» En «tú», sin iconos. Cifras de coste: sin dato hasta que las confirme la revisión técnica.

## 10. Datos, permisos y privacidad
Se guardan alcance, origen y coste por ejecución. Contactos: solo datos de fuentes ya usadas hoy; **[Por verificar]** proveedores y base legal de los datos de contacto en la revisión técnica. LinkedIn: no se usa más que la API oficial, y NOKKO no valora perfiles de LinkedIn.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Puntuación o clasificación de resultados de la búsqueda (hoy hasta ~7 llamadas a IA por ejecución, según el código) | regla → caché por clave de deduplicación → modelo; sin LLM para elegir alcance ni calcular coste | modelo: el que decide `aiProviders()` (`src/lib/gemini.ts`: claves propias primero, pasarela de Lovable de respaldo); esfuerzo `effort:"low"` | sin dato (costes por tipo: [Por verificar]) |

Una llamada no declarada aquí no se implementa.

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | Panel de qué y cuándo (H-1) | CA-1, CA-2, CA-3 | por nombrar en el brief |
| U-2 | Alcance y selector de ICP en manual (H-2, H-4). **Entregada en NK-0011** | CA-4, CA-5, CA-6, CA-7, CA-8, CA-11 | `src/lib/discoveries-scope.test.ts` |
| U-3 | Estimación de coste y presupuesto (H-3) | CA-9, CA-10 | por nombrar en el brief |
| U-4 | Herramienta del Agente (H-5; depende de U-2) | CA-13, CA-14 | por nombrar en el brief |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Código: `src/lib/discoveries.ts`, `discoveries.server.ts`, `discoveries.functions.ts`, `src/components/discoveries/icp-panel.tsx`, `src/routes/_authenticated/discoveries.tsx`, función hora `org-maintenance` en `src/lib/inngest/functions.server.ts`.
- `discoverForOrg` escribe el bloqueo antes de ejecutar; con `force:true` reinicia el reloj (CA-11 exige que la búsqueda manual no lo reinicie). `decideDiscovery` añade competidores a `positioning.competitive_alternative` (hoy solo cuando la persona pulsa «Añadir a competidores»; decidido por Fede: piden su OK).
- Los bloqueos (`job_locks`) no son legibles desde el cliente: exponer última/próxima mediante lectura dedicada.
- **Uso de LLM:** búsqueda acotada reduce llamadas (≤7 hoy). Reglas: sin LLM para elegir alcance ni calcular coste; LLM solo en puntuación/clasificación de resultados, `effort:"low"`, y cachear por clave de deduplicación para no reevaluar candidatos ya puntuados.

## 14. Riesgos y dependencias
- Dueño de la confirmación de competidores: SDD de acciones sobre campos. La entidad Competidor se define en el SDD de datos mínimos; ambos SDD se coordinan.
- Gasto: más control puede aumentar lanzamientos; mitigado por CA-9/CA-10.
- Depende de SDD de acciones sobre campos para confirmar competidores.

## 15. Preguntas para Fede y para la revisión técnica
1. ¿Se puede buscar contactos de empresas ya guardadas sin repetir la búsqueda de empresas?
2. ¿Qué coste real tiene cada tipo de búsqueda?
3. ¿Producción coincide con `main` en Descubiertos?

## 16. Pendiente de verificar
- [Por verificar] Contenido real de `nokko.ai/discoveries` (requiere sesión).
- [Por verificar] Viabilidad de CA-7.
- [Por verificar] Costes por tipo (sin dato).
- [Por verificar] Base legal y proveedores de contactos.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Un agente `nokko-gate` con contexto fresco lee este SDD y el código, y devuelve su informe. El coordinador lo copia aquí sin editarlo. El gate no aprueba el SDD: informa; la aprobación es de Fede.
Informe del gate recibido el 2026-10-28, copiado sin editar. El veredicto no aprueba el SDD: la aprobación es de Fede.
- **Veredicto del gate:** Objeciones
- **CA sin prueba posible o sin G-n:** Los 14 CA citan G-7, que es el objetivo correcto (`PRD…:30`). Pero ninguno nombra un test: todos dicen «por nombrar en el brief» (`SDD:45-66`, `:92-95`), y la plantilla pide un archivo (`templates/sdd.md:33`). CA-9 y CA-10 no se pueden probar mientras el coste sea «sin dato» (`SDD:77`). En la sección 8, tres casos remiten a un CA que no los recoge: provider caído → CA-9, descartados → CA-6, búsqueda en curso → CA-1 (`SDD:69-73`). Falta el caso multitenant.
- **[Por verificar] que sigue sin comprobarse:** Que producción coincide con el repo y la base legal de los contactos. Dos ya se pueden comprobar en el repo:
  - **CA-7:** `findKeyPeople` ya acepta `accountId` (`discoveries.server.ts:91`).
  - **Costes por tipo:** hay costes estimados por servicio (`orchestrator/planner.ts:13-31`).
  - **Modelo:** no es «sin dato»; está en `gemini.ts:9,16`.
- **Contradicciones con el código o con decisiones previas:**
  - **Competidores sin confirmación:** el SDD dice que se añaden solos o «sin confirmación» (`SDD:22,99`). Es falso: solo se añaden cuando aceptas («Añadir a competidores», `discoveries.tsx:127`; `discoveries.functions.ts:72-77`). CA-8 ya se cumple hoy.
  - **Reloj semanal:** CA-12 permite reiniciarlo, y Fede decidió «El reloj queda intacto» (`PRD:44`).
  - **Dependencia:** la cabecera dice «Depende de: —» (`SDD:5`), pero el PRD dice que depende del SDD 2 (`PRD:73`) y la propia sección 14 también (`SDD:106`).
  - **Referencia interna:** «(pregunta 2)» (`SDD:36`) apunta a la pregunta de costes; la de contactos es la 1 (`SDD:109`).
  - **IA (sección 11):** declara solo la puntuación. Faltan las llamadas de términos de búsqueda y de competidores (`discoveries.server.ts:58,119`). La caché por clave que propone ya existe (`:65`).
  - **Punto de entrada:** la pantalla lanza el job `discover` (`discoveries.tsx:56`; `job-runner.server.ts:168`, `force:true`), no `runDiscoveryNow`. Ese archivo no aparece en las notas técnicas (`SDD:98`).
- **Lo que esta revisión NO demuestra:** No he visto producción ni las políticas reales de `job_locks` en la base de datos (solo la migración 0007, sin policies). Tampoco los costes reales de los proveedores ni la viabilidad de UX de la estimación de coste. No he ejecutado tests.

## 18. Delta de implementación (lo rellena el agente al entregar)
**U-2, entregada en NK-0011 (2026-11-08).** Alcance aprobado por Fede: solo U-2; U-1 (panel de última y próxima), U-3 (coste previo) y U-4 (herramienta del Agente) pasan a un ticket aparte.
- «Buscar ahora» abre un selector (`src/components/discoveries/search-scope.tsx`): tipos (empresas, contactos, competidores) y, si hay más de un ICP, en cuáles. El job `discover` recibe `{ kinds, icpIds }`, validado con zod; el servidor comprueba que cada ICP es de la empresa (`background.functions.ts`).
- `discoverForOrg` solo ejecuta las ramas elegidas (CA-6) y **una búsqueda manual nunca mueve el reloj semanal** (CA-11): el bloqueo semanal solo lo escribe la búsqueda automática. El código rescatado de octubre lo movía si el alcance era completo; se corrigió para cumplir la decisión de Fede.
- CA-7: «solo contactos» busca en las cuentas objetivo del ICP con el mapa de poder casi vacío y avisa si no hay ninguna.
- CA-8 ya se cumplía: los competidores se añaden al posicionamiento solo al pulsar «Añadir a competidores».
- Tras el gate independiente: sin ICP, el selector enlaza a crearlo en Estrategia GTM; el aviso «define al menos un ICP» solo sale en la búsqueda manual (la semanal sigue callada); test de CA-5 con un ICP de otra empresa; la entrada de los trabajos en segundo plano (`job-runner.server.ts`) pasa de `any` a lectores tipados, porque el gate exige cada archivo tocado limpio.
- Interpretación de CA-7 confirmada por Fede el 2026-11-08: «empresas ya guardadas de ese ICP» = cuentas objetivo del segmento del ICP, con dominio y con el mapa de poder casi vacío (menos de 2 personas).
- Sin migraciones. Sin prueba manual con sesión iniciada.

---
Validación: migrado a la plantilla de NOKKO el 2026-10-28. Revisión técnica: ver sección 17. `AUDIT-20261025.md` es el registro histórico anterior.
