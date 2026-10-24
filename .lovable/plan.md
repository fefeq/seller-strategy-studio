# Publicar Nokko y probar «Completar datos» desde el aviso

«Buscar personas clave» y «Buscar empresas por ICP» ya corren en segundo plano y avisan al terminar (hecho en el plan de segundo plano). Esa parte no se toca.

## Pasos
1. **Revisión de seguridad** antes de publicar. Si aparece algo grave, te lo enseño y decides tú si lo arreglamos antes.
2. **Publicar** nokko.ai.
3. **Volver a conectar el segundo plano** con nokko.ai, para que use el código que se acaba de publicar.
4. **Probar en una cuenta real** (la que tienes abierta ahora):
   - Lanzar «Completar datos».
   - Ver que pasa a «En marcha» y que la pantalla sigue respondiendo.
   - Comprobar que llega el aviso y que abre la cuenta con los datos completados y la fuente de cada uno.
5. **Si el aviso falla en la vista previa:** revisar los registros de la vista previa y del segundo plano, arreglar la causa y repetir la prueba.

## Detalles técnicos
- Seguridad: security--get_scan_results (y run_security_scan si la revisión está caducada) y luego preview_ui--publish.
- Segundo plano: volver a sincronizar Inngest en https://nokko.ai/api/public/inngest y comprobar el heartbeat.
- Comprobación: una fila de background_jobs con kind complete_account que pase de queued a running y a done, y su fila en notifications. Si en la vista previa se queda en queued, revisar la ejecución en línea y el envío del evento.
- La prueba gasta créditos de Apollo y Clay y respeta el presupuesto mensual.
