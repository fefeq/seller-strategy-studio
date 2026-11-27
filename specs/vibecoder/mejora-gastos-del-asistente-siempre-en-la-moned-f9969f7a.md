# Corregir la moneda de los gastos

App: Nokko

INSTRUCCIÓN PARA TU ASISTENTE DE CÓDIGO · Corregir la moneda de los gastos
App: Nokko · Versión del cambio: 1
Trabaja sólo en este cambio. Sigue las secciones en orden y no lo des por terminado hasta cumplir la sección 5.

## 1. Objetivo
Que cada gasto del asistente quede anotado en la moneda de tu empresa y tus reportes cuadren con lo que pagas.

## 2. Reglas: qué NO tocar
- No cambies estas piezas; tienen que seguir funcionando igual: Estrategia comercial, Entrada de contactos, Bandeja de respuestas, Ingreso con usuario, Carpetas por empresa, Página de presentación.
- No cambies el aspecto ni el comportamiento de nada que no esté en «Piezas que toca».
- Si para cumplir el objetivo hace falta tocar otra pieza, frena y pregunta antes de hacerlo.
- No escribas claves, contraseñas ni datos reales de clientes en el código.
- No borres datos guardados ni cambies cómo se guardan sin un paso para volver atrás.

## 3. Spec del cambio
Piezas que toca:
- Asistente comercial (Lo que ve tu equipo) · cambia
Criterios de aceptación (CA1…CA6):
- CA1. Cada gasto nuevo del asistente aparece en la moneda que tiene configurada la empresa.
- CA2. Si un gasto llega sin moneda o con una distinta, la app no lo guarda y avisa al gerente.
- CA3. Dos empresas con monedas distintas ven cada una sus gastos en su propia moneda.
- CA4. Los gastos viejos anotados en euros quedan marcados para revisar, sin borrarse ni convertirse solos.
- CA5. Todo cambio que propone el asistente sigue pendiente hasta que alguien lo confirma.
- CA6. La estrategia comercial y la entrada de contactos funcionan igual que antes del cambio.
Riesgos anotados:
- Convertir solos los gastos viejos puede dar cifras falsas, así que yo los marcaría para revisión en lugar de cambiarlos.
- La revisión antes de guardar puede frenar acciones válidas, por eso conviene probarla primero con una empresa en pesos y otra en euros.
- Los reportes pueden sumar monedas mezcladas, así que muestra totales separados por moneda hasta revisar los gastos viejos.

## 4. Guardas de seguridad
- G1. Tomar la moneda del gasto siempre de la configuración guardada de la empresa en el servidor, nunca de lo que mande la pantalla o el asistente.
- G2. Permitir que sólo el dueño o un administrador cambie la moneda de la empresa, y dejar anotado quién la cambió y cuándo.
- G3. Guardar una copia de los gastos viejos antes de marcarlos para revisar, y comprobar que el total de registros es el mismo antes y después.
- G4. Evitar que un mismo gasto se guarde dos veces si el asistente reintenta la acción tras un aviso de rechazo.
- G5. Mostrar el aviso de gasto rechazado sólo al gerente de esa empresa, con un texto claro y sin detalles internos del error.
- G6. Revisar en el servidor que el monto del gasto sea un número positivo antes de guardarlo.

## 5. Verificación obligatoria
Antes de dar el cambio por cerrado, comprueba cada punto y reporta su resultado:
- [ ] V1. Cambiar la moneda de una empresa de pesos a dólares, hacer una acción del asistente y ver que el gasto nuevo sale en dólares y los anteriores siguen igual.
- [ ] V2. Entrar como vendedor e intentar cambiar la moneda de la empresa: la app no lo deja y la moneda no cambia.
- [ ] V3. Contar los gastos viejos en euros antes del cambio y después: el número y los montos son idénticos y todos tienen la marca de revisión.
- [ ] V4. Repetir dos veces seguidas la misma acción rechazada del asistente y ver que no aparece ningún gasto duplicado.
- [ ] V5. Con una empresa en euros, abrir el reporte de gastos y ver que el total cuadra con la suma de sus gastos uno por uno.
- [ ] V6. Entrar con usuario, abrir la bandeja de respuestas como administrador y revisar las carpetas por empresa: todo se ve y funciona igual que antes.
- [ ] Se cumplen CA1…CA6, uno por uno.
- [ ] Las piezas de la sección 2 siguen funcionando igual.
Al terminar, responde con: qué archivos cambiaste y el resultado de cada punto de esta sección.
