# SDD corto · Pausa legal de LinkedIn y gasto por empresa

**Estado: Borrador. No implementar ni aplicar migraciones hasta el OK escrito de Fede en chat.** Fecha: 14-11-2026, pedido 23:01 UTC. Una aprobación automática de herramienta no sustituye ese OK.

## Objetivo y evidencia actual
Pausar únicamente la extracción robotizada de LinkedIn y contabilizar el gasto con transparencia, sin bloquear el gasto manual por presupuesto.

Lectura del repositorio: `apify-gateway.ts` ejecuta actores síncronos y devuelve resultados sin recibo de cargo; sus `maxUsd` son topes técnicos, **no costes medidos**. `web-search.ts` llama a tres proveedores sin atribución de empresa. La clasificación guarda USD en `inbox_reply_receipts`, pero no entra en `monthBudget`, que suma solo `integration_usage.cost`, tratado como EUR. Los plays guardan costes medidos USD y estimaciones EUR por separado. Las búsquedas Apollo/Clay y Apify se declaran `read` y se ejecutan sin confirmación; las consultas Parallel de informes en marcha pueden actualizar registros. No se consultaron servicios externos ni se calcularon precios a partir de tarifas estáticas.

## A. Pausa legal reversible (3B.4)
- Interruptor **global**, inicialmente «En pausa», visible en Conexiones; solo superadmin puede cambiarlo. Esta restricción evita que una empresa eluda la pausa legal para toda la plataforma. Reanudación exclusivamente tras autorización de Fede por revisión legal.
- Guardar estado persistente y comprobarlo en servidor antes de buscar un LinkedIn auxiliar, escribir su URL o lanzar un robot. Fallo de lectura del interruptor = extracción pausada.
- Bloquear `linkedin_company_posts`, `linkedin_profile_posts`, `company_job_postings`, actores actuales de LinkedIn y cualquier actor nuevo que no esté explícitamente autorizado como no-LinkedIn. Control central en el ejecutor de Apify más controles en los consumidores.
- Cubrir pantallas, agente, MCP, Telegram, investigación de stakeholders, señales, jobs y plays; trabajos en cola también vuelven a comprobar la pausa antes de llamar. No iniciar más runs ni repetir los inciertos. Un run ya enviado no puede deshacerse: registrarlo, sin relanzarlo.
- Mostrar «En pausa · pendiente de revisión legal» donde se ofrece esa extracción. El agente explica el bloqueo, no prepara una acción ejecutable ni lo sortea mediante otro robot. G2 continúa disponible; también siguen visibles las fuentes LinkedIn ya guardadas, sin borrar ni reescribirlas.
- No pausar por asociación las búsquedas Apollo/Clay ni borrar enlaces de LinkedIn. Una búsqueda web pública no equivale a lanzar un robot contra LinkedIn; impedir extracción robotizada directa por rutas alternativas, no ocultar citas existentes.

## B. Gasto y confirmaciones
1. **Libro por empresa, sin duplicados:** identificar cada intento por operación, proveedor, empresa y origen; registrar cargo medido, estimación histórica o «sin dato», con moneda y evidencia. Atribuir también llamadas fallidas/cobradas y resultados vacíos. Nunca asumir cero porque no hay resultados ni repetir para recuperar un recibo.
2. Propagar empresa, usuario y origen manual/automático a las búsquedas web, Apify y llamadas de IA. Reutilizar recibos de clasificación y de plays; reconciliar un cargo con su estimación en lugar de sumarlos dos veces. Eliminar la doble contabilización del ejecutor y sus envoltorios. Los registros no contienen consultas, nombres de clientes ni correos.
3. **Estimación antes de confirmar:** mediana de operaciones comparables de la misma empresa y herramienta/proveedor/volumen, con número de muestras, período y moneda. Primero cargos medidos; historial de estimaciones identificado como tal. Un registro antiguo por servicio sin herramienta o volumen no prueba el precio de una herramienta concreta. Tarifas `CAPABILITIES`, textos «gratis», «0,06 $» y `ACTORS.maxUsd` no son evidencia de coste. Sin muestra atribuible/comparable: «Coste estimado: sin dato», nunca cero ni cantidad inventada.
4. **Avisos 80 % y 100 %:** visibles a todos los miembros en el resumen de gasto y antes de confirmar, incluyendo todos los proveedores. Al 100 % solo se pausa trabajo automático con coste; una solicitud manual confirmada continúa. Con presupuesto sin definir, mostrarlo sin inventar porcentajes. Con coste desconocido, mostrar consumo incompleto.
5. **Monedas:** conservar USD medido y EUR estimado; no sumarlos ni convertirlos mediante la moneda de la empresa. Para un porcentaje único, se necesita un tipo de cambio real con fuente y fecha. Mientras falte, mostrar subtotales por moneda y «presupuesto incompleto»; no afirmar que se ha contabilizado íntegramente el gasto comparable. **Decisión pendiente antes de cerrar B:** aprobar la fuente y regla de conversión o presupuestos separados por moneda. No inventar un tipo de cambio.

### Clasificación de herramientas
| Clase | Herramientas y tratamiento |
|---|---|
| Lectura pura | Listados/consultas de registros ya guardados sin llamadas cobrables ni escrituras; ejecuciones inmediatas, `readOnlyHint` verdadero |
| Consulta externa con coste/cupo | `apollo_find_people`, `apollo_find_companies`, `clay_find_people`, `clay_find_companies`, `apollo_enrich_account`, `clay_enrich_account`, `enrich_accounts_table`, `competitor_reviews`: confirmar primero, aunque no guarden resultados comerciales |
| Consulta con coste y posible escritura | `linkedin_company_posts` y resto LinkedIn: pausadas legalmente; al reanudar exigirían confirmación. Informes Parallel en marcha que actualizan registros: no etiquetarlos como lectura pura |
| Acción con coste/escritura ya confirmable | `start_account_report`, `start_icp_account_list`, revelados Apollo y battlecards: mantener confirmación y añadir estimación sustentada |

Auditar el registro completo, incluidos envoltorios de necesidades que llaman a esas operaciones: la clasificación se declara una vez por sus efectos, no por el nombre `read`. Mantener `kind` compatible para crear acciones pendientes y añadir metadatos explícitos de lectura pura, coste, escritura y pausa. Agente/MCP/canales reutilizan ese contrato. La confirmación identifica herramienta, volumen, efectos, estimación y aviso presupuestario; cancelar no llama al proveedor ni guarda resultados. Reclamar atómicamente antes de ejecutar, sin doble gasto por doble clic.

**Resultados tras confirmar:** las consultas dejan de devolver resultados inmediatamente al modelo; guardar una proyección acotada y accesible solo a empresa/usuario en la acción o trabajo existente y devolver un enlace/lectura de ese resultado. No perder personas o empresas encontradas al convertir `read` en confirmable. Las acciones manuales equivalentes en pantallas también muestran confirmación de coste; el automatismo autorizado no pide un clic por cada operación, pero respeta la pausa presupuestaria.

## Criterios de aceptación: prueba primero
| CA | Regla concreta | Prueba nueva propuesta |
|---|---|---|
| 1 | Con pausa o estado no verificable: cero llamadas a robots LinkedIn y cero escrituras auxiliares; G2 sí puede ejecutarse | `linkedin-legal-pause.test.ts`, fake proveedor; casos pantalla/agente/job/play y actor desconocido |
| 2 | Reanudar requiere superadmin; no modifica registros guardados | prueba de permisos con miembro/Owner/superadmin y fixture persistente intacta |
| 3 | Dos proveedores de búsqueda y clasificación/borrador se imputan a su empresa una vez; no cruza empresas ni duplica plays | `spend-ledger.test.ts`, integración SQL local con IDs de intento y recibos |
| 4 | USD y EUR nunca se suman sin conversión real; `null` no equivale a cero | `spend-currency.test.ts` con 1 USD y 2 EUR, conversión ausente y fuente real configurada |
| 5 | Con presupuesto 100: 79 sin aviso, 80 aviso, 100 aviso y pausa automática; solicitud manual continúa | `spend-thresholds.test.ts`; importes sintéticos de prueba, no tarifas |
| 6 | Herramientas con coste/efectos no llaman ni escriben antes de confirmar; cancelar y doble clic no gastan | `tool-effects-confirmation.test.ts`, falsos proveedores grabando llamadas, agente y MCP |
| 7 | Sin muestra comparable se obtiene `null`/«sin dato»; dos muestras medidas 2 y 4 de la misma moneda/volumen producen mediana 3; no usa otra empresa | `tool-cost-history.test.ts` |
| 8 | Tras confirmar búsqueda se recuperan los resultados de esa acción; otra empresa/usuario no puede leerlos | `confirmed-search-results.test.ts` |

Nuevas pruebas fallando primero, suite/regresiones, tipos, lint y compilación automática. Navegador con sesión: «En pausa», G2 disponible, confirmaciones/cancelación/resultados y avisos en escritorio/móvil claro/oscuro, con proveedores sintéticos, sin gasto real. Revisión independiente de concurrencia y contabilidad antes del cierre. **Ninguna prueba existente se modifica sin permiso específico**; si fija ejecución inmediata de una lectura con coste, parar esa sustitución y pedirlo.

## Archivos y migración propuesta — no aplicar
- Pausa: nuevo núcleo/estado legal y función autenticada; `apify-gateway.ts`, `apify-core.ts`, `ai-core.ts`, `web-research-core.ts`, herramientas LinkedIn, `components/linkedin.tsx`, Conexiones y consumidores de jobs/plays.
- Gasto: `orchestrator/usage.ts`, `runner.ts`, `planner.ts`, `orchestrator.functions.ts`, panel de presupuesto; `web-search.ts` y sus consumidores; gateways Apollo/Clay/Parallel/Apify y adaptación del registro de IA/plays; recibos de clasificación sin alterar modelo ni contenidos de correo.
- Confirmación: `agent/tool-kit.ts`, registro/herramientas afectadas, `agent/agent.server.ts`, `agent.functions.ts`, adaptador MCP/manifiesto y presentación de acciones/resultados. Pruebas nuevas, catálogo de campos y reglas de arquitectura.
- **Se requiere migración nueva**, no editar migraciones existentes: estado global legal (lectura autenticada mínima, escritura solo superadmin comprobado); ampliar `integration_usage` con identidad idempotente de operación, herramienta, volumen, estado de coste/moneda y referencia de recibo; importe desconocido nullable; recibos correlacionables y proyección de resultados si los campos existentes no bastan. RLS, GRANT y RPC atómicos de registro/conciliación. Los antiguos registros conservan sus importes como estimaciones históricas, nunca se reclasifican como medidos. Sin borrado ni copia de datos empresariales.
- Número de migración a asignar al implementar tras comprobar el diario. Este SDD **no crea archivo SQL ni aplica cambios**.

## Riesgos, reversión y límites
- Registro incompleto/proveedor sin recibo: conservar intento «sin dato» y reconciliar después por ID, no relanzar consumo. Si falla la persistencia antes de llamar, detener ese intento por integridad, no por un tope presupuestario.
- La respuesta síncrona actual de Apify no permite medir el coste real: hará falta iniciar una sola ejecución y consultar su recibo por ID, con espera espaciada hasta terminal; no ejecutar dos veces para obtener datos.
- Las cotizaciones antiguas no prueban precios y las monedas dificultan el porcentaje; decisión monetaria pendiente. Costes ya ocurridos sin evidencia no se reconstruyen inventando cifras.
- Los límites técnicos por ejecución de Apify actuales no son un tope mensual manual: conservarlos como protección del actor, sin usarlos como estimación ni añadir nuevos topes duros.
- Revertir por pieza el código de contabilidad/confirmación manteniendo recibos y datos; migración aditiva conservada. **Nunca revertir la pausa legal para reactivar LinkedIn sin autorización.** El interruptor permite reanudación expresa tras revisión legal, no automática.
- Sin pantallas nuevas, publicación, envíos, lectura real de buzones, robots reales ni gasto. Drive (SDD existente, Ola 3B) y glosario pendientes no se tocan.

**Pendientes de Fede:** OK escrito para construir; política de comparación entre USD/EUR; permisos específicos si alguna prueba protegida exige el comportamiento antiguo. No se declara el SDD aprobado.