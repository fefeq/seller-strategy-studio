# SDD-20261025-universal-field-definitions · [Feature] Definiciones universales de campos

**Tipo:** Feature · **Prioridad propuesta:** Alta (base de los otros cinco SDD)
**Estado:** Borrador · **Pide:** Fede · **Para:** Dani · **Fecha:** 2026-10-25

## 1. Resumen
Cada concepto de la plataforma (tamaño de empresa, país, importe, periodo, origen del dato, estado…) debe tener **una sola definición** que valga para todas las pantallas, el Agente, las importaciones y Descubiertos. Hoy el mismo concepto existe con nombres y tipos distintos según la tabla o la pantalla. Este SDD fija el catálogo, las reglas de persistencia y el origen/confirmación de cada valor. Es la base de los SDD de acciones sobre campos, onboarding y guía de estrategia.

## 2. Problema y para quién
- **Founder (usuario de NOKKO):** corrige un dato en una pantalla y lo ve distinto en otra; no sabe si un valor es suyo, deducido o supuesto.
- **Equipo de producto (Fede, Dani):** cada decisión nueva ("qué es un ICP completo", "qué es tamaño") se define de nuevo para cada campo, pantalla o función.

## 3. Evidencia y por qué ahora
Fuente: inventario determinista generado desde el esquema de datos del repo (`docs/sdd/annex/field-inventory-20261025.md`, 2026-10-25):
- 84 tablas, 1043 columnas, 35 columnas de estructura libre (jsonb), 48 columnas de texto que hacen de estado/etapa/tipo/rol/origen.
- Conceptos repetidos por nombre: Tamaño (4 variantes, 2 tipos de dato), País/geografía (4 variantes, 2 tipos), Importe (13 variantes), Periodo (6 variantes, 2 tipos), Origen (11 variantes, 3 tipos).
- En el código existen varias definiciones de "ICP completo" y campos duplicados en posicionamiento (ver SDD de onboarding y de acciones sobre campos).
- Límite del análisis: el agrupamiento es **por nombre de columna**, no por significado. Que dos columnas con el mismo nombre sean el mismo concepto es **[Por verificar]** con Dani.
- Ahora porque cinco peticiones pendientes (edición, guía, Drive, onboarding, Descubiertos) tocan campos; sin base común cada una añadirá su propia definición.

**Apuesta declarada:** no hay datos de uso; la prioridad se apoya en el código de `main` y en la petición de Fede. Se medirá tras el lanzamiento con las métricas de la sección 4.

## 4. Resultado buscado
- Cada concepto del catálogo tiene un único propietario de definición; número de variantes duplicadas por concepto tras la migración = 0 (medido con el mismo script de inventario sobre el esquema).
- Cualquier campo nuevo sin entrada en el catálogo hace fallar la comprobación automática (fuente: pipeline de pruebas del repo).
- Línea base actual: ver anexo; objetivo de reducción por concepto lo fija Fede en la revisión (sin dato de objetivo todavía).

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
- CA-1: El sistema DEBE tener una definición única por concepto del catálogo, usada por pantallas, Agente, importaciones y Descubiertos.
- CA-2: CUANDO edito un valor de un concepto en una pantalla, el sistema DEBE mostrar el mismo valor en el resto de pantallas donde aparece ese concepto.
- CA-3: SI dos pantallas aceptan formatos distintos para el mismo concepto, ENTONCES el sistema DEBE normalizarlos a la definición única al guardar.

### H-2: Como founder, quiero saber si lo que escribo queda guardado, para no perder trabajo.
- CA-4: El sistema DEBE asignar a cada campo editable una clase de persistencia declarada en el catálogo.
- CA-5: MIENTRAS un campo editable sea solo borrador de pantalla, el sistema DEBE avisarme antes de abandonar la pantalla con cambios sin guardar.
- CA-6: SI un guardado falla, ENTONCES el sistema DEBE conservar mi valor en pantalla y mostrar el error con la opción de reintentar.

### H-3: Como founder, quiero ver de dónde viene cada dato y si está confirmado.
- CA-7: El sistema DEBE guardar para cada valor del catálogo su origen (persona, fuente leída, IA deducido, supuesto) y su estado de confirmación.
- CA-8: CUANDO una persona edita un valor, el sistema DEBE marcarlo como escrito por la persona y confirmado, y NINGÚN proceso automático DEBE sobrescribirlo después.
- CA-9: CUANDO un proceso automático propone un valor distinto sobre uno escrito por la persona, el sistema DEBE guardarlo como propuesta pendiente sin reemplazar el valor.

### H-4: Como equipo de producto, quiero que una definición nueva nazca universal.
- CA-10: SI se añade un campo que no está en el catálogo, ENTONCES la comprobación automática DEBE fallar e indicar qué concepto debe asignarse o crearse.
- CA-11: El sistema DEBE permitir listar, para cualquier concepto, todos los lugares donde se guarda o se muestra.

## 8. Casos límite y errores
- Concepto con dos significados reales (p. ej. "periodo" mensual vs trimestral): CA-3 aplica solo si Fede/Dani deciden que son el mismo; si no, se crean dos conceptos con nombre distinto (CA-1).
- Valores históricos que no encajan en la definición: el sistema DEBE conservarlos marcados "sin normalizar" y no borrarlos (CA-7).
- Estructuras libres (jsonb) sin forma conocida: el sistema DEBE listarlas como pendientes de catalogar (CA-11), sin bloquear.
- Permisos: solo roles autorizados editan la definición de un concepto; el resto solo valores según su rol.

## 9. Experiencia y copy
Sin pantallas nuevas en este SDD. Los textos de estado (Confirmado / Deducido / Supuesto / Borrador) se reutilizan de Onboarding; todo en «tú», sin iconos, estado con palabra (convención del diseño actual del repo).

## 10. Datos, permisos y privacidad
- Se leen y guardan metadatos de origen y confirmación por valor; no se añaden datos personales nuevos.
- El catálogo no contiene datos de clientes.
- Aplica a todas las empresas con su aislamiento actual.

## 11. Unidades de trabajo
- U-1: Catálogo de conceptos y clases de persistencia (cubre H-1, H-2). Requiere decisiones de Fede sobre clústeres ambiguos.
- U-2: Normalización y validación únicas de país, tamaño, importe, periodo (cubre H-1; depende de U-1).
- U-3: Origen y confirmación universal por valor (cubre H-3; depende de U-1).
- U-4: Comprobación de coherencia automática (cubre H-4; depende de U-1).

## 12. Notas técnicas [Sugerencia — Dani valida]
- Punto de partida: `docs/sdd/annex/field-inventory-20261025.md` (script reproducible, lee `src/integrations/supabase/types.ts`).
- Ya existe base de procedencia: `accounts.field_sources`, `src/lib/provenance.ts` y un disparador de BD que retira la marca al editar una persona; conviene generalizarlo, no reinventarlo.
- Mantener el patrón de módulos de reglas puros con pruebas.
- Un registro de conceptos como módulo en `src/lib/` y una prueba que cruce tipos generados contra el registro.

## 13. Riesgos y dependencias
- Riesgo: migrar tipos en tablas con datos (Tamaño y Periodo con tipos distintos). Mitigación: por conceptos y con conservación del valor original.
- Dependencia: decisiones de Fede (sección 14) antes de U-1.
- Es prerrequisito de los otros cinco SDD (ver README).

## 14. Preguntas para Dani
1. ¿Qué clústeres del anexo son el mismo concepto y cuáles solo comparten nombre?
2. ¿Qué columnas de estado en texto libre deberían ser valores cerrados?
3. ¿Qué estructuras libres (jsonb) tienen forma estable y cuáles no?

## 15. Pendiente de verificar
- [Por verificar] Equivalencia de significado entre columnas agrupadas por nombre.
- [Por verificar] Si el disparador de procedencia actual cubre todas las tablas o solo cuentas.
- [Por verificar] Volumen de datos reales por columna a migrar (sin dato).

## 16. Sección de Dani (la completa él)
- Diseño técnico:
- Tareas:
- Estimación:
- Decisión: Aceptado / Cambios pedidos / Rechazado

---
Validación: OK (autorrevisión). Auditoría: ver AUDIT-20261025.md (bloqueado hasta cerrar decisiones de Fede).
