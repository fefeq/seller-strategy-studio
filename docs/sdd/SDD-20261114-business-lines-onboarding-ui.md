# SDD-20261114-business-lines-onboarding-ui · [Feature] Líneas en onboarding

**Tipo:** Feature · **Prioridad propuesta:** Media
**Estado:** En curso · **Pide:** Fede · **Aprueba:** autorización general de la cola · **Fecha:** 2026-11-14
**PRD:** docs/prd/PRD-20261113-onboarding-lineas-de-negocio.md · **Depende de:** SDD-20261114-business-lines-model

## 1. Resumen
Editar líneas de negocio completas en el paso diagnosis y conservar la escritura personal de la principal durante la ventana de transición.
## 2. Problema y para quién
Owner y Sales Leader necesitan líneas distintas sin repetir el diagnóstico de cada persona.
## 3. Evidencia y por qué ahora
Una principal copiada y validada en base compartida. La pantalla todavía usa solo onboarding_sessions. Integridad y copia del SDD 1 implementadas; concurrencia real y revisión independiente pendientes, no se declaran cerradas.
## 4. Resultado buscado
G-1/G-2: guardar líneas completas y llegar a la hoja de ruta sin perder respuestas ni bloquear por falta de propuesta. Sin datos de uso.
## 5. Alcance
Incluye núcleo de edición, lectura miembro, paso de líneas, principal, quitar y reintento de escritura personal. No incluye consumidores de Inicio/estrategia/agente/MCP, IA, envíos, publicación ni cambios de pruebas protegidas.
## 6. Delta
Paso diagnosis conserva id y cambia etiqueta a Líneas de negocio; edición en business_lines y escritura personal de compatibilidad. Diagnóstico calculado con motor existente.
## 7. Historias y aceptación
- CA-1 · G-1: solo Owner/Sales Leader guardan respuestas completas; ticket >0, máximo 4 y nombre opcional de hasta 200 caracteres; invalidaciones no escriben.
- CA-2 · G-1: principal usa RPC invoker; quitar solo Owner, nunca última, y deja principal de sucesora. Cero filas devueltas se trata como fallo.
- CA-3 · G-2: tras confirmar líneas, escribe diagnóstico calculado de principal en sesión personal. Fallo de esa escritura no deshace la línea ni repite su creación; queda reintento explícito. Sin propuesta se permite roadmap.
- CA-4 · G-1: refrescos conservan ediciones locales; cambio de empresa no escribe ni mezcla líneas. Errores pasan por errorText.
## 8. Casos límite
Sin principal leída no avanzar. Refresco fallido tras escritura no significa que la línea no se guardó. Proteger contra doble envío. No copiar diagnósticos desde el cliente; nueva repetición administrativa antes de abrir la pantalla.
## 9. Experiencia
Lista de líneas con principal y diagnóstico; formulario de cuatro respuestas y nombre opcional. Quitar usa askConfirm, Sales Leader ve motivo de restricción. El roadmap indica líneas adicionales.
## 10. Datos y privacidad
Cliente miembro con RLS; org_id no se pasa en escrituras salvo conflicto de sesión existente. Ningún ticket/nombre sale en logs. Tabla exige cardinalidad, principal y aislamiento; núcleo también valida antes de escribir.
## 11. IA
Ninguna llamada; coste cero.
## 12. Unidades
U-1 núcleo con puertos tipados y pruebas nuevas primero; U-2 hook miembro y pantalla; U-3 copia repetida, suite e interacción sintética escritorio/móvil claro/oscuro e informe.
## 13. Técnica
Núcleo independiente de React; puerto explícito para guardar línea, RPC, releer y escribir compatibilidad. Fallo posterior a commit se distingue de fallo previo. Hook invalida caché por empresa.
## 14. Riesgos
Escritura doble no atómica aceptada por Fede; no revertir línea al fallar sesión. Mantener consumidores actuales hasta SDD 3/4.
## 15. Decisiones
Tope cuatro, etapa por línea, principal explícita, solo Owner quita y transición hasta sprint posterior al SDD 4: docs/decisiones-fede-20261113.md. Sin preguntas nuevas.
## 16. Verificación
Pruebas nuevas primero para validación, roles, última línea, filas vacías y reintento que no repite creación. Pantalla pendiente hasta U-2/U-3; no afirmar flujo completo con pruebas del núcleo.
## 17. Revisión independiente
Pendiente, no efectuada por el autor.
## 18. Delta de implementación
U-1 implementada: business-lines-editor.ts valida respuestas, roles, tope y nombre, usa puertos para RPC y escritura, comprueba filas afectadas y diferencia confirmación de línea de fallo de sincronización personal. Reintento exclusivo de sincronización no repite creación ni RPC. Siete pruebas nuevas fallaron primero por módulo ausente y ahora pasan. Suite 5852/5852, 368 archivos; build automático OK 00:59:43 UTC tras avisos esperados del módulo aún ausente. Ninguna prueba existente modificada. Sin UI nueva ni llamadas IA/externas; no se afirma recorrido visual. U-2 hook/pantalla y U-3 verificación siguen pendientes. Tipos sin ejecución manual por restricción del entorno.U-2 (parcial, 2026-11-14): hook miembro src/hooks/use-business-lines.ts (puertos RLS + RPC invoker) y pantalla src/components/onboarding/business-lines-step.tsx (catálogo hasta 4, principal, quitar solo Owner con askConfirm y motivo visible para Sales Leader, nunca la última, reintento de sincronización, protección de doble envío). 4 pruebas nuevas. NO conectada a /onboarding: dos pruebas protegidas de -onboarding.test.tsx exigen la etiqueta «4. Diagnóstico» y el botón «Usar este diagnóstico» guardando {input,result}; conectarla requiere permiso de Fede para cambiar esas expectativas. Suite 5866/5866. Sin publicar.
