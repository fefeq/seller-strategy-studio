# GTM Brain: sistema operativo comercial del equipo

Una sola app donde cada rol del ciclo de venta trabaja desde el mismo contexto: conocimiento compartido, base única de personas y cuentas, y herramientas estratégicas para preparar y cerrar cada deal.

## 1. Roles del ciclo de venta
Cada usuario tiene un rol; el inicio (/home) y los permisos se adaptan a él.

| Rol | Qué hace | Vista principal |
|---|---|---|
| GTM Owner / RevOps | Construye y entrena el sistema, aprueba cambios, promueve skills | Aprobaciones, reglas, skills, métricas |
| Sales Leader (VP / Head) | Forecast, pipeline, coaching | Pipeline por etapa, forecast, deals en riesgo |
| Marketing / Demand Gen | Campañas, listas, contenido, intención | Campañas, fuentes, rendimiento |
| SDR / BDR | Prospección, cualificación, reuniones | Cola de leads por tier, secuencias, research |
| Account Executive (AE) | Discovery, demo, propuesta, cierre | Mis deals, Account Plans, Meeting Planner |
| Sales Engineer / Preventa | Demos técnicas, POCs, seguridad | Requisitos técnicos y POCs por deal |
| Customer Success / Account Manager | Onboarding, renovación, expansión | Salud de cuentas, renovaciones, upsell |
| Deal Desk / Finanzas / Legal | Precios, descuentos, contratos | Aprobaciones de descuento y contratos |
| Sales Enablement | Playbooks, formación, mensajes | Playbooks, objeciones, battlecards |

Regla común: nadie borra registros salvo el Owner; cada cambio guarda quién lo hizo.

## 2. Landing pública (/)
Explica el sistema (cerebro compartido, roles, herramientas, base de personas, CRM automático) con botón "Entrar".

## 3. Hub de conocimiento (/hub)
- Empresa: servicios, ICP, buyer personas, ofertas, precios, propuesta de valor.
- Objeciones y battlecards de competidores.
- Playbooks por etapa: prospección, discovery, demo, negociación, traspaso a CS.
- Metodología de venta (p. ej. MEDDPICC) como plantilla reutilizable.
- Campañas: lista, copy y qué consiguió.
- Llamadas: resumen, próximos pasos, vinculadas a cuenta y deal.
- Skills de equipo y personales (el Owner promueve una personal a equipo).
- Reglas: lo que los agentes no pueden hacer sin una persona.

## 4. Capa estratégica por vendedor
- **Account Plan**: objetivos de la cuenta, situación actual, dolores, iniciativas, oportunidades de whitespace, competidores, riesgos, plan de acción con fechas y responsables.
- **Stakeholder Research / Mapa de poder**: personas de la cuenta con rol (decisor, champion, influenciador, bloqueador, usuario), nivel de apoyo, prioridades, historial de interacciones y organigrama visual.
- **Meeting Planner**: por reunión, objetivo, asistentes (desde el mapa), agenda, preguntas de discovery, objeciones esperadas, materiales y resultado deseado; tras la reunión, notas y próximos pasos que actualizan la cuenta.
- **Deal Qualification (MEDDPICC)**: puntuación por criterio con huecos visibles.
- **Mutual Action Plan**: hitos compartidos con el cliente hasta la firma.
- **Call Prep con IA**: un botón genera brief de cuenta, research de stakeholders y preguntas sugeridas a partir de todo el contexto guardado.
- **Propuesta / Business case**: borrador con ROI, generado con IA desde el Account Plan.

## 5. Base única de personas y cuentas (/people, /accounts)
- Una fila por persona, sin duplicados por email o LinkedIn.
- Fuente (lista fría, interacción en post, visita web), tier, etapa de secuencia, etapa CRM.
- Historial de resultados de campaña (enviado, respondió, reservó…); filtro "respondió y no reservó".
- Importación CSV que omite duplicados e informa cuántos.

## 6. Pipeline y deals (/deals)
Tablero por etapas, valor, fecha de cierre, probabilidad, salud, vinculado a Account Plan, stakeholders y reuniones. Vista forecast para el Sales Leader.

## 7. Bandeja de aprobaciones (/approvals)
Cambios propuestos (mover etapa, fusionar duplicados, descuento) con evidencia; Aplicar / Omitir según rol.

## 8. Integraciones (mapa de tooling)
Se muestran en una página de Integraciones con su estado. En esta primera versión quedan como conectores planificados; se activan uno a uno después:
- Conocimiento: GitHub (repo del cerebro GTM).
- Llamadas: Fireflies / Gong.
- CRM: Attio / HubSpot.
- Comunicación y aprobaciones: Slack.
- Email y calendario: Gmail / Google Calendar (para el Meeting Planner).
- Enriquecimiento y datos: Apollo, Clay, LinkedIn Sales Navigator.
- Secuencias: Instantly / Lemlist.
- Firma y propuestas: DocuSign / PandaDoc.

## Fuera de alcance de esta versión
Sincronizaciones reales y agentes automáticos nocturnos: se conectan después, empezando por los que elijas.

## Detalles técnicos
- Lovable Cloud: auth email/contraseña; `profiles`; `user_roles` con enum (owner, sales_leader, marketing, sdr, ae, se, cs, deal_desk, enablement) y `has_role`.
- Tablas: `knowledge_docs`, `accounts`, `account_plans`, `stakeholders` (con reports_to para organigrama), `deals`, `deal_qualification`, `meetings`, `mutual_action_items`, `people` (únicos en lower(email) y linkedin normalizado), `campaigns`, `campaign_results`, `calls`, `approvals`, `integrations`.
- RLS: autenticados leen; escritura con `created_by/updated_by = auth.uid()`; DELETE solo owner; skills personales solo para su autor.
- IA con Lovable AI Gateway vía server functions para Call Prep y propuestas.
- Rutas protegidas bajo `_authenticated`; estética de herramienta interna sobria con tipografía propia.
- Tests: deduplicación del importador y permiso de borrado solo para owner.
