# Cierre formal de entregas terminadas

## Decisiones de Fede (entrevista 14-11-2026)
- **Cerradas sin residuos:** NK-0176, guía de hallazgos del onboarding y NK-0167 SDD 1–3.
- **NK-0171:** aceptación condicionada a 1 señal real válida.
- **NK-0173:** autorizado 1 revelado de Apollo (1 crédito) para ver en pantalla el caso «email alternativo».
- **NK-0174 SDD 1:** autorizada 1 lectura real, solo lectura, del buzón somos@postinapp.com.

## Pasos
1. **Registrar cierres:** marcar como aceptadas NK-0176, la guía de hallazgos y NK-0167 SDD 1–3 en `roadmap.md` y en `docs/verificacion-20261114.md`, con la fecha y la frase «aceptado por Fede».
2. **NK-0171, una señal real:**
   - Elegir con Fede un competidor que salga con frecuencia en noticias públicas. Ahora mismo no hay ninguno decidido, así que se le preguntará antes de lanzar la búsqueda.
   - Hacer una sola ejecución de R-1 sobre una cuenta de prueba, con el filtro de nombre exacto activo.
   - Mostrar cada señal con su fuente y su sugerencia, junto con el gasto medido.
   - Si sale 0 de nuevo, parar sin reintentar y preguntar a Fede.
   - Al terminar, dejar el play en pausa.
3. **NK-0173, un revelado:**
   - Lanzar un único revelado de Apollo sobre un contacto sintético de «Empresa de prueba Nokko».
   - Comprobar que el email alternativo aparece como propuesta y no sustituye al email actual.
   - Hacer capturas en escritorio y móvil, con tema claro y oscuro.
   - Si Apollo no devuelve un email alternativo, documentarlo como residuo y no repetir.
4. **NK-0174 SDD 1, una lectura real:**
   - Ejecutar una sola vez la revisión del buzón de Fede con el conector de solo lectura.
   - Guardar solo los datos del encabezado: nunca el cuerpo del correo, nunca enviar ni mover correos, y sin usar IA.
   - Confirmar en la tarjeta de Conexiones la fecha de la revisión y los contadores.
5. **Informe:** añadir a `docs/verificacion-20261114.md` el resultado de los pasos 2–4 y su gasto, y dar NK-0171, NK-0173 y NK-0174 SDD 1 como aceptadas o con residuos documentados.

## Límites
No se publica ni se despliega, no se modifican pruebas existentes y no se consulta ningún otro buzón. Cada gasto real se hace una sola vez. Si algo falla dos veces, se para y se pregunta.
