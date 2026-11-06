# SDD-20261031-nokko-aggregate-views · [Feature] Vistas agregadas de solo lectura de Postin para Nokko

**Tipo:** Feature · **Prioridad propuesta:** Media
**Estado:** Borrador · **Pide:** Fede · **Para:** Dani · **Fecha:** 2026-10-31

## 1. Resumen
Fede necesita que Nokko, su herramienta interna de estrategia go-to-market, pueda leer cuántas personas alcanzan las etapas «Activa» y «Publicó» de Postin, por día y por canal de origen, sin recibir ningún dato personal. Para ello hace falta que Postin ofrezca dos vistas agregadas de solo lectura y una credencial que solo permita consultarlas. Nokko construye su lado; este SDD cubre solo lo que toca la base de datos y el acceso de Postin.

## 2. Problema y para quién
Hoy esas dos cifras se teclean a mano en Nokko, así que los resultados clave de activación nacen sin dato o desactualizados. El perfil afectado es el fundador (Fede) y la responsable comercial (Flor), que consultan esos resultados cada semana. Postin es el único cliente de estas vistas.

## 3. Evidencia y por qué ahora
- Decisión de Fede (2026-10-29 a 31, PRD de la torre de control GTM, §6.1): las vistas agregadas de solo lectura de la base de Postin las prepara Dani; hasta entonces «Activa» y «Publicó» se rellenan a mano.
- Hito: el lado de Nokko está especificado en `SDD-20261031-gtm-control-tower-8-postin-views-nokko` y la lectura automática de «Activa» y «Publicó» no puede entregarse sin este SDD.
- Cuántas personas alcanzan hoy cada etapa: sin dato (no se ha medido para este SDD).

## 4. Resultado buscado
Que Nokko lea cada día los recuentos de «Activa» y «Publicó» por canal sin intervención manual. Medición: resultados clave de Nokko con fuente automática de Postin frente a manuales; línea base: sin dato; fuente: Nokko.

## 5. Alcance
**Incluye:**
- Dos vistas agregadas de solo lectura: personas que alcanzan «Activa» por día y canal, y personas que alcanzan «Publicó» por día y canal.
- Una credencial que solo permita leer esas dos vistas y nada más.
- Entregar esa credencial a Fede por un canal seguro.

**No incluye:**
- Ningún dato personal: ni identificadores, ni correos, ni nombres, ni textos, ni perfiles de voz.
- Otras etapas (alta, prueba, pago) ni ingresos.
- Cambios en la aplicación de Postin, en Stripe o en el seguimiento de eventos, salvo los que hagan falta para saber el canal de origen (se decide en «Preguntas para Dani»).
- La lectura, la programación y el almacenamiento del lado de Nokko.

## 6. Cambios de comportamiento (delta)
**Añadido:** dos vistas agregadas de solo lectura y una credencial de solo lectura.
**Modificado:** nada de lo que ya existe.
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como fundador de Postin, quiero que Nokko lea las cifras de «Activa» y «Publicó» por día y canal para no teclearlas.
- CA-1: El sistema DEBE ofrecer una vista con una fila por día y canal que indique cuántas personas distintas alcanzaron «Activa» por primera vez ese día.
- CA-2: El sistema DEBE ofrecer una vista con una fila por día y canal que indique cuántas personas distintas alcanzaron «Publicó» por primera vez ese día.
- CA-3: El sistema DEBE devolver en cada vista exactamente tres campos llamados dia (fecha en UTC), canal (texto) y personas (número entero mayor que cero), y ningún otro.
- CA-4: El sistema DEBE contar «Activa» cuando la persona tiene LinkedIn conectado y ha creado un post, y «Publicó» cuando publica su primer post.
- CA-5: El sistema DEBE devolver como canal uno de estos cuatro valores —LinkedIn orgánico, Outbound, Contenido y SEO, Partners y eventos—, o vacío cuando no se conozca el origen.
- CA-6: CUANDO una persona alcanza una etapa, el sistema DEBE contarla una sola vez, en el día en que la alcanzó por primera vez, y NO DEBE volver a contarla aunque repita la acción.

### H-2: Como fundador de Postin, quiero que ningún dato personal salga de Postin hacia Nokko.
- CA-7: El sistema DEBE ofrecer una credencial que solo permita consultar esas dos vistas, y NO DEBE permitir con ella leer, crear, cambiar ni borrar nada más.
- CA-8: SI una persona se da de baja o pide borrar sus datos, ENTONCES el sistema DEBE seguir sin exponer ningún dato suyo en las vistas, y su aportación a un recuento pasado puede mantenerse solo como número agregado.
- CA-9: El sistema DEBE devolver solo las filas con al menos una persona y DEBE omitir los días y canales sin personas.
- CA-10: El sistema DEBE servir las dos vistas por HTTPS protegidas por la credencial, con el formato descrito en «Datos, permisos y privacidad», y DEBE devolver en cada lectura el recuento actual completo de todos los días disponibles, no solo los cambios.
- CA-11: El sistema DEBE llamar a las dos vistas «Activa por día y canal» y «Publicó por día y canal», para que Nokko las identifique.

## 8. Casos límite y errores
- Día sin ninguna persona que alcance la etapa → no hay fila (CA-9).
- Persona sin canal de origen conocido → cuenta en el canal vacío (CA-5).
- Un recuento pasado baja por una baja de persona → la siguiente lectura devuelve el recuento actual completo (CA-10).
- Persona que repite la acción que da la etapa → no se vuelve a contar (CA-6).
- Persona dada de baja → ningún dato suyo expuesto (CA-8).
- Credencial usada para consultar algo que no sean las dos vistas → el acceso se rechaza (CA-7).
- Credencial perdida o expuesta → Dani la revoca y entrega otra; las vistas siguen igual (CA-7).

## 9. Experiencia y copy
No aplica: no hay pantallas ni textos de producto de Postin.

## 10. Datos, permisos y privacidad
- **Datos que se exponen:** solo recuentos agregados por día y canal. No se expone ningún dato personal ni de clientes.
- **Formato de lectura (restricción de Fede, necesaria para el lado de Nokko):** cada vista se pide con una petición HTTPS GET a su ruta (`/activa` y `/publico`), con la credencial en la cabecera `Authorization: Bearer <credencial>`. La respuesta válida es `200` con un cuerpo JSON `{"filas":[{"dia":"AAAA-MM-DD","canal":"…","personas":3}]}`, completo en cada lectura; sin filas es `200` con `"filas":[]`. El tipo de contenido es `application/json`, `dia` es una fecha real del calendario y una credencial rechazada se responde con `401` o `403`. `canal` es un nombre del catálogo de cuatro (LinkedIn orgánico, Outbound, Contenido y SEO, Partners y eventos) o la cadena vacía.
- **Permisos:** una sola credencial de solo lectura, limitada a las dos vistas, que usa Nokko para la organización de Postin.
- **Planes afectados:** ninguno.
- **LinkedIn:** no se pide nada nuevo a LinkedIn; «Activa» y «Publicó» se calculan con los datos que Postin ya tiene (solo API oficial).

## 11. Unidades de trabajo
- U-1: las dos vistas y su servicio por HTTPS (CA-1 a CA-6, CA-9 a CA-11).
- U-2: la credencial de solo lectura y su entrega a Fede (CA-7, CA-8; depende de U-1).

## 12. Notas técnicas [Sugerencia — Dani valida]
- Nokko solo lee por HTTPS (decisión de Fede, 2026-10-31): Dani decide cómo se sirven las vistas por esa dirección y cómo se limita la credencial. El lado de Nokko se escribe contra un puerto y admite cualquier implementación que cumpla el contrato.
- Para el canal de origen, lo más simple sería reutilizar la fuente de captación que Postin ya guarde en el alta, si existe.
- Conviene que las vistas aguanten una lectura diaria sin carga relevante; no hace falta tiempo real.

## 13. Riesgos y dependencias
- Depende de que Postin conserve el origen de cada alta; si no lo conserva, casi todo caerá en el canal vacío y Nokko lo mostrará como «Sin atribuir».
- El recuento del día en curso crece durante el día; Nokko lo sustituye en cada lectura y no lo suma.
- La entrega de la credencial es manual y debe hacerse por un canal seguro.

## 14. Preguntas para Dani
1. ¿Postin guarda hoy el origen o canal de cada alta? ¿Con qué valores?
2. ¿Qué datos de producto corresponden exactamente a «LinkedIn conectado», «post creado» y «primer post publicado»?
3. ¿Hasta qué fecha hacia atrás pueden calcularse los recuentos?
4. ¿Cómo prefieres entregar la credencial a Fede y cómo se rota?
5. ¿Qué carga soportan las vistas con una lectura diaria?

## 15. Pendiente de verificar
- [Por verificar] Que Postin conserva el origen de cada alta → Dani.
- [Por verificar] Equivalencia entre las definiciones de «Activa» y «Publicó» y los datos de producto → Dani.
- [Por verificar] Cuántas personas alcanzan hoy cada etapa → base de datos de Postin, sin dato.

## 16. Sección de Dani (la completa él)
- Diseño técnico:
- Tareas:
- Estimación:
- Decisión: Aceptado / Cambios pedidos / Rechazado

---
Validación: pendiente de auditoría (linter y revisión independiente).
