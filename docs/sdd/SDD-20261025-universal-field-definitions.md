# SDD-20261025-universal-field-definitions · [Feature] Definiciones universales de campos

**Tipo:** Feature · **Prioridad propuesta:** Alta (base de los demás SDD de la iniciativa)
**Estado:** En curso (Aprobado por Fede, 2026-10-25; U-1 a U-4 hechas; migración 0058 sin verificar) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-25
**PRD:** docs/prd/PRD-20261028-ux-onboarding-coherencia.md (cubre G-1) · **Depende de:** —

## 1. Resumen
Cada concepto de la plataforma (tamaño de empresa, país, importe, periodo, origen del dato, estado…) debe tener **una sola definición** que valga para todas las pantallas, el Agente, las importaciones y Descubiertos. Hoy el mismo concepto existe con nombres y tipos distintos según la tabla o la pantalla. Este SDD fija el catálogo, las reglas de persistencia y el origen/confirmación de cada valor. Es la base de los SDD de acciones sobre campos, onboarding y guía de estrategia.

## 2. Problema y para quién
- **Founder (usuario de NOKKO):** corrige un dato en una pantalla y lo ve distinto en otra; no sabe si un valor es suyo, deducido o supuesto.
- **Equipo de producto (Fede):** cada decisión nueva ("qué es un ICP completo", "qué es tamaño") se define de nuevo para cada campo, pantalla o función.

## 3. Evidencia y por qué ahora
Fuente: inventario determinista generado desde el esquema de datos del repo (`docs/sdd/annex/field-inventory-20261025.md`, 2026-10-25):
- 84 tablas, 1043 columnas, 35 columnas de estructura libre (jsonb), 48 columnas de texto que hacen de estado/etapa/tipo/rol/origen.
- Conceptos repetidos por nombre: Tamaño (4 variantes, 2 tipos de dato), País/geografía (4 variantes, 2 tipos), Importe (13 variantes), Periodo (6 variantes, 2 tipos), Origen (11 variantes, 3 tipos).
- En el código existen varias definiciones de "ICP completo" y campos duplicados en posicionamiento (ver SDD de onboarding y de acciones sobre campos).
- Límite del análisis: el agrupamiento es **por nombre de columna**, no por significado. Que dos columnas con el mismo nombre sean el mismo concepto es **[Por verificar]** en la revisión técnica.
- Ahora porque cinco peticiones pendientes (edición, guía, Drive, onboarding, Descubiertos) tocan campos; sin base común cada una añadirá su propia definición.

**Apuesta declarada:** no hay datos de uso; la prioridad se apoya en el código de `main` y en la petición de Fede. Se medirá tras el lanzamiento con las métricas de la sección 4.

## 4. Resultado buscado
- Cada concepto del catálogo tiene un único propietario de definición; número de variantes duplicadas por concepto tras la migración = 0 (medido con el mismo script de inventario sobre el esquema).
- Cualquier campo nuevo sin entrada en el catálogo hace fallar la comprobación automática (fuente: pipeline de pruebas del repo).
- Línea base actual: ver anexo; objetivo de reducción por concepto lo fija Fede en la revisión (sin dato de objetivo todavía).
Cubre el objetivo G-1 del PRD.

## 5. Alcance
**Incluye:**
- Catálogo de conceptos con: nombre, significado, tipo de valor, valores permitidos, unidad, cómo se muestra, quién puede editarlo.
- Clase de persistencia por campo: guardado permanente / borrador de pantalla / sesión / acción pendiente del Agente / memoria.
- Estado de origen y confirmación por valor, común a todo: escrito por la persona, leído de una fuente, deducido por IA, supuesto; confirmado o no.
- Reglas únicas de normalización y validación (país, tamaño, importe, periodo).
- Comprobación automática de coherencia.
- Regla única de «completo» por objeto (empresa, ICP, posicionamiento); la consumen los SDD de guía y onboarding.
- Conceptos iniciales (decidido por Fede), en orden: Origen, País, Tamaño, Importe.

**No incluye:**
- Renombrar o migrar de golpe las 84 tablas: se hace por conceptos, en orden de impacto.
- Cambios visuales en pantallas (los cubren los otros SDD).
- Definir métricas de negocio o precios.

## 6. Cambios de comportamiento (delta)
**Añadido:** catálogo de conceptos; clase de persistencia visible por campo; estado de confirmación universal; comprobación de coherencia.
**Modificado:** los campos que representan el mismo concepto pasan a validarse y mostrarse igual (antes: reglas distintas por pantalla/función).
**Eliminado:** definiciones duplicadas de "completo" para el mismo objeto (ICP, posicionamiento, empresa).

## 7. Historias y criterios de aceptación
### H-1: Como founder, quiero que un mismo concepto signifique y se vea igual en toda la plataforma, para no corregir lo mismo dos veces.
- CA-1: El sistema DEBE tener una definición única por concepto del catálogo, usada por pantallas, Agente, importaciones y Descubiertos. · cubre G-1 · prueba: `src/lib/field-catalog.test.ts`, `src/lib/field-normalize.test.ts`
- CA-2: CUANDO edito un valor de un concepto en una pantalla, el sistema DEBE mostrar el mismo valor en el resto de pantallas donde aparece ese concepto. · cubre G-1 · prueba: por nombrar en el brief
- CA-3: SI dos pantallas aceptan formatos distintos para el mismo concepto, ENTONCES el sistema DEBE normalizarlos a la definición única al guardar. · cubre G-1 · prueba: `src/lib/field-normalize.test.ts`

### H-2: Como founder, quiero saber si lo que escribo queda guardado, para no perder trabajo.
- CA-4: El sistema DEBE asignar a cada campo editable una clase de persistencia declarada en el catálogo. · cubre G-1 · prueba: `src/lib/field-catalog.test.ts`
- CA-5: MIENTRAS un campo editable sea solo borrador de pantalla, el sistema DEBE avisarme antes de abandonar la pantalla con cambios sin guardar. · cubre G-1 · prueba: por nombrar en el brief
- CA-6: SI un guardado falla, ENTONCES el sistema DEBE conservar mi valor en pantalla y mostrar el error con la opción de reintentar. · cubre G-1 · prueba: por nombrar en el brief

### H-3: Como founder, quiero ver de dónde viene cada dato y si está confirmado.
- CA-7: El sistema DEBE guardar para cada valor del catálogo su origen (persona, fuente leída, IA deducido, supuesto) y su estado de confirmación. · cubre G-1 · prueba: `src/lib/provenance.test.ts`
- CA-8: CUANDO una persona edita un valor, el sistema DEBE marcarlo como escrito por la persona y confirmado, y NINGÚN proceso automático DEBE sobrescribirlo después. · cubre G-1 · prueba: `src/lib/provenance.test.ts`
- CA-9: CUANDO un proceso automático propone un valor distinto sobre uno escrito por la persona, el sistema DEBE guardarlo como propuesta pendiente sin reemplazar el valor. · cubre G-1 · prueba: `src/lib/field-proposals.test.ts`, `src/lib/provenance.test.ts`

### H-4: Como equipo de producto, quiero que una definición nueva nazca universal.
- CA-10: SI se añade un campo que no está en el catálogo, ENTONCES la comprobación automática DEBE fallar e indicar qué concepto debe asignarse o crearse. · cubre G-1 · prueba: `src/lib/field-coverage.test.ts`
- CA-11: El sistema DEBE permitir listar, para cualquier concepto, todos los lugares donde se guarda o se muestra. · cubre G-1 · prueba: `src/lib/field-coverage.test.ts`

## 8. Casos límite y errores
- Concepto con dos significados reales (p. ej. "periodo" mensual vs trimestral): CA-3 aplica solo si Fede decide que son el mismo; si no, se crean dos conceptos con nombre distinto (CA-1).
- Valores históricos que no encajan en la definición: el sistema DEBE conservarlos marcados "sin normalizar" y no borrarlos (CA-7).
- Estructuras libres (jsonb) sin forma conocida: el sistema DEBE listarlas como pendientes de catalogar (CA-11), sin bloquear.
- Permisos: solo roles autorizados editan la definición de un concepto; el resto solo valores según su rol.

## 9. Experiencia y copy
Sin pantallas nuevas en este SDD. Los textos de estado (Confirmado / Deducido / Supuesto / Borrador) se reutilizan de Onboarding; todo en «tú», sin iconos, estado con palabra (convención del diseño actual del repo).

## 10. Datos, permisos y privacidad
- Se leen y guardan metadatos de origen y confirmación por valor; no se añaden datos personales nuevos.
- El catálogo no contiene datos de clientes.
- Aplica a todas las empresas con su aislamiento actual.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Ninguna declarada en el SDD. [Por verificar] | sin dato | sin dato | sin dato |

El SDD solo menciona «deducido por IA» como valor de origen del dato (CA-7), no una llamada. Una llamada no declarada aquí no se implementa.

## 12. Unidades de trabajo
| U | Qué entrega | Cubre | CA que cierra | Test que falla primero |
|---|---|---|---|---|
| U-1 | Catálogo de conceptos y clases de persistencia. Requiere decisiones de Fede sobre clústeres ambiguos. | H-1, H-2 | CA-1 a CA-6 | por nombrar en el brief |
| U-2 | Normalización y validación únicas de país, tamaño, importe, periodo (depende de U-1). | H-1 | CA-1 a CA-3 | por nombrar en el brief |
| U-3 | Origen y confirmación universal por valor (depende de U-1). | H-3 | CA-7 a CA-9 | por nombrar en el brief |
| U-4 | Comprobación de coherencia automática (depende de U-1). | H-4 | CA-10, CA-11 | por nombrar en el brief |

La columna «CA que cierra» se deriva de las historias que cubre cada unidad.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Punto de partida: `docs/sdd/annex/field-inventory-20261025.md` (script reproducible, lee `src/integrations/supabase/types.ts`).
- Ya existe base de procedencia: `accounts.field_sources`, `src/lib/provenance.ts` y un disparador de BD que retira la marca al editar una persona; conviene generalizarlo, no reinventarlo.
- Mantener el patrón de módulos de reglas puros con pruebas.
- Un registro de conceptos como módulo en `src/lib/` y una prueba que cruce tipos generados contra el registro.

## 14. Riesgos y dependencias
- Riesgo: migrar tipos en tablas con datos (Tamaño y Periodo con tipos distintos). Mitigación: por conceptos y con conservación del valor original.
- Dependencia: decisiones de Fede (sección 15) antes de U-1.
- Es prerrequisito de los demás SDD de la iniciativa (ver PRD, sección 8).

## 15. Preguntas para Fede y para la revisión técnica
1. ¿Qué clústeres del anexo son el mismo concepto y cuáles solo comparten nombre?
2. ¿Qué columnas de estado en texto libre deberían ser valores cerrados?
3. ¿Qué estructuras libres (jsonb) tienen forma estable y cuáles no?

## 16. Pendiente de verificar
- [Decidido por Fede 2026-10-25, solo para Origen, País, Tamaño e Importe] Equivalencia de significado entre columnas agrupadas por nombre: ver `annex/concept-catalog-proposal-20261025.md`. El resto de clústeres del anexo sigue [Por verificar] en la revisión técnica.
- [Verificado 2026-10-25 en el repo] El disparador de procedencia solo cubre `accounts` y cinco campos: `industry`, `size`, `country`, `notes`, `linkedin_url` (`drizzle/migrations/0046_field_sources_auto_enrich.sql`). `field_sources` solo existe en `accounts`; `people`, `leads`, `icp_profiles` y `positioning` no tienen procedencia. Hay que generalizarlo (U-3).
- [Por verificar] Volumen de datos reales por columna a migrar (sin dato).

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Un agente `nokko-gate` con contexto fresco lee este SDD y el código, y devuelve su informe. El coordinador lo copia aquí sin editarlo. El gate no aprueba el SDD: informa; la aprobación es de Fede.
Informe del gate recibido el 2026-10-28, copiado sin editar. El veredicto no aprueba el SDD: la aprobación es de Fede.
- **Veredicto del gate:** Objeciones
- **CA sin prueba posible o sin G-n:**
  - CA-2, CA-5 y CA-6 no tienen ninguna prueba (SDD:53, 58, 59), pero U-1 los da por cerrados (SDD:94).
  - En §12 la columna «Test que falla primero» pone «por nombrar» (SDD:94-97), aunque §7 sí nombra pruebas.
  - CA-1 pide que pantallas, Agente, importaciones y Descubiertos usen la definición única. Sus pruebas solo comprueban la estructura del catálogo y `normalizeForSave` (field-catalog.test.ts:19-38, field-normalize.test.ts:66). No comprueban que esos sitios la usen.
  - CA-11 lee `SHOWN_IN`, que es una lista escrita a mano. Su prueba solo mira que los archivos existan (field-coverage.test.ts:68). No demuestra que la lista esté completa.
  - CA-5 y CA-6 (aviso de cambios sin guardar y reintento) no miden «una sola definición», que es lo que pide G-1 (PRD:24).
- **[Por verificar] que sigue sin comprobarse:**
  - La migración 0058 está en el journal (_journal.json:415) pero sin verificar (0058:1).
  - El volumen de datos por columna (SDD:120).
  - La fila de §11 (SDD:87) ya se puede cerrar: field-*.ts y provenance.ts no llaman a ninguna IA (comprobado con grep).
- **Contradicciones con el código o con decisiones previas:**
  - El Agente escribe `accounts.size`/`country` sin normalizar (agent/tools/accounts.ts:87, 100).
  - Apollo inserta `size`/`country` sin normalizar (apollo.tsx:74).
  - Ambos contradicen CA-1 y src/lib/AGENTS.md:53.
  - Habla de «otros cinco SDD» (SDD:3, 110). El PRD lista 11 más (PRD:68-79).
  - Mete «periodo» en el alcance y en U-2 (SDD:35, 95). El delta dice que periodo no se normalizó (SDD:131).
  - Dice que «Borrador» se reutiliza de Onboarding (SDD:77). Onboarding solo tiene Confirmado, Deducido y Supuesto (onboarding.ts:25).
  - Pone U-3 como hecha (SDD:4). src/lib/AGENTS.md:54 dice «U-3, partial».
- **Lo que esta revisión NO demuestra:**
  - No he ejecutado las pruebas, ni comprobado que fallen sobre el commit base.
  - No he aplicado 0058 ni revisado la seguridad por empresa (RLS).
  - No he revisado todos los sitios que escriben campos del catálogo.

## 18. Delta de implementación (agente, 2026-10-25)
- U-1 y U-2 entregadas como en el SDD, con periodo sin normalizar (no está en los cuatro conceptos decididos).
- U-3. Hecho: reglas puras de origen y confirmación, sello de persona en la ficha de cuenta, regla única de escritura automática. Escrita pero **no verificada ni aplicada**: `drizzle/migrations/0058_field_sources_generic.sql` (trigger genérico para `accounts` e `icp_profiles`; lista de comprobaciones en su cabecera). Propuestas pendientes (CA-9) como sugerencias `field_proposal` (decisión de Fede): `src/lib/field-proposals.ts`, creadas por `applyAutoChanges` para sector, tamaño y país, nunca para notas. Alcance de procedencia: `accounts` e `icp_profiles` (decisión de Fede). Falta verificar la migración y que aceptar una propuesta desde Sugerencias deje la marca de persona (depende de si la acción corre con la sesión de la persona).
- U-4 hecha. `src/lib/field-coverage.ts` y `field-coverage.test.ts`: toda columna de `types.ts` está en el catálogo o en `src/lib/field-baseline.ts` (980 columnas aún sin concepto, solo puede bajar); una columna nueva en ninguno de los dos falla y dice qué concepto asignar o crear (CA-10). `placesOf` lista dónde se guarda y dónde se muestra cada concepto (CA-11). Los jsonb se listan como pendientes sin fallar. Pendiente fuera de U-4: catalogar las 980 columnas (por conceptos, en orden de impacto) y, tras aplicar 0058 y regenerar tipos, añadir `icp_profiles.field_sources` al catálogo.

---
Validación: migrado a la plantilla de NOKKO el 2026-10-28. Revisión técnica: ver sección 17. `AUDIT-20261025.md` es el registro histórico anterior.
