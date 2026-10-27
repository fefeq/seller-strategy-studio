# SDD-20261025-drive-per-company-account · [Feature] Google Drive de una cuenta distinta al email de acceso

**Tipo:** Feature · **Prioridad propuesta:** Media-Alta
**Estado:** En curso (aprobado por Fede, 2026-10-26; rama feat/connections-own-account-v2) · **Pide:** Fede · **Para:** Claude Code · **Fecha:** 2026-10-25

## 1. Resumen
> Decisión de Fede (2026-10-25): conexión **por empresa**. La entrada vive en Conexiones.

Como usuario quiero conectar **un Google Drive distinto al de mi email de acceso** (p. ej. el de la empresa) y que NOKKO lea documentos desde ahí para el onboarding y el conocimiento.

## 2. Problema y para quién
Founder o miembro cuyo email de acceso no es la cuenta Google donde están los documentos de la empresa.

## 3. Evidencia y por qué ahora
- Petición directa de Fede (2026-10-25).
- Código del repo: la conexión a Drive se hace con credenciales de entorno a través de una pasarela de conectores (nombre de variables del código, no fuente de verdad del producto; `src/lib/google-drive.ts`: `LOVABLE_API_KEY`, `GOOGLE_DRIVE_API_KEY`), es decir, una única cuenta para toda la aplicación o constructor. **[Por verificar]** en el código (lo comprueba Claude Code) cómo se vincula la cuenta de cada usuario en producción.
- Sin datos de cuántos usuarios lo necesitan (sin dato).

**Apuesta declarada:** no hay datos de uso; la prioridad se apoya en el código de `main` y en la petición de Fede. Se medirá tras el lanzamiento con las métricas de la sección 4.

## 4. Resultado buscado
- % de empresas con Drive conectado que lo conectan con una cuenta distinta al email de acceso (fuente: base de datos). Línea base: sin dato.
- Lecturas de Drive fallidas por falta de acceso (fuente: registro de trabajos de importación). Línea base: sin dato.

## 5. Alcance
**Incluye:** conectar, ver, cambiar y desconectar una cuenta de Google para Drive, independiente del email de acceso, **desde la sección Conexiones** (SDD de conexiones propias); elegir carpetas o archivos; mostrar qué cuenta está conectada; permisos mínimos necesarios.
**No incluye:** ampliar lo que NOKKO hace hoy en Drive (hoy crea carpeta por empresa y por cuenta y guarda planes, propuestas y documentos del ciclo: eso se mantiene, ahora sobre la cuenta conectada, **[Por verificar]** qué permiso exige); otros servicios de Google; varias cuentas simultáneas por empresa (pregunta 1); Drive de Postin Core.

## 6. Cambios de comportamiento (delta)
**Añadido:** conexión por usuario o empresa a una cuenta elegida; pantalla de cuenta conectada; desconexión que revoca acceso.
**Modificado:** lectura de Drive en onboarding y conocimiento usa la cuenta conectada de la empresa (antes: cuenta única del entorno).
**Eliminado:** dependencia de una cuenta única compartida para clientes.

## 7. Historias y criterios de aceptación
### H-1: Como founder, quiero conectar otra cuenta de Google Drive.
- CA-1: CUANDO elijo conectar Drive, el sistema DEBE permitirme escoger la cuenta de Google, aunque sea distinta del email con el que accedo a NOKKO.
- CA-2: El sistema DEBE pedir únicamente los permisos mínimos necesarios y explicar qué podrá leer y qué podrá guardar NOKKO antes de continuar.
- CA-3: CUANDO la conexión termina, el sistema DEBE mostrar la cuenta conectada (su email) y desde qué fecha.

### H-2: Como founder, quiero controlar y revocar el acceso.
- CA-4: CUANDO desconecto la cuenta, el sistema DEBE dejar de leer de esa cuenta de inmediato y dejar de ofrecerla como fuente.
- CA-5: CUANDO desconecto, el sistema DEBE preguntarme si conservar o eliminar los conocimientos ya importados de ese Drive.
- CA-6: El sistema DEBE permitir cambiar de cuenta sin perder las fuentes ya importadas, que conservan su origen.

### H-3: Como founder, quiero que el onboarding y el conocimiento usen esa cuenta.
- CA-7: CUANDO elijo documentos o carpetas, el sistema DEBE listarlos desde la cuenta conectada de mi empresa.
- CA-8: MIENTRAS no haya cuenta conectada, el sistema DEBE ofrecer conectarla en el paso de fuentes, sin bloquear el resto del onboarding.

### H-4: Como Owner o miembro, quiero saber quién puede usar la conexión.
- CA-9: El sistema DEBE indicar si la conexión es de la empresa o personal, y quién la conectó.
- CA-10: SI un miembro sin permiso intenta conectar o desconectar una cuenta de empresa, ENTONCES el sistema DEBE impedirlo y explicar quién puede.

## 8. Casos límite y errores
- Permiso denegado o cancelado en Google: volver sin cambios y explicarlo (CA-1).
- Token revocado o caducado desde Google: marcar la conexión como «Sin acceso» y pedir reconectar; no perder lo importado (CA-4, CA-6).
- Cuenta sin documentos accesibles: mostrar vacío con explicación (CA-7).
- Archivo sin acceso dentro de una carpeta: marcarlo «Sin acceso» y seguir con el resto (CA-7).
- Cuenta ya conectada en otra empresa: informar y pedir confirmación.
- Cuentas de Google Workspace con restricciones del administrador: mostrar el motivo devuelto por Google.

## 9. Experiencia y copy
Ubicación: paso de fuentes del onboarding y ajustes de empresa. Texto: «Conecta el Drive donde están tus documentos. Solo podremos leer lo que elijas. Puedes desconectarlo cuando quieras.» En «tú», sin iconos.

## 10. Datos, permisos y privacidad
- Se guarda el vínculo de la cuenta y su estado; los permisos de lectura mínimos necesarios.
- Los credenciales no se muestran ni se registran.
- Los documentos importados quedan en Conocimiento de la empresa con su origen; no se exponen a otras empresas.
- No se usa ninguna API de LinkedIn; no aplica.

## 11. Unidades de trabajo
- U-1: Conexión y desconexión de cuenta elegida (H-1, H-2).
- U-2: Lectura desde la cuenta de la empresa en onboarding y conocimiento (H-3; depende de U-1).
- U-3: Estado, errores y roles (H-4; depende de U-1).

## 12. Notas técnicas [Sugerencia — se valida en la implementación]
- Hoy `call()` en `src/lib/google-drive.ts` usa claves de entorno contra `https://connector-gateway.lovable.dev/google_drive`; se necesitaría vincular credenciales por empresa o usuario.
- Tabla existente de carpetas de Drive: `drizzle/migrations/0033_drive_folders.sql`; revisar su relación con la cuenta.
- Los permisos de lectura amplios de Drive son «restringidos» en Google y pueden exigir revisión de la app: **[Por verificar]** antes de comprometer fecha.
- LLM: ninguna llamada nueva.

## 13. Riesgos y dependencias
- Revisión de Google para permisos restringidos: puede retrasar el lanzamiento.
- Seguridad de credenciales por empresa: requiere diseño de cifrado/almacén (lo propone Claude Code y lo aprueba Fede).

## 14. Decisiones abiertas (recomendación de Claude)
Las resuelve Claude Code comprobándolas en el código; lo que no pueda comprobar lo decide Fede con la recomendación de Claude. No hay revisor técnico externo.
1. ¿Cómo se autoriza hoy la cuenta de Drive en producción?
2. ¿Puede el gestor de conectores actual vincular una cuenta por empresa?
3. ¿Qué permiso mínimo cubre elegir archivos o carpetas?

## 15. Pendiente de verificar
- [Por verificar] Mecanismo actual de autorización en producción. Anotado 2026-10-26 (lectura del repo, no de producción): una sola cuenta de Drive para toda la aplicación vía el gestor de conectores (`GOOGLE_DRIVE_API_KEY`); los scopes `drive.readonly` + `drive.file` figuran en `src/lib/AGENTS.md` pero no se pueden comprobar desde el código. Sigue pendiente: lo decide Fede.
- [Por verificar] Qué hace Google al revocar un token de actualización. Documentado: revocar un token revoca el permiso concedido a ese cliente OAuth y esa cuenta, así que podría invalidar también el token nuevo de la misma cuenta (cambiar a la misma cuenta) y el de otra empresa que use la misma cuenta. No se ha comprobado con una cuenta real (sin credenciales ni cuenta de prueba). Mientras tanto el código **no revoca** el token antiguo si la cuenta nueva es la misma ni si otra empresa usa la misma cuenta, y la pantalla solo dice «revocado» cuando Google contestó 2xx. Decide Fede si se prueba con dos empresas y una cuenta de prueba antes de pasar a producción. Anotado 2026-10-27.
- [Por verificar] Requisitos de verificación de Google. Se parte de `drive.file`, que Google trata como no sensible; no confirmado.
- Decidido por Fede (README): conexión por empresa.
- Verificado 2026-10-26: con `drive.file` y Google Picker sobre una cuenta de prueba, Fede informa «funciona OK» para leer los documentos de una carpeta elegida. Es un resultado comunicado por Fede, sin el detalle de las llamadas (`files.list` de la carpeta, `files.get` de un hijo); no lo he reproducido yo. Decisión de diseño: permiso `drive.file` + selector, sin `drive.readonly`.

## 16. Registro de decisiones (lo completa Fede)
- Decisiones tomadas:
- Fecha:
- Decisión: Aceptado / Cambios pedidos / Rechazado

---
Validación: OK (autorrevisión). Auditoría: ver AUDIT-20261025.md (bloqueado hasta cerrar decisiones de Fede).
