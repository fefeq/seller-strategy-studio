# Importación automática de leads y cuentas desde terceros, sin riesgos

## Punto de partida
- **Leads:** ya existe un enlace permanente por empresa (clave secreta `gtm_…`) que reciben formularios, Zapier, Make y CRMs. También existe la importación CSV con los permisos del usuario.
- **Cuentas:** solo se importan con CSV desde la pantalla. No hay ninguna entrada automática.
- **Riesgo actual:** cada envío al enlace escribe directamente en el pipeline. No hay vista previa ni límite de volumen, y no se puede deshacer un lote.

## Qué vamos a construir

### 1. Conexiones de entrada por fuente
En Leads → Entrada pasa a llamarse «Conexiones de entrada». Cada conexión tiene:
- **Tipo:** leads, cuentas o ambos.
- **Origen:** Sales Navigator (a través de Evaboot, Phantombuster, Make o n8n), HubSpot, Typeform, Zapier o un webhook genérico.
- **Clave propia, revocable y con rotación**, que nunca se muestra después de crearla.
- **Modo:**
  - «Revisar antes de entrar», el modo por defecto. Cada lote queda en cuarentena.
  - «Entrada directa», que solo pueden activar Owner y Sales Leader.

### 2. Cuarentena (zona de espera)
- Todo lo que llega se guarda primero en una zona de espera, nunca directamente en Cuentas, Leads o Pipeline.
- Cada fila muestra lo que pasará con ella: «nueva», «ya existe, se actualizará» o «descartada» con su motivo. Usa la misma deduplicación por dominio y nombre que el CSV actual.
- Puedes aprobar el lote entero, aprobar filas sueltas o descartar.

### 3. Barreras de seguridad
- Límite por conexión: filas por envío y por día. Al superarlo, la conexión se pausa sola y avisa en Sugerencias.
- **Nunca se sobrescribe** un campo escrito por una persona. Solo se rellenan los vacíos o los marcados como de Nokko, según la marca de origen ya existente.
- Nunca se borra nada ni se cambia una etapa ya avanzada.
- El enriquecimiento automático respeta el interruptor «Completar solo» y el límite de gasto mensual.
- Firma opcional de los envíos para los terceros que la admitan, como HubSpot o Typeform.

### 4. Deshacer un lote
- Cada lote aprobado guarda qué filas creó y cuáles actualizó.
- «Deshacer lote» borra solo las filas que creó ese lote y que no se han tocado después, y restaura los valores anteriores de las que actualizó. Solo puede usarlo el Owner, como el resto de borrados.

### 5. Visibilidad
- Historial por conexión: recibidos, aprobados, descartados, errores y último envío.
- El agente y los asistentes conectados por MCP pueden consultar los lotes pendientes y proponer su aprobación. Nunca aprueban solos.

### 6. Guías por origen
Cada origen tendrá una guía corta con la URL, cómo mapear las columnas y un envío de prueba que no escribe nada. Empezamos por Sales Navigator a través de Make o n8n, y por HubSpot.

## Fases
1. Zona de espera y modo «Revisar» para el enlace actual de leads. Las claves actuales siguen funcionando, en modo directo como hasta hoy.
2. Entrada de cuentas por enlace, con el mismo flujo.
3. Límites, autopausa y deshacer lote.
4. Guías por origen y herramientas del agente y MCP.

## Detalles técnicos
- Tablas nuevas `import_batches` y `import_rows` (con datos crudos, plan calculado, estado y snapshot previo), con `org_id` por defecto `current_org()`, RLS por membresía y GRANT explícitos.
- `lead_sources` se amplía con `kind` (leads, accounts o both), `mode` (review o direct), `daily_limit`, `max_per_request` y `signing_secret` cifrado.
- `/api/public/leads` sigue igual para las claves existentes. Se añade `/api/public/accounts`. Las dos validan con Zod, comprueban la clave con hash y la firma, y escriben en la zona de espera con el cliente admin solo después de verificar la clave.
- La aprobación pasa por una función de servidor autenticada (`requireSupabaseAuth`, RLS como usuario) que reutiliza `planAccountImport` e `ingestLead`.
- Lógica pura y testeada en `src/lib/import-batch.ts`: planificar, aplicar los límites, calcular qué deshacer y fusionar respetando la marca de origen.
- Tests de las reglas: nunca sobrescribir un dato manual, autopausa al superar el límite, deshacer solo lo no tocado y solo el Owner deshace.
