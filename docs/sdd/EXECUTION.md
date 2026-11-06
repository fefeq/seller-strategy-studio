# Instrucciones para el agente de implementación (Claude Code)

Eres el agente de implementación de NOKKO (repo seller-strategy-studio). Implementas SDD (spec-driven development) de `docs/sdd/`. Textos de producto en español, siempre «tú», sin iconos, estados con palabra. Código, identificadores y commits en inglés.

## 0. Lectura obligatoria antes de tocar nada
1. `AGENTS.md` y `src/lib/AGENTS.md`.
2. `docs/sdd/README.md` (índice, orden, decisiones de Fede) y `docs/sdd/AUDIT-20261025.md`.
3. El SDD que vas a ejecutar, entero, y los SDD de los que depende.
4. `docs/sdd/annex/field-inventory-20261025.md` si tocas campos o esquema.

## 1. Qué SDD puedes ejecutar
- Solo los que el usuario nombre en su mensaje. Si te dice que Fede lo aprueba, cambia su Estado a «Aprobado» y registra la fecha.
- Si un SDD tiene [Por verificar] en su sección 16 que afecte a tu código, verifícalo tú en el repo y anótalo en el SDD. Si no puedes (producción, proveedores externos, datos reales), para y lista las preguntas. No supongas.
- No rellenes la sección 17 («Revisión técnica independiente»): la hace un agente `nokko-gate` con contexto fresco.
- Si el SDD contradice el código o una decisión del README, para y avisa.

## 2. Orden y dependencias
1. SDD 1 universal-field-definitions.
2. SDD 2 field-actions-edit-delete-confirm, SDD 3 strategy-setup-guided-next-step, SDD 10 connections-bring-your-own-account (con SDD 5 drive-per-company-account), SDD 6 discoveries-scoped-manual-search.
3. SDD 7a, 7b, 7c (fit-data), SDD 8 products, SDD 9 theory-u, SDD 4 onboarding (épica: dos entregas).
4. Tanda 2026-11-06, en este orden y de uno en uno: `frontal-rules-integration` U-1; `signal-freshness`; `proven-findings`; `frontal-rules-integration` U-3 y después U-4. La U-2 de `frontal-rules-integration` está sustituida por `signal-freshness`: no la implementes. Antes de abrir el PR de cada unidad, `bun install`, Los datos reales que el SDD marque «sin dato» no se consultan: se anotan solo si Fede los aporta.
Dentro de un SDD, sigue sus unidades de trabajo (U-1, U-2…) en orden.

## 3. Git
- Una rama por SDD desde la base que indique el usuario, nombre `feat/<slug-del-sdd>`. Nunca commit ni push a `main` ni a `production`.
- Commits pequeños en inglés, citando SDD y unidad. Añade las líneas de atribución de tu entorno.
- PR en borrador por SDD con: resumen, tabla CA → archivo/prueba, qué queda fuera, riesgos y migraciones. No lo marques listo ni lo fusiones.

## 4. Cómo implementar
- Cada CA-n tiene al menos una prueba automática que lo nombra. Reglas en módulos puros con prueba.
- Las «Notas técnicas [Sugerencia — la revisión del gate las valida]» son sugerencias; si las cambias, explica por qué en el PR.
- Base de datos: migraciones nuevas en `drizzle/migrations` con GRANTs, RLS por empresa (`org_id` con valor por defecto `current_org()`); respeta que solo el Owner gestiona miembros. No cambies migraciones aplicadas ni toques datos reales.
- IA: regla determinista → caché/dato derivado → modelo barato (`effort:"low"` por `src/lib/ai-gateway.ts`, con esquema) → modelo caro solo en «A fondo». Una llamada nueva no declarada en el SDD: para y pregunta.
- Nunca inventes ni estimes cifras, precios ni testimonios. Si falta, «Falta» o «sin dato».
- Privacidad: ningún dato de clientes en código, pruebas, fixtures ni logs. Datos ficticios. No registres ni muestres credenciales.
- LinkedIn: solo API oficial. NOKKO no valora perfiles de LinkedIn.
- Lo escrito por una persona nunca se sobrescribe por un proceso automático: queda como propuesta pendiente.
- Reutiliza antes de crear: `applySetupItems`/`undoSetupItems`, `provenance.ts`, registro de herramientas del agente, motor proactivo, `background_jobs`, panel de presupuesto.

## 5. Verificación antes de cada PR
1. Tipos, lint y pruebas según `AGENTS.md`/`package.json`: todo en verde.
2. Migraciones solo en entorno local o de pruebas; comprueba la RLS con dos empresas ficticias.
3. Recorre en local los flujos de cada historia y los casos límite de la sección 8.
4. Revisa tu diff como lo haría el gate: CA sin prueba, decisiones no justificadas, datos sensibles.
5. Actualiza el Estado del SDD a «En curso» (a «Hecho» solo cuando el gate pase y Fede apruebe la entrega) y añade el delta final si lo entregado difiere.

## 6. Para y pregunta cuando
- Un [Por verificar] que no puedas comprobar.
- Contradicción entre SDD, código o decisiones.
- Un cambio de esquema que pierda o reinterprete datos existentes.
- Algo que requiera credenciales, producción, un proveedor de pago o enviar mensajes a terceros.
- Un CA que no puedas probar sin inventar datos.

## 7. Nunca
- Push o merge a `main`/`production`, desplegar, ni tocar producción.
- Crear tickets, documentos en Drive o mensajes a terceros o a clientes.
- Instalar proveedores nuevos ni contratar servicios.
- Tocar nada de Postin: sus repos, proyectos, servidores MCP, bases de datos ni documentos. NOKKO es independiente; si una herramienta apunta a Postin, no la uses.
- Ampliar el alcance («No incluye»). Anota las mejoras en el PR como sugerencia.

## 8. Entrega final
Por SDD: enlace al PR, tabla CA → prueba, migraciones, riesgos, preguntas abiertas para Fede y qué SDD puede arrancar ahora.
