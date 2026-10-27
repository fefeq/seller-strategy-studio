# SDD-20261025-products-in-onboarding-autofill · [Mejora] Productos en el onboarding y autocompletado desde la web

**Tipo:** Mejora · **Prioridad propuesta:** Alta
**Estado:** Borrador · **Pide:** Fede · **Para:** Dani · **Fecha:** 2026-10-25
**Depende de:** SDD universal de campos; SDD de acciones sobre campos

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

## 5. Alcance
**Incluye:** bloque «Productos» en el onboarding; propuesta desde web y documentos con origen por dato; revisión, edición, borrado y confirmación; vínculo con el producto del posicionamiento y con las líneas de deal; acceso desde el Agente.
**No incluye:** facturación o precios públicos de Postin; importar catálogos desde un ERP o tienda; cambiar el cálculo de margen de las líneas de deal; productos con variantes complejas (tallas, packs); productos con precios en varias monedas.

## 6. Cambios de comportamiento (delta)
**Añadido:** bloque Productos en onboarding; propuesta automática; origen y confirmación por producto; vínculo producto–posicionamiento.
**Modificado:** catálogo (antes: solo manual; después: manual y propuesto con origen).
**Eliminado:** doble escritura del nombre de producto (catálogo y posicionamiento) cuando son el mismo.

## 7. Historias y criterios de aceptación
### H-1: Como founder, quiero que NOKKO proponga mis productos al compartir mi web.
- CA-1: CUANDO comparto la URL de mi web o documentos, el sistema DEBE proponer una lista de productos con nombre y descripción y, cuando la fuente los dé, precio y facturación.
- CA-2: SI la fuente no da precio, ENTONCES el sistema DEBE dejarlo vacío y marcarlo «Falta», nunca inventarlo.
- CA-3: El sistema DEBE guardar para cada dato propuesto su fuente y su nivel (Confirmado, Deducido, Supuesto), con el vocabulario y las reglas del SDD universal de campos.
- CA-4: MIENTRAS yo no haya aprobado el bloque o el producto, el sistema DEBE mantener las propuestas fuera del catálogo.

### H-2: Como founder, quiero aprobar los productos como parte del onboarding.
- CA-5: El sistema DEBE ofrecer «Productos» como bloque de aprobación del onboarding, con aprobar, rehacer con una indicación y saltar por ahora.
- CA-6: CUANDO salto el bloque, el sistema DEBE mantenerlo como pendiente en la guía de estrategia.
- CA-7: CUANDO apruebo, el sistema DEBE crear los productos en el catálogo y permitirme deshacer todo el bloque durante 24 horas, salvo los productos ya usados en líneas de deal.

### H-3: Como founder, quiero añadir, editar y quitar productos en cualquier momento.
- CA-8: El sistema DEBE permitir crear, editar, archivar y borrar productos desde Productos y desde el Agente, con las acciones del SDD de acciones sobre campos.
- CA-9: SI un producto está en líneas de deals, ENTONCES el sistema DEBE avisarlo y ofrecer archivar en lugar de borrar.
- CA-10: SI mi rol no permite editar el catálogo, ENTONCES el sistema DEBE mostrarlo en solo lectura (roles actuales: owner, sales_leader, deal_desk).

### H-4: Como founder, quiero que el producto del posicionamiento sea el del catálogo.
- CA-11: CUANDO elijo el producto principal, el sistema DEBE usar el mismo registro en posicionamiento y en el catálogo.
- CA-12: SI cambio el nombre del producto en un sitio, ENTONCES el sistema DEBE reflejarlo en el otro sin sobrescribir texto escrito por mí.

## 8. Casos límite y errores
- Web sin productos identificables: ofrecer añadir a mano y no inventar (CA-1).
- Productos duplicados entre fuentes: proponer uno solo y mostrar las fuentes (CA-1).
- Precio en otra moneda que la de la empresa (decidido: una sola moneda por empresa, la ya configurada): queda «Falta confirmar» y no se convierte ni se inventa tipo de cambio (CA-3).
- Producto con varios precios en distintas monedas: «No incluye»; se importa solo el de la moneda de la empresa o ninguno (CA-3).
- Pago único (puesta en marcha, formación) junto a suscripción: marcar la facturación de cada uno (CA-1).
- Fallo de lectura de la web: indicarlo y permitir pegar texto (CA-1).
- Fuente de precio contradictoria con otra: mostrar ambas y no elegir (CA-3).

## 9. Experiencia y copy
Bloque: «Esto es lo que vendes, según tu web. Revísalo y apruébalo.» Estados con palabra, «tú», sin iconos. Los productos sin precio se muestran como «Falta precio».

## 10. Datos, permisos y privacidad
Datos de empresa (nombre, precio, coste, descripción), sin datos de clientes. Coste y margen visibles solo a roles ya autorizados. Precios de NOKKO/Postin: no aplican aquí.

## 11. Unidades de trabajo
- U-1: Bloque Productos en la extracción y en la aprobación del onboarding (H-1, H-2).
- U-2: Acciones sobre el catálogo (H-3; depende del SDD de acciones).
- U-3: Vínculo con posicionamiento y líneas de deal (H-4).

## 12. Notas técnicas [Sugerencia — Dani valida]
- Ampliar `SETUP_EXTRACTION_SCHEMA` en `src/lib/setup-extraction.ts` y `setup-extract.server.ts`; tabla `products`; `useProducts` en `src/components/deal-lines.tsx`; escritura mediante las herramientas del Agente (`core-write.ts`).
- **Uso de LLM:** cero llamadas nuevas: los productos salen de la misma extracción ya lanzada para los otros bloques (un solo paso, no uno por bloque). Reglas deterministas para duplicados y moneda (única por empresa, la que ya existe en la plataforma).

## 13. Riesgos y dependencias
- Riesgo: inventar precios a partir de planes de la web. Mitigación: CA-2 y origen visible.
- Depende de los SDD universal y de acciones.

## 14. Preguntas para Dani
1. ¿Se relaciona hoy el producto del posicionamiento con el catálogo?

## 15. Pendiente de verificar
- [Por verificar] Relación actual entre posicionamiento y catálogo.
- [Por verificar] Comportamiento en `production` (solo se leyó `main`).
- [Por verificar] Si deals y márgenes dependen de campos del catálogo no listados aquí.

## 16. Sección de Dani (la completa él)
- Diseño técnico:
- Tareas:
- Estimación:
- Decisión: Aceptado / Cambios pedidos / Rechazado

---
Validación: OK (autorrevisión). Auditoría: solo linter; la independiente queda pendiente.
