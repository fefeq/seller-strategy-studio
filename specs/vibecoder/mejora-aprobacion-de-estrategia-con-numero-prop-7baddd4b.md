# Separar el número repetido de estrategia

App: Nokko

INSTRUCCIÓN PARA TU ASISTENTE DE CÓDIGO · Separar el número repetido de estrategia
App: Nokko · Versión del cambio: 1
Trabaja sólo en este cambio. Sigue las secciones en orden y no lo des por terminado hasta cumplir la sección 5.

## 1. Objetivo
Que la aprobación de estrategia se guarde siempre con su número propio, para que nunca quede sin aplicar ni choque con los gastos.

## 2. Reglas: qué NO tocar
- No cambies estas piezas; tienen que seguir funcionando igual: Cuentas y oportunidades, Asistente comercial, Bandeja Hoy, Gastos y moneda, Entrada de contactos, Espacio por empresa.
- No cambies el aspecto ni el comportamiento de nada que no esté en «Piezas que toca».
- Si para cumplir el objetivo hace falta tocar otra pieza, frena y pregunta antes de hacerlo.
- No escribas claves, contraseñas ni datos reales de clientes en el código.
- No borres datos guardados ni cambies cómo se guardan sin un paso para volver atrás.

## 3. Spec del cambio
Piezas que toca:
- Estrategia comercial (Lo que ven tus clientes) · cambia
Criterios de aceptación (CA1…CA5):
- CA1. El cambio guardado de la aprobación de estrategia tiene un número propio que ningún otro cambio repite.
- CA2. Al aplicar todos los cambios guardados, la aprobación de estrategia y el registro de gastos quedan los dos activos.
- CA3. Antes de guardar una aprobación, la app revisa que las cinco secciones estén completas y, si falta una, dice cuál.
- CA4. El gerente aprueba una estrategia completa y la sigue viendo aprobada al volver a entrar.
- CA5. Gastos y moneda, Bandeja Hoy, cuentas y oportunidades y el asistente comercial siguen funcionando igual que antes del cambio.
Riesgos anotados:
- Si se renumera el cambio de gastos en vez del de estrategia, los gastos podrían fallar; se cambia sólo el número de estrategia.
- Las estrategias ya aprobadas podrían perder su aprobación; se guarda una copia de respaldo y se comprueba que siguen aprobadas.
- La revisión podría bloquear borradores a medias; se revisa sólo al aprobar, no al editar.

## 4. Guardas de seguridad
- G1. Hacer que el cambio renumerado se pueda aplicar dos veces sin duplicar aprobaciones ni borrar las que ya existen en la empresa.
- G2. Revisar por detrás, no sólo en pantalla, que quien aprueba tenga el rol de gerente dentro de la misma empresa de la estrategia.
- G3. Contar como vacía toda sección que tenga sólo espacios o texto de ejemplo, y rechazar la aprobación nombrando esa sección.
- G4. Guardar en cada aprobación quién aprobó, cuándo y de qué empresa, para que nunca aparezca en el espacio de otra empresa.
- G5. Probar que la copia de respaldo se puede recuperar completa antes de aplicar el cambio con datos reales.
- G6. Dejar sin tocar el número y el contenido del cambio de gastos, y comprobarlo comparándolo con la versión anterior.

## 5. Verificación obligatoria
Antes de dar el cambio por cerrado, comprueba cada punto y reporta su resultado:
- [ ] V1. Aplicar todos los cambios sobre una copia con estrategias ya aprobadas: la cantidad de aprobadas tiene que ser la misma antes y después.
- [ ] V2. Aplicar el cambio de estrategia dos veces seguidas: no tiene que aparecer ninguna aprobación repetida.
- [ ] V3. Entrar como vendedor e intentar aprobar una estrategia completa: la app tiene que rechazarlo y la estrategia sigue sin aprobar.
- [ ] V4. Entrar como gerente de una empresa e intentar aprobar la estrategia de otra empresa: la app tiene que negarlo y no mostrar nada de esa empresa.
- [ ] V5. Llenar una sección sólo con espacios e intentar aprobar: la app tiene que rechazarlo y decir qué sección falta.
- [ ] V6. Abrir Hoy con una estrategia pendiente y cargar un gasto viejo en euros: la aprobación tiene que aparecer en Hoy y el gasto seguir marcado para revisar.
- [ ] Se cumplen CA1…CA5, uno por uno.
- [ ] Las piezas de la sección 2 siguen funcionando igual.
Al terminar, responde con: qué archivos cambiaste y el resultado de cada punto de esta sección.
