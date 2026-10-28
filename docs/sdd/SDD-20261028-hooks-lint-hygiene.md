# SDD-20261028-hooks-lint-hygiene · [Mejora] Cero avisos de reglas de hooks, con una corrección en el Hub

**Tipo:** Mejora · **Prioridad propuesta:** Baja (higiene; solo la fila 9 es un fallo latente) · **Track:** medio (un solo PR, sin Unidades de Trabajo independientes)
**Estado:** Borrador · **Pide:** Fede · **Para:** Dani · **Fecha:** 2026-10-28

## Decisiones de Fede (2026-10-28)
- Repo destino: `fefeq/seller-strategy-studio` (Nokko), base `main`.
- Avisos intencionales: se silencian con comentario (máximo 3, CA-3).
- Hub: se corrige aquí. El documento de `?doc=` se abre una sola vez; después la selección es de la persona.
- Registro: solo el repo (`docs/sdd`, PR #50). Nada en Drive ni Plane.

## 1. Resumen
El análisis estático del repo (`npx eslint .`, 2026-10-28) reporta 15 avisos de hooks repartidos en 8 archivos: 6 de `rules-of-hooks` (nivel error) y 9 de `exhaustive-deps` (nivel warning). Tras revisarlos uno a uno en el código, ninguno produce hoy un fallo visible. Se pide dejar ambas reglas en 0 avisos **sin cambiar el comportamiento visible**, con una excepción decidida por Fede: la fila 9 (Hub) es un fallo latente real, que se corrige aquí (H-3), para que un aviso nuevo y real no quede tapado por ruido.

## 2. Problema y para quién
Quien mantiene el código (Dani y su agente de código) no puede fiarse del aviso de hooks: 15 avisos de hooks conviven con otros ~14.900 de otras reglas, así que uno real pasaría desapercibido. No afecta a usuarios finales hoy.

## 3. Evidencia y por qué ahora
- Ejecución de lint del 2026-10-28 sobre la rama `claude/magical-tesla-0z6n1x`, commit `ce848f2`: 6 + 9 = 15 avisos de estas dos reglas (fuente: salida de `eslint` en JSON). Se midió con dependencias instaladas por `npm` sin lockfile (ver sección 12).
- Lectura del código de cada aviso el 2026-10-28 (sección 6): 1 fallo latente (fila 9, Hub) y 0 más. Son hipótesis por lectura, no por ejecución.
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
**Modificado:** estructura interna (comportamiento idéntico) y una excepción en el Hub: antes, al crear, borrar o importar un documento con `?doc=` en la URL, la selección volvía al documento de la URL y pisaba el que la persona estaba mirando; después, el documento de la URL se abre una sola vez y la selección posterior no se mueve.
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
| 9 | `src/routes/_authenticated/hub.tsx` (66) | `exhaustive-deps` (warning) | `docs` | Fallo latente: el efecto depende de `docs.length`, así que cualquier alta o baja de documentos vuelve a seleccionar el de la URL. Se corrige (H-3). |

Suma: 6 (fila 1) + 1+1+1+1+2+1+1+1 (filas 2 a 9) = 15.

## 7. Historias y criterios de aceptación
### H-1: Como mantenedor, quiero que el aviso de reglas de hooks esté en cero para detectar uno real cuando aparezca
- CA-1: CUANDO se ejecute el comando de la sección 4, el resultado DEBE contener 0 avisos de la regla de uso correcto de hooks.
- CA-2: CUANDO se ejecute el comando de la sección 4, el resultado DEBE contener 0 avisos de la regla de dependencias de efectos, sin contar los silenciados con comentario según CA-3.
- CA-3: SI un aviso se resuelve silenciando la regla en vez de corregir el código, ENTONCES cada silenciado DEBE llevar un comentario en la misma línea con el motivo, y la descripción del PR DEBE listarlo. Se admiten como máximo 3 silenciados (previsto: fila 4).
- CA-8: CUANDO el lint se ejecute tras el cambio, la regla de dependencias de efectos DEBE estar en nivel error, de modo que un aviso nuevo rompa el lint.

### H-2: Como persona usuaria, quiero que nada cambie en pantalla
- CA-4 (regresión): El sistema DEBE producir las mismas filas y totales en Deals ganados, Payback por trimestre, KPIs trimestrales y CAC que antes del cambio, para los mismos datos y el mismo trimestre, incluida la vista sin datos.
- CA-9 (regresión): CUANDO cambie el trimestre seleccionado en Deals ganados, Payback o KPIs trimestrales, el sistema DEBE recalcular las filas con el nuevo trimestre y no mostrar las del anterior.
- CA-5 (regresión): CUANDO una persona con sesión abierta llegue a la pantalla de acceso, ENTONCES: con `next` válido (según la validación existente `oauthReturnPath`), DEBE ir a `next`; sin `next`, o con `next` inválido, DEBE ir a Inicio.
- CA-6 (regresión): MIENTRAS haya un informe de cuenta en marcha, el sistema DEBE seguir comprobando su estado cada 8 segundos y refrescar la lista cuando termine; SI no hay informes en marcha, ENTONCES NO DEBE iniciar comprobaciones; y al salir de la pantalla DEBE detenerlas.
- CA-7 (regresión): El sistema DEBE seguir ordenando, etiquetando y calculando probabilidad de etapas igual que antes (las pruebas existentes de `src/lib/stages.test.ts` pasan sin cambios).
- CA-10 (regresión): CUANDO se abra el selector de enriquecimiento, el sistema DEBE preseleccionar hasta 10 cuentas (límite actual en código) con datos faltantes solo si no hay selección previa, sin pisar una selección manual.

### H-3: Como persona usuaria del Hub, quiero que mi documento seleccionado no cambie solo cuando se crea, borra o importa otro
- CA-11: CUANDO la URL del Hub traiga un documento existente, el sistema DEBE abrirlo una vez y mostrar su sección; SI el documento no existe, ENTONCES NO DEBE abrir ninguno ni fallar.
- CA-12: MIENTRAS el Hub esté abierto con un documento seleccionado por la persona, el sistema NO DEBE cambiar esa selección cuando se cree, borre o importe otro documento, aunque la URL siga llevando `?doc=`.
- CA-13: CUANDO cambie el valor de `?doc=` con el Hub abierto, el sistema DEBE abrir el documento nuevo.
- CA-14: SI el documento de `?doc=` aún no se ha cargado, ENTONCES el sistema DEBE abrirlo en cuanto llegue y, a partir de ahí, aplicar CA-12.

## 8. Casos límite y errores
- Sin datos en Deals ganados, Payback o CAC: el sistema DEBE seguir mostrando el estado vacío actual (CA-4).
- Cuenta sin informe en marcha: no se inician comprobaciones (CA-6).
- Acceso con `next` inválido: se va a Inicio (CA-5).
- Cambio de trimestre con la pantalla abierta: se recalcula (CA-9).
- Documento inexistente en el parámetro del Hub: no se abre ninguno (CA-11). Carga tardía de la lista: se abre al llegar (CA-14).
- Fallo en la comprobación de un informe: el comportamiento actual es mostrar un aviso y dejar de sondear; debe mantenerse (parte de CA-6; [Por verificar] el texto exacto del aviso).

## 9. Experiencia y copy
Sin cambios de pantalla ni de texto.

## 10. Datos, permisos y privacidad
Sin cambios en datos, permisos ni integraciones. No toca LinkedIn. Las pruebas nuevas usan datos ficticios.

## 11. Unidades de trabajo
Mejora de track medio: se entrega en un solo PR en borrador. Orden sugerido dentro del PR:
1. Falsos positivos y renombrados sin riesgo (filas 1, 2, 5).
2. Dependencias estables en paneles de métricas (filas 6, 7, 8).
3. Efectos de `parallel.tsx` y `hub.tsx` (filas 3, 4, 9), con pruebas CA-6 y CA-10, y CA-11 a CA-14 para el Hub.
4. Subir la regla a error (CA-8) solo cuando todo lo anterior esté en 0.

## 12. Notas técnicas [Sugerencia — Dani valida]
- Fila 1: renombrar `use` a un nombre que no empiece por `use` (por ejemplo `orDefault`). Ya existe `src/lib/stages.test.ts`, que cubre CA-7.
- Fila 2: calcular `goOn` dentro del efecto o envolverlo para que las dependencias sean explícitas.
- Filas 6 y 7: derivar `quarters` una sola vez y usarla como dependencia directa, o memoizarla por el valor del trimestre.
- Fila 8: memoizar `costs` o tomar `data?.costs` directamente en las dependencias.
- Filas 3 y 4: añadir las dependencias que faltan, o mantener la omisión con un comentario que explique por qué es intencional (CA-3; decisión de Fede: silenciar con comentario si es intencional).
- Fila 9: abrir el documento de la URL solo cuando cambie el valor del parámetro o cuando el documento llegue por primera vez (por ejemplo, recordando el último id abierto desde la URL); el efecto no debe depender del número de documentos.
- Fila 5: usar `range` en las dependencias o derivarlo dentro del `useMemo`.
- Comando único de comprobación (CA-1, CA-2): `npx eslint src --rule 'prettier/prettier: off' -f json`, filtrando los mensajes `react-hooks/rules-of-hooks` y `react-hooks/exhaustive-deps`; debe dar 0 y sin errores de ejecución.
- Las cifras (15 avisos, tests, tsc) se midieron con `npm` sin lockfile porque `bun.lock` apunta a un mirror privado que el entorno de esta sesión no alcanzó. Con el `bun.lock`, el recuento puede variar por la versión del plugin de hooks; el 0 de CA-1 y CA-2 se mide con el lock de Dani.
- Pruebas existentes relacionadas (por nombre de archivo): `src/lib/stages.test.ts`, `src/lib/cac.test.ts`, `src/lib/oauth-return-path.test.ts`. No he comprobado qué cubren de las pantallas de Deals ganados, Payback, KPIs, acceso, `parallel` y Hub.

## 13. Riesgos y dependencias
- Cambiar dependencias de un efecto puede provocar bucles o re-ejecuciones nuevas. Mitigación: CA-4 a CA-6 y revisión caso por caso.
- Lovable sincroniza los commits de la rama conectada: el PR debe mantener la rama funcional y no reescribir historia publicada (ver `AGENTS.md`).
- Sin dependencias de otros SDD.

## 14. Preguntas para Dani
1. Fede decidió silenciar con comentario los avisos intencionales (fila 4); ¿hay alguna razón técnica para reestructurarla?
2. ¿Hay CI que ejecute el lint? Si no, ¿cómo se comprueba CA-1 y CA-2 en el PR?
3. Fila 9: Fede decidió corregirlo aquí (H-3); ¿ves algún efecto en el resto de la navegación del Hub?
4. ¿Con `bun.lock` el recuento es el mismo?
5. ¿El intervalo de 8 s de `parallel.tsx` vive en un efecto o en la consulta, y puede cambiar con las dependencias nuevas?
6. ¿Qué pruebas existen hoy para Deals ganados, Payback, KPIs, CAC, acceso y `parallel`, y qué datos de referencia usas para CA-4?

## 15. Pendiente de verificar
- [Por verificar] Qué hay desplegado en `production` frente a `main`: el análisis es del código de la rama de trabajo, sin acceso a producción.
- [Resuelto 2026-10-28] Repo destino confirmado por Fede: `fefeq/seller-strategy-studio`, base `main` (medido en la rama `claude/magical-tesla-0z6n1x`, commit `ce848f2`).
- [Por verificar] Que el fallo de la fila 9 se reproduce en el navegador: está deducido de leer el código (`docs.length` en las dependencias), no ejecutado.
- [Por verificar] Las hipótesis de la sección 6 salen de leer el código, no de ejecutarlo en el navegador.
- [Por verificar] El texto exacto del aviso al fallar la comprobación de un informe (sección 8).
- [Por verificar] Que los números de línea siguen vigentes en la rama que use Dani.

## 16. Sección de Dani (la completa él)
- Diseño técnico:
- Tareas:
- Estimación:
- Decisión: Aceptado / Cambios pedidos / Rechazado

---
Validación: linter OK; pendiente el OK explícito de Fede al texto final.
