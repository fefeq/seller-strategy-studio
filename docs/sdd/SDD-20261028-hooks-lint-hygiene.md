# SDD-20261028-hooks-lint-hygiene · [Mejora] Cero avisos de reglas de hooks, sin cambio visible

**Tipo:** Mejora · **Prioridad propuesta:** Baja (higiene; ninguno de los avisos es un bug confirmado) · **Track:** medio (un solo PR, sin Unidades de Trabajo independientes)
**Estado:** Borrador · **Pide:** Fede · **Para:** Dani · **Fecha:** 2026-10-28

## 1. Resumen
El análisis estático del repo (`npx eslint .`, 2026-10-28) reporta 15 avisos de hooks repartidos en 8 archivos: 6 de `rules-of-hooks` (nivel error) y 9 de `exhaustive-deps` (nivel warning). Tras revisarlos uno a uno en el código, ninguno produce hoy un fallo visible. Se pide dejar ambas reglas en 0 avisos **sin cambiar el comportamiento**, para que un aviso nuevo y real no quede tapado por ruido.

## 2. Problema y para quién
Quien mantiene el código (Dani y su agente de código) no puede fiarse del aviso de hooks: 15 avisos de hooks conviven con otros ~14.900 de otras reglas, así que uno real pasaría desapercibido. No afecta a usuarios finales hoy.

## 3. Evidencia y por qué ahora
- Ejecución de lint del 2026-10-28 sobre la rama `claude/magical-tesla-0z6n1x`, commit `ce848f2`: 6 + 9 = 15 avisos de estas dos reglas (fuente: salida de `eslint` en JSON). Se midió con dependencias instaladas por `npm` sin lockfile (ver sección 12).
- Lectura del código de cada aviso el 2026-10-28 (sección 6): 0 bugs confirmados. Son hipótesis por lectura, no por ejecución.
- Por qué ahora: es apuesta de Fede por mantenimiento; sin dato de impacto en usuarios (sin dato).

## 4. Resultado buscado
- `npx eslint src --rule 'prettier/prettier: off' -f json` no devuelve ningún mensaje de `react-hooks/rules-of-hooks` ni de `react-hooks/exhaustive-deps` (fuente: salida de ese comando, medida con el `bun.lock` de Dani).
- Todas las pruebas pasan, ninguna eliminada ni saltada, y `npx tsc --noEmit` termina sin errores (ambos hoy pasan al 100 %; fuente: `vitest`, `tsc`).

## 5. Alcance
**Incluye:**
- Los 15 avisos listados en la sección 6.
- Una prueba de regresión por cada CA de la sección 7 que hoy no tenga prueba (Dani indica cuáles existen; ver pregunta 6).
- Subir `react-hooks/exhaustive-deps` de warning a error una vez en 0, para que uno nuevo rompa el lint (CA-8).

**No incluye:**
- El resto del lint (14.775 avisos de formato Prettier, 111 `no-explicit-any`, 41 `only-export-components`, 11 `no-unused-expressions`). Cada grupo merece su propio SDD.
- Reformatear archivos con Prettier (rompe el diff que sincroniza Lovable).
- Cambios de pantalla, textos o datos.

## 6. Cambios de comportamiento (delta)
**Añadido:** nada visible.
**Modificado:** solo estructura interna. Comportamiento antes → después: idéntico.
**Eliminado:** los 15 avisos.

Las valoraciones son hipótesis por lectura de código; Dani las valida.

| # | Archivo (línea) | Aviso (nivel) | Dependencia que falta o problema | Hipótesis |
|---|---|---|---|---|
| 1 | `src/lib/stages.ts` (37, 47, 51, 53, 88, 120) | `rules-of-hooks` ×6 (error) | Una función auxiliar local llamada `use` (línea 30) se confunde con el `use()` de React | Falso positivo: no es un hook. |
| 2 | `src/routes/auth.tsx` (74) | `exhaustive-deps` (warning) | `goOn` | `goOn` se recrea desde `next` y `navigate`, que ya están en las dependencias. |
| 3 | `src/components/parallel.tsx` (44) | `exhaustive-deps` (warning) | `check`, `qc`, `queryKey` | `queryKey` es `["account-report", accountId]`; cambia solo si cambia la cuenta, y entonces el sondeo se reinicia. |
| 4 | `src/components/parallel.tsx` (211) | `exhaustive-deps` (warning) | `missing`, `sel` | Intencional: preselecciona cuentas solo al abrir y no debe pisar la selección manual. |
| 5 | `src/components/won-deals-panel.tsx` (37) | `exhaustive-deps` (warning) | `range` | `range` sale solo de `quarter`, que ya está en las dependencias. |
| 6 | `src/components/payback-quarters.tsx` (35) | `exhaustive-deps` ×2 (warning) | `quarters`; expresión compleja `quarters.join()` | Frágil, no roto. |
| 7 | `src/components/quarter-kpis-panel.tsx` (46) | `exhaustive-deps` (warning) | `quarters` | Mismo patrón que la fila 6. |
| 8 | `src/components/cac-panel.tsx` (95) | `exhaustive-deps` (warning) | `costs` cambia en cada render cuando no hay datos | Coste de rendimiento, sin efecto visible; no se mide. |
| 9 | `src/routes/_authenticated/hub.tsx` (66) | `exhaustive-deps` (warning) | `docs` | Intencional: abre el documento del parámetro de la URL cuando cambia el parámetro o el número de documentos. |

Suma: 6 (fila 1) + 1+1+1+1+2+1+1+1 (filas 2 a 9) = 15.

## 7. Historias y criterios de aceptación
### H-1: Como mantenedor, quiero que el aviso de reglas de hooks esté en cero para detectar uno real cuando aparezca
- CA-1: CUANDO se ejecute el comando de la sección 4, el resultado DEBE contener 0 avisos de la regla de uso correcto de hooks.
- CA-2: CUANDO se ejecute el comando de la sección 4, el resultado DEBE contener 0 avisos de la regla de dependencias de efectos, sin contar los silenciados con comentario según CA-3.
- CA-3: SI un aviso se resuelve silenciando la regla en vez de corregir el código, ENTONCES cada silenciado DEBE llevar un comentario en la misma línea con el motivo, y la descripción del PR DEBE listarlo. Se admiten como máximo 3 silenciados (previstos: filas 4 y 9).
- CA-8: CUANDO el lint se ejecute tras el cambio, la regla de dependencias de efectos DEBE estar en nivel error, de modo que un aviso nuevo rompa el lint.

### H-2: Como persona usuaria, quiero que nada cambie en pantalla
- CA-4 (regresión): El sistema DEBE producir las mismas filas y totales en Deals ganados, Payback por trimestre, KPIs trimestrales y CAC que antes del cambio, para los mismos datos y el mismo trimestre, incluida la vista sin datos.
- CA-9 (regresión): CUANDO cambie el trimestre seleccionado en Deals ganados, Payback o KPIs trimestrales, el sistema DEBE recalcular las filas con el nuevo trimestre y no mostrar las del anterior.
- CA-5 (regresión): CUANDO una persona con sesión abierta llegue a la pantalla de acceso, ENTONCES: con `next` válido (según la validación existente `oauthReturnPath`), DEBE ir a `next`; sin `next`, o con `next` inválido, DEBE ir a Inicio.
- CA-6 (regresión): MIENTRAS haya un informe de cuenta en marcha, el sistema DEBE seguir comprobando su estado cada 8 segundos y refrescar la lista cuando termine; SI no hay informes en marcha, ENTONCES NO DEBE iniciar comprobaciones; y al salir de la pantalla DEBE detenerlas.
- CA-7 (regresión): El sistema DEBE seguir ordenando, etiquetando y calculando probabilidad de etapas igual que antes (las pruebas existentes de `src/lib/stages.test.ts` pasan sin cambios).
- CA-10 (regresión): CUANDO se abra el selector de enriquecimiento, el sistema DEBE preseleccionar hasta 10 cuentas (límite actual en código) con datos faltantes solo si no hay selección previa, sin pisar una selección manual.
- CA-11 (regresión): CUANDO la URL del Hub traiga un documento existente, el sistema DEBE abrirlo; SI el documento no existe, ENTONCES NO DEBE abrir ninguno ni fallar.

## 8. Casos límite y errores
- Sin datos en Deals ganados, Payback o CAC: el sistema DEBE seguir mostrando el estado vacío actual (CA-4).
- Cuenta sin informe en marcha: no se inician comprobaciones (CA-6).
- Acceso con `next` inválido: se va a Inicio (CA-5).
- Cambio de trimestre con la pantalla abierta: se recalcula (CA-9).
- Documento inexistente en el parámetro del Hub: no se abre ninguno (CA-11).
- Fallo en la comprobación de un informe: el comportamiento actual es mostrar un aviso y dejar de sondear; debe mantenerse (parte de CA-6; [Por verificar] el texto exacto del aviso).

## 9. Experiencia y copy
Sin cambios de pantalla ni de texto.

## 10. Datos, permisos y privacidad
Sin cambios en datos, permisos ni integraciones. No toca LinkedIn. Las pruebas nuevas usan datos ficticios.

## 11. Unidades de trabajo
Mejora de track medio: se entrega en un solo PR en borrador. Orden sugerido dentro del PR:
1. Falsos positivos y renombrados sin riesgo (filas 1, 2, 5).
2. Dependencias estables en paneles de métricas (filas 6, 7, 8).
3. Efectos de `parallel.tsx` y `hub.tsx` (filas 3, 4, 9), con pruebas de regresión CA-6, CA-10 y CA-11.
4. Subir la regla a error (CA-8) solo cuando todo lo anterior esté en 0.

## 12. Notas técnicas [Sugerencia — Dani valida]
- Fila 1: renombrar `use` a un nombre que no empiece por `use` (por ejemplo `orDefault`). Ya existe `src/lib/stages.test.ts`, que cubre CA-7.
- Fila 2: calcular `goOn` dentro del efecto o envolverlo para que las dependencias sean explícitas.
- Filas 6 y 7: derivar `quarters` una sola vez y usarla como dependencia directa, o memoizarla por el valor del trimestre.
- Fila 8: memoizar `costs` o tomar `data?.costs` directamente en las dependencias.
- Filas 3, 4 y 9: añadir las dependencias que faltan, o mantener la omisión con un comentario que explique por qué es intencional (CA-3).
- Fila 5: usar `range` en las dependencias o derivarlo dentro del `useMemo`.
- Comando único de comprobación (CA-1, CA-2): `npx eslint src --rule 'prettier/prettier: off' -f json`, filtrando los mensajes `react-hooks/rules-of-hooks` y `react-hooks/exhaustive-deps`; debe dar 0 y sin errores de ejecución.
- Las cifras (15 avisos, tests, tsc) se midieron con `npm` sin lockfile porque `bun.lock` apunta a un mirror privado que el entorno de esta sesión no alcanzó. Con el `bun.lock`, el recuento puede variar por la versión del plugin de hooks; el 0 de CA-1 y CA-2 se mide con el lock de Dani.
- Pruebas existentes relacionadas (por nombre de archivo): `src/lib/stages.test.ts`, `src/lib/cac.test.ts`, `src/lib/oauth-return-path.test.ts`. No he comprobado qué cubren de las pantallas de Deals ganados, Payback, KPIs, acceso, `parallel` y Hub.

## 13. Riesgos y dependencias
- Cambiar dependencias de un efecto puede provocar bucles o re-ejecuciones nuevas. Mitigación: CA-4 a CA-6 y revisión caso por caso.
- Lovable sincroniza los commits de la rama conectada: el PR debe mantener la rama funcional y no reescribir historia publicada (ver `AGENTS.md`).
- Sin dependencias de otros SDD.

## 14. Preguntas para Dani
1. ¿Prefieres cerrar los avisos intencionales (filas 4 y 9) con un comentario de omisión (CA-3) o reestructurar el efecto?
2. ¿Hay CI que ejecute el lint? Si no, ¿cómo se comprueba CA-1 y CA-2 en el PR?
3. Fila 9: si el número de documentos cambia tras cerrar uno, hoy puede reabrirse; ¿se conserva (comportamiento idéntico) o se trata como fallo aparte?
4. ¿Con `bun.lock` el recuento es el mismo?
5. ¿El intervalo de 8 s de `parallel.tsx` vive en un efecto o en la consulta, y puede cambiar con las dependencias nuevas?
6. ¿Qué pruebas existen hoy para Deals ganados, Payback, KPIs, CAC, acceso y `parallel`, y qué datos de referencia usas para CA-4?

## 15. Pendiente de verificar
- [Por verificar] Qué hay desplegado en `production` frente a `main`: el análisis es del código de la rama de trabajo, sin acceso a producción.
- [Por verificar, decide Fede] Repo destino: este SDD se ha escrito sobre `fefeq/seller-strategy-studio` (producto Nokko), rama `claude/magical-tesla-0z6n1x`, commit `ce848f2`. Las instrucciones de Postin nombran como fuente de código `Postinapp/postin-linkedin-connector`. Fede debe confirmar el repo y la rama base antes del envío.
- [Por verificar] Las hipótesis de la sección 6 salen de leer el código, no de ejecutarlo en el navegador.
- [Por verificar] El texto exacto del aviso al fallar la comprobación de un informe (sección 8).
- [Por verificar] Que los números de línea siguen vigentes en la rama que use Dani.

## 16. Sección de Dani (la completa él)
- Diseño técnico:
- Tareas:
- Estimación:
- Decisión: Aceptado / Cambios pedidos / Rechazado

---
Validación: pendiente de nueva pasada del linter y del OK de Fede; repo destino sin confirmar (ver sección 15).
