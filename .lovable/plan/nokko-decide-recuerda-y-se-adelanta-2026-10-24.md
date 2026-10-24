# Nokko decide, recuerda y se adelanta

Objetivo: el usuario dice lo que necesita y Nokko elige qué fuentes e integraciones usar, recuerda el negocio, a cada usuario y cada cuenta, y trabaja solo dentro de límites seguros. El menú se reordena por tipo de trabajo.

## Decisiones acordadas en la entrevista

- Gasto en integraciones: Nokko gasta sin preguntar hasta un límite mensual por empresa que fija el Owner. Avisa al llegar al 80 %. Al 100 % pausa lo automático, pero lo que pides tú sigue funcionando.
- Proactivo pero seguro. Nokko hace solo, sin pedir permiso: investigar, enriquecer, resumir, preparar reuniones y buscar posibles clientes, leads, contactos y competidores. Enviar mensajes a terceros, mover deals o borrar siempre necesita tu confirmación.
- Prospección: cada semana, según el ICP. Lo encontrado va a una bandeja «Descubiertos» donde aceptas o descartas con un clic. Nokko aprende de lo que aceptas y descartas.
- Avisos: en Inicio y en un resumen diario por email a las 8:00 de cada usuario, todos los días. Cada usuario puede cambiar la hora.
- Memoria: hechos del negocio, preferencias de cada usuario, historia de cada cuenta, resultados de lo que hizo y tareas. Se guarda sola desde chats, reuniones y decisiones, marcada como «aprendido». Una pantalla «Memoria» permite ver, corregir y borrar lo que recuerda.
- Orquestador: Nokko combina varias fuentes y al final explica cuáles usó y cuánto costó. Los botones de cada integración desaparecen de las pantallas.
- Menú en 5 bloques: Hoy, Vender, Estrategia, Conocimiento y Ajustes, con el agente siempre a mano.
- Orden de trabajo: 1) menú y orquestador, 2) memoria, 3) proactividad total.

## Fase 1 — Menú y orquestador

**Menú nuevo:**

```text
Hoy          Inicio (briefing) · Sugerencias · Descubiertos (Fase 3)
Vender       Cuentas · Leads · Pipeline · Personas · Aprobaciones
Estrategia   Estrategia GTM · Métricas · Asesor GTM · Ciclo GTM · Debates · ABM y partners · Theory U · Productos
Conocimiento Conocimiento · Memoria (Fase 2)
Ajustes      Configuración · Equipo · Conexiones · Conectar asistentes
```

- Los bloques llevan un título pequeño y se pliegan en la versión móvil. La barra inferior del móvil no cambia: Inicio, Sugerencias, Leads, Pipeline y Agente.
- Las direcciones antiguas siguen funcionando.

**Orquestador («qué necesitas», no «qué herramienta»):**
- Un catálogo de capacidades describe cada necesidad del negocio: investigar una cuenta, encontrar stakeholders, enriquecer una cuenta o un contacto, conseguir un email o un teléfono, buscar noticias y señales, buscar empresas por ICP, buscar casos de éxito, analizar competidores y leer documentos. Para cada necesidad lista qué servicios la cubren (Apollo, Clay, Parallel, Firecrawl, Perplexity, Apify, Drive, PostHog, Stripe), con su coste aproximado, su velocidad y su calidad.
- Unas reglas fijas, con pruebas, eligen el plan según la petición, lo que ya tiene la cuenta, los servicios conectados, el presupuesto que queda y si hay prisa. Ejemplos: primero lo gratis o lo ya guardado; para un informe profundo, Parallel con Firecrawl y Perplexity de respaldo; para un email, Apollo y, si falla, Clay. Si un servicio falla, se pasa al siguiente.
- El agente deja de ver unas 100 herramientas sueltas. En su lugar ve unas 10 por necesidad (investigar, encontrar personas, completar datos, prospectar…), que llaman al orquestador. Las herramientas de lectura del día a día y las de escritura con confirmación se quedan como están. El servidor de conexión para asistentes (MCP) recibe las mismas herramientas por necesidad.
- Las pantallas también pasan por el orquestador. En la ficha de cuenta, botones como «Investigar», «Completar datos» o «Buscar stakeholders» sustituyen a los botones por integración. Cada resultado acaba con una línea del tipo «Fuentes: Parallel, Firecrawl · coste aprox. 0,40 €».
- Registro de gasto: cada llamada guarda el servicio, la empresa, el usuario, quién la lanzó (persona o automático) y el coste estimado. En Conexiones el Owner fija el límite mensual y ve el consumo.

## Fase 2 — Memoria

- Tipos de recuerdo: negocio, usuario, cuenta, resultado y tarea. Cada uno guarda su texto, de dónde sale (chat, reunión, decisión, sugerencia aceptada o rechazada), su fecha, quién lo creó y si lo aprendió Nokko o lo escribió una persona.
- Aprendizaje automático: al final de cada conversación con el agente, cada nota de reunión y cada aceptación o rechazo de sugerencias, la IA extrae hechos nuevos. Si un hecho ya existe, lo actualiza en vez de duplicarlo; si contradice uno anterior, lo sustituye y guarda el historial.
- Uso: antes de responder o de actuar, el agente y el orquestador cargan los recuerdos relevantes (los de la empresa, los del usuario y los de la cuenta en juego). Así evita repetir lo que ya se descartó y respeta el tono y el formato de cada usuario.
- Tareas: lo que Nokko o el equipo se comprometen a hacer queda como tarea con responsable y fecha. Se apoya en las tareas que ya existen.
- Pantalla «Memoria» con pestañas Empresa, Mío y Cuentas: buscar, editar, borrar y fijar recuerdos como «siempre tener en cuenta». Los recuerdos personales solo los ve su dueño. Los de empresa los ve todo el equipo y solo los editan el Owner y el Sales Leader, o su autor.

## Fase 3 — Proactividad total

- Motor por empresa, cada hora y cada día (ya existe con Inngest y el cron), ampliado con:
  - Investigación automática de las cuentas nuevas o sin datos.
  - Preparación de reuniones el día anterior.
  - Resúmenes de documentos nuevos en Drive.
  - Vigilancia de competidores.
  - Prospección semanal hacia «Descubiertos».
- «Descubiertos» guarda las empresas, contactos y competidores encontrados, con el motivo de encaje y la fuente. Al aceptar, pasan a cuentas o leads con un clic; al descartar, Nokko aprende el motivo, que queda en memoria.
- El briefing de Inicio sustituye a «¿Qué hago ahora?» con tres bloques: qué hizo Nokko solo desde ayer, qué necesita tu decisión y qué viene hoy.
- Email diario a las 8:00 de cada usuario con ese mismo briefing (preferencia de hora por usuario). Requiere un dominio de envío propio. Si no está configurado, se pedirá en ese momento.
- Respeta siempre el límite de gasto y las reglas de seguridad acordadas arriba.

## Detalles técnicos

- Catálogo y reglas de elección en módulos puros y probados: `src/lib/orchestrator/capabilities.ts`, `planner.ts` y `budget.ts`. La ejecución va en `orchestrator.server.ts` y reutiliza los módulos actuales de cada integración.
- Tablas nuevas, todas con `org_id`, RLS y GRANT:
  - `integration_usage`: gasto por servicio y mes.
  - `org_budgets`: límite mensual, umbral de aviso y estado de pausa.
  - `memories`: tipo, alcance empresa/usuario/cuenta, texto, fuente, `supersedes`, fijado.
  - `discoveries`: tipo, datos, encaje, fuente, estado.
  - `user_prefs`: hora y zona horaria del briefing.
- Herramientas del agente y MCP agrupadas por necesidad. Se regenera el manifiesto MCP y se mantienen los títulos en TITLES.
- Recuerdos relevantes: filtro por alcance y por la cuenta en juego, con un límite de tamaño. No hacen falta vectores en la primera versión.
- El email usa el envío gestionado de la app, con una plantilla de briefing y un envío por usuario y día (sin listas).
- Pruebas para el planificador, el presupuesto (80 % y 100 %, manual frente a automático), la deduplicación de memoria y el aprendizaje de «Descubiertos».
- Se actualiza `AGENTS.md` con las nuevas reglas de arquitectura y la memoria del proyecto con estas decisiones.
