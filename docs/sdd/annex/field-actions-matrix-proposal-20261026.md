# Propuesta · matriz de acciones, «en uso», archivar y deshacer (SDD field-actions-edit-delete-confirm)

Estado: propuesta para que Fede decida antes de implementar. Base: código de la rama `feat/field-actions-edit-delete-confirm` (parte de `feat/universal-field-definitions`). La auditoría marcó estos puntos como pendientes de escribir en el SDD: matriz elemento × acción × rol, qué es «en uso» y «archivar», y si editar siempre confirma.

## 1. Lo que he verificado en el código (secciones 3 y 15 del SDD)
| Punto del SDD | Resultado |
|---|---|
| «ICP y pilares: no hay edición ni borrado» | **Contradice el código en la edición.** `icp-editor.tsx` edita y guarda un ICP (botón «Guardar ICP») y los pilares se editan en línea (`positioning.tsx`, `messaging_pillars.update`). Lo que no existe es **borrar o archivar** ICP y pilares. El SDD debe corregir «solo crear» por «crear y editar». |
| Fuentes del onboarding se reemplazan al añadir archivos | **Real.** `onFiles` hace `setFiles(read.filter(...))`: cada selección sustituye la lista anterior (los textos y nombres sí se acumulan). No hay forma de quitar una fuente. |
| Vías ocultas de borrado de ICP y pilares | No hay ninguna: el único borrado de estrategia que encuentro es el de segmentos (`strategy/motions.tsx`). |
| Uso real del deshacer | Sin dato. `undoSetupItems` solo borra lo que creó un guardado (solo Owner), y se usa en el asistente de IA y en los bloques del onboarding. No hay plazo de 24 horas: hoy no caduca. |
| Rol para borrar | Por RLS, en `segments`, `icp_profiles`, `positioning` y `messaging_pillars` **cualquier miembro** lee, crea y edita; **solo el Owner** borra. |

## 2. Matriz propuesta (hoy, según RLS y herramientas del Agente)
| Elemento | Editar | Borrar | Archivar | Confirmar | Roles que lo pueden hacer hoy |
|---|---|---|---|---|---|
| Segmento | sí (existe) | sí (existe, Owner) | no existe | no existe | editar: cualquier miembro; borrar: Owner; Agente `upsert_segment`: owner, sales_leader |
| ICP | sí (existe) | no existe | no existe | no existe | editar: cualquier miembro; borrar: Owner; Agente `create_icp`: owner, sales_leader, marketing |
| Posicionamiento (una fila por empresa) | sí (existe) | no (se vacía, no se borra) | no aplica | no existe | editar: cualquier miembro; Agente `update_positioning`: owner, sales_leader, marketing |
| Pilar de mensaje | sí (existe) | no existe | no existe | no existe | editar: cualquier miembro; borrar: Owner; Agente `create_pillar`: owner, sales_leader, marketing |
| Fuente del onboarding | no aplica | no existe (a crear) | no aplica | no aplica | quien hace el onboarding |
| Hallazgo de lectura | no existe | no existe (descartar) | no aplica | por bloque, no por campo | quien hace el onboarding |

Propuesta de regla de rol: **editar y confirmar los puede cualquier miembro (como hoy); borrar solo el Owner (como hoy, lo impone la RLS).** Para un miembro sin permiso el botón «Borrar» se muestra desactivado con «Solo el Owner puede borrar» (CA-7). El Agente aplica las mismas reglas: sus herramientas de escritura ya tienen `roles`.

## 3. «En uso» y «archivar»
Propuesta de definición de «en uso» (CA-6), por elemento, solo con lo que el esquema y el código ya muestran:
- **Segmento:** en uso si lo referencian cuentas, deals, leads, ICP, objetivos, presupuestos o costes de adquisición. Cuidado: borrarlo **borra en cascada** objetivos, presupuestos y costes, y deja sin segmento (`set null`) cuentas, deals y leads. Hoy se puede hacer sin aviso de uso.
- **ICP:** en uso si es el ICP de un segmento con cuentas o leads (el scoring y Descubiertos lo leen por segmento). No tiene claves ajenas entrantes.
- **Pilar:** no tiene dependencias en la base de datos; lo leen la narrativa y las plantillas. «En uso» no se puede medir sin dato: propongo avisar solo de que alimenta los mensajes.
- **Archivar:** hoy no existe en ninguna de estas tablas. Hacerlo con una columna `archived_at` obliga a que **todas** las lecturas de ICP, pilares y segmentos filtren los archivados (decenas de consultas). Propongo **no** crear `archived_at`; ver el punto 4.

## 4. Deshacer durante 24 horas (decidido por Fede) sin tocar las lecturas
Propuesta: un registro genérico de cambios, `field_edit_log` (empresa, tabla, fila, antes, después, quién, cuándo), alimentado por un disparador en `segments`, `icp_profiles`, `positioning` y `messaging_pillars`.
- **Deshacer una edición:** se restaura el valor «antes» si la fila no ha cambiado desde entonces.
- **Deshacer un borrado:** se vuelve a crear la fila con su «antes». Por eso un segmento **en uso no se borra** (CA-6): sus datos en cascada no se recuperarían. En su lugar se avisa y se ofrece reasignar o dejarlo.
- **Archivar** queda como «borrar con deshacer de 24 horas» para ICP y pilares, sin columna nueva.
- Pasadas 24 horas el deshacer informa de que ya no es posible (SDD §8). Quién deshace: el que pueda borrar o editar ese elemento.
- Requiere una **migración nueva** (tabla y disparador) que, como la 0058, no puedo verificar aquí: iría sin aplicar y marcada así.

## 5. Confirmación por campo (CA-8 a CA-10)
Hoy solo `accounts` tiene procedencia por campo (`field_sources`); `icp_profiles` la recibe con la migración 0058 (verificada después en local). Para confirmar campo a campo en posicionamiento, pilares y segmentos hace falta la misma columna en esas tablas. Propongo ampliar el alcance de procedencia a `positioning`, `messaging_pillars` y `segments` **solo si confirmas**, porque tocaría de nuevo el esquema.

## 6. Decisiones que necesito de Fede
1. ¿Aceptas la matriz de roles (editar y confirmar: cualquier miembro; borrar: solo Owner, como hoy)?
2. ¿Aceptas «en uso» como se define arriba, incluido que un **segmento en uso no se borre** y el aviso del borrado en cascada?
3. ¿Aceptas no crear `archived_at` y resolver el archivado con un registro de cambios con deshacer de 24 horas?
4. ¿Se amplía la procedencia por campo a `positioning`, `messaging_pillars` y `segments` (migración nueva)?
5. ¿Editar siempre confirma? Propongo que sí: lo que escribe una persona queda «escrito por ti · confirmado» sin un clic extra (SDD universal CA-8), y «Confirmar» se usa para lo que propuso NOKKO.

## 7. Límites
Sin base de datos ni producción: las políticas de acceso salen de las migraciones del repo (`0002_multitenant_organizations.sql`), no de la base real. Si alguna política se cambió a mano, la matriz de roles podría diferir. Sin datos de uso.
