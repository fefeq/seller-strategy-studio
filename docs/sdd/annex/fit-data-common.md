# Anexo común · Datos mínimos de encaje para enriquecer (partes 7a, 7b y 7c)

> Contexto compartido por los tres SDD `fit-data-7a`, `7b` y `7c`. Cada SDD conserva solo su alcance, delta, historias, casos límite y unidades. Los CA y H conservan la numeración del SDD original.

## Resumen
Auditoría de los «Datos para el encaje para investigar» de **Cuentas, Personas, Leads y Competidores**. Objetivo: que NOKKO recoja siempre la **información mínima de identidad** (la llave) de cada entidad, para que apps de terceros (hoy Apollo, Clay, Parallel, Firecrawl, Perplexity, Apify) devuelvan datos más valiosos y fieles, y que lo que devuelvan se guarde con su origen sin pisar lo escrito por la persona.


## Problema y para quién
- Founder: la investigación falla o es pobre porque falta una llave (p. ej. cuenta sin dominio).
- Equipo: cada entidad guarda su identidad de forma distinta, y los competidores no tienen entidad propia.

## Evidencia y por qué ahora
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

## Resultado buscado
- % de cuentas con llave mínima completa (fuente: base de datos). Línea base: sin dato.
- % de personas y leads vinculados a una cuenta con dominio. Línea base: sin dato.
- Número de competidores con dominio. Línea base: 0 por no existir la entidad.
- Tasa de éxito de peticiones de enriquecimiento por falta de llave (fuente: registro de trabajos). Línea base: sin dato.

## Llave mínima propuesta (a validar)
| Entidad | Llave mínima | Datos de encaje opcionales que mejoran el resultado |
|---|---|---|
| Cuenta | dominio normalizado (o LinkedIn de empresa) + nombre | país normalizado, sector, nº de empleados, ciudad |
| Persona | nombre + (cuenta con dominio) o LinkedIn de persona o email | cargo, nivel de seniority, país, rol de compra |
| Lead | persona + cuenta (ambas vinculadas) | origen, cargo, fecha de contacto |
| Competidor | nombre + dominio | país, segmento, alternativa que reemplaza |
Esta tabla es una propuesta de Fede; los datos que realmente exige cada proveedor externo son **[Por verificar]** (Apollo exige dominio para personas, según el código; Clay, Parallel, Lusha u otros: sin dato).


## Datos, permisos y privacidad
- Se guardan datos de empresas y de personas de negocio (nombre, cargo, email, teléfono, LinkedIn) que ya existen hoy; este SDD no añade categorías nuevas salvo ubicación y nombre/apellido.
- Los datos se envían a terceros solo con la llave mínima necesaria para cada necesidad, no la ficha entera. **[Por verificar]** qué se envía hoy.
- LinkedIn: solo API oficial; sin análisis ni puntuación de perfiles de LinkedIn.
- Base legal y proveedores de datos de contacto: **[Por verificar]**.
- Datos de ejemplo del SDD: ficticios (acme.com).

## Notas técnicas [Sugerencia — Dani valida]
- Archivos: `src/lib/orchestrator/planner.ts` (añadir llaves requeridas por `Need`), `search.ts`, `runner.ts`, `src/lib/apollo.ts`, `src/lib/clay.ts` (`AccountDraft`, `StakeholderDraft`), `src/lib/leads-ingest.ts`, `src/lib/lead-qualification.ts` (`emailDomainOf`), `src/lib/autopilot.server.ts`, `src/components/account/stakeholders-tab.tsx`, `src/lib/discoveries.server.ts` (`knownCompetitors`).
- La regla de «llave mínima» como módulo puro con pruebas, consultado por pantallas, Agente y automatismos.
- Tablas: `accounts`, `people`, `stakeholders`, `leads`; nueva tabla de competidores o vista sobre posicionamiento (decisión de Dani).
- **Uso de LLM:** cero para comprobar llaves y derivar dominio (reglas y normalización). LLM solo donde ya existe (investigación), con `effort:"low"`, y evitando llamadas cuando CA-16 aplica. El planificador ya prioriza coste cero/caché: mantener.

## Riesgos y dependencias
- División: este documento ya es una de las tres partes (7a, 7b, 7c). Los CA y H conservan la numeración original; las referencias a CA que no están aquí remiten a otra parte (7a: CA-1 a CA-7; 7b: CA-8 a CA-10 y CA-17 a CA-21; 7c: CA-11 a CA-16).
- Dueños: confirmar propuestas → SDD de acciones; no sobrescribir → SDD universal CA-9.
- Un lead con email personal sin cuenta queda «No enriquecible» hasta que se indique la empresa.
- Fusión de personas: riesgo de unir a dos personas distintas (CA-12 exige confirmación).
- Migración de competidores desde texto: extracción imperfecta; mitigación: propuesta a confirmar por el usuario.
- Dependencia del SDD universal (origen y normalización) y del de acciones sobre campos (confirmar/editar).

## Preguntas para Dani
1. ¿Se relacionan hoy `people` y `stakeholders`? ¿Se pueden unificar o basta con un vínculo?
2. ¿Qué llaves exige realmente cada proveedor conectado?
3. ¿Qué datos de la ficha se envían hoy a cada tercero?
4. ¿Competidores como tabla nueva o dentro del posicionamiento?

## Pendiente de verificar
- [Por verificar] Requisitos de entrada de Clay, Parallel y otros proveedores.
- [Por verificar] Relación entre `people` y `stakeholders`.
- [Por verificar] Datos enviados hoy a terceros.
- [Por verificar] Porcentaje de registros sin llave (sin dato).
- [Por verificar] Base legal de datos de contacto.
- [Por verificar] Que `production` coincide con `main`.
