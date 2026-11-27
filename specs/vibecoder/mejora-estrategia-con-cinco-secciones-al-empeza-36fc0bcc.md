# Simplificar el arranque de la estrategia

App: Nokko

INSTRUCCIÓN PARA TU ASISTENTE DE CÓDIGO · Simplificar el arranque de la estrategia
App: Nokko · Versión del cambio: 1
Trabaja sólo en este cambio. Sigue las secciones en orden y no lo des por terminado hasta cumplir la sección 5.

## 1. Objetivo
Un gerente nuevo deja su estrategia aprobada en una sola sesión, sin perderse entre secciones.

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
- CA1. Un equipo nuevo ve solo cinco secciones al entrar a la estrategia.
- CA2. Con un clic en «Ver todas las secciones», aparecen las demás sin perder nada de lo escrito.
- CA3. Toda la información ya guardada en la estrategia sigue intacta y visible tras el cambio.
- CA4. Un gerente nuevo completa y aprueba las cinco secciones en una sola sesión sin ayuda.
- CA5. Cuentas y oportunidades, el asistente y el ingreso funcionan exactamente igual que antes.
Riesgos anotados:
- Una sección oculta con datos podría parecer perdida, así que las que tengan contenido se muestran siempre.
- Como el plano de la información está en blanco, el cambio solo toca qué se muestra y nunca cómo se guarda.
- El asistente podría sugerir algo de una sección oculta, así que su aviso debe llevar a esa sección directamente.

## 4. Guardas de seguridad
- G1. Mantener intacta la forma de guardar la estrategia: el cambio solo decide qué secciones se muestran, sin tocar ni borrar ningún dato guardado.
- G2. Revisar en el servidor que la aprobación de la estrategia solo la pueda dar un gerente de esa misma empresa, aunque la pantalla muestre menos secciones.
- G3. Comprobar en el servidor que una sección oculta sigue aceptando solo datos revisados, para que nadie guarde contenido sin validar por una vía que no se ve.
- G4. Guardar la preferencia de ver todas o solo cinco secciones por persona, sin que cambie lo que ven otros miembros del equipo ni otra empresa.
- G5. Evitar que aprobar con cinco secciones borre, reinicie o marque como vacías las secciones ocultas que ya tenían contenido.
- G6. Asegurar que el aviso del asistente que lleva a una sección oculta solo abre la sección y no aplica ningún cambio sin confirmación.

## 5. Verificación obligatoria
Antes de dar el cambio por cerrado, comprueba cada punto y reporta su resultado:
- [ ] V1. Crear una estrategia con datos en una sección que quedaría oculta, aplicar el cambio y comprobar que esa sección aparece visible con su texto completo.
- [ ] V2. Escribir en una sección, pulsar «Ver todas las secciones» antes de guardar y volver: el texto escrito tiene que seguir ahí sin perder nada.
- [ ] V3. Entrar con un vendedor sin permiso de aprobar e intentar aprobar la estrategia: el sistema tiene que rechazarlo con un mensaje claro.
- [ ] V4. Entrar con dos empresas distintas y comprobar que cada una ve solo su estrategia y que ocultar secciones en una no afecta a la otra.
- [ ] V5. Pedir al asistente una sugerencia sobre una sección oculta y confirmar que lleva a esa sección y no cambia nada hasta que alguien lo confirma.
- [ ] V6. Mover una oportunidad de etapa, entrar, salir y cambiar de cuenta, y cargar contactos hasta el límite diario: todo tiene que comportarse igual que antes del cambio.
- [ ] Se cumplen CA1…CA5, uno por uno.
- [ ] Las piezas de la sección 2 siguen funcionando igual.
Al terminar, responde con: qué archivos cambiaste y el resultado de cada punto de esta sección.
