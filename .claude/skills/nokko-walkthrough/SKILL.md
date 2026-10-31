---
name: nokko-walkthrough
description: Capa 4 de la factory NOKKO. Un agente usa la app construida como una persona (móvil y escritorio, claro y oscuro) mirando consola y red mientras hace clic, con capturas como evidencia. Úsala tras el gate para cada flujo cambiado.
---

# El agente usa la app como una persona

Hazlo con el navegador integrado (`mcp__Claude_Browser__*`) sobre la app construida o el servidor local (`preview_start`), **nunca contra producción** y con datos ficticios. No uses claves reales ni cuentas de clientes.

## Pasos por cada flujo cambiado
1. Lista los flujos tocados a partir del SDD y el diff (CA y casos límite de la sección 8).
2. Para cada flujo, a **375 px (móvil)** y a **escritorio**, en **claro y oscuro** (`resize_window` con `colorScheme`): abrir, escribir, enviar, volver, recargar y probar sin red y con vuelta de la red.
3. **Con los ojos en los logs:** `read_console_messages` y `read_network_requests` mientras haces clic. Un flujo que se ve bien pero lanza un error o dispara una petición duplicada **falla**.
4. **Capturas en cada paso**, comparadas entre anchos y temas: texto cortado, solapes, parpadeos, estados en blanco, scroll horizontal.
5. Guarda capturas y un resumen en `.factory/evidence/<ticket>/walkthrough/` (el resumen cita cada captura).
6. Un flujo roto vuelve a `nokko-build` con los pasos exactos para reproducirlo.

## Reglas
- Termina restaurando `resize_window` a `desktop`.
- Reporta lo que no pudiste recorrer (por ejemplo un proveedor externo o una grabación de frames): no lo des por cubierto.
- Las capturas no deben contener datos de clientes.
