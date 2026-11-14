# R-1 · Talpio · prueba real única

Fecha: 14-11-2026 UTC. Fede autorizó una sola ejecución con gasto de búsqueda/IA, sin envíos ni vigilancia permanente.

- Empresa: Empresa de prueba Nokko. Cuenta: Cuenta de prueba Nokko, sintética. Su asociación de prueba a Talpio no afirma que sea un cliente real.
- Ejecución: `0e9307e0-e394-4f54-ab70-16282d976615`.
- Play: `332cbe05-699b-4d99-bfe6-7194c6bce0b9`, R-1 de la biblioteca sin modificar su receta.
- Invocación local puntual del coordinador y adaptadores existentes, con proveedor real y almacenamiento compartido. No se utilizó el cron global ni Inngest, para no ejecutar otras empresas ni enviar avisos.
- Paso 1 confirmado. Paso 2 buscó mediante Perplexity, pero la selección IA no pudo terminar: circuito `provider_denied` (401/403). El coste del proveedor se guardó junto al paso 2 vacío; esto sitúa la denegación en la selección OpenRouter, no en la búsqueda. No se conservó el código HTTP concreto ni su cuerpo en el recibo; no se afirma que la clave sea inválida sin comprobarlo.
- Evidencias aceptadas: 0. Sugerencias: 0. No es una conclusión sobre si Talpio ha retirado algún producto: la comprobación quedó interrumpida.
- Coste guardado: Perplexity, 0,01 EUR, **estimado** por el planificador, no factura ni coste medido. No hay coste ni tokens de IA informados; no se afirma gasto IA cero.
- Play finalmente pausado, `execution_pause=provider_denied`. Sin segunda ejecución, cambio de proveedor, mensajes ni publicación.
- Posicionamiento sintético restaurado. Plan de cuenta sintético conservado con la asociación de prueba explícita. Empresa activa de Fede restaurada a Postin.
- Navegador autenticado: Sugerencias de la empresa de prueba mostró sus dos sugerencias previas, ninguna de R-1. Captura inspeccionada. La pantalla Plays actual todavía no muestra estos plays a medida (U-5 pendiente).
- No se cambiaron código de producto, pruebas existentes, migraciones ni diario. Sigue pendiente la colisión 0093 ya documentada; esta prueba no cierra U-4b/U-5 ni declara suite verde.

Siguiente paso: diagnosticar la denegación de OpenRouter sin nueva ejecución de pago; una nueva prueba requiere nueva autorización.

## Nueva ejecución autorizada — petición 14-11-2026 07:55 UTC

- Clave `OPENROUTER_API_KEY` sustituida mediante formulario seguro; comprobación gratuita de autenticación HTTP 200. No se registró su valor ni información derivada.
- Ejecución nueva: `6dbb089a-523b-46a9-abde-5e0cb22ac65b`. El registro previo y sus checkpoints se conservaron intactos. Coordinador y adaptadores existentes, invocación local puntual, sin cron ni Inngest global.
- Resultado comprobado mediante lectura independiente del almacenamiento: **done**, tres pasos **committed**, **0 evidencias, 0 sugerencias**. La selección no conservó una señal válida; esto no demuestra que el competidor nunca haya retirado productos. El paso de personas terminó sin llamadas de enriquecimiento al no haber cuentas seleccionadas por señales.
- Coste IA medido: **0,001716 USD**, 2.133 tokens de entrada y 31 de salida. Búsqueda: **0,01 EUR estimados**, separada del coste IA.
- Tras terminar, la consulta auxiliar del informe usó por error `play_costs` en lugar de `custom_play_costs`; provocó una marca precautoria `uncertain` posterior a la ejecución. Lectura independiente confirmó todos los pasos comprometidos y `done`; se retiró únicamente esa marca auxiliar. No se repitió la ejecución ni gasto alguno.
- Play finalmente **pausado**, `execution_pause=null`, lease liberado; bloqueo de proveedor recuperado únicamente en la empresa sintética. Sin vigilancia permanente, mensajes, publicación ni cambios de producto/pruebas/migraciones.
- Navegador autenticado abrió Plays de Postin; actividad de la empresa sintética no verificada visualmente tras dos fallos del selector. No se cambió la empresa activa. Los resultados anteriores son lecturas persistidas, no una afirmación de verificación visual.
- La nueva clave funciona en este entorno; su incorporación a la aplicación publicada queda sin verificar y requiere publicación, no realizada en este pedido.
## Tercera ejecución — 14-11-2026 09:5x UTC (pedido de Fede: búsqueda real hasta el final)
- Run `323a9c4f-070a-4f44-a7ea-d35408c2b284`: done, 3/3 pasos, 2 evidencias, 2 sugerencias. Competidor «Talpio» puesto temporalmente en posicionamiento y restaurado (vacío); play vuelve a pausado.
- Perplexity devolvió 8 resultados reales; la IA seleccionó 2 (LibreOffice 26.2 fin de soporte; Windows 11 23H2 fin de soporte). **Ninguno menciona a Talpio**: falso positivo. La consulta no exige el nombre del competidor y la selección no lo comprueba.
- Coste: búsqueda 0,01 EUR estimada; IA medida 0,00172425 USD (2.139/32 tokens). Sin envíos ni publicación.
- Corrección (14-11 09:53): las búsquedas de plays basados en competidores ponen sus nombres entre comillas y descartan señales que no los nombren (namesCompetitor, competitor-filter.test.ts). Las 2 sugerencias falsas se descartaron. Sin repetir la búsqueda real.
- Cuarta ejecución b6c819e4 (filtro nuevo): done, 3/3; Perplexity 8 resultados, ninguno nombra a Talpio → 0 señales, 0 pruebas, 0 sugerencias. Búsqueda 0,01 EUR estimada; IA medida 0,000738 USD. Posicionamiento restaurado, play pausado.
