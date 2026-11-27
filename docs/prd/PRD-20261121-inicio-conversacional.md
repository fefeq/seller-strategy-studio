# PRD-20261121-inicio-conversacional · [Iniciativa] Inicio conversacional: pedirlo en lugar de buscarlo

**Tipo:** Iniciativa · **Prioridad propuesta:** Media-alta (casi todo el motor ya existe y lo que se pide es darle el sitio principal; sin datos de uso que digan cuánto se gana, es una apuesta declarada)
**Estado:** Aprobado por Fede el 2026-11-21 (con las cuatro recomendaciones de Q-1 a Q-4) · **Pide:** Fede (2026-11-21) · **Aprueba:** Fede · **Fecha:** 2026-11-21
**Ticket:** NK-0191 para el SDD 1 (LOGGED el 2026-11-22); los demás SDD, sin registrar
**SDD que lo desarrollan:** pendientes (sección 8)
**Base de lectura:** `origin/main` @ `cc4a0cd2` (2026-11-21), solo lectura. Uso medido en producción el 2026-11-21 con consultas de solo conteo.

> Un PRD dice qué se quiere y por qué. No dice cómo se construye ni cómo se prueba: eso es del SDD.
> Petición literal de Fede: «me gustaría que el inicio sea una interfaz conversacional donde el usuario puede hacer TODO de forma natural.»

## Resumen para aprobar (Fede)
- **Lo que he encontrado:** NOKKO ya tiene un agente que conversa, consulta y propone cambios con confirmación. Tiene 136 capacidades y cubre Leads, Cuentas, Personas, Pipeline, reuniones, tareas, sugerencias, aprobaciones, estrategia, plays y onboarding. Está detrás de un botón («Agente ⌘J») y se abre como panel lateral. **No hay que construir un asistente: hay que darle el Inicio y cerrar lo que le falta.**
- **Lo que se usa hoy:** 7 mensajes tuyos en 4 conversaciones, todos entre el 13 y el 15 de noviembre; ninguno desde entonces. 4 acciones propuestas, las 4 confirmadas.
- **Lo que recomiendo:** que Inicio pase a ser la conversación, con el resumen de hoy (titular, siguiente paso, tu bandeja) debajo de la caja. Primera versión con lo que el agente ya sabe hacer, más «llévame a…» y buscar registros. Lo que aún no sabe hacer lo dice y te abre la pantalla. Los huecos se cierran después, por orden de lo que de verdad pidas.
- **Lo que choca:** el PRD de coherencia que aprobaste el 2026-11-18 descarta «Agente primero» y tiene como no-objetivo «sustituir las pantallas por un chat». Esta petición lo adelanta. Necesito que decidas cuál manda (Q-3).
- **Lo que no sé:** cuánto cuesta cada turno de conversación (hoy no se registra) y cómo responde con muchos datos (producción tiene 0 deals).
- **Decisiones que te pido:** cuatro, en la sección 10, todas con recomendación.

## 1. Problema
Para hacer algo en NOKKO hay que saber antes en cuál de las 26 pantallas del menú vive. Quien entra ve un resumen (Inicio) y, para actuar, tiene que navegar. La forma de «pedirlo con palabras» existe, pero está escondida detrás de un botón de la barra superior y apenas se usa.

## 2. Para quién
Hoy, una sola persona: Fede, con rol Owner (NOKKO es herramienta interna; único usuario a 2026-11-09). El diseño no debe impedir otros roles, pero ningún otro rol lo ha usado: sus vistas son **[Por verificar]**. Sin nombres ni datos de clientes.

## 3. Evidencia y por qué ahora
| Hecho | Nivel | Fuente |
|---|---|---|
| Inicio es un resumen de lectura: titular, «Tu siguiente mejor paso», 3 cifras, «Tu bandeja», reuniones de hoy y respuestas. No tiene caja para escribir. | Dato | `src/routes/_authenticated/home.tsx` |
| El menú tiene 25 entradas en 5 grupos, más «Conectar asistentes» (26). | Dato | `src/lib/nav.ts` |
| El agente no tiene pantalla propia: es un panel lateral que se abre con ⌘J, con «Agente» en la barra superior, con «Agente» en la barra inferior del móvil o desde ⌘K. | Dato | `src/components/agent.tsx`, `route.tsx` |
| El agente tiene 136 capacidades (131 con nombre fijo y 5 generadas). La documentación dice 112: está desfasada. | Dato (conteo por nombre el 2026-11-21) | `src/lib/agent/tools/`; `docs/AGENTE-Y-MCP.md` |
| Las consultas se ejecutan al momento; todo cambio queda como propuesta con «Confirmar» / «Descartar». Lo que gasta créditos enseña el coste estimado antes de confirmar. | Dato | `src/lib/agent/agent.server.ts`, `src/lib/conversation.ts`, `spend-confirm.ts` |
| Uso total del agente en producción: 4 conversaciones, 7 mensajes de la persona, entre el 2026-11-13 y el 2026-11-15. Ninguno después. | Dato (medido el 2026-11-21) | tablas de conversaciones y mensajes del agente |
| Acciones propuestas por el agente: 4, las 4 confirmadas; 0 descartadas, 0 fallidas. | Dato (medido el 2026-11-21) | tabla de acciones pendientes |
| Tiempo entre tu mensaje y la respuesta guardada: mediana 3 s, máximo 4 s, sobre 7 turnos. Muestra muy pequeña y con la base casi vacía. | Dato, poco representativo | tabla de mensajes del agente |
| El registro de qué consulta el agente en cada turno existe pero está vacío: no se sabe qué herramientas usó ni cuánto tardó cada una. | Dato | tabla de traza de herramientas (0 filas) |
| Coste por turno de conversación. | **Sin dato**: no se registra | `agent.server.ts` |
| La respuesta llega entera al final; mientras tanto solo se ve «Pensando…». | Dato | `src/components/agent.tsx` |
| El agente no sabe en qué pantalla estás ni recupera más que la última conversación. | Dato | `src/components/agent.tsx` |
| ⌘K busca cuentas, leads, personas y deals, lleva a cualquier pantalla y ofrece «Preguntar al agente». | Dato | `src/components/command-palette.tsx` |
| Que una interfaz conversacional sea mejor que el menú para el trabajo diario. | **Apuesta declarada** | — |

**Por qué ahora:** lo pide Fede. El motor (capacidades, confirmación, memoria, reglas del equipo, voz) ya está; lo que falta es sobre todo de presentación y de cobertura.

### Inventario: qué significa «TODO» hoy
«Cubierto» = existe una capacidad del agente con ese fin (comprobado por nombre, no ejecutando cada una: **[Por verificar]** en el SDD). «Hueco» = hoy solo se puede hacer en pantalla.

| Área | Cubierto por la conversación | Hueco |
|---|---|---|
| Resumen y métricas | Resumen general, tablero de pipeline, diagnóstico de embudo, informe semanal, métricas de cobro, uso de producto, presupuesto de integraciones, recomendaciones del Asesor | Secciones de Métricas sin capacidad propia: cohortes, perdidos, tendencias, economía y finanzas **[Por verificar]** |
| Leads | Listar, ver, crear, actualizar, registrar un contacto, borrador de seguimiento, ver importaciones pendientes | Fuentes de entrada, importar un archivo, aprobar una importación, ajustes de cualificación y plazos, borrar |
| Cuentas | Listar, ver, crear, actualizar, plan de cuenta, completar datos, investigar, señales, informe a fondo, lista por ICP, enriquecer en tabla | Reparto y sus reglas, importar un archivo, borrar, ABM y partners |
| Personas | Listar, crear, actualizar, stakeholders, buscar personas clave, investigar, revelar contacto | Borrar |
| Pipeline | Listar, ver, crear, actualizar y reasignar deals; líneas de producto; plan de acción mutuo; borrador de propuesta; pedir aprobación | Configurar etapas y umbral de enfriado, borrar |
| Reuniones y llamadas | Listar, ver, crear, actualizar, preparar, notas de llamada, registrar y revisar una llamada | — |
| Tareas, sugerencias, aprobaciones | Listar, crear, actualizar y completar tareas; decidir y asignar sugerencias; decidir aprobaciones; ver lo pendiente de confirmar | — |
| Estrategia | Segmentos, ICP, pilares, posicionamiento, cuota, moneda, experimentos, confirmar campos, borrar segmento/ICP/pilar (solo Owner, avisando de lo que se pierde), deshacer, cambios recientes, estado de la configuración | Presupuestos y costes de adquisición, productos (solo se listan), editar líneas de negocio (solo lectura por decisión del 2026-11-13) |
| Plays | Catálogo, equipos, activar y pausar, diagnóstico, plan de activación, reglas por defecto, plays a medida (proponer, activar, pausar) | — |
| Onboarding | Estado, lanzar la lectura, repasar y aprobar bloques | Subir documentos como fuente |
| Conocimiento y Drive | Buscar, leer las reglas, buscar y leer en Drive, guardar un documento, importar a Conocimiento, ficha de competidor desde reseñas | Crear o editar un documento a mano |
| Ciclo GTM | Estado, leer y redactar un documento | Aprobar documentos, Debates, Theory U |
| Memoria | Ver y guardar | Editar y olvidar |
| Conexiones | Ver el estado y recibir el enlace a la tarjeta | Conectar (se queda en pantalla: nunca se piden claves en la conversación) |
| Descubiertos | — | Aceptar, descartar, «Buscar ahora» |
| Equipo y empresa | — | Invitar, roles, avisos, Telegram, datos de la empresa, cambiar o crear empresa |
| Respuestas | — | Fuera por decisión (NK-0174, 2026-11-13): sin contenido de respuestas en el asistente |
| Ir a una pantalla y buscar un registro | Buscar registros; las respuestas ya enlazan pantallas con un botón «Abrir» | «Llévame a…» como petición directa a cualquier pantalla del menú **[Por verificar]** |

## 4. Objetivos
| ID | Objetivo | Cómo se mide | Línea base | Fuente |
|---|---|---|---|---|
| G-1 | Que pedir sea la forma habitual de usar NOKKO | Mensajes de la persona por semana | 7 mensajes en total (13–15 nov); 0 desde el 16 nov | Tabla de mensajes del agente (medido el 2026-11-21) |
| G-2 | Que lo pedido se resuelva sin salir a buscarlo | Peticiones que acaban en respuesta o acción confirmada, frente a las que acaban en «esto no lo hago aquí» o en error | Sin dato: hoy no se registra cómo acaba cada petición | Se medirá tras el lanzamiento (requiere R-13) |
| G-3 | Que las propuestas sean buenas | Propuestas confirmadas, descartadas y fallidas | 4 confirmadas, 0 descartadas, 0 fallidas | Tabla de acciones pendientes (medido el 2026-11-21) |
| G-4 | Que nada cambie sin tu confirmación | Cambios de datos hechos desde la conversación sin confirmación explícita | Se verifica por prueba: debe ser 0 | Pruebas automáticas |
| G-5 | Saber lo que cuesta y lo que tarda | Coste y tiempo registrados por turno | Coste: sin dato. Tiempo: mediana 3 s, máximo 4 s (7 turnos) | Tabla de mensajes; registro nuevo de coste |
| G-6 | Que abrir Inicio no gaste | Llamadas de IA al abrir Inicio sin escribir nada | Hoy 0 (Inicio no usa IA) | Prueba automática |

Nunca hay línea base estimada. G-4 y G-6 son invariantes: se prueban, no se miden con uso.

## 5. Alcance
**Incluye (primera versión, recomendada):**
- Inicio pasa a ser la conversación: una caja para escribir o dictar como elemento principal, y debajo el resumen de hoy que ya existe.
- Todo lo que está en la columna «Cubierto» del inventario.
- «Llévame a…» para cualquier pantalla del menú y buscar un registro por nombre desde la misma caja.
- Una respuesta honesta para cada hueco: qué no se hace aquí todavía y el botón para abrir la pantalla donde sí.
- Registro de cómo acaba cada petición, de lo que tarda y de lo que cuesta.

**No incluye:**
- Quitar pantallas o entradas del menú. Todo lo que hoy se hace en pantalla se sigue pudiendo hacer en pantalla.
- Cerrar los huecos del inventario (segunda fase, ordenada por lo que se haya pedido de verdad).
- Enviar correos o mensajes en tu nombre: NOKKO prepara, no envía.
- Contenido de la bandeja de respuestas en la conversación (decisión NK-0174).
- Gestionar miembros, roles e invitaciones, o introducir claves, desde la conversación.
- Unificar ⌘K con la caja de conversación en todas las pantallas (decisión abierta del PRD del 2026-11-18; se propone no mezclarla aquí).
- Cambiar los canales externos (Telegram, asistentes conectados).
- Vistas distintas por rol.

## 6. Requisitos de producto
- R-1: Al entrar en NOKKO veo una caja donde escribir o dictar lo que quiero, antes que cualquier otra cosa.
- R-2: Debajo de la caja sigo viendo el resumen de hoy: el titular, mi siguiente mejor paso y lo que espera mi decisión.
- R-3: Abrir Inicio no consume IA; solo se consume cuando envío algo.
- R-4: Si no sé qué pedir, veo ejemplos que funcionan con mis datos y puedo usarlos con un toque.
- R-5: Puedo pedir cualquier consulta o cambio de la columna «Cubierto» con mis palabras, sin saber en qué pantalla vive.
- R-6: Puedo pedir que me lleve a una pantalla o a un registro concreto, y me lleva.
- R-7: Ninguna petición cambia datos al momento: veo una propuesta con lo que va a cambiar y decido «Confirmar» o «Descartar».
- R-8: Si pido varias cosas a la vez, cada cambio se confirma por separado.
- R-9: Antes de confirmar algo que gasta créditos veo el coste estimado; antes de confirmar un borrado veo qué se pierde y si se puede deshacer.
- R-10: Lo que proponga y yo no decida no se pierde: aparece en mi bandeja hasta que lo confirme o lo descarte.
- R-11: Si lo que pido es ambiguo, me hace una sola pregunta con opciones en vez de suponer.
- R-12: Si pido algo que aquí no se puede hacer todavía, me lo dice en una frase y me ofrece abrir la pantalla donde sí se puede.
- R-13: De cada petición queda registrado cómo acabó (resuelta, propuesta confirmada o descartada, «no se hace aquí», error), cuánto tardó y cuánto costó, sin guardar el texto de más de lo que ya se guarda hoy.
- R-14: Mientras prepara la respuesta veo que está trabajando y en qué; no una pantalla quieta.
- R-15: Si la conversación falla, mi mensaje sigue en la caja, veo qué pasó y qué hacer, y el resumen y el menú siguen funcionando.
- R-16: Nunca me da una cifra que no venga de mis datos; si no hay dato, lo dice.
- R-17: La conversación continúa si abro el agente desde otra pantalla, y puedo empezar una nueva cuando quiera.
- R-18: En el móvil la caja es cómoda con el pulgar y la cabecera no gana elementos.
- R-19: Solo se me ofrece y se me deja hacer lo que mi rol permite en pantalla.

## 7. Alternativas consideradas
1. **No construir nada: usar más el agente que ya hay.** Cuesta cero. Descartada como única respuesta porque el dato dice que, tal como está, no se usa (0 mensajes desde el 16 nov); pero es el plan si se descarta este PRD.
2. **Dejar Inicio como está y añadirle una caja que abre el panel lateral.** Es la más barata y reversible. Descartada como recomendación porque no es lo pedido («que el inicio sea» la conversación) y mantiene dos sitios; es la alternativa de repliegue.
3. **Inicio conversacional con el resumen de hoy debajo.** Elegida: da a la conversación el sitio principal sin perder lo que hoy se decide en Inicio, y con la base casi vacía la pantalla no queda en blanco.
4. **Solo conversación, sin resumen y retirando pantallas.** Descartada: choca con el no-objetivo aprobado el 2026-11-18, obliga a cerrar todos los huecos antes de lanzar y no se puede validar sin datos.
5. **Una sola barra (buscar y pedir) en todas las pantallas, sin tocar Inicio.** Aplazada: es la decisión abierta del PRD del 2026-11-18 y se decide mejor con el uso medido de esta primera versión.

## 8. Orden de entrega
| # | SDD | Tipo | Depende de | Cubre |
|---|---|---|---|---|
| 1 | Medición: cómo acaba, cuánto tarda y cuánto cuesta cada petición | Mejora | — | G-2, G-5, R-13 |
| 2 | Inicio conversacional: caja, ejemplos, resumen debajo, estados de trabajo y de fallo | Feature | 1 | G-1, G-6, R-1 a R-4, R-14, R-15, R-17, R-18 |
| 3 | «Llévame a…», buscar registros y respuesta honesta para los huecos | Feature | 2 | G-2, R-6, R-11, R-12 |
| 4 | Cierre de huecos, uno por área, en el orden que marque la medición | Feature | 1, 3 | G-2 |

El SDD 1 va primero a propósito: sin él no se puede aplicar el criterio de descarte. Ninguno se redacta hasta que Fede apruebe este PRD y lo pida.

## 9. Criterio de descarte
- **Antes de construir:** si el coste por turno no se puede registrar (SDD 1), no se lanza Inicio conversacional.
- **Tras dos semanas de uso de Fede con la primera versión** (plazo propuesto, lo fija Fede):
  - si más de la mitad de las peticiones acaban en «esto no lo hago aquí», en error o en abrir la pantalla a mano, se vuelve a la alternativa 2;
  - si alguna acción cambia datos sin confirmación, se retira ese mismo día;
  - si Fede ha vuelto a usar el menú para lo que la conversación cubre, se vuelve a la alternativa 2. Lo decide Fede: no hay forma de medirlo sin datos de uso por pantalla.
- El resumen actual de Inicio no se borra durante la prueba, para que volver atrás sea un cambio pequeño.

## 10. Riesgos, dependencias y preguntas abiertas
**Riesgos**
- **Valor:** el agente ya existe y casi no se usa. Puede que el freno no sea que esté escondido, sino que no sea útil con la base casi vacía (0 deals). Ponerlo en Inicio no arregla eso.
- **Usabilidad:** una caja vacía exige saber qué pedir; con 136 capacidades es fácil que elija la equivocada o que la persona no descubra lo que hay. Los ejemplos (R-4) y la respuesta honesta (R-12) lo mitigan, no lo resuelven.
- **Negocio y coste:** hoy no se sabe lo que cuesta un turno. Cada capacidad que se añade encarece todos los turnos. Sin medición no hay tope posible.
- **Validación:** no hay entorno de pruebas; probar escrituras desde la conversación escribe en producción. Y con 0 deals no se puede comprobar cómo responde con volumen.
- **Coherencia con lo aprobado:** el PRD del 2026-11-18 (aprobado) descarta «Agente primero». Además ese PRD no está en `main`: solo existe como archivo sin seguimiento en un checkout local.
- **Restricciones del proyecto:** todo icono con texto (NK-0168); objetivos táctiles de 44 px; la cabecera móvil está medida para 360 px; español con «tú»; ninguna cifra inventada; ningún dato de cliente; nada cambia sin confirmación; nunca se envía en nombre de la persona.

**Dependencias:** ninguna externa. Reutiliza el agente, sus capacidades, la confirmación de acciones, la memoria, las reglas del equipo, el dictado y la lectura en voz, los bloques de opciones, el resumen de Inicio, la bandeja única y la búsqueda de ⌘K.

**Preguntas para Fede** (con mi recomendación)
- **Q-1. ¿Qué entra en la primera versión?** *Recomiendo: lo que el agente ya hace, más «llévame a…», buscar registros y la respuesta honesta para los huecos.* Porque es lo único que se puede lanzar sin construir capacidades nuevas a ciegas; los huecos se cierran después en el orden que marque lo que de verdad pidas.
- **Q-2. ¿Inicio se sustituye o se conserva?** *Recomiendo: Inicio pasa a ser la conversación y el resumen de hoy se queda debajo, más compacto.* Porque es lo que has pedido, y el resumen es donde hoy decides lo pendiente; quitarlo te obligaría a preguntar cada mañana lo que antes veías.
- **Q-3. ¿Este PRD corrige el del 2026-11-18?** *Recomiendo: sí, lo enmienda en un punto: el Agente deja de ser el último hito y pasa a ser el Inicio; el no-objetivo «no sustituir las pantallas por un chat» se mantiene.* Porque las dos cosas son compatibles si las pantallas no se tocan. Si prefieres mantener el orden A → B → C de aquel PRD, este se aparca hasta el hito C.
- **Q-4. ¿Plazo y umbrales del criterio de descarte?** *Recomiendo: dos semanas y «más de la mitad sin resolver».* Porque con un solo usuario un plazo más corto no da peticiones suficientes; son umbrales de decisión, no medidas, y los fijas tú.

**Preguntas para el equipo técnico**
- ¿Dónde se registra el coste de un turno cuando responde cada uno de los proveedores de IA configurados, y qué pasa cuando el proveedor no lo devuelve?
- ¿Se puede mostrar el progreso de la respuesta (R-14) sin cambiar lo que comparten la app, Telegram y los asistentes externos?
- ¿Cuántas capacidades puede manejar el agente con fiabilidad antes de elegir mal? ¿Hay pruebas de evaluación que lo midan?
- ¿Por qué el registro de traza de herramientas está vacío en producción?
- ¿Cómo se prueban las escrituras sin entorno de pruebas?
- ¿Qué pasa con «Agente» en la barra inferior del móvil cuando Inicio ya es la conversación?

## 11. Pendiente de verificar
- Que cada capacidad de la columna «Cubierto» funciona de extremo a extremo (comprobado por nombre, no ejecutándolas).
- El reparto exacto entre capacidades de consulta y de cambio (el conteo por archivo da 67 y 67 con nombre fijo, más 5 de cambio generadas; el catálogo para asistentes externos lista 143 con las suyas propias).
- Qué secciones de Métricas no tienen capacidad en el agente de la app.
- Si «llévame a…» ya funciona hoy para todas las pantallas del menú.
- Qué modelo responde de verdad en producción (el registro que lo diría está vacío).
- Comportamiento con roles distintos de Owner.
- Comportamiento en móvil a 360 px.
- Tiempo de respuesta con datos reales y con peticiones que encadenan varias consultas.

## 12. Aprobación
- [x] Fede aprueba el PRD (primer GO de dirección). Fecha: 2026-11-21. Respuesta literal: «Apruebo las cuatro».
- **Q-1 (alcance):** la primera versión es lo que el agente ya hace, más «llévame a…», buscar registros y la respuesta honesta para los huecos. Los huecos se cierran después, en el orden que marque la medición.
- **Q-2 (Inicio):** Inicio pasa a ser la conversación; el resumen de hoy se queda debajo, más compacto.
- **Q-3 (PRD del 2026-11-18):** este PRD lo enmienda en un punto: el Agente deja de ser el último hito y pasa a ser el Inicio. El no-objetivo «no sustituir las pantallas por un chat» se mantiene. El resto de aquel PRD no cambia.
- **Q-4 (descarte):** dos semanas de uso de Fede; se vuelve a la alternativa 2 si más de la mitad de las peticiones acaban sin resolver.
- Aprobar el PRD no autoriza construir. Los SDD se redactan con `nokko-shape`, de uno en uno y solo cuando Fede lo pida; los [Por verificar] de la sección 11 siguen abiertos y cada SDD cierra los suyos.
