# Decisiones de Fede — 2026-11-13

Respuestas de Fede en la entrevista de cierre de pendientes. Mandan sobre las recomendaciones de los PRD. Los PRD pasan a **Aprobado** con estas decisiones; lo que no aparece aquí sigue [Por decidir]. Aprobar un PRD no autoriza construirlo: primero va su SDD, que Fede aprueba.

## NK-0168 Iconografía (aprobado)
- Se **revoca** la regla «sin iconos». Nueva regla: icono siempre con su texto, un icono por concepto, estados con palabra. Se actualizan plantilla de SDD, `EXECUTION.md` y el skill `nokko-shape`; los SDD vivos quedan como históricos.
- Los botones ✕/✓ del mazo de Inicio y Sugerencias ganan texto visible («Descartar» = `Ban` + texto; «Hacer» = `Check` + texto). El menú móvil ☰/✕ lleva texto.
- Excepción única de icono solo: el `›` del rail colapsado (con `aria-label` y tooltip). «+ Nuevo…» se queda como está.
- Tamaño 16 px en botones y 20 px en menú y barra inferior, trazo 1.75 (se afina con capturas en el SDD 1). Símbolo por consecuencia como en la pregunta 5 del PRD (`Trash2` borrar, `Eraser` tirar cambios, `Ban` descartar/descalificar, `X` solo cancelar/cerrar). `Spline` para Theory U y `Cable` para Conectar asistentes.

## NK-0173 Verificación de email (aprobado)
- Q-1: empezar solo con el estado que ya devuelve Apollo; el verificador independiente se decide después con datos. Q-2: no elegir proveedor ahora.
- Q-3: regla graduada. «Sin verificar» y «no verificable» pasan con marca visible; «inválido» y «catch-all» se bloquean sin forma de saltarlo.
- Q-4: ventana de re-verificación **90 días**, constante en código.
- Q-5: la fila se borra cuando ningún contacto de la empresa use ese email (al borrar el contacto o al cambiar su email) y siempre al borrar la empresa. Sin plazo numérico.
- Q-6: lo manual con coste **no se pausa** al límite y siempre se registra el gasto (cambio transversal del orquestador; avisar a NK-0171).
- Q-7: pedir a NK-0171 un parámetro opcional «solo contacto verificado» por play o receta.
- Aclaración posterior de Fede: si Apollo devuelve un email distinto al existente, **conservar y proponer** la alternativa; no sustituir automáticamente la dirección guardada.

## NK-0167 Líneas de negocio (aprobado)
- Etapa **por línea** (cuatro preguntas por línea). Quitar línea: **solo el Owner**.
- Línea principal la marca Fede/el usuario (por defecto la primera). «Entrantes y producto» se propone aunque la línea PLG no sea la principal. Tope de 4 líneas. Todo miembro lee el ticket de cada línea, sin que salga por el agente ni el MCP.
- Migración: regla de la decisión 8, **tras ver los cuatro conteos (a)–(d)**; no se ejecuta sin que Fede los vea.
- Escritura doble: hasta cerrar el sprint siguiente a entregar el SDD 4.

## NK-0174 Bandeja de respuestas (aprobado, con una condición)
- Q-10 (b): **B**, la pausa de la secuencia es definitiva mientras el lead siga en Contactado (sin tocar `contacted_at`).
- Q-10 (a): sin herramientas del asistente, Telegram ni MCP sobre respuestas en la primera fase.
- Q-1 Gmail primero (Outlook queda como SDD 5). Q-2 lectura B por defecto, C opcional. Q-3 al desconectar se borra todo salvo contadores agregados y la marca «respondió». Q-5: el equipo usa **Google Workspace**. Q-6 una ruta de IA fija, sin respaldo. Q-7 sugerencia genérica y marca sin usuario. Q-8 caducidad de borradores y campos extraídos: **30 días**. Q-9 siete clases, sin «rebote».
- **Condición (Q-4):** revisión legal antes de conectar buzones ajenos, incluidos los de compañeros. Hasta entonces solo conecta quien decide por la organización (Fede). Lovable no habilita la conexión de otros buzones sin que Fede confirme que la revisión está hecha.

## NK-0171 Plays a medida (aprobado)
- Se confirman C-1 a C-14, los 4 SDD de la tanda 0 (molde, 3 recetas horizontales, herramienta del asistente) y los riesgos aceptados del PRD.

## Otras decisiones
- Retención de documentos subidos a `onboarding-sources` (F12): **nunca se borran automáticamente**. Queda como comportamiento actual; se documenta.
- NK-0177: se corrige también el **comportamiento** (distinguir regla personal y de equipo). Requiere SDD y aprobación de Fede antes de construir.
- NK-0159, NK-0160 y NK-0176: los hace Lovable, cada uno con un SDD corto.
- Torre de control GTM y Salida de Lovable: **aparcados**, sin fecha. Lovable no los toca.
- Control de calidad: Lovable se autoverifica y deja informe; Fede revisa el informe antes de publicar. Publicar es siempre decisión de Fede.
