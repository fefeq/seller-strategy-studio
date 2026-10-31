# SDD-20261025-drive-per-company-account · [Feature] Google Drive de una cuenta distinta al email de acceso

**Tipo:** Feature · **Prioridad propuesta:** Media-Alta
**Estado:** Aprobado por Fede (2026-10-26) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-25
**PRD:** docs/prd/PRD-20261028-ux-onboarding-coherencia.md (cubre G-6) · **Depende de:** —

## 1. Resumen
> Decisión de Fede (2026-10-25): conexión **por empresa**. La entrada vive en Conexiones.

Como usuario quiero conectar **un Google Drive distinto al de mi email de acceso** (p. ej. el de la empresa) y que NOKKO lea documentos desde ahí para el onboarding y el conocimiento.

## 2. Problema y para quién
Founder o miembro cuyo email de acceso no es la cuenta Google donde están los documentos de la empresa.

## 3. Evidencia y por qué ahora
- Petición directa de Fede (2026-10-25).
- Código del repo: la conexión a Drive se hace con credenciales de entorno a través de una pasarela de conectores (nombre de variables del código, no fuente de verdad del producto; `src/lib/google-drive.ts`: `LOVABLE_API_KEY`, `GOOGLE_DRIVE_API_KEY`), es decir, una única cuenta para toda la aplicación o constructor. **[Por verificar]** en la revisión técnica cómo se vincula la cuenta de cada usuario en producción.
- Sin datos de cuántos usuarios lo necesitan (sin dato).

**Apuesta declarada:** no hay datos de uso; la prioridad se apoya en el código de `main` y en la petición de Fede. Se medirá tras el lanzamiento con las métricas de la sección 4.

## 4. Resultado buscado
- % de empresas con Drive conectado que lo conectan con una cuenta distinta al email de acceso (fuente: base de datos). Línea base: sin dato.
- Lecturas de Drive fallidas por falta de acceso (fuente: registro de trabajos de importación). Línea base: sin dato.
- Cubre el objetivo G-6 del PRD.

## 5. Alcance
**Incluye:** conectar, ver, cambiar y desconectar una cuenta de Google para Drive, independiente del email de acceso, **desde la sección Conexiones** (SDD de conexiones propias); elegir carpetas o archivos; mostrar qué cuenta está conectada; permisos mínimos necesarios.
**No incluye:** ampliar lo que NOKKO hace hoy en Drive (hoy crea carpeta por empresa y por cuenta y guarda planes, propuestas y documentos del ciclo: eso se mantiene, ahora sobre la cuenta conectada, **[Por verificar]** qué permiso exige); otros servicios de Google; varias cuentas simultáneas por empresa (pregunta 1).

## 6. Cambios de comportamiento (delta)
**Añadido:** conexión por empresa a una cuenta elegida; pantalla de cuenta conectada; desconexión que revoca acceso.
**Modificado:** lectura de Drive en onboarding y conocimiento usa la cuenta conectada de la empresa (antes: cuenta única del entorno).
**Eliminado:** dependencia de una cuenta única compartida para clientes.

## 7. Historias y criterios de aceptación
### H-1: Como founder, quiero conectar otra cuenta de Google Drive.
- CA-1: CUANDO elijo conectar Drive, el sistema DEBE permitirme escoger la cuenta de Google, aunque sea distinta del email con el que accedo a NOKKO · cubre G-6 · prueba: por nombrar en el brief
- CA-2: El sistema DEBE pedir únicamente los permisos mínimos necesarios y explicar qué podrá leer y qué podrá guardar NOKKO antes de continuar · cubre G-6 · prueba: por nombrar en el brief
- CA-3: CUANDO la conexión termina, el sistema DEBE mostrar la cuenta conectada (su email) y desde qué fecha · cubre G-6 · prueba: por nombrar en el brief

### H-2: Como founder, quiero controlar y revocar el acceso.
- CA-4: CUANDO desconecto la cuenta, el sistema DEBE dejar de leer de esa cuenta de inmediato y dejar de ofrecerla como fuente · cubre G-6 · prueba: por nombrar en el brief
- CA-5: CUANDO desconecto, el sistema DEBE preguntarme si conservar o eliminar los conocimientos ya importados de ese Drive · cubre G-6 · prueba: por nombrar en el brief
- CA-6: El sistema DEBE permitir cambiar de cuenta sin perder las fuentes ya importadas, que conservan su origen · cubre G-6 · prueba: por nombrar en el brief

### H-3: Como founder, quiero que el onboarding y el conocimiento usen esa cuenta.
- CA-7: CUANDO elijo documentos o carpetas, el sistema DEBE listarlos desde la cuenta conectada de mi empresa · cubre G-6 · prueba: por nombrar en el brief
- CA-8: MIENTRAS no haya cuenta conectada, el sistema DEBE ofrecer conectarla en el paso de fuentes, sin bloquear el resto del onboarding · cubre G-6 · prueba: por nombrar en el brief

### H-4: Como Owner o miembro, quiero saber quién puede usar la conexión.
- CA-9: El sistema DEBE indicar qué cuenta de la empresa está conectada y quién la conectó (decidido por Fede, 2026-10-28: solo cuenta de empresa) · cubre G-6 · prueba: por nombrar en el brief
- CA-10: SI mi rol no es Owner e intento conectar, cambiar o desconectar la cuenta de empresa, ENTONCES el sistema DEBE impedirlo y decir que solo el Owner puede; el resto de miembros ve el estado en solo lectura (decidido por Fede, 2026-10-28) · cubre G-6 · prueba: por nombrar en el brief

## 8. Casos límite y errores
- Permiso denegado o cancelado en Google: volver sin cambios y explicarlo (CA-1).
- Token revocado o caducado desde Google: marcar la conexión como «Sin acceso» y pedir reconectar; no perder lo importado (CA-4, CA-6).
- Cuenta sin documentos accesibles: mostrar vacío con explicación (CA-7).
- Archivo sin acceso dentro de una carpeta: marcarlo «Sin acceso» y seguir con el resto (CA-7).
- Cuenta ya conectada en otra empresa: informar y pedir confirmación.
- Cuentas de Google Workspace con restricciones del administrador: mostrar el motivo devuelto por Google.

## 9. Experiencia y copy
Ubicación: sección Conexiones (decidido por Fede, 2026-10-25); el paso de fuentes del onboarding ofrece conectarla (CA-8). Texto: «Conecta el Drive donde están tus documentos. Solo podremos leer lo que elijas. Puedes desconectarlo cuando quieras.» En «tú», sin iconos.

## 10. Datos, permisos y privacidad
- Se guarda el vínculo de la cuenta y su estado; los permisos de lectura mínimos necesarios.
- Los credenciales no se muestran ni se registran.
- Los documentos importados quedan en Conocimiento de la empresa con su origen; no se exponen a otras empresas.
- No se usa ninguna API de LinkedIn; no aplica.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Ninguna (el SDD declara «LLM: ninguna llamada nueva») | no aplica | no aplica | sin dato |

Una llamada no declarada aquí no se implementa.

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | Conexión y desconexión de cuenta elegida (H-1, H-2) | CA-1, CA-2, CA-3, CA-4, CA-5, CA-6 | por nombrar en el brief |
| U-2 | Lectura desde la cuenta de la empresa en onboarding y conocimiento (H-3; depende de U-1) | CA-7, CA-8 | por nombrar en el brief |
| U-3 | Estado, errores y roles (H-4; depende de U-1) | CA-9, CA-10 | por nombrar en el brief |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Hoy `call()` en `src/lib/google-drive.ts` usa claves de entorno contra `https://connector-gateway.lovable.dev/google_drive`; se necesitaría vincular credenciales por empresa o usuario.
- Tabla existente de carpetas de Drive: `drizzle/migrations/0033_drive_folders.sql`; revisar su relación con la cuenta.
- Los permisos de lectura amplios de Drive son «restringidos» en Google y pueden exigir revisión de la app: **[Por verificar]** antes de comprometer fecha.
- LLM: ninguna llamada nueva.

## 14. Riesgos y dependencias
- Revisión de Google para permisos restringidos: puede retrasar el lanzamiento.
- Seguridad de credenciales por empresa: requiere diseño de cifrado/almacén (a validar en la revisión técnica).

## 15. Preguntas para Fede y para la revisión técnica
1. ¿Cómo se autoriza hoy la cuenta de Drive en producción?
2. ¿Puede el gestor de conectores actual vincular una cuenta por empresa?
3. ¿Qué permiso mínimo cubre elegir archivos o carpetas?

## 16. Pendiente de verificar
- [Por verificar] Mecanismo actual de autorización en producción. Verificado en `main` (2026-10-26): `src/lib/google-drive.ts` llama a `connector-gateway.lovable.dev/google_drive` con `LOVABLE_API_KEY` + `GOOGLE_DRIVE_API_KEY` del entorno; no hay cliente OAuth de Google, ni flujo de consentimiento, ni tokens por empresa en el repo. Una sola cuenta (la del constructor) para todas las empresas; el aislamiento es en código (`drive-core.ts`, carpeta «Nokko / <empresa>»). Scopes: solo constan en `src/lib/AGENTS.md` (`drive.readonly` + `drive.file`); se fijan en el conector de Lovable, no en el repo. Sigue sin verificar: producción y los scopes realmente concedidos.
- [Por verificar] Requisitos de verificación de Google. Verificado en la documentación de Google (2026-10-26): `drive.file` es no sensible; `drive.readonly` es restringido (verificación OAuth reforzada y evaluación de seguridad si los datos se guardan en servidor). Sin verificar: si elegir una carpeta con `drive.file` da acceso a su contenido.
- Decisión de Fede (2026-10-25): conexión por empresa, desde Conexiones (README, decisiones tomadas).

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Un agente `nokko-gate` con contexto fresco lee este SDD y el código, y devuelve su informe. El coordinador lo copia aquí sin editarlo. El gate no aprueba el SDD: informa; la aprobación es de Fede.
Informe del gate recibido el 2026-10-28, copiado sin editar. El veredicto no aprueba el SDD: la aprobación es de Fede.
- **Veredicto del gate:** Objeciones
- **CA sin prueba posible o sin G-n:** los 10 CA citan G-6, que es correcto (PRD:29). Ninguno nombra test: todos dicen «por nombrar en el brief» (SDD:38-53), aunque la plantilla exige un archivo de test por CA (templates/sdd.md:33). Algunos tests ya existen y el SDD no los cita: `src/lib/connections.test.ts:60` (CA-1), `:85` (CA-4) y `:105` (canManage, CA-10). CA-2 no se puede probar automáticamente, porque los scopes se fijan en el conector de Lovable y no en el repo (SDD:102).
- **[Por verificar] que sigue sin comprobarse:**
  - SDD:104 marca como abierto quién conecta (empresa, usuario o ambas), pero ya lo decidiste tú: por empresa (SDD:8, PRD:43). Hay que quitarlo de pendientes.
  - Siguen sin comprobarse los scopes concedidos en producción (SDD:102) y si `drive.file` da acceso al contenido de una carpeta elegida (SDD:103).
- **Contradicciones con el código o con decisiones previas:**
  - CA-9 («empresa o personal») y la frase «por usuario o empresa» (SDD:32) chocan con tu decisión de conexión por empresa (SDD:8).
  - CA-10 habla de «miembro sin permiso». Lo decidido es «solo el Owner» (PRD:52) y así está en el código: `canManage` solo devuelve true para el Owner (`connections.ts:75`).
  - CA-5 pregunta si conservar o eliminar lo importado. El código dice lo contrario: al desconectar, lo importado «no se borra» (`connections.ts:121-122`, test en `connections.test.ts:85`).
  - La ubicación no cuadra: «paso de fuentes y ajustes de empresa» (SDD:64) frente a «desde la sección Conexiones» (SDD:28).
  - «Depende de: —» (SDD:5), pero el SDD de conexiones «incluye el 5 como primer caso» (PRD:79), y Drive sigue con `ownAccount: false` (`connections.ts:25`).
  - La sección 10 habla solo de permisos de lectura (SDD:67), pero el alcance mantiene las escrituras (SDD:29).
  - La sección 11 coincide con SDD:90: ninguna llamada a IA nueva.
  - El resto de afirmaciones de código se cumplen: `google-drive.ts:5,14-16`, la migración `0033` con `org_id` y el uso de `insideCompany`.
- **Lo que esta revisión NO demuestra:** el estado de producción, los scopes reales, los requisitos de verificación de Google, que los tests citados fallen sobre el commit base, ni el contenido del SDD de conexiones.

## 18. Delta de implementación (lo rellena el agente al entregar)
Sin entrega todavía.

---
Validación: migrado a la plantilla de NOKKO el 2026-10-28. Revisión técnica: ver sección 17. `AUDIT-20261025.md` es el registro histórico anterior.
