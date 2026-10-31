# SDD-{AAAAMMDD}-{slug} · [{Feature|Mejora|Bug}] {título}

**Tipo:** {Feature | Mejora | Bug} · **Prioridad propuesta:** {Alta | Media | Baja}
**Estado:** Borrador · **Pide:** {humano} · **Aprueba:** Fede · **Fecha:** {AAAA-MM-DD}
**PRD:** {ruta de `docs/prd/` o «No aplica (bug o mejora acotada)»} · **Depende de:** {SDD o «—»}

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre.
> Si el PRD existe, cada CA-n cita el objetivo G-n que cubre.

## 1. Resumen
{Qué se cambia, en tres frases.}

## 2. Problema y para quién
{Una línea del PRD, o el problema directamente si no hay PRD.}

## 3. Evidencia y por qué ahora
{Qué se ha leído y dónde. «Sin dato» si no hay datos de uso. Marca **[Por verificar]** lo que no hayas podido comprobar.}

## 4. Resultado buscado
{Métricas con fuente y línea base medida o «sin dato». Si hay PRD, referencia sus G-n en vez de repetirlos.}

## 5. Alcance
**Incluye:** {…}
**No incluye:** {…}  (es el límite que el brief copia a «Movimientos prohibidos»)

## 6. Cambios de comportamiento (delta)
**Añadido:** {…}
**Modificado:** {antes → después}
**Eliminado:** {…}

## 7. Historias y criterios de aceptación
### H-1: Como {rol}, quiero {acción} para {resultado}.
- **CA-1** {criterio observable} · cubre {G-n} · prueba: `{archivo de test}`
- **CA-2** {…}

## 8. Casos límite y errores
{Datos vacíos, duplicados, permisos, red caída, otra empresa (multitenant). Cada caso importante pasa a un CA.}

## 9. Experiencia y copy
{Textos de producto en español, «tú», sin iconos, estados con palabra. Errores con «qué pasó + qué hacer».}

## 10. Datos, permisos y privacidad
{Tablas y columnas nuevas, `org_id` con `current_org()`, RLS, GRANTs, quién puede hacer qué (roles por organización). Ningún dato de clientes en código, pruebas ni logs.}

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| {nombre o «ninguna»} | regla → caché → modelo barato → modelo caro (solo «A fondo») | {…} | {valor o «sin dato»} |

Una llamada no declarada aquí no se implementa.

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | {…} | CA-1, CA-2 | `{archivo}` |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
{Módulos a reutilizar, puntos del código, alternativas descartadas.}

## 14. Riesgos y dependencias
{…}

## 15. Preguntas para Fede y para la revisión técnica
{…}

## 16. Pendiente de verificar
{Lista de [Por verificar] con quién o qué puede comprobarlo (producción, proveedor externo, datos reales).}

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Un agente `nokko-gate` con contexto fresco lee este SDD y el código, y devuelve su informe. El coordinador lo copia aquí sin editarlo. El gate no aprueba el SDD: informa; la aprobación es de Fede.
- Veredicto del gate: {Sin objeciones | Objeciones | No revisado}
- CA sin prueba posible o sin G-n: {lista o «ninguno»}
- [Por verificar] que sigue sin comprobarse: {lista o «ninguno»}
- Contradicciones con el código o con decisiones previas: {lista o «ninguna»}
- Lo que esta revisión NO demuestra: {…}

## 18. Delta de implementación (lo rellena el agente al entregar)
{Qué difiere de lo escrito aquí, con fecha. Estado a «En curso» al empezar; «Hecho» solo cuando el gate pase y Fede apruebe la entrega.}
