# Cerrar el registro del asistente

App: Nokko

INSTRUCCIÓN PARA TU ASISTENTE DE CÓDIGO · Cerrar el registro del asistente
App: Nokko · Versión del cambio: 1
Trabaja sólo en este cambio. Sigue las secciones en orden y no lo des por terminado hasta cumplir la sección 5.

## 1. Objetivo
Que el registro de actividad del asistente muestre sólo lo que hizo de verdad, para que confíes en él al revisar qué pasó.

## 2. Reglas: qué NO tocar
- No cambies estas piezas; tienen que seguir funcionando igual: Estrategia comercial, Cuentas y oportunidades, Bandeja Hoy, Gastos y moneda, Entrada de contactos, Espacio por empresa.
- No cambies el aspecto ni el comportamiento de nada que no esté en «Piezas que toca».
- Si para cumplir el objetivo hace falta tocar otra pieza, frena y pregunta antes de hacerlo.
- No escribas claves, contraseñas ni datos reales de clientes en el código.
- No borres datos guardados ni cambies cómo se guardan sin un paso para volver atrás.

## 3. Spec del cambio
Piezas que toca:
- Asistente comercial (Lo que ven tus clientes) · cambia
- Registro de actividad (Por detrás) · pieza nueva
Criterios de aceptación (CA1…CA5):
- CA1. Un miembro que intenta crear un registro de actividad desde su sesión recibe un rechazo y no se guarda nada.
- CA2. Cuando el asistente ejecuta una acción confirmada, su registro aparece en la lista de actividad.
- CA3. Un miembro puede leer los registros de actividad de su empresa, pero no editarlos ni borrarlos.
- CA4. Toda acción que cambia datos sigue pendiente hasta que alguien la confirma, igual que hoy.
- CA5. La Bandeja Hoy, las cuentas y oportunidades y la entrada de contactos siguen funcionando igual que antes del cambio.
Riesgos anotados:
- Si el asistente guarda hoy sus registros con la sesión del miembro, dejaría de registrar; hay que probar una acción confirmada antes de publicar.
- Los registros viejos escritos a mano podrían confundir la revisión; conviene marcarlos como anteriores al cambio en lugar de borrarlos.
- La Bandeja Hoy lee pendientes del asistente; hay que comprobar que siguen apareciendo después del cambio.

## 4. Guardas de seguridad
- G1. Validar en el servidor que cada registro nuevo venga de una acción confirmada del asistente y tenga empresa, acción, fecha y quién confirmó antes de guardarlo.
- G2. Tomar la empresa del registro desde la acción confirmada y no desde lo que envía la pantalla, para que nadie escriba en la actividad de otra empresa.
- G3. Bloquear también las vías indirectas: que ningún miembro pueda crear registros copiando, importando o reintentando una acción ya registrada.
- G4. Guardar una sola vez cada acción confirmada para que un reintento o doble clic no deje registros duplicados.
- G5. Marcar los registros viejos escritos a mano como anteriores al cambio sin borrarlos, y hacer una copia de respaldo antes de marcarlos.
- G6. Dejar que sólo la app pueda poner o quitar la marca de anterior al cambio; ningún miembro, ni el dueño, puede hacerlo a mano.

## 5. Verificación obligatoria
Antes de dar el cambio por cerrado, comprueba cada punto y reporta su resultado:
- [ ] V1. Confirmar una acción del asistente desde la cuenta de un vendedor y comprobar que aparece un solo registro con la empresa y la persona correctas.
- [ ] V2. Entrar como miembro de otra empresa y comprobar que no ve ni puede leer ese registro.
- [ ] V3. Confirmar dos veces seguidas la misma acción y comprobar que la lista muestra un solo registro.
- [ ] V4. Abrir la lista de actividad y comprobar que los registros viejos se ven con la marca de anterior al cambio y ninguno desapareció.
- [ ] V5. Aprobar una estrategia con las cinco secciones completas y guardar un gasto en la moneda de la empresa, y comprobar que ambos funcionan igual que antes.
- [ ] V6. Dejar una acción del asistente pendiente sin confirmar y comprobar que aparece en la Bandeja Hoy y no genera registro hasta confirmarla.
- [ ] Se cumplen CA1…CA5, uno por uno.
- [ ] Las piezas de la sección 2 siguen funcionando igual.
Al terminar, responde con: qué archivos cambiaste y el resultado de cada punto de esta sección.
