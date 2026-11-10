# PRD-20261110-diagnostico-y-equipos-de-plays · [Iniciativa] Diagnóstico de entrada y equipos de plays

**Tipo:** Iniciativa · **Prioridad propuesta:** Media (reutiliza onboarding, plays, Reglas y Conocimiento que ya existen; el coste es de ingeniería y no de proveedores; depende de dos tickets de onboarding sin empezar)
**Estado:** Borrador · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-10
**SDD que lo desarrollan:** pendiente (sección 8)
**Sprint propuesto:** 5 (el 4 está en curso con NK-0123); ver sección 8

> Un PRD dice qué se quiere y por qué. No dice cómo se construye ni cómo se prueba: eso es del SDD.

## 1. Problema
Hoy una empresa que entra en NOKKO configura su estrategia y ve un catálogo de 28 plays, pero nadie le dice **cuáles activar primero, en qué orden ni con qué reglas y voz**. El catálogo enseña el estado de cada play y no la tarea que resuelve. Fede quiere que NOKKO, tras unas preguntas, proponga un conjunto ordenado de plays por tarea, con las reglas de la empresa ya puestas y la voz capturada.

## 2. Para quién
Fase 1: Founder y Sales Leader de la organización de Fede (uso interno). Fase posterior, con un PRD aparte: Owner y Sales Leader de empresas cliente. Los demás miembros ven los equipos de plays y reciben sus sugerencias; no los activan.

## 3. Evidencia y por qué ahora
Fuentes:
- Recorrido real de SkillTree (skilltree.altari.ai, 2026-11-10): cuestionario de 6 preguntas, catálogo de 137 trabajos declarados (165 filas en el mapa) con fase y autonomía, y su kit gratuito de 13 archivos. Detalle en `ANALISIS-20261110-skilltree-para-nokko.md` (proyecto Nokko GTM Brain). Es una referencia externa: lo que sirve es la estructura (tarea → trabajos, fase, orden de despliegue), no su texto ni su valoración en dinero.
- Código y documentos de NOKKO en `main` @ d3eeba1 (leídos el 2026-11-10, solo lectura): `docs/prd/PRD-20261106-plays-gtm.md`, `src/lib/plays/catalog.ts`, `docs/PANTALLAS.md`, `src/lib/AGENTS.md`, `docs/sdd/SDD-20261106-agent-rules-reader.md`, `.factory/ledger.json`.
- Sin datos de uso: todas las líneas base son «sin dato»; la prioridad es una apuesta declarada.

**Lo que NOKKO ya tiene y esta iniciativa reutiliza**
| Necesidad | Ya existe | Falta |
|---|---|---|
| Cuestionario de entrada | Onboarding de 6 pasos en `/onboarding` (incluye «Diagnóstico»); guía «Configura tu estrategia» | Preguntas sobre qué tareas quiere resolver y cuál es su cuello de botella; salida en equipos de plays |
| Cerebro de empresa | Estrategia (ICP, Posicionamiento, Mensajes), Conocimiento, Memoria, `companyContext()` | Voz (tres mensajes reales) |
| Reglas Nunca / Siempre | Reglas de Conocimiento; el agente las lee en cada turno (NK-0087, NK-0096); solo Owner y Sales Leader las escriben (NK-0095) | Regla «Escalar a un humano cuando…» y reglas por defecto |
| Catálogo de plays | 28 plays con movimiento, canales, estado, necesidades y salidas; estado por empresa en `play_states` | Fase, nivel de «quién prepara y quién aprueba», dependencias formales, agrupación por tarea |

**Estado de los 28 plays** (PRD de plays, 2026-11-06): 11 parciales, 1 nuevo interno y 16 externos bloqueados. Solo los 12 primeros se construyen con datos que NOKKO ya guarda; el diagnóstico solo puede recomendar de verdad esos.

**Por qué ahora:** el catálogo (NK-0063) ya está entregado y sus SDD 2 a 9 se redactan uno a uno. Añadir fase, autonomía y dependencias es más barato antes de construir la lógica de cada play que después.

## 4. Objetivos
| ID | Objetivo | Cómo se mide | Línea base | Fuente |
|---|---|---|---|---|
| G-1 | Que el diagnóstico entregue equipos de plays ordenados por fase y dependencias, con el motivo de cada uno | Diagnósticos terminados con al menos un equipo propuesto | Sin dato (no existe) | Base de datos, tras el lanzamiento |
| G-2 | Que ningún equipo de plays envíe un mensaje ni cambie un dato sin tu confirmación | Salidas de tipo «envío automático» | Sin dato; se verifica por prueba: debe ser 0 | Prueba automática del catálogo |
| G-3 | Que un play bloqueado nunca se recomiende | Recomendaciones de plays con estado «bloqueado» | Sin dato; se verifica por prueba: debe ser 0 | Prueba automática del diagnóstico |
| G-4 | Que cada empresa tenga reglas base (nunca, siempre, escalar) tras el diagnóstico | Empresas con reglas base aprobadas | Sin dato | Base de datos (`knowledge_docs`, sección Reglas) |
| G-5 | Que la voz de la empresa quede capturada y la usen los plays que redactan | Empresas con tres mensajes de voz; borradores que la leen | Sin dato | Base de datos y registro de ejecuciones (`play_runs`) |

Nunca hay línea base estimada.

## 5. No-objetivos
- Mostrar horas ahorradas ni valor en dinero (decisión 3; no se inventan métricas).
- Enviar, publicar o cambiar datos sin confirmación: solo sugerencias, tareas y borradores.
- Los departamentos Marketing, Operations y Back Office de SkillTree; los trabajos de Customer sin play real en NOKKO (decisiones 6 y 11).
- Plays externos bloqueados: se muestran con su motivo, no se construyen aquí.
- Abrir el diagnóstico a empresas cliente: exige un PRD aparte (decisión 13).
- Cambiar los cinco playbooks de venta ni las Reglas existentes más allá de añadir «Escalar».
- Valoración de personas desde LinkedIn (decisión D2 del PRD de plays, sigue abierta).
- Aplicar a Postin: NOKKO y Postin son productos separados.

## 6. Decisiones tomadas y abiertas
Decididas por Fede el 2026-11-10 (entrevista; detalle en el análisis, sección 5):
| # | Tema | Decisión |
|---|---|---|
| 1 | Formato del diagnóstico | Chat y asistente guiado (el guiado, en una fase posterior por ser pantalla nueva) |
| 2 | Cerebro de empresa | Base de datos de NOKKO, reutilizando Estrategia, Conocimiento y Memoria |
| 3 | Horas y dinero | No se muestran |
| 4 | Fase y autonomía | En los 28 plays existentes también |
| 5 | Salida del diagnóstico | Plays priorizados con plan de activación; no activa nada solo |
| 6 | Departamentos | Sales, Deals, Intelligence y Customer |
| 7 | Autonomía | Significa quién prepara y quién aprueba; todo sigue siendo borrador |
| 8 | Reglas Nunca / Siempre / Escalar | Se capturan en el diagnóstico con valores por defecto seguros |
| 9 | «Agente» | Un conjunto de plays por tarea; en la interfaz se llama «equipo de plays» (decisión 14) |
| 10 | Orden de la lista | Por fase y dependencias |
| 11 | Customer sin equivalente | Fuera hasta que exista un play real |
| 12 | Verificación contra lo existente | Hecha en solo lectura (sección 3) |
| 13 | Uso | Primero interno, después producto |
| 14 | Nombre en la interfaz | «Equipo de plays» |
| 15 | Plays bloqueados | Se muestran como bloqueados con su motivo |
| 16 | Quién activa | Owner y Sales Leader |
| 17 | Agrupación | Catálogo fijo de tareas en código, cada una con sus plays |
| 18 | Un play en varios equipos | Sí; se activa una vez y se comparte |
| 19 | Dependencias | Del PRD de plays y del campo `needs` |
| 20 | Voz | Tres mensajes reales pegados en el diagnóstico |
| 21 | Equipos de la fase 1 | Seis (ver composición propuesta abajo) |
| 22 | Dónde vive la voz | Sección propia en Conocimiento, solo equipo |
| 23 | Escalar a un humano | Tipo de Regla en Conocimiento |
| 24 | Reglas por defecto | Las redacta Claude y las aprueba Fede |

**Composición propuesta de los seis equipos (para tu revisión; es una propuesta, no una decisión)**
| Equipo de plays | Plays | Nota |
|---|---|---|
| Reuniones | `meeting-prep-and-follow-up`, `meeting-form-orchestration` | Ambos parciales |
| Reactivar perdidos | `closed-lost-revival`, `signals-in-crm-with-decay` | El segundo aporta la puerta «algo cambió de verdad» |
| Señales de cuenta | `signals-in-crm-with-decay`, `signal-activation` | `signals-in-crm-with-decay` está en dos equipos; se activa una sola vez |
| Aprender de llamadas | `call-transcript-signal-extraction`, `pain-qualified-segments` | El segundo depende del primero |
| Priorizar cuentas y limpiar CRM | `hubspot-account-tiering-scoring`, `crm-hygiene` | — |
| Entrantes y producto | `plg-to-sales`, `product-sign-up-outreach`, `multi-thread-inbound-leads` | El tercero necesita un contacto adicional vía Apollo, Clay o LinkedIn; hasta entonces se muestra como bloqueado |

**Abiertas**
1. Confirmar o ajustar la composición de los seis equipos.
2. Permisos de lectura y escritura de la sección de voz: hoy cualquier miembro lee Conocimiento y los mensajes reales de clientes quedarían visibles para todo el equipo. Se decide en el SDD de voz.
3. Cuántos bloques del onboarding están completos en `main` (el plan prevé 9; no verificado).
4. Si «Equipo de plays» se confunde con el equipo de miembros en la interfaz (revisar con las pruebas de textos).
5. Plazo y forma de abrir el diagnóstico a empresas cliente.

## 7. Riesgos y dependencias
- **Dependen de tickets sin empezar:** NK-0009 (onboarding completo y proactivo) y NK-0028 (contexto estratégico y onboarding por bloques con nivel de confianza). El diagnóstico se apoya en ese onboarding; si no se cierran antes, esta iniciativa duplica trabajo.
- **Choca con el calendario de los plays:** los SDD 2 a 9 del PRD de plays y los hallazgos NK-0081, NK-0082 y NK-0083 tocan el mismo catálogo. Añadir fase y autonomía a los 28 plays genera conflictos si se hace por separado; conviene hacerlo dentro del SDD 2 de plays o inmediatamente después.
- **Choca con NK-0053 y NK-0055** (agente único con modos y memoria): por eso el conjunto de plays no se llama «agente» en la interfaz.
- **Amendment del PRD de plays:** la fase 1 interna es compatible con «uso interno»; abrirlo a clientes lo contradice y requiere enmienda en el PRD aparte.
- **Datos de clientes en la voz:** mensajes reales de personas; privacidad y permisos (abierta 2).
- **Recomendar sin base:** con 16 plays bloqueados, el diagnóstico solo puede recomendar lo ya posible; debe decirlo con palabras para no prometer lo que no existe.
- **Solo lectura hasta aquí:** no he leído el código de cada play ni el estado de las ramas `claude/*`.

## 8. Orden de entrega
Sprint propuesto: **5**, porque el 4 está en curso (NK-0123). Requisito previo: NK-0009 y NK-0028.

| # | SDD | Tipo | Depende de | Cubre |
|---|---|---|---|---|
| 0 | NK-0009 y NK-0028 (ya en el registro) | Feature | — | Base del diagnóstico |
| 1 | `SDD-…-plays-phase-autonomy-deps` (fase, nivel de aprobación y dependencias formales en el catálogo de 28 plays) | Mejora | 0; coordinar con SDD 2 de plays | G-2, G-3 |
| 2 | `SDD-…-play-teams` (catálogo de tareas, seis equipos y vista en `/plays`) | Feature | 1 | G-1, G-2, G-3 |
| 3 | `SDD-…-company-voice-and-escalation-rules` (voz en Conocimiento, regla «Escalar», reglas por defecto aprobadas) | Feature | NK-0095, NK-0096 | G-4, G-5 |
| 4 | `SDD-…-diagnosis-in-chat` (diagnóstico en el asistente que genera equipos priorizados) | Feature | 1, 2, 3 | G-1, G-4, G-5 |
| 5 | `SDD-…-diagnosis-guided-wizard` (asistente guiado, extiende el onboarding) | Feature | 4; pantalla nueva | G-1 |

Los SDD se redactan uno a uno con `nokko-shape` cuando apruebes este PRD. El 5 queda en una fase posterior por añadir pantalla nueva.

## 9. Aprobación
- [ ] Fede aprueba el PRD (primer GO de dirección). Fecha: {…}
- Al aprobar, el Estado pasa a «Aprobado». Después se redactan los SDD con `nokko-shape`.
