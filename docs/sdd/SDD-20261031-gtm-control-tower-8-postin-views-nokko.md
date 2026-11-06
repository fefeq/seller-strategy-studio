# SDD-20261031-gtm-control-tower-8-postin-views-nokko · [Feature] Conexión a las vistas de Postin: credencial, lector y fuente de «Activa» y «Publicó» (SDD-8, lado Nokko)

**Tipo:** Feature · **Prioridad propuesta:** Media
**Estado:** Aprobado por Fede el 2026-11-02 (v5, tras cuatro pasadas del gate; sin quinta pasada; con los riesgos declarados del §14) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-31
**PRD:** `docs/prd/PRD-20261030-gtm-control-tower.md` · **Depende de:** SDD 4a (estado y lecturas de integraciones: U-1; ciclo de vida de un valor automático y «Sin fuente conectada»: U-2; patrón de fuente automática: U-3), SDD 1a (resultados clave: U-3; canales: U-4; auditoría: U-7), SDD de conexiones propias (`connections-bring-your-own-account`, §8 y CA-5: la confirmación de cuenta compartida que CA-14 sustituye para este proveedor), SDD 3 (diccionario: U-1; recorridos y fechas de etapa: U-4; embudo y coste por etapa: U-5) y los SDD de salida de Lovable A y B para construir (la migración debe conservar la clave de cifrado del servidor y copiar las tablas nuevas) · **Enmienda:** sustituye a 4a CA-10 y CA-31, cierra 4a U-5 y toca SDD 3 CA-15, el SDD de conexiones propias, el 5d y el PRD (ediciones concretas en el §6) · **Coordinar con:** `SDD-20261031-nokko-aggregate-views` (el lado Postin, que ejecuta Dani) · **Antes:** SDD 4a

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre.
> Los criterios no nombran tecnología; lo técnico va en el §13 como [Sugerencia — la revisión del gate las valida].
> Las reglas transversales del PRD (§6.2, R-1 a R-10) aplican a todo este SDD. «Organización» es la empresa que usa Nokko; «cuenta» es una empresa prospecto o cliente.
> Este SDD es la mitad Nokko del SDD-8: la que construye nuestro agente de implementación. Crear las vistas en la base de datos de Postin y su credencial de solo lectura lo hace Dani con `SDD-20261031-nokko-aggregate-views` (decisión de Fede, 2026-10-31); este SDD fija el contrato que esas vistas deben cumplir (§10).

## 1. Resumen
Permite al Owner conectar a Nokko las vistas agregadas de solo lectura de la base de datos de Postin, leerlas cada 24 horas y usar el número de personas que alcanzan «Activa» y «Publicó», por día y canal, como fuente automática de un resultado clave. No lee ninguna clave de persona ni texto de cliente. Sin conexión, «Activa» y «Publicó» siguen en entrada manual.

## 2. Problema y para quién
Hoy «Activa» y «Publicó» se rellenan a mano (PRD §6.1, SDD 3 CA-15), así que los resultados clave de activación nacen con «Sin dato» o desactualizados. Para Fede (Owner), que conecta la fuente, y Flor (Sales leader), que ve los resultados.

## 3. Evidencia y por qué ahora
- **PRD §6.1 (Fede, 2026-10-29 a 31):** vistas agregadas de solo lectura de la base de datos de Postin, preparadas por Dani; «Activa» y «Publicó» manuales hasta que Dani las entregue.
- **SDD 4a (aprobado):** CA-10 y CA-31 dependen del SDD-8; 4a U-5 está diferida hasta que exista; 4a §13 dice que `org_connections` no tiene columna de credencial y que el almacén lo decide el SDD-8.
- **Código (repo de Nokko, solo lectura, 2026-10-31):** existe un cifrador de credenciales (`src/lib/secret-box.server.ts`, AES-GCM con una clave del servidor) que hoy guarda la clave de PostHog; el puerto que guarda y borra credenciales de `connections-core.ts` (`storeCredential`, `discardCredential`) es opcional y no tiene implementación.
- **Decisiones de Fede para este SDD (2026-10-31):** SDD-8 se divide en dos, el lado Nokko lo ejecutamos nosotros y el lado Postin va a Dani; las vistas son un agregado por día y canal sin ninguna clave de persona; Nokko las lee cada 24 horas, más sincronización manual.
- **Decisiones de Fede sobre la primera pasada del gate (2026-11-02, «recomendadas»):**
  - la misma conexión a Postin no puede estar en dos organizaciones de Nokko;
  - el día de la vista (fecha en UTC) se compara con las fechas del resultado clave como fechas de calendario, con hasta un día de desfase en el borde frente a Europe/Madrid;
  - solo HTTPS, sin conexión directa a la base de datos;
  - en esta v1 el resultado clave usa solo el total, sin filtro de canal;
  - se aceptan recuentos de una o dos personas sin umbral, por ser datos de la propia empresa;
  - el SDD duplicado para Dani (`nokko-activation-data-feed`) se archiva y queda `nokko-aggregate-views`.
- **Decisiones de Fede sobre la segunda pasada del gate (2026-11-02, «recomendadas»):**
  - el «mismo acceso» de dos organizaciones es la misma dirección normalizada, sin credencial;
  - si una de las dos vistas falla, la lectura entera es fallida;
  - al conectar se lee sin esperar 24 horas, reutilizando la lectura de prueba si cumple el contrato;
  - una columna de más o un tipo incorrecto hace fallar la lectura, con texto fijo.
- **Decisiones de Fede sobre la cuarta pasada del gate (2026-11-02, «recomendadas»):**
  - el trabajo diario y sus reintentos se pausan mientras la fase está desactivada para el Owner;
  - con la credencial rechazada, la sincronización manual del Owner o del Sales leader reanuda los reintentos;
  - se aprueba este SDD con los riesgos declarados del §14, sin quinta pasada.
- **Definiciones (SDD 3 CA-14, PRD §6.3):** «Activa» es LinkedIn conectado y un post creado; «Publicó» es el primer post publicado.
- Cuántas organizaciones conectarán estas vistas: **sin dato** (hoy solo la de Postin) [Por verificar].

## 4. Resultado buscado
- Un resultado clave de activación o publicación se alimenta solo, con su fuente y antigüedad, sin teclear. Medición: resultados clave con fuente Postin frente a manuales. Línea base: sin dato.
- Ningún dato de persona llega a Nokko (G-10). Medición: prueba de CA-5.

## 5. Alcance
**Incluye:** H-1 a H-3.
**No incluye:**
- Crear las vistas, el acceso de solo lectura y el cambio en la base de datos de Postin: SDD `SDD-20261031-nokko-aggregate-views` (Dani).
- Fechas de «Activa» y «Publicó» por recorrido o por persona: el agregado por día y canal no las trae. Las entradas manuales por recorrido de SDD 3 CA-15 siguen igual, sin sumarse a un resultado clave alimentado por las vistas (CA-10).
- Otras etapas (Alta, Prueba, De pago, MRR): De pago y MRR vienen de Stripe y del producto (SDD 4a CA-6 y CA-9).
- Leer textos, perfiles de voz, correos o cualquier dato personal de clientes (4a CA-10).
- Conectar vistas de bases de datos distintas de la de Postin.

## 6. Cambios de comportamiento (delta)
**Añadido:** conexión a las vistas de Postin con credencial de solo lectura guardada cifrada; lectura cada 24 horas y a petición; recuentos por día, etapa y canal; fuente automática de «Activa» y «Publicó» para un resultado clave.
**Modificado:** CA-10 y CA-31 de 4a (enmienda): la fuente de «Activa» y «Publicó» es el total agregado del periodo, no la fecha por recorrido, y las entradas manuales de etapa no se suman a un resultado clave alimentado por las vistas; CA-10 reutiliza los criterios de periodo y «Sin atribuir» de 4a CA-23 con un desvío de hasta un día en el borde.
**Eliminado:** nada se borra (R-7).

**Ediciones que provoca la enmienda.** Cada SDD afectado lleva un aviso de enmienda que remite a este (puesto al aprobar); el texto de cada criterio se corrige con el brief de implementación, que DEBE incluirlas:

| Documento | Qué cambia |
|---|---|
| SDD 4a CA-10 y CA-31 | CA-10 de este SDD sustituye a las dos; CA-16 etiqueta el embudo manual por recorrido que sigue |
| SDD 4a CA-9 | «Activa» y «Publicó» siguen manuales por recorrido; la fuente automática de CA-10 es un total por periodo, no una fuente por recorrido |
| SDD 4a CA-3 | Esta fuente se exime de «no menos frecuente que la actual»: se lee cada 24 horas (CA-6) |
| SDD 4a U-5, §12 «Orden», §13, §14 y §15 | U-5 se cierra con este SDD; la prueba `postin-views.test.ts` se retira |
| SDD 5d §14 | Cita «SDD 4a CA-10»: pasa a «SDD-8 CA-10» |
| PRD §6.1 «Activación manual hasta el SDD-8» | Por recorrido no cambia nunca; solo el total por periodo pasa a automático |
| SDD 3 CA-15 y SDD 3 §5 y §14 («hasta el SDD 8») | La condición pasa a «MIENTRAS no exista una fuente automática por recorrido»: con esta fuente conectada, «Activa» y «Publicó» por recorrido se siguen registrando a mano |
| SDD 4a cabecera, aviso de enmienda y §10 | Las referencias a CA-10 y al SDD-8 «pendiente de redactar» pasan a este SDD |
| SDD 5d §10 («valor medido») y CA-10 | Admiten también el total de Postin de este SDD como fuente medida |
| SDD 5d cabecera y U-2 («4a U-5 diferida» y «opcional») y PRD cabecera («SDD-8 pendiente de redactar») | Pasan a citar este SDD y el SDD para Dani |
| `lovable-exit-migration` (alcance de la copia de datos) | Las dos tablas nuevas (credencial y recuentos) entran en su alcance; su «Sin tablas ni columnas nuevas» deja de valer para ellas |
| SDD de conexiones propias (`connections-bring-your-own-account`) CA-5 | Para este proveedor, la misma dirección ya conectada en otra organización se rechaza en lugar de pedir confirmación (CA-14) |

## 7. Historias y criterios de aceptación
Cada CA cita el objetivo G-n del PRD que cubre y el archivo de prueba (ruta por decidir en la implementación [Sugerencia]).

### H-1: Como Owner, quiero conectar y desconectar las vistas de Postin sin exponer la credencial.
- **CA-1** CUANDO el Owner conecta las vistas de Postin con una dirección y una credencial, el sistema DEBE comprobarlas con una lectura de prueba del contrato (§10) antes de guardar nada, DEBE guardar la credencial cifrada y la dirección aparte, sin credenciales ni usuario, sin devolver nunca la credencial al navegador ni a los registros, DEBE guardar esa lectura como la primera lectura correcta, una vez guardada la conexión, si cumple el contrato, y SI la prueba falla, ENTONCES DEBE abstenerse de guardar y decir qué pasó y qué hacer con un texto fijo, sin reenviar el mensaje del origen (PRD R-8). · cubre G-6, G-10 · prueba: `postin-views-connect.test.ts`
- **CA-2** CUANDO el sistema usa la credencial, DEBE exponer a su lector solo la lectura de las dos vistas del contrato, sin ninguna operación de escritura, y DEBE mostrar al conectar que la credencial debe ser de solo lectura. · cubre G-10 · prueba: `postin-views-connect.test.ts`
- **CA-3** El sistema DEBE permitir solo al Owner conectar, cambiar y desconectar esta conexión (SDD 4a, matriz de permisos) y DEBE registrar en la auditoría quién y cuándo, sin guardar la credencial ni la dirección completa, solo el nombre del servidor (SDD 4a CA-18; SDD 1a CA-68). · cubre G-10 · prueba: `postin-views-connect.test.ts`
- **CA-4** CUANDO el Owner desconecta las vistas, el sistema DEBE borrar la credencial guardada, DEBE conservar los recuentos ya leídos con su origen y antigüedad y DEBE dejar los resultados clave que las usan en «Sin fuente conectada» (SDD 4a CA-26). · cubre G-6, G-10 · prueba: `postin-views-connect.test.ts`
- **CA-14** CUANDO el Owner conecta las vistas y esa misma dirección (normalizada: servidor en minúsculas, sin puerto por defecto ni barra final, sin credencial) ya está conectada en otra organización, el sistema DEBE rechazarlo con un texto que diga qué pasó y qué hacer, DEBE impedirlo también con dos conexiones a la vez DEBE sustituir para este proveedor la confirmación de cuenta compartida de las conexiones propias y, si la conexión no llega a guardarse, DEBE descartar la credencial y la primera lectura. · cubre G-10 · prueba: `postin-views-connect.test.ts`
- **CA-15** El sistema DEBE aceptar solo una dirección HTTPS de longitud máxima acotada, sin usuario, clave, consulta ni fragmento, con certificado válido, y DEBE validar en cada lectura, no solo al conectar, que todas las direcciones a las que resuelve su nombre (IPv4, IPv6 e IPv4 mapeada) son públicas (sin redes privadas, locales ni de metadatos), conectar a la dirección validada o volver a comprobarla al conectar, no seguir redirecciones, tratar como fallida una lectura que supere el tiempo, el número de filas o el tamaño máximos (medido también tras descomprimir) [Sugerencia: 10 segundos, 20 000 filas y 2 MB tras descomprimir por vista, a confirmar con el máximo de histórico de Dani] y mostrar un único texto fijo para cualquier fallo de red. · cubre G-10 · prueba: `postin-views-connect.test.ts`

### H-2: Como Owner o Sales leader, quiero que Nokko lea las vistas de forma fiable y sin datos personales.
- **CA-5** El sistema DEBE leer solo los campos del contrato (§10) y SI llega cualquier otro campo, o falta uno, o su tipo o su formato no coincide (§10), ENTONCES DEBE tratar la lectura como fallida con un texto fijo, sin guardar nada de ella ni registrar la respuesta; y también cuando la respuesta no es un `200` con tipo `application/json` y un cuerpo JSON del contrato. · cubre G-10 · prueba: `postin-views-reader.test.ts`
- **CA-6** El sistema DEBE leer las vistas una vez cada 24 horas por organización conectada y una primera vez al conectar (CA-1), DEBE reintentar cada hora tras un fallo hasta una lectura correcta, salvo si la credencial fue rechazada, caso en que DEBE pausar los reintentos hasta que el Owner la cambie o el Owner o el Sales leader sincronicen a mano, DEBE pausar el trabajo diario y sus reintentos mientras la fase esté desactivada para el Owner, y DEBE permitir al Owner y al Sales leader sincronizarlas a mano (SDD 4a, matriz de permisos), con un intervalo mínimo entre lecturas manuales como las demás fuentes y sin dos lecturas a la vez de la misma organización. · cubre G-6 · prueba: `postin-views-reader.test.ts`
- **CA-7** SI una de las dos vistas falla, ENTONCES el sistema DEBE tratar la lectura entera como fallida, DEBE conservar el último recuento correcto de ambas con su antigüedad, DEBE guardar la fecha de la última lectura correcta aparte de la última lectura intentada (SDD 4a CA-1) y, si pasan más de 48 horas desde la última lectura correcta, DEBE dejar el resultado clave en «Sin dato reciente» (SDD 4a CA-2; PRD §6.1). · cubre G-6 · prueba: `postin-views-reader.test.ts`
- **CA-8** El sistema DEBE sustituir, en cada lectura correcta y en una sola operación para ambas etapas, todos los recuentos guardados de esa organización por los recibidos (una respuesta válida sin filas deja cero), DEBE guardar con ellos el origen (el nombre del servidor y una huella no reversible de la dirección normalizada y de la credencial, nunca la dirección completa ni la credencial) y la fecha de lectura, y SI cambia la dirección o la credencial, ENTONCES DEBE purgar los recuentos del origen anterior. · cubre G-6 · prueba: `postin-views-reader.test.ts`
- **CA-9** El sistema DEBE asignar cada recuento a un canal del catálogo (SDD 1a CA-28) cuando su nombre coincide ignorando mayúsculas y acentos, DEBE tratar todo canal vacío o no reconocido como «Sin atribuir» (SDD 4a CA-23) sin guardar el texto recibido y DEBE sumar las filas que resulten en el mismo día y canal. · cubre G-6 · prueba: `postin-views-reader.test.ts`
- **CA-11** El sistema DEBE mostrar el estado de la conexión con los estados que ya usa Nokko (Error para un `401` o `403` y para un contrato incumplido; Sin respuesta para un fallo de red, un rechazo de validación de la dirección, un tiempo agotado y un `5xx`; SDD 4a CA-1) y la fecha de la última lectura correcta, con textos fijos y sin el mensaje del origen, y DEBE mostrar el mismo estado para un rechazo de validación de la dirección que para un fallo de red, para que no sirva de sonda de la red interna. · cubre G-6 · prueba: `postin-views-reader.test.ts`
- **CA-13** El sistema DEBE separar la conexión, los recuentos y la credencial de cada organización (una organización NO DEBE ver ni usar los de otra, PRD R-10) y DEBE permitir leer la tabla de recuentos solo al Owner y al Sales leader: el Consejo ve únicamente el valor copiado al historial del resultado clave (CA-10), como ocurre con Stripe en SDD 4a CA-22. · cubre G-10 · prueba: `org-isolation.test.ts`

### H-3: Como Owner o Sales leader, quiero un resultado clave de activación alimentado por Postin.
- **CA-10** DONDE las vistas estén conectadas, el sistema DEBE ofrecer como fuente automática de un resultado clave el total de personas de «Activa» o de «Publicó» entre su fecha de inicio y su fecha meta, ambas inclusive, comparando el día de la vista (fecha en UTC) como fecha de calendario, con «Sin atribuir» incluido en el total (criterios de periodo y de «Sin atribuir» de SDD 4a CA-23, con un desvío de hasta un día en el borde frente a la zona de la organización), DEBE copiar el valor al historial del resultado clave en cada lectura correcta con su fuente y su fecha, DEBE abstenerse de sumarle las entradas manuales de etapa por recorrido, que se conservan en su historial (enmienda de SDD 4a CA-10 y CA-31). · cubre G-6 · prueba: `postin-views-source.test.ts`
- **CA-12** MIENTRAS la fase esté activa para el rol de la persona, el sistema DEBE aplicar este SDD; para los demás roles, o mientras la fase no esté activa, o sin conexión, DEBE mantener «Activa» y «Publicó» como entrada manual y las integraciones actuales sin cambios (PRD R-9; SDD 1a CA-6; SDD 4a CA-9 y CA-19). · cubre G-10 · prueba: `postin-views-phase-guard.test.ts`
- **CA-16** El sistema DEBE mantener el embudo, la conversión y el coste por etapa de «Activa» y «Publicó» (SDD 3 CA-22) como recorridos manuales marcados «Manual», DEBE etiquetar el resultado clave de CA-10 como «Postin, personas» y DEBE mostrar cada cifra con su etiqueta, sin ningún total que las combine. · cubre G-6 · prueba: `postin-views-source.test.ts`

## 8. Casos límite y errores
Cada caso remite al CA que lo cubre.
- Dirección o credencial incorrectas al conectar → no se guarda nada y qué hacer (CA-1).
- Dirección sin HTTPS, con usuario incrustado, que resuelve a una red privada o que redirige → se rechaza (CA-15).
- Dirección con consulta, fragmento o certificado inválido → se rechaza (CA-15).
- Dirección que resuelve a una red privada tras conectar (rebinding) → fallida en esa lectura (CA-15).
- La misma dirección ya conectada en otra organización, o dos conexiones a la vez → se rechaza (CA-14).
- Una vista falla y la otra no → lectura entera fallida (CA-7).
- Campo de más (también en el envoltorio), campo que falta, tipo o formato distinto, o un `dia` que no es una fecha real → lectura fallida, sin guardar ni registrar la respuesta (CA-5).
- Conectar → primera lectura inmediata (CA-1, CA-6).
- Credencial rechazada → se pausan los reintentos hasta que el Owner la cambie o el Owner o el Sales leader sincronicen a mano (CA-6).
- Fase desactivada para el Owner → se pausan el trabajo diario y sus reintentos (CA-6).
- Dos nombres de canal que coinciden ignorando mayúsculas → se suman (CA-9).
- Lectura que supera el tiempo, las filas o el tamaño máximos → fallida (CA-15).
- La credencial permite escribir → solo se usan lecturas (CA-2).
- Un rol distinto del Owner intenta conectar → denegado (CA-3).
- Desconectar → credencial borrada, datos conservados, «Sin fuente conectada» (CA-4).
- Una vista trae una columna de más (por ejemplo, correo o identificador) → la lectura falla y no se guarda nada (CA-5).
- Falta una columna del contrato → lectura fallida, no se guarda nada (CA-5).
- Lectura repetida el mismo día, o un recuento pasado que baja, o un día sin personas → cada lectura correcta sustituye todos los recuentos de la etapa (CA-8).
- Vista vacía válida → cero (CA-8).
- Cambio de dirección o credencial → se purgan los recuentos del origen anterior (CA-8).
- Fallo de lectura → reintento cada hora hasta una lectura correcta (CA-6).
- Embudo de SDD 3 y resultado clave de Postin → dos cifras etiquetadas, nunca sumadas (CA-16).
- La vista no responde → último valor con su antigüedad; a las 48 horas, «Sin dato reciente» (CA-7).
- Canal vacío o desconocido → «Sin atribuir» (CA-9).
- Resultado clave con fuente Postin y entradas manuales de etapa → no se suman (CA-10).
- Sin conexión, rol sin fase o fase desactivada → manual como hoy (CA-12).
- Credencial rechazada o sin respuesta → estado visible (CA-11).
- Dos organizaciones con la misma conexión → se rechaza la segunda (CA-14); organizaciones distintas con accesos distintos → datos separados (CA-13).

## 9. Experiencia y copy
Sistema visual actual (Ink + Lima, versalitas con filete, sin iconos), textos en «tú».
- **Mensajes sugeridos** (a validar con la guía de voz de marca): «La credencial debe ser de solo lectura: Nokko solo consulta recuentos.» · «No he podido leer las vistas de Postin. Revisa la dirección y la credencial.» · «Última lectura correcta: hace N horas.»
- **Pantalla:** una tarjeta «Vistas de Postin» en Integraciones, con estado, última lectura y las acciones conectar, sincronizar y desconectar (CA-1, CA-3, CA-6, CA-11).

## 10. Datos, permisos y privacidad
- **Contrato de las vistas (normativo; el lado Postin lo implementa Dani):** Nokko pide cada vista con una petición HTTPS GET a la dirección conectada más la ruta `/activa` o `/publico`, con la credencial en la cabecera `Authorization: Bearer <credencial>` (nunca en la dirección). La respuesta válida es `200` con un cuerpo JSON `{"filas":[{"dia":"AAAA-MM-DD","canal":"…","personas":3}]}`, completo en cada lectura (el recuento actual de todos los días disponibles). Una respuesta válida sin filas es `200` con `"filas":[]`. El tipo de contenido es `application/json`. Una credencial rechazada se señala con `401` o `403` y cualquier otro error con un código distinto; las dos cosas se distinguen en el estado (CA-6, CA-11). Cada fila tiene exactamente tres campos: `dia` (fecha en UTC, formato `AAAA-MM-DD`, en que la persona alcanzó la etapa por primera vez), `canal` (texto: un canal del catálogo de SDD 1a CA-28 —por ejemplo LinkedIn orgánico, Outbound, Contenido y SEO, Partners y eventos— o la cadena vacía) y `personas` (entero mayor que cero con el número de personas distintas; los días sin personas no tienen fila). Ningún otro campo: ni identificador, ni correo, ni nombre, ni texto. Un tipo o un formato distinto, un campo de más (también en el envoltorio) o uno que falta, o un `dia` que no es una fecha real del calendario, hacen la lectura fallida (CA-5). Definiciones de etapa: SDD 3 CA-14.
- **Conceptos nuevos:** conexión a las vistas de Postin con su credencial cifrada, recuento por organización, día, etapa y canal con fecha de lectura. Cada tabla nueva lleva organización por defecto la actual, acceso filtrado por organización y permisos explícitos [Sugerencia — el gate valida].
- **Matriz de permisos:**

| Acción | Owner | Sales leader | Consejo | Otros roles |
|---|---|---|---|---|
| Conectar, cambiar y desconectar | Sí | No | No | No |
| Sincronizar a mano | Sí | Sí | No | No |
| Ver el estado de la conexión | Sí | Sí | No | Solo estado |
| Ver los recuentos leídos | Sí | Sí | No | No |
| Ver un resultado clave alimentado por las vistas | Sí | Sí | Sí | Sí (los roles que ven el resultado clave) |

- **Privacidad:** la credencial nunca vuelve al navegador ni a los registros y la dirección se guarda sin credenciales; los recuentos son agregados sin clave de persona; un recuento de una o dos personas por día y canal puede permitir reidentificar a alguien cruzándolo con otras fechas, y Fede lo acepta por ser datos de su propia empresa (decisión de 2026-11-02); ningún dato de clientes en pruebas ni ejemplos.

## 11. Llamadas a IA
Ninguna: es lectura y almacenamiento deterministas.

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero [Sugerencia] | Depende de |
|---|---|---|---|---|
| U-1 | Conectar, comprobar, guardar cifrada y desconectar la conexión; dirección segura, una sola organización por acceso, permisos, auditoría y guardia de fase | CA-1 a CA-4, CA-12, CA-14, CA-15 | `postin-views-connect.test.ts`, `postin-views-phase-guard.test.ts` | SDD 4a U-1 y U-2, SDD 1a U-1 y U-7 |
| U-2 | Lector del contrato: cadencia, manual, fallos, recuentos por día, etapa y canal, estado y aislamiento | CA-5 a CA-9, CA-11, CA-13 | `postin-views-reader.test.ts`, `org-isolation.test.ts` | U-1, SDD 1a U-4, SDD 4a U-2 |
| U-3 | Fuente automática de «Activa» y «Publicó» para un resultado clave y convivencia con el embudo manual | CA-10, CA-16 | `postin-views-source.test.ts` | U-2, SDD 4a U-2 y U-3, SDD 1a U-3, SDD 3 U-1, U-4 y U-5 |

En U-1, CA-1, CA-2, CA-4 y CA-15 se prueban con un lector de prueba y un almacén de recuentos de prueba (dobles); el lector real, el analizador del contrato y el almacén real llegan en U-2, que repite CA-1, CA-2 y CA-15 con el lector real (prueba de integración) y cierra con el almacén real que desconectar no borra los recuentos (CA-4). U-1 añade un caso de aislamiento (CA-13) para la tabla de la credencial; U-2 y U-3 añaden cada una un caso de guardia de fase (CA-12) y uno de aislamiento (CA-13) para lo que crean.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- **Credencial:** reutilizar el cifrador `src/lib/secret-box.server.ts` y dar implementación a `storeCredential` y `discardCredential` de `src/lib/connections-core.ts`, que solo guardan un texto: la dirección va en una columna aparte, de longitud máxima acotada, sin credenciales y sin permisos para `authenticated` (los miembros no la leen); la tabla de la credencial no tiene ningún permiso para `authenticated`; la auditoría y la tabla de recuentos guardan solo el nombre del servidor y una huella de la dirección. La huella no reversible de CA-8 puede ser un HMAC con una clave derivada de `INTEGRATION_KEYS_SECRET` con una etiqueta distinta de la del cifrado [Sugerencia]. `org_connections` (migración 0059, sin aplicar) no tiene columna de credencial, así que hace falta una tabla aparte.
- **Lectura:** solo HTTPS (decisión de Fede); el lector se escribe contra un puerto para probarlo con un doble. Validar la dirección resolviendo el nombre en cada lectura y bloqueando redes privadas, locales y de metadatos; el precedente de `src/lib/product-usage.ts` (`posthogHost`) y `src/lib/web-research.ts` (`publicUrl`) no resuelve nombres ni bloquea redirecciones, así que no basta. **Limitación del runtime:** el destino por defecto del proyecto es Cloudflare (`vite.config.ts`), donde `fetch` no permite fijar la IP: cerrar el rebinding por completo puede exigir DNS sobre HTTPS o un proxy de salida; el runtime de producción está sin verificar [Por verificar]. `ConnectInput` y `Checker` de `src/lib/connections-core.ts` solo admiten un texto `credential`, así que la dirección viaja aparte.
- **Cadencia:** un trabajo diario por organización conectada con el mecanismo de trabajos que ya usa Nokko, con reintento horario tras un fallo y bloqueo contra lecturas simultáneas (`job_locks`); no reutilizar `last_synced_at`, que se escribe antes de leer y también al fallar (`src/lib/inngest/tasks.server.ts`): hace falta una «última lectura correcta» propia.
- **Almacén de recuentos:** clave `(organización, día, etapa, canal)` con el origen de la lectura; cada lectura correcta sustituye todo el conjunto de la organización y la etapa en una sola operación; solo legible por Owner y Sales leader (el Consejo no está en `org_members`). No cuelga de `org_connections` con borrado en cascada, porque desconectar borra esa fila y CA-4 exige conservar los recuentos. Las dos etapas se leen y se guardan juntas: una lectura es correcta solo si ambas lo son (CA-7).
- **Fuente del resultado clave:** se registra como una fuente automática más de SDD 4a (U-2 y U-3), con el mismo periodo y «Sin atribuir» que 4a CA-23, solo como total (sin filtro de canal en esta v1). «Credencial rechazada» se guarda como Error; los textos de error son fijos (como `posthogErrorText` en `src/lib/posthog-sync.server.ts`).
- **Acceso único:** la comparación de «mismo acceso» (CA-14) usa la dirección normalizada y una restricción única a nivel de datos; hoy `accountKey` compara `lower(account_label)` y el flujo es de confirmación (`needsSharedConfirmation`), no de rechazo.
- **Puertos:** `storeCredential`, `Store.save` y `ConnectInput` de `src/lib/connections-core.ts` no llevan dirección y hay que ampliarlos; `account_key` pasa a ser la dirección normalizada (hoy `accountKey = lower(label)`) y la etiqueta visible solo el servidor; el proveedor se registra en `PROVIDERS` de `src/lib/connections.ts` con `kind: "key"`, `ownAccount: true` y un `Checker`.
- **Trabajo diario:** usa el cliente de administración, así que inserta `org_id` explícito (`src/lib/AGENTS.md`, «Background work»).
- **Restricción única de CA-14:** debe ser parcial por proveedor y estar en la tabla que se escribe primero, o el flujo debe descartar la credencial si la fila falla (`connectAccount` guarda la credencial antes que la fila); `account_key` de 0059 admite como máximo 120 caracteres, así que la dirección se normaliza y se acota antes de calcularla.
- **Respuesta cruda:** el analizador del contrato no devuelve ni lanza el cuerpo recibido, para que los resultados y los errores que persiste el mecanismo de trabajos no lo conserven [Sugerencia].
- Migraciones aditivas con organización por defecto.

## 14. Riesgos y dependencias
- **Depende de Dani:** las vistas y su credencial de solo lectura deben existir antes de usar esto en producción; hasta entonces las pruebas usan un doble (CA-1 a CA-16).
- **Atribución por canal, no por recorrido:** el agregado no dice qué lead llegó a «Activa» o «Publicó», así que los embudos por recorrido (SDD 3) siguen manuales para esas etapas y la suma por canal puede diferir de la suma por recorrido. Es decisión de Fede (privacidad frente a precisión).
- **Enmienda de 4a:** sustituye CA-10 y CA-31, que suponían una fuente por recorrido; hay que registrarlo en el PRD y en 4a.
- **Canales:** si Postin etiqueta el origen con nombres distintos del catálogo, casi todo queda «Sin atribuir» (CA-9); el contrato exige un canal del catálogo o la cadena vacía.
- **Lecturas de un día en curso:** el recuento del día actual puede crecer en lecturas posteriores; CA-8 lo sustituye, no lo suma.
- **Almacén de credenciales:** reutiliza una clave de cifrado única del servidor; no hay rotación de clave [Por verificar].
- **Criterios con varias condiciones:** CA-1, CA-2, CA-3, CA-4, CA-5, CA-6, CA-7, CA-8, CA-9, CA-10, CA-11, CA-12, CA-13, CA-14, CA-15 y CA-16 describen una regla con sus condiciones; el brief puede dividir sus pruebas.
- **Rebinding de DNS:** CA-15 lo cierra en lo que el runtime permite; el cierre completo depende del runtime de producción (§13).
- **Riesgos aceptados al aprobar (2026-11-02):** el runtime de producción está sin verificar y en Cloudflare no se puede fijar la IP validada, así que el cierre completo del rebinding de DNS puede no ser alcanzable (CA-15); la migración 0059 sigue sin aplicar; los valores máximos de CA-15 son una sugerencia a confirmar con el máximo de histórico de Dani; dos canales del catálogo que solo difieran en acentos o mayúsculas se asignan de forma ambigua (1a CA-28 solo rechaza duplicados exactos); el desglose por canal de CA-9 no tiene consumidor en esta v1; el mensaje de CA-14 revela que el acceso ya está conectado en otra organización.
- **Nokko no puede comprobar que la credencial sea de solo lectura:** CA-2 lo garantiza limitando el lector a lecturas, como 4a hace con Stripe; que la credencial no permita escribir lo asegura Dani.
- **Doble cifra:** el embudo manual por recorrido y el total de Postin pueden diferir; CA-16 las etiqueta y no las suma.
- **Desvío de un día:** comparar el día en UTC con fechas de calendario deja hasta un día de desfase en el borde frente a la zona de la organización (CA-10).
- **Recuentos pequeños:** un día y canal con una o dos personas puede reidentificar a alguien; aceptado por Fede (§10).
- **Migración de Lovable:** debe conservar `INTEGRATION_KEYS_SECRET` (sin ella la credencial guardada no se puede abrir) y copiar las tablas nuevas.

## 15. Preguntas para Fede y para la revisión técnica
- Resuelto por Fede (2026-10-31): lo indicado en el §3.
- Revisión técnica: ¿dónde se guarda la credencial cifrada y cómo se rota la clave de cifrado (§13)?
- Revisión técnica: ¿qué valores máximos de tiempo, filas y tamaño fija CA-15, y qué máximo espera Dani del histórico para que Nokko no fije un tope menor?
- Resuelto por Fede (2026-11-02): las seis decisiones de la primera pasada del gate y las cuatro de la segunda (§3).
- Resuelto por Fede (2026-11-02): el trabajo diario se pausa con la fase apagada para el Owner y la sincronización manual del Owner o del Sales leader reanuda los reintentos (CA-6).
- Revisión técnica: ¿se confirman con el máximo de histórico de Dani los valores de CA-15 (10 segundos, 20 000 filas, 2 MB)?

## 16. Pendiente de verificar
- Cuántas organizaciones conectarán estas vistas → Fede (con CA-14, una por acceso).
- Si Postin puede etiquetar el origen con los cuatro canales del catálogo → Dani.
- Rotación de la clave de cifrado y migración 0059 sin aplicar → gate.
- Runtime de producción y capacidad de fijar la dirección validada al conectar → gate.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
### Primera pasada (sobre v1) — informe verbatim

**Veredicto:** Bloqueado. CA-10 depende de un filtro de canal que no existe en 1a/4a, reintroduce dos cifras distintas para «Activa» y «Publicó» (justo lo que la 4ª pasada de 4a trató como bloqueante), y deja sin decidir el día, la sustitución de recuentos y la dirección que pega el Owner. Ninguno obliga a rediseñar.

Solo he leído; no he ejecutado nada.

#### Bloqueantes

1. **CA-10 (L63) y §13 (L116): «por canal si el resultado clave lo filtra».** Ningún SDD define ese filtro. 1a CA-17 crea el resultado clave con nombre, unidad, valor inicial, meta, fechas y fuente, sin canal. 4a CA-23 ofrece solo el total y deja el desglose por canal a SDD 3. Sin filtro, esa parte de CA-10 no se puede probar.
   - CA-10 tampoco dice si el total sin filtro incluye «Sin atribuir». 4a CA-23 sí lo incluye, y SDD 3 CA-6 lo excluye del desglose. Hoy esa regla está solo en §13, que es una sugerencia.
   - Solución: o enmiendas 1a CA-17 con un campo opcional «canal» y lo declaras en la cabecera, o CA-10 ofrece solo el total. Y fija en el CA si «Sin atribuir» entra en el total.

2. **CA-10, §5 (L34) y §14 (L121) frente a SDD 3 CA-22 y 4a CA-23.** La enmienda hace que «Activa» tenga dos cifras: personas por canal (vistas) y recorridos manuales (embudo de SDD 3 CA-22). La 4ª pasada de 4a puso como bloqueante precisamente el riesgo de «cifras distintas para la misma etapa», y se cerró con «las mismas cifras que el KPI por canal» (§17 de 4a, L218 y L231). Ningún CA dice qué muestran ahora el embudo, la conversión y el coste por etapa de SDD 3 CA-22, ni cómo se etiqueta cada cifra.
   - La unidad también cambia: SDD 3 cuenta recorridos y CA-10 cuenta «personas» de Postin.
   - Solución: añade un CA que diga que el embudo y el coste por etapa de «Activa» y «Publicó» siguen siendo recorridos manuales marcados «Manual». Que el resultado clave se etiqueta «Postin, personas por canal». Y que ambas cifras nunca se suman ni se comparan como iguales.

3. **CA-10 y §10 (L88): periodo y «día».** La vista da `dia` en UTC. 4a CA-23 mide el periodo «ambas inclusive y en la zona horaria de la organización» (SDD 2 CA-22, Europe/Madrid por defecto). Con recuentos diarios no se puede reasignar a la zona de la organización. CA-10 no dice «inclusive» ni cuál es el criterio, y §15 (L131) lo deja como pregunta.
   - Solución: decide ahora, en el CA, comparar `dia` (fecha UTC) con las fechas del resultado clave como fechas de calendario, inclusive. Declara el desfase de un día en el borde como desvío de 4a CA-23. Es decisión tuya (pregunta 2).

4. **CA-8 (L57) con el contrato (Dani, CA-9 y CA-8).** «Sustituir el recuento de ese día, etapa y canal» solo actúa sobre las filas que llegan. Dani omite los días sin personas y puede reducir un recuento pasado por bajas o por reatribución de canal. Esas filas ya no llegan y el recuento viejo se queda: el total sale inflado y ninguna prueba lo detecta.
   - Tampoco hay regla para la vista vacía (¿0 o «Sin dato»?; 4a CA-28 sí lo resolvió para Stripe), ni para la primera lectura, ni para el rango histórico inicial (pregunta 3 de Dani sin respuesta), ni para cambiar de dirección o credencial (CA-3 permite «cambiar»), que mezclaría recuentos de dos orígenes.
   - Solución: «cada lectura correcta sustituye, en una sola operación, todos los recuentos de esa organización y etapa». Vista vacía válida = 0. Un cambio de dirección purga los recuentos antiguos o los marca con su origen.

5. **CA-1, CA-2, §13 (L113) y §14: la dirección es arbitraria y el transporte no está fijado.** El Owner pega una dirección y Nokko la consulta desde el servidor. Ningún CA restringe adónde.
   - Con una consulta directa a base de datos, es un escaneo de puertos desde el servidor. Con HTTPS, es SSRF. El código tiene un precedente débil: `posthogHost` en `src/lib/product-usage.ts` L14 (solo https y una regex sobre el nombre de host) y `publicUrl` en `web-research.ts` L4. Ninguno resuelve DNS ni bloquea redirecciones.
   - Hay otros huecos: no hay límite de filas ni de tamaño de respuesta, ni tiempo máximo, y nada rechaza una dirección con usuario y clave incrustados (típica en cadenas de conexión). Esa dirección acabaría en `account_label`, que es visible a los miembros y entra en la auditoría.
   - Además, el flujo actual solo admite una cadena `credential` (`ConnectInput` y `Checker` en `connections-core.ts` L8 y L30), así que la dirección no tiene dónde viajar.
   - Solución: un CA que exija HTTPS, host público tras resolver DNS (sin IP privada, de enlace local ni de metadatos), sin redirecciones, sin usuario en la dirección, con tiempo y filas máximos. Decide el transporte con Dani antes de aprobar. Mi opinión: solo HTTPS.

6. **La enmienda deja 4a inconsistente.** La cabecera (L5) solo declara CA-10, CA-31 y U-5. En 4a quedan sin tocar:
   - CA-9 (L78): «manual hasta que exista la fuente de CA-10, su única fuente automática». Tras la enmienda esa fuente no existe por recorrido, y la frase queda sin objeto.
   - CA-3 (L64): «cadencia no menos frecuente que la actual (6 h)». CA-6 de este SDD lee cada 24 h. Léelo literal y `sync-schedule.test.ts` falla.
   - §12 fila U-5 y «Orden» (L148 y L153), §13 (L159 y L161), §14 (L171 y L184) y §15 (L190).
   - 5d L244 cita «SDD 4a CA-10».
   - PRD L123 («hasta que Dani entregue las vistas») contradice el L148 que registra la enmienda. Dice que todo vuelve a manual hasta Dani, cuando por recorrido no cambia nunca.
   - 4a L11 ya avisa de la enmienda como «propuesta».
   - Solución: un cuadro en §6 con cada edición de 4a, de 5d y del PRD y qué dice después. Declara también que `postin-views.test.ts` se retira, y exime CA-3 de 4a para esta fuente.

#### Cambios menores

1. **Cita equivocada.** CA-6 (L55) cita «SDD 4a CA-3» para la sincronización manual. 4a CA-3 trata la cadencia; los roles de sincronización manual están en la matriz de 4a §10 (L129).
2. **Cabecera (L5).** Dice «SDD 3 (diccionario y recorridos: U-1)». Los recorridos y las fechas de etapa (CA-13, CA-15) están en 3 U-4; en U-1 solo está el diccionario (CA-18). Falta 4a U-2, donde viven el ciclo de vida de un valor automático y «Sin fuente conectada» (CA-25, CA-26, CA-29, CA-30). 4a U-4 (eventos de producto) sobra: CA-10 ya no usa recorridos.
3. **R-9 y unidades.** `postin-views-phase-guard.test.ts` está solo en U-3. La tarjeta de conexión (U-1) y el lector (U-2) se entregarían sin guardia de fase, y 4a (L153) construye la guardia en la primera unidad. Mueve la guardia a U-1 y añade un caso en cada unidad.
4. **Sincronización a mano.** CA-6 no fija intervalo mínimo ni bloqueo ante dos lecturas a la vez (existe `MANUAL_SYNC_MINUTES = 2` y `job_locks`). No hay regla de reintento tras fallo, y con una cadencia diaria eso decide cuánto tarda en volver «Sin dato reciente».
   - No reutilices `last_synced_at` (se escribe antes de leer y también al fallar, `src/lib/inngest/tasks.server.ts` L22-L35). Hace falta una «última lectura correcta» propia (4a CA-1).
5. **CA-9 frente a §10 y 1a CA-28.** El contrato dice «uno de los cuatro o vacío». 1a CA-28 permite añadir canales, así que «canal del catálogo» no equivale a «los cuatro».
   - CA-9 debe decir si la coincidencia ignora mayúsculas y acentos.
   - Debe decir también que el texto no reconocido no se guarda, solo se cuenta como «Sin atribuir» (`canal` es texto libre de una base ajena).
6. **CA-11.** «Credencial rechazada» no es un estado existente. `STATE_LABEL` y `org_connections.status` solo tienen Error y Sin respuesta; mapea «rechazada» a Error. CA-11 dice «con los estados que ya usa Nokko» pero introduce un nombre nuevo.
7. **Errores del servidor remoto.** `last_error` es legible por los miembros. Los mensajes del origen deben pasar por textos fijos, como `posthogErrorText` en `posthog-sync.server.ts` L18. CA-1 y CA-11 no lo exigen.
8. **CA-2.** Nokko no puede comprobar que la credencial sea de solo lectura, y el SDD no lo declara como riesgo. 4a §14 (L172) sí lo hace para Stripe, y su CA-7 se garantiza limitando el cliente a lecturas. Replica esa redacción en §14 y haz CA-2 verificable como «el puerto solo expone lectura de las dos vistas del contrato». Tampoco tiene la forma EARS con «CUANDO».
9. **§14 (L126).** Faltan CA-3, CA-4, CA-6, CA-8, CA-9, CA-11 y CA-12 en la lista de criterios con varias obligaciones.
10. **Recuentos pequeños.** Un 1 por día y canal, cruzado con las fechas de las pruebas de Nokko, puede reidentificar a una persona. Aquí el dato es del propio Owner, pero §10 dice «sin dato de persona» y debería declararlo como riesgo aceptado (pregunta 5).
11. **Acceso a la tabla de recuentos.** La matriz (L97) da al Consejo «Sí» sobre el valor del resultado clave. El Consejo no está en `org_members` (1a), así que la tabla de recuentos debe ser legible solo por Owner y Sales leader. El Consejo ve el valor copiado al historial del resultado clave (como 4a CA-22). Dilo en §10.
12. **Credencial.** `storeCredential` guarda un solo texto. Por tanto la dirección va en columna aparte, sin cifrar pero sin credenciales.
    - La tabla de la credencial no debe tener ningún GRANT para `authenticated`.
    - La auditoría solo guarda `account_label`, que no debe ser la dirección completa.
13. **Lovable y migración.** La cabecera nombra los SDD de salida de Lovable A y B. Falta decir que `INTEGRATION_KEYS_SECRET` se conserva en la migración (`lovable-exit-migration` CA-27, L93) y que las tablas nuevas deben entrar en el alcance de la copia de datos.
14. **Segundo SDD para Dani.** `SDD-20261031-nokko-activation-data-feed` define otro contrato: una fila por organización con cuatro fechas y un aviso de alta con identificador opaco. Es incompatible con la decisión del PRD L148 (recuentos por día y canal, sin clave de persona) y con §10. Archiva uno antes de enviar nada a Dani. Solo he comprobado que §10 es coherente con `aggregate-views`.
15. **Contrato frente a Dani.** `nokko-aggregate-views` no nombra las columnas ni las vistas (`dia`, `canal`, `personas`) que §10 fija como normativas. Dani CA-9 se contradice: pide filas «mayor o igual que cero» y a la vez omitir los días sin personas.

#### Preguntas para Fede

1. ¿El mismo acceso a Postin puede conectarse en dos organizaciones de Nokko? Hoy el flujo lo permite con confirmación (`SHARED_ACCOUNT_NOTE`, `connections.ts` L113). Recomiendo bloquearlo para esta conexión: sí o no.
2. ¿Aceptas comparar `dia` (UTC) con las fechas del resultado clave como fechas de calendario, con hasta un día de desfase en el borde frente a Europe/Madrid? Recomiendo sí.
3. ¿Solo HTTPS (sin conexión directa a la base)? Recomiendo sí.
4. Canal en el resultado clave: A) solo total en esta v1, o B) añadir filtro de canal (enmienda a 1a CA-17). Recomiendo A.
5. ¿Aceptas recuentos de 1 o 2 personas sin umbral, por ser datos de tu propia empresa? Recomiendo sí, declarado en §14.
6. ¿Archivo `nokko-activation-data-feed` antes de enviar a Dani? Recomiendo sí.

#### Hechos de código verificados / no verificados

**Verificados:**
- **`secret-box`:** `src/lib/secret-box.server.ts` es AES-GCM con clave `SHA-256(INTEGRATION_KEYS_SECRET)` y formato `v1:iv:ct`, sin identificador de clave. No hay rotación: el SDD confirma el [Por verificar] de L125. Solo lo importa `posthog-sync.server.ts`.
- **Puertos de credencial:** `storeCredential` y `discardCredential` son opcionales en `Deps` (`connections-core.ts` L24-L25) y no tienen implementación. `connections.functions.ts` L26 devuelve `checkers: {}` sin almacén. `connectAccount` falla con «falta el almacén cifrado» (L65).
- **`org_connections`:** no tiene columna de credencial, y su comentario (0059) lo dice a propósito. Tiene `account_key`, `checked_at` y `last_error`, y la auditoría `org_connection_events`.
- **Registro de proveedores:** `PROVIDERS` no incluye ninguno de Postin. Un proveedor propio exige `kind: "key"`, `ownAccount: true` y un `Checker`.
- **Cron:** el cron horario despacha un mantenimiento por organización (`AGENTS.md` L33), y `maintainStripe`/`maintainPosthog` filtran por `last_synced_at` (`tasks.server.ts` L22-L35).
- **Citas:** son correctas las citas a 4a CA-1, CA-2, CA-9, CA-18, CA-19, CA-23, CA-26 y a la matriz §10. También 1a CA-6, CA-28 y CA-68, SDD 3 CA-13, CA-14, CA-15 y CA-18, PRD R-9, R-10 y L148, y SDD 2 CA-22. Las dos citas erróneas están en menores 1 y 2.
- **Estructura:** hay 18 secciones y 13 CA únicos (CA-10 y CA-12 van en H-3 pero el orden de numeración no es lineal). Cada CA está en exactamente una unidad, y los tests de §7 y §12 coinciden. §17 y §18 están vacíos como corresponde, y no hay datos de clientes.

**No verificados:**
- Que 0059 esté o no aplicada. Está en `_journal.json` y `types.ts` ya incluye `org_connections`, mientras `AGENTS.md` dice «sin aplicar» y `lovable-exit-migration` L244 señala la contradicción.
- El runtime en producción (Cloudflare Worker o Vercel), que condiciona la conexión directa a base de datos.
- Que las vistas de Dani existan y qué hacen.
- Qué políticas de acceso hay en producción.

#### Límites de la revisión

- No ejecuté pruebas ni código, y no comprobé producción ni políticas de acceso reales.
- No leí 4b, 5a, 5b ni 5c, ni las pasadas 4 a 7 de §17 de 4a salvo los fragmentos que cito. `activation-data-feed` solo lo leí para comparar contratos.
- Las recomendaciones sobre transporte, bloqueo de doble conexión y recuentos pequeños son opinión mía, no hechos.

### Respuesta del autor (primera pasada)
**Respuesta del autor (v2, 2026-11-02).** Fede aceptó las seis recomendaciones del gate (§3). Cambios por punto:

- **Bloqueante 1 (filtro de canal):** CA-10 ofrece solo el total, con «Sin atribuir» incluido (4a CA-23); sin filtro de canal en esta v1.
- **Bloqueante 2 (dos cifras):** CA-16 nuevo: el embudo y el coste por etapa siguen como recorridos «Manual», el resultado clave se etiqueta «Postin, personas» y nunca se suman ni se comparan.
- **Bloqueante 3 (el día):** CA-10 compara el día en UTC como fecha de calendario, ambas fechas inclusive, y declara el desvío de un día en el borde de 4a CA-23.
- **Bloqueante 4 (sustitución):** CA-8 sustituye en una sola operación todos los recuentos de la organización y la etapa, vista vacía válida igual a cero y purga al cambiar de dirección; el §10 fija que los días sin personas no tienen fila.
- **Bloqueante 5 (dirección):** CA-15 nuevo (HTTPS, servidor público al resolver, sin usuario incrustado ni redirecciones, límites de tiempo, filas y tamaño); CA-1 guarda la dirección aparte sin credenciales y con errores de texto fijo; CA-14 nuevo impide la misma conexión en dos organizaciones.
- **Bloqueante 6 (enmienda de 4a):** el §6 tiene un cuadro con cada edición de 4a (CA-9, CA-3, CA-10, CA-31, U-5, §12 a §15), de 5d §14 y del PRD §6.1; esas ediciones se aplican al aprobar este SDD.
- **Menores 1 a 15:**
  - CA-6 cita la matriz de 4a y añade reintento horario, intervalo mínimo y bloqueo de lecturas simultáneas.
  - La cabecera corrige las unidades (SDD 3 U-1 y U-4; 4a U-2 y U-3).
  - La guardia de fase pasa a U-1.
  - CA-7 guarda una última lectura correcta propia.
  - CA-9 ignora mayúsculas y acentos y no guarda el texto desconocido.
  - CA-11 mapea «credencial rechazada» a Error.
  - CA-2 se reescribe como verificable (el lector solo expone lectura) y el §14 declara que Nokko no puede comprobar que la credencial sea de solo lectura.
  - CA-13 limita la tabla de recuentos a Owner y Sales leader.
  - El §13 y el §14 cubren la credencial sin permisos para `authenticated`, la clave de cifrado en la migración de Lovable, los recuentos pequeños y la lista ampliada de criterios con varias condiciones.
  - El SDD duplicado para Dani se archivó como `SUPERADO-SDD-20261031-nokko-activation-data-feed.md`.
  - El SDD `nokko-aggregate-views` nombra ya los campos y las vistas, resuelve la contradicción de CA-9 y añade que el recuento se sirve completo por HTTPS (CA-10 y CA-11).
- **Sin cambio:** la rotación de la clave de cifrado sigue como pendiente de verificar (§16); `0059` sigue sin aplicar.
- **Comprobación mecánica:** 16 CA únicos, cada uno en una sola unidad, pruebas del §7 y del §12 coinciden y las remisiones del §8 existen.

### Segunda pasada (sobre v2) — informe verbatim

**Veredicto:** Bloqueado, pero por poco. Los 6 bloqueantes y los 15 menores de la primera pasada están resueltos en el texto actual, la mayoría del todo y algunos a medias. La v2 introduce 4 bloqueantes nuevos, todos de una línea y ninguno exige rediseño: el formato del contrato, la identidad del «mismo acceso» en CA-14, una edición que falta en SDD 3 CA-15, y la validación de la dirección en CA-15.

Solo he leído; no he ejecutado nada.

#### Estado de la primera pasada

**Bloqueantes**

| # | Estado | Evidencia |
|---|---|---|
| 1 Canal | Resuelto | CA-10 (L83): solo total, «Sin atribuir» incluido, sin filtro. §3 L26 lo recoge. |
| 2 Dos cifras | Resuelto a medias | CA-16 (L85) existe y etiqueta «Postin, personas». Choca con SDD 3 CA-15 (ver bloqueante nuevo 3). «Comparar como iguales» es difícil de probar. |
| 3 Día y periodo | Resuelto | CA-10: «ambas inclusive», día UTC como fecha de calendario, desvío declarado. |
| 4 Sustitución de recuentos | Resuelto, con matices | CA-8 (L77): sustitución total en una operación, vista vacía igual a cero, purga al cambiar. Faltan la definición de «vista vacía válida» (ver bloqueante 1) y qué ve el resultado clave tras una purga y antes de la primera lectura (ver menores). |
| 5 Dirección / SSRF | Resuelto a medias | CA-15 (L71) cubre HTTPS, servidor público, sin usuario, sin redirecciones, y tiempo, filas y tamaño. Falta rebinding y revalidar en cada lectura (ver bloqueante 4). §13 L140 no dice que `ConnectInput` y `Checker` solo admiten un texto `credential` (`connections-core.ts` L8 y L30); la dirección no tiene dónde viajar. |
| 6 Enmienda de 4a | Resuelto a medias | El cuadro (L51-60) coincide con 4a CA-3, CA-9, CA-10, CA-31, U-5 y §12 a §15. Falta SDD 3 CA-15 y algunas ediciones de 4a (ver bloqueante 3 y menores). |

**Menores**

| # | Estado | Evidencia |
|---|---|---|
| 1 Cita de CA-6 | Resuelto | CA-6 cita la matriz de 4a. |
| 2 Cabecera y unidades | Resuelto | L5 y §12 L137. Ahora falta SDD 3 U-5 por CA-16 (ver menores). |
| 3 Guardia de fase | Resuelto a medias | Está en U-1 (L135). No hay caso de guardia ni de aislamiento en U-2 y U-3, y CA-13 solo está en U-2 aunque U-1 crea la tabla de la credencial. |
| 4 Cadencia y manual | Resuelto | CA-6 y CA-7 tienen reintento horario, bloqueo de lecturas simultáneas y fecha propia. El mínimo manual es «como las demás» y no da número (L75). |
| 5 CA-9 | Resuelto con residuo | Ignora mayúsculas y acentos y no guarda el texto. §10 L115 dice «canal del catálogo» y §14 L151 «los cuatro nombres». |
| 6 CA-11 | Resuelto | «Error, que incluye una credencial rechazada» (L79). |
| 7 Textos fijos | Resuelto | CA-1 y CA-11. |
| 8 CA-2 | Resuelto | Forma EARS, verificable, y §14 L155 declara el riesgo. |
| 9 Lista de §14 | Resuelto a medias | Faltan CA-2 (2 obligaciones) y CA-16 (3 obligaciones) en L154. |
| 10 Recuentos pequeños | Resuelto | §3, §10 L127 y §14. |
| 11 Tabla de recuentos | Resuelto | CA-13, matriz §10 y §13 L143. |
| 12 Credencial | Resuelto | §13 L140: dirección aparte, sin GRANT para `authenticated`, auditoría con el servidor. |
| 13 Lovable | Resuelto | L5 y §14 L159. `INTEGRATION_KEYS_SECRET` consta en `lovable-exit-migration` L93 y L136. |
| 14 SDD duplicado | Resuelto | Existe `docs/archivado/SUPERADO-SDD-20261031-nokko-activation-data-feed.md`. No quedan referencias vivas, solo el §17. |
| 15 Contrato frente a Dani | Resuelto a medias | Dani ya nombra `dia`, `canal`, `personas` y las vistas (CA-3, CA-11), y ya omite los días sin personas (CA-9). Ninguno de los dos SDD fija el formato de transporte (ver bloqueante 1). |

#### Bloqueantes nuevos

1. **Formato del contrato sin definir (§10 L115; Dani CA-3 y CA-10).** Ningún SDD dice:
   - cómo se pide cada vista (ruta o parámetro);
   - cómo viaja la credencial (cabecera o URL, que acabaría en registros);
   - el cuerpo (JSON, lista de objetos);
   - el formato de `dia` (`AAAA-MM-DD`);
   - qué es una «vista vacía válida» frente a un 200 roto (CA-8);
   - qué significa «tipo no coincide» (CA-5).

   Sin esto, CA-1, CA-5 y CA-8 no se pueden probar y Dani no puede implementar. **Cómo resolverlo:** fija en §10 y en CA-10 y CA-11 de Dani un ejemplo normativo de respuesta, con la credencial en cabecera, y define el vacío como el envoltorio válido con cero filas.

2. **CA-14 (L70): «mismo acceso» no está definido.** En el código la comparación entre organizaciones es `account_key = lower(account_label)` (`connections.ts`, `accountKey`). Si la etiqueta es el nombre del servidor, bloquearías dos credenciales distintas contra el mismo servidor. Si fuera la credencial, habría que guardar una huella. Además:
   - el flujo actual es de confirmación (`needsSharedConfirmation`, `SHARED_ACCOUNT_NOTE`), no de rechazo, y no se declara el desvío;
   - dos conexiones simultáneas pasarían la comprobación, así que hace falta una restricción única a nivel de base de datos.

   **Cómo resolverlo:** define «acceso» como la dirección normalizada, sin credencial; exige una restricción única; di que sustituye a la confirmación de BYO para este proveedor.

3. **El cuadro del §6 (L51-60) deja una contradicción con SDD 3.** SDD 3 CA-15 (L73) dice «MIENTRAS no exista una fuente automática para […] Activa, Publicó […] DEBE permitir registrarlas a mano». Con esta fuente conectada, esa condición deja de cumplirse. Eso contradice §5 L41, CA-12 y CA-16, que dicen que lo manual por recorrido «sigue igual». SDD 3 L36 y L190 hablan de «hasta el SDD 8» y quedan sin tocar. **Cómo resolverlo:** añade al cuadro la edición de SDD 3 CA-15 para que la condición sea «sin fuente automática por recorrido», y actualiza L36 y L190.

4. **CA-15 (L71) y §13 L141: la validación no cubre rebinding ni cada lectura.** «Público al resolver su nombre» no dice:
   - que se revalida en cada lectura diaria, no solo al conectar;
   - que se comprueban todas las direcciones resueltas, IPv4 e IPv6, incluida la IPv4 mapeada;
   - que la conexión usa la dirección validada o la vuelve a comprobar al conectar (si no, el rebinding entre la comprobación y el `fetch` sigue abierto);
   - que el certificado debe ser válido;
   - que el tamaño máximo se mide también tras descomprimir.

   El runtime por defecto es nitro con destino Cloudflare (`vite.config.ts` L4) y no he comprobado el de producción. Allí `fetch` no permite fijar la IP, así que el cierre completo puede exigir DoH o un proxy de salida. Los textos fijos distintos para «red privada» y «sin respuesta» sirven de sonda de la red interna: usa un único texto para toda falla de red. **Cómo resolverlo:** añade estas cuatro frases a CA-15 y declara en §13 la limitación del runtime.

#### Cambios menores nuevos

- **CA-1/CA-15 (L66, L71):** una dirección con token en la consulta (`?token=`) cumple CA-15 y se guardaría en claro en la columna de dirección. Rechaza consulta y fragmento.
- **Unidades con dependencia hacia delante (§12 L135-137):** U-1 cierra CA-1 (lectura de prueba del contrato, que valida el analizador de CA-5 de U-2), CA-2 (el lector, de U-2), CA-4 (tabla de recuentos de U-2 y estado de 4a U-2) y la segunda mitad de CA-15 (límites de lectura). Con dobles se puede probar, pero lo correcto es mover el puerto de lectura y la validación del contrato a U-1, o decir que U-1 usa un lector de prueba.
- **Primera lectura al conectar (CA-6):** no está especificada, así que el resultado clave queda en «Sin dato» hasta 24 h. Tampoco se dice si la lectura de prueba de CA-1 se guarda.
- **Después de una purga y antes de la primera lectura (CA-8/CA-10):** el total sale 0, que se confunde con un cero legítimo. Debe ser «Sin dato» (4a CA-30).
- **Lectura parcial:** si una vista falla y la otra no, no se sabe si falla todo. CA-7 y CA-11 tienen una sola fecha pero CA-8 sustituye por etapa. Define la lectura como atómica.
- **CA-10 no dice quién escribe el valor en el historial del resultado clave** en cada lectura correcta. CA-13 depende de esa copia para que el Consejo vea algo.
- **CA-8 (L77):** «purgar el origen anterior» exige guardar el origen con los recuentos. Esa tabla no debe colgar de `org_connections` con borrado en cascada, porque `dbStore.remove` borra la fila al desconectar y CA-4 exige conservar los recuentos.
- **Claves de recuento:** dos filas que normalizan a la misma clave (`Outbound` y `outbound`, o varios vacíos) deben sumarse o fallar. CA-9 no lo dice.
- **CA-5 (L74) y §8 L95:** una columna de más se «descarta», pero el dato ya llegó a Nokko. Prohíbe registrar la respuesta cruda, o haz que la lectura falle (opinión mía).
- **Cuadro de ediciones incompleto:** faltan la cabecera de 4a L5 («SDD-8 pendiente de redactar»), el aviso de L11 y §10 L134, que cita «CA-10» sustituido. En 5d, la definición de «valor medido» (L180) y CA-10 (L94) solo admiten fuentes de SDD 3 y 4a. Con esa redacción el plan propondría «Sin dato» aunque el total de Postin exista.
- **Dependencias:** CA-16 toca el embudo y el coste por etapa de SDD 3 CA-22, que está en SDD 3 U-5. La cabecera y U-3 solo citan U-1 y U-4. 4a U-3 es Stripe, no el mecanismo genérico de fuentes.
- **«Desvío de 4a CA-23» (L83 y §6):** 4a CA-23 solo rige «De pago». Lo que se desvía es la remisión de CA-31, que se sustituye. Reescríbelo.
- **CA-13 y matriz:** citan 4a CA-22, que solo habla de Stripe y no de copiar el valor al historial.
- **CA-6 (L75):** el reintento horario no tiene tope. Con una credencial rechazada, una vez revocada, golpea al servidor cada hora indefinidamente. Fija un tope o una pausa por credencial rechazada.
- **§14 L154:** añade CA-2 y CA-16 a la lista.
- **§17:** el informe pegado usa encabezados `##` (5 de más, 23 en total) y rompe el recuento de 18 secciones. Bájalos de nivel.
- **Fechas:** §3 y §15 datan las decisiones de la primera pasada el 2026-10-31, pero la respuesta del autor es del 2026-11-02.
- **§10 frente a §14:** «canal del catálogo» frente a «los cuatro nombres». Alinéalos con Dani CA-5.
- **Límites de filas, tamaño y tiempo (CA-15):** quedan sin valor y marcados «[Sugerencia]». Dani debe declarar un máximo esperado para que Nokko no fije un tope inferior al histórico.

#### Preguntas para Fede

1. ¿Qué es el «mismo acceso» de CA-14: la misma dirección normalizada (sin credencial) o la misma credencial?
   - Recomiendo la dirección.
   - Porqué: no obliga a guardar una huella de la credencial y basta con una restricción única.
   - Coste: no se podrían tener dos organizaciones contra la misma dirección con credenciales distintas, y hoy no existe ese caso.
2. Si una de las dos vistas falla, ¿se cuenta la lectura entera como fallida?
   - Recomiendo sí.
   - Porqué: hay una sola fecha de lectura y un solo estado, y se evita una frescura distinta por etapa.
   - Coste: un fallo de «Publicó» retrasa también «Activa».
3. ¿Se lee al conectar, sin esperar 24 h?
   - Recomiendo sí, reutilizando la lectura de prueba si pasa el contrato.
   - Porqué: así el resultado clave no queda en «Sin dato» un día.
4. ¿Una columna de más hace fallar la lectura en lugar de descartarse?
   - Recomiendo fallar con texto fijo.
   - Porqué: una vista que devuelve un correo es un error de configuración de Postin que conviene ver.
   - Coste: un descuido de Dani corta los datos hasta que se corrija.

#### Hechos de código verificados / no verificados

**Verificados**
- `src/lib/secret-box.server.ts`:
  - AES-GCM con `SHA-256(INTEGRATION_KEYS_SECRET)`, formato `v1:iv:ct`, sin identificador de clave ni rotación.
  - Solo lo importa `posthog-sync.server.ts`.
  - No liga el cifrado a la fila (sin AAD).
- `storeCredential` y `discardCredential` son opcionales (`connections-core.ts` L24-L25) y solo aparecen en el núcleo y su test. `connections.functions.ts` L27 devuelve `checkers: {}`.
- Un proveedor nuevo con `Checker` solo recibe `credential: string` (L8, L30, L47).
- `connectAccount` hace la comprobación antes de guardar, y guarda la credencial antes que la fila.
- `othersWithAccount` devuelve un recuento, no la organización. El flujo es de confirmación, no de rechazo.
- `0059`: sin columna de credencial.
  - `account_key` no está concedido a `authenticated`.
  - Los miembros leen `last_error` y `account_label`.
  - `org_connection_events.action` admite `connected`, `changed`, `disconnected` y `check_failed`.
- `last_synced_at` se escribe antes de leer en `maintainStripe` y `maintainPosthog` (`tasks.server.ts` L22-L35), y también al fallar (`stripe/sync.server.ts` L79, L108).
- `job_locks` existe con `name`, `last_run_at`, `locked_until` y `paused_reason` (`types.ts` L2501).
- `posthogHost` (`product-usage.ts` L14) y `publicUrl` (`web-research.ts` L4) no resuelven nombres ni bloquean redirecciones. `posthogErrorText` existe. `MANUAL_SYNC_MINUTES = 2`.
- Mecánica:
  - 16 CA únicos, cada uno en una sola unidad.
  - Las pruebas de §7 y §12 coinciden.
  - Las remisiones del §8 existen.
  - Las citas a 4a CA-1, CA-3, CA-9, CA-18, CA-19, CA-22, CA-23 y CA-26, a 1a CA-6, CA-17, CA-24, CA-28 y CA-68, a SDD 3 CA-13, CA-14, CA-15, CA-18 y CA-22, y a PRD R-8, R-9 y R-10 son correctas.
- Cuadro frente a 4a:
  - CA-3 (L64), CA-9 (L78), CA-10 (L81), CA-31 (L82), U-5 (L148) y Orden (L153) coinciden.
  - También coinciden §13 L159 y L161, §14 L171 y L184, y §15 L190.
  - La cita de 5d L244 es la única a «4a CA-10».
  - El PRD L123 es la fila a editar. L148 y L222 ya recogen la enmienda.
- Dani: coincide en `dia` (UTC), `canal`, `personas > 0`, nombres de vistas, omisión de días sin personas, recuento completo por HTTPS y baja de personas.

**No verificados**
- Si `0059` está aplicada.
- El runtime y la capacidad de resolver o fijar DNS en producción.
- Las políticas de acceso reales.
- Que las vistas de Dani existan.
- SDD 3 U-5 como unidad de CA-22 (lo tomé de su tabla).

#### Límites de la revisión

- Lectura estática. No audité el SDD de Dani, solo lo comparé con el §10.
- No leí 1b, 4b ni 5a a 5c salvo las búsquedas de «SDD-8» y «4a CA-10» (solo SDD 3 y 5d las citan).
- Los puntos sobre rebinding, atomicidad, huella de credencial y descartar frente a fallar son opinión mía.

Archivo revisado: `/Users/fedecosentino/NOKKO GTM BRAIN/seller-strategy-studio/docs/sdd/SDD-20261031-gtm-control-tower-8-postin-views-nokko.md`

### Respuesta del autor (segunda pasada)
**Respuesta del autor (v3, 2026-11-02).** Fede aceptó las cuatro recomendaciones del gate (§3). Cambios por punto:

- **Bloqueante 1 (formato):** el §10 fija el contrato: GET HTTPS a `/activa` y `/publico`, credencial en cabecera, cuerpo JSON `{"filas":[…]}` con `dia` en `AAAA-MM-DD`, vacío válido igual a `200` con filas vacías; CA-5 define cuándo falla (campo de más o que falta, tipo o formato distinto). Se refleja también en el SDD para Dani (§10 y CA-10).
- **Bloqueante 2 («mismo acceso»):** CA-14 lo define como la dirección normalizada sin credencial, exige restricción única (también con dos conexiones a la vez) y declara que sustituye a la confirmación de cuenta compartida; §13 lo explica.
- **Bloqueante 3 (SDD 3 CA-15):** el cuadro del §6 añade SDD 3 CA-15 y sus referencias «hasta el SDD 8», la cabecera y el aviso de 4a, y la definición de «valor medido» del 5d.
- **Bloqueante 4 (CA-15):** validación en cada lectura de todas las direcciones resueltas (IPv4, IPv6 e IPv4 mapeada), conexión a la dirección validada o nueva comprobación, certificado válido, sin consulta ni fragmento, tamaño medido tras descomprimir y un único texto de error de red; el §13 declara la limitación del runtime como [Por verificar].
- **Menores nuevos:**
  - CA-1 y CA-6 hacen la primera lectura al conectar.
  - CA-10 deja «Sin dato» tras una purga, copia el valor al historial y corrige la remisión a 4a CA-23.
  - CA-7 hace atómica la lectura de las dos vistas.
  - CA-8 guarda el origen con los recuentos y §13 evita el borrado en cascada.
  - CA-9 suma los canales que coinciden.
  - CA-5 no registra la respuesta.
  - CA-6 pausa los reintentos si la credencial fue rechazada.
  - CA-13 corrige la cita a Stripe.
  - La cabecera añade SDD 3 U-5 y corrige 4a.
  - El §12 declara que U-1 usa un lector de prueba y que U-2 y U-3 añaden casos de guardia y aislamiento.
  - El §14 amplía los criterios con varias condiciones y alinea «canal del catálogo».
  - Los encabezados del §17 están bajados de nivel (18 secciones) y las fechas corregidas.
- **Sin cambio:** los valores máximos de CA-15 y el máximo de histórico de Dani siguen como preguntas para la revisión técnica (§15).
- **Comprobación mecánica:** 16 CA únicos, cada uno en una sola unidad, pruebas del §7 y del §12 coinciden y las remisiones del §8 existen.

### Tercera pasada (sobre v3) — informe verbatim

**Veredicto:** Bloqueado, pero por una sola línea. CA-8 manda guardar «la credencial» junto a los recuentos, lo que contradice CA-1 y CA-4. Los 4 bloqueantes de la segunda pasada están resueltos (el de SDD 3 CA-15 a medias, por una cita equivocada). Hay 17 cambios menores nuevos, ninguno exige rediseño. No he ejecutado nada.

#### Estado de la segunda pasada

**Bloqueantes**

| # | Estado | Cita |
|---|---|---|
| 1 Formato del contrato | Resuelto | §10 L132 fija GET `/activa` y `/publico`, `Authorization: Bearer`, JSON `{"filas":[…]}`, `dia` AAAA-MM-DD, vacío = `200` con `"filas":[]`. CA-5 (L82) y CA-8 (L85) se apoyan en eso. Coincide con Dani §10 L67, CA-3, CA-5, CA-9 y CA-10. |
| 2 «Mismo acceso» (CA-14) | Resuelto, con residuos | L78 define dirección normalizada sin credencial, restricción única, dos conexiones a la vez y sustitución de la confirmación. Residuos en los menores 9, 10 y 11. |
| 3 SDD 3 CA-15 | A medias | El cuadro L66 añade la edición y la condición «sin fuente automática por recorrido» encaja con SDD 3 L73. Pero cita «SDD 3 §3 y §14» y la frase «hasta el SDD 8» está en el §5, no en el §3 (SDD 3 L36). En el §14 sí está (L190). |
| 4 CA-15 | Resuelto | L79 cubre cada lectura, todas las direcciones resueltas (IPv4, IPv6, mapeada), conectar a la validada o recomprobar, certificado, tamaño tras descomprimir, texto único, y rechaza consulta y fragmento. §13 L160 declara el límite del runtime. Los valores máximos siguen «[Sugerencia]» (§15 L185). |

**Menores nuevos**

| Menor | Estado | Cita |
|---|---|---|
| Consulta/fragmento | Resuelto | CA-15 L79. |
| Primera lectura al conectar | Resuelto | CA-1 L74 la guarda; CA-6 L83 la nombra. |
| Cuadro de ediciones | A medias | Añade cabecera, aviso y §10 de 4a, y 5d §10 y CA-10. Faltan BYO CA-5 y 5d L5 (ver menores 5 y 7); además §3 en vez de §5 en SDD 3. |
| Cita de «desvío de 4a CA-23» | A medias | CA-10 L91 ya habla de «criterios» reutilizados, pero §6 L53 sigue diciendo «4a CA-23 con un desvío» y el cuadro no tiene fila para CA-23. |
| Dependencias hacia delante | A medias | §12 L156 declara lector de prueba solo para CA-1, CA-2 y CA-4 (ver menor 1). |
| Lectura atómica | A medias | CA-7 L84 dice «lectura entera fallida», pero CA-8 sustituye «por organización y etapa» (ver menor 4). |
| Tras una purga | A medias | CA-10 pone «Sin dato», pero cita 4a CA-30, que solo rige «Sin valorar» y «Sin fuente conectada» (4a L67). Además, tras CA-1 el estado es inalcanzable (ver menor 12). |
| Reintento sin tope | Resuelto en lo pedido | CA-6 pausa con credencial rechazada. Los demás fallos siguen cada hora sin tope (opinión: aceptable). |
| Fechas | A medias | §3 L23 y L30 dicen 2026-11-02, pero §10 L144 dice 2026-10-31 para los recuentos pequeños y §15 L183 también. |
| Resto | Resuelto | Historial de CA-10, CA-13 y cita a Stripe, CA-9, CA-5, CA-11, CA-2 y §14, §17 (18 `##`) y «catálogo» alineado con Dani. |

#### Bloqueantes nuevos

1. **CA-8 (L85) guarda «el origen (dirección y credencial)» junto a los recuentos.**
   - Esa tabla la leen Owner y Sales leader (CA-13). Contradice CA-1 (la credencial solo va cifrada) y CA-4 (desconectar borra la credencial pero conserva el origen).
   - Con la lectura literal, una prueba pasaría guardando la clave en claro.
   - Arreglo: «huella no reversible de la credencial (nunca la credencial)». Añadir en §13 qué huella y con qué sal del servidor.

#### Cambios menores nuevos

1. **Dependencias hacia delante entre unidades (§12 L152-156).**
   - U-1 cierra CA-1 («guardar la primera lectura») y CA-4 («conservar recuentos»), que escriben en la tabla de recuentos de U-2. El doble de §12 cubre el lector, no el almacén.
   - U-1 cierra CA-4 con «Sin fuente conectada» (4a CA-26), que entrega 4a U-2; U-1 solo depende de 4a U-1.
   - CA-15 («en cada lectura», límites) no está en la nota del doble.
   - U-2 cierra CA-7 con «Sin dato reciente» (4a CA-2, también 4a U-2) y no lo declara.
   - U-1 crea la tabla de la credencial pero el aislamiento (CA-13) solo se añade en U-2 y U-3.
2. **§8 L112 contradice CA-5.** Dice «una columna de más → se descarta y no se guarda», pero CA-5 hace fallar la lectura (y L103 lo dice bien). Corrígelo: una prueba escrita desde §8 afirmaría lo contrario.
3. **«Credencial rechazada» no está definida en el contrato (§10, Dani CA-7).**
   - Falta qué respuesta HTTP (401/403) la señala y cómo se distingue de un error del servidor. CA-6 y CA-11 dependen de ello.
   - Fija el código en el §10 y en el SDD de Dani.
   - También faltan el tipo de contenido y si un campo de más a nivel de envoltorio (`{filas, meta}`) falla. Y que `dia` sea una fecha real del calendario (CA-5 solo dice «formato»).
4. **CA-8 sustituye «por organización y etapa».** CA-7 y §13 L162 piden las dos etapas juntas, pero el CA permite dos operaciones y una caída entre ambas. Escribe «una sola operación para ambas etapas».
5. **CA-14 reemplaza la confirmación de BYO y el cuadro no lo recoge.** BYO L66 y su CA-5 exigen «informar y pedir confirmación». Falta la fila del cuadro, y la cabecera dice que enmienda 4a, SDD 3 y PRD pero no BYO.
6. **CA-14 sin detalle de datos.**
   - `account_key` es `check` ≤120 (0059) y CA-15 no limita la longitud de la dirección: un inserto largo fallaría con error crudo.
   - La restricción única debe ser parcial por proveedor (en 0059 solo hay un índice no único).
   - `connectAccount` guarda la credencial antes que la fila: si salta la restricción única en la fila, queda una credencial huérfana. La restricción debe ir en la tabla que se escribe primero, o hay que descartar la credencial al fallar.
7. **Cuadro de ediciones.** 5d L5 y 5d U-2 L205 siguen hablando de «U-5 diferida» y «U-5 opcional», y PRD L5 sigue con «SDD-8 pendiente». En SDD 3, «§3» debe ser «§5» (L36). La fila «4a CA-10 y CA-31 → CA-10 y CA-16» mezcla: CA-31 se sustituye por CA-10 y CA-16 solo etiqueta el embudo manual.
8. **Fuga por estado visible (CA-11 frente a CA-15).** CA-15 exige un único texto para cualquier fallo de red, pero CA-11 distingue «Error» de «Sin respuesta». No dice cuál ve una dirección bloqueada por red privada frente a un tiempo agotado. Si difieren, sirve de sonda de la red interna. Fija que los rechazos de validación y los fallos de red muestren el mismo estado.
9. **CA-6, pausa y reanudación.** «Hasta que el Owner la cambie o sincronice a mano» no dice si la sincronización manual del Sales leader también reanuda. La pausa y el reintento no mencionan la fase: CA-12 y R-9 exigen el comportamiento anterior con la fase apagada, pero el trabajo diario seguiría leyendo.
10. **CA-9 dice «mismo canal»**, debería decir «mismo día y canal» (la clave de CA-8 incluye el día). Con nombres del catálogo que difieran solo en acentos o mayúsculas, la coincidencia es ambigua (1a CA-28 solo rechaza duplicados exactos).
11. **Dirección guardada «aparte» (§13 L159).** No dice si los miembros pueden leerla. La ruta puede llevar un token pegado en el camino (CA-15 solo rechaza consulta y fragmento). Dilo y mantén la columna fuera de los `grant` de `authenticated`.
12. **«Sin dato» tras purga es inalcanzable.** Si la purga y la lectura de CA-1 son una sola operación, el estado de §8 L105 no se puede probar. O la purga se hace en esa operación y se quita el caso, o se define cuándo se purga sin lectura (reconexión tras desconectar con otro origen).
13. **CA-5, «sin registrar la respuesta».** Inngest persiste los resultados de cada paso y los mensajes de error. Dilo en §13: el analizador no devuelve ni lanza el cuerpo (opinión).
14. **CA-16 «no comparar como iguales».** Difícil de probar. Reescríbelo como «cada cifra con su etiqueta y sin totales combinados».
15. **CA-15 depende de valores sin fijar.** Tiempo, filas y tamaño siguen «[Sugerencia]». Hace falta el máximo de histórico de Dani (§15 L185), que Dani aún no declara (su pregunta 3).
16. **Cabecera y matriz.** La cabecera pone «SDD 1a U-1» para auditoría, pero 1a CA-68 está en 1a U-7 (1a U-1 solo trae el mecanismo). Es menor.
17. **Mensaje de CA-14.** Decir «ya conectada en otra organización» revela a la segunda organización que la primera existe, igual que `SHARED_ACCOUNT_NOTE` hoy. Opinión, aceptable si es decisión consciente.

#### Preguntas para Fede

1. **¿El trabajo diario se pausa cuando la fase está apagada?** Recomiendo sí. Porque 1a CA-6 y PRD R-9 piden el comportamiento anterior con la fase apagada. Coste: el KR queda en «Sin dato reciente» hasta reactivar.
2. **Con la credencial rechazada, ¿la sincronización manual del Sales leader reanuda los reintentos?** Recomiendo sí. Porque coincide con la matriz (puede sincronizar) y evita dejar al Owner como cuello de botella. Coste: una llamada manual extra al servidor si la credencial sigue rechazada.

#### Hechos de código verificados / no verificados

**Verificados**
- `secret-box.server.ts`: AES-GCM con SHA-256 de `INTEGRATION_KEYS_SECRET`, formato `v1:iv:ct`, sin rotación ni identificador de clave. Solo lo importa `posthog-sync.server.ts`.
- `connections-core.ts`:
  - `Checker` y `ConnectInput` solo admiten `credential: string`.
  - `storeCredential` y `discardCredential` son opcionales y `connections.functions.ts` devuelve `checkers: {}`.
  - El flujo guarda la credencial antes que la fila.
  - `othersWithAccount` devuelve un recuento y el flujo es de confirmación.
- `connections.ts`: `accountKey` es `lower(label)`, `SHARED_ACCOUNT_NOTE` existe, `STATE_LABEL` solo tiene Error y Sin respuesta.
- `tasks.server.ts`: `last_synced_at` se escribe antes de leer en `maintainStripe` y `maintainPosthog`. `MANUAL_SYNC_MINUTES = 2`. `job_locks` tiene `name`, `last_run_at`, `locked_until` y `paused_reason`.
- `posthogHost` y `publicUrl` no resuelven nombres ni bloquean redirecciones. `posthogErrorText` existe.
- 0059: sin columna de credencial, `account_key` fuera de los `grant`, `account_key` ≤120, índice no único por `(provider, account_key)`, `org_connection_events.action` admite los cuatro valores usados.
- `lovable-exit-migration` conserva `INTEGRATION_KEYS_SECRET` (CA-27, L93 y L136).
- Cuadro frente a 4a: coinciden CA-3 (L64), CA-9 (L78), CA-10 (L81), CA-31 (L82), U-5 (L148), Orden (L153), §13 (L159 y L161), §14 (L171 y L184), §15 (L190), cabecera L5, aviso L11 y §10 L134. En 5d coinciden §10 L180, CA-10 L94 y §14 L244. PRD L123 es la fila a editar.
- Contrato del §10 frente a Dani §10 L67, CA-3, CA-5, CA-9 y CA-10: coherente.
- Mecánica: 18 secciones, 16 CA únicos, cada uno en una sola unidad (U-1: 7, U-2: 7, U-3: 2), tests de §7 y §12 coinciden, las remisiones del §8 existen y el §14 cita los 16.
- El archivo `SUPERADO-SDD-20261031-nokko-activation-data-feed.md` existe en `docs/archivado/`.

**No verificados**
- Si 0059 está aplicada (su cabecera dice «NOT VERIFIED, not applied»).
- El runtime de producción: `vite.config.ts` solo menciona «cloudflare as a default target» en un comentario.
- Que las vistas de Dani existan y qué devuelven ante 401 o 403.
- Las políticas de acceso reales.

#### Límites de la revisión

- Lectura estática; no ejecuté código ni pruebas.
- No audité el SDD de Dani, solo lo comparé con el §10.
- No leí 1b, 4b, 5a a 5c. De 1a leí solo CA-6, CA-17, CA-22 a CA-24, CA-28, CA-68, CA-86 y su tabla de unidades.
- Marco como opinión mía los menores 13, 14, 15 y 17, el tope de reintentos y la fuga de estado del menor 8.

Archivo revisado: `/Users/fedecosentino/NOKKO GTM BRAIN/seller-strategy-studio/docs/sdd/SDD-20261031-gtm-control-tower-8-postin-views-nokko.md`

### Respuesta del autor (tercera pasada)
**Respuesta del autor (v4, 2026-11-02).** Fede pidió una cuarta pasada; corregí antes el bloqueante y los menores que no necesitan decisión suya.

- **Bloqueante 1 (CA-8 guarda la credencial):** CA-8 guarda la dirección y una huella no reversible de la credencial, nunca la credencial; el §13 sugiere un HMAC con clave derivada de la clave de cifrado del servidor.
- **Menores 1 a 17:**
  - El §12 añade 4a U-2 como dependencia de U-1 y U-2 y declara los dobles del lector y del almacén; CA-15 entra en la nota.
  - El §8 corrige la columna de más (falla) y se quita el caso «Sin dato tras una purga», que era inalcanzable (la purga y la primera lectura son una sola operación; tras desconectar vale «Sin fuente conectada», CA-4).
  - El contrato fija el tipo de contenido, `401` o `403` para una credencial rechazada, el `dia` como fecha real y el campo de más también en el envoltorio; el SDD para Dani recoge lo mismo.
  - CA-8 sustituye ambas etapas en una sola operación.
  - El cuadro del §6 añade la edición del SDD de conexiones propias, la cabecera del 5d y del PRD y corrige «§3» por «§5» y la fila de 4a CA-10 y CA-31.
  - El §13 declara la restricción única parcial en la tabla que se escribe primero, el límite de longitud de la dirección, que los miembros no leen la dirección y que el analizador no devuelve la respuesta cruda.
  - CA-11 muestra el mismo estado para un rechazo de validación y para un fallo de red.
  - CA-9 suma por día y canal; CA-14 descarta la credencial si no se guarda; CA-16 etiqueta cada cifra sin totales combinados.
  - La cabecera cita 1a U-7 para la auditoría; las fechas se corrigen.
  - Los menores 13 a 17 de opinión se declaran sin cambio, salvo el 13 (ahora en el §13).
- **Pendiente de Fede:** las dos preguntas de la tercera pasada (pausa del trabajo con la fase apagada y reanudación manual del Sales leader) quedan en el §15 con recomendación; no las he aplicado.
- **Comprobación mecánica:** 16 CA únicos, cada uno en una sola unidad, pruebas del §7 y del §12 coinciden, las remisiones del §8 existen y hay 18 secciones.

### Cuarta pasada (sobre v4) — informe verbatim

**Veredicto:** Cambios menores. El bloqueante de la tercera pasada (CA-8 guardaba la credencial) está resuelto en el texto actual. La v4 no introduce ningún bloqueante: lo más serio es que CA-8 copia la dirección completa a una tabla que lee el Sales leader. Todo se puede arreglar con una línea. Solo he leído, no he ejecutado nada.

#### Estado de la tercera pasada

**Bloqueante: resuelto.** CA-8 (L87) ahora guarda «la dirección y una huella no reversible de la credencial, nunca la credencial». El §13 (L160) concreta la huella como un HMAC con clave derivada de `INTEGRATION_KEYS_SECRET`. Ya no contradice CA-1 ni CA-4.

**Menores, de 1 a 17:**

| # | Estado | Cita |
|---|---|---|
| 1 Dependencias hacia delante | Medias | §12 L153-157: U-1 depende ya de 4a U-2 y se declaran dobles para el lector y el almacén, también para CA-15. Quedan dos huecos, ver M-2 y M-3. |
| 2 §8 «columna de más» | Resuelto | §8 L113 dice «la lectura falla y no se guarda nada». |
| 3 Contrato | Resuelto en §10, residuo en CA-5 | §10 L133 fija `401/403`, `application/json`, envoltorio y `dia` real. CA-5 (L84) no cubre estado, tipo de contenido ni JSON roto (ver M-5). |
| 4 Una sola operación | Resuelto | CA-8: «una sola operación para ambas etapas». |
| 5 BYO en el cuadro | Resuelto | Fila en §6 L70 y cabecera. La redacción de la cabecera es confusa (M-9). |
| 6 CA-14, datos | Medias | §13 L166 declara la restricción parcial, la longitud y descartar la credencial; CA-14 también descarta la credencial. El límite de longitud no está en ningún CA, así que no es testeable. |
| 7 Cuadro | Resuelto, con un cabo suelto | Están 5d cabecera y U-2, PRD cabecera y SDD 3 §5 (L36 está en §5). La fila de 4a CA-10/CA-31 ya no mezcla. Falta lo que dice M-8. |
| 8 Fuga por estado | Medias | CA-11 (L89) exige el mismo estado para rechazo y red, pero no dice cuál (M-4). |
| 9 Pausa y fase | Sin decidir | Es la pregunta a Fede en §15 L190-191. Solo es bloqueante si impide probar un CA; no lo impide. |
| 10 CA-9 | Medias | Ahora dice «mismo día y canal». Sigue sin resolver el caso de dos canales del catálogo que solo difieran en acentos o mayúsculas; 1a CA-28 solo rechaza duplicados exactos. |
| 11 Dirección visible | Medias | Los miembros no leen la columna (§13 L160), pero CA-8 la copia a la tabla de recuentos (M-1). |
| 12 «Sin dato» tras purga | Resuelto | Caso quitado del §8 y de CA-10. La purga y la primera lectura son una sola operación. |
| 13 Respuesta cruda | Resuelto (opinión) | §13 L167. |
| 14 CA-16 | Resuelto | «Cada cifra con su etiqueta, sin ningún total que las combine» (L95). |
| 15 Valores de CA-15 | Sin cambio, declarado | Sigue en §15 L188; propongo valores en M-6. |
| 16 Cabecera 1a U-7 | Resuelto | Cabecera L5. |
| 17 Mensaje de CA-14 | Sin cambio, aceptable | Opinión. |

Dos puntos más de la tercera pasada:
- **«Desvío de 4a CA-23»:** sin resolver. §6 L53 sigue diciendo «4a CA-23 con un desvío…» y el cuadro no tiene fila para CA-23 (ver M-7).
- **Fechas:** resueltas en §10 L145 y §15 L189.

#### Bloqueantes nuevos
Ninguno. Los contrastes que he hecho entre CAs, 4a, 1a, SDD 3, 5d, PRD, BYO y el SDD de Dani no muestran contradicciones que impidan probar un CA.

#### Cambios menores nuevos

**M-1. CA-8 copia la dirección completa a una tabla que lee el Sales leader (L87 y L90).**
- Contradice §10 L145 («la dirección se guarda sin credenciales») y el §13 L160 («los miembros no la leen»). La ruta puede llevar un token pegado (CA-15 solo rechaza consulta y fragmento).
- Arreglo: guardar con los recuentos solo el nombre del servidor y un hash de la dirección normalizada, o excluir esa columna de los permisos de `authenticated`. Dilo en CA-8 o CA-13.

**M-2. CA-4 «conserva los recuentos» no tiene prueba real.**
- Que desconectar no los borre depende de que la tabla de U-2 no tenga borrado en cascada desde `org_connections`. `dbStore.remove` borra esa fila (`connections-core.ts`, `disconnectAccount`).
- U-1 lo prueba con un doble de almacén y U-2 no cierra CA-4. Añade el caso a U-2.

**M-3. CA-1 y CA-15 se cierran en U-1 con un doble del lector.**
- La mitad de red de CA-15 (resolver, redirecciones, tiempo, filas, tamaño) y la lectura de prueba real de CA-1 viven en el lector de U-2. Ningún CA de U-2 los vuelve a probar con el lector real.
- Opciones: mover el cliente seguro a U-1, o añadir en U-2 una prueba de integración de CA-1, CA-2 y CA-15.
- Además, el `org-isolation.test.ts` y el `postin-views-phase-guard.test.ts` que U-1/U-2/U-3 amplían solo aparecen en la columna de una unidad (§12 L153-157).

**M-4. CA-11 no fija el mapeo de estados.**
- Dice «el mismo estado» para rechazo de validación y fallo de red, pero no cuál. Tampoco dice qué estado muestran un 5xx, una violación del contrato (CA-5) o un tiempo agotado.
- Pon una tabla breve: `401/403` y contrato roto → Error; red, validación y tiempo → Sin respuesta (o la que decidas). Los estados existentes en `org_connections` son solo `connected`, `error` y `no_response` (0059).

**M-5. CA-5 no cubre el estado ni el formato del cuerpo.**
- No cubre un 200 con tipo de contenido distinto de `application/json`, un cuerpo no JSON, `personas` ≤ 0, no entero o fuera de rango, ni otros 2xx o 3xx. CA-5 lo ata a campos, tipo y formato.
- Añade «o la respuesta no es un 200 JSON válido del contrato».

**M-6. Valores de CA-15 (L81), que §15 L188 te pregunta a ti.** Mi propuesta, opinión no verificada: 10 s por vista, 20 000 filas por vista y 2 MB tras descomprimir. Cinco años × 365 días × unos 5 canales son unas 9 000 filas. Fíjalos en el §13 antes del brief y pide a Dani su máximo de histórico. Sin él, un histórico más largo que el tope falla siempre o infravalora el total en silencio.

**M-7. Cuadro del §6 y cabecera.**
- **L53:** dice que se modifica «4a CA-23», pero CA-23 solo rige «De pago» y no hay fila en el cuadro. Reescríbelo como «CA-10 reutiliza los criterios de 4a CA-23 con un desvío».
- **Cuadro:** falta una fila para `lovable-exit-migration`. Su L136 dice «Sin tablas ni columnas nuevas»; las dos tablas nuevas deben entrar en su alcance de copia.
- **Cabecera L5:** «SDD 4a CA-5 de `connections-bring-your-own-account`» es la CA-5 de BYO, y la confirmación está en su §8 L66.

**M-8. Orden de conexión y primera lectura.**
- CA-1 guarda la primera lectura y CA-14 rechaza si la dirección ya está en otra organización. Si el rechazo llega por carrera tras la lectura, quedarían recuentos sin conexión.
- CA-14 solo descarta la credencial. Que descarte también la lectura, o que todo sea una operación.

**M-9. Puertos que hay que ampliar (§13 L160 y L166).**
- `storeCredential(orgId, provider, credential)`, `Store.save` y `ConnectInput` no llevan dirección (`connections-core.ts`).
- La restricción única de CA-14 solo puede ir en la tabla de la credencial si el puerto recibe la dirección.
- Falta decir que `account_key` es la dirección normalizada (hoy `accountKey = lower(label)`) y que la etiqueta visible es solo el servidor.
- Falta registrar el proveedor en `PROVIDERS` (`kind: "key"`, `ownAccount: true`, con `Checker`).

**M-10. Menores sueltos.**
- §14 L171: «las pruebas usan un doble (CA-1 a CA-13)» debería llegar a CA-16.
- Misma clave para HMAC y AES-GCM: usa una derivación con etiqueta distinta (opinión).
- El trabajo diario usa el cliente de administración: inserta `org_id` explícito (`src/lib/AGENTS.md`, regla de «Background work»).
- `U-3` depende de 4a U-3 (Stripe); justifica la dependencia o déjala en 4a U-2.
- CA-14 L80 tiene una coma o «y» que falta («a la vez DEBE sustituir»).
- Opinión: CA-9 mantiene el canal en los recuentos pero el resultado clave usa solo el total, así que el desglose no tiene consumidor en la v1.

#### Preguntas para Fede
Siguen abiertas las dos de §15, y mantengo mi recomendación en ambas. Ninguna impide probar un CA.
1. **¿El trabajo diario se pausa con la fase apagada para el Owner?** Recomiendo sí, porque 1a CA-6 y el PRD R-9 piden el comportamiento anterior. Coste: el resultado clave queda en «Sin dato reciente» hasta reactivar.
2. **¿La sincronización manual del Sales leader reanuda los reintentos tras una credencial rechazada?** Recomiendo sí, porque la matriz le permite sincronizar y evita depender solo del Owner. Coste: una llamada extra si la credencial sigue rechazada.

#### Hechos de código verificados / no verificados

**Verificados:**
- **Cifrador:** `secret-box.server.ts` es AES-GCM con SHA-256 de `INTEGRATION_KEYS_SECRET`, formato `v1:iv:ct`, sin identificador de clave ni rotación. Solo lo importa `posthog-sync.server.ts`.
- **Puertos de credencial:** `storeCredential` y `discardCredential` son opcionales y no tienen implementación fuera del núcleo y su test.
- **Flujo de conexión (`connections-core.ts`):**
  - `Checker` y `ConnectInput` solo admiten `credential: string`.
  - `connectAccount` guarda la credencial antes que la fila.
  - `disconnectAccount` borra la fila.
  - `othersWithAccount` devuelve un recuento.
- **Cuentas compartidas (`connections.ts`):** `accountKey = lower(label)`. El flujo es de confirmación (`needsSharedConfirmation`, `SHARED_ACCOUNT_NOTE`), no de rechazo.
- **Estados:** `STATE_LABEL` y `org_connections.status` solo tienen Error y Sin respuesta (más `connected`).
- **Migración 0059:**
  - No hay columna de credencial.
  - `account_label` y `account_key` admiten como máximo 120 caracteres.
  - El índice `(provider, account_key)` no es único.
  - `account_key` no está concedido a `authenticated` y `last_error` y `account_label` sí.
  - Hay `unique(org_id, provider)`.
  - `org_connection_events.action` admite los cuatro valores usados.
- **Cron y reintentos:**
  - `last_synced_at` se escribe antes de leer en `maintainStripe` y `maintainPosthog`.
  - `MANUAL_SYNC_MINUTES = 2`.
  - `job_locks` existe en `types.ts`.
  - El cron horario despacha un mantenimiento por organización (`src/lib/AGENTS.md` L33).
- **Validación de direcciones:** `posthogHost` y `publicUrl` solo filtran el nombre con regex. `posthogErrorText` existe.
- **Runtime:** `vite.config.ts` menciona Cloudflare solo como destino por defecto en un comentario.
- **Cuadro frente a otros documentos (§6):** coincide con 4a (cabecera L5, aviso L11, CA-3, CA-9, CA-10, CA-31, U-5, Orden, §10, §13, §14, §15), SDD 3 (CA-15, L36 en §5, L190 en §14), 5d (cabecera, §10, CA-10, U-2, §14 L244) y PRD (L5, L123). Ningún otro SDD cita 4a CA-10 ni el SDD-8.
- **Contrato del §10 frente a `nokko-aggregate-views`:** coherente (§10 L67, CA-3, CA-5, CA-9, CA-10, CA-11). Dani fija cuatro canales y Nokko acepta el catálogo, que es compatible.
- **Citas:** son correctas las de 1a CA-6, CA-17, CA-24, CA-28 y CA-68, 1a U-3, U-4 y U-7, SDD 3 CA-14, CA-15, CA-18, CA-22 y SDD 3 U-1, U-4 y U-5, PRD R-8 a R-10 y 4a CA-1, CA-2, CA-3, CA-9, CA-18, CA-19, CA-22, CA-23, CA-25, CA-26, CA-30 y la matriz §10.
- **Mecánica:**
  - Hay 18 secciones `##`.
  - Hay 16 CA únicos, cada uno en una sola unidad (U-1: 7, U-2: 7, U-3: 2).
  - Las pruebas de §7 y §12 coinciden.
  - Las remisiones del §8 existen.
  - El §14 cita los 16.
  - No hay datos de clientes.
  - El duplicado para Dani está archivado en `docs/archivado/`.

**No verificados:**
- Si la 0059 está aplicada (consta en `_journal.json` y `types.ts`, y su cabecera dice «NOT VERIFIED»).
- El runtime de producción. Si es Workers, resolver nombres exige DoH y no se puede fijar la IP, así que CA-15 «conectar a la validada o recomprobar» puede no ser alcanzable por completo. §13 y §16 lo declaran.
- Que existan las vistas de Dani y qué devuelven ante `401/403`.
- Las políticas de acceso reales.
- Si SDD 3 U-5 cierra CA-22 en producción (solo la tabla de unidades).

#### Límites de la revisión
- Lectura estática: no ejecuté pruebas, código ni producción.
- No audité el SDD de Dani, solo lo comparé con el §10.
- No leí 1b, 2, 4b ni 5a a 5c, salvo una búsqueda de «SDD-8» y «4a CA-10».
- De 1a leí solo las CA y unidades citadas; de 4a, 3, 5d y BYO leí lo necesario para el cuadro.
- Son opinión mía: los valores de M-6, la derivación de claves, el desglose sin consumidor, la sonda de red y la prioridad relativa de los menores.

Archivo revisado: `/Users/fedecosentino/NOKKO GTM BRAIN/seller-strategy-studio/docs/sdd/SDD-20261031-gtm-control-tower-8-postin-views-nokko.md`

### Respuesta del autor (cuarta pasada)
**Respuesta del autor (v5, 2026-11-02).** Fede eligió «Corregir y aprobar» con mis recomendaciones y se aprueba sin quinta pasada.

- **M-1 (dirección en la tabla de recuentos):** CA-8 guarda solo el nombre del servidor y una huella de la dirección normalizada y de la credencial; el §13 lo recoge.
- **M-2 y M-3 (CA-4, CA-1, CA-15):** el §12 declara que U-2 repite CA-1, CA-2 y CA-15 con el lector real y cierra CA-4 con el almacén real.
- **M-4 (estados):** CA-11 fija el mapeo: Error para `401`/`403` y contrato incumplido; Sin respuesta para fallo de red, rechazo de validación, tiempo agotado y `5xx`.
- **M-5 (CA-5):** añade que una respuesta que no es un `200` JSON del contrato falla.
- **M-6 (valores de CA-15):** 10 segundos, 20 000 filas y 2 MB tras descomprimir por vista, como sugerencia a confirmar con el máximo de histórico de Dani; la longitud de la dirección entra en el CA.
- **M-7 (cuadro y cabecera):** §6 reescribe el desvío de 4a CA-23, añade la fila de `lovable-exit-migration` y corrige la cita a conexiones propias.
- **M-8 (carrera CA-1/CA-14):** la primera lectura se guarda una vez guardada la conexión y CA-14 descarta también la lectura.
- **M-9 (puertos):** el §13 declara la ampliación de los puertos, `account_key` como dirección normalizada y el registro en `PROVIDERS`.
- **M-10:** el §14 llega a CA-16, la clave del HMAC se deriva con otra etiqueta, el trabajo diario inserta `org_id` explícito y la dependencia de U-3 queda como patrón de fuente.
- **Preguntas a Fede:** decididas según mi recomendación (CA-6: pausa con la fase apagada y reanudación manual por el Owner o el Sales leader).
- **Aprobación:** Estado «Aprobado» con los riesgos del §14 (runtime, 0059, valores de CA-15, canales ambiguos, desglose sin consumidor, mensaje de CA-14). Cada SDD afectado (4a, 3, conexiones propias, 5d) lleva un aviso de enmienda y el PRD recoge el cambio; el texto de cada criterio se corrige con el brief.
- **Comprobación mecánica:** 16 CA únicos, cada uno en una sola unidad, pruebas del §7 y del §12 coinciden, las remisiones del §8 existen y hay 18 secciones.

## 18. Delta de implementación (lo rellena el agente al entregar)
(sin rellenar)
