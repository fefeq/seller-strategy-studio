# Verificación 14-11-2026: pases visuales y revisiones independientes

Sin publicar, sin gasto, sin cambios en pruebas existentes. Capturas en `docs/verificacion-20261114/`.

## 1. Onboarding · hallazgos (guía de lectura)
- Datos: lectura sintética temporal (4 hallazgos, 3 fuentes: web, PDF, nota) en «Empresa de prueba Nokko»; borrada después y Postin restaurada como empresa activa.
- Visto: «Lectura terminada», guía Confirmar / Editar / Descartar, «Para qué sirve» por fuente, aviso de que descartar **no** recalcula la propuesta.
- Acciones: Confirmar → «Confirmado por ti el 14 nov»; Descartar → pasa a descartados. Editar no se probó en navegador (cubierto por pruebas).
- Escritorio 1280 y móvil 375, claro y oscuro: sin desbordamiento en escritorio; en móvil la barra superior se salía 11 px («Menú» cortado). **Corregido** (separación menor bajo 400 px); medido de nuevo: 0 px en /onboarding e Inicio.

## 2. Verificación de email (NK-0173)
- Personas en la empresa de prueba, escritorio/móvil, claro/oscuro: Laura Prueba muestra email y «sin verificar»; 0 px de desbordamiento en las cuatro combinaciones.
- Ampliado (11:50): los seis contactos sintéticos siguen como personas clave de «Cuenta de prueba Nokko» (no en Personas). Abiertos uno a uno en escritorio/móvil, claro/oscuro: verificado, catch-all, no verificable, inválido (en rojo), sin verificar → «Verificar email»; sin email → «Conseguir email». 0 px de desbordamiento en las 24 combinaciones.
- Caducidad: un email verificado hace 120 días se mostró como «sin verificar» en Personas (regla de 90 días). Datos temporales borrados después.
- No probado: email alternativo propuesto (no hay caso sintético) y pulsar los botones (gastaría créditos de Apollo).

## 3. Revisiones independientes (revisor separado, solo lectura)
| Entrega | Resultado | Detalle |
|---|---|---|
| NK-0176 LinkedIn | Sin problemas | Bloqueo, permisos y cierre D2 coherentes. |
| NK-0171 Plays | Sin problemas | Reserva antes de llamar, sin repetir reservas inciertas, commit atómico, activación no borra pausas, Inngest solo contadores. |
| Guía de hallazgos | Sin problemas | No promete recalcular; reutiliza las acciones existentes. |
| NK-0174 SDD 1 | Bloqueante resuelto por enmienda; 2 menores corregidos | R-1 pedía coincidir con el login, pero el buzón de Fede es otro: SDD enmendado (riesgo aceptado mientras haya un solo superadmin). Corregidos: el registro de errores de Gmail ya no guarda el cuerpo de la respuesta; la tarjeta ya no promete detección/pausa que llegan en SDD 2. |
| NK-0167 Líneas | Bloqueante **corregido**, 1 menor | Corregido el 14-11 (el paso se reinicia al cambiar de empresa; prueba nueva): en el paso de líneas, un borrador abierto sobrevive al cambiar de empresa y se guardaría en la nueva (falta reiniciar el formulario por empresa). Menor: un borrado directo del Owner fuera de la pantalla puede dejar cero líneas (permitido por el SDD §8). |

### Concurrencia NK-0167 (dos conexiones reales, PostgreSQL 16 local desechable, migración 0095 tal cual)
- Dos sesiones eligen principal a la vez → queda exactamente 1 principal; ambas terminan.
- Borrar la principal mientras otra sesión la cambia → 2 líneas, 1 principal; ambas terminan.
- Tres altas simultáneas con 2 líneas (tope 4) → 4 líneas, 1 principal; la tercera recibe «Puedes guardar hasta cuatro líneas».
- Sin interbloqueos en el registro. **Requisito de concurrencia real cumplido.**

## Estado para cierre
- Listas para tu aceptación: NK-0176, NK-0171 (U-1..U-5), guía de hallazgos, NK-0174 SDD 1.
- También listas para tu aceptación: NK-0167 (bloqueante corregido, concurrencia superada) y NK-0173 (pase visual completo salvo email alternativo).

## Aceptación formal (14-11-2026)
- NK-0176: aceptado por Fede.
- Guía de hallazgos del onboarding: aceptado por Fede.
- NK-0167 SDD 1–3: aceptado por Fede.
- NK-0171: pendiente de 1 señal real válida (autorizado).
- NK-0173: pendiente de 1 revelado Apollo (autorizado).
- NK-0174 SDD 1: pendiente de 1 lectura real de solo lectura (autorizada).

### Resultados del gate (14-11-2026, 14:24 UTC)
- NK-0171: una ejecución real de R-1 con «Supergrow» como competidor (run 037a86e7): 3/3 pasos, 0 señales que nombren a Supergrow, 0 sugerencias. Gasto: IA medida 0,00127 USD y búsqueda estimada 0,01 EUR. El play queda en pausa y no se reintenta. Hallazgo: una ejecución de las 09:55 seguía «en curso» con sus pasos ya cerrados. La recuperación devolvió contadores 2/2 que no eran de esa ejecución. Se cerró a mano. Residuo: revisar los contadores de recuperación.
- NK-0174 SDD 1: una revisión real de solo lectura (fecha guardada a las 14:24, 0 respuestas). En la empresa vinculada no hay leads en «Contactado» con email, así que no se llegó a buscar en Gmail. La lectura real de Gmail sigue sin probar.
- NK-0173: revelado no lanzado. Los seis contactos de prueba son ficticios (example.com, sin dominio) y Apollo no puede encontrarlos, así que el crédito se perdería. Espera un contacto real que decida Fede.
