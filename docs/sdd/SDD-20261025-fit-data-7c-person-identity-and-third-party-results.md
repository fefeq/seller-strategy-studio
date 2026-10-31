# SDD-20261025-fit-data-7c-person-identity-and-third-party-results · [Feature] Identidad de persona y resultados de terceros (parte c de 3 de «Datos mínimos de encaje»)

**Tipo:** Feature · **Prioridad propuesta:** Alta
**Estado:** Borrador · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-25
**PRD:** docs/prd/PRD-20261028-ux-onboarding-coherencia.md (cubre G-5) · **Depende de:** SDD-20261025-universal-field-definitions, SDD-20261025-field-actions-edit-delete-confirm

## 1. Resumen
Auditoría de los «Datos para el encaje para investigar» de **Cuentas, Personas, Leads y Competidores**. Objetivo: que NOKKO recoja siempre la **información mínima de identidad** (la llave) de cada entidad, para que apps de terceros (hoy Apollo, Clay, Parallel, Firecrawl, Perplexity, Apify) devuelvan datos más valiosos y fieles, y que lo que devuelvan se guarde con su origen sin pisar lo escrito por la persona.

> Este documento es la parte 7c de la división decidida por Fede del SDD «Datos mínimos de encaje». Los identificadores CA y H conservan la numeración original para trazabilidad. Las otras partes: 7a, 7b y 7c.

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
### H-4: Como founder, quiero una sola identidad por persona.
- CA-11: El sistema DEBE vincular la persona del CRM y el stakeholder de una cuenta cuando sean la misma (mismo email o mismo LinkedIn) · cubre G-5 · prueba: por nombrar en el brief
- CA-12: SI dos registros parecen la misma persona y no hay coincidencia exacta, ENTONCES el sistema DEBE avisar de que parecen la misma persona y enlazar ambos registros, sin proponer unirlos ni fusionarlos (decidido por Fede, 2026-10-28; `AGENTS.md`: «never merge») · cubre G-5 · prueba: por nombrar en el brief

### H-5: Como founder, quiero que lo que traen las apps externas sea fiable y no pise mis datos.
- CA-13: CUANDO un tercero devuelve un dato, el sistema DEBE guardarlo con proveedor y fecha como origen · cubre G-5 · prueba: por nombrar en el brief
- CA-14: SI el campo tiene un valor escrito o confirmado por una persona, ENTONCES el sistema DEBE guardar lo del tercero como propuesta pendiente sin reemplazar el valor · cubre G-5 · prueba: por nombrar en el brief
- CA-15: CUANDO dos proveedores devuelven valores distintos para el mismo campo, el sistema DEBE mostrar ambos con su origen y no elegir en silencio · cubre G-5 · prueba: por nombrar en el brief
- CA-16: CUANDO un dato ya está guardado y fresco para esa entidad, el sistema NO DEBE volver a pedirlo al tercero ni gastar presupuesto · cubre G-5 · prueba: por nombrar en el brief

## 8. Casos límite y errores
- Dominio ya existente en otra cuenta: avisar del duplicado y enlazar ambos registros, nunca fusionar (CA-1, en 7a).
- Dominio de proveedor gratuito de correo en una cuenta: rechazar como dominio de empresa (CA-6, en 7a).
- Competidor sin dominio conocido: permitir guardarlo como incompleto y marcarlo «No enriquecible» (CA-2, en 7a).
- Tercero devuelve valores vacíos o contradictorios: no sobrescribir; registrar el intento (CA-14, CA-15).
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
| Investigación (ya existente) | el planificador ya prioriza coste cero y caché; no se llama si CA-16 aplica | esfuerzo `low`; modelo: el que decide `aiProviders()` (`src/lib/gemini.ts`: claves propias primero, pasarela de Lovable de respaldo) | sin dato |

Una llamada no declarada aquí no se implementa.

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-4 | Identidad única de persona (H-4) | CA-11, CA-12 | por nombrar en el brief |
| U-5 | Escritura de resultados de terceros con origen y propuestas (H-5; depende de SDD universal CA-7 a CA-9) | CA-13, CA-14, CA-15, CA-16 | por nombrar en el brief |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Archivos: `src/lib/orchestrator/planner.ts` (añadir llaves requeridas por `Need`), `search.ts`, `runner.ts`, `src/lib/apollo.ts`, `src/lib/clay.ts` (`AccountDraft`, `StakeholderDraft`), `src/lib/leads-ingest.ts`, `src/lib/lead-qualification.ts` (`emailDomainOf`), `src/lib/autopilot.server.ts`, `src/components/account/stakeholders-tab.tsx`, `src/lib/discoveries.server.ts` (`knownCompetitors`).
- La regla de «llave mínima» como módulo puro con pruebas, consultado por pantallas, Agente y automatismos.
- Tablas: `accounts`, `people`, `stakeholders`, `leads`; nueva tabla de competidores o vista sobre posicionamiento (decide Fede tras la revisión técnica).
- **Uso de LLM:** cero para comprobar llaves y derivar dominio (reglas y normalización). LLM solo donde ya existe (investigación), con `effort:"low"`, y evitando llamadas cuando CA-16 aplica. El planificador ya prioriza coste cero/caché: mantener.

## 14. Riesgos y dependencias
- Tamaño: dividido en 7a (U-1, U-2), 7b (U-3 competidores, coordinado con Descubiertos) y 7c (U-4, U-5), por decisión de Fede (2026-10-25).
- Dueños: confirmar propuestas → SDD de acciones; no sobrescribir → SDD universal CA-9.
- Un lead con email personal sin cuenta queda «No enriquecible» hasta que se indique la empresa.
- Duplicados de personas: se avisa y se enlazan, nunca se fusionan (decidido por Fede, 2026-10-28; CA-12).
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
- **CA sin prueba posible o sin G-n:** los seis CA citan G-5, que es el G-n correcto (PRD:28). Ninguno tiene test: todos dicen «por nombrar en el brief» (SDD:58-65, 98-99). En CA-16, «fresco» no tiene umbral (SDD:65), así que no se puede probar. CA-13 a CA-15 no dicen en qué tablas aplican: `field_sources` solo existe en `accounts` (types.ts:253).
- **[Por verificar] que sigue sin comprobarse:** tres ya se pueden cerrar con el repo:
  - `people` y `stakeholders` no tienen FK entre sí (types.ts, relaciones de `stakeholders`; drizzle/migrations/0000_migration.sql:96-103).
  - Clay también exige dominio (clay.ts:81).
  - El modelo es Gemini, luego Claude, luego GPT (gemini.ts:16), y no «sin dato» (SDD:91).

  Siguen abiertos: base legal, datos enviados hoy a terceros y si `production` es igual que `main`.
- **Contradicciones con el código o con decisiones previas:**
  - CA-12 dice «proponer unirlos», pero AGENTS.md:23 dice «never merge».
  - Hallazgo 8 y §11 dan por hecho que se salta lo ya tenido, pero `alreadyHave` no lo pasa ningún llamador (planner.ts:39,52; runner.ts:43).
  - CA-13 y CA-14 ya existen para cuentas (provenance.ts:49, field-proposals.ts:20; src/lib/AGENTS.md:45,54) y §3 no lo dice.
  - El alcance mezcla 7a y 7b: «Incluye» trae llave mínima y competidores (SDD:39,43) y §8 cita CA-1/2/3/6/7, que no están en este SDD (están en 7a:58-66).
  - §14 dice «Fede decide» y §6 «a validar», pero el PRD ya lo decidió (PRD:46-47).
  - La cabecera omite la dependencia del SDD 2 (PRD:76).
  - Hallazgo 1 dice que el país se guarda sin normalizar, pero discoveries.functions.ts:46-49 ya lo guarda en ISO.
- **Lo que esta revisión NO demuestra:** no comprueba producción, la base de datos real, el comportamiento de los proveedores ni las ramas `production` o `main`; el repo revisado está en `feat/software-factory`. No he ejecutado tests.

## 18. Delta de implementación
Sin entrega todavía.

---
Validación: migrado a la plantilla de NOKKO el 2026-10-28. Revisión técnica: ver sección 17. `AUDIT-20261025.md` es el registro histórico anterior.
