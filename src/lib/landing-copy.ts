// Textos de la página de presentación: sólo promesas que el equipo ya usa dentro de la app (probado en landing-copy.test.ts).
// No se menciona lo que aún no está listo. Los ejemplos son inventados: sin nombres de clientes, cifras ni datos reales.

export type Promesa = {
  /** Lo que se promete en la página. */
  titulo: string;
  texto: string;
  /** La parte de la app donde el equipo ya lo usa hoy. */
  enLaApp: string;
};

export const TITULAR = "Nokko arma y sigue la estrategia comercial de tu equipo de ventas";
export const BAJADA =
  "Para gerentes y vendedores que quieren saber a qué cuentas ir, con qué mensaje y qué hacer cada día, sin perderse en planillas.";

export const PROMESAS: Promesa[] = [
  {
    titulo: "Una estrategia comercial aprobada",
    texto:
      "Defines a quién le vendes, qué le ofreces y cómo llegas. El gerente revisa y aprueba antes de que el equipo la use.",
    enLaApp: "Estrategia comercial",
  },
  {
    titulo: "Un asistente que propone, tú decides",
    texto:
      "El asistente sugiere los próximos pasos con cada cuenta y los deja pendientes hasta que alguien del equipo los acepta.",
    enLaApp: "Asistente comercial",
  },
  {
    titulo: "Avisos a tiempo",
    texto:
      "Nokko te avisa cuando una cuenta muestra interés o cuando un cliente empieza a usar menos tu producto.",
    enLaApp: "Sugerencias y avisos",
  },
  {
    titulo: "Cuentas y contactos en un solo lugar",
    texto:
      "Cada vendedor ve sus cuentas, sus contactos y sus negocios abiertos, con la próxima acción clara.",
    enLaApp: "Cuentas y negocios",
  },
];

/** Ejemplo inventado para ilustrar la página. Nunca usar datos de una empresa real. */
export const EJEMPLO = {
  cuenta: "Distribuidora Ejemplo",
  aviso: "Distribuidora Ejemplo: más personas usan tu producto esta semana. Propón el plan de equipo.",
  aclaracion: "Ejemplo ilustrativo, no corresponde a ninguna empresa real.",
};

/** Temas que la página no debe mencionar mientras no estén listos. */
export const TEMAS_NO_LISTOS = ["bandeja", "respuestas", "carpeta", "carpetas"];

export const MENSAJES = {
  faltaNombre: "Escribe tu nombre para que sepamos cómo llamarte.",
  correoInvalido: "Revisa tu correo: parece que falta algo, por ejemplo la @ o el dominio.",
  muyLargo: "El texto es muy largo. Resúmelo en pocas líneas y vuelve a enviarlo.",
  conEnlaces: "Quita los enlaces del mensaje y vuelve a enviarlo.",
  enviado: "Listo, recibimos tus datos. El equipo te escribe pronto.",
  duplicado: "Ya habíamos recibido tus datos. No hace falta enviarlos otra vez.",
  falla:
    "No pudimos enviar tus datos en este momento. Espera unos minutos y vuelve a intentarlo, o escríbenos más tarde.",
  topeDiario: "Hoy ya recibimos muchos mensajes. Vuelve a intentarlo mañana.",
};

export const LIMITES = { nombre: 80, correo: 254, mensaje: 1000 } as const;

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ENLACE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|es|ar|mx|cl|info|biz|app)(\/|\b))/i;

export type ContactoLanding = { nombre: string; correo: string; mensaje?: string };

/** Revisión previa en la página; el servidor vuelve a revisar todo antes de guardar. */
export function revisarContacto(
  raw: Partial<ContactoLanding>,
): { ok: true; datos: ContactoLanding } | { ok: false; mensaje: string } {
  const nombre = String(raw.nombre ?? "").trim();
  const correo = String(raw.correo ?? "")
    .trim()
    .toLowerCase();
  const mensaje = String(raw.mensaje ?? "").trim();
  if (!nombre) return { ok: false, mensaje: MENSAJES.faltaNombre };
  if (!correo || correo.length > LIMITES.correo || !CORREO.test(correo))
    return { ok: false, mensaje: MENSAJES.correoInvalido };
  if (nombre.length > LIMITES.nombre || mensaje.length > LIMITES.mensaje)
    return { ok: false, mensaje: MENSAJES.muyLargo };
  if (ENLACE.test(nombre) || ENLACE.test(mensaje)) return { ok: false, mensaje: MENSAJES.conEnlaces };
  return { ok: true, datos: { nombre, correo, ...(mensaje ? { mensaje } : {}) } };
}

/** Traduce cualquier respuesta del envío a un mensaje claro; nunca muestra el error tal cual llega. */
export function mensajeDelEnvio(r: { ok?: boolean; duplicado?: boolean; tope?: boolean } | unknown): string {
  if (r && typeof r === "object") {
    const x = r as { ok?: boolean; duplicado?: boolean; tope?: boolean };
    if (x.duplicado) return MENSAJES.duplicado;
    if (x.tope) return MENSAJES.topeDiario;
    if (x.ok) return MENSAJES.enviado;
  }
  return MENSAJES.falla;
}
