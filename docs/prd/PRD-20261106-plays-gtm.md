# PRD-20261106-plays-gtm · [Iniciativa] Plays GTM en NOKKO: librería con los 28 plays de referencia

**Tipo:** Iniciativa · **Prioridad propuesta:** Media (la base de datos interna ya existe y el coste es de ingeniería, no de proveedores; los plays con fuente externa esperan decisiones tuyas)
**Estado:** Aprobado (2026-11-06) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-06
**SDD que lo desarrollan:** `docs/sdd/SDD-20261106-plays-library-core.md` (redactado); el resto, «pendiente» (sección 8)

> Un PRD dice qué se quiere y por qué. No dice cómo se construye ni cómo se prueba: eso es del SDD.

## 1. Problema
NOKKO ya detecta cosas sueltas (deals fríos, seguimiento de leads, señales de cuenta, motivos de pérdida, uso de producto), pero no las organiza como **plays**: una jugada con su disparador, sus puertas de descarte explicadas, su resultado y su medición. Fede ha analizado 28 plays de referencia (frontal.so/plays) y quiere tenerlos todos en NOKKO. Hoy no hay forma de ver qué jugadas existen, cuáles están activas, cuáles faltan ni por qué un candidato se descartó.

## 2. Para quién
Founder y Sales Leader de NOKKO (uso interno de Fede). Los demás miembros ven los plays y reciben sus sugerencias, pero no los activan.

## 3. Evidencia y por qué ahora
Fuentes: `frontal.so/plays` y las 28 páginas de play (leídas el 2026-11-06); código de `main` en el commit 47ec72c (leído el 2026-11-06); `src/lib/AGENTS.md`; `docs/sdd/SDD-20261027-strategic-suggestions-engine.md`. Sin datos de uso: sin dato.

**Dos cosas con el mismo nombre.** NOKKO ya tiene una «Playbook library» (`src/lib/playbooks/base.ts`, cinco guiones de venta: discovery, objeciones, demo, negociación, propuesta, guardados en `knowledge_docs`). Eso son guiones de conversación. Los plays de Frontal son otra cosa: automatizaciones con disparador, puertas y salida. Esta iniciativa **no toca** los playbooks y llama a lo nuevo «Plays GTM» (módulo `src/lib/plays/`) para no mezclarlos.

**Lo que NOKKO ya tiene y los plays reutilizan** (fuente: `src/lib/AGENTS.md` y `src/lib/proactive/`):
- 17 reglas proactivas que generan sugerencias con clave de deduplicación (`DETECTORS`, `STRATEGY_DETECTORS`).
- Señales de cuenta con noticias (`account_signals`, detector `account_signal`), sin peso ni caída.
- Motivo de pérdida y competidor en deals (`deals.lost_reason`, `lost_reason_detail`; regla `repeatedLoss`).
- Secuencia de seguimiento de leads (`followup.ts`), asignación de cuentas (`assignment.ts`), deals fríos (`stale.ts`), puntuación por encaje con el ICP (`scoring.ts`), cualificación (`lead-qualification.ts`), notas de llamada (`call-notes.ts`), preparación de reuniones (autopilot), uso de producto con PostHog (`productQualified`, `usageDrop`), duplicados (`dedupe.ts`, `match.ts`).
- Proveedores ya conectados: Apollo, Clay, Parallel, Perplexity, Firecrawl, Apify (con topes de gasto), y panel de presupuesto por empresa.

**Mapa de los 28 plays.** Estado = lo que NOKKO tiene hoy: **parcial** (hay piezas, falta la jugada), **nuevo interno** (se construye con datos que NOKKO ya guarda) o **externo** (necesita una fuente de datos que NOKKO no tiene o una decisión pendiente). Las columnas «Tiene hoy» y «Falta» salen de la lectura del código; lo que no he podido comprobar va con [Por verificar].

| id (slug) | Play de referencia | Estado | Tiene hoy | Falta | Bloqueo | SDD |
|---|---|---|---|---|---|---|
| `meeting-prep-and-follow-up` | Meeting Prep and Follow-Up | parcial | Preparación automática de reuniones de las próximas 36 h, notas de 5 líneas, recordatorio de notas | Seguimiento tras la reunión como borrador, deduplicar reunión repetida | — | 4 |
| `meeting-form-orchestration` | Meeting Form Orchestration | parcial | Entrada de leads por API y CSV, `lead_events`, regla `late_lead` | Clasificar quién respondió, asistió o no, tiempo hasta primera respuesta | — | 4 |
| `closed-lost-revival` | Closed-Lost Revival | parcial | `lost_reason`, regla `repeatedLoss` | Ventana de revisión por motivo, puerta «algo cambió de verdad», borrador de reapertura | — | 3 |
| `signals-in-crm-with-decay` | Signals in the CRM, with Decay | parcial | `account_signals` con fecha de publicación | Peso por tipo de señal, caída con el tiempo, ventana más estricta para citarla en un texto | — | 2 |
| `signal-activation` | Signal Activation | parcial | Detector `account_signal` (7 días) | Unificar fuentes bajo el modelo con caída y priorizar con él | — | 2 |
| `call-transcript-signal-extraction` | Call-Transcript Signal Extraction | parcial | `calls`, `call-notes.ts`, herramienta de teardown | Esquema fijo de extracción (situación, por qué ahora, qué probaron, dolor literal) | — | 5 |
| `pain-qualified-segments` | Pain-Qualified Segments from Calls | nuevo interno | Segmentos, notas de llamada | Agrupar dolor literal por segmento, banco de lenguaje | Depende de `call-transcript-signal-extraction` | 5 |
| `hubspot-account-tiering-scoring` | HubSpot Account Tiering & Scoring | parcial | `scoring.ts`, tier en cuentas | Aprender qué tienen en común los deals ganados y proponer pesos | — | 6 |
| `crm-hygiene` | CRM Hygiene | parcial | `dedupe.ts`, `match.ts`, `accountMissingKey`, catálogo de campos | Auditoría de solo lectura con informe, ganador por regla, rellenar solo huecos | — | 6 |
| `plg-to-sales` | PLG-to-Sales | parcial | Trials, PostHog, `productQualified`, `usageDrop`, `trialConversion` | Puntuación doble encaje + uso, criterio de salida de etapa de lead [Por verificar] | — | 7 |
| `product-sign-up-outreach` | Product Sign-Up Outreach | parcial | `trials`, flujo de leads | Borrador de contacto por cada registro nuevo [Por verificar] | — | 7 |
| `multi-thread-inbound-leads` | Multi-Thread Inbound Leads | parcial | `stakeholders`, `people`, `no_decision_maker` | Sugerir a quién más contactar en la cuenta de un lead entrante | Contacto adicional vía Apollo/Clay o LinkedIn | 7 |
| `website-visitor-de-anonymization` | Website Visitor De-anonymization | externo | Nada | Fuente de visitas identificadas | Proveedor de datos (decisión F7) | 8 |
| `review-site-intent-scoring` | Review-Site Intent Scoring | externo | Mapeo de reseñas G2 en `apify.ts` [Por verificar si está activo] | Alertas de intención de sitios de reseñas | Proveedor de datos | 8 |
| `new-hire-tracking` | New Hire & GTM Leader Tracking | externo | Nada | Cambios de puesto | LinkedIn (D2) o proveedor | 8 |
| `hiring-signal-monitoring` | Hiring Signal Monitoring | externo | Mapeo de ofertas en `apify.ts` [Por verificar] | Vigilancia periódica de ofertas por cuenta | Apify activo y D2 | 8 |
| `funding-signal-scraping` | Funding Signal Scraping | externo | Noticias de financiación en `web-research.ts` | Revisión semanal de fuentes de financiación por ICP | Proveedor / búsqueda web | 8 |
| `tech-stack-signal-detection` | Tech Stack Signal Detection | externo | Nada | Detectar tecnología de cada cuenta y sus altas y bajas | Proveedor de datos | 8 |
| `brand-mentions-monitoring` | Brand Mentions Monitoring | externo | Nada | Monitorizar menciones | LinkedIn (D2) | 8 |
| `competitor-post-engagers` | Competitor Post Engagers | externo | Nada | Quiénes interactúan con competidores | LinkedIn (D2) | 8 |
| `target-account-exec-posts` | Target-Account Exec Posts | externo | Nada | Lista de vigilancia de ejecutivos | LinkedIn (D2) | 8 |
| `founder-connections-mining` | Founder Connections Mining | externo | Nada | Explotar la red del fundador | Exportación de LinkedIn del propio Fede, decisión D2 | 8 |
| `webinar-attendee-capture` | Webinar & Event Attendee Capture | externo | Importación CSV de leads | Captura desde la herramienta de webinars | Herramienta de webinars sin decidir | 8 |
| `automated-reply-enrichment` | Automated Reply Enrichment | externo | Envío con Resend | Bandeja de respuestas entrantes | Recepción de email [Por verificar] | 8 |
| `abm-ads` | ABM + Ads | externo | `icp.ts`, Descubiertos, ABM | Solo la parte «ICP a TAM»; los anuncios quedan fuera | Plataformas de anuncios | 8 |
| `public-records-signals` | Public Records Signals | externo | Nada | Consulta de registros públicos por calendario | Qué GTM sirve NOKKO y en qué país | 9 |
| `public-filings-qualification` | Qualifying from Public Filings | externo | Nada | Regla en código sobre un hecho de registro público | Igual que el anterior | 9 |
| `local-business-tam` | Local Business TAM from Directories | externo | Nada | Tamaño del mercado local desde directorios, sin coste | Igual que el anterior | 9 |

Resumen: 11 parciales, 1 nuevo interno y 16 externos. Los 12 primeros se construyen con lo que NOKKO ya guarda.

**Por qué ahora:** la lógica interna ya está lista y es la parte barata; los plays externos dependen de decisiones que siguen abiertas (proveedor de datos, LinkedIn, qué GTM). Ordenar el trabajo ahora evita construir señales externas sobre un modelo de señales que aún no tiene peso ni caída.

## 4. Objetivos
| ID | Objetivo | Cómo se mide | Línea base | Fuente |
|---|---|---|---|---|
| G-1 | Ver los 28 plays en NOKKO con su estado real, qué datos necesitan y qué los bloquea | Plays en la librería con estado | Sin dato (no existe el catálogo) | Catálogo de código, `src/lib/plays/catalog.ts` |
| G-2 | Que cada candidato que un play descarta quede explicado con un motivo | Descartes con motivo sobre descartes totales | Sin dato | Registro de ejecuciones de plays (`play_runs`) |
| G-3 | Que ningún play envíe un mensaje ni cambie un dato sin tu confirmación | Salidas de tipo «envío automático» | Sin dato (se verifica por prueba: debe ser 0) | Prueba automática del catálogo |
| G-4 | Activar primero los plays que usan datos que NOKKO ya tiene, sin coste de proveedor | Plays activos que no consumen presupuesto de proveedor | Sin dato | Registro de uso de integraciones (`integration_usage`) |
| G-5 | Saber si cada play sirve | Reuniones y deals que nacen de sugerencias de cada play | Sin dato; se medirá tras el lanzamiento | Sugerencias aceptadas por play y deals creados desde ellas |

Nunca hay línea base estimada.

## 5. No-objetivos
- Enviar mensajes, publicar o cambiar datos sin confirmación humana (borradores y sugerencias solamente).
- Tocar los cinco playbooks de venta existentes.
- Scraping de LinkedIn ni valoración de personas a partir de LinkedIn, hasta que Fede cierre la decisión D2.
- Contratar proveedores nuevos; los plays externos usan solo lo ya conectado y esperan la comparativa de proveedores.
- Plataformas de anuncios (la parte «Ads» de ABM + Ads).
- Copiar el texto de Frontal: los plays se redactan con palabras propias, en español y «tú».
- Aplicar a Postin: NOKKO y Postin son productos separados.

## 6. Decisiones tomadas y abiertas
| Tema | Decisión | Quién y cuándo |
|---|---|---|
| Alcance | Los 28 plays aparecen en la librería; cada uno se activa en el SDD que lo implementa | Fede, 2026-11-06 (petición) |
| Uso | Interno, no producto para vender | Fede, 2026-11-06 |
| Salida de los plays | Solo sugerencias, tareas y borradores | Regla de NOKKO, `AGENTS.md` y SDD 11 |
| A qué GTM sirve NOKKO (Postin, Getnet o ambos) | **Abierta** | Fede |
| Scraping de LinkedIn (D2) | **Abierta**: SDD 11 lo excluye hasta que decidas | Fede |
| Proveedor de datos para señales externas (Lusha, Clay, Apollo) | **Abierta** (comparativa de proveedores pendiente) | Fede |
| Nombre: «Plays GTM» frente a «playbooks» | Propuesto en este PRD | Fede, al aprobar |

## 7. Riesgos y dependencias
- **Confundir plays con playbooks.** Mitigación: nombres y módulos distintos (sección 3).
- **Catálogo sin ejecución.** Si el SDD 1 se entrega solo, la pantalla enseña 28 plays y la mayoría no hace nada. Debe decirlo con palabras (estado «parcial», «planificado», «bloqueado»), nunca como activo.
- **Señales externas sobre un modelo sin caída.** Por eso el SDD 2 va antes que el 8.
- **Pausar un play cierra sus sugerencias pendientes** porque la sincronización auto-resuelve lo que ya no detecta (`syncSuggestions`, `src/lib/org-data.ts`). Se acepta y se documenta; no se pierde el historial.
- **Cumplimiento de licencias de proveedores** (auditoría del 24 de octubre, P1.1) para los plays 8 y 9.
- Dependencias: SDD 11 (motor de sugerencias estratégicas) para el patrón de sugerencia con evidencia; migraciones pendientes de aplicar en Lovable (`docs/sdd/annex/migraciones-pendientes-lovable-20261101.md`).

## 8. Orden de entrega
| # | SDD | Tipo | Depende de | Cubre |
|---|---|---|---|---|
| 1 | `SDD-20261106-plays-library-core` (redactado) | Feature | — | G-1, G-2, G-3 |
| 2 | `SDD-…-plays-signals-decay` (señales con peso y caída; Signal Activation) | Feature | 1 | G-4, G-5 |
| 3 | `SDD-…-plays-closed-lost-revival` | Feature | 1; usa 2 para «algo cambió» | G-4, G-5 |
| 4 | `SDD-…-plays-meetings-and-intake` (prep y seguimiento; formulario de reunión) | Feature | 1 | G-4, G-5 |
| 5 | `SDD-…-plays-call-extraction-and-pain-segments` | Feature | 1 | G-4, G-5 |
| 6 | `SDD-…-plays-account-tiering-and-hygiene` | Feature | 1 | G-4, G-5 |
| 7 | `SDD-…-plays-product-signups-and-multithread` | Feature | 1, 2 | G-4, G-5 |
| 8 | `SDD-…-plays-external-signals` (se subdividirá por fuente al desbloquearse) | Iniciativa | 2; decisiones D2 y proveedor | G-4, G-5 |
| 9 | `SDD-…-plays-public-records-and-local-tam` | Feature | 2; decisión de GTM | G-4, G-5 |

Los SDD 2 a 9 se redactan uno a uno con `nokko-shape` cuando apruebes este PRD y el SDD 1; un SDD por feature evita una especificación de 28 plays que nadie pueda revisar.

## 9. Aprobación
- [x] Fede aprueba el PRD (primer GO de dirección). Fecha: 2026-11-06
- Al aprobar, el Estado pasa a «Aprobado». Después se redactan los SDD con `nokko-shape`.
