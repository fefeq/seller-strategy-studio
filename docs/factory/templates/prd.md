# PRD-{AAAAMMDD}-{slug} · [{Feature|Iniciativa}] {título}

**Tipo:** {Feature | Iniciativa} · **Prioridad propuesta:** {Alta | Media | Baja} (con el motivo, sin cifras inventadas)
**Estado:** Borrador · **Pide:** {humano} · **Aprueba:** Fede · **Fecha:** {AAAA-MM-DD}
**SDD que lo desarrollan:** {rutas de `docs/sdd/`, o «pendiente»}

> Un PRD dice qué se quiere y por qué. No dice cómo se construye ni cómo se prueba: eso es del SDD.
> Una página para una feature; para una iniciativa, añade el orden y las dependencias entre SDD.

## 1. Problema
{Qué le pasa a quién, en dos o tres frases. Sin solución.}

## 2. Para quién
{Rol afectado (por ejemplo founder, Owner, miembro). Sin nombres ni datos de clientes.}

## 3. Evidencia y por qué ahora
{Qué se ha mirado y dónde (archivo, pantalla, conversación). Si no hay datos de uso, escribe «sin dato» y declara la apuesta.}

## 4. Objetivos
| ID | Objetivo | Cómo se mide | Línea base | Fuente |
|---|---|---|---|---|
| G-1 | {resultado para el usuario} | {métrica} | {valor medido o «sin dato»} | {base de datos / archivo / «se medirá tras el lanzamiento»} |

Nunca pongas una línea base estimada. Si no existe, «sin dato».

## 5. No-objetivos
{Qué queda fuera de esto, aunque parezca cercano.}

## 6. Decisiones tomadas y abiertas
| Tema | Decisión | Quién y cuándo |
|---|---|---|
| {tema} | {decisión o «abierta»} | {humano, fecha} |

## 7. Riesgos y dependencias
{Otros PRD o SDD, proveedores, datos que faltan, decisiones de producto pendientes.}

## 8. Orden de entrega (solo iniciativas)
| # | SDD | Tipo | Depende de | Cubre |
|---|---|---|---|---|
| 1 | {SDD-…} | {Feature/Mejora} | — | G-1 |

## 9. Aprobación
- [ ] Fede aprueba el PRD (primer GO de dirección). Fecha: {…}
- Al aprobar, el Estado pasa a «Aprobado». Después se redactan los SDD con `nokko-shape`.
