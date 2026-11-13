# Nokko: muchas fuentes en el onboarding, Drive fiable, seguridad y calidad

Basado en el documento que has subido. Se hace en tres fases, en orden, sin pedirte confirmación entre ellas salvo que surja una condición de parada (test existente roto, migración fallida, algo que exija tocar secretos o datos de clientes, o una decisión de producto que el documento no cubre).

## Fase 1: fuentes del onboarding sin tope práctico
- Hasta 20 documentos por lectura (constante fácil de cambiar), mezclando archivos del equipo, Drive, web y texto.
- Los archivos se suben a un almacén privado por empresa con barra de progreso (máx. 20 MB; PDF, TXT, MD, CSV). Quitar una fuente borra el archivo.
- Drive se envía por referencia; el servidor descarga y extrae el texto dentro de la carpeta de la empresa.
- Un presupuesto de texto repartido por igual entre fuentes; cada una termina como «leída entera», «leída parcialmente (N de M caracteres)» o «no leída (motivo)». Se avisa antes de lanzar si algo se leerá parcial.
- «Nokko lee» muestra el estado real; ninguna fuente no leída aparece como leída.
- Mensajes claros en Drive: archivo fuera de la carpeta, permiso denegado, token caducado, archivo demasiado grande, duplicados.
- Las sesiones ya guardadas siguen abriéndose.

## Fase 2: seguridad
- NK-0044: sugerencias de precio solo para roles que pueden ver precios.
- NK-0081: la base de datos impide activar un play bloqueado.
- NK-0169: tras cerrar sesión, ninguna lectura sale con la cuenta anterior.
- NK-0177/0178: contar solo reglas de equipo y ajustar la descripción.

## Fase 3: onboarding y calidad
- Desbordes a 375 px (NK-0179/0180), tests de «Nokko lee» y desplegable reabierto (NK-0181), recordatorio duplicado (NK-0152), almacenamiento seguro en sugerencias (NK-0161), logs sin texto de clientes (NK-0158/0159/0160/0162), comprobar NK-0165, textos NK-0175/0176.

## Fuera de alcance
NK-0171, NK-0167, NK-0168, NK-0173, NK-0174, Torre de control GTM, Salida de Lovable.

## Detalles técnicos
- Primer paso: verificar en el código y la base el estado que describe el documento (MAX_FILES, esquema de onboarding_read, cortes de Drive, `.factory/ledger.json`, políticas actuales). Si algo difiere, se anota en el informe y se adapta.
- Bucket privado `onboarding-sources` creado con la herramienta de almacenamiento; políticas en storage.objects por `org_id` en la primera parte de la ruta, vía `is_org_member`.
- Estados por fuente: columna jsonb aditiva en `onboarding_sessions` (con lectura tolerante del formato antiguo).
- Input nuevo de `onboarding_read`: `sources: {kind, ref, name}[]` (máx. N); reparto de presupuesto y estados como funciones puras con tests.
- Migraciones aditivas, una a una, con vuelta atrás comentada; comprobación de solo lectura antes y después.
- Tests nuevos en archivos nuevos; no se modifican los existentes. Regenerar manifiesto MCP si cambian herramientas.
- Informe vivo en `docs/lovable-run-report.md` por fase, indicando qué se probó con Drive real y qué solo simulado.
