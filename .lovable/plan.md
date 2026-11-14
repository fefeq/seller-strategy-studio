# Plan completo de lo pendiente en NOKKO

Orden propuesto: primero cerrar lo que ya está casi terminado, después la bandeja de respuestas y luego el resto del roadmap. Cada bloque sigue SDD: documento, pruebas nuevas primero, construcción, verificación y tu aceptación. Nada se publica sin tu autorización.

## Bloque 1 — Cierres formales (gate de aceptación)

1. **NK-0167 Líneas de negocio (SDD 1–4)**: ya está integrada en Onboarding, Inicio, Estrategia, Métricas, Segmentos, Asesor, Agente y MCP. Falta tu aceptación final. Antes haré un recorrido visual de Estrategia, Segmentos y Métricas con Postin.
2. **NK-0171 Jugadas a medida**: Supergrow y Taplio dieron 0 señales (0 falsos positivos). Tú decides:
   - aceptar el comportamiento actual, o
   - darme un competidor con una retirada de producto pública y reciente para hacer 1 búsqueda real más.
   También queda revisar en pantalla la última ejecución dentro de Plays.
3. **NK-0173 Verificación de email**: el revelado de Apollo con Jaime se colgó. Ya hay límite de 15 s sin reintento. Tú decides si lo aceptas o si autorizas 1 revelado más con otro contacto.
4. **NK-0174 SDD 1 Conexión Gmail**: la lectura real funcionó (0 respuestas, porque no se había escrito a Jaime). Para cerrarla, propongo que escribas un email a Jaime, él responda y repita 1 lectura.
5. **Prueba lenta de registros** (`safe-logs-notes`): supera los 5 s. Es una prueba protegida, así que necesito tu permiso para darle más tiempo o tendré que acelerar el código que comprueba.

## Bloque 2 — NK-0174 Bandeja de respuestas

**SDD 3 · U-2: guardado privado**
- Guardar la categoría, el resumen y el borrador propuesto de cada respuesta en una tabla privada de la empresa, borrada a los 30 días.
- Comprobante de cada clasificación (sin texto del cliente) para no clasificar ni cobrar dos veces lo mismo.

**SDD 3 · U-3: conexión al trabajo horario**
- La revisión horaria del buzón envía cada respuesta nueva al clasificador (Opus 5.5, sin respaldo y sin retención de datos).
- Hay frenos fijos: bajas, quejas legales y avisos de fuera de oficina nunca generan borrador.
- Límite de gasto por hora y pausa automática si hay fallos.
- Revisión independiente de seguridad antes de activarla.

**SDD 4: pantalla Bandeja de respuestas**
- Lista de respuestas con sus 7 categorías, filtros y la acción sugerida.
- Ficha con el resumen, el borrador editable, «Copiar» y «Descartar». No se envía nada desde NOKKO.
- Enlace a la persona, al lead y a la cuenta, más un aviso en el centro de actividad.
- Pruebas visuales en escritorio y móvil, con tema claro y oscuro.
- Solo para tu buzón hasta la revisión legal.

**Desviación pendiente de decidir**: al desconectar Gmail se borran los contadores. ¿Los conservo, como decía el plan original?

## Bloque 3 — Roadmap global

1. **Telegram proactivo**: crear el bot, vincular tu usuario con un enlace de un solo uso y activar avisos con silencio nocturno. Necesito el token del bot.
2. **RevOps 1b**: el Agente y el MCP podrán leer el funnel, las pérdidas, las cohortes y la tendencia semanal.
3. **Finanzas 2b**: previsión de caja, cierres mensuales y preguntas por chat (solo Owner y Sales Leader).
4. **CRM 3–4**: ofertas formales, plantillas de email, calendario en ambas direcciones e importación por CSV cuando aportes datos.
5. **UX B2B**:
   - acciones masivas y vistas guardadas en Leads y Cuentas;
   - arrastrar y soltar en Pipeline (escritorio) y deslizar en móvil;
   - pulido de accesibilidad, atajos de teclado y contraste.

## Fuera de alcance (congelado)
- Publicar o desplegar sin tu autorización.
- Torre de control GTM y Salida de Lovable.

## Lo que necesito de ti
- Decisiones del Bloque 1 (puntos 2, 3, 4 y 5).
- Si conservo los contadores de Gmail al desconectar.
- El token del bot de Telegram, cuando llegue ese bloque.

## Detalles técnicos
- U-2: tabla con RLS por org y escritura solo vía RPC privilegiada; retención por cron de Inngest; recibos idempotentes por message_id.
- U-3: el paso Inngest devuelve solo contadores; el adaptador `classification-provider.server.ts` ya existe.
- SDD 4: nueva ruta bajo `_authenticated`, con componentes en `src/components/reply-inbox/` y datos leídos con queryOptions en el loader.
- Las pruebas protegidas no se modifican sin tu permiso explícito.
