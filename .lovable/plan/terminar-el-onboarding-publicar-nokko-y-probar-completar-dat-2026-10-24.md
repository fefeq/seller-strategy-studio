# Terminar el onboarding, publicar Nokko y probar «Completar datos»

«Buscar personas clave» y «Buscar empresas por ICP» ya corren en segundo plano y avisan al terminar. Esa parte no se toca.

Umbrales de ticket decididos: los de referencia del mercado. Por debajo de 5K, autoservicio (PLG). De 5K a 50K, venta interna. Por encima de 50K, venta enterprise. Se guardan como regla del proyecto.

## Parte A: lo que falta del onboarding
1. **Nokko lee en segundo plano.** Un panel en directo muestra lo que encuentra en la web y los documentos, y la fuente de cada dato. Antes de empezar se ve el coste aproximado según la profundidad, y al terminar llega un aviso.
2. **Aprobar bloque a bloque.** Seis bloques: empresa y moneda, ICP, segmentos y benchmarks, posicionamiento, mensajes, y objetivos y cuota. Cada dato muestra su origen y su nivel: «Confirmado», «Deducido» o «Supuesto». En cada bloque se puede aprobar, rehacer con IA o saltar, y se puede deshacer. Nunca se sobrescribe lo que escribió la persona.
3. **Modo A fondo.** Informe de mercado y competidores, y la opinión breve de los C-Levels en cada bloque.
4. **Tarjeta del roadmap en Inicio,** visible hasta completarlo.
5. **Versión corta para invitados:** su rol, sus preferencias y la estrategia ya aprobada.

## Parte B: publicar y probar
6. Revisión de seguridad. Si aparece algo grave, te lo enseño antes de seguir.
7. Publicar nokko.ai y volver a conectar el segundo plano para que use el código nuevo.
8. En una cuenta real: lanzar «Completar datos», comprobar que la pantalla no se bloquea, que llega el aviso y que al abrirlo se ve la cuenta completada con sus fuentes. Si algo falla en la vista previa, arreglar la causa y repetir la prueba.

## Detalles técnicos
- Nuevo tipo de trabajo `onboarding_read` en background_jobs. Los hallazgos se guardan en onboarding_sessions.findings, cada uno con su fuente; el teletipo se actualiza consultando la sesión. El coste aproximado sale de monthBudget, y la lectura se pausa si se llega al límite.
- Aprobación por bloques: block_status en onboarding_sessions. Las escrituras usan las funciones de guardado y deshacer que ya existen y respetan field_sources. Pruebas en src/lib/onboarding.test.ts para el orden de los bloques, para no sobrescribir lo manual y para que el progreso suba.
- Umbrales: constantes en gtm-diagnosis.ts alineadas con la memoria de reglas GTM, más una prueba en el límite de cada umbral.
- A fondo: informe con parallel-core y debate con bmad/debate-core, ambos como trabajos en segundo plano.
- Publicación: security--get_scan_results, preview_ui--publish, volver a sincronizar Inngest en https://nokko.ai/api/public/inngest. Comprobar que el trabajo complete_account pasa a done y crea su aviso.
- Los datos de prueba se borran al terminar.
