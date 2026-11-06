# SDD-20261030-gtm-control-tower-5c-assistant-server · [Feature] Servidor para asistentes y Telegram con las reglas del agente (fase 5c)

**Tipo:** Feature · **Prioridad propuesta:** Media
**Estado:** Aprobado por Fede el 2026-10-31 (v4, tras tres pasadas del gate; sin cuarta pasada; con los riesgos declarados del §14) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-31
**PRD:** `docs/prd/PRD-20261030-gtm-control-tower.md` · **Depende de:** SDD 5a (agente, propuestas y fase por rol: U-1 a U-5), SDD 5b (avisos y convocatoria por Telegram: U-1 y U-2), SDD 1a (roles y Consejo: U-1), el SDD de salida de Lovable C (servidor para asistentes) y los de A y B para construir · **Coordinar con:** `SDD-20261029-lovable-exit-c-mcp` (autenticación y dirección del servidor) · **Antes:** `SDD-20261030-gtm-control-tower-5a-agent-memory.md` y `SDD-20261030-gtm-control-tower-5b-notices-checkin.md`

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre.
> Los criterios no nombran tecnología; lo técnico va en el §13 como [Sugerencia — la revisión del gate las valida].
> Las reglas transversales del PRD (§6.2, R-1 a R-10) aplican a todo este SDD. «Organización» es la empresa que usa Nokko; «cuenta» es una empresa prospecto o cliente.
> Este SDD nace de dividir el SDD 5 (v4), que reunía 62 criterios; el original, con las tres pasadas del gate, está archivado en `docs/archivado/SUPERADO-SDD-20261030-gtm-control-tower-5-agent.md`. La numeración de criterios empieza de nuevo en cada uno de los tres.
> El borrador de plan con IA que el SDD 1b dejó a la serie 5 se redacta aparte (SDD 5d, decisión de Fede del 2026-10-31).
> Este SDD cumple lo que el PRD §6.1 decidió para el servidor para asistentes (lectura y escritura completa con las mismas reglas del agente) y lo que 1a CA-3 exige sobre el Consejo en Telegram y en el servidor. Los criterios nuevos CA-10, CA-11, CA-14 y CA-15 van tras CA-6 (H-1) y CA-12 y CA-13 tras CA-9 (H-2), sin reordenar.

## 1. Resumen
Expone al **servidor para asistentes** (herramientas de lectura y escritura) y a **Telegram** el mismo conjunto de herramientas y las mismas reglas que el agente del SDD 5a: permisos por rol, aprobación por quien pidió, auditoría, deshacer de 24 horas, ratificación solo del Owner y Consejo bloqueado. Toda escritura que el agente no puede hacer sin aprobación queda como propuesta pendiente. Fija a qué organización pertenece cada propuesta y aviso, para que cambiar de empresa no cruce datos.

## 2. Problema y para quién
Hoy el servidor para asistentes y Telegram comparten el registro de herramientas del agente, pero no respetan la fase por rol ni bloquean explícitamente al Consejo, y la empresa activa del perfil, compartida entre la app, Telegram y el servidor, puede cambiar a mitad de una conversación. Para Fede (Owner) y Flor (Sales leader).

## 3. Evidencia y por qué ahora
- **Código (repo de Nokko, solo lectura, 2026-10-31):**
  - El servidor para asistentes expone el mismo registro de herramientas (`src/lib/mcp/tools/agent-tools.ts`), actúa con el cliente de la persona y filtra por la empresa activa y su pertenencia (`src/lib/mcp/context.ts`); las escrituras quedan como acción pendiente con origen `mcp`, sin conversación, y se confirman en Sugerencias.
  - Telegram usa un cliente privilegiado que filtra por organización y persona (`src/lib/channel-ctx.server.ts`); las confirmaciones por Telegram usan la misma vía que la app (`src/routes/api/public/telegram/webhook.ts`).
  - `switch_company` cambia `profiles.current_org_id`, que comparten la app, Telegram y el servidor (`src/lib/mcp/tools/companies.ts`). El vínculo de Telegram es único por usuario y canal, sin organización.
  - El servidor y Telegram no consultan la fase por rol ni bloquean al Consejo hoy.
- **Entrevista con Fede (2026-10-29 a 31):** el servidor para asistentes con lectura y escritura completa y las mismas reglas del agente (elegido frente a la recomendación de solo lectura más propuestas); el Consejo bloqueado en agente, Telegram y servidor (PRD §6.1).
- **Decisiones de Fede para este SDD (2026-10-31):** solo aprueba quien pidió la propuesta; los avisos y el resumen son solo de Owner y Sales leader; el servidor tiene su propia empresa activa solo con la fase activa (valor inicial: la de la app; si la persona sale de esa organización, vuelve a la de la app) y cambiarla desde un asistente no mueve la de la app ni la de Telegram; el servidor usa un acceso con filtro explícito por empresa y persona, como Telegram; una propuesta de un asistente se ve en la app con su organización aunque esté en otra empresa y se ejecuta en la suya; las lecturas con coste que pide un asistente van con botón; la fila «MCP: lectura más proponer» del PRD se retira.
- Uso real del servidor y de Telegram: **sin dato** [Por verificar].

## 4. Resultado buscado
- Ninguna escritura de un asistente externo se aplica sin las reglas del agente (G-10). Medición: pruebas de CA-2, CA-10 y CA-14.
- Ningún dato cruza entre organizaciones por Telegram ni por el servidor (G-10). Medición: pruebas de CA-8, CA-9 y CA-11.

## 5. Alcance
**Incluye:** H-1 y H-2.
**No incluye:**
- El agente en la app, las propuestas y la memoria (SDD 5a); el resumen, los avisos críticos y el check-in (SDD 5b).
- La autenticación y el despliegue del servidor (SDD de salida de Lovable C).
- Herramientas nuevas: se reutiliza el registro actual.

## 6. Cambios de comportamiento (delta)
**Añadido:** guardia de fase y bloqueo explícito del Consejo en el servidor; empresa activa propia del servidor y acceso privilegiado con filtro explícito (CA-11, CA-15); coste previo y botón para las herramientas con coste que pida un asistente (CA-10); propuestas de un asistente visibles y ejecutables entre organizaciones (CA-14); reglas de lo que un asistente crea directamente y lo que queda como propuesta; organización guardada en cada propuesta y aviso; rechazo de aprobar una propuesta de otra organización.
**Modificado:** el servidor para asistentes y Telegram respetan las reglas de aprobación, auditoría y deshacer del SDD 5a; `create_task` y `draft_artifact` pasan en el servidor de acción pendiente a creación directa (CA-2); el texto «(Queda pendiente…)» de las respuestas y las instrucciones del servidor cambian para reflejar CA-2 y CA-10.
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
Cada CA cita el objetivo G-n del PRD que cubre y el archivo de prueba (ruta por decidir en la implementación [Sugerencia]).

### H-1: Como Owner, quiero usar Nokko desde mis asistentes externos con las mismas reglas que el agente.
- **CA-1** DONDE la fase esté activa para mi rol en la empresa activa del servidor (la guardada o, si no hay, la del perfil), el sistema DEBE exponer a mis asistentes externos las mismas herramientas de lectura y de escritura que el agente más las propias del servidor (cambiar de empresa, métricas y cobertura por segmento), con los mismos permisos por rol y las métricas y la cobertura solo para el Owner y el Sales leader, actuando en mi nombre y en la empresa activa del servidor (CA-11). · cubre G-7, G-10 · prueba: `assistant-server.test.ts`
- **CA-2** MIENTRAS la fase esté activa para mi rol en la empresa activa del servidor, el sistema DEBE dejar que un asistente externo cree directamente solo lo que el agente crea sin aprobación (consultas de lectura sin coste, investigaciones sin coste, borradores de documentos, sugerencias y tareas «Sin asignar», SDD 5a CA-20 y CA-26) y los borradores de correo (SDD 5a CA-27), y DEBE guardar toda otra escritura como propuesta pendiente de aprobación en la app (PRD R-2; SDD 5a CA-31), con las mismas reglas de aprobación y auditoría (SDD 5a CA-21 y CA-23), la ratificación solo del Owner y, cuando existan las herramientas del SDD 5d, el deshacer de 24 horas (SDD 5a CA-24), que entran solas en el servidor. · cubre G-10 · prueba: `assistant-server.test.ts`
- **CA-3** El sistema DEBE denegar el servidor para asistentes al Consejo, aunque su fase no esté activa, y a quien su rol no permita la herramienta pedida, con un error que diga qué pasó y qué hacer (PRD R-8). · cubre G-10 · prueba: `assistant-server.test.ts`
- **CA-4** El sistema DEBE abstenerse de exponer a los asistentes externos la lectura del registro personal de reuniones, del contenido del calendario y del correo (SDD 5a CA-28), y DEBE aplicar a los borradores de correo las mismas reglas que al agente (SDD 5a CA-27). · cubre G-10 · prueba: `assistant-server.test.ts`
- **CA-5** MIENTRAS la fase no haya estado nunca activa para mi rol en la empresa activa del servidor (la guardada o, si no hay, la del perfil), el sistema DEBE mantener sin cambios el servidor para asistentes actual (PRD R-9), salvo CA-3. · cubre G-10 · prueba: `assistant-phase-guard.test.ts`
- **CA-6** DONDE el Owner active la fase para otros roles (SDD 1a CA-5), el sistema DEBE ofrecerles el servidor para asistentes, en la empresa activa del servidor, solo con las herramientas que su rol permite y sin hallazgos ni cambios de estrategia. · cubre G-10 · prueba: `assistant-server.test.ts`
- **CA-10** MIENTRAS la fase esté activa para mi rol en la empresa activa del servidor, el sistema DEBE guardar como acción pendiente, con su coste previo visible en Sugerencias, toda herramienta con coste de proveedor de la lista de SDD 5a §10 que pida un asistente externo (SDD 5a CA-29), DEBE ejecutarla solo cuando la persona la pulse en la app y DEBE mostrar su resultado en la propia tarjeta de Sugerencias. · cubre G-6, G-10 · prueba: `assistant-server.test.ts`
- **CA-11** MIENTRAS la fase esté activa para mi rol, el sistema DEBE determinar la empresa activa del servidor de cada persona así: la guardada, si la persona sigue en ella con la fase activa; si no, la del perfil, si tiene la fase activa; y, si ninguna vale, DEBE responder con un error que diga qué pasó y qué hacer (PRD R-8). DEBE hacer que cambiarla desde un asistente externo no cambie la de la app ni la de Telegram y DEBE usar solo esa para las herramientas del servidor, filtrando siempre por esa empresa y por la persona y no por la del perfil. · cubre G-10 · prueba: `assistant-server.test.ts`
- **CA-14** MIENTRAS la fase esté activa para mi rol en la organización de la propuesta, el sistema DEBE mostrar en Sugerencias, con su organización, cada propuesta o acción con coste creada por un asistente externo aunque la app esté en otra empresa, DEBE comprobar al aprobar el rol y la pertenencia de la persona en esa organización, DEBE ejecutarla siempre en ella y nunca en la activa de la app, y SI la persona ya no es miembro o su fase está desactivada en ella, ENTONCES DEBE rechazarla con qué pasó y qué hacer. · cubre G-10 · prueba: `assistant-server.test.ts`
- **CA-15** El sistema DEBE hacer que, con el servidor en la empresa X, la persona vea y cambie por el servidor exactamente lo que vería y cambiaría en la app con X activa, incluidas las reglas por rol y por autor, y que cada cambio quede con su autoría (SDD 1a CA-68). · cubre G-10 · prueba: `assistant-server.test.ts`

### H-2: Como Owner o Sales leader, quiero usar el agente desde Telegram con las mismas reglas y sin cruzar organizaciones.
- **CA-7** El sistema DEBE denegar siempre al Consejo el agente por Telegram y, MIENTRAS la fase esté activa para mi rol, DEBE aplicar en Telegram las mismas reglas de permisos y de aprobación que en el panel (SDD 5a CA-21, CA-31 y CA-10) y aceptar la aprobación o el descarte de una propuesta solo de la persona que la pidió. · cubre G-10 · prueba: `telegram-agent-rules.test.ts`
- **CA-8** MIENTRAS la fase esté activa para mi rol en la organización de la propuesta, el sistema DEBE rechazar aprobar o descartar desde Telegram una propuesta del agente o una sugerencia con botones de una organización que no es la activa de la app, diciendo qué pasó y qué hacer (cambiar de empresa) (PRD R-10). · cubre G-10 · prueba: `org-isolation.test.ts`
- **CA-9** MIENTRAS la fase esté activa para mi rol en la organización nueva, CUANDO la empresa activa de la persona cambia en la app, el sistema DEBE abrir en su siguiente mensaje de Telegram una conversación nueva en esa organización e indicarle a qué organización va. · cubre G-10 · prueba: `org-isolation.test.ts`
- **CA-12** MIENTRAS la fase esté desactivada para mi rol, el sistema DEBE aplicar en el servidor y en Telegram SDD 5a CA-34 (las propuestas y acciones con coste pendientes creadas con la fase activa no se pueden aprobar, solo descartar), SDD 5a CA-35 y CA-37 (vuelta al comportamiento actual y ocultación) y DEBE rechazar con qué pasó y qué hacer los botones de Telegram de las propuestas congeladas y conservar sin uso la empresa propia del servidor. · cubre G-10 · prueba: `telegram-agent-rules.test.ts`
- **CA-13** MIENTRAS la fase no haya estado nunca activa para mi rol, el sistema DEBE mantener sin cambios Telegram (PRD R-9), salvo el bloqueo del Consejo de CA-7 y la ocultación de SDD 5a CA-35 y CA-37. · cubre G-10 · prueba: `telegram-agent-rules.test.ts`

## 8. Casos límite y errores
Cada caso remite al CA que lo cubre.
- Consejo intenta usar el servidor → denegado (CA-3); rol sin la fase activa → sin cambios (CA-5); otros roles con la fase activa → solo lo que su rol permite (CA-6).
- Petición de leer el registro de reuniones, el calendario o el correo → rechazada (CA-4).
- Telegram → mismas reglas de permisos, aprobación y Consejo bloqueado que el panel (CA-7).
- Empresa activa cambiada en la app → el siguiente mensaje de Telegram abre una conversación nueva en esa organización (CA-9).
- Asistente externo pide una escritura → propuesta pendiente en la app (CA-2); una lectura con coste → acción pendiente con coste y botón (CA-10).
- Asistente externo cambia de empresa → solo cambia la del servidor (CA-11).
- Fase desactivada con propuestas de un asistente pendientes → congeladas, solo descartables (CA-12).
- Persona en dos organizaciones con un solo chat de Telegram → el aviso indica la organización (CA-9).
- Propuesta de un asistente hecha en B con la app en A → visible con su organización y ejecutada en B (CA-14).
- Persona que sale de la organización del servidor → vuelve a la del perfil si vale; si ninguna vale, error (CA-11).
- Propuesta cruzada con la persona fuera de B o con la fase desactivada en B → rechazada con qué pasó y qué hacer (CA-14).
- Resultado de una lectura con coste pedida por un asistente → en la tarjeta de Sugerencias (CA-10).
- Fase activada antes de entregar 5c, o miembro nuevo en un rol con la fase activa → empresa del servidor tomada del perfil (CA-11).
- Descarte de una sugerencia de otra organización por Telegram → rechazado (CA-8).
- Con el servidor en X → ve y cambia lo mismo que en la app con X, con su autoría (CA-15).
- Fase nunca activada → servidor y Telegram sin cambios (CA-5, CA-13); Consejo → siempre denegado (CA-3).
- Sugerencia con botón de otra organización por Telegram → rechazada con qué pasó y qué hacer (CA-8).
- Aprobar desde Telegram una propuesta de otra organización → rechazado (CA-8); aviso de otra organización → indica cuál (CA-9).
- Asistente externo intenta aprobar una propuesta → no puede; la aprobación es en la app (CA-2).

## 9. Experiencia y copy
Sistema visual actual (Ink + Lima, versalitas con filete, sin iconos), textos en «tú».
- **Mensajes sugeridos** (a validar con la guía de voz de marca): «Tu rol no puede usar este asistente. Pídele al Owner que active tu acceso.» · «Esta propuesta es de otra empresa. Cambia de empresa en Nokko para aprobarla.» · «El asistente para el Consejo no está disponible. Usa la vista del Consejo en Nokko.»
- **Pantallas:** las propuestas creadas por un asistente se ven en Sugerencias, con su origen (SDD 5a CA-32).

## 10. Datos, permisos y privacidad
- **Conceptos nuevos:** empresa activa propia del servidor por persona; última organización usada por Telegram (para detectar el cambio, CA-9); organización guardada en cada propuesta y aviso (ya obligatoria en las propuestas); origen de cada propuesta.
- **Acceso:** hoy el servidor usa el cliente de la persona con reglas de acceso que dependen de la empresa del perfil (`current_org()`); para tener su propia empresa activa (CA-11) pasa a un acceso privilegiado con filtro explícito por empresa y persona, como Telegram, sin cambiar las reglas de acceso que la salida de Lovable C conserva; Telegram ya funciona así [Sugerencia — el gate valida].
- **Matriz de permisos:**

| Acción | Owner | Sales leader | Consejo | Otros roles |
|---|---|---|---|---|
| Usar el servidor para asistentes | Sí | Sí | No (siempre, CA-3) | Fase nunca activada: sin cambios (CA-5). Fase activa: solo lo que su rol permite (CA-6) |
| Cambiar la empresa activa del servidor desde un asistente | Sí (solo la del servidor, CA-11) | Sí (solo la del servidor, CA-11) | No | Con la fase activa, el mismo permiso que en la app para esa empresa (CA-15); sin ella, sin cambios |
| Aprobar en la app una propuesta de un asistente de otra organización | Sí, con rol y fase comprobados en ella (CA-14) | Sí, con rol y fase comprobados en ella (CA-14) | No | Según su rol en ella |
| Ver métricas y cobertura por segmento desde un asistente | Sí, con la fase activa (CA-1) | Sí, con la fase activa (CA-1) | No | No (CA-1); sin fase, sin cambios (CA-5) |
| Usar Telegram con el agente | Sí | Sí | No | Fase nunca activada: sin cambios (CA-13). Fase desactivada: CA-12. Fase activa: solo lo que su rol permite (SDD 5a CA-36, CA-37) |
| Aprobar una propuesta desde Telegram | Solo las suyas | Solo las suyas | No | Solo las suyas, según su rol |
| Aprobar una propuesta desde un asistente externo | No (la aprobación es en la app) | No | No | No |

- **Privacidad:** el servidor no expone el registro de reuniones, el calendario ni el correo (CA-4); los avisos por Telegram no llevan datos de clientes (SDD 5b CA-7); ningún dato de clientes en pruebas ni ejemplos.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna en esta fase | — | — | — |

Los asistentes externos usan su propio modelo; Telegram usa el turno del agente del SDD 5a.

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero [Sugerencia] | Depende de |
|---|---|---|---|---|
| U-1 | Servidor para asistentes con las mismas herramientas y reglas, guardia de fase y otros roles | CA-1 a CA-6, CA-10, CA-11, CA-14, CA-15 | `assistant-server.test.ts`, `assistant-phase-guard.test.ts` | SDD 5a U-1 a U-5, SDD 1a U-1, SDD de salida de Lovable C |
| U-2 | Telegram con las mismas reglas y organización de cada propuesta y aviso | CA-7 a CA-9, CA-12, CA-13 | `telegram-agent-rules.test.ts`, `org-isolation.test.ts` | U-1, SDD 5b U-1 y U-2 (avisos y convocatoria por Telegram), SDD 5a U-5 (propuestas congeladas) |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- **Servidor para asistentes (cambios):** la descripción de `switch_company` («también en la app») y el campo `active` de `list_companies` deben reflejar la empresa del servidor; Telegram reutiliza hoy la última conversación de la organización activa (`webhook.ts`), no abre una nueva (CA-9). Hoy `create_task` y `draft_artifact` quedan pendientes y los textos «(Queda pendiente…)» y las `instrucciones` del servidor (`src/lib/mcp/index.ts`, `agent-tools.ts`) y el manifiesto `.lovable/mcp/manifest.json` lo dicen; hay que cambiarlos. El servidor expone además `list_companies`, `switch_company`, `get_real_metrics` y la cobertura por segmento (CA-1).
- **Acceso y autoría (CA-11, CA-15):** el servidor pasa a un acceso privilegiado con filtro explícito por empresa y persona; hay que reproducir las reglas por rol y por autor que hoy aplican las reglas de acceso (lectura de documentos por autor, borrado solo del Owner, cuotas solo de Owner y Sales leader, registro personal de reuniones de 4b) y pasar `created_by` y `updated_by` de forma explícita, porque el cliente privilegiado no tiene sesión. Con la fase nunca activada o desactivada el servidor sigue con el cliente de la persona; con la fase activa usa el acceso privilegiado.
- **Aprobación entre organizaciones (CA-14):** `decidePending` y `userCtx` toman hoy la empresa del perfil y el cliente de la persona; para ejecutar en la organización de la propuesta hay que pasar a acceso privilegiado con filtro explícito, y `AssistantActions` (`assistant-actions.tsx`) debe traer y mostrar la organización.
- **Servidor para asistentes:** ya actúa con el cliente de la persona y filtra por empresa activa y pertenencia; faltan la guardia de fase y el bloqueo explícito del Consejo. Las acciones pendientes creadas desde el servidor no tienen conversación; se ven en Sugerencias. `switch_company` hoy cambia la empresa del perfil; CA-11 la sustituye por una empresa activa propia del servidor, y las lecturas con coste hoy se ejecutan al momento (`agent-tools.ts`), por lo que CA-10 las cambia.
- **Telegram:** el vínculo es único por usuario y canal, sin organización; CA-8 y CA-9 exigen indicar la organización en los avisos y rechazar aprobar una propuesta de otra.
- La salida de Lovable C cambia la autenticación y la dirección del servidor.

## 14. Riesgos y dependencias
- Depende de los SDD 5a (reglas, propuestas y fase por rol) y 5b (avisos por Telegram) y de la salida de Lovable C, que sigue en Borrador.
- **Escritura completa:** Fede la eligió frente a solo lectura con propuestas (2026-10-31); el riesgo es el volumen de propuestas y que un asistente tenga la identidad de la persona; CA-2 las mantiene pendientes y CA-3 y CA-6 limitan los roles.
- La empresa activa del perfil sigue compartida entre la app y Telegram; el servidor tiene la suya (CA-11). Cuando se cambia en la app, Telegram abre una conversación nueva en esa organización (CA-9).
- **Aprobado sin cuarta pasada:** Fede aprobó 5a, 5b y 5c con los riesgos declarados (2026-10-31). El acceso privilegiado y la aprobación cruzada desde la app (CA-14) son los puntos de mayor riesgo: reproducir las reglas por rol y por autor y pasar la autoría de forma explícita (CA-15) es trabajo de implementación que el gate no ha podido probar.
- La prueba del CA-17 de la salida de Lovable C (`mcp-tools.test.ts`) la complementa la de 5c: con la fase nunca activada, CA-5 mantiene ese comportamiento.
- La salida de Lovable C (Borrador) congela «las mismas herramientas que hoy, con el mismo comportamiento y permisos» (el CA-17 de ese SDD); este SDD cambia ese comportamiento con la fase activa, por lo que C se entrega antes y 5c lo modifica después.
- El aviso de otra organización por Telegram indica cuál (CA-9); una persona en dos organizaciones recibe los avisos de ambas en el mismo chat.
- **Criterios con varias obligaciones:** CA-2, CA-4, CA-7, CA-8, CA-9 y CA-11 describen una regla con sus condiciones; el brief puede dividir sus pruebas.
- Rotar claves o tokens (salida de Lovable B y C) puede interrumpir el servidor.

## 15. Preguntas para Fede y para la revisión técnica
- Resuelto por Fede (2026-10-31, tras la primera pasada del gate de 5c): el servidor tiene su propia empresa activa (CA-11); las lecturas con coste de un asistente van con botón (CA-10); se retira del PRD la fila «MCP: lectura más proponer».
- Resuelto por Fede (2026-10-31): lo indicado en el §3.
- Resuelto por Fede (2026-10-31, tras la segunda pasada de 5c): el servidor usa un acceso privilegiado con filtro explícito (CA-11); una propuesta de un asistente se ve en la app con su organización y se ejecuta en la suya (CA-14); la empresa propia del servidor existe solo con la fase activa y, si la persona sale de esa organización, vuelve a la de la app (CA-11).
- Decisión del autor, a confirmar por Fede: las métricas y la cobertura por segmento del servidor son solo para Owner y Sales leader (CA-1).
- Revisión técnica: ¿cómo se identifica a la persona que usa un asistente externo para aplicar sus permisos por rol y el bloqueo del Consejo? (hoy sale de la sesión de la persona; la salida de Lovable C la cambia)

## 16. Pendiente de verificar
- Uso real del servidor para asistentes y de Telegram → datos de producción.
- Si hay un bot de Telegram en producción y quién lo usa → Fede.
- Identidad de la persona en el servidor tras la salida de Lovable C (hoy sale de la sesión de la persona y de `org_members`, verificado) → gate.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
**Primera pasada del gate (2026-10-31, sobre la v1).** Informe copiado sin editar. Los hallazgos de las tres pasadas del SDD 5 original que atañen a este SDD estaban aplicados en los criterios o declarados en el §14 y el §15.

**Veredicto:** Bloqueado

Las citas a 5a y 5b son correctas. 5c aplica bien varios hallazgos de la tercera pasada del SDD 5:
- Un asistente ya no aprueba propuestas: CA-8 vale solo para Telegram.
- CA-8 y CA-9 llevan la guardia de fase.
- CA-9 se limita a los avisos nuevos de 5b, sin chocar con 5b CA-2.
- `switch_company` queda como escritura directa permitida.
- La lista de CA-2 incluye ya los borradores de documentos y las sugerencias.

Bloquean la aprobación tres problemas.

**Bloqueantes**

1. **CA-2 (L51): nadie dice qué pasa con las lecturas que gastan crédito cuando las pide un asistente.**
   - **Qué falla:** CA-2 deja que un asistente haga «consultas de lectura» directamente y manda a propuesta «toda otra escritura».
     - Las 11 herramientas con coste del §13 de 5a (`research_account`, `clay_*`, `apollo_find_*`, `enrich_accounts_table`, `complete_account`, `find_key_people`, `find_icp_companies`) son de lectura. Hoy el servidor las ejecuta al momento (`src/lib/mcp/tools/agent-tools.ts:130-131`).
     - En el agente pasan a acción pendiente con el coste previo en la tarjeta (5a CA-29; PRD R-2, «muestra su coste previo»). CA-2 no cita 5a CA-29.
     - Así, ni son una escritura que pase a propuesta ni el agente las crea sin aprobación: la prueba no puede decidir si `research_account` pedida por un asistente se ejecuta o queda pendiente.
   - **Cómo resolverlo:** añadir a CA-2 que esas herramientas quedan como acción pendiente con su coste previo, que se ve en Sugerencias, citando 5a CA-29. Añadir también el caso al §8.

2. **Cambiar de empresa desde un asistente cambia la organización de la app y de Telegram, y ningún CA lo cubre (CA-2 L51, CA-9 L60, §14 L113).**
   - **Qué falla:**
     - `switch_company` escribe `profiles.current_org_id` (`companies.ts:36`).
     - La app inserta con `org_id` por defecto `current_org()`, y las reglas de acceso solo exigen ser miembro. Si la persona tiene la app abierta en la empresa A y un asistente cambia a la B, lo que guarde la app con datos de A cargados se escribe en B. Eso cruza datos entre organizaciones (R-10).
     - El §14 da CA-9 como mitigación, pero CA-9 solo habla de las conversaciones y de los avisos de Telegram. CA-2 remite el cambio de empresa a CA-9, que no lo define.
     - En Telegram, tras el cambio, el siguiente mensaje entra sin aviso en la última conversación de la otra empresa (`webhook.ts:95`). «Afecta solo a las conversaciones nuevas» no dice si ese mensaje sigue en A o pasa a B, así que no se puede probar con un sí o un no.
   - **Cómo resolverlo:** un CA que diga qué pasa en la app y en Telegram cuando un asistente cambia de empresa. Opciones: avisar en la app y recargar, impedir que la app guarde con una organización que ya no es la activa, o que el servidor no cambie la empresa de la app. Y que CA-9 diga a qué organización va el siguiente mensaje de Telegram y que se lo indica a la persona.

3. **CA-5 (L54) choca con 5a CA-34 cuando la fase se desactiva.**
   - **Qué falla:**
     - CA-5 mantiene «sin cambios» el servidor y Telegram mientras la fase no esté activa, y no distingue entre «nunca activada» y «desactivada después».
     - 5a CA-34 congela, sin dejar aprobarlas, las propuestas creadas con la fase activa.
     - Con Telegram «sin cambios», el botón «Confirmar» de una propuesta enviada antes de desactivar la fase la aplica: `decidePending` no mira la fase (`agent.functions.ts:57-66`).
     - 5c no tiene ningún CA equivalente a 5a CA-35 para el servidor ni para Telegram, así que no se sabe qué pasa con las propuestas que creó un asistente.
   - **Cómo resolverlo:** que CA-5 cubra solo la fase nunca activada para ese rol, y un CA nuevo que aplique 5a CA-34 y CA-35 al servidor y a Telegram (propuestas congeladas, botones rechazados con «qué pasó y qué hacer»).

**Cambios menores**

- **CA-5 (L54):** incluye «el email diario actual», que es de 5b (CA-3) y que el §5 de 5c excluye. Quitarlo de 5c.
- **§12, U-2 (L102):** CA-9 abarca «cada aviso nuevo por Telegram del SDD 5b», y eso incluye la convocatoria del check-in (5b CA-18, en 5b U-2). Falta declarar la dependencia de 5b U-2. Además, 5b §9 fija los textos de los avisos sin organización, así que conviene que 5b CA-3 y CA-7 asuman la etiqueta de organización o que 5b cite 5c CA-9.
- **CA-8 (L59):** «MIENTRAS la fase esté activa para mi rol» no dice en qué organización se mira la fase: la activa o la de la propuesta. El caso es una persona en dos organizaciones con la fase activa solo en una. Precisarlo.
- **Persona en dos organizaciones con un solo chat de Telegram:** solo aparece en el §14 (L114), sin caso en el §8. Lo mismo pasa con:
  - el cambio de empresa desde un asistente con la app abierta;
  - las lecturas con coste;
  - la fase desactivada con propuestas creadas por un asistente;
  - el Consejo cuando su fase no está activa.
- **CA-3 frente a CA-5:** no queda claro cuál manda para el Consejo cuando su fase no está activa (1a CA-5 lo activa «después»). Además, hoy el Consejo recibe «No perteneces a la empresa activa. Usa switch_company.» (`context.ts:18`) o «No tienes una empresa activa en Nokko» (`webhook.ts:51`), que no cumplen R-8.
- **§9 (L74):** «Pídele al Owner que active tu acceso» es falso para el Consejo, que tiene el servidor siempre denegado. Hace falta un texto aparte para el Consejo.
- **CA-1 (L50):** «el mismo conjunto de herramientas que el agente» no es exacto. El servidor expone además `list_companies`, `switch_company`, `get_real_metrics` y la cobertura por segmento (`mcp/index.ts:21`, `tools/metrics.ts`). Decir si se conservan y con qué reglas.
- **§6 «Modificado» y §13:** no recogen que `create_task` y `draft_artifact` pasan en el servidor de pendientes a directas. Tampoco que hay que cambiar el texto «(Queda pendiente…)», las `instructions` del servidor (`mcp/index.ts:15`, `agent-tools.ts:121`) y el manifiesto `.lovable/mcp/manifest.json`.
- **Varias obligaciones por CA:**
  - CA-2 tiene tres (directas, propuestas y cambio de empresa).
  - CA-6 repite CA-3.
  - CA-7, CA-8 y CA-9 tienen dos cada uno.
  - Partirlos o justificarlo en el §14, como hace 5a.
- **§4 (L31-32):**
  - «Revisión de la auditoría» no mide todas las escrituras: 1a CA-68 solo audita la estrategia y las conexiones.
  - «Por el servidor» se mide con CA-8 y CA-9, que son de Telegram. El aislamiento del servidor no tiene CA propio.
- **§15 (L120):** pregunta algo que el §3 (L22) ya afirma: hoy las propuestas del servidor no tienen conversación y se confirman en Sugerencias.
- **§15 y §16:**
  - La identidad de hoy está verificada (`ctx.getUserId()` y los roles de `org_members`, `context.ts:8-19`); solo queda abierta tras la salida de Lovable C.
  - Las migraciones 0058 y 0059 tratan del origen de los campos y de las conexiones, no de este SDD. Quitarlas de §13, §16 y del pendiente.
- **Matriz §10 (L82-87):** falta la fila «Cambiar la empresa activa desde un asistente». La fila de otros roles en Telegram cita 5a CA-36, que solo habla del agente.
- **Salida de Lovable C:**
  - Su CA-17 congela «las mismas herramientas que hoy, con el mismo comportamiento y permisos». Conviene decir en el §14 que C se entrega antes y que 5c cambia ese comportamiento con la fase activa.
  - C sigue en Borrador.

**Preguntas para Fede**

1. ¿Un asistente externo debe poder cambiar la empresa activa de la app? Hoy, al hacerlo, la cambia también en la app y en Telegram. La alternativa es una empresa activa propia del servidor.
2. ¿Las lecturas con coste que pide un asistente quedan pendientes con botón, como en el agente (5a CA-29)?
3. El PRD §6.1 sigue diciendo «MCP | Lectura más proponer» (L100), y eso contradice su fila «Servidor para asistentes» (L128). ¿Se corrige el PRD?

**Hechos de código verificados / no verificados**

Verificados:
- El servidor expone el mismo registro de herramientas (`TOOLS.map`, `agent-tools.ts:117`).
  - Comprueba el rol (`canUseTool`, L129).
  - Las lecturas se ejecutan al momento, incluidas las que gastan crédito (L130-131).
  - Las escrituras se guardan en `agent_pending_actions` con `source: "mcp"` y sin conversación, y se confirman en Sugerencias (`/inbox`) (L136-138).
- El servidor usa `supabaseForUser`, es decir, el cliente de la persona con las reglas de acceso. Filtra por empresa activa y pertenencia (`context.ts:10-18`).
- Telegram usa el cliente privilegiado (`webhook.ts:19`) y `channelCtx` filtra por empresa activa y pertenencia (`channel-ctx.server.ts:6-15`).
  - Las confirmaciones pasan por `decidePending`, que filtra por persona y organización (`agent.functions.ts:58`): la de otra organización ya falla hoy, pero con «Acción no encontrada».
  - Las sugerencias pasan por `decideSuggestionCore`, que filtra por organización (L157).
- `switch_company` actualiza `profiles.current_org_id` (`companies.ts:36`).
- El vínculo de Telegram es único por persona y canal (`upsert … onConflict: "user_id,channel"`, `agent.functions.ts:199`) y no guarda organización.
- La conversación de Telegram sigue a la empresa activa: es la última de esa organización (`webhook.ts:95`).
- Hoy no hay guardia de fase. El Consejo queda fuera solo porque no está en `org_members`, sin un mensaje que cumpla R-8.

Inexacto:
- CA-1, «mismo conjunto que el agente»: el servidor expone cuatro herramientas más.
- El §13 cita las migraciones 0058 y 0059, que no tienen relación con este SDD.

No verificados:
- Si hay un bot de Telegram en producción.
- El uso real del servidor.
- Cómo queda la autenticación tras la salida de Lovable C.

**Límites de la revisión**

- Solo leí documentos y código local. No consulté la base de datos ni ejecuté pruebas.
- De 1a, 1b, 5a, 5b y del PRD solo comprobé los CA y las reglas que 5c cita o debería cubrir. De la salida de Lovable C solo revisé lo que toca al servidor.
- No hay datos de clientes. Las cifras (24 horas, 7 días) vienen del PRD y de 5a.

**Respuesta del autor (v2, 2026-10-31).** El informe está copiado sin editar arriba. Decisiones de Fede: el servidor tiene su propia empresa activa y cambiarla desde un asistente no mueve la de la app ni la de Telegram (CA-11); las lecturas con coste que pide un asistente van con botón (CA-10); se retira del PRD la fila «MCP: lectura más proponer».

Cambios: CA-10 y CA-11 nuevos; CA-12 nuevo aplica 5a CA-34 y CA-35 al servidor y a Telegram con la fase desactivada; CA-5 cubre solo la fase nunca activada y deja de mencionar el email diario; CA-3 niega el servidor al Consejo siempre; CA-1 lista las herramientas propias del servidor; CA-8 precisa la organización de la fase; CA-9 define qué pasa en Telegram al cambiar la empresa de la app; §6, §9, §10, §12, §13, §14, §15 y §16 corregidos y el PRD recoge las decisiones. No hay nueva pasada sobre esta v2.

**Segunda pasada del gate (2026-10-31, sobre la v2).** Informe copiado sin editar.

**Veredicto:** Bloqueado

La v2 arregla bien varias cosas de la primera pasada. CA-3 ya deniega siempre al Consejo y tiene su propio texto en el §9. CA-5 ya no menciona el email diario. CA-10 cita 5a CA-29. U-2 depende de 5b U-2. El §13 ya no cita las migraciones 0058 y 0059. El PRD retira la fila «MCP: lectura más proponer» y recoge la decisión en su §6.1 (L141). Bloquean la aprobación cuatro problemas, tres de ellos nacidos de CA-11.

**Bloqueantes**

1. **CA-11 (L57), §10 (L85) y §13 (L113): la empresa activa propia del servidor no funciona con el cliente de la persona.**
   - **Qué falla:**
     - Las reglas de acceso de lectura, actualización y borrado exigen `org_id = public.current_org()`, y `current_org()` lee `profiles.current_org_id` (`drizzle/migrations/0002_multitenant_organizations.sql:38-40`, `:120-123`). Hay 24 migraciones con esa regla de lectura.
     - El servidor usa `supabaseForUser`, es decir, el cliente de la persona con esas reglas (`context.ts:10`). El §10 lo da por bueno.
     - Con la app en la empresa A y el servidor en la B, toda lectura del servidor en B vuelve vacía.
     - Los valores por defecto (`org_id default current_org()`, 0002:101) y el trigger que rellena `org_id` con `current_org()` cuando falta (0002:155) llevarían a A lo que se guarde sin `org_id` explícito.
     - La salida de Lovable C, §10 (L56), fija que se conservan «`org_id` con `current_org()`, las políticas RLS… tal como están».
   - **Cómo resolverlo:** decidir el mecanismo en §10 y §13. Hay dos: un cliente privilegiado con filtro explícito, como Telegram, o un cambio de las reglas de acceso coordinado con C. Añadir un CA probable: con la app en A y el servidor en B, las lecturas y escrituras del servidor van a B y la app no ve nada nuevo en A.

2. **CA-11 frente a CA-2 y CA-10: una propuesta o acción con coste creada en B no se puede decidir desde la app si la app está en A, y ningún CA lo cubre.**
   - **Qué falla:**
     - Sugerencias lista las acciones del servidor sin filtrar por organización (`components/assistant-actions.tsx:15`). Las reglas de acceso de `agent_pending_actions` solo piden ser la persona y ser miembro (0007:73).
     - Al confirmar, `decidePending` filtra por la empresa de la app (`agent.functions.ts:58`), así que da «Acción no encontrada». Si se arreglara sin más, la acción se ejecutaría con el contexto de A.
     - 5a CA-32 dice «en su bandeja de Sugerencias» sin fijar la organización.
     - El §8 no tiene este caso.
   - **Cómo resolverlo:** un CA que diga en qué organización se muestra y se decide una propuesta o acción con coste creada por un asistente, y que se ejecuta siempre en la organización de la propuesta, nunca en la activa de la app. Añadir el caso al §8.

3. **Falta la guardia de fase en CA-2, CA-10 y CA-11, y la fase desactivada solo está definida para las propuestas.**
   - **Qué falla:**
     - **Choque con CA-5:** CA-2 (L51), CA-10 (L56) y CA-11 (L57) no dicen «MIENTRAS la fase esté activa». CA-5 (L54) obliga a «sin cambios» si la fase nunca se activó. Con la fase nunca activa, CA-11 exige un `switch_company` que no toca la app y CA-5 exige el actual, que sí la toca (`companies.ts:36`). Lo mismo pasa con `create_task`: directa por CA-2 o pendiente por CA-5. La prueba no puede pasar las dos. Choca también con PRD R-9.
     - **Fase desactivada:** CA-12 (L63) solo trata las propuestas congeladas. No dice si, tras desactivar, el servidor:
       - conserva su empresa propia;
       - sigue creando tareas directamente;
       - sigue con botón para las lecturas con coste.
     - CA-12 cita 5a CA-35, que trata de devolver el agente actual, ocultar hallazgos y permitir deshacer, pero el texto de CA-12 no lo incorpora.
     - **Qué organización cuenta:** no está dicho en qué organización se mira la fase en el servidor (¿la empresa del servidor?).
   - **Cómo resolverlo:**
     - Poner en CA-2, CA-10 y CA-11 «MIENTRAS la fase esté activa para mi rol en la empresa activa del servidor».
     - Un CA de desactivación para servidor y Telegram: vuelta al comportamiento actual, como en 5a CA-35, y qué pasa con la empresa del servidor.

4. **CA-11 (L57): el ciclo de vida de la empresa del servidor no se puede probar.**
   - **Qué falla:**
     - «Su valor inicial es la empresa activa de la persona en la app» no dice en qué momento se toma: ¿al activar la fase, en la primera llamada o en cada llamada hasta el primer cambio?
     - No cubre a la persona que sale de la organización guardada como empresa del servidor. El guardián de pertenencia de `profiles` solo actúa al actualizar (0002:68-76). Hoy `mcpCtx` responde «No perteneces a la empresa activa. Usa switch_company.» (`context.ts:18`).
     - Tampoco cubre que se borre la organización. Para `profiles` existe `on delete set null` (0002:27); para el servidor no hay nada definido.
     - El §10, «Conceptos nuevos» (L84), no recoge este dato nuevo.
   - **Cómo resolverlo:**
     - Fijar el momento del valor inicial.
     - Fijar qué pasa al perder la membresía: volver a la empresa de la app, o error con «qué pasó y qué hacer».
     - Añadir el concepto al §10 y los casos al §8.

**Cambios menores**

- **CA-12 (L63):** cita 5a CA-35 para «no se pueden aprobar… se pueden descartar», que es 5a CA-34. CA-35 dice otra cosa.
- **CA-5 (L54):**
  - No exceptúa CA-3. El Consejo con la fase nunca activa cumpliría a la vez «sin cambios» y «denegado con texto R-8». 5a CA-6 sí escribe «salvo lo que fijan…».
  - Incluye Telegram, pero su prueba (`assistant-phase-guard.test.ts`) está en U-1, y Telegram es U-2.
- **CA-3 (L52):** «a quien no tenga permiso» no define qué permiso. No existe un permiso de uso del servidor aparte del de cada herramienta.
- **CA-1 y CA-6 (L50, L55):** `get_real_metrics` y `get_segment_coverage` no tienen comprobación de rol, porque no están en `TOOLS` ni pasan por `canUseTool` (`metrics.ts:19-24`). Entonces «los mismos permisos por rol» y «solo lo que su rol permite» no tienen referencia para esas herramientas. En la matriz, «Según su rol» (L91) tampoco la tiene. Decir qué roles ven métricas, coste y margen.
- **CA-8 (L61):**
  - Mezcla dos obligaciones: guardar la organización en propuestas y avisos, y rechazar la aprobación cruzada.
  - La guardia «en la organización de la propuesta» no tiene sentido para los avisos.
  - Conviene decir que «la activa» es la de la app, que Telegram comparte.
  - Los botones de sugerencias existentes (`s:`, `webhook.ts:59-61`, `decideSuggestionCore`) quedan fuera, pero el §8 (L74) los da por cubiertos con CA-9, que solo trata los avisos nuevos de 5b. Una persona en dos organizaciones recibe sugerencias urgentes sin etiqueta de organización (5b CA-2) y al pulsarlas falla sin decir «qué pasó y qué hacer».
- **CA-9 (L62):**
  - No dice la fase de qué organización cuenta al pasar de A, con la fase activa, a B, con la fase nunca activa. En ese caso, R-9 pediría el comportamiento actual en B.
  - Detectar el cambio exige guardar la última organización usada por Telegram, y el §10 no lo recoge.
  - Hoy se reutiliza la última conversación de la organización (`webhook.ts:95`), no una nueva. El §13 debería decirlo.
- **Matriz del §10:**
  - La fila de Telegram para otros roles (L92) no distingue entre fase nunca activada (CA-5) y fase desactivada (CA-12).
  - Cita 5a CA-36 (agente de la app) y CA-6 (servidor), y ninguno de los dos es un CA de Telegram. Sigue abierto desde la primera pasada.
- **§13 (L112):**
  - Falta cambiar la descripción de `switch_company` en el código y en el manifiesto, que dice «(también en la app)», y el campo `active` de `list_companies` (`companies.ts:20`), que debe reflejar la empresa del servidor.
  - El §14 (L121) debería decir que 5c sustituye la prueba del CA-17 de C (`mcp-tools.test.ts`).
- **Cabecera (L5):** dice «SDD 5b (…: U-1)», pero el §12 depende de 5b U-1 y U-2.
- **Pendientes de la primera pasada que la respuesta del autor no trata:**
  - §4 (L31) sigue midiendo con «revisión de la auditoría», que 1a CA-68 no cubre para todas las escrituras.
  - CA-2, CA-4, CA-7, CA-8, CA-9 y CA-11 siguen con varias obligaciones, sin partir ni justificar en el §14.
- **CA-10:** el servidor marca como «con coste» más herramientas que la lista de 5a §13: `drive_*`, `linkedin_*`, `company_job_postings` y `sync_product_data` (`agent-tools.ts:10`). CA-10 hereda la lista de 5a. Confirmar que esas no llevan botón.

**Preguntas para Fede**

1. **Mecanismo de CA-11.** Para tener empresa propia, el servidor tiene que dejar de usar el cliente de la persona (con un filtro explícito, como Telegram) o hay que cambiar las reglas de acceso que la salida de Lovable C deja intactas. ¿Qué opción aceptas?
2. **Propuestas cruzadas.** ¿Una propuesta de un asistente hecha en la empresa B se ve en la app estando en A, con la organización indicada y ejecutándose en B? ¿O solo se ve al cambiar a B?
3. **Antes de activar la fase.** ¿El servidor tiene empresa propia ya desde ahora, como excepción a R-9, o solo con la fase activa?
4. **Salida de la organización.** Si la persona deja la organización guardada como empresa del servidor, ¿se vuelve a la empresa de la app o se da un error?

**Hechos de código verificados / no verificados**

Verificados:
- `mcpCtx` lee `profiles.current_org_id` y usa `supabaseForUser` (`context.ts:10-18`).
- `switch_company` escribe `profiles.current_org_id` (`companies.ts:36`).
- `list_companies` marca como activa la empresa del perfil (`companies.ts:20`).
- Las reglas de acceso usan `org_id = current_org()`, y `current_org()` lee el perfil (0002:38-40, :120-123). Los valores por defecto de `org_id` y el trigger también usan `current_org()` (0002:101, :155).
- `agent_pending_actions`: las reglas de lectura solo piden ser la persona y ser miembro (0007:73).
- Sugerencias lista las acciones `mcp` sin filtrar por organización (`assistant-actions.tsx:15`).
- `decidePending` filtra por la organización del contexto (`agent.functions.ts:58`).
- Las lecturas con coste se ejecutan al momento (`agent-tools.ts:130-131`).
- Las herramientas de métricas no comprueban el rol (`metrics.ts`).
- Telegram:
  - Al Consejo le responde «No tienes una empresa activa…» (`webhook.ts:51` y `:87`).
  - La conversación es la última de la organización activa (`webhook.ts:95`).
  - Los botones `s:` pasan por `decideSuggestionCore` (`webhook.ts:59-61`).
- El manifiesto tiene 52 textos «Queda pendiente» y `switch_company` con «(también en la app)».
- PRD: la fila «MCP: lectura más proponer» está retirada y la decisión está en L141.
- La salida de Lovable C, §10 (L56), conserva las reglas de acceso.
- Citas a 5a y 5b: todos los CA citados existen y dicen lo afirmado, salvo 5a CA-35 en CA-12.

No verificados:
- Si alguna escritura que CA-2 vuelve directa inserta sin `org_id` explícito. `create_task` (`core-write.ts:186`) sí lo pone; no revisé `draft_artifact` (`cycle.ts`).
- Si `list_meetings` y `get_meeting` son el «registro personal de reuniones» de CA-4.
- El uso real del servidor y de Telegram, y si hay un bot de Telegram en producción.

**Límites de la revisión**

- Solo lectura de documentos, código y migraciones locales. No consulté la base de datos ni ejecuté pruebas.
- Las reglas de acceso las deduje de las migraciones de `drizzle/migrations`. No comprobé las políticas vigentes en la base.
- De 1a, 1b, 5a, 5b, el PRD y la salida de Lovable C solo revisé los CA y las reglas que 5c cita o debería cubrir.
- No hay datos de clientes. Las cifras (24 horas, 7 días) vienen del PRD y de 5a.

**Respuesta del autor (v3, 2026-10-31).** El informe está copiado sin editar arriba. Decisiones de Fede: el servidor usa un acceso privilegiado con filtro explícito por empresa y persona, como Telegram (CA-11); una propuesta de un asistente se ve en la app con su organización y se ejecuta en la suya (CA-14); la empresa propia del servidor existe solo con la fase activa y, si la persona sale de esa organización, vuelve a la de la app.

Cambios: CA-11 define valor inicial, mecanismo y salida de la organización; CA-14 nuevo cubre las propuestas cruzadas; CA-2, CA-10 y CA-11 llevan guardia de fase; CA-12 cita bien 5a CA-34 y CA-35 y conserva sin uso la empresa del servidor; CA-5 exceptúa CA-3 y deja Telegram a CA-13 (nuevo); CA-3 define el permiso; CA-1 fija quién ve métricas (decisión del autor, a confirmar); CA-8 se limita a rechazar la aprobación cruzada, incluidas las sugerencias con botones; CA-9 precisa la fase de la organización nueva; §4, §10, §12, §13, §14, §15 y el §8 corregidos. No hay nueva pasada sobre esta v3.

**Tercera pasada del gate (2026-10-31, sobre la v3).** Informe copiado sin editar.

**Veredicto:** Bloqueado

La v3 arregla bastantes cosas de la segunda pasada:
- CA-2 y CA-10 llevan guardia de fase en la empresa del servidor.
- CA-12 cita bien 5a CA-34 y CA-35.
- CA-5 exceptúa CA-3.
- CA-3 define el permiso.
- El §10 recoge los conceptos nuevos.
- El §13 trata `switch_company`, `list_companies` y la reutilización de la conversación en `webhook.ts`.

Bloquean la aprobación tres problemas, los tres nacidos de los cambios de la v3 (CA-11 y CA-14).

**Bloqueantes**

1. **CA-14 (L58): no tiene guardia de fase, no es factible con lo declarado y no dice qué rol ni qué fase cuentan.**
   - **Choque con CA-5 y PRD R-9.** CA-14 no lleva «MIENTRAS la fase esté activa».
     - Hoy, confirmar desde la app una acción de otra organización falla con «Acción no encontrada», porque `decidePending` filtra por la organización del contexto (`agent.functions.ts:58`).
     - CA-14 cambia eso aunque la fase no se haya activado nunca, y CA-5 pide «sin cambios».
     - Además, 5a CA-31 deja con el comportamiento anterior las acciones creadas antes de activar la fase.
   - **No es factible con lo declarado.** La app decide con `userCtx`, que toma la empresa del perfil, y con el cliente de la persona (`agent.functions.ts:10-19`).
     - Las reglas de acceso exigen `org_id = current_org()` (0002:120-123), así que `executeTool` sobre B con la app en A no lee ni actualiza nada.
     - Para ejecutar en B, también la vía de la app (y `decidePending`, que comparte con Telegram) tiene que pasar a acceso privilegiado o a otro mecanismo. El §10 y el §13 solo lo prevén para el servidor.
   - **Quién decide y con qué rol.** No dice en qué organización se comprueban el rol de quien la pidió (5a CA-21 y CA-31) y la fase, ni qué pasa si la persona ya no es miembro de B o si la fase de su rol está desactivada en B.
   - **Cómo resolverlo:** añadir a CA-14 «MIENTRAS la fase esté activa para mi rol en la organización de la propuesta», con rol y pertenencia comprobados en esa organización al aprobar. Declarar en el §10 y el §13 el mecanismo de ejecución desde la app, y añadir al §8 los casos «ya no es miembro» y «fase desactivada en B».

2. **CA-1, CA-5, CA-6 y CA-11 (L50, L54, L55, L57): no se sabe en qué organización se mira la fase, y el ciclo de vida de la empresa del servidor sigue sin poder probarse.**
   - **Organización de la fase.** Solo CA-2 y CA-10 dicen «en la empresa activa del servidor». CA-11 («MIENTRAS la fase esté activa para mi rol», sin organización) y CA-5 («nunca activa para mi rol») no lo dicen, y la fase es por organización y por rol (1a CA-5).
     - Caso: Owner en A con la fase activa y en B con la fase nunca activa. Si cambia el servidor a B, CA-11 exige que la empresa del servidor sea B y no toque el perfil.
     - CA-5, en cambio, exige el `switch_company` actual, que escribe `profiles.current_org_id` (`companies.ts:36`), y `mcpCtx`, que vuelve a leer el perfil (`context.ts:11`). Ninguna prueba puede pasar las dos.
   - **Valor inicial «al activar la fase».** No está definido para:
     - la fase activada antes de que se entregue 5c (1a y 5a van antes);
     - un miembro que entra o cambia a un rol que ya tiene la fase activa;
     - la reactivación: CA-12 (L64) dice «conservar sin uso», pero según CA-11 al reactivar se volvería a tomar la de la app.
   - **La empresa de la app tampoco existe.** No está cubierto que la persona salga de la organización del servidor y la de la app esté vacía o tampoco sea suya.
   - **Cómo resolverlo:**
     - Fijar que la fase se mira en la empresa activa del servidor, para CA-1, CA-5, CA-6 y CA-11.
     - Definir el valor inicial como «la primera vez que el servidor la necesita con la fase activa, la de la app».
     - Decir qué pasa al reactivar (conservar o reiniciar).
     - Fijar el error R-8 cuando ninguna de las dos empresas es válida.

3. **CA-11 (L57) y §10 (L91): el acceso privilegiado «filtrando por empresa y persona» pierde las reglas de acceso que no son de organización, y la autoría.**
   - **Reglas que se pierden.** Al saltarse las reglas de acceso se pierden, entre otras:
     - la lectura de `knowledge_docs` limitada a `scope = 'team' or created_by = auth.uid()` (0002:127);
     - el borrado solo del Owner (0002:123, 135) y la actualización de cuotas solo de Owner y Sales leader (0002:134). `has_org_role` aparece 69 veces en las migraciones;
     - el registro personal de reuniones de 4b, que «solo lo ve su dueño por regla de base de datos» (4b §10 L124).
   - **Autoría.** El trigger `set_audit` rellena `created_by` y `updated_by` con `auth.uid()` (0002:154, 160), que con el cliente privilegiado es nulo. `create_task` no pasa `created_by` (`core-write.ts:186`). Se pierde el «quién» de 1a CA-68, y CA-2 promete «las mismas reglas de auditoría».
   - Telegram ya tiene este riesgo hoy (`channel-ctx.server.ts:2`), pero 5c lo extiende a todo el servidor.
   - **Cómo resolverlo:** un CA que se pueda probar, con este contenido: con el servidor en la empresa X, la persona ve y cambia por el servidor exactamente lo que vería y cambiaría en la app con X activa, y cada cambio queda con su autoría. Y en el §13, que hay que reproducir las reglas por rol y por autor y pasar la autoría de forma explícita.

**Cambios menores**

- **CA-13 (L65), «salvo CA-3»:** CA-3 solo trata el servidor. Para Telegram lo que manda es CA-7 (Consejo bloqueado).
  - Además, CA-7 (L61) no tiene guardia de fase y cita reglas de 5a que sí la tienen (CA-31). Con la fase nunca activa, CA-7 y CA-13 se solapan.
  - Solución: «salvo el bloqueo del Consejo de CA-7» y guardia en CA-7.
- **CA-8 (L62):**
  - Vuelve a no decir en qué organización se mira la fase (la respuesta a la primera pasada decía que se precisaba).
  - Solo regula «aprobar»; no dice qué pasa con descartar, posponer o descartar una sugerencia de otra organización.
  - Mezcla «propuesta» con «sugerencias con botones», que en 5a son cosas distintas.
- **CA-10 (L56):**
  - 5a CA-29 devuelve el resultado de una lectura «a su conversación», y una acción del servidor no tiene conversación (`agent-tools.ts:136`). No se dice adónde va el resultado de una lectura con coste pedida por un asistente.
  - Sigue sin respuesta lo de la segunda pasada: `drive_*`, `linkedin_*`, `company_job_postings` y `sync_product_data` están en `EXTERNAL` (`agent-tools.ts:10`) y no en la lista de 5a §13 (L182).
- **CA-12 (L64):**
  - El paréntesis atribuye a 5a CA-34 que «los botones de Telegram se rechazan con qué pasó y qué hacer». CA-34 no lo dice; es obligación propia de 5c y debe redactarse como tal.
  - La parte del servidor se prueba en `telegram-agent-rules.test.ts`.
- **CA-2 (L51), cita a «5a CA-21 a CA-24»:**
  - 5a CA-22 y CA-24 solo valen «DONDE el agente tenga herramientas» del 5d.
  - 5a CA-23 solo audita lo que audita 1a CA-68.
  - Para el servidor, hoy solo aplica CA-21. Decirlo en el §14 y declarar que, cuando llegue el 5d, sus herramientas entran solas en el servidor (CA-1).
- **CA-9 (L63):** su segunda obligación (indicar la organización en los avisos nuevos de 5b) ya la exigen 5b CA-3, CA-6 y CA-18 en su v3. Así hay dos pruebas de la misma obligación; dejarla en un solo SDD.
- **§4 (L32):** no mide con CA-14.
- **§6 (L42-43):**
  - Faltan el cambio de Sugerencias y de la decisión por CA-14 (mostrar la organización, ejecutar en la de la propuesta) y el paso a acceso privilegiado.
  - Mantiene «organización guardada en cada propuesta y aviso», que ningún CA de 5c exige ya (lo hacen 5a CA-31 y 5b).
- **§8:** faltan estos casos:
  - fase activada antes de entregar 5c o miembro nuevo (valor inicial);
  - propuesta cruzada con la persona fuera de B o con la fase desactivada en B;
  - resultado de una lectura con coste pedida por un asistente;
  - descarte cruzado por Telegram.
- **Matriz del §10:**
  - «según su rol» para `switch_company` (L97) no tiene referencia, porque `switch_company` no pasa por `canUseTool`.
  - Falta la fila «Aprobar en la app una propuesta de otra organización» (CA-14).
  - La fila de métricas (L98) no distingue fase nunca activada (CA-5) de fase activa.
- **§13:**
  - En L119 hay texto roto: «(CA-9).  hoy `create_task`…».
  - No dice que el servidor necesita dos vías (cliente de la persona con la fase nunca activa o desactivada, acceso privilegiado con la fase activa).
  - Tampoco recoge los cambios que exige CA-14: `decidePending`, `userCtx` y `AssistantActions` (`assistant-actions.tsx:15`, que no trae la organización).
- **§14 (L128):** la prueba de 5c no «sustituye» la del CA-17 de C, porque con la fase nunca activa CA-5 mantiene ese comportamiento. Debe ser «la complementa». Si la sustituye, la cabecera debería decir que modifica la salida de Lovable C.
- **Matriz §10 (L99):** cita 5a CA-36 para Telegram. CA-36 habla del «agente» sin nombrar Telegram, a diferencia de 5a CA-35 y CA-37. Lo señaló también el gate de 5a (L384).

**Preguntas para Fede**

1. **Métricas (CA-1).** La app muestra Métricas sin filtro de rol en el menú (`nav.ts:17`). ¿Restringir las métricas y la cobertura del servidor a Owner y Sales leader, aunque eso ya no sea «las mismas reglas que la app»? Hoy es una decisión del autor (§15 L138).
2. **Aprobación entre organizaciones.** ¿Aceptas que en la app se apruebe una propuesta de otra organización sin cambiar de empresa (CA-14) y en Telegram no (CA-8)?
3. **Valor inicial de la empresa del servidor.** Para quien ya tenga la fase activa cuando se entregue 5c, y al reactivar la fase: ¿se conserva la anterior o se toma de nuevo la de la app?
4. **Resultado de una lectura con coste.** Cuando un asistente pide una y la persona la pulsa en la app, ¿dónde ve el resultado? ¿En Sugerencias, o el asistente lo recupera con una herramienta?
5. ¿`drive_*`, `linkedin_*`, `company_job_postings` y `sync_product_data` van sin botón?

**Hechos de código verificados / no verificados**

Verificados:
- `mcpCtx` y `list_companies`/`switch_company` usan `supabaseForUser` y la empresa del perfil (`context.ts:10-18`, `companies.ts:20,36`).
- `decidePending` filtra por persona y por la organización del contexto, y ejecuta con ese contexto (`agent.functions.ts:57-66`). La usan la app (`decideAgentAction`) y Telegram (`webhook.ts:56`).
- `AssistantActions` lista las acciones `mcp` pendientes sin filtrar ni mostrar organización (`assistant-actions.tsx:15`).
- Reglas de acceso:
  - `current_org()` y las políticas de lectura, actualización y borrado: 0002:38-40 y :120-135.
  - `set_audit` usa `auth.uid()`: 0002:154-160.
  - `agent_pending_actions` con regla «own read» por persona y pertenencia: 0007:73.
- Servidor:
  - Las lecturas con coste se ejecutan al momento (`agent-tools.ts:130-131`), y `EXTERNAL` incluye herramientas fuera de la lista de 5a.
  - Las métricas no comprueban el rol (`metrics.ts`).
  - Las instrucciones de `index.ts:13-16` y el manifiesto mantienen 52 «Queda pendiente» y «(también en la app)».
- Citas:
  - A 5a: CA-10, CA-20, CA-21, CA-26 a CA-29, CA-31, CA-32, CA-34 y CA-35 existen y dicen lo afirmado (con las salvedades de CA-12 y CA-22 a CA-24 indicadas arriba).
  - A 5b: CA-7 existe y dice lo afirmado.
  - A 1a y 1b: CA-3, CA-5, CA-68 y CA-66 existen.
  - La salida de Lovable C mantiene su CA-17 y su §10 L56 tal como se citan.
  - El SDD 5 archivado tiene 62 CA únicos.

No verificados:
- Si alguna herramienta concreta lee `knowledge_docs` u otras tablas con reglas por autor o por rol sin filtrarlas en el código; esto afecta al alcance real del bloqueante 3.
- Cómo queda la identidad del servidor tras la salida de Lovable C.
- El uso real del servidor y de Telegram, y si hay un bot en producción.

**Límites de la revisión**

- Solo lectura de documentos, código y migraciones locales. No consulté la base de datos ni ejecuté pruebas. Las reglas de acceso las deduje de `drizzle/migrations`.
- De 5a, 5b, 1a, 1b, el PRD y la salida de Lovable C solo revisé los CA y las reglas que 5c cita o debería cubrir.
- No hay datos de clientes. Las cifras (24 horas, 7 días, 62 criterios) tienen fuente en el PRD, en 5a o en el SDD archivado.

**Respuesta del autor (v4, 2026-10-31).** El informe está copiado sin editar arriba. Fede aprobó el SDD con los riesgos declarados y sin cuarta pasada y aceptó mis recomendaciones: aprobar en la app una propuesta de otra organización con la organización indicada, mantener las métricas solo para Owner y Sales leader, conservar la empresa propia del servidor si sigue siendo válida y tomar la del perfil si no, mostrar el resultado de una lectura con coste en la tarjeta de Sugerencias y dejar sin botón el resto de herramientas externas.

Cambios: CA-14 lleva guardia de fase, rol y pertenencia en la organización de la propuesta y rechazos con qué pasó y qué hacer; CA-11 define cómo se determina la empresa del servidor y el error; CA-1, CA-2, CA-5, CA-6 y CA-10 fijan la empresa del servidor como organización de la fase; nuevo CA-15 (misma visibilidad y cambios que en la app, con autoría); CA-7 y CA-13 separan el bloqueo del Consejo y la ocultación de 5a CA-35 y CA-37; CA-8 incluye descartar y las sugerencias con botones; CA-9 deja los avisos a 5b; CA-12 es obligación propia de 5c; CA-2 ya no cita CA-22 y CA-24 de 5a como vigentes hoy; §4, §6, §8, §10, §13 y §14 corregidos. Quedan declarados el acceso privilegiado y la aprobación cruzada como los puntos de mayor riesgo.

## 18. Delta de implementación (lo rellena el agente al entregar)
(sin rellenar)
