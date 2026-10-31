# PRD-20261028-ux-onboarding-coherencia · [Iniciativa] UX de estrategia, onboarding y coherencia de campos

**Tipo:** Iniciativa · **Prioridad propuesta:** Alta (la base, `universal-field-definitions`, desbloquea al resto)
**Estado:** Aprobado (Fede, 2026-10-28); reconstruido ese día desde `docs/sdd/README.md` y los 12 SDD · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-28
**SDD que lo desarrollan:** los 12 de `docs/sdd/` (ver sección 8)

> Este PRD no añade decisiones nuevas: ordena en un solo sitio lo que ya estaba repartido entre el índice de `docs/sdd/README.md` y los 12 SDD. Cada objetivo G-n sale de la sección 4 de esos SDD; las métricas siguen sin línea base.

## 1. Problema
Los datos de estrategia de una empresa se piden, se editan y se confirman de formas distintas según la pantalla. Hay conceptos duplicados en el esquema, datos que se crean pero no se pueden corregir o quitar, un onboarding que no guía al siguiente paso y datos de encaje que faltan para enriquecer.

## 2. Para quién
Founder u Owner de una empresa que configura su estrategia, y el miembro que la usa a diario. Algunas piezas (conexiones y su gestión) son solo del Owner.

## 3. Evidencia y por qué ahora
- Inventario determinista del esquema, hecho sobre el código de `main`: 84 tablas, 1043 columnas, 35 jsonb y 48 estados en texto (`docs/sdd/annex/field-inventory-20261025.md`).
- Lectura del código, sin datos de uso: todas las líneas base de este PRD son «sin dato».
- `nokko.ai/discoveries` exige sesión: el análisis no se hizo sobre producción.
- Apuesta declarada: la prioridad se apoya en el código y en la petición de Fede, no en uso medido.

## 4. Objetivos
| ID | Objetivo | Cómo se mide | Línea base | Fuente |
|---|---|---|---|---|
| G-1 | Cada concepto de campo tiene una sola definición | Variantes duplicadas por concepto tras la migración = 0; un campo nuevo sin entrada en el catálogo falla la comprobación | Ver anexo; objetivo de reducción por concepto: lo fija Fede | Script de inventario y pruebas del repo |
| G-2 | El usuario corrige, borra y confirma sus datos donde los ve | % de campos de estrategia en estado «Confirmado» por empresa | sin dato | Base de datos (tras G-1) |
| G-3 | «Configura tu estrategia» guía al siguiente paso | % de empresas que completan los 8 elementos en 7 días | sin dato | Base de datos |
| G-4 | El onboarding se termina y se reanuda | % de empresas que llegan a «onboarding terminado» en 7 días; % con al menos un producto al terminar | sin dato | Base de datos y eventos de sesión |
| G-5 | Hay datos mínimos de encaje para enriquecer | % de cuentas con llave mínima completa; % de personas y leads vinculados a cuenta con dominio; competidores con dominio | sin dato (competidores: 0 por no existir la entidad) | Base de datos y registro de trabajos |
| G-6 | Cada empresa conecta sus propias cuentas (incluido Drive) | % de empresas con al menos una cuenta propia conectada; fallos por credencial o acceso | sin dato | Base de datos y registro de trabajos |
| G-7 | Descubiertos busca lo que toca y cuándo | % de búsquedas manuales con alcance acotado; coste medio acotada vs completa | sin dato | Registro de ejecuciones y de presupuesto |
| G-8 | El usuario decide con apoyo proactivo (Theory U) | Decisiones registradas desde un resumen, por empresa y mes; % de resúmenes útiles | sin dato (la valoración de utilidad hoy no existe) | Base de datos |

## 5. No-objetivos
- Los de cada SDD, en su sección «No incluye».
- Borrar las tablas antiguas marcadas como retiradas: es un cambio que rompe y está bloqueado (`roadmap.md`).
- Nada de esta iniciativa despliega ni toca producción; la entrega es de Fede.

## 6. Decisiones tomadas y abiertas
Decididas por Fede el 2026-10-25 (de `docs/sdd/README.md`):
| Tema | Decisión |
|---|---|
| Aviso por inactividad (guía y onboarding) | 1 día |
| Drive | Conexión por empresa, desde la sección Conexiones |
| Búsqueda manual y reloj semanal | El reloj queda intacto |
| Competidores hallados por Descubiertos | Piden tu OK |
| Clave mínima de enriquecimiento | Validada tal cual |
| SDD de datos mínimos | Dividido en 7a, 7b y 7c |
| Plazo de deshacer | 24 horas |
| Alta manual de competidores | Onboarding (Posicionamiento), pantalla de Estrategia y Agente |
| Cuenta propia sin crédito | Usa la cuenta de NOKKO |
| Proveedores con cuenta propia | Apollo, Clay, Parallel, Perplexity, Firecrawl; extensible a otros |
| Quién gestiona conexiones | Solo el Owner |
| Theory U: aviso de sensing | 8 notas sin sintetizar |
| Segunda ronda | Coste del respaldo se descuenta del presupuesto de la empresa; Theory U avisa a los 14 días en la misma fase, queda aparte y la guía lo sugiere; el catálogo empieza por Origen, País, Tamaño e Importe |

Decididas por Fede el 2026-10-28 (al revisar los SDD con el gate):
| Tema | Decisión |
|---|---|
| Drive (CA-9, CA-10) | Solo cuenta de empresa; solo el Owner conecta, cambia o desconecta |
| Reloj semanal (discoveries CA-12) | Retirado: una búsqueda manual nunca reinicia el reloj |
| Cuentas o personas duplicadas (7a, 7b, 7c) | Se avisa y se enlazan; nunca se fusionan |
| Borrar fuentes del onboarding y hallazgos | Solo el Owner |
| Productos (CA-2, CA-3) | Sin migración: «Falta precio» solo en la propuesta; fuente y nivel por bloque |
| Theory U: nombre del entrevistado | No se envía al modelo |
| Theory U: IA de clínicas y prototipos (CA-12, CA-13) | Orden estándar: regla, caché, modelo barato; «A fondo» solo a petición |
| Lista de fuentes del onboarding que se reemplaza | Bug confirmado; lo cubre CA-12 de field-actions |

Abiertas:
1. Productos: moneda y productos en varias monedas.
2. Los [Por verificar] de la sección 16 de cada SDD que dependen de producción, proveedores o datos reales.

## 7. Riesgos y dependencias
- Los SDD comparten catálogo de campos: cambiar G-1 afecta a G-2 a G-8.
- Hay worktrees activos con copias de estos SDD (`seller-strategy-studio-connections`, `-field-actions`, `-guided`, `-suggestions`, `-migrations-guard`): editar aquí y no allí puede generar conflictos al integrar.
- Todas las métricas están sin línea base; no se pueden evaluar mejoras hasta medir.

## 8. Orden de entrega
| # | SDD | Tipo | Depende de | Cubre |
|---|---|---|---|---|
| 1 | `SDD-20261025-universal-field-definitions` | Feature | — | G-1 |
| 2 | `SDD-20261025-field-actions-edit-delete-confirm` | Feature | 1 | G-2 |
| 3 | `SDD-20261025-strategy-setup-guided-next-step` | Mejora | 1 | G-3 |
| 4 | `SDD-20261025-onboarding-flow-end-to-end` | Feature | 1, 2, 3 | G-4 |
| 5 | `SDD-20261025-drive-per-company-account` | Feature | independiente | G-6 |
| 6 | `SDD-20261025-discoveries-scoped-manual-search` | Mejora | 2 | G-7 |
| 7a | `SDD-20261025-fit-data-7a-llave-minima-y-completado` | Feature | 1, 2 | G-5 |
| 7b | `SDD-20261025-fit-data-7b-competitors-entity` | Feature | 1, 2; coordinar con 6 | G-5 |
| 7c | `SDD-20261025-fit-data-7c-person-identity-and-third-party-results` | Feature | 1, 2 | G-5 |
| 8 | `SDD-20261025-products-in-onboarding-autofill` | Mejora | 1, 2; encaja en 4 | G-4 |
| 9 | `SDD-20261025-theory-u-proactive-decision-support` | Feature | 1, 2 | G-8 |
| 10 | `SDD-20261025-connections-bring-your-own-account` | Feature | 1; incluye el 5 como primer caso | G-6 |

## 9. Aprobación
- [x] Fede aprueba el PRD. Fecha: 2026-10-28
- Cuatro SDD ya llevan aprobación o estado «En curso» anterior a este PRD (universal, strategy-setup, drive, connections). Su aprobación sigue siendo válida; este PRD solo los enlaza a un G-n.
