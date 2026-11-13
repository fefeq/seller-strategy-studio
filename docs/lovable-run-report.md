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
