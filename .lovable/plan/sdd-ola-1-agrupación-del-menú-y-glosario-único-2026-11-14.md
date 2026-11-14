# SDD · Ola 1: agrupación del menú y glosario único

**Estado: presentado sin OK escrito previo; resultado implementado y aceptado posteriormente por Fede a las 22:57 UTC.** Fecha: 14-11-2026. No registrar este SDD como aprobado: la aceptación posterior del resultado no constituye aprobación previa.
**Referencia:** `docs/ux-audit/AUDITORIA-UX-20261114.md`, sección 5.2; alcance aprobado en chat a las 22:46 UTC. No se implementará antes de aprobar este SDD.

## Objetivo y cambio
Organizar el menú por intención, con una lista diaria de cuatro destinos siempre visible. Conservar las pantallas, URLs, roles y funcionalidades actuales. Aplicar el glosario únicamente a textos visibles, sin renombrar identificadores.

| Orden | Sección | Destinos, en este orden |
|---|---|---|
| 1 | Hoy | Inicio `/home`, Sugerencias `/inbox`, Aprobaciones `/approvals`, Respuestas `/replies` |
| 2 | Diseñar | Onboarding `/onboarding`, Configuración `/setup`, Estrategia GTM `/strategy`, Productos `/products`, Conocimiento `/hub` |
| 3 | Ejecutar | Cuentas `/accounts`, Leads `/leads`, Personas `/people`, Pipeline `/deals`, Plays GTM `/plays`, ABM y partners `/abm`, Descubiertos `/discoveries` |
| 4 | Medir y aprender | Métricas `/metrics`, Asesor GTM `/advisor`; en modo avanzado: Ciclo GTM `/cycle`, Debates `/debates`, Theory U `/theory-u` |
| 5 | Ajustes | Empresa `/company`, Equipo `/team`, Conexiones `/integrations`, Memoria `/memory` |

- **Hoy:** encabezado visible y no plegable. Las otras cuatro secciones son plegables y se abren al navegar a uno de sus destinos visibles.
- **Modo avanzado del menú:** interruptor con texto en «Medir y aprender», apagado inicialmente. Preferencia local por usuario, leída después de la carga inicial. Solo oculta/muestra esos tres enlaces; no oculta contenido de Métricas, MEDDPICC ni otras herramientas. Si falla el almacenamiento, el interruptor sigue funcionando durante la sesión. Una URL avanzada abierta directamente sigue funcionando sin activar la preferencia.
- **Conectar asistentes:** deja de ser un destino independiente del menú; permanece en Conexiones mediante el enlace existente a `/connect`. Se mantiene en ⌘K y su URL no cambia.
- **⌘K:** contiene todos los destinos, incluidos los avanzados y `/connect`, sin duplicar Onboarding ni Respuestas. Conserva la apertura del registro concreto y el filtro `leadersOnly`, independiente del modo avanzado.
- Se conserva `leadersOnly` del Asesor; no se amplían restricciones a otros destinos ni se modifican permisos. La barra inferior móvil y el acceso al agente no cambian.

## Glosario 1.2
Aplicar la sección 5.2 de la auditoría: **Cuenta** (empresa a la que vendes), **Persona** (contacto de una cuenta), **Lead** (persona en cualificación), **Deal** (negociación con importe), **Sugerencia** (propuesta de Nokko), **Tarea** (compromiso del equipo), **Aprobación**, **Play**, **Guía de venta**, **Conexiones**, **Valor anual (ACV)**, **Modelo de venta**, **Equipo** (personas) y **grupos de plays** (agrupaciones de plays).

Mantener literalmente los nombres de destinos pedidos: «Pipeline», «Plays GTM», «ABM y partners», «Onboarding» y «Theory U». No sustituir cualquier «Importe» por ACV: solo campos que realmente miden valor anual; no cambiar importes de costes, facturas o ingresos. Los sinónimos útiles siguen como palabras de búsqueda. No modificar prompts de IA, esquemas, nombres de herramientas, claves, tablas ni identificadores.

## Archivos afectados al implementar
| Archivo o área | Cambio permitido |
|---|---|
| `src/lib/nav.ts` | Cinco grupos, visibilidad avanzada, conservación de roles y catálogo completo de destinos |
| `src/lib/nav.test.ts` | Solo adaptar expectativas de agrupación autorizadas; conservar límites, roles, búsqueda por «equipos» y apertura contextual |
| `src/routes/_authenticated/route.tsx` | Presentar Hoy, grupos e interruptor; conservar barra móvil, cierre del menú y barra plegada |
| `src/components/command-palette.tsx`, `src/lib/palette.ts` | Listado completo, sin duplicados, roles y textos del glosario |
| Nuevo módulo local de preferencia y sus pruebas | Preferencia del modo avanzado, sin cambios de datos remotos |
| Textos de pantallas y paneles existentes, `src/lib/field-help-data.ts` | Sustituciones puntuales del glosario; lista exacta en el informe de entrega. Integraciones excluidas |
| Nuevas pruebas junto a las actuales | Cobertura de agrupación, avanzado, roles, destinos y significado de conceptos |
| `AGENTS.md`, SDD e informe de entrega | Documentar la estructura y las verificaciones, sin duplicar reglas |

No modificar ninguna otra prueba existente. Si un texto está protegido por otra prueba que exige la variante antigua, detener esa sustitución y pedir permiso, sin debilitarla. No hacer reformateos masivos.

## Criterios de aceptación y prueba primero
| CA | Resultado exigido | Verificación |
|---|---|---|
| 1 | Cinco secciones y destinos en el orden exacto de la tabla; Hoy contiene exactamente cuatro enlaces y no se pliega | Expectativas de agrupación en `nav.test.ts` y prueba nueva del catálogo |
| 2 | Todos los destinos anteriores siguen disponibles, con sus URLs intactas, más Onboarding y Respuestas; `/connect` no desaparece del catálogo | Prueba nueva comparando el conjunto literal de destinos y el listado de ⌘K |
| 3 | Ciclo, Debates y Theory U ocultos por defecto en el menú; visibles al activar avanzado, siempre disponibles en ⌘K | Pruebas nuevas de selección visible y preferencia, más recorrido en navegador |
| 4 | Asesor mantiene `leadersOnly`: aparece para Owner/Sales Leader y no para otros miembros, tanto en menú como en ⌘K | Prueba existente adaptada solo al nuevo grupo y prueba nueva de selección de ⌘K |
| 5 | Conectar asistentes se alcanza desde Conexiones y desde ⌘K, sin alterar `/connect` | Prueba nueva de catálogo; recorrido del enlace ya existente |
| 6 | Grupos se abren en el destino activo; el menú móvil se cierra al navegar y la barra inferior conserva sus accesos | Regresiones existentes intactas y navegador autenticado escritorio/375 px, claro/oscuro |
| 7 | Los conceptos siguen el glosario, sin confundir ACV con otros importes ni Equipo con grupos de plays | Pruebas nuevas sobre selección semántica de conceptos; inspección del diff y revisión visual de textos, sin pruebas de snapshots/copy |

Por pieza: escribir primero una prueba que falle por la regla correspondiente, aplicar el cambio mínimo y ejecutar las regresiones. Al cierre: suite completa, tipos mediante comprobación permitida, lint de lo tocado y resultado de compilación automática; informar por separado cualquier fallo global preexistente. No afirmar «todo verde» si algún control falla o no se ejecutó.

## Riesgos y reversión
- **Preferencias antiguas de grupos:** conservar las claves reutilizables; los grupos nuevos parten plegados salvo el activo. La preferencia avanzada no cambia permisos.
- **Destinos duplicados en ⌘K:** deduplicar por URL sin perder palabras de búsqueda ni reglas de visibilidad.
- **Rótulo largo y menú móvil:** verificar que «Medir y aprender» y controles caben, sin desplazamiento horizontal; respetar tokens, componentes e iconos con texto.
- **Glosario demasiado amplio:** cambios solo de presentación; parar cualquier sustitución que requiera cambiar lógica o una prueba no autorizada.
- **Reversión:** restaurar únicamente el diff de esta entrega en menú, preferencia, ⌘K y textos. Sin migraciones ni datos que revertir; la preferencia local nueva queda ignorada por la versión anterior. No realizar operaciones de historial ni publicación desde este entorno.

## Fuera de alcance y verificaciones pendientes
**Migraciones: ninguna. Pantallas nuevas: ninguna. IA y gasto: ninguno.**
Sin bandeja única, fusión Configuración/Onboarding, traslado de reglas/voz, cambios de rutas, permisos/RLS, proveedores o conexiones. Drive, Gmail, Apollo, Clay y Apify/LinkedIn permanecen intactos. Sin publicación.

SDD basado en lectura del código; implementación, pruebas, revisión independiente y recorrido visual pendientes de aprobación. Drive se responde por separado en chat, solo lectura.