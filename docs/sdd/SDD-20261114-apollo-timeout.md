# Apollo: espera acotada

## Alcance autorizado
Limitar cada petición Apollo a 15.000 ms, incluida la lectura de su respuesta. Si vence el plazo, devolver un error en español que indique que el cobro no puede confirmarse. No repetir automáticamente una petición con resultado incierto, ni lanzar otro revelado real.

## Implementación
Usar AbortSignal.timeout en el punto compartido de apollo-gateway.ts. Conservar el tratamiento actual de errores HTTP y el reintento acotado de un 429 explícito. Añadir pruebas nuevas de plazo exacto y ausencia de reintento tras timeout; mantener intactas las pruebas existentes.

## Verificación
Pruebas sintéticas antes de implementar, regresiones Apollo y suite completa. Ejecución R-1 con Taplio una sola vez mediante los adaptadores existentes; comprobar resultados persistidos y dejar la jugada pausada. No publicar, enviar mensajes ni alterar la regla de una ejecución por hora.