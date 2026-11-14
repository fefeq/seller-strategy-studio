# Verificaciones visuales y revisiones pendientes

Solo comprobaciones: no se cambia ninguna funcionalidad ni ninguna prueba existente, no se publica nada y no hay gasto. Si una comprobación encuentra un fallo, se apunta en el informe y se corrige aparte, solo si es un ajuste visual claro.

## 1. Onboarding: pantalla de hallazgos
- Abrir /onboarding en la «Empresa de prueba Nokko» con una lectura sintética ya terminada (hallazgos de prueba con fuentes web, PDF y nota, sin llamar a la IA). Antes no se abrió porque faltaban datos en la base; ahora se prepararán esos datos en una sola fila de la empresa de prueba y se borrarán al terminar.
- Comprobar: el propósito de cada fuente, la guía de Confirmar / Editar / Descartar y que cada botón cambia el estado («Confirmado por ti», edición guardada, «Descartado»). Comprobar también que el texto no dice que descartar recalcula la propuesta.
- En escritorio (1280) y móvil (375), en tema claro y oscuro, sin desbordamiento lateral.

## 2. Verificación de email (NK-0173): tres fichas
- Fichas de contacto, lead y cuenta (personas) de la empresa de prueba, con los seis contactos sintéticos que ya existen (verificado, caducado, sin verificar, con error, sin email y con email alternativo propuesto).
- Comprobar las etiquetas de estado, «Verificar email» / «Conseguir email» y que un email cambiado nunca aparece como verificado.
- Escritorio y móvil, claro y oscuro. Las capturas se guardan como prueba.

## 3. Revisiones independientes
Una revisión cruzada de código, separada de quien lo escribió, por cada entrega que la tiene pendiente en la lista de tareas:
- NK-0176 (bloqueo de LinkedIn), NK-0171 (plays a medida: reservas, repetición de gasto, pausas de seguridad), NK-0167 (líneas de negocio: integridad, copia, edición, lectura por pantallas), hallazgos del onboarding, NK-0174 SDD 1 (puerta legal y lector cerrado de Gmail).
- Concurrencia de NK-0167: dos sesiones simultáneas contra una base de pruebas local (la misma que usan las pruebas de base de datos), intentando elegir dos principales a la vez y borrar la principal mientras otra la cambia. No se toca la base real.
- Cada revisión deja hallazgos en un informe con: sin problemas / problema menor / problema que bloquea el cierre. Solo se declara cerrada una entrega si no tiene problemas que bloqueen y Fede acepta.

## Resultado
- Informe `docs/verificacion-20261114.md` con capturas, hallazgos y estado de cada entrega.
- Lista de tareas actualizada: qué queda cerrado técnicamente y qué espera tu aceptación.

## Detalles técnicos
- Navegador: Playwright con sesión de Fede, cambiando a la empresa de prueba y devolviendo Postin como empresa activa al final.
- Datos de hallazgos: una fila temporal en onboarding_sessions del usuario de prueba, restaurada después; sin trabajos en segundo plano ni IA.
- Revisión: subagentes independientes, solo lectura, con la lista de reglas de cada SDD; concurrencia con dos conexiones PGlite/pg sobre el arnés de pruebas existente, en archivos de prueba nuevos.
