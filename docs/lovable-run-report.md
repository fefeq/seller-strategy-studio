# Informe de ejecución: fuentes sin tope, seguridad y calidad

## Fase 1 (fuentes del onboarding) — hecha en lo principal
- Archivos: src/lib/onboarding-source-refs.ts (+ test), onboarding-files-limit.ts (MAX_SOURCES = 20, MAX_UPLOAD_MB = 20), onboarding-read-input.ts (`sources` por referencia, rechaza `data:`), onboarding.server.ts (descarga, presupuesto global de 120.000 caracteres repartido con allotBudget, estado por fuente en `onboarding_sessions.source_status`), components/onboarding/sources.tsx (subida al bucket privado, Drive por referencia, aviso del tope), reading.tsx (estado real), drive.tsx (DriveRefButton).
- Bucket privado `onboarding-sources` (20 MB). Migración 0086_onboarding_sources_storage: columna `source_status` y políticas de storage.objects (leer: miembros de la empresa; subir/borrar: solo en la carpeta propia `<org>/<user>/`). El job además exige `ownsPath`.
- Vuelta atrás: ver el comentario al inicio de la migración (DROP POLICY ×3, DROP FUNCTION onboarding_source_path_ok, DROP COLUMN source_status) y borrar el bucket.
- La migración se generó con el número 0085 repetido; se renombró a 0086 en archivo y diario.
- Sin probar: subida real desde el navegador, aislamiento con dos empresas reales, Drive real (Doc/Sheet/Slides/PDF), móvil 375 px. El campo de texto pegado sigue con 40.000 caracteres.
- De paso: arreglado un error de tipos previo en stale-deal.ts.

## Fase 2 y Fase 3 — pendientes
No empezadas en esta ronda.

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
