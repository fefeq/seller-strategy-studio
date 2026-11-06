# SDD-20261031-nokko-aggregate-views · [Feature] Vistas agregadas de solo lectura de Postin para Nokko

**Tipo:** Feature · **Prioridad propuesta:** Media
**Estado:** Borrador v2 (2026-11-06: recoge las decisiones de Fede sobre los cuatro bloqueantes de `AUDIT-20261031-nokko-aggregate-views`; sin nueva auditoría independiente) · **Pide:** Fede · **Para:** Dani · **Fecha:** 2026-10-31

## 1. Resumen
Fede necesita que Nokko, su herramienta interna de estrategia go-to-market, pueda leer cuántas personas alcanzan las etapas «Activa» y «Publicó» de Postin, por día y por canal de origen, sin recibir ningún dato personal. Para ello hace falta que Postin ofrezca dos vistas agregadas de solo lectura y una credencial que solo permita consultarlas. Nokko construye su lado; este SDD cubre solo lo que toca la base de datos y el acceso de Postin.

## 2. Problema y para quién
Hoy esas dos cifras se teclean a mano en Nokko, así que los resultados clave de activación nacen sin dato o desactualizados. El perfil afectado es el fundador (Fede) y la responsable comercial (Flor), que consultan esos resultados cada semana. Postin es el único cliente de estas vistas.

## 3. Evidencia y por qué ahora
- Decisión de Fede (2026-10-29 a 31, PRD de la torre de control GTM, §6.1): las vistas agregadas de solo lectura de la base de Postin las prepara Dani; hasta entonces «Activa» y «Publicó» se rellenan a mano.
- Hito: el lado de Nokko está especificado en `SDD-20261031-gtm-control-tower-8-postin-views-nokko` y la lectura automática de «Activa» y «Publicó» no puede entregarse sin este SDD.
- Cuántas cuentas alcanzan hoy cada etapa: sin dato (no se ha medido para este SDD).

**Decisiones de Fede, 2026-11-06** (respuestas a los bloqueantes de la auditoría):
1. **Baja:** el recuento se calcula en vivo; si una cuenta se da de baja, el recuento pasado baja. No se guarda histórico de recuentos.
2. **Umbral mínimo:** 5 cuentas por fila (día y canal). Es un parámetro de privacidad que fijó Fede, no una cifra medida.
3. **Origen del alta:** no se construye captura en Postin. El canal sale vacío hasta que otro SDD cubra la captura.
4. **Unidad y día:** la unidad es la **cuenta**. «Activa» cuenta el día en que se cumple la segunda de las dos condiciones y no se revierte. Las cuentas internas o de prueba se excluyen con una lista fija que entrega Fede fuera del repo.

## 4. Resultado buscado
Que Nokko lea cada día los recuentos de «Activa» y «Publicó» por canal sin intervención manual. Medición: resultados clave de Nokko con fuente automática de Postin frente a manuales; línea base: sin dato; fuente: Nokko.

## 5. Alcance
**Incluye:**
- Dos vistas agregadas de solo lectura: cuentas que alcanzan «Activa» por día y canal, y cuentas que alcanzan «Publicó» por día y canal.
- Una credencial que solo permita leer esas dos vistas y nada más.
- Entregar esa credencial a Fede por un canal seguro.
- Excluir de los recuentos las cuentas de una lista fija de cuentas internas o de prueba que entrega Fede (fuera de este repo y de este documento).

**No incluye:**
- Ningún dato personal: ni identificadores, ni correos, ni nombres, ni textos, ni perfiles de voz.
- Otras etapas (alta, prueba, pago) ni ingresos.
- Cambios en la aplicación de Postin, en Stripe o en el seguimiento de eventos. En particular, no se construye captura del origen del alta: el canal sale vacío hasta que otro SDD la cubra (decisión de Fede, 2026-11-06).
- La lectura, la programación y el almacenamiento del lado de Nokko.

## 6. Cambios de comportamiento (delta)
**Añadido:** dos vistas agregadas de solo lectura y una credencial de solo lectura.
**Modificado:** nada de lo que ya existe.
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como fundador de Postin, quiero que Nokko lea las cifras de «Activa» y «Publicó» por día y canal para no teclearlas.
- CA-1: El sistema DEBE ofrecer una vista con una fila por día y canal que indique cuántas cuentas distintas alcanzaron «Activa» por primera vez ese día.
- CA-2: El sistema DEBE ofrecer una vista con una fila por día y canal que indique cuántas cuentas distintas alcanzaron «Publicó» por primera vez ese día.
- CA-3: El sistema DEBE devolver en cada vista exactamente tres campos llamados dia (fecha en UTC), canal (texto) y personas (número entero de al menos 5; cuenta cuentas, no usuarios), y ningún otro. El nombre `personas` se mantiene por compatibilidad con el contrato que ya usa el lado de Nokko (ver pregunta 6 de «Preguntas»).
- CA-4: El sistema DEBE contar por cuenta, no por usuario ni por workspace. DEBE contar «Activa» el día en que se cumple la segunda de estas dos condiciones: la cuenta tiene LinkedIn conectado y ha creado un post. NO DEBE revertir «Activa» si después se desconecta LinkedIn. DEBE contar «Publicó» el día en que la cuenta publica su primer post.
- CA-5: Mientras no exista captura del origen del alta, el sistema DEBE devolver siempre `canal` como cadena vacía (`""`). Los cuatro valores reservados para cuando otro SDD añada la captura son «LinkedIn orgánico», «Outbound», «Contenido y SEO» y «Partners y eventos»; cualquier valor que no sea uno de ellos DEBE devolverse como cadena vacía.
- CA-6: CUANDO una cuenta alcanza una etapa, el sistema DEBE contarla una sola vez, en el día en que la alcanzó por primera vez, y NO DEBE volver a contarla aunque repita la acción.
- CA-12: El sistema DEBE excluir de todos los recuentos las cuentas de la lista fija de cuentas internas o de prueba que entrega Fede, y la lista NO DEBE guardarse en este repo ni en este documento.

### H-2: Como fundador de Postin, quiero que ningún dato personal salga de Postin hacia Nokko.
- CA-7: El sistema DEBE ofrecer una credencial que solo permita consultar esas dos vistas, y NO DEBE permitir con ella leer, crear, cambiar ni borrar nada más.
- CA-8: SI una cuenta se da de baja o pide borrar sus datos, ENTONCES el sistema DEBE dejar de contarla en todos los recuentos, incluidos los de días pasados (el cálculo es en vivo y no se guarda histórico de recuentos), y NO DEBE exponer ningún dato suyo.
- CA-9: El sistema DEBE devolver solo las filas con al menos 5 cuentas (umbral mínimo fijado por Fede el 2026-11-06) y DEBE omitir las filas con menos, incluidos los días y canales sin cuentas.
- CA-10: El sistema DEBE servir las dos vistas por HTTPS protegidas por la credencial, con el formato descrito en «Datos, permisos y privacidad», y DEBE devolver en cada lectura el recuento actual completo de todos los días disponibles, no solo los cambios.
- CA-11: El sistema DEBE llamar a las dos vistas «Activa por día y canal» y «Publicó por día y canal», para que Nokko las identifique.

## 8. Casos límite y errores
- Día con menos de 5 cuentas en la etapa, o ninguna → no hay fila (CA-9).
- Cualquier cuenta, sin captura del origen → cuenta en el canal vacío (CA-5).
- Un recuento pasado baja por la baja de una cuenta → la siguiente lectura devuelve el recuento actual completo (CA-8, CA-10).
- Cuenta que repite la acción que da la etapa → no se vuelve a contar (CA-6).
- Cuenta que desconecta LinkedIn después de ser «Activa» → sigue contada en el día en que lo fue (CA-4).
- Cuenta de la lista interna → no se cuenta (CA-12).
- Cuenta dada de baja → ningún dato suyo expuesto (CA-8).
- Credencial usada para consultar algo que no sean las dos vistas → el acceso se rechaza (CA-7).
- Credencial perdida o expuesta → Dani la revoca y entrega otra; las vistas siguen igual (CA-7).

## 9. Experiencia y copy
No aplica: no hay pantallas ni textos de producto de Postin.

## 10. Datos, permisos y privacidad
- **Datos que se exponen:** solo recuentos agregados de cuentas por día y canal, con un mínimo de 5 cuentas por fila. No se expone ningún dato personal ni de clientes.
- **Formato de lectura (restricción de Fede, necesaria para el lado de Nokko):** cada vista se pide con una petición HTTPS GET a su ruta (`/activa` y `/publico`), con la credencial en la cabecera `Authorization: Bearer <credencial>`. La respuesta válida es `200` con un cuerpo JSON `{"filas":[{"dia":"AAAA-MM-DD","canal":"…","personas":3}]}`, completo en cada lectura; sin filas es `200` con `"filas":[]`. El tipo de contenido es `application/json`, `dia` es una fecha real del calendario y una credencial rechazada se responde con `401` o `403`. `canal` es un nombre del catálogo de cuatro (LinkedIn orgánico, Outbound, Contenido y SEO, Partners y eventos) o la cadena vacía.
- **Permisos:** una sola credencial de solo lectura, limitada a las dos vistas, que usa Nokko para la organización de Postin.
- **Planes afectados:** ninguno.
- **LinkedIn:** no se pide nada nuevo a LinkedIn; «Activa» y «Publicó» se calculan con los datos que Postin ya tiene (solo API oficial).

## 11. Unidades de trabajo
- U-1: las dos vistas y su servicio por HTTPS (CA-1 a CA-6, CA-8 a CA-12).
- U-2: la credencial de solo lectura y su entrega a Fede (CA-7; depende de U-1).

## 12. Notas técnicas [Sugerencia — Dani valida]
- Nokko solo lee por HTTPS (decisión de Fede, 2026-10-31): Dani decide cómo se sirven las vistas por esa dirección y cómo se limita la credencial. El lado de Nokko se escribe contra un puerto y admite cualquier implementación que cumpla el contrato.
- Para el canal de origen, lo más simple sería reutilizar la fuente de captación que Postin ya guarde en el alta, si existe.
- Conviene que las vistas aguanten una lectura diaria sin carga relevante; no hace falta tiempo real.

## 13. Riesgos y dependencias
- Sin captura del origen del alta, todo caerá en el canal vacío y Nokko lo mostrará como «Sin atribuir». Es una decisión de Fede; la captura queda para otro SDD.
- **Riesgo del umbral:** con un mínimo de 5 cuentas por día y canal, y con un volumen que no se ha medido, es posible que muchos días no devuelvan ninguna fila y Nokko vea el recuento casi vacío. Hay que medir el volumen antes de dar por buena la fuente automática.
- El recuento del día en curso crece durante el día; Nokko lo sustituye en cada lectura y no lo suma.
- La entrega de la credencial es manual y debe hacerse por un canal seguro.

## 14. Preguntas para Dani
1. (Solo para el SDD futuro de captura del origen) ¿Postin guarda hoy el origen o canal de cada alta? ¿Con qué valores?
2. ¿Qué datos de producto corresponden exactamente a «LinkedIn conectado», «post creado» y «primer post publicado»? ¿«Post creado» incluye borradores o posts generados por IA, y «Publicó» incluye posts programados?
3. ¿Hasta qué fecha hacia atrás pueden calcularse los recuentos?
4. ¿Cómo prefieres entregar la credencial a Fede y cómo se rota?
5. ¿Qué carga soportan las vistas con una lectura diaria?
6. (Para Fede) El campo se llama `personas` pero cuenta cuentas. ¿Se renombra a `cuentas`? Cambiaría el contrato del lado de Nokko (`SDD-20261031-gtm-control-tower-8-postin-views-nokko`).
7. (Para Fede) ¿Se mantiene UTC para el día, o se usa la hora de Madrid? Y ¿se incluye el día en curso, marcado como parcial?

## 15. Pendiente de verificar
- [Por verificar] Equivalencia entre las definiciones de «Activa» y «Publicó» y los datos de producto → Dani.
- [Por verificar] Cuántas cuentas alcanzan hoy cada etapa y cuántas filas superarían el umbral de 5 → base de datos de Postin, sin dato.
- [Por verificar] Que la lista de cuentas internas que entregue Fede cubre todas las cuentas de prueba o de demo → Fede.
- [Por verificar] Desde qué fecha hay histórico fiable → Dani.

## 16. Sección de Dani (la completa él)
- Diseño técnico:
- Tareas:
- Estimación:
- Decisión: Aceptado / Cambios pedidos / Rechazado

---
Validación: v2 pendiente de auditoría independiente (`postin-sdd-audit`). Las cuatro decisiones de Fede resuelven los bloqueantes 1 a 4 de la auditoría anterior; los cambios menores y las preguntas 6 y 7 siguen abiertos.
