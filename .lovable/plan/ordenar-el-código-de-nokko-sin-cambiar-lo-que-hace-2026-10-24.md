# Ordenar el código de Nokko sin cambiar lo que hace

Cada paso deja la app funcionando y se comprueba antes de seguir con el siguiente. El orden va de mayor a menor riesgo para ti.

## 0. Seguridad (lo haces tú, 1 minuto)
Lanza un análisis profundo desde la pestaña Seguridad. Los análisis automáticos más recientes no encontraron nada, pero están desactualizados. Si sale algo, se arregla antes que todo lo demás.

## 1. Que no se pierdan datos sin avisar (alto)
- Leads (tope de 2.000) y los avisos automáticos (tope de 1.000 leads abiertos) se calculan solo con una parte de los datos cuando hay muchos. Haré que las cifras se calculen sobre todos los leads.
- Cuentas, Personas y Pipeline cargarán por páginas, con buscador y un botón «Traer más».
- Si en algún sitio queda un tope, la pantalla lo dirá: «Mostrando 2.000 de 3.400».
- Comprobación: una prueba con más filas que el tope, y abrir cada pantalla.

## 2. Que los errores se vean (alto)
- Cuando falle la revisión de Sugerencias o la comprobación de un informe de Parallel, verás un aviso claro en vez de que no pase nada.
- Repasar los otros 27 casos de errores silenciados y dejar callados solo los que no importan (por ejemplo, cuando el navegador bloquea el guardado local).
- Comprobación: forzar el fallo y ver el aviso.

## 3. Una sola regla por cosa (medio)
- Una sola forma de limpiar dominios web, la que usarán leads, cuentas, duplicados y logos, para que una misma empresa se reconozca siempre igual y no se dupliquen cuentas.
- Un solo formato de porcentajes para toda la app.
- Comprobación: pruebas nuevas con los dominios que hoy dan resultados distintos, y la suite completa.

## 4. Limpiar restos (medio-bajo)
- Retirar las dos tablas antiguas que ya no se usan: presupuestos por segmento antiguos y roles antiguos. Antes compruebo que ninguna parte de la app ni del servidor las lee.
- Comprobación: la suite completa y abrir Métricas, Equipo y Estrategia.

## 5. Dividir los archivos grandes (medio-bajo)
Lo haré uno a uno, moviendo código sin cambiar lo que hace:
- Herramientas del agente
- Estrategia GTM
- Ficha de cuenta
- Configuración
- Trabajos en segundo plano
- Orquestador

Comprobación: las pruebas del agente y abrir cada pantalla.

## 6. Recuperar la comprobación de tipos (bajo)
Quitar los ~87 sitios donde el código se salta la comprobación de tipos, empezando por los trabajos en segundo plano, Estrategia GTM y el agente. Así, si cambia la base de datos, el error aparece antes de llegar a los usuarios.
- Comprobación: que la app compile sin errores.

## 7. Diseño fiel a Nokko Edición (bajo)
- Quitar los iconos (la regla es «sin iconos») y poner en su lugar palabras o marcas tipográficas.
- Cambiar los ~19 colores puestos a mano por los colores del tema, para que se vean bien en modo oscuro.
- Cambiar las ventanas emergentes del navegador (nueva tarea, avisos de duplicado) por diálogos con el diseño de Nokko.
- Comprobación: revisar las pantallas en modo claro y oscuro.

## 8. Carga de pantallas (bajo, opcional)
Preparar los datos antes de abrir las pantallas principales (Inicio, Leads, Cuentas, Pipeline) para que no aparezcan vacías un instante.

## Detalles técnicos
- Paso 1: paginación con `range()` y cuentas con `count: "exact"`. El embudo y las métricas se calculan en el servidor o con consultas agregadas, en lugar de sobre la lista ya cortada. En `org-data.ts` se quita el `limit(1000)` o se pagina.
- Paso 3: `cleanDomain` único en `src/lib/match.ts` (lo reexportan `leads.ts` y `account-import.ts`), y `pct()` en `src/lib/money.ts`.
- Paso 4: migración que elimina `segment_budgets` y `user_roles` tras comprobar con `rg` y en las funciones de la base de datos que nadie las usa (`has_role` depende de `user_roles`: se revisa y retira si no tiene uso).
- Paso 5: dividir `tools.ts` en más módulos de área, y Estrategia GTM y la ficha de cuenta en componentes por pestaña. Después hay que regenerar el manifiesto de MCP.
- Paso 6: usar los tipos generados (`Database["public"]["Tables"][...]`) en lugar de `as any`.
- Se actualizan `AGENTS.md` y `src/lib/AGENTS.md` con las reglas nuevas: helper de dominio único y paginación obligatoria en listas.
