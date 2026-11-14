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