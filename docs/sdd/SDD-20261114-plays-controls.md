# SDD-20261114-plays-controls · [Feature] NK-0171 U-5

**Tipo:** Feature + reparación acotada · **Prioridad:** Alta
**Estado:** En curso · **Pide/Aprueba:** Fede (14-11, 00:27 UTC)
**PRD:** docs/prd/PRD-20261112-plays-a-medida.md · **Depende de:** SDD-20261113-plays-a-medida-ejecucion

## 1. Resumen
Reparar la colisión 0093 renombrando únicamente los checkpoints nuevos y su metadata. Mostrar los plays guardados de la empresa en /plays con estado, pruebas, sugerencias y gasto separado por naturaleza y moneda. Owner y Sales Leader pueden activar/pausar y registrar resultados, sin ejecutar proveedores desde estos controles.
## 2. Problema y para quién
Los plays guardados no tienen controles visibles; la suite falla por dos archivos con el mismo número.
## 3. Evidencia y por qué ahora
Fallo reproducido en migrations-journal.test.ts. Checkpoints ya aplicados (created_at 1794613635363); no volver a aplicar su SQL ni cambiar su timestamp. U-5 solicitado expresamente.
## 4. Resultado buscado
G-1 estado activo visible y G-3 muestra/éxitos/fecha persistentes. Sin datos de uso.
## 5. Alcance
Incluye numeración, lista, controles, resultados manuales y actividad real guardada. No incluye ejecuciones de pago, desbloqueo de denegaciones/recibos inciertos, envíos, publicación ni cambios a pruebas existentes.
## 6. Cambios de comportamiento
Añadido bloque «Plays de tu empresa» en el catálogo; acciones confirmadas y resultados manuales. Sin eliminar datos ni alterar el catálogo.
## 7. Historias y criterios
- CA-1: diario sin prefijos duplicados; SQL histórico intacto · prueba existente migrations-journal.test.ts.
- CA-2: solo Owner/Sales Leader cambian estado/resultados, siempre sobre la empresa actual · G-1/G-3 · controls.test.ts y controls-core.test.ts.
- CA-3: activar conserva primera activación, rechaza archivado, definición/fuentes inválidas y pausa de seguridad; pausar no borra recibos ni desbloquea · G-1 · controls.test.ts.
- CA-4: muestra entera >0, éxitos enteros entre 0 y muestra (0 válido); fecha servidor · G-3 · controls.test.ts.
- CA-5: listado/actividad solo lecturas RLS, sin truncamiento silencioso, gastos IA USD y proveedor EUR separados y «sin dato» nunca sumado como cero medido · G-3 · activity.test.ts.
## 8. Casos límite y errores
Lista vacía, red fallida, empresa cambiada durante confirmación, archivado y denegación se muestran sin inventar resultados. Una pausa global no se borra al activar otro play.
## 9. Experiencia y copy
«Activar», «Pausar», «Registrar resultado», «Pruebas y sugerencias». Confirmación de activación avisa de futuras búsquedas y gasto automático; no es un botón de prueba pagada. Sin fuentes aceptadas se muestra «Sin pruebas guardadas».
## 10. Datos, permisos y privacidad
Sin esquema nuevo. Browser lee bajo RLS; funciones autenticadas validan organización y rol antes de importar cliente privilegiado para las escrituras que ya lo requieren. Actualización condicional protege cambios concurrentes. No exponer payloads privados de pasos; solo contadores, citas y sugerencias visibles al miembro.
## 11. IA
Ninguna llamada nueva; ninguna llamada durante la verificación.
## 12. Unidades
U-1 reparar numeración (CA-1). U-2 reglas y escrituras autenticadas (CA-2–4), pruebas nuevas rojas primero. U-3 presentación y lecturas (CA-5), pruebas y navegador.
## 13. Notas técnicas
Reutilizar canTogglePlays, checkProposal/checkSources, askConfirm, IconText, errorText y queryOptions. Guardar el ID de empresa esperado y rechazar un cambio de empresa. No reusar validateTestDesign para resultados: valida umbral esperado >0, no éxitos observados.
## 14. Riesgos
Activar implica trabajo automático posterior; la verificación solo pausa un play sintético ya pausado, nunca activa vigilancia. Pausas por proveedor siguen bloqueadas hasta revisión explícita posterior.
## 15. Preguntas
Ninguna para este alcance autorizado.
## 16. Pendiente de verificar
Proveedor real y trabajo alojado: no se ejecutan. Tipos manuales: restricción del entorno.
## 17. Revisión independiente
No revisado; no se declara aceptación final.
## 18. Delta
14-11: archivo/tag checkpoints renombrados a 0094, SQL/idx/when/snapshots intactos; check limpio y suite completa 5816/5816 en 364 archivos. CA-2–4: 8 pruebas; CA-5: una prueba nueva. controls.test y activity.test fallaron primero por módulos ausentes. Ninguna prueba existente modificada. Compilación automática OK 00:31:23 UTC; tipos no ejecutados manualmente.
Navegador con sesión de Fede: resultado sintético 20/0 guardado y releído tras recarga en empresa de prueba, después restaurado a null para no inventar resultado real. Se vio pausa por denegación, 0 pruebas, 0 sugerencias y 0,01 EUR estimados previos. No se activó ni ejecutó play; Postin restaurada. Escritorio 1280 y móvil 375 claro/oscuro, 0 errores de página; 6 px de overflow en barra móvil existente, no modificado fuera de alcance. Revisión independiente pendiente.