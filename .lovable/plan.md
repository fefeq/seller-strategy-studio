# Panel de seguimiento de sugerencias

## Objetivo
Una vista de equipo donde se ven todas las sugerencias abiertas, en qué estado están y quién es responsable de cada una, para que ninguna se quede sin atender.

## Situación actual
- Sugerencias solo muestra las tuyas y las que no tienen responsable. Las asignadas a otras personas no las ve nadie más, ni siquiera el Owner.
- Las pospuestas desaparecen de la lista hasta su fecha, así que es fácil olvidarlas.
- Muchas sugerencias no tienen responsable y no hay forma de asignarlas.

## Qué se construye
Una nueva pestaña **«Equipo»** dentro de Sugerencias (la pestaña actual pasa a llamarse «Para mí"):

1. **Resumen arriba**: pendientes, urgentes, sin responsable, pospuestas y vencidas (pendientes de más de 7 días).
2. **Tabla de sugerencias** con: prioridad, título, responsable, estado, antigüedad y enlace a la pantalla afectada.
   - Estados: Pendiente, Pospuesta (hasta qué fecha), y en un filtro aparte las cerradas recientes: Aprobada, Descartada, Resuelta sola.
   - Filtros: por responsable (incluido «Sin responsable»), estado y prioridad.
   - Agrupación opcional por persona, con su número de pendientes y urgentes.
3. **Asignar y reasignar**: Owner y Sales Leader eligen el responsable de cualquier sugerencia. Cada persona puede quedarse con una sin responsable («Me la quedo").
4. **Acciones**: aprobar, posponer o descartar desde la tabla, con las mismas reglas que hoy.

## Quién ve qué
- **Owner y Sales Leader**: todas las sugerencias de la empresa.
- **Resto de roles**: las suyas y las que no tienen responsable (como ahora).

## Detalles técnicos
- Permisos de lectura y actualización de las sugerencias: se amplían para que Owner y Sales Leader vean y reasignen las de todo el equipo. El resto sigue limitado a las suyas y las que no tienen responsable.
- Aprobar o rechazar sigue pasando por la función actual del servidor, que comprueba el rol.
- Los cálculos de resumen y vencimiento van en un módulo puro y probado (umbral de 7 días, recuento de las que no tienen responsable y de las pospuestas).
- Los nombres de los responsables salen de los miembros de la empresa. La lista se refresca en vivo junto con el resto.
- La herramienta del agente que lista sugerencias aplicará la misma regla de visibilidad.

## Fuera de alcance
- Avisos por email o Telegram al reasignar (se puede añadir después).
