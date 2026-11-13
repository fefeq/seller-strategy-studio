# SDD-20261113-linkedin-blocker-d2 · [Mejora] NK-0176: bloqueo de LinkedIn y cierre de D2

**Tipo:** Mejora acotada · **Prioridad:** Alta por orden de Fede
**Estado:** En curso — aprobado por Fede el 2026-11-13 mediante el plan, incluidos tres cambios de expectativas y excepción textual de fail-first · **Fecha:** 2026-11-13
**Pide y aprueba:** Fede · **PRD:** docs/prd/PRD-20261106-plays-gtm.md
**Depende de:** cierre autorizado F1–F11, documentado en docs/lovable-run-report.md sobre main 734c202.

## 1. Resumen
Sustituir el bloqueo que pide una decisión de LinkedIn ya tomada por un texto que indique que falta una integración mediante API oficial. Registrar D2 como cerrada, sin activar plays ni construir integración alguna.

## 2. Problema y para quién
El equipo y el asistente reciben «falta una decisión de LinkedIn», aunque Fede ya decidió: solo API oficial; Nokko no analiza ni puntúa perfiles. El estado debe explicar el impedimento real sin prometer capacidades.

## 3. Evidencia y por qué ahora
- Base comprobada 734c202: src/lib/plays/status.ts, BLOCKER_TEXT.linkedin_d2, conserva el texto antiguo.
- PRD, sección 6: D2 figura abierta; sección 5 mantiene una exclusión temporal hasta decidir.
- Regla explícita de Fede en el documento de traspaso y docs/sdd/EXECUTION.md: solo API oficial, sin valoración de perfiles.
- docs/decisiones-fede-20261113.md autoriza este SDD corto; aprobarlo es un paso separado de construir.
- Dos expectativas en status.test.ts y una en agent/tools/plays.test.ts fijan el texto antiguo. Uso medido: sin dato.

## 4. Resultado buscado
G-1 del PRD: comunicar el estado y bloqueo reales. G-3: mantener los plays bloqueados sin escrituras ni envíos. No se propone una métrica estimada.

## 5. Alcance
**Incluye:** únicamente los valores label/decide de linkedin_d2 en status.ts y cierre documental de D2 en el PRD (fila de sección 6 y exclusión temporal de sección 5). Alinear tres expectativas protegidas solo con permiso específico.
**No incluye:** cambiar identificadores, catálogo, estados, permisos, proveedores, herramientas, integraciones, scraping, análisis o puntuación de perfiles, migraciones, envíos, publicación, Torre de control GTM, Salida de Lovable ni otros tickets.

## 6. Delta
- «falta una decisión de LinkedIn» → «falta una integración con la API oficial de LinkedIn».
- «Decide si NOKKO puede usar datos de LinkedIn (decisión D2)» → «Este play requiere una integración con la API oficial de LinkedIn».
- D2 abierta → cerrada: solo API oficial; Nokko no analiza ni puntúa perfiles. No equivale a disponibilidad de una API ni a permiso para activar estos plays.

## 7. Historia y aceptación
Como miembro quiero conocer por qué sigue bloqueado un play sin que se me pida volver a decidir D2.
- **CA-1 · G-1:** effectiveState y describePlay para un play linkedin_d2 siguen devolviendo enabled=false y canEnable=false, incluso con fila enabled=true; el estado identifica el requisito de API oficial.
- **CA-2 · G-3:** checkToggle con Owner/Sales Leader rechaza activar; mantiene permitido pausar. Ningún cambio de flujo de escritura.
- **CA-3 · G-1/G-3:** estados, permisos y motivos de los otros tres bloqueadores y plays planificados no cambian.
- **CA-4 · G-1:** D2 queda documentada como cerrada, con procedencia de la decisión y sin afirmar integración construida; revisión del diff del PRD, no prueba automática de copy.

## 8. Casos límite
Fila persistida enabled=true no desbloquea. Miembro sin permiso conserva rechazo por rol. Un play no LinkedIn conserva su estado. No hay nuevas lecturas ni errores de red.

## 9. Copy exacto propuesto
- Estado: **Bloqueado: falta una integración con la API oficial de LinkedIn**.
- Error de activación: **No puedes activar este play todavía: falta una integración con la API oficial de LinkedIn. Este play requiere una integración con la API oficial de LinkedIn.**
- Fila D2: **Cerrada: solo API oficial de LinkedIn; Nokko no analiza ni puntúa perfiles. Los plays siguen bloqueados hasta una integración autorizada y construida.** Procedencia: decisión de Fede del traspaso, ratificada para esta entrega al aprobar el SDD.
- No-objetivo del PRD: **Scraping de LinkedIn y análisis o puntuación de perfiles quedan excluidos; solo API oficial, conforme a D2 cerrada.**

## 10. Datos, permisos y privacidad
Sin esquema, roles, RLS ni datos nuevos. No se leen perfiles ni se conectan cuentas. Pruebas con catálogo y entradas sintéticas.

## 11. IA y coste
Ninguna llamada a IA o proveedor; sin coste nuevo.

## 12. Unidades de trabajo
1. Tras aprobación, añadir pruebas nuevas de CA-1/2/3 en src/lib/plays/linkedin-d2.test.ts para invariantes de bloqueo y permisos; ejecutar antes del cambio. No crear tests de texto/markup: el cambio de copy se verifica por diff y navegador; las pruebas de comportamiento sirven como regresión, no se afirma que fallan antes por un cambio solo textual.
2. Cambiar únicamente las dos cadenas de status.ts y los dos puntos documentales del PRD. Alinear expectativas protegidas si Fede lo autoriza expresamente.
3. Checker permitido, suite completa, comprobación en /plays con sesión válida en escritorio/375 px, claro/oscuro, consola y red; informe de entrega. No empezar NK-0159 antes de ese informe.

## 13. Notas técnicas
Reutilizar effectiveState, describePlay y checkToggle. Mantener linkedin_d2 como clave para no reinterpretar datos. No tocar módulo de herramientas: el asistente consume el estado compartido.

## 14. Riesgos
El nuevo texto no asegura que LinkedIn ofrezca acceso a los datos de cada play. Se mantiene bloqueado, sin prometer viabilidad. Las expectativas antiguas fallarían al cambiar el texto: no tocarlas sin permiso ni dejar la suite roja deliberadamente.

## 15. Aprobaciones solicitadas a Fede
1. Aprobar este SDD y su copy, sin autorizar integración ni activación.
2. Autorizar **solo tres expectativas**:
   - src/lib/plays/status.test.ts, «shows a blocked play as blocked…»: texto antiguo → nuevo; conservar enabled=false, canEnable=false y reason.
   - Mismo archivo, «covers the four blockers…»: solo expectativa de new-hire-tracking → texto nuevo; conservar las de los demás bloqueadores.
   - src/lib/agent/tools/plays.test.ts, «list_plays returns the 28 plays…»: solo label de new-hire-tracking → texto nuevo; conservar 28 plays, enabled=false, canEnable=false, ausencia de escrituras y aislamiento.
3. Aceptar que, por ser copy/documentación, la verificación que discrimina antes/después es la revisión del texto y navegador, no una prueba nueva de comportamiento fail-first artificial.

## 16. Pendiente de verificar
Tras aprobación: texto final en pantalla/asistente y suite completa después del cambio. APIs de LinkedIn, acceso contractual y proveedores quedan fuera y no se presuponen comprobados. Build completo manual y tsc literal restringidos en este entorno: declarar checker ejecutado y señales automáticas disponibles.

## 17. Revisión técnica independiente
Pendiente; no realizada por el autor ni se presenta el gate de entrada F1–F11 como revisión de este SDD.

## 18. Delta de implementación
Implementación mínima iniciada tras aprobación: dos cadenas en status.ts, cierre D2 en dos puntos del PRD y únicamente las tres expectativas autorizadas. Tres pruebas nuevas de invariantes pasan antes del cambio (3/3), como regresión; no se afirma fail-first. Pendientes verificaciones finales e informe. Sin migraciones, publicación ni despliegue.