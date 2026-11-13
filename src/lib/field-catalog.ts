// Field catalog (SDD universal-field-definitions, U-1): one definition per concept and where each concept
// lives. Pure data plus lookups, so screens, the agent, imports and Descubiertos read the same meaning.
// The catalog is code: whoever can change the repo changes a definition, and field-catalog.test.ts fails
// when a binding points to a column that no longer exists. Values are never converted here; rules that
// normalize them (U-2) and the origin stamp (U-3) read these definitions.
import { COUNTRY_CODES, REGIONS } from "@/lib/assignment";
import { SOURCES as PERSON_SOURCES } from "@/lib/roles";
import { LOSS_REASON_KEYS } from "@/lib/loss-reasons";
import { ACQUISITION_MOTIONS } from "@/lib/acquisition-motion";

/** How a field is kept while someone edits it (SDD section 5). */
export type Persistence = "permanent" | "screen_draft" | "session" | "pending_action" | "memory";

export const PERSISTENCE_LABEL: Record<Persistence, string> = {
  permanent: "Guardado",
  screen_draft: "Borrador de pantalla",
  session: "Sesión",
  pending_action: "Acción pendiente del Agente",
  memory: "Memoria",
};

export type ValueKind = "text" | "text_list" | "int_range" | "number" | "enum" | "origin";

export type ConceptId =
  | "pais"
  | "paises"
  | "region"
  | "geografia_texto"
  | "tamano_empleados"
  | "tamano_descripcion"
  | "importe"
  | "origen_valor"
  | "canal_de_entrada"
  | "creado_por"
  | "fuente_citada"
  | "motivo_perdida"
  | "detalle_perdida"
  | "competidor_perdida"
  | "regla_experimento"
  | "fecha_revision"
  | "decision_experimento"
  | "elemento_cambio"
  | "registro_decision"
  | "motion_adquisicion"
  | "clave_usuario"
  | "clave_empresa"
  | "direccion_email"
  | "estado_email"
  | "estado_proveedor_email"
  | "clave_registro"
  | "superficie_borrador"
  | "motivo_bloqueo_email"
  | "alta_sistema"
  | "clave_play"
  | "nombre_play"
  | "definicion_play"
  | "solo_verificado"
  | "url_evidencia"
  | "cita_evidencia"
  | "fecha_evento"
  | "cambio_sistema"
  | "estado_play"
  | "primera_activacion"
  | "muestra_prueba"
  | "exitos_prueba"
  | "fecha_prueba"
  | "tipo_coste";

export type Concept = {
  id: ConceptId;
  label: string;
  meaning: string;
  kind: ValueKind;
  /** Canonical format, in words. */
  format: string;
  /** Closed values, when the concept has one set for every place. */
  allowed?: readonly string[];
  /** Closed values that differ per table (the set belongs to the object, not to the concept). */
  allowedBy?: Record<string, readonly string[]>;
  /** How the value is shown. */
  display: string;
};

export const CONCEPTS: Concept[] = [
  { id: "clave_play", label: "Play a medida (clave)", meaning: "Clave del play a medida dentro de la empresa.", kind: "text", format: "custom: + minúsculas, números, - o _", display: "No se muestra" },
  { id: "nombre_play", label: "Nombre del play", meaning: "Nombre visible del play a medida.", kind: "text", format: "1 a 200 caracteres", display: "Nombre" },
  { id: "definicion_play", label: "Definición del play", meaning: "Receta validada del play a medida (puertas, mensaje, prueba).", kind: "text", format: "JSON validado por plays/custom/model", display: "No se muestra" },
  { id: "solo_verificado", label: "Solo contacto verificado", meaning: "El play solo usa contactos con email verificado.", kind: "enum", format: "Sí/No, por defecto No", allowed: ["true", "false"], display: "Interruptor" },
  { id: "url_evidencia", label: "Fuente de la prueba", meaning: "Dirección pública que respalda una afirmación.", kind: "text", format: "http(s)://", display: "Enlace" },
  { id: "cita_evidencia", label: "Cita", meaning: "Fragmento literal de la fuente, sin emails ni teléfonos.", kind: "text", format: "Máximo 280 caracteres", display: "Cita entre comillas" },
  { id: "fecha_evento", label: "Fecha del evento", meaning: "Fecha en que ocurrió la señal citada, no la de lectura.", kind: "text", format: "AAAA-MM-DD o vacía si es ambigua", display: "Fecha corta" },
  { id: "cambio_sistema", label: "Última modificación", meaning: "Momento del último cambio de un registro de sistema.", kind: "text", format: "Fecha y hora", display: "No se muestra" },
  { id: "clave_registro", label: "Registro (clave)", meaning: "Identificador único de un registro de sistema.", kind: "text", format: "uuid", display: "No se muestra" },
  { id: "superficie_borrador", label: "Origen del borrador", meaning: "Superficie en la que se bloqueó la preparación de un borrador.", kind: "enum", format: "Valor cerrado", allowed: ["draft_followup", "followup_sequence"], display: "Agente o seguimiento proactivo" },
  { id: "motivo_bloqueo_email", label: "Motivo del bloqueo", meaning: "Razón del bloqueo y siguiente paso, sin dirección de email.", kind: "text", format: "Máximo 300 caracteres", display: "Motivo en español" },
  { id: "estado_play", label: "Estado del play", meaning: "Estado de un play a medida: aprobado, activo, pausado o archivado.", kind: "enum", format: "Valor cerrado", allowed: ["aprobado", "activo", "pausado", "archivado"], display: "Etiqueta" },
  { id: "primera_activacion", label: "Primera activación", meaning: "Momento en que el play se activó por primera vez.", kind: "text", format: "Fecha y hora", display: "No se muestra" },
  { id: "muestra_prueba", label: "Muestra de la prueba", meaning: "Contactos usados en la prueba del play.", kind: "text", format: "Entero positivo", display: "Número" },
  { id: "exitos_prueba", label: "Éxitos de la prueba", meaning: "Respuestas positivas obtenidas en la prueba.", kind: "text", format: "Entero ≥ 0", display: "Número" },
  { id: "fecha_prueba", label: "Fecha del resultado", meaning: "Cuándo se registró el resultado de la prueba.", kind: "text", format: "Fecha y hora", display: "Fecha corta" },
  { id: "tipo_coste", label: "Tipo de coste", meaning: "Si el coste es de IA medido, de IA sin dato o estimado de proveedor.", kind: "enum", format: "Valor cerrado", allowed: ["ai_measured", "ai_sin_dato", "provider_estimated"], display: "No se muestra" },
  { id: "clave_empresa", label: "Empresa (clave)", meaning: "Empresa propietaria de un registro.", kind: "text", format: "uuid", display: "No se muestra" },
  { id: "direccion_email", label: "Email", meaning: "Dirección normalizada de contacto.", kind: "text", format: "Minúsculas sin espacios exteriores", display: "Dirección" },
  { id: "estado_email", label: "Estado del email", meaning: "Estado comunicado por el proveedor para una dirección.", kind: "enum", format: "Valor cerrado", allowed: ["verified", "catch_all", "unverifiable", "invalid", "unverified"], display: "Estado efectivo en español" },
  { id: "estado_proveedor_email", label: "Estado del proveedor", meaning: "Valor original corto para auditoría de verificación.", kind: "text", format: "Máximo 120 caracteres", display: "No se muestra" },
  {
    id: "pais",
    label: "País",
    meaning: "Dónde está una cuenta o una regla de asignación.",
    kind: "text",
    format: "ISO 3166-1 alpha-2 en mayúsculas («ES», «GB»)",
    allowed: COUNTRY_CODES,
    display: "Nombre del país en español (countryName)",
  },
  {
    id: "paises",
    label: "Países",
    meaning: "Lista de países de un criterio (ICP).",
    kind: "text_list",
    format: "Cada elemento con el formato de País, sin repetidos",
    allowed: COUNTRY_CODES,
    display: "Nombres en español, uno por etiqueta",
  },
  {
    id: "region",
    label: "Región",
    meaning: "Agrupación derivada del país; solo se guarda como criterio de una regla.",
    kind: "enum",
    format: "Valor cerrado",
    allowed: Object.keys(REGIONS),
    display: "Etiqueta de REGIONS",
  },
  {
    id: "geografia_texto",
    label: "Geografía en palabras",
    meaning: "Zona descrita en texto libre; apoyo cuando no hay países.",
    kind: "text",
    format: "Texto libre",
    display: "Tal cual se escribió",
  },
  {
    id: "tamano_empleados",
    label: "Tamaño (empleados)",
    meaning: "Número de empleados de una empresa o de la empresa objetivo.",
    kind: "int_range",
    format: "Rango de enteros mayores que 0; una cifra exacta tiene mínimo igual a máximo",
    display: "«51–200 empleados», «más de 500 empleados»",
  },
  {
    id: "tamano_descripcion",
    label: "Tamaño en palabras",
    meaning: "Tamaño descrito con facturación, etapa u otras palabras; no es número de empleados.",
    kind: "text",
    format: "Texto libre",
    display: "Tal cual se escribió",
  },
  {
    id: "importe",
    label: "Importe",
    meaning:
      "Cantidad de dinero en la moneda de la empresa; cada lugar declara su naturaleza y su periodicidad.",
    kind: "number",
    format: "Número con dos decimales como máximo; cambiar la moneda reetiqueta, no convierte",
    display: "formatMoney con la moneda de la empresa",
  },
  {
    id: "origen_valor",
    label: "Origen del valor",
    meaning: "De dónde viene un valor y si está confirmado.",
    kind: "origin",
    format:
      "Tipo (persona, fuente, ia, supuesto, sin_dato), detalle, confirmado, quién y cuándo, cita opcional",
    allowed: ["persona", "fuente", "ia", "supuesto", "sin_dato"],
    display: "Palabra de estado: Confirmado, Deducido, Supuesto",
  },
  {
    id: "canal_de_entrada",
    label: "Canal de entrada",
    meaning: "Por qué canal llegó una persona o un deal.",
    kind: "enum",
    format: "Valor cerrado distinto por objeto",
    allowedBy: {
      deals: ["outbound", "inbound", "partner", "plg", "event", "referral"],
      people: Object.keys(PERSON_SOURCES),
    },
    display: "Etiqueta en español del valor",
  },
  {
    id: "creado_por",
    label: "Creado por",
    meaning: "Quién o qué creó el registro.",
    kind: "enum",
    format: "Valor cerrado distinto por objeto",
    allowedBy: {
      tasks: ["manual", "agent", "debate", "strategy"],
      agent_pending_actions: ["agent", "mcp"],
      memories: ["chat", "meeting", "decision", "suggestion", "manual"],
    },
    display: "Etiqueta en español del valor",
  },
  {
    id: "motivo_perdida",
    label: "Motivo de pérdida",
    meaning: "Por qué se perdió un deal; vacío es «sin dato», nunca se deduce.",
    kind: "enum",
    format:
      "Valor de una lista cerrada (Precio, Competidor, Sin decisión, Sin presupuesto, Sin encaje con el producto, Mal momento, Cambio de contacto, Otro)",
    allowed: LOSS_REASON_KEYS,
    display: "Etiqueta en español (lossLabel)",
  },
  {
    id: "detalle_perdida",
    label: "Detalle de la pérdida",
    meaning: "Texto libre que acompaña al motivo de pérdida.",
    kind: "text",
    format: "Texto libre de hasta 500 caracteres",
    display: "Tal cual se escribió",
  },
  {
    id: "competidor_perdida",
    label: "Competidor de la pérdida",
    meaning:
      "Contra quién se perdió un deal; texto libre hasta que exista la entidad competidor (SDD 7b).",
    kind: "text",
    format: "Texto libre de hasta 200 caracteres; mayúsculas y espacios no distinguen al contar",
    display: "Tal cual se escribió",
  },
  {
    id: "regla_experimento",
    label: "Criterio del experimento",
    meaning:
      "Umbral de éxito, regla de cierre o nota del cambio propuesto de un experimento; vacío es «sin definir».",
    kind: "text",
    format: "Texto libre de hasta 500 caracteres",
    display: "Tal cual se escribió",
  },
  {
    id: "fecha_revision",
    label: "Fecha de revisión",
    meaning: "Día en que un experimento en marcha se revisa para decidir.",
    kind: "text",
    format: "Fecha AAAA-MM-DD; vacía si no se ha puesto",
    display: "Fecha en formato local",
  },
  {
    id: "decision_experimento",
    label: "Decisión del experimento",
    meaning: "Qué se decidió al revisarlo; vacío es «pendiente».",
    kind: "enum",
    format: "Valor de una lista cerrada (Escalar, Ajustar, Cerrar)",
    allowed: ["scale", "adjust", "close"],
    display: "Etiqueta en español (DECISION_LABEL)",
  },
  {
    id: "elemento_cambio",
    label: "Elemento del cambio propuesto",
    meaning: "Sobre qué parte de la estrategia propone un cambio un experimento decidido.",
    kind: "enum",
    format: "Valor de una lista cerrada (ICP, Segmento, Posicionamiento, Producto y precio)",
    allowed: ["icp", "segment", "positioning", "product_price"],
    display: "Etiqueta en español (CHANGE_LABEL)",
  },
  {
    id: "registro_decision",
    label: "Quién y cuándo decidió",
    meaning: "Persona y momento en que se registró la decisión; los pone el sistema, no se editan.",
    kind: "text",
    format: "Identificador de la persona y fecha y hora",
    display: "Nombre de la persona y fecha",
  },
  {
    id: "fuente_citada",
    label: "Fuente citada",
    meaning: "Nombre del medio, dirección web o etiqueta de donde sale un hallazgo o un registro.",
    kind: "text",
    format: "Texto libre, sin valores cerrados",
    display: "Tal cual se guardó",
  },
  {
    id: "motion_adquisicion",
    label: "Motion de adquisición",
    meaning:
      "Cómo adquiere clientes un segmento (producto, venta asistida, marketing o partners); no es el modelo de venta por ACV.",
    kind: "enum",
    format: "Valor cerrado; vacío = sin definir",
    allowed: ACQUISITION_MOTIONS,
    display: "Etiqueta en español (ACQUISITION_MOTION_LABEL)",
  },
  {
    id: "clave_usuario",
    label: "Usuario (clave)",
    meaning:
      "Identificador de la persona a la que se refiere un registro de sistema; no se escribe a mano.",
    kind: "text",
    format: "Identificador de perfil (uuid)",
    display: "No se muestra en pantalla",
  },
  {
    id: "alta_sistema",
    label: "Fecha de alta (sistema)",
    meaning: "Momento en que el sistema creó el registro; no se edita.",
    kind: "text",
    format: "Fecha y hora con zona horaria",
    display: "No se muestra en pantalla",
  },
];

export type ImporteNature =
  | "acv"
  | "pago_unico"
  | "valor_estimado"
  | "objetivo"
  | "cuota"
  | "coste_adquisicion"
  | "coste_recurrente"
  | "factura"
  | "ingreso_plan"
  | "ingreso_real";
export type ImporteSpan = "anual" | "trimestral" | "mensual" | "puntual" | "sin_dato";

export type Binding = {
  table: string;
  column: string;
  concept: ConceptId;
  persistence: Persistence;
  /** Only for importe: what the amount measures. Amounts of different nature are never added or compared. */
  nature?: ImporteNature;
  span?: ImporteSpan;
  /** What is still to be checked with Dani; required when the span is sin_dato. */
  verify?: string;
  note?: string;
};

const draft = "screen_draft" as const;
const saved = "permanent" as const;

export const BINDINGS: Binding[] = [
  { table: "custom_plays", column: "id", concept: "clave_registro", persistence: saved },
  { table: "custom_plays", column: "org_id", concept: "clave_empresa", persistence: saved },
  { table: "custom_plays", column: "key", concept: "clave_play", persistence: saved },
  { table: "custom_plays", column: "name", concept: "nombre_play", persistence: saved },
  { table: "custom_plays", column: "definition", concept: "definicion_play", persistence: saved },
  { table: "custom_plays", column: "verified_only", concept: "solo_verificado", persistence: saved },
  { table: "custom_plays", column: "created_at", concept: "alta_sistema", persistence: saved },
  { table: "custom_plays", column: "updated_at", concept: "cambio_sistema", persistence: saved },
  { table: "custom_plays", column: "status", concept: "estado_play", persistence: saved },
  { table: "custom_plays", column: "first_activated_at", concept: "primera_activacion", persistence: saved },
  { table: "custom_plays", column: "test_sample", concept: "muestra_prueba", persistence: saved },
  { table: "custom_plays", column: "test_successes", concept: "exitos_prueba", persistence: saved },
  { table: "custom_plays", column: "test_recorded_at", concept: "fecha_prueba", persistence: saved },
  { table: "custom_play_evidence", column: "id", concept: "clave_registro", persistence: saved },
  { table: "custom_play_evidence", column: "org_id", concept: "clave_empresa", persistence: saved },
  { table: "custom_play_evidence", column: "play_id", concept: "clave_registro", persistence: saved },
  { table: "custom_play_evidence", column: "url", concept: "url_evidencia", persistence: saved },
  { table: "custom_play_evidence", column: "quote", concept: "cita_evidencia", persistence: saved },
  { table: "custom_play_evidence", column: "event_date", concept: "fecha_evento", persistence: saved },
  { table: "custom_play_evidence", column: "created_at", concept: "alta_sistema", persistence: saved },
  { table: "custom_play_costs", column: "id", concept: "clave_registro", persistence: saved },
  { table: "custom_play_costs", column: "cost_kind", concept: "tipo_coste", persistence: saved },
  { table: "custom_play_costs", column: "org_id", concept: "clave_empresa", persistence: saved },
  { table: "custom_play_costs", column: "play_key", concept: "clave_play", persistence: saved },
  { table: "custom_play_costs", column: "provider", concept: "fuente_citada", persistence: saved },
  { table: "custom_play_costs", column: "amount", concept: "importe", persistence: saved, nature: "coste_adquisicion", span: "puntual", note: "Gasto de una ejecución de play a medida; sobrevive al borrado del play" },
  { table: "custom_play_costs", column: "created_at", concept: "alta_sistema", persistence: saved },
  { table: "email_draft_blocks", column: "id", concept: "clave_registro", persistence: saved },
  { table: "email_draft_blocks", column: "org_id", concept: "clave_empresa", persistence: saved },
  { table: "email_draft_blocks", column: "surface", concept: "superficie_borrador", persistence: saved },
  { table: "email_draft_blocks", column: "status", concept: "estado_email", persistence: saved },
  { table: "email_draft_blocks", column: "reason", concept: "motivo_bloqueo_email", persistence: saved },
  { table: "email_draft_blocks", column: "created_at", concept: "alta_sistema", persistence: saved },
  { table: "email_verifications", column: "org_id", concept: "clave_empresa", persistence: saved },
  { table: "email_verifications", column: "email", concept: "direccion_email", persistence: saved },
  { table: "email_verifications", column: "status", concept: "estado_email", persistence: saved },
  { table: "email_verifications", column: "provider_status", concept: "estado_proveedor_email", persistence: saved },
  { table: "email_verifications", column: "provider", concept: "fuente_citada", persistence: saved },
  { table: "email_verifications", column: "source", concept: "fuente_citada", persistence: saved },
  { table: "email_verifications", column: "checked_at", concept: "fecha_revision", persistence: saved },
  { table: "email_verifications", column: "requested_by", concept: "clave_usuario", persistence: saved },
  // Pérdida de un deal (SDD estrategia F0)
  {
    table: "deals",
    column: "lost_reason",
    concept: "motivo_perdida",
    persistence: saved,
    note: "Dialog when moving to Perdido; editable later in the deal",
  },
  { table: "deals", column: "lost_reason_detail", concept: "detalle_perdida", persistence: saved },
  {
    table: "deals",
    column: "lost_competitor",
    concept: "competidor_perdida",
    persistence: saved,
    note: "Proposed from the MEDDPICC Competition note; the person edits it",
  },
  // Experimentos con criterio de cierre (SDD estrategia F2)
  {
    table: "gtm_experiments",
    column: "success_threshold",
    concept: "regla_experimento",
    persistence: saved,
  },
  {
    table: "gtm_experiments",
    column: "close_rule",
    concept: "regla_experimento",
    persistence: saved,
  },
  {
    table: "gtm_experiments",
    column: "change_note",
    concept: "regla_experimento",
    persistence: saved,
  },
  { table: "gtm_experiments", column: "review_on", concept: "fecha_revision", persistence: saved },
  {
    table: "gtm_experiments",
    column: "decision",
    concept: "decision_experimento",
    persistence: saved,
  },
  {
    table: "gtm_experiments",
    column: "change_element",
    concept: "elemento_cambio",
    persistence: saved,
  },
  {
    table: "gtm_experiments",
    column: "decided_at",
    concept: "registro_decision",
    persistence: saved,
    note: "Set by the system when the decision is saved",
  },
  {
    table: "gtm_experiments",
    column: "decided_by",
    concept: "registro_decision",
    persistence: saved,
    note: "Set by the system when the decision is saved",
  },
  // País
  {
    table: "accounts",
    column: "country",
    concept: "pais",
    persistence: saved,
    note: "FitFields saves on blur",
  },
  { table: "account_assignment_rules", column: "country", concept: "pais", persistence: saved },
  {
    table: "icp_profiles",
    column: "countries",
    concept: "paises",
    persistence: draft,
    note: "ICP editor, saved with Guardar ICP",
  },
  { table: "account_assignment_rules", column: "region", concept: "region", persistence: saved },
  { table: "icp_profiles", column: "geography", concept: "geografia_texto", persistence: draft },
  // Tamaño
  {
    table: "icp_profiles",
    column: "min_employees",
    concept: "tamano_empleados",
    persistence: draft,
  },
  {
    table: "icp_profiles",
    column: "max_employees",
    concept: "tamano_empleados",
    persistence: draft,
  },
  {
    table: "accounts",
    column: "size",
    concept: "tamano_empleados",
    persistence: saved,
    note: "Text today («123 empleados», «51-200 empleados», free text); read as a range, original kept",
  },
  {
    table: "icp_profiles",
    column: "company_size",
    concept: "tamano_descripcion",
    persistence: draft,
  },
  // Importe
  {
    table: "deals",
    column: "amount",
    concept: "importe",
    persistence: saved,
    nature: "acv",
    span: "anual",
    note: "With deal lines the deal_lines_sync trigger computes it",
  },
  {
    table: "deals",
    column: "one_off_amount",
    concept: "importe",
    persistence: saved,
    nature: "pago_unico",
    span: "puntual",
    note: "Outside the ACV",
  },
  {
    table: "leads",
    column: "amount",
    concept: "importe",
    persistence: saved,
    nature: "valor_estimado",
    span: "sin_dato",
    verify: "Si es un ACV anual como el del deal en el que se convierte.",
  },
  {
    table: "segment_targets",
    column: "amount",
    concept: "importe",
    persistence: saved,
    nature: "objetivo",
    span: "trimestral",
  },
  {
    table: "quotas",
    column: "amount",
    concept: "importe",
    persistence: saved,
    nature: "cuota",
    span: "sin_dato",
    verify: "Formato de quotas.period.",
  },
  {
    table: "cac_costs",
    column: "amount",
    concept: "importe",
    persistence: saved,
    nature: "coste_adquisicion",
    span: "trimestral",
  },
  {
    table: "finance_cost_lines",
    column: "amount",
    concept: "importe",
    persistence: saved,
    nature: "coste_recurrente",
    span: "mensual",
  },
  {
    table: "finance_invoices",
    column: "amount",
    concept: "importe",
    persistence: saved,
    nature: "factura",
    span: "puntual",
    verify: "Si admite importes negativos (abonos).",
  },
  {
    table: "segment_budget_quarters",
    column: "plan_revenue",
    concept: "importe",
    persistence: saved,
    nature: "ingreso_plan",
    span: "trimestral",
  },
  {
    table: "segment_budget_quarters",
    column: "actual_revenue",
    concept: "importe",
    persistence: saved,
    nature: "ingreso_real",
    span: "trimestral",
  },
  // Origen
  {
    table: "accounts",
    column: "field_sources",
    concept: "origen_valor",
    persistence: saved,
    note: "Only the fields of accounts that Nokko fills; legacy shape {source, at, quote}",
  },
  {
    table: "icp_profiles",
    column: "field_sources",
    concept: "origen_valor",
    persistence: saved,
    note: "Migration 0058; tracked columns in TRACKED_FIELDS",
  },
  {
    table: "positioning",
    column: "field_sources",
    concept: "origen_valor",
    persistence: saved,
    note: "Migration 0061",
  },
  {
    table: "messaging_pillars",
    column: "field_sources",
    concept: "origen_valor",
    persistence: saved,
    note: "Migration 0061",
  },
  {
    table: "segments",
    column: "field_sources",
    concept: "origen_valor",
    persistence: saved,
    note: "Migration 0061",
  },
  {
    table: "segments",
    column: "acquisition_motion",
    concept: "motion_adquisicion",
    persistence: saved,
    note: "Migration 0071; not tracked in field_sources",
  },
  {
    table: "platform_admins",
    column: "user_id",
    concept: "clave_usuario",
    persistence: saved,
    note: "Migration 0075; rows are written by the platform, not from a screen",
  },
  {
    table: "platform_admins",
    column: "created_at",
    concept: "alta_sistema",
    persistence: saved,
    note: "Migration 0075; set by the database default",
  },
  { table: "deals", column: "source", concept: "canal_de_entrada", persistence: saved },
  { table: "people", column: "source", concept: "canal_de_entrada", persistence: saved },
  { table: "tasks", column: "source", concept: "creado_por", persistence: saved },
  {
    table: "agent_pending_actions",
    column: "source",
    concept: "creado_por",
    persistence: "pending_action",
  },
  { table: "memories", column: "source", concept: "creado_por", persistence: "memory" },
  { table: "account_signals", column: "source", concept: "fuente_citada", persistence: saved },
  { table: "discoveries", column: "source", concept: "fuente_citada", persistence: saved },
  {
    table: "leads",
    column: "source",
    concept: "fuente_citada",
    persistence: saved,
    note: "Free text up to 100 characters (CSV, Descubiertos, utm values)",
  },
  { table: "trials", column: "source", concept: "fuente_citada", persistence: saved },
];

export function conceptById(id: ConceptId): Concept {
  const c = CONCEPTS.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown concept ${id}`);
  return c;
}

/** The binding of a column, or null while it is not catalogued. */
export function bindingOf(table: string, column: string): Binding | null {
  return BINDINGS.find((b) => b.table === table && b.column === column) ?? null;
}

/** The closed values a place accepts, or null when its concept has none (free text, numbers, ranges). */
export function allowedValues(table: string, column: string): readonly string[] | null {
  const b = bindingOf(table, column);
  if (!b) return null;
  const c = conceptById(b.concept);
  return c.allowedBy?.[table] ?? c.allowed ?? null;
}

/** Screens and modules that show or edit each concept (CA-11). The test checks that every file exists. */
export const SHOWN_IN: Record<ConceptId, string[]> = {
  clave_registro: ["src/integrations/supabase/types.ts"],
  clave_play: ["src/lib/plays/custom/model.ts"],
  nombre_play: ["src/lib/plays/custom/model.ts"],
  definicion_play: ["src/lib/plays/custom/model.ts"],
  solo_verificado: ["src/lib/plays/custom/model.ts"],
  url_evidencia: ["src/lib/plays/custom/model.ts"],
  cita_evidencia: ["src/lib/plays/custom/model.ts"],
  fecha_evento: ["src/lib/plays/custom/model.ts"],
  cambio_sistema: ["src/integrations/supabase/types.ts"],
  estado_play: ["src/integrations/supabase/types.ts"],
  primera_activacion: ["src/integrations/supabase/types.ts"],
  muestra_prueba: ["src/integrations/supabase/types.ts"],
  exitos_prueba: ["src/integrations/supabase/types.ts"],
  fecha_prueba: ["src/integrations/supabase/types.ts"],
  tipo_coste: ["src/integrations/supabase/types.ts"],
  superficie_borrador: ["src/lib/agent/tools/core-read.ts", "src/lib/org-data.ts"],
  motivo_bloqueo_email: ["src/lib/email-status.ts"],
  pais: [
    "src/components/country-pick.tsx",
    "src/components/account/fit-fields.tsx",
    "src/components/clay.tsx",
    "src/components/apollo.tsx",
    "src/components/parallel.tsx",
    "src/components/orchestrator/icp-companies.tsx",
    "src/components/orchestrator/complete-account.tsx",
    "src/lib/assignment.ts",
  ],
  paises: ["src/components/icp-editor.tsx", "src/components/discoveries/icp-panel.tsx"],
  region: ["src/lib/assignment.ts"],
  geografia_texto: ["src/components/discoveries/icp-panel.tsx", "src/components/parallel.tsx"],
  tamano_empleados: [
    "src/components/icp-editor.tsx",
    "src/components/account/fit-fields.tsx",
    "src/components/discoveries/icp-panel.tsx",
    "src/components/clay.tsx",
    "src/components/apollo.tsx",
    "src/components/orchestrator/icp-companies.tsx",
  ],
  tamano_descripcion: [
    "src/components/icp-editor.tsx",
    "src/components/setup/wizard.tsx",
    "src/components/discoveries/icp-panel.tsx",
  ],
  importe: [
    "src/lib/money.ts",
    "src/components/new-deal.tsx",
    "src/components/metrics/finance-panel.tsx",
    "src/components/cac-panel.tsx",
    "src/components/segment-coverage.tsx",
    "src/components/won-deals-panel.tsx",
    "src/components/leads/lead-detail.tsx",
  ],
  origen_valor: ["src/components/account/fit-fields.tsx", "src/lib/provenance.ts"],
  canal_de_entrada: [
    "src/routes/_authenticated/deals.tsx",
    "src/routes/_authenticated/people.tsx",
    "src/components/metrics/revops-panels.tsx",
    "src/routes/_authenticated/metrics.tsx",
  ],
  creado_por: ["src/routes/_authenticated/memory.tsx", "src/routes/_authenticated/debates.tsx"],
  fuente_citada: ["src/components/leads/lead-dialogs.tsx", "src/lib/web-research-core.ts"],
  motivo_perdida: [
    "src/components/loss-reason.tsx",
    "src/routes/_authenticated/deals.tsx",
    "src/lib/loss-reasons.ts",
  ],
  detalle_perdida: ["src/components/loss-reason.tsx", "src/routes/_authenticated/deals.tsx"],
  competidor_perdida: [
    "src/components/loss-reason.tsx",
    "src/routes/_authenticated/deals.tsx",
    "src/lib/loss-reasons.ts",
  ],
  regla_experimento: ["src/components/theory-u/prototypes.tsx", "src/lib/experiments.ts"],
  fecha_revision: ["src/components/theory-u/prototypes.tsx", "src/lib/experiments.ts"],
  decision_experimento: ["src/components/theory-u/prototypes.tsx", "src/lib/experiments.ts"],
  elemento_cambio: ["src/components/theory-u/prototypes.tsx", "src/lib/experiments.ts"],
  registro_decision: ["src/components/theory-u/prototypes.tsx", "src/lib/experiments-core.ts"],
  motion_adquisicion: ["src/components/strategy/motions.tsx"],
  clave_usuario: ["src/integrations/supabase/types.ts"],
  clave_empresa: ["src/integrations/supabase/types.ts"],
  direccion_email: ["src/lib/email-verification.ts"],
  estado_email: ["src/lib/email-verification.ts", "src/components/email-verification.tsx"],
  estado_proveedor_email: ["src/integrations/supabase/types.ts"],
  alta_sistema: ["src/integrations/supabase/types.ts"],
};

/** Every place where a concept is stored (columns) and shown (screens and modules). */
export function placesOf(id: ConceptId): { stored: Binding[]; shown: string[] } {
  conceptById(id);
  return { stored: BINDINGS.filter((b) => b.concept === id), shown: SHOWN_IN[id] };
}
