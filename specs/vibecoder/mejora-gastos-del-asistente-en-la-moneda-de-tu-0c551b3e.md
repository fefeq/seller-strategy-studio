# Corregir la moneda de los gastos

App: Nokko

INSTRUCCIÓN PARA TU ASISTENTE DE CÓDIGO · Corregir la moneda de los gastos
App: Nokko · Versión del cambio: 1
Trabaja sólo en este cambio. Sigue las secciones en orden y no lo des por terminado hasta cumplir la sección 5.

## 1. Objetivo
Que cada gasto del asistente aparezca en la moneda de tu empresa, para que tus reportes cuadren con lo que pagas de verdad.

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
- CA1. Una empresa que trabaja en pesos colombianos ve cada gasto nuevo del asistente en pesos colombianos.
- CA2. Si un gasto llega en una moneda distinta a la de la empresa, la app no lo guarda y muestra el motivo.
- CA3. Si la empresa no tiene moneda definida, la app pide elegirla antes de anotar el primer gasto.
- CA4. Los gastos viejos anotados en euros quedan marcados para revisar y no cambian solos.
- CA5. El asistente sigue sin guardar cambios ni gastar dinero hasta que alguien confirma.
- CA6. La Estrategia comercial y la Entrada de contactos funcionan exactamente igual que antes.
Riesgos anotados:
- Convertir los gastos viejos a otra moneda puede inventar cifras, así que yo los dejaría intactos y sólo marcados para revisar.
- Un reporte que suma gastos viejos y nuevos puede mezclar monedas, así que el total debe separarse por moneda.
- Una empresa sin moneda definida podría quedar sin poder usar el asistente, así que la pregunta debe aparecer clara y con una sola elección.

## 4. Guardas de seguridad
- G1. Revisar en el servidor que cada gasto traiga cifra mayor a cero y una moneda reconocida antes de guardarlo, sin confiar en lo que mande la pantalla.
- G2. Tomar la moneda de la empresa siempre desde su ficha guardada en el servidor, nunca desde lo que elija o envíe el navegador en ese momento.
- G3. Permitir que sólo el dueño o un administrador elija o cambie la moneda de la empresa, y dejar anotado quién lo hizo y cuándo.
- G4. Bloquear el cambio de moneda cuando la empresa ya tiene gastos anotados, salvo confirmación expresa, para no mezclar cifras sin aviso.
- G5. Impedir que se guarde dos veces el mismo gasto si alguien reintenta la confirmación, usando una marca única por acción del asistente.
- G6. Mostrar los gastos y su moneda sólo a quien pertenece a esa empresa, sin que un error deje ver cifras de otra empresa.

## 5. Verificación obligatoria
Antes de dar el cambio por cerrado, comprueba cada punto y reporta su resultado:
- [ ] V1. Entrar como vendedor e intentar cambiar la moneda de la empresa: la app no lo deja y la moneda sigue igual.
- [ ] V2. Confirmar una acción del asistente y pulsar confirmar dos veces seguidas: queda un solo gasto anotado.
- [ ] V3. Abrir el reporte de una empresa con gastos viejos en euros y nuevos en pesos colombianos: los totales aparecen separados por moneda y ninguno suma ambas.
- [ ] V4. Contar los gastos viejos y su cifra antes y después del cambio: la cantidad y cada importe quedan idénticos, sólo con la marca de revisar.
- [ ] V5. Entrar con dos empresas distintas y abrir los gastos: cada una ve sólo los suyos y en su propia moneda.
- [ ] V6. Hacer como vendedor una aprobación de estrategia, una entrada de contactos que supere el tope diario y un ingreso con usuario: todo responde igual que antes del cambio.
- [ ] Se cumplen CA1…CA6, uno por uno.
- [ ] Las piezas de la sección 2 siguen funcionando igual.
Al terminar, responde con: qué archivos cambiaste y el resultado de cada punto de esta sección.
