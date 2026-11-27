# Simplificar el arranque de la estrategia

App: Nokko

INSTRUCCIÓN PARA TU ASISTENTE DE CÓDIGO · Simplificar el arranque de la estrategia
App: Nokko · Versión del cambio: 1
Trabaja sólo en este cambio. Sigue las secciones en orden y no lo des por terminado hasta cumplir la sección 5.

## 1. Objetivo
Un gerente nuevo deja su estrategia aprobada en una sola sesión, viendo solo las cinco secciones que necesita al empezar.

## 2. Reglas: qué NO tocar
- No cambies estas piezas; tienen que seguir funcionando igual: Página de presentación, Ingreso con usuario, Cuentas y oportunidades, Asistente con confirmación, Entrada de contactos, Bandeja de respuestas.
- No cambies el aspecto ni el comportamiento de nada que no esté en «Piezas que toca».
- Si para cumplir el objetivo hace falta tocar otra pieza, frena y pregunta antes de hacerlo.
- No escribas claves, contraseñas ni datos reales de clientes en el código.
- No borres datos guardados ni cambies cómo se guardan sin un paso para volver atrás.

## 3. Spec del cambio
Piezas que toca:
- Estrategia comercial (Lo que ve tu equipo) · cambia
Criterios de aceptación (CA1…CA5):
- CA1. Al entrar por primera vez, un gerente nuevo ve solo cinco secciones.
- CA2. Un gerente nuevo aprueba su estrategia en una sola sesión sin pedir ayuda.
- CA3. Las secciones ocultas se abren con un clic desde «Ver todas las secciones».
- CA4. Las estrategias ya guardadas conservan todos sus datos después del cambio.
- CA5. Cuentas y oportunidades, el asistente y la entrada de contactos funcionan igual que antes.
Riesgos anotados:
- Ocultar secciones puede parecer que se borraron datos, así que se muestra un aviso con el acceso a todas.
- Sin plano de la información se pueden perder datos, así que se comparan estrategias guardadas antes y después del cambio.
- Otras piezas leen datos de la estrategia, así que solo se oculta en pantalla y no cambia nada de lo guardado.

## 4. Guardas de seguridad
- G1. Al aprobar desde la vista de cinco secciones, guardar solo lo que se editó y nunca vaciar ni sobrescribir lo que ya existe en las secciones ocultas.
- G2. Revisar en el servidor que las cinco secciones visibles estén completas antes de marcar la estrategia como aprobada, aunque la pantalla lo permita.
- G3. Dejar que solo el gerente o quien tenga ese permiso apruebe la estrategia, y comprobarlo en el servidor, no solo ocultando el botón.
- G4. Confirmar que «Ver todas las secciones» muestre solo la estrategia de la propia empresa, sin mezclar datos de otras.
- G5. Mantener que el asistente deje pendiente de confirmación cualquier cambio en la estrategia, incluidas las secciones que quedan ocultas.
- G6. Guardar una copia de todas las estrategias antes de publicar el cambio para poder recuperarlas si algo se pierde.

## 5. Verificación obligatoria
Antes de dar el cambio por cerrado, comprueba cada punto y reporta su resultado:
- [ ] V1. Llenar una estrategia con datos en secciones ocultas, aprobarla desde la vista simple y abrir todas: cada dato tiene que seguir igual.
- [ ] V2. Entrar como vendedor e intentar aprobar la estrategia: el sistema lo impide y muestra un mensaje claro, sin texto técnico.
- [ ] V3. Intentar aprobar con una de las cinco secciones vacía: el sistema avisa cuál falta y no la aprueba.
- [ ] V4. Con dos empresas de prueba, abrir «Ver todas las secciones» en la primera: no aparece nada de la segunda.
- [ ] V5. Pedir al asistente que cambie una sección oculta: el cambio queda pendiente y no se guarda hasta confirmarlo.
- [ ] V6. Entrar, salir y cambiar de cuenta, abrir la bandeja de respuestas y la página de presentación: todo funciona igual que antes del cambio.
- [ ] Se cumplen CA1…CA5, uno por uno.
- [ ] Las piezas de la sección 2 siguen funcionando igual.
Al terminar, responde con: qué archivos cambiaste y el resultado de cada punto de esta sección.
