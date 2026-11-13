# Corregir los fallos de la verificación independiente

## Alcance y límites
Corregir F1 a F11, en el orden indicado, sin iniciar PRD nuevos ni publicar. Añadir pruebas únicamente en archivos nuevos; no modificar ninguna prueba existente. Si una prueba existente impide una corrección, parar esa corrección y explicar cuál falla y por qué. F12 y los pendientes heredados requieren decisión o permiso de Fede y quedan fuera.

## Entregas pequeñas
1. **F1 — Lectura honesta de Drive.** Propagar el truncamiento y la longitud original desde Drive hasta el estado de lectura. Primero probar con un documento simulado de 96.000 caracteres que nunca se informe como leído entero.
2. **F2 — Almacenamiento comprobable y reproducible.** Consultar sin modificar el estado real del bucket y todas las políticas de objetos; documentar privacidad, límite y tipos. Preparar una configuración reproducible por la API de almacenamiento, con instrucciones de creación y retirada seguras.
3. **F3 — Pruebas de seguridad y lectura.** Añadir pruebas PGlite de las migraciones 0086 y 0087 con dos empresas y los cuatro roles indicados. Añadir pruebas del trabajo con referencias ajenas, reparto del presupuesto, escritura de estados y los fallos de Drive enumerados.
4. **F4 — Cierre de sesión.** Impedir lecturas de `meQuery` después de comenzar la salida, conservando el retorno nulo sin usuario. Probar también `useSetup` y `useLivePipeline`, sin tocar pruebas existentes.
5. **F5 — Formato aislado.** Identificar los 31 archivos afectados; formatear únicamente los archivos permitidos, separado de las correcciones funcionales. No formatear pruebas existentes sin permiso.
6. **F6–F7 — Errores y hallazgos.** Traducir errores mediante `errorText` y evitar que una nota de lectura cuente como hallazgo de una fuente.
7. **F8 — Subidas seguras.** Resolver la eliminación durante una subida y sus errores; usar el límite compartido, no consumir cupo con subidas fallidas y mostrar progreso indeterminado mientras la API no facilite porcentajes reales.
8. **F9–F10 — Validación.** Añadir una migración aditiva que valide el UUID antes de convertirlo, con vuelta atrás documentada; validar los estados leídos en lugar de forzar su tipo.
9. **F11 — Documentación.** Corregir la descripción de las nuevas referencias y el informe; documentar la correspondencia de snapshots sin renombrar ni editar los antiguos.

## Verificación y cierre
- Escribir cada prueba nueva primero y comprobar que falla por la causa prevista antes de corregir.
- Ejecutar las pruebas pertinentes y la suite completa; comprobar los tipos con la herramienta permitida y el resultado de compilación automática del entorno. No presentar verificaciones no ejecutadas como realizadas.
- Recorrer los flujos cambiados en escritorio y 375 px, temas claro y oscuro, con consola y red. No realizar llamadas de pago ni envíos reales sin aprobación explícita; declarar Drive real o roles reales no verificados si solo se pueden simular.
- Cerrar en `docs/lovable-run-report.md` con resultados, evidencias, límites y decisiones pendientes; actualizar la lista de tareas.

## Restricciones técnicas que afectan al encargo
- **F2:** la plataforma prohíbe `INSERT` en `storage.buckets`, también dentro de migraciones. No se puede aplicar la migración 0088 solicitada literalmente; usar la API nativa de almacenamiento para reproducir el bucket, sin alterar el esquema gestionado.
- Las migraciones nuevas se crean mediante la herramienta de migraciones; no editar migraciones ni snapshots existentes.
- El entorno no permite ejecutar manualmente `tsc` ni el build del proyecto: usar la comprobación de tipos permitida y los resultados del build automático, informando esta diferencia.
- No ejecutar comandos de commit; el entorno gestiona el historial. Mantener el formateo como operación separada.
- La regla de LinkedIn del traspaso contradice el PRD anterior: no modificar ese pendiente hasta que Fede lo aclare y autorice sus pruebas.