# SDD-20261025-fit-data-7b-competitors-entity · [Feature] Competidores como entidad y alta manual (parte b de 3 de «Datos mínimos de encaje»)

**Tipo:** Feature · **Prioridad propuesta:** Alta
**Estado:** Borrador · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-25
**PRD:** docs/prd/PRD-20261028-ux-onboarding-coherencia.md (cubre G-5) · **Depende de:** SDD-20261025-universal-field-definitions, SDD-20261025-field-actions-edit-delete-confirm; coordinar con SDD-20261025-discoveries-scoped-manual-search

## 1. Resumen
Auditoría de los «Datos para el encaje para investigar» de **Cuentas, Personas, Leads y Competidores**. Objetivo: que NOKKO recoja siempre la **información mínima de identidad** (la llave) de cada entidad, para que apps de terceros (hoy Apollo, Clay, Parallel, Firecrawl, Perplexity, Apify) devuelvan datos más valiosos y fieles, y que lo que devuelvan se guarde con su origen sin pisar lo escrito por la persona.

> Este documento es la parte 7b de la división decidida por Fede del SDD «Datos mínimos de encaje». Los identificadores CA y H conservan la numeración original para trazabilidad. Las otras partes: 7a, 7b y 7c.

## 2. Problema y para quién
- Founder: la investigación falla o es pobre porque falta una llave (p. ej. cuenta sin dominio).
- Equipo: cada entidad guarda su identidad de forma distinta, y los competidores no tienen entidad propia.

## 3. Evidencia y por qué ahora
Fuente: código y esquema del repo `main` (2026-10-25). Sin datos de cuántos registros carecen de cada llave (sin dato; el SDD pide medirlo).
**Hallazgos:**
1. **Cuentas** (22 columnas): tiene `domain`, `linkedin_url`, `country`, `industry`, `size`, procedencia por campo. `size` es texto libre (el proveedor devuelve «N empleados» como cadena) mientras el ICP usa mínimo/máximo numéricos. `country` es texto libre (hay conversión a ISO en el código del proveedor, no en el dato guardado). No hay ciudad, ingresos ni descripción guardados aunque el proveedor los devuelve y el borrador de cuenta los contempla.
2. **Dominio como llave:** la búsqueda de personas en Apollo falla si la cuenta no tiene dominio («La cuenta no tiene dominio…»); el investigador automático ignora cuentas sin dominio (prueba `autopilot.test.ts`).
3. **Personas — dos tablas sin vínculo:** `people` (nombre completo, email, cargo, LinkedIn, empresa en texto, cuenta, etapa) y `stakeholders` (nombre, cargo, email, teléfono, LinkedIn, rol de compra, investigación). Las dos guardan a personas de una cuenta con campos distintos; el enriquecimiento escribe en `stakeholders` y la entrada de leads en `people`. **[Por verificar]** si se relacionan en algún punto.
4. **Personas:** no hay nombre y apellido separados, ni teléfono ni ubicación en `people`; `stakeholders` no tiene ubicación aunque el borrador sí.
5. **Leads** (34 columnas): `company` en texto, `contact_name`, `email`, `title`; `account_id` y `person_id` opcionales; el sistema detecta email personal (gmail, outlook u otros) para derivar dominio. Un lead sin vínculo a cuenta/persona no tiene llave estable para enriquecer.
6. **Competidores:** no existen como entidad. Viven como texto en `positioning.competitive_alternative` y Descubiertos los lee de ese texto (`knownCompetitors`). Sin dominio ni LinkedIn, un tercero no puede enriquecerlos de forma fiable.
7. **ICP:** ya tiene campos útiles para búsqueda (empleados mínimo/máximo numéricos, países como lista, cargos objetivo, señales de contratación y financiación). Son la base de los criterios que se mandan a los proveedores.
8. **Orquestador** (`planner.ts`): decide servicio por necesidad (investigar cuenta, encontrar stakeholders, completar cuenta/contacto, email, teléfono, noticias, empresas por ICP, casos, competidores), con coste, velocidad y calidad, y salta lo ya tenido. No declara qué llaves necesita cada necesidad.

**Apuesta declarada:** no hay datos de uso; la prioridad se apoya en el código de `main` y en la petición de Fede. Se medirá tras el lanzamiento con las métricas de la sección 4.

## 4. Resultado buscado
- % de cuentas con llave mínima completa (fuente: base de datos). Línea base: sin dato.
- % de personas y leads vinculados a una cuenta con dominio. Línea base: sin dato.
- Número de competidores con dominio. Línea base: 0 por no existir la entidad.
- Tasa de éxito de peticiones de enriquecimiento por falta de llave (fuente: registro de trabajos). Línea base: sin dato.
Cubre el objetivo G-5 del PRD.


## 5. Alcance
**Incluye:** definir la llave mínima por entidad; completarla con ayuda (derivar dominio, limpiar URL, separar nombre); entidad de competidor; vínculo persona–stakeholder–lead–cuenta; declarar llaves por necesidad de enriquecimiento; guardar lo devuelto por terceros con origen y sin sobrescribir; mostrar al usuario qué falta y por qué.
**No incluye:** contratar proveedores nuevos; extracción no oficial de datos de LinkedIn (solo API oficial; NOKKO no valora perfiles de LinkedIn); decidir proveedor por necesidad más allá de lo existente; cambiar el modelo de puntuación de leads.

## 6. Cambios de comportamiento (delta)
**Añadido:** llave mínima por entidad y su comprobación; entidad Competidor con nombre y dominio; vínculo entre registros de persona; aviso «Falta X para investigar»; propuestas de enriquecimiento.
**Modificado:** tamaño y país de cuenta → valores normalizados (según SDD universal); enriquecimiento → escribe como propuesta/origen externo, no sobrescribe valores confirmados; competidores → de texto libre a lista estructurada (manteniendo la frase de posicionamiento).
**Eliminado:** duplicidad de identidad de persona entre las dos tablas (según decisión de Fede).

### Llave mínima (validada tal cual por Fede, 2026-10-25)
| Entidad | Llave mínima | Datos de encaje opcionales que mejoran el resultado |
|---|---|---|
| Cuenta | dominio normalizado (o LinkedIn de empresa) + nombre | país normalizado, sector, nº de empleados, ciudad |
| Persona | nombre + (cuenta con dominio) o LinkedIn de persona o email | cargo, nivel de seniority, país, rol de compra |
| Lead | persona + cuenta (ambas vinculadas) | origen, cargo, fecha de contacto |
| Competidor | nombre + dominio | país, segmento, alternativa que reemplaza |
Esta tabla es una propuesta de Fede; los datos que realmente exige cada proveedor externo son **[Por verificar]** (Apollo exige dominio para personas, según el código; Clay, Parallel, Lusha u otros: sin dato).

## 7. Historias y criterios de aceptación
### H-3: Como founder, quiero gestionar competidores con datos útiles.
- CA-8: El sistema DEBE permitir crear, editar y borrar competidores con nombre y dominio · cubre G-5 · prueba: por nombrar en el brief
- CA-9: CUANDO Descubiertos encuentra un competidor, el sistema DEBE proponerlo con nombre y dominio y esperar mi confirmación (coherente con el SDD de Descubiertos) · cubre G-5 · prueba: por nombrar en el brief
- CA-10: SI cambio la lista de competidores, ENTONCES el sistema DEBE mantener coherente la frase «Alternativa competitiva» del posicionamiento sin pisar un texto que haya escrito yo · cubre G-5 · prueba: por nombrar en el brief

### H-6: Como founder, quiero añadir competidores a mano.
- CA-17: El sistema DEBE permitirme añadir un competidor con nombre y dominio en cada uno de estos puntos (decididos por Fede): bloque de Posicionamiento del onboarding («Alternativas y competidores»), pantalla de Estrategia y desde el Agente. El panel de Descubiertos solo muestra y confirma propuestas · cubre G-5 · prueba: por nombrar en el brief
- CA-18: CUANDO añado un competidor a mano, el sistema DEBE guardarlo como escrito por mí y confirmado · cubre G-5 · prueba: por nombrar en el brief
- CA-19: SI el competidor ya existe por nombre o dominio, ENTONCES el sistema DEBE avisarme y ofrecer abrir el existente · cubre G-5 · prueba: por nombrar en el brief
- CA-20: SI no indico dominio, ENTONCES el sistema DEBE aceptar el competidor, marcarlo «Falta dominio» y proponer uno si puede deducirlo de la web · cubre G-5 · prueba: por nombrar en el brief
- CA-21: MIENTRAS el onboarding no ha terminado, el sistema DEBE permitir saltar este paso sin bloquear el cierre · cubre G-5 · prueba: por nombrar en el brief

## 8. Casos límite y errores
- Dominio ya existente en otra cuenta: avisar del duplicado y enlazar ambos registros, nunca fusionar (CA-1, en 7a).
- Dominio de proveedor gratuito de correo en una cuenta: rechazar como dominio de empresa (CA-6, en 7a).
- Competidor sin dominio conocido: permitir guardarlo como incompleto y marcarlo «No enriquecible» (CA-2, en 7a).
- Tercero devuelve valores vacíos o contradictorios: no sobrescribir; registrar el intento (CA-14 y CA-15, en 7c).
- Presupuesto agotado: aplicar regla existente (pausa al 100 %, fuente: código del repo) y avisar (CA-3, en 7a).
- Persona con un solo nombre: aceptar y marcar apellido ausente (CA-7, en 7a).
- Registros históricos sin llave: listarlos como «Faltan datos» sin bloquear su uso (CA-2, en 7a).
- Rol sin permiso para editar: respetar roles actuales.

## 9. Experiencia y copy
Mensaje: «Para investigar a *X* falta el dominio. Lo he deducido de su web: *x.com*. ¿Lo confirmas?» Estados: «Completa», «Falta *dato*», «Propuesta de *proveedor*». «Tú», sin iconos.

## 10. Datos, permisos y privacidad
- Se guardan datos de empresas y de personas de negocio (nombre, cargo, email, teléfono, LinkedIn) que ya existen hoy; este SDD no añade categorías nuevas salvo ubicación y nombre/apellido.
- Los datos se envían a terceros solo con la llave mínima necesaria para cada necesidad, no la ficha entera. **[Por verificar]** qué se envía hoy.
- LinkedIn: solo API oficial; sin análisis ni puntuación de perfiles de LinkedIn.
- Base legal y proveedores de datos de contacto: **[Por verificar]**.
- Datos de ejemplo del SDD: ficticios (acme.com).

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Comprobar llaves y derivar dominio | reglas y normalización; cero LLM | ninguno | sin dato |
| Investigación (ya existente) | el planificador ya prioriza coste cero y caché; no se llama si CA-16 (en 7c) aplica | esfuerzo `low`; modelo: el que decide `aiProviders()` (`src/lib/gemini.ts`: claves propias primero, pasarela de Lovable de respaldo) | sin dato |

Una llamada no declarada aquí no se implementa.

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-3 | Entidad Competidor, alta manual en tres puntos y sincronía con posicionamiento (H-3, H-6; coordinada con SDD de Descubiertos) | CA-8, CA-9, CA-10, CA-17, CA-18, CA-19, CA-20, CA-21 | por nombrar en el brief |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Archivos: `src/lib/orchestrator/planner.ts` (añadir llaves requeridas por `Need`), `search.ts`, `runner.ts`, `src/lib/apollo.ts`, `src/lib/clay.ts` (`AccountDraft`, `StakeholderDraft`), `src/lib/leads-ingest.ts`, `src/lib/lead-qualification.ts` (`emailDomainOf`), `src/lib/autopilot.server.ts`, `src/components/account/stakeholders-tab.tsx`, `src/lib/discoveries.server.ts` (`knownCompetitors`).
- La regla de «llave mínima» como módulo puro con pruebas, consultado por pantallas, Agente y automatismos.
- Tablas: `accounts`, `people`, `stakeholders`, `leads`; nueva tabla de competidores o vista sobre posicionamiento (decide Fede tras la revisión técnica).
- **Uso de LLM:** cero para comprobar llaves y derivar dominio (reglas y normalización). LLM solo donde ya existe (investigación), con `effort:"low"`, y evitando llamadas cuando CA-16 (en 7c) aplica. El planificador ya prioriza coste cero/caché: mantener.

## 14. Riesgos y dependencias
- Tamaño: dividido en 7a (U-1, U-2), 7b (U-3 competidores, coordinado con Descubiertos) y 7c (U-4, U-5), por decisión de Fede (2026-10-25).
- Dueños: confirmar propuestas → SDD de acciones; no sobrescribir → SDD universal CA-9.
- Un lead con email personal sin cuenta queda «No enriquecible» hasta que se indique la empresa.
- Duplicados de personas: se avisa y se enlazan, nunca se fusionan (decidido por Fede, 2026-10-28; CA-12, en 7c).
- Migración de competidores desde texto: extracción imperfecta; mitigación: propuesta a confirmar por el usuario.
- Dependencia del SDD universal (origen y normalización) y del de acciones sobre campos (confirmar/editar).

## 15. Preguntas para Fede y para la revisión técnica
1. ¿Se relacionan hoy `people` y `stakeholders`? ¿Se pueden unificar o basta con un vínculo?
2. ¿Qué llaves exige realmente cada proveedor conectado?
3. ¿Qué datos de la ficha se envían hoy a cada tercero?
4. ¿Competidores como tabla nueva o dentro del posicionamiento?

## 16. Pendiente de verificar
- [Por verificar] Requisitos de entrada de Clay, Parallel y otros proveedores.
- [Por verificar] Relación entre `people` y `stakeholders`.
- [Por verificar] Datos enviados hoy a terceros.
- [Por verificar] Porcentaje de registros sin llave (sin dato).
- [Por verificar] Base legal de datos de contacto.
- [Por verificar] Que `production` coincide con `main`.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Un agente `nokko-gate` con contexto fresco lee este SDD y el código, y devuelve su informe. El coordinador lo copia aquí sin editarlo. El gate no aprueba el SDD: informa; la aprobación es de Fede.
Informe del gate recibido el 2026-10-28, copiado sin editar. El veredicto no aprueba el SDD: la aprobación es de Fede.
- **Veredicto del gate:** Objeciones
- **CA sin prueba posible o sin G-n:** todos los CA citan G-5, como pide `PRD:75`, pero ninguno nombra una prueba: CA-8 a CA-21 dicen «por nombrar» (`SDD:58-67`, `:100`) y la plantilla exige un archivo (`templates/sdd.md:33`). Tres no se pueden comprobar así: CA-10 («mantener coherente») no es observable; CA-20 depende de «si puede deducirlo»; y CA-9 es lo que ya hace hoy `discoveries.functions.ts:72-74`.
- **[Por verificar] que sigue sin comprobarse:**
  - «Clay: sin dato» (`SDD:54`) sí se puede comprobar: Clay también exige dominio (`clay.ts:81`).
  - Para `people`/`stakeholders` (`SDD:21,124`), ninguna columna los une en `types.ts`. No revisé si el código los relaciona.
  - Siguen abiertos el modelo de IA, la base legal y que `production` coincida con `main`.
- **Contradicciones con el código o con decisiones previas:**
  - La cabecera depende solo del SDD universal (`SDD:5`). El PRD dice «1, 2; coordinar con 6» (`PRD:75`).
  - Las secciones 1-6 describen el SDD 7 entero (cuentas, personas, leads, fusión: `SDD:39,45`), no solo competidores.
  - El texto cita CA que no están en este documento: CA-1, 2, 3, 6, 7, 12, 14, 15 y 16 (`SDD:70-76,93,112`).
  - «Proponer fusión» (`SDD:70`) choca con «never merge» (`AGENTS.md:23`).
  - Las etiquetas no coinciden: «No enriquecible» (`SDD:72`) frente a «Falta dominio» (CA-20).
  - La sección 11 no declara la IA de competidores que ya existe en Descubiertos (`discoveries.server.ts:115-122`).
  - `knownCompetitors` está en `discoveries.ts:28`, no en `.server.ts`.
  - Ignora `positioning.alternatives` (`setup-extraction.ts:12`).
  - El nombre «Alternativas y competidores» no aparece en `src`.
  - Falta la tabla con `org_id`/RLS que pide la plantilla (`templates/sdd.md:43`).
- **Lo que esta revisión NO demuestra:** el comportamiento en producción, la base de datos real ni las migraciones aplicadas. Tampoco los requisitos de Parallel, Lusha y el resto de proveedores, ni que el SDD de Descubiertos sea compatible con este.

## 18. Delta de implementación
Sin entrega todavía.

---
Validación: migrado a la plantilla de NOKKO el 2026-10-28. Revisión técnica: ver sección 17. `AUDIT-20261025.md` es el registro histórico anterior.
