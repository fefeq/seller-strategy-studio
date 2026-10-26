# Propuesta de catálogo · Origen, País, Tamaño, Importe (borrador para revisión de Fede)

Estado: aprobado por Fede el 2026-10-25 (las cinco recomendaciones del apartado 6, tal cual). Implementado en `src/lib/field-catalog.ts` (U-1). Base: SDD universal-field-definitions (U-1). Rama `feat/universal-field-definitions`, código de esa rama (derivada de `main`). Lo que no he podido comprobar está en el apartado «Límites».

Lectura rápida: el anexo agrupa por nombre y el nombre engaña. Las cuatro etiquetas esconden más de un concepto. La propuesta separa lo que significa distinto y unifica lo que significa lo mismo.

## 1. País

| Concepto | Significado | Tipo | Formato canónico | Dónde está hoy |
|---|---|---|---|---|
| `pais` | Dónde está una cuenta, una regla o un criterio | texto, nulo permitido | ISO 3166-1 alpha-2 en mayúsculas («ES», «GB») | `accounts.country`, `account_assignment_rules.country` |
| `paises` | Lista de `pais` | lista de texto | cada elemento con el formato de `pais`, sin repetidos | `icp_profiles.countries` |
| `region` | Agrupación derivada de `pais` | valor cerrado | `es`, `latam`, `us`, `europe`, `other` (ya definido en `src/lib/assignment.ts`) | derivada; solo se guarda como criterio de regla (`account_assignment_rules.region`) |
| `geografia_texto` | Zona descrita en palabras («DACH, mid-market») | texto libre | sin formato; solo apoyo cuando no hay `paises` | `icp_profiles.geography` |

Por qué:
- `accounts.country` y las reglas ya usan ISO2 (`CountryPick`, `COUNTRY_CODES`, `countryName`). Es el patrón dominante.
- `icp.ts` descarta en silencio cualquier valor de `countries` que no cumpla `^[A-Z]{2}$`. Un valor mal escrito no da error: desaparece de la búsqueda.
- `geography` es prosa y `icpToQuery` la interpreta como respaldo. No es el mismo concepto que `paises`: queda aparte y se marca como «descriptivo».

Normalización al guardar: recortar espacios, pasar a mayúsculas; si llega un nombre de país que coincide exactamente con el nombre español o inglés de un código, convertirlo; si no coincide, conservar el valor original marcado «sin normalizar» y no guardarlo como `pais`.

## 2. Tamaño

| Concepto | Significado | Tipo | Formato canónico | Dónde está hoy |
|---|---|---|---|---|
| `tamano_empleados` | Número de empleados de una empresa o de la empresa objetivo | rango de dos enteros `min`, `max`, ambos opcionales | enteros > 0; una cifra exacta = `min` igual a `max`; se muestra con `employeesText` («51–200 empleados», «más de 500 empleados») | `icp_profiles.min_employees` / `max_employees`; `accounts.size` (texto, se interpreta) |
| `tamano_descripcion` | Tamaño en palabras: facturación, etapa, «scale-up» | texto libre | sin formato | `icp_profiles.company_size` |

Por qué:
- El editor del ICP define `company_size` como «Tamaño en palabras (facturación, etapa)» y solo lo usa «si no fijas empleados». No es empleados: es una descripción. Por eso no se unifica con el rango.
- `accounts.size` recibe tres formatos: Apollo escribe «123 empleados» (cifra estimada), Clay escribe «51-200 empleados» (banda) y las personas escriben texto libre. Los tres se pueden leer como rango con la regla que ya existe en `clay.ts` / `icp.ts`.
- La facturación que devuelve Clay (`revenue`, en USD) hoy no se guarda. No entra en el catálogo.

Normalización: derivar `min`/`max` del texto con una función pura y probada; guardar el texto original. En U-2 no cambio el tipo de `accounts.size` ni migro datos: la lectura normalizada es derivada.

## 3. Importe

Todas las columnas son `numeric`. Lo que cambia es qué mide cada una. Propongo un solo concepto `importe` (número en la moneda de la empresa) con dos atributos obligatorios por columna: `naturaleza` y `periodicidad`. Regla: nunca se suma ni se compara entre naturalezas distintas.

| Columna | Naturaleza | Periodicidad | Nota del código |
|---|---|---|---|
| `deals.amount` | valor anual recurrente (ACV) | anual | con líneas, lo calcula el disparador `deal_lines_sync` (`deal-lines.ts`) |
| `deals.one_off_amount` | pago único | puntual | fuera del ACV |
| `leads.amount` | valor estimado del lead | sin dato | [Por verificar] si es ACV anual |
| `segment_targets.amount` | objetivo | trimestral (`^\d{4}-Q[1-4]$`) | CHECK ≥ 0 |
| `quotas.amount` | cuota por persona | [Por verificar] formato de `period` | |
| `cac_costs.amount` | coste de adquisición real | trimestral | CHECK ≥ 0 |
| `finance_cost_lines.amount` | coste recurrente | mensual (fechas inicio/fin) | |
| `finance_invoices.amount` | factura emitida | puntual | [Por verificar] si admite abonos negativos |
| `segment_budget_quarters.plan_revenue` / `actual_revenue` | ingreso plan / real | trimestral | |

Formato: número con dos decimales como máximo, mostrado con `formatMoney` y la moneda de la empresa (`useCurrency()`). Cambiar la moneda reetiqueta, no convierte (regla de `AGENTS.md`). `segment_budgets.*` está en desuso: queda fuera.

Importante: el anexo agrupa por nombre y se deja fuera columnas de dinero cuyo nombre no es «amount». Faltan por clasificar en el catálogo, al menos: `products.price` y `cost`, `deal_lines.unit_price` y `unit_cost`, `deal_offers.one_off_total` y `recurring_total`, `segments.acv_min`, `acv_max` y `cac_target`, `finance_months.revenue` y `costs`, `trials.mrr`, `stripe_snapshots.mrr` (esta última lleva su propia columna `currency`). La comprobación de coherencia (U-4) las debe cazar.

## 4. Origen

Un solo nombre cubre cuatro conceptos distintos. Propongo cuatro.

| Concepto | Significado | Tipo | Valores | Dónde está hoy |
|---|---|---|---|---|
| `origen_valor` | De dónde viene un valor y si está confirmado (CA-7, CA-8, CA-9) | objeto: `tipo`, `detalle`, `confirmado`, `en`, `cita` opcional | `tipo`: persona, fuente, ia, supuesto. `detalle`: proveedor o dirección | `accounts.field_sources` hoy: `{source, at, quote}` con `source` = apollo, clay, web |
| `canal_de_entrada` | Por qué canal llegó una persona, un lead o un deal | valor cerrado, distinto por objeto (ver decisión 2) | deals: outbound, inbound, partner, plg, event, referral. personas: cold_list, post_engager, website_visitor, referral, inbound | `deals.source`, `people.source` |
| `creado_por` | Quién o qué creó el registro | valor cerrado | tareas: manual, agent, debate. acciones del Agente: agent, mcp. memorias: chat, meeting, decision, suggestion, manual | `tasks.source`, `agent_pending_actions.source`, `memories.source` |
| `fuente_citada` | Texto o dirección de donde sale una noticia o un hallazgo | texto libre | sin valores cerrados; dirección web o nombre del medio | `account_signals.source`, `discoveries.source`, `leads.source`, `trials.source` |

Fuera del catálogo de Origen: `drive_folders.created_by_app` es un booleano que dice si Nokko creó la carpeta (afecta a dónde puede escribir `drive.file`). No es origen de un dato.

Mapeo de lo existente a `origen_valor.tipo`:
- `apollo`, `clay`, `web` → fuente.
- Niveles de onboarding `confirmed`, `inferred`, `assumed` (`setup-extraction.ts`) → persona o fuente con `confirmado` verdadero, ia con `confirmado` falso, supuesto.
- Valor sin marca → «sin dato». Nunca se interpreta como «persona»: sería inventar un origen que no consta.

Reglas ya decididas en el SDD que se mantienen: una edición de persona marca el valor como escrito por la persona y confirmado; ningún proceso automático lo sobrescribe después; si propone otro valor, queda como propuesta pendiente.

## 5. Clases de persistencia para estos campos

| Clase | Qué es | Ejemplos de estos campos |
|---|---|---|
| guardado permanente | se escribe en la base de datos al editar | `accounts.country`, `accounts.size`, importes de deals y finanzas |
| borrador de pantalla | vive en el estado del formulario hasta pulsar guardar | campos del editor del ICP (`icp-editor.tsx`), asistente de configuración |
| sesión | se guarda por usuario en una sesión de trabajo | `onboarding_sessions.*` |
| acción pendiente del Agente | espera confirmación en Sugerencias | `agent_pending_actions` (incluida la vía MCP) |
| memoria | recuerdo del Agente | `memories.*` |

`FitFields` guarda al salir del campo (on blur): es guardado permanente con un instante de borrador. Lo declaro en el catálogo como permanente con guardado al salir.

## 6. Decisiones que necesito de Fede

1. Origen: ¿separar en los cuatro conceptos de arriba? Recomiendo que sí.
2. Canal de entrada: ¿mantener dos catálogos cerrados (deals y personas) o unificarlos? Recomiendo mantenerlos separados en esta entrega: pasar `cold_list` a `outbound` o `post_engager` a `inbound` es interpretar, y no tengo base en el código.
3. Tamaño: ¿empleados como rango y la descripción en palabras como concepto aparte? Recomiendo que sí.
4. Importe: ¿aceptas `naturaleza` y `periodicidad` como atributos obligatorios, con la regla de no sumar entre naturalezas? Y ¿admite importes negativos (abonos)?
5. Valores históricos sin marca de origen: ¿«sin dato»? Recomiendo que sí.

## 7. Límites de esta propuesta

- No he comprobado la base real ni producción. `accounts.country` aparece con CHECK ISO2 solo en una migración comentada (`0029_account_assignment.sql`, «ya aplicada antes del historial»). No sé qué valores hay realmente.
- Tipos leídos de `types.ts` y migraciones, sin volumen de datos por columna.
- No he leído `scoring.ts` ni los consumidores de `size` a fondo. Antes de U-2 lo reviso.
- Los valores de `discoveries.source`, `leads.source` y `trials.source` son texto libre en el código que he visto; puede haber más escritores.
- Periodo no está en el orden inicial, pero `periodicidad` de Importe depende de él.
