# GTM Brain al estilo BMAD

## Qué es BMAD (resumen)

BMAD es un método de desarrollo de software asistido por IA. Se apoya en cinco ideas:

1. **Agentes con personalidad y menú.** Hay seis expertos con nombre: Analista, Product Manager, Product Owner, Arquitecto, Desarrollador y Diseñador UX. Cada uno ofrece un menú de códigos cortos (por ejemplo, `PRD` o `CR`) que lanzan un flujo de trabajo concreto sin que el experto pierda su papel.
2. **Fases encadenadas por documentos.** Análisis (idea, investigación, brief) → Planificación (PRD) → Solución (arquitectura, epics, revisión de preparación) → Implementación (sprint, historias, revisión, retrospectiva). Cada fase produce un documento que es la entrada de la siguiente.
3. **Un hub que orquesta.** Lee lo que ya existe, dice en qué punto estás y propone el siguiente paso en orden de prioridad.
4. **Escala según el tamaño.** Un cambio pequeño va directo a construir; un proyecto grande pasa por brief, PRD, arquitectura y epics. Se usa el camino más corto que sea seguro.
5. **Herramientas transversales:**
   - *Contexto de proyecto*: un documento vivo que cargan todos los agentes.
   - *Revisión avanzada*: pre-mortem, red team, primeros principios…
   - *Debate multiagente*: varios expertos discuten un mismo problema.
   - *Revisión de preparación* antes de pasar a implementar.
   - *Retrospectivas* al cerrar cada epic.

## La analogía con GTM Brain

| BMAD (software) | GTM Brain (go-to-market) |
|---|---|
| Idea / producto | Empresa y su oferta |
| Contexto de proyecto | **Contexto de empresa**: posicionamiento, ICP, segmentos y pilares, cargado en cada agente |
| Product brief | **GTM Brief**: problema, mercado, cliente, alternativa y apuesta |
| PRD | **Plan GTM**: segmentos, motion por ACV, objetivos, cuotas, mensajes, canales |
| Arquitectura | **Arquitectura de Revenue**: capacidad, cobertura, roles, territorios, playbooks, herramientas |
| Revisión de preparación | **Revisión antes de salir al mercado** (¿plan, capacidad y mensajes alineados?) y **criterios para pasar de etapa** en cada deal |
| Epic | **Account Plan** (o campaña) |
| Historia | **Deal / oportunidad** con sus criterios de salida (MEDDPICC) |
| Tarea | Reunión, tarea, acción del plan de acción mutuo |
| Sprint | **Semana comercial**: prioridades, revisión de pipeline, forecast |
| Code review | **Revisión de deal** (MEDDPICC, riesgos) |
| QA | **Revisión de forecast** (commit frente a resultado real) |
| Retrospectiva de epic | **Win/Loss y retro trimestral** (alimentan de nuevo el Brief y el Plan) |
| Camino según tamaño | **Camino según ACV**: PLG <5K (sin plan), inside 5–50K (MEDDPICC ligero), field/strategic >50K (Account Plan completo + plan de acción mutuo) |
| Hub `bmad` | **GTM Brain «¿Qué hago ahora?»**: fase actual, documentos que faltan, siguiente paso por rol |
| Debate multiagente | **Mesa de deal / war room**: varios expertos debaten un deal o el plan (aquí encaja el Case Clinic de Theory U) |
| Revisión avanzada | **Revisión profunda**: pre-mortem del deal, red team del competidor, mapa de poder |

## Los agentes de GTM Brain y quién los usa

| Agente (equivale a) | Menú (códigos) | Usuarios principales |
|---|---|---|
| **Marta, Analista de mercado** (Analista) | `IM` investigar mercado · `CT` análisis de competidor · `VC` voz del cliente (sensing) · `BR` GTM Brief · `CE` contexto de empresa | Owner/RevOps, Marketing, Enablement |
| **Juan, Estratega GTM** (PM) | `PG` crear/actualizar Plan GTM · `VP` validar plan | Owner, Sales Leader |
| **Wenceslao, Arquitecto de Revenue** (Arquitecto) | `AR` arquitectura de revenue · `CP` plan de capacidad · `RP` revisión antes de salir al mercado | Owner/RevOps, Deal Desk |
| **Sofía, Directora de ventas** (PO) | `PS` plan de la semana · `AP` dividir el plan en Account Plans · `RF` priorizar pipeline · `RE` replanificar | Sales Leader |
| **Amelia, Copiloto del vendedor** (Desarrollador) | `CP` call prep · `DL` avanzar deal · `RD` revisión de deal · `PR` propuesta · `WL` win/loss | AE, SDR, SE, CS |
| **Sara, Mensajes y campañas** (UX) | `MS` mensajes por persona · `CA` campaña · `JC` recorrido de compra | Marketing, Enablement |
| **GTM Brain (hub)** | «¿Qué hago ahora?», estado, cambiar de iniciativa | Todos |

Cada rol ve primero sus agentes; el resto quedan disponibles si su rol lo permite.

## Qué construimos

1. **Fases y documentos.** Cada empresa tiene una línea de fases: Análisis → Plan → Arquitectura → Ejecución → Retro. Cada fase genera un documento (Brief, Plan GTM, Arquitectura de Revenue, retro trimestral) que puedes revisar, aprobar y versionar. Cada documento aprobado alimenta automáticamente la fase siguiente y el Contexto de empresa.
2. **Agentes con personalidad y menú** dentro del panel del agente. Puedes elegir experto y lanzar un código (p. ej. `RD` sobre un deal). Por debajo comparten las mismas herramientas y confirmaciones que ya existen.
3. **Hub «¿Qué hago ahora?»** en Inicio y en el agente: en qué fase estás, qué documento falta y los siguientes pasos para tu rol. Integra el % de configuración y las sugerencias actuales.
4. **Camino según tamaño del deal:** el ACV decide cuánta preparación pide cada deal y qué criterios exige cada cambio de etapa (aviso al moverlo sin cumplirlos).
5. **Revisiones de preparación:** «¿Listos para salir al mercado?» sobre Plan + Arquitectura, y criterios por etapa en los deals.
6. **Mesa de deal:** varios agentes debaten un deal o el plan y cierran con riesgos y próximos pasos que puedes convertir en tareas.
7. **Revisión profunda:** sobre cualquier documento o deal (pre-mortem, red team, primeros principios), con los cambios propuestos para aceptar o descartar.
8. **Retrospectivas:** win/loss al cerrar un deal y retro trimestral, que proponen cambios al Brief y al Plan y cierran el ciclo.

Todo respeta el modo «sugiere, tú apruebas» y funcionará igual en Telegram cuando se conecte.

---

## Detalles técnicos

- **Registros declarativos** (como los skills de BMAD), uno por archivo y testeados:
  - `src/lib/bmad/personas/*.ts` — id, nombre, rol equivalente, tono, roles de la app que lo ven primero, menú (código → workflow), herramientas permitidas.
  - `src/lib/bmad/workflows/*.ts` — id, fase, prerrequisitos (documentos aprobados), pasos guiados, schema del documento que produce y criterios de validación.
  - `src/lib/bmad/phases.ts` — fases y regla pura `nextSteps(state, roles)` que usa el hub. Se integra con `setup-schema` y las sugerencias.
  - `src/lib/bmad/tracks.ts` — camino por ACV (reutiliza los umbrales de `metrics.ts`) y criterios de salida por etapa.
- **Datos (migración, RLS por empresa):**
  - `gtm_artifacts`: tipo brief / plan / architecture / readiness / retro / winloss, versión, estado draft/approved, contenido jsonb + markdown, autor, aprobado_por.
  - `artifact_reviews`: revisión profunda y readiness, con hallazgos.
  - `deal_reviews` / `war_rooms`: transcripción resumida y acciones.
  - Aprobar Plan y Arquitectura: solo owner y sales_leader.
- **Agente:** `runAgent` recibe `personaId` y `workflowId`; el system prompt se compone de persona + workflow + Contexto de empresa (artefactos aprobados). Nuevas herramientas: `draft_artifact`, `approve_artifact` (escritura con confirmación), `get_artifact`, `next_steps`. La mesa de deal ejecuta 3–4 personas en secuencia (llamadas acotadas) y un moderador sintetiza.
- **UI:** selector de agente y menú de códigos en el panel; nueva página «Ciclo GTM» con la línea de fases y los documentos (editor markdown, versiones, aprobar); tarjeta «¿Qué hago ahora?» en Inicio; aviso de criterios de etapa en el Pipeline.
- **Tests:** `nextSteps` por rol/fase, prerrequisitos de workflows, camino por ACV y criterios de etapa, permisos de aprobación.
