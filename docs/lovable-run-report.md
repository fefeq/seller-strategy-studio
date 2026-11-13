# Informe final de F1–F11 — 13-11-2026

**Estado:** F1–F11 cerrado en el alcance autorizado. NK-0176 implementado y verificado en la entrega de abajo. Autorización general de Fede recibida el 13-11-2026 a las 14:08 UTC para continuar toda la cola sin aprobación SDD a SDD, conservando las paradas obligatorias. Este informe sustituye los balances parciales y bloqueos anteriores, no declara una certificación de producción.

## 1. Fusión comprobada
- Base verificada: `734c2026ab2be2312514b3ad491218c2dea6d13d`, idéntica al ref local `main`. El entorno usa una rama temporal `edit/…`; no cambié de rama ni hice operaciones de escritura de Git.
- `git merge-base --is-ancestor` devuelve 0 para `cc71f2a`, `5bbd0b7` y `734c202`. El historial incluye la fusión normal `d53d601` y PR #146 `734c202`.
- El diff de la fusión conserva el trabajo funcional de lovable-sync, `docs/decisiones-fede-20261113.md` y los PRD. Los documentos de decisiones/PRD se conservan frente al primer padre; frente al segundo se incorpora el documento de decisiones. Los conflictos documentales se consolidan en este cierre, sin mantener estados contradictorios.
- `session-cache.test.ts` no cambió entre `5bbd0b7` y la fusión. `399455e` cambió únicamente las dos expectativas nuevas de F4: rechazo → `null`, conservando las aserciones de ausencia de lecturas.
- `c363d4f` renombró la migración a `0088_onboarding_source_uuid_guard.sql` y cambió únicamente el tag de la última entrada del diario (idx 87); no renombró snapshots. El repo no contiene el nombre antiguo. No invoqué herramientas de creación de migraciones ni regeneré el diario: no se ha observado que reaparezca, pero no se garantiza el comportamiento de una futura generación.

## 2. Cierre por fallo
| Fallo | Resultado y evidencia |
|---|---|
| F1 | Drive propaga `originalLength` y `truncated`; prueba del job con 96.000 caracteres conserva 60.000 leídos y estado parcial. `onboarding-read-verification.test.ts`, `drive-read-verification.test.ts`. |
| F2 | Provisión explícita reproducible mediante API nativa, no SQL sobre esquema gestionado: `scripts/provision-onboarding-storage.ts`, `onboarding-storage.server.ts`, tres pruebas de creación/no sobrescritura/permisos. API en lugar de migración según el plan; no se ejecutó sobre el bucket existente. Auditoría real repetida debajo. |
| F3 | Pruebas nuevas PGlite con dos empresas y storage.objects simulado: aislamiento, autor, roles de precio, INSERT/UPDATE bloqueados y activación válida. Pruebas del job de referencias, escritura de estados y presupuesto; Drive simulado con carpeta ajena, 401/403, tamaño y vacío. Todas pasan en la suite. |
| F4 | `meQuery` devuelve `null` durante cierre al entrar, antes de aceptar invitaciones y antes de perfiles/miembros. `me-session-ending.test.ts`, `session-verification.test.tsx`, `session-cache.test.ts` y guardas de useSetup/useLivePipeline pasan. Cambio de usuario en vuelo conserva su rechazo específico. |
| F5 | Todos los archivos de producto permitidos del inventario `387febf → 3ee53f1` pasan `prettier --check`, repetido hoy. Cierre limitado por la prohibición de tocar pruebas existentes y autogenerados: no se formatearon ni se afirma lint global limpio. El formato se hizo como operación separada; el entorno no permite crear un commit de formato manual. No queda un cambio de formato permitido pendiente. |
| F6 | Los errores de referencias pasan por `errorText`; prueba evita persistir texto SQL crudo. |
| F7 | Notas de estado con `source: null`, excluidas del recuento de hallazgos. Prueba del job. |
| F8 | Quitar espera a la subida; fallo de remove conserva fila y avisa; límite compartido; fallidos no consumen cupo; progreso indeterminado sin porcentaje inventado. `sources-verification.test.tsx` y pruebas anteriores pasan; flujo real repetido hoy. |
| F9 | Migración 0088 con regex UUID estricto y vuelta atrás en cabecera. Definición real consultada coincide. Prueba PGlite de cadenas inválidas y `migrations-journal.test.ts` pasan; prefijo duplicado resuelto. |
| F10 | `parseSourceStatuses` valida el JSON persistido; la ruta usa el validador, no el cast inseguro. `source-status-verification.test.ts` pasa. |
| F11 | Descripción en src/lib/AGENTS.md distingue referencias nuevas de formatos legacy. Informe y roadmap consolidados. Snapshots históricos intactos: 0085_snapshot corresponde a 0086; 0086_snapshot a 0087_price_suggestions_and_blocked_plays_guard; 0087_snapshot a la entrada ahora llamada 0088. |

## 3. Verificación ejecutada sobre la base fusionada
- Node **22.23.5**, Bun 1.4.4; Node 26 **no ejecutado**.
- `oj typecheck -b --noEmit`: **exit 0**, sin errores. No ejecuté `tsc` literal: la instrucción del entorno exige el checker permitido. No presentar esta ejecución como un comando tsc.
- `bunx vitest run`: **333/333 archivos; 5570/5570 pruebas**, exit 0; duración 214,89 s. `factory-ledger.test.ts` pasa **15/15 dentro de la suite**, sin expiración ni repetición aislada necesaria. Hay avisos en stderr de pruebas de fallos simulados/React; no hubo pruebas fallidas.
- Formato: todos los archivos de producto permitidos del inventario pasan. No ejecuté lint global ni formateé pruebas/autogenerados.
- Compilación: el log de build automático no está disponible en esta sesión. El servidor supervisado registra reconstrucción y `client bundled (175 files)` de los cambios fusionados, y sirve /onboarding. No ejecuté build manual, prohibido por el entorno; no afirmo haber comprobado un build completo de producción.
- Navegador con sesión válida en `/onboarding`: **cuatro subidas y eliminaciones reales de TXT sintéticos**, 1280×1800 y 375×812, claro/oscuro. Cada fila pasó a «lista» y desapareció tras Quitar; cero errores de página, cero respuestas Storage >=400, sin scroll horizontal. Cuatro capturas inspeccionadas en `/tmp/browser/final-f1-f11/`, privadas por mostrar la sesión. No lancé lectura IA, no hubo envíos ni llamadas de pago.
- Evidencias de comandos en `/tmp/f1-f11-verification/` (temporales); el resumen persistente es este informe.

## 4. Auditoría real de Storage — solo lectura, repetida hoy
Bucket `onboarding-sources`: privado (`public=false`), límite **20971520 bytes**, `allowed_mime_types=null`. El bucket existente no restringe MIME; la provisión para uno nuevo sí limita PDF/TXT/MD/CSV y no sobrescribe configuración existente.

| Política | Operación | Rol | Condición |
|---|---|---|---|
| onboarding sources read | SELECT | authenticated | bucket_id = onboarding-sources AND onboarding_source_path_ok(name,false) |
| onboarding sources upload | INSERT | authenticated | bucket_id = onboarding-sources AND onboarding_source_path_ok(name,true) |
| onboarding sources delete | DELETE | authenticated | bucket_id = onboarding-sources AND onboarding_source_path_ok(name,true) |

Son las tres políticas del catálogo consultado; todas filtran bucket_id. La función real valida ambos segmentos UUID antes de convertir y comprueba pertenencia/autor. No modifiqué esquema, políticas ni configuración del bucket.

## 5. F12 y límites
**Decisión de Fede:** los documentos de `onboarding-sources` **nunca se borran automáticamente**. No existe una nueva retención por plazo, aprobación o lectura. Quitar un documento sintético fue una acción manual explícita de verificación, no limpieza automática. Retirada de un bucket requiere inventario y autorización explícita; no ejecutada.

No probado: Drive real Doc/Sheet/Slides/PDF, usuarios reales de otros roles, lectura con IA real, Node 26, build completo de producción y entorno nuevo aprovisionado. RLS/Drive indicados arriba son simulaciones, no estas verificaciones externas.

No se publicó ni desplegó. Torre de control GTM y Salida de Lovable intactas. No cambié pruebas, código funcional, migraciones ni snapshots en esta entrega documental. NK-0159, NK-0160 y el resto de la cola no iniciados. NK-0176 se presentó como SDD Borrador y Fede aprobó el plan durante esta sesión; su entrega se documenta debajo.

## Anexo: cambios de pruebas autorizados en una entrega anterior
Este registro histórico no autoriza nuevos cambios de pruebas.

## Reescritura autorizada de 4 pruebas de «Tus fuentes» (permiso de Fede, 13-11-2026)
Motivo común: la Fase 1 cambió la subida (cada archivo va al almacenamiento privado como referencia; Drive como referencia), y las pruebas esperaban archivos en memoria con un tope de 3. Mocks nuevos en esos dos archivos: cuenta con org/usuario, almacenamiento simulado que registra cada subida y un selector de Drive simulado.
1. sources.test.tsx «two files added one after the other are both listed»: se conservan todas las aserciones (dos PDF listados) → se añaden: cada uno se sube una vez a `org-1/user-1/…`, y un documento de Drive se suma a la lista sin sustituir los archivos (3 en total).
2. sources.test.tsx «adding the same file again does not list it twice»: se conserva «listado una sola vez» → se añaden: una sola subida, aviso exacto «Ya estaba en la lista: plan-negocio.pdf.», y en Drive el mismo id no se repite pero otro id con el mismo nombre sí entra. Cambio de producto necesario: como cada subida tiene ruta nueva, el mismo archivo elegido otra vez se reconoce por nombre (antes se habría subido y listado dos veces).
3. sources.test.tsx «past the limit…»: `MAX_FILES` (3) y selecciones de 3 → `MAX_SOURCES` (20) y selecciones de 5; se conservan «lo listado se queda», «se nombra lo que queda fuera» y «N documentos»; el filtro del texto «pendiente» → estados reales «subiendo/lista/error al subir»; se añade: lo que queda fuera nunca se sube.
4. sources-limit.test.tsx «one selection past the limit…»: aviso exacto antiguo «Una lectura admite hasta 3 documentos… súbelos a Drive…» → «Una lectura admite hasta 20 documentos entre archivos y Drive. Se quedan fuera: doc-21.pdf, doc-22.pdf. Quita alguno de la lista si quieres añadirlos.» (el antiguo era falso con el tope de 20); `MAX_FILES` → `MAX_SOURCES`; nombre «mergeFiles» → «mergeRefs» (la función real); se añade: solo se suben 20.
Nota: en la ronda anterior se añadió solo el stub `DriveRefButton` al mock de src/routes/_authenticated/-onboarding.test.tsx (sin tocar aserciones), necesario porque la Fase 1 importa ese componente.

## Entrega NK-0176 — aprobada y verificada, 13-11-2026
- Fede aprobó el plan y el SDD enlazado, incluidos únicamente tres cambios de expectativas y la verificación textual sin fail-first artificial.
- Cambios: dos cadenas de `BLOCKER_TEXT.linkedin_d2`; D2 cerrada en la fila de decisiones y exclusión del PRD. No se cambió catálogo, identificadores, activación, permisos ni herramientas.
- Pruebas protegidas: solo dos expectativas de label en `src/lib/plays/status.test.ts` y una en `src/lib/agent/tools/plays.test.ts`: «Bloqueado: falta una decisión de LinkedIn» → «Bloqueado: falta una integración con la API oficial de LinkedIn». Conservadas todas las aserciones de bloqueo, 28 plays, no escrituras y aislamiento. Ninguna otra prueba existente cambiada.
- Tres pruebas nuevas CA-1/2/3 en `src/lib/plays/linkedin-d2.test.ts`: pasan antes 3/3 y después. Son invariantes de regresión, no pruebas de copy ni fail-first.
- Checker `oj typecheck -b --noEmit`: exit 0. Node 22.23.5; Node 26 y tsc literal no ejecutados.
- Primera suite posterior sin limitar concurrencia: 331 archivos pasan, 3 fallan; 5555 pruebas pasan, 6 expiran y 12 se omiten por timeout del beforeAll. Expiraciones: cinco casos de factory-ledger (5 s), un caso de safe-logs-notes (5 s) y preparación de knowledge-rules-unique.pg (60 s). No se modificaron pruebas ni timeouts.
- Repetición de esos tres archivos con un worker: 32/32 pasan. **Suite completa repetida con `--maxWorkers=4`: 334/334 archivos y 5573/5573 pruebas**, exit 0, 478,68 s. Ninguna omitida. Factory-ledger pasa también en esta suite.
- Build automático: **build OK 2026-11-13T12:28:07Z**, posterior al cambio de producto. Build manual de producción no ejecutado.
- Navegador con sesión válida, `/plays`: seis tarjetas de LinkedIn con el nuevo bloqueo; activación deshabilitada y texto antiguo ausente. Escritorio 1280 y móvil 375, claro/oscuro; cuatro capturas de tarjeta inspeccionadas. Sin overflow horizontal ni errores de página. Se cargaron lecturas reales; no se activó ningún play, no se lanzó IA ni se hicieron envíos. La coherencia del asistente se comprueba por su prueba y estado compartido, no por una conversación IA real.
- Sin migraciones, publicación ni despliegue. F12 intacto; Torre de control GTM y Salida de Lovable intactas. Revisión técnica independiente del SDD no realizada, sin inventar un pase de gate. SDD permanece En curso hasta revisión/aceptación de la entrega por Fede.
- Informe emitido; NK-0159 y los siguientes SDD no iniciados en esta sesión.

## Autorización general y entrega NK-0159 — 13-11-2026, desde 14:08 UTC

La autorización permite guardar cada SDD y construir sin esperar confirmación entre entregas. No autoriza modificar pruebas existentes, llamadas de pago de verificación, publicación, despliegue, migración de empresas existentes ni correo real. La revisión independiente de NK-0176 no se inventa ni se marca realizada.

### Hecho y comprobado
- SDD: `docs/sdd/SDD-20261113-inngest-safe-autopilot-output.md`. Implementación mínima: dentro del callback `step.run("autopilot")`, después del notificador, retornar únicamente `researched`, `prepped`, `cooling` y `noteCount`. La salida final reutiliza ese resultado saneado. Ningún spread ni nota privada llega a esos dos resultados durables.
- Prueba nueva `src/lib/inngest/autopilot-output.test.ts`: ejecuta el callback real de mantenimiento con SDK, cliente y servicios simulados. Primero falló por la presencia del testigo sintético de error en la salida del paso y final; después pasa. Comprueba también que se conserva el resultado entregado al notificador y se rechazan propiedades extra en la salida persistida.
- Las cinco pruebas protegidas de `safe-logs-notes.test.ts` siguen intactas y pasan: los cores siguen retornando sus notas internas; se sanea la frontera de Inngest, no su contrato.
- Selección de cuatro archivos: 10/10 pruebas. Suite completa `bunx vitest run --maxWorkers=4`: **335/335 archivos y 5574/5574 pruebas**, exit 0, 279,80 segundos. Sin expiraciones ni pruebas omitidas. Node 22.23.5. Log temporal: `/tmp/queue-verification/nk0159-suite.log`.
- Compilación automática: última señal consultada `build OK`, 2026-11-13T14:10:08Z, posterior al cambio funcional. Ningún build manual ejecutado.
- Cero pruebas existentes modificadas; sin migraciones, proveedores reales, envíos, publicación, despliegue o operaciones Git de escritura. El entorno mantiene una rama temporal `edit/…`; no cambié de rama ni fusioné. Se añadió a AGENTS la regla técnica de proyección de salida durable.

### Hecho pero sin poder comprobar
- No ejecuté un checker manual: las instrucciones vigentes del entorno prohíben tanto typecheck como build manuales del proyecto. La señal de compilación automática está disponible, pero no expone un resultado separado del checker de tipos; **no se afirma typecheck limpio**. No ejecuté `tsc` ni Node 26.
- No ejecuté una función real de Inngest ni inspeccioné sus nuevos registros alojados: requiere desplegar el cambio, prohibido. La evidencia es el callback real con servicios simulados, no un historial real. El historial anterior no se borra.
- No hay superficie visual del resultado durable cambiado; no ejecuté una visita irrelevante en navegador como sustituto de su prueba. Escritorio/375 px y claro/oscuro no comprobados para esta entrega sin cambio visual.

### Parado / pendiente
- **Cierre de NK-0159:** bloqueo de tipos resuelto el 13-11-2026 a las 14:25 UTC con resultado externo de Claude comunicado por Fede: `main` 47b0f81, `tsc --noEmit` limpio, Node 22. Lovable no ejecutó ese comando. Inngest alojado sigue sin comprobar porque no se despliega.
- **Continuación:** Fede autoriza que la falta de checker local no detenga entregas posteriores; informar «tipos sin comprobar por restricción del entorno» y Fede los comprobará por lotes.
- Inspección previa de NK-0160: el escáner actual vive dentro de `server-log-scan.test.ts`, una prueba protegida; ampliarlo editando ese archivo está prohibido. No se ha editado ni declarado imposible una alternativa con guardas nuevas. El `console.warn` señalado de Sugerencias ya usa únicamente el nombre del error, no el objeto: comprobado en el código y en `log-hygiene-phase3.test.ts` (pasa).
- Inspección previa de NK-0177: `readTitles` ya filtra reglas de equipo en memoria y su prueba personal/equipo pasa. La expectativa protegida `play-diagnosis.test.ts`, caso «with every base rule present it adds none and says so», exige exactamente «Ya tenías todas las reglas base.» y ausencia de escrituras. No se cambió ni se inició una entrega de redacción que la contradiga.
- F12 permanece: los documentos de `onboarding-sources` nunca se borran automáticamente. Torre de control GTM y Salida de Lovable intactas.

## Entrega NK-0160 — 13-11-2026
- SDD `SDD-20261113-log-scan-title-carriers.md`: complemento AST local en `scripts/server-title-log-scan.ts`, no importado por el código servido. Detecta colecciones alimentadas solo por títulos/nombres, aliases y contenedores; permite longitud/estado y clasificación de errores. Guardia nueva recorre las fuentes de servidor y Sugerencias, devuelve solo ruta y línea, no texto fuente.
- Prueba primero: cinco casos nuevos fallaron por ausencia de detección. Después del cambio hubo tres falsos positivos en ai-gateway (contadores seguros); causa identificada: propagación desde la respuesta entera hacia status. Se corrigió permitiendo la proyección de status, sin tocar producto ni pruebas existentes. Selección final 26/26.
- Suite completa: **336/336 archivos, 5584/5584 pruebas**, exit 0, 261,90 s, cuatro workers. Sin expiraciones ni omitidas. Log temporal `/tmp/queue-verification/nk0160-suite.log`.
- Compilación automática `build OK` 2026-11-13T14:26:45Z. **Tipos sin comprobar por restricción del entorno**, pendiente del lote de Fede. Node 26 no ejecutado.
- El escáner protegido y todas las pruebas existentes permanecen intactos. Sugerencias ya clasificaba el error por nombre y no registraba el objeto: sin cambio de interfaz ni navegador ajeno para suplir una prueba estática. No hay flujo visual cambiado.
- Límite: análisis por nombres dentro de un archivo, no interprocedimental, sin garantía de detección total de datos privados. No envíos, pagos, migraciones, publicación ni despliegue. Informe emitido antes de NK-0177.

## Entrega NK-0177 — 13-11-2026
- SDD `SDD-20261113-default-rules-team-query.md`. Se añadió filtro `scope=team` en la consulta compartida por diagnóstico y creación de reglas. Se conserva el filtro en memoria, la comparación de títulos, los errores y las notas de reglas personales. El filtro evita que las reglas personales consuman la ventana de lectura de reglas del equipo.
- Prueba nueva falló primero por ausencia del filtro; después comprueba nueve reglas personales y creación de nueve reglas de equipo sin sobrescribirlas. Selección de cuatro archivos: **90/90 pruebas**, incluidas las 62 protegidas de herramientas de diagnóstico. Todas las pruebas existentes intactas.
- Suite completa: **337/337 archivos, 5585/5585 pruebas**, exit 0, 242,97 s, cuatro workers. Sin expiraciones ni omitidas. Log temporal `/tmp/queue-verification/nk0177-suite.log`.
- Compilación automática OK 2026-11-13T14:32:11Z, posterior al filtro. **Tipos sin comprobar por restricción del entorno**, pendiente del lote de Fede. No navegador: no cambió ninguna superficie visual; núcleo probado con cliente simulado. No conversación IA real ni creación de reglas reales.
- «Ya tenías todas las reglas base.» se conserva: la prueba protegida exige ese contrato y solo se produce cuando las reglas del equipo están completas. No fue necesario cambiarla para corregir el comportamiento. No migraciones, pagos, envíos, publicación ni despliegue. Informe emitido antes del Bloque B; revisión independiente pendiente.

## Requisito de redacción del Bloque B — resuelto por Fede
- Los cinco PRD del Bloque B exigen redactar sus SDD con `nokko-shape`. La habilidad no está activa en este entorno: `.workspace/skills` solo contiene `b2b-saas-ux-expert` y `geo-aeo-optimizer`. La copia encontrada en el repositorio es un borrador, no una habilidad activa; las instrucciones de la plataforma prohíben ejecutarla como si estuviera activada.
- Fede autorizó usar docs/factory/templates/sdd.md con sus 18 secciones y leer la copia de nokko-shape solo como guía, sin activarla ni ejecutarla. Se conservan las demás reglas, las decisiones del documento de Fede y las paradas por datos o documentos contradictorios. Requisito de redacción resuelto; no se necesita activar la habilidad.
- Primera investigación de NK-0173 sin gasto: documentación oficial pública de Apollo consultada (`https://docs.apollo.io/docs/enrich-people-data`, `https://docs.apollo.io/reference/get-complete-person-info`, `https://docs.apollo.io/reference/people-enrichment`, `https://knowledge.apollo.io/hc/en-us/articles/4423314404621-Understand-Email-Statuses`). El endpoint show enumera verified/extrapolated/unavailable, pero no demuestra que bulk_match tenga exactamente esos mismos valores. No se hizo una llamada de pago, no se inventó mapeo ni se añadió esquema. No se redactó SDD 2b.
- F12, Torre de control GTM y Salida de Lovable siguen intactos. Ningún trabajo continúa automáticamente después del turno.

## NK-0173 SDD 1 — entrega parcial del modelo, 13-11-2026
- SDD completo según plantilla: docs/sdd/SDD-20261113-email-verification-model.md, con enlace al PRD y decisiones. Unidad U-1 implementada en email-verification.ts sin consumidores todavía: clave normalizada, cinco estados, ventana de 90 días, puerta graduada y solo-verificado opcional. Solo verified literal de Apollo se reconoce; desconocidos degradan a no verificable. No se afirma lista exhaustiva de bulk_match ni calidad garantizada.
- Cinco pruebas nuevas fallaron primero por la regla faltante y pasan después. Suite completa **338/338 archivos, 5593/5593 pruebas**, exit 0, 296,00 s, cuatro workers, sin expiraciones ni omitidas. El total real incluye los archivos presentes durante esta ejecución; no se deduce el total sumando solo mis pruebas. Log /tmp/queue-verification/nk0173-model-suite.log.
- Compilación automática OK 2026-11-13T14:44:37Z posterior a U-1. **Tipos sin comprobar por restricción del entorno**. Sin cambio visual: ningún consumidor usa aún el modelo y no se afirma flujo de usuario completo. Pruebas existentes intactas, sin proveedor de pago ni mensajes reales.
- **Parada U-2 de esquema:** EXECUTION §5.2 dice migraciones solo en local/pruebas; la herramienta disponible aplica al backend compartido por preview y publicado. No aplicar allí sin aclaración expresa de Fede. No migración creada ni diario modificado; CA-6 de RLS/retención sin implementar/probar. SDD 1 parcial, SDD 2/3 dependientes sin iniciar, nunca SDD 2b.
- **Parada prospectiva NK-0168 SDD 2:** PRD §8 exige reescribir strategy-screens.test.tsx:421 para eliminar ✓, pero la autorización vigente prohíbe modificar cualquier prueba existente. Ese caso exige getByText("✓") en una tarjeta operativa. Se requiere permiso acotado antes de tocarlo; no se modificó. Esta parada no implica que SDD 1 o 3 se hayan implementado.
- Informe de U-1 emitido; restantes iniciativas del Bloque B no implementadas en esta sesión. No publicación ni despliegue, ni modificación de Torre de control GTM/Salida de Lovable.

## NK-0173 SDD 1 — cierre U-2 autorizado
- Fede autorizó expresamente migraciones nuevas aditivas en backend compartido; sigue prohibida copia de empresas existentes/publicación/despliegue. También autorizó únicamente la expectativa ✓ de strategy-screens.test.tsx:421 para futura entrega de iconografía; no se ha tocado esa prueba.
- Prueba PGlite nueva falló primero por tabla ausente. Tras esquema: lectura solo empresa activa, Owner/miembro no pueden forjar estado, tres tablas comparten dirección, eliminar/cambiar contactos conserva hasta último uso, empresa cascada. Selección final 35/35.
- Herramienta aplicó esquema como **0088_email_verification_model**, repitiendo prefijo existente, tal como Fede pidió vigilar. Reparado nuevo archivo y nuevo tag del diario a **0089_email_verification_model**; anteriores entradas y snapshots intactos. No se volvió a ejecutar SQL ni se reescribió migración anterior. El journal test pasa.
- Catálogo de campos cubre las ocho columnas nuevas; baseline intacto. Primer pase falló porque cuatro conceptos nuevos no tenían referencias; se añadieron módulos reales, no se cambió la prueba protegida. Segundo pase verde.
- Suite completa **339/339 archivos y 5595/5595 pruebas**, exit 0, 268,64 s, sin expiraciones ni omitidas. Compilación automática OK 14:54:18 UTC. **Tipos sin comprobar por restricción del entorno**. Log temporal /tmp/queue-verification/nk0173-schema-suite.log.
- Consultas reales solo lectura confirman ocho columnas y única política SELECT por current_org + membresía. No emails reales escritos para comprobar. No flujo visual aún: consumidores de Apollo/Leads pendientes SDD 2/3; no se afirma verificación completa del producto. SDD 1 implementado y autoverificado, revisión independiente pendiente.
- **Decisión siguiente SDD 2 resuelta por Fede:** conservar email existente y proponer alternativa. Registrada en docs/decisiones-fede-20261113.md. SDD 2 aún no redactado/implementado; no se afirma que el camino actual de revealStakeholder ya respete esa nueva decisión. SDD 3 depende de él.

## Balance de esta sesión
- Hecho y comprobado: NK-0160, NK-0177, modelo/esquema de NK-0173 SDD 1; última suite 5595/5595. Pruebas existentes sin cambios. Reparación del prefijo duplicado informada. Esquema y política reales comprobados en lectura.
- Hecho sin comprobación completa: tipos de las nuevas entregas pendientes del lote externo de Fede; no flujos visuales nuevos porque aún no hay consumidores del estado de email; no historial de proveedor ni llamadas reales de pago.
- Pendiente, **sin bloqueo externo actual**: NK-0173 SDD 2 y 3; NK-0168 SDD 1–3; NK-0171; NK-0167 y NK-0174. La decisión de email, plantilla, esquema aditivo y expectativa ✓ ya están resueltas; no volver a preguntarlas. El trabajo pendiente no se ejecuta después de terminar este turno.
- Paradas futuras vigentes: copia de empresas existentes hasta conteos y permiso; buzones ajenos hasta revisión legal; credenciales que falten; gasto real y correo real de comprobación; cualquier prueba existente no autorizada; publicación/despliegue siempre prohibidos en esta cola.

## Continuación NK-0173 SDD 3 — 13-11-2026, desde 16:34 UTC
Este balance sustituye el estado pendiente de SDD 2/3 del balance anterior. SDD 2 estaba implementado al retomar; SDD 3 tenía U-1–U-4 y faltaba catálogo/U-5.

- **Cambio:** seis columnas de email_draft_blocks catalogadas sin ampliar baseline; lectura de estados por lotes con org_id explícito y cliente del miembro; estado/fecha junto al email en stakeholders, lead y Personas (tabla/móvil); botón «Verificar email» del stakeholder reutiliza revelado y coste del catálogo. ApolloReveal invalida la consulta de estados al terminar. No verificador nuevo ni revelado en lead/people.
- **Errores corregidos:** status del agente acotado al CHECK de la tabla; email_block no sale hacia la tabla suggestions en estrategia ni followup durable. Este último registra también el bloqueo con superficie/estado/motivo. recordEmailDraftBlock usa Db tipado, sin any nuevo.
- **Prueba primero:** archivo nuevo email-verification-read.test.ts falló por módulo ausente; field-coverage protegido detectó exactamente las seis columnas sin catálogo. Después selección 40/40, más PGlite/helper 7/7. La prueba PGlite de la migración existente se añadió ahora, sin modificarla ni reaplicarla; valida permisos con defaults reales, aislamiento, inserción propia, bloqueo de UPDATE/DELETE/anon, restricciones y columnas sin email.
- **Suite completa:** `bunx vitest run --maxWorkers=4`, **347/347 archivos; 5648/5648 pruebas**, 332,66 s, sin fallos ni omitidas. Log temporal `/tmp/nk0173-suite.log`. Ninguna prueba existente modificada: solo dos archivos nuevos en esta continuación.
- **Compilación automática:** `build OK` a las **16:42:02 UTC**, posterior a correcciones funcionales. No build ni checker manual: prohibidos por el entorno. No se declara ejecución manual de tsc; el lote previo ya tenía comprobación externa comunicada por Fede.
- **Base real, solo lectura:** information_schema confirma email_verifications (ocho columnas) y email_draft_blocks (seis). Ambas migraciones estaban aplicadas antes de esta continuación, no dependen de publicar; no se ejecutó SQL de escritura ni se tocaron datos reales.
- **Límite visual:** sesión de Fede restaurada correctamente mediante la herramienta, pero navegación local a Personas/Cuentas quedó en esqueleto incluso tras 90 s; peticiones de módulos abortadas y un favicon ausente, sin excepción de página. No se declara CA-2/CA-8 verificado en navegador ni desktop/móvil/claro/oscuro completados. No se pulsó revelado ni hubo gasto real. SDD permanece En curso; revisión independiente pendiente.
- **Sin publicar/desplegar/fusionar**, sin envíos ni copia de empresas. F12 intacto. No se inició otra iniciativa en esta continuación; NK-0168, NK-0171, NK-0167 y NK-0174 siguen en su orden, con sus paradas documentadas.

## NK-0173 — correcciones de Fede (13-11-2026)
- `proactive-email-gate.test.ts`: `as any` → `as unknown as Db` con motivo; la aserción de inserción pasa del cliente del miembro al privilegiado (mock de client.server) y se añade «el miembro no escribe» (0 inserciones). Motivo: punto 2 de Fede.
- `agent-tools-email-gate.test.ts` (prueba nueva de este mismo ticket): mismas aserciones, leídas del cliente privilegiado, más «0 escrituras del miembro». Motivo: punto 2.
- Migración `0091_email_draft_blocks_privileged_writes`: quita la política de insert y el INSERT de `authenticated`; vuelta atrás en la cabecera. Prueba PGlite nueva `email-draft-blocks-privileged.pg.test.ts` (falla con solo 0090, pasa con 0091). `email-draft-blocks.pg.test.ts` intacta: sigue probando 0090 por sí sola.
- Revisión visual: bloqueada. La base no tiene ninguna empresa (0 organizaciones, 0 leads); la cuenta de Fede abre en «Crea una empresa». No se crean datos sin permiso.

## NK-0173 — revisión visual de la ficha del contacto (13/11/2026)
- Datos: «Cuenta de prueba Nokko» en «Empresa de prueba Nokko» con 6 contactos sintéticos (@example.com) y 4 estados simulados guardados directamente (sin llamar a Apollo, sin gasto).
- Visto en escritorio 1280 y 375 px, claro y oscuro: la ficha muestra bajo el email «catch-all · 13/11/2026», «no verificable · 13/11/2026», «inválido · 13/11/2026» (en rojo), «sin verificar» y nada para el contacto sin email. Con email aparece «Verificar email»; sin email, «Conseguir email». No pulsé ninguno. Sin desplazamiento lateral (scrollWidth = ancho en las 4). Consola: un 404 de recurso en la primera carga de escritorio claro; red sin otros fallos.
- No visto: bloqueo de borradores en pantalla (aparece en sugerencias y agente; generarlos requiere IA). Etiqueta de «verificado» presente en el texto de la ficha de Ana, sin captura dedicada.
- Empresa activa devuelta a Postin.
- Commit/SHA: no aplicable; este entorno no permite hacer commits (los gestiona Lovable automáticamente).
