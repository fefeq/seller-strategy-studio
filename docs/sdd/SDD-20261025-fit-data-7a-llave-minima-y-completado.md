# SDD-20261025-fit-data-7a-llave-minima-y-completado · [Feature] Llave mínima y completado asistido (parte a de 3 de «Datos mínimos de encaje»)

**Tipo:** Feature · **Prioridad propuesta:** Alta
**Estado:** SUPERADO por SDD-20261101-fit-data-7a-llave-minima-revalidado (NK-0012 SHIPPED); no ejecutar este texto · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-25
**PRD:** docs/prd/PRD-20261028-ux-onboarding-coherencia.md (cubre G-5) · **Depende de:** SDD-20261025-universal-field-definitions, SDD-20261025-field-actions-edit-delete-confirm

## 1. Resumen
Auditoría de los «Datos para el encaje para investigar» de **Cuentas, Personas, Leads y Competidores**. Objetivo: que NOKKO recoja siempre la **información mínima de identidad** (la llave) de cada entidad, para que apps de terceros (hoy Apollo, Clay, Parallel, Firecrawl, Perplexity, Apify) devuelvan datos más valiosos y fieles, y que lo que devuelvan se guarde con su origen sin pisar lo escrito por la persona.

> Este documento es la parte 7a de la división decidida por Fede del SDD «Datos mínimos de encaje». Los identificadores CA y H conservan la numeración original para trazabilidad. Las otras partes: 7b y 7c.

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
### H-1: Como founder, quiero saber qué falta para que NOKKO investigue una cuenta, persona, lead o competidor.
- CA-1: El sistema DEBE definir, para cada entidad, su llave mínima y comprobarla antes de lanzar un enriquecimiento · cubre G-5 · prueba: por nombrar en el brief
- CA-2: SI falta una llave, ENTONCES el sistema DEBE decir cuál falta, por qué se necesita y ofrecerme completarla o proponerla · cubre G-5 · prueba: por nombrar en el brief
- CA-3: CUANDO una necesidad de enriquecimiento se lanza desde pantalla, Agente o automático, el sistema DEBE aplicar la misma comprobación · cubre G-5 · prueba: por nombrar en el brief

### H-2: Como founder, quiero que NOKKO complete la llave por mí cuando pueda.
- CA-4: CUANDO una cuenta no tiene dominio pero sí URL web o email corporativo, el sistema DEBE proponer el dominio normalizado · cubre G-5 · prueba: por nombrar en el brief
- CA-5: CUANDO un lead tiene email corporativo y no cuenta vinculada, el sistema DEBE proponer vincularlo a una cuenta existente por dominio o crear una · cubre G-5 · prueba: por nombrar en el brief
- CA-6: SI el email es personal (gmail, outlook u otros), ENTONCES el sistema NO DEBE derivar dominio de empresa y DEBE pedir el nombre de la empresa · cubre G-5 · prueba: por nombrar en el brief
- CA-7: CUANDO una persona se guarda con nombre completo, el sistema DEBE conservar el nombre completo tal cual y permitir nombre y apellido por separado · cubre G-5 · prueba: por nombrar en el brief

## 8. Casos límite y errores
- Dominio ya existente en otra cuenta: avisar del duplicado y enlazar ambos registros, nunca fusionar (CA-1).
- Dominio de proveedor gratuito de correo en una cuenta: rechazar como dominio de empresa (CA-6).
- Competidor sin dominio conocido: permitir guardarlo como incompleto y marcarlo «No enriquecible» (CA-2).
- Tercero devuelve valores vacíos o contradictorios: no sobrescribir; registrar el intento (CA-14 y CA-15, en 7c).
- Presupuesto agotado: aplicar regla existente (pausa al 100 %, fuente: código del repo) y avisar (CA-3).
- Persona con un solo nombre: aceptar y marcar apellido ausente (CA-7).
- Registros históricos sin llave: listarlos como «Faltan datos» sin bloquear su uso (CA-2).
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
| U-1 | Definición y comprobación de llave mínima por entidad (H-1; requiere SDD universal) | CA-1, CA-2, CA-3 | por nombrar en el brief |
| U-2 | Completado asistido de llaves (H-2) | CA-4, CA-5, CA-6, CA-7 | por nombrar en el brief |

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
- **CA sin prueba posible o sin G-n:** los 7 CA citan G-5, que es correcto (PRD:28), pero ninguno nombra un test: todos dicen «prueba: por nombrar en el brief» (SDD:58-66, 99-100). La plantilla exige un archivo (sdd.md:33). CA-1 («DEBE definir») no es observable. Además, §8 y §11 citan CA-12, CA-14, CA-15 y CA-16, que no existen en este SDD (SDD:72, 92, 106, 112).
- **[Por verificar] que sigue sin comprobarse:** «relación people–stakeholders» (SDD:21, 124) ya se puede comprobar en el repo. No hay ninguna FK entre las dos tablas (types.ts: `person_id` apunta solo a `people`, líneas 407, 841 y 2904). «Modelo [Por verificar]» (SDD:92) también se puede comprobar: está en `aiProviders()` (AGENTS.md:38).
- **Contradicciones:**
  - Dependencias: el SDD dice que depende solo del universal (SDD:5), pero el PRD dice «1, 2» (PRD:74) y el propio §14 también cita el de acciones (SDD:114).
  - La llave mínima figura como «a validar» y el tamaño como «Fede decide» (SDD:47, 54, 109), pero ambas cosas ya están decididas: «Validada tal cual» y «Dividido» (PRD:46-47).
  - «Las otras partes: 7a, 7b y 7c» (SDD:10): las otras partes son solo 7b y 7c.
  - El alcance y el delta incluyen la entidad de competidor, el vínculo entre personas y los resultados de terceros (SDD:39, 43-45), pero las unidades solo cubren U-1 y U-2 (SDD:99-100).
  - CA-4 y CA-5 dicen «proponer», pero hoy el flujo de leads crea la cuenta y escribe el dominio sin preguntar (lead-tasks.server.ts:47, 59). El SDD no lo declara como cambio.
  - El email personal ya se detecta en dos listas distintas (leads.ts:45 vs lead-qualification.ts:28), y el SDD solo cita `emailDomainOf`.
  - Lusha aparece en SDD:54 pero no en la lista de SDD:8.
- **Comprobado y cierto:** accounts tiene 22 columnas y leads 34; el error de Apollo (apollo.ts:25), autopilot.test.ts:8-11, `AccountDraft`/`StakeholderDraft` (clay.ts:31-33), la pausa al 100 % (planner.ts:49, 62-66) y `effort: "low"` (web-research-core.ts:59).
- **Lo que esta revisión NO demuestra:** qué exige cada proveedor externo, qué datos se envían hoy a terceros, si production coincide con main, cuántos registros reales no tienen llave, ni la base legal. No he ejecutado ningún test.

## 18. Delta de implementación
Sin entrega todavía.

---
Validación: migrado a la plantilla de NOKKO el 2026-10-28. Revisión técnica: ver sección 17. `AUDIT-20261025.md` es el registro histórico anterior.
