> **[SUPERADO]** El 2026-10-31 Fede eligió `docs/sdd/SDD-20261031-nokko-aggregate-views.md` (recuentos por día y canal, sin clave de persona) como único SDD para Dani; este contrato (una fila por organización con cuatro fechas y aviso de alta) no encaja con esa decisión. Se conserva con su auditoría.

# SDD-20261031-nokko-activation-data-feed · [Feature] Datos de activación de Postin para Nokko (SDD-8 de la torre de control)

**Tipo:** Feature · **Prioridad propuesta:** Media
**Estado:** Borrador (v2, tras la primera auditoría independiente) · **Pide:** Fede · **Para:** Dani · **Fecha:** 2026-10-31

## 1. Resumen
Nokko, la torre de control de Fede, necesita saber cuándo cada organización de Postin se activó y publicó, sin datos personales, para medir el embudo de crecimiento. Hoy esos datos se escriben a mano. Se pide a Dani una **fuente de solo lectura con cuatro fechas por organización** y un **aviso de alta** a Nokko con un identificador opaco, para que Nokko los lea automáticamente.

## 2. Problema y para quién
Fede (Owner de Nokko) tiene que apuntar a mano cuándo una organización de Postin pasa a «Activa» (LinkedIn conectado y un post creado) y a «Publicó» (primer post publicado). Es lento, se olvida y no permite medir el embudo por canal. Afecta a la medición del crecimiento de Postin; no afecta al producto que ve el usuario.

## 3. Evidencia y por qué ahora
- **Código (repo `Postinapp/postin-linkedin-connector`, solo lectura, 2026-10-31; verificado por la auditoría independiente):**
  - Existen `social_accounts` y `social_connections` (LinkedIn por organización; `usable_since` es el último paso a utilizable, no el primero), `content_items` (cada contenido cuelga de una cuenta de LinkedIn) y `draft_versions`, `publication_schedules` y `publication_attempts` (estado `succeeded` y fecha de finalización), `first_post_sessions`, `child_accounts` (toda organización tiene al menos una cuenta gestionada) y `subscriptions` (una por organización).
  - No existe hoy una marca de organización interna o de prueba; solo hay una convención en producción: las cuentas de prueba usan correos de un dominio de pruebas (`docs/PRUEBAS.md`).
  - No hay un mecanismo de aviso saliente por evento con reintentos; hay tareas programadas con secreto, el envío de correo y una sincronización horaria de contactos a un servicio de correo.
- **Decisiones de Fede (2026-10-29 a 31, PRD de la torre de control):** vistas agregadas de solo lectura de la base de Postin, preparadas por Dani; «Activa» y «Publicó» se rellenan a mano, con origen marcado, hasta que Dani entregue la fuente.
- **Decisiones de Fede para este SDD (2026-10-31):**
  - un identificador opaco por organización, que Nokko guarda en la prueba; el aviso de alta de Postin a Nokko lo entrega;
  - cuatro fechas por organización: alta, primera conexión de LinkedIn, primer contenido creado y primer post publicado;
  - solo etapas por ahora: sin uso semanal ni retención;
  - una fila por organización, con sus cuentas gestionadas dentro, y una fila por cada organización aunque sea de la misma persona;
  - «post creado» es el primer contenido creado;
  - el alta es la creación de la organización, y las fechas son día en UTC;
  - se excluyen las organizaciones internas o de prueba, que se reconocen por una lista cerrada de dominios del correo de quien crea la organización, en el momento del alta;
  - el aviso de alta lleva el dominio de correo corporativo, vacío si es gratuito, con el riesgo declarado en la sección 13;
  - las organizaciones que ya existen entran en la fuente y Nokko solo las usa cuando Fede pega su identificador en la prueba; las archivadas siguen con sus fechas ya fijadas;
  - actualización diaria, no en tiempo real.
- **Uso real:** la medición actual es manual; no hay dato de volumen. **Apuesta declarada:** se mide tras entregar la fuente con la métrica de la sección 4.

## 4. Resultado buscado
- Las etapas «Activa» y «Publicó» de Nokko se alimentan de forma automática para las organizaciones nuevas y para las existentes que Fede ligue. Medición: proporción de recorridos con dato automático en esas etapas (fuente: Nokko). Línea base: 0, porque hoy son manuales por decisión de Fede.
- Ninguna fila ni aviso contiene datos personales (medición: las pruebas de CA-4 y CA-13).

## 5. Alcance
**Incluye:** H-1 y H-2.
**No incluye:**
- Textos de posts, voces, perfiles, nombres, correos completos, tokens, importes ni ningún dato personal de clientes.
- Ingresos, MRR, cobros o cambios de plan (los lee Nokko de Stripe).
- Uso semanal, retención o cualquier otra métrica distinta de las cuatro fechas.
- La lectura de PostHog (sigue como está).
- Cambios en lo que ve o hace el usuario de Postin: altas, conexión de LinkedIn, creación, programación, publicación y cobro.
- La lectura y la recepción en Nokko (las define la torre de control de Nokko, que entregará a Dani la dirección y el secreto del receptor por un canal seguro, no en este documento).
- Un aviso masivo de las organizaciones que ya existen: nunca recibieron aviso.

## 6. Cambios de comportamiento (delta)
**Añadido:** una fuente de solo lectura con cuatro fechas por organización; una marca de organización interna o de prueba fijada en el alta; un aviso de alta a Nokko con un identificador opaco.
**Modificado:** el flujo de alta de organización, que además fija la marca y dispara el aviso sin cambiar nada de lo que ve el usuario.
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
Cada criterio se prueba con datos ficticios.

### H-1: Como Fede, quiero que Nokko lea cuándo cada organización de Postin se activó y publicó, sin datos personales.
- CA-1: El sistema DEBE ofrecer una fuente de solo lectura con una fila por organización de Postin, incluidas las que ya existen y las archivadas, que contenga su identificador opaco, la fecha de alta (la de creación de la organización), la fecha de la primera conexión de LinkedIn, la fecha del primer contenido creado y la fecha del primer post publicado, todas como día en UTC y vacías mientras no hayan ocurrido.
- CA-2: El sistema DEBE contar una organización una sola vez aunque tenga varias cuentas gestionadas, y DEBE tomar como cada fecha la primera entre todas sus cuentas; un mismo perfil de LinkedIn presente en dos organizaciones cuenta en las dos.
- CA-3: El sistema DEBE fijar en el momento del alta de cada organización una marca de interna o de prueba cuando el dominio del correo de quien la crea esté en una lista cerrada de dominios mantenida por Postin, DEBE excluir de la fuente las organizaciones marcadas y DEBE abstenerse de cambiar la marca después del alta.
- CA-4: El sistema DEBE abstenerse de exponer en la fuente textos de posts, voces, perfiles, nombres, correos, tokens, importes o cualquier dato personal de clientes, incluidos sus resúmenes o huellas.
- CA-5: El sistema DEBE dar a cada organización un identificador opaco que no permita deducir su nombre ni su correo y que no cambie con el tiempo ni al rotar una credencial o un secreto.
- CA-6: El sistema DEBE permitir leer la fuente solo con una credencial de solo lectura propia de esta fuente, revocable, distinta de las que usa Postin en producción, y DEBE impedir cualquier escritura con ella.
- CA-7: El sistema DEBE actualizar la fuente al menos una vez al día y DEBE indicar en cada lectura la fecha y la hora de su última actualización.
- CA-8: El sistema DEBE conservar la fecha de la primera conexión de LinkedIn aunque la conexión se desconecte o se renueve después.
- CA-9: SI una organización se borra en Postin, ENTONCES el sistema DEBE dejar de ofrecerla en la fuente; una organización archivada DEBE seguir en la fuente con las fechas que ya tuviera.
- CA-10: El sistema DEBE mantener fija cada fecha una vez establecida, aunque el contenido o el post que la originó se borre o se archive después.
- CA-11: El sistema DEBE dar una fila, un identificador y un aviso distintos a cada organización, aunque varias pertenezcan a la misma persona.

### H-2: Como Fede, quiero que Postin avise a Nokko de cada alta nueva con un identificador opaco, para ligarla a su prueba.
- CA-12: CUANDO una organización se da de alta en Postin y no está marcada como interna o de prueba, el sistema DEBE enviar a Nokko un aviso con su identificador opaco (CA-5), la fecha de alta y el dominio de correo de quien la crea, que DEBE quedar vacío si es un dominio gratuito de una lista cerrada mantenida por Postin.
- CA-13: El sistema DEBE abstenerse de incluir en el aviso nombres, correos completos, textos o cualquier otro dato personal.
- CA-14: SI el envío del aviso falla, ENTONCES el sistema DEBE reintentarlo según la política que fije Postin, DEBE registrar cada fallo, DEBE permitir reenviarlo a mano y DEBE abstenerse de retrasar o impedir el alta o de afectar al usuario.
- CA-15: El sistema DEBE autenticar el aviso con un secreto propio de este canal, revocable, y DEBE hacer que enviarlo más de una vez sea inocuo porque lleva siempre el mismo identificador.
- CA-16: El sistema DEBE abstenerse de enviar el aviso desde los entornos que no son producción y para las organizaciones marcadas como internas o de prueba.
- CA-17: El sistema DEBE mantener sin cambios todo lo que ve y hace el usuario en Postin (altas, conexión de LinkedIn, creación, programación y publicación de posts, y cobro).

## 8. Casos límite y errores
Cada caso remite al criterio que lo cubre.
- Organización con varias cuentas gestionadas → una sola fila, con las primeras fechas (CA-2).
- Un mismo perfil de LinkedIn en dos organizaciones → cuenta en las dos (CA-2).
- Organización de una persona con otra organización → fila, identificador y aviso distintos (CA-11).
- Organización interna o de prueba → ni en la fuente ni aviso de alta; la marca se fija en el alta (CA-3, CA-16).
- Organización que aún no ha conectado LinkedIn, creado contenido o publicado → fechas vacías (CA-1).
- LinkedIn desconectado o renovado después → la primera fecha se conserva (CA-8).
- Post o contenido borrado o archivado después → la fecha ya fijada no se mueve (CA-10).
- Organización borrada → deja de aparecer; archivada → sigue con sus fechas (CA-9).
- Organización que ya existía antes de esta entrega → está en la fuente y no recibe aviso (CA-1).
- Propietario con correo gratuito → el aviso lleva el dominio vacío (CA-12).
- Fallo al enviar el aviso → reintento, registro y reenvío manual, sin afectar al alta (CA-14).
- Aviso repetido → inocuo por su identificador (CA-15).
- Alta en un entorno que no es producción → sin aviso (CA-16).
- Credencial o secreto filtrados → se revocan sin afectar a Postin ni cambiar el identificador (CA-5, CA-6, CA-15).
- Textos, voces, correos completos o cualquier dato personal → no existen en la fuente ni en el aviso (CA-4, CA-13).
- La fuente tarda en actualizarse → cada lectura indica la hora de su última actualización (CA-7).

## 9. Experiencia y copy
No hay pantallas ni textos nuevos para el usuario de Postin: este cambio no se ve. En Nokko, cada etapa alimentada por esta fuente mostrará su origen y su antigüedad (SDD 4a de la torre de control).

## 10. Datos, permisos y privacidad
- **Datos que salen de Postin:** un identificador opaco por organización y cuatro fechas como día en UTC (CA-1); en el aviso de alta, ese identificador, la fecha de alta y el dominio de correo corporativo de quien crea la organización (CA-12). Nada más.
- **Datos que no salen:** textos, voces, perfiles, nombres, correos completos, tokens, importes (CA-4, CA-13).
- **Permisos:** una credencial de solo lectura propia y un secreto propio del aviso, ambos revocables (CA-6, CA-15). No se usan permisos de LinkedIn nuevos: solo se lee si hay conexión y su fecha.
- **Planes y precios:** ninguno se ve afectado (CA-17).
- **Privacidad:** el identificador opaco liga una organización con su prueba en Nokko, y el dominio corporativo permite ligar el alta a una cuenta; en una consultora de una sola persona el dominio puede identificar a la persona, riesgo declarado en la sección 13. Ninguna prueba ni ejemplo usa datos de clientes.

## 11. Unidades de trabajo
- U-1: Fuente de solo lectura con las cuatro fechas por organización, marca de interna o de prueba fijada en el alta, identificador opaco, credencial propia y actualización diaria (cubre H-1: CA-1 a CA-11).
- U-2: Aviso de alta a Nokko con identificador opaco, secreto propio, reintento y reenvío (cubre H-2: CA-12 a CA-17; depende de U-1 por el identificador y la marca).

## 12. Notas técnicas [Sugerencia — Dani valida]
- **Fuente:** unas vistas de solo lectura sobre las tablas que ya existen, con un rol de base de datos propio que solo pueda leerlas. Una fila por organización agregando las cuentas gestionadas (`child_accounts`); `social_connections` cuelga de `social_accounts` y `publication_attempts` se llega a la organización por `content_items` o `social_accounts`.
- **Fechas:** alta desde `organizations.created_at`; primera conexión de LinkedIn como el mínimo de `social_connections.created_at` (la reconexión hace upsert y conserva la fila; `usable_since` se reescribe en cada reconexión y no sirve); primer contenido creado como el mínimo de `content_items.created_at`; primer post publicado como el mínimo de la fecha de finalización de los intentos en estado `succeeded` (`publication_attempts.completed_at`). Todas se truncan a día en UTC.
- **Fecha fija (CA-10):** el borrado de borradores y la purga de archivados pueden eliminar el contenido que originó una fecha; hace falta guardar la fecha en un registro propio o calcularla de forma que no dependa de lo borrado **[Por verificar]**.
- **Marca de interna o de prueba (CA-3):** probablemente no existe y hay que crearla (cambio de modelo aditivo), fijada al crear la organización por el dominio del correo de quien la crea contra una lista cerrada; la convención actual es un dominio de correo de pruebas **[Por verificar]**.
- **Identificador opaco (CA-5):** `organizations.id` es un identificador aleatorio que no se deduce del nombre ni del correo; si se prefiere uno derivado con una clave, rotar la clave lo cambiaría y contradice CA-5: lo decide Dani.
- **Aviso (CA-12 a CA-16):** un envío saliente al alta, con reintentos y reenvío manual; no hay hoy un mecanismo saliente por evento, así que podría apoyarse en el patrón de la sincronización horaria de contactos o en una cola nueva **[Por verificar]**; solo en producción.
- **Destino en Nokko:** Nokko entregará a Dani la dirección, el formato y el secreto del receptor por un canal seguro; el contenido del aviso es el de CA-12.

## 13. Riesgos y dependencias
- Nokko (SDD 4a, unidad U-5 de la torre de control) está esperando esta entrega para leer «Activa» y «Publicó»; hasta entonces siguen siendo manuales. El receptor del aviso en Nokko aún no está especificado en un SDD de Nokko.
- El dominio de correo en el aviso puede identificar a una persona en una consultora de una sola persona, y combinado con las fechas exactas y con lo que Nokko ya lee de Stripe podría reidentificar a una organización. Fede lo aceptó (2026-10-31) con estas mitigaciones: dominio vacío si es gratuito y fechas solo como día en UTC.
- Una credencial de solo lectura filtrada daría acceso a fechas e identificadores opacos, no a datos personales (CA-4).
- El aviso de alta introduce un envío saliente nuevo; un fallo no debe afectar al alta (CA-14).
- Las organizaciones que ya existen no tienen aviso: Nokko solo puede ligarlas si Fede pega su identificador (decisión de Fede).
- La marca de interna o de prueba se fija en el alta: una organización creada antes de la entrega y de prueba aparece en la fuente hasta que se marque a mano **[Por verificar]**.

## 14. Preguntas para Dani
1. ¿Existe ya alguna marca o lista de dominios de pruebas que pueda servir para CA-3? ¿Quién mantiene la lista cerrada de dominios internos y la de dominios gratuitos?
2. ¿Qué identificador opaco prefieres: `organizations.id` o uno derivado?
3. Si se borra un contenido o se archiva, ¿cómo conservas la fecha fija de CA-10?
4. ¿Qué mecanismo de envío saliente con reintentos reutilizas o creas para el aviso, y qué política de reintentos fijas (CA-14)?
5. ¿Cómo y dónde guardas la credencial de solo lectura y el secreto del aviso, y cada cuánto se rotan?
6. ¿Cómo tratas las organizaciones ya creadas que son de prueba antes de que exista la marca?

## 15. Pendiente de verificar
- Existencia de una marca o lista de dominios de pruebas → Dani.
- Mecanismo de envío saliente con reintentos → Dani.
- Coste de actualizar la fuente a diario sobre el volumen real → Dani.
- Cómo conservar la fecha fija si el contenido se borra (CA-10) → Dani.
- Dirección, formato y secreto del receptor de Nokko → Fede (torre de control).

## 16. Sección de Dani (la completa él)
- Diseño técnico:
- Tareas:
- Estimación:
- Decisión: Aceptado / Cambios pedidos / Rechazado

---
Validación: v2 tras la primera auditoría independiente (bloqueantes resueltos con las decisiones de Fede del 2026-10-31); pendiente de linter y de segunda auditoría. Ningún mensaje a Dani hasta el OK de Fede.
