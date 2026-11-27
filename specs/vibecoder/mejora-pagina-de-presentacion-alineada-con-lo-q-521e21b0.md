# Alinear la página con el producto

App: Nokko

INSTRUCCIÓN PARA TU ASISTENTE DE CÓDIGO · Alinear la página con el producto
App: Nokko · Versión del cambio: 1
Trabaja sólo en este cambio. Sigue las secciones en orden y no lo des por terminado hasta cumplir la sección 5.

## 1. Objetivo
Que quien visita la página entienda lo que Nokko hace hoy y llegue al equipo sin promesas que la app no cumple.

## 2. Reglas: qué NO tocar
- No cambies estas piezas; tienen que seguir funcionando igual: Estrategia comercial, Entrada de contactos, Asistente comercial, Bandeja de respuestas, Ingreso con usuario, Carpetas por empresa.
- No cambies el aspecto ni el comportamiento de nada que no esté en «Piezas que toca».
- Si para cumplir el objetivo hace falta tocar otra pieza, frena y pregunta antes de hacerlo.
- No escribas claves, contraseñas ni datos reales de clientes en el código.
- No borres datos guardados ni cambies cómo se guardan sin un paso para volver atrás.

## 3. Spec del cambio
Piezas que toca:
- Página de presentación (Lo que ven tus clientes) · cambia
Criterios de aceptación (CA1…CA5):
- CA1. Un visitante lee el titular y en diez segundos dice qué hace Nokko y para quién.
- CA2. Cada promesa de la página corresponde a algo que el equipo ya usa dentro de la app.
- CA3. La página no menciona la bandeja de respuestas ni las carpetas por empresa mientras no estén listas.
- CA4. Un contacto enviado desde la página entra con el mismo tope diario que antes.
- CA5. La estrategia comercial se arma y se aprueba igual que antes del cambio.
Riesgos anotados:
- Si la página anuncia algo a medio terminar, el cliente se frustra; publica sólo lo que ya está hecho.
- Al rehacer la página, el formulario puede dejar de enviar contactos; prueba un envío antes de publicar.
- Un titular demasiado general vuelve a contar otro producto; léeselo a dos gerentes de ventas antes de publicarlo.

## 4. Guardas de seguridad
- G1. Revisar en el servidor que cada contacto del formulario traiga nombre y correo válido antes de guardarlo, y rechazar textos demasiado largos o con enlaces.
- G2. Guardar un solo registro si llega el mismo correo dos veces en pocos minutos, y avisar al visitante que ya se recibió.
- G3. Usar en la página sólo ejemplos inventados, sin nombres de clientes, cifras ni capturas con datos reales de ninguna empresa.
- G4. Mostrar un mensaje claro con un paso a seguir cuando el formulario falle, nunca el error tal cual llega.
- G5. Asignar cada contacto de la página a la empresa correcta, para que ninguna otra empresa pueda verlo.
- G6. Hacer que el botón de entrar lleve a la pantalla de ingreso actual sin cambiar ninguna de sus reglas.

## 5. Verificación obligatoria
Antes de dar el cambio por cerrado, comprueba cada punto y reporta su resultado:
- [ ] V1. Enviar el formulario vacío y luego con un correo mal escrito: no se guarda nada y aparece un mensaje claro.
- [ ] V2. Enviar dos veces seguidas el mismo contacto: dentro de la app aparece una sola vez.
- [ ] V3. Entrar con un usuario de otra empresa: el contacto de prueba no aparece en ningún lado.
- [ ] V4. Abrir la página sin sesión y tocar cada enlace: ninguno muestra pantallas internas sin pedir usuario.
- [ ] V5. Desde el botón de entrar, ingresar con un vendedor y con un gerente: ambos llegan a su pantalla de siempre.
- [ ] V6. Con un vendedor dentro de la app: la bandeja de respuestas sigue oculta y el asistente sigue dejando sus propuestas pendientes.
- [ ] Se cumplen CA1…CA5, uno por uno.
- [ ] Las piezas de la sección 2 siguen funcionando igual.
Al terminar, responde con: qué archivos cambiaste y el resultado de cada punto de esta sección.
