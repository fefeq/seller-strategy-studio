# Ola 1 · Informe de entrega parcial

Fecha: 14-11-2026. SDD aprobado: `.lovable/plan/sdd-ola-1-agrupación-del-menú-y-glosario-único-2026-11-14.md`.

## Cambios
- Cinco grupos en el orden aprobado; Hoy conserva cuatro enlaces siempre visibles. URLs y permisos intactos.
- Ciclo GTM, Debates y Theory U ocultos por defecto en el menú; interruptor local por usuario, sin cambiar acceso por URL. Almacenamiento bloqueado no impide utilizar el interruptor durante la sesión.
- ⌘K conserva los 26 destinos, avanzados y Conectar asistentes incluidos; Onboarding y Respuestas ya no aparecen duplicados. Asesor conserva `leadersOnly`.
- Conectar asistentes desaparece del menú independiente; el enlace existente dentro de Conexiones permanece intacto. No se ha cambiado Conexiones.
- Glosario parcial: «Valor anual (ACV)» en resumen de líneas del deal y ayuda de ese rótulo; «Modelo de venta» en el rótulo visible del filtro de Plays; «guías de venta» en su descripción. Sin cambios de cálculos ni identificadores.

## Pruebas y calidad
- Ocho pruebas nuevas en `nav-wave-one.test.ts`, `nav-advanced.test.ts`, `palette-wave-one.test.ts` y `glossary-wave-one.test.ts`. Fallaron antes de cada cambio; pasan después.
- `nav.test.ts`: solo expectativas de ubicación de Asesor, Plays y apertura contextual adaptadas. Límites, acceso por rol, búsqueda por «equipos» y lectura compartida del catálogo conservados. Ninguna otra prueba existente modificada.
- Suite completa: **4737/4737**, 393 archivos. Repetición selectiva tras formato: **18/18**, incluida regla de iconos.
- `oj typecheck -b --noEmit`: sin errores. Compilación automática: build OK.
- Lint de menú, preferencia, ⌘K, nuevas pruebas y paneles: cero errores; tres avisos Fast Refresh existentes en command-palette y deal-lines.
- `field-help-data.ts` mantiene 151 errores de formato del archivo existente, que no se reformateó por evitar un diff masivo y cambios de textos de integraciones fuera de alcance. No se declara lint global limpio.
- Navegador con sesión de Fede y empresa activa: Hoy visible, avanzado inicialmente apagado, activación y persistencia tras recarga, apagado, ⌘K con avanzados/asistentes/Onboarding/Respuestas una vez, enlace Conexiones→asistentes y cierre móvil al navegar a Respuestas. Escritorio 1280 y móvil 375 en claro/oscuro: sin desplazamiento horizontal ni errores de página. No se alteraron datos de empresa ni se llamaron proveedores.

## Límites y pendientes
- **Glosario 1.2 no cerrado:** «Equipos de plays» está fijado por `src/routes/_authenticated/-plays.test.tsx`; «Playbooks» por `src/components/hub/hub-screen.test.tsx`. Se han detenido esas sustituciones: necesitan permiso específico, no cubierto por la autorización exclusiva de `nav.test.ts`.
- El nombre accesible «Filtrar por motion» también está fijado por `src/components/plays/plays-panel.test.tsx` y `src/routes/_authenticated/-plays.test.tsx`; se ha conservado para no romper pruebas protegidas. El rótulo visible sí usa «Modelo de venta».
- Textos de IA, herramientas, prompts y reglas de negocio no se normalizaron: fuera de alcance. Revisión independiente pendiente. No se ha probado iniciar sesión con otro rol; su selección de destinos sí está cubierta por pruebas automáticas.
- Sin publicación, migraciones, pantallas nuevas, modificación de RLS, Drive, Gmail, Apollo, Clay, Apify/LinkedIn ni respaldo de IA. Sin commits manuales: el entorno gestiona el historial.

## Drive (solo lectura de código)
Actualmente una credencial compartida en `google-drive.ts`, con carpetas por empresa y comprobaciones de pertenencia en `drive-core.ts`; no hay selección de una conexión independiente por empresa. Falta autorización y vinculación por empresa, resolución de su conexión en cada operación, gestión de desconexión y pruebas de aislamiento entre conexiones. La transición de carpetas existentes requiere autorización aparte. No se leyó contenido de Drive ni se verificó su cuenta o vigencia alojada.