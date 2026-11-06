# Auditoría · SDD-20261031-nokko-aggregate-views

**Veredicto:** Bloqueado

**Capas:** Linter (aplicado por el autor; el script no estaba disponible, aplicado a mano) · Auditoría independiente ✘ · DoR provisional ✘

No puedo empezar sin preguntarte cuatro cosas que cambian el diseño. Las cuatro son decisiones tuyas, no técnicas.

## Bloqueantes

1. **§7 CA-8 contradice §8 y CA-10.** CA-8 dice que la aportación de una persona dada de baja «puede mantenerse» como número agregado. §8 dice que el recuento pasado baja y que la siguiente lectura devuelve el recuento actual. Una cosa es calcular en vivo y la otra guardar histórico, y el diseño cambia mucho. «Puede» tampoco se verifica con sí/no. Resolución: elige una (o bajan o se conservan) y reescribe CA-8 con «DEBE». Si se conservan, valida la retención con quien corresponda sobre borrado de datos.
2. **§7 CA-9 y §10, riesgo de reidentificación.** Se permiten filas con una sola persona por día y canal. Con la base de usuarios de Postin, una fila «1 persona, día X, canal Y» puede identificar a alguien. Eso choca con «ningún dato personal». Falta un umbral mínimo o una decisión explícita de aceptar el riesgo. Resolución: añade un CA con el umbral (lo fijas tú, no yo) o deja escrito que aceptas filas de 1.
3. **§5, §13 y §14.1, alcance condicional.** Si Postin no guarda el origen del alta, no se sabe si Dani debe construir la captura (tocar app y eventos, y recoger un dato nuevo) o entregar todo en canal vacío. El SDD lo manda decidir «en Preguntas para Dani», pero eso cambia el alcance y la estimación. Resolución: escribe el fallback que quieres, por ejemplo «si no existe, se entrega todo vacío y la captura va en otro SDD».
4. **§7 CA-4, definición de «persona» y del día de «Activa».** «Persona» puede ser usuario, cuenta o workspace, y no se dice cuál. «Activa» exige dos condiciones (LinkedIn conectado y post creado) y no se dice si el día es el de la segunda. No se dice qué hacer con cuentas internas, de prueba o de demo, ni con quien desconecta LinkedIn después. Tampoco se dice si «post creado» incluye borradores. Resolución: define la unidad, el día de alcance y las exclusiones, y deja a Dani solo el mapeo a tablas.

## Cambios menores

1. **Ambigüedad.**
   - **«Vista».** Suena a vista de base de datos, pero CA-10 las sirve por HTTPS. Aclara si es un recurso HTTP.
   - **«Credencial».** No se dice si es una clave, un token o un rol.
   - **CA-10.** Dice «una dirección HTTPS» para dos vistas. ¿Una dirección o dos?
   - **CA-3 y CA-5.** CA-3 dice «canal (texto)» y CA-5 dice «vacío». ¿Cadena vacía, nulo o campo ausente? Además, §13 lo llama «Sin atribuir».
   - **CA-5.** «Contenido y SEO» podría leerse como dos valores. Fija las cadenas exactas (mayúsculas y acentos).
   - **§2.** «Postin es el único cliente de estas vistas» es confuso: el consumidor es Nokko, y Postin es la fuente.
   - **§7 CA-3.** «dia (fecha en UTC)» no fija el formato (¿ISO 8601?).
2. **Testabilidad.**
   - **CA-8** no se verifica por el «puede» (bloqueante 1).
   - **CA-1, CA-2 y CA-4** no se pueden comprobar mientras §15 admita que la equivalencia con los datos de producto está sin verificar.
   - **§12** («sin carga relevante», «no hace falta tiempo real») no es verificable. Pon un criterio medible o déjalo como nota.
   - **CA-5** no define qué pasa con un valor de origen que no esté entre los cuatro (¿se manda a vacío o se rechaza?).
   - **CA-7** dice «se rechaza» sin indicar el tipo de respuesta.
3. **Faltan CA para el resumen y los casos límite.**
   - **Día en curso:** §13 lo menciona, pero ningún CA dice que se incluye ni que es parcial.
   - **Zona horaria:** CA-3 fija UTC sin justificar. Un post a las 00:30 en Madrid cae en el día anterior en UTC.
   - **Reatribución de canal:** ¿cambia la fila histórica?
   - **Histórico disponible:** CA-10 dice «todos los días disponibles» sin definir desde cuándo (Q3 sin respuesta).
   - **Volumen:** no hay límite ni paginación.
   - **Rotación y revocación de la credencial:** §8 lo describe, pero CA-7 no lo cubre.
   - **Resultado vacío:** no se dice qué devuelve si no hay ninguna fila.
   - **Repetir la acción:** CA-6 lo cubre, pero no la reconexión ni el borrado del post.
4. **Qué vs. cómo.** CA-10 impone HTTPS y devolver el recuento completo, aunque §12 dice que Dani decide cómo se sirven. Está justificado por una decisión tuya del 2026-10-31, así que marca CA-10 como restricción tuya. Tampoco se define el formato de respuesta (JSON, CSV), y el lado de Nokko se escribe contra ese contrato.
5. **Consistencia.**
   - **CA-3 y CA-9:** coherentes entre sí («personas > 0» y omitir filas vacías).
   - **CA-8 y CA-10:** tensión por el bloqueante 1.
   - **CA-11:** está bajo H-2 (privacidad), pero trata de nombres. Muévela a H-1.
   - **U-2:** mapea CA-8 a la credencial, y CA-8 pertenece a las vistas (U-1). La entrega de la credencial no tiene ningún CA.
   - **§2 y §4:** §2 dice que se consulta cada semana y §4 pide lectura diaria. Justifica la cadencia.
6. **Evidencia («por qué ahora»).** Se sostiene solo a medias.
   - **Fecha:** «2026-10-29 a 31» es un rango, no una fecha.
   - **Fuente:** apunta a tu propio PRD (circular) y no incluye enlace ni ruta.
   - **Plazo:** hay «hito» pero ninguna fecha límite. La prioridad es «Media» y a la vez bloquea la lectura automática.
   - **Línea base:** «sin dato» en las tres cifras, así que el éxito (§4) no tiene objetivo.
   - **Frecuencia semanal:** «consultan cada semana» no tiene fuente.
7. **Alcance.** «No incluye» deja huecos que Dani rellenaría con suposiciones.
   - **Cuentas internas y de prueba:** no se mencionan.
   - **Formato del contrato HTTPS:** no se define.
   - **Rotación de la credencial:** no se define.
   - **Captura del origen:** queda abierta (bloqueante 3).
8. **Política Postin.**
   - **Datos de clientes:** no hay ninguno en el documento.
   - **API de LinkedIn:** §10 se limita a la API oficial.
   - **Cifras:** no hay ninguna inventada, y las que faltan figuran como «sin dato».
   - **Tuteo:** el documento no usa «usted» ni «vos». No hay segunda persona, así que no incumple.

## Preguntas que haría Dani

1. ¿«Persona» es usuario, cuenta o workspace? ¿Excluyo cuentas internas, de prueba y de demo? (bloqueante 4)
2. ¿Qué día cuenta para «Activa»: el de la segunda condición? ¿Y si desconecta LinkedIn después? (bloqueante 4)
3. ¿«Post creado» incluye borradores o posts generados por IA? ¿«Publicó» es publicado en LinkedIn o también programado?
4. Si alguien se da de baja, ¿su recuento pasado baja o se conserva? (bloqueante 1)
5. ¿Hay umbral mínimo por fila, o acepto filas de 1 persona? (bloqueante 2)
6. Si el origen del alta no existe, ¿construyo captura o entrego todo en vacío? (bloqueante 3)
7. ¿Qué hago con un origen que no sea uno de los cuatro: lo mando a vacío o lo rechazo? ¿Cuáles son las cadenas exactas?
8. «Vacío» en `canal`: ¿cadena vacía, nulo o ausente?
9. Si cambia el canal de una persona después, ¿se reescribe la fila histórica?
10. ¿Desde qué fecha hay histórico fiable? ¿Qué devuelvo antes de esa fecha?
11. ¿Una o dos direcciones HTTPS? ¿Qué formato de respuesta (JSON, CSV)? ¿Hay paginación?
12. ¿Cómo se identifica Nokko con la credencial? ¿Cómo se rota sin cortar el servicio?
13. ¿Incluyo el día en curso (parcial) y lo marco como tal? ¿Por qué UTC y no hora de Madrid?
14. ¿Qué volumen y qué frescura esperas de una lectura diaria, y qué hago si falla?

## Límites de esta auditoría

- Solo he leído el SDD indicado. No he leído el PRD de la torre de control ni `SDD-20261031-gtm-control-tower-8-postin-views-nokko`. No he podido comprobar la evidencia de §3 ni que el contrato de Nokko cuadre con este SDD.
- No he usado el repo `Postinapp/postin-linkedin-connector`: no sé si Postin guarda el origen del alta, qué datos hay detrás de «Activa» y «Publicó» ni desde cuándo hay histórico. Nada de eso está verificado.
- No he medido ninguna cifra contra la base de datos.
- La DoR de Dani es provisional y no validada, así que su resultado (✘) es orientativo.
- El linter lo aplicó el autor a mano. No he comprobado su resultado.
- No he editado ni creado ningún archivo.
