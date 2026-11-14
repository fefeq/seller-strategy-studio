# SDD corto · Pausa legal de LinkedIn y gasto por empresa

**Estado: Borrador. No implementar ni aplicar migraciones hasta el OK escrito de Fede en chat.** Fecha: 14-11-2026, pedido 23:01 UTC. Una aprobación automática de herramienta no sustituye ese OK.

## Objetivo y evidencia actual
Pausar únicamente la extracción robotizada de LinkedIn y contabilizar el gasto con transparencia, sin bloquear el gasto manual por presupuesto.

Código revisado: Apify devuelve resultados sin recibo de cargo (`maxUsd` es un tope técnico, no precio); `web-search.ts` no atribuye gasto a empresa. Clasificación guarda USD en recibos, mientras `monthBudget` suma solo `integration_usage.cost` como EUR. Plays separa USD medido y EUR estimado. Las búsquedas Apollo/Clay/Apify se ejecutan como `read` sin confirmación. No se consultaron proveedores ni se calcularon tarifas.

## A. Pausa legal reversible (3B.4)
- Interruptor **global**, inicialmente «En pausa», visible en Conexiones; solo superadmin puede cambiarlo. Esta restricción evita que una empresa eluda la pausa legal para toda la plataforma. Reanudación exclusivamente tras autorización de Fede por revisión legal.
- Guardar estado persistente y comprobarlo en servidor antes de buscar un LinkedIn auxiliar, escribir su URL o lanzar un robot. Fallo de lectura del interruptor = extracción pausada.
- Bloquear `linkedin_company_posts`, `linkedin_profile_posts`, `company_job_postings`, actores actuales de LinkedIn y cualquier actor nuevo que no esté explícitamente autorizado como no-LinkedIn. Control central en el ejecutor de Apify más controles en los consumidores.
- Cubrir pantallas, agente/MCP/Telegram, investigación, señales, jobs y plays, incluida cola existente. Comprobar antes de cada llamada; runs ya enviados se registran sin repetirlos.
- Mostrar «En pausa · pendiente de revisión legal» donde se ofrece esa extracción. El agente explica el bloqueo, no prepara una acción ejecutable ni lo sortea mediante otro robot. G2 continúa disponible; también siguen visibles las fuentes LinkedIn ya guardadas, sin borrar ni reescribirlas.
- No pausar Apollo/Clay ni borrar enlaces. Impedir extracción robotizada directa por rutas alternativas, no ocultar citas o búsquedas web públicas.

## B. Gasto y confirmaciones
1. **Libro por empresa, sin duplicados:** identificar cada intento por operación, proveedor, empresa y origen; registrar cargo medido, estimación histórica o «sin dato», con moneda y evidencia. Atribuir también llamadas fallidas/cobradas y resultados vacíos. Nunca asumir cero porque no hay resultados ni repetir para recuperar un recibo.
2. Propagar empresa, usuario y origen manual/automático a las búsquedas web, Apify y llamadas de IA. Reutilizar recibos de clasificación y de plays; reconciliar un cargo con su estimación en lugar de sumarlos dos veces. Eliminar la doble contabilización del ejecutor y sus envoltorios. Los registros no contienen consultas, nombres de clientes ni correos.
3. **Estimación antes de confirmar:** mediana de operaciones comparables de la misma empresa y herramienta/proveedor/volumen, con número de muestras, período y moneda. Primero cargos medidos; historial de estimaciones identificado como tal. Un registro antiguo por servicio sin herramienta o volumen no prueba el precio de una herramienta concreta. Tarifas `CAPABILITIES`, textos «gratis», «0,06 $» y `ACTORS.maxUsd` no son evidencia de coste. Sin muestra atribuible/comparable: «Coste estimado: sin dato», nunca cero ni cantidad inventada.
4. **Avisos 80 % y 100 %:** visibles a todos los miembros en el resumen de gasto y antes de confirmar, incluyendo todos los proveedores. Al 100 % solo se pausa trabajo automático con coste; una solicitud manual confirmada continúa. Con presupuesto sin definir, mostrarlo sin inventar porcentajes. Con coste desconocido, mostrar consumo incompleto.
5. **Monedas — elección de Fede:** conversión con fuente real, conservando importe original, tipo de cambio, fuente y fecha. No sumar USD/EUR directamente ni convertir mediante la moneda de la empresa. Validar la fuente y regla concreta antes de implementar; sin cambio verificable, mostrar subtotales y «presupuesto incompleto», nunca inventar la conversión. El OK escrito para construir sigue pendiente: la respuesta sobre monedas no lo sustituye.

### Clasificación de herramientas
| Clase | Herramientas y tratamiento |
|---|---|
| Lectura pura | Listados/consultas de registros ya guardados sin llamadas cobrables ni escrituras; ejecuciones inmediatas, `readOnlyHint` verdadero |
| Consulta externa con coste/cupo | `apollo_find_people`, `apollo_find_companies`, `clay_find_people`, `clay_find_companies`, `apollo_enrich_account`, `clay_enrich_account`, `enrich_accounts_table`, `competitor_reviews`: confirmar primero, aunque no guarden resultados comerciales |
| Consulta con coste y posible escritura | `linkedin_company_posts` y resto LinkedIn: pausadas legalmente; al reanudar exigirían confirmación. Informes Parallel en marcha que actualizan registros: no etiquetarlos como lectura pura |
| Acción con coste/escritura ya confirmable | `start_account_report`, `start_icp_account_list`, revelados Apollo y battlecards: mantener confirmación y añadir estimación sustentada |

Auditar también envoltorios de necesidades. Contrato compartido de efectos (lectura pura, coste, escritura, pausa), compatible con acciones pendientes y MCP. Confirmación: herramienta, volumen, efectos, estimación y aviso; cancelar no ejecuta. Reclamo atómico evita doble gasto.

**Resultados:** conservar proyección acotada por empresa/usuario en la acción/trabajo y devolver su enlace/lectura tras confirmar. No perder resultados al convertir búsquedas en confirmables. Pantallas manuales también confirman coste; automatismos autorizados respetan presupuesto sin pedir clic por operación.

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

Pruebas nuevas primero, suite/regresiones, tipos, lint, compilación y navegador autenticado escritorio/móvil claro/oscuro con proveedores sintéticos. Revisión independiente antes del cierre. No modificar pruebas existentes sin permiso; si exigen ejecutar lecturas con coste inmediatamente, parar y pedirlo. Sin gasto real.

## Archivos y migración propuesta — no aplicar
+- Pausa: núcleo/estado legal nuevo; `apify-gateway.ts`, `apify-core.ts`, `ai-core.ts`, `web-research-core.ts`, herramientas LinkedIn, `components/linkedin.tsx`, Conexiones y consumidores jobs/plays.
+- Gasto: `orchestrator/{usage,runner,planner}.ts`, estado/panel de presupuesto; `web-search.ts` y consumidores; gateways, recibos de clasificación y adaptadores de IA/plays.
+- Confirmación: `agent/tool-kit.ts`, herramientas afectadas, `agent/agent.server.ts`, `agent.functions.ts`, adaptador MCP/manifiesto y presentación de acciones/resultados. Pruebas nuevas, catálogo de campos y reglas de arquitectura.
+- **Migración nueva necesaria:** estado legal global; ampliar `integration_usage` con operación idempotente, herramienta, volumen, moneda, calidad del coste y referencia de recibo; importe desconocido nullable; correlación de recibos y proyección de resultados si campos actuales no bastan. GRANT, RLS y RPC atómicos. Lectura legal mínima autenticada, escritura solo superadmin comprobado. Conservar registros antiguos como estimaciones, nunca medidos.
+- Número a asignar tras comprobar el diario. No editar migraciones existentes, borrar datos ni copiar empresas. **No se crea SQL ni se aplica migración con este SDD.**

## Riesgos, reversión y límites
- Recibo ausente o fallo tras cobrar: conservar «sin dato», reconciliar por ID y no relanzar. Si falla persistencia antes de llamar, detener por integridad, no por presupuesto.
- Apify síncrono no entrega cargo medido: iniciar una ejecución y consultar su recibo por ID hasta terminal con espera espaciada; nunca ejecutar dos veces para medir.
- Conservar límites técnicos actuales de actores: no son un tope mensual manual ni una estimación. Costes históricos sin evidencia no se reconstruyen.
- Revertir código por pieza manteniendo datos y recibos; migración aditiva conservada. Nunca reactivar LinkedIn mediante una reversión: solo interruptor tras autorización legal expresa.
- Sin pantallas nuevas, publicación, envíos, lectura real de buzones, robots reales ni gasto. Drive y glosario pendientes intactos.

**Pendientes:** OK escrito de Fede para construir; concretar y verificar la fuente de conversión elegida; permisos específicos ante pruebas protegidas incompatibles. No se declara el SDD aprobado.
