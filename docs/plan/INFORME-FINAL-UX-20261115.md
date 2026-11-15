# Informe final UX — 15-nov-2026

Plan: docs/plan/PLAN-UX-20261115.md (cerrado). Autorización: delegación general de Fede. **No se ha publicado nada.**

## 1. Verificación final (este turno)
| Comprobación | Resultado |
|---|---|
| Pruebas | 412 archivos · 4.888 pruebas en verde |
| Tipos (TypeScript) | limpio |
| Compilación de producción | **fallaba** (ver 2.1), corregida; ahora correcta |
| Manifiesto MCP | regenerado, 139 herramientas |
| Navegador | 12 pantallas (Inicio, Bandeja, Cuentas, Leads, Personas, Pipeline, Estrategia, Onboarding, Conexiones, Memoria, Asesor, Métricas) × 1280/390 × claro/oscuro: sin scroll lateral, sin errores de página, sin pantallas de error |

## 2. Hallazgos de la revisión independiente final y corrección
1. **P0 — compilación de producción rota desde E3.** La herramienta `start_onboarding_read` metía en el paquete del navegador una pieza solo de servidor. La compilación del entorno de vista previa decía «OK», pero la de producción fallaba: habría bloqueado la publicación. Corregido: la herramienta crea el trabajo y lo ejecuta en el servidor sin esa pieza. Consecuencia: desde el chat, la lectura se ejecuta en la misma petición (no pasa por Inngest), así que la confirmación tarda lo que dure la lectura.
2. **P1 — un bloque aprobado desde el chat no se podía deshacer en /onboarding** (guardaba la lista de deshacer vacía y «Deshacer» no borraba nada). Corregido: guarda lo creado igual que la pantalla.
3. **P2 — «1 días en la etapa»** en Inicio y en el lead. Corregido a «1 día».
4. P2 abierto: en Inicio (escritorio) queda un hueco vertical grande entre la tarjeta del «siguiente mejor paso» y sus botones.

## 3. Entregado por pieza
- **A0** LinkedIn activo con aviso legal e interruptor solo superadmin.
- **A2** Confirmación con coste estimado antes de gastar (Apollo, Clay, Parallel, G2, LinkedIn/Apify) en agente, MCP, Telegram y botones; búsquedas web sueltas apuntadas a cada empresa; USD aparte con «Presupuesto incompleto». Sugerencias y configuración no ejecutan herramientas de gasto.
- **A1** Glosario y Ola 1 (menú en cinco secciones, modo avanzado, ⌘K con todo el catálogo).
- **A3** Contadores atómicos de entrada de leads (migraciones 0103/0104); secreto del webhook de Apollo por cabecera aceptado.
- **A+** Señales públicas de LinkedIn y comprobación de cambio de cargo (sin sobrescribir).
- **B1/B2** Configuración dentro de Onboarding (/onboarding/completar) y «Reglas y voz» en Estrategia, con redirecciones.
- **B3** Bandeja única en Hoy (Todo + 4 filtros) y Hoy simplificado; pruebas de titulares intactas.
- **B4** Asesor → «Aceptar y abrir en Estrategia» (abre la pestaña, no un campo concreto).
- **C1** Conexiones únicas con estado real, quién/cuándo, uso del mes y «Probar conexión»; nunca devuelve claves.
- **C2** Drive por empresa preparado (migración 0105, clave cifrada, copia de seguridad de carpetas); no activo.
- **D1** Cuentas, Leads y Personas adaptadas a móvil con selección múltiple y CSV seguro.
- **D2** Deal por pestañas con un solo «Guardar deal» para los campos del deal.
- **D3** MEDDPICC con radios de 44 px y teclado; acceso con mostrar contraseña y recuperación.
- **E1** Niveles Guiado/Copiloto/Autopilot por persona (migración 0106); ninguno envía ni se salta confirmaciones.
- **E2** Bloques neutros (chips, listas, enlace) iguales en app y Telegram; primer uso: el selector de nivel.
- **E3** Onboarding por chat (leer la web → repasar bloques → aprobar uno a uno con confirmación); mensajes con claves rechazados antes de guardarse.
- **E4** Agente con Memoria, reglas, conexiones (enlace a la tarjeta) y Asesor; manifiesto MCP actualizado.
- **F** Dictado y lectura en voz con el navegador (sin coste); nunca para claves ni borrados; voz nunca envía ni confirma.

## 4. Pruebas protegidas ajustadas
- `src/lib/linkedin-legal.test.ts` y `src/lib/linkedin-legal-server.test.ts` — por A0 (LinkedIn pasó de pausado a activo por tu orden v2).
- `src/lib/nav.test.ts` — solo para agrupar el menú en cinco secciones (autorizado por ti).
- Catálogo de campos: se registraron 23 campos de Gmail para que la prueba existente pasara (Ola 0).
- Las cuatro pruebas de fuentes/límites autorizadas en su momento.
- Ninguna otra prueba existente se modificó; las de titulares siguen intactas. Las nuevas pruebas son añadidos.

## 5. Bloqueado y por qué
| Qué | Por qué |
|---|---|
| Telegram operativo | No hay token de bot conectado. Código listo y se desactiva solo; falta conectar y registrar el webhook. |
| C2 Drive por empresa activo | Falta el cliente OAuth de Google (solo tú puedes crearlo). Después hay que enrutar las lecturas de Drive a la cuenta de la empresa (U-2). |
| Webhook de Apollo sin `?secret=` | Apollo no permite cabeceras propias; sigue con el secreto en la URL. |
| A2 piloto automático | Sigue gastando sin confirmación previa (con avisos 80/100 y pausa al 100 %). Falta tu decisión: acciones pendientes o autorización permanente por empresa. |
| A+ comentarios/reacciones y búsqueda de perfiles | Requiere un robot de Apify no verificado; no se inventa. |
| Bandeja de respuestas para otros buzones | Revisión legal pendiente; hoy solo tu buzón y solo superadmin. |

## 6. No verificado (sin maquillar)
- Lectura real de onboarding desde el chat (coste), dictado con micrófono real, lectura en voz audible.
- D2 en navegador: la empresa activa no tiene deals.
- Email real de recuperación de contraseña, «Probar conexión» y descarga CSV reales.
- Telegram (/nivel, botones) en vivo.
- E2: el agente aún responde en texto; los bloques solo se usan en el selector de nivel.
- Deshacer desde el chat un bloque aprobado (solo en /onboarding).

## 7. Lo que necesito de Fede
1. Conectar el bot de Telegram (o decir que no se usa).
2. Crear el cliente OAuth de Google para Drive por empresa.
3. Decidir el gasto del piloto automático (pendiente vs autorización permanente).
4. Revisión legal: Gmail para otros buzones y LinkedIn por robots.

## 8. Listo para publicar
- [x] Pruebas, tipos y compilación de producción en verde.
- [x] Sin errores de página ni scroll lateral en 12 pantallas × 2 tamaños × 2 temas.
- [x] Manifiesto MCP regenerado (los asistentes verán las herramientas nuevas tras publicar).
- [x] Migraciones 0103–0106 ya aplicadas en el backend (compartido con lo publicado).
- [ ] Decisión sobre el gasto del piloto automático (recomendado antes de publicar).
- [ ] Prueba manual tuya del onboarding por chat con una web real (gasta lo estimado).
- Telegram y Drive por empresa pueden publicarse desactivados: se muestran «Sin conectar» / «Por preparar».

## Addenda 2026-11-15 — antes de publicar

**1. Las cuatro pruebas de fuentes y límites (autorizadas en el mensaje #414; cambio en el commit 9e9e4c99).**
- `src/components/onboarding/sources.test.tsx` · «two files added one after the other are both listed»: antes, 2 archivos en memoria; ahora, 2 archivos subidos a la carpeta privada de la empresa y un documento de Drive que se suma sin reemplazar (3). Motivo: fuentes guardadas + Drive. Cobertura: sube.
- Mismo archivo · «adding the same file again does not list it twice»: antes, sin duplicado en la lista; ahora, además, no se vuelve a subir, aviso exacto «Ya estaba en la lista…», mismo ID de Drive ignorado y distinto ID con el mismo nombre admitido. Cobertura: sube.
- Mismo archivo · «past the limit it keeps what was listed…»: antes, tope 3; ahora, tope 20, nombra lo excluido y comprueba que lo excluido no se sube. Cobertura: sube.
- `src/components/onboarding/sources-limit.test.tsx` · «one selection past the limit»: antes, 3 + 2 y texto antiguo; ahora, 20 + 2, texto exacto nuevo y solo 20 subidas. Cobertura: sube.
- Revisión independiente `sub_6ndahsyz`: comparó el padre de 9e9e4c99 con las pruebas actuales. No se eliminaron casos ni bajó cobertura global; el contrato de tres documentos fue sustituido por veinte fuentes. Las dos pruebas de salto de diagnóstico conservan sus expectativas. Falta un caso de desbordamiento mixto archivos + Drive en estas pruebas de pantalla; no se presenta como cubierto. Ninguna prueba protegida se modificó en esta ronda.

**2. Piloto automático.** El documento de contexto posterior define umbral por acción, cero por defecto: cuentas, reuniones y repaso semanal quedan pendientes si la estimación supera el umbral o es «sin dato». Solo Owner/Sales Leader pueden proponer y confirmar cambios de umbral. No se marcan propuestas como trabajo ejecutado. Confirmación compartida y reserva permanente por reunión/cuenta-semana evitan repetir gasto incierto. Los importes OpenRouter comprobables se anotan en USD; otros importes quedan desconocidos, sin conversión inventada. Un fallo al anotar un coste no provoca otra llamada de IA. Las reservas previas a IA pueden requerir revisión manual tras un fallo; no hay reintento automático de gasto incierto.

**3. E2 real.** Las respuestas del agente muestran botones: «Siguiente paso» (envía ese paso), «Abrir <pantalla>» (enlaces internos) y, en Telegram, «Confirmar / Descartar» para cada acción pendiente. En la app la confirmación sigue en la tarjeta de la acción (mismos textos). Prueba: `src/lib/conversation-reply.test.ts`. Sin probar con una respuesta real del modelo (gasto) ni con Telegram (sin token).

**4. Hueco de Inicio.** La pila de tarjetas toma el alto de la tarjeta superior. Verificado en navegador 1280/390, claro/oscuro, sin scroll lateral.

**Verificación de esta ronda:** suite anterior completa 4.917/4.917; una prueba nueva adicional de dos acciones distintas sobre una reunión pasa (total esperado 4.918). Segunda suite completa en ejecución al escribir este apartado; consultar el cierre de docs/lovable-run-report.md. Compilación automática y tipos OK. Navegador autenticado: 1280/375 claro/oscuro, sin scroll lateral; Confirmar creó una tarea sintética, Descartar no creó otra, lectura final confirmó los estados y cero gastos. Empresa sintética eliminada y empresa original restaurada. Cero errores de página. Sin llamada real de pago ni prueba operativa Telegram (fuera del alcance del documento posterior). Dos revisiones independientes, con correcciones; no certifican calidad de una respuesta real del modelo. No publicado.
