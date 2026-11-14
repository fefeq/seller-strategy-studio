# SDD-20261114-reply-inbox-3-classification · [Feature] Clasificación privada y propuestas

**Tipo:** Feature · **Prioridad:** Alta
**Estado:** En curso · **Pide / Aprueba:** Fede · **Fecha:** 2026-11-14
**PRD:** `docs/prd/PRD-20261113-bandeja-de-respuestas.md` · **Decisiones:** `docs/decisiones-fede-20261113.md` · **Depende de:** NK-0174 SDD 2

## 1. Resumen
Clasificar respuestas humanas en siete categorías y preparar propuestas privadas sin ejecutar acciones. Separar clasificación y redacción mediante puertos; el código impone frenos y valida las salidas. Entregar primero el núcleo sin conectar llamadas ni leer correo real.

## 2. Problema y para quién
Fede necesita saber qué hacer con una respuesta sin trasladar su contenido a compañeros, asistentes ni automatismos de envío.

## 3. Evidencia y por qué ahora
SDD 2 guarda identificadores, fecha y tipo humano/automático. El PRD §6.5.1 exige dos llamadas aisladas, frenos por código y validación; Q-6 aprueba ruta fija, pero el modelo concreto aún requiere elección explícita. Sin datos de uso.

## 4. Resultado buscado
G-1 clasificación y propuestas; G-2 borradores seguros; G-5 privacidad; G-6 recibos por llamada. Línea base: sin dato.

## 5. Alcance
Incluye U-1: clases, esquema estricto, extracción validada, limpieza de citas/firmas, frenos español/inglés, contexto cerrado, rechazo de filtraciones, advertencias de datos nuevos y coordinador probado con proveedor sintético.
No incluye en U-1: lectura Gmail, llamadas reales, escritura de derivados, pantalla, cambios de etapas, envíos, sugerencias compartidas, herramientas Agente/MCP/Telegram ni publicación. U-2 y U-3 quedan pendientes.

## 6. Cambios de comportamiento
Añadido: núcleo aislado que produce clasificación, propuesta y borrador revisable.
Modificado: ninguno de los consumidores actuales; no se activa clasificación automática todavía.
Eliminado: nada.

## 7. Historias y criterios de aceptación
H-1: Como persona que conectó su buzón, quiero propuestas seguras.
- CA-1: exactamente siete clases; salida desconocida, truncada o inválida no se acepta; confianza no decide acciones · G-1/G-5.
- CA-2: respuesta automática omite ambas llamadas y no extrae fecha · G-5.
- CA-3: baja explícita prevalece sobre IA; precio, descuento, contrato, datos personales, queja o asunto legal bloquean redacción · G-5.
- CA-4: clasificación solo recibe texto delimitado sin citas, firmas ni contexto privado · G-5.
- CA-5: fecha futura hasta 365 días, nombre y correo literales; otra salida se descarta · G-5.
- CA-6: la redacción recibe solo seis campos públicos de positioning, title/message de pilares y nombre de pila/cargo/empresa; columnas restantes se excluyen · G-5.
- CA-7: borrador con fragmento normalizado de 24 caracteres de valores excluidos, ejemplos, reglas o sistema se rechaza; enlaces, emails y cifras no contenidos en contexto público llevan advertencia · G-2/G-5.
- CA-8: solo interesado, más información y no interesado admiten redacción y solo sin freno; propuestas no ejecutan acciones · G-1/G-5.
- CA-9: cada llamada intentada genera recibo sin texto, incluso si falla; fallo de recibo no bloquea; no hay reintento ni fallback · G-6.
- CA-10: 30 días de vigencia de derivados (Q-8); decisión o caducidad limpia borrador y extracción · G-5.
Pruebas nuevas: `classification.test.ts` y `classification-core.test.ts` bajo reply-inbox.

## 8. Casos límite y errores
Texto vacío o salida no terminada: pendiente/revisión, sin segunda llamada. Inyección de instrucciones nunca abre herramientas. Extracción inventada o fecha inválida se descarta. Comparaciones normalizadas no garantizan detectar paráfrasis: revisión humana obligatoria.

## 9. Experiencia y copy
Clases: Interesado, Pide más información, Fuera de oficina, No es la persona, No interesado, Baja, Otro. Freno fijo «Necesita a una persona». No se presenta pantalla en U-1.

## 10. Datos, permisos y privacidad
U-1 no modifica esquema ni datos. Futuro U-2: derivados solo en fila privada bajo usuario+empresa, caducan en 30 días; no guardar cuerpo/asunto ni enviar contenido a tablas compartidas. No se llama Gmail ni IA en U-1. Recibos solo contadores y valores de coste, nunca texto/identidad.

## 11. Llamadas a IA
| Llamada | Ruta | Modelo | Coste |
|---|---|---|---|
| Clasificación / redacción / resumen estilo (futuras U-2/U-3) | askPinned, OpenRouter → Anthropic, sin respaldo | Pendiente de aprobación concreta de Fede; no se activa | Sin dato |
U-1 solo usa puertos con proveedor sintético. No se reutiliza el modelo de GTM Lab por inferencia ni la cadena general de ask().

## 12. Unidades
- U-1: núcleo + pruebas nuevas fallando primero.
- U-2: tras modelo aprobado, esquema privado, permisos, retención, recibos compartidos sin contenido, integración en segundo plano con reserva durable antes de gastar y sin replay incierto.
- U-3: resumen de estilo separado de texto ajeno, integración del contexto privado mínimo y pruebas de aislamiento; pantalla permanece SDD 4.

## 13. Notas técnicas
Núcleo port-based bajo reply-inbox; zod estricto; reutilizar replyKind. Proyección de contexto se construye campo a campo, nunca spread de registros. No acceder a ejemplos, reglas o campos excluidos desde el clasificador.

## 14. Riesgos
Reglas sensibles solo español/inglés, no detección universal; no garantizan seguridad de otros idiomas. La minimización no sustituye revisión humana. Integración actual SDD 2 tiene limitaciones de emparejado/retención que deberán auditarse en U-2 antes de leer cuerpos.

## 15. Preguntas para Fede
Modelo fijo para correo y condiciones de no entrenamiento pendientes según Q-6; se pedirán antes de activar el adaptador, no impiden U-1.

## 16. Pendiente de verificar
Modelo/no entrenamiento, RLS de derivados futuros, pasada Gmail real, segundo plano alojado y pantalla. Sin publicación ni gasto.

## 17. Revisión técnica independiente
No revisado. La entrega no declara gate definitivo ni habilita procesamiento real.

## 18. Delta de implementación
U-1 implementada el 14-11: `classification.ts` y `classification-core.ts`, 20 pruebas nuevas en dos archivos. Primera ejecución falló por ausencia del módulo de reglas; segunda, por ausencia del coordinador, con las 13 pruebas de reglas ya verdes. Resultado final: 32/32 pruebas de bandeja incluyendo RLS; suite completa 5936/5936 en 378 archivos; comprobación automática del entorno «build OK» 11:55:48 UTC. Ninguna prueba preexistente editada.

No se activó clasificación sobre el buzón ni se modificó esquema, Gmail, trabajo horario o pantalla. No hay flujo de navegador que verificar en U-1: el comportamiento nuevo es un núcleo no conectado, validado con proveedor sintético. U-2/U-3, revisión independiente, conexión real y comprobación visual siguen pendientes. Q-6 requiere decisión concreta de modelo y condiciones de no entrenamiento antes de escribir/activar el adaptador. No se lee correo, gasta ni publica. No se declara SDD completo.