# Copia autorizada de líneas de negocio — NK-0167

## Uso administrativo
Ejecutar exclusivamente con contexto privilegiado, sin sesión de usuario, mediante la herramienta de cambio de datos. Nunca desde la pantalla, un loader, el agente ni el MCP:

```sql
SELECT public.copy_business_lines() AS result;
```

La función recorre las empresas en orden y bloquea cada una antes de leer candidatos y líneas. Solo admite diagnóstico con arquetipo presente y cuatro respuestas válidas. Prioriza Owner válido más reciente, después las demás sesiones válidas; desempata por id ascendente. Excluye superadmins ajenos salvo creador de la empresa.

Solo crea si no hay líneas. Solo refresca una línea única copiada no editada si sus respuestas cambiaron. Cualquier línea de usuario impide la copia en esa empresa. No escribe sesiones, segmentos, resultados derivados, nombres ni tickets en registros. Retorna únicamente `created` y `refreshed`. Las escrituras normales, incluidas las privilegiadas y cambios de principal, convierten el origen a usuario. El contexto local de refresco no permite eludir esa conversión con una sesión autenticada.

## Ejecución real 14-11-2026
- Autorización específica previa de Fede: «Sí, autorizar copia»; reiteración de continuidad sin permisos adicionales.
- Antes: 0 líneas; 1 sesión con diagnóstico.
- Primera ejecución: 1 creada, 0 refrescadas.
- Segunda ejecución: 0 creadas, 0 refrescadas.
- Después: 1 principal copiada, sin nombre, respuestas coincidentes con la sesión original; sigue habiendo 1 diagnóstico. Cero segmentos enlazados.
- No se exportan datos individuales ni se cambia la empresa activa.

## Límites
READ COMMITTED; la concurrencia de dos conexiones reales aún no se ha comprobado. No sustituye la revisión independiente. La interfaz y sus consumidores se entregan en los SDD siguientes: esta copia todavía no cambia lo mostrado en pantalla. Sin IA, gasto, envíos, publicación ni despliegue.