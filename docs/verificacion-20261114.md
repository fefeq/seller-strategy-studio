# Verificación 14-11-2026: pases visuales y revisiones independientes

Sin publicar, sin gasto, sin cambios en pruebas existentes. Capturas en `docs/verificacion-20261114/`.

## 1. Onboarding · hallazgos (guía de lectura)
- Datos: lectura sintética temporal (4 hallazgos, 3 fuentes: web, PDF, nota) en «Empresa de prueba Nokko»; borrada después y Postin restaurada como empresa activa.
- Visto: «Lectura terminada», guía Confirmar / Editar / Descartar, «Para qué sirve» por fuente, aviso de que descartar **no** recalcula la propuesta.
- Acciones: Confirmar → «Confirmado por ti el 14 nov»; Descartar → pasa a descartados. Editar no se probó en navegador (cubierto por pruebas).
- Escritorio 1280 y móvil 375, claro y oscuro: sin desbordamiento en escritorio; en móvil la barra superior se salía 11 px («Menú» cortado). **Corregido** (separación menor bajo 400 px); medido de nuevo: 0 px en /onboarding e Inicio.

## 2. Verificación de email (NK-0173)
- Personas en la empresa de prueba, escritorio/móvil, claro/oscuro: Laura Prueba muestra email y «sin verificar»; 0 px de desbordamiento en las cuatro combinaciones.
- Limitación: los otros cinco contactos sintéticos ya no existen en la base (solo queda Laura), así que solo se vio el estado «sin verificar». Los estados verificado / caducado / error / sin email / alternativo propuesto no se vieron en este pase. El menú «Acciones» (Verificar / Conseguir email) no se abrió.

## 3. Revisiones independientes (revisor separado, solo lectura)
| Entrega | Resultado | Detalle |
|---|---|---|
| NK-0176 LinkedIn | Sin problemas | Bloqueo, permisos y cierre D2 coherentes. |
| NK-0171 Plays | Sin problemas | Reserva antes de llamar, sin repetir reservas inciertas, commit atómico, activación no borra pausas, Inngest solo contadores. |
| Guía de hallazgos | Sin problemas | No promete recalcular; reutiliza las acciones existentes. |
| NK-0174 SDD 1 | Bloqueante resuelto por enmienda; 2 menores corregidos | R-1 pedía coincidir con el login, pero el buzón de Fede es otro: SDD enmendado (riesgo aceptado mientras haya un solo superadmin). Corregidos: el registro de errores de Gmail ya no guarda el cuerpo de la respuesta; la tarjeta ya no promete detección/pausa que llegan en SDD 2. |
| NK-0167 Líneas | **1 bloqueante abierto**, 1 menor | Bloqueante: en el paso de líneas, un borrador abierto sobrevive al cambiar de empresa y se guardaría en la nueva (falta reiniciar el formulario por empresa). Menor: un borrado directo del Owner fuera de la pantalla puede dejar cero líneas (permitido por el SDD §8). |

### Concurrencia NK-0167 (dos conexiones reales, PostgreSQL 16 local desechable, migración 0095 tal cual)
- Dos sesiones eligen principal a la vez → queda exactamente 1 principal; ambas terminan.
- Borrar la principal mientras otra sesión la cambia → 2 líneas, 1 principal; ambas terminan.
- Tres altas simultáneas con 2 líneas (tope 4) → 4 líneas, 1 principal; la tercera recibe «Puedes guardar hasta cuatro líneas».
- Sin interbloqueos en el registro. **Requisito de concurrencia real cumplido.**

## Estado para cierre
- Listas para tu aceptación: NK-0176, NK-0171 (U-1..U-5), guía de hallazgos, NK-0174 SDD 1.
- Sin cierre: NK-0167 hasta corregir el borrador al cambiar de empresa. NK-0173 visual parcial (faltan los demás estados).
