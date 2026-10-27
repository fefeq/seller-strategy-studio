# Guion de prueba: Google Drive propio por empresa (antes de producción)

**Para:** Fede · **Rama:** `feat/connections-own-account-v2` (PR #32, borrador) · **Fecha:** 2026-10-27
**Qué cierra:** los dos [Por verificar] decididos el 2026-10-27: qué hace Google al revocar un token (SDD 5 §15) y la cookie del retorno con el dominio publicado (SDD 10 §15).
**Dónde:** en la **vista previa** de Lovable, nunca en producción. Solo datos de prueba.

## Antes de empezar
| Qué | Estado |
|---|---|
| Cliente OAuth de Google en modo prueba, con tu cuenta como usuario de prueba | Falta |
| Dirección de retorno `<dominio de la vista previa>/api/public/drive/callback` en ese cliente | Falta |
| Secretos `GOOGLE_OAUTH_CLIENT_ID` y `GOOGLE_OAUTH_CLIENT_SECRET` en Lovable Cloud (y `GOOGLE_OAUTH_REDIRECT_URI` si hace falta) | Falta |
| Migración 0059 aplicada en el entorno de la vista previa (comprobar en el panel de Lovable que `drive_connections` existe) | Falta |
| Dos empresas de prueba donde eres Owner (A y B) y una segunda cuenta de Google de prueba (cuenta 2) | Falta |

Si falta algo de esta tabla, la tarjeta de Drive solo muestra «Falta configurar el acceso a Google en el servidor».

## Pasos
Apunta en cada paso lo que ves de verdad. No marques «Hecho» sin haberlo visto.

| # | Paso | Resultado esperado | Resultado real |
|---|---|---|---|
| 1 | Empresa A, Conexiones, «Conectar mi cuenta». Elige la cuenta 1 y acepta | Vuelves a Conexiones. Estado «Cuenta propia», con el email (en minúsculas), quién la conectó y cuándo. Aviso «Drive conectado.» | |
| 2 | En ese consentimiento, Google pide un solo permiso: ver y gestionar los archivos que NOKKO crea (`drive.file`) | Ningún permiso de leer todo el Drive | |
| 3 | Mira las cookies del sitio tras volver | La cookie `nokko_oauth_drive` ya no existe (se borra siempre al volver) | |
| 4 | Repite el paso 1 y, con las herramientas del navegador, comprueba la cookie mientras estás en la pantalla de Google | Existe `nokko_oauth_drive`, httpOnly, SameSite=Lax, `Secure` con https, ruta `/api/public/drive`. Apunta el dominio con el que se guardó | |
| 5 | Empresa B, conecta la **misma cuenta 1** | Conecta y avisa de que ya estaba conectada en otra empresa. Sin nombrar cuál | |
| 6 | Empresa A, «Cambiar de cuenta»: elige la cuenta 2 | Estado con la cuenta 2. Mensaje: «No se revocó el acceso en Google porque … sigue conectada en otra empresa.» | |
| 7 | Empresa B: crea algo que use Drive (por ejemplo guardar un documento) | Sigue funcionando con la cuenta 1. Si falla, la revocación del paso 6 se ha llevado el acceso de B y hay que anotarlo: es el [Por verificar] de SDD 5 §15 | |
| 8 | Empresa A, «Cambiar de cuenta» y elige otra vez la cuenta 2 (la misma) | Mensaje «Es la misma cuenta de Google: no se revocó nada.» La conexión sigue funcionando | |
| 9 | Empresa B, «Desconectar» | Se desconecta al momento. Si Google contesta bien: «Google confirmó que se revocó el acceso…». Si no: «No pudimos revocar…» con el enlace a los permisos de Google | |
| 10 | Mira en `myaccount.google.com/permissions` de la cuenta 1 | NOKKO ya no aparece. Anota si sigue apareciendo | |
| 11 | Empresa A (cuenta 2): crea algo que use Drive tras todo lo anterior | Sigue funcionando con la cuenta 2 | |
| 12 | Empresa A, «Desconectar» | Desconecta; la empresa vuelve a la cuenta que proporciona NOKKO. Lo importado a Conocimiento se conserva | |
| 13 | Inicia una conexión, copia la dirección de Google (con su `state`) y ábrela en **otro navegador** o en una ventana privada | Al volver: «Esta conexión no se inició en este navegador o ya se usó.» No se guarda nada | |
| 14 | Repite el retorno del paso 13 en el navegador que sí la inició, tras haberla completado | Rechazado: «ya se usó» (por instancia: si cae en otra instancia puede pasar; anótalo) | |
| 15 | Cancela el consentimiento en Google | «Cancelaste la conexión con Google. No se ha cambiado nada.» | |
| 16 | Con un usuario que no sea Owner, abre Conexiones | Ve el estado, sin botones, con «Solo el Owner de la empresa puede conectar o desconectar Drive…» | |
| 17 | Con la cuenta 1 ya conectada en una empresa, revoca NOKKO a mano desde `myaccount.google.com/permissions` y usa Drive en esa empresa | Estado «Error» con aviso «Sin acceso…». No cae a la cuenta de NOKKO | |

## Qué hacer con los resultados
- Los pasos 6, 7, 9 y 10 cierran lo de qué hace Google al revocar: anota lo que pasó, con fecha, en SDD 5 §15.
- Los pasos 3, 4, 13 y 14 cierran lo de la cookie con el dominio publicado: anótalo en SDD 10 §15. Repite 3, 4, 13 y 14 con el dominio publicado cuando esté.
- Si un paso no sale como se espera, no lo arregles aquí: se pide un cambio con el caso exacto.

## Límites de esta prueba
- La vista previa y el dominio publicado pueden dar cookies distintas: la prueba no vale para el segundo hasta repetirla allí.
- El «un solo uso» se recuerda por instancia (mejora futura decidida el 2026-10-27), así que el paso 14 puede no comportarse igual en otra instancia.
- No cubre el selector de Google ni la lectura de documentos existentes (SDD 5 U-2).
- No cubre la verificación de Google de la pantalla de consentimiento para `drive.file`, que sigue [Por verificar].
