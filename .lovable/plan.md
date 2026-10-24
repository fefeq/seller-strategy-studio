# Integrar RevOps Dashboard, Finance Dashboard y Postin CRM dentro de Nokko

## Qué hay en cada proyecto (revisado en su código)

| Proyecto | Qué aporta | Datos | Estado técnico |
|---|---|---|---|
| **RevOps Dashboard** | Embudo lead→deal con conciliación (cuántos entran, avanzan y caen en cada etapa), postura del trimestre, cohortes por origen y segmento, análisis de deals perdidos y tendencias. | Solo datos de ejemplo («Crestline Cloud»); no tiene base de datos. | Mismo stack que Nokko. Motor de cálculo puro en `engine.ts` (2.100 líneas), sin tests. |
| **Finance Dashboard** | Panel de CFO: KPIs, previsión de ingresos con escenarios (Free/Pro/Agencia), abanico de caja, cascada de desvíos plan vs real, antigüedad de cobros, costes por línea, flujo Sankey, comentario con IA, importación CSV y métricas Postin (MRR, suscripciones). | 6 tablas propias: ajustes, meses, facturas, métricas mensuales Postin, suscripciones mensuales y fotos de previsión. Login propio. | Mismo stack que Nokko. 7 archivos de test. |
| **Postin Sales Pipeline CRM** | Pipeline kanban, empresas, contactos, tareas, actividades, calendario, productos y ofertas por deal, plantillas de email, Deal Coach con IA, previsión, comerciales y equipos, importar/exportar y MCP. | 16 tablas propias en otra base de datos, con sus propios usuarios. | Stack antiguo (react-router-dom, edge functions); no se puede copiar tal cual. |

**Qué ya tiene Nokko:** cuentas, personas, deals con etapas y su historial, tareas, reuniones y llamadas, productos y líneas de deal, cuotas, avisos, CAC, presupuestos por segmento, payback, conexión con Stripe y PostHog, agente, MCP y segundo plano.

**Conclusión:** casi todo el CRM ya existe en Nokko. Lo que Nokko no tiene, y vale la pena traer, es:
1. **Análisis RevOps** (embudo conciliado, deals perdidos, cohortes, tendencias), calculado con los datos reales de Nokko en vez de los de ejemplo.
2. **Finanzas** completas (CFO): previsión con escenarios, caja, facturas y cobros, desvíos, costes.
3. **Del CRM, solo lo que falta:** actividades unificadas en una línea de tiempo, ofertas por deal, plantillas de email, vista de calendario, Deal Coach y equipos.

## Principios

- **Una sola fuente de datos.** Nada de tablas paralelas de deals o empresas: todo lee de las tablas de Nokko, separado por empresa (multitenant) y protegido por permisos.
- **Reutilizar la lógica, no la interfaz.** Los motores de cálculo se copian casi intactos y se cubren con tests. Las pantallas se rehacen con el diseño Ink + Lima y los patrones de Nokko: conclusión en el título, una acción principal y secciones en lugar de páginas largas.
- **Menú sin crecer.** Se añaden dos destinos: «Finanzas» y un «Análisis» dentro de Métricas. Lo del CRM entra dentro de las pantallas existentes (ficha de cuenta, deal, Pipeline).
- **Agente y MCP.** Cada capacidad nueva se puede consultar desde el agente y desde Claude o ChatGPT.

## Experiencia final

```text
Métricas
  ├─ Resumen (actual)
  ├─ Embudo RevOps   ← RevOps: conciliación etapa a etapa, postura del trimestre
  ├─ Perdidos        ← RevOps: motivos, etapa de caída, valor perdido
  ├─ Cohortes        ← RevOps: por origen y segmento
  └─ Tendencias      ← RevOps
Finanzas (nuevo, Owner y Sales Leader)
  ├─ Resumen CFO     ← KPIs, abanico de caja, comentario IA
  ├─ Previsión       ← escenarios y supuestos; foto guardada por mes
  ├─ Plan vs real    ← cascada de desvíos (une con Presupuestos de Nokko)
  ├─ Facturas y cobros ← antigüedad, alta de facturas
  ├─ Costes          ← líneas de coste (alimenta CAC y coste de servir)
  └─ Producto        ← MRR y suscripciones (desde Stripe/PostHog o CSV)
Pipeline / Deal / Cuenta (existentes)
  ├─ Línea de tiempo de actividades (emails, llamadas, notas, tareas)
  ├─ Ofertas del deal (versiones de propuesta con productos)
  ├─ Plantillas de email al registrar una actividad
  ├─ Deal Coach (IA) en la ficha del deal
  └─ Calendario (tareas y reuniones) como vista de Pipeline/Tareas
Equipo: equipos de ventas y vista por comercial
```

## Fases (en orden de valor y riesgo)

**Fase 1. Análisis RevOps con datos reales (sin cambios en la base de datos)**
- Copiar el motor `engine.ts` a `src/lib/revops/`, quitando los datos de ejemplo. Un adaptador convierte los leads, deals, etapas e historial de Nokko al formato del motor.
- Añadir las cuatro secciones nuevas en Métricas. Los filtros (trimestre, segmento, origen) quedan en la dirección de la página.
- Tests: conciliación (entradas = avances + caídas + abiertos en cada etapa), cohortes y adaptador.
- Herramientas para el agente y MCP: «embudo RevOps» y «análisis de perdidos».

**Fase 2. Finanzas**
- Tablas nuevas por empresa: `finance_settings`, `finance_months`, `finance_invoices`, `finance_cost_lines`, `forecast_snapshots` y `product_metrics_monthly` (versión general de las métricas Postin), con su org_id, permisos y acceso solo para Owner y Sales Leader.
- Copiar los motores (`forecast-v3`, `revenue-forecast`, `month-status`, `invoice-entry`, `csv-import/export`, `sankey-layout`) con sus 7 tests. Lo específico de Postin (Free/Pro/Agencia) pasa a ser un modelo de supuestos configurable por empresa.
- Unir con lo que ya existe:
  - Plan vs real lee los presupuestos por segmento.
  - Los costes alimentan el CAC y el coste de servir.
  - El MRR se toma de Stripe o PostHog si están conectados; si no, de un CSV.
- El comentario con IA usa el proveedor actual de Nokko (OpenRouter) y corre en segundo plano.

**Fase 3. Lo que falta del CRM**
- `activities` (tipo, fecha, cuenta, persona, deal y autor) más una línea de tiempo en la cuenta y el deal que une actividades, llamadas, reuniones y tareas que ya existen.
- `deal_offers` (versiones de oferta con líneas de producto, reutilizando `products` y `deal_lines`) y `email_templates` por empresa.
- Calendario: vista mensual y semanal de tareas y reuniones.
- Deal Coach: su prompt y su lógica pasan a una función de servidor de Nokko, con las sugerencias guardadas como Sugerencias, así que aparecen en el mazo.
- Equipos: `teams` y `team_members` dentro de la empresa, más un filtro «Mi equipo» en Pipeline y Métricas.

**Fase 4. Traer los datos reales (decisión tuya)**
- Postin CRM y Finance Dashboard guardan sus datos en otras bases que Nokko no puede leer. Para traerlos:
  1. Exporta un CSV por tabla desde cada proyecto.
  2. Súbelos aquí.
  3. Los importo a la empresa «Postin» de Nokko, sin duplicar cuentas ni personas (con las reglas de coincidencia actuales) y con cada registro enlazado por su id original.
- Los usuarios de esos proyectos no se migran: se invitan a la empresa en Nokko.

## Decisiones para ti
1. **Acceso a Finanzas:** solo Owner y Sales Leader (propuesta), o todo el equipo en modo lectura.
2. **Supuestos Postin (Free/Pro/Agencia):** ¿los conviertes en una plantilla general por planes o se quedan como modelo exclusivo de la empresa Postin?
3. **Datos reales:** ¿importamos los registros de Postin CRM y Finance (fase 4) o empezamos de cero en Nokko?
4. **Proyectos antiguos:** cuando todo esté en Nokko, ¿se dejan de usar? Su MCP y sus endpoints dejarían de recibir datos.

## Cómo lo verificaré
- Tests de cada motor copiado (7 de Finanzas más los nuevos de RevOps y del adaptador), con la suite completa en verde.
- Cuadre: la suma de deals del embudo RevOps coincide con Pipeline, y el plan vs real de Finanzas con Presupuestos.
- Permisos: un AE no ve Finanzas, y otra empresa no ve los datos.
- Capturas en ordenador y móvil de cada sección nueva.

---

## Detalles técnicos
- RevOps: `src/lib/revops/engine.ts` (copiado, sin `SAMPLE_DATASET` ni `data.ts`) y `src/lib/revops/adapter.ts` (Nokko leads/deals/deal_stage_history/segments → `Dataset`). Componentes en `src/components/metrics/revops/` (Funnel, FunnelShape, PostureCards, Explainer y Chart adaptados a tokens). `?seccion=` en `/metrics` con `validateSearch`.
- Finanzas: ruta `src/routes/_authenticated/finance.tsx` (solo layout) y paneles en `src/components/finance/` (adaptados desde `components/cfo`). Lógica en `src/lib/finance/`. Migración con GRANT, RLS por `is_org_member` y escritura con `has_org_role(owner|sales_leader)`. Moneda con `useCurrency()`.
- La IA de Finanzas (`ai-commentary`, `scenario-from-prose`) pasa por `src/lib/ai.functions.ts` y el job runner existente; se descarta `ai-gate` porque Nokko ya controla los permisos por rol.
- CRM: el Postin CRM usa react-router-dom y edge functions, así que se porta solo la lógica (prompts de `deal-coach` y `deal-actions`) a server functions. Su MCP se descarta porque Nokko ya tiene uno.
- Navegación: `src/lib/nav.ts` gana «Finanzas», visible por rol, con su test actualizado. El agente y MCP ganan herramientas `revops_funnel`, `lost_analysis` y `finance_summary` en TITLES y en `manifest.json`.
- Importación (fase 4): CSV → `import_batches`/`import_rows` en cuarentena, con un mapeo por tabla y `match.ts` para las coincidencias.
- Recharts ya es compatible y no hace falta añadir más dependencias.
