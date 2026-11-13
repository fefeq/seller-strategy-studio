# NK-0171 · Siguiente paso: dónde se guardan los plays a medida (U-2)

Ya están hechas las reglas que deciden si un play a medida propuesto por la IA es válido (U-1). Ahora toca prepararle un sitio donde guardarse, sin que se vea nada nuevo en pantalla todavía.

## Qué se construye
- Tres espacios por empresa: los plays a medida, las pruebas que los respaldan (fuente y cita) y el gasto de cada uno.
- Cada empresa solo ve lo suyo. Los miembros pueden leer; solo el servidor de Nokko puede escribir (igual que con los bloqueos de email).
- Opción «solo contacto verificado» por play, apagada por defecto.
- Las pruebas se guardan mientras exista el play, sin plazo. El gasto se conserva aunque se borre el play.
- Las citas guardadas nunca llevan emails ni teléfonos (la base lo rechaza también).

## Cómo se comprueba
- Prueba nueva primero (debe fallar sin la migración): aislamiento entre empresas, miembro y Owner no pueden escribir, el servidor sí, lectura de miembros, gasto que sobrevive al borrado, opción verificada apagada por defecto.
- Catálogo de campos actualizado para que la prueba de cobertura siga en verde.
- Suite completa y compilación en verde. Ninguna prueba existente se toca.

## Después (siguientes entregas de NK-0171)
SDD 2: las tres recetas (R-1..R-3) y qué fecha cuenta como «el evento»; luego la herramienta del asistente y la ejecución. Luego NK-0167 y NK-0174, y la pantalla de hallazgos del onboarding.

## Detalle técnico
- Migración nueva vía herramienta de migraciones: `custom_plays` (org_id default current_org(), key con prefijo `custom:`, definición jsonb, verified_only bool default false), `custom_play_evidence` (FK a custom_plays ON DELETE CASCADE, url, quote ≤280 con CHECK anti email/teléfono), `custom_play_costs` (play_key texto sin FK, para no cascadear). GRANT SELECT a authenticated, ALL a service_role, RLS de lectura por membresía; sin políticas de escritura. Vuelta atrás en cabecera. Revisar prefijo duplicado tras crearla.
- Prueba PGlite `custom-plays.pg.test.ts`; entradas en `field-catalog.ts`; actualizar SDD, roadmap e informe.
