# SDD-20261025-products-in-onboarding-autofill · [Mejora] Productos en el onboarding y autocompletado desde la web

**Tipo:** Mejora · **Prioridad propuesta:** Alta
**Estado:** Borrador; revalidar contra GTM Lab antes de su SDD 3 (D-9, decisión de Fede del 2026-11-06) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-25
**PRD:** docs/prd/PRD-20261028-ux-onboarding-coherencia.md (cubre G-4) · **Depende de:** SDD universal de campos; SDD de acciones sobre campos

## 1. Resumen
El catálogo de **Productos** no forma parte del onboarding ni se rellena cuando compartes la URL de tu web. Se quiere que NOKKO proponga tus productos desde la web y los documentos, que los apruebes como un bloque más del onboarding, y que el catálogo siga siendo editable después.

## 2. Problema y para quién
Founder que da su web y espera que NOKKO conozca qué vende. Hoy tiene que ir a Productos y teclear nombre, precio, coste y facturación uno a uno; mientras, el posicionamiento solo guarda un nombre de producto en texto.

## 3. Evidencia y por qué ahora
Fuente: código del repo `main` (2026-10-25) y petición de Fede. Sin datos de uso (sin dato).
- La pantalla de Productos (`products.tsx`) es un catálogo manual con nombre, precio, coste y facturación; sirve para las líneas de cada deal.
- La tabla de productos tiene: nombre, descripción, SKU, precio, coste, facturación, activo.
- El esquema de extracción del onboarding (`setup-extraction.ts`) cubre empresa, ICP, segmentos, posicionamiento, mensajes y objetivos; el posicionamiento solo guarda `product_name` en texto. No hay bloque de productos.
- Los seis bloques de aprobación del plan de onboarding no incluyen productos.
- Hay dos conceptos de «producto» sin vínculo: el catálogo (precio/coste) y el nombre en el posicionamiento. **[Por verificar]** si se relacionan.
**Apuesta declarada:** se medirá tras el lanzamiento con las métricas de la sección 4.

## 4. Resultado buscado
- % de empresas con al menos un producto en catálogo al terminar el onboarding (fuente: base de datos). Línea base: sin dato.
- % de productos del catálogo que nacieron propuestos y confirmados frente a tecleados (fuente: origen del dato, según SDD universal). Línea base: sin dato.

Cubre el objetivo G-4 del PRD.

## 5. Alcance
**Incluye:** bloque «Productos» en el onboarding; propuesta desde web y documentos con origen por dato; revisión, edición, borrado y confirmación; vínculo con el producto del posicionamiento y con las líneas de deal; acceso desde el Agente.
**No incluye:** facturación o precios públicos; importar catálogos desde un ERP o tienda; cambiar el cálculo de margen de las líneas de deal; productos con variantes complejas (tallas, packs).

## 6. Cambios de comportamiento (delta)
**Añadido:** bloque Productos en onboarding; propuesta automática; origen y confirmación por producto; vínculo producto–posicionamiento.
**Modificado:** catálogo (antes: solo manual; después: manual y propuesto con origen).
**Eliminado:** doble escritura del nombre de producto (catálogo y posicionamiento) cuando son el mismo.

## 7. Historias y criterios de aceptación
### H-1: Como founder, quiero que NOKKO proponga mis productos al compartir mi web.
- CA-1: CUANDO comparto la URL de mi web o documentos, el sistema DEBE proponer una lista de productos con nombre y descripción y, cuando la fuente los dé, precio y facturación. · cubre G-4 · prueba: por nombrar en el brief
- CA-2: SI la fuente no da precio, ENTONCES el sistema DEBE marcarlo «Falta precio» en la propuesta, nunca inventarlo, y no tratar como precio real el 0 que guarda la columna `price` (`not null default 0`), sin migración (decidido por Fede, 2026-10-28). · cubre G-4 · prueba: por nombrar en el brief
- CA-3: El sistema DEBE guardar la fuente y el nivel (Confirmado, Deducido, Supuesto) por bloque de productos, no por cada dato, porque el esquema actual solo los guarda por bloque (decidido por Fede, 2026-10-28). · cubre G-4 · prueba: por nombrar en el brief
- CA-4: MIENTRAS yo no haya aprobado el bloque o el producto, el sistema DEBE mantener las propuestas fuera del catálogo. · cubre G-4 · prueba: por nombrar en el brief

### H-2: Como founder, quiero aprobar los productos como parte del onboarding.
- CA-5: El sistema DEBE ofrecer «Productos» como bloque de aprobación del onboarding, con aprobar, rehacer con una indicación y saltar por ahora. · cubre G-4 · prueba: por nombrar en el brief
- CA-6: CUANDO salto el bloque, el sistema DEBE mantenerlo como pendiente en la guía de estrategia. · cubre G-4 · prueba: por nombrar en el brief
- CA-7: CUANDO apruebo, el sistema DEBE crear los productos en el catálogo y permitirme deshacer. · cubre G-4 · prueba: por nombrar en el brief

### H-3: Como founder, quiero añadir, editar y quitar productos en cualquier momento.
- CA-8: El sistema DEBE permitir crear, editar, archivar y borrar productos desde Productos y desde el Agente, con las acciones del SDD de acciones sobre campos. · cubre G-4 · prueba: por nombrar en el brief
- CA-9: SI un producto está en líneas de deals, ENTONCES el sistema DEBE avisarlo y ofrecer archivar en lugar de borrar. · cubre G-4 · prueba: por nombrar en el brief
- CA-10: SI mi rol no permite editar el catálogo, ENTONCES el sistema DEBE mostrarlo en solo lectura (roles actuales: owner, sales_leader, deal_desk). · cubre G-4 · prueba: por nombrar en el brief

### H-4: Como founder, quiero que el producto del posicionamiento sea el del catálogo.
- CA-11: CUANDO elijo el producto principal, el sistema DEBE usar el mismo registro en posicionamiento y en el catálogo. · cubre G-4 · prueba: por nombrar en el brief
- CA-12: SI cambio el nombre del producto en un sitio, ENTONCES el sistema DEBE reflejarlo en el otro sin sobrescribir texto escrito por mí. · cubre G-4 · prueba: por nombrar en el brief

## 8. Casos límite y errores
- Web sin productos identificables: ofrecer añadir a mano y no inventar (CA-1).
- Productos duplicados entre fuentes: proponer uno solo y mostrar las fuentes (CA-1).
- Precio en otra moneda que la de la empresa: mostrarlo con su moneda y pedir confirmar (CA-3).
- Pago único (puesta en marcha, formación) junto a suscripción: marcar la facturación de cada uno (CA-1).
- Fallo de lectura de la web: indicarlo y permitir pegar texto (CA-1).
- Fuente de precio contradictoria con otra: mostrar ambas y no elegir (CA-3).

## 9. Experiencia y copy
Bloque: «Esto es lo que vendes, según tu web. Revísalo y apruébalo.» Estados con palabra, «tú», sin iconos. Los productos sin precio se muestran como «Falta precio» en la propuesta; una vez guardados, un 0 no se distingue de un precio real de 0 (limitación aceptada el 2026-10-28).

## 10. Datos, permisos y privacidad
Datos de empresa (nombre, precio, coste, descripción), sin datos de clientes. Coste y margen visibles solo a roles ya autorizados. Precios de NOKKO: no aplican aquí.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Ninguna nueva: los productos salen de la misma extracción ya lanzada para los otros bloques (un solo paso, no uno por bloque) | regla para duplicados y moneda (deterministas); la extracción ya existente no se amplía con llamadas | esfuerzo `low` y cadena de proveedores del repo (`src/lib/setup-extract.server.ts`, `src/lib/gemini.ts`) | sin dato; cero llamadas nuevas |

Una llamada no declarada aquí no se implementa.

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | Bloque Productos en la extracción y en la aprobación del onboarding (H-1, H-2) | los de H-1 y H-2: CA-1 a CA-7 | por nombrar en el brief |
| U-2 | Acciones sobre el catálogo (H-3; depende del SDD de acciones) | los de H-3: CA-8 a CA-10 | por nombrar en el brief |
| U-3 | Vínculo con posicionamiento y líneas de deal (H-4) | los de H-4: CA-11, CA-12 | por nombrar en el brief |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Ampliar `SETUP_EXTRACTION_SCHEMA` en `src/lib/setup-extraction.ts` y `setup-extract.server.ts`; tabla `products`; `useProducts` en `src/components/deal-lines.tsx`; escritura mediante las herramientas del Agente (`core-write.ts`).
- **Uso de LLM:** cero llamadas nuevas: los productos salen de la misma extracción ya lanzada para los otros bloques (un solo paso, no uno por bloque). Reglas deterministas para duplicados y moneda.

## 14. Riesgos y dependencias
- Riesgo: inventar precios a partir de planes de la web. Mitigación: CA-2 y origen visible.
- Depende de los SDD universal y de acciones.

## 15. Preguntas para Fede y para la revisión técnica
1. ¿Se relaciona hoy el producto del posicionamiento con el catálogo?
2. ¿El catálogo debe cubrir productos de varias monedas?

## 16. Pendiente de verificar
- [Por verificar] Relación actual entre posicionamiento y catálogo.
- [Por verificar] Comportamiento en `production` (solo se leyó `main`).
- [Por verificar] Si deals y márgenes dependen de campos del catálogo no listados aquí.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Un agente `nokko-gate` con contexto fresco lee este SDD y el código, y devuelve su informe. El coordinador lo copia aquí sin editarlo. El gate no aprueba el SDD: informa; la aprobación es de Fede.
Informe del gate recibido el 2026-10-28, copiado sin editar. El veredicto no aprueba el SDD: la aprobación es de Fede.
- **Veredicto del gate:** Objeciones
- **CA sin prueba posible o sin G-n:** Todos los CA citan G-4, y es correcto (PRD:27). Ninguno nombra una prueba: CA-1 a CA-12 dicen «por nombrar en el brief» (SDD:39-57), y la plantilla exige un archivo de test (templates/sdd.md:33). CA-2 no se puede cumplir tal como está: `price` es `not null default 0` (0024_products_deal_lines.sql:14). CA-3 pide fuente y nivel por dato, pero el esquema solo los guarda por bloque (setup-extraction.ts:19). Además, ni `products` ni `positioning` tienen `field_sources` (field-baseline.ts:67,70). CA-12 tampoco se puede probar sin esa marca.
- **[Por verificar] que sigue sin comprobarse:** solo «production» (SDD:100). Los otros dos ya se pueden comprobar:
  - No hay vínculo. `positioning` no tiene `product_id` (field-baseline.ts:67).
  - Las líneas copian precio y coste, y `product_id` usa `on delete set null` (0024:41-47).
- **Contradicciones con el código o con decisiones previas:**
  - La sección 10 no declara columnas ni migraciones, pero CA-2 y CA-3 las necesitan.
  - Mostrar el precio en otra moneda (SDD:61) choca con AGENTS.md:16 y con 0024:5. Además, el PRD tiene esa decisión abierta (PRD:57).
  - Para editar, CA-10 usa los roles de la RLS (products.tsx:30; 0024:33-37). Para borrar, la matriz de acciones a la que remite CA-8 da «members» y «owner» (field-actions.ts:17).
  - El Agente no tiene herramientas de escritura de productos, solo `list_products` (core-read.ts:91).
  - CA-7 no fija el plazo de 24 h que decidió Fede (PRD:48).
  - La sección 11 dice «sin dato» sobre el esfuerzo, pero es `low` (setup-extract.server.ts:40). Tampoco declara `redoBlockCore` (setup-extract.server.ts:49), que es lo que necesita CA-5.
  - La fuente que cita es `main` (SDD:14), pero lo leído es `feat/software-factory`.
- **Lo que esta revisión NO demuestra:** el estado de la base de datos real ni el de `production`, ni que la migración 0024 refleje la base aplicada. Tampoco ejecuté tests ni comprobé la calidad de la extracción.

## 18. Delta de implementación
Sin entrega todavía.

---
Validación: migrado a la plantilla de NOKKO el 2026-10-28. Revisión técnica: ver sección 17. `AUDIT-20261025.md` es el registro histórico anterior.
