# Evaluación de sugerencias de IA · Criterio de puntuación

> **Copia de `gtm-lab@44f385b` `docs/evaluacion/criterio.md`, sin cambios en el criterio** (NK-0048, SDD-20261101-gtm-lab-1-core). En NOKKO, las comprobaciones viven en `src/lib/gtm-lab/eval/checks.ts`, el juez en `src/lib/gtm-lab/eval/judge-request.ts`, los proyectos en `src/lib/gtm-lab/eval/fixtures/` y el script en `scripts/gtm-lab/eval.eval.ts`. Las rutas citadas abajo son las del repo de GTM Lab.

**SDD:** `docs/sdd/SDD-20261101-usuarios-reales.md` (parte B, aprobación 2 de 3: criterio) · **Fecha:** 2026-11-01 · **Estado:** aprobado (Fede, 2026-11-01), con la rúbrica ajustada tras la calibración y la comprobación de «AI slop» añadida

Cada uno de los 24 casos se puntúa en dos capas: comprobaciones automáticas (gratis) y un juez (Claude Opus 5.5) que valora la utilidad. Un caso **pasa** si supera las dos.

## 1. Comprobaciones automáticas
Código: `scripts/eval-checks.mjs`. Tests con oráculo y nulo: `scripts/eval-checks.test.mjs` (los tests fallaron antes de existir el código y ahora pasan).

| Comprobación | Qué exige | Falla si… |
|---|---|---|
| **Terminó bien** | El modelo acabó con normalidad y devolvió JSON. | Hay un rechazo, la respuesta está cortada o el JSON no se puede leer. Si falla, no se ejecuta el resto. |
| **Válida** | La respuesta pasa la misma validación de la app (`validateDeliverable`) en modo «hecho»: campos obligatorios, límites de longitud, número de elementos y opciones permitidas. | Falta un campo obligatorio, sobran elementos de una lista, etc. |
| **Sin cifras inventadas** | Cada número de la respuesta aparece en el texto del paso que recibió el modelo: la instrucción y el contexto del proyecto. No cuentan los marcadores de enumeración, como «(1)», y «1.500» se lee como 1500. | Aparece una cifra nueva, por ejemplo «un 30 % menos» sin que el 30 esté en el contexto. El informe lista cuáles. |
| **Español con «tú»** | Sin «usted», sin voseo y en español. | Aparece «usted», una forma de voseo («elegí», «podés») o el texto parece inglés. |
| **Sin «AI slop»** (Fede, 2026-11-01) | Texto llano, sin las muletillas típicas de texto generado por IA. | Aparecen palabras de moda («revolucionar», «sinergias», «empoderar», «innovador», «de vanguardia», «al siguiente nivel», «solución integral», «experiencia fluida», «sin fisuras»…), fórmulas de relleno («en el mundo actual», «cabe destacar», «en definitiva», «no solo… sino también») o tipografía de máquina (raya «—», exclamaciones, emojis). El informe lista cuáles. |

**Límites conocidos** (los cubre el juez o los reviso a mano en el informe):
- Las cifras escritas con letras («tres clientes») no se detectan.
- El voseo se detecta con una lista cerrada de formas habituales, para no confundirlo con palabras como «más» o «después».
- El modo «hecho» es más estricto que la app, que acepta una sugerencia incompleta como borrador. Una sugerencia que la app aceptaría puede fallar aquí, y eso se cita en el informe.

## 2. Juez de utilidad (Claude Opus 5.5)
El juez recibe el texto del paso que recibió la IA (instrucción y contexto del proyecto) y la sugerencia. No recibe las instrucciones generales de la app (el system prompt). No sabe qué modelo la escribió. Para cada criterio escribe primero el motivo, citando la sugerencia, y después la nota.

| Criterio | 1 | 3 | 5 |
|---|---|---|---|
| **Concreta** | Valdría para cualquier producto. | Menciona el sector, pero con frases genéricas. | Solo tiene sentido para este proyecto: usa su cliente, su problema y sus alternativas. |
| **Coherente** | Contradice los pasos previos (otro segmento, otro objetivo). | Es compatible, pero ignora algo relevante del contexto. | Se apoya en los pasos previos relevantes y no contradice ninguno. |
| **Accionable** | El founder tendría que reescribirla entera. | Sirve de base, pero hay que recortar o completar bastante: texto largo, avisos repetidos o elementos de relleno. | Cada campo se puede usar tal cual, con retoques menores: es breve; los corchetes señalan solo lo que falta comprobar, no sustituyen contenido y nunca van dentro de un texto pensado para publicarse (titular, mensaje); y las pruebas son pruebas, no advertencias. |

*Ancla de «Accionable» ajustada el 2026-11-01 tras la calibración (§3): con la versión anterior, el juez puntuaba 1 punto por encima en los 5 casos y no castigaba la longitud, los corchetes dentro del copy ni las pruebas de relleno. Decisión de Fede.*

Además, una marca **sí/no de invención**: la sugerencia afirma hechos que no están en el contexto (clientes, resultados, testimonios, datos de mercado), aunque no lleven números. Una invención hace fallar el caso.

### Instrucciones del juez (texto exacto)
> Eres un evaluador de sugerencias de una herramienta que ayuda a founders B2B a preparar su estrategia de go-to-market.
> Recibes el paso que el founder está rellenando, el contexto que ya escribió y la sugerencia que le propuso la herramienta.
> Valora la sugerencia solo con ese contexto; no uses conocimiento externo sobre el sector para premiarla o castigarla.
> Para cada criterio, escribe primero un motivo breve que cite la sugerencia y después una nota del 1 al 5 según la rúbrica.
> Marca «invención» si la sugerencia afirma como hechos clientes, resultados, testimonios o datos de mercado que no aparecen en el contexto. Las propuestas prudentes y lo señalado entre corchetes para comprobar no son invenciones.
> Rúbrica: [la tabla de arriba, literal].

Salida en JSON con esquema fijo: `{concreta: {motivo, nota}, coherente: {motivo, nota}, accionable: {motivo, nota}, invencion: {motivo, hay}}`. Esfuerzo `medium`, el que trae Opus 5.5 por defecto.

## 3. Calibración contigo (5 casos)
- **Casos:** cubren los 4 pasos y 5 de los 6 proyectos: `talleres/north-metric` (sin evidencia), `excedentes-obra/segment-list`, `kyc-api/value-proposition`, `veterinarias/core-message` y `restaurantes/core-message`.
- **A ciegas:** te paso cada sugerencia con su contexto, sin las notas del juez. Tú puntúas los 3 criterios y la marca de invención.
- **El juez está calibrado si** (propuesta): al menos 12 de tus 15 notas coinciden con las suyas con ±1 de diferencia, ninguna difiere en 3 o más y la marca de invención coincide en los 5 casos.
- **Si no se cumple:** ajusto la rúbrica o las instrucciones y repetimos con los mismos 5 casos, como dice el SDD.

## 4. Piloto y coste
- **Propuesta:** los 5 casos de calibración hacen también de piloto (el SDD hablaba de 3). Son 5 sugerencias de Sonnet y 5 notas de Opus. Así medimos el coste con más datos y sin llamadas de más.
- **Coste:** sin dato hasta el piloto. Se calcula con los tokens medidos y los precios publicados: Sonnet 5.5 a $2 por millón de tokens de entrada y $10 por millón de salida; Opus 5.5 a $4 y $20.
- **Tope de seguridad:** el script se detiene si el coste acumulado del piloto supera **$1**.
- **Antes de la pasada completa** te presento el coste medido y la proyección a 24 casos (aprobación 3).

## 5. Cómo se lee el resultado (propuesta, decides tú)
Sonnet 5.5 con esfuerzo bajo **basta** si en los 24 casos:
- no hay ningún rechazo ni respuesta cortada, y no hay ninguna invención;
- al menos 22 casos pasan las comprobaciones automáticas;
- la media es de 4 o más en cada criterio y ningún caso tiene un criterio con nota 2 o menos.

Si no se cumple, el informe recomienda qué cambiar (instrucciones, esfuerzo o modelo), y ese cambio va en un SDD aparte.

## Qué necesito de ti
- **Aprobar el criterio:** las comprobaciones, la rúbrica, el texto del juez y los umbrales de §3 y §5, o decirme qué cambiar.
- **Aprobar el piloto de §4:** 5 casos con tope de $1. Es el primer gasto de API de la parte B.
