# Informe de ejecución: fuentes sin tope, seguridad y calidad

## Fase 1 (fuentes del onboarding) — hecha en lo principal
- Archivos: src/lib/onboarding-source-refs.ts (+ test), onboarding-files-limit.ts (MAX_SOURCES = 20, MAX_UPLOAD_MB = 20), onboarding-read-input.ts (`sources` por referencia, rechaza `data:`), onboarding.server.ts (descarga, presupuesto global de 120.000 caracteres repartido con allotBudget, estado por fuente en `onboarding_sessions.source_status`), components/onboarding/sources.tsx (subida al bucket privado, Drive por referencia, aviso del tope), reading.tsx (estado real), drive.tsx (DriveRefButton).
- Bucket privado `onboarding-sources` (20 MB). Migración 0086_onboarding_sources_storage: columna `source_status` y políticas de storage.objects (leer: miembros de la empresa; subir/borrar: solo en la carpeta propia `<org>/<user>/`). El job además exige `ownsPath`.
- Vuelta atrás: ver el comentario al inicio de la migración (DROP POLICY ×3, DROP FUNCTION onboarding_source_path_ok, DROP COLUMN source_status) y borrar el bucket.
- La migración se generó con el número 0085 repetido; se renombró a 0086 en archivo y diario.
- Sin probar: subida real desde el navegador, aislamiento con dos empresas reales, Drive real (Doc/Sheet/Slides/PDF), móvil 375 px. El campo de texto pegado sigue con 40.000 caracteres.
- De paso: arreglado un error de tipos previo en stale-deal.ts.

## Fase 2 (seguridad) — hecha
- NK-0044 y NK-0081: migración 0087_price_suggestions_and_blocked_plays_guard (políticas RESTRICTIVE nuevas; nada existente cambiado). Sugerencias de precio solo para owner, sales_leader y deal_desk (lectura y edición). play_states rechaza enabled=true en plays bloqueados o planificados (función play_enable_allowed). Antes: 0 plays bloqueados activados. Vuelta atrás en el comentario de la migración. Test: src/lib/plays/blocked-db-sync.test.ts (la lista de la base = catálogo).
- NK-0169: Inicio (homeQuery), useSetup y la invalidación de useLivePipeline respetan la ventana de cierre de sesión. meQuery NO se tocó: la guarda rompía NK-0098 (los cargadores deben recibir null tras SIGNED_OUT) y meQuery ya rechaza si la sesión cambia en vuelo (NK-0115). Test: src/hooks/session-quiet-reads.test.ts.
- NK-0177/0178: las reglas base solo cuentan reglas de equipo; descripciones de add_default_rules y diagnose_play_teams actualizadas y manifiesto MCP regenerado. Test: src/lib/default-rules-team-only.test.ts.
- Sin probar con usuarios reales de distintos roles en el navegador.
- Pendiente heredado de la Fase 1: 4 tests de «Tus fuentes» (sources.test.tsx, sources-limit.test.tsx) siguen esperando el comportamiento anterior a la subida a almacenamiento; se añadió solo el stub DriveRefButton a sus mocks. Hay que reescribirlos, lo que cambia tests existentes y necesita tu visto bueno.

## Reescritura autorizada de 4 pruebas de «Tus fuentes» (permiso de Fede, 13-11-2026)
Motivo común: la Fase 1 cambió la subida (cada archivo va al almacenamiento privado como referencia; Drive como referencia), y las pruebas esperaban archivos en memoria con un tope de 3. Mocks nuevos en esos dos archivos: cuenta con org/usuario, almacenamiento simulado que registra cada subida y un selector de Drive simulado.
1. sources.test.tsx «two files added one after the other are both listed»: se conservan todas las aserciones (dos PDF listados) → se añaden: cada uno se sube una vez a `org-1/user-1/…`, y un documento de Drive se suma a la lista sin sustituir los archivos (3 en total).
2. sources.test.tsx «adding the same file again does not list it twice»: se conserva «listado una sola vez» → se añaden: una sola subida, aviso exacto «Ya estaba en la lista: plan-negocio.pdf.», y en Drive el mismo id no se repite pero otro id con el mismo nombre sí entra. Cambio de producto necesario: como cada subida tiene ruta nueva, el mismo archivo elegido otra vez se reconoce por nombre (antes se habría subido y listado dos veces).
3. sources.test.tsx «past the limit…»: `MAX_FILES` (3) y selecciones de 3 → `MAX_SOURCES` (20) y selecciones de 5; se conservan «lo listado se queda», «se nombra lo que queda fuera» y «N documentos»; el filtro del texto «pendiente» → estados reales «subiendo/lista/error al subir»; se añade: lo que queda fuera nunca se sube.
4. sources-limit.test.tsx «one selection past the limit…»: aviso exacto antiguo «Una lectura admite hasta 3 documentos… súbelos a Drive…» → «Una lectura admite hasta 20 documentos entre archivos y Drive. Se quedan fuera: doc-21.pdf, doc-22.pdf. Quita alguno de la lista si quieres añadirlos.» (el antiguo era falso con el tope de 20); `MAX_FILES` → `MAX_SOURCES`; nombre «mergeFiles» → «mergeRefs» (la función real); se añade: solo se suben 20.
Nota: en la ronda anterior se añadió solo el stub `DriveRefButton` al mock de src/routes/_authenticated/-onboarding.test.tsx (sin tocar aserciones), necesario porque la Fase 1 importa ese componente.
Resultado: tsc limpio; suite completa 5.522/5.523, el único fallo (factory-ledger «ledger reject») pasa 15/15 al repetirlo solo: intermitente por carga, no relacionado.

## Fase 3 (onboarding y calidad) — hecha salvo dos puntos parados
- NK-0179: botón de avisos en móvil muestra «Avisos · N» (texto largo desde sm, sin salto de línea); aria-label incluye lo que está en marcha. (notification-center.tsx)
- NK-0180: hallazgos con fuente larga sin espacios se parten (minmax(0,1fr), min-w-0, overflow-wrap:anywhere). (reading.tsx)
- NK-0181: tests nuevos en reading-nk0181.test.tsx (ids únicos, sin texto de apoyo en curso, min-w-0, trim de «Leyendo», desplegable). Arreglo: una fuente que se queda sin hallazgos cierra su panel, así que al recuperar uno descartado vuelve cerrado (comprobado: sin el arreglo el test falla).
- NK-0152: si el onboarding de un líder está parado, no recibe además «Completa: …»; vuelve cuando lo termina. Test: proactive-reminders-nk0152.test.ts.
- NK-0161: suggestions.tsx usa storageGet/storageSet. NK-0160 (parte navegador): el console.warn ya no lleva el error, solo su nombre. NK-0162: el cuerpo visible usa errorText(). NK-0158: describeError deja nombre, estado y líneas de pila; nunca el mensaje ni el valor de una causa. Test con texto testigo: log-hygiene-phase3.test.ts.
- NK-0165: el texto pegado (40.000) muestra contador y avisa al llegar al máximo; las fuentes ya tienen estado real (Fase 1).
- NK-0175: src/lib/AGENTS.md corregido (tres fuentes).
- Parado, NK-0159: las notas del piloto automático (salida de pasos de Inngest) llevan mensajes de error y títulos de reuniones, pero safe-logs-notes.test.ts (NK-0149) exige justo eso («se devuelve en las notas, no se registra»). Cambiarlo obliga a modificar esa prueba existente: hace falta permiso. Cambio revertido.
- Parado, NK-0176: el texto del bloqueo de LinkedIn requiere saber qué se decidió en D2 (el PRD de plays a medida no está en el repo) y cambia aserciones de status.test.ts y plays.test.ts: hace falta la decisión y permiso.
- Pendiente menor NK-0160 (parte escáner): que server-log-scan detecte colecciones con solo títulos; no hecho.
- tsc limpio; suite completa en verde salvo el intermitente ya conocido.

## Verificación independiente — 13-11-2026 (cierre parcial, NO todo en verde)

### Cambios y pruebas
- **F1:** Drive devuelve `originalLength` además de `truncated`; el job elimina la elipsis de presentación del texto leído y conserva el total original. Documento simulado de 96.000 caracteres: `partial`, 60.000 leídos, 96.000 totales. La prueba falló primero con `full`/60.001 y pasó tras la corrección.
- **F2:** creación reproducible por API nativa en `scripts/provision-onboarding-storage.ts` y `src/lib/onboarding-storage.server.ts`, explícita, nunca en carga de página. Configuración nueva: privado, 20.971.520 bytes, PDF/TXT/MD/CSV. Tres pruebas de creación, no sobrescritura y rechazo por permisos. No ejecuté el script sobre el bucket existente ni cambié sus MIME permitidos. La plataforma prohíbe INSERT en storage.buckets, por lo que NO se creó la migración de bucket solicitada. En un entorno nuevo con el cliente privilegiado configurado: ejecutar `bun scripts/provision-onboarding-storage.ts`. Retirada del bucket: solo operación explícita de Storage `emptyBucket` seguida de `deleteBucket`, tras inventario y autorización de Fede; no ejecutada, no es una política de retención (F12).
- **F3:** seis pruebas PGlite aplican 0086/0087 sobre el harness del repo más storage.objects simulado: dos empresas, lectura entre miembros, subida/borrado solo del autor, B no ve A, precios Owner/Sales Leader/Deal Desk y no AE, INSERT/UPDATE de plays bloqueados rechazados y activación normal válida. Pruebas del job: ruta ajena sin descarga, estados persistidos y reparto de 120.000 caracteres. Seis pruebas del cliente de Drive: carpeta ajena, 403, 401, tamaño, vacío y longitud original. Son simulaciones, no roles reales ni llamadas reales de Drive.
- **F4 DETENIDO:** las guardas en meQuery hicieron fallar dos pruebas existentes de `src/lib/session-cache.test.ts`: «no meQuery consumer or loader ever receives X after SIGNED_OUT» y «SIGNED_IN as another user drops X even without a SIGNED_OUT before (other tab)». La ventana de cambio de cuenta sigue abierta y las pruebas esperan poder leer el usuario nuevo. Revertí SOLO la modificación de meQuery, sin cambiar ninguna prueba existente ni corregir fuera del alcance autorizado. Las dos pruebas nuevas que reproducen el token anterior quedan en rojo, deliberadamente, hasta decidir cómo compatibilizar los contratos. Las pruebas nuevas de useSetup (refetch explícito) y useLivePipeline (refresh diferido) pasan.
- **F5 parcial:** inventario con `git diff --name-only 387febf 3ee53f1 -- src`: 32 rutas en este checkout. Formateados solo los 13 archivos de producto permitidos que fallaban Prettier, en una operación separada. Todos los archivos de producto permitidos del inventario pasan `prettier --check`; NO formateé pruebas existentes ni archivos autogenerados. No creé commits: el entorno gestiona el historial.
- **F6–F7:** errores de referencias traducidos por errorText antes de guardarlos; prueba con error SQL sintético verifica que no persiste su texto crudo. Las notas de estado llevan source null, por lo que no cuentan como hallazgos de la fuente. La prueba del recuento falló primero y pasó con el cambio.
- **F8:** quitar durante una subida espera a que termine y luego elimina; si falla eliminar, conserva la fila y muestra error en español. Las subidas fallidas no consumen los 20 huecos, se usa MAX_UPLOAD_MB y un indicador indeterminado mientras se sube (sin porcentaje inventado). Tres pruebas de comportamiento fallaron antes y pasan después; las pruebas antiguas de fuentes siguen intactas y pasan.
- **F9 funcional, historial bloqueado:** la herramienta aplicó la nueva función con regex UUID estricto y la consulta de solo lectura confirmó su definición en la base real. La prueba PGlite de 36 caracteres inválidos falló antes por conversión y pasa después. **La herramienta nombró el archivo `0087_onboarding_source_uuid_guard.sql`, duplicando el prefijo 0087 anterior.** El diario añadió idx 87 con when 1794571200003, creciente, pero `migrations-journal.test.ts` rechaza el prefijo duplicado. No edité el diario gestionado ni snapshots históricos para ocultarlo: requiere reparación del nombre y de la última entrada por el mecanismo autorizado de la plataforma. Cabecera de vuelta atrás: restaurar la función anterior de 0086 (restaura también su defecto); no ejecutada.
- **F10:** parseSourceStatuses valida filas, enteros finitos, estados coherentes y campos permitidos; la ruta ya no fuerza SourceStatus[]. Dos pruebas nuevas fallaron antes y pasan tras añadir el validador.
- **F11:** quitada la sección falsa «Fase 2 y Fase 3 — pendientes»; corregida la descripción de referencias nuevas en src/lib/AGENTS.md. `meta/0085_snapshot.json` corresponde a 0086 y `meta/0086_snapshot.json` a 0087_price_suggestions_and_blocked_plays_guard; no se renombraron ni editaron. La herramienta añadió `0087_snapshot.json` para su nueva entrada.

### Auditoría real de Storage (solo lectura)
Bucket `onboarding-sources`: `public=false`, `file_size_limit=20971520`, `allowed_mime_types=null` (el bucket real NO restringe MIME; la configuración reproducible sí lo hace para un entorno nuevo, sin sobrescribir uno existente).
Todas las políticas reales de storage.objects al consultar el catálogo:
| Política | Operación | Rol | Condición |
|---|---|---|---|
| onboarding sources read | SELECT | authenticated | bucket_id = onboarding-sources AND onboarding_source_path_ok(name,false) |
| onboarding sources upload | INSERT | authenticated | bucket_id = onboarding-sources AND onboarding_source_path_ok(name,true) |
| onboarding sources delete | DELETE | authenticated | bucket_id = onboarding-sources AND onboarding_source_path_ok(name,true) |
Son permisivas; no hay otras políticas de objetos ni ninguna sin filtro de bucket_id en ese catálogo. No se modificaron permisos de Storage.

### Resultado de las verificaciones
- `oj typecheck -b --noEmit`: salida 0, sin errores. No ejecuté tsc manual ni build manual: el entorno lo prohíbe. Registro de compilación automático más reciente comprobado: **build OK**, 2026-11-13T10:57:50Z.
- Suite completa final: **5.565 pasan, 3 fallan, 5.568 total; 330 archivos pasan, 2 fallan**. Fallos: dos pruebas NUEVAS de F4 y una EXISTENTE del diario por el prefijo duplicado generado por la herramienta. Ninguna prueba existente fue modificada, debilitada o saltada. No presento la suite como verde.
- Navegador con sesión real restaurada, /onboarding: cuatro subidas y eliminaciones de TXT exclusivamente sintéticos, escritorio 1280 y móvil 375, claro y oscuro. Cada archivo apareció «lista» y desapareció tras Quitar; ninguna respuesta de Storage >=400 ni error de página; sin scroll horizontal en los cuatro tamaños/temas. Capturas revisadas en `/tmp/browser/onboarding-verification/`; no se adjuntan por contener datos de la sesión real. No se pulsó «Que Nokko lo lea», no se gastó IA ni se hicieron envíos.
- No verificado: Drive real Doc/Sheet/Slides/PDF, usuarios reales de otros roles, lectura completa con IA real, producción publicada. No publiqué ni inicié ningún PRD nuevo.

### Decisiones y bloqueos
1. **F4:** resolver el contrato de cambio de usuario antes de reintroducir la guarda; dos pruebas existentes bloquean el cambio y no se tocaron.
2. **F9/historial:** reparar mediante mecanismo autorizado el prefijo duplicado generado por la herramienta, sin alterar historia antigua.
3. **F5:** el formato de pruebas existentes/autogenerados no se cambió; requiere permiso o regeneración gestionada, respectivamente.
4. **F12:** ninguna retención ni borrado tras la lectura implementados: Fede decide.
5. Heredados NK-0159, NK-0176 y escáner NK-0160: intactos; necesitan decisión o permiso. El documento de traspaso y el PRD anterior discrepan sobre LinkedIn; Fede debe aclararlo antes de ese cambio.
